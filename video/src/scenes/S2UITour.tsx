import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, font, fontSize, layout, radius, shadow, space } from '../tokens';
import {
  AppFrame,
  HeaderBar,
  FileExplorer,
  type ExplorerNode,
  type ViewMode,
  EditorPane,
  PreviewPane,
  PreviewH1,
  PreviewH2,
  PreviewList,
  PreviewTable,
  PreviewImage,
  SubtitleBar,
  SceneChip,
  CursorPointer,
  Keycap,
  Highlight,
} from '../kit';

/**
 * S2 — UI 투어 (~75s / 2250f). STORYBOARD.md §S2.
 * Four sub-parts, all driven off one absolute frame counter (same convention
 * as S1Markdown.tsx): S2a region anatomy, S2b file explorer, S2c view-mode
 * toggle, S2d table insert + screenshot paste.
 */
export const S2_DURATION_IN_FRAMES = 2250;

// ---- sub-part boundaries (absolute scene frames) --------------------------
const S2A = { start: 0, end: 450 };
const S2B = { start: 450, end: 1050 };
const S2C = { start: 1050, end: 1800 };
const S2D = { start: 1800, end: 2250 };

// ---- shared layout math (mirrors kit/AppFrame.tsx's real geometry) --------
// AppFrame is 1600x900. Header is layout.headerHeight tall; everything below
// splits into the sidebar (layout.sidebarWidth) and the main content area.
const FRAME_W = 1600;
const FRAME_H = 900;
const SIDEBAR_X = 0;
const CONTENT_X = layout.sidebarWidth; // 250
const CONTENT_W = FRAME_W - layout.sidebarWidth; // 1350
const CONTENT_Y = layout.headerHeight; // 44
const CONTENT_H = FRAME_H - layout.headerHeight; // 856

/** Row center Y for the Nth (0-indexed) row in FileExplorer's tree (see kit/AppFrame.tsx ExplorerRows). */
function treeRowY(index: number): number {
  return layout.headerHeight + space[2] + index * layout.treeRowHeight + layout.treeRowHeight / 2;
}

// ---- small local helpers (S2-only, no shared kit edits) -------------------

/** Fade in + slight rise, keyed to an appear frame (mirrors S1Markdown.tsx's Reveal). */
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

/**
 * Full-bleed absolutely-positioned flex layer that fades+rises in at `appearFrame`.
 * Unlike wrapping children in a plain <Reveal> div (which, as a flex item with only
 * absolutely-positioned descendants, collapses to near-zero intrinsic size), this
 * establishes its own `position: absolute; inset: 0` box so Editor/Preview children
 * still get their full flex width.
 */
function RevealLayer({
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
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        minWidth: 0,
        minHeight: 0,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      {children}
    </div>
  );
}

/** Absolutely-positioned panel visible only within [start-fade, end+fade], cross-fading at edges. */
function Panel({
  frame,
  start,
  end,
  fade = 12,
  children,
}: {
  frame: number;
  start: number;
  end: number;
  fade?: number;
  children: React.ReactNode;
}): JSX.Element | null {
  if (frame < start - fade || frame > end + fade) return null;
  const opacity = interpolate(frame, [start - fade, start, end, end + fade], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div style={{ position: 'absolute', inset: 0, opacity, display: 'flex', minWidth: 0, minHeight: 0 }}>{children}</div>;
}

/** Dimmed spotlight highlight, shown only within [start, end] with edge fades. */
function TimedHighlight({
  frame,
  start,
  end,
  rect,
  label,
  labelPosition,
}: {
  frame: number;
  start: number;
  end: number;
  rect: { x: number; y: number; width: number; height: number };
  label: string;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
}): JSX.Element | null {
  const fade = 12;
  if (frame < start - fade || frame > end + fade) return null;
  const opacity = interpolate(frame, [start - fade, start, end, end + fade], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, opacity }}>
      <Highlight rect={rect} label={label} labelPosition={labelPosition} />
    </div>
  );
}

// ---- document content (shared across S2b/S2c/S2d) --------------------------

function IdeaDocEditor(): JSX.Element {
  return (
    <EditorPane
      lines={['# 아이디어 목록', '', '- 다크 모드 커스터마이즈', '- 오프라인 동기화']}
    />
  );
}

function IdeaDocPreview(): JSX.Element {
  return (
    <PreviewPane>
      <PreviewH1>아이디어 목록</PreviewH1>
      <PreviewList items={['다크 모드 커스터마이즈', '오프라인 동기화']} />
    </PreviewPane>
  );
}

const MEETING_LINES = [
  '# 회의록 - 7월 18일',
  '',
  '## 참석자',
  '- 지원, 민준',
  '',
  '## 논의 사항',
  '- 신규 기능 우선순위 정리',
];

const TABLE_LINES = [
  '',
  '| 열 1 | 열 2 | 열 3 | 열 4 |',
  '| --- | --- | --- | --- |',
  '|  |  |  |  |',
  '|  |  |  |  |',
];

const SCREENSHOT_LINE = '![screenshot](images/screenshot.png)';

const screenshotSvg =
  `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='230'>` +
  `<rect width='420' height='230' rx='6' fill='${colors.surface}' stroke='${colors.border}'/>` +
  `<g fill='none' stroke='${colors.textFaint}' stroke-width='2'>` +
  `<rect x='150' y='75' width='120' height='90' rx='6'/>` +
  `<circle cx='210' cy='113' r='16'/>` +
  `<path d='M175 75 l10 -14 h50 l10 14'/>` +
  `</g>` +
  `<text x='210' y='200' font-family='sans-serif' font-size='14' fill='${colors.textMuted}' text-anchor='middle'>screenshot.png</text>` +
  `</svg>`;
const screenshotDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(screenshotSvg)}`;

/** The 회의록 doc, optionally with the table skeleton and/or pasted screenshot appended. */
function MeetingDocEditor({
  showTable,
  showScreenshot,
}: {
  showTable: boolean;
  showScreenshot: boolean;
}): JSX.Element {
  const lines: string[] = [...MEETING_LINES];
  if (showTable) lines.push(...TABLE_LINES);
  if (showScreenshot) lines.push('', SCREENSHOT_LINE);
  return <EditorPane lines={lines} />;
}

function MeetingDocPreview({
  frame,
  showTable,
  tableAppearFrame,
  showScreenshot,
  screenshotAppearFrame,
}: {
  frame: number;
  showTable: boolean;
  tableAppearFrame: number;
  showScreenshot: boolean;
  screenshotAppearFrame: number;
}): JSX.Element {
  return (
    <PreviewPane style={{ maxWidth: 'none' }}>
      <PreviewH1>회의록 - 7월 18일</PreviewH1>
      <PreviewH2>참석자</PreviewH2>
      <PreviewList items={['지원, 민준']} />
      <PreviewH2>논의 사항</PreviewH2>
      <PreviewList items={['신규 기능 우선순위 정리']} />
      {showTable && (
        <Reveal frame={frame} appearFrame={tableAppearFrame}>
          <PreviewTable
            headers={['열 1', '열 2', '열 3', '열 4']}
            rows={[
              ['', '', '', ''],
              ['', '', '', ''],
            ]}
          />
        </Reveal>
      )}
      {showScreenshot && (
        <Reveal frame={frame} appearFrame={screenshotAppearFrame}>
          <PreviewImage src={screenshotDataUri} alt="screenshot" />
        </Reveal>
      )}
    </PreviewPane>
  );
}

/** Minimal local image viewer look (filename bar + centered checkerboard + meta), per USER_GUIDE §3. */
function ImageViewerPane(): JSX.Element {
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: colors.bg }}>
      <div
        style={{
          flex: 'none',
          height: layout.statusBarHeight,
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${space[4]}px`,
          borderBottom: `1px solid ${colors.border}`,
          fontFamily: font.ui,
          fontSize: fontSize.status,
          color: colors.textMuted,
        }}
      >
        capture.png · 420 × 230 · 12KB
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage:
            `linear-gradient(45deg, ${colors.surface} 25%, transparent 25%), ` +
            `linear-gradient(-45deg, ${colors.surface} 25%, transparent 25%), ` +
            `linear-gradient(45deg, transparent 75%, ${colors.surface} 75%), ` +
            `linear-gradient(-45deg, transparent 75%, ${colors.surface} 75%)`,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        }}
      >
        <img
          src={screenshotDataUri.replace('screenshot.png', 'capture.png')}
          alt="capture.png"
          style={{ borderRadius: radius.md, boxShadow: shadow.md, border: `1px solid ${colors.border}` }}
        />
      </div>
    </div>
  );
}

// ---- S2a: 첫 화면 해부 ------------------------------------------------------

function S2aAnatomy({ frame }: { frame: number }): JSX.Element | null {
  if (frame < S2A.start - 20 || frame > S2A.end + 20) return null;

  const H1 = { start: 30, end: 150 };
  const H2 = { start: 180, end: 300 };
  const H3 = { start: 330, end: 440 };

  return (
    <>
      <Panel frame={frame} start={S2A.start} end={S2A.end} fade={20}>
        <AppFrameSlot sidebar={<FileExplorer tree={s2bTree(true)} selected="아이디어.md" />}>
          <IdeaDocEditor />
          <IdeaDocPreview />
        </AppFrameSlot>
      </Panel>
      <TimedHighlight
        frame={frame}
        start={H1.start}
        end={H1.end}
        rect={{ x: SIDEBAR_X, y: CONTENT_Y, width: layout.sidebarWidth, height: CONTENT_H }}
        label="① 파일 탐색기"
        labelPosition="right"
      />
      <SubtitleBar text="왼쪽엔 파일 탐색기가 있어요" startFrame={H1.start + 10} endFrame={H1.end - 10} />
      <TimedHighlight
        frame={frame}
        start={H2.start}
        end={H2.end}
        rect={{ x: CONTENT_X, y: CONTENT_Y, width: CONTENT_W, height: CONTENT_H }}
        label="② 에디터 · 미리보기"
        labelPosition="bottom"
      />
      <SubtitleBar text="가운데는 에디터와 미리보기예요" startFrame={H2.start + 10} endFrame={H2.end - 10} />
      <TimedHighlight
        frame={frame}
        start={H3.start}
        end={H3.end}
        rect={{ x: CONTENT_X + 550, y: 0, width: CONTENT_W - 550, height: layout.headerHeight }}
        label="③ 헤더 도구 (모드 · 이미지 · 설정)"
        labelPosition="bottom"
      />
      <SubtitleBar
        text="헤더에는 모드 전환·이미지 토글·설정이 있어요"
        startFrame={H3.start + 10}
        endFrame={H3.end - 10}
      />
    </>
  );
}

// ---- S2b: 파일 탐색기 -------------------------------------------------------

function s2bTree(projectOpen: boolean): ExplorerNode[] {
  return [
    {
      name: '프로젝트',
      type: 'folder',
      open: projectOpen,
      children: [
        { name: '회의록.md', type: 'file' },
        { name: '아이디어.md', type: 'file' },
        {
          name: 'images',
          type: 'folder',
          open: true,
          children: [{ name: 'capture.png', type: 'file' }],
        },
      ],
    },
  ];
}

// Explorer row target coordinates (see treeRowY + kit/AppFrame.tsx ExplorerRows padding math).
const CHEVRON_PROJECT = { x: 16.5, y: treeRowY(0) };
const ROW_MEETING = { x: 46.5, y: treeRowY(1) };
const ROW_CAPTURE = { x: 62.5, y: treeRowY(4) };

function S2bExplorer({ frame }: { frame: number }): JSX.Element | null {
  if (frame < S2B.start - 20 || frame > S2B.end + 20) return null;

  const OPEN_CLICK = S2B.start + 60; // 510
  const OPEN_APPLIED = OPEN_CLICK + 5;
  const MEETING_CLICK = S2B.start + 130; // 580
  const MEETING_APPLIED = MEETING_CLICK + 5;
  const CAPTURE_CLICK = S2B.start + 270; // 720
  const CAPTURE_APPLIED = CAPTURE_CLICK + 5;

  const projectOpen = frame >= OPEN_APPLIED;
  const selected = frame >= CAPTURE_APPLIED ? 'capture.png' : frame >= MEETING_APPLIED ? '회의록.md' : undefined;

  const sidebar = <FileExplorer tree={s2bTree(projectOpen)} selected={selected} />;

  return (
    <>
      <Panel frame={frame} start={S2B.start} end={S2B.end} fade={20}>
        <AppFrameSlot header={<HeaderBar />} sidebar={sidebar}>
          {frame < MEETING_APPLIED ? (
            <>
              <IdeaDocEditor />
              <IdeaDocPreview />
            </>
          ) : frame < CAPTURE_APPLIED ? (
            <RevealLayer frame={frame} appearFrame={MEETING_APPLIED}>
              <MeetingDocEditor showTable={false} showScreenshot={false} />
              <MeetingDocPreview
                frame={frame}
                showTable={false}
                tableAppearFrame={0}
                showScreenshot={false}
                screenshotAppearFrame={0}
              />
            </RevealLayer>
          ) : (
            <RevealLayer frame={frame} appearFrame={CAPTURE_APPLIED}>
              <ImageViewerPane />
            </RevealLayer>
          )}
        </AppFrameSlot>
      </Panel>
      <CursorPointer
        positions={[
          { frame: S2B.start, x: 700, y: 470 },
          { frame: S2B.start + 40, x: CHEVRON_PROJECT.x, y: CHEVRON_PROJECT.y },
          { frame: OPEN_CLICK, x: CHEVRON_PROJECT.x, y: CHEVRON_PROJECT.y },
          { frame: MEETING_CLICK - 30, x: ROW_MEETING.x, y: ROW_MEETING.y },
          { frame: MEETING_CLICK, x: ROW_MEETING.x, y: ROW_MEETING.y },
          { frame: CAPTURE_CLICK - 40, x: ROW_CAPTURE.x, y: ROW_CAPTURE.y },
          { frame: CAPTURE_CLICK, x: ROW_CAPTURE.x, y: ROW_CAPTURE.y },
          { frame: S2B.end, x: ROW_CAPTURE.x, y: ROW_CAPTURE.y },
        ]}
        clicks={[OPEN_CLICK, MEETING_CLICK, CAPTURE_CLICK]}
      />
      <SubtitleBar text="파일 클릭으로 열기" startFrame={MEETING_APPLIED + 5} endFrame={CAPTURE_CLICK - 10} />
      <SubtitleBar
        text="md가 아닌 파일은 뷰어로 열립니다"
        startFrame={CAPTURE_APPLIED + 10}
        endFrame={S2B.end - 20}
      />
    </>
  );
}

// ---- S2c: 보기 모드 3종 -----------------------------------------------------

const EDIT_CLICK = S2C.start + 45; // 1095
const SPLIT_CLICK = S2C.start + 295; // 1345
const PREVIEW_CLICK = S2C.start + 545; // 1595

// Approximate centers of the header's segmented mode-toggle buttons (right-aligned group).
const TOGGLE_EDIT_BTN = { x: 1320, y: layout.headerHeight / 2 };
const TOGGLE_SPLIT_BTN = { x: 1390, y: layout.headerHeight / 2 };
const TOGGLE_PREVIEW_BTN = { x: 1465, y: layout.headerHeight / 2 };

function S2cViewModes({ frame }: { frame: number }): JSX.Element | null {
  if (frame < S2C.start - 20 || frame > S2C.end + 20) return null;

  // editorFrac: 1 = edit-only, 0.5 = split, 0 = preview-only. Piecewise-linear over transitions.
  const editorFrac = interpolate(
    frame,
    [S2C.start, EDIT_CLICK, EDIT_CLICK + 25, SPLIT_CLICK, SPLIT_CLICK + 25, PREVIEW_CLICK, PREVIEW_CLICK + 25, S2C.end],
    [0.5, 0.5, 1, 1, 0.5, 0.5, 0, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const viewMode: ViewMode = frame < EDIT_CLICK ? 'split' : frame < SPLIT_CLICK ? 'edit' : frame < PREVIEW_CLICK ? 'split' : 'preview';

  const editorW = editorFrac * CONTENT_W;
  const previewW = (1 - editorFrac) * CONTENT_W;

  return (
    <>
      <Panel frame={frame} start={S2C.start} end={S2C.end} fade={20}>
        <AppFrameSlot
          header={<HeaderBar viewMode={viewMode} />}
          sidebar={<FileExplorer tree={s2bTree(true)} selected="회의록.md" />}
        >
          <div style={{ display: 'flex', width: editorW, minWidth: 0, overflow: 'hidden' }}>
            <MeetingDocEditor showTable={false} showScreenshot={false} />
          </div>
          <div style={{ display: 'flex', width: previewW, minWidth: 0, overflow: 'hidden' }}>
            <MeetingDocPreview
              frame={frame}
              showTable={false}
              tableAppearFrame={0}
              showScreenshot={false}
              screenshotAppearFrame={0}
            />
          </div>
        </AppFrameSlot>
      </Panel>
      <CursorPointer
        positions={[
          { frame: S2C.start, x: 900, y: 470 },
          { frame: EDIT_CLICK - 30, x: TOGGLE_EDIT_BTN.x, y: TOGGLE_EDIT_BTN.y },
          { frame: EDIT_CLICK, x: TOGGLE_EDIT_BTN.x, y: TOGGLE_EDIT_BTN.y },
          { frame: SPLIT_CLICK - 30, x: TOGGLE_SPLIT_BTN.x, y: TOGGLE_SPLIT_BTN.y },
          { frame: SPLIT_CLICK, x: TOGGLE_SPLIT_BTN.x, y: TOGGLE_SPLIT_BTN.y },
          { frame: PREVIEW_CLICK - 30, x: TOGGLE_PREVIEW_BTN.x, y: TOGGLE_PREVIEW_BTN.y },
          { frame: PREVIEW_CLICK, x: TOGGLE_PREVIEW_BTN.x, y: TOGGLE_PREVIEW_BTN.y },
          { frame: S2C.end, x: TOGGLE_PREVIEW_BTN.x, y: TOGGLE_PREVIEW_BTN.y },
        ]}
        clicks={[EDIT_CLICK, SPLIT_CLICK, PREVIEW_CLICK]}
      />
      <SubtitleBar
        text="글 쓸 땐 편집, 검토할 땐 미리보기, 평소엔 둘 다"
        startFrame={EDIT_CLICK + 40}
        endFrame={S2C.end - 30}
      />
    </>
  );
}

// ---- S2d: 표 삽입 + 스크린샷 붙여넣기 ---------------------------------------

/** Minimal local toolbar (real app: src/components/editor/EditorToolbar.tsx, above the editor pane). */
function MiniToolbar({ tableActive }: { tableActive: boolean }): JSX.Element {
  const labels = ['B', 'I', 'H1', '목록', '코드', '링크', '인용'];
  const btnStyle: React.CSSProperties = {
    height: layout.toolbarHeight - 6,
    padding: '0 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    fontFamily: font.ui,
    fontSize: 11.5,
    color: colors.textMuted,
    background: 'transparent',
  };
  return (
    <div
      style={{
        flex: 'none',
        height: layout.toolbarHeight,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: `0 ${space[2]}px`,
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      {labels.map((l) => (
        <span key={l} style={btnStyle}>
          {l}
        </span>
      ))}
      <span
        style={{
          ...btnStyle,
          color: tableActive ? colors.accent : colors.textMuted,
          background: tableActive ? colors.accentSoft : 'transparent',
        }}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="4" width="18" height="16" rx="1.5" />
          <path d="M3 9h18M3 14h18M9 4v16M15 4v16" />
        </svg>
        &nbsp;표
      </span>
      <span style={btnStyle}>이미지</span>
    </div>
  );
}

// Toolbar sits at (CONTENT_X, CONTENT_Y) inside the editor column; the table button
// is the 8th control (after B/I/H1/목록/코드/링크/인용) — approximate center below.
const TABLE_BTN = { x: CONTENT_X + 218, y: CONTENT_Y + layout.toolbarHeight / 2 };
const GRID_POPOVER = { x: TABLE_BTN.x - 90, y: TABLE_BTN.y + 20 };
// 8x8 grid cells, 18px + 2px gap stride, per USER_GUIDE §2.3.
const GRID_CELL = (row: number, col: number): { x: number; y: number } => ({
  x: GRID_POPOVER.x + 8 + col * 20 + 9,
  y: GRID_POPOVER.y + 8 + row * 20 + 9,
});

function GridPickerPopover({
  frame,
  openFrame,
  closeFrame,
}: {
  frame: number;
  openFrame: number;
  closeFrame: number;
}): JSX.Element | null {
  if (frame < openFrame || frame > closeFrame + 6) return null;
  const opacity = interpolate(frame, [openFrame, openFrame + 6, closeFrame, closeFrame + 6], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sweep = interpolate(frame, [openFrame + 10, closeFrame - 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hoveredRow = Math.round(interpolate(sweep, [0, 1], [0, 2]));
  const hoveredCol = Math.round(interpolate(sweep, [0, 1], [0, 3]));

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const active = r <= hoveredRow && c <= hoveredCol;
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            width: 18,
            height: 18,
            borderRadius: 2,
            background: active ? colors.accent : colors.surfaceRaised,
            border: `1px solid ${active ? colors.accentActive : colors.border}`,
          }}
        />,
      );
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: GRID_POPOVER.x,
        top: GRID_POPOVER.y,
        opacity,
        background: colors.surfaceRaised,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.md,
        boxShadow: shadow.md,
        padding: 8,
        zIndex: 60,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 18px)', gap: 2 }}>{cells}</div>
      <div
        style={{
          marginTop: 6,
          textAlign: 'center',
          fontFamily: font.mono,
          fontSize: 12,
          color: colors.textMuted,
        }}
      >
        {hoveredRow + 1} × {hoveredCol + 1}
      </div>
    </div>
  );
}

const TABLE_OPEN = S2D.start + 30; // 1830
const TABLE_SELECT = S2D.start + 100; // 1900
const TABLE_INSERTED = TABLE_SELECT + 10;
const PASTE_KEYCAP = S2D.start + 170; // 1970
const SCREENSHOT_INSERTED = PASTE_KEYCAP + 55; // 2025

function S2dTableAndPaste({ frame }: { frame: number }): JSX.Element | null {
  if (frame < S2D.start - 20 || frame > S2D.end + 20) return null;

  const showTable = frame >= TABLE_INSERTED;
  const showScreenshot = frame >= SCREENSHOT_INSERTED;
  const tableActive = frame >= TABLE_OPEN && frame < TABLE_SELECT + 15;

  const editorW = 0.5 * CONTENT_W;
  const previewW = 0.5 * CONTENT_W;

  return (
    <>
      <Panel frame={frame} start={S2D.start} end={S2D.end} fade={20}>
        <AppFrameSlot
          header={<HeaderBar viewMode="split" />}
          sidebar={<FileExplorer tree={s2bTree(true)} selected="회의록.md" />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', width: editorW, minWidth: 0, overflow: 'hidden' }}>
            <MiniToolbar tableActive={tableActive} />
            <div style={{ position: 'relative', flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
              <MeetingDocEditor showTable={showTable} showScreenshot={showScreenshot} />
              <GridPickerPopover frame={frame} openFrame={TABLE_OPEN} closeFrame={TABLE_SELECT} />
              {frame >= PASTE_KEYCAP && frame < SCREENSHOT_INSERTED + 20 && (
                <div
                  style={{
                    position: 'absolute',
                    right: space[4],
                    top: space[3],
                    opacity: interpolate(
                      frame,
                      [PASTE_KEYCAP, PASTE_KEYCAP + 8, SCREENSHOT_INSERTED + 5, SCREENSHOT_INSERTED + 20],
                      [0, 1, 1, 0],
                      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                    ),
                  }}
                >
                  <Keycap keys={['⌘', 'V']} />
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', width: previewW, minWidth: 0, overflow: 'hidden' }}>
            <MeetingDocPreview
              frame={frame}
              showTable={showTable}
              tableAppearFrame={TABLE_INSERTED}
              showScreenshot={showScreenshot}
              screenshotAppearFrame={SCREENSHOT_INSERTED}
            />
          </div>
        </AppFrameSlot>
      </Panel>
      <CursorPointer
        positions={[
          { frame: S2D.start, x: 900, y: 470 },
          { frame: TABLE_OPEN - 20, x: TABLE_BTN.x, y: TABLE_BTN.y },
          { frame: TABLE_OPEN, x: TABLE_BTN.x, y: TABLE_BTN.y },
          { frame: TABLE_OPEN + 10, x: GRID_CELL(0, 0).x, y: GRID_CELL(0, 0).y },
          { frame: TABLE_SELECT - 20, x: GRID_CELL(1, 2).x, y: GRID_CELL(1, 2).y },
          { frame: TABLE_SELECT, x: GRID_CELL(2, 3).x, y: GRID_CELL(2, 3).y },
          { frame: S2D.end, x: GRID_CELL(2, 3).x, y: GRID_CELL(2, 3).y },
        ]}
        clicks={[TABLE_OPEN, TABLE_SELECT]}
      />
      <SubtitleBar text="표 버튼으로 빠르게 표를 만들어요" startFrame={TABLE_OPEN + 15} endFrame={TABLE_INSERTED + 40} />
      <SubtitleBar
        text="캡처해서 바로 붙여넣으세요"
        startFrame={PASTE_KEYCAP + 10}
        endFrame={S2D.end - 20}
      />
    </>
  );
}

// ---- shared AppFrame slot wiring -------------------------------------------

/** Thin wrapper matching S1Markdown's inner-content pattern: AppFrame + a relatively-positioned content row. */
function AppFrameSlot({
  header,
  sidebar,
  children,
}: {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <AppFrame header={header} sidebar={sidebar}>
      <div style={{ position: 'relative', flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>{children}</div>
    </AppFrame>
  );
}

export function S2UITour(): JSX.Element {
  const frame = useCurrentFrame();
  useVideoConfig();

  return (
    <AbsoluteFill style={{ background: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: FRAME_W, height: FRAME_H }}>
        <S2aAnatomy frame={frame} />
        <S2bExplorer frame={frame} />
        <S2cViewModes frame={frame} />
        <S2dTableAndPaste frame={frame} />
      </div>
      <SceneChip title="2. 화면 사용법" />
    </AbsoluteFill>
  );
}
