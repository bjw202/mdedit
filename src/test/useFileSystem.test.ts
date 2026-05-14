import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useFileStore } from '@/store/fileStore';
import { useEditorStore } from '@/store/editorStore';

// Mock Tauri IPC layer
vi.mock('@/lib/tauri/ipc', () => ({
  openDirectoryDialog: vi.fn(),
  readDirectory: vi.fn(),
  readFile: vi.fn(),
  createFile: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  saveFileAs: vi.fn().mockResolvedValue(null),
  startWatch: vi.fn().mockResolvedValue(undefined),
  stopWatch: vi.fn().mockResolvedValue(undefined),
  registerAssetScope: vi.fn().mockResolvedValue(undefined),
}));

import * as ipc from '@/lib/tauri/ipc';

const mockDir = '/project';
const mockTree = [
  { name: 'docs', path: '/project/docs', isDirectory: true, children: [] },
  { name: 'main.ts', path: '/project/main.ts', isDirectory: false },
];

describe('useFileSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm for unsaved changes warning
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    useFileStore.setState({
      fileTree: [],
      currentFile: null,
      expandedDirs: new Set(),
      watchedPath: null,
      isLoading: false,
    });
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
  });

  it('should expose openFolder, openFolderPath, openFile, saveFileAs, createFile, deleteNode, renameNode', () => {
    const { result } = renderHook(() => useFileSystem());
    expect(typeof result.current.openFolder).toBe('function');
    expect(typeof result.current.openFolderPath).toBe('function');
    expect(typeof result.current.openFile).toBe('function');
    expect(typeof result.current.saveFileAs).toBe('function');
    expect(typeof result.current.createFile).toBe('function');
    expect(typeof result.current.deleteNode).toBe('function');
    expect(typeof result.current.renameNode).toBe('function');
  });

  it('openFolderPath: should load directory and update state', async () => {
    vi.mocked(ipc.readDirectory).mockResolvedValue(mockTree);

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFolderPath(mockDir);
    });

    const state = useFileStore.getState();
    expect(state.watchedPath).toBe(mockDir);
    expect(state.fileTree).toEqual(mockTree);
    expect(state.isLoading).toBe(false);
    expect(ipc.startWatch).toHaveBeenCalledWith(mockDir);
  });

  it('openFolder: should do nothing if dialog is cancelled', async () => {
    vi.mocked(ipc.openDirectoryDialog).mockResolvedValue(null);
    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFolder();
    });

    expect(useFileStore.getState().watchedPath).toBeNull();
    expect(ipc.readDirectory).not.toHaveBeenCalled();
  });

  it('openFolder: should load directory on success', async () => {
    vi.mocked(ipc.openDirectoryDialog).mockResolvedValue(mockDir);
    vi.mocked(ipc.readDirectory).mockResolvedValue(mockTree);

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFolder();
    });

    const state = useFileStore.getState();
    expect(state.watchedPath).toBe(mockDir);
    expect(state.fileTree).toEqual(mockTree);
    expect(state.isLoading).toBe(false);
  });

  it('openFolder: should set loading state during operation', async () => {
    let resolveDir: (v: string | null) => void;
    const dirPromise = new Promise<string | null>((r) => { resolveDir = r; });
    vi.mocked(ipc.openDirectoryDialog).mockReturnValue(dirPromise);
    vi.mocked(ipc.readDirectory).mockResolvedValue(mockTree);

    const { result } = renderHook(() => useFileSystem());

    let openFolderPromise: Promise<void>;
    act(() => {
      openFolderPromise = result.current.openFolder();
    });

    // Resolve dialog with a value
    await act(async () => {
      resolveDir!(mockDir);
      await openFolderPromise;
    });

    expect(useFileStore.getState().isLoading).toBe(false);
  });

  it('openFile: should read file and update editor store', async () => {
    const filePath = '/project/main.ts';
    const fileContent = '# Hello World';
    vi.mocked(ipc.readFile).mockResolvedValue(fileContent);

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile(filePath);
    });

    expect(ipc.readFile).toHaveBeenCalledWith(filePath);
    expect(useFileStore.getState().currentFile).toBe(filePath);
    expect(useEditorStore.getState().content).toBe(fileContent);
    expect(useEditorStore.getState().currentFilePath).toBe(filePath);
  });

  it('createFile: should call IPC and refresh tree', async () => {
    const dirPath = '/project/docs';
    const fileName = 'new-file.md';
    vi.mocked(ipc.createFile).mockResolvedValue(undefined);
    vi.mocked(ipc.readDirectory).mockResolvedValue(mockTree);

    useFileStore.setState({ watchedPath: mockDir, fileTree: [] });

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.createFile(dirPath, fileName);
    });

    expect(ipc.createFile).toHaveBeenCalledWith(`${dirPath}/${fileName}`);
    expect(ipc.readDirectory).toHaveBeenCalledWith(mockDir);
    expect(useFileStore.getState().fileTree).toEqual(mockTree);
  });

  it('deleteNode: should call IPC and refresh tree', async () => {
    const filePath = '/project/main.ts';
    vi.mocked(ipc.deleteFile).mockResolvedValue(undefined);
    vi.mocked(ipc.readDirectory).mockResolvedValue([]);

    useFileStore.setState({ watchedPath: mockDir, fileTree: mockTree });

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.deleteNode(filePath);
    });

    expect(ipc.deleteFile).toHaveBeenCalledWith(filePath);
    expect(ipc.readDirectory).toHaveBeenCalledWith(mockDir);
  });

  it('renameNode: should call IPC with joined path and refresh tree', async () => {
    const oldPath = '/project/main.ts';
    const newName = 'app.ts';
    vi.mocked(ipc.renameFile).mockResolvedValue(undefined);
    vi.mocked(ipc.readDirectory).mockResolvedValue(mockTree);

    useFileStore.setState({ watchedPath: mockDir, fileTree: mockTree });

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.renameNode(oldPath, newName);
    });

    expect(ipc.renameFile).toHaveBeenCalledWith(oldPath, '/project/app.ts');
    expect(ipc.readDirectory).toHaveBeenCalledWith(mockDir);
  });

  // SPEC-PREVIEW-004: openFolder / openFolderPath가 registerAssetScope를 호출해야 한다

  it('openFolderPath: should call registerAssetScope with the opened path', async () => {
    vi.mocked(ipc.readDirectory).mockResolvedValue(mockTree);

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFolderPath(mockDir);
    });

    expect(ipc.registerAssetScope).toHaveBeenCalledWith(mockDir);
  });

  it('openFolder: should call registerAssetScope after folder is selected', async () => {
    vi.mocked(ipc.openDirectoryDialog).mockResolvedValue(mockDir);
    vi.mocked(ipc.readDirectory).mockResolvedValue(mockTree);

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFolder();
    });

    expect(ipc.registerAssetScope).toHaveBeenCalledWith(mockDir);
  });

  // SPEC-PREVIEW-004: openFile이 .html 파일을 편집기에 로드하지 않아야 한다

  it('openFile: .html 파일은 readFile을 호출하지 않는다', async () => {
    const htmlPath = '/project/index.html';
    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile(htmlPath);
    });

    expect(ipc.readFile).not.toHaveBeenCalled();
    expect(useFileStore.getState().currentFile).toBe(htmlPath);
  });

  it('openFile: .html 파일은 currentFile을 설정한다', async () => {
    const htmlPath = '/project/page.html';
    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile(htmlPath);
    });

    expect(useFileStore.getState().currentFile).toBe(htmlPath);
  });

  it('openFile: .HTML 대문자 확장자도 HTML 분기로 처리된다', async () => {
    const htmlPath = '/project/page.HTML';
    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile(htmlPath);
    });

    expect(ipc.readFile).not.toHaveBeenCalled();
    expect(useFileStore.getState().currentFile).toBe(htmlPath);
  });

  it('openFile: .md 파일은 기존과 동일하게 readFile을 호출한다', async () => {
    const mdPath = '/project/README.md';
    const content = '# Hello';
    vi.mocked(ipc.readFile).mockResolvedValue(content);

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile(mdPath);
    });

    expect(ipc.readFile).toHaveBeenCalledWith(mdPath);
    expect(useEditorStore.getState().content).toBe(content);
  });
});
