---
name: moai-framework-tauri
description: >
  Tauri v2 desktop application development specialist covering Rust backend
  commands, IPC patterns, plugin system (fs/dialog/shell), capabilities-based
  security model, and React/TypeScript frontend integration. Use when building
  cross-platform desktop apps with Rust + WebView architecture.
  [KO: Tauri 데스크탑 앱, Rust IPC, 크로스플랫폼 개발]
  [JA: TauriデスクトップアプリケーションとRust IPC開発]
  [ZH: Tauri桌面应用与Rust IPC开发]
license: Apache-2.0
compatibility: Designed for Claude Code with Tauri v2
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, mcp__context7__resolve-library-id, mcp__context7__get-library-docs
user-invocable: false
metadata:
  version: "1.0.0"
  category: "framework"
  status: "active"
  updated: "2026-02-24"
  modularized: "false"
  tags: "tauri, rust, desktop, ipc, webview, cross-platform, capabilities, permissions"
  context7-libraries: "/tauri-apps/tauri-docs,/tauri-apps/tauri"
  related-skills: "moai-lang-rust,moai-lang-typescript,moai-domain-frontend"

# MoAI Extension: Progressive Disclosure
progressive_disclosure:
  enabled: true
  level1_tokens: 100
  level2_tokens: 5000

# MoAI Extension: Triggers
triggers:
  keywords: ["tauri", "desktop app", "webview", "tauri-plugin", "AppHandle", "invoke", "tauri::command", "cargo tauri", "tauri.conf.json", "capabilities", "src-tauri"]
  agents: ["expert-backend", "expert-frontend", "manager-tdd", "manager-ddd"]
  phases: ["run"]
  languages: ["rust"]
---

# Tauri v2 Desktop Application Development

## Quick Reference

Tauri v2 enables building lightweight, fast, cross-platform desktop apps using Rust backend + WebView frontend.

Auto-Triggers: `src-tauri/` directory, `tauri.conf.json`, `#[tauri::command]` macro usage, Cargo.toml with `tauri` dependency.

### Core Architecture

```
Frontend (WebView)          Rust Backend (Process)
┌──────────────────┐       ┌─────────────────────────┐
│  React/Vue/etc   │  IPC  │  Tauri Runtime           │
│  TypeScript      │◄─────►│  tauri::command handlers │
│  @tauri-apps/api │       │  AppHandle / State<T>    │
└──────────────────┘       │  Plugins (fs/dialog/etc) │
                           └─────────────────────────┘
```

---

## Rust Backend Patterns

### tauri::command Macro

```rust
use tauri::{AppHandle, State};
use std::sync::Mutex;

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}
```

**Error convention**: Always return `Result<T, String>` — the `String` error is serialized to JS.

### Shared State with Mutex

```rust
use std::sync::Mutex;
use tauri::{Builder, Manager, State};

#[derive(Default)]
struct AppState {
    watcher: Option<notify::RecommendedWatcher>,
}

#[tauri::command]
fn get_status(state: State<'_, Mutex<AppState>>) -> String {
    let s = state.lock().unwrap();
    if s.watcher.is_some() { "watching".into() } else { "idle".into() }
}

pub fn run() {
    Builder::default()
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![get_status, read_file, write_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Plugin Registration in lib.rs

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            commands::file_ops::read_file,
            commands::file_ops::write_file,
            commands::directory_ops::read_directory,
            commands::directory_ops::open_directory_dialog,
            commands::watcher::start_watch,
            commands::watcher::stop_watch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Emitting Events to Frontend

```rust
use tauri::{AppHandle, Emitter};

// Rust → Frontend event emission
app_handle.emit("file-changed", payload).unwrap();

// With serde-serializable payload
#[derive(Clone, serde::Serialize)]
struct FileChangedEvent {
    kind: String,
    path: String,
}
```

---

## Cargo.toml Standard Template

```toml
[package]
name = "app"
version = "0.1.0"
edition = "2021"

[lib]
name = "app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[dependencies]
tauri = { version = "2", features = ["devtools"] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
notify = "6"

[profile.release]
opt-level = "s"
lto = true
strip = true
codegen-units = 1
```

---

## Capabilities & Security (v2 Model)

**Key change from v1**: `allowlist` (v1) → `capabilities` + `permissions` (v2)

```json
// src-tauri/capabilities/main.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Main window capabilities",
  "windows": ["main"],
  "permissions": [
    "core:path:default",
    "core:event:default",
    "core:window:default",
    "core:app:default",
    "fs:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$DOCUMENT/**" }, { "path": "$HOME/**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$DOCUMENT/**" }]
    },
    "dialog:default",
    "shell:default"
  ]
}
```

See `references/security.md` for complete capabilities configuration.

---

## IPC Patterns (Frontend ↔ Rust)

### TypeScript Type-Safe Wrapper

```typescript
// src/lib/tauri/ipc.ts
import { invoke } from '@tauri-apps/api/core';
import type { FileNode, FileChangedEvent } from '../../types/file';

export const FileAPI = {
  readFile: (path: string) =>
    invoke<string>('read_file', { path }),

  writeFile: (path: string, content: string) =>
    invoke<void>('write_file', { path, content }),

  readDirectory: (path: string) =>
    invoke<FileNode[]>('read_directory', { path }),

  openDirectoryDialog: () =>
    invoke<string | null>('open_directory_dialog'),

  startWatch: (path: string) =>
    invoke<void>('start_watch', { path }),

  stopWatch: () =>
    invoke<void>('stop_watch'),
};
```

### Listening to Rust Events

```typescript
import { listen } from '@tauri-apps/api/event';

// Subscribe to file-changed events from Rust
const unlisten = await listen<FileChangedEvent>('file-changed', (event) => {
  console.log('File changed:', event.payload);
});

// Cleanup on component unmount
return () => unlisten();
```

See `references/ipc.md` for complete IPC patterns.

---

## tauri.conf.json Core Settings

```json
{
  "productName": "MyApp",
  "version": "0.1.0",
  "identifier": "com.myapp.desktop",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "title": "MyApp",
        "width": 1200,
        "height": 800,
        "resizable": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"]
  }
}
```

---

## Development Commands

```bash
# Install Tauri CLI
cargo install tauri-cli --version "^2.0"
# or via pnpm
pnpm add -D @tauri-apps/cli

# Create new project
pnpm create tauri-app

# Start dev server (hot reload)
cargo tauri dev
# or
pnpm tauri dev

# Build production binary
cargo tauri build
# or
pnpm tauri build

# Add plugin
cargo add tauri-plugin-fs
cargo add tauri-plugin-dialog
cargo add tauri-plugin-shell
```

---

## File Structure Convention

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── capabilities/
│   └── main.json           # Permissions definition
├── icons/
└── src/
    ├── main.rs             # Entry point (minimal)
    ├── lib.rs              # Tauri Builder composition
    ├── commands/
    │   ├── mod.rs
    │   ├── file_ops.rs     # File CRUD commands
    │   ├── directory_ops.rs
    │   └── watcher.rs      # notify + emit events
    ├── models/
    │   ├── mod.rs
    │   └── file_node.rs    # Serializable data types
    └── state/
        ├── mod.rs
        └── app_state.rs    # Mutex<State> definitions
```

---

## Plugin Reference

| Plugin | Crate | JS Package | Purpose |
|--------|-------|-----------|---------|
| File System | `tauri-plugin-fs = "2"` | `@tauri-apps/plugin-fs` | Read/write files |
| Dialog | `tauri-plugin-dialog = "2"` | `@tauri-apps/plugin-dialog` | Native file/folder dialogs |
| Shell | `tauri-plugin-shell = "2"` | `@tauri-apps/plugin-shell` | Open URLs, run programs |
| Notification | `tauri-plugin-notification = "2"` | `@tauri-apps/plugin-notification` | OS notifications |
| Store | `tauri-plugin-store = "2"` | `@tauri-apps/plugin-store` | Persistent key-value store |

See `references/plugins.md` for plugin usage examples.

---

## Tauri v2 vs Electron

| Aspect | Tauri v2 | Electron |
|--------|----------|---------|
| Binary size | ~10-15 MB | ~80-150 MB |
| Memory usage | ~20-30 MB | ~100-200 MB |
| Backend language | Rust | Node.js |
| Startup time | Fast (~0.5s) | Slower (~2-3s) |
| Security model | Capabilities-based | Explicit sandbox |
| System WebView | Yes (OS-provided) | Bundled Chromium |
| Native APIs | Via Rust + plugins | Via Node.js + preload |

**Choose Tauri when**: Binary size matters, Rust is preferred, security is priority.
**Choose Electron when**: Node.js ecosystem required, broad Chromium version consistency needed.

---

## Context7 Library IDs

For up-to-date documentation:
- `/tauri-apps/tauri-docs` — Official Tauri v2 docs (High reputation, 1934 snippets)
- `/tauri-apps/tauri` — Source code reference

Usage:
```
mcp__context7__resolve-library-id("tauri")
mcp__context7__query-docs(libraryId, "commands IPC plugins capabilities")
```
