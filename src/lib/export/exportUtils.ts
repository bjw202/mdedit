// @MX:ANCHOR: [AUTO] Shared export utilities used by all export format modules
// @MX:REASON: [AUTO] Called by exportHtml, exportPdf, exportDocx (fan_in >= 3)
// @MX:SPEC: SPEC-EXPORT-001
// @MX:NOTE: [AUTO] getPreviewCss returns a large static CSS string embedding all preview styles inline for self-contained HTML export

import type { HtmlDocumentOptions } from './types';

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
  const mermaidBg = theme === 'dark' ? '#1f2937' : '#f9fafb';

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
  padding: 1rem;
  border-radius: 0.5rem;
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
