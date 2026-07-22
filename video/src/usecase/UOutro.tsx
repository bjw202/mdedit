import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, darkColors, font, space } from '../tokens';
import { TypingText } from '../kit';

/**
 * U4 — 마무리 (~10s / 300f). 요약 카피 + 로고/태그라인 아웃.
 * 수치는 과장 없이 상징적으로("쓰는 시간은 줄이고, 다듬는 시간만 남긴다").
 */
export const U4_DURATION_IN_FRAMES = 300;

const RECAP = ['영업 · 제안 요약 + 일정표', '홍보 · 성과 표 + 비중 차트', '어디서나 · 막힌 문장 잇기'];

function RecapChips({ frame }: { frame: number }): JSX.Element | null {
  const START = 12;
  const END = 120;
  if (frame < START - 8 || frame > END + 12) return null;
  const opacity = interpolate(frame, [START - 8, START + 10, END - 12, END + 8], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: space[4], opacity }}>
      <div style={{ display: 'flex', gap: space[4] }}>
        {RECAP.map((r, i) => {
          const pop = spring({ frame: frame - START - i * 8, fps: 30, config: { damping: 14, stiffness: 120, mass: 0.7 } });
          return (
            <div
              key={r}
              style={{
                transform: `scale(${interpolate(pop, [0, 1], [0.8, 1])})`,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 999,
                padding: `${space[3]}px ${space[5]}px`,
                fontFamily: font.ui,
                fontSize: 24,
                color: colors.textPrimary,
              }}
            >
              {r}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BigCopy({ frame }: { frame: number }): JSX.Element | null {
  const START = 130;
  const END = 232;
  if (frame < START - 8 || frame > END + 12) return null;
  const opacity = interpolate(frame, [START - 8, START + 12, END - 14, END], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity, padding: 120 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: font.ui, fontSize: 26, color: darkColors.textMuted, marginBottom: space[4] }}>
          빠르게 쓰고, 자동으로 그리고, 금방 다듬는다
        </div>
        <div
          style={{
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 56,
            lineHeight: 1.25,
            backgroundImage: `linear-gradient(90deg, ${colors.aiGlowFrom}, ${colors.aiGlowTo})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          쓰는 시간은 줄이고,
          <br />
          다듬는 시간만 남긴다
        </div>
      </div>
    </div>
  );
}

function LogoOut({ frame }: { frame: number }): JSX.Element | null {
  const START = 236;
  if (frame < START - 8) return null;
  const opacity = interpolate(frame, [START - 8, START + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pop = spring({ frame: frame - START, fps: 30, config: { damping: 13, stiffness: 120, mass: 0.8 } });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity }}>
      <div style={{ transform: `scale(${interpolate(pop, [0, 1], [0.8, 1])})`, fontFamily: font.display, fontWeight: 700, fontSize: 92, color: darkColors.textPrimary, letterSpacing: '-0.02em' }}>
        <TypingText text="mdedit" startFrame={START + 2} charsPerSecond={16} cursor={false} />
      </div>
      <div style={{ fontFamily: font.ui, fontSize: 22, color: darkColors.textFaint, marginTop: space[4], opacity: interpolate(frame, [START + 22, START + 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        AI 어시스턴트 · 로컬 Claude Code CLI로 동작
      </div>
    </div>
  );
}

export function UOutro(): JSX.Element {
  const frame = useCurrentFrame();
  useVideoConfig();
  return (
    <AbsoluteFill style={{ background: darkColors.bg }}>
      <RecapChips frame={frame} />
      <BigCopy frame={frame} />
      <LogoOut frame={frame} />
    </AbsoluteFill>
  );
}
