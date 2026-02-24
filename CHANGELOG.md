# Changelog

All notable changes to MdEdit are documented here.

## [Unreleased]

### Added
- File explorer with standard navigation UI
  - `..` parent directory entry at top of file list for quick parent navigation
  - Go Up (↑) button in sidebar header with parent path tooltip
  - Refresh button to reload directory contents after external changes
  - Search/filter input to find files within opened folder
- File tree directory navigation: click directory to navigate into it
- `FileNode` Rust model now serializes with `camelCase` JSON keys (`#[serde(rename_all = "camelCase")]`)
  matching TypeScript interface — fixes directory detection always returning `undefined`
- File watcher (`startWatch`) runs non-blocking; watcher failure no longer prevents folder navigation
- Regression test: `test_file_node_serializes_with_camel_case_keys` guards against snake_case regression

### Fixed
- **Critical**: Clicking a directory triggered `openFile` instead of `openFolderPath` because
  `node.isDirectory` was always `undefined` (Rust serialized `is_directory` instead of `isDirectory`)
- Unhandled Promise rejection "Path is a directory, not a file" when clicking `.claude` folder
- Test mock for `openFolderPath` returned `undefined` instead of `Promise<void>`, causing `.catch()` errors

### Tests
- Frontend: 192 tests passing (21 test files)
- Rust: 78 tests passing

---

## [0.1.0] — Initial Implementation

### Added
- Tauri v2 + React 18 desktop application scaffold
- CodeMirror 6 Markdown editor with syntax highlighting
- Real-time Markdown preview via markdown-it 14
- Shiki 3 syntax highlighting for code blocks in preview
- Mermaid 11 diagram rendering (flowcharts, sequence, state, etc.)
- Zustand 5 state management (fileStore, uiStore)
- Resizable sidebar / editor / preview panels
- System dark/light theme support
- File explorer sidebar with context menu (New File, New Folder, Rename, Delete)
- Rust backend file operations: read, write, create, delete, rename
- Path traversal attack prevention in all Rust file commands
- File watcher integration for external change detection
- Lazy directory loading (children fetched on first expand)
- Header with font size controls and theme toggle
- Footer with cursor position, line count, and encoding info
- Full test suite: Vitest (frontend) + cargo test (Rust backend)
