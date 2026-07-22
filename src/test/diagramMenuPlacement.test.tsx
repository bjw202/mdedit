// @MX:SPEC: SPEC-UI-008
// 후속 실기기 결함(좁은 창): 툴바 다이어그램 드롭다운(.md-menu left-0)이 오른쪽 뷰포트 경계에
// 잘린다. jsdom 은 레이아웃이 없으므로 getBoundingClientRect + innerWidth 를 목킹해 좁은 창을
// 재현하고, 열림 시 rAF 측정으로 right-0 정렬로 뒤집히는지 검증한다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('DiagramInsertMenu: viewport-aware right-align (narrow window)', () => {
  const rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks.length = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  function flushRaf(): void {
    const cbs = rafCallbacks.splice(0, rafCallbacks.length);
    cbs.forEach((cb) => cb(0));
  }

  function rect(partial: Partial<DOMRect>): DOMRect {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...partial,
    } as DOMRect;
  }

  async function openMenu() {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const trigger = screen.getByRole('button', { name: '다이어그램 삽입' });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    return { menu };
  }

  it('stays left-aligned when the dropdown fits in the viewport', async () => {
    const { menu } = await openMenu();
    vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue(rect({ left: 100, right: 300, width: 200 }));
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });

    act(() => flushRaf());

    expect(menu.className).toContain('left-0');
    expect(menu.className).not.toContain('right-0');
  });

  it('right-aligns when the left-aligned dropdown would overflow the right edge (narrow window)', async () => {
    const { menu } = await openMenu();
    vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue(rect({ left: 500, right: 700, width: 200 }));
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true }); // 700 > 600

    act(() => flushRaf());

    expect(menu.className).toContain('right-0');
    expect(menu.className).not.toContain('left-0');
  });
});

// SPEC-UI-007 후속(좁은 창): 표 삽입 그리드 피커(.md-table-picker left-0)도 동일한 우측 잘림 결함.
// DiagramInsertMenu 와 동일한 wouldOverflowRight 기반 우측 정렬 뒤집기를 적용한다.
describe('TableGridPicker: viewport-aware right-align (narrow window)', () => {
  const rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks.length = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  function flushRaf(): void {
    const cbs = rafCallbacks.splice(0, rafCallbacks.length);
    cbs.forEach((cb) => cb(0));
  }

  function rect(partial: Partial<DOMRect>): DOMRect {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...partial,
    } as DOMRect;
  }

  async function openPicker() {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const trigger = screen.getByRole('button', { name: 'Insert Table' });
    fireEvent.click(trigger);
    const picker = document.querySelector('.md-table-picker') as HTMLElement;
    return { picker };
  }

  it('stays left-aligned when the grid picker fits in the viewport', async () => {
    const { picker } = await openPicker();
    vi.spyOn(picker, 'getBoundingClientRect').mockReturnValue(rect({ left: 100, right: 300, width: 200 }));
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });

    act(() => flushRaf());

    expect(picker.className).toContain('left-0');
    expect(picker.className).not.toContain('right-0');
  });

  it('right-aligns when the left-aligned grid picker would overflow the right edge (narrow window)', async () => {
    const { picker } = await openPicker();
    vi.spyOn(picker, 'getBoundingClientRect').mockReturnValue(rect({ left: 500, right: 700, width: 200 }));
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true }); // 700 > 600

    act(() => flushRaf());

    expect(picker.className).toContain('right-0');
    expect(picker.className).not.toContain('left-0');
  });
});
