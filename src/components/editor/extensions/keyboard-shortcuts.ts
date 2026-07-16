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
