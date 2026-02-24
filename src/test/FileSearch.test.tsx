import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileSearch } from '@/components/sidebar/FileSearch';

describe('FileSearch', () => {
  it('should render a search input', () => {
    render(<FileSearch value="" onChange={() => {}} />);
    const input = screen.getByRole('searchbox');
    expect(input).toBeInTheDocument();
  });

  it('should show placeholder text', () => {
    render(<FileSearch value="" onChange={() => {}} />);
    const input = screen.getByPlaceholderText(/search files/i);
    expect(input).toBeInTheDocument();
  });

  it('should display the current value', () => {
    render(<FileSearch value="hello" onChange={() => {}} />);
    const input = screen.getByRole('searchbox') as HTMLInputElement;
    expect(input.value).toBe('hello');
  });

  it('should call onChange with input value when user types', () => {
    const handleChange = vi.fn();
    render(<FileSearch value="" onChange={handleChange} />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'readme' } });
    expect(handleChange).toHaveBeenCalledWith('readme');
  });

  it('should clear value when clear button is clicked', () => {
    const handleChange = vi.fn();
    render(<FileSearch value="test" onChange={handleChange} />);
    const clearBtn = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearBtn);
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('should not show clear button when value is empty', () => {
    render(<FileSearch value="" onChange={() => {}} />);
    const clearBtn = screen.queryByRole('button', { name: /clear/i });
    expect(clearBtn).not.toBeInTheDocument();
  });

  it('should show clear button when value is non-empty', () => {
    render(<FileSearch value="abc" onChange={() => {}} />);
    const clearBtn = screen.getByRole('button', { name: /clear/i });
    expect(clearBtn).toBeInTheDocument();
  });
});
