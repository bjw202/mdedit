// @MX:SPEC: SPEC-AI-005 REQ-AI5-007 REQ-AI5-008 REQ-AI5-009 REQ-AI5-010 REQ-AI5-011 REQ-AI5-012
// @MX:SPEC: SPEC-AI-005 REQ-AI5-013 REQ-AI5-014
// AI 기능 사용자 켜기/끄기 토글 — effectiveAiEnabled 진리표, 표면 게이트 4지점 OFF 매트릭스,
// OFF 부수효과(취소+정리). TDD RED phase: written before the SPEC-AI-005 gates land.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...a: unknown[]) => aiRequestMock(...a),
  aiCancel: (...a: unknown[]) => aiCancelMock(...a),
  ipcErrorMessage: (e: unknown) => String(e),
}));

function createTestView(doc: string, from: number, to: number = from): EditorView {
  const state = EditorState.create({ doc, selection: EditorSelection.single(from, to) });
  return { get state() { return state; } } as unknown as EditorView;
}

async function mountGhost(doc: string, pos: number) {
  const { createAiGhostText } = await import('@/components/editor/extensions/ai-ghost-text');
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(pos),
    extensions: [createAiGhostText()],
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
  const { useUIStore } = await import('@/store/uiStore');
  useUIStore.setState({ aiEnabled: true, aiAdvancedModel: false });
  const { setAiPolicyDisabled } = await import('@/store/aiPolicy');
  setAiPolicyDisabled(false);
  const { useAiStore, idleSlice } = await import('@/store/aiStore');
  useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
  const { clearCardRegistry, setActiveEditorView } = await import(
    '@/components/editor/extensions/ai-suggestion-card'
  );
  clearCardRegistry();
  setActiveEditorView(null);
});

afterEach(async () => {
  const { setAiPolicyDisabled } = await import('@/store/aiPolicy');
  setAiPolicyDisabled(false);
  const { clearCardRegistry, setActiveEditorView } = await import(
    '@/components/editor/extensions/ai-suggestion-card'
  );
  clearCardRegistry();
  setActiveEditorView(null);
  vi.useRealTimers();
});

describe('getEffectiveAiEnabled: policy x user truth table (REQ-AI5-013)', () => {
  it('policy off + user on -> enabled', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    const { setAiPolicyDisabled, getEffectiveAiEnabled } = await import('@/store/aiPolicy');
    useUIStore.setState({ aiEnabled: true });
    setAiPolicyDisabled(false);
    expect(getEffectiveAiEnabled()).toBe(true);
  });

  it('policy off + user off -> disabled', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    const { setAiPolicyDisabled, getEffectiveAiEnabled } = await import('@/store/aiPolicy');
    useUIStore.setState({ aiEnabled: false });
    setAiPolicyDisabled(false);
    expect(getEffectiveAiEnabled()).toBe(false);
  });

  it('policy on + user on -> disabled (policy wins, REQ-AI5-014)', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    const { setAiPolicyDisabled, getEffectiveAiEnabled } = await import('@/store/aiPolicy');
    useUIStore.setState({ aiEnabled: true });
    setAiPolicyDisabled(true);
    expect(getEffectiveAiEnabled()).toBe(false);
  });

  it('policy on + user off -> disabled', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    const { setAiPolicyDisabled, getEffectiveAiEnabled } = await import('@/store/aiPolicy');
    useUIStore.setState({ aiEnabled: false });
    setAiPolicyDisabled(true);
    expect(getEffectiveAiEnabled()).toBe(false);
  });
});

describe('buildToolbarDecorations: effectiveAiEnabled gate (REQ-AI5-007)', () => {
  it('renders no ✨ decoration when the user toggle is off', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiEnabled: false });
    const { buildToolbarDecorations } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const view = createTestView('hello world', 0, 5);
    expect(buildToolbarDecorations(view, {}).size).toBe(0);
  });

  it('renders no ✨ decoration when policy-disabled even though the user toggle is on (REQ-AI5-014)', async () => {
    const { setAiPolicyDisabled } = await import('@/store/aiPolicy');
    setAiPolicyDisabled(true);
    const { buildToolbarDecorations } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const view = createTestView('hello world', 0, 5);
    expect(buildToolbarDecorations(view, {}).size).toBe(0);
  });

  it('recovers immediately when re-enabled, no reload required (REQ-AI5-010)', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiEnabled: false });
    const { buildToolbarDecorations } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const view = createTestView('hello world', 0, 5);
    expect(buildToolbarDecorations(view, {}).size).toBe(0);

    useUIStore.setState({ aiEnabled: true });
    expect(buildToolbarDecorations(view, {}).size).toBe(1);
  });
});

describe('idle hint: effectiveAiEnabled gate (REQ-AI5-008)', () => {
  it('never shows the hint pill while the user toggle is off', async () => {
    vi.useFakeTimers();
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiEnabled: false });
    const doc = '본문 내용입니다.\n';
    const { view, destroy } = await mountGhost(doc, doc.length);
    try {
      vi.advanceTimersByTime(5000);
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
      expect(aiRequestMock).not.toHaveBeenCalled();
    } finally {
      destroy();
    }
  });

  it('never shows the hint pill while policy-disabled (REQ-AI5-014)', async () => {
    vi.useFakeTimers();
    const { setAiPolicyDisabled } = await import('@/store/aiPolicy');
    setAiPolicyDisabled(true);
    const doc = '본문 내용입니다.\n';
    const { view, destroy } = await mountGhost(doc, doc.length);
    try {
      vi.advanceTimersByTime(5000);
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
    } finally {
      destroy();
    }
  });

  it('re-arms and shows the hint after re-enabling on the next interaction (REQ-AI5-010)', async () => {
    vi.useFakeTimers();
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiEnabled: false });
    const doc = '본문 내용입니다.\n';
    const { view, destroy } = await mountGhost(doc, doc.length);
    try {
      vi.advanceTimersByTime(5000);
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();

      useUIStore.setState({ aiEnabled: true });
      // 토글 이후 첫 상호작용(선택 갱신)이 재무장을 트리거한다 — 재시작/재로드 불요.
      view.dispatch({ selection: EditorSelection.cursor(doc.length) });
      vi.advanceTimersByTime(3000);
      expect(view.dom.querySelector('.cm-ai-hint')).not.toBeNull();
    } finally {
      destroy();
    }
  });
});

describe('Mod+Enter: new-trigger branch blocked while disabled, confirm always allowed (REQ-AI5-009)', () => {
  it('rejects the new section-fill trigger and calls no aiRequest (token 0)', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiEnabled: false });
    const { aiGhostKeymap } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mountGhost(doc, doc.length);
    try {
      const modEnter = aiGhostKeymap.find((b) => b.key === 'Mod-Enter')!.run!;
      expect(modEnter(view)).toBe(false);
      expect(aiRequestMock).not.toHaveBeenCalled();
    } finally {
      destroy();
    }
  });

  it('rejects the new trigger when policy-disabled (REQ-AI5-014)', async () => {
    const { setAiPolicyDisabled } = await import('@/store/aiPolicy');
    setAiPolicyDisabled(true);
    const { aiGhostKeymap } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mountGhost(doc, doc.length);
    try {
      const modEnter = aiGhostKeymap.find((b) => b.key === 'Mod-Enter')!.run!;
      expect(modEnter(view)).toBe(false);
      expect(aiRequestMock).not.toHaveBeenCalled();
    } finally {
      destroy();
    }
  });

  it('still confirms an already-active ghost while disabled (D3 — cleanup, not the confirm branch, owns disposal)', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    const { aiGhostKeymap, startGhostEffect, setGhostTextEffect } = await import(
      '@/components/editor/extensions/ai-ghost-text'
    );
    const doc = '본문\n';
    const { view, destroy } = await mountGhost(doc, doc.length);
    try {
      view.dispatch({
        effects: [startGhostEffect.of({ from: doc.length }), setGhostTextEffect.of('추가 텍스트')],
      });
      useUIStore.setState({ aiEnabled: false });
      const modEnter = aiGhostKeymap.find((b) => b.key === 'Mod-Enter')!.run!;
      expect(modEnter(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(doc + '추가 텍스트');
    } finally {
      destroy();
    }
  });

  it('re-enabling immediately allows the new trigger again, no reload required (REQ-AI5-010)', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiEnabled: false });
    const { aiGhostKeymap } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, destroy } = await mountGhost(doc, doc.length);
    try {
      const modEnter = aiGhostKeymap.find((b) => b.key === 'Mod-Enter')!.run!;
      expect(modEnter(view)).toBe(false);

      useUIStore.setState({ aiEnabled: true });
      expect(modEnter(view)).toBe(true);
      expect(aiRequestMock).toHaveBeenCalledTimes(1);
    } finally {
      destroy();
    }
  });
});

describe('aiOffEffects: ON->OFF transition cleanup (REQ-AI5-011/012)', () => {
  it('does nothing when nothing is active (no spurious cancel)', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    const { initAiToggleEffects } = await import('@/lib/ai/aiOffEffects');
    const unsub = initAiToggleEffects();
    try {
      useUIStore.getState().setAiEnabled(false);
      expect(aiCancelMock).not.toHaveBeenCalled();
    } finally {
      unsub();
    }
  });

  it('cancels the in-flight request exactly once on ON->OFF, no extra cancel on OFF->OFF', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    const { useAiStore } = await import('@/store/aiStore');
    const { initAiToggleEffects } = await import('@/lib/ai/aiOffEffects');
    useAiStore.setState({ requestState: 'streaming', requestId: 'req-off-1' });
    const unsub = initAiToggleEffects();
    try {
      useUIStore.getState().setAiEnabled(false);
      expect(aiCancelMock).toHaveBeenCalledTimes(1);
      expect(aiCancelMock).toHaveBeenCalledWith('req-off-1');
      expect(useAiStore.getState().requestState).toBe('idle');

      useUIStore.getState().setAiEnabled(false);
      expect(aiCancelMock).toHaveBeenCalledTimes(1);
    } finally {
      unsub();
    }
  });

  it('clears the active ghost without touching the document body (REQ-AI5-012)', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    const { aiGhostField, startGhostEffect, setGhostTextEffect } = await import(
      '@/components/editor/extensions/ai-ghost-text'
    );
    const { setActiveEditorView } = await import('@/components/editor/extensions/ai-suggestion-card');
    const { initAiToggleEffects } = await import('@/lib/ai/aiOffEffects');

    const doc = '본문 내용\n';
    const { view, destroy } = await mountGhost(doc, doc.length);
    setActiveEditorView(view);
    view.dispatch({
      effects: [startGhostEffect.of({ from: doc.length }), setGhostTextEffect.of('아직 삽입 안 된 산출물')],
    });
    expect(view.state.field(aiGhostField, false)).not.toBeNull();

    const unsub = initAiToggleEffects();
    try {
      useUIStore.getState().setAiEnabled(false);
      expect(view.state.field(aiGhostField, false)).toBeNull();
      expect(view.state.doc.toString()).toBe(doc);
    } finally {
      unsub();
      setActiveEditorView(null);
      destroy();
    }
  });

  it('clears streaming/reviewing suggestion cards on OFF', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    const { startSuggestionCard, getCardControllers } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const { initAiToggleEffects } = await import('@/lib/ai/aiOffEffects');

    startSuggestionCard({
      args: {
        requestId: 'card-off-1',
        feature: 'inline-edit',
        presetKind: 'polish',
        model: 'haiku',
        selection: 'x',
      },
      insertOnly: false,
      range: { from: 0, to: 1 },
      originalText: 'x',
    });
    expect(getCardControllers().length).toBe(1);

    const unsub = initAiToggleEffects();
    try {
      useUIStore.getState().setAiEnabled(false);
      expect(getCardControllers().length).toBe(0);
    } finally {
      unsub();
    }
  });
});
