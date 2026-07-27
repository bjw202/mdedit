// @MX:SPEC: SPEC-AI-010 REQ-AI10-007 REQ-AI10-008 REQ-AI10-009 REQ-AI10-010 REQ-AI10-011
// AC-AI10-004/005/006 — 세 타임아웃 계층의 단일 소스·순서 불변식, 프론트 백스톱 만료 시
// 복구 가능한 error 카드, 백스톱 타이머의 무장·재무장·7경로 해제.
//
// TDD RED phase(수정 전 작성): 프론트에는 종결 보장이 없어 카드가 `streaming` 에 영구
// 고착한다. `waitNoticeTimer` 는 8초 뒤 안내 문구만 띄우고 스스로 해제되며 종결을 만들지
// 않는다. `intrude()`/`markStale()` 은 현재 어떤 타이머도 해제하지 않는다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  WAIT_NOTICE_DELAY_MS,
  BACKEND_WATCHDOG_TIMEOUT_MS,
  FRONTEND_BACKSTOP_DELAY_MS,
} from '@/lib/ai/waitNotice';

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
  clearCardRegistry,
  getCardControllers,
  setActiveEditorView,
  subscribeActiveCard,
  type AiSuggestionCardController,
} from '@/components/editor/extensions/ai-suggestion-card';
import { useAiStore } from '@/store/aiStore';

/** 백스톱 임계를 넉넉히 넘기는 진행량(대기 안내 임계도 함께 지난다). */
const PAST_BACKSTOP = FRONTEND_BACKSTOP_DELAY_MS + 1000;

// ============================================================
// AC-AI10-004 — 세 계층 상수(단일 소스 + 순서 불변식)
// ============================================================

describe('AC-AI10-004: 세 타임아웃 계층의 단일 소스와 순서 불변식', () => {
  it('소프트 대기 안내는 8000ms 로 무변경이다', () => {
    expect(WAIT_NOTICE_DELAY_MS).toBe(8000);
  });

  it('백엔드 하드 워치독 미러 값이 60_000ms 다(src-tauri/src/ai/mod.rs:32 WATCHDOG_TIMEOUT_SECS = 60)', () => {
    expect(BACKEND_WATCHDOG_TIMEOUT_MS).toBe(60_000);
  });

  it('소프트 대기 안내 < 백엔드 미러 < 프론트 백스톱 순서가 성립한다', () => {
    expect(WAIT_NOTICE_DELAY_MS).toBeLessThan(BACKEND_WATCHDOG_TIMEOUT_MS);
    expect(BACKEND_WATCHDOG_TIMEOUT_MS).toBeLessThan(FRONTEND_BACKSTOP_DELAY_MS);
  });

  it('프론트 백스톱과 백엔드 미러가 같지 않다(경합 순서 미보장 → 동값 금지)', () => {
    expect(FRONTEND_BACKSTOP_DELAY_MS).not.toBe(BACKEND_WATCHDOG_TIMEOUT_MS);
  });
});

// ============================================================
// AC-AI10-005 / AC-AI10-006 — 백스톱 동작과 생명주기
// ============================================================

describe('SPEC-AI-010 모듈 2: 프론트 백스톱', () => {
  let view: EditorView;

  beforeEach(() => {
    vi.useFakeTimers();
    aiRequestMock.mockClear();
    aiCancelMock.mockClear();
    clearCardRegistry();
    useAiStore.setState({ requestState: 'idle', streamBuffer: '', requestId: null, errorInfo: null });
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

  function startCard(requestId = 'wd-1'): AiSuggestionCardController {
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
    return controller;
  }

  function cardEl(): HTMLElement | null {
    return view.dom.querySelector<HTMLElement>('.mdedit-ai-card');
  }

  it('AC-AI10-005: 종결 이벤트 없이 백스톱 임계를 넘기면 복구 가능한 error 카드가 된다', () => {
    const controller = startCard();
    vi.advanceTimersByTime(FRONTEND_BACKSTOP_DELAY_MS);

    const state = controller.getState();
    expect(state.phase).toBe('error');
    // 기존 errorKind 집합에 머문다(신규 kind 부재).
    expect(['login', 'network', 'parse', 'other']).toContain(state.errorKind);

    const card = cardEl()!;
    const text = card.textContent ?? '';
    expect(text.length).toBeGreaterThan(0);
    // 분류된 한국어 문구 — raw 노출 흔적이 없다.
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
    expect(text).not.toContain('{');
    expect(text).not.toContain('Error:');
    expect(text).not.toContain('at ');
    // 재시도와 닫기가 동시에 존재한다(막다른 상태 금지, REQ-AI10-011).
    expect(card.querySelector('.mdedit-ai-retry')).not.toBeNull();
    expect(card.querySelector('.mdedit-ai-dismiss')).not.toBeNull();
  });

  it('AC-AI10-005: 백스톱 임계 1ms 전에는 조기 발동하지 않는다', () => {
    const controller = startCard();
    vi.advanceTimersByTime(FRONTEND_BACKSTOP_DELAY_MS - 1);
    expect(controller.getState().phase).toBe('streaming');
  });

  it('AC-AI10-005: 백스톱 error 카드의 재시도가 카드를 streaming 으로 되돌리고 타이머를 재무장한다', () => {
    const controller = startCard();
    vi.advanceTimersByTime(FRONTEND_BACKSTOP_DELAY_MS);
    expect(controller.getState().phase).toBe('error');

    cardEl()!.querySelector<HTMLButtonElement>('.mdedit-ai-retry')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(controller.getState().phase).toBe('streaming');

    vi.advanceTimersByTime(FRONTEND_BACKSTOP_DELAY_MS - 1);
    expect(controller.getState().phase).toBe('streaming');
    vi.advanceTimersByTime(1);
    expect(controller.getState().phase).toBe('error');
  });

  it('AC-AI10-005/EC-10: 백엔드 timeout 오류가 먼저 오면 백스톱 문구가 이를 덮어쓰지 않는다', () => {
    const controller = startCard();
    vi.advanceTimersByTime(BACKEND_WATCHDOG_TIMEOUT_MS);
    controller.onError({ kind: 'other', message: '응답이 너무 오래 걸려 중단했어요' });

    vi.advanceTimersByTime(PAST_BACKSTOP);
    expect(controller.getState().errorMessage).toBe('응답이 너무 오래 걸려 중단했어요');
  });

  it('AC-AI10-006: 컨트롤러 생성 시 무장된다', () => {
    const controller = startCard();
    vi.advanceTimersByTime(PAST_BACKSTOP);
    expect(controller.getState().phase).toBe('error');
  });

  it('AC-AI10-006: 재요청마다 재무장되어 절반씩 두 번 진행해도 발동하지 않는다', () => {
    const controller = startCard();
    const half = Math.floor(FRONTEND_BACKSTOP_DELAY_MS / 2);

    controller.getRenderInput().callbacks.onReRequest('다시', 'haiku');
    vi.advanceTimersByTime(half);
    expect(controller.getState().phase).toBe('streaming');

    controller.getRenderInput().callbacks.onReRequest('다시', 'haiku');
    vi.advanceTimersByTime(half);
    expect(controller.getState().phase).toBe('streaming');
  });

  it('AC-AI10-006: 종결·소멸 7경로 각각에서 해제되어 이후 추가 전이가 없다', () => {
    // 1. ai://done 수신
    let c = startCard('wd-done');
    c.onComplete('완성된 제안');
    expect(c.getState().phase).toBe('done');
    vi.advanceTimersByTime(PAST_BACKSTOP);
    expect(c.getState().phase).toBe('done');
    clearCardRegistry();

    // 2. ai://error 수신
    c = startCard('wd-err');
    c.onError({ kind: 'network', message: '네트워크에 연결할 수 없어요' });
    vi.advanceTimersByTime(PAST_BACKSTOP);
    expect(c.getState().phase).toBe('error');
    expect(c.getState().errorKind).toBe('network');
    clearCardRegistry();

    // 3. 사용자 취소(✕ 취소 클릭 → destroy + 레지스트리 제거)
    c = startCard('wd-cancel');
    cardEl()!.querySelector<HTMLButtonElement>('.mdedit-ai-cancel')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(getCardControllers()).toHaveLength(0);
    vi.advanceTimersByTime(PAST_BACKSTOP);
    expect(c.getState().phase).toBe('streaming');
    clearCardRegistry();

    // 4. 원문 편집 침입
    c = startCard('wd-intrude');
    c.intrude();
    vi.advanceTimersByTime(PAST_BACKSTOP);
    expect(c.getState().phase).toBe('intruded');
    clearCardRegistry();

    // 5. 원문 불일치
    c = startCard('wd-stale');
    c.markStale();
    vi.advanceTimersByTime(PAST_BACKSTOP);
    expect(c.getState().phase).toBe('stale');
    clearCardRegistry();

    // 6. 새 요청에 의한 취소
    c = startCard('wd-cbn');
    c.cancelByNew();
    vi.advanceTimersByTime(PAST_BACKSTOP);
    expect(c.getState().phase).toBe('cancelled-by-new');
    clearCardRegistry();

    // 7. 제안 적용
    c = startCard('wd-apply');
    c.onComplete('적용될 제안');
    cardEl()!.querySelector<HTMLButtonElement>('.mdedit-ai-apply')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(getCardControllers()).toHaveLength(0);
    vi.advanceTimersByTime(PAST_BACKSTOP);
    expect(c.getState().phase).toBe('done');
    clearCardRegistry();

    // 7'. 닫기
    c = startCard('wd-dismiss');
    c.onError({ kind: 'other', message: '잠시 문제가 있었어요' });
    cardEl()!.querySelector<HTMLButtonElement>('.mdedit-ai-dismiss')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(getCardControllers()).toHaveLength(0);
    vi.advanceTimersByTime(PAST_BACKSTOP);
    expect(c.getState().phase).toBe('error');
  });

  it('AC-AI10-006: intrude/markStale 이후에는 재렌더 알림도 추가로 발화하지 않는다', () => {
    const listener = vi.fn();
    const unsub = subscribeActiveCard(listener);
    try {
      const c = startCard('wd-notify');
      c.intrude();
      listener.mockClear();
      vi.advanceTimersByTime(PAST_BACKSTOP);
      expect(listener).not.toHaveBeenCalled();
    } finally {
      unsub();
    }
  });

  it('AC-AI10-006: destroy() 가 대기 안내·백스톱 두 타이머를 모두 해제한다', () => {
    const listener = vi.fn();
    const unsub = subscribeActiveCard(listener);
    try {
      const c = startCard('wd-destroy');
      c.destroy();
      listener.mockClear();
      vi.advanceTimersByTime(PAST_BACKSTOP);
      expect(listener).not.toHaveBeenCalled();
      expect(c.getState().phase).toBe('streaming');
    } finally {
      unsub();
    }
  });
});
