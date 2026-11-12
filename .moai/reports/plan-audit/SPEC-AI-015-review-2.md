# SPEC Review Report: SPEC-AI-015
Iteration: 2/3
Verdict: PASS (with debt: 1 SHOULD-FIX and 4 MINOR, all at AC-wording or test-setup level; no requirement change needed)
Overall Score: 0.92

Reasoning context ignored per M1 Context Isolation. The coordinator's change summary was used only as a map of where to look; every resolution below was verified against the committed files (commit 33d2a0c, spec.md / plan.md / acceptance.md re-read in full).
Tier M (spec.md:L14), PASS threshold 0.80. Score trend 0.81 → 0.92 (no regression, so no STOP signal).

## Must-Pass Results
- [PASS] MP-1 REQ number consistency: REQ-AI-015-001..014 each appear exactly once (`grep -o 'REQ-AI-015-0[0-9][0-9]\*\*' spec.md | sort | uniq -c` shows 14 IDs, count 1 each). There are no gaps. Listing order now follows category (014 under Ubiquitous at L82; 013 before 012 at L97/L101). The ID set is still complete and unique, so this is a presentation nit (see N4). Budget: 14 REQs and 12 ACs (9 automated + M-1..M-3), both within the Tier M ceiling of 16.
- [PASS] MP-2 EARS/GEARS compliance (**requirement layer only**): Ubiquitous 001-003, 014 (L79-82); Event-driven WHEN 004-010 (L86-92); State-driven While 011, 013 (L96-97); Unwanted 012 (L101) is now in GEARS negative form ("아무 동작도 하지 않아야 한다"). The legacy IF/THEN entries are gone. `moai spec lint` gives "✓ No findings" (below). The ACs are graded under Group 4 only.
- [PASS] MP-3 YAML frontmatter: all 12 canonical fields are present with correct types and no rejected aliases (spec.md:L2-L13). `phase: "v0.22.0"` is a release label.
- [N/A] MP-4 language neutrality: single-language TypeScript/CSS SPEC.
- [PASS] MP-5 D7: SPEC-AI-008 and SPEC-AI-011 resolve to suffix directories with `status: draft` (verified in iteration 1; the references are unchanged at L21, L168). Neither is retired, superseded, or archived.
- [PASS] MP-6 D8: `grep -c syscall spec.md` gives 0.
- [PASS] MP-7 clarification gate: `grep -rn 'NEEDS CLARIFICATION' .moai/specs/SPEC-AI-015-custom-input-grow/` exits 1 with no matches.

Lint evidence (this run, HEAD 33d2a0c):
```
$ moai spec lint .moai/specs/SPEC-AI-015-custom-input-grow/spec.md
✓ No findings — all SPEC documents are valid
exit=0
```
(Iteration 1's `MissingExclusions` warning is gone.)

## Arithmetic re-check (all recomputed by hand)
**AC-004 `computeCustomMenuWidth(spaceRight, spaceLeft)`** with `w = max(R, L) − 8`, null if `w ≥ 340`, else `max(190, w)` (plan.md:L31):
(800,0) → 792 → null ✓ · (348,0) → 340 → null ✓ (boundary) · (347,0) → 339 ✓ · (200,100) → 192 ✓ · (100,250) → 242 ✓ · (150,100) → 142 → 190 ✓.
Wiring: R200/L100 → 192, then horizontal flip spaceRight 200 ≥ 192 → start, no `--end` ✓. R100/L250 → 242, then 100 < 242 and 250 > 100 → end, `--end` ✓ (see N1 for the mock dependency). Containment holds by construction: the chosen side's space is at least w + 8.

**AC-005 vertical** (plan.md:L37): unclipped examples: presets 180 vs below 150 / above 400 → above ✓; custom max(60,200)=200 > 150 → above ✓; below 260 ≥ 200 → below ✓. Clipped example: effective bottom = min(900, 700) = 700, so spaceBelow = 700 − 550 = 150 and spaceAbove = 400 − 0 = 400; 150 < 200 and 400 > 150 → above ✓. On the viewport alone it would be 900 − 550 = 350 ≥ 200 → below, so the case actually discriminates the D4 change. Good test design.

**AC-006 `computeCustomInputHeight(scrollHeight, borderY, maxHeight)`** with `need = sh + bY` (plan.md:L33):
(20,2,300) → need 22 → 28/hidden ✓ · (120,2,300) → 122/hidden ✓ · (298,2,300) → 300, 300 > 300 false → hidden ✓ · (299,2,300) → 301 → 300/auto ✓ · (500,2,300) → 300/auto ✓ · (500,2,null) → 502/hidden ✓ (null guard explicit).
`computeCustomInputMaxHeight`: 900−400−20−8 = 472 ✓ · 100−0−20−8 = 72 ✓ · 30−20−8 = 2 → 28 ✓.
Wiring: sh 500, offsetHeight 30, clientHeight 28 → bY 2 → need 502 > cap → height = cap, auto ✓.
e2e border check: border-box height = S + 2 → clientHeight = S → `scrollHeight (S) <= clientHeight + 1` holds ✓ (iteration-1 D1 contradiction removed).

## Category Scores (0.0-1.0, rubric-anchored)
| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.90 | 0.75–1.0 | D1/D4/D5/D9 are now single-interpretation and cross-file consistent (spec.md:L64, L67-68, L72 ↔ plan.md:L14-L22, L31-L37, L47 ↔ REQ-004/007/008 L86-L90). Remaining ambiguity is limited to AC wording (N1, S1). |
| Completeness | 0.95 | 1.0 | All sections are present, including `### Out of Scope — 본 SPEC 이 만들지 않는 것` (L155) and Known Limitations R1/R6 (L149-150). Lint is clean. |
| Testability | 0.85 | 0.75–1.0 | Every AC is binary with numeric oracles (acceptance.md:L73-76, L86-87, L99-102). One e2e scenario is underdetermined against R1 (S1), and one jsdom expectation depends on an unstated mock behaviour (N1). |
| Traceability | 1.00 | 1.0 | Every REQ maps to at least one AC (acceptance.md:L157-172). AC-009 is explicitly labelled a scope guard tied to §Delta/§Exclusions (L130, L139). The Verification Strategy now matches the AC commands (spec.md:L126-128 ↔ AC-002 e2e L46, AC-005 jsdom). |

## Defects Found (structured defect-list)
S1. AC004-MIDDLE-VS-R1 — acceptance.md:L76, plan.md:L90 vs spec.md:L140/L149 (R1) — **SHOULD-FIX** — The e2e case "에디터 패널 ≈ 300px, ✨ 가 줄 중간" asserts the menu stays inside `.md-editor` (±1px). But with clip width W ≈ 300 and an anchor of about 24px, spaceRight + spaceLeft ≈ W + 24 = 324. Both sides fall below 198 (the R1 zone, a declared Known Limitation where the menu clips) whenever the anchor's left edge is about 102–174px from the clip's left edge, which is literally "the middle of the line". A tester who places ✨ at mid-pane is reproducing a case the SPEC says will clip, so the AC is not reliably satisfiable as worded. — Class: optional per M6. The requirements (D1, REQ-004, R1) are correct and consistent; only the e2e scenario's parameters are underdetermined. Fix it before run anyway: a run-phase e2e failure here would bounce back to plan. — Required fix (one phrase, pick one): (a) for the mid-line case use a pane ≈ 420px (W + 24 ≥ 2 × 198 ⇒ W ≥ 372, so containment holds at any anchor position); or (b) keep ≈ 300px but place ✨ in the left third of the line (e.g. selection ending ≤ 90px from the pane's left edge) and at line end. Optionally add one non-asserting note that the exact-center 300px case is R1.

N1. AC004-MOCK-WIDTH — acceptance.md:L73, plan.md:L17 — **MINOR** — The custom branch re-reads `dom.getBoundingClientRect()` after applying the inline width, then feeds `menuRect.width` to the horizontal flip. In jsdom the rect is a static mock, so the expectation "spaceRight 100 · spaceLeft 250 → `--end`" passes only if the mocked width is > 100. The existing flip tests at test.ts:L499-745 mock `width: 0`, which would produce no `--end`. — Class: optional — Fix: in AC-004 or the plan's test plan, state that the menu-rect mock returns the applied width (e.g. `width: parseFloat(dom.style.width) || 340`).

N2. REQ014-CONDITIONAL-UBIQUITOUS — spec.md:L82 — **MINOR** — REQ-014 sits under Ubiquitous but keeps a conditional ("…28px 미만이면, …28px 로 잡아야 한다"). Lint accepts it. — Class: optional — Fix: "프리셋 메뉴는 textarea 높이 상한을 28px 이상으로 잡아야 한다(D3 결과가 더 작으면 28px)."

N3. HISTORY-VERSION — spec.md:L22 — **MINOR** — The revision row reuses version `1.0.0`. This is harmless while the SPEC is `draft`, but the HISTORY can't tell the two states apart. — Class: optional — Fix: label the row `1.0.0 (rev. plan-audit 1)` or bump to `1.0.1`.

N4. REQ-LISTING-ORDER — spec.md:L79-101 — **MINOR** — Reclassification left the IDs non-monotonic in document order (001-003, 014, 004-010, 011, 013, 012). The set is complete and unique, so MP-1 passes, and renumbering would churn the AC table for no gain. — Class: optional — Fix: none required. Optionally add a one-line note under "Requirements" that IDs are stable and grouped by GEARS category.

## Regression Check (Iteration 1 defects)
- D1 HEIGHT-BORDER — **RESOLVED**: `need = scrollHeight + (offsetHeight − clientHeight)` appears in D9 (spec.md:L72), REQ-008 (L90), plan.md:L22/L33, and AC-006 (acceptance.md:L99-101). The e2e border inequality now holds (arithmetic above).
- D2 BOUNDARY-MISMATCH — **RESOLVED**: D4 (b) uses the effective boundary for custom mode (spec.md:L67; plan.md:L18, L37), and REQ-007 (L89) says the same. Preset mode stays on the viewport, protected by REQ-003 (L81) and Out of Scope (L160). AC-005's clipped case discriminates the change. The residual floor-overflow case is declared as R6 (L141, L150).
- D3 HORIZONTAL-CLIP — **RESOLVED**: D1 `clamp(190, max(R, L) − 8, 340)` (spec.md:L64; plan.md:L31) reuses the horizontal-flip spaces. R1 is narrowed to "both sides < 198" (L140, L149). See S1 for the matching e2e wording.
- D4 R5-SIGNATURE — **RESOLVED**: the `getCustomInput()` getter (spec.md:L68; plan.md:L15, L47) has an `isConnected` guard (L14), and the round-trip jsdom test is in AC-005 (acceptance.md:L87) and plan.md:L81. R5 (spec.md:L145) is consistent with it.
- D5 NULL-COMPARISON — **RESOLVED**: `maxHeight !== null && need > maxHeight` (plan.md:L33); REQ-008 states the null behaviour (spec.md:L90); AC example (500,2,null) → 502/hidden.
- D6 LEGACY-IF-THEN — **RESOLVED**: no IF/THEN remains; REQ-012 uses a GEARS negative (spec.md:L101).
- D7 REQ-CATEGORY — **RESOLVED**: REQ-013 moved to State-driven (L97), REQ-014 to Ubiquitous (L82).
- D8 STRATEGY-AC-DRIFT — **RESOLVED**: REQ-006 moved to the jsdom wiring row (spec.md:L127), and REQ-009 e2e added to AC-002 (acceptance.md:L46; plan.md:L94).
- D9 OUT-OF-SCOPE-HEADING — **RESOLVED**: `### Out of Scope — 본 SPEC 이 만들지 않는 것` (spec.md:L155); lint is clean.
- D10 AC-009-UNTRACED — **RESOLVED**: labelled as a scope guard tied to §Delta/§Exclusions (acceptance.md:L130, L139).

No regressions were introduced. The new R6 is accurate (28 + chrome ≈ 14–20 + 8 → roughly 50–56px). Minimality is preserved: no new placement function, the only new mechanism is one getter, and the 5 constants are unchanged in kind.

## Recommendation
PASS. Rationale per must-pass: MP-1 has 14 unique sequential IDs; MP-2 is GEARS-clean with lint "No findings"; MP-3 has all 12 fields; MP-5/6/7 are clear; MP-4 is N/A. The score is 0.92 against a 0.80 threshold, and all 10 iteration-1 defects are resolved with line evidence.
Debt to clear before `/moai run` (a one-phrase edit; no re-audit needed for it alone): **S1**, fixing the AC-004 / plan e2e mid-line scenario so it can't land in the R1 zone. N1-N4 are optional.
