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
  saveFileAs as ipcSaveFileAs,
  startWatch,
  registerAssetScope,
} from '@/lib/tauri/ipc';
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

  // @MX:NOTE: Opens a folder-change dialog with unsaved-changes guard (REQ-UI-003-01, REQ-UI-003-09)
  const changeFolder = async (): Promise<void> => {
    const { dirty } = useEditorStore.getState();
    if (dirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Do you want to discard them and change folder?'
      );
      if (!confirmed) return;
    }

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
    // 미저장 변경사항 경고
    const { dirty } = useEditorStore.getState();
    if (dirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Do you want to discard them and open the new file?'
      );
      if (!confirmed) {
        return;
      }
    }

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

  const saveFileAs = async (): Promise<string | null> => {
    const { content } = useEditorStore.getState();
    useUIStore.getState().setSaveStatus('saving');
    try {
      const savedPath = await ipcSaveFileAs(content);
      if (savedPath !== null) {
        setCurrentFilePath(savedPath);
        useEditorStore.getState().setDirty(false);
        useUIStore.getState().setSaveStatus('saved');
      } else {
        const isDirty = useEditorStore.getState().dirty;
        useUIStore.getState().setSaveStatus(isDirty ? 'unsaved' : 'saved');
      }
      return savedPath;
    } catch (err: unknown) {
      console.error('[useFileSystem] saveFileAs failed:', err);
      useUIStore.getState().setSaveStatus('unsaved');
      return null;
    }
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
