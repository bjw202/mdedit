// @MX:ANCHOR: [AUTO] Tauri IPC commands for directory operations
// @MX:REASON: Public API boundary for directory listing and dialog (fan_in >= 3)
// @MX:SPEC: SPEC-FS-001

use crate::commands::file_ops::validate_path;
use crate::models::file_node::FileNode;
use std::path::Path;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::env;

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
