// @MX:SPEC: SPEC-AI-001 REQ-AI-033 REQ-AI-034 REQ-AI-036 REQ-AI-037 REQ-AI-039 REQ-AI-040
// T-018 integration — 무손상·오류 UX 로 확장된 카드 상태/렌더. RED-first.
// 원문 침범 배너, 검토 카드 유지(새 요청에 안 사라짐), 로그인 오류→온보딩, truncated 참고 노트,
// raw payload 미노출, 네트워크 오류 재시도 루프 금지.

import { describe, it, expect, vi } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** sliceDoc/doc/dispatch 를 갖춘 최소 fake view (applySuggestion 계약 충족). */
function createApplyView(doc: string, from: number, to: number) {
  let state = EditorState.create({ doc, selection: EditorSelection.single(from, to) });
  const view = {
    get state() {
      return state;
    },
    dispatch(spec: Parameters<EditorState['update']>[0]) {
      state = state.update(spec).state;
    },
  } as unknown as EditorView;
  return { view, getDoc: () => state.doc.toString() };
}

describe('reduceCard: 무손상·오류 전이 (T-018)', () => {
  const streaming = { phase: 'streaming' as const, suggestion: '', retryCount: 0 };

  it('complete carries the truncated flag through (REQ-AI-039 참고 범위 고지)', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const next = reduceCard(streaming, {
      type: 'complete',
      finalText: '요약 결과',
      original: '원문',
      truncated: true,
    });
    expect(next.phase).toBe('done');
    expect(next.truncated).toBe(true);
  });

  it('fail carries the classified error kind (REQ-AI-037/040)', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const next = reduceCard(streaming, {
      type: 'fail',
      kind: 'login',
      message: '로그인이 풀렸어요',
    });
    expect(next.phase).toBe('error');
    expect(next.errorKind).toBe('login');
  });

  it('intrude moves a streaming card to the intruded banner (REQ-AI-036)', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    expect(reduceCard(streaming, { type: 'intrude' }).phase).toBe('intruded');
  });

  it('cancel-by-new only affects an in-flight (streaming) card', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    expect(reduceCard(streaming, { type: 'cancel-by-new' }).phase).toBe('cancelled-by-new');
  });

  it('cancel-by-new does NOT disturb a review-state (done) card (§3)', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const done = { phase: 'done' as const, suggestion: '검토 중', retryCount: 0 };
    const next = reduceCard(done, { type: 'cancel-by-new' });
    expect(next.phase).toBe('done');
    expect(next.suggestion).toBe('검토 중');
  });
});

describe('renderSuggestionCard: 오류·무손상 UX DOM (T-018)', () => {
  function callbacks() {
    return {
      onApply: vi.fn(),
      onCancel: vi.fn(),
      onReRequest: vi.fn(),
      onListFallback: vi.fn(),
      onOpenOnboarding: vi.fn(),
    };
  }

  async function render(input: Record<string, unknown>) {
    const mod = await import('@/components/editor/extensions/ai-suggestion-card');
    const cb = callbacks();
    const dom = mod.renderSuggestionCard({ callbacks: cb, ...input } as never);
    document.body.appendChild(dom);
    return { dom, cb };
  }

  it('login error shows the onboarding entry, not a retry loop (REQ-AI-037)', async () => {
    const { dom, cb } = await render({
      state: { phase: 'error', suggestion: '', retryCount: 0, errorKind: 'login', errorMessage: '로그인이 풀렸어요' },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'polish',
      streamBuffer: '',
    });
    expect(dom.textContent).toContain('로그인이 풀렸어요');
    const connect = dom.querySelector<HTMLButtonElement>('.mdedit-ai-connect')!;
    expect(connect.textContent).toContain('연결 안내');
    connect.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb.onOpenOnboarding).toHaveBeenCalled();
    // Login errors must not offer a blind retry loop.
    expect(dom.querySelector('.mdedit-ai-retry')).toBeNull();
  });

  it('network error shows guidance and no retry-loop button (재시도 루프 금지)', async () => {
    const { dom } = await render({
      state: { phase: 'error', suggestion: '', retryCount: 0, errorKind: 'network', errorMessage: '네트워크에 연결할 수 없어요' },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'polish',
      streamBuffer: '',
    });
    expect(dom.textContent).toContain('네트워크');
    expect(dom.querySelector('.mdedit-ai-retry')).toBeNull();
    expect(dom.querySelector('.mdedit-ai-connect')).toBeNull();
  });

  it('never renders a raw payload — only the classified message (REQ-AI-040)', async () => {
    const rawish = '{"type":"result","stack":"Error at line 42"}';
    const { dom } = await render({
      state: { phase: 'error', suggestion: '', retryCount: 0, errorKind: 'parse', errorMessage: '도구 업데이트로 문제가 생겼어요' },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'polish',
      streamBuffer: '',
    });
    expect(dom.textContent).toContain('도구 업데이트로 문제가 생겼어요');
    expect(dom.textContent).not.toContain(rawish);
    expect(dom.textContent).not.toContain('stack');
  });

  it('truncated done shows the "일부만 참고" note (P7)', async () => {
    const { dom } = await render({
      state: { phase: 'done', suggestion: '개요 결과', retryCount: 0, truncated: true },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'outline',
      streamBuffer: '',
    });
    expect(dom.querySelector('.mdedit-ai-truncated-note')).toBeTruthy();
    expect(dom.textContent).toContain('일부만 참고');
  });

  it('intruded shows the banner with 무시 and 다시 요청 (REQ-AI-036)', async () => {
    const { dom, cb } = await render({
      state: { phase: 'intruded', suggestion: '', retryCount: 0 },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'polish',
      streamBuffer: '',
    });
    expect(dom.textContent).toContain('원문이 편집되어');
    dom.querySelector<HTMLButtonElement>('.mdedit-ai-ignore')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb.onCancel).toHaveBeenCalled();
    dom.querySelector<HTMLButtonElement>('.mdedit-ai-rerequest')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb.onReRequest).toHaveBeenCalled();
  });

  it('cancelled-by-new shows the visible "새 요청으로 취소" notice (P7, no silent drop)', async () => {
    const { dom } = await render({
      state: { phase: 'cancelled-by-new', suggestion: '', retryCount: 0 },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'polish',
      streamBuffer: '',
    });
    expect(dom.textContent).toContain('새 요청으로 취소');
  });
});

describe('AiSuggestionCardController: store-driven transitions', () => {
  it('drives streaming buffer → done and exposes render input', async () => {
    const { AiSuggestionCardController } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const model = {
      requestId: 'r1',
      presetKind: 'polish' as const,
      range: { from: 0, to: 5 },
      originalText: 'hello',
      insertOnly: false,
      model: 'haiku' as const,
    };
    const ctrl = new AiSuggestionCardController(model, {
      onApply: vi.fn(),
      onCancel: vi.fn(),
      onReRequest: vi.fn(),
      onListFallback: vi.fn(),
    });
    ctrl.onStream('부분 텍스트');
    expect(ctrl.getState().phase).toBe('streaming');
    expect(ctrl.getRenderInput().streamBuffer).toBe('부분 텍스트');

    ctrl.onComplete('다듬어진 결과', { truncated: false });
    expect(ctrl.getState().phase).toBe('done');
    expect(ctrl.getRenderInput().state.suggestion).toBe('다듬어진 결과');
  });

  it('onError maps the error kind into the card state', async () => {
    const { AiSuggestionCardController } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const ctrl = new AiSuggestionCardController(
      {
        requestId: 'r2',
        presetKind: 'polish',
        range: { from: 0, to: 1 },
        originalText: 'x',
        insertOnly: false,
        model: 'haiku',
      },
      { onApply: vi.fn(), onCancel: vi.fn(), onReRequest: vi.fn(), onListFallback: vi.fn() },
    );
    ctrl.onError({ kind: 'network', message: '네트워크에 연결할 수 없어요' });
    expect(ctrl.getState().phase).toBe('error');
    expect(ctrl.getState().errorKind).toBe('network');
  });
});

describe('toolbar → card seam: request carries the range, card binds + applies to it', () => {
  it('buildSelectionRequest carries the selection range + original snapshot', async () => {
    const { buildSelectionRequest } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const req = buildSelectionRequest({
      requestId: 'r',
      presetKind: 'polish',
      selection: 'hello',
      contextBefore: '',
      contextAfter: '',
      model: 'haiku',
      from: 6,
      to: 11,
      originalText: 'hello',
    });
    expect(req.range).toEqual({ from: 6, to: 11 });
    expect(req.originalText).toBe('hello');
  });

  it('startSuggestionCard binds the active controller to the request range', async () => {
    const card = await import('@/components/editor/extensions/ai-suggestion-card');
    const ctrl = card.startSuggestionCard({
      args: { requestId: 'sc1', feature: 'inline-edit', presetKind: 'polish', model: 'haiku', selection: 'hello' },
      insertOnly: false,
      range: { from: 6, to: 11 },
      originalText: 'hello',
    });
    expect(card.getActiveCardController()).toBe(ctrl);
    expect(ctrl.model.range).toEqual({ from: 6, to: 11 });
    expect(ctrl.model.originalText).toBe('hello');
  });

  it('apply replaces exactly the previewed range', async () => {
    const card = await import('@/components/editor/extensions/ai-suggestion-card');
    const { view, getDoc } = createApplyView('intro hello outro', 6, 11);
    card.setActiveEditorView(view);
    const ctrl = card.startSuggestionCard({
      args: { requestId: 'sc2', feature: 'inline-edit', presetKind: 'polish', model: 'haiku', selection: 'hello' },
      insertOnly: false,
      range: { from: 6, to: 11 },
      originalText: 'hello',
    });
    ctrl.onComplete('HELLO-NEW');
    ctrl.getRenderInput().callbacks.onApply('replace');
    expect(getDoc()).toBe('intro HELLO-NEW outro');
  });

  it('apply is blocked when the original range text changed (stale, REQ-AI-035)', async () => {
    const card = await import('@/components/editor/extensions/ai-suggestion-card');
    const { view, getDoc } = createApplyView('intro hello outro', 6, 11);
    card.setActiveEditorView(view);
    const ctrl = card.startSuggestionCard({
      args: { requestId: 'sc3', feature: 'inline-edit', presetKind: 'polish', model: 'haiku', selection: 'hello' },
      insertOnly: false,
      range: { from: 6, to: 11 },
      originalText: 'hello',
    });
    ctrl.onComplete('WHATEVER');
    // Original range text mutated after the card was created.
    view.dispatch({ changes: { from: 6, to: 11, insert: 'MUTATED' } });
    ctrl.getRenderInput().callbacks.onApply('replace');
    expect(ctrl.getState().phase).toBe('stale');
    expect(getDoc()).toContain('MUTATED');
    expect(getDoc()).not.toContain('WHATEVER');
  });
});

describe('card registry: review cards survive new requests (§3, REQ-AI-034)', () => {
  it('a done (review) card survives a new request and can still apply', async () => {
    const card = await import('@/components/editor/extensions/ai-suggestion-card');
    card.clearCardRegistry();
    const { view, getDoc } = createApplyView('intro hello outro', 6, 11);
    card.setActiveEditorView(view);

    const c1 = card.startSuggestionCard({
      args: { requestId: 'rev-a', feature: 'inline-edit', presetKind: 'polish', model: 'haiku', selection: 'hello' },
      insertOnly: false,
      range: { from: 6, to: 11 },
      originalText: 'hello',
    });
    c1.onComplete('DONE-A'); // c1 → done (review state)

    // New request arrives while c1 is under review.
    const c2 = card.startSuggestionCard({
      args: { requestId: 'rev-b', feature: 'inline-edit', presetKind: 'polish', model: 'haiku', selection: 'int' },
      insertOnly: false,
      range: { from: 0, to: 3 },
      originalText: 'int',
    });

    // c1 is NOT disturbed by the new request.
    expect(c1.getState().phase).toBe('done');
    expect(card.getCardControllers()).toContain(c1);
    expect(card.getCardControllers()).toContain(c2);

    // c1 still applies to its own range.
    c1.getRenderInput().callbacks.onApply('replace');
    expect(getDoc()).toContain('DONE-A');
  });

  it('an in-flight (streaming) card is cancelled by a new request with a visible notice', async () => {
    const card = await import('@/components/editor/extensions/ai-suggestion-card');
    card.clearCardRegistry();
    const c1 = card.startSuggestionCard({
      args: { requestId: 'sf-a', feature: 'inline-edit', presetKind: 'polish', model: 'haiku', selection: 'x' },
      insertOnly: false,
      range: { from: 0, to: 1 },
      originalText: 'x',
    });
    expect(c1.getState().phase).toBe('streaming');

    card.startSuggestionCard({
      args: { requestId: 'sf-b', feature: 'inline-edit', presetKind: 'polish', model: 'haiku', selection: 'y' },
      insertOnly: false,
      range: { from: 2, to: 3 },
      originalText: 'y',
    });
    expect(c1.getState().phase).toBe('cancelled-by-new');
  });

  it('two cards register at distinct ranges', async () => {
    const card = await import('@/components/editor/extensions/ai-suggestion-card');
    card.clearCardRegistry();
    const c1 = card.startSuggestionCard({
      args: { requestId: 'two-a', feature: 'inline-edit', presetKind: 'polish', model: 'haiku', selection: 'hello' },
      insertOnly: false,
      range: { from: 6, to: 11 },
      originalText: 'hello',
    });
    c1.onComplete('A'); // review, so it survives
    card.startSuggestionCard({
      args: { requestId: 'two-b', feature: 'inline-edit', presetKind: 'polish', model: 'haiku', selection: 'int' },
      insertOnly: false,
      range: { from: 0, to: 3 },
      originalText: 'int',
    });
    const ranges = card.getCardControllers().map((c) => c.model.range);
    expect(ranges).toContainEqual({ from: 6, to: 11 });
    expect(ranges).toContainEqual({ from: 0, to: 3 });
  });
});

describe('AppLayout integration: settings modal + relay wiring', () => {
  it('opens the settings modal when the gear is clicked and does not crash with the relay wired', async () => {
    vi.resetModules();
    vi.doMock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }));
    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: vi.fn((cmd: string) => {
        if (cmd === 'ai_detect_providers') {
          return Promise.resolve([{ id: 'claude', installed: true, loggedIn: true }]);
        }
        if (cmd === 'ai_policy_status') return Promise.resolve({ disabled: false });
        return Promise.resolve(undefined);
      }),
    }));
    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
    const { default: App } = await import('../App');

    render(<App />);
    // Modal closed initially.
    expect(screen.queryByTestId('settings-backdrop')).toBeNull();

    fireEvent.click(screen.getByLabelText('Settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-backdrop')).toBeInTheDocument();
    });
  });
});
