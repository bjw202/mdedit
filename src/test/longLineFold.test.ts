// @MX:SPEC: SPEC-IMG-LOAD-002, SPEC-IMG-WIDGET-002
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
    const threshold = LINE_FOLD_THRESHOLD_LOCAL ?? 3 * 1024 * 1024;
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
    const threshold = LINE_FOLD_THRESHOLD_LOCAL ?? 3 * 1024 * 1024;
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
    const threshold = LINE_FOLD_THRESHOLD_LOCAL ?? 3 * 1024 * 1024;
    const doc = mockDoc([threshold, threshold - 1]);
    const result = findLinesToFold(doc, new Set(), threshold);
    expect(result).toHaveLength(0);
  });

  it('잘못된 입력(빈 doc) → 빈 결과, 예외 없음', async () => {
    const { findLinesToFold, LINE_FOLD_THRESHOLD_LOCAL } = await import(
      '@/components/editor/extensions/long-line-fold'
    );
    const threshold = LINE_FOLD_THRESHOLD_LOCAL ?? 3 * 1024 * 1024;
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

// ============================================================
// SPEC-IMG-WIDGET-002 REQ-B-001/B-002 (AC-B-002 명제 1): 3MB 폴드 트리거
//
// 위 테스트들은 threshold 를 인자로 주입하므로 실제 상수값이 폴딩을 유발하는지를 검증하지
// 않는다. 아래 단언은 **기본 인자(실제 LINE_FOLD_THRESHOLD)** 경로를 직접 실행한다.
//
// mockDoc 은 라인 길이 숫자만 보관하므로 3MB 문자열을 실제로 할당하지 않는다 —
// findLinesToFold 는 line.length 만 보기 때문이다.
// (AC-B-002 명제 2 "폴드된 라인에 위젯 없음" 은 image-widget.regression.test.ts 의
//  '폴드된 라인은 경계 확장으로 재유입되지 않는다' 가 수행한다 — 공동 요구.)
// ============================================================

describe('SPEC-IMG-WIDGET-002 REQ-B-001 (AC-B-002 명제 1): 실제 상수 기준 폴드 트리거', () => {
  it('기본 threshold 로 3,145,728자 초과 라인만 폴드 대상이 된다', async () => {
    const { findLinesToFold } = await import('@/components/editor/extensions/long-line-fold');
    const { LINE_FOLD_THRESHOLD } = await import('@/lib/preview/previewLimits');
    expect(LINE_FOLD_THRESHOLD).toBe(3_145_728);

    const doc = mockDoc([
      LINE_FOLD_THRESHOLD,       // 1: 경계값 — 폴드 대상 아님 (> 비교)
      LINE_FOLD_THRESHOLD + 1,   // 2: 초과 — 폴드 대상
      2_796_234,                 // 3: 인라인 최대 이미지 라인 — 폴드되면 안 된다 (REQ-B-001 목적)
    ]);
    // threshold 인자 생략 → 기본값(실제 상수) 경로
    const result = findLinesToFold(doc, new Set());
    expect(result).toHaveLength(1);
    expect(result[0].lineFrom).toBe(doc.line(2).from);
  });

  it('인라인 허용 최대 이미지가 만드는 라인(2,796,204자 + 접두)은 폴드되지 않는다', async () => {
    const { findLinesToFold } = await import('@/components/editor/extensions/long-line-fold');
    const { LINE_FOLD_THRESHOLD, IMAGE_INLINE_THRESHOLD } = await import('@/lib/preview/previewLimits');
    // base64Length(n) = 4 * ceil(n / 3) — 바이트 → 문자 변환
    const base64Length = (n: number) => 4 * Math.ceil(n / 3);
    const longestInlineLine = base64Length(IMAGE_INLINE_THRESHOLD - 1) + 30; // + 마크다운·URI 접두
    expect(longestInlineLine).toBeLessThan(LINE_FOLD_THRESHOLD);

    const doc = mockDoc([longestInlineLine]);
    expect(findLinesToFold(doc, new Set())).toEqual([]);
  });
});
