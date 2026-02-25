// @MX:NOTE: [AUTO] Export types for SPEC-EXPORT-001 - Markdown document export (PDF/HTML/DOCX)
// @MX:SPEC: SPEC-EXPORT-001

import type { ShikiHighlighter } from '@/lib/markdown/codeHighlight';

/**
 * Supported export format types.
 */
export type ExportFormat = 'html' | 'pdf' | 'docx';

/**
 * Options passed to all export functions.
 */
export interface ExportOptions {
  /** Raw markdown content to export */
  content: string;
  /** Default filename for the save dialog (e.g. "document.html") */
  filename: string;
  /** Current UI theme - affects CSS variables and Shiki theme */
  theme: 'light' | 'dark';
  /** Shiki highlighter instance, or null if not available */
  highlighter: ShikiHighlighter | null;
}

/**
 * Options for building a self-contained HTML document.
 */
export interface HtmlDocumentOptions {
  /** Document title shown in browser tab */
  title: string;
  /** Rendered HTML body content */
  content: string;
  /** CSS to embed in the style tag */
  css: string;
  /** Theme for data-theme attribute and CSS variables */
  theme: 'light' | 'dark';
}
