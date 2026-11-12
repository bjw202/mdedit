# SPEC Review Report: SPEC-AI-015
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.81

Reasoning context ignored per M1 Context Isolation (only spec.md / plan.md / acceptance.md and read-only source were used).
Tier M (spec.md:L14), PASS threshold 0.80. The score clears the threshold, but one blocking defect (D1) makes a normative requirement contradict a must-pass acceptance criterion. That has to be fixed before PASS. The fix is narrow: a scoped delta re-audit is enough.

## Must-Pass Results
- [PASS] MP-1 REQ number consistency: REQ-AI-015-001..014 run in order with no gaps or duplicates, all 3-digit padded (spec.md:L78-L100). There are 14 REQs against the Tier M ceiling of 16, and 9 automated ACs plus M-1..M-3 (12) against the ceiling of 16.
- [PASS] MP-2 EARS format compliance (judged on the **requirement layer**, the REQ-XXX entries in spec.md only): Ubiquitous 001-003 (L78-80), Event-driven WHEN 004-010 (L84-90), State-driven WHILE 011 (L94), legacy IF/THEN 012-014 (L98-100). `moai spec lint` EARS modality check: 0 errors (command and output below). The ACs in acceptance.md are Given-When-Then style and were graded under Group 4, not here. Notes D6 and D7 are minor: legacy IF/THEN without a deprecation marker, and REQ-013/014 placed in the wrong category.
- [PASS] MP-3 YAML frontmatter validity: all 12 canonical fields are present with correct types (spec.md:L2-L13): id `SPEC-AI-015` matches the regex, version `"1.0.0"` is quoted, status `draft`, created/updated ISO, priority `Medium`, phase `"v0.22.0"` (a release label, not a stage name), module path-like, lifecycle `spec-anchored`, tags a comma string. No snake_case aliases. The optional `tier: M` is valid.
- [N/A] MP-4 language neutrality: single-language (TypeScript/CSS) app SPEC; no multi-language tooling.
- [PASS] MP-5 D7 cross-SPEC reconciliation: referenced SPEC-AI-008 and SPEC-AI-011 both resolve to suffix directories (`SPEC-AI-008-diagram-type-picker`, `SPEC-AI-011-diagram-trigger-interaction`), and both have `status: draft` (observed via grep). Neither is retired, superseded, or archived, so there is no BLOCKING finding. spec.md:L21 explains why `depends_on` is deliberately not used.
- [PASS] MP-6 D8 cross-platform discipline: `grep -c syscall spec.md` gives 0, so D8 auto-passes.
- [PASS] MP-7 clarification gate: `grep -rn 'NEEDS CLARIFICATION' .moai/specs/SPEC-AI-015-custom-input-grow/` exits 1 with no matches. There is no research.md (Tier M).

Lint evidence (this run, worktree HEAD of WT-custom-input-grow):
```
$ moai spec lint .moai/specs/SPEC-AI-015-custom-input-grow/spec.md   → exit 0
WARNING   MissingExclusions  ...spec.md  1  'Out of Scope' section missing — minimum one item in Out of Scope subsection required [grandfathered era — downgraded to warning]
0 error(s), 1 warning(s)
```

## Source-anchor verification (read-only, worktree = origin/main 5c617ae base)
| Cited anchor | Observed | Result |
|---|---|---|
| toolbar.ts :382-389 `decideMenuFlipDirection` | L382 `export function decideMenuFlipDirection` with body `spaceBelow >= menuHeight → below; else spaceAbove > spaceBelow ? above : below` | match |
| :451-472 `scheduleMenuFlipMeasurement` | L451; single rAF, viewport-vertical, clip-ancestor-horizontal; only call site L696 | match |
| :639-666 `renderCustomInput` | L639; `<input type=text>`, Enter → trim → `onSubmitCustom`, no IME guard | match |
| :668-672 `setMode`, :674-690 `handleKeyDown` | L668 / L674; Escape order submenu → custom → onClose | match |
| :838-841 `ignoreEvent` | L838 returns true | match |
| CSS :388-394 / :424 / :431-441 | `.mdedit-ai-preset-menu` L388 `min-width:190px`; shared row L424; shared input L431, :437, :438 | match |
| ai-suggestion-card.ts :297-301 | `.mdedit-ai-direct-row` / `.mdedit-ai-direct-input` | match |
| test :402-457, :499-745 | custom-input tests L402-L453; flip describes L499-L745 (rAF stub pattern) | match |
| ResizablePanels.tsx:25 `MIN_PANE_PX = 240` | L25 | match |
| htmlZoom.ts:77 only IME guard | `grep -rn isComposing src` (non-test) finds only htmlZoom.ts:77 | match |
| e2e precedent helpers | `editorPaneRect`, `assertInsidePane`, `collapseSidebar`, `shrinkEditorPane` in ai-008-diagram-submenu-flip.spec.ts; fixture `e2e/fixtures/tauri-v2-ai-mock.ts` exists | match |

## Arithmetic check of AC examples
- `computeCustomMenuWidth`: 800 → 784 ≥ 340 → null; 300 → 284; 150 → 134 → floor 190. All correct (acceptance.md:L72-73).
- `computeCustomInputMaxHeight`: 900−400−20−8 = 472; 100−0−20−8 = 72; 30−20−8 = 2 → floor 28. All correct (acceptance.md:L98).
- `computeCustomInputHeight`: (20,300) → 28/hidden; (120,300) → 120/hidden; (500,300) → 300/auto all correct. **(500,null) → 500/hidden matches the AC, but the plan.md:L30 formula `scrollHeight > maxHeight ? 'auto' : 'hidden'` gives `500 > null` → `500 > 0` → 'auto' in JS** (and does not type-check under strict TS). See D5.
- AC-005 flip example: presets 180 vs below 150 / above 400 → above. Custom max(60,200)=200 > 150 → above. Below 260 ≥ 200 → below. All correct (acceptance.md:L85).

## Category Scores (0.0-1.0, rubric-anchored)
| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 | Decisions D1-D10 are precise (spec.md:L63-72). But the REQ-008 height formula (L88) misses border compensation (D1), D3 and D4 use different vertical boundaries (L65 vs L66, see D2), and R5 contradicts the plan's scheduling signature (spec.md:L143 vs plan.md:L42, see D4). |
| Completeness | 0.85 | 0.75–1.0 | HISTORY L17, Summary/WHY L23-33, Background L35-50, Requirements L74-100, Rejected Alternatives, Delta, Verification Strategy, Risks, Known Limitations, Exclusions L150-157. The exclusions section has no `### Out of Scope — <topic>` H3, which the lint flags as `MissingExclusions` (warning). |
| Testability | 0.75 | 0.75 | No weasel words. The ACs are binary with concrete numbers (acceptance.md:L43-45, L72-75, L97-100). But AC-006's e2e assertion `scrollHeight <= clientHeight + 1` (L100) cannot pass under REQ-008 as written with border-box sizing (D1). M-3 "모양은 이전과 같음" (L147) is a visual judgement. |
| Traceability | 0.90 | 0.75–1.0 | Every REQ has at least one AC (acceptance.md:L155-170). AC-009 traces to no REQ (L137). The Verification Strategy assigns REQ-006 to Playwright (spec.md:L127), but AC-005 has no e2e step (acceptance.md:L81-83). |

## Defects Found (structured defect-list)
D1. HEIGHT-BORDER — spec.md:L88 (REQ-008), plan.md:L30, plan.md:L47, acceptance.md:L100 — REQ-008 sets `height = max(28, min(scrollHeight, cap))`. `scrollHeight` excludes the border. Under `box-sizing: border-box`, which plan.md:L47 sets explicitly and which `.md-root *` (mdedit-components.css:L10) plus the Tailwind preflight also force, `clientHeight = height − 2px`. So content overflows by 2px, the textarea scrolls internally by 2px under `overflow-y: hidden` (caret jitter), and the AC-006 e2e assertion `scrollHeight <= clientHeight + 1` evaluates `S <= S − 1`, which is false. The normative REQ and the must-pass AC contradict each other. — Severity: major — Class: blocking — Required fix: in REQ-008 and the `computeCustomInputHeight` contract, add the vertical border to the measured height. For example, `height = max(28, min(scrollHeight + borderY, cap))` with `borderY = offsetHeight − clientHeight` measured at `height:auto`, or state that the function's `scrollHeight` input already includes the border. Keep the comparison `> cap` consistent with the compensated value, and update the AC-006 unit example to match.

D2. BOUNDARY-MISMATCH — spec.md:L65-66 (D3 vs D4), L87 (REQ-007) — D3 computes the cap against the effective boundary (viewport ∩ clipping ancestor). D4 decides direction with viewport-only spaces (`spaceAbove = anchor.top`, `spaceBelow = innerHeight − anchor.bottom`). When the editor sits under a title/format bar or above a status bar, D4 can choose a direction whose effective space is smaller than the other side's. When that space is under about chrome + 8 + 28 (roughly 56px with `--md-space-1: 3px`), REQ-014's 28px floor pushes the menu outside the pane. That contradicts D3's stated aim (L65 "메뉴가 에디터 패널 아래로 잘리는 경우도 막는다"), and the case is not in Known Limitations. Flip flapping is avoided (D4 decides once and REQ-011 freezes it); the gap is only in containment. — Severity: minor — Class: optional (recommended) — Required fix: feed D4 the same effective-boundary spaces already computed for D3 (`spaceBelow = effBottom − anchor.bottom`, `spaceAbove = anchor.top − effTop`). This is one consistent rect with no new function. Otherwise, add the floor-overflow case to Known Limitations.

D3. HORIZONTAL-CLIP-UNDERSTATED — spec.md:L63 (D1), L139 (R1), L147 — In a narrow pane, D1 sets width = boundaryWidth − 16. A start-aligned menu then fits only if the anchor is within 16px of the pane's left edge, and an end-aligned one only within 16px of the right edge. Since ✨ sits at the selection end (usually mid-line), a narrow-pane custom menu will be clipped horizontally in almost every position, not only "가운데" as R1 says. Before this change the menu was 190px wide, so this widens an existing clip. — Severity: minor — Class: optional — Required fix (minimal, no clamp needed): compute the D1 width from the larger side's free space instead of the full boundary width: `width = clamp(190, max(spaceRight, spaceLeft) − 8, 340)`. The existing horizontal flip then picks that side, the menu stays inside the pane in the common case, and R1 shrinks to "pane narrower than 190+8". If this is declined, reword R1 so it states the actual scope of the clipping.

D4. R5-SIGNATURE-CONTRADICTION — spec.md:L143 (R5), plan.md:L42, plan.md:L101 — R5 claims the rAF callback "reads `mode` at execution time". But plan.md:L42 adds a schedule-time `custom?: { onMaxHeight }` argument to the module-level `scheduleMenuFlipMeasurement`, which has no access to the `createPresetMenu` closure's `mode`. Rapid toggling (custom → presets inside one frame) runs a custom-path callback against presets DOM, where no textarea exists, so the chrome = menu − textarea step reads null. The later presets rAF fixes the final classes, but the earlier callback must not throw. No AC covers R5. — Severity: minor — Class: optional — Required fix: in plan.md, pass a mode getter (`isCustom: () => boolean`) or have the custom branch return early when the textarea is not connected. State one mechanism, not both. Optionally add one jsdom case: enter custom, press ←, flush rAF, expect no throw, no `--custom`, `style.width === ''`.

D5. NULL-COMPARISON — plan.md:L30 — `overflowY: scrollHeight > maxHeight ? 'auto' : 'hidden'` with `maxHeight = null` gives 'auto' (JS coerces null to 0) and fails strict-mode typecheck, which contradicts AC-006's `(500, null) → {500, 'hidden'}` (acceptance.md:L97). — Severity: minor — Class: blocking (plan/AC inconsistency; trivial) — Required fix: `overflowY: maxHeight !== null && scrollHeight > maxHeight ? 'auto' : 'hidden'` (after the D1 border compensation).

D6. LEGACY-IF-THEN — spec.md:L98-100 (REQ-012..014) — These use legacy EARS `IF … THEN` without the `[DEPRECATED — use shall not]` marker. The backward-compat window runs through 2026-11-22, so this is minor. — Severity: minor — Class: optional — Required fix: rephrase REQ-012 as GEARS negative form ("…시스템은 전송·모드 전환·닫힘·preventDefault·stopPropagation 을 하지 않는다"), or add the marker.

D7. REQ-CATEGORY — spec.md:L99-100 — REQ-013 (Escape order preserved while the submenu is open) is a State/Event-driven preservation requirement, and REQ-014 (cap floor) is a Ubiquitous clamp rule. Neither is an unwanted behavior. — Severity: minor — Class: optional — Required fix: move REQ-013 to State-driven (`WHILE 서브메뉴가 열려 있는 동안 조합 중이 아닌 Escape 가 눌리면 …`) and REQ-014 to Ubiquitous. The numbering stays the same.

D8. STRATEGY-AC-DRIFT — spec.md:L127 vs acceptance.md:L81-83 — The Verification Strategy lists REQ-006 under Playwright webkit, but AC-005 runs only `npm test`. Separately, plan.md:L88 (e2e item 6, "Enter → menu closes, request issued") is not owned by any AC. — Severity: minor — Class: optional — Required fix: either drop 006 from the Playwright row, or add an e2e line to AC-005 (for example, re-entering presets after custom input restores a content-fit width under 340 and the `--end` state is recomputed). Then either drop e2e item 6 or attach it to AC-002.

D9. OUT-OF-SCOPE-HEADING — spec.md:L150 — `## Exclusions (What NOT to Build)` has bullets but no `### Out of Scope — <topic>` H3, so lint emits `MissingExclusions` (a warning only because of the grandfathered era). Sibling SPECs (AI-008:L191, AI-011:L282) use the same heading, so this is a repo convention rather than a regression. — Severity: minor — Class: optional — Required fix: add `### Out of Scope — 직접 입력 칸 범위 밖` above the existing bullets.

D10. AC-009-UNTRACED — acceptance.md:L137 — AC-009 (scope/dependency boundary) traces to no REQ. — Severity: minor — Class: optional — Required fix: either accept it as a scope-guard AC and label it "범위 가드 (REQ 없음)", or attach it to Delta L119 as an explicit scope statement. No new REQ is needed.

## Regression Check (Iteration 2+ only)
N/A (iteration 1).

## Other observations (not defects)
- The jsdom/Playwright split is honest. Event branching (Enter, Shift+Enter, `isComposing`, keyCode 229, Escape order) runs on jsdom with synthetic events. Layout-dependent claims (real width, growth, cap containment, `--above` persistence) run on the WebKit full-app e2e. Real IME ordering is left to manual M-1/M-2 with a stated reason (spec.md:L129). REQ-011's jsdom proxy ("no extra rAF scheduled after input", acceptance.md:L112) is a legitimate structural check, paired with the e2e `--above` check.
- SPEC-AI-011 Escape order is preserved by construction. The IME guard is inserted ahead of the unchanged submenu → custom → close chain (plan.md:L45), and REQ-013 plus AC-003's last bullet keep the existing AI-011 tests green. The guard intentionally does not `stopPropagation`. `grep` finds no other `keydown`/Escape listener in ai-selection-toolbar.ts (only L655 and L691), and `ignoreEvent() === true`, so a composing Escape bubbling past `dom` has no in-file consumer.
- Minimality is good. It adds 3 small pure functions and reuses `decideMenuFlipDirection`, `decideMenuHorizontalDirection`, and `findClippingAncestor`, with no new placement module, no resize listener, and no feature creep (exclusions L152-157). `CUSTOM_INPUT_PREFERRED_HEIGHT = 200` is the only heuristic, and it is justified (D4). The 5 named constants are borderline but acceptable for testability. There is no speculative feature to remove.

## Recommendation
FAIL, narrowly. Required before re-audit (blocking):
1. D1: add vertical border compensation to the REQ-008 formula and the `computeCustomInputHeight` contract (spec.md:L88, plan.md:L30), and keep AC-006 (acceptance.md:L97-100) consistent with it.
2. D5: fix the null comparison in the plan.md:L30 formula.

Recommended (optional, cheap):
3. D2: use the effective-boundary spaces for the D4 direction decision (spec.md:L66, REQ-007).
4. D3: compute the D1 width from the larger side's free space (spec.md:L63, REQ-004, AC-004 examples), or reword R1.
5. D4: name one mechanism for the rAF mode check (plan.md:L42 vs spec.md:L143).
6. D6-D10: EARS category and marker tidy-up, Strategy/AC-005 alignment, Out of Scope H3, and AC-009 label.

The iteration-2 re-audit can be scoped to the D1-D10 delta.
