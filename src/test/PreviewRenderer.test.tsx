// @MX:SPEC: SPEC-PREVIEW-001 SPEC-PREVIEW-008 SPEC-PREVIEW-010 SPEC-UI-008 SPEC-PREVIEW-015
// PreviewRenderer 단위 테스트. 다이어그램은 실제 pele 1.10.0으로 다이어그램 모듈을 거쳐 렌더한다.
// pele는 통과형 감시 래퍼로만 감싼다(실제 구현에 그대로 위임, 반환값을 바꾸지 않음 — acceptance.md mock 원칙).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';

vi.mock('pele', async (importOriginal) => {
  const real = await importOriginal<typeof import('pele')>();
  return { ...real, render: vi.fn(real.render) };
});

import { render as peleRender } from 'pele';
import { renderDiagram, formatDiagramError, PELE_RENDER_OPTIONS } from '@/lib/diagram/diagramRenderer';
import { PreviewRenderer } from '@/components/preview/PreviewRenderer';

const peleMock = vi.mocked(peleRender);

/** jsdom 기본 matchMedia mock (setup.ts와 동일 형태) — change 핸들러를 붙잡아 OS 테마 변경을 흉내 낸다. */
function stubMatchMedia(matches: boolean): {
  captureChangeHandler: () => ((e: MediaQueryListEvent) => void) | undefined;
} {
  let changeHandler: ((e: MediaQueryListEvent) => void) | undefined;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  return { captureChangeHandler: () => changeHandler };
}

/** data-diagram 속성 값으로 넣기 위한 최소 이스케이프(mermaidPlugin.ts와 같은 방식의 &·"·<·> 치환). */
function attr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function container(source: string): string {
  return `<div class="mermaid-container" data-diagram="${attr(source)}"></div>`;
}

const VALID = 'flowchart LR\n  A[시작] --> B[끝]';
const VALID_2 = 'flowchart TD\n  X --> Y\n  Y --> Z';
const WITH_POSITION = 'sequenceDiagram\n  A->>B hello';
const NO_POSITION_SEMANTIC = 'pie\n  "a" : -1';
const NO_POSITION_UNSUPPORTED = 'notarealdiagramtype foo!!!';
const ERROR_CLASS = 'text-sm text-amber-500 italic py-2';

beforeEach(() => {
  peleMock.mockClear();
  useUIStore.setState({ theme: 'light' });
  stubMatchMedia(false);
});

describe('PreviewRenderer: 기본 렌더', () => {
  it('renders html content via dangerouslySetInnerHTML', () => {
    render(<PreviewRenderer html="<p>Hello World</p>" />);
    expect(document.querySelector('p')?.textContent).toBe('Hello World');
  });

  it('renders empty string without crashing', () => {
    const { container: c } = render(<PreviewRenderer html="" />);
    expect(c).toBeDefined();
  });

  it('renders headings from html prop', () => {
    render(<PreviewRenderer html="<h1>Title</h1>" />);
    expect(document.querySelector('h1')?.textContent).toBe('Title');
  });

  it('renders code blocks from html prop', () => {
    render(<PreviewRenderer html="<pre><code>const x = 1;</code></pre>" />);
    expect(document.querySelector('code')?.textContent).toBe('const x = 1;');
  });

  it('has preview-content class on container', () => {
    const { container: c } = render(<PreviewRenderer html="<p>test</p>" />);
    expect((c.firstChild as HTMLElement).className).toContain('preview-content');
  });

  it('zoom prop이 2이면 .preview-content의 inline style.zoom이 "2"이다 (헤딩 포함 전체 스케일)', () => {
    const { container: c } = render(<PreviewRenderer html="<h1>x</h1>" zoom={2} />);
    expect((c.firstChild as HTMLElement).style.zoom).toBe('2');
  });
});

// ---- SPEC-PREVIEW-008 REQ-PREVIEW008-006: 인라인 SVG 마커 sanitize + 복원 ----
describe('PreviewRenderer: 인라인 SVG 마커 (SPEC-PREVIEW-008)', () => {
  it('data-mdedit-svg 마커를 sanitize된 <svg>로 복원해 DOM에 렌더한다', () => {
    const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4" /></svg>';
    const html = `<p>before</p><div data-mdedit-svg="${encodeURIComponent(rawSvg)}"></div><p>after</p>`;
    const { container: c } = render(<PreviewRenderer html={html} />);
    expect(c.querySelector('svg')).not.toBeNull();
    expect(c.querySelector('circle')).not.toBeNull();
    expect(c.querySelector('[data-mdedit-svg]')).toBeNull();
  });

  it('악성 마커(<script>, onload)는 sanitize되어 스크립트가 DOM에 남지 않는다', () => {
    const evilSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__prevRendererXss = true"><script>window.__prevRendererXss = true;</script><rect width="1" height="1" /></svg>';
    const html = `<div data-mdedit-svg="${encodeURIComponent(evilSvg)}"></div>`;
    (window as unknown as Record<string, unknown>).__prevRendererXss = undefined;
    const { container: c } = render(<PreviewRenderer html={html} />);
    expect(c.querySelector('script')).toBeNull();
    expect(c.innerHTML).not.toContain('onload');
    expect(c.querySelector('rect')).not.toBeNull();
    expect((window as unknown as Record<string, unknown>).__prevRendererXss).toBeUndefined();
  });

  it('마커가 없는 일반 html은 변화 없이 그대로 렌더된다 (회귀 차단)', () => {
    const { container: c } = render(<PreviewRenderer html="<p>plain text</p>" />);
    expect(c.querySelector('p')?.textContent).toBe('plain text');
  });
});

// ---- SPEC-PREVIEW-015: 다이어그램 모듈 렌더 ----
describe('PreviewRenderer: 다이어그램 모듈 렌더 (SPEC-PREVIEW-015)', () => {
  it('유효한 펜스는 모듈을 거친 pele 렌더 결과 SVG로 동기 교체된다 (고정 옵션)', () => {
    const { container: c } = render(<PreviewRenderer html={container(VALID)} />);
    // 비동기 대기 없이 effect 직후에 SVG가 있어야 한다(동기 렌더).
    const svg = c.querySelector('.mermaid-container svg');
    expect(svg).not.toBeNull();
    expect(peleMock).toHaveBeenCalledTimes(1);
    const [source, options] = peleMock.mock.calls[0];
    expect(source).toBe(VALID);
    expect(options).toMatchObject(PELE_RENDER_OPTIONS);
  });

  it('AC-PREVIEW015-007 (a) 위치가 있는 오류는 모듈이 받은 line·column으로 "(L행 C열)" 접미사를 단다', () => {
    const expected = renderDiagram(WITH_POSITION);
    expect(expected.ok).toBe(false);
    if (expected.ok) return;
    expect(expected.error.line).toBeGreaterThanOrEqual(1);
    expect(expected.error.column).toBeGreaterThanOrEqual(1);

    const { container: c } = render(<PreviewRenderer html={container(WITH_POSITION)} />);
    const p = c.querySelector('.mermaid-container p');
    expect(p?.className).toBe(ERROR_CLASS);
    expect(p?.textContent).toBe(
      `⚠ Diagram syntax error (${expected.error.line}행 ${expected.error.column}열)`,
    );
    expect(p?.textContent).toBe(formatDiagramError(expected.error));
  });

  it.each([
    ['semantic', NO_POSITION_SEMANTIC],
    ['unsupported-diagram', NO_POSITION_UNSUPPORTED],
  ])('AC-PREVIEW015-007 (b) 위치가 없는 오류(%s)는 접미사 없는 문구다', (_code, source) => {
    const expected = renderDiagram(source);
    expect(expected.ok).toBe(false);
    if (!expected.ok) {
      expect(expected.error.line).toBe(0);
      expect(expected.error.column).toBe(0);
    }
    const { container: c } = render(<PreviewRenderer html={container(source)} />);
    const p = c.querySelector('.mermaid-container p');
    expect(p?.className).toBe(ERROR_CLASS);
    expect(p?.textContent).toBe('⚠ Diagram syntax error');
  });

  it('AC-PREVIEW015-006 거부된 소스의 HTML 라벨은 오류 문구에 요소로 들어가지 않는다', () => {
    const evil = 'sequenceDiagram\n  A->>B <img src=x onerror=alert(1)>';
    expect(renderDiagram(evil).ok).toBe(false);
    const { container: c } = render(<PreviewRenderer html={container(evil)} />);
    const el = c.querySelector('.mermaid-container')!;
    expect(el.querySelector('img')).toBeNull();
    const p = el.querySelector('p')!;
    expect(p.textContent).toContain('Diagram syntax error');
    expect(Array.from(p.childNodes).every((n) => n.nodeType === Node.TEXT_NODE)).toBe(true);
  });

  it('AC-PREVIEW015-008 유효·거부·유효 순서에서 실패가 다른 다이어그램을 막지 않는다', () => {
    const html = container(VALID) + container(NO_POSITION_UNSUPPORTED) + container(VALID_2);
    let c!: HTMLElement;
    expect(() => {
      c = render(<PreviewRenderer html={html} />).container;
    }).not.toThrow();
    const els = c.querySelectorAll('.mermaid-container');
    expect(els).toHaveLength(3);
    expect(els[0].querySelector('svg')).not.toBeNull();
    expect(els[1].querySelector('svg')).toBeNull();
    expect(els[1].querySelector('p')?.textContent).toContain('Diagram syntax error');
    expect(els[2].querySelector('svg')).not.toBeNull();
  });

  it('AC-PREVIEW015-009 빈 펜스는 안내만 표시하고 pele를 부르지 않는다', () => {
    const { container: c } = render(<PreviewRenderer html={'<div class="mermaid-container" data-diagram=""></div>'} />);
    const el = c.querySelector('.mermaid-container')!;
    expect(el.innerHTML).toBe('<p class="md-diagram-placeholder">다이어그램 문법을 입력하세요</p>');
    expect(el.textContent).not.toContain('Diagram syntax error');
    expect(peleMock).not.toHaveBeenCalled();
  });

  it('AC-PREVIEW015-009 공백만 있는 펜스도 안내만 표시하고 pele를 부르지 않는다', () => {
    const { container: c } = render(
      <PreviewRenderer html={'<div class="mermaid-container" data-diagram="   \n  "></div>'} />,
    );
    expect(c.querySelector('.md-diagram-placeholder')?.textContent).toBe('다이어그램 문법을 입력하세요');
    expect(peleMock).not.toHaveBeenCalled();
  });

  it('AC-PREVIEW015-010 pele 입력은 data-diagram 값과 같고, 다시 렌더하면 최신 내용만 보이며 id가 겹치지 않는다', () => {
    const entity = 'flowchart LR\n  A["a &amp; b &lt;c&gt;"] --> B["따옴표 &quot;q&quot;"]';
    const html = container(entity) + container(VALID) + container(VALID_2);
    const { container: c, rerender } = render(<PreviewRenderer html={html} />);

    const els = Array.from(c.querySelectorAll('.mermaid-container'));
    expect(peleMock).toHaveBeenCalledTimes(3);
    els.forEach((el, i) => {
      expect(peleMock.mock.calls[i][0]).toBe(el.getAttribute('data-diagram'));
    });

    // 렌더마다 다른 idPrefix가 넘어가고, 문서 안 SVG id에 중복이 없다.
    // (이 샘플들의 pele 출력에는 id가 없을 수 있다 — 캡처 픽스처 unit/ 전체에서 id 속성 0건. 그래서 접두사 고유성을 함께 본다.)
    const prefixes = peleMock.mock.calls.map(([, o]) => o?.idPrefix);
    expect(prefixes.every((p) => typeof p === 'string' && p.length > 0)).toBe(true);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    const ids = Array.from(c.querySelectorAll('svg [id], svg[id]')).map((n) => n.getAttribute('id'));
    expect(new Set(ids).size).toBe(ids.length);

    const NEXT = 'flowchart LR\n  NEWNODE[바뀐 내용] --> Q';
    rerender(<PreviewRenderer html={container(NEXT)} />);
    const after = c.querySelectorAll('.mermaid-container');
    expect(after).toHaveLength(1);
    expect(after[0].querySelector('svg')).not.toBeNull();
    expect(c.textContent).toContain('바뀐 내용');
    expect(c.textContent).not.toContain('시작');
  });
});

// ---- SPEC-PREVIEW-015 AC-011: 테마 전환은 SVG를 다시 만들지 않는다 (SPEC-PREVIEW-010 재렌더 경로 대체) ----
describe('PreviewRenderer: 테마 전환 시 재렌더 없음 (SPEC-PREVIEW-015 AC-011)', () => {
  it('라이트→다크→라이트 토글에도 SVG 노드가 같은 객체이고 pele 추가 호출이 0회다', () => {
    const { container: c } = render(<PreviewRenderer html={container(VALID)} />);
    const svg = c.querySelector('.mermaid-container svg');
    expect(svg).not.toBeNull();
    const callsBefore = peleMock.mock.calls.length;

    act(() => {
      useUIStore.setState({ theme: 'dark' });
    });
    act(() => {
      useUIStore.setState({ theme: 'light' });
    });

    expect(c.querySelector('.mermaid-container svg')).toBe(svg);
    expect(svg!.isConnected).toBe(true);
    expect(peleMock.mock.calls.length).toBe(callsBefore);
  });

  it('system 모드에서 OS 색 구성이 바뀌어도 SVG 노드가 유지되고 pele 추가 호출이 0회다', () => {
    useUIStore.setState({ theme: 'system' });
    const { captureChangeHandler } = stubMatchMedia(true);
    const { container: c } = render(<PreviewRenderer html={container(VALID)} />);
    const svg = c.querySelector('.mermaid-container svg');
    expect(svg).not.toBeNull();
    const callsBefore = peleMock.mock.calls.length;

    act(() => {
      captureChangeHandler()?.({ matches: false } as MediaQueryListEvent);
      useUIStore.setState({ theme: 'dark' });
    });

    expect(c.querySelector('.mermaid-container svg')).toBe(svg);
    expect(peleMock.mock.calls.length).toBe(callsBefore);
  });

  it('오류 다이어그램의 문구와 인라인 svg도 테마 토글 후 그대로 유지된다', () => {
    const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4" /></svg>';
    const html =
      `<div data-mdedit-svg="${encodeURIComponent(rawSvg)}"></div>` +
      container(VALID) +
      container(NO_POSITION_UNSUPPORTED);
    const { container: c } = render(<PreviewRenderer html={html} />);
    const diagramSvg = c.querySelector('.mermaid-container svg');
    const errorP = c.querySelectorAll('.mermaid-container')[1].querySelector('p');
    expect(c.querySelector('svg circle')).not.toBeNull();
    const callsBefore = peleMock.mock.calls.length;

    act(() => {
      useUIStore.setState({ theme: 'dark' });
    });

    expect(c.querySelector('svg circle')).not.toBeNull();
    expect(c.querySelector('.mermaid-container svg')).toBe(diagramSvg);
    expect(c.querySelectorAll('.mermaid-container')[1].querySelector('p')).toBe(errorP);
    expect(peleMock.mock.calls.length).toBe(callsBefore);
  });
});
