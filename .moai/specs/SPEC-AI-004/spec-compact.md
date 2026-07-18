---
id: SPEC-AI-004
version: "0.1.0"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 17
generated_from: spec.md
---

# SPEC-AI-004 Compact — AI 프롬프트 핫픽스(인라인 문맥 흡수·재복창·펜스·과잉 생성)

> Run phase용 압축본. 원본: spec.md / plan.md / acceptance.md / research.md.
> 실 CLI 시뮬레이션(SPEC-AI-003 manual-verification.md, main)에서 확정된 프롬프트 품질 결함 4종을 지시문 수정으로 핫픽스. 코드 로직 버그 아님. 인프라(스트리밍·고스트·IPC·절단·수명주기) 전부 무변경. 방법론 TDD. 베이스: main post-#16(731f05f).

## 결함 → 해법 (원인 지시문 좌표)

- **D-A 인라인 문맥 흡수**(s07/s09): `build_inline_prompt`(prompt.rs:151-178)가 `[앞/뒤 문맥]` 조립하나 스코프 설명 무. 요약 동사가 문맥까지 변환 → user-prompt 선두 가드 1줄(문맥 ≥1일 때만).
- **D-B 앞 꼬리 재복창**(s11): SPEC-AI-003 금지 지시가 뒤 문맥만 조준. 커서 앞 텍스트 재출력 미금지 → Continue base(prompt.rs:101-103) "직전 본문 재출력 금지·끊긴 지점 다음부터".
- **D-C mermaid 펜스 재발**(s10): 프롬프트 펜스 금지 있어도 haiku 위반. `stripMermaidFence`(ai-suggestion-card.ts:870-874)가 태그 펜스만 스트립 → 프롬프트 양성 예시 + 정규식 `/```[a-z]*\s*\n([\s\S]*?)```/i` 일반화(펜스만, 리라이팅 금지) 병행.
- **D-D 이어쓰기 과잉**(s02): 분량·형식 상한 무 → Continue base 온건형("한두 문단 이내 + 미요청 코드블록·표·목차 도입 금지").

## Requirements (EARS)

### 모듈 1 — 인라인 문맥 가드 (D-A)

- **REQ-AI4-001** (E): WHEN inline user-prompt에 `[앞 문맥]`/`[뒤 문맥]` ≥1, 선두에 "문맥은 참고용, `[대상]`만 변환·문맥 미포함" 가드 삽입.
- **REQ-AI4-002** (U): 가드는 `build_inline_prompt` 단일 지점 — 프리셋 5종 + Custom 일괄(per-preset·COMMON 확산 금지).
- **REQ-AI4-003** (Un): IF 문맥 0개, 가드 미삽입 → 기존과 바이트 동일(`inline_prompt_omits_empty_context` 계약 보존).

### 모듈 2 — 재복창 금지 (D-B)

- **REQ-AI4-004** (U): Continue base에 "직전 본문 재출력 금지·끊긴 지점 바로 다음부터 새 텍스트만" 지시.
- **REQ-AI4-005** (E): WHEN 빈/비빈 contextAfter 각각, 재복창 금지가 base 수정이라 doc-end·자유 위치 양쪽 자동 적용(D5).

### 모듈 3 — 과잉 생성 억제 (D-D)

- **REQ-AI4-006** (U): Continue base에 온건 분량·형식 상한("한두 문단 이내 + 새 형식 임의 도입 금지"). 절대 금지형 배제(코드 인접 산문 이어쓰기 정당성 보존).
- **REQ-AI4-007** (Un): IF 상한 초과, 출력 후처리·강제 절단 미도입(프롬프트 지시로만 — 펜스 스트립 예외).

### 모듈 4 — 다이어그램 펜스 (D-C)

- **REQ-AI4-008** (U): Diagram 프롬프트에 양성 예시("mermaid 키워드로 시작·백틱 미포함") 1줄 — `diagram_prompt_forbids_markdown_fence_output`의 `!contains("코드펜스로 감싸")`와 무충돌 어휘.
- **REQ-AI4-009** (E): WHEN `stripMermaidFence` 정규화, 무태그 `` ``` ``·타 태그 `` ```mmd `` 펜스까지 매칭해 마커만 제거, 내부 코드 리라이팅 금지.
- **REQ-AI4-010** (Un): IF 병행 방어 적용, mermaid 재요청 상태기계·목록 폴백(ai-suggestion-card.ts:800-816) 무변경.

### 모듈 5 — 무손상·하위호환

- **REQ-AI4-011** (U): IPC·절단·릴레이·고스트/카드 수명주기 무변경.
- **REQ-AI4-012** (U): 문맥 0개 인라인 + 기존 `` ```mermaid `` 태그 펜스 스트립 결과 바이트 동일(회귀 0).

## Acceptance (요약)

| AC | 내용 |
|----|------|
| AC-AI4-001 | 인라인 문맥 有 → 가드 지시 포함(Rust 유닛) |
| AC-AI4-002 | 프리셋 5종 + Custom 루프 전부 가드(격리) |
| AC-AI4-003 | 문맥 0개 → 가드 無 + 바이트 동일 스냅샷 |
| AC-AI4-004 | Continue base 재복창 금지 + 빈/비빈 after 양쪽 |
| AC-AI4-005 | Continue base 분량·형식 상한 + 출력 절단 미도입 |
| AC-AI4-006 | Diagram 양성 예시 + 기존 펜스 금지 단언 무충돌 |
| AC-AI4-007 | stripMermaidFence 무태그·타 태그·태그 뒤 공백 + 기존 3케이스 동일 |
| AC-AI4-008 | mermaid 재요청·IPC·절단·수명주기 무변경(회귀) |
| AC-AI4-009 | 실 CLI 결함 5종(s07/s09/s10/s11/s02) D2 기준(치명 0/3, 품질 ≤1/3) |
| AC-AI4-010 | 실 CLI 통과 5종(s01/s03/s04/s06/s08) 교차 오염 회귀 없음 |

## Files to Modify

| Delta | 파일 | 요지 |
|-------|------|------|
| [MODIFY] | `src-tauri/src/ai/prompt.rs` | build_inline_prompt 문맥 가드(D-A) + Continue base 재복창 금지·분량 상한(D-B/D-D) + Diagram 양성 예시(D-C) |
| [MODIFY] | `src/components/editor/extensions/ai-suggestion-card.ts` | stripMermaidFence 정규식 일반화(D-C) — 펜스만, 리라이팅 금지 |
| [MODIFY] | `prompt.rs #[cfg(test)]`, `src/test/aiSuggestionCard.test.ts` | 신규 유닛 + `continue_prompt_omits_after_instruction_when_after_empty`(570-575) D6 개정 |

## D6 개정 대상 (지시 의도 변경 — 유일 허용 개정)

- **`continue_prompt_omits_after_instruction_when_after_empty`**(prompt.rs:570-575): `assert_eq!(system_prompt, Continue.system_prompt())`는 유지(양변 동시 변경). D-D 분량 지시가 base에 "금지" 어휘를 넣으면 `!contains("금지")` 파손 → **뒤 문맥 관련 금지 부재**로 특정(`!contains("뒤 문맥")` 또는 `!contains("반복하거나 선점")`). REQ 대응: REQ-AI4-005/006.
- 그 외 개정 금지. `diagram_prompt_forbids_markdown_fence_output`(410-426)·`continue_system_prompt_instructs_style_inheritance`(351-356)·`inline_prompt_*`(484-508)는 무개정 통과해야 함(어휘 충돌 회피 — research.md §4.2).

## Exclusions

새 기능 일절(길이 옵션·재요청 UI·히스토리) / 모델 변경 / IPC 계약 변경 / truncate 상한 변경 / 프론트 출력 리라이팅·강제 절단(펜스 스트립 1함수 예외) / mermaid 재요청 상태기계 변경 / s05형 사실 날조 대응 / 신규 런타임 의존성 / per-preset 가드 분산.

## Gates

tsc 클린 / vitest ≥936 / cargo test ≥227 / clippy 클린. **lint는 게이트 아님**(eslint config 부재). 실 CLI 재검증(수동)은 자동 게이트와 분리, SPEC 완료 시 1회.
