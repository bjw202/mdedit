// @MX:ANCHOR: [AUTO] Tauri IPC commands for image operations
// @MX:REASON: Public API boundary for all image operations from frontend (fan_in >= 3)
// @MX:SPEC: SPEC-IMG-001

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose::STANDARD, Engine as _};

use super::file_ops::validate_path;

const MAX_IMAGE_SIZE: u64 = 10 * 1024 * 1024; // 10MB

/// Returns the images/ subdirectory relative to the given markdown file.
fn images_dir(md_file_path: &str) -> Result<PathBuf, String> {
    let md_path = validate_path(md_file_path)?;
    let parent = md_path
        .parent()
        .ok_or_else(|| "Cannot determine parent directory of markdown file".to_string())?;
    Ok(parent.join("images"))
}

/// Generates a timestamp-based filename with the given extension.
fn timestamp_filename(ext: &str) -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{}.{}", ts, ext)
}

/// Ensures the images/ directory exists, creating it if needed.
fn ensure_images_dir(md_file_path: &str) -> Result<PathBuf, String> {
    let dir = images_dir(md_file_path)?;
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create images directory: {}", e))?;
    }
    Ok(dir)
}

/// Saves base64-encoded image data to the images/ subdirectory.
/// Returns the relative path for use in markdown links (e.g., `./images/1234567890.png`).
#[tauri::command]
pub async fn save_image_from_clipboard(
    md_file_path: String,
    image_data_base64: String,
) -> Result<String, String> {
    validate_path(&md_file_path)?;
    let dir = ensure_images_dir(&md_file_path)?;

    let decoded = STANDARD
        .decode(&image_data_base64)
        .map_err(|e| format!("Failed to decode base64 image data: {}", e))?;

    if decoded.len() as u64 > MAX_IMAGE_SIZE {
        return Err(format!(
            "Image too large: {} bytes (max {} bytes)",
            decoded.len(),
            MAX_IMAGE_SIZE
        ));
    }

    let filename = timestamp_filename("png");
    let dest = dir.join(&filename);

    std::fs::write(&dest, &decoded)
        .map_err(|e| format!("Failed to save image: {}", e))?;

    Ok(format!("./images/{}", filename))
}

/// Copies an image file to the images/ subdirectory.
/// Returns the relative path. Adds numeric suffix if filename already exists.
#[tauri::command]
pub async fn copy_image_to_folder(
    source_path: String,
    md_file_path: String,
) -> Result<String, String> {
    let src = validate_path(&source_path)?;
    validate_path(&md_file_path)?;

    if !src.exists() {
        return Err(format!("Source image not found: {}", src.display()));
    }

    let metadata = std::fs::metadata(&src)
        .map_err(|e| format!("Failed to read source file metadata: {}", e))?;
    if metadata.len() > MAX_IMAGE_SIZE {
        return Err(format!(
            "Image too large: {} bytes (max {} bytes)",
            metadata.len(),
            MAX_IMAGE_SIZE
        ));
    }

    let dir = ensure_images_dir(&md_file_path)?;

    let original_name = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image")
        .to_string();
    let ext = src
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png")
        .to_string();

    let mut filename = format!("{}.{}", original_name, ext);
    let mut dest = dir.join(&filename);
    let mut counter = 1u32;

    while dest.exists() {
        filename = format!("{}_{}.{}", original_name, counter, ext);
        dest = dir.join(&filename);
        counter += 1;
    }

    std::fs::copy(&src, &dest)
        .map_err(|e| format!("Failed to copy image: {}", e))?;

    Ok(format!("./images/{}", filename))
}

/// Reads an image file and returns its content as a base64-encoded data URI string.
/// Format: `data:{mime};base64,{data}`
#[tauri::command]
pub async fn read_image_as_base64(image_path: String) -> Result<String, String> {
    let path = validate_path(&image_path)?;

    if !path.exists() {
        return Err(format!("Image file not found: {}", path.display()));
    }

    let data = std::fs::read(&path)
        .map_err(|e| format!("Failed to read image file: {}", e))?;

    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    };

    let encoded = STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, encoded))
}

/// Opens a native file dialog filtered for image files.
/// Returns the selected file path, or None if the user cancels.
#[tauri::command]
pub async fn open_image_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"])
        .blocking_pick_file();

    match path {
        Some(file_path) => Ok(Some(file_path.to_string())),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    fn temp_path(name: &str) -> PathBuf {
        env::temp_dir().join(name)
    }

    // --- images_dir tests ---

    #[test]
    fn test_images_dir_returns_sibling_images_folder() {
        let result = images_dir("/tmp/test_img001/doc.md");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), PathBuf::from("/tmp/test_img001/images"));
    }

    #[test]
    fn test_images_dir_rejects_traversal() {
        let result = images_dir("../../etc/doc.md");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("traversal"));
    }

    // --- timestamp_filename tests ---

    #[test]
    fn test_timestamp_filename_has_correct_extension() {
        let name = timestamp_filename("png");
        assert!(name.ends_with(".png"));
        assert!(name.len() > 4); // timestamp + .png
    }

    // --- save_image_from_clipboard tests ---

    #[tokio::test]
    async fn test_save_image_from_clipboard_success() {
        let test_dir = temp_path("test_save_img_clipboard_img001");
        let md_file = test_dir.join("doc.md");
        fs::create_dir_all(&test_dir).unwrap();
        fs::write(&md_file, "# Test").unwrap();

        // 1x1 PNG in base64
        let png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        let result = save_image_from_clipboard(
            md_file.to_str().unwrap().to_string(),
            png_b64.to_string(),
        )
        .await;

        assert!(result.is_ok());
        let rel_path = result.unwrap();
        assert!(rel_path.starts_with("./images/"));
        assert!(rel_path.ends_with(".png"));

        // Verify the file actually exists
        let abs_path = test_dir.join(rel_path.trim_start_matches("./"));
        assert!(abs_path.exists());

        fs::remove_dir_all(&test_dir).ok();
    }

    #[tokio::test]
    async fn test_save_image_from_clipboard_invalid_base64() {
        let test_dir = temp_path("test_save_img_invalid_img001");
        let md_file = test_dir.join("doc.md");
        fs::create_dir_all(&test_dir).unwrap();
        fs::write(&md_file, "# Test").unwrap();

        let result = save_image_from_clipboard(
            md_file.to_str().unwrap().to_string(),
            "not-valid-base64!!!".to_string(),
        )
        .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("decode"));

        fs::remove_dir_all(&test_dir).ok();
    }

    #[tokio::test]
    async fn test_save_image_path_traversal_prevention() {
        let result = save_image_from_clipboard(
            "../../../etc/doc.md".to_string(),
            "dGVzdA==".to_string(),
        )
        .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("traversal"));
    }

    // --- copy_image_to_folder tests ---

    #[tokio::test]
    async fn test_copy_image_to_folder_success() {
        let test_dir = temp_path("test_copy_img_img001");
        let src_file = test_dir.join("source.png");
        let md_file = test_dir.join("doc.md");
        fs::create_dir_all(&test_dir).unwrap();
        fs::write(&src_file, &[0x89, 0x50, 0x4E, 0x47]).unwrap(); // PNG header
        fs::write(&md_file, "# Test").unwrap();

        let result = copy_image_to_folder(
            src_file.to_str().unwrap().to_string(),
            md_file.to_str().unwrap().to_string(),
        )
        .await;

        assert!(result.is_ok());
        let rel_path = result.unwrap();
        assert_eq!(rel_path, "./images/source.png");

        let abs_path = test_dir.join("images/source.png");
        assert!(abs_path.exists());

        fs::remove_dir_all(&test_dir).ok();
    }

    #[tokio::test]
    async fn test_copy_image_to_folder_duplicate_suffix() {
        let test_dir = temp_path("test_copy_img_dup_img001");
        let src_file = test_dir.join("photo.png");
        let md_file = test_dir.join("doc.md");
        let images_dir = test_dir.join("images");
        fs::create_dir_all(&images_dir).unwrap();
        fs::write(&src_file, &[0x89, 0x50, 0x4E, 0x47]).unwrap();
        fs::write(&md_file, "# Test").unwrap();
        fs::write(images_dir.join("photo.png"), &[0x89]).unwrap(); // Existing file

        let result = copy_image_to_folder(
            src_file.to_str().unwrap().to_string(),
            md_file.to_str().unwrap().to_string(),
        )
        .await;

        assert!(result.is_ok());
        let rel_path = result.unwrap();
        assert_eq!(rel_path, "./images/photo_1.png");

        fs::remove_dir_all(&test_dir).ok();
    }

    #[tokio::test]
    async fn test_copy_image_source_not_found() {
        let test_dir = temp_path("test_copy_img_notfound_img001");
        let md_file = test_dir.join("doc.md");
        fs::create_dir_all(&test_dir).unwrap();
        fs::write(&md_file, "# Test").unwrap();

        let result = copy_image_to_folder(
            "/nonexistent/image.png".to_string(),
            md_file.to_str().unwrap().to_string(),
        )
        .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));

        fs::remove_dir_all(&test_dir).ok();
    }

    #[tokio::test]
    async fn test_copy_image_path_traversal_prevention() {
        let result = copy_image_to_folder(
            "/tmp/image.png".to_string(),
            "../../../etc/doc.md".to_string(),
        )
        .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("traversal"));
    }

    // --- read_image_as_base64 tests ---

    #[tokio::test]
    async fn test_read_image_as_base64_png() {
        let test_file = temp_path("test_read_img_b64_img001.png");
        let data = vec![0x89, 0x50, 0x4E, 0x47];
        fs::write(&test_file, &data).unwrap();

        let result = read_image_as_base64(test_file.to_str().unwrap().to_string()).await;
        assert!(result.is_ok());
        let data_uri = result.unwrap();
        assert!(data_uri.starts_with("data:image/png;base64,"));

        fs::remove_file(&test_file).ok();
    }

    #[tokio::test]
    async fn test_read_image_as_base64_jpg() {
        let test_file = temp_path("test_read_img_b64_img001.jpg");
        fs::write(&test_file, &[0xFF, 0xD8, 0xFF]).unwrap();

        let result = read_image_as_base64(test_file.to_str().unwrap().to_string()).await;
        assert!(result.is_ok());
        assert!(result.unwrap().starts_with("data:image/jpeg;base64,"));

        fs::remove_file(&test_file).ok();
    }

    #[tokio::test]
    async fn test_read_image_not_found() {
        let result = read_image_as_base64("/nonexistent/image_img001.png".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[tokio::test]
    async fn test_read_image_path_traversal_prevention() {
        let result = read_image_as_base64("../../../etc/passwd".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("traversal"));
    }
}
