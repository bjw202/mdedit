// @MX:SPEC: SPEC-AI-010 REQ-AI10-001 REQ-AI10-002 REQ-AI10-003 REQ-AI10-004 REQ-AI10-005 REQ-AI10-006
// AC-AI10-001/002/003 — 사용자 개시 재요청 5개 진입점이 발행 즉시 기존 streaming 표시로 복귀한다.
//
// TDD RED phase(수정 전 작성): 현행 `onReRequest` 배선은 `fireReRequest` 반환값을
// `boundRequestId` 에 대입하는데, `fireReRequest` 는 대입 **이전에** `store.startRequest` 를
// 실행한다. 그 시점 zustand 구독은 `s.requestId !== boundRequestId`(그때 boundRequestId 는
// 직전 id)로 단락되므로 `streaming` 전이가 카드에 커밋되지 않는다 — 카드는 첫 청크가 올
// 때까지 `done` phase(옛 제안 본문 + 버튼)를 유지한다. 5개 진입점 전부에서 실패해야 한다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { WAIT_NOTICE_DELAY_MS, WAIT_NOTICE_TEXT } from '@/lib/ai/waitNotice';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...args: unknown[]) => aiRequestMock(...args),
  aiCancel: (...args: unknown[]) => aiCancelMock(...args),
  ipcErrorMessage: (reason: unknown) => (typeof reason === 'string' ? reason : 'error'),
}));

import {
  createAiSuggestionCard,
  startSuggestionCard,
  renderSuggestionCard,
  clearCardRegistry,
  setActiveEditorView,
  type AiSuggestionCardController,
  type CardState,
} from '@/components/editor/extensions/ai-suggestion-card';
import { useAiStore } from '@/store/aiStore';

const PREV_SUGGESTION = '이전 제안 본문입니다.';

function mountEditor(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const state = EditorState.create({ doc, extensions: [createAiSuggestionCard()] });
  return new EditorView({ state, parent });
}

describe('SPEC-AI-010 모듈 1: 사용자 개시 재요청의 진행 표시', () => {
  let view: EditorView;

  beforeEach(() => {
    vi.useFakeTimers();
    aiRequestMock.mockClear();
    aiCancelMock.mockClear();
    clearCardRegistry();
    useAiStore.setState({ requestState: 'idle', streamBuffer: '', requestId: null, errorInfo: null });
    view = mountEditor('hello world');
  });

  afterEach(() => {
    view.destroy();
    setActiveEditorView(null);
    clearCardRegistry();
    document.body.innerHTML = '';
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** done phase(검토 대기) 카드를 만든다 — 제안 본문은 PREV_SUGGESTION. */
  function startDoneCard(requestId = 'orig-1'): AiSuggestionCardController {
    const controller = startSuggestionCard({
      args: {
        requestId,
        feature: 'inline-edit',
        presetKind: 'polish',
        model: 'haiku',
        selection: 'hello',
        contextBefore: '',
        contextAfter: '',
      },
      insertOnly: false,
      range: { from: 0, to: 5 },
      originalText: 'hello',
    });
    useAiStore.setState({ requestId, requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({ requestId, requestState: 'done', streamBuffer: PREV_SUGGESTION });
    expect(controller.getState().phase).toBe('done');
    return controller;
  }

  function cardEl(): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>('.mdedit-ai-card');
    expect(el).not.toBeNull();
    return el!;
  }

  /** AC-AI10-001 의 5개 단언 — 어떤 청크도 도착하지 않은 상태에서의 streaming 복귀. */
  function expectStreamingReset(controller: AiSuggestionCardController): void {
    expect(controller.getState().phase).toBe('streaming');
    const card = cardEl();
    // (1) 글로우 테두리 클래스
    expect(card.classList.contains('mdedit-ai-card-streaming')).toBe(true);
    // (2) 3줄 shimmer 스켈레톤(빈 버퍼 조건)
    expect(card.querySelectorAll('.mdedit-ai-skeleton-line')).toHaveLength(3);
    // (3) 직전 제안 본문 부재(버퍼 리셋, REQ-AI10-002)
    expect(card.textContent ?? '').not.toContain(PREV_SUGGESTION);
    // (4) done 컨트롤 소멸
    expect(card.querySelector('.mdedit-ai-apply')).toBeNull();
    // (5) streaming 렌더의 기존 구성인 [✕ 취소] 존재
    expect(card.querySelector('.mdedit-ai-cancel')).not.toBeNull();
  }

  it('진입점 1 — ↻(방향 지시)가 발행 즉시 streaming 표시로 복귀한다', () => {
    const controller = startDoneCard();
    const input = cardEl().querySelector<HTMLInputElement>('.mdedit-ai-direct-input')!;
    input.value = '더 짧게';
    cardEl().querySelector<HTMLButtonElement>('.mdedit-ai-redo')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    expectStreamingReset(controller);
    expect(aiRequestMock).toHaveBeenCalledTimes(1);
    expect((aiRequestMock.mock.calls[0][0] as { customInstruction: string }).customInstruction).toBe(
      '더 짧게',
    );
  });

  it('진입점 2 — ↻ 다시(blind)가 발행 즉시 streaming 표시로 복귀한다', () => {
    const controller = startDoneCard();
    cardEl().querySelector<HTMLButtonElement>('.mdedit-ai-retry')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    expectStreamingReset(controller);
    expect(aiRequestMock).toHaveBeenCalledTimes(1);
  });

  // retry-exhausted 는 wiring 상 컨트롤러 공개 API 로 도달할 수 없다(reduceCard 'retry' 는
  // 배선에서 커밋되지 않는다). 그래서 이 진입점만 renderSuggestionCard 에 **실제 컨트롤러의
  // 콜백**을 그대로 물려 렌더한 뒤 클릭한다 — 검증 대상(onReRequest 배선)은 동일하다.
  it('진입점 3 — ⚡ 고급 모델로 다시 시도가 발행 즉시 streaming 표시로 복귀한다', () => {
    const controller = startDoneCard();
    const exhausted: CardState = { phase: 'retry-exhausted', suggestion: PREV_SUGGESTION, retryCount: 3 };
    const synthetic = renderSuggestionCard({ ...controller.getRenderInput(), state: exhausted });
    document.body.appendChild(synthetic);
    synthetic.querySelector<HTMLButtonElement>('.mdedit-ai-advanced')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    expectStreamingReset(controller);
    expect((aiRequestMock.mock.calls[0][0] as { model: string }).model).toBe('sonnet');
  });

  it('진입점 4 — error(기타)의 다시 시도가 발행 즉시 streaming 표시로 복귀한다', () => {
    const controller = startDoneCard();
    controller.onError({ kind: 'other', message: '잠시 문제가 있었어요' });
    expect(cardEl().textContent).toContain('잠시 문제가 있었어요');

    cardEl().querySelector<HTMLButtonElement>('.mdedit-ai-retry')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    expectStreamingReset(controller);
    expect(cardEl().textContent ?? '').not.toContain('잠시 문제가 있었어요');
    expect(cardEl().querySelector('.mdedit-ai-dismiss')).toBeNull();
  });

  it('진입점 5 — intruded 의 다시 요청이 발행 즉시 streaming 표시로 복귀한다', () => {
    const controller = startDoneCard();
    controller.intrude();
    expect(cardEl().textContent).toContain('원문이 편집되어 이 제안을 멈췄어요');

    cardEl().querySelector<HTMLButtonElement>('.mdedit-ai-rerequest')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    expectStreamingReset(controller);
    expect(cardEl().textContent ?? '').not.toContain('원문이 편집되어 이 제안을 멈췄어요');
  });

  // ---- AC-AI10-002: 대기 안내 재무장 ----

  it('AC-AI10-002: 재요청 후 8초가 지나면 대기 안내가 다시 나타난다', () => {
    startDoneCard();
    expect(cardEl().querySelector('.mdedit-ai-wait-notice')).toBeNull();

    cardEl().querySelector<HTMLButtonElement>('.mdedit-ai-retry')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS);

    const notice = cardEl().querySelector('.mdedit-ai-wait-notice');
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toBe(WAIT_NOTICE_TEXT);
  });

  it('AC-AI10-002: 이미 떠 있던 대기 안내가 재요청 시점에 사라졌다가 8초 뒤 다시 나타난다', () => {
    const controller = startSuggestionCard({
      args: {
        requestId: 'wait-1',
        feature: 'inline-edit',
        presetKind: 'polish',
        model: 'haiku',
        selection: 'hello',
        contextBefore: '',
        contextAfter: '',
      },
      insertOnly: false,
      range: { from: 0, to: 5 },
      originalText: 'hello',
    });
    useAiStore.setState({ requestId: 'wait-1', requestState: 'streaming', streamBuffer: '' });
    vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS);
    expect(cardEl().querySelector('.mdedit-ai-wait-notice')).not.toBeNull();

    // 아직 done 이 아니므로 done 컨트롤이 없다 — 재요청은 컨트롤러 콜백 배선으로 직접 발행한다.
    controller.getRenderInput().callbacks.onReRequest('다시', 'haiku');
    expect(cardEl().querySelector('.mdedit-ai-wait-notice')).toBeNull();

    vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS);
    expect(cardEl().querySelector('.mdedit-ai-wait-notice')).not.toBeNull();
  });

  it('AC-AI10-002: 재요청 후 8초 전에 첫 청크가 오면 대기 안내가 나타나지 않는다', () => {
    const controller = startDoneCard();
    cardEl().querySelector<HTMLButtonElement>('.mdedit-ai-retry')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    const newId = (aiRequestMock.mock.calls[0][0] as { requestId: string }).requestId;

    vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS - 1);
    useAiStore.setState({ requestId: newId, requestState: 'streaming', streamBuffer: '새 청크' });
    vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS * 2);

    expect(cardEl().querySelector('.mdedit-ai-wait-notice')).toBeNull();
    expect(controller.getState().phase).toBe('streaming');
  });

  // ---- AC-AI10-003: 가짜 진행 표시 부재 ----

  it('AC-AI10-003: 재요청 직후 렌더에 진행률 요소가 없다', () => {
    startDoneCard();
    cardEl().querySelector<HTMLButtonElement>('.mdedit-ai-retry')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS);

    const card = cardEl();
    expect(card.querySelector('progress')).toBeNull();
    expect(card.querySelector('[role="progressbar"]')).toBeNull();
    expect(card.textContent ?? '').not.toMatch(/%/);
    expect(card.textContent ?? '').not.toMatch(/남은|초 후/);
  });
});
