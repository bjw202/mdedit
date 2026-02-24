import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '@/components/layout/Header';
import { useUIStore } from '@/store/uiStore';

describe('Header', () => {
  it('renders filename', () => {
    render(<Header filename="test.md" isDirty={false} />);
    expect(screen.getByText('test.md')).toBeInTheDocument();
  });

  it('shows dirty indicator when file is unsaved', () => {
    render(<Header filename="test.md" isDirty={true} />);
    expect(screen.getByText('●')).toBeInTheDocument();
  });

  it('shows Untitled when no filename', () => {
    render(<Header />);
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('shows MdEdit brand name', () => {
    render(<Header />);
    expect(screen.getByText('MdEdit')).toBeInTheDocument();
  });

  it('decreases font size when A- button clicked', () => {
    useUIStore.setState({ fontSize: 14 });
    render(<Header />);
    const decreaseBtn = screen.getByLabelText('Decrease font size');
    fireEvent.click(decreaseBtn);
    expect(useUIStore.getState().fontSize).toBe(13);
  });

  it('increases font size when A+ button clicked', () => {
    useUIStore.setState({ fontSize: 14 });
    render(<Header />);
    const increaseBtn = screen.getByLabelText('Increase font size');
    fireEvent.click(increaseBtn);
    expect(useUIStore.getState().fontSize).toBe(15);
  });

  it('shows theme toggle button', () => {
    render(<Header />);
    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
  });
});
