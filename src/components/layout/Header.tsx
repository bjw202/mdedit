import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useFileStore } from '@/store/fileStore';
import { getFileViewType } from '@/lib/preview/fileViewType';
import {
  HTML_ZOOM_STEPS,
  detectPlatform,
  isMacPlatform,
  matchZoomShortcut,
} from '@/lib/preview/htmlZoom';
import type { Theme } from '@/store/uiStore';
import { ImageModeToggle } from '@/components/settings/ImageModeToggle';
import { ViewModeToggle } from '@/components/layout/ViewModeToggle';
import {
  FilePlusIcon,
  SaveIcon,
  FileOutputIcon,
  DownloadIcon,
  ChevronDownIcon,
  MinusIcon,
  PlusIcon,
  SunIcon,
  MoonIcon,
} from '@/components/icons';

interface HeaderProps {
  filename?: string;
  isDirty?: boolean;
  /** Raw markdown content - used to determine if Export should be enabled */
  content?: string;
  onNew?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  /** Called when user selects "Export as HTML" */
  onExportHtml?: () => void;
  /** Called when user selects "Export as PDF" */
  onExportPdf?: () => void;
  /** Called when user selects "Export as DOCX" */
  onExportDocx?: () => void;
  /** Whether an export is currently in progress */
  exportLoading?: boolean;
  /** Called when the settings gear is clicked — opens the settings modal (SPEC-AI-001). */
  onOpenSettings?: () => void;
}

// @MX:NOTE: [AUTO] 설정 톱니 아이콘 — icons.tsx(SPEC-UI-006 배럴)를 건드리지 않기 위해 로컬 인라인.
// stroke="currentColor" 상속으로 라이트/다크 자동 대응(다른 md-icon-btn 과 동일).
// @MX:SPEC: SPEC-AI-001
function SettingsGearIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// @MX:NOTE: Application header - displays filename, save status, font size controls, theme toggle, export dropdown
export function Header({
  filename = 'Untitled',
  isDirty = false,
  content = '',
  onNew,
  onSave,
  onSaveAs,
  onExportHtml,
  onExportPdf,
  onExportDocx,
  exportLoading = false,
  onOpenSettings,
}: HeaderProps): JSX.Element {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const fontSize = useUIStore((s) => s.fontSize);
  const setFontSize = useUIStore((s) => s.setFontSize);
  const htmlZoom = useUIStore((s) => s.htmlZoom);
  const stepHtmlZoom = useUIStore((s) => s.stepHtmlZoom);
  const resetHtmlZoom = useUIStore((s) => s.resetHtmlZoom);
  const currentFile = useFileStore((s) => s.currentFile);
  const previewStatus = useFileStore((s) => s.previewStatus);
  const isHtmlView = getFileViewType(currentFile, previewStatus) === 'html';

  // @MX:NOTE: [AUTO] HTML 배율 단축키 — 앱 셸 문서 단위 keydown 리스너 (SPEC-PREVIEW-018 REQ-004).
  // 수정키는 macOS Cmd(metaKey)만, 그 밖의 OS Ctrl(ctrlKey)만 받는다. 보기 종류가 html이 아니거나,
  // 모달 대화상자가 열려 있거나, 조합 입력 중이면 처리하지 않고 기본 동작도 막지 않는다.
  // 키보드 초점이 iframe 문서 안에 있으면 cross-origin이라 이 리스너가 키를 받지 못한다(알려진 제한).
  // @MX:SPEC: SPEC-PREVIEW-018
  useEffect(() => {
    if (!isHtmlView) return;
    const isMac = isMacPlatform(detectPlatform());
    const onKeyDown = (e: KeyboardEvent): void => {
      const action = matchZoomShortcut(e, isMac);
      if (!action) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      e.preventDefault();
      if (action === 'reset') resetHtmlZoom();
      else stepHtmlZoom(action);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isHtmlView, stepHtmlZoom, resetHtmlZoom]);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const toggleTheme = (): void => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const hasContent = content.length > 0;

  // Close the export menu when clicking outside
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const handleExportHtml = (): void => {
    setExportMenuOpen(false);
    onExportHtml?.();
  };

  const handleExportPdf = (): void => {
    setExportMenuOpen(false);
    onExportPdf?.();
  };

  const handleExportDocx = (): void => {
    setExportMenuOpen(false);
    onExportDocx?.();
  };

  return (
    <header className="md-titlebar">
      <div className="md-tb-group">
        <span className="md-wordmark">MdEdit</span>
        <span className="md-vdiv" />
        <button
          onClick={onNew}
          title="New File (Ctrl+N)"
          aria-label="New file"
          className="md-btn"
        >
          <FilePlusIcon />
          New
        </button>
        <button
          onClick={onSave}
          title="Save (Ctrl+S)"
          aria-label="Save"
          className="md-btn"
        >
          <SaveIcon />
          Save
        </button>
        <button
          onClick={onSaveAs}
          title="Save As (Ctrl+Shift+S)"
          aria-label="Save as"
          className="md-btn"
        >
          <FileOutputIcon />
          Save As
        </button>
        <span className="md-vdiv" />

        {/* Export dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setExportMenuOpen((prev) => !prev)}
            disabled={!hasContent}
            title="Export document"
            aria-label="Export"
            aria-haspopup="true"
            aria-expanded={exportMenuOpen}
            className="md-btn"
          >
            <DownloadIcon />
            Export {exportLoading ? '...' : <ChevronDownIcon width={12} height={12} />}
          </button>

          {exportLoading && (
            <span
              aria-label="Export loading"
              className="ml-1 text-xs text-blue-500 dark:text-blue-400"
            >
              Loading...
            </span>
          )}

          {exportMenuOpen && (
            <div role="menu" className="md-menu absolute left-0 top-full mt-1 z-50">
              <button role="menuitem" onClick={handleExportHtml} className="md-menu-item w-full">
                Export as HTML
              </button>
              <button role="menuitem" onClick={handleExportPdf} className="md-menu-item w-full">
                Export as PDF
              </button>
              <button role="menuitem" onClick={handleExportDocx} className="md-menu-item w-full">
                Export as DOCX
              </button>
            </div>
          )}
        </div>

        <span className="md-vdiv" />
        <span className="md-filename">
          {filename}
          {isDirty && <span className="md-dirty-dot" />}
        </span>
      </div>
      <div className="md-tb-group md-tb-spacer">
        <ViewModeToggle />
        <span className="md-vdiv" />
        <ImageModeToggle />
        <span className="md-vdiv" />
        {isHtmlView ? (
          <div className="md-stepper">
            <button
              onClick={() => stepHtmlZoom('out')}
              disabled={htmlZoom <= HTML_ZOOM_STEPS[0]}
              aria-label="Zoom out"
            >
              <MinusIcon width={13} height={13} />
            </button>
            <button
              className="val"
              onClick={resetHtmlZoom}
              aria-label="Reset zoom to 100%"
              title="Reset zoom to 100%"
            >
              {htmlZoom}%
            </button>
            <button
              onClick={() => stepHtmlZoom('in')}
              disabled={htmlZoom >= HTML_ZOOM_STEPS[HTML_ZOOM_STEPS.length - 1]}
              aria-label="Zoom in"
            >
              <PlusIcon width={13} height={13} />
            </button>
          </div>
        ) : (
          <div className="md-stepper">
            <button onClick={() => setFontSize(fontSize - 1)} aria-label="Decrease font size">
              <MinusIcon width={13} height={13} />
            </button>
            <span className="val">{fontSize}px</span>
            <button onClick={() => setFontSize(fontSize + 1)} aria-label="Increase font size">
              <PlusIcon width={13} height={13} />
            </button>
          </div>
        )}
        <button onClick={toggleTheme} className="md-icon-btn" aria-label="Toggle theme">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button
          onClick={onOpenSettings}
          className="md-icon-btn"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsGearIcon />
        </button>
      </div>
    </header>
  );
}
