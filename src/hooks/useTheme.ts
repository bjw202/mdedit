import { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';

// @MX:ANCHOR: [AUTO] useTheme - global theme management hook, called by AppLayout on startup
// @MX:REASON: [AUTO] Public API boundary - applies dark/light class to document.documentElement (fan_in >= 3)
// @MX:NOTE: System dark mode detection hook - applies dark class to document root
// Handles three modes: system (follows OS), dark (always dark), light (always light)
// @MX:NOTE: [AUTO] data-theme 브리지(SPEC-UI-006) — 핸드오프 mdedit-tokens.css는 [data-theme="dark"]로
// 다크 테마를 키잉하지만, 기존 Tailwind darkMode:"class"는 .dark 클래스를 사용한다. 두 시스템이
// 병존해야 하므로 .dark 토글과 함께 data-theme 속성도 항상 설정한다(상태 머신 로직 자체는 무변경).
// @MX:SPEC: SPEC-UI-006
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
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
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
