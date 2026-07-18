// @MX:SPEC: SPEC-AI-004
// Tests for validateMarkdownTable + the card's table validation path.
// 다이어그램 사전 검증(mermaidValidate.test.ts)과 대칭 구조. 표는 목록 폴백이 없고,
// 재시도 상한에 닿으면 원문 그대로 일반 complete 로 통과한다.

import { describe, it, expect, vi } from 'vitest';

describe('validateMarkdownTable: table detection', () => {
  it('a well-formed GFM table is valid', async () => {
    const { validateMarkdownTable } = await import('@/lib/ai/tableValidate');
    const result = validateMarkdownTable(
      ['| 항목 | 설명 |', '| --- | --- |', '| 접수 | 최초 |', '| 검토 | 담당 |'].join('\n'),
    );
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('a table missing the |---|---| separator is invalid and the error names the separator', async () => {
    const { validateMarkdownTable } = await import('@/lib/ai/tableValidate');
    const result = validateMarkdownTable('| 항목 | 설명 |\n| 접수 | 최초 |');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('|---|---|');
  });

  // 모델이 응답을 코드펜스로 감싸면 fence 토큰이 되어 table_open 이 없다 —
  // 별도 펜스 제거 로직 없이 검사 (a) 하나로 걸린다.
  it('a fence-wrapped table is invalid (check (a) covers fences)', async () => {
    const { validateMarkdownTable } = await import('@/lib/ai/tableValidate');
    const result = validateMarkdownTable(
      ['```markdown', '| 항목 | 설명 |', '| --- | --- |', '| 접수 | 최초 |', '```'].join('\n'),
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('표가 감지되지 않았어요');
  });

  it('plain prose is invalid', async () => {
    const { validateMarkdownTable } = await import('@/lib/ai/tableValidate');
    expect(validateMarkdownTable('접수 절차는 다음과 같습니다. 먼저 신청서를 작성하세요.').valid).toBe(
      false,
    );
  });
});

describe('validateMarkdownTable: column count consistency', () => {
  it('a body row with MORE cells than the header is invalid and names both counts', async () => {
    const { validateMarkdownTable } = await import('@/lib/ai/tableValidate');
    const result = validateMarkdownTable(
      ['| A | B | C |', '| --- | --- | --- |', '| 1 | 2 | 3 |', '| 4 | 5 | 6 | 7 |'].join('\n'),
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('헤더는 3열');
    expect(result.error).toContain('2번째 행은 4열');
  });

  it('a body row with FEWER cells than the header is invalid and names both counts', async () => {
    const { validateMarkdownTable } = await import('@/lib/ai/tableValidate');
    const result = validateMarkdownTable(
      ['| A | B | C |', '| --- | --- | --- |', '| 1 | 2 |'].join('\n'),
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('헤더는 3열');
    expect(result.error).toContain('1번째 행은 2열');
  });

  it('a header-only table (no body rows) is valid', async () => {
    const { validateMarkdownTable } = await import('@/lib/ai/tableValidate');
    expect(validateMarkdownTable('| A | B |\n| --- | --- |').valid).toBe(true);
  });

  // 이스케이프된 파이프는 셀 구분자가 아니다 — 실제 렌더 결과와 셀 수 해석이 어긋나면 안 된다.
  it('an escaped pipe inside a cell does not count as a separator', async () => {
    const { validateMarkdownTable } = await import('@/lib/ai/tableValidate');
    expect(
      validateMarkdownTable(['| A | B |', '| --- | --- |', '| a \\| b | c |'].join('\n')).valid,
    ).toBe(true);
  });
});

describe('AiSuggestionCardController: table validation path', () => {
  const tableModel = {
    requestId: 'tbl-1',
    presetKind: 'table' as const,
    range: { from: 0, to: 5 },
    originalText: 'hello',
    insertOnly: false,
    model: 'haiku' as const,
  };
  const BROKEN = '| A | B |\n| 1 | 2 |'; // 구분선 누락
  const GOOD = '| A | B |\n| --- | --- |\n| 1 | 2 |';

  const makeCallbacks = () => ({
    onApply: vi.fn(),
    onCancel: vi.fn(),
    onReRequest: vi.fn(),
    onListFallback: vi.fn(),
  });

  it('a valid table takes the normal complete path with no re-request', async () => {
    const { AiSuggestionCardController } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const cb = makeCallbacks();
    const ctrl = new AiSuggestionCardController(tableModel, cb);
    ctrl.onComplete(GOOD);
    expect(cb.onReRequest).not.toHaveBeenCalled();
    expect(ctrl.getState().phase).toBe('done');
    expect(ctrl.getState().suggestion).toBe(GOOD);
  });

  it('an invalid table triggers exactly one re-request carrying the error', async () => {
    const { AiSuggestionCardController } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const cb = makeCallbacks();
    const ctrl = new AiSuggestionCardController(tableModel, cb);
    ctrl.onComplete(BROKEN);
    expect(cb.onReRequest).toHaveBeenCalledTimes(1);
    expect(cb.onReRequest.mock.calls[0][0]).toContain('구분선');
    expect(ctrl.getState().phase).toBe('streaming');
  });

  // BUG-6 회귀 가드: 재요청 응답이 또 무효여도 절대 다시 재요청하지 않고,
  // 사용자가 직접 판단하도록 원문 그대로 일반 complete 경로로 떨어져야 한다.
  it('BUG-6 regression: a second invalid table reaches the normal complete path and never re-requests again', async () => {
    const { AiSuggestionCardController } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const cb = makeCallbacks();
    const ctrl = new AiSuggestionCardController(tableModel, cb);
    ctrl.onComplete(BROKEN);
    expect(cb.onReRequest).toHaveBeenCalledTimes(1);

    ctrl.onComplete(BROKEN);
    expect(cb.onReRequest).toHaveBeenCalledTimes(1); // 추가 재요청 없음
    expect(ctrl.getState().phase).toBe('done');
    expect(ctrl.getState().suggestion).toBe(BROKEN);

    // 상한 도달 후에는 검증 분기 자체로 되돌아갈 길이 없다.
    ctrl.onComplete(BROKEN);
    expect(cb.onReRequest).toHaveBeenCalledTimes(1);
    expect(ctrl.getState().phase).toBe('done');
  });

  it('non-table presets are unaffected by table validation', async () => {
    const { AiSuggestionCardController } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const cb = makeCallbacks();
    const ctrl = new AiSuggestionCardController({ ...tableModel, presetKind: 'polish' }, cb);
    ctrl.onComplete(BROKEN);
    expect(cb.onReRequest).not.toHaveBeenCalled();
    expect(ctrl.getState().phase).toBe('done');
  });
});
