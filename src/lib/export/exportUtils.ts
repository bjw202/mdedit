// @MX:ANCHOR: [AUTO] Shared export utilities used by all export format modules
// @MX:REASON: [AUTO] Called by exportHtml, exportPdf, exportDocx (fan_in >= 3)
// @MX:SPEC: SPEC-EXPORT-001
// @MX:NOTE: [AUTO] getPreviewCss returns a large static CSS string embedding all preview styles inline for self-contained HTML export

import type { HtmlDocumentOptions } from './types';
import { renderDiagram, resolveDiagramColors, type PeleThemeValues } from '@/lib/diagram/diagramRenderer';

/**
 * 펜스 원문을 미리보기가 받는 문자열로 바꾼다(SPEC-PREVIEW-015 REQ-006·015).
 * mermaidPlugin.ts는 `"`만 `&quot;`로 바꿔 data-diagram 속성에 넣고, 미리보기는 그 속성값(엔티티가 디코드된 값)을 읽는다.
 * 같은 이스케이프 + 같은 HTML 속성 파싱을 거쳐야 내보내기 입력이 미리보기와 같아진다(예: `A[R&amp;D]` → `A[R&D]`).
 */
export function previewDiagramInput(fenceContent: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = `<div data-diagram="${fenceContent.replace(/"/g, '&quot;')}"></div>`;
  return tpl.content.firstElementChild?.getAttribute('data-diagram') ?? '';
}

export interface ExportDiagram {
  /** 정화·색 값 치환이 끝난 SVG 요소(비활성 template 문서 소유) */
  svg: SVGSVGElement;
  /** pele가 알려 준 자연 크기(px) */
  width: number;
  height: number;
}

// @MX:NOTE: [AUTO] 모양 기반 자동 톤(SPEC-PREVIEW-017) — 미리보기 index.css shape-tone 블록과 같은 기제를 노드 g의 인라인
//   사용자 정의 속성으로 넣는다. 작성자 classDef·style은 모양 요소 자신의 인라인 선언이라 상속 값보다 항상 이긴다.
//   노드는 모양 클래스(pele-shape-*)로만 고른다. 대체 리터럴은 mdedit-tokens.css :root 토큰 값과 같아야 한다
//   (exportDiagram.test.ts가 CSS를 파싱해 비교). 주입은 반드시 resolveDiagramColors 앞 — 뒤로 옮기면 var(--pele- 잔여가 생긴다.
const SHAPE_TONES: ReadonlyArray<readonly [selector: string, tone: string]> = [
  ['.pele-node.pele-shape-diam', '--_s:var(--pele-surface-alt,#F7F2E7);--_b:var(--pele-decision-border,#8A6410);'],
  ['.pele-node.pele-shape-stadium', '--_b:var(--pele-accent,#3A5673);stroke-width:1.5px;'],
];

/**
 * 내보내기용 다이어그램 1개를 원본에서 렌더하고, 모양 톤을 넣은 뒤 모든 var(--pele-…)를 주어진 테마 값으로 치환한다(design.md D6).
 * HTML·PDF·DOCX가 모두 이 함수를 지나므로 모양 톤도 이 한 지점에서 들어간다.
 * 빈 소스와 렌더 실패는 null — 자리 처리는 호출자가 형식별로 한다(D7).
 */
export function renderExportDiagram(source: string, values: PeleThemeValues): ExportDiagram | null {
  if (!source.trim()) return null;
  const result = renderDiagram(source);
  if (!result.ok) return null;
  const tpl = document.createElement('template');
  tpl.innerHTML = result.svg; // 모듈이 정화한 SVG
  const svg = tpl.content.querySelector('svg');
  if (!svg) return null;
  for (const [selector, tone] of SHAPE_TONES) {
    for (const g of Array.from(svg.querySelectorAll(selector))) {
      const prev = g.getAttribute('style')?.trim();
      g.setAttribute('style', prev ? `${prev.replace(/;?$/, ';')}${tone}` : tone);
    }
  }
  resolveDiagramColors(svg, values);
  return { svg, width: result.width, height: result.height };
}

/**
 * Generates an export filename by replacing the markdown extension with the
 * target format extension.
 *
 * Examples:
 *   "document.md"        -> "document.html" (html format)
 *   "notes.markdown"     -> "notes.pdf"    (pdf format)
 *   "document"           -> "document.docx" (no extension)
 *   ""                   -> "document.html" (empty - fallback)
 *   "/path/to/file.md"   -> "file.html"    (strips path)
 */
export function generateExportFilename(rawFilename: string, format: 'html' | 'pdf' | 'docx'): string {
  if (!rawFilename) {
    return `document.${format}`;
  }

  // Strip directory path - use only the basename
  const basename = rawFilename.replace(/.*[/\\]/, '');
  if (!basename) {
    return `document.${format}`;
  }

  // Replace known markdown extensions
  const withoutExt = basename.replace(/\.(md|markdown)$/i, '');

  return `${withoutExt}.${format}`;
}

/**
 * Returns the CSS string for the preview panel.
 * This is a static CSS subset that mirrors the Tailwind preview-content styles
 * from index.css, compiled to plain CSS for embedding in exported HTML.
 *
 * Uses theme parameter to include appropriate CSS variable values.
 */
export function getPreviewCss(theme: 'light' | 'dark'): string {
  const darkVars = `
  --cm-base-text: #e5e7eb;
  --cm-content: #d4d4d4;
  --cm-strong: #ffffff;
  --cm-list: #cccccc;
  --cm-punctuation: #808080;`;

  const lightVars = `
  --cm-base-text: #111827;
  --cm-content: #111827;
  --cm-strong: #111827;
  --cm-list: #374151;
  --cm-punctuation: #6b7280;`;

  const themeVars = theme === 'dark' ? darkVars : lightVars;
  const textColor = theme === 'dark' ? '#f3f4f6' : '#111827';
  const h1BorderColor = theme === 'dark' ? '#374151' : '#e5e7eb';
  const h2BorderColor = theme === 'dark' ? '#374151' : '#e5e7eb';
  const blockquoteBorder = theme === 'dark' ? '#4b5563' : '#d1d5db';
  const blockquoteText = theme === 'dark' ? '#9ca3af' : '#4b5563';
  const codeBg = theme === 'dark' ? '#1f2937' : '#f3f4f6';
  const codeText = theme === 'dark' ? '#f472b6' : '#db2777';
  const preBg = theme === 'dark' ? '#1f2937' : '#f3f4f6';
  const thBg = theme === 'dark' ? '#1f2937' : '#f3f4f6';
  const tableBorder = theme === 'dark' ? '#4b5563' : '#d1d5db';
  const linkColor = theme === 'dark' ? '#60a5fa' : '#2563eb';
  const hrColor = theme === 'dark' ? '#374151' : '#e5e7eb';
  // 다이어그램 바탕 = 고정 팔레트 --pele-bg(#FAF9F6, 잉크 앤 허니) 상수 — 테마 3항 선택은 폐지(SPEC-PREVIEW-016).
  // pele 간선 라벨 상자가 같은 #FAF9F6으로 칠해지므로 어떤 테마에서도 이음매가 없다.
  const mermaidBg = '#FAF9F6';
  // 종이 카드(테두리·반경)는 다크 출력에만 얹는다(라이트 무카드, REQ-PREVIEW016-005). 값은 승인 팔레트
  // 상수(--pele-border #97A4B1, --pele-radius 3px)의 리터럴이다 — 내보낸 HTML에는 --pele-* 정의가 없고
  // 0-잔여 계약(015 AC-020 유지)이 var(--pele- 문자열을 금지하므로 var() 참조를 쓰지 않는다.
  const mermaidCard = theme === 'dark' ? '\n  border: 1px solid #97A4B1;\n  border-radius: 3px;' : '';

  return `:root {${themeVars}
}

body {
  margin: 0;
  padding: 1rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  font-size: 16px;
  line-height: 1.625;
  color: ${textColor};
  background: transparent;
}

.preview-content {
  color: ${textColor};
  line-height: 1.625;
  max-width: 860px;
  margin: 0 auto;
}

.preview-content h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid ${h1BorderColor};
}

.preview-content h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  margin-top: 1.25rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid ${h2BorderColor};
}

.preview-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  margin-top: 1rem;
}

.preview-content h4,
.preview-content h5,
.preview-content h6 {
  font-weight: 600;
  margin-bottom: 0.5rem;
  margin-top: 0.75rem;
}

.preview-content p {
  margin-bottom: 1rem;
}

/* @MX:WARN: [AUTO] 이 규칙은 src/index.css의 .preview-content ul/ol/li 리스트 규칙과
   동등한 렌더 결과를 유지해야 한다(SPEC-PREVIEW-011 REQ-002/008).
   @MX:REASON: 자동 테스트가 두 파일(Tailwind @apply vs 평문 CSS 문자열)의 동등성을
   검증하지 않는다 — Playwright는 앱 프리뷰만 렌더하고 내보내기 CSS 문자열은 렌더 대상이
   아니므로, 한쪽만 수정하면 화면과 HTML/PDF 내보내기 출력이 조용히 어긋난다. 수정 시
   반드시 src/index.css의 대응 규칙과 나란히 diff 리뷰할 것.
   list-style-position은 outside로 두어 loose list(<li> > <p>)에서 마커와 텍스트가
   분리되는 결함을 막고, 마커 공간은 padding-left: 1.5rem으로 확보한다. li의 좌측
   여백(margin-left)은 삭제한다 — padding과 합산되면 중첩 리스트 인덴트가 과도해진다(D3).
   항목 간격은 프리뷰의 space-y-1과 메커니즘이 다르지만(li 상단 margin이 아니라 하단
   margin) 기존 출력물과의 차이를 최소화하기 위해 margin-bottom: 0.25rem을 유지한다
   (plan.md 표현 차이 표 참조). */
.preview-content ul {
  list-style-type: disc;
  list-style-position: outside;
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

.preview-content ol {
  list-style-type: decimal;
  list-style-position: outside;
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

.preview-content li {
  margin-bottom: 0.25rem;
}

/* loose list 항목 간격을 tight list와 동일하게 정규화한다. li의 margin-bottom과
   <li> 내부 마지막 <p>의 margin-bottom(1rem)이 합산되면 loose list 간격이 tight list
   보다 넓어진다(REQ-007). 마지막 문단에만 적용해야 다문단 항목의 문단 간 간격이
   보존된다(REQ-009). */
.preview-content li > p:last-child {
  margin-bottom: 0;
}

.preview-content blockquote {
  border-left: 4px solid ${blockquoteBorder};
  padding-left: 1rem;
  font-style: italic;
  color: ${blockquoteText};
  margin-bottom: 1rem;
}

.preview-content code {
  background-color: ${codeBg};
  border-radius: 0.25rem;
  padding: 0.125rem 0.25rem;
  font-size: 0.875rem;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  color: ${codeText};
}

.preview-content pre {
  background-color: ${preBg};
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  overflow-x: auto;
}

.preview-content pre code {
  background: transparent;
  padding: 0;
  color: inherit;
}

.preview-content .table-scroll-wrapper {
  overflow-x: auto;
  margin-bottom: 1rem;
}

.preview-content table {
  min-width: 100%;
  border-collapse: collapse;
  border: 1px solid ${tableBorder};
}

.preview-content th {
  background-color: ${thBg};
  border: 1px solid ${tableBorder};
  padding: 0.5rem 1rem;
  text-align: left;
  font-weight: 600;
}

.preview-content td {
  border: 1px solid ${tableBorder};
  padding: 0.5rem 1rem;
}

.preview-content a {
  color: ${linkColor};
  text-decoration: underline;
}

.preview-content a:hover {
  text-decoration: none;
}

.preview-content img {
  max-width: 100%;
  height: auto;
  border-radius: 0.25rem;
}

.preview-content hr {
  border-color: ${hrColor};
  margin: 1.5rem 0;
}

.preview-content s {
  color: #6b7280;
}

.preview-content .shiki {
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  overflow-x: auto;
}

.preview-content .mermaid-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
  background-color: ${mermaidBg};
  padding: 1rem;${mermaidCard}
}

@media print {
  body {
    margin: 0;
    padding: 0;
  }

  .preview-content {
    max-width: 100%;
  }

  .preview-content pre,
  .preview-content .shiki,
  .preview-content .mermaid-container,
  .preview-content table,
  .preview-content blockquote {
    page-break-inside: avoid;
  }

  .preview-content h1,
  .preview-content h2,
  .preview-content h3 {
    page-break-after: avoid;
  }

  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}`;
}

/**
 * Builds a complete, self-contained HTML document string.
 * The output contains no JavaScript (REQ-EXPORT-020).
 */
export function buildHtmlDocument(options: HtmlDocumentOptions): string {
  const { title, content, css, theme } = options;
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <style>
${css}
  </style>
</head>
<body>
  <div class="preview-content">
${content}
  </div>
</body>
</html>`;
}
