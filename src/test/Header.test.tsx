import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Header } from '@/components/layout/Header';
import { useUIStore } from '@/store/uiStore';
import { useFileStore } from '@/store/fileStore';

describe('Header', () => {
  it('renders filename', () => {
    render(<Header filename="test.md" isDirty={false} />);
    expect(screen.getByText('test.md')).toBeInTheDocument();
  });

  it('shows dirty indicator when file is unsaved', () => {
    // SPEC-UI-006: dirty glyph literal ('●') replaced by the .md-dirty-dot token-styled
    // indicator (REQ-UI-006-011). Behavior assertion (dot renders only when dirty) preserved.
    const { container } = render(<Header filename="test.md" isDirty={true} />);
    expect(container.querySelector('.md-dirty-dot')).toBeInTheDocument();
  });

  it('does not show dirty indicator when file is saved', () => {
    const { container } = render(<Header filename="test.md" isDirty={false} />);
    expect(container.querySelector('.md-dirty-dot')).not.toBeInTheDocument();
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

// ---- SPEC-PREVIEW-018: HTML 배율 컨트롤·단축키 (AC-001, AC-002, AC-004) ----

describe('Header HTML 배율 (SPEC-PREVIEW-018)', () => {
  const setPlatform = (platform: string): void => {
    Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });
  };
  const pressKey = (init: KeyboardEventInit & { key: string }): KeyboardEvent => {
    const ev = new KeyboardEvent('keydown', { cancelable: true, bubbles: true, ...init });
    act(() => {
      document.dispatchEvent(ev);
    });
    return ev;
  };

  beforeEach(() => {
    useUIStore.setState({ htmlZoom: 100, fontSize: 14 });
    useFileStore.setState({ currentFile: '/tmp/page.html', previewStatus: null });
    setPlatform('MacIntel');
  });

  afterEach(() => {
    act(() => {
      useFileStore.setState({ currentFile: null, previewStatus: null });
    });
    document.querySelectorAll('[role="dialog"]').forEach((n) => n.remove());
  });

  it('html 파일이면 배율 컨트롤을 보이고 글자 크기 조절은 숨긴다 (AC-001)', () => {
    useUIStore.setState({ htmlZoom: 110 });
    render(<Header />);
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
    expect(screen.getByLabelText('Reset zoom to 100%')).toHaveTextContent('110%');
    expect(screen.queryByLabelText('Decrease font size')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Increase font size')).not.toBeInTheDocument();
  });

  it.each(['/tmp/note.md', '/tmp/a.ts', '/tmp/a.txt'])(
    '%s이면 기존 글자 크기 조절을 보이고 배율 컨트롤은 없다 (AC-001)',
    (path) => {
      useFileStore.setState({ currentFile: path });
      render(<Header />);
      expect(screen.getByLabelText('Decrease font size')).toBeInTheDocument();
      expect(screen.getByLabelText('Increase font size')).toBeInTheDocument();
      expect(screen.getByText('14px')).toBeInTheDocument();
      expect(screen.queryByLabelText('Zoom in')).not.toBeInTheDocument();
    }
  );

  it('Zoom in 한 번 → 110, Zoom out 두 번 → 90, 리셋 → 100 (AC-002)', () => {
    render(<Header />);
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(useUIStore.getState().htmlZoom).toBe(110);
    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Zoom out'));
    expect(useUIStore.getState().htmlZoom).toBe(90);
    fireEvent.click(screen.getByLabelText('Reset zoom to 100%'));
    expect(useUIStore.getState().htmlZoom).toBe(100);
  });

  it('최댓값에서 Zoom in, 최솟값에서 Zoom out이 비활성이다 (AC-002)', () => {
    useUIStore.setState({ htmlZoom: 200 });
    const { unmount } = render(<Header />);
    expect(screen.getByLabelText('Zoom in')).toBeDisabled();
    expect(screen.getByLabelText('Zoom out')).not.toBeDisabled();
    unmount();
    useUIStore.setState({ htmlZoom: 67 });
    render(<Header />);
    expect(screen.getByLabelText('Zoom out')).toBeDisabled();
  });

  it('macOS: Cmd+= / + / - / 0이 배율을 바꾸고 기본 동작을 막는다 (AC-004)', () => {
    render(<Header />);
    let ev = pressKey({ key: '=', metaKey: true });
    expect(useUIStore.getState().htmlZoom).toBe(110);
    expect(ev.defaultPrevented).toBe(true);
    ev = pressKey({ key: '+', metaKey: true });
    expect(useUIStore.getState().htmlZoom).toBe(125);
    expect(ev.defaultPrevented).toBe(true);
    ev = pressKey({ key: '-', metaKey: true });
    expect(useUIStore.getState().htmlZoom).toBe(110);
    ev = pressKey({ key: '0', metaKey: true });
    expect(useUIStore.getState().htmlZoom).toBe(100);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('macOS: Ctrl+=는 무시하고 기본 동작도 막지 않는다 (AC-004)', () => {
    render(<Header />);
    const ev = pressKey({ key: '=', ctrlKey: true });
    expect(useUIStore.getState().htmlZoom).toBe(100);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('Windows: Ctrl+=는 올리고 Meta+=는 무시한다 (AC-004)', () => {
    setPlatform('Win32');
    render(<Header />);
    pressKey({ key: '=', ctrlKey: true });
    expect(useUIStore.getState().htmlZoom).toBe(110);
    const ev = pressKey({ key: '=', metaKey: true });
    expect(useUIStore.getState().htmlZoom).toBe(110);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('조합 입력 중이면 무시한다 (AC-004)', () => {
    render(<Header />);
    const ev = pressKey({ key: '=', metaKey: true, isComposing: true });
    expect(useUIStore.getState().htmlZoom).toBe(100);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('모달 대화상자가 열려 있으면 무시한다 (AC-004)', () => {
    const dlg = document.createElement('div');
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-modal', 'true');
    document.body.appendChild(dlg);
    render(<Header />);
    const ev = pressKey({ key: '=', metaKey: true });
    expect(useUIStore.getState().htmlZoom).toBe(100);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('html이 아닌 보기에서는 htmlZoom·fontSize 모두 그대로이고 기본 동작도 막지 않는다 (AC-004)', () => {
    useFileStore.setState({ currentFile: '/tmp/note.md' });
    render(<Header />);
    const ev = pressKey({ key: '=', metaKey: true });
    expect(useUIStore.getState().htmlZoom).toBe(100);
    expect(useUIStore.getState().fontSize).toBe(14);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('언마운트 뒤에는 키 리스너가 제거된다', () => {
    const { unmount } = render(<Header />);
    unmount();
    pressKey({ key: '=', metaKey: true });
    expect(useUIStore.getState().htmlZoom).toBe(100);
  });
});
