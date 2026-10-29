# SPEC Review Report: SPEC-PREVIEW-017
Iteration: 2/3
Verdict: PASS
Overall Score: 0.93 (Tier M threshold 0.80; iter1 0.75 → iter2 0.93, no regression)

Reasoning context ignored per M1 Context Isolation (the coordinator's summary of the revision was not used as evidence; every claim below was re-read from the files). Scope: delta re-audit of review-1 D1-D5 plus touched lines, spot-check of D6-D11. Artifacts: spec.md v0.1.1, plan.md, acceptance.md, research.md, spec-compact.md, progress.md at worktree HEAD 4bef707 (SPEC dir untracked).

## Must-Pass Results
- [PASS] MP-1: REQ-PREVIEW017-001..008 unchanged and sequential (spec.md:L40,44,50,56,61,68,76,81).
- [PASS] MP-2 (requirement layer): every bullet is now an explicit GEARS clause — Ubiquitous "The ... shall" (e.g. L48, L53, L59, L72-74), Unwanted "shall not" (L52, L54, L58, L65, L71, L79), State-driven "While 라이트 테마 ... shall" (L84), Event-driven "When ... shall" (L85). Review-1 D9 trailing sentences removed.
- [PASS] MP-3: 12 canonical fields present, `version: "0.1.1"` quoted (L4), other fields unchanged (L2-13).
- [N/A] MP-4: single-project scope.
- [PASS] MP-5 D7: SPEC-PREVIEW-015/016 status `completed`; no BLOCKING.
- [PASS] MP-6 D8: no `syscall`.
- [PASS] MP-7: `grep -rn "NEEDS CLARIFICATION"` over the SPEC directory → no output. Decision recorded at progress.md:L20-22, plan.md:L34-35, spec.md:L84 and L107.

## Category Scores
| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 1.0 | 1.0 | Tone cap now scoped (spec.md:L48); hue rule numeric 36.9°-46.9° (L64); seam outcome fixed (L84). |
| Completeness | 1.0 | 1.0 | All sections present; amendment table is now unconditional (L105-110); new Out of Scope bullet (L128); 3 `### Out of Scope —` H3s. |
| Testability | 0.75 | 0.75 | Literal rgb expectations (acceptance.md:L20, L28, L86-87); bounded-marker greps (L41-42, L48). Remaining judgment: AC-004 export-side check is "code review evidence" (L48); AC-008 last bullet cites the wrong test file (N1). |
| Traceability | 1.0 | 1.0 | 1:1 table (spec.md:L90-99, acceptance.md:L5-14); every REQ bullet now has an assertion (REQ-005 hue → AC-005 L58; REQ-006 sync → AC-005 L60 + AC-006 L70; REQ-003 `!important` export → AC-003 L42; REQ-008 While clause → AC-008 L86). |

Overall = harmonic mean (1.0, 1.0, 0.75, 1.0) ≈ 0.93.

## Regression Check (review-1 defects)
- D1 MP7-CLARIFY — RESOLVED: no markers remain (grep output empty); option (a) recorded in spec.md:L84, L107; plan.md:L34; progress.md:L22.
- D2 AMEND-B-BRANCH — RESOLVED: option (b) appears only in research.md:L83 and L100 as rejected; grep for `(b)`/`--_bg` in spec/plan/acceptance/compact/progress finds only plan.md:L34 ("`--_bg`는 건드리지 않는다"). Amendment row is unconditional (spec.md:L107).
- D3 TEST-INVENTORY — RESOLVED: plan.md:L24, L32, L76, L89 cover `exportDiagram.test.ts:36-40,61,288`; verified against the file (`VAR_NAMES` at :37-40, mock at :61, guard at :288).
- D4 AC005-HUE — RESOLVED: REQ-005 L64-65 (hue 41.9°±5°, ≥3:1, not `#B78511`/`#96562F`/`#C08A28`); AC-005 L57-59. Candidate `#8A6410` hue 41.3° and 4.81:1 recomputed in iter1 — inside the range.
- D5 EXPORT-LITERAL-DRIFT — RESOLVED: REQ-006 L73-74; AC-005 L60 (`:root` name set = `PELE_THEME_VARS` set; verified today both are the same 23 names, so the guard holds once both add the token); AC-006 L66, L70 (empty-table path + fallback literal = CSS value).
- D6 — RESOLVED: BEGIN/END marker greps (acceptance.md:L41-42); `grep -c '!important' src/lib/export/exportUtils.ts` → `0` at HEAD, as claimed.
- D7 — RESOLVED: spec.md:L48; AC-002 L34 scoped to "작성자 스타일이 없는 이 문서".
- D8 — RESOLVED: spec.md:L106 locates the "23개" text correctly; 016 spec-compact.md is in the pointer scope (L110, plan.md:L92).
- D9 — RESOLVED (see MP-2).
- D10 — RESOLVED: literal `rgb(138, 100, 16)` with an explicit update rule (acceptance.md:L20, L28).
- D11 — RESOLVED: research.md:L44 (verified: the pele dist contains `fill="var(--_a)" fill-opacity="0.5"` exactly 7 times), L45, L90; acceptance.md:L95 edge case.
- D12 — not changed by design (it encodes user decision 3); remains optional and accepted.

## Defects Found
N1. AC008-CITATION — acceptance.md:L89 — says `src/test/export.test.ts` holds a "라이트 무테두리 단정". It does not: export.test.ts:161-174 asserts the `#FAF9F6` background in both themes and the dark border/radius only. The light `0px` border/radius assertion lives in `e2e/diagram-export-colors.spec.ts:161-162` (which acceptance.md:L98 already cites) — Severity: minor — Class: optional — Required fix: cite e2e/diagram-export-colors.spec.ts:161-162 for the light no-border part.
N2. RESEARCH-SMCIRC — research.md:L90 — "`sm-circ`·`fr-circ`는 플로차트 모양이 아니므로" is not established: they sit in the same pele alias array (`sw`) as flowchart extended shapes (`lin-cyl`, `curv-trap`, `notch-pent`, …). I did not check mermaid's flowchart shape docs, so this is a doubt, not a verified error. Scope is unaffected (user decision 1 limits start/end to stadium) — Severity: minor — Class: optional — Required fix: drop the clause or reword it as "범위 밖(사용자 결정 1)".
N3. AMEND-AC016-005 — spec.md:L107, plan.md:L92 — the REQ-PREVIEW016-005 light amendment names no pointer for AC-PREVIEW016-005, whose text says "라이트 테마에서는 카드가 없다" for the preview too — Severity: minor — Class: optional — Required fix: add AC-PREVIEW016-005 to the pointer list ("라이트 미리보기 바탕 #FAF9F6 허용, 테두리·반경 없음").
N4. AC004-REVIEW-EVIDENCE — acceptance.md:L48 — the export-side "selector uses only `pele-shape-*`" check is code-review evidence, not a command — Severity: minor — Class: optional — Required fix: optionally add a bounded grep on the injection block, like the index.css one.
N5. SEAM-SIDE-EFFECT — plan.md:L81 — moving `background-color: var(--pele-bg)` to the theme-independent `.preview-content .mermaid-container` rule also paints error-message and empty-diagram containers in light. This is consistent with REQ-008 L84 but not noted — Severity: minor — Class: optional — Required fix: record it as an edge case in acceptance.md.

No blocking defects.

## Recommendation
PASS. Every must-pass check passes with cited evidence: no clarification markers remain (MP-7), all REQ bullets are GEARS (MP-2), and the frontmatter is valid (MP-3). All five review-1 blocking defects (D1-D5) are resolved, and D6-D11 are confirmed resolved. The score rose from 0.75 to 0.93. N1-N5 are optional and can be folded in at manager-spec's discretion or during run-phase pointer edits; none blocks Implementation Kickoff.
