// @MX:SPEC: SPEC-AI-001 REQ-AI-019 REQ-AI-020 REQ-AI-015 REQ-AI-026 REQ-AI-027
// @MX:NOTE: ✨ 선택 툴바 + 프리셋 메뉴(설계 §4.1). 선택 시 선택 끝에 ✨ 위젯을 띄우고,
// 클릭하면 프리셋 5종 + "직접 입력" 팝오버를 연다. 문서 텍스트는 건드리지 않고 뷰 레이어
// (Decoration.widget)에만 존재한다(설계 §4.3, image-widget.ts 선례). 프롬프트 조립·컨텍스트
// 절단은 전부 Rust 쪽이므로(설계 §3), 프론트는 선택 텍스트 + 문단 컨텍스트 조각만 넘긴다.
// 등록(markdown-extensions/keymap)은 후속 태스크에서 수행한다 — 이 파일은 확장 팩토리만 제공.

import { WidgetType, ViewPlugin, Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { evaluateSelectionGuard, formatCharCount, EDIT_LIMIT } from './ai-length-guard';
import type { AiPresetKind } from './ai-length-guard';
import { aiRequest, ipcErrorMessage } from '@/lib/tauri/ipc';
import type { AiModel, AiRequestArgs, DiagramType } from '@/lib/tauri/ipc';
import type { AiFeature } from '@/store/aiStore';
import { DIAGRAM_ICON_INNER } from '@/components/icons/diagramIconMarkup';
import { getClipBoundary, computeFlyoutOffset } from '@/lib/ui/menuPlacement';
import { useAiStore } from '@/store/aiStore';
import { useUIStore } from '@/store/uiStore';
import { getEffectiveAiEnabled, resolveProviderId } from '@/store/aiPolicy';
import { expandToSentenceBoundary, startSuggestionCard } from './ai-suggestion-card';

export type { AiPresetKind } from './ai-length-guard';

// ============================================================
// Types
// ============================================================

/** 로그인·고급모델 판정에 필요한 최소 UI 상태(주입 가능). */
export interface AiToolbarUiState {
  /** false 면 ✨ 클릭 시 "연결 필요" 상태 표시(REQ-AI-015). */
  loggedIn: boolean;
  /** true 면 sonnet, false 면 haiku(REQ-AI-016). */
  advancedModel: boolean;
  /**
   * effectiveAiEnabled(SPEC-AI-005 REQ-AI5-013) — false 면 ✨ 데코레이션 자체를 렌더하지
   * 않는다(REQ-AI5-007). 생략 시(undefined) 하위호환을 위해 true 로 취급한다.
   */
  enabled?: boolean;
}

/** UI 상태 주입 훅 — 테스트 스텁 및 후속 배선(T-018) 지점. */
export type GetUiState = () => AiToolbarUiState;

/** ✨ 툴바가 발행하는 요청 서술자. args 는 aiRequest() 로 그대로 전달한다. */
export interface AiSelectionRequest {
  /** ai_request 인자(설계 §3, ipc.ts). */
  args: AiRequestArgs;
  /** true 면 제안 카드에서 "바꾸기" 비활성, "아래에 삽입"만(REQ-AI-026). */
  insertOnly: boolean;
  /** 카드 적용 대상 범위(문장 경계 확장 반영, 설계 §4.3) — 제안 카드가 이 범위를 재검증·교체한다. */
  range: { from: number; to: number };
  /** range 의 원문 스냅샷 — 적용 직전 재검증 기준(REQ-AI-035). */
  originalText: string;
}

/** 프리셋 메뉴 항목의 렌더 상태(가드 반영). */
export interface PresetMenuItem {
  kind: AiPresetKind;
  /** 이모지 포함 표시 라벨(설계 §4.1). */
  label: string;
  /** true 면 선택 길이 초과로 비활성(REQ-AI-026). */
  disabled: boolean;
  /** true 면 변환 계열 삽입 전용(2K~4K 구간). */
  insertOnly: boolean;
  /** disabled 일 때 사용자 안내 문구(P7, 침묵 금지). */
  reason?: string;
}

/** buildSelectionRequest 입력. 컨텍스트는 상위에서 문단 경계로 추출해 넘긴다. */
export interface BuildSelectionRequestInput {
  requestId: string;
  presetKind: AiPresetKind;
  selection: string;
  contextBefore: string;
  contextAfter: string;
  model: AiModel;
  customInstruction?: string;
  /** 카드 적용 대상 범위(문장 경계 확장 반영). 생략 시 [0, selection.length]. */
  from?: number;
  to?: number;
  /** range 의 원문 스냅샷. 생략 시 selection. */
  originalText?: string;
  /** SPEC-AI-008: diagram 프리셋에서 고른 종류 제약. "자동"은 생략. */
  diagramType?: DiagramType;
  /**
   * SPEC-AI-009 REQ-AI9-003: AI provider 강제 라우팅. undefined → 백엔드 자동 감지.
   * 생략 시 buildSelectionRequest 는 resolveProviderId() 로 채운다(단일 소스).
   */
  providerId?: string;
}

/** 문단 경계로 잘라낸 선택 + 앞뒤 컨텍스트(설계 §7 인라인 편집). */
export interface ParagraphContext {
  selection: string;
  contextBefore: string;
  contextAfter: string;
}

/** ✨ 위젯이 클릭 시점에 참조하는 선택 스냅샷(text = 선택 텍스트). */
export interface SelectionSnapshot {
  text: string;
  contextBefore: string;
  contextAfter: string;
  /** 카드 적용 대상 범위(문장 경계 확장 반영, 설계 §4.3). */
  from: number;
  to: number;
  /** 확장 범위의 원문 스냅샷 — 적용 직전 재검증 기준(REQ-AI-035). */
  originalText: string;
}

/** ✨ 위젯이 클릭 시점에 참조하는 라이브 컨텍스트. */
export interface ToolbarContext {
  /** 현재 선택 스냅샷. collapsed 이면 null. */
  getSelection: () => SelectionSnapshot | null;
  getUiState: GetUiState;
  onRequest: (req: AiSelectionRequest) => void;
  onConnectNeeded: () => void;
}

/** createAiSelectionToolbar 설정(전부 선택). */
export interface AiSelectionToolbarConfig {
  getUiState?: GetUiState;
  onRequest?: (req: AiSelectionRequest) => void;
  onConnectNeeded?: () => void;
}

// ============================================================
// Pure helpers
// ============================================================

/** 프리셋 정의(설계 §4.1 순서 + 이모지 라벨). custom 은 항상 마지막. */
const PRESET_DEFS: readonly { kind: AiPresetKind; label: string }[] = [
  { kind: 'polish', label: '🖊 다듬기' },
  { kind: 'outline', label: '📋 개요로 정리' },
  { kind: 'table', label: '📊 표로 만들기' },
  { kind: 'diagram', label: '🧜 다이어그램으로' },
  { kind: 'shorten', label: '✂️ 짧게 줄이기' },
  { kind: 'custom', label: '✏️ 직접 입력...' },
];

const CUSTOM_PLACEHOLDER = '예: 영어로 번역해줘';
const PARAGRAPH_SEP = '\n\n';

/**
 * 선택 [from,to) 를 감싸는 문단 컨텍스트를 잘라낸다(설계 §7 "선택 영역 + 앞뒤 각 1문단").
 * 문단 경계는 빈 줄(\n\n) 또는 문서 시작/끝. 선택 텍스트는 절대 절단하지 않는다(REQ-AI-027).
 */
export function extractParagraphContext(doc: string, from: number, to: number): ParagraphContext {
  const sepBefore = doc.slice(0, from).lastIndexOf(PARAGRAPH_SEP);
  const paraStart = sepBefore === -1 ? 0 : sepBefore + PARAGRAPH_SEP.length;

  const sepAfter = doc.slice(to).indexOf(PARAGRAPH_SEP);
  const paraEnd = sepAfter === -1 ? doc.length : to + sepAfter;

  return {
    selection: doc.slice(from, to),
    contextBefore: doc.slice(paraStart, from),
    contextAfter: doc.slice(to, paraEnd),
  };
}

/** 프리셋 → AiFeature. 다이어그램만 전용 feature(mermaid 검증 경로), 나머지는 인라인 편집. */
export function presetToFeature(kind: AiPresetKind): AiFeature {
  return kind === 'diagram' ? 'diagram' : 'inline-edit';
}

// @MX:WARN: [AUTO] 이름 충돌 — 이 저장소에는 export 된 resolveModel 이 두 개 있고 시그니처가 다르다.
//   · 여기(ai-selection-toolbar.ts): resolveModel(uiState: AiToolbarUiState) — ✨ 툴바 전용, 호출처 1곳(아래 fire()).
//   · src/components/settings/SettingsModal.tsx: resolveModel(advanced: boolean) — ai-ghost-text.ts 가
//     import 해 3곳에서 호출한다.
//   두 함수는 서로 import 관계가 없다. 이름만 보고 한쪽을 고치면 다른 쪽은 그대로 남아 고스트/툴바의
//   모델 선택이 갈라진다. 통합·개명은 하지 말고(호출 계약이 다름) 양쪽을 함께 확인할 것.
// @MX:REASON: [AUTO] grep 한 번으로 두 정의의 호출처가 합산돼 fan_in 이 부풀고, 한쪽만 수정하면
//   나머지 경로는 조용히 옛 동작을 유지한다 — 타입이 달라 컴파일 오류로도 드러나지 않는다.
/** 고급 모델 토글 → 모델(REQ-AI-016). */
export function resolveModel(uiState: AiToolbarUiState): AiModel {
  return uiState.advancedModel ? 'sonnet' : 'haiku';
}

// @MX:ANCHOR: [AUTO] Rust 쪽 ai_request 로 넘어가는 인자 조립 지점 — 프런트/백엔드 경계의 단일 통로다.
//   불변식 3가지: (1) input.selection 은 절대 절단하지 않고 그대로 args.selection 에 싣는다(REQ-AI-027).
//   (2) range/originalText 는 카드가 [바꾸기] 직전 문서와 대조할 스냅샷이므로 선택 시점 값이어야 한다
//   (REQ-AI-035). (3) providerId 는 resolveProviderId() 단일 소스로만 채운다(REQ-AI9-003).
// @MX:REASON: [AUTO] (1)을 깨면 잘린 문장이 프롬프트에 실려 AI가 문맥 없는 답을 낸다. (2)를 깨면
//   요청 중 사용자가 편집한 문서에 옛 범위를 그대로 덮어써 남의 문장이 지워진다. (3)을 우회해 직접
//   지정하면 SPEC-AI-009 프로바이더 전환이 이 경로만 빠져 claude/codex 가 섞여 나간다.
// @MX:SPEC: SPEC-AI-001 SPEC-AI-009
/**
 * 선택 요청 서술자를 조립한다. customInstruction 은 custom 프리셋에서만 실린다.
 * insertOnly 는 선택 길이 가드(§4.4)에서 파생된다. 선택 텍스트는 그대로 담는다(절단 금지).
 */
export function buildSelectionRequest(input: BuildSelectionRequestInput): AiSelectionRequest {
  const guard = evaluateSelectionGuard(input.selection.length, input.presetKind);
  const args: AiRequestArgs = {
    requestId: input.requestId,
    feature: presetToFeature(input.presetKind),
    presetKind: input.presetKind,
    model: input.model,
    selection: input.selection,
    contextBefore: input.contextBefore,
    contextAfter: input.contextAfter,
  };
  if (input.presetKind === 'custom' && input.customInstruction) {
    args.customInstruction = input.customInstruction;
  }
  // SPEC-AI-008: diagram 종류 제약은 diagram 프리셋 + 종류 선택 시에만 실린다("자동"은 생략).
  if (input.presetKind === 'diagram' && input.diagramType) {
    args.diagramType = input.diagramType;
  }
  // SPEC-AI-009 REQ-AI9-003: providerId 는 단일 소스(resolveProviderId)에서 채운다.
  //   input.providerId 가 명시된 경우(테스트 주입 등) 그 값을 우선하고, 그 외에는 현재
  //   aiSelectedProvider 로 환원한다. undefined 면 백엔드가 자동 감지(claude > codex)한다.
  args.providerId = input.providerId ?? resolveProviderId();
  const from = input.from ?? 0;
  const to = input.to ?? input.selection.length;
  return {
    args,
    insertOnly: guard.insertOnly,
    range: { from, to },
    originalText: input.originalText ?? input.selection,
  };
}

/** 선택 길이로 프리셋 메뉴 항목 상태를 계산한다(가드 반영, REQ-AI-026). */
export function buildPresetMenuItems(selectionLength: number): PresetMenuItem[] {
  return PRESET_DEFS.map(({ kind, label }) => {
    const guard = evaluateSelectionGuard(selectionLength, kind);
    return {
      kind,
      label,
      disabled: !guard.allowed,
      insertOnly: guard.insertOnly,
      reason: guard.reason,
    };
  });
}

/** 프리셋 메뉴 상단 항상-보이는 안내 줄(REQ-AI7-004/005). null 이면 안내 줄 없음(메뉴 무변경). */
export interface PresetMenuNotice {
  tone: 'block' | 'partial';
  text: string;
}

/**
 * 삽입 전용 구간(2,001~4,000자) 안내 문구 — 가드는 이 구간에서 reason 을 반환하지 않으므로
 * 툴바가 소유(D2). 차단 구간과 마찬가지로 현재 글자 수와 한도를 함께 보여준다.
 */
function buildMenuNoticePartial(selectionLength: number): string {
  return (
    `지금 ${formatCharCount(selectionLength)}자예요 — ${formatCharCount(EDIT_LIMIT)}자가 넘어서 다듬기·직접 입력은 쓸 수 없어요. ` +
    '개요·표·다이어그램·짧게는 되지만, 원문이 지워지지 않도록 결과를 「아래에 삽입」만 할 수 있어요.'
  );
}

/**
 * @MX:NOTE: 선택 길이 가드(ai-length-guard.ts)에서 안내 구간을 파생하는 단일 소스 헬퍼(REQ-AI7-004).
 * 2,000/4,000 임계를 여기 복제하지 않고, 편집 대표(polish)·변환 대표(outline) 두 프리셋에 대한
 * evaluateSelectionGuard 결과 조합으로만 구간을 판정한다. too-long 문구는 가드 reason 을 그대로
 * 재사용해 문자열 드리프트를 차단한다(D1).
 */
export function evaluateMenuNotice(selectionLength: number): PresetMenuNotice | null {
  const edit = evaluateSelectionGuard(selectionLength, 'polish');
  const transform = evaluateSelectionGuard(selectionLength, 'outline');

  if (edit.allowed) return null;
  if (!transform.allowed) return { tone: 'block', text: transform.reason ?? '' };
  if (transform.insertOnly) {
    return { tone: 'partial', text: buildMenuNoticePartial(selectionLength) };
  }
  return null;
}

/** 요청 id 생성 — crypto.randomUUID 우선, 미지원 환경은 타임스탬프 폴백. */
export function generateRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ============================================================
// Preset menu (popover DOM)
// ============================================================

export interface PresetMenuCallbacks {
  /**
   * 활성 프리셋 선택(비활성 항목 클릭은 무시). SPEC-AI-008: diagram 은 서브메뉴에서 종류를
   * 골라 선택되며, "자동"은 diagramType 없이, 종류는 diagramType 을 실어 호출한다.
   */
  onSelectPreset: (kind: AiPresetKind, diagramType?: DiagramType) => void;
  /** 직접 입력 제출(trim 후 비어있지 않을 때만). */
  onSubmitCustom: (instruction: string) => void;
  /** 프리셋 목록에서 Esc / 외부 클릭으로 닫기. */
  onClose: () => void;
}

// @MX:NOTE: [AUTO] SPEC-AI-008 다이어그램 플라이아웃 서브메뉴 항목(8개 고정). "자동 (AI 판단)"이
// 첫 항목·기본(종류 없음=오늘 동작), 이어 7종. 라벨은 SPEC-UI-008 수동 삽입 라벨을 재사용하고,
// 아이콘은 diagramIconMarkup 단일 소스를 명령형 DOM 으로 주입한다(REQ-001/002/004/023).
// @MX:SPEC: SPEC-AI-008
const DIAGRAM_SUBMENU_DEFS: readonly { type: DiagramType | null; label: string }[] = [
  { type: null, label: '자동 (AI 판단)' },
  { type: 'flowchart', label: '순서도' },
  { type: 'sequenceDiagram', label: '시퀀스 다이어그램' },
  { type: 'gantt', label: '간트 차트' },
  { type: 'classDiagram', label: '클래스 다이어그램' },
  { type: 'stateDiagram', label: '상태 다이어그램' },
  { type: 'pie', label: '파이 차트' },
  { type: 'mindmap', label: '마인드맵' },
];

/** 플라이아웃과 앵커(wrap) 사이 간격(px) — CSS margin var(--md-space-1) 과 동일. */
const SUBMENU_GAP = 4;

// @MX:NOTE: [AUTO] SPEC-AI-008 후속(실기기 결함): 좁은/넓은 창 모두에서 클리핑 경계 인지 배치.
// 기본은 부모 메뉴 오른쪽·상단 정렬로 열고, 레이아웃 커밋 다음 프레임(rAF)에 측정한다. 경계는 창이
// 아니라 실효 클리핑 경계(getClipBoundary, 에디터 패널 overflow:hidden) — 넓은 창이라도 패널 밖으로
// 잘린다. 측 선택(flip)만으로는 부족해(뒤집어도 반대편 경계를 넘을 수 있음), computeFlyoutOffset 이
// flip→clamp 를 한 번에 계산한 오프셋을 inline style 로 적용한다. 경계가 서브메뉴보다 작으면
// max-height + overflow-y 로 스크롤 가드를 건다.
// @MX:SPEC: SPEC-AI-008
function scheduleSubmenuFlipMeasurement(sub: HTMLElement, trigger: HTMLElement): void {
  requestAnimationFrame(() => {
    // 앵커=서브메뉴의 containing block(=offsetParent, .mdedit-ai-diagram-wrap). 없으면 트리거 부모.
    const anchorEl = (sub.offsetParent as HTMLElement | null) ?? trigger.parentElement;
    if (!anchorEl) return;
    const anchor = anchorEl.getBoundingClientRect();
    const subRect = sub.getBoundingClientRect();
    const clip = getClipBoundary(sub);
    const off = computeFlyoutOffset(
      { left: anchor.left, top: anchor.top, right: anchor.right, bottom: anchor.bottom },
      { width: subRect.width, height: subRect.height },
      clip,
      SUBMENU_GAP,
    );
    sub.style.left = `${off.left}px`;
    sub.style.top = `${off.top}px`;
    sub.style.right = 'auto';
    sub.style.bottom = 'auto';
    sub.style.marginLeft = '0';
    sub.style.marginRight = '0';
    // 경계가 서브메뉴보다 낮으면(담을 수 없음) 스크롤 가드로 잘림 대신 스크롤.
    const availH = clip.bottom - clip.top;
    if (subRect.height > availH) {
      sub.style.maxHeight = `${Math.max(0, availH)}px`;
      sub.style.overflowY = 'auto';
    }
  });
}

export interface PresetMenuOptions {
  selectionLength: number;
  callbacks: PresetMenuCallbacks;
  /** BUG-9: 뷰포트 아래쪽 공간이 부족할 때 flip 판정에 쓸 앵커(✨ 버튼). 없으면 측정을 생략한다. */
  anchorEl?: HTMLElement;
}

export interface PresetMenuHandle {
  dom: HTMLElement;
  destroy: () => void;
}

// ============================================================
// Popover flip (BUG-9) — 뷰포트 아래쪽 공간이 부족하면 위로 뒤집는다
// ============================================================

export type MenuFlipDirection = 'above' | 'below';

export interface MenuFlipInput {
  /** 앵커 아래쪽 뷰포트 여유 공간(px). */
  spaceBelow: number;
  /** 앵커 위쪽 뷰포트 여유 공간(px). */
  spaceAbove: number;
  /** 메뉴 전체 높이(px). */
  menuHeight: number;
}

/**
 * 표준 popover flip 판정(순수). 아래 공간이 메뉴 높이 이상이면 그대로 아래, 부족하면 위쪽
 * 공간이 더 넓을 때만 위로 뒤집는다 — 양쪽 다 부족하면(둘 다 못 담아도) 기본값인 아래를 유지한다.
 */
export function decideMenuFlipDirection({
  spaceBelow,
  spaceAbove,
  menuHeight,
}: MenuFlipInput): MenuFlipDirection {
  if (spaceBelow >= menuHeight) return 'below';
  return spaceAbove > spaceBelow ? 'above' : 'below';
}

export type MenuHorizontalDirection = 'start' | 'end';

export interface MenuHorizontalInput {
  /** 메뉴 왼쪽 모서리(=앵커 left)부터 클리핑 경계 오른쪽까지의 여유 공간(px). */
  spaceRight: number;
  /** 클리핑 경계 왼쪽부터 메뉴 오른쪽 모서리(=앵커 right)까지의 여유 공간(px). */
  spaceLeft: number;
  /** 메뉴 전체 너비(px). */
  menuWidth: number;
}

/**
 * 가로 flip 판정(순수) — decideMenuFlipDirection 의 가로 대칭판(BUG-2). 오른쪽 공간이 메뉴 너비
 * 이상이면 기본값인 좌측 정렬을 유지하고, 부족하면 왼쪽 공간이 더 넓을 때만 우측 정렬로 뒤집는다.
 * 양쪽 다 부족하면 기본값(좌측 정렬)을 유지한다.
 */
export function decideMenuHorizontalDirection({
  spaceRight,
  spaceLeft,
  menuWidth,
}: MenuHorizontalInput): MenuHorizontalDirection {
  if (spaceRight >= menuWidth) return 'start';
  return spaceLeft > spaceRight ? 'end' : 'start';
}

/** flip 판정에 쓰이는 CSS 클래스 — 아래 열림(기본)과 대칭 배치를 담당(mdedit-components.css). */
const MENU_ABOVE_CLASS = 'mdedit-ai-preset-menu--above';

/** 가로 flip 클래스 — 좌측 정렬(기본)과 대칭으로 우측 정렬시킨다. */
const MENU_END_CLASS = 'mdedit-ai-preset-menu--end';

const CLIPPING_OVERFLOW = new Set(['auto', 'scroll', 'hidden', 'clip']);

/**
 * 메뉴를 가로로 잘라내는 가장 가까운 조상을 찾는다(BUG-2). 세로와 달리 가로 잘림의 경계는
 * 뷰포트가 아니다 — 에디터 패널 래퍼(overflow-hidden)와 CodeMirror 스크롤러(overflow:auto)가
 * 스플리터 위치에서 메뉴를 자르며, 그 오른쪽 모서리는 뷰포트 오른쪽보다 한참 왼쪽에 있다.
 * 없으면 null 을 돌려 호출자가 뷰포트로 폴백한다.
 */
function findClippingAncestor(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (CLIPPING_OVERFLOW.has(style.overflowX) || CLIPPING_OVERFLOW.has(style.overflow)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * anchorEl 기준으로 메뉴가 열릴 방향을 세로·가로 모두 측정해 flip 클래스를 토글한다(BUG-9, BUG-2).
 * 레이아웃이 커밋된 다음 프레임에 측정해야 정확한 rect 를 얻을 수 있어 requestAnimationFrame 으로
 * 미룬다. 두 방향을 같은 rAF 패스에서 처리해 강제 리플로우를 한 번으로 유지한다.
 *
 * 경계 선택이 방향마다 다르다: 세로는 뷰포트(window.innerHeight)로 충분하지만, 가로는 메뉴를 실제로
 * 자르는 것이 뷰포트가 아니라 에디터 패널이므로 클리핑 조상의 rect 를 써야 한다(BUG-2). 조상이
 * 없으면 뷰포트로 폴백한다.
 */
function scheduleMenuFlipMeasurement(dom: HTMLElement, anchorEl: HTMLElement): void {
  requestAnimationFrame(() => {
    const anchorRect = anchorEl.getBoundingClientRect();
    const menuRect = dom.getBoundingClientRect();

    const direction = decideMenuFlipDirection({
      spaceBelow: window.innerHeight - anchorRect.bottom,
      spaceAbove: anchorRect.top,
      menuHeight: menuRect.height,
    });
    dom.classList.toggle(MENU_ABOVE_CLASS, direction === 'above');

    // 메뉴는 래퍼(.mdedit-ai-toolbar, position:relative)에 left:0 으로 붙으므로 왼쪽 모서리는
    // 앵커 left 와, 뒤집힌 뒤(right:0) 오른쪽 모서리는 앵커 right 와 사실상 일치한다.
    const clipRect = findClippingAncestor(dom)?.getBoundingClientRect();
    const horizontal = decideMenuHorizontalDirection({
      spaceRight: (clipRect ? clipRect.right : window.innerWidth) - anchorRect.left,
      spaceLeft: anchorRect.right - (clipRect ? clipRect.left : 0),
      menuWidth: menuRect.width,
    });
    dom.classList.toggle(MENU_END_CLASS, horizontal === 'end');
  });
}

/**
 * 프리셋 팝오버를 만든다(설계 §4.1). TableGridPicker 선례(외부 mousedown + Esc 닫기)를 따르되,
 * 외부 클릭 처리는 위젯(호출자)이 담당하고 여기서는 목록 ↔ 직접 입력 morph 와 Esc/← 복귀만 관리한다.
 */
export function createPresetMenu(options: PresetMenuOptions): PresetMenuHandle {
  const { selectionLength, callbacks, anchorEl } = options;
  const items = buildPresetMenuItems(selectionLength);

  const dom = document.createElement('div');
  dom.className = 'mdedit-ai-preset-menu';
  dom.tabIndex = -1;

  let mode: 'presets' | 'custom-input' = 'presets';

  // @MX:NOTE: [AUTO] SPEC-AI-008: 다이어그램 플라이아웃 서브메뉴 상태(명령형 DOM). diagram 항목
  // hover/클릭이 이 서브메뉴를 열고, Esc 는 서브메뉴만 닫아 목록으로 복귀한다. 외부 mousedown/
  // 메뉴 파기(destroy)는 위젯 경로가 dom 을 제거하므로 서브메뉴도 함께 사라진다(리스너 누수 없음).
  // @MX:SPEC: SPEC-AI-008
  let diagramSubmenu: HTMLElement | null = null;
  let diagramTrigger: HTMLButtonElement | null = null;

  const buildDiagramIcon = (type: DiagramType): SVGSVGElement => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    // 단일 소스 마크업 주입(REQ-023) — path 데이터를 여기 다시 타이핑하지 않는다.
    svg.innerHTML = DIAGRAM_ICON_INNER[type];
    return svg;
  };

  const closeDiagramSubmenu = (returnFocus = false): void => {
    diagramSubmenu?.remove();
    diagramSubmenu = null;
    if (diagramTrigger) {
      diagramTrigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) diagramTrigger.focus();
    }
  };

  const openDiagramSubmenu = (): void => {
    if (diagramSubmenu || !diagramTrigger) return;
    const sub = document.createElement('div');
    sub.className = 'mdedit-ai-diagram-submenu';
    sub.setAttribute('role', 'menu');
    DIAGRAM_SUBMENU_DEFS.forEach((def) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'mdedit-ai-diagram-submenu-item';
      item.setAttribute('role', 'menuitem');
      item.setAttribute('aria-label', def.label);
      if (def.type === null) {
        item.dataset.diagramAuto = 'true';
      } else {
        item.dataset.diagramType = def.type;
        item.appendChild(buildDiagramIcon(def.type));
      }
      const labelEl = document.createElement('span');
      labelEl.className = 'mdedit-ai-diagram-submenu-label';
      labelEl.textContent = def.label;
      item.appendChild(labelEl);
      // "자동" → 종류 없이 발행(REQ-008), 종류 → diagramType 실어 발행(REQ-009).
      item.addEventListener('click', () => {
        callbacks.onSelectPreset('diagram', def.type ?? undefined);
      });
      sub.appendChild(item);
    });
    diagramTrigger.parentElement?.appendChild(sub);
    diagramTrigger.setAttribute('aria-expanded', 'true');
    diagramSubmenu = sub;
    // 좁은 창에서 오른쪽/아래로 잘리면 왼쪽 열림·위로 끌어올림으로 뒤집는다(다음 프레임 측정).
    scheduleSubmenuFlipMeasurement(sub, diagramTrigger);
  };

  const renderPresets = (): void => {
    // 재렌더는 이전 서브메뉴 DOM/참조를 버린다 — 상태를 초기화하고 트리거를 새로 바인딩한다.
    diagramSubmenu = null;
    diagramTrigger = null;
    dom.replaceChildren();

    // REQ-AI7-001/002/003/005: 가드가 현재 선택에 영향을 주는 구간에서만 항상-보이는 안내 줄을
    // 목록 위에 마운트한다. per-item title/aria-disabled(아래)는 그대로 유지(추가 표면일 뿐).
    const notice = evaluateMenuNotice(selectionLength);
    if (notice) {
      const noticeEl = document.createElement('div');
      noticeEl.className = 'mdedit-ai-preset-notice';
      noticeEl.dataset.tone = notice.tone;
      noticeEl.textContent = notice.text;
      dom.appendChild(noticeEl);
    }

    const list = document.createElement('div');
    list.className = 'mdedit-ai-preset-list';

    items.forEach((item, index) => {
      // 설계 §4.1: 프리셋 5종과 "직접 입력" 사이에 구분선.
      if (item.kind === 'custom' && index > 0) {
        const hr = document.createElement('hr');
        hr.className = 'mdedit-ai-preset-sep';
        list.appendChild(hr);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mdedit-ai-preset-item';
      btn.dataset.preset = item.kind;
      btn.textContent = item.label;
      btn.disabled = item.disabled;
      if (item.disabled && item.reason) {
        btn.title = item.reason;
        btn.setAttribute('aria-disabled', 'true');
      }

      // SPEC-AI-008: diagram 항목은 즉시 발행이 아니라 종류 플라이아웃 서브메뉴를 연다.
      if (item.kind === 'diagram') {
        btn.setAttribute('aria-haspopup', 'true');
        btn.setAttribute('aria-expanded', 'false');
        const wrap = document.createElement('div');
        wrap.className = 'mdedit-ai-diagram-wrap';
        wrap.appendChild(btn);
        if (!item.disabled) {
          diagramTrigger = btn;
          // SPEC-AI-011: hover 도 클릭도 열기 전용(open-only) — 이미 열려 있으면 무변경(REQ-001/002).
          btn.addEventListener('mouseenter', () => openDiagramSubmenu());
          btn.addEventListener('click', () => openDiagramSubmenu());
        }
        list.appendChild(wrap);
        return;
      }

      btn.addEventListener('click', () => {
        if (item.disabled) return;
        if (item.kind === 'custom') {
          setMode('custom-input');
          return;
        }
        callbacks.onSelectPreset(item.kind);
      });
      list.appendChild(btn);
    });

    dom.appendChild(list);
  };

  const renderCustomInput = (): void => {
    dom.replaceChildren();
    const row = document.createElement('div');
    row.className = 'mdedit-ai-custom-row';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'mdedit-ai-back';
    back.setAttribute('aria-label', '프리셋으로 돌아가기');
    back.textContent = '←';
    back.addEventListener('click', () => setMode('presets'));

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'mdedit-ai-custom-input';
    input.placeholder = CUSTOM_PLACEHOLDER;
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const value = input.value.trim();
        if (value) callbacks.onSubmitCustom(value);
      }
    });

    row.appendChild(back);
    row.appendChild(input);
    dom.appendChild(row);
    input.focus();
  };

  const setMode = (next: 'presets' | 'custom-input'): void => {
    mode = next;
    if (next === 'presets') renderPresets();
    else renderCustomInput();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    // SPEC-AI-008: 서브메뉴가 열려 있으면 서브메뉴만 닫고 목록으로 복귀(툴바 유지, REQ-011).
    if (diagramSubmenu) {
      event.stopPropagation();
      closeDiagramSubmenu(true);
      return;
    }
    if (mode === 'custom-input') {
      // Esc / ← 는 프리셋 목록으로 복귀(설계 §4.1) — 메뉴를 닫지 않는다.
      event.stopPropagation();
      setMode('presets');
    } else {
      callbacks.onClose();
    }
  };

  dom.addEventListener('keydown', handleKeyDown);
  renderPresets();

  // BUG-9: 앵커가 뷰포트 아래쪽에 있어 아래로 열 공간이 부족하면 위로 뒤집는다. 호출자가
  // dom 을 문서에 붙인 뒤 레이아웃이 커밋될 다음 프레임에 측정한다.
  if (anchorEl) scheduleMenuFlipMeasurement(dom, anchorEl);

  return {
    dom,
    destroy: () => {
      // SPEC-AI-008: 열린 서브메뉴도 함께 정리(REQ-015, 누수 없음).
      closeDiagramSubmenu();
      dom.removeEventListener('keydown', handleKeyDown);
      dom.remove();
    },
  };
}

// ============================================================
// ✨ Sparkle widget
// ============================================================

/**
 * 선택 끝에 뜨는 ✨ 버튼 위젯(설계 §4.1, image-widget.ts WidgetType 선례).
 * 클릭 시 미로그인이면 "연결 필요"를, 로그인 상태면 프리셋 팝오버를 연다.
 */
export class AiSparkleWidget extends WidgetType {
  /** in-flight pulse(REQ-AI2-008) 구독 해제 — destroy() 에서 정리한다. */
  private unsubscribePulse: (() => void) | null = null;

  constructor(
    private readonly ctx: ToolbarContext,
    /** 선택 범위 키(from:to) — eq 비교로 선택 변경 시 위젯 재생성. */
    private readonly selKey: string,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return other instanceof AiSparkleWidget && other.selKey === this.selKey;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'mdedit-ai-toolbar';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mdedit-ai-sparkle-btn';
    btn.setAttribute('aria-label', 'AI로 편집');
    btn.title = 'AI로 편집';
    btn.textContent = '✨';

    // REQ-AI2-008(선택): 요청이 in-flight(streaming)인 동안 ✨ 버튼이 pulse 한다. CSS 전용
    // 애니메이션 클래스만 토글하고, 요청 종료 시 제거한다.
    const updatePulse = (): void => {
      btn.classList.toggle('is-pulsing', useAiStore.getState().requestState === 'streaming');
    };
    updatePulse();
    this.unsubscribePulse = useAiStore.subscribe(updatePulse);

    let menu: PresetMenuHandle | null = null;
    let connectHint: HTMLElement | null = null;
    let onOutsideMouseDown: ((event: MouseEvent) => void) | null = null;

    const closeMenu = (): void => {
      menu?.destroy();
      menu = null;
      if (onOutsideMouseDown) {
        document.removeEventListener('mousedown', onOutsideMouseDown);
        onOutsideMouseDown = null;
      }
    };

    const clearConnectHint = (): void => {
      connectHint?.remove();
      connectHint = null;
    };

    const fire = (
      presetKind: AiPresetKind,
      customInstruction?: string,
      diagramType?: DiagramType,
    ): void => {
      const sel = this.ctx.getSelection();
      if (!sel) return;
      const model = resolveModel(this.ctx.getUiState());
      const req = buildSelectionRequest({
        requestId: generateRequestId(),
        presetKind,
        selection: sel.text,
        contextBefore: sel.contextBefore,
        contextAfter: sel.contextAfter,
        model,
        customInstruction,
        diagramType,
        from: sel.from,
        to: sel.to,
        originalText: sel.originalText,
      });
      this.ctx.onRequest(req);
      closeMenu();
    };

    btn.addEventListener('click', () => {
      clearConnectHint();
      if (menu) {
        closeMenu();
        return;
      }

      // REQ-AI-015: 미로그인 시 ✨ 를 숨기지 않고 "연결 필요"로 안내한다.
      if (!this.ctx.getUiState().loggedIn) {
        connectHint = document.createElement('div');
        connectHint.className = 'mdedit-ai-connect-hint';
        connectHint.textContent = '연결 필요';
        wrapper.appendChild(connectHint);
        this.ctx.onConnectNeeded();
        return;
      }

      const sel = this.ctx.getSelection();
      const selectionLength = sel ? sel.text.length : 0;
      menu = createPresetMenu({
        selectionLength,
        callbacks: {
          // SPEC-AI-008: diagram 서브메뉴에서 온 종류를 그대로 실어 발행한다("자동"=undefined).
          onSelectPreset: (kind, diagramType) => fire(kind, undefined, diagramType),
          onSubmitCustom: (instruction) => fire('custom', instruction),
          onClose: closeMenu,
        },
        // BUG-9: ✨ 버튼을 앵커로 flip 측정(문서/뷰포트 아래쪽 트리거 시 메뉴가 위로 뒤집힌다).
        anchorEl: btn,
      });
      wrapper.appendChild(menu.dom);

      // 외부 mousedown 닫기(TableGridPicker 선례). 열림 이후에 등록한다.
      onOutsideMouseDown = (event: MouseEvent) => {
        if (!wrapper.contains(event.target as Node)) closeMenu();
      };
      document.addEventListener('mousedown', onOutsideMouseDown);
    });

    wrapper.appendChild(btn);
    return wrapper;
  }

  ignoreEvent(): boolean {
    // 위젯 내부 버튼/메뉴 상호작용은 에디터로 흘려보내지 않는다.
    return true;
  }

  destroy(): void {
    this.unsubscribePulse?.();
    this.unsubscribePulse = null;
  }
}

// ============================================================
// Extension factory
// ============================================================

/** uiStore 에서 로그인·고급모델 상태를 읽는 기본 구현. 로그인 감지 배선은 후속(T-018). */
const defaultGetUiState: GetUiState = () => {
  const ui = useUIStore.getState() as unknown as {
    aiLoggedIn?: boolean;
    aiAdvancedModel?: boolean;
  };
  return {
    // 감지 스토어는 후속 태스크에서 붙는다 — 그전까지는 사용 가능으로 가정하고, 실제 게이팅은
    // 주입된 getUiState 로 수행한다(테스트가 양쪽 분기를 검증). advancedModel 은 T-011 이 uiStore 에
    // 추가하는 aiAdvancedModel 토글을 읽는다.
    loggedIn: ui.aiLoggedIn !== false,
    advancedModel: ui.aiAdvancedModel === true,
    // SPEC-AI-005: effectiveAiEnabled = !policyDisabled && userAiEnabled(REQ-AI5-013).
    enabled: getEffectiveAiEnabled(),
  };
};

/**
 * 기본 요청 발행 — aiStore 를 streaming 으로 전이하고, 요청 범위에 바인딩된 스트리밍 제안 카드를
 * 띄운 뒤 IPC 를 스폰한다(설계 §3/§4.2). startSuggestionCard 가 aiStore 구독으로 델타를 카드에
 * 반영하고, 카드의 [바꾸기]/[아래삽입]은 req.range 를 재검증·교체한다(REQ-AI-035).
 */
const defaultOnRequest = (req: AiSelectionRequest): void => {
  const store = useAiStore.getState();
  store.startRequest(req.args.requestId, req.args.feature);
  store.incrementCount();
  startSuggestionCard(req);
  // 오류는 useAiRelay 가 ai://error 로 수신 → aiStore → 카드로 표시한다(REQ-AI-004). invoke 자체
  // 거부(정책·도구 없음·스크래치 폴더 등)는 분류된 사유를 그대로 카드에 노출한다(P7, REQ-AI-040).
  void aiRequest(req.args).catch((e) =>
    useAiStore.getState().failRequest({ kind: 'other', message: ipcErrorMessage(e) }),
  );
};

// @MX:ANCHOR: [AUTO] ✨ 데코레이션의 유일한 생성 지점(플러그인 생성자·update 두 경로가 모두 여기로
//   수렴). 불변식: 위젯을 만들기 전에 반드시 getUiState().enabled === false 를 먼저 검사해 조기 반환한다
//   (REQ-AI5-007). enabled 가 undefined 인 경우에만 하위호환으로 활성 취급한다(REQ-AI5-015).
// @MX:REASON: [AUTO] 이 게이트는 AI 비활성(사용자 토글 또는 정책 차단) 상태에서 AI 진입점을 화면에서
//   완전히 없애는 유일한 수단이다. 위젯 내부에서 늦게 검사하도록 옮기면 정책상 AI가 금지된 환경에서도
//   ✨ 가 렌더돼 클릭 한 번으로 요청이 나간다 — 숨김이 아니라 미렌더여야 한다.
// @MX:SPEC: SPEC-AI-005
/** 선택 끝(to)에 side:1 위젯 하나를 배치. collapsed 이면 데코 없음. */
export function buildToolbarDecorations(
  view: EditorView,
  config: AiSelectionToolbarConfig,
): DecorationSet {
  const { from, to } = view.state.selection.main;
  if (from === to) return Decoration.none;

  const getUiState = config.getUiState ?? defaultGetUiState;
  // SPEC-AI-005 REQ-AI5-007: effectiveAiEnabled 가 거짓이면 ✨ 데코레이션 자체를 렌더하지 않는다.
  // enabled 가 생략(undefined)되면 하위호환을 위해 활성으로 취급한다(REQ-AI5-015).
  if (getUiState().enabled === false) return Decoration.none;

  const ctx: ToolbarContext = {
    getSelection: () => {
      const sel = view.state.selection.main;
      if (sel.from === sel.to) return null;
      const doc = view.state.doc.toString();
      const ctxParts = extractParagraphContext(doc, sel.from, sel.to);
      // 카드 교체 범위는 문장 경계까지 확장한다(설계 §4.3) — 잘린 어미 충돌 방지.
      const expanded = expandToSentenceBoundary(doc, sel.from, sel.to);
      return {
        text: ctxParts.selection,
        contextBefore: ctxParts.contextBefore,
        contextAfter: ctxParts.contextAfter,
        from: expanded.from,
        to: expanded.to,
        originalText: doc.slice(expanded.from, expanded.to),
      };
    },
    getUiState,
    onRequest: config.onRequest ?? defaultOnRequest,
    onConnectNeeded: config.onConnectNeeded ?? (() => undefined),
  };

  const widget = new AiSparkleWidget(ctx, `${from}:${to}`);
  return Decoration.set([Decoration.widget({ widget, side: 1 }).range(to)]);
}

/**
 * ✨ 선택 툴바 확장(설계 §4.1). 선택이 생기면 선택 끝에 ✨ 위젯을 띄운다.
 * markdown-extensions.ts 등록은 후속 태스크에서 수행한다(고스트 태스크와의 충돌 회피).
 */
export function createAiSelectionToolbar(config: AiSelectionToolbarConfig = {}): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildToolbarDecorations(view, config);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet) {
          this.decorations = buildToolbarDecorations(update.view, config);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );
}
