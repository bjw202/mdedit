import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock shiki to avoid async initialization issues in tests
vi.mock('shiki', () => ({
  createHighlighter: vi.fn().mockResolvedValue({
    codeToHtml: vi.fn().mockReturnValue('<pre class="shiki"><code>const x = 1;</code></pre>'),
  }),
}));

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>diagram</svg>' }),
  },
}));

describe('renderMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders plain text as a paragraph', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('Hello world', null);
    expect(result).toContain('<p>Hello world</p>');
  });

  it('renders headings correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('# Heading 1', null);
    expect(result).toContain('<h1>Heading 1</h1>');
  });

  it('renders bold text correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('**bold**', null);
    expect(result).toContain('<strong>bold</strong>');
  });

  it('renders italic text correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('*italic*', null);
    expect(result).toContain('<em>italic</em>');
  });

  it('renders inline code correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('`code`', null);
    expect(result).toContain('<code>code</code>');
  });

  it('renders unordered list correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('- item1\n- item2', null);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>item1</li>');
  });

  it('renders ordered list correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('1. first\n2. second', null);
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>first</li>');
  });

  it('renders table correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const table = '| Col1 | Col2 |\n|------|------|\n| A | B |';
    const result = await renderMarkdown(table, null);
    expect(result).toContain('<table>');
    expect(result).toContain('<th>Col1</th>');
  });

  it('renders strikethrough text correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('~~strikethrough~~', null);
    expect(result).toContain('<s>strikethrough</s>');
  });

  it('renders mermaid code block as container div', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const mermaidCode = '```mermaid\ngraph TD\n  A --> B\n```';
    const result = await renderMarkdown(mermaidCode, null);
    expect(result).toContain('class="mermaid-container"');
    expect(result).toContain('data-diagram=');
  });

  it('does NOT render raw HTML (html: false XSS prevention)', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('<script>alert("xss")</script>', null);
    expect(result).not.toContain('<script>');
  });

  it('renders empty string without error', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('', null);
    expect(result).toBe('');
  });

  it('renders code block with shiki when highlighter is provided', async () => {
    const { createHighlighter } = await import('shiki');
    const mockHighlighter = await (createHighlighter as ReturnType<typeof vi.fn>)();

    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('```typescript\nconst x = 1;\n```', mockHighlighter);
    // shiki highlighter's codeToHtml should be called
    expect(mockHighlighter.codeToHtml).toHaveBeenCalled();
    expect(result).toContain('<pre');
  });

  it('falls back to default rendering when highlighter is null', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('```js\nconst x = 1;\n```', null);
    expect(result).toContain('<code');
  });
});
