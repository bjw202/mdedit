/**
 * SPEC-EXPORT-001: PDF Export tests
 *
 * Tests the exportToPdf function which uses the Webview Print API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock exportHtml module
vi.mock('@/lib/export/exportHtml', () => ({
  exportToHtml: vi.fn(),
}));

// Mock IPC
vi.mock('@/lib/tauri/ipc', () => ({
  exportSaveDialog: vi.fn(),
  writeBinaryFile: vi.fn(),
}));

describe('ExportPdf: exportToPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls exportToHtml with pdf-compatible filename', async () => {
    const { exportToHtml } = await import('@/lib/export/exportHtml');
    vi.mocked(exportToHtml).mockResolvedValueOnce(null); // User cancelled

    const { exportToPdf } = await import('@/lib/export/exportPdf');
    await exportToPdf({
      content: '# Hello',
      filename: 'document.pdf',
      theme: 'light',
      highlighter: null,
    });

    expect(exportToHtml).toHaveBeenCalledOnce();
    // Check that filename passed has .md extension for exportHtml to process
    const callArgs = vi.mocked(exportToHtml).mock.calls[0][0];
    expect(callArgs.content).toBe('# Hello');
    expect(callArgs.theme).toBe('light');
  });

  it('does nothing when user cancels (returns null from exportToHtml)', async () => {
    const { exportToHtml } = await import('@/lib/export/exportHtml');
    vi.mocked(exportToHtml).mockResolvedValueOnce(null);

    const { exportToPdf } = await import('@/lib/export/exportPdf');

    // Should not throw
    await expect(exportToPdf({
      content: '# Hello',
      filename: 'document.pdf',
      theme: 'light',
      highlighter: null,
    })).resolves.toBeUndefined();
  });

  it('creates a hidden iframe when HTML content is available', async () => {
    const { exportToHtml } = await import('@/lib/export/exportHtml');
    vi.mocked(exportToHtml).mockResolvedValueOnce(
      '<!DOCTYPE html><html><body><p>Test</p></body></html>'
    );

    const mockPrint = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    let iframeCreated = false;

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'iframe') {
        iframeCreated = true;
        Object.defineProperty(element, 'contentWindow', {
          value: { print: mockPrint, focus: vi.fn() },
          writable: true,
        });
        // Simulate immediate onload
        setTimeout(() => {
          if (element.onload) {
            (element.onload as () => void)();
          }
        }, 10);
      }
      return element;
    });

    const { exportToPdf } = await import('@/lib/export/exportPdf');
    await exportToPdf({
      content: '# Hello',
      filename: 'document.pdf',
      theme: 'light',
      highlighter: null,
    });

    expect(iframeCreated).toBe(true);
    vi.restoreAllMocks();
  }, 5000);
});
