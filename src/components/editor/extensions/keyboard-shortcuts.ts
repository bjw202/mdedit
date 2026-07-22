// @MX:NOTE: Custom keyboard shortcuts for Markdown editing operations
// Wraps selection with Markdown syntax tokens (bold, italic, comment toggle)
// Prefixes lines with Markdown block tokens (heading, list, quote)

import { keymap } from '@codemirror/view';
import type { KeyBinding } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import type { Extension } from '@codemirror/state';

/**
 * Wraps the current selection with the given prefix and suffix tokens.
 * If there is no selection, inserts the tokens with the cursor placed between them.
 * If the selection is already wrapped, unwraps it.
 */
export function wrapSelection(view: EditorView, before: string, after: string): boolean {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const selectedText = state.sliceDoc(range.from, range.to);

    // Check if already wrapped - if so, unwrap
    if (selectedText.startsWith(before) && selectedText.endsWith(after)) {
      const unwrapped = selectedText.slice(before.length, selectedText.length - after.length);
      return {
        changes: { from: range.from, to: range.to, insert: unwrapped },
        range: EditorSelection.range(range.from, range.from + unwrapped.length),
      };
    }

    // No selection: insert tokens with cursor between them
    if (range.from === range.to) {
      const inserted = before + after;
      return {
        changes: { from: range.from, to: range.to, insert: inserted },
        range: EditorSelection.cursor(range.from + before.length),
      };
    }

    // Wrap the selection
    const wrapped = before + selectedText + after;
    return {
      changes: { from: range.from, to: range.to, insert: wrapped },
      range: EditorSelection.range(
        range.from + before.length,
        range.from + before.length + selectedText.length,
      ),
    };
  });

  view.dispatch(changes);
  return true;
}

/**
 * Prefixes the current line(s) with the given prefix string.
 * If the line already starts with the prefix, removes it (toggle behavior).
 * Handles multiple selections by operating on each selected line independently.
 */
export function prefixLine(view: EditorView, prefix: string): boolean {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const lineText = line.text;

    if (lineText.startsWith(prefix)) {
      // Remove the prefix
      const newText = lineText.slice(prefix.length);
      const newLength = newText.length;
      return {
        changes: { from: line.from, to: line.to, insert: newText },
        range: EditorSelection.range(
          Math.max(line.from, range.from - prefix.length),
          Math.min(line.from + newLength, range.to - prefix.length),
        ),
      };
    }

    // Add the prefix
    return {
      changes: { from: line.from, to: line.from, insert: prefix },
      range: EditorSelection.range(
        range.from + prefix.length,
        range.to + prefix.length,
      ),
    };
  });

  view.dispatch(changes);
  return true;
}

// @MX:NOTE: [AUTO] Markdown 테이블 스켈레톤 삽입 규칙 — rows는 헤더 포함 총 행 수(rows-1개 공백
// 패딩 빈 본문 행 생성), 커서가 줄 중간이면 앞뒤 빈 줄로 블록화, 삽입 후 첫 "Header 1" 플레이스홀더를
// 선택 상태로 만들어 즉시 타이핑 시 교체되도록 한다.
// @MX:SPEC: SPEC-UI-007
/**
 * Builds a Markdown table skeleton string.
 * `rows` is the TOTAL row count including the header row (body rows = rows - 1).
 * Empty body cells use a space-padded style (`|     |`) so GFM tables render correctly
 * even before the user fills them in.
 */
function buildTableSkeleton(rows: number, cols: number): string {
  const headerCells = Array.from({ length: cols }, (_, i) => `Header ${i + 1}`);
  const header = `| ${headerCells.join(' | ')} |`;
  const delimiter = `| ${Array(cols).fill('---').join(' | ')} |`;
  const emptyRow = `|${Array(cols).fill('     ').join('|')}|`;
  const bodyRowCount = rows - 1;
  const bodyRows = Array<string>(bodyRowCount).fill(emptyRow);
  return [header, delimiter, ...bodyRows].join('\n');
}

/**
 * Inserts a Markdown table skeleton at the current cursor position.
 * `rows` is the total row count including the header (1 header + (rows-1) body rows).
 * If the cursor sits mid-line, blank lines are inserted before/after so the table
 * becomes a standalone block. After insertion, the first "Header 1" placeholder is
 * selected so the user can immediately overtype it.
 */
export function insertTable(view: EditorView, rows: number, cols: number): boolean {
  // @MX:NOTE: [AUTO] SPEC-UI-007 그리드 상한은 8x8 — 범위를 벗어나면 no-op으로 조용히 반환한다
  // (evaluator-active finding #1: rows=0/cols=0 등 비정상 입력 시 Array(n-1).fill이 RangeError를 던지던 결함 수정).
  if (rows < 1 || cols < 1 || rows > 8 || cols > 8) return false;

  const { state } = view;
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const skeleton = buildTableSkeleton(rows, cols);

    const needsLeadingPad = range.from > line.from;
    const needsTrailingPad = range.to < line.to;
    const insertText = (needsLeadingPad ? '\n' : '') + skeleton + (needsTrailingPad ? '\n' : '');

    const headerOffset = insertText.indexOf('Header 1');
    const selStart = range.from + headerOffset;
    const selEnd = selStart + 'Header 1'.length;

    return {
      changes: { from: range.from, to: range.to, insert: insertText },
      range: EditorSelection.range(selStart, selEnd),
    };
  });

  view.dispatch(changes);
  return true;
}

// @MX:NOTE: [AUTO] SPEC-UI-008 다이어그램 프리셋 삽입 규칙 — 각 프리셋은 ```mermaid 펜스로 감싼
// 3–5줄 한글 최소 예제를 삽입한다. 스니펫 body 문자열은 spec.md "Preset Snippet Definitions"의
// 고정본과 문자 단위로 일치해야 하며(mermaid 11.12.3 검증 완료), token은 삽입 후 커서를 놓을
// "첫 사용자 편집 토큰"이다(custom은 token=null → 빈 펜스 본문 줄에 커서). 커서가 줄 중간이면
// insertTable과 동일한 앞뒤 빈 줄 패딩으로 독립 블록화한다.
// @MX:SPEC: SPEC-UI-008
export type DiagramPreset =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'gantt'
  | 'classDiagram'
  | 'stateDiagram'
  | 'pie'
  | 'mindmap'
  | 'custom';

// @MX:NOTE: [AUTO] SPEC-AI-008: AI 다이어그램 종류 선택 union — 수동 삽입 DiagramPreset 에서
// 'custom'(빈 펜스)을 제외한 7종. AI 생성 프롬프트 종류 제약(diagramType)이 이 키를 실어 보낸다.
// @MX:SPEC: SPEC-AI-008
export type DiagramType = Exclude<DiagramPreset, 'custom'>;

export interface DiagramPresetDef {
  /** stable preset key (union member) */
  preset: DiagramPreset;
  /** Korean menu label shown in the dropdown */
  label: string;
  /** fence body between ```mermaid and ``` (empty string for custom) */
  body: string;
  /** first user-edit token to place the cursor on; null = collapsed cursor on the body line */
  token: string | null;
}

const MERMAID_FENCE_OPEN = '```mermaid\n';
const MERMAID_FENCE_CLOSE = '\n```';

export const DIAGRAM_PRESETS: readonly DiagramPresetDef[] = [
  {
    preset: 'flowchart',
    label: '순서도',
    body: ['flowchart TD', '    A[시작] --> B{조건}', '    B -->|예| C[처리]', '    B -->|아니오| D[종료]'].join(
      '\n',
    ),
    token: '시작',
  },
  {
    preset: 'sequenceDiagram',
    label: '시퀀스 다이어그램',
    body: [
      'sequenceDiagram',
      '    participant 사용자',
      '    participant 서버',
      '    사용자->>서버: 요청',
      '    서버-->>사용자: 응답',
    ].join('\n'),
    token: '사용자',
  },
  {
    preset: 'gantt',
    label: '간트 차트',
    body: [
      'gantt',
      '    title 프로젝트 일정',
      '    dateFormat YYYY-MM-DD',
      '    section 준비',
      '    요구 분석 :a1, 2026-01-01, 7d',
    ].join('\n'),
    token: '프로젝트 일정',
  },
  {
    preset: 'classDiagram',
    label: '클래스 다이어그램',
    body: ['classDiagram', '    class 동물 {', '        +String 이름', '        +소리내기()', '    }'].join('\n'),
    token: '동물',
  },
  {
    preset: 'stateDiagram',
    label: '상태 다이어그램',
    body: ['stateDiagram-v2', '    [*] --> 대기', '    대기 --> 진행 : 시작', '    진행 --> [*]'].join('\n'),
    token: '대기',
  },
  {
    preset: 'pie',
    label: '파이 차트',
    body: ['pie title 분포 현황', '    "항목 A" : 40', '    "항목 B" : 35', '    "항목 C" : 25'].join('\n'),
    token: '분포 현황',
  },
  {
    preset: 'mindmap',
    label: '마인드맵',
    body: ['mindmap', '  root((중심 주제))', '    분기 A', '    분기 B', '    분기 C'].join('\n'),
    token: '중심 주제',
  },
  {
    preset: 'custom',
    label: '사용자 정의(빈 다이어그램)',
    body: '',
    token: null,
  },
];

/**
 * Inserts a ```mermaid fenced block for the given diagram preset at the cursor.
 * Presets insert a byte-exact 3–5 line Korean example and select the first edit token.
 * `custom` inserts an empty fence with the cursor on the blank body line.
 * If the cursor sits mid-line, blank lines are inserted so the fence is a standalone block.
 * Returns false (no-op) for an unknown preset.
 */
export function insertDiagram(view: EditorView, preset: DiagramPreset): boolean {
  const def = DIAGRAM_PRESETS.find((p) => p.preset === preset);
  if (!def) return false;

  const block = MERMAID_FENCE_OPEN + def.body + MERMAID_FENCE_CLOSE;

  const { state } = view;
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const needsLeadingPad = range.from > line.from;
    const needsTrailingPad = range.to < line.to;
    const insertText = (needsLeadingPad ? '\n' : '') + block + (needsTrailingPad ? '\n' : '');

    if (def.token === null) {
      // custom: collapsed cursor on the empty body line (right after "```mermaid\n")
      const cursorPos = range.from + (needsLeadingPad ? 1 : 0) + MERMAID_FENCE_OPEN.length;
      return {
        changes: { from: range.from, to: range.to, insert: insertText },
        range: EditorSelection.cursor(cursorPos),
      };
    }

    const tokenOffset = insertText.indexOf(def.token);
    const selStart = range.from + tokenOffset;
    const selEnd = selStart + def.token.length;
    return {
      changes: { from: range.from, to: range.to, insert: insertText },
      range: EditorSelection.range(selStart, selEnd),
    };
  });

  view.dispatch(changes);
  return true;
}

/**
 * Toggles HTML comment wrapping: <!-- selection -->
 * If no selection, inserts <!-- --> with cursor placed inside.
 */
function toggleComment(view: EditorView): boolean {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const selectedText = state.sliceDoc(range.from, range.to);
    const commentStart = '<!-- ';
    const commentEnd = ' -->';

    if (selectedText.startsWith(commentStart) && selectedText.endsWith(commentEnd)) {
      const unwrapped = selectedText.slice(commentStart.length, selectedText.length - commentEnd.length);
      return {
        changes: { from: range.from, to: range.to, insert: unwrapped },
        range: EditorSelection.range(range.from, range.from + unwrapped.length),
      };
    }

    const wrapped = commentStart + selectedText + commentEnd;
    return {
      changes: { from: range.from, to: range.to, insert: wrapped },
      range: EditorSelection.range(
        range.from + commentStart.length,
        range.from + commentStart.length + selectedText.length,
      ),
    };
  });

  view.dispatch(changes);
  return true;
}

/**
 * Keyboard binding definitions for Markdown formatting shortcuts.
 * These are bundled into the markdownKeyboardShortcuts extension.
 */
export const markdownKeyBindings: readonly KeyBinding[] = [
  {
    key: 'Mod-b',
    run: (view) => wrapSelection(view, '**', '**'),
    preventDefault: true,
  },
  {
    key: 'Mod-i',
    run: (view) => wrapSelection(view, '*', '*'),
    preventDefault: true,
  },
  {
    key: 'Ctrl-/',
    run: toggleComment,
    preventDefault: true,
  },
];

/**
 * Returns a CodeMirror extension that registers custom Markdown keyboard shortcuts.
 * Ctrl+B / Cmd+B: bold, Ctrl+I / Cmd+I: italic, Ctrl+/: HTML comment toggle
 */
export function markdownKeyboardShortcuts(): Extension {
  return keymap.of([...markdownKeyBindings]);
}
