// @MX:SPEC: SPEC-AI-017 REQ-AI17-011 REQ-AI17-012 REQ-AI17-013
// AC-AI17-011/012 — 가리키기(point-table / point-diagram) 카드의 검증·재요청·표 렌더·적용.
// 기존 table/diagram 카드의 검증 동작은 건드리지 않는다(별도 테스트가 그대로 보증).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history, undo } from '@codemirror/commands';

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
  sanitizeTableHtml,
  renderPointTableInto,
  type AiSuggestionCardController,
  type StartCardRequest,
} from '@/components/editor/extensions/ai-suggestion-card';
import { evaluateSelectionGuard } from '@/components/editor/extensions/ai-length-guard';
import { useAiStore } from '@/store/aiStore';

const ORIGINAL_TABLE = '| 항목 | 값 |\n| --- | --- |\n| a | 1 |\n| b | 2 |';
const CHANGED_TABLE = '| 항목 | 값 |\n| --- | --- |\n| a | 10 |\n| b | 2 |';
const SAME_AS_ORIGINAL_INSTRUCTION = '이전 결과가 원본과 같았다. 지시한 변경을 반영하라.';

let view: EditorView;

function mountEditor(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const state = EditorState.create({ doc, extensions: [history(), createAiSuggestionCard()] });
  return new EditorView({ state, parent });
}

function makeRequest(over: {
  presetKind: 'point-table' | 'point-diagram';
  selection: string;
  originalText: string;
  range: { from: number; to: number };
  insertOnly?: boolean;
}): StartCardRequest {
  return {
    args: {
      requestId: 'pt-1',
      feature: 'inline-edit',
      presetKind: over.presetKind,
      models: { claude: 'haiku', codex: null },
      selection: over.selection,
      customInstruction: '값을 10으로',
      pointer: 'table:0',
    },
    insertOnly: over.insertOnly ?? false,
    range: over.range,
    originalText: over.originalText,
  };
}

function startTableCard(doc = ORIGINAL_TABLE): AiSuggestionCardController {
  view = mountEditor(doc);
  return startSuggestionCard(
    makeRequest({
      presetKind: 'point-table',
      selection: doc,
      originalText: doc,
      range: { from: 0, to: doc.length },
    }),
  );
}

function lastRequestId(): string {
  const calls = aiRequestMock.mock.calls;
  return (calls[calls.length - 1][0] as { requestId: string }).requestId;
}

/** 마지막으로 발행된 요청(없으면 최초 카드 요청)을 done 으로 종결한다. */
function completeWith(text: string, requestId?: string): void {
  const id = requestId ?? (aiRequestMock.mock.calls.length ? lastRequestId() : 'pt-1');
  useAiStore.setState({ requestId: id, requestState: 'streaming', streamBuffer: '' });
  useAiStore.setState({ requestId: id, requestState: 'done', streamBuffer: text });
}

function lastAdditionalInstruction(): string | undefined {
  const calls = aiRequestMock.mock.calls;
  return (calls[calls.length - 1][0] as { additionalInstruction?: string }).additionalInstruction;
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

beforeEach(() => {
  aiRequestMock.mockClear();
  aiCancelMock.mockClear();
  clearCardRegistry();
  useAiStore.setState({ requestState: 'idle', streamBuffer: '', requestId: null, errorInfo: null });
});

afterEach(() => {
  view?.destroy();
  setActiveEditorView(null);
  clearCardRegistry();
  document.body.innerHTML = '';
});

// ============================================================
// 그룹 1 — 표 검증 + 원본과 같음
// ============================================================
describe('그룹 1: point-table 검증 (AC-AI17-011 표)', () => {
  it('원본과 다른 유효한 표 → 검토 단계(done), 재요청 없음', () => {
    const c = startTableCard();
    completeWith(CHANGED_TABLE);
    expect(c.getState().phase).toBe('done');
    expect(c.getState().suggestion).toBe(CHANGED_TABLE);
    expect(aiRequestMock).not.toHaveBeenCalled();
  });

  it('표 뒤에 설명 문단이 붙은 출력 → 실패(자동 재요청 1회)', () => {
    const c = startTableCard();
    completeWith(`${CHANGED_TABLE}\n\n위처럼 바꿨습니다.`);
    expect(c.getState().phase).toBe('streaming');
    expect(aiRequestMock).toHaveBeenCalledTimes(1);
    expect(lastAdditionalInstruction()).toMatch(/^이전 오류: /);
  });

  it('열 수가 다른 행이 있는 표 → 실패, 재요청 지시에 열 수 오류 문구', () => {
    const c = startTableCard();
    completeWith('| 항목 | 값 |\n| --- | --- |\n| a | 10 | 더 |\n| b | 2 |');
    expect(c.getState().phase).toBe('streaming');
    expect(lastAdditionalInstruction()).toContain('열 개수가 맞지 않아요');
  });

  it('원본과 줄 끝 공백만 다른 표 → 실패(원본과 같음), 지시는 고정 문구', () => {
    const c = startTableCard();
    completeWith('| 항목 | 값 |  \n| --- | --- |\n| a | 1 |   \n| b | 2 |\n');
    expect(c.getState().phase).toBe('streaming');
    expect(aiRequestMock).toHaveBeenCalledTimes(1);
    expect(lastAdditionalInstruction()).toBe(SAME_AS_ORIGINAL_INSTRUCTION);
  });

  it('첫 실패의 자동 재요청은 ↻ 횟수를 늘리지 않는다', () => {
    const c = startTableCard();
    completeWith(`${CHANGED_TABLE}\n\n설명`);
    expect(c.getState().retryCount).toBe(0);
  });
});

// ============================================================
// 그룹 4 — D17 카드 안 표 렌더(수동 표시만)
// ============================================================
const NETWORK_SELECTORS =
  'img,picture,source,video,audio,iframe,object,embed,link,script,image,use,svg,a,[src],[srcset],[href],[style*="url("]';

describe('그룹 4: 카드 표 렌더 D17 (AC-AI17-012 R2)', () => {
  it('sanitizeTableHtml: img→alt 글자, a→글자, 네트워크 요소 전부 제거, 비활성 문서에서 파싱', () => {
    const html =
      '<table><tbody><tr><td><img src="https://example.com/a.png" alt="로고"></td>' +
      '<td><a href="https://example.com">링크</a></td>' +
      '<td><iframe src="https://x"></iframe><video src="https://x"></video><audio src="https://x"></audio>' +
      '<picture><source srcset="https://x/a.png"><img src="https://x/b.png" alt="그림"></picture>' +
      '<object data="https://x"></object><embed src="https://x"><link rel="stylesheet" href="https://x">' +
      '<script src="https://x"></script>' +
      '<svg><image href="https://x/i.png"/><use href="https://x#a"/></svg>' +
      '<span style="background:url(https://x/bg.png)">글</span></td></tr></tbody></table>';
    const imgBefore = document.querySelectorAll('img').length;
    const out = sanitizeTableHtml(html);
    expect(out.ownerDocument).not.toBe(document); // 활성 문서가 아니다
    expect(document.querySelectorAll('img').length).toBe(imgBefore); // 활성 문서에 img 가 붙지 않았다
    expect(out.querySelector(NETWORK_SELECTORS)).toBeNull();
    expect(out.querySelector('table')).not.toBeNull();
    const text = out.textContent ?? '';
    expect(text).toContain('로고');
    expect(text).toContain('링크');
    expect(text).toContain('글');
  });

  it('sanitizeTableHtml: 수식 칸은 KaTeX 숨김 MathML 이 빠져 글자가 중복되지 않는다(D3)', () => {
    const out = document.createElement('div');
    renderPointTableInto('| 식 |\n| --- |\n| $x^2$ |', out);
    expect(out.querySelector('.katex-mathml, math, annotation')).toBeNull();
    expect((out.textContent ?? '').replace(/\s+/g, '')).toBe('식x2');
  });

  it('카드 검토 단계: 결과 표의 이미지·링크가 글자로만 남고 요소는 없다', () => {
    const c = startTableCard();
    const withMedia =
      '| 항목 | 값 |\n| --- | --- |\n| ![로고](https://example.com/a.png) | [링크](https://example.com) |';
    completeWith(withMedia);
    expect(c.getState().phase).toBe('done');
    const preview = cardEl().querySelector('.mdedit-ai-table-preview');
    expect(preview).not.toBeNull();
    expect(preview!.querySelector('table')).not.toBeNull();
    expect(preview!.querySelector('img')).toBeNull();
    expect(preview!.querySelector('a')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    const cells = Array.from(preview!.querySelectorAll('td')).map((td) => td.textContent);
    expect(cells).toEqual(['로고', '링크']);
    // 결과 텍스트도 함께 보인다
    expect(cardEl().querySelector('.mdedit-ai-suggestion')?.textContent).toBe(withMedia);
  });
});

// ============================================================
// 그룹 2 — 다이어그램 검증 + 원본과 같음 + 목록 폴백 없음
// ============================================================
const ORIGINAL_CODE = 'flowchart LR\n  A[시작] --> B[끝]';
const ORIGINAL_BLOCK = `\`\`\`mermaid\n${ORIGINAL_CODE}\n\`\`\``;
const CHANGED_CODE = 'flowchart LR\n  A[시작] --> C[중간]\n  C --> B[끝]';

function startDiagramCard(): AiSuggestionCardController {
  view = mountEditor(`앞 문단\n\n${ORIGINAL_BLOCK}\n\n뒷 문단`);
  const from = '앞 문단\n\n'.length;
  return startSuggestionCard(
    makeRequest({
      presetKind: 'point-diagram',
      selection: ORIGINAL_CODE,
      originalText: ORIGINAL_BLOCK,
      range: { from, to: from + ORIGINAL_BLOCK.length },
    }),
  );
}

describe('그룹 2: point-diagram 검증 (AC-AI17-011 다이어그램)', () => {
  it('펜스로 감싼 유효하고 다른 코드 → 검토 단계(diagram-valid), 펜스 벗김', async () => {
    const c = startDiagramCard();
    completeWith(`\`\`\`mermaid\n${CHANGED_CODE}\n\`\`\``);
    await vi.waitFor(() => expect(c.getState().phase).toBe('diagram-valid'));
    expect(c.getState().suggestion).toBe(CHANGED_CODE);
    expect(aiRequestMock).not.toHaveBeenCalled();
  });

  it('펜스로 감싼 원본 코드 → 실패(원본과 같음), 지시는 고정 문구', async () => {
    const c = startDiagramCard();
    completeWith(`\`\`\`mermaid\n${ORIGINAL_CODE}  \n\`\`\``);
    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(1));
    expect(c.getState().phase).toBe('streaming');
    expect(lastAdditionalInstruction()).toBe(SAME_AS_ORIGINAL_INSTRUCTION);
  });

  it('문법 오류 코드 → 실패(오류 문구 동봉)', async () => {
    const c = startDiagramCard();
    completeWith('BADSYNTAX');
    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(1));
    expect(c.getState().phase).toBe('streaming');
    expect(lastAdditionalInstruction()).toMatch(/^이전 오류: .+/);
  });

  it('같은 묶음 두 번째 실패에도 「목록으로 정리」 폴백이 나타나지 않는다', async () => {
    const c = startDiagramCard();
    completeWith('BADSYNTAX');
    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(1));
    completeWith('BADSYNTAX');
    await vi.waitFor(() => expect(c.getState().phase).not.toBe('streaming'));
    expect(c.getState().phase).not.toBe('diagram-fallback');
    expect(view.dom.querySelector('.mdedit-ai-list-fallback')).toBeNull();
  });
});

// ============================================================
// 그룹 5 — 적용 / stale / 삽입 전용 / 펜스
// ============================================================
describe('그룹 5: 적용 (AC-AI17-012, REQ-AI17-013)', () => {
  const PRE = '앞 문단\n\n';
  const POST = '\n\n뒷 문단';

  function startEmbeddedTable(): AiSuggestionCardController {
    view = mountEditor(`${PRE}${ORIGINAL_TABLE}${POST}`);
    return startSuggestionCard(
      makeRequest({
        presetKind: 'point-table',
        selection: ORIGINAL_TABLE,
        originalText: ORIGINAL_TABLE,
        range: { from: PRE.length, to: PRE.length + ORIGINAL_TABLE.length },
      }),
    );
  }

  it('버튼은 「바꾸기」(강조)·「아래에 삽입」 순서', () => {
    startEmbeddedTable();
    completeWith(CHANGED_TABLE);
    const modes = Array.from(cardEl().querySelectorAll<HTMLElement>('.mdedit-ai-apply')).map(
      (b) => b.dataset.mode,
    );
    expect(modes).toEqual(['replace', 'insert-below']);
    expect(cardEl().querySelector('.mdedit-ai-apply.is-primary')?.getAttribute('data-mode')).toBe('replace');
  });

  it('바꾸기: 블록 범위만 단일 트랜잭션으로 바뀌고 되돌리기 한 번으로 복원된다', () => {
    startEmbeddedTable();
    const before = view.state.doc.toString();
    completeWith(CHANGED_TABLE);
    const dispatchSpy = vi.spyOn(view, 'dispatch');
    click('.mdedit-ai-apply[data-mode="replace"]');
    const docChangingCalls = dispatchSpy.mock.calls.filter((args) =>
      (args as unknown[]).some((a) => a && typeof a === 'object' && 'changes' in (a as object)),
    );
    expect(docChangingCalls).toHaveLength(1);
    expect(view.state.doc.toString()).toBe(`${PRE}${CHANGED_TABLE}${POST}`);
    undo(view);
    expect(view.state.doc.toString()).toBe(before);
  });

  it('아래에 삽입: 원문은 그대로, 블록 뒤에 결과가 들어간다', () => {
    startEmbeddedTable();
    completeWith(CHANGED_TABLE);
    click('.mdedit-ai-apply[data-mode="insert-below"]');
    expect(view.state.doc.toString()).toBe(`${PRE}${ORIGINAL_TABLE}\n\n${CHANGED_TABLE}${POST}`);
  });

  it('적용 직전 블록 안 칸을 고치면 적용하지 않고 stale 카드, 문서는 그대로', () => {
    const c = startEmbeddedTable();
    completeWith(CHANGED_TABLE);
    const idx = view.state.doc.toString().indexOf('| a | 1 |');
    view.dispatch({ changes: { from: idx + 6, to: idx + 7, insert: '9' } });
    const edited = view.state.doc.toString();
    click('.mdedit-ai-apply[data-mode="replace"]');
    expect(view.state.doc.toString()).toBe(edited);
    expect(c.getState().phase).toBe('stale');
    expect(cardEl().textContent).toContain('원문이 바뀌어 적용할 수 없어요');
  });

  it('취소 뒤 문서는 그대로다', () => {
    startEmbeddedTable();
    const before = view.state.doc.toString();
    completeWith(CHANGED_TABLE);
    click('.mdedit-ai-cancel');
    expect(view.state.doc.toString()).toBe(before);
  });

  it('2,001자 이상 블록 + 완결 unknown → 「바꾸기」 없음 + 안내 문구(SPEC-AI-013)', () => {
    const rows = Array.from({ length: 120 }, (_, i) => `| 항목 ${i} | 값 ${i} 설명 |`).join('\n');
    const big = `| 항목 | 값 |\n| --- | --- |\n${rows}`;
    expect(big.length).toBeGreaterThan(2000);
    const c = startTableCard(big);
    completeWith(big.replace('값 0 설명', '값 0 변경'));
    // 긴 문서는 jsdom 뷰포트 밖이라 위젯 DOM 이 없을 수 있어 렌더 입력으로 확인한다.
    const input = c.getRenderInput();
    expect(input.actions.modes).toEqual(['insert-below']);
    expect(input.completionNotice).toContain('「아래에 삽입」만 할 수 있어요');
  });

  it('6,001~12,000자 블록(insertOnly)은 「아래에 삽입」 전용이고 가드가 그렇게 판정한다', () => {
    expect(evaluateSelectionGuard(7000, 'point-table')).toEqual({ allowed: true, insertOnly: true });
    expect(evaluateSelectionGuard(7000, 'point-diagram')).toEqual({ allowed: true, insertOnly: true });
    expect(evaluateSelectionGuard(12001, 'point-table').allowed).toBe(false);
    view = mountEditor(ORIGINAL_TABLE);
    startSuggestionCard({
      ...makeRequest({
        presetKind: 'point-table',
        selection: ORIGINAL_TABLE,
        originalText: ORIGINAL_TABLE,
        range: { from: 0, to: ORIGINAL_TABLE.length },
        insertOnly: true,
      }),
    });
    completeWith(CHANGED_TABLE);
    const modes = Array.from(cardEl().querySelectorAll<HTMLElement>('.mdedit-ai-apply')).map(
      (b) => b.dataset.mode,
    );
    expect(modes).toEqual(['insert-below']);
  });

  it('다이어그램 바꾸기: 펜스 줄까지 포함한 블록 전체를 ```mermaid 펜스로 감싼 결과로 바꾼다', async () => {
    const c = startDiagramCard();
    const before = view.state.doc.toString();
    completeWith(`\`\`\`mermaid\n${CHANGED_CODE}\n\`\`\``);
    await vi.waitFor(() => expect(c.getState().phase).toBe('diagram-valid'));
    click('.mdedit-ai-apply[data-mode="replace"]');
    expect(view.state.doc.toString()).toBe(`앞 문단\n\n\`\`\`mermaid\n${CHANGED_CODE}\n\`\`\`\n\n뒷 문단`);
    undo(view);
    expect(view.state.doc.toString()).toBe(before);
  });

  it('다이어그램 아래에 삽입도 펜스로 감싼다', async () => {
    const c = startDiagramCard();
    completeWith(CHANGED_CODE);
    await vi.waitFor(() => expect(c.getState().phase).toBe('diagram-valid'));
    click('.mdedit-ai-apply[data-mode="insert-below"]');
    expect(view.state.doc.toString()).toBe(
      `앞 문단\n\n${ORIGINAL_BLOCK}\n\n\`\`\`mermaid\n${CHANGED_CODE}\n\`\`\`\n\n뒷 문단`,
    );
  });
});

// ============================================================
// 그룹 3 — 묶음 예산과 자동 재요청
// ============================================================
const BAD_TABLE = `${CHANGED_TABLE}\n\n설명`;

describe('그룹 3: 사용자 요청 묶음 단위 예산 (D8 c)', () => {
  it('같은 묶음의 두 번째 실패 → 오류 카드(다시 시도·닫기, 적용 버튼 없음), 추가 요청 없음', () => {
    const c = startTableCard();
    completeWith(BAD_TABLE);
    expect(aiRequestMock).toHaveBeenCalledTimes(1);
    completeWith(BAD_TABLE);
    expect(c.getState().phase).toBe('error');
    expect(c.getState().errorMessage).toContain('표 하나만');
    expect(aiRequestMock).toHaveBeenCalledTimes(1);
    expect(cardEl().querySelector('.mdedit-ai-retry')).not.toBeNull();
    expect(cardEl().querySelector('.mdedit-ai-dismiss')).not.toBeNull();
    expect(cardEl().querySelector('.mdedit-ai-apply')).toBeNull();
    expect(cardEl().querySelector('.mdedit-ai-list-fallback')).toBeNull();
  });

  it('오류 카드 「다시 시도」 는 새 묶음 — 검증이 다시 일어나고 자동 재요청 1회를 다시 쓴다', () => {
    const c = startTableCard();
    completeWith(BAD_TABLE);
    completeWith(BAD_TABLE);
    expect(c.getState().phase).toBe('error');
    expect(aiRequestMock).toHaveBeenCalledTimes(1);

    click('.mdedit-ai-retry'); // 다시 시도 → 새 묶음의 사용자 요청
    expect(aiRequestMock).toHaveBeenCalledTimes(2);
    expect(c.getState().phase).toBe('streaming');
    completeWith(BAD_TABLE); // 새 묶음 첫 실패 → 자동 재요청
    expect(aiRequestMock).toHaveBeenCalledTimes(3);
    expect(c.getState().phase).toBe('streaming');
    completeWith(BAD_TABLE); // 새 묶음 둘째 실패 → 오류
    expect(c.getState().phase).toBe('error');
    expect(aiRequestMock).toHaveBeenCalledTimes(3);
  });

  it('검토 카드 ↻ 는 새 묶음 — 이전 묶음에서 자동 재요청을 썼어도 다시 쓸 수 있다', () => {
    const c = startTableCard();
    completeWith(BAD_TABLE); // 묶음1 첫 실패 → 자동 재요청(1)
    completeWith(CHANGED_TABLE); // 성공 → done
    expect(c.getState().phase).toBe('done');
    expect(aiRequestMock).toHaveBeenCalledTimes(1);

    click('.mdedit-ai-redo'); // 빈 입력 ↻ (blind) → 새 묶음
    expect(aiRequestMock).toHaveBeenCalledTimes(2);
    expect(c.getState().retryCount).toBe(1);
    completeWith(BAD_TABLE); // 새 묶음 첫 실패 → 자동 재요청이 나가야 한다
    expect(aiRequestMock).toHaveBeenCalledTimes(3);
    expect(c.getState().phase).toBe('streaming');
    expect(c.getState().retryCount).toBe(1); // 자동 재요청은 ↻ 횟수에 세지 않는다
  });

  it('지시를 넣은 ↻(directed)도 새 묶음이다', () => {
    const c = startTableCard();
    completeWith(BAD_TABLE);
    completeWith(CHANGED_TABLE);
    const input = cardEl().querySelector<HTMLInputElement>('.mdedit-ai-direct-input')!;
    input.value = '더 짧게';
    click('.mdedit-ai-redo');
    expect(aiRequestMock).toHaveBeenCalledTimes(2);
    completeWith(BAD_TABLE);
    expect(aiRequestMock).toHaveBeenCalledTimes(3);
    expect(c.getState().phase).toBe('streaming');
  });

  it('point-diagram 검토 카드에도 ↻ 가 있고 새 묶음을 시작한다', async () => {
    const c = startDiagramCard();
    completeWith('BADSYNTAX'); // 묶음1 자동 재요청
    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(1));
    completeWith(`\`\`\`mermaid\n${CHANGED_CODE}\n\`\`\``);
    await vi.waitFor(() => expect(c.getState().phase).toBe('diagram-valid'));
    expect(cardEl().querySelector('.mdedit-ai-redo')).not.toBeNull();

    click('.mdedit-ai-redo');
    expect(aiRequestMock).toHaveBeenCalledTimes(2);
    completeWith('BADSYNTAX'); // 새 묶음 첫 실패 → 자동 재요청
    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(3));
    expect(c.getState().phase).toBe('streaming');
  });

  it('기존 diagram 카드의 검토 카드에는 ↻ 입력칸이 새로 생기지 않는다(불변)', async () => {
    view = mountEditor(ORIGINAL_BLOCK);
    const c = startSuggestionCard(
      makeRequest({
        presetKind: 'point-diagram',
        selection: ORIGINAL_CODE,
        originalText: ORIGINAL_BLOCK,
        range: { from: 0, to: ORIGINAL_BLOCK.length },
      }),
    );
    c.destroy();
    clearCardRegistry();
    const legacy = startSuggestionCard({
      ...makeRequest({
        presetKind: 'point-diagram',
        selection: ORIGINAL_CODE,
        originalText: ORIGINAL_BLOCK,
        range: { from: 0, to: ORIGINAL_BLOCK.length },
      }),
      args: {
        requestId: 'legacy-1',
        feature: 'inline-edit',
        presetKind: 'diagram',
        models: { claude: 'haiku', codex: null },
        selection: ORIGINAL_BLOCK,
      },
    });
    completeWith(`\`\`\`mermaid\n${CHANGED_CODE}\n\`\`\``, 'legacy-1');
    await vi.waitFor(() => expect(legacy.getState().phase).toBe('diagram-valid'));
    expect(cardEl().querySelector('.mdedit-ai-redo')).toBeNull();
  });

  it('컨트롤러 내부 자동 재요청은 같은 묶음이다 — exempt 값만으로 새 묶음이 되지 않는다', () => {
    const c = startTableCard();
    completeWith(BAD_TABLE); // 내부 자동 재요청(exempt)
    completeWith(BAD_TABLE); // 같은 묶음 → 오류
    expect(c.getState().phase).toBe('error');
  });
});
