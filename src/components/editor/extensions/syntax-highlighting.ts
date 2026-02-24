// @MX:NOTE: VS Code-style syntax highlighting theme for CodeMirror 6 Markdown editor
// Provides color tokens for major Markdown elements following VSCode dark+ style.
// Uses CSS class-based highlighting via HighlightStyle.define (tag + class format).

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

/**
 * Custom highlight style providing VS Code Dark+-like colors for Markdown syntax elements.
 * Uses inline styles (color, fontWeight, fontStyle) applied directly by syntaxHighlighting().
 */
export const markdownHighlightStyle = HighlightStyle.define([
  // Headings (H1-H6) - VS Code blue (#569cd6), bold
  { tag: tags.heading1, color: '#569cd6', fontWeight: 'bold' },
  { tag: tags.heading2, color: '#569cd6', fontWeight: 'bold' },
  { tag: tags.heading3, color: '#4fc1ff', fontWeight: 'bold' },
  { tag: tags.heading4, color: '#4fc1ff', fontWeight: 'bold' },
  { tag: tags.heading5, color: '#4fc1ff' },
  { tag: tags.heading6, color: '#4fc1ff' },
  // Strong (bold) - white-ish, bold weight
  { tag: tags.strong, fontWeight: 'bold' },
  // Emphasis (italic)
  { tag: tags.emphasis, fontStyle: 'italic' },
  // Inline code - VS Code string orange (#ce9178)
  { tag: tags.monospace, color: '#ce9178' },
  // URLs - VS Code link blue
  { tag: tags.url, color: '#3794ff' },
  // Link text - VS Code teal
  { tag: tags.link, color: '#4ec9b0' },
  // Lists
  { tag: tags.list, color: '#cccccc' },
  // Blockquotes - VS Code comment green, italic
  { tag: tags.quote, color: '#6a9955', fontStyle: 'italic' },
  // HTML comments
  { tag: tags.comment, color: '#6a9955' },
  // Meta / HR / frontmatter delimiters - VS Code gold
  { tag: tags.meta, color: '#d7ba7d' },
  // Punctuation (*, _, `, [], etc.) - medium gray
  { tag: tags.punctuation, color: '#808080' },
  // Plain content text
  { tag: tags.content, color: '#d4d4d4' },
]);

/**
 * Returns a CodeMirror extension that applies VS Code-style Markdown syntax highlighting.
 */
export function markdownSyntaxHighlighting(): Extension {
  return syntaxHighlighting(markdownHighlightStyle);
}
