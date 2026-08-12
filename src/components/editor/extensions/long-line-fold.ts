// @MX:SPEC: SPEC-IMG-LOAD-002
// @MX:NOTE: [AUTO] REQ-IMG-LOAD-2-A-003 — 거대 라인 자동 폴딩 (foldEffect dispatch, D2).
//
// D2 (감사 수정): always-on StateField + Decoration.fold 패턴을 쓰지 않는다.
// 그 패턴은 REQ-A-004 (폴드 토글) 와 충돌한다 — always-on field 가 사용자 unfold 를
// 즉시 덮어쓴다. 대신 foldEffect dispatch against @codemirror/language foldState 패턴을 쓴다:
//
//   1. foldState (codeFolding() 이 제공) 가 실제 fold decoration 을 관리한다.
//   2. 본 플러그인은 long line 감지 시 foldEffect.of({from, to}) 만 dispatch 한다.
//   3. 사용자가 unfold 하면 unfoldEffect 가 foldState 에서 해당 fold 를 제거한다.
//   4. 본 플러그인의 'considered' set 이 이미 고려한 라인을 추적 → 자동 재-fold 방지.
//
// OD-A (사용자 unfold 존중): scanAndFold 는 considered 에 없는 NEW long line 만 fold 한다.
// 이미 고려한 라인은 사용자가 unfold 했어도 다시 fold 하지 않는다.

import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { foldEffect } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { LINE_FOLD_THRESHOLD } from '@/lib/preview/previewLimits';

/**
 * 테스트 편의를 위해 export 하는 상수 — LINE_FOLD_THRESHOLD 와 동일.
 * longLineFold.test.ts 가 이 값을 직접 참조해서 경계값 케이스를 재현한다.
 */
export const LINE_FOLD_THRESHOLD_LOCAL = LINE_FOLD_THRESHOLD;

/**
 * 최소 doc 인터페이스 — CodeMirror Text 호환. 길이/시작/끝만 알면 full text materialize 불필요.
 */
interface LineLike { from: number; to: number; length: number }
interface DocLike {
  lines: number;
  line(n: number): LineLike;
}

/**
 * 주어진 문서에서 fold 대상 long line 을 찾는 순수 함수 (UT-A1-003 테스트 대상).
 *
 * - threshold 초과 라인만 후보 (>, 경계값 포함 안 함).
 * - 이미 considered set 에 있는 lineFrom 은 제외 (OD-A — 사용자 unfold 존중).
 *
 * 반환값의 lineFrom 은后续 foldEffect.of({from: line.from, to: line.to}) 에 그대로 쓴다.
 */
export function findLinesToFold(
  doc: DocLike,
  considered: Set<number>,
  threshold: number = LINE_FOLD_THRESHOLD,
): Array<{ from: number; to: number; lineFrom: number }> {
  const result: Array<{ from: number; to: number; lineFrom: number }> = [];
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (line.length > threshold && !considered.has(line.from)) {
      result.push({ from: line.from, to: line.to, lineFrom: line.from });
    }
  }
  return result;
}

/**
 * ViewPlugin class — long line 자동 fold.
 * dispatch 는 ViewPlugin 생명주기 안에서 안전하게 호출된다 (CodeMirror 6 큐잉).
 */
class LongLineAutoFoldPlugin {
  /** 이미 fold 고려를 마친 line 시작 위치 (docChanged 마다 mapPos 로 갱신). */
  considered: Set<number> = new Set();

  constructor(view: EditorView) {
    this.scanAndFold(view);
  }

  update(update: ViewUpdate): void {
    if (!update.docChanged) return;
    // considered 위치를 changes 에 따라 map. 삭제된 위치는 자연스럽게 같은 곳으로 map 되어
    // 이후 scan 시 다른 line 과 충돌하지 않는다 (라인 시작 위치 정합성은 다음 scan 이 보정).
    const mapped = new Set<number>();
    for (const pos of this.considered) {
      mapped.add(update.changes.mapPos(pos));
    }
    this.considered = mapped;
    this.scanAndFold(update.view);
  }

  private scanAndFold(view: EditorView): void {
    const targets = findLinesToFold(view.state.doc, this.considered);
    if (targets.length === 0) return;
    // fold dispatch — foldState (codeFolding 제공) 가 처리.
    const effects = targets.map((t) => foldEffect.of({ from: t.from, to: t.to }));
    // considered 에 기록 — dispatch 가 foldState 에 도달하지 못해도 (이미 fold 되었든, 실패든)
    // 재시도 하지 않는다. 이것이 OD-A (사용자 unfold 존중) 의 핵심이다.
    for (const t of targets) this.considered.add(t.lineFrom);
    view.dispatch({ effects });
  }
}

/**
 * REQ-IMG-LOAD-2-A-003 위젯 — markdown-extensions.ts 가 createMarkdownExtensions 배열에 추가.
 * codeFolding() 과 foldGutter() 가 반드시 함께 활성화되어야 foldState 가 foldEffect 를 처리한다.
 */
export const longLineAutoFoldExtension = (): Extension => {
  return ViewPlugin.fromClass(LongLineAutoFoldPlugin);
};
