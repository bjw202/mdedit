interface FooterProps {
  lineCount?: number;
  cursorLine?: number;
  cursorCol?: number;
  encoding?: string;
}

// @MX:NOTE: Status bar footer - displays line count, cursor position, and file encoding
export function Footer({
  lineCount = 0,
  cursorLine = 1,
  cursorCol = 1,
  encoding = 'UTF-8',
}: FooterProps): JSX.Element {
  return (
    <footer className="flex items-center justify-between h-6 px-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-500 select-none">
      <span>Lines: {lineCount}</span>
      <div className="flex items-center gap-4">
        <span>Ln {cursorLine}, Col {cursorCol}</span>
        <span>{encoding}</span>
      </div>
    </footer>
  );
}
