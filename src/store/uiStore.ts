import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// @MX:ANCHOR: [AUTO] useUIStore - persisted UI state store consumed by AppLayout, Header, ResizablePanels, Footer, useTheme
// @MX:REASON: [AUTO] Public API boundary for all UI state (theme, sidebar, panels, save status); fan_in >= 5
// @MX:NOTE: Theme type union for type-safe theme selection
export type Theme = 'light' | 'dark' | 'system';

// @MX:NOTE: SaveStatus type representing file save state
export type SaveStatus = 'new' | 'saved' | 'unsaved' | 'saving';

// @MX:NOTE: ImageInsertMode controls how clipboard-pasted images are inserted into the document
// @MX:SPEC: SPEC-IMG-MODE-001
export type ImageInsertMode = 'inline-blob' | 'file-save';

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
  /** Last opened folder path, persisted for auto-restore on app start */
  lastWatchedPath: string | null;
  /** Image insert mode for clipboard paste: inline-blob (default) or file-save */
  imageInsertMode: ImageInsertMode;
  // Actions
  setSidebarWidth: (width: number) => void;
  setPreviewWidth: (width: number) => void;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
  toggleSidebar: () => void;
  setSaveStatus: (status: SaveStatus) => void;
  setScrollSyncEnabled: (enabled: boolean) => void;
  toggleScrollSync: () => void;
  setLastWatchedPath: (path: string | null) => void;
  setImageInsertMode: (mode: ImageInsertMode) => void;
}

// @MX:NOTE: [AUTO] sidebarWidth clamped to [180, 600]px; previewWidth clamped to [20, 80]% to prevent layout breakage
// @MX:ANCHOR: [AUTO] Central UI state store - persisted to localStorage via zustand persist middleware
// @MX:REASON: [AUTO] Public API boundary - used by AppLayout, Header, ResizablePanels, useTheme, Footer (fan_in >= 5)
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
      lastWatchedPath: null,
      imageInsertMode: 'inline-blob',
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
      setLastWatchedPath: (path: string | null) => set({ lastWatchedPath: path }),
      setImageInsertMode: (mode: ImageInsertMode) => set({ imageInsertMode: mode }),
    }),
    {
      name: 'mdedit-ui-store',
    }
  )
);
