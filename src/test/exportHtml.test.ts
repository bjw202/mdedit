/**
 * SPEC-EXPORT-001: HTML Export tests
 *
 * Tests the exportToHtml function which generates self-contained HTML.
 * Mocks ipc.ts at module level so tests work without Tauri runtime.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri IPC at module level - must be before any imports that use it
vi.mock('@/lib/tauri/ipc', () => ({
  exportSaveDialog: vi.fn(),
  writeBinaryFile: vi.fn(),
  saveFileAs: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  createFile: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  readDirectory: vi.fn(),
  openDirectoryDialog: vi.fn(),
  startWatch: vi.fn(),
  stopWatch: vi.fn(),
}));

// Mock renderer
vi.mock('@/lib/markdown/renderer', () => ({
  renderMarkdown: vi.fn().mockResolvedValue('<p>Rendered content</p>'),
}));

// Mock codeHighlight
vi.mock('@/lib/markdown/codeHighlight', () => ({
  getHighlighter: vi.fn().mockResolvedValue(null),
}));

// Mock Tauri core (for write_file call inside exportHtml)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

describe('ExportHtml: exportToHtml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a valid HTML string when save dialog is confirmed', async () => {
    const { exportSaveDialog } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce('/path/to/output.html');

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    const result = await exportToHtml({
      content: '# Hello World',
      filename: 'document.html',
      theme: 'light',
      highlighter: null,
    });

    expect(typeof result).toBe('string');
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html');
    expect(result).toContain('preview-content');
  });

  it('returns null when user cancels save dialog (REQ-EXPORT-017)', async () => {
    const { exportSaveDialog } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce(null);

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    const result = await exportToHtml({
      content: '# Hello',
      filename: 'document.html',
      theme: 'light',
      highlighter: null,
    });

    expect(result).toBeNull();
  });

  it('does not include script tags in HTML output (REQ-EXPORT-020)', async () => {
    const { exportSaveDialog } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce('/path/to/output.html');

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    const result = await exportToHtml({
      content: '# Hello',
      filename: 'document.html',
      theme: 'light',
      highlighter: null,
    });

    // REQ-EXPORT-020: No JavaScript in exported HTML
    if (result !== null) {
      expect(result).not.toContain('<script');
    }
  });

  it('includes rendered markdown content in HTML output (REQ-EXPORT-002)', async () => {
    const { exportSaveDialog } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce('/path/to/output.html');

    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    vi.mocked(renderMarkdown).mockResolvedValueOnce('<h1>Hello World</h1>');

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    const result = await exportToHtml({
      content: '# Hello World',
      filename: 'document.html',
      theme: 'light',
      highlighter: null,
    });

    if (result !== null) {
      expect(result).toContain('<h1>Hello World</h1>');
    }
  });

  it('uses dark theme CSS variables when theme is dark (REQ-EXPORT-014)', async () => {
    const { exportSaveDialog } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce('/path/to/output.html');

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    const result = await exportToHtml({
      content: '# Hello',
      filename: 'document.html',
      theme: 'dark',
      highlighter: null,
    });

    if (result !== null) {
      expect(result).toContain('data-theme="dark"');
    }
  });

  it('uses light theme CSS variables when theme is light (REQ-EXPORT-015)', async () => {
    const { exportSaveDialog } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce('/path/to/output.html');

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    const result = await exportToHtml({
      content: '# Hello',
      filename: 'document.html',
      theme: 'light',
      highlighter: null,
    });

    if (result !== null) {
      expect(result).toContain('data-theme="light"');
    }
  });

  it('calls exportSaveDialog with html format and correct default name (REQ-EXPORT-016)', async () => {
    const { exportSaveDialog } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce(null);

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    await exportToHtml({
      content: '# Hello',
      filename: 'my-notes.md',
      theme: 'light',
      highlighter: null,
    });

    expect(exportSaveDialog).toHaveBeenCalledWith('html', 'my-notes.html');
  });
});
