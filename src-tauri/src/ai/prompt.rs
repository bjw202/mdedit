// @MX:NOTE: [AUTO] 기능별 프롬프트 템플릿 + 컨텍스트 상한 절단(순수) - 토큰 절약 전략(§7)
// @MX:SPEC: SPEC-AI-001

//! 프롬프트 조립은 전부 Rust에서 수행한다(REQ-AI-003). 프론트는 "기능 종류 + 텍스트 조각"만 넘긴다.
//!
//! 컨텍스트는 상한 내에서 **문단 경계(`\n\n`)로 무손실 절단**하고 잘렸는지 플래그로 보고한다(§7, P7).
//! 교체 대상(선택 텍스트)은 절대 절단하지 않는다(REQ-AI-027) — 여기서는 user_prompt에 원문 그대로 담는다.

/// 인라인 편집 주변 문맥 상한(앞·뒤 각). 앞뒤 합쳐 ~2K자(§7).
const INLINE_SIDE_MAX: usize = 1000;
/// 섹션 채우기 직전 본문 꼬리 상한(§7: 본문 1.5K자).
const SECTION_TAIL_MAX: usize = 1500;

/// 모든 기능 공통 출력 지시 — 결과만, 설명·펜스 금지(§7).
const COMMON_INSTRUCTION: &str =
    "결과 텍스트만 출력하라. 설명·인사·사족을 붙이지 말라. 마크다운 코드펜스는 요청받은 경우에만 사용하라.";

/// AI 편집 기능 종류. 프리셋 5종 + 직접 입력 + 섹션 채우기(§4.1, §5).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AiFeature {
    /// 다듬기 — 맞춤법·문장 자연스럽게.
    Polish,
    /// 개요로 정리 — 개괄식 불레틴.
    Outline,
    /// 표로 만들기 — 마크다운 표.
    Table,
    /// 다이어그램으로 — mermaid 코드블록.
    Diagram,
    /// 짧게 줄이기 — 핵심만.
    Shorten,
    /// 직접 입력 — 사용자 지시.
    Custom(String),
    /// 섹션 채우기 — 문체 상속 초안.
    FillSection,
}

impl AiFeature {
    /// 마크다운 펜스 출력이 허용되는 변환 계열인지(표·다이어그램).
    pub fn allows_markdown_fence(&self) -> bool {
        matches!(self, AiFeature::Table | AiFeature::Diagram)
    }

    /// IPC 계약 `(feature, presetKind)`를 내부 AiFeature 템플릿으로 매핑한다(순수).
    ///
    /// 해석 순서(tolerant): `presetKind`가 있으면 그것으로, 없으면 `feature`로 템플릿 키를 정한다.
    /// 실제 도착값 — feature ∈ {"inline-edit","section-fill","diagram"}(kebab-case),
    /// presetKind ∈ {"polish","outline","table","diagram","shorten","custom"}(section-fill엔 없음).
    /// 잘못된 조합(예: presetKind 없는 "inline-edit", 미지의 키)은 오류.
    pub fn resolve(
        feature: &str,
        preset_kind: Option<&str>,
        custom_instruction: Option<&str>,
    ) -> Result<AiFeature, String> {
        let key = preset_kind.unwrap_or(feature);
        match key {
            "polish" => Ok(AiFeature::Polish),
            "outline" => Ok(AiFeature::Outline),
            "table" => Ok(AiFeature::Table),
            "diagram" => Ok(AiFeature::Diagram),
            "shorten" => Ok(AiFeature::Shorten),
            "custom" => Ok(AiFeature::Custom(custom_instruction.unwrap_or("").to_string())),
            // 프론트는 kebab-case "section-fill"을 보낸다. 구 표기도 관대 수용.
            "section-fill" | "fill_section" => Ok(AiFeature::FillSection),
            other => Err(format!("알 수 없는 AI 기능/프리셋: {}", other)),
        }
    }

    /// 기능별 시스템 프롬프트(공통 지시 포함).
    pub fn system_prompt(&self) -> String {
        let task = match self {
            AiFeature::Polish => {
                "너는 한국어 문장 교정기다. 주어진 텍스트의 맞춤법과 문장을 자연스럽게 다듬되 의미와 정보는 그대로 유지하라."
            }
            AiFeature::Outline => {
                "주어진 텍스트를 개괄식 불레틴으로 정리하라. 핵심 항목을 들여쓰기 계층으로 나누고 명사형으로 종결하라. 이미 개조식이면 계층과 표현만 다듬어라."
            }
            AiFeature::Table => {
                "주어진 텍스트의 내용을 마크다운 표로 변환하라. 표 헤더와 정렬을 명확히 하라."
            }
            AiFeature::Diagram => {
                "주어진 절차·관계 설명을 mermaid 다이어그램으로 변환하라. ```mermaid 코드펜스로 감싸고 유효한 mermaid 문법만 출력하라."
            }
            AiFeature::Shorten => {
                "주어진 텍스트에서 핵심만 남겨 짧게 줄여라. 중요한 정보는 잃지 말라."
            }
            AiFeature::Custom(instruction) => {
                return format!("{}\n\n지시: {}", COMMON_INSTRUCTION, instruction.trim());
            }
            AiFeature::FillSection => {
                "너는 문서 작성 보조자다. 문서의 어조와 종결어미를 그대로 이어받아 지정된 섹션의 초안을 작성하라. 문서 개요와 직전 본문의 맥락에 맞는 내용을 채워라."
            }
        };
        format!("{}\n\n{}", task, COMMON_INSTRUCTION)
    }
}

/// 조립 완료된 프롬프트. `truncated`는 컨텍스트가 상한으로 잘렸는지(§7 침묵 절단 금지).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssembledPrompt {
    pub system_prompt: String,
    pub user_prompt: String,
    pub truncated: bool,
}

/// 텍스트 앞부분을 유지하며 상한으로 절단한다(뒤 문맥용). 문단 경계 우선.
///
/// 상한 이하면 원문 그대로 `(text, false)`. 초과 시 `max_chars` 이내의 마지막 `\n\n`에서 자른다.
/// 문단 경계가 없으면 문자 경계로 자른다(멀티바이트 안전, 패닉 없음).
pub fn truncate_head_at_paragraph(text: &str, max_chars: usize) -> (String, bool) {
    if text.chars().count() <= max_chars {
        return (text.to_string(), false);
    }
    let window: String = text.chars().take(max_chars).collect();
    if let Some(idx) = window.rfind("\n\n") {
        (window[..idx].trim_end().to_string(), true)
    } else {
        (window.trim_end().to_string(), true)
    }
}

/// 텍스트 뒷부분을 유지하며 상한으로 절단한다(앞 문맥·섹션 꼬리용). 문단 경계 우선.
///
/// 상한 이하면 원문 그대로 `(text, false)`. 초과 시 마지막 `max_chars`를 취하되,
/// 그 안의 첫 `\n\n` 이후부터 시작해 문단을 온전히 유지한다.
pub fn truncate_tail_at_paragraph(text: &str, max_chars: usize) -> (String, bool) {
    let total = text.chars().count();
    if total <= max_chars {
        return (text.to_string(), false);
    }
    let window: String = text.chars().skip(total - max_chars).collect();
    if let Some(idx) = window.find("\n\n") {
        (window[idx + 2..].trim_start().to_string(), true)
    } else {
        (window.trim_start().to_string(), true)
    }
}

/// 인라인 편집(축 1) 프롬프트를 조립한다. 선택 텍스트는 절단하지 않는다(REQ-AI-027).
pub fn build_inline_prompt(
    feature: &AiFeature,
    selection: &str,
    before: &str,
    after: &str,
) -> AssembledPrompt {
    let (before_ctx, before_cut) = truncate_tail_at_paragraph(before, INLINE_SIDE_MAX);
    let (after_ctx, after_cut) = truncate_head_at_paragraph(after, INLINE_SIDE_MAX);

    let mut user_prompt = String::new();
    if !before_ctx.trim().is_empty() {
        user_prompt.push_str("[앞 문맥]\n");
        user_prompt.push_str(before_ctx.trim());
        user_prompt.push_str("\n\n");
    }
    user_prompt.push_str("[대상]\n");
    user_prompt.push_str(selection);
    if !after_ctx.trim().is_empty() {
        user_prompt.push_str("\n\n[뒤 문맥]\n");
        user_prompt.push_str(after_ctx.trim());
    }

    AssembledPrompt {
        system_prompt: feature.system_prompt(),
        user_prompt,
        truncated: before_cut || after_cut,
    }
}

/// 섹션 채우기(시나리오 F) 프롬프트를 조립한다. 개요는 무제한(짧음) + 본문 꼬리 1.5K(§7).
pub fn build_section_prompt(outline: &str, tail: &str) -> AssembledPrompt {
    let (tail_ctx, tail_cut) = truncate_tail_at_paragraph(tail, SECTION_TAIL_MAX);

    let mut user_prompt = String::new();
    user_prompt.push_str("[문서 개요]\n");
    user_prompt.push_str(outline.trim());
    if !tail_ctx.trim().is_empty() {
        user_prompt.push_str("\n\n[직전 본문]\n");
        user_prompt.push_str(tail_ctx.trim());
    }

    AssembledPrompt {
        system_prompt: AiFeature::FillSection.system_prompt(),
        user_prompt,
        truncated: tail_cut,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- (feature, presetKind) → AiFeature 매핑 (IPC 계약, tolerant) ---

    #[test]
    fn resolve_prefers_preset_kind_over_feature() {
        // 실제 도착: feature="inline-edit" + presetKind=프리셋.
        assert_eq!(
            AiFeature::resolve("inline-edit", Some("polish"), None),
            Ok(AiFeature::Polish)
        );
        assert_eq!(
            AiFeature::resolve("inline-edit", Some("outline"), None),
            Ok(AiFeature::Outline)
        );
        assert_eq!(
            AiFeature::resolve("inline-edit", Some("table"), None),
            Ok(AiFeature::Table)
        );
        assert_eq!(
            AiFeature::resolve("inline-edit", Some("shorten"), None),
            Ok(AiFeature::Shorten)
        );
    }

    #[test]
    fn resolve_falls_back_to_feature_when_no_preset() {
        // 킬러 유스케이스: feature="diagram"이 직접 도착(presetKind 없음).
        assert_eq!(
            AiFeature::resolve("diagram", None, None),
            Ok(AiFeature::Diagram)
        );
        // 섹션 채우기: feature="section-fill"이 직접 도착.
        assert_eq!(
            AiFeature::resolve("section-fill", None, None),
            Ok(AiFeature::FillSection)
        );
    }

    #[test]
    fn resolve_diagram_feature_with_and_without_preset() {
        // 실제 프론트: 다이어그램 프리셋은 feature="diagram" + presetKind="diagram"으로 도착(T-012).
        assert_eq!(
            AiFeature::resolve("diagram", Some("diagram"), None),
            Ok(AiFeature::Diagram)
        );
        // presetKind 없이 feature="diagram"만 와도 동일하게 매핑.
        assert_eq!(
            AiFeature::resolve("diagram", None, None),
            Ok(AiFeature::Diagram)
        );
    }

    #[test]
    fn resolve_accepts_both_section_fill_spellings() {
        assert_eq!(
            AiFeature::resolve("section-fill", None, None),
            Ok(AiFeature::FillSection)
        );
        assert_eq!(
            AiFeature::resolve("fill_section", None, None),
            Ok(AiFeature::FillSection)
        );
    }

    #[test]
    fn resolve_custom_carries_instruction() {
        assert_eq!(
            AiFeature::resolve("inline-edit", Some("custom"), Some("영어로 번역")),
            Ok(AiFeature::Custom("영어로 번역".to_string()))
        );
    }

    #[test]
    fn resolve_rejects_invalid_combos() {
        // presetKind 없이 "inline-edit"만 오면 템플릿 키가 아니므로 오류.
        assert!(AiFeature::resolve("inline-edit", None, None).is_err());
        // 미지의 feature.
        assert!(AiFeature::resolve("chat", None, None).is_err());
        // 미지의 presetKind.
        assert!(AiFeature::resolve("inline-edit", Some("translate"), None).is_err());
    }

    #[test]
    fn only_transform_features_allow_fence() {
        assert!(AiFeature::Table.allows_markdown_fence());
        assert!(AiFeature::Diagram.allows_markdown_fence());
        assert!(!AiFeature::Polish.allows_markdown_fence());
        assert!(!AiFeature::Outline.allows_markdown_fence());
    }

    // --- system prompt templates ---

    #[test]
    fn every_feature_includes_common_instruction() {
        for feature in [
            AiFeature::Polish,
            AiFeature::Outline,
            AiFeature::Table,
            AiFeature::Diagram,
            AiFeature::Shorten,
            AiFeature::FillSection,
            AiFeature::Custom("x".to_string()),
        ] {
            let sys = feature.system_prompt();
            assert!(
                sys.contains("결과 텍스트만 출력"),
                "feature {:?} missing common instruction",
                feature
            );
        }
    }

    #[test]
    fn feature_templates_are_distinct() {
        let polish = AiFeature::Polish.system_prompt();
        let outline = AiFeature::Outline.system_prompt();
        let diagram = AiFeature::Diagram.system_prompt();
        assert_ne!(polish, outline);
        assert_ne!(polish, diagram);
        assert!(diagram.contains("mermaid"));
        assert!(outline.contains("불레틴"));
    }

    #[test]
    fn custom_prompt_embeds_user_instruction() {
        let sys = AiFeature::Custom("존댓말로 바꿔줘".to_string()).system_prompt();
        assert!(sys.contains("존댓말로 바꿔줘"));
    }

    // --- truncation boundaries ---

    #[test]
    fn short_text_is_not_truncated() {
        let (out, cut) = truncate_head_at_paragraph("짧은 문장", 1000);
        assert_eq!(out, "짧은 문장");
        assert!(!cut);
    }

    #[test]
    fn head_truncation_cuts_at_paragraph_boundary() {
        let text = "첫 문단입니다.\n\n둘째 문단은 매우 길어서 상한을 넘깁니다 어쩌구 저쩌구";
        let (out, cut) = truncate_head_at_paragraph(text, 12);
        assert!(cut);
        // 12자 창 안의 마지막 문단 경계에서 잘려 첫 문단만 남는다.
        assert_eq!(out, "첫 문단입니다.");
    }

    #[test]
    fn head_truncation_falls_back_to_char_boundary() {
        // 문단 경계가 창 안에 없으면 문자 경계로 자른다(패닉 없음, 멀티바이트 안전).
        let text = "가나다라마바사아자차카타파하";
        let (out, cut) = truncate_head_at_paragraph(text, 5);
        assert!(cut);
        assert_eq!(out.chars().count(), 5);
        assert_eq!(out, "가나다라마");
    }

    #[test]
    fn tail_truncation_keeps_ending_at_paragraph_boundary() {
        let text = "앞 문단은 버려집니다 어쩌구 저쩌구.\n\n마지막 문단";
        let (out, cut) = truncate_tail_at_paragraph(text, 10);
        assert!(cut);
        assert_eq!(out, "마지막 문단");
    }

    #[test]
    fn tail_truncation_is_multibyte_safe() {
        let text = "가나다라마바사아자차카타파하";
        let (out, cut) = truncate_tail_at_paragraph(text, 4);
        assert!(cut);
        assert_eq!(out.chars().count(), 4);
        assert_eq!(out, "카타파하");
    }

    // --- inline prompt assembly ---

    #[test]
    fn inline_prompt_keeps_selection_verbatim() {
        // 선택 텍스트는 절대 절단되지 않는다(REQ-AI-027).
        let long_selection = "매우 긴 선택 텍스트 ".repeat(500);
        let prompt = build_inline_prompt(&AiFeature::Polish, &long_selection, "", "");
        assert!(prompt.user_prompt.contains(&long_selection));
    }

    #[test]
    fn inline_prompt_includes_context_sections() {
        let prompt = build_inline_prompt(&AiFeature::Polish, "대상문장", "앞문맥", "뒤문맥");
        assert!(prompt.user_prompt.contains("[앞 문맥]"));
        assert!(prompt.user_prompt.contains("앞문맥"));
        assert!(prompt.user_prompt.contains("[대상]"));
        assert!(prompt.user_prompt.contains("대상문장"));
        assert!(prompt.user_prompt.contains("[뒤 문맥]"));
        assert!(prompt.user_prompt.contains("뒤문맥"));
        assert!(!prompt.truncated);
    }

    #[test]
    fn inline_prompt_omits_empty_context() {
        let prompt = build_inline_prompt(&AiFeature::Polish, "대상", "", "");
        assert!(!prompt.user_prompt.contains("[앞 문맥]"));
        assert!(!prompt.user_prompt.contains("[뒤 문맥]"));
        assert!(prompt.user_prompt.contains("[대상]"));
    }

    #[test]
    fn inline_prompt_flags_truncated_context() {
        let long_before = "x".repeat(5000);
        let prompt = build_inline_prompt(&AiFeature::Polish, "대상", &long_before, "");
        assert!(prompt.truncated);
    }

    // --- section prompt assembly ---

    #[test]
    fn section_prompt_uses_fill_section_template() {
        let prompt = build_section_prompt("# 개요\n## 결론", "직전 본문입니다.");
        assert!(prompt.system_prompt.contains("어조와 종결어미"));
        assert!(prompt.user_prompt.contains("[문서 개요]"));
        assert!(prompt.user_prompt.contains("[직전 본문]"));
        assert!(prompt.user_prompt.contains("직전 본문입니다."));
    }

    #[test]
    fn section_prompt_flags_truncated_tail() {
        let long_tail = "긴 본문 ".repeat(1000);
        let prompt = build_section_prompt("# 개요", &long_tail);
        assert!(prompt.truncated);
    }
}
