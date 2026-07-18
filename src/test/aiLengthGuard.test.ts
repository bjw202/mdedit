// @MX:SPEC: SPEC-AI-001 REQ-AI-026 REQ-AI-027
// Tests for evaluateSelectionGuard — 설계서 §4.4 선택 길이 가드 (2K edit / 4K transform).
// TDD RED phase: written before ai-length-guard.ts exists.

import { describe, it, expect } from 'vitest';

const EDIT_PRESETS = ['polish', 'custom'] as const;
const TRANSFORM_PRESETS = ['outline', 'table', 'diagram', 'shorten'] as const;

describe('evaluateSelectionGuard: edit presets (2,000 char limit)', () => {
  for (const preset of EDIT_PRESETS) {
    it(`${preset}: at exactly 2000 chars → allowed, not insert-only`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(2000, preset);
      expect(r.allowed).toBe(true);
      expect(r.insertOnly).toBe(false);
      expect(r.reason).toBeUndefined();
    });

    it(`${preset}: at 2001 chars → not allowed with a guidance reason`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(2001, preset);
      expect(r.allowed).toBe(false);
      expect(r.insertOnly).toBe(false);
      expect(typeof r.reason).toBe('string');
      expect(r.reason && r.reason.length).toBeGreaterThan(0);
    });

    it(`${preset}: well over the limit (4001) stays not allowed`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(4001, preset);
      expect(r.allowed).toBe(false);
    });
  }
});

describe('evaluateSelectionGuard: transform presets (4,000 char limit, insert-only band)', () => {
  for (const preset of TRANSFORM_PRESETS) {
    it(`${preset}: at 2000 chars → allowed, not insert-only`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(2000, preset);
      expect(r.allowed).toBe(true);
      expect(r.insertOnly).toBe(false);
    });

    it(`${preset}: at 2001 chars → allowed but insert-only ('바꾸기' disabled)`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(2001, preset);
      expect(r.allowed).toBe(true);
      expect(r.insertOnly).toBe(true);
    });

    it(`${preset}: at exactly 4000 chars → allowed but insert-only`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(4000, preset);
      expect(r.allowed).toBe(true);
      expect(r.insertOnly).toBe(true);
    });

    it(`${preset}: at 4001 chars → not allowed with a guidance reason`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(4001, preset);
      expect(r.allowed).toBe(false);
      expect(r.insertOnly).toBe(false);
      expect(typeof r.reason).toBe('string');
    });
  }
});

describe('evaluateSelectionGuard: short selections are always fine', () => {
  it('zero-length selection is allowed and not insert-only for any preset', async () => {
    const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
    for (const preset of [...EDIT_PRESETS, ...TRANSFORM_PRESETS]) {
      const r = evaluateSelectionGuard(0, preset);
      expect(r.allowed).toBe(true);
      expect(r.insertOnly).toBe(false);
    }
  });
});

describe('evaluateSelectionGuard: reason states the count and the right limit', () => {
  it('edit preset over limit: shows the current count and the 2,000 edit limit', async () => {
    const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
    const r = evaluateSelectionGuard(5170, 'polish');
    expect(r.reason).toContain('5,170자');
    expect(r.reason).toContain('2,000자까지');
    // 왜 잘라서라도 처리하지 않는지 설명이 함께 있어야 한다(숫자만 있으면 납득이 안 된다).
    expect(r.reason).toContain('사라져요');
  });

  it('transform preset over limit: shows the 4,000 limit, not the edit limit', async () => {
    const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
    const r = evaluateSelectionGuard(5170, 'outline');
    expect(r.reason).toContain('5,170자');
    expect(r.reason).toContain('4,000자까지');
    expect(r.reason).not.toContain('2,000자');
  });

  it('the two families name different presets so the user knows which is blocked', async () => {
    const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
    expect(evaluateSelectionGuard(5170, 'custom').reason).toContain('다듬기·직접 입력');
    expect(evaluateSelectionGuard(5170, 'table').reason).toContain('개요·표·다이어그램·짧게');
  });
});
