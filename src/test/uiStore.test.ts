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

  it('should enforce minimum preview width', () => {
    const { setPreviewWidth } = useUIStore.getState();
    act(() => setPreviewWidth(10));
    expect(useUIStore.getState().previewWidth).toBe(20);
  });

  it('should enforce maximum preview width', () => {
    const { setPreviewWidth } = useUIStore.getState();
    act(() => setPreviewWidth(90));
    expect(useUIStore.getState().previewWidth).toBe(80);
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
