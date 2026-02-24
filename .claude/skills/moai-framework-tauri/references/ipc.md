# Tauri v2 IPC Patterns Reference

Complete guide for Frontend ↔ Rust IPC communication in Tauri v2.

---

## invoke() — Frontend to Rust

### Basic Pattern

```typescript
import { invoke } from '@tauri-apps/api/core';

// Simple string command
const content = await invoke<string>('read_file', { path: '/home/user/doc.md' });

// Command with no return value
await invoke<void>('write_file', { path: '/home/user/doc.md', content: 'Hello' });

// Command returning complex type
interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  extension?: string;
}
const nodes = await invoke<FileNode[]>('read_directory', { path: '/home/user' });
```

### Error Handling

```typescript
import { invoke } from '@tauri-apps/api/core';

async function readFileSafe(path: string): Promise<string | null> {
  try {
    return await invoke<string>('read_file', { path });
  } catch (error) {
    console.error('Failed to read file:', error);
    return null;
  }
}
```

### Type-Safe IPC Wrapper (Recommended Pattern)

```typescript
// src/lib/tauri/ipc.ts
import { invoke } from '@tauri-apps/api/core';
import type { FileNode } from '../../types/file';

export const FileAPI = {
  readFile: (path: string): Promise<string> =>
    invoke<string>('read_file', { path }),

  writeFile: (path: string, content: string): Promise<void> =>
    invoke<void>('write_file', { path, content }),

  createFile: (path: string): Promise<void> =>
    invoke<void>('create_file', { path }),

  deleteFile: (path: string): Promise<void> =>
    invoke<void>('delete_file', { path }),

  renameFile: (oldPath: string, newPath: string): Promise<void> =>
    invoke<void>('rename_file', { oldPath, newPath }),

  readDirectory: (path: string): Promise<FileNode[]> =>
    invoke<FileNode[]>('read_directory', { path }),

  openDirectoryDialog: (): Promise<string | null> =>
    invoke<string | null>('open_directory_dialog'),

  startWatch: (path: string): Promise<void> =>
    invoke<void>('start_watch', { path }),

  stopWatch: (): Promise<void> =>
    invoke<void>('stop_watch'),
};
```

---

## emit() / listen() — Rust to Frontend Events

### Rust Side: Emitting Events

```rust
use tauri::{AppHandle, Emitter};
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct FileChangedEvent {
    pub kind: String,     // "create" | "modify" | "delete"
    pub path: String,
}

// Emit to all windows
fn emit_file_changed(app: &AppHandle, kind: &str, path: &str) {
    let payload = FileChangedEvent {
        kind: kind.to_string(),
        path: path.to_string(),
    };
    app.emit("file-changed", payload).ok();
}

// Emit to specific window
fn emit_to_main(app: &AppHandle, event: &str, payload: impl Serialize + Clone) {
    if let Some(window) = app.get_webview_window("main") {
        window.emit(event, payload).ok();
    }
}
```

### TypeScript Side: Listening to Events

```typescript
import { listen } from '@tauri-apps/api/event';
import type { FileChangedEvent } from '../../types/file';

// In React component or hook
function useFileWatcher(onFileChanged: (event: FileChangedEvent) => void) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<FileChangedEvent>('file-changed', (event) => {
      onFileChanged(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [onFileChanged]);
}
```

---

## Rust Command Naming Convention

Rust snake_case → JS camelCase conversion is automatic:

```rust
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> { ... }
// Called as: invoke('read_file', { path })  ← snake_case in JS too

// Parameter names are also snake_case → camelCase in JS:
#[tauri::command]
async fn rename_file(old_path: String, new_path: String) -> Result<(), String> { ... }
// Called as: invoke('rename_file', { oldPath: '...', newPath: '...' })
```

**IMPORTANT**: Tauri v2 auto-converts camelCase JS params to snake_case Rust params.

---

## Async Commands with AppHandle

```rust
use tauri::{AppHandle, State, command};
use std::sync::Mutex;

#[command]
pub async fn start_watch(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    path: String,
) -> Result<(), String> {
    let mut state_lock = state.lock().map_err(|e| e.to_string())?;

    // Store AppHandle clone in thread for async event emission
    let app_clone = app.clone();

    // Setup watcher with event emission
    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, _>| {
        if let Ok(event) = res {
            let kind = match event.kind {
                notify::EventKind::Create(_) => "create",
                notify::EventKind::Modify(_) => "modify",
                notify::EventKind::Remove(_) => "delete",
                _ => return,
            };
            for path in &event.paths {
                app_clone.emit("file-changed", FileChangedEvent {
                    kind: kind.to_string(),
                    path: path.to_string_lossy().to_string(),
                }).ok();
            }
        }
    }).map_err(|e| e.to_string())?;

    watcher.watch(path.as_ref(), notify::RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    state_lock.watcher = Some(watcher);
    Ok(())
}
```

---

## Frontend Event Types

```typescript
// src/types/file.ts
export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  extension?: string;
  children?: FileNode[];
}

export interface FileChangedEvent {
  kind: 'create' | 'modify' | 'delete';
  path: string;
}
```

---

## Common Pitfalls

1. **Parameter naming**: JS sends `camelCase`, Rust receives `snake_case` — Tauri handles conversion automatically.

2. **Error serialization**: Always return `Result<T, String>` not `Result<T, Error>`. Custom errors need `impl ToString`.

3. **AppHandle lifetime**: Store `AppHandle` in Arc or clone it before moving into closures.

4. **Event payload must be Clone + Serialize**: Add `#[derive(Clone, serde::Serialize)]` to event structs.

5. **listen() cleanup**: Always call `unlisten()` on component unmount to prevent memory leaks.
