// @MX:ANCHOR: [AUTO] Image insertion handlers for clipboard paste, drag-and-drop, and file dialog
// @MX:REASON: Public API boundary for all image insertion operations from editor (fan_in >= 3)
// @MX:SPEC: SPEC-IMG-001, SPEC-IMG-MODE-001

import type { EditorView } from '@codemirror/view';
import {
  saveImageFromClipboard,
  copyImageToFolder,
  openImageDialog,
} from '@/lib/tauri/ipc';
import { useUIStore } from '@/store/uiStore';

/**
 * Inserts a markdown image link at the given position (or cursor position).
 */
export function insertImageMarkdown(
  view: EditorView,
  relativePath: string,
  altText = 'image',
  pos?: number,
): void {
  const insertPos = pos ?? view.state.selection.main.head;
  const markdown = `![${altText}](${relativePath})`;
  view.dispatch({
    changes: { from: insertPos, to: insertPos, insert: markdown },
  });
}

/**
 * Handles image paste from clipboard.
 * Detects image items in clipboardData, extracts base64, saves via IPC,
 * and inserts a markdown image link.
 *
 * @returns true if an image was handled, false otherwise
 */
export async function handleImagePaste(
  view: EditorView,
  event: ClipboardEvent,
  mdFilePath: string,
): Promise<boolean> {
  const items = event.clipboardData?.items;
  if (!items) return false;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault();

      const file = item.getAsFile();
      if (!file) continue;

      const { imageInsertMode } = useUIStore.getState();
      const base64 = await fileToBase64(file);

      if (imageInsertMode === 'inline-blob') {
        // REQ-2: Embed image as data URI directly in markdown, no Tauri IPC call
        const dataUri = `data:${file.type};base64,${base64}`;
        insertImageMarkdown(view, dataUri);
      } else {
        // REQ-3: Save to ./images/ folder via Tauri IPC (existing behavior)
        const relativePath = await saveImageFromClipboard(mdFilePath, base64);
        insertImageMarkdown(view, relativePath);
      }

      return true;
    }
  }

  return false;
}

/**
 * Handles image files dropped onto the editor.
 * Copies each image file to the images/ folder and inserts markdown links.
 *
 * @returns true if images were handled, false otherwise
 */
export async function handleImageDrop(
  view: EditorView,
  event: DragEvent,
  mdFilePath: string,
): Promise<boolean> {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return false;

  const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (imageFiles.length === 0) return false;

  event.preventDefault();

  // Get drop position
  const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;

  let currentPos = dropPos;
  for (const file of imageFiles) {
    // For drag-and-drop from native file manager, use the file path via copy
    // For drag-and-drop from other sources, the path might not be available
    // In Tauri, dropped files have a path property
    const filePath = (file as File & { path?: string }).path;
    let relativePath: string;

    if (filePath) {
      relativePath = await copyImageToFolder(filePath, mdFilePath);
    } else {
      // Fallback: read as base64 and save
      const base64 = await fileToBase64(file);
      relativePath = await saveImageFromClipboard(mdFilePath, base64);
    }

    const altText = file.name.replace(/\.[^.]+$/, '') || 'image';
    const markdown = `![${altText}](${relativePath})\n`;
    view.dispatch({
      changes: { from: currentPos, to: currentPos, insert: markdown },
    });
    currentPos += markdown.length;
  }

  return true;
}

/**
 * Opens a file dialog, copies the selected image to images/ folder,
 * and inserts a markdown image link at the cursor position.
 */
export async function insertImageFromDialog(
  view: EditorView,
  mdFilePath: string,
): Promise<void> {
  const selectedPath = await openImageDialog();
  if (!selectedPath) return;

  const relativePath = await copyImageToFolder(selectedPath, mdFilePath);

  // Extract filename without extension for alt text
  const filename = selectedPath.split(/[/\\]/).pop() ?? 'image';
  const altText = filename.replace(/\.[^.]+$/, '');

  insertImageMarkdown(view, relativePath, altText);
}

/**
 * Converts a File object to a base64 string (without the data URI prefix).
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/...;base64, prefix
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
