import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from 'react';
import { useUIStore } from '@/store/uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useUIStore.setState({
      sidebarWidth: 250,
      previewWidth: 50,
      theme: 'system',
      fontSize: 14,
      sidebarCollapsed: false,
      saveStatus: 'new',
      scrollSyncEnabled: true,
      viewMode: 'split',
    });
  });

  it('should have default values', () => {
    const state = useUIStore.getState();
    expect(state.sidebarWidth).toBe(250);
    expect(state.previewWidth).toBe(50);
    expect(state.theme).toBe('system');
    expect(state.fontSize).toBe(14);
    expect(state.sidebarCollapsed).toBe(false);
  });

  it('should enforce minimum sidebar width', () => {
    const { setSidebarWidth } = useUIStore.getState();
    act(() => setSidebarWidth(50));
    expect(useUIStore.getState().sidebarWidth).toBe(180);
  });

  it('should enforce maximum sidebar width', () => {
    const { setSidebarWidth } = useUIStore.getState();
    act(() => setSidebarWidth(1000));
    expect(useUIStore.getState().sidebarWidth).toBe(600);
  });

  it('should toggle sidebar', () => {
    const { toggleSidebar } = useUIStore.getState();
    act(() => toggleSidebar());
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    act(() => toggleSidebar());
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('should set theme', () => {
    const { setTheme } = useUIStore.getState();
    act(() => setTheme('dark'));
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('should enforce font size bounds - minimum', () => {
    const { setFontSize } = useUIStore.getState();
    act(() => setFontSize(5));
    expect(useUIStore.getState().fontSize).toBe(10);
  });

  it('should enforce font size bounds - maximum', () => {
    const { setFontSize } = useUIStore.getState();
    act(() => setFontSize(100));
    expect(useUIStore.getState().fontSize).toBe(24);
  });

  // BUG-1: 퍼센트 [20,80] 벽을 걷어냈다. 최소 패널 폭은 px 기준으로 드래그 시점
  // (ResizablePanels.clampPreviewPercent)에서 적용하고, store 는 방어적 절대 경계만 유지한다.
  it('should accept preview widths below the former 20% floor', () => {
    const { setPreviewWidth } = useUIStore.getState();
    act(() => setPreviewWidth(10));
    expect(useUIStore.getState().previewWidth).toBe(10);
  });

  it('should accept preview widths above the former 80% ceiling', () => {
    const { setPreviewWidth } = useUIStore.getState();
    act(() => setPreviewWidth(90));
    expect(useUIStore.getState().previewWidth).toBe(90);
  });

  it('should clamp preview width to the absolute [0, 100] range', () => {
    const { setPreviewWidth } = useUIStore.getState();
    act(() => setPreviewWidth(-5));
    expect(useUIStore.getState().previewWidth).toBe(0);
    act(() => setPreviewWidth(120));
    expect(useUIStore.getState().previewWidth).toBe(100);
  });

  it('should ignore non-finite preview widths', () => {
    const { setPreviewWidth } = useUIStore.getState();
    act(() => setPreviewWidth(42));
    act(() => setPreviewWidth(Number.NaN));
    expect(useUIStore.getState().previewWidth).toBe(42);
    act(() => setPreviewWidth(Number.POSITIVE_INFINITY));
    expect(useUIStore.getState().previewWidth).toBe(42);
  });
});

describe('uiStore: saveStatus', () => {
  beforeEach(() => {
    useUIStore.setState({ saveStatus: 'new' });
  });

  it('should have default saveStatus of "new"', () => {
    const state = useUIStore.getState();
    expect(state.saveStatus).toBe('new');
  });

  it('should set saveStatus to "saving"', () => {
    const { setSaveStatus } = useUIStore.getState();
    act(() => setSaveStatus('saving'));
    expect(useUIStore.getState().saveStatus).toBe('saving');
  });

  it('should set saveStatus to "saved"', () => {
    const { setSaveStatus } = useUIStore.getState();
    act(() => setSaveStatus('saved'));
    expect(useUIStore.getState().saveStatus).toBe('saved');
  });

  it('should set saveStatus to "unsaved"', () => {
    const { setSaveStatus } = useUIStore.getState();
    act(() => setSaveStatus('unsaved'));
    expect(useUIStore.getState().saveStatus).toBe('unsaved');
  });
});

describe('uiStore: imageInsertMode (SPEC-IMG-MODE-001)', () => {
  beforeEach(() => {
    useUIStore.setState({ imageInsertMode: 'inline-blob' });
  });

  it('should have default imageInsertMode of "inline-blob"', () => {
    const state = useUIStore.getState();
    expect(state.imageInsertMode).toBe('inline-blob');
  });

  it('should set imageInsertMode to "file-save"', () => {
    const { setImageInsertMode } = useUIStore.getState();
    act(() => setImageInsertMode('file-save'));
    expect(useUIStore.getState().imageInsertMode).toBe('file-save');
  });

  it('should set imageInsertMode back to "inline-blob"', () => {
    useUIStore.setState({ imageInsertMode: 'file-save' });
    const { setImageInsertMode } = useUIStore.getState();
    act(() => setImageInsertMode('inline-blob'));
    expect(useUIStore.getState().imageInsertMode).toBe('inline-blob');
  });
});

describe('uiStore: viewMode (SPEC-UI-004)', () => {
  beforeEach(() => {
    useUIStore.setState({ viewMode: 'split' });
  });

  it('should have default viewMode of "split"', () => {
    const state = useUIStore.getState();
    expect(state.viewMode).toBe('split');
  });

  it('should set viewMode to "editor"', () => {
    const { setViewMode } = useUIStore.getState();
    act(() => setViewMode('editor'));
    expect(useUIStore.getState().viewMode).toBe('editor');
  });

  it('should set viewMode to "preview"', () => {
    const { setViewMode } = useUIStore.getState();
    act(() => setViewMode('preview'));
    expect(useUIStore.getState().viewMode).toBe('preview');
  });

  it('should set viewMode back to "split"', () => {
    useUIStore.setState({ viewMode: 'preview' });
    const { setViewMode } = useUIStore.getState();
    act(() => setViewMode('split'));
    expect(useUIStore.getState().viewMode).toBe('split');
  });

  it('should persist viewMode change in state (T3)', () => {
    const { setViewMode } = useUIStore.getState();
    act(() => setViewMode('preview'));
    // persist는 zustand persist 미들웨어가 자동으로 localStorage에 직렬화.
    // 단위 테스트에서는 getState()로 값이 반영됐음을 확인하는 것으로 충분.
    expect(useUIStore.getState().viewMode).toBe('preview');
  });
});

describe('uiStore: scrollSyncEnabled', () => {
  beforeEach(() => {
    useUIStore.setState({ scrollSyncEnabled: true });
  });

  it('should have default scrollSyncEnabled as true', () => {
    const state = useUIStore.getState();
    expect(state.scrollSyncEnabled).toBe(true);
  });

  it('should toggle scrollSyncEnabled from true to false', () => {
    const { toggleScrollSync } = useUIStore.getState();
    act(() => toggleScrollSync());
    expect(useUIStore.getState().scrollSyncEnabled).toBe(false);
  });

  it('should toggle scrollSyncEnabled from false to true', () => {
    useUIStore.setState({ scrollSyncEnabled: false });
    const { toggleScrollSync } = useUIStore.getState();
    act(() => toggleScrollSync());
    expect(useUIStore.getState().scrollSyncEnabled).toBe(true);
  });

  it('should set scrollSyncEnabled directly', () => {
    const { setScrollSyncEnabled } = useUIStore.getState();
    act(() => setScrollSyncEnabled(false));
    expect(useUIStore.getState().scrollSyncEnabled).toBe(false);
  });
});

describe('uiStore: aiEnabled (SPEC-AI-005)', () => {
  beforeEach(() => {
    useUIStore.setState({ aiEnabled: true });
    localStorage.removeItem('mdedit-ui-store');
  });

  it('should default aiEnabled to true for an unset user (REQ-AI5-001)', () => {
    expect(useUIStore.getState().aiEnabled).toBe(true);
  });

  it('should set aiEnabled to false via setAiEnabled', () => {
    const { setAiEnabled } = useUIStore.getState();
    act(() => setAiEnabled(false));
    expect(useUIStore.getState().aiEnabled).toBe(false);
  });

  it('should set aiEnabled back to true via setAiEnabled', () => {
    useUIStore.setState({ aiEnabled: false });
    const { setAiEnabled } = useUIStore.getState();
    act(() => setAiEnabled(true));
    expect(useUIStore.getState().aiEnabled).toBe(true);
  });

  it('should persist aiEnabled to localStorage (round-trip, REQ-AI5-002)', () => {
    const { setAiEnabled } = useUIStore.getState();
    act(() => setAiEnabled(false));

    const raw = localStorage.getItem('mdedit-ui-store');
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string);
    expect(persisted.state.aiEnabled).toBe(false);
  });
});

describe('uiStore: aiContinueLength (SPEC-AI-006)', () => {
  beforeEach(() => {
    useUIStore.setState({ aiContinueLength: 'normal' });
    localStorage.removeItem('mdedit-ui-store');
  });

  it('defaults aiContinueLength to "normal" for an unset user (REQ-AI6-012)', () => {
    expect(useUIStore.getState().aiContinueLength).toBe('normal');
  });

  it('sets aiContinueLength to "short" via setAiContinueLength', () => {
    const { setAiContinueLength } = useUIStore.getState();
    act(() => setAiContinueLength('short'));
    expect(useUIStore.getState().aiContinueLength).toBe('short');
  });

  it('sets aiContinueLength back to "normal" via setAiContinueLength', () => {
    useUIStore.setState({ aiContinueLength: 'short' });
    const { setAiContinueLength } = useUIStore.getState();
    act(() => setAiContinueLength('normal'));
    expect(useUIStore.getState().aiContinueLength).toBe('normal');
  });

  it('persists aiContinueLength to localStorage (round-trip)', () => {
    const { setAiContinueLength } = useUIStore.getState();
    act(() => setAiContinueLength('short'));

    const raw = localStorage.getItem('mdedit-ui-store');
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string);
    expect(persisted.state.aiContinueLength).toBe('short');
  });
});

describe('uiStore: aiSelectedProvider (SPEC-AI-009)', () => {
  beforeEach(() => {
    useUIStore.setState({ aiSelectedProvider: 'auto' });
    localStorage.removeItem('mdedit-ui-store');
  });

  it('defaults aiSelectedProvider to "auto" for an unset user (REQ-AI9-003)', () => {
    expect(useUIStore.getState().aiSelectedProvider).toBe('auto');
  });

  it('sets aiSelectedProvider to "claude" via setAiSelectedProvider', () => {
    const { setAiSelectedProvider } = useUIStore.getState();
    act(() => setAiSelectedProvider('claude'));
    expect(useUIStore.getState().aiSelectedProvider).toBe('claude');
  });

  it('sets aiSelectedProvider to "codex" via setAiSelectedProvider', () => {
    const { setAiSelectedProvider } = useUIStore.getState();
    act(() => setAiSelectedProvider('codex'));
    expect(useUIStore.getState().aiSelectedProvider).toBe('codex');
  });

  it('sets aiSelectedProvider back to "auto"', () => {
    useUIStore.setState({ aiSelectedProvider: 'codex' });
    const { setAiSelectedProvider } = useUIStore.getState();
    act(() => setAiSelectedProvider('auto'));
    expect(useUIStore.getState().aiSelectedProvider).toBe('auto');
  });

  it('persists aiSelectedProvider to localStorage (round-trip)', () => {
    const { setAiSelectedProvider } = useUIStore.getState();
    act(() => setAiSelectedProvider('codex'));

    const raw = localStorage.getItem('mdedit-ui-store');
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string);
    expect(persisted.state.aiSelectedProvider).toBe('codex');
  });
});

describe('uiStore: statusMessage (SPEC-UI-005)', () => {
  afterEach(() => {
    // 보류 중인 auto-clear 타이머 정리 (module-level ref 누적 방지)
    useUIStore.getState().setStatusMessage(null);
    vi.clearAllTimers();
    // fake timers 가 describe 블록 밖으로 누수되지 않도록 real timers 로 복원
    vi.useRealTimers();
  });

  beforeEach(() => {
    // 매 테스트마다 fake timers 재활성화 — afterEach 가 real timers 로 복원하기 때문
    vi.useFakeTimers();
    useUIStore.setState({ statusMessage: null });
  });

  it('should set statusMessage to a string value (AC-005 기본)', () => {
    const { setStatusMessage } = useUIStore.getState();
    act(() => setStatusMessage('Copied: /x/y.md'));
    expect(useUIStore.getState().statusMessage).toBe('Copied: /x/y.md');
  });

  it('should have initial statusMessage of null', () => {
    expect(useUIStore.getState().statusMessage).toBeNull();
  });

  it('should auto-clear statusMessage after ~2000ms (AC-016, must-pass)', () => {
    const { setStatusMessage } = useUIStore.getState();
    act(() => setStatusMessage('Copied: x'));
    expect(useUIStore.getState().statusMessage).toBe('Copied: x');

    act(() => { vi.advanceTimersByTime(1999); });
    expect(useUIStore.getState().statusMessage).toBe('Copied: x');

    act(() => { vi.advanceTimersByTime(1); }); // 총 2000ms
    expect(useUIStore.getState().statusMessage).toBeNull();
  });

  it('should single-flight: second message replaces first and resets timer (AC-017)', () => {
    const { setStatusMessage } = useUIStore.getState();
    act(() => setStatusMessage('first'));
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => setStatusMessage('second'));

    expect(useUIStore.getState().statusMessage).toBe('second');

    // 첫 호출 후 총 1999ms — 첫 타이머가 취소됐으므로 여전히 'second'
    act(() => { vi.advanceTimersByTime(999); });
    expect(useUIStore.getState().statusMessage).toBe('second');

    // 두 번째 호출 후 총 1000ms (첫 호출 후 총 2000ms) — 아직 남음 (timer B fires at t=3000)
    act(() => { vi.advanceTimersByTime(1); }); // t=2000
    expect(useUIStore.getState().statusMessage).toBe('second');

    // 두 번째 호출 기준 1999ms (t=2999) — 여전히 'second'
    act(() => { vi.advanceTimersByTime(999); });
    expect(useUIStore.getState().statusMessage).toBe('second');

    // 두 번째 호출 기준 2000ms 도달 (t=3000) → timer B fires → null
    act(() => { vi.advanceTimersByTime(1); });
    expect(useUIStore.getState().statusMessage).toBeNull();
  });

  it('should cancel pending timer and immediately set null on explicit setStatusMessage(null) (AC-018)', () => {
    const { setStatusMessage } = useUIStore.getState();
    act(() => setStatusMessage('first'));
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => setStatusMessage(null));

    expect(useUIStore.getState().statusMessage).toBeNull();

    // 이후 2000ms 을 추가로 진행해도 추가 상태 변화나 타이머 callback 발생 없음
    act(() => { vi.advanceTimersByTime(2000); });
    expect(useUIStore.getState().statusMessage).toBeNull();
  });

  it('should NOT persist statusMessage to localStorage (EC-5 persist exclusion)', () => {
    // partialize 가 statusMessage 를 제외하므로, localStorage 의 스냅샷에 해당 키가 없어야 한다.
    localStorage.removeItem('mdedit-ui-store');
    const { setStatusMessage } = useUIStore.getState();
    act(() => setStatusMessage('should-not-persist'));

    const raw = localStorage.getItem('mdedit-ui-store');
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string);
    // persist 미들웨어는 { state: {...}, version: n } 형태로 저장한다
    expect(persisted.state).not.toHaveProperty('statusMessage');
  });
});

// ---- SPEC-FS-003 T5 (REQ-007/008): saveStatus 비영속화 + 마이그레이션 ----

describe('uiStore: saveStatus 비영속화 + 마이그레이션 (SPEC-FS-003)', () => {
  beforeEach(() => {
    localStorage.removeItem('mdedit-ui-store');
    useUIStore.setState({ saveStatus: 'new' });
  });

  it('partialize 결과에 saveStatus 키가 없다 (REQ-008)', () => {
    const opts = useUIStore.persist.getOptions();
    const partial = opts.partialize!(useUIStore.getState()) as Record<string, unknown>;
    expect(partial).not.toHaveProperty('saveStatus');
  });

  it('saveStatus를 localStorage에 저장하지 않는다 (REQ-008, AC-004)', () => {
    const { setSaveStatus } = useUIStore.getState();
    act(() => setSaveStatus('unsaved'));

    const raw = localStorage.getItem('mdedit-ui-store');
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string);
    expect(persisted.state).not.toHaveProperty('saveStatus');
  });

  it('persist version이 1로 범프되었다 (V2 — 기존 사용자 마이그레이션 트리거)', () => {
    const opts = useUIStore.persist.getOptions();
    expect(opts.version).toBe(1);
  });

  it('migrate가 version<1의 stale saveStatus를 제거하고 다른 필드는 보존한다 (V2, AC-004)', () => {
    const opts = useUIStore.persist.getOptions();
    const oldState = { saveStatus: 'unsaved', theme: 'dark', fontSize: 18 };
    const migrated = opts.migrate!(oldState, 0) as Record<string, unknown>;
    expect(migrated).not.toHaveProperty('saveStatus');
    expect(migrated).toHaveProperty('theme', 'dark');
    expect(migrated).toHaveProperty('fontSize', 18);
  });

  it('migrate는 version>=1의 상태를 그대로 반환한다', () => {
    const opts = useUIStore.persist.getOptions();
    const state = { theme: 'light' };
    const migrated = opts.migrate!(state, 1);
    expect(migrated).toEqual(state);
  });
});
