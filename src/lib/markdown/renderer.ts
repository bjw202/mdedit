import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { mermaidPlugin } from './mermaidPlugin';
import type { ShikiHighlighter } from './codeHighlight';

// @MX:ANCHOR: [AUTO] Core markdown rendering function - used by usePreview hook
// @MX:REASON: [AUTO] Public API boundary for all markdown-to-HTML conversion (fan_in >= 3)
// @MX:SPEC: SPEC-PREVIEW-001

// @MX:WARN: [AUTO] html: false is MANDATORY for XSS prevention - do NOT set to true
// @MX:REASON: [AUTO] User-supplied markdown must never render raw HTML to prevent XSS attacks

/**
 * Block-level token types that receive data-line attributes for scroll sync.
 * These correspond to the opening tokens of block elements in markdown-it.
 */
const DATA_LINE_TOKEN_TYPES = new Set([
  'paragraph_open',
  'heading_open',
  'fence',
  'blockquote_open',
  'bullet_list_open',
  'ordered_list_open',
  'table_open',
  'hr',
  'code_block',
]);

/**
 * markdown-it plugin that injects data-line attributes on block-level tokens.
 * This enables line-number-based scroll synchronization between editor and preview.
 *
 * Each block element in the rendered HTML will have a data-line attribute
 * containing the 0-based source line number from the markdown source.
 */
function dataLinePlugin(md: MarkdownIt): void {
  md.core.ruler.push('data_line', (state) => {
    const tokens: Token[] = state.tokens;
    for (const token of tokens) {
      if (DATA_LINE_TOKEN_TYPES.has(token.type) && token.map !== null && token.map.length > 0) {
        token.attrSet('data-line', String(token.map[0]));
      }
    }
    return false;
  });
}

/**
 * markdown-it plugin that wraps <table> elements in a scrollable container div
 * and injects inline styles for guaranteed border rendering.
 *
 * Inline styles ensure borders are visible regardless of CSS loading order or
 * WKWebView caching. CSS variables (--table-border, --table-th-bg) defined in
 * index.css provide dark-mode-aware colors with hardcoded fallbacks.
 */
function tableScrollPlugin(md: MarkdownIt): void {
  md.renderer.rules.table_open = (tokens, idx, options, _env, self) => {
    // Use border-collapse: separate to avoid WebKit clipping bug where
    // collapsed borders are invisible at overflow-x: auto container edges.
    // Table draws top + left edges; each cell draws right + bottom edges.
    tokens[idx].attrSet(
      'style',
      'border-collapse: separate; border-spacing: 0; border-top: 1px solid var(--table-border, #d1d5db); border-left: 1px solid var(--table-border, #d1d5db);',
    );
    return '<div class="table-scroll-wrapper">' + self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.table_close = (tokens, idx, options, _env, self) =>
    self.renderToken(tokens, idx, options) + '</div>';

  md.renderer.rules.th_open = (tokens, idx, options, _env, self) => {
    // Preserve existing style (e.g., text-align set by column alignment syntax)
    const existing = tokens[idx].attrGet('style');
    const border =
      'border-right: 1px solid var(--table-border, #d1d5db); border-bottom: 1px solid var(--table-border, #d1d5db); padding: 0.5rem 1rem; font-weight: 600; background-color: var(--table-th-bg, #f3f4f6);';
    tokens[idx].attrSet('style', existing ? `${existing} ${border}` : border);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.td_open = (tokens, idx, options, _env, self) => {
    // Preserve existing style (e.g., text-align set by column alignment syntax)
    const existing = tokens[idx].attrGet('style');
    const border = 'border-right: 1px solid var(--table-border, #d1d5db); border-bottom: 1px solid var(--table-border, #d1d5db); padding: 0.5rem 1rem;';
    tokens[idx].attrSet('style', existing ? `${existing} ${border}` : border);
    return self.renderToken(tokens, idx, options);
  };
}

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
  isDark = false,
): Promise<string> {
  if (!content) {
    return '';
  }

  const shikiTheme = isDark ? 'github-dark' : 'github-light';

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
              theme: shikiTheme,
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

  // Register table scroll wrapper plugin
  md.use(tableScrollPlugin);

  // Register data-line plugin for scroll sync
  md.use(dataLinePlugin);

  return md.render(content);
}
