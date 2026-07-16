// @MX:SPEC: SPEC-AI-001 REQ-AI-021 REQ-AI-022 REQ-AI-025 REQ-AI-035 REQ-AI-038
// @MX:NOTE: AI 제안 카드 block widget(설계 §4.2 시나리오 A/B/C, image-widget.ts 선례).
// 원문은 흐리게 유지한 채 그 아래 카드를 띄운다 — 문서 텍스트는 오직 사용자의 [바꾸기]/[아래에
// 삽입] 확정으로만 바뀌며(REQ-AI-022 단일 트랜잭션), 적용 직전 원문을 재검증한다(REQ-AI-035).
// 카드 상태·재시도·다이어그램 폴백 판정은 순수 함수로 분리해 단위 테스트한다. 등록(markdown-
// extensions/keymap)은 후속 태스크에서 수행한다 — 이 파일은 확장 팩토리 + 순수 헬퍼만 제공한다.

import { WidgetType, ViewPlugin, Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';
import type { Extension, EditorState } from '@codemirror/state';
import type { AiPresetKind } from './ai-length-guard';
import { aiRequest, aiCancel, ipcErrorMessage } from '@/lib/tauri/ipc';
import type { AiModel, AiRequestArgs } from '@/lib/tauri/ipc';
import { useAiStore } from '@/store/aiStore';
import type { AiErrorKind } from '@/store/aiStore';
import { buildFallbackDecision, validateMermaid, MERMAID_STRICT_CONFIG } from '@/lib/ai/mermaidValidate';
import type { MermaidValidationResult } from '@/lib/ai/mermaidValidate';

// ============================================================
// Card state machine (pure)
// ============================================================

/** 카드 표시 단계(설계 §4.2/§4.3/§9). */
export type CardPhase =
  | 'streaming'
  | 'done'
  | 'empty'
  | 'error'
  | 'retry-exhausted'
  | 'stale'
  | 'diagram-valid'
  | 'diagram-fallback'
  | 'intruded'
  | 'cancelled-by-new';

export interface CardState {
  phase: CardPhase;
  /** done/diagram-valid 일 때 확정 제안 텍스트(또는 mermaid 코드블록). */
  suggestion: string;
  /** ↻ 다시 소진 카운터(0..3, REQ-AI-025). */
  retryCount: number;
  /** error 일 때 분류된 원인 종류(로그인/네트워크 분기, REQ-AI-037). */
  errorKind?: AiErrorKind;
  /** error 일 때 분류된 사용자 문구(raw JSON 금지, REQ-AI-040). */
  errorMessage?: string;
  /** done 일 때 컨텍스트 절단 여부 — "일부만 참고" 노트(P7, REQ-AI-039 참고 고지). */
  truncated?: boolean;
}

/** 카드 상태 전이 이벤트. */
export type CardEvent =
  | { type: 'stream' }
  | { type: 'complete'; finalText: string; original: string; truncated?: boolean }
  | { type: 'fail'; message: string; kind?: AiErrorKind }
  | { type: 'retry' }
  | { type: 'stale' }
  | { type: 'diagram-valid'; code: string }
  | { type: 'diagram-fallback' }
  // T-018: 스트리밍/검토 중 대상 원문 편집(REQ-AI-036).
  | { type: 'intrude' }
  // T-018: in-flight 가 새 요청으로 취소됨(REQ-AI-006). 검토 카드는 대상 아님(§3).
  | { type: 'cancel-by-new' };

/** ↻ 다시 최대 횟수(설계 §4.2 B "연속 3회까지"). */
const MAX_RETRY = 3;

/** 빈 문자열이거나 원문과(공백 무시) 동일하면 true — 빈 교체 방지(REQ-AI-038). */
export function isEmptyOrIdentical(finalText: string, original: string): boolean {
  const trimmed = finalText.trim();
  return trimmed === '' || trimmed === original.trim();
}

/**
 * 카드 상태 머신(순수). 스트리밍→완료(빈/동일이면 empty)→오류/재시도/stale/다이어그램 분기.
 * ↻ 는 3회까지 재요청(streaming 복귀), 소진 후 추가 시도는 retry-exhausted 로 안내한다.
 */
export function reduceCard(state: CardState, event: CardEvent): CardState {
  switch (event.type) {
    case 'stream':
      return { ...state, phase: 'streaming' };
    case 'complete':
      return isEmptyOrIdentical(event.finalText, event.original)
        ? { ...state, phase: 'empty', suggestion: '' }
        : { ...state, phase: 'done', suggestion: event.finalText, truncated: event.truncated };
    case 'fail':
      return { ...state, phase: 'error', errorKind: event.kind, errorMessage: event.message };
    case 'retry':
      return state.retryCount >= MAX_RETRY
        ? { ...state, phase: 'retry-exhausted' }
        : { ...state, phase: 'streaming', retryCount: state.retryCount + 1 };
    case 'stale':
      return { ...state, phase: 'stale' };
    case 'diagram-valid':
      return { ...state, phase: 'diagram-valid', suggestion: event.code };
    case 'diagram-fallback':
      return { ...state, phase: 'diagram-fallback' };
    case 'intrude':
      return { ...state, phase: 'intruded' };
    case 'cancel-by-new':
      // 검토 대기 카드(done/diagram-valid 등)는 새 요청에 사라지지 않는다(§3). in-flight 만 취소 표시.
      return state.phase === 'streaming' ? { ...state, phase: 'cancelled-by-new' } : state;
    default:
      return state;
  }
}

/** ↻ 재요청 지시 문구. 직접 지시가 있으면 그것을, 없으면 "이전 제안과 다른 방식으로". */
export function buildRetryInstruction(directed?: string): string {
  const trimmed = directed?.trim();
  return trimmed ? trimmed : '이전 제안과 다른 방식으로';
}

// ============================================================
// Apply-action derivation (pure)
// ============================================================

export type ApplyMode = 'replace' | 'insert-below';

export interface CardActions {
  /** 렌더할 적용 버튼 종류. */
  modes: ApplyMode[];
  /** 기본 포커스 버튼. */
  primary: ApplyMode;
}

/** 변환 계열 중 항상 "아래에 삽입" 전용인 프리셋(원문 파괴 방지, 설계 §4.2 C). */
const INSERT_ONLY_PRESETS: readonly AiPresetKind[] = ['table', 'diagram'];

/**
 * 프리셋 + 길이 가드(insertOnly)로 카드 적용 버튼을 결정한다(설계 §4.2 C, §4.4).
 * - insertOnly(2K~4K 변환) → 아래에 삽입 전용, 바꾸기 숨김(REQ-AI-026).
 * - 표/다이어그램 → 항상 아래에 삽입(원문 파괴 방지).
 * - 개요로 정리 → 바꾸기 + 아래에 삽입 병행(기본 포커스 바꾸기).
 * - 다듬기/짧게/직접 입력 → 제자리 바꾸기.
 */
export function deriveCardActions(presetKind: AiPresetKind, insertOnly: boolean): CardActions {
  if (insertOnly || INSERT_ONLY_PRESETS.includes(presetKind)) {
    return { modes: ['insert-below'], primary: 'insert-below' };
  }
  if (presetKind === 'outline') {
    return { modes: ['replace', 'insert-below'], primary: 'replace' };
  }
  return { modes: ['replace'], primary: 'replace' };
}

// ============================================================
// Diagram outcome (pure) — REQ-AI-023/024
// ============================================================

export type DiagramOutcome =
  | { kind: 'valid'; code: string }
  | { kind: 'auto-retry'; error: string }
  | { kind: 'offer-list'; error: string };

/**
 * mermaid 사전 검증 결과 + 실패 누적으로 카드 다음 행동을 정한다(설계 §4.2 C).
 * valid → 미니 렌더 카드. invalid 1회 → 오류 동봉 자동 재요청. 2회+ → 목록 폴백 제안.
 */
export function decideDiagramOutcome(
  validation: MermaidValidationResult,
  attemptCount: number,
  code: string,
): DiagramOutcome {
  if (validation.valid) return { kind: 'valid', code };
  const error = validation.error ?? '';
  const decision = buildFallbackDecision(attemptCount);
  return decision.action === 'auto-retry'
    ? { kind: 'auto-retry', error }
    : { kind: 'offer-list', error };
}

// ============================================================
// Card DOM renderer (jsdom-testable)
// ============================================================

export interface CardCallbacks {
  /** [✓ 바꾸기] / [⤵ 아래에 삽입]. */
  onApply: (mode: ApplyMode) => void;
  /** [✕ 취소] — 스트리밍 중 취소 또는 검토 카드 닫기. */
  onCancel: () => void;
  /** ↻ 재요청(직접 지시/블라인드/고급 모델). model 은 이 시도에 쓸 모델. */
  onReRequest: (instruction: string, model: AiModel) => void;
  /** [✓ 목록으로] — 다이어그램 실패 폴백(presetKind 'outline' 재요청). */
  onListFallback: () => void;
  /** [연결 안내 보기] — 로그인 만료 시 설정 온보딩 열기(REQ-AI-037). */
  onOpenOnboarding?: () => void;
}

export interface RenderCardInput {
  state: CardState;
  actions: CardActions;
  presetKind: AiPresetKind;
  /** 스트리밍 중 표시할 실시간 버퍼(aiStore.streamBuffer). */
  streamBuffer: string;
  /** 현재 카드 모델(직접/블라인드 재요청에 승계). 기본 haiku. */
  model?: AiModel;
  /** diagram-valid 카드 미니 렌더러(주입). 없으면 placeholder 만(테스트는 미주입). */
  renderMermaid?: (code: string, container: HTMLElement) => void;
  callbacks: CardCallbacks;
}

const APPLY_LABEL: Record<ApplyMode, string> = {
  replace: '✓ 바꾸기',
  'insert-below': '⤵ 아래에 삽입',
};

function makeButton(className: string, label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  return btn;
}

/** 적용 버튼 행(actions.modes 순서대로). primary 에 focus 클래스 부여. */
function renderApplyButtons(input: RenderCardInput): HTMLElement {
  const row = document.createElement('div');
  row.className = 'mdedit-ai-card-actions';
  for (const mode of input.actions.modes) {
    const btn = makeButton('mdedit-ai-apply', APPLY_LABEL[mode]);
    btn.dataset.mode = mode;
    if (mode === input.actions.primary) btn.classList.add('is-primary');
    btn.addEventListener('click', () => input.callbacks.onApply(mode));
    row.appendChild(btn);
  }
  return row;
}

/** 즉석 지시 입력 + [↻] (directed) + [↻ 다시] (blind) + [✕ 취소]. */
function renderDoneControls(input: RenderCardInput): HTMLElement {
  const model = input.model ?? 'haiku';
  const wrap = document.createElement('div');
  wrap.className = 'mdedit-ai-done-controls';

  const directRow = document.createElement('div');
  directRow.className = 'mdedit-ai-direct-row';
  const input$ = document.createElement('input');
  input$.type = 'text';
  input$.className = 'mdedit-ai-direct-input';
  input$.placeholder = '✏️ 방향 지시... (예: 더 짧게, 존댓말로)';
  const redo = makeButton('mdedit-ai-redo', '↻');
  const fireDirected = (): void =>
    input.callbacks.onReRequest(buildRetryInstruction(input$.value), model);
  redo.addEventListener('click', fireDirected);
  input$.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fireDirected();
  });
  directRow.appendChild(input$);
  directRow.appendChild(redo);

  const btnRow = renderApplyButtons(input);
  const retry = makeButton('mdedit-ai-retry', '↻ 다시');
  retry.addEventListener('click', () =>
    input.callbacks.onReRequest(buildRetryInstruction(), model),
  );
  const cancel = makeButton('mdedit-ai-cancel', '✕ 취소');
  cancel.addEventListener('click', () => input.callbacks.onCancel());
  btnRow.appendChild(retry);
  btnRow.appendChild(cancel);

  wrap.appendChild(directRow);
  wrap.appendChild(btnRow);
  return wrap;
}

/**
 * 제안 카드 DOM 을 렌더한다(순수 — 상태 스냅샷 → 엘리먼트). 스타일은 클래스만 부여하고
 * 실제 CSS 는 T-019 에서 --md-* 토큰으로 정의한다.
 */
export function renderSuggestionCard(input: RenderCardInput): HTMLElement {
  const { state, callbacks } = input;
  const card = document.createElement('div');
  card.className = `mdedit-ai-card mdedit-ai-card-${state.phase}`;

  if (state.phase === 'streaming') {
    const body = document.createElement('div');
    body.className = 'mdedit-ai-stream';
    body.textContent = input.streamBuffer;
    const cancel = makeButton('mdedit-ai-cancel', '✕ 취소');
    cancel.addEventListener('click', () => callbacks.onCancel());
    card.appendChild(body);
    card.appendChild(cancel);
    return card;
  }

  if (state.phase === 'empty') {
    const msg = document.createElement('div');
    msg.className = 'mdedit-ai-notice';
    msg.textContent = '이미 자연스러워서 바꿀 곳이 없어요';
    card.appendChild(msg);
    return card;
  }

  if (state.phase === 'error') {
    const msg = document.createElement('div');
    msg.className = 'mdedit-ai-notice';
    card.appendChild(msg);
    // 원인별 분기(설계 §9). raw JSON/stderr 는 절대 노출하지 않는다 — 분류된 message 만(REQ-AI-040).
    if (state.errorKind === 'login') {
      // 로그인 만료 → 온보딩 재사용, 재시도 루프 금지(REQ-AI-037).
      msg.textContent = state.errorMessage ?? '로그인이 풀렸어요';
      const connect = makeButton('mdedit-ai-connect', '연결 안내 보기');
      connect.addEventListener('click', () => callbacks.onOpenOnboarding?.());
      card.appendChild(connect);
    } else if (state.errorKind === 'network') {
      // 네트워크 차단 → 안내만, 재시도 루프 유도 금지(설계 §9).
      msg.textContent =
        state.errorMessage ?? '네트워크에 연결할 수 없어요. 사내 프록시 환경이라면 관리자에게 문의하세요';
    } else {
      msg.textContent = state.errorMessage ?? '잠시 문제가 있었어요';
      const retry = makeButton('mdedit-ai-retry', '다시 시도');
      retry.addEventListener('click', () =>
        callbacks.onReRequest(buildRetryInstruction(), input.model ?? 'haiku'),
      );
      card.appendChild(retry);
    }
    return card;
  }

  if (state.phase === 'intruded') {
    // REQ-AI-036: 스트리밍/검토 중 원문 편집 → 무통보 취소 금지, 명시 배너 + [무시][다시 요청].
    const msg = document.createElement('div');
    msg.className = 'mdedit-ai-notice';
    msg.textContent = '원문이 편집되어 이 제안을 멈췄어요';
    const ignore = makeButton('mdedit-ai-ignore', '무시');
    ignore.addEventListener('click', () => callbacks.onCancel());
    const rerequest = makeButton('mdedit-ai-rerequest', '다시 요청');
    rerequest.addEventListener('click', () =>
      callbacks.onReRequest(buildRetryInstruction(), input.model ?? 'haiku'),
    );
    card.appendChild(msg);
    card.appendChild(ignore);
    card.appendChild(rerequest);
    return card;
  }

  if (state.phase === 'cancelled-by-new') {
    // REQ-AI-006/P7: in-flight 가 새 요청으로 취소됨 — 조용히 사라지지 않고 이유를 남긴다.
    const msg = document.createElement('div');
    msg.className = 'mdedit-ai-notice';
    msg.textContent = '새 요청으로 취소되었어요';
    card.appendChild(msg);
    return card;
  }

  if (state.phase === 'stale') {
    const msg = document.createElement('div');
    msg.className = 'mdedit-ai-notice';
    msg.textContent = '원문이 바뀌어 적용할 수 없어요';
    card.appendChild(msg);
    return card;
  }

  if (state.phase === 'retry-exhausted') {
    const msg = document.createElement('div');
    msg.className = 'mdedit-ai-notice';
    msg.textContent = '방향을 알려주시면 더 정확해요 (위 입력칸)';
    const advanced = makeButton('mdedit-ai-advanced', '⚡ 고급 모델로 다시 시도');
    // REQ-AI-025: 1회성 sonnet 재요청.
    advanced.addEventListener('click', () =>
      callbacks.onReRequest(buildRetryInstruction(), 'sonnet'),
    );
    card.appendChild(msg);
    card.appendChild(advanced);
    return card;
  }

  if (state.phase === 'diagram-fallback') {
    const msg = document.createElement('div');
    msg.className = 'mdedit-ai-notice';
    msg.textContent = '다이어그램 생성이 어려워요. 목록으로 정리해드릴까요?';
    const list = makeButton('mdedit-ai-list-fallback', '✓ 목록으로');
    list.addEventListener('click', () => callbacks.onListFallback());
    const cancel = makeButton('mdedit-ai-cancel', '✕');
    cancel.addEventListener('click', () => callbacks.onCancel());
    card.appendChild(msg);
    card.appendChild(list);
    card.appendChild(cancel);
    return card;
  }

  // done | diagram-valid
  const body = document.createElement('div');
  body.className = 'mdedit-ai-suggestion';
  body.textContent = state.suggestion;
  card.appendChild(body);

  // 절단 고지(P7) — 문서가 길어 일부만 컨텍스트로 보냈을 때 침묵하지 않는다.
  if (state.truncated) {
    const note = document.createElement('div');
    note.className = 'mdedit-ai-truncated-note';
    note.textContent = '문서가 길어 일부만 참고했어요';
    card.appendChild(note);
  }

  if (state.phase === 'diagram-valid') {
    const preview = document.createElement('div');
    preview.className = 'mdedit-ai-mermaid-preview';
    card.appendChild(preview);
    // 카드 안 미니 렌더(strict SVG). 주입된 렌더러가 있으면 위임하고, 없으면 placeholder 유지
    // — jsdom 단위 테스트는 렌더러를 주입하지 않아 mermaid DOM 의존을 타지 않는다.
    input.renderMermaid?.(state.suggestion, preview);
    card.appendChild(renderApplyButtons(input));
    const cancel = makeButton('mdedit-ai-cancel', '✕ 취소');
    cancel.addEventListener('click', () => callbacks.onCancel());
    card.appendChild(cancel);
    return card;
  }

  card.appendChild(renderDoneControls(input));
  return card;
}

// ============================================================
// Apply safeguards (T-016) — REQ-AI-022/033/035
// ============================================================

/** 문장 종결 부호(한/영). 문장 경계 확장 판정에 사용. */
const SENTENCE_TERMINATORS = '.!?。';
const PARAGRAPH_SEP = '\n\n';

export interface ExpandedRange {
  from: number;
  to: number;
  /** 원래 to 보다 확장되었는지 여부(카드에서 "문장 끝까지 함께 바꿉니다" 표시용). */
  expanded: boolean;
}

/**
 * 선택이 문장 중간에서 끊기면 교체 범위를 문장 경계(종결 부호 다음)까지 확장한다(설계 §4.3).
 * 잘린 어미에 완결 문장이 들어가 "…되었다.다." 충돌이 나는 것을 막는다. 이미 종결 부호나
 * 문단 경계에서 끝나면 확장하지 않는다. 종결 부호가 없으면 문단 끝까지 확장한다.
 */
export function expandToSentenceBoundary(doc: string, from: number, to: number): ExpandedRange {
  const prevChar = doc[to - 1];
  const nextChar = doc[to];
  const endsAtTerminator = prevChar !== undefined && SENTENCE_TERMINATORS.includes(prevChar);
  const endsAtParagraph = nextChar === undefined || nextChar === '\n';
  if (endsAtTerminator || endsAtParagraph) {
    return { from, to, expanded: false };
  }

  const sepAfter = doc.slice(to).indexOf(PARAGRAPH_SEP);
  const paraEnd = sepAfter === -1 ? doc.length : to + sepAfter;
  for (let i = to; i < paraEnd; i++) {
    if (SENTENCE_TERMINATORS.includes(doc[i])) {
      return { from, to: i + 1, expanded: i + 1 > to };
    }
  }
  return { from, to: paraEnd, expanded: paraEnd > to };
}

/** applySuggestion 컨텍스트. range 는 카드 생성 시 미리 보여준(확장 반영) 범위. */
export interface ApplyContext {
  from: number;
  to: number;
  /** 카드 생성 시점 range 의 원문 스냅샷 — 재검증 기준. */
  originalText: string;
  suggestion: string;
  mode: ApplyMode;
}

export type ApplyResult = { applied: true } | { applied: false; reason: 'stale' };

/** 최소 view 형태 — fake view 로 단위 테스트하기 위한 구조적 계약. */
interface ApplyView {
  state: { sliceDoc(from: number, to: number): string; doc: { length: number; toString(): string } };
  dispatch(spec: { changes: { from: number; to?: number; insert: string } }): void;
}

// @MX:ANCHOR: [AUTO] applySuggestion - 제안 적용 dispatch 경로(원문 재검증 + 단일 트랜잭션)
// @MX:REASON: [AUTO] P5 무손상 계약의 핵심 — dispatch 직전 원문 일치 재검증(불일치 시 무변경 stale)
//   과 단일 changes 트랜잭션(Mod+Z 1회 복원)을 반드시 유지해야 한다. applyActiveCard 등에서
//   호출되는 유일 적용 경로(fan_in >= 2). 재검증을 우회하거나 다중 트랜잭션으로 쪼개면 무손상 붕괴.
// @MX:SPEC: SPEC-AI-001 REQ-AI-022 REQ-AI-035
/**
 * 제안을 문서에 적용한다(REQ-AI-022/035). dispatch 직전에 range 의 현재 텍스트가 카드 생성
 * 시점 원문과 일치하는지 재검증한다 — anchor 가 추적하더라도 앞쪽 편집으로 오프셋이 밀렸을 수
 * 있다. 불일치면 dispatch 하지 않고 stale 을 반환(문서 무손상). 일치하면 단일 트랜잭션으로
 * 교체(replace) 또는 문단 아래 삽입(insert-below)하여 Mod+Z 한 번에 복원되게 한다.
 */
export function applySuggestion(view: ApplyView, ctx: ApplyContext): ApplyResult {
  const current = view.state.sliceDoc(ctx.from, ctx.to);
  if (current !== ctx.originalText) {
    return { applied: false, reason: 'stale' };
  }

  if (ctx.mode === 'replace') {
    view.dispatch({ changes: { from: ctx.from, to: ctx.to, insert: ctx.suggestion } });
    return { applied: true };
  }

  // insert-below: 원문은 그대로 두고 선택이 속한 문단 끝 뒤에 빈 줄 + 제안을 삽입한다.
  const docText = view.state.doc.toString();
  const sepAfter = docText.slice(ctx.to).indexOf(PARAGRAPH_SEP);
  const paraEnd = sepAfter === -1 ? view.state.doc.length : ctx.to + sepAfter;
  view.dispatch({ changes: { from: paraEnd, insert: `${PARAGRAPH_SEP}${ctx.suggestion}` } });
  return { applied: true };
}

// ============================================================
// Suggestion card block widget + extension factory
// ============================================================

/** 카드가 배치되는 요청 컨텍스트(원문 재검증에 필요한 범위·원문 캡처). */
export interface SuggestionCardModel {
  requestId: string;
  presetKind: AiPresetKind;
  /** 카드 생성 시점에 미리 보여준(문장 경계 확장 반영) 교체 범위. */
  range: { from: number; to: number };
  /** 범위의 원문 스냅샷 — 적용 직전 재검증 기준(REQ-AI-035). */
  originalText: string;
  insertOnly: boolean;
  model: AiModel;
}

/** createAiSuggestionCard 설정. 활성 카드 목록 조회 훅(기본은 레지스트리). */
export interface AiSuggestionCardConfig {
  getActiveCards?: () => Array<{ model: SuggestionCardModel; render: RenderCardInput }>;
}

/** 활성 카드를 원문 아래 block widget 으로 감싸는 위젯. */
export class SuggestionCardWidget extends WidgetType {
  constructor(
    private readonly input: RenderCardInput,
    private readonly key: string,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return other instanceof SuggestionCardWidget && other.key === this.key;
  }

  toDOM(): HTMLElement {
    return renderSuggestionCard(this.input);
  }

  ignoreEvent(): boolean {
    // 카드 내부 버튼/입력 상호작용은 에디터로 흘려보내지 않는다.
    return true;
  }
}

/** 등록된 모든 카드를 원문 아래 block widget 으로 배치한다(검토 카드 + 신규 스트리밍 카드 공존, §3). */
export function buildCardDecorations(
  state: EditorState,
  config: AiSuggestionCardConfig,
): DecorationSet {
  const cards = config.getActiveCards?.() ?? [];
  if (cards.length === 0) return Decoration.none;

  const docLen = state.doc.length;
  const decos = [];
  for (const active of cards) {
    // 앞쪽 편집으로 범위가 문서 밖으로 밀렸으면 클램프해 RangeSet 이 깨지지 않게 한다.
    const from = Math.min(active.model.range.from, docLen);
    const to = Math.min(active.model.range.to, docLen);
    const key = `${active.model.requestId}:${active.render.state.phase}`;
    const widget = new SuggestionCardWidget(active.render, key);
    decos.push(Decoration.widget({ widget, block: true, side: 1 }).range(to));
    // 원문 흐리게(설계 §4.2 [2]). 뷰 레이어 전용. 빈 범위엔 mark 를 붙이지 않는다.
    if (from < to) {
      decos.push(Decoration.mark({ class: 'mdedit-ai-dim-original' }).range(from, to));
    }
  }
  return Decoration.set(decos, true);
}

/** 카드 레지스트리 변경 → StateField 재계산 트리거(구독 콜백이 이 effect 를 dispatch). */
const recomputeCardsEffect = StateEffect.define<null>();

/**
 * 카드 데코레이션을 담는 StateField. block widget 은 ViewPlugin 으로 공급할 수 없다
 * (CodeMirror 가 "Block decorations may not be specified via plugins" 를 던진다) — 반드시
 * StateField 로 공급한다(ai-ghost-text.ts 선례). docChanged(범위 클램프) 또는 레지스트리
 * 변경 effect 마다 재계산한다.
 */
function makeCardDecorationsField(config: AiSuggestionCardConfig): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create: (state) => buildCardDecorations(state, config),
    update(value, tr) {
      if (tr.docChanged || tr.effects.some((e) => e.is(recomputeCardsEffect))) {
        return buildCardDecorations(tr.state, config);
      }
      return value;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

/**
 * AI 제안 카드 확장(설계 §4.2). 활성 카드를 원문 아래 block widget 으로 렌더한다.
 * 데코레이션은 StateField 로 공급하고(block widget 은 ViewPlugin 불가), 얇은 ViewPlugin 이 적용
 * 대상 뷰 등록 + 레지스트리 구독을 맡는다. 기본 getActiveCards 는 카드 레지스트리를 읽고, 카드 상태
 * 변경 시 recomputeCardsEffect 로 재렌더를 유도한다(검토 카드 공존, §3).
 */
export function createAiSuggestionCard(config: AiSuggestionCardConfig = {}): Extension {
  const resolved: AiSuggestionCardConfig = {
    getActiveCards: config.getActiveCards ?? defaultGetActiveCards,
  };
  const cardField = makeCardDecorationsField(resolved);
  const runtimePlugin = ViewPlugin.fromClass(
    class {
      private unsubscribe: () => void;

      constructor(view: EditorView) {
        // 적용(applySuggestion) 대상 뷰를 등록 — 카드 버튼 클릭이 이 뷰로 dispatch 한다.
        setActiveEditorView(view);
        // 활성 카드/컨트롤러 상태가 바뀌면 effect 트랜잭션으로 StateField 재계산을 유도한다.
        this.unsubscribe = subscribeActiveCard(() => {
          view.dispatch({ effects: recomputeCardsEffect.of(null) });
        });
      }

      destroy(): void {
        this.unsubscribe();
        setActiveEditorView(null);
      }
    },
  );
  return [cardField, runtimePlugin];
}

// ============================================================
// AI card runtime (T-018 integration wiring)
// ============================================================

// @MX:NOTE: 통합 배선 싱글턴 — 편집기 확장은 마운트 시 한 번 생성되므로, 로그인/활성 카드/온보딩
// 오프너 같은 런타임 값은 store·클로저가 아니라 모듈 싱글턴으로 라이브 조회한다(ghost 브리지와 동형).

/** 시작 시 감지된 로그인 상태 캐시(AppLayout 이 갱신). 낙관적 기본 true. */
let loggedInCache = true;
export function setAiLoggedIn(value: boolean): void {
  loggedInCache = value;
}
export function getAiLoggedIn(): boolean {
  return loggedInCache;
}

/** 온보딩(설정 모달) 오프너 — AppLayout 이 등록한다. 카드 로그인 오류가 호출한다(REQ-AI-037). */
let onboardingOpener: (() => void) | null = null;
export function registerOnboardingOpener(fn: (() => void) | null): void {
  onboardingOpener = fn;
}
export function openOnboarding(): void {
  onboardingOpener?.();
}

// @MX:NOTE: 카드 레지스트리(§3, REQ-AI-034) — 검토 대기 카드(done 등)는 새 요청에 사라지지 않고
// 유지되며, in-flight(streaming) 카드만 새 요청이 취소한다. 단일 슬롯이 아니라 requestId 별 Map 이다.
const cardRegistry = new Map<string, AiSuggestionCardController>();
let lastController: AiSuggestionCardController | null = null;
let activeCardListeners: Array<() => void> = [];

function notifyActiveCard(): void {
  activeCardListeners.forEach((l) => l());
}

/** 컨트롤러를 레지스트리에 등록한다(같은 requestId 는 대체). */
export function registerCardController(controller: AiSuggestionCardController): void {
  cardRegistry.set(controller.model.requestId, controller);
  lastController = controller;
  notifyActiveCard();
}

/** 컨트롤러를 레지스트리에서 제거한다(적용·취소 완료 시). */
export function removeCardController(controller: AiSuggestionCardController): void {
  cardRegistry.delete(controller.model.requestId);
  if (lastController === controller) lastController = null;
  notifyActiveCard();
}

/** 등록된 모든 카드 컨트롤러. */
export function getCardControllers(): AiSuggestionCardController[] {
  return [...cardRegistry.values()];
}

/** 가장 최근에 등록된 컨트롤러(하위 호환·테스트 편의). */
export function getActiveCardController(): AiSuggestionCardController | null {
  return lastController;
}

/** 레지스트리·최근 컨트롤러·구독을 비운다(테스트 격리용). */
export function clearCardRegistry(): void {
  cardRegistry.clear();
  lastController = null;
  activeCardUnsub?.();
  activeCardUnsub = null;
  notifyActiveCard();
}

/** 카드 목록 변경 구독(확장이 재렌더에 사용). */
export function subscribeActiveCard(listener: () => void): () => void {
  activeCardListeners.push(listener);
  return () => {
    activeCardListeners = activeCardListeners.filter((l) => l !== listener);
  };
}

/** 레지스트리 → 확장이 소비하는 활성 카드 서술자 목록. */
function defaultGetActiveCards(): Array<{ model: SuggestionCardModel; render: RenderCardInput }> {
  return getCardControllers().map((c) => ({ model: c.model, render: c.getRenderInput() }));
}

export interface CardControllerOptions {
  /** diagram-valid 미니 렌더러 주입(기본 renderMermaidInto). */
  renderMermaid?: (code: string, container: HTMLElement) => void;
}

/**
 * 제안 카드 컨트롤러 — aiStore 스트리밍/완료/오류를 reduceCard 로 흘려보내고, 렌더 입력을 만든다.
 * 상태 변경마다 notifyActiveCard 로 확장 재렌더를 유도한다(활성 컨트롤러일 때).
 */
export class AiSuggestionCardController {
  private state: CardState = { phase: 'streaming', suggestion: '', retryCount: 0 };
  private streamBuffer = '';
  private diagramAttempts = 0;

  constructor(
    public readonly model: SuggestionCardModel,
    private readonly callbacks: CardCallbacks,
    private readonly options: CardControllerOptions = {},
  ) {}

  private commit(event: CardEvent): void {
    this.state = reduceCard(this.state, event);
    if (cardRegistry.has(this.model.requestId)) notifyActiveCard();
  }

  getState(): CardState {
    return this.state;
  }

  onStream(buffer: string): void {
    this.streamBuffer = buffer;
    this.commit({ type: 'stream' });
  }

  onComplete(finalText: string, opts?: { truncated?: boolean }): void {
    // 다이어그램은 삽입 전 strict 사전 검증(REQ-AI-023) 후 valid/자동재요청/목록폴백으로 분기.
    if (this.model.presetKind === 'diagram') {
      void this.handleDiagramComplete(finalText);
      return;
    }
    this.commit({
      type: 'complete',
      finalText,
      original: this.model.originalText,
      truncated: opts?.truncated,
    });
  }

  private async handleDiagramComplete(code: string): Promise<void> {
    this.diagramAttempts += 1;
    const validation = await validateMermaid(code);
    const outcome = decideDiagramOutcome(validation, this.diagramAttempts, code);
    if (outcome.kind === 'valid') {
      this.commit({ type: 'diagram-valid', code: outcome.code });
    } else if (outcome.kind === 'auto-retry') {
      // 오류를 동봉해 1회 자동 재요청(REQ-AI-024). 재요청 발행은 wiring 콜백이 담당.
      this.commit({ type: 'stream' });
      this.callbacks.onReRequest(`이전 오류: ${outcome.error}`, this.model.model);
    } else {
      this.commit({ type: 'diagram-fallback' });
    }
  }

  onError(errorInfo: { kind: AiErrorKind; message: string }): void {
    this.commit({ type: 'fail', kind: errorInfo.kind, message: errorInfo.message });
  }

  /** 스트리밍/검토 중 대상 원문 편집(REQ-AI-036). */
  intrude(): void {
    this.commit({ type: 'intrude' });
  }

  /** in-flight 가 새 요청으로 취소됨(REQ-AI-006, 검토 카드는 무영향). */
  cancelByNew(): void {
    this.commit({ type: 'cancel-by-new' });
  }

  /** 적용 직전 원문 불일치(REQ-AI-035). */
  markStale(): void {
    this.commit({ type: 'stale' });
  }

  getRenderInput(): RenderCardInput {
    return {
      state: this.state,
      actions: deriveCardActions(this.model.presetKind, this.model.insertOnly),
      presetKind: this.model.presetKind,
      streamBuffer: this.streamBuffer,
      model: this.model.model,
      renderMermaid: this.options.renderMermaid,
      callbacks: this.callbacks,
    };
  }
}

/** ```mermaid 펜스에서 원본 다이어그램 코드만 추출. 펜스가 없으면 트림된 원문. */
function stripMermaidFence(code: string): string {
  const m = code.match(/```mermaid\s*\n([\s\S]*?)```/);
  return (m ? m[1] : code).trim();
}

/**
 * 카드 안 미니 다이어그램을 strict 설정으로 렌더한다(설계 §4.2 C). SVG 만 innerHTML 로 넣는다
 * (securityLevel 'strict' 로 라벨이 이스케이프됨). 사전 검증을 통과한 코드이므로 렌더 실패는 무시.
 */
export async function renderMermaidInto(code: string, container: HTMLElement): Promise<void> {
  try {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize(MERMAID_STRICT_CONFIG);
    const id = `mdedit-ai-mmd-${Math.random().toString(36).slice(2)}`;
    const { svg } = await mermaid.render(id, stripMermaidFence(code));
    container.innerHTML = svg;
  } catch {
    // placeholder 유지 — 조용히 실패(사전 검증 통과분이라 예외적).
  }
}

// ============================================================
// Toolbar → card seam (T-018 결선): 요청을 스트리밍 카드로 바인딩
// ============================================================

/** 적용 대상 EditorView — 카드 확장이 등록한다. 카드 버튼이 이 뷰로 dispatch 한다. */
let activeView: EditorView | null = null;
export function setActiveEditorView(view: EditorView | null): void {
  activeView = view;
}

/** startSuggestionCard 입력 — ✨ 툴바가 발행하는 AiSelectionRequest 와 구조적으로 호환. */
export interface StartCardRequest {
  args: AiRequestArgs;
  insertOnly: boolean;
  /** 카드 적용 대상 범위(문장 경계 확장 반영, 설계 §4.3). */
  range: { from: number; to: number };
  /** 범위의 원문 스냅샷 — 적용 직전 재검증 기준(REQ-AI-035). */
  originalText: string;
}

/** 현재 카드 스트림 구독 해제 — 새 카드 시작 시 이전 구독을 정리한다. */
let activeCardUnsub: (() => void) | null = null;

/** 적용(바꾸기/아래삽입) — 등록된 뷰에 재검증 후 단일 트랜잭션. 불일치면 stale 카드로 전환. */
function applyActiveCard(controller: AiSuggestionCardController, mode: ApplyMode): void {
  const view = activeView;
  if (!view) return;
  const result = applySuggestion(view as unknown as ApplyView, {
    from: controller.model.range.from,
    to: controller.model.range.to,
    originalText: controller.model.originalText,
    suggestion: controller.getState().suggestion,
    mode,
  });
  if (result.applied) {
    removeCardController(controller); // 적용 완료 → 이 카드만 닫기(다른 카드 유지)
  } else {
    controller.markStale(); // 원문 불일치 → "원문이 바뀌어 적용할 수 없어요"(문서 무손상)
  }
}

/** 재요청 발행 — customInstruction/model 을 담아 새 in-flight 요청을 스폰한다(↻·직접지시·sonnet). */
function fireReRequest(model: SuggestionCardModel, instruction: string, useModel: AiModel): void {
  const requestId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const store = useAiStore.getState();
  store.startRequest(requestId, model.presetKind === 'diagram' ? 'diagram' : 'inline-edit');
  store.incrementCount();
  void aiRequest({
    requestId,
    feature: model.presetKind === 'diagram' ? 'diagram' : 'inline-edit',
    presetKind: model.presetKind,
    model: useModel,
    customInstruction: instruction,
  }).catch((e) =>
    useAiStore.getState().failRequest({ kind: 'other', message: ipcErrorMessage(e) }),
  );
}

/**
 * 요청을 스트리밍 제안 카드로 바인딩한다(설계 §4.2). 활성 카드로 등록하고 aiStore 를 구독해
 * 스트리밍 버퍼/완료/오류를 컨트롤러로 흘려보낸다. aiRequest 스폰은 호출자(툴바 onRequest)가
 * 수행한다 — 이 함수는 카드 생성·바인딩만 담당해 단위 테스트가 Tauri 를 타지 않는다.
 */
export function startSuggestionCard(request: StartCardRequest): AiSuggestionCardController {
  activeCardUnsub?.();

  // §3/REQ-AI-034: 새 요청은 in-flight(streaming) 카드만 취소 표시하고, 검토(done 등) 카드는 유지한다.
  for (const existing of getCardControllers()) {
    if (existing.getState().phase === 'streaming') existing.cancelByNew();
  }

  const model: SuggestionCardModel = {
    requestId: request.args.requestId,
    presetKind: (request.args.presetKind as AiPresetKind) ?? 'polish',
    range: request.range,
    originalText: request.originalText,
    insertOnly: request.insertOnly,
    model: request.args.model,
  };

  // eslint 없이도 안전한 전방 참조 — 콜백은 controller 할당 이후에만 호출된다.
  let controller: AiSuggestionCardController;
  const callbacks: CardCallbacks = {
    onApply: (mode) => applyActiveCard(controller, mode),
    onCancel: () => {
      void aiCancel(request.args.requestId).catch(() => undefined);
      useAiStore.getState().cancelRequest();
      removeCardController(controller);
    },
    onReRequest: (instruction, useModel) => fireReRequest(model, instruction, useModel),
    onListFallback: () => fireReRequest({ ...model, presetKind: 'outline' }, '', model.model),
    onOpenOnboarding: () => openOnboarding(),
  };
  controller = new AiSuggestionCardController(model, callbacks, { renderMermaid: renderMermaidInto });
  registerCardController(controller);

  // aiStore 스트리밍 → 컨트롤러 반영(useAiRelay 가 ai://chunk 를 버퍼에 누적하면 여기서 미러링).
  activeCardUnsub = useAiStore.subscribe((s) => {
    if (s.requestId !== request.args.requestId) return;
    if (s.requestState === 'streaming') {
      controller.onStream(s.streamBuffer);
    } else if (s.requestState === 'done') {
      controller.onComplete(s.streamBuffer);
      activeCardUnsub?.();
      activeCardUnsub = null;
    } else if (s.requestState === 'error' && s.errorInfo) {
      controller.onError(s.errorInfo);
      activeCardUnsub?.();
      activeCardUnsub = null;
    }
  });

  return controller;
}
