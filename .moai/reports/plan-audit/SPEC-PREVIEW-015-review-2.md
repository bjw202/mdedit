# SPEC Review Report: SPEC-PREVIEW-015
Iteration: 2/3
Verdict: PASS
Overall Score: 0.91 (Tier L PASS threshold 0.85 — spec-workflow.md § SPEC Complexity Tier; iter1 0.76 → iter2 0.91, no regression, no STOP)

Reasoning context ignored per M1 Context Isolation. Inputs read (Tier L, all 5 artifacts): spec.md (254 lines, v0.2.0), design.md (34 lines, new), plan.md (186), acceptance.md (270), research.md (§8-§9), progress.md. Cross-SPEC target files read for AC-024 verification. audit_model not configured → Claude-only audit, no MCP backend call.

## Must-Pass Results
- [PASS] MP-1 REQ number consistency: REQ-PREVIEW015-001..024 sequential, 3-digit, no gaps or duplicates (spec.md:48-175). AC-PREVIEW015-001..024 the same (acceptance.md:15-175). Both counts are 24, within the Tier L ceiling of 25.
- [PASS] MP-2 GEARS (judged on the requirement layer only, spec.md REQ bullets): every REQ uses "The <subject> shall …", "**When** …, the <subject> shall …", "**While** …, the <subject> shall …", or the "shall not" Unwanted form, e.g. spec.md:50-51, :55-56, :75-77, :87-88, :112-114, :135, :167. ACs are Given-When-Then in acceptance.md (verification layer, not graded here).
- [PASS] MP-3 frontmatter: spec.md:2-13 carries all 12 canonical fields — id, title, version "0.2.0" (quoted), status draft, created/updated 2026-10-26, author, priority High, phase "v0.17.0 target" (release label, not a lifecycle token), module lib/diagram, lifecycle spec-anchored, tags as a comma string. No rejected aliases. Optional `tier: L`.
- [N/A] MP-4 language neutrality: single-project TypeScript/Tauri SPEC, not template-bound multi-language tooling.
- [PASS] MP-5 D7: referenced SPECs all exist — PREVIEW-006 planned, PREVIEW-010 draft, UI-008 draft, AI-001 draft, AI-008 draft, EXPORT-001 implemented, EXPORT-004 completed; research.md also cites PREVIEW-011 draft and UI-006 draft. None is retired, superseded, or archived, so no BLOCKING finding.
- [PASS] MP-6 D8: `syscall` count 0 in spec/plan/acceptance/design/research → auto-PASS.
- [PASS] MP-7 clarification gate: `grep -rn 'NEEDS CLARIFICATION' plan.md research.md design.md` → no matches (exit 1).

## Category Scores (0.0-1.0, rubric-anchored)
| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.85 | 0.75–1.0 | AC-020 is now one reading only: "`var(--pele-` 0번" + theme value present (acceptance.md:152-153), backed by a single strategy in design.md:15 and :34. AC-024 has a block definition (acceptance.md:180) and a per-target table (:183-210). Remaining minor ambiguity sits in the cross-SPEC rewrite table (N1, N4). |
| Completeness | 0.95 | 1.0 band minus one stale target | All sections are present: HISTORY spec.md:21, background :30, REQs :44, five `### Out of Scope —` H3 headings with bullets :215-236, design.md §1-§2, Open questions closed (plan.md:163-180). Minor: one stale PREVIEW-006 requirement is not in the rewrite table (N2). |
| Testability | 0.90 | 0.75–1.0 | The three ACs that iteration 1 found infeasible are now binary: AC-002 (acceptance.md:40-41), AC-020 (:151-154), AC-024 (:179-212). AC-011 now names its first-frame observation method (:95). Manual sub-clauses (AC-018/020/024) stay judgment-based but are declared in § 검증 경계 (:256-262). |
| Traceability | 0.95 | 1.0 band | The trace table (acceptance.md:217-242) maps every REQ to at least one AC. Every REQ-001..024 is cited by some AC. AC-006 now cites REQ-004 and REQ-009 (:65). AC-017 covers the export-side `id` uniqueness (:133). |

Aggregate (mean) = (0.85 + 0.95 + 0.90 + 0.95) / 4 = 0.91 ≥ 0.85.

## AC-024 target verification (D1 fix, checked against the actual files)
Each target row in acceptance.md:185-210 resolves to an existing block or line:
- PREVIEW-006 spec.md: REQ-003 :87, REQ-004 :91, REQ-005 :95, REQ-007 :103 (the block runs to `## [DELTA]` :107).
- PREVIEW-010 spec.md: REQ-001..006 at :61, :67, :73, :78, :84, :89.
- UI-008 spec.md: :83 (REQ-008), :100 (REQ-019), :101 (REQ-020), :107 ("아래 7개 스니펫"), :220 ("빈 펜스 플레이스홀더 판정 힌트"), :248 (AC-UI-008-004 row); acceptance.md :56.
- AI-001 spec.md: :124 (REQ-AI-023), :125 (REQ-AI-024).
- AI-008 spec.md: :112, :114, :116, :183.
- EXPORT-004 spec.md: :125 block, with its Mermaid line at :129 containing `캡처`.
- EXPORT-001 spec.md: :155-156 (`Mermaid JS`).
- README.md: `11.12.3` occurs only at :104.

Every replacement text in spec.md:186-207 contains its row's required string and none of the forbidden pattern F, so the AC can pass after M6 without rewriting historical plan or background text. That resolves the iteration-1 contradiction.

## Regression Check (Iteration 1 defects)
- D1 AC-024 grep infeasible — RESOLVED: AC-024 is narrowed to the listed blocks and lines, and states "표에 없는 줄(배경, 계획, HISTORY, 다른 REQ)은 검사하지 않는다" (acceptance.md:179). The targets are verified above.
- D2 fixture capture environment — RESOLVED: REQ-023 bullets 2-3 (spec.md:172-173) require capture environment + measurer in the manifest and limit byte comparison to same-measurer fixtures. design.md D14 (:23) splits the fixtures into `unit/` and `browser/`. AC-002 (acceptance.md:39-41) gives byte equality for `unit/` and structural invariants for `browser/`.
- D3 AC-020 var ambiguity — RESOLVED: design.md D6 (:15) chooses substitution only and rejects root declaration ("SVG 루트에 변수를 선언하는 방식은 쓰지 않는다"). AC-020 (acceptance.md:152-154) checks 6 combinations, each with a binary "`var(--pele-` 0번" + theme value present + other-theme value absent check.
- D4 Tier L design.md missing — RESOLVED: design.md exists with D1-D15 (:6-24) and the Design Note (:26-34). plan.md:14 lists the 5 Tier L artifacts and no longer self-waives.
- D5 research.md §9 unannotated — RESOLVED (alternative location): plan.md:167-180 maps each §9 question to its resolution pointer and explains why research.md stays unedited. This is equivalent to the requested annotation.
- D6 trace row mismatch — RESOLVED: AC-006 cites "(REQ-004, REQ-009)" (acceptance.md:65).
- D7 export `id` uniqueness — RESOLVED: AC-017 adds "내보낸 HTML 안 모든 SVG의 `id` 값에 중복이 없다" (acceptance.md:133).
- D8 validate/render gap — RESOLVED: REQ-012 requires "같은 렌더 함수를 같은 고정 옵션으로 … pele `parse`만 따로 부르지 않는다" (spec.md:112), and design.md D3 (:12) repeats it.
- D9 AC-011 first frame — RESOLVED: AC-011 names the mechanism — `page.addInitScript` dark preset, sampling at the first `waitForSelector('.mermaid-container svg')`, and a check that the elementHandle stays attached (acceptance.md:95).
- D10 AC-014 message identity — RESOLVED: E2/E3 must equal the `PeleError.message` of the same render (acceptance.md:114). REQ-012 bullet 3 matches (spec.md:114).
- D11 math labels — RESOLVED: Out of Scope — 수식 라벨 (spec.md:229-231) + design.md D15 + AC-001 item 13 (measure-only).
- D12 ESM spy vs no-mock — RESOLVED: acceptance.md:9 defines the passthrough wrapper exception, and excludes wrappers that alter return values.

No unresolved prior defect. No stagnation.

## Defects Found (structured defect-list)
D1. N1-PREVIEW010-REQ003-LABEL — spec.md:L192 — The row says "(research.md §3.2 근거로 추가)", but REQ-PREVIEW010-003 already exists (SPEC-PREVIEW-010 spec.md:73, "system 테마 모드 대응"), so this is a replacement, not an addition. The new text's "REQ-002와 같이" is also ambiguous: the next reader of SPEC-PREVIEW-010 could take it as PREVIEW-015 REQ-002 (fixed options) rather than REQ-PREVIEW010-002. — Severity: minor — Class: optional — Required fix: Change "추가" to "대체" and write "REQ-PREVIEW010-002와 같이".

D2. N2-PREVIEW006-REQ006-STALE — spec.md:L186-189 (rewrite table) vs SPEC-PREVIEW-006 spec.md:99-101 — REQ-PREVIEW006-006 reads "패치가 적용된 상태에서 … 패치 적용 전과 동일하게 렌더한다". After M2 removes the patch, this requirement has no subject. It is absent from the rewrite table and AC-024, so it would stay stale. — Severity: minor — Class: optional — Required fix: Add a row for REQ-PREVIEW006-006 (e.g. retire it, or restate it as "pele 교체 후 비대상 렌더 무회귀"), plus an AC-024 target row if desired.

D3. N3-USER-GUIDE-LINE-DRIFT — spec.md:L178, plan.md:L117 — `docs/USER_GUIDE.md:204-206` is cited as the theme-recolor text. In the worktree tree (929d116), :204 is a base64 table row, :206 is the `### Mermaid 다이어그램` heading, and the recolor sentence is at :208. — Severity: minor — Class: optional — Required fix: Cite `:206-208`, or cite the section heading instead of line numbers.

D4. N4-UI008-ACC-BLOCK-REWRITE — spec.md:L199 — One replacement sentence ("프리셋 7종 스니펫이 각각 pele 1.10.0에서 오류 없이 렌더된다; pele 버전 핀 무변경.") is prescribed for both the spec.md :248 table row and acceptance.md :56. The acceptance.md target is a 4-line Given/When/Then block (SPEC-UI-008 acceptance.md:56-61) whose When line names `mermaid 11.12.3 mermaid.parse(snippet)`. How to restructure that block is left to M6. AC-024 row 17 still verifies it binarily, so this is wording only. — Severity: minor — Class: optional — Required fix: Give the G/W/T rewrite explicitly (e.g. When "diagram module로 각 스니펫을 렌더하면", And "pele 버전 핀(1.10.0) 무변경").

D5. N5-COMPLETED-SPEC-BODY-EDIT — plan.md:L105, spec.md:L206 — M6 edits the body of SPEC-EXPORT-004 (status `completed`) and says "`status`는 바꾸지 않는다". spec-frontmatter-schema.md defines the `completed → in-progress (amendment)` transition, with `amendment_of:` and a HISTORY `## Amendments` sub-section, for in-place changes to a completed SPEC. The plan neither uses nor explicitly waives it. Not verified with the drift tool (`moai spec audit`), so the effect on drift detection is unconfirmed — this is a procedural hypothesis, not a measured defect. — Severity: minor — Class: optional — Required fix: Choose one and record it in M6: (a) apply the amendment procedure to SPEC-EXPORT-004, or (b) state that the edit is a cross-reference wording update, not an amendment, and keep `completed`.

## Recommendation
PASS. Rationale:
- All must-pass criteria hold. MP-1 is supported by spec.md:48-175 sequential IDs. MP-2 is supported by the GEARS forms at spec.md:50-167. MP-3 has 12 canonical fields at spec.md:2-13. MP-4 is N/A. MP-5 found no retired, superseded, or archived references. MP-6 found zero `syscall`. MP-7 found zero markers.
- All four iteration-1 blocking defects (D1-D4) are resolved with evidence, and the AC-024 targets were checked against the real cross-SPEC files.
- The aggregate is 0.91, above the Tier L 0.85 threshold.

The five new findings are all minor and optional. Fixing them is left to the orchestrator; none blocks the run phase. N1, N2, and N5 are the most useful to fold into M6 before the cross-SPEC edits run.
