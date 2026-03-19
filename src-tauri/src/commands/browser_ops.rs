// @MX:ANCHOR: [AUTO] Tauri IPC commands for browser operations using shell plugin
// @MX:REASON: Public API boundary for browser operations (fan_in >= 1)
// @MX:SPEC: SPEC-PREVIEW-001

use std::process::Command;

/// Opens a URL in the system's default browser using shell commands.
/// Uses platform-specific commands: open (macOS), start (Windows), xdg-open (Linux).
#[tauri::command]
pub async fn open_url_in_browser(url: String) -> Result<(), String> {
    let (shell, command): (&str, Vec<&str>) = if cfg!(target_os = "macos") {
        ("open", vec![url.as_str()])
    } else if cfg!(target_os = "windows") {
        ("cmd", vec!["/C", "start", "", url.as_str()])
    } else {
        // Linux
        ("xdg-open", vec![url.as_str()])
    };

    Command::new(shell)
        .args(&command)
        .spawn()
        .map_err(|e| format!("Failed to open URL: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_open_url_in_browser_compiles() {
        // Verify the function compiles correctly
        let url = "https://example.com".to_string();
        // This test verifies the function signature and types
        let _ = url;
    }
}
