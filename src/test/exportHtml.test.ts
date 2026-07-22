/**
 * SPEC-EXPORT-001 / SPEC-EXPORT-002: HTML Export tests
 *
 * Tests the exportToHtml function which generates self-contained HTML.
 * Mocks ipc.ts at module level so tests work without Tauri runtime.
 *
 * SPEC-EXPORT-002 (REQ-007): 반환 계약 변경 — exportToHtml 은 이제 HTML 문서 문자열이
 * 아니라 **저장 경로**를 반환한다(성공 시 path, 취소 시 null). HTML 본문 품질 단언은
 * writeFile 페이로드로 마이그레이션했다(검증 의도 보존).
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

  // SPEC-EXPORT-002 REQ-007 (성공절): 반환값 = 저장 경로.
  it('returns the save path when save dialog is confirmed (REQ-EXPORT-002-007)', async () => {
    const { exportSaveDialog } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce('/path/to/output.html');

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    const result = await exportToHtml({
      content: '# Hello World',
      filename: 'document.html',
      theme: 'light',
      highlighter: null,
    });

    expect(result).toBe('/path/to/output.html');
  });

  // SPEC-EXPORT-002 REQ-007 (취소절) + REQ-017.
  it('returns null when user cancels save dialog (REQ-EXPORT-002-007, REQ-017)', async () => {
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

  // SPEC-EXPORT-001 REQ-020: HTML 본문에 <script> 가 없어야 한다.
  // SPEC-EXPORT-002: 반환값이 경로가 되었으므로, 본문 품질은 writeFile 페이로드로 검증한다.
  it('writes HTML without script tags (REQ-EXPORT-020)', async () => {
    const { exportSaveDialog, writeFile } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce('/path/to/output.html');

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    await exportToHtml({
      content: '# Hello',
      filename: 'document.html',
      theme: 'light',
      highlighter: null,
    });

    expect(writeFile).toHaveBeenCalledTimes(1);
    const [, writtenContent] = vi.mocked(writeFile).mock.calls[0];
    expect(writtenContent).not.toContain('<script');
  });

  // SPEC-EXPORT-001 REQ-002: 렌더링된 마크다운이 파일에 포함되어야 한다.
  it('includes rendered markdown content in the written HTML (REQ-EXPORT-002)', async () => {
    const { exportSaveDialog, writeFile } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce('/path/to/output.html');
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    vi.mocked(renderMarkdown).mockResolvedValueOnce('<h1>Hello World</h1>');

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    await exportToHtml({
      content: '# Hello World',
      filename: 'document.html',
      theme: 'light',
      highlighter: null,
    });

    const [, writtenContent] = vi.mocked(writeFile).mock.calls[0];
    expect(writtenContent).toContain('<h1>Hello World</h1>');
  });

  // SPEC-EXPORT-001 REQ-014: dark 테마 적용.
  it('uses dark theme CSS variables when theme is dark (REQ-EXPORT-014)', async () => {
    const { exportSaveDialog, writeFile } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce('/path/to/output.html');

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    await exportToHtml({
      content: '# Hello',
      filename: 'document.html',
      theme: 'dark',
      highlighter: null,
    });

    const [, writtenContent] = vi.mocked(writeFile).mock.calls[0];
    expect(writtenContent).toContain('data-theme="dark"');
  });

  // SPEC-EXPORT-001 REQ-015: light 테마 적용.
  it('uses light theme CSS variables when theme is light (REQ-EXPORT-015)', async () => {
    const { exportSaveDialog, writeFile } = await import('@/lib/tauri/ipc');
    vi.mocked(exportSaveDialog).mockResolvedValueOnce('/path/to/output.html');

    const { exportToHtml } = await import('@/lib/export/exportHtml');
    await exportToHtml({
      content: '# Hello',
      filename: 'document.html',
      theme: 'light',
      highlighter: null,
    });

    const [, writtenContent] = vi.mocked(writeFile).mock.calls[0];
    expect(writtenContent).toContain('data-theme="light"');
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
