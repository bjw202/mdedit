// @MX:SPEC: SPEC-AI-008
// 실기기 결함(좁은 창/좁은 패널): 툴바 다이어그램 드롭다운·표 피커가 실효 클리핑 경계(에디터 패널)를
// 넘어 잘린다. 수정 후 배치는 left-0/right-0 클래스 토글이 아니라, 열림 시 rAF 측정으로 계산한 inline
// left/top 오프셋(flip→clamp)이다. jsdom 은 레이아웃이 없으므로 앵커(wrapper)·메뉴 rect + innerWidth
// 를 목킹해 지오메트리를 재현하고, 적용된 inline 오프셋의 방향을 검증한다(정밀 경계값은
// menuPlacement.test.ts 순수 테스트 담당).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

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
    top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
    toJSON: () => ({}),
    ...partial,
  } as DOMRect;
}

/** 메뉴 요소와 그 앵커(=parentElement, .relative wrapper) rect 를 목킹한다. */
function mockGeometry(el: HTMLElement, anchor: Partial<DOMRect>, menu: Partial<DOMRect>): void {
  const wrap = el.parentElement as HTMLElement;
  vi.spyOn(wrap, 'getBoundingClientRect').mockReturnValue(rect(anchor));
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(menu));
}

describe('DiagramInsertMenu: clip-aware inline placement', () => {
  async function openMenu() {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: '다이어그램 삽입' }));
    return { menu: screen.getByRole('menu') };
  }

  it('stays left-aligned (offset.left === 0) when the dropdown fits inside the boundary', async () => {
    const { menu } = await openMenu();
    mockGeometry(
      menu,
      { left: 100, right: 130, top: 20, bottom: 44 },
      { left: 100, right: 300, top: 44, bottom: 194, width: 200, height: 150 },
    );
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    act(() => flushRaf());

    expect(parseFloat(menu.style.left)).toBe(0);
    expect(menu.className).not.toContain('right-0');
  });

  it('shifts left (offset.left < 0) when the left-aligned dropdown would overflow the boundary right', async () => {
    const { menu } = await openMenu();
    mockGeometry(
      menu,
      { left: 500, right: 530, top: 20, bottom: 44 },
      { left: 500, right: 700, top: 44, bottom: 194, width: 200, height: 150 },
    );
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true }); // 700 > 600
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    act(() => flushRaf());

    const off = parseFloat(menu.style.left);
    expect(off).toBeLessThan(0);
    // 최종 뷰포트 위치가 경계 안에 완전히 들어야 한다: anchor.left + offset + width <= innerWidth.
    expect(500 + off + 200).toBeLessThanOrEqual(600);
  });
});

describe('TableGridPicker: clip-aware inline placement', () => {
  async function openPicker() {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert Table' }));
    return { picker: document.querySelector('.md-table-picker') as HTMLElement };
  }

  it('stays left-aligned (offset.left === 0) when the grid picker fits inside the boundary', async () => {
    const { picker } = await openPicker();
    mockGeometry(
      picker,
      { left: 100, right: 130, top: 20, bottom: 44 },
      { left: 100, right: 300, top: 44, bottom: 194, width: 200, height: 150 },
    );
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    act(() => flushRaf());

    expect(parseFloat(picker.style.left)).toBe(0);
  });

  it('shifts left (offset.left < 0) when the left-aligned grid picker would overflow the boundary right', async () => {
    const { picker } = await openPicker();
    mockGeometry(
      picker,
      { left: 500, right: 530, top: 20, bottom: 44 },
      { left: 500, right: 700, top: 44, bottom: 194, width: 200, height: 150 },
    );
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true }); // 700 > 600
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    act(() => flushRaf());

    const off = parseFloat(picker.style.left);
    expect(off).toBeLessThan(0);
    expect(500 + off + 200).toBeLessThanOrEqual(600);
  });
});
