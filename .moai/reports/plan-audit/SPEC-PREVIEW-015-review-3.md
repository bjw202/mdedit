# SPEC Review Report: SPEC-PREVIEW-015
Iteration: 3/3
Verdict: FAIL — STOP (score regression 0.91 → 0.85; final iteration, escalate to user)
Overall Score: 0.85 (Tier L PASS threshold 0.85)

Reasoning context ignored per M1 Context Isolation. Inputs read (Tier L): spec.md v0.4.0 (274 lines), design.md (46), plan.md (241), acceptance.md (299), progress.md (69), m1/checks.md (89, M1 + M1b tables), m1/evidence/m1b-unit.json (structure only), spec-compact.md (spot grep). research.md was not re-read in full; it is unchanged since iteration 2 (mtime 16:00, plan.md:224 says it stays unedited). audit_model not configured → Claude-only audit, no MCP backend call.

All seven must-pass criteria hold, and the score sits exactly on the threshold. The verdict is FAIL because three blocking defects (D1–D3) are internal contradictions that M1b introduced and the v0.4.0 edit did not carry through. All three are text fixes. Iteration 3 is the cap, so the orchestrator should offer the user PASS-with-debt (fix D1–D5 inside M2 kickoff) or one more manager-spec pass.

## Must-Pass Results
- [PASS] MP-1 REQ number consistency: `REQ-PREVIEW015-001`..`025` sequential, 3-digit, no gaps or duplicates (spec.md:50-186). `AC-PREVIEW015-001`..`025` the same (acceptance.md:15-227). 25/25 meets the Tier L ceiling of 25 for both counts (the ceiling is reached, not exceeded).
- [PASS] MP-2 GEARS (judged on the requirement layer, spec.md REQ bullets only): the new and changed REQs use GEARS forms. REQ-025 is "**When** 다이어그램 라벨에 `$$…$$` 수식이 있으면, the diagram module shall …" (spec.md:186), plus "The math resolver shall …" (:187-188) and "The math resolver shall not …" (:187). REQ-003 uses "The diagram sanitize path shall … / shall not …" (:63-64). REQ-018 uses "The DOCX export shall …" (:150). REQ-009 uses "**When** … the preview renderer shall …" (:96). ACs are Given-When-Then in acceptance.md (verification layer, not graded here).
- [PASS] MP-3 frontmatter: spec.md:2-13 has all 12 canonical fields — `version: "0.4.0"` (quoted), `status: draft`, `created`/`updated` 2026-10-26, `priority: High`, `phase: "v0.17.0 target"` (a release label, not a lifecycle token), `lifecycle: spec-anchored`, `tags` as a comma string. No rejected aliases.
- [N/A] MP-4 language neutrality: single-project TypeScript/Tauri SPEC, not template-bound multi-language tooling.
- [PASS] MP-5 D7: referenced SPEC statuses — AI-001 draft, AI-008 draft, EXPORT-001 implemented, EXPORT-004 completed, PREVIEW-001 approved, PREVIEW-006 planned, PREVIEW-010 draft, UI-008 draft. None is retired, superseded, or archived, so there is no BLOCKING finding.
- [PASS] MP-6 D8: `grep -c syscall` → 0 in spec/plan/acceptance/design/research. Auto-PASS.
- [PASS] MP-7 clarification gate: `grep -rn '\[NEEDS CLARIFICATION' plan.md research.md design.md` → no match (exit 1).

Provisional wording check (requested): `grep -n '잠정\|M1b 뒤\|TBD\|미정\|pending\|provisional' spec.md acceptance.md design.md` matches only the HISTORY rows spec.md:27-28. Those rows are historical and acceptable. No REQ or AC text carries provisional wording. Stale provisional text remains outside REQ/AC — see D3 and D9.

## Evidence consistency (changed REQ/AC vs m1/checks.md)
| Change | Evidence | Consistent? |
|---|---|---|
| REQ-002 / AC-004 `responsive: true` | checks.md:30 ("차이는 루트 style의 `max-width:100%;height:auto` 유무뿐", 19/19); progress.md:31 user choice true | Yes |
| REQ-009 / AC-007 two-branch suffix | checks.md:31 (L2 C14 sample; `pie` semantic 0/0; `notarealdiagramtype` 0/0 at checks.md:11; "line≥1·column 0 … 6,264개에서 0건") | Yes. AC-007 sources match exactly |
| REQ-018 / AC-020 DOCX always light | checks.md:16-17 (dark literal hard to read on white DOCX); progress.md:32 | Yes. AC-020 table (acceptance.md:156-163) encodes DOCX×dark → light |
| D14 `jsdom-default` | checks.md:22, :29, :34 (`unitChecked=76 … mismatches=0`) | Yes |
| REQ-025 `mathml-bare`, `trust:false`, no HTML output | checks.md:68 (bare 1 vs html/mathml 0 in webkit), :74 (E1 386,784 B vs E4 14,199 B), :75 (DOCX bare renders) | Yes |
| REQ-025 size via `getBoundingClientRect`; unit asserts structure only | checks.md:64, :69 (jsdom zero box → raw `$$…$$`) | Yes. AC-025 injects size (acceptance.md:230) |
| REQ-003 separate `DOMPurify(window)`, re-registered href hook, shared `sanitizeSvg` byte-identical | checks.md:70 (38 pairs 0/0/0), :73 (separate-instance hook 0 runs vs global 43; fresh instance does not inherit href hook) | Yes for REQ-003. **Not carried through** to AC-005, D13, the Design Note, plan risk, or the "strict 모드" definition (D1, D2) |
| REQ-025 CSP "새 콘솔 CSP 위반 0" | checks.md:76 ("위반 이벤트 0, 콘솔 거부 1 … load-only에도 있음") | REQ matches. AC-025 measures a different signal (D5) |
| D15 user decision to support math | progress.md:30 records the M1 verdict as "수식 … 미지원으로 확정" | **Contradiction** (D3) |

## Category Scores (0.0-1.0, rubric-anchored)
| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.80 | 0.75 | REQ-025 is precise (spec.md:186-192), and REQ-003 and D4 now name the separate instance (spec.md:63, design.md:13). Two readings remain. AC-005 (acceptance.md:55-59) implies the module calls `sanitizeSvg`, while REQ-003 says it does not (D1). The "strict 모드" definition (spec.md:196) and D13 (design.md:22) still name `sanitizeSvg` as the diagram defence (D2). |
| Completeness | 0.90 | 0.75–1.0 | All sections are present, including HISTORY rows 0.3.0 and 0.4.0 (spec.md:27-28), design §3 and §4 (design.md:36-46), M1b results (plan.md:78), and a math Out-of-Scope with bullets (spec.md:244-251). The gate record conflicts with itself (D3), and progress §E.1 is stale (D9). |
| Testability | 0.80 | 0.75 | Most new ACs are binary: AC-020 per-combination table, AC-007 exact sources, AC-025 items 1-5 (acceptance.md:232-236). Three gaps remain. AC-002's browser invariant breaks on the math fixtures that M2 adds (D4). AC-025's CSP check counts violation events, while the REQ and the evidence concern console rejections (D5). AC-005 tells the tester to spy on a function the module no longer calls (D1). |
| Traceability | 0.90 | 0.75–1.0 | The trace table (acceptance.md:243-269) covers REQ-001..025. The row for REQ-025 lists AC-005 and AC-025. The row for REQ-003 lists only AC-005, although AC-025 cites REQ-003 and is the only AC that tests its separate-instance bullets (D7). |

Aggregate (mean) = (0.80 + 0.90 + 0.80 + 0.90) / 4 = 0.85 — equal to the Tier L threshold of 0.85, and down from 0.91 in iteration 2 → STOP signal.

## Defects Found (structured defect-list)
D1. AC005-SPY-CONTRADICTS-REQ003 — acceptance.md:L55-59 (and spec-compact.md:L195-199) — AC-005 is titled "출력은 sanitizeSvg를 거친다" and its Given reads "`sanitizeSvg`를 감시하는 상태에서". REQ-003 v0.4.0 (spec.md:62-65) and D4 (design.md:13) require a **separate** `DOMPurify(window)` instance and forbid touching the shared path. A conforming module never calls `sanitizeSvg`, so a spy on it sees 0 calls. This would lead the implementer either to fail AC-005 or to add a second sanitising pass. Equality of the diagram-path output with `sanitizeSvg` for non-math diagrams is also not in the M1b evidence: checks.md:70 (2a) tests only the shared function, and :71 (2b) only math samples. It is a plausible hypothesis, not a measured fact. — Severity: major — Class: blocking — Required fix: Retitle AC-005 (e.g. "수식이 없는 다이어그램은 `sanitizeSvg`와 같은 결과로 정화된다"). Replace the spy Given with a comparison: "for each non-math `unit/` fixture, module output === `sanitizeSvg(raw pele output)`". Keep the `<script>`/`foreignObject`/`on*` = 0 assertions. Regenerate spec-compact.md.

D2. STALE-SANITIZESVG-SECOND-DEFENCE — design.md:L22 (D13), design.md:L32, plan.md:L188, plan.md:L163, plan.md:L167, spec.md:L196 — These places still say `sanitizeSvg`'s href hook (`svgSanitize.ts:45-56`) is the diagram's "두 번째 방어선", or that "strict 모드 = … + `sanitizeSvg` 정화". The MX plan also gives `svgSanitize.ts` the REASON "fan_in ≥ 3 (… 다이어그램 모듈)". M1b measured that a fresh instance does **not** inherit that hook (checks.md:73 `freshInstanceInheritsSharedHrefHook: "no (data: href kept)"`). REQ-003 therefore re-registers its own hook. spec.md:196 matters most, because M6 copies that definition into the 7 other SPECs (rows at spec.md:208, :213, :215, :219, :220) and would spread the wrong definition. — Severity: major — Class: blocking — Required fix: In all six places, replace "`sanitizeSvg` (href 훅)" with "다이어그램 전용 정화 경로(별도 DOMPurify 인스턴스, 재등록한 href 훅, design.md D4)". Change the MX REASON for `svgSanitize.ts` to list only its real callers.

D3. GATE-RECORD-MATH-DECISION-CONFLICT — progress.md:L30 vs design.md:L24, plan.md:L68, spec.md:L27 — The recorded M1 user verdict says "다이어그램 안 수식(`$$…$$`)은 미지원으로 확정 … SPEC 제외 범위와 사용자 문서에 명시한다". D15 says "사용자는 이 퇴보를 받아들이지 않고 pele `math` 옵션을 … 연결하기로 했다", and plan.md M1b says "M1 판정 뒤 사용자가 … 지원하기로 정했다". No entry in progress.md §E.2 records that reversal: when it was made, through which channel, and that it supersedes :30. REQ-023 and AC-001 (acceptance.md:33) make the progress.md gate record the authority, and that record currently states the opposite of REQ-025. — Severity: major — Class: blocking — Required fix: Mark progress.md:30 "[SUPERSEDED — 아래 수식 지원 결정]". Add a dated §E.2 line recording the user's decision to support diagram math via pele `math` + `katex` (AskUserQuestion, before M1b). Do not delete the original line.

D4. AC002-MATH-FIXTURE-INVARIANT — acceptance.md:L8, L41 vs plan.md:L78 — acceptance.md:8 says every pele fixture was captured "M1에서". plan.md:78 adds math fixtures in M2. The AC-002 `browser/` invariant ("매니페스트의 입력 소스에 있는 라벨 글자가 모두 SVG 텍스트에 있으며") cannot hold for a math label, because `$$x^2 + y^2$$` becomes MathML and the `$$…$$` source text is not in the SVG. Math fixtures captured in jsdom also need an injected size (checks.md:69), and the manifest has no field for that. — Severity: minor — Class: blocking — Required fix: Change acceptance.md:8 to "M1·M2에서 실제 pele 1.10.0 렌더로 캡처". Exempt `$$…$$` spans from the label-text invariant, or replace it with "TeX 원문이 `<annotation encoding="application/x-tex">`에 있음". Require the manifest to record the size-injection method for math fixtures.

D5. AC025-CSP-SIGNAL-MISMATCH — acceptance.md:L237 vs spec.md:L192, checks.md:L76 — REQ-025 forbids new "콘솔 CSP 위반". AC-025 counts "CSP 위반 이벤트". The M1b evidence shows these two signals diverge: the existing KaTeX_Size3 defect produced "위반 이벤트 0, 콘솔 거부 1". An AC that counts only events would miss a new math-induced console rejection of the same kind. — Severity: minor — Class: blocking — Required fix: Have AC-025 count both `securitypolicyviolation` events and console CSP messages, each against the no-math baseline of the same document, and require neither count to increase.

D6. STALE-ENTITY-RATIONALE — design.md:L29, plan.md:L184 — The Design Note still argues that passing the raw token "미리보기와 다른 글자가 나온다", and says "이 차이가 실제로 생기는지는 M1에서 확인한다". M1 measured the opposite: the inputs differ, but pele output is byte-identical because pele decodes entities itself (checks.md:21 `svgEqual:true`). REQ-006/015 (input-string equality) remain valid as a stricter contract, but the stated reason is now false. — Severity: minor — Class: optional — Required fix: Update the rationale to the M1 result (equal input kept as a contract, not because the output differs) and close the risk row.

D7. TRACE-REQ003-AC025 — acceptance.md:L247, L236 — The trace row for 003 lists only AC-005, but AC-025 cites REQ-003 and is the only AC that tests its separate-instance and hook bullets (item 5). REQ-003's "전역 인스턴스에 … 설정을 추가하지 않는다" (spec.md:64) is also not asserted: item 5 checks hook count only, not `setConfig`. — Severity: minor — Class: optional — Required fix: Change the row to "003 | 005, 025". Add to AC-025 item 5 a check that the global instance's config is unchanged after a diagram-path call. checks.md:73 already shows the shared `sanitizeSvg` still strips the fO, which can serve as the assertion.

D8. FONTFAMILY-OPEN-ITEM-VS-FIXED-OPTIONS — design.md:L14 — D5 leaves open whether `fontFamily` joins the D2 fixed options in M2. If it does, REQ-002 (spec.md:57) and AC-004 (acceptance.md:53) no longer list the full fixed set, and `unit/` fixtures captured without `fontFamily` stop matching the module's output. This is not provisional REQ/AC text, but it is an open decision that would change one. — Severity: minor — Class: optional — Required fix: State in D5 that if `fontFamily` is added, M2 updates REQ-002/AC-004 via manager-spec and re-captures `unit/` fixtures, or decide it now.

D9. STALE-PROGRESS-E1-AND-STATUS — progress.md:L6, L8; spec.md:L5 — §E.1 still reads "iteration 2 대기" and "REQ-025·AC-025는 M1b 뒤 확정되는 잠정 항목". The frontmatter is still `status: draft` although run-phase commits `20eb33f` and `d1dbc02` (`chore(SPEC-PREVIEW-015): M1 …`) exist; the schema assigns `draft → in-progress` to the first run-phase commit. This was not confirmed with the drift tool: `mcp__moai__spec_audit` (filter SPEC-PREVIEW-015) returned `total_specs: 0`, so it is a hypothesis. — Severity: minor — Class: optional — Required fix: Refresh the §E.1 lines. Decide whether M1/M1b, being gate spikes, count as the first run-phase commit, and record the decision.

D10. PDF-AND-COLOUR-MATH-UNMEASURED — spec.md:L190; acceptance.md:L150, L237 — REQ-025 claims PDF shows diagram math without KaTeX CSS. M1b measured HTML file:// and DOCX only (checks.md:74-75), not PDF. AC-020's colour-substitution samples contain no math diagram, so `var(--pele-…)` substitution inside the `foreignObject` wrapper is not exercised. PDF reuses the HTML path, so the risk is low. — Severity: minor — Class: optional — Required fix: Add a math sample to the AC-020 document. Optionally, have AC-025's "no KaTeX CSS" check cover `generateHtmlContent` as well as `exportToHtml`.

## Regression Check (Iteration 2 defects)
- N1 PREVIEW-010 REQ-003 label — RESOLVED: spec.md:207 now reads "**교체** … REQ-PREVIEW010-002와 같이".
- N2 PREVIEW-006 REQ-006 stale — RESOLVED: rewrite row at spec.md:203, plus AC-024 row 27 (acceptance.md:200, `패치` forbidden, `SPEC-PREVIEW-015` required).
- N3 USER_GUIDE line drift — RESOLVED: spec.md:182 and plan.md:132 cite `:206-208`. Verified: docs/USER_GUIDE.md:206 is `### Mermaid 다이어그램` and :208 is the re-colour sentence.
- N4 UI-008 AC block rewrite — RESOLVED: spec.md:214 gives the full replacement Given/When/Then and the new heading.
- N5 completed SPEC body edit — RESOLVED (procedurally): plan.md:120 requires a `moai spec audit --spec SPEC-EXPORT-004` run before editing, and requires the chosen method to be recorded. Choosing the method is deferred to M6, which plan.md:120 states explicitly.

No prior defect is unresolved and none shows stagnation. The score regression comes from new defects introduced by the M1b revision, not from unfixed old ones.

## Recommendation
FAIL with STOP: all must-pass criteria pass, but D1–D5 are blocking, and the score fell from 0.91 to 0.85. Iteration 3 is the cap. The orchestrator should offer the user:
1. PASS-with-debt: one manager-spec pass fixing D1–D5 before the M2 delegation. All five are text-only edits in acceptance.md, design.md, plan.md, spec.md:196 and progress.md, with no scope change. D6–D10 are documented as debt.
2. Explicit override for a 4th audit after that pass, scoped to the D1–D5 delta.

Fix instructions for manager-spec, in order:
1. D2 first: spec.md:196 is copied into 7 SPECs in M6, so fix the source before it spreads. Then update design.md:22 and :32, and plan.md:163, :167 and :188.
2. D1: rewrite AC-005 as a comparison, not a spy, and regenerate spec-compact.md.
3. D3: add the superseding math-support decision record to progress.md §E.2.
4. D4 and D5: update acceptance.md:8, :41 and :237.
5. Optional: D6–D10.
