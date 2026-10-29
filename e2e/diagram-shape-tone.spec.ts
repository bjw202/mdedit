// @MX:NOTE: [AUTO] SPEC-PREVIEW-017 다이어그램 모양 기반 자동 톤 e2e — 미리보기의 계산 스타일(getComputedStyle)로 단정한다.
//   판단(pele-shape-diam)은 surface-alt 채움 + 판단 테두리, 시작/끝(pele-shape-stadium)은 액센트 테두리 1.5px,
//   나머지 모양·클러스터는 변경 전 기준값 그대로, 작성자 classDef/style은 지정한 속성만 이긴다, 라벨·순서와 무관, 테마와 무관.
//   CSS 캐스케이드와 인라인 style 우선순위는 jsdom 문자열 검사로 증명되지 않으므로 실제 브라우저(webkit)에서 잰다.
// @MX:SPEC: SPEC-PREVIEW-017 AC-PREVIEW017-001, 002, 003, 004, 007, 008

import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/tauri-mock';

const SVG_SELECTOR = '.preview-content .mermaid-container svg';

// 고정 팔레트 리터럴(SPEC-PREVIEW-016) + 판단 테두리(SPEC-PREVIEW-017). 토큰 자기참조가 아니라 리터럴 rgb로 단정한다.
const SURFACE = 'rgb(238, 243, 247)'; // #EEF3F7
const BORDER = 'rgb(151, 164, 177)'; // #97A4B1
const SURFACE_ALT = 'rgb(247, 242, 231)'; // #F7F2E7
const DECISION_BORDER = 'rgb(138, 100, 16)'; // #8A6410
const ACCENT = 'rgb(58, 86, 115)'; // #3A5673

// 클러스터 사각형 기준값 — 변경 전 HEAD(f9c94ee, 코드는 4bef707과 동일)에서 같은 문서로 잰 값(progress.md §E.2).
const CLUSTER_BASELINE = { fill: SURFACE_ALT, fillOpacity: '0.5', stroke: BORDER, strokeWidth: '1px' };

// AC-001·002·007·008 공용 문서: stadium 2개, 판단 1개, rect·cyl·circle, 서브그래프 1개, 라벨 있는 간선 1개
const BASE_DOC = `# 모양 톤

\`\`\`mermaid
flowchart TD
  A([시작]) --> B{판단}
  B -->|예| C[처리]
  C --> D[(저장소)]
  D --> E((원))
  subgraph G[묶음]
    F[안쪽]
  end
  E --> F
  F --> Z([끝])
\`\`\`
`;

// AC-003: 판단 B는 classDef 전체 지정, 시작 A는 style 지정, 판단 W는 채움만 지정
const AUTHOR_DOC = `# 작성자 스타일

\`\`\`mermaid
flowchart TD
  A([시작]) --> B{판단}
  B --> W{둘째 판단}
  W --> C[처리]
  classDef hot fill:#ffeeee,stroke:#cc0000,stroke-width:3px
  classDef warm fill:#fff0cc
  class B hot
  class W warm
  style A fill:#ddeeff,stroke:#004488
\`\`\`
`;

// AC-004: 판단 노드 3개(첫 노드·중간·마지막), 라벨이 다른 stadium 2개
const NO_INFER_DOC = `# 추론 금지

\`\`\`mermaid
flowchart TD
  P{실패?} --> S1([출발])
  S1 --> Q{yes}
  Q --> M[중간]
  M --> S2([도착 지점])
  S2 --> T{아니오}
\`\`\`
`;

interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: string;
}

/** 테마를 localStorage(zustand persist)에 미리 저장한다. 페이지 이동 전에 호출. */
async function seedTheme(page: Page, theme: 'light' | 'dark' | 'system'): Promise<void> {
  await page.addInitScript((t) => {
    localStorage.setItem('mdedit-ui-store', JSON.stringify({ state: { theme: t }, version: 1 }));
  }, theme);
}

async function openWithContent(page: Page, content: string, lastId: string): Promise<void> {
  await page.goto('/');
  await page.locator('.cm-editor').waitFor({ timeout: 15_000 });
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await editor.fill(content);
  await page.locator(`${SVG_SELECTOR} .pele-node[data-id="${lastId}"]`).waitFor({ timeout: 15_000 });
}

/** 노드 id → 그 노드 모양 요소(노드 g의 첫 도형 자식)의 계산 fill·stroke·stroke-width. */
async function readShapes(page: Page): Promise<Record<string, ShapeStyle>> {
  return page.evaluate((sel) => {
    const out: Record<string, { fill: string; stroke: string; strokeWidth: string }> = {};
    document.querySelectorAll(`${sel} .pele-node`).forEach((g) => {
      const shape = g.querySelector(':scope > :is(rect, polygon, path, circle, ellipse)');
      if (!shape) return;
      const cs = getComputedStyle(shape);
      out[g.getAttribute('data-id') ?? ''] = { fill: cs.fill, stroke: cs.stroke, strokeWidth: cs.strokeWidth };
    });
    return out;
  }, SVG_SELECTOR);
}

async function readCluster(page: Page) {
  return page.evaluate((sel) => {
    const rect = document.querySelector(`${sel} .pele-cluster rect`) as SVGRectElement;
    const cs = getComputedStyle(rect);
    return { fill: cs.fill, fillOpacity: cs.fillOpacity, stroke: cs.stroke, strokeWidth: cs.strokeWidth };
  }, SVG_SELECTOR);
}

test.describe('SPEC-PREVIEW-017 모양 기반 자동 톤 (미리보기 계산 스타일)', () => {
  test('AC-001: 판단 노드는 surface-alt 채움 + 판단 테두리, 같은 다이어그램의 사각형은 기본 톤', async ({ tauriPage }) => {
    await seedTheme(tauriPage, 'light');
    await openWithContent(tauriPage, BASE_DOC, 'Z');
    const s = await readShapes(tauriPage);
    expect(s.B.fill, '판단 채움').toBe(SURFACE_ALT);
    expect(s.B.stroke, '판단 테두리').toBe(DECISION_BORDER);
    expect(s.C.fill, '사각형 채움').toBe(SURFACE);
    expect(s.C.stroke, '사각형 테두리').toBe(BORDER);
  });

  test('AC-002: 시작/끝은 액센트 테두리 1.5px, rect·cyl·circle·클러스터는 기준값 그대로, 조합 3종 이하', async ({
    tauriPage,
  }) => {
    await seedTheme(tauriPage, 'light');
    await openWithContent(tauriPage, BASE_DOC, 'Z');
    const s = await readShapes(tauriPage);
    for (const id of ['A', 'Z']) {
      expect(s[id], `stadium ${id}`).toEqual({ fill: SURFACE, stroke: ACCENT, strokeWidth: '1.5px' });
    }
    for (const id of ['C', 'D', 'E', 'F']) {
      expect(s[id], `기본 모양 ${id}`).toEqual({ fill: SURFACE, stroke: BORDER, strokeWidth: '1px' });
    }
    expect(await readCluster(tauriPage), '클러스터 사각형').toEqual(CLUSTER_BASELINE);
    const combos = new Set(Object.values(s).map((v) => `${v.fill}|${v.stroke}`));
    expect(combos.size, `채움·테두리 조합: ${[...combos].join(', ')}`).toBeLessThanOrEqual(3);
  });

  test('AC-003: 작성자 classDef·style은 지정한 속성만 이기고, 지정 안 한 속성은 모양 톤을 받는다', async ({ tauriPage }) => {
    await seedTheme(tauriPage, 'light');
    await openWithContent(tauriPage, AUTHOR_DOC, 'C');
    const s = await readShapes(tauriPage);
    expect(s.B, 'classDef hot 판단').toEqual({ fill: 'rgb(255, 238, 238)', stroke: 'rgb(204, 0, 0)', strokeWidth: '3px' });
    expect(s.A.fill, 'style 시작 채움').toBe('rgb(221, 238, 255)');
    expect(s.A.stroke, 'style 시작 테두리').toBe('rgb(0, 68, 136)');
    expect(s.W.fill, '채움만 지정한 판단의 채움').toBe('rgb(255, 240, 204)');
    expect(s.W.stroke, '채움만 지정한 판단의 테두리 = 판단 테두리').toBe(DECISION_BORDER);
  });

  test('AC-004: 라벨 문구·노드 위치와 무관하게 같은 모양은 같은 톤', async ({ tauriPage }) => {
    await seedTheme(tauriPage, 'light');
    await openWithContent(tauriPage, NO_INFER_DOC, 'T');
    const s = await readShapes(tauriPage);
    for (const id of ['P', 'Q', 'T']) {
      expect(s[id], `판단 ${id}`).toEqual({ fill: SURFACE_ALT, stroke: DECISION_BORDER, strokeWidth: '1px' });
    }
    expect(s.S1).toEqual(s.S2);
    expect(s.S1.stroke).toBe(ACCENT);
  });

  test('AC-007: 라이트·다크 전환에도 판단·시작/끝 톤의 계산값이 같다', async ({ tauriPage }) => {
    await tauriPage.emulateMedia({ colorScheme: 'light' });
    await seedTheme(tauriPage, 'system');
    await openWithContent(tauriPage, BASE_DOC, 'Z');
    await expect.poll(() => tauriPage.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
    const light = await readShapes(tauriPage);

    await tauriPage.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => tauriPage.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
    const dark = await readShapes(tauriPage);

    for (const id of ['A', 'B', 'Z']) expect(dark[id], `노드 ${id}`).toEqual(light[id]);
    expect(light.B.stroke).toBe(DECISION_BORDER);
    expect(light.A.stroke).toBe(ACCENT);
  });
});
