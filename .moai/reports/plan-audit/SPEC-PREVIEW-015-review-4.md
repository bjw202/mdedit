# SPEC Review Report: SPEC-PREVIEW-015
Iteration: 4/3 (explicit user override past the 3-iteration cap)
Verdict: PASS-WITH-DEBT — conditional: blocking items N1–N4 (text-only) must be fixed by manager-spec before the M2 delegation; N1 must land before M2 re-captures `unit/` fixtures
Overall Score: 0.88 (Tier L PASS threshold 0.85; iteration 3 was 0.85, so the score went up and there is no STOP signal)

Reasoning context ignored per M1 Context Isolation. Inputs read (Tier L): spec.md v0.4.1 (275 lines), acceptance.md (303), design.md (46), plan.md (244), progress.md (69), m1/checks.md (89, M1 and M1b tables), spec-compact.md (AC block diffed against acceptance.md, and identical), `node_modules/pele/dist/types.d.ts` (option names). research.md was grepped only; it is unchanged since iteration 2 (mtime 16:00). audit_model is not configured, so this is a Claude-only audit with no MCP backend call.

The scope is the D1–D10 delta from review-3, plus a fresh contradiction sweep over the text those fixes touched: the strict-mode definition, AC-005, AC-025 CSP, `fontFamily`, and the fixture contract.

## Must-Pass Results
- [PASS] MP-1 REQ numbering: `REQ-PREVIEW015-001`..`025` and `AC-PREVIEW015-001`..`025` run with no gaps and no duplicates. Verified with `grep -o '^#### REQ-PREVIEW015-[0-9]*'` and `'^### AC-PREVIEW015-[0-9]*'`, which print 001..025 for both. The counts equal the Tier L ceiling of 25 and do not exceed it.
- [PASS] MP-2 GEARS (requirement layer, spec.md REQ bullets): the changed REQs keep their GEARS forms. REQ-002 uses "The diagram module shall 모든 pele 호출에 … `fontFamily` … 를 넘긴다" (spec.md:58). REQ-003 uses "The diagram sanitize path shall … / shall not …" (spec.md:63-66). REQ-023 uses "The unit-test fixtures … shall …" (spec.md:177). The ACs are Given-When-Then and sit in the verification layer, which this criterion does not grade.
- [PASS] MP-3 frontmatter: spec.md:2-13 has all 12 canonical fields. `version: "0.4.1"` is quoted, `status: draft`, `created`/`updated` are 2026-10-26, `priority: High`, `phase: "v0.17.0 target"` is a release label, `lifecycle: spec-anchored`, and `tags` is a comma string. There are no rejected aliases.
- [N/A] MP-4 language neutrality: this is a single-project TypeScript/Tauri SPEC, not template-bound tooling.
- [PASS] MP-5 D7: the referenced SPEC statuses are AI-001 draft, AI-008 draft, EXPORT-001 implemented, EXPORT-004 completed, PREVIEW-001 approved, PREVIEW-006 planned, PREVIEW-010 draft, and UI-008 draft. None is retired, superseded, or archived, so there is no BLOCKING finding.
- [PASS] MP-6 D8: `grep -c syscall` returns 0 for all five artifacts, so this auto-passes.
- [PASS] MP-7 clarification gate: `grep -rn "NEEDS CLARIFICATION" plan.md research.md design.md` finds no match (exit 1).

## Regression Check (Iteration 3 defects)
- D1 AC-005 spy vs REQ-003 — **RESOLVED**. acceptance.md:55-61 now compares outputs instead of spying: for each non-math `unit/` item, the diagram path and the shared `sanitizeSvg` must give byte-identical results. It states that the module does not call `sanitizeSvg` (:59) and that this is a first-time M2 check with a blocker fallback (:60). spec-compact.md:195 matches.
- D2 stale `sanitizeSvg` "second defence" — **RESOLVED at all six cited sites**: spec.md:197, design.md:22 (D13), design.md:32, plan.md:166, plan.md:170 (the MX REASON now lists 2 real callers), and plan.md:191. One same-class site was missed in review-3 and remains at plan.md:130 (see N3).
- D3 gate-record math decision — **RESOLVED**. progress.md:30 now records the reversal on the same day ("처음에 … 미지원으로 통과시켰다가, 같은 날 결정을 바꿔 … katex를 연결") and calls the old decision "폐기된 중간 결정". The channel is covered by the :28 heading ("AskUserQuestion으로 수집").
- D4 math fixture invariant — **RESOLVED**. acceptance.md:8 gives the provenance "M1에서 … M2에서". AC-002 (:42) exempts `$$…$$` spans and checks the TeX inside `<annotation encoding="application/x-tex">` instead. REQ-023 (spec.md:177), AC-002 (:41), and D14 (design.md:23) require the manifest to record how each math fixture was sized.
- D5 CSP signal mismatch — **RESOLVED**. acceptance.md:241 counts (가) `securitypolicyviolation` events and (나) console CSP rejections separately, both against a no-math baseline. This matches checks.md:76 ("위반 이벤트 0, 콘솔 거부 1 … load-only에도 있음").
- D6 entity rationale — **RESOLVED**. design.md:29 cites checks 확인 10 `svgEqual: true` and keeps the contract as a stricter one. plan.md:187 marks the risk row "M1에서 닫힘".
- D7 trace REQ-003 → AC-025 — **RESOLVED**. acceptance.md:251 now reads `003 | 005, 025`, and AC-025 item 6 (:240) asserts that the global config is unchanged. This matches checks.md:73 ("전역 인스턴스에 다이어그램 설정으로 `sanitize`를 부른 뒤에도 `sanitizeSvg`는 fO를 지움").
- D8 `fontFamily` open item — **RESOLVED as a decision**: it is now a fixed option in REQ-002 (spec.md:58), AC-004 (acceptance.md:53), D2/D5 (design.md:11, :14), and plan.md:83. The option exists in pele (`types.d.ts:17 fontFamily?: string`). However, the fix introduced N1.
- D9 stale §E.1 / status — **RESOLVED**. progress.md:7-10 has been refreshed, and the decision to keep `draft` is recorded with a rationale: M1 and M1b are gate spikes, and the transition happens at the first M2 commit.
- D10 PDF and colour math unmeasured — **RESOLVED in text**. AC-020 (acceptance.md:153, :156) adds the `18-math-label` sample and an inside-fO substitution check. AC-025 (:241) covers `generateHtmlContent`, and :243 adds a manual PDF check. The AC-020 part can pass vacuously (see N4).

No prior defect is unresolved, so no stagnation flag applies.

## Category Scores (0.0-1.0, rubric-anchored)
| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.80 | 0.75 | Most fixes read cleanly: spec.md:63-66, acceptance.md:55-61, design.md:13. Three spots allow two readings. "M1 픽스처" is undefined once M2 re-captures `unit/` (N1). The strict-mode definition's exclusive list "foreignObject.pele-math·MathML만" (spec.md:197) leaves out the wrapper `div` that REQ-003 and D4 allow (N2). plan.md:130 and :166 prescribe different MX wording for the same tag (N3). |
| Completeness | 0.92 | 1.0 | All sections are present, including the HISTORY 0.4.1 row (spec.md:29), Exclusions with H3 headings and bullets (spec.md:228-262), the §E.1 refresh, and the gate records. The fixture lifecycle across the M1→M2 re-capture is under-specified (N1). |
| Testability | 0.85 | 0.75–1.0 | AC-005, AC-007, AC-020, and AC-025 items 1-6 are binary. AC-020's in-fO check passes vacuously in jsdom unless math sizes are injected (N4). AC-025 asserts that the known KaTeX_Size3 rejection must be present in the baseline, which breaks once `t1` is fixed (N5). AC-004's "same font list as `--pele-font`" is ambiguous if the token is written as `var(--md-…)` (N6). |
| Traceability | 0.95 | 1.0 | The trace table (acceptance.md:247-273) covers REQ-001..025. Every AC cites existing REQs, and the 003 row now lists 005 and 025. |

Aggregate (mean) = (0.80 + 0.92 + 0.85 + 0.95) / 4 = 0.88, which is ≥ 0.85 and higher than iteration 3 (0.85).

## Evidence consistency (changed text vs m1/checks.md)
| Claim | Evidence | Consistent? |
|---|---|---|
| Separate instance does not inherit the shared href hook; re-register it (spec.md:64, :197; design.md:13, :22) | checks.md:73 `freshInstanceInheritsSharedHrefHook: "no (data: href kept)"`, global hook 43 runs | Yes |
| Global config unchanged after a diagram-path call (AC-025 item 6) | checks.md:73 last sentence | Yes |
| Shared `sanitizeSvg` × M1 `unit/` 38 pairs byte-identical (D4, AC-025 item 4) | checks.md:70 `a_before 0 / a_afterDiagramInstance 0 / a_final 0` | Yes for the M1 set; see N1 for post-M2 identity |
| Non-math equality of the two paths is unmeasured (AC-005 :60) | checks.md:70 (2a shared only), :71 (2b math only) | Yes, honestly scoped |
| CSP counted as events + console separately vs baseline (AC-025 :241) | checks.md:76 | Yes |
| Wrapper `div`, `semantics`, `annotation` needed in the allow-list (REQ-003, D4) | checks.md:71 (0/2 before `ADD_TAGS`) | Yes for REQ-003; the strict-mode definition omits `div` (N2) |
| jsdom sizes = 0 → raw `$$…$$` (D15, AC-025 inject) | checks.md:69 | Yes for AC-025; AC-020 does not inject (N4) |
| `fontFamily` changes measurement (D5) | pele.js measurer `Je(n.fontFamily,n.fontFamilyMono)` | Yes; `fontFamilyMono` is not fixed (N7) |

## Defects Found (structured defect-list)
N1. FIXTURE-IDENTITY-AFTER-RECAPTURE — spec.md:L66, acceptance.md:L57, L58, L238, design.md:L14 — D5 (design.md:14) and plan.md:83 now require M2 to **re-capture** `unit/` fixtures after adding `fontFamily`, under the same manifest. Three places still treat the M1 captures as the standing baseline. REQ-003 (spec.md:66) says the shared `sanitizeSvg` result must be byte-identical to "M1 픽스처". AC-005 (:57) says the raw inputs are "M1 캡처" and calls the post-sanitize match a "회귀 확인" of M1b 2a (:58). AC-025 item 4 (:238) says "M1 픽스처(`unit/` 38쌍)". After the M2 re-capture, and once math fixtures are added, the M1 set no longer exists in `unit/`, and the count is no longer 38. The post-sanitize fixtures would then be produced by the same function they are meant to regress, which makes the check circular. This contradiction was introduced by the D8 fix. — Severity: major — Class: blocking — Required fix: Choose one model and state it in D5, D14, REQ-003, AC-005, and AC-025. Either (a) keep the M1 shared-sanitizer pairs frozen as a separate baseline set (e.g. `unit-m1/`, never re-captured), and point REQ-003, AC-005's post-sanitize check, and AC-025 item 4 at that set; or (b) reword those three texts to "the `unit/` set current at the time of the test", and drop the "M1" and "38쌍" wording and the "회귀 확인 of 2a" framing. Option (a) keeps the regression meaningful.

N2. STRICT-DEF-ALLOWLIST-OMITS-DIV — spec.md:L197 (also plan.md:L166) — The common "strict 모드" definition, which M6 copies into 7 SPECs, says "수식용 `foreignObject.pele-math`·MathML**만** 추가로 허용한다". REQ-003 (spec.md:63), REQ-025 (:189), D4 (design.md:13), and the Exclusions (:258) also allow "pele가 만드는 감싸기 `div`". `div` is not MathML, so the exclusive "만" contradicts the REQ. plan.md:166 ("수식용 MathML만 추가 허용") also omits `foreignObject` and `div`. — Severity: minor — Class: blocking (internal contradiction in text that propagates to 7 SPECs) — Required fix: In spec.md:197, list the allowed additions exactly as REQ-003 does, or replace the list with "REQ-003이 정한 수식 허용 목록만". Mirror the fix in plan.md:166 and regenerate spec-compact.md.

N3. STALE-STRICT-MX-WORDING-M7 — plan.md:L130 — The M7 MX bullet still tells the implementer to replace the `securityLevel` comments with "strict 모드 = pele + sanitizeSvg + links:false". The MX table at plan.md:166 gives the corrected wording for the same edit (`PreviewRenderer.tsx:25-28`). This is the same defect class as iteration-3 D2, at a site that review-3 did not enumerate. — Severity: minor — Class: blocking — Required fix: Change plan.md:130 to refer to the plan.md:166 wording ("MX 표의 strict 모드 문구로 교체"), or delete the inline quotation.

N4. AC020-MATH-CHECK-VACUOUS-IN-JSDOM — acceptance.md:L153, L156 — AC-020 is a unit test in jsdom, where the math resolver measures 0×0 and pele falls back to raw `$$…$$` text with no `foreignObject` (checks.md:69, design.md:23). AC-025 (:233) injects sizes for this reason, but AC-020 does not. The check "`var(--pele-` 0번 … `foreignObject.pele-math` 감싸기 안쪽 포함" therefore passes trivially and does not exercise what D10 asked for. — Severity: minor — Class: blocking (an AC whose stated coverage cannot be exercised as written) — Required fix: In AC-020's Given, add "수식 다이어그램은 AC-025와 같이 해석기에 크기를 주입해 렌더한다". Add an assertion that the math diagram's SVG contains ≥1 `foreignObject.pele-math` before the substitution checks run.

N5. AC025-BASELINE-MUST-CONTAIN-KNOWN-DEFECT — acceptance.md:L241 — "이 1건은 기준 렌더에도 있어야 한다" turns a relative comparison into an assertion that the KaTeX_Size3 rejection exists. When backlog `t1` fixes the CSP, both counts drop to 0 and this clause can fail the AC. The comparison against the baseline is already enough to exclude the known defect. — Severity: minor — Class: optional — Required fix: Reword as "기준 렌더에 있는 거부(현재 KaTeX_Size3 1건)는 비교에서 상쇄된다", without requiring it to be present.

N6. AC004-FONT-LIST-EQUALITY-UNDER-VAR — acceptance.md:L53, spec.md:L58 — D5 links `--pele-*` to `--md-*` tokens. If `--pele-font` is written as `var(--md-…)`, its text value is not a font list. jsdom cannot compute it either, so "the constant equals the `--pele-font` font list (both blocks)" has no single test procedure. — Severity: minor — Class: optional — Required fix: Say how the comparison is made: either `--pele-font` is a literal list identical to the constant, or the test resolves one level of `var(--md-…)` from `mdedit-tokens.css` text.

N7. FONTFAMILYMONO-NOT-FIXED — design.md:L14, spec.md:L58 — pele's measurer takes both `fontFamily` and `fontFamilyMono` (`pele.js`: `Je(n.fontFamily,n.fontFamilyMono)`; `types.d.ts:18`). D5 maps `--pele-font-mono` to an app token but fixes only `fontFamily`, so the measurement-vs-display mismatch the D5 rule fixes for the sans font remains for mono text. — Severity: minor — Class: optional — Required fix: Either add `fontFamilyMono` to the D2 fixed options, with the same constant and re-capture rule, or record in D5 why mono is left at the default.

N8. MINOR-STALE-HISTORY-TEXT — plan.md:L190, L240 — The risk row "`sanitizeSvg`가 pele 출력의 일부를 지움" still names the shared function as the diagram's sanitizer. The decision-history line still lists "수식 라벨 미지원(D15)" with no superseded note. The `browser/` fixtures (M1, captured without `fontFamily`) are kept as "e2e 기대값 참고" but are not re-captured, so they will drift from module options. — Severity: minor — Class: optional — Required fix: Retarget the risk row to the diagram sanitize path. Append "(→ M1b 뒤 지원으로 변경, design.md D15)" to the history line. Note in D14 that `browser/` options differ from the module after M2, or re-capture them as well.

## Recommendation
PASS-WITH-DEBT. All seven must-pass criteria pass with evidence. All ten iteration-3 defects are resolved at their cited sites. The aggregate rose from 0.85 to 0.88, above the Tier L threshold. The remaining blocking items are text-only and introduce no scope change. The condition is that manager-spec fixes them before the M2 delegation; otherwise this verdict reverts to FAIL:

1. N1 first, because M2 is what performs the re-capture. Pick the frozen-M1-baseline model or the current-set model, and make D5, D14, REQ-003 (spec.md:66), AC-005 (acceptance.md:57-58), and AC-025 item 4 (:238) agree.
2. N2: make spec.md:197 list the same allow-list as REQ-003, including the wrapper `div`, before M6 copies it. Mirror the fix in plan.md:166.
3. N3: fix plan.md:130.
4. N4: add size injection and a non-vacuity assertion to AC-020.
5. Regenerate spec-compact.md (it currently mirrors acceptance.md exactly, so it inherits N1, N2, and N4).

N5–N8 are optional debt and can be left to the orchestrator. A confirming check of the N1–N4 delta can be done by the orchestrator as a grep/diff of the five edited spans. It does not need a full fifth audit, because the verdict authority given here is conditional on exactly those spans.
