// @MX:NOTE: [AUTO] SPEC-PREVIEW-006 mermaid subgraph(cluster) 제목 1줄 렌더 회귀 가드
// @MX:SPEC: SPEC-PREVIEW-006 REQ-PREVIEW006-001, REQ-PREVIEW006-002, REQ-PREVIEW006-003, REQ-PREVIEW006-007
//
// mermaid 11.12.3의 cluster `rect` 렌더러가 createText에 width를 전달하지 않아
// 하드코딩된 200px 기본값으로 폴백 → 긴 한글 cluster 제목이 2줄로 wrap되는 버그(#6110).
// patch-package로 chunk-JZLCHNYA.mjs의 `rect` 렌더러 createText 호출에
// 명시적 width:100000 을 추가하여 1줄로 강제.
//
// 이 테스트는 패치 미적용·버전 드리프트 시 실패하여 누락을 즉시 드러낸다.

import { test, expect } from './fixtures/tauri-mock';

// 수직 스택 픽스처: A → B 가 위아래로 쌓임 (수평 형제 없음)
const VERTICAL_FIXTURE = `
\`\`\`mermaid
flowchart TB
  subgraph A["🔵 tree-sitter (자/줄자) — 결정론적 · 100% 재현 가능"]
    A1[파싱] --> A2[AST]
  end
  subgraph B["🟢 LSP (현미경) — 의미 분석 · 타입 추론 가능"]
    B1[심볼] --> B2[정의]
  end
  A --> B
\`\`\`
`;

// 수평 인접 픽스처: Start → A, Start → B (A와 B가 수평 배치될 가능성)
const HORIZONTAL_FIXTURE = `
\`\`\`mermaid
flowchart TB
  Start[시작] --> A
  Start --> B
  subgraph A["🔵 tree-sitter (자/줄자) — 결정론적 · 100% 재현 가능"]
    A1[파싱] --> A2[AST]
  end
  subgraph B["🟢 LSP (현미경) — 의미 분석 · 타입 추론 가능"]
    B1[심볼] --> B2[정의]
  end
\`\`\`
`;

/**
 * mermaid SVG가 렌더될 때까지 대기하고 cluster-label foreignObject/div 높이를 측정.
 * 단일 라인 높이(기준선)는 빈 단어 하나로 측정.
 */
async function getMermaidClusterLabelHeights(page: import('@playwright/test').Page, content: string) {
  await page.goto('/');
  await page.locator('.cm-editor').waitFor({ timeout: 15_000 });

  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await editor.fill(content);

  // mermaid SVG가 나타날 때까지 대기
  await page.locator('.preview-content .mermaid-container svg').first().waitFor({ timeout: 15_000 });

  // mermaid 렌더 완료를 위해 SVG 내 cluster-label이 나타날 때까지 대기
  await page.locator('.preview-content .mermaid-container svg .cluster-label').first().waitFor({ timeout: 10_000 });

  // cluster-label 요소의 높이 측정 (foreignObject 또는 내부 div)
  const labelHeights = await page.evaluate(() => {
    const svgs = document.querySelectorAll('.preview-content .mermaid-container svg');
    const results: { heights: number[]; singleLineHeight: number } = {
      heights: [],
      singleLineHeight: 0,
    };

    // 첫 번째 SVG에서 cluster-label 높이들을 측정
    const svg = svgs[0];
    if (!svg) return results;

    const clusterLabels = svg.querySelectorAll('.cluster-label');
    clusterLabels.forEach((label) => {
      // foreignObject 또는 div 컨테이너의 실제 렌더 높이
      const fo = label.querySelector('foreignObject');
      if (fo) {
        const div = fo.querySelector('div') || fo.querySelector('p');
        if (div) {
          results.heights.push(div.getBoundingClientRect().height);
        } else {
          results.heights.push(fo.getBoundingClientRect().height);
        }
      } else {
        // SVG text 방식
        const bbox = (label as SVGGraphicsElement).getBBox?.();
        if (bbox) results.heights.push(bbox.height);
      }
    });

    // 단일 라인 높이 기준: 첫 번째 cluster-label의 foreignObject 내부 p/span 의 line-height
    const firstLabel = clusterLabels[0];
    if (firstLabel) {
      const fo = firstLabel.querySelector('foreignObject');
      if (fo) {
        const innerEl = fo.querySelector('span') || fo.querySelector('p') || fo.querySelector('div');
        if (innerEl) {
          const style = window.getComputedStyle(innerEl);
          const lineHeight = parseFloat(style.lineHeight);
          const fontSize = parseFloat(style.fontSize);
          // line-height가 'normal'이면 fontSize * 1.2 추정
          results.singleLineHeight = isNaN(lineHeight) || lineHeight === 0
            ? fontSize * 1.4
            : lineHeight;
        }
      }
    }

    return results;
  });

  return labelHeights;
}

/**
 * 두 cluster rect의 bounding box를 구해 겹침 여부를 반환.
 */
async function getClusterRectOverlap(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('.preview-content .mermaid-container svg');
    if (!svg) return { overlaps: false, bboxes: [], error: 'no svg' };

    const clusters = svg.querySelectorAll('.cluster');
    if (clusters.length < 2) return { overlaps: false, bboxes: [], error: `only ${clusters.length} clusters` };

    const bboxes = Array.from(clusters).map((c) => {
      const rect = c.querySelector('rect');
      if (!rect) return null;
      const r = rect.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    }).filter(Boolean) as Array<{ left: number; top: number; right: number; bottom: number; width: number; height: number }>;

    if (bboxes.length < 2) return { overlaps: false, bboxes, error: 'insufficient rects' };

    // 모든 쌍에 대해 겹침 검사
    let overlaps = false;
    for (let i = 0; i < bboxes.length; i++) {
      for (let j = i + 1; j < bboxes.length; j++) {
        const a = bboxes[i];
        const b = bboxes[j];
        // 겹침: 두 사각형이 교차하는지 (1px 여유)
        const intersects =
          a.left < b.right - 1 &&
          a.right > b.left + 1 &&
          a.top < b.bottom - 1 &&
          a.bottom > b.top + 1;
        if (intersects) overlaps = true;
      }
    }

    return { overlaps, bboxes, error: null };
  });
}

test.describe('SPEC-PREVIEW-006: mermaid subgraph cluster 제목 1줄 렌더', () => {
  // 시나리오 A+B: 수직 스택 — 1줄 표시 + 무겹침
  test('시나리오 B — 수직 스택 cluster 제목이 1줄로 렌더되고 겹치지 않는다', async ({ tauriPage }) => {
    const result = await getMermaidClusterLabelHeights(tauriPage, VERTICAL_FIXTURE);

    // cluster-label 이 2개 이상 있어야 함
    expect(result.heights.length, '수직 픽스처에 cluster-label이 2개 이상 있어야 함').toBeGreaterThanOrEqual(2);

    const singleLineRef = result.singleLineHeight > 0 ? result.singleLineHeight : 30;

    for (let i = 0; i < result.heights.length; i++) {
      const h = result.heights[i];
      // 단일 라인 높이의 1.6배 이하이면 1줄로 판정 (2줄이면 약 2× 단일 라인 높이)
      expect(
        h,
        `cluster-label[${i}] 높이(${h.toFixed(1)}px)가 1줄 기준(${(singleLineRef * 1.6).toFixed(1)}px)을 초과함 — 2줄로 wrap됨`
      ).toBeLessThan(singleLineRef * 1.6);
    }

    // 겹침 없음 확인
    const overlap = await getClusterRectOverlap(tauriPage);
    expect(overlap.overlaps, `수직 스택에서 cluster rect가 겹침: ${JSON.stringify(overlap.bboxes)}`).toBe(false);
  });

  // 시나리오 A+C: 수평 인접 — 1줄 표시 + 무겹침
  test('시나리오 C — 수평 인접 cluster 제목이 1줄로 렌더되고 겹치지 않는다', async ({ tauriPage }) => {
    const result = await getMermaidClusterLabelHeights(tauriPage, HORIZONTAL_FIXTURE);

    expect(result.heights.length, '수평 픽스처에 cluster-label이 2개 이상 있어야 함').toBeGreaterThanOrEqual(2);

    const singleLineRef = result.singleLineHeight > 0 ? result.singleLineHeight : 30;

    for (let i = 0; i < result.heights.length; i++) {
      const h = result.heights[i];
      expect(
        h,
        `cluster-label[${i}] 높이(${h.toFixed(1)}px)가 1줄 기준(${(singleLineRef * 1.6).toFixed(1)}px)을 초과함 — 2줄로 wrap됨`
      ).toBeLessThan(singleLineRef * 1.6);
    }

    // 겹침 없음 확인
    const overlap = await getClusterRectOverlap(tauriPage);
    expect(overlap.overlaps, `수평 인접에서 cluster rect가 겹침: ${JSON.stringify(overlap.bboxes)}`).toBe(false);
  });
});
