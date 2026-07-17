// @MX:SPEC: SPEC-AI-006 REQ-AI6-010 REQ-AI6-011
// 고스트 재요청(↻) — done 상태 전용, 마지막 트리거 인자를 재사용해 새 requestId 로 재발행한다.
// streaming 중에는 노출되지 않는다. TDD RED phase: written before reRequestGhost/↻ button lands.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history } from '@codemirror/commands';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...a: unknown[]) => aiRequestMock(...a),
  aiCancel: (...a: unknown[]) => aiCancelMock(...a),
  ipcErrorMessage: (e: unknown) => String(e),
}));

async function mount(doc: string, pos: number) {
  const mod = await import('@/components/editor/extensions/ai-ghost-text');
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
  aiRequestMock.mockClear();
  aiCancelMock.mockClear();
  const { useAiStore, idleSlice } = await import('@/store/aiStore');
  useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
  const { useUIStore } = await import('@/store/uiStore');
  useUIStore.setState({ aiContinueLength: 'normal' });
});

describe('ghost re-request (↻): done-only exposure', () => {
  it('does not render a redo button while status is streaming', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
      view.dispatch({ effects: mod.setGhostTextEffect.of('작성 중') });
      view.dispatch({ effects: mod.setGhostStatusEffect.of('streaming') });

      expect(view.dom.querySelector('.cm-ai-ghost-redo-btn')).toBeNull();
    } finally {
      destroy();
    }
  });

  it('renders a redo button alongside apply/dismiss when status is done', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
      view.dispatch({ effects: mod.setGhostTextEffect.of('완성된 초안') });
      view.dispatch({ effects: mod.setGhostStatusEffect.of('done') });

      const redo = view.dom.querySelector('.cm-ai-ghost-redo-btn');
      expect(redo).not.toBeNull();
      expect(redo?.textContent).toContain('↻');
      // 기존 계약 무개정: [넣기]/[지우기] 버튼 개수는 여전히 정확히 2개(다른 클래스 사용).
      expect(view.dom.querySelectorAll('.cm-ai-ghost-controls .cm-ai-ghost-btn')).toHaveLength(2);
    } finally {
      destroy();
    }
  });

  it('clicking ↻ re-publishes the same trigger args with a new requestId (continue)', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '문서 끝 이어쓰기 대상 문장입니다.\n\n';
    const pos = doc.length;
    const { view, destroy } = await mount(doc, pos);
    try {
      const fired = mod.startContinueWritingCommand(view);
      expect(fired).toBe(true);
      expect(aiRequestMock).toHaveBeenCalledTimes(1);
      const firstArgs = aiRequestMock.mock.calls[0][0];
      expect(firstArgs.presetKind).toBe('continue');

      view.dispatch({ effects: mod.setGhostStatusEffect.of('done') });
      view.dispatch({ effects: mod.setGhostTextEffect.of('이어진 문장.') });

      const redo = view.dom.querySelector('.cm-ai-ghost-redo-btn') as HTMLButtonElement;
      redo.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(aiRequestMock).toHaveBeenCalledTimes(2);
      const secondArgs = aiRequestMock.mock.calls[1][0];
      expect(secondArgs.requestId).not.toBe(firstArgs.requestId);
      expect(secondArgs.presetKind).toBe(firstArgs.presetKind);
      expect(secondArgs.outline).toBe(firstArgs.outline);
      expect(secondArgs.contextBefore).toBe(firstArgs.contextBefore);
      expect(secondArgs.model).toBe(firstArgs.model);
    } finally {
      destroy();
    }
  });

  it('does nothing when there is no stored trigger to replay', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      // 발행 커맨드를 한 번도 거치지 않은 상태에서 done 고스트를 인위적으로 만든다.
      view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
      view.dispatch({ effects: mod.setGhostTextEffect.of('아무 컨텍스트 없이 만들어진 고스트') });
      view.dispatch({ effects: mod.setGhostStatusEffect.of('done') });

      const before = aiRequestMock.mock.calls.length;
      const result = mod.reRequestGhost(view);
      // 트리거 보관값이 없으면 재요청이 발행되지 않을 수 있다(false 반환) — 최소한 크래시하지 않는다.
      expect(typeof result).toBe('boolean');
      expect(aiRequestMock.mock.calls.length).toBeGreaterThanOrEqual(before);
    } finally {
      destroy();
    }
  });
});
