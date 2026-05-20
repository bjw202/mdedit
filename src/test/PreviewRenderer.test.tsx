import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn().mockResolvedValue(true),
    render: vi.fn().mockResolvedValue({ svg: '<svg>mermaid-diagram</svg>' }),
  },
}));

describe('PreviewRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders html content via dangerouslySetInnerHTML', async () => {
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    render(<PreviewRenderer html="<p>Hello World</p>" />);
    const p = document.querySelector('p');
    expect(p?.textContent).toBe('Hello World');
  });

  it('renders empty string without crashing', async () => {
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const { container } = render(<PreviewRenderer html="" />);
    expect(container).toBeDefined();
  });

  it('renders headings from html prop', async () => {
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    render(<PreviewRenderer html="<h1>Title</h1>" />);
    const h1 = document.querySelector('h1');
    expect(h1?.textContent).toBe('Title');
  });

  it('renders code blocks from html prop', async () => {
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    render(<PreviewRenderer html="<pre><code>const x = 1;</code></pre>" />);
    const code = document.querySelector('code');
    expect(code?.textContent).toBe('const x = 1;');
  });

  it('calls mermaid.parse then mermaid.render for mermaid-container elements', async () => {
    const mermaidModule = await import('mermaid');
    const mockMermaid = mermaidModule.default;

    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const diagram = 'graph TD\n  A --> B';
    const html = `<div class="mermaid-container" data-diagram="${diagram}"></div>`;

    render(<PreviewRenderer html={html} />);

    // Wait for useEffect to run
    await vi.waitFor(() => {
      expect(mockMermaid.parse).toHaveBeenCalledWith(diagram);
      expect(mockMermaid.render).toHaveBeenCalled();
    });
  });

  it('shows friendly error when mermaid.parse fails (invalid syntax)', async () => {
    const mermaidModule = await import('mermaid');
    const mockMermaid = mermaidModule.default;
    (mockMermaid.parse as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Syntax error in text'),
    );

    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const html = `<div class="mermaid-container" data-diagram="invalid diagram"></div>`;

    expect(() => render(<PreviewRenderer html={html} />)).not.toThrow();

    await vi.waitFor(() => {
      const errorEl = document.querySelector('.mermaid-container p');
      expect(errorEl?.textContent).toContain('Diagram syntax error');
    });
  });

  it('handles mermaid render error gracefully when parse succeeds but render fails', async () => {
    const mermaidModule = await import('mermaid');
    const mockMermaid = mermaidModule.default;
    (mockMermaid.render as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Render error'),
    );

    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const html = `<div class="mermaid-container" data-diagram="graph TD\n  A --> B"></div>`;

    expect(() => render(<PreviewRenderer html={html} />)).not.toThrow();

    await vi.waitFor(() => {
      expect(mockMermaid.render).toHaveBeenCalled();
    });
  });

  it('has preview-content class on container', async () => {
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const { container } = render(<PreviewRenderer html="<p>test</p>" />);
    const previewDiv = container.firstChild as HTMLElement;
    expect(previewDiv.className).toContain('preview-content');
  });

  it('zoom prop이 2이면 .preview-content의 inline style.zoom이 "2"이다 (헤딩 포함 전체 스케일)', async () => {
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const { container } = render(<PreviewRenderer html="<h1>x</h1>" zoom={2} />);
    const previewDiv = container.firstChild as HTMLElement;
    // CSS zoom 속성이 숫자로 설정되면 브라우저(jsdom)는 문자열 "2"로 반환
    expect(previewDiv.style.zoom).toBe('2');
  });
});
