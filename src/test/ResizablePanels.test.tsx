import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResizablePanels } from '@/components/layout/ResizablePanels';
import { useUIStore } from '@/store/uiStore';
import { useFileStore } from '@/store/fileStore';

describe('ResizablePanels', () => {
  beforeEach(() => {
    useUIStore.setState({
      viewMode: 'split',
      sidebarCollapsed: false,
      previewWidth: 50,
      sidebarWidth: 250,
    });
    useFileStore.setState({ currentFile: null });
  });

  it('renders sidebar, editor and preview panels', () => {
    render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
    expect(screen.getByText('Editor Content')).toBeInTheDocument();
    expect(screen.getByText('Preview Content')).toBeInTheDocument();
  });

  it('hides sidebar when collapsed', () => {
    useUIStore.setState({ sidebarCollapsed: true });
    render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.queryByText('Sidebar Content')).not.toBeInTheDocument();
  });

  it('shows sidebar when not collapsed', () => {
    useUIStore.setState({ sidebarCollapsed: false, sidebarWidth: 250 });
    render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
  });
});

// T2 (must-pass): editor/preview 단일 패널 모드 전환
describe('ResizablePanels: viewMode panel visibility (T2 - must-pass, SPEC-UI-004)', () => {
  beforeEach(() => {
    useUIStore.setState({
      viewMode: 'split',
      sidebarCollapsed: false,
      previewWidth: 50,
      sidebarWidth: 250,
    });
    useFileStore.setState({ currentFile: '/x/note.md' });
  });

  it('viewMode "editor" shows Editor, hides Preview and editor-preview divider', () => {
    useUIStore.setState({ viewMode: 'editor' });
    const { container } = render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.getByText('Editor Content')).toBeInTheDocument();
    expect(screen.queryByText('Preview Content')).not.toBeInTheDocument();
    // split 모드에서는 divider가 2개(sidebar + editor-preview), editor 모드에서는 1개(sidebar only)
    const dividers = container.querySelectorAll('.cursor-col-resize');
    expect(dividers.length).toBe(1); // 사이드바 구분선만 있어야 함
  });

  it('viewMode "preview" shows Preview, hides Editor and editor-preview divider', () => {
    useUIStore.setState({ viewMode: 'preview' });
    const { container } = render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.getByText('Preview Content')).toBeInTheDocument();
    expect(screen.queryByText('Editor Content')).not.toBeInTheDocument();
    const dividers = container.querySelectorAll('.cursor-col-resize');
    expect(dividers.length).toBe(1); // 사이드바 구분선만 있어야 함
  });

  it('viewMode "split" shows both Editor and Preview with two dividers', () => {
    useUIStore.setState({ viewMode: 'split' });
    const { container } = render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.getByText('Editor Content')).toBeInTheDocument();
    expect(screen.getByText('Preview Content')).toBeInTheDocument();
    const dividers = container.querySelectorAll('.cursor-col-resize');
    expect(dividers.length).toBe(2);
  });
});

// T4 (must-pass): .html 파일에서 editor 모드 → preview 자동 표시, store 보존
describe('ResizablePanels: .html auto-preview (T4 - must-pass, SPEC-UI-004)', () => {
  beforeEach(() => {
    useUIStore.setState({
      viewMode: 'editor',
      sidebarCollapsed: false,
      previewWidth: 50,
    });
  });

  it('.html 파일 + viewMode "editor" → Preview 표시, Editor 숨김', () => {
    useFileStore.setState({ currentFile: '/x/page.html' });
    render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.getByText('Preview Content')).toBeInTheDocument();
    expect(screen.queryByText('Editor Content')).not.toBeInTheDocument();
    // store의 viewMode는 여전히 'editor'로 유지되어야 함 (setViewMode 미호출)
    expect(useUIStore.getState().viewMode).toBe('editor');
  });

  it('.html에서 non-html 파일로 변경하면 Editor 복귀 (자연 복귀)', () => {
    useFileStore.setState({ currentFile: '/x/page.html' });
    const { rerender } = render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    // .html 파일: Preview가 보이고 Editor는 숨겨짐
    expect(screen.getByText('Preview Content')).toBeInTheDocument();
    expect(screen.queryByText('Editor Content')).not.toBeInTheDocument();

    // non-html 파일로 변경
    useFileStore.setState({ currentFile: '/x/note.md' });
    rerender(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    // Editor가 다시 보여야 하고 store viewMode는 여전히 'editor'
    expect(screen.getByText('Editor Content')).toBeInTheDocument();
    expect(screen.queryByText('Preview Content')).not.toBeInTheDocument();
    expect(useUIStore.getState().viewMode).toBe('editor');
  });
});

// T5: 사이드바 독립성
describe('ResizablePanels: sidebar independence (T5, SPEC-UI-004)', () => {
  it('viewMode "preview" + sidebarCollapsed false → Sidebar Content 표시', () => {
    useUIStore.setState({ viewMode: 'preview', sidebarCollapsed: false });
    useFileStore.setState({ currentFile: null });
    render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
  });

  it('viewMode "preview" + sidebarCollapsed true → Sidebar Content 숨김', () => {
    useUIStore.setState({ viewMode: 'preview', sidebarCollapsed: true });
    useFileStore.setState({ currentFile: null });
    render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.queryByText('Sidebar Content')).not.toBeInTheDocument();
  });
});

// 엣지 케이스
describe('ResizablePanels: edge cases (SPEC-UI-004)', () => {
  beforeEach(() => {
    useUIStore.setState({
      viewMode: 'split',
      sidebarCollapsed: false,
      previewWidth: 50,
    });
    useFileStore.setState({ currentFile: null });
  });

  it('previewWidth 보존: split→editor→split 전환 후 previewWidth가 유지됨', () => {
    useUIStore.setState({ previewWidth: 70, viewMode: 'split' });
    const { rerender } = render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    useUIStore.setState({ viewMode: 'editor' });
    rerender(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    // editor 모드에서 setPreviewWidth가 호출되지 않아야 함
    expect(useUIStore.getState().previewWidth).toBe(70);

    useUIStore.setState({ viewMode: 'split' });
    rerender(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(useUIStore.getState().previewWidth).toBe(70);
  });

  it('코드 파일 editor 유지: .json + viewMode "editor" → Editor 표시 (자동 preview 강등 없음)', () => {
    useUIStore.setState({ viewMode: 'editor' });
    useFileStore.setState({ currentFile: '/x/data.json' });
    render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    // 코드 파일은 editor 모드에서 Editor가 그대로 표시
    expect(screen.getByText('Editor Content')).toBeInTheDocument();
    expect(screen.queryByText('Preview Content')).not.toBeInTheDocument();
  });

  it('대문자 확장자 .HTML + viewMode "editor" → Preview 표시', () => {
    useUIStore.setState({ viewMode: 'editor' });
    useFileStore.setState({ currentFile: '/x/PAGE.HTML' });
    render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.getByText('Preview Content')).toBeInTheDocument();
    expect(screen.queryByText('Editor Content')).not.toBeInTheDocument();
  });
});
