# Sync Audit Report — SPEC-AI-013 (card t5)

- SPEC: SPEC-AI-013 (long selections: stdin transport, length-adaptive watchdog, raised limits 6,000/12,000, completion-gated replace)
- Branch / tree: WT-long-selection, `.claude/worktrees/t5`, HEAD 110ccfa (diff scope `origin/main...HEAD`, 22 files, +1210/-249)
- Auditor: sync-auditor (independent; read-only on source; no commits)
- Profile: `default` (flat weighted scoring; `evaluator_mode` is not `hierarchical`)
- Overall Verdict: **PASS** (conditional: the SPEC must stay `implemented`, not `completed`, until AC-AI13-013/014 are observed by a human)
- Overall score: **0.87** (weighted harmonic mean; formula below)

Plain-language summary: the change does what the SPEC says. User text no longer travels on the command line, the wait limit grows with selection length using the same formula in Rust and TypeScript, and the Replace button is hidden whenever the answer was cut off or cannot be confirmed complete on a long selection. I found no blocking defect and no Critical or High security issue. The remaining findings are small documentation drifts, one over-stated CHANGELOG sentence, and a few test or formatting gaps. Two acceptance criteria (a real macOS run and a real Windows run) are still waiting for a human, and I could not observe them.

## Dimension Scores

| Dimension | Score | Verdict | Basis |
|-----------|-------|---------|-------|
| Functionality (40%) | 0.90 | PASS (AC-013/014 UNVERIFIED, tracked) | 12/12 automated ACs have matching code and tests; I re-ran the targeted Rust and TS tests (below). Manual macOS/Windows ACs not observed. |
| Security (25%) | 0.88 | PASS | No user text in argv (removes `ps` exposure); no new dependencies; system-prompt path is app-derived; no Critical/High/Medium finding. One Low (leftover prompt file). |
| Craft (20%) | 0.80 | PASS (coverage UNVERIFIED) | eslint clean; new tests assert independent invariants; coverage not measured by me (heavy runs discouraged); new Rust code is not rustfmt-clean; one wiring test gap. |
| Consistency (15%) | 0.85 | PASS | Matches the claude/codex sibling pattern, MX tags, Korean comments; stale comment, stale progress row, frontmatter drift. |
| **Overall (weighted harmonic mean)** | **0.87** | | 1 / (0.40/0.90 + 0.25/0.88 + 0.20/0.80 + 0.15/0.85) = 1 / 1.1550 = 0.866 |

Must-pass firewall (Functionality + Security): both pass independently. No must-pass dimension failed.

## Mechanical evidence (this run, this tree, HEAD 110ccfa)

| Dimension | Command | Observed (verbatim) |
|-----------|---------|---------------------|
| Functionality | `npx vitest run src/test/aiLongSelection.test.ts` | `✓ src/test/aiLongSelection.test.ts (26 tests) 170ms` / `Test Files  1 passed (1)` / `Tests  26 passed (26)` |
| Functionality | `~/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml -- ai::tests::watchdog stream::tests::completion claude_cli::tests::stdin claude_cli::tests::claude_command claude_cli::tests::codex_command claude_cli::tests::args_have_no_prompt` | `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 393 filtered out` (11 + 393 = 404, matching the claimed "lib 404") |
| Security | `git diff origin/main...HEAD --stat -- src-tauri/Cargo.toml src-tauri/Cargo.lock package.json package-lock.json src-tauri/capabilities` | empty (no dependency or capability change) |
| Security | secret-pattern grep over the added lines of `src` and `src-tauri` (`AKIA`, `sk-…`, `password`, `secret`, `api_key`) | no matches |
| Security | `grep` of `user_prompt|system_prompt|combined` in `claude_cli.rs`/`codex_cli.rs` non-comment lines | prompt text reaches only `spawn_stdin_writer(...)` (claude_cli.rs:274, codex_cli.rs:168) and the file write (claude_cli.rs:164); the only argv value derived from a prompt is the file path (claude_cli.rs:101) |
| Security | fixtures: `grep -cE "/Users/|byunjungwon|sk-ant"` on both `claude-stop-reason-*.jsonl` | `0` and `0` (only non-sensitive `session_id` UUIDs remain) |
| Craft | `npx eslint --max-warnings 0 <7 changed ts files>` | `eslint exit=0` |
| Craft | `rustfmt --edition 2021 --check` on the four changed `ai/*.rs` files | diff hunks: claude_cli.rs 12, codex_cli.rs 2, mod.rs 3, stream.rs 14 (also detect.rs 4 and prompt.rs 27, files this diff does not touch, so the baseline is already unformatted) |
| Consistency | grep for stale identifiers `BACKEND_WATCHDOG_TIMEOUT_MS|FRONTEND_BACKSTOP_DELAY_MS|WATCHDOG_TIMEOUT_SECS` in `src`, `src-tauri/src`, `docs`, `README.md` | no output (no dangling references) |

Baseline attribution: all outputs above come from commands I ran in this session against HEAD 110ccfa. I did not re-run the full cargo or vitest suites, tsc, clippy, or coverage.

## AC verification

| AC | Result | Evidence |
|----|--------|----------|
| 001 claude argv has no prompt text, file outside scratch | PASS | `build_claude_args` (claude_cli.rs:97-102) takes only a path; test `args_have_no_prompt_text_and_no_newlines_and_file_is_outside_scratch` asserts no marker, no newline, byte-equal file, `!path.starts_with(scratch)`, scratch entry count 0; passed in my run |
| 002 codex argv | PASS | `build_codex_args(model, scratch)` ends with `--json`; test passed (pattern `args_have_no_prompt`, plus snapshot of 13 elements) |
| 003 stdin reaches the child | PASS | `/bin/cat` round trips for both Command builders passed (`claude_command_pipes_stdin_to_child`, `codex_command_pipes_stdin_to_child`); BrokenPipe writer test passed |
| 004 Rust timeout vs shared table | PASS | `watchdog_timeout_matches_shared_table_by_utf16_length` passed; `div_ceil` is stable since Rust 1.73, `rust-version` is 1.77.2 |
| 005 TS timeout vs shared table and ordering | PASS | `AC-AI13-005` block in aiLongSelection.test.ts passed |
| 006 6,000-char backstop timing | PASS | test at aiLongSelection.test.ts:195 uses 65,000 / 112,999 / 113,000 ms (108+5), matching the post-D6 formula |
| 007 limit boundaries | PASS | per progress.md; tests in aiLengthGuard.test.ts, aiSelectionToolbar.test.ts; not individually re-run by me (Gap) |
| 008 claude completion | PASS | fixtures are real captures: cutoff fixture has 4× `max_tokens` plus 2× `stop_sequence` (the `result` line), complete fixture has 2× `end_turn`; `completion_cutoff_is_sticky_against_later_end_turn` passed |
| 009 codex completion | PASS | `codex_done_payload` is used by both emit paths (codex_cli.rs diff hunks at the `turn.completed` and EOF fallback sites) |
| 010 store path | PASS | `startSuggestionCard` passes `{ completion: s.completion }` (ai-suggestion-card.ts store subscription); tests passed |
| 011 router path | PASS | `onDone: (result, truncated, completion)` forwards to `onComplete`; test passed |
| 012 regression and boundaries | PASS | `applyCompletionToActions` (ai-suggestion-card.ts:197-211) uses `> SAFE_REPLACE_LIMIT` (2,000 stays Replace, 2,001 does not); `buildSelectionRequest` keeps `selection` unmodified (ai-selection-toolbar.ts:200) |
| 013 macOS manual | UNVERIFIED | pending human (correctly recorded as "대기") |
| 014 Windows manual | UNVERIFIED | pending human; Windows `.cmd` behavior cannot be observed here |

## Hazard probes (as requested)

1. **stdin writer: EOF, BrokenPipe, deadlock.** `spawn_stdin_writer` (claude_cli.rs:176-182) writes on a dedicated thread, ignores errors, and drops the handle, which closes the pipe and delivers EOF. The stdout reader is a separate thread started in `ai_request` step 9, so a full child output pipe cannot block the writer. A killed child (cancel, replacement, watchdog) closes the read end, so a blocked `write_all` returns an error and the thread ends. The detached thread is bounded by child lifetime. No defect found. Pre-existing and unchanged: stderr is read only after stdout EOF (claude_cli.rs relay), so a child writing more than a pipe buffer of stderr before closing stdout could stall; not made worse by this change.
2. **System-prompt file outside scratch.** The path is `cwd.parent()/ai-prompt/system-prompt.txt` (claude_cli.rs:153-168); no user-controlled path component, so no traversal. Concurrency: `ai_request` is a synchronous Tauri command (serialized), the old child is killed before the new spawn, and `tauri-plugin-single-instance` is registered (lib.rs:19), so two instances cannot share the file. Leftover: the file persists after the request with default permissions and may contain the user's direct-input instruction (F7, Low). The previous design put the same text in argv, visible to every local user through `ps`, so this is a net improvement.
3. **Completion parsing.** `parse_stop_reason` (stream.rs) reads only `stream_event` / `message_delta` lines; the `result` line is not consulted (the capture shows it reports `stop_sequence` even on a `max_tokens` failure). `CompletionTracker` keeps `max_tokens` sticky, treats `end_turn` and `stop_sequence` as complete, and defaults to `Unknown`; other reasons (`refusal`, `pause_turn`) fall to `Unknown`. codex always returns `Unknown` (`codex_done_payload`). No defect.
4. **「바꾸기」 gating at 2,000.** Both sides use UTF-16 length (`selection.length`); the comparison is strictly `>` 2,000. `enterReRequest` resets `completion` to `unknown` (ai-suggestion-card.ts:1289); every user-initiated re-request path goes through it. The list-fallback path calls `enterListFallback`, and `onComplete` overwrites `completion` on the next done, so no stale value can reach an apply button. The gate is render-only (`applyActiveCard`, ai-suggestion-card.ts:1390, does not re-check), but its only caller is the rendered button (F11, Info).
5. **Timeout parity and ordering.** Rust `min(60 + 12 * div_ceil(n.saturating_sub(2000), 1000), 180)` and TS `Math.min(60 + 12 * Math.ceil(Math.max(0, n - 2000) / 1000), 180) * 1000` agree on all nine shared rows including the emoji row (UTF-16 2,001, `chars()` 1,001). Ordering 8 s < watchdog (≥ 60 s) < backstop (+5 s) holds for every n by construction. Front-end `selectionLength` is `request.args.selection?.length ?? 0`; the backend uses `args.selection.unwrap_or("")`; re-requests spread the original args, so both sides see the same string.
6. **Selection never truncated.** `buildSelectionRequest` assigns `selection: input.selection`; `extractParagraphContext` slices `[from,to)`; the Rust side passes `selection` through unchanged (the diff does not touch `prompt.rs`). Test `6,000자 선택 요청의 selection 은 원문과 같다` passed.
7. **Prompt text out of argv.** Confirmed by the grep above and by the 13-element snapshots for both providers.
8. **Doc claims vs code.** Numbers 6,000 / 12,000 / 12 / 180 / 108 / 113 s agree across code, fixture, CHANGELOG, USER_GUIDE and acceptance.md. Drift is listed in F1-F4, F10.

## Findings (structured defect list)

No blocking findings. All findings below are optional per the consumption discipline (none affects correctness of a requirement the SPEC states).

- F1 [Low] [optional] confidence High — `.moai/specs/SPEC-AI-013-long-selection/progress.md:61` — AC-AI13-006 row still says "97s 백스톱" (the pre-D6 value 92+5); the code, test and acceptance.md use 113 s. Required fix: change 97s to 113s (108+5) in that row.
- F2 [Low] [optional] confidence High — `.moai/specs/SPEC-AI-013-long-selection/spec.md:4,57` — D5 refers to "v0.3.0 조정 전 값" but frontmatter `version` is still "0.2.1" and HISTORY has no row for the D6 coefficient change; `acceptance.md:4` and `plan.md:4` still say `status: draft` while spec.md says `implemented`. Required fix: add a HISTORY row (and bump version) for the D6 adjustment, or reword D5; frontmatter corrections go through manager-spec per the ownership rules.
- F3 [Low] [optional] confidence High — `src/components/editor/extensions/ai-selection-toolbar.ts:246,258` — comments still describe "삽입 전용 구간(2,001~4,000자)" and "2,000/4,000 임계". The code derives the numbers from constants, so behavior is correct; only the comments are stale. Required fix: update the two comments to 6,001~12,000자 / 6,000/12,000.
- F4 [Low] [optional] confidence High (doc), Medium (latent) — `CHANGELOG.md:8` (last sentence) — claims that an `is_error:true` result line leaves only 「아래에 삽입」 because `completion` is `cutoff`. That holds only when `max_tokens` was seen (the forced capture). For other API errors that still produce a `result` line, `decide_outcome` (claude_cli.rs:218-237) returns Done, `completion` is `unknown`, and for selections ≤ 2,000 chars 「바꾸기」 stays available with the error text as the replacement (REQ-AI13-014 keeps that behavior). The latent behavior is pre-existing and explicitly out of scope. Required fix: narrow the CHANGELOG sentence to the `max_tokens` case; track the latent issue as a follow-up (treat `is_error:true` as an error in `parse_final_result`, stream.rs:65-75).
- F5 [Low] [optional] confidence High — `src-tauri/src/ai/claude_cli.rs:176` (and test hunks near :442, :449) — new code is not rustfmt-clean (e.g. the `spawn_stdin_writer` signature exceeds the line width). CI does not run rustfmt and the baseline already has diffs in untouched files, so this is cosmetic. Required fix: run `rustfmt` on the touched files if the project wants it, otherwise ignore.
- F6 [Low] [optional] confidence Medium — `src-tauri/src/ai/claude_cli.rs:306,337` — the wiring of `CompletionTracker` into `relay_process` is not covered by any test (the tracker and `DonePayload` are tested separately, but deleting `completion.observe(&line)` would keep every test green). codex got a pure `codex_done_payload`; claude builds the payload inline. Required fix: extract a small pure function that folds a line iterator into a `Completion` (or a `claude_done_payload`) and test it with the fixtures, only if the team wants the guard.
- F7 [Low] [optional] confidence Medium — `src-tauri/src/ai/claude_cli.rs:153-168` — `system-prompt.txt` stays in `<app_data>/ai-prompt/` after the request, with default permissions (0644 on unix), and may hold the user's direct-input instruction. Required fix (optional hardening): create with mode 0600 and/or remove after the child starts; not required by the SPEC (assumption A2 accepts the leftover).
- F8 [Low] [optional] confidence Medium — `src/styles/mdedit-components.css:487-488` — sync added a rule to a file that `progress.md §E.2` says card t7 owns; likely a trivial merge conflict, not a behavior risk. Required fix: none now; resolve at merge time.
- F9 [Info] [optional] confidence Medium — latency margin: M1 measured codex polish at 75.5 s (6,000 chars, limit 108 s, margin 43%) and 151.7 s (12,000 chars, limit 180 s, margin 16%). Transform presets at 12,000 chars (the only presets reachable there) were never measured, so the claim that their output is shorter and therefore faster is an assumption. Required fix: none; observe during AC-013.
- F10 [Info] [optional] confidence High — `docs/USER_GUIDE.md:247` — the guide does not say that codex never confirms completion, so with codex every selection above 2,000 chars is insert-only even for 다듬기 in the 2,001-6,000 range that the same paragraph calls usable; the table row at line 244 still describes 짧게 줄이기 as in-place replace. Required fix: add one sentence naming codex (or "when the tool does not report completion").
- F11 [Info] [optional] confidence Low — `src/components/editor/extensions/ai-suggestion-card.ts:1390` — the completion gate lives only in rendering; `applyActiveCard` does not re-check. I found no other caller, so no reachable bypass. Speculative hardening; not recommended (simplicity).
- F12 [Info] [optional] confidence Medium — `src/components/editor/extensions/ai-selection-toolbar.ts:914` — 「바꾸기」 deletes the sentence-boundary-expanded range while the gate measures the sent selection (D4 documents this). A 1,990-char selection can therefore replace a longer expanded span when completion is `unknown`. Pre-existing design, accepted in D4.

## Gaps (not observed by me)

- AC-AI13-013 (macOS real run) and AC-AI13-014 (Windows `.cmd` real run): not performed; Windows cannot be exercised here. `--system-prompt-file` and stdin behavior with `claude.cmd` / `codex.cmd` rest on Rust's batch-file argument handling only.
- Full `cargo test`, full `vitest`, `tsc --noEmit`, `cargo clippy`, and any coverage measurement (the 85% Craft threshold): not run, per the instruction to avoid heavy runs. The Craft verdict is therefore PASS with the coverage sub-criterion UNVERIFIED.
- AC-AI13-007 boundary tests were read but not individually re-run.
- CI does not run `cargo test` (release.yml comment), so the Rust evidence is local-only: the run-phase log in progress.md plus my targeted re-run of 11 tests.
- A Windows user whose profile path contains characters that Rust rejects in batch-file arguments (for example `%` or `&`) could fail to spawn through the `.cmd` shim, because the system-prompt file path is now an argument; unobserved.

## Residual risk

- codex 6,000-char polish has a 43% margin and 12,000-char runs a 16% margin against the 180 s cap; a slow account or the card-t6 reasoning change can still hit the timeout. The D6 one-time coefficient adjustment is already spent.
- The CHANGELOG and USER_GUIDE promise behavior (Replace hidden when unconfirmed) that depends on two real CLIs; a CLI update that renames `stop_reason` or changes `message_delta` would silently turn claude into `unknown` (safe direction: Replace is hidden above 2,000 chars, but the feature degrades).
- The SPEC must remain `implemented` until the two manual ACs are recorded; promoting it to `completed` earlier would be an unobserved completion claim.

## Recommendations

1. Merge is acceptable; do not close the SPEC to `completed` until AC-013 and AC-014 are recorded in progress.md.
2. Fix the cheap documentation drifts in one pass (F1, F2, F3, F4, F10); none needs a code change.
3. Optionally add the small claude completion-fold test (F6) and tighten the prompt-file permission (F7).
4. Track the `is_error:true` handling in `parse_final_result` as a separate follow-up card (F4).
