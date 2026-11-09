# SPEC Review Report: SPEC-SEC-001
Iteration: 2/3
Verdict: FAIL (one blocking defect remains; single-token fix)
Overall Score: 0.84 (harmonic mean of Clarity 0.85 / Completeness 0.95 / Testability 0.70 / Traceability 0.90; Tier M threshold 0.80). Previous: 0.69 -> no score regression (no STOP signal).

Reasoning context ignored per M1 Context Isolation (the author's account in progress.md "Plan-audit History" was treated as a claim to check, not as evidence). Artifacts read: spec.md (v0.2.0), plan.md, acceptance.md, progress.md (Tier M). Verification was run against the worktree (commit 339f4f5), the real tauri 2.10.3 / tauri-build 2.5.6 / tauri-utils 2.8.3 sources in ~/.cargo/registry (versions confirmed from src-tauri/Cargo.lock), and `moai spec lint`.

## Must-Pass Results
- [PASS] MP-1 REQ numbering: `grep -cE '^### REQ-SEC001-'` = 9; REQ-SEC001-001..009 sequential, no gaps/duplicates (spec.md:L47-L79). Layer: requirement layer (spec.md).
- [PASS] MP-2 GEARS: judged against the 9 REQ entries in spec.md only (acceptance.md Given/When/Then judged under Group 4, not here). All 9 carry a `shall` clause (Ubiquitous L49/53/57/65/69/81, Event-driven L61/73, Where L77). Style residue recorded as D8 (optional).
- [PASS] MP-3 frontmatter: all 12 fields present with correct types (spec.md:L2-L13); `module: "src-tauri/"` (L11, D11 fixed); `phase: "v0.20.0 target"` is a release label; `tier: M` valid. `moai spec lint spec.md` -> "No findings -- all SPEC documents are valid".
- [N/A] MP-4 language neutrality: single-stack Rust/Tauri SPEC.
- [PASS] MP-5 D7 cross-SPEC: references are SPEC-PREVIEW-018 (`.moai/specs/SPEC-PREVIEW-018-html-preview-zoom/spec.md` status: implemented, not retired/superseded/archived) and SPEC-PREVIEW-019 (no directory yet; explicitly a future SPEC, spec.md:L39/L102 -> SHOULD-level only). No BLOCKING finding.
- [PASS] MP-6 D8 cross-platform: `grep -rn syscall` over the SPEC dir -> no match (exit 1). Auto-PASS.
- [PASS] MP-7 clarification gate: `grep -rn "NEEDS CLARIFICATION"` over the SPEC dir -> no match (exit 1); plan.md exists, no research.md at Tier M.

Verdict is FAIL solely because of blocking defect N1 (below). No must-pass criterion failed.

## Category Scores
| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.85 | between 0.75 and 1.0 | The 24/26 error is gone (verified, D1). Residual: spec.md:L37 and REQ-SEC001-004 (L61) still state srcdoc/opaque-origin denial as settled while R-6 (L117) says it is an unverified hypothesis (D9 partial); R-2 "미결정" (L115) vs plan.md B-6 "(결정)" (D12 partial). |
| Completeness | 0.95 | 1.0 band, minus rounding | All sections present (HISTORY L19, Overview L26, Requirements L45, Out of Scope L83-L108 with `-` bullets under all 5 headings, Risks L110, References L122). `moai spec lint` clean. Frontmatter complete. |
| Testability | 0.70 | 0.50-0.75 | AC-004's only automated judge cannot pass on a correct implementation (wrong manifest key, N1). AC-001, AC-002, AC-005, AC-007 judges verified sound. AC-006(b) is "record whichever" (D-minor). |
| Traceability | 0.90 | 0.75-1.0 | Table at acceptance.md:L7-L17: REQ-001..009 all mapped; AC-001..008 and M-1..M-3 all appear; no orphan AC, no uncovered REQ. REQ-006 now maps to AC-002 + AC-006 and AC-006 supplies the capability-direction RED step (D7 fixed). REQ-001's "error propagation" clause (spec.md:L49) has no judge (D10 residual, optional). |

Totals: REQ 9 (ceiling 16), AC 8 + manual 3 = 11 (ceiling 16) -> within Tier M budget (`grep -c '^### AC-'` = 8, `'^### M-'` = 3).

## Independent verification of the prior defects (not taken from progress.md)
- D1 frontend count: RESOLVED. `invoke(<..>)?\(\s*['"][a-z0-9_]+['"]` over non-test src yields 26 unique names; the `generate_handler!` block (lib.rs:78-105) yields 26; `diff` of the two sorted sets is empty (IDENTICAL). The digit-blind `[a-z_]+` form yields 24 (reproduces the original error). The only other `invoke(` hit is `aiEventRouter.ts:51 invoke(sub.handlers)`, a local callback, not a Tauri call. spec.md:L33, plan.md:L10, acceptance.md:L51 are all corrected to 26 / `[a-z0-9_]+`.
- D2 AC-001: RESOLVED. I executed the three greps. On the current tree (comment lines filtered, whitespace stripped): `tauri_build::try_build` = 0, `app_manifest(` = 0, `tauri_build::build()` = 1 (i.e. correctly RED before the change, and the L2 comment no longer false-matches because comment lines are filtered). On a simulated post-change build.rs with a rustfmt-style multi-line `try_build(...Attributes::new().app_manifest(...))` plus a `// tauri_build::build()` comment: 1 / 1 / 0 (correctly GREEN). The judge is logically sound. (Rewording the L2 comment in M1 is now redundant but harmless.)
- D3 AC-007: RESOLVED. `grep -rnE "from ['\"]@tauri-apps/plugin-(shell|dialog)" src --exclude-dir=test` -> no output, exit 1 on the unmodified tree. The only `plugin-shell|plugin-dialog` hits in src are the two regression-guard test files, so no dynamic-import blind spot either. Then-clause is a single end state with a defined revert exception.
- D4 AC-004: NOT FULLY RESOLVED -> N1 below. The folder is right (`CAPABILITIES_SCHEMA_FOLDER_PATH = "gen/schemas"`, tauri-utils schema.rs:28, relative to the build-script cwd = src-tauri), the file names are right (`acl-manifests.json`, `capabilities.json`, tauri-utils mod.rs:52/54), the manifest JSON shape is right (`Manifest { permissions: BTreeMap<String, Permission> }`, unprefixed identifiers; `capabilities.json` is a `BTreeMap<String, Capability>` keyed by identifier; `Capability.remote` is `skip_serializing_if = "Option::is_none"`, so `!c.remote` is correct). The manifest KEY is wrong.
- D5 Out of Scope: RESOLVED. Each of the 5 `### Out of Scope -- <topic>` headings (spec.md:L85, L90, L95, L100, L105) now has two `-` bullets; `moai spec lint` -> no findings.
- D6 no Windows device: RESOLVED. R-7 (spec.md:L118), plan.md:L65 (D-4) and acceptance.md:L76 agree: Windows rows become "미검증 갭", SPEC closes at `implemented`, not `completed`; macOS proceeds independently.
- D7 REQ-006 mapping / capability-direction RED: RESOLVED. AC-006 (acceptance.md:L58) requires deleting `allow-read-file` and showing `capability_covers_every_app_command` fail. (Residual: sub-step (b) is "record whichever" -- minor, below.)
- D8 REQ style: PARTIAL (optional). REQ-001 still carries the `try_build` + `AppManifest::commands` call chain in a parenthetical (L49); REQ-002/006/009 name `APP_COMMANDS`, `src-tauri/app_commands.rs`; REQ-007 subject is still "구현자" (a person, L73); REQ-008 heading still says "Should" while the body says shall (L75). REQ-008's end state is now single (remove, revert-with-reason on failure) -- the vacuity is fixed.
- D9 srcdoc claim: PARTIAL (optional). R-6 (L117) and M-2's extra srcdoc item (acceptance.md:L87) were added, but spec.md:L37 ("`srcdoc` 불투명 출처 ... 모두 ACL 단계에서 거부된다") and REQ-SEC001-004 (L61, "불투명 출처(`null`) ... 거부한다") are unhedged, contradicting R-6 within the same document; M-2's extra item does not state the FAIL outcome.
- D10 build error propagation: RESOLVED in text (REQ-001 parenthetical L49, plan.md B-7 L21, AC-001 `cargo build` exit 0 + duplicate-identifier check L28). No mechanical judge for "Err is propagated" (optional).
- D11 module: RESOLVED (`"src-tauri/"`).
- D12 open decisions: PARTIAL (optional). plan.md B-6 now says "(결정)" and defaults to `.gitignore`, but spec.md R-2 (L115) still says "(미결정 -- plan §D)", plan.md §D-1 (L62) still lists it open, and progress.md "Resolved Decisions" is still "(없음)" (L20). Self-inconsistent but harmless: the default is stated.

## Defects Found (structured defect-list)
N1. AC004-WRONG-MANIFEST-KEY — acceptance.md:L42, L45 and plan.md:L8 — The AC-004 judge indexes `acl-manifests.json` with `['__app__']`, and the text states "앱 키 `__app__`". That is the wrong key. `__app__` is only the local `pkg_name` passed to `define_permissions` (tauri-build-2.5.6/src/acl.rs:272); the manifest is inserted into `acl_manifests` under `APP_ACL_KEY`, which is `"__app-acl__"` (tauri-utils-2.8.3/src/acl/mod.rs:50; insert at tauri-build acl.rs:~410 `acl_manifests.insert(APP_ACL_KEY.into(), app_acl.manifest)`; same constant used in `validate_capabilities` acl.rs:356/372). Review-1 repeated the `__app__` spelling and the author copied it; I re-derived it from source this time. Consequence: `m` is `undefined`, `Object.keys(m.permissions)` throws `TypeError`, exit code 1 -- the command FAILS on a fully correct implementation, and it also fails on the pre-change tree, so the "RED evidence" Then-clause (L46) is vacuous (it cannot distinguish before from after). REQ-SEC001-004 is the headline requirement and AC-004 is its only automated check. The "파일 구조가 다르면 M1에서 보정" escape (L45, plan M1 step 4b) mitigates but does not excuse a known-wrong judge: the SPEC is supposed to give an executable pass/fail now (iteration-1 D3 was held to the same standard). — Severity: major — Class: blocking — Required fix: replace `__app__` with `__app-acl__` at acceptance.md L42 ("앱 키 `__app-acl__`") and in the L45 node command (`...['__app-acl__']`), and at plan.md L8 ("앱 키(`__app-acl__`)는 capability에서 접두사 없이 쓴다"). Keep the rest of the command unchanged (folder `gen/schemas`, `allow-` filter -> 26, `main-capability`, `!c.remote`, `c.permissions.includes('allow-read-file')` all verified correct against sources). Optionally keep the M1-4b "confirm after first build" note, now as confirmation rather than a hedge.

D8. REQ-STYLE (residual) — spec.md:L49, L53, L69, L73, L75, L81 — see above. — Severity: minor — Class: optional — Required fix: move the `try_build`/`AppManifest::commands` call chain out of REQ-001 (it is already in plan B); drop "Should" from the REQ-008 heading; optionally restate REQ-007 with the system as subject.

D9. SRCDOC-UNHEDGED (residual) — spec.md:L37, L61 vs L117 (R-6) — REQ-004 and the "해결" bullet assert srcdoc/opaque-origin denial as fact; R-6 says it depends on how WebView2 attributes the origin and is unverified. M-2's extra item (acceptance.md:L87) says "거부를 확인한다" but not what happens if it is not denied. — Severity: minor — Class: optional — Required fix: in L37 and REQ-004 mark the `srcdoc`/`null` part as "소스상 추정, M-2 추가 항목에서 확정", and in M-2 state the outcome of non-denial (e.g. "거부되지 않으면 SPEC-PREVIEW-019 전제 미충족으로 코디네이터에 보고, 이 SPEC의 asset 출처 거부는 별개로 판정").

D12. DECISION-STATE-INCONSISTENT (residual) — spec.md:L115 (R-2), plan.md:L20 vs L62, progress.md:L20 — `.gitignore` handling is "결정" in one place and "미결정"/open in two others. — Severity: minor — Class: optional — Required fix: make R-2 read "plan B-6의 기본(.gitignore)을 따른다", and either record it under progress.md "Resolved Decisions" or leave plan §D-1 as the single open item.

N2. TIER-MILESTONE-CLAIM — spec.md:L43 — "마일스톤은 3개 미만" but plan.md §C defines M0, M1, M2, M3 (four). The Tier conclusion is still right (files < 10, so not Tier L), but the stated fact is wrong. — Severity: minor — Class: optional — Required fix: "마일스톤 4개(M0-M3)이나 파일이 10개 미만이므로 Tier L이 아니다."

N3. AC003-NODE-NON-DISCRIMINATING — acceptance.md:L39 — I executed the node command on the unmodified tree: exit 0. It only checks `remote === undefined` and `windows == ["main"]`, which are already true before the change, so it cannot show RED and does not check the "26 allow-* permissions" half of the Then. The real judge is the cargo test `capability_covers_every_app_command`, which is fine; the node line is supplementary. — Severity: minor — Class: optional — Required fix: label the node command as "remote/windows 불변 확인(보조)" or add `c.permissions.filter(p=>typeof p==='string'&&p.startsWith('allow-')).length===26` so it discriminates.

N4. AC006-SUBSTEP-B-NON-BINARY — acceptance.md:L58 — "(b) ... 실패하거나 통과하는지 기록" has two accepted outcomes, i.e. no PASS/FAIL. Informational only (the verdict rests on (a)). — Severity: minor — Class: optional — Required fix: mark (b) explicitly as "관찰 기록, 판정 아님".

N5. AC007-DIALOG-NOT-JUDGED — acceptance.md:L64-L65 — The Then says `dialog:allow-*` must be absent, but the command only checks `"shell:allow-`. — Severity: minor — Class: optional — Required fix: add `grep -cE '"dialog:allow-' src-tauri/capabilities/main.json` -> PASS = 0 (same revert exception).

## Regression Check (Iteration 2)
Defects from iteration 1:
- D1: RESOLVED -- 26 == 26 set-equal, verified by command.
- D2: RESOLVED -- judge run on current and simulated trees, behaves correctly.
- D3: RESOLVED -- command exits 1 on the unmodified tree.
- D4: UNRESOLVED (partially) -- folder, filenames and JSON shape correct; manifest key wrong (N1).
- D5: RESOLVED -- lint clean, bullets present.
- D6: RESOLVED. D7: RESOLVED. D10: RESOLVED (text). D11: RESOLVED.
- D8, D9, D12: PARTIAL (optional, residuals restated above).
No iteration-2 regressions introduced by the revision except N1's carry-over (which was an author-copied error from the iteration-1 report) and the minor items N2-N5. REQ/AC counts are within the Tier M ceiling (9 / 11 vs 16 / 16); the traceability table still matches the revised REQs; R-6/R-7 are consistent with acceptance M-1/M-2 and plan D-4.

## Recommendation
FAIL on one blocking defect, with a score (0.84) already above the Tier M threshold of 0.80. The fix is three one-token edits and does not require restructuring:
1. N1 (blocking): `__app__` -> `__app-acl__` in acceptance.md L42, acceptance.md L45 (inside the node command) and plan.md L8. After that edit AC-004 is correct as written and the SPEC should PASS at iteration 3 without further changes.
2. Optional, ideally in the same pass because each is one line: D9 (hedge L37/REQ-004 and state M-2's non-denial outcome), D12 (reconcile R-2 with plan B-6), N5 (add the dialog grep), N3 (label or strengthen the AC-003 node line), N2 (milestone count), D8 (drop "Should" heading, move the call chain out of REQ-001).
Optional items do not by themselves justify a FAIL and must not be used to expand scope; only N1 gates the verdict.
Iteration 3 should be a delta check of N1 only (plus a re-run of `moai spec lint`).
