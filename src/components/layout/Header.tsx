import { useUIStore } from '@/store/uiStore';
import type { Theme } from '@/store/uiStore';

interface HeaderProps {
  filename?: string;
  isDirty?: boolean;
}

// @MX:NOTE: Application header - displays filename, save status, font size controls, theme toggle
export function Header({ filename = 'Untitled', isDirty = false }: HeaderProps): JSX.Element {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const fontSize = useUIStore((s) => s.fontSize);
  const setFontSize = useUIStore((s) => s.setFontSize);

  const toggleTheme = (): void => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <header className="flex items-center justify-between h-10 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 select-none">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
          MdEdit
        </span>
        <span className="text-gray-400 dark:text-gray-500">|</span>
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
