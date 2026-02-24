// @MX:ANCHOR: [AUTO] Filesystem watcher Tauri commands - start_watch and stop_watch
// @MX:REASON: [AUTO] Public API boundary called by frontend (fan_in >= 2)
// @MX:SPEC: SPEC-FS-002

use notify::{recommended_watcher, Event, RecursiveMode, Result as NotifyResult, Watcher};
use std::path::Path;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::Emitter;

use crate::models::file_event::{FileChangedEvent, FileChangeKind};
use crate::state::app_state::AppState;

// @MX:NOTE: [AUTO] Filenames to skip during event filtering - prevents noise from editors and OS
const IGNORED_SUFFIXES: &[&str] = &[".tmp", ".swp", "~"];
const IGNORED_CONTAINS: &[&str] = &[".git/", ".DS_Store", "Thumbs.db", "node_modules/"];

/// Debounce interval in milliseconds.
const DEBOUNCE_MS: u128 = 50;

/// Returns true if the path should be ignored based on filename patterns.
pub fn should_ignore_path(path: &str) -> bool {
    for suffix in IGNORED_SUFFIXES {
        if path.ends_with(suffix) {
            return true;
        }
    }
    for fragment in IGNORED_CONTAINS {
        if path.contains(fragment) {
            return true;
        }
    }
    false
}

/// Normalizes a path to use forward slashes.
pub fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

/// Returns the current Unix timestamp in milliseconds.
fn unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Maps a notify EventKind to our FileChangeKind.
fn map_event_kind(kind: &notify::EventKind) -> Option<FileChangeKind> {
    match kind {
        notify::EventKind::Create(_) => Some(FileChangeKind::Created),
        notify::EventKind::Modify(_) => Some(FileChangeKind::Modified),
        notify::EventKind::Remove(_) => Some(FileChangeKind::Deleted),
        notify::EventKind::Any => Some(FileChangeKind::Modified),
        _ => None,
    }
}

/// Starts watching the given directory path for filesystem changes.
/// Stops any previously active watcher before starting the new one.
/// Emits `file-changed` events to the frontend for each qualifying change.
// @MX:WARN: [AUTO] Spawns a notify watcher thread - requires careful state management
// @MX:REASON: Watcher callback runs in a separate OS thread, communicating via AppHandle
#[tauri::command]
pub fn start_watch(
    path: String,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Stop existing watcher first
    {
        let mut watcher_guard = state
            .watcher
            .lock()
            .map_err(|e| format!("Failed to lock watcher: {}", e))?;
        *watcher_guard = None;
    }
    {
        let mut path_guard = state
            .watch_path
            .lock()
            .map_err(|e| format!("Failed to lock watch_path: {}", e))?;
        *path_guard = None;
    }
    {
        let mut map_guard = state
            .last_write_time
            .lock()
            .map_err(|e| format!("Failed to lock last_write_time: {}", e))?;
        map_guard.clear();
    }

    // Clone state references for the callback thread
    // Note: AppState fields use Mutex so we share via Arc through Tauri's State
    let app_handle_clone = app_handle.clone();

    // We need owned access to debounce map in the callback.
    // Use a separate Mutex wrapped in Arc for the debounce state inside the callback.
    let debounce_map: std::sync::Arc<std::sync::Mutex<std::collections::HashMap<String, Instant>>> =
        std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new()));

    let debounce_map_cb = debounce_map.clone();

    let watcher_result = recommended_watcher(move |res: NotifyResult<Event>| {
        let event = match res {
            Ok(e) => e,
            Err(_) => return,
        };

        let change_kind = match map_event_kind(&event.kind) {
            Some(k) => k,
            None => return,
        };

        for path_buf in &event.paths {
            let path_str = normalize_path(path_buf);

            if should_ignore_path(&path_str) {
                continue;
            }

            // Debounce: skip if last event for this path was < DEBOUNCE_MS ago
            let now = Instant::now();
            {
                if let Ok(mut map) = debounce_map_cb.lock() {
                    if let Some(last) = map.get(&path_str) {
                        if now.duration_since(*last).as_millis() < DEBOUNCE_MS {
                            continue;
                        }
                    }
                    map.insert(path_str.clone(), now);
                }
            }

            let payload = FileChangedEvent::new(change_kind.clone(), path_str, unix_ms());

            // Emit event to all frontend windows
            let _ = app_handle_clone.emit("file-changed", &payload);
        }
    });

    let mut watcher = watcher_result.map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch path '{}': {}", path, e))?;

    {
        let mut watcher_guard = state
            .watcher
            .lock()
            .map_err(|e| format!("Failed to lock watcher: {}", e))?;
        *watcher_guard = Some(watcher);
    }
    {
        let mut path_guard = state
            .watch_path
            .lock()
            .map_err(|e| format!("Failed to lock watch_path: {}", e))?;
        *path_guard = Some(path);
    }

    Ok(())
}

/// Stops the active filesystem watcher and clears the watched path.
#[tauri::command]
pub fn stop_watch(state: tauri::State<'_, AppState>) -> Result<(), String> {
    {
        let mut watcher_guard = state
            .watcher
            .lock()
            .map_err(|e| format!("Failed to lock watcher: {}", e))?;
        *watcher_guard = None;
    }
    {
        let mut path_guard = state
            .watch_path
            .lock()
            .map_err(|e| format!("Failed to lock watch_path: {}", e))?;
        *path_guard = None;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- should_ignore_path tests ---

    #[test]
    fn test_should_ignore_tmp_files() {
        assert!(should_ignore_path("/tmp/some_file.tmp"));
    }

    #[test]
    fn test_should_ignore_swp_files() {
        assert!(should_ignore_path("/home/user/.file.swp"));
    }

    #[test]
    fn test_should_ignore_tilde_backup_files() {
        assert!(should_ignore_path("/home/user/file.md~"));
    }

    #[test]
    fn test_should_ignore_git_directory() {
        assert!(should_ignore_path("/project/.git/COMMIT_EDITMSG"));
    }

    #[test]
    fn test_should_ignore_ds_store() {
        assert!(should_ignore_path("/project/.DS_Store"));
    }

    #[test]
    fn test_should_ignore_thumbs_db() {
        assert!(should_ignore_path("C:/Users/user/Thumbs.db"));
    }

    #[test]
    fn test_should_ignore_node_modules() {
        assert!(should_ignore_path("/project/node_modules/react/index.js"));
    }

    #[test]
    fn test_should_not_ignore_normal_md_file() {
        assert!(!should_ignore_path("/project/README.md"));
    }

    #[test]
    fn test_should_not_ignore_normal_ts_file() {
        assert!(!should_ignore_path("/project/src/main.ts"));
    }

    #[test]
    fn test_should_not_ignore_normal_rs_file() {
        assert!(!should_ignore_path("/project/src/lib.rs"));
    }

    // --- normalize_path tests ---

    #[test]
    fn test_normalize_path_unix() {
        let path = Path::new("/home/user/file.md");
        assert_eq!(normalize_path(path), "/home/user/file.md");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_normalize_path_windows_backslash() {
        // On Windows, backslashes should be converted to forward slashes
        let path = Path::new("C:\\Users\\user\\file.md");
        assert_eq!(normalize_path(path), "C:/Users/user/file.md");
    }

    // --- map_event_kind tests ---

    #[test]
    fn test_map_event_kind_create() {
        let kind = notify::EventKind::Create(notify::event::CreateKind::File);
        assert_eq!(map_event_kind(&kind), Some(FileChangeKind::Created));
    }

    #[test]
    fn test_map_event_kind_modify() {
        let kind = notify::EventKind::Modify(notify::event::ModifyKind::Data(
            notify::event::DataChange::Any,
        ));
        assert_eq!(map_event_kind(&kind), Some(FileChangeKind::Modified));
    }

    #[test]
    fn test_map_event_kind_remove() {
        let kind = notify::EventKind::Remove(notify::event::RemoveKind::File);
        assert_eq!(map_event_kind(&kind), Some(FileChangeKind::Deleted));
    }

    #[test]
    fn test_map_event_kind_access_returns_none() {
        let kind = notify::EventKind::Access(notify::event::AccessKind::Any);
        assert_eq!(map_event_kind(&kind), None);
    }

    // --- AppState construction test ---

    #[test]
    fn test_app_state_created_for_watcher_module() {
        let state = AppState::new();
        assert!(state.watcher.lock().unwrap().is_none());
        assert!(state.watch_path.lock().unwrap().is_none());
    }
}
