// @MX:SPEC: SPEC-IMG-MODE-001, SPEC-IMG-MODE-002, SPEC-IMG-MODE-003
// Tests for image insert mode: inline-blob vs file-save, plus per-image size-based routing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';

// Use vi.hoisted to define mocks before hoisting
const {
  mockSaveImageFromClipboard,
  mockCopyImageToFolder,
  mockReadImageAsBase64,
  mockOpenImageDialog,
  mockReadFileSize,
  mockSaveFileAs,
} = vi.hoisted(() => {
  return {
    mockSaveImageFromClipboard: vi.fn().mockResolvedValue('./images/1234567890.png'),
    mockCopyImageToFolder: vi.fn().mockResolvedValue('./images/photo.png'),
    // SPEC-IMG-MODE-002: 다이얼로그/드롭 경로의 inline-blob 모드에서 사용
    mockReadImageAsBase64: vi.fn().mockResolvedValue('data:image/png;base64,AAAA'),
    mockOpenImageDialog: vi.fn().mockResolvedValue(null),
    // SPEC-IMG-MODE-003: 다이얼로그 경로 크기 조회 + 지연 Save-As.
    //   기본값은 "소형(100KB)" — 기존 UT-7/8/11 회귀 가드용. 개별 테스트가 mockResolvedValueOnce 로 덮어쓴다.
    //   saveFileAs 기본값은 null (Save-As 취소) — UT-U-001 등에서 path 로 덮어쓴다.
    mockReadFileSize: vi.fn().mockResolvedValue(100 * 1024),
    mockSaveFileAs: vi.fn().mockResolvedValue(null),
  };
});

// Mock Tauri IPC
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock ipc module
vi.mock('@/lib/tauri/ipc', () => ({
  saveImageFromClipboard: mockSaveImageFromClipboard,
  copyImageToFolder: mockCopyImageToFolder,
  readImageAsBase64: mockReadImageAsBase64,
  openImageDialog: mockOpenImageDialog,
  startWatch: vi.fn(),
  stopWatch: vi.fn(),
  saveFileAs: mockSaveFileAs,
  readFileSize: mockReadFileSize,
  exportSaveDialog: vi.fn(),
  writeBinaryFile: vi.fn(),
}));

import { useUIStore } from '@/store/uiStore';
import {
  handleImagePaste,
  handleImageDrop,
  insertImageFromDialog,
  insertImageFile,
  resolveImageRoute,
} from '@/lib/image/imageHandler';
import { IMAGE_INLINE_THRESHOLD, LINE_FOLD_THRESHOLD } from '@/lib/preview/previewLimits';

// UT-1: Default mode is inline-blob (REQ-1)
describe('uiStore: imageInsertMode', () => {
  beforeEach(() => {
    act(() => {
      useUIStore.setState({
        imageInsertMode: 'inline-blob',
      });
    });
  });

  it('should have default imageInsertMode of "inline-blob"', () => {
    const state = useUIStore.getState();
    expect(state.imageInsertMode).toBe('inline-blob');
  });

  it('should set imageInsertMode to "file-save"', () => {
    const { setImageInsertMode } = useUIStore.getState();
    act(() => setImageInsertMode('file-save'));
    expect(useUIStore.getState().imageInsertMode).toBe('file-save');
  });

  it('should set imageInsertMode back to "inline-blob"', () => {
    act(() => useUIStore.setState({ imageInsertMode: 'file-save' }));
    const { setImageInsertMode } = useUIStore.getState();
    act(() => setImageInsertMode('inline-blob'));
    expect(useUIStore.getState().imageInsertMode).toBe('inline-blob');
  });
});

// UT-2: inline-blob mode inserts data URI without calling saveImageFromClipboard (REQ-2)
// UT-3: file-save mode calls saveImageFromClipboard and inserts file path (REQ-3)
describe('handleImagePaste: imageInsertMode behavior', () => {
  // Helper to create a minimal EditorView mock
  function createMockView() {
    return {
      dispatch: vi.fn(),
      state: { selection: { main: { head: 0 } } },
    };
  }

  // Helper to create a ClipboardEvent with a fake image file
  function createClipboardEvent(mimeType: string = 'image/png'): ClipboardEvent {
    const file = new File(['fake-image-data'], 'test.png', { type: mimeType });
    const item = {
      type: mimeType,
      getAsFile: () => file,
    };
    return {
      preventDefault: vi.fn(),
      clipboardData: {
        items: [item],
      },
    } as unknown as ClipboardEvent;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob' }));
  });

  it('inline-blob mode: should NOT call saveImageFromClipboard', async () => {
    const view = createMockView();
    const event = createClipboardEvent();

    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob' }));
    const handled = await handleImagePaste(view as never, event, '/path/to/file.md');

    expect(handled).toBe(true);
    expect(mockSaveImageFromClipboard).not.toHaveBeenCalled();
  });

  it('inline-blob mode: should insert data URI markdown', async () => {
    const view = createMockView();
    const event = createClipboardEvent();

    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob' }));
    await handleImagePaste(view as never, event, '/path/to/file.md');

    expect(view.dispatch).toHaveBeenCalledOnce();
    const dispatchCall = view.dispatch.mock.calls[0][0];
    const insertedText: string = dispatchCall.changes.insert as string;
    expect(insertedText).toMatch(/^!\[image\]\(data:image\//);
    expect(insertedText).toContain('base64,');
  });

  it('file-save mode: should call saveImageFromClipboard', async () => {
    const view = createMockView();
    const event = createClipboardEvent();

    act(() => useUIStore.setState({ imageInsertMode: 'file-save' }));
    const handled = await handleImagePaste(view as never, event, '/path/to/file.md');

    expect(handled).toBe(true);
    expect(mockSaveImageFromClipboard).toHaveBeenCalledOnce();
  });

  it('file-save mode: should insert file path markdown', async () => {
    const view = createMockView();
    const event = createClipboardEvent();

    act(() => useUIStore.setState({ imageInsertMode: 'file-save' }));
    await handleImagePaste(view as never, event, '/path/to/file.md');

    expect(view.dispatch).toHaveBeenCalledOnce();
    const dispatchCall = view.dispatch.mock.calls[0][0];
    const insertedText: string = dispatchCall.changes.insert as string;
    expect(insertedText).toBe('![image](./images/1234567890.png)');
  });

  it('should return false when no image in clipboard', async () => {
    const view = createMockView();
    const event = {
      preventDefault: vi.fn(),
      clipboardData: {
        items: [{ type: 'text/plain', getAsFile: () => null }],
      },
    } as unknown as ClipboardEvent;

    const handled = await handleImagePaste(view as never, event, '/path/to/file.md');
    expect(handled).toBe(false);
  });
});

// SPEC-IMG-MODE-002: 드롭 경로 모드 인지 (REQ-003/004/006).
// 기존 UT-6 ("drop always file-save regardless of mode")은 폐기됨 — 행동 반전 증거.
describe('handleImageDrop: imageInsertMode behavior', () => {
  function createMockView() {
    return {
      dispatch: vi.fn(),
      state: { selection: { main: { head: 0 } } },
      posAtCoords: vi.fn().mockReturnValue(0),
    };
  }

  function createDropEvent(withPath: boolean = false): DragEvent {
    const file = Object.assign(
      new File(['fake'], 'photo.png', { type: 'image/png' }),
      withPath ? { path: '/absolute/path/photo.png' } : {}
    );
    return {
      preventDefault: vi.fn(),
      clientX: 0,
      clientY: 0,
      dataTransfer: {
        files: [file],
      },
    } as unknown as DragEvent;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // UT-9: 드롭 + inline-blob + path → readImageAsBase64 호출, copyImageToFolder 미호출, data URI 삽입 (REQ-003)
  it('inline-blob mode + path: should call readImageAsBase64, not copyImageToFolder', async () => {
    const view = createMockView();
    const event = createDropEvent(true);

    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob' }));
    await handleImageDrop(view as never, event, '/path/to/file.md');

    expect(mockReadImageAsBase64).toHaveBeenCalledWith('/absolute/path/photo.png');
    expect(mockCopyImageToFolder).not.toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledOnce();
    const dispatchCall = view.dispatch.mock.calls[0][0];
    const insertedText: string = dispatchCall.changes.insert as string;
    expect(insertedText).toMatch(/^!\[photo\]\(data:image\//);
    expect(insertedText).toContain('base64,');
  });

  // UT-10: 드롭 + file-save + path → copyImageToFolder 호출 (기존 동작 유지, REQ-004)
  it('file-save mode + path: should call copyImageToFolder (existing behavior)', async () => {
    const view = createMockView();
    const event = createDropEvent(true);

    act(() => useUIStore.setState({ imageInsertMode: 'file-save' }));
    await handleImageDrop(view as never, event, '/path/to/file.md');

    expect(mockCopyImageToFolder).toHaveBeenCalledWith('/absolute/path/photo.png', '/path/to/file.md');
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledOnce();
  });

  // UT-10b: 드롭 + file-save + path 없음 (DOM 폴백) → saveImageFromClipboard 호출 (기존 동작, REQ-004 보강)
  // 구 UT-6 의 세 번째 케이스가 비의도적으로 커버하던 분기 회귀 방어.
  it('file-save mode + no path (DOM fallback): should call saveImageFromClipboard', async () => {
    const view = createMockView();
    const event = createDropEvent(false);

    act(() => useUIStore.setState({ imageInsertMode: 'file-save' }));
    await handleImageDrop(view as never, event, '/path/to/file.md');

    expect(mockSaveImageFromClipboard).toHaveBeenCalledWith('/path/to/file.md', expect.any(String));
    expect(mockCopyImageToFolder).not.toHaveBeenCalled();
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledOnce();
  });

  // UT-12: 드롭 + inline-blob + path 없음 (DOM 폴백) → fileToBase64 data URI, saveImageFromClipboard 미호출 (REQ-006)
  it('inline-blob mode + no path (DOM fallback): should use data URI, not saveImageFromClipboard', async () => {
    const view = createMockView();
    const event = createDropEvent(false);

    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob' }));
    await handleImageDrop(view as never, event, '/path/to/file.md');

    expect(mockSaveImageFromClipboard).not.toHaveBeenCalled();
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
    expect(mockCopyImageToFolder).not.toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledOnce();
    const dispatchCall = view.dispatch.mock.calls[0][0];
    const insertedText: string = dispatchCall.changes.insert as string;
    expect(insertedText).toMatch(/^!\[photo\]\(data:image\//);
  });
});

// SPEC-IMG-MODE-002: 다이얼로그 경로 모드 인지 (REQ-001/002/005).
describe('insertImageFromDialog: imageInsertMode behavior', () => {
  function createMockView() {
    return {
      dispatch: vi.fn(),
      state: { selection: { main: { head: 0 } } },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // 다이얼로그 취소가 기본값 — 개별 테스트에서 mockResolvedValueOnce 로 덮어쓴다
    mockOpenImageDialog.mockResolvedValue(null);
  });

  // UT-7: 다이얼로그 + inline-blob → readImageAsBase64 호출, copyImageToFolder 미호출, data URI 삽입 (REQ-001)
  it('inline-blob mode: should call readImageAsBase64 and insert data URI', async () => {
    const view = createMockView();
    mockOpenImageDialog.mockResolvedValueOnce('/path/to/photo.png');

    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob' }));
    await insertImageFromDialog(view as never, '/path/to/file.md');

    expect(mockReadImageAsBase64).toHaveBeenCalledWith('/path/to/photo.png');
    expect(mockCopyImageToFolder).not.toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledOnce();
    const dispatchCall = view.dispatch.mock.calls[0][0];
    const insertedText: string = dispatchCall.changes.insert as string;
    expect(insertedText).toBe('![photo](data:image/png;base64,AAAA)');
  });

  // UT-8: 다이얼로그 + file-save → copyImageToFolder 호출 (기존 동작 유지, REQ-002)
  it('file-save mode: should call copyImageToFolder (existing behavior)', async () => {
    const view = createMockView();
    mockOpenImageDialog.mockResolvedValueOnce('/path/to/photo.png');

    act(() => useUIStore.setState({ imageInsertMode: 'file-save' }));
    await insertImageFromDialog(view as never, '/path/to/file.md');

    expect(mockCopyImageToFolder).toHaveBeenCalledWith('/path/to/photo.png', '/path/to/file.md');
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledOnce();
    const dispatchCall = view.dispatch.mock.calls[0][0];
    const insertedText: string = dispatchCall.changes.insert as string;
    expect(insertedText).toBe('![photo](./images/photo.png)');
  });

  // UT-11: 다이얼로그 취소 (null 반환) → dispatch 없음, 어떤 IPC 도 호출 없음 (REQ-005)
  it('dialog cancel (null): should not dispatch or call any IPC', async () => {
    const view = createMockView();
    mockOpenImageDialog.mockResolvedValueOnce(null);

    await insertImageFromDialog(view as never, '/path/to/file.md');

    expect(view.dispatch).not.toHaveBeenCalled();
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
    expect(mockCopyImageToFolder).not.toHaveBeenCalled();
    expect(mockSaveImageFromClipboard).not.toHaveBeenCalled();
  });
});

// ============================================================
// SPEC-IMG-LOAD-002 REQ-A-005 (UT-A1-005): 이미지 삽입 시 폴딩 힌트
//   insertImageMarkdown 이 LINE_FOLD_THRESHOLD 초과 라인을 만들면
//   foldEffect dispatch 를 추가로 발행한다. paste/drop×2/dialog 4개 호출부가
//   모두 insertImageMarkdown 으로 funnel 되므로 이 헬퍼에서 일관 적용한다 (001 REQ-IMG-LOAD-A-004 대칭).
// ============================================================

describe('SPEC-IMG-LOAD-002 REQ-A-005 (UT-A1-005): insertImageMarkdown 폴딩 힌트', () => {
  function createMockViewWithDoc(docText: string = '') {
    // CodeMirror Text 인터페이스 흉내 — lineAt(pos) 반환
    const lines = docText.split('\n');
    const lineFroms: number[] = [];
    let acc = 0;
    for (const ln of lines) {
      lineFroms.push(acc);
      acc += ln.length + 1; // +1 for \n
    }
    return {
      dispatch: vi.fn(),
      state: {
        selection: { main: { head: docText.length } },
        doc: {
          length: docText.length,
          lineAt: (pos: number) => {
            // 가장 가까운 line start 반환
            for (let i = lineFroms.length - 1; i >= 0; i--) {
              if (lineFroms[i] <= pos) {
                const text = lines[i] ?? '';
                return { from: lineFroms[i], to: lineFroms[i] + text.length, length: text.length };
              }
            }
            return { from: 0, to: 0, length: 0 };
          },
        },
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob' }));
  });

  it('짧은 data URI (< LINE_FOLD_THRESHOLD) 삽입 → changes 만 dispatch (effects 없음)', async () => {
    const { insertImageMarkdown } = await import('@/lib/image/imageHandler');
    const view = createMockViewWithDoc('');
    const shortDataUri = 'data:image/png;base64,' + 'A'.repeat(100);
    insertImageMarkdown(view as never, shortDataUri, 'image', 0);

    // 단일 dispatch — effects 없음
    expect(view.dispatch).toHaveBeenCalledTimes(1);
    const call = view.dispatch.mock.calls[0][0];
    expect(call.changes).toBeDefined();
    expect(call.effects).toBeUndefined();
  });

  it('거대 data URI (> LINE_FOLD_THRESHOLD) 삽입 → fold effects 가 changes 와 동일 dispatch 에 결합', async () => {
    const { insertImageMarkdown, LINE_FOLD_THRESHOLD } = await import('@/lib/image/imageHandler');
    const view = createMockViewWithDoc('');
    // threshold + 1 길이의 data URI (pre-dispatch prediction 으로 fold 유발)
    const huge = 'data:image/png;base64,' + 'A'.repeat(LINE_FOLD_THRESHOLD + 1);
    insertImageMarkdown(view as never, huge, 'image', 0);

    // 단일 dispatch 에 changes + effects 가 모두结합 (D2 — foldEffect dispatch 패턴)
    expect(view.dispatch).toHaveBeenCalledTimes(1);
    const call = view.dispatch.mock.calls[0][0];
    expect(call.changes).toBeDefined();
    expect(call.effects).toBeDefined();
  });

  it('두 UI 진입점(toolbar/Cmd+Shift+I) 모두 동일한 insertImageMarkdown 으로 funnel', async () => {
    // 본 단언은 funnel 구조를 코드 리뷰로 이미 확인했으므로, 헬퍼 호출 1회당 dispatch 일관성만 검증.
    const { insertImageMarkdown } = await import('@/lib/image/imageHandler');
    const view = createMockViewWithDoc('');
    insertImageMarkdown(view as never, 'data:image/png;base64,short', 'image', 0);
    expect(view.dispatch).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// SPEC-IMG-MODE-003: per-image 크기 기반 라우팅 (size-based routing)
//   IMAGE_INLINE_THRESHOLD(2MB) 이상 이미지는 모드 무관 file-save 로 라우팅.
//   소형 이미지는 기존 imageInsertMode 분기(MODE-001/002) 보존.
//   3개 진입점(붙여넣기/드롭/다이얼로그)이 동일한 resolveImageRoute helper 를 거친다(REQ-R-002).
//
// 크기 분류:
//   SMALL  = 100KB    (<< IMAGE_INLINE_THRESHOLD=2MB — 회귀 가드)
//   LARGE  = 5MB      (> IMAGE_INLINE_THRESHOLD, < MAX_IMAGE_SIZE=10MB — file-save 정상)
//   OVER_MAX = 12MB   (> MAX_IMAGE_SIZE=10MB — Rust file-save 거부 → toast)
// ============================================================

const SMALL_SIZE = 100 * 1024;
const LARGE_SIZE = 5 * 1024 * 1024;
const OVER_MAX_SIZE = 12 * 1024 * 1024;
// TS mirror of Rust MAX_IMAGE_SIZE (image_ops.rs:12). T-001 제약 검증 용도.
const MAX_IMAGE_SIZE_TS = 10 * 1024 * 1024;

describe('SPEC-IMG-MODE-003 UT-T-001: IMAGE_INLINE_THRESHOLD 상수 (REQ-T-001)', () => {
  it('IMAGE_INLINE_THRESHOLD 값은 OD-1 확정값인 2MB(2,097,152 bytes)이어야 한다', () => {
    expect(IMAGE_INLINE_THRESHOLD).toBe(2 * 1024 * 1024);
  });
  it('IMAGE_INLINE_THRESHOLD >= LINE_FOLD_THRESHOLD(1MB) — 하위 이웃 제약', () => {
    expect(IMAGE_INLINE_THRESHOLD).toBeGreaterThanOrEqual(LINE_FOLD_THRESHOLD);
  });
  it('IMAGE_INLINE_THRESHOLD < MAX_IMAGE_SIZE(10MB) — 상위 이웃 제약 (사각지대 방지)', () => {
    expect(IMAGE_INLINE_THRESHOLD).toBeLessThan(MAX_IMAGE_SIZE_TS);
  });
});

describe('SPEC-IMG-MODE-003 UT-R-002/UT-R-BOUNDARY: resolveImageRoute helper (REQ-R-001/R-002)', () => {
  it('UT-R-002: 대형 이미지는 모드 무관 file 로 라우팅 (3 진입점 대칭)', async () => {
    expect(await resolveImageRoute({ mode: 'inline-blob', sizeInBytes: LARGE_SIZE })).toBe('file');
    expect(await resolveImageRoute({ mode: 'file-save', sizeInBytes: LARGE_SIZE })).toBe('file');
  });
  it('소형 이미지는 사용자 모드를 존중한다 (inline-blob → inline, file-save → file)', async () => {
    expect(await resolveImageRoute({ mode: 'inline-blob', sizeInBytes: SMALL_SIZE })).toBe('inline');
    expect(await resolveImageRoute({ mode: 'file-save', sizeInBytes: SMALL_SIZE })).toBe('file');
  });
  it('UT-R-BOUNDARY: 임계값 -1 byte → 소형 (사용자 모드 존중)', async () => {
    expect(await resolveImageRoute({ mode: 'inline-blob', sizeInBytes: IMAGE_INLINE_THRESHOLD - 1 })).toBe('inline');
  });
  it('UT-R-BOUNDARY: 임계값 정확히 → 대형 (REQ-R-001 "이상" — >= 연산자)', async () => {
    expect(await resolveImageRoute({ mode: 'inline-blob', sizeInBytes: IMAGE_INLINE_THRESHOLD })).toBe('file');
  });
  it('UT-R-BOUNDARY: 임계값 +1 byte → 대형', async () => {
    expect(await resolveImageRoute({ mode: 'inline-blob', sizeInBytes: IMAGE_INLINE_THRESHOLD + 1 })).toBe('file');
  });
});

// --- 붙여넣기 경로 (insertImageFile) ---
describe('SPEC-IMG-MODE-003: paste routing (UT-R-001a/b, UT-R-003a, UT-U-001/002/003, UT-E-001)', () => {
  function createMockView() {
    return {
      dispatch: vi.fn(),
      state: {
        selection: { main: { head: 0 } },
        doc: { toString: () => '' },
      },
    };
  }
  // DOM File 의 size 속성을 임의 값으로 override (실제 content 는 'x' 로 작게 유지 — 테스트 성능).
  function createImageFile(size: number, name = 'test.png'): File {
    const file = new File(['x'], name, { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: size, configurable: true });
    return file;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob', statusMessage: null }));
  });

  it('UT-R-001a: 붙여넣기 + 소형 + inline-blob → data URI (MODE-002 회귀 가드)', async () => {
    const view = createMockView();
    const file = createImageFile(SMALL_SIZE);
    await insertImageFile(view as never, file, '/path/to/file.md');
    expect(mockSaveImageFromClipboard).not.toHaveBeenCalled();
    const insertedText: string = view.dispatch.mock.calls[0][0].changes.insert;
    expect(insertedText).toMatch(/^!\[image\]\(data:image\//);
  });

  it('UT-R-001b: 붙여넣기 + 대형 + inline-blob → saveImageFromClipboard 호출, data URI 아님', async () => {
    const view = createMockView();
    const file = createImageFile(LARGE_SIZE);
    await insertImageFile(view as never, file, '/path/to/file.md');
    expect(mockSaveImageFromClipboard).toHaveBeenCalledWith('/path/to/file.md', expect.any(String));
    const insertedText: string = view.dispatch.mock.calls[0][0].changes.insert;
    expect(insertedText).not.toMatch(/data:image\//);
    expect(insertedText).toContain('./images/');
  });

  it('UT-R-003a: 붙여넣기는 file.size 를 읽고 readFileSize IPC 를 호출하지 않는다 (동기 DOM 경로)', async () => {
    const view = createMockView();
    const file = createImageFile(LARGE_SIZE);
    await insertImageFile(view as never, file, '/path/to/file.md');
    expect(mockReadFileSize).not.toHaveBeenCalled();
  });

  it('UT-U-001: 붙여넣기 + 대형 + inline-blob + 미저장 → saveFileAs 1회 호출 후 file-save', async () => {
    const view = createMockView();
    const file = createImageFile(LARGE_SIZE);
    mockSaveFileAs.mockResolvedValueOnce('/saved/path.md');
    await insertImageFile(view as never, file, '');
    expect(mockSaveFileAs).toHaveBeenCalledTimes(1);
    expect(mockSaveImageFromClipboard).toHaveBeenCalledWith('/saved/path.md', expect.any(String));
    expect(view.dispatch).toHaveBeenCalledTimes(1);
  });

  it('UT-U-001 변형: 붙여넣기 + 대형 + 미저장 + Save-As 취소 → no-op (inline-blob 회귀 금지, BD-1)', async () => {
    const view = createMockView();
    const file = createImageFile(LARGE_SIZE);
    mockSaveFileAs.mockResolvedValueOnce(null);
    const result = await insertImageFile(view as never, file, '');
    expect(mockSaveFileAs).toHaveBeenCalledTimes(1);
    expect(mockSaveImageFromClipboard).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('UT-U-002: 붙여넣기 + 소형 + inline-blob + 미저장 → saveFileAs 미호출 (Group A 보존)', async () => {
    const view = createMockView();
    const file = createImageFile(SMALL_SIZE);
    await insertImageFile(view as never, file, '');
    expect(mockSaveFileAs).not.toHaveBeenCalled();
    const insertedText: string = view.dispatch.mock.calls[0][0].changes.insert;
    expect(insertedText).toMatch(/^!\[image\]\(data:image\//);
  });

  it('UT-U-003: 붙여넣기 + 대형 + 저장된 문서 → file-save, saveFileAs 미호출 (REQ-A-003 보존)', async () => {
    const view = createMockView();
    const file = createImageFile(LARGE_SIZE);
    await insertImageFile(view as never, file, '/path/to/file.md');
    expect(mockSaveFileAs).not.toHaveBeenCalled();
    expect(mockSaveImageFromClipboard).toHaveBeenCalledWith('/path/to/file.md', expect.any(String));
  });

  it('UT-E-001: 붙여넣기 + >10MB → file-save 거부 시 toast 표시, silent no-op 금지, inline-blob 폴백 금지', async () => {
    const view = createMockView();
    const file = createImageFile(OVER_MAX_SIZE);
    mockSaveImageFromClipboard.mockRejectedValueOnce(new Error('image exceeds 10MB limit'));
    await insertImageFile(view as never, file, '/path/to/file.md');
    expect(mockSaveImageFromClipboard).toHaveBeenCalled();
    // REQ-E-001: 사용자 가시 에러 표시
    const statusMessage = useUIStore.getState().statusMessage;
    expect(statusMessage).not.toBeNull();
    expect(statusMessage).toContain('10MB');
    // silent no-op 금지 — toast 가 떴으므로 ok. inline-blob 폴백 금지 — data URI dispatch 없음.
    if (view.dispatch.mock.calls.length > 0) {
      const insertedText: string = view.dispatch.mock.calls[0][0].changes.insert;
      expect(insertedText).not.toMatch(/data:image\//);
    }
  });
});

// --- 다이얼로그 경로 (insertImageFromDialog) ---
describe('SPEC-IMG-MODE-003: dialog routing (UT-R-001e/f, UT-R-003b/c, UT-U-001/002, UT-N-002, UT-E-001)', () => {
  function createMockView() {
    return {
      dispatch: vi.fn(),
      state: {
        selection: { main: { head: 0 } },
        doc: { toString: () => '' },
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenImageDialog.mockResolvedValue(null);
    mockReadFileSize.mockResolvedValue(SMALL_SIZE);
    mockSaveFileAs.mockResolvedValue(null);
    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob', statusMessage: null }));
  });

  it('UT-R-001e: 다이얼로그 + 소형 + inline-blob → readImageAsBase64 호출 (UT-7 회귀 가드)', async () => {
    const view = createMockView();
    mockOpenImageDialog.mockResolvedValueOnce('/path/to/photo.png');
    mockReadFileSize.mockResolvedValueOnce(SMALL_SIZE);
    await insertImageFromDialog(view as never, '/path/to/file.md');
    expect(mockReadFileSize).toHaveBeenCalledWith('/path/to/photo.png');
    expect(mockReadImageAsBase64).toHaveBeenCalledWith('/path/to/photo.png');
    expect(mockCopyImageToFolder).not.toHaveBeenCalled();
  });

  it('UT-R-001f: 다이얼로그 + 대형 + inline-blob → copyImageToFolder 호출, readImageAsBase64 미호출', async () => {
    const view = createMockView();
    mockOpenImageDialog.mockResolvedValueOnce('/path/to/photo.png');
    mockReadFileSize.mockResolvedValueOnce(LARGE_SIZE);
    await insertImageFromDialog(view as never, '/path/to/file.md');
    expect(mockReadFileSize).toHaveBeenCalledWith('/path/to/photo.png');
    expect(mockCopyImageToFolder).toHaveBeenCalledWith('/path/to/photo.png', '/path/to/file.md');
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
  });

  it('UT-R-003b: 다이얼로그는 readFileSize IPC 를 호출한다 (네이티브 경로 크기 조회)', async () => {
    const view = createMockView();
    mockOpenImageDialog.mockResolvedValueOnce('/path/to/photo.png');
    mockReadFileSize.mockResolvedValueOnce(SMALL_SIZE);
    await insertImageFromDialog(view as never, '/path/to/file.md');
    expect(mockReadFileSize).toHaveBeenCalledWith('/path/to/photo.png');
  });

  it('UT-R-003c (BD-1): 다이얼로그 + readFileSize 거부 → copyImageToFolder 폴백, readImageAsBase64 미호출', async () => {
    const view = createMockView();
    mockOpenImageDialog.mockResolvedValueOnce('/path/to/photo.png');
    mockReadFileSize.mockRejectedValueOnce(new Error('IPC error'));
    await insertImageFromDialog(view as never, '/path/to/file.md');
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
    expect(mockCopyImageToFolder).toHaveBeenCalledWith('/path/to/photo.png', '/path/to/file.md');
  });

  it('UT-R-003c 변형 (BD-1): 다이얼로그 + readFileSize 거부 + 미저장 + Save-As 취소 → no-op', async () => {
    const view = createMockView();
    mockOpenImageDialog.mockResolvedValueOnce('/path/to/photo.png');
    mockReadFileSize.mockRejectedValueOnce(new Error('IPC error'));
    mockSaveFileAs.mockResolvedValueOnce(null);
    await insertImageFromDialog(view as never, '');
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
    expect(mockCopyImageToFolder).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it('UT-U-001 (다이얼로그): 대형 + inline-blob + 미저장 → saveFileAs 1회 호출 후 file-save', async () => {
    const view = createMockView();
    mockOpenImageDialog.mockResolvedValueOnce('/path/to/photo.png');
    mockReadFileSize.mockResolvedValueOnce(LARGE_SIZE);
    mockSaveFileAs.mockResolvedValueOnce('/saved/path.md');
    await insertImageFromDialog(view as never, '');
    expect(mockSaveFileAs).toHaveBeenCalledTimes(1);
    expect(mockCopyImageToFolder).toHaveBeenCalledWith('/path/to/photo.png', '/saved/path.md');
  });

  it('UT-U-002 (다이얼로그): 소형 + inline-blob + 미저장 → saveFileAs 미호출 (Group A 보존)', async () => {
    const view = createMockView();
    mockOpenImageDialog.mockResolvedValueOnce('/path/to/photo.png');
    mockReadFileSize.mockResolvedValueOnce(SMALL_SIZE);
    await insertImageFromDialog(view as never, '');
    expect(mockSaveFileAs).not.toHaveBeenCalled();
    expect(mockReadImageAsBase64).toHaveBeenCalledWith('/path/to/photo.png');
  });

  it('UT-N-002 + UT-E-001 (다이얼로그): >10MB → file-save 거부 → toast 표시, inline-blob 폴백 금지', async () => {
    const view = createMockView();
    mockOpenImageDialog.mockResolvedValueOnce('/path/to/photo.png');
    mockReadFileSize.mockResolvedValueOnce(OVER_MAX_SIZE);
    mockCopyImageToFolder.mockRejectedValueOnce(new Error('image exceeds 10MB'));
    await insertImageFromDialog(view as never, '/path/to/file.md');
    expect(mockCopyImageToFolder).toHaveBeenCalled();
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
    const statusMessage = useUIStore.getState().statusMessage;
    expect(statusMessage).not.toBeNull();
    expect(statusMessage).toContain('10MB');
  });
});

// --- 드롭 경로 (handleImageDrop) — 지연 Save-As 불필요 (MarkdownEditor.tsx:280 게이트) ---
describe('SPEC-IMG-MODE-003: drop routing (UT-R-001c/d)', () => {
  function createMockView() {
    return {
      dispatch: vi.fn(),
      state: { selection: { main: { head: 0 } } },
      posAtCoords: vi.fn().mockReturnValue(0),
    };
  }
  function createDropEvent(opts: { size: number; withPath?: boolean }): DragEvent {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: opts.size, configurable: true });
    const enhanced = opts.withPath
      ? Object.assign(file, { path: '/absolute/path/photo.png' })
      : file;
    return {
      preventDefault: vi.fn(),
      clientX: 0,
      clientY: 0,
      dataTransfer: { files: [enhanced] },
    } as unknown as DragEvent;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob', statusMessage: null }));
  });

  it('UT-R-001c: 드롭 + 소형 + inline-blob + path → readImageAsBase64 (UT-9 회귀 가드)', async () => {
    const view = createMockView();
    const event = createDropEvent({ size: SMALL_SIZE, withPath: true });
    await handleImageDrop(view as never, event, '/path/to/file.md');
    expect(mockReadImageAsBase64).toHaveBeenCalledWith('/absolute/path/photo.png');
    expect(mockCopyImageToFolder).not.toHaveBeenCalled();
  });

  it('UT-R-001d: 드롭 + 대형 + inline-blob + path → copyImageToFolder 호출, readImageAsBase64 미호출', async () => {
    const view = createMockView();
    const event = createDropEvent({ size: LARGE_SIZE, withPath: true });
    await handleImageDrop(view as never, event, '/path/to/file.md');
    expect(mockCopyImageToFolder).toHaveBeenCalledWith('/absolute/path/photo.png', '/path/to/file.md');
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
  });

  it('UT-R-001d 변형: 드롭 + 대형 + inline-blob + path 없음 → saveImageFromClipboard 호출 (DOM 폴백)', async () => {
    const view = createMockView();
    const event = createDropEvent({ size: LARGE_SIZE, withPath: false });
    await handleImageDrop(view as never, event, '/path/to/file.md');
    expect(mockSaveImageFromClipboard).toHaveBeenCalledWith('/path/to/file.md', expect.any(String));
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
    expect(mockCopyImageToFolder).not.toHaveBeenCalled();
  });

  it('UT-N-001 + UT-R-001c: 드롭 + 소형 + inline-blob + path 없음 → data URI (UT-12 회귀 가드)', async () => {
    const view = createMockView();
    const event = createDropEvent({ size: SMALL_SIZE, withPath: false });
    await handleImageDrop(view as never, event, '/path/to/file.md');
    expect(mockSaveImageFromClipboard).not.toHaveBeenCalled();
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
    const insertedText: string = view.dispatch.mock.calls[0][0].changes.insert;
    expect(insertedText).toMatch(/^!\[photo\]\(data:image\//);
  });
});
