/**
 * SPEC-EXPORT-001: DOCX export - data URI image handling tests
 *
 * Regression tests for inline-blob (data URI) image embedding in DOCX export.
 * Bug: images with data: URI src were silently falling through to alt text fallback
 * instead of being embedded as ImageRun objects.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock Tauri APIs at module level
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock IPC helpers used by exportToDocx
vi.mock('@/lib/tauri/ipc', () => ({
  exportSaveDialog: vi.fn(),
  writeBinaryFile: vi.fn(),
  readImageAsBase64: vi.fn(),
}));

// jsdom does not fire Image onload/onerror for data URIs.
// Stub globalThis.Image so getImageDimensions resolves immediately.
vi.stubGlobal(
  'Image',
  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 100;
    naturalHeight = 80;
    private _src = '';
    get src() {
      return this._src;
    }
    set src(value: string) {
      this._src = value;
      // Trigger onload asynchronously as a real browser would
      Promise.resolve().then(() => {
        if (this.onload) this.onload();
      });
    }
  },
);

// Mock docx so we can inspect what gets created
vi.mock('docx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('docx')>();

  // Wrap ImageRun to track calls
  const ImageRunSpy = vi.fn().mockImplementation((opts: unknown) => {
    return new actual.ImageRun(opts as ConstructorParameters<typeof actual.ImageRun>[0]);
  });

  // Wrap TextRun to track calls
  const TextRunSpy = vi.fn().mockImplementation((opts: unknown) => {
    return new actual.TextRun(opts as ConstructorParameters<typeof actual.TextRun>[0]);
  });

  return {
    ...actual,
    ImageRun: ImageRunSpy,
    TextRun: TextRunSpy,
  };
});

// Minimal 1x1 transparent PNG as base64 (valid PNG binary)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const DATA_URI_PNG = `data:image/png;base64,${TINY_PNG_BASE64}`;

describe('exportToDocx: data URI image handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('embeds a data URI image as ImageRun instead of falling back to alt text', async () => {
    const { exportSaveDialog, writeBinaryFile } = await import('@/lib/tauri/ipc');
    const { ImageRun, TextRun } = await import('docx');

    vi.mocked(exportSaveDialog).mockResolvedValue('/tmp/test.docx');
    vi.mocked(writeBinaryFile).mockResolvedValue(undefined);

    const { exportToDocx } = await import('@/lib/export/exportDocx');

    const markdownWithDataUri = `![screenshot](${DATA_URI_PNG})`;

    await exportToDocx({
      content: markdownWithDataUri,
      filename: 'test.md',
      theme: 'light',
      highlighter: null,
      mdFilePath: null,
    });

    // ImageRun should have been called (data URI image was embedded)
    expect(ImageRun).toHaveBeenCalled();

    // The alt text fallback TextRun with "[screenshot]" should NOT have been created
    const textRunCalls = vi.mocked(TextRun).mock.calls;
    const altTextCall = textRunCalls.find(
      (call) => typeof call[0] === 'object' && 'text' in call[0] && (call[0] as { text: string }).text === '[screenshot]',
    );
    expect(altTextCall).toBeUndefined();
  });

  it('passes the correct binary data to ImageRun for a data URI', async () => {
    const { exportSaveDialog, writeBinaryFile } = await import('@/lib/tauri/ipc');
    const { ImageRun } = await import('docx');

    vi.mocked(exportSaveDialog).mockResolvedValue('/tmp/test.docx');
    vi.mocked(writeBinaryFile).mockResolvedValue(undefined);

    const { exportToDocx } = await import('@/lib/export/exportDocx');

    await exportToDocx({
      content: `![img](${DATA_URI_PNG})`,
      filename: 'test.md',
      theme: 'light',
      highlighter: null,
      mdFilePath: null,
    });

    expect(ImageRun).toHaveBeenCalled();

    const imageRunArgs = vi.mocked(ImageRun).mock.calls[0][0] as {
      data: Uint8Array;
      transformation: { width: number; height: number };
      type: string;
    };

    // data should be a non-empty Uint8Array (decoded PNG bytes)
    expect(imageRunArgs.data).toBeInstanceOf(Uint8Array);
    expect(imageRunArgs.data.length).toBeGreaterThan(0);

    // type should be 'png'
    expect(imageRunArgs.type).toBe('png');

    // transformation should have positive dimensions
    expect(imageRunArgs.transformation.width).toBeGreaterThan(0);
    expect(imageRunArgs.transformation.height).toBeGreaterThan(0);
  });

  it('still falls back to alt text for http:// image URLs (non-data-uri)', async () => {
    const { exportSaveDialog, writeBinaryFile } = await import('@/lib/tauri/ipc');
    const { ImageRun, TextRun } = await import('docx');

    vi.mocked(exportSaveDialog).mockResolvedValue('/tmp/test.docx');
    vi.mocked(writeBinaryFile).mockResolvedValue(undefined);

    const { exportToDocx } = await import('@/lib/export/exportDocx');

    await exportToDocx({
      content: '![remote image](http://example.com/photo.png)',
      filename: 'test.md',
      theme: 'light',
      highlighter: null,
      mdFilePath: null,
    });

    // ImageRun should NOT have been called for http:// URLs
    expect(ImageRun).not.toHaveBeenCalled();

    // Alt text fallback: a TextRun with a bracketed alt text like "[...]" should appear
    const textRunCalls = vi.mocked(TextRun).mock.calls;
    const altTextCall = textRunCalls.find(
      (call) =>
        typeof call[0] === 'object' &&
        'text' in call[0] &&
        typeof (call[0] as { text: string }).text === 'string' &&
        (call[0] as { text: string }).text.startsWith('[') &&
        (call[0] as { text: string }).text.endsWith(']'),
    );
    expect(altTextCall).toBeDefined();
  });

  it('handles data URI with jpeg mime type and sets type to jpg', async () => {
    const { exportSaveDialog, writeBinaryFile } = await import('@/lib/tauri/ipc');
    const { ImageRun } = await import('docx');

    vi.mocked(exportSaveDialog).mockResolvedValue('/tmp/test.docx');
    vi.mocked(writeBinaryFile).mockResolvedValue(undefined);

    const { exportToDocx } = await import('@/lib/export/exportDocx');

    // Use jpeg mime type (same base64 bytes - just testing mime parsing)
    const jpegDataUri = `data:image/jpeg;base64,${TINY_PNG_BASE64}`;

    await exportToDocx({
      content: `![photo](${jpegDataUri})`,
      filename: 'test.md',
      theme: 'light',
      highlighter: null,
      mdFilePath: null,
    });

    expect(ImageRun).toHaveBeenCalled();

    const imageRunArgs = vi.mocked(ImageRun).mock.calls[0][0] as { type: string };
    expect(imageRunArgs.type).toBe('jpg');
  });
});
