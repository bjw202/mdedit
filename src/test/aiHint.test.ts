// @MX:SPEC: SPEC-AI-001 REQ-AI-028 REQ-AI-029 REQ-AI-032
// 3초 유휴 힌트 뷰 플러그인 — 타이머 등장/리셋/클릭 트리거(토큰 0 로컬 판정 + 명시 클릭에서만 요청).
// TDD RED phase: written before the hint ViewPlugin lands in ai-ghost-text.ts.

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
    parent,
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
  useUIStore.setState({ aiAdvancedModel: false });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('idle hint: appears after 3s when eligible, never before', () => {
  it('shows a section-fill hint pill after 3000ms idle under an empty heading', async () => {
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
      vi.advanceTimersByTime(2999);
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
      vi.advanceTimersByTime(1);
      const hint = view.dom.querySelector('.cm-ai-hint');
      expect(hint).not.toBeNull();
      expect(hint?.textContent).toContain('이 섹션 채우기');
      expect(aiRequestMock).not.toHaveBeenCalled(); // REQ-AI-032: 힌트 표시 자체는 요청이 아니다.
    } finally {
      destroy();
    }
  });

  it('shows a continue hint pill after 3000ms idle at document end', async () => {
    const doc = '본문 내용입니다.\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      vi.advanceTimersByTime(3000);
      const hint = view.dom.querySelector('.cm-ai-hint');
      expect(hint).not.toBeNull();
      expect(hint?.textContent).toContain('이어쓰기');
    } finally {
      destroy();
    }
  });

  it('does not show a hint when the cursor position is not eligible', async () => {
    const doc = '첫 문단\n\n둘째 문단';
    const emptyLinePos = doc.indexOf('\n\n') + 1;
    const { view, destroy } = await mount(doc, emptyLinePos);
    try {
      vi.advanceTimersByTime(5000);
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
    } finally {
      destroy();
    }
  });
});

describe('idle hint: timer resets on doc changes / selection moves', () => {
  it('a document edit before 3s resets the idle timer', async () => {
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      vi.advanceTimersByTime(2000);
      view.dispatch({ changes: { from: doc.length, insert: 'x' } });
      vi.advanceTimersByTime(2000); // 원래 타이머라면 이미 만료됐을 시점
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
    } finally {
      destroy();
    }
  });

  it('a selection move before 3s resets the idle timer', async () => {
    const doc = '# 결론\n\n## 배경\n';
    const secondHeadingEnd = doc.length;
    const { view, destroy } = await mount(doc, secondHeadingEnd);
    try {
      vi.advanceTimersByTime(2000);
      view.dispatch({ selection: EditorSelection.cursor(0) });
      vi.advanceTimersByTime(2000);
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
    } finally {
      destroy();
    }
  });
});

describe('idle hint: click triggers the same path as Mod+Enter', () => {
  it('clicking the hint fires an aiRequest and hides the hint', async () => {
    const doc = '# 결론\n';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      vi.advanceTimersByTime(3000);
      const hint = view.dom.querySelector('.cm-ai-hint') as HTMLButtonElement | null;
      expect(hint).not.toBeNull();
      expect(aiRequestMock).not.toHaveBeenCalled();

      hint?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(aiRequestMock).toHaveBeenCalledTimes(1);
      const arg = aiRequestMock.mock.calls[0][0];
      expect(arg.feature).toBe('section-fill');
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
    } finally {
      destroy();
    }
  });
});

// SPEC-AI-003 (M2): 자유 위치 이어쓰기 2단 힌트 자격(REQ-AI3-005, 006, 007) — 보수 조건
// 충족/미충족 매트릭스. 기존 케이스는 개정하지 않고 이 블록에서만 추가한다.
describe('idle hint: free-position continue (REQ-AI3-005/006, 2단 자격)', () => {
  it('shows a continue hint after 3s at the end of a non-empty, unterminated line mid-document', async () => {
    const doc = '본문 문장이 끊겼음';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      vi.advanceTimersByTime(3000);
      const hint = view.dom.querySelector('.cm-ai-hint');
      expect(hint).not.toBeNull();
      expect(hint?.textContent).toContain('이어쓰기');
    } finally {
      destroy();
    }
  });

  it('does not show a hint when the line ends with a sentence terminator', async () => {
    const doc = '완결된 문장이다.';
    const { view, destroy } = await mount(doc, doc.length);
    try {
      vi.advanceTimersByTime(3000);
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
    } finally {
      destroy();
    }
  });

  it('does not show a hint when the cursor is mid-line (not at line end)', async () => {
    const doc = '본문 중간에 커서가 있음';
    const { view, destroy } = await mount(doc, 3);
    try {
      vi.advanceTimersByTime(3000);
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
    } finally {
      destroy();
    }
  });

  it('does not show a hint inside a list item, even though Mod+Enter trigger is still eligible (D2)', async () => {
    const { createAiGhostText, startFreeContinueWritingCommand } = await import(
      '@/components/editor/extensions/ai-ghost-text'
    );
    const { markdown, markdownLanguage } = await import('@codemirror/lang-markdown');
    const doc = '- 리스트 항목이 끊겼음';
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const state = EditorState.create({
      doc,
      selection: EditorSelection.single(doc.length),
      extensions: [markdown({ base: markdownLanguage }), createAiGhostText()],
    });
    const view = new EditorView({ state, parent });
    try {
      vi.advanceTimersByTime(3000);
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
      // 힌트는 배제되지만 수동 Mod+Enter 트리거는 여전히 동작한다(D2).
      expect(startFreeContinueWritingCommand(view)).toBe(true);
    } finally {
      view.destroy();
      document.body.removeChild(parent);
    }
  });

  it('does not show a hint or fire aiRequest inside a fenced code block (REQ-AI3-003)', async () => {
    const { createAiGhostText } = await import('@/components/editor/extensions/ai-ghost-text');
    const { markdown, markdownLanguage } = await import('@codemirror/lang-markdown');
    const doc = '```js\nconsole.log(1)\n```\n';
    const pos = doc.indexOf('console.log(1)') + 5;
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const state = EditorState.create({
      doc,
      selection: EditorSelection.single(pos),
      extensions: [markdown({ base: markdownLanguage }), createAiGhostText()],
    });
    const view = new EditorView({ state, parent });
    try {
      vi.advanceTimersByTime(3000);
      expect(view.dom.querySelector('.cm-ai-hint')).toBeNull();
      expect(aiRequestMock).not.toHaveBeenCalled();
    } finally {
      view.destroy();
      document.body.removeChild(parent);
    }
  });
});
