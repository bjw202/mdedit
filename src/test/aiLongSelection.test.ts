// @MX:SPEC: SPEC-AI-013 REQ-AI13-005 REQ-AI13-006 REQ-AI13-007 REQ-AI13-010 REQ-AI13-013 REQ-AI13-014 REQ-AI13-015
// AC-AI13-005/006/010/011/012 — 크기 비례 대기 한도(공유 표), 긴 선택 카드의 백스톱 시점,
// 완결 신호(completion) 두 경로 전달과 「바꾸기」 제거 규칙.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import timeoutTable from '../../src-tauri/tests/fixtures/ai-timeout-table.json';
import {
  WAIT_NOTICE_DELAY_MS,
  backendWatchdogTimeoutMs,
  frontendBackstopDelayMs,
  BACKSTOP_ERROR_TEXT,
} from '@/lib/ai/waitNotice';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...args: unknown[]) => aiRequestMock(...args),
  aiCancel: (...args: unknown[]) => aiCancelMock(...args),
  ipcErrorMessage: (reason: unknown) => (typeof reason === 'string' ? reason : 'error'),
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
  applyCompletionToActions,
  deriveCardActions,
  type AiSuggestionCardController,
  type StartCardRequest,
} from '@/components/editor/extensions/ai-suggestion-card';
import { useAiStore, idleSlice } from '@/store/aiStore';
import { useAiRelay } from '@/hooks/useAiRelay';
import { SAFE_REPLACE_LIMIT } from '@/components/editor/extensions/ai-length-guard';
import { buildSelectionRequest } from '@/components/editor/extensions/ai-selection-toolbar';

function emit(channel: string, payload: unknown): void {
  const handler = listeners[channel];
  if (!handler) throw new Error(`no listener registered for ${channel}`);
  handler({ payload });
}

interface TableRow {
  label: string;
  unit: string;
  count: number;
  suffix: string;
  expectedSecs: number;
}

// ============================================================
// AC-AI13-005 — TS 대기 한도 = 공유 표
// ============================================================

describe('AC-AI13-005: 대기 한도 공식이 공유 표와 일치한다', () => {
  const rows = timeoutTable.rows as TableRow[];

  it('공유 표에 최소 9행이 있다', () => {
    expect(rows.length).toBeGreaterThanOrEqual(9);
  });

  for (const row of rows) {
    it(`${row.label}: 워치독·백스톱·순서`, () => {
      const input = row.unit.repeat(row.count) + row.suffix;
      const n = input.length; // UTF-16 단위
      expect(backendWatchdogTimeoutMs(n)).toBe(row.expectedSecs * 1000);
      expect(frontendBackstopDelayMs(n)).toBe(row.expectedSecs * 1000 + 5000);
      expect(WAIT_NOTICE_DELAY_MS).toBe(8000);
      expect(WAIT_NOTICE_DELAY_MS).toBeLessThan(backendWatchdogTimeoutMs(n));
      expect(backendWatchdogTimeoutMs(n)).toBeLessThan(frontendBackstopDelayMs(n));
    });
  }
});

// ============================================================
// applyCompletionToActions (순수)
// ============================================================

describe('applyCompletionToActions: 「바꾸기」 제거 판정(순수)', () => {
  const full = deriveCardActions('polish', false);

  it('500자 + unknown → 현행과 같다(바꾸기 유지, 이유 없음)', () => {
    const r = applyCompletionToActions(full, { selectionLength: 500, completion: 'unknown', guardInsertOnly: false });
    expect(r.actions).toEqual(full);
    expect(r.reason).toBeUndefined();
  });

  it('500자 + cutoff → 삽입만 + 잘림 문구', () => {
    const r = applyCompletionToActions(full, { selectionLength: 500, completion: 'cutoff', guardInsertOnly: false });
    expect(r.actions.modes).toEqual(['insert-below']);
    expect(r.actions.primary).toBe('insert-below');
    expect(r.reason).toBe('응답이 중간에 끊겨서 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요');
  });

  it('2001자 + unknown → 삽입만 + 미확인 문구', () => {
    const r = applyCompletionToActions(full, { selectionLength: SAFE_REPLACE_LIMIT + 1, completion: 'unknown', guardInsertOnly: false });
    expect(r.actions.modes).toEqual(['insert-below']);
    expect(r.reason).toBe('응답이 끝까지 왔는지 확인할 수 없어 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요');
  });

  it('2001자 + complete → 현행과 같다', () => {
    const r = applyCompletionToActions(full, { selectionLength: 2001, completion: 'complete', guardInsertOnly: false });
    expect(r.actions).toEqual(full);
    expect(r.reason).toBeUndefined();
  });

  it('가드가 이미 삽입 전용이면 이유 문구가 없다', () => {
    const only = deriveCardActions('outline', true);
    const r = applyCompletionToActions(only, { selectionLength: 7000, completion: 'unknown', guardInsertOnly: true });
    expect(r.actions.modes).toEqual(['insert-below']);
    expect(r.reason).toBeUndefined();
  });
});

// ============================================================
// 카드 통합(릴레이 → 스토어 → 카드, 라우터)
// ============================================================

function makeRequest(
  requestId: string,
  selection: string,
  presetKind = 'polish',
  insertOnly = false,
): StartCardRequest {
  return {
    args: {
      requestId,
      feature: 'inline-edit',
      presetKind,
      models: { claude: 'haiku', codex: null },
      selection,
      contextBefore: '',
      contextAfter: '',
    },
    insertOnly,
    range: { from: 0, to: selection.length },
    originalText: selection,
  };
}

describe('SPEC-AI-013 카드 통합', () => {
  let view: EditorView;

  beforeEach(async () => {
    vi.useFakeTimers();
    aiRequestMock.mockClear();
    aiCancelMock.mockClear();
    for (const k of Object.keys(listeners)) delete listeners[k];
    clearCardRegistry();
    useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    view = new EditorView({
      state: EditorState.create({ doc: 'x', extensions: [createAiSuggestionCard()] }),
      parent,
    });
    setActiveEditorView(view);
    renderHook(() => useAiRelay());
    await vi.advanceTimersByTimeAsync(0);
  });

  afterEach(() => {
    view.destroy();
    setActiveEditorView(null);
    clearCardRegistry();
    document.body.innerHTML = '';
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const modes = (): string[] =>
    [...view.dom.querySelectorAll<HTMLElement>('.mdedit-ai-apply')].map((b) => b.dataset.mode ?? '');
  const primary = (): string | undefined =>
    view.dom.querySelector<HTMLElement>('.mdedit-ai-apply.is-primary')?.dataset.mode;
  const reasonText = (): string | undefined =>
    view.dom.querySelector('.mdedit-ai-completion-notice')?.textContent ?? undefined;

  // ---- AC-AI13-006 ----
  describe('AC-AI13-006: 6,000자 선택 백스톱 시점', () => {
    it('65초에는 streaming, 113초(108+5)에 백스톱 오류; 재요청도 같은 규칙', () => {
      const sel = '가'.repeat(6000);
      const c: AiSuggestionCardController = startSuggestionCard(makeRequest('long-1', sel));
      useAiStore.getState().startRequest('long-1', 'inline-edit');

      vi.advanceTimersByTime(65_000);
      expect(c.getState().phase).toBe('streaming');
      vi.advanceTimersByTime(47_999);
      expect(c.getState().phase).toBe('streaming');
      vi.advanceTimersByTime(1);
      expect(c.getState().phase).toBe('error');
      expect(c.getState().errorMessage).toBe(BACKSTOP_ERROR_TEXT);

      // 오류 카드의 [다시 시도](exempt 재요청) → 같은 규칙으로 재무장
      c.getRenderInput().callbacks.onReRequest('', 'exempt');
      expect(c.getState().phase).toBe('streaming');
      vi.advanceTimersByTime(112_999);
      expect(c.getState().phase).toBe('streaming');
      vi.advanceTimersByTime(1);
      expect(c.getState().phase).toBe('error');
    });
  });

  // ---- AC-AI13-010 ----
  describe('AC-AI13-010: 정상 경로(릴레이 → 스토어 → 카드 구독)', () => {
    it('3,000자 + unknown → 삽입만 + 미확인 문구', () => {
      const sel = '가'.repeat(3000);
      startSuggestionCard(makeRequest('n-1', sel));
      useAiStore.getState().startRequest('n-1', 'inline-edit');
      emit('ai://done', { requestId: 'n-1', result: '다듬은 결과', completion: 'unknown' });
      expect(modes()).toEqual(['insert-below']);
      expect(reasonText()).toBe(
        '응답이 끝까지 왔는지 확인할 수 없어 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요',
      );
    });

    it('3,000자 + complete → 바꾸기+삽입, 바꾸기 강조, 이유 없음', () => {
      const sel = '가'.repeat(3000);
      startSuggestionCard(makeRequest('n-2', sel));
      useAiStore.getState().startRequest('n-2', 'inline-edit');
      emit('ai://done', { requestId: 'n-2', result: '다듬은 결과', completion: 'complete' });
      expect(modes()).toEqual(['replace', 'insert-below']);
      expect(primary()).toBe('replace');
      expect(reasonText()).toBeUndefined();
    });
  });

  // ---- AC-AI13-011 ----
  describe('AC-AI13-011: 라우터 경로(슬롯을 잃은 카드)', () => {
    it('카드 A 가 슬롯을 잃은 뒤 cutoff done → 삽입만 + 잘림 문구', () => {
      const a = startSuggestionCard(makeRequest('r-A', '가'.repeat(500)));
      useAiStore.getState().startRequest('r-A', 'inline-edit');
      // 카드 B 의 요청이 슬롯을 가져간다.
      startSuggestionCard(makeRequest('r-B', '나'.repeat(10)));
      useAiStore.getState().startRequest('r-B', 'inline-edit');
      expect(useAiStore.getState().requestId).toBe('r-B');

      emit('ai://done', { requestId: 'r-A', result: '잘린 결과', completion: 'cutoff' });
      expect(a.getState().phase).toBe('done');
      const aCard = view.dom.querySelectorAll('.mdedit-ai-card')[0] as HTMLElement;
      const aModes = [...aCard.querySelectorAll<HTMLElement>('.mdedit-ai-apply')].map((b) => b.dataset.mode);
      expect(aModes).toEqual(['insert-below']);
      expect(aCard.querySelector('.mdedit-ai-completion-notice')?.textContent).toBe(
        '응답이 중간에 끊겨서 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요',
      );
    });
  });

  // ---- AC-AI13-012 ----
  describe('AC-AI13-012: 회귀 없음과 경계', () => {
    it('500자 + unknown/필드 없음 → 현행(다듬기: 바꾸기 강조 + 삽입, 이유 없음)', () => {
      startSuggestionCard(makeRequest('g-1', '가'.repeat(500)));
      useAiStore.getState().startRequest('g-1', 'inline-edit');
      emit('ai://done', { requestId: 'g-1', result: '결과', completion: 'unknown' });
      expect(modes()).toEqual(['replace', 'insert-below']);
      expect(primary()).toBe('replace');
      expect(reasonText()).toBeUndefined();

      clearCardRegistry();
      startSuggestionCard(makeRequest('g-2', '가'.repeat(500)));
      useAiStore.getState().startRequest('g-2', 'inline-edit');
      emit('ai://done', { requestId: 'g-2', result: '결과' }); // completion 필드 없음
      expect(modes()).toEqual(['replace', 'insert-below']);
      expect(reasonText()).toBeUndefined();
    });

    it('500자 표 프리셋 + unknown → 삽입 강조 + 바꾸기(현행)', () => {
      startSuggestionCard(makeRequest('g-3', '가'.repeat(500), 'table'));
      useAiStore.getState().startRequest('g-3', 'inline-edit');
      emit('ai://done', {
        requestId: 'g-3',
        result: '| a | b |\n| --- | --- |\n| 1 | 2 |',
        completion: 'unknown',
      });
      expect(modes()).toEqual(['replace', 'insert-below']);
      expect(primary()).toBe('insert-below');
      expect(reasonText()).toBeUndefined();
    });

    it('7,000자 개요(가드 insertOnly) + unknown → 삽입만, 이유 문구 없음', () => {
      startSuggestionCard(makeRequest('g-4', '가'.repeat(7000), 'outline', true));
      useAiStore.getState().startRequest('g-4', 'inline-edit');
      emit('ai://done', { requestId: 'g-4', result: '- 개요', completion: 'unknown' });
      expect(modes()).toEqual(['insert-below']);
      expect(reasonText()).toBeUndefined();
    });

    it('2,000자는 현행 그대로, 2,001자는 삽입만 + 미확인 문구', () => {
      startSuggestionCard(makeRequest('b-1', '가'.repeat(2000)));
      useAiStore.getState().startRequest('b-1', 'inline-edit');
      emit('ai://done', { requestId: 'b-1', result: '결과', completion: 'unknown' });
      expect(modes()).toEqual(['replace', 'insert-below']);
      expect(primary()).toBe('replace');
      expect(reasonText()).toBeUndefined();

      clearCardRegistry();
      startSuggestionCard(makeRequest('b-2', '가'.repeat(2001)));
      useAiStore.getState().startRequest('b-2', 'inline-edit');
      emit('ai://done', { requestId: 'b-2', result: '결과', completion: 'unknown' });
      expect(modes()).toEqual(['insert-below']);
      expect(reasonText()).toContain('끝까지 왔는지 확인할 수 없어');
    });

    it('6,000자 선택 요청의 selection 은 원문과 같다(절단 없음)', () => {
      const sel = '가'.repeat(6000);
      const req = buildSelectionRequest({
        requestId: 'x',
        selection: sel,
        contextBefore: '',
        contextAfter: '',
        models: { claude: 'haiku', codex: null },
        presetKind: 'polish',
      });
      expect(req.args.selection).toBe(sel);
      expect(req.args.selection?.length).toBe(6000);
    });
  });
});

describe('REQ-AI13-010: completion 전달 계약', () => {
  it('completeRequest 는 completion 을 슬라이스에 싣고, 생략하면 unknown 이다', () => {
    useAiStore.setState({ ...idleSlice });
    useAiStore.getState().startRequest('c-1', 'inline-edit');
    useAiStore.getState().completeRequest('r', false, 'cutoff');
    expect(useAiStore.getState().completion).toBe('cutoff');
    useAiStore.getState().startRequest('c-2', 'inline-edit');
    expect(useAiStore.getState().completion).toBe('unknown');
    useAiStore.getState().completeRequest('r');
    expect(useAiStore.getState().completion).toBe('unknown');
  });

  it('알 수 없는 completion 값은 unknown 으로 읽는다', async () => {
    const { normalizeCompletion } = await import('@/store/aiStore');
    expect(normalizeCompletion('weird')).toBe('unknown');
    expect(normalizeCompletion(undefined)).toBe('unknown');
    expect(normalizeCompletion('complete')).toBe('complete');
  });
});
