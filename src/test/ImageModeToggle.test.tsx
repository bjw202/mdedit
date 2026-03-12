// @MX:SPEC: SPEC-IMG-MODE-001
// UT-5: Settings UI provides toggle between inline-blob and file-save modes (REQ-5)

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { ImageModeToggle } from '@/components/settings/ImageModeToggle';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('ImageModeToggle (REQ-5)', () => {
  it('renders toggle with label', () => {
    useUIStore.setState({ imageInsertMode: 'inline-blob' });
    render(<ImageModeToggle />);
    expect(screen.getByLabelText('Image insert mode')).toBeInTheDocument();
  });

  it('shows "Inline" option as selected by default', () => {
    useUIStore.setState({ imageInsertMode: 'inline-blob' });
    render(<ImageModeToggle />);
    const select = screen.getByLabelText('Image insert mode') as HTMLSelectElement;
    expect(select.value).toBe('inline-blob');
  });

  it('shows "File" option when mode is file-save', () => {
    useUIStore.setState({ imageInsertMode: 'file-save' });
    render(<ImageModeToggle />);
    const select = screen.getByLabelText('Image insert mode') as HTMLSelectElement;
    expect(select.value).toBe('file-save');
  });

  it('calls setImageInsertMode when selection changes to file-save', () => {
    useUIStore.setState({ imageInsertMode: 'inline-blob' });
    render(<ImageModeToggle />);
    const select = screen.getByLabelText('Image insert mode');
    fireEvent.change(select, { target: { value: 'file-save' } });
    expect(useUIStore.getState().imageInsertMode).toBe('file-save');
  });

  it('calls setImageInsertMode when selection changes to inline-blob', () => {
    useUIStore.setState({ imageInsertMode: 'file-save' });
    render(<ImageModeToggle />);
    const select = screen.getByLabelText('Image insert mode');
    fireEvent.change(select, { target: { value: 'inline-blob' } });
    expect(useUIStore.getState().imageInsertMode).toBe('inline-blob');
  });
});
