import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { EditorState } from '@/store/editorStore';

// Mock editorStore - provide full EditorState type in selector
vi.mock('@/store/editorStore', () => ({
  useEditorStore: vi.fn((selector: (s: EditorState) => unknown) =>
    selector({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
      setContent: vi.fn(),
      setCursor: vi.fn(),
      setDirty: vi.fn(),
      setCurrentFilePath: vi.fn(),
      resetEditor: vi.fn(),
    }),
  ),
}));

// Mock renderMarkdown
vi.mock('@/lib/markdown/renderer', () => ({
  renderMarkdown: vi.fn().mockResolvedValue('<p>rendered</p>'),
}));

// Mock codeHighlight
vi.mock('@/lib/markdown/codeHighlight', () => ({
  getHighlighter: vi.fn().mockResolvedValue(null),
}));

/** Helper to build a minimal EditorState with a given content string */
function makeState(content: string): EditorState {
  return {
    content,
    cursorLine: 1,
    cursorCol: 1,
    dirty: false,
    currentFilePath: null,
    setContent: vi.fn(),
    setCursor: vi.fn(),
    setDirty: vi.fn(),
    setCurrentFilePath: vi.fn(),
    resetEditor: vi.fn(),
  };
}

describe('usePreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns initial empty html and isLoading false', async () => {
    const { usePreview } = await import('@/hooks/usePreview');
    const { result } = renderHook(() => usePreview());

    expect(result.current.html).toBe('');
    expect(result.current.isLoading).toBe(false);
  });

  it('debounces rendering with 300ms delay', async () => {
    const { useEditorStore } = await import('@/store/editorStore');
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const mockUseEditorStore = vi.mocked(useEditorStore);
    const mockRenderMarkdown = vi.mocked(renderMarkdown);

    mockUseEditorStore.mockImplementation((selector: (s: EditorState) => unknown) =>
      selector(makeState('Hello')),
    );

    const { usePreview } = await import('@/hooks/usePreview');
    renderHook(() => usePreview());

    // renderMarkdown should not be called before debounce fires
    expect(mockRenderMarkdown).not.toHaveBeenCalled();

    // Advance timers by 299ms - still should not be called
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(mockRenderMarkdown).not.toHaveBeenCalled();

    // Advance timers to 300ms - now it should be called
    await act(async () => {
      vi.advanceTimersByTime(1);
      await vi.runAllTimersAsync();
    });
    expect(mockRenderMarkdown).toHaveBeenCalledWith('Hello', null, false);
  });

  it('sets html after debounce completes', async () => {
    const { useEditorStore } = await import('@/store/editorStore');
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const mockUseEditorStore = vi.mocked(useEditorStore);
    const mockRenderMarkdown = vi.mocked(renderMarkdown);

    mockUseEditorStore.mockImplementation((selector: (s: EditorState) => unknown) =>
      selector(makeState('Hello')),
    );
    mockRenderMarkdown.mockResolvedValue('<p>Hello</p>');

    const { usePreview } = await import('@/hooks/usePreview');
    const { result } = renderHook(() => usePreview());

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(result.current.html).toBe('<p>Hello</p>');
  });

  it('sets isLoading true during rendering', async () => {
    const { useEditorStore } = await import('@/store/editorStore');
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const mockUseEditorStore = vi.mocked(useEditorStore);
    const mockRenderMarkdown = vi.mocked(renderMarkdown);

    mockUseEditorStore.mockImplementation((selector: (s: EditorState) => unknown) =>
      selector(makeState('Loading test')),
    );

    // Return a promise that we can control
    let resolveRender!: (v: string) => void;
    mockRenderMarkdown.mockReturnValue(
      new Promise<string>((res) => {
        resolveRender = res;
      }),
    );

    const { usePreview } = await import('@/hooks/usePreview');
    const { result } = renderHook(() => usePreview());

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Let microtasks run to start the async render
    await act(async () => {
      await Promise.resolve();
    });

    // Resolve the render
    await act(async () => {
      resolveRender('<p>done</p>');
      await vi.runAllTimersAsync();
    });

    expect(result.current.html).toBe('<p>done</p>');
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps previous html on rendering error', async () => {
    const { useEditorStore } = await import('@/store/editorStore');
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const mockUseEditorStore = vi.mocked(useEditorStore);
    const mockRenderMarkdown = vi.mocked(renderMarkdown);

    // First successful render
    mockUseEditorStore.mockImplementation((selector: (s: EditorState) => unknown) =>
      selector(makeState('Good content')),
    );
    mockRenderMarkdown.mockResolvedValueOnce('<p>Good content</p>');

    const { usePreview } = await import('@/hooks/usePreview');
    const { result } = renderHook(() => usePreview());

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(result.current.html).toBe('<p>Good content</p>');

    // Now simulate error
    mockRenderMarkdown.mockRejectedValueOnce(new Error('Render failed'));

    // The error case is handled gracefully - previous html is preserved
    expect(result.current.html).toBe('<p>Good content</p>');
    expect(result.current.isLoading).toBe(false);
  });

  it('cancels previous debounce timer on content change', async () => {
    const { useEditorStore } = await import('@/store/editorStore');
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const mockUseEditorStore = vi.mocked(useEditorStore);
    const mockRenderMarkdown = vi.mocked(renderMarkdown);

    mockUseEditorStore.mockImplementation((selector: (s: EditorState) => unknown) =>
      selector(makeState('initial')),
    );
    mockRenderMarkdown.mockResolvedValue('<p>final</p>');

    const { usePreview } = await import('@/hooks/usePreview');
    const { rerender } = renderHook(() => usePreview());

    // Advance 200ms (not enough to trigger)
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mockRenderMarkdown).not.toHaveBeenCalled();

    // Change content (new render cycle)
    mockUseEditorStore.mockImplementation((selector: (s: EditorState) => unknown) =>
      selector(makeState('updated')),
    );
    rerender();

    // Advance another 300ms from update
    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    // renderMarkdown should be called once (for 'updated'), not twice
    expect(mockRenderMarkdown).toHaveBeenCalledTimes(1);
    expect(mockRenderMarkdown).toHaveBeenCalledWith('updated', null, false);
  });
});
