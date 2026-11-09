// Header '원본 보기' 토글 단위 테스트 — SPEC-PREVIEW-019 (AC-009)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Header } from '@/components/layout/Header';
import { useUIStore } from '@/store/uiStore';
import { useFileStore } from '@/store/fileStore';

describe('Header 원본 보기 토글 (SPEC-PREVIEW-019)', () => {
  beforeEach(() => {
    useUIStore.setState({ htmlRenderMode: 'crisp', htmlZoom: 100, fontSize: 14 });
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

  it('crisp이면 aria-pressed="false", original이면 "true"다', () => {
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
