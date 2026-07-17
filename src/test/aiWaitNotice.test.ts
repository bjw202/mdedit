// @MX:SPEC: SPEC-AI-006 REQ-AI6-007 REQ-AI6-008 REQ-AI6-009
// 장시간 대기 안내 문구 — 카드 스켈레톤·고스트 플레이스홀더 공통. 8초 무응답 시 보조 문구를
// 표시하고, 첫 청크/완료/오류/취소/언마운트 시 즉시 제거한다. 진행률 바는 절대 사용하지 않는다.
// TDD RED phase: written before the wait-notice timer lands in card.ts/ai-ghost-text.ts.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { WAIT_NOTICE_DELAY_MS, WAIT_NOTICE_TEXT } from '@/lib/ai/waitNotice';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...a: unknown[]) => aiRequestMock(...a),
  aiCancel: (...a: unknown[]) => aiCancelMock(...a),
  ipcErrorMessage: (e: unknown) => String(e),
}));

describe('WAIT_NOTICE constants', () => {
  it('delay defaults to 8000ms and has no percentage in its text', () => {
    expect(WAIT_NOTICE_DELAY_MS).toBe(8000);
    expect(WAIT_NOTICE_TEXT).not.toMatch(/%/);
    expect(WAIT_NOTICE_TEXT).toContain('취소');
  });
});

describe('card wait notice (REQ-AI6-007/008/009)', () => {
  let view: EditorView;

  beforeEach(async () => {
    vi.useFakeTimers();
    const { clearCardRegistry } = await import('@/components/editor/extensions/ai-suggestion-card');
    const { useAiStore } = await import('@/store/aiStore');
    clearCardRegistry();
    useAiStore.setState({ requestState: 'idle', streamBuffer: '', requestId: null, errorInfo: null });
    aiRequestMock.mockClear();
    aiCancelMock.mockClear();

    const { createAiSuggestionCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const state = EditorState.create({ doc: 'hello world', extensions: [createAiSuggestionCard()] });
    view = new EditorView({ state, parent });
  });

  afterEach(async () => {
    view.destroy();
    const { setActiveEditorView, clearCardRegistry } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    setActiveEditorView(null);
    clearCardRegistry();
    document.body.innerHTML = '';
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  async function startCard() {
    const { startSuggestionCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    return startSuggestionCard({
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
  }

  it('shows no wait notice before the delay elapses', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    useAiStore.setState({ requestState: 'streaming', requestId: 'wait-1', streamBuffer: '' });
    await startCard();

    vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS - 1);
    const card = view.dom.querySelector('.mdedit-ai-card')!;
    expect(card.textContent).not.toContain(WAIT_NOTICE_TEXT);
  });

  it('shows the wait notice once the delay elapses with no first chunk', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    useAiStore.setState({ requestState: 'streaming', requestId: 'wait-1', streamBuffer: '' });
    await startCard();

    vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS);
    const card = view.dom.querySelector('.mdedit-ai-card')!;
    expect(card.textContent).toContain(WAIT_NOTICE_TEXT);
  });

  it('never renders a fake progress element', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    useAiStore.setState({ requestState: 'streaming', requestId: 'wait-1', streamBuffer: '' });
    await startCard();

    vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS);
    const card = view.dom.querySelector('.mdedit-ai-card')!;
    expect(card.querySelector('progress')).toBeNull();
    expect(card.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('clears the wait notice once the first chunk arrives', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    useAiStore.setState({ requestState: 'streaming', requestId: 'wait-1', streamBuffer: '' });
    await startCard();

    vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS);
    expect(view.dom.querySelector('.mdedit-ai-card')!.textContent).toContain(WAIT_NOTICE_TEXT);

    useAiStore.setState({ streamBuffer: '첫 청크' });
    const card = view.dom.querySelector('.mdedit-ai-card')!;
    expect(card.textContent).not.toContain(WAIT_NOTICE_TEXT);
  });
});

describe('ghost wait notice (REQ-AI6-007/008/009)', () => {
  async function mount(doc: string, pos: number) {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const { history } = await import('@codemirror/commands');
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const state = EditorState.create({
      doc,
      selection: EditorSelection.single(pos),
      extensions: [history(), mod.createAiGhostText()],
    });
    const view = new EditorView({ state, parent });
    return {
      view,
      destroy: () => {
        view.destroy();
        document.body.removeChild(parent);
      },
    };
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    aiRequestMock.mockClear();
    aiCancelMock.mockClear();
    const { useAiStore, idleSlice } = await import('@/store/aiStore');
    useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('shows no wait notice on the placeholder before the delay elapses', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
      vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS - 1);
      const placeholder = view.dom.querySelector('.mdedit-ai-ghost-placeholder');
      expect(placeholder?.textContent).not.toContain(WAIT_NOTICE_TEXT);
    } finally {
      destroy();
    }
  });

  it('shows the wait notice on the placeholder after the delay elapses with no chunk', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
      vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS);
      const placeholder = view.dom.querySelector('.mdedit-ai-ghost-placeholder');
      expect(placeholder?.textContent).toContain(WAIT_NOTICE_TEXT);
    } finally {
      destroy();
    }
  });

  it('clears the wait notice once the first chunk arrives via the store bridge', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const { useAiStore } = await import('@/store/aiStore');
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
      vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS);
      expect(view.dom.querySelector('.mdedit-ai-ghost-placeholder')?.textContent).toContain(
        WAIT_NOTICE_TEXT,
      );

      useAiStore.setState({ requestState: 'streaming', requestId: 'g-1', feature: 'section-fill', streamBuffer: '첫 청크' });

      const ghostText = view.dom.querySelector('.cm-ai-ghost');
      expect(ghostText).not.toBeNull();
      expect(view.dom.textContent).not.toContain(WAIT_NOTICE_TEXT);
    } finally {
      destroy();
    }
  });
});
