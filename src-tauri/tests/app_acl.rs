// SPEC-SEC-001: 앱 명령 ACL 드리프트 방지 테스트.
// `generate_handler!` 목록 · `APP_COMMANDS` · `capabilities/main.json` 세 곳이 어긋나면 실패한다.
// 권한이 하나라도 빠지면 빌드는 통과하지만 런타임에서만 거부되므로, 여기서 먼저 잡는다.
use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;

include!("../app_commands.rs");

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// `read_file` → `allow-read-file`
fn permission_id(command: &str) -> String {
    format!("allow-{}", command.replace('_', "-"))
}

/// lib.rs 의 `generate_handler![ ... ]` 안 `모듈::함수` 식별자에서 함수명만 뽑는다.
fn handler_commands() -> BTreeSet<String> {
    let src = fs::read_to_string(manifest_dir().join("src/lib.rs")).expect("read lib.rs");
    let start = src
        .find("generate_handler![")
        .expect("generate_handler! not found in lib.rs")
        + "generate_handler![".len();
    let end = start + src[start..].find(']').expect("generate_handler! not closed");
    src[start..end]
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.rsplit("::").next().unwrap().to_string())
        .collect()
}

#[test]
fn handler_list_matches_app_commands() {
    let handlers = handler_commands();
    let listed: BTreeSet<String> = APP_COMMANDS.iter().map(|s| s.to_string()).collect();

    assert_eq!(APP_COMMANDS.len(), 26, "APP_COMMANDS 길이는 26이어야 한다");
    assert_eq!(listed.len(), APP_COMMANDS.len(), "APP_COMMANDS 에 중복이 있다");
    let missing: Vec<_> = handlers.difference(&listed).collect();
    let extra: Vec<_> = listed.difference(&handlers).collect();
    assert!(
        missing.is_empty() && extra.is_empty(),
        "generate_handler! 에만 있음: {missing:?} / APP_COMMANDS 에만 있음: {extra:?}"
    );
}

fn read_json(path: &PathBuf) -> serde_json::Value {
    let text = fs::read_to_string(path).unwrap_or_else(|e| panic!("read {path:?}: {e}"));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("parse {path:?}: {e}"))
}

#[test]
fn capability_covers_every_app_command() {
    let main = read_json(&manifest_dir().join("capabilities/main.json"));
    // 앱 명령 권한은 접두사가 없는 `allow-*` 문자열이다(플러그인 권한은 `plugin:allow-*`).
    let granted: BTreeSet<String> = main["permissions"]
        .as_array()
        .expect("permissions array")
        .iter()
        .filter_map(|p| p.as_str())
        .filter(|p| p.starts_with("allow-"))
        .map(str::to_string)
        .collect();
    let expected: BTreeSet<String> = APP_COMMANDS.iter().map(|c| permission_id(c)).collect();

    let missing: Vec<_> = expected.difference(&granted).collect();
    let extra: Vec<_> = granted.difference(&expected).collect();
    assert!(
        missing.is_empty() && extra.is_empty(),
        "main.json 에 빠진 권한: {missing:?} / 목록에 없는 권한: {extra:?}"
    );
}

#[test]
fn no_remote_urls() {
    let dir = manifest_dir().join("capabilities");
    let mut checked = 0;
    for entry in fs::read_dir(&dir).expect("read capabilities dir") {
        let path = entry.unwrap().path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let cap = read_json(&path);
        assert!(cap.get("remote").is_none(), "{path:?} 에 `remote` 항목이 있다");
        checked += 1;
    }
    assert!(checked >= 1, "검사한 capability 파일이 없다");

    let main = read_json(&dir.join("main.json"));
    assert_eq!(main["windows"], serde_json::json!(["main"]), "windows 는 [\"main\"] 이어야 한다");
}
