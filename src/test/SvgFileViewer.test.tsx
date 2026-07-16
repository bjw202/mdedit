// SvgFileViewer 단위 테스트 — SPEC-PREVIEW-008 REQ-PREVIEW008-004/005 (시나리오 D, E, F must-pass)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFileStore } from '@/store/fileStore';
import { useEditorStore } from '@/store/editorStore';

// CodeFileViewer mock — Shiki 초기화를 회피하고 렌더 여부만 검증
vi.mock('@/components/preview/CodeFileViewer', () => ({
  CodeFileViewer: vi.fn(({ lang }: { lang: string }) => (
    <div data-testid="code-file-viewer" data-lang={lang} />
  )),
}));

const NORMAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>';
const EVIL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__xssFlag = true"><script>window.__xssFlag = true;</script><rect width="1" height="1" /></svg>';

const mockTree = [
  { name: 'icon.svg', path: '/project/icon.svg', isDirectory: false, size: 512 },
  { name: 'big.svg', path: '/project/big.svg', isDirectory: false, size: 6 * 1024 * 1024 },
];

describe('SvgFileViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFileStore.setState({ fileTree: mockTree });
    useEditorStore.setState({ content: NORMAL_SVG });
  });

  it('기본은 렌더 뷰이며 CodeFileViewer(소스)를 렌더링하지 않는다 (시나리오 D, must-pass)', async () => {
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/icon.svg" />);
    expect(screen.getByTestId('svg-render-canvas')).toBeDefined();
    expect(screen.queryByTestId('code-file-viewer')).toBeNull();
  });

  it('렌더 뷰에 sanitize된 svg 도형이 삽입된다', async () => {
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/icon.svg" />);
    const content = screen.getByTestId('svg-render-content');
    expect(content.innerHTML).toContain('<circle');
  });

  it('소스 토글을 클릭하면 CodeFileViewer(lang=xml)로 전환된다 (시나리오 D)', async () => {
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/icon.svg" />);
    fireEvent.click(screen.getByTestId('svg-view-source'));
    const codeViewer = screen.getByTestId('code-file-viewer');
    expect(codeViewer.getAttribute('data-lang')).toBe('xml');
    expect(screen.queryByTestId('svg-render-canvas')).toBeNull();
  });

  it('다시 렌더 토글을 클릭하면 렌더 뷰로 복귀한다', async () => {
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/icon.svg" />);
    fireEvent.click(screen.getByTestId('svg-view-source'));
    fireEvent.click(screen.getByTestId('svg-view-render'));
    expect(screen.getByTestId('svg-render-canvas')).toBeDefined();
  });

  it('렌더 뷰에 fit/100%/줌 컨트롤이 있다', async () => {
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/icon.svg" />);
    expect(screen.getByTestId('svg-zoom-fit')).toBeDefined();
    expect(screen.getByTestId('svg-zoom-100')).toBeDefined();
    expect(screen.getByTestId('svg-zoom-in')).toBeDefined();
    expect(screen.getByTestId('svg-zoom-out')).toBeDefined();
  });

  it('줌인 클릭 시 scale이 증가한다 (시나리오 E)', async () => {
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/icon.svg" />);
    fireEvent.click(screen.getByTestId('svg-zoom-in'));
    const content = screen.getByTestId('svg-render-content');
    expect(Number(content.getAttribute('data-scale'))).toBeGreaterThan(1);
  });

  it('custom 모드에서 드래그하면 렌더 콘텐츠가 팬 이동한다 (시나리오 E)', async () => {
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/icon.svg" />);
    fireEvent.click(screen.getByTestId('svg-zoom-100'));
    const canvas = screen.getByTestId('svg-render-canvas');
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(canvas, { clientX: 10, clientY: 8 });
    fireEvent.mouseUp(canvas);
    const content = screen.getByTestId('svg-render-content') as HTMLElement;
    expect(content.style.transform).toContain('translate(10px, 8px)');
  });

  it('big.svg(5MB 초과)는 소스 뷰에서 대용량 안내를 표시하고 CodeFileViewer를 렌더링하지 않는다 (시나리오 E, D3)', async () => {
    useEditorStore.setState({ content: NORMAL_SVG });
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/big.svg" />);
    fireEvent.click(screen.getByTestId('svg-view-source'));
    expect(screen.getByTestId('svg-source-too-large')).toBeDefined();
    expect(screen.queryByTestId('code-file-viewer')).toBeNull();
  });

  it('big.svg도 렌더 뷰는 계속 표시된다 (D3, 렌더 뷰는 임계값 미적용)', async () => {
    useEditorStore.setState({ content: NORMAL_SVG });
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/big.svg" />);
    expect(screen.getByTestId('svg-render-canvas')).toBeDefined();
  });

  // ---- 시나리오 F: 악성 SVG 스크립트 미실행 (must-pass, 보안) ----

  it('evil.svg의 <script>가 렌더 뷰 DOM에서 제거된다 (시나리오 F, must-pass)', async () => {
    useEditorStore.setState({ content: EVIL_SVG });
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/icon.svg" />);
    const content = screen.getByTestId('svg-render-content');
    expect(content.innerHTML).not.toContain('<script');
    expect(content.querySelector('script')).toBeNull();
  });

  it('evil.svg의 onload 속성이 제거되고 전역 부작용이 없다 (시나리오 F, must-pass)', async () => {
    (window as unknown as Record<string, unknown>).__xssFlag = undefined;
    useEditorStore.setState({ content: EVIL_SVG });
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/icon.svg" />);
    const content = screen.getByTestId('svg-render-content');
    expect(content.innerHTML).not.toContain('onload');
    expect((window as unknown as Record<string, unknown>).__xssFlag).toBeUndefined();
  });

  it('sanitize 후에도 위험하지 않은 도형(rect)은 유지된다', async () => {
    useEditorStore.setState({ content: EVIL_SVG });
    const { SvgFileViewer } = await import('@/components/preview/SvgFileViewer');
    render(<SvgFileViewer svgPath="/project/icon.svg" />);
    const content = screen.getByTestId('svg-render-content');
    expect(content.querySelector('rect')).not.toBeNull();
  });
});
