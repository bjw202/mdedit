// @MX:SPEC: SPEC-AI-004 REQ-AI2-004 REQ-AI2-005 REQ-AI2-013 REQ-AI6-007
// 제안 카드 위젯의 재렌더 계약(buildCardKey / eq / updateDOM) 회귀 테스트.
// 배경: 카드 key 가 청크마다 고정이던 시절 eq() 가 계속 true 를 돌려주어 CodeMirror 가 DOM 을
// 한 번도 다시 건드리지 않았고, 그 결과 스트리밍 카드가 첫 청크에서 얼어붙었다. 이제 key 는
// 버퍼 길이를 반영해 바뀌고, 재생성 방지는 updateDOM 이 맡는다.

import { describe, it, expect, vi } from 'vitest';
import type {
  CardState,
  RenderCardInput,
  SuggestionCardModel,
  CardCallbacks,
} from '@/components/editor/extensions/ai-suggestion-card';

const MODULE = '@/components/editor/extensions/ai-suggestion-card';

function makeCallbacks(): CardCallbacks {
  return {
    onApply: vi.fn(),
    onCancel: vi.fn(),
    onReRequest: vi.fn(),
    onListFallback: vi.fn(),
  };
}

function makeModel(overrides: Partial<SuggestionCardModel> = {}): SuggestionCardModel {
  return {
    requestId: 'ai-1700000000000-abc123',
    presetKind: 'polish',
    range: { from: 0, to: 10 },
    originalText: '원래 문장',
    insertOnly: false,
    model: 'haiku',
    ...overrides,
  };
}

function makeInput(overrides: Partial<RenderCardInput> = {}): RenderCardInput {
  const state: CardState = { phase: 'streaming', suggestion: '', retryCount: 0 };
  return {
    state,
    actions: { modes: ['replace', 'insert-below'], primary: 'replace' },
    presetKind: 'polish',
    streamBuffer: '',
    callbacks: makeCallbacks(),
    ...overrides,
  };
}

describe('buildCardKey: 스트리밍 청크마다 key 가 움직이는가', () => {
  it('공백만 쌓이는 동안에는 key 가 고정이다 (BUG-7 — 보이는 변화 없이 재생성 금지)', async () => {
    const { buildCardKey } = await import(MODULE);
    const model = makeModel();
    const a = buildCardKey(model, makeInput({ streamBuffer: '' }));
    const b = buildCardKey(model, makeInput({ streamBuffer: '\n' }));
    const c = buildCardKey(model, makeInput({ streamBuffer: '\n\n  ' }));
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('버퍼가 찬 뒤에는 자랄 때마다 key 가 바뀐다 (얼어붙음 수정의 전제)', async () => {
    const { buildCardKey } = await import(MODULE);
    const model = makeModel();
    const first = buildCardKey(model, makeInput({ streamBuffer: '다듬' }));
    const grown = buildCardKey(model, makeInput({ streamBuffer: '다듬는 중인' }));
    const grownMore = buildCardKey(model, makeInput({ streamBuffer: '다듬는 중인 텍스트' }));
    expect(grown).not.toBe(first);
    expect(grownMore).not.toBe(grown);
  });

  it('스켈레톤 → 텍스트 전환 시 key 가 바뀐다', async () => {
    const { buildCardKey } = await import(MODULE);
    const model = makeModel();
    const skeleton = buildCardKey(model, makeInput({ streamBuffer: '   ' }));
    const filled = buildCardKey(model, makeInput({ streamBuffer: '첫 청크' }));
    expect(filled).not.toBe(skeleton);
  });

  it('waitingLong 전환이 key 에 반영된다 (REQ-AI6-007 대기 안내 표시)', async () => {
    const { buildCardKey } = await import(MODULE);
    const model = makeModel();
    const quiet = buildCardKey(model, makeInput({ streamBuffer: '', waitingLong: false }));
    const waiting = buildCardKey(model, makeInput({ streamBuffer: '', waitingLong: true }));
    expect(waiting).not.toBe(quiet);
  });

  it('스트리밍이 아니면 버퍼 상태를 key 에 싣지 않는다', async () => {
    const { buildCardKey } = await import(MODULE);
    const model = makeModel();
    const done: CardState = { phase: 'done', suggestion: '다듬어진 문장.', retryCount: 0 };
    const key = buildCardKey(model, makeInput({ state: done, streamBuffer: '무시됨' }));
    expect(key).toBe(`${model.requestId}:done`);
  });
});

describe('SuggestionCardWidget.eq: 카드 얼어붙음 회귀 가드', () => {
  // 이 테스트가 실패해서 eq() 가 true 를 돌려주면, 그것이 바로 스트리밍 카드를 첫 청크에
  // 얼려버렸던 상태다 — CodeMirror 는 eq() 가 true 인 위젯의 DOM 을 아예 건드리지 않으므로
  // toDOM 도 updateDOM 도 호출되지 않고, 사용자는 몇 글자만 보고 나머지를 기다리게 된다.
  it('버퍼 길이만 다른 두 위젯은 eq 가 아니어야 한다 (eq=true 이면 카드가 얼어붙는다)', async () => {
    const { SuggestionCardWidget, buildCardKey } = await import(MODULE);
    const model = makeModel();
    const shortInput = makeInput({ streamBuffer: '다듬' });
    const longInput = makeInput({ streamBuffer: '다듬는 중인 텍스트' });
    const a = new SuggestionCardWidget(shortInput, buildCardKey(model, shortInput));
    const b = new SuggestionCardWidget(longInput, buildCardKey(model, longInput));
    expect(b.eq(a)).toBe(false);
  });

  it('완전히 동일한 스냅샷이면 eq 가 성립한다 (불필요한 재렌더 방지)', async () => {
    const { SuggestionCardWidget, buildCardKey } = await import(MODULE);
    const model = makeModel();
    const input = makeInput({ streamBuffer: '같은 버퍼' });
    const a = new SuggestionCardWidget(input, buildCardKey(model, input));
    const b = new SuggestionCardWidget(input, buildCardKey(model, input));
    expect(b.eq(a)).toBe(true);
  });
});

describe('SuggestionCardWidget.updateDOM: 제자리 패치 vs 재렌더 판정', () => {
  /** toDOM 으로 실제 카드 DOM 을 만들어 반환한다(dataset key 각인 포함). */
  async function mount(streamBuffer: string, overrides: Partial<RenderCardInput> = {}) {
    const { SuggestionCardWidget, buildCardKey } = await import(MODULE);
    const model = makeModel();
    const input = makeInput({ streamBuffer, ...overrides });
    const widget = new SuggestionCardWidget(input, buildCardKey(model, input));
    return { dom: widget.toDOM(), model };
  }

  /** 같은 카드(model)의 후속 스냅샷 위젯을 만든다. */
  async function nextWidget(model: SuggestionCardModel, overrides: Partial<RenderCardInput>) {
    const { SuggestionCardWidget, buildCardKey } = await import(MODULE);
    const input = makeInput({ streamBuffer: '', ...overrides });
    return new SuggestionCardWidget(input, buildCardKey(model, input));
  }

  it('찬 버퍼 → 더 찬 버퍼: .mdedit-ai-stream 을 제자리 패치하고 true 를 돌려준다', async () => {
    const { dom, model } = await mount('다듬');
    const widget = await nextWidget(model, { streamBuffer: '다듬는 중인 텍스트' });
    expect(widget.updateDOM(dom)).toBe(true);
    expect(dom.querySelector('.mdedit-ai-stream')?.textContent).toBe('다듬는 중인 텍스트');
  });

  it('DOM 에 스켈레톤이 남아 있으면 false — 첫 청크 전환은 반드시 재렌더한다', async () => {
    const { dom, model } = await mount('');
    expect(dom.querySelector('.mdedit-ai-skeleton')).toBeTruthy();
    const widget = await nextWidget(model, { streamBuffer: '첫 청크' });
    expect(widget.updateDOM(dom)).toBe(false);
  });

  it('DOM 에 8초 대기 안내가 있으면 false — 안내 제거는 재렌더가 맡는다 (REQ-AI6-007)', async () => {
    const { dom, model } = await mount('', { waitingLong: true });
    expect(dom.querySelector('.mdedit-ai-wait-notice')).toBeTruthy();
    const widget = await nextWidget(model, { streamBuffer: '첫 청크' });
    expect(widget.updateDOM(dom)).toBe(false);
  });

  it('새 phase 가 streaming 이 아니면 false — done 카드는 완전히 다른 DOM 이다', async () => {
    const { dom, model } = await mount('다듬');
    const done: CardState = { phase: 'done', suggestion: '다듬어진 문장.', retryCount: 0 };
    const widget = await nextWidget(model, { state: done, streamBuffer: '다듬어진 문장.' });
    expect(widget.updateDOM(dom)).toBe(false);
  });

  it('새 버퍼가 공백뿐이면 false — 스켈레톤으로 되돌리는 렌더가 필요하다', async () => {
    const { dom, model } = await mount('다듬');
    const widget = await nextWidget(model, { streamBuffer: '  \n' });
    expect(widget.updateDOM(dom)).toBe(false);
  });

  it('다른 requestId 의 DOM 은 패치하지 않는다 — 취소 버튼이 이전 카드 콜백을 붙들고 있다', async () => {
    const { dom } = await mount('다듬');
    const other = makeModel({ requestId: 'ai-1700000000001-zzz999' });
    const widget = await nextWidget(other, { streamBuffer: '다듬는 중인 텍스트' });
    expect(widget.updateDOM(dom)).toBe(false);
  });

  it('패치 성공 후 dataset key 가 갱신되어 다음 청크도 이어서 패치된다', async () => {
    const { dom, model } = await mount('다듬');
    const second = await nextWidget(model, { streamBuffer: '다듬는 중' });
    expect(second.updateDOM(dom)).toBe(true);
    const third = await nextWidget(model, { streamBuffer: '다듬는 중인 텍스트' });
    expect(third.updateDOM(dom)).toBe(true);
    expect(dom.querySelector('.mdedit-ai-stream')?.textContent).toBe('다듬는 중인 텍스트');
  });
});
