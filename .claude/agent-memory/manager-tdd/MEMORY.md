# TDD Agent Memory - MdEdit Project

## Project: markdown-editor-rust (MdEdit)

### Tech Stack
- Tauri v2 (Rust backend) + React 18 (TypeScript frontend)
- Vite 5 + Tailwind CSS 3 + Zustand 5
- Vitest (frontend testing) + cargo test (Rust testing)
- TypeScript strict mode, ESM format

### Key Paths
- Rust backend: `/src-tauri/src/` (lib.rs, commands/mod.rs, models/mod.rs, state/mod.rs)
- Frontend: `/src/` (App.tsx, main.tsx, index.css)
- Tests: `/src/test/` (infrastructure.test.ts, app.test.tsx, setup.ts)
- Config: `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `package.json`

### Rust Module Pattern
Submodules (commands, models, state) export a `MODULE_NAME` const for testability:
```rust
pub const COMMANDS_MODULE_NAME: &str = "commands";
```

### TDD Notes for This Project
- Frontend tests use Vitest + @testing-library/react + jsdom environment
- Tauri API calls in tests need mocking (window.__TAURI__ not available in jsdom)
- `vite.config.ts` test config: globals:true, environment:"jsdom", setupFiles:["./src/test/setup.ts"]
- Rust unit tests run without Tauri runtime (test modules skip builder/context)

### SPEC-INFRA-001 Status
- Completed: File structure creation (2026-02-24)
- All 18 required files created
- Vitest tests: infrastructure.test.ts, app.test.tsx
- Rust tests: in lib.rs, commands/mod.rs, models/mod.rs, state/mod.rs

### SPEC-FS-002 Status
- Completed: Filesystem Watcher (2026-02-24)
- notify v6 added to Cargo.toml
- New Rust files: commands/watcher.rs, models/file_event.rs, state/app_state.rs
- New Frontend files: src/hooks/useFileWatcher.ts, src/test/useFileWatcher.test.ts
- Modified: commands/mod.rs, models/mod.rs, state/mod.rs, lib.rs, ipc.ts, useFileSystem.ts, App.tsx
- Fixed pre-existing type errors in: usePreview.test.ts, PreviewRenderer.test.tsx, app.test.tsx

### Mock Patterns for App.tsx tests
When App.tsx uses Tauri APIs (listen, invoke), app.test.tsx MUST mock them:
```typescript
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
```

### useFileSystem.ts mock pattern
ipc.ts mock in useFileSystem.test.ts must include ALL exported functions:
startWatch, stopWatch, saveFileAs must be included or tests will fail when useFileSystem imports them.

### SPEC-EDITOR-002 + SPEC-PREVIEW-002 Status
- Completed: Editor UX & Scroll Sync (2026-02-24)
- uiStore: added saveStatus (SaveStatus type), scrollSyncEnabled, setSaveStatus, setScrollSyncEnabled, toggleScrollSync
- keyboard-shortcuts.ts: exported wrapSelection, added prefixLine function
- Rust: save_file_as command in file_ops.rs (uses tauri_plugin_dialog DialogExt), registered in lib.rs
- ipc.ts: saveFileAs wrapper
- MarkdownEditor.tsx: onViewReady prop, Ctrl+Shift+S (save-as), Ctrl+N (new), saveStatus feedback
- Footer.tsx: saveStatus display, wordCount, charCount, scrollSync toggle button with aria-pressed
- useFileSystem.ts: unsaved warning via window.confirm, saveFileAs function
- AppLayout.tsx: viewRef + currentView state + handleViewReady, handleFormat (wrapSelection/prefixLine), all Footer props
- renderer.ts: dataLinePlugin (data-line attributes on block tokens for scroll sync)
- MarkdownPreview.tsx: previewRef prop
- useScrollSync.ts: NEW - useScrollSync(editorView, previewRef, enabled) hook with RAF throttling

### Renderer test pattern after data-line plugin
After adding dataLinePlugin to renderer.ts, tests checking exact HTML like '<p>text</p>'
must be updated to check tag prefix + content separately:
  expect(result).toContain('<p');
  expect(result).toContain('text</p>');
OR use data-line attribute checks for block elements.

### jsdom scrollIntoView mock pattern
jsdom does not implement scrollIntoView. When testing scroll behavior, mock directly on element:
  lineEl.scrollIntoView = vi.fn();
Do NOT use vi.spyOn(lineEl, 'scrollIntoView') - it will fail with "does not exist".

### window.confirm mock for unsaved warning
When testing openFile with dirty=true, mock window.confirm via vi.stubGlobal:
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
