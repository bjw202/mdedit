import type MarkdownIt from 'markdown-it';

// @MX:NOTE: [AUTO] Custom markdown-it plugin that intercepts ```mermaid code blocks
// Converts mermaid blocks to placeholder divs for client-side rendering
// @MX:SPEC: SPEC-PREVIEW-001

/**
 * Registers a custom fence renderer for mermaid code blocks.
 * Mermaid blocks are replaced with a container div that holds the raw diagram
 * source in a data attribute, which is later picked up by PreviewRenderer for
 * client-side rendering via the mermaid library.
 */
export function mermaidPlugin(md: MarkdownIt): void {
  const defaultFence = md.renderer.rules.fence!.bind(md.renderer.rules);
  md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const token = tokens[idx];
    if (token.info.trim() === 'mermaid') {
      const diagram = token.content;
      const escaped = diagram.replace(/"/g, '&quot;');
      return `<div class="mermaid-container" data-diagram="${escaped}"></div>`;
    }
    return defaultFence(tokens, idx, options, env, slf);
  };
}
