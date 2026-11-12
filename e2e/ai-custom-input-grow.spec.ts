// SPEC-AI-015 E2E: AI 직접 입력 칸(자동 높이 textarea + 폭 확대)을 실제 WebKit 전체 앱 레이아웃에서
// 검증한다. jsdom 은 레이아웃이 없어 폭·높이·클리핑을 증명하지 못하므로 이 e2e 가 실 레이아웃 보증선이다.
// 선례: ai-008-diagram-submenu-flip.spec.ts (✨ 띄우기, 패널 rect, 사이드바 접기, 스플리터 드래그).
import { test, expect } from './fixtures/tauri-v2-ai-mock';
import type { Page, Locator } from '@playwright/test';

// 줄이 패널 폭만큼 길어야 CodeMirror 스크롤러(실제 클리핑 조상)가 패널 폭을 채운다 — 짧은 한 줄이면
// 스크롤러 자체가 내용 폭으로 줄어 "넓은 패널" 조건이 성립하지 않는다.
const LINE =
  '이 문장은 직접 입력 칸의 폭과 높이를 검증하기 위한 아주 긴 한 줄입니다 패널 폭을 가득 채우도록 계속 늘려 씁니다 더 채웁니다 또 채웁니다 한참 채웁니다 끝까지 채웁니다 마지막까지 채웁니다';

const sparkleOf = (page: Page): Locator => page.locator('.mdedit-ai-sparkle-btn');
const menuOf = (page: Page): Locator => page.locator('.mdedit-ai-preset-menu');
const inputOf = (page: Page): Locator => page.locator('.mdedit-ai-custom-input');

async function collapseSidebar(page: Page): Promise<void> {
  if ((await page.locator('.md-pane-divider').count()) >= 2) {
    await page.locator('button[aria-label="Toggle sidebar"]').click();
    await page.waitForTimeout(100);
  }
}

async function shrinkEditorPane(page: Page, toX: number): Promise<void> {
  const divider = page.locator('.md-pane-divider').last();
  const d = (await divider.boundingBox())!;
  await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
  await page.mouse.down();
  await page.mouse.move(toX, d.y + d.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}

async function paneRect(page: Page): Promise<{ left: number; right: number; top: number; bottom: number }> {
  return page.evaluate(() => {
    const b = (document.querySelector('.md-editor') as HTMLElement).getBoundingClientRect();
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
  });
}

async function boot(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.locator('.cm-content').waitFor({ timeout: 10_000 });
  await collapseSidebar(page);
}

/** 문서를 채우고 끝(또는 줄 앞쪽)에서 몇 글자를 선택해 ✨ 를 띄운다. */
async function fillAndSelect(page: Page, text: string, opts: { fromStart?: boolean; chars?: number } = {}): Promise<void> {
  const editor = page.locator('.cm-content');
  await editor.click();
  await editor.fill(text);
  await page.keyboard.press(opts.fromStart ? 'ControlOrMeta+Home' : 'ControlOrMeta+End');
  const key = opts.fromStart ? 'Shift+ArrowRight' : 'Shift+ArrowLeft';
  for (let i = 0; i < (opts.chars ?? 6); i += 1) await page.keyboard.press(key);
}

async function openCustomInput(page: Page): Promise<void> {
  await expect(sparkleOf(page)).toBeVisible({ timeout: 5_000 });
  await sparkleOf(page).click();
  await page.locator('.mdedit-ai-preset-item[data-preset="custom"]').click();
  await expect(inputOf(page)).toBeVisible({ timeout: 3_000 });
  await page.waitForTimeout(150); // rAF 측정 반영 대기.
}

async function assertInsidePaneH(page: Page, label: string): Promise<void> {
  const pane = await paneRect(page);
  const box = (await menuOf(page).boundingBox())!;
  expect(box, `${label}: has box`).not.toBeNull();
  expect(box.x, `${label}: left ≥ pane.left ${JSON.stringify({ pane, box })}`).toBeGreaterThanOrEqual(pane.left - 1);
  expect(box.x + box.width, `${label}: right ≤ pane.right ${JSON.stringify({ pane, box })}`).toBeLessThanOrEqual(pane.right + 1);
}

test.describe('SPEC-AI-015 직접 입력 칸 — 폭·자동 높이·상한', () => {
  test('넓은 패널: 직접 입력 메뉴 폭은 340±2, 프리셋 상태는 더 좁다', async ({ aiPage }) => {
    await boot(aiPage, { width: 1280, height: 800 });
    await shrinkEditorPane(aiPage, 1000); // 스플리터를 오른쪽으로 끌어 패널을 넓힌다(좌·우 공간 ≥ 348).
    await fillAndSelect(aiPage, LINE, { fromStart: true, chars: 4 });
    await expect(sparkleOf(aiPage)).toBeVisible({ timeout: 5_000 });
    await sparkleOf(aiPage).click();
    await expect(menuOf(aiPage)).toBeVisible();
    const presetWidth = (await menuOf(aiPage).boundingBox())!.width;
    expect(presetWidth).toBeLessThan(340);
    await aiPage.locator('.mdedit-ai-preset-item[data-preset="custom"]').click();
    await aiPage.waitForTimeout(150);
    const w = (await menuOf(aiPage).boundingBox())!.width;
    expect(Math.abs(w - 340)).toBeLessThanOrEqual(2);
  });

  for (const [label, text, opts] of [
    ['줄 앞쪽(✨ 가 왼쪽)', LINE, { fromStart: true, chars: 4 }],
    ['줄 끝(✨ 가 패널 오른쪽 근처)', LINE, { chars: 6 }],
  ] as const) {
    test(`좁은 패널(≈420px) ${label}: 메뉴가 에디터 패널 좌·우 안에 머문다`, async ({ aiPage }) => {
      await boot(aiPage, { width: 1280, height: 800 });
      await shrinkEditorPane(aiPage, 420);
      await fillAndSelect(aiPage, text, opts);
      await openCustomInput(aiPage);
      await assertInsidePaneH(aiPage, label);
      const w = (await menuOf(aiPage).boundingBox())!.width;
      expect(w).toBeLessThanOrEqual(342);
    });
  }

  test('Shift+Enter 로 3줄 입력하면 높이가 늘고 내부 스크롤은 없다', async ({ aiPage }) => {
    await boot(aiPage, { width: 1280, height: 800 });
    await fillAndSelect(aiPage, LINE);
    await openCustomInput(aiPage);
    const ta = inputOf(aiPage);
    const h1 = (await ta.boundingBox())!.height;
    await ta.pressSequentially('가');
    await aiPage.keyboard.press('Shift+Enter');
    await ta.pressSequentially('나');
    await aiPage.keyboard.press('Shift+Enter');
    await ta.pressSequentially('다');
    const h3 = (await ta.boundingBox())!.height;
    expect(h3).toBeGreaterThan(h1);
    const m = await ta.evaluate((el) => ({ s: el.scrollHeight, c: el.clientHeight }));
    expect(m.s).toBeLessThanOrEqual(m.c + 1);
  });

  test('60줄 입력: 메뉴가 뷰포트·패널 세로 범위 안에 머물고 textarea 가 스크롤된다', async ({ aiPage }) => {
    await boot(aiPage, { width: 1280, height: 800 });
    await fillAndSelect(aiPage, LINE);
    await openCustomInput(aiPage);
    const ta = inputOf(aiPage);
    await ta.fill(Array.from({ length: 60 }, (_, i) => `줄 ${i + 1}`).join('\n'));
    await aiPage.waitForTimeout(100);
    const pane = await paneRect(aiPage);
    const box = (await menuOf(aiPage).boundingBox())!;
    const vh = aiPage.viewportSize()!.height;
    expect(box.y).toBeGreaterThanOrEqual(Math.max(0, pane.top) - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(Math.min(vh, pane.bottom) + 1);
    const m = await ta.evaluate((el) => ({ s: el.scrollHeight, c: el.clientHeight, o: getComputedStyle(el).overflowY }));
    expect(m.s).toBeGreaterThan(m.c);
    expect(m.o).toBe('auto');
  });

  test('아래쪽 줄에서 --above 로 열면 60줄을 입력해도 방향이 유지된다', async ({ aiPage }) => {
    await boot(aiPage, { width: 1280, height: 800 });
    const many = Array.from({ length: 80 }, (_, i) => `문단 ${i + 1} 입니다`).join('\n\n');
    await fillAndSelect(aiPage, many);
    await openCustomInput(aiPage);
    await expect(menuOf(aiPage)).toHaveClass(/mdedit-ai-preset-menu--above/);
    await inputOf(aiPage).fill(Array.from({ length: 60 }, (_, i) => `줄 ${i + 1}`).join('\n'));
    await aiPage.waitForTimeout(150);
    await expect(menuOf(aiPage)).toHaveClass(/mdedit-ai-preset-menu--above/);
  });

  test('Enter 로 전송하면 메뉴가 닫히고 요청이 발행된다', async ({ aiPage }) => {
    await boot(aiPage, { width: 1280, height: 800 });
    await fillAndSelect(aiPage, LINE);
    await openCustomInput(aiPage);
    await inputOf(aiPage).fill('영어로 번역해줘');
    await aiPage.keyboard.press('Enter');
    await expect(menuOf(aiPage)).toHaveCount(0, { timeout: 3_000 });
    const req = await aiPage.evaluate(() => window.__AI_MOCK__.requests.find((r) => r.cmd === 'ai_request'));
    expect(req).toBeTruthy();
  });
});
