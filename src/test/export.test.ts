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

  // SPEC-PREVIEW-016 AC-005/006: 다이어그램 컨테이너 규칙은 고정 팔레트(잉크 앤 허니)를 따른다.
  // 두 테마 모두 바탕은 #FAF9F6 상수이고, 종이 카드(테두리·반경) 선언은 다크 출력에만 있다(라이트 무카드).
  // 카드 값은 승인 팔레트 상수의 리터럴 — 내보낸 문서 0-잔여 계약(015 AC-020)이 var(--pele-를 금지한다.
  const extractMermaidContainerRule = (css: string): string => {
    const marker = '.preview-content .mermaid-container {';
    const start = css.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    const end = css.indexOf('}', start);
    expect(end).toBeGreaterThan(start);
    return css.slice(start, end + 1);
  };

  it('paints the diagram container background with the fixed paper color #FAF9F6 in both themes (AC-PREVIEW016-006)', async () => {
    const { getPreviewCss } = await import('@/lib/export/exportUtils');
    for (const theme of ['light', 'dark'] as const) {
      const rule = extractMermaidContainerRule(getPreviewCss(theme));
      expect(rule).toContain('background-color: #FAF9F6');
    }
  });

  it('exports the dark paper-card border and radius on the diagram container (AC-PREVIEW016-005)', async () => {
    const { getPreviewCss } = await import('@/lib/export/exportUtils');
    const rule = extractMermaidContainerRule(getPreviewCss('dark'));
    expect(rule).toContain('border: 1px solid #97A4B1');
    expect(rule).toContain('border-radius: 3px');
  });

  it('keeps the light diagram container free of card border and radius declarations (AC-PREVIEW016-005)', async () => {
    const { getPreviewCss } = await import('@/lib/export/exportUtils');
    const rule = extractMermaidContainerRule(getPreviewCss('light'));
    expect(rule).not.toContain('#97A4B1');
    expect(rule).not.toContain('border-radius: 3px');
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
