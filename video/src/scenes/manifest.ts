import type { ComponentType } from 'react';
import { S0Intro, S0_DURATION_IN_FRAMES } from './S0Intro';
import { S1Markdown, S1_DURATION_IN_FRAMES } from './S1Markdown';
import { S2UITour, S2_DURATION_IN_FRAMES } from './S2UITour';
import { S3AI, S3_DURATION_IN_FRAMES } from './S3AI';
import { S4Outro, S4_DURATION_IN_FRAMES } from './S4Outro';

/**
 * Extension point for later units (S1-S4): append an entry to this array —
 * do NOT edit Root.tsx. The `Full` composition in Root.tsx reads this
 * manifest and lays out a <Sequence> for every entry in order, so a new
 * scene is wired into the full video automatically.
 *
 * Contract for each entry:
 *   - id: unique scene id matching STORYBOARD.md section numbering (e.g. 'S1', 'S2a')
 *   - component: a React component with no required props, self-contained
 *     (it may internally read useCurrentFrame()/useVideoConfig() as usual;
 *     Remotion resets the local frame counter to 0 at the start of each
 *     Sequence, so scenes should treat frame 0 as their own start)
 *   - durationInFrames: exact scene length used both for its own
 *     <Sequence> and to offset every subsequent scene's start frame
 *
 * To add a scene:
 *   1. Create src/scenes/SXFoo.tsx exporting the component + a
 *      `SX_DURATION_IN_FRAMES` constant (follow S0Intro.tsx's pattern)
 *   2. Import both here and push a new { id, component, durationInFrames }
 *      entry onto `sceneManifest` below, in storyboard order
 *   3. Run `npm run start` (Remotion Studio) to preview the scene standalone
 *      via its own registered Composition in Root.tsx, or preview it inline
 *      inside `Full`
 */
export interface SceneManifestEntry {
  id: string;
  component: ComponentType;
  durationInFrames: number;
}

export const sceneManifest: SceneManifestEntry[] = [
  { id: 'S0', component: S0Intro, durationInFrames: S0_DURATION_IN_FRAMES },
  { id: 'S1', component: S1Markdown, durationInFrames: S1_DURATION_IN_FRAMES },
  { id: 'S2', component: S2UITour, durationInFrames: S2_DURATION_IN_FRAMES },
  { id: 'S3', component: S3AI, durationInFrames: S3_DURATION_IN_FRAMES },
  { id: 'S4', component: S4Outro, durationInFrames: S4_DURATION_IN_FRAMES },
];

export const totalDurationInFrames = sceneManifest.reduce(
  (sum, scene) => sum + scene.durationInFrames,
  0,
);
