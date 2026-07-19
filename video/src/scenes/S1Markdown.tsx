import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, font, radius } from '../tokens';
import {
  AppFrame,
  EditorPane,
  PreviewPane,
  PreviewH1,
  PreviewH2,
  PreviewH3,
  PreviewParagraph,
  PreviewBold,
  PreviewItalic,
  PreviewStrike,
  PreviewList,
  PreviewTable,
  PreviewCodeBlock,
  PreviewInlineCode,
  PreviewImage,
  SubtitleBar,
  SceneChip,
  typingDurationInFrames,
} from '../kit';

/**
 * S1 — 마크다운 문법 쇼케이스 (~60s / 1800f). STORYBOARD.md §S1.
 * Split AppFrame (edit left / preview right). Six sequential syntax segments
 * plus a 2s(+) mermaid bonus beat, each block in the preview materializing
 * exactly when its source line finishes typing.
 */
export const S1_DURATION_IN_FRAMES = 1800;

// ---- segment boundaries (absolute scene frames) --------------------------
const HEADINGS = { start: 0, end: 280 };
const EMPHASIS = { start: 280, end: 540 };
const LISTS = { start: 540, end: 840 };
const TABLE = { start: 840, end: 1140 };
const CODE = { start: 1140, end: 1400 };
const IMAGE_LINK = { start: 1400, end: 1680 };
const MERMAID = { start: 1680, end: 1800 };

// ---- small local helpers (kept in this file — S1-only, no shared kit edits) ----

/** Sequentially schedules typed lines so each starts right after the previous finishes + gap. */
function chainTyping(
  fps: number,
  base: number,
  items: Array<{ text: string; gapAfter?: number; cps?: number }>,
): Array<{ text: string; start: number; end: number }> {
  let cursor = base;
  return items.map((item) => {
    const start = cursor;
    const end = start + typingDurationInFrames(item.text, fps, item.cps ?? 14, true);
    cursor = end + (item.gapAfter ?? 20);
    return { text: item.text, start, end };
  });
}

/** Fade the whole segment container in/out at its edges so segments cross-dissolve. */
function edgeOpacity(frame: number, start: number, end: number, fade = 10): number {
  return interpolate(frame, [start - fade, start, end, end + fade], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** Fade + slight rise-in wrapper for a preview block, keyed to its typing-completion frame. */
function Reveal({
  frame,
  appearFrame,
  children,
}: {
  frame: number;
  appearFrame: number;
  children: React.ReactNode;
}): JSX.Element {
  const opacity = interpolate(frame, [appearFrame, appearFrame + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [appearFrame, appearFrame + 10], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div style={{ opacity, transform: `translateY(${y}px)` }}>{children}</div>;
}

function SegmentShell({
  frame,
  start,
  end,
  children,
}: {
  frame: number;
  start: number;
  end: number;
  children: React.ReactNode;
}): JSX.Element | null {
  if (frame < start - 15 || frame > end + 15) return null;
  const opacity = edgeOpacity(frame, start, end);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        minHeight: 0,
        opacity,
      }}
    >
      {children}
    </div>
  );
}

const screenshotSvg =
  `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='230'>` +
  `<rect width='420' height='230' rx='6' fill='${colors.surface}' stroke='${colors.border}'/>` +
  `<g fill='none' stroke='${colors.textFaint}' stroke-width='2'>` +
  `<rect x='150' y='75' width='120' height='90' rx='6'/>` +
  `<circle cx='210' cy='113' r='16'/>` +
  `<path d='M175 75 l10 -14 h50 l10 14'/>` +
  `</g>` +
  `<text x='210' y='200' font-family='sans-serif' font-size='14' fill='${colors.textMuted}' text-anchor='middle'>capture.png</text>` +
  `</svg>`;
const screenshotDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(screenshotSvg)}`;

function PreviewLink({ children }: { children: React.ReactNode }): JSX.Element {
  return <span style={{ color: colors.accent, textDecoration: 'underline' }}>{children}</span>;
}

function MiniFlowchart(): JSX.Element {
  const node: React.CSSProperties = {
    padding: '8px 20px',
    borderRadius: radius.md,
    border: `1.5px solid ${colors.accent}`,
    background: colors.accentSoft,
    color: colors.accentActive,
    fontFamily: font.mono,
    fontWeight: 600,
    fontSize: 16,
  };
  const Arrow = (): JSX.Element => (
    <svg width={40} height={16} viewBox="0 0 40 16">
      <line x1="0" y1="8" x2="30" y2="8" stroke={colors.textMuted} strokeWidth={2} />
      <path d="M30 2 L40 8 L30 14 Z" fill={colors.textMuted} />
    </svg>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={node}>A</div>
      <Arrow />
      <div style={node}>B</div>
      <Arrow />
      <div style={node}>C</div>
    </div>
  );
}

// ---- segments --------------------------------------------------------------

function HeadingsSegment({ frame, fps }: { frame: number; fps: number }): JSX.Element | null {
  const [h1, h2, h3] = chainTyping(fps, HEADINGS.start + 10, [
    { text: '# 제목', gapAfter: 25 },
    { text: '## 부제목', gapAfter: 25 },
    { text: '### 소제목', gapAfter: 0 },
  ]);
  return (
    <SegmentShell frame={frame} start={HEADINGS.start} end={HEADINGS.end}>
      <EditorPane
        lines={[
          { text: h1.text, startFrame: h1.start },
          { text: h2.text, startFrame: h2.start },
          { text: h3.text, startFrame: h3.start },
        ]}
      />
      <PreviewPane>
        <Reveal frame={frame} appearFrame={h1.end + 4}>
          <PreviewH1>제목</PreviewH1>
        </Reveal>
        <Reveal frame={frame} appearFrame={h2.end + 4}>
          <PreviewH2>부제목</PreviewH2>
        </Reveal>
        <Reveal frame={frame} appearFrame={h3.end + 4}>
          <PreviewH3>소제목</PreviewH3>
        </Reveal>
      </PreviewPane>
      <SubtitleBar
        text="샵(#) 개수로 제목 크기를 정해요"
        startFrame={h1.end + 4}
        endFrame={HEADINGS.end - 20}
      />
    </SegmentShell>
  );
}

function EmphasisSegment({ frame, fps }: { frame: number; fps: number }): JSX.Element | null {
  const text = '**굵게**, *기울임*, ~~취소선~~ 모두 써봐요';
  const [line] = chainTyping(fps, EMPHASIS.start + 10, [{ text, gapAfter: 0 }]);
  return (
    <SegmentShell frame={frame} start={EMPHASIS.start} end={EMPHASIS.end}>
      <EditorPane lines={[{ text: line.text, startFrame: line.start }]} />
      <PreviewPane>
        <Reveal frame={frame} appearFrame={line.end + 4}>
          <PreviewParagraph>
            <PreviewBold>굵게</PreviewBold>, <PreviewItalic>기울임</PreviewItalic>,{' '}
            <PreviewStrike>취소선</PreviewStrike> 모두 써봐요
          </PreviewParagraph>
        </Reveal>
      </PreviewPane>
      <SubtitleBar
        text="별표와 물결로 강조 스타일을 넣어요"
        startFrame={line.end + 4}
        endFrame={EMPHASIS.end - 20}
      />
    </SegmentShell>
  );
}

function ListsSegment({ frame, fps }: { frame: number; fps: number }): JSX.Element | null {
  const items = chainTyping(fps, LISTS.start + 8, [
    { text: '- 마크다운 배우기', gapAfter: 20 },
    { text: '- 미리보기 켜기', gapAfter: 20 },
    { text: '  - 문법 연습하기', gapAfter: 20 },
    { text: '1. 준비하기', gapAfter: 20 },
    { text: '2. 작성하기', gapAfter: 20 },
    { text: '3. 공유하기', gapAfter: 0 },
  ]);
  const [b0, b1, nested, o0, o1, o2] = items;
  return (
    <SegmentShell frame={frame} start={LISTS.start} end={LISTS.end}>
      <EditorPane
        lines={[
          { text: b0.text, startFrame: b0.start },
          { text: b1.text, startFrame: b1.start },
          { text: nested.text, startFrame: nested.start },
          '',
          { text: o0.text, startFrame: o0.start },
          { text: o1.text, startFrame: o1.start },
          { text: o2.text, startFrame: o2.start },
        ]}
      />
      <PreviewPane>
        <Reveal frame={frame} appearFrame={nested.end + 4}>
          <PreviewList
            items={[
              '마크다운 배우기',
              <>
                미리보기 켜기
                <PreviewList items={['문법 연습하기']} />
              </>,
            ]}
          />
        </Reveal>
        <Reveal frame={frame} appearFrame={o2.end + 4}>
          <PreviewList ordered items={['준비하기', '작성하기', '공유하기']} />
        </Reveal>
      </PreviewPane>
      <SubtitleBar
        text="대시와 숫자로 목록을 만들어요"
        startFrame={nested.end + 4}
        endFrame={LISTS.end - 20}
      />
    </SegmentShell>
  );
}

function TableSegment({ frame, fps }: { frame: number; fps: number }): JSX.Element | null {
  const rows = chainTyping(fps, TABLE.start + 10, [
    { text: '| 할 일 | 담당 | 마감 |', gapAfter: 12 },
    { text: '| --- | --- | --- |', gapAfter: 12 },
    { text: '| 기획서 작성 | 지원 | 7/18 |', gapAfter: 12 },
    { text: '| 디자인 시안 | 민준 | 7/20 |', gapAfter: 0 },
  ]);
  const [header, divider, row1, row2] = rows;
  return (
    <SegmentShell frame={frame} start={TABLE.start} end={TABLE.end}>
      <EditorPane
        lines={[
          { text: header.text, startFrame: header.start },
          { text: divider.text, startFrame: divider.start },
          { text: row1.text, startFrame: row1.start },
          { text: row2.text, startFrame: row2.start },
        ]}
      />
      <PreviewPane>
        <Reveal frame={frame} appearFrame={row2.end + 4}>
          <PreviewTable
            headers={['할 일', '담당', '마감']}
            rows={[
              ['기획서 작성', '지원', '7/18'],
              ['디자인 시안', '민준', '7/20'],
            ]}
          />
        </Reveal>
      </PreviewPane>
      <SubtitleBar
        text="파이프(|)로 표를 그릴 수 있어요"
        startFrame={row2.end + 4}
        endFrame={TABLE.end - 20}
      />
    </SegmentShell>
  );
}

function CodeSegment({ frame, fps }: { frame: number; fps: number }): JSX.Element | null {
  const items = chainTyping(fps, CODE.start + 10, [
    { text: '```js', gapAfter: 20 },
    { text: "console.log('안녕, mdedit')", gapAfter: 20 },
    { text: '```', gapAfter: 20 },
    { text: '인라인 `code`도 편하게 써요.', gapAfter: 0 },
  ]);
  const [fenceOpen, codeLine, fenceClose, inline] = items;
  return (
    <SegmentShell frame={frame} start={CODE.start} end={CODE.end}>
      <EditorPane
        lines={[
          { text: fenceOpen.text, startFrame: fenceOpen.start },
          { text: codeLine.text, startFrame: codeLine.start },
          { text: fenceClose.text, startFrame: fenceClose.start },
          '',
          { text: inline.text, startFrame: inline.start },
        ]}
      />
      <PreviewPane>
        <Reveal frame={frame} appearFrame={fenceClose.end + 4}>
          <PreviewCodeBlock lang="js">console.log(&apos;안녕, mdedit&apos;)</PreviewCodeBlock>
        </Reveal>
        <Reveal frame={frame} appearFrame={inline.end + 4}>
          <PreviewParagraph>
            인라인 <PreviewInlineCode>code</PreviewInlineCode>도 편하게 써요.
          </PreviewParagraph>
        </Reveal>
      </PreviewPane>
      <SubtitleBar
        text="코드도 백틱(`)으로 감싸면 돼요"
        startFrame={fenceClose.end + 4}
        endFrame={CODE.end - 20}
      />
    </SegmentShell>
  );
}

function ImageLinkSegment({ frame, fps }: { frame: number; fps: number }): JSX.Element | null {
  const items = chainTyping(fps, IMAGE_LINK.start + 10, [
    { text: '![스크린샷](images/capture.png)', gapAfter: 25 },
    { text: '[GitHub 저장소](https://github.com)', gapAfter: 0 },
  ]);
  const [image, link] = items;
  return (
    <SegmentShell frame={frame} start={IMAGE_LINK.start} end={IMAGE_LINK.end}>
      <EditorPane
        lines={[
          { text: image.text, startFrame: image.start },
          { text: link.text, startFrame: link.start },
        ]}
      />
      <PreviewPane>
        <Reveal frame={frame} appearFrame={image.end + 4}>
          <PreviewImage src={screenshotDataUri} alt="스크린샷" />
        </Reveal>
        <Reveal frame={frame} appearFrame={link.end + 4}>
          <PreviewParagraph>
            <PreviewLink>GitHub 저장소</PreviewLink>
          </PreviewParagraph>
        </Reveal>
      </PreviewPane>
      <SubtitleBar
        text="이미지와 링크도 대괄호로 넣어요"
        startFrame={image.end + 4}
        endFrame={IMAGE_LINK.end - 20}
      />
    </SegmentShell>
  );
}

function MermaidBonusSegment({ frame, fps }: { frame: number; fps: number }): JSX.Element | null {
  // mermaid.parse() (src/components/preview/PreviewRenderer.tsx) requires a
  // diagram-type declaration as the first token — a bare "A --> B --> C" is
  // invalid and would render "⚠ Diagram syntax error" in the real app, not
  // the flowchart below. `flowchart LR` matches the app's own mermaid tests
  // (src/test/mermaidValidate.test.ts) and the AI diagram feature's output.
  // The extra line makes this bonus beat's typed source longer, so it types
  // at a faster cps (20 vs. the file's default 14) to still finish comfortably
  // before the preview-reveal beat — the MERMAID segment's own frame budget
  // (120f, unchanged) and S1_DURATION_IN_FRAMES stay untouched.
  const MERMAID_CPS = 20;
  const items = chainTyping(fps, MERMAID.start + 5, [
    { text: '```mermaid', gapAfter: 6, cps: MERMAID_CPS },
    { text: 'flowchart LR', gapAfter: 6, cps: MERMAID_CPS },
    { text: '  A --> B --> C', gapAfter: 6, cps: MERMAID_CPS },
    { text: '```', gapAfter: 0, cps: MERMAID_CPS },
  ]);
  const [fenceOpen, decl, graph, fenceClose] = items;
  return (
    <SegmentShell frame={frame} start={MERMAID.start} end={MERMAID.end}>
      <EditorPane
        showLineNumbers={false}
        lines={[
          { text: fenceOpen.text, startFrame: fenceOpen.start },
          { text: decl.text, startFrame: decl.start },
          { text: graph.text, startFrame: graph.start },
          { text: fenceClose.text, startFrame: fenceClose.start },
        ]}
      />
      <PreviewPane>
        <Reveal frame={frame} appearFrame={fenceClose.end + 4}>
          <MiniFlowchart />
        </Reveal>
      </PreviewPane>
      <SubtitleBar
        text="다이어그램도 됩니다"
        startFrame={fenceClose.end + 4}
        endFrame={MERMAID.end - 4}
      />
    </SegmentShell>
  );
}

export function S1Markdown(): JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <AppFrame>
        <div style={{ position: 'relative', flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
          <HeadingsSegment frame={frame} fps={fps} />
          <EmphasisSegment frame={frame} fps={fps} />
          <ListsSegment frame={frame} fps={fps} />
          <TableSegment frame={frame} fps={fps} />
          <CodeSegment frame={frame} fps={fps} />
          <ImageLinkSegment frame={frame} fps={fps} />
          <MermaidBonusSegment frame={frame} fps={fps} />
        </div>
      </AppFrame>
      <SceneChip title="1. 마크다운 기초" />
    </AbsoluteFill>
  );
}
