// @MX:SPEC: SPEC-AI-001 REQ-AI-028 REQ-AI-029 REQ-AI-030 REQ-AI-031 REQ-AI-032
// 섹션 채우기 고스트 텍스트 — 순수 판정(아웃라인/섹션 감지/힌트 자격) + 고스트 상호작용
// (Mod-Enter 확정 단일 트랜잭션·undo 복원, Tab 비확정, Esc/타이핑 소멸, 힌트는 토큰 0).
// TDD RED phase: written before src/components/editor/extensions/ai-ghost-text.ts exists.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { history, undo } from '@codemirror/commands';

// ipc.aiRequest/aiCancel 모킹 — 힌트가 토큰 0(요청 없음)임을 검증하고, 트리거가 section-fill 로 요청함을 확인.
const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...a: unknown[]) => aiRequestMock(...a),
  aiCancel: (...a: unknown[]) => aiCancelMock(...a),
}));

/** aiGhostField(+history)만 넣은 헤드리스 상태 + insertTable.test 스타일 fake view. */
async function makeView(doc: string, cursor: number): Promise<{ view: EditorView; getDoc: () => string }> {
  const { aiGhostField } = await import('@/components/editor/extensions/ai-ghost-text');
  let state = EditorState.create({
    doc,
    selection: EditorSelection.single(cursor),
    extensions: [history(), aiGhostField],
  });
  const view = {
    get state() {
      return state;
    },
    dispatch(spec: Parameters<EditorState['update']>[0]) {
      state = state.update(spec).state;
    },
  } as unknown as EditorView;
  return { view, getDoc: () => state.doc.toString() };
}

beforeEach(async () => {
  aiRequestMock.mockClear();
  aiCancelMock.mockClear();
  const { useAiStore, idleSlice } = await import('@/store/aiStore');
  useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
  const { useUIStore } = await import('@/store/uiStore');
  useUIStore.setState({ aiAdvancedModel: false });
});

describe('buildOutline: heading extraction', () => {
  it('collects all ATX headings, ignoring body text and non-headings', async () => {
    const { buildOutline } = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 제목\n본문\n## 배경\n- 항목\n### 상세\n#없음';
    expect(buildOutline(doc)).toEqual(['# 제목', '## 배경', '### 상세']);
  });
});

describe('getSectionFillContext / isHintEligible: empty-section-under-heading matrix', () => {
  it('eligible: empty line directly under a heading', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view } = await makeView(doc, doc.length); // 빈 둘째 줄
    const ctx = mod.getSectionFillContext(view.state, view.state.selection.main.head);
    expect(ctx).not.toBeNull();
    expect(ctx?.heading).toBe('# 결론');
    expect(mod.isHintEligible(view.state, view.state.selection.main.head)).toBe(true);
  });

  it('not eligible: cursor line has content', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n이미 내용';
    const { view } = await makeView(doc, doc.length);
    expect(mod.isHintEligible(view.state, view.state.selection.main.head)).toBe(false);
  });

  it('not eligible: section already has content above the empty cursor line', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n이미 내용\n';
    const { view } = await makeView(doc, doc.length);
    expect(mod.isHintEligible(view.state, view.state.selection.main.head)).toBe(false);
  });

  it('not eligible: no heading above the empty line', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '그냥 문단\n';
    const { view } = await makeView(doc, doc.length);
    expect(mod.isHintEligible(view.state, view.state.selection.main.head)).toBe(false);
  });

  it('hint eligibility never calls aiRequest (token 0 local judgment)', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view } = await makeView(doc, doc.length);
    mod.isHintEligible(view.state, view.state.selection.main.head);
    mod.getSectionFillContext(view.state, view.state.selection.main.head);
    expect(aiRequestMock).not.toHaveBeenCalled();
  });
});

describe('aiGhostKeymap: bindings (Tab must never confirm)', () => {
  it('binds Mod-Enter and Escape but NOT Tab', async () => {
    const { aiGhostKeymap } = await import('@/components/editor/extensions/ai-ghost-text');
    const keys = aiGhostKeymap.map((b) => b.key);
    expect(keys).toContain('Mod-Enter');
    expect(keys).toContain('Escape');
    expect(keys).not.toContain('Tab');
  });
});

describe('ghost interaction: confirm / dismiss / vanish', () => {
  it('confirm inserts the ghost text as a single transaction, undo restores', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, getDoc } = await makeView(doc, doc.length);
    // 스트림이 채워졌다고 가정: 고스트 앵커 + 텍스트 주입
    view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
    view.dispatch({ effects: mod.setGhostTextEffect.of('초안 문장.') });

    expect(mod.confirmGhostCommand(view)).toBe(true);
    expect(getDoc()).toBe('# 결론\n초안 문장.');
    expect(view.state.field(mod.aiGhostField)).toBeNull();

    undo(view);
    expect(getDoc()).toBe('# 결론\n'); // 트랜잭션 1개 → undo 1회 복원
  });

  it('confirm returns false when there is no ghost', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const emptyDoc = '# 결론\n';
    const { view } = await makeView(emptyDoc, emptyDoc.length);
    expect(mod.confirmGhostCommand(view)).toBe(false);
  });

  it('dismiss removes the ghost without touching the document', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, getDoc } = await makeView(doc, doc.length);
    view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
    view.dispatch({ effects: mod.setGhostTextEffect.of('버릴 초안') });

    expect(mod.dismissGhostCommand(view)).toBe(true);
    expect(view.state.field(mod.aiGhostField)).toBeNull();
    expect(getDoc()).toBe('# 결론\n'); // 문서 무변경
  });

  it('any user edit (typing / Tab indent) makes the ghost vanish, inserting nothing from it', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 결론\n';
    const { view, getDoc } = await makeView(doc, doc.length);
    view.dispatch({ effects: mod.startGhostEffect.of({ from: doc.length }) });
    view.dispatch({ effects: mod.setGhostTextEffect.of('고스트 초안') });

    // 사용자가 문자를 입력(또는 Tab 들여쓰기)한 트랜잭션 → 고스트 소멸
    view.dispatch({ changes: { from: doc.length, insert: '\t' }, userEvent: 'input' });
    expect(view.state.field(mod.aiGhostField)).toBeNull();
    expect(getDoc()).toBe('# 결론\n\t'); // 들여쓰기만, 고스트 텍스트는 삽입되지 않음
  });
});

describe('startSectionFillCommand: trigger builds outline + section-fill request', () => {
  it('calls aiRequest with feature section-fill and the outline, sets the ghost anchor', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 제목\n본문\n## 결론\n';
    const { view } = await makeView(doc, doc.length);
    expect(mod.startSectionFillCommand(view)).toBe(true);
    expect(aiRequestMock).toHaveBeenCalledTimes(1);
    const arg = aiRequestMock.mock.calls[0][0];
    expect(arg.feature).toBe('section-fill');
    expect(arg.model).toBe('haiku'); // aiAdvancedModel=false → haiku
    // 백엔드 계약: outline = 전체 헤딩 아웃라인, contextBefore = 커서 앞 본문 꼬리, presetKind/selection 없음.
    expect(arg.outline).toContain('## 결론');
    expect(arg.outline).toContain('# 제목');
    expect(arg.contextBefore).toBe(doc); // 커서 앞 원문 전체(백엔드가 1.5K 절단)
    expect(arg.presetKind).toBeUndefined();
    expect(arg.selection).toBeUndefined();
    expect(view.state.field(mod.aiGhostField)).not.toBeNull();
  });

  it('returns false and does not request when the cursor is not in an empty section', async () => {
    const mod = await import('@/components/editor/extensions/ai-ghost-text');
    const doc = '# 제목\n본문 내용';
    const { view } = await makeView(doc, doc.length);
    expect(mod.startSectionFillCommand(view)).toBe(false);
    expect(aiRequestMock).not.toHaveBeenCalled();
  });
});
