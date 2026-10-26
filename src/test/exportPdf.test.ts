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

// SPEC-EXPORT-004 (REQ-010): 누락 이미지가 있으면 인쇄 전에 확인 콜백을 기다린다.
//   generateHtmlContent 는 mock 이지만, mock 구현이 options.onUnembeddedImages 를 호출해 누락을 흉내 낸다.
describe('ExportPdf: SPEC-EXPORT-004 누락 이미지 확인', () => {
  const HTML =
    '<!DOCTYPE html><html><head><title>NewTitle</title><style>p{}</style></head><body><p>X</p></body></html>';

  beforeEach(() => {
    vi.clearAllMocks();
    document.title = 'Before';
  });

  afterEach(() => {
    window.dispatchEvent(new Event('afterprint'));
    document.getElementById('pdf-export-print')?.remove();
    document.getElementById('pdf-export-print-style')?.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function arrange(names: string[] | null) {
    const { generateHtmlContent } = await import('@/lib/export/exportHtml');
    const { printCurrentWindow } = await import('@/lib/tauri/ipc');
    vi.mocked(generateHtmlContent).mockImplementationOnce(async (opts) => {
      if (names) opts.onUnembeddedImages?.(names);
      return HTML;
    });
    vi.mocked(printCurrentWindow).mockResolvedValue(undefined);
    const { exportToPdf } = await import('@/lib/export/exportPdf');
    return { exportToPdf, printCurrentWindow };
  }

  it('PF1: 확인 콜백은 제목·인쇄 요소·afterprint 리스너 변경 전에 이름 목록으로 1회 호출되고, true 면 인쇄한다', async () => {
    const { exportToPdf, printCurrentWindow } = await arrange(['a.png']);
    const addSpy = vi.spyOn(window, 'addEventListener');
    const snapshot: Record<string, unknown> = {};
    const confirm = vi.fn(async () => {
      snapshot.title = document.title;
      snapshot.container = document.getElementById('pdf-export-print');
      snapshot.style = document.getElementById('pdf-export-print-style');
      snapshot.afterprint = addSpy.mock.calls.filter((c) => c[0] === 'afterprint').length;
      return true;
    });

    await exportToPdf({
      content: '# x',
      filename: 'a.md',
      theme: 'light',
      highlighter: null,
      confirmUnembeddedImages: confirm,
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(['a.png']);
    expect(snapshot).toEqual({ title: 'Before', container: null, style: null, afterprint: 0 });
    expect(printCurrentWindow).toHaveBeenCalledTimes(1);
  });

  it('PF2: 확인 콜백이 false 면 인쇄하지 않고 제목·요소·리스너·타이머를 남기지 않는다', async () => {
    const { exportToPdf, printCurrentWindow } = await arrange(['a.png']);
    vi.useFakeTimers();
    const addSpy = vi.spyOn(window, 'addEventListener');

    await expect(
      exportToPdf({
        content: '# x',
        filename: 'a.md',
        theme: 'light',
        highlighter: null,
        confirmUnembeddedImages: async () => false,
      }),
    ).resolves.toBeUndefined();

    expect(printCurrentWindow).not.toHaveBeenCalled();
    expect(document.getElementById('pdf-export-print')).toBeNull();
    expect(document.getElementById('pdf-export-print-style')).toBeNull();
    expect(document.title).toBe('Before');
    expect(addSpy.mock.calls.filter((c) => c[0] === 'afterprint')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('PF3: 누락이 없으면 확인 콜백 없이 인쇄한다', async () => {
    const { exportToPdf, printCurrentWindow } = await arrange(null);
    const confirm = vi.fn(async () => true);

    await exportToPdf({
      content: '# x',
      filename: 'a.md',
      theme: 'light',
      highlighter: null,
      confirmUnembeddedImages: confirm,
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(printCurrentWindow).toHaveBeenCalledTimes(1);
  });
});
