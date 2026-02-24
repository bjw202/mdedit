import type { SaveStatus } from '@/store/uiStore';

interface FooterProps {
  lineCount?: number;
  cursorLine?: number;
  cursorCol?: number;
  encoding?: string;
  saveStatus?: SaveStatus;
  wordCount?: number;
  charCount?: number;
  scrollSyncEnabled?: boolean;
  onScrollSyncToggle?: () => void;
}

function getSaveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case 'new': return 'New';
    case 'saved': return 'Saved';
    case 'unsaved': return 'Unsaved';
    case 'saving': return 'Saving...';
  }
}

function getSaveStatusColor(status: SaveStatus): string {
  switch (status) {
    case 'new': return 'text-gray-400 dark:text-gray-600';
    case 'saved': return 'text-green-500 dark:text-green-400';
    case 'unsaved': return 'text-yellow-500 dark:text-yellow-400';
    case 'saving': return 'text-blue-500 dark:text-blue-400';
  }
}

// @MX:NOTE: Status bar footer - displays line count, cursor position, file encoding,
// save status, word/char counts, and scroll sync toggle
export function Footer({
  lineCount = 0,
  cursorLine = 1,
  cursorCol = 1,
  encoding = 'UTF-8',
  saveStatus = 'new',
  wordCount = 0,
  charCount = 0,
  scrollSyncEnabled = true,
  onScrollSyncToggle,
}: FooterProps): JSX.Element {
  return (
    <footer className="flex items-center justify-between h-6 px-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-500 select-none">
      <div className="flex items-center gap-4">
        <span className={getSaveStatusColor(saveStatus)}>
          {getSaveStatusLabel(saveStatus)}
        </span>
        <span>Lines: {lineCount}</span>
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
      </div>
      <div className="flex items-center gap-4">
        {onScrollSyncToggle !== undefined && (
          <button
            type="button"
            role="button"
            aria-label="Scroll Sync"
            aria-pressed={scrollSyncEnabled}
            onClick={onScrollSyncToggle}
            className={`px-1 rounded transition-colors ${
              scrollSyncEnabled
                ? 'text-blue-500 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900'
                : 'text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Sync
          </button>
        )}
        <span>Ln {cursorLine}, Col {cursorCol}</span>
        <span>{encoding}</span>
      </div>
    </footer>
  );
}
