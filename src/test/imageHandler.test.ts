// @MX:SPEC: SPEC-IMG-MODE-001
// Tests for image insert mode: inline-blob vs file-save

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';

// Use vi.hoisted to define mocks before hoisting
const { mockSaveImageFromClipboard, mockCopyImageToFolder } = vi.hoisted(() => {
  return {
    mockSaveImageFromClipboard: vi.fn().mockResolvedValue('./images/1234567890.png'),
    mockCopyImageToFolder: vi.fn().mockResolvedValue('./images/photo.png'),
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
  openImageDialog: vi.fn().mockResolvedValue(null),
  startWatch: vi.fn(),
  stopWatch: vi.fn(),
  saveFileAs: vi.fn(),
  exportSaveDialog: vi.fn(),
  writeBinaryFile: vi.fn(),
}));

import { useUIStore } from '@/store/uiStore';
import { handleImagePaste, handleImageDrop } from '@/lib/image/imageHandler';

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

// UT-6: handleImageDrop always uses file-save regardless of imageInsertMode (REQ-6)
describe('handleImageDrop: always file-save regardless of mode', () => {
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

  it('drop with inline-blob mode: should still call copyImageToFolder (file-save path)', async () => {
    const view = createMockView();
    const event = createDropEvent(true);

    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob' }));
    await handleImageDrop(view as never, event, '/path/to/file.md');

    expect(mockCopyImageToFolder).toHaveBeenCalled();
  });

  it('drop with file-save mode: should call copyImageToFolder', async () => {
    const view = createMockView();
    const event = createDropEvent(true);

    act(() => useUIStore.setState({ imageInsertMode: 'file-save' }));
    await handleImageDrop(view as never, event, '/path/to/file.md');

    expect(mockCopyImageToFolder).toHaveBeenCalled();
  });

  it('drop without path: should use saveImageFromClipboard fallback', async () => {
    const view = createMockView();
    const event = createDropEvent(false);

    act(() => useUIStore.setState({ imageInsertMode: 'inline-blob' }));
    await handleImageDrop(view as never, event, '/path/to/file.md');

    // No path available, falls back to base64 + saveImageFromClipboard
    expect(mockSaveImageFromClipboard).toHaveBeenCalled();
  });
});
