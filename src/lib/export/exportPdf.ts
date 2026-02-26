// @MX:NOTE: [AUTO] PDF export via Tauri native print API for SPEC-EXPORT-001
// @MX:SPEC: SPEC-EXPORT-001

import { generateHtmlContent } from './exportHtml';
import { printCurrentWindow } from '@/lib/tauri/ipc';
import type { ExportOptions } from './types';

// @MX:WARN: [AUTO] Tauri WebviewWindow::print() returns before the native dialog closes
// @MX:REASON: [AUTO] Cleanup must be deferred via afterprint event to keep @media print CSS active during print
// @MX:NOTE: [AUTO] 300000ms (5 minute) fallback timeout for afterprint cleanup in case event never fires

/**
 * Exports the markdown content as a PDF using Tauri's native print dialog.
 *
 * Strategy:
 * 1. Generates self-contained HTML using generateHtmlContent
 * 2. Injects the content into a hidden div on the main page
 * 3. Uses @media print CSS to hide app UI and show only export content
 * 4. Calls Tauri's WebviewWindow::print() via IPC (native print path)
 * 5. Cleans up after print completes via afterprint event
 *
 * Note: JavaScript window.print() does NOT work in Tauri's WKWebView.
 * Tauri's Rust-side WebviewWindow::print() uses the native print API directly.
 * The print() IPC returns before the native dialog closes, so cleanup is deferred.
 *
 * @param options - Export options including content, filename, theme, and highlighter
 */
export async function exportToPdf(options: ExportOptions): Promise<void> {
  const htmlContent = await generateHtmlContent(options);

  // Clean up any leftover print elements from a previous export
  cleanupPrintElements();

  // Parse the full HTML document to extract body content and styles
  const parser = new DOMParser();
  const parsed = parser.parseFromString(htmlContent, 'text/html');
  const bodyHTML = parsed.body.innerHTML;
  const docStyles = Array.from(parsed.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');

  // Set document title to filename so macOS print dialog uses it as default PDF name
  const docTitle = parsed.querySelector('title')?.textContent ?? '';
  const previousTitle = document.title;
  if (docTitle) {
    document.title = docTitle;
  }

  // Create print-only container (hidden on screen, visible when printing)
  const container = document.createElement('div');
  container.id = 'pdf-export-print';
  container.innerHTML = bodyHTML;

  // Add print-only CSS: hide app UI, show only export content
  const style = document.createElement('style');
  style.id = 'pdf-export-print-style';
  style.textContent = `
    #pdf-export-print { display: none; }
    @media print {
      @page { margin: 20mm; }
      body > *:not(#pdf-export-print) { display: none !important; }
      #pdf-export-print {
        display: block !important;
        position: static !important;
        width: 100% !important;
        overflow-wrap: break-word !important;
        word-break: break-word !important;
      }
      ${docStyles}
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(container);

  // Wait for DOM to render (double rAF ensures layout is computed)
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const cleanup = () => {
    cleanupPrintElements();
    document.title = previousTitle;
  };

  // Defer cleanup to afterprint event since print() IPC returns before dialog closes
  window.addEventListener('afterprint', cleanup, { once: true });

  // Fallback cleanup after 5 minutes in case afterprint doesn't fire
  setTimeout(cleanup, 300000);

  try {
    // Tauri's WebviewWindow::print() triggers native print dialog and returns immediately.
    // The @media print CSS remains in the DOM until afterprint fires.
    await printCurrentWindow();
  } catch (error) {
    // If the IPC call itself fails, clean up immediately
    cleanup();
    throw error;
  }
}

/**
 * Removes injected print elements from the DOM.
 * Safe to call multiple times (idempotent).
 */
function cleanupPrintElements(): void {
  document.getElementById('pdf-export-print')?.remove();
  document.getElementById('pdf-export-print-style')?.remove();
}
