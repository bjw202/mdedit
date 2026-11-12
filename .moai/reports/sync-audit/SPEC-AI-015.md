# Sync Audit — SPEC-AI-015 (AI direct-input auto-growing textarea, card t7)

Auditor: sync-auditor (independent, read-only; no code or SPEC body modified)
Tree: `.claude/worktrees/t7`, branch `WT-custom-input-grow`, HEAD `08cf049`
Scope audited: `git diff origin/main...HEAD` (merge-base `c42e7eb`) plus `git diff 5c617ae...HEAD`
Profile: built-in default (Functionality 40 / Security 25 / Craft 20 / Consistency 15; must-pass = Functionality + Security), flat weighted scoring

## Overall Verdict: PASS-WITH-DEBT

Overall score: 0.91 (weighted harmonic mean of 88 / 95 / 90 / 92). No blocking finding. Must-pass dimensions (Functionality, Security) both clear their thresholds. The debt is verification-layer: the width-shrink path is covered only by jsdom mocks, and the manual checks M-1, M-2 and M-3 are still pending (already disclosed by the implementer).

## Dimension Scores

| Dimension | Score | Verdict | Evidence (verbatim, this run, this tree) |
|-----------|-------|---------|------------------------------------------|
| Functionality (40%) | 88/100 | PASS | `npx vitest run src/test/aiSelectionToolbar.test.ts src/test/aiSuggestionCard.test.ts` -> `Test Files  2 passed (2)` / `Tests  166 passed (166)`. Code read: REQ-001..014 each map to code and a test (table below). Deductions: e2e shrink path not exercised in real layout (F1), IME guard verified in jsdom only, M-1..M-3 pending. |
| Security (25%) | 95/100 | PASS | Grep of added lines for `innerHTML\|outerHTML\|insertAdjacentHTML\|eval(\|new Function\|dangerouslySetInnerHTML\|document.write\|password\|secret\|api[_-]?key\|token` -> `(no matches)`. The textarea value is trimmed and passed as a plain string to `callbacks.onSubmitCustom`. No new dependency (`package.json` not in diff). Trust boundary for the instruction is unchanged by this SPEC. |
| Craft (20%) | 90/100 | PASS | `npx tsc --noEmit -p .` -> exit 0, no output. `npx eslint <3 changed files>` -> exit 0, no output. Coverage of `ai-selection-toolbar.ts`: `93.19 | 93.25 | 82 | 93.19` (Stmts/Branch/Funcs/Lines); uncovered lines are `...1128,1131-1134`, outside the SPEC-AI-015 region (ends near line 890). Deductions: 6 fixed `waitForTimeout` calls in the e2e (F5), `scrollTop` hazard not guarded (F3). |
| Consistency (15%) | 92/100 | PASS | `git diff origin/main...HEAD --stat -- src e2e package.json` -> 4 files (`e2e/ai-custom-input-grow.spec.ts`, `ai-selection-toolbar.ts`, `mdedit-components.css`, `src/test/aiSelectionToolbar.test.ts`), 732+/25-; `ai-suggestion-card.ts` diff empty. Same four files as the SPEC Delta. Reuses `decideMenuFlipDirection` and `decideMenuHorizontalDirection`. MX tags follow the repo style (`@MX:WARN` with `@MX:REASON`, `@MX:NOTE`, `@MX:SPEC`). Deduction: single-row textarea is about 2px taller than the 28px back button (F6). |

Weighted harmonic mean: 1 / (0.40/88 + 0.25/95 + 0.20/90 + 0.15/92) = 90.7, reported as 0.91.

## REQ / AC to Test Mapping

| REQ | AC | Implementation | Test | Layer observed |
|-----|----|----------------|------|----------------|
| 001 textarea, rows=1, placeholder, focus | 001 | `ai-selection-toolbar.ts` `renderCustomInput` | test @402 `morphs into an auto-growing textarea ... REQ-001` | jsdom (run, pass) |
| 002 direct-input CSS unchanged | 008 | CSS diff removes only `custom` selectors from shared lists | `aiSuggestionCard` 59 tests | CSS diff read + jsdom |
| 003 preset width/vertical rule unchanged | 004 | non-custom branch keeps `window.innerHeight` boundary | existing flip tests (107 pass) | jsdom + diff read |
| 004 `--custom` class, inline width < 340 | 004 | `setMode` toggles the class; rAF applies `computeCustomMenuWidth` | @1487, @1506, @1520 + pure-fn describe @1275 | jsdom; e2e checks only the 340 case |
| 005 class and width removed on return | 004 | `setMode('presets')` | @1487 | jsdom |
| 006 re-measure on every mode switch | 005 | `setMode` calls `scheduleMenuFlipMeasurement` | @1529 | jsdom |
| 007 vertical decision with pref. height 200, effective boundary, stored cap | 005, 006 | rAF callback + `computeCustomInputMaxHeight` | @1543, @1558, @1572 | jsdom |
| 008 height/overflow on input | 006 | `applyCustomHeight` + `computeCustomInputHeight` | pure-fn describe @1327, @1572; e2e 3-line and 60-line | jsdom + WebKit e2e (per progress.md, not re-run by me) |
| 009 Enter submits trimmed value once | 002 | keydown handler | @1420, @1433; e2e Enter | jsdom + e2e |
| 010 Shift+Enter newline | 002 | `!event.shiftKey` guard | @1445 | jsdom |
| 011 no direction re-decision while typing | 007 | `input` handler only calls `applyCustomHeight` | @1591; e2e `--above` kept | jsdom + e2e |
| 012 IME guard (Enter and Escape) | 003 | `event.isComposing \|\| event.keyCode === 229` in textarea handler and root `handleKeyDown` | @1457 (isComposing and keyCode 229, Enter), @1472 (isComposing, Escape) | jsdom only |
| 013 diagram-submenu Escape order preserved | 003 | root guard sits before the existing order | existing SPEC-AI-011 tests (107 pass) | jsdom |
| 014 cap floor 28px | 006 | `Math.max(CUSTOM_INPUT_MIN_HEIGHT, ...)` | pure-fn describe @1291 | jsdom |

Every REQ has at least one test. No orphan REQ.

## Checks requested by the card

1. **Merge with SPEC-AI-012/013, no semantic regression.** Deleted lines in `git diff origin/main...HEAD` for the toolbar are only the 015-owned lines: the old `scheduleMenuFlipMeasurement` signature and body, the `<input>` creation, the old Enter check, the old `setMode` body, and the old call site. The CSS deletions are the four shared selector lines that SPEC-AI-015 splits. `grep -c mdedit-ai-completion-notice mdedit-components.css` -> `1`, so the SPEC-AI-013 rule survives exactly once. The 166 targeted tests include the 012/013 suites and all pass. I did not re-run the full suite (card instruction).
2. **IME guard (REQ-012) logic.** Textarea keydown: guard first, then `Enter && !shiftKey`. Root `handleKeyDown`: guard first, then the `Escape` branch. The Escape from the textarea bubbles to the root, so the root guard is what protects composition-cancel Escape. The guard returns without `preventDefault` or `stopPropagation`, as REQ-012 requires. The logic is correct against the documented WebKit ordering (compositionend before the confirming keydown, keyCode 229 as the secondary signal). The test for Escape covers `isComposing: true` only; the keyCode 229 Escape path is untested (F2).
3. **Height ceiling.** The cap is `max(28, available - chrome - 8)`, with `chrome = menuRect.height - ta.offsetHeight`, computed after the width is applied and the rect re-read (correct order, per the `@MX:NOTE`). `computeCustomInputHeight` adds `borderY` as D9 requires. Verified by the pure-function table and the wiring test (338px).
4. **Direction (`--above`) preservation.** Direction is decided in the rAF only. The `input` handler schedules no rAF (@1591 asserts 0 pending callbacks). The e2e at spec line 138 asserts that `--above` survives a 60-line fill (per progress.md; not re-run by me).
5. **Dark mode and suggestion-card isolation.** `grep` for `mdedit-ai-(custom|direct)-(input|row)` shows `ai-suggestion-card.ts` uses only `mdedit-ai-direct-row` and `mdedit-ai-direct-input` (lines 346, 349). The CSS rules for the `direct` pair are unchanged apart from the shortened selector lists. No dark-mode-specific rule references either class (`grep` -> `(none)`). The new `custom` rules use only existing tokens, so dark mode is inherited. Real dark-mode appearance is not observed (M-3 pending).

## Findings

- F1 [Medium] [optional] `e2e/ai-custom-input-grow.spec.ts:93-101` - AC-004 requires an e2e case where the sparkle sits mid-line in a narrow pane and asserts menu width < 340. The implemented narrow-pane tests use a 420px pane with the sparkle at line start or line end. By geometry (not observed by running the e2e), one side then has about 400px of room, so `computeCustomMenuWidth` returns `null`, the width stays 340, and the assertion `w <= 342` cannot fail on a shrink regression. The shrink branch (D1, R1 mitigation) is therefore verified only by jsdom rect mocks. progress.md lines 60-61 already disclose the missing assertion. Confidence: medium. Required fix: add an e2e case with the sparkle mid-line (or a pane narrow enough, around 300px, that both sides are under 348px) asserting width < 340 and containment in `.md-editor`.
- F2 [Low] [optional] `src/test/aiSelectionToolbar.test.ts:1472` - the IME Escape test covers `isComposing: true` only. The `keyCode === 229` branch of the root guard (`ai-selection-toolbar.ts` `handleKeyDown`) has no Escape test, although it is the WebKit-specific half of the guard. Confidence: high. Required fix: parametrize the test with `it.each` over `{isComposing: true}` and `{keyCode: 229}`.
- F3 [Low] [optional] `ai-selection-toolbar.ts:779-787` (`applyCustomHeight`) - every keystroke sets `height = 'auto'` and then restores the height. In some WebKit/Chromium versions this resets `scrollTop` when the textarea is at its cap, which can move the caret out of view when typing at the end of a long, scrolled input. This is a known pattern, not reproduced here, and the e2e uses `fill()`, which does not exercise caret-driven scrolling. Confidence: low. Required fix: check during M-3; if it reproduces, save `scrollTop` before `height = 'auto'` and restore it after.
- F4 [Low] [optional] `CHANGELOG.md:8` - the entry says AC-AI-015-001..009 pass in automated verification and mentions only the IME and manual items as pending. It does not mention that the AC-004 mid-line width assertion was not implemented in the e2e (see F1). Confidence: high. Required fix: add one clause to the entry, or close F1.
- F5 [Info] [optional] `e2e/ai-custom-input-grow.spec.ts:62,84,127,145` and two more (`grep -c waitForTimeout` -> `6`) - fixed sleeps stand in for the rAF measurement. This is a flake risk on a loaded machine. Confidence: medium. Required fix: wait on an observable (for example `expect(menu).toHaveClass(...)` or a width poll) instead.
- F6 [Info] [optional] `src/styles/mdedit-components.css:443-450` - a one-row textarea computes to about 30px (13px font from `--md-fs-titlebar`, `line-height: 1.4`, 5px vertical padding, 1px border -> 18.2 + 10 + 2), while `.mdedit-ai-back` is 28px and the row is `align-items: flex-start`. This leaves a roughly 2px misalignment between the back button and the first line. Computed from the CSS, not seen on screen. Confidence: medium. Required fix: none unless M-3 shows it; if so, set the textarea `padding` or `line-height` so one row equals 28px.

No blocking finding. No Critical or High security finding.

## Recommendations

- Close F1 and F2 before or together with the manual pass; they are small, and F1 turns a disclosed gap into an observed result.
- During M-3, look specifically for F3 (caret leaving view at the cap) and F6 (button and first-line alignment), in light and dark mode.
- Leave the SPEC at `implemented` until M-1, M-2 and M-3 are confirmed, as progress.md already states.

## Gaps (not observed by this audit)

- I did not run the Playwright WebKit e2e (CPU limit in the brief). The e2e results (7 passed) are quoted from progress.md, not re-observed.
- I did not run the full vitest suite. The claim "2131 passed (121 files)" in progress.md is not re-observed. The earlier gate row in the same file reads `2071 / 118 files`; the two numbers appear to be before and after the origin/main merge, but I did not verify that.
- I did not run `npm run lint` over the whole repo or `git diff origin/main` in its plain (two-dot) form; I used `eslint` on the three changed files and the three-dot diff.
- Real IME behavior (WKWebView and WebView2), real Shift+Enter, the real height ceiling, and dark-mode appearance of the suggestion card were not observed. M-1, M-2 and M-3 are pending with the user.
- No mutation or negative-control test was run to confirm that the IME tests fail when the guard is removed. The implementer's RED capture in progress.md (28 failing before GREEN) is quoted, not reproduced.
- Plan-audit reports (`plan-audit/SPEC-AI-015-review-1.md`, `review-2.md`) were not read; the plan-phase verdict is out of this audit's scope.

## Residual Risk

- WebKit may order composition events differently on a given macOS or WKWebView version than the SPEC assumes. The double signal (`isComposing || keyCode === 229`) reduces this but cannot be proven without M-1 and M-2.
- The height cap is computed once, on mode entry. A window resize or a sidebar toggle while the input is open is not re-measured (D10, accepted by the SPEC).
- Anchors with under 198px on both sides remain a documented Known Limitation (R1), as do very small vertical spaces (R6).
