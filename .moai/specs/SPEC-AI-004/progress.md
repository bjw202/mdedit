---
id: SPEC-AI-004
version: "0.1.0"
status: implemented
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | manager-tdd | T1~T3 구현 완료 기록. T4(실 CLI 재검증) 오케스트레이터 대기. |

# Progress — SPEC-AI-004

## 진행 로그

| 시각 순서 | 유닛 | 액션 | 결과 |
|-----------|------|------|------|
| 1 | 사전 | 기준선 확인 | cargo test ai::prompt: 33 passed |
| 2 | T1 RED | 신규 테스트 2개 추가(재복창 금지·분량 상한) + D6 개정(`:570-575`) | 2 failed / 36 total(예상대로 실패) |
| 3 | T1 GREEN | Continue base 문자열에 재복창 금지·분량 상한 지시 추가 | 36 passed |
| 4 | T2 RED | 신규 테스트 4개 추가(가드 삽입/미삽입/Custom/프리셋 루프) | 3 failed(가드 미구현) / 40 total |
| 5 | T2 GREEN | `INLINE_CONTEXT_GUARD` 상수 + `build_inline_prompt` 조건부 삽입 | 40 passed |
| 6 | T3 RED(Rust) | `diagram_prompt_has_positive_output_example` 추가 | 1 failed |
| 6 | T3 RED(TS) | vitest 무태그·타 태그 케이스 추가 | 2 failed / 4 passed |
| 7 | T3 GREEN | Diagram 프롬프트 양성 예시 문장 추가, `stripMermaidFence` 정규식 일반화 | Rust 41 passed / TS 6 passed |
| 8 | 게이트 | tsc/vitest 전량/cargo test 전량/clippy | 전부 클린(수치는 tasks.md 참고) |

## 회귀 확인

- D6 개정 대상 외 기존 테스트 전부 무개정 통과 확인(`diagram_prompt_forbids_markdown_fence_output`, `continue_system_prompt_instructs_style_inheritance`, `inline_prompt_omits_empty_context`, `inline_prompt_includes_context_sections`, stripMermaidFence 기존 3케이스 등).
- 수정 파일 3개로 스코프 한정 확인(`git diff --stat`): `src-tauri/src/ai/prompt.rs`, `src/components/editor/extensions/ai-suggestion-card.ts`, `src/test/aiSuggestionCard.test.ts`.
- 신규 런타임 의존성 0(Cargo.toml/package.json diff 없음).

## 다음 단계

- T4: 오케스트레이터가 실 CLI(`haiku`) 결함 5종×3회 + 통과 5종×1회 재검증 후 `.moai/specs/SPEC-AI-004/manual-verification.md` 작성.
