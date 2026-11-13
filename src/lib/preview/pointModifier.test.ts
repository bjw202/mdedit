import { describe, it, expect } from 'vitest';
import { isPointModifierHeld, isPointModifierKey } from './pointModifier';

describe('isPointModifierHeld — SPEC-AI-017 수정키 판정', () => {
  const cases: Array<[string, boolean, boolean, boolean, boolean]> = [
    // [설명, isMac, altKey, ctrlKey, 기대값]
    ['mac Alt', true, true, false, true],
    ['mac Ctrl(컨텍스트 메뉴)', true, false, true, false],
    ['mac 둘 다', true, true, true, true],
    ['mac 없음', true, false, false, false],
    ['non-mac Alt', false, true, false, true],
    ['non-mac Ctrl', false, false, true, true],
    ['non-mac 둘 다', false, true, true, true],
    ['non-mac 없음', false, false, false, false],
  ];
  it.each(cases)('%s', (_name, isMac, altKey, ctrlKey, expected) => {
    expect(isPointModifierHeld({ altKey, ctrlKey }, isMac)).toBe(expected);
  });
});

describe('isPointModifierKey — 키 이름', () => {
  it('mac 은 Alt 만', () => {
    expect(isPointModifierKey('Alt', true)).toBe(true);
    expect(isPointModifierKey('Control', true)).toBe(false);
    expect(isPointModifierKey('Shift', true)).toBe(false);
  });
  it('non-mac 은 Alt 와 Control', () => {
    expect(isPointModifierKey('Alt', false)).toBe(true);
    expect(isPointModifierKey('Control', false)).toBe(true);
    expect(isPointModifierKey('Shift', false)).toBe(false);
  });
});
