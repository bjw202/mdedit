import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { mermaidPlugin } from './mermaidPlugin';
import markdownItKatex from '@traptitech/markdown-it-katex';
import type { ShikiHighlighter } from './codeHighlight';
import { resolveImageSrc } from '@/lib/image/imageResolver';

// @MX:ANCHOR: [AUTO] Core markdown rendering function - used by usePreview, exportHtml, exportDocx
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

// @MX:NOTE: [AUTO] SPEC-PREVIEW-008 D4 — 인라인 <svg> placeholder-and-restore 전처리.
// html:false를 그대로 유지한 채(REQ-PREVIEW008-007), 코드펜스/들여쓰기 코드블록 밖에 있는
// <svg>...</svg> 블록만 렌더 전에 플레이스홀더 토큰으로 치환하고, 렌더된 HTML에서
// data-mdedit-svg 마커로 복원한다. 실제 sanitize(DOMPurify)는 여기서 하지 않고
// PreviewRenderer.tsx의 dangerouslySetInnerHTML 직전 단계에서 svgSanitize를 통해 수행한다
// (적용 지점 단일화 — Security 섹션). 커스텀 markdown-it 블록 룰은 사용하지 않는다(확정 결정).
// @MX:SPEC: SPEC-PREVIEW-008 REQ-PREVIEW008-006 REQ-PREVIEW008-007

const SVG_PLACEHOLDER_PREFIX = 'MDEDITSVGPLACEHOLDERxk9';
const INLINE_SVG_RE = /<svg[\s\S]*?<\/svg>/gi;

/**
 * 원본 마크다운에서 fence(```)/들여쓰기 code_block **및 인라인 코드 스팬(백틱)**으로 보호되는
 * 문자 오프셋 범위를 계산한다. 이 범위 안의 텍스트는 svg placeholder 치환 대상에서 제외되어,
 * 코드블록·인라인 코드 안의 <svg> 텍스트가 실수로 렌더되는 것을 방지한다
 * (커스텀 markdown-it 블록 룰이 아닌, 기존 파서가 만든 토큰을 그대로 walk해서 판단한다).
 *
 * @MX:NOTE: [AUTO] 평가 결함 1 수정 — 기존에는 fence/code_block(블록 레벨)만 보호했고
 * code_inline(인라인 백틱)은 누락되어 있었다. inline 타입 토큰의 .children을 순회해
 * code_inline을 찾고, 그 원본 텍스트를 부모 inline 토큰의 raw content(.content)에서
 * indexOf로 위치를 역산해 절대 오프셋으로 변환한다 — 정규식을 다시 만드는 대신
 * 파서가 이미 만든 토큰 구조를 신뢰하는 접근이다(plan.md 위험표 항목 대응).
 */
function getCodeProtectedRanges(content: string): Array<[number, number]> {
  const parser = new MarkdownIt();
  const tokens = parser.parse(content, {});

  const lines = content.split('\n');
  const lineOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }

  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    if ((token.type === 'fence' || token.type === 'code_block') && token.map) {
      const [startLine, endLine] = token.map;
      const start = lineOffsets[startLine] ?? 0;
      const end = endLine < lineOffsets.length ? lineOffsets[endLine] : content.length;
      ranges.push([start, end]);
      continue;
    }

    // 인라인 코드 스팬(`...`) 보호 — token.type === 'inline'은 이미 inline 규칙까지
    // 적용된 상태라 .children에 code_inline 자식 토큰이 채워져 있다.
    if (token.type === 'inline' && token.map && token.children) {
      const [startLine] = token.map;
      const baseOffset = lineOffsets[startLine] ?? 0;
      const rawParagraph = token.content;
      let searchFrom = 0;
      for (const child of token.children) {
        if (child.type !== 'code_inline') continue;
        // code_inline.content는 백틱을 제외한 순수 내용(양끝 단일 공백은 CommonMark 규칙에
        // 따라 이미 트리밍된 상태). 이 내용의 위치를 원본 paragraph 텍스트에서 역산한다.
        const idx = rawParagraph.indexOf(child.content, searchFrom);
        if (idx === -1) continue;
        const start = baseOffset + idx;
        const end = start + child.content.length;
        ranges.push([start, end]);
        searchFrom = idx + child.content.length;
      }
    }
  }
  return ranges;
}

/**
 * 코드블록 밖의 <svg>...</svg> 블록을 플레이스홀더 토큰으로 치환한다.
 * 치환된 원본 svg 마크업은 svgMap에 보관되어 렌더 이후 복원 단계에서 사용된다.
 *
 * @MX:NOTE: [AUTO] 실사용 버그 수정 — 이전 구현은 INLINE_SVG_RE를 문서 전체에 대해 매칭한 뒤
 * 매치의 "시작 오프셋"만 보호구간(코드펜스/인라인코드) 여부로 필터링했다. 이 방식은 보호구간
 * 안의 `<svg`에서 시작한 lazy 매치([\s\S]*?)가 보호구간 경계를 건너뛰어 보호구간 밖의 진짜
 * `</svg>`까지 통째로 삼키는 straddling match를 만들 수 있었다(예: 인라인코드 `` `<svg>` ``
 * 뒤에 실제 <svg>...</svg> 블록이 오는 경우). 매치 시작 오프셋이 보호구간 안에 있으므로 필터를
 * 통과하지 못해 전체 스팬이 무변환으로 방치되고, 결과적으로 실제 SVG가 렌더되지 않았다.
 * 수정: content를 보호구간 기준으로 분절(segment)하여, 보호구간은 원문 그대로 복사하고
 * **보호구간이 아닌 부분 문자열에 대해서만** 정규식을 독립적으로 실행한다. 정규식이 각 세그먼트
 * 문자열 밖을 볼 수 없으므로 경계를 건너뛰는 매치 자체가 구조적으로 불가능해진다.
 */
function extractInlineSvg(content: string): { content: string; svgMap: Map<string, string> } {
  if (!/<svg/i.test(content)) {
    return { content, svgMap: new Map() };
  }

  const ranges = getCodeProtectedRanges(content)
    .slice()
    .sort((a, b) => a[0] - b[0]);
  const svgMap = new Map<string, string>();
  let counter = 0;

  const extractFromUnprotectedSegment = (segment: string): string => {
    // String.replace()는 전역(g) 정규식이라도 매 호출 시작 시 lastIndex를 0으로 리셋하므로
    // 모듈 상수 INLINE_SVG_RE를 세그먼트마다 재사용해도 상태가 오염되지 않는다.
    return segment.replace(INLINE_SVG_RE, (match) => {
      const token = `${SVG_PLACEHOLDER_PREFIX}${counter}END`;
      svgMap.set(token, match);
      counter += 1;
      return token;
    });
  };

  const parts: string[] = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    if (start > cursor) {
      parts.push(extractFromUnprotectedSegment(content.slice(cursor, start)));
    }
    // 보호구간(코드펜스/인라인코드)은 원문 그대로 유지한다 — html:false가 이스케이프해 안전하다.
    const protectedStart = Math.max(cursor, start);
    if (end > protectedStart) {
      parts.push(content.slice(protectedStart, end));
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < content.length) {
    parts.push(extractFromUnprotectedSegment(content.slice(cursor)));
  }

  return { content: parts.join(''), svgMap };
}

/**
 * 렌더된 HTML 안의 플레이스홀더 토큰을 data-mdedit-svg 마커 div로 되돌린다.
 * 원본(비신뢰) svg 마크업은 encodeURIComponent로 인코딩되어 속성값에 담긴다.
 * 실제 sanitize는 이 함수가 아니라 PreviewRenderer.tsx에서 수행한다.
 */
function restoreSvgMarkers(html: string, svgMap: Map<string, string>): string {
  if (svgMap.size === 0) return html;

  let result = html;
  for (const [token, rawSvg] of svgMap) {
    const marker = `<div data-mdedit-svg="${encodeURIComponent(rawSvg)}"></div>`;
    result = result.split(token).join(marker);
  }
  return result;
}

/**
 * markdown-it plugin that resolves relative image paths to Tauri asset: URLs
 * and applies responsive styling for preview rendering.
 */
function imageResolverPlugin(md: MarkdownIt, mdFilePath?: string | null): void {
  const defaultImageRenderer = md.renderer.rules.image;

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const srcIndex = token.attrIndex('src');

    if (srcIndex >= 0 && mdFilePath) {
      const originalSrc = token.attrs![srcIndex][1];
      token.attrs![srcIndex][1] = resolveImageSrc(originalSrc, mdFilePath);
    }

    // Add responsive styling
    token.attrSet('style', 'max-width: 100%; height: auto;');

    if (defaultImageRenderer) {
      return defaultImageRenderer(tokens, idx, options, env, self);
    }
    return self.renderToken(tokens, idx, options);
  };
}

/**
 * Renders a markdown string to an HTML string.
 *
 * @param content - Raw markdown source string
 * @param highlighter - A Shiki highlighter instance for syntax highlighting,
 *                      or null to fall back to plain <code> blocks
 * @param isDark - Whether dark theme is active
 * @param mdFilePath - Absolute path to the current markdown file for resolving relative image paths
 * @returns Promise resolving to an HTML string
 */
export async function renderMarkdown(
  content: string,
  highlighter: ShikiHighlighter | null,
  isDark = false,
  mdFilePath?: string | null,
): Promise<string> {
  if (!content) {
    return '';
  }

  // SPEC-PREVIEW-008 D4: 렌더 전에 코드블록 밖의 <svg> 블록을 플레이스홀더로 치환한다.
  // html:false 설정(아래)은 그대로 유지되며, 치환된 토큰은 순수 텍스트이므로 markdown-it이
  // 안전하게 단락 텍스트로 렌더한다. 실제 svg 복원은 md.render() 이후에 수행한다.
  const { content: preprocessed, svgMap } = extractInlineSvg(content);

  const shikiTheme = isDark ? 'github-dark' : 'github-light';

  // Build markdown-it with optional shiki highlight callback
  const md = new MarkdownIt({
    // XSS prevention: NEVER change html to true
    // @MX:WARN: [AUTO] html:true로 전환 금지 — 인라인 svg 예외는 placeholder-and-restore로만 처리한다
    // @MX:REASON: [AUTO] html:true는 <script>/<iframe>/on* 등 모든 원시 HTML을 무차별 허용해
    //   1차 XSS 방어선이 무너진다(SPEC-PREVIEW-008 Security). svg만 허용하려면 extractInlineSvg +
    //   svgSanitize 경로를 확장할 것, html 플래그 자체를 바꾸지 말 것.
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

  // KaTeX 수식 렌더링 플러그인 등록 (SPEC-PREVIEW-003)
  // throwOnError: false - 잘못된 LaTeX로 인한 전체 프리뷰 중단 방지
  md.use(markdownItKatex, { throwOnError: false });

  // Register table scroll wrapper plugin
  md.use(tableScrollPlugin);

  // Register image resolver plugin for relative path resolution
  md.use(imageResolverPlugin, mdFilePath);

  // Register data-line plugin for scroll sync
  md.use(dataLinePlugin);

  const rendered = md.render(preprocessed);

  // SPEC-PREVIEW-008 D4: 렌더 후 플레이스홀더를 data-mdedit-svg 마커로 복원한다.
  // 실제 DOMPurify sanitize는 PreviewRenderer.tsx의 dangerouslySetInnerHTML 직전 단계에서 수행된다.
  return restoreSvgMarkers(rendered, svgMap);
}
