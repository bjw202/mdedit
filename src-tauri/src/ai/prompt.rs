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

// @MX:NOTE: [AUTO] SPEC-AI-004 D-A(문맥 흡수)는 SPEC-AI-006 의 INLINE_SCOPE 가 대체했다. D-A 가
// 쓰던 INLINE_CONTEXT_GUARD(문맥이 있을 때만 user_prompt 에 조건부 삽입)는 이 상수의 부분집합이며,
// INLINE_SCOPE 는 6기능에 상시 부착되고 입력 언어 유지까지 담당한다. 가드를 되살리지 말 것 —
// 같은 지시가 두 번 실리면 프롬프트만 길어진다.
// @MX:NOTE: [AUTO] INLINE_SCOPE - 인라인 6기능(polish/outline/table/diagram/shorten/custom) 균일
// 대상-스코핑 + 입력-언어-유지 계약(SPEC-AI-006 REQ-AI6-001/002). build_inline_prompt 조립
// 지점에서만 부착되며 COMMON_INSTRUCTION/AiFeature::Continue base 에는 절대 섞이지 않는다 —
// 섞이면 이어쓰기 바이트 하위호환 테스트(prompt.rs 하단 continue_prompt_backward_compat_*)가
// 깨진다(REQ-AI6-003).
// @MX:SPEC: SPEC-AI-006
/// 인라인 편집 대상 스코핑(흡수 방지) + 입력 언어 유지 절. `build_inline_prompt`가 유일 부착 지점.
const INLINE_SCOPE: &str = "오직 [대상] 텍스트만 변환·정리하라. [앞 문맥]과 [뒤 문맥]은 이해를 돕는 읽기 전용 참고 자료일 뿐이니 결과에 포함하거나 이어 쓰지 말라. 결과는 입력 텍스트의 언어를 그대로 유지하라.";

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
                // SPEC-AI-006 REQ-AI6-002: "한국어 문장 교정기" 하드코딩을 제거하고 언어 중립화
                // 했다 — 언어 유지 지시 자체는 INLINE_SCOPE(build_inline_prompt 조립 지점)가 담당한다.
                "주어진 텍스트의 맞춤법과 문장을 자연스럽게 다듬되 의미와 정보는 그대로 유지하라."
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

// @MX:NOTE: [AUTO] SPEC-AI-008: 다이어그램 종류(diagramType) → mermaid 종류 강제 조각.
// feature 가 Diagram 이고 종류가 실렸을 때만 build_inline_prompt_with_diagram_type 가 부착한다.
// 미지의 종류는 None(자동)으로 관대 처리한다. 첫 줄 키워드는 spec.md "Diagram Type Prompt
// Fragments" 표의 값이다(stateDiagram → `stateDiagram-v2`).
// @MX:SPEC: SPEC-AI-008
fn diagram_type_fragment(diagram_type: &str) -> Option<&'static str> {
    match diagram_type {
        "flowchart" => Some(
            "반드시 mermaid 순서도만 생성하라. 출력 첫 줄은 `flowchart` 키워드로 시작해야 한다.",
        ),
        "sequenceDiagram" => Some(
            "반드시 mermaid 시퀀스 다이어그램만 생성하라. 출력 첫 줄은 `sequenceDiagram` 키워드로 시작해야 한다.",
        ),
        "gantt" => Some(
            "반드시 mermaid 간트 차트만 생성하라. 출력 첫 줄은 `gantt` 키워드로 시작해야 한다.",
        ),
        "classDiagram" => Some(
            "반드시 mermaid 클래스 다이어그램만 생성하라. 출력 첫 줄은 `classDiagram` 키워드로 시작해야 한다.",
        ),
        "stateDiagram" => Some(
            "반드시 mermaid 상태 다이어그램만 생성하라. 출력 첫 줄은 `stateDiagram-v2` 키워드로 시작해야 한다.",
        ),
        "pie" => Some(
            "반드시 mermaid 파이 차트만 생성하라. 출력 첫 줄은 `pie` 키워드로 시작해야 한다.",
        ),
        "mindmap" => Some(
            "반드시 mermaid 마인드맵만 생성하라. 출력 첫 줄은 `mindmap` 키워드로 시작해야 한다.",
        ),
        _ => None,
    }
}

/// 인라인 편집(축 1) 프롬프트를 조립한다. 선택 텍스트는 절단하지 않는다(REQ-AI-027).
/// 기존 4인자 시그니처는 종류 없음(None)으로 위임한다 — 바이트 동일 하위호환.
pub fn build_inline_prompt(
    feature: &AiFeature,
    selection: &str,
    before: &str,
    after: &str,
) -> AssembledPrompt {
    build_inline_prompt_with_diagram_type(feature, selection, before, after, None)
}

// @MX:NOTE: [AUTO] SPEC-AI-008 REQ-010/025: 공유 인라인 조립 경로 내 diagram 전용 종류 게이팅.
// `matches!(feature, AiFeature::Diagram)` 이고 diagram_type 이 있을 때만 종류 조각을 조립
// system_prompt 뒤에 덧붙인다. None 또는 비-diagram 이면 현행 조립 결과와 바이트 동일 —
// 비-diagram 5기능 hot path 는 침범하지 않는다(build_continue_prompt_with_length 위임 선례와 동형).
// @MX:SPEC: SPEC-AI-008
/// 인라인 편집 프롬프트를 조립하되, feature 가 Diagram 이고 `diagram_type` 이 있으면 그 mermaid
/// 종류를 강제하는 제약 조각을 조립 시스템 프롬프트에 덧붙인다. `diagram_type=None`(자동) 또는
/// 비-diagram feature 이면 조각을 부착하지 않아 `build_inline_prompt`(4인자)와 바이트 동일하다.
pub fn build_inline_prompt_with_diagram_type(
    feature: &AiFeature,
    selection: &str,
    before: &str,
    after: &str,
    diagram_type: Option<&str>,
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

    // SPEC-AI-006 D1: INLINE_SCOPE 는 이 조립 지점에서만 부착된다(6기능 균일 커버, Custom
    // 포함 — Custom::system_prompt() 는 조기 return 하지만 여기서 뒤에 이어붙이므로 영향받는다).
    let mut system_prompt = format!("{}\n\n{}", feature.system_prompt(), INLINE_SCOPE);
    // SPEC-AI-008: diagram 전용 종류 게이팅 — 종류가 있고 유효할 때만 조각을 덧붙인다.
    if matches!(feature, AiFeature::Diagram) {
        if let Some(fragment) = diagram_type.and_then(diagram_type_fragment) {
            system_prompt = format!("{}\n\n{}", system_prompt, fragment);
        }
    }

    AssembledPrompt {
        system_prompt,
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
    // SPEC-AI-006 D3: 기존 3인자 시그니처는 Normal 로 위임한다 — 바이트 동일(하위호환, REQ-AI6-015).
    build_continue_prompt_with_length(outline, before, after, ContinueLength::Normal)
}

// @MX:SPEC: SPEC-AI-006
/// 이어쓰기 길이 지시(항목 4, D3). `Normal` 은 추가 지시 없음(기존 바이트 유지),
/// `Short` 는 "짧게, 한두 문장만" 지시를 덧붙인다. 이어쓰기(continue)에만 적용되며
/// 인라인 변환·섹션 채우기 프롬프트에는 영향을 주지 않는다(REQ-AI6-014).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContinueLength {
    /// 짧게 — "한두 문장만" 분량 지시를 추가한다.
    Short,
    /// 보통(기본값) — 추가 분량 지시 없음, 기존 동작과 바이트 동일.
    Normal,
}

/// 이어쓰기(REQ-AI-028 문서 끝 분기 + SPEC-AI-003 자유 위치 M2 + SPEC-AI-006 길이 옵션)
/// 프롬프트를 조립한다. 기존 `build_continue_prompt`(3인자)는 이 함수를 `Normal`로 위임한다
/// (바이트 동일 하위호환, REQ-AI6-015). `after` 가 비어 있고 `length` 가 `Normal`이면 시스템
/// 프롬프트는 `AiFeature::Continue.system_prompt()`와 완전히 동일하다(기존 계약 보존).
pub fn build_continue_prompt_with_length(
    outline: &str,
    before: &str,
    after: &str,
    length: ContinueLength,
) -> AssembledPrompt {
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
        system_prompt: continue_system_prompt(has_after, length),
        user_prompt,
        truncated: tail_cut || head_cut,
    }
}

/// 이어쓰기 시스템 프롬프트 — 뒤 문맥이 있을 때만 "끊긴 문장 완성·뒤 문맥 연결·반복/선점 금지"
/// 지시를 조건부로 덧붙이고(REQ-AI3-009), 길이가 `Short`일 때만 "짧게, 한두 문장만" 지시를
/// 덧붙인다(REQ-AI6-013). `has_after=false` + `Normal`이면 `AiFeature::Continue.system_prompt()`
/// 자체와 바이트 동일하다(기존 테스트 무개정).
fn continue_system_prompt(has_after: bool, length: ContinueLength) -> String {
    let base = AiFeature::Continue.system_prompt();
    let mut sys = base;
    if has_after {
        sys = format!(
            "{}\n\n끊긴 문장부터 이어서 완성하고, 뒤 문맥으로 자연스럽게 연결하라. 뒤 문맥의 내용을 반복하거나 선점하는 것은 금지한다.",
            sys
        );
    }
    if matches!(length, ContinueLength::Short) {
        sys = format!("{}\n\n짧게, 한두 문장만 작성하라.", sys);
    }
    sys
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

    // --- SPEC-AI-004 D-A 는 SPEC-AI-006 INLINE_SCOPE 로 대체됨 ---
    // 가드 존재를 단언하던 두 테스트(문맥 있을 때 삽입 / Custom 커버)는 제거했다. 대상 스코핑은
    // 이제 system_prompt 의 INLINE_SCOPE 가 담당하며, 6기능 커버는
    // inline_scope_clause_present_for_all_six_inline_features 가 검증한다.

    #[test]
    fn inline_prompt_without_context_is_target_only() {
        // 문맥 0개면 user_prompt 는 [대상] 구획뿐 — 조립 결과 바이트 동일 회귀 방어.
        let prompt = build_inline_prompt(&AiFeature::Polish, "대상", "", "");
        assert_eq!(prompt.user_prompt, "[대상]\n대상");
    }

    // 프리셋 6종 커버리지와 이어쓰기·섹션 채우기 격리는 SPEC-AI-006 의
    // inline_scope_clause_present_for_all_six_inline_features 가 동일하게 검증하므로,
    // D-A 가드용 중복 루프 테스트는 제거했다.

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

    // --- SPEC-AI-006 항목 1: 인라인 대상 스코핑 + Polish 언어 중립 (REQ-AI6-001/002/003) ---

    #[test]
    fn inline_scope_clause_present_for_all_six_inline_features() {
        let selection = "대상 문장";
        for feature in [
            AiFeature::Polish,
            AiFeature::Outline,
            AiFeature::Table,
            AiFeature::Diagram,
            AiFeature::Shorten,
            AiFeature::Custom("영어로 번역".to_string()),
        ] {
            let prompt = build_inline_prompt(&feature, selection, "", "");
            assert!(
                prompt.system_prompt.contains("[대상]"),
                "{:?} missing scoping clause: {}",
                feature,
                prompt.system_prompt
            );
            assert!(prompt.system_prompt.contains("읽기 전용"));
            assert!(prompt.system_prompt.contains("참고"));
            assert!(prompt.system_prompt.contains("언어"));
        }
    }

    #[test]
    fn polish_prompt_no_longer_hardcodes_korean_corrector_and_keeps_input_language() {
        let prompt = build_inline_prompt(&AiFeature::Polish, "hello world", "", "");
        assert!(!prompt.system_prompt.contains("한국어 문장 교정기"));
        assert!(prompt.system_prompt.contains("언어"));
    }

    #[test]
    fn scoping_clause_does_not_leak_into_section_or_continue_prompts() {
        // REQ-AI6-003: 스코핑·언어절은 인라인 조립 지점 한정 — 이어쓰기/섹션 채우기엔 파급 금지.
        let section = build_section_prompt("# 개요", "직전 본문");
        assert!(!section.system_prompt.contains("읽기 전용"));
        assert!(!section.system_prompt.contains("[대상]"));

        let cont = build_continue_prompt("# 개요", "직전 본문", "");
        assert!(!cont.system_prompt.contains("읽기 전용"));
        assert!(!cont.system_prompt.contains("[대상]"));
    }

    // --- SPEC-AI-006 항목 4: 이어쓰기 길이 옵션 (REQ-AI6-012/013/014/015) ---

    #[test]
    fn build_continue_prompt_with_length_short_appends_brief_instruction() {
        let prompt =
            build_continue_prompt_with_length("# 개요", "직전 본문", "", ContinueLength::Short);
        assert!(prompt.system_prompt.contains("짧게"));
        assert!(prompt.system_prompt.contains("한두 문장"));
    }

    #[test]
    fn build_continue_prompt_with_length_normal_matches_legacy_build_continue_prompt_byte_for_byte() {
        let legacy = build_continue_prompt("# 개요", "직전 본문", "뒤 문맥");
        let via_length =
            build_continue_prompt_with_length("# 개요", "직전 본문", "뒤 문맥", ContinueLength::Normal);
        assert_eq!(legacy, via_length);
    }

    #[test]
    fn build_continue_prompt_with_length_normal_empty_after_matches_bare_continue_system_prompt() {
        let prompt =
            build_continue_prompt_with_length("# 개요", "직전 본문", "", ContinueLength::Normal);
        assert_eq!(prompt.system_prompt, AiFeature::Continue.system_prompt());
    }

    #[test]
    fn build_continue_prompt_with_length_short_still_forbids_after_context_repetition_when_present() {
        // 길이 '짧게' + 뒤 문맥 있음(자유 위치) — 두 지시가 공존해야 한다(엣지케이스).
        let prompt =
            build_continue_prompt_with_length("# 개요", "앞", "뒤 문맥", ContinueLength::Short);
        assert!(prompt.system_prompt.contains("금지"));
        assert!(prompt.system_prompt.contains("짧게"));
    }

    // --- SPEC-AI-008 T-001: Pre-RED 특성화 스냅샷 (diagram 종류 게이팅 회귀 기준선) ---

    /// 변경 전 diagram(자동/None) 조립 시스템 프롬프트의 바이트 동일 기준선(AC-AI-008-004).
    /// diagram_type 게이팅 배선 후에도 `diagram_type=None`이면 이 문자열과 바이트 동일해야 한다.
    const DIAGRAM_NONE_SYSTEM_PROMPT_SNAPSHOT: &str = "주어진 절차·관계 설명을 mermaid 다이어그램으로 변환하라. 순수 mermaid 문법 코드만 출력하고, ```mermaid 코드펜스나 다른 설명 문구 없이 다이어그램 코드만 그대로 출력하라. 출력은 graph·flowchart·sequenceDiagram 등 mermaid 키워드로 시작해야 하며, 백틱 문자는 한 글자도 포함하지 말라.\n\n결과 텍스트만 출력하라. 설명·인사·사족을 붙이지 말라. 마크다운 코드펜스는 요청받은 경우에만 사용하라.\n\n오직 [대상] 텍스트만 변환·정리하라. [앞 문맥]과 [뒤 문맥]은 이해를 돕는 읽기 전용 참고 자료일 뿐이니 결과에 포함하거나 이어 쓰지 말라. 결과는 입력 텍스트의 언어를 그대로 유지하라.";

    #[test]
    fn diagram_none_assembled_prompt_matches_prechange_snapshot() {
        // AC-AI-008-004: 자동(종류 없음) 경로는 게이팅 배선 전후 바이트 동일.
        let p = build_inline_prompt(&AiFeature::Diagram, "S", "", "");
        assert_eq!(p.system_prompt, DIAGRAM_NONE_SYSTEM_PROMPT_SNAPSHOT);
    }

    // --- SPEC-AI-008 T-005: diagram 종류 게이팅 + 조각 (REQ-010/018/025, AC-004/006/014) ---

    #[test]
    fn diagram_type_injects_fragment_with_first_line_keyword() {
        // AC-006: 7종 각각 종류 조각 + 첫 줄 키워드(표)가 조립 프롬프트에 포함된다.
        let cases = [
            ("flowchart", "flowchart", "순서도"),
            ("sequenceDiagram", "sequenceDiagram", "시퀀스"),
            ("gantt", "gantt", "간트"),
            ("classDiagram", "classDiagram", "클래스"),
            ("stateDiagram", "stateDiagram-v2", "상태"),
            ("pie", "pie", "파이"),
            ("mindmap", "mindmap", "마인드맵"),
        ];
        for (dt, keyword, kind_word) in cases {
            let p = build_inline_prompt_with_diagram_type(&AiFeature::Diagram, "S", "", "", Some(dt));
            assert!(
                p.system_prompt.contains(&format!("`{}`", keyword)),
                "{} missing first-line keyword `{}`: {}",
                dt,
                keyword,
                p.system_prompt
            );
            assert!(p.system_prompt.contains(kind_word), "{} missing kind word", dt);
            // 종류 조각은 자동 조립 결과(스냅샷) 뒤에 덧붙는다(기존 지시 보존).
            assert!(p.system_prompt.starts_with(DIAGRAM_NONE_SYSTEM_PROMPT_SNAPSHOT));
        }
    }

    #[test]
    fn seven_diagram_type_fragments_are_distinct() {
        let types = [
            "flowchart",
            "sequenceDiagram",
            "gantt",
            "classDiagram",
            "stateDiagram",
            "pie",
            "mindmap",
        ];
        let mut set = std::collections::HashSet::new();
        for dt in types {
            let p = build_inline_prompt_with_diagram_type(&AiFeature::Diagram, "S", "", "", Some(dt));
            assert!(set.insert(p.system_prompt), "{} fragment not distinct", dt);
        }
    }

    #[test]
    fn diagram_type_none_is_byte_identical_to_legacy_assembly() {
        // AC-004: 자동(None) → 기존 4인자 조립과 바이트 동일 + Pre-RED 스냅샷과 동일.
        let with = build_inline_prompt_with_diagram_type(&AiFeature::Diagram, "S", "b", "a", None);
        let legacy = build_inline_prompt(&AiFeature::Diagram, "S", "b", "a");
        assert_eq!(with, legacy);
        assert_eq!(with.system_prompt, DIAGRAM_NONE_SYSTEM_PROMPT_SNAPSHOT);
    }

    #[test]
    fn diagram_type_ignored_for_non_diagram_features() {
        // REQ-025: 종류가 비-diagram feature 로 새어도 조립 프롬프트는 바이트 동일(엄격 게이팅).
        for feature in [
            AiFeature::Polish,
            AiFeature::Outline,
            AiFeature::Table,
            AiFeature::Shorten,
            AiFeature::Custom("x".to_string()),
        ] {
            let gated = build_inline_prompt_with_diagram_type(&feature, "S", "", "", Some("gantt"));
            let legacy = build_inline_prompt(&feature, "S", "", "");
            assert_eq!(gated, legacy, "{:?} drifted with diagram_type", feature);
        }
    }

    #[test]
    fn unknown_diagram_type_falls_back_to_auto_byte_identical() {
        // 미지의 종류 값 → 조각 미부착 = 자동과 동일(관대 처리, Design Notes).
        let p =
            build_inline_prompt_with_diagram_type(&AiFeature::Diagram, "S", "", "", Some("erDiagram"));
        assert_eq!(p.system_prompt, DIAGRAM_NONE_SYSTEM_PROMPT_SNAPSHOT);
    }

    #[test]
    fn all_five_non_diagram_features_assembled_prompt_snapshot() {
        // AC-AI-008-014/REQ-025: 비-diagram 5기능(polish/outline/table/shorten/custom) 조립
        // 프롬프트를 조립 공식(system_prompt()+"\n\n"+INLINE_SCOPE)으로 고정한다. diagram 종류
        // 게이팅을 공유 경로에 배선한 뒤에도 이 5기능은 바이트 동일해야 한다(공유 hot path 회귀 가드).
        for feature in [
            AiFeature::Polish,
            AiFeature::Outline,
            AiFeature::Table,
            AiFeature::Shorten,
            AiFeature::Custom("영어로 번역".to_string()),
        ] {
            let p = build_inline_prompt(&feature, "S", "", "");
            let expected = format!("{}\n\n{}", feature.system_prompt(), INLINE_SCOPE);
            assert_eq!(p.system_prompt, expected, "{:?} assembled prompt drifted", feature);
        }
    }
}


