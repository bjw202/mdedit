// @MX:SPEC: SPEC-AI-017 REQ-AI17-001 REQ-AI17-006 REQ-AI17-008 REQ-AI17-009 REQ-AI17-014
// @MX:NOTE: 가리키기 보내기 경로. 보내기 순간에 (a) 활성 조건 (b) 낡음 (c) 길이를 다시 판정하고, 통과하면
// ✨ 툴바와 같은 발행 경로(defaultOnRequest → startSuggestionCard + aiRequest)로 요청한다.
// 요청 인자는 buildSelectionRequest 를 쓰지 않고 직접 만든다 — 그 함수는 contextBefore/After 를 항상 싣지만
// 가리키기는 앞뒤 문맥을 보내지 않는다(D6).
import { EditorView } from '@codemirror/view';
import type { AiRequestArgs } from '@/lib/tauri/ipc';
import { currentAiModels } from '@/store/uiStore';
import { resolveProviderId } from '@/store/aiPolicy';
import {
  getActiveEditorView,
  getAiLoggedIn,
  openOnboarding,
} from '@/components/editor/extensions/ai-suggestion-card';
import {
  defaultOnRequest,
  generateRequestId,
} from '@/components/editor/extensions/ai-selection-toolbar';
import {
  buildPointerInfo,
  evaluatePointLength,
  findBlockInDoc,
  isPointingActiveNow,
  isPointStale,
  type BlockKind,
  type PointBlock,
  type PointClassification,
} from './pointTarget';

/** 카드가 열려 있는 동안 미리보기가 대상을 다시 찾기 위한 기록(REQ-AI17-014). requestId 별. */
export interface PointRef {
  blockKind: BlockKind;
  ordinal: number;
  /** 카드를 만들 때의 블록 텍스트(강조 복원 판정 기준) */
  blockText: string;
  kind: 'column' | 'cell' | 'node';
  col?: number;
  row?: number;
  nodeId?: string;
}

const pointRefs = new Map<string, PointRef>();

export function getPointRef(requestId: string): PointRef | undefined {
  return pointRefs.get(requestId);
}

export type SendOutcome = 'sent' | 'inactive' | 'stale' | 'too-long' | 'no-editor' | 'need-login';

export interface SendPointInput {
  /** 클릭 때의 미리보기 렌더 소스 */
  source: string;
  target: PointClassification;
  block: PointBlock;
  instruction: string;
}

export function sendPointRequest(input: SendPointInput): SendOutcome {
  const { source, target, block } = input;

  // (a) 활성 조건 — 정책 잠금은 반응형이 아니라 보내기 때마다 다시 본다(REQ-AI17-001).
  if (!isPointingActiveNow()) return 'inactive';

  const view = getActiveEditorView();
  if (!view) return 'no-editor';
  const doc = view.state.doc.toString();

  // (b) 낡음 — 현재 에디터 문서 기준(REQ-AI17-006).
  if (isPointStale(source, doc, block)) return 'stale';
  const now = findBlockInDoc(doc, block.kind, block.ordinal);
  if (!now) return 'stale';

  // (c) 길이(D10).
  const verdict = evaluatePointLength(block);
  if (!verdict.allowed) return 'too-long';

  if (!getAiLoggedIn()) {
    openOnboarding();
    return 'need-login';
  }

  // 카드 범위: 보내기 순간의 문서에서 블록 줄 전체(0부터 줄 번호 → CodeMirror 1부터).
  const lastLine = view.state.doc.lines;
  const from = view.state.doc.line(Math.min(now.startLine + 1, lastLine)).from;
  const to = view.state.doc.line(Math.min(now.endLine, lastLine)).to;

  const requestId = generateRequestId();
  const args: AiRequestArgs = {
    requestId,
    feature: 'inline-edit',
    presetKind: block.kind === 'table' ? 'point-table' : 'point-diagram',
    models: currentAiModels(),
    selection: block.text,
    customInstruction: input.instruction.trim(),
    pointer: buildPointerInfo(target, block),
    providerId: resolveProviderId(),
  };

  if (target.kind === 'column' || target.kind === 'cell' || target.kind === 'node') {
    pointRefs.set(requestId, {
      blockKind: block.kind,
      ordinal: block.ordinal,
      blockText: block.text,
      kind: target.kind,
      col: target.col,
      row: target.row,
      nodeId: target.nodeId,
    });
  }

  defaultOnRequest({
    args,
    insertOnly: verdict.insertOnly,
    range: { from, to },
    originalText: view.state.sliceDoc(from, to),
  });

  // 카드가 블록 바로 아래에 뜨므로 그 위치로 에디터를 스크롤한다.
  view.dispatch({ effects: EditorView.scrollIntoView(to, { y: 'nearest', yMargin: 80 }) });
  return 'sent';
}
