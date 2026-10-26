// @MX:NOTE: [AUTO] Export types for SPEC-EXPORT-001 - Markdown document export (PDF/HTML/DOCX)
// @MX:SPEC: SPEC-EXPORT-001

import type { ShikiHighlighter } from '@/lib/markdown/codeHighlight';

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
  /** Absolute path to the current markdown file, for resolving relative image paths */
  mdFilePath?: string | null;
  /**
   * SPEC-EXPORT-004: 이미지 임베드 단계가 끝난 직후, 임베드하지 못한 로컬 이미지가 1개 이상이면
   * 그 이름 목록(중복 없음)으로 한 번 호출된다. 생략하면 동작은 이전과 같다(반환 계약 무변경).
   */
  onUnembeddedImages?: (names: string[]) => void;
  /**
   * SPEC-EXPORT-004: PDF 전용. 누락 이미지가 있을 때 인쇄 전에 기다리는 확인 콜백.
   * false 면 인쇄하지 않고 아무것도 남기지 않는다. 생략하면 확인 없이 인쇄한다.
   */
  confirmUnembeddedImages?: (names: string[]) => Promise<boolean>;
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
