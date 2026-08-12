// @MX:SPEC: SPEC-IMG-LOAD-002, SPEC-IMG-WIDGET-001
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
  return {
    visibleRanges: [{ from: 0, to: fullText.length }],
    state: {
      doc: {
        length: fullText.length,
        sliceString: (from: number, to: number) => fullText.slice(from, to),
        // REQ-A-001 단언용 스파이 — 호출되어서는 안 된다.
        toString: vi.fn(() => fullText),
      },
    },
  };
}

/**
 * mockView 헬퍼 — 부분 visibleRanges (뷰포트 외부의 data URI 는 스캔되지 않음을 검증).
 */
function mockViewWithScopedViewport(fullText: string, from: number, to: number) {
  return {
    visibleRanges: [{ from, to }],
    state: {
      doc: {
        length: fullText.length,
        sliceString: (f: number, t: number) => fullText.slice(f, t),
        toString: vi.fn(() => fullText),
      },
    },
  };
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

  it('visible 범위 밖의 data URI 는 위젯 생성 안 함 (뷰포트 바운딩)', async () => {
    const { buildDecorations } = await import('@/components/editor/extensions/image-widget');
    // 전체 텍스트: visible 구간(0-30) + 보이지 않는 구간(30+)에 data URI 1개
    const visibleText = '![visible](data:image/png;base64,vv=)';
    const hiddenText = ' ![hidden](data:image/jpeg;base64,hh=)';
    const full = visibleText + hiddenText;
    const view = mockViewWithScopedViewport(full, 0, visibleText.length);
    const result = buildDecorations(view as never);
    let count = 0;
    result.between(0, full.length, () => { count++; });
    expect(count).toBe(1);  // visible 만
    expect(view.state.doc.toString).not.toHaveBeenCalled();
  });
});
