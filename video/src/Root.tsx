import React from 'react';
import { AbsoluteFill, Composition, Sequence } from 'remotion';
import { S0Intro, S0_DURATION_IN_FRAMES } from './scenes/S0Intro';
import { S1Markdown, S1_DURATION_IN_FRAMES } from './scenes/S1Markdown';
import { S2UITour, S2_DURATION_IN_FRAMES } from './scenes/S2UITour';
import { S3AI, S3_DURATION_IN_FRAMES } from './scenes/S3AI';
import { S4Outro, S4_DURATION_IN_FRAMES } from './scenes/S4Outro';
import { sceneManifest, totalDurationInFrames } from './scenes/manifest';
import { useCaseManifest, useCaseTotalDurationInFrames } from './usecase/manifest';

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

/**
 * Full composition: sequences every scene from `sceneManifest` in order.
 * Later units append scenes to the manifest — this component never changes.
 */
function Full(): JSX.Element {
  let cursor = 0;
  const sequences = sceneManifest.map((scene) => {
    const from = cursor;
    cursor += scene.durationInFrames;
    const Scene = scene.component;
    return (
      <Sequence key={scene.id} from={from} durationInFrames={scene.durationInFrames} name={scene.id}>
        <Scene />
      </Sequence>
    );
  });

  return <AbsoluteFill style={{ background: '#000' }}>{sequences}</AbsoluteFill>;
}

/**
 * UseCase composition: the SECOND, standalone video (AI use-case showcase).
 * Sequences every scene from `useCaseManifest` in order — same contract as
 * `Full` above. Additive: does not touch the tutorial's S0-S4/Full wiring.
 */
function UseCase(): JSX.Element {
  let cursor = 0;
  const sequences = useCaseManifest.map((scene) => {
    const from = cursor;
    cursor += scene.durationInFrames;
    const Scene = scene.component;
    return (
      <Sequence key={scene.id} from={from} durationInFrames={scene.durationInFrames} name={scene.id}>
        <Scene />
      </Sequence>
    );
  });

  return <AbsoluteFill style={{ background: '#000' }}>{sequences}</AbsoluteFill>;
}

export function RemotionRoot(): JSX.Element {
  return (
    <>
      {/* Individual scene compositions — enables per-scene preview/render (기술 규약). */}
      <Composition
        id="S0"
        component={S0Intro}
        durationInFrames={S0_DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="S1"
        component={S1Markdown}
        durationInFrames={S1_DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="S2"
        component={S2UITour}
        durationInFrames={S2_DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="S3"
        component={S3AI}
        durationInFrames={S3_DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Composition
        id="S4"
        component={S4Outro}
        durationInFrames={S4_DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* Full video — sequences all scenes registered in scenes/manifest.ts. */}
      <Composition
        id="Full"
        component={Full}
        durationInFrames={Math.max(totalDurationInFrames, 1)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* ── Second video: AI use-case showcase (usecase/manifest.ts) ───────── */}
      {/* Per-scene compositions for standalone preview/render of the new video. */}
      {useCaseManifest.map((scene) => (
        <Composition
          key={scene.id}
          id={scene.id}
          component={scene.component}
          durationInFrames={scene.durationInFrames}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      ))}

      {/* Full second video — sequences all scenes from usecase/manifest.ts. */}
      <Composition
        id="UseCase"
        component={UseCase}
        durationInFrames={Math.max(useCaseTotalDurationInFrames, 1)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
}
