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
      // .md 파일 포함 — filterViewableFiles가 이를 통과시킨다
      { name: 'main.md', path: '/project/src/main.md', isDirectory: false },
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
    // Should show main.md but not README.md
    expect(screen.getByText('main.md')).toBeInTheDocument();
    expect(screen.queryByText('README.md')).not.toBeInTheDocument();
  });

  it('should show all viewable files when search is cleared', () => {
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

  // SPEC-PREVIEW-004: filterViewableFiles — .html 파일도 사이드바에 표시되어야 한다

  it('should show .html files in the file tree (SPEC-PREVIEW-004)', () => {
    const treeWithHtml: FileNode[] = [
      { name: 'index.html', path: '/project/index.html', isDirectory: false },
      { name: 'README.md', path: '/project/README.md', isDirectory: false },
    ];
    useFileStore.setState({ watchedPath: '/project', fileTree: treeWithHtml });
    render(<FileExplorer />);
    expect(screen.getByText('index.html')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('SPEC-PREVIEW-005: .ts 같은 코드 파일도 .html/.md와 함께 표시되어야 한다', () => {
    // SPEC-PREVIEW-005 이전: app.ts는 숨겨졌었다(버그).
    // SPEC-PREVIEW-005 이후: extensionLangMap에 있는 코드 파일은 모두 표시된다.
    const treeWithMixed: FileNode[] = [
      { name: 'index.html', path: '/project/index.html', isDirectory: false },
      { name: 'app.ts', path: '/project/app.ts', isDirectory: false },
      { name: 'notes.md', path: '/project/notes.md', isDirectory: false },
    ];
    useFileStore.setState({ watchedPath: '/project', fileTree: treeWithMixed });
    render(<FileExplorer />);
    expect(screen.getByText('index.html')).toBeInTheDocument();
    expect(screen.getByText('notes.md')).toBeInTheDocument();
    // SPEC-PREVIEW-005: .ts는 코드 파일이므로 이제 표시되어야 한다
    expect(screen.getByText('app.ts')).toBeInTheDocument();
  });

  it('should show .HTML (uppercase) files in the file tree', () => {
    const treeWithUpperHtml: FileNode[] = [
      { name: 'PAGE.HTML', path: '/project/PAGE.HTML', isDirectory: false },
    ];
    useFileStore.setState({ watchedPath: '/project', fileTree: treeWithUpperHtml });
    render(<FileExplorer />);
    expect(screen.getByText('PAGE.HTML')).toBeInTheDocument();
  });

  // SPEC-PREVIEW-005: 코드/데이터 파일(.py/.json/.yaml/.ts 등)도 사이드바에 표시되어야 한다

  it('SPEC-PREVIEW-005: 코드 확장자 파일(.py, .json, .yaml, .ts)이 사이드바에 표시되어야 한다', () => {
    const treeWithCodeFiles: FileNode[] = [
      { name: 'notes.py', path: '/project/notes.py', isDirectory: false },
      { name: 'config.json', path: '/project/config.json', isDirectory: false },
      { name: 'data.yaml', path: '/project/data.yaml', isDirectory: false },
      { name: 'readme.md', path: '/project/readme.md', isDirectory: false },
      { name: 'index.html', path: '/project/index.html', isDirectory: false },
      { name: 'archive.zip', path: '/project/archive.zip', isDirectory: false },
      {
        name: 'src',
        path: '/project/src',
        isDirectory: true,
        children: [
          { name: 'app.ts', path: '/project/src/app.ts', isDirectory: false },
        ],
      },
    ];
    useFileStore.setState({ watchedPath: '/project', fileTree: treeWithCodeFiles });
    render(<FileExplorer />);

    // 코드/데이터 파일은 표시되어야 한다
    expect(screen.getByText('notes.py')).toBeInTheDocument();
    expect(screen.getByText('config.json')).toBeInTheDocument();
    expect(screen.getByText('data.yaml')).toBeInTheDocument();
    // 기존 .md/.html도 계속 표시되어야 한다
    expect(screen.getByText('readme.md')).toBeInTheDocument();
    expect(screen.getByText('index.html')).toBeInTheDocument();
    // 디렉토리는 항상 포함되어야 한다
    expect(screen.getByText('src')).toBeInTheDocument();
    // 알 수 없는 확장자는 제외되어야 한다
    expect(screen.queryByText('archive.zip')).not.toBeInTheDocument();
  });

  it('SPEC-PREVIEW-005: extensionLangMap에 없는 확장자만 제외하고 모든 지원 확장자는 표시한다', () => {
    const mixedTree: FileNode[] = [
      { name: 'script.sh', path: '/project/script.sh', isDirectory: false },
      { name: 'style.css', path: '/project/style.css', isDirectory: false },
      { name: 'config.toml', path: '/project/config.toml', isDirectory: false },
      { name: 'main.js', path: '/project/main.js', isDirectory: false },
      { name: 'unknown.bin', path: '/project/unknown.bin', isDirectory: false },
      { name: 'image.png', path: '/project/image.png', isDirectory: false },
    ];
    useFileStore.setState({ watchedPath: '/project', fileTree: mixedTree });
    render(<FileExplorer />);

    // extensionLangMap에 있는 파일들은 모두 표시되어야 한다
    expect(screen.getByText('script.sh')).toBeInTheDocument();
    expect(screen.getByText('style.css')).toBeInTheDocument();
    expect(screen.getByText('config.toml')).toBeInTheDocument();
    expect(screen.getByText('main.js')).toBeInTheDocument();
    // 지원되지 않는 확장자는 제외되어야 한다
    expect(screen.queryByText('unknown.bin')).not.toBeInTheDocument();
    expect(screen.queryByText('image.png')).not.toBeInTheDocument();
  });
});
