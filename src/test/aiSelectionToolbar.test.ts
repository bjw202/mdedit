// @MX:SPEC: SPEC-AI-001 REQ-AI-019 REQ-AI-020 REQ-AI-015 REQ-AI-026 REQ-AI-027
// TDD RED phase — written before ai-selection-toolbar.ts exists.
// Covers: paragraph-context extraction, request-args building (feature mapping /
// insertOnly / model), guard-driven preset disable states (1999/2001/4001), the
// ✨ widget appearance on selection, the preset popover morph/Esc 복귀, and the
// "연결 필요" (not-logged-in) gate.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/**
 * Minimal fake "view" backed by a real CodeMirror EditorState — same pattern as
 * insertTable.test.ts. buildToolbarDecorations only reads view.state, so this is
 * a faithful stand-in without a mounted DOM tree.
 */
function createTestView(doc: string, from: number, to: number = from): EditorView {
  const state = EditorState.create({ doc, selection: EditorSelection.single(from, to) });
  return { get state() { return state; } } as unknown as EditorView;
}

describe('extractParagraphContext: paragraph-bounded context slicing', () => {
  it('slices before/after within the same paragraph, bounded by blank lines', async () => {
    const { extractParagraphContext } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const before = 'Para one.';
    const mid = 'Select this text here.';
    const after = 'Para three.';
    const doc = `${before}\n\n${mid}\n\n${after}`;
    const core = 'this text';
    const from = doc.indexOf(core);
    const to = from + core.length;

    const result = extractParagraphContext(doc, from, to);
    expect(result.selection).toBe('this text');
    expect(result.contextBefore).toBe(mid.slice(0, mid.indexOf(core)));
    expect(result.contextAfter).toBe(mid.slice(mid.indexOf(core) + core.length));
  });

  it('empty contextBefore when the selection is in the first paragraph at doc start', async () => {
    const { extractParagraphContext } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const doc = 'Head selection tail.\n\nNext para.';
    const core = 'Head';
    const result = extractParagraphContext(doc, 0, core.length);
    expect(result.selection).toBe('Head');
    expect(result.contextBefore).toBe('');
    expect(result.contextAfter).toBe(' selection tail.');
  });

  it('empty contextAfter when the selection ends at doc end', async () => {
    const { extractParagraphContext } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const doc = 'Prev para.\n\nlead tail END';
    const core = 'END';
    const from = doc.indexOf(core);
    const result = extractParagraphContext(doc, from, doc.length);
    expect(result.selection).toBe('END');
    expect(result.contextBefore).toBe('lead tail ');
    expect(result.contextAfter).toBe('');
  });

  it('single-paragraph document (no blank lines) uses whole doc as boundaries', async () => {
    const { extractParagraphContext } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const doc = 'aaa bbb ccc';
    const from = doc.indexOf('bbb');
    const to = from + 'bbb'.length;
    const result = extractParagraphContext(doc, from, to);
    expect(result.contextBefore).toBe('aaa ');
    expect(result.contextAfter).toBe(' ccc');
  });
});

describe('presetToFeature: preset → AiFeature mapping', () => {
  it('maps the diagram preset to the dedicated "diagram" feature', async () => {
    const { presetToFeature } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(presetToFeature('diagram')).toBe('diagram');
  });

  it('maps all non-diagram presets to "inline-edit"', async () => {
    const { presetToFeature } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    for (const kind of ['polish', 'outline', 'table', 'shorten', 'custom'] as const) {
      expect(presetToFeature(kind)).toBe('inline-edit');
    }
  });
});

describe('resolveModel: advanced-model toggle drives model selection', () => {
  it('returns haiku by default (advanced off)', async () => {
    const { resolveModel } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(resolveModel({ loggedIn: true, advancedModel: false })).toBe('haiku');
  });

  it('returns sonnet when the advanced model toggle is on', async () => {
    const { resolveModel } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(resolveModel({ loggedIn: true, advancedModel: true })).toBe('sonnet');
  });
});

describe('buildSelectionRequest: AiRequestArgs assembly + insertOnly metadata', () => {
  const base = {
    requestId: 'req-1',
    selection: 'hello',
    contextBefore: 'a ',
    contextAfter: ' b',
    model: 'haiku' as const,
  };

  it('builds inline-edit args for the polish preset and omits customInstruction', async () => {
    const { buildSelectionRequest } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const req = buildSelectionRequest({ ...base, presetKind: 'polish' });
    expect(req.args.feature).toBe('inline-edit');
    expect(req.args.presetKind).toBe('polish');
    expect(req.args.requestId).toBe('req-1');
    expect(req.args.selection).toBe('hello');
    expect(req.args.contextBefore).toBe('a ');
    expect(req.args.contextAfter).toBe(' b');
    expect(req.args.model).toBe('haiku');
    expect(req.args.customInstruction).toBeUndefined();
    expect(req.insertOnly).toBe(false);
  });

  it('carries customInstruction only for the custom preset', async () => {
    const { buildSelectionRequest } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const req = buildSelectionRequest({
      ...base,
      presetKind: 'custom',
      customInstruction: '영어로 번역해줘',
    });
    expect(req.args.feature).toBe('inline-edit');
    expect(req.args.customInstruction).toBe('영어로 번역해줘');
  });

  it('sets the diagram feature for the diagram preset', async () => {
    const { buildSelectionRequest } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const req = buildSelectionRequest({ ...base, presetKind: 'diagram' });
    expect(req.args.feature).toBe('diagram');
  });

  it('marks insertOnly=true for a transform preset in the 2K-4K band', async () => {
    const { buildSelectionRequest } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const longSel = 'x'.repeat(3000);
    const req = buildSelectionRequest({
      ...base,
      selection: longSel,
      presetKind: 'outline',
    });
    expect(req.insertOnly).toBe(true);
    expect(req.args.selection).toBe(longSel); // never truncated (REQ-AI-027)
    expect(req.args.selection).toHaveLength(3000);
  });

  it('carries sonnet through when the advanced model is chosen', async () => {
    const { buildSelectionRequest } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const req = buildSelectionRequest({ ...base, presetKind: 'polish', model: 'sonnet' });
    expect(req.args.model).toBe('sonnet');
  });
});

describe('buildPresetMenuItems: guard-driven disable states by selection length', () => {
  const kinds = ['polish', 'outline', 'table', 'diagram', 'shorten', 'custom'];

  it('produces the 6 presets in design order with emoji labels', async () => {
    const { buildPresetMenuItems } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const items = buildPresetMenuItems(100);
    expect(items.map((i) => i.kind)).toEqual(kinds);
    expect(items[0].label).toContain('다듬기');
    expect(items[1].label).toContain('개요로 정리');
    expect(items[2].label).toContain('표로 만들기');
    expect(items[3].label).toContain('다이어그램으로');
    expect(items[4].label).toContain('짧게 줄이기');
    expect(items[5].label).toContain('직접 입력');
  });

  it('len=1999: every preset enabled, none insertOnly', async () => {
    const { buildPresetMenuItems } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const items = buildPresetMenuItems(1999);
    for (const item of items) {
      expect(item.disabled).toBe(false);
      expect(item.insertOnly).toBe(false);
    }
  });

  it('len=2001: edit presets (polish/custom) disabled, transforms enabled + insertOnly', async () => {
    const { buildPresetMenuItems } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const items = buildPresetMenuItems(2001);
    const byKind = Object.fromEntries(items.map((i) => [i.kind, i]));
    expect(byKind.polish.disabled).toBe(true);
    expect(byKind.polish.reason).toBeTruthy();
    expect(byKind.custom.disabled).toBe(true);
    for (const k of ['outline', 'table', 'diagram', 'shorten']) {
      expect(byKind[k].disabled).toBe(false);
      expect(byKind[k].insertOnly).toBe(true);
    }
  });

  it('len=4001: all presets disabled with a reason', async () => {
    const { buildPresetMenuItems } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const items = buildPresetMenuItems(4001);
    for (const item of items) {
      expect(item.disabled).toBe(true);
      expect(item.reason).toBeTruthy();
    }
  });
});

describe('buildToolbarDecorations: ✨ widget appears only on a non-empty selection', () => {
  it('emits exactly one widget when text is selected', async () => {
    const { buildToolbarDecorations } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const view = createTestView('some selected text', 5, 13);
    const set = buildToolbarDecorations(view, {});
    expect(set.size).toBe(1);
  });

  it('emits no widget when the selection is collapsed (empty)', async () => {
    const { buildToolbarDecorations } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const view = createTestView('some text', 4, 4);
    const set = buildToolbarDecorations(view, {});
    expect(set.size).toBe(0);
  });
});

describe('createPresetMenu: popover interaction (jsdom)', () => {
  function mount(selectionLength: number) {
    const callbacks = {
      onSelectPreset: vi.fn(),
      onSubmitCustom: vi.fn(),
      onClose: vi.fn(),
    };
    return { callbacks, selectionLength };
  }

  async function build(selectionLength: number) {
    const mod = await import('@/components/editor/extensions/ai-selection-toolbar');
    const { callbacks } = mount(selectionLength);
    const menu = mod.createPresetMenu({ selectionLength, callbacks });
    document.body.appendChild(menu.dom);
    return { menu, callbacks };
  }

  it('renders enabled preset buttons and fires onSelectPreset on click', async () => {
    const { menu, callbacks } = await build(100);
    const polish = menu.dom.querySelector<HTMLButtonElement>('[data-preset="polish"]')!;
    expect(polish).toBeTruthy();
    expect(polish.disabled).toBe(false);
    polish.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(callbacks.onSelectPreset).toHaveBeenCalledWith('polish');
    menu.destroy();
  });

  it('disables over-limit presets with a reason title and ignores their clicks', async () => {
    const { menu, callbacks } = await build(2001);
    const polish = menu.dom.querySelector<HTMLButtonElement>('[data-preset="polish"]')!;
    expect(polish.disabled).toBe(true);
    expect(polish.title).toBeTruthy();
    polish.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(callbacks.onSelectPreset).not.toHaveBeenCalled();
    menu.destroy();
  });

  it('morphs into a one-line input when "직접 입력..." is chosen', async () => {
    const { menu } = await build(100);
    const custom = menu.dom.querySelector<HTMLButtonElement>('[data-preset="custom"]')!;
    custom.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const input = menu.dom.querySelector<HTMLInputElement>('.mdedit-ai-custom-input');
    expect(input).toBeTruthy();
    expect(input!.placeholder).toContain('영어로 번역');
    // Preset list is gone while in custom-input mode.
    expect(menu.dom.querySelector('[data-preset="polish"]')).toBeNull();
    menu.destroy();
  });

  it('Enter in the custom input submits the trimmed instruction', async () => {
    const { menu, callbacks } = await build(100);
    menu.dom
      .querySelector<HTMLButtonElement>('[data-preset="custom"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const input = menu.dom.querySelector<HTMLInputElement>('.mdedit-ai-custom-input')!;
    input.value = '  더 짧게  ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(callbacks.onSubmitCustom).toHaveBeenCalledWith('더 짧게');
    menu.destroy();
  });

  it('Esc from custom-input returns to the preset list (does not close)', async () => {
    const { menu, callbacks } = await build(100);
    menu.dom
      .querySelector<HTMLButtonElement>('[data-preset="custom"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const input = menu.dom.querySelector<HTMLInputElement>('.mdedit-ai-custom-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(menu.dom.querySelector('[data-preset="polish"]')).toBeTruthy();
    expect(callbacks.onClose).not.toHaveBeenCalled();
    menu.destroy();
  });

  it('the ← back button returns from custom-input to the preset list', async () => {
    const { menu } = await build(100);
    menu.dom
      .querySelector<HTMLButtonElement>('[data-preset="custom"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const back = menu.dom.querySelector<HTMLButtonElement>('.mdedit-ai-back')!;
    back.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.dom.querySelector('[data-preset="polish"]')).toBeTruthy();
    menu.destroy();
  });

  it('Esc from the preset list closes the menu', async () => {
    const { menu, callbacks } = await build(100);
    menu.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(callbacks.onClose).toHaveBeenCalled();
    menu.destroy();
  });
});

// BUG-9 실기기 재현: 문서/뷰포트 아래쪽에서 ✨ 를 트리거하면 프리셋 메뉴가 뷰포트 밖(아래)에
// 뜬다 — 표준 popover flip: 아래 공간이 부족하면 위로 뒤집는다.
describe('decideMenuFlipDirection: popover flip decision (BUG-9, pure)', () => {
  it('opens below when there is enough space below the anchor', async () => {
    const { decideMenuFlipDirection } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(
      decideMenuFlipDirection({ spaceBelow: 300, spaceAbove: 100, menuHeight: 200 }),
    ).toBe('below');
  });

  it('flips above when space below is insufficient but space above is larger', async () => {
    const { decideMenuFlipDirection } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(
      decideMenuFlipDirection({ spaceBelow: 50, spaceAbove: 400, menuHeight: 200 }),
    ).toBe('above');
  });

  it('stays below when neither side fits but below still has more room', async () => {
    const { decideMenuFlipDirection } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(
      decideMenuFlipDirection({ spaceBelow: 60, spaceAbove: 40, menuHeight: 200 }),
    ).toBe('below');
  });

  it('boundary: exactly enough space below stays below', async () => {
    const { decideMenuFlipDirection } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(
      decideMenuFlipDirection({ spaceBelow: 200, spaceAbove: 500, menuHeight: 200 }),
    ).toBe('below');
  });
});

describe('createPresetMenu: flips above the anchor when there is no room below (BUG-9)', () => {
  const rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks.length = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushRaf(): void {
    const cbs = rafCallbacks.splice(0, rafCallbacks.length);
    cbs.forEach((cb) => cb(0));
  }

  it('adds the --above class when the anchor is near the bottom of the viewport', async () => {
    const mod = await import('@/components/editor/extensions/ai-selection-toolbar');
    const anchorEl = document.createElement('button');
    document.body.appendChild(anchorEl);
    // 뷰포트 맨 아래 근처(버튼 아래 40px 만 남음), 위쪽은 충분(700px).
    vi.spyOn(anchorEl, 'getBoundingClientRect').mockReturnValue({
      bottom: 760,
      top: 736,
      left: 0,
      right: 0,
      width: 0,
      height: 24,
      x: 0,
      y: 736,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const callbacks = { onSelectPreset: vi.fn(), onSubmitCustom: vi.fn(), onClose: vi.fn() };
    const menu = mod.createPresetMenu({ selectionLength: 100, callbacks, anchorEl });
    document.body.appendChild(menu.dom);
    vi.spyOn(menu.dom, 'getBoundingClientRect').mockReturnValue({
      height: 220,
      bottom: 0,
      top: 0,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    flushRaf();

    expect(menu.dom.classList.contains('mdedit-ai-preset-menu--above')).toBe(true);
    menu.destroy();
  });

  it('keeps the default (below) class when there is enough room below', async () => {
    const mod = await import('@/components/editor/extensions/ai-selection-toolbar');
    const anchorEl = document.createElement('button');
    document.body.appendChild(anchorEl);
    vi.spyOn(anchorEl, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      top: 76,
      left: 0,
      right: 0,
      width: 0,
      height: 24,
      x: 0,
      y: 76,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const callbacks = { onSelectPreset: vi.fn(), onSubmitCustom: vi.fn(), onClose: vi.fn() };
    const menu = mod.createPresetMenu({ selectionLength: 100, callbacks, anchorEl });
    document.body.appendChild(menu.dom);
    vi.spyOn(menu.dom, 'getBoundingClientRect').mockReturnValue({
      height: 220,
      bottom: 0,
      top: 0,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    flushRaf();

    expect(menu.dom.classList.contains('mdedit-ai-preset-menu--above')).toBe(false);
    menu.destroy();
  });
});

describe('AiSparkleWidget: login gate and request firing (jsdom)', () => {
  function makeCtx(overrides: Record<string, unknown> = {}) {
    return {
      getSelection: () => ({ text: 'hello', contextBefore: 'a ', contextAfter: ' b' }),
      getUiState: () => ({ loggedIn: true, advancedModel: false }),
      onRequest: vi.fn(),
      onConnectNeeded: vi.fn(),
      ...overrides,
    };
  }

  it('shows "연결 필요" and calls onConnectNeeded when not logged in (REQ-AI-015)', async () => {
    const { AiSparkleWidget } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const ctx = makeCtx({
      getUiState: () => ({ loggedIn: false, advancedModel: false }),
    });
    const dom = new AiSparkleWidget(ctx as never, '0:5').toDOM();
    document.body.appendChild(dom);
    dom
      .querySelector<HTMLButtonElement>('.mdedit-ai-sparkle-btn')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(ctx.onConnectNeeded).toHaveBeenCalled();
    expect(ctx.onRequest).not.toHaveBeenCalled();
    expect(dom.textContent).toContain('연결 필요');
    expect(dom.querySelector('.mdedit-ai-preset-menu')).toBeNull();
  });

  it('opens the preset menu when logged in and fires onRequest on preset click', async () => {
    const { AiSparkleWidget } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const ctx = makeCtx();
    const dom = new AiSparkleWidget(ctx as never, '0:5').toDOM();
    document.body.appendChild(dom);
    dom
      .querySelector<HTMLButtonElement>('.mdedit-ai-sparkle-btn')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const menu = dom.querySelector('.mdedit-ai-preset-menu');
    expect(menu).toBeTruthy();
    expect(ctx.onConnectNeeded).not.toHaveBeenCalled();

    dom
      .querySelector<HTMLButtonElement>('[data-preset="polish"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(ctx.onRequest).toHaveBeenCalledTimes(1);
    const req = (ctx.onRequest as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.args.feature).toBe('inline-edit');
    expect(req.args.presetKind).toBe('polish');
    expect(req.args.model).toBe('haiku');
    expect(req.args.selection).toBe('hello');
    expect(req.insertOnly).toBe(false);
  });

  it('resolves the sonnet model through the widget when advanced is on', async () => {
    const { AiSparkleWidget } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const ctx = makeCtx({
      getUiState: () => ({ loggedIn: true, advancedModel: true }),
    });
    const dom = new AiSparkleWidget(ctx as never, '0:5').toDOM();
    document.body.appendChild(dom);
    dom
      .querySelector<HTMLButtonElement>('.mdedit-ai-sparkle-btn')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    dom
      .querySelector<HTMLButtonElement>('[data-preset="polish"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const req = (ctx.onRequest as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.args.model).toBe('sonnet');
  });
});

// SPEC-AI-002 REQ-AI2-008(선택): 요청이 in-flight인 동안 ✨ 버튼이 pulse 한다.
describe('AiSparkleWidget: in-flight pulse (SPEC-AI-002 REQ-AI2-008)', () => {
  function makeCtx(overrides: Record<string, unknown> = {}) {
    return {
      getSelection: () => ({ text: 'hello', contextBefore: 'a ', contextAfter: ' b' }),
      getUiState: () => ({ loggedIn: true, advancedModel: false }),
      onRequest: vi.fn(),
      onConnectNeeded: vi.fn(),
      ...overrides,
    };
  }

  it('idle 상태에서는 pulse 클래스가 없다', async () => {
    const { useAiStore, idleSlice } = await import('@/store/aiStore');
    useAiStore.setState({ ...idleSlice });
    const { AiSparkleWidget } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const dom = new AiSparkleWidget(makeCtx() as never, '0:5').toDOM();
    document.body.appendChild(dom);
    expect(dom.querySelector('.mdedit-ai-sparkle-btn')?.classList.contains('is-pulsing')).toBe(
      false,
    );
  });

  it('streaming 으로 전이되면 pulse 클래스가 붙고, 종료되면 제거된다', async () => {
    const { useAiStore, idleSlice } = await import('@/store/aiStore');
    useAiStore.setState({ ...idleSlice });
    const { AiSparkleWidget } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const widget = new AiSparkleWidget(makeCtx() as never, '0:5');
    const dom = widget.toDOM();
    document.body.appendChild(dom);
    const btn = dom.querySelector('.mdedit-ai-sparkle-btn')!;
    expect(btn.classList.contains('is-pulsing')).toBe(false);

    useAiStore.setState({ requestState: 'streaming', requestId: 'sel-1' });
    expect(btn.classList.contains('is-pulsing')).toBe(true);

    useAiStore.setState({ requestState: 'done' });
    expect(btn.classList.contains('is-pulsing')).toBe(false);

    // destroy() 이후에는 구독이 해제되어 더 이상 갱신되지 않는다(리스너 누수 방지).
    widget.destroy();
    useAiStore.setState({ requestState: 'streaming', requestId: 'sel-2' });
    expect(btn.classList.contains('is-pulsing')).toBe(false);
  });
});

describe('createAiSelectionToolbar: extension factory', () => {
  it('returns a defined CodeMirror extension', async () => {
    const { createAiSelectionToolbar } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const ext = createAiSelectionToolbar();
    expect(ext).toBeDefined();
  });
});
