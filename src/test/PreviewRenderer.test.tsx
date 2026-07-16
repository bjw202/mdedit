import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn().mockResolvedValue(true),
    render: vi.fn().mockResolvedValue({ svg: '<svg>mermaid-diagram</svg>' }),
  },
}));

/** jsdom 기본 matchMedia mock (setup.ts와 동일 형태) — SPEC-PREVIEW-010 테스트 전용 리셋 헬퍼 */
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

  // ---- SPEC-PREVIEW-008 REQ-PREVIEW008-006: 인라인 SVG 마커 sanitize + 복원 (시나리오 G, must-pass) ----

  it('data-mdedit-svg 마커를 sanitize된 <svg>로 복원해 DOM에 렌더한다', async () => {
    const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4" /></svg>';
    const html = `<p>before</p><div data-mdedit-svg="${encodeURIComponent(rawSvg)}"></div><p>after</p>`;
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const { container } = render(<PreviewRenderer html={html} />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('circle')).not.toBeNull();
    expect(container.querySelector('[data-mdedit-svg]')).toBeNull();
  });

  it('악성 마커(<script>, onload)는 sanitize되어 스크립트가 DOM에 남지 않는다 (시나리오 F/G, must-pass)', async () => {
    const evilSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__prevRendererXss = true"><script>window.__prevRendererXss = true;</script><rect width="1" height="1" /></svg>';
    const html = `<div data-mdedit-svg="${encodeURIComponent(evilSvg)}"></div>`;
    (window as unknown as Record<string, unknown>).__prevRendererXss = undefined;
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const { container } = render(<PreviewRenderer html={html} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('onload');
    expect(container.querySelector('rect')).not.toBeNull();
    expect((window as unknown as Record<string, unknown>).__prevRendererXss).toBeUndefined();
  });

  it('마커가 없는 일반 html은 변화 없이 그대로 렌더된다 (회귀 차단)', async () => {
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const { container } = render(<PreviewRenderer html="<p>plain text</p>" />);
    expect(container.querySelector('p')?.textContent).toBe('plain text');
  });
});

// ---- SPEC-PREVIEW-010: mermaid 다이어그램의 라이트/다크 테마 연동 ----
describe('PreviewRenderer: mermaid dark theme (SPEC-PREVIEW-010)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ theme: 'light' });
    stubMatchMedia(false);
  });

  it('다크 모드에서 마운트되면 mermaid.initialize가 theme: dark로 호출된다 (REQ-001, 시나리오A)', async () => {
    useUIStore.setState({ theme: 'dark' });
    const mermaidModule = await import('mermaid');
    const mockMermaid = mermaidModule.default;
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const diagram = 'graph TD\n  A --> B';
    const html = `<div class="mermaid-container" data-diagram="${diagram}"></div>`;

    render(<PreviewRenderer html={html} />);

    await vi.waitFor(() => {
      expect(mockMermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark' }),
      );
    });
  });

  it('라이트 모드에서 마운트되면 mermaid.initialize가 theme: default로 호출된다 (REQ-001, 시나리오A)', async () => {
    useUIStore.setState({ theme: 'light' });
    const mermaidModule = await import('mermaid');
    const mockMermaid = mermaidModule.default;
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const diagram = 'graph TD\n  A --> B';
    const html = `<div class="mermaid-container" data-diagram="${diagram}"></div>`;

    render(<PreviewRenderer html={html} />);

    await vi.waitFor(() => {
      expect(mockMermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'default' }),
      );
    });
  });

  it('라이트→다크 토글 시 safeHtml 불변 상태에서 mermaid가 재init+재render되어 재채색된다 (REQ-002, 시나리오B, must-pass)', async () => {
    useUIStore.setState({ theme: 'light' });
    const mermaidModule = await import('mermaid');
    const mockMermaid = mermaidModule.default;
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const diagram = 'graph TD\n  A --> B';
    const html = `<div class="mermaid-container" data-diagram="${diagram}"></div>`;

    render(<PreviewRenderer html={html} />);

    await vi.waitFor(() => {
      expect(mockMermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'default' }),
      );
    });
    const renderCallsBefore = (mockMermaid.render as ReturnType<typeof vi.fn>).mock.calls.length;

    // 테마만 토글한다 — html prop(=safeHtml)은 절대 변하지 않는다.
    act(() => {
      useUIStore.setState({ theme: 'dark' });
    });

    await vi.waitFor(() => {
      expect(mockMermaid.initialize).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: 'dark' }),
      );
      expect((mockMermaid.render as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        renderCallsBefore,
      );
    });

    // 다시 라이트로 토글하면 default 테마로 복귀 재렌더된다.
    const renderCallsAfterDark = (mockMermaid.render as ReturnType<typeof vi.fn>).mock.calls
      .length;
    act(() => {
      useUIStore.setState({ theme: 'light' });
    });

    await vi.waitFor(() => {
      expect(mockMermaid.initialize).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: 'default' }),
      );
      expect((mockMermaid.render as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        renderCallsAfterDark,
      );
    });
  });

  it('system 모드에서 OS가 다크를 선호하면 다크로 렌더되고, OS 변경 시 재렌더된다 (REQ-003, 시나리오C)', async () => {
    useUIStore.setState({ theme: 'system' });
    const { captureChangeHandler } = stubMatchMedia(true);

    const mermaidModule = await import('mermaid');
    const mockMermaid = mermaidModule.default;
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const diagram = 'graph TD\n  A --> B';
    const html = `<div class="mermaid-container" data-diagram="${diagram}"></div>`;

    render(<PreviewRenderer html={html} />);

    await vi.waitFor(() => {
      expect(mockMermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark' }),
      );
    });

    // OS 색 구성이 라이트로 변경되는 change 이벤트를 시뮬레이션한다.
    act(() => {
      captureChangeHandler()?.({ matches: false } as MediaQueryListEvent);
    });

    await vi.waitFor(() => {
      expect(mockMermaid.initialize).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: 'default' }),
      );
    });
  });

  it('모든 mermaid.initialize 호출은 securityLevel: strict와 startOnLoad: false를 유지한다 (REQ-004, 시나리오D, must-pass)', async () => {
    useUIStore.setState({ theme: 'light' });
    const mermaidModule = await import('mermaid');
    const mockMermaid = mermaidModule.default;
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const diagram = 'graph TD\n  A --> B';
    const html = `<div class="mermaid-container" data-diagram="${diagram}"></div>`;

    render(<PreviewRenderer html={html} />);

    await vi.waitFor(() => {
      expect(mockMermaid.initialize).toHaveBeenCalled();
    });

    // 재초기화를 유발하는 테마 토글을 여러 번 수행한다.
    act(() => {
      useUIStore.setState({ theme: 'dark' });
    });
    await vi.waitFor(() => {
      expect(
        (mockMermaid.initialize as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBeGreaterThanOrEqual(2);
    });
    act(() => {
      useUIStore.setState({ theme: 'light' });
    });
    await vi.waitFor(() => {
      expect(
        (mockMermaid.initialize as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBeGreaterThanOrEqual(3);
    });

    const calls = (mockMermaid.initialize as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const [config] of calls) {
      expect(config).toMatchObject({ securityLevel: 'strict', startOnLoad: false });
    }
  });

  it('오류 다이어그램은 폴백을 유지하고, 정상 다이어그램만 테마 토글 후 재채색된다 (REQ-005, 시나리오E)', async () => {
    useUIStore.setState({ theme: 'light' });
    const mermaidModule = await import('mermaid');
    const mockMermaid = mermaidModule.default;
    (mockMermaid.parse as ReturnType<typeof vi.fn>).mockImplementation((diagram: string) => {
      if (diagram === 'invalid diagram') {
        return Promise.reject(new Error('Syntax error in text'));
      }
      return Promise.resolve(true);
    });

    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const html =
      '<div class="mermaid-container" data-diagram="graph TD\n  A --> B"></div>' +
      '<div class="mermaid-container" data-diagram="invalid diagram"></div>';

    render(<PreviewRenderer html={html} />);

    await vi.waitFor(() => {
      const errorEl = document.querySelector('.mermaid-container p');
      expect(errorEl?.textContent).toContain('Diagram syntax error');
    });

    const renderCallsBefore = (mockMermaid.render as ReturnType<typeof vi.fn>).mock.calls.length;

    act(() => {
      useUIStore.setState({ theme: 'dark' });
    });

    await vi.waitFor(() => {
      // 정상 다이어그램은 재render되어 재채색된다.
      expect((mockMermaid.render as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        renderCallsBefore,
      );
      // 오류 다이어그램의 폴백 문구는 테마 토글 후에도 유지된다.
      const errorElAfter = document.querySelector('.mermaid-container p');
      expect(errorElAfter?.textContent).toContain('Diagram syntax error');
    });
  });

  it('mermaid + 인라인 svg 혼합 문서에서 테마 토글해도 인라인 svg는 회귀 없이 유지되고 mermaid만 재채색된다 (REQ-006, 시나리오F, must-pass)', async () => {
    useUIStore.setState({ theme: 'light' });
    const mermaidModule = await import('mermaid');
    const mockMermaid = mermaidModule.default;
    const { PreviewRenderer } = await import('@/components/preview/PreviewRenderer');
    const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4" /></svg>';
    const diagram = 'graph TD\n  A --> B';
    const html =
      `<div data-mdedit-svg="${encodeURIComponent(rawSvg)}"></div>` +
      `<div class="mermaid-container" data-diagram="${diagram}"></div>`;

    const { container } = render(<PreviewRenderer html={html} />);

    await vi.waitFor(() => {
      expect(mockMermaid.render).toHaveBeenCalled();
    });
    expect(container.querySelector('svg circle')).not.toBeNull();

    const renderCallsBefore = (mockMermaid.render as ReturnType<typeof vi.fn>).mock.calls.length;

    act(() => {
      useUIStore.setState({ theme: 'dark' });
    });

    await vi.waitFor(() => {
      expect((mockMermaid.render as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        renderCallsBefore,
      );
    });
    // 인라인 svg는 mermaid 재렌더와 무관하게 그대로 유지된다 (SPEC-PREVIEW-008 회귀 없음).
    expect(container.querySelector('svg circle')).not.toBeNull();
  });
});
