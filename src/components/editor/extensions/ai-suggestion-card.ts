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
import { resolveProviderId } from '@/store/aiPolicy';
import { buildFallbackDecision, validateMermaid, MERMAID_STRICT_CONFIG } from '@/lib/ai/mermaidValidate';
import type { MermaidValidationResult } from '@/lib/ai/mermaidValidate';
import { validateMarkdownTable } from '@/lib/ai/tableValidate';
import { subscribeAiEvents } from '@/lib/ai/aiEventRouter';
import {
  WAIT_NOTICE_DELAY_MS,
  WAIT_NOTICE_TEXT,
  FRONTEND_BACKSTOP_DELAY_MS,
  BACKSTOP_ERROR_TEXT,
} from '@/lib/ai/waitNotice';

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
  // SPEC-AI-010 REQ-AI10-025: 방향을 준 재요청이 "연속"을 끊는다. 기존 'retry' 케이스에 두 의미를
  // 얹지 않고 전용 이벤트로 분리한다 — 하나의 이벤트가 증가와 리셋을 겸하면 리듀서 단위 테스트가
  // 덮는 상한 전이 계약이 흔들린다.
  | { type: 'retry-reset' }
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
    case 'retry-reset':
      // phase 는 건드리지 않는다 — directed 재요청은 그 직후 enterReRequest() 가 stream 을
      // 커밋하므로, 두 이벤트가 각각 한 가지 일만 한다.
      return { ...state, retryCount: 0 };
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

// @MX:NOTE: [AUTO] 재요청 3분류. 종류는 **호출부가 명시 전달**하며 지시 문자열이나 모델 인자에서
// 추론하지 않는다 — buildRetryInstruction() 은 빈 입력에 기본 문구를 채워 주므로 반환값으로는
// blind/directed 를 구별할 수 없고, 사용자가 우연히 같은 문구를 입력하면 조용히 오분류된다.
//   - blind:    done 카드의 [↻ 다시], 그리고 입력칸이 **빈 상태**의 [↻]/Enter → 카운터 +1
//   - directed: 입력칸에 내용이 있는 상태의 [↻]/Enter → 카운터 0 으로 리셋(연속이 끊김)
//   - exempt:   error 의 [다시 시도], intruded 의 [다시 요청], [⚡ 고급 모델로 다시 시도],
//               표 검증 자동 재요청, 다이어그램 오류 동봉 자동 재시도 → 세지도 리셋하지도 않음
// @MX:SPEC: SPEC-AI-010 REQ-AI10-023 REQ-AI10-024 REQ-AI10-025 REQ-AI10-026
export type ReRequestKind = 'blind' | 'directed' | 'exempt';

// ============================================================
// Apply-action derivation (pure)
// ============================================================

export type ApplyMode = 'replace' | 'insert-below';

export interface CardActions {
  /** 렌더할 적용 버튼 종류. */
  modes: ApplyMode[];
  /** 강조(accent) 표시할 기본 동작. 실제 키보드 포커스나 Enter 단축키는 없다 — 시각 안내 전용. */
  primary: ApplyMode;
}

/** 변환 계열 중 "아래에 삽입"을 기본 동작으로 강조하는 프리셋(원문 보존이 기대값, 설계 §4.2 C). */
const INSERT_FIRST_PRESETS: readonly AiPresetKind[] = ['table', 'diagram'];

/**
 * 프리셋 + 길이 가드(insertOnly)로 카드 적용 버튼을 결정한다(설계 §4.2 C, §4.4).
 * - insertOnly(2K~4K 변환) → 아래에 삽입 전용, 바꾸기 숨김(REQ-AI-026).
 *   긴 선택에서는 AI 가 원문 일부만 보고 답하므로, 바꾸기를 허용하면 보지 못한 나머지가
 *   조용히 사라진다. 이 분기만은 선택권을 주지 않는다.
 * - 그 외 전부 → 바꾸기 + 아래에 삽입 병행. 어느 쪽을 쓸지는 사용자가 고른다.
 * - 기본 포커스만 계열별로 다르다: 표/다이어그램은 아래에 삽입, 나머지는 바꾸기.
 */
export function deriveCardActions(presetKind: AiPresetKind, insertOnly: boolean): CardActions {
  if (insertOnly) {
    return { modes: ['insert-below'], primary: 'insert-below' };
  }
  return {
    modes: ['replace', 'insert-below'],
    primary: INSERT_FIRST_PRESETS.includes(presetKind) ? 'insert-below' : 'replace',
  };
}

// ============================================================
// Diagram outcome (pure) — REQ-AI-023/024
// ============================================================

/**
 * 표 검증 경로에 들어갈 수 있는 최대 onComplete 횟수(1회차 검증 + 재요청 응답 1회차 검증).
 * 이 상한을 넘으면 검증 없이 일반 complete 로 통과시킨다 — 재요청 무한 루프(BUG-6) 차단.
 */
export const TABLE_MAX_VALIDATION_ATTEMPTS = 2;

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
  /**
   * ↻ 재요청(직접 지시/블라인드/고급 모델). model 은 이 시도에 쓸 모델.
   * `kind` 는 **선택적이며 기본값은 `exempt`** 다(SPEC-AI-010 REQ-AI10-023/033). 이는 의도된
   * 호환성 결정이다 — 이 콜백을 2인자로 호출·mock 하는 기존 테스트가 다수이므로 필수 인자로
   * 만들면 그 계약이 즉시 깨진다. 기본값이 `exempt` 라 2인자 호출은 세지도 리셋하지도 않는
   * 현행 동작을 그대로 유지한다. 다만 **프로덕션 호출부는 기본값에 기대지 않고 전부 명시
   * 전달한다** — 생략하면 그 컨트롤이 조용히 카운터를 비껴간다.
   */
  onReRequest: (instruction: string, model: AiModel, kind?: ReRequestKind) => void;
  /** [✓ 목록으로] — 다이어그램 실패 폴백(presetKind 'outline' 재요청). */
  onListFallback: () => void;
  /** [연결 안내 보기] — 로그인 만료 시 설정 온보딩 열기(REQ-AI-037). */
  onOpenOnboarding?: () => void;
  /**
   * [닫기] — 종결 phase(error/empty/cancelled-by-new/stale) 카드를 레지스트리에서 제거한다
   * (SPEC-AI-009 REQ-AI9-036/037). 문서 텍스트를 바꾸거나 재시도·재요청을 겸하지 않는다 —
   * 레지스트리 제거 1가지 부수효과만 갖는다(REQ-AI9-038).
   */
  onDismiss?: () => void;
}

export interface RenderCardInput {
  state: CardState;
  actions: CardActions;
  presetKind: AiPresetKind;
  /** 스트리밍 중 표시할 실시간 버퍼(aiStore.streamBuffer). */
  streamBuffer: string;
  /** SPEC-AI-006 REQ-AI6-007: 발행 후 대기 임계(기본 8초)를 넘겨도 첫 청크가 없으면 true. */
  waitingLong?: boolean;
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

// @MX:SPEC: SPEC-AI-009 REQ-AI9-036 REQ-AI9-037 REQ-AI9-038
// @MX:NOTE: [AUTO] 종결 phase(error/empty/cancelled-by-new/stale) 4개 분기가 동일한 [닫기]
// 컨트롤을 붙이므로 헬퍼로 중복을 제거한다(M8.4.4). 핸들러는 onDismiss 호출 1가지 부수효과만
// 수행한다 — streaming 은 이미 [✕ 취소]가 있으므로 이 헬퍼를 쓰지 않는다(중복 종료 컨트롤 금지).
/** [닫기] 버튼을 카드에 추가한다(종결 phase 전용, 기존 액션 버튼과 병존). */
function appendDismissButton(card: HTMLElement, callbacks: CardCallbacks): void {
  const dismiss = makeButton('mdedit-ai-dismiss', '닫기');
  dismiss.addEventListener('click', () => callbacks.onDismiss?.());
  card.appendChild(dismiss);
}

/** 적용 버튼 행(actions.modes 순서대로). primary 에 .is-primary(accent 채움) 부여 — 포커스는 주지 않는다. */
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
  // 종류 판정은 **자기 입력 요소를 보는 것**으로 끝난다(REQ-AI10-023) — 빈 입력이면 방향 없는
  // 재요청이므로 blind, 내용이 있으면 directed 다. buildRetryInstruction 의 반환값으로는
  // 이 둘을 구별할 수 없다(빈 입력에 기본 문구가 채워지므로).
  const fireDirected = (): void =>
    input.callbacks.onReRequest(
      buildRetryInstruction(input$.value),
      model,
      input$.value.trim() === '' ? 'blind' : 'directed',
    );
  redo.addEventListener('click', fireDirected);
  input$.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fireDirected();
  });
  directRow.appendChild(input$);
  directRow.appendChild(redo);

  const btnRow = renderApplyButtons(input);
  const retry = makeButton('mdedit-ai-retry', '↻ 다시');
  retry.addEventListener('click', () =>
    input.callbacks.onReRequest(buildRetryInstruction(), model, 'blind'),
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
    // REQ-AI2-004/005: streamBuffer 가 빌 때만 3줄 shimmer 스켈레톤을 보여준다. 첫 청크가
    // 도착하면(버퍼가 비지 않으면) 스켈레톤 없이 실제 텍스트만 렌더한다. 카드 글로우 테두리는
    // .mdedit-ai-card-streaming 클래스로 이미 걸려 있어(CSS 전용) 여기서는 손대지 않는다.
    const body = document.createElement('div');
    body.className = 'mdedit-ai-stream';
    body.textContent = input.streamBuffer;
    card.appendChild(body);
    // BUG-7: 첫 청크가 개행/공백뿐이면 눈에 보이는 출력이 없다 — 공백만 있는 버퍼도 빈 것으로
    // 취급해 스켈레톤을 유지한다(그렇지 않으면 "죽은" 카드처럼 보인다).
    if (input.streamBuffer.trim() === '') {
      const skeleton = document.createElement('div');
      skeleton.className = 'mdedit-ai-skeleton';
      for (let i = 0; i < 3; i++) {
        const line = document.createElement('div');
        line.className = 'mdedit-ai-skeleton-line';
        skeleton.appendChild(line);
      }
      card.appendChild(skeleton);
    }
    // SPEC-AI-006 REQ-AI6-007/008/009: 8초 무응답이면 보조 문구만 표시한다(진행률 바 금지).
    if (input.waitingLong && input.streamBuffer.trim() === '') {
      const notice = document.createElement('div');
      notice.className = 'mdedit-ai-wait-notice';
      notice.textContent = WAIT_NOTICE_TEXT;
      card.appendChild(notice);
    }
    const cancel = makeButton('mdedit-ai-cancel', '✕ 취소');
    cancel.addEventListener('click', () => callbacks.onCancel());
    card.appendChild(cancel);
    return card;
  }

  if (state.phase === 'empty') {
    const msg = document.createElement('div');
    msg.className = 'mdedit-ai-notice';
    msg.textContent = '이미 자연스러워서 바꿀 곳이 없어요';
    card.appendChild(msg);
    appendDismissButton(card, callbacks); // REQ-AI9-037: 버튼 없는 종결 phase 닫기 확장
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
      // exempt — 오류 복구 동작이지 품질 반복이 아니다(REQ-AI10-026).
      retry.addEventListener('click', () =>
        callbacks.onReRequest(buildRetryInstruction(), input.model ?? 'haiku', 'exempt'),
      );
      card.appendChild(retry);
    }
    // REQ-AI9-036: error 의 errorKind 3종(login/network/other) 전부에 닫기가 존재한다 —
    // network 처럼 다른 액션 버튼이 없어도 사용자가 카드를 치울 수단이 반드시 있어야 한다.
    appendDismissButton(card, callbacks);
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
    // exempt — 원문 편집으로 멈춘 제안의 복구 동작이다(REQ-AI10-026).
    rerequest.addEventListener('click', () =>
      callbacks.onReRequest(buildRetryInstruction(), input.model ?? 'haiku', 'exempt'),
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
    appendDismissButton(card, callbacks); // REQ-AI9-037
    return card;
  }

  if (state.phase === 'stale') {
    const msg = document.createElement('div');
    msg.className = 'mdedit-ai-notice';
    msg.textContent = '원문이 바뀌어 적용할 수 없어요';
    card.appendChild(msg);
    appendDismissButton(card, callbacks); // REQ-AI9-037
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

  // done | diagram-valid | retry-exhausted
  // @MX:NOTE: [AUTO] retry-exhausted 는 done 렌더에 **합류**한다(복제 아님). 소진은 "제안이
  // 나쁘다"가 아니라 "같은 방식의 재시도는 더 나아지지 않는다"이므로, 이미 손에 든 제안과 그
  // 적용·닫기 수단을 빼앗을 이유가 없다. 복제하면 done 카드의 향후 변경이 소진 카드에
  // 반영되지 않고 두 카드가 서서히 갈라진다.
  // @MX:SPEC: SPEC-AI-010 REQ-AI10-029
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

  if (state.phase === 'retry-exhausted') {
    // 순서가 계약이다 — 안내 문구가 "(위 입력칸)"이라고 말하므로 renderDoneControls 의 방향
    // 지시 입력칸이 문구보다 **앞**에 있어야 문구가 참이 된다(REQ-AI10-029).
    const msg = document.createElement('div');
    msg.className = 'mdedit-ai-notice';
    msg.textContent = '방향을 알려주시면 더 정확해요 (위 입력칸)';
    const advanced = makeButton('mdedit-ai-advanced', '⚡ 고급 모델로 다시 시도');
    // REQ-AI-025: 1회성 sonnet 재요청. exempt 여야 한다 — 이 버튼은 소진 상태에서만 눌리므로
    // 카운트되는 순간 상한을 다시 넘겨 자기 자신을 미발행 게이트에 걸리게 만든다(REQ-AI10-032).
    advanced.addEventListener('click', () =>
      callbacks.onReRequest(buildRetryInstruction(), 'sonnet', 'exempt'),
    );
    card.appendChild(msg);
    card.appendChild(advanced);
    // appendDismissButton 을 부르지 않는다 — renderDoneControls 가 이미 [✕ 취소]를 제공하므로
    // 종료 성격 컨트롤은 정확히 1개여야 한다(REQ-AI10-030, streaming 분기와 같은 근거).
  }

  return card;
}

// ============================================================
// Apply safeguards (T-016) — REQ-AI-022/033/035
// ============================================================

/** 문장 종결 부호(한/영). 문장 경계 확장 판정에 사용. */
const SENTENCE_TERMINATORS = '.!?。';
/**
 * 삽입 구분자. **경계 탐색에는 더 이상 쓰지 않는다**(REQ-AI10-018) — 마크다운은 제목·목록
 * 항목·표 행·인용을 단일 `\n` 으로 구분하므로 `'\n\n'` 유무로 문단 끝을 찾으면 빈 줄이 없는
 * 문서에서 항상 문서 맨 끝으로 튄다. 삽입 **형태**(빈 줄 + 제안)는 그대로이므로 상수는 남긴다.
 */
const PARAGRAPH_SEP = '\n\n';

// @MX:NOTE: [AUTO] "새 마크다운 블록을 시작하는 줄" 판정 정규식 7종. 들여쓰기 0~3칸까지만
// 블록 시작으로 인정한다(4칸 이상은 CommonMark 의 들여쓴 코드). 표 행은 `|` 로 시작하는지만
// 본다 — 목적은 표 파싱이 아니라 삽입 위치 결정이므로 구분 행까지 구별할 필요가 없다.
// @MX:SPEC: SPEC-AI-010 REQ-AI10-017
const BLOCK_START_PATTERNS: readonly RegExp[] = [
  /^ {0,3}#{1,6}(\s|$)/, // ATX 제목
  /^ {0,3}[-*+]\s/, // 순서 없는 목록
  /^ {0,3}\d+[.)]\s/, // 순서 있는 목록
  /^ {0,3}>/, // 인용
  /^ {0,3}\|/, // 표 행
  /^ {0,3}(```|~~~)/, // 코드 펜스
  /^ {0,3}([-*_])(\s*\1){2,}\s*$/, // 구분선(---, ***, ___)
];

/** `-` 만 또는 `=` 만으로 이뤄진 줄 — 구분선과 setext 제목 밑줄이 형태상 겹치는 지점. */
const SETEXT_UNDERLINE = /^ {0,3}(-+|=+)\s*$/;

/** setext 예외를 제외한 순수 형태 판정(재귀를 피하기 위해 분리). */
function matchesBlockStart(line: string): boolean {
  return BLOCK_START_PATTERNS.some((re) => re.test(line));
}

// @MX:NOTE: [AUTO] setext 예외가 없으면 `제목 텍스트\n---` 사이에 제안이 삽입되어 제목이
// 문단으로 무너진다 — `---` 는 구분선과 setext h2 밑줄이 형태상 완전히 같기 때문이다.
// 판정 기준은 "바로 앞 줄이 산문인가" 하나뿐이다(CommonMark 의 setext 조건과 동일).
// @MX:SPEC: SPEC-AI-010 REQ-AI10-017
function isBlockStartLine(line: string, prevLine: string): boolean {
  if (SETEXT_UNDERLINE.test(line)) {
    const prevIsProse = prevLine.trim() !== '' && !matchesBlockStart(prevLine);
    if (prevIsProse) return false; // setext 제목 밑줄 → 현재 블록의 연속
  }
  return matchesBlockStart(line);
}

// @MX:NOTE: [AUTO] findBlockEnd - 마크다운 블록 끝 판정(insert-below 위치 + 문장 경계 확장 상한).
// 소비자가 둘이고 위험도가 다르다 — insert-below 는 비파괴적(잘못된 위치에
//   추가할 뿐)이지만 expandToSentenceBoundary 의 산출은 replace 모드가 **파괴적으로 덮어쓰는**
//   범위가 된다. 두 곳이 각자 판정 규칙을 복제하면 삽입 위치와 덮어쓰기 범위가 서서히 갈라진다
//   — 같은 함수를 공유하는 것은 편의가 아니라 안전 요건이다. 반환값은 반드시 **개행 문자 앞**
//   오프셋이어야 한다(개행을 포함하면 insert-below 가 `\n\n` 을 덧붙일 때 빈 줄이 하나 더 생긴다).
// @MX:SPEC: SPEC-AI-010 REQ-AI10-016 REQ-AI10-017 REQ-AI10-020 REQ-AI10-021
/**
 * `from` 이 속한 마크다운 블록의 끝 오프셋을 찾는다(순수 — 문자열만으로 단위 테스트 가능).
 *
 * 규칙: (1) 스캔은 `from` 이 속한 줄의 **다음 줄**부터 한다(시작 줄 자신은 현재 블록의
 * 일부다). (2) 빈 줄(공백만 있는 줄 포함)이거나 새 블록을 시작하는 줄을 만나면 **직전 줄의
 * 끝**에서 멈춘다. (3) 그 외(산문 연속 줄)는 계속 전진한다 — 문단 내부의 줄바꿈은 블록
 * 경계가 아니므로 여러 줄 문단이 중간에서 쪼개지지 않는다. (4) 문서 끝에 닿으면 `doc.length`.
 *
 * 알려진 한계(v1): 선택이 펜스 코드 블록 **내부**에 있으면 닫는 펜스 줄을 블록 시작으로
 * 판정해 코드 본문과 닫는 펜스 사이에서 멈춘다. 펜스 열림/닫힘 추적은 이 함수를 줄 단위
 * 순수 판정에서 상태 기계로 승격시키므로 v1 범위 밖이다.
 */
export function findBlockEnd(doc: string, from: number): number {
  let lineEnd = doc.indexOf('\n', from);
  if (lineEnd === -1) return doc.length;
  let prevLine = doc.slice(doc.lastIndexOf('\n', from - 1) + 1, lineEnd);

  for (;;) {
    const nextStart = lineEnd + 1;
    const nextEnd = doc.indexOf('\n', nextStart);
    const line = doc.slice(nextStart, nextEnd === -1 ? doc.length : nextEnd);
    if (line.trim() === '' || isBlockStartLine(line, prevLine)) return lineEnd;
    if (nextEnd === -1) return doc.length;
    prevLine = line;
    lineEnd = nextEnd;
  }
}

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

  // SPEC-AI-010 REQ-AI10-019: 상한은 문서 끝이 아니라 **블록 끝**이다. 종결 부호가 하나도
  // 없는 제목·목록·표 영역에서 확장 범위가 문서 절반까지 넓어지면, 그 범위는 replace 모드가
  // 파괴적으로 덮어쓰는 구간이자 카드가 "미리 보여준" 구간이 된다.
  const paraEnd = findBlockEnd(doc, to);
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

  // insert-below: 원문은 그대로 두고 선택이 속한 **마크다운 블록** 끝 뒤에 빈 줄 + 제안을
  // 삽입한다(SPEC-AI-010 REQ-AI10-018). 삽입 내용의 형태와 아래 단일 dispatch 는 무변경이다.
  const paraEnd = findBlockEnd(view.state.doc.toString(), ctx.to);
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

// @MX:NOTE: 버퍼가 "찬" 뒤에는 카드 key 에 버퍼 길이를 실어 청크마다 key 가 바뀌게 한다 — key 가
// 고정이면 eq() 가 계속 true 라 CodeMirror 가 DOM 을 건드리지 않아 카드가 첫 청크에서 얼어붙는다.
// 청크마다 key 가 바뀌어도 위젯이 재생성되지는 않는다: updateDOM() 이 스트리밍 텍스트만 제자리
// 패치하고 true 를 돌려주므로 toDOM() 재호출이 없고, 따라서 글로우 애니메이션도 재시작되지
// 않는다(REQ-AI2-013). 즉 "재생성 방지" 책임은 key 안정성이 아니라 updateDOM 이 진다.
/** 카드 key — requestId:phase(:버퍼상태). 스트리밍이 아니면 버퍼 상태를 생략한다. */
export function buildCardKey(model: SuggestionCardModel, render: RenderCardInput): string {
  const { phase } = render.state;
  if (phase !== 'streaming') return `${model.requestId}:${phase}`;
  // BUG-7: 공백/개행만 있는 버퍼도 "빈" 것으로 취급해 스켈레톤 → 텍스트 전환 판정과
  // 위젯 key(재생성 여부)를 일치시킨다 — 그렇지 않으면 렌더는 스켈레톤을 유지하는데
  // key 는 'filled' 로 바뀌어 눈에 보이는 출력 없이 위젯이 재생성될 수 있다.
  // 길이는 "찬" 뒤에만 붙인다: 스켈레톤 구간에서 공백만 쌓이는 동안은 key 가 고정이어야
  // 보이는 변화 없이 카드가 재생성되는 일이 없다.
  const bufferState =
    render.streamBuffer.trim() === '' ? 'skeleton' : `filled:${render.streamBuffer.length}`;
  // SPEC-AI-006 REQ-AI6-007: waitingLong 전환도 key 에 반영해야 widget 이 재생성되어 대기
  // 안내 문구가 실제로 DOM 에 반영된다(그렇지 않으면 eq() 가 true 라 toDOM 이 재호출되지 않는다).
  const waitingSuffix = render.waitingLong ? ':waiting' : '';
  return `${model.requestId}:${phase}:${bufferState}${waitingSuffix}`;
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

  // BUG-8: 문서 아래쪽에서 카드가 뷰포트 밖에 뜨면 사용자가 수동으로 스크롤해야 한다. 버퍼만
  // 채워지는 스트리밍 청크는 key 가 바뀌어 eq() 가 false 지만, updateDOM() 이 텍스트를 제자리
  // 패치하고 true 를 돌려주므로 toDOM() 은 재호출되지 않는다 — "청크마다 스크롤하지 않는다"는
  // anti-scroll-jacking 규칙은 그 경로가 지킨다. 여기(마운트/phase 전환)에만 scrollIntoView 를
  // 두면 된다. 카드는 range.to 아래에 놓이므로 range.to 로 스크롤하는 대신 카드 DOM 자체를
  // 스크롤해야 카드 전체(스켈레톤/버튼)가 보인다. 아직 문서에 붙지 않은 상태로 반환되므로,
  // CodeMirror 가 실제로 삽입한 다음 프레임에 수행한다.
  toDOM(): HTMLElement {
    const dom = renderSuggestionCard(this.input);
    // updateDOM 이 "이 DOM 이 어느 카드/단계의 것인지" 판정할 수 있도록 key 를 새겨 둔다.
    dom.dataset.aiCardKey = this.key;
    requestAnimationFrame(() => {
      dom.scrollIntoView({ block: 'nearest' });
    });
    return dom;
  }

  /**
   * 스트리밍 텍스트가 자란 경우에만 기존 DOM 을 제자리 패치한다(카드 얼어붙음 수정의 핵심).
   * true 를 돌려주면 CodeMirror 는 위젯을 재생성하지 않으므로 글로우 애니메이션(REQ-AI2-013)
   * 과 스크롤(BUG-8)이 청크마다 재시작되지 않는다. 그 외 모든 변화(스켈레톤→텍스트 전환, 8초
   * 대기 안내 등장/소멸, phase 전환, 다른 카드로의 교체)는 false 를 돌려 기존과 똑같이 재렌더한다.
   *
   * 판정은 넘겨받은 dom 을 구조적으로 뜯어서 한다 — updateDOM 은 이전 위젯을 받지 않으므로
   * "직전 상태가 무엇이었는지" 추측해서는 안 된다.
   */
  updateDOM(dom: HTMLElement): boolean {
    if (this.input.state.phase !== 'streaming') return false;
    if (this.input.streamBuffer.trim() === '') return false;
    // 스켈레톤/대기 안내가 남아 있는 DOM 은 이번 갱신에서 그것들을 걷어내야 하므로 재렌더에 맡긴다.
    if (dom.querySelector('.mdedit-ai-skeleton') !== null) return false;
    if (dom.querySelector('.mdedit-ai-wait-notice') !== null) return false;
    if (!dom.classList.contains('mdedit-ai-card-streaming')) return false;
    // 같은 위치에서 다른 카드(다른 requestId)의 DOM 을 물려받았다면 패치하면 안 된다 — 텍스트는
    // 맞아도 [✕ 취소] 버튼이 이전 카드의 콜백을 붙든 채 남아 엉뚱한 요청을 취소하게 된다.
    const [prevRequestId, prevPhase] = (dom.dataset.aiCardKey ?? '').split(':');
    const [requestId, phase] = this.key.split(':');
    if (prevRequestId !== requestId || prevPhase !== phase) return false;
    const body = dom.querySelector('.mdedit-ai-stream');
    if (body === null) return false;
    body.textContent = this.input.streamBuffer;
    dom.dataset.aiCardKey = this.key;
    return true;
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
    const key = buildCardKey(active.model, active.render);
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

// @MX:SPEC: SPEC-AI-010 REQ-AI10-014
/**
 * 레지스트리·최근 컨트롤러를 비운다(파일 전환/AI OFF 정리, 테스트 격리).
 *
 * Map 만 비우면 각 컨트롤러의 대기 안내·백스톱 타이머와 이벤트 구독이 살아남는다 —
 * 이미 사라진 카드에 대해 타이머가 발화해 불필요한 재렌더를 유발하고 테스트 간 격리를 깬다.
 * 그래서 비우기 **전에** 모든 컨트롤러의 `destroy()` 를 순회 호출한다. 3동작(취소/고스트
 * 정리/레지스트리 비움)의 조건·순서·문서 무손상 계약은 그대로다(SPEC-AI-009 REQ-AI9-033~035).
 */
export function clearCardRegistry(): void {
  for (const controller of cardRegistry.values()) {
    controller.destroy();
  }
  cardRegistry.clear();
  lastController = null;
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
  private tableAttempts = 0;
  // BUG-6: '✓ 목록으로'가 눌리면 이 카드는 더 이상 mermaid 검증 경로를 타면 안 된다 — 재요청
  // 응답이 목록(일반 텍스트)이지 다이어그램이 아니기 때문이다. model.presetKind 는 'diagram'
  // 으로 고정해 두고(적용 버튼 배치 등 기존 계약 유지), 완료 처리/펜스 삽입만 이 플래그로 우회한다.
  private listFallbackActive = false;
  // SPEC-AI-006 REQ-AI6-007/008: 발행 후 대기 임계(기본 8초) 타이머 — 첫 청크/완료/오류/취소/
  // 언마운트 시 즉시 clear한다(누수 없음).
  private waitNoticeTimer: ReturnType<typeof setTimeout> | null = null;
  private waitingLong = false;
  // SPEC-AI-010 REQ-AI10-009/010: 프론트 백스톱 타이머 — 백엔드 하드 워치독(60초)의 종결
  // 이벤트마저 이 카드에 닿지 않았을 때 스스로 error 로 종결시킨다. waitNoticeTimer 와 같은
  // 규율(무장/재무장/해제/소멸)을 따르되 임계와 만료 동작만 다르다.
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public readonly model: SuggestionCardModel,
    private readonly callbacks: CardCallbacks,
    private readonly options: CardControllerOptions = {},
  ) {
    this.armWaitNoticeTimer();
    this.armWatchdogTimer();
  }

  private armWaitNoticeTimer(): void {
    this.clearWaitNoticeTimer();
    this.waitNoticeTimer = setTimeout(() => {
      this.waitNoticeTimer = null;
      this.waitingLong = true;
      if (cardRegistry.has(this.model.requestId)) notifyActiveCard();
    }, WAIT_NOTICE_DELAY_MS);
  }

  /** 재요청(↻/직접지시/sonnet/목록폴백)이 새 스트림을 시작할 때 대기 타이머를 재무장한다. */
  rearmWaitNotice(): void {
    this.waitingLong = false;
    this.armWaitNoticeTimer();
  }

  private clearWaitNoticeTimer(): void {
    if (this.waitNoticeTimer !== null) {
      clearTimeout(this.waitNoticeTimer);
      this.waitNoticeTimer = null;
    }
  }

  // @MX:WARN: [AUTO] 백스톱 만료 콜백은 "자기 카드 하나만" 건드려야 한다.
  // @MX:REASON: [AUTO] 카드 하나의 정체가 문서 텍스트를 바꾸거나 다른 카드의 in-flight 를
  //   취소하면, 멀쩡히 동작 중인 다른 카드까지 함께 무너진다(REQ-AI10-013). 여기서
  //   aiCancel·dispatch·다른 컨트롤러 접근을 추가해서는 안 된다.
  // @MX:SPEC: SPEC-AI-010 REQ-AI10-009 REQ-AI10-013
  private armWatchdogTimer(): void {
    this.clearWatchdogTimer();
    this.watchdogTimer = setTimeout(() => {
      this.watchdogTimer = null;
      // 대기 안내 타이머는 이미 스스로 해제되었을 수 있으나, 종결이므로 확실히 닫는다.
      this.clearWaitNoticeTimer();
      this.waitingLong = false;
      // 신규 errorKind 를 만들지 않고 기존 'other' 분기에 얹는다 → 재시도 + 닫기가 자동으로
      // 따라온다(REQ-AI10-011). 문서·다른 카드는 건드리지 않는다.
      this.commit({ type: 'fail', kind: 'other', message: BACKSTOP_ERROR_TEXT });
    }, FRONTEND_BACKSTOP_DELAY_MS);
  }

  private clearWatchdogTimer(): void {
    if (this.watchdogTimer !== null) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  /** 종결·소멸 사건에서 두 타이머를 함께 닫는다 — 해제 지점이 한 곳이라 누락이 생기지 않는다. */
  private clearTimers(): void {
    this.clearWaitNoticeTimer();
    this.clearWatchdogTimer();
    this.waitingLong = false;
  }

  /** 카드가 레지스트리에서 제거될 때(적용/취소/닫기/정리) 호출 — 타이머 누수를 막는다. */
  destroy(): void {
    this.clearTimers();
    this.unbind?.();
    this.unbind = null;
  }

  /**
   * 이벤트 구독 해제 함수(스토어 구독 + requestId 라우터 구독). 컨트롤러가 스스로 보유해
   * `destroy()` 에서 해제한다 — 모듈 전역 단일 슬롯이 아니므로 새 카드가 생겨도 기존 카드의
   * 구독이 끊기지 않는다(SPEC-AI-010 REQ-AI10-012).
   */
  private unbind: (() => void) | null = null;
  setUnbind(fn: () => void): void {
    this.unbind?.();
    this.unbind = fn;
  }

  private commit(event: CardEvent): void {
    this.state = reduceCard(this.state, event);
    if (cardRegistry.has(this.model.requestId)) notifyActiveCard();
  }

  getState(): CardState {
    return this.state;
  }

  /**
   * SPEC-AI-010 REQ-AI10-012: 라우터 경로의 **원시 델타**를 잇는다. 스토어 경로(`onStream`)는
   * 이미 누적된 버퍼를 통째로 주지만 라우터는 조각만 주므로, 누적 책임이 컨트롤러에 있다.
   * 두 경로가 섞여도(슬롯을 뺏기기 전 스토어 누적분 + 그 뒤 라우터 델타) 이어 붙기만 하면 된다.
   */
  appendStreamDelta(delta: string): void {
    this.onStream(this.streamBuffer + delta);
  }

  onStream(buffer: string): void {
    this.streamBuffer = buffer;
    if (buffer.trim() !== '') {
      this.clearWaitNoticeTimer();
      this.waitingLong = false;
    }
    this.commit({ type: 'stream' });
  }

  onComplete(finalText: string, opts?: { truncated?: boolean }): void {
    this.clearTimers();
    // 다이어그램은 삽입 전 strict 사전 검증(REQ-AI-023) 후 valid/자동재요청/목록폴백으로 분기.
    // BUG-6: 목록 폴백이 활성화된 뒤에는(재요청 응답이 목록 텍스트) 더 이상 이 분기를 타지
    // 않는다 — mermaid 검증에 넣으면 항상 실패해 diagram-fallback 으로 되돌아가 무한 루프가 된다.
    if (this.model.presetKind === 'diagram' && !this.listFallbackActive) {
      void this.handleDiagramComplete(finalText);
      return;
    }
    // 표도 삽입 전 구조 검증 후 자동 1회 재요청으로 분기(다이어그램과 대칭, 단 목록 폴백은 없다).
    if (this.model.presetKind === 'table' && this.tableAttempts < TABLE_MAX_VALIDATION_ATTEMPTS) {
      if (this.handleTableComplete(finalText)) return;
    }
    this.commit({
      type: 'complete',
      finalText,
      original: this.model.originalText,
      truncated: opts?.truncated,
    });
  }

  // @MX:ANCHOR: [AUTO] handleTableComplete — 표 검증 경로의 상한(BUG-6 재발 방지)
  // @MX:REASON: [AUTO] 다이어그램에서 실기기 무한 루프(BUG-6)가 났던 이유는 재요청 응답이
  //   다시 같은 검증 분기로 되돌아올 길이 있었기 때문이다. 표 경로는 두 겹으로 잠근다:
  //   (1) onComplete 의 tableAttempts < TABLE_MAX_VALIDATION_ATTEMPTS 게이트,
  //   (2) 아래 attempts <= 1 조건. 상한에 닿으면 false 를 돌려 일반 complete 로 떨어지며,
  //   tableAttempts 는 감소하지 않으므로 검증으로 되돌아갈 경로가 존재하지 않는다.
  /**
   * 표 검증 1회 수행. 재요청을 발행했으면 true(호출부는 즉시 return), 아니면 false 를 돌려
   * 일반 complete 경로로 넘긴다 — 재시도 상한을 넘긴 무효 표는 사용자가 직접 보고 판단한다.
   */
  private handleTableComplete(text: string): boolean {
    this.tableAttempts += 1;
    const validation = validateMarkdownTable(text);
    if (validation.valid) return false;
    if (this.tableAttempts > 1) return false;
    // 1회차 실패만 오류를 동봉해 자동 재요청. 발행은 wiring 콜백이 담당(다이어그램과 동일 채널).
    this.commit({ type: 'stream' });
    // exempt — 사용자가 요청한 품질 반복이 아니라 컨트롤러가 스스로 거는 검증 재요청이다.
    this.callbacks.onReRequest(`이전 오류: ${validation.error}`, this.model.model, 'exempt');
    return true;
  }

  private async handleDiagramComplete(code: string): Promise<void> {
    this.diagramAttempts += 1;
    // BUG-3(a): 모델이 ```mermaid 펜스로 감싸 응답하면 펜스 채로는 항상 파싱에 실패한다 —
    // 사전 검증·미리보기·삽입 모두 펜스를 제거한 코드를 기준으로 삼는다(REQ-AI-023).
    const stripped = stripMermaidFence(code);
    const validation = await validateMermaid(stripped);
    const outcome = decideDiagramOutcome(validation, this.diagramAttempts, stripped);
    if (outcome.kind === 'valid') {
      this.commit({ type: 'diagram-valid', code: outcome.code });
    } else if (outcome.kind === 'auto-retry') {
      // 오류를 동봉해 1회 자동 재요청(REQ-AI-024). 재요청 발행은 wiring 콜백이 담당.
      this.commit({ type: 'stream' });
      // exempt — 표 검증과 같은 이유로 카운터에 닿지 않는다(REQ-AI10-026).
      this.callbacks.onReRequest(`이전 오류: ${outcome.error}`, this.model.model, 'exempt');
    } else {
      this.commit({ type: 'diagram-fallback' });
    }
  }

  onError(errorInfo: { kind: AiErrorKind; message: string }): void {
    this.clearTimers();
    this.commit({ type: 'fail', kind: errorInfo.kind, message: errorInfo.message });
  }

  /**
   * 스트리밍/검토 중 대상 원문 편집(REQ-AI-036).
   * SPEC-AI-010 REQ-AI10-010: 이 시점에 in-flight 는 사실상 끝났다 — 타이머를 남겨 두면
   * 백스톱이 뒤늦게 발화해 "원문이 편집되어 멈췄어요" 배너를 의미 없는 오류로 덮어쓴다.
   */
  intrude(): void {
    this.clearTimers();
    this.commit({ type: 'intrude' });
  }

  /** in-flight 가 새 요청으로 취소됨(REQ-AI-006, 검토 카드는 무영향). */
  cancelByNew(): void {
    this.clearTimers();
    this.commit({ type: 'cancel-by-new' });
  }

  /** 적용 직전 원문 불일치(REQ-AI-035). intrude 와 같은 이유로 타이머를 함께 닫는다. */
  markStale(): void {
    this.clearTimers();
    this.commit({ type: 'stale' });
  }

  // @MX:ANCHOR: [AUTO] enterListFallback - 다이어그램 목록 폴백 모드 전환(BUG-6 재발 방지)
  // @MX:REASON: [AUTO] 이 호출 없이 목록 폴백 재요청을 발행하면 onComplete 가 여전히
  //   presetKind==='diagram' 분기를 타 목록 텍스트를 mermaid 검증에 넣고, 항상 실패해
  //   diagram-fallback 으로 되돌아가는 무한 루프가 재현된다(실기기 확인). wiring(onListFallback)
  //   에서 재요청 발행과 함께 반드시 호출해야 한다.
  /**
   * '✓ 목록으로' 클릭 시 호출 — 이 카드를 목록 폴백 모드로 전환한다(BUG-6). 이후 onComplete 는
   * mermaid 검증을 건너뛰고 일반 제안으로 처리하며, applyActiveCard 는 펜스를 씌우지 않는다.
   * 카드를 즉시 streaming(스켈레톤/글로우)으로 되돌려 재요청이 진행 중임을 보여준다.
   */
  enterListFallback(): void {
    this.listFallbackActive = true;
    // SPEC-AI-010 REQ-AI10-002: 버퍼를 비우지 않으면 직전 다이어그램 응답이 streaming 렌더에
    // 그대로 남아 스켈레톤이 뜨지 않는다(사용자 개시 경로와 동일한 문제). 목록 폴백의
    // listFallbackActive 플래그·재시도 카운터 궤적은 그대로다.
    this.enterReRequest();
  }

  /** applyActiveCard 가 mermaid 펜스 삽입 여부를 판단할 때 사용(BUG-5/BUG-6). */
  isListFallbackActive(): boolean {
    return this.listFallbackActive;
  }

  // @MX:NOTE: [AUTO] enterReRequest - 사용자 개시 재요청 5종의 공통 진입 상태 전환.
  // 이 호출이 없으면 카드는 첫 ai://chunk 가 도착할 때까지 done/error/
  //   intruded phase 를 유지한다 — fireReRequest 가 store.startRequest 를 실행하는 시점의
  //   zustand 구독은 boundRequestId 가 아직 "직전" id 라서 단락되고, 그 뒤로는 스토어가 다시
  //   바뀔 계기가 없기 때문이다(실기기: ↻ 를 눌러도 화면이 그대로인 "얼어붙은 카드").
  //   버퍼 리셋을 함께 하지 않으면 streaming 렌더가 직전 응답 본문을 그대로 보여주어 더
  //   나빠진다(renderSuggestionCard 의 빈 버퍼 조건이 스켈레톤을 켜는 유일한 스위치다).
  // @MX:SPEC: SPEC-AI-010 REQ-AI10-001 REQ-AI10-002 REQ-AI10-003 REQ-AI10-004 REQ-AI10-010
  /**
   * 재요청 발행 직전에 호출 — 카드를 즉시 streaming(글로우 + 3줄 스켈레톤)으로 되돌린다.
   * 목록 폴백(`enterListFallback`)도 이 메서드를 재사용해 두 경로가 갈라지지 않게 한다.
   * 하는 일은 셋뿐이다: (1) 스트림 버퍼 리셋, (2) 대기 안내·백스톱 타이머 재무장,
   * (3) `stream` 전이 커밋(마지막에 두어 알림이 최종 상태를 본다). 새 phase·새 위젯·가짜
   * 진행 지표를 도입하지 않는다 — 기존 streaming 렌더 분기를 그대로 재사용한다(REQ-AI10-005).
   */
  enterReRequest(): void {
    this.streamBuffer = '';
    this.rearmWaitNotice();
    this.armWatchdogTimer();
    this.commit({ type: 'stream' });
  }

  // @MX:NOTE: [AUTO] applyReRequestKind - 재요청 종류를 카운터 전이로 옮기는 유일한 지점.
  // 배선(onReRequest)은 commit 이 private 이라 리듀서에 직접 닿을 수 없으므로 이 메서드를 쓴다.
  // 소진 여부는 여기서 판정하지 않는다 — reduceCard 의 기존 상한 판정이 만든 phase 를 배선이
  // getState() 로 읽어 분기한다(판정을 두 곳에 두면 MAX_RETRY 변경 시 한쪽만 반영된다).
  // @MX:SPEC: SPEC-AI-010 REQ-AI10-024 REQ-AI10-025 REQ-AI10-026
  /**
   * blind → 카운터 +1(상한 도달 시 `retry-exhausted`), directed → 카운터 0 리셋,
   * exempt → 아무것도 하지 않는다. 소진 전이 시점에는 발행할 요청이 없으므로 두 타이머를
   * 함께 닫는다 — 남겨 두면 백스톱이 뒤늦게 발화해, 애초에 나가지도 않은 요청에 대해
   * "응답이 오지 않았어요" 라는 거짓 오류가 소진 카드를 덮는다.
   */
  applyReRequestKind(kind: ReRequestKind): void {
    if (kind === 'exempt') return;
    this.commit(kind === 'blind' ? { type: 'retry' } : { type: 'retry-reset' });
    if (this.state.phase === 'retry-exhausted') this.clearTimers();
  }

  getRenderInput(): RenderCardInput {
    return {
      state: this.state,
      actions: deriveCardActions(this.model.presetKind, this.model.insertOnly),
      presetKind: this.model.presetKind,
      streamBuffer: this.streamBuffer,
      waitingLong: this.waitingLong,
      model: this.model.model,
      renderMermaid: this.options.renderMermaid,
      callbacks: this.callbacks,
    };
  }
}

// @MX:NOTE: [AUTO] SPEC-AI-004 D-C — 무태그(```)·타 태그(```mmd) 펜스까지 매칭하도록 일반화.
// 실 CLI 재현(s10): 프롬프트가 펜스 금지를 지시해도 haiku가 ```mermaid 외 다른 펜스로 감싸면
// 기존 태그 고정 정규식이 매칭 실패해 validateMermaid가 항상 실패, 불필요한 자동 재요청을
// 유발했다. 마커만 제거하고 내부 코드는 리라이팅하지 않는다(무손상). 호출은 handleDiagramComplete
// (presetKind==='diagram') 전용이라 일반 코드블록(예: ```bash)을 잘못 벗길 표면이 없다.
/** ``` 펜스(태그 유무 무관)에서 원본 다이어그램 코드만 추출. 펜스가 없으면 트림된 원문(BUG-3a). */
export function stripMermaidFence(code: string): string {
  const m = code.match(/```[a-z]*\s*\n([\s\S]*?)```/i);
  return (m ? m[1] : code).trim();
}

/**
 * 맨 mermaid 코드를 ```mermaid 펜스로 감싼다(BUG-5). 사전 검증·미니 렌더는 stripMermaidFence
 * 로 벗긴 코드를 쓰지만, 문서에 실제로 삽입되는 텍스트는 마크다운 미리보기가 다이어그램으로
 * 렌더할 수 있도록 펜스가 필요하다 — 이미 펜스가 있으면(어떤 경로로든) 이중으로 감싸지 않는다.
 */
export function ensureMermaidFence(code: string): string {
  const trimmed = code.trim();
  if (/^```mermaid\s*\n[\s\S]*```\s*$/.test(trimmed)) return trimmed;
  return `\`\`\`mermaid\n${trimmed}\n\`\`\``;
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
/** 현재 등록된 활성 EditorView(SPEC-AI-005 OFF 부수효과가 고스트 정리 dispatch 에 재사용). */
export function getActiveEditorView(): EditorView | null {
  return activeView;
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

/** 적용(바꾸기/아래삽입) — 등록된 뷰에 재검증 후 단일 트랜잭션. 불일치면 stale 카드로 전환. */
function applyActiveCard(controller: AiSuggestionCardController, mode: ApplyMode): void {
  const view = activeView;
  if (!view) return;
  const rawSuggestion = controller.getState().suggestion;
  // BUG-5: state.suggestion 은 검증/미니 렌더를 위해 펜스가 벗겨진 맨 코드다(BUG-3a). 문서
  // 삽입 시점에만 다이어그램 카드에 한해 펜스를 되살려, 마크다운 미리보기가 다이어그램으로
  // 렌더하게 한다(카드 상태·검증 경로는 건드리지 않는다).
  // BUG-6: 목록 폴백 모드에서는 응답이 목록(일반 텍스트)이지 다이어그램이 아니므로 펜스를
  // 씌우지 않는다 — model.presetKind 는 여전히 'diagram' 으로 고정되어 있어 이 플래그가 없으면
  // 목록 텍스트가 ```mermaid 로 잘못 감싸진다.
  const isDiagramInsertion =
    controller.model.presetKind === 'diagram' && !controller.isListFallbackActive();
  const suggestion = isDiagramInsertion ? ensureMermaidFence(rawSuggestion) : rawSuggestion;
  const result = applySuggestion(view as unknown as ApplyView, {
    from: controller.model.range.from,
    to: controller.model.range.to,
    originalText: controller.model.originalText,
    suggestion,
    mode,
  });
  if (result.applied) {
    controller.destroy(); // 대기 안내 타이머 정리(REQ-AI6-008)
    removeCardController(controller); // 적용 완료 → 이 카드만 닫기(다른 카드 유지)
  } else {
    controller.markStale(); // 원문 불일치 → "원문이 바뀌어 적용할 수 없어요"(문서 무손상)
  }
}

// @MX:ANCHOR: [AUTO] fireReRequest - 카드 재요청(↻/직접지시/sonnet/목록폴백) 공통 발행 경로
// @MX:REASON: [AUTO] BUG-2 재발 방지 — originalArgs 를 기준으로 스프레드해야 selection/
//   contextBefore/contextAfter 가 재요청에도 실린다. overrides 로만 필드를 덮어써야 하며,
//   originalArgs 를 생략한 채 부분 필드만 조립하면 재요청 프롬프트가 컨텍스트 없이 비게 된다.
/**
 * 재요청 발행 — 원본 요청(originalArgs)을 기준으로 selection/contextBefore/contextAfter 를
 * 그대로 승계하고, overrides 로 customInstruction/model(및 목록 폴백의 presetKind/feature)만
 * 덮어써 새 in-flight 요청을 스폰한다(BUG-2). 새로 발행한 requestId 를 반환해 호출자(카드
 * 컨트롤러)가 구독 대상을 그 id 로 옮길 수 있게 한다(BUG-1).
 */
function fireReRequest(originalArgs: AiRequestArgs, overrides: Partial<AiRequestArgs>): string {
  const requestId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  // SPEC-AI-009 REQ-AI9-003: providerId 는 항상 "현재" 선택값으로 재계산한다.
  //   originalArgs.providerId 를 승계하면 사용자가 재요청 직전에 provider 를 바꾼 선택이 무시된다.
  //   overrides.providerId 도 허용하지 않는다 — 호출부 커스텀 명령/모델/feature 만 덮어쓴다.
  const merged: AiRequestArgs = { ...originalArgs, ...overrides, requestId, providerId: resolveProviderId() };
  const store = useAiStore.getState();
  store.startRequest(requestId, merged.feature);
  store.incrementCount();
  void aiRequest(merged).catch((e) =>
    useAiStore.getState().failRequest({ kind: 'other', message: ipcErrorMessage(e) }),
  );
  return requestId;
}

// @MX:ANCHOR: [AUTO] startSuggestionCard - 카드 컨트롤러 ↔ aiStore 구독 바인딩(fan_in >= 3: 툴바/
//   재요청 자동재시도/목록폴백 진입점)
// @MX:REASON: [AUTO] BUG-1 재발 방지 — 구독은 최초 requestId 가 아니라 boundRequestId(재요청마다
//   갱신)를 따라가야 한다. done/error 에서 구독을 끊으면 fireReRequest 가 새로 스폰한 요청의
//   스트림을 아무도 받지 못해 카드가 'streaming' 에 영원히 멈춘다(실기기 재현 완료). 구독은
//   컨트롤러가 살아있는 동안(적용/취소/닫기/정리로 destroy() 될 때까지) 유지되며, 해제 함수는
//   **컨트롤러가 보유한다** — 모듈 전역 단일 슬롯을 두면 새 카드가 생길 때마다 직전 카드의
//   구독이 끊겨 검토 대기 카드가 자기 이벤트를 못 받는다(SPEC-AI-010 REQ-AI10-012).
// @MX:SPEC: SPEC-AI-001 REQ-AI-034 / SPEC-AI-010 REQ-AI10-012
/**
 * 요청을 스트리밍 제안 카드로 바인딩한다(설계 §4.2). 활성 카드로 등록하고 aiStore 를 구독해
 * 스트리밍 버퍼/완료/오류를 컨트롤러로 흘려보낸다. aiRequest 스폰은 호출자(툴바 onRequest)가
 * 수행한다 — 이 함수는 카드 생성·바인딩만 담당해 단위 테스트가 Tauri 를 타지 않는다.
 */
export function startSuggestionCard(request: StartCardRequest): AiSuggestionCardController {
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

  // BUG-1: 재요청(↻/직접지시/sonnet/목록폴백)마다 새 requestId 가 발행되므로, 구독이 어느
  // requestId 를 바라볼지는 고정 값이 아니라 이 가변 바인딩을 따라간다.
  let boundRequestId = request.args.requestId;
  // 같은 requestId 의 done/error 를 두 번 처리하지 않기 위한 가드(구독을 더 이상 끊지 않으므로 필요).
  let lastHandledTerminal: string | null = null;

  // 전방 참조 — 콜백은 controller 할당 이후에만 호출된다.
  // 아래 callbacks 가 controller 를 참조하므로 선언과 초기화를 붙일 수 없다.
  // prefer-const 는 "한 번만 대입" 만 보고 이 순서 제약을 알지 못한다.
  // eslint-disable-next-line prefer-const
  let controller: AiSuggestionCardController;
  const callbacks: CardCallbacks = {
    onApply: (mode) => applyActiveCard(controller, mode),
    onCancel: () => {
      void aiCancel(boundRequestId).catch(() => undefined);
      useAiStore.getState().cancelRequest();
      controller.destroy(); // 대기 안내 타이머 정리(REQ-AI6-008)
      removeCardController(controller);
    },
    // @MX:NOTE: [AUTO] 재요청 소진 게이트. `retry-exhausted` 는 오직 **done 카드에서 출발한
    // blind 재요청**으로만 도달 가능하다 — 다른 phase(error/intruded)의 재시도와 컨트롤러
    // 내부 자동 재요청은 전부 exempt 라 카운터에 닿지 않는다. 이 불변식이 증강 렌더의 전제다:
    // suggestion 이 없는 phase 에서 도달하면 본문 없는 껍데기 카드가 된다.
    // 소진 판정은 여기서 다시 계산하지 않고 reduceCard 가 만든 phase 를 읽기만 한다.
    // @MX:SPEC: SPEC-AI-010 REQ-AI10-024 REQ-AI10-026 REQ-AI10-027 REQ-AI10-028 / SPEC-AI-001 REQ-AI-025
    onReRequest: (instruction, useModel, kind = 'exempt') => {
      controller.applyReRequestKind(kind);
      // 상한을 넘긴 blind 재요청은 **발행하지 않는다** — enterReRequest 도, fireReRequest 도,
      // boundRequestId·lastHandledTerminal 갱신도 하지 않는다. 카드는 제안을 그대로 든 채
      // 소진 안내로 전이한다(이미 가진 제안을 스켈레톤으로 덮지 않는다).
      if (kind === 'blind' && controller.getState().phase === 'retry-exhausted') return;
      // SPEC-AI-010 REQ-AI10-001/003: 사용자 개시 재요청 5종(↻ / ↻ 다시 / ⚡ 고급 모델 /
      // 다시 시도(error) / 다시 요청(intruded))이 전부 이 배선 하나로 수렴한다. 전이는
      // fireReRequest **이전에** 수행해야 한다 — fireReRequest 안의 store.startRequest 가
      // 구독을 동기 발화시키므로, 그 전에 카드가 이미 streaming 이어야 화면이 한 순간도
      // 옛 제안(done)으로 보이지 않는다.
      controller.enterReRequest();
      // BUG-2: 원본 args(selection/contextBefore/contextAfter)를 그대로 승계하고 지시/모델만 덮어쓴다.
      boundRequestId = fireReRequest(request.args, { customInstruction: instruction, model: useModel });
      lastHandledTerminal = null;
    },
    onListFallback: () => {
      // BUG-6: 목록 폴백 모드로 전환 — 이후 onComplete/applyActiveCard 가 더 이상 이 응답을
      // 다이어그램으로 취급하지 않는다. 재요청 발행 전에 호출해 카드가 즉시 streaming 으로
      // 돌아가 보이게 한다.
      controller.enterListFallback();
      boundRequestId = fireReRequest(request.args, {
        feature: 'inline-edit',
        presetKind: 'outline',
        customInstruction: '',
        model: model.model,
      });
      lastHandledTerminal = null;
    },
    onOpenOnboarding: () => openOnboarding(),
    // REQ-AI9-038: 레지스트리 제거 1가지 부수효과만 — onCancel 과 달리 aiCancel IPC 를 발사하지
    // 않는다(종결 phase 는 in-flight 요청이 없으므로 취소할 대상이 없다, M8.4.3).
    onDismiss: () => {
      controller.destroy();
      removeCardController(controller);
    },
  };
  controller = new AiSuggestionCardController(model, callbacks, { renderMermaid: renderMermaidInto });
  registerCardController(controller);

  // aiStore 스트리밍 → 컨트롤러 반영(useAiRelay 가 ai://chunk 를 버퍼에 누적하면 여기서 미러링).
  // BUG-1: done/error 에서도 구독을 끊지 않는다 — 재요청이 boundRequestId 를 갱신하면 같은
  // 구독이 새 요청의 스트림을 계속 받는다. 대신 done/error 재처리를 막기 위해 마지막으로
  // 처리한 terminal 상태를 기억한다.
  const storeUnsub = useAiStore.subscribe((s) => {
    if (s.requestId !== boundRequestId) return;
    if (s.requestState === 'streaming') {
      controller.onStream(s.streamBuffer);
    } else if (s.requestState === 'done') {
      const key = `${s.requestId}:done`;
      if (lastHandledTerminal === key) return;
      lastHandledTerminal = key;
      controller.onComplete(s.streamBuffer);
    } else if (s.requestState === 'error' && s.errorInfo) {
      const key = `${s.requestId}:error`;
      if (lastHandledTerminal === key) return;
      lastHandledTerminal = key;
      controller.onError(s.errorInfo);
    }
  });

  // SPEC-AI-010 REQ-AI10-012: 위 스토어 구독은 `aiStore` 의 **단일 슬롯**을 통과한 이벤트만
  // 본다. 카드 A가 재요청으로 그 슬롯을 가져가면 카드 B의 이벤트는 `useAiRelay.isCurrent`
  // 에서 스토어에 닿기도 전에 폐기되어 B가 영원히 멈춘다. 라우터 구독은 **스토어가 폐기한
  // 이벤트만** 받아 그 구멍을 메운다 — 아래 `isStoreSlot` 가드가 정확히 `isCurrent` 와
  // 상보적이므로, 카드가 현재 슬롯을 쥐고 있는 동안의 동작은 개정 전과 한 글자도 다르지 않다
  // (고스트/툴바/설정이 의존하는 단일 슬롯 의미론 보존).
  const isStoreSlot = (): boolean => useAiStore.getState().requestId === boundRequestId;
  const routerUnsub = subscribeAiEvents(() => boundRequestId, {
    onChunk: (text) => {
      if (isStoreSlot()) return;
      // 라우터는 원시 델타를 준다(스토어의 appendChunk 누적이 없다) — 컨트롤러가 직접 잇는다.
      controller.appendStreamDelta(text);
    },
    onDone: (result, truncated) => {
      if (isStoreSlot()) return;
      const key = `${boundRequestId}:done`;
      if (lastHandledTerminal === key) return;
      lastHandledTerminal = key;
      // result 는 권위 값 — 누적 버퍼를 덮어쓴다(reduceCompleteRequest 와 동일 의미론).
      controller.onComplete(result, { truncated });
    },
    onError: (kind, message) => {
      if (isStoreSlot()) return;
      const key = `${boundRequestId}:error`;
      if (lastHandledTerminal === key) return;
      lastHandledTerminal = key;
      controller.onError({ kind, message });
    },
  });

  // 해제 함수는 컨트롤러가 보유한다 — 모듈 전역 단일 슬롯(activeCardUnsub)을 두면 새 카드가
  // 만들어질 때마다 직전 카드의 구독이 끊겨 검토 대기 카드가 자기 이벤트를 못 받는다.
  controller.setUnbind(() => {
    storeUnsub();
    routerUnsub();
  });

  return controller;
}
