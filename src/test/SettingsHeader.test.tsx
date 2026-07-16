// @MX:SPEC: SPEC-AI-001 REQ-AI-011
// Header 톱니 버튼이 onOpenSettings 콜백을 호출하는지 검증(설정 모달 진입점).
// TDD RED phase: written before the gear button is added to Header.tsx.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(() => cleanup());

describe('Header: settings gear button', () => {
  it('renders a settings gear button', async () => {
    const { Header } = await import('@/components/layout/Header');
    render(<Header />);
    expect(screen.getByRole('button', { name: /settings|설정/i })).toBeInTheDocument();
  });

  it('calls onOpenSettings when the gear is clicked', async () => {
    const onOpenSettings = vi.fn();
    const { Header } = await import('@/components/layout/Header');
    render(<Header onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /settings|설정/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
