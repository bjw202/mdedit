// @MX:SPEC: SPEC-AI-012 REQ-AI12-008 REQ-AI12-012
// AC-AI12-015 — ↻ 재요청 지시를 새 IPC 필드 additionalInstruction 으로 싣고, 원래 직접 입력 지시
// (customInstruction)는 원본 값 그대로 승계하는지, 복구용 재요청 2곳은 지시를 싣지 않는지 고정한다.
//
// TDD RED phase(수정 전 작성): 현행 배선은 fireReRequest(args, { customInstruction: instruction })
// 로 customInstruction 을 덮어써 원래 직접 입력 지시가 사라지고, 프리셋에서는 지시가 서버에서 버려진다.

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

const ORIGINAL_INSTRUCTION = '영어로 번역해줘';
const SUGGESTION = '이전 제안 본문입니다.';

type Sent = {
  requestId: string;
  feature: string;
  presetKind?: string;
  model: string;
  selection?: string;
  contextBefore?: string;
  contextAfter?: string;
  customInstruction?: string;
  additionalInstruction?: string;
  diagramType?: string;
};

function mountEditor(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const state = EditorState.create({ doc, extensions: [createAiSuggestionCard()] });
  return new EditorView({ state, parent });
}

describe('SPEC-AI-012: 카드 재요청의 additionalInstruction 배선', () => {
  let view: EditorView;

  beforeEach(() => {
    aiRequestMock.mockClear();
    aiCancelMock.mockClear();
    clearCardRegistry();
    useAiStore.setState({ requestState: 'idle', streamBuffer: '', requestId: null, errorInfo: null });
    view = mountEditor('hello world');
  });

  afterEach(() => {
    view.destroy();
    setActiveEditorView(null);
    clearCardRegistry();
    document.body.innerHTML = '';
  });

  function makeRequest(overrides: Partial<StartCardRequest['args']> = {}): StartCardRequest {
    return {
      args: {
        requestId: 'orig-1',
        feature: 'inline-edit',
        presetKind: 'polish',
        models: { claude: 'haiku', codex: null },
        selection: 'hello',
        contextBefore: '앞 문맥',
        contextAfter: '뒤 문맥',
        ...overrides,
      },
      insertOnly: false,
      range: { from: 0, to: 5 },
      originalText: 'hello',
    };
  }

  function cardEl(): HTMLElement {
    const el = view.dom.querySelector<HTMLElement>('.mdedit-ai-card');
    expect(el).not.toBeNull();
    return el!;
  }

  function click(selector: string): void {
    const btn = cardEl().querySelector<HTMLElement>(selector);
    expect(btn, `${selector} 가 카드에 없다`).not.toBeNull();
    btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function complete(requestId: string, text: string): void {
    useAiStore.setState({ requestId, requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({ requestId, requestState: 'done', streamBuffer: text });
  }

  function startDoneCard(overrides: Partial<StartCardRequest['args']> = {}): AiSuggestionCardController {
    const controller = startSuggestionCard(makeRequest(overrides));
    complete('orig-1', SUGGESTION);
    expect(controller.getState().phase).toBe('done');
    return controller;
  }

  function lastSent(): Sent {
    const calls = aiRequestMock.mock.calls;
    return calls[calls.length - 1][0] as Sent;
  }

  it('1. 직접 입력 카드의 빈 입력 ↻ — 원래 지시를 승계하고 추가 지시만 싣는다', () => {
    startDoneCard({ feature: 'inline-edit', presetKind: 'custom', customInstruction: ORIGINAL_INSTRUCTION });
    click('.mdedit-ai-redo');
    expect(aiRequestMock).toHaveBeenCalledTimes(1);
    const sent = lastSent();
    expect(sent.customInstruction).toBe(ORIGINAL_INSTRUCTION);
    expect(sent.additionalInstruction).toContain('다른 방식으로');
    expect(sent.selection).toBe('hello');
    expect(sent.contextBefore).toBe('앞 문맥');
    expect(sent.contextAfter).toBe('뒤 문맥');
  });

  it('2. 짧게 프리셋 카드의 방향 지시 — additionalInstruction 에 실리고 customInstruction 은 원본 그대로다', () => {
    startDoneCard({ presetKind: 'shorten' });
    const input = cardEl().querySelector<HTMLInputElement>('.mdedit-ai-direct-input')!;
    input.value = '더 짧게';
    click('.mdedit-ai-redo');
    const sent = lastSent();
    expect(sent.presetKind).toBe('shorten');
    expect(sent.additionalInstruction).toBe('더 짧게');
    expect(sent.customInstruction).toBeUndefined();
    expect(sent.selection).toBe('hello');
  });

  it('3. 다이어그램 자동 재요청 — 오류가 additionalInstruction 으로 가고 feature·diagramType 을 승계한다', async () => {
    startSuggestionCard(
      makeRequest({ feature: 'diagram', presetKind: 'diagram', diagramType: 'gantt' }),
    );
    complete('orig-1', '```mermaid\nBADSYNTAX\n```');
    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(1));
    const sent = lastSent();
    expect(sent.additionalInstruction?.startsWith('이전 오류:')).toBe(true);
    expect(sent.feature).toBe('diagram');
    expect(sent.diagramType).toBe('gantt');
    expect(sent.customInstruction).toBeUndefined();
  });

  it('4. 표 자동 재요청 — 오류가 additionalInstruction 으로 가고 presetKind 를 승계한다', () => {
    startSuggestionCard(makeRequest({ presetKind: 'table' }));
    complete('orig-1', '표가 아닌 평범한 문장');
    expect(aiRequestMock).toHaveBeenCalledTimes(1);
    const sent = lastSent();
    expect(sent.additionalInstruction?.startsWith('이전 오류:')).toBe(true);
    expect(sent.presetKind).toBe('table');
    expect(sent.customInstruction).toBeUndefined();
  });

  it('5. 목록 폴백 — additionalInstruction 없이 변경 전과 같은 인자를 보낸다', async () => {
    startSuggestionCard(makeRequest({ feature: 'diagram', presetKind: 'diagram' }));
    complete('orig-1', '```mermaid\nBADSYNTAX\n```');
    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(1));
    complete(lastSent().requestId, '```mermaid\nBADSYNTAX\n```');
    await vi.waitFor(() =>
      expect(cardEl().querySelector('.mdedit-ai-list-fallback')).not.toBeNull(),
    );
    click('.mdedit-ai-list-fallback');
    expect(aiRequestMock).toHaveBeenCalledTimes(2);
    const sent = lastSent();
    expect(sent.additionalInstruction).toBeUndefined();
    expect(sent.presetKind).toBe('outline');
    expect(sent.feature).toBe('inline-edit');
    expect(sent.customInstruction).toBe('');
  });

  it('6. 직접 입력 카드의 "↻ 다시" — 빈 입력 ↻ 와 같은 인자를 보낸다', () => {
    startDoneCard({ feature: 'inline-edit', presetKind: 'custom', customInstruction: ORIGINAL_INSTRUCTION });
    click('.mdedit-ai-retry');
    const sent = lastSent();
    expect(sent.customInstruction).toBe(ORIGINAL_INSTRUCTION);
    expect(sent.additionalInstruction).toContain('다른 방식으로');
  });

  describe('7. 복구용 재요청 2곳은 추가 지시를 싣지 않는다', () => {
    const custom = {
      feature: 'inline-edit' as const,
      presetKind: 'custom',
      customInstruction: ORIGINAL_INSTRUCTION,
    };

    it('오류 카드 "다시 시도"', () => {
      const controller = startSuggestionCard(makeRequest(custom));
      useAiStore.setState({ requestId: 'orig-1', requestState: 'streaming', streamBuffer: '' });
      controller.onError({ kind: 'other', message: '잠시 문제가 있었어요' });
      expect(controller.getState().phase).toBe('error');
      click('.mdedit-ai-retry');
      const sent = lastSent();
      expect(sent.additionalInstruction).toBeUndefined();
      expect(sent.customInstruction).toBe(ORIGINAL_INSTRUCTION);
    });

    it('끼어듦 카드 "다시 요청"', () => {
      const controller = startSuggestionCard(makeRequest(custom));
      complete('orig-1', SUGGESTION);
      controller.intrude();
      expect(controller.getState().phase).toBe('intruded');
      click('.mdedit-ai-rerequest');
      const sent = lastSent();
      expect(sent.additionalInstruction).toBeUndefined();
      expect(sent.customInstruction).toBe(ORIGINAL_INSTRUCTION);
    });
  });
});
