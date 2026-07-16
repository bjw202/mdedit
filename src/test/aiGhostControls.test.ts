// @MX:SPEC: SPEC-AI-001 REQ-AI-029 REQ-AI-030
// 고스트 컨트롤 버튼 — 스트리밍 중 [■ 중지], 완료(done) 시 [✓ 넣기]·[✕ 지우기].
// TDD RED phase: written before GhostControlsWidget lands in ai-ghost-text.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { undo, history } from '@codemirror/commands';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...a: unknown[]) => aiRequestMock(...a),
  aiCancel: (...a: unknown[]) => aiCancelMock(...a),
  ipcErrorMessage: (e: unknown) => String(e),
}));

async function mount(doc: string, pos: number) {
  const { aiGhostField, aiGhostKeymap } = await import('@/components/editor/extensions/ai-ghost-text');
  const { keymap } = await import('@codemirror/view');
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(pos),
    extensions: [history(), aiGhostField, keymap.of(aiGhostKeymap)],
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
  aiRequestMock.mockClear();
  aiCancelMock.mockClear();
  const { useAiStore, idleSlice } = await import('@/store/aiStore');
  useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
});

describe('ghost controls: streaming shows only [■ 중지]', () => {
  it('renders a single stop button while status is streaming', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
      view.dispatch({ effects: mod.setGhostTextEffect.of('작성 중인 초안') });
      view.dispatch({ effects: mod.setGhostStatusEffect.of('streaming') });

      const controls = view.dom.querySelector('.cm-ai-ghost-controls');
      expect(controls).not.toBeNull();
      const buttons = controls?.querySelectorAll('.cm-ai-ghost-btn');
      expect(buttons?.length).toBe(1);
      expect(buttons?.[0].textContent).toContain('중지');
    } finally {
      destroy();
    }
  });

  it('clicking stop cancels the in-flight request and clears the ghost', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    useAiStore.setState({ requestState: 'streaming', requestId: 'req-1', feature: 'section-fill' });

    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
      view.dispatch({ effects: mod.setGhostTextEffect.of('작성 중') });
      view.dispatch({ effects: mod.setGhostStatusEffect.of('streaming') });

      const stop = view.dom.querySelector('.cm-ai-ghost-btn') as HTMLButtonElement;
      stop.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(aiCancelMock).toHaveBeenCalledWith('req-1');
      expect(view.state.field(mod.aiGhostField)).toBeNull();
    } finally {
      destroy();
    }
  });
});

describe('ghost controls: done shows [✓ 넣기] and [✕ 지우기]', () => {
  it('renders both apply and dismiss buttons when status is done', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
      view.dispatch({ effects: mod.setGhostTextEffect.of('완성된 초안입니다.') });
      view.dispatch({ effects: mod.setGhostStatusEffect.of('done') });

      const buttons = view.dom.querySelectorAll('.cm-ai-ghost-controls .cm-ai-ghost-btn');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toContain('넣기');
      expect(buttons[1].textContent).toContain('지우기');
    } finally {
      destroy();
    }
  });

  it('clicking [넣기] inserts the ghost text as a single transaction (undo restores)', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
      view.dispatch({ effects: mod.setGhostTextEffect.of('완성된 초안.') });
      view.dispatch({ effects: mod.setGhostStatusEffect.of('done') });

      const buttons = view.dom.querySelectorAll('.cm-ai-ghost-controls .cm-ai-ghost-btn');
      const apply = buttons[0] as HTMLButtonElement;
      apply.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(view.state.doc.toString()).toBe('# 결론\n완성된 초안.');
      expect(view.state.field(mod.aiGhostField)).toBeNull();

      undo(view);
      expect(view.state.doc.toString()).toBe(doc);
    } finally {
      destroy();
    }
  });

  it('clicking [지우기] clears the ghost without touching the document', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
      view.dispatch({ effects: mod.setGhostTextEffect.of('버릴 초안') });
      view.dispatch({ effects: mod.setGhostStatusEffect.of('done') });

      const buttons = view.dom.querySelectorAll('.cm-ai-ghost-controls .cm-ai-ghost-btn');
      const dismiss = buttons[1] as HTMLButtonElement;
      dismiss.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(view.state.field(mod.aiGhostField)).toBeNull();
      expect(view.state.doc.toString()).toBe(doc);
    } finally {
      destroy();
    }
  });
});
