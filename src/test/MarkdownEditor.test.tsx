import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useEditorStore } from '@/store/editorStore';

/**
 * SPEC-EDITOR-001: MarkdownEditor component specification tests
 *
 * CodeMirror requires real DOM measurement APIs (getBoundingClientRect, etc.)
 * that jsdom does not implement. We mock the entire @codemirror modules to
 * isolate component logic and test rendering, state synchronization, and cleanup.
 */

// Mock Tauri IPC
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock openSearchPanel
vi.mock('@codemirror/search', () => ({
  openSearchPanel: vi.fn(),
  search: vi.fn().mockReturnValue({}),
  searchKeymap: [],
}));

// We mock the EditorState.create and EditorView at a high level
// to avoid @codemirror/state instanceof check failures in jsdom
let mockDestroyFn: ReturnType<typeof vi.fn>;

vi.mock('@codemirror/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codemirror/state')>();

  class MockEditorState {
    doc = { toString: () => '' };
    selection = { main: { head: 0 } };

    static create = vi.fn().mockImplementation(() => new MockEditorState());
    lineAt = vi.fn().mockReturnValue({ number: 1, from: 0 });
  }

  return {
    ...actual,
    EditorState: MockEditorState,
  };
});

vi.mock('@codemirror/view', async () => {
  mockDestroyFn = vi.fn();

  const updateListenerOf = vi.fn().mockReturnValue({ extension: 'update-listener' });

  class MockEditorView {
    dom: HTMLElement;
    state: { doc: { toString: () => string }; selection: { main: { head: number } } };

    static lineWrapping = { extension: 'line-wrapping' };
    static updateListener = { of: updateListenerOf };
    static theme = vi.fn().mockReturnValue({ extension: 'theme' });
    static domEventHandlers = vi.fn().mockReturnValue({ extension: 'dom-event-handlers' });

    constructor(config: { parent?: HTMLElement; state?: unknown }) {
      this.dom = document.createElement('div');
      this.dom.className = 'cm-editor';
      this.state = {
        doc: { toString: () => '' },
        selection: { main: { head: 0 } },
      };
      if (config.parent) {
        config.parent.appendChild(this.dom);
      }
    }

    destroy = mockDestroyFn;
    dispatch = vi.fn();
  }

  return {
    EditorView: MockEditorView,
    keymap: {
      of: vi.fn().mockReturnValue({ extension: 'keymap' }),
    },
    lineNumbers: vi.fn().mockReturnValue({ extension: 'line-numbers' }),
    highlightActiveLine: vi.fn().mockReturnValue({ extension: 'active-line' }),
  };
});

vi.mock('@/components/editor/extensions/markdown-extensions', () => ({
  createMarkdownExtensions: vi.fn().mockReturnValue([]),
  cursorCompartment: { reconfigure: vi.fn().mockReturnValue({ type: 'effect' }) },
  createCursorTheme: vi.fn().mockReturnValue({ extension: 'cursor-theme' }),
}));

describe('MarkdownEditor: Rendering', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should render a container element', async () => {
    const { MarkdownEditor } = await import('@/components/editor/MarkdownEditor');
    const { container } = render(<MarkdownEditor />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render the editor wrapper with full height class', async () => {
    const { MarkdownEditor } = await import('@/components/editor/MarkdownEditor');
    const { container } = render(<MarkdownEditor />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('h-full');
  });

  it('should render with data-testid markdown-editor', async () => {
    const { MarkdownEditor } = await import('@/components/editor/MarkdownEditor');
    const { container } = render(<MarkdownEditor />);
    const editorEl = container.querySelector('[data-testid="markdown-editor"]');
    expect(editorEl).toBeTruthy();
  });

  it('should create a CodeMirror editor instance inside the container', async () => {
    const { MarkdownEditor } = await import('@/components/editor/MarkdownEditor');
    const { container } = render(<MarkdownEditor />);
    // The mock EditorView appends a .cm-editor div to parent
    const editorEl = container.querySelector('.cm-editor');
    expect(editorEl).toBeTruthy();
  });
});

describe('MarkdownEditor: EditorStore integration', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should initialize without throwing when content is empty', async () => {
    const { MarkdownEditor } = await import('@/components/editor/MarkdownEditor');
    expect(() => render(<MarkdownEditor />)).not.toThrow();
  });

  it('should initialize without throwing when currentFilePath is set', async () => {
    useEditorStore.setState({ currentFilePath: '/home/user/notes.md' });
    const { MarkdownEditor } = await import('@/components/editor/MarkdownEditor');
    expect(() => render(<MarkdownEditor />)).not.toThrow();
  });

  it('should initialize without throwing when currentFilePath is null', async () => {
    useEditorStore.setState({ currentFilePath: null });
    const { MarkdownEditor } = await import('@/components/editor/MarkdownEditor');
    expect(() => render(<MarkdownEditor />)).not.toThrow();
  });
});

describe('MarkdownEditor: Cleanup', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should destroy EditorView on unmount to prevent memory leak', async () => {
    const { MarkdownEditor } = await import('@/components/editor/MarkdownEditor');
    const { unmount } = render(<MarkdownEditor />);

    act(() => {
      unmount();
    });

    expect(mockDestroyFn).toHaveBeenCalledOnce();
  });
});
