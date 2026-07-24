// @MX:ANCHOR: [AUTO] createAiGhostText - 섹션 채우기/이어쓰기 고스트 텍스트 확장(힌트·스트리밍·확정)
// @MX:REASON: [AUTO] markdown-extensions 번들에서 AI keymap을 indentWithTab보다 높은 precedence로
//   등록하는 유일한 지점 — Mod-Enter/Esc 선점과 Tab 비확정 보장이 여기 걸린다(REQ-AI-031)
// @MX:SPEC: SPEC-AI-001 REQ-AI-028 REQ-AI-029 REQ-AI-030 REQ-AI-031 REQ-AI-032

import {
  WidgetType,
  Decoration,
  EditorView,
  ViewPlugin,
  keymap,
} from '@codemirror/view';
import type { DecorationSet, Command, KeyBinding, ViewUpdate } from '@codemirror/view';
import { StateField, StateEffect, EditorSelection, Prec } from '@codemirror/state';
import type { EditorState, Extension, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { aiRequest, aiCancel, ipcErrorMessage } from '@/lib/tauri/ipc';
import type { AiRequestArgs } from '@/lib/tauri/ipc';
import { useAiStore } from '@/store/aiStore';
import { useUIStore } from '@/store/uiStore';
import { resolveModel } from '@/components/settings/SettingsModal';
import { getEffectiveAiEnabled, resolveProviderId } from '@/store/aiPolicy';
import { WAIT_NOTICE_DELAY_MS, WAIT_NOTICE_TEXT } from '@/lib/ai/waitNotice';

// ============================================================
// 순수 판정 — 힌트는 토큰 0 로컬 로직(설계 §5.2, REQ-AI-028/032)
// ============================================================

const HEADING_RE = /^#{1,6}\s+\S/;

/** 문서에서 ATX 헤딩 줄만 뽑아 아웃라인을 만든다(트림된 원문 유지). */
export function buildOutline(doc: string): string[] {
  return doc
    .split('\n')
    .filter((line) => HEADING_RE.test(line))
    .map((line) => line.trim());
}

/** 섹션 채우기 컨텍스트(대상 헤딩 + 전체 아웃라인). */
export interface SectionFillContext {
  heading: string;
  outline: string[];
}

/**
 * 커서가 "내용 없는 헤딩 바로 아래 빈 줄"에 있으면 컨텍스트를 반환한다(시나리오 F).
 * 판정은 커서 위치·문서 텍스트만 사용하는 순수 로직 — AI 요청/토큰 소모가 없다(REQ-AI-032).
 */
export function getSectionFillContext(
  state: EditorState,
  pos: number,
): SectionFillContext | null {
  const line = state.doc.lineAt(pos);
  if (line.text.trim() !== '') return null;

  // 커서 줄에서 위로 스캔 — 첫 비어있지 않은 줄이 헤딩이어야 하고, 그 사이에 본문이 없어야 한다.
  for (let n = line.number - 1; n >= 1; n--) {
    const text = state.doc.line(n).text;
    if (text.trim() === '') continue;
    if (HEADING_RE.test(text)) {
      return { heading: text.trim(), outline: buildOutline(state.doc.toString()) };
    }
    return null; // 위쪽 첫 비어있지 않은 줄이 헤딩이 아님(= 섹션에 이미 내용 있음)
  }
  return null; // 위에 헤딩 없음
}

/** 힌트 버튼 노출 자격(순수, 토큰 0). */
export function isHintEligible(state: EditorState, pos: number): boolean {
  return getSectionFillContext(state, pos) !== null;
}

/** 자유 위치 이어쓰기(시나리오 E, 문서 끝 분기)에 필요한 최소 컨텍스트. */
export interface ContinueContext {
  outline: string[];
  contextBefore: string;
}

/**
 * 커서가 "문서 끝(마지막 비어있지 않은 줄 이후)의 빈 줄"에 있으면 컨텍스트를 반환한다
 * (REQ-AI-028 문서 끝 분기). 빈 헤딩 섹션 채우기가 우선하므로 getSectionFillContext 가 자격을
 * 갖는 위치에서는 null 을 반환한다. 순수 로직 — AI 요청/토큰 소모가 없다(REQ-AI-032).
 */
export function getContinueContext(state: EditorState, pos: number): ContinueContext | null {
  const line = state.doc.lineAt(pos);
  if (line.text.trim() !== '') return null;
  if (getSectionFillContext(state, pos) !== null) return null; // 섹션 채우기 우선

  const docText = state.doc.toString();
  const before = docText.slice(0, pos);
  const after = docText.slice(pos);
  if (after.trim() !== '') return null; // 커서 뒤에 실 내용이 있으면 "문서 끝"이 아님
  if (before.trim() === '') return null; // 문서에 내용이 전혀 없음

  return { outline: buildOutline(docText), contextBefore: before };
}

// ============================================================
// 자유 위치 이어쓰기(M2, SPEC-AI-003) — syntaxTree 게이트 + 임의 커서 위치 자격 판정
// ============================================================

/** 구문 배제 게이트 판정 결과(D2) — blocked 는 트리거 자체를 막고, hintExcluded 는 힌트만 막는다. */
export interface ContinueBlockGate {
  /** FencedCode/CodeBlock/Table 조상이면 true — 힌트·트리거 전부 배제(REQ-AI3-003, 무손상 원칙). */
  blocked: boolean;
  /** ListItem/Blockquote 조상이면 true — 수동 Mod+Enter 는 허용하되 힌트만 배제(REQ-AI3-004, D2). */
  hintExcluded: boolean;
}

// @MX:ANCHOR: [AUTO] getContinueBlockGate - 자유 위치 이어쓰기의 유일한 syntaxTree 배제 판정 지점
// @MX:REASON: [AUTO] 힌트(evaluateHintEligibility)와 트리거(getFreeContinueContext)가 모두 이
//   함수를 통해서만 코드펜스/표/리스트/인용 정책(D2)을 판정한다(fan_in >= 2) — 정책 변경 시 단일
//   수정 지점을 보장한다.
// @MX:SPEC: SPEC-AI-003
/**
 * 커서 위치의 조상 구문 노드를 훑어 배제 정책을 판정한다(순수, 토큰 0). `@codemirror/language`의
 * `syntaxTree(state).resolveInner(pos, -1)`만 사용하며 신규 런타임 의존성이 없다(REQ-AI3-003, 004).
 */
export function getContinueBlockGate(state: EditorState, pos: number): ContinueBlockGate {
  let node = syntaxTree(state).resolveInner(pos, -1);
  let blocked = false;
  let hintExcluded = false;
  while (true) {
    if (node.name === 'FencedCode' || node.name === 'CodeBlock' || node.name === 'Table') {
      blocked = true;
    }
    if (node.name === 'ListItem' || node.name === 'Blockquote') {
      hintExcluded = true;
    }
    if (!node.parent) break;
    node = node.parent;
  }
  return { blocked, hintExcluded };
}

/** 자유 위치 이어쓰기 컨텍스트 — 앞뒤 원문 전체를 통째로 담는다(절단은 Rust, REQ-AI3-001). */
export interface FreeContinueContext {
  outline: string[];
  contextBefore: string;
  contextAfter: string;
}

// @MX:NOTE: [AUTO] getFreeContinueContext - 자유 위치 이어쓰기 트리거 자격의 단일 진입 지점.
//   startFreeContinueWritingCommand 가 유일하게 호출하며, 우선순위(section-fill > 문서 끝
//   continue > 자유 위치 continue, REQ-AI3-002)와 배제 정책(getContinueBlockGate)을 여기서만
//   조합한다. ai-ghost-text.ts 는 파일당 ANCHOR 상한(3)에 걸려 있어 ANCHOR 대신 NOTE로 문서화
//   한다 — getContinueBlockGate(ANCHOR, fan_in=2)가 실질 판정 단일 지점이다.
// @MX:SPEC: SPEC-AI-003
/**
 * 임의 커서 위치의 이어쓰기 자격을 판정한다(순수, 토큰 0, REQ-AI3-001). 우선순위 유지를 위해
 * section-fill·문서 끝 continue(getSectionFillContext/getContinueContext, D3 병행 전략)가 이미
 * 자격을 갖는 위치에서는 null 을 반환한다(REQ-AI3-002). 배제 노드(FencedCode/CodeBlock/Table)
 * 내부도 null(REQ-AI3-003) — 그 외 거의 모든 위치가 자격을 갖는다(리스트/인용 포함, D2).
 */
export function getFreeContinueContext(state: EditorState, pos: number): FreeContinueContext | null {
  if (getSectionFillContext(state, pos) !== null) return null;
  if (getContinueContext(state, pos) !== null) return null;
  if (getContinueBlockGate(state, pos).blocked) return null;

  const docText = state.doc.toString();
  return {
    outline: buildOutline(docText),
    contextBefore: docText.slice(0, pos),
    contextAfter: docText.slice(pos),
  };
}

/** 문장 종결 부호 닫힌 집합(REQ-AI3-005) — 후행 공백·닫는 따옴표/괄호는 무시하고 판정한다. */
const CONTINUE_SENTENCE_TERMINATORS = new Set(['.', '!', '?', '。', '…']);
const TRAILING_CLOSERS_RE = /[)\]"'"'』」〉》）］]+$/;

/** 줄 텍스트가 문장 종결 부호로 끝나는지(닫는 따옴표/괄호·후행 공백은 건너뛴다). */
function endsWithSentenceTerminator(lineText: string): boolean {
  const trimmed = lineText.replace(/\s+$/, '').replace(TRAILING_CLOSERS_RE, '');
  if (trimmed === '') return false;
  return CONTINUE_SENTENCE_TERMINATORS.has(trimmed.slice(-1));
}

/**
 * 자유 위치 힌트의 보수 조건(2단 자격, REQ-AI3-005/006) — 비어있지 않은 줄의 줄 끝 + 문장
 * 미종결 + 배제 노드 밖(힌트 배제 포함)일 때만 참. 트리거 자격(getFreeContinueContext)과는
 * 독립 판정이다 — 이 함수가 false 여도 Mod+Enter 트리거는 별도로 동작할 수 있다.
 */
function isFreeContinueHintEligible(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  if (pos !== line.to) return false;
  if (line.text.trim() === '') return false;
  if (endsWithSentenceTerminator(line.text)) return false;
  const gate = getContinueBlockGate(state, pos);
  if (gate.blocked || gate.hintExcluded) return false;
  return true;
}

// ============================================================
// 고스트 상태 — StateField + StateEffect (문서 텍스트 비오염, 뷰 레이어 전용)
// ============================================================

/** 고스트 값: 삽입 앵커 위치 + 현재까지 스트리밍된 텍스트 + 요청 상태(컨트롤 버튼 판정용). */
export interface GhostValue {
  from: number;
  text: string;
  /** streaming/done 판정 — 컨트롤 버튼([■ 중지] 대 [✓ 넣기]/[✕ 지우기]) 렌더에 사용(REQ-AI-029/030). */
  status?: 'streaming' | 'done';
  /** SPEC-AI-006 REQ-AI6-007: 발행 후 대기 임계(기본 8초)를 넘겨도 첫 청크가 없으면 true. */
  waitingLong?: boolean;
}

/** 고스트 시작(앵커 고정, 텍스트 비움). */
export const startGhostEffect = StateEffect.define<{ from: number }>();
/** 스트리밍 텍스트 갱신(앵커 유지). */
export const setGhostTextEffect = StateEffect.define<string>();
/** 요청 상태 갱신(streaming/done) — 고스트 컨트롤 버튼 렌더 판정에만 쓰인다. */
export const setGhostStatusEffect = StateEffect.define<'streaming' | 'done'>();
/** SPEC-AI-006 REQ-AI6-007/008: 대기 안내 표시 여부 갱신(플레이스홀더 전용). */
export const setGhostWaitingEffect = StateEffect.define<boolean>();
/** 고스트 제거. */
export const clearGhostEffect = StateEffect.define<null>();

// @MX:NOTE: 어떤 사용자 편집(타이핑·Tab 들여쓰기)이든 docChanged 트랜잭션이면 고스트를 소멸시킨다
// (사용자 입력 우선, REQ-AI-030/031). 확정 삽입은 clearGhostEffect를 함께 실어 이 경로를 우회한다.
export const aiGhostField = StateField.define<GhostValue | null>({
  create: () => null,
  update(value, tr) {
    let next = value;
    let hadGhostEffect = false;
    for (const e of tr.effects) {
      if (e.is(startGhostEffect)) {
        next = { from: e.value.from, text: '' };
        hadGhostEffect = true;
      } else if (e.is(setGhostTextEffect)) {
        if (next) next = { ...next, text: e.value };
        hadGhostEffect = true;
      } else if (e.is(setGhostStatusEffect)) {
        if (next) next = { ...next, status: e.value };
        hadGhostEffect = true;
      } else if (e.is(setGhostWaitingEffect)) {
        if (next) next = { ...next, waitingLong: e.value };
        hadGhostEffect = true;
      } else if (e.is(clearGhostEffect)) {
        next = null;
        hadGhostEffect = true;
      }
    }
    if (hadGhostEffect) return next;
    if (next && tr.docChanged) return null; // 사용자 편집 → 고스트 소멸
    return next;
  },
  provide: (field) =>
    EditorView.decorations.from(field, (value) => ghostDecorations(value)),
});

// @MX:NOTE: value.text === '' 는 "요청은 시작됐지만 첫 청크가 아직 안 왔다"는 뜻이다(REQ-AI2-006).
// 이 구간엔 상수 eq() 의 GhostPlaceholderWidget 을 렌더해 pulse 가 청크 대기 중 재시작되지 않게
// 한다. 첫 청크가 도착해 text 가 비지 않으면 기존 GhostWidget(text 비교 eq) 경로로 자연 전환된다
// (REQ-AI2-007). !value(고스트 자체가 없음)만 Decoration.none — 대기 상태와는 구분한다.
/** 고스트 값 → 데코레이션 세트(대기 플레이스홀더/회색 고스트 텍스트 + 상태별 컨트롤 버튼). */
function ghostDecorations(value: GhostValue | null): DecorationSet {
  if (!value) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  if (value.text === '') {
    ranges.push(
      Decoration.widget({
        widget: new GhostPlaceholderWidget(value.waitingLong ?? false),
        side: 1,
      }).range(value.from),
    );
  } else {
    ranges.push(
      Decoration.widget({ widget: new GhostWidget(value.text), side: 1 }).range(value.from),
    );
  }
  if (value.status) {
    ranges.push(
      Decoration.widget({ widget: new GhostControlsWidget(value.status), side: 2 }).range(
        value.from,
      ),
    );
  }
  return Decoration.set(ranges, true);
}

/**
 * 고스트 대기 플레이스홀더 위젯("✨ 작성 중…") — 첫 청크 도착 전 앵커 위치에 pulse 로 표시한다
 * (REQ-AI2-006). eq() 가 항상 true(상수)라 대기 중 재생성이 없어 pulse 애니메이션이 끊기지
 * 않는다(REQ-AI2-013). 확정 불가 불변식은 confirmGhostCommand 의 `!ghost.text` 가드가 담당한다
 * (REQ-AI2-011) — 이 위젯은 뷰 레이어 전용이며 문서 텍스트를 절대 변경하지 않는다.
 */
class GhostPlaceholderWidget extends WidgetType {
  constructor(readonly waitingLong: boolean = false) {
    super();
  }
  eq(other: WidgetType): boolean {
    return other instanceof GhostPlaceholderWidget && other.waitingLong === this.waitingLong;
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'mdedit-ai-ghost-placeholder';
    span.textContent = '✨ 작성 중…';
    // SPEC-AI-006 REQ-AI6-007/008/009: 8초 무응답이면 보조 문구만 덧붙인다(진행률 바 금지).
    if (this.waitingLong) {
      const notice = document.createElement('span');
      notice.className = 'mdedit-ai-wait-notice';
      notice.textContent = ` ${WAIT_NOTICE_TEXT}`;
      span.appendChild(notice);
    }
    return span;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

/** 회색 고스트 텍스트 인라인 위젯 — 문서 상태에 없는 순수 뷰 요소. */
class GhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: WidgetType): boolean {
    return other instanceof GhostWidget && other.text === this.text;
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-ai-ghost';
    span.textContent = this.text;
    span.style.color = 'var(--md-text-faint)';
    span.style.opacity = '0.8';
    return span;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

/** 고스트 컨트롤 버튼 생성 헬퍼 — mousedown 을 preventDefault 해 에디터 포커스/선택을 보존한다. */
function makeGhostControlButton(label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cm-ai-ghost-btn';
  btn.textContent = label;
  btn.addEventListener('mousedown', (event) => event.preventDefault());
  return btn;
}

/**
 * ↻ 재요청 버튼(SPEC-AI-006 REQ-AI6-010/011). `cm-ai-ghost-btn` 이 아닌 별도 클래스를 쓴다 —
 * 기존 테스트(`aiGhostControls.test.ts`)가 `.cm-ai-ghost-btn` 개수를 done 상태에서 정확히
 * 2개(넣기/지우기)로 단언하므로, 이를 무개정 통과시키기 위해 재요청 버튼은 별도 클래스로 둔다.
 */
function makeGhostRedoButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cm-ai-ghost-redo-btn';
  btn.textContent = '↻';
  btn.addEventListener('mousedown', (event) => event.preventDefault());
  return btn;
}

/**
 * 고스트 컨트롤 버튼 위젯(REQ-AI-029/030) — 스트리밍 중엔 [■ 중지], 완료(done)면
 * [✓ 넣기]·[✕ 지우기]를 렌더한다. 기존 confirmGhostCommand/dismissGhostCommand 를 그대로
 * 재사용해 확정·소멸 경로를 Mod-Enter/Esc 와 단일화한다(view 레이어 전용, 문서 직접 조작 없음).
 */
class GhostControlsWidget extends WidgetType {
  constructor(readonly status: 'streaming' | 'done') {
    super();
  }
  eq(other: WidgetType): boolean {
    return other instanceof GhostControlsWidget && other.status === this.status;
  }
  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-ai-ghost-controls';
    if (this.status === 'streaming') {
      const stop = makeGhostControlButton('■ 중지');
      stop.addEventListener('click', () => dismissGhostCommand(view));
      wrap.appendChild(stop);
    } else {
      const confirm = makeGhostControlButton('✓ 넣기');
      confirm.addEventListener('click', () => confirmGhostCommand(view));
      const dismiss = makeGhostControlButton('✕ 지우기');
      dismiss.addEventListener('click', () => dismissGhostCommand(view));
      wrap.appendChild(confirm);
      wrap.appendChild(dismiss);
      // SPEC-AI-006 REQ-AI6-010/011: done 상태에만 재요청(↻) 노출 — streaming 중엔 [■ 중지]만.
      const redo = makeGhostRedoButton();
      redo.addEventListener('click', () => reRequestGhost(view));
      wrap.appendChild(redo);
    }
    return wrap;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

// ============================================================
// 대기 안내 타이머 (SPEC-AI-006 항목 5, REQ-AI6-007/008) — module-level single-flight ref
// (uiStore.ts statusMessageTimer 선례 재사용). 발행 3종 커맨드가 시작 시 무장하고,
// ghostStoreBridge 가 첫 청크/완료/오류/idle 전이 시 해제한다(clearGhostWaitNotice).
// ============================================================

let ghostWaitNoticeTimer: ReturnType<typeof setTimeout> | null = null;

/** 대기 안내 타이머를 해제한다(첫 청크·완료·오류·취소·언마운트 시 호출, REQ-AI6-008). */
function clearGhostWaitNotice(): void {
  if (ghostWaitNoticeTimer !== null) {
    clearTimeout(ghostWaitNoticeTimer);
    ghostWaitNoticeTimer = null;
  }
}

/** 발행 직후 대기 안내 타이머를 무장한다 — 지연 경과 시 고스트가 여전히 빈 채면 표시한다. */
function armGhostWaitNotice(view: EditorView): void {
  clearGhostWaitNotice();
  ghostWaitNoticeTimer = setTimeout(() => {
    ghostWaitNoticeTimer = null;
    const ghost = view.state.field(aiGhostField, false);
    if (ghost && ghost.text.trim() === '') {
      view.dispatch({ effects: setGhostWaitingEffect.of(true) });
    }
  }, WAIT_NOTICE_DELAY_MS);
}

// ============================================================
// 고스트 재요청(↻) — 마지막 트리거 인자 보관 (SPEC-AI-006 항목 3, REQ-AI6-010/011)
// ============================================================

// @MX:NOTE: [AUTO] lastGhostTrigger - 고스트 ↻ 재요청을 위한 마지막 발행 인자 보관(D5).
// 발행 커맨드 3종(section-fill/continue/free-continue)이 시작 시점에 저장하고,
// reRequestGhost 가 동일 인자(재파생 아님)로 새 requestId 발행에 재사용한다.
// @MX:SPEC: SPEC-AI-006
let lastGhostTrigger: Omit<AiRequestArgs, 'requestId'> | null = null;

/**
 * 완료(done) 상태의 고스트에서 ↻를 실행 — 마지막 트리거 인자를 재사용해 새 requestId 로
 * 동일 종류의 요청을 다시 발행한다(D5, 카드 fireReRequest 와 동일 의미론). streaming 중이거나
 * 보관된 인자가 없으면 false.
 */
export function reRequestGhost(view: EditorView): boolean {
  const ghost = view.state.field(aiGhostField, false);
  if (!ghost || ghost.status !== 'done' || !lastGhostTrigger) return false;

  const requestId = `gr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  useAiStore.getState().startRequest(requestId, 'section-fill');
  view.dispatch({
    effects: [
      setGhostTextEffect.of(''),
      setGhostStatusEffect.of('streaming'),
      setGhostWaitingEffect.of(false),
    ],
  });
  armGhostWaitNotice(view);

  void aiRequest({ requestId, ...lastGhostTrigger, providerId: resolveProviderId() }).catch((e) =>
    useAiStore.getState().failRequest({ kind: 'other', message: ipcErrorMessage(e) }),
  );
  return true;
}

// ============================================================
// 커맨드 — Mod-Enter 확정 / Esc·지우기 소멸 / 트리거
// ============================================================

// @MX:ANCHOR: [AUTO] confirmGhostCommand - 고스트 확정 단일 트랜잭션(Mod+Z 1회 복원 계약)
// @MX:REASON: [AUTO] P5 무손상 원칙의 구현 — 확정은 반드시 changes+clear를 한 트랜잭션으로 묶어야
//   undo 스택이 1스텝으로 복원된다. Mod-Enter 재입력·[넣기] 버튼이 공유하는 유일 확정 경로(fan_in>=2)
/** 고스트를 실제 텍스트로 확정한다(단일 트랜잭션 → undo 1회 복원, REQ-AI-030). */
export const confirmGhostCommand: Command = (view) => {
  const ghost = view.state.field(aiGhostField, false);
  if (!ghost || !ghost.text) return false;
  clearGhostWaitNotice();
  view.dispatch({
    changes: { from: ghost.from, insert: ghost.text },
    effects: clearGhostEffect.of(null),
    selection: EditorSelection.cursor(ghost.from + ghost.text.length),
    userEvent: 'input.complete',
  });
  return true;
};

/** 고스트를 버린다([지우기]/Esc/[■ 중지]). 스트리밍 중이면 in-flight 요청도 취소한다(REQ-AI-005). */
export const dismissGhostCommand: Command = (view) => {
  const ghost = view.state.field(aiGhostField, false);
  if (!ghost) return false;
  clearGhostWaitNotice();
  view.dispatch({ effects: clearGhostEffect.of(null) });
  const ai = useAiStore.getState();
  if (ai.requestState === 'streaming' && ai.requestId) {
    void aiCancel(ai.requestId);
    ai.cancelRequest();
  }
  return true;
};

/** 섹션 채우기 요청을 시작한다(힌트 클릭/Mod-Enter). 자격 없으면 false. */
export const startSectionFillCommand: Command = (view) => {
  const head = view.state.selection.main.head;
  const ctx = getSectionFillContext(view.state, head);
  if (!ctx) return false;

  const requestId = `sf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  useAiStore.getState().startRequest(requestId, 'section-fill');
  // BUG-8: 문서 끝(빈 헤딩 섹션)에서 트리거하면 고스트 플레이스홀더가 뷰포트 밖에 뜰 수 있다 —
  // 시작 시 1회 앵커를 뷰포트에 보이게 스크롤한다(청크마다는 ghostStoreBridge 가 처리).
  view.dispatch({
    effects: [startGhostEffect.of({ from: head }), EditorView.scrollIntoView(head, { y: 'nearest' })],
  });
  armGhostWaitNotice(view);

  // 백엔드 계약(team-lead 확정): outline = 전체 헤딩 아웃라인, contextBefore = 커서 앞 본문 꼬리.
  // 1.5K자 상한 절단은 백엔드가 수행하므로 프론트는 커서 앞 원문을 그대로 넘긴다(설계 §7). presetKind·selection 없음.
  // 섹션 채우기는 continue 가 아니므로 length 를 싣지 않는다(REQ-AI6-014).
  // SPEC-AI-009 REQ-AI9-003: 현재 선택된 provider(auto/claude/codex)를 실어 라우팅한다.
  const model = resolveModel(useUIStore.getState().aiAdvancedModel);
  const requestArgs: Omit<AiRequestArgs, 'requestId'> = {
    feature: 'section-fill',
    model,
    outline: ctx.outline.join('\n'),
    contextBefore: view.state.sliceDoc(0, head),
    providerId: resolveProviderId(),
  };
  lastGhostTrigger = requestArgs;
  void aiRequest({ requestId, ...requestArgs }).catch((e) =>
    useAiStore.getState().failRequest({ kind: 'other', message: ipcErrorMessage(e) }),
  );
  return true;
};

/**
 * 자유 위치 이어쓰기(문서 끝 분기)를 시작한다(힌트 클릭/Mod-Enter, REQ-AI-028/029). 자격 없으면
 * false. presetKind:'continue' 로 Rust 쪽 문체 상속 템플릿을 선택한다(feature 는 'section-fill'
 * 그대로 유지 — IPC 계약 하위호환).
 */
export const startContinueWritingCommand: Command = (view) => {
  const head = view.state.selection.main.head;
  const ctx = getContinueContext(view.state, head);
  if (!ctx) return false;

  const requestId = `cw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  useAiStore.getState().startRequest(requestId, 'section-fill');
  // BUG-8: 문서 끝에서 트리거하면 고스트 플레이스홀더가 뷰포트 밖에 뜰 수 있다 — 시작 시
  // 1회 앵커를 뷰포트에 보이게 스크롤한다(청크마다는 ghostStoreBridge 가 처리).
  view.dispatch({
    effects: [startGhostEffect.of({ from: head }), EditorView.scrollIntoView(head, { y: 'nearest' })],
  });
  armGhostWaitNotice(view);

  const model = resolveModel(useUIStore.getState().aiAdvancedModel);
  // SPEC-AI-006 REQ-AI6-013: 이어쓰기(continue) 발행부 — 지속 설정 길이를 실어 보낸다.
  // SPEC-AI-009 REQ-AI9-003: 현재 선택된 provider(auto/claude/codex)를 실어 라우팅한다.
  const requestArgs: Omit<AiRequestArgs, 'requestId'> = {
    feature: 'section-fill',
    presetKind: 'continue',
    model,
    outline: ctx.outline.join('\n'),
    contextBefore: ctx.contextBefore,
    length: useUIStore.getState().aiContinueLength,
    providerId: resolveProviderId(),
  };
  lastGhostTrigger = requestArgs;
  void aiRequest({ requestId, ...requestArgs }).catch((e) =>
    useAiStore.getState().failRequest({ kind: 'other', message: ipcErrorMessage(e) }),
  );
  return true;
};

/**
 * 자유 위치 이어쓰기(M2, SPEC-AI-003)를 시작한다(힌트 클릭/Mod-Enter). 자격 없으면 false.
 * `startContinueWritingCommand`와 동일한 뼈대(requestId `cw-` prefix, `startRequest` 선행,
 * BUG-8 스크롤 1회)를 재사용하되 `contextAfter`를 추가로 실어 보낸다(REQ-AI3-008). feature/
 * presetKind 는 문서 끝 분기와 동일 — 신규 feature 문자열을 도입하지 않는다(IPC 하위호환).
 */
export const startFreeContinueWritingCommand: Command = (view) => {
  const head = view.state.selection.main.head;
  const ctx = getFreeContinueContext(view.state, head);
  if (!ctx) return false;

  const requestId = `cw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  useAiStore.getState().startRequest(requestId, 'section-fill');
  // BUG-8: 문서 중간이라도 뷰포트 밖일 수 있다 — 시작 시 1회 앵커를 뷰포트에 보이게 스크롤한다.
  view.dispatch({
    effects: [startGhostEffect.of({ from: head }), EditorView.scrollIntoView(head, { y: 'nearest' })],
  });
  armGhostWaitNotice(view);

  const model = resolveModel(useUIStore.getState().aiAdvancedModel);
  // SPEC-AI-006 REQ-AI6-013: 이어쓰기(continue) 발행부 — 지속 설정 길이를 실어 보낸다.
  // SPEC-AI-009 REQ-AI9-003: 현재 선택된 provider(auto/claude/codex)를 실어 라우팅한다.
  const requestArgs: Omit<AiRequestArgs, 'requestId'> = {
    feature: 'section-fill',
    presetKind: 'continue',
    model,
    outline: ctx.outline.join('\n'),
    contextBefore: ctx.contextBefore,
    contextAfter: ctx.contextAfter,
    length: useUIStore.getState().aiContinueLength,
    providerId: resolveProviderId(),
  };
  lastGhostTrigger = requestArgs;
  void aiRequest({ requestId, ...requestArgs }).catch((e) =>
    useAiStore.getState().failRequest({ kind: 'other', message: ipcErrorMessage(e) }),
  );
  return true;
};

// @MX:NOTE: Mod-Enter는 고스트 활성 시 확정, 아니면 섹션 채우기/문서 끝 이어쓰기/자유 위치
// 이어쓰기 순으로 트리거하는 4중 동작(설계 §5.1, REQ-AI3-002 우선순위: section-fill > 문서 끝
// continue > 자유 위치 continue). Tab은 여기 바인딩하지 않는다 — indentWithTab이 처리하고
// docChanged로 고스트가 소멸한다(REQ-AI-031).
// SPEC-AI-005 REQ-AI5-009: 이미 활성인 고스트의 확정(confirmGhostCommand)은 토글 OFF 와
// 무관하게 항상 허용한다 — 정리는 OFF 부수효과(aiOffEffects)가 담당한다(D3). 신규 트리거
// 3종만 effectiveAiEnabled 가 거짓이면 차단해 폴스루시키고, 어떤 AI 요청도 발생시키지 않는다.
const modEnterCommand: Command = (view) => {
  if (confirmGhostCommand(view)) return true;
  if (!getEffectiveAiEnabled()) return false;
  return (
    startSectionFillCommand(view) ||
    startContinueWritingCommand(view) ||
    startFreeContinueWritingCommand(view)
  );
};

/** AI 고스트 keymap. indentWithTab보다 앞서 등록해야 Mod-Enter/Esc가 선점된다. */
export const aiGhostKeymap: KeyBinding[] = [
  { key: 'Mod-Enter', run: modEnterCommand, preventDefault: true },
  { key: 'Escape', run: dismissGhostCommand },
];

// ============================================================
// 힌트 — 커서 3초 유휴 시 클릭 가능한 버튼(REQ-AI-028, 토큰 0 로컬 판정)
// ============================================================

/** 힌트 종류 — 섹션 채우기가 이어쓰기보다 우선한다. */
export type HintKind = 'section-fill' | 'continue';

/** 힌트 자격 판정 결과. */
export interface HintEligibility {
  kind: HintKind;
}

/**
 * 힌트 노출 자격 판정(순수, 토큰 0) — getSectionFillContext/getContinueContext/
 * isFreeContinueHintEligible 외 어떤 부수효과도 없다(REQ-AI-032). 우선순위는
 * section-fill > 문서 끝 continue > 자유 위치 continue(REQ-AI3-002) — 자유 위치는 최하위
 * 우선순위로 보수 조건(REQ-AI3-005)을 만족할 때만 힌트를 노출한다(D2, 스팸 억제).
 */
export function evaluateHintEligibility(state: EditorState, pos: number): HintEligibility | null {
  if (getSectionFillContext(state, pos) !== null) return { kind: 'section-fill' };
  if (getContinueContext(state, pos) !== null) return { kind: 'continue' };
  if (isFreeContinueHintEligible(state, pos)) return { kind: 'continue' };
  return null;
}

/** 힌트 유휴 지연(ms) — 3초(REQ-AI-028). */
export const HINT_IDLE_DELAY_MS = 3000;

/** 힌트 라벨(설계 §5.1 시나리오 E/F). */
const HINT_LABELS: Record<HintKind, string> = {
  'section-fill': '이 섹션 채우기',
  continue: '이어쓰기',
};

/** 실행 중인 OS로 단축키 표기를 매핑한다(설계 §2 — macOS ⌘⏎ / Windows·Linux Ctrl+⏎). */
function shortcutLabel(): string {
  const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
  return /Mac|iPod|iPhone|iPad/.test(platform) ? '⌘⏎' : 'Ctrl+⏎';
}

/** 힌트 데코레이션 갱신 강제용 더미 효과(타이머 콜백은 트랜잭션 밖에서 실행되므로 필요). */
const hintTickEffect = StateEffect.define<null>();

/** 힌트 알약 버튼 위젯 — 클릭 시 onActivate(트리거 커맨드 실행)만 수행한다(REQ-AI-032). */
class AiHintWidget extends WidgetType {
  constructor(
    readonly kind: HintKind,
    private readonly onActivate: () => void,
  ) {
    super();
  }
  eq(other: WidgetType): boolean {
    return other instanceof AiHintWidget && other.kind === this.kind;
  }
  toDOM(): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-ai-hint';
    btn.textContent = `✨ ${HINT_LABELS[this.kind]}  ${shortcutLabel()}`;
    btn.addEventListener('mousedown', (event) => event.preventDefault());
    btn.addEventListener('click', () => this.onActivate());
    return btn;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * 커서 3초 유휴 힌트 뷰 플러그인(REQ-AI-028). 문서 변경·선택 이동·고스트 활성화 시 즉시 숨기고
 * 타이머를 재설정한다. 힌트 자체는 순수 로컬 판정만 사용해 AI 요청을 발생시키지 않는다(REQ-AI-032)
 * — 요청은 오직 클릭(→ Mod-Enter와 동일한 트리거 경로)에서만 발생한다.
 */
class AiHintPluginValue {
  decorations: DecorationSet = Decoration.none;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly view: EditorView) {
    this.armTimer();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private hide(): void {
    this.decorations = Decoration.none;
  }

  private armTimer(): void {
    this.clearTimer();
    // SPEC-AI-005 REQ-AI5-008: effectiveAiEnabled 가 거짓이면 힌트 타이머 자체를 재무장하지
    // 않는다 — 매 재무장 시점에 다시 조회하므로 ON 복귀 시 다음 유휴 재무장에서 즉시 반영된다.
    if (!getEffectiveAiEnabled()) return;
    if (this.view.state.field(aiGhostField, false)) return; // 고스트 활성 중엔 힌트 없음
    const pos = this.view.state.selection.main.head;
    if (!evaluateHintEligibility(this.view.state, pos)) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!getEffectiveAiEnabled()) return; // 타이머 대기 중 토글 OFF 전환 방어(REQ-AI5-008)
      if (this.view.state.field(aiGhostField, false)) return;
      const curPos = this.view.state.selection.main.head;
      const eligibility = evaluateHintEligibility(this.view.state, curPos);
      if (!eligibility) return;
      this.decorations = Decoration.set([
        Decoration.widget({
          widget: new AiHintWidget(eligibility.kind, () => this.activate()),
          side: 1,
        }).range(curPos),
      ]);
      this.view.dispatch({ effects: hintTickEffect.of(null) });
    }, HINT_IDLE_DELAY_MS);
  }

  /** 힌트 클릭 → Mod-Enter와 동일한 트리거 경로(REQ-AI-029). 발행 후 힌트는 즉시 사라진다. */
  private activate(): void {
    this.hide();
    const fired = modEnterCommand(this.view);
    if (fired) {
      this.clearTimer();
    } else {
      this.armTimer();
    }
    this.view.dispatch({ effects: hintTickEffect.of(null) });
  }

  update(update: ViewUpdate): void {
    const ghostChanged =
      update.startState.field(aiGhostField, false) !== update.state.field(aiGhostField, false);
    if (update.docChanged || update.selectionSet || ghostChanged) {
      this.hide();
      this.armTimer();
    }
  }

  destroy(): void {
    this.clearTimer();
  }
}

/** 커서 유휴 힌트 확장(REQ-AI-028). */
export function createAiHint(): Extension {
  return ViewPlugin.fromClass(AiHintPluginValue, { decorations: (v) => v.decorations });
}

// ============================================================
// 타이핑 소멸 → in-flight 취소(D1, SPEC-AI-003 REQ-AI3-013/014)
// ============================================================

// @MX:NOTE: [AUTO] REQ-AI-034(무통보 취소 금지)의 명시적 예외(D1) — 타이핑으로 고스트가
// 파괴되는 것은 Esc 와 동급의 사용자 자발 종료이므로 토스트를 띄우지 않는다. aiGhostField.update
// 는 StateField 라 부수효과(취소 호출)를 낼 수 없어, 파괴가 "관찰"되는 updateListener 에서
// 확정 트랜잭션(clearGhostEffect 동승)과 구분해 취소를 호출한다.
// @MX:SPEC: SPEC-AI-003
/**
 * 고스트가 있다가 사라졌고(docChanged), 그 트랜잭션들에 clearGhostEffect 가 없었다면(=확정이
 * 아니라 타이핑/Tab 들여쓰기로 인한 파괴형 소멸) in-flight 요청을 취소한다. 확정 삽입은
 * changes 와 clearGhostEffect 를 같은 트랜잭션에 실어 이 경로를 우회하므로 오취소가 없다.
 */
const ghostTypingCancelListener = EditorView.updateListener.of((update) => {
  if (!update.docChanged) return;
  const before = update.startState.field(aiGhostField, false);
  const after = update.state.field(aiGhostField, false);
  if (!before || after) return; // 파괴형 소멸(있었다가 없어짐)이 아니면 무시
  const wasConfirm = update.transactions.some((tr) => tr.effects.some((e) => e.is(clearGhostEffect)));
  if (wasConfirm) return; // 확정 트랜잭션은 파괴 경로가 아니다(오취소 금지)
  const ai = useAiStore.getState();
  if (ai.requestState === 'streaming' && ai.requestId) {
    void aiCancel(ai.requestId);
    ai.cancelRequest();
  }
});

// @MX:NOTE: [AUTO] startGhostEffect 발행을 관찰해 대기 안내 타이머를 무장한다(SPEC-AI-006
// REQ-AI6-007). 발행 커맨드 3종이 직접 armGhostWaitNotice 를 호출하는 것과 별개로, 이 리스너가
// 단일 관찰 지점을 제공해 startGhostEffect 를 싣는 모든 트랜잭션(테스트 포함)에서 균일 동작한다.
export const ghostWaitNoticeArmListener = EditorView.updateListener.of((update) => {
  const created = update.transactions.some((tr) => tr.effects.some((e) => e.is(startGhostEffect)));
  if (created) {
    armGhostWaitNotice(update.view);
  }
});

// ============================================================
// aiStore → 고스트 브리지 (런타임 스트리밍 반영)
// ============================================================

// @MX:WARN: [AUTO] useAiStore.subscribe 구독은 뷰 파괴 시 반드시 해제해야 한다(리스너 누수 방지).
// @MX:REASON: [AUTO] 구독 해제 누락 시 파괴된 EditorView에 dispatch가 일어나 런타임 오류가 난다.
/**
 * section-fill 스트리밍 버퍼를 고스트 텍스트로 반영하는 뷰 플러그인.
 * useAiRelay(T-008)가 ai://chunk를 aiStore에 누적하면, 이 브리지가 그 값을 고스트로 미러링한다.
 * requestState(streaming/done)도 함께 실어 고스트 컨트롤 버튼([■ 중지] 대 [✓ 넣기]/[✕ 지우기])이
 * 올바른 단계를 렌더하게 한다(REQ-AI-029/030).
 */
const ghostStoreBridge = ViewPlugin.fromClass(
  class {
    private unsubscribe: () => void;
    // BUG-8: streaming → done 전환을 감지해 딱 1회만 스크롤한다(청크마다는 X). idle/error 로
    // 고스트가 사라지면 다음 시작을 위해 리셋한다.
    private lastStatus: 'streaming' | 'done' | null = null;

    constructor(view: EditorView) {
      this.unsubscribe = useAiStore.subscribe((s) => {
        // @MX:NOTE: [AUTO] 'section-fill' 하드코딩 = 섹션 채우기·문서 끝 이어쓰기·자유 위치
        // 이어쓰기(M2) 전부가 공유하는 하위호환 IPC 계약이다(feature 는 그대로, presetKind로만
        // 구분). 값을 바꾸려면 이 필터·aiStore AiFeature 유니온·ipc.ts를 동시에 수정해야 한다.
        // @MX:SPEC: SPEC-AI-003
        if (s.feature !== 'section-fill') return;
        if (s.requestState === 'streaming' || s.requestState === 'done') {
          const ghost = view.state.field(aiGhostField, false);
          if (ghost) {
            // 여러 StateEffect 타입(text/status/waiting/scroll)을 한 배열에 담으므로 공통
            // 타입으로 넓힌다.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const effects: StateEffect<any>[] = [
              setGhostTextEffect.of(s.streamBuffer),
              setGhostStatusEffect.of(s.requestState),
            ];
            // SPEC-AI-006 REQ-AI6-008: 첫 청크 도착·완료 시 대기 안내를 즉시 제거한다.
            if (s.streamBuffer.trim() !== '' || s.requestState === 'done') {
              clearGhostWaitNotice();
              effects.push(setGhostWaitingEffect.of(false));
            }
            // BUG-8: 스트리밍 완료(done) 전환 시에만 고스트 앵커를 뷰포트에 보이게 스크롤한다
            // — 컨트롤 버튼([✓ 넣기]/[✕ 지우기])이 뷰포트 밖에 떠 있지 않도록.
            if (s.requestState === 'done' && this.lastStatus !== 'done') {
              effects.push(EditorView.scrollIntoView(ghost.from, { y: 'nearest' }));
            }
            this.lastStatus = s.requestState;
            view.dispatch({ effects });
          }
        } else if (s.requestState === 'idle' || s.requestState === 'error') {
          this.lastStatus = null;
          clearGhostWaitNotice();
          if (view.state.field(aiGhostField, false)) {
            view.dispatch({ effects: clearGhostEffect.of(null) });
          }
        }
      });
    }

    update(_update: ViewUpdate): void {
      // 상태 미러링은 store 구독에서 처리한다.
    }

    destroy(): void {
      this.unsubscribe();
      // SPEC-AI-006 REQ-AI6-008: 언마운트 시 대기 안내 타이머 누수 방지.
      clearGhostWaitNotice();
    }
  },
);

/**
 * 섹션 채우기/이어쓰기 고스트 텍스트 확장 번들.
 * [HARD] Mod-Enter/Esc가 indentWithTab·defaultKeymap보다 앞서도록 Prec.high로 감싼다(REQ-AI-031).
 */
export function createAiGhostText(): Extension {
  return [
    aiGhostField,
    Prec.high(keymap.of(aiGhostKeymap)),
    ghostStoreBridge,
    createAiHint(),
    ghostTypingCancelListener,
    ghostWaitNoticeArmListener,
  ];
}
