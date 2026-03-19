// @MX:ANCHOR: [AUTO] Type-safe IPC wrappers for Tauri filesystem commands
// @MX:REASON: Central IPC layer used by all frontend components accessing filesystem (fan_in >= 3)
// @MX:SPEC: SPEC-FS-001

import { invoke } from '@tauri-apps/api/core';
import type { FileNode } from '@/types/file';

/**
 * Reads a file and returns its content as a UTF-8 string.
 * Throws if the file does not exist or is not valid UTF-8.
 */
export async function readFile(path: string): Promise<string> {
  return invoke<string>('read_file', { path });
}

/**
 * Writes UTF-8 content to a file, creating parent directories as needed.
 * Overwrites existing file content.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  return invoke<void>('write_file', { path, content });
}

/**
 * Creates an empty file at the given path.
 * Throws if the file already exists.
 */
export async function createFile(path: string): Promise<void> {
  return invoke<void>('create_file', { path });
}

/**
 * Deletes a single file.
 * Throws if the file does not exist or if the path points to a directory.
 */
export async function deleteFile(path: string): Promise<void> {
  return invoke<void>('delete_file', { path });
}

/**
 * Renames or moves a file from oldPath to newPath.
 * Throws if the source does not exist or if the destination already exists.
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  return invoke<void>('rename_file', { oldPath, newPath });
}

/**
 * Reads a directory recursively and returns a sorted FileNode tree.
 * Directories appear before files; both groups are sorted alphabetically.
 */
export async function readDirectory(path: string): Promise<FileNode[]> {
  return invoke<FileNode[]>('read_directory', { path });
}

/**
 * Opens a native folder picker dialog.
 * Returns the selected folder path, or null if the user cancels.
 */
export async function openDirectoryDialog(): Promise<string | null> {
  return invoke<string | null>('open_directory_dialog');
}

/**
 * Starts watching the given directory path for filesystem changes.
 * Emits `file-changed` Tauri events to the frontend when files change.
 * Stops any previously active watcher before starting.
 */
export async function startWatch(path: string): Promise<void> {
  return invoke<void>('start_watch', { path });
}

/**
 * Stops the active filesystem watcher.
 * No-op if no watcher is currently active.
 */
export async function stopWatch(): Promise<void> {
  return invoke<void>('stop_watch');
}

/**
 * Opens a native Save As dialog, writes the content to the selected file,
 * and returns the saved file path. Returns null if the user cancels.
 * `defaultPath` sets the initial directory shown in the dialog.
 */
export async function saveFileAs(content: string, defaultPath?: string): Promise<string | null> {
  return invoke<string | null>('save_file_as', { content, defaultPath: defaultPath ?? null });
}

// @MX:NOTE: [AUTO] Export IPC wrappers for SPEC-EXPORT-001 - format-specific save dialogs
// @MX:SPEC: SPEC-EXPORT-001

/**
 * Opens a native Save As dialog with a format-specific file filter.
 * Returns the selected file path, or null if the user cancels.
 *
 * @param format - Export format: 'html', 'pdf', or 'docx'
 * @param defaultName - Default filename to suggest in the dialog
 */
export async function exportSaveDialog(format: string, defaultName: string): Promise<string | null> {
  return invoke<string | null>('export_save_dialog', { format, defaultName });
}

/**
 * Writes binary data to a file at the given path.
 * Used for DOCX export where the content is a binary blob.
 *
 * @param path - Absolute path where the file should be saved
 * @param data - Binary data as an array of bytes
 */
export async function writeBinaryFile(path: string, data: number[]): Promise<void> {
  return invoke<void>('write_binary_file', { path, data });
}

/**
 * Triggers the native print dialog on the current webview window.
 * Used by PDF export since JavaScript window.print() does not work in Tauri's WKWebView.
 */
export async function printCurrentWindow(): Promise<void> {
  return invoke<void>('print_current_window');
}

// @MX:NOTE: [AUTO] Image IPC wrappers for SPEC-IMG-001 - clipboard save, file copy, base64 read, dialog
// @MX:SPEC: SPEC-IMG-001

/**
 * Saves base64-encoded image data to the images/ subdirectory next to the markdown file.
 * Returns the relative path for use in markdown links (e.g., `./images/1234567890.png`).
 */
export async function saveImageFromClipboard(mdFilePath: string, imageDataBase64: string): Promise<string> {
  return invoke<string>('save_image_from_clipboard', { mdFilePath, imageDataBase64 });
}

/**
 * Copies an image file to the images/ subdirectory next to the markdown file.
 * Returns the relative path. Adds numeric suffix if filename already exists.
 */
export async function copyImageToFolder(sourcePath: string, mdFilePath: string): Promise<string> {
  return invoke<string>('copy_image_to_folder', { sourcePath, mdFilePath });
}

/**
 * Reads an image file and returns its content as a base64 data URI string.
 * Format: `data:{mime};base64,{data}`
 */
export async function readImageAsBase64(imagePath: string): Promise<string> {
  return invoke<string>('read_image_as_base64', { imagePath });
}

/**
 * Opens a native file dialog filtered for image files.
 * Returns the selected file path, or null if the user cancels.
 */
export async function openImageDialog(): Promise<string | null> {
  return invoke<string | null>('open_image_dialog');
}

// @MX:NOTE: [AUTO] Browser IPC wrappers for system browser operations
// @MX:SPEC: SPEC-PREVIEW-001

/**
 * Opens a URL in the system's default browser using shell commands.
 * Uses platform-specific commands: open (macOS), start (Windows), xdg-open (Linux).
 *
 * @param url - The URL to open
 */
export async function openUrlInBrowser(url: string): Promise<void> {
  return invoke<void>('open_url_in_browser', { url });
}
