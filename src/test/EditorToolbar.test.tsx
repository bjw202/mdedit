import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

/**
 * SPEC-EDITOR-001: EditorToolbar component specification tests
 *
 * Verifies that the EditorToolbar renders all required format buttons
 * and that clicking each button triggers the corresponding formatting command.
 */

// Mock Tauri IPC (EditorToolbar may indirectly reference it)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('EditorToolbar: Rendering', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render without errors', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    expect(() => render(<EditorToolbar />)).not.toThrow();
  });

  it('should render the Bold button', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
  });

  it('should render the Italic button', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
  });

  it('should render H1 button', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    expect(screen.getByRole('button', { name: /h1/i })).toBeInTheDocument();
  });

  it('should render H2 button', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    expect(screen.getByRole('button', { name: /h2/i })).toBeInTheDocument();
  });

  it('should render H3 button', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    expect(screen.getByRole('button', { name: /h3/i })).toBeInTheDocument();
  });

  it('should render Unordered List (UL) button', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    expect(screen.getByRole('button', { name: 'Unordered List' })).toBeInTheDocument();
  });

  it('should render Ordered List (OL) button', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    expect(screen.getByRole('button', { name: 'Ordered List' })).toBeInTheDocument();
  });

  it('should render Code button', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    expect(screen.getByRole('button', { name: /code/i })).toBeInTheDocument();
  });

  it('should render Link button', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    expect(screen.getByRole('button', { name: /link/i })).toBeInTheDocument();
  });

  it('should render Quote button', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    expect(screen.getByRole('button', { name: /quote|blockquote/i })).toBeInTheDocument();
  });
});

describe('EditorToolbar: Format button callbacks', () => {
  let mockOnFormat: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnFormat = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should call onFormat with "bold" when Bold button is clicked', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onFormat={mockOnFormat} />);
    fireEvent.click(screen.getByRole('button', { name: /bold/i }));
    expect(mockOnFormat).toHaveBeenCalledWith('bold');
  });

  it('should call onFormat with "italic" when Italic button is clicked', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onFormat={mockOnFormat} />);
    fireEvent.click(screen.getByRole('button', { name: /italic/i }));
    expect(mockOnFormat).toHaveBeenCalledWith('italic');
  });

  it('should call onFormat with "h1" when H1 button is clicked', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onFormat={mockOnFormat} />);
    fireEvent.click(screen.getByRole('button', { name: /h1/i }));
    expect(mockOnFormat).toHaveBeenCalledWith('h1');
  });

  it('should call onFormat with "h2" when H2 button is clicked', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onFormat={mockOnFormat} />);
    fireEvent.click(screen.getByRole('button', { name: /h2/i }));
    expect(mockOnFormat).toHaveBeenCalledWith('h2');
  });

  it('should call onFormat with "h3" when H3 button is clicked', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onFormat={mockOnFormat} />);
    fireEvent.click(screen.getByRole('button', { name: /h3/i }));
    expect(mockOnFormat).toHaveBeenCalledWith('h3');
  });

  it('should call onFormat with "ul" when UL button is clicked', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onFormat={mockOnFormat} />);
    fireEvent.click(screen.getByRole('button', { name: 'Unordered List' }));
    expect(mockOnFormat).toHaveBeenCalledWith('ul');
  });

  it('should call onFormat with "ol" when OL button is clicked', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onFormat={mockOnFormat} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ordered List' }));
    expect(mockOnFormat).toHaveBeenCalledWith('ol');
  });

  it('should call onFormat with "code" when Code button is clicked', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onFormat={mockOnFormat} />);
    fireEvent.click(screen.getByRole('button', { name: /code/i }));
    expect(mockOnFormat).toHaveBeenCalledWith('code');
  });

  it('should call onFormat with "link" when Link button is clicked', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onFormat={mockOnFormat} />);
    fireEvent.click(screen.getByRole('button', { name: /link/i }));
    expect(mockOnFormat).toHaveBeenCalledWith('link');
  });

  it('should call onFormat with "quote" when Quote button is clicked', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onFormat={mockOnFormat} />);
    fireEvent.click(screen.getByRole('button', { name: /quote|blockquote/i }));
    expect(mockOnFormat).toHaveBeenCalledWith('quote');
  });
});

describe('EditorToolbar: Accessibility', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render all buttons with aria-label attributes', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const buttons = screen.getAllByRole('button');
    // All buttons should have accessible names (via aria-label or text content)
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-label');
    });
  });

  it('should render toolbar with role="toolbar" or as a landmark', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    const { container } = render(<EditorToolbar />);
    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar).toBeTruthy();
  });
});
