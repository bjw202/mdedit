import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, font } from '../tokens';

export const S0_DURATION_IN_FRAMES = 240; // ~8s @ 30fps

// F3: the AI appendix is a surprise (revealed in S3a's hero reveal) — the
// opening must NOT name it. Two real chapter chips + one "mystery" chip.
const CHAPTERS = ['마크다운 기초', '화면 사용법'];
const MYSTERY_CHIP = '？';

function ChapterChip({
  label,
  appearFrame,
  mystery = false,
}: {
  label: string;
  appearFrame: number;
  mystery?: boolean;
}): JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 12, stiffness: 140, mass: 0.7 },
  });
  const opacity = interpolate(frame, [appearFrame, appearFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: mystery ? '14px 24px' : '14px 28px',
        minWidth: mystery ? 60 : undefined,
        borderRadius: 999,
        background: mystery ? 'transparent' : colors.accentSoft,
        border: mystery ? `1px dashed ${colors.textFaint}` : `1px solid ${colors.accent}`,
        color: mystery ? colors.textFaint : colors.accentActive,
        fontFamily: font.ui,
        fontWeight: 600,
        fontSize: 22,
        opacity,
        transform: `scale(${interpolate(pop, [0, 1], [0.7, 1])})`,
      }}
    >
      {label}
    </div>
  );
}

/**
 * S0 Intro (~8s / 240f): logo/name fade -> tagline -> 3 chapter chips pop sequentially.
 * STORYBOARD.md §S0.
 */
export function S0Intro(): JSX.Element {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const logoOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const logoY = interpolate(frame, [0, 30], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const taglineOpacity = interpolate(frame, [35, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const chipStart = 90;
  const chipStagger = 22;

  const outroFadeStart = durationInFrames - 20;
  const outroOpacity = interpolate(frame, [outroFadeStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: outroOpacity,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <div
          style={{
            opacity: logoOpacity,
            transform: `translateY(${logoY}px)`,
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 96,
            color: colors.textPrimary,
            letterSpacing: '-0.02em',
          }}
        >
          mdedit
        </div>
        <div
          style={{
            opacity: taglineOpacity,
            fontFamily: font.ui,
            fontSize: 28,
            color: colors.textMuted,
          }}
        >
          가볍고 빠른 마크다운 편집기
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
          {CHAPTERS.map((label, i) => (
            <ChapterChip key={label} label={label} appearFrame={chipStart + i * chipStagger} />
          ))}
          <ChapterChip
            key="mystery"
            label={MYSTERY_CHIP}
            appearFrame={chipStart + CHAPTERS.length * chipStagger}
            mystery
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}
