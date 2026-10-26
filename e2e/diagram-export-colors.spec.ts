// @MX:NOTE: [AUTO] SPEC-PREVIEW-015 sync 감사 F1 — 내보내기 색 읽기(readPeleThemeValues)의 실제 브라우저(webkit) 검증.
//   jsdom은 사용자 정의 속성을 계산하지 못해 단위 테스트(exportDiagram.test.ts)는 값을 주입한다. 여기서는 앱 페이지에서
//   Vite가 서빙하는 같은 모듈을 동적 import로 불러(운영 코드에 시험용 훅 추가 없음) (a) var(--md-*) 계산 해석과
//   (b) 다크 루트 아래 data-theme="light" 탐침이 라이트 값을 돌려주는지(DOCX가 라이트로 남는 근거)를 확인한다.
//   기대값은 탐침과 독립적으로 얻는다: 다크는 루트 요소의 계산된 --md-* 값, 라이트는 mdedit-tokens.css 원문의 라이트 블록.
// @MX:SPEC: SPEC-PREVIEW-015 AC-PREVIEW015-020

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/tauri-mock';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = readFileSync(resolve(here, '..', 'src/styles/mdedit-tokens.css'), 'utf-8');

/** --pele-* 변수 → 그것이 가리키는 --md-* 토큰(mdedit-tokens.css 두 블록 공통). */
const PELE_TO_MD = {
  '--pele-bg': '--md-bg',
  '--pele-fg': '--md-text-primary',
  '--pele-accent': '--md-accent',
  '--pele-surface': '--md-surface',
} as const;
type PeleName = keyof typeof PELE_TO_MD;
const PELE_NAMES = Object.keys(PELE_TO_MD) as PeleName[];

/** CSS 원문의 한 블록에서 토큰 값을 읽는다. */
function tokenFromCss(blockStart: string, name: string): string {
  const start = TOKENS_CSS.indexOf(blockStart);
  expect(start, blockStart).toBeGreaterThanOrEqual(0);
  const block = TOKENS_CSS.slice(start, TOKENS_CSS.indexOf('\n}', start));
  const m = new RegExp(`\\n\\s*${name}:\\s*([^;]+);`).exec(block);
  expect(m, `${blockStart} ${name}`).not.toBeNull();
  return m![1].trim();
}
const LIGHT_BLOCK = '[data-theme="light"],\n:root {';
const DARK_BLOCK = '[data-theme="dark"] {';

const DIAGRAM_DOC = `# 내보내기 색

\`\`\`mermaid
flowchart LR
  A[시작] --> B[끝]
\`\`\`
`;

async function openInDarkTheme(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('mdedit-ui-store', JSON.stringify({ state: { theme: 'dark' }, version: 1 }));
  });
  await page.goto('/');
  await page.locator('.cm-editor').waitFor({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
}

test.describe('SPEC-PREVIEW-015 sync 감사 F1 — 내보내기 색 읽기 (webkit 실측)', () => {
  test('다크 앱에서 현재 테마 값은 다크 토큰, 라이트 탐침 값은 라이트 토큰이고 탐침은 남지 않는다', async ({ tauriPage }) => {
    await openInDarkTheme(tauriPage);

    const got = await tauriPage.evaluate(async (pairs) => {
      const mod = await import('/src/lib/diagram/diagramRenderer.ts');
      const themed = () => document.querySelectorAll('body [data-theme]').length;
      const before = themed();
      const dark = mod.readPeleThemeValues('dark');
      const light = mod.readPeleThemeValues('light');
      const after = themed();
      const rootCs = getComputedStyle(document.documentElement);
      const rootMd: Record<string, string> = {};
      for (const md of Object.values(pairs)) rootMd[md] = rootCs.getPropertyValue(md).trim();
      return {
        rootTheme: document.documentElement.getAttribute('data-theme'),
        dark,
        light,
        rootMd,
        before,
        after,
        varCount: [...Object.values(dark), ...Object.values(light)].filter((v) => v.includes('var(')).length,
      };
    }, PELE_TO_MD);

    expect(got.rootTheme, '탐침 뒤에도 루트는 다크').toBe('dark');
    expect(got.after, '임시 탐침 요소가 남아 있음').toBe(got.before);
    expect(got.varCount, '계산 값에 var( 가 남아 있음(해석 안 됨)').toBe(0);

    for (const pele of PELE_NAMES) {
      const md = PELE_TO_MD[pele];
      const darkFile = tokenFromCss(DARK_BLOCK, md);
      const lightFile = tokenFromCss(LIGHT_BLOCK, md);
      // 다크: 루트의 계산된 --md-* 값과 같다(루트 계산값도 CSS 원문 다크 블록과 같은지 교차 확인).
      expect(got.rootMd[md], `루트 ${md}`).toBe(darkFile);
      expect(got.dark[pele], `dark ${pele}`).toBe(got.rootMd[md]);
      // 라이트: 다크 루트 아래 data-theme="light" 탐침이 라이트 블록 값을 돌려준다.
      expect(got.light[pele], `light ${pele}`).toBe(lightFile);
      expect(got.light[pele], `${pele} 라이트·다크 값이 같음`).not.toBe(got.dark[pele]);
    }
  });

  test('다크 앱에서 라이트 HTML 내보내기의 다이어그램 SVG는 var(--pele- 0건, 라이트 색 값만 쓴다', async ({ tauriPage }) => {
    await openInDarkTheme(tauriPage);

    const out = await tauriPage.evaluate(async (doc) => {
      const mod = await import('/src/lib/export/exportHtml.ts');
      const svgOf = async (theme: 'light' | 'dark') => {
        const html = await mod.generateHtmlContent({ content: doc, filename: 'colors.md', theme, highlighter: null });
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        return parsed.querySelector('.mermaid-container svg')?.outerHTML ?? '';
      };
      const themed = document.querySelectorAll('body [data-theme]').length;
      const light = await svgOf('light');
      const dark = await svgOf('dark');
      return { light, dark, leftover: document.querySelectorAll('body [data-theme]').length - themed };
    }, DIAGRAM_DOC);

    expect(out.leftover, '임시 탐침 요소가 남아 있음').toBe(0);
    for (const [theme, svg] of [['light', out.light], ['dark', out.dark]] as const) {
      expect(svg, `${theme} SVG 없음`).toContain('<svg');
      expect(svg.split('var(--pele-').length - 1, `${theme} SVG에 var(--pele- 남음`).toBe(0);
    }
    const lightBg = tokenFromCss(LIGHT_BLOCK, '--md-bg');
    const darkBg = tokenFromCss(DARK_BLOCK, '--md-bg');
    const lightSurface = tokenFromCss(LIGHT_BLOCK, '--md-surface');
    const darkSurface = tokenFromCss(DARK_BLOCK, '--md-surface');
    expect(out.light, '라이트 SVG에 라이트 surface 값 없음').toContain(lightSurface);
    expect(out.light, '라이트 SVG에 다크 bg 값이 섞임').not.toContain(darkBg);
    expect(out.light, '라이트 SVG에 다크 surface 값이 섞임').not.toContain(darkSurface);
    expect(out.dark, '다크 SVG에 다크 surface 값 없음').toContain(darkSurface);
    expect(out.dark, '다크 SVG에 라이트 bg 값이 섞임').not.toContain(lightBg);
  });
});
