import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ResizablePanels,
  clampPreviewPercent,
  MIN_PANE_PX,
} from '@/components/layout/ResizablePanels';
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

// BUG-1 재현: 스플리터를 오른쪽으로 끌면 에디터가 80% 에서 멈춘다 — 퍼센트 하한(20%)이
// 실질적으로 에디터 상한(80%)이 되기 때문. 최소 폭을 px(240px)로 바꾸면 넓은 창에서는
// 에디터가 80% 를 훨씬 넘길 수 있고, 좁은 창에서도 프리뷰가 완전히 접히지 않는다.
describe('clampPreviewPercent: px-based minimum pane width (BUG-1, pure)', () => {
  it('exposes a 240px minimum pane width', () => {
    expect(MIN_PANE_PX).toBe(240);
  });

  it('wide container: editor may exceed the former 80% ceiling', () => {
    // 2000px 기준 240px = 12% → 프리뷰 12%~88%, 즉 에디터는 최대 88%.
    expect(clampPreviewPercent(5, 2000)).toBeCloseTo(12);
    expect(clampPreviewPercent(95, 2000)).toBeCloseTo(88);
    expect(clampPreviewPercent(50, 2000)).toBe(50);
  });

  it('wide container: a value inside the bounds passes through untouched', () => {
    expect(clampPreviewPercent(15, 2000)).toBe(15);
    expect(clampPreviewPercent(85, 2000)).toBe(85);
  });

  it('narrow container: preview never fully collapses', () => {
    // 800px 기준 240px = 30% → 프리뷰는 30% 미만으로 내려가지 않는다.
    expect(clampPreviewPercent(2, 800)).toBeCloseTo(30);
    expect(clampPreviewPercent(98, 800)).toBeCloseTo(70);
  });

  it('container too small for two minimum panes: falls back to an even split', () => {
    // 400px < 240*2 → 양쪽 최소를 동시에 만족할 수 없으므로 50:50 으로 수렴.
    expect(clampPreviewPercent(5, 400)).toBe(50);
    expect(clampPreviewPercent(95, 400)).toBe(50);
    // 정확히 480px 이면 min == max == 50.
    expect(clampPreviewPercent(10, 480)).toBe(50);
  });

  it('degenerate container width falls back to an even split', () => {
    expect(clampPreviewPercent(70, 0)).toBe(50);
    expect(clampPreviewPercent(70, -100)).toBe(50);
    expect(clampPreviewPercent(70, Number.NaN)).toBe(50);
  });

  it('non-finite raw percent falls back to an even split', () => {
    expect(clampPreviewPercent(Number.NaN, 2000)).toBe(50);
    expect(clampPreviewPercent(Number.POSITIVE_INFINITY, 2000)).toBe(50);
  });
});
