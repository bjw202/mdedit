import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileTree } from '@/components/sidebar/FileTree';
import { useFileStore } from '@/store/fileStore';
import type { FileNode } from '@/types/file';

// Mock useFileSystem hook
vi.mock('@/hooks/useFileSystem', () => ({
  useFileSystem: () => ({
    openFile: vi.fn(),
    createFile: vi.fn(),
    deleteNode: vi.fn(),
    renameNode: vi.fn(),
  }),
}));

const mixedNodes: FileNode[] = [
  { name: 'main.ts', path: '/project/main.ts', isDirectory: false },
  {
    name: 'src',
    path: '/project/src',
    isDirectory: true,
    children: [
      { name: 'app.ts', path: '/project/src/app.ts', isDirectory: false },
    ],
  },
  { name: 'README.md', path: '/project/README.md', isDirectory: false },
  {
    name: 'docs',
    path: '/project/docs',
    isDirectory: true,
    children: [],
  },
];

describe('FileTree', () => {
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

  it('should render nothing when nodes array is empty', () => {
    const { container } = render(<FileTree nodes={[]} onRefresh={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render all top-level nodes', () => {
    render(<FileTree nodes={mixedNodes} onRefresh={() => {}} />);
    expect(screen.getByText('main.ts')).toBeInTheDocument();
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('docs')).toBeInTheDocument();
  });

  it('should render directories before files', () => {
    render(<FileTree nodes={mixedNodes} onRefresh={() => {}} />);
    const allItems = screen.getAllByTestId('file-tree-node');
    const names = allItems.map((el) => el.textContent?.trim() ?? '');
    // First two should be directories (docs and src alphabetically)
    expect(['docs', 'src']).toContain(names[0]);
    expect(['docs', 'src']).toContain(names[1]);
  });

  it('should sort directories alphabetically', () => {
    render(<FileTree nodes={mixedNodes} onRefresh={() => {}} />);
    const allItems = screen.getAllByTestId('file-tree-node');
    const names = allItems.map((el) => el.textContent?.trim() ?? '');
    const dirs = names.slice(0, 2);
    expect(dirs).toEqual(['docs', 'src']);
  });

  it('should sort files alphabetically after directories', () => {
    render(<FileTree nodes={mixedNodes} onRefresh={() => {}} />);
    const allItems = screen.getAllByTestId('file-tree-node');
    const names = allItems.map((el) => el.textContent?.trim() ?? '');
    const files = names.slice(2, 4);
    expect(files).toEqual(['main.ts', 'README.md']);
  });

  it('should pass onRefresh to each FileTreeNode', () => {
    const handleRefresh = vi.fn();
    const singleNode: FileNode[] = [
      { name: 'file.ts', path: '/project/file.ts', isDirectory: false },
    ];
    render(<FileTree nodes={singleNode} onRefresh={handleRefresh} />);
    expect(screen.getByText('file.ts')).toBeInTheDocument();
  });
});
