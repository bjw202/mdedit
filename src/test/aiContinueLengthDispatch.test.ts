// @MX:SPEC: SPEC-AI-006 REQ-AI6-013 REQ-AI6-014
// 이어쓰기 길이 옵션이 continue 발행 2곳(startContinueWritingCommand/
// startFreeContinueWritingCommand)에만 실리고, 섹션 채우기(startSectionFillCommand)는 무영향임을
// 검증한다. TDD RED phase: written before `length` wiring lands in ai-ghost-text.ts.

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
});

describe('continue length dispatch (REQ-AI6-013/014)', () => {
  it('startContinueWritingCommand carries the persisted length setting ("short")', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiContinueLength: 'short' });
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '문서 끝 문장입니다.\n\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      const fired = mod.startContinueWritingCommand(view);
      expect(fired).toBe(true);
      expect(aiRequestMock).toHaveBeenCalledTimes(1);
      expect(aiRequestMock.mock.calls[0][0].length).toBe('short');
    } finally {
      destroy();
    }
  });

  it('startContinueWritingCommand defaults to "normal" when unset', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiContinueLength: 'normal' });
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '문서 끝 문장입니다.\n\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      mod.startContinueWritingCommand(view);
      expect(aiRequestMock.mock.calls[0][0].length).toBe('normal');
    } finally {
      destroy();
    }
  });

  it('startFreeContinueWritingCommand carries the persisted length setting', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiContinueLength: 'short' });
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '앞 문장이 안 끝났음\n\n뒤쪽 실 내용';
    const cursorPos = doc.indexOf('앞 문장이 안 끝났음') + '앞 문장이 안 끝났음'.length;
    const { view, destroy } = await mount(doc, cursorPos);
    try {
      const fired = mod.startFreeContinueWritingCommand(view);
      expect(fired).toBe(true);
      expect(aiRequestMock).toHaveBeenCalledTimes(1);
      expect(aiRequestMock.mock.calls[0][0].length).toBe('short');
      expect(aiRequestMock.mock.calls[0][0].contextAfter).toBeTruthy();
    } finally {
      destroy();
    }
  });

  it('startSectionFillCommand does not carry a length field', async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiContinueLength: 'short' });
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 제목\n\n';
    const pos = doc.length;
    const { view, destroy } = await mount(doc, pos);
    try {
      const fired = mod.startSectionFillCommand(view);
      expect(fired).toBe(true);
      expect(aiRequestMock).toHaveBeenCalledTimes(1);
      expect(aiRequestMock.mock.calls[0][0]).not.toHaveProperty('length');
    } finally {
      destroy();
    }
  });
});
