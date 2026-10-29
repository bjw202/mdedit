// @MX:SPEC: SPEC-PREVIEW-015
// 내보내기(HTML·PDF용 HTML·DOCX)가 미리보기 DOM 없이 원본 펜스에서 다이어그램을 렌더하는지 확인한다.
// AC-PREVIEW015-017·018·019·020·021, AC-025(내보내기 부분).
//
// 실제 renderMarkdown·markdown-it·pele·다이어그램 모듈을 쓴다. 대체하는 것은 다음뿐이다.
//   - IPC(@/lib/tauri/ipc): 저장 대화상자·파일 쓰기
//   - pele render: 통과형 감시 래퍼(vi.fn(real.render)) — 입력 문자열 기록용, 출력은 실제 pele
//   - 수식 크기 측정: jsdom은 DOM 크기를 0으로 재므로 48×20 고정값 주입(design.md D14, renderDiagramForTest)
//   - 테마 색 값 표: jsdom은 앱 CSS를 읽지 않으므로 readPeleThemeValues를 주입 표로 바꿈 — 표 값은
//     mdedit-tokens.css :root의 고정 팔레트 리터럴을 그대로 읽는다(SPEC-PREVIEW-016, 테마 무관)
//   - Image·canvas: jsdom에는 캔버스가 없다. Image는 src(래스터 입력 SVG data URI)를 기록하고 onload만 부르며,
//     canvas.toBlob은 고정 바이트를 돌려준다. 그래서 PNG 픽셀은 증명하지 않는다 — 래스터 입력 SVG·크기·위치만 증명한다.

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ipc = vi.hoisted(() => ({
  readImageAsBase64: vi.fn(),
  readRelativeImageAsBase64: vi.fn(),
  exportSaveDialog: vi.fn(),
  writeFile: vi.fn(),
  writeBinaryFile: vi.fn(),
}));
vi.mock('@/lib/tauri/ipc', () => ipc);
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), convertFileSrc: vi.fn((p: string) => p) }));

vi.mock('pele', async (importOriginal) => {
  const real = await importOriginal<typeof import('pele')>();
  return { ...real, render: vi.fn(real.render) };
});

// 고정 팔레트 값 표(SPEC-PREVIEW-016) — mdedit-tokens.css :root의 pele 리터럴을 그대로 읽는다.
// 라이트·다크가 같은 표를 가리킨다(테마는 다이어그램 색의 입력이 아님, AC-PREVIEW016-004).
// 아래 가드 테스트가 이 표가 CSS 단일 :root 블록과 24개 이름 전부에서 일치하는지 고정한다
// (016의 23개 + SPEC-PREVIEW-017 판단 테두리 decision-border).
const VAR_NAMES = [
  'accent', 'bg', 'border', 'fg', 'font', 'font-mono', 'heading-weight', 'line', 'muted', 'radius',
  'series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6', 'series-7', 'series-8',
  'surface', 'surface-alt', 'title-weight', 'error', 'critical', 'decision-border',
];
const here = dirname(fileURLToPath(import.meta.url));
const peleTableFromCss = () => {
  const css = readFileSync(resolve(here, '..', 'styles', 'mdedit-tokens.css'), 'utf-8');
  const start = css.indexOf(':root {');
  const block = css.slice(start, css.indexOf('\n}', start));
  return Object.fromEntries(
    [...block.matchAll(/^\s*(--pele-[\w-]+):[ \t]*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]),
  ) as Record<string, string>;
};
const THEME = vi.hoisted(() => ({ light: {} as Record<string, string>, dark: {} as Record<string, string> }));
THEME.light = peleTableFromCss();
THEME.dark = THEME.light;

vi.mock('@/lib/diagram/diagramRenderer', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/diagram/diagramRenderer')>();
  return {
    ...real,
    renderDiagram: vi.fn((src: string) =>
      real.renderDiagramForTest(src, { measureMath: () => ({ width: 48, height: 20 }) }),
    ),
    readPeleThemeValues: vi.fn((theme: 'light' | 'dark') => THEME[theme]),
  };
});

const imageSrcs: string[] = [];
// canvas 스텁은 래스터 단계(Image onload ~ toBlob)에서만 켠다. pele도 글자 폭 측정에 canvas getContext를 쓰므로
// 항상 켜 두면 pele가 스텁을 측정기로 잡아 jsdom-default 측정(design.md D14)이 깨진다.
let rasterizing = false;
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
      imageSrcs.push(value);
      Promise.resolve().then(() => {
        rasterizing = true;
        try {
          this.onload?.();
        } finally {
          rasterizing = false;
        }
      });
    }
  },
);

vi.mock('docx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('docx')>();
  const ImageRunSpy = vi.fn().mockImplementation(
    (opts: unknown) => new actual.ImageRun(opts as ConstructorParameters<typeof actual.ImageRun>[0]),
  );
  const TextRunSpy = vi.fn().mockImplementation(
    (opts: unknown) => new actual.TextRun(opts as ConstructorParameters<typeof actual.TextRun>[0]),
  );
  return { ...actual, ImageRun: ImageRunSpy, TextRun: TextRunSpy };
});

import { ImageRun, TextRun } from 'docx';
import { render as peleRender } from 'pele';
import { exportToHtml, generateHtmlContent } from '@/lib/export/exportHtml';
import { exportToDocx } from '@/lib/export/exportDocx';
import { renderMarkdown } from '@/lib/markdown/renderer';
import * as diagramModule from '@/lib/diagram/diagramRenderer';

const PNG_BYTES = new Uint8Array([9, 8, 7, 6]);
const canvasWidths: number[] = [];
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;

// accTitle·accDescr가 있으면 pele가 idPrefix로 <title id>·<desc id>를 만든다 — id 중복 검사의 실제 대상.
const FLOW_A = 'flowchart LR\n  accTitle: 같은 제목\n  accDescr: 같은 설명\n  AAA_NODE --> B\n';
const FLOW_D = 'flowchart LR\n  accTitle: 같은 제목\n  accDescr: 같은 설명\n  DDD_NODE --> E\n';
const BAD_B = 'notarealdiagramtype foo!!!\n';
const ENTITY = 'flowchart LR\n  A[R&amp;D] --> B["따옴표"]';
const CLASSDEF =
  'flowchart LR\n  A[긴급 요청] --> B[분류]\n  B --> C[처리 완료]\n  B --> D[보류]\n  classDef hot fill:#f96,stroke:#333,stroke-width:2px,color:#000\n  classDef cool fill:#9cf,stroke:#036\n  class A hot\n  class C cool\n  style D fill:#ffd54f,stroke:#8d6e00,color:#3e2723\n';
const MATH = 'flowchart LR\n  A["$$x^2 + y^2$$"] --> B["$$\\frac{a}{b}$$"]\n  B --> C[일반 라벨]\n';

const fence = (src: string) => '```mermaid\n' + src + (src.endsWith('\n') || src === '' ? '' : '\n') + '```';
const doc = (...srcs: string[]) => srcs.map(fence).join('\n\n');
const opts = (content: string, theme: 'light' | 'dark' = 'light') => ({
  content,
  filename: 'a.md',
  theme,
  highlighter: null,
  mdFilePath: '/docs/a.md',
});

const writtenHtml = () => String(ipc.writeFile.mock.calls.at(-1)?.[1] ?? '');
const peleInputs = () => vi.mocked(peleRender).mock.calls.map((c) => c[0]);
const decodeSvgDataUri = (uri: string) => {
  const b64 = uri.replace(/^data:image\/svg\+xml;base64,/, '');
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
};
const rasterSvgs = () => imageSrcs.filter((s) => s.startsWith('data:image/svg+xml')).map(decodeSvgDataUri);

function containers(html: string): Element[] {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return Array.from(tpl.content.querySelectorAll('.mermaid-container'));
}
function bodyOf(fullHtml: string): string {
  const m = /<div class="preview-content">([\s\S]*)<\/div>\s*<\/body>/.exec(fullHtml);
  return m ? m[1] : fullHtml;
}
/** 미리보기(PreviewRenderer)가 같은 펜스에 넘기는 문자열 = renderMarkdown 결과의 data-diagram 속성값. */
async function previewInputs(content: string): Promise<string[]> {
  return containers(await renderMarkdown(content, null)).map((c) => c.getAttribute('data-diagram') ?? '');
}

beforeEach(() => {
  vi.clearAllMocks();
  imageSrcs.length = 0;
  canvasWidths.length = 0;
  ipc.exportSaveDialog.mockImplementation((kind: string) => Promise.resolve(`/out/a.${kind}`));
  ipc.writeFile.mockResolvedValue(undefined);
  ipc.writeBinaryFile.mockResolvedValue(undefined);
  ipc.readImageAsBase64.mockRejectedValue(new Error('no image'));
  ipc.readRelativeImageAsBase64.mockRejectedValue(new Error('no image'));
  rasterizing = false;
  HTMLCanvasElement.prototype.getContext = vi.fn(() =>
    rasterizing ? { scale: vi.fn(), drawImage: vi.fn() } : null,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, cb: BlobCallback) {
    canvasWidths.push(this.width);
    cb({ arrayBuffer: () => Promise.resolve(PNG_BYTES.slice().buffer) } as unknown as Blob);
  };
});

afterEach(() => {
  document.body.innerHTML = '';
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toBlob = originalToBlob;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('AC-PREVIEW015-017·018: 미리보기 DOM 없이 원본 펜스에서 렌더', () => {
  const content = doc(FLOW_A, FLOW_D, ENTITY);

  it('문서에 .mermaid-container가 없어도 HTML·PDF 결과의 모든 자리에 SVG가 있고 id가 겹치지 않는다', async () => {
    expect(document.querySelectorAll('.mermaid-container')).toHaveLength(0);

    await exportToHtml(opts(content));
    const html = writtenHtml();
    const pdf = await generateHtmlContent(opts(content));

    for (const out of [html, pdf]) {
      const cs = containers(bodyOf(out));
      expect(cs).toHaveLength(3);
      for (const c of cs) expect(c.querySelector('svg')).not.toBeNull();
      const ids = [...bodyOf(out).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      expect(ids.length).toBe(4); // A·D 각각 title·desc
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('DOCX는 펜스 3개에 다이어그램 PNG ImageRun을 3번 만든다', async () => {
    await exportToDocx(opts(content));
    const runs = vi.mocked(ImageRun).mock.calls.map((c) => c[0] as { type: string; data: Uint8Array });
    expect(runs).toHaveLength(3);
    for (const r of runs) {
      expect(r.type).toBe('png');
      expect(Array.from(r.data)).toEqual(Array.from(PNG_BYTES));
    }
  });

  it('세 경로가 pele에 넘긴 입력은 미리보기가 같은 펜스에 넘기는 문자열과 같다(엔티티 샘플 포함)', async () => {
    const expected = await previewInputs(content);
    // 엔티티 샘플: 미리보기 입력은 속성 디코드를 거친 값이다(토큰 원문과 다름).
    expect(expected[2]).toBe('flowchart LR\n  A[R&D] --> B["따옴표"]\n');

    await exportToHtml(opts(content));
    expect(peleInputs()).toEqual(expected);

    vi.mocked(peleRender).mockClear();
    await generateHtmlContent(opts(content));
    expect(peleInputs()).toEqual(expected);

    vi.mocked(peleRender).mockClear();
    await exportToDocx(opts(content));
    expect(peleInputs()).toEqual(expected);
  });

  it('문서에 남은 다른 다이어그램 DOM(미리보기 잔재)은 내보내기 결과에 쓰이지 않는다', async () => {
    const stale = document.createElement('div');
    stale.className = 'mermaid-container';
    stale.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><text>STALE_PREVIEW_DOM</text></svg>';
    document.body.appendChild(stale);

    await exportToHtml(opts(doc(FLOW_A)));
    expect(writtenHtml()).not.toContain('STALE_PREVIEW_DOM');
    expect(writtenHtml()).toContain('AAA_NODE');

    await exportToDocx(opts(doc(FLOW_A)));
    const svgs = rasterSvgs();
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toContain('AAA_NODE');
    expect(svgs[0]).not.toContain('STALE_PREVIEW_DOM');
  });
});

describe('AC-PREVIEW015-019: 실패·빈 펜스는 자기 자리만 차지한다', () => {
  const content = doc(FLOW_A, BAD_B, '', FLOW_D);

  it('HTML: 1·4번째 자리에 A·D의 SVG, 2·3번째는 비어 있다', async () => {
    await exportToHtml(opts(content));
    const cs = containers(bodyOf(writtenHtml()));
    expect(cs).toHaveLength(4);
    expect(cs[0].querySelector('svg')?.outerHTML).toContain('AAA_NODE');
    expect(cs[1].innerHTML).toBe('');
    expect(cs[2].innerHTML).toBe('');
    expect(cs[3].querySelector('svg')?.outerHTML).toContain('DDD_NODE');
  });

  it('DOCX: A의 PNG → B 코드 텍스트 → C 코드 텍스트 → D의 PNG 순서다', async () => {
    await exportToDocx(opts(content));
    type Ev = { order: number; kind: 'img' | 'text'; text?: string };
    const imgs: Ev[] = vi.mocked(ImageRun).mock.invocationCallOrder.map((order) => ({ order, kind: 'img' }));
    const texts: Ev[] = vi.mocked(TextRun).mock.calls.map((c, i) => ({
      order: vi.mocked(TextRun).mock.invocationCallOrder[i],
      kind: 'text',
      text: (c[0] as { text?: string }).text,
    }));
    const seq = [...imgs, ...texts].sort((a, b) => a.order - b.order).map((e) => (e.kind === 'img' ? 'IMG' : e.text));
    expect(seq).toEqual(['IMG', 'notarealdiagramtype foo!!!', ' ', ' ', 'IMG']);

    const svgs = rasterSvgs();
    expect(svgs).toHaveLength(2);
    expect(svgs[0]).toContain('AAA_NODE');
    expect(svgs[1]).toContain('DDD_NODE');
  });
});

describe('AC-PREVIEW016-004: 주입 표는 mdedit-tokens.css :root 고정 팔레트와 일치한다', () => {
  it('읽은 표는 pele 변수 24개 전부를 담고 라이트·다크가 같은 객체다', () => {
    expect(Object.keys(THEME.light).sort()).toEqual(VAR_NAMES.map((n) => `--pele-${n}`).sort());
    expect(THEME.dark).toBe(THEME.light);
  });
});

describe('AC-PREVIEW015-020: 내보낸 다이어그램의 --pele-*는 모두 실제 값으로 치환된다', () => {
  const content = doc(CLASSDEF, FLOW_A, MATH);

  async function svgsFor(format: 'html' | 'pdf' | 'docx', theme: 'light' | 'dark'): Promise<string[]> {
    if (format === 'docx') {
      await exportToDocx(opts(content, theme));
      return rasterSvgs();
    }
    const out = format === 'html' ? (await exportToHtml(opts(content, theme)), writtenHtml()) : await generateHtmlContent(opts(content, theme));
    return containers(bodyOf(out)).map((c) => c.innerHTML);
  }

  const combos: Array<['html' | 'pdf' | 'docx', 'light' | 'dark', 'light' | 'dark']> = [
    ['html', 'light', 'light'],
    ['html', 'dark', 'dark'],
    ['pdf', 'light', 'light'],
    ['pdf', 'dark', 'dark'],
    ['docx', 'light', 'light'],
    ['docx', 'dark', 'light'],
  ];

  for (const [format, theme, expectedTheme] of combos) {
    it(`${format} × ${theme} → 같은 고정 팔레트 값(${expectedTheme} 라벨)`, async () => {
      const svgs = await svgsFor(format, theme);
      expect(svgs).toHaveLength(3);
      const [classdef, , math] = svgs;
      // 0. 수식 다이어그램 전제
      expect(math).toMatch(/<foreignObject[^>]*class="pele-math"/);
      const mathInner = /<foreignObject[^>]*class="pele-math"[^>]*>([\s\S]*?)<\/foreignObject>/.exec(math)![1];
      expect(mathInner).toContain('<math');
      // 1. var(--pele- 0건 (수식 감싸기 안쪽 포함)
      for (const s of svgs) expect(s).not.toContain('var(--pele-');
      expect(mathInner).not.toContain('var(--pele-');
      // 2. 고정 팔레트 값 존재 — 라이트·다크 표가 같아 테마 라벨은 시나리오 구분일 뿐이다(AC-PREVIEW016-004·007).
      const want = THEME[expectedTheme];
      const all = svgs.join('\n').replace(/&quot;/g, '"');
      expect(all).toContain(want['--pele-bg']);
      expect(all).toContain(want['--pele-fg']);
      // 3. classDef·style 색 유지
      for (const c of ['#f96', '#333', '#9cf', '#036', '#ffd54f', '#8d6e00']) expect(classdef).toContain(c);
    });
  }

  it('HTML 문서 전체(CSS 포함)에도 var(--pele-가 없다', async () => {
    await exportToHtml(opts(content, 'dark'));
    expect(writtenHtml()).not.toContain('var(--pele-');
  });
});

// SPEC-PREVIEW-017: 판단(B·W)·시작/끝(A·Z)·사각형(C), W는 classDef 전체 지정, Z는 style 지정
const TONE =
  'flowchart TD\n  A([시작]) --> B{판단}\n  B --> W{둘째 판단}\n  W --> C[처리]\n  C --> Z([끝])\n  classDef hot fill:#ffeeee,stroke:#cc0000,stroke-width:3px\n  class W hot\n  style Z fill:#ddeeff,stroke:#004488\n';

describe('SPEC-PREVIEW-017 AC-003·006·007: 내보내기 모양 톤은 미리보기와 같고 0-잔여·작성자 우선을 지킨다', () => {
  const css = peleTableFromCss();
  const content = doc(TONE);

  /** 내보낸 다이어그램 SVG 문자열 → 노드 id별 노드 g의 style과 모양 요소의 style. */
  function toneOf(svgText: string) {
    const tpl = document.createElement('template');
    tpl.innerHTML = svgText;
    const node = (id: string) => {
      const g = tpl.content.querySelector(`.pele-node[data-id="${id}"]`)!;
      expect(g, `노드 ${id}`).not.toBeNull();
      const shape = g.querySelector(':scope > rect, :scope > polygon, :scope > path')!;
      return { g: g.getAttribute('style') ?? '', shape: shape.getAttribute('style') ?? '' };
    };
    return { A: node('A'), B: node('B'), W: node('W'), C: node('C'), Z: node('Z') };
  }

  async function svgsFor(format: 'html' | 'pdf' | 'docx', theme: 'light' | 'dark'): Promise<string[]> {
    if (format === 'docx') {
      await exportToDocx(opts(content, theme));
      return rasterSvgs();
    }
    const out = format === 'html' ? (await exportToHtml(opts(content, theme)), writtenHtml()) : await generateHtmlContent(opts(content, theme));
    return containers(bodyOf(out)).map((c) => c.innerHTML);
  }

  function expectTones(svgText: string, table: Record<string, string>) {
    expect(svgText).not.toContain('var(--pele-');
    const t = toneOf(svgText);
    // 판단: surface-alt 채움 + 판단 테두리 / 시작·끝: 액센트 테두리 + 1.5px / 사각형: 톤 없음
    expect(t.B.g).toContain(`--_s:${table['--pele-surface-alt']}`);
    expect(t.B.g).toContain(`--_b:${table['--pele-decision-border']}`);
    expect(t.A.g).toContain(`--_b:${table['--pele-accent']}`);
    expect(t.A.g).toContain('stroke-width:1.5px');
    expect(t.C.g).not.toMatch(/--_[sb]:/);
    // 작성자 값은 모양 요소 인라인 style에 그대로 남는다(지정한 속성만 이김)
    expect(t.W.shape).toContain('fill:#ffeeee');
    expect(t.W.shape).toContain('stroke:#cc0000');
    expect(t.W.shape).toContain('stroke-width:3px');
    expect(t.Z.shape).toContain('fill:#ddeeff');
    expect(t.Z.shape).toContain('stroke:#004488');
    return t;
  }

  for (const format of ['html', 'pdf', 'docx'] as const) {
    it(`${format}: 판단 #F7F2E7·판단 테두리, stadium #3A5673·1.5px, var(--pele- 0건, 작성자 색 보존 (AC-006·003)`, async () => {
      const svgs = await svgsFor(format, 'light');
      expect(svgs).toHaveLength(1);
      expect(css['--pele-surface-alt']).toBe('#F7F2E7');
      expect(css['--pele-accent']).toBe('#3A5673');
      expectTones(svgs[0], css);
    });
  }

  it('라이트·다크 내보내기의 다이어그램 톤 문자열이 같다 (AC-007)', async () => {
    for (const format of ['html', 'pdf', 'docx'] as const) {
      const light = toneOf((await svgsFor(format, 'light')).at(-1)!);
      imageSrcs.length = 0;
      const dark = toneOf((await svgsFor(format, 'dark')).at(-1)!);
      imageSrcs.length = 0;
      expect(dark, format).toEqual(light);
    }
  });

  it('탐침이 빈 표를 돌려줘도 주입부 대체 리터럴이 mdedit-tokens.css :root 토큰 값과 같다 (AC-006)', async () => {
    const real = await vi.importActual<typeof import('@/lib/diagram/diagramRenderer')>('@/lib/diagram/diagramRenderer');
    vi.mocked(diagramModule.readPeleThemeValues).mockImplementation(real.readPeleThemeValues);
    expect(real.readPeleThemeValues('light')).toEqual({}); // jsdom: 빈 표 경로 전제
    await exportToHtml(opts(content, 'light'));
    const [svg] = containers(bodyOf(writtenHtml())).map((c) => c.innerHTML);
    expectTones(svg, css);
  });
});

describe('AC-PREVIEW015-021: DOCX 크기는 pele width·height를 따른다', () => {
  it('ImageRun 크기 = pele 크기 × 0.75, 래스터 = 2배, 화면 상자 크기와 무관하고 getBoundingClientRect를 쓰지 않는다', async () => {
    const real = await vi.importActual<typeof import('@/lib/diagram/diagramRenderer')>('@/lib/diagram/diagramRenderer');
    const r = real.renderDiagram(FLOW_A);
    if (!r.ok) throw new Error('fixture render failed');

    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    const sizes: Array<{ width: number; height: number }> = [];
    for (const box of [120, 900]) {
      rectSpy.mockReturnValue({ width: box, height: box, top: 0, left: 0, right: box, bottom: box, x: 0, y: 0, toJSON: () => ({}) });
      rectSpy.mockClear();
      vi.mocked(ImageRun).mockClear();
      canvasWidths.length = 0;
      await exportToDocx(opts(doc(FLOW_A)));
      expect(rectSpy).not.toHaveBeenCalled();
      const t = (vi.mocked(ImageRun).mock.calls[0][0] as { transformation: { width: number; height: number } }).transformation;
      sizes.push(t);
      expect(canvasWidths).toEqual([r.width * 2]);
    }
    rectSpy.mockRestore();
    expect(sizes[0]).toEqual(sizes[1]);
    expect(sizes[0]).toEqual({ width: Math.round(r.width * 0.75), height: Math.round(r.height * 0.75) });
  });

  it('페이지 폭(415pt)을 넘으면 비율을 지켜 줄인다', async () => {
    const wide = 'flowchart LR\n' + Array.from({ length: 12 }, (_, i) => `  N${i}[긴 노드 이름 ${i}] --> N${i + 1}[긴 노드 이름 ${i + 1}]`).join('\n') + '\n';
    const real = await vi.importActual<typeof import('@/lib/diagram/diagramRenderer')>('@/lib/diagram/diagramRenderer');
    const r = real.renderDiagram(wide);
    if (!r.ok) throw new Error('fixture render failed');
    expect(r.width * 0.75).toBeGreaterThan(415);

    await exportToDocx(opts(doc(wide)));
    const t = (vi.mocked(ImageRun).mock.calls[0][0] as { transformation: { width: number; height: number } }).transformation;
    expect(t.width).toBe(415);
    expect(t.height).toBe(Math.round(r.height * 0.75 * (415 / (r.width * 0.75))));
  });
});

describe('AC-PREVIEW015-025 (내보내기 부분): 수식 다이어그램', () => {
  it('exportToHtml·generateHtmlContent 모두 foreignObject.pele-math 안에 <math>가 있고 KaTeX CSS·@font-face가 없다', async () => {
    await exportToHtml(opts(doc(MATH)));
    const html = writtenHtml();
    const pdf = await generateHtmlContent(opts(doc(MATH)));
    for (const out of [html, pdf]) {
      expect(out).toMatch(/<foreignObject[^>]*class="pele-math"[^>]*>[\s\S]*?<math[\s\S]*?<\/foreignObject>/);
      expect(out).not.toMatch(/\.katex\s*[{,.]/);
      expect(out).not.toContain('@font-face');
    }
  });

  it('DOCX 래스터 입력 SVG에 foreignObject.pele-math가 있고 ImageRun이 생긴다(코드 텍스트로 바뀌지 않음)', async () => {
    await exportToDocx(opts(doc(MATH)));
    const svgs = rasterSvgs();
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toMatch(/<foreignObject[^>]*class="pele-math"/);
    expect(svgs[0]).toContain('<math');
    expect(vi.mocked(ImageRun)).toHaveBeenCalledTimes(1);
    const texts = vi.mocked(TextRun).mock.calls.map((c) => String((c[0] as { text?: string }).text));
    expect(texts.some((t) => t.includes('$$'))).toBe(false);
  });
});

describe('테마 값 읽기 (실제 readPeleThemeValues, jsdom)', () => {
  it('jsdom에서 값이 비어도 치환은 pele 대체값으로 채워 var(--pele-를 남기지 않는다', async () => {
    const real = await vi.importActual<typeof import('@/lib/diagram/diagramRenderer')>('@/lib/diagram/diagramRenderer');
    vi.mocked(diagramModule.readPeleThemeValues).mockImplementation(real.readPeleThemeValues);
    await exportToHtml(opts(doc(FLOW_A), 'dark'));
    const html = writtenHtml();
    expect(html).toContain('AAA_NODE');
    expect(html).not.toContain('var(--pele-');
    expect(html).toContain('--_bg:#fff;'); // pele 대체값(--pele-bg)
    expect(document.querySelectorAll('[data-theme]')).toHaveLength(0); // 탐침은 남지 않는다
  });
});

describe('색 값 치환 함수 (실제 모듈)', () => {
  it('resolvePeleVars: 표에 있는 값으로 바꾸고, 없으면 대체값(중첩 포함)으로 바꾸며 다른 var()는 그대로 둔다', async () => {
    const real = await vi.importActual<typeof import('@/lib/diagram/diagramRenderer')>('@/lib/diagram/diagramRenderer');
    const css =
      '--_bg:var(--pele-bg,#fff);color:var(--_fg);--_x:var(--pele-nope,var(--pele-fg,rgb(1, 2, 3)));font-family:var(--pele-font,"Barlow", system-ui)';
    expect(real.resolvePeleVars(css, { '--pele-bg': '#123456', '--pele-font': '"F", serif' })).toBe(
      '--_bg:#123456;color:var(--_fg);--_x:rgb(1, 2, 3);font-family:"F", serif',
    );
  });

  it('resolveDiagramColors: 속성·<style> 텍스트·foreignObject 안쪽까지 var(--pele-를 없앤다', async () => {
    const real = await vi.importActual<typeof import('@/lib/diagram/diagramRenderer')>('@/lib/diagram/diagramRenderer');
    const r = real.renderDiagramForTest(MATH, { measureMath: () => ({ width: 48, height: 20 }) });
    if (!r.ok) throw new Error('fixture render failed');
    const tpl = document.createElement('template');
    tpl.innerHTML = r.svg;
    const svg = tpl.content.querySelector('svg')!;
    // 수식 감싸기 안쪽에도 참조가 있을 수 있음을 가정해 직접 넣어 본다(치환 범위 확인용, pele 출력 대체가 아님).
    svg.querySelector('foreignObject.pele-math div')!.setAttribute('style', 'color:var(--pele-fg,#000)');
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = '.x{fill:var(--pele-accent,#5b7bd5)}';
    svg.appendChild(style);
    expect(svg.outerHTML).toContain('var(--pele-');
    real.resolveDiagramColors(svg, THEME.dark);
    expect(svg.outerHTML).not.toContain('var(--pele-');
    expect(svg.outerHTML).toContain(THEME.dark['--pele-fg']);
    expect(style.textContent).toBe(`.x{fill:${THEME.dark['--pele-accent']}}`);
  });

  it('mdedit-tokens.css 라이트 블록이 [data-theme="light"] 탐침에도 걸린다(다크 앱에서 DOCX 라이트 값 읽기, D6)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const css = readFileSync(resolve(process.cwd(), 'src/styles/mdedit-tokens.css'), 'utf-8');
    expect(css).toMatch(/\[data-theme="light"\],\s*\n:root \{/);
  });
});
