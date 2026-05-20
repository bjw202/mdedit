import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewModeToggle } from '@/components/layout/ViewModeToggle';
import { useUIStore } from '@/store/uiStore';

describe('ViewModeToggle (SPEC-UI-004)', () => {
  beforeEach(() => {
    useUIStore.setState({ viewMode: 'split' });
  });

  it('renders three buttons: 편집, 분할, 미리보기', () => {
    render(<ViewModeToggle />);
    expect(screen.getByLabelText('편집 모드')).toBeInTheDocument();
    expect(screen.getByLabelText('분할 모드')).toBeInTheDocument();
    expect(screen.getByLabelText('미리보기 모드')).toBeInTheDocument();
  });

  it('clicking 편집 button sets viewMode to "editor"', () => {
    render(<ViewModeToggle />);
    fireEvent.click(screen.getByLabelText('편집 모드'));
    expect(useUIStore.getState().viewMode).toBe('editor');
  });

  it('clicking 분할 button sets viewMode to "split"', () => {
    useUIStore.setState({ viewMode: 'editor' });
    render(<ViewModeToggle />);
    fireEvent.click(screen.getByLabelText('분할 모드'));
    expect(useUIStore.getState().viewMode).toBe('split');
  });

  it('clicking 미리보기 button sets viewMode to "preview"', () => {
    render(<ViewModeToggle />);
    fireEvent.click(screen.getByLabelText('미리보기 모드'));
    expect(useUIStore.getState().viewMode).toBe('preview');
  });

  it('active button shows aria-pressed=true for current viewMode (split)', () => {
    useUIStore.setState({ viewMode: 'split' });
    render(<ViewModeToggle />);
    expect(screen.getByLabelText('분할 모드')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('편집 모드')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('미리보기 모드')).toHaveAttribute('aria-pressed', 'false');
  });

  it('active button shows aria-pressed=true for viewMode "editor"', () => {
    useUIStore.setState({ viewMode: 'editor' });
    render(<ViewModeToggle />);
    expect(screen.getByLabelText('편집 모드')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('분할 모드')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('미리보기 모드')).toHaveAttribute('aria-pressed', 'false');
  });

  it('active highlight follows original viewMode, not effectiveViewMode', () => {
    // viewMode가 'editor'이면 .html 파일에서는 effectiveViewMode가 'preview'이지만
    // 토글의 활성 표시는 원래 viewMode 기준이어야 한다(확정 결정 2).
    useUIStore.setState({ viewMode: 'editor' });
    render(<ViewModeToggle />);
    // 편집 버튼이 active여야 하고, 미리보기 버튼은 active가 아니어야 한다.
    expect(screen.getByLabelText('편집 모드')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('미리보기 모드')).toHaveAttribute('aria-pressed', 'false');
  });
});
