// @MX:SPEC: SPEC-AI-008
// 좁은/넓은 창 모두에서 다이어그램 메뉴 3종이 실효 클리핑 경계(에디터 패널) 밖으로 잘리는 실기기
// 결함의 순수 판정/배치 헬퍼. flip(측 선택) 뒤에도 경계를 넘으면 clamp(경계 안으로 밀기)하는 것이
// 핵심 — 측 선택만으로는 반대편 경계를 넘는 재현(파일 탐색기 옆 좁은 패널에서 왼쪽 오버슈트)이 남는다.
import { describe, it, expect } from 'vitest';
import {
  wouldOverflowRight,
  wouldOverflowBottom,
  fitAxisStart,
  computeFlyoutOffset,
  computeDropdownOffset,
  getClipBoundary,
} from '@/lib/ui/menuPlacement';

describe('menuPlacement low-level overflow predicates', () => {
  it('wouldOverflowRight: true only when leftEdge + width exceeds the boundary right', () => {
    expect(wouldOverflowRight(900, 200, 1000)).toBe(true); // 1100 > 1000
    expect(wouldOverflowRight(700, 200, 1000)).toBe(false); // 900 <= 1000
    expect(wouldOverflowRight(800, 200, 1000)).toBe(false); // exactly fits (1000)
  });

  it('wouldOverflowBottom: true only when topEdge + height exceeds the boundary bottom', () => {
    expect(wouldOverflowBottom(700, 200, 800)).toBe(true); // 900 > 800
    expect(wouldOverflowBottom(500, 200, 800)).toBe(false); // 700 <= 800
    expect(wouldOverflowBottom(600, 200, 800)).toBe(false); // exactly fits (800)
  });
});

describe('fitAxisStart: flip preference then clamp into the boundary', () => {
  it('keeps the preferred start when it fits', () => {
    expect(fitAxisStart(304, -84, 180, 0, 1000)).toBe(304);
  });

  it('uses the alternate (flipped) start when preferred overflows and alt fits', () => {
    expect(fitAxisStart(544, 176, 180, 0, 600)).toBe(176);
  });

  it('clamps into the boundary when neither side fits (picks larger room, then clamps)', () => {
    // preferred 500 (overflows right), alt -100 (overflows left); equal room → prefer, then clamp to 400.
    expect(fitAxisStart(500, -100, 200, 0, 600)).toBe(400);
  });

  it('clamps a flipped-left result back into the boundary instead of overshooting', () => {
    // flipped-left start (-30) crosses the left boundary (clip.left=0) → clamp to >= 0.
    expect(fitAxisStart(-30, 900, 180, 0, 600)).toBeGreaterThanOrEqual(0);
  });

  it('pins to boundaryStart when the boundary is smaller than the menu', () => {
    expect(fitAxisStart(10, -50, 300, 0, 200)).toBe(0);
  });
});

describe('computeFlyoutOffset: side flyout (AI diagram submenu)', () => {
  const clip = { left: 0, top: 0, right: 1000, bottom: 800 };

  it('opens rightward beside the anchor when it fits', () => {
    const off = computeFlyoutOffset(
      { left: 100, top: 100, right: 300, bottom: 124 },
      { width: 180, height: 240 },
      clip,
      4,
    );
    expect(off.left).toBe(204); // (300+4) - 100
    expect(off.top).toBe(0); // aligned with anchor top
  });

  it('flips leftward when the rightward flyout overflows the boundary right', () => {
    const off = computeFlyoutOffset(
      { left: 360, top: 100, right: 540, bottom: 124 },
      { width: 180, height: 240 },
      { left: 0, top: 0, right: 600, bottom: 800 },
      4,
    );
    expect(off.left).toBe(-184); // 176 - 360 (opens leftward)
  });

  it('flip-left overshoot is clamped inside a narrow pane (file-explorer + editor split)', () => {
    // 실기기 3번째 스크린샷 재현: 넓은 창이지만 패널 좌측 545, 우측 1110. 아이콘+라벨로 서브메뉴가
    // 넓어(250) 오른쪽이 잘려 왼쪽으로 뒤집으면 486(<545)로 패널 왼쪽을 넘는다 → clamp 로 경계 안에.
    const clipPane = { left: 545, top: 100, right: 1110, bottom: 700 };
    const anchor = { left: 740, top: 200, right: 900, bottom: 232 };
    const off = computeFlyoutOffset(anchor, { width: 250, height: 520 }, clipPane, 4);
    const finalLeft = anchor.left + off.left;
    expect(finalLeft).toBeGreaterThanOrEqual(clipPane.left);
    expect(finalLeft + 250).toBeLessThanOrEqual(clipPane.right);
  });

  it('flips up and clamps when the flyout overflows the boundary bottom', () => {
    const off = computeFlyoutOffset(
      { left: 100, top: 700, right: 300, bottom: 724 },
      { width: 180, height: 240 },
      clip,
      4,
    );
    expect(off.top).toBe(-216); // 484 - 700 (opens upward, bottom aligned)
  });
});

describe('computeDropdownOffset: below-anchor dropdown (toolbar table/diagram)', () => {
  const clip = { left: 0, top: 0, right: 1000, bottom: 800 };

  it('left-aligns below the anchor when it fits', () => {
    const off = computeDropdownOffset(
      { left: 100, top: 20, right: 130, bottom: 44 },
      { width: 200, height: 150 },
      clip,
      0,
    );
    expect(off.left).toBe(0); // aligned with anchor left
    expect(off.top).toBe(24); // anchor.bottom(44) - anchor.top(20)
  });

  it('right-aligns and clamps when a left-aligned dropdown overflows the boundary right', () => {
    const anchor = { left: 500, top: 20, right: 530, bottom: 44 };
    const off = computeDropdownOffset(anchor, { width: 200, height: 150 }, { left: 0, top: 0, right: 600, bottom: 800 }, 0);
    const finalLeft = anchor.left + off.left;
    expect(finalLeft).toBeGreaterThanOrEqual(0);
    expect(finalLeft + 200).toBeLessThanOrEqual(600);
  });
});

describe('getClipBoundary: intersects viewport with clipping ancestors', () => {
  it('returns the viewport when no ancestor clips', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const el = document.createElement('div');
    document.body.appendChild(el);
    const b = getClipBoundary(el);
    expect(b.right).toBe(1000);
    expect(b.bottom).toBe(800);
    el.remove();
  });

  it('intersects with an overflow:hidden ancestor rect (pane narrower than the window)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const pane = document.createElement('div');
    pane.style.overflow = 'hidden';
    // jsdom 은 레이아웃이 없어 rect 를 목킹한다 — 패널 우측 765(창 1280보다 한참 왼쪽).
    pane.getBoundingClientRect = () =>
      ({ left: 100, top: 0, right: 765, bottom: 700, width: 665, height: 700, x: 100, y: 0, toJSON: () => ({}) }) as DOMRect;
    const child = document.createElement('div');
    pane.appendChild(child);
    document.body.appendChild(pane);
    const b = getClipBoundary(child);
    expect(b.right).toBe(765); // min(1280, 765)
    expect(b.left).toBe(100); // max(0, 100)
    expect(b.bottom).toBe(700); // min(800, 700)
    pane.remove();
  });
});
