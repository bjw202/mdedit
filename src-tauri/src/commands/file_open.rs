// @MX:NOTE: [AUTO] 외부 .md 오픈 진입 헬퍼 — 3개 OS 진입 경로가 stage_pending_open으로 수렴
// @MX:SPEC: SPEC-FS-004

use crate::models::PendingOpenFile;
use crate::state::AppState;
use tauri::{Emitter, Manager};

/// 경로 문자열이 `.md` 확장자인지 판정한다(대소문자 무시). 그 외 전부 false(범위 가드, REQ-FS-004-003).
pub fn is_markdown_path(path: &str) -> bool {
    std::path::Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
}

/// argv에서 첫 번째 .md 인자를 찾는다. `-`로 시작하는 플래그는 확장자 검사 전에 스킵한다.
/// argv[0]을 skip(1)하지 않는다 — single-instance argv는 폼별로 argv[0] 포함 여부가 달라
/// 필터+확장자 검사가 양쪽에 견고하다(계약 결정 #4).
pub fn find_md_in_args(args: &[String]) -> Option<String> {
    args.iter()
        .filter(|arg| !arg.starts_with('-'))
        .find(|arg| is_markdown_path(arg))
        .cloned()
}

/// macOS `RunEvent::Opened` urls에서 첫 번째 `file://` .md의 파일 경로를 반환한다.
/// 비-file 스킴(https 등)은 무시하고, 다중 .md는 첫 번째만 수용한다(REQ-FS-004-010).
pub fn first_md_url(urls: &[tauri::Url]) -> Option<String> {
    urls.iter()
        .filter(|url| url.scheme() == "file")
        .filter(|url| is_markdown_path(url.path()))
        .find_map(|url| url.to_file_path().ok())
        .map(|path| path.to_string_lossy().to_string())
}

/// raw 경로를 검증해 PendingOpenFile을 계산한다. .md 검증 → is_file 존재 검사 →
/// `Path::parent()` dir 계산 순서. 존재하지 않거나 .md가 아니면 None(조용히 무시, REQ-FS-004-012).
// @MX:WARN: [AUTO] canonicalize 절대 금지 구역 — dir 계산은 Path::parent()만 사용한다
// @MX:REASON: [AUTO] Windows std::fs::canonicalize의 \\?\ 확장 경로 접두사가 프론트 watchedPath 비교를 영구 실패시키고 localStorage lastWatchedPath를 오염시킴(directory_ops.rs:112-125 선례, REQ-FS-004-013)
// @MX:SPEC: SPEC-FS-004
pub fn resolve_md_path(raw: &str, cwd: Option<&std::path::Path>) -> Option<PendingOpenFile> {
    if !is_markdown_path(raw) {
        return None;
    }
    let raw_path = std::path::Path::new(raw);
    let path = if raw_path.is_absolute() {
        raw_path.to_path_buf()
    } else {
        cwd?.join(raw_path)
    };
    // 존재 검사: 없는 파일과 ".md"라는 이름의 디렉터리 모두 여기서 조용히 걸러진다.
    if !path.is_file() {
        return None;
    }
    let dir = path.parent()?;
    Some(PendingOpenFile::new(
        path.to_string_lossy().to_string(),
        dir.to_string_lossy().to_string(),
    ))
}

/// 외부 오픈 페이로드를 스테이징한다: AppState 슬롯 저장(latest-wins) + "main" 창으로
/// `"open-file"` 이벤트 emit. emit은 리스너 등록 전 도착 시 유실되므로 AppState 슬롯이
/// 원천이고 이벤트는 실행 중 프론트에 대한 통지일 뿐이다(런치 레이스, REQ-FS-004-011).
// @MX:ANCHOR: [AUTO] 3개 OS 진입 경로(single-instance 콜백 / setup argv / Opened 클로저)의 단일 수렴점
// @MX:REASON: [AUTO] fan_in >= 3 — 외부 오픈 계약의 유일한 스테이징 지점. 진입 경로 추가 시 이 함수만 통과한다
// @MX:SPEC: SPEC-FS-004
pub fn stage_pending_open(app: &tauri::AppHandle, pending: &PendingOpenFile) {
    // 1) AppState 슬롯 저장 — 리스너 등록 전 emit 유실을 커버하는 원천.
    if let Some(state) = app.try_state::<AppState>() {
        state.set_pending_open_file(pending.clone());
    }
    // 2) "main" 창으로 통지 emit — 이미 실행 중인 프론트에 깨움 역할만 한다.
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("open-file", pending.clone());
    }
}

/// 스테이징된 외부 오픈 페이로드를 드레인한다. take 후 슬롯은 클리어 —
/// 두 소비자(마운트 효과 / 라이브 이벤트 핸들러)가 동시 take해도 한쪽만 Some을 받는다(atomic-take, REQ-FS-004-011).
#[tauri::command]
pub fn take_pending_open_file(state: tauri::State<'_, AppState>) -> Option<PendingOpenFile> {
    state.take_pending_open_file()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// 테스트용 고유 temp 디렉터리를 만든다(외부 crate 없이).
    fn temp_root() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "mdedit-fs004-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    // ── is_markdown_path: AC-003 대소문자 무시 .md 매트릭스 ─────────────────────
    // @MX:SPEC: SPEC-FS-004

    #[test]
    fn test_is_markdown_path_accepts_md_case_insensitive() {
        assert!(is_markdown_path("note.md"));
        assert!(is_markdown_path("note.MD"));
        assert!(is_markdown_path("note.Md"));
        assert!(is_markdown_path("archive.tar.md"));
        assert!(is_markdown_path("/a/b/c.MD"));
    }

    #[test]
    fn test_is_markdown_path_rejects_other_extensions_and_no_extension() {
        assert!(!is_markdown_path("note.markdown"));
        assert!(!is_markdown_path("note.mdx"));
        assert!(!is_markdown_path("note.txt"));
        assert!(!is_markdown_path("note"));
        assert!(!is_markdown_path("README"));
        assert!(!is_markdown_path(""));
    }

    // ── find_md_in_args: AC-003 플래그 스킵 + AC-010 first-only ────────────────
    // @MX:SPEC: SPEC-FS-004

    #[test]
    fn test_find_md_in_args_skips_flags_and_finds_md() {
        let args: Vec<String> = ["mdedit.exe", "-v", "--flag", "C:\\docs\\a.md"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        assert_eq!(find_md_in_args(&args).as_deref(), Some("C:\\docs\\a.md"));
    }

    #[test]
    fn test_find_md_in_args_returns_first_md_only() {
        let args: Vec<String> = ["a.md", "b.md", "c.md"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        assert_eq!(find_md_in_args(&args).as_deref(), Some("a.md"));
    }

    #[test]
    fn test_find_md_in_args_first_md_wins_even_with_later_flags() {
        let args: Vec<String> = ["b.md", "-v", "a.md"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        assert_eq!(find_md_in_args(&args).as_deref(), Some("b.md"));
    }

    #[test]
    fn test_find_md_in_args_none_when_no_md() {
        let args: Vec<String> = ["mdedit.exe", "-v", "x.txt", "y.markdown"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        assert_eq!(find_md_in_args(&args), None);
        assert_eq!(find_md_in_args(&[]), None);
    }

    #[test]
    fn test_find_md_in_args_does_not_skip_argv0_but_exe_path_is_not_md() {
        // argv[0](실행 파일 경로)는 스킵하지 않는 계약이지만 .md가 아니므로 자연 제외된다.
        let args: Vec<String> = ["/usr/bin/mdedit", "/docs/note.md"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        assert_eq!(find_md_in_args(&args).as_deref(), Some("/docs/note.md"));
    }

    // ── first_md_url: AC-010 다중·혼합 매트릭스 ────────────────────────────────
    // @MX:SPEC: SPEC-FS-004

    fn url_path(url: &str) -> String {
        tauri::Url::parse(url)
            .unwrap()
            .to_file_path()
            .unwrap()
            .to_string_lossy()
            .to_string()
    }

    #[test]
    fn test_first_md_url_multiple_urls_takes_first_md_only() {
        let urls: Vec<tauri::Url> = [
            "file:///a/first.md",
            "file:///a/second.md",
            "https://example.com",
        ]
        .iter()
        .map(|s| tauri::Url::parse(s).unwrap())
        .collect();
        assert_eq!(
            first_md_url(&urls).as_deref(),
            Some(url_path("file:///a/first.md").as_str())
        );
    }

    #[test]
    fn test_first_md_url_ignores_non_file_scheme_urls() {
        // https 등 비-file URL은 .md여도 무시하고 그다음 file:// .md를 찾는다(REQ-FS-004-003).
        let urls: Vec<tauri::Url> = [
            "https://example.com/x.md",
            "file:///a/first.md",
        ]
        .iter()
        .map(|s| tauri::Url::parse(s).unwrap())
        .collect();
        assert_eq!(
            first_md_url(&urls).as_deref(),
            Some(url_path("file:///a/first.md").as_str())
        );
    }

    #[test]
    fn test_first_md_url_ignores_non_md_file_url() {
        let urls: Vec<tauri::Url> = ["file:///a/readme.txt", "file:///b/note.md"]
            .iter()
            .map(|s| tauri::Url::parse(s).unwrap())
            .collect();
        assert_eq!(
            first_md_url(&urls).as_deref(),
            Some(url_path("file:///b/note.md").as_str())
        );
    }

    #[test]
    fn test_first_md_url_empty_and_all_ignored() {
        assert_eq!(first_md_url(&[]), None);
        let urls: Vec<tauri::Url> = ["https://example.com"]
            .iter()
            .map(|s| tauri::Url::parse(s).unwrap())
            .collect();
        assert_eq!(first_md_url(&urls), None);
    }

    // ── resolve_md_path: AC-012 temp-dir 실존 검증 + REQ-013 구분자 보존 ────────
    // @MX:SPEC: SPEC-FS-004

    #[test]
    fn test_resolve_md_path_existing_md_returns_path_and_parent_dir() {
        let root = temp_root();
        let file = root.join("note.md");
        std::fs::write(&file, "# t").unwrap();
        let got = resolve_md_path(&file.to_string_lossy(), None);
        assert!(got.is_some());
        let pending = got.unwrap();
        assert_eq!(pending.path, file.to_string_lossy().to_string());
        // dir은 Path::parent() 결과 그대로 — macOS /var → /private/var 심링크 정규화가
        // 일어나지 않는다면 canonicalize 미적용의 실증이 된다(REQ-FS-004-013).
        assert_eq!(pending.dir, root.to_string_lossy().to_string());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn test_resolve_md_path_nonexistent_returns_none_quietly() {
        let root = temp_root();
        let missing = root.join("missing.md");
        assert_eq!(resolve_md_path(&missing.to_string_lossy(), None), None);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn test_resolve_md_path_directory_named_md_returns_none() {
        let root = temp_root();
        let dir_named_md = root.join("folder.md");
        std::fs::create_dir_all(&dir_named_md).unwrap();
        assert_eq!(
            resolve_md_path(&dir_named_md.to_string_lossy(), None),
            None
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn test_resolve_md_path_relative_resolved_against_cwd() {
        let root = temp_root();
        std::fs::write(root.join("rel.md"), "# t").unwrap();
        let got = resolve_md_path("rel.md", Some(&root));
        assert!(got.is_some());
        let pending = got.unwrap();
        assert!(pending.path.ends_with("rel.md"));
        assert_eq!(pending.dir, root.to_string_lossy().to_string());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn test_resolve_md_path_existing_non_md_returns_none() {
        let root = temp_root();
        let txt = root.join("note.txt");
        std::fs::write(&txt, "t").unwrap();
        assert_eq!(resolve_md_path(&txt.to_string_lossy(), None), None);
        let _ = std::fs::remove_dir_all(&root);
    }

    // AC-013 Windows 전용: 반환 path/dir에 \\?\ 확장 경로 접두사 부재 어서션.
    // 본 호스트(macOS)에서는 컴파일만 확인되고 실행은 Windows CI/수동 검증으로 이월된다.
    // @MX:SPEC: SPEC-FS-004
    #[cfg(windows)]
    #[test]
    fn test_resolve_md_path_no_extended_length_prefix_windows() {
        let root = temp_root();
        let file = root.join("w.md");
        std::fs::write(&file, "# t").unwrap();
        let pending = resolve_md_path(&file.to_string_lossy(), None).unwrap();
        assert!(
            !pending.path.contains(r"\\?\"),
            r"path에 \\?\ 접두사 감지: {}",
            pending.path
        );
        assert!(
            !pending.dir.contains(r"\\?\"),
            r"dir에 \\?\ 접두사 감지: {}",
            pending.dir
        );
        let _ = std::fs::remove_dir_all(&root);
    }
}
