// @MX:SPEC: SPEC-AI-010 REQ-AI10-023 REQ-AI10-024 REQ-AI10-025 REQ-AI10-026 REQ-AI10-027 REQ-AI10-028 REQ-AI10-029 REQ-AI10-030 REQ-AI10-031 REQ-AI10-032 REQ-AI10-033
// AC-AI10-013~019 — 재요청 소진 안내(`retry-exhausted`)를 실기기에서 도달 가능하게 만든다.
//
// TDD RED phase(수정 전 작성): 프로덕션 코드 어디에서도 `commit({type:'retry'})` 를 수행하지
// 않으므로 `retryCount` 는 영원히 0 이고 4번째 blind 재요청도 그냥 발행된다(AC-AI10-013 실패).
// 도달했다 하더라도 현행 `retry-exhausted` 렌더 분기는 안내 문구 + 고급 버튼 둘만 붙이므로
// 제안 본문·입력칸·적용 버튼·[✕ 취소]가 전부 없는 **닫을 수 없는 카드**가 된다(AC-AI10-014 실패).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// 다이어그램 자동 재시도 케이스(AC-AI10-018)용 — 'BADSYNTAX' 는 항상 무효로 판정시킨다.
const parseMock = vi.fn();
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: (...args: unknown[]) => parseMock(...args),
  },
}));

import {
  createAiSuggestionCard,
  startSuggestionCard,
  clearCardRegistry,
  getCardControllers,
  setActiveEditorView,
  type AiSuggestionCardController,
  type StartCardRequest,
} from '@/components/editor/extensions/ai-suggestion-card';
import { useAiStore } from '@/store/aiStore';

const PREV_SUGGESTION = '이전 제안 본문입니다.';
const EXHAUSTION_NOTICE = '방향을 알려주시면 더 정확해요 (위 입력칸)';

function mountEditor(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const state = EditorState.create({ doc, extensions: [createAiSuggestionCard()] });
  return new EditorView({ state, parent });
}

describe('SPEC-AI-010 모듈 4: 재요청 소진 안내 도달 가능화', () => {
  let view: EditorView;

  beforeEach(() => {
    aiRequestMock.mockClear();
    aiCancelMock.mockClear();
    parseMock.mockReset();
    clearCardRegistry();
    useAiStore.setState({ requestState: 'idle', streamBuffer: '', requestId: null, errorInfo: null });
    view = mountEditor('hello world');
  });

  afterEach(() => {
    view.destroy();
    setActiveEditorView(null);
    clearCardRegistry();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  function makeRequest(overrides: Partial<StartCardRequest['args']> = {}): StartCardRequest {
    return {
      args: {
        requestId: 'orig-1',
        feature: 'inline-edit',
        presetKind: 'polish',
        model: 'haiku',
        selection: 'hello',
        contextBefore: '',
        contextAfter: '',
        ...overrides,
      },
      insertOnly: false,
      range: { from: 0, to: 5 },
      originalText: 'hello',
    };
  }

  /** done phase(검토 대기) 카드를 만든다 — 제안 본문은 PREV_SUGGESTION. */
  function startDoneCard(): AiSuggestionCardController {
    const controller = startSuggestionCard(makeRequest());
    useAiStore.setState({ requestId: 'orig-1', requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({ requestId: 'orig-1', requestState: 'done', streamBuffer: PREV_SUGGESTION });
    expect(controller.getState().phase).toBe('done');
    return controller;
  }

  function cardEl(): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>('.mdedit-ai-card');
    expect(el).not.toBeNull();
    return el!;
  }

  function click(selector: string): void {
    const btn = cardEl().querySelector<HTMLElement>(selector);
    expect(btn, `${selector} 가 카드에 없다`).not.toBeNull();
    btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function lastRequestId(): string {
    const calls = aiRequestMock.mock.calls;
    return (calls[calls.length - 1][0] as { requestId: string }).requestId;
  }

  /** 마지막으로 발행된 요청을 done 으로 종결시켜 카드를 다시 검토 대기로 되돌린다. */
  function completeLastRequest(text = PREV_SUGGESTION): void {
    const id = lastRequestId();
    useAiStore.setState({ requestId: id, requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({ requestId: id, requestState: 'done', streamBuffer: text });
  }

  /** `[↻ 다시]`(blind) 1회 클릭 + 응답 종결까지의 한 사이클. */
  function blindCycle(): void {
    click('.mdedit-ai-retry');
    completeLastRequest();
  }

  // ---- AC-AI10-013: blind 3회 발행 + 4번째 미발행 ----

  it('blind re-request fires a request for each of the first three attempts', () => {
    const controller = startDoneCard();

    for (let i = 1; i <= 3; i++) {
      click('.mdedit-ai-retry');
      // (3) 매번 streaming 으로 복귀한다(M1 계약 유지).
      expect(controller.getState().phase).toBe('streaming');
      expect(aiRequestMock).toHaveBeenCalledTimes(i);
      completeLastRequest();
      // (4) 어느 시점에도 소진에 도달하지 않는다.
      expect(controller.getState().phase).toBe('done');
    }

    expect(aiRequestMock).toHaveBeenCalledTimes(3);
    expect(controller.getState().retryCount).toBe(3);
  });

  it('the fourth blind re-request does not fire and enters retry-exhausted with the suggestion intact', () => {
    const controller = startDoneCard();
    blindCycle();
    blindCycle();
    blindCycle();
    expect(aiRequestMock).toHaveBeenCalledTimes(3);

    click('.mdedit-ai-retry');

    expect(aiRequestMock).toHaveBeenCalledTimes(3); // 미발행(REQ-AI10-028)
    expect(controller.getState().phase).toBe('retry-exhausted');
    expect(controller.getState().suggestion).toBe(PREV_SUGGESTION);
    expect(controller.getState().retryCount).toBe(3);
    // enterReRequest() 미호출 — 스켈레톤으로 덮이지 않는다.
    expect(cardEl().querySelectorAll('.mdedit-ai-skeleton-line')).toHaveLength(0);
  });

  // ---- AC-AI10-014: 증강 카드 구성 ----

  /** 4번째 blind 클릭으로 소진 카드에 도달시킨다. */
  function reachExhausted(): AiSuggestionCardController {
    const controller = startDoneCard();
    blindCycle();
    blindCycle();
    blindCycle();
    click('.mdedit-ai-retry');
    expect(controller.getState().phase).toBe('retry-exhausted');
    return controller;
  }

  it('retry-exhausted renders the full done card plus the exhaustion notice and advanced-model offer', () => {
    reachExhausted();
    const card = cardEl();

    expect(card.querySelector('.mdedit-ai-suggestion')?.textContent).toBe(PREV_SUGGESTION);
    expect(card.querySelector('.mdedit-ai-direct-input')).not.toBeNull();
    expect(card.querySelector('.mdedit-ai-redo')).not.toBeNull();
    expect(card.querySelector('.mdedit-ai-retry')).not.toBeNull();
    expect(card.querySelectorAll('.mdedit-ai-apply').length).toBeGreaterThanOrEqual(1);
    expect(card.querySelector('.mdedit-ai-cancel')).not.toBeNull();
    expect(card.querySelector('.mdedit-ai-advanced')).not.toBeNull();
    expect(card.textContent ?? '').toContain(EXHAUSTION_NOTICE);
  });

  it('retry-exhausted has exactly one dismissal control and no duplicate dismiss button', () => {
    reachExhausted();
    const card = cardEl();

    expect(card.querySelector('.mdedit-ai-dismiss')).toBeNull();
    expect(card.querySelectorAll('.mdedit-ai-cancel')).toHaveLength(1);
  });

  it('the direction input precedes the exhaustion notice so that "위 입력칸" is truthful', () => {
    reachExhausted();
    const card = cardEl();
    const input = card.querySelector('.mdedit-ai-direct-input')!;
    const notice = card.querySelector('.mdedit-ai-notice')!;
    expect(notice.textContent).toBe(EXHAUSTION_NOTICE);

    // 입력칸이 문구보다 DOM 순서상 앞이면 FOLLOWING 비트가 선다.
    expect(input.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the cancel control actually closes the exhausted card without touching the document', () => {
    reachExhausted();
    const before = view.state.doc.toString();

    click('.mdedit-ai-cancel');

    expect(getCardControllers()).toHaveLength(0);
    expect(view.state.doc.toString()).toBe(before);
  });

  // ---- AC-AI10-015: directed 리셋 ----

  function typeDirection(text: string): void {
    const input = cardEl().querySelector<HTMLInputElement>('.mdedit-ai-direct-input')!;
    input.value = text;
  }

  it('a directed re-request fires and resets the consecutive blind counter to zero', () => {
    const controller = startDoneCard();
    blindCycle();
    blindCycle();
    expect(controller.getState().retryCount).toBe(2);

    typeDirection('더 짧게');
    click('.mdedit-ai-redo');

    expect(aiRequestMock).toHaveBeenCalledTimes(3);
    expect((aiRequestMock.mock.calls[2][0] as { customInstruction: string }).customInstruction).toBe(
      '더 짧게',
    );
    expect(controller.getState().retryCount).toBe(0);
    expect(controller.getState().phase).toBe('streaming');
  });

  it('after a directed reset three more blind attempts fire before exhaustion', () => {
    const controller = startDoneCard();
    blindCycle();
    blindCycle();
    typeDirection('더 짧게');
    click('.mdedit-ai-redo');
    completeLastRequest();
    expect(controller.getState().retryCount).toBe(0);

    blindCycle();
    blindCycle();
    blindCycle();
    expect(aiRequestMock).toHaveBeenCalledTimes(6); // blind2 + directed1 + blind3
    expect(controller.getState().phase).toBe('done');

    click('.mdedit-ai-retry');
    expect(aiRequestMock).toHaveBeenCalledTimes(6);
    expect(controller.getState().phase).toBe('retry-exhausted');
  });

  it('a directed re-request escapes retry-exhausted and fires normally', () => {
    const controller = reachExhausted();
    const before = aiRequestMock.mock.calls.length;

    const input = cardEl().querySelector<HTMLInputElement>('.mdedit-ai-direct-input')!;
    input.value = '표로 정리해줘';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(aiRequestMock).toHaveBeenCalledTimes(before + 1);
    expect((aiRequestMock.mock.calls[before][0] as { customInstruction: string }).customInstruction).toBe(
      '표로 정리해줘',
    );
    expect(controller.getState().retryCount).toBe(0);
    expect(controller.getState().phase).toBe('streaming');
  });

  // ---- AC-AI10-016: 고급 모델 폴백의 면제 ----

  it('the advanced-model fallback fires a sonnet request and leaves the retry counter untouched', () => {
    const controller = reachExhausted();
    const before = aiRequestMock.mock.calls.length;

    click('.mdedit-ai-advanced');

    expect(aiRequestMock).toHaveBeenCalledTimes(before + 1);
    expect((aiRequestMock.mock.calls[before][0] as { model: string }).model).toBe('sonnet');
    expect(controller.getState().retryCount).toBe(3);
    expect(controller.getState().phase).toBe('streaming');
    expect(cardEl().querySelectorAll('.mdedit-ai-skeleton-line')).toHaveLength(3);
  });

  it('the advanced-model fallback does not reset the counter either', () => {
    const controller = reachExhausted();
    click('.mdedit-ai-advanced');
    completeLastRequest();
    expect(controller.getState().phase).toBe('done');
    const before = aiRequestMock.mock.calls.length;

    click('.mdedit-ai-retry');

    expect(controller.getState().phase).toBe('retry-exhausted');
    expect(aiRequestMock).toHaveBeenCalledTimes(before);
  });

  it('repeated advanced-model attempts never self-exhaust', () => {
    const controller = reachExhausted();
    const before = aiRequestMock.mock.calls.length;

    // 1회차 — 소진 카드에서 발행된다.
    click('.mdedit-ai-advanced');
    completeLastRequest();
    // 카운터가 3 그대로이므로 blind 한 번이면 다시 소진 카드로 돌아온다(미발행).
    click('.mdedit-ai-retry');
    expect(controller.getState().phase).toBe('retry-exhausted');
    // 2회차 — 자기 자신을 카운트했다면 여기서 게이트에 막혀 아무 일도 일어나지 않는다.
    click('.mdedit-ai-advanced');

    expect(aiRequestMock).toHaveBeenCalledTimes(before + 2);
  });

  // ---- AC-AI10-017: error/intruded 면제 ----

  it('error-phase retries are exempt from the counter and never reach retry-exhausted', () => {
    const controller = startDoneCard();

    for (let i = 1; i <= 5; i++) {
      controller.onError({ kind: 'other', message: '잠시 문제가 있었어요' });
      click('.mdedit-ai-retry');
      expect(aiRequestMock).toHaveBeenCalledTimes(i);
      expect(controller.getState().retryCount).toBe(0);
      expect(controller.getState().phase).not.toBe('retry-exhausted');
    }
  });

  it('intruded-phase re-requests are exempt from the counter and never reach retry-exhausted', () => {
    const controller = startDoneCard();

    for (let i = 1; i <= 5; i++) {
      controller.intrude();
      click('.mdedit-ai-rerequest');
      expect(aiRequestMock).toHaveBeenCalledTimes(i);
      expect(controller.getState().retryCount).toBe(0);
      expect(controller.getState().phase).not.toBe('retry-exhausted');
    }
  });

  it('the exhaustion gate never blocks an error-phase recovery retry', () => {
    const controller = startDoneCard();
    blindCycle();
    blindCycle();
    blindCycle();
    expect(controller.getState().retryCount).toBe(3);
    const before = aiRequestMock.mock.calls.length;

    controller.onError({ kind: 'other', message: '잠시 문제가 있었어요' });
    click('.mdedit-ai-retry');

    expect(aiRequestMock).toHaveBeenCalledTimes(before + 1);
    expect(controller.getState().phase).toBe('streaming');
  });

  // ---- AC-AI10-018: 컨트롤러 내부 자동 재요청 면제 ----

  it('the table-validation auto re-request does not touch the retry counter', () => {
    const controller = startSuggestionCard(
      makeRequest({ requestId: 'tbl-1', presetKind: 'table' }),
    );
    useAiStore.setState({ requestId: 'tbl-1', requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({ requestId: 'tbl-1', requestState: 'done', streamBuffer: '표가 아닌 산문입니다.' });

    expect(aiRequestMock).toHaveBeenCalledTimes(1); // 자동 재요청 1회
    expect(controller.getState().retryCount).toBe(0);
    expect(controller.getState().phase).not.toBe('retry-exhausted');
  });

  it('the diagram auto-retry does not touch the retry counter', async () => {
    parseMock.mockImplementation((code: string) =>
      code.includes('BADSYNTAX') ? Promise.reject(new Error('Parse error')) : Promise.resolve(true),
    );
    const controller = startSuggestionCard(
      makeRequest({ requestId: 'dia-1', feature: 'diagram', presetKind: 'diagram' }),
    );
    useAiStore.setState({ requestId: 'dia-1', requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({
      requestId: 'dia-1',
      requestState: 'done',
      streamBuffer: '```mermaid\nBADSYNTAX\n```',
    });

    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(1));
    expect(controller.getState().retryCount).toBe(0);
    expect(controller.getState().phase).not.toBe('retry-exhausted');
  });

  it('the list-fallback re-request bypasses the counter entirely', () => {
    const controller = startDoneCard();

    // 목록 폴백은 onReRequest 를 거치지 않고 enterListFallback + fireReRequest 를 직접 부른다 —
    // 구조적으로 카운터에 닿을 자리가 없다. 반복해도 소진에 도달하지 않는다.
    for (let i = 1; i <= 5; i++) {
      controller.getRenderInput().callbacks.onListFallback();
      expect(aiRequestMock).toHaveBeenCalledTimes(i);
      expect(controller.getState().retryCount).toBe(0);
      expect(controller.getState().phase).not.toBe('retry-exhausted');
    }
  });

  // ---- AC-AI10-019: 3분류 계약과 시그니처 호환성 ----

  it('onReRequest called without an explicit kind defaults to exempt', () => {
    const controller = startDoneCard();
    blindCycle();
    blindCycle();
    expect(controller.getState().retryCount).toBe(2);
    const before = aiRequestMock.mock.calls.length;

    controller.getRenderInput().callbacks.onReRequest('다시', 'haiku');

    expect(aiRequestMock).toHaveBeenCalledTimes(before + 1);
    expect(controller.getState().retryCount).toBe(2);
  });

  it('all three re-request kinds have a real consumer', () => {
    const controller = startDoneCard();

    // blind — [↻ 다시]
    click('.mdedit-ai-retry');
    expect(controller.getState().retryCount).toBe(1);
    completeLastRequest();

    // directed — 입력칸에 내용이 있는 [↻]
    typeDirection('더 짧게');
    click('.mdedit-ai-redo');
    expect(controller.getState().retryCount).toBe(0);
    completeLastRequest();

    // exempt — error phase 의 [다시 시도]
    click('.mdedit-ai-retry'); // blind 1
    completeLastRequest();
    expect(controller.getState().retryCount).toBe(1);
    controller.onError({ kind: 'other', message: '잠시 문제가 있었어요' });
    click('.mdedit-ai-retry');
    expect(controller.getState().retryCount).toBe(1);
  });

  it('the exhaustion boundary is exactly MAX_RETRY = 3 (fourth attempt exhausts)', () => {
    const controller = startDoneCard();

    blindCycle();
    expect(controller.getState().retryCount).toBe(1);
    blindCycle();
    expect(controller.getState().retryCount).toBe(2);
    blindCycle();
    expect(controller.getState().retryCount).toBe(3);
    expect(controller.getState().phase).toBe('done');

    click('.mdedit-ai-retry');
    expect(controller.getState().phase).toBe('retry-exhausted');
  });

  // ---- Edge cases ----

  it('EC-11: 소진 카드는 백스톱 임계가 지나도 error 로 전이하지 않는다', () => {
    vi.useFakeTimers();
    const controller = startDoneCard();
    blindCycle();
    blindCycle();
    blindCycle();
    click('.mdedit-ai-retry');
    expect(controller.getState().phase).toBe('retry-exhausted');

    // 발행하지 않은 요청에 대해 "응답이 오지 않았어요" 를 띄우는 것은 거짓이다.
    vi.advanceTimersByTime(FRONTEND_BACKSTOP_DELAY_MS * 2);

    expect(controller.getState().phase).toBe('retry-exhausted');
  });

  it('EC-12: truncated 고지는 소진 카드에서도 유지된다', () => {
    const controller = startDoneCard();
    blindCycle();
    blindCycle();
    // 3번째 blind 의 응답이 절단 고지를 달고 도착한 상황(streaming → done 전이).
    click('.mdedit-ai-retry');
    controller.onComplete(PREV_SUGGESTION, { truncated: true });
    expect(controller.getState().retryCount).toBe(3);
    expect(cardEl().querySelector('.mdedit-ai-truncated-note')).not.toBeNull();

    click('.mdedit-ai-retry');

    expect(controller.getState().phase).toBe('retry-exhausted');
    expect(cardEl().querySelector('.mdedit-ai-truncated-note')).not.toBeNull();
  });

  it('EC-13: 소진 카드에서도 제안을 그대로 적용할 수 있다', () => {
    reachExhausted();
    const applyBtn = cardEl().querySelector<HTMLButtonElement>('.mdedit-ai-apply[data-mode="replace"]');
    expect(applyBtn).not.toBeNull();

    applyBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(view.state.doc.toString()).toBe(`${PREV_SUGGESTION} world`);
    expect(getCardControllers()).toHaveLength(0);
  });

  it('EC-14: 카운터는 카드마다 독립이다', () => {
    const a = startDoneCard();
    click('.mdedit-ai-retry');
    completeLastRequest();
    click('.mdedit-ai-retry');
    completeLastRequest();
    expect(a.getState().retryCount).toBe(2);

    const b = startSuggestionCard(makeRequest({ requestId: 'card-b' }));
    expect(b.getState().retryCount).toBe(0);
  });
});
