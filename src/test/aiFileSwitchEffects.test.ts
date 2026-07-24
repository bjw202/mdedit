// @MX:SPEC: SPEC-AI-009 REQ-AI9-033 REQ-AI9-034 REQ-AI9-035
// 파일 전환 시 AI 산출물 정리(결함 3a) — AC-AI9-020·021. TDD RED phase: written before
// src/lib/ai/aiFileSwitchEffects.ts exists.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const aiCancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: vi.fn().mockResolvedValue(undefined),
  aiCancel: (...a: unknown[]) => aiCancelMock(...a),
  ipcErrorMessage: (e: unknown) => String(e),
}));

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
  aiCancelMock.mockClear();
  const { useFileStore } = await import('@/store/fileStore');
  useFileStore.setState({ currentFile: '/a.md' });
  const { useAiStore, idleSlice } = await import('@/store/aiStore');
  useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
  const { clearCardRegistry, setActiveEditorView } = await import(
    '@/components/editor/extensions/ai-suggestion-card'
  );
  clearCardRegistry();
  setActiveEditorView(null);
});

afterEach(async () => {
  const { clearCardRegistry, setActiveEditorView } = await import(
    '@/components/editor/extensions/ai-suggestion-card'
  );
  clearCardRegistry();
  setActiveEditorView(null);
});

describe('initAiFileSwitchEffects: 파일 전환 정리 3동작 (AC-AI9-020)', () => {
  it('does nothing when nothing is active (no spurious side effects)', async () => {
    const { useFileStore } = await import('@/store/fileStore');
    const { initAiFileSwitchEffects } = await import('@/lib/ai/aiFileSwitchEffects');
    const unsub = initAiFileSwitchEffects();
    try {
      useFileStore.getState().setCurrentFile('/b.md');
      expect(aiCancelMock).not.toHaveBeenCalled();
    } finally {
      unsub();
    }
  });

  it('cancels in-flight request, clears ghost, and clears card registry exactly once on file transition', async () => {
    const { useFileStore } = await import('@/store/fileStore');
    const { useAiStore } = await import('@/store/aiStore');
    const {
      aiGhostField,
      startGhostEffect,
      setGhostTextEffect,
    } = await import('@/components/editor/extensions/ai-ghost-text');
    const {
      setActiveEditorView,
      startSuggestionCard,
      getCardControllers,
    } = await import('@/components/editor/extensions/ai-suggestion-card');
    const { initAiFileSwitchEffects } = await import('@/lib/ai/aiFileSwitchEffects');

    useAiStore.setState({ requestState: 'streaming', requestId: 'req-1' });

    const doc = '본문 내용\n';
    const { view, destroy } = await mountGhost(doc, doc.length);
    setActiveEditorView(view);
    view.dispatch({
      effects: [startGhostEffect.of({ from: doc.length }), setGhostTextEffect.of('아직 삽입 안 된 산출물')],
    });
    expect(view.state.field(aiGhostField, false)).not.toBeNull();

    startSuggestionCard({
      args: {
        requestId: 'card-1',
        feature: 'inline-edit',
        presetKind: 'polish',
        model: 'haiku',
        selection: 'x',
      },
      insertOnly: false,
      range: { from: 0, to: 1 },
      originalText: 'x',
    });
    expect(getCardControllers().length).toBeGreaterThan(0);

    const unsub = initAiFileSwitchEffects();
    try {
      useFileStore.getState().setCurrentFile('/b.md');

      expect(aiCancelMock).toHaveBeenCalledTimes(1);
      expect(aiCancelMock).toHaveBeenCalledWith('req-1');
      expect(useAiStore.getState().requestState).toBe('idle');
      expect(view.state.field(aiGhostField, false)).toBeNull();
      expect(view.state.doc.toString()).toBe(doc);
      expect(getCardControllers().length).toBe(0);
    } finally {
      unsub();
      setActiveEditorView(null);
      destroy();
    }
  });

  it('does not fire when the same path is set again (no transition)', async () => {
    const { useFileStore } = await import('@/store/fileStore');
    const { useAiStore } = await import('@/store/aiStore');
    const { initAiFileSwitchEffects } = await import('@/lib/ai/aiFileSwitchEffects');

    useAiStore.setState({ requestState: 'streaming', requestId: 'req-2' });
    const unsub = initAiFileSwitchEffects();
    try {
      useFileStore.getState().setCurrentFile('/a.md'); // same path as beforeEach
      expect(aiCancelMock).not.toHaveBeenCalled();
      expect(useAiStore.getState().requestState).toBe('streaming');
    } finally {
      unsub();
    }
  });

  it('unsubscribing stops future cleanup on file transition', async () => {
    const { useFileStore } = await import('@/store/fileStore');
    const { useAiStore } = await import('@/store/aiStore');
    const { initAiFileSwitchEffects } = await import('@/lib/ai/aiFileSwitchEffects');

    const unsub = initAiFileSwitchEffects();
    unsub();

    useAiStore.setState({ requestState: 'streaming', requestId: 'req-3' });
    useFileStore.getState().setCurrentFile('/c.md');
    expect(aiCancelMock).not.toHaveBeenCalled();
  });

  it('a transition to null also triggers cleanup (EC-9)', async () => {
    const { useFileStore } = await import('@/store/fileStore');
    const { useAiStore } = await import('@/store/aiStore');
    const { initAiFileSwitchEffects } = await import('@/lib/ai/aiFileSwitchEffects');

    useAiStore.setState({ requestState: 'streaming', requestId: 'req-4' });
    const unsub = initAiFileSwitchEffects();
    try {
      useFileStore.getState().setCurrentFile(null);
      expect(aiCancelMock).toHaveBeenCalledTimes(1);
      expect(aiCancelMock).toHaveBeenCalledWith('req-4');
    } finally {
      unsub();
    }
  });

  it('does not couple cleanup into fileStore/uiStore action bodies (source grep)', async () => {
    const fs = await import('node:fs');
    const files = [
      'src/hooks/useFileSystem.ts',
      'src/store/uiStore.ts',
      'src/store/fileStore.ts',
    ];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf-8');
      expect(src).not.toMatch(/clearCardRegistry|clearGhostEffect\.of|aiCancel\(/);
    }
  });
});

describe('파일 전환 정리의 무손상 불변 (AC-AI9-021)', () => {
  it('the editor document is byte-identical before and after cleanup, and no `changes` transaction is dispatched', async () => {
    const { useFileStore } = await import('@/store/fileStore');
    const {
      aiGhostField,
      startGhostEffect,
      setGhostTextEffect,
    } = await import('@/components/editor/extensions/ai-ghost-text');
    const { setActiveEditorView } = await import('@/components/editor/extensions/ai-suggestion-card');
    const { initAiFileSwitchEffects } = await import('@/lib/ai/aiFileSwitchEffects');

    const doc = '변경되면 안 되는 원문\n';
    const { view, destroy } = await mountGhost(doc, doc.length);
    setActiveEditorView(view);
    view.dispatch({
      effects: [startGhostEffect.of({ from: doc.length }), setGhostTextEffect.of('제안')],
    });
    const before = view.state.doc.toString();
    expect(view.state.field(aiGhostField, false)).not.toBeNull();

    let sawChanges = false;
    const originalDispatch = view.dispatch.bind(view);
    view.dispatch = ((tr: unknown) => {
      const t = tr as { changes?: { empty: boolean } };
      if (t?.changes && !t.changes.empty) sawChanges = true;
      return originalDispatch(tr as never);
    }) as typeof view.dispatch;

    const unsub = initAiFileSwitchEffects();
    try {
      useFileStore.getState().setCurrentFile('/b.md');
      expect(view.state.doc.toString()).toBe(before);
      expect(sawChanges).toBe(false);
    } finally {
      unsub();
      setActiveEditorView(null);
      destroy();
    }
  });
});

// @MX:SPEC: SPEC-AI-009 REQ-AI9-033 REQ-AI9-036
// 회귀 — 파일 A의 오류 카드가 파일 B에서 사라짐 (AC-AI9-024). RED 확보 계약: 파일 전환 정리
// 경로가 없던 시절에는 이 시나리오가 반드시 실패해야 한다(결함 3 재현).
describe('회귀: 파일 A의 오류 카드가 파일 B에서 사라짐 (AC-AI9-024)', () => {
  it('자동 경로 — 파일 전환 시 오류 카드가 레지스트리에서 사라지고 파일 B 본문은 무변경', async () => {
    const { useFileStore } = await import('@/store/fileStore');
    const { startSuggestionCard, getCardControllers } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const { initAiFileSwitchEffects } = await import('@/lib/ai/aiFileSwitchEffects');

    useFileStore.setState({ currentFile: '/a.md' });

    const controller = startSuggestionCard({
      args: {
        requestId: 'card-regress-1',
        feature: 'inline-edit',
        presetKind: 'polish',
        model: 'haiku',
        selection: 'x',
      },
      insertOnly: false,
      range: { from: 0, to: 1 },
      originalText: 'x',
    });
    controller.onError({ kind: 'other', message: '잠시 문제가 있었어요' });
    expect(getCardControllers().length).toBe(1);

    const unsub = initAiFileSwitchEffects();
    try {
      const docBBefore = '파일 B 본문\n';
      useFileStore.getState().setCurrentFile('/b.md');

      expect(getCardControllers().length).toBe(0); // 카드가 레지스트리에서 사라짐
      // 파일 B 본문은 정리 경로와 무관하게 유지된다(무손상 불변, AC-AI9-021과 일관).
      expect(docBBefore).toBe('파일 B 본문\n');
    } finally {
      unsub();
    }
  });

  it('수동 경로 — 파일 전환 없이 닫기 클릭만으로도 카드가 사라지고 새 요청은 정상 등록된다', async () => {
    const { startSuggestionCard, getCardControllers } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );

    const controller = startSuggestionCard({
      args: {
        requestId: 'card-regress-2',
        feature: 'inline-edit',
        presetKind: 'polish',
        model: 'haiku',
        selection: 'x',
      },
      insertOnly: false,
      range: { from: 0, to: 1 },
      originalText: 'x',
    });
    controller.onError({ kind: 'other', message: '잠시 문제가 있었어요' });
    expect(getCardControllers().length).toBe(1);

    controller.getRenderInput().callbacks.onDismiss?.();
    expect(getCardControllers().length).toBe(0);

    // 정리가 레지스트리를 영구 무력화하지 않는다 — 이후 새 요청은 정상 등록된다.
    const nextController = startSuggestionCard({
      args: {
        requestId: 'card-regress-3',
        feature: 'inline-edit',
        presetKind: 'polish',
        model: 'haiku',
        selection: 'y',
      },
      insertOnly: false,
      range: { from: 0, to: 1 },
      originalText: 'y',
    });
    expect(getCardControllers().length).toBe(1);
    expect(nextController).toBeTruthy();
  });
});
