// @MX:SPEC: SPEC-UI-008
// Tests for insertDiagram(view, preset) — mermaid diagram fence insertion helper.
// TDD RED phase: written before implementation exists in keyboard-shortcuts.ts.
// Covers: 7 preset snippets (byte-exact from spec.md) + custom empty fence,
// first-edit-token cursor placement, block padding, and mermaid 11.12.3 parse success.

import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import mermaid from 'mermaid';

/**
 * Builds a minimal fake "view" backed by a real CodeMirror EditorState.
 * `insertDiagram` only touches `view.state` and `view.dispatch`, so this is faithful.
 */
function createTestView(
  doc: string,
  from: number,
  to: number = from,
): { view: EditorView; getDoc: () => string } {
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

// Expected fenced blocks per spec.md "Preset Snippet Definitions" (byte-exact).
const EXPECTED_BLOCKS: Record<string, string> = {
  flowchart: [
    '```mermaid',
    'flowchart TD',
    '    A[시작] --> B{조건}',
    '    B -->|예| C[처리]',
    '    B -->|아니오| D[종료]',
    '```',
  ].join('\n'),
  sequenceDiagram: [
    '```mermaid',
    'sequenceDiagram',
    '    participant 사용자',
    '    participant 서버',
    '    사용자->>서버: 요청',
    '    서버-->>사용자: 응답',
    '```',
  ].join('\n'),
  gantt: [
    '```mermaid',
    'gantt',
    '    title 프로젝트 일정',
    '    dateFormat YYYY-MM-DD',
    '    section 준비',
    '    요구 분석 :a1, 2026-01-01, 7d',
    '```',
  ].join('\n'),
  classDiagram: [
    '```mermaid',
    'classDiagram',
    '    class 동물 {',
    '        +String 이름',
    '        +소리내기()',
    '    }',
    '```',
  ].join('\n'),
  stateDiagram: [
    '```mermaid',
    'stateDiagram-v2',
    '    [*] --> 대기',
    '    대기 --> 진행 : 시작',
    '    진행 --> [*]',
    '```',
  ].join('\n'),
  pie: [
    '```mermaid',
    'pie title 분포 현황',
    '    "항목 A" : 40',
    '    "항목 B" : 35',
    '    "항목 C" : 25',
    '```',
  ].join('\n'),
  mindmap: ['```mermaid', 'mindmap', '  root((중심 주제))', '    분기 A', '    분기 B', '    분기 C', '```'].join(
    '\n',
  ),
};

const FIRST_EDIT_TOKENS: Record<string, string> = {
  flowchart: '시작',
  sequenceDiagram: '사용자',
  gantt: '프로젝트 일정',
  classDiagram: '동물',
  stateDiagram: '대기',
  pie: '분포 현황',
  mindmap: '중심 주제',
};

describe('insertDiagram: preset snippet insertion (byte-exact)', () => {
  for (const preset of Object.keys(EXPECTED_BLOCKS)) {
    it(`inserts the exact ${preset} fenced block on an empty line`, async () => {
      const { insertDiagram } = await import('@/components/editor/extensions/keyboard-shortcuts');
      const { view, getDoc } = createTestView('', 0);
      const ok = insertDiagram(view, preset as never);
      expect(ok).toBe(true);
      expect(getDoc()).toBe(EXPECTED_BLOCKS[preset]);
    });

    it(`places the cursor on the first-edit token for ${preset}`, async () => {
      const { insertDiagram } = await import('@/components/editor/extensions/keyboard-shortcuts');
      const { view, getDoc } = createTestView('', 0);
      insertDiagram(view, preset as never);
      const doc = getDoc();
      const sel = view.state.selection.main;
      const token = FIRST_EDIT_TOKENS[preset];
      expect(doc.slice(sel.from, sel.to)).toBe(token);
      // must be the FIRST occurrence of the token
      expect(sel.from).toBe(doc.indexOf(token));
    });
  }
});

describe('insertDiagram: custom empty fence', () => {
  it('inserts an empty ```mermaid fence with the cursor on the empty body line', async () => {
    const { insertDiagram } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('', 0);
    const ok = insertDiagram(view, 'custom');
    expect(ok).toBe(true);
    expect(getDoc()).toBe('```mermaid\n\n```');
    const sel = view.state.selection.main;
    // cursor collapsed on the empty body line (offset right after "```mermaid\n")
    expect(sel.empty).toBe(true);
    expect(sel.from).toBe('```mermaid\n'.length);
  });
});

describe('insertDiagram: block padding around cursor position', () => {
  it('empty line insert requires no surrounding blank-line padding', async () => {
    const { insertDiagram } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('', 0);
    insertDiagram(view, 'flowchart');
    const doc = getDoc();
    expect(doc.startsWith('```mermaid')).toBe(true);
    expect(doc.endsWith('```')).toBe(true);
  });

  it('mid-line cursor pads with blank lines on both sides', async () => {
    const { insertDiagram } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const original = 'before AFTER';
    const cursor = 'before '.length;
    const { view, getDoc } = createTestView(original, cursor);
    insertDiagram(view, 'custom');
    const doc = getDoc();
    expect(doc).toBe('before \n```mermaid\n\n```\nAFTER');
  });

  it('cursor at line start (text after only) pads with a trailing blank line only', async () => {
    const { insertDiagram } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('AFTER', 0);
    insertDiagram(view, 'custom');
    expect(getDoc()).toBe('```mermaid\n\n```\nAFTER');
  });

  it('cursor at line end (text before only) pads with a leading blank line only', async () => {
    const { insertDiagram } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('BEFORE', 'BEFORE'.length);
    insertDiagram(view, 'custom');
    expect(getDoc()).toBe('BEFORE\n```mermaid\n\n```');
  });

  it('selects the correct first-edit token even with leading blank-line padding', async () => {
    const { insertDiagram } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('BEFORE', 'BEFORE'.length);
    insertDiagram(view, 'flowchart');
    const doc = getDoc();
    const sel = view.state.selection.main;
    expect(doc.slice(sel.from, sel.to)).toBe('시작');
    expect(sel.from).toBe(doc.indexOf('시작'));
  });
});

describe('insertDiagram: guards', () => {
  it('returns false for an unknown preset and leaves the document unchanged', async () => {
    const { insertDiagram } = await import('@/components/editor/extensions/keyboard-shortcuts');
    const { view, getDoc } = createTestView('unchanged', 0);
    expect(insertDiagram(view, 'not-a-preset' as never)).toBe(false);
    expect(getDoc()).toBe('unchanged');
  });
});

describe('DIAGRAM_PRESETS table', () => {
  it('lists exactly 8 items (7 presets + custom) in order', async () => {
    const { DIAGRAM_PRESETS } = await import('@/components/editor/extensions/keyboard-shortcuts');
    expect(DIAGRAM_PRESETS).toHaveLength(8);
    expect(DIAGRAM_PRESETS.map((p) => p.preset)).toEqual([
      'flowchart',
      'sequenceDiagram',
      'gantt',
      'classDiagram',
      'stateDiagram',
      'pie',
      'mindmap',
      'custom',
    ]);
  });

  it('gives every item a non-empty Korean label', async () => {
    const { DIAGRAM_PRESETS } = await import('@/components/editor/extensions/keyboard-shortcuts');
    for (const def of DIAGRAM_PRESETS) {
      expect(def.label.trim().length).toBeGreaterThan(0);
    }
  });
});

// AC-UI-008-004: the 7 preset snippet bodies parse without error under mermaid 11.12.3.
describe('preset snippets parse under mermaid 11.12.3 (AC-004)', () => {
  for (const preset of Object.keys(EXPECTED_BLOCKS)) {
    it(`mermaid.parse succeeds for the ${preset} snippet body`, async () => {
      const { DIAGRAM_PRESETS } = await import('@/components/editor/extensions/keyboard-shortcuts');
      const def = DIAGRAM_PRESETS.find((p) => p.preset === preset);
      expect(def).toBeDefined();
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
      await expect(mermaid.parse(def!.body)).resolves.toBeTruthy();
    });
  }
});
