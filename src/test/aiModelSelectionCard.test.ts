// @MX:SPEC: SPEC-AI-014 REQ-AI14-017
// AC-018 — 카드의 모든 재요청이 원래 요청의 models 를 이어받는다(저장소가 바뀌어도).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...args: unknown[]) => aiRequestMock(...args),
  aiCancel: (...args: unknown[]) => aiCancelMock(...args),
  ipcErrorMessage: (reason: unknown) => (typeof reason === 'string' ? reason : 'error'),
}));

import {
  createAiSuggestionCard,
  startSuggestionCard,
  clearCardRegistry,
  setActiveEditorView,
  type AiSuggestionCardController,
  type StartCardRequest,
} from '@/components/editor/extensions/ai-suggestion-card';
import { useAiStore } from '@/store/aiStore';

const SUGGESTION = '이전 제안 본문입니다.';
const ORIGINAL = { claude: 'opus', codex: null };

describe('SPEC-AI-014 AC-018: 카드 재요청이 원래 models 를 이어받는다', () => {
  let view: EditorView;

  beforeEach(() => {
    aiRequestMock.mockClear();
    clearCardRegistry();
    useAiStore.setState({ requestState: 'idle', streamBuffer: '', requestId: null, errorInfo: null });
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    view = new EditorView({
      state: EditorState.create({ doc: 'hello world', extensions: [createAiSuggestionCard()] }),
      parent,
    });
  });

  afterEach(() => {
    view.destroy();
    setActiveEditorView(null);
    clearCardRegistry();
    document.body.innerHTML = '';
  });

  function start(): AiSuggestionCardController {
    const request: StartCardRequest = {
      args: {
        requestId: 'orig-1',
        feature: 'inline-edit',
        presetKind: 'polish',
        models: ORIGINAL,
        selection: 'hello',
        contextBefore: '앞',
        contextAfter: '뒤',
      },
      insertOnly: false,
      range: { from: 0, to: 5 },
      originalText: 'hello',
    };
    return startSuggestionCard(request);
  }

  function click(selector: string): void {
    const btn = view.dom.querySelector<HTMLElement>(`.mdedit-ai-card ${selector}`);
    expect(btn, `${selector} 가 카드에 없다`).not.toBeNull();
    btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function complete(requestId: string): void {
    useAiStore.setState({ requestId, requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({ requestId, requestState: 'done', streamBuffer: SUGGESTION });
  }

  function lastModels(): unknown {
    const calls = aiRequestMock.mock.calls;
    const args = calls[calls.length - 1][0] as { models: unknown };
    expect('model' in args).toBe(false);
    return args.models;
  }

  beforeEach(async () => {
    const { useUIStore } = await import('@/store/uiStore');
    useUIStore.setState({ aiModels: { claude: 'haiku', codex: null } });
  });

  it('↻ 방향 지시', () => {
    start();
    complete('orig-1');
    const input = view.dom.querySelector<HTMLInputElement>('.mdedit-ai-direct-input')!;
    input.value = '더 짧게';
    click('.mdedit-ai-redo');
    expect(lastModels()).toEqual(ORIGINAL);
  });

  it('↻ 다시 (blind)', () => {
    start();
    complete('orig-1');
    click('.mdedit-ai-retry');
    expect(lastModels()).toEqual(ORIGINAL);
  });

  it('오류 상태의 다시 시도', () => {
    const controller = start();
    useAiStore.setState({ requestId: 'orig-1', requestState: 'streaming', streamBuffer: '' });
    controller.onError({ kind: 'other', message: '잠시 문제가 있었어요' });
    click('.mdedit-ai-retry');
    expect(lastModels()).toEqual(ORIGINAL);
  });

  it('intruded 상태의 다시 요청', () => {
    const controller = start();
    complete('orig-1');
    controller.intrude();
    click('.mdedit-ai-rerequest');
    expect(lastModels()).toEqual(ORIGINAL);
  });
});
