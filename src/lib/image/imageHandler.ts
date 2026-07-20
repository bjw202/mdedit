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
import type { ImageInsertMode } from '@/store/uiStore';

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

/** 붙여넣기를 이미지로 처리할지에 대한 판정 결과. */
export type ImageInsertDecision =
  /** 이미지가 아니다 — CodeMirror 기본 붙여넣기에 맡긴다. */
  | 'ignore'
  /** 이미지로 삽입한다. */
  | 'insert'
  /** 이미지지만 기준 파일 경로가 없다 — 먼저 저장이 필요하다. */
  | 'require-file-path';

// @MX:ANCHOR: 붙여넣기 가로채기 판정 — 오판하면 일반 텍스트 붙여넣기가 막힌다.
// @MX:REASON: paste 핸들러의 단일 분기점이며 회귀 시 사용자가 붙여넣기를 전혀 못 쓴다.
/**
 * 클립보드 붙여넣기를 이미지로 처리할지 결정한다.
 *
 * 두 가지 함정을 피한다.
 *
 * 1. Windows 클립보드는 브라우저·Word·Excel·탐색기에서 **텍스트**를 복사해도
 *    `text/plain` 과 함께 `image/png` flavor 를 같이 싣는 경우가 흔하다.
 *    이미지 flavor 만 보고 판단하면 평범한 텍스트 붙여넣기가 가로채인다.
 *    따라서 쓸 만한 텍스트가 있으면 텍스트를 우선한다.
 *
 * 2. `inline-blob` 모드(기본값)는 이미지를 data URI 로 문서에 직접 박아 넣으므로
 *    기준 파일 경로가 필요 없다. 이 모드에서까지 저장을 요구하면 새 문서에
 *    이미지를 붙여넣을 때 불필요하게 저장 대화상자가 뜬다.
 *    경로가 실제로 필요한 것은 `file-save` 모드뿐이다.
 */
export function decideImageInsert(params: {
  hasImage: boolean;
  hasPlainText: boolean;
  mode: ImageInsertMode;
  hasFilePath: boolean;
}): ImageInsertDecision {
  const { hasImage, hasPlainText, mode, hasFilePath } = params;

  if (!hasImage) return 'ignore';
  if (hasPlainText) return 'ignore';
  if (mode === 'inline-blob') return 'insert';
  return hasFilePath ? 'insert' : 'require-file-path';
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
  const file = extractImageFile(event);
  if (!file) return false;

  event.preventDefault();
  return insertImageFile(view, file, mdFilePath);
}

// @MX:ANCHOR: 클립보드 이미지는 반드시 이벤트 디스패치 중에 꺼내야 한다.
// @MX:REASON: 이벤트가 끝나면 clipboardData 가 무효화되어 getAsFile() 이 null 을 돌려준다.
/**
 * 클립보드 이벤트에서 첫 번째 이미지 파일을 **동기적으로** 꺼낸다.
 *
 * 브라우저는 paste 이벤트 디스패치가 끝나면 `clipboardData` 를 무효화한다.
 * 저장 대화상자처럼 사용자를 기다리는 비동기 작업이 끼어드는 경로에서는,
 * 기다리기 **전에** 이 함수로 파일을 먼저 확보해 두어야 이미지를 잃지 않는다.
 * File 객체는 이벤트와 수명이 분리되어 있어 이후에도 안전하게 쓸 수 있다.
 */
export function extractImageFile(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }

  return null;
}

/**
 * 이미 확보해 둔 이미지 파일을 현재 모드에 맞게 문서에 삽입한다.
 *
 * `mdFilePath` 는 `file-save` 모드에서만 쓰인다.
 */
export async function insertImageFile(
  view: EditorView,
  file: File,
  mdFilePath: string,
): Promise<boolean> {
  const { imageInsertMode } = useUIStore.getState();
  const base64 = await fileToBase64(file);

  if (imageInsertMode === 'inline-blob') {
    // REQ-2: Embed image as data URI directly in markdown, no Tauri IPC call
    insertImageMarkdown(view, `data:${file.type};base64,${base64}`);
  } else {
    // REQ-3: Save to ./images/ folder via Tauri IPC (existing behavior)
    const relativePath = await saveImageFromClipboard(mdFilePath, base64);
    insertImageMarkdown(view, relativePath);
  }

  return true;
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
