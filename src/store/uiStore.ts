import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HTML_ZOOM_DEFAULT, snapToStep, stepUp, stepDown } from '@/lib/preview/htmlZoom';

// @MX:ANCHOR: [AUTO] useUIStore - persisted UI state store consumed by AppLayout, Header, ResizablePanels, Footer, useTheme, ViewModeToggle
// @MX:REASON: [AUTO] Public API boundary for all UI state (theme, sidebar, panels, save status, viewMode, statusMessage, htmlZoom); fan_in >= 5; SPEC-UI-004 viewMode 추가, SPEC-UI-005 statusMessage 추가, SPEC-PREVIEW-018 htmlZoom 추가, SPEC-PREVIEW-019 htmlRenderMode 추가
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

// HTML 미리보기 렌더 모드: 'crisp'(srcdoc, 선명한 확대) | 'original'(asset iframe, 018 동작) (SPEC-PREVIEW-019)
export type HtmlRenderMode = 'crisp' | 'original';

/** 허용 밖 값은 기본값 'crisp'으로 정규화한다. */
function normalizeHtmlRenderMode(v: unknown): HtmlRenderMode {
  return v === 'original' ? 'original' : 'crisp';
}

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
  /**
   * HTML 미리보기 배율(%) — 모든 HTML 파일에 공통인 단계 값 하나 (SPEC-PREVIEW-018 REQ-006).
   * fontSize와 독립이다. 영속화 대상.
   */
  htmlZoom: number;
  /** HTML 미리보기 렌더 모드 — 모든 HTML 파일에 공통, 영속 (SPEC-PREVIEW-019). */
  htmlRenderMode: HtmlRenderMode;
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
  /** AI 데이터 전송 고지 배너를 한 번 확인했는지 (SPEC-AI-001 REQ-AI-013). 영속화 대상. */
  aiNoticeAcknowledged: boolean;
  /** AI "고급 모델" 토글 — true 면 sonnet, false 면 haiku (SPEC-AI-001 REQ-AI-016). 영속화 대상. */
  aiAdvancedModel: boolean;
  /**
   * 이어쓰기(continue) 길이 옵션 — 'short'(한두 문장) | 'normal'(기본, 기존 분량 유지)
   * (SPEC-AI-006 REQ-AI6-012). 최초값(미설정 사용자)은 'normal'. 영속화 대상.
   */
  aiContinueLength: 'short' | 'normal';
  /**
   * AI 기능 사용자 켜기/끄기 토글 — 꺼지면 ✨ 툴바·힌트·Mod+Enter 신규 트리거가 전부 숨겨진다
   * (SPEC-AI-005 REQ-AI5-001). 최초값(미설정 사용자)은 켜짐(true). 영속화 대상.
   */
  aiEnabled: boolean;
  /**
   * AI provider 선택 (SPEC-AI-009 REQ-AI9-003) — 'auto'(기본, 백엔드 자동 감지 claude>codex)
   * | 'claude' | 'codex'. aiEnabled 토글과 독립적으로 동작하며, 정책 잠금 시 드롭다운이 비활성된다.
   * 영속화 대상 — 사용자가 한 번 고른 provider 는 앱 재시작 후에도 유지되어야 한다.
   */
  aiSelectedProvider: 'auto' | 'claude' | 'codex';
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
  /** AI 고지 배너 확인 여부를 설정한다 (SPEC-AI-001 REQ-AI-013). */
  setAiNoticeAcknowledged: (acknowledged: boolean) => void;
  /** AI 고급 모델(sonnet) 사용 여부를 설정한다 (SPEC-AI-001 REQ-AI-016). */
  setAiAdvancedModel: (enabled: boolean) => void;
  /** 이어쓰기 길이 옵션을 설정한다 (SPEC-AI-006 REQ-AI6-012). */
  setAiContinueLength: (length: 'short' | 'normal') => void;
  /** AI 기능 사용자 켜기/끄기 토글을 설정한다 (SPEC-AI-005 REQ-AI5-001/006). */
  setAiEnabled: (enabled: boolean) => void;
  /** AI provider 선택을 설정한다 (SPEC-AI-009 REQ-AI9-003). */
  setAiSelectedProvider: (provider: 'auto' | 'claude' | 'codex') => void;
  /** HTML 배율을 설정한다. 단계 값으로 맞춘다 (SPEC-PREVIEW-018). */
  setHtmlZoom: (zoom: number) => void;
  /** HTML 배율을 한 단계 올리거나('in') 내린다('out'). 경계에서는 그대로 (SPEC-PREVIEW-018). */
  stepHtmlZoom: (dir: 'in' | 'out') => void;
  /** HTML 배율을 100으로 되돌린다 (SPEC-PREVIEW-018). */
  resetHtmlZoom: () => void;
  /** HTML 렌더 모드를 설정한다. 허용 밖 값은 'crisp' (SPEC-PREVIEW-019). */
  setHtmlRenderMode: (mode: HtmlRenderMode) => void;
}

// @MX:NOTE: [AUTO] sidebarWidth clamped to [180, 600]px; previewWidth 는 퍼센트로 저장하되 방어적
// 절대 경계 [0, 100]% 만 강제한다(BUG-1). 실질 최소 패널 폭은 px 기준(MIN_PANE_PX)이며,
// 컨테이너 폭을 아는 드래그 지점(ResizablePanels.clampPreviewPercent)에서 적용한다 —
// 여기에 퍼센트 하한을 두면 그 값이 곧 반대쪽 패널의 상한이 되어 넓은 창에서 스플리터가 멈춘다.
// @MX:ANCHOR: [AUTO] Central UI state store - persisted to localStorage via zustand persist middleware
// @MX:REASON: [AUTO] Public API boundary - used by AppLayout, Header, ResizablePanels, useTheme, Footer (fan_in >= 5)
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarWidth: 250,
      previewWidth: 50, // percentage
      theme: 'system',
      fontSize: 14,
      htmlZoom: HTML_ZOOM_DEFAULT,
      htmlRenderMode: 'crisp',
      sidebarCollapsed: false,
      saveStatus: 'new',
      scrollSyncEnabled: true,
      lastWatchedPath: null,
      imageInsertMode: 'inline-blob',
      viewMode: 'split',
      statusMessage: null,
      aiNoticeAcknowledged: false,
      aiAdvancedModel: false,
      aiContinueLength: 'normal',
      aiEnabled: true,
      aiSelectedProvider: 'auto',
      setSidebarWidth: (width: number) =>
        set({ sidebarWidth: Math.max(180, Math.min(600, width)) }),
      // 비정상 입력(NaN/Infinity)은 상태를 오염시키지 않도록 무시한다.
      setPreviewWidth: (width: number) =>
        set((state) =>
          Number.isFinite(width)
            ? { previewWidth: Math.max(0, Math.min(100, width)) }
            : state
        ),
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
      setAiNoticeAcknowledged: (acknowledged: boolean) => set({ aiNoticeAcknowledged: acknowledged }),
      setAiAdvancedModel: (enabled: boolean) => set({ aiAdvancedModel: enabled }),
      setAiContinueLength: (length: 'short' | 'normal') => set({ aiContinueLength: length }),
      setAiEnabled: (enabled: boolean) => set({ aiEnabled: enabled }),
      setAiSelectedProvider: (provider: 'auto' | 'claude' | 'codex') =>
        set({ aiSelectedProvider: provider }),
      setHtmlZoom: (zoom: number) => set({ htmlZoom: snapToStep(zoom) }),
      stepHtmlZoom: (dir: 'in' | 'out') =>
        set((state) => ({
          htmlZoom: dir === 'in' ? stepUp(state.htmlZoom) : stepDown(state.htmlZoom),
        })),
      resetHtmlZoom: () => set({ htmlZoom: HTML_ZOOM_DEFAULT }),
      setHtmlRenderMode: (mode: HtmlRenderMode) =>
        set({ htmlRenderMode: normalizeHtmlRenderMode(mode) }),
    }),
    {
      name: 'mdedit-ui-store',
      // SPEC-FS-003 (REQ-008): saveStatus는 표시 전용 트랜지언트 값이므로 영속화에서 제외.
      //   가드 판정은 editorStore.dirty만 읽는다(REQ-007). 영속화하면 앱 재시작 시 stale
      //   'unsaved'가 빈 버퍼에 복원되어 결함 B가 해소되지 않는다.
      //   statusMessage도 트랜지언트(SPEC-UI-005)이므로 함께 제외.
      version: 1,
      partialize: (state) => {
        const { statusMessage, saveStatus, ...rest } = state;
        return rest;
      },
      // SPEC-PREVIEW-018 (REQ-006): htmlZoom 필드 추가는 version 범프가 필요 없다 — persist는
      //   저장 상태를 초기 상태 위에 얕게 합치므로 필드가 없으면 초기값 100이 남는다. 단계 밖 값·
      //   비숫자 값(문자열 등)의 정규화만 merge에서 snapToStep으로 처리한다.
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<UIState>;
        return {
          ...currentState,
          ...persisted,
          htmlZoom: snapToStep(persisted.htmlZoom),
          // SPEC-PREVIEW-019: 필드 없음·허용 밖 값은 'crisp'으로 정규화(version 범프 불필요).
          htmlRenderMode: normalizeHtmlRenderMode(persisted.htmlRenderMode),
        };
      },
      // V2(SPEC-FS-003): version 0→1 마이그레이션. 기존 사용자 localStorage에 잔류한 stale
      //   saveStatus를 제거한다(나머지 환경설정 보존). version 미지정(0) 상태에서 범프.
      migrate: (persistedState, version) => {
        if (version < 1 && persistedState && typeof persistedState === 'object') {
          const { saveStatus: _drop, ...rest } = persistedState as Record<string, unknown>;
          void _drop;
          return rest;
        }
        return persistedState;
      },
    }
  )
);
