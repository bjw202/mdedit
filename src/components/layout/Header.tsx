import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
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
}: HeaderProps): JSX.Element {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const fontSize = useUIStore((s) => s.fontSize);
  const setFontSize = useUIStore((s) => s.setFontSize);

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
        <div className="md-stepper">
          <button onClick={() => setFontSize(fontSize - 1)} aria-label="Decrease font size">
            <MinusIcon width={13} height={13} />
          </button>
          <span className="val">{fontSize}px</span>
          <button onClick={() => setFontSize(fontSize + 1)} aria-label="Increase font size">
            <PlusIcon width={13} height={13} />
          </button>
        </div>
        <button onClick={toggleTheme} className="md-icon-btn" aria-label="Toggle theme">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}
