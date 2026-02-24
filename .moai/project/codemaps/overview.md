# Architecture Overview - markdown-editor-rust

> **Status**: Pre-implementation (no source code yet)
> **Last Updated**: 2026-02-24
> **Project Phase**: Architecture Design

---

## System Overview

markdown-editor-rust is a **3-pane desktop application** built with Tauri v2 (Rust backend) and React (TypeScript frontend). The architecture separates concerns into a thin Rust process layer and a rich React UI layer.

```
┌────────────────────────────────────────────────────────────┐
│                     Application Window                      │
├──────────────┬──────────────────────┬──────────────────────┤
│  File         │     Editor Panel     │   Preview Panel      │
│  Explorer     │  (CodeMirror 6)      │  (markdown-it +      │
│  (Sidebar)    │  Markdown highlight  │   Shiki + Mermaid)   │
│               │  Syntax: 16+ langs   │   Real-time render   │
│  Tree view    │                      │   300ms debounce     │
│  File CRUD    │  Auto-save support   │   XSS-safe HTML      │
├──────────────┴──────────────────────┴──────────────────────┤
│                     Tauri IPC Bridge                        │
│              invoke() ←→ Rust command handlers              │
├────────────────────────────────────────────────────────────┤
│                     Rust Backend                            │
│   std::fs  │  notify (watcher)  │  tauri-plugin-dialog     │
└────────────────────────────────────────────────────────────┘
```

---

## Architectural Layers

### Layer 1: Rust Backend (`src-tauri/`)

**Role**: Native OS integration, file system access, file watching

- Exposes 9 Tauri commands (IPC endpoints) to the frontend
- Manages `notify` crate watcher lifecycle in `Mutex<WatcherState>`
- No business logic - pure data I/O and OS bridging
- Compiled to native binary (~5-10MB base, target ~15MB total)

**Key modules**:
- `commands/file_ops.rs` - CRUD file operations
- `commands/directory_ops.rs` - Directory listing + native dialog
- `commands/watcher.rs` - File change detection → Tauri event emit
- `state/app_state.rs` - Shared mutable state (watcher handle)

### Layer 2: IPC Bridge (`src/lib/tauri/ipc.ts`)

**Role**: Type-safe wrapper around all Tauri `invoke()` calls

Single point of contact between React and Rust. All Tauri commands are exposed through typed `FileAPI` functions. Frontend never calls `invoke()` directly.

### Layer 3: React State (`src/store/`)

**Role**: Application state management (Zustand)

Three independent stores:
- `editorStore` - Active file path, content, dirty/saving state
- `fileStore` - Directory tree, expanded paths, root path
- `uiStore` - Sidebar width, preview width, theme (persisted to localStorage)

### Layer 4: React Components (`src/components/`)

**Role**: UI rendering and user interaction

Three main panels:
- `sidebar/FileExplorer` - Tree view, file CRUD actions
- `editor/MarkdownEditor` - CodeMirror 6 instance with markdown extensions
- `preview/PreviewRenderer` - markdown-it HTML + post-process Mermaid SVG

### Layer 5: Rendering Pipeline (`src/lib/markdown/`)

**Role**: Markdown → HTML conversion

```
Raw Markdown Text
      │
      ▼ (markdown-it)
Token Stream
      │
      ├─ Mermaid blocks → <div data-mermaid-code="...">
      ├─ Code blocks → Shiki HTML (VS Code highlighting)
      └─ Standard MD → HTML
      │
      ▼
PreviewRenderer innerHTML update
      │
      ▼ (useEffect)
mermaid.render() → SVG injection
```

---

## Key Data Models

```typescript
// Frontend types (src/types/file.ts)
interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];    // null = not loaded (lazy)
  extension?: string;
}

interface FileChangedEvent {
  kind: 'Created' | 'Modified' | 'Deleted' | { Renamed: { oldPath: string } };
  path: string;
}
```

```rust
// Rust models (src-tauri/src/models/)
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileNode>>,
    pub extension: Option<String>,
}
```

---

## IPC Command Map

| Command | Direction | Purpose |
|---|---|---|
| `read_file(path)` | Frontend → Rust | Load file content |
| `write_file(path, content)` | Frontend → Rust | Save file |
| `create_file(path)` | Frontend → Rust | New file |
| `delete_file(path)` | Frontend → Rust | Delete file/folder |
| `rename_file(old, new)` | Frontend → Rust | Rename |
| `read_directory(path)` | Frontend → Rust | List folder contents |
| `open_directory_dialog()` | Frontend → Rust | Native folder picker |
| `start_watch(path)` | Frontend → Rust | Start fs watcher |
| `stop_watch()` | Frontend → Rust | Stop watcher |
| `file-changed` event | Rust → Frontend | File system change notification |

---

## Design Patterns

- **Lazy Loading**: File tree only loads directory contents on folder expand
- **Debounce**: Preview rendering delayed 300ms to avoid render storms
- **Singleton Init**: Shiki highlighter and Mermaid initialized once at startup
- **Event-Driven**: File changes propagate via Tauri events (not polling)
- **Immutable State**: Zustand stores use immer-style replacements

---

## Future Architecture Considerations (Post V1.0)

- Tab system: Multiple open files → `editorStore` holds array of `OpenFile` records
- Split editor: Secondary CodeMirror instance side-by-side
- Plugin system: Markdown-it plugin registry
- Search/Replace: CodeMirror search extension + `grep` Rust command
- Settings UI: Additional `settingsStore` + Tauri `store` plugin
