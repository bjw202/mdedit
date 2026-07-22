import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, font, fontSize, layout, lineHeight, radius, shadow, space } from '../tokens';
import {
  AppFrame,
  HeaderBar,
  FileExplorer,
  EditorPane,
  PreviewPane,
  PreviewH1,
  PreviewH2,
  PreviewParagraph,
  PreviewList,
  PreviewImage,
  SubtitleBar,
  SceneChip,
  CursorPointer,
  Keycap,
  TypingText,
  typingDurationInFrames,
} from '../kit';

/**
 * S3 — AI 어시스턴트 (~95s / 2850f). STORYBOARD.md §S3.
 * S3a hero reveal (the ONE scene in the whole video allowed elevated motion) ->
 * S3b feature montage (4 mini demo cards, reduced scale) -> S3c two full
 * AppFrame use-case replays. Labels/shortcuts/emoji copied verbatim from
 * docs/USER_GUIDE.md §4-§5 (no reinvented UI copy).
 */
// SPEC-AI-008: S3b 선택 툴바 카드에 다이어그램 종류 플라이아웃 비트를 추가하며 CARD1 을 90f(3s) 늘렸고
// (2850 -> 2940), 이후 플라이아웃을 카메라 푸시인(zoom)으로 강조하며 노출을 75f(2.5s) 더 늘렸다
// (2940 -> 3015). 두 번 모두 CARD1 뒤 절대 경계(CARD2~4·S3B.end·UC1·UC2)와 씬 길이를 동일 프레임만큼
// 밀어 뒤 구간의 상대 타이밍은 보존한다.
export const S3_DURATION_IN_FRAMES = 3015;

// ---- top-level boundaries (absolute scene frames) --------------------------
const S3A = { start: 0, end: 360 };
const S3B = { start: 360, end: 1275 };
const UC1 = { start: 1275, end: 2115 };
const UC2 = { start: 2115, end: 3015 };

// ---- shared layout math (mirrors S1Markdown.tsx / S2UITour.tsx conventions) --
const FRAME_W = 1600;
const FRAME_H = 900;
const CONTENT_X = layout.sidebarWidth;
const CONTENT_Y = layout.headerHeight;
const CONTENT_W = FRAME_W - layout.sidebarWidth;
const CONTENT_H = FRAME_H - layout.headerHeight;

// ---- deterministic pseudo-random helper (same hash as kit/TypingText.tsx) --
function seeded(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ---- local animation helpers (S3-only, no shared kit edits) ---------------
function chainTyping(
  fps: number,
  base: number,
  items: Array<{ text: string; gapAfter?: number; cps?: number }>,
): Array<{ text: string; start: number; end: number }> {
  let cursor = base;
  return items.map((item) => {
    const start = cursor;
    const end = start + typingDurationInFrames(item.text, fps, item.cps ?? 14, true);
    cursor = end + (item.gapAfter ?? 20);
    return { text: item.text, start, end };
  });
}

function Reveal({
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

/** Full-bleed absolute flex layer that fades+rises in (see S2UITour.tsx's RevealLayer for the flex gotcha). */
function RevealLayer({
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
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        minWidth: 0,
        minHeight: 0,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      {children}
    </div>
  );
}

function SegmentPanel({
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

function AppFrameSlot({
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

const screenshotSvg =
  `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='230'>` +
  `<rect width='420' height='230' rx='6' fill='${colors.surface}' stroke='${colors.border}'/>` +
  `<g fill='none' stroke='${colors.textFaint}' stroke-width='2'>` +
  `<rect x='150' y='75' width='120' height='90' rx='6'/>` +
  `<circle cx='210' cy='113' r='16'/>` +
  `<path d='M175 75 l10 -14 h50 l10 14'/>` +
  `</g>` +
  `<text x='210' y='200' font-family='sans-serif' font-size='14' fill='${colors.textMuted}' text-anchor='middle'>screenshot.png</text>` +
  `</svg>`;
const screenshotDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(screenshotSvg)}`;

// =====================================================================
// Reusable AI-chrome pieces (S3-only)
// =====================================================================

/** ✨ selection-toolbar button (docs/USER_GUIDE.md §4.1 step 1). */
function SparkleButton({ x, y, opacity = 1 }: { x: number; y: number; opacity?: number }): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderStrong}`,
        boxShadow: shadow.sm,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 17,
        zIndex: 55,
      }}
    >
      ✨
    </div>
  );
}

const PRESETS: Array<{ emoji: string; label: string }> = [
  { emoji: '🖊', label: '다듬기' },
  { emoji: '📋', label: '개요로 정리' },
  { emoji: '📊', label: '표로 만들기' },
  { emoji: '🧜', label: '다이어그램으로' },
  { emoji: '✂️', label: '짧게 줄이기' },
  { emoji: '✏️', label: '직접 입력...' },
];

/** ✨ preset menu — exact 6 presets, docs/USER_GUIDE.md §4.1. */
function PresetMenu({
  x,
  y,
  local,
  openFrame,
  activeIndex,
  activeFrame,
}: {
  x: number;
  y: number;
  local: number;
  openFrame: number;
  activeIndex?: number;
  activeFrame?: number;
}): JSX.Element | null {
  if (local < openFrame) return null;
  const opacity = interpolate(local, [openFrame, openFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(local, [openFrame, openFrame + 8], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.md,
        boxShadow: shadow.md,
        padding: 6,
        zIndex: 56,
        width: 190,
      }}
    >
      {PRESETS.map((p, i) => {
        const isActive = activeIndex === i && activeFrame !== undefined && local >= activeFrame;
        return (
          <div
            key={p.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: radius.sm,
              fontFamily: font.ui,
              fontSize: 14.5,
              color: colors.textPrimary,
              background: isActive ? colors.accentSoft : 'transparent',
            }}
          >
            <span>{p.emoji}</span>
            <span>{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// SPEC-AI-008: 🧜 다이어그램으로 플라이아웃 8항목 — 자동(아이콘 없음) + 7종.
// 라벨·순서는 앱 DIAGRAM_SUBMENU_DEFS(src/components/editor/extensions/ai-selection-toolbar.ts)
// 그대로, 아이콘 inner 마크업은 src/components/icons/diagramIconMarkup.ts 의
// DIAGRAM_ICON_INNER 를 1:1 복제(별도 npm 프로젝트라 앱 소스를 import 하지 않고 값만 옮김).
const DIAGRAM_SUBMENU: Array<{ label: string; iconInner?: string }> = [
  { label: '자동 (AI 판단)' },
  {
    label: '순서도',
    iconInner:
      '<rect x="4" y="3" width="10" height="5" rx="1"/><path d="M9 8v4"/><rect x="4" y="12" width="10" height="5" rx="1"/><path d="M14 14.5h4V20"/>',
  },
  {
    label: '시퀀스 다이어그램',
    iconInner: '<path d="M6 3v18"/><path d="M18 3v18"/><path d="M6 9h12"/><path d="m15 6 3 3-3 3"/>',
  },
  { label: '간트 차트', iconInner: '<path d="M3 4h9"/><path d="M7 10h11"/><path d="M5 16h8"/>' },
  {
    label: '클래스 다이어그램',
    iconInner: '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M5 9h14"/><path d="M8 13h8"/><path d="M8 16h6"/>',
  },
  {
    label: '상태 다이어그램',
    iconInner: '<circle cx="6" cy="7" r="3"/><circle cx="18" cy="17" r="3"/><path d="M8.5 9.5 15 15"/>',
  },
  { label: '파이 차트', iconInner: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.4"/>' },
  {
    label: '마인드맵',
    iconInner: '<circle cx="12" cy="12" r="3"/><path d="M14.5 10 19 5"/><path d="M14.5 14 19 19"/><path d="M9 12H4"/>',
  },
];

/** 단색 스켈레톤 다이어그램 아이콘 — 앱 icons.tsx svgProps(viewBox 24, stroke currentColor, 1.5) 재현. */
function DiagramTypeIcon({ inner }: { inner: string }): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

/**
 * ✨ 프리셋 메뉴 오른쪽에 열리는 다이어그램 종류 플라이아웃(SPEC-AI-008).
 * .mdedit-ai-diagram-submenu CSS(top:0 left:100% + margin-left var(--md-space-1),
 * surfaceRaised/border/radius.md/shadow.md, min-width 190, item padding 7px space-3,
 * fontSize titlebar) 재현. `x`/`y` 는 프리셋 메뉴 좌표계에서 🧜 항목 오른쪽·상단으로 맞춘다.
 */
function DiagramFlyout({
  x,
  y,
  local,
  openFrame,
  activeIndex,
  activeFrame,
}: {
  x: number;
  y: number;
  local: number;
  openFrame: number;
  activeIndex?: number;
  activeFrame?: number;
}): JSX.Element | null {
  if (local < openFrame) return null;
  const opacity = interpolate(local, [openFrame, openFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(local, [openFrame, openFrame + 8], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        background: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        boxShadow: shadow.md,
        padding: 6,
        zIndex: 57,
        minWidth: 190,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {DIAGRAM_SUBMENU.map((d, i) => {
        const isActive = activeIndex === i && activeFrame !== undefined && local >= activeFrame;
        return (
          <div
            key={d.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[3],
              padding: '7px 10px',
              borderRadius: radius.sm,
              fontFamily: font.ui,
              fontSize: fontSize.titlebar,
              color: isActive ? colors.accentHover : colors.textPrimary,
              background: isActive ? colors.accentSoft : 'transparent',
            }}
          >
            <span style={{ display: 'flex', flex: 'none', width: 18, justifyContent: 'center' }}>
              {d.iconInner ? <DiagramTypeIcon inner={d.iconInner} /> : null}
            </span>
            <span style={{ flex: 1 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Toggle switch pill for the settings demo (docs/USER_GUIDE.md §1.5). */
function Toggle({ on }: { on: boolean }): JSX.Element {
  return (
    <div
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        background: on ? colors.accent : colors.border,
        position: 'relative',
        flex: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: colors.accentContrast,
          boxShadow: shadow.sm,
        }}
      />
    </div>
  );
}

function ToggleRow({ label, sub, on }: { label: string; sub?: string; on: boolean }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${space[3]}px 0`,
        borderBottom: `1px solid ${colors.border}`,
        gap: space[4],
      }}
    >
      <div>
        <div style={{ fontFamily: font.ui, fontSize: 16, color: colors.textPrimary }}>{label}</div>
        {sub && (
          <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.textFaint, marginTop: 2 }}>{sub}</div>
        )}
      </div>
      <Toggle on={on} />
    </div>
  );
}

/** Ghost (unconfirmed) streamed text — gray until `confirmFrame`, then turns solid (docs/USER_GUIDE.md §4.2). */
function GhostText({
  text,
  startFrame,
  frame,
  confirmFrame,
  charsPerSecond = 16,
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

/** "✨ 이어쓰기 Ctrl+Enter" idle hint pill, appears after a 3s cursor pause (docs/USER_GUIDE.md §4.2). */
function HintPill({ opacity }: { opacity: number }): JSX.Element {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        opacity,
        background: colors.accentSoft,
        border: `1px solid ${colors.accent}`,
        color: colors.accentActive,
        fontFamily: font.ui,
        fontSize: 14,
        fontWeight: 600,
        padding: '6px 12px',
        borderRadius: 999,
      }}
    >
      <span>✨ 이어쓰기</span>
      <Keycap keys={['Ctrl', 'Enter']} />
    </div>
  );
}

/** AI 제안 카드 — glow-ring border (aiGlowFrom/To tokens) + streaming content (docs/USER_GUIDE.md §4.1 "제안 카드"). */
function SuggestionCard({
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
  const glowPulse = 0.55 + 0.35 * Math.sin((frame - appearFrame) / 9);
  return (
    <div
      style={{
        width,
        opacity,
        background: colors.surfaceRaised,
        borderRadius: radius.md,
        boxShadow: `0 0 0 2px ${colors.aiGlowFrom}${Math.round(glowPulse * 255)
          .toString(16)
          .padStart(2, '0')}, ${shadow.lg}`,
        padding: space[4],
      }}
    >
      <div
        style={{
          fontFamily: font.ui,
          fontSize: 12.5,
          fontWeight: 700,
          color: colors.aiGlowFrom,
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

function PillButton({
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
// S3a — 히어로 리빌 (0-360f) — the ONE scene allowed elevated motion.
// =====================================================================

function HeroDim({ frame }: { frame: number }): JSX.Element {
  const dim = interpolate(frame, [0, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', inset: 0, background: '#0a0b0c', opacity: dim }} />;
}

function HeroLead({ frame }: { frame: number }): JSX.Element | null {
  const START = 55;
  const END = 150;
  if (frame < START - 10 || frame > END + 10) return null;
  const opacity = interpolate(frame, [START - 10, START + 8, END - 15, END], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity }}>
      <div style={{ fontFamily: font.display, fontSize: 52, fontWeight: 600, color: '#f2f2f3' }}>
        <TypingText text="그리고, 하나 더." startFrame={START} charsPerSecond={9} cursor={false} />
      </div>
    </div>
  );
}

function SparkleParticles({ frame }: { frame: number }): JSX.Element | null {
  const BURST = 168;
  if (frame < BURST - 5 || frame > BURST + 130) return null;
  const N = 22;
  const particles = Array.from({ length: N }, (_, i) => {
    const angle = (i / N) * Math.PI * 2 + seeded(i) * 0.6;
    const radiusTarget = 240 + seeded(i + 50) * 220;
    const delay = Math.floor(seeded(i + 100) * 14);
    const local = frame - BURST - delay;
    const prog = spring({ frame: local, fps: 30, config: { damping: 14, stiffness: 90, mass: 0.6 } });
    const dist = interpolate(prog, [0, 1], [0, radiusTarget]);
    const opacity = interpolate(local, [0, 8, 60, 100], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const scale = interpolate(prog, [0, 0.3, 1], [0.3, 1.3, 0.9]);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(${x - 16}px, ${y - 16}px) scale(${scale})`,
          opacity,
          fontSize: 28,
        }}
      >
        ✨
      </div>
    );
  });
  return <div style={{ position: 'absolute', inset: 0 }}>{particles}</div>;
}

function HeroTitle({ frame }: { frame: number }): JSX.Element | null {
  const START = 165;
  if (frame < START - 10) return null;
  const pop = spring({ frame: frame - START, fps: 30, config: { damping: 13, stiffness: 120, mass: 0.8 } });
  const opacity = interpolate(frame, [START - 5, START + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(pop, [0, 1], [0.7, 1]);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 110,
          letterSpacing: '-0.02em',
          backgroundImage: `linear-gradient(90deg, ${colors.aiGlowFrom}, ${colors.aiGlowTo})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        AI 어시스턴트
      </div>
    </div>
  );
}

function HeroNameplate({ frame }: { frame: number }): JSX.Element | null {
  const START = 300;
  if (frame < START - 10) return null;
  const opacity = interpolate(frame, [START - 10, START + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 90,
        transform: 'translateX(-50%)',
        opacity,
        fontFamily: font.ui,
        fontSize: 16,
        color: '#9a9a9d',
        textAlign: 'center',
      }}
    >
      로컬 Claude Code CLI로 동작 · 문서는 로컬 CLI를 통해서만 전송
    </div>
  );
}

function HeroSegment({ frame }: { frame: number }): JSX.Element | null {
  if (frame < S3A.start - 20 || frame > S3A.end + 10) return null;
  const fadeOut = interpolate(frame, [S3A.end - 30, S3A.end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fadeOut, zIndex: 100 }}>
      <HeroDim frame={frame} />
      <HeroLead frame={frame} />
      <SparkleParticles frame={frame} />
      <HeroTitle frame={frame} />
      <HeroNameplate frame={frame} />
    </div>
  );
}

// =====================================================================
// S3b — 기능 몽타주 (360-1110f) — 4 feature cards, reduced-scale mini demos.
// =====================================================================

// SPEC-AI-008: CARD1 만 확장(플라이아웃 비트 90f + zoom 노출 75f = 총 +165f), CARD2~4 는 길이 유지한 채 이동.
const CARD1 = { start: 360, end: 713 };
const CARD2 = { start: 713, end: 901 };
const CARD3 = { start: 901, end: 1089 };
const CARD4 = { start: 1089, end: 1275 };

function FeatureCardShell({
  frame,
  start,
  end,
  icon,
  title,
  children,
}: {
  frame: number;
  start: number;
  end: number;
  icon: string;
  title: string;
  children: React.ReactNode;
}): JSX.Element | null {
  if (frame < start - 16 || frame > end + 16) return null;
  const opacity = interpolate(frame, [start - 16, start, end, end + 16], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [start - 16, start + 6], [0.94, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity }}>
      <div
        style={{
          width: 1180,
          height: 580,
          transform: `scale(${scale})`,
          background: colors.surfaceRaised,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          boxShadow: shadow.lg,
          padding: space[6],
          display: 'flex',
          flexDirection: 'column',
          gap: space[4],
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
          <span style={{ fontSize: 30 }}>{icon}</span>
          <span style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, color: colors.textPrimary }}>
            {title}
          </span>
        </div>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );
}

// SPEC-AI-008 후속(사용자 결정): 스케일 축소된 몽타주 카드 안에서 플라이아웃이 너무 작게 보여,
// 열려 있는 동안 카드 전체를 카메라 푸시인(zoom)으로 강조한다. zoom origin 은 프리셋 메뉴+플라이아웃
// 영역의 중심을 씬 1600x900 좌표로 환산한 값이다. 카드는 (1600-1180)/2, (900-580)/2 = (210,160) 에
// 중앙 정렬되고(=FeatureCardShell 의 flex center + 1180x580 카드), 그 안에서 메뉴/플라이아웃 중심은
// card 좌표 ~(660,266) → 씬 좌표 (210+660, 160+266) = (870,426). 이 점을 고정해 1 -> 1.5 로 확대한다.
const ZOOM_ORIGIN_X = 870;
const ZOOM_ORIGIN_Y = 426;
const ZOOM_MAX_SCALE = 1.5;
// zoom 로컬 프레임 창: 플라이아웃(open 162) 직전 진입 -> 유지 -> 종료. gantt pick(235)·유지 노출 후 빠짐.
const ZOOM_IN = [155, 178] as const;
const ZOOM_OUT = [300, 322] as const;

function SelectionToolbarCard({ frame }: { frame: number }): JSX.Element | null {
  const local = frame - CARD1.start;

  // 진입/종료를 각각 부드럽게(ease in/out) 보간한 뒤 min 으로 사다리꼴 엔벨로프를 만든다(0..1).
  const zEnvelope = Math.min(
    interpolate(local, [ZOOM_IN[0], ZOOM_IN[1]], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    }),
    interpolate(local, [ZOOM_OUT[0], ZOOM_OUT[1]], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    }),
  );
  const zoomScale = 1 + zEnvelope * (ZOOM_MAX_SCALE - 1);

  return (
    <>
      {/* zoom 래퍼: 씬 루트(1600x900) 를 채우고 origin 고정 확대. 자막은 이 래퍼 밖(비확대)이라 항상 읽힌다. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: zEnvelope > 0 ? `scale(${zoomScale})` : undefined,
          transformOrigin: `${ZOOM_ORIGIN_X}px ${ZOOM_ORIGIN_Y}px`,
        }}
      >
        <FeatureCardShell frame={frame} start={CARD1.start} end={CARD1.end} icon="✨" title="선택 툴바">
          <div style={{ padding: `${space[5]}px ${space[4]}px`, position: 'relative' }}>
            <div style={{ position: 'relative', display: 'inline-block', fontFamily: font.ui, fontSize: 22, color: colors.textPrimary }}>
              <span
                style={{
                  position: 'absolute',
                  left: -4,
                  top: -2,
                  width: 430,
                  height: 30,
                  background: colors.selection,
                  borderRadius: 3,
                  opacity: interpolate(local, [8, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
                }}
              />
              회의 결과를 정리해서 팀에 공유해야 합니다.
            </div>
            {local >= 26 && (
              <SparkleButton
                x={440}
                y={-6}
                opacity={interpolate(local, [26, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
              />
            )}
            {/* SPEC-AI-008: 🧜 다이어그램으로(프리셋 index 3)에 호버가 머물면 종류 플라이아웃이 열린다.
                프리셋 메뉴는 x=440,y=40,width=190 이라 오른쪽 가장자리 440+190=630 → gap 4 더해 x=634.
                앱은 서브메뉴 top 을 트리거(🧜) 상단에 맞추지만, 8항목(~252px)이 아래로 길어 y 를 위로
                올려 🧜 근처에서 연다. gantt pick(235)은 zoom 이 완전히 들어온 뒤라 확대된 상태로 보인다. */}
            <PresetMenu x={440} y={40} local={local} openFrame={46} activeIndex={3} activeFrame={150} />
            <DiagramFlyout x={634} y={64} local={local} openFrame={162} activeIndex={3} activeFrame={235} />
          </div>
        </FeatureCardShell>
      </div>
      {/* 자막은 zoom 래퍼 밖 — 씬 루트 기준 하단(UC1/UC2 자막과 동일 위치)에 비확대로 표시.
          SubtitleBar fadeFrames=10 이므로 실제 표시 구간은 [start-10, end+10]. 두 자막의 fade 가
          겹치면 반투명 상단 바로 하단 바 글자가 비쳐 겹쳐 보이므로 sub2.start - sub1.end = 20 = 2*fade
          로 fade 구간을 정확히 맞닿게(비중첩) 둔다. sub2 는 zoom 노출 구간 전체를 덮도록 늘렸다. */}
      <SubtitleBar
        text="선택하면 나타나는 ✨로 프리셋 6종을 골라요"
        startFrame={CARD1.start + 60}
        endFrame={CARD1.start + 140}
      />
      <SubtitleBar
        text="다이어그램 종류도 직접 고를 수 있어요"
        startFrame={CARD1.start + 160}
        endFrame={CARD1.end - 16}
      />
    </>
  );
}

function ContinueWritingCard({ frame }: { frame: number }): JSX.Element | null {
  const local = frame - CARD2.start;
  const confirmFrame = 150;
  return (
    <FeatureCardShell frame={frame} start={CARD2.start} end={CARD2.end} icon="⌨️" title="이어쓰기">
      <div style={{ padding: `${space[5]}px ${space[4]}px`, fontFamily: font.ui, fontSize: 20, lineHeight: 1.7, color: colors.textPrimary }}>
        <div>mdedit는 로컬 우선으로 동작하는 편집기입니다.</div>
        <div style={{ marginTop: space[3], opacity: interpolate(local, [4, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          <Keycap keys={['Ctrl', 'Enter']} />
        </div>
        <div style={{ marginTop: space[3] }}>
          {local >= 24 && (
            <GhostText
              text="그래서 어디서든 빠르고 안전하게 글을 쓸 수 있어요."
              startFrame={CARD2.start + 24}
              frame={frame}
              confirmFrame={CARD2.start + confirmFrame}
              charsPerSecond={20}
            />
          )}
        </div>
      </div>
      <SubtitleBar
        text="문체를 이어받아 다음 내용을 이어 써줍니다"
        startFrame={CARD2.start + 40}
        endFrame={CARD2.end - 20}
      />
    </FeatureCardShell>
  );
}

function SectionFillCard({ frame }: { frame: number }): JSX.Element | null {
  const local = frame - CARD3.start;
  return (
    <FeatureCardShell frame={frame} start={CARD3.start} end={CARD3.end} icon="✨" title="섹션 채우기">
      <div style={{ padding: `${space[5]}px ${space[4]}px`, fontFamily: font.ui, color: colors.textPrimary }}>
        <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 26, marginBottom: space[3] }}>다음 단계</div>
        <div style={{ fontSize: 18, lineHeight: 1.7 }}>
          {local >= 20 && (
            <GhostText
              text="필요한 준비물을 확인하고, 순서대로 설치를 진행하세요."
              startFrame={CARD3.start + 20}
              frame={frame}
              confirmFrame={CARD3.start + 140}
              charsPerSecond={18}
            />
          )}
        </div>
      </div>
      <SubtitleBar
        text="빈 헤딩 아래 내용을 채워줍니다"
        startFrame={CARD3.start + 40}
        endFrame={CARD3.end - 20}
      />
    </FeatureCardShell>
  );
}

function SettingsCard({ frame }: { frame: number }): JSX.Element | null {
  return (
    <FeatureCardShell frame={frame} start={CARD4.start} end={CARD4.end} icon="⚙️" title="설정">
      <div style={{ padding: `0 ${space[4]}px` }}>
        <ToggleRow label="AI 기능 사용" on />
        <ToggleRow label="고급 모델 사용 (sonnet — 더 정확, 더 느림)" on={false} />
        <ToggleRow label="이어쓰기 짧게 쓰기 (한두 문장만)" on={false} />
      </div>
      <SubtitleBar
        text="Claude 전용: 로컬 Claude Code CLI 로그인이 필요해요"
        startFrame={CARD4.start + 50}
        endFrame={CARD4.end - 20}
      />
    </FeatureCardShell>
  );
}

function FeatureMontage({ frame }: { frame: number }): JSX.Element | null {
  if (frame < S3B.start - 20 || frame > S3B.end + 20) return null;
  return (
    <>
      <SelectionToolbarCard frame={frame} />
      <ContinueWritingCard frame={frame} />
      <SectionFillCard frame={frame} />
      <SettingsCard frame={frame} />
    </>
  );
}

// =====================================================================
// S3c-UC1 — 회의 메모 정리 (1110-1950f), full AppFrame replay.
// =====================================================================

const RAW_NOTES = ['회의 메모', '', '참석 지원 민준 서연', '논의 신규 기능 우선순위 일정 예산', '지원 기획서 민준 디자인 시안 서연 예산안'];
const SCREENSHOT_LINE = '![screenshot](images/screenshot.png)';

const CLEAN_LINES = [
  '# 회의 메모',
  '',
  '## 참석자',
  '- 지원, 민준, 서연',
  '',
  '## 논의 사항',
  '- 신규 기능 우선순위',
  '- 일정 조정',
  '- 예산 검토',
  '',
  '## 다음 액션',
  '- 지원: 기획서 작성',
  '- 민준: 디자인 시안',
  '- 서연: 예산안 정리',
];

function RawNotesEditor({ showScreenshot }: { showScreenshot: boolean }): JSX.Element {
  const lines: string[] = [...RAW_NOTES];
  if (showScreenshot) lines.push('', SCREENSHOT_LINE);
  return <EditorPane lines={lines} />;
}

function RawNotesPreview({ frame, showScreenshot, screenshotAppearFrame }: { frame: number; showScreenshot: boolean; screenshotAppearFrame: number }): JSX.Element {
  return (
    <PreviewPane style={{ maxWidth: 'none' }}>
      <PreviewH1>회의 메모</PreviewH1>
      <PreviewParagraph>참석 지원 민준 서연</PreviewParagraph>
      <PreviewParagraph>논의 신규 기능 우선순위 일정 예산</PreviewParagraph>
      <PreviewParagraph>지원 기획서 민준 디자인 시안 서연 예산안</PreviewParagraph>
      {showScreenshot && (
        <Reveal frame={frame} appearFrame={screenshotAppearFrame}>
          <PreviewImage src={screenshotDataUri} alt="screenshot" />
        </Reveal>
      )}
    </PreviewPane>
  );
}

function CleanOutlineEditor(): JSX.Element {
  return <EditorPane lines={CLEAN_LINES} />;
}

function CleanOutlinePreview(): JSX.Element {
  return (
    <PreviewPane style={{ maxWidth: 'none' }}>
      <PreviewH1>회의 메모</PreviewH1>
      <PreviewH2>참석자</PreviewH2>
      <PreviewList items={['지원, 민준, 서연']} />
      <PreviewH2>논의 사항</PreviewH2>
      <PreviewList items={['신규 기능 우선순위', '일정 조정', '예산 검토']} />
      <PreviewH2>다음 액션</PreviewH2>
      <PreviewList items={['지원: 기획서 작성', '민준: 디자인 시안', '서연: 예산안 정리']} />
    </PreviewPane>
  );
}

// UC1 sub-beats, relative to UC1.start (0..840f).
const UC1_PASTE_KEY = 100;
const UC1_SCREENSHOT_IN = UC1_PASTE_KEY + 55; // 155
const UC1_SELECT_START = 200;
const UC1_SELECT_END = 260;
const UC1_SPARKLE_CLICK = 300;
const UC1_MENU_OPEN = 320;
const UC1_PRESET_CLICK = 400;
const UC1_CARD_APPEAR = 430;
const UC1_REPLACE_CLICK = 600;
const UC1_TRANSFORM = UC1_REPLACE_CLICK + 15; // 615

function UC1Segment({ frame }: { frame: number }): JSX.Element | null {
  if (frame < UC1.start - 20 || frame > UC1.end + 20) return null;
  const local = frame - UC1.start;
  // BUGFIX (post-review): SubtitleBar / CursorPointer / TypingText all call
  // useCurrentFrame() internally (there is no per-UC <Sequence> boundary in
  // this scene), so it always returns the ABSOLUTE S3-scene frame — never
  // the UC1-local `local` used for our own conditional rendering above.
  // Every frame value handed to those three components must be converted
  // back to absolute scale via `abs()`, or they silently never match.
  const abs = (n: number): number => UC1.start + n;

  const showScreenshot = local >= UC1_SCREENSHOT_IN;
  const showSelection = local >= UC1_SELECT_START && local < UC1_PRESET_CLICK + 20;
  const showSparkle = local >= UC1_SELECT_END;
  const showMenu = local >= UC1_MENU_OPEN && local < UC1_CARD_APPEAR + 4;
  const showCard = local >= UC1_CARD_APPEAR && local < UC1_TRANSFORM + 20;
  const transformed = local >= UC1_TRANSFORM;

  const selectionWidth = interpolate(local, [UC1_SELECT_START, UC1_SELECT_END], [0, 560], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // F4 fix: the "전체 선택" (select-all) highlight must cover the ACTUAL
  // rendered text block. RawNotesEditor shows RAW_NOTES (5 lines) plus, once
  // the screenshot is pasted (true by UC1_SELECT_START — UC1_SCREENSHOT_IN=155
  // < 200), a blank line + the screenshot markdown line = 7 lines total.
  // EditorPane pads its content by space[3] (top) before the first line, and
  // each line is lineHeight.editor * fontSize.editor tall — see
  // kit/EditorPane.tsx. The previous {top:96, height:96} rect only covered
  // roughly line 4's tail plus empty space below the document (reported
  // mismatch at ~3:13 / S3 UC1 mid).
  const SELECTION_LINES = 7;
  const SELECTION_LINE_H = lineHeight.editor * fontSize.editor; // 24.75
  const SELECTION_TOP = space[3]; // EditorPane's top padding
  const SELECTION_HEIGHT = SELECTION_LINES * SELECTION_LINE_H; // 173.25
  const SPARKLE_SIZE = 34; // SparkleButton's fixed width/height
  const sparkleX = 40 + selectionWidth + 8;
  const sparkleY = SELECTION_TOP + SELECTION_HEIGHT - SPARKLE_SIZE - 6; // hugs the selection's bottom-right corner
  const menuX = sparkleX;
  const menuY = sparkleY + SPARKLE_SIZE + 8;

  // F4 fix: the 바꾸기(replace)/↻ button click target was a stale hardcoded
  // (90, 380) left over from before the suggestion card's position/size was
  // finalized — it landed far from the actual rendered buttons. Recomputed
  // from the card's real geometry: positioned at (left:40, top:260) inside
  // the content area, padded by space[4], with a ~22px title row, 6 lines of
  // TypingText content at lineHeight 1.6 * 15px, then the footer button row.
  const CARD_LEFT = 40;
  const CARD_TOP = 260;
  const CARD_PADDING = space[4];
  const CARD_TITLE_ROW_H = 22;
  const CARD_CONTENT_LINES = 6;
  const CARD_CONTENT_LINE_H = 1.6 * 15;
  const CARD_FOOTER_MARGIN = space[3];
  const CARD_FOOTER_BTN_H = 28;
  // NOTE: CursorPointer is a SIBLING of AppFrameSlot (not a child), so its
  // coordinate space is the outer FRAME_W x FRAME_H box — but the selection
  // overlay / SparkleButton / PresetMenu / SuggestionCard above are all
  // rendered INSIDE AppFrameSlot's content-relative wrapper, whose origin is
  // offset by (CONTENT_X, CONTENT_Y) from that same outer box. Every
  // CursorPointer target below must add that offset, or (as originally
  // written) it silently lands ~(CONTENT_X, CONTENT_Y) short — this was the
  // root cause of the F4-reported cursor/click misalignment throughout UC1.
  // Verified still correct after adding the "⤵ 아래에 삽입" pill (fix for the
  // missing insert-below button): this targets the FIRST (leftmost) pill in
  // the footer row, whose x/y only depend on the card's own left/top/padding
  // and content height above it — unaffected by pills added to its right.
  const replaceBtnX = CONTENT_X + CARD_LEFT + CARD_PADDING + 50; // ~half of "✓ 바꾸기" pill's width
  const replaceBtnY =
    CONTENT_Y +
    CARD_TOP +
    CARD_PADDING +
    CARD_TITLE_ROW_H +
    CARD_CONTENT_LINES * CARD_CONTENT_LINE_H +
    CARD_FOOTER_MARGIN +
    CARD_FOOTER_BTN_H / 2;

  return (
    <>
      <SegmentPanel frame={local} start={0} end={840} fade={20}>
        <AppFrameSlot header={<HeaderBar viewMode="split" filename="회의록.md" />} sidebar={<FileExplorer selected="회의록.md" />}>
          {transformed ? (
            <RevealLayer frame={local} appearFrame={UC1_TRANSFORM}>
              <CleanOutlineEditor />
              <CleanOutlinePreview />
            </RevealLayer>
          ) : (
            <>
              <RawNotesEditor showScreenshot={showScreenshot} />
              <RawNotesPreview frame={local} showScreenshot={showScreenshot} screenshotAppearFrame={UC1_SCREENSHOT_IN + 4} />
              {showSelection && (
                <div
                  style={{
                    position: 'absolute',
                    left: 40,
                    top: SELECTION_TOP,
                    width: selectionWidth,
                    height: SELECTION_HEIGHT,
                    background: colors.selection,
                    borderRadius: 3,
                    zIndex: 20,
                  }}
                />
              )}
              {local >= UC1_PASTE_KEY && local < UC1_SCREENSHOT_IN + 15 && (
                <div
                  style={{
                    position: 'absolute',
                    right: space[4],
                    top: space[3],
                    zIndex: 30,
                    opacity: interpolate(local, [UC1_PASTE_KEY, UC1_PASTE_KEY + 6, UC1_SCREENSHOT_IN + 5, UC1_SCREENSHOT_IN + 15], [0, 1, 1, 0], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    }),
                  }}
                >
                  <Keycap keys={['Ctrl', 'V']} />
                </div>
              )}
              {showSparkle && (
                <SparkleButton
                  x={sparkleX}
                  y={sparkleY}
                  opacity={interpolate(local, [UC1_SELECT_END, UC1_SELECT_END + 8], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  })}
                />
              )}
              {showMenu && (
                <PresetMenu
                  x={menuX}
                  y={menuY}
                  local={local}
                  openFrame={UC1_MENU_OPEN}
                  activeIndex={1}
                  activeFrame={UC1_PRESET_CLICK}
                />
              )}
              {showCard && (
                <div style={{ position: 'absolute', left: 40, top: 260, zIndex: 45 }}>
                  <SuggestionCard frame={local} appearFrame={UC1_CARD_APPEAR} width={620}>
                    <TypingText
                      text={
                        '## 참석자\n- 지원, 민준, 서연\n## 논의 사항\n- 신규 기능 우선순위 · 일정 조정 · 예산 검토\n## 다음 액션\n- 지원: 기획서 · 민준: 디자인 시안 · 서연: 예산안'
                      }
                      startFrame={abs(UC1_CARD_APPEAR)}
                      charsPerSecond={40}
                      cursor={false}
                    />
                    <div style={{ marginTop: space[3], display: 'flex', gap: space[2] }}>
                      {/* deriveCardActions('outline', false) (ai-suggestion-card.ts)
                          yields modes: ['replace', 'insert-below'], primary: 'replace' —
                          the real card renders BOTH apply buttons (replace accented),
                          in that order, followed by the ↻ retry button. */}
                      <PillButton label="✓ 바꾸기" variant="accent" visible={local >= UC1_REPLACE_CLICK - 30} />
                      <PillButton label="⤵ 아래에 삽입" visible={local >= UC1_REPLACE_CLICK - 30} />
                      <PillButton label="↻" visible={local >= UC1_REPLACE_CLICK - 30} />
                    </div>
                  </SuggestionCard>
                </div>
              )}
            </>
          )}
        </AppFrameSlot>
      </SegmentPanel>
      {/* F5 cursor-speed fix (owner feedback pass #3): each of the three
          segments below previously sprung across its ENTIRE gap (up to 185f)
          even though the on-screen distance between consecutive targets is
          small — reading as a slow drag while the selection/menu/card content
          the user actually needs to read is on screen. Now the cursor holds
          at the previous target through that reading window and only hops
          (<=12f) right before each click. */}
      <CursorPointer
        positions={[
          { frame: abs(0), x: 900, y: 470 },
          {
            frame: abs(UC1_SELECT_END - 20),
            x: CONTENT_X + 40 + selectionWidth,
            y: CONTENT_Y + SELECTION_TOP + SELECTION_HEIGHT,
          },
          {
            frame: abs(UC1_SPARKLE_CLICK - 12),
            x: CONTENT_X + 40 + selectionWidth,
            y: CONTENT_Y + SELECTION_TOP + SELECTION_HEIGHT,
          },
          {
            frame: abs(UC1_SPARKLE_CLICK),
            x: CONTENT_X + sparkleX + SPARKLE_SIZE / 2,
            y: CONTENT_Y + sparkleY + SPARKLE_SIZE / 2,
          },
          {
            frame: abs(UC1_PRESET_CLICK - 27),
            x: CONTENT_X + sparkleX + SPARKLE_SIZE / 2,
            y: CONTENT_Y + sparkleY + SPARKLE_SIZE / 2,
          },
          { frame: abs(UC1_PRESET_CLICK - 15), x: CONTENT_X + menuX + 90, y: CONTENT_Y + menuY + 53 },
          { frame: abs(UC1_PRESET_CLICK), x: CONTENT_X + menuX + 90, y: CONTENT_Y + menuY + 53 },
          { frame: abs(UC1_REPLACE_CLICK - 27), x: CONTENT_X + menuX + 90, y: CONTENT_Y + menuY + 53 },
          { frame: abs(UC1_REPLACE_CLICK - 15), x: replaceBtnX, y: replaceBtnY },
          { frame: abs(UC1_REPLACE_CLICK), x: replaceBtnX, y: replaceBtnY },
          { frame: abs(840), x: replaceBtnX, y: replaceBtnY },
        ]}
        clicks={[abs(UC1_SPARKLE_CLICK), abs(UC1_PRESET_CLICK), abs(UC1_REPLACE_CLICK)]}
      />
      {/* BUGFIX (post-review): UC1 previously had 240f + 185f silent subtitle
          gaps (90-330, 440-625), AND all SubtitleBar start/end frames were
          UC1-local numbers fed to a component that reads the ABSOLUTE scene
          frame internally, so none of them ever matched during the real
          UC1 window in the first place. Both issues fixed below: contiguous
          coverage from 0 to 830, all frames converted via abs(). */}
      <SubtitleBar text="날 것 메모를 붙여넣고" startFrame={abs(0)} endFrame={abs(90)} />
      <SubtitleBar text="스크린샷도 Ctrl+V로 바로 붙여요" startFrame={abs(90)} endFrame={abs(180)} />
      <SubtitleBar text="정리할 부분을 전체 선택하고" startFrame={abs(180)} endFrame={abs(UC1_MENU_OPEN + 10)} />
      <SubtitleBar text="📋 개요로 정리를 누르면" startFrame={abs(UC1_MENU_OPEN + 10)} endFrame={abs(UC1_CARD_APPEAR + 10)} />
      <SubtitleBar text="제안 카드가 스트리밍되며 만들어져요" startFrame={abs(UC1_CARD_APPEAR + 10)} endFrame={abs(UC1_REPLACE_CLICK)} />
      <SubtitleBar text="✓ 바꾸기를 누르면" startFrame={abs(UC1_REPLACE_CLICK)} endFrame={abs(UC1_TRANSFORM + 10)} />
      <SubtitleBar text="깔끔한 문서가 됩니다" startFrame={abs(UC1_TRANSFORM + 10)} endFrame={abs(830)} />
    </>
  );
}

// =====================================================================
// S3c-UC2 — 블로그 이어쓰기 (1950-2850f), full AppFrame replay.
//
// BUGFIX (post-review): the previous version fed EditorPane two separate
// line-array entries (paragraph + ghost-continuation-as-its-own-row). When
// the ghost row's text was still empty, its own default TypingText cursor
// rendered as a SECOND, visually detached caret sitting alone on the blank
// row below the paragraph — while the real caret sat correctly at the end
// of line 1. Fix: render the paragraph + continuation as sibling inline
// <span>s inside ONE row (BlogEditorPane below) so there is exactly one
// caret, always trailing the visible text. Subtitle coverage was also
// gapped (only 2 of 5 beats had a subtitle, leaving ~500/900f silent) —
// every beat below now has a subtitle spanning its full window.
// =====================================================================

const BLOG_INTRO = 'mdedit는 로컬 우선 마크다운 편집기입니다. 무거운 서버 없이도';
const GHOST_V1 = ' 빠르고 안전하게 문서를 작성할 수 있습니다.';
const GHOST_V2 = ' 개인 정보를 그대로 지키면서 편하게 글을 쓸 수 있습니다.';

// UC2 sub-beats, relative to UC2.start (0..900f). Five legible windows,
// touching edges (no gaps): [0,160) [160,280) [280,460) [460,560) [560,900].
const UC2_PAUSE_START = 10;
const UC2_PAUSE_END = 100; // 90f = 3s pause, per docs/USER_GUIDE.md §4.2
const UC2_HINT_IN = 165;
const UC2_CLICK = 265;
const UC2_GHOST1_START = 285;
const UC2_CONFIRM = 480;
const UC2_REGEN_VISIBLE = 560;
const UC2_REGEN_CLICK = 590;
const UC2_GHOST2_START = 610;

// Anchor point for all caret-adjacent overlays (hint pill / keycap / ↻),
// placed just below the paragraph's single text row so they read as
// "attached to the caret" without needing per-character pixel math.
const UC2_ANCHOR_X = CONTENT_X + 40;
const UC2_ANCHOR_Y = CONTENT_Y + 60;

/** Single-row editor line: static paragraph + ghost continuation as inline siblings (one caret, always trailing text). */
function BlogEditorPane({ local }: { local: number }): JSX.Element {
  const showGhost1 = local >= UC2_GHOST1_START && local < UC2_GHOST2_START;
  const showGhost2 = local >= UC2_GHOST2_START;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        background: colors.surfaceRaised,
        fontFamily: font.mono,
        fontSize: fontSize.editor,
        lineHeight: lineHeight.editor,
        color: colors.textPrimary,
        padding: `${space[3]}px ${space[4]}px`,
      }}
    >
      <span style={{ whiteSpace: 'pre-wrap' }}>{BLOG_INTRO}</span>
      {/* BUGFIX (post-review): GhostText forwards `startFrame` straight into
          TypingText, which reads useCurrentFrame() internally (ABSOLUTE
          S3-scene frame). `frame`/`confirmFrame` below are only used for
          GhostText's own local color-switch check, so they may stay in
          UC2-local scale — but `startFrame` must be UC2.start + local. */}
      {showGhost2 ? (
        <GhostText text={GHOST_V2} startFrame={UC2.start + UC2_GHOST2_START} frame={local} charsPerSecond={22} />
      ) : showGhost1 ? (
        <GhostText
          text={GHOST_V1}
          startFrame={UC2.start + UC2_GHOST1_START}
          frame={local}
          confirmFrame={UC2_CONFIRM}
          charsPerSecond={22}
        />
      ) : (
        <TypingText text="" startFrame={-1000} staticText cursor />
      )}
    </div>
  );
}

function BlogPreview({ local }: { local: number }): JSX.Element {
  const showGhost1 = local >= UC2_GHOST1_START;
  const confirmed = local >= UC2_CONFIRM && local < UC2_GHOST2_START;
  const showGhost2 = local >= UC2_GHOST2_START;
  return (
    <PreviewPane style={{ maxWidth: 'none' }}>
      <PreviewParagraph>
        {BLOG_INTRO}
        {(showGhost1 || confirmed || showGhost2) && (
          <span style={{ color: showGhost2 ? colors.textFaint : confirmed ? colors.textPrimary : colors.textFaint }}>
            {showGhost2 ? GHOST_V2 : GHOST_V1}
          </span>
        )}
      </PreviewParagraph>
    </PreviewPane>
  );
}

function UC2Segment({ frame }: { frame: number }): JSX.Element | null {
  if (frame < UC2.start - 20 || frame > UC2.end + 20) return null;
  const local = frame - UC2.start;
  // BUGFIX (post-review): same absolute-vs-local mismatch as UC1Segment —
  // SubtitleBar/CursorPointer read useCurrentFrame() (absolute S3 frame)
  // internally, so every frame value handed to them must go through abs().
  const abs = (n: number): number => UC2.start + n;

  const pulsePhase =
    local >= UC2_PAUSE_START && local < UC2_PAUSE_END ? Math.sin((local - UC2_PAUSE_START) / 6) * 0.5 + 0.5 : 0;
  const pauseSecondsElapsed = Math.min(3, Math.max(0, Math.floor((local - UC2_PAUSE_START) / 30) + (local >= UC2_PAUSE_START ? 1 : 0)));

  return (
    <>
      <SegmentPanel frame={local} start={0} end={900} fade={20}>
        <AppFrameSlot header={<HeaderBar viewMode="split" filename="블로그-초안.md" />} sidebar={<FileExplorer selected="블로그-초안.md" />}>
          <BlogEditorPane local={local} />
          <BlogPreview local={local} />
        </AppFrameSlot>
      </SegmentPanel>

      {/* (a) idle caret pulse + "N초" micro-label during the 3s pause */}
      {local >= UC2_PAUSE_START && local < UC2_HINT_IN && (
        <div
          style={{
            position: 'absolute',
            left: UC2_ANCHOR_X,
            top: UC2_ANCHOR_Y,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: interpolate(local, [UC2_PAUSE_START, UC2_PAUSE_START + 8, UC2_PAUSE_END + 20, UC2_HINT_IN], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <div style={{ width: 8, height: 20, background: colors.accent, opacity: 0.4 + pulsePhase * 0.5 }} />
          {local < UC2_PAUSE_END && (
            <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.textFaint }}>{pauseSecondsElapsed}초</span>
          )}
        </div>
      )}

      {/* (b) hint pill, ≥2s dwell (100f @ 30fps) */}
      {local >= UC2_HINT_IN && local < UC2_CLICK + 15 && (
        <div style={{ position: 'absolute', left: UC2_ANCHOR_X, top: UC2_ANCHOR_Y }}>
          <HintPill
            opacity={interpolate(local, [UC2_HINT_IN, UC2_HINT_IN + 10, UC2_CLICK, UC2_CLICK + 15], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}
          />
        </div>
      )}

      {/* (d) Ctrl+Enter confirm keycap */}
      {local >= UC2_CONFIRM - 20 && local < UC2_CONFIRM + 20 && (
        <div style={{ position: 'absolute', left: UC2_ANCHOR_X, top: UC2_ANCHOR_Y }}>
          <Keycap keys={['Ctrl', 'Enter']} />
        </div>
      )}

      {/* (e) ↻ regenerate button */}
      {local >= UC2_REGEN_VISIBLE && local < UC2_GHOST2_START + 10 && (
        <div style={{ position: 'absolute', left: UC2_ANCHOR_X, top: UC2_ANCHOR_Y }}>
          <PillButton label="↻" />
        </div>
      )}

      {/* F5 cursor-speed fix: the entry move previously took 240f to cross the
          frame (now <=20f, then dwells through the 3s pause/hint-pill read);
          the post-click -> Ctrl+Enter-confirm travel previously took 200f for
          a ~20px distance (now dwells, then a single <=12f hop). */}
      <CursorPointer
        positions={[
          { frame: abs(0), x: 900, y: 470 },
          { frame: abs(20), x: UC2_ANCHOR_X + 40, y: UC2_ANCHOR_Y + 12 },
          { frame: abs(UC2_CLICK - 25), x: UC2_ANCHOR_X + 40, y: UC2_ANCHOR_Y + 12 },
          { frame: abs(UC2_CLICK), x: UC2_ANCHOR_X + 40, y: UC2_ANCHOR_Y + 12 },
          { frame: abs(UC2_CONFIRM - 27), x: UC2_ANCHOR_X + 40, y: UC2_ANCHOR_Y + 12 },
          { frame: abs(UC2_CONFIRM - 15), x: UC2_ANCHOR_X + 20, y: UC2_ANCHOR_Y + 12 },
          { frame: abs(UC2_REGEN_VISIBLE + 10), x: UC2_ANCHOR_X + 20, y: UC2_ANCHOR_Y + 12 },
          { frame: abs(UC2_REGEN_CLICK - 10), x: UC2_ANCHOR_X + 20, y: UC2_ANCHOR_Y + 12 },
          { frame: abs(UC2_REGEN_CLICK), x: UC2_ANCHOR_X + 20, y: UC2_ANCHOR_Y + 12 },
          { frame: abs(900), x: UC2_ANCHOR_X + 20, y: UC2_ANCHOR_Y + 12 },
        ]}
        clicks={[abs(UC2_CLICK), abs(UC2_CONFIRM), abs(UC2_REGEN_CLICK)]}
      />

      {/* Five subtitles covering the full 0-900 range with no gaps (fade=10 gives
          ~20f crossfade overlap at each boundary). All converted via abs() —
          SubtitleBar reads the absolute S3-scene frame internally. */}
      <SubtitleBar text="문장을 쓰다 잠깐 멈추면…" startFrame={abs(0)} endFrame={abs(UC2_HINT_IN)} />
      <SubtitleBar text="힌트가 나타나요 — 클릭하거나 Ctrl+Enter" startFrame={abs(UC2_HINT_IN)} endFrame={abs(UC2_GHOST1_START)} />
      <SubtitleBar text="AI가 문체를 이어받아 계속 써줘요" startFrame={abs(UC2_GHOST1_START)} endFrame={abs(UC2_CONFIRM)} />
      <SubtitleBar text="Ctrl+Enter로 확정" startFrame={abs(UC2_CONFIRM)} endFrame={abs(UC2_REGEN_VISIBLE)} />
      <SubtitleBar text="마음에 안 들면 ↻로 다시 받으세요" startFrame={abs(UC2_REGEN_VISIBLE)} endFrame={abs(900)} />
    </>
  );
}

// =====================================================================
// Scene chip gate — hidden during S3a, appears from S3b.
// =====================================================================

function SceneChipGate({ frame }: { frame: number }): JSX.Element | null {
  if (frame < S3B.start - 20) return null;
  const opacity = interpolate(frame, [S3B.start - 20, S3B.start], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ opacity }}>
      <SceneChip title="3. AI 어시스턴트" />
    </div>
  );
}

export function S3AI(): JSX.Element {
  const frame = useCurrentFrame();
  useVideoConfig();

  return (
    <AbsoluteFill style={{ background: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: FRAME_W, height: FRAME_H }}>
        <FeatureMontage frame={frame} />
        <UC1Segment frame={frame} />
        <UC2Segment frame={frame} />
      </div>
      <HeroSegment frame={frame} />
      <SceneChipGate frame={frame} />
    </AbsoluteFill>
  );
}
