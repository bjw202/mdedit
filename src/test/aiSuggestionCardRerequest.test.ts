// @MX:SPEC: SPEC-AI-001 REQ-AI-024 REQ-AI-025 REQ-AI-035 / SPEC-AI-002
// 실기기 결함 체인 재현(TDD RED phase, 수정 전 작성):
//  BUG-1: fireReRequest 가 새 requestId 를 발행해도 구독이 원래 requestId 에 묶여 있어
//         재요청 스트림을 아무도 받지 못하고 카드가 'streaming' 에 영원히 멈춘다.
//  BUG-2: 재요청이 원본 selection/contextBefore/contextAfter 를 담지 않아 Rust 프롬프트가 텅 빈다.
//  BUG-3(a): 모델이 ```mermaid 펜스로 감싸 응답하면 사전 검증이 펜스 채로 통과시켜 실패한다.
// 세 버그가 한 다이어그램 프리셋 여정(스트리밍 → 펜스 무효 → 자동 재시도 → 유효)에서 함께 재현된다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const aiRequestMock = vi.fn().mockResolvedValue(undefined);
const aiCancelMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/tauri/ipc', () => ({
  aiRequest: (...args: unknown[]) => aiRequestMock(...args),
  aiCancel: (...args: unknown[]) => aiCancelMock(...args),
  ipcErrorMessage: (reason: unknown) => (typeof reason === 'string' ? reason : 'error'),
}));

// mermaid.parse 를 스텁해 펜스 유무에 따라 결정적으로 성공/실패시킨다(mermaidValidate.test.ts 선례).
// 'BADSYNTAX' 를 담은 코드는 항상 실패 — 펜스 제거와 무관한 "진짜 무효" 1차 응답을 재현한다.
const parseMock = vi.fn();
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: (...args: unknown[]) => parseMock(...args),
  },
}));

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

function makeDiagramRequest(overrides: Partial<StartCardRequest['args']> = {}): StartCardRequest {
  return {
    args: {
      requestId: 'orig-1',
      feature: 'diagram',
      presetKind: 'diagram',
      model: 'haiku',
      selection: '접수 후 검토를 거쳐 승인한다',
      contextBefore: '앞 문단 컨텍스트',
      contextAfter: '뒤 문단 컨텍스트',
      ...overrides,
    },
    insertOnly: true,
    range: { from: 0, to: 10 },
    originalText: '접수 후 검토를 거쳐 승인한다',
  };
}

describe('startSuggestionCard: 다이어그램 펜스 무효 → 자동 재요청 결함 체인 (실기기 재현)', () => {
  let view: EditorView;

  beforeEach(() => {
    aiRequestMock.mockClear();
    aiCancelMock.mockClear();
    parseMock.mockReset();
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

  it('BUG-1: 자동 재요청의 새 requestId 스트림을 수신해 diagram-valid 까지 도달한다(현재는 streaming 에 멈춤)', async () => {
    // 1차 응답: 펜스 안에 진짜 무효 문법(BADSYNTAX) — 펜스 제거와 무관하게 실패해야 하는 케이스.
    parseMock.mockImplementation((code: string) =>
      code.includes('BADSYNTAX') ? Promise.reject(new Error('Parse error')) : Promise.resolve(true),
    );

    startSuggestionCard(makeDiagramRequest());
    useAiStore.setState({ requestId: 'orig-1', requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({
      requestId: 'orig-1',
      requestState: 'done',
      streamBuffer: '```mermaid\nBADSYNTAX\n```',
    });

    // 다이어그램 검증은 비동기(mermaid.parse) — 자동 재요청이 발행될 때까지 대기.
    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(1));

    const newRequestId = (aiRequestMock.mock.calls[0][0] as { requestId: string }).requestId;
    expect(newRequestId).not.toBe('orig-1');

    // 새 requestId 로 유효한 mermaid 스트림이 도착한다(실기기: 자동 재요청 응답).
    useAiStore.setState({ requestId: newRequestId, requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({
      requestId: newRequestId,
      requestState: 'done',
      streamBuffer: '```mermaid\nflowchart LR\n A-->B\n```',
    });

    // RED(수정 전): 구독이 orig-1 에 묶인 채 해제되어 아무도 새 스트림을 받지 못하고
    // 카드는 'streaming' 에 영원히 머문다. GREEN(수정 후): diagram-valid 로 전이한다.
    await vi.waitFor(() => {
      expect(getActiveCardController()?.getState().phase).toBe('diagram-valid');
    });
  });

  it('BUG-2: 재요청이 원본 selection/contextBefore/contextAfter 를 그대로 담아 보낸다', async () => {
    parseMock.mockImplementation((code: string) =>
      code.includes('BADSYNTAX') ? Promise.reject(new Error('Parse error')) : Promise.resolve(true),
    );

    startSuggestionCard(makeDiagramRequest());
    useAiStore.setState({ requestId: 'orig-1', requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({
      requestId: 'orig-1',
      requestState: 'done',
      streamBuffer: '```mermaid\nBADSYNTAX\n```',
    });

    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(1));

    const sentArgs = aiRequestMock.mock.calls[0][0] as Record<string, unknown>;
    // RED(수정 전): fireReRequest 는 {requestId, feature, presetKind, model, customInstruction} 만 보내
    // selection/contextBefore/contextAfter 가 없다 — 재요청 프롬프트가 컨텍스트 없이 조립된다.
    expect(sentArgs.selection).toBe('접수 후 검토를 거쳐 승인한다');
    expect(sentArgs.contextBefore).toBe('앞 문단 컨텍스트');
    expect(sentArgs.contextAfter).toBe('뒤 문단 컨텍스트');
    expect(sentArgs.feature).toBe('diagram');
    expect(sentArgs.presetKind).toBe('diagram');
  });

  // @MX:SPEC: SPEC-AI-008
  // AC-AI-008-010: 종류(diagramType)를 실은 초기 요청의 자동 재요청(feature='diagram' 유지)이
  // fireReRequest 의 원본 args 스프레드로 diagramType 을 승계한다(부수효과, fireReRequest 무변경).
  it('SPEC-AI-008: 종류(diagramType)가 자동 재요청에 승계된다(fireReRequest 스프레드)', async () => {
    parseMock.mockImplementation((code: string) =>
      code.includes('BADSYNTAX') ? Promise.reject(new Error('Parse error')) : Promise.resolve(true),
    );

    startSuggestionCard(makeDiagramRequest({ diagramType: 'gantt' }));
    useAiStore.setState({ requestId: 'orig-1', requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({
      requestId: 'orig-1',
      requestState: 'done',
      streamBuffer: '```mermaid\nBADSYNTAX\n```',
    });

    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(1));

    const sentArgs = aiRequestMock.mock.calls[0][0] as Record<string, unknown>;
    expect(sentArgs.feature).toBe('diagram');
    expect(sentArgs.diagramType).toBe('gantt');
  });

  it('BUG-3(a): 펜스로 감싼 유효 다이어그램은 펜스를 제거한 뒤 검증되어 즉시 diagram-valid 로 간다', async () => {
    // 펜스가 없는 순수 코드만 valid 로 취급하는 스텁 — 사전 검증에 펜스가 그대로 전달되면
    // 이 테스트는 실패한다(현재 프로덕션 코드는 stripMermaidFence 를 검증 전에 적용하지 않는다).
    parseMock.mockImplementation((code: string) =>
      code.includes('```') ? Promise.reject(new Error('Parse error: unexpected token')) : Promise.resolve(true),
    );

    startSuggestionCard(makeDiagramRequest({ requestId: 'orig-2' }));
    useAiStore.setState({ requestId: 'orig-2', requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({
      requestId: 'orig-2',
      requestState: 'done',
      streamBuffer: '```mermaid\nflowchart LR\n A-->B\n```',
    });

    await vi.waitFor(() => {
      expect(getActiveCardController()?.getState().phase).toBe('diagram-valid');
    });
    // 자동 재요청이 발행되지 않아야 한다(1차 응답이 이미 유효했으므로).
    expect(aiRequestMock).not.toHaveBeenCalled();
  });

  // BUG-5(BUG-3a 후속, 실기기 재현): handleDiagramComplete 가 펜스를 벗겨 state.suggestion 에
  // 저장하고, applyActiveCard → applySuggestion 은 state.suggestion 을 문서에 "있는 그대로"
  // 삽입한다 — 검증/미니 렌더에는 옳지만, 문서에 펜스 없는 맨 코드가 들어가면 마크다운 미리보기가
  // 다이어그램이 아니라 그냥 텍스트로 렌더한다.
  it('BUG-5: diagram-valid 카드를 삽입하면 문서에 ```mermaid 펜스가 복원되어야 한다', async () => {
    parseMock.mockImplementation(() => Promise.resolve(true)); // 사용자의 실제 그래프 — validateMermaid 통과.

    // range/originalText 는 mountEditor('hello world') 의 실제 문서와 일치해야 재검증(REQ-AI-035)을
    // 통과한다 — makeDiagramRequest 의 기본 range/originalText(Korean)는 이 문서와 무관하다.
    startSuggestionCard({
      ...makeDiagramRequest({ requestId: 'orig-3' }),
      range: { from: 0, to: 5 },
      originalText: 'hello',
    });
    useAiStore.setState({ requestId: 'orig-3', requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({
      requestId: 'orig-3',
      requestState: 'done',
      streamBuffer: '```mermaid\nflowchart LR\n  A[접수] --> B[검토] --> C[승인]\n```',
    });

    await vi.waitFor(() => {
      expect(getActiveCardController()?.getState().phase).toBe('diagram-valid');
    });

    const insertBtn = view.dom.querySelector<HTMLButtonElement>(
      '.mdedit-ai-apply[data-mode="insert-below"]',
    )!;
    expect(insertBtn).toBeTruthy();
    insertBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const docText = view.state.doc.toString();
    // RED(수정 전): 삽입된 텍스트에 펜스가 없어 마크다운 미리보기가 일반 텍스트로 렌더한다.
    expect(docText).toContain('```mermaid');
    expect(docText).toContain('flowchart LR');
    const fenceMatches = docText.match(/```/g) ?? [];
    expect(fenceMatches.length).toBeGreaterThanOrEqual(2); // 여는/닫는 펜스 쌍
  });

  it('BUG-5 회귀 가드: 비-다이어그램(예: polish) 적용은 펜스를 추가하지 않는다', async () => {
    const request: StartCardRequest = {
      args: {
        requestId: 'orig-4',
        feature: 'inline-edit',
        presetKind: 'polish',
        model: 'haiku',
        selection: 'hello',
        contextBefore: '',
        contextAfter: '',
      },
      insertOnly: false,
      range: { from: 0, to: 5 },
      originalText: 'hello',
    };
    startSuggestionCard(request);
    useAiStore.setState({ requestId: 'orig-4', requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({ requestId: 'orig-4', requestState: 'done', streamBuffer: '다듬어진 문장' });

    await vi.waitFor(() => {
      expect(getActiveCardController()?.getState().phase).toBe('done');
    });

    const applyBtn = view.dom.querySelector<HTMLButtonElement>(
      '.mdedit-ai-apply[data-mode="replace"]',
    )!;
    applyBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const docText = view.state.doc.toString();
    expect(docText).not.toContain('```');
    expect(docText).toContain('다듬어진 문장');
  });

  // BUG-6 실기기 재현: diagram-fallback 카드의 '✓ 목록으로'를 누르면 재요청은
  // feature:'inline-edit'/presetKind:'outline' 으로 정확히 나가지만, 완료 처리 경로가
  // 여전히 model.presetKind === 'diagram' 으로 분기해 목록 텍스트를 mermaid 검증기에
  // 넣는다 — 검증 실패 → diagramAttempts>=2 → diagram-fallback 재진입(무한 루프).
  it('BUG-6: 목록 폴백 재요청은 mermaid 검증을 타지 않고 일반 제안으로 도착한다(무한루프 아님)', async () => {
    // 두 번의 완료가 전부 진짜 무효 문법 — 1차: 자동 재요청, 2차: diagram-fallback 진입.
    parseMock.mockImplementation((code: string) =>
      code.includes('BADSYNTAX') ? Promise.reject(new Error('Parse error')) : Promise.resolve(true),
    );

    startSuggestionCard({
      ...makeDiagramRequest({ requestId: 'orig-6' }),
      range: { from: 0, to: 5 },
      originalText: 'hello',
    });
    useAiStore.setState({ requestId: 'orig-6', requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({
      requestId: 'orig-6',
      requestState: 'done',
      streamBuffer: '```mermaid\nBADSYNTAX\n```',
    });

    // 1차 무효 → 자동 재요청(diagramAttempts=1).
    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(1));
    const retryId = (aiRequestMock.mock.calls[0][0] as { requestId: string }).requestId;
    useAiStore.setState({ requestId: retryId, requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({
      requestId: retryId,
      requestState: 'done',
      streamBuffer: '```mermaid\nBADSYNTAX\n```',
    });

    // 2차도 무효 → diagram-fallback 진입(diagramAttempts=2).
    await vi.waitFor(() => {
      expect(getActiveCardController()?.getState().phase).toBe('diagram-fallback');
    });

    // '✓ 목록으로' 클릭 — feature/presetKind 오버라이드로 재요청.
    const listBtn = view.dom.querySelector<HTMLButtonElement>('.mdedit-ai-list-fallback')!;
    expect(listBtn).toBeTruthy();
    listBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => expect(aiRequestMock).toHaveBeenCalledTimes(2));
    const listRequestArgs = aiRequestMock.mock.calls[1][0] as Record<string, unknown>;
    expect(listRequestArgs.feature).toBe('inline-edit');
    expect(listRequestArgs.presetKind).toBe('outline');
    const listRequestId = listRequestArgs.requestId as string;

    // 클릭 직후 카드는 다시 streaming(스켈레톤/글로우)으로 보여야 한다.
    await vi.waitFor(() => {
      expect(getActiveCardController()?.getState().phase).toBe('streaming');
    });

    // 목록 폴백 응답이 도착한다 — 순수 텍스트 목록, mermaid 문법이 아니다.
    const listText = '- 접수\n- 검토\n- 승인';
    useAiStore.setState({ requestId: listRequestId, requestState: 'streaming', streamBuffer: '' });
    useAiStore.setState({ requestId: listRequestId, requestState: 'done', streamBuffer: listText });

    // RED(수정 전): onComplete 가 여전히 presetKind==='diagram' 분기를 타 mermaid 검증에 넣고,
    // 검증 실패로 diagram-fallback 에 다시 갇힌다(무한 루프). GREEN: 일반 제안으로 도착한다.
    await vi.waitFor(() => {
      const state = getActiveCardController()?.getState();
      expect(state?.phase).toBe('done');
      expect(state?.suggestion).toBe(listText);
    });

    // 적용 시 mermaid 펜스가 붙지 않아야 한다(목록은 다이어그램이 아니다).
    const applyBtn = view.dom.querySelector<HTMLButtonElement>('.mdedit-ai-apply')!;
    expect(applyBtn).toBeTruthy();
    applyBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const docText = view.state.doc.toString();
    expect(docText).not.toContain('```mermaid');
    expect(docText).toContain(listText);
  });
});
