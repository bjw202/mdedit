# SPEC Review Report: SPEC-PREVIEW-015
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.76 (Tier L PASS threshold 0.85 — spec-workflow.md § SPEC Complexity Tier)

Reasoning context ignored per M1 Context Isolation. Inputs read (Tier L): spec.md, plan.md, acceptance.md, research.md, progress.md. design.md does not exist (see D4). audit_model not configured → Claude-only audit, no MCP backend call.

## Must-Pass Results
- [PASS] MP-1 REQ number consistency: REQ-PREVIEW015-001..024 sequential, 3-digit padding, no gaps/duplicates (spec.md:47-173). AC-PREVIEW015-001..024 likewise (acceptance.md:15-169).
- [PASS] MP-2 GEARS format compliance (requirement layer, spec.md REQ entries only): every REQ bullet is "The <subject> shall …" / "When …, the <subject> shall …" / "While …, the <subject> shall …" / "shall not" Unwanted form, e.g. spec.md:49-50, :74-76, :86-87, :134, :166. ACs are Given-When-Then in acceptance.md (verification layer, not graded here).
- [PASS] MP-3 YAML frontmatter validity: spec.md:2-13 has all 12 canonical fields — id, title, version "0.1.0" (quoted), status draft, created/updated 2026-10-26, author, priority High, phase "v0.17.0 target", module lib/diagram, lifecycle spec-anchored, tags comma string. No rejected aliases. Extra fields tier/issue_number/related_specs are non-canonical but harmless.
- [N/A] MP-4 language neutrality: single-project (TypeScript/Tauri app) SPEC, not template-bound multi-language tooling.
- [PASS] MP-5 D7 cross-SPEC reconciliation: all 7 referenced SPECs exist; statuses PREVIEW-006 planned, PREVIEW-010 draft, UI-008 draft, AI-001 draft, AI-008 draft, EXPORT-001 implemented, EXPORT-004 completed. None retired/superseded/archived → no BLOCKING.
- [PASS] MP-6 D8 cross-platform: `syscall` count 0 in all SPEC files → auto-PASS.
- [PASS] MP-7 clarification gate: grep for `[NEEDS CLARIFICATION` over plan.md and research.md → 0 matches. (research.md §9 has un-annotated open questions — see D5, not a marker.)

## Category Scores (0.0-1.0, rubric-anchored)
| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 | Requirements precise and code-anchored (spec.md:74, :91-94, :138-140). Ambiguities: AC-020 "대체값 없는 var(--pele-" (acceptance.md:148, D3); REQ-022 "정한 집합" not enumerated (spec.md:166); REQ-002 value deferred to M1 (spec.md:55, acceptable with gate). |
| Completeness | 0.75 | 0.75 | HISTORY spec.md:21, Overview/배경 :27, REQs :43, Exclusions with 4 `### Out of Scope —` H3 + bullets :217-234. Missing Tier L design.md (plan.md:14 self-waiver, D4); research.md §9 open questions unannotated (D5). |
| Testability | 0.65 | 0.50–0.75 | Most ACs binary and code-verifiable. Three ACs are infeasible or non-binary as written: AC-024 grep (D1), AC-002 re-render equality (D2), AC-020 var check (D3); weaker: AC-011 "첫 프레임" (D9). |
| Traceability | 0.90 | 0.75–1.0 | Trace table acceptance.md:178-203 covers every REQ; every AC cites an existing REQ. Minor: REQ-009→AC-006 row vs AC-006 citing only REQ-004 (D6); REQ-006 bullet 3 export path and REQ-012 bullet 3 message identity only partially verified (D7, D10). |

Aggregate (mean) 0.76 < 0.85.

## Code-reference verification (worktree source, spot-checked)
Confirmed accurate: `mermaidPlugin.ts:13-24` (only `"` escaped, :19); `svgSanitize.ts:13-35` (FORBID_TAGS incl. foreignObject), `:45-56` href hook; `mermaidValidate.ts:7, 20-28, 37-39`; `PreviewRenderer.tsx:25-29, 35-39, 79-94, 99-176`, link handler :136-170, error markup :131, placeholder :121-122; `ai-suggestion-card.ts:18, 485-491, 1287-1298, 1468`; `ResizablePanels.tsx:171-172` (editor mode unmounts preview); `exportDocx.ts:79, 125-201, 241-272` (shift-based misalignment real at :242-243); `exportHtml.ts:43-46, 99-131` (index pairing against global DOM); `keyboard-shortcuts.ts:194-257` (8 presets); `package.json:18, 37, 59`; `patches/mermaid+11.12.3.patch` exists; `mdedit-tokens.css:11, 89`; guard tests `diagramRegressionGuard.test.ts:13-50` and `aiDiagramTypeRegressionGuard.test.ts:13-31` pin mermaid 11.12.3; e2e/test refs (`tauri-v2-ai-mock.ts:115-118`, `test-content.md:15-22`, `mermaid-subgraph-label.spec.ts:13, 59`, `ai-inline-edit.spec.ts:230, 238`, `markdown-render.spec.ts:41, 61`, `PreviewRenderer.test.tsx:242, 361, 440`); cross-SPEC REQ IDs (PREVIEW-006 :79-103, PREVIEW-010 :61-89, UI-008 :83/:100/:101/:248, AI-001 :124-125, AI-008 :112/:114/:116/:183, EXPORT-004 spec.md:130); docs (`USER_MANUAL.md:15, 498`, `README.md:15, 104`).
pele 1.10.0 API claims verified from the npm tarball type definitions (dist/types.d.ts, errors.d.ts): `idPrefix`, `measurer`, `responsive`, `autoDirection`, `directionBreakpoint`, `links`, `images`, `imageSchemes` exist; `PeleError` has `code` ('unsupported-diagram'|'syntax'|'semantic'|'limit'), `line`, `column`. dist/pele.js emits `var(--pele-bg,#fff)` / `var(--pele-fg,#1f1f1f)` (with fallbacks) and measures text through `OffscreenCanvas`/`getContext`/`measureText`.
Minor ref drift: `USER_MANUAL.md:665` is the end of the 6-3 section (next heading `## 8.` at :666) — range is correct.

## Defects Found (structured defect-list)
D1. AC-024-GREP-INFEASIBLE — acceptance.md:L173 — The grep `11\.12\.3` over whole SPEC directories must return 0 except HISTORY rows, but the "다른 SPEC 개정" table (spec.md:182-205) and M6 (plan.md:100) only rewrite specific REQ/AC lines. Measured now: PREVIEW-006 spec.md 11 / acceptance.md 3 / plan.md 8; PREVIEW-010 spec.md 4 / acceptance.md 2; UI-008 spec.md 7 / acceptance.md 5 / plan.md 5 / tasks.md 1; AI-008 spec.md 3 / acceptance.md 2 / plan.md 1 (e.g. PREVIEW-006 spec.md:111 file table, Tier 1/2 background). The AC cannot pass without rewriting historical plan/background text outside the stated M6 scope — internal contradiction between AC-024 and REQ-024/M6. — Severity: major — Class: blocking — Required fix: Narrow the grep to the rewritten lines (e.g. grep only the REQ/AC IDs listed in the table, or only spec.md requirement sections + the three named UI-008 acceptance lines), or enumerate files allowed to keep historical mentions. Do not expand M6 to rewrite completed SPECs' plans.

D2. AC-002-FIXTURE-ENV — acceptance.md:L38, spec.md:L171, plan.md:L52 — AC-002 requires re-rendering each fixture "with the currently installed pele and the same options" and byte-equality with the stored fixture. pele measures text via OffscreenCanvas/canvas `measureText` (verified in dist/pele.js); fixtures captured in the M1 spike browser page will not equal a vitest/jsdom re-render (no canvas, or the injected test measurer from acceptance.md:9). The AC's pass/fail depends on an unstated capture environment. — Severity: major — Class: blocking — Required fix: Add "capture environment + measurer" to the manifest fields (REQ-023 bullet 2 / plan M1 item 7), and state that AC-002 equality applies to fixtures captured under the same measurer the unit test uses; browser-captured fixtures are verified by e2e or by structural invariants instead.

D3. AC-020-VAR-AMBIGUOUS — acceptance.md:L148, plan.md:L25 (D6) — "대체값 없는 `var(--pele-` 참조가 0건" has two readings: (a) no unresolved var() refs, (b) no var() refs lacking a fallback. pele always emits fallbacks (`var(--pele-bg,#fff)`), so reading (b) is vacuous and passes even for an unresolved dark export (renders light). D6 also permits two strategies — substitute values, or declare values on the SVG root — and the second leaves `var(--pele-` substrings, so the AC result depends on reading + strategy. — Severity: major — Class: blocking — Required fix: Pick one strategy in D6 and restate AC-020 binary, e.g. "the SVG contains no `var(--pele-` substring" (substitution), or "every `--pele-*` property referenced is declared on the root `<svg>` style with the injected theme value" (root declaration). Keep the "injected theme value present" clause.

D4. TIER-L-DESIGN-MD-MISSING — plan.md:L14 — Tier L artifact set is 5 files including design.md (spec-workflow.md § SPEC Complexity Tier table). plan.md waives design.md on its own authority; no rule allows the waiver. — Severity: major — Class: blocking — Required fix: Create design.md (move or mirror the Locked Decisions D1-D13 table and the spec.md "Design Note" there), or record an explicit, user-approved exemption.

D5. RESEARCH-OPEN-QUESTIONS-UNANNOTATED — research.md:L260-269 — §9 lists 8 open questions with no resolution markers; answers exist elsewhere (Q2→REQ-015, Q3→D2/REQ-011, Q4→D5/D6, Q5→REQ-013, Q6→D9, Q7→M1, Q8→REQ-024), Q1 is an ops question. — Severity: minor — Class: optional — Required fix: Append a "resolved → <pointer>" note to each question.

D6. TRACE-ROW-MISMATCH — acceptance.md:L62 vs L188 — Trace table maps REQ-009→AC-006, but AC-006 cites only REQ-004. — Severity: minor — Class: optional — Required fix: Add REQ-009 to AC-006's citation or drop 006 from the REQ-009 row.

D7. ID-UNIQUENESS-EXPORT-UNCOVERED — spec.md:L76, acceptance.md:L130 — REQ-006 bullet 3 (no SVG id collision in one document) is a module-level guarantee; only AC-010 checks it (preview). Exported HTML with multiple diagrams is unverified. — Severity: minor — Class: optional — Required fix: Add "all SVG `id` values in the exported HTML are unique" to AC-017.

D8. VALIDATE-RENDER-GAP — spec.md:L111 — "검증을 통과한 코드는 미리보기에서도 렌더된다" holds only if validation performs the same render call; if validateMermaid uses pele `parse` while preview uses `render`, render-stage failures (e.g. `limit`/output limit) break the guarantee. — Severity: minor — Class: optional — Required fix: State that validation runs the module's render path with the same fixed options (or parse + render).

D9. AC-011-FIRST-FRAME — acceptance.md:L92 — "첫 프레임부터 다크 색" has no stated observation mechanism in Playwright. — Severity: minor — Class: optional — Required fix: Specify, e.g. theme persisted as dark before navigation, and the first computed fill sampled when the `svg` attaches equals the dark token value.

D10. AC-014-MESSAGE-IDENTITY — acceptance.md:L111 vs spec.md:L113 — REQ-012 requires the pele error message; AC-014 checks only a non-empty string. — Severity: minor — Class: optional — Required fix: Assert `error` equals the `PeleError.message` the module produced for the same source.

D11. MATH-LABEL-STRIP-UNSTATED — spec.md:L41, svgSanitize.ts:15 — pele math labels use `foreignObject`, which `sanitizeSvg` forbids; math in diagrams will be stripped. Neither Exclusions nor M1 item 7 names this. — Severity: minor — Class: optional — Required fix: Add an Out of Scope bullet (math labels in diagrams unsupported) or record it as an M1 check item.

D12. ESM-SPY-VS-NO-MOCK — acceptance.md:L9, L48 — AC-004 "pele render를 감시" in vitest ESM needs a passthrough `vi.mock('pele', importOriginal)` wrapper (`vi.spyOn` on an ESM namespace fails), which reads as contradicting "pele를 mock하지 않는다". — Severity: minor — Class: optional — Required fix: State that a passthrough wrapper delegating to the real pele counts as a spy, not a mock.

## Recommendation
Must-pass firewall is clean (MP-1..MP-7 PASS/N/A). The FAIL comes from the aggregate score (0.76 < Tier L 0.85) plus four blocking defects. Fix routing for manager-spec:

1. D1 — rewrite the AC-024 grep (acceptance.md:173) to target only the lines the cross-SPEC table rewrites.
2. D2 — add capture environment/measurer to the fixture manifest (spec.md:171, plan.md:52) and scope AC-002 equality (acceptance.md:38) to fixtures captured under the test's measurer.
3. D3 — choose one color-resolution strategy in D6 (plan.md:25) and restate AC-020 (acceptance.md:148) as a single binary check.
4. D4 — add design.md (Locked Decisions + Design Note), or record an approved exemption.
5. Optional (orchestrator discretion): D5-D12 are small wording/coverage edits; none is required for PASS.

Iteration 2 should be scoped to the D1-D4 delta plus a regression check on D5-D12 where touched.
