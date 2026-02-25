import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock usePreview hook
vi.mock('@/hooks/usePreview', () => ({
  usePreview: vi.fn(() => ({ html: '', isLoading: false })),
}));

// Mock PreviewRenderer
vi.mock('@/components/preview/PreviewRenderer', () => ({
  PreviewRenderer: vi.fn(({ html }: { html: string }) => (
    <div data-testid="preview-renderer">{html}</div>
  )),
}));

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
  },
}));

// Mock shiki
vi.mock('shiki', () => ({
  createHighlighter: vi.fn().mockResolvedValue({
    codeToHtml: vi.fn().mockReturnValue('<pre></pre>'),
  }),
}));

// Mock editorStore
vi.mock('@/store/editorStore', () => ({
  useEditorStore: vi.fn((selector: (s: { content: string }) => string) =>
    selector({ content: '' }),
  ),
}));

describe('MarkdownPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders placeholder when content is empty', async () => {
    const { usePreview } = await import('@/hooks/usePreview');
    (usePreview as ReturnType<typeof vi.fn>).mockReturnValue({ html: '', isLoading: false });

    const { MarkdownPreview } = await import('@/components/preview/MarkdownPreview');
    render(<MarkdownPreview />);

    expect(screen.getByText('Start writing...')).toBeDefined();
  });

  it('renders PreviewRenderer when html is available', async () => {
    const { usePreview } = await import('@/hooks/usePreview');
    (usePreview as ReturnType<typeof vi.fn>).mockReturnValue({
      html: '<p>Hello</p>',
      isLoading: false,
    });

    const { MarkdownPreview } = await import('@/components/preview/MarkdownPreview');
    render(<MarkdownPreview />);

    expect(screen.getByTestId('preview-renderer')).toBeDefined();
  });

  it('shows placeholder text "Start writing..." when html is empty', async () => {
    const { usePreview } = await import('@/hooks/usePreview');
    (usePreview as ReturnType<typeof vi.fn>).mockReturnValue({ html: '', isLoading: false });

    const { MarkdownPreview } = await import('@/components/preview/MarkdownPreview');
    render(<MarkdownPreview />);

    expect(screen.queryByTestId('preview-renderer')).toBeNull();
    expect(screen.getByText('Start writing...')).toBeDefined();
  });

  it('has overflow-y-auto class for scrolling', async () => {
    const { usePreview } = await import('@/hooks/usePreview');
    (usePreview as ReturnType<typeof vi.fn>).mockReturnValue({
      html: '<p>Content</p>',
      isLoading: false,
    });

    const { MarkdownPreview } = await import('@/components/preview/MarkdownPreview');
    const { container } = render(<MarkdownPreview />);
    const outerDiv = container.firstChild as HTMLElement;

    expect(outerDiv.className).toContain('overflow-auto');
  });

  it('passes html to PreviewRenderer', async () => {
    const { usePreview } = await import('@/hooks/usePreview');
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const mockPreviewRenderer = PreviewRenderer as ReturnType<typeof vi.fn>;

    (usePreview as ReturnType<typeof vi.fn>).mockReturnValue({
      html: '<h1>Test</h1>',
      isLoading: false,
    });

    const { MarkdownPreview } = await import('@/components/preview/MarkdownPreview');
    render(<MarkdownPreview />);

    expect(mockPreviewRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ html: '<h1>Test</h1>' }),
      expect.anything(),
    );
  });
});
