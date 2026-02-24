import { useState, useEffect, useRef, useCallback } from 'react';
import { useFileStore } from '@/store/fileStore';
import { useFileSystem } from '@/hooks/useFileSystem';
import { readDirectory } from '@/lib/tauri/ipc';
import type { FileNode } from '@/types/file';

// @MX:SPEC: SPEC-UI-002

/**
 * Returns an inline SVG icon element appropriate for the given file/folder.
 */
function getFileIcon(name: string, isDirectory: boolean, isExpanded?: boolean): JSX.Element {
  if (isDirectory) {
    return isExpanded ? (
      // Open folder icon
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1H2V6z" />
        <path fillRule="evenodd" d="M2 9h16v7a2 2 0 01-2 2H4a2 2 0 01-2-2V9z" clipRule="evenodd" />
      </svg>
    ) : (
      // Closed folder icon
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      </svg>
    );
  }

  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const iconClass = 'w-4 h-4';

  // Markdown files
  if (ext === 'md' || ext === 'mdx') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={`${iconClass} text-blue-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  // TypeScript/JavaScript files
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={`${iconClass} text-yellow-300`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    );
  }
  // JSON/YAML config files
  if (['json', 'yaml', 'yml', 'toml'].includes(ext)) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={`${iconClass} text-green-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    );
  }
  // CSS/HTML files
  if (['css', 'html', 'htm', 'scss', 'sass'].includes(ext)) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={`${iconClass} text-pink-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21l-2-18h14l-2 18-5 2-5-2z" />
      </svg>
    );
  }
  // Text files
  if (ext === 'txt') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={`${iconClass} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  // Default file icon
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${iconClass} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

interface ContextMenuState {
  x: number;
  y: number;
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  onRefresh: () => void;
}

// @MX:WARN: Context menu delete action modifies filesystem permanently.
// @MX:REASON: [AUTO] Window confirm and IPC delete called - user must confirm before destructive action
export function FileTreeNode({ node, depth, onRefresh }: FileTreeNodeProps): JSX.Element {
  const { currentFile, expandedDirs, updateNodeChildren } = useFileStore();
  const { openFile, createFile, deleteNode, renameNode, openFolderPath } = useFileSystem();

  const isExpanded = expandedDirs.has(node.path);
  const isActive = currentFile === node.path;

  // Lazy-load children when a directory is expanded and children have not been fetched yet
  useEffect(() => {
    if (!isExpanded || node.children != null) return;

    void readDirectory(node.path)
      .then((children) => {
        updateNodeChildren(node.path, children);
      })
      .catch(() => {
        // On failure, set empty array to prevent repeated fetch attempts
        updateNodeChildren(node.path, []);
      });
  }, [isExpanded, node.path, node.children, updateNodeChildren]);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
  const [renameValue, setRenameValue] = useState(node.name);
  const [createValue, setCreateValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleMouseDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [contextMenu]);

  // Auto-focus rename/create inputs
  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus();
  }, [isRenaming]);

  useEffect(() => {
    if (isCreating) createInputRef.current?.focus();
  }, [isCreating]);

  const handleClick = useCallback((): void => {
    if (node.isDirectory) {
      openFolderPath(node.path).catch((err: unknown) => {
        console.error('[FileTreeNode] Directory navigation failed:', node.path, err);
      });
    } else {
      void openFile(node.path);
    }
  }, [node, openFolderPath, openFile]);

  const handleContextMenu = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleRenameConfirm = useCallback((): void => {
    if (renameValue.trim() && renameValue !== node.name) {
      void renameNode(node.path, renameValue.trim()).then(() => {
        onRefresh();
      });
    }
    setIsRenaming(false);
  }, [renameValue, node.name, node.path, renameNode, onRefresh]);

  const handleCreateConfirm = useCallback((): void => {
    if (createValue.trim() && isCreating) {
      const dirPath = node.isDirectory ? node.path : node.path.split('/').slice(0, -1).join('/');
      void createFile(dirPath, createValue.trim()).then(() => {
        onRefresh();
      });
    }
    setIsCreating(null);
    setCreateValue('');
  }, [createValue, isCreating, node, createFile, onRefresh]);

  const handleDelete = useCallback((): void => {
    setContextMenu(null);
    if (window.confirm(`Delete "${node.name}"? This cannot be undone.`)) {
      void deleteNode(node.path).then(() => onRefresh());
    }
  }, [node.name, node.path, deleteNode, onRefresh]);

  const paddingLeft = depth * 12 + 8;

  return (
    <div>
      {/* Node row */}
      <div
        data-testid="file-tree-node"
        role={node.isDirectory ? undefined : 'treeitem'}
        style={{ paddingLeft: `${paddingLeft}px` }}
        className={[
          'flex items-center gap-1.5 py-0.5 pr-2 cursor-pointer select-none text-sm rounded',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          isActive ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300',
        ].join(' ')}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Directory expand/collapse chevron */}
        {node.isDirectory && (
          <span className="w-3 h-3 flex-shrink-0 text-gray-400">
            {isExpanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </span>
        )}
        {/* File icon */}
        <span className="flex-shrink-0">
          {getFileIcon(node.name, node.isDirectory, isExpanded)}
        </span>
        {/* Name or rename input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameConfirm();
              if (e.key === 'Escape') {
                setIsRenaming(false);
                setRenameValue(node.name);
              }
            }}
            onBlur={handleRenameConfirm}
            className="text-xs bg-white dark:bg-gray-700 border border-blue-400 rounded px-1 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate text-xs">{node.name}</span>
        )}
      </div>

      {/* Inline create input (shown below directory row when creating) */}
      {isCreating && (
        <div style={{ paddingLeft: `${paddingLeft + 16}px` }} className="py-0.5 pr-2">
          <input
            ref={createInputRef}
            type="text"
            placeholder={isCreating === 'file' ? 'New file name...' : 'New folder name...'}
            value={createValue}
            onChange={(e) => setCreateValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateConfirm();
              if (e.key === 'Escape') {
                setIsCreating(null);
                setCreateValue('');
              }
            }}
            onBlur={() => { setIsCreating(null); setCreateValue(''); }}
            className="w-full text-xs bg-white dark:bg-gray-700 border border-blue-400 rounded px-1 outline-none"
          />
        </div>
      )}

      {/* Children - shown when directory is expanded */}
      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
          className="z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 min-w-[140px] text-sm"
        >
          {node.isDirectory && (
            <>
              <button
                role="menuitem"
                className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                onClick={() => { setContextMenu(null); setIsCreating('file'); setCreateValue(''); }}
              >
                New File
              </button>
              <button
                role="menuitem"
                className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                onClick={() => { setContextMenu(null); setIsCreating('folder'); setCreateValue(''); }}
              >
                New Folder
              </button>
              <hr className="border-gray-200 dark:border-gray-700 my-1" />
            </>
          )}
          <button
            role="menuitem"
            className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            onClick={() => { setContextMenu(null); setIsRenaming(true); setRenameValue(node.name); }}
          >
            Rename
          </button>
          <button
            role="menuitem"
            className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
