---
id: SPEC-AI-004
version: "0.2.0"
status: completed
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 17
dependencies:
  - SPEC-AI-001
  - SPEC-AI-002
  - SPEC-AI-003
tags:
  - ai
  - editor
  - prompt
  - hotfix
  - mermaid
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | jw | 최초 SPEC 작성 — 실 CLI 시뮬레이션(SPEC-AI-003 manual-verification.md)에서 확정된 프롬프트 품질 결함 4종 핫픽스. D-A 인라인 문맥 흡수(build_inline_prompt 가드), D-B 앞 꼬리 재복창(Continue base 재조준), D-C mermaid 펜스 재발(프롬프트 양성 예시 + stripMermaidFence 정규식 일반화), D-D 이어쓰기 과잉 생성(분량·형식 상한). 결정 D1~D6 확정(plan.md Decision Log), REQ-AI4-001~012, AC-AI4-001~010. TDD RED-first. |
| 0.2.0 | 2026-07-17 | jw | 구현 완료 — Implementation Notes 추가, status completed |

## Summary

`mdedit` AI 편집의 **프롬프트 지시문 4개 품질 결함**을 핫픽스한다. 결함은 전부 SPEC-AI-003 완료 후 실 Claude Code CLI(`haiku`, 12개 시나리오) 시뮬레이션에서 확정 재현됐으며(증거: `.moai/specs/SPEC-AI-003/manual-verification.md`, 현재 main), 코드 로직 버그가 아니라 **지시문 커버리지 공백**이다:

- **D-A**: 인라인 요약류 프리셋이 `[앞/뒤 문맥]`을 변환 대상으로 흡수(s07 짧게 줄이기·s09 개요) → `build_inline_prompt` user-prompt에 문맥 참고 가드 1줄 주입.
- **D-B**: 이어쓰기가 커서 앞 텍스트 꼬리를 재출력해 삽입 시 어절 중복(s11 리스트) → Continue base 시스템 프롬프트를 "직전 본문 재출력 금지·끊긴 지점 다음부터"로 재조준.
- **D-C**: 다이어그램이 명시 금지된 코드펜스를 재출력(s10)하고 프론트 `stripMermaidFence`는 태그 펜스만 스트립 → 프롬프트 양성 예시 + 정규식 일반화(무태그/타 태그 펜스 허용) 병행.
- **D-D**: 이어쓰기가 미요청 코드 블록·과잉 분량 생성(s02) → Continue base에 온건형 분량·형식 상한 지시.

스트리밍·고스트·IPC(`feature:'section-fill'`+`presetKind`)·절단·수명주기 인프라는 **전부 재사용·무변경**하며, 델타는 (1) `prompt.rs` 프롬프트 문자열 3종 수정, (2) `ai-suggestion-card.ts` `stripMermaidFence` 정규식 일반화 1함수로 한정된다. 새 기능·모델·의존성 일절 없음.

## Background & Rationale

- SPEC-AI-003 수동 검증(manual-verification.md)이 남긴 "프롬프트 개선 제안(코드 미수정, 기록만)" 4항을 SPEC으로 승격. 당시 조건부 PASS의 근거였던 인접 실패 2종(앞 문맥 재복창·인라인 문맥 흡수) + 부가 발견 2종(다이어그램 펜스 재발·이어쓰기 과잉)을 정식 결함으로 확정.
- haiku 지시 순응도의 확률적 한계가 실증됐다(강화 프롬프트로도 s02/s10/s11 재현). 따라서 프롬프트 단독 방어의 한계를 인정하고, 치명 결함은 결정론적 기준을, 안전망이 흡수하는 품질 결함은 확률적 기준을 적용한다(D2).
- 원인 지시문 원문·시뮬레이션 증거·회귀 표면 표는 research.md 참조.

## 사전 합의 설계 결정 (재검토 금지)

1. **베이스**: PR #16 머지 후 main(731f05f)에서 분기 — 완료(D1).
2. **주입 위치 최소 침습**: D-A는 `build_inline_prompt` 한 곳(프리셋 5종 + Custom 일괄), D-B/D-D는 Continue base 한 곳(doc-end·자유 위치 양쪽 자동). per-preset·COMMON_INSTRUCTION 확산 금지.
3. **D-C 병행 방어**: 프롬프트 양성 예시(확률적) + `stripMermaidFence` 정규식 일반화(결정적 보험). 스트립은 **펜스 마커만** 제거하고 본문 리라이팅은 절대 금지.
4. **무손상·바이트 동일**: 문맥 0개 인라인 출력은 기존과 바이트 동일(가드 미주입). IPC·절단·릴레이·수명주기 계약 무변경.
5. **테스트 개정 정책(D6)**: 지시문 자체가 수정 대상이므로 SPEC-AI-003의 "무개정" 규칙과 달리 "지시 의도가 변경된 테스트에 한해 개정 허용, plan.md에 열거 + REQ 대응 명시". 열거 밖 개정은 회귀로 간주. 프롬프트 전문 byte-pin 금지, `contains()` 키워드 단언 관례 유지.

## Environment & Assumptions

- SPEC-AI-001/002/003 전부 main 머지 완료. 베이스: main(post-#16, 731f05f). 스트리밍 릴레이·고스트·`build_inline_prompt`/`build_continue_prompt`/`stripMermaidFence` 전부 가용.
- 테스트 기준선: vitest 936 / cargo 227(SPEC-AI-003 완료 시점).
- `npm run lint`는 eslint config 부재로 main 포함 상시 실패 — 게이트에서 제외(회귀 오판 금지).
- 신규 런타임 의존성 없음. 모델 변경 없음(`haiku` 유지).
- 개발 방법론: **TDD** (RED-GREEN-REFACTOR, 브라운필드 Pre-RED — 기존 프롬프트/정규식 선독).

## Requirements (EARS)

### 모듈 1 — 인라인 문맥 가드 (D-A)

#### Event-Driven

- **REQ-AI4-001**: **WHEN** `build_inline_prompt`가 `[앞 문맥]` 또는 `[뒤 문맥]` 구획을 1개 이상 포함하는 user-prompt를 조립하면, **the system shall** user-prompt 선두에 "문맥 구획은 참고용이며 `[대상]` 텍스트만 변환해 출력하고 문맥 내용을 결과에 포함하지 말라"는 취지의 가드 지시를 삽입한다. [MODIFY: `build_inline_prompt` prompt.rs:151-178 user-prompt 템플릿]

#### Ubiquitous

- **REQ-AI4-002**: The system **shall** 인라인 문맥 가드를 `build_inline_prompt` 단일 조립 지점에서만 수행하여 프리셋 5종(polish/outline/table/diagram/shorten)과 Custom 직접 입력에 일괄 적용한다(per-preset 분산·COMMON_INSTRUCTION 확산 금지). [MODIFY: `build_inline_prompt` prompt.rs:151-178]

#### Unwanted Behaviour

- **REQ-AI4-003**: **IF** `[앞 문맥]`과 `[뒤 문맥]`이 모두 없으면(문맥 0개), **then the system shall** 가드 지시를 삽입하지 않아 조립 결과가 기존 인라인 프롬프트와 관찰 가능하게(바이트 단위로) 동일하다. [MODIFY: 가드는 문맥 구획 존재 시에만 — `inline_prompt_omits_empty_context` prompt.rs:496-501 계약 보존]

### 모듈 2 — 재복창 금지 (D-B)

#### Ubiquitous

- **REQ-AI4-004**: The system **shall** 이어쓰기 시스템 프롬프트에 "이미 문서에 존재하는 직전 본문 텍스트를 다시 출력하지 말고 그 마지막 지점 바로 뒤에 이어질 새 텍스트만 출력하며, 문장 중간에 끊겼으면 끊긴 지점부터 완성하라"는 취지의 재복창 금지 지시를 포함한다. [MODIFY: Continue base `AiFeature::Continue.system_prompt()` prompt.rs:101-103 — 조준을 뒤 문맥에서 직전 본문으로 확장]

#### Event-Driven

- **REQ-AI4-005**: **WHEN** 문서 끝 이어쓰기(빈 `contextAfter`) 요청과 자유 위치 이어쓰기(비어있지 않은 `contextAfter`) 요청이 각각 발생하면, **the system shall** 재복창 금지 지시를 두 경로 모두에 동일하게 적용한다(Continue base 수정이므로 조건부 뒤 문맥 블록 유무와 무관하게 자동 적용, D5). [MODIFY: `continue_system_prompt` base 경유 prompt.rs:234-243 — 빈 after 경로도 base를 상속]

### 모듈 3 — 과잉 생성 억제 (D-D)

#### Ubiquitous

- **REQ-AI4-006**: The system **shall** 이어쓰기 시스템 프롬프트에 온건형 분량·형식 상한 지시("한두 문단 이내로 작성하고, 직전 본문에 없던 새 형식 — 코드 블록·표·목차 — 을 임의로 도입하지 말라")를 포함한다. 정당한 이어쓰기(코드 인접 산문 등)를 차단하는 절대 금지형은 사용하지 않는다. [MODIFY: Continue base prompt.rs:101-103]

#### Unwanted Behaviour

- **REQ-AI4-007**: **IF** 이어쓰기 응답이 상한을 초과하더라도, **then the system shall** 출력 후처리·강제 절단·문장 수 강제 삭감을 도입하지 않는다(분량 제어는 프롬프트 지시로만, 프론트 출력 리라이팅 선례 없음 — mermaid 펜스 스트립 1함수 예외). [EXISTING: 프론트 이어쓰기 고스트 경로 무변경 확인]

### 모듈 4 — 다이어그램 펜스 (D-C)

#### Ubiquitous

- **REQ-AI4-008**: The system **shall** 다이어그램 시스템 프롬프트에 출력 형식 양성 예시("출력은 mermaid 키워드로 시작하고 백틱 문자를 포함하지 말라" 취지)를 1줄 포함하되, 기존 펜스 금지 단언(`diagram_prompt_forbids_markdown_fence_output` prompt.rs:410-426)의 `!contains("코드펜스로 감싸")` 계약과 충돌하지 않는 어휘를 사용한다. [MODIFY: `AiFeature::Diagram.system_prompt()` prompt.rs:86-91]

#### Event-Driven

- **REQ-AI4-009**: **WHEN** `stripMermaidFence`가 다이어그램 응답을 정규화하면, **the system shall** 무태그 코드펜스(`` ``` ``)와 타 태그 펜스(`` ```mmd `` 등)까지 매칭해 펜스 마커만 제거하고, 펜스 내부 코드는 리라이팅하지 않는다(정규식을 `/```[a-z]*\s*\n([\s\S]*?)```/i` 수준으로 일반화). [MODIFY: `stripMermaidFence` ai-suggestion-card.ts:870-874]

#### Unwanted Behaviour

- **REQ-AI4-010**: **IF** D-C 병행 방어가 적용되어도, **then the system shall** mermaid 자동 재요청 상태기계와 목록 폴백 경로(`handleDiagramComplete`/`decideDiagramOutcome`/`onReRequest` ai-suggestion-card.ts:800-816)의 동작을 변경하지 않는다(스트립·검증 대상 문자열만 정확해질 뿐 흐름 무변경). [EXISTING: 재요청 상태기계 무변경 확인]

### 모듈 5 — 무손상·하위호환

#### Ubiquitous

- **REQ-AI4-011**: The system **shall** IPC 계약(`feature:'section-fill'`+`presetKind`+`contextAfter`), 컨텍스트 절단(`truncate_head`/`truncate_tail` + `truncated` 플래그), 스트리밍 릴레이, 고스트/카드 수명주기를 변경 없이 유지한다. [EXISTING: mod.rs·ipc.ts·claude_cli.rs·stream.rs·ai-ghost-text.ts 무변경 확인]

- **REQ-AI4-012**: The system **shall** 문맥 0개 인라인 프롬프트(REQ-AI4-003)와 D-C 정규식 일반화 후 기존 `` ```mermaid `` 태그 펜스 스트립 결과(ai-suggestion-card.test.ts:398-411 기존 3케이스)를 관찰 가능하게 동일하게 유지한다(회귀 0). [MODIFY 결과 검증]

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [MODIFY] | `src-tauri/src/ai/prompt.rs` | (1) `build_inline_prompt`(151-178) user-prompt 선두 문맥 가드(문맥 ≥1일 때만, D-A), (2) `AiFeature::Continue.system_prompt()`(101-103) base에 재복창 금지(D-B) + 온건 분량·형식 상한(D-D), (3) `AiFeature::Diagram.system_prompt()`(86-91) 출력 양성 예시 1줄(D-C) |
| [MODIFY] | `src/components/editor/extensions/ai-suggestion-card.ts` | `stripMermaidFence`(870-874) 정규식 일반화(무태그/타 태그 펜스 허용) — 펜스 마커만 제거, 본문 리라이팅 금지(D-C) |
| [MODIFY] | `src-tauri/src/ai/prompt.rs` `#[cfg(test)]` | 신규 유닛(D-A 가드 포함/제외·바이트 동일·프리셋 루프, D-B 재복창 금지, D-D 분량 지시, D-C 양성 예시) + `continue_prompt_omits_after_instruction_when_after_empty`(570-575) D6 개정 |
| [MODIFY] | `src/test/aiSuggestionCard.test.ts` | `stripMermaidFence` describe(397-411)에 무태그·타 태그·태그 뒤 공백 케이스 추가(기존 3케이스 무개정) |
| [EXISTING] | `mod.rs`, `ipc.ts`, `claude_cli.rs`, `stream.rs`, `ai-ghost-text.ts`, mermaid 재요청 상태기계 | 무변경 — IPC·절단·릴레이·수명주기·폴백 경로 전부 보존 |
| [MANUAL] | `.moai/specs/SPEC-AI-004/manual-verification.md` | 실 CLI 재검증 기록(결함 5종×3회 + 통과 5종×1회, D2 판정) — SPEC 완료 시 1회 |

## Acceptance Criteria 매핑

> acceptance.md의 Given-When-Then과 대응. REQ-AI4-001~012 전 요구사항이 최소 1개 AC에 매핑된다.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-AI4-001 | REQ-AI4-001, 002 | 인라인 문맥 있는 프롬프트 → 가드 지시 포함(Rust 유닛) |
| AC-AI4-002 | REQ-AI4-002 | 프리셋 5종 + Custom 루프 전부 가드 적용(격리 테스트) |
| AC-AI4-003 | REQ-AI4-003, 012 | 문맥 0개 → 가드 미포함 + 기존 프롬프트 바이트 동일 |
| AC-AI4-004 | REQ-AI4-004, 005 | Continue base 재복창 금지 지시 포함 + 빈/비빈 after 양쪽 적용 |
| AC-AI4-005 | REQ-AI4-006, 007 | Continue base 분량·형식 상한 지시 포함 + 출력 절단 미도입 |
| AC-AI4-006 | REQ-AI4-008 | Diagram 양성 예시 포함 + 기존 펜스 금지 단언 무충돌 |
| AC-AI4-007 | REQ-AI4-009, 012 | stripMermaidFence 무태그·타 태그·태그 뒤 공백 스트립 + 기존 케이스 동일 |
| AC-AI4-008 | REQ-AI4-010, 011 | mermaid 재요청 상태기계·IPC·절단·수명주기 무변경(회귀) |
| AC-AI4-009 | REQ-AI4-001~008 (실 CLI) | 결함 5종(s07/s09/s10/s11/s02) 재실행 D2 기준 충족 |
| AC-AI4-010 | REQ-AI4-011, 012 (실 CLI) | 통과 5종(s01/s03/s04/s06/s08) 교차 오염 회귀 없음 |

## mx_plan

code_comments = ko (`language.yaml`). `@MX:SPEC: SPEC-AI-004` 공통 부착. 신규 계약 함수가 없어 신규 `@MX:ANCHOR` 불요.

| 위치 | 태그 | 사유 |
|------|------|------|
| `stripMermaidFence` 정규식 일반화 지점(ai-suggestion-card.ts:870-874) | `@MX:NOTE` | 무태그·타 태그 펜스 회피 대응 근거 + `handleDiagramComplete`(presetKind==='diagram') 전용 호출 스코프 명시(일반 코드블록 오작동 없음, research.md §4.3) |
| Continue base 지시 재조준(prompt.rs:101-103) | `@MX:NOTE` | D-B 조준 변경(뒤 문맥 → 직전 본문) 근거 + SPEC-AI-003 조건부 뒤 문맥 지시(prompt.rs:234-243)와의 관계 기록 |

## Exclusions (What NOT to Build)

- **새 기능 일절** — 길이 옵션 UI·재요청 UI·이어쓰기 히스토리는 후속 SPEC.
- **모델 변경** — `haiku` 유지, 상위 모델 승격 없음.
- **IPC 계약 변경** — `feature`/`presetKind`/`contextAfter` 필드·래핑 무변경.
- **truncate 로직·상한 변경** — `INLINE_SIDE_MAX`/`SECTION_TAIL_MAX`/`CONTINUE_HEAD_MAX` 무변경.
- **프론트 출력 리라이팅·문장 수 강제 절단** — mermaid 펜스 스트립 1함수 예외만. 이어쓰기 분량은 프롬프트 지시로만 제어(REQ-AI4-007).
- **mermaid 재요청 상태기계 변경** — `decideDiagramOutcome`/자동 재요청/목록 폴백 흐름 무변경(REQ-AI4-010).
- **s05형 사실 날조 대응** — 섹션 채우기의 세부 날조(manual-verification s05)는 별도 과제, 본 SPEC 범위 밖.
- **신규 런타임 의존성** — npm/cargo 추가 없음.
- **per-preset 문맥 가드 분산·COMMON_INSTRUCTION 전역 수정** — 단일 조립 지점 원칙(D4) 위반이라 금지.

## Implementation Notes

### 변경 파일 (3개)

| 파일 | 변경 내용 |
|------|-----------|
| `src-tauri/src/ai/prompt.rs` | 지시문 3종 수정 — (1) `build_inline_prompt` user-prompt 선두 문맥 가드(D-A, 문맥 ≥1일 때만), (2) `AiFeature::Continue.system_prompt()` base에 재복창 금지(D-B) + 온건 분량·형식 상한(D-D), (3) `AiFeature::Diagram.system_prompt()` 출력 양성 예시 1줄(D-C). 신규 유닛 테스트 8개 추가 |
| `src/components/editor/extensions/ai-suggestion-card.ts` | `stripMermaidFence` 정규식 일반화(D-C) — 무태그(` ``` `)·타 태그(` ```mmd ` 등) 펜스까지 매칭해 마커만 제거, 본문 리라이팅 없음 |
| `src/test/aiSuggestionCard.test.ts` | `stripMermaidFence` describe에 무태그·타 태그·태그 뒤 공백 케이스 2건 추가(기존 3케이스 무개정) |

### D6 테스트 개정 (1건)

`prompt.rs:570-575` `continue_prompt_omits_after_instruction_when_after_empty` — 지시 의도 변경(D-B 조준이 뒤 문맥에서 직전 본문으로 확장)에 따라 개정. 사유는 견고화: evaluator 지적으로 개정 근거 서술이 정정됨(단순 문구 변경이 아니라 조준 확장의 논리적 귀결임을 명시).

### 실 CLI 재검증 결과 (D2, manual-verification.md 참조)

- 결함 5종(s07/s09/s10/s11/s02) × 3회 재실행 — **전부 0/3 재현**(치명 결함 결정론 기준·품질 결함 확률 기준 모두 충족)
- 통과 5종(s01/s03/s04/s06/s08) × 1회 교차 오염 검사 — **5/5 퇴행 없음**
- D2 최종 판정: **PASS**(AC-AI4-009, AC-AI4-010 PASS)

### 잔존 관찰 (1건, 후속 후보)

s10.r3에서 [뒤 문맥]의 StateField/StateEffect/vitest/Playwright가 점선 노드로 다이어그램에 흡수(1/3). D-C 고정 판정 기준(mermaid 키워드 시작·백틱 0·사족 0)에는 영향 없어 PASS 판정을 유지했으나, 인라인 diagram의 문맥 흡수(D-A 인접 현상)가 가드에도 확률적으로 잔존함을 기록. 판정 기준 외 항목이므로 본 SPEC 범위 밖 — 후속 SPEC 후보.

### 게이트 수치

- vitest 939 통과
- cargo test 235 통과
- 실 CLI D2 PASS (결함 5종 0/3 재현, 통과 5종 무퇴행)
