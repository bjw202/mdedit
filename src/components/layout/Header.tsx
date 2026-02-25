import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import type { Theme } from '@/store/uiStore';

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
    <header className="flex items-center justify-between h-10 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 select-none">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
          MdEdit
        </span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          onClick={onNew}
          title="New File (Ctrl+N)"
          aria-label="New file"
          className="text-xs px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          New
        </button>
        <button
          onClick={onSave}
          title="Save (Ctrl+S)"
          aria-label="Save"
          className="text-xs px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Save
        </button>
        <button
          onClick={onSaveAs}
          title="Save As (Ctrl+Shift+S)"
          aria-label="Save as"
          className="text-xs px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Save As
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>

        {/* Export dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setExportMenuOpen((prev) => !prev)}
            disabled={!hasContent}
            title="Export document"
            aria-label="Export"
            aria-haspopup="true"
            aria-expanded={exportMenuOpen}
            className="text-xs px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export {exportLoading ? '...' : '▼'}
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
            <div
              role="menu"
              className="absolute left-0 top-full mt-1 z-50 min-w-max bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg"
            >
              <button
                role="menuitem"
                onClick={handleExportHtml}
                className="block w-full text-left text-xs px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Export as HTML
              </button>
              <button
                role="menuitem"
                onClick={handleExportPdf}
                className="block w-full text-left text-xs px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Export as PDF
              </button>
              <button
                role="menuitem"
                onClick={handleExportDocx}
                className="block w-full text-left text-xs px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Export as DOCX
              </button>
            </div>
          )}
        </div>

        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {filename}
          {isDirty && <span className="ml-1 text-orange-500">●</span>}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFontSize(fontSize - 1)}
          className="text-xs px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Decrease font size"
        >
          A-
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-500">{fontSize}px</span>
        <button
          onClick={() => setFontSize(fontSize + 1)}
          className="text-xs px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Increase font size"
        >
          A+
        </button>
        <button
          onClick={toggleTheme}
          className="text-xs px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
