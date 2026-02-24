import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

describe('Footer', () => {
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
