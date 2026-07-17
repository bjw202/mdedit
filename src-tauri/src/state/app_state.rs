// @MX:ANCHOR: [AUTO] AppState - central Tauri managed state for filesystem watcher
// @MX:REASON: [AUTO] Shared across multiple commands: start_watch, stop_watch (fan_in >= 2)
// @MX:SPEC: SPEC-FS-002

use notify::RecommendedWatcher;
use std::collections::HashMap;
use std::process::Child;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// 진행 중(in-flight) AI 요청 핸들. 동시 1개만 유지한다(REQ-AI-009).
// @MX:NOTE: [AUTO] child = kill 대상, cancel_flag = 릴레이 스레드가 무음 종료를 판정하는 공유 플래그
pub struct InFlightRequest {
    /// 이 요청의 프론트 상관 id.
    pub request_id: String,
    /// 스폰된 CLI 프로세스(취소 시 kill).
    pub child: Child,
    /// 취소 신호. 릴레이 스레드가 종료 시 이 값을 보고 오류 대신 무음 처리한다(§3 P7).
    pub cancel_flag: Arc<AtomicBool>,
    /// SPEC-AI-006 REQ-AI6-006: 단일발행 선점 공유 플래그. 릴레이·워치독·`ai_cancel`·신규
    /// 요청 교체 네 지점이 발행 전 이 플래그를 claim한다(`claude_cli::claim_terminal`).
    pub finished: Arc<AtomicBool>,
}

/// Tauri managed application state holding the filesystem watcher and metadata.
pub struct AppState {
    /// The active filesystem watcher, or None if not currently watching.
    pub watcher: Mutex<Option<RecommendedWatcher>>,
    /// The currently watched root path, or None if not watching.
    pub watch_path: Mutex<Option<String>>,
    /// Per-file last-write timestamps for debouncing rapid successive events.
    // @MX:NOTE: [AUTO] Debounce map - prevents duplicate events within 50ms window
    pub last_write_time: Mutex<HashMap<String, Instant>>,
    /// 진행 중 AI 요청(동시 1개). 새 요청이 기존을 자동 취소·교체한다(REQ-AI-006/009).
    pub in_flight: Mutex<Option<InFlightRequest>>,
    /// 조직 정책 kill-switch로 AI가 강제 비활성인지(REQ-AI-017). lib.rs setup에서 1회 프로브.
    pub ai_policy_disabled: Mutex<bool>,
    /// 정책 비활성의 출처(`env`|`policy-file`), 비활성이 아니면 None. setup에서 함께 프로브.
    pub ai_policy_source: Mutex<Option<String>>,
}

impl AppState {
    /// Creates a new AppState with no active watcher.
    pub fn new() -> Self {
        Self {
            watcher: Mutex::new(None),
            watch_path: Mutex::new(None),
            last_write_time: Mutex::new(HashMap::new()),
            in_flight: Mutex::new(None),
            ai_policy_disabled: Mutex::new(false),
            ai_policy_source: Mutex::new(None),
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
    fn test_app_state_new_has_no_in_flight() {
        let state = AppState::new();
        assert!(state.in_flight.lock().unwrap().is_none());
    }

    #[test]
    fn test_app_state_new_policy_not_disabled_by_default() {
        let state = AppState::new();
        assert!(!*state.ai_policy_disabled.lock().unwrap());
    }

    #[test]
    fn test_app_state_policy_flag_can_be_set() {
        let state = AppState::new();
        {
            let mut guard = state.ai_policy_disabled.lock().unwrap();
            *guard = true;
        }
        assert!(*state.ai_policy_disabled.lock().unwrap());
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
