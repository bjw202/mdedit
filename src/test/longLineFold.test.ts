// @MX:SPEC: SPEC-IMG-LOAD-002
// Group A — UT-A1-003: 거대 라인 자동 폴딩 (REQ-IMG-LOAD-2-A-003).
//
// D2 (감사 수정): always-on StateField + Decoration.fold 패턴을 쓰지 않고
// foldEffect dispatch against @codemirror/language foldState 패턴을 쓴다.
// 따라서 단위 테스트는 "long line 감지 → foldEffect dispatch" 순수 로직을 검증한다.
//
// OD-A (사용자 unfold 존중): 이미 고려(considered)한 라인은 다시 fold 하지 않는다.
// 이 단언이 없으면 사용자가 펼친 라인이 다음 docChanged 때 다시 fold 되어 UX 가 붕괴된다.

import { describe, it, expect } from 'vitest';

/**
 * 순수 도큼먼트 mock — CodeMirror Text 의 line(n) 인터페이스 호환.
 * 길이/시작/끝만 알면 되므로 full text 를 materialize 할 필요 없다.
 */
interface MockLine { from: number; to: number; length: number; }
interface MockDoc {
  lines: number;
  line(n: number): MockLine;
}
function mockDoc(lineLengths: number[]): MockDoc {
  let acc = 0;
  const lines = lineLengths.map((len, i) => {
    // i 번째 줄 끝에 newline (마지막 줄은 제외)
    const from = acc;
    const to = from + len;
    acc = i < lineLengths.length - 1 ? to + 1 : to;
    return { from, to, length: len };
  });
  return {
    lines: lineLengths.length,
    line: (n: number) => lines[n - 1],
  };
}

describe('SPEC-IMG-LOAD-002 REQ-A-003 (UT-A1-003): 거대 라인 자동 폴딩', () => {
  it('findLinesToFold 가 LINE_FOLD_THRESHOLD 초과 라인만 반환한다', async () => {
    const { findLinesToFold, LINE_FOLD_THRESHOLD_LOCAL } = await import(
      '@/components/editor/extensions/long-line-fold'
    );
    const threshold = LINE_FOLD_THRESHOLD_LOCAL ?? 1024 * 1024;
    const doc = mockDoc([
      100,                        // 1: short
      threshold + 1,              // 2: LONG → fold 대상
      50,                         // 3: short
      threshold + 5000,           // 4: LONG → fold 대상
    ]);
    const result = findLinesToFold(doc, new Set(), threshold);
    expect(result).toHaveLength(2);
    expect(result[0].lineFrom).toBe(doc.line(2).from);
    expect(result[1].lineFrom).toBe(doc.line(4).from);
  });

  it('이미 considered 된 라인은 다시 fold 대상에서 제외된다 (OD-A — 사용자 unfold 존중)', async () => {
    const { findLinesToFold, LINE_FOLD_THRESHOLD_LOCAL } = await import(
      '@/components/editor/extensions/long-line-fold'
    );
    const threshold = LINE_FOLD_THRESHOLD_LOCAL ?? 1024 * 1024;
    const doc = mockDoc([threshold + 100, threshold + 200, threshold + 300]);
    // line 2(from = threshold+101)는 이미 고려됨 — 사용자가 unfold 한 상태로 가정
    const considered = new Set<number>([doc.line(2).from]);
    const result = findLinesToFold(doc, considered, threshold);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.lineFrom === doc.line(2).from)).toBeUndefined();
    expect(result.find((r) => r.lineFrom === doc.line(1).from)).toBeDefined();
    expect(result.find((r) => r.lineFrom === doc.line(3).from)).toBeDefined();
  });

  it('LINE_FOLD_THRESHOLD 이하 라인은 fold 대상 아님 (경계값, > 비교)', async () => {
    const { findLinesToFold, LINE_FOLD_THRESHOLD_LOCAL } = await import(
      '@/components/editor/extensions/long-line-fold'
    );
    const threshold = LINE_FOLD_THRESHOLD_LOCAL ?? 1024 * 1024;
    const doc = mockDoc([threshold, threshold - 1]);
    const result = findLinesToFold(doc, new Set(), threshold);
    expect(result).toHaveLength(0);
  });

  it('잘못된 입력(빈 doc) → 빈 결과, 예외 없음', async () => {
    const { findLinesToFold, LINE_FOLD_THRESHOLD_LOCAL } = await import(
      '@/components/editor/extensions/long-line-fold'
    );
    const threshold = LINE_FOLD_THRESHOLD_LOCAL ?? 1024 * 1024;
    const doc = mockDoc([]);
    const result = findLinesToFold(doc, new Set(), threshold);
    expect(result).toEqual([]);
  });

  it('longLineAutoFoldExtension 이 export 된다 (markdown-extensions 적재용)', async () => {
    const m = await import('@/components/editor/extensions/long-line-fold');
    expect(m.longLineAutoFoldExtension).toBeDefined();
    expect(typeof m.longLineAutoFoldExtension).toBe('function');
  });
});
