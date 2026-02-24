import { useRef, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';

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

// @MX:ANCHOR: 3-pane layout container with drag-to-resize dividers
// @MX:REASON: [AUTO] Core layout component - used by AppLayout, drives entire panel sizing system
export function ResizablePanels({ sidebar, editor, preview }: ResizablePanelsProps): JSX.Element {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const previewWidth = useUIStore((s) => s.previewWidth);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setPreviewWidth = useUIStore((s) => s.setPreviewWidth);

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
  const editorWidth = `calc(${100 - previewWidth}%)`;
  const previewWidthStyle = `${previewWidth}%`;

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

      {/* Editor */}
      <div style={{ width: editorWidth }} className="h-full overflow-hidden flex-shrink-0">
        {editor}
      </div>

      {/* Resize handle between editor and preview */}
      <ResizeDivider onMouseDown={handlePreviewMouseDown} />

      {/* Preview */}
      <div style={{ width: previewWidthStyle }} className="h-full overflow-hidden flex-shrink-0">
        {preview}
      </div>
    </div>
  );
}
