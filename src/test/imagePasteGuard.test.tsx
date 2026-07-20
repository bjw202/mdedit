// @MX:SPEC: SPEC-IMG-001, SPEC-IMG-MODE-001
/**
 * 회귀 테스트 — Ctrl+V 붙여넣기가 "다른 이름으로 저장"으로 가로채이던 버그.
 *
 * 재현 조건:
 *   1) 클립보드에 image/* flavor 가 하나라도 있고
 *   2) 현재 문서에 파일 경로가 없을 때(새 문서)
 * MarkdownEditor 의 paste 핸들러가 preventDefault() 후 saveFileAs() 를 띄웠다.
 *
 * Windows 클립보드는 브라우저·Word·Excel·탐색기에서 텍스트를 복사하면
 * text/plain 과 함께 image/png flavor 를 같이 싣는 경우가 흔하다. 그래서
 * 평범한 텍스트 붙여넣기가 이미지로 오판되어 텍스트가 들어가지 않았다.
 *
 * CodeMirror 는 jsdom 에서 실제 DOM 측정 API 를 요구하므로 모듈 전체를 모킹하고,
 * EditorView.domEventHandlers 모킹으로 실제 paste 핸들러를 꺼내 직접 호출한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useEditorStore } from '@/store/editorStore';
import { useUIStore } from '@/store/uiStore';

const { mockSaveFileAs, mockWriteFile, mockHandleImagePaste, mockInsertImageFile } = vi.hoisted(() => ({
  mockSaveFileAs: vi.fn().mockResolvedValue('/home/user/untitled.md'),
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
  mockHandleImagePaste: vi.fn().mockResolvedValue(true),
  mockInsertImageFile: vi.fn().mockResolvedValue(true),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/tauri/ipc', () => ({
  saveFileAs: mockSaveFileAs,
  writeFile: mockWriteFile,
  saveImageFromClipboard: vi.fn(),
  copyImageToFolder: vi.fn(),
  openImageDialog: vi.fn(),
}));

// decideImageInsert / extractImageFile 은 실제 구현을 그대로 쓴다 — 검증 대상 로직이다.
// 부수효과(IPC·문서 삽입)가 있는 함수만 스텁으로 바꾼다.
vi.mock('@/lib/image/imageHandler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image/imageHandler')>();
  return {
    ...actual,
    handleImagePaste: mockHandleImagePaste,
    insertImageFile: mockInsertImageFile,
    handleImageDrop: vi.fn(),
    insertImageFromDialog: vi.fn(),
  };
});

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

let domEventHandlersMock: ReturnType<typeof vi.fn>;

vi.mock('@codemirror/view', async () => {
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
    keymap: { of: vi.fn().mockReturnValue({ extension: 'keymap' }) },
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

type PasteHandler = (event: ClipboardEvent, view: unknown) => boolean;

/** domEventHandlers 모킹 호출에서 실제 paste 핸들러를 꺼낸다. */
function getPasteHandler(): PasteHandler {
  const call = domEventHandlersMock.mock.calls.find(
    (args) => typeof (args[0] as Record<string, unknown>)?.paste === 'function',
  );
  if (!call) throw new Error('paste 핸들러를 찾지 못했습니다');
  return (call[0] as { paste: PasteHandler }).paste;
}

/** 지정한 MIME 조합을 담은 가짜 ClipboardEvent 를 만든다. */
function makeClipboardEvent(types: string[], text = ''): ClipboardEvent {
  const items = types.map((type) => ({
    type,
    getAsFile: () => new File(['x'], 'x', { type }),
  }));
  return {
    clipboardData: {
      items,
      getData: (t: string) => (t === 'text/plain' ? text : ''),
    },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent;
}

const fakeView = {
  state: { doc: { toString: () => '' }, selection: { main: { head: 0 } } },
  dispatch: vi.fn(),
};

async function renderEditor(): Promise<void> {
  const { MarkdownEditor } = await import('@/components/editor/MarkdownEditor');
  render(<MarkdownEditor />);
}

describe('붙여넣기 가드: 텍스트가 이미지보다 우선한다', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({ content: '', cursorLine: 1, cursorCol: 1, dirty: false, currentFilePath: null });
    useUIStore.setState({ imageInsertMode: 'inline-blob' });
  });

  afterEach(cleanup);

  it('텍스트와 이미지가 함께 있는 클립보드는 저장 대화상자를 띄우지 않는다 (미저장 문서)', async () => {
    await renderEditor();
    const paste = getPasteHandler();

    // Windows 에서 브라우저/Excel 텍스트 복사 시 흔한 조합
    const event = makeClipboardEvent(['text/plain', 'image/png'], '복사한 텍스트');
    const handled = paste(event, fakeView);

    expect(mockSaveFileAs).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    // false 를 돌려줘야 CodeMirror 기본 텍스트 붙여넣기가 동작한다
    expect(handled).toBe(false);
  });

  it('순수 텍스트만 있는 클립보드도 그대로 통과시킨다', async () => {
    await renderEditor();
    const paste = getPasteHandler();

    const event = makeClipboardEvent(['text/plain'], '그냥 텍스트');
    expect(paste(event, fakeView)).toBe(false);
    expect(mockSaveFileAs).not.toHaveBeenCalled();
  });
});

describe('붙여넣기 가드: inline-blob 모드는 파일 경로를 요구하지 않는다', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({ content: '', cursorLine: 1, cursorCol: 1, dirty: false, currentFilePath: null });
    useUIStore.setState({ imageInsertMode: 'inline-blob' });
  });

  afterEach(cleanup);

  it('미저장 문서에 순수 이미지를 붙여넣어도 저장 대화상자 없이 삽입한다', async () => {
    await renderEditor();
    const paste = getPasteHandler();

    // 스크린샷(Win+Shift+S) 처럼 이미지만 있는 클립보드
    const event = makeClipboardEvent(['image/png']);
    const handled = paste(event, fakeView);

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    // inline-blob 은 data URI 로 박아 넣으므로 파일 경로가 필요 없다
    expect(mockSaveFileAs).not.toHaveBeenCalled();
    expect(mockHandleImagePaste).toHaveBeenCalled();
  });
});

describe('붙여넣기 가드: file-save 모드는 기존 동작을 유지한다', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({ content: '', cursorLine: 1, cursorCol: 1, dirty: false, currentFilePath: null });
    useUIStore.setState({ imageInsertMode: 'file-save' });
  });

  afterEach(cleanup);

  it('미저장 문서에 이미지를 붙여넣으면 저장 대화상자를 띄운다', async () => {
    await renderEditor();
    const paste = getPasteHandler();

    const event = makeClipboardEvent(['image/png']);
    const handled = paste(event, fakeView);

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    // 파일로 저장하려면 기준 경로가 있어야 하므로 Save As 는 정당하다
    expect(mockSaveFileAs).toHaveBeenCalled();
  });

  it('텍스트가 함께 있으면 file-save 모드에서도 저장 대화상자를 띄우지 않는다', async () => {
    await renderEditor();
    const paste = getPasteHandler();

    const event = makeClipboardEvent(['text/plain', 'image/png'], '복사한 텍스트');
    expect(paste(event, fakeView)).toBe(false);
    expect(mockSaveFileAs).not.toHaveBeenCalled();
  });
});

/**
 * 브라우저는 paste 이벤트 디스패치가 끝나면 clipboardData 를 무효화한다
 * (getAsFile() 이 null 을 돌려주기 시작한다).
 *
 * file-save 모드 + 미저장 문서 경로는 saveFileAs() 대화상자를 먼저 띄우고
 * 사용자가 위치를 고른 뒤에야 이미지를 꺼내려 했다. 그 사이 이벤트는 이미
 * 끝나 있으므로 이미지가 삽입되지 않는다.
 *
 * 따라서 대화상자를 띄우기 전에 이미지를 동기적으로 꺼내 두어야 한다.
 */
describe('붙여넣기 가드: 저장 대화상자 동안 클립보드가 만료돼도 이미지를 잃지 않는다', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({ content: '', cursorLine: 1, cursorCol: 1, dirty: false, currentFilePath: null });
    useUIStore.setState({ imageInsertMode: 'file-save' });
  });

  afterEach(cleanup);

  it('저장 위치를 고른 뒤에도 이미지가 삽입된다', async () => {
    await renderEditor();
    const paste = getPasteHandler();

    // 이벤트 종료 시점에 만료되는 클립보드 — 실제 브라우저 동작을 흉내낸다.
    let expired = false;
    const event = {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => (expired ? null : new File(['x'], 'shot.png', { type: 'image/png' })),
          },
        ],
        getData: () => '',
      },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;

    const handled = paste(event, fakeView);
    expect(handled).toBe(true);
    expect(mockSaveFileAs).toHaveBeenCalled();

    // 핸들러가 반환된 직후 브라우저가 clipboardData 를 무효화한다.
    expired = true;

    // saveFileAs 프라미스가 풀린 뒤 이미지가 삽입되어야 한다.
    await vi.waitFor(() => {
      expect(mockInsertImageFile).toHaveBeenCalled();
    });

    const [, passedFile, passedPath] = mockInsertImageFile.mock.calls[0];
    expect(passedFile).toBeInstanceOf(File);
    expect(passedPath).toBe('/home/user/untitled.md');
  });
});
