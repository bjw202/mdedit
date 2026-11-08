# Sync Audit: SPEC-PREVIEW-018 (HTML preview zoom; wheel/pinch excluded)

Auditor: sync-auditor (independent, read-only on tracked source)
Worktree: `.claude/worktrees/preview-018`, branch `WT-html-zoom`, HEAD `0338d48` (base origin/main `00c0edb`)
Audited: spec.md v0.3.0, acceptance.md, plan.md (grep only), progress.md, `git diff origin/main...HEAD -- src CHANGELOG.md`

## Overall Verdict: PASS-WITH-DEBT (overall 0.88)

Plain-language summary: The zoom feature is implemented the way the SPEC says, and I found no code defect that blocks it. Type check, lint and the whole test suite all passed when I ran them myself. The remaining debt is that the SPEC itself requires hands-on checks on a real Mac and a real Windows machine (zoom appearance, shortcuts, behaviour while the keyboard focus is inside the page), and nobody has done them yet. The SPEC correctly stays at `implemented`, not `completed`. A few small doc and test-polish items are listed as optional.

Firewall: Functionality and Security (must-pass) both meet their thresholds on the evidence I could observe. The unit-observable part of every active AC passes. The manual parts of AC-003/004/008 are UNVERIFIED, not PASS.

## Dimension Scores

| Dimension | Score | Verdict | Evidence |
|-----------|-------|---------|----------|
| Functionality (40%) | 90/100 | PASS (unit) / manual UNVERIFIED | See mechanical evidence and AC matrix below |
| Security (25%) | 95/100 | PASS | sandbox line count 1, `git diff -w` sandbox changes 0, no zoom API, no injected code |
| Craft (20%) | 80/100 | PASS-WITH-DEBT | tests/lint/tsc green; line coverage UNMEASURED (no coverage provider installed); placeholder leftovers in progress.md |
| Consistency (15%) | 85/100 | PASS | lint exit 0; `getFileViewType` body byte-identical after move; existing import paths still resolve |

Overall = harmonic mean (weights 40/25/20/15) = 88.2, reported as 0.88. Threshold for Tier S is 0.75.

## Mechanical Verification (run by me, in this worktree, HEAD 0338d48)

Logs persisted under `.moai/state/verify/preview-018-sync/` (`tsc.log`, `lint.log`, `vitest.log`, `*.exit`).

1. `npx tsc --noEmit` -> `tsc exit 0`, log empty.
2. `npm run lint` -> `lint exit 0`. Tail: `> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` (no findings).
3. `npx vitest run` -> `vitest exit 0`. Tail:
   ```
   Test Files  110 passed (110)
        Tests  1833 passed (1833)
   ```
   This matches the numbers the CHANGELOG claims (110 files, 1833 tests).
4. AC-007 grep/diff checks (base `00c0edb`):
   - `git diff --quiet 00c0edb -- src/test/SvgFileViewer.test.tsx src/test/previewZoom.test.ts src/components/preview/SvgFileViewer.tsx src/lib/preview/previewZoom.ts` -> exit 0
   - `grep -rnE '\bsetZoom\b|set_zoom|zoomHotkeysEnabled|zoom_hotkeys_enabled' src src-tauri/src src-tauri/tauri.conf.json` -> no output, exit 1
   - `grep -cE '^[[:space:]]+sandbox="allow-scripts allow-same-origin"$' src/components/preview/HtmlFileViewer.tsx` -> `1`
   - `git diff -w 00c0edb -- src/components/preview/HtmlFileViewer.tsx | grep -cE '^[-+][^-+].*sandbox'` -> `0`
   - `@MX:WARN` header comment (line 1) is present in both base and HEAD.
5. `getFileViewType` move: `diff` of the function body from `origin/main:PreviewContainer.tsx` versus `src/lib/preview/fileViewType.ts` -> `IDENTICAL`. Importers `AppLayout.tsx` and `ResizablePanels.tsx` still import from `PreviewContainer` (re-export), and 4 existing test files that use it passed in the full run.
6. Wheel/pinch leftovers in the src diff: `git diff origin/main...HEAD -- src | grep -niE 'wheel|pinch|gesture'` -> no output.
7. CodeMirror/app key-binding conflict (my own run): grep of `@codemirror/{commands,search,language,autocomplete}` for `Mod|Ctrl|Cmd` + `=`,`+`,`-`,`0` bindings -> no match; same pattern over app `src` (non-test) -> no match. `AppLayout.tsx` (lines 413-460) shows the editor is replaced by a view-only placeholder when `viewType === 'html'`, so the editor keymap is not mounted in HTML view. Existing document-level keydown listeners (`SettingsModal`, `ConfirmDialog`, `EditorToolbar`) are `Escape`/menu handling only.

## SPEC internal consistency (v0.3.0, revised after plan-audit with no re-audit)

- Active REQ: 001, 002, 003, 004, 006, 007 (6). Active AC: 001-004, 006-008 (7). Both within the Tier S ceiling of 8. The mapping table in spec.md section 4 and the traceability table in acceptance.md agree with each other.
- Leftover scan over `spec.md` and `acceptance.md` for wheel/pinch/M-0/M-3/REQ-005/AC-005: every hit is either a deliberate tombstone ("삭제됨(사용자 결정)") or the Out-of-Scope statement and HISTORY rows. No live requirement, AC, or manual item still depends on wheel/pinch. M-0 and M-3 are tombstoned, M-1/2/4/5 remain.
- plan.md has 3 hits: line 7 (v0.3.0 note), lines 27-28 (plan-phase grep record that mentions `wheel` as a searched term). These are historical records, not stale requirements.
- Frontmatter has the 12 canonical fields plus `tier` and `related_specs`; `status: implemented` is consistent with the acceptance.md DoD (completion needs the manual checks on both OSes).
- Tier S arithmetic (6 source files, 4 test files) matches the actual diff stat (6 src files + 4 test files).
- v0.3.0 was never re-audited. My read of the revision found no contradiction introduced by the removal. Residual risk: the plan-audit cache is formally invalid for v0.3.0 (progress.md says so).

## AC matrix (code + test, and whether the test is meaningful)

| AC / REQ | Code | Test | Assessment |
|----------|------|------|------------|
| AC-001 / REQ-001 | `Header.tsx` conditional stepper on `isHtmlView`; aria-labels "Zoom out", "Zoom in", "Reset zoom to 100%" | `Header.test.tsx`: html shows 3 controls + `110%`, hides font-size buttons; `.md/.ts/.txt` shows font controls and no zoom controls | PASS. Non-tautological: both branches asserted. |
| AC-002 / REQ-002 | `htmlZoom.ts` `stepUp`/`stepDown`; Header `disabled` at 67/200; `resetHtmlZoom` | `htmlZoom.test.ts` (steps, boundaries), `Header.test.tsx` (100->110->90->100, disabled at both ends), `uiStore.test.ts` | PASS. |
| AC-003 / REQ-003 | `HtmlFileViewer.tsx`: wrapper (`overflow: hidden`) + iframe `width/height = 100/scale %`, `transform: scale()`, `transformOrigin: 0 0`; none at 100 | `HtmlFileViewer.test.tsx`: 125 -> `80%`, `scale(1.25)`; 100 -> no transform; 67 keeps sandbox + src | PASS (unit). Math check: z=1.25 -> 80% x 1.25 = 100%; z=0.67 -> 149.25% x 0.67 = 100%. jsdom can only check style strings, so real reflow/media-query behaviour is manual M-1: UNVERIFIED. |
| AC-004 / REQ-004 | `Header.tsx` `useEffect`: registers only when `isHtmlView`, `matchZoomShortcut` (metaKey-only on Mac, ctrlKey-only elsewhere, `isComposing` -> null), modal guard `[role="dialog"][aria-modal="true"]`, `preventDefault` only after a match and passing the guard, cleanup removes the listener | `Header.test.tsx`: Mac Cmd `=`,`+`,`-`,`0` with `defaultPrevented` true; Mac Ctrl+`=` ignored and not prevented; Win Ctrl+`=` works, Meta+`=` ignored; `isComposing`; modal; non-html view (htmlZoom and fontSize unchanged, not prevented); unmount removes listener | PASS (unit). Both real dialogs (`SettingsModal`, `ConfirmDialog`) set `role="dialog"` and `aria-modal="true"`, so the guard is live, not dead. Manual M-2 UNVERIFIED. |
| AC-006 / REQ-006 | `uiStore.ts` `htmlZoom` default 100, `setHtmlZoom` snaps, `merge` applies `snapToStep(persisted.htmlZoom)`, persist `version` still 1 | `uiStore.test.ts`: real localStorage rehydrate: missing -> 100 with `fontSize` 16 kept; 113->110, 77.5->75, 999->200, 10->67, 150->150; `"150"`, `"abc"`, null, true -> 100; saved JSON contains `htmlZoom:150` | PASS. Verified by reading `snapToStep`: non-number/non-finite -> 100; ties resolve to the smaller step because the steps ascend and the comparison is strict `<`. Negative/zero values snap to 67 (finite), consistent with the REQ. |
| AC-007 / REQ-007 | zoom state is separate from `fontSize`; Svg viewer files untouched; no webview zoom API | `uiStore.test.ts` (fontSize 18 survives 100->200->100); my grep/diff checks above | PASS. |
| AC-008 / REQ-004+007 | n/a (needs real WebView) | none possible in jsdom | UNVERIFIED (manual M-4, M-5 on macOS and Windows). |

## Specific questions asked

(2) persist/migrate/merge: correct for garbage values per tests and code read. Observed limits (optional): `merge` assigns `snapToStep(persisted.htmlZoom)` unconditionally, so a manual `rehydrate()` from storage that lacks the key resets an in-memory non-default zoom to 100 (does not matter at app start, where the in-memory value is the default). A top-level non-object persisted state is handled the same way as zustand's default merge (not a regression); `null`/`undefined` is guarded.

(3) Header listener: modifiers per OS correct; `isComposing` handled inside `matchZoomShortcut`; modal guard works against the two real modals; cleanup on unmount and on `isHtmlView` change is via the effect dependency array; no listener and no `preventDefault` when not in html view; `preventDefault` is only called after a match AND the modal check. Gaps in robustness (optional): no `altKey` exclusion, so Ctrl+Alt+`=` (the AltGr combo on some Windows layouts) would also zoom; digit `0` is layout-dependent (e.g., AZERTY needs Shift); `detectPlatform()` is evaluated once per effect run (fine).

(4) HtmlFileViewer: math correct (above). Hooks (`useState`, `useUIStore`) sit before the `loadError` early return, so hook order is stable. Sandbox attribute and its comment are unchanged apart from indentation (`git diff -w` = 0). `src` normalization untouched. Wrapper gets `overflow-hidden` both as a class and as an inline style (redundant; the inline copy exists so jsdom can assert it).

(5) `getFileViewType` move/re-export: body is byte-identical; re-export keeps all existing import paths; no circular import (only `import type` from `fileStore`).

(6) CHANGELOG vs code: every checkable claim matched: steps list, Cmd vs Ctrl per OS, `=`/`+`, persist version 1, snap rule (nearest, smaller on tie, non-number -> 100), iframe `100/배율 %` plus `transform: scale`, no transform at 100%, sandbox unchanged, no webview zoom, file names, re-export, 110 files/1833 tests, editor not mounted in HTML view. The "not verified" list (macOS/Windows manual M-1/2/4/5, WebView2 Ctrl+`=`, Playwright not run) is honest and matches what I could not verify either.

## Findings (structured defect list)

- F1 [Medium] [blocking for `completed`, not for `implemented`] Manual checks M-1, M-2, M-4, M-5 on macOS and Windows are not done. AC-003/004/008 manual parts are therefore UNVERIFIED. Required fix: the user runs them and records OS-by-OS results in progress.md before the SPEC moves to `completed`. Highest value item: Windows WebView2 Ctrl+`=`/`-`/`0` while focus is inside the iframe (whether the whole webview zooms), which code cannot prevent.
- F2 [Low] [optional] `progress.md` section E.3 is still `_<pending run-phase>_` while E.2 and E.4 are filled, and E.4 `sync_commit_sha` holds a free-text `<...>` placeholder instead of a `pending-backfill-*` token. Required fix: fill E.3 with the run audit-ready signal and backfill `sync_commit_sha` with the real SHA (this sync commit) in a follow-up commit.
- F3 [Low] [optional] Playwright `e2e/html-file-viewer.spec.ts` (listed in acceptance.md Quality Gates) was not run by the implementer and not by me. Its selectors are `data-testid` based on the iframe, which the change preserves, so regression risk looks low, but this is unobserved. Required fix: run it once before PR merge if the Tauri e2e harness is available.
- F4 [Low] [optional] Line coverage for the changed files could not be measured: `@vitest/coverage-v8` is not installed (`node_modules/@vitest` has no coverage package). Required fix: none for this SPEC; note as Gap. Test density is high (4 test files, every branch of `matchZoomShortcut`, `snapToStep`, Header branches covered by assertions I read).
- F5 [Low] [optional] Robustness: no `altKey` exclusion in `matchZoomShortcut` (AltGr on Windows). Required fix: add `!e.altKey` only if a real layout problem is reported; it is speculative today.
- F6 [Low] [optional] Test polish: `Header.test.tsx` overrides `navigator.platform` and never restores it; no test for toggling html -> non-html while mounted (relies on the effect dependency array); no test for non-object persisted state. Required fix: optional.
- F7 [Info] [optional] Redundant `overflow-hidden` class plus inline `overflow: hidden` in `HtmlFileViewer.tsx`. The CHANGELOG bullet is about 3,900 characters and contains process notes ("조정자가 직접 실행") that are not user-facing; the previous entry is about 3,000, so the style is consistent with the file but on the heavy side.
- F8 [Info] v0.3.0 was never plan-audited. I found it internally consistent (see section above); the formal cache is invalid. No fix required unless the team wants a record.

No blocking code defect found. No Critical/High findings.

## Gaps (what I did NOT observe)

- Any real-device behaviour: macOS WKWebView and Windows WebView2 reflow, media-query response, shortcut delivery, webview default zoom conflict, behaviour with keyboard focus inside the iframe (M-1, M-2, M-4, M-5).
- Playwright e2e (not run).
- Line/branch coverage numbers (no provider installed).
- Whether Tauri's default `zoom_hotkeys_enabled` actually disables WebView2's built-in Ctrl+`=` zoom; I only confirmed the app does not set any zoom option (grep empty), not what the runtime default does.
- Visual layout of the new `Reset zoom` button inside `.md-stepper` (CSS `.md-stepper button` fixes 28x28 while `.val` sets `min-width: 46px`; `.val` appears later in the cascade so the width should win, but I did not render it).
- Optional cross-model audit (`mcp__moai__audit_multi`) was not run; this is a Claude-only audit.
- Orchestrator-visible harness state (`.moai/logs/` untracked directory) was not inspected and is not part of this change.

## Residual risk

- Subpixel rounding of `100/scale %` sizes at fractional scales (67, 75, 110, 175) may leave a 1 px gap or overlap at the wrapper edge on some displays; invisible to jsdom, covered only by M-1.
- If WebView2 applies its own zoom in addition to the app's, the user would see double zoom on Windows; this is the SPEC's own flagged hypothesis and remains open until M-5.

## Recommendations

1. Treat the SPEC as ready for PR at `implemented`; do not mark `completed` until M-1/2/4/5 are recorded for both OSes.
2. Before merging, fill progress.md E.3 and backfill `sync_commit_sha`.
3. Run the html-file-viewer Playwright spec once if possible.
4. Consider a follow-up SPEC for wheel/pinch (already named as a candidate in spec.md section 5).
