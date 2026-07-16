// @MX:SPEC: SPEC-UI-007
// Tests for insertTable(view, rows, cols) — Markdown table skeleton insertion helper.
// TDD RED phase: written before implementation exists in keyboard-shortcuts.ts.

import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/**
 * Builds a minimal fake "view" backed by a real CodeMirror EditorState.
 * `dispatch` applies the TransactionSpec to the state exactly like a real
 * EditorView would, without requiring a mounted DOM tree. `insertTable`
 * only touches `view.state` and `view.dispatch`, so this is a faithful stand-in.
 */
function createTestView(doc: string, from: number, to: number = from): { view: EditorView; getDoc: () => string } {
  let state = EditorState.create({ doc, selection: EditorSelection.single(from, to) });
  const view = {
    get state() {
      return state;
    },
    dispatch(spec: Parameters<EditorState['update']>[0]) {
      state = state.update(spec).state;
    },
  } as unknown as EditorView;
  return { view, getDoc: () => state.doc.toString() };
}

describe('insertTable: skeleton generation', () => {
  it('inserts exact skeleton on an empty line (3 rows total, 4 cols)', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('', 0);
    insertTable(view, 3, 4);

    const expected = [
      '| Header 1 | Header 2 | Header 3 | Header 4 |',
      '| --- | --- | --- | --- |',
      '|     |     |     |     |',
      '|     |     |     |     |',
    ].join('\n');
    expect(getDoc()).toBe(expected);
  });

  it('1x1 boundary: header row + delimiter only, zero body rows', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('', 0);
    insertTable(view, 1, 1);

    const expected = ['| Header 1 |', '| --- |'].join('\n');
    expect(getDoc()).toBe(expected);
  });

  it('8x8 boundary: header row + 8 cols + 7 body rows', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('', 0);
    insertTable(view, 8, 8);

    const doc = getDoc();
    const lines = doc.split('\n');
    expect(lines).toHaveLength(2 + 7); // header + delimiter + 7 body rows
    expect(lines[0]).toBe(
      '| Header 1 | Header 2 | Header 3 | Header 4 | Header 5 | Header 6 | Header 7 | Header 8 |',
    );
    expect(lines[1]).toBe('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (let i = 2; i < lines.length; i++) {
      expect(lines[i]).toBe('|     |     |     |     |     |     |     |     |');
    }
  });

  it('empty body cells use space-padded "|     |" style', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('', 0);
    insertTable(view, 2, 1);

    const lines = getDoc().split('\n');
    expect(lines[2]).toBe('|     |');
  });
});

describe('insertTable: block padding around cursor position', () => {
  it('empty line insert requires no surrounding blank-line padding', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('', 0);
    insertTable(view, 2, 2);

    const doc = getDoc();
    expect(doc.startsWith('| Header 1')).toBe(true);
    expect(doc.endsWith('|     |     |')).toBe(true);
  });

  it('mid-line cursor pads with blank lines on both sides', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const original = 'before AFTER';
    const cursor = 'before '.length; // mid-line: text before AND after cursor
    const { view, getDoc } = createTestView(original, cursor);
    insertTable(view, 2, 1);

    const doc = getDoc();
    const skeleton = ['| Header 1 |', '| --- |', '|     |'].join('\n');
    expect(doc).toBe(`before \n${skeleton}\nAFTER`);
  });

  it('cursor at line start (text after only) pads with a trailing blank line only', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const original = 'AFTER';
    const { view, getDoc } = createTestView(original, 0);
    insertTable(view, 2, 1);

    const doc = getDoc();
    const skeleton = ['| Header 1 |', '| --- |', '|     |'].join('\n');
    expect(doc).toBe(`${skeleton}\nAFTER`);
  });

  it('cursor at line end (text before only) pads with a leading blank line only', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const original = 'BEFORE';
    const { view, getDoc } = createTestView(original, original.length);
    insertTable(view, 2, 1);

    const doc = getDoc();
    const skeleton = ['| Header 1 |', '| --- |', '|     |'].join('\n');
    expect(doc).toBe(`BEFORE\n${skeleton}`);
  });
});

describe('insertTable: bounds guard (evaluator-active finding #1)', () => {
  it('rows=0 returns false, leaves the document unchanged, and does not throw', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('unchanged', 0);
    let result: boolean | undefined;
    expect(() => {
      result = insertTable(view, 0, 3);
    }).not.toThrow();
    expect(result).toBe(false);
    expect(getDoc()).toBe('unchanged');
  });

  it('cols=0 returns false, leaves the document unchanged, and does not throw', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('unchanged', 0);
    let result: boolean | undefined;
    expect(() => {
      result = insertTable(view, 3, 0);
    }).not.toThrow();
    expect(result).toBe(false);
    expect(getDoc()).toBe('unchanged');
  });

  it('negative rows/cols are rejected without throwing', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('unchanged', 0);
    expect(insertTable(view, -1, 3)).toBe(false);
    expect(insertTable(view, 3, -1)).toBe(false);
    expect(getDoc()).toBe('unchanged');
  });

  it('9x9 (exceeds SPEC max of 8x8) returns false and leaves the document unchanged', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('unchanged', 0);
    expect(insertTable(view, 9, 9)).toBe(false);
    expect(getDoc()).toBe('unchanged');
  });

  it('rows=9 with valid cols is rejected', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('unchanged', 0);
    expect(insertTable(view, 9, 4)).toBe(false);
    expect(getDoc()).toBe('unchanged');
  });

  it('cols=9 with valid rows is rejected', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('unchanged', 0);
    expect(insertTable(view, 4, 9)).toBe(false);
    expect(getDoc()).toBe('unchanged');
  });
});

describe('insertTable: post-insert selection', () => {
  it('selects the literal "Header 1" text in the first header cell', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('', 0);
    insertTable(view, 2, 2);

    const doc = getDoc();
    const sel = view.state.selection.main;
    expect(doc.slice(sel.from, sel.to)).toBe('Header 1');
  });

  it('selects the correct "Header 1" range even with leading blank-line padding', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const original = 'BEFORE';
    const { view, getDoc } = createTestView(original, original.length);
    insertTable(view, 2, 1);

    const doc = getDoc();
    const sel = view.state.selection.main;
    expect(doc.slice(sel.from, sel.to)).toBe('Header 1');
    // Sanity: it is the FIRST occurrence right after the leading blank line
    expect(sel.from).toBe(doc.indexOf('Header 1'));
  });

  it('returns true on successful dispatch', async () => {
    const { insertTable } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view } = createTestView('', 0);
    const result = insertTable(view, 1, 1);
    expect(result).toBe(true);
  });
});
