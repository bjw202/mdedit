// @MX:ANCHOR: [AUTO] Tauri application entry point - registers all IPC commands
// @MX:REASON: Central wiring of all commands and plugins (fan_in >= 5)
// @MX:SPEC: SPEC-FS-001

pub mod commands;
pub mod models;
pub mod state;

use commands::{directory_ops, file_ops, watcher};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            file_ops::read_file,
            file_ops::write_file,
            file_ops::create_file,
            file_ops::delete_file,
            file_ops::rename_file,
            file_ops::save_file_as,
            file_ops::export_save_dialog,
            file_ops::write_binary_file,
            file_ops::print_current_window,
            directory_ops::read_directory,
            directory_ops::open_directory_dialog,
            watcher::start_watch,
            watcher::stop_watch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_run_compiles() {
        // Verify the library compiles correctly
        assert!(true);
    }

    #[test]
    fn test_commands_module_exists() {
        // Verify commands module is accessible
        assert_eq!(crate::commands::COMMANDS_MODULE_NAME, "commands");
    }

    #[test]
    fn test_models_module_exists() {
        // Verify models module is accessible
        assert_eq!(crate::models::MODELS_MODULE_NAME, "models");
    }

    #[test]
    fn test_state_module_exists() {
        // Verify state module is accessible
        assert_eq!(crate::state::STATE_MODULE_NAME, "state");
    }

    #[test]
    fn test_watcher_commands_accessible() {
        // Verify watcher module is accessible through commands
        use crate::commands::watcher;
        // Test the filter utility functions directly
        assert!(!watcher::should_ignore_path("/project/README.md"));
        assert!(watcher::should_ignore_path("/project/.git/HEAD"));
    }

    #[test]
    fn test_file_changed_event_accessible() {
        use crate::models::{FileChangedEvent, FileChangeKind};
        let event = FileChangedEvent::new(FileChangeKind::Modified, "/tmp/test.md".to_string(), 0);
        assert_eq!(event.path, "/tmp/test.md");
    }
}
