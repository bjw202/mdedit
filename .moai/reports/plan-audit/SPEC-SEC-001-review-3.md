# SPEC Review Report: SPEC-SEC-001
Iteration: 3/3 (final)
Verdict: PASS (no blocking defect; optional residuals only)
Overall Score: 0.91 (harmonic mean of Clarity 0.90 / Completeness 0.95 / Testability 0.88 / Traceability 0.92; Tier M threshold 0.80). Previous: 0.84 -> no score regression (no STOP signal).

Reasoning context ignored per M1 Context Isolation. progress.md's revision account was treated as a claim to check, not as evidence. Artifacts read: spec.md (v0.2.1), plan.md, acceptance.md, progress.md (Tier M). This is a delta re-audit scoped to the review-2 defect list plus a check for new defects introduced by the v0.2.1 edit. Verification ran against worktree HEAD dd5336e, the real tauri-build 2.5.6 / tauri-utils 2.8.3 sources in ~/.cargo/registry, and `moai spec lint`. No cross-model backend (audit_multi/codex/glm) was invoked: the project audit_model setting was not provided to this run, so this is a Claude-only verdict.

## Must-Pass Results
- [PASS] MP-1 REQ numbering: REQ-SEC001-001..009 sequential, no gaps or duplicates (spec.md:L47, L51, L55, L59, L63, L67, L71, L75, L79). Layer: requirement layer (spec.md).
- [PASS] MP-2 GEARS: judged against the 9 REQ entries in spec.md only (the Given/When/Then entries in acceptance.md were graded under Group 4, not here). All 9 carry a `shall` clause: Ubiquitous L49/53/57/65/69/81, Event-driven L61/73, Where L77. Subject "구현자" (REQ-007/008) is an agent noun and the clause shape is valid GEARS; style residue is recorded as D8 (optional).
- [PASS] MP-3 frontmatter: all 12 fields present with correct types (spec.md:L2-L13: id, title, version "0.2.1" quoted, status draft, created/updated 2026-11-09, author, priority High, phase "v0.20.0 target" (release label, not a lifecycle token), module "src-tauri/", lifecycle spec-anchored, tags string) plus optional `tier: M`. `moai spec lint .moai/specs/SPEC-SEC-001-app-command-acl/spec.md` -> "No findings -- all SPEC documents are valid".
- [N/A] MP-4 language neutrality: single-stack Rust/Tauri SPEC.
- [PASS] MP-5 D7 cross-SPEC: referenced IDs are SPEC-SEC-001 (self), SPEC-PREVIEW-018 (`.moai/specs/SPEC-PREVIEW-018-html-preview-zoom/spec.md` -> `status: implemented`, not retired/superseded/archived) and SPEC-PREVIEW-019 (no directory: `ls .moai/specs | grep -c PREVIEW-019` = 0; explicitly a future SPEC, spec.md:L39/L102 -> SHOULD-level note only). No BLOCKING finding.
- [PASS] MP-6 D8 cross-platform: `grep -rn syscall` over the SPEC dir -> no match (exit 1). Auto-PASS.
- [PASS] MP-7 clarification gate: `grep -rn "NEEDS CLARIFICATION"` over the SPEC dir -> no match (exit 1); plan.md exists, no research.md at Tier M.

## Category Scores
| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.90 | 0.75-1.0 | Count (26/26) consistent across spec.md:L33, plan.md:L7/L10, acceptance.md. REQ-004 (L61) now hedges the srcdoc/null part and points to R-6. Residual: spec.md:L37 still states srcdoc denial as settled (D9 residual). |
| Completeness | 0.95 | 1.0 band, minus rounding | HISTORY L19, Overview L26, Requirements L45, 5 `### Out of Scope --` H3 headings (L85/90/95/100/105) each with 2 `-` bullets, Risks L110, References L122. `moai spec lint` clean. progress.md "Resolved Decisions" still "(없음)" (L22), trivial. |
| Testability | 0.88 | 0.75-1.0 | AC-004's judge now uses the correct key and is sound (N1 fixed, verified). AC-007 judge now covers shell and dialog and is discriminating: current `main.json` returns 5 for `grep -cE '"(shell\|dialog):allow-'` (3 dialog + 2 shell), so it is RED before and 0 after. AC-006(b) explicitly marked reference-only. Residual: AC-003 node line is non-discriminating but supplementary (the Rust test carries the verdict). |
| Traceability | 0.92 | 0.75-1.0 | Table acceptance.md:L7-L17: REQ-001..009 all mapped; AC-001..008 (L21/30/35/41/48/54/60/68) and M-1..M-3 (L78/83/89) all appear; AC headings' REQ tags match the table; no orphan AC, no uncovered REQ. REQ-001's "error propagation" clause has text (plan B-7) but no mechanical judge (optional, carried). |

Budget: REQ 9 (Tier M ceiling 16), AC 8 + manual 3 = 11 (ceiling 16). Within budget. The edit did not add or renumber any REQ or AC.

## Independent verification of the delta (not taken from progress.md)
- N1 RESOLVED in all places. `grep -rn '__app__'` over the SPEC dir hits only acceptance.md:L42, where it appears inside a note saying `__app__` is the tauri-build internal package name and not a JSON key (correct). `grep -rn '__app-acl__'` hits acceptance.md:L42 (prose), L45 (node command `['__app-acl__']`), L46 (RED clause), plan.md:L8 (prose); no stale `__app__` remains. Sources: `tauri-utils-2.8.3/src/acl/mod.rs:50` is `pub const APP_ACL_KEY: &str = "__app-acl__";`. `tauri-build-2.5.6/src/acl.rs:272` has `let pkg_name = "__app__";` (local only) and `acl.rs:412` has `acl_manifests.insert(APP_ACL_KEY.into(), app_acl.manifest)`. `save_acl_manifests`/`save_capabilities` write to `CAPABILITIES_SCHEMA_FOLDER_PATH` (acl.rs:117-138). `main.json` identifier is `main-capability`, so the `find(x=>x.identifier==='main-capability')` lookup is right. The node command now indexes the right key. Not executed end to end because `src-tauri/gen/schemas/` does not exist before a build; its logic was verified against the sources instead (this is a Gap, see below).
- N2 RESOLVED. spec.md:L43 now says "구현 마일스톤은 M1 하나(M0은 실기기 기준선, M2는 실기기 검증, M3은 선택 정리)이고 파일은 10개 미만이므로 Tier L ... 아니다". It matches plan.md §C (M0-M3) and the Tier L conclusion.
- N4 RESOLVED. acceptance.md:L58 says (b) is "판정에는 쓰지 않으며 (a)만 PASS/FAIL 근거다".
- N5 RESOLVED. acceptance.md:L65 `grep -cE '"(shell|dialog):allow-' src-tauri/capabilities/main.json` -> PASS = 0. Verified on the current tree: 5 matches (RED before), and the same line keeps `opener:allow-open-path` >= 1. The Then clause (L64) and REQ-008 candidate list (spec.md:L77) agree.
- D9 PARTIALLY RESOLVED. REQ-004 (spec.md:L61) now reads "그 분류는 실기기 전에는 가설이다(R-6, M-2 추가 항목이 증거)". M-2 (acceptance.md:L87) now states the non-denial outcome: not a FAIL of SPEC-SEC-001, report to the coordinator, request PREVIEW-019 redesign. Not done: spec.md:L37 ("`srcdoc` 불투명 출처 ... 모두 ACL 단계에서 거부된다") is still unhedged. See D9 below.
- D12 RESOLVED. spec.md R-2 (L115) says "결정: `.gitignore`에 추가 ... (plan §B-6)"; plan.md B-6 (L20) "(결정)"; plan.md §D-1 (L62) "기본은 .gitignore(§B-6 결정)". The three places now agree. progress.md "Resolved Decisions" is still empty (trivial).
- N3 NOT CHANGED by the author, with a stated reason (progress.md:L17: the Rust test `capability_covers_every_app_command` is the RED evidence). The reasoning holds because AC-003's Then is judged by the Rust tests; the node line is a supplementary check. Left as optional.
- D8 NOT CHANGED by the author, with a stated reason ("구현자 행위 요구"). REQ-001 (L49) still carries the `try_build` + `AppManifest::commands` call chain; REQ-008 heading (L75) still says "Should" while the body says shall.
- New-defect scan on the edit: no new REQ/AC; traceability table unchanged and still matches; plan.md B-8 (build.rs header comment rewording) is consistent with AC-001's first Given; AC-007's now-stricter final state is consistent with REQ-008's revert-on-denial exception; Out of Scope contains no contradiction with the added text; no `syscall`, no `NEEDS CLARIFICATION`. One stale line found in progress.md (S1 below).

## Defects Found (structured defect-list)
No must-pass failure and no blocking defect. All items below are optional.

D9. SRCDOC-UNHEDGED-L37 (residual) — spec.md:L37 vs spec.md:L61 / L117 (R-6) — The "해결" bullet still asserts that `srcdoc` opaque-origin frames' commands "모두 ACL 단계에서 거부된다", while REQ-004 and R-6 call this an unverified hypothesis. Internal inconsistency, but the normative layer (REQ-004, M-2) is now correct and the SPEC's closing criteria do not depend on L37. — Severity: minor — Class: optional — Required fix: in L37 change to "`asset://` iframe·기타 원격 출처 프레임은 ACL 단계에서 거부된다(`srcdoc` 불투명 출처는 가설, R-6)".

D8. REQ-STYLE (residual, carried from review-1 and review-2) — spec.md:L49, L75 (also L53/L69/L73 name `APP_COMMANDS`/paths or use "구현자") — REQ-001 parenthetical names an implementation call chain; REQ-008 heading says "Should" next to a `shall` body. The author declined on stated grounds. Not a MP-2 failure. — Severity: minor — Class: optional — Required fix: move the `try_build`/`AppManifest::commands` parenthetical to plan §B (already there); change the REQ-008 heading to "(Where)".

N3. AC003-NODE-NON-DISCRIMINATING (carried from review-2) — acceptance.md:L39 — The node line passes on the unmodified tree (it only checks `remote` undefined and `windows == ["main"]`). Supplementary; the Rust tests are the judge. — Severity: minor — Class: optional — Required fix: label it "불변 확인(보조)" or add a `startsWith('allow-')` count of 26.

S1. PROGRESS-STALE-COUNT — progress.md:L11 — Phase Notes still say "프런트 리터럴 호출 24개" although later history (L15) and spec.md/plan.md/acceptance.md all say 26. Historical note, no normative impact. — Severity: minor — Class: optional — Required fix: append "(1차 감사에서 26으로 정정)" or edit to 26.

D10. NO-MECHANICAL-JUDGE-FOR-ERROR-PROPAGATION (carried) — spec.md:L49 / plan.md:L21 — "try_build's Err fails the build" has no check. Text-only; low impact. — Severity: minor — Class: optional — Required fix: none required; optionally add one sentence to AC-001 that a deliberately malformed command name makes `cargo build` fail.

## Gaps (not observed)
- The AC-004 node command was not executed against real `acl-manifests.json`/`capabilities.json` output because no build exists in this plan-phase tree; its key, folder, shape, and `main-capability` identifier were verified against tauri-build/tauri-utils sources and `main.json`. M1 step 4b is the runtime confirmation.
- No tauri build, `cargo test`, or Windows/macOS probe was run (plan-phase; run-phase and M-1..M-3 own those). The core security claim remains a source-based hypothesis, which the SPEC says openly (spec.md:L32, R-6, REQ-007).

## Regression Check (Iteration 3)
Defects from iteration 2:
- N1 (blocking): RESOLVED — all three sites changed, verified against APP_ACL_KEY in source.
- N2: RESOLVED. N4: RESOLVED. N5: RESOLVED. D12: RESOLVED.
- D9: PARTIAL -> REQ-004 and M-2 fixed; spec.md:L37 residual (optional).
- D8: UNRESOLVED by author decision (optional; appeared in review-1, review-2, review-3 unchanged in part). Stagnation note: it is non-blocking style residue, not a misunderstanding, since the author gave a reason; it does not affect the verdict.
- N3: UNRESOLVED by author decision (optional; second iteration), reasoned.
- D10: unchanged, optional.
Regression from the revision: none. Score 0.84 -> 0.91, no STOP.

## Recommendation
PASS at Tier M (0.91 >= 0.80). Evidence per must-pass: MP-1 sequential REQ-001..009 (spec.md:L47-L79); MP-2 all 9 REQs have `shall` clauses; MP-3 12 fields + `moai spec lint` clean; MP-4 N/A; MP-5 PREVIEW-018 is `implemented`, PREVIEW-019 is future; MP-6 no `syscall`; MP-7 no clarification marker. The sole blocking defect from iteration 2 (N1) is fixed everywhere and verified against upstream sources. The remaining optional items (D9 at L37, D8, N3, S1, D10) may be fixed in one pass by manager-spec before run, but they should not gate run entry; applying them is optional and must not expand scope. Implementation Kickoff Approval (the human gate) remains required before run-phase entry; this PASS never substitutes for it.
