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

  it('omits providerId by default (backward compat, SPEC-AI-009)', async () => {
    const { buildSelectionRequest } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const req = buildSelectionRequest({ ...base, presetKind: 'polish' });
    expect(req.args.providerId).toBeUndefined();
  });

  it('carries providerId through when provided (SPEC-AI-009 REQ-AI9-003)', async () => {
    const { buildSelectionRequest } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const req = buildSelectionRequest({ ...base, presetKind: 'polish', providerId: 'codex' });
    expect(req.args.providerId).toBe('codex');
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

describe('evaluateMenuNotice: guard-derived preset-menu notice bands (SPEC-AI-007)', () => {
  it('len=2000 (boundary, no guard impact): returns null', async () => {
    const { evaluateMenuNotice } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(evaluateMenuNotice(2000)).toBeNull();
  });

  it('len=2001 (edit disabled, transform insertOnly): returns partial tone with the mixed-effect copy', async () => {
    const { evaluateMenuNotice } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const notice = evaluateMenuNotice(2001);
    expect(notice?.tone).toBe('partial');
    // 현재 글자 수와 편집 한도가 숫자로 보여야 한다(사용자가 얼마나 줄여야 할지 알 수 있게).
    expect(notice?.text).toContain('2,001자');
    expect(notice?.text).toContain('2,000자');
    expect(notice?.text).toContain('아래에 삽입');
  });

  it('len=4000 (boundary, still insertOnly): returns partial tone', async () => {
    const { evaluateMenuNotice } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const notice = evaluateMenuNotice(4000);
    expect(notice?.tone).toBe('partial');
  });

  it('len=4001 (all presets disabled): returns block tone reusing the guard reason verbatim', async () => {
    const { evaluateMenuNotice } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const { evaluateSelectionGuard } = await import(
      '@/components/editor/extensions/ai-length-guard'
    );
    const guardReason = evaluateSelectionGuard(4001, 'outline').reason;
    const notice = evaluateMenuNotice(4001);
    expect(notice).toEqual({ tone: 'block', text: guardReason });
    // 변환 계열이 걸린 것이므로 한도는 4,000자로 안내되어야 한다(편집 한도 2,000자가 아니라).
    expect(notice?.text).toContain('4,001자');
    expect(notice?.text).toContain('4,000자');
    expect(notice?.text).not.toContain('2,000자');
  });

  it('len=100 (well within edit limit): returns null', async () => {
    const { evaluateMenuNotice } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(evaluateMenuNotice(100)).toBeNull();
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

  it('len=4001: shows the always-visible too-long notice line and still keeps per-item title/disabled (REQ-AI7-001, 005)', async () => {
    const { menu } = await build(4001);
    const notice = menu.dom.querySelector('.mdedit-ai-preset-notice');
    expect(notice).toBeTruthy();
    expect(notice?.textContent).toContain('4,001자');
    expect(notice?.textContent).toContain('4,000자까지');
    const polish = menu.dom.querySelector<HTMLButtonElement>('[data-preset="polish"]')!;
    expect(polish.disabled).toBe(true);
    // 비활성 항목의 툴팁은 그 계열의 한도(편집 2,000자)를 안내해야 한다 — 메뉴 안내줄과 다른 숫자다.
    expect(polish.title).toContain('2,000자까지');
    expect(polish.getAttribute('aria-disabled')).toBe('true');
    menu.destroy();
  });

  it('len=3000: shows the partial (mixed-effect) notice line while transforms stay insertOnly (REQ-AI7-002)', async () => {
    const { menu } = await build(3000);
    const notice = menu.dom.querySelector('.mdedit-ai-preset-notice');
    expect(notice).toBeTruthy();
    expect(notice?.textContent).toContain('3,000자');
    expect(notice?.textContent).toContain('아래에 삽입');
    const polish = menu.dom.querySelector<HTMLButtonElement>('[data-preset="polish"]')!;
    expect(polish.disabled).toBe(true);
    const outline = menu.dom.querySelector<HTMLButtonElement>('[data-preset="outline"]')!;
    expect(outline.disabled).toBe(false);
    menu.destroy();
  });

  it('len=100: renders no notice line and leaves the preset list/sep structure unchanged (REQ-AI7-003)', async () => {
    const { menu } = await build(100);
    const notice = menu.dom.querySelector('.mdedit-ai-preset-notice');
    expect(notice).toBeFalsy();
    const list = menu.dom.querySelector('.mdedit-ai-preset-list');
    expect(list).toBeTruthy();
    const sep = menu.dom.querySelector('.mdedit-ai-preset-sep');
    expect(sep).toBeTruthy();
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

// BUG-2 실기기 재현: 선택이 에디터 창 오른쪽(스플리터 근처)에 있으면 좌측 정렬(left:0)된
// 프리셋 메뉴가 에디터 패널 오른쪽 경계 밖으로 나가 잘린다 — 세로 flip 과 대칭으로 가로 flip 한다.
describe('decideMenuHorizontalDirection: popover horizontal flip decision (BUG-2, pure)', () => {
  it('stays left-aligned when there is enough space to the right', async () => {
    const { decideMenuHorizontalDirection } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(
      decideMenuHorizontalDirection({ spaceRight: 300, spaceLeft: 100, menuWidth: 190 }),
    ).toBe('start');
  });

  it('flips right-aligned when space to the right is insufficient but the left is larger', async () => {
    const { decideMenuHorizontalDirection } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(
      decideMenuHorizontalDirection({ spaceRight: 50, spaceLeft: 400, menuWidth: 190 }),
    ).toBe('end');
  });

  it('stays left-aligned when neither side fits but the right still has more room', async () => {
    const { decideMenuHorizontalDirection } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(
      decideMenuHorizontalDirection({ spaceRight: 60, spaceLeft: 40, menuWidth: 190 }),
    ).toBe('start');
  });

  it('boundary: exactly enough space to the right stays left-aligned', async () => {
    const { decideMenuHorizontalDirection } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    expect(
      decideMenuHorizontalDirection({ spaceRight: 190, spaceLeft: 500, menuWidth: 190 }),
    ).toBe('start');
  });
});

describe('createPresetMenu: flips right-aligned against the clipping pane edge (BUG-2)', () => {
  const rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks.length = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    // 뷰포트는 넉넉하다 — 잘림의 원인은 뷰포트가 아니라 에디터 패널 경계임을 분명히 한다.
    Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  function flushRaf(): void {
    const cbs = rafCallbacks.splice(0, rafCallbacks.length);
    cbs.forEach((cb) => cb(0));
  }

  function mockRect(el: Element, rect: Partial<DOMRect>): void {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
      toJSON: () => ({}),
      ...rect,
    } as DOMRect);
  }

  /**
   * 실제 DOM 형태를 모사한다: overflow:hidden 인 에디터 패널 안에 ✨ 래퍼(position:relative)와
   * 그 아래 메뉴가 붙는다. 패널 오른쪽 경계(=스플리터)가 클리핑 경계다.
   */
  async function buildInPane(anchorLeft: number, anchorRight: number) {
    const mod = await import('@/components/editor/extensions/ai-selection-toolbar');
    const pane = document.createElement('div');
    pane.style.overflow = 'hidden';
    document.body.appendChild(pane);
    mockRect(pane, { left: 0, right: 600, width: 600, top: 0, bottom: 800, height: 800 });

    const wrapper = document.createElement('span');
    wrapper.className = 'mdedit-ai-toolbar';
    pane.appendChild(wrapper);

    const anchorEl = document.createElement('button');
    wrapper.appendChild(anchorEl);
    mockRect(anchorEl, {
      left: anchorLeft, right: anchorRight, width: anchorRight - anchorLeft,
      top: 100, bottom: 124, height: 24,
    });

    const callbacks = { onSelectPreset: vi.fn(), onSubmitCustom: vi.fn(), onClose: vi.fn() };
    const menu = mod.createPresetMenu({ selectionLength: 100, callbacks, anchorEl });
    wrapper.appendChild(menu.dom);
    mockRect(menu.dom, { width: 190, height: 220 });
    return { menu, pane };
  }

  it('adds the --end class when the anchor sits near the pane right edge', async () => {
    // 앵커 left=500 → 오른쪽 여유 100px < 메뉴 190px, 왼쪽 여유 524px → 우측 정렬로 뒤집는다.
    const { menu } = await buildInPane(500, 524);
    flushRaf();
    expect(menu.dom.classList.contains('mdedit-ai-preset-menu--end')).toBe(true);
    menu.destroy();
  });

  it('keeps the default (left-aligned) class when the pane has room to the right', async () => {
    // 앵커 left=100 → 오른쪽 여유 500px >= 메뉴 190px → 기본 좌측 정렬 유지.
    const { menu } = await buildInPane(100, 124);
    flushRaf();
    expect(menu.dom.classList.contains('mdedit-ai-preset-menu--end')).toBe(false);
    menu.destroy();
  });

  it('measures against the pane, not the viewport (the regression BUG-2 describes)', async () => {
    // 뷰포트(1600px) 기준이라면 오른쪽 여유가 1100px 이라 절대 뒤집지 않는다.
    // 패널(600px) 기준으로 측정해야만 뒤집힌다 — 이 테스트가 그 차이를 고정한다.
    const { menu } = await buildInPane(500, 524);
    flushRaf();
    expect(window.innerWidth - 500).toBeGreaterThan(190);
    expect(menu.dom.classList.contains('mdedit-ai-preset-menu--end')).toBe(true);
    menu.destroy();
  });

  it('falls back to the viewport when no clipping ancestor exists', async () => {
    const mod = await import('@/components/editor/extensions/ai-selection-toolbar');
    const anchorEl = document.createElement('button');
    document.body.appendChild(anchorEl);
    mockRect(anchorEl, {
      left: 1550, right: 1574, width: 24, top: 100, bottom: 124, height: 24,
    });
    const callbacks = { onSelectPreset: vi.fn(), onSubmitCustom: vi.fn(), onClose: vi.fn() };
    const menu = mod.createPresetMenu({ selectionLength: 100, callbacks, anchorEl });
    document.body.appendChild(menu.dom);
    mockRect(menu.dom, { width: 190, height: 220 });

    flushRaf();

    // 뷰포트 오른쪽 여유 50px < 190px, 왼쪽 여유 1574px → 뒤집는다.
    expect(menu.dom.classList.contains('mdedit-ai-preset-menu--end')).toBe(true);
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

// SPEC-AI-008: 다이어그램 종류 선택 플라이아웃 서브메뉴(명령형 DOM).
describe('createPresetMenu: diagram type flyout submenu (SPEC-AI-008)', () => {
  async function build(selectionLength = 100) {
    const mod = await import('@/components/editor/extensions/ai-selection-toolbar');
    const callbacks = {
      onSelectPreset: vi.fn(),
      onSubmitCustom: vi.fn(),
      onClose: vi.fn(),
    };
    const menu = mod.createPresetMenu({ selectionLength, callbacks });
    document.body.appendChild(menu.dom);
    const trigger = menu.dom.querySelector<HTMLButtonElement>('[data-preset="diagram"]')!;
    return { menu, callbacks, trigger };
  }

  const DIAGRAM_ICON_INNER = () => import('@/components/icons/diagramIconMarkup');

  it('the diagram item advertises a popup and starts collapsed (AC-001)', async () => {
    const { trigger, menu } = await build();
    expect(trigger.getAttribute('aria-haspopup')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    menu.destroy();
  });

  it('clicking the diagram item opens the submenu without firing a request (AC-001)', async () => {
    const { trigger, callbacks, menu } = await build();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.dom.querySelector('.mdedit-ai-diagram-submenu')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(callbacks.onSelectPreset).not.toHaveBeenCalled();
    menu.destroy();
  });

  it('hover (mouseenter) opens the submenu (AC-001, REQ-006)', async () => {
    const { trigger, menu } = await build();
    trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(menu.dom.querySelector('.mdedit-ai-diagram-submenu')).toBeTruthy();
    menu.destroy();
  });

  it('repeated clicks on an already-open submenu leave it open, not toggled closed (AC-001, REQ-001/002)', async () => {
    const { trigger, menu } = await build();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.dom.querySelector('.mdedit-ai-diagram-submenu')).toBeTruthy();
    // SPEC-AI-011: 트리거 클릭은 열기 전용(open-only) — 이미 열린 서브메뉴는 클릭으로 닫히지 않는다.
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.dom.querySelector('.mdedit-ai-diagram-submenu')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    menu.destroy();
  });

  // SPEC-AI-011 REQ-001/002: 실제 포인터 클릭은 mouseenter → click 순으로 발화한다(jsdom 은 이를
  // 자동 재현하지 않으므로 여기서 명시적으로 순서대로 dispatch 한다 — 브라우저 동작의 증명이 아니라
  // 가정의 문서화임을 인정한다. 실질 가드는 Playwright 계층, e2e/ai-inline-edit.spec.ts 다이어그램 테스트).
  it('real pointer click sequence (mouseenter then click) leaves the submenu open, not no-op (AC-001, REQ-001/002/003)', async () => {
    const { trigger, callbacks, menu } = await build();
    trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.dom.querySelector('.mdedit-ai-diagram-submenu')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    // 추가 클릭 2회도 여전히 열린 채로 남는다(멱등).
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.dom.querySelector('.mdedit-ai-diagram-submenu')).toBeTruthy();
    expect(callbacks.onSelectPreset).not.toHaveBeenCalled();
    menu.destroy();
  });

  it('renders exactly 8 items, auto first, then the 7 types in order (AC-002)', async () => {
    const { trigger, menu } = await build();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const items = menu.dom.querySelectorAll<HTMLButtonElement>('.mdedit-ai-diagram-submenu-item');
    expect(items.length).toBe(8);
    // every item is a native button with a non-empty aria-label + label text
    for (const it of items) {
      expect(it.tagName).toBe('BUTTON');
      expect(it.getAttribute('aria-label')).toBeTruthy();
      expect(it.textContent?.trim().length).toBeGreaterThan(0);
    }
    // auto first, no diagram type
    expect(items[0].dataset.diagramAuto).toBe('true');
    expect(items[0].textContent).toContain('자동');
    const types = Array.from(items)
      .slice(1)
      .map((it) => it.dataset.diagramType);
    expect(types).toEqual([
      'flowchart',
      'sequenceDiagram',
      'gantt',
      'classDiagram',
      'stateDiagram',
      'pie',
      'mindmap',
    ]);
    menu.destroy();
  });

  it('each of the 7 type items renders an <svg> with currentColor from the single source (AC-003)', async () => {
    const { trigger, menu } = await build();
    const { DIAGRAM_ICON_INNER: inner } = await DIAGRAM_ICON_INNER();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    for (const [type, expected] of Object.entries(inner)) {
      const item = menu.dom.querySelector<HTMLButtonElement>(`[data-diagram-type="${type}"]`)!;
      const svg = item.querySelector('svg')!;
      expect(svg).toBeTruthy();
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.innerHTML).toBe(expected);
    }
    menu.destroy();
  });

  it('selecting "자동" fires onSelectPreset("diagram") with no diagram type (AC-004)', async () => {
    const { trigger, callbacks, menu } = await build();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    menu.dom
      .querySelector<HTMLButtonElement>('[data-diagram-auto="true"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(callbacks.onSelectPreset).toHaveBeenCalledTimes(1);
    expect(callbacks.onSelectPreset).toHaveBeenCalledWith('diagram', undefined);
    menu.destroy();
  });

  it('selecting a type fires onSelectPreset("diagram", type) for each of the 7 (AC-005)', async () => {
    for (const type of [
      'flowchart',
      'sequenceDiagram',
      'gantt',
      'classDiagram',
      'stateDiagram',
      'pie',
      'mindmap',
    ]) {
      const { trigger, callbacks, menu } = await build();
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      menu.dom
        .querySelector<HTMLButtonElement>(`[data-diagram-type="${type}"]`)!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(callbacks.onSelectPreset).toHaveBeenCalledWith('diagram', type);
      menu.destroy();
    }
  });

  it('Escape closes only the submenu and keeps the preset list (AC-007)', async () => {
    const { trigger, callbacks, menu } = await build();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.dom.querySelector('.mdedit-ai-diagram-submenu')).toBeTruthy();
    menu.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.dom.querySelector('.mdedit-ai-diagram-submenu')).toBeNull();
    // preset list still present, menu not closed
    expect(menu.dom.querySelector('[data-preset="polish"]')).toBeTruthy();
    expect(callbacks.onClose).not.toHaveBeenCalled();
    menu.destroy();
  });
});

// SPEC-AI-008 후속(실기기 결함): 좁은/넓은 창에서 플라이아웃 서브메뉴가 잘린다. 수정 후 기계는
// 클래스 토글이 아니라 rAF 측정으로 계산한 inline left/top 오프셋(flip→clamp)이다. jsdom 은 레이아웃이
// 없으므로 앵커(wrap)·서브메뉴 rect + innerWidth/Height 를 목킹해 지오메트리를 재현하고, 열림 시
// 적용된 inline 오프셋을 검증한다(정밀한 flip/clamp 경계값은 menuPlacement.test.ts 순수 테스트 담당).
describe('createPresetMenu: diagram submenu clip-aware placement (SPEC-AI-008)', () => {
  const rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks.length = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushRaf(): void {
    const cbs = rafCallbacks.splice(0, rafCallbacks.length);
    cbs.forEach((cb) => cb(0));
  }

  function rect(partial: Partial<DOMRect>): DOMRect {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...partial,
    } as DOMRect;
  }

  async function openSubmenu() {
    const mod = await import('@/components/editor/extensions/ai-selection-toolbar');
    const callbacks = { onSelectPreset: vi.fn(), onSubmitCustom: vi.fn(), onClose: vi.fn() };
    const menu = mod.createPresetMenu({ selectionLength: 100, callbacks });
    document.body.appendChild(menu.dom);
    const trigger = menu.dom.querySelector<HTMLButtonElement>('[data-preset="diagram"]')!;
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const sub = menu.dom.querySelector<HTMLElement>('.mdedit-ai-diagram-submenu')!;
    return { menu, trigger, sub };
  }

  // 앵커(wrap = trigger.parentElement) rect 를 목킹한다 — 수정 후 배치는 앵커=offsetParent 기준.
  function mockAnchor(trigger: HTMLElement, r: Partial<DOMRect>): void {
    const wrap = trigger.parentElement as HTMLElement;
    vi.spyOn(wrap, 'getBoundingClientRect').mockReturnValue(rect(r));
  }

  it('opens rightward (default) when the submenu fits — offset beside the anchor, top-aligned', async () => {
    const { menu, trigger, sub } = await openSubmenu();
    mockAnchor(trigger, { left: 100, right: 300, top: 100, bottom: 124 });
    vi.spyOn(sub, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 300, right: 480, top: 100, bottom: 340, width: 180, height: 240 }),
    );
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    flushRaf();

    // right(300)+gap(4)=304 → offset.left = 304 - anchor.left(100) = 204; top aligns anchor.top → 0.
    expect(sub.style.left).toBe('204px');
    expect(sub.style.top).toBe('0px');
    menu.destroy();
  });

  it('flips to open leftward when the rightward submenu overflows the boundary right (narrow window)', async () => {
    const { menu, trigger, sub } = await openSubmenu();
    mockAnchor(trigger, { left: 360, right: 540, top: 100, bottom: 124 });
    // rightward would be 544..724 — beyond a 600px boundary; flip left to anchor.left-180-4 = 176.
    vi.spyOn(sub, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 540, right: 720, top: 100, bottom: 340, width: 180, height: 240 }),
    );
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    flushRaf();

    // offset.left = 176 - anchor.left(360) = -184 (opens leftward, fully inside 0..600).
    expect(sub.style.left).toBe('-184px');
    menu.destroy();
  });

  it('shifts up when the submenu overflows the boundary bottom', async () => {
    const { menu, trigger, sub } = await openSubmenu();
    mockAnchor(trigger, { left: 100, right: 300, top: 700, bottom: 724 });
    vi.spyOn(sub, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 300, right: 480, top: 700, bottom: 940, width: 180, height: 240 }),
    );
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    flushRaf();

    // down would be 700..940 — beyond 800; flip up to anchor.bottom-240 = 484 → offset.top = 484-700 = -216.
    expect(sub.style.top).toBe('-216px');
    menu.destroy();
  });
});

// SPEC-AI-008: 위젯 경유로 종류가 요청 args 에 실리는지(자동=미포함).
describe('AiSparkleWidget: diagram type carried into onRequest (SPEC-AI-008)', () => {
  function makeCtx(overrides: Record<string, unknown> = {}) {
    return {
      getSelection: () => ({
        text: 'hello',
        contextBefore: 'a ',
        contextAfter: ' b',
        from: 0,
        to: 5,
        originalText: 'hello',
      }),
      getUiState: () => ({ loggedIn: true, advancedModel: false }),
      onRequest: vi.fn(),
      onConnectNeeded: vi.fn(),
      ...overrides,
    };
  }

  async function open() {
    const { AiSparkleWidget } = await import(
      '@/components/editor/extensions/ai-selection-toolbar'
    );
    const ctx = makeCtx();
    const dom = new AiSparkleWidget(ctx as never, '0:5').toDOM();
    document.body.appendChild(dom);
    dom
      .querySelector<HTMLButtonElement>('.mdedit-ai-sparkle-btn')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    dom
      .querySelector<HTMLButtonElement>('[data-preset="diagram"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { ctx, dom };
  }

  it('auto → onRequest args has feature "diagram" and no diagramType (AC-004)', async () => {
    const { ctx, dom } = await open();
    dom
      .querySelector<HTMLButtonElement>('[data-diagram-auto="true"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const req = (ctx.onRequest as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.args.feature).toBe('diagram');
    expect(req.args.presetKind).toBe('diagram');
    expect(req.args.diagramType).toBeUndefined();
  });

  it('type → onRequest args carries the exact diagramType (AC-005)', async () => {
    const { ctx, dom } = await open();
    dom
      .querySelector<HTMLButtonElement>('[data-diagram-type="gantt"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const req = (ctx.onRequest as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.args.feature).toBe('diagram');
    expect(req.args.diagramType).toBe('gantt');
  });

  it('outside mousedown closes the whole menu incl. submenu (AC-008)', async () => {
    const { dom } = await open();
    expect(dom.querySelector('.mdedit-ai-diagram-submenu')).toBeTruthy();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(dom.querySelector('.mdedit-ai-preset-menu')).toBeNull();
    expect(dom.querySelector('.mdedit-ai-diagram-submenu')).toBeNull();
  });
});
