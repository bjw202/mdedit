// @MX:ANCHOR: [AUTO] markdownSyntaxHighlighting - VS Code-style highlighting extension used by createMarkdownExtensions
// @MX:REASON: [AUTO] Called by createMarkdownExtensions, which is called on every editor mount (fan_in >= 3)
// @MX:NOTE: VS Code-style syntax highlighting theme for CodeMirror 6 Markdown editor
// Provides color tokens for major Markdown elements following VSCode dark+ style.
// Uses CSS class-based highlighting via HighlightStyle.define (tag + class format).
// @MX:NOTE: [AUTO] Color constants use CSS variables (--cm-base-text, --cm-content) for theme-awareness in both light/dark modes

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

/**
 * Custom highlight style providing VS Code Dark+-like colors for Markdown syntax elements.
 * Uses inline styles (color, fontWeight, fontStyle) applied directly by syntaxHighlighting().
 */
export const markdownHighlightStyle = HighlightStyle.define([
  // Headings (H1-H6) - VS Code blue (#569cd6), bold; vivid enough for both modes
  { tag: tags.heading1, color: '#569cd6', fontWeight: 'bold' },
  { tag: tags.heading2, color: '#569cd6', fontWeight: 'bold' },
  { tag: tags.heading3, color: '#4fc1ff', fontWeight: 'bold' },
  { tag: tags.heading4, color: '#4fc1ff', fontWeight: 'bold' },
  { tag: tags.heading5, color: '#4fc1ff' },
  { tag: tags.heading6, color: '#4fc1ff' },
  // Strong (bold) - theme-aware: black in light mode, white in dark mode
  { tag: tags.strong, color: 'var(--cm-strong)', fontWeight: 'bold' },
  // Emphasis (italic) - inherits base text color, just applies italic style
  { tag: tags.emphasis, color: 'var(--cm-content)', fontStyle: 'italic' },
  // Inline code - VS Code string orange; visible in both modes
  { tag: tags.monospace, color: '#ce9178' },
  // URLs - VS Code link blue; visible in both modes
  { tag: tags.url, color: '#3794ff' },
  // Link text - VS Code teal; visible in both modes
  { tag: tags.link, color: '#4ec9b0' },
  // Lists - theme-aware: dark gray in light mode, light gray in dark mode
  { tag: tags.list, color: 'var(--cm-list)' },
  // Blockquotes - VS Code comment green, italic; visible in both modes
  { tag: tags.quote, color: '#6a9955', fontStyle: 'italic' },
  // HTML comments
  { tag: tags.comment, color: '#6a9955' },
  // Meta / HR / frontmatter delimiters - VS Code gold; visible in both modes
  { tag: tags.meta, color: '#d7ba7d' },
  // Punctuation (*, _, `, [], etc.) - theme-aware: gray-500 in light, gray in dark
  { tag: tags.punctuation, color: 'var(--cm-punctuation)' },
  // Plain content text - theme-aware: black in light mode, light gray in dark mode
  { tag: tags.content, color: 'var(--cm-content)' },
]);

/**
 * Returns a CodeMirror extension that applies VS Code-style Markdown syntax highlighting.
 */
export function markdownSyntaxHighlighting(): Extension {
  return syntaxHighlighting(markdownHighlightStyle);
}
