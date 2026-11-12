# Sync Audit Report — SPEC-AI-012 (card t4)

- SPEC: SPEC-AI-012 (prompt data envelope, instruction sandwich, conditional language clause, retry `additionalInstruction`)
- Branch / tree: WT-prompt-envelope, `.claude/worktrees/t4`, HEAD c69863d (diff scope `origin/main...HEAD`)
- Auditor: sync-auditor (independent; read-only on code)
- Overall Verdict: **PASS-WITH-DEBT** (no blocking findings; must-pass dimensions Functionality and Security both pass)

## Dimension Scores

| Dimension | Score | Verdict | Basis |
|-----------|-------|---------|-------|
| Functionality (40%) | 0.93 | PASS | 16/16 ACs satisfied by code reading plus targeted test runs; manual M-1..M-3 (real CLI output) not observed |
| Security (25%) | 0.85 | PASS | Envelope cannot be closed or forged by user text via the checked paths; residual risk R6 (error text in system prompt) and R2 (tag echo) unobserved |
| Craft (20%) | 0.88 | PASS | New tests assert independent invariants; two assertions weaker than the AC text; clippy and coverage not run by me |
| Consistency (15%) | 0.88 | PASS | Matches existing assembly and wiring patterns; minor frontmatter/CHANGELOG drift |
| **Overall (harmonic mean)** | **0.88** | | 4 / (1/0.93 + 1/0.85 + 1/0.88 + 1/0.88) = 0.884 |

## Mechanical evidence (this run, this tree)

| Command | Observed |
|---------|----------|
| `cargo test --manifest-path src-tauri/Cargo.toml --lib ai::` | `test result: ok. 241 passed; 0 failed; 0 ignored; 0 measured; 150 filtered out` (241 + 150 = 391, matching the CHANGELOG "lib 391") |
| `npx vitest run` on aiCardAdditionalInstruction, aiCardRetryLimit, aiCardRerequestProgress, aiSuggestionCardRerequest, aiSuggestionCard | `Test Files 5 passed (5)` / `Tests 110 passed (110)` |
| `npx eslint <5 changed ts files> --max-warnings 0` | exit 0, no output |
| `npx tsc --noEmit` | exit 0, no output |
| `git diff --stat origin/main -- src-tauri/src/ai/claude_cli.rs src-tauri/src/ai/codex_cli.rs` | empty output, exit 0 (AC-AI12-016) |
| MX tag counts | prompt.rs: ANCHOR 1 to 2 (limit 3), NOTE 6 (limit 10); ai-suggestion-card.ts: ANCHOR 5 and NOTE 15, both identical to origin/main (pre-existing, not introduced here) |

## AC verification (by code reading + the runs above)

| AC | Result | Evidence |
|----|--------|----------|
| 001 | PASS | `prompt.rs:380-394` builds `<tag>\n..\n</tag>` blocks in order, target always present; `envelope_basic_shape_*`, `empty_selection_*` |
| 002 | PASS | `scope_clause` `prompt.rs:292-300` uses tag names only (no `<`); test iterates the 6 features |
| 003 | PASS | selection placed only inside target block; test asserts count == 1 over `user_prompt` and absence from system prompt |
| 004 | PASS | selection pushed verbatim `prompt.rs:384`; `[뒤 문맥]` line test |
| 005/006 | PASS | `envelope_tags` `prompt.rs:259-288`, seed-suffix, single closing tag in `system + "\n\n" + user` |
| 007 | PASS (test weaker than AC text, see F4) | six cases implemented; the function is fed all five user texts at `prompt.rs:369-378` |
| 008 | PASS | `recap_block` `prompt.rs:312-330`; fragment gated identically in system prompt and recap (`prompt.rs:358-362`) |
| 009 | PASS | single `LANGUAGE_CLAUSE` constant; old sentence absent |
| 010/011 | PASS | `추가 지시(재요청): ` line appended to both system prompt and recap; Custom keeps `지시: ...` |
| 012 | PASS | `additional_instruction_line` trims and filters empty |
| 013 | PASS | `ai_request` passes `additional_instruction` only in the `_ =>` inline arm (`mod.rs:164-173`); 5 literal snapshots pass; I also diffed old vs new `system_prompt()` task strings by reading origin/main source: identical for all 5 presets, Custom and COMMON order |
| 014 | PASS | two deserialize tests; `#[serde(default)]` |
| 015 | PASS | `fireReRequest` spreads `originalArgs`, then overrides; `request.args` never mutated (no accumulation); the 3 recovery sites pass `''`; list fallback unchanged; test file mocks `aiRequest` and asserts on the merged args (not tautological) |
| 016 | PASS | empty diff, exit 0 |

IPC drift check: `aiRequest` is `invoke('ai_request', { args })` (`ipc.ts:332-334`), no field whitelist; TS `additionalInstruction?` and Rust `additional_instruction` (camelCase, serde default) agree. `undefined` is dropped by JSON serialization, so the "blank" case equals the "absent" case. No other Rust caller of the inline builders exists besides `mod.rs`.

## Findings

- **F1** [Medium] [optional] `src-tauri/src/ai/prompt.rs:303-308, 396-403` and `src/components/editor/extensions/ai-suggestion-card.ts:1136,1153` — the mermaid parse error (`r.error.message` from the pele parser, `diagramRenderer.ts:188-190,225`) is passed unbounded as `추가 지시(재요청)` into the **system prompt**, outside the data envelope. That text can quote lines of the model's own diagram output, which in turn derives from document content (two-hop injection path). Spec risk R6 knowingly accepts this, so it is not a SPEC violation. Tag forging is still blocked because the additional instruction participates in the collision check. Required fix (if the debt is to be paid): cap the length and keep only the first line, or place the error text inside a data tag. Confidence: medium that a real exploit is reachable (no PoC run).
- **F2** [Low] [optional, recommended wording fix] `CHANGELOG.md` entry — "요청마다 다른 접미사가 붙는 태그 쌍(`<mdedit_…>`)" is inaccurate. Code and `no_collision_uses_default_names_deterministically` show the default names are used on every non-colliding request; a suffix appears only on collision (REQ-AI12-009). Required fix: reword to "충돌이 있을 때만 요청마다 다른 접미사".
- **F3** [Low] [optional] `CHANGELOG.md` — "AC-AI12-001~016(16건)은 모두 자동 테스트로 PASS" overstates: AC-016 is a `git diff` check and AC-013's second half is a code read. Also "시스템 프롬프트 반환값은 변경 전 리터럴 스냅샷과 바이트 동일" is backed by literals only for Shorten and Custom("x") (`prompt.rs:1163-1172`); the claim is true (I verified the other five by reading origin/main source) but the test evidence is narrower than the wording. Required fix: reword, or add literal snapshots for Polish/Outline/Table/Diagram.
- **F4** [Low] [optional] `src-tauri/src/ai/prompt.rs:1337-1352` — for AC-007 cases (e) and (f) the test asserts only "not the default name" and "closing tag appears once"; it does not call `assert_no_tag_name_in` over all five user texts as the AC states. Also `prompt.rs:1100-1110` builds its expectation from the functions under test (compositional, not literal). The implementation satisfies the AC by construction (`prompt.rs:369-378`). Required fix: add the missing assertion.
- **F5** [Low] [optional] R2 tag echo — nothing strips `<mdedit_…>` from model output (explicit Exclusion). For Table/Diagram a leaked tag would fail validation and trigger one auto-retry; for Polish/Outline/Shorten/Custom it would be inserted as text. Unobserved; manual M-1 is the only check and is PENDING.
- **F6** [Info] [optional] `plan.md` and `acceptance.md` frontmatter still read `status: draft` while `spec.md` is `implemented` (the docs commit left them untouched). Consistency drift only.
- **F7** [Info] [optional, uncertain] Collision detection is a lowercase substring match; zero-width-split or homoglyph spellings of the tag are not detected. They also would not equal the real tag literal, so I found no practical forge. Listed for completeness, not demonstrated.
- **F8** [Info] [optional] `spec.md` frontmatter uses `dependencies:` where the schema rule file names the optional field `depends_on:`; I did not verify whether this repo's lint cares.

No blocking findings.

## CHANGELOG claim check

| Claim | Result |
|-------|--------|
| Changed files list (7) | Confirmed by `git diff --stat` (4 source + 3 tests) |
| `claude_cli.rs`/`codex_cli.rs` unchanged, `git diff --stat origin/main` empty | Confirmed (run) |
| lib 391 passed | Consistent (241 passed + 150 filtered = 391 in my run); the full run itself not repeated |
| vitest 119 files / 2050 tests, typecheck 0, lint 0 | typecheck and lint of changed files re-run: exit 0. Full vitest count **not re-run** (instructed not to); taken from progress.md §E.2.2 |
| CI does not run `cargo test` | Confirmed: `.github/workflows/release.yml:11`, `frontend-gates.yml:4` |
| "요청마다 다른 접미사" | **Inaccurate** (F2) |
| "모두 자동 테스트로 PASS" | Overstated (F3) |
| Blank value == absent, byte-identical | Confirmed (`blank_additional_instruction_is_byte_identical_to_none`) |
| Manual M-1..M-3 pending | Consistent with progress.md |

## Could not verify

- Real claude/codex model behavior: tag echo (F5), language retention under translation, diagram retry quality (M-1..M-3 PENDING; no CLI run).
- Full `cargo test` and full vitest counts (not run, per instruction); `cargo clippy` and coverage were not run by me, so the "no new clippy warnings" and 85% coverage statements rest on progress.md only.
- Windows/macOS-specific behavior and Playwright E2E.
- Whether the pele parser message can actually embed document-derived text in practice (F1 reasoned from code, not reproduced).
- The `sync_commit_sha: pending-backfill` field remains unpopulated.

## Recommendations

1. Accept as PASS-WITH-DEBT; keep the SPEC at `implemented` until M-1 and M-2 are done by the user, then close.
2. Fix F2 and F3 wording in `CHANGELOG.md` (one commit, no code change).
3. Optionally add the missing assertion for F4 and decide whether to bound the retry error text (F1) in a follow-up card.
