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
startWatch, stopWatch must be included or tests will fail when useFileSystem imports them.
