// @MX:SPEC: SPEC-AI-010 REQ-AI10-012 REQ-AI10-013 REQ-AI10-014
// AC-AI10-007/008 — 카드 A의 재요청이 카드 B의 스트림을 굶기지 않는다 / clearCardRegistry 가
// 모든 컨트롤러의 타이머를 파괴한다.
//
// TDD RED phase(수정 전 작성): 카드 A의 재요청이 `store.startRequest` 로 `aiStore.requestId`
// 를 A' 로 옮기면, 그 순간부터 `useAiRelay.isCurrent(B)` 가 항상 false 가 되어 카드 B의
// chunk·done 이 스토어에 닿기도 전에 폐기된다. 가중 요인으로 `startSuggestionCard` 의
// `activeCardUnsub?.()` 가 직전 카드의 구독을 끊는다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { FRONTEND_BACKSTOP_DELAY_MS } from '@/lib/ai/waitNotice';

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
  getCardControllers,
  setActiveEditorView,
  subscribeActiveCard,
  type AiSuggestionCardController,
  type StartCardRequest,
} from '@/components/editor/extensions/ai-suggestion-card';
import { useAiStore } from '@/store/aiStore';
import { useAiRelay } from '@/hooks/useAiRelay';

function emit(channel: string, payload: unknown): void {
  const handler = listeners[channel];
  if (!handler) throw new Error(`no listener registered for ${channel}`);
  handler({ payload });
}

function makeRequest(requestId: string, from: number, to: number, original: string): StartCardRequest {
  return {
    args: {
      requestId,
      feature: 'inline-edit',
      presetKind: 'polish',
      model: 'haiku',
      selection: original,
      contextBefore: '',
      contextAfter: '',
    },
    insertOnly: false,
    range: { from, to },
    originalText: original,
  };
}

describe('SPEC-AI-010 모듈 2: 카드 공존(이벤트 라우팅)', () => {
  let view: EditorView;

  beforeEach(async () => {
    vi.useFakeTimers();
    aiRequestMock.mockClear();
    aiCancelMock.mockClear();
    for (const k of Object.keys(listeners)) delete listeners[k];
    clearCardRegistry();
    useAiStore.setState({ requestState: 'idle', streamBuffer: '', requestId: null, errorInfo: null });
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    view = new EditorView({
      state: EditorState.create({ doc: 'hello world', extensions: [createAiSuggestionCard()] }),
      parent,
    });
    renderHook(() => useAiRelay());
    // listen() 은 async 이므로 마이크로태스크를 한 번 흘려 등록을 완료시킨다.
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

  /** 카드 A(done, 검토 대기) + 카드 B(streaming) 공존 상태를 만든다. */
  function setupTwoCards(): { a: AiSuggestionCardController; b: AiSuggestionCardController } {
    const a = startSuggestionCard(makeRequest('req-A', 0, 5, 'hello'));
    useAiStore.getState().startRequest('req-A', 'inline-edit');
    emit('ai://done', { requestId: 'req-A', result: 'A의 제안', truncated: false });
    expect(a.getState().phase).toBe('done');

    const b = startSuggestionCard(makeRequest('req-B', 6, 11, 'world'));
    useAiStore.getState().startRequest('req-B', 'inline-edit');
    expect(b.getState().phase).toBe('streaming');
    expect(getCardControllers()).toHaveLength(2);
    return { a, b };
  }

  it('AC-AI10-007: 카드 A 재요청 후에도 카드 B가 자기 청크를 받아 done 으로 종결한다', () => {
    const { a, b } = setupTwoCards();

    // 카드 A 의 ↻ 다시 → in-flight 슬롯이 A' 로 이동한다.
    a.getRenderInput().callbacks.onReRequest('다시', 'haiku');
    expect(a.getState().phase).toBe('streaming');
    const reRequestId = (aiRequestMock.mock.calls[0][0] as { requestId: string }).requestId;
    expect(useAiStore.getState().requestId).toBe(reRequestId);

    // 카드 B 의 requestId 로 여러 청크가 도착한다.
    emit('ai://chunk', { requestId: 'req-B', text: '첫' });
    emit('ai://chunk', { requestId: 'req-B', text: ' 조각' });
    emit('ai://chunk', { requestId: 'req-B', text: ' 완성' });
    emit('ai://done', { requestId: 'req-B', result: '첫 조각 완성', truncated: false });

    expect(b.getState().phase).toBe('done');
    // 마지막 청크만 남지 않는다 — 델타 누적이 올바르다.
    expect(b.getState().suggestion).toBe('첫 조각 완성');
    const bodies = [...view.dom.querySelectorAll('.mdedit-ai-suggestion')].map((e) => e.textContent);
    expect(bodies).toContain('첫 조각 완성');
  });

  it('AC-AI10-007: 카드 A 의 백스톱 발동이 카드 B·문서·취소 IPC 에 영향을 주지 않는다', () => {
    const { a, b } = setupTwoCards();
    a.getRenderInput().callbacks.onReRequest('다시', 'haiku');
    emit('ai://chunk', { requestId: 'req-B', text: '첫 조각 완성' });
    emit('ai://done', { requestId: 'req-B', result: '첫 조각 완성', truncated: false });
    expect(b.getState().phase).toBe('done');

    const docBefore = view.state.doc.toString();
    aiCancelMock.mockClear();
    vi.advanceTimersByTime(FRONTEND_BACKSTOP_DELAY_MS);

    expect(a.getState().phase).toBe('error');
    expect(b.getState().phase).toBe('done');
    expect(b.getState().suggestion).toBe('첫 조각 완성');
    expect(view.state.doc.toString()).toBe(docBefore);
    expect(aiCancelMock).not.toHaveBeenCalled();
  });

  it('AC-AI10-007: 카드 3개 공존 시 각 카드가 자기 이벤트만 소비한다', () => {
    const a = startSuggestionCard(makeRequest('r-1', 0, 5, 'hello'));
    useAiStore.getState().startRequest('r-1', 'inline-edit');
    emit('ai://done', { requestId: 'r-1', result: '결과1', truncated: false });

    const b = startSuggestionCard(makeRequest('r-2', 6, 11, 'world'));
    useAiStore.getState().startRequest('r-2', 'inline-edit');
    emit('ai://done', { requestId: 'r-2', result: '결과2', truncated: false });

    const c = startSuggestionCard(makeRequest('r-3', 0, 5, 'hello'));
    useAiStore.getState().startRequest('r-3', 'inline-edit');
    emit('ai://chunk', { requestId: 'r-3', text: '결과3' });

    expect(a.getState().suggestion).toBe('결과1');
    expect(b.getState().suggestion).toBe('결과2');
    expect(c.getState().phase).toBe('streaming');
    // 다른 카드의 청크가 자기 버퍼에 섞이지 않았다.
    expect(a.getRenderInput().streamBuffer).not.toContain('결과3');
    expect(b.getRenderInput().streamBuffer).not.toContain('결과3');
  });

  it('AC-AI10-007: destroy() 된 카드의 requestId 로 이벤트가 와도 아무 일도 일어나지 않는다', () => {
    const a = startSuggestionCard(makeRequest('gone-1', 0, 5, 'hello'));
    useAiStore.getState().startRequest('gone-1', 'inline-edit');
    a.destroy();
    const before = a.getState().phase;

    expect(() => emit('ai://chunk', { requestId: 'gone-1', text: 'x' })).not.toThrow();
    expect(() => emit('ai://done', { requestId: 'gone-1', result: 'y', truncated: false })).not.toThrow();
    // 스토어 릴레이는 여전히 단일 슬롯 계약대로 동작한다(고스트 경로 무영향).
    expect(useAiStore.getState().requestState).toBe('done');
    expect(a.getState().phase).toBe(before);
  });

  it('AC-AI10-008: clearCardRegistry 가 모든 컨트롤러의 타이머를 파괴한다', () => {
    const listener = vi.fn();
    const unsub = subscribeActiveCard(listener);
    try {
      const a = startSuggestionCard(makeRequest('clr-1', 0, 5, 'hello'));
      const b = startSuggestionCard(makeRequest('clr-2', 6, 11, 'world'));

      clearCardRegistry();
      expect(getCardControllers()).toHaveLength(0);

      listener.mockClear();
      vi.advanceTimersByTime(FRONTEND_BACKSTOP_DELAY_MS + 1000);
      expect(listener).not.toHaveBeenCalled();
      expect(a.getState().phase).not.toBe('error');
      expect(b.getState().phase).not.toBe('error');
    } finally {
      unsub();
    }
  });

  it('AC-AI10-008: clearCardRegistry 이후에도 새 카드가 정상 등록·무장된다', () => {
    startSuggestionCard(makeRequest('clr-3', 0, 5, 'hello'));
    clearCardRegistry();

    const fresh = startSuggestionCard(makeRequest('clr-4', 0, 5, 'hello'));
    expect(getCardControllers()).toHaveLength(1);
    vi.advanceTimersByTime(FRONTEND_BACKSTOP_DELAY_MS);
    expect(fresh.getState().phase).toBe('error');
  });

  it('AC-AI10-008: 등록된 컨트롤러가 0개면 no-op 으로 끝난다', () => {
    expect(() => clearCardRegistry()).not.toThrow();
    expect(getCardControllers()).toHaveLength(0);
  });
});
