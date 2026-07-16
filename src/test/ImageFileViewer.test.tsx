// ImageFileViewer 단위 테스트 — SPEC-PREVIEW-008 REQ-PREVIEW008-002/003 (시나리오 B, C)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFileStore } from '@/store/fileStore';
import { useUIStore } from '@/store/uiStore';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
  invoke: vi.fn(),
}));

const mockTree = [
  { name: 'logo.png', path: '/project/logo.png', isDirectory: false, size: 2 * 1024 * 1024 },
  { name: 'big.png', path: '/project/big.png', isDirectory: false, size: 6 * 1024 * 1024 },
];

describe('ImageFileViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFileStore.setState({ fileTree: mockTree });
    useUIStore.setState({ theme: 'light' });
  });

  it('convertFileSrc(asset://)로 변환된 src를 가진 img를 렌더링한다 (base64 아님, D2)', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    const img = screen.getByTestId('image-file-viewer-img') as HTMLImageElement;
    expect(img.src).toContain('asset://localhost/');
    expect(img.src).not.toContain('data:');
  });

  it('fit/100%/줌인/줌아웃 컨트롤이 렌더링된다', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    expect(screen.getByTestId('image-zoom-fit')).toBeDefined();
    expect(screen.getByTestId('image-zoom-100')).toBeDefined();
    expect(screen.getByTestId('image-zoom-in')).toBeDefined();
    expect(screen.getByTestId('image-zoom-out')).toBeDefined();
  });

  it('초기 모드는 fit이다', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    const img = screen.getByTestId('image-file-viewer-img');
    expect(img.getAttribute('data-zoom-mode')).toBe('fit');
  });

  it('100% 버튼을 클릭하면 scale이 1인 custom 모드로 전환된다', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    fireEvent.click(screen.getByTestId('image-zoom-100'));
    const img = screen.getByTestId('image-file-viewer-img');
    expect(img.getAttribute('data-zoom-mode')).toBe('custom');
    expect(img.getAttribute('data-scale')).toBe('1');
  });

  it('줌인 버튼을 클릭하면 scale이 증가한다', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    fireEvent.click(screen.getByTestId('image-zoom-in'));
    const img = screen.getByTestId('image-file-viewer-img');
    expect(Number(img.getAttribute('data-scale'))).toBeGreaterThan(1);
  });

  it('줌아웃 버튼을 클릭하면 scale이 감소한다', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    fireEvent.click(screen.getByTestId('image-zoom-out'));
    const img = screen.getByTestId('image-file-viewer-img');
    expect(Number(img.getAttribute('data-scale'))).toBeLessThan(1);
  });

  it('Fit 버튼을 클릭하면 fit 모드로 복귀한다', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    fireEvent.click(screen.getByTestId('image-zoom-in'));
    fireEvent.click(screen.getByTestId('image-zoom-fit'));
    const img = screen.getByTestId('image-file-viewer-img');
    expect(img.getAttribute('data-zoom-mode')).toBe('fit');
  });

  it('custom 모드에서 드래그하면 transform이 이동한다 (팬)', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    fireEvent.click(screen.getByTestId('image-zoom-100'));
    const canvas = screen.getByTestId('image-checkerboard');
    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 15 });
    fireEvent.mouseUp(canvas);
    const img = screen.getByTestId('image-file-viewer-img') as HTMLImageElement;
    expect(img.style.transform).toContain('translate(20px, 15px)');
  });

  it('FileNode.size로부터 파일 크기를 표시한다', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    expect(screen.getByTestId('image-meta').textContent).toContain('2.0 MB');
  });

  it('naturalWidth/Height 로드 후 픽셀 크기를 표시한다', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    const img = screen.getByTestId('image-file-viewer-img') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 128, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 128, configurable: true });
    fireEvent.load(img);
    expect(screen.getByTestId('image-meta').textContent).toContain('128×128');
  });

  it('5MB를 초과하는 big.png도 too-large 없이 렌더링된다 (시나리오 C, must-pass)', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/big.png" />);
    expect(screen.getByTestId('image-file-viewer-img')).toBeDefined();
    expect(screen.queryByText(/too-large/i)).toBeNull();
  });

  it('테마(dark)를 data-theme 속성으로 반영한다', async () => {
    useUIStore.setState({ theme: 'dark' });
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    expect(screen.getByTestId('image-file-viewer').getAttribute('data-theme')).toBe('dark');
  });

  // ---- 평가 결함 2(major): 실제 체커보드 배경 패턴이 적용되어야 한다 (REQ-PREVIEW008-002) ----
  it('체커보드 컨테이너에 실제 conic-gradient 체커보드 배경이 적용된다 (test-id만으로는 불충분)', async () => {
    const { ImageFileViewer } = await import('@/components/preview/ImageFileViewer');
    render(<ImageFileViewer imagePath="/project/logo.png" />);
    const canvas = screen.getByTestId('image-checkerboard') as HTMLElement;
    // 단순 존재 확인이 아니라 실제 배경 이미지 패턴(체커보드)이 인라인 스타일로 적용되어야 한다
    expect(canvas.style.backgroundImage).toMatch(/conic-gradient/);
    // 반복 타일 크기가 지정되어 있어야 체커보드 격자 패턴이 시각적으로 나타난다
    expect(canvas.style.backgroundSize).not.toBe('');
  });
});
