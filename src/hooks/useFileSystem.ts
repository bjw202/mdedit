// @MX:ANCHOR: [AUTO] File system operations hook - wraps Tauri IPC for all file/folder actions
// @MX:REASON: [AUTO] Public API boundary - used by FileExplorer, FileTreeNode, FileTree (fan_in >= 3)
// @MX:SPEC: SPEC-UI-002

import {
  openDirectoryDialog,
  readDirectory,
  readFile,
  createFile as ipcCreateFile,
  deleteFile as ipcDeleteFile,
  renameFile as ipcRenameFile,
  startWatch,
  registerAssetScope,
} from '@/lib/tauri/ipc';
import { saveDocument } from '@/lib/save/saveDocument';
import { useFileStore } from '@/store/fileStore';
import { useEditorStore } from '@/store/editorStore';
import { useUIStore } from '@/store/uiStore';
import { FILE_SIZE_THRESHOLD } from '@/lib/preview/previewLimits';
import { isRasterImagePath, isSvgPath } from '@/lib/preview/mediaExtensions';
import { findFileNodeSize } from '@/lib/preview/fileTreeUtils';

interface FileSystemHook {
  openFolder: () => Promise<void>;
  openFolderPath: (path: string) => Promise<void>;
  changeFolder: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  saveFileAs: () => Promise<string | null>;
  createFile: (dirPath: string, name: string) => Promise<void>;
  deleteNode: (path: string) => Promise<void>;
  renameNode: (path: string, newName: string) => Promise<void>;
}

/**
 * Refreshes the file tree from the watched root path.
 * No-op if no path is currently being watched.
 */
async function refreshTree(): Promise<void> {
  const { watchedPath, setFileTree, setLoading } = useFileStore.getState();
  if (!watchedPath) return;
  setLoading(true);
  try {
    const tree = await readDirectory(watchedPath);
    setFileTree(tree);
  } finally {
    setLoading(false);
  }
}

/**
 * Derives the parent directory path from a full file path.
 * Handles both Unix ('/') and Windows ('\') path separators.
 */
function getParentPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  parts.pop();
  return parts.join('/') || '/';
}

// @MX:NOTE: Hook provides unified interface for all filesystem operations.
// Calls are delegated to Tauri IPC and state is synchronized via fileStore.
export function useFileSystem(): FileSystemHook {
  const { setFileTree, setWatchedPath, setCurrentFile, setLoading } =
    useFileStore.getState();
  const { setContent, setCurrentFilePath } = useEditorStore.getState();

  const openFolder = async (): Promise<void> => {
    const selectedPath = await openDirectoryDialog();
    if (selectedPath === null) return;

    setLoading(true);
    try {
      const tree = await readDirectory(selectedPath);
      setWatchedPath(selectedPath);
      setFileTree(tree);
      useUIStore.getState().setLastWatchedPath(selectedPath);
      // asset 프로토콜 scope 런타임 등록 — HTML 파일 보기를 위해 해당 폴더를 WebView 허용 목록에 추가
      // 실패 시 앱 탐색은 계속되나 HTML 보기 기능이 동작하지 않을 수 있음
      registerAssetScope(selectedPath).catch((err: unknown) => {
        console.error('[useFileSystem] registerAssetScope failed:', err);
      });
      // startWatch is non-blocking: watcher failure must not prevent navigation
      startWatch(selectedPath).catch((err: unknown) => {
        console.warn('[useFileSystem] startWatch failed (non-fatal):', err);
      });
    } finally {
      setLoading(false);
    }
  };

  const openFolderPath = async (path: string): Promise<void> => {
    setLoading(true);
    try {
      const tree = await readDirectory(path);
      setWatchedPath(path);
      setFileTree(tree);
      useUIStore.getState().setLastWatchedPath(path);
      // asset 프로토콜 scope 런타임 등록 — HTML 파일 보기를 위해 해당 폴더를 WebView 허용 목록에 추가
      // 실패 시 앱 탐색은 계속되나 HTML 보기 기능이 동작하지 않을 수 있음
      registerAssetScope(path).catch((err: unknown) => {
        console.error('[useFileSystem] registerAssetScope failed:', err);
      });
      // startWatch is non-blocking: watcher failure must not prevent navigation
      startWatch(path).catch((err: unknown) => {
        console.warn('[useFileSystem] startWatch failed (non-fatal):', err);
      });
    } catch (err: unknown) {
      console.error('[useFileSystem] openFolderPath failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // @MX:NOTE: [AUTO] SPEC-FS-003 REQ-029: 폴더 이동 허위 가드 제거.
  //   openFolder/openFolderPath는 content/dirty/currentFilePath를 변경하지 않으므로(문서 유지)
  //   changeFolder의 기존 window.confirm은 실제로 일어나지 않는 손실을 경고하는 허위 가드였다.
  //   허위 가드는 사용자가 경고 전체를 습관적으로 무시하게 만들어 진짜 가드를 무력화한다.
  //   대체 모달 없음. 폴더 이동은 가드 대상이 아니다.
  const changeFolder = async (): Promise<void> => {
    const selectedPath = await openDirectoryDialog();
    if (selectedPath === null) return;

    await openFolderPath(selectedPath);
  };

  // @MX:NOTE: [AUTO] SPEC-PREVIEW-007: 파일을 열 때 4분류(html/too-large/text/binary)로 판정.
  //   1. .html → 기존 경로 유지 (편집기 미로드, previewStatus='html')
  //   2. size > FILE_SIZE_THRESHOLD → too-large (readFile 회피, previewStatus='too-large')
  //   3. readFile 성공 → text (편집기 로드, previewStatus='text')
  //   4. readFile reject → binary (편집기 미로드, previewStatus='binary', 예외 흡수)
  //   어떤 경우에도 예외를 상위로 전파하지 않는다 (REQ-PREVIEW007-006).
  // @MX:SPEC: SPEC-PREVIEW-007 REQ-PREVIEW007-003 REQ-PREVIEW007-004 REQ-PREVIEW007-005 REQ-PREVIEW007-006
  // @MX:SPEC: SPEC-PREVIEW-004 REQ-PREVIEW004-001
  const openFile = async (path: string): Promise<void> => {
    // @MX:NOTE: [AUTO] SPEC-FS-003 REQ-012/028: 미저장 변경 가드는 호출측(FileTreeNode)에서
    //   requestGuardedAction으로 감싼다. openFile 자체는 가드-free 순수 동작 — 워처/복원 경로에서도
    //   재사용 가능. window.confirm 제거(REQ-028).
    // @MX:SPEC: SPEC-FS-003

    // @MX:NOTE: [AUTO] SPEC-FS-003 REQ-011: 열린 파일은 정의상 깨끗함 —
    //   모든 분기(html/raster/svg/too-large/text/binary)가 파일을 로드하므로 dirty를 false로 리셋.
    //   성공·실패 무관 (svg readFile reject, binary catch 포함).
    // @MX:SPEC: SPEC-FS-003
    useEditorStore.getState().setDirty(false);

    const { setPreviewStatus } = useFileStore.getState();

    // 1순위: HTML 파일 — 편집기에 내용을 로드하지 않고 파일 경로만 store에 설정
    if (path.toLowerCase().endsWith('.html')) {
      setCurrentFile(path);
      setContent('');
      setCurrentFilePath(path);
      setPreviewStatus('html');
      useUIStore.getState().setSaveStatus('saved');
      return;
    }

    // 2순위: 래스터 이미지(.png/.jpg/.jpeg/.gif/.webp/.bmp/.ico/.avif) — SPEC-PREVIEW-008 D1/D2
    // read_file은 비-UTF-8을 reject하므로 시도 자체를 회피하고, 편집기에는 로드하지 않는다(보기 전용).
    // 대용량 가드(3순위)도 건너뛴다 — ImageFileViewer는 asset://로 OS 스트리밍하므로 크기 무관(REQ-003).
    // previewStatus는 확장하지 않으므로(D1) 'text'를 그대로 쓰되, 실제 라우팅은
    // getFileViewType의 확장자 분기가 담당하므로 이 값은 라우팅에 영향을 주지 않는다.
    if (isRasterImagePath(path)) {
      setCurrentFile(path);
      setContent('');
      setCurrentFilePath(path);
      setPreviewStatus('text');
      useUIStore.getState().setSaveStatus('saved');
      return;
    }

    // 2.5순위: SVG — 소스 뷰(Shiki)용 원본 텍스트를 대용량 가드 없이 로드한다 (렌더 뷰가 기본, D3/D6).
    // 렌더 뷰는 크기와 무관하게 항상 표시되어야 하므로 FILE_SIZE_THRESHOLD 이전에 위치한다.
    // 대용량 소스 하이라이팅 자체의 성능 가드는 SvgFileViewer 컴포넌트가 담당한다(D3).
    if (isSvgPath(path)) {
      try {
        const svgContent = await readFile(path);
        setCurrentFile(path);
        setContent(svgContent);
        setCurrentFilePath(path);
        setPreviewStatus('text');
        useUIStore.getState().setSaveStatus('saved');
      } catch {
        // REQ-PREVIEW007-006과 동일하게 예외를 흡수한다
        setCurrentFile(path);
        setContent('');
        setCurrentFilePath(path);
        setPreviewStatus('binary');
        useUIStore.getState().setSaveStatus('saved');
      }
      return;
    }

    // 3순위: 대용량 파일 가드 — FileNode.size로 열기 전에 판정
    // fileStore tree에서 해당 경로의 노드를 찾아 크기를 확인한다 (SPEC-PREVIEW-008: ImageFileViewer/
    // SvgFileViewer와 동일한 findFileNodeSize 유틸을 공유하도록 리팩토링)
    const nodeSize = findFileNodeSize(useFileStore.getState().fileTree, path);
    if (nodeSize !== undefined && nodeSize > FILE_SIZE_THRESHOLD) {
      setCurrentFile(path);
      setContent('');
      setCurrentFilePath(path);
      setPreviewStatus('too-large');
      useUIStore.getState().setSaveStatus('saved');
      return;
    }

    // 3/4순위: readFile 시도 — 성공이면 text, reject이면 binary
    try {
      const content = await readFile(path);
      setCurrentFile(path);
      setContent(content);
      setCurrentFilePath(path);
      setPreviewStatus('text');
      useUIStore.getState().setSaveStatus('saved');
    } catch {
      // 바이너리/읽기 불가/권한 오류 등 모든 reject를 binary로 흡수
      // REQ-PREVIEW007-006: 예외를 상위로 전파하지 않는다
      setCurrentFile(path);
      setContent('');
      setCurrentFilePath(path);
      setPreviewStatus('binary');
      useUIStore.getState().setSaveStatus('saved');
    }
  };

  // SPEC-FS-003 T4 (REQ-009): saveFileAs는 단일 saveDocument()로 위임한다.
  //   hook 인터페이스 시그니처(Promise<string | null>)는 유지해 호출측 파급을 최소화한다(REQ-032).
  //   saveDocument가 경로 유무에 따라 덮어쓰기/Save As를 처리한다.
  // REQ-FS-003-041~044: saveFileAs는 항상 다이얼로그를 띄워야 하므로 forceDialog:true 전달.
  const saveFileAs = async (): Promise<string | null> => {
    const ok = await saveDocument({ forceDialog: true });
    return ok ? useEditorStore.getState().currentFilePath : null;
  };

  const createFile = async (dirPath: string, name: string): Promise<void> => {
    const fullPath = `${dirPath}/${name}`;
    await ipcCreateFile(fullPath);
    await refreshTree();
  };

  const deleteNode = async (path: string): Promise<void> => {
    await ipcDeleteFile(path);
    await refreshTree();
  };

  const renameNode = async (path: string, newName: string): Promise<void> => {
    const parentPath = getParentPath(path);
    const newPath = `${parentPath}/${newName}`;
    await ipcRenameFile(path, newPath);
    await refreshTree();
  };

  return { openFolder, openFolderPath, changeFolder, openFile, saveFileAs, createFile, deleteNode, renameNode };
}
