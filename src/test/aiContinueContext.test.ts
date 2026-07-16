// @MX:SPEC: SPEC-AI-001 REQ-AI-028 REQ-AI-032
// 자유 위치 이어쓰기(문서 끝 분기) 순수 판정 — getContinueContext / evaluateHintEligibility.
// TDD RED phase: written before the Gap 2/1 implementation lands in ai-ghost-text.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...a: unknown[]) => aiRequestMock(...a),
  aiCancel: vi.fn().mockResolvedValue(undefined),
  ipcErrorMessage: (e: unknown) => String(e),
}));

function stateAt(doc: string, pos: number): EditorState {
  return EditorState.create({ doc, selection: EditorSelection.single(pos) });
}

beforeEach(() => {
  aiRequestMock.mockClear();
});

describe('getContinueContext: document-end continue-writing eligibility matrix', () => {
  it('null on an empty document', async () => {
    const { getContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const state = stateAt('', 0);
    expect(getContinueContext(state, 0)).toBeNull();
  });

  it('eligible: cursor on the trailing empty line at document end, with prior content', async () => {
    const { getContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '첫째, 재고 관리 프로세스를 자동화한다.\n둘째, \n';
    const state = stateAt(doc, doc.length);
    const ctx = getContinueContext(state, doc.length);
    expect(ctx).not.toBeNull();
    expect(ctx?.contextBefore).toBe(doc);
    expect(ctx?.outline).toEqual([]);
  });

  it('section-fill takes priority: empty heading section is not a continue-writing context', async () => {
    const { getContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const state = stateAt(doc, doc.length);
    expect(getContinueContext(state, doc.length)).toBeNull();
  });

  it('null when the empty line is in the middle of the document (not document end)', async () => {
    const { getContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '첫 문단\n\n둘째 문단';
    const emptyLinePos = doc.indexOf('\n\n') + 1; // 중간 빈 줄
    const state = stateAt(doc, emptyLinePos);
    expect(getContinueContext(state, emptyLinePos)).toBeNull();
  });

  it('never calls aiRequest (token 0 local judgment)', async () => {
    const { getContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '본문 내용.\n';
    const state = stateAt(doc, doc.length);
    getContinueContext(state, doc.length);
    expect(aiRequestMock).not.toHaveBeenCalled();
  });
});

describe('evaluateHintEligibility: unified hint judgment (section-fill wins over continue)', () => {
  it('returns section-fill kind for empty heading section', async () => {
    const { evaluateHintEligibility } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const state = stateAt(doc, doc.length);
    expect(evaluateHintEligibility(state, doc.length)).toEqual({ kind: 'section-fill' });
  });

  it('returns continue kind at document end with prior content', async () => {
    const { evaluateHintEligibility } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '본문 내용.\n';
    const state = stateAt(doc, doc.length);
    expect(evaluateHintEligibility(state, doc.length)).toEqual({ kind: 'continue' });
  });

  it('returns null when neither condition is met', async () => {
    const { evaluateHintEligibility } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '첫 문단\n\n둘째 문단';
    const emptyLinePos = doc.indexOf('\n\n') + 1;
    const state = stateAt(doc, emptyLinePos);
    expect(evaluateHintEligibility(state, emptyLinePos)).toBeNull();
  });
});
