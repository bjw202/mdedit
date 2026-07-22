// @MX:SPEC: SPEC-UI-008
// Tests for the DiagramInsertMenu dropdown in EditorToolbar (REQ-001/004/007/011/012, AC-001/002/010).
// TDD RED phase: mirrors TableGridPicker.test.tsx popover conventions.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const PRESET_LABELS = [
  '순서도',
  '시퀀스 다이어그램',
  '간트 차트',
  '클래스 다이어그램',
  '상태 다이어그램',
  '파이 차트',
  '마인드맵',
  '사용자 정의(빈 다이어그램)',
];

describe('DiagramInsertMenu: open/close', () => {
  afterEach(() => cleanup());

  it('trigger is closed by default with aria attributes', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const trigger = screen.getByRole('button', { name: '다이어그램 삽입' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the dropdown on trigger click and shows all 8 items', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const trigger = screen.getByRole('button', { name: '다이어그램 삽입' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(8);
  });

  it('closes again on a second trigger click', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const trigger = screen.getByRole('button', { name: '다이어그램 삽입' });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on outside mousedown', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(
      <div>
        <div data-testid="outside">outside</div>
        <EditorToolbar />
      </div>,
    );
    const trigger = screen.getByRole('button', { name: '다이어그램 삽입' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape while open', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    const trigger = screen.getByRole('button', { name: '다이어그램 삽입' });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('DiagramInsertMenu: item accessibility + icons', () => {
  afterEach(() => cleanup());

  it('each of the 8 items has a non-empty aria-label and Korean label text', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: '다이어그램 삽입' }));
    for (const label of PRESET_LABELS) {
      const item = screen.getByRole('menuitem', { name: new RegExp(label.replace(/[()]/g, '\\$&')) });
      expect(item).toBeInTheDocument();
      expect(item.getAttribute('aria-label')?.trim().length).toBeGreaterThan(0);
      expect(item.textContent).toContain(label);
    }
  });

  it('the 7 preset items render an <svg> icon that inherits currentColor', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: '다이어그램 삽입' }));
    const presetLabels = PRESET_LABELS.slice(0, 7);
    const shapes = new Set<string>();
    for (const label of presetLabels) {
      const item = screen.getByRole('menuitem', { name: new RegExp(label) });
      const svg = item.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('stroke')).toBe('currentColor');
      shapes.add(svg?.innerHTML ?? '');
    }
    // 7 distinct icon shapes
    expect(shapes.size).toBe(7);
  });
});

describe('DiagramInsertMenu: selection callback', () => {
  let onInsertDiagram: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    onInsertDiagram = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('calls onInsertDiagram with the flowchart preset and closes', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onInsertDiagram={onInsertDiagram} />);
    const trigger = screen.getByRole('button', { name: '다이어그램 삽입' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: /순서도/ }));
    expect(onInsertDiagram).toHaveBeenCalledWith('flowchart');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('calls onInsertDiagram with "custom" for the 사용자 정의 item', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onInsertDiagram={onInsertDiagram} />);
    fireEvent.click(screen.getByRole('button', { name: '다이어그램 삽입' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /사용자 정의/ }));
    expect(onInsertDiagram).toHaveBeenCalledWith('custom');
  });

  it('does not throw when onInsertDiagram is not provided', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: '다이어그램 삽입' }));
    expect(() =>
      fireEvent.click(screen.getByRole('menuitem', { name: /마인드맵/ })),
    ).not.toThrow();
  });
});

describe('DiagramInsertMenu: keyboard traversal', () => {
  afterEach(() => cleanup());

  it('ArrowDown moves focus to the first item, then to the next', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: '다이어그램 삽입' }));
    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
  });

  it('ArrowUp from the first item wraps to the last', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: '다이어그램 삽입' }));
    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    fireEvent.keyDown(menu, { key: 'ArrowDown' }); // → items[0]
    fireEvent.keyDown(menu, { key: 'ArrowUp' }); // wraps → last
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('Enter on a focused item selects it and closes', async () => {
    const onInsertDiagram = vi.fn();
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');
    render(<EditorToolbar onInsertDiagram={onInsertDiagram} />);
    const trigger = screen.getByRole('button', { name: '다이어그램 삽입' });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' }); // focus items[0] = flowchart
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onInsertDiagram).toHaveBeenCalledWith('flowchart');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
