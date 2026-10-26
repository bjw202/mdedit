# Sync Audit — SPEC-PREVIEW-015 (mermaid → pele 1.10.0)

- Auditor: sync-auditor (independent, read-only)
- Date: 2026-10-26
- Tree: worktree `.claude/worktrees/pele-015`, branch `WT-pele-renderer`, HEAD `af8b61b`
- Base: `929d116` (confirmed: `git merge-base origin/main HEAD` → `929d116a7c6e…`)
- Profile: built-in default (Functionality + Security must-pass)

## Verdict: PASS-WITH-DEBT

No blocking findings. Both must-pass dimensions (Functionality, Security) pass. The debt is non-blocking: one test-coverage gap on the real-browser color-reading path, plus minor craft and documentation items.

| Dimension | Score | Verdict |
|-----------|-------|---------|
| Functionality (must-pass) | 0.92 | PASS |
| Security (must-pass) | 0.94 | PASS |
| Craft | 0.88 | PASS |
| Consistency | 0.90 | PASS |
| **Harmonic mean** | **0.91** | |

## Commands run (this audit, this tree)

Evidence logs are in `.moai/state/verify/pele015-audit/`.

| Command | Exit | Key output |
|---------|------|------------|
| `npx vitest run` | 0 | `Test Files  108 passed (108)` / `Tests  1751 passed (1751)` |
| `npx tsc --noEmit` | 0 | (no output) |
| `npm run lint` | 0 | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` (no warnings) |
| `CI=1 npx playwright test e2e/diagram-preview-behavior.spec.ts e2e/mermaid-subgraph-label.spec.ts` | 0 | `7 passed (13.7s)` (webkit); port 1420 free before and after |
| `npm ls mermaid patch-package` | — | `└── (empty)`; lockfile has 0 `node_modules/mermaid` entries and 1 `node_modules/pele` entry |
| `git diff --stat 929d116 HEAD -- src/lib/preview/svgSanitize.ts` | — | empty (shared sanitizer byte-unchanged) |
| `git diff --stat 929d116 HEAD -- <plan.md protected list>` | — | only `src/lib/markdown/mermaidPlugin.ts \| 3 +++` (comment only) |
| `grep -rnE "from ['\"]mermaid\|import\(['\"]mermaid" src e2e` | — | 0 hits |
| `grep "from 'pele'"` (outside tests) | — | `src/lib/diagram/diagramRenderer.ts:5` only |
| `node -p require('./node_modules/pele/package.json').version` | — | `1.10.0` |
| Ad-hoc pele probes (USER_MANUAL claims, CSS `url(` injection) | — | see F7/F8 and Consistency |

## Functionality — 0.92 PASS

I checked every requirement against the code and its tests directly.

- **REQ-001/021/022 (single module, pins, guards)**: pele is imported only in `diagramRenderer.ts:5`. No mermaid import anywhere. `package.json` pins `"pele": "1.10.0"` and has no mermaid, patch-package, or postinstall. `patches/` is absent. `diagramRegressionGuard.test.ts` asserts all of these, including `existsSync(patch) === false`.
- **REQ-002 (fixed options)**: `PELE_RENDER_OPTIONS` is `Object.freeze`d (`diagramRenderer.ts:18-25`). `renderDiagram(source)` accepts no options. The test seam `renderDiagramForTest` only injects math measurement. Tests assert the options on every pele call and that the object is frozen (`diagramRenderer.test.ts:80-103`).
- **REQ-006/007/009/010 (preview)**: rendering is synchronous per container (`PreviewRenderer.tsx:81-105`), so no stale render can overwrite newer content. Errors are written with `textContent`. The empty-fence placeholder is unchanged. Tests in `PreviewRenderer.test.tsx:125-235` use a pass-through pele spy, not a stub.
- **REQ-008 (theme without re-render)**: the component no longer subscribes to the theme. Webkit e2e asserts the same SVG node survives toggles and system-scheme changes, and that the first dark render is dark (2 tests passed in my run).
- **REQ-011 (no links or external images)**: covered by unit tests (raw and sanitized, `diagramRenderer.test.ts:247-277`) and by webkit e2e for click, IPC, and request checks (passed).
- **REQ-012/013 (AI validation and card)**: `validateDiagram` → `renderDiagram`, the same function with the same options. The test asserts error equals `PeleError.message`. The card's `renderMermaidInto` is tested with the real module (`aiSuggestionCard.test.ts:596-653`).
- **REQ-014 (presets)**: all 7 preset sources render, width and height > 0.
- **REQ-015–019 (exports)**: `exportDiagram.test.ts` renders through the real module (the mock at `:51-60` delegates to `real.renderDiagramForTest`). It covers no preview DOM present, entity-input parity with the preview, preview-DOM leftovers being ignored, failed fences keeping their own slots (HTML and DOCX ordering by `invocationCallOrder`), the 6 theme combinations with zero `var(--pele-`, DOCX size = pele size × 0.75 clamped to 415pt independent of `getBoundingClientRect`, and math in HTML/PDF/DOCX.
- **REQ-023 (real fixtures)**: manifest fields are asserted. `unit/` fixtures are byte-re-rendered with the installed pele (`diagramRenderer.test.ts:403-420`), so they cannot be hand-written. `m1-frozen` holds 38 pairs, all `frozen: true`.
- **REQ-025 (math)**: KaTeX is called with `output:'mathml', trust:false` (asserted). Webkit e2e checks the math sits inside its box with no new CSP violations (passed).

Manual-only items (user reported all passed on 2026-10-26; not re-observed by this audit): AC-018/020/024 manual parts, MANUAL-3/4, actual Word/print rendering. **Windows is unconfirmed.**

## Security — 0.94 PASS

- The diagram purifier is a separate instance, `DOMPurify(window)` (`diagramRenderer.ts:134-163`), and re-registers the href-blocking hook (`data:`, any scheme, `//`; `#frag` kept). A test asserts it is not the global instance, that the global `addHook`/`setConfig` are never called, and that a probe hook on the global instance fires 0 times (`diagramRenderer.test.ts:347-372`).
- The shared `sanitizeSvg` has an empty diff vs base. All 38 m1-frozen pairs stay byte-identical before and after the diagram path runs (test `:336-345`).
- The math allowlist adds only `foreignObject` (the hook removes any whose class is not exactly `pele-math`), the wrapper `div` (only as the direct child of `foreignObject.pele-math`), MathML (only inside `pele-math`), `semantics`, and `annotation[encoding]`. Nine hostile probes (script, on* handlers, `javascript:`, forms, iframe, style, `annotation-xml` HTML, mixed class `pele-math evil`) leave 0 markers behind.
- Every `innerHTML` sink receives module-sanitized output: `PreviewRenderer.tsx:97`, `ai-suggestion-card.ts:1290`, `exportUtils.ts:37`, and `diagramRenderer.ts:64` (measure node, fed by the same sanitizer). Error text goes through `textContent` only.
- KaTeX runs with `trust:false`. The exported HTML has no `var(--pele-`, as tested on the whole document including CSS. The HTML export injects no script.
- **Probe**: I tried injecting `url(https://…)` and `url(//…)` through `style` and `classDef`. pele 1.10.0 rejects all 3 with a `syntax` error, so this channel is closed by the pinned parser rather than by the sanitizer (see F8).

## Craft — 0.88 PASS

The module is small (310 lines), cohesive, and well-commented. The mermaid-era code is gone: no `initialize`, no theme subscription, no DOM-scraping export, no `MERMAID_STRICT_CONFIG`. The remaining `mermaid` identifiers are intentional names (`.mermaid-container`, `mermaidPlugin`, `mermaidValidate`). The DOCX queue-and-`shift()` pairing, the root cause of the slot-shift bug, is replaced by per-fence rendering. Test quality is high: pass-through spies, real pele, real captured fixtures, and the hand-written hostile inputs are clearly labeled as probes rather than pele output. MX tags match the plan.md MX table; per-file limits hold (diagramRenderer: 2 ANCHOR, 3 WARN). Minor items: F2, F4, F5.

## Consistency — 0.90 PASS

- I checked the USER_MANUAL appendix against real pele. `A[사용자 (User)]` gives `syntax 2 11`, which matches the documented `(2행 11열)` example and the "line after the `mermaid` line is line 1" rule. `Flowchart` and a mistyped keyword both give `unsupported-diagram 0 0`, matching the documented no-position case. The mixed text-plus-math label renders, as USER_GUIDE claims. The TOC anchor (`:15`, `:94`, `:733`) resolves to the heading at `:498`.
- README rows `:15` and `:104` are updated. USER_GUIDE `### Mermaid 다이어그램` accurately describes errors, math, links, and export colors (DOCX is always light).
- `mdedit-tokens.css` uses the selector `[data-theme="light"], :root`, a user-approved change recorded in spec HISTORY 0.4.3. Side-effect check: the only other element that sets `data-theme` is `ImageFileViewer.tsx:138` (`data-theme={theme}`), and it only carries `"light"` when the app root is already light, so no visible change.
- Protected files: everything is unchanged except a comment-only MX NOTE in `mermaidPlugin.ts` (F3).

## Findings (ranked)

| ID | Severity | Class | Location | Finding | Suggested fix |
|----|----------|-------|----------|---------|---------------|
| F1 | SHOULD-FIX | optional | `src/test/exportDiagram.test.ts:58, 397-408, 439-445`; `diagramRenderer.ts:244-261` | The real-browser behavior of `readPeleThemeValues` has no automated test. That behavior is (a) computed resolution of `var(--md-*)` and (b) a `data-theme="light"` probe under a dark root returning light values, which together are how DOCX stays light in a dark app. The unit tests replace the function with synthetic tables. The "real" jsdom test only proves the empty-table fallback, and the selector test is a regex over CSS text. AC-020 accepts unit + manual, so this is within contract, but the must-pass mechanism rests on one manual observation. Confidence: high that the gap exists; low that it hides a bug (the user's manual DOCX check reportedly passed). | Add one webkit e2e: set `data-theme="dark"` on `<html>`, call `readPeleThemeValues('light')` and `('dark')` via `page.evaluate`, and assert `--pele-bg` equals the light and dark `--md-bg` token values respectively. |
| F2 | MINOR | optional | `diagramRenderer.ts:166-173, 197` | When `sanitizeDiagramSvg` throws, it returns `''`. `renderWith` still returns `{ok:true, svg:''}`, so `validateDiagram` says valid while the preview shows an empty container with no error. Hard to reach; no input in the test corpus triggers it. Confidence: medium. | In `renderWith`, if the sanitized SVG is empty, return `{ok:false, error:{code:'sanitize', …}}`. |
| F3 | MINOR | optional | `src/lib/markdown/mermaidPlugin.ts:19-21`; `plan.md:219` vs `plan.md:156` | A file on plan.md's "do not change" list gained 3 comment lines. The plan's own MX table (`:156`) schedules exactly this NOTE, so the SPEC contradicts itself; behavior is unchanged. | Amend `plan.md:219` to say "comment-only MX NOTE per MX table excepted". |
| F4 | MINOR | optional | `diagramRenderer.ts:211-214` | The test seam `renderDiagramForTest` is exported from the production module. It cannot change pele options, so it carries no security impact, but it widens the public surface. | Acceptable as is. Optionally rename it or mark it `@internal`. |
| F5 | MINOR | optional | `PreviewRenderer.tsx:7-9` | The `@MX:ANCHOR` stays even though the tag's own REASON measures fan_in = 1 and calls it a "NOTE demotion candidate". The protocol says to demote below 3 (via a report). | Demote to `@MX:NOTE` in a follow-up and record it in the MX report. |
| F6 | MINOR | optional | `CHANGELOG.md:14` | The entry is one bullet of about 2,900 characters that embeds verification counts. I reproduced vitest 1751/1751. I did not reproduce "Playwright webkit 69", "cargo test 367", or "vite build", because I ran only the 7 targeted e2e tests. | Split it into short sub-bullets and move the verification counts to the PR body. |
| F7 | MINOR | optional (info) | pele behavior | For incomplete trailing input, pele can report a position past the last line (probe: 3-line input with a trailing `-->` gives `syntax 4 1`, which shows as `(4행 1열)`). This is pele's behavior and outside this SPEC's scope. | None needed. Optionally soften the USER_MANUAL note to "at or just before that line". |
| F8 | MINOR | optional (residual risk) | `diagramRenderer.ts:93-118` | The diagram sanitizer does not scrub CSS inside `style` attributes. External `url(...)` requests are prevented only because pele's parser rejects `url(` in `style`/`classDef` (3 probes, all `syntax` errors). This depends on the pinned pele version, which the guard test protects. The same holds for the shared sanitizer. | None now. Re-probe when pele is bumped (add it to the bump checklist). |

## Gaps (not observed by this audit)

- Full Playwright suite (only the 2 diagram specs, 7 tests, were run), `cargo test`, `vite build`, `npm ci` from clean (I ran `npm ls` on the existing `node_modules`).
- The AC-019/AC-018 "reproduction test failed on old code" claim (it lives in progress.md; I did not replay it on base).
- All manual checks (macOS reported passed by the user) and Windows WebView2 (unconfirmed).

## Residual risk

- Real WKWebView/WebView2 rendering of MathML inside `foreignObject` and of `responsive:true` SVGs during DOCX rasterization is verified only manually.
- Export color correctness in a real browser rests on the CSS custom-property computation (F1).
- Several security properties (no CSS `url(`, URL blocking) depend on pele 1.10.0 parser behavior. The exact pin plus the guard tests keep that stable until a deliberate bump.
