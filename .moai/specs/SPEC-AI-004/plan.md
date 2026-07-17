---
id: SPEC-AI-004
version: "0.1.0"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 17
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | jw | 최초 plan 작성 — 프롬프트 핫픽스 4종(D-A~D-D). research.md 회귀면 표 기반 태스크 분해(T1~T4), 결정 로그 D1~D6, D6 개정 열거, 리스크 분석, MX 태그 계획. TDD RED-first. |

## Overview

SPEC-AI-003 완료 후 실 CLI 시뮬레이션에서 확정된 프롬프트 품질 결함 4종을 지시문 수정으로 핫픽스한다. 신규성은 없다 — 전부 기존 프롬프트 문자열(prompt.rs)과 정규식 1개(ai-suggestion-card.ts) 수정이며, 인프라·IPC·수명주기는 무변경이다.

- 개발 방법론: **TDD** (RED-GREEN-REFACTOR, 브라운필드 Pre-RED — 기존 프롬프트/정규식/테스트 선독)
- 신규 런타임 의존성: **없음**. 모델 변경 없음(`haiku`)
- 베이스: main post-#16(731f05f)
- 게이트 기준선: vitest 936 / cargo 227 / tsc 클린 / clippy 클린. `npm run lint`는 게이트 아님(eslint config 부재)

## Decision Log (본 SPEC에서 확정)

| ID | 질문 | 결정 | 근거 |
|----|------|------|------|
| **D1** | 베이스 분기 | **PR #16 머지 후 main(731f05f)에서 분기** — 완료 | 최신 이어쓰기·인라인 인프라 위에서 프롬프트만 손댐. |
| **D2** | 성공 기준 | **치명(D-A/D-B) 3회 재실행 0회 재현(결정론), 품질(D-C/D-D) 3회 중 ≤1회 허용(확률)** | haiku 지시 순응도 한계 실증(강화 프롬프트로도 s02/s10/s11 재현). D-A/D-B는 확정 시 문서 파손·중복이라 무관용, D-C는 자동 재요청·스트립이 흡수·D-D는 `[지우기]` 가능이라 확률 허용. |
| **D3** | D-C 해법 | **병행 — 프롬프트 양성 예시 1줄 + `stripMermaidFence` 정규식 일반화(펜스만, 리라이팅 금지)** | 프롬프트 단독은 D-C에서 이미 1회 실패한 확률적 접근. 정규식 일반화는 무태그/타 태그 펜스에 대한 결정적 보험. 본문 리라이팅은 무손상 원칙상 절대 금지 — 마커만 제거. |
| **D4** | D-A 주입 위치 | **`build_inline_prompt` user-prompt 선두, 문맥 구획 ≥1일 때만** | per-preset은 Custom 미보호, COMMON_INSTRUCTION은 FillSection/Continue 오염. 단일 조립 지점이 프리셋 5종 + Custom 일괄 보호. 문맥 0개면 미삽입 → 기존 출력 바이트 동일. |
| **D5** | D-B/D-D 위치·강도 | **Continue base 시스템 프롬프트(prompt.rs:101-103) 한 곳** — D-B "직전 본문 재출력 금지·끊긴 지점 다음부터", D-D 온건형 "한두 문단 이내 + 새 형식 임의 도입 금지"(절대 금지형 기각) | base 수정이라 doc-end·자유 위치 양쪽 자동 적용(경로 간 동일성). REQ-AI3-010 "빈 after 시 [뒤 문맥] 섹션·지시 생략" 계약과 양립 — base는 항상 상속되고 조건부 뒤 문맥 블록만 생략되므로. 절대 금지형은 코드 인접 산문의 정당한 이어쓰기를 차단하는 과잉 제약. |
| **D6** | 기존 테스트 개정 정책 | **지시 의도가 변경된 테스트에 한해 개정 허용, 아래 열거 + REQ 대응 명시. 열거 밖 개정은 회귀** | 지시문 자체가 수정 대상이라 SPEC-AI-003의 "무개정" 규칙은 부적용. 프롬프트 전문 byte-pin 금지, `contains()` 키워드 단언 관례 유지. |

## D6 개정 열거 (유일 허용 개정)

| 테스트(prompt.rs) | 현행 단언 | 개정 | REQ 대응 |
|---|---|---|---|
| `continue_prompt_omits_after_instruction_when_after_empty`(:570-575) | `assert_eq!(system_prompt, Continue.system_prompt())` + `!contains("금지")` | `assert_eq!`는 유지(양변 동시 변경). `!contains("금지")`는 D-D 분량 지시가 base에 "금지" 어휘를 넣으면 파손 → **뒤 문맥 관련 금지 부재**로 특정: `!contains("뒤 문맥")` (또는 `!contains("반복하거나 선점")`). 의도(빈 after 시 뒤 문맥 조건부 지시 부재)는 보존. | REQ-AI4-005, 006 |

열거 밖 테스트는 무개정 통과가 계약이다. 특히:
- `diagram_prompt_forbids_markdown_fence_output`(:410-426) — D-C 양성 예시가 `!contains("코드펜스로 감싸")`를 깨지 않도록 "백틱"·"키워드로 시작" 어휘 사용.
- `continue_system_prompt_instructs_style_inheritance`(:351-356) — D-B/D-D 추가 후에도 `contains("이어")`/`contains("어조와 종결어미")`/`contains("결과 텍스트만 출력")` 성립 유지.
- `inline_prompt_omits_empty_context`(:496-501), `inline_prompt_includes_context_sections`(:484-493) — D-A 가드는 문맥 ≥1일 때만이라 무영향.

## Task Decomposition

각 유닛은 "테스트 먼저(RED) → 최소 구현(GREEN) → 정리(REFACTOR)". T1~T3는 자동 게이트, T4는 수동 재검증(SPEC 완료 시 1회). 순서는 회귀 위험 순(base 지시 → 인라인 가드 → 다이어그램).

### T1. [MODIFY] Continue base 재조준 + 분량 지시 (D-B/D-D)

- `AiFeature::Continue.system_prompt()`(prompt.rs:101-103) base 문자열 수정 — 재복창 금지(D-B) + 온건 분량·형식 상한(D-D). D-B와 D-D는 같은 base 문자열 한 곳에 함께 들어가므로 한 유닛으로 처리.
- 어휘 제약: `continue_system_prompt_instructs_style_inheritance`(:351-356) 키워드("이어"·"어조와 종결어미"·"결과 텍스트만 출력") 보존. `diagram_prompt_forbids_markdown_fence_output`와는 무관(다른 프리셋).
- D6 개정: `continue_prompt_omits_after_instruction_when_after_empty`(:570-575) `!contains("금지")` → `!contains("뒤 문맥")`.
- **RED first**: prompt.rs `#[cfg(test)]` 신규 —
  - `continue_prompt_forbids_restating_existing_text`: base(또는 조립 프롬프트)에 재복창 금지 취지 키워드(예: "다시 출력"·"직전 본문" 결박) 포함 단언.
  - `continue_prompt_bounds_generation_volume`: base에 분량·형식 상한 키워드(예: "문단"·"임의로 도입") 포함 단언.
  - `fill_section_prompt_has_no_continue_only_guards`(격리): `AiFeature::FillSection.system_prompt()`에 이어쓰기 전용 재복창/분량 지시가 새지 않음 단언.
- Reference: prompt.rs:101-103(Continue base), :234-243(조건부 뒤 문맥 지시), :351-356/:562-575(기존 continue 테스트).
- 매핑: REQ-AI4-004, 005, 006, 007.

### T2. [MODIFY] 인라인 문맥 가드 (D-A)

- `build_inline_prompt`(prompt.rs:151-178) user-prompt 선두에 가드 지시 삽입 — `before_ctx`/`after_ctx` 중 하나라도 비어있지 않을 때만(문맥 구획 존재 조건). 어휘는 기존 단언 키워드("펜스"·"결과 텍스트만"·"코드펜스로 감싸") 회피.
- 문맥 0개면 미삽입 → 기존 출력과 바이트 동일(REQ-AI4-003/012).
- **RED first**: prompt.rs `#[cfg(test)]` 신규 —
  - `inline_prompt_injects_context_guard_when_context_present`: before/after 있는 프롬프트에 가드 키워드(예: "참고용"·"대상") 포함 단언.
  - `inline_prompt_omits_guard_without_context`: 문맥 0개 프롬프트에 가드 미포함 + **바이트 동일 스냅샷**(기존 조립 결과 문자열과 `assert_eq!`).
  - `custom_preset_inline_prompt_has_context_guard`: `AiFeature::Custom` + 문맥 있는 프롬프트에도 가드 적용 단언.
  - (선택) 프리셋 루프: polish/outline/table/diagram/shorten/custom 각각 문맥 있는 프롬프트에 가드 포함.
- Reference: prompt.rs:151-178(build_inline_prompt), :484-508(기존 inline 테스트).
- 매핑: REQ-AI4-001, 002, 003, 012.

### T3. [MODIFY] Diagram 양성 예시 + stripMermaidFence 정규식 (D-C)

- Rust: `AiFeature::Diagram.system_prompt()`(prompt.rs:86-91)에 양성 예시 1줄 추가("출력은 mermaid 키워드로 시작, 백틱 문자 미포함" 취지). `diagram_prompt_forbids_markdown_fence_output`(:410-426) 무충돌 어휘.
- TS: `stripMermaidFence`(ai-suggestion-card.ts:870-874) 정규식 `/```mermaid\s*\n([\s\S]*?)```/` → `/```[a-z]*\s*\n([\s\S]*?)```/i` 수준으로 일반화. 펜스 마커만 제거, 내부 코드 리라이팅 금지. `@MX:NOTE`로 호출 스코프(presetKind==='diagram' 전용) 명시.
- **RED first**:
  - Rust: `diagram_prompt_has_positive_output_example` — Diagram 프롬프트에 양성 예시 키워드("키워드로 시작" 또는 "백틱") 포함 단언. 기존 :410-426 무충돌 확인.
  - vitest(src/test/aiSuggestionCard.test.ts:397 describe 블록에 추가): 무태그 `` ```\nflowchart LR\n A-->B\n``` `` → 본문만; `` ```mmd\n... `` → 본문만; 태그 뒤 공백/개행 변형 → 본문만. 기존 3케이스(:398-411, `` ```mermaid `` 태그·펜스 없음·사족 동봉) 무개정 통과.
- Reference: prompt.rs:86-91(Diagram), :410-426(펜스 금지 테스트), ai-suggestion-card.ts:800-816(handleDiagramComplete), :870-874(stripMermaidFence), src/test/aiSuggestionCard.test.ts:397-411.
- 매핑: REQ-AI4-008, 009, 010, 012.

### T4. 수동 실 CLI 재검증 (자동 게이트와 분리, SPEC 완료 시 1회)

- 결함 5종(s07 짧게 줄이기·s09 개요·s10 다이어그램·s11 리스트 이어쓰기·s02 자유 위치 이어쓰기) × 3회 재실행 — D2 기준(치명 D-A/D-B 0/3, 품질 D-C/D-D ≤1/3).
- 교차 오염 회귀: 통과 5종(s01 에세이 이어쓰기·s03 회의록·s04 문서 끝·s06 인라인 다듬기·s08 표) × 1회 재실행 — 점수 퇴행 없음(특히 s06 무과교정·s04 하위호환·s08 문맥 미흡수).
- SPEC-AI-003 검증 방식 재현: `prompt.rs` 조립 로직 복제 → `claude_cli.rs::build_claude_args` 동일 인자 실 CLI 실행 → `type:"result"` 최종 출력 채택.
- 결과는 `.moai/specs/SPEC-AI-004/manual-verification.md`로 기록. 시나리오 입력 원문·조립 프롬프트·raw 출력은 세션 스크래치에 보존하되, 소실 대비 판정 기준을 acceptance.md 표에 고정.
- 매핑: AC-AI4-009, 010.

## 회귀 표면 명시 (research.md §4.1)

prompt.rs 기존 테스트는 대부분 `contains` 단언이라 무영향 예상. 주의 3곳:
- `diagram_prompt_forbids_markdown_fence_output`(:410-426) — D-C 양성 예시 어휘 충돌 주의(`!contains("코드펜스로 감싸")`).
- `continue_system_prompt_instructs_style_inheritance`(:351-356) — D-B/D-D 추가 후 키워드 보존.
- SPEC-AI-003 신규 continue 테스트(:553-591, "끊긴 문장" 단언 포함) — D6 정책상 `:570-575`만 개정, 나머지 무개정.
- D-A 가드 문구에 기존 단언 키워드("펜스"·"결과 텍스트만"·"코드펜스로 감싸") 사용 금지.

## Risk Analysis

| 리스크 | 완화 |
|--------|------|
| haiku 확률성(프롬프트 지시만으론 결정론 불가) | D2 이원 기준 + D-C 결정적 스트립 병행 |
| `stripMermaidFence` 과일반화로 일반 코드블록 오벗김 | 호출이 `handleDiagramComplete`(presetKind==='diagram') 전용이라 대상이 다이어그램 응답뿐 — 오작동 표면 없음. @MX:NOTE로 스코프 명시 |
| D-D "금지" 어휘가 `:570-575` 테스트 파손 | D6 개정 열거 — `!contains("뒤 문맥")`으로 특정 |
| D-C 양성 예시가 `:410-426` 펜스 금지 단언과 충돌 | "백틱"·"키워드로 시작" 어휘로 `코드펜스로 감싸` 문자열 미도입 |
| D-A 가드가 FillSection/Continue 오염 | `build_inline_prompt` 단일 지점 주입 — Continue/FillSection은 별도 함수라 무영향 |
| 본문 리라이팅 유입(무손상 위반) | 스트립은 펜스 마커만, 내부 코드 무변경 — 기존 계약 유지 명시 |
| 프론트 출력 절단 유혹(D-D) | REQ-AI4-007 명시 — 분량은 프롬프트로만, 후처리 선례 없음 |

## MX Tag Plan

`@MX:SPEC: SPEC-AI-004` 공통 부착, code_comments = ko. 신규 계약 함수 없음 → 신규 `@MX:ANCHOR` 불요.

| 위치 | 태그 | 사유 |
|------|------|------|
| `stripMermaidFence` 정규식 일반화(ai-suggestion-card.ts:870-874) | `@MX:NOTE` | 무태그·타 태그 펜스 회피 근거 + presetKind==='diagram' 전용 호출 스코프(일반 코드블록 오작동 없음) |
| Continue base 지시 재조준(prompt.rs:101-103) | `@MX:NOTE` | D-B 조준 변경(뒤 문맥 → 직전 본문) 근거 + SPEC-AI-003 조건부 뒤 문맥 지시(:234-243)와의 관계 |

## Quality Gates

- `tsc --noEmit` 클린 / `vitest run` ≥936 통과(신규 포함) / `cargo test` ≥227 통과 / `cargo clippy` 클린.
- `npm run lint`는 게이트 아님(eslint config 부재 — main 포함 상시 실패, 회귀 오판 금지).
- SPEC frontmatter 커밋 시 포맷터 손상 주의: 한 Bash 호출 내 checkout→edit→add(프로젝트 알려진 제약).
- 실 CLI 재검증(T4)은 자동 게이트와 분리, SPEC 완료 시 1회 수행 후 manual-verification.md 기록.
