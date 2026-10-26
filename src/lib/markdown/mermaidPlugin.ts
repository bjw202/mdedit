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
      // @MX:NOTE: [AUTO] `"`만 `&quot;`로 바꾸는 이 계약이 다이어그램 렌더러 입력을 정한다 — 미리보기는 속성 파싱으로 엔티티가
      //   디코드된 data-diagram 값을 받는다. 내보내기(exportUtils.previewDiagramInput)도 같은 문자열을 써야 하므로(SPEC-PREVIEW-015
      //   REQ-006·015) 이스케이프 범위를 바꾸면 previewDiagramInput도 함께 바꿔야 한다.
      const escaped = diagram.replace(/"/g, '&quot;');
      return `<div class="mermaid-container" data-diagram="${escaped}"></div>`;
    }
    return defaultFence(tokens, idx, options, env, slf);
  };
}
