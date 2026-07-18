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
| 0.1.0 | 2026-07-17 | manager-tdd | T1~T3 TDD 완료(RED-GREEN 확인). T4는 오케스트레이터가 수동 재검증. |

# Tasks — SPEC-AI-004 (AI 프롬프트 핫픽스)

| Task | 상태 | RED | GREEN | 비고 |
|------|------|-----|-------|------|
| T1. Continue base 재조준(D-B) + 분량 상한(D-D) | 완료 | `continue_prompt_forbids_restating_existing_text`, `continue_prompt_bounds_generation_volume` 2개 신규 실패 확인(2 failed / 36 total) | prompt.rs:101-103(现 Continue arm) 수정 후 36/36 통과 | D6: `continue_prompt_omits_after_instruction_when_after_empty`(:570-575) `!contains("금지")` → `!contains("뒤 문맥")` 개정(유일 허용) |
| T2. 인라인 문맥 가드(D-A) | 완료 | `inline_prompt_injects_context_guard_when_context_present`, `custom_preset_inline_prompt_has_context_guard`, `all_presets_inline_prompt_guard_with_context_isolated` 3개 신규 실패 확인 | `build_inline_prompt`에 `INLINE_CONTEXT_GUARD` 상수 조건부 삽입 후 40/40 통과 | `inline_prompt_omits_guard_without_context`로 바이트 동일 스냅샷 확보(문맥 0개) |
| T3. Diagram 양성 예시(D-C, Rust) + stripMermaidFence 일반화(D-C, TS) | 완료 | Rust: `diagram_prompt_has_positive_output_example` 1개 신규 실패 확인. TS: 무태그·타 태그 2개 신규 실패 확인(태그 뒤 공백 케이스는 기존 정규식으로도 우연히 통과) | Diagram 프롬프트에 "키워드로 시작·백틱 미포함" 1문장 추가(41/41). `stripMermaidFence` 정규식 `/```[a-z]*\s*\n([\s\S]*?)```/i`로 일반화(6/6, 기존 3케이스 무개정) | @MX:NOTE 2곳 부착(stripMermaidFence, Continue base) |
| T4. 수동 실 CLI 재검증 | 미착수(오케스트레이터 담당) | - | - | 자동 게이트와 분리, SPEC 완료 시 1회 수행 → manual-verification.md |

## 게이트 결과

- `npx tsc --noEmit`: 클린(0 errors)
- `npx vitest run`: 939 passed (기준선 936 + 신규 3 — stripMermaidFence 무태그·타 태그·태그 뒤 공백)
- `cd src-tauri && cargo test`: 235 passed (기준선 227 + 신규 8 — Continue base 3, 인라인 가드 4, Diagram 양성 예시 1)
- `cargo clippy --all-targets`: prompt.rs/ai-suggestion-card.ts 무경고. (image_ops.rs의 pre-existing `needless_borrows_for_generic_args` 경고 4건은 본 SPEC 스코프 밖, 무변경 파일)
- `npm run lint`: 게이트 아님(eslint config 부재, 미실행)
