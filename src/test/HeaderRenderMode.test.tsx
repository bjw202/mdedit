// Header '원본 보기' 토글 단위 테스트 — SPEC-PREVIEW-019 (AC-009)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Header } from '@/components/layout/Header';
import { useUIStore } from '@/store/uiStore';
import { useFileStore } from '@/store/fileStore';
import { detectPlatform } from '@/lib/preview/htmlZoom';

// detectPlatform만 모의한다. 기본 반환은 빈 문자열: 값을 정하지 않은 vi.fn()은 undefined를 돌려줘
// 우연히 'crisp'으로 해소되므로 모의가 빠진 테스트를 숨긴다. 각 테스트가 플랫폼을 명시한다.
vi.mock('@/lib/preview/htmlZoom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/preview/htmlZoom')>()),
  detectPlatform: vi.fn().mockReturnValue(''),
}));
const mockPlatform = (p: string): void => {
  vi.mocked(detectPlatform).mockReturnValue(p);
};

describe('Header 원본 보기 토글 (SPEC-PREVIEW-019, 020)', () => {
  beforeEach(() => {
    mockPlatform('MacIntel');
    useUIStore.setState({ htmlRenderMode: null, htmlZoom: 100, fontSize: 14 });
    useFileStore.setState({ currentFile: '/tmp/page.html', previewStatus: null });
  });

  afterEach(() => {
    act(() => {
      useFileStore.setState({ currentFile: null, previewStatus: null });
    });
  });

  it('html 파일이면 배율 컨트롤과 함께 Original view 토글을 보인다', () => {
    render(<Header />);
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
    expect(screen.getByLabelText('Reset zoom to 100%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Original view' })).toBeInTheDocument();
  });

  it('macOS 미선택이면 aria-pressed="false", original이면 "true"다', () => {
    render(<Header />);
    const toggle = screen.getByRole('button', { name: 'Original view' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    act(() => useUIStore.getState().setHtmlRenderMode('original'));
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('title에 한계 안내(스크립트·외부·원본 보기)가 있다', () => {
    render(<Header />);
    const title = screen.getByRole('button', { name: 'Original view' }).getAttribute('title') ?? '';
    expect(title).toContain('스크립트');
    expect(title).toContain('외부');
    expect(title).toContain('원본 보기');
  });

  it('누르면 crisp ↔ original이 바뀐다', () => {
    render(<Header />);
    const toggle = screen.getByRole('button', { name: 'Original view' });
    fireEvent.click(toggle);
    expect(useUIStore.getState().htmlRenderMode).toBe('original');
    fireEvent.click(toggle);
    expect(useUIStore.getState().htmlRenderMode).toBe('crisp');
  });

  it('Windows 미선택(null)이면 눌린 상태(is-active)이고, 누르면 crisp이 저장된다 (AC-006)', () => {
    mockPlatform('Win32');
    render(<Header />);
    const toggle = screen.getByRole('button', { name: 'Original view' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle.className).toContain('is-active');
    fireEvent.click(toggle);
    expect(useUIStore.getState().htmlRenderMode).toBe('crisp');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle.className).not.toContain('is-active');
  });

  it('macOS 미선택(null)에서 누르면 original이 저장되고 눌린 상태가 된다 (AC-006)', () => {
    render(<Header />);
    const toggle = screen.getByRole('button', { name: 'Original view' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(useUIStore.getState().htmlRenderMode).toBe('original');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    ['Win32', 'crisp', 'false'],
    ['MacIntel', 'original', 'true'],
  ] as const)('명시 선택이 플랫폼보다 우선한다: %s + %s -> aria-pressed %s', (platform, stored, pressed) => {
    mockPlatform(platform);
    useUIStore.setState({ htmlRenderMode: stored });
    render(<Header />);
    expect(screen.getByRole('button', { name: 'Original view' })).toHaveAttribute('aria-pressed', pressed);
  });

  it('title이 Windows에서는 원본 기본 문구, 비Windows에서는 선명 기본 문구다 (REQ-008)', () => {
    const titleOf = (): string =>
      screen.getByRole('button', { name: 'Original view' }).getAttribute('title') ?? '';
    mockPlatform('Win32');
    const { unmount } = render(<Header />);
    expect(titleOf()).toContain('이 기기의 기본은 원본 보기입니다');
    expect(titleOf()).not.toContain('흐릿');
    expect(titleOf()).not.toContain('선명 모드(기본)');
    unmount();
    for (const p of ['MacIntel', 'Linux x86_64']) {
      mockPlatform(p);
      const r = render(<Header />);
      expect(titleOf()).toContain('이 기기의 기본은 선명 모드입니다');
      expect(titleOf()).toContain('원본 보기에서는 100% 초과 확대가 흐릿합니다');
      r.unmount();
    }
  });

  it('같은 플랫폼에서는 저장값(null·crisp·original)이 달라도 title이 같다 (REQ-008)', () => {
    for (const p of ['Win32', 'MacIntel']) {
      mockPlatform(p);
      const titles = [null, 'crisp', 'original'].map((v) => {
        useUIStore.setState({ htmlRenderMode: v as never });
        const r = render(<Header />);
        const t = screen.getByRole('button', { name: 'Original view' }).getAttribute('title');
        r.unmount();
        return t;
      });
      expect(new Set(titles).size).toBe(1);
    }
  });

  it.each(['/tmp/note.md', '/tmp/a.ts', '/tmp/a.txt'])(
    '%s이면 토글이 없고 기존 A-/A+가 그대로다',
    (path) => {
      useFileStore.setState({ currentFile: path });
      render(<Header />);
      expect(screen.queryByRole('button', { name: 'Original view' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Decrease font size')).toBeInTheDocument();
      expect(screen.getByLabelText('Increase font size')).toBeInTheDocument();
    },
  );
});
