// @MX:SPEC: SPEC-AI-009 REQ-AI9-039 REQ-AI9-040 REQ-AI9-041 REQ-AI9-042 REQ-AI9-043 REQ-AI9-044
// 고스트 terminal-empty 상태 — section-fill 요청이 실질적 빈 값(trim()==='')으로 종결되면
// "✨ 작성 중…" 플레이스홀더 + [✓ 넣기]가 아니라 안내 문구 + [✕ 닫기] 1개만 렌더한다(결함 4 수정).
// TDD RED phase: aiGhostEmptyDone.repro.test.ts 의 정식 전환본(plan.md M9.1/M9.5).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { WAIT_NOTICE_DELAY_MS } from '@/lib/ai/waitNotice';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...a: unknown[]) => aiRequestMock(...a),
  aiCancel: (...a: unknown[]) => aiCancelMock(...a),
  ipcErrorMessage: (e: unknown) => String(e),
}));

const DOC = 'Question: 15 나누기 3 더하기 20은 얼마인가요?\n';

async function mount(doc: string, pos: number) {
  const mod = await import('@/components/editor/extensions/ai-ghost-text');
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(pos),
    extensions: [mod.createAiGhostText()],
  });
  const view = new EditorView({ state, parent });
  return {
    mod,
    view,
    destroy: () => {
      view.destroy();
      document.body.removeChild(parent);
    },
  };
}

function ghostBtnLabels(view: EditorView): string[] {
  return Array.from(
    view.dom.querySelectorAll('.cm-ai-ghost-controls .cm-ai-ghost-btn'),
  ).map((b) => b.textContent ?? '');
}

beforeEach(async () => {
  aiRequestMock.mockClear();
  aiCancelMock.mockClear();
  const { useAiStore, idleSlice } = await import('@/store/aiStore');
  useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
  // jsdom does not implement Range.getClientRects, which CodeMirror's real rAF-driven
  // measure() needs — stub rAF to a no-op so real-timer awaits in this file don't crash
  // (see setup.ts BUG-8 note for the same class of jsdom gap).
  vi.stubGlobal('requestAnimationFrame', () => 0);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ghost terminal-empty regression (AC-AI9-026)', () => {
  it('does not render the waiting placeholder together with an apply control when done completes empty', async () => {
    const { view, destroy } = await mount(DOC, DOC.length);
    const { useAiStore } = await import('@/store/aiStore');
    try {
      const anchor = DOC.length;
      const { startGhostEffect } = await import('@/components/editor/extensions/ai-ghost-text');
      view.dispatch({ effects: startGhostEffect.of({ from: anchor }) });
      useAiStore.getState().startRequest('req-1', 'section-fill');

      useAiStore.getState().completeRequest('', false);
      await Promise.resolve();

      // (1) waiting placeholder must be gone.
      expect(view.dom.querySelector('.mdedit-ai-ghost-placeholder')).toBeNull();
      // (2) no apply ("넣기") control.
      const labels = ghostBtnLabels(view);
      expect(labels.some((l) => l.includes('넣기'))).toBe(false);
      // (3) exactly one dismiss ("닫기") control.
      const dismissButtons = labels.filter((l) => l.includes('닫기'));
      expect(dismissButtons.length).toBe(1);
      // (4) no wait notice lingering.
      expect(view.dom.querySelector('.mdedit-ai-wait-notice')).toBeNull();
    } finally {
      destroy();
    }
  });
});

describe('ghost terminal-empty render contract (AC-AI9-025)', () => {
  async function completeEmpty(finalText: string) {
    const { view, destroy } = await mount(DOC, DOC.length);
    const { useAiStore } = await import('@/store/aiStore');
    const { startGhostEffect } = await import('@/components/editor/extensions/ai-ghost-text');
    view.dispatch({ effects: startGhostEffect.of({ from: DOC.length }) });
    useAiStore.getState().startRequest('req-1', 'section-fill');
    useAiStore.getState().completeRequest(finalText, false);
    await Promise.resolve();
    return { view, destroy };
  }

  it('renders the "no more content" notice with exactly one dismiss control and no redo control', async () => {
    const { view, destroy } = await completeEmpty('');
    try {
      expect(view.dom.textContent).toContain('더 쓸 내용을 찾지 못했어요');
      const labels = ghostBtnLabels(view);
      expect(labels.filter((l) => l.includes('닫기')).length).toBe(1);
      expect(view.dom.querySelector('.cm-ai-ghost-redo-btn')).toBeNull();
    } finally {
      destroy();
    }
  });

  it.each([['   '], ['\n\n'], [' \n ']])(
    'treats whitespace-only final text %j the same as empty (terminal-empty)',
    async (finalText) => {
      const { view, destroy } = await completeEmpty(finalText);
      try {
        expect(view.dom.textContent).toContain('더 쓸 내용을 찾지 못했어요');
        expect(view.dom.querySelector('.mdedit-ai-ghost-placeholder')).toBeNull();
        const labels = ghostBtnLabels(view);
        expect(labels.some((l) => l.includes('넣기'))).toBe(false);
        expect(labels.filter((l) => l.includes('닫기')).length).toBe(1);
      } finally {
        destroy();
      }
    },
  );

  it('keeps the existing 2-button done render for non-empty final text (exclusive states)', async () => {
    const { view, destroy } = await completeEmpty('실제로 이어붙일 문장입니다.');
    try {
      expect(view.dom.textContent).not.toContain('더 쓸 내용을 찾지 못했어요');
      const labels = ghostBtnLabels(view);
      expect(labels.length).toBe(2);
      expect(labels[0]).toContain('넣기');
      expect(labels[1]).toContain('지우기');
      expect(view.dom.querySelector('.cm-ai-ghost-redo-btn')).not.toBeNull();
    } finally {
      destroy();
    }
  });

  it('keeps the existing waiting placeholder while status is streaming with empty text', async () => {
    const { view, destroy } = await mount(DOC, DOC.length);
    const { useAiStore } = await import('@/store/aiStore');
    const { startGhostEffect } = await import('@/components/editor/extensions/ai-ghost-text');
    try {
      view.dispatch({ effects: startGhostEffect.of({ from: DOC.length }) });
      useAiStore.getState().startRequest('req-1', 'section-fill');
      await Promise.resolve();

      expect(view.dom.querySelector('.mdedit-ai-ghost-placeholder')).not.toBeNull();
      expect(view.dom.textContent).not.toContain('더 쓸 내용을 찾지 못했어요');
    } finally {
      destroy();
    }
  });
});

describe('ghost terminal-empty non-corruption + no silent auto-dismiss (AC-AI9-027)', () => {
  it('leaves document text byte-identical across render and dismiss', async () => {
    const { view, destroy } = await mount(DOC, DOC.length);
    const { useAiStore } = await import('@/store/aiStore');
    const { startGhostEffect } = await import('@/components/editor/extensions/ai-ghost-text');
    try {
      const before = view.state.doc.toString();
      view.dispatch({ effects: startGhostEffect.of({ from: DOC.length }) });
      useAiStore.getState().startRequest('req-1', 'section-fill');
      useAiStore.getState().completeRequest('', false);
      await Promise.resolve();
      expect(view.state.doc.toString()).toBe(before);

      const closeBtn = view.dom.querySelector('.cm-ai-ghost-controls .cm-ai-ghost-btn') as HTMLButtonElement;
      closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(view.state.doc.toString()).toBe(before);
    } finally {
      destroy();
    }
  });

  it('does not silently auto-dismiss the terminal-empty ghost over time', async () => {
    const { view, destroy } = await mount(DOC, DOC.length);
    const { useAiStore } = await import('@/store/aiStore');
    const { startGhostEffect, aiGhostField } = await import('@/components/editor/extensions/ai-ghost-text');
    try {
      view.dispatch({ effects: startGhostEffect.of({ from: DOC.length }) });
      useAiStore.getState().startRequest('req-1', 'section-fill');
      useAiStore.getState().completeRequest('', false);
      await Promise.resolve();
      expect(view.state.field(aiGhostField, false)).not.toBeNull();

      // No auto-dismiss timer exists for terminal-empty — advancing real time changes nothing
      // without a user action (REQ-AI9-042 (b), 무통보 취소 금지 P7).
      await new Promise((resolve) => setTimeout(resolve, WAIT_NOTICE_DELAY_MS / 100));
      expect(view.state.field(aiGhostField, false)).not.toBeNull();
    } finally {
      destroy();
    }
  });

  it('close reuses dismissGhostCommand and does not fire a cancel IPC (request already done)', async () => {
    const { view, destroy } = await mount(DOC, DOC.length);
    const { useAiStore } = await import('@/store/aiStore');
    const { startGhostEffect, aiGhostField } = await import('@/components/editor/extensions/ai-ghost-text');
    try {
      view.dispatch({ effects: startGhostEffect.of({ from: DOC.length }) });
      useAiStore.getState().startRequest('req-1', 'section-fill');
      useAiStore.getState().completeRequest('', false);
      await Promise.resolve();

      const closeBtn = view.dom.querySelector('.cm-ai-ghost-controls .cm-ai-ghost-btn') as HTMLButtonElement;
      closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(view.state.field(aiGhostField, false)).toBeNull();
      expect(aiCancelMock).not.toHaveBeenCalled();
    } finally {
      destroy();
    }
  });
});

describe('ghost terminal-empty edge cases (EC-11, EC-12)', () => {
  it('EC-11: a delayed non-empty chunk after terminal-empty naturally transitions to the normal done render', async () => {
    const { view, destroy } = await mount(DOC, DOC.length);
    const { useAiStore } = await import('@/store/aiStore');
    const { startGhostEffect } = await import('@/components/editor/extensions/ai-ghost-text');
    try {
      const before = view.state.doc.toString();
      view.dispatch({ effects: startGhostEffect.of({ from: DOC.length }) });
      useAiStore.getState().startRequest('req-1', 'section-fill');
      useAiStore.getState().completeRequest('', false);
      await Promise.resolve();
      expect(view.dom.textContent).toContain('더 쓸 내용을 찾지 못했어요');

      // Delayed chunk arrives after the terminal-empty render (streamBuffer becomes non-empty).
      useAiStore.getState().appendChunk('지연 도착한 내용');
      await Promise.resolve();

      expect(view.dom.textContent).not.toContain('더 쓸 내용을 찾지 못했어요');
      const labels = ghostBtnLabels(view);
      expect(labels.length).toBe(2);
      expect(labels[0]).toContain('넣기');
      expect(view.state.doc.toString()).toBe(before);
    } finally {
      destroy();
    }
  });

  it('EC-12: Esc dismisses the terminal-empty ghost via the existing escape path', async () => {
    const { view, destroy } = await mount(DOC, DOC.length);
    const { useAiStore } = await import('@/store/aiStore');
    const { startGhostEffect, aiGhostField, dismissGhostCommand } = await import(
      '@/components/editor/extensions/ai-ghost-text'
    );
    try {
      view.dispatch({ effects: startGhostEffect.of({ from: DOC.length }) });
      useAiStore.getState().startRequest('req-1', 'section-fill');
      useAiStore.getState().completeRequest('', false);
      await Promise.resolve();
      expect(view.state.field(aiGhostField, false)).not.toBeNull();

      dismissGhostCommand(view);

      expect(view.state.field(aiGhostField, false)).toBeNull();
    } finally {
      destroy();
    }
  });
});
