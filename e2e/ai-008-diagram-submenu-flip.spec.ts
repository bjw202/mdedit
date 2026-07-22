// SPEC-AI-008 회귀 가드: 다이어그램 관련 메뉴 3종(AI 플라이아웃 서브메뉴, 툴바 표 피커,
// 툴바 다이어그램 드롭다운)이 뷰포트가 아니라 "에디터 패널의 실효 클리핑 경계"(overflow:hidden)
// 안에 머무는지 실제 WebKit 엔진에서 검증한다. 근본 원인: 배치 판정 경계를 window.innerWidth 로
// 잡으면 넓은 창에서 패널(패널 우측이 창 우측보다 한참 왼쪽) 밖으로 잘린다(getClipBoundary 로 수정).
// jsdom 단위 테스트는 클리핑 조상이 없어 이 실 레이아웃 결함을 재현하지 못하므로, 이 e2e 가 유일한
// 실 레이아웃 보증선이다.
import { test, expect } from './fixtures/tauri-v2-ai-mock';
import type { Page, Locator } from '@playwright/test';

const LONG_LINE =
  '이 문장은 넓은/좁은 창 모두에서 선택 끝의 스파클 버튼이 편집기 패널 오른쪽 경계 근처에 놓이도록 아주 길게 늘여 쓴 한 줄입니다 계속 채웁니다 더 채웁니다';

/** 에디터 패널(.md-editor, overflow:hidden)의 클리핑 사각형 — 메뉴는 이 안에 완전히 들어야 한다. */
async function editorPaneRect(page: Page): Promise<{ left: number; right: number; bottom: number }> {
  return page.evaluate(() => {
    const md = document.querySelector('.md-editor') as HTMLElement;
    const b = md.getBoundingClientRect();
    return { left: b.left, right: b.right, bottom: b.bottom };
  });
}

async function assertInsidePane(page: Page, menu: Locator, label: string): Promise<void> {
  const pane = await editorPaneRect(page);
  const box = (await menu.boundingBox())!;
  expect(box, `${label}: has box`).not.toBeNull();
  expect(box.x, `${label}: left ≥ pane.left (${JSON.stringify(pane)}) box=${JSON.stringify(box)}`)
    .toBeGreaterThanOrEqual(pane.left - 1);
  expect(box.x + box.width, `${label}: right ≤ pane.right (${JSON.stringify(pane)}) box=${JSON.stringify(box)}`)
    .toBeLessThanOrEqual(pane.right + 1);
}

async function openAiDiagramSubmenu(page: Page): Promise<Locator> {
  const sparkle = page.locator('.mdedit-ai-sparkle-btn');
  await expect(sparkle).toBeVisible({ timeout: 5_000 });
  await sparkle.click();
  const trigger = page.locator('.mdedit-ai-preset-item[data-preset="diagram"]');
  await expect(trigger).toBeVisible({ timeout: 5_000 });
  await trigger.hover();
  const submenu = page.locator('.mdedit-ai-diagram-submenu');
  await expect(submenu).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(150); // rAF flip 측정 반영 대기.
  return submenu;
}

/** 편집기 텍스트를 채우고 끝에서 몇 글자를 선택해 ✨ 위젯을 띄운다. */
async function selectNearLineEnd(page: Page, chars = 6): Promise<void> {
  const editor = page.locator('.cm-content');
  await editor.waitFor({ timeout: 10_000 });
  await editor.click();
  await editor.fill(LONG_LINE);
  await page.keyboard.press('ControlOrMeta+End');
  for (let i = 0; i < chars; i += 1) await page.keyboard.press('Shift+ArrowLeft');
}

/** 파일 탐색기 사이드바를 접는다(패널을 넓히고, 스플리터를 단일화해 드래그 좌표를 안정화). */
async function collapseSidebar(page: Page): Promise<void> {
  // 사이드바가 열려 있으면 구분선이 2개(사이드바|에디터, 에디터|프리뷰). 접으면 1개가 된다.
  if ((await page.locator('.md-pane-divider').count()) >= 2) {
    await page.locator('button[aria-label="Toggle sidebar"]').click();
    await page.waitForTimeout(100);
  }
}

/** editor|preview 스플리터를 왼쪽으로 끌어 편집기 패널을 좁힌다(넓은 창 + 좁은 패널 재현). */
async function shrinkEditorPane(page: Page, toX: number): Promise<void> {
  const divider = page.locator('.md-pane-divider').last();
  const d = (await divider.boundingBox())!;
  await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
  await page.mouse.down();
  await page.mouse.move(toX, d.y + d.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}

test.describe('SPEC-AI-008 diagram menus stay inside the editor pane clip boundary', () => {
  test('좁은 창·AI 서브메뉴: 왼쪽 뒤집힘으로 패널 안에 머문다', async ({ aiPage }) => {
    await aiPage.setViewportSize({ width: 560, height: 800 });
    await aiPage.goto('/');
    await aiPage.locator('.cm-content').waitFor({ timeout: 10_000 });
    await collapseSidebar(aiPage); // 패널을 넓혀 서브메뉴가 담길 폭 확보(실사용은 좁은 창에서 사이드바 접음).
    await selectNearLineEnd(aiPage);
    const submenu = await openAiDiagramSubmenu(aiPage);
    await assertInsidePane(aiPage, submenu, 'narrow AI submenu');
  });

  test('넓은 창·좁은 패널·AI 서브메뉴: 창은 넓지만 패널 우측을 넘지 않는다(근본 원인 회귀 가드)', async ({
    aiPage,
  }) => {
    await aiPage.setViewportSize({ width: 1280, height: 800 });
    await aiPage.goto('/');
    await aiPage.locator('.cm-content').waitFor({ timeout: 10_000 });
    await collapseSidebar(aiPage);
    await shrinkEditorPane(aiPage, 640); // 창 1280, 패널 우측≈640 — 창 우측(1280)보다 한참 왼쪽.
    await selectNearLineEnd(aiPage);
    const submenu = await openAiDiagramSubmenu(aiPage);
    // 이 단언이 수정 전 코드에서 실패한다: 서브메뉴가 패널 우측(~640)을 넘어 창 우측(1280) 안에서
    // 잘렸는데 window.innerWidth 기준 flip 이 발동하지 않았다(경계=창 오판).
    await assertInsidePane(aiPage, submenu, 'wide-window narrow-pane AI submenu');
  });

  test('넓은 창·좁은 패널·툴바 표 피커: 패널 우측을 넘으면 flip+clamp 로 패널 안에 머문다', async ({
    aiPage,
  }) => {
    await aiPage.setViewportSize({ width: 1280, height: 800 });
    await aiPage.goto('/');
    await aiPage.locator('.cm-content').waitFor({ timeout: 10_000 });
    await collapseSidebar(aiPage); // 사이드바를 접어 단일 스플리터·안정적 좌표 확보.
    await shrinkEditorPane(aiPage, 420); // 편집기 패널을 좁힌다(창은 계속 넓음, 패널 우측≈419).
    await aiPage.locator('button[aria-label="Insert Table"]').click();
    const picker = aiPage.locator('.md-table-picker');
    await expect(picker).toBeVisible({ timeout: 5_000 });
    await aiPage.waitForTimeout(150);
    await assertInsidePane(aiPage, picker, 'wide table picker');
  });

  test('넓은 창·좁은 패널·툴바 다이어그램 드롭다운: 패널 우측을 넘으면 flip+clamp 로 패널 안에 머문다', async ({
    aiPage,
  }) => {
    await aiPage.setViewportSize({ width: 1280, height: 800 });
    await aiPage.goto('/');
    await aiPage.locator('.cm-content').waitFor({ timeout: 10_000 });
    await collapseSidebar(aiPage);
    await shrinkEditorPane(aiPage, 420);
    await aiPage.locator('button[aria-label="다이어그램 삽입"]').click();
    const menu = aiPage.locator('.md-menu');
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await aiPage.waitForTimeout(150);
    await assertInsidePane(aiPage, menu, 'wide diagram dropdown');
  });
});
