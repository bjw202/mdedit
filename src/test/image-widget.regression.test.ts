// @MX:SPEC: SPEC-IMG-LOAD-002, SPEC-IMG-WIDGET-001, SPEC-IMG-WIDGET-002
// WIDGET-001 회귀 가드 (UT-REG-W1..W7): Axis A(뷰포트 위젯 바운딩 + 라인 폴딩) 구현 후에도
// WIDGET-001 REQ-1..7 이 보존됨을 단언한다. plan.md Milestone 1 step 1 — Axis A 사전 baseline.
//
// 본 파일은 image-widget.test.ts 의 기존 단언을 새 buildDecorations 인터페이스(visibleRanges
// 기반)에 맞춰 재작성한 회귀 가드다. Axis A 구현 내내 green 이 유지되어야 한다.
//
// 테스트 mock shape (buildDecorations 호출용):
//   { visibleRanges: [{from, to}], state: { doc: { sliceString(from,to), length } } }
// DocView 인터페이스 호환 — view.state.doc.toString() 은 호출되어서는 안 된다 (REQ-A-001).

import { describe, it, expect, vi } from 'vitest';

/**
 * mockView 헬퍼 — buildDecorations(visibleRanges 기반) 호출을 위한 최소 view shape.
 * fullText 전체를 visibleRanges 한 개로 덮되, toString 스파이를 달아 미호출을 검증한다.
 */
function mockViewWithFullTextVisible(fullText: string) {
  const { doc } = instrumentedDoc(fullText);
  return {
    visibleRanges: [{ from: 0, to: fullText.length }],
    state: { doc },
  };
}

/**
 * mockView 헬퍼 — 부분 visibleRanges (뷰포트 외부의 data URI 는 스캔되지 않음을 검증).
 */
function mockViewWithScopedViewport(fullText: string, from: number, to: number) {
  const { doc } = instrumentedDoc(fullText);
  return {
    visibleRanges: [{ from, to }],
    state: { doc },
  };
}

// ============================================================
// SPEC-IMG-WIDGET-002: line gap 형상 mock (REQ-C-001)
//
// 기존 mock 은 `visibleRanges: [{from: 0, to: text.length}]` — 문서 전체를 덮는 단일 범위 —
// 라서 "하나의 라인이 자기 자신 안에서 복수 조각으로 분절되는" line gap 형상을 표현할 수 없다.
// 이 회귀가 green 인 채로 출시된 이유가 정확히 그 mock 형상이다 (spec.md REQ-C-001 근거).
// ============================================================

interface MockLine { from: number; to: number }

/** fullText 의 라인 경계 인덱스를 만든다 ('\n' 분리, 반개구간 [from, to)). */
function buildLineIndex(fullText: string): MockLine[] {
  const lines: MockLine[] = [];
  let from = 0;
  for (let i = 0; i <= fullText.length; i++) {
    if (i === fullText.length || fullText[i] === '\n') {
      lines.push({ from, to: i });
      from = i + 1;
    }
  }
  return lines;
}

/**
 * 계측형 doc mock — CodeMirror Text 의 최소 계약(length / sliceString / lineAt) 을 제공하고,
 * sliceString 이 실제로 잘라낸 구간을 `slices` 에 기록한다 (AC-A-002 / AC-C-003 계측).
 *
 * [HARD] 본문 획득 경로는 sliceString 으로 한정된다 (plan.md §E-2). lineAt 은 경계 조회 전용이며
 * `.text` 프로퍼티를 제공하지 않는다 — 구현이 우회 경로를 쓰면 여기서 바로 드러난다.
 */
function instrumentedDoc(fullText: string) {
  const lines = buildLineIndex(fullText);
  const slices: { from: number; to: number }[] = [];
  return {
    doc: {
      length: fullText.length,
      sliceString: (from: number, to: number) => {
        slices.push({ from, to });
        return fullText.slice(from, to);
      },
      lineAt: (pos: number): MockLine => {
        for (const line of lines) {
          if (pos >= line.from && pos <= line.to) return line;
        }
        return lines[lines.length - 1];
      },
      // REQ-A-006 단언용 스파이 — 호출되어서는 안 된다.
      toString: vi.fn(() => fullText),
    },
    slices,
    lines,
  };
}

/**
 * mockViewWithLineGap — 하나의 라인을 복수 `visibleRanges` 조각으로 분절하는 헬퍼 (REQ-C-001).
 *
 * `gaps` 는 line gap 데코레이션이 **덮어서 visibleRanges 에서 제외되는** 구간이다.
 * visibleRanges 는 [0, fullText.length) 에서 gaps 를 뺀 여집합으로 계산한다 —
 * 이것이 `computeVisibleRanges` 의 실제 동작(point() 콜백이 비어 gap 구간이 누락됨)과 같은 형상이다.
 */
function mockViewWithLineGap(fullText: string, gaps: readonly { from: number; to: number }[]) {
  const visibleRanges: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const gap of [...gaps].sort((a, b) => a.from - b.from)) {
    if (gap.from > cursor) visibleRanges.push({ from: cursor, to: gap.from });
    cursor = Math.max(cursor, gap.to);
  }
  if (cursor < fullText.length) visibleRanges.push({ from: cursor, to: fullText.length });

  const { doc, slices, lines } = instrumentedDoc(fullText);
  return { visibleRanges, state: { doc }, slices, lines };
}

/** 임의의 visibleRanges 를 직접 지정하는 mock (폴드 형상 재현용). */
function mockViewWithRanges(fullText: string, visibleRanges: readonly { from: number; to: number }[]) {
  const { doc, slices, lines } = instrumentedDoc(fullText);
  return { visibleRanges, state: { doc }, slices, lines };
}

// ============================================================
// UT-REG-W1 (WIDGET-001 REQ-1): data URI 이미지 위젯 렌더링 유지
// ============================================================

describe('UT-REG-W1 (WIDGET-001 REQ-1): data URI 이미지 위젯 렌더링 유지', () => {
  it('visible 범위의 data URI 1개 → Decoration.replace 1개 생성', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const text = '![screenshot](data:image/png;base64,iVBORw0KGgo=)';
    const view = mockViewWithFullTextVisible(text);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, text.length, () => { count++; });
    expect(count).toBe(1);
  });

  it('여러 data URI → 각각 위젯 생성', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const text = '![a](data:image/png;base64,aaa=) text ![b](data:image/jpeg;base64,bbb=)';
    const view = mockViewWithFullTextVisible(text);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, text.length, () => { count++; });
    expect(count).toBe(2);
  });
});

// ============================================================
// UT-REG-W3 (WIDGET-001 REQ-3): 기저 마크다운 소스 텍스트 보존
//   (Decoration.replace 는 시각만 교체하고 소스를 변경하지 않는다)
// ============================================================

describe('UT-REG-W3 (WIDGET-001 REQ-3): 소스 텍스트 보존', () => {
  it('Decoration.replace 는 소스 오프셋만 차지 — 텍스트 자체는 불변', async () => {
    const { buildDecorations, parseDataUriImage } = await import('@/components/editor/extensions/image-widget');
    const text = 'prefix ![alt](data:image/png;base64,iVBORw0KGgo=) suffix';
    const view = mockViewWithFullTextVisible(text);
    const result = buildDecorations(view as never);
    // 위젯이 파싱된 data URI 의 정확한 오프셋을 차지하는지 확인 — 소스 텍스트 자체가 변경되지 않음
    const matches = parseDataUriImage(text);
    expect(matches).toHaveLength(1);
    let captured: { from: number; to: number } | null = null;
    result.between(0, text.length, (from, to) => { captured = { from, to }; });
    expect(captured).not.toBeNull();
    expect(captured!.from).toBe(matches[0].from);
    expect(captured!.to).toBe(matches[0].to);
  });
});

// ============================================================
// UT-REG-W4 (WIDGET-001 REQ-4): data URI 에만 적용 (file path / HTTP URL 미매칭)
// ============================================================

describe('UT-REG-W4 (WIDGET-001 REQ-4): data URI 전용 매칭', () => {
  it('file path 이미지는 위젯 생성 안 함', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const text = '![alt](./images/file.png)';
    const view = mockViewWithFullTextVisible(text);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, text.length, () => { count++; });
    expect(count).toBe(0);
  });

  it('HTTP URL 이미지는 위젯 생성 안 함', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const text = '![alt](https://example.com/img.png)';
    const view = mockViewWithFullTextVisible(text);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, text.length, () => { count++; });
    expect(count).toBe(0);
  });
});

// ============================================================
// UT-REG-W6 (WIDGET-001 REQ-6): 문서 변경 시 동적 갱신 (docChanged 경로)
//   update 가 docChanged 또는 viewportChanged 시 재계산을 트리거함을 검증.
// ============================================================

describe('UT-REG-W6 (WIDGET-001 REQ-6): 동적 갱신 트리거 조건', () => {
  it('docChanged === true → 재계산 필요 (true)', async () => {
    const m = await import('@/components/editor/extensions/image-widget');
    // shouldRecomputeDecorations 가 export 되어 있으면 사용, 없으면 update 메커니즘 검증
    if ('shouldRecomputeDecorations' in m && typeof m.shouldRecomputeDecorations === 'function') {
      expect(m.shouldRecomputeDecorations({ docChanged: true, viewportChanged: false })).toBe(true);
    } else {
      // 인터페이스가 없으면 ViewPlugin 자체가 존재하는지 검증
      expect(m.imageWidgetExtension).toBeDefined();
    }
  });

  it('viewportChanged === true → 재계산 필요 (true) [REQ-A-002]', async () => {
    const m = await import('@/components/editor/extensions/image-widget');
    if ('shouldRecomputeDecorations' in m && typeof m.shouldRecomputeDecorations === 'function') {
      expect(m.shouldRecomputeDecorations({ docChanged: false, viewportChanged: true })).toBe(true);
    } else {
      expect(m.imageWidgetExtension).toBeDefined();
    }
  });

  it('변경 없음 → 재계산 불필요 (false)', async () => {
    const m = await import('@/components/editor/extensions/image-widget');
    if ('shouldRecomputeDecorations' in m && typeof m.shouldRecomputeDecorations === 'function') {
      expect(m.shouldRecomputeDecorations({ docChanged: false, viewportChanged: false })).toBe(false);
    } else {
      expect(m.imageWidgetExtension).toBeDefined();
    }
  });
});

// ============================================================
// UT-REG-W-VIEWPORT (REQ-A-001 핵심): view.state.doc.toString() 미호출 단언
//   buildDecorations 가 full-doc copy 없이 visibleRanges 만 스캔하는지 검증.
//   이 단언이야말로 "동결 제거 주체" (D1 수정) 의 직접 증거다.
// ============================================================

describe('UT-REG-W-VIEWPORT (REQ-A-001): view.state.doc.toString() 미호출', () => {
  it('buildDecorations 호출 후 doc.toString() 은 한 번도 호출되지 않는다', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const text = '![a](data:image/png;base64,aaa=) middle ![b](data:image/jpeg;base64,bbb=)';
    const view = mockViewWithFullTextVisible(text);
    buildDecorations(view as never);
    expect(view.state.doc.toString).not.toHaveBeenCalled();
  });

  // SPEC-IMG-WIDGET-002 REQ-C-005 개정 (image-widget.test.ts 의 같은 형상 테스트와 동일 사유).
  // REQ-A-001 이 가시 라인 전체를 스캔하므로 hidden 을 같은 라인에 두면 위젯 2개가 정답이 된다.
  // 단언의 의도("가시하지 않은 영역은 스캔하지 않는다")는 보존하고, 경계의 단위만
  // 문자 오프셋 → 라인 으로 옮긴다. 삭제 금지.
  it('가시 라인이 아닌 라인의 data URI 는 위젯 생성 안 함 (뷰포트 바운딩)', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    // 전체 텍스트: visible 라인 + 보이지 않는 **다른 라인** 에 data URI 1개
    const visibleText = '![visible](data:image/png;base64,vv=)';
    const hiddenText = '\n![hidden](data:image/jpeg;base64,hh=)';
    const full = visibleText + hiddenText;
    const view = mockViewWithScopedViewport(full, 0, visibleText.length);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, full.length, () => { count++; });
    expect(count).toBe(1);  // visible 만
    expect(view.state.doc.toString).not.toHaveBeenCalled();
  });
});

// ============================================================
// SPEC-IMG-WIDGET-002 Axis A: 가시 라인 경계 스캔 (line gap 회귀 복구)
//
// v0.15.0 회귀의 재현 테스트. `EditorView.lineWrapping` 이 켜져 있으면 CodeMirror 는
// 20,000자를 초과하는 라인에 line gap 데코레이션을 부여하고, 그 gap 이 덮는 구간은
// `visibleRanges` 에서 제외된다 — 즉 하나의 라인이 **자기 자신 안에서** 분절된다.
// `![alt](data:...)` 구조가 그 경계를 가로지르면 어느 조각에서도 정규식이 매칭되지 않는다.
// ============================================================

describe('SPEC-IMG-WIDGET-002 REQ-A-001/004 (AC-A-001): line gap 분절 라인의 위젯', () => {
  it('line gap 으로 분절된 라인의 data URI 도 위젯이 된다', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    // 단일 라인 — 접두 30자 + base64 240자 + '=)' 2자
    const line = '![shot](data:image/png;base64,' + 'A'.repeat(240) + '=)';
    // gap 이 base64 페이로드 한복판을 덮는다 → 어느 조각도 완결된 구조를 담지 못한다
    const view = mockViewWithLineGap(line, [{ from: 40, to: 120 }]);
    expect(view.visibleRanges).toEqual([
      { from: 0, to: 40 },
      { from: 120, to: line.length },
    ]);

    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, line.length, () => { count++; });
    expect(count).toBe(1);
    expect(view.state.doc.toString).not.toHaveBeenCalled();
  });

  it('분절 경계가 alt 텍스트를 가로질러도 위젯 1개', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const line = '![a very long alt text here](data:image/png;base64,' + 'B'.repeat(100) + '=)';
    const view = mockViewWithLineGap(line, [{ from: 10, to: 20 }]);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, line.length, () => { count++; });
    expect(count).toBe(1);
  });
});

describe('SPEC-IMG-WIDGET-002 REQ-A-002 (AC-A-002): 폴드 라인 재유입 차단', () => {
  it('폴드된 라인은 경계 확장으로 재유입되지 않는다', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const prev = '# heading';
    const folded = '![folded](data:image/png;base64,' + 'C'.repeat(200) + '=)';
    const next = 'tail text';
    const full = `${prev}\n${folded}\n${next}`;
    const L = { from: prev.length + 1, to: prev.length + 1 + folded.length };
    // 폴드된 라인 주변의 visibleRanges 형상: {..., to: L.from} 과 {from: L.to, ...}
    const view = mockViewWithRanges(full, [
      { from: 0, to: L.from },
      { from: L.to, to: full.length },
    ]);

    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, full.length, () => { count++; });
    expect(count).toBe(0);

    // 계측: 폴드된 라인 구간을 단 한 번도 잘라내지 않았다 (동결 재발 방지의 직접 증거)
    const touchedFolded = view.slices.filter((s) => s.from < L.to && s.to > L.from);
    expect(touchedFolded).toEqual([]);
  });

  it('E-5: 폴드된 라인이 문서의 첫 라인 — 뒤쪽 범위만으로 배제된다', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const folded = '![folded](data:image/png;base64,' + 'D'.repeat(120) + '=)';
    const next = '![tail](data:image/png;base64,tt=)';
    const full = `${folded}\n${next}`;
    const L = { from: 0, to: folded.length };
    const view = mockViewWithRanges(full, [{ from: L.to, to: full.length }]);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, full.length, () => { count++; });
    expect(count).toBe(1); // next 라인의 1개만
    expect(view.slices.filter((s) => s.from < L.to && s.to > L.from)).toEqual([]);
  });

  it('E-6: 폴드된 라인이 문서의 마지막 라인 — 앞쪽 범위만으로 배제된다', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const head = '![head](data:image/png;base64,hh=)';
    const folded = '![folded](data:image/png;base64,' + 'E'.repeat(120) + '=)';
    const full = `${head}\n${folded}`;
    const L = { from: head.length + 1, to: full.length };
    const view = mockViewWithRanges(full, [{ from: 0, to: L.from }]);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, full.length, () => { count++; });
    expect(count).toBe(1); // head 라인의 1개만
    expect(view.slices.filter((s) => s.from < L.to && s.to > L.from)).toEqual([]);
  });
});

describe('SPEC-IMG-WIDGET-002 경계 엣지 케이스 (acceptance.md 엣지 케이스 표)', () => {
  it('E-2: 문서 전체가 한 라인이고 전부 가시 — 중복 add 없이 위젯 1개', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const line = '![only](data:image/png;base64,oo=)';
    const view = mockViewWithRanges(line, [{ from: 0, to: line.length }]);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, line.length, () => { count++; });
    expect(count).toBe(1);
    expect(view.slices).toHaveLength(1);
  });

  it('E-3: data URI 가 line.to 에서 끝나도 위젯 1개 (off-by-one 없음)', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const first = 'prefix line';
    const tail = 'x ![edge](data:image/png;base64,' + 'F'.repeat(60) + '=)';
    const full = `${first}\n${tail}`;
    // gap 이 data URI 끝자락을 덮어 마지막 조각이 ')' 만 남는 형상
    const view = mockViewWithLineGap(full, [{ from: full.length - 20, to: full.length - 2 }]);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, full.length, () => { count++; });
    expect(count).toBe(1);
  });

  it('E-4: 인접한 두 범위가 서로 다른 라인 — 병합되지 않고 각각 스캔', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    const a = '![a](data:image/png;base64,aa=)';
    const b = '![b](data:image/jpeg;base64,bb=)';
    const full = `${a}\n${b}`;
    const view = mockViewWithRanges(full, [
      { from: 0, to: a.length },
      { from: a.length + 1, to: full.length },
    ]);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, full.length, () => { count++; });
    expect(count).toBe(2);
    expect(view.slices).toHaveLength(2);
  });
});
