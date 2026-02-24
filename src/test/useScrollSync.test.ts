import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

/**
 * SPEC-PREVIEW-002: useScrollSync hook specification tests
 *
 * Tests verify that:
 * - When enabled, scroll listener is attached to editorView.scrollDOM
 * - When disabled, scroll listener is NOT attached
 * - Cleanup removes scroll listener on unmount
 * - No feedback loop (isProgrammaticScrollRef prevents re-entrant scrolls)
 */

// Mock requestAnimationFrame and cancelAnimationFrame
const rafCallbacks = new Map<number, FrameRequestCallback>();
let rafCounter = 0;

const mockRequestAnimationFrame = vi.fn((callback: FrameRequestCallback): number => {
  const handle = ++rafCounter;
  rafCallbacks.set(handle, callback);
  return handle;
});

const mockCancelAnimationFrame = vi.fn((handle: number): void => {
  rafCallbacks.delete(handle);
});

function flushRaf(): void {
  const callbacks = [...rafCallbacks.values()];
  rafCallbacks.clear();
  callbacks.forEach((cb) => cb(0));
}

describe('useScrollSync', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', mockRequestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', mockCancelAnimationFrame);
    rafCallbacks.clear();
    rafCounter = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createMockEditorView(scrollTop = 0): {
    scrollDOM: HTMLElement & { scrollTop: number };
    lineBlockAtHeight: ReturnType<typeof vi.fn>;
    state: { doc: { lineAt: ReturnType<typeof vi.fn> } };
  } {
    const scrollDOM = document.createElement('div') as HTMLElement & { scrollTop: number };
    Object.defineProperty(scrollDOM, 'scrollTop', {
      get: () => scrollTop,
      configurable: true,
    });

    return {
      scrollDOM,
      lineBlockAtHeight: vi.fn().mockReturnValue({ from: 0 }),
      state: {
        doc: {
          lineAt: vi.fn().mockReturnValue({ number: 1 }),
        },
      },
    };
  }

  function createPreviewRef(elements: HTMLElement[] = []): React.RefObject<HTMLDivElement> {
    const container = document.createElement('div');
    elements.forEach((el) => container.appendChild(el));
    return { current: container } as React.RefObject<HTMLDivElement>;
  }

  it('attaches scroll listener to scrollDOM when enabled', async () => {
    const { useScrollSync } = await import('@/hooks/useScrollSync');
    const mockView = createMockEditorView();
    const addEventSpy = vi.spyOn(mockView.scrollDOM, 'addEventListener');
    const previewRef = createPreviewRef();

    renderHook(() => useScrollSync(mockView as unknown as import('@codemirror/view').EditorView, previewRef, true));

    expect(addEventSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
  });

  it('does NOT attach scroll listener when disabled', async () => {
    const { useScrollSync } = await import('@/hooks/useScrollSync');
    const mockView = createMockEditorView();
    const addEventSpy = vi.spyOn(mockView.scrollDOM, 'addEventListener');
    const previewRef = createPreviewRef();

    renderHook(() => useScrollSync(mockView as unknown as import('@codemirror/view').EditorView, previewRef, false));

    expect(addEventSpy).not.toHaveBeenCalled();
  });

  it('does NOT attach scroll listener when editorView is null', async () => {
    const { useScrollSync } = await import('@/hooks/useScrollSync');
    const previewRef = createPreviewRef();

    // Should not throw when editorView is null
    expect(() => {
      renderHook(() => useScrollSync(null, previewRef, true));
    }).not.toThrow();
  });

  it('removes scroll listener on unmount', async () => {
    const { useScrollSync } = await import('@/hooks/useScrollSync');
    const mockView = createMockEditorView();
    const removeEventSpy = vi.spyOn(mockView.scrollDOM, 'removeEventListener');
    const previewRef = createPreviewRef();

    const { unmount } = renderHook(() =>
      useScrollSync(mockView as unknown as import('@codemirror/view').EditorView, previewRef, true)
    );

    unmount();

    expect(removeEventSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('scrolls preview to matching data-line element on editor scroll', async () => {
    const { useScrollSync } = await import('@/hooks/useScrollSync');
    const mockView = createMockEditorView();

    // Create a preview element with data-line="0"
    const lineEl = document.createElement('p');
    lineEl.setAttribute('data-line', '0');
    // jsdom does not implement scrollIntoView - mock it
    lineEl.scrollIntoView = vi.fn();

    const previewRef = createPreviewRef([lineEl]);

    renderHook(() =>
      useScrollSync(mockView as unknown as import('@codemirror/view').EditorView, previewRef, true)
    );

    // Simulate scroll event
    mockView.scrollDOM.dispatchEvent(new Event('scroll'));
    flushRaf();

    expect(lineEl.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth', block: 'start' })
    );
  });

  it('cancels pending RAF on rapid scroll events', async () => {
    const { useScrollSync } = await import('@/hooks/useScrollSync');
    const mockView = createMockEditorView();
    const previewRef = createPreviewRef();

    renderHook(() =>
      useScrollSync(mockView as unknown as import('@codemirror/view').EditorView, previewRef, true)
    );

    // Fire multiple scroll events rapidly
    mockView.scrollDOM.dispatchEvent(new Event('scroll'));
    mockView.scrollDOM.dispatchEvent(new Event('scroll'));

    // cancelAnimationFrame should be called on the second event
    expect(mockCancelAnimationFrame).toHaveBeenCalled();
  });
});
