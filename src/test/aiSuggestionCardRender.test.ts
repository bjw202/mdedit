// @MX:SPEC: SPEC-AI-001 REQ-AI-021
// 실제 EditorView 에 카드 확장을 마운트해 통합 렌더 경로를 검증한다. 순수 렌더러/페이크 뷰
// 테스트(aiSuggestionCard.test.ts)는 block widget 을 ViewPlugin 으로 공급할 때 CodeMirror 가
// 던지는 "Block decorations may not be specified via plugins" 를 잡지 못한다 — 이 스위트는
// 프리셋 클릭 → 스트리밍 카드가 항상 보이는지(P7 조용한 실패 금지)를 실제 뷰로 재현한다.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  createAiSuggestionCard,
  startSuggestionCard,
  clearCardRegistry,
  setActiveEditorView,
  getActiveCardController,
  type StartCardRequest,
} from '@/components/editor/extensions/ai-suggestion-card';
import { useAiStore } from '@/store/aiStore';

function mountEditor(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const state = EditorState.create({ doc, extensions: [createAiSuggestionCard()] });
  return new EditorView({ state, parent });
}

function makeRequest(overrides: Partial<StartCardRequest['args']> = {}): StartCardRequest {
  return {
    args: {
      requestId: 'render-1',
      feature: 'inline-edit',
      presetKind: 'polish',
      model: 'haiku',
      selection: 'hello',
      contextBefore: '',
      contextAfter: '',
      ...overrides,
    },
    insertOnly: false,
    range: { from: 0, to: 5 },
    originalText: 'hello',
  };
}

describe('createAiSuggestionCard: 실제 EditorView 통합 렌더', () => {
  let view: EditorView;

  beforeEach(() => {
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

  it('프리셋 발행 직후 스트리밍 카드가 에디터 DOM 에 즉시 보인다(P7)', () => {
    startSuggestionCard(makeRequest());
    const card = view.dom.querySelector('.mdedit-ai-card');
    expect(card).not.toBeNull();
    expect(card?.classList.contains('mdedit-ai-card-streaming')).toBe(true);
  });

  it('요청 실패가 조용히 사라지지 않고 오류 카드로 보인다(P7)', () => {
    const req = makeRequest({ requestId: 'render-err' });
    startSuggestionCard(req);
    // useAiRelay 가 ai://error 를 릴레이한 것과 동일하게 스토어를 error 로 전이한다.
    useAiStore.setState({ requestId: 'render-err', requestState: 'error', errorInfo: { kind: 'other', message: '문제가 있었어요' } });
    const card = view.dom.querySelector('.mdedit-ai-card-error');
    expect(card).not.toBeNull();
    expect(getActiveCardController()?.getState().phase).toBe('error');
  });
});
