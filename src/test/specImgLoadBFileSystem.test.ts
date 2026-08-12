// @MX:SPEC: SPEC-IMG-LOAD-001
// Group B — UT-B4: 접힌 폴더 내 파일 가드 우회 금지 + N6 fast path 회귀 가드.
// REQ-IMG-LOAD-B-004: findFileNodeSize === undefined(접힌 폴더) → readFileSize IPC 사전 조회 후
//   FILE_SIZE_THRESHOLD 초과 시 too-large 라우팅. 펼쳐진 폴더(nodeSize !== undefined)는
//   기존 size 를 그대로 써서 readFileSize IPC 를 건너뛴다(N6 fast path 회귀 없음).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useFileStore } from '@/store/fileStore';
import { useEditorStore } from '@/store/editorStore';
import { HARD_CEILING } from '@/lib/preview/previewLimits';

const { mockReadFile, mockReadFileSize } = vi.hoisted(() => ({
  mockReadFile: vi.fn().mockResolvedValue('# content'),
  mockReadFileSize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/tauri/ipc', () => ({
  openDirectoryDialog: vi.fn(),
  readDirectory: vi.fn(),
  readFile: mockReadFile,
  writeFile: vi.fn(),
  createFile: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  saveFileAs: vi.fn().mockResolvedValue(null),
  startWatch: vi.fn(),
  stopWatch: vi.fn(),
  registerAssetScope: vi.fn(),
  // SPEC-IMG-LOAD-001 Group B 신규 IPC
  readFileSize: mockReadFileSize,
}));

vi.mock('@/lib/save/saveDocument', () => ({ saveDocument: vi.fn().mockResolvedValue(true) }));

describe('SPEC-IMG-LOAD-001 REQ-B-004 (UT-B4): 접힌 폴더 보호 + N6 fast path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('UT-B4a: 접힌 폴더(findFileNodeSize=undefined) + 대용량(>HARD_CEILING) → readFileSize 사전 호출, too-large 라우팅', async () => {
    // fileTree 가 비어있으므로 findFileNodeSize 는 undefined 반환 (접힌 폴더 시나리오)
    // SPEC-IMG-LOAD-002 REQ-D-005: 임계값이 5MB(FILE_SIZE_THRESHOLD) → 100MB(HARD_CEILING) 로 이동.
    // 본 UT 의 인텐트 (readFileSize 사전 조회 + too-large 라우팅) 는 보존하되 값만 HARD_CEILING+1 로 갱신.
    mockReadFileSize.mockResolvedValue(HARD_CEILING + 1); // > HARD_CEILING(100MB)

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/project/sub/large.md');
    });

    expect(mockReadFileSize).toHaveBeenCalledWith('/project/sub/large.md');
    expect(mockReadFile).not.toHaveBeenCalled(); // too-large → readFile 스킵
    expect(useFileStore.getState().previewStatus).toBe('too-large');
    expect(useEditorStore.getState().content).toBe('');
  });

  it('UT-B4b: 접힌 폴더 + 소형 파일 → readFileSize 사전 호출 후 readFile 진행', async () => {
    mockReadFileSize.mockResolvedValue(100); // 100 bytes < threshold
    mockReadFile.mockResolvedValue('# small doc');

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/project/sub/small.md');
    });

    expect(mockReadFileSize).toHaveBeenCalledWith('/project/sub/small.md');
    expect(mockReadFile).toHaveBeenCalledWith('/project/sub/small.md');
    expect(useEditorStore.getState().content).toBe('# small doc');
    expect(useFileStore.getState().previewStatus).toBe('text');
  });

  it('UT-B4c: 펼쳐진 폴더(nodeSize !== undefined) → readFileSize 미호출 (N6 fast path 회귀 가드)', async () => {
    // fileTree 에 size 가 있는 노드를 직접 넣는다 (펼쳐진 폴더 시나리오)
    // SPEC-IMG-LOAD-002 REQ-D-005: 임계값 5MB → 100MB(HARD_CEILING) 이동 반영.
    const largeSize = HARD_CEILING + 1;
    useFileStore.setState({
      fileTree: [
        { name: 'big.md', path: '/project/big.md', isDirectory: false, size: largeSize },
      ],
    });

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/project/big.md');
    });

    // N6: 펼쳐진 폴더는 IPC 없이 기존 size 사용
    expect(mockReadFileSize).not.toHaveBeenCalled();
    expect(mockReadFile).not.toHaveBeenCalled(); // too-large
    expect(useFileStore.getState().previewStatus).toBe('too-large');
  });

  it('UT-B4d: 펼쳐진 폴더 + 소형 파일 → readFileSize 미호출, readFile 진행 (N6 fast path)', async () => {
    useFileStore.setState({
      fileTree: [
        { name: 'small.md', path: '/project/small.md', isDirectory: false, size: 100 },
      ],
    });
    mockReadFile.mockResolvedValue('# hello');

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/project/small.md');
    });

    expect(mockReadFileSize).not.toHaveBeenCalled();
    expect(mockReadFile).toHaveBeenCalledWith('/project/small.md');
    expect(useFileStore.getState().previewStatus).toBe('text');
  });

  it('UT-B4e: readFileSize IPC 실패 → 예외 흡수 후 readFile 시도 (가드 우회가 아닌 정상 경로)', async () => {
    mockReadFileSize.mockRejectedValue(new Error('stat failed'));
    mockReadFile.mockResolvedValue('# recovered');

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/project/sub/unknown.md');
    });

    expect(mockReadFileSize).toHaveBeenCalled();
    // IPC 실패 시 size 를 알 수 없으므로 too-large 가드를 적용하지 않고 readFile 진행
    expect(mockReadFile).toHaveBeenCalledWith('/project/sub/unknown.md');
    expect(useFileStore.getState().previewStatus).toBe('text');
  });
});
