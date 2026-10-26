// @MX:SPEC: SPEC-AI-001 REQ-AI-023 REQ-AI-024
// @MX:SPEC: SPEC-PREVIEW-015 REQ-PREVIEW015-012
// Tests for validateMermaid / buildFallbackDecision — 설계서 §4.2 시나리오 C (삽입 전 검증 + 목록 폴백).
// SPEC-PREVIEW-015: 검증은 실제 pele 1.10.0으로 다이어그램 모듈의 렌더 함수를 거친다(mock 없음).
// pele는 통과형 감시 래퍼로만 감싼다(실제 구현에 그대로 위임 — acceptance.md mock 원칙).

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pele', async (importOriginal) => {
  const real = await importOriginal<typeof import('pele')>();
  return { ...real, render: vi.fn(real.render) };
});

import { render as peleRender } from 'pele';
import { renderDiagram, PELE_RENDER_OPTIONS } from '@/lib/diagram/diagramRenderer';
import * as mermaidValidate from '@/lib/ai/mermaidValidate';
import { validateMermaid, buildFallbackDecision } from '@/lib/ai/mermaidValidate';

const peleMock = vi.mocked(peleRender);

const VALID = 'flowchart LR\n  A[접수] --> B[검토] --> C{승인?}';
const UNSUPPORTED = 'notarealdiagramtype foo!!!';
// M1 문법 오류 샘플(위치 있음, pele syntax line 2 column 14).
const SYNTAX = 'sequenceDiagram\n  A->>B hello';

beforeEach(() => {
  peleMock.mockClear();
});

function errorMessageOf(source: string): string {
  const r = renderDiagram(source);
  if (r.ok) throw new Error(`expected rejection for ${source}`);
  return r.error.message;
}

describe('validateMermaid: 다이어그램 모듈 렌더 기반 검증 (AC-PREVIEW015-014)', () => {
  it('a valid flowchart resolves to { valid: true } and returns a Promise', async () => {
    const pending = validateMermaid(VALID);
    expect(pending).toBeInstanceOf(Promise);
    const result = await pending;
    expect(result).toEqual({ valid: true });
  });

  it.each([
    ['unsupported-diagram', UNSUPPORTED],
    ['syntax', SYNTAX],
  ])('거부 소스(%s)는 { valid: false, error }이고 error는 모듈이 받은 PeleError.message와 같은 문자열이다', async (_k, source) => {
    const expected = errorMessageOf(source);
    expect(expected.length).toBeGreaterThan(0);
    const result = await validateMermaid(source);
    expect(result).toEqual({ valid: false, error: expected });
  });

  it('syntax 오류 메시지는 실제 pele 파서 문구를 담는다(손으로 쓴 문구가 아님)', async () => {
    const result = await validateMermaid(SYNTAX);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Parse error on line 2');
  });

  it('미리보기와 같은 렌더 함수를 같은 고정 옵션으로 정확히 1회 호출한다', async () => {
    await validateMermaid(VALID);
    expect(peleMock).toHaveBeenCalledTimes(1);
    const [source, options] = peleMock.mock.calls[0];
    expect(source).toBe(VALID);
    expect(options).toMatchObject(PELE_RENDER_OPTIONS);
  });

  it('유효 판정된 코드는 같은 모듈로 SVG가 된다', async () => {
    expect((await validateMermaid(VALID)).valid).toBe(true);
    const r = renderDiagram(VALID);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.svg).toContain('<svg');
  });

  it('mermaid 전역 설정 상수(MERMAID_STRICT_CONFIG)를 더 이상 내보내지 않는다', () => {
    expect('MERMAID_STRICT_CONFIG' in mermaidValidate).toBe(false);
  });
});

describe('buildFallbackDecision: retry-then-list-fallback branching', () => {
  it('first failure (attempt 1) signals an automatic single retry', () => {
    expect(buildFallbackDecision(1).action).toBe('auto-retry');
  });

  it('second failure (attempt 2) offers the list fallback', () => {
    expect(buildFallbackDecision(2).action).toBe('offer-list-fallback');
  });

  it('further failures keep offering the list fallback (no infinite retry)', () => {
    expect(buildFallbackDecision(3).action).toBe('offer-list-fallback');
  });
});
