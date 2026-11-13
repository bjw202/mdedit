// @MX:SPEC: SPEC-AI-017 REQ-AI17-003 REQ-AI17-014 REQ-AI17-015 D16
// @MX:NOTE: 가리키기 강조 클래스 조작. 공통 클래스 md-point-target + 수정자(hover=⌥ 강조, pending=카드 대기 강조)로
// 구분한다. 노드는 같은 data-id 의 모든 g.pele-node 에 붙인다(sequence 참가자는 위·아래 두 번 그려진다).
import {
  classifyTarget,
  decideHighlightRestore,
  locatePointBlock,
  type PointClassification,
} from './pointTarget';
import type { PointRef } from './pointRequest';

export const POINT_BASE_CLASS = 'md-point-target';
export const POINT_HOVER_CLASS = 'md-point-target--hover';
export const POINT_PENDING_CLASS = 'md-point-target--pending';
export type PointModifier = typeof POINT_HOVER_CLASS | typeof POINT_PENDING_CLASS;

const MODIFIERS: PointModifier[] = [POINT_HOVER_CLASS, POINT_PENDING_CLASS];

export function addMark(el: Element, mod: PointModifier): void {
  el.classList.add(POINT_BASE_CLASS, mod);
}

/** 수정자를 떼고, 다른 수정자가 없으면 공통 클래스도 뗀다. */
export function removeMark(el: Element, mod: PointModifier): void {
  el.classList.remove(mod);
  if (!MODIFIERS.some((m) => el.classList.contains(m))) el.classList.remove(POINT_BASE_CLASS);
}

/** root 안에서 해당 수정자가 붙은 모든 요소의 표시를 뗀다. */
export function clearMarks(root: ParentNode, mod: PointModifier): void {
  root.querySelectorAll('.' + mod).forEach((el) => removeMark(el, mod));
}

/** 문서 전체에서 모든 가리키기 표시를 뗀다(AI 끄기·파일 전환 정리). */
export function clearAllPointMarks(): void {
  document.querySelectorAll('.' + POINT_BASE_CLASS).forEach((el) => {
    el.classList.remove(POINT_BASE_CLASS, ...MODIFIERS);
  });
}

function nodesWithId(container: Element | undefined, id: string | undefined): Element[] {
  if (!container || !id) return [];
  return Array.from(container.querySelectorAll('g.pele-node[data-id]')).filter((g) => g.getAttribute('data-id') === id);
}

/** 분류된 대상의 강조 대상 요소들(D16). */
export function markTargetsOf(t: PointClassification): Element[] {
  if (t.kind === 'column') {
    const th = t.table?.querySelectorAll('thead th')[(t.col ?? 1) - 1];
    return th ? [th] : [];
  }
  if (t.kind === 'cell') {
    const tr = t.table?.querySelectorAll('tbody > tr')[(t.row ?? 1) - 1];
    const td = tr?.children[(t.col ?? 1) - 1];
    return td ? [td] : [];
  }
  if (t.kind === 'node') return nodesWithId(t.container, t.nodeId);
  return [];
}

/**
 * 카드가 열린 뒤 다시 그려진 미리보기에서 같은 대상을 찾는다(REQ-AI17-014). 같은 순번 블록의 텍스트가
 * 카드를 만들 때와 같고(decideHighlightRestore), 새 DOM 에서도 순번 대응이 맞을 때만 요소를 돌려준다.
 */
export function restoreMarkTargets(root: Element, newSource: string, ref: PointRef): Element[] {
  if (decideHighlightRestore(ref.blockText, newSource, { kind: ref.blockKind, ordinal: ref.ordinal }) === 'clear') return [];

  let probe: Element | undefined;
  if (ref.blockKind === 'table') {
    const table = root.querySelectorAll('table')[ref.ordinal];
    probe = table?.querySelector('thead th') ?? undefined;
  } else {
    const container = root.querySelectorAll('.mermaid-container')[ref.ordinal];
    probe = nodesWithId(container, ref.nodeId)[0];
  }
  if (!probe) return [];

  // 순번 대응 재확인 — 개수·data-diagram·머리 칸 수가 어긋나면 엉뚱한 블록이므로 지운다.
  const base = classifyTarget(probe, root);
  const loc = locatePointBlock(root, newSource, base);
  if (!loc.ok || loc.block.ordinal !== ref.ordinal) return [];

  if (ref.kind === 'node') return nodesWithId(base.container, ref.nodeId);
  const t: PointClassification = { kind: ref.kind, table: base.table, col: ref.col, row: ref.row };
  return markTargetsOf(t);
}
