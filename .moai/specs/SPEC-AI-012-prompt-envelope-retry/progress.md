# SPEC-AI-012 진행 기록

카드 t4 · 브랜치 WT-prompt-envelope · 방법론 TDD(Tier M) · 증거 기준 HEAD 8223f21 (이 문서를 담은 커밋 직전)

## §E.2 Run-phase Evidence

각 항목은 이번 실행에서 이 트리에 대해 직접 실행해 관찰한 출력이다. 모든 명령의 작업 위치는 `.claude/worktrees/t4` 이다.

### E.2.1 RED 증거 (구현 전 실패 출력, 요약 발췌)

Rust — 스텁 진입점만 둔 상태에서 `cargo test --manifest-path src-tauri/Cargo.toml --lib ai::prompt`:

```
test ai::prompt::tests::envelope_basic_shape_orders_before_target_after ... FAILED
test ai::prompt::tests::system_prompt_declares_data_and_names_tags_without_brackets ... FAILED
test ai::prompt::tests::closing_tag_collision_renames_tags_per_request ... FAILED
test ai::prompt::tests::sandwich_recap_block_closes_user_prompt_after_last_tag ... FAILED
test ai::prompt::tests::language_clause_is_conditional_and_old_clause_is_gone_for_six_features ... FAILED
test ai::prompt::tests::additional_instruction_reaches_system_prompt_and_recap_for_presets ... FAILED
test ai::prompt::tests::inline_prompt_without_context_is_target_only ... FAILED
(그 밖의 14건 포함 총 21건 FAILED)
test result: FAILED. 53 passed; 21 failed; 0 ignored; 0 measured; 315 filtered out; finished in 0.00s
```

Rust `mod.rs` — 필드 추가 전 `cargo test --manifest-path src-tauri/Cargo.toml --lib ai::tests::request_args`:

```
error[E0609]: no field `additional_instruction` on type `ai::AiRequestArgs`
error: could not compile `mdedit` (lib test) due to 2 previous errors
```

프런트 — 배선 교체 전 `npx vitest run src/test/aiCardAdditionalInstruction.test.ts src/test/aiCardRetryLimit.test.ts src/test/aiCardRerequestProgress.test.ts`:

```
→ expected '이전 제안과 다른 방식으로' to be '영어로 번역해줘' // Object.is equality
→ expected undefined to be '더 짧게' // Object.is equality
→ expected undefined to be true // Object.is equality   (이전 오류: 시작 단언)
Test Files  3 failed (3)
Tests  11 failed | 32 passed (43)
```

(전체 RED 목록 파일: `.moai/logs/t4-red-rust.txt`, `.moai/logs/t4-red-vitest.txt` — 로컬 미추적 파일)

M1 리터럴 스냅샷은 변경 전 코드에서 통과로 기록했다:

```
$ cargo test --manifest-path src-tauri/Cargo.toml --lib ai::prompt::tests::snapshot
test result: ok. 5 passed; 0 failed; ... 367 filtered out
```

### E.2.2 최종 게이트 (GREEN)

| # | 명령 | 종료 코드 | 관찰한 출력 꼬리 |
|---|------|-----------|------------------|
| 1 | `npm run typecheck` | 0 | `tsc --noEmit` 출력 없음 |
| 2 | `npm run lint` | 0 | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` 출력 없음 |
| 3 | `cargo test --manifest-path src-tauri/Cargo.toml` (전체) | 0 | lib `391 passed; 0 failed`, `app_acl` 3 passed, `asset_charset` 8 passed, main·doc 0 tests |
| 4 | `npx vitest run --dir src` (전체) | 0 | `Test Files  119 passed (119)` / `Tests  2050 passed (2050)` |
| 5 | `cargo test ... --lib ai::` (이터레이션 중) | 0 | `241 passed; 0 failed` |
| 6 | `npx vitest run` 대상 5개 파일 (`aiCardAdditionalInstruction`, `aiCardRetryLimit`, `aiCardRerequestProgress`, `aiSuggestionCardRerequest`, `aiSuggestionCard`) | 0 | `Test Files 5 passed (5)` / `Tests 110 passed (110)` |
| 7 | `cargo clippy --manifest-path src-tauri/Cargo.toml --lib` 중 `ai/prompt.rs`·`ai/mod.rs` 관련 경고 | — | 해당 파일 언급 0건 (필터 출력 없음) |
| 8 | `git diff --stat origin/main -- src-tauri/src/ai/claude_cli.rs src-tauri/src/ai/codex_cli.rs` | 0 | 출력 비어 있음 (origin/main = 5c617ae) |

Playwright: plan.md·acceptance.md 가 지정한 Playwright 스펙이 없어(자동 AC 는 Rust·Vitest 만) 실행하지 않았다.

### E.2.3 REQ/AC 상태

| REQ | AC | 상태 | 근거 |
|-----|----|------|------|
| REQ-AI12-001, 009 | AC-AI12-001 | PASS | `envelope_basic_shape_orders_before_target_after`, `empty_selection_still_has_target_pair`, `no_collision_uses_default_names_deterministically` |
| REQ-AI12-002 | AC-AI12-002 | PASS | `system_prompt_declares_data_and_names_tags_without_brackets` (6기능) |
| REQ-AI12-002, 003 | AC-AI12-003 | PASS | `instruction_like_selection_stays_inside_target_tag_only` |
| REQ-AI12-003 | AC-AI12-004 | PASS | `selection_with_after_label_line_is_kept_verbatim_inside_target`, 기존 `inline_prompt_keeps_selection_verbatim` |
| REQ-AI12-006 | AC-AI12-005, 006 | PASS | `closing_tag_collision_renames_tags_per_request` |
| REQ-AI12-006 | AC-AI12-007 | PASS | `collision_with_suffixed_name_falls_back_to_numeric_suffix`, `collision_in_before_after_or_uppercase_selection_renames`, `collision_in_custom_or_additional_instruction_renames` (a~f 여섯 경우) |
| REQ-AI12-004 | AC-AI12-008 | PASS | `sandwich_recap_block_closes_user_prompt_after_last_tag`, `recap_block_does_not_leak_diagram_fragment_for_non_diagram`, `inline_prompt_without_context_is_target_only` |
| REQ-AI12-005 | AC-AI12-009 | PASS | `language_clause_is_conditional_and_old_clause_is_gone_for_six_features` |
| REQ-AI12-007 | AC-AI12-010, 011 | PASS | `additional_instruction_reaches_system_prompt_and_recap_for_presets`, `custom_keeps_original_instruction_and_adds_additional` |
| REQ-AI12-010 | AC-AI12-012 | PASS | `blank_additional_instruction_is_byte_identical_to_none` |
| REQ-AI12-011 | AC-AI12-013 | PASS | M1 `snapshot_*` 5건(변경 후에도 통과) + 기존 `continue_*`·`section_*` 무수정 통과. `ai_request` 의 이어쓰기·섹션 채우기 분기는 `additional_instruction` 을 넘기지 않음(코드 확인) |
| REQ-AI12-007 | AC-AI12-014 | PASS | `request_args_deserialize_additional_instruction_camel_case`, `request_args_additional_instruction_absent_defaults_to_none` |
| REQ-AI12-008, 012 | AC-AI12-015 | PASS | `aiCardAdditionalInstruction.test.ts` 케이스 1~7 (7번은 복구용 3곳 각각) + 갱신된 기존 단언 3곳 |
| REQ-AI12-013 | AC-AI12-016 | PASS | 게이트 8 (출력 비어 있음) |

수동 확인 (실기기):

| ID | 상태 | 내용 |
|----|------|------|
| M-1 | PENDING (사용자) | claude·codex 각각에서 다듬기·짧게 실행, 결과에 `<mdedit_…>` 태그가 섞이지 않는지 |
| M-2 | PENDING (사용자) | 한국어 문단 → 직접 입력 "영어로 번역해줘" → 빈 입력 ↻ 후에도 영어인지 |
| M-3 | PENDING (사용자, 생략 가능) | 다이어그램 자동 재요청 후 유효 다이어그램인지 관찰 기록 |

### E.2.4 Gaps (관찰하지 못한 것)

- 실제 claude·codex CLI 로 보낸 프롬프트의 모델 응답 품질(태그 되풀이 R2, 언어 유지)은 관찰하지 않았다. M-1~M-3 이 담당한다.
- Windows·macOS 별 CLI 동작, Playwright E2E 는 실행하지 않았다.
- `cargo fmt --check` 는 실행하지 않았다(CI 게이트 아님).

### E.2.5 Residual risk

- 요청 ID 끝 8자 난수에 기대는 "요청마다 다른 태그 접미사" 성질은 가정 A1(spec.md)에 의존한다.
- 모델이 닫는 태그를 되풀이하는 경우를 프런트가 후처리하지 않는다(Exclusions).

## §E.3 Run-phase Audit-Ready Signal

```
run_status: audit-ready
run_complete_commit: 8223f21 (진행 기록 커밋은 그 다음)
```

## §F Phase 4 Mode Selection

- Input: Tier M, 수정 파일 약 8개, 도메인 2(Rust 조립·프런트 배선), 파일 언어 Rust+TypeScript, 병렬화 이득 낮음(코딩 중심)
- Evaluation: direct 미선택(비사소), serial 선택, fanout 미선택(코딩 중심), sweep 미선택(기계적 일괄 변환 아님)
- Decision: serial
- Justification: 의존 순서(Rust 조립 → IPC 필드 → 프런트 배선)가 곧 마일스톤 순서이고, 하위 에이전트를 띄우지 않고 한 에이전트가 순차 진행했다.

## 결정·계획 대비 차이

- spec.md 의 D1~D10 은 그대로 따랐다. 새 결정 없음.
- 진입점 이름은 `build_inline_prompt_ex`, 인자 7개(옵션 구조체 불필요).
- 태그 선택 함수 `envelope_tags` 와 `scope_clause` 는 비공개, `EnvelopeTags` 구조체만 공개했다.
- plan.md 4.3 의 프런트 테스트는 `aiSuggestionCardRerequest.test.ts` 에 추가하지 않고 새 파일 `src/test/aiCardAdditionalInstruction.test.ts` 로 분리했다(plan.md 가 허용한 선택).
- `AiFeature::task_text()` 를 공개 메서드로 추가해 `system_prompt()` 와 재확인 블록이 같은 작업 문장을 쓰게 했다. `system_prompt()` 반환값은 M1 리터럴 스냅샷으로 바이트 동일함을 확인했다.
- `status: draft → in-progress` 전환은 M1 커밋(fafeacc)에 포함되지 못해(sed 가 적용되지 않음) 별도 chore 커밋(dd5873f)으로 했다. fafeacc 의 커밋 메시지에는 전환했다고 적혀 있으나 실제 전환은 dd5873f 다.
- `DIAGRAM_NONE_SYSTEM_PROMPT_SNAPSHOT` 리터럴과 `inline_prompt_without_context_is_target_only` 의 기대 문자열은 새 스코프 절·재확인 블록 문구를 손으로 적은 리터럴이다(plan.md 4.4 의 의도적 갱신).

## §E.4 Sync-phase Audit-Ready Signal

```
sync_status: audit-ready
sync_complete_at: 2026-11-13
sync_commit_sha: pending-backfill (이 기록을 담은 sync 커밋은 자기 SHA를 알 수 없다)
frontmatter_status_transitions: spec.md in-progress -> implemented (completed 아님; 수동 M-1~M-3 후 close)
b12_self_test_a: grep -c 'SPEC-AI-012' CHANGELOG.md -> 0 (추가 전)
b12_self_test_b: acceptance.md 고유 AC ID 16건 (grep -oE 'AC-AI12-[0-9]+' | sort -u | wc -l = 16), CHANGELOG 항목 AC-AI12-001~016(16건)과 일치
b12_self_test_c: CHANGELOG에 적은 파일 경로 7건 ls/git diff --name-only로 존재 확인
changelog_entry_position: ## [Unreleased] / ### Changed
```

### 동기화한 것

- `CHANGELOG.md` `[Unreleased]` 에 `### Changed` 항목 1건 추가 (수치는 §E.2.2 기록만 인용).
- `spec.md` frontmatter `status: implemented`, `updated: 2026-11-13` (본문 무변경). plan.md·acceptance.md 무변경.
- README.md·docs 점검: README.md 33행(선택 툴바 ↻ 재요청 설명)과 docs/USER_GUIDE.md 243·252~253·335~337행(직접 입력 번역, ↻ 직접 지시/다시)을 확인했다. 사용자에게 보이는 동작 설명은 여전히 정확해 수정하지 않았다.

### 증거

- 이번 sync 단계에서 테스트·린트를 다시 실행하지 않았다. 테스트·린트 수치는 §E.2.2 의 run 단계 실행 기록(typecheck 0, lint 0, cargo test 0 / lib 391, vitest 0 / 2050)이다.
- `git diff origin/main...HEAD --name-only` 로 구현 파일 7건(Rust 2, TS 2, 테스트 3)을 확인했다.

### Gaps

- 수동 확인 M-1, M-2, M-3 는 PENDING(사용자). 실제 CLI 응답 품질 미관찰.
- CI 가 `cargo test` 를 실행하지 않으므로 Rust 테스트는 로컬 실행에만 근거한다.
- MX 태그 검증과 sync-audit 은 이 단계에서 수행하지 않았다.
- `completed` 전환은 M-1~M-3 확인 뒤 별도 close 에서 한다.
