import { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';

// @MX:ANCHOR: [AUTO] useTheme - global theme management hook, called by AppLayout on startup
// @MX:REASON: [AUTO] Public API boundary - applies dark/light class to document.documentElement (fan_in >= 3)
// @MX:NOTE: System dark mode detection hook - applies dark class to document root
// Handles three modes: system (follows OS), dark (always dark), light (always light)
export function useTheme(): void {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (isDark: boolean): void => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent): void => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme === 'dark');
    }
  }, [theme]);
}
