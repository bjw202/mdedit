// @MX:SPEC: SPEC-AI-014 REQ-AI14-007 REQ-AI14-017 REQ-AI14-018
// 고스트 텍스트 경로: 요청이 도구별 모델 선택(models)을 싣고(AC-008), ↻ 재시도가 원래 선택을 유지하며(AC-018),
// invoke 거부 메시지가 상태 표시줄에 나온다(AC-020).

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

const REJECT = 'Claude에서 x 모델을 쓸 수 없어요';

async function mount(doc: string, pos: number) {
  const mod = await import('@/components/editor/extensions/ai-ghost-text');
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(pos),
    extensions: [markdown({ base: markdownLanguage }), mod.createAiGhostText()],
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

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  aiRequestMock.mockReset();
  aiRequestMock.mockResolvedValue(undefined);
  const { useAiStore, idleSlice } = await import('@/store/aiStore');
  useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
  const { useUIStore } = await import('@/store/uiStore');
  useUIStore.setState({ aiModels: { claude: 'opus', codex: 'm-a' }, statusMessage: null });
});

type Entry = 'startSectionFillCommand' | 'startContinueWritingCommand' | 'startFreeContinueWritingCommand';
const ENTRIES: Array<[Entry, string, number]> = [
  ['startSectionFillCommand', '# 제목\n본문\n## 결론\n', -1],
  ['startContinueWritingCommand', '문서 끝 이어쓰기 대상 문장입니다.\n\n', -1],
  ['startFreeContinueWritingCommand', '첫 문단입니다.\n\n중간 문단이 끊겼음 여기서\n\n마지막 문단입니다.\n', 20],
];

describe('AC-008: 고스트 세 진입점이 models 를 싣고 model 은 싣지 않는다', () => {
  it.each(ENTRIES)('%s', async (name, doc, pos) => {
    const { mod, view, destroy } = await mount(doc, pos < 0 ? doc.length : pos);
    try {
      expect(mod[name](view)).toBe(true);
      const args = aiRequestMock.mock.calls[0][0];
      expect(args.models).toEqual({ claude: 'opus', codex: 'm-a' });
      expect('model' in args).toBe(false);
    } finally {
      destroy();
    }
  });
});

describe('AC-018: 고스트 ↻ 재시도는 원래 선택을 유지한다', () => {
  it('저장소가 바뀌어도 models 는 처음 값', async () => {
    const doc = '문서 끝 이어쓰기 대상 문장입니다.\n\n';
    const { mod, view, destroy } = await mount(doc, doc.length);
    try {
      expect(mod.startContinueWritingCommand(view)).toBe(true);
      const { useUIStore } = await import('@/store/uiStore');
      useUIStore.setState({ aiModels: { claude: 'haiku', codex: null } });
      view.dispatch({ effects: mod.setGhostStatusEffect.of('done') });
      view.dispatch({ effects: mod.setGhostTextEffect.of('이어진 문장.') });
      expect(mod.reRequestGhost(view)).toBe(true);
      expect(aiRequestMock).toHaveBeenCalledTimes(2);
      expect(aiRequestMock.mock.calls[1][0].models).toEqual({ claude: 'opus', codex: 'm-a' });
    } finally {
      destroy();
    }
  });
});

describe('AC-020: invoke 거부 메시지를 상태 표시줄에 띄운다', () => {
  async function expectSurfaced(run: (m: Awaited<ReturnType<typeof mount>>) => void) {
    const doc = '문서 끝 이어쓰기 대상 문장입니다.\n\n# 결론\n';
    const m = await mount(doc, doc.length);
    try {
      const { useUIStore } = await import('@/store/uiStore');
      const { useAiStore } = await import('@/store/aiStore');
      const failSpy = vi.spyOn(useAiStore.getState(), 'failRequest');
      aiRequestMock.mockRejectedValue(REJECT);
      useUIStore.setState({ statusMessage: null });
      run(m);
      await flush();
      expect(useUIStore.getState().statusMessage).toBe(REJECT);
      expect(failSpy).toHaveBeenCalled();
    } finally {
      m.destroy();
    }
  }

  it('startSectionFillCommand', async () => {
    await expectSurfaced(({ mod, view }) => expect(mod.startSectionFillCommand(view)).toBe(true));
  });
  it('startContinueWritingCommand', async () => {
    const doc = '문서 끝 이어쓰기 대상 문장입니다.\n\n';
    const m = await mount(doc, doc.length);
    try {
      const { useUIStore } = await import('@/store/uiStore');
      aiRequestMock.mockRejectedValue(REJECT);
      expect(m.mod.startContinueWritingCommand(m.view)).toBe(true);
      await flush();
      expect(useUIStore.getState().statusMessage).toBe(REJECT);
    } finally {
      m.destroy();
    }
  });
  it('startFreeContinueWritingCommand', async () => {
    const doc = '첫 문단입니다.\n\n중간 문단이 끊겼음 여기서\n\n마지막 문단입니다.\n';
    const m = await mount(doc, 20);
    try {
      const { useUIStore } = await import('@/store/uiStore');
      aiRequestMock.mockRejectedValue(REJECT);
      expect(m.mod.startFreeContinueWritingCommand(m.view)).toBe(true);
      await flush();
      expect(useUIStore.getState().statusMessage).toBe(REJECT);
    } finally {
      m.destroy();
    }
  });
  it('고스트 ↻ 재시도', async () => {
    const doc = '문서 끝 이어쓰기 대상 문장입니다.\n\n';
    const m = await mount(doc, doc.length);
    try {
      const { useUIStore } = await import('@/store/uiStore');
      expect(m.mod.startContinueWritingCommand(m.view)).toBe(true);
      m.view.dispatch({ effects: m.mod.setGhostStatusEffect.of('done') });
      m.view.dispatch({ effects: m.mod.setGhostTextEffect.of('이어진 문장.') });
      aiRequestMock.mockRejectedValue(REJECT);
      useUIStore.setState({ statusMessage: null });
      expect(m.mod.reRequestGhost(m.view)).toBe(true);
      await flush();
      expect(useUIStore.getState().statusMessage).toBe(REJECT);
    } finally {
      m.destroy();
    }
  });
});
