import { create } from 'zustand';
import type { FileNode } from '@/types/file';

/**
 * Recursively locates the node at targetPath and replaces its children.
 * Returns a new tree array with the updated node.
 */
function setNodeChildren(nodes: FileNode[], targetPath: string, children: FileNode[]): FileNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return { ...node, children };
    }
    if (node.children != null) {
      return { ...node, children: setNodeChildren(node.children, targetPath, children) };
    }
    return node;
  });
}

// @MX:ANCHOR: [AUTO] Central file system state store for the sidebar file explorer
// @MX:REASON: [AUTO] Public API boundary - used by FileExplorer, FileTree, FileTreeNode, useFileSystem (fan_in >= 3)
// @MX:SPEC: SPEC-UI-002

interface FileState {
  /** Current file tree loaded from the watched directory */
  fileTree: FileNode[];
  /** Absolute path of the currently opened/active file */
  currentFile: string | null;
  /** Set of expanded directory paths in the tree */
  expandedDirs: Set<string>;
  /** The root directory path being watched/displayed */
  watchedPath: string | null;
  /** True while directory loading or file operations are in progress */
  isLoading: boolean;
  // Actions
  setFileTree: (tree: FileNode[]) => void;
  setCurrentFile: (path: string | null) => void;
  toggleDir: (path: string) => void;
  setWatchedPath: (path: string | null) => void;
  setLoading: (loading: boolean) => void;
  /** Updates children of a specific directory node (used for lazy loading on expand) */
  updateNodeChildren: (path: string, children: FileNode[]) => void;
}

// @MX:NOTE: [AUTO] fileStore is NOT persisted - file tree is session-scoped and re-loaded on app start.
// Zustand v5 has issues with Set serialization in persist middleware, so we skip persistence.
export const useFileStore = create<FileState>()((set, get) => ({
  fileTree: [],
  currentFile: null,
  expandedDirs: new Set<string>(),
  watchedPath: null,
  isLoading: false,

  setFileTree: (tree: FileNode[]): void => set({ fileTree: tree }),

  setCurrentFile: (path: string | null): void => set({ currentFile: path }),

  toggleDir: (path: string): void => {
    const current = get().expandedDirs;
    const next = new Set(current);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    set({ expandedDirs: next });
  },

  setWatchedPath: (path: string | null): void => set({ watchedPath: path }),

  setLoading: (loading: boolean): void => set({ isLoading: loading }),

  updateNodeChildren: (path: string, children: FileNode[]): void => {
    const current = get().fileTree;
    set({ fileTree: setNodeChildren(current, path, children) });
  },
}));
