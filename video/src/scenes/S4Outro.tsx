import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, font } from '../tokens';

export const S4_DURATION_IN_FRAMES = 300; // ~10s @ 30fps

const CHAPTERS = ['마크다운 기초', '화면 사용법', 'AI 어시스턴트'];

function ChapterChip({ label, appearFrame }: { label: string; appearFrame: number }): JSX.Element {
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
        padding: '14px 28px',
        borderRadius: 999,
        background: colors.accentSoft,
        border: `1px solid ${colors.accent}`,
        color: colors.accentActive,
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
 * S4 — 아웃트로 (~10s / 300f). STORYBOARD.md §S4.
 * Reprise of S0's 3 chapter chips -> manual pointer line -> calm logo fade-out.
 * Mirrors S0Intro.tsx's chip-pop convention so the video's open/close bookends match.
 */
export function S4Outro(): JSX.Element {
  const frame = useCurrentFrame();

  const introOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const chipStart = 40;
  const chipStagger = 20;

  const manualOpacity = interpolate(frame, [160, 190], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const logoOpacity = interpolate(frame, [220, 250], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const finalFadeOpacity = interpolate(frame, [270, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: introOpacity * finalFadeOpacity,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {CHAPTERS.map((label, i) => (
            <ChapterChip key={label} label={label} appearFrame={chipStart + i * chipStagger} />
          ))}
        </div>
        <div
          style={{
            opacity: manualOpacity,
            fontFamily: font.ui,
            fontSize: 22,
            color: colors.textMuted,
          }}
        >
          전체 매뉴얼: docs/USER_GUIDE.md
        </div>
        <div
          style={{
            opacity: logoOpacity,
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 64,
            color: colors.textPrimary,
            letterSpacing: '-0.02em',
            marginTop: 12,
          }}
        >
          mdedit
        </div>
      </div>
    </AbsoluteFill>
  );
}
