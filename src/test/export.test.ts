/**
 * SPEC-EXPORT-001: Export utilities tests
 *
 * Tests for ExportUtils (types, filename generation, HTML building, CSS extraction)
 * and IPC wrappers (exportSaveDialog, writeBinaryFile).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri APIs at module level
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// ============================================================
// Task 3: Types and Utilities tests
// ============================================================

describe('ExportUtils: generateExportFilename', () => {
  it('replaces .md extension with target format extension', async () => {
    const { generateExportFilename } = await import('@/lib/export/exportUtils');
    expect(generateExportFilename('document.md', 'html')).toBe('document.html');
    expect(generateExportFilename('document.md', 'pdf')).toBe('document.pdf');
    expect(generateExportFilename('document.md', 'docx')).toBe('document.docx');
  });

  it('replaces .markdown extension with target format extension', async () => {
    const { generateExportFilename } = await import('@/lib/export/exportUtils');
    expect(generateExportFilename('notes.markdown', 'html')).toBe('notes.html');
  });

  it('appends extension if no markdown extension present', async () => {
    const { generateExportFilename } = await import('@/lib/export/exportUtils');
    expect(generateExportFilename('document', 'html')).toBe('document.html');
  });

  it('uses "document" as fallback when filename is empty', async () => {
    const { generateExportFilename } = await import('@/lib/export/exportUtils');
    expect(generateExportFilename('', 'html')).toBe('document.html');
  });

  it('handles filenames with path separators', async () => {
    const { generateExportFilename } = await import('@/lib/export/exportUtils');
    const result = generateExportFilename('/path/to/my-notes.md', 'pdf');
    expect(result).toBe('my-notes.pdf');
  });
});

describe('ExportUtils: buildHtmlDocument', () => {
  it('creates a valid HTML document structure', async () => {
    const { buildHtmlDocument } = await import('@/lib/export/exportUtils');
    const result = buildHtmlDocument({
      title: 'Test',
      content: '<p>Hello</p>',
      css: 'body { color: red; }',
      theme: 'light',
    });
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html');
    expect(result).toContain('<head>');
    expect(result).toContain('<body>');
    expect(result).toContain('</html>');
  });

  it('includes title in head', async () => {
    const { buildHtmlDocument } = await import('@/lib/export/exportUtils');
    const result = buildHtmlDocument({
      title: 'My Document',
      content: '<p>Content</p>',
      css: '',
      theme: 'light',
    });
    expect(result).toContain('<title>My Document</title>');
  });

  it('includes CSS in style tag', async () => {
    const { buildHtmlDocument } = await import('@/lib/export/exportUtils');
    const result = buildHtmlDocument({
      title: 'Test',
      content: '<p>Content</p>',
      css: '.preview-content { color: blue; }',
      theme: 'light',
    });
    expect(result).toContain('<style>');
    expect(result).toContain('.preview-content { color: blue; }');
    expect(result).toContain('</style>');
  });

  it('includes body content in preview-content div', async () => {
    const { buildHtmlDocument } = await import('@/lib/export/exportUtils');
    const result = buildHtmlDocument({
      title: 'Test',
      content: '<p>Body content here</p>',
      css: '',
      theme: 'light',
    });
    expect(result).toContain('class="preview-content"');
    expect(result).toContain('<p>Body content here</p>');
  });

  it('sets data-theme attribute for dark theme', async () => {
    const { buildHtmlDocument } = await import('@/lib/export/exportUtils');
    const result = buildHtmlDocument({
      title: 'Test',
      content: '<p>Content</p>',
      css: '',
      theme: 'dark',
    });
    expect(result).toContain('data-theme="dark"');
  });

  it('sets data-theme attribute for light theme', async () => {
    const { buildHtmlDocument } = await import('@/lib/export/exportUtils');
    const result = buildHtmlDocument({
      title: 'Test',
      content: '<p>Content</p>',
      css: '',
      theme: 'light',
    });
    expect(result).toContain('data-theme="light"');
  });

  it('does not include JavaScript script tags', async () => {
    const { buildHtmlDocument } = await import('@/lib/export/exportUtils');
    const result = buildHtmlDocument({
      title: 'Test',
      content: '<p>Content</p>',
      css: '',
      theme: 'light',
    });
    // REQ-EXPORT-020: No JavaScript in exported HTML
    expect(result).not.toContain('<script');
  });
});

describe('ExportUtils: getPreviewCss', () => {
  it('returns a non-empty CSS string', async () => {
    const { getPreviewCss } = await import('@/lib/export/exportUtils');
    const css = getPreviewCss('light');
    expect(typeof css).toBe('string');
    expect(css.length).toBeGreaterThan(0);
  });

  it('includes preview-content styles', async () => {
    const { getPreviewCss } = await import('@/lib/export/exportUtils');
    const css = getPreviewCss('light');
    expect(css).toContain('preview-content');
  });
});

// ============================================================
// Task 2: IPC wrapper tests
// ============================================================

describe('IPC: exportSaveDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls invoke with export_save_dialog command', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockResolvedValueOnce('/path/to/export.html');

    const { exportSaveDialog } = await import('@/lib/tauri/ipc');
    const result = await exportSaveDialog('html', 'document.html');

    expect(mockInvoke).toHaveBeenCalledWith('export_save_dialog', {
      format: 'html',
      defaultName: 'document.html',
    });
    expect(result).toBe('/path/to/export.html');
  });

  it('returns null when user cancels dialog', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockResolvedValueOnce(null);

    const { exportSaveDialog } = await import('@/lib/tauri/ipc');
    const result = await exportSaveDialog('pdf', 'document.pdf');
    expect(result).toBeNull();
  });
});

describe('IPC: writeBinaryFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls invoke with write_binary_file command', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockResolvedValueOnce(undefined);

    const { writeBinaryFile } = await import('@/lib/tauri/ipc');
    await writeBinaryFile('/path/to/file.docx', [1, 2, 3, 4]);

    expect(mockInvoke).toHaveBeenCalledWith('write_binary_file', {
      path: '/path/to/file.docx',
      data: [1, 2, 3, 4],
    });
  });
});
