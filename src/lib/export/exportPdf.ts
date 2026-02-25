// @MX:NOTE: [AUTO] PDF export via Webview Print API for SPEC-EXPORT-001
// @MX:SPEC: SPEC-EXPORT-001

import { exportToHtml } from './exportHtml';
import type { ExportOptions } from './types';

/**
 * Exports the markdown content as a PDF using the Webview Print API.
 *
 * Strategy:
 * 1. Generates self-contained HTML using exportToHtml
 * 2. Creates a hidden iframe and loads the HTML into it
 * 3. Triggers window.print() on the iframe's content window
 * 4. The user's OS print dialog handles PDF saving
 *
 * Note: This opens the OS print dialog, which allows the user to save as PDF.
 * For fully programmatic PDF generation, a future enhancement could use headless-chrome.
 *
 * @param options - Export options including content, filename, theme, and highlighter
 */
export async function exportToPdf(options: ExportOptions): Promise<void> {
  const { content, filename, theme, highlighter } = options;

  // Generate the HTML content (reuse HTML export logic)
  // We pass a modified filename to get PDF extension for the save dialog
  const htmlOptions: ExportOptions = {
    content,
    filename: filename.replace(/\.(html|pdf|docx)$/i, '.md'),
    theme,
    highlighter,
  };

  const htmlContent = await exportToHtml(htmlOptions);
  if (htmlContent === null) {
    // User cancelled the dialog
    return;
  }

  // Create a hidden iframe to load the HTML into
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.setAttribute('aria-hidden', 'true');

  document.body.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (win) {
          win.focus();
          win.print();
        }
      } finally {
        // Remove the iframe after a short delay to allow print dialog to initialize
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          resolve();
        }, 1000);
      }
    };

    // Write the HTML content to the iframe's document
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
    } else {
      // Fallback: use srcdoc attribute
      iframe.srcdoc = htmlContent;
    }
  });
}
