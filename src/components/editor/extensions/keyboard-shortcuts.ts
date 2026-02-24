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
