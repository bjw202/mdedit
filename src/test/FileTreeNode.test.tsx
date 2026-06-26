import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileTreeNode } from '@/components/sidebar/FileTreeNode';
import { useFileStore } from '@/store/fileStore';
import { useUIStore } from '@/store/uiStore';
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
    useUIStore.setState({ statusMessage: null });
    vi.clearAllMocks();
    // clipboard.writeText 는 setup.ts 에서 configurable mock 으로 정의됨 — 기본 resolved 로 리셋
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
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

describe('FileTreeNode: context menu Copy Path / Copy Name (SPEC-UI-005)', () => {
  const winFileNode: FileNode = {
    name: 'readme.md',
    path: 'C:\\Users\\jw\\docs\\readme.md',
    isDirectory: false,
  };

  beforeEach(() => {
    useFileStore.setState({
      fileTree: [],
      currentFile: null,
      expandedDirs: new Set(),
      watchedPath: null,
      isLoading: false,
    });
    useUIStore.setState({ statusMessage: null });
    vi.clearAllMocks();
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
  });

  afterEach(() => {
    useUIStore.setState({ statusMessage: null });
  });

  // 헬퍼: file node 를 렌더하고 컨텍스트 메뉴를 연다
  function openFileMenu(node: FileNode = fileNode): HTMLElement {
    render(<FileTreeNode node={node} depth={0} onRefresh={() => {}} />);
    const nodeEl = screen.getByText(node.name).closest('[data-testid="file-tree-node"]') as HTMLElement;
    fireEvent.contextMenu(nodeEl);
    return nodeEl;
  }

  it('renders Copy Path and Copy Name menu items for file node (AC-001)', () => {
    openFileMenu();
    expect(screen.getByRole('menuitem', { name: 'Copy Path' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy Name' })).toBeInTheDocument();
  });

  it('renders Copy Path and Copy Name menu items for folder node (AC-002)', () => {
    openFileMenu(dirNode);
    expect(screen.getByRole('menuitem', { name: 'Copy Path' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy Name' })).toBeInTheDocument();
  });

  it('places copy group below New File/Folder + divider and above Rename/Delete for folder (AC-002)', () => {
    openFileMenu(dirNode);
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent?.trim() ?? '');
    const newFileIdx = items.findIndex((t) => t === 'New File');
    const newFolderIdx = items.findIndex((t) => t === 'New Folder');
    const copyPathIdx = items.findIndex((t) => t === 'Copy Path');
    const copyNameIdx = items.findIndex((t) => t === 'Copy Name');
    const renameIdx = items.findIndex((t) => t === 'Rename');
    const deleteIdx = items.findIndex((t) => t === 'Delete');

    expect(newFileIdx).toBeGreaterThanOrEqual(0);
    expect(newFolderIdx).toBeGreaterThan(newFileIdx);
    expect(copyPathIdx).toBeGreaterThan(newFolderIdx);
    expect(copyNameIdx).toBeGreaterThan(copyPathIdx);
    expect(renameIdx).toBeGreaterThan(copyNameIdx);
    expect(deleteIdx).toBeGreaterThan(renameIdx);
  });

  it('calls writeText with node.path exactly when Copy Path clicked (AC-003, AC-012, must-pass)', () => {
    openFileMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Path' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/project/readme.md');
  });

  it('records byte-identical Windows-style path (no separator normalization) (AC-012, must-pass)', () => {
    openFileMenu(winFileNode);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Path' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('C:\\Users\\jw\\docs\\readme.md');
  });

  it('calls writeText with node.name when Copy Name clicked (AC-004)', () => {
    openFileMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Name' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('readme.md');
  });

  it('sets statusMessage containing copied value on success (AC-005)', async () => {
    openFileMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Path' }));
    await waitFor(() => {
      expect(useUIStore.getState().statusMessage).toContain('/project/readme.md');
    });
  });

  it('closes context menu after Copy Path click (AC-008)', () => {
    openFileMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Path' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes context menu after Copy Name click (AC-008)', () => {
    openFileMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Name' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Copy Path menu item is a native <button> with role menuitem (Enter/Space keyboard activation per HTML spec) (AC-003a)', () => {
    // REQ-UI-005-003 Enter/Space 활성화는 HTML spec 에 따라 native <button role='menuitem'> 로 충족된다.
    // jsdom 은 브라우저의 keydown→click 변환을 시뮬레이션하지 않으며, @testing-library/user-event 는
    // 프로젝트 의존성이 아니고 AC-014 가 신규 의존성 추가를 금지한다. 본 테스트는 해당 요소가
    // keyboard 활성화를 보장하는 HTML-spec 속성 (native BUTTON + role=menuitem) 을 가짐을 검증하고,
    // 추가로 click 활성화가 copy 핸들러로 정확히 연결되는지 확인한다.
    openFileMenu();
    const item = screen.getByRole('menuitem', { name: 'Copy Path' });
    expect(item.tagName).toBe('BUTTON');
    fireEvent.click(item);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/project/readme.md');
  });

  it('Copy Name menu item is a native <button> with role menuitem (keyboard-activatable) (AC-003a)', () => {
    openFileMenu();
    const item = screen.getByRole('menuitem', { name: 'Copy Name' });
    expect(item.tagName).toBe('BUTTON');
    fireEvent.click(item);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('readme.md');
  });

  it('sets error statusMessage and does not throw when writeText rejects (AC-011, must-pass)', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    openFileMenu();
    // 클릭 핸들러는 () => { setContextMenu(null); void handleCopyPath(); } 이며
    // void 가 promise rejection 을 삼키므로 동기 throw 는 발생하지 않는다 — .not.toThrow() 검증은 tautology.
    // 진짜 catch 경로 검증은 아래 waitFor (에러 statusMessage 설정) 이 수행한다.
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Path' }));
    await waitFor(() => {
      const msg = useUIStore.getState().statusMessage;
      expect(msg).toBeTruthy();
      // 에러 성격의 메시지 (Failed to copy path)
      expect(msg).toMatch(/failed/i);
    });
  });

  it('does not call onRefresh after Copy Path click (AC-013)', () => {
    const onRefresh = vi.fn();
    render(<FileTreeNode node={fileNode} depth={0} onRefresh={onRefresh} />);
    const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
    fireEvent.contextMenu(nodeEl);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Path' }));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not call onRefresh after Copy Name click (AC-013)', () => {
    const onRefresh = vi.fn();
    render(<FileTreeNode node={fileNode} depth={0} onRefresh={onRefresh} />);
    const nodeEl = screen.getByText('readme.md').closest('[data-testid="file-tree-node"]') as HTMLElement;
    fireEvent.contextMenu(nodeEl);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Name' }));
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
