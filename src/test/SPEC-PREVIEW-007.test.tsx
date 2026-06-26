/**
 * SPEC-PREVIEW-007 TDD 테스트 — fileStore.previewStatus + openFile 분류
 *
 * RED → GREEN 단계: 구현 완료 후 통과해야 할 테스트들.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// ─── Tauri IPC mock ──────────────────────────────────────────────────────────

vi.mock('@/lib/tauri/ipc', () => ({
  openDirectoryDialog: vi.fn(),
  readDirectory: vi.fn().mockResolvedValue([]),
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
import { useFileStore } from '@/store/fileStore';
import { useEditorStore } from '@/store/editorStore';
import type { PreviewStatus } from '@/store/fileStore';

// 대용량 임계값 상수 (SPEC-PREVIEW-007 결정 2)
const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5 MB

// ─── Phase 1: fileStore.previewStatus ─────────────────────────────────────────

describe('fileStore — previewStatus 필드 (SPEC-PREVIEW-007 결정 1)', () => {
  beforeEach(() => {
    useFileStore.setState({
      fileTree: [],
      currentFile: null,
      expandedDirs: new Set(),
      watchedPath: null,
      isLoading: false,
      previewStatus: null,
    });
  });

  it('초기 previewStatus는 null이어야 한다', () => {
    expect(useFileStore.getState().previewStatus).toBeNull();
  });

  it('setPreviewStatus("text")로 상태를 설정할 수 있어야 한다', () => {
    act(() => useFileStore.getState().setPreviewStatus('text'));
    expect(useFileStore.getState().previewStatus).toBe('text');
  });

  it('setPreviewStatus("binary")로 상태를 설정할 수 있어야 한다', () => {
    act(() => useFileStore.getState().setPreviewStatus('binary'));
    expect(useFileStore.getState().previewStatus).toBe('binary');
  });

  it('setPreviewStatus("too-large")로 상태를 설정할 수 있어야 한다', () => {
    act(() => useFileStore.getState().setPreviewStatus('too-large'));
    expect(useFileStore.getState().previewStatus).toBe('too-large');
  });

  it('setPreviewStatus("html")로 상태를 설정할 수 있어야 한다', () => {
    act(() => useFileStore.getState().setPreviewStatus('html'));
    expect(useFileStore.getState().previewStatus).toBe('html');
  });

  it('setPreviewStatus(null)로 초기화할 수 있어야 한다', () => {
    act(() => useFileStore.getState().setPreviewStatus('text'));
    act(() => useFileStore.getState().setPreviewStatus(null));
    expect(useFileStore.getState().previewStatus).toBeNull();
  });
});

// ─── Phase 2: openFile 파일 분류 로직 ──────────────────────────────────────────

describe('useFileSystem.openFile — 파일 분류 (SPEC-PREVIEW-007)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    useFileStore.setState({
      fileTree: [],
      currentFile: null,
      expandedDirs: new Set(),
      watchedPath: null,
      isLoading: false,
      previewStatus: null,
    });
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
  });

  // ── 시나리오 C: 텍스트 파일 ───────────────────────────────────────────────

  it('시나리오 C: 텍스트 파일 read 성공 → previewStatus="text", content 로드됨', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    vi.mocked(ipc.readFile).mockResolvedValue('file content here');

    const { result } = renderHook(() => useFileSystem());
    await act(async () => {
      await result.current.openFile('/project/main.rs');
    });

    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('text');
    expect(useEditorStore.getState().content).toBe('file content here');
    expect(useFileStore.getState().currentFile).toBe('/project/main.rs');
  });

  it('시나리오 C: .gitignore read 성공 → previewStatus="text"', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    vi.mocked(ipc.readFile).mockResolvedValue('# ignore patterns\n*.log\n');

    const { result } = renderHook(() => useFileSystem());
    await act(async () => {
      await result.current.openFile('/project/.gitignore');
    });

    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('text');
    expect(useEditorStore.getState().content).toBe('# ignore patterns\n*.log\n');
  });

  it('시나리오 C: 확장자 없는 파일(notes) read 성공 → previewStatus="text"', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    vi.mocked(ipc.readFile).mockResolvedValue('some text');

    const { result } = renderHook(() => useFileSystem());
    await act(async () => {
      await result.current.openFile('/project/notes');
    });

    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('text');
  });

  // ── 시나리오 D: 바이너리 파일 ─────────────────────────────────────────────

  it('시나리오 D: 바이너리 파일 readFile reject → previewStatus="binary", content 미로드', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    vi.mocked(ipc.readFile).mockRejectedValue(new Error('invalid utf-8'));

    const { result } = renderHook(() => useFileSystem());
    await act(async () => {
      await result.current.openFile('/project/logo.png');
    });

    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('binary');
    expect(useEditorStore.getState().content).toBe('');
    expect(useFileStore.getState().currentFile).toBe('/project/logo.png');
  });

  it('시나리오 D: 바이너리 파일 reject → 예외가 상위로 전파되지 않는다', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    vi.mocked(ipc.readFile).mockRejectedValue(new Error('stream did not contain valid UTF-8'));

    const { result } = renderHook(() => useFileSystem());
    await expect(
      act(async () => { await result.current.openFile('/project/archive.zip'); })
    ).resolves.not.toThrow();
  });

  // ── 시나리오 F: 기타 read 실패 ──────────────────────────────────────────────

  it('시나리오 F: 권한 오류로 readFile reject → previewStatus="binary"로 흡수, 예외 없음', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    vi.mocked(ipc.readFile).mockRejectedValue(new Error('Permission denied'));

    const { result } = renderHook(() => useFileSystem());
    await expect(
      act(async () => { await result.current.openFile('/project/secret.key'); })
    ).resolves.not.toThrow();

    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('binary');
  });

  // ── 시나리오 E: 대용량 파일 ───────────────────────────────────────────────

  it('시나리오 E: size > 임계값 → readFile 호출되지 않고, previewStatus="too-large"', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    useFileStore.setState({
      fileTree: [
        { name: 'bigfile.bin', path: '/project/bigfile.bin', isDirectory: false, size: FILE_SIZE_THRESHOLD + 1 },
      ],
      currentFile: null,
      expandedDirs: new Set(),
      watchedPath: '/project',
      isLoading: false,
      previewStatus: null,
    });

    const { result } = renderHook(() => useFileSystem());
    await act(async () => {
      await result.current.openFile('/project/bigfile.bin');
    });

    expect(ipc.readFile).not.toHaveBeenCalled();
    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('too-large');
    expect(useFileStore.getState().currentFile).toBe('/project/bigfile.bin');
  });

  it('시나리오 E: size = 임계값-1 → readFile 호출되고 text로 분류 (경계값 하한)', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    vi.mocked(ipc.readFile).mockResolvedValue('content');
    useFileStore.setState({
      fileTree: [
        { name: 'borderfile.txt', path: '/project/borderfile.txt', isDirectory: false, size: FILE_SIZE_THRESHOLD - 1 },
      ],
      currentFile: null,
      expandedDirs: new Set(),
      watchedPath: '/project',
      isLoading: false,
      previewStatus: null,
    });

    const { result } = renderHook(() => useFileSystem());
    await act(async () => {
      await result.current.openFile('/project/borderfile.txt');
    });

    expect(ipc.readFile).toHaveBeenCalled();
    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('text');
  });

  it('시나리오 E: size가 undefined(알 수 없음) → 임계값 가드 건너뜀, readFile 시도', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    vi.mocked(ipc.readFile).mockResolvedValue('content');
    useFileStore.setState({
      fileTree: [
        { name: 'unknown.txt', path: '/project/unknown.txt', isDirectory: false },
      ],
      currentFile: null,
      expandedDirs: new Set(),
      watchedPath: '/project',
      isLoading: false,
      previewStatus: null,
    });

    const { result } = renderHook(() => useFileSystem());
    await act(async () => {
      await result.current.openFile('/project/unknown.txt');
    });

    expect(ipc.readFile).toHaveBeenCalled();
  });

  // ── 시나리오 G: 기존 동작 회귀 차단 ─────────────────────────────────────────

  it('시나리오 G: .html 파일 → previewStatus="html", readFile 미호출 (기존 동작 보존)', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');

    const { result } = renderHook(() => useFileSystem());
    await act(async () => {
      await result.current.openFile('/project/index.html');
    });

    expect(ipc.readFile).not.toHaveBeenCalled();
    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('html');
    expect(useFileStore.getState().currentFile).toBe('/project/index.html');
  });

  it('시나리오 G: .md 파일 → readFile 호출, content 로드, previewStatus="text"', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    vi.mocked(ipc.readFile).mockResolvedValue('# Hello World');

    const { result } = renderHook(() => useFileSystem());
    await act(async () => {
      await result.current.openFile('/project/README.md');
    });

    expect(ipc.readFile).toHaveBeenCalled();
    expect(useEditorStore.getState().content).toBe('# Hello World');
    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('text');
  });

  // ── 엣지 케이스: 연속 클릭 ─────────────────────────────────────────────────

  it('엣지 케이스: text → binary 연속 전환 시 previewStatus가 올바르게 갱신된다', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    vi.mocked(ipc.readFile)
      .mockResolvedValueOnce('text content')
      .mockRejectedValueOnce(new Error('binary'));

    const { result } = renderHook(() => useFileSystem());

    await act(async () => { await result.current.openFile('/project/readme.txt'); });
    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('text');

    await act(async () => { await result.current.openFile('/project/image.png'); });
    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('binary');
  });

  it('엣지 케이스: 빈 파일(0바이트) → text로 분류, content="", 오류 없음', async () => {
    const { useFileSystem } = await import('@/hooks/useFileSystem');
    vi.mocked(ipc.readFile).mockResolvedValue('');
    useFileStore.setState({
      fileTree: [
        { name: 'empty.txt', path: '/project/empty.txt', isDirectory: false, size: 0 },
      ],
      currentFile: null,
      expandedDirs: new Set(),
      watchedPath: '/project',
      isLoading: false,
      previewStatus: null,
    });

    const { result } = renderHook(() => useFileSystem());
    await act(async () => { await result.current.openFile('/project/empty.txt'); });

    expect(useFileStore.getState().previewStatus as PreviewStatus).toBe('text');
    expect(useEditorStore.getState().content).toBe('');
  });
});
