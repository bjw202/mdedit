import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors } from '../tokens';

export interface CursorPointerProps {
  /** Keyframes of {frame, x, y} the cursor springs between. Must be sorted by frame ascending. */
  positions: Array<{ frame: number; x: number; y: number }>;
  /** Frames (relative to sequence) at which a click ripple should fire. */
  clicks?: number[];
}

/** Fake mouse cursor, animated between positions with a spring, plus click ripples. */
export function CursorPointer({ positions, clicks = [] }: CursorPointerProps): JSX.Element | null {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (positions.length === 0) return null;

  // Find the segment [prev, next] surrounding `frame` and spring between them.
  let prev = positions[0];
  let next = positions[positions.length - 1];
  for (let i = 0; i < positions.length - 1; i++) {
    if (frame >= positions[i].frame && frame <= positions[i + 1].frame) {
      prev = positions[i];
      next = positions[i + 1];
      break;
    }
  }
  if (frame <= positions[0].frame) {
    prev = positions[0];
    next = positions[0];
  }
  if (frame >= positions[positions.length - 1].frame) {
    prev = positions[positions.length - 1];
    next = positions[positions.length - 1];
  }

  const segmentProgress =
    next.frame === prev.frame
      ? 1
      : spring({
          frame: frame - prev.frame,
          fps,
          config: { damping: 200, stiffness: 120, mass: 0.6 },
          durationInFrames: Math.max(1, next.frame - prev.frame),
        });

  const x = interpolate(segmentProgress, [0, 1], [prev.x, next.x]);
  const y = interpolate(segmentProgress, [0, 1], [prev.y, next.y]);

  const activeClick = clicks.find((c) => frame >= c && frame - c <= 18);
  const rippleProgress = activeClick !== undefined ? (frame - activeClick) / 18 : null;

  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 50, pointerEvents: 'none' }}>
      <svg width={28} height={28} viewBox="0 0 28 28" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}>
        <path d="M4 2l18 8-7.5 2.5L12 20z" fill="#1d1f20" stroke="#fff" strokeWidth={1} />
      </svg>
      {rippleProgress !== null && (
        <div
          style={{
            position: 'absolute',
            left: 6,
            top: 6,
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: `2px solid ${colors.accent}`,
            opacity: interpolate(rippleProgress, [0, 1], [0.9, 0]),
            transform: `scale(${interpolate(rippleProgress, [0, 1], [0.3, 2.2])})`,
          }}
        />
      )}
    </div>
  );
}
