// SPEC-SEC-001: 앱 명령 이름 목록의 단일 출처.
//
// 이 파일은 `build.rs`(앱 ACL 매니페스트 생성)와 `tests/app_acl.rs`(드리프트 방지 테스트)가
// `include!`로 읽는다. 크레이트 모듈이 아니므로 `mod`로 선언하지 않는다.
//
// 새 앱 명령을 추가할 때는 아래 세 곳을 함께 고쳐야 한다. 하나라도 빠지면 빌드는 통과하지만
// 런타임에서 그 명령이 "not allowed"로 거부된다.
//   1. `src/lib.rs`의 `generate_handler!` 목록
//   2. 이 파일의 `APP_COMMANDS`
//   3. `capabilities/main.json`의 `allow-<명령-kebab>` 권한 (예: `read_file` -> `allow-read-file`)
// 1~3이 어긋나면 `cargo test --manifest-path src-tauri/Cargo.toml --test app_acl`이 실패한다.
//
// @MX:ANCHOR: 앱 명령 허용 목록의 단일 출처 — build.rs, tests/app_acl.rs, 프런트 계약 테스트가 읽는다
// @MX:REASON: 이 목록과 main.json이 어긋나면 해당 명령이 런타임에서만 거부된다(빌드는 통과)
// @MX:SPEC: SPEC-SEC-001
// @MX:NOTE: 원격·불투명 출처 프레임은 main capability에 속하지 않으므로 이 명령들을 호출할 수 없다
#[allow(dead_code)]
pub const APP_COMMANDS: &[&str] = &[
    // file_ops
    "read_file",
    "write_file",
    "read_file_size",
    "create_file",
    "delete_file",
    "rename_file",
    "save_file_as",
    "export_save_dialog",
    "write_binary_file",
    "print_current_window",
    // directory_ops
    "read_directory",
    "open_directory_dialog",
    "register_asset_scope",
    // watcher
    "start_watch",
    "stop_watch",
    // image_ops
    "save_image_from_clipboard",
    "copy_image_to_folder",
    "read_image_as_base64",
    "read_relative_image_as_base64",
    "open_image_dialog",
    // browser_ops
    "open_url_in_browser",
    // ai
    "ai_request",
    "ai_cancel",
    "ai_detect_providers",
    "ai_policy_status",
    // file_open
    "take_pending_open_file",
];
