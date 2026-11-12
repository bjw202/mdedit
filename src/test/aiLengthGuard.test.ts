// @MX:SPEC: SPEC-AI-001 REQ-AI-026 REQ-AI-027
// Tests for evaluateSelectionGuard — 설계서 §4.4 선택 길이 가드 (SPEC-AI-013: 6K edit / 12K transform).
// TDD RED phase: written before ai-length-guard.ts exists.

import { describe, it, expect } from 'vitest';

const EDIT_PRESETS = ['polish', 'custom'] as const;
const TRANSFORM_PRESETS = ['outline', 'table', 'diagram', 'shorten'] as const;

describe('evaluateSelectionGuard: edit presets (6,000 char limit)', () => {
  for (const preset of EDIT_PRESETS) {
    it(`${preset}: at exactly 6000 chars → allowed, not insert-only`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(6000, preset);
      expect(r.allowed).toBe(true);
      expect(r.insertOnly).toBe(false);
      expect(r.reason).toBeUndefined();
    });

    it(`${preset}: at 6001 chars → not allowed with a guidance reason`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(6001, preset);
      expect(r.allowed).toBe(false);
      expect(r.insertOnly).toBe(false);
      expect(typeof r.reason).toBe('string');
      expect(r.reason && r.reason.includes('6,001자') && r.reason.includes('6,000자')).toBe(true);
      expect(r.reason && r.reason.length).toBeGreaterThan(0);
    });

    it(`${preset}: well over the limit (12001) stays not allowed`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(12001, preset);
      expect(r.allowed).toBe(false);
    });
  }
});

describe('evaluateSelectionGuard: transform presets (12,000 char limit, insert-only band 6,001~12,000)', () => {
  for (const preset of TRANSFORM_PRESETS) {
    it(`${preset}: at 6000 chars → allowed, not insert-only`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(6000, preset);
      expect(r.allowed).toBe(true);
      expect(r.insertOnly).toBe(false);
    });

    it(`${preset}: at 6001 chars → allowed but insert-only ('바꾸기' disabled)`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(6001, preset);
      expect(r.allowed).toBe(true);
      expect(r.insertOnly).toBe(true);
    });

    it(`${preset}: at exactly 12000 chars → allowed but insert-only`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(12000, preset);
      expect(r.allowed).toBe(true);
      expect(r.insertOnly).toBe(true);
    });

    it(`${preset}: at 12001 chars → not allowed with a guidance reason`, async () => {
      const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
      const r = evaluateSelectionGuard(12001, preset);
      expect(r.allowed).toBe(false);
      expect(r.insertOnly).toBe(false);
      expect(typeof r.reason).toBe('string');
      expect(r.reason).toContain('12,001자');
      expect(r.reason).toContain('12,000자');
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
  it('edit preset over limit: shows the current count and the 6,000 edit limit', async () => {
    const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
    const r = evaluateSelectionGuard(7170, 'polish');
    expect(r.reason).toContain('7,170자');
    expect(r.reason).toContain('6,000자까지');
    // 왜 잘라서라도 처리하지 않는지 설명이 함께 있어야 한다(숫자만 있으면 납득이 안 된다).
    expect(r.reason).toContain('사라져요');
  });

  it('transform preset over limit: shows the 12,000 limit, not the edit limit', async () => {
    const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
    const r = evaluateSelectionGuard(13170, 'outline');
    expect(r.reason).toContain('13,170자');
    expect(r.reason).toContain('12,000자까지');
    expect(r.reason).not.toContain('6,000자');
  });

  it('the two families name different presets so the user knows which is blocked', async () => {
    const { evaluateSelectionGuard } = await import('@/components/editor/extensions/ai-length-guard');
    expect(evaluateSelectionGuard(7170, 'custom').reason).toContain('다듬기·직접 입력');
    expect(evaluateSelectionGuard(13170, 'table').reason).toContain('개요·표·다이어그램·짧게');
  });
});

describe('SPEC-AI-013: SAFE_REPLACE_LIMIT', () => {
  it('2,000자이며 편집 한도와 별개의 상수로 export 된다', async () => {
    const g = await import('@/components/editor/extensions/ai-length-guard');
    expect(g.SAFE_REPLACE_LIMIT).toBe(2000);
    expect(g.EDIT_LIMIT).toBe(6000);
    expect(g.TRANSFORM_LIMIT).toBe(12000);
  });
});
