// @MX:SPEC: SPEC-IMG-MODE-001, SPEC-IMG-MODE-002
// Tests for image insert mode: inline-blob vs file-save

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';

// Use vi.hoisted to define mocks before hoisting
const {
  mockSaveImageFromClipboard,
  mockCopyImageToFolder,
  mockReadImageAsBase64,
  mockOpenImageDialog,
} = vi.hoisted(() => {
  return {
    mockSaveImageFromClipboard: vi.fn().mockResolvedValue('./images/1234567890.png'),
    mockCopyImageToFolder: vi.fn().mockResolvedValue('./images/photo.png'),
    // SPEC-IMG-MODE-002: 다이얼로그/드롭 경로의 inline-blob 모드에서 사용
    mockReadImageAsBase64: vi.fn().mockResolvedValue('data:image/png;base64,AAAA'),
    mockOpenImageDialog: vi.fn().mockResolvedValue(null),
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
  saveFileAs: vi.fn(),
  exportSaveDialog: vi.fn(),
  writeBinaryFile: vi.fn(),
}));

import { useUIStore } from '@/store/uiStore';
import { handleImagePaste, handleImageDrop, insertImageFromDialog } from '@/lib/image/imageHandler';

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
