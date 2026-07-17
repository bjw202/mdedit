import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { colors, font, radius, space } from '../tokens';

export interface SubtitleBarProps {
  text: string;
  startFrame: number;
  endFrame: number;
  fadeFrames?: number;
}

/** Bottom subtitle bar, shared across every scene, with fade in/out over [startFrame, endFrame]. */
export function SubtitleBar({
  text,
  startFrame,
  endFrame,
  fadeFrames = 10,
}: SubtitleBarProps): JSX.Element | null {
  const frame = useCurrentFrame();
  if (frame < startFrame - fadeFrames || frame > endFrame + fadeFrames) return null;

  const opacity = interpolate(
    frame,
    [startFrame - fadeFrames, startFrame, endFrame, endFrame + fadeFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 56,
        transform: 'translateX(-50%)',
        opacity,
        maxWidth: '80%',
        background: 'rgba(20, 22, 24, 0.82)',
        color: '#fbfbfc',
        fontFamily: font.ui,
        fontSize: 22,
        lineHeight: 1.4,
        padding: `${space[3]}px ${space[5]}px`,
        borderRadius: radius.md,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
}

export interface SceneChipProps {
  title: string;
}

/** Top-left scene title chip, shared across every scene. */
export function SceneChip({ title }: SceneChipProps): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        top: 40,
        background: colors.accent,
        color: colors.accentContrast,
        fontFamily: font.display,
        fontWeight: 600,
        fontSize: 20,
        padding: `${space[2]}px ${space[4]}px`,
        borderRadius: radius.lg,
      }}
    >
      {title}
    </div>
  );
}
