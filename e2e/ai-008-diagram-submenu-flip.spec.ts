// SPEC-AI-008 회귀 가드: 좁은 창에서 다이어그램 종류 플라이아웃 서브메뉴(.mdedit-ai-diagram-submenu)가
// 뷰포트 밖(오른쪽/아래)으로 잘리지 않는지 실제 WebKit 엔진에서 검증한다. 순수 헬퍼(menuPlacement)와
// jsdom 단위 테스트(aiSelectionToolbar.test.ts)는 판정 로직만 다루므로, 실 레이아웃의 containing block·
// rAF 측정·CSS 클래스 토글이 함께 작동하는지는 이 e2e 가 유일하게 보증한다(c664256 수정의 회귀 방지).
import { test, expect } from './fixtures/tauri-v2-ai-mock';
import type { Page } from '@playwright/test';

const LONG_LINE =
  '이 문장은 좁은 창에서도 선택 끝의 스파클 버튼이 화면 오른쪽 가까이에 놓이도록 충분히 긴 한 줄입니다.';
const TALL_DOC = Array.from(
  { length: 40 },
  (_, i) => `${i + 1}번째 줄입니다 내용을 채워 문서를 길게 만듭니다`,
).join('\n');

/** ✨ 프리셋 메뉴를 열고 다이어그램 항목에 hover 해 서브메뉴를 띄운다(rAF 측정 반영까지 대기). */
async function openDiagramSubmenu(page: Page): Promise<void> {
  const sparkle = page.locator('.mdedit-ai-sparkle-btn');
  await expect(sparkle).toBeVisible({ timeout: 5_000 });
  await sparkle.click();
  const trigger = page.locator('.mdedit-ai-preset-item[data-preset="diagram"]');
  await expect(trigger).toBeVisible({ timeout: 5_000 });
  await trigger.hover();
  await expect(page.locator('.mdedit-ai-diagram-submenu')).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(150); // rAF flip 측정이 클래스에 반영될 시간.
}

async function assertSubmenuInsideViewport(page: Page): Promise<void> {
  const { vw, vh } = page.viewportSize()
    ? { vw: page.viewportSize()!.width, vh: page.viewportSize()!.height }
    : { vw: 0, vh: 0 };
  const box = (await page.locator('.mdedit-ai-diagram-submenu').boundingBox())!;
  expect(box, 'submenu has a box').not.toBeNull();
  expect(box.x, 'submenu left inside viewport').toBeGreaterThanOrEqual(-0.5);
  expect(box.x + box.width, 'submenu right inside viewport').toBeLessThanOrEqual(vw + 1);
  expect(box.y, 'submenu top inside viewport').toBeGreaterThanOrEqual(-0.5);
  expect(box.y + box.height, 'submenu bottom inside viewport').toBeLessThanOrEqual(vh + 1);
}

test.describe('SPEC-AI-008 diagram submenu viewport flip', () => {
  test('좁은 창·우측 근처: 서브메뉴가 왼쪽으로 뒤집혀 뷰포트 안에 머문다', async ({ aiPage }) => {
    await aiPage.setViewportSize({ width: 560, height: 800 });
    await aiPage.goto('/');
    const editor = aiPage.locator('.cm-content');
    await editor.waitFor({ timeout: 10_000 });
    await editor.click();
    await editor.fill(LONG_LINE);
    await aiPage.keyboard.press('ControlOrMeta+End');
    for (let i = 0; i < 6; i += 1) await aiPage.keyboard.press('Shift+ArrowLeft');

    await openDiagramSubmenu(aiPage);
    await assertSubmenuInsideViewport(aiPage);
  });

  test('좁고 낮은 창·우하단 코너: 위(--up)·왼쪽(--left) 동시 처리로 잘리지 않는다', async ({
    aiPage,
  }) => {
    await aiPage.setViewportSize({ width: 600, height: 420 });
    await aiPage.goto('/');
    const editor = aiPage.locator('.cm-content');
    await editor.waitFor({ timeout: 10_000 });
    await editor.click();
    await editor.fill(TALL_DOC);
    await aiPage.keyboard.press('ControlOrMeta+End');
    for (let i = 0; i < 8; i += 1) await aiPage.keyboard.press('Shift+ArrowLeft');

    await openDiagramSubmenu(aiPage);
    await assertSubmenuInsideViewport(aiPage);
  });
});
