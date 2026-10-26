// @MX:NOTE: [AUTO] SPEC-PREVIEW-006 subgraph(cluster) 제목 1줄 렌더 회귀 가드 — SPEC-PREVIEW-015에서 pele SVG 측정으로 개정
// @MX:SPEC: SPEC-PREVIEW-006 REQ-PREVIEW006-001, REQ-PREVIEW006-002, REQ-PREVIEW006-003, REQ-PREVIEW006-007
// @MX:SPEC: SPEC-PREVIEW-015 AC-PREVIEW015-013
//
// 다이어그램은 pele 1.10.0이 그린다(SPEC-PREVIEW-015). 예전 mermaid의 cluster 제목 줄바꿈 버그와
// 그 patch-package 우회는 의존성과 함께 사라졌고, 목표(긴 한글 제목 1줄 · 자기 상자 안 · 상자끼리
// 겹치지 않음)만 유지한다. 파일 이름은 design.md D10에 따라 그대로 둔다.
//
// 측정 대상(실제 pele 출력 구조, src/test/fixtures/pele/browser/02·03-subgraph-*.svg 확인):
//   - 상자: `g.pele-cluster[data-id] > rect`
//   - 제목: `text.pele-cluster-label` — `g.pele-cluster` 안에 있거나, 다른 상자에 가려질 수 있으면
//     `g.pele-cluster-titles > g.pele-cluster-title[data-id]` 안에 후광용 `<text fill="none">`과 함께
//     놓인다. 어느 쪽이든 가장 가까운 `[data-id]` 조상이 소유 상자다.
//   - 줄바꿈하면 pele는 `<tspan>`으로 줄을 나누므로 tspan 0개 + 높이 단언 두 가지로 1줄을 본다.

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

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface TitleMeasure {
  owner: string;
  text: string;
  tspans: number;
  /** SVG 사용자 단위 높이(getBBox) — 글자 크기와 같은 단위 */
  bboxHeight: number;
  fontSize: number;
  box: Box;
}

interface SubgraphMeasure {
  titles: TitleMeasure[];
  clusters: Array<{ id: string; box: Box }>;
}

/** 다이어그램을 렌더하고 pele 서브그래프 제목·상자를 측정한다. */
async function measureSubgraphs(
  page: import('@playwright/test').Page,
  content: string,
): Promise<SubgraphMeasure> {
  await page.goto('/');
  await page.locator('.cm-editor').waitFor({ timeout: 15_000 });

  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await editor.fill(content);

  // pele 렌더는 동기지만 미리보기 갱신은 편집 뒤에 일어나므로 제목 요소가 붙을 때까지 기다린다.
  await page
    .locator('.preview-content .mermaid-container svg text.pele-cluster-label')
    .first()
    .waitFor({ timeout: 15_000 });
  // 글꼴이 늦게 로드되면 화면 글자 폭이 바뀔 수 있으므로 로드 완료 뒤에 잰다.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  return page.evaluate(() => {
    const toBox = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const svg = document.querySelector('.preview-content .mermaid-container svg');
    if (!svg) return { titles: [], clusters: [] };

    const clusters = Array.from(svg.querySelectorAll('g.pele-cluster')).map((g) => {
      const rect = g.querySelector(':scope > rect');
      return {
        id: g.getAttribute('data-id') ?? '',
        box: rect ? toBox(rect.getBoundingClientRect()) : { left: 0, top: 0, right: 0, bottom: 0 },
      };
    });

    const titles = Array.from(svg.querySelectorAll<SVGTextElement>('text.pele-cluster-label')).map((t) => ({
      owner: t.closest('[data-id]')?.getAttribute('data-id') ?? '',
      text: t.textContent ?? '',
      tspans: t.querySelectorAll('tspan').length,
      bboxHeight: t.getBBox().height,
      fontSize: parseFloat(window.getComputedStyle(t).fontSize),
      box: toBox(t.getBoundingClientRect()),
    }));

    return { titles, clusters };
  });
}

function boxesIntersect(a: Box, b: Box): boolean {
  // 1px 여유(서브픽셀 경계 접촉은 겹침으로 보지 않음)
  return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
}

function boxInside(inner: Box, outer: Box): boolean {
  const tol = 1;
  return (
    inner.left >= outer.left - tol &&
    inner.right <= outer.right + tol &&
    inner.top >= outer.top - tol &&
    inner.bottom <= outer.bottom + tol
  );
}

function assertSubgraphs(result: SubgraphMeasure, scenario: string): void {
  // 제목 2개(A·B)와 상자 2개가 있어야 한다.
  expect(result.clusters.map((c) => c.id).sort(), `${scenario}: 서브그래프 상자`).toEqual(['A', 'B']);
  expect(result.titles.map((t) => t.owner).sort(), `${scenario}: 서브그래프 제목 소유 상자`).toEqual(['A', 'B']);

  for (const t of result.titles) {
    // 1줄: pele는 줄바꿈 시 tspan을 만든다.
    expect(t.tspans, `${scenario}: 제목 ${t.owner}에 tspan(줄바꿈)이 있음 — "${t.text}"`).toBe(0);
    // 1줄: 높이가 한 줄 높이(글자 크기 × 1.4)의 1.6배 미만.
    const singleLine = t.fontSize * 1.4;
    expect(
      t.bboxHeight,
      `${scenario}: 제목 ${t.owner} 높이(${t.bboxHeight.toFixed(1)})가 1줄 기준(${(singleLine * 1.6).toFixed(1)})을 넘음`,
    ).toBeLessThan(singleLine * 1.6);
    // 자기 상자 안.
    const own = result.clusters.find((c) => c.id === t.owner);
    expect(own, `${scenario}: 제목 ${t.owner}의 상자를 찾지 못함`).toBeTruthy();
    expect(
      boxInside(t.box, own!.box),
      `${scenario}: 제목 ${t.owner}이 자기 상자 밖으로 나감 ${JSON.stringify({ title: t.box, cluster: own!.box })}`,
    ).toBe(true);
  }

  // 서로 다른 상자끼리 겹치지 않음.
  const [a, b] = result.clusters;
  expect(
    boxesIntersect(a.box, b.box),
    `${scenario}: 서브그래프 상자가 겹침 ${JSON.stringify(result.clusters)}`,
  ).toBe(false);
}

test.describe('SPEC-PREVIEW-006 / SPEC-PREVIEW-015 AC-013: 서브그래프 제목 1줄 렌더(pele)', () => {
  test('시나리오 B — 수직 스택 서브그래프 제목이 1줄로, 자기 상자 안에 렌더되고 상자끼리 겹치지 않는다', async ({
    tauriPage,
  }) => {
    const result = await measureSubgraphs(tauriPage, VERTICAL_FIXTURE);
    assertSubgraphs(result, '수직');
  });

  test('시나리오 C — 수평 인접 서브그래프 제목이 1줄로, 자기 상자 안에 렌더되고 상자끼리 겹치지 않는다', async ({
    tauriPage,
  }) => {
    const result = await measureSubgraphs(tauriPage, HORIZONTAL_FIXTURE);
    assertSubgraphs(result, '수평');
  });
});
