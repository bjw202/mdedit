import MarkdownIt from 'markdown-it';
import { mermaidPlugin } from './mermaidPlugin';
import type { ShikiHighlighter } from './codeHighlight';

// @MX:ANCHOR: [AUTO] Core markdown rendering function - used by usePreview hook
// @MX:REASON: [AUTO] Public API boundary for all markdown-to-HTML conversion (fan_in >= 3)
// @MX:SPEC: SPEC-PREVIEW-001

// @MX:WARN: [AUTO] html: false is MANDATORY for XSS prevention - do NOT set to true
// @MX:REASON: [AUTO] User-supplied markdown must never render raw HTML to prevent XSS attacks

/**
 * Renders a markdown string to an HTML string.
 *
 * @param content - Raw markdown source string
 * @param highlighter - A Shiki highlighter instance for syntax highlighting,
 *                      or null to fall back to plain <code> blocks
 * @returns Promise resolving to an HTML string
 */
export async function renderMarkdown(
  content: string,
  highlighter: ShikiHighlighter | null,
): Promise<string> {
  if (!content) {
    return '';
  }

  // Build markdown-it with optional shiki highlight callback
  const md = new MarkdownIt({
    // XSS prevention: NEVER change html to true
    html: false,
    linkify: true,
    typographer: true,
    highlight: highlighter
      ? (code: string, lang: string): string => {
          try {
            return highlighter.codeToHtml(code, {
              lang: lang || 'text',
              theme: 'github-light',
            });
          } catch {
            // Fall back to escaped plain text if language is unsupported
            return `<pre><code>${md.utils.escapeHtml(code)}</code></pre>`;
          }
        }
      : undefined,
  });

  // Enable built-in plugins
  md.enable('table');
  md.enable('strikethrough');

  // Register mermaid plugin
  md.use(mermaidPlugin);

  return md.render(content);
}
