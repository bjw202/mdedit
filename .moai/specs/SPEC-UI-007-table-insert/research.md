# Research: SPEC-UI-007 — Editor Toolbar Table Insert (Grid Picker Popover)

Produced by Explore subagent during /moai plan Phase 0.5 (2026-07-16).

## Architecture Analysis

### Format action pipeline

**`src/components/editor/EditorToolbar.tsx`** (97 lines)
- `FormatAction` union type at lines 22–33: `'bold' | 'italic' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'code' | 'link' | 'quote' | 'image'`. The grid picker is stateful, so the table button will likely NOT go through `onFormat(action)` with a plain string; it needs rows/cols. Options: extend the callback signature, or handle table insertion via a dedicated prop/handler.
- `TOOLBAR_BUTTONS` array at lines 63–75: `Array<{ Icon; action: FormatAction; title: string }>`. Each entry rendered by `ToolbarButton` (lines 47–59): `<button type="button" aria-label={title} title={title} className="md-tool-btn">` with `<Icon width={15} height={15} />`.
- Toolbar container at line 85: `<div role="toolbar" aria-label="Markdown formatting toolbar" className="md-toolbar">`.
- Buttons keyed `${action}-${i}` (line 88) because `ListIcon` is reused for ul/ol.

**`src/components/layout/AppLayout.tsx`**
- `handleFormat` at lines 194–249 (tagged `@MX:ANCHOR` at 192). Gets `viewRef.current` (line 195), early-returns if null, then `switch(action)`:
  - bold/italic/code/link → `wrapSelection(view, before, after)`
  - h1/h2/h3/ul/ol/quote → `prefixLine(view, prefix)`
  - image → Save As flow if unsaved, then `insertImageFromDialog(view, path)`
- Imports: `wrapSelection, prefixLine` from `@/components/editor/extensions/keyboard-shortcuts` (line 20); `insertImageFromDialog` from `@/lib/image/imageHandler` (line 22). There is NO `src/lib/editor/` directory — format helpers live in `src/components/editor/extensions/keyboard-shortcuts.ts`.
- `EditorToolbar` wired at line 264; EditorView captured via `handleViewReady` (lines 187–190) from `<MarkdownEditor onViewReady={...}>` (line 297).

**`src/components/editor/extensions/keyboard-shortcuts.ts`** (154 lines)
- `wrapSelection(view, before, after): boolean` (lines 16–52). Uses `state.changeByRange((range) => ...)` returning `{ changes, range: EditorSelection.range(...)/cursor(...) }`, then `view.dispatch`.
- `prefixLine(view, prefix): boolean` (lines 59–90). Uses `state.doc.lineAt(range.from)` (line 62) for line boundaries (`line.from`, `line.to`, `line.text`).
- `markdownKeyBindings` (lines 129–145): `Mod-b`, `Mod-i`, `Ctrl-/` only.

**`src/lib/image/imageHandler.ts`**
- `insertImageMarkdown(view, relativePath, altText, pos?)` (lines 16–27): `const insertPos = pos ?? view.state.selection.main.head;` then `view.dispatch({ changes: {...} })`. Simple insert, no selection set afterward.

### Popover/dropdown pattern — `src/components/layout/Header.tsx`

- State: `exportMenuOpen` useState + `exportMenuRef` useRef (lines 54–55).
- Outside-click close: `useEffect` at lines 65–75 — document-level `mousedown` listener; closes if target not contained. Mounted once with `[]` deps.
- NO Escape-key handling exists for the Export menu (only FileTreeNode inline inputs handle Esc). Esc-close for the grid picker would be a new pattern, not a regression.
- Trigger button (lines 128–139): `aria-haspopup="true"`, `aria-expanded={exportMenuOpen}`.
- Menu markup (line 151): `<div role="menu" className="md-menu absolute left-0 top-full mt-1 z-50">` inside `div.relative` wrapper (line 127). Item handlers close menu first, then call callback (lines 77–90).
- Positioning is pure CSS (Tailwind `absolute left-0 top-full mt-1 z-50` + relative parent); no portal, no floating-ui.

### Icon system — `src/components/icons/icons.tsx`

- `IconProps = SVGProps<SVGSVGElement>` (line 8). Shared `svgProps(props)` helper (lines 10–24): `viewBox '0 0 24 24'`, `fill none`, `stroke currentColor`, `strokeWidth 1.5`, round caps/joins, `aria-hidden`, spreads `...props`.
- NO Table icon exists (30 icons; closest: `Columns2Icon` line 74, `PanelLeftIcon` line 218). New `TableIcon` should use the Lucide `table` glyph and follow the same pattern; barrel export in `src/components/icons/index.ts`.
- File header notes `@MX:SPEC: SPEC-UI-006` — no runtime lucide-react dependency allowed; SVGs inlined, alphabetical order.

### CSS conventions

**`src/styles/mdedit-components.css`**
- `.md-toolbar` (line 216), `.md-tool-btn` (line 221, 28px, `--md-radius-sm`, hover color-mix 8%, `.is-active` = `--md-accent-soft`/`--md-accent-hover`, focus-visible outline `--md-accent`).
- `.md-tool-sep` (line 232): defined but currently unused in EditorToolbar JSX — available for visual grouping.
- `.md-menu` (lines 97–103): `min-width 188px; padding --md-space-1; background --md-surface-raised; border --md-border; radius --md-radius-md; shadow --md-shadow-md` — natural container for the grid-picker popover.
- `.md-menu-item` hover: `--md-accent-soft` / `--md-accent-hover` (lines 111–112).

**`src/styles/mdedit-tokens.css`**
- Accent: `--md-accent` (#5980a6 light / #7ea6cd dark), `--md-accent-hover`, `--md-accent-soft` (ideal for highlighted grid cells), `--md-accent-contrast`.
- Surface: `--md-surface-raised`, `--md-border`, `--md-border-strong`. Radius: `--md-radius-sm: 3px`, `--md-radius-md: 5px`. Spacing: `--md-space-1..6`. Shadow: `--md-shadow-md`. Motion: `--md-ease`, `--md-dur-fast: 120ms`.
- HARD rule (file header lines 7–8): components never use raw hex; always `--md-*` roles.

## Existing Patterns (Testing)

- **`src/test/EditorToolbar.test.tsx`** (192 lines, SPEC-EDITOR-001): Rendering (getByRole button by name), callback tests (mock `onFormat`, fireEvent.click, toHaveBeenCalledWith), Accessibility (ALL buttons must have `aria-label`; toolbar role). Dynamic `await import(...)` per test; Tauri IPC mocked; `cleanup()` afterEach.
- NO existing unit tests exercise `handleFormat`, `wrapSelection`, or `prefixLine`. A new `insertTable(view, rows, cols)` helper would set precedent for testing a CodeMirror command directly — feasible via jsdom `EditorView`/`EditorState` (see `src/test/image-widget.test.ts`, `mediaExtensions.test.ts`).
- Export dropdown test precedent: `src/test/ExportHeader.test.tsx` (open menu, assert items, assert callbacks) — direct template for grid-picker popover tests.
- Playwright E2E: `testDir: './e2e'`, WebKit only, dev server :1420. None touch the editor toolbar. `table-border.spec.ts` covers table PREVIEW rendering only.

## Reference Implementations

- Line-boundary math: `prefixLine` (keyboard-shortcuts.ts:62) `state.doc.lineAt(range.from)`. Mid-line detection: `range.from > line.from` (text before cursor), `range.to < line.to` (text after) → prepend/append `\n`.
- Post-insert selection of "Header 1": follow `wrapSelection`'s `EditorSelection.range(start, end)` pattern, or dispatch `{ changes, selection: EditorSelection.range(...) }` computing offset of first header cell within skeleton.
- Focus return: `view.focus()` is not called anywhere in components yet — new but trivial addition; AppLayout holds `viewRef.current`.
- Popover shell: Header.tsx lines 127–163 (relative wrapper + absolute `.md-menu` + mousedown-outside close + aria-haspopup/aria-expanded).

## Risks & Constraints

1. `FormatAction` string-only contract — `onFormat?: (action) => void` cannot carry rows/cols. Option (a) separate `onInsertTable?(rows, cols)` prop is least invasive to `handleFormat` switch and existing tests; option (b) widen callback signature.
2. Stateless toolbar becomes stateful — Accessibility test (EditorToolbar.test.tsx:175–183) asserts EVERY button has `aria-label`; grid cells rendered as buttons must each carry one.
3. z-index layering — Export menu uses `z-50`; sidebar toggle `z-10`. `z-50` matches convention. No portals used anywhere. Toolbar is a SIBLING of the `overflow-hidden` editor panel wrapper (AppLayout.tsx:265), so downward overlap is fine; verify pane ancestors don't clip.
4. View-only guard — `isViewOnly` (AppLayout.tsx:256–259) hides MarkdownEditor but STILL renders EditorToolbar (line 264). `handleFormat` guards `if (!view) return`; table insertion should follow the same guard and the popover should no-op/close gracefully.
5. Keyboard shortcut collisions — reserved: Mod-b/i, Ctrl-/, Mod-s, Mod-Shift-s, Mod-n, Mod-f, Mod-Shift-i. No shortcut required by this feature; Mod-Shift-t is free if desired.
6. No Esc-close precedent — Export dropdown closes only on outside mousedown/item click. SPEC should scope explicitly: minimum Esc-close recommended; full arrow-key grid navigation exceeds existing patterns.
7. SPEC-UI-006 icon rules apply: locally inlined Lucide SVGs (stroke 1.5, currentColor), no new runtime deps.

## Recommendations

1. SPEC ID: `SPEC-UI-007-table-insert` (unused; slugged form matches recent convention e.g. SPEC-PREVIEW-010-mermaid-dark-theme).
2. Insertion helper: `insertTable(view: EditorView, rows: number, cols: number): boolean` alongside `wrapSelection`/`prefixLine` in `src/components/editor/extensions/keyboard-shortcuts.ts` (or new sibling module), using `state.doc.lineAt` for mid-line blank-line padding and `EditorSelection.range` to select the first header cell.
3. Component shape: keep `TOOLBAR_BUTTONS` for simple actions; render table button + popover as a distinct element in `EditorToolbar` (optionally after `.md-tool-sep`), with new `onInsertTable` prop wired in AppLayout next to `handleFormat`, ending with `view.focus()`.
4. Styling: popover reuses `.md-menu` tokens; hovered/armed cells use `--md-accent-soft` fill + `--md-accent` border; dimension label ("3 × 4") in `--md-text-muted`. New classes in `mdedit-components.css`, tokens only.
5. Tests: mirror `ExportHeader.test.tsx` (popover open/close/outside-click), `EditorToolbar.test.tsx` (rendering/aria), plus jsdom EditorView unit tests for `insertTable` (cursor mid-line, empty line, selection cases). E2E optional.
