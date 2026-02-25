/**
 * SPEC-EXPORT-001: PDF Export tests
 *
 * Tests the exportToPdf function which uses Tauri's native print API
 * with @media print CSS to export markdown content as PDF.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock exportHtml module
vi.mock('@/lib/export/exportHtml', () => ({
  generateHtmlContent: vi.fn(),
}));

// Mock IPC
vi.mock('@/lib/tauri/ipc', () => ({
  exportSaveDialog: vi.fn(),
  writeBinaryFile: vi.fn(),
  printCurrentWindow: vi.fn(),
}));

describe('ExportPdf: exportToPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any leftover print elements
    document.getElementById('pdf-export-print')?.remove();
    document.getElementById('pdf-export-print-style')?.remove();
  });

  it('calls generateHtmlContent with the provided options', async () => {
    const { generateHtmlContent } = await import('@/lib/export/exportHtml');
    const { printCurrentWindow } = await import('@/lib/tauri/ipc');
    vi.mocked(generateHtmlContent).mockResolvedValueOnce(
      '<!DOCTYPE html><html><head><style>body { color: black; }</style></head><body><p>Test</p></body></html>'
    );
    vi.mocked(printCurrentWindow).mockResolvedValueOnce(undefined);

    const { exportToPdf } = await import('@/lib/export/exportPdf');
    await exportToPdf({
      content: '# Hello',
      filename: 'document.pdf',
      theme: 'light',
      highlighter: null,
    });

    expect(generateHtmlContent).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(generateHtmlContent).mock.calls[0][0];
    expect(callArgs.content).toBe('# Hello');
    expect(callArgs.theme).toBe('light');
  }, 5000);

  it('injects print container and calls Tauri print IPC', async () => {
    const { generateHtmlContent } = await import('@/lib/export/exportHtml');
    const { printCurrentWindow } = await import('@/lib/tauri/ipc');
    vi.mocked(generateHtmlContent).mockResolvedValueOnce(
      '<!DOCTYPE html><html><head></head><body><p>Test Content</p></body></html>'
    );

    let containerExisted = false;
    vi.mocked(printCurrentWindow).mockImplementationOnce(async () => {
      // Verify print container exists in DOM when print is called
      const container = document.getElementById('pdf-export-print');
      containerExisted = container !== null;
    });

    const { exportToPdf } = await import('@/lib/export/exportPdf');
    await exportToPdf({
      content: '# Hello',
      filename: 'document.pdf',
      theme: 'light',
      highlighter: null,
    });

    expect(printCurrentWindow).toHaveBeenCalledOnce();
    expect(containerExisted).toBe(true);

    // Elements remain in DOM after print resolves (cleanup deferred to afterprint)
    expect(document.getElementById('pdf-export-print')).not.toBeNull();
    expect(document.getElementById('pdf-export-print-style')).not.toBeNull();

    // Simulate afterprint event to trigger deferred cleanup
    window.dispatchEvent(new Event('afterprint'));

    expect(document.getElementById('pdf-export-print')).toBeNull();
    expect(document.getElementById('pdf-export-print-style')).toBeNull();
  }, 5000);

  it('cleans up immediately if print fails', async () => {
    const { generateHtmlContent } = await import('@/lib/export/exportHtml');
    const { printCurrentWindow } = await import('@/lib/tauri/ipc');
    vi.mocked(generateHtmlContent).mockResolvedValueOnce(
      '<!DOCTYPE html><html><head></head><body><p>Fail</p></body></html>'
    );
    vi.mocked(printCurrentWindow).mockRejectedValueOnce(new Error('Print failed'));

    const { exportToPdf } = await import('@/lib/export/exportPdf');
    await expect(
      exportToPdf({
        content: '# Hello',
        filename: 'document.pdf',
        theme: 'light',
        highlighter: null,
      })
    ).rejects.toThrow('Print failed');

    // Verify immediate cleanup on error (no afterprint needed)
    expect(document.getElementById('pdf-export-print')).toBeNull();
    expect(document.getElementById('pdf-export-print-style')).toBeNull();
  }, 5000);
});
