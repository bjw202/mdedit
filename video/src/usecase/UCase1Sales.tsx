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
  PreviewList,
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
  GanttChart,
  GhostText,
  SituationCard,
  type GanttTask,
} from './chrome';

/**
 * C1 — 케이스 1: 영업 페르소나 (~35s / 1050f).
 * 상황 카드(오후 4시, 미팅 종료, 내일 오전까지 제안 요약) → 미팅 날메모를 개요로 정리 →
 * 도입 일정 문단을 간트 차트로 → 맺음 문장을 이어쓰기로 마무리. 하나의 연속된 업무 흐름.
 */
export const C1_DURATION_IN_FRAMES = 1050;

const FILE = '미팅메모.md';
const ROWS: FileExplorerRow[] = [
  { name: '미팅메모.md', type: 'file' },
  { name: '제안서.md', type: 'file' },
  { name: '고객리스트.md', type: 'file' },
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

// ── 상황 카드 ────────────────────────────────────────────────────────────────
const SIT_END = 138;

// ── Beat A: 미팅 메모 → 제안 요약 개요 ─────────────────────────────────────────
const A_SEL_START = 190;
const A_SEL_END = 250;
const A_SPARKLE = 285;
const A_MENU = 302;
const A_PRESET = 370;
const A_CARD = 390;
const A_REPLACE = 455;
const A_TRANSFORM = 473;
const A_END = 508;
const A_SEL_W = 520;

const RAW_MEMO = [
  '미팅 메모',
  '고객 데이터 이관 관심 높음 보안 우려',
  '요청 도입 일정 견적 레퍼런스',
  '결정권자 최부장 예산 상반기 확정',
  '차주 제안서 회신 요망',
];
const OUTLINE_LINES = [
  '# 제안 요약',
  '',
  '## 고객 니즈',
  '- 데이터 이관, 보안 강화',
  '',
  '## 핵심 요청',
  '- 도입 일정, 견적, 레퍼런스',
  '',
  '## 다음 단계',
  '- 최부장 최종 결정',
  '- 상반기 예산 확정',
];

// ── Beat B: 도입 일정 문단 → 간트 차트 ─────────────────────────────────────────
const B_START = 516;
const B_SEL_START = 560;
const B_SEL_END = 615;
const B_SPARKLE = 650;
const B_MENU = 667;
const B_DIAG_HOVER = 718;
const B_FLYOUT = 728;
const B_GANTT_ACTIVE = 768;
const B_GANTT_CLICK = 788;
const B_RENDER = 806;
const B_END = 840;
const B_SEL_W = 545;

const SCHEDULE_LINES = [
  '## 도입 일정',
  '1주차는 요구사항 확정과 계정 설정을 진행한다.',
  '2~3주차는 데이터 이관과 연동을 맡는다.',
  '4주차는 사용자 교육, 5주차에 정식 오픈한다.',
];
const SCHEDULE_WITH_GANTT = [
  ...SCHEDULE_LINES,
  '',
  '```mermaid',
  'gantt',
  '  title 도입 일정',
  '  요구사항 :2026-06-01, 5d',
  '  데이터 이관 :2026-06-06, 10d',
  '  사용자 교육 :2026-06-20, 5d',
  '  정식 오픈 :milestone, 2026-06-28, 0d',
  '```',
];
const GANTT_TASKS: GanttTask[] = [
  { section: '착수', name: '요구사항', start: 1, end: 5 },
  { section: '구축', name: '데이터 이관', start: 6, end: 15 },
  { section: '전개', name: '사용자 교육', start: 20, end: 24 },
  { section: '오픈', name: '정식 오픈', start: 28, end: 28, milestone: true },
];

// ── Beat C: 맺음 문장 이어쓰기 ────────────────────────────────────────────────
const C_START = 848;
const C_PAUSE_START = 866;
const C_PAUSE_END = 926;
const C_KEY = 950;
const C_GHOST = 970;
const C_CONFIRM = 1035;
const C_ANCHOR_X = CONTENT_X + 34;
const C_ANCHOR_Y = CONTENT_Y + 60;
const C_INTRO = '이 제안이 통과되면 상반기 안에 도입을 마칠 수 있다. 다음 회신에서';
const C_GHOSTTX = ' 견적서와 도입 일정표를 함께 전달한다.';

// =====================================================================
// Beat A
// =====================================================================
function BeatA({ frame }: { frame: number }): JSX.Element | null {
  if (frame < SIT_END - 20 || frame > A_END + 20) return null;
  const selW = interpolate(frame, [A_SEL_START, A_SEL_END], [0, A_SEL_W], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const g = selGeom(RAW_MEMO.length, selW);
  const transformed = frame >= A_TRANSFORM;
  const showSelection = frame >= A_SEL_START && frame < A_PRESET + 20;
  const showSparkle = frame >= A_SEL_END && frame < A_CARD;
  const showMenu = frame >= A_MENU && frame < A_CARD + 4;
  const showCard = frame >= A_CARD && frame < A_TRANSFORM + 20;
  const activeKind = frame >= A_PRESET ? 'outline' : undefined;

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
              <EditorPane lines={OUTLINE_LINES} />
              <PreviewPane style={{ maxWidth: 'none' }}>
                <PreviewH1>제안 요약</PreviewH1>
                <PreviewH2>고객 니즈</PreviewH2>
                <PreviewList items={['데이터 이관, 보안 강화']} />
                <PreviewH2>핵심 요청</PreviewH2>
                <PreviewList items={['도입 일정, 견적, 레퍼런스']} />
                <PreviewH2>다음 단계</PreviewH2>
                <PreviewList items={['최부장 최종 결정', '상반기 예산 확정']} />
              </PreviewPane>
            </RevealLayer>
          ) : (
            <>
              <EditorPane lines={RAW_MEMO} />
              <PreviewPane style={{ maxWidth: 'none' }}>
                <PreviewH1>미팅 메모</PreviewH1>
                <PreviewParagraph>고객 데이터 이관 관심 높음 보안 우려</PreviewParagraph>
                <PreviewParagraph>요청 도입 일정 견적 레퍼런스</PreviewParagraph>
                <PreviewParagraph>결정권자 최부장 예산 상반기 확정</PreviewParagraph>
                <PreviewParagraph>차주 제안서 회신 요망</PreviewParagraph>
              </PreviewPane>
              {showSelection && (
                <div style={{ position: 'absolute', left: SEL_LEFT, top: SELECTION_TOP, width: selW, height: g.height, background: colors.selection, borderRadius: 3, zIndex: 20 }} />
              )}
              {showSparkle && (
                <SparkleButton x={g.sparkleX} y={g.sparkleY} opacity={interpolate(frame, [A_SEL_END, A_SEL_END + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
              )}
              {showMenu && <PresetMenu x={g.menuX} y={g.menuY} frame={frame} openFrame={A_MENU} activeKind={activeKind} />}
              {showCard && (
                <div style={{ position: 'absolute', left: CARD_LEFT, top: CARD_TOP, zIndex: 45 }}>
                  <SuggestionCard frame={frame} appearFrame={A_CARD} width={640} title="개요로 정리">
                    <TypingText
                      text={'# 제안 요약\n## 고객 니즈\n- 데이터 이관, 보안 강화\n## 핵심 요청\n- 도입 일정 · 견적 · 레퍼런스\n## 다음 단계\n- 최부장 결정 · 상반기 예산 확정'}
                      startFrame={A_CARD}
                      charsPerSecond={42}
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
            { frame: A_PRESET - 14, x: CONTENT_X + g.menuX + 100, y: CONTENT_Y + g.menuY + 51 },
            { frame: A_PRESET, x: CONTENT_X + g.menuX + 100, y: CONTENT_Y + g.menuY + 51 },
            { frame: A_REPLACE - 26, x: CONTENT_X + g.menuX + 100, y: CONTENT_Y + g.menuY + 51 },
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
// Beat B
// =====================================================================
function BeatB({ frame }: { frame: number }): JSX.Element | null {
  if (frame < B_START - 20 || frame > B_END + 20) return null;
  const selW = interpolate(frame, [B_SEL_START, B_SEL_END], [0, B_SEL_W], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const g = selGeom(SCHEDULE_LINES.length, selW);
  const rendered = frame >= B_RENDER;
  const showSelection = frame >= B_SEL_START && frame < B_GANTT_CLICK;
  const showSparkle = frame >= B_SEL_END && frame < B_GANTT_CLICK + 4;
  const showMenu = frame >= B_MENU && frame < B_GANTT_CLICK + 4;
  const activeKind = frame >= B_DIAG_HOVER ? 'diagram' : undefined;
  const flyout = frame >= B_DIAG_HOVER ? { openFrame: B_FLYOUT, activeType: (frame >= B_GANTT_ACTIVE ? ('gantt' as const) : undefined) } : undefined;

  const diagramItemY = g.menuY + MENU_PAD + 3 * ITEM_H + ITEM_H / 2;
  const flyoutLeft = g.menuX + MENU_W + MENU_PAD;
  const flyoutTop = g.menuY + MENU_PAD + 3 * ITEM_H;
  const ganttItemY = flyoutTop + MENU_PAD + 3 * ITEM_H + ITEM_H / 2;
  const ganttItemX = flyoutLeft + 100;

  return (
    <>
      <SegmentPanel frame={frame} start={B_START} end={B_END} fade={10}>
        <AppFrameSlot header={<HeaderBar viewMode="split" filename={FILE} isDirty />} sidebar={<FileExplorer rows={ROWS} selected={FILE} />}>
          {rendered ? (
            <RevealLayer frame={frame} appearFrame={B_RENDER}>
              <EditorPane lines={SCHEDULE_WITH_GANTT} />
              <PreviewPane style={{ maxWidth: 'none' }}>
                <PreviewH2>도입 일정</PreviewH2>
                <Reveal frame={frame} appearFrame={B_RENDER}>
                  <div style={{ padding: space[3], background: colors.codeBg, border: `1px solid ${colors.border}`, borderRadius: 3 }}>
                    <GanttChart frame={frame} appearFrame={B_RENDER + 6} title="도입 일정" tasks={GANTT_TASKS} />
                  </div>
                </Reveal>
              </PreviewPane>
            </RevealLayer>
          ) : (
            <>
              <EditorPane lines={SCHEDULE_LINES} />
              <PreviewPane style={{ maxWidth: 'none' }}>
                <PreviewH2>도입 일정</PreviewH2>
                <PreviewParagraph>1주차는 요구사항 확정과 계정 설정을 진행한다.</PreviewParagraph>
                <PreviewParagraph>2~3주차는 데이터 이관과 연동을 맡는다.</PreviewParagraph>
                <PreviewParagraph>4주차는 사용자 교육, 5주차에 정식 오픈한다.</PreviewParagraph>
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
            { frame: B_GANTT_ACTIVE - 30, x: CONTENT_X + g.menuX + 110, y: CONTENT_Y + diagramItemY },
            { frame: B_GANTT_ACTIVE, x: CONTENT_X + ganttItemX, y: CONTENT_Y + ganttItemY },
            { frame: B_GANTT_CLICK - 14, x: CONTENT_X + ganttItemX, y: CONTENT_Y + ganttItemY },
            { frame: B_GANTT_CLICK, x: CONTENT_X + ganttItemX, y: CONTENT_Y + ganttItemY },
            { frame: B_END, x: CONTENT_X + ganttItemX, y: CONTENT_Y + ganttItemY },
          ]}
          clicks={[B_SPARKLE, B_GANTT_CLICK]}
        />
      )}
    </>
  );
}

// =====================================================================
// Beat C
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

export function UCase1Sales(): JSX.Element {
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
        persona="영업 · 김대리"
        moment="오후 4시, 고객 미팅 종료"
        task="내일 오전까지 제안 요약을 정리해 회신"
      />

      {/* 자막 (케이스-로컬 프레임) */}
      <SubtitleBar text="미팅 날메모를 붙여넣고 전체 선택" startFrame={SIT_END} endFrame={A_MENU} />
      <SubtitleBar text="✨ → 📋 개요로 정리" startFrame={A_MENU} endFrame={A_CARD + 6} />
      <SubtitleBar text="제안 요약이 실시간으로 만들어진다" startFrame={A_CARD + 6} endFrame={A_REPLACE} />
      <SubtitleBar text="✓ 바꾸기로 정돈된 요약 완성" startFrame={A_REPLACE} endFrame={B_SEL_START} />
      <SubtitleBar text="도입 일정 문단을 선택" startFrame={B_SEL_START} endFrame={B_MENU} />
      <SubtitleBar text="✨ → 🧜 다이어그램으로 → 간트 차트 지정" startFrame={B_MENU} endFrame={B_GANTT_ACTIVE} />
      <SubtitleBar text="일정 문장이 그대로 간트 차트가 된다" startFrame={B_GANTT_ACTIVE} endFrame={C_START} />
      <SubtitleBar text="맺음 문장이 막히면 Ctrl+Enter" startFrame={C_START} endFrame={C_CONFIRM} />
      <SubtitleBar text="이어쓰기로 회신까지 마무리" startFrame={C_CONFIRM} endFrame={1050} />

      <SceneChip title="케이스 1 · 영업 제안 요약" />
    </AbsoluteFill>
  );
}
