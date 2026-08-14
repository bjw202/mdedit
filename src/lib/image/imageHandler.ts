// @MX:ANCHOR: [AUTO] Image insertion handlers for clipboard paste, drag-and-drop, and file dialog
// @MX:REASON: Public API boundary for all image insertion operations from editor (fan_in >= 3)
// @MX:SPEC: SPEC-IMG-001, SPEC-IMG-MODE-001, SPEC-IMG-MODE-002, SPEC-IMG-MODE-003, SPEC-IMG-LOAD-002

import type { EditorView } from '@codemirror/view';
import { foldEffect } from '@codemirror/language';
import {
  saveImageFromClipboard,
  copyImageToFolder,
  readImageAsBase64,
  openImageDialog,
  readFileSize,
  saveFileAs,
} from '@/lib/tauri/ipc';
import { useUIStore } from '@/store/uiStore';
import type { ImageInsertMode } from '@/store/uiStore';
import { LINE_FOLD_THRESHOLD, IMAGE_INLINE_THRESHOLD } from '@/lib/preview/previewLimits';

/**
 * SPEC-IMG-LOAD-002 REQ-A-005: 삽입 힌트용 LINE_FOLD_THRESHOLD 를 외부 테스트가 참조 가능하도록 export.
 * insertImageMarkdown 이 이 값 초과 라인을 만들면 foldEffect 를 추가 dispatch 한다.
 */
export { LINE_FOLD_THRESHOLD };

/**
 * Inserts a markdown image link at the given position (or cursor position).
 *
 * SPEC-IMG-LOAD-002 REQ-A-005 (D6 — 2 UI gesture → 4 call site 대칭):
 *   4개 호출부(paste / drop×2 / dialog)는 모두 본 함수로 funnel 되므로, 여기서만
 *   fold 힌트를 추가하면 모든 진입점이 동일한 폴딩 정책을 받는다 (001 REQ-IMG-LOAD-A-004 대칭).
 *
 *   삽입 *직전* 에 view.state.doc.lineAt(insertPos) 로 현재 라인 경계를 읽고,
 *   (line.length + markdown.length) 로 삽입 후 라인 길이를 예측하여 LINE_FOLD_THRESHOLD 초과 시
 *   foldEffect.of({from, to}) 를 changes 와 동일 dispatch 에 effect 로 묶어 보낸다.
 *   단일 dispatch 로 visual flash 없이 첫 paint 부터 축소 상태로 렌더된다.
 *
 *   foldEffect 는 codeFolding() 의 foldState 가 처리 — D2 (foldEffect dispatch 패턴) 준수.
 *   view.state.doc 이 없거나 lineAt 미지원(mock 테스트 등)이면 fold 힌트는 조용히 건너뛴다.
 */
export function insertImageMarkdown(
  view: EditorView,
  relativePath: string,
  altText = 'image',
  pos?: number,
): void {
  const insertPos = pos ?? view.state.selection.main.head;
  const markdown = `![${altText}](${relativePath})`;

  // REQ-A-005: pre-dispatch fold prediction. 단일 dispatch 로 changes + effects 결합.
  type FoldRange = { from: number; to: number };
  let foldRange: FoldRange | null = null;
  const doc = view.state?.doc as { lineAt?: (pos: number) => { from: number; to: number; length: number } } | undefined;
  if (doc && typeof doc.lineAt === 'function') {
    const line = doc.lineAt(insertPos);
    const predictedLineLength = line.length + markdown.length;
    if (predictedLineLength > LINE_FOLD_THRESHOLD) {
      // line.from 은 불변 (삽입이 line.from 이후에 일어나므로).
      // line.to 는 markdown.length 만큼 우측 이동.
      foldRange = { from: line.from, to: line.to + markdown.length };
    }
  }

  view.dispatch({
    changes: { from: insertPos, to: insertPos, insert: markdown },
    ...(foldRange ? { effects: foldEffect.of(foldRange) } : {}),
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

/** SPEC-IMG-MODE-003: per-image 라우팅 결정 결과. */
export type ImageRoute = 'inline' | 'file';

/**
 * SPEC-IMG-MODE-003 (REQ-IMG-MODE-3-R-001/R-002): per-image 크기 기반 라우팅 chokepoint.
 *
 * 3개 진입점(붙여넣기/드롭/다이얼로그)이 모두 이 helper 를 거친다 — 단일 결정점으로 대칭 보장.
 *
 * 라우팅 규칙:
 *   - `sizeInBytes >= IMAGE_INLINE_THRESHOLD`(2MB) → 모드 무관 `'file'` (대형 이미지 안전망)
 *   - `sizeInBytes <  IMAGE_INLINE_THRESHOLD` → 사용자 모드 존중
 *       (`inline-blob` → `'inline'`, `file-save` → `'file'`)
 *
 * 근거: 거대 base64 단일 라인이 Lezer/markdown-it 양쪽을 동결시키는 원인을 삽입 시점에 차단.
 * 소형 이미지(일반 스크린샷 200KB~1MB)는 inline-blob 이식성을 유지한다.
 *
 * 동기 함수이지만 호출측의 `await` 호환을 위해 `Promise` 반환도 무방하다 (SPEC: "시그니처는 run phase 결정").
 */
export function resolveImageRoute(params: {
  mode: ImageInsertMode;
  sizeInBytes: number;
}): ImageRoute {
  if (params.sizeInBytes >= IMAGE_INLINE_THRESHOLD) return 'file';
  return params.mode === 'inline-blob' ? 'inline' : 'file';
}

/**
 * SPEC-IMG-MODE-003 (REQ-IMG-MODE-3-E-001, BD-2): >10MB 이미지 file-save 거부 시 사용자 가시 에러.
 *
 * 기존 `useUIStore.setStatusMessage` (SPEC-UI-005 트랜지언트 메시지, Footer 표시 + 2000ms 후 자동 해제) 를 재사용.
 * 신규 toast 컴포넌트 의존성 없음 — 최소 진입 장벽. silent no-op 금지, inline-blob 폴백 금지(BD-2).
 */
function notifyImageSizeError(): void {
  useUIStore.getState().setStatusMessage('이미지가 너무 큽니다(10MB 초과) — 삽입하지 않았습니다');
}

/**
 * SPEC-IMG-MODE-003 (REQ-IMG-MODE-3-U-001, NI-5): 대형 이미지 + 미저장 문서를 위한 지연 Save-As DRY helper.
 *
 * - `mdFilePath` 가 비어있지 않으면(이미 저장됨) 그대로 반환 — REQ-U-003 (무프롬프트).
 * - `mdFilePath` 가 빈 문자열(미저장)이면 `saveFileAs` 로 다이얼로그를 띄워 경로를 확보.
 *   사용자가 취소하면 `null` 반환 → 호출측은 no-op (BD-1: inline-blob 회귀 금지).
 *
 * `view` 인자는 저장할 현재 문서 내용을 얻기 위해서만 사용 (doc.toString()).
 * `mdFilePath` 가 이미 유효하면 doc 접근 자체를 생략한다 — 기존 테스트의 minimal mock 과 호환.
 */
async function ensureMdFilePathForLargeImage(
  mdFilePath: string,
  view: EditorView,
): Promise<string | null> {
  if (mdFilePath) return mdFilePath;
  const content = view.state.doc.toString();
  const savedPath = await saveFileAs(content);
  return savedPath ?? null;
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
 * 이미 확보해 둔 이미지 파일을 삽입한다.
 *
 * SPEC-IMG-MODE-003 (REQ-IMG-MODE-3-R-001): per-image 크기 기반 라우팅.
 *   - 소형 + inline-blob → data URI (MODE-002 회귀 보존, Group A 게이트 무변경)
 *   - 대형(≥2MB) + 모드 무관 → file-save (`./images/` 저장 + 상대경로)
 *   - 대형 + 미저장 → 지연 Save-As (REQ-U-001); 취소 시 no-op (BD-1)
 *   - >10MB Rust 거부 → toast (REQ-E-001); inline-blob 폴백 금지
 *
 * NI-4 (성능): base64 변환은 라우팅 결정 *이후* 에만 수행 — file-save 분기에서 미리 변환하지 않는다.
 * 단, paste 경로의 file-save 는 `saveImageFromClipboard(mdFilePath, base64)` IPC 가 base64 를 요구하므로
 * 변환을 피할 수 없다. inline 라우팅이 결정된 경우에만 data URI 변환을 수행한다.
 */
export async function insertImageFile(
  view: EditorView,
  file: File,
  mdFilePath: string,
): Promise<boolean> {
  const { imageInsertMode } = useUIStore.getState();
  // REQ-R-003a: DOM File 의 동기 size 속성으로 라우팅 결정. readFileSize IPC 사용 안 함.
  const route = resolveImageRoute({ mode: imageInsertMode, sizeInBytes: file.size });

  if (route === 'inline') {
    // 소형 + inline-blob → data URI (MODE-002 회귀 보존).
    const base64 = await fileToBase64(file);
    insertImageMarkdown(view, `data:${file.type};base64,${base64}`);
    return true;
  }

  // file-save 경로 (대형 이미지 모드 무관 OR file-save 모드).
  // REQ-U-001: 미저장 시 지연 Save-As. extractImageFile 이 동기적으로 File 을 확보했으므로 클립보드 만료 안전.
  const pathForSave = await ensureMdFilePathForLargeImage(mdFilePath, view);
  if (!pathForSave) return false; // Save-As 취소 → no-op (BD-1: inline-blob 회귀 금지)

  // file-save 라우팅에만 base64 변환. saveImageFromClipboard IPC 가 base64 를 요구.
  const base64 = await fileToBase64(file);
  try {
    const relativePath = await saveImageFromClipboard(pathForSave, base64);
    insertImageMarkdown(view, relativePath);
    return true;
  } catch {
    // REQ-E-001 (BD-2): >10MB Rust 거부 시 toast. inline-blob 폴백 금지 — 동결 재도입.
    notifyImageSizeError();
    return false;
  }
}

/**
 * Handles image files dropped onto the editor.
 *
 * SPEC-IMG-MODE-003 (REQ-IMG-MODE-3-R-001): per-image 크기 기반 라우팅.
 *   - 소형 + inline-blob → data URI (MODE-002 회귀 보존)
 *   - 대형(≥2MB) + 모드 무관 → file-save (`./images/` 복사 + 상대경로)
 *
 * 지연 Save-As 불필요 — `MarkdownEditor.tsx:280,286` 게이트가 미저장 시 항상 Save-As 를
 * 수행하므로, 이 핸들러가 호출되는 시점에는 `mdFilePath` 가 항상 유효하다 (회귀 가드 유지).
 *
 * 대형 >10MB Rust 거부 시 toast (REQ-E-001). inline-blob IPC 실패(소형 readImageAsBase64 거부 등)는
 * 기존 OD-2 동작(조용히 건너뜀)을 유지한다.
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

  const { imageInsertMode } = useUIStore.getState();

  let currentPos = dropPos;
  for (const file of imageFiles) {
    // Tauri 네이티브 드롭은 File 객체에 path 속성을 노출한다. DOM 소스 드롭은 path 가 없다.
    const filePath = (file as File & { path?: string }).path;
    // REQ-R-001 + REQ-R-002: per-image 크기 기반 라우팅 (3 진입점 대칭).
    const route = resolveImageRoute({ mode: imageInsertMode, sizeInBytes: file.size });
    let relativePath: string;

    if (route === 'inline') {
      // 소형 + inline-blob → data URI (MODE-002 보존).
      if (filePath) {
        // OD-2: 경로 검증 거부 등 IPC 실패 시 이 파일은 조용히 건너뛴다 (사용자 합의).
        try {
          relativePath = await readImageAsBase64(filePath);
        } catch {
          continue;
        }
      } else {
        const base64 = await fileToBase64(file);
        relativePath = `data:${file.type};base64,${base64}`;
      }
    } else {
      // file-save 경로 (대형 이미지 모드 무관 OR file-save 모드).
      try {
        if (filePath) {
          relativePath = await copyImageToFolder(filePath, mdFilePath);
        } else {
          const base64 = await fileToBase64(file);
          relativePath = await saveImageFromClipboard(mdFilePath, base64);
        }
      } catch {
        // REQ-E-001 (BD-2): >10MB Rust 거부 시 toast. 다음 파일은 계속 처리 (루프 회복력).
        notifyImageSizeError();
        continue;
      }
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
 * 이미지 다이얼로그를 열어 선택된 파일을 삽입한다.
 *
 * SPEC-IMG-MODE-003 (REQ-IMG-MODE-3-R-001/R-003): per-image 크기 기반 라우팅.
 *   - 다이얼로그는 네이티브 경로만 반환 → `readFileSize(selectedPath)` 로 크기 조회 (REQ-R-003b)
 *   - 소형 + inline-blob → `readImageAsBase64` data URI (MODE-002 회귀 보존)
 *   - 대형(≥2MB) + 모드 무관 → `copyImageToFolder` file-save (base64 변환 회피 — NI-4)
 *   - `readFileSize` IPC 실패 → file-save 폴백 (BD-1: inline-blob 회귀 금지)
 *   - 미저장 + 대형 → 지연 Save-As (REQ-U-001); 취소 시 no-op
 *   - >10MB Rust 거부 → toast (REQ-E-001)
 *
 * NI-4 (성능, 다이얼로그 경로에서 특히 중요): file-save 라우팅 시 `readImageAsBase64` 를
 * 건너뛰고 `copyImageToFolder(selectedPath, mdFilePath)` 로 path 기반 복사를 직접 수행한다 —
 * 5MB 이미지의 ~6.7MB base64 변환을 회피하여 메모리 펌핑 방지.
 */
export async function insertImageFromDialog(
  view: EditorView,
  mdFilePath: string,
): Promise<void> {
  const selectedPath = await openImageDialog();
  if (!selectedPath) return;

  // Extract filename without extension for alt text
  const filename = selectedPath.split(/[/\\]/).pop() ?? 'image';
  const altText = filename.replace(/\.[^.]+$/, '');

  const { imageInsertMode } = useUIStore.getState();

  // REQ-R-003b: 네이티브 경로 → readFileSize IPC 로 크기 조회.
  let sizeInBytes: number;
  try {
    sizeInBytes = await readFileSize(selectedPath);
  } catch {
    // REQ-R-003c (BD-1): 크기 조회 실패 → inline-blob 폴백 금지, file-save 폴백.
    // 크기를 알 수 없는 이미지를 inline-blob 로 임베드하면 거대 base64 단일 라인이 재도입.
    const pathForSave = await ensureMdFilePathForLargeImage(mdFilePath, view);
    if (!pathForSave) return; // Save-As 취소 → no-op (BD-1)
    try {
      const relativePath = await copyImageToFolder(selectedPath, pathForSave);
      insertImageMarkdown(view, relativePath, altText);
    } catch {
      // REQ-E-001 (BD-2): >10MB 거부 시 toast. inline-blob 폴백 금지.
      notifyImageSizeError();
    }
    return;
  }

  const route = resolveImageRoute({ mode: imageInsertMode, sizeInBytes });

  if (route === 'inline') {
    // 소형 + inline-blob → data URI (MODE-002 보존).
    // OD-2: 기존 inline-blob IPC 실패 시 조용히 no-op (다이얼로그 취소와 동일 취급).
    try {
      const dataUri = await readImageAsBase64(selectedPath);
      insertImageMarkdown(view, dataUri, altText);
    } catch {
      // 의도적 swallow — 사용자 합의 (Non-Goal #7)
    }
    return;
  }

  // file-save 경로 (대형 이미지 모드 무관 OR file-save 모드).
  // NI-4: file-save 라우팅 시 base64 변환 건너뜀 — copyImageToFolder 는 path 기반.
  const pathForSave = await ensureMdFilePathForLargeImage(mdFilePath, view);
  if (!pathForSave) return; // Save-As 취소 → no-op (BD-1)

  try {
    const relativePath = await copyImageToFolder(selectedPath, pathForSave);
    insertImageMarkdown(view, relativePath, altText);
  } catch {
    // REQ-E-001 (BD-2): >10MB Rust 거부 시 toast. inline-blob 폴백 금지 — 동결 재도입.
    notifyImageSizeError();
  }
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
