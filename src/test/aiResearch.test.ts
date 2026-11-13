// @MX:SPEC: SPEC-AI-016 REQ-AI16-001 REQ-AI16-004 REQ-AI16-010 REQ-AI16-011 REQ-AI16-012 REQ-AI16-013
// AC-AI16-001/004/010/011/012(카드)/013(TS) — 리서치 프리셋의 프런트 계약.
// TDD RED: 구현(ai-length-guard·toolbar·waitNotice·router·card) 전에 작성했다.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  WAIT_NOTICE_DELAY_MS,
  WAIT_NOTICE_TEXT,
  backendWatchdogTimeoutMs,
  frontendBackstopDelayMs,
} from '@/lib/ai/waitNotice';
import * as waitNotice from '@/lib/ai/waitNotice';
import codexLive from './fixtures/research/codex-research-live.json';
import claudeCanonical from './fixtures/research/claude-research-canonical.json';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...a: unknown[]) => aiRequestMock(...a),
  aiCancel: (...a: unknown[]) => aiCancelMock(...a),
  ipcErrorMessage: (e: unknown) => String(e),
}));

type EventHandler = (event: { payload: unknown }) => void;
const listeners: Record<string, EventHandler> = {};
vi.mock('@tauri-apps/api/event', () => ({
  listen: async (name: string, handler: EventHandler) => {
    listeners[name] = handler;
    return () => {
      delete listeners[name];
    };
  },
}));

import {
  createAiSuggestionCard,
  startSuggestionCard,
  clearCardRegistry,
  setActiveEditorView,
  deriveCardActions,
} from '@/components/editor/extensions/ai-suggestion-card';
import {
  buildPresetMenuItems,
  buildSelectionRequest,
  evaluateMenuNotice,
} from '@/components/editor/extensions/ai-selection-toolbar';
import { evaluateSelectionGuard } from '@/components/editor/extensions/ai-length-guard';
import { dispatchAiResearch } from '@/lib/ai/aiEventRouter';
import { useAiStore } from '@/store/aiStore';
import { useAiRelay } from '@/hooks/useAiRelay';

// ---------------- AC-AI16-001 ----------------
describe('AC-AI16-001: 메뉴 항목', () => {
  it('종류 순서와 라벨', () => {
    const items = buildPresetMenuItems(100);
    expect(items.map((i) => i.kind)).toEqual([
      'polish', 'outline', 'table', 'diagram', 'shorten', 'research', 'custom',
    ]);
    expect(items.find((i) => i.kind === 'research')?.label).toBe('🔎 리서치');
    expect(items[items.length - 1].kind).toBe('custom');
  });

  it('요청 인자: feature inline-edit, presetKind research, 키 목록은 polish 와 같다', () => {
    const base = {
      requestId: 'r1',
      selection: 'hello',
      contextBefore: '',
      contextAfter: '',
      models: { claude: 'haiku', codex: null },
    };
    const r = buildSelectionRequest({ ...base, presetKind: 'research' });
    const p = buildSelectionRequest({ ...base, presetKind: 'polish' });
    expect(r.args.feature).toBe('inline-edit');
    expect(r.args.presetKind).toBe('research');
    expect(Object.keys(r.args).sort()).toEqual(Object.keys(p.args).sort());
  });
});

// ---------------- AC-AI16-004 ----------------
describe('AC-AI16-004: 길이 한도', () => {
  it('6000 자는 허용', () => {
    expect(evaluateSelectionGuard(6000, 'research')).toEqual({ allowed: true, insertOnly: false });
  });
  it('6001 자는 막고 계열 이름과 6,000자를 안내', () => {
    const g = evaluateSelectionGuard(6001, 'research');
    expect(g.allowed).toBe(false);
    expect(g.reason).toContain('다듬기·직접 입력·리서치는');
    expect(g.reason).toContain('6,000자');
  });
  it('메뉴 안내 문구에도 계열 이름이 들어간다', () => {
    expect(evaluateMenuNotice(6001)?.text).toContain('다듬기·직접 입력·리서치는');
  });
});

// ---------------- AC-AI16-013 (TS) ----------------
describe('AC-AI16-013(TS): 대기 한도', () => {
  it('상수는 Rust RESEARCH_WATCHDOG_SECS=180 과 짝이다(180초/185초)', () => {
    expect(waitNotice.RESEARCH_WATCHDOG_MS).toBe(180_000);
    expect(waitNotice.researchBackstopDelayMs()).toBe(185_000);
  });
  it('8초 < 180초 < 185초', () => {
    expect(WAIT_NOTICE_DELAY_MS).toBeLessThan(waitNotice.RESEARCH_WATCHDOG_MS);
    expect(waitNotice.RESEARCH_WATCHDOG_MS).toBeLessThan(waitNotice.researchBackstopDelayMs());
  });
  it('리서치가 아닌 요청 공식은 그대로', () => {
    expect(frontendBackstopDelayMs(0)).toBe(backendWatchdogTimeoutMs(0) + 5000);
  });
});

// ---------------- AC-AI16-011: 순수 ----------------
describe('AC-AI16-011: deriveCardActions', () => {
  it('research 는 insert-below 하나(insertOnly 와 무관)', () => {
    expect(deriveCardActions('research', false)).toEqual({ modes: ['insert-below'], primary: 'insert-below' });
    expect(deriveCardActions('research', true)).toEqual({ modes: ['insert-below'], primary: 'insert-below' });
  });
  it('다른 프리셋은 그대로', () => {
    expect(deriveCardActions('polish', false).modes).toEqual(['replace', 'insert-below']);
  });
});

// ---------------- 카드 통합 ----------------
describe('리서치 카드', () => {
  let view: EditorView;

  beforeEach(() => {
    vi.useFakeTimers();
    clearCardRegistry();
    useAiStore.setState({ requestState: 'idle', streamBuffer: '', requestId: null, errorInfo: null });
    aiRequestMock.mockClear();
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    view = new EditorView({
      state: EditorState.create({ doc: 'hello world', extensions: [createAiSuggestionCard()] }),
      parent,
    });
  });

  afterEach(() => {
    view.destroy();
    setActiveEditorView(null);
    clearCardRegistry();
    document.body.innerHTML = '';
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function start(presetKind: string, selection = 'hello', requestId = 'rs-1') {
    return startSuggestionCard({
      args: {
        requestId,
        feature: 'inline-edit',
        presetKind,
        models: { claude: 'haiku', codex: null },
        selection,
        contextBefore: '',
        contextAfter: '',
      },
      insertOnly: false,
      range: { from: 0, to: 5 },
      originalText: selection,
    });
  }
  const text = (): string => view.dom.querySelector('.mdedit-ai-card')?.textContent ?? '';
  const modes = (): string[] =>
    [...view.dom.querySelectorAll<HTMLElement>('.mdedit-ai-apply')].map((b) => b.dataset.mode ?? '');

  describe('AC-AI16-010: 진행 문구', () => {
    it('활동 없음 → 웹에서 찾는 중…, 8초 후에도 대기 안내는 없다', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      start('research');
      expect(text()).toContain('웹에서 찾는 중…');
      vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS);
      expect(text()).toContain('웹에서 찾는 중…');
      expect(text()).not.toContain(WAIT_NOTICE_TEXT);
    });

    it('활동 수신 후 → 검색 2회 · 페이지 2개 열어 봄 (스토어 슬롯을 가진 경우)', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      start('research');
      dispatchAiResearch('rs-1', { searches: 2, opened: ['https://a.b/1', 'https://a.b/2'] });
      expect(text()).toContain('검색 2회 · 페이지 2개 열어 봄');
      expect(text()).not.toContain('웹에서 찾는 중…');
    });

    it('스토어 슬롯이 다른 요청이어도 라우터 경로로 갱신된다', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'other', streamBuffer: '' });
      start('research');
      dispatchAiResearch('rs-1', { searches: 1, opened: [] });
      expect(text()).toContain('검색 1회 · 페이지 0개 열어 봄');
    });

    it('다른 requestId 의 활동은 무시한다', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      start('research');
      dispatchAiResearch('zzz', { searches: 5, opened: [] });
      expect(text()).toContain('웹에서 찾는 중…');
    });

    it('리서치가 아닌 카드는 그대로(8초 후 대기 안내, 진행 문구 없음)', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      start('polish');
      expect(text()).not.toContain('웹에서 찾는 중…');
      vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS);
      expect(text()).toContain(WAIT_NOTICE_TEXT);
    });

    it('재요청하면 활동 상태가 초기화된다', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      const c = start('research');
      dispatchAiResearch('rs-1', { searches: 2, opened: ['https://a.b/1'] });
      c.enterReRequest();
      expect(text()).toContain('웹에서 찾는 중…');
    });
  });

  describe('AC-AI16-011: 삽입 전용, 완결 안내 없음', () => {
    it.each([
      ['100자·complete', 100, 'complete'],
      ['3000자·unknown', 3000, 'unknown'],
      ['3000자·cutoff', 3000, 'cutoff'],
    ] as const)('%s', (_n, len, completion) => {
      const sel = 'x'.repeat(len);
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      const c = start('research', sel);
      c.onComplete('결과 본문', { completion });
      expect(modes()).toEqual(['insert-below']);
      expect(c.getRenderInput().completionNotice).toBeUndefined();
      expect(view.dom.querySelector('.mdedit-ai-completion-notice')).toBeNull();
    });

    it('다른 프리셋의 완결 안내는 그대로 남는다', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      const c = start('polish', 'x'.repeat(3000));
      c.onComplete('결과', { completion: 'unknown' });
      expect(modes()).toEqual(['insert-below']);
      expect(c.getRenderInput().completionNotice).toBeTruthy();
    });
  });

  describe('AC-AI16-012: 출처 검증 알림', () => {
    it('열어 본 기록이 없는 주소가 있으면 한 줄을 보이고 삽입은 활성이다', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      const c = start('research');
      dispatchAiResearch('rs-1', { searches: codexLive.opened.length, opened: codexLive.opened });
      c.onComplete(codexLive.text, { completion: 'unknown' });
      expect(text()).toContain(
        'AI가 직접 열어 확인한 기록이 없는 출처: https://v2.tauri.app/security/capabilities/',
      );
      const btn = view.dom.querySelector<HTMLButtonElement>('.mdedit-ai-apply[data-mode="insert-below"]');
      expect(btn).not.toBeNull();
      expect(btn!.disabled).toBe(false);
      expect(view.dom.querySelector('.mdedit-ai-suggestion')?.textContent).toBe(codexLive.text);
    });

    it('모두 열어 봤으면 줄이 없다', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      const c = start('research');
      dispatchAiResearch('rs-1', { searches: 2, opened: claudeCanonical.opened });
      c.onComplete(claudeCanonical.text, { completion: 'complete' });
      expect(text()).not.toContain('기록이 없는 출처');
    });

    it('리서치가 아닌 카드에는 줄이 없다', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      const c = start('polish');
      c.onComplete(codexLive.text, { completion: 'complete' });
      expect(text()).not.toContain('기록이 없는 출처');
    });
  });

  describe('AC-AI16-013(TS): 백스톱 185초', () => {
    it('리서치 카드는 184.9초에 살아 있고 185초에 error 가 된다', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      const c = start('research', 'x'.repeat(6000));
      vi.advanceTimersByTime(184_999);
      expect(c.getState().phase).toBe('streaming');
      vi.advanceTimersByTime(1);
      expect(c.getState().phase).toBe('error');
    });
    it('선택 0자도 185초', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'rs-1', streamBuffer: '' });
      const c = start('research', '');
      vi.advanceTimersByTime(184_999);
      expect(c.getState().phase).toBe('streaming');
      vi.advanceTimersByTime(1);
      expect(c.getState().phase).toBe('error');
    });
  });
});

// ---------------- useAiRelay: ai://research ----------------
describe('useAiRelay: ai://research', () => {
  it('리스너를 등록하고 라우터로만 보낸다(스토어 불변)', async () => {
    vi.useRealTimers();
    clearCardRegistry();
    useAiStore.setState({ requestState: 'streaming', requestId: 'rl-1', streamBuffer: '' });
    const before = useAiStore.getState();
    renderHook(() => useAiRelay());
    await new Promise((r) => setTimeout(r, 0));
    expect(listeners['ai://research']).toBeTypeOf('function');
    const seen = vi.fn();
    const { subscribeAiEvents } = await import('@/lib/ai/aiEventRouter');
    const off = subscribeAiEvents(() => 'rl-1', { onResearch: seen });
    listeners['ai://research']({ payload: { requestId: 'rl-1', searches: 3, opened: ['https://a.b/'] } });
    expect(seen).toHaveBeenCalledWith({ searches: 3, opened: ['https://a.b/'] });
    expect(useAiStore.getState()).toBe(before);
    off();
  });
});
