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
    // data-line attribute is now injected for scroll sync
    expect(result).toContain('<p');
    expect(result).toContain('Hello world</p>');
  });

  it('renders headings correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('# Heading 1', null);
    // data-line attribute is now injected for scroll sync
    expect(result).toContain('<h1');
    expect(result).toContain('Heading 1</h1>');
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
    // data-line attribute is now injected for scroll sync
    expect(result).toContain('<ul');
    expect(result).toContain('<li>item1</li>');
  });

  it('renders ordered list correctly', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('1. first\n2. second', null);
    // data-line attribute is now injected for scroll sync
    expect(result).toContain('<ol');
    expect(result).toContain('<li>first</li>');
  });

  it('renders table correctly with inline border styles', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const table = '| Col1 | Col2 |\n|------|------|\n| A | B |';
    const result = await renderMarkdown(table, null);
    // data-line attribute and border styles are injected
    expect(result).toContain('<table');
    expect(result).toContain('border-collapse: separate');
    expect(result).toContain('border-spacing: 0');
    // th and td have right+bottom border (not border: 1px solid) to avoid WebKit clipping
    expect(result).toContain('border-right: 1px solid var(--table-border, #d1d5db)');
    expect(result).toContain('border-bottom: 1px solid var(--table-border, #d1d5db)');
    // cell content is present
    expect(result).toContain('>Col1</th>');
    expect(result).toContain('>A</td>');
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

describe('renderMarkdown: data-line plugin (SPEC-PREVIEW-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects data-line attribute on paragraph elements', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('Hello world', null);
    expect(result).toContain('data-line="0"');
  });

  it('injects data-line attribute on heading elements', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('# Heading', null);
    expect(result).toContain('data-line="0"');
  });

  it('injects data-line attribute on list elements', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('- item1\n- item2', null);
    expect(result).toContain('data-line=');
  });

  it('injects data-line attribute on blockquote elements', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const result = await renderMarkdown('> quote text', null);
    expect(result).toContain('data-line=');
    expect(result).toContain('<blockquote');
  });

  it('injects data-line attribute on table elements', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const table = '| Col1 | Col2 |\n|------|------|\n| A | B |';
    const result = await renderMarkdown(table, null);
    expect(result).toContain('data-line=');
    expect(result).toContain('<table');
  });

  it('uses correct 0-based line numbers for multi-line content', async () => {
    const { renderMarkdown } = await import('@/lib/markdown/renderer');
    const content = 'First paragraph\n\nSecond paragraph';
    const result = await renderMarkdown(content, null);
    expect(result).toContain('data-line="0"');
    expect(result).toContain('data-line="2"');
  });
});
