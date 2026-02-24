import { describe, it, expect, vi } from 'vitest';
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

  it('renders New, Save, Save As buttons', () => {
    render(<Header />);
    expect(screen.getByLabelText('New file')).toBeInTheDocument();
    expect(screen.getByLabelText('Save')).toBeInTheDocument();
    expect(screen.getByLabelText('Save as')).toBeInTheDocument();
  });

  it('calls onNew when New button clicked', () => {
    const onNew = vi.fn();
    render(<Header onNew={onNew} />);
    fireEvent.click(screen.getByLabelText('New file'));
    expect(onNew).toHaveBeenCalledOnce();
  });

  it('calls onSave when Save button clicked', () => {
    const onSave = vi.fn();
    render(<Header onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Save'));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('calls onSaveAs when Save As button clicked', () => {
    const onSaveAs = vi.fn();
    render(<Header onSaveAs={onSaveAs} />);
    fireEvent.click(screen.getByLabelText('Save as'));
    expect(onSaveAs).toHaveBeenCalledOnce();
  });
});
