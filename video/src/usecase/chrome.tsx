import React from 'react';
import { interpolate } from 'remotion';
import { AppFrame, TypingText } from '../kit';
import { colors, font, fontSize, layout, lineHeight, radius, shadow, space } from '../tokens';

/**
 * usecase/chrome.tsx — AI 유즈케이스 영상 전용 공용 조각 모음.
 *
 * 튜토리얼 영상의 S3AI.tsx 와 같은 시각 패턴(선택 툴바 ✨ · 프리셋 메뉴 · 제안 카드 ·
 * 고스트 텍스트 · 커서 클릭)을 이 영상에서도 그대로 쓴다. 다만 S3AI.tsx 는 다른 작업자가
 * 동시에 편집 중이라 import 로 결합하지 않고, 앱 실물(ai-selection-toolbar.ts /
 * mdedit-components.css / diagramIconMarkup.ts)을 기준으로 이 파일에 자립 구현한다.
 *
 * 모든 색·폰트·간격은 tokens.ts 에서만 가져온다(하드코딩 금지).
 */

// ---- 공용 레이아웃 상수 (S3AI.tsx 와 동일 규약) -----------------------------
export const FRAME_W = 1600;
export const FRAME_H = 900;
export const CONTENT_X = layout.sidebarWidth;
export const CONTENT_Y = layout.headerHeight;

// =====================================================================
// 세그먼트/등장 헬퍼
// =====================================================================

/** 페이드 인/아웃하며 전체를 덮는 absolute flex 레이어. */
export function SegmentPanel({
  frame,
  start,
  end,
  fade = 15,
  children,
}: {
  frame: number;
  start: number;
  end: number;
  fade?: number;
  children: React.ReactNode;
}): JSX.Element | null {
  if (frame < start - fade || frame > end + fade) return null;
  const opacity = interpolate(frame, [start - fade, start, end, end + fade], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', minWidth: 0, minHeight: 0, opacity }}>
      {children}
    </div>
  );
}

/** 페이드+상승 등장 블록(인라인). */
export function Reveal({
  frame,
  appearFrame,
  children,
}: {
  frame: number;
  appearFrame: number;
  children: React.ReactNode;
}): JSX.Element {
  const opacity = interpolate(frame, [appearFrame, appearFrame + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [appearFrame, appearFrame + 10], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div style={{ opacity, transform: `translateY(${y}px)` }}>{children}</div>;
}

/** 페이드+상승 등장하는 전체 flex 레이어(에디터/프리뷰 스왑용). */
export function RevealLayer({
  frame,
  appearFrame,
  children,
}: {
  frame: number;
  appearFrame: number;
  children: React.ReactNode;
}): JSX.Element {
  const opacity = interpolate(frame, [appearFrame, appearFrame + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [appearFrame, appearFrame + 12], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', minWidth: 0, minHeight: 0, opacity, transform: `translateY(${y}px)` }}>
      {children}
    </div>
  );
}

/** AppFrame + 콘텐츠 relative 래퍼(에디터/프리뷰/오버레이는 이 안에서 content-relative). */
export function AppFrameSlot({
  header,
  sidebar,
  children,
}: {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <AppFrame header={header} sidebar={sidebar}>
      <div style={{ position: 'relative', flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>{children}</div>
    </AppFrame>
  );
}

// =====================================================================
// ✨ 선택 툴바 조각 (앱: ai-selection-toolbar.ts / mdedit-components.css)
// =====================================================================

/** ✨ 선택 툴바 버튼(앱 .mdedit-ai-sparkle-btn 재현 — 24px 사각 버튼). */
export function SparkleButton({ x, y, opacity = 1 }: { x: number; y: number; opacity?: number }): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        width: 30,
        height: 30,
        borderRadius: radius.sm,
        background: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        boxShadow: shadow.sm,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        color: colors.accentHover,
        zIndex: 55,
      }}
    >
      ✨
    </div>
  );
}

/** 프리셋 정의 — 앱 PRESET_DEFS 와 라벨·순서·이모지 동일(6종). */
export const PRESETS: Array<{ kind: string; emoji: string; label: string }> = [
  { kind: 'polish', emoji: '🖊', label: '다듬기' },
  { kind: 'outline', emoji: '📋', label: '개요로 정리' },
  { kind: 'table', emoji: '📊', label: '표로 만들기' },
  { kind: 'diagram', emoji: '🧜', label: '다이어그램으로' },
  { kind: 'shorten', emoji: '✂️', label: '짧게 줄이기' },
  { kind: 'custom', emoji: '✏️', label: '직접 입력...' },
];

/**
 * 프리셋 메뉴(앱 .mdedit-ai-preset-menu). activeKind 로 hover/active 항목을 강조하고,
 * diagram 항목에 플라이아웃(showFlyout)을 오른쪽으로 붙인다(앱 left:100% 규약).
 */
export function PresetMenu({
  x,
  y,
  frame,
  openFrame,
  activeKind,
  flyout,
}: {
  x: number;
  y: number;
  frame: number;
  openFrame: number;
  activeKind?: string;
  flyout?: { openFrame: number; activeType?: DiagramType | 'auto' };
}): JSX.Element | null {
  if (frame < openFrame) return null;
  const opacity = interpolate(frame, [openFrame, openFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [openFrame, openFrame + 8], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ITEM_H = 34; // padding 7*2 + 폰트 라인
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity, transform: `scale(${scale})`, transformOrigin: 'top left', zIndex: 56 }}>
      <div
        style={{
          position: 'relative',
          background: colors.surfaceRaised,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          boxShadow: shadow.md,
          padding: space[1],
          width: 200,
        }}
      >
        {PRESETS.map((p, i) => {
          const active = activeKind === p.kind;
          const isCustom = p.kind === 'custom';
          return (
            <React.Fragment key={p.kind}>
              {isCustom && <div style={{ height: 1, margin: `${space[1]}px 0`, background: colors.border }} />}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[3],
                  padding: `7px ${space[3]}px`,
                  borderRadius: radius.sm,
                  fontFamily: font.ui,
                  fontSize: fontSize.titlebar,
                  color: active ? colors.accentHover : colors.textPrimary,
                  background: active ? colors.accentSoft : 'transparent',
                }}
              >
                <span style={{ width: 16, textAlign: 'center' }}>{p.emoji}</span>
                <span style={{ flex: 1 }}>{p.label}</span>
                {p.kind === 'diagram' && <span style={{ color: colors.textFaint, fontSize: 12 }}>▸</span>}
              </div>
            </React.Fragment>
          );
        })}
        {/* 다이어그램 플라이아웃 — diagram 항목(4번째, index 3) 오른쪽에 붙는다. */}
        {flyout && (
          <DiagramFlyout
            frame={frame}
            openFrame={flyout.openFrame}
            activeType={flyout.activeType}
            top={space[1] + 3 * ITEM_H}
          />
        )}
      </div>
    </div>
  );
}

// =====================================================================
// 🧜 다이어그램 플라이아웃 서브메뉴 (앱: DIAGRAM_SUBMENU_DEFS, 8종 고정)
// =====================================================================

export type DiagramType =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'gantt'
  | 'classDiagram'
  | 'stateDiagram'
  | 'pie'
  | 'mindmap';

/** 7종 다이어그램 아이콘 inner SVG 마크업 — 앱 diagramIconMarkup.ts 단일 소스와 바이트 동일. */
export const DIAGRAM_ICON_INNER: Record<DiagramType, string> = {
  flowchart:
    '<rect x="4" y="3" width="10" height="5" rx="1"></rect><path d="M9 8v4"></path><rect x="4" y="12" width="10" height="5" rx="1"></rect><path d="M14 14.5h4V20"></path>',
  sequenceDiagram:
    '<path d="M6 3v18"></path><path d="M18 3v18"></path><path d="M6 9h12"></path><path d="m15 6 3 3-3 3"></path>',
  gantt: '<path d="M3 4h9"></path><path d="M7 10h11"></path><path d="M5 16h8"></path>',
  classDiagram:
    '<rect x="5" y="4" width="14" height="16" rx="1"></rect><path d="M5 9h14"></path><path d="M8 13h8"></path><path d="M8 16h6"></path>',
  stateDiagram:
    '<circle cx="6" cy="7" r="3"></circle><circle cx="18" cy="17" r="3"></circle><path d="M8.5 9.5 15 15"></path>',
  pie: '<circle cx="12" cy="12" r="9"></circle><path d="M12 3v9l6.4 6.4"></path>',
  mindmap:
    '<circle cx="12" cy="12" r="3"></circle><path d="M14.5 10 19 5"></path><path d="M14.5 14 19 19"></path><path d="M9 12H4"></path>',
};

/** 8종 서브메뉴 정의 — 앱 DIAGRAM_SUBMENU_DEFS 와 순서·라벨 동일("자동"이 첫 항목, 아이콘 없음). */
export const DIAGRAM_SUBMENU_DEFS: Array<{ type: DiagramType | null; label: string }> = [
  { type: null, label: '자동 (AI 판단)' },
  { type: 'flowchart', label: '순서도' },
  { type: 'sequenceDiagram', label: '시퀀스 다이어그램' },
  { type: 'gantt', label: '간트 차트' },
  { type: 'classDiagram', label: '클래스 다이어그램' },
  { type: 'stateDiagram', label: '상태 다이어그램' },
  { type: 'pie', label: '파이 차트' },
  { type: 'mindmap', label: '마인드맵' },
];

/** 다이어그램 아이콘(15×15, stroke=currentColor) — 앱 buildDiagramIcon 재현. */
export function DiagramIcon({ type }: { type: DiagramType }): JSX.Element {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none' }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: DIAGRAM_ICON_INNER[type] }}
    />
  );
}

/** 다이어그램 종류 플라이아웃(앱 .mdedit-ai-diagram-submenu, 부모 오른쪽으로 열림). */
export function DiagramFlyout({
  frame,
  openFrame,
  activeType,
  top,
}: {
  frame: number;
  openFrame: number;
  activeType?: DiagramType | 'auto';
  top: number;
}): JSX.Element | null {
  if (frame < openFrame) return null;
  const opacity = interpolate(frame, [openFrame, openFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dx = interpolate(frame, [openFrame, openFrame + 8], [-6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: '100%',
        top,
        marginLeft: space[1],
        opacity,
        transform: `translateX(${dx}px)`,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 200,
        padding: space[1],
        background: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        boxShadow: shadow.md,
        fontFamily: font.ui,
        zIndex: 57,
      }}
    >
      {DIAGRAM_SUBMENU_DEFS.map((def) => {
        const key = def.type ?? 'auto';
        const active = activeType === key;
        return (
          <div
            key={def.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[3],
              padding: `7px ${space[3]}px`,
              borderRadius: radius.sm,
              fontSize: fontSize.titlebar,
              color: active ? colors.accentHover : colors.textPrimary,
              background: active ? colors.accentSoft : 'transparent',
            }}
          >
            {def.type ? (
              <span style={{ display: 'flex', flex: 'none' }}>
                <DiagramIcon type={def.type} />
              </span>
            ) : (
              <span style={{ width: 15, flex: 'none' }} />
            )}
            <span style={{ flex: 1 }}>{def.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// 제안 카드 / 고스트 / 알약 버튼
// =====================================================================

/** AI 제안 카드(앱 .mdedit-ai-card — 좌측 3px accent 보더). */
export function SuggestionCard({
  frame,
  appearFrame,
  width = 560,
  title = '제안',
  children,
  footer,
}: {
  frame: number;
  appearFrame: number;
  width?: number;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}): JSX.Element | null {
  if (frame < appearFrame - 6) return null;
  const opacity = interpolate(frame, [appearFrame - 6, appearFrame + 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        width,
        opacity,
        background: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderLeft: `3px solid ${colors.accent}`,
        borderRadius: radius.md,
        boxShadow: shadow.lg,
        padding: space[4],
      }}
    >
      <div
        style={{
          fontFamily: font.ui,
          fontSize: 12.5,
          fontWeight: 700,
          color: colors.accent,
          marginBottom: space[2],
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        ✨ {title}
      </div>
      <div style={{ fontFamily: font.ui, fontSize: 15, lineHeight: 1.6, color: colors.textPrimary }}>{children}</div>
      {footer && <div style={{ marginTop: space[3], display: 'flex', gap: space[2] }}>{footer}</div>}
    </div>
  );
}

/** 알약형 액션 버튼(카드 [바꾸기]/[아래에 삽입]/↻). */
export function PillButton({
  label,
  variant = 'default',
  visible = true,
}: {
  label: string;
  variant?: 'default' | 'accent';
  visible?: boolean;
}): JSX.Element | null {
  if (!visible) return null;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 14px',
        borderRadius: radius.sm,
        fontFamily: font.ui,
        fontSize: 13.5,
        fontWeight: 600,
        background: variant === 'accent' ? colors.accent : colors.surface,
        color: variant === 'accent' ? colors.accentContrast : colors.textPrimary,
        border: variant === 'accent' ? 'none' : `1px solid ${colors.border}`,
      }}
    >
      {label}
    </div>
  );
}

// =====================================================================
// 간트 차트 렌더 (미리보기 — mermaid gantt 시각 재현)
// =====================================================================

export interface GanttTask {
  section: string;
  name: string;
  /** 시작/끝(6월 기준 일 단위 인덱스, 1..30). milestone 이면 start===end. */
  start: number;
  end: number;
  milestone?: boolean;
}

/**
 * mermaid gantt 스타일 차트를 SVG 로 그린다. 상단 주(week) 그리드 + 좌측 태스크명 +
 * accent 바. 앱의 mermaid 렌더와 시각적으로 일관(격자·바·라벨). reveal 로 바가 자란다.
 */
const DEFAULT_GANTT_TASKS: GanttTask[] = [
  { section: '준비', name: '기획', start: 1, end: 7 },
  { section: '준비', name: '디자인', start: 5, end: 14 },
  { section: '제작', name: '개발', start: 12, end: 25 },
  { section: '제작', name: '테스트', start: 24, end: 28 },
  { section: '출시', name: '배포', start: 30, end: 30, milestone: true },
];

export function GanttChart({
  frame,
  appearFrame,
  title = '프로젝트 일정',
  tasks = DEFAULT_GANTT_TASKS,
}: {
  frame: number;
  appearFrame: number;
  title?: string;
  tasks?: GanttTask[];
}): JSX.Element {
  const DAYS = 30;
  const LEFT = 92; // 태스크명 영역
  const CHART_W = 430; // 미리보기 패널 폭에 맞춤(오버플로 클리핑 방지)
  const ROW_H = 34;
  const TOP = 40;
  const dayW = CHART_W / DAYS;
  const gridEvery = 5; // 5일 간격 그리드

  const grow = interpolate(frame, [appearFrame, appearFrame + 13], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div>
      <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, color: colors.textPrimary, marginBottom: space[3] }}>
        {title}
      </div>
      <svg width={LEFT + CHART_W + 20} height={TOP + tasks.length * ROW_H + 16} style={{ display: 'block' }}>
        {/* 세로 그리드 + 날짜 라벨 */}
        {Array.from({ length: DAYS / gridEvery + 1 }, (_, i) => {
          const day = i * gridEvery;
          const gx = LEFT + day * dayW;
          return (
            <g key={i}>
              <line x1={gx} y1={TOP - 6} x2={gx} y2={TOP + tasks.length * ROW_H} stroke={colors.border} strokeWidth={1} />
              <text x={gx} y={TOP - 12} fill={colors.textFaint} fontSize={11} fontFamily={font.ui} textAnchor="middle">
                {`6/${Math.max(1, day)}`}
              </text>
            </g>
          );
        })}
        {/* 태스크 행 */}
        {tasks.map((t, i) => {
          const y = TOP + i * ROW_H;
          const x0 = LEFT + (t.start - 1) * dayW;
          const fullW = Math.max(dayW, (t.end - t.start) * dayW);
          const w = fullW * grow;
          return (
            <g key={t.name}>
              <text x={LEFT - 12} y={y + ROW_H / 2 + 4} fill={colors.textPrimary} fontSize={13} fontFamily={font.ui} textAnchor="end">
                {t.name}
              </text>
              {t.milestone ? (
                <g transform={`translate(${x0}, ${y + ROW_H / 2}) scale(${grow})`}>
                  <rect x={-8} y={-8} width={16} height={16} rx={2} transform="rotate(45)" fill={colors.dirty} />
                </g>
              ) : (
                <rect
                  x={x0}
                  y={y + 7}
                  width={w}
                  height={ROW_H - 14}
                  rx={4}
                  fill={i % 2 === 0 ? colors.accent : colors.accentHover}
                  opacity={0.92}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// =====================================================================
// 고스트 텍스트 (이어쓰기 — 회색 스트리밍 → 확정 시 본문색)
// =====================================================================

/** 미확정 스트리밍 고스트. confirmFrame 이후 본문색으로 확정. */
export function GhostText({
  text,
  startFrame,
  frame,
  confirmFrame,
  charsPerSecond = 22,
}: {
  text: string;
  startFrame: number;
  frame: number;
  confirmFrame?: number;
  charsPerSecond?: number;
}): JSX.Element {
  const confirmed = confirmFrame !== undefined && frame >= confirmFrame;
  return (
    <span style={{ color: confirmed ? colors.textPrimary : colors.textFaint }}>
      <TypingText text={text} startFrame={startFrame} charsPerSecond={charsPerSecond} cursor={!confirmed} />
    </span>
  );
}

// =====================================================================
// 상황 카드 (페르소나 + 마감 압박) — 각 케이스 도입부
// =====================================================================

/**
 * 케이스 도입 상황 카드. 페르소나 칩 + 시간/상황 대사 + 마감 과업을 큰 카드로 보여준다.
 * startFrame~endFrame 사이에서 자체 페이드. 배경은 케이스 배경 위 반투명 딤.
 */
export function SituationCard({
  frame,
  startFrame,
  endFrame,
  persona,
  moment,
  task,
}: {
  frame: number;
  startFrame: number;
  endFrame: number;
  persona: string;
  moment: string;
  task: string;
}): JSX.Element | null {
  if (frame < startFrame - 6 || frame > endFrame + 12) return null;
  const opacity = interpolate(frame, [startFrame - 6, startFrame + 10, endFrame, endFrame + 12], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [startFrame - 6, startFrame + 10], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 16, 17, 0.72)', opacity, zIndex: 80 }}>
      <div
        style={{
          transform: `translateY(${y}px)`,
          width: 900,
          background: colors.surfaceRaised,
          border: `1px solid ${colors.borderStrong}`,
          borderLeft: `4px solid ${colors.accent}`,
          borderRadius: radius.lg,
          boxShadow: shadow.lg,
          padding: `${space[6]}px ${space[6]}px`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: space[2],
            padding: `${space[1]}px ${space[3]}px`,
            background: colors.accentSoft,
            color: colors.accentActive,
            borderRadius: 999,
            fontFamily: font.ui,
            fontSize: 18,
            fontWeight: 600,
            marginBottom: space[4],
          }}
        >
          {persona}
        </div>
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 44, lineHeight: 1.2, color: colors.textPrimary }}>
          {moment}
        </div>
        <div style={{ fontFamily: font.ui, fontSize: 26, color: colors.textMuted, marginTop: space[4] }}>{task}</div>
      </div>
    </div>
  );
}

// =====================================================================
// 파이 차트 렌더 (미리보기 — mermaid pie 시각 재현)
// =====================================================================

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

/** mermaid pie 스타일 도넛/파이 + 범례. reveal 로 부채꼴이 시계방향으로 채워진다. */
export function PieChart({
  frame,
  appearFrame,
  title = '채널 비중',
  slices,
}: {
  frame: number;
  appearFrame: number;
  title?: string;
  slices: PieSlice[];
}): JSX.Element {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const sweep = interpolate(frame, [appearFrame, appearFrame + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cx = 130;
  const cy = 130;
  const r = 110;

  // 시계방향 부채꼴 path 생성 (12시 시작).
  let acc = 0;
  const arcs = slices.map((slice) => {
    const startFrac = acc / total;
    acc += slice.value;
    const endFrac = acc / total;
    const drawEnd = Math.min(endFrac, sweep);
    const a0 = startFrac * Math.PI * 2 - Math.PI / 2;
    const a1 = Math.max(a0, drawEnd * Math.PI * 2 - Math.PI / 2);
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const visible = sweep > startFrac;
    const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
    return { d, color: slice.color, visible };
  });

  return (
    <div>
      <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, color: colors.textPrimary, marginBottom: space[3] }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[5] }}>
        <svg width={260} height={260} style={{ flex: 'none' }}>
          {arcs.map((arc, i) =>
            arc.visible ? <path key={i} d={arc.d} fill={arc.color} stroke={colors.surfaceRaised} strokeWidth={2} /> : null,
          )}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
          {slices.map((slice) => (
            <div key={slice.label} style={{ display: 'flex', alignItems: 'center', gap: space[2], fontFamily: font.ui, fontSize: 15, color: colors.textPrimary }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: slice.color, flex: 'none' }} />
              <span style={{ flex: 1 }}>{slice.label}</span>
              <span style={{ color: colors.textMuted }}>{Math.round((slice.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
