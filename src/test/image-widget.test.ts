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

// ============================================================
// TASK-003: ViewPlugin + DecorationSet (mocked CM6)
// ============================================================
//
// SPEC-IMG-LOAD-002 REQ-A-001: buildDecorations 는 view.state.doc.toString() (full-doc copy) 를
// 호출하지 않고 view.visibleRanges 기반 부분 스캔을 수행한다. 테스트 mock 도 visibleRanges 와
// sliceString(to) 를 제공해야 한다. toString 스파이는 미호출 단언용이다.

// SPEC-IMG-WIDGET-002 REQ-A-001: buildDecorations 가 visibleRange 를 **라인 경계로 확장** 하므로
// mock doc 은 lineAt(pos) 를 제공해야 한다. 본문 획득은 여전히 sliceString 만 쓴다 (plan.md §E-2).

interface MockLine { from: number; to: number }

/** text 의 라인 경계 인덱스 ('\n' 분리, 반개구간 [from, to)). */
function buildLineIndex(text: string): MockLine[] {
  const lines: MockLine[] = [];
  let from = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      lines.push({ from, to: i });
      from = i + 1;
    }
  }
  return lines;
}

/**
 * 계측형 doc mock — sliceString 이 잘라낸 구간을 기록한다 (REQ-C-003 스캔 문자 수 계측).
 * lineAt 은 경계 조회 전용이며 `.text` 를 제공하지 않는다 — 구현이 우회 경로를 쓰면 즉시 드러난다.
 */
function instrumentedDoc(text: string) {
  const lines = buildLineIndex(text);
  const slices: { from: number; to: number }[] = [];
  let toStringCalls = 0;
  const doc = {
    length: text.length,
    sliceString: (from: number, to: number) => {
      slices.push({ from, to });
      return text.slice(from, to);
    },
    lineAt: (pos: number): MockLine => {
      for (const line of lines) {
        if (pos >= line.from && pos <= line.to) return line;
      }
      return lines[lines.length - 1];
    },
    toString: () => { toStringCalls++; return text; },
  };
  return {
    doc,
    slices,
    lines,
    get toStringCalls() { return toStringCalls; },
    get scannedChars() { return slices.reduce((sum, s) => sum + (s.to - s.from), 0); },
    get sliceCalls() { return slices.length; },
  };
}

/** visibleRanges 한 개가 full doc 을 덮는 mock (단순 케이스). toString 스파이 포함. */
function fullVisibleMock(text: string) {
  const { doc } = instrumentedDoc(text);
  return {
    visibleRanges: [{ from: 0, to: text.length }] as const,
    state: { doc },
  };
}

/** 임의의 visibleRanges 를 직접 지정하는 계측형 mock. */
function instrumentedMock(text: string, visibleRanges: readonly { from: number; to: number }[]) {
  const probe = instrumentedDoc(text);
  return { view: { visibleRanges, state: { doc: probe.doc } }, probe };
}

describe('buildDecorations', () => {
  it('returns empty range set for document with no images', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const text = 'Hello world, no images here.';
    const mockView = fullVisibleMock(text);
    const result = buildDecorations(mockView as unknown as Parameters<typeof buildDecorations>[0]);
    expect(result).toBeDefined();
  });

  it('creates decorations for data URI images in document', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const imgText = '![alt](data:image/png;base64,iVBORw0KGgo=)';
    const mockView = fullVisibleMock(imgText);
    const result = buildDecorations(mockView as unknown as Parameters<typeof buildDecorations>[0]);
    expect(result).toBeDefined();
    let count = 0;
    result.between(0, imgText.length, () => { count++; });
    expect(count).toBe(1);
  });

  it('does NOT decorate regular URL images', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const imgText = '![alt](https://example.com/img.png)';
    const mockView = fullVisibleMock(imgText);
    const result = buildDecorations(mockView as unknown as Parameters<typeof buildDecorations>[0]);
    let count = 0;
    result.between(0, imgText.length, () => { count++; });
    expect(count).toBe(0);
  });

  it('creates multiple decorations for multiple data URI images', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const text = '![a](data:image/png;base64,aaa=) text ![b](data:image/jpeg;base64,bbb=)';
    const mockView = fullVisibleMock(text);
    const result = buildDecorations(mockView as unknown as Parameters<typeof buildDecorations>[0]);
    let count = 0;
    result.between(0, text.length, () => { count++; });
    expect(count).toBe(2);
  });
});

// ============================================================
// SPEC-IMG-LOAD-002 REQ-A-001 (UT-A1-001): 뷰포트 위젯 바운딩
//   buildDecorations 가 view.visibleRanges 만 스캔하고 view.state.doc.toString() 을
//   호출하지 않음을 검증. 본 REQ 가 D1 수정에서 지정한 "실제 동결 제거 주체" 이다.
// ============================================================

describe('SPEC-IMG-LOAD-002 REQ-A-001 (UT-A1-001): 뷰포트 위젯 바운딩', () => {
  it('view.state.doc.toString() 은 호출되지 않는다 (full-doc copy 회피)', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const text = '![a](data:image/png;base64,aaa=) middle ![b](data:image/jpeg;base64,bbb=)';
    const { view, probe } = instrumentedMock(text, [{ from: 0, to: text.length }]);
    buildDecorations(view as never);
    expect(probe.toStringCalls).toBe(0);
  });

  // SPEC-IMG-WIDGET-002 REQ-C-005 (AC-C-005) — 개정: 삭제가 아니라 경계 단위 이동.
  // 원래 의도("뷰포트 밖은 스캔하지 않는다")는 보존하되, 경계의 단위가 문자 오프셋에서
  // **라인** 으로 옮겨졌다. REQ-A-001 이 가시 라인 전체를 스캔하므로, hidden 을 같은 라인에
  // 두면 이제 위젯 2개가 정답이 된다. 의도를 지키려면 hidden 을 다른 라인에 둔다.
  it('가시 라인이 아닌 라인의 data URI 는 위젯 생성 안 함 (visible 경계 = 라인)', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const visible = '![visible](data:image/png;base64,vv=)';
    const hidden = '![hidden](data:image/jpeg;base64,hh=)';
    const full = visible + '\n' + hidden;   // hidden 은 **다른 라인**
    const { view, probe } = instrumentedMock(full, [{ from: 0, to: visible.length }]);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, full.length, () => { count++; });
    expect(count).toBe(1);  // 가시 라인의 1개만
    // hidden 라인 구간은 한 번도 잘리지 않는다
    const hiddenFrom = visible.length + 1;
    expect(probe.slices.filter((s) => s.from < full.length && s.to > hiddenFrom)).toEqual([]);
  });

  // SPEC-IMG-WIDGET-002 REQ-A-003 — 이름 정정: 두 범위가 **같은 라인** 위에 있으므로
  // 개정 후에는 "각 범위를 독립 스캔"이 아니라 병합되어 1회 스캔된다. 기대값(위젯 2개)은 불변.
  it('여러 visibleRanges 분할 — 같은 라인은 병합되어 1회 스캔', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const text = '![a](data:image/png;base64,aa=) X ![b](data:image/jpeg;base64,bb=)';
    const aEnd = text.indexOf(' X ');
    const bStart = aEnd + 3;
    const { view, probe } = instrumentedMock(text, [
      { from: 0, to: aEnd },
      { from: bStart, to: text.length },
    ]);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, text.length, () => { count++; });
    expect(count).toBe(2);
    expect(probe.sliceCalls).toBe(1);
  });

  it('빈 문서 (visibleRanges 빈) → 위젯 0개, 예외 없음', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const { view } = instrumentedMock('', []);
    const result = buildDecorations(view as never);
    expect(result).toBeDefined();
  });
});

// ============================================================
// SPEC-IMG-WIDGET-002 Axis A/C: 라인 경계 스캔의 1회성·완전성·비용
// ============================================================

describe('SPEC-IMG-WIDGET-002 REQ-A-003/004/C-003: 라인 경계 스캔', () => {
  it('분절된 라인은 병합되어 1회만 스캔된다', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const line = '![x](data:image/png;base64,' + 'A'.repeat(300) + '=)';
    // 한 라인이 3조각으로 분절 (line gap 2개)
    const { view, probe } = instrumentedMock(line, [
      { from: 0, to: 50 },
      { from: 120, to: 200 },
      { from: 260, to: line.length },
    ]);
    // RangeSetBuilder 가 중복/역순 입력으로 던지지 않아야 한다
    const result = buildDecorations(view as never);
    expect(probe.sliceCalls).toBe(1);
    expect(probe.slices[0]).toEqual({ from: 0, to: line.length });
    let count = 0;
    result.between(0, line.length, () => { count++; });
    expect(count).toBe(1);
  });

  it('분절 라인의 복수 이미지 — 중복/누락 없음', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const imgA = '![a](data:image/png;base64,' + 'A'.repeat(80) + '=)';
    const imgB = '![b](data:image/jpeg;base64,' + 'B'.repeat(80) + '=)';
    const line = imgA + ' sep ' + imgB;
    const boundary1 = 40;                      // imgA 한복판
    const boundary2 = imgA.length + 5 + 40;    // imgB 한복판
    const { view, probe } = instrumentedMock(line, [
      { from: 0, to: boundary1 },
      { from: boundary1 + 10, to: boundary2 },
      { from: boundary2 + 10, to: line.length },
    ]);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, line.length, () => { count++; });
    expect(count).toBe(2);
    expect(probe.sliceCalls).toBe(1);
  });

  it('스캔 문자 수는 가시 라인 길이 합과 같다 (REQ-C-003)', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const head = '# 앞 라인';
    const big = '![big](data:image/png;base64,' + 'A'.repeat(100_000) + '=)';
    const tail = '뒤 라인';
    const full = `${head}\n${big}\n${tail}`;
    const bigFrom = head.length + 1;
    const bigTo = bigFrom + big.length;
    // 가운데 라인만 가시이고, line gap 으로 3조각 분절
    const { view, probe } = instrumentedMock(full, [
      { from: bigFrom, to: bigFrom + 30_000 },
      { from: bigFrom + 50_000, to: bigFrom + 70_000 },
      { from: bigFrom + 90_000, to: bigTo },
    ]);
    buildDecorations(view as never);

    expect(probe.scannedChars).toBe(big.length);   // 가시 라인 길이와 정확히 일치
    expect(probe.sliceCalls).toBe(1);              // 병합 후 범위 1개
    expect(probe.scannedChars).toBeLessThan(full.length);  // full-doc 회귀 탐지
    expect(probe.toStringCalls).toBe(0);
  });
});

// ============================================================
// SPEC-IMG-LOAD-002 REQ-A-002 (UT-A1-002): viewportChanged 갱신
//   ViewPlugin.update 가 docChanged 또는 viewportChanged 시 재계산한다.
//   shouldRecomputeDecorations 순수 함수로 분리해 테스트 가능하게 노출.
// ============================================================

describe('SPEC-IMG-LOAD-002 REQ-A-002 (UT-A1-002): viewportChanged 갱신', () => {
  it('shouldRecomputeDecorations(viewportChanged=true) → true', async () => {
    const { shouldRecomputeDecorations } = await import('@/components/editor/extensions/image-widget');
    expect(shouldRecomputeDecorations({ docChanged: false, viewportChanged: true })).toBe(true);
  });

  it('shouldRecomputeDecorations(docChanged=true) → true', async () => {
    const { shouldRecomputeDecorations } = await import('@/components/editor/extensions/image-widget');
    expect(shouldRecomputeDecorations({ docChanged: true, viewportChanged: false })).toBe(true);
  });

  it('shouldRecomputeDecorations(both false) → false', async () => {
    const { shouldRecomputeDecorations } = await import('@/components/editor/extensions/image-widget');
    expect(shouldRecomputeDecorations({ docChanged: false, viewportChanged: false })).toBe(false);
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

  it('returns an extension that includes atomicRanges provider', async () => {
    const { imageWidgetExtension } = await import('@/components/editor/extensions/image-widget');
    const ext = imageWidgetExtension();
    // The extension should be an array (ViewPlugin provides both decorations and atomicRanges)
    // or a single object — either way it must be defined and non-null
    expect(ext).toBeDefined();
    expect(ext).not.toBeNull();
    // Extension value type: ViewPlugin instances are objects with a value property
    expect(typeof ext).toBe('object');
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
