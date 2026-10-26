// @MX:NOTE: [AUTO] HTML export implementation for SPEC-EXPORT-001
// @MX:NOTE: [AUTO] SPEC-EXPORT-004: 옛 복사본 embedLocalImages 를 제거하고 이미지 경로 해석을 공용
//   embedImagesInHtml(imageResolver.ts)에 위임한다. 임베드하지 못한 이미지는 onUnembeddedImages 로 알린다.
// @MX:SPEC: SPEC-EXPORT-001
// @MX:SPEC: SPEC-EXPORT-004

import { renderMarkdown } from '@/lib/markdown/renderer';
import { exportSaveDialog, writeFile } from '@/lib/tauri/ipc';
import { embedImagesInHtml } from '@/lib/image/imageResolver';
import { buildHtmlDocument, generateExportFilename, getPreviewCss } from './exportUtils';
import type { ExportOptions } from './types';

/**
 * Exports the markdown content as a self-contained HTML file.
 *
 * The exported HTML:
 * - Contains all CSS inline (no external dependencies)
 * - Includes rendered Mermaid SVG (no JavaScript)
 * - Preserves Shiki syntax highlighting (inline styles)
 * - Contains NO JavaScript (REQ-EXPORT-020)
 *
 * @param options - Export options including content, filename, theme, and highlighter
 * @returns 저장 경로(string)를 반환. 사용자가 다이얼로그를 취소하면 null.
 */
// @MX:NOTE: [AUTO] SPEC-EXPORT-002 (REQ-007) 반환 계약 — string 의미가 HTML 문서 본문에서
//   **저장 경로**로 변경됨. 후보 A(path-only) 선택 근거: T1 감사에서 프로덕션 호출자 0곳이
//   반환값을 사용(AppLayout.tsx:132 폐기). 사용처는 테스트 단언만. PDF 경로는 generateHtmlContent
//   (별도 export, :70) 분리로 무영향(REQ-019). 결정 근거 = progress.md T2.
// @MX:SPEC: SPEC-EXPORT-002
export async function exportToHtml(options: ExportOptions): Promise<string | null> {
  const { content, filename, theme, highlighter } = options;

  // Generate the default save filename
  const defaultName = generateExportFilename(filename, 'html');

  // Show the save dialog first
  const savePath = await exportSaveDialog('html', defaultName);
  if (savePath === null) {
    return null;
  }

  // Render markdown to HTML (without image resolver for export - we embed separately)
  const renderedHtml = await renderMarkdown(content, highlighter);

  // Replace mermaid placeholder divs with rendered SVG from DOM (if available)
  const htmlWithMermaid = await replaceMermaidPlaceholders(renderedHtml);

  // Embed local images as base64 data URIs for self-contained HTML
  const htmlWithEmbeddedImages = await embedAndReport(htmlWithMermaid, options);

  // Build the title from the filename (strip extension)
  const title = defaultName.replace(/\.[^.]+$/, '');

  // Get the preview CSS
  const css = getPreviewCss(theme);

  // Build the complete HTML document
  const htmlDocument = buildHtmlDocument({
    title,
    content: htmlWithEmbeddedImages,
    css,
    theme,
  });

  // Write the HTML file via Tauri IPC
  await writeFile(savePath, htmlDocument);

  // SPEC-EXPORT-002 REQ-007: 저장 경로를 반환 (HTML 본문이 아님).
  return savePath;
}

/**
 * Generates a self-contained HTML string from markdown content without
 * showing any save dialog or writing to disk.
 * Used internally by PDF export to get printable HTML.
 *
 * @param options - Export options including content, filename, theme, and highlighter
 * @returns The complete HTML document string
 */
export async function generateHtmlContent(options: ExportOptions): Promise<string> {
  const { content, filename, theme, highlighter } = options;

  const defaultName = generateExportFilename(filename, 'html');
  const renderedHtml = await renderMarkdown(content, highlighter);
  const htmlWithMermaid = await replaceMermaidPlaceholders(renderedHtml);
  const htmlWithImages = await embedAndReport(htmlWithMermaid, options);
  const title = defaultName.replace(/\.[^.]+$/, '');
  const css = getPreviewCss(theme);

  return buildHtmlDocument({ title, content: htmlWithImages, css, theme });
}

/**
 * Attempts to replace mermaid placeholder divs with the rendered SVG from the DOM.
 * If no rendered SVG is available (e.g., during tests), falls back to the original HTML.
 *
 * This implements REQ-EXPORT-003: Mermaid diagrams included as inline SVG.
 */
async function replaceMermaidPlaceholders(html: string): Promise<string> {
  // If we're not in a browser context (e.g., tests), return as-is
  if (typeof document === 'undefined') {
    return html;
  }

  // Look for rendered Mermaid SVGs in the DOM
  const mermaidContainers = document.querySelectorAll('.mermaid-container');
  if (mermaidContainers.length === 0) {
    return html;
  }

  // Build a temporary div to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const placeholders = tempDiv.querySelectorAll('.mermaid-container');

  placeholders.forEach((placeholder, index) => {
    const domContainer = mermaidContainers[index];
    if (domContainer) {
      const svg = domContainer.querySelector('svg');
      if (svg) {
        // Clone the SVG and inject it
        const svgClone = svg.cloneNode(true) as SVGElement;
        placeholder.innerHTML = '';
        placeholder.appendChild(svgClone);
      }
    }
  });

  return tempDiv.innerHTML;
}

/**
 * 로컬 이미지를 공용 해석기로 임베드하고, 임베드하지 못한 이미지가 있으면 콜백으로 한 번 알린다.
 * 미저장 문서(mdFilePath null)는 로컬 이미지를 읽지 않고 모두 누락으로 보고한다(REQ-008).
 */
async function embedAndReport(html: string, options: ExportOptions): Promise<string> {
  const { html: embedded, unembedded } = await embedImagesInHtml(html, options.mdFilePath ?? null);
  if (unembedded.length > 0) options.onUnembeddedImages?.(unembedded);
  return embedded;
}
