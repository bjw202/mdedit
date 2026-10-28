// @MX:NOTE: [AUTO] SPEC-PREVIEW-015 sync 감사 F1 — 내보내기 색 읽기(readPeleThemeValues)의 실제 브라우저(webkit) 검증.
//   jsdom은 사용자 정의 속성을 계산하지 못해 단위 테스트(exportDiagram.test.ts)는 값을 주입한다. 여기서는 앱 페이지에서
//   Vite가 서빙하는 같은 모듈을 동적 import로 불러(운영 코드에 시험용 훅 추가 없음) readPeleThemeValues가
//   mdedit-tokens.css :root의 고정 팔레트 리터럴(SPEC-PREVIEW-016)을 라이트·다크 어느 입력으로도 같게 돌려주는지 확인한다
//   (다크 루트 아래 data-theme="light" 탐침 경로는 DOCX가 라이트 입력으로 남는 근거다).
//   기대값은 탐침과 독립적으로 얻는다: 루트 요소의 계산된 --pele-* 값과 mdedit-tokens.css 원문의 단일 :root 블록.
// @MX:SPEC: SPEC-PREVIEW-015 AC-PREVIEW015-020, SPEC-PREVIEW-016 AC-PREVIEW016-004, AC-PREVIEW016-005

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/tauri-mock';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = readFileSync(resolve(here, '..', 'src/styles/mdedit-tokens.css'), 'utf-8');

/** 검증 대상 --pele-* 변수(mdedit-tokens.css :root 고정 팔레트 — SPEC-PREVIEW-016, 테마 무관 리터럴). */
const PELE_VARS = ['--pele-bg', '--pele-fg', '--pele-accent', '--pele-surface'] as const;
type PeleName = (typeof PELE_VARS)[number];
const PELE_NAMES: readonly PeleName[] = PELE_VARS;

/** CSS 원문의 한 블록에서 토큰 값을 읽는다. */
function tokenFromCss(blockStart: string, name: string): string {
  const start = TOKENS_CSS.indexOf(blockStart);
  expect(start, blockStart).toBeGreaterThanOrEqual(0);
  const block = TOKENS_CSS.slice(start, TOKENS_CSS.indexOf('\n}', start));
  const m = new RegExp(`\\n\\s*${name}:\\s*([^;]+);`).exec(block);
  expect(m, `${blockStart} ${name}`).not.toBeNull();
  return m![1].trim();
}
/** 고정 팔레트가 사는 단일 블록(라이트·:root 공용 — 다크 블록 재선언 없음, SPEC-PREVIEW-016). */
const ROOT_BLOCK = '[data-theme="light"],\n:root {';

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
  test('다크 앱에서 pele 값은 고정 팔레트(:root 리터럴)와 같고 라이트·다크 입력이 같은 값을 돌려주며 탐침은 남지 않는다', async ({ tauriPage }) => {
    await openInDarkTheme(tauriPage);

    const got = await tauriPage.evaluate(async (names) => {
      const mod = await import('/src/lib/diagram/diagramRenderer.ts');
      const themed = () => document.querySelectorAll('body [data-theme]').length;
      const before = themed();
      const dark = mod.readPeleThemeValues('dark');
      const light = mod.readPeleThemeValues('light');
      const after = themed();
      const rootCs = getComputedStyle(document.documentElement);
      const rootPele: Record<string, string> = {};
      for (const pele of names as string[]) rootPele[pele] = rootCs.getPropertyValue(pele).trim();
      return {
        rootTheme: document.documentElement.getAttribute('data-theme'),
        dark,
        light,
        rootPele,
        before,
        after,
        varCount: [...Object.values(dark), ...Object.values(light)].filter((v) => v.includes('var(')).length,
      };
    }, PELE_NAMES);

    expect(got.rootTheme, '탐침 뒤에도 루트는 다크').toBe('dark');
    expect(got.after, '임시 탐침 요소가 남아 있음').toBe(got.before);
    expect(got.varCount, '계산 값에 var( 가 남아 있음(해석 안 됨)').toBe(0);

    for (const pele of PELE_NAMES) {
      const cssValue = tokenFromCss(ROOT_BLOCK, pele);
      // 고정 팔레트: 어느 테마 입력으로 읽어도 CSS :root 리터럴과 같다(AC-PREVIEW016-004).
      expect(got.dark[pele], `dark ${pele}`).toBe(cssValue);
      expect(got.light[pele], `light ${pele}`).toBe(cssValue);
      expect(got.rootPele[pele], `루트 ${pele}`).toBe(cssValue);
    }
  });

  test('다크 앱에서 라이트·다크 HTML 내보내기의 다이어그램 SVG는 var(--pele- 0건, 같은 고정 팔레트 값을 쓴다', async ({ tauriPage }) => {
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
    // 고정 팔레트: 어느 내보내기 테마든 같은 값(AC-PREVIEW016-004·007).
    const bg = tokenFromCss(ROOT_BLOCK, '--pele-bg');
    const surface = tokenFromCss(ROOT_BLOCK, '--pele-surface');
    expect(out.light, '라이트 SVG에 고정 bg 값 없음').toContain(bg);
    expect(out.light, '라이트 SVG에 고정 surface 값 없음').toContain(surface);
    expect(out.dark, '다크 SVG에 고정 bg 값 없음').toContain(bg);
    expect(out.dark, '다크 SVG에 고정 surface 값 없음').toContain(surface);
  });

  test('다크 내보낸 HTML의 다이어그램 카드는 계산 스타일로 종이 카드이고 라이트 내보내기엔 카드가 없다 (AC-PREVIEW016-005)', async ({ tauriPage }) => {
    await openInDarkTheme(tauriPage);

    const result = await tauriPage.evaluate(async (doc) => {
      const mod = await import('/src/lib/export/exportHtml.ts');
      const cardOf = async (theme: 'light' | 'dark'): Promise<Record<string, string>> => {
        const html = await mod.generateHtmlContent({ content: doc, filename: 'card.md', theme, highlighter: null });
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
        await new Promise<void>((done) => {
          iframe.addEventListener('load', () => done(), { once: true });
          iframe.srcdoc = html;
        });
        const el = iframe.contentDocument?.querySelector('.mermaid-container');
        if (!el) {
          iframe.remove();
          throw new Error('내보낸 HTML에 mermaid-container 없음');
        }
        const cs = getComputedStyle(el);
        const card = {
          bg: cs.backgroundColor,
          borderWidth: cs.borderTopWidth,
          borderStyle: cs.borderTopStyle,
          borderColor: cs.borderTopColor,
          radius: cs.borderTopLeftRadius,
        };
        iframe.remove();
        return card;
      };
      return { dark: await cardOf('dark'), light: await cardOf('light') };
    }, DIAGRAM_DOC);

    // 다크 종이 카드(M2 이음매: 배경 상수 #FAF9F6 + 카드 리터럴 #97A4B1·3px — 내보낸 HTML은 리터럴 바인딩).
    expect(result.dark.bg, '다크 카드 배경').toBe('rgb(250, 249, 246)');
    expect(result.dark.borderWidth, '다크 카드 테두리 두께').toBe('1px');
    expect(result.dark.borderStyle, '다크 카드 테두리 스타일').toBe('solid');
    expect(result.dark.borderColor, '다크 카드 테두리 색').toBe('rgb(151, 164, 177)');
    expect(result.dark.radius, '다크 카드 반경').toBe('3px');
    // 라이트 무카드(배경은 카드 여부와 무관하게 같은 종이 색).
    expect(result.light.bg, '라이트 배경').toBe('rgb(250, 249, 246)');
    expect(result.light.borderWidth, '라이트 테두리 없음').toBe('0px');
    expect(result.light.radius, '라이트 반경 없음').toBe('0px');
  });
});
