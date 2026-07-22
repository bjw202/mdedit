import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, font, fontSize, lineHeight, space } from '../tokens';
import {
  HeaderBar,
  FileExplorer,
  EditorPane,
  PreviewPane,
  PreviewH1,
  PreviewH2,
  PreviewParagraph,
  PreviewTable,
  SubtitleBar,
  SceneChip,
  CursorPointer,
  Keycap,
  TypingText,
} from '../kit';
import type { FileExplorerRow } from '../kit';
import {
  FRAME_W,
  FRAME_H,
  CONTENT_X,
  CONTENT_Y,
  AppFrameSlot,
  SegmentPanel,
  RevealLayer,
  Reveal,
  SparkleButton,
  PresetMenu,
  SuggestionCard,
  PillButton,
  PieChart,
  GhostText,
  SituationCard,
  type PieSlice,
} from './chrome';

/**
 * C2 — 케이스 2: 홍보 페르소나 (~35s / 1050f).
 * 상황 카드(캠페인 종료 다음 날, 성과 보고 1시간 전) → 채널별 지표 날메모를 표로 만들기 →
 * 채널 비중 문단을 파이 차트로 → 보고용 한 줄 요약을 이어쓰기로 마무리.
 * 두 번째 플라이아웃 종류(파이 차트) + 표로 만들기를 시연.
 */
export const C2_DURATION_IN_FRAMES = 1050;

const FILE = '캠페인-결과.md';
const ROWS: FileExplorerRow[] = [
  { name: '캠페인-결과.md', type: 'file' },
  { name: '채널지표.md', type: 'file' },
  { name: '보고서.md', type: 'file' },
  { name: 'images', type: 'folder' },
];

// ── 공통 선택 기하 ───────────────────────────────────────────────────────────
const SEL_LEFT = 30;
const SELECTION_TOP = space[3];
const LINE_H = lineHeight.editor * fontSize.editor;
const SPARKLE_SIZE = 30;
const ITEM_H = 34;
const MENU_W = 202;
const MENU_PAD = space[1];

function selGeom(lineCount: number, selWidth: number) {
  const height = lineCount * LINE_H;
  const sparkleX = SEL_LEFT + selWidth + 8;
  const sparkleY = SELECTION_TOP + height - SPARKLE_SIZE - 4;
  return { height, sparkleX, sparkleY, menuX: sparkleX, menuY: sparkleY + SPARKLE_SIZE + 6 };
}
const presetItemY = (menuY: number, index: number) => menuY + MENU_PAD + index * ITEM_H + ITEM_H / 2;

const SIT_END = 138;

// ── Beat A: 채널 지표 → 표 ─────────────────────────────────────────────────────
const A_SEL_START = 190;
const A_SEL_END = 250;
const A_SPARKLE = 285;
const A_MENU = 302;
const A_PRESET = 370;
const A_CARD = 390;
const A_REPLACE = 455;
const A_TRANSFORM = 473;
const A_END = 508;
const A_SEL_W = 540;

const RAW_METRICS = [
  '채널 성과',
  '인스타 노출 12000 클릭 480 전환 36',
  '유튜브 노출 8000 클릭 300 전환 24',
  '블로그 노출 5000 클릭 210 전환 18',
  '이메일 노출 3000 클릭 150 전환 12',
];
const TABLE_LINES = [
  '## 채널 성과',
  '| 채널 | 노출 | 클릭 | 전환 |',
  '| --- | --- | --- | --- |',
  '| 인스타 | 12,000 | 480 | 36 |',
  '| 유튜브 | 8,000 | 300 | 24 |',
  '| 블로그 | 5,000 | 210 | 18 |',
  '| 이메일 | 3,000 | 150 | 12 |',
];

// ── Beat B: 채널 비중 → 파이 차트 ──────────────────────────────────────────────
const B_START = 516;
const B_SEL_START = 560;
const B_SEL_END = 615;
const B_SPARKLE = 650;
const B_MENU = 667;
const B_DIAG_HOVER = 718;
const B_FLYOUT = 728;
const B_PIE_ACTIVE = 768;
const B_PIE_CLICK = 788;
const B_RENDER = 806;
const B_END = 840;
const B_SEL_W = 540;

const SHARE_LINES = [
  '## 채널 비중',
  '전체 전환의 40%가 인스타에서,',
  '25%가 유튜브, 20%가 블로그,',
  '15%가 이메일에서 나왔다.',
];
const SHARE_WITH_PIE = [
  ...SHARE_LINES,
  '',
  '```mermaid',
  'pie title 채널 비중',
  '  "인스타" : 40',
  '  "유튜브" : 25',
  '  "블로그" : 20',
  '  "이메일" : 15',
  '```',
];
const PIE_SLICES: PieSlice[] = [
  { label: '인스타', value: 40, color: colors.accent },
  { label: '유튜브', value: 25, color: colors.accentHover },
  { label: '블로그', value: 20, color: colors.dirty },
  { label: '이메일', value: 15, color: colors.success },
];

// ── Beat C: 보고용 한 줄 요약 이어쓰기 ─────────────────────────────────────────
const C_START = 848;
const C_PAUSE_START = 866;
const C_PAUSE_END = 926;
const C_KEY = 950;
const C_GHOST = 970;
const C_CONFIRM = 1035;
const C_ANCHOR_X = CONTENT_X + 34;
const C_ANCHOR_Y = CONTENT_Y + 60;
const C_INTRO = '이번 캠페인 전환은 인스타 중심으로 형성됐다. 다음 분기는';
const C_GHOSTTX = ' 인스타 비중을 늘리고 이메일 리타겟을 보강한다.';

// =====================================================================
// Beat A — 표로 만들기
// =====================================================================
function BeatA({ frame }: { frame: number }): JSX.Element | null {
  if (frame < SIT_END - 20 || frame > A_END + 20) return null;
  const selW = interpolate(frame, [A_SEL_START, A_SEL_END], [0, A_SEL_W], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const g = selGeom(RAW_METRICS.length, selW);
  const transformed = frame >= A_TRANSFORM;
  const showSelection = frame >= A_SEL_START && frame < A_PRESET + 20;
  const showSparkle = frame >= A_SEL_END && frame < A_CARD;
  const showMenu = frame >= A_MENU && frame < A_CARD + 4;
  const activeKind = frame >= A_PRESET ? 'table' : undefined;
  const tableItemY = presetItemY(g.menuY, 2); // 📊 표로 만들기 = index 2

  const CARD_LEFT = 34;
  const CARD_TOP = 250;
  const replaceBtnX = CONTENT_X + CARD_LEFT + space[4] + 46;
  const replaceBtnY = CONTENT_Y + CARD_TOP + space[4] + 22 + 6 * (1.6 * 15) + space[3] + 14;

  return (
    <>
      <SegmentPanel frame={frame} start={SIT_END} end={A_END} fade={10}>
        <AppFrameSlot header={<HeaderBar viewMode="split" filename={FILE} isDirty />} sidebar={<FileExplorer rows={ROWS} selected={FILE} />}>
          {transformed ? (
            <RevealLayer frame={frame} appearFrame={A_TRANSFORM}>
              <EditorPane lines={TABLE_LINES} />
              <PreviewPane style={{ maxWidth: 'none' }}>
                <PreviewH2>채널 성과</PreviewH2>
                <PreviewTable
                  headers={['채널', '노출', '클릭', '전환']}
                  rows={[
                    ['인스타', '12,000', '480', '36'],
                    ['유튜브', '8,000', '300', '24'],
                    ['블로그', '5,000', '210', '18'],
                    ['이메일', '3,000', '150', '12'],
                  ]}
                />
              </PreviewPane>
            </RevealLayer>
          ) : (
            <>
              <EditorPane lines={RAW_METRICS} />
              <PreviewPane style={{ maxWidth: 'none' }}>
                <PreviewH1>채널 성과</PreviewH1>
                <PreviewParagraph>인스타 노출 12000 클릭 480 전환 36</PreviewParagraph>
                <PreviewParagraph>유튜브 노출 8000 클릭 300 전환 24</PreviewParagraph>
                <PreviewParagraph>블로그 노출 5000 클릭 210 전환 18</PreviewParagraph>
                <PreviewParagraph>이메일 노출 3000 클릭 150 전환 12</PreviewParagraph>
              </PreviewPane>
              {showSelection && (
                <div style={{ position: 'absolute', left: SEL_LEFT, top: SELECTION_TOP, width: selW, height: g.height, background: colors.selection, borderRadius: 3, zIndex: 20 }} />
              )}
              {showSparkle && (
                <SparkleButton x={g.sparkleX} y={g.sparkleY} opacity={interpolate(frame, [A_SEL_END, A_SEL_END + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
              )}
              {showMenu && <PresetMenu x={g.menuX} y={g.menuY} frame={frame} openFrame={A_MENU} activeKind={activeKind} />}
              {frame >= A_CARD && frame < A_TRANSFORM + 20 && (
                <div style={{ position: 'absolute', left: CARD_LEFT, top: CARD_TOP, zIndex: 45 }}>
                  <SuggestionCard frame={frame} appearFrame={A_CARD} width={640} title="표로 만들기">
                    <TypingText
                      text={'| 채널 | 노출 | 클릭 | 전환 |\n| --- | --- | --- | --- |\n| 인스타 | 12,000 | 480 | 36 |\n| 유튜브 | 8,000 | 300 | 24 |\n| 블로그 | 5,000 | 210 | 18 |\n| 이메일 | 3,000 | 150 | 12 |'}
                      startFrame={A_CARD}
                      charsPerSecond={46}
                      cursor={false}
                    />
                    <div style={{ marginTop: space[3], display: 'flex', gap: space[2] }}>
                      <PillButton label="✓ 바꾸기" variant="accent" visible={frame >= A_REPLACE - 40} />
                      <PillButton label="⤵ 아래에 삽입" visible={frame >= A_REPLACE - 40} />
                      <PillButton label="↻" visible={frame >= A_REPLACE - 40} />
                    </div>
                  </SuggestionCard>
                </div>
              )}
            </>
          )}
        </AppFrameSlot>
      </SegmentPanel>
      {frame >= SIT_END && frame <= A_END && (
        <CursorPointer
          positions={[
            { frame: SIT_END, x: 900, y: 470 },
            { frame: A_SEL_END - 24, x: CONTENT_X + SEL_LEFT + selW, y: CONTENT_Y + SELECTION_TOP + g.height },
            { frame: A_SPARKLE - 12, x: CONTENT_X + SEL_LEFT + selW, y: CONTENT_Y + SELECTION_TOP + g.height },
            { frame: A_SPARKLE, x: CONTENT_X + g.sparkleX + SPARKLE_SIZE / 2, y: CONTENT_Y + g.sparkleY + SPARKLE_SIZE / 2 },
            { frame: A_PRESET - 26, x: CONTENT_X + g.sparkleX + SPARKLE_SIZE / 2, y: CONTENT_Y + g.sparkleY + SPARKLE_SIZE / 2 },
            { frame: A_PRESET - 14, x: CONTENT_X + g.menuX + 100, y: CONTENT_Y + tableItemY },
            { frame: A_PRESET, x: CONTENT_X + g.menuX + 100, y: CONTENT_Y + tableItemY },
            { frame: A_REPLACE - 26, x: CONTENT_X + g.menuX + 100, y: CONTENT_Y + tableItemY },
            { frame: A_REPLACE - 14, x: replaceBtnX, y: replaceBtnY },
            { frame: A_REPLACE, x: replaceBtnX, y: replaceBtnY },
            { frame: A_END, x: replaceBtnX, y: replaceBtnY },
          ]}
          clicks={[A_SPARKLE, A_PRESET, A_REPLACE]}
        />
      )}
    </>
  );
}

// =====================================================================
// Beat B — 파이 차트
// =====================================================================
function BeatB({ frame }: { frame: number }): JSX.Element | null {
  if (frame < B_START - 20 || frame > B_END + 20) return null;
  const selW = interpolate(frame, [B_SEL_START, B_SEL_END], [0, B_SEL_W], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const g = selGeom(SHARE_LINES.length, selW);
  const rendered = frame >= B_RENDER;
  const showSelection = frame >= B_SEL_START && frame < B_PIE_CLICK;
  const showSparkle = frame >= B_SEL_END && frame < B_PIE_CLICK + 4;
  const showMenu = frame >= B_MENU && frame < B_PIE_CLICK + 4;
  const activeKind = frame >= B_DIAG_HOVER ? 'diagram' : undefined;
  const flyout = frame >= B_DIAG_HOVER ? { openFrame: B_FLYOUT, activeType: (frame >= B_PIE_ACTIVE ? ('pie' as const) : undefined) } : undefined;

  const diagramItemY = presetItemY(g.menuY, 3); // 🧜 다이어그램으로 = index 3
  const flyoutLeft = g.menuX + MENU_W + MENU_PAD;
  const flyoutTop = g.menuY + MENU_PAD + 3 * ITEM_H;
  const pieItemY = flyoutTop + MENU_PAD + 6 * ITEM_H + ITEM_H / 2; // 파이 차트 = flyout index 6
  const pieItemX = flyoutLeft + 100;

  return (
    <>
      <SegmentPanel frame={frame} start={B_START} end={B_END} fade={10}>
        <AppFrameSlot header={<HeaderBar viewMode="split" filename={FILE} isDirty />} sidebar={<FileExplorer rows={ROWS} selected={FILE} />}>
          {rendered ? (
            <RevealLayer frame={frame} appearFrame={B_RENDER}>
              <EditorPane lines={SHARE_WITH_PIE} />
              <PreviewPane style={{ maxWidth: 'none' }}>
                <PreviewH2>채널 비중</PreviewH2>
                <Reveal frame={frame} appearFrame={B_RENDER}>
                  <div style={{ padding: space[3], background: colors.codeBg, border: `1px solid ${colors.border}`, borderRadius: 3 }}>
                    <PieChart frame={frame} appearFrame={B_RENDER + 6} title="채널 비중" slices={PIE_SLICES} />
                  </div>
                </Reveal>
              </PreviewPane>
            </RevealLayer>
          ) : (
            <>
              <EditorPane lines={SHARE_LINES} />
              <PreviewPane style={{ maxWidth: 'none' }}>
                <PreviewH2>채널 비중</PreviewH2>
                <PreviewParagraph>전체 전환의 40%가 인스타에서, 25%가 유튜브, 20%가 블로그, 15%가 이메일에서 나왔다.</PreviewParagraph>
              </PreviewPane>
              {showSelection && (
                <div style={{ position: 'absolute', left: SEL_LEFT, top: SELECTION_TOP, width: selW, height: g.height, background: colors.selection, borderRadius: 3, zIndex: 20 }} />
              )}
              {showSparkle && (
                <SparkleButton x={g.sparkleX} y={g.sparkleY} opacity={interpolate(frame, [B_SEL_END, B_SEL_END + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
              )}
              {showMenu && <PresetMenu x={g.menuX} y={g.menuY} frame={frame} openFrame={B_MENU} activeKind={activeKind} flyout={flyout} />}
            </>
          )}
        </AppFrameSlot>
      </SegmentPanel>
      {frame >= B_START && frame <= B_END && (
        <CursorPointer
          positions={[
            { frame: B_START, x: 900, y: 470 },
            { frame: B_SEL_END - 24, x: CONTENT_X + SEL_LEFT + selW, y: CONTENT_Y + SELECTION_TOP + g.height },
            { frame: B_SPARKLE - 12, x: CONTENT_X + SEL_LEFT + selW, y: CONTENT_Y + SELECTION_TOP + g.height },
            { frame: B_SPARKLE, x: CONTENT_X + g.sparkleX + SPARKLE_SIZE / 2, y: CONTENT_Y + g.sparkleY + SPARKLE_SIZE / 2 },
            { frame: B_DIAG_HOVER - 22, x: CONTENT_X + g.sparkleX + SPARKLE_SIZE / 2, y: CONTENT_Y + g.sparkleY + SPARKLE_SIZE / 2 },
            { frame: B_DIAG_HOVER, x: CONTENT_X + g.menuX + 110, y: CONTENT_Y + diagramItemY },
            { frame: B_PIE_ACTIVE - 30, x: CONTENT_X + g.menuX + 110, y: CONTENT_Y + diagramItemY },
            { frame: B_PIE_ACTIVE, x: CONTENT_X + pieItemX, y: CONTENT_Y + pieItemY },
            { frame: B_PIE_CLICK - 14, x: CONTENT_X + pieItemX, y: CONTENT_Y + pieItemY },
            { frame: B_PIE_CLICK, x: CONTENT_X + pieItemX, y: CONTENT_Y + pieItemY },
            { frame: B_END, x: CONTENT_X + pieItemX, y: CONTENT_Y + pieItemY },
          ]}
          clicks={[B_SPARKLE, B_PIE_CLICK]}
        />
      )}
    </>
  );
}

// =====================================================================
// Beat C — 보고용 한 줄 요약 이어쓰기
// =====================================================================
function BeatC({ frame }: { frame: number }): JSX.Element | null {
  if (frame < C_START - 20) return null;
  const showGhost = frame >= C_GHOST;
  const confirmed = frame >= C_CONFIRM;
  const pulse = frame >= C_PAUSE_START && frame < C_PAUSE_END ? Math.sin((frame - C_PAUSE_START) / 6) * 0.5 + 0.5 : 0;

  return (
    <>
      <SegmentPanel frame={frame} start={C_START} end={1050} fade={10}>
        <AppFrameSlot header={<HeaderBar viewMode="split" filename={FILE} isDirty />} sidebar={<FileExplorer rows={ROWS} selected={FILE} />}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', background: colors.surfaceRaised, fontFamily: font.mono, fontSize: fontSize.editor, lineHeight: lineHeight.editor, color: colors.textPrimary, padding: `${space[3]}px ${space[4]}px` }}>
            <span style={{ whiteSpace: 'pre-wrap' }}>{C_INTRO}</span>
            {showGhost ? (
              <GhostText text={C_GHOSTTX} startFrame={C_GHOST} frame={frame} confirmFrame={confirmed ? C_CONFIRM : undefined} charsPerSecond={22} />
            ) : (
              <TypingText text="" startFrame={-1000} staticText cursor />
            )}
          </div>
          <PreviewPane style={{ maxWidth: 'none' }}>
            <PreviewParagraph>
              {C_INTRO}
              {showGhost && <span style={{ color: confirmed ? colors.textPrimary : colors.textFaint }}>{C_GHOSTTX}</span>}
            </PreviewParagraph>
          </PreviewPane>
        </AppFrameSlot>
      </SegmentPanel>
      {frame >= C_PAUSE_START && frame < C_KEY && (
        <div style={{ position: 'absolute', left: C_ANCHOR_X, top: C_ANCHOR_Y, display: 'flex', alignItems: 'center', gap: 8, opacity: interpolate(frame, [C_PAUSE_START, C_PAUSE_START + 8, C_PAUSE_END + 12, C_KEY], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          <div style={{ width: 8, height: 20, background: colors.accent, opacity: 0.4 + pulse * 0.5 }} />
        </div>
      )}
      {frame >= C_KEY - 14 && frame < C_GHOST + 10 && (
        <div style={{ position: 'absolute', left: C_ANCHOR_X, top: C_ANCHOR_Y }}><Keycap keys={['Ctrl', 'Enter']} /></div>
      )}
      {frame >= C_CONFIRM - 16 && frame < C_CONFIRM + 22 && (
        <div style={{ position: 'absolute', left: C_ANCHOR_X, top: C_ANCHOR_Y }}><Keycap keys={['Ctrl', 'Enter']} /></div>
      )}
      {frame >= C_START && (
        <CursorPointer
          positions={[
            { frame: C_START, x: 900, y: 470 },
            { frame: C_START + 30, x: C_ANCHOR_X + 40, y: C_ANCHOR_Y + 12 },
            { frame: C_KEY - 20, x: C_ANCHOR_X + 40, y: C_ANCHOR_Y + 12 },
            { frame: C_KEY, x: C_ANCHOR_X + 20, y: C_ANCHOR_Y + 12 },
            { frame: 1050, x: C_ANCHOR_X + 20, y: C_ANCHOR_Y + 12 },
          ]}
          clicks={[C_KEY]}
        />
      )}
    </>
  );
}

export function UCase2Promo(): JSX.Element {
  const frame = useCurrentFrame();
  useVideoConfig();

  return (
    <AbsoluteFill style={{ background: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: FRAME_W, height: FRAME_H }}>
        <BeatA frame={frame} />
        <BeatB frame={frame} />
        <BeatC frame={frame} />
      </div>

      <SituationCard
        frame={frame}
        startFrame={0}
        endFrame={SIT_END}
        persona="홍보 · 박주임"
        moment="캠페인 종료 다음 날, 보고 회의 1시간 전"
        task="채널별 성과를 표와 차트로 정리해 보고"
      />

      <SubtitleBar text="채널별 지표 날메모를 전체 선택" startFrame={SIT_END} endFrame={A_MENU} />
      <SubtitleBar text="✨ → 📊 표로 만들기" startFrame={A_MENU} endFrame={A_CARD + 6} />
      <SubtitleBar text="흩어진 숫자가 표로 정리된다" startFrame={A_CARD + 6} endFrame={A_REPLACE} />
      <SubtitleBar text="✓ 바꾸기로 성과 표 완성" startFrame={A_REPLACE} endFrame={B_SEL_START} />
      <SubtitleBar text="채널 비중 문단을 선택" startFrame={B_SEL_START} endFrame={B_MENU} />
      <SubtitleBar text="✨ → 🧜 다이어그램으로 → 파이 차트 지정" startFrame={B_MENU} endFrame={B_PIE_ACTIVE} />
      <SubtitleBar text="비중이 그대로 파이 차트가 된다" startFrame={B_PIE_ACTIVE} endFrame={C_START} />
      <SubtitleBar text="보고용 한 줄 요약은 Ctrl+Enter로" startFrame={C_START} endFrame={C_CONFIRM} />
      <SubtitleBar text="이어쓰기로 보고 준비 완료" startFrame={C_CONFIRM} endFrame={1050} />

      <SceneChip title="케이스 2 · 홍보 성과 보고" />
    </AbsoluteFill>
  );
}
