// @MX:SPEC: SPEC-IMG-WIDGET-001
// Tests for CodeMirror 6 Image Widget Decoration extension

import { describe, it, expect } from 'vitest';

// ============================================================
// TASK-001: Pure Utility Functions
// ============================================================

describe('parseDataUriImage', () => {
  it('parses a valid data URI image pattern', async () => {
    const { parseDataUriImage } = await import('@/components/editor/extensions/image-widget');
    const text = '![screenshot](data:image/png;base64,iVBORw0KGgo=)';
    const results = parseDataUriImage(text);
    expect(results).toHaveLength(1);
    expect(results[0].alt).toBe('screenshot');
    expect(results[0].dataUri).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(results[0].mimeType).toBe('image/png');
    expect(results[0].from).toBe(0);
    expect(results[0].to).toBe(text.length);
  });

  it('parses JPEG data URI image', async () => {
    const { parseDataUriImage } = await import('@/components/editor/extensions/image-widget');
    const text = '![photo](data:image/jpeg;base64,/9j/4AAQ=)';
    const results = parseDataUriImage(text);
    expect(results).toHaveLength(1);
    expect(results[0].mimeType).toBe('image/jpeg');
  });

  it('parses GIF data URI image', async () => {
    const { parseDataUriImage } = await import('@/components/editor/extensions/image-widget');
    const text = '![anim](data:image/gif;base64,R0lGODlh=)';
    const results = parseDataUriImage(text);
    expect(results).toHaveLength(1);
    expect(results[0].mimeType).toBe('image/gif');
  });

  it('parses WEBP data URI image', async () => {
    const { parseDataUriImage } = await import('@/components/editor/extensions/image-widget');
    const text = '![logo](data:image/webp;base64,UklGRg==)';
    const results = parseDataUriImage(text);
    expect(results).toHaveLength(1);
    expect(results[0].mimeType).toBe('image/webp');
  });

  it('does NOT match regular file path images', async () => {
    const { parseDataUriImage } = await import('@/components/editor/extensions/image-widget');
    const text = '![alt](./images/file.png)';
    const results = parseDataUriImage(text);
    expect(results).toHaveLength(0);
  });

  it('does NOT match HTTP URL images', async () => {
    const { parseDataUriImage } = await import('@/components/editor/extensions/image-widget');
    const text = '![alt](https://example.com/img.png)';
    const results = parseDataUriImage(text);
    expect(results).toHaveLength(0);
  });

  it('parses empty alt text', async () => {
    const { parseDataUriImage } = await import('@/components/editor/extensions/image-widget');
    const text = '![](data:image/png;base64,abc=)';
    const results = parseDataUriImage(text);
    expect(results).toHaveLength(1);
    expect(results[0].alt).toBe('');
  });

  it('finds multiple data URI images in text', async () => {
    const { parseDataUriImage } = await import('@/components/editor/extensions/image-widget');
    const text = '![a](data:image/png;base64,aaa=) and ![b](data:image/jpeg;base64,bbb=)';
    const results = parseDataUriImage(text);
    expect(results).toHaveLength(2);
    expect(results[0].alt).toBe('a');
    expect(results[1].alt).toBe('b');
  });

  it('returns correct from/to positions for each match', async () => {
    const { parseDataUriImage } = await import('@/components/editor/extensions/image-widget');
    const prefix = 'some text ';
    const img = '![x](data:image/png;base64,xyz=)';
    const text = prefix + img;
    const results = parseDataUriImage(text);
    expect(results[0].from).toBe(prefix.length);
    expect(results[0].to).toBe(text.length);
  });
});

describe('calculateBase64Size', () => {
  it('calculates size of base64 string in KB', async () => {
    const { calculateBase64Size } = await import('@/components/editor/extensions/image-widget');
    // 4 chars = 3 bytes
    const base64 = 'AAAA'; // 4 chars -> 3 bytes -> ~0.0KB
    const result = calculateBase64Size(base64);
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d+\.\d+$/);
  });

  it('calculates size correctly for known input', async () => {
    const { calculateBase64Size } = await import('@/components/editor/extensions/image-widget');
    // 1024 bytes = 1KB, base64 length for 1024 bytes = ceil(1024 * 4/3) = 1368 chars
    const base64 = 'A'.repeat(1368);
    const result = calculateBase64Size(base64);
    // sizeInBytes = ceil(1368 * 3 / 4) = ceil(1026) = 1026, sizeInKB = 1026/1024 ~= 1.0
    expect(parseFloat(result)).toBeCloseTo(1.0, 0);
  });

  it('returns 0.0 for empty string', async () => {
    const { calculateBase64Size } = await import('@/components/editor/extensions/image-widget');
    const result = calculateBase64Size('');
    expect(result).toBe('0.0');
  });

  it('formats result to one decimal place', async () => {
    const { calculateBase64Size } = await import('@/components/editor/extensions/image-widget');
    const base64 = 'A'.repeat(100);
    const result = calculateBase64Size(base64);
    expect(result).toMatch(/^\d+\.\d$/);
  });
});

// ============================================================
// TASK-002: WidgetType Subclass
// ============================================================

describe('ImageWidget', () => {
  it('toDOM() returns a span element with class cm-image-widget', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const widget = new ImageWidget('screenshot', 'data:image/png;base64,iVBORw0KGgo=', 'image/png');
    const dom = widget.toDOM();
    expect(dom.tagName.toLowerCase()).toBe('span');
    expect(dom.classList.contains('cm-image-widget')).toBe(true);
  });

  it('toDOM() contains an img element with correct src', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const uri = 'data:image/png;base64,iVBORw0KGgo=';
    const widget = new ImageWidget('alt text', uri, 'image/png');
    const dom = widget.toDOM();
    const img = dom.querySelector('img.cm-image-widget-thumb') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe(uri);
  });

  it('toDOM() img element has max-height style of 80px', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const widget = new ImageWidget('alt', 'data:image/png;base64,abc=', 'image/png');
    const dom = widget.toDOM();
    const img = dom.querySelector('img.cm-image-widget-thumb') as HTMLImageElement;
    expect(img.style.maxHeight).toBe('80px');
  });

  it('toDOM() contains alt text span', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const widget = new ImageWidget('my screenshot', 'data:image/png;base64,abc=', 'image/png');
    const dom = widget.toDOM();
    const altSpan = dom.querySelector('.cm-image-widget-alt');
    expect(altSpan).not.toBeNull();
    expect(altSpan!.textContent).toBe('my screenshot');
  });

  it('toDOM() contains meta span with MIME type and size', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const widget = new ImageWidget('alt', 'data:image/png;base64,AAAA', 'image/png');
    const dom = widget.toDOM();
    const metaSpan = dom.querySelector('.cm-image-widget-meta');
    expect(metaSpan).not.toBeNull();
    expect(metaSpan!.textContent).toContain('PNG');
  });

  it('toDOM() meta shows JPEG for image/jpeg', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const widget = new ImageWidget('photo', 'data:image/jpeg;base64,/9j/', 'image/jpeg');
    const dom = widget.toDOM();
    const metaSpan = dom.querySelector('.cm-image-widget-meta');
    expect(metaSpan!.textContent).toContain('JPEG');
  });

  it('toDOM() meta shows WEBP for image/webp', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const widget = new ImageWidget('logo', 'data:image/webp;base64,UklG', 'image/webp');
    const dom = widget.toDOM();
    const metaSpan = dom.querySelector('.cm-image-widget-meta');
    expect(metaSpan!.textContent).toContain('WEBP');
  });

  it('eq() returns true for same alt and same URI prefix', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const uri = 'data:image/png;base64,' + 'A'.repeat(200);
    const w1 = new ImageWidget('alt', uri, 'image/png');
    const w2 = new ImageWidget('alt', uri, 'image/png');
    expect(w1.eq(w2)).toBe(true);
  });

  it('eq() returns false for different alt text', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const uri = 'data:image/png;base64,iVBOR';
    const w1 = new ImageWidget('alt1', uri, 'image/png');
    const w2 = new ImageWidget('alt2', uri, 'image/png');
    expect(w1.eq(w2)).toBe(false);
  });

  it('eq() returns false for different data URI', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const w1 = new ImageWidget('alt', 'data:image/png;base64,AAAA', 'image/png');
    const w2 = new ImageWidget('alt', 'data:image/png;base64,BBBB', 'image/png');
    expect(w1.eq(w2)).toBe(false);
  });

  it('toDOM() applies CSS variables via class attributes', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const widget = new ImageWidget('alt', 'data:image/png;base64,abc=', 'image/png');
    const dom = widget.toDOM();
    // Widget uses CSS class for theming (CSS variables), not inline styles
    expect(dom.classList.contains('cm-image-widget')).toBe(true);
  });
});

// ============================================================
// TASK-003: ViewPlugin + DecorationSet (mocked CM6)
// ============================================================

describe('buildDecorations', () => {
  it('returns empty range set for document with no images', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    // Minimal mock for EditorView
    const mockView = {
      state: {
        doc: {
          toString: () => 'Hello world, no images here.',
          length: 28,
        },
      },
    };
    const result = buildDecorations(mockView as unknown as Parameters<typeof buildDecorations>[0]);
    // Should be a valid range set (no decorations)
    expect(result).toBeDefined();
  });

  it('creates decorations for data URI images in document', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const imgText = '![alt](data:image/png;base64,iVBORw0KGgo=)';
    const mockView = {
      state: {
        doc: {
          toString: () => imgText,
          length: imgText.length,
        },
      },
    };
    const result = buildDecorations(mockView as unknown as Parameters<typeof buildDecorations>[0]);
    expect(result).toBeDefined();
    // Verify it's not empty by checking the range set has content
    let count = 0;
    result.between(0, imgText.length, () => { count++; });
    expect(count).toBe(1);
  });

  it('does NOT decorate regular URL images', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const imgText = '![alt](https://example.com/img.png)';
    const mockView = {
      state: {
        doc: {
          toString: () => imgText,
          length: imgText.length,
        },
      },
    };
    const result = buildDecorations(mockView as unknown as Parameters<typeof buildDecorations>[0]);
    let count = 0;
    result.between(0, imgText.length, () => { count++; });
    expect(count).toBe(0);
  });

  it('creates multiple decorations for multiple data URI images', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const text = '![a](data:image/png;base64,aaa=) text ![b](data:image/jpeg;base64,bbb=)';
    const mockView = {
      state: {
        doc: {
          toString: () => text,
          length: text.length,
        },
      },
    };
    const result = buildDecorations(mockView as unknown as Parameters<typeof buildDecorations>[0]);
    let count = 0;
    result.between(0, text.length, () => { count++; });
    expect(count).toBe(2);
  });
});

// ============================================================
// TASK-004: Extension Registration
// ============================================================

describe('imageWidgetExtension', () => {
  it('is exported from image-widget module', async () => {
    const module = await import('@/components/editor/extensions/image-widget');
    expect(typeof module.imageWidgetExtension).toBe('function');
  });

  it('returns a valid CodeMirror extension', async () => {
    const { imageWidgetExtension } = await import('@/components/editor/extensions/image-widget');
    const ext = imageWidgetExtension();
    // A CM6 extension is either an array, object, or function - just not null/undefined
    expect(ext).toBeDefined();
    expect(ext).not.toBeNull();
  });
});

// ============================================================
// TASK-005: CSS Variables (structural test only)
// ============================================================

describe('Widget DOM uses CSS class for theming', () => {
  it('widget root element has cm-image-widget class for CSS variable theming', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const widget = new ImageWidget('test', 'data:image/png;base64,abc=', 'image/png');
    const dom = widget.toDOM();
    // CSS variables are applied via .cm-image-widget class in index.css
    expect(dom.classList.contains('cm-image-widget')).toBe(true);
  });

  it('widget info section has correct class structure', async () => {
    const { ImageWidget } = await import('@/components/editor/extensions/image-widget');
    const widget = new ImageWidget('test', 'data:image/png;base64,abc=', 'image/png');
    const dom = widget.toDOM();
    const info = dom.querySelector('.cm-image-widget-info');
    expect(info).not.toBeNull();
  });
});
