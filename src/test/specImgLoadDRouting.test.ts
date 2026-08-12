// @MX:SPEC: SPEC-IMG-LOAD-002
// Group D — UT-D1-004/005/007: SOFT/HARD 임계값 기반 라우팅 + 래스터/SVG 제외.
//
// - REQ-IMG-LOAD-2-D-004: SOFT 초과 ~ HARD 이하 → 편집 허용 (too-large 가드 미작동)
// - REQ-IMG-LOAD-2-D-005: HARD 초과 → too-large 라우팅 (UnsupportedFileViewer 정합)
// - REQ-IMG-LOAD-2-D-007: .png/.jpg/.svg 등은 SOFT/HARD/LINE_FOLD 변경 적용 제외 (PREVIEW-008 보존)
//
// 본 테스트는 useFileSystem.openFile 의 size 기반 분기를 직접 주입한다.
// 회귀: SPEC-IMG-LOAD-001 UT-B4 (too-large routing mechanism) 의 INTENT 는 보존하되
// threshold value 가 5MB → HARD_CEILING(100MB) 로 이동했다.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useFileStore } from '@/store/fileStore';
import { useEditorStore } from '@/store/editorStore';
import {
  SOFT_THRESHOLD,
  HARD_CEILING,
} from '@/lib/preview/previewLimits';

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
  readFileSize: mockReadFileSize,
}));

vi.mock('@/lib/save/saveDocument', () => ({ saveDocument: vi.fn().mockResolvedValue(true) }));

describe('SPEC-IMG-LOAD-002 REQ-D-004 (UT-D1-004): SOFT 초과 ~ HARD 이하 → 편집 허용', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('20MB .md 파일 (SOFT<20MB<HARD) → too-large 가드 미작동, readFile 호출, previewStatus=text', async () => {
    const midSize = Math.floor((SOFT_THRESHOLD + HARD_CEILING) / 2); // ~65MB
    mockReadFileSize.mockResolvedValue(midSize);
    mockReadFile.mockResolvedValue('# big but editable');

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/proj/mid.md');
    });

    expect(mockReadFile).toHaveBeenCalledWith('/proj/mid.md');
    expect(useFileStore.getState().previewStatus).toBe('text');
    expect(useEditorStore.getState().content).toBe('# big but editable');
  });

  it('SOFT 경계값 정확히 30MB → 편집 허용 (<=SOFT 도 editable, 회귀 only >HARD 만 too-large)', async () => {
    mockReadFileSize.mockResolvedValue(SOFT_THRESHOLD);
    mockReadFile.mockResolvedValue('content');

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/proj/exact-soft.md');
    });

    expect(mockReadFile).toHaveBeenCalled();
    expect(useFileStore.getState().previewStatus).toBe('text');
  });

  it('SOFT+1 byte (~30MB) → 여전히 편집 허용 (HARD 이하)', async () => {
    mockReadFileSize.mockResolvedValue(SOFT_THRESHOLD + 1);
    mockReadFile.mockResolvedValue('content');

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/proj/just-over-soft.md');
    });

    expect(mockReadFile).toHaveBeenCalled();
    expect(useFileStore.getState().previewStatus).toBe('text');
  });
});

describe('SPEC-IMG-LOAD-002 REQ-D-005 (UT-D1-005): HARD 초과 → too-large 라우팅', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('150MB .md 파일 (HARD 초과) → readFile 미호출, previewStatus=too-large', async () => {
    mockReadFileSize.mockResolvedValue(150 * 1024 * 1024);

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/proj/huge.md');
    });

    expect(mockReadFile).not.toHaveBeenCalled();
    expect(useFileStore.getState().previewStatus).toBe('too-large');
    expect(useEditorStore.getState().content).toBe('');
  });

  it('HARD_CEILING + 1 byte → too-large (경계값 하한, > 비교)', async () => {
    mockReadFileSize.mockResolvedValue(HARD_CEILING + 1);

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/proj/over-hard.md');
    });

    expect(mockReadFile).not.toHaveBeenCalled();
    expect(useFileStore.getState().previewStatus).toBe('too-large');
  });

  it('HARD_CEILING 정확히 → 편집 허용 (<=HARD 은 editable, > 비교)', async () => {
    mockReadFileSize.mockResolvedValue(HARD_CEILING);
    mockReadFile.mockResolvedValue('content');

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/proj/exact-hard.md');
    });

    expect(mockReadFile).toHaveBeenCalled();
    expect(useFileStore.getState().previewStatus).toBe('text');
  });
});

describe('SPEC-IMG-LOAD-002 REQ-D-007 (UT-D1-007): 래스터/SVG 확장자 임계값 제외', () => {
  // PREVIEW-008 회귀 가드: .png/.jpg/.svg 는 SOFT/HARD 임계값 분기를 거치지 않고
  // isRasterImagePath / isSvgPath 분기가 먼저 적중한다.
  beforeEach(() => {
    vi.clearAllMocks();
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

  it.each(['png', 'jpg', 'jpeg', 'gif', 'webp'])(
    '거대 .%s 파일 (HARD 초과) → too-large 가드 우회, previewStatus=text (래스터 라우팅)',
    async (ext) => {
      // 래스터는 파일 크기와 무관하게 asset:// 로 스트리밍 — readFile/readFileSize 모두 미호출
      const { result } = renderHook(() => useFileSystem());

      await act(async () => {
        await result.current.openFile(`/proj/big.${ext}`);
      });

      expect(mockReadFileSize).not.toHaveBeenCalled();
      expect(mockReadFile).not.toHaveBeenCalled();
      expect(useFileStore.getState().previewStatus).toBe('text');
    },
  );

  it('거대 .svg 파일 → SOFT/HARD 가드 우회, readFile 호출 (SVG 소스 뷰 로드)', async () => {
    mockReadFile.mockResolvedValue('<svg></svg>');
    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile('/proj/big.svg');
    });

    // SVG 는 size 가드 이전에 분기되므로 readFileSize 미호출
    expect(mockReadFileSize).not.toHaveBeenCalled();
    // SVG 원본 텍스트는 readFile 로 로드 (SvgFileViewer 소스 뷰용)
    expect(mockReadFile).toHaveBeenCalledWith('/proj/big.svg');
  });
});
