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
} from '@/lib/tauri/ipc';
import { useFileStore } from '@/store/fileStore';
import { useEditorStore } from '@/store/editorStore';
import { useUIStore } from '@/store/uiStore';

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

  const openFile = async (path: string): Promise<void> => {
    // Check for unsaved changes and warn the user
    const { dirty } = useEditorStore.getState();
    if (dirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Do you want to discard them and open the new file?'
      );
      if (!confirmed) {
        return;
      }
    }

    const content = await readFile(path);
    setCurrentFile(path);
    setContent(content);
    setCurrentFilePath(path);
    useUIStore.getState().setSaveStatus('saved');
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
