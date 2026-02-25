import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileExplorer } from '@/components/sidebar/FileExplorer';
import { useFileStore } from '@/store/fileStore';
import type { FileNode } from '@/types/file';

// Mock useFileSystem hook
const mockOpenFolder = vi.fn();
const mockOpenFolderPath = vi.fn();
vi.mock('@/hooks/useFileSystem', () => ({
  useFileSystem: () => ({
    openFolder: mockOpenFolder,
    openFolderPath: mockOpenFolderPath,
    openFile: vi.fn(),
    createFile: vi.fn(),
    deleteNode: vi.fn(),
    renameNode: vi.fn(),
  }),
}));

const mockTree: FileNode[] = [
  { name: 'README.md', path: '/project/README.md', isDirectory: false },
  {
    name: 'src',
    path: '/project/src',
    isDirectory: true,
    children: [
      { name: 'main.ts', path: '/project/src/main.ts', isDirectory: false },
    ],
  },
];

describe('FileExplorer', () => {
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

  it('should render "Open Folder" button when no folder is opened', () => {
    render(<FileExplorer />);
    expect(screen.getByRole('button', { name: /open folder/i })).toBeInTheDocument();
  });

  it('should show empty state message when no folder is opened', () => {
    render(<FileExplorer />);
    expect(screen.getByText(/no folder opened/i)).toBeInTheDocument();
  });

  it('should call openFolder when "Open Folder" button is clicked', () => {
    render(<FileExplorer />);
    const btn = screen.getByRole('button', { name: /open folder/i });
    fireEvent.click(btn);
    expect(mockOpenFolder).toHaveBeenCalledTimes(1);
  });

  it('should show file search when a folder is opened', () => {
    useFileStore.setState({ watchedPath: '/project', fileTree: mockTree });
    render(<FileExplorer />);
    const searchInput = screen.getByRole('searchbox');
    expect(searchInput).toBeInTheDocument();
  });

  it('should show file tree when a folder is opened', () => {
    useFileStore.setState({ watchedPath: '/project', fileTree: mockTree });
    render(<FileExplorer />);
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('src')).toBeInTheDocument();
  });

  it('should show watched path as header when folder is opened', () => {
    useFileStore.setState({ watchedPath: '/project', fileTree: mockTree });
    render(<FileExplorer />);
    expect(screen.getByText('project')).toBeInTheDocument();
  });

  it('should show loading indicator when isLoading is true', () => {
    useFileStore.setState({ watchedPath: '/project', isLoading: true });
    render(<FileExplorer />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should filter file tree based on search query', () => {
    useFileStore.setState({ watchedPath: '/project', fileTree: mockTree, expandedDirs: new Set(['/project/src']) });
    render(<FileExplorer />);
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'main' } });
    // Should show main.ts but not README.md
    expect(screen.getByText('main.ts')).toBeInTheDocument();
    expect(screen.queryByText('README.md')).not.toBeInTheDocument();
  });

  it('should show all files when search is cleared', () => {
    useFileStore.setState({ watchedPath: '/project', fileTree: mockTree });
    render(<FileExplorer />);
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'main' } });
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('src')).toBeInTheDocument();
  });

  it('should show "Go to parent folder" button when watchedPath has a parent', () => {
    useFileStore.setState({ watchedPath: '/project', fileTree: mockTree });
    render(<FileExplorer />);
    expect(screen.getByRole('button', { name: /go to parent folder/i })).toBeInTheDocument();
  });

  it('should not show "Go to parent folder" button when watchedPath is root', () => {
    useFileStore.setState({ watchedPath: '/', fileTree: [] });
    render(<FileExplorer />);
    expect(screen.queryByRole('button', { name: /go to parent folder/i })).not.toBeInTheDocument();
  });

  it('should call openFolderPath with parent path when Go Up button is clicked', () => {
    useFileStore.setState({ watchedPath: '/home/user/project', fileTree: mockTree });
    render(<FileExplorer />);
    const goUpBtn = screen.getByRole('button', { name: /go to parent folder/i });
    fireEvent.click(goUpBtn);
    expect(mockOpenFolderPath).toHaveBeenCalledWith('/home/user');
  });

  it('should show ".." parent directory entry when watchedPath has a parent', () => {
    useFileStore.setState({ watchedPath: '/project', fileTree: mockTree });
    render(<FileExplorer />);
    expect(screen.getByRole('button', { name: /parent directory/i })).toBeInTheDocument();
    expect(screen.getByText('..')).toBeInTheDocument();
  });

  it('should not show ".." entry when watchedPath is root', () => {
    useFileStore.setState({ watchedPath: '/', fileTree: [] });
    render(<FileExplorer />);
    expect(screen.queryByRole('button', { name: /parent directory/i })).not.toBeInTheDocument();
    expect(screen.queryByText('..')).not.toBeInTheDocument();
  });

  it('should call openFolderPath with parent path when ".." is clicked', () => {
    useFileStore.setState({ watchedPath: '/home/user/project', fileTree: mockTree });
    render(<FileExplorer />);
    const parentBtn = screen.getByRole('button', { name: /parent directory/i });
    fireEvent.click(parentBtn);
    expect(mockOpenFolderPath).toHaveBeenCalledWith('/home/user');
  });

  it('should show Refresh button when a folder is opened', () => {
    useFileStore.setState({ watchedPath: '/project', fileTree: mockTree });
    render(<FileExplorer />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  // Windows drive root navigation tests
  it('should navigate to Windows drive root "C:\\" when inside "C:\\Users"', () => {
    useFileStore.setState({ watchedPath: 'C:\\Users', fileTree: [] });
    render(<FileExplorer />);
    const goUpBtn = screen.getByRole('button', { name: /go to parent folder/i });
    fireEvent.click(goUpBtn);
    expect(mockOpenFolderPath).toHaveBeenCalledWith('C:\\');
  });

  it('should not show Go Up button when watchedPath is Windows drive root "C:\\"', () => {
    useFileStore.setState({ watchedPath: 'C:\\', fileTree: [] });
    render(<FileExplorer />);
    expect(screen.queryByRole('button', { name: /go to parent folder/i })).not.toBeInTheDocument();
  });

  it('should navigate to correct parent for deep Windows path', () => {
    useFileStore.setState({ watchedPath: 'D:\\Projects\\MyProject', fileTree: [] });
    render(<FileExplorer />);
    const goUpBtn = screen.getByRole('button', { name: /go to parent folder/i });
    fireEvent.click(goUpBtn);
    expect(mockOpenFolderPath).toHaveBeenCalledWith('D:\\Projects');
  });

  it('should navigate to Windows drive root "D:\\" when inside "D:\\Projects"', () => {
    useFileStore.setState({ watchedPath: 'D:\\Projects', fileTree: [] });
    render(<FileExplorer />);
    const goUpBtn = screen.getByRole('button', { name: /go to parent folder/i });
    fireEvent.click(goUpBtn);
    expect(mockOpenFolderPath).toHaveBeenCalledWith('D:\\');
  });
});
