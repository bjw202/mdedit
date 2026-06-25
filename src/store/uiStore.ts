import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// @MX:ANCHOR: [AUTO] useUIStore - persisted UI state store consumed by AppLayout, Header, ResizablePanels, Footer, useTheme, ViewModeToggle
// @MX:REASON: [AUTO] Public API boundary for all UI state (theme, sidebar, panels, save status, viewMode, statusMessage); fan_in >= 5; SPEC-UI-004 viewMode 추가, SPEC-UI-005 statusMessage 추가
// @MX:SPEC: SPEC-UI-004
// @MX:NOTE: Theme type union for type-safe theme selection
export type Theme = 'light' | 'dark' | 'system';

// @MX:NOTE: SaveStatus type representing file save state
export type SaveStatus = 'new' | 'saved' | 'unsaved' | 'saving';

// @MX:NOTE: ImageInsertMode controls how clipboard-pasted images are inserted into the document
// @MX:SPEC: SPEC-IMG-MODE-001
export type ImageInsertMode = 'inline-blob' | 'file-save';

// @MX:NOTE: ViewMode는 Editor/Preview 영역의 표시 상태를 나타내는 3-state 타입 (SPEC-UI-004)
// 'split'(기본) | 'editor'(편집 전용) | 'preview'(미리보기 전용)
export type ViewMode = 'split' | 'editor' | 'preview';

// @MX:NOTE: [AUTO] statusMessage auto-clear 타이머를 보관하는 module-level ref (SPEC-UI-005).
// 컴포넌트 unmount 와 무관하게 동작하며, store 상태가 아니므로 zustand 내부에 두지 않는다.
// single-flight: 매 호출마다 기존 타이머를 clearTimeout 후 재시작한다.
// @MX:SPEC: SPEC-UI-005
let statusMessageTimer: ReturnType<typeof setTimeout> | null = null;

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
  /** 현재 Editor/Preview 표시 모드 — 'split'(기본) | 'editor' | 'preview' (SPEC-UI-004) */
  viewMode: ViewMode;
  /**
   * 트랜지언트 상태 메시지 (SPEC-UI-005). null 이면 Footer 에 미표시.
   * 복사 성공/실패 등 짧은 피드백 용도. 영속화 대상 아님 (partialize 제외).
   */
  statusMessage: string | null;
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
  /** Editor/Preview 표시 모드를 설정한다 (SPEC-UI-004) */
  setViewMode: (mode: ViewMode) => void;
  /**
   * 트랜지언트 상태 메시지를 설정한다 (SPEC-UI-005).
   * non-null 호출 시 약 2000ms 후 자동 null 타이머 시작 (single-flight).
   * null 호출 시 보류 타이머 취소 + 즉시 null.
   */
  setStatusMessage: (message: string | null) => void;
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
      viewMode: 'split',
      statusMessage: null,
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
      setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
      // @MX:NOTE: [AUTO] single-flight 타이머 액션 (SPEC-UI-005).
      // 매 호출마다 기존 타이머를 clearTimeout 후, non-null 인 경우 2000ms 타이머 재시작.
      // module-level ref 를 써서 컴포넌트 unmount 와 무관하게 동작.
      // @MX:SPEC: SPEC-UI-005
      setStatusMessage: (message: string | null) => {
        if (statusMessageTimer !== null) {
          clearTimeout(statusMessageTimer);
          statusMessageTimer = null;
        }
        set({ statusMessage: message });
        if (message !== null) {
          statusMessageTimer = setTimeout(() => {
            set({ statusMessage: null });
            statusMessageTimer = null;
          }, 2000);
        }
      },
    }),
    {
      name: 'mdedit-ui-store',
      // statusMessage 는 트랜지언트 값이므로 영속화에서 제외 (앱 재시작 시 잔류 방지, SPEC-UI-005)
      partialize: (state) => {
        const { statusMessage, ...rest } = state;
        return rest;
      },
    }
  )
);
