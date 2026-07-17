import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * Deterministic pseudo-random in [0, 1) — frame-based rendering must be
 * reproducible across render workers, so Math.random() is not safe here.
 */
function seededJitter(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export interface TypingTextProps {
  text: string;
  /** Absolute frame (in the current sequence's local time) typing begins. */
  startFrame: number;
  /** Average characters typed per second. Default 14 (natural typing pace). */
  charsPerSecond?: number;
  /** Vary per-character speed +/-40% for a natural (non-metronomic) rhythm. Default true. */
  variableRhythm?: boolean;
  /** Render the full text immediately (no animation) — for pre-typed static content. */
  staticText?: boolean;
  /** Show a blinking text cursor at the end of the visible text. Default true. */
  cursor?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Progressive typing effect: given `text` + `startFrame` + a speed profile,
 * renders the characters revealed so far plus an optional blinking cursor.
 * Supports pre-typed static text via `staticText`.
 */
export function TypingText({
  text,
  startFrame,
  charsPerSecond = 14,
  variableRhythm = true,
  staticText = false,
  cursor = true,
  className,
  style,
}: TypingTextProps): JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cumulativeFrames = useMemo(() => {
    const baseFramesPerChar = fps / charsPerSecond;
    let acc = 0;
    return Array.from(text).map((_, i) => {
      const jitter = variableRhythm ? 0.6 + seededJitter(i) * 0.8 : 1;
      acc += baseFramesPerChar * jitter;
      return acc;
    });
  }, [text, fps, charsPerSecond, variableRhythm]);

  const totalDuration = cumulativeFrames.length
    ? cumulativeFrames[cumulativeFrames.length - 1]
    : 0;

  const relative = frame - startFrame;

  let visibleCount: number;
  let isDone: boolean;
  if (staticText) {
    visibleCount = text.length;
    isDone = true;
  } else if (relative < 0) {
    visibleCount = 0;
    isDone = false;
  } else {
    visibleCount = cumulativeFrames.findIndex((t) => t > relative);
    if (visibleCount === -1) visibleCount = text.length;
    isDone = relative >= totalDuration;
  }

  const visibleText = text.slice(0, visibleCount);
  const showCursor = cursor && (relative >= 0 || staticText);
  // Blink period ~0.6s, half on / half off.
  const blinkPeriod = Math.round(fps * 0.6);
  const cursorOn = !isDone || Math.floor(frame / (blinkPeriod / 2)) % 2 === 0;

  return (
    <span className={className} style={{ whiteSpace: 'pre-wrap', ...style }}>
      {visibleText}
      {showCursor && (
        <span
          style={{
            display: 'inline-block',
            width: '0.55em',
            height: '1em',
            marginLeft: 1,
            verticalAlign: 'text-bottom',
            background: cursorOn ? 'currentColor' : 'transparent',
          }}
        />
      )}
    </span>
  );
}

/** Total frames a TypingText animation will take to fully reveal `text`. */
export function typingDurationInFrames(
  text: string,
  fps: number,
  charsPerSecond = 14,
  variableRhythm = true,
): number {
  const baseFramesPerChar = fps / charsPerSecond;
  let acc = 0;
  Array.from(text).forEach((_, i) => {
    const jitter = variableRhythm ? 0.6 + seededJitter(i) * 0.8 : 1;
    acc += baseFramesPerChar * jitter;
  });
  return Math.ceil(acc);
}
