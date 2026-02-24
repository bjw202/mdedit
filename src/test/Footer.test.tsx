import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

describe('Footer', () => {
  afterEach(() => cleanup());

  it('shows line count', () => {
    render(<Footer lineCount={42} />);
    expect(screen.getByText('Lines: 42')).toBeInTheDocument();
  });

  it('shows cursor position', () => {
    render(<Footer cursorLine={5} cursorCol={10} />);
    expect(screen.getByText('Ln 5, Col 10')).toBeInTheDocument();
  });

  it('shows encoding', () => {
    render(<Footer encoding="UTF-8" />);
    expect(screen.getByText('UTF-8')).toBeInTheDocument();
  });

  it('shows default values when no props', () => {
    render(<Footer />);
    expect(screen.getByText('Lines: 0')).toBeInTheDocument();
    expect(screen.getByText('Ln 1, Col 1')).toBeInTheDocument();
    expect(screen.getByText('UTF-8')).toBeInTheDocument();
  });
});

describe('Footer: saveStatus', () => {
  afterEach(() => cleanup());

  it('shows "New" when saveStatus is "new"', () => {
    render(<Footer saveStatus="new" />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows "Saved" when saveStatus is "saved"', () => {
    render(<Footer saveStatus="saved" />);
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('shows "Unsaved" when saveStatus is "unsaved"', () => {
    render(<Footer saveStatus="unsaved" />);
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
  });

  it('shows "Saving..." when saveStatus is "saving"', () => {
    render(<Footer saveStatus="saving" />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });
});

describe('Footer: word and char count', () => {
  afterEach(() => cleanup());

  it('shows word count', () => {
    render(<Footer wordCount={42} />);
    expect(screen.getByText(/42 words/i)).toBeInTheDocument();
  });

  it('shows char count', () => {
    render(<Footer charCount={200} />);
    expect(screen.getByText(/200 chars/i)).toBeInTheDocument();
  });

  it('shows zero counts by default', () => {
    render(<Footer />);
    expect(screen.getByText(/0 words/i)).toBeInTheDocument();
    expect(screen.getByText(/0 chars/i)).toBeInTheDocument();
  });
});

describe('Footer: scroll sync toggle', () => {
  afterEach(() => cleanup());

  it('shows scroll sync toggle button', () => {
    render(<Footer scrollSyncEnabled={true} onScrollSyncToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /scroll sync/i })).toBeInTheDocument();
  });

  it('calls onScrollSyncToggle when button is clicked', () => {
    const mockToggle = vi.fn();
    render(<Footer scrollSyncEnabled={true} onScrollSyncToggle={mockToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /scroll sync/i }));
    expect(mockToggle).toHaveBeenCalledOnce();
  });

  it('shows enabled state when scrollSyncEnabled is true', () => {
    render(<Footer scrollSyncEnabled={true} onScrollSyncToggle={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /scroll sync/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows disabled state when scrollSyncEnabled is false', () => {
    render(<Footer scrollSyncEnabled={false} onScrollSyncToggle={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /scroll sync/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});
