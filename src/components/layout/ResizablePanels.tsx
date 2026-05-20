import { useRef, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import type { ViewMode } from '@/store/uiStore';
import { useFileStore } from '@/store/fileStore';
import { getFileViewType } from '@/components/preview/PreviewContainer';

interface ResizablePanelsProps {
  sidebar: React.ReactNode;
  editor: React.ReactNode;
  preview: React.ReactNode;
}

// Extracted reusable resize divider to eliminate duplication
const DIVIDER_CLASS =
  'w-1 h-full bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 cursor-col-resize flex-shrink-0 transition-colors';

interface ResizeDividerProps {
  onMouseDown: () => void;
}

function ResizeDivider({ onMouseDown }: ResizeDividerProps): JSX.Element {
  return <div className={DIVIDER_CLASS} onMouseDown={onMouseDown} />;
}

// @MX:ANCHOR: [AUTO] 3-pane layout container with drag-to-resize dividers, 3-mode view switching
// @MX:REASON: [AUTO] Core layout component — AppLayout 유일 사용처. 패널 너비 불변식: split=ratio 기반, editor/preview=전체 폭(ratio 무시 but 보존). SPEC-UI-004 viewMode 분기 추가.
// @MX:SPEC: SPEC-UI-004
// @MX:NOTE: [AUTO] previewWidth는 퍼센트(20-80)로 저장. split 모드에서는 calc()로 비율 적용. 단일 패널 모드에서는 ratio를 무시하고 calc(100% - fixedPx) 전체 폭 부여(store 값 보존).
// @MX:NOTE: [AUTO] effectiveViewMode 파생: viewMode === 'editor' && 현재 파일이 .html이면 'preview'로 강등 (렌더링 한정, store 보존).
//   setViewMode 미호출 — SPEC-UI-004 REQ-UI-004-004. 비-html 파일로 전환 시 editor 복귀는 자연스럽게 일어남.
export function ResizablePanels({ sidebar, editor, preview }: ResizablePanelsProps): JSX.Element {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const previewWidth = useUIStore((s) => s.previewWidth);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setPreviewWidth = useUIStore((s) => s.setPreviewWidth);
  const viewMode = useUIStore((s) => s.viewMode);
  const currentFile = useFileStore((s) => s.currentFile);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingSidebar = useRef(false);
  const isDraggingPreview = useRef(false);

  const handleSidebarMouseDown = useCallback((): void => {
    isDraggingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handlePreviewMouseDown = useCallback((): void => {
    isDraggingPreview.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent): void => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (isDraggingSidebar.current) {
        const newWidth = e.clientX - rect.left;
        setSidebarWidth(newWidth);
      }

      if (isDraggingPreview.current) {
        const totalWidth = rect.width;
        const currentSidebarWidth = sidebarCollapsed ? 0 : sidebarWidth;
        const remainingWidth = totalWidth - currentSidebarWidth;
        const previewStartX = e.clientX - rect.left - currentSidebarWidth;
        const newPreviewPercent = (1 - previewStartX / remainingWidth) * 100;
        setPreviewWidth(newPreviewPercent);
      }
    },
    [sidebarWidth, sidebarCollapsed, setSidebarWidth, setPreviewWidth]
  );

  const handleMouseUp = useCallback((): void => {
    isDraggingSidebar.current = false;
    isDraggingPreview.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const effectiveSidebarWidth = sidebarCollapsed ? 0 : sidebarWidth;

  // .html 파일 + editor 모드인 경우 렌더링상 preview로 강등 (store의 viewMode는 보존)
  // SPEC-UI-004 REQ-UI-004-004: 자동 미리보기는 .html 한정, setViewMode 미호출
  const isHtmlFile = getFileViewType(currentFile) === 'html';
  const effectiveViewMode: ViewMode = viewMode === 'editor' && isHtmlFile ? 'preview' : viewMode;

  // 구분선 너비 계산: 사이드바 구분선(4px) + editor-preview 구분선(split 모드에서만 4px)
  // split 모드: 2개의 구분선(사이드바 + editor-preview), 단일 모드: 사이드바 구분선만
  const dividerPx =
    (sidebarCollapsed ? 0 : 4) + (effectiveViewMode === 'split' ? 4 : 0);
  const fixedWidthPx = effectiveSidebarWidth + dividerPx;

  // 모드별 패널 너비 계산
  const editorWidth =
    effectiveViewMode === 'split'
      ? `calc((100% - ${fixedWidthPx}px) * ${(100 - previewWidth) / 100})`
      : `calc(100% - ${fixedWidthPx}px)`;

  const previewWidthStyle =
    effectiveViewMode === 'split'
      ? `calc((100% - ${fixedWidthPx}px) * ${previewWidth / 100})`
      : `calc(100% - ${fixedWidthPx}px)`;

  return (
    <div
      ref={containerRef}
      className="flex flex-1 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <>
          <div
            style={{ width: effectiveSidebarWidth, minWidth: 180 }}
            className="h-full overflow-hidden flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
          >
            {sidebar}
          </div>
          <ResizeDivider onMouseDown={handleSidebarMouseDown} />
        </>
      )}

      {/* Editor: preview 단일 모드에서는 렌더하지 않음 */}
      {effectiveViewMode !== 'preview' && (
        <div style={{ width: editorWidth }} className="h-full overflow-hidden flex-shrink-0">
          {editor}
        </div>
      )}

      {/* Editor↔Preview 구분선: split 모드에서만 렌더 */}
      {effectiveViewMode === 'split' && (
        <ResizeDivider onMouseDown={handlePreviewMouseDown} />
      )}

      {/* Preview: editor 단일 모드에서는 렌더하지 않음 */}
      {effectiveViewMode !== 'editor' && (
        <div style={{ width: previewWidthStyle }} className="h-full overflow-hidden flex-shrink-0">
          {preview}
        </div>
      )}
    </div>
  );
}
