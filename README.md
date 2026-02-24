# MdEdit

A lightweight, native desktop Markdown editor built with Tauri v2 + React 18.

> **Status**: Pre-MVP — Core UI implemented, file system integration complete

## Features

- **Syntax Highlighting** — CodeMirror 6-based Markdown editor with live highlighting
- **Live Preview** — Real-time Markdown rendering via markdown-it with 300ms debounce
- **Mermaid Diagrams** — Flowcharts, sequence diagrams, and more via Mermaid v11
- **Code Block Highlighting** — Shiki-powered syntax highlighting in preview
- **File Explorer** — Navigate folders, create/rename/delete files and directories
  - Click to navigate into subdirectories
  - `..` entry for parent directory navigation
  - Go Up (↑) button in header
  - Refresh button to sync directory contents
  - Search/filter files within opened folder
- **Resizable Panels** — Drag to resize sidebar, editor, and preview panes
- **Dark/Light Theme** — Follows system theme
- **Cross-Platform** — macOS, Windows, Linux (via Tauri v2)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite |
| Editor | CodeMirror 6 |
| Preview | markdown-it 14, Shiki 3, Mermaid 11 |
| State | Zustand 5 |
| Backend | Rust (Tauri v2) |
| Tests | Vitest + Testing Library |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/) 1.80+
- [Tauri CLI](https://tauri.app/) v2

### Development

```bash
npm install
npm run tauri dev
```

### Testing

```bash
# Frontend tests (Vitest)
npm run test

# Rust tests
cd src-tauri && cargo test
```

### Build

```bash
npm run tauri build
```

## Project Structure

```
markdown-editor-rust/
├── src/                     # React frontend
│   ├── components/
│   │   ├── editor/          # MarkdownEditor, EditorToolbar
│   │   ├── layout/          # AppLayout, Header, Footer, ResizablePanels
│   │   ├── preview/         # MarkdownPreview, PreviewRenderer
│   │   └── sidebar/         # FileExplorer, FileTree, FileTreeNode, FileSearch
│   ├── hooks/               # useFileSystem, useTheme
│   ├── lib/tauri/           # IPC wrappers
│   ├── store/               # fileStore, uiStore
│   ├── test/                # Component and integration tests
│   └── types/               # TypeScript type definitions
└── src-tauri/               # Rust backend
    └── src/
        ├── commands/        # directory_ops, file_ops, watcher
        └── models/          # file_node
```

## Architecture

MdEdit uses a **Tauri v2** architecture:

- **Rust backend** handles all file system operations with path traversal prevention and proper error handling
- **React frontend** manages UI state with Zustand, renders editor (CodeMirror 6) and preview (markdown-it)
- **IPC layer** (`invoke`) connects frontend to Rust commands via type-safe wrappers

### Key Design Decisions

- `FileNode` serialized with `camelCase` keys (`#[serde(rename_all = "camelCase")]`) to match TypeScript interfaces
- File watcher (`startWatch`) runs non-blocking — watcher failure does not prevent file navigation
- Preview uses `html: false` in markdown-it to prevent XSS

## Performance Targets

| Metric | Target |
|--------|--------|
| Launch time | < 500ms |
| Memory at idle | < 80MB |
| Binary size | < 15MB |
| Preview render | < 300ms debounce |

## License

MIT
