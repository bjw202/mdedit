// @MX:SPEC: SPEC-AI-001 REQ-AI-019 REQ-AI-020 REQ-AI-015 REQ-AI-026 REQ-AI-027
// @MX:NOTE: ✨ 선택 툴바 + 프리셋 메뉴(설계 §4.1). 선택 시 선택 끝에 ✨ 위젯을 띄우고,
// 클릭하면 프리셋 5종 + "직접 입력" 팝오버를 연다. 문서 텍스트는 건드리지 않고 뷰 레이어
// (Decoration.widget)에만 존재한다(설계 §4.3, image-widget.ts 선례). 프롬프트 조립·컨텍스트
// 절단은 전부 Rust 쪽이므로(설계 §3), 프론트는 선택 텍스트 + 문단 컨텍스트 조각만 넘긴다.
// 등록(markdown-extensions/keymap)은 후속 태스크에서 수행한다 — 이 파일은 확장 팩토리만 제공.

import { WidgetType, ViewPlugin, Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { evaluateSelectionGuard } from './ai-length-guard';
import type { AiPresetKind } from './ai-length-guard';
import { aiRequest, ipcErrorMessage } from '@/lib/tauri/ipc';
import type { AiModel, AiRequestArgs } from '@/lib/tauri/ipc';
import type { AiFeature } from '@/store/aiStore';
import { useAiStore } from '@/store/aiStore';
import { useUIStore } from '@/store/uiStore';
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

/** 고급 모델 토글 → 모델(REQ-AI-016). */
export function resolveModel(uiState: AiToolbarUiState): AiModel {
  return uiState.advancedModel ? 'sonnet' : 'haiku';
}

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
  /** 활성 프리셋 선택(비활성 항목 클릭은 무시). */
  onSelectPreset: (kind: AiPresetKind) => void;
  /** 직접 입력 제출(trim 후 비어있지 않을 때만). */
  onSubmitCustom: (instruction: string) => void;
  /** 프리셋 목록에서 Esc / 외부 클릭으로 닫기. */
  onClose: () => void;
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

/** flip 판정에 쓰이는 CSS 클래스 — 아래 열림(기본)과 대칭 배치를 담당(mdedit-components.css). */
const MENU_ABOVE_CLASS = 'mdedit-ai-preset-menu--above';

/**
 * anchorEl 기준으로 메뉴가 열릴 방향을 측정해 flip 클래스를 토글한다(BUG-9). 레이아웃이 커밋된
 * 다음 프레임에 측정해야 정확한 rect 를 얻을 수 있어 requestAnimationFrame 으로 미룬다. 에디터
 * 스크롤러가 스크롤 컨테이너여도 getBoundingClientRect 는 항상 뷰포트 기준이라 그대로 동작한다.
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

  const renderPresets = (): void => {
    dom.replaceChildren();
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

    const fire = (presetKind: AiPresetKind, customInstruction?: string): void => {
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
          onSelectPreset: (kind) => fire(kind),
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

/** 선택 끝(to)에 side:1 위젯 하나를 배치. collapsed 이면 데코 없음. */
export function buildToolbarDecorations(
  view: EditorView,
  config: AiSelectionToolbarConfig,
): DecorationSet {
  const { from, to } = view.state.selection.main;
  if (from === to) return Decoration.none;

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
    getUiState: config.getUiState ?? defaultGetUiState,
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
