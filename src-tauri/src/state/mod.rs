// State module for application state management
// @MX:NOTE: [AUTO] All Tauri managed state types are exported from here
// @MX:SPEC: SPEC-FS-002

pub mod app_state;

pub use app_state::AppState;

pub const STATE_MODULE_NAME: &str = "state";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_module_name() {
        assert_eq!(STATE_MODULE_NAME, "state");
    }

    #[test]
    fn test_app_state_exported() {
        // Verify AppState is accessible through the state module
        let state = AppState::new();
        assert!(state.watcher.lock().unwrap().is_none());
    }
}
