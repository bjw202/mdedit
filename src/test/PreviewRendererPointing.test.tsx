// @MX:SPEC: SPEC-AI-017 REQ-AI17-001 REQ-AI17-002 REQ-AI17-003 REQ-AI17-014 REQ-AI17-015
// @MX:NOTE: PreviewRenderer 의 ⌥+클릭·⌥ 강조·카드 대기 강조·정리를 jsdom 에서 단위로 검증한다. 실제 포인터 순서
// (⌥ vs 클릭 vs 드래그 vs 링크)는 jsdom 으로 판정하지 않는다 — Playwright(M5)에서 확인한다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const openUrlMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/tauri/ipc')>();
  return {
    ...real,
    aiRequest: (...a: unknown[]) => aiRequestMock(...a),
    aiCancel: vi.fn().mockResolvedValue(undefined),
    openUrlInBrowser: (...a: unknown[]) => openUrlMock(...a),
  };
});

import { renderMarkdown } from '@/lib/markdown/renderer';
import { PreviewRenderer } from '@/components/preview/PreviewRenderer';
import {
  createAiSuggestionCard,
  setActiveEditorView,
  clearCardRegistry,
  getCardControllers,
  setAiLoggedIn,
} from '@/components/editor/extensions/ai-suggestion-card';
import { setAiPolicyDisabled } from '@/store/aiPolicy';
import { useUIStore } from '@/store/uiStore';
import { runAiArtifactCleanup } from '@/lib/ai/aiOffEffects';
import { POINT_DOC } from './pointTestUtils';

const HOVER = 'md-point-target--hover';
const PENDING = 'md-point-target--pending';

const views: EditorView[] = [];

function mountEditor(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({ state: EditorState.create({ doc, extensions: [createAiSuggestionCard()] }), parent });
  setActiveEditorView(view);
  views.push(view);
  return view;
}

async function mountRenderer(source: string, editorDoc: string = source) {
  const html = await renderMarkdown(source, null, false);
  const view = mountEditor(editorDoc);
  const utils = render(<PreviewRenderer html={html} source={source} />);
  const root = utils.container.querySelector('.preview-content') as HTMLElement;
  return { ...utils, root, html, view };
}

async function rerenderWith(utils: { rerender: (ui: JSX.Element) => void }, source: string) {
  const html = await renderMarkdown(source, null, false);
  utils.rerender(<PreviewRenderer html={html} source={source} />);
}

const th = (root: HTMLElement, n: number): HTMLElement => root.querySelectorAll('table')[0].querySelectorAll('thead th')[n] as HTMLElement;
const popover = (): HTMLElement | null => document.querySelector('.md-point-popover');

function altClick(el: Element): boolean {
  return fireEvent.click(el, { altKey: true, clientX: 50, clientY: 60 });
}

function pointerMove(el: Element, altKey: boolean): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, altKey }));
  });
}
function altKey(type: 'keydown' | 'keyup'): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { key: 'Alt', altKey: type === 'keydown', bubbles: true }));
  });
}

beforeEach(() => {
  aiRequestMock.mockClear();
  openUrlMock.mockClear();
  setAiPolicyDisabled(false);
  setAiLoggedIn(true);
  useUIStore.setState({ aiEnabled: true, viewMode: 'split' });
  vi.stubGlobal('requestAnimationFrame', () => 0);
});

afterEach(() => {
  cleanup();
  act(() => {
    clearCardRegistry();
  });
  setActiveEditorView(null);
  views.splice(0).forEach((v) => {
    v.dom.parentElement?.remove();
    v.destroy();
  });
  vi.unstubAllGlobals();
});

describe('⌥+클릭 (REQ-AI17-001/002)', () => {
  it('열 머리 ⌥+클릭 → 입력창이 뜨고 기본 동작이 막힌다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    const notPrevented = altClick(th(root, 1));
    expect(notPrevented).toBe(false); // preventDefault 됨
    expect(popover()).not.toBeNull();
    expect(document.querySelector('.md-point-popover__summary')?.textContent).toBe('열: 월 요금');
  });

  it('칸 ⌥+클릭 → 칸 요약', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    altClick(root.querySelectorAll('table')[0].querySelectorAll('tbody tr')[1].querySelectorAll('td')[1]);
    expect(document.querySelector('.md-point-popover__summary')?.textContent).toBe('칸: 2행 · 월 요금');
  });

  it('노드 ⌥+클릭 → 노드 요약', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    altClick(root.querySelector('g.pele-node[data-id="C"] text') as Element);
    expect(document.querySelector('.md-point-popover__summary')?.textContent).toBe('노드: 결제 (C)');
  });

  it('⌥ 없는 클릭은 입력창을 열지 않고 기본 동작도 막지 않는다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    const notPrevented = fireEvent.click(th(root, 1));
    expect(notPrevented).toBe(true);
    expect(popover()).toBeNull();
  });

  it('링크 칸: ⌥+클릭은 입력창만 열고 링크를 열지 않는다, ⌥ 없는 클릭은 기존대로 링크를 연다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    const a = root.querySelector('a[href="https://example.com/p"]') as HTMLElement;
    altClick(a);
    expect(popover()).not.toBeNull();
    expect(openUrlMock).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.body); // 입력창 닫기
    fireEvent.click(a);
    expect(openUrlMock).toHaveBeenCalledWith('https://example.com/p');
  });

  it('대상이 아닌 곳(제목)·목록 안 표의 ⌥+클릭은 지금과 같다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    expect(altClick(root.querySelector('h1') as Element)).toBe(true);
    const nested = root.querySelectorAll('table')[1].querySelector('th') as Element;
    expect(altClick(nested)).toBe(true);
    expect(popover()).toBeNull();
  });

  it('가리키기가 비활성이면(AI 끔·정책 잠금·분할 아님) ⌥+클릭은 지금과 같다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    useUIStore.setState({ aiEnabled: false });
    expect(altClick(th(root, 1))).toBe(true);
    useUIStore.setState({ aiEnabled: true });
    setAiPolicyDisabled(true);
    expect(altClick(th(root, 1))).toBe(true);
    setAiPolicyDisabled(false);
    useUIStore.setState({ viewMode: 'preview' });
    expect(altClick(th(root, 1))).toBe(true);
    expect(popover()).toBeNull();
  });

  it('렌더 소스와 DOM 의 블록 수가 어긋나면 「가리킬 수 없어요」 안내만 보인다', async () => {
    const html = await renderMarkdown(POINT_DOC, null, false);
    mountEditor(POINT_DOC);
    const bad = POINT_DOC + '\n\n| x |\n|---|\n| y |';
    const { container } = render(<PreviewRenderer html={html} source={bad} />);
    altClick(container.querySelectorAll('table')[0].querySelectorAll('thead th')[1]);
    expect(document.querySelector('.md-point-popover__notice')?.textContent).toBe('이 블록은 가리킬 수 없어요');
    expect(document.querySelector('.md-point-popover__input')).toBeNull();
    expect(aiRequestMock).not.toHaveBeenCalled();
  });

  it('AC-005: 에디터 표 칸이 렌더 이후 바뀌었으면 낡음 안내만 보인다', async () => {
    const { root } = await mountRenderer(POINT_DOC, POINT_DOC.replace('100GB', '200GB'));
    altClick(th(root, 1));
    expect(document.querySelector('.md-point-popover__notice')?.textContent).toBe(
      '미리보기를 갱신하는 중이에요. 잠시 뒤 다시 눌러 주세요',
    );
  });
});

describe('보내기 (AC-AI17-001 보내기 시점, AC-AI17-009)', () => {
  async function openAndType(root: HTMLElement) {
    altClick(th(root, 1));
    const input = document.querySelector('.md-point-popover__input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '연 요금으로, ×10' } });
    return input;
  }

  it('Enter → 요청 1건, 입력창 닫힘, 카드 생성', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    const input = await openAndType(root);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(aiRequestMock).toHaveBeenCalledTimes(1);
    expect(aiRequestMock.mock.calls[0][0].presetKind).toBe('point-table');
    expect(popover()).toBeNull();
    expect(getCardControllers()).toHaveLength(1);
  });

  it('입력창을 연 뒤 정책 잠금 캐시를 참으로 바꾸고 보내면 요청 없이 닫힌다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    const input = await openAndType(root);
    setAiPolicyDisabled(true);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(aiRequestMock).not.toHaveBeenCalled();
    expect(popover()).toBeNull();
  });

  it('입력창을 연 뒤 사용자 토글을 끄고 보내면 요청 없이 닫힌다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    const input = await openAndType(root);
    act(() => useUIStore.setState({ aiEnabled: false }));
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(aiRequestMock).not.toHaveBeenCalled();
    expect(popover()).toBeNull();
  });

  it('입력창을 연 뒤 에디터 표를 고치고 보내면 낡음 안내로 바뀌고 요청하지 않는다', async () => {
    const { root, view } = await mountRenderer(POINT_DOC);
    const input = await openAndType(root);
    const at = view.state.doc.toString().indexOf('100GB');
    view.dispatch({ changes: { from: at, to: at + 5, insert: '200GB' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(aiRequestMock).not.toHaveBeenCalled();
    expect(document.querySelector('.md-point-popover__notice')?.textContent).toContain('미리보기를 갱신하는 중이에요');
  });
});

describe('⌥ 강조 (REQ-AI17-003, D16)', () => {
  it('⌥ 를 누른 채 열 머리 위: 그 th 에만 강조, ⌥ 를 떼면 사라진다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    pointerMove(th(root, 1), true);
    expect(root.querySelectorAll('.' + HOVER)).toHaveLength(1);
    expect(th(root, 1).classList.contains(HOVER)).toBe(true);
    altKey('keyup');
    expect(root.querySelectorAll('.' + HOVER)).toHaveLength(0);
  });

  it('포인터가 먼저 올라가 있고 ⌥ 를 나중에 누르면 강조가 생긴다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    pointerMove(th(root, 1), false);
    expect(root.querySelectorAll('.' + HOVER)).toHaveLength(0);
    altKey('keydown');
    expect(th(root, 1).classList.contains(HOVER)).toBe(true);
  });

  it('⌥ 없이 움직이면 강조가 지워지고, 대상을 벗어나도 지워진다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    pointerMove(th(root, 1), true);
    pointerMove(root.querySelector('h1') as Element, true);
    expect(root.querySelectorAll('.' + HOVER)).toHaveLength(0);
    pointerMove(th(root, 0), true);
    expect(th(root, 0).classList.contains(HOVER)).toBe(true);
    pointerMove(th(root, 0), false);
    expect(root.querySelectorAll('.' + HOVER)).toHaveLength(0);
  });

  it('창이 포커스를 잃으면(blur) 지워진다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    pointerMove(th(root, 1), true);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(root.querySelectorAll('.' + HOVER)).toHaveLength(0);
  });

  it('칸에는 td 에 강조가 붙는다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    const td = root.querySelectorAll('table')[0].querySelectorAll('tbody tr')[0].querySelectorAll('td')[2];
    pointerMove(td, true);
    expect(td.classList.contains(HOVER)).toBe(true);
  });

  it('노드는 같은 data-id 의 모든 g.pele-node 에 강조가 붙는다(sequence 참가자 위·아래)', async () => {
    const seq = '```mermaid\nsequenceDiagram\n  participant A\n  participant B\n  A->>B: hi\n```';
    const { root } = await mountRenderer(seq);
    const same = root.querySelectorAll('g.pele-node[data-id="A"]');
    expect(same.length).toBe(2);
    pointerMove(same[0].querySelector('text') as Element, true);
    expect(root.querySelectorAll('g.pele-node[data-id="A"].' + HOVER)).toHaveLength(2);
    expect(root.querySelectorAll('g.pele-node[data-id="B"].' + HOVER)).toHaveLength(0);
  });

  it('비활성이면 강조하지 않는다', async () => {
    const { root } = await mountRenderer(POINT_DOC);
    useUIStore.setState({ aiEnabled: false });
    pointerMove(th(root, 1), true);
    expect(root.querySelectorAll('.' + HOVER)).toHaveLength(0);
  });
});

describe('카드 대기 강조 (REQ-AI17-014)', () => {
  async function sendOnColumn(utils: Awaited<ReturnType<typeof mountRenderer>>) {
    altClick(th(utils.root, 1));
    const input = document.querySelector('.md-point-popover__input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.keyDown(input, { key: 'Enter' });
  }

  it('카드가 열려 있는 동안 대상이 대기 강조(다른 수정자)로 남는다', async () => {
    const u = await mountRenderer(POINT_DOC);
    await sendOnColumn(u);
    expect(th(u.root, 1).classList.contains(PENDING)).toBe(true);
    expect(th(u.root, 1).classList.contains(HOVER)).toBe(false);
    expect(th(u.root, 1).classList.contains('md-point-target')).toBe(true);
  });

  it('제목 줄만 바뀌어 다시 그려지면 강조가 복원된다', async () => {
    const u = await mountRenderer(POINT_DOC);
    await sendOnColumn(u);
    await rerenderWith(u, POINT_DOC.replace('# 요금', '# 요금표'));
    expect(th(u.root, 1).classList.contains(PENDING)).toBe(true);
  });

  it('대상 표의 칸이 바뀌어 다시 그려지면 강조가 지워진다', async () => {
    const u = await mountRenderer(POINT_DOC);
    await sendOnColumn(u);
    await rerenderWith(u, POINT_DOC.replace('100GB', '200GB'));
    expect(u.root.querySelectorAll('.md-point-target')).toHaveLength(0);
  });

  it('카드가 닫히면 강조가 사라진다', async () => {
    const u = await mountRenderer(POINT_DOC);
    await sendOnColumn(u);
    act(() => {
      clearCardRegistry();
    });
    expect(u.root.querySelectorAll('.md-point-target')).toHaveLength(0);
  });

  it('노드 카드: 같은 data-id 의 모든 노드가 대기 강조로 남는다', async () => {
    const seq = '```mermaid\nsequenceDiagram\n  participant A\n  participant B\n  A->>B: hi\n```';
    const u = await mountRenderer(seq);
    altClick(u.root.querySelectorAll('g.pele-node[data-id="A"]')[0].querySelector('text') as Element);
    const input = document.querySelector('.md-point-popover__input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(u.root.querySelectorAll('g.pele-node[data-id="A"].' + PENDING)).toHaveLength(2);
  });
});

describe('AC-AI17-007 정리', () => {
  it('입력창·가리키기 카드·강조가 있는 상태에서 runAiArtifactCleanup() → 모두 사라진다', async () => {
    const u = await mountRenderer(POINT_DOC);
    // 카드 + 대기 강조 만들기
    altClick(th(u.root, 1));
    const input = document.querySelector('.md-point-popover__input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(getCardControllers()).toHaveLength(1);
    // 입력창 다시 열고 ⌥ 강조도 만들기
    altClick(th(u.root, 0));
    pointerMove(th(u.root, 0), true);
    expect(popover()).not.toBeNull();
    expect(u.root.querySelectorAll('.md-point-target').length).toBeGreaterThan(0);

    act(() => {
      runAiArtifactCleanup();
    });

    expect(popover()).toBeNull();
    expect(getCardControllers()).toHaveLength(0);
    expect(document.querySelectorAll('.md-point-target, .' + HOVER + ', .' + PENDING)).toHaveLength(0);
  });
});
