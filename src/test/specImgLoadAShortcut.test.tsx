// @MX:SPEC: SPEC-IMG-LOAD-001
// Group A — UT-A4: MarkdownEditor `Mod-Shift-i` 키보드 단축키 진입점 모드 인지 분기.
// REQ-IMG-LOAD-A-004 (두 진입점 대칭) — AppLayout case 'image' 와 동일한 분기를 가져야 한다.
//
// imagePasteGuard.test.tsx 와 동일한 CodeMirror 모킹 패턴을 사용해 keymap.of 호출에서
// Mod-Shift-i 핸들러를 추출한 뒤, 각 모드/경로 조건에서 올바른 IPC 호출 패턴을 내는지 단언한다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useEditorStore } from '@/store/editorStore';
import { useUIStore } from '@/store/uiStore';
import { useFileStore } from '@/store/fileStore';

// ---- 캡처용 mock ----
const { mockSaveFileAs, mockInsertImageFromDialog } = vi.hoisted(() => ({
  mockSaveFileAs: vi.fn().mockResolvedValue('/saved/doc.md'),
  mockInsertImageFromDialog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }));

vi.mock('@/lib/tauri/ipc', () => ({
  saveFileAs: mockSaveFileAs,
  readFile: vi.fn(),
  writeFile: vi.fn(),
  createFile: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  readDirectory: vi.fn(),
  openDirectoryDialog: vi.fn(),
  startWatch: vi.fn(),
  stopWatch: vi.fn(),
  registerAssetScope: vi.fn(),
  saveImageFromClipboard: vi.fn(),
  copyImageToFolder: vi.fn(),
  readImageAsBase64: vi.fn(),
  openImageDialog: vi.fn(),
}));

vi.mock('@/lib/image/imageHandler', () => ({
  insertImageFromDialog: mockInsertImageFromDialog,
  handleImagePaste: vi.fn(),
  handleImageDrop: vi.fn(),
  decideImageInsert: vi.fn(() => 'ignore'),
  extractImageFile: vi.fn(() => null),
  insertImageFile: vi.fn(),
}));

vi.mock('@/lib/save/saveDocument', () => ({ saveDocument: vi.fn().mockResolvedValue(true) }));

// ---- CodeMirror 모킹 (imagePasteGuard.test.tsx 패턴) ----
vi.mock('@codemirror/search', () => ({
  openSearchPanel: vi.fn(),
  search: vi.fn().mockReturnValue({}),
  searchKeymap: [],
}));

vi.mock('@codemirror/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codemirror/state')>();
  class MockEditorState {
    doc = { toString: () => '' };
    selection = { main: { head: 0 } };
    static create = vi.fn().mockImplementation(() => new MockEditorState());
    lineAt = vi.fn().mockReturnValue({ number: 1, from: 0 });
  }
  return { ...actual, EditorState: MockEditorState };
});

let keymapOfMock: ReturnType<typeof vi.fn>;
let domEventHandlersMock: ReturnType<typeof vi.fn>;

vi.mock('@codemirror/view', async () => {
  keymapOfMock = vi.fn().mockReturnValue({ extension: 'keymap' });
  domEventHandlersMock = vi.fn().mockReturnValue({ extension: 'dom-event-handlers' });

  class MockEditorView {
    dom: HTMLElement;
    state: { doc: { toString: () => string }; selection: { main: { head: number } } };

    static lineWrapping = { extension: 'line-wrapping' };
    static updateListener = { of: vi.fn().mockReturnValue({ extension: 'update-listener' }) };
    static theme = vi.fn().mockReturnValue({ extension: 'theme' });
    static domEventHandlers = domEventHandlersMock;

    constructor(config: { parent?: HTMLElement }) {
      this.dom = document.createElement('div');
      this.dom.className = 'cm-editor';
      this.state = { doc: { toString: () => '' }, selection: { main: { head: 0 } } };
      config.parent?.appendChild(this.dom);
    }

    destroy = vi.fn();
    dispatch = vi.fn();
  }

  return {
    EditorView: MockEditorView,
    keymap: { of: keymapOfMock },
    lineNumbers: vi.fn().mockReturnValue({ extension: 'line-numbers' }),
    highlightActiveLine: vi.fn().mockReturnValue({ extension: 'active-line' }),
  };
});

vi.mock('@/components/editor/extensions/markdown-extensions', () => ({
  createMarkdownExtensions: vi.fn().mockReturnValue([]),
  cursorCompartment: { reconfigure: vi.fn().mockReturnValue({ type: 'effect' }) },
  createCursorTheme: vi.fn().mockReturnValue({ extension: 'cursor-theme' }),
  fontSizeCompartment: { reconfigure: vi.fn().mockReturnValue({ type: 'effect' }) },
  createFontSizeTheme: vi.fn().mockReturnValue({ extension: 'font-size-theme' }),
}));

// ---- Mod-Shift-i 핸들러 추출 ----
type KeymapRun = (view: unknown) => boolean;
interface KeymapEntry {
  key: string;
  run: KeymapRun;
}

function getModShiftIHandler(): KeymapRun {
  const call = keymapOfMock.mock.calls.find((args) =>
    Array.isArray(args[0]) && (args[0] as KeymapEntry[]).some((e) => e.key === 'Mod-Shift-i'),
  );
  if (!call) throw new Error('Mod-Shift-i 핸들러를 찾지 못했습니다');
  const entries = call[0] as KeymapEntry[];
  const entry = entries.find((e) => e.key === 'Mod-Shift-i');
  if (!entry) throw new Error('Mod-Shift-i 엔트리가 없습니다');
  return entry.run;
}

const fakeView = {
  state: { doc: { toString: () => 'doc content' }, selection: { main: { head: 0 } } },
  dispatch: vi.fn(),
};

async function renderEditor(): Promise<void> {
  const { MarkdownEditor } = await import('@/components/editor/MarkdownEditor');
  render(<MarkdownEditor />);
}

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('SPEC-IMG-LOAD-001 Group A — UT-A4 MarkdownEditor Mod-Shift-i 진입점 대칭', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
    useUIStore.setState({ imageInsertMode: 'inline-blob' });
    useFileStore.setState({ currentFile: null, previewStatus: null, fileTree: [] });
  });
  afterEach(cleanup);

  it('UT-A4a: inline-blob + 미저장 → saveFileAs 미호출, insertImageFromDialog(view, "") (REQ-A-004 대칭)', async () => {
    useEditorStore.setState({ currentFilePath: null });
    useUIStore.setState({ imageInsertMode: 'inline-blob' });
    await renderEditor();

    const handler = getModShiftIHandler();
    await act(async () => {
      handler(fakeView);
      await flushPromises();
    });

    expect(mockSaveFileAs).not.toHaveBeenCalled();
    expect(mockInsertImageFromDialog).toHaveBeenCalledWith(fakeView, '');
  });

  it('UT-A4b: file-save + 미저장 → saveFileAs 호출 후 insertImageFromDialog(view, savedPath)', async () => {
    useEditorStore.setState({ currentFilePath: null });
    useUIStore.setState({ imageInsertMode: 'file-save' });
    await renderEditor();

    const handler = getModShiftIHandler();
    await act(async () => {
      handler(fakeView);
      await flushPromises();
    });

    expect(mockSaveFileAs).toHaveBeenCalledWith('doc content');
    expect(mockInsertImageFromDialog).toHaveBeenCalledWith(fakeView, '/saved/doc.md');
  });

  it('UT-A4c: 저장된 문서 → 모드 무관 insertImageFromDialog(view, path) 직접 호출', async () => {
    useEditorStore.setState({ currentFilePath: '/existing/doc.md' });
    useUIStore.setState({ imageInsertMode: 'inline-blob' });
    await renderEditor();

    const handler = getModShiftIHandler();
    await act(async () => {
      handler(fakeView);
      await flushPromises();
    });

    expect(mockSaveFileAs).not.toHaveBeenCalled();
    expect(mockInsertImageFromDialog).toHaveBeenCalledWith(fakeView, '/existing/doc.md');
  });
});
