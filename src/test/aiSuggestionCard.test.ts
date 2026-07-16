// @MX:SPEC: SPEC-AI-001 REQ-AI-021 REQ-AI-025 REQ-AI-038
// TDD RED phase — written before ai-suggestion-card.ts exists.
// T-013 covers the pure card state machine + action derivation + retry/diagram-fallback
// helpers, plus the card DOM renderer (streaming/done/empty/error/exhausted states,
// insert-only vs replace, outline dual-button, diagram valid/fallback).

import { describe, it, expect, vi } from 'vitest';

describe('reduceCard: card state machine transitions', () => {
  const initial = { phase: 'streaming' as const, suggestion: '', retryCount: 0 };

  it('stream event keeps the card in the streaming phase', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const next = reduceCard(initial, { type: 'stream' });
    expect(next.phase).toBe('streaming');
  });

  it('complete with a real suggestion moves to done and stores the text', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const next = reduceCard(initial, {
      type: 'complete',
      finalText: '다듬어진 문장.',
      original: '원래 문장',
    });
    expect(next.phase).toBe('done');
    expect(next.suggestion).toBe('다듬어진 문장.');
  });

  it('complete with an empty result moves to the empty phase (REQ-AI-038)', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const next = reduceCard(initial, { type: 'complete', finalText: '   ', original: 'x' });
    expect(next.phase).toBe('empty');
  });

  it('complete identical to the original (ignoring surrounding space) is empty', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const next = reduceCard(initial, {
      type: 'complete',
      finalText: '  같은 문장 ',
      original: '같은 문장',
    });
    expect(next.phase).toBe('empty');
  });

  it('fail moves to error and carries the message', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const next = reduceCard(initial, { type: 'fail', message: '네트워크에 연결할 수 없어요' });
    expect(next.phase).toBe('error');
    expect(next.errorMessage).toContain('네트워크');
  });

  it('retry from count 2 increments to 3 and returns to streaming', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const done = { phase: 'done' as const, suggestion: 's', retryCount: 2 };
    const next = reduceCard(done, { type: 'retry' });
    expect(next.retryCount).toBe(3);
    expect(next.phase).toBe('streaming');
  });

  it('retry once the 3 attempts are spent yields the retry-exhausted phase', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const spent = { phase: 'done' as const, suggestion: 's', retryCount: 3 };
    const next = reduceCard(spent, { type: 'retry' });
    expect(next.phase).toBe('retry-exhausted');
    expect(next.retryCount).toBe(3);
  });

  it('stale event moves to the stale phase (apply-time mismatch)', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const done = { phase: 'done' as const, suggestion: 's', retryCount: 0 };
    expect(reduceCard(done, { type: 'stale' }).phase).toBe('stale');
  });

  it('diagram-valid event stores the code and enters diagram-valid', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    const next = reduceCard(initial, { type: 'diagram-valid', code: '```mermaid\nflowchart LR\n```' });
    expect(next.phase).toBe('diagram-valid');
    expect(next.suggestion).toContain('mermaid');
  });

  it('diagram-fallback event enters diagram-fallback', async () => {
    const { reduceCard } = await import('@/components/editor/extensions/ai-suggestion-card');
    expect(reduceCard(initial, { type: 'diagram-fallback' }).phase).toBe('diagram-fallback');
  });
});

describe('isEmptyOrIdentical: empty/identical suggestion guard', () => {
  it('true for empty/whitespace-only', async () => {
    const { isEmptyOrIdentical } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    expect(isEmptyOrIdentical('', 'x')).toBe(true);
    expect(isEmptyOrIdentical('   \n ', 'x')).toBe(true);
  });

  it('true when equal after trimming, false otherwise', async () => {
    const { isEmptyOrIdentical } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    expect(isEmptyOrIdentical(' same ', 'same')).toBe(true);
    expect(isEmptyOrIdentical('different', 'same')).toBe(false);
  });
});

describe('buildRetryInstruction: blind ↻ vs directed re-request', () => {
  it('blind retry uses the "다른 방식으로" instruction', async () => {
    const { buildRetryInstruction } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    expect(buildRetryInstruction()).toContain('다른 방식으로');
    expect(buildRetryInstruction('   ')).toContain('다른 방식으로');
  });

  it('directed retry uses the trimmed user instruction', async () => {
    const { buildRetryInstruction } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    expect(buildRetryInstruction('  더 짧게  ')).toBe('더 짧게');
  });
});

describe('deriveCardActions: apply-button derivation per preset + insertOnly', () => {
  it('insertOnly forces insert-below only, hiding 바꾸기 (REQ-AI-026)', async () => {
    const { deriveCardActions } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const actions = deriveCardActions('shorten', true);
    expect(actions.modes).toEqual(['insert-below']);
    expect(actions.primary).toBe('insert-below');
  });

  it('polish/shorten/custom replace in place', async () => {
    const { deriveCardActions } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    for (const kind of ['polish', 'shorten', 'custom'] as const) {
      const actions = deriveCardActions(kind, false);
      expect(actions.modes).toEqual(['replace']);
      expect(actions.primary).toBe('replace');
    }
  });

  it('outline offers both, focus on 바꾸기 (설계 §4.2 C)', async () => {
    const { deriveCardActions } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const actions = deriveCardActions('outline', false);
    expect(actions.modes).toEqual(['replace', 'insert-below']);
    expect(actions.primary).toBe('replace');
  });

  it('table and diagram insert below (원문 파괴 방지)', async () => {
    const { deriveCardActions } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    for (const kind of ['table', 'diagram'] as const) {
      const actions = deriveCardActions(kind, false);
      expect(actions.modes).toEqual(['insert-below']);
      expect(actions.primary).toBe('insert-below');
    }
  });
});

describe('decideDiagramOutcome: mermaid validation → card action (REQ-AI-024)', () => {
  it('valid diagram yields a valid outcome carrying the code', async () => {
    const { decideDiagramOutcome } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const out = decideDiagramOutcome({ valid: true }, 1, 'flowchart LR\n A-->B');
    expect(out.kind).toBe('valid');
    if (out.kind === 'valid') expect(out.code).toContain('flowchart');
  });

  it('first invalid attempt asks for an automatic retry with the error appended', async () => {
    const { decideDiagramOutcome } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const out = decideDiagramOutcome({ valid: false, error: 'Parse error' }, 1, 'bad');
    expect(out.kind).toBe('auto-retry');
    if (out.kind === 'auto-retry') expect(out.error).toContain('Parse error');
  });

  it('second invalid attempt offers the list fallback', async () => {
    const { decideDiagramOutcome } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    const out = decideDiagramOutcome({ valid: false, error: 'again' }, 2, 'bad');
    expect(out.kind).toBe('offer-list');
  });
});

describe('renderSuggestionCard: DOM per phase (jsdom)', () => {
  const cb = () => ({
    onApply: vi.fn(),
    onCancel: vi.fn(),
    onReRequest: vi.fn(),
    onListFallback: vi.fn(),
  });

  async function render(input: Record<string, unknown>) {
    const mod = await import('@/components/editor/extensions/ai-suggestion-card');
    const callbacks = cb();
    const dom = mod.renderSuggestionCard({ callbacks, ...input } as never);
    document.body.appendChild(dom);
    return { dom, callbacks };
  }

  it('streaming shows the live buffer and a cancel button', async () => {
    const { dom, callbacks } = await render({
      state: { phase: 'streaming', suggestion: '', retryCount: 0 },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'polish',
      streamBuffer: '다듬는 중인 텍스트',
    });
    expect(dom.textContent).toContain('다듬는 중인 텍스트');
    const cancel = dom.querySelector<HTMLButtonElement>('.mdedit-ai-cancel')!;
    cancel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(callbacks.onCancel).toHaveBeenCalled();
  });

  it('done (replace) shows the suggestion, a direct-instruction input, and 바꾸기', async () => {
    const { dom, callbacks } = await render({
      state: { phase: 'done', suggestion: '제안된 문장.', retryCount: 0 },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'polish',
      streamBuffer: '',
    });
    expect(dom.textContent).toContain('제안된 문장.');
    expect(dom.querySelector('.mdedit-ai-direct-input')).toBeTruthy();
    const apply = dom.querySelector<HTMLButtonElement>('.mdedit-ai-apply[data-mode="replace"]')!;
    expect(apply).toBeTruthy();
    apply.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(callbacks.onApply).toHaveBeenCalledWith('replace');
  });

  it('done (insertOnly) shows 아래에 삽입 and no replace button', async () => {
    const { dom, callbacks } = await render({
      state: { phase: 'done', suggestion: 'S', retryCount: 0 },
      actions: { modes: ['insert-below'], primary: 'insert-below' },
      presetKind: 'shorten',
      streamBuffer: '',
    });
    expect(dom.querySelector('.mdedit-ai-apply[data-mode="replace"]')).toBeNull();
    const insert = dom.querySelector<HTMLButtonElement>('.mdedit-ai-apply[data-mode="insert-below"]')!;
    expect(insert).toBeTruthy();
    insert.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(callbacks.onApply).toHaveBeenCalledWith('insert-below');
  });

  it('done (outline) renders both replace and insert-below apply buttons', async () => {
    const { dom } = await render({
      state: { phase: 'done', suggestion: 'S', retryCount: 0 },
      actions: { modes: ['replace', 'insert-below'], primary: 'replace' },
      presetKind: 'outline',
      streamBuffer: '',
    });
    expect(dom.querySelector('.mdedit-ai-apply[data-mode="replace"]')).toBeTruthy();
    expect(dom.querySelector('.mdedit-ai-apply[data-mode="insert-below"]')).toBeTruthy();
  });

  it('directed re-request: typing then ↻ calls onReRequest with the instruction', async () => {
    const { dom, callbacks } = await render({
      state: { phase: 'done', suggestion: 'S', retryCount: 0 },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'polish',
      streamBuffer: '',
    });
    const input = dom.querySelector<HTMLInputElement>('.mdedit-ai-direct-input')!;
    input.value = '존댓말로';
    dom.querySelector<HTMLButtonElement>('.mdedit-ai-redo')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(callbacks.onReRequest).toHaveBeenCalled();
    expect(callbacks.onReRequest.mock.calls[0][0]).toBe('존댓말로');
  });

  it('empty phase shows the "바꿀 곳이 없어요" copy and no apply button', async () => {
    const { dom } = await render({
      state: { phase: 'empty', suggestion: '', retryCount: 0 },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'polish',
      streamBuffer: '',
    });
    expect(dom.textContent).toContain('바꿀 곳이 없어요');
    expect(dom.querySelector('.mdedit-ai-apply')).toBeNull();
  });

  it('retry-exhausted shows the sonnet fallback trigger (REQ-AI-025)', async () => {
    const { dom, callbacks } = await render({
      state: { phase: 'retry-exhausted', suggestion: 'S', retryCount: 3 },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'polish',
      streamBuffer: '',
    });
    const advanced = dom.querySelector<HTMLButtonElement>('.mdedit-ai-advanced')!;
    expect(advanced).toBeTruthy();
    advanced.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // one-shot sonnet re-request
    expect(callbacks.onReRequest).toHaveBeenCalled();
    expect(callbacks.onReRequest.mock.calls[0][1]).toBe('sonnet');
  });

  it('diagram-valid renders the mermaid code + a mini render placeholder + 아래 삽입', async () => {
    const { dom } = await render({
      state: { phase: 'diagram-valid', suggestion: '```mermaid\nflowchart LR\n A-->B\n```', retryCount: 0 },
      actions: { modes: ['insert-below'], primary: 'insert-below' },
      presetKind: 'diagram',
      streamBuffer: '',
    });
    expect(dom.textContent).toContain('flowchart');
    expect(dom.querySelector('.mdedit-ai-mermaid-preview')).toBeTruthy();
    expect(dom.querySelector('.mdedit-ai-apply[data-mode="insert-below"]')).toBeTruthy();
  });

  it('diagram-fallback offers 목록으로 정리 (REQ-AI-024)', async () => {
    const { dom, callbacks } = await render({
      state: { phase: 'diagram-fallback', suggestion: '', retryCount: 0 },
      actions: { modes: ['insert-below'], primary: 'insert-below' },
      presetKind: 'diagram',
      streamBuffer: '',
    });
    expect(dom.textContent).toContain('목록으로');
    const list = dom.querySelector<HTMLButtonElement>('.mdedit-ai-list-fallback')!;
    list.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(callbacks.onListFallback).toHaveBeenCalled();
  });

  it('stale phase shows the "원문이 바뀌어" notice and no apply button', async () => {
    const { dom } = await render({
      state: { phase: 'stale', suggestion: 'S', retryCount: 0 },
      actions: { modes: ['replace'], primary: 'replace' },
      presetKind: 'polish',
      streamBuffer: '',
    });
    expect(dom.textContent).toContain('원문이 바뀌어');
    expect(dom.querySelector('.mdedit-ai-apply')).toBeNull();
  });
});

describe('createAiSuggestionCard: extension factory', () => {
  it('returns a defined CodeMirror extension', async () => {
    const { createAiSuggestionCard } = await import(
      '@/components/editor/extensions/ai-suggestion-card'
    );
    expect(createAiSuggestionCard()).toBeDefined();
  });
});
