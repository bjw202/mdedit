import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, darkColors, font, space } from '../tokens';
import { TypingText } from '../kit';

/**
 * U0 — 훅 (~8s / 240f). "AI가 있다는데, 그래서 뭐?" 문제 제기 → 회의자료 상황 설정.
 * AI 유즈케이스 영상의 도입부. 어두운 배경 위 대형 텍스트 리빌(정적 카피, 단정한 평서형).
 */
export const U0_DURATION_IN_FRAMES = 240;

function BeatQuestion({ frame }: { frame: number }): JSX.Element | null {
  const START = 10;
  const END = 96;
  if (frame < START - 10 || frame > END + 12) return null;
  const opacity = interpolate(frame, [START - 8, START + 10, END - 12, END + 8], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity }}>
      <div style={{ fontFamily: font.ui, fontSize: 34, color: darkColors.textMuted }}>
        AI 어시스턴트가 있다는데,
      </div>
      <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 76, color: darkColors.textPrimary, marginTop: space[3] }}>
        <TypingText text="그래서 뭐가 달라지나" startFrame={START + 6} charsPerSecond={16} cursor={false} />
      </div>
    </div>
  );
}

function BeatSituation({ frame }: { frame: number }): JSX.Element | null {
  const START = 112;
  const END = 232;
  if (frame < START - 10) return null;
  const opacity = interpolate(frame, [START - 8, START + 12, END - 18, END], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pop = spring({ frame: frame - START, fps: 30, config: { damping: 14, stiffness: 110, mass: 0.8 } });
  const scale = interpolate(pop, [0, 1], [0.85, 1]);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity }}>
      <div style={{ fontFamily: font.ui, fontSize: 30, color: darkColors.textMuted }}>회의자료 한 장,</div>
      <div
        style={{
          transform: `scale(${scale})`,
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 72,
          marginTop: space[3],
          backgroundImage: `linear-gradient(90deg, ${colors.aiGlowFrom}, ${colors.aiGlowTo})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        30분 걸리던 일
      </div>
      <div style={{ fontFamily: font.ui, fontSize: 24, color: darkColors.textFaint, marginTop: space[5], opacity: interpolate(frame, [START + 40, START + 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        빠르게 쓰고, 자동으로 그리고, 금방 다듬는다
      </div>
    </div>
  );
}

export function UHook(): JSX.Element {
  const frame = useCurrentFrame();
  useVideoConfig();
  return (
    <AbsoluteFill style={{ background: darkColors.bg }}>
      <BeatQuestion frame={frame} />
      <BeatSituation frame={frame} />
    </AbsoluteFill>
  );
}
