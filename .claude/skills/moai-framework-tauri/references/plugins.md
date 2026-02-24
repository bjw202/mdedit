# Tauri v2 Plugin Reference

Official plugin usage patterns for Tauri v2 applications.

---

## tauri-plugin-fs

### Setup

```toml
# Cargo.toml
tauri-plugin-fs = "2"
```

```rust
// lib.rs
.plugin(tauri_plugin_fs::init())
```

```bash
pnpm add @tauri-apps/plugin-fs
```

### Rust Commands Using fs Plugin Scope

The fs plugin exposes its own JS API. For custom Rust commands that do file I/O, use `std::fs` directly (the plugin handles permissions, not the Rust API):

```rust
use std::fs;
use std::path::Path;

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_file(path: String) -> Result<(), String> {
    fs::write(&path, "").map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}
```

### Directory Reading with FileNode

```rust
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub extension: Option<String>,
}

#[tauri::command]
pub async fn read_directory(path: String) -> Result<Vec<FileNode>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;

    let mut nodes: Vec<FileNode> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let name = path.file_name()?.to_string_lossy().to_string();

            // Skip hidden files
            if name.starts_with('.') {
                return None;
            }

            let is_directory = path.is_dir();
            let extension = if is_directory {
                None
            } else {
                path.extension().map(|e| e.to_string_lossy().to_string())
            };

            Some(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_directory,
                extension,
            })
        })
        .collect();

    // Sort: directories first, then files
    nodes.sort_by(|a, b| {
        b.is_directory.cmp(&a.is_directory).then(a.name.cmp(&b.name))
    });

    Ok(nodes)
}
```

### TypeScript fs Plugin API (direct JS usage)

```typescript
import { readTextFile, writeTextFile, readDir, exists } from '@tauri-apps/plugin-fs';

// Read file
const content = await readTextFile('/path/to/file.md');

// Write file
await writeTextFile('/path/to/file.md', '# Hello');

// List directory
const entries = await readDir('/path/to/dir');

// Check existence
const fileExists = await exists('/path/to/file.md');
```

---

## tauri-plugin-dialog

### Setup

```toml
tauri-plugin-dialog = "2"
```

```rust
.plugin(tauri_plugin_dialog::init())
```

```bash
pnpm add @tauri-apps/plugin-dialog
```

### Rust: Open Directory Dialog

```rust
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn open_directory_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = app.dialog()
        .file()
        .blocking_pick_folder();

    Ok(path.map(|p| p.to_string()))
}
```

### TypeScript: File/Folder Dialogs

```typescript
import { open, save, message, ask } from '@tauri-apps/plugin-dialog';

// Open folder dialog
const folderPath = await open({
  directory: true,
  multiple: false,
  title: 'Select Project Folder',
});

// Open file dialog (multiple)
const files = await open({
  multiple: true,
  filters: [{ name: 'Markdown', extensions: ['md', 'mdx'] }],
});

// Save file dialog
const savePath = await save({
  filters: [{ name: 'Markdown', extensions: ['md'] }],
  defaultPath: 'untitled.md',
});

// Confirmation dialog
const confirmed = await ask('Are you sure?', {
  title: 'Confirm',
  kind: 'warning',
});

// Message dialog
await message('File saved!', { title: 'Success', kind: 'info' });
```

---

## tauri-plugin-shell

### Setup

```toml
tauri-plugin-shell = "2"
```

```rust
.plugin(tauri_plugin_shell::init())
```

```bash
pnpm add @tauri-apps/plugin-shell
```

### Open External URLs

```typescript
import { open } from '@tauri-apps/plugin-shell';

// Open URL in default browser
await open('https://example.com');

// Open file manager
await open('/path/to/folder');
```

---

## notify Crate (File Watcher)

The `notify` crate is NOT a Tauri plugin — it's a standard Rust crate for cross-platform file system event monitoring.

### Setup

```toml
notify = "6"
```

### File Watcher with Tauri Event Emission

```rust
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;

#[derive(Clone, Serialize)]
pub struct FileChangedEvent {
    pub kind: String,
    pub path: String,
}

pub struct AppState {
    pub watcher: Option<RecommendedWatcher>,
}

impl Default for AppState {
    fn default() -> Self {
        Self { watcher: None }
    }
}

#[tauri::command]
pub async fn start_watch(
    app: AppHandle,
    state: tauri::State<'_, Mutex<AppState>>,
    path: String,
) -> Result<(), String> {
    let mut state_lock = state.lock().map_err(|e| e.to_string())?;

    // Stop existing watcher
    state_lock.watcher = None;

    let app_clone = app.clone();

    let watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let kind = match event.kind {
                    EventKind::Create(_) => "create",
                    EventKind::Modify(_) => "modify",
                    EventKind::Remove(_) => "delete",
                    _ => return,
                };
                for path in &event.paths {
                    let _ = app_clone.emit("file-changed", FileChangedEvent {
                        kind: kind.to_string(),
                        path: path.to_string_lossy().to_string(),
                    });
                }
            }
        },
        Config::default(),
    ).map_err(|e| e.to_string())?;

    let mut watcher = watcher;
    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    state_lock.watcher = Some(watcher);
    Ok(())
}

#[tauri::command]
pub async fn stop_watch(
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let mut state_lock = state.lock().map_err(|e| e.to_string())?;
    state_lock.watcher = None;
    Ok(())
}
```

---

## Plugin Permissions Summary

Each plugin needs entries in `capabilities/main.json`:

```json
{
  "permissions": [
    "fs:default",
    { "identifier": "fs:allow-read-text-file", "allow": [{ "path": "$HOME/**" }] },
    { "identifier": "fs:allow-write-text-file", "allow": [{ "path": "$HOME/**" }] },
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "shell:default",
    "shell:allow-open"
  ]
}
```
