// @MX:ANCHOR: [AUTO] AppState - central Tauri managed state for filesystem watcher
// @MX:REASON: [AUTO] Shared across multiple commands: start_watch, stop_watch (fan_in >= 2)
// @MX:SPEC: SPEC-FS-002

use notify::RecommendedWatcher;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

/// Tauri managed application state holding the filesystem watcher and metadata.
pub struct AppState {
    /// The active filesystem watcher, or None if not currently watching.
    pub watcher: Mutex<Option<RecommendedWatcher>>,
    /// The currently watched root path, or None if not watching.
    pub watch_path: Mutex<Option<String>>,
    /// Per-file last-write timestamps for debouncing rapid successive events.
    // @MX:NOTE: [AUTO] Debounce map - prevents duplicate events within 50ms window
    pub last_write_time: Mutex<HashMap<String, Instant>>,
}

impl AppState {
    /// Creates a new AppState with no active watcher.
    pub fn new() -> Self {
        Self {
            watcher: Mutex::new(None),
            watch_path: Mutex::new(None),
            last_write_time: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_new_has_no_watcher() {
        let state = AppState::new();
        let watcher = state.watcher.lock().unwrap();
        assert!(watcher.is_none());
    }

    #[test]
    fn test_app_state_new_has_no_watch_path() {
        let state = AppState::new();
        let path = state.watch_path.lock().unwrap();
        assert!(path.is_none());
    }

    #[test]
    fn test_app_state_new_has_empty_debounce_map() {
        let state = AppState::new();
        let map = state.last_write_time.lock().unwrap();
        assert!(map.is_empty());
    }

    #[test]
    fn test_app_state_default_equals_new() {
        let state = AppState::default();
        assert!(state.watcher.lock().unwrap().is_none());
        assert!(state.watch_path.lock().unwrap().is_none());
        assert!(state.last_write_time.lock().unwrap().is_empty());
    }

    #[test]
    fn test_app_state_watch_path_can_be_set() {
        let state = AppState::new();
        {
            let mut path = state.watch_path.lock().unwrap();
            *path = Some("/tmp/test".to_string());
        }
        let path = state.watch_path.lock().unwrap();
        assert_eq!(*path, Some("/tmp/test".to_string()));
    }

    #[test]
    fn test_app_state_debounce_map_can_be_updated() {
        let state = AppState::new();
        {
            let mut map = state.last_write_time.lock().unwrap();
            map.insert("/tmp/file.md".to_string(), Instant::now());
        }
        let map = state.last_write_time.lock().unwrap();
        assert_eq!(map.len(), 1);
        assert!(map.contains_key("/tmp/file.md"));
    }
}
