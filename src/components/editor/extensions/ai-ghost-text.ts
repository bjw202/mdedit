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
import { aiRequest, aiCancel, ipcErrorMessage } from '@/lib/tauri/ipc';
import { useAiStore } from '@/store/aiStore';
import { useUIStore } from '@/store/uiStore';
import { resolveModel } from '@/components/settings/SettingsModal';

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
// 고스트 상태 — StateField + StateEffect (문서 텍스트 비오염, 뷰 레이어 전용)
// ============================================================

/** 고스트 값: 삽입 앵커 위치 + 현재까지 스트리밍된 텍스트 + 요청 상태(컨트롤 버튼 판정용). */
export interface GhostValue {
  from: number;
  text: string;
  /** streaming/done 판정 — 컨트롤 버튼([■ 중지] 대 [✓ 넣기]/[✕ 지우기]) 렌더에 사용(REQ-AI-029/030). */
  status?: 'streaming' | 'done';
}

/** 고스트 시작(앵커 고정, 텍스트 비움). */
export const startGhostEffect = StateEffect.define<{ from: number }>();
/** 스트리밍 텍스트 갱신(앵커 유지). */
export const setGhostTextEffect = StateEffect.define<string>();
/** 요청 상태 갱신(streaming/done) — 고스트 컨트롤 버튼 렌더 판정에만 쓰인다. */
export const setGhostStatusEffect = StateEffect.define<'streaming' | 'done'>();
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
      Decoration.widget({ widget: new GhostPlaceholderWidget(), side: 1 }).range(value.from),
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
  eq(other: WidgetType): boolean {
    return other instanceof GhostPlaceholderWidget;
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'mdedit-ai-ghost-placeholder';
    span.textContent = '✨ 작성 중…';
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
    }
    return wrap;
  }
  ignoreEvent(): boolean {
    return false;
  }
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
  view.dispatch({ effects: startGhostEffect.of({ from: head }) });

  // 백엔드 계약(team-lead 확정): outline = 전체 헤딩 아웃라인, contextBefore = 커서 앞 본문 꼬리.
  // 1.5K자 상한 절단은 백엔드가 수행하므로 프론트는 커서 앞 원문을 그대로 넘긴다(설계 §7). presetKind·selection 없음.
  const model = resolveModel(useUIStore.getState().aiAdvancedModel);
  void aiRequest({
    requestId,
    feature: 'section-fill',
    model,
    outline: ctx.outline.join('\n'),
    contextBefore: view.state.sliceDoc(0, head),
  }).catch((e) => useAiStore.getState().failRequest({ kind: 'other', message: ipcErrorMessage(e) }));
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
  view.dispatch({ effects: startGhostEffect.of({ from: head }) });

  const model = resolveModel(useUIStore.getState().aiAdvancedModel);
  void aiRequest({
    requestId,
    feature: 'section-fill',
    presetKind: 'continue',
    model,
    outline: ctx.outline.join('\n'),
    contextBefore: ctx.contextBefore,
  }).catch((e) => useAiStore.getState().failRequest({ kind: 'other', message: ipcErrorMessage(e) }));
  return true;
};

// @MX:NOTE: Mod-Enter는 고스트 활성 시 확정, 아니면 섹션 채우기/이어쓰기 트리거로 삼중 동작
// (설계 §5.1). Tab은 여기 바인딩하지 않는다 — indentWithTab이 처리하고 docChanged로 고스트가
// 소멸한다(REQ-AI-031).
const modEnterCommand: Command = (view) =>
  confirmGhostCommand(view) || startSectionFillCommand(view) || startContinueWritingCommand(view);

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
 * 힌트 노출 자격 판정(순수, 토큰 0) — getSectionFillContext/getContinueContext 외 어떤 부수효과도
 * 없다(REQ-AI-032). 커서 위치가 두 조건 모두를 만족할 수 없으므로(getContinueContext 가 이미
 * 섹션 채우기를 배제) 순서는 안전하다.
 */
export function evaluateHintEligibility(state: EditorState, pos: number): HintEligibility | null {
  if (getSectionFillContext(state, pos) !== null) return { kind: 'section-fill' };
  if (getContinueContext(state, pos) !== null) return { kind: 'continue' };
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
    if (this.view.state.field(aiGhostField, false)) return; // 고스트 활성 중엔 힌트 없음
    const pos = this.view.state.selection.main.head;
    if (!evaluateHintEligibility(this.view.state, pos)) return;
    this.timer = setTimeout(() => {
      this.timer = null;
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

    constructor(view: EditorView) {
      this.unsubscribe = useAiStore.subscribe((s) => {
        if (s.feature !== 'section-fill') return;
        if (s.requestState === 'streaming' || s.requestState === 'done') {
          if (view.state.field(aiGhostField, false)) {
            view.dispatch({
              effects: [setGhostTextEffect.of(s.streamBuffer), setGhostStatusEffect.of(s.requestState)],
            });
          }
        } else if (s.requestState === 'idle' || s.requestState === 'error') {
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
    }
  },
);

/**
 * 섹션 채우기/이어쓰기 고스트 텍스트 확장 번들.
 * [HARD] Mod-Enter/Esc가 indentWithTab·defaultKeymap보다 앞서도록 Prec.high로 감싼다(REQ-AI-031).
 */
export function createAiGhostText(): Extension {
  return [aiGhostField, Prec.high(keymap.of(aiGhostKeymap)), ghostStoreBridge, createAiHint()];
}
