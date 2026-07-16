/**
 * SPEC-UI-007: TableGridPicker component tests
 *
 * TDD RED phase: Define expected behavior before implementation.
 * Mirrors the popover pattern established by ExportHeader.test.tsx (open/close/outside-click)
 * and adds Escape-key close (new pattern per Confirmed Design Decision 10).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('TableGridPicker: open/close', () => {
  afterEach(() => {
    cleanup();
  });

  it('is closed by default (aria-expanded="false")', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const trigger = screen.getByRole('button', { name: /insert table/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the grid popover on trigger click (aria-expanded toggles to true)', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const trigger = screen.getByRole('button', { name: /insert table/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders 64 grid cell buttons when open', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: /insert table/i }));
    const cells = screen.getAllByRole('button', { name: /^Insert \d+ by \d+ table$/ });
    expect(cells).toHaveLength(64);
  });

  it('closes the popover again when the trigger is clicked a second time', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const trigger = screen.getByRole('button', { name: /insert table/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes when clicking outside the popover', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(
      <div>
        <div data-testid="outside">outside</div>
        <EditorToolbar />
      </div>,
    );
    const trigger = screen.getByRole('button', { name: /insert table/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape key while open', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const trigger = screen.getByRole('button', { name: /insert table/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not close when clicking inside the popover (e.g. on the grid)', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const trigger = screen.getByRole('button', { name: /insert table/i });
    fireEvent.click(trigger);

    const cell = screen.getByRole('button', { name: 'Insert 1 by 1 table' });
    fireEvent.mouseDown(cell);
    // A mousedown inside the popover should not trigger the outside-click close handler.
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('TableGridPicker: cell click callback', () => {
  let onInsertTable: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onInsertTable = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('calls onInsertTable(rows, cols) with exact args on cell click (rows-first)', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onInsertTable={onInsertTable} />);
    fireEvent.click(screen.getByRole('button', { name: /insert table/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Insert 4 by 3 table' }));
    expect(onInsertTable).toHaveBeenCalledWith(4, 3);
  });

  it('closes the popover after a cell click', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onInsertTable={onInsertTable} />);
    const trigger = screen.getByRole('button', { name: /insert table/i });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Insert 1 by 1 table' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not throw when onInsertTable is not provided', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: /insert table/i }));
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Insert 2 by 2 table' }))).not.toThrow();
  });
});

describe('TableGridPicker: hover highlight and size label (rows-first "r x c")', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the rows-first size label text on hover (e.g. row 4, col 3 -> "4 x 3")', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: /insert table/i }));

    const cell = screen.getByRole('button', { name: 'Insert 4 by 3 table' });
    fireEvent.mouseOver(cell);

    expect(screen.getByText('4 × 3')).toBeInTheDocument();
  });

  it('marks cells within the hovered row/col range as armed (highlighted)', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: /insert table/i }));

    const hovered = screen.getByRole('button', { name: 'Insert 2 by 2 table' });
    fireEvent.mouseOver(hovered);

    const inRange = screen.getByRole('button', { name: 'Insert 1 by 1 table' });
    const outOfRange = screen.getByRole('button', { name: 'Insert 3 by 3 table' });
    expect(inRange.className).toContain('is-armed');
    expect(outOfRange.className).not.toContain('is-armed');
  });
});
