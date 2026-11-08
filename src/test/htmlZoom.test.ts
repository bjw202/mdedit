// htmlZoom 순수 함수 단위 테스트 — SPEC-PREVIEW-018 (AC-002, AC-004 일부, AC-006 일부)
import { describe, it, expect } from 'vitest';
import {
  HTML_ZOOM_STEPS,
  HTML_ZOOM_DEFAULT,
  stepUp,
  stepDown,
  snapToStep,
  isMacPlatform,
  matchZoomShortcut,
} from '@/lib/preview/htmlZoom';

describe('htmlZoom 단계 목록', () => {
  it('SPEC 단계 값만 가진다', () => {
    expect([...HTML_ZOOM_STEPS]).toEqual([67, 75, 80, 90, 100, 110, 125, 150, 175, 200]);
    expect(HTML_ZOOM_DEFAULT).toBe(100);
  });
});

describe('stepUp / stepDown', () => {
  it('바로 위·아래 단계로 움직인다', () => {
    expect(stepUp(100)).toBe(110);
    expect(stepUp(110)).toBe(125);
    expect(stepDown(100)).toBe(90);
    expect(stepDown(90)).toBe(80);
  });

  it('경계에서는 값을 바꾸지 않는다', () => {
    expect(stepUp(200)).toBe(200);
    expect(stepDown(67)).toBe(67);
  });
});

describe('snapToStep', () => {
  it('단계 값은 그대로 둔다', () => {
    for (const s of HTML_ZOOM_STEPS) expect(snapToStep(s)).toBe(s);
  });

  it('가장 가까운 단계로 맞춘다', () => {
    expect(snapToStep(113)).toBe(110);
    expect(snapToStep(999)).toBe(200);
    expect(snapToStep(10)).toBe(67);
  });

  it('같은 거리면 작은 쪽을 쓴다', () => {
    expect(snapToStep(77.5)).toBe(75); // 75와 80의 중간
  });

  it('number가 아니거나 유한하지 않으면 100이다', () => {
    expect(snapToStep('150')).toBe(100);
    expect(snapToStep('abc')).toBe(100);
    expect(snapToStep(null)).toBe(100);
    expect(snapToStep(undefined)).toBe(100);
    expect(snapToStep(true)).toBe(100);
    expect(snapToStep(NaN)).toBe(100);
    expect(snapToStep(Infinity)).toBe(100);
    expect(snapToStep(-Infinity)).toBe(100);
  });
});

describe('isMacPlatform', () => {
  it('Mac 플랫폼 문자열을 판정한다', () => {
    expect(isMacPlatform('MacIntel')).toBe(true);
    expect(isMacPlatform('macOS')).toBe(true);
    expect(isMacPlatform('Win32')).toBe(false);
    expect(isMacPlatform('Linux x86_64')).toBe(false);
  });
});

function key(init: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', { cancelable: true, ...init });
}

describe('matchZoomShortcut', () => {
  it('macOS는 metaKey만 수정키로 받는다', () => {
    expect(matchZoomShortcut(key({ key: '=', metaKey: true }), true)).toBe('in');
    expect(matchZoomShortcut(key({ key: '+', metaKey: true }), true)).toBe('in');
    expect(matchZoomShortcut(key({ key: '-', metaKey: true }), true)).toBe('out');
    expect(matchZoomShortcut(key({ key: '0', metaKey: true }), true)).toBe('reset');
    expect(matchZoomShortcut(key({ key: '=', ctrlKey: true }), true)).toBeNull();
  });

  it('그 밖의 OS는 ctrlKey만 수정키로 받는다', () => {
    expect(matchZoomShortcut(key({ key: '=', ctrlKey: true }), false)).toBe('in');
    expect(matchZoomShortcut(key({ key: '-', ctrlKey: true }), false)).toBe('out');
    expect(matchZoomShortcut(key({ key: '0', ctrlKey: true }), false)).toBe('reset');
    expect(matchZoomShortcut(key({ key: '=', metaKey: true }), false)).toBeNull();
  });

  it('수정키가 없거나 다른 키면 null이다', () => {
    expect(matchZoomShortcut(key({ key: '=' }), true)).toBeNull();
    expect(matchZoomShortcut(key({ key: 'a', metaKey: true }), true)).toBeNull();
  });

  it('조합 입력 중이면 null이다', () => {
    expect(matchZoomShortcut(key({ key: '=', metaKey: true, isComposing: true }), true)).toBeNull();
  });
});
