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
/// 자유 위치 이어쓰기 뒤 문맥 상한(SPEC-AI-003 §7 신규) — 앞 문맥(SECTION_TAIL_MAX)과 별도 상한.
const CONTINUE_HEAD_MAX: usize = 1500;

/// 모든 기능 공통 출력 지시 — 결과만, 설명·펜스 금지(§7).
const COMMON_INSTRUCTION: &str =
    "결과 텍스트만 출력하라. 설명·인사·사족을 붙이지 말라. 마크다운 코드펜스는 요청받은 경우에만 사용하라.";

/// 인라인 편집 문맥 가드(SPEC-AI-004 D-A) — `build_inline_prompt`가 `[앞/뒤 문맥]` 중 하나라도
/// 조립할 때만 user-prompt 선두에 삽입한다. 요약류 동사("핵심만 남겨 짧게 줄여라" 등)가 문맥까지
/// 변환 대상으로 흡수하는 결함(s07/s09)을 막는다.
const INLINE_CONTEXT_GUARD: &str =
    "[앞 문맥]과 [뒤 문맥]은 참고용일 뿐이며, [대상]만 변환하고 문맥의 내용은 결과에 포함하지 말라.";

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
    /// 이어쓰기 — 문서 끝 자유 위치 이어쓰기(문체 상속, REQ-AI-028 문서 끝 분기).
    Continue,
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
            // 이어쓰기(REQ-AI-028 문서 끝 분기): feature="section-fill" + presetKind="continue"로 도착.
            "continue" => Ok(AiFeature::Continue),
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
                // BUG-3(b): 코드펜스로 감싸라고 지시하면 모델이 실제로 펜스를 씌워 응답하고,
                // 프런트 사전 검증(mermaid.parse)이 펜스를 무효 문법으로 판정해 불필요한 자동
                // 재요청을 유발한다. 순수 mermaid 문법만, 펜스·설명 없이 출력하도록 명시한다.
                "주어진 절차·관계 설명을 mermaid 다이어그램으로 변환하라. 순수 mermaid 문법 코드만 출력하고, ```mermaid 코드펜스나 다른 설명 문구 없이 다이어그램 코드만 그대로 출력하라. 출력은 graph·flowchart·sequenceDiagram 등 mermaid 키워드로 시작해야 하며, 백틱 문자는 한 글자도 포함하지 말라."
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
            // @MX:NOTE: [AUTO] SPEC-AI-004 D-B/D-D — base 재조준(재복창 금지) + 온건 분량 상한
            // 실 CLI 재현(s11 리스트 이어쓰기): SPEC-AI-003 조건부 지시(:234-243 아래, 뒤 문맥
            // 반복·선점 금지)는 뒤 문맥만 조준해, 커서 "앞" 직전 본문 꼬리의 재출력은 막지 못했다.
            // base 한 곳에 재복창 금지(D-B)와 온건형 분량·형식 상한(D-D)을 함께 넣어 doc-end·
            // 자유 위치 양쪽에 자동 상속시킨다(REQ-AI4-004~007).
            AiFeature::Continue => {
                "너는 문서 작성 보조자다. 문서의 어조와 종결어미를 그대로 이어받아 직전 본문에 자연스럽게 이어지는 다음 내용을 작성하라. 문서 개요와 직전 본문의 맥락에서 벗어나지 말라. 이미 작성된 직전 본문을 다시 출력하거나 반복하지 말고, 끊긴 지점 바로 다음부터 새 텍스트만 이어서 작성하라. 분량은 한두 문단 이내로 하고, 직전 본문에 없던 코드 블록·표·목차 같은 새로운 형식을 임의로 도입하지 말라."
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
    let has_context = !before_ctx.trim().is_empty() || !after_ctx.trim().is_empty();

    let mut user_prompt = String::new();
    // 문맥 0개면 가드를 삽입하지 않아 기존 조립 결과와 바이트 동일을 유지한다(REQ-AI4-003/012).
    if has_context {
        user_prompt.push_str(INLINE_CONTEXT_GUARD);
        user_prompt.push_str("\n\n");
    }
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

// @MX:ANCHOR: [AUTO] build_continue_prompt - 이어쓰기 3섹션 조립 계약(개요+앞 문맥+뒤 문맥)
// @MX:REASON: [AUTO] mod.rs 의 유일 호출 지점이자 REQ-AI3-009/010 하위호환 계약의 단일 조립
//   지점 — 빈 after 시 [뒤 문맥] 섹션·지시를 생략해 기존 문서 끝 프롬프트와 바이트 동일해야 한다.
// @MX:SPEC: SPEC-AI-003
/// 이어쓰기(REQ-AI-028 문서 끝 분기 + SPEC-AI-003 자유 위치 M2) 프롬프트를 조립한다.
/// 개요 무제한 + 앞 문맥(`before`) 1.5K(§7, 기존 동작) + 뒤 문맥(`after`) 1.5K(신규, REQ-AI3-009).
/// `after` 가 비어 있으면 [뒤 문맥] 섹션과 반복/선점 금지 지시를 생략해 기존 출력과 바이트
/// 동일하게 유지한다(REQ-AI3-010, 하위호환).
pub fn build_continue_prompt(outline: &str, before: &str, after: &str) -> AssembledPrompt {
    let (tail_ctx, tail_cut) = truncate_tail_at_paragraph(before, SECTION_TAIL_MAX);
    let (head_ctx, head_cut) = truncate_head_at_paragraph(after, CONTINUE_HEAD_MAX);
    let has_after = !head_ctx.trim().is_empty();

    let mut user_prompt = String::new();
    user_prompt.push_str("[문서 개요]\n");
    user_prompt.push_str(outline.trim());
    if !tail_ctx.trim().is_empty() {
        user_prompt.push_str("\n\n[직전 본문]\n");
        user_prompt.push_str(tail_ctx.trim());
    }
    if has_after {
        user_prompt.push_str("\n\n[뒤 문맥]\n");
        user_prompt.push_str(head_ctx.trim());
    }

    AssembledPrompt {
        system_prompt: continue_system_prompt(has_after),
        user_prompt,
        truncated: tail_cut || head_cut,
    }
}

/// 이어쓰기 시스템 프롬프트 — 뒤 문맥이 있을 때만 "끊긴 문장 완성·뒤 문맥 연결·반복/선점 금지"
/// 지시를 조건부로 덧붙인다(REQ-AI3-009). `AiFeature::Continue.system_prompt()` 자체는 문서 끝
/// 분기 하위호환을 위해 그대로 둔다(기존 테스트 무개정).
fn continue_system_prompt(has_after: bool) -> String {
    let base = AiFeature::Continue.system_prompt();
    if !has_after {
        return base;
    }
    format!(
        "{}\n\n끊긴 문장부터 이어서 완성하고, 뒤 문맥으로 자연스럽게 연결하라. 뒤 문맥의 내용을 반복하거나 선점하는 것은 금지한다.",
        base
    )
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

    // --- 이어쓰기(문서 끝 분기, REQ-AI-028) ---

    #[test]
    fn resolve_continue_preset_kind_to_continue_variant() {
        // 프론트 계약: feature="section-fill" + presetKind="continue"로 도착(Gap 2).
        assert_eq!(
            AiFeature::resolve("section-fill", Some("continue"), None),
            Ok(AiFeature::Continue)
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
        assert!(!AiFeature::Continue.allows_markdown_fence());
    }

    #[test]
    fn continue_system_prompt_instructs_style_inheritance() {
        let sys = AiFeature::Continue.system_prompt();
        assert!(sys.contains("이어"), "continue prompt must instruct continuing the prose: {}", sys);
        assert!(sys.contains("어조와 종결어미"));
        assert!(sys.contains("결과 텍스트만 출력")); // COMMON_INSTRUCTION
    }

    #[test]
    fn fill_section_and_continue_templates_are_distinct() {
        let fill = AiFeature::FillSection.system_prompt();
        let cont = AiFeature::Continue.system_prompt();
        assert_ne!(fill, cont);
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
            AiFeature::Continue,
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

    // BUG-3(b) 실기기 재현: 기존 다이어그램 프롬프트는 "```mermaid 코드펜스로 감싸고"를 지시해
    // 모델이 실제로 펜스를 씌워 응답한다. 프런트 사전 검증(mermaid.parse)은 펜스를 무효 문법으로
    // 판정해 불필요한 자동 재요청을 유발한다(BUG-1 재발 트리거). 프롬프트는 펜스 금지를 명시해야
    // 한다 — RED(수정 전): 기존 문구가 여전히 펜스 사용을 지시하므로 실패한다.
    #[test]
    fn diagram_prompt_forbids_markdown_fence_output() {
        let sys = AiFeature::Diagram.system_prompt();
        assert!(
            sys.contains("mermaid"),
            "diagram prompt must still mention mermaid"
        );
        assert!(
            !sys.contains("코드펜스로 감싸"),
            "diagram prompt must not instruct wrapping output in a code fence: {}",
            sys
        );
        assert!(
            sys.contains("펜스") && sys.contains("없이"),
            "diagram prompt must explicitly forbid code fences (no-fence instruction): {}",
            sys
        );
    }

    // --- SPEC-AI-004: Diagram 양성 예시(D-C) ---

    #[test]
    fn diagram_prompt_has_positive_output_example() {
        // D-C: 양성 예시("mermaid 키워드로 시작·백틱 미포함") — 기존 :410-426 부정 지시와 무충돌.
        let sys = AiFeature::Diagram.system_prompt();
        assert!(sys.contains("키워드로 시작") && sys.contains("백틱"));
        assert!(!sys.contains("코드펜스로 감싸"));
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

    // --- SPEC-AI-004: 인라인 문맥 가드(D-A) ---

    #[test]
    fn inline_prompt_injects_context_guard_when_context_present() {
        // D-A: 문맥 구획이 있으면 user-prompt 선두에 "참고용·[대상]만 변환" 취지 가드가 있어야 한다.
        let prompt = build_inline_prompt(&AiFeature::Polish, "대상문장", "앞문맥", "뒤문맥");
        assert!(prompt.user_prompt.contains("참고용"));
        assert!(prompt.user_prompt.contains("[대상]"));
        // 가드가 [대상] 섹션보다 먼저 나와야 한다(선두 삽입, REQ-AI4-001/002).
        let guard_idx = prompt.user_prompt.find("참고용").unwrap();
        let target_idx = prompt.user_prompt.find("[대상]").unwrap();
        assert!(guard_idx < target_idx);
    }

    #[test]
    fn inline_prompt_omits_guard_without_context() {
        // REQ-AI4-003/012: 문맥 0개면 가드 미삽입 + 기존 조립 결과와 바이트 동일.
        let prompt = build_inline_prompt(&AiFeature::Polish, "대상", "", "");
        assert!(!prompt.user_prompt.contains("참고용"));
        assert_eq!(prompt.user_prompt, "[대상]\n대상");
    }

    #[test]
    fn custom_preset_inline_prompt_has_context_guard() {
        // D-A는 Custom도 일괄 보호해야 한다(per-preset 분산 금지, REQ-AI4-002).
        let prompt = build_inline_prompt(
            &AiFeature::Custom("영어로 번역".to_string()),
            "대상문장",
            "앞문맥",
            "",
        );
        assert!(prompt.user_prompt.contains("참고용"));
    }

    #[test]
    fn all_presets_inline_prompt_guard_with_context_isolated() {
        // 프리셋 6종(5종 + Custom) 루프 단언 — 단일 조립 지점(build_inline_prompt) 일괄 보호.
        for feature in [
            AiFeature::Polish,
            AiFeature::Outline,
            AiFeature::Table,
            AiFeature::Diagram,
            AiFeature::Shorten,
            AiFeature::Custom("지시".to_string()),
        ] {
            let prompt = build_inline_prompt(&feature, "대상", "앞", "");
            assert!(
                prompt.user_prompt.contains("참고용"),
                "feature {:?} missing inline context guard",
                feature
            );
        }
        // 격리: FillSection/Continue 조립 함수에는 인라인 가드가 새지 않는다.
        let section = build_section_prompt("# 개요", "직전 본문");
        assert!(!section.user_prompt.contains("참고용"));
        let cont = build_continue_prompt("# 개요", "직전 본문", "뒤 문맥");
        assert!(!cont.user_prompt.contains("참고용"));
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

    // --- continue prompt assembly(문서 끝 이어쓰기, REQ-AI-028) ---

    #[test]
    fn continue_prompt_uses_continue_template() {
        let prompt = build_continue_prompt("# 개요\n## 결론", "직전 본문입니다.", "");
        assert!(prompt.system_prompt.contains("이어"));
        assert!(prompt.user_prompt.contains("[문서 개요]"));
        assert!(prompt.user_prompt.contains("[직전 본문]"));
        assert!(prompt.user_prompt.contains("직전 본문입니다."));
    }

    #[test]
    fn continue_prompt_flags_truncated_tail() {
        let long_tail = "긴 본문 ".repeat(1000);
        let prompt = build_continue_prompt("# 개요", &long_tail, "");
        assert!(prompt.truncated);
    }

    #[test]
    fn continue_prompt_omits_empty_tail_section() {
        let prompt = build_continue_prompt("# 개요", "", "");
        assert!(!prompt.user_prompt.contains("[직전 본문]"));
        assert!(prompt.user_prompt.contains("[문서 개요]"));
    }

    // --- 자유 위치 이어쓰기(M2, SPEC-AI-003) — [뒤 문맥] 조립 + truncate_head + 반복/선점 금지 지시 ---

    #[test]
    fn continue_prompt_includes_after_context_section() {
        let prompt = build_continue_prompt("# 개요", "앞 문맥입니다.", "뒤 문맥입니다.");
        assert!(prompt.user_prompt.contains("[뒤 문맥]"));
        assert!(prompt.user_prompt.contains("뒤 문맥입니다."));
    }

    #[test]
    fn continue_prompt_instructs_forbidding_after_context_repetition_when_present() {
        let prompt = build_continue_prompt("# 개요", "앞", "뒤 문맥");
        assert!(prompt.system_prompt.contains("뒤 문맥"));
        assert!(prompt.system_prompt.contains("금지"));
        assert!(prompt.system_prompt.contains("끊긴 문장"));
    }

    #[test]
    fn continue_prompt_omits_after_instruction_when_after_empty() {
        // D6 개정(SPEC-AI-004): 구 단언 `!contains("금지")`는 지시문 어휘 선택("금지" vs "말라")에
        // 결합돼 있어, 향후 base 문구 변경 시 오탐 위험이 있었다(실제 최종 문구는 "말라"체라 구 단언도
        // 통과함 — 파손 회피가 아니라 견고화 목적). 단언을 테스트 의도인 "빈 after 시 뒤 문맥 조건부
        // 지시 부재"에 직접 특정한다(뒤 문맥 지시는 has_after=true 전용).
        let prompt = build_continue_prompt("# 개요", "앞", "");
        assert_eq!(prompt.system_prompt, AiFeature::Continue.system_prompt());
        assert!(!prompt.system_prompt.contains("뒤 문맥"));
    }

    // --- SPEC-AI-004: Continue base 재조준(D-B 재복창 금지) + 분량 상한(D-D) ---

    #[test]
    fn continue_prompt_forbids_restating_existing_text() {
        // D-B: 커서 앞 직전 본문 꼬리의 재출력을 금지하는 지시가 base에 있어야 한다.
        let sys = AiFeature::Continue.system_prompt();
        assert!(
            sys.contains("다시 출력") || sys.contains("직전 본문을"),
            "continue base must forbid restating the existing tail text: {}",
            sys
        );
    }

    #[test]
    fn continue_prompt_bounds_generation_volume() {
        // D-D: 온건형 분량·형식 상한 — "문단" 단위 상한 + 새 형식 임의 도입 금지.
        let sys = AiFeature::Continue.system_prompt();
        assert!(sys.contains("문단"), "continue base must bound paragraph volume: {}", sys);
        assert!(
            sys.contains("임의로"),
            "continue base must forbid introducing new format arbitrarily: {}",
            sys
        );
    }

    #[test]
    fn fill_section_prompt_has_no_continue_only_guards() {
        // 격리: 이어쓰기 전용 재복창 금지·분량 상한 지시가 FillSection으로 새면 안 된다.
        let sys = AiFeature::FillSection.system_prompt();
        assert!(!sys.contains("다시 출력"));
        assert!(!sys.contains("문단"));
        assert!(!sys.contains("임의로"));
    }

    #[test]
    fn continue_prompt_head_truncation_uses_dedicated_cap_and_flags_truncated() {
        let long_after = "긴 뒤 문맥 ".repeat(1000);
        let prompt = build_continue_prompt("# 개요", "", &long_after);
        assert!(prompt.truncated);
        assert!(prompt.user_prompt.contains("[뒤 문맥]"));
    }

    #[test]
    fn continue_prompt_backward_compat_when_after_empty_matches_legacy_shape() {
        // AC-AI3-007: contextAfter 없음 → [뒤 문맥] 섹션 없이 기존 문서 끝 프롬프트와 동일 모양.
        let prompt = build_continue_prompt("# 개요", "직전 본문", "");
        assert!(!prompt.user_prompt.contains("[뒤 문맥]"));
        assert_eq!(prompt.system_prompt, AiFeature::Continue.system_prompt());
    }
}
