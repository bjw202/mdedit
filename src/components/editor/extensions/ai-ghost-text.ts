// @MX:ANCHOR: [AUTO] createAiGhostText - 섹션 채우기 고스트 텍스트 확장(힌트·스트리밍·확정)
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
import type { EditorState, Extension } from '@codemirror/state';
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

// ============================================================
// 고스트 상태 — StateField + StateEffect (문서 텍스트 비오염, 뷰 레이어 전용)
// ============================================================

/** 고스트 값: 삽입 앵커 위치 + 현재까지 스트리밍된 텍스트. */
export interface GhostValue {
  from: number;
  text: string;
}

/** 고스트 시작(앵커 고정, 텍스트 비움). */
export const startGhostEffect = StateEffect.define<{ from: number }>();
/** 스트리밍 텍스트 갱신(앵커 유지). */
export const setGhostTextEffect = StateEffect.define<string>();
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

/** 고스트 값 → 데코레이션 세트(회색 인라인 위젯). */
function ghostDecorations(value: GhostValue | null): DecorationSet {
  if (!value || !value.text) return Decoration.none;
  const widget = Decoration.widget({
    widget: new GhostWidget(value.text),
    side: 1,
  });
  return Decoration.set([widget.range(value.from)]);
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

/** 고스트를 버린다([지우기]/Esc). 스트리밍 중이면 in-flight 요청도 취소한다(REQ-AI-005). */
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

// @MX:NOTE: Mod-Enter는 고스트 활성 시 확정, 아니면 섹션 채우기 트리거로 이중 동작(설계 §5.1).
// Tab은 여기 바인딩하지 않는다 — indentWithTab이 처리하고 docChanged로 고스트가 소멸한다(REQ-AI-031).
const modEnterCommand: Command = (view) => confirmGhostCommand(view) || startSectionFillCommand(view);

/** AI 고스트 keymap. indentWithTab보다 앞서 등록해야 Mod-Enter/Esc가 선점된다. */
export const aiGhostKeymap: KeyBinding[] = [
  { key: 'Mod-Enter', run: modEnterCommand, preventDefault: true },
  { key: 'Escape', run: dismissGhostCommand },
];

// ============================================================
// aiStore → 고스트 브리지 (런타임 스트리밍 반영)
// ============================================================

// @MX:WARN: [AUTO] useAiStore.subscribe 구독은 뷰 파괴 시 반드시 해제해야 한다(리스너 누수 방지).
// @MX:REASON: [AUTO] 구독 해제 누락 시 파괴된 EditorView에 dispatch가 일어나 런타임 오류가 난다.
/**
 * section-fill 스트리밍 버퍼를 고스트 텍스트로 반영하는 뷰 플러그인.
 * useAiRelay(T-008)가 ai://chunk를 aiStore에 누적하면, 이 브리지가 그 값을 고스트로 미러링한다.
 */
const ghostStoreBridge = ViewPlugin.fromClass(
  class {
    private unsubscribe: () => void;

    constructor(view: EditorView) {
      this.unsubscribe = useAiStore.subscribe((s) => {
        if (s.feature !== 'section-fill') return;
        if (s.requestState === 'streaming' || s.requestState === 'done') {
          if (view.state.field(aiGhostField, false)) {
            view.dispatch({ effects: setGhostTextEffect.of(s.streamBuffer) });
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
 * 섹션 채우기 고스트 텍스트 확장 번들.
 * [HARD] Mod-Enter/Esc가 indentWithTab·defaultKeymap보다 앞서도록 Prec.high로 감싼다(REQ-AI-031).
 */
export function createAiGhostText(): Extension {
  return [aiGhostField, Prec.high(keymap.of(aiGhostKeymap)), ghostStoreBridge];
}
