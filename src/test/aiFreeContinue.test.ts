// @MX:SPEC: SPEC-AI-003 REQ-AI3-001 REQ-AI3-002 REQ-AI3-003 REQ-AI3-004 REQ-AI3-008 REQ-AI3-012
// REQ-AI3-013 REQ-AI3-014 REQ-AI3-015
// 자유 위치 이어쓰기(M2) — syntaxTree 게이트, 자유 위치 자격 판정, contextAfter 트리거 페이로드,
// 타이핑 소멸 → in-flight 취소(D1). TDD RED phase: 신규 함수는 아직 존재하지 않는다.
// D3 병행 전략: 이 파일은 신규 함수만 다룬다 — 기존 getContinueContext/aiContinueContext.test.ts는
// 손대지 않는다.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...a: unknown[]) => aiRequestMock(...a),
  aiCancel: (...a: unknown[]) => aiCancelMock(...a),
  ipcErrorMessage: (e: unknown) => String(e),
}));

/** markdown() 확장을 포함한 헤드리스 state — syntaxTree(state) 게이트 판정에 필요. */
function stateAt(doc: string, pos: number): EditorState {
  return EditorState.create({
    doc,
    selection: EditorSelection.single(pos),
    extensions: [markdown({ base: markdownLanguage })],
  });
}

/** 실제 EditorView 마운트 — 트리거 커맨드/타이핑 소멸 취소는 updateListener 를 타야 한다. */
async function mount(doc: string, pos: number) {
  const { createAiGhostText } = await import('@/components/editor/extensions/ai-ghost-text');
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(pos),
    extensions: [markdown({ base: markdownLanguage }), createAiGhostText()],
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
  useUIStore.setState({ aiAdvancedModel: false });
});

describe('getContinueBlockGate: syntaxTree 배제 판정 (REQ-AI3-003, 004)', () => {
  it('일반 문단 중간은 배제되지 않는다', async () => {
    const { getContinueBlockGate } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '첫 문단\n\n둘째 문단은 계속됩니다.';
    const pos = doc.indexOf('둘째') + 1;
    const gate = getContinueBlockGate(stateAt(doc, pos), pos);
    expect(gate.blocked).toBe(false);
    expect(gate.hintExcluded).toBe(false);
  });

  it('코드펜스 내부는 완전 배제된다', async () => {
    const { getContinueBlockGate } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '```js\nconsole.log(1)\n```\n\n뒤 문단';
    const pos = doc.indexOf('console.log(1)') + 5;
    const gate = getContinueBlockGate(stateAt(doc, pos), pos);
    expect(gate.blocked).toBe(true);
  });

  it('표 내부는 완전 배제된다', async () => {
    const { getContinueBlockGate } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '| a | b |\n| - | - |\n| 1 | 2 |\n\n뒤 문단';
    const pos = doc.indexOf('| 1 | 2 |') + 3;
    const gate = getContinueBlockGate(stateAt(doc, pos), pos);
    expect(gate.blocked).toBe(true);
  });

  it('리스트 항목 내부는 트리거는 허용하되 힌트만 배제한다(D2)', async () => {
    const { getContinueBlockGate } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '- 리스트 항목이 끊겼음\n- 둘째 항목';
    const pos = doc.indexOf('끊겼음') + 3;
    const gate = getContinueBlockGate(stateAt(doc, pos), pos);
    expect(gate.blocked).toBe(false);
    expect(gate.hintExcluded).toBe(true);
  });

  it('인용문 내부는 트리거는 허용하되 힌트만 배제한다(D2)', async () => {
    const { getContinueBlockGate } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '> 인용문이 끊겼음\n> 둘째 줄';
    const pos = doc.indexOf('끊겼음') + 3;
    const gate = getContinueBlockGate(stateAt(doc, pos), pos);
    expect(gate.blocked).toBe(false);
    expect(gate.hintExcluded).toBe(true);
  });

  it('코드펜스 닫힘 이후(펜스 밖) 위치는 배제되지 않는다(경계 케이스)', async () => {
    const { getContinueBlockGate } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '```js\nconsole.log(1)\n```\n\n뒤 문단입니다';
    const pos = doc.indexOf('뒤 문단');
    const gate = getContinueBlockGate(stateAt(doc, pos), pos);
    expect(gate.blocked).toBe(false);
  });
});

describe('getFreeContinueContext: 자유 위치 자격 + 우선순위(REQ-AI3-001, 002, 015)', () => {
  it('일반 문단 중간(끝 아님)에서도 자격을 얻는다 — contextBefore/contextAfter 통째 반환', async () => {
    const { getFreeContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '첫 문단이 끊겨서\n\n둘째 문단은 그대로 남는다.';
    const pos = doc.indexOf('끊겨서') + 3;
    const state = stateAt(doc, pos);
    const ctx = getFreeContinueContext(state, pos);
    expect(ctx).not.toBeNull();
    expect(ctx?.contextBefore).toBe(doc.slice(0, pos));
    expect(ctx?.contextAfter).toBe(doc.slice(pos));
  });

  it('코드펜스 내부는 자격이 없다 — 토큰 0(aiRequest 미호출)', async () => {
    const { getFreeContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '```js\nconsole.log(1)\n```\n\n뒤 문단';
    const pos = doc.indexOf('console.log(1)') + 5;
    const state = stateAt(doc, pos);
    expect(getFreeContinueContext(state, pos)).toBeNull();
    expect(aiRequestMock).not.toHaveBeenCalled();
  });

  it('표 내부는 자격이 없다', async () => {
    const { getFreeContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '| a | b |\n| - | - |\n| 1 | 2 |\n\n뒤 문단';
    const pos = doc.indexOf('| 1 | 2 |') + 3;
    expect(getFreeContinueContext(stateAt(doc, pos), pos)).toBeNull();
  });

  it('리스트 항목 내부는 자격을 얻는다(수동 트리거 허용, D2)', async () => {
    const { getFreeContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '- 리스트 항목이 끊겼음\n- 둘째 항목';
    const pos = doc.indexOf('끊겼음') + 3;
    expect(getFreeContinueContext(stateAt(doc, pos), pos)).not.toBeNull();
  });

  it('인용문 내부는 자격을 얻는다(수동 트리거 허용, D2)', async () => {
    const { getFreeContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '> 인용문이 끊겼음\n> 둘째 줄';
    const pos = doc.indexOf('끊겼음') + 3;
    expect(getFreeContinueContext(stateAt(doc, pos), pos)).not.toBeNull();
  });

  it('빈 헤딩 섹션(section-fill 우선)에서는 자유 위치가 선점하지 않는다', async () => {
    const { getFreeContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const pos = doc.length;
    expect(getFreeContinueContext(stateAt(doc, pos), pos)).toBeNull();
  });

  it('문서 끝(기존 continue 우선)에서는 자유 위치가 선점하지 않는다', async () => {
    const { getFreeContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '본문 내용.\n';
    const pos = doc.length;
    expect(getFreeContinueContext(stateAt(doc, pos), pos)).toBeNull();
  });

  it('빈 문서: 예외 없이 처리된다(크래시 없음)', async () => {
    const { getFreeContinueContext } = await import('@/components/editor/extensions/ai-ghost-text');
    expect(() => getFreeContinueContext(stateAt('', 0), 0)).not.toThrow();
  });
});

describe('startFreeContinueWritingCommand: contextAfter 페이로드 + 배제 위치 false 폴스루 (REQ-AI3-008, 012)', () => {
  it('일반 문단 중간에서 트리거 시 section-fill+continue+contextAfter 를 보낸다', async () => {
    const { startFreeContinueWritingCommand } = await import(
      '@/components/editor/extensions/ai-ghost-text'
    );
    const doc = '첫 문단이 끊겨서\n\n둘째 문단은 그대로 남는다.';
    const pos = doc.indexOf('끊겨서') + 3;
    const { view, destroy } = await mount(doc, pos);
    try {
      expect(startFreeContinueWritingCommand(view)).toBe(true);
      expect(aiRequestMock).toHaveBeenCalledTimes(1);
      const arg = aiRequestMock.mock.calls[0][0];
      expect(arg.feature).toBe('section-fill');
      expect(arg.presetKind).toBe('continue');
      expect(arg.contextBefore).toBe(doc.slice(0, pos));
      expect(arg.contextAfter).toBe(doc.slice(pos));
      expect(view.state.field((await import('@/components/editor/extensions/ai-ghost-text')).aiGhostField)).not.toBeNull();
    } finally {
      destroy();
    }
  });

  it('코드펜스 내부에서는 false 를 반환하고 aiRequest 를 호출하지 않는다(토큰 0)', async () => {
    const { startFreeContinueWritingCommand } = await import(
      '@/components/editor/extensions/ai-ghost-text'
    );
    const doc = '```js\nconsole.log(1)\n```\n\n뒤 문단';
    const pos = doc.indexOf('console.log(1)') + 5;
    const { view, destroy } = await mount(doc, pos);
    try {
      expect(startFreeContinueWritingCommand(view)).toBe(false);
      expect(aiRequestMock).not.toHaveBeenCalled();
    } finally {
      destroy();
    }
  });
});

describe('타이핑 소멸 → in-flight 취소 (D1, REQ-AI3-013, 014)', () => {
  it('스트리밍 중 타이핑으로 고스트가 소멸하면 ai_cancel 이 1회 호출된다', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '첫 문단이 끊겨서\n\n둘째 문단은 그대로 남는다.';
    const pos = doc.indexOf('끊겨서') + 3;
    const { view, destroy } = await mount(doc, pos);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: pos }) });
      view.dispatch({ effects: mod.setGhostTextEffect.of('스트리밍 중인 초안') });

      const { useAiStore } = await import('@/store/aiStore');
      useAiStore.setState({ requestState: 'streaming', requestId: 'cw-typing-test' });

      // 사용자가 타이핑 — effect 없는 docChanged 트랜잭션 → 고스트 소멸 + 취소.
      view.dispatch({ changes: { from: pos, insert: 'x' }, userEvent: 'input' });

      expect(view.state.field(mod.aiGhostField)).toBeNull();
      expect(aiCancelMock).toHaveBeenCalledTimes(1);
      expect(aiCancelMock).toHaveBeenCalledWith('cw-typing-test');
    } finally {
      destroy();
    }
  });

  it('확정 트랜잭션(clearGhostEffect 동승)에서는 취소가 호출되지 않는다(오취소 금지)', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '첫 문단이 끊겨서\n\n둘째 문단은 그대로 남는다.';
    const pos = doc.indexOf('끊겨서') + 3;
    const { view, destroy } = await mount(doc, pos);
    try {
      view.dispatch({ effects: mod.startGhostEffect.of({ from: pos }) });
      view.dispatch({ effects: mod.setGhostTextEffect.of('확정할 초안') });

      const { useAiStore } = await import('@/store/aiStore');
      useAiStore.setState({ requestState: 'streaming', requestId: 'cw-confirm-test' });

      expect(mod.confirmGhostCommand(view)).toBe(true);

      expect(aiCancelMock).not.toHaveBeenCalled();
    } finally {
      destroy();
    }
  });
});
