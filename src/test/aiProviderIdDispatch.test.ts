// @MX:SPEC: SPEC-AI-009 REQ-AI9-003
// 사용자가 고른 AI provider(aiSelectedProvider)가 3개 발행 커맨드(startSectionFill/
// startContinueWriting/startFreeContinueWriting)의 aiRequest args.providerId 에 반영되는지
// 검증한다. aiContinueLengthDispatch.test.ts 와 동일한 패턴(발행 → 캡처 → 어설션).
// TDD RED phase: written before providerId wiring lands in ai-ghost-text.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...a: unknown[]) => aiRequestMock(...a),
  aiCancel: (...a: unknown[]) => aiCancelMock(...a),
  ipcErrorMessage: (e: unknown) => String(e),
}));

async function mount(doc: string, pos: number) {
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
  const { useAiStore, idleSlice } = await import('@/store/aiStore');
  useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
  const { useUIStore } = await import('@/store/uiStore');
  useUIStore.setState({ aiSelectedProvider: 'auto' });
});

describe('providerId dispatch (SPEC-AI-009 REQ-AI9-003)', () => {
  it('startSectionFillCommand omits providerId when selection is "auto" (backend auto-detect)', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiSelectedProvider: 'auto' });
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 제목\n\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      const fired = mod.startSectionFillCommand(view);
      expect(fired).toBe(true);
      expect(aiRequestMock).toHaveBeenCalledTimes(1);
      // 'auto' → undefined. JSON 직렬화 시 필드 생략이 자명하도록 undefined 임을 확인.
      expect(aiRequestMock.mock.calls[0][0].providerId).toBeUndefined();
    } finally {
      destroy();
    }
  });

  it('startSectionFillCommand carries providerId="claude" when selection is "claude"', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiSelectedProvider: 'claude' });
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 제목\n\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      mod.startSectionFillCommand(view);
      expect(aiRequestMock.mock.calls[0][0].providerId).toBe('claude');
    } finally {
      destroy();
    }
  });

  it('startSectionFillCommand carries providerId="codex" when selection is "codex"', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiSelectedProvider: 'codex' });
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 제목\n\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      mod.startSectionFillCommand(view);
      expect(aiRequestMock.mock.calls[0][0].providerId).toBe('codex');
    } finally {
      destroy();
    }
  });

  it('startContinueWritingCommand carries the persisted providerId ("codex")', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiSelectedProvider: 'codex' });
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '문서 끝 문장입니다.\n\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      const fired = mod.startContinueWritingCommand(view);
      expect(fired).toBe(true);
      expect(aiRequestMock).toHaveBeenCalledTimes(1);
      expect(aiRequestMock.mock.calls[0][0].providerId).toBe('codex');
    } finally {
      destroy();
    }
  });

  it('startFreeContinueWritingCommand carries the persisted providerId ("claude")', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiSelectedProvider: 'claude' });
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '앞 문장이 안 끝났음\n\n뒤쪽 실 내용';
    const cursorPos = doc.indexOf('앞 문장이 안 끝났음') + '앞 문장이 안 끝났음'.length;
    const { view, destroy } = await mount(doc, cursorPos);
    try {
      const fired = mod.startFreeContinueWritingCommand(view);
      expect(fired).toBe(true);
      expect(aiRequestMock).toHaveBeenCalledTimes(1);
      expect(aiRequestMock.mock.calls[0][0].providerId).toBe('claude');
    } finally {
      destroy();
    }
  });

  it('reRequestGhost uses the CURRENT providerId, not the original trigger selection', async () => {
    // 원본 발행은 'claude' 로 시작했지만, 재요청 시점에 사용자가 'codex' 로 바꾼 경우를 재현한다.
    const { useUIStore } = await import('@/store/uiStore');
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 제목\n\n';
    const { view, destroy } = await mount(doc, doc.length);

    try {
      useUIStore.setState({ aiSelectedProvider: 'claude' });
      mod.startSectionFillCommand(view);
      expect(aiRequestMock.mock.calls[0][0].providerId).toBe('claude');

      // 스트리밍 완료 후 done 상태로 전환 — reRequestGhost 가 동작하려면 done 이어야 한다.
      const { useAiStore } = await import('@/store/aiStore');
      useAiStore.getState().completeRequest('완성된 텍스트');

      // 사용자가 provider 를 codex 로 변경한 뒤 재요청(↻)
      useUIStore.setState({ aiSelectedProvider: 'codex' });
      const redone = mod.reRequestGhost(view);
      expect(redone).toBe(true);
      expect(aiRequestMock).toHaveBeenCalledTimes(2);
      expect(aiRequestMock.mock.calls[1][0].providerId).toBe('codex');
    } finally {
      destroy();
    }
  });
});
