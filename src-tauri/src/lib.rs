// @MX:ANCHOR: [AUTO] Tauri application entry point - registers all IPC commands
// @MX:REASON: Central wiring of all commands and plugins (fan_in >= 5)
// @MX:SPEC: SPEC-FS-001, SPEC-FS-004

pub mod ai;
pub mod commands;
pub mod models;
pub mod process_util;
pub mod state;

use commands::{browser_ops, directory_ops, file_open, file_ops, image_ops, watcher};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // single-instance는 체인 첫 번째(다른 플러그인보다 먼저)로 등록해야
        // 두 번째 프로세스가 창을 만들기 전에 기존 인스턴스로 포워드된다(REQ-FS-004-004).
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            // 두 번째 인스턴스의 argv → 기존 인스턴스 스테이징(Windows/Linux 실행 중 경로).
            if let Some(raw) = file_open::find_md_in_args(&argv) {
                let cwd_path = std::path::PathBuf::from(&cwd);
                if let Some(pending) = file_open::resolve_md_path(&raw, Some(&cwd_path)) {
                    file_open::stage_pending_open(app, &pending);
                }
            }
            // .md 유무와 무관하게 항상 기존 "main" 창 포커스(REQ-FS-004-006 — 아이콘 재클릭 UX).
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .setup(|app| {
            // Windows 작업표시줄(실행 중) 아이콘 강제 세팅.
            // Windows는 실행 창의 AppUserModelID(번들 식별자)에 아이콘 비트맵을
            // iconcache에 캐싱한다. 예전 버전이 설치됐던 PC는 이 캐시에 옛 아이콘이
            // 남아, exe/시작메뉴 아이콘은 새것인데 작업표시줄 버튼만 옛것으로 나온다.
            // 시작 시 새 아이콘 HICON을 창에 직접 밀어넣어(WM_SETICON) 캐시를 덮어쓴다.
            use tauri::Manager;
            for (_label, window) in app.webview_windows() {
                if let Ok(icon) =
                    tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))
                {
                    let _ = window.set_icon(icon);
                }
            }

            // 조직 정책 kill-switch를 1회 프로브해 상태에 저장한다(REQ-AI-017).
            let (policy_disabled, policy_source) = ai::probe_policy(app.handle());
            if let Some(state) = app.try_state::<AppState>() {
                if let Ok(mut guard) = state.ai_policy_disabled.lock() {
                    *guard = policy_disabled;
                }
                if let Ok(mut guard) = state.ai_policy_source.lock() {
                    *guard = policy_source;
                }
            }

            // 런치 argv 처리(Windows/Linux 런치 경로, REQ-FS-004-002). macOS 번들은 파일이
            // Apple Event로 전달되어 argv에 없으므로 자연 no-op — 실행 중 재오픈은 아래
            // RunEvent::Opened가 담당한다(REQ-FS-004-005).
            let argv: Vec<String> = std::env::args().collect();
            if let Some(raw) = file_open::find_md_in_args(&argv) {
                let cwd = std::env::current_dir().unwrap_or_default();
                if let Some(pending) = file_open::resolve_md_path(&raw, Some(&cwd)) {
                    file_open::stage_pending_open(app.handle(), &pending);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            file_ops::read_file,
            file_ops::write_file,
            file_ops::read_file_size,
            file_ops::create_file,
            file_ops::delete_file,
            file_ops::rename_file,
            file_ops::save_file_as,
            file_ops::export_save_dialog,
            file_ops::write_binary_file,
            file_ops::print_current_window,
            directory_ops::read_directory,
            directory_ops::open_directory_dialog,
            directory_ops::register_asset_scope,
            watcher::start_watch,
            watcher::stop_watch,
            image_ops::save_image_from_clipboard,
            image_ops::copy_image_to_folder,
            image_ops::read_image_as_base64,
            image_ops::open_image_dialog,
            browser_ops::open_url_in_browser,
            ai::ai_request,
            ai::ai_cancel,
            ai::ai_detect_providers,
            ai::ai_policy_status,
            file_open::take_pending_open_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            // macOS 실행 중 오픈 — 번들 재활성화가 urls를 실어 보낸다(REQ-FS-004-005).
            // 다중 url은 first_md_url이 첫 .md 1개만 수용한다(REQ-FS-004-010).
            // @MX:WARN: [AUTO] RunEvent::Opened는 tauri가 cfg(any(macos, ios))로만 노출하는 플랫폼 전용 변형이다(tauri 2.10.3 app.rs:233).
            // @MX:REASON: [AUTO] 이 매치 암의 cfg를 제거하면 Windows 타깃에서 E0599(no variant `Opened`)로 빌드가 깨진다 — Windows 진입은 single-instance 콜백과 setup argv가 담당한다.
            // @MX:SPEC: SPEC-FS-004
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            tauri::RunEvent::Opened { urls } => {
                if let Some(raw) = file_open::first_md_url(&urls) {
                    let cwd = std::env::current_dir().unwrap_or_default();
                    if let Some(pending) = file_open::resolve_md_path(&raw, Some(&cwd)) {
                        file_open::stage_pending_open(app, &pending);
                    }
                }
            }
            _ => {
                // 비-Apple 타깃: 외부 오픈 진입은 single-instance 콜백/ setup argv가 이미 처리했다.
                // 게이트된 암에서만 app을 쓰므로 여기서 사용 표시만 유지한다.
                let _ = app;
            }
        });
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_run_compiles() {
        // Verify the library compiles correctly
        // This test validates the build configuration
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
