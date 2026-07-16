// @MX:SPEC: SPEC-AI-001 REQ-AI-023 REQ-AI-024
// Tests for validateMermaid / buildFallbackDecision — 설계서 §4.2 시나리오 C (삽입 전 strict 검증 + 목록 폴백).
// TDD RED phase: written before src/lib/ai/mermaidValidate.ts exists.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// mermaid.parse is stubbed so validation branches are deterministic and DOM-free (jsdom).
// PreviewRenderer.test.tsx mirrors this mock shape.
const parseMock = vi.fn();
const initializeMock = vi.fn();
vi.mock('mermaid', () => ({
  default: {
    initialize: (...args: unknown[]) => initializeMock(...args),
    parse: (...args: unknown[]) => parseMock(...args),
  },
}));

beforeEach(() => {
  parseMock.mockReset();
  initializeMock.mockReset();
});

describe('validateMermaid: parse-based syntax validation', () => {
  it('a valid flowchart resolves to { valid: true }', async () => {
    parseMock.mockResolvedValue(true);
    const { validateMermaid } = await import('@/lib/ai/mermaidValidate');
    const result = await validateMermaid('flowchart LR\n  A[접수] --> B[검토] --> C{승인?}');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('a broken diagram resolves to { valid: false } carrying the parser error', async () => {
    parseMock.mockRejectedValue(new Error('Parse error on line 2'));
    const { validateMermaid } = await import('@/lib/ai/mermaidValidate');
    const result = await validateMermaid('flowchart LR\n  A -->');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Parse error');
  });

  it('initializes mermaid with securityLevel strict before parsing (never weakened)', async () => {
    parseMock.mockResolvedValue(true);
    const { validateMermaid, MERMAID_STRICT_CONFIG } = await import('@/lib/ai/mermaidValidate');
    await validateMermaid('flowchart LR\n  A --> B');
    expect(initializeMock).toHaveBeenCalled();
    const passedConfig = initializeMock.mock.calls[0][0] as { securityLevel?: string };
    expect(passedConfig.securityLevel).toBe('strict');
    // the exported base config must also assert strict as a compile-time contract
    expect(MERMAID_STRICT_CONFIG.securityLevel).toBe('strict');
  });
});

describe('buildFallbackDecision: retry-then-list-fallback branching', () => {
  it('first failure (attempt 1) signals an automatic single retry', async () => {
    const { buildFallbackDecision } = await import('@/lib/ai/mermaidValidate');
    expect(buildFallbackDecision(1).action).toBe('auto-retry');
  });

  it('second failure (attempt 2) offers the list fallback', async () => {
    const { buildFallbackDecision } = await import('@/lib/ai/mermaidValidate');
    expect(buildFallbackDecision(2).action).toBe('offer-list-fallback');
  });

  it('further failures keep offering the list fallback (no infinite retry)', async () => {
    const { buildFallbackDecision } = await import('@/lib/ai/mermaidValidate');
    expect(buildFallbackDecision(3).action).toBe('offer-list-fallback');
  });
});
