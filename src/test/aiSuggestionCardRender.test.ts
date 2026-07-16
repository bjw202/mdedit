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

  // SPEC-AI-002: 스켈레톤(빈 버퍼) → 텍스트(첫 청크) 전환 + 이후 청크에서 위젯 eq() 안정성.
  describe('SPEC-AI-002: 스트리밍 스켈레톤 → 텍스트 전환 + eq() 연속성', () => {
    it('빈 버퍼는 스켈레톤을 보여주고, 첫 청크 도착 시 텍스트로 교체된다(REQ-AI2-004/005)', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'render-1', streamBuffer: '' });
      startSuggestionCard(makeRequest());

      const cardBeforeChunk = view.dom.querySelector('.mdedit-ai-card')!;
      expect(cardBeforeChunk.classList.contains('mdedit-ai-card-streaming')).toBe(true);
      expect(cardBeforeChunk.querySelectorAll('.mdedit-ai-skeleton-line')).toHaveLength(3);
      expect(cardBeforeChunk.querySelector('.mdedit-ai-stream')?.textContent).toBe('');

      // 첫 청크 도착 — aiStore 스트리밍 버퍼가 비지 않게 된다(useAiRelay 미러링과 동형).
      useAiStore.setState({ streamBuffer: '첫 청크' });

      const cardAfterChunk = view.dom.querySelector('.mdedit-ai-card')!;
      expect(cardAfterChunk.classList.contains('mdedit-ai-card-streaming')).toBe(true);
      expect(cardAfterChunk.querySelectorAll('.mdedit-ai-skeleton-line')).toHaveLength(0);
      expect(cardAfterChunk.querySelector('.mdedit-ai-stream')?.textContent).toBe('첫 청크');
    });

    it('버퍼가 채워진 이후 추가 청크는 카드 DOM 노드를 재생성하지 않는다(REQ-AI2-013, AC-AI2-010)', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'render-1', streamBuffer: '' });
      startSuggestionCard(makeRequest());

      // 빈→찬 전환(1회 재생성 허용).
      useAiStore.setState({ streamBuffer: '첫 청크' });
      const cardAfterFirstChunk = view.dom.querySelector('.mdedit-ai-card')!;

      // 이후 청크들은 버퍼가 계속 채워져 있으므로 key(빈/찬)가 바뀌지 않아 DOM 노드가 유지되어야
      // 글로우 애니메이션이 육안으로 재시작되지 않는다.
      useAiStore.setState({ streamBuffer: '첫 청크 + 두번째' });
      const cardAfterSecondChunk = view.dom.querySelector('.mdedit-ai-card')!;
      expect(cardAfterSecondChunk).toBe(cardAfterFirstChunk);

      useAiStore.setState({ streamBuffer: '첫 청크 + 두번째 + 세번째' });
      const cardAfterThirdChunk = view.dom.querySelector('.mdedit-ai-card')!;
      expect(cardAfterThirdChunk).toBe(cardAfterFirstChunk);
    });

    // BUG-7 실기기 재현: 첫 청크가 개행/공백뿐이면(보이는 출력 없음) 스켈레톤이 유지되어야
    // 하고, 위젯 key 도 안 바뀌어야 한다 — 실제 텍스트가 도착할 때만 1회 전환한다.
    it('공백뿐인 첫 청크는 스켈레톤을 유지하고 위젯을 재생성하지 않는다(BUG-7)', () => {
      useAiStore.setState({ requestState: 'streaming', requestId: 'render-1', streamBuffer: '' });
      startSuggestionCard(makeRequest());

      const cardBeforeChunk = view.dom.querySelector('.mdedit-ai-card')!;
      expect(cardBeforeChunk.querySelectorAll('.mdedit-ai-skeleton-line')).toHaveLength(3);

      // 공백/개행만 담은 첫 청크 — 눈에 보이는 출력은 여전히 없다.
      useAiStore.setState({ streamBuffer: '\n\n' });
      const cardAfterWhitespaceChunk = view.dom.querySelector('.mdedit-ai-card')!;
      expect(cardAfterWhitespaceChunk).toBe(cardBeforeChunk); // 위젯 재생성 없음(key 불변)
      expect(cardAfterWhitespaceChunk.querySelectorAll('.mdedit-ai-skeleton-line')).toHaveLength(3);

      // 실제 텍스트가 도착하면 그제서야 스켈레톤 → 텍스트로 1회 전환한다.
      useAiStore.setState({ streamBuffer: '\n안녕' });
      const cardAfterRealText = view.dom.querySelector('.mdedit-ai-card')!;
      expect(cardAfterRealText.querySelectorAll('.mdedit-ai-skeleton-line')).toHaveLength(0);
    });
  });
});
