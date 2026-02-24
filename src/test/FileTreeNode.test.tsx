import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileTreeNode } from '@/components/sidebar/FileTreeNode';
import { useFileStore } from '@/store/fileStore';
import { readDirectory } from '@/lib/tauri/ipc';
import type { FileNode } from '@/types/file';

// Mock useFileSystem hook
const mockOpenFolderPath = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/useFileSystem', () => ({
  useFileSystem: () => ({
    openFile: vi.fn(),
    createFile: vi.fn(),
    deleteNode: vi.fn(),
    renameNode: vi.fn(),
    openFolderPath: mockOpenFolderPath,
  }),
}));

// Mock tauri ipc - readDirectory is used for lazy-loading directory children
vi.mock('@/lib/tauri/ipc', () => ({
  readDirectory: vi.fn().mockResolvedValue([]),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  createFile: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  openDirectoryDialog: vi.fn(),
  startWatch: vi.fn(),
  stopWatch: vi.fn(),
}));

const fileNode: FileNode = {
  name: 'readme.md',
  path: '/project/readme.md',
  isDirectory: false,
};

const dirNode: FileNode = {
  name: 'docs',
  path: '/project/docs',
  isDirectory: true,
  children: [
    { name: 'guide.md', path: '/project/docs/guide.md', isDirectory: false },
  ],
};

describe('FileTreeNode', () => {
  beforeEach(() => {
    useFileStore.setState({
      fileTree: [],
      currentFile: null,
      expandedDirs: new Set(),
      watchedPath: null,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it('should render a file node with its name', () => {
    render(<FileTreeNode node={fileNode} depth={0} onRefresh={() => {}} />);
    expect(screen.getByText('readme.md')).toBeInTheDocument();
  });

  it('should render a directory node with its name', () => {
    render(<FileTreeNode node={dirNode} depth={0} onRefresh={() => {}} />);
    expect(screen.getByText('docs')).toBeInTheDocument();
  });

  it('should apply active highlight when node is the current file', () => {
    useFileStore.setState({ currentFile: '/project/readme.md' });
    render(<FileTreeNode node={fileNode} depth={0} onRefresh={() => {}} />);
    const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]');
    expect(nodeEl?.className).toMatch(/bg-blue/);
  });

  it('should not show children when directory is collapsed', () => {
    render(<FileTreeNode node={dirNode} depth={0} onRefresh={() => {}} />);
    expect(screen.queryByText('guide.md')).not.toBeInTheDocument();
  });

  it('should show children when directory is expanded', () => {
    useFileStore.setState({ expandedDirs: new Set(['/project/docs']) });
    render(<FileTreeNode node={dirNode} depth={0} onRefresh={() => {}} />);
    expect(screen.getByText('guide.md')).toBeInTheDocument();
  });

  it('should call openFolderPath when directory is clicked', () => {
    render(<FileTreeNode node={dirNode} depth={0} onRefresh={() => {}} />);
    const nodeEl = screen.getByText('docs').closest('[data-testid="file-tree-node"]') as HTMLElement;
    fireEvent.click(nodeEl);
    expect(mockOpenFolderPath).toHaveBeenCalledWith('/project/docs');
  });

  it('should show context menu on right-click', () => {
    render(<FileTreeNode node={fileNode} depth={0} onRefresh={() => {}} />);
    const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
    fireEvent.contextMenu(nodeEl);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('should hide context menu when clicking outside', () => {
    render(
      <div>
        <FileTreeNode node={fileNode} depth={0} onRefresh={() => {}} />
        <div data-testid="outside">outside</div>
      </div>
    );
    const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
    fireEvent.contextMenu(nodeEl);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('should show rename input when Rename is selected from context menu', () => {
    render(<FileTreeNode node={fileNode} depth={0} onRefresh={() => {}} />);
    const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
    fireEvent.contextMenu(nodeEl);
    fireEvent.click(screen.getByText('Rename'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should cancel rename on Escape key', () => {
    render(<FileTreeNode node={fileNode} depth={0} onRefresh={() => {}} />);
    const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
    fireEvent.contextMenu(nodeEl);
    fireEvent.click(screen.getByText('Rename'));
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('should show context menu items: New File, New Folder, Rename, Delete for directory', () => {
    render(<FileTreeNode node={dirNode} depth={0} onRefresh={() => {}} />);
    const nodeEl = screen.getByText('docs').closest('[data-testid="file-tree-node"]') as HTMLElement;
    fireEvent.contextMenu(nodeEl);
    expect(screen.getByText('New File')).toBeInTheDocument();
    expect(screen.getByText('New Folder')).toBeInTheDocument();
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should apply depth-based indentation', () => {
    render(<FileTreeNode node={fileNode} depth={2} onRefresh={() => {}} />);
    const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
    // depth 2 should produce some left padding
    expect(nodeEl.style.paddingLeft).toBeTruthy();
  });

  it('should call readDirectory and update store when expanded with null children', async () => {
    const lazyDir: FileNode = {
      name: 'lazy',
      path: '/project/lazy',
      isDirectory: true,
      // children is undefined - triggers lazy loading
    };
    const fetchedChildren: FileNode[] = [
      { name: 'nested.md', path: '/project/lazy/nested.md', isDirectory: false },
    ];

    vi.mocked(readDirectory).mockResolvedValueOnce(fetchedChildren);

    useFileStore.setState({
      fileTree: [lazyDir],
      expandedDirs: new Set(['/project/lazy']),
    });

    render(<FileTreeNode node={lazyDir} depth={0} onRefresh={() => {}} />);

    await waitFor(() => {
      expect(readDirectory).toHaveBeenCalledWith('/project/lazy');
    });

    await waitFor(() => {
      const updatedNode = useFileStore.getState().fileTree.find((n) => n.path === '/project/lazy');
      expect(updatedNode?.children).toEqual(fetchedChildren);
    });
  });

  it('should not call readDirectory when children are already loaded', () => {
    useFileStore.setState({ expandedDirs: new Set(['/project/docs']) });
    render(<FileTreeNode node={dirNode} depth={0} onRefresh={() => {}} />);
    expect(readDirectory).not.toHaveBeenCalled();
  });

  it('should not call openFolderPath when file is clicked', () => {
    render(<FileTreeNode node={fileNode} depth={0} onRefresh={() => {}} />);
    const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
    fireEvent.click(nodeEl);
    expect(mockOpenFolderPath).not.toHaveBeenCalled();
  });
});
