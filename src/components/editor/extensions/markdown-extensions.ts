// @MX:NOTE: Markdown-specific CodeMirror 6 extension bundle
// Aggregates all Markdown-related extensions into a single composable array

import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { lineNumbers, highlightActiveLine, EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import { indentWithTab } from '@codemirror/commands';
import type { Extension } from '@codemirror/state';
import { markdownSyntaxHighlighting } from './syntax-highlighting';
import { markdownKeyboardShortcuts } from './keyboard-shortcuts';

/**
 * Base editor theme providing word wrap and minimal styling.
 * The outer container height is managed by the parent component.
 */
export const editorBaseTheme: Extension = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    color: 'var(--cm-base-text)',  // Base text color: black in light mode, light gray in dark mode
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
  },
  '.cm-content': {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  '.cm-line': {
    padding: '0 8px',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--cm-active-line)',  // Subtle tint: works in both light and dark mode
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--cm-active-line)',  // Matches active line
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#858585',
  },
});

/**
 * Returns the complete set of CodeMirror 6 extensions for the Markdown editor.
 * Includes: Markdown language with nested code block support, line numbers,
 * active line highlight, word wrap, syntax highlighting, keyboard shortcuts,
 * history (undo/redo), default keymap, search keymap.
 */
export function createMarkdownExtensions(): Extension[] {
  return [
    // Markdown language with GFM support
    markdown({
      base: markdownLanguage,
    }),

    // Editor chrome
    lineNumbers(),
    highlightActiveLine(),

    // Word wrap via EditorView.lineWrapping
    EditorView.lineWrapping,

    // Syntax highlighting (VS Code style)
    markdownSyntaxHighlighting(),

    // Custom Markdown keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+/)
    markdownKeyboardShortcuts(),

    // History extension for undo/redo
    history(),

    // Default keymap (includes standard editing keys)
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),

    // Base theme
    editorBaseTheme,
  ];
}
