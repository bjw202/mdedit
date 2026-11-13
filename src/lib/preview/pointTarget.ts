// @MX:SPEC: SPEC-AI-017 D1 D4 D6 D10 D11 D14 REQ-AI17-004..008
// @MX:NOTE: 미리보기 DOM 의 대상(열·칸·노드)을 에디터 소스의 블록과 잇는 순수 모듈.
// 블록은 data-line 이 아니라 순번(k번째 표 / k번째 mermaid 펜스)으로 찾는다 — 인라인 <svg> 치환이
// 줄 번호를 밀기 때문이다. 순번 대응이 DOM 과 어긋나면 엉뚱한 블록을 고르지 않도록 요청을 막는다.

import { createMarkdownParser } from '@/lib/markdown/renderer';
import { previewDiagramInput } from '@/lib/export/exportUtils';
import { splitRow } from '@/lib/ai/tableValidate';
import { evaluateSelectionGuard, type SelectionGuardResult } from '@/components/editor/extensions/ai-length-guard';
import { getEffectiveAiEnabled } from '@/store/aiPolicy';
import { useUIStore, type ViewMode } from '@/store/uiStore';

export type PointKind = 'column' | 'cell' | 'node' | 'none';
export type BlockKind = 'table' | 'diagram';

export interface PointClassification {
  kind: PointKind;
  /** column/cell: 대상이 든 DOM 표 */
  table?: HTMLTableElement;
  /** column/cell: 왼쪽부터 1 */
  col?: number;
  /** cell: 머리 행 다음부터 1 */
  row?: number;
  /** node: 대상 노드 요소와 소속 컨테이너 */
  nodeEl?: Element;
  container?: Element;
  nodeId?: string;
  /** node: 렌더된 노드 글자(연속 공백 한 칸, 앞뒤 공백 제거) */
  nodeText?: string;
}

/** 목록·인용 안(최상위가 아닌) 블록인지. */
function isNested(el: Element, root: Element): boolean {
  const nested = el.closest('li, blockquote');
  return nested !== null && root.contains(nested);
}

/** 이벤트 대상 요소를 대상 종류로 분류한다(D4). 대상이 아니면 kind 'none'. */
export function classifyTarget(el: Element | null, root: Element): PointClassification {
  if (!el || !root.contains(el)) return { kind: 'none' };

  const cell = el.closest('th, td');
  if (cell && root.contains(cell)) {
    const table = cell.closest('table');
    if (!table || !root.contains(table) || isNested(table, root)) return { kind: 'none' };
    const tr = cell.parentElement;
    if (!tr) return { kind: 'none' };
    const col = Array.from(tr.children).indexOf(cell) + 1;
    if (cell.tagName === 'TH') return { kind: 'column', table, col };
    const bodyRows = Array.from(table.querySelectorAll('tbody > tr'));
    const row = bodyRows.indexOf(tr as HTMLTableRowElement) + 1;
    if (row < 1) return { kind: 'none' };
    return { kind: 'cell', table, col, row };
  }

  const node = el.closest('g.pele-node[data-id]');
  if (node && root.contains(node)) {
    const container = node.closest('.mermaid-container');
    if (!container || isNested(container, root)) return { kind: 'none' };
    const nodeId = node.getAttribute('data-id') ?? '';
    const nodeText = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    return { kind: 'node', nodeEl: node, container, nodeId, nodeText };
  }

  return { kind: 'none' };
}

interface ParsedTable {
  startLine: number;
  endLine: number;
  level: number;
  thCount: number;
}
interface ParsedFence {
  startLine: number;
  endLine: number;
  level: number;
  content: string;
}
interface ParsedBlocks {
  tables: ParsedTable[];
  fences: ParsedFence[];
}

// @MX:NOTE: 렌더에 쓴 것과 같은 파서 구성(createMarkdownParser)으로 파싱한다 — 다른 파서를 쓰면
// 줄 끝 공백이 있는 ```mermaid 펜스·$$ 수식 블록에서 순번이 어긋난다(계획 감사 2차).
function parseBlocks(source: string): ParsedBlocks {
  const tokens = createMarkdownParser(null, false, null).parse(source, {});
  const tables: ParsedTable[] = [];
  const fences: ParsedFence[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'table_open' && t.map) {
      let th = 0;
      for (let j = i + 1; j < tokens.length && tokens[j].type !== 'table_close'; j++) {
        if (tokens[j].type === 'th_open') th++;
      }
      tables.push({ startLine: t.map[0], endLine: t.map[1], level: t.level, thCount: th });
    } else if (t.type === 'fence' && t.map && t.info.trim() === 'mermaid') {
      fences.push({ startLine: t.map[0], endLine: t.map[1], level: t.level, content: t.content });
    }
  }
  return { tables, fences };
}

/** 펜스 content 의 끝 줄바꿈 하나를 뗀 "펜스 안 코드". */
function fenceCode(content: string): string {
  return content.endsWith('\n') ? content.slice(0, -1) : content;
}

function tableText(source: string, t: ParsedTable): string {
  return source.split('\n').slice(t.startLine, t.endLine).join('\n');
}

export interface PointBlock {
  kind: BlockKind;
  /** 문서 순서의 k번째(0부터) 표 또는 mermaid 펜스 */
  ordinal: number;
  /** 블록 줄 범위: 0부터, 끝은 제외. 다이어그램은 펜스 줄까지 포함 */
  startLine: number;
  endLine: number;
  /** 요청에 보내는 selection: 표 = 표 줄 전체, 다이어그램 = 펜스 안 코드 */
  text: string;
}

export type LocateResult =
  | { ok: true; block: PointBlock }
  | { ok: false; reason: 'unpointable' | 'not-target' };

const NO: LocateResult = { ok: false, reason: 'unpointable' };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 노드 ID 가 코드에 낱말로 나타나는지 — 앞뒤가 유니코드 글자·숫자·_ 가 아니거나 처음·끝(D4). */
export function idAppearsAsWord(code: string, id: string): boolean {
  if (!id) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(id)}(?![\\p{L}\\p{N}_])`, 'u').test(code);
}

/**
 * 분류된 대상의 블록을 순번으로 찾는다(D11). source 는 root 를 렌더할 때 쓴 소스여야 한다.
 * 일치 확인(개수·data-diagram·머리 칸 수)이 하나라도 어긋나면 'unpointable'.
 */
export function locatePointBlock(root: Element, source: string, target: PointClassification): LocateResult {
  if (target.kind === 'none') return NO;
  const parsed = parseBlocks(source);

  if (target.kind === 'column' || target.kind === 'cell') {
    const domTables = Array.from(root.querySelectorAll('table'));
    if (!target.table || domTables.length !== parsed.tables.length) return NO;
    const k = domTables.indexOf(target.table);
    if (k < 0) return NO;
    const pt = parsed.tables[k];
    if (pt.level !== 0) return NO;
    if (target.table.querySelectorAll('thead th').length !== pt.thCount) return NO;
    return {
      ok: true,
      block: { kind: 'table', ordinal: k, startLine: pt.startLine, endLine: pt.endLine, text: tableText(source, pt) },
    };
  }

  // node
  const domContainers = Array.from(root.querySelectorAll('.mermaid-container'));
  if (!target.container || domContainers.length !== parsed.fences.length) return NO;
  const k = domContainers.indexOf(target.container);
  if (k < 0) return NO;
  const pf = parsed.fences[k];
  if (pf.level !== 0) return NO;
  // R1: 미리보기가 받는 값(속성 파싱으로 디코드된 값)과 비교한다 — 펜스 content 그대로 비교하면 &amp; 같은 문자 참조가 막힌다.
  if (target.container.getAttribute('data-diagram') !== previewDiagramInput(pf.content)) return NO;
  if (!idAppearsAsWord(pf.content, target.nodeId ?? '')) return { ok: false, reason: 'not-target' };
  return {
    ok: true,
    block: { kind: 'diagram', ordinal: k, startLine: pf.startLine, endLine: pf.endLine, text: fenceCode(pf.content) },
  };
}

/** 같은 순번 블록의 텍스트. 순번 블록이 없으면 null. */
export function blockTextAt(source: string, kind: BlockKind, ordinal: number): string | null {
  const parsed = parseBlocks(source);
  if (kind === 'table') {
    const t = parsed.tables[ordinal];
    return t ? tableText(source, t) : null;
  }
  const f = parsed.fences[ordinal];
  return f ? fenceCode(f.content) : null;
}

/**
 * 낡음 판정(D11): 렌더 소스의 순번 블록 텍스트가 현재 에디터 문서의 같은 순번 블록과 다르면(블록이 없어도) 낡음.
 * ⌥+클릭 순간과 보내기 순간에 각각 부른다.
 */
export function isPointStale(renderSource: string, editorDoc: string, block: Pick<PointBlock, 'kind' | 'ordinal'>): boolean {
  const before = blockTextAt(renderSource, block.kind, block.ordinal);
  const now = blockTextAt(editorDoc, block.kind, block.ordinal);
  return before === null || now === null || before !== now;
}

/** 미리보기가 다시 그려진 뒤 강조 복원 여부(REQ-AI17-014): 카드를 만들 때의 블록 텍스트와 같을 때만 복원. */
export function decideHighlightRestore(
  cardBlockText: string,
  newRenderSource: string,
  block: Pick<PointBlock, 'kind' | 'ordinal'>,
): 'restore' | 'clear' {
  return blockTextAt(newRenderSource, block.kind, block.ordinal) === cardBlockText ? 'restore' : 'clear';
}

/** 대상 정보 문자열(「대상 정보 형식」, D14). 열 머리·칸은 소스에서, 노드 글자는 렌더된 노드에서. */
export function buildPointerInfo(target: PointClassification, block: PointBlock): string {
  if (target.kind === 'node') {
    return `대상: 노드\n노드 ID: ${target.nodeId ?? ''}\n표시 글자: ${target.nodeText ?? ''}`;
  }
  const lines = block.text.split('\n');
  const col = target.col ?? 1;
  const header = (splitRow(lines[0] ?? '')[col - 1] ?? '').trim();
  if (target.kind === 'column') {
    return `대상: 열\n열 번호: ${col} (왼쪽부터)\n열 머리: ${header}`;
  }
  const row = target.row ?? 1;
  // 표 첫 줄 + row + 1 이 본문 row 행(머리·구분선 다음)
  const cell = (splitRow(lines[row + 1] ?? '')[col - 1] ?? '').trim();
  return `대상: 칸\n행 번호: ${row} (머리 행 다음부터)\n열 번호: ${col} (왼쪽부터)\n열 머리: ${header}\n칸 내용: ${cell}`;
}

/** 입력창 대상 요약 한 줄(REQ-AI17-009). */
export function buildPointerSummary(target: PointClassification, block: PointBlock): string {
  if (target.kind === 'node') return `노드: ${target.nodeText ?? ''} (${target.nodeId ?? ''})`;
  const header = (splitRow(block.text.split('\n')[0] ?? '')[(target.col ?? 1) - 1] ?? '').trim();
  return target.kind === 'column' ? `열: ${header}` : `칸: ${target.row}행 · ${header}`;
}

/** 길이 판정(D10): 변환 계열과 같은 판정을 `selection` 길이에 적용한다. */
export function evaluatePointLength(block: Pick<PointBlock, 'kind' | 'text'>): SelectionGuardResult {
  return evaluateSelectionGuard(block.text.length, block.kind === 'table' ? 'point-table' : 'point-diagram');
}

/** 가리키기 활성 조건(AC-AI17-001): 사용자 토글 켜짐 + 정책 잠금 없음 + 분할 보기. */
export function isPointingActive(s: { userEnabled: boolean; policyDisabled: boolean; viewMode: ViewMode }): boolean {
  return s.userEnabled && !s.policyDisabled && s.viewMode === 'split';
}

/** 지금 이 순간의 활성 여부 — 정책 잠금은 반응형이 아니므로 ⌥+클릭·보내기 때마다 부른다. */
export function isPointingActiveNow(): boolean {
  const { viewMode } = useUIStore.getState();
  return getEffectiveAiEnabled() && viewMode === 'split';
}
