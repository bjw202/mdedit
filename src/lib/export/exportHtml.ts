// @MX:NOTE: [AUTO] HTML export implementation for SPEC-EXPORT-001
// @MX:SPEC: SPEC-EXPORT-001

import { renderMarkdown } from '@/lib/markdown/renderer';
import { exportSaveDialog } from '@/lib/tauri/ipc';
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
  const { content, filename, theme, highlighter } = options;

  // Generate the default save filename
  const defaultName = generateExportFilename(filename, 'html');

  // Show the save dialog first
  const savePath = await exportSaveDialog('html', defaultName);
  if (savePath === null) {
    // User cancelled
    return null;
  }

  // Render markdown to HTML
  const renderedHtml = await renderMarkdown(content, highlighter);

  // Replace mermaid placeholder divs with rendered SVG from DOM (if available)
  const htmlWithMermaid = await replaceMermaidPlaceholders(renderedHtml);

  // Build the title from the filename (strip extension)
  const title = defaultName.replace(/\.[^.]+$/, '');

  // Get the preview CSS
  const css = getPreviewCss(theme);

  // Build the complete HTML document
  const htmlDocument = buildHtmlDocument({
    title,
    content: htmlWithMermaid,
    css,
    theme,
  });

  // Write the HTML file via Tauri
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('write_file', { path: savePath, content: htmlDocument });

  return htmlDocument;
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
