import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// @MX:NOTE: Theme type union for type-safe theme selection
export type Theme = 'light' | 'dark' | 'system';

// @MX:NOTE: SaveStatus type representing file save state
export type SaveStatus = 'new' | 'saved' | 'unsaved' | 'saving';

interface UIState {
  sidebarWidth: number;
  previewWidth: number;
  theme: Theme;
  fontSize: number;
  sidebarCollapsed: boolean;
  /** Current file save status */
  saveStatus: SaveStatus;
  /** Whether scroll sync between editor and preview is enabled */
  scrollSyncEnabled: boolean;
  // Actions
  setSidebarWidth: (width: number) => void;
  setPreviewWidth: (width: number) => void;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
  toggleSidebar: () => void;
  setSaveStatus: (status: SaveStatus) => void;
  setScrollSyncEnabled: (enabled: boolean) => void;
  toggleScrollSync: () => void;
}

// @MX:ANCHOR: Central UI state store - persisted to localStorage via zustand persist middleware
// @MX:REASON: [AUTO] Public API boundary - used by AppLayout, Header, ResizablePanels, useTheme, Footer
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarWidth: 250,
      previewWidth: 50, // percentage
      theme: 'system',
      fontSize: 14,
      sidebarCollapsed: false,
      saveStatus: 'new',
      scrollSyncEnabled: true,
      setSidebarWidth: (width: number) =>
        set({ sidebarWidth: Math.max(180, Math.min(600, width)) }),
      setPreviewWidth: (width: number) =>
        set({ previewWidth: Math.max(20, Math.min(80, width)) }),
      setTheme: (theme: Theme) => set({ theme }),
      setFontSize: (size: number) =>
        set({ fontSize: Math.max(10, Math.min(24, size)) }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSaveStatus: (status: SaveStatus) => set({ saveStatus: status }),
      setScrollSyncEnabled: (enabled: boolean) => set({ scrollSyncEnabled: enabled }),
      toggleScrollSync: () =>
        set((state) => ({ scrollSyncEnabled: !state.scrollSyncEnabled })),
    }),
    {
      name: 'mdedit-ui-store',
    }
  )
);
