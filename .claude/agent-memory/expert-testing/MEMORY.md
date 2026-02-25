# expert-testing Agent Memory

## Project: markdown-editor-rust (Tauri v2 + React + TypeScript)

### E2E Test Infrastructure (SPEC-E2E-001) - Completed 2026-02-25

**Key patterns confirmed:**

- WebKit browser cached at `/Users/byunjungwon/Library/Caches/ms-playwright/webkit-2248`
- Vite dev server at `http://localhost:1420` via `npm run dev-vite`
- `reuseExistingServer: !process.env.CI` pattern works correctly

**DOM structure insight:**
- `.preview-content` only exists in DOM when editor has content (rendered by `PreviewRenderer`)
- When editor is empty, shows "Start writing..." placeholder (no `.preview-content`)
- Smoke tests must inject content OR use `.cm-editor` for empty-state checks

**CodeMirror injection pattern:**
```typescript
const editor = page.locator('.cm-content');
await editor.click();
await page.keyboard.press('ControlOrMeta+A');
await editor.fill(content);
```
- `.cm-content` has `contenteditable="true"` so `fill()` works directly
- Do NOT use `keyboard.type()` — too slow for large content

**Tauri IPC mock:**
- `page.addInitScript()` must be called BEFORE `page.goto()` for the mock to take effect
- The `tauriPage` fixture pattern handles this correctly via `base.extend()`

**Table border test results:**
- All 4 border assertions pass (td borderRight, td borderBottom, th borderRight, overflow-x)
- This confirms the WebKit border-collapse fix is working correctly

**Test files:**
- `playwright.config.ts` (project root)
- `e2e/fixtures/tauri-mock.ts`
- `e2e/fixtures/test-content.md`
- `e2e/app-render.spec.ts`
- `e2e/markdown-render.spec.ts`
- `e2e/table-border.spec.ts`
