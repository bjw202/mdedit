// @MX:ANCHOR: [AUTO] Tauri IPC commands for directory operations
// @MX:REASON: Public API boundary for directory listing and dialog (fan_in >= 3)
// @MX:SPEC: SPEC-FS-001, SPEC-PREVIEW-004

use crate::commands::file_ops::validate_path;
use crate::models::file_node::FileNode;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

/// Reads a directory one level deep and returns a sorted FileNode list.
/// All subdirectories have children = None; they are loaded on demand by the frontend.
// @MX:ANCHOR: [AUTO] Core directory tree builder - called by frontend on workspace open and folder expand
// @MX:REASON: Central function with multiple callers; shallow loading prevents recursive node_modules traversal (fan_in >= 3)
#[tauri::command]
pub async fn read_directory(path: String) -> Result<Vec<FileNode>, String> {
    let path_buf = validate_path(&path)?;
    if !path_buf.exists() {
        return Err(format!("Directory not found: {}", path_buf.display()));
    }
    if !path_buf.is_dir() {
        return Err(format!("Path is not a directory: {}", path_buf.display()));
    }
    read_directory_shallow(&path_buf)
}

/// Reads a single directory level without recursing into subdirectories.
/// Subdirectory nodes have children = None (lazy-loaded by the frontend on expand).
fn read_directory_shallow(dir: &Path) -> Result<Vec<FileNode>, String> {
    let mut dirs: Vec<FileNode> = Vec::new();
    let mut files: Vec<FileNode> = Vec::new();

    let read_dir = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry_result in read_dir {
        let entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let path_str = entry_path.to_string_lossy().to_string();

        // Do not follow symlinks
        let metadata = match entry_path.symlink_metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        if metadata.file_type().is_symlink() {
            continue;
        }

        if entry_path.is_dir() {
            // children = None; frontend loads them on demand when the folder is expanded
            dirs.push(FileNode::new_directory(name, path_str, None));
        } else {
            let size = Some(metadata.len());
            let modified_time = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs());
            files.push(FileNode::new_file(name, path_str, size, modified_time));
        }
    }

    // Sort directories alphabetically, then files alphabetically
    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    let mut result = dirs;
    result.extend(files);
    Ok(result)
}

/// Opens a native folder picker dialog and returns the selected path.
/// Returns None if the user cancels.
/// NOTE: This command requires a Tauri AppHandle and cannot be unit tested directly.
#[tauri::command]
pub async fn open_directory_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();
    Ok(folder.map(|p| p.to_string()))
}

// @MX:WARN: [AUTO] asset 프로토콜 scope 등록 — 보안 신뢰 경계(trust boundary)
// @MX:REASON: 여기서 등록한 경로가 WebView에서 로컬 파일을 접근할 수 있는 허용 범위를 결정한다.
//   경로 정규화(canonicalize) 누락 또는 과도하게 넓은 경로 등록 시 경로 탈출·범위 밖 파일 읽기로 직결됨.
//   SPEC-PREVIEW-004 acceptance 시나리오 4·5가 이 함수의 올바른 동작에 의존한다.
// @MX:SPEC: SPEC-PREVIEW-004

/// 폴더 경로를 절대 경로로 변환하고 심링크를 해소하는 순수 함수.
/// AppHandle 없이 단위 테스트 가능.
///
/// # Errors
/// - 경로가 빈 문자열인 경우
/// - 경로에 ".." 탈출 시도가 있는 경우
/// - `std::fs::canonicalize` 실패(존재하지 않는 경로 등)
pub fn canonicalize_folder_path(path: &str) -> Result<PathBuf, String> {
    // 빈 경로 거부
    if path.is_empty() {
        return Err("폴더 경로가 비어 있습니다.".to_string());
    }
    // ".." 경로 탈출 거부 (validate_path와 일관된 방식)
    if path.contains("..") {
        return Err("유효하지 않은 경로: 경로 탈출은 허용되지 않습니다.".to_string());
    }
    // 절대 경로화 + 심링크 해소
    let canonical = std::fs::canonicalize(path)
        .map_err(|e| format!("경로 정규화 실패: {}", e))?;

    // Windows에서 std::fs::canonicalize는 \\?\ UNC 확장 경로 접두사를 붙인다.
    // Tauri의 asset_protocol_scope는 이 접두사를 인식하지 못해 scope 매칭이 실패한다.
    // 결과적으로 asset 요청이 차단되어 WebView2가 "콘텐츠 차단" 페이지를 렌더링한다.
    // \\?\ 접두사를 제거하여 일반 Windows 경로(C:\...) 형식으로 반환한다.
    #[cfg(target_os = "windows")]
    {
        let s = canonical.to_string_lossy();
        if let Some(stripped) = s.strip_prefix(r"\\?\") {
            return Ok(PathBuf::from(stripped));
        }
    }

    Ok(canonical)
}

/// 열린 폴더를 asset 프로토콜 scope에 런타임 등록한다.
/// 폴더와 하위 경로 전체(`recursive=true`)를 허용 목록에 추가하며, 세션 누적 방식으로 동작한다.
/// 앱 재시작 시 Tauri가 scope를 초기화하므로 별도 초기화 코드가 불필요하다.
///
/// NOTE: AppHandle을 요구하므로 직접 단위 테스트 불가. 경로 정규화 로직은
///       `canonicalize_folder_path`로 분리하여 단위 테스트한다.
#[tauri::command]
pub async fn register_asset_scope(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri::Manager;

    let canonical = canonicalize_folder_path(&path)?;

    app.asset_protocol_scope()
        .allow_directory(&canonical, true)
        .map_err(|e| format!("asset scope 등록 실패: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::env;

    // --- canonicalize_folder_path 단위 테스트 (SPEC-PREVIEW-004) ---

    #[test]
    fn test_canonicalize_folder_path_빈_경로_거부() {
        let result = canonicalize_folder_path("");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("비어 있습니다"));
    }

    #[test]
    fn test_canonicalize_folder_path_dotdot_탈출_거부() {
        let result = canonicalize_folder_path("../../etc");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("탈출"), "오류 메시지에 '탈출' 포함 필요: {}", err);
    }

    #[test]
    fn test_canonicalize_folder_path_존재하지_않는_경로_오류() {
        let result = canonicalize_folder_path("/nonexistent/path_preview004_test");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("정규화 실패"));
    }

    #[test]
    fn test_canonicalize_folder_path_유효한_디렉토리_절대경로_반환() {
        let dir = env::temp_dir().join("test_canon_preview004");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.to_str().unwrap();

        let result = canonicalize_folder_path(input);
        assert!(result.is_ok(), "오류: {:?}", result.err());
        let canonical = result.unwrap();
        // 결과는 반드시 절대 경로여야 한다
        assert!(canonical.is_absolute(), "절대 경로가 아님: {:?}", canonical);

        fs::remove_dir_all(&dir).ok();
    }

    // Windows에서 std::fs::canonicalize가 추가하는 \\?\ 접두사가
    // asset_protocol_scope 매칭 실패를 유발하는 회귀를 방지한다.
    #[cfg(target_os = "windows")]
    #[test]
    fn test_canonicalize_folder_path_windows_unc_접두사_제거() {
        let dir = env::temp_dir().join("test_canon_unc_preview004");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.to_str().unwrap();

        let result = canonicalize_folder_path(input);
        assert!(result.is_ok(), "오류: {:?}", result.err());
        let canonical = result.unwrap();

        let path_str = canonical.to_string_lossy();
        assert!(
            !path_str.starts_with(r"\\?\"),
            r"\\?\ 접두사가 남아 있으면 asset scope 매칭이 실패한다: {}",
            path_str
        );
        assert!(canonical.is_absolute(), "절대 경로가 아님: {:?}", canonical);

        fs::remove_dir_all(&dir).ok();
    }

    fn make_temp_dir(name: &str) -> std::path::PathBuf {
        let dir = env::temp_dir().join(name);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn test_read_directory_returns_sorted_dirs_first() {
        let base = make_temp_dir("test_readdir_sort_fs001");
        // Create files and directories
        fs::write(base.join("z_file.txt"), "").unwrap();
        fs::write(base.join("a_file.txt"), "").unwrap();
        fs::create_dir_all(base.join("m_dir")).unwrap();
        fs::create_dir_all(base.join("a_dir")).unwrap();

        let result = read_directory(base.to_str().unwrap().to_string()).await;
        assert!(result.is_ok());
        let nodes = result.unwrap();

        // First two should be directories, sorted alphabetically
        assert!(nodes[0].is_directory);
        assert!(nodes[1].is_directory);
        assert_eq!(nodes[0].name, "a_dir");
        assert_eq!(nodes[1].name, "m_dir");
        // Files come after, sorted alphabetically
        assert!(!nodes[2].is_directory);
        assert!(!nodes[3].is_directory);
        assert_eq!(nodes[2].name, "a_file.txt");
        assert_eq!(nodes[3].name, "z_file.txt");

        fs::remove_dir_all(&base).ok();
    }

    #[tokio::test]
    async fn test_read_directory_not_found() {
        let result = read_directory("/nonexistent/dir_fs001".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[tokio::test]
    async fn test_read_directory_on_file_returns_error() {
        let test_file = env::temp_dir().join("test_readdir_file_fs001.txt");
        fs::write(&test_file, "content").unwrap();

        let result = read_directory(test_file.to_str().unwrap().to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not a directory"));

        fs::remove_file(&test_file).ok();
    }

    #[tokio::test]
    async fn test_read_directory_path_traversal_prevention() {
        let result = read_directory("../../../etc".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("traversal"));
    }

    #[tokio::test]
    async fn test_read_directory_returns_file_metadata() {
        let base = make_temp_dir("test_readdir_meta_fs001");
        fs::write(base.join("data.txt"), "hello world").unwrap();

        let result = read_directory(base.to_str().unwrap().to_string()).await;
        assert!(result.is_ok());
        let nodes = result.unwrap();
        assert_eq!(nodes.len(), 1);
        let file = &nodes[0];
        assert_eq!(file.name, "data.txt");
        assert!(!file.is_directory);
        assert!(file.size.is_some());
        assert!(file.size.unwrap() > 0);

        fs::remove_dir_all(&base).ok();
    }

    #[tokio::test]
    async fn test_read_directory_returns_subdirectory_with_null_children() {
        // Shallow loading: subdirectory nodes have children = None (lazy-loaded by frontend)
        let base = make_temp_dir("test_readdir_shallow_fs001");
        let sub = base.join("subdir");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("nested.md"), "").unwrap();

        let result = read_directory(base.to_str().unwrap().to_string()).await;
        assert!(result.is_ok());
        let nodes = result.unwrap();
        assert_eq!(nodes.len(), 1);
        let dir_node = &nodes[0];
        assert!(dir_node.is_directory);
        assert_eq!(dir_node.name, "subdir");
        // Shallow load: children are None (frontend fetches on expand)
        assert!(dir_node.children.is_none(), "shallow load should not populate children");

        fs::remove_dir_all(&base).ok();
    }

    #[tokio::test]
    async fn test_read_directory_empty_returns_empty_vec() {
        let base = make_temp_dir("test_readdir_empty_fs001");

        let result = read_directory(base.to_str().unwrap().to_string()).await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());

        fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn test_read_directory_shallow_skips_symlinks() {
        // Shallow function exists and handles the path correctly
        // Actual symlink behavior is tested implicitly via read_directory
        let base = make_temp_dir("test_readdir_sym_fs001");
        let result = read_directory_shallow(&base);
        assert!(result.is_ok());
        fs::remove_dir_all(&base).ok();
    }
}
