import { useState, useCallback } from 'react';
import { useFileStore } from '@/store/fileStore';
import { useFileSystem } from '@/hooks/useFileSystem';
import { readDirectory } from '@/lib/tauri/ipc';
import { FileSearch } from './FileSearch';
import { FileTree } from './FileTree';
import type { FileNode } from '@/types/file';

// @MX:ANCHOR: [AUTO] Top-level sidebar container - orchestrates file tree, search, open-folder actions
// @MX:REASON: [AUTO] Public API boundary - used by AppLayout as the sidebar component (fan_in >= 3)
// @MX:SPEC: SPEC-UI-002
// @MX:NOTE: [AUTO] parentOf handles Windows drive root edge case - "C:" must become "C:\" to avoid resolving to process CWD

/**
 * Recursively filters a FileNode tree to include only nodes whose name matches the query,
 * plus any ancestor directories that contain matching descendants.
 */
function filterTree(nodes: FileNode[], query: string): FileNode[] {
  if (!query.trim()) return nodes;
  const lower = query.toLowerCase();

  return nodes.reduce<FileNode[]>((acc, node) => {
    if (node.isDirectory && node.children) {
      const filteredChildren = filterTree(node.children, query);
      if (filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren });
      }
    } else if (node.name.toLowerCase().includes(lower)) {
      acc.push(node);
    }
    return acc;
  }, []);
}

/**
 * Derives the last segment of a path (folder name) for display.
 * Handles both Unix ('/') and Windows ('\') path separators.
 */
function getBaseName(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() ?? path;
}

/**
 * Returns the parent directory path, or null if already at root.
 * Handles both Unix ('/') and Windows ('\') path separators.
 *
 * Windows drive root edge case: slicing "C:\Users" at lastSlash=2 yields "C:",
 * which on Windows resolves to the process CWD on drive C (not the drive root).
 * We must return "C:\" to navigate to the actual drive root.
 */
function parentOf(path: string): string | null {
  const trimmed = path.replace(/[/\\]+$/, '');
  if (!trimmed) return null;
  const lastSlash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (lastSlash < 0) return null;
  if (lastSlash === 0) return '/';
  const parent = trimmed.slice(0, lastSlash);
  // Windows drive root: "C:" must become "C:\" to avoid resolving to process CWD
  if (/^[A-Za-z]:$/.test(parent)) {
    return parent + '\\';
  }
  return parent;
}

export function FileExplorer(): JSX.Element {
  const { fileTree, watchedPath, isLoading, setFileTree } = useFileStore();
  const { openFolder, openFolderPath, changeFolder } = useFileSystem();
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenFolder = useCallback((): void => {
    void openFolder();
  }, [openFolder]);

  const handleChangeFolder = useCallback((): void => {
    void changeFolder().then(() => setSearchQuery(''));
  }, [changeFolder]);

  const parentPath = watchedPath !== null ? parentOf(watchedPath) : null;
  const canGoUp = parentPath !== null;

  const handleGoUp = useCallback((): void => {
    if (!parentPath) return;
    void openFolderPath(parentPath);
  }, [parentPath, openFolderPath]);

  // Refreshes the file tree from the current watched path after file operations
  const handleRefresh = useCallback((): void => {
    const currentPath = useFileStore.getState().watchedPath;
    if (!currentPath) return;
    void readDirectory(currentPath).then((tree) => setFileTree(tree));
  }, [setFileTree]);

  const visibleTree = filterTree(fileTree, searchQuery);

  // Empty state - no folder opened
  if (!watchedPath) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 text-gray-300 dark:text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
          />
        </svg>
        <p className="text-xs text-gray-400 dark:text-gray-500">No folder opened</p>
        <button
          type="button"
          aria-label="Open Folder"
          onClick={handleOpenFolder}
          className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
        >
          Open Folder
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Folder header with name, Go Up button, and Refresh button */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
        {canGoUp && (
          <button
            type="button"
            aria-label="Go to parent folder"
            onClick={handleGoUp}
            title={`Go to parent folder: ${parentPath ?? ''}`}
            className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <span
          className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate flex-1"
          title={watchedPath ?? ''}
        >
          {getBaseName(watchedPath)}
        </span>
        {/* Change Folder button */}
        <button
          type="button"
          aria-label="Change Folder"
          onClick={handleChangeFolder}
          title="Change Folder"
          className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v4m0 0l-2-2m2 2l2-2" />
          </svg>
        </button>
        {/* Refresh button */}
        <button
          type="button"
          aria-label="Refresh"
          onClick={handleRefresh}
          title="Refresh directory"
          className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Search input */}
      <FileSearch value={searchQuery} onChange={setSearchQuery} />

      {/* File tree */}
      <div className="flex-1 overflow-y-auto">
        {/* ".." parent directory entry - standard file explorer navigation */}
        {canGoUp && (
          <button
            type="button"
            aria-label="Parent directory"
            onClick={handleGoUp}
            title={parentPath ?? ''}
            className="w-full flex items-center gap-1.5 py-0.5 px-2 cursor-pointer select-none rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="truncate text-xs">..</span>
          </button>
        )}
        <FileTree nodes={visibleTree} onRefresh={handleRefresh} />
      </div>
    </div>
  );
}
