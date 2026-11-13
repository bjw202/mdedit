// @MX:SPEC: SPEC-AI-017 REQ-AI17-001 REQ-AI17-006 REQ-AI17-008 REQ-AI17-009 AC-AI17-001 AC-AI17-005 AC-AI17-009
// 보내기 순간 재확인(활성·낡음·길이)과 요청 조립을 실제 renderMarkdown DOM + 실제 EditorView 로 검증한다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...args: unknown[]) => aiRequestMock(...args),
  aiCancel: vi.fn().mockResolvedValue(undefined),
  ipcErrorMessage: (r: unknown) => (typeof r === 'string' ? r : 'error'),
}));

import {
  createAiSuggestionCard,
  setActiveEditorView,
  clearCardRegistry,
  getCardControllers,
  setAiLoggedIn,
  registerOnboardingOpener,
} from '@/components/editor/extensions/ai-suggestion-card';
import { setAiPolicyDisabled } from '@/store/aiPolicy';
import { useUIStore } from '@/store/uiStore';
import { classifyTarget, locatePointBlock, type PointBlock, type PointClassification } from '@/lib/preview/pointTarget';
import { sendPointRequest, getPointRef } from '@/lib/preview/pointRequest';
import { mountPreview, POINT_DOC } from './pointTestUtils';

function mountEditor(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({ state: EditorState.create({ doc, extensions: [createAiSuggestionCard()] }), parent });
  setActiveEditorView(view);
  return view;
}

async function pick(source: string, kind: 'column' | 'node'): Promise<{ root: HTMLElement; target: PointClassification; block: PointBlock }> {
  const root = await mountPreview(source);
  let el: Element | null;
  if (kind === 'column') el = root.querySelectorAll('table')[0].querySelectorAll('thead th')[1];
  else el = root.querySelector('g.pele-node[data-id="C"] text, g.pele-node[data-id="C"]');
  const target = classifyTarget(el, root);
  const loc = locatePointBlock(root, source, target);
  if (!loc.ok) throw new Error('locate 실패');
  return { root, target, block: loc.block };
}

beforeEach(() => {
  aiRequestMock.mockClear();
  setAiPolicyDisabled(false);
  setAiLoggedIn(true);
  registerOnboardingOpener(null);
  useUIStore.setState({ aiEnabled: true, viewMode: 'split' });
  // jsdom 은 Range.getClientRects 가 없어 CodeMirror 의 rAF 측정이 터진다 → rAF 를 끈다(aiGhostEmptyDone 선례).
  vi.stubGlobal('requestAnimationFrame', () => 0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCardRegistry();
  setActiveEditorView(null);
  document.body.innerHTML = '';
});

describe('sendPointRequest — 요청 조립(AC-AI17-009)', () => {
  it('열 대상: 인자·카드 범위·원문을 정확히 만들고 앞뒤 문맥은 싣지 않는다', async () => {
    const view = mountEditor(POINT_DOC);
    const { target, block } = await pick(POINT_DOC, 'column');
    const out = sendPointRequest({ source: POINT_DOC, target, block, instruction: '연 요금으로, ×10' });
    expect(out).toBe('sent');
    expect(aiRequestMock).toHaveBeenCalledTimes(1);
    const args = aiRequestMock.mock.calls[0][0];
    const tableText = POINT_DOC.split('\n').slice(2, 7).join('\n');
    expect(args.feature).toBe('inline-edit');
    expect(args.presetKind).toBe('point-table');
    expect(args.selection).toBe(tableText);
    expect(args.customInstruction).toBe('연 요금으로, ×10');
    expect(args.pointer).toBe('대상: 열\n열 번호: 2 (왼쪽부터)\n열 머리: 월 요금');
    expect('contextBefore' in args).toBe(false);
    expect('contextAfter' in args).toBe(false);
    const card = getCardControllers()[0];
    expect(card.model.presetKind).toBe('point-table');
    expect(card.model.originalText).toBe(tableText);
    expect(view.state.sliceDoc(card.model.range.from, card.model.range.to)).toBe(tableText);
    expect(card.model.insertOnly).toBe(false);
    expect(getPointRef(card.model.requestId)).toMatchObject({ blockKind: 'table', ordinal: 0, blockText: tableText });
  });

  it('노드 대상: selection 은 펜스 안 코드, 카드 범위는 펜스 줄까지 포함한 블록 전체', async () => {
    const view = mountEditor(POINT_DOC);
    const { target, block } = await pick(POINT_DOC, 'node');
    expect(sendPointRequest({ source: POINT_DOC, target, block, instruction: '결제 앞에 캐시 노드 추가' })).toBe('sent');
    const args = aiRequestMock.mock.calls[0][0];
    expect(args.presetKind).toBe('point-diagram');
    expect(args.selection).toBe(POINT_DOC.split('\n').slice(9, 14).join('\n'));
    expect(args.pointer).toBe('대상: 노드\n노드 ID: C\n표시 글자: 결제');
    const card = getCardControllers()[0];
    const fenced = POINT_DOC.split('\n').slice(8, 15).join('\n');
    expect(card.model.originalText).toBe(fenced);
    expect(view.state.sliceDoc(card.model.range.from, card.model.range.to)).toBe(fenced);
  });

  it('블록 앞쪽에 줄이 추가돼도(블록 텍스트 동일) 카드 범위는 보내기 순간의 문서 기준이다', async () => {
    const view = mountEditor('새 줄\n' + POINT_DOC);
    const { target, block } = await pick(POINT_DOC, 'column');
    expect(sendPointRequest({ source: POINT_DOC, target, block, instruction: 'x' })).toBe('sent');
    const card = getCardControllers()[0];
    expect(view.state.sliceDoc(card.model.range.from, card.model.range.to)).toBe(
      POINT_DOC.split('\n').slice(2, 7).join('\n'),
    );
  });
});

describe('sendPointRequest — 보내기 시점 재확인', () => {
  it('AC-001: 정책 잠금 캐시가 참이면 요청을 만들지 않는다', async () => {
    mountEditor(POINT_DOC);
    const { target, block } = await pick(POINT_DOC, 'column');
    setAiPolicyDisabled(true);
    expect(sendPointRequest({ source: POINT_DOC, target, block, instruction: 'x' })).toBe('inactive');
    expect(aiRequestMock).not.toHaveBeenCalled();
    expect(getCardControllers()).toHaveLength(0);
  });

  it('AC-001: 사용자 토글이 꺼졌거나 분할 보기가 아니면 요청을 만들지 않는다', async () => {
    mountEditor(POINT_DOC);
    const { target, block } = await pick(POINT_DOC, 'column');
    useUIStore.setState({ aiEnabled: false });
    expect(sendPointRequest({ source: POINT_DOC, target, block, instruction: 'x' })).toBe('inactive');
    useUIStore.setState({ aiEnabled: true, viewMode: 'preview' });
    expect(sendPointRequest({ source: POINT_DOC, target, block, instruction: 'x' })).toBe('inactive');
    expect(aiRequestMock).not.toHaveBeenCalled();
  });

  it('AC-005: 열고 난 뒤 에디터에서 표 칸을 고치면 낡음이라 요청하지 않는다', async () => {
    mountEditor(POINT_DOC.replace('100GB', '200GB'));
    const { target, block } = await pick(POINT_DOC, 'column');
    expect(sendPointRequest({ source: POINT_DOC, target, block, instruction: 'x' })).toBe('stale');
    expect(aiRequestMock).not.toHaveBeenCalled();
  });

  it('AC-005: 표 밖(제목 줄)만 바뀐 문서는 낡음이 아니다', async () => {
    mountEditor(POINT_DOC.replace('# 요금', '# 요금표'));
    const { target, block } = await pick(POINT_DOC, 'column');
    expect(sendPointRequest({ source: POINT_DOC, target, block, instruction: 'x' })).toBe('sent');
  });

  it('활성 에디터가 없으면 요청하지 않는다', async () => {
    const { target, block } = await pick(POINT_DOC, 'column');
    expect(sendPointRequest({ source: POINT_DOC, target, block, instruction: 'x' })).toBe('no-editor');
    expect(aiRequestMock).not.toHaveBeenCalled();
  });

  it('로그인이 안 됐으면 요청 대신 온보딩을 연다', async () => {
    mountEditor(POINT_DOC);
    const opener = vi.fn();
    registerOnboardingOpener(opener);
    setAiLoggedIn(false);
    const { target, block } = await pick(POINT_DOC, 'column');
    expect(sendPointRequest({ source: POINT_DOC, target, block, instruction: 'x' })).toBe('need-login');
    expect(opener).toHaveBeenCalledTimes(1);
    expect(aiRequestMock).not.toHaveBeenCalled();
  });
});

describe('sendPointRequest — 길이(AC-AI17-008)', () => {
  const bigDoc = (cellLen: number): string => `| a | b |\n|---|---|\n| ${'x'.repeat(cellLen)} | 2 |`;

  it('12,000자 초과 표는 요청하지 않는다', async () => {
    const doc = bigDoc(12001);
    mountEditor(doc);
    const { target, block } = await pick(doc, 'column');
    expect(block.text.length).toBeGreaterThan(12000);
    expect(sendPointRequest({ source: doc, target, block, instruction: 'x' })).toBe('too-long');
    expect(aiRequestMock).not.toHaveBeenCalled();
  });

  it('12,000자 이하 6,000자 초과 표는 보내지고 카드가 삽입 전용이다', async () => {
    const doc = bigDoc(6500);
    mountEditor(doc);
    const { target, block } = await pick(doc, 'column');
    expect(sendPointRequest({ source: doc, target, block, instruction: 'x' })).toBe('sent');
    expect(getCardControllers()[0].model.insertOnly).toBe(true);
  });

  it('6,000자 이하 표는 삽입 전용이 아니다', async () => {
    const doc = bigDoc(3000);
    mountEditor(doc);
    const { target, block } = await pick(doc, 'column');
    expect(sendPointRequest({ source: doc, target, block, instruction: 'x' })).toBe('sent');
    expect(getCardControllers()[0].model.insertOnly).toBe(false);
  });
});
