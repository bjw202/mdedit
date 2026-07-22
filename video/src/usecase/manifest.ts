import type { ComponentType } from 'react';
import { UHook, U0_DURATION_IN_FRAMES } from './UHook';
import { UCase1Sales, C1_DURATION_IN_FRAMES } from './UCase1Sales';
import { UCase2Promo, C2_DURATION_IN_FRAMES } from './UCase2Promo';
import { UOutro, U4_DURATION_IN_FRAMES } from './UOutro';

/**
 * AI 유즈케이스 영상(v2 — 페르소나 기반 실무 케이스)의 씬 매니페스트. scenes/manifest.ts 와
 * 동일 계약: Root.tsx 의 `UseCase` 컴포지션이 이 배열을 읽어 순서대로 <Sequence> 를 깔아 전체
 * 영상을 구성한다. 씬은 각각 props 없이 useCurrentFrame()/useVideoConfig() 를 자유롭게 쓴다
 * (Sequence 시작마다 로컬 프레임이 0 으로 리셋).
 */
export interface UseCaseSceneEntry {
  id: string;
  component: ComponentType;
  durationInFrames: number;
}

export const useCaseManifest: UseCaseSceneEntry[] = [
  { id: 'U0', component: UHook, durationInFrames: U0_DURATION_IN_FRAMES },
  { id: 'C1', component: UCase1Sales, durationInFrames: C1_DURATION_IN_FRAMES },
  { id: 'C2', component: UCase2Promo, durationInFrames: C2_DURATION_IN_FRAMES },
  { id: 'U4', component: UOutro, durationInFrames: U4_DURATION_IN_FRAMES },
];

export const useCaseTotalDurationInFrames = useCaseManifest.reduce(
  (sum, scene) => sum + scene.durationInFrames,
  0,
);
