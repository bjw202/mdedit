// @MX:NOTE: [AUTO] HTML export implementation for SPEC-EXPORT-001
// @MX:SPEC: SPEC-EXPORT-001

import { renderMarkdown } from '@/lib/markdown/renderer';
import { exportSaveDialog, writeFile, readImageAsBase64 } from '@/lib/tauri/ipc';
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
 * @returns The HTML string if saved successfully, or null if user cancelled the dialog
 */
export async function exportToHtml(options: ExportOptions): Promise<string | null> {
  const { content, filename, theme, highlighter, mdFilePath } = options;

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
  const htmlWithEmbeddedImages = await embedLocalImages(htmlWithMermaid, mdFilePath ?? null);

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

  return htmlDocument;
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
  const { content, filename, theme, highlighter, mdFilePath } = options;

  const defaultName = generateExportFilename(filename, 'html');
  const renderedHtml = await renderMarkdown(content, highlighter);
  const htmlWithMermaid = await replaceMermaidPlaceholders(renderedHtml);
  const htmlWithImages = await embedLocalImages(htmlWithMermaid, mdFilePath ?? null);
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
 * Embeds local images as base64 data URIs in the HTML for self-contained export.
 * HTTP/HTTPS URLs are kept as-is. Only relative paths are resolved and embedded.
 */
async function embedLocalImages(html: string, mdFilePath: string | null): Promise<string> {
  if (!mdFilePath) return html;

  // Match all img tags with src attributes
  const imgRegex = /<img\s+[^>]*src="([^"]*)"[^>]*>/g;
  const matches: Array<{ full: string; src: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    matches.push({ full: match[0], src: match[1] });
  }

  if (matches.length === 0) return html;

  let result = html;
  const mdDir = mdFilePath.substring(0, Math.max(mdFilePath.lastIndexOf('/'), mdFilePath.lastIndexOf('\\')));

  for (const { full, src } of matches) {
    // Skip HTTP/HTTPS URLs and data URIs
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      continue;
    }

    // Resolve relative path to absolute
    let absolutePath: string;
    if (src.startsWith('/')) {
      absolutePath = src;
    } else {
      const normalizedSrc = src.startsWith('./') ? src.substring(2) : src;
      absolutePath = `${mdDir}/${normalizedSrc}`;
    }

    try {
      const dataUri = await readImageAsBase64(absolutePath);
      result = result.replace(full, full.replace(src, dataUri));
    } catch {
      // Keep original src if reading fails
    }
  }

  return result;
}
