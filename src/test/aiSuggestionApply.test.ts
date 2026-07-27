// @MX:SPEC: SPEC-AI-001 REQ-AI-022 REQ-AI-033 REQ-AI-035
// TDD RED phase (T-016) — apply safeguards. dispatch 직전 원문 재검증(불일치→무손상 stale),
// 단일 트랜잭션(Mod+Z 1회 복원), insert-below 위치, 문장 경계 확장 + 확장 범위 재검증.

import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection, Transaction } from '@codemirror/state';
import { history, undo } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';

/**
 * History 를 포함한 fake view — insertTable.test.ts 패턴에 history() 를 더해 undo 로
 * "단일 트랜잭션 복원"을 검증할 수 있게 한다. dispatch 는 spec(applySuggestion)과 Transaction
 * (undo 커맨드) 양쪽을 처리한다.
 */
function createHistoryView(doc: string, from: number, to: number = from) {
  let state = EditorState.create({
    doc,
    selection: EditorSelection.single(from, to),
    extensions: [history()],
  });
  const view = {
    get state() {
      return state;
    },
    dispatch(spec: unknown) {
      state = spec instanceof Transaction ? spec.state : state.update(spec as never).state;
    },
  } as unknown as EditorView;
  return { view, getDoc: () => state.doc.toString() };
}

describe('expandToSentenceBoundary: mid-sentence range expansion (설계 §4.3)', () => {
  it('expands a mid-sentence end forward to the next terminator (inclusive)', async () => {
    const { expandToSentenceBoundary } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const doc = 'Hello world. More text';
    const r = expandToSentenceBoundary(doc, 0, 'Hello wor'.length);
    expect(doc.slice(r.from, r.to)).toBe('Hello world.');
    expect(r.expanded).toBe(true);
  });

  it('does not expand when the selection already ends at a terminator', async () => {
    const { expandToSentenceBoundary } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const doc = 'Hello world. More text';
    const r = expandToSentenceBoundary(doc, 0, 'Hello world.'.length);
    expect(r.to).toBe('Hello world.'.length);
    expect(r.expanded).toBe(false);
  });

  it('expands to the paragraph end when no terminator is present', async () => {
    const { expandToSentenceBoundary } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const doc = 'abc def\n\nnext para';
    const r = expandToSentenceBoundary(doc, 0, 'abc'.length);
    expect(r.to).toBe('abc def'.length);
    expect(r.expanded).toBe(true);
  });

  it('does not expand when the selection ends at a paragraph boundary', async () => {
    const { expandToSentenceBoundary } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const doc = 'abc def\n\nnext';
    const r = expandToSentenceBoundary(doc, 0, 'abc def'.length);
    expect(r.expanded).toBe(false);
  });
});

describe('applySuggestion: replace mode single transaction + undo (REQ-AI-022)', () => {
  it('replaces the range and one undo restores the exact original', async () => {
    const { applySuggestion } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const original = 'old sentence';
    const doc = `intro ${original} outro`;
    const from = doc.indexOf(original);
    const to = from + original.length;
    const { view, getDoc } = createHistoryView(doc, from, to);

    const result = applySuggestion(view, {
      from,
      to,
      originalText: original,
      suggestion: 'new sentence',
      mode: 'replace',
    });
    expect(result.applied).toBe(true);
    expect(getDoc()).toBe('intro new sentence outro');

    // Single transaction → one Mod+Z restores everything.
    undo(view);
    expect(getDoc()).toBe(doc);
  });
});

describe('applySuggestion: stale guard — no dispatch on mismatch (REQ-AI-035)', () => {
  it('leaves the document untouched and reports stale when the range text changed', async () => {
    const { applySuggestion } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const doc = 'the current text here';
    const from = 4;
    const to = 11; // "current"
    const { view, getDoc } = createHistoryView(doc, from, to);

    const result = applySuggestion(view, {
      from,
      to,
      originalText: 'ORIGINAL', // does not match sliceDoc(from,to) === "current"
      suggestion: 'whatever',
      mode: 'replace',
    });

    expect(result.applied).toBe(false);
    if (!result.applied) expect(result.reason).toBe('stale');
    expect(getDoc()).toBe(doc); // document untouched
  });
});

describe('applySuggestion: insert-below mode (설계 §4.2 C)', () => {
  it('keeps the original and inserts the suggestion after the paragraph with a blank line', async () => {
    const { applySuggestion } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const original = 'First paragraph line.';
    const doc = `${original}\n\nSecond paragraph.`;
    const { view, getDoc } = createHistoryView(doc, 0, original.length);

    const result = applySuggestion(view, {
      from: 0,
      to: original.length,
      originalText: original,
      suggestion: '- item one\n- item two',
      mode: 'insert-below',
    });

    expect(result.applied).toBe(true);
    const out = getDoc();
    // Original untouched and still present.
    expect(out.startsWith(original)).toBe(true);
    expect(out).toContain('Second paragraph.');
    // Suggestion inserted after the first paragraph, separated by a blank line.
    expect(out).toContain(`${original}\n\n- item one\n- item two`);

    undo(view);
    expect(getDoc()).toBe(doc);
  });

  it('inserts at document end when the selection is in the last paragraph', async () => {
    const { applySuggestion } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const doc = 'only paragraph.';
    const { view, getDoc } = createHistoryView(doc, 0, doc.length);
    applySuggestion(view, {
      from: 0,
      to: doc.length,
      originalText: doc,
      suggestion: 'appended',
      mode: 'insert-below',
    });
    expect(getDoc()).toBe(`${doc}\n\nappended`);
  });
});

// @MX:SPEC: SPEC-AI-010 REQ-AI10-018 REQ-AI10-020 REQ-AI10-021
// AC-AI10-010 (a)(b)(c)(d) — insert-below 가 문서 맨 아래가 아니라 **마크다운 블록 바로
// 다음**에 삽입한다. TDD RED phase(수정 전 작성): 현행 분기는 `docText.slice(ctx.to)
// .indexOf('\n\n')` 로 문단 끝을 찾고 빈 줄이 없으면 `view.state.doc.length` 로 폴백하므로
// (a)(b)(c) 세 케이스가 전부 문서 맨 끝으로 튄다. 위 기존 두 케이스는 무수정 통과해야 한다.
describe('applySuggestion: insert-below 가 마크다운 블록 경계를 따른다 (SPEC-AI-010)', () => {
  async function insertBelow(doc: string, from: number, to: number, suggestion: string) {
    const { applySuggestion } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const { view, getDoc } = createHistoryView(doc, from, to);
    const result = applySuggestion(view, {
      from,
      to,
      originalText: doc.slice(from, to),
      suggestion,
      mode: 'insert-below',
    });
    expect(result.applied).toBe(true);
    return getDoc();
  }

  it('(a) 제목 + 단일 개행 목록: 삽입이 제목 줄 바로 다음이다', async () => {
    const doc = '## 요약\n- 하나\n- 둘\n- 셋';
    const out = await insertBelow(doc, 0, '## 요약'.length, '추가 문단');
    expect(out).toBe('## 요약\n\n추가 문단\n- 하나\n- 둘\n- 셋');
  });

  it('(b) 표 영역: 삽입이 현재 표 행 바로 다음이며 문서 끝이 아니다', async () => {
    const doc = '| a | b |\n|---|---|\n| 1 | 2 |';
    const out = await insertBelow(doc, 0, '| a | b |'.length, '삽입 내용');
    expect(out).toBe('| a | b |\n\n삽입 내용\n|---|---|\n| 1 | 2 |');
  });

  it('(c) 여러 줄 산문 문단: 삽입이 문단 전체 뒤이며 문장 사이가 아니다', async () => {
    const doc = '첫 줄입니다\n둘째 줄입니다\n셋째 줄입니다\n## 다음 절';
    const out = await insertBelow(doc, 0, '첫 줄입니다'.length, '삽입 내용');
    expect(out).toBe('첫 줄입니다\n둘째 줄입니다\n셋째 줄입니다\n\n삽입 내용\n## 다음 절');
  });

  it('(d) 빈 줄 없이 EOF: 문서 끝에 삽입한다(현행 유지)', async () => {
    const doc = '- 하나\n- 둘\n- 셋';
    const out = await insertBelow(doc, '- 하나\n- 둘\n'.length, doc.length, '삽입 내용');
    expect(out).toBe('- 하나\n- 둘\n- 셋\n\n삽입 내용');
  });

  it('삽입 후 undo 1회로 완전 복원된다(단일 트랜잭션 구조 보존)', async () => {
    const { applySuggestion } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const doc = '## 요약\n- 하나\n- 둘';
    const { view, getDoc } = createHistoryView(doc, 0, '## 요약'.length);
    applySuggestion(view, {
      from: 0,
      to: '## 요약'.length,
      originalText: '## 요약',
      suggestion: '추가 문단',
      mode: 'insert-below',
    });
    expect(getDoc()).not.toBe(doc);
    undo(view);
    expect(getDoc()).toBe(doc);
  });

  it('원문 불일치면 insert-below 도 문서를 건드리지 않고 stale 을 반환한다', async () => {
    const { applySuggestion } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const doc = '## 요약\n- 하나\n- 둘';
    const { view, getDoc } = createHistoryView(doc, 0, '## 요약'.length);
    const result = applySuggestion(view, {
      from: 0,
      to: '## 요약'.length,
      originalText: '다른 원문',
      suggestion: '추가 문단',
      mode: 'insert-below',
    });
    expect(result.applied).toBe(false);
    if (!result.applied) expect(result.reason).toBe('stale');
    expect(getDoc()).toBe(doc);
  });
});

describe('applySuggestion: expanded-range revalidation', () => {
  it('applies against the previewed expanded range when its text still matches', async () => {
    const { applySuggestion, expandToSentenceBoundary } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const doc = 'Keep this. Extra sentence here. Tail.';
    const selFrom = 0;
    const selTo = 'Keep this. Extra'.length; // mid-sentence
    const expanded = expandToSentenceBoundary(doc, selFrom, selTo);
    const originalText = doc.slice(expanded.from, expanded.to);
    expect(originalText).toBe('Keep this. Extra sentence here.');

    const { view, getDoc } = createHistoryView(doc, expanded.from, expanded.to);
    const result = applySuggestion(view, {
      from: expanded.from,
      to: expanded.to,
      originalText,
      suggestion: 'Rewritten sentence.',
      mode: 'replace',
    });
    expect(result.applied).toBe(true);
    expect(getDoc()).toBe('Rewritten sentence. Tail.');
  });

  it('reports stale if the expanded range text no longer matches the preview', async () => {
    const { applySuggestion } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const doc = 'Keep this. Extra sentence here. Tail.';
    const from = 0;
    const to = 'Keep this. Extra sentence here.'.length;
    const { view, getDoc } = createHistoryView(doc, from, to);
    const result = applySuggestion(view, {
      from,
      to,
      originalText: 'A DIFFERENT PREVIEW',
      suggestion: 'x',
      mode: 'replace',
    });
    expect(result.applied).toBe(false);
    expect(getDoc()).toBe(doc);
  });
});
