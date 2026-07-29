import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { test, expect, type Page } from './fixtures/tauri-mock';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_CONTENT = readFileSync(
  join(__dirname, 'fixtures/test-content.md'),
  'utf-8'
);

// SPEC-PREVIEW-011: boundingBox 좌표 비교 허용 오차(px).
// 실측(2026-07-29, 수정 전 CSS, webkit): AC-001 텍스트 y 오프셋 22px(1행 높이만큼 밀림),
// AC-002 loose-tight 항목 간격 차이 12~16px(mb-4 1rem 합산분), AC-003 줄바꿈 2행 x 오프셋
// 14px, AC-005(loose ol) y 오프셋 22px. 결함 상태에서 반드시 실패해야 하므로, 이 값들보다
// 훨씬 작은 3px로 고정한다(서브픽셀 렌더링 차이만 흡수).
const COORD_TOLERANCE_PX = 3;

async function injectFixtureAndWaitForPreview(tauriPage: Page): Promise<void> {
  await tauriPage.goto('/');

  // Wait for editor to be ready
  await tauriPage.locator('.cm-editor').waitFor({ timeout: 10_000 });

  // Inject fixture content into CodeMirror editor
  const editor = tauriPage.locator('.cm-content');
  await editor.click();
  await tauriPage.keyboard.press('ControlOrMeta+A');
  await editor.fill(FIXTURE_CONTENT);

  // Wait for preview to render h1 from "# E2E 테스트 픽스처"
  await expect(tauriPage.locator('.preview-content h1')).toBeVisible({ timeout: 5_000 });

  // SPEC-PREVIEW-011: mermaid 다이어그램은 비동기로 렌더되며 플레이스홀더 → 최종 SVG로
  // 높이가 바뀐다. 리스트 픽스처가 mermaid 섹션보다 뒤에 있어, SVG 렌더 완료 전에
  // boundingBox()를 측정하면 mermaid 렌더 완료 시점의 레이아웃 시프트(수백 px)가
  // 중간에 끼어들어 기하 어서션이 flaky해진다. SVG가 삽입될 때까지 기다려 레이아웃을
  // 고정한 뒤 측정한다.
  await expect(tauriPage.locator('.preview-content .mermaid-container svg')).toBeVisible({
    timeout: 5_000,
  });
}

/** 지정한 h3 제목 바로 다음에 오는 ul/ol 형제 요소를 반환한다(SPEC-PREVIEW-011 픽스처 탐색용). */
function listAfterHeading(tauriPage: Page, headingText: string) {
  const heading = tauriPage.locator('.preview-content h3', { hasText: headingText });
  return heading.locator('xpath=following-sibling::*[self::ul or self::ol][1]');
}

// REQ-E2E-005: Markdown rendering test
test.describe('Markdown rendering (REQ-E2E-005)', () => {
  test('renders heading, table, and mermaid from fixture content', async ({ tauriPage }) => {
    await injectFixtureAndWaitForPreview(tauriPage);

    // Assert table exists
    await expect(tauriPage.locator('.preview-content table')).toBeVisible({ timeout: 5_000 });

    // Assert mermaid container exists
    await expect(tauriPage.locator('.preview-content .mermaid-container')).toBeVisible({
      timeout: 5_000,
    });
  });
});

// @MX:NOTE: [AUTO] boundingBox 기반 기하 검증. computed style 단독 검증은 이 결함을
// 잡지 못한다(SPEC-PREVIEW-011). loose list 마커/텍스트 분리 결함 및 항목 간격 회귀 테스트.
test.describe('Loose list marker geometry (SPEC-PREVIEW-011)', () => {
  test('AC-001: loose list marker and item text render on the same line', async ({
    tauriPage,
  }) => {
    await injectFixtureAndWaitForPreview(tauriPage);

    const looseList = listAfterHeading(tauriPage, 'Loose 목록');
    const firstLi = looseList.locator('> li').first();
    const firstP = firstLi.locator('> p').first();
    await expect(firstP).toBeVisible();

    const liBox = await firstLi.boundingBox();
    const pBox = await firstP.boundingBox();
    expect(liBox).not.toBeNull();
    expect(pBox).not.toBeNull();

    // 결함 상태: 텍스트(p)가 <li> 첫 줄 아래로 밀려나 y 오프셋이 1행 높이만큼 발생한다.
    expect(Math.abs(pBox!.y - liBox!.y)).toBeLessThanOrEqual(COORD_TOLERANCE_PX);
  });

  test('AC-002: tight and loose list item spacing are equal', async ({ tauriPage }) => {
    await injectFixtureAndWaitForPreview(tauriPage);

    const tightList = listAfterHeading(tauriPage, 'Tight 목록');
    const looseList = listAfterHeading(tauriPage, 'Loose 목록');
    await expect(looseList.locator('> li').last()).toBeVisible();

    const gapsFor = async (list: ReturnType<typeof listAfterHeading>) => {
      const items = list.locator('> li');
      const count = await items.count();
      const boxes = [];
      for (let i = 0; i < count; i++) {
        boxes.push(await items.nth(i).boundingBox());
      }
      const gaps: number[] = [];
      for (let i = 0; i < boxes.length - 1; i++) {
        gaps.push(boxes[i + 1]!.y - (boxes[i]!.y + boxes[i]!.height));
      }
      return gaps;
    };

    const tightGaps = await gapsFor(tightList);
    const looseGaps = await gapsFor(looseList);

    expect(tightGaps.length).toBeGreaterThan(0);
    expect(looseGaps.length).toBe(tightGaps.length);

    // 결함 상태: loose 쪽 gap이 tight 쪽보다 약 1rem(mb-4) 더 넓다.
    for (let i = 0; i < tightGaps.length; i++) {
      expect(Math.abs(looseGaps[i] - tightGaps[i])).toBeLessThanOrEqual(COORD_TOLERANCE_PX);
    }
  });

  test('AC-003: wrapped list item text maintains hanging indent', async ({ tauriPage }) => {
    await injectFixtureAndWaitForPreview(tauriPage);

    const longList = listAfterHeading(tauriPage, '긴 줄바꿈 항목');
    const li = longList.locator('> li').first();
    await expect(li).toBeVisible();

    const rects = await li.evaluate((el) => {
      const textNode = Array.from(el.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0
      );
      const range = document.createRange();
      range.selectNodeContents(textNode ?? el);
      return Array.from(range.getClientRects()).map((r) => ({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      }));
    });

    // 픽스처가 반드시 2행 이상으로 줄바꿈되어야 이 테스트가 의미가 있다.
    expect(rects.length).toBeGreaterThanOrEqual(2);

    const firstLineX = rects[0].x;
    for (const rect of rects.slice(1)) {
      expect(Math.abs(rect.x - firstLineX)).toBeLessThanOrEqual(COORD_TOLERANCE_PX);
    }
  });

  test('AC-004: nested list is indented relative to parent', async ({ tauriPage }) => {
    await injectFixtureAndWaitForPreview(tauriPage);

    const nestedList = listAfterHeading(tauriPage, '중첩 목록');
    const parentLi = nestedList.locator('> li').first();
    const childLi = parentLi.locator('ul > li, ol > li').first();
    await expect(childLi).toBeVisible();

    const parentBox = await parentLi.boundingBox();
    const childBox = await childLi.boundingBox();
    expect(parentBox).not.toBeNull();
    expect(childBox).not.toBeNull();

    expect(childBox!.x).toBeGreaterThan(parentBox!.x);
  });

  test('AC-005: loose ordered list marker and text share the same line', async ({
    tauriPage,
  }) => {
    await injectFixtureAndWaitForPreview(tauriPage);

    const looseOl = listAfterHeading(tauriPage, 'Loose 순서 목록');
    const firstLi = looseOl.locator('> li').first();
    const firstP = firstLi.locator('> p').first();
    await expect(firstP).toBeVisible();

    const liBox = await firstLi.boundingBox();
    const pBox = await firstP.boundingBox();
    expect(liBox).not.toBeNull();
    expect(pBox).not.toBeNull();

    expect(Math.abs(pBox!.y - liBox!.y)).toBeLessThanOrEqual(COORD_TOLERANCE_PX);
  });

  test('AC-006: task list markup text aligns with regular list items', async ({ tauriPage }) => {
    await injectFixtureAndWaitForPreview(tauriPage);

    const taskList = listAfterHeading(tauriPage, '태스크 표기 목록');
    const items = taskList.locator('> li');
    await expect(items.nth(2)).toBeVisible();

    const checkedBox = await items.nth(0).boundingBox();
    const normalBox = await items.nth(2).boundingBox();
    expect(checkedBox).not.toBeNull();
    expect(normalBox).not.toBeNull();

    expect(Math.abs(checkedBox!.x - normalBox!.x)).toBeLessThanOrEqual(COORD_TOLERANCE_PX);
  });

  test('AC-007: multi-paragraph list item preserves paragraph spacing', async ({ tauriPage }) => {
    await injectFixtureAndWaitForPreview(tauriPage);

    const multiParagraphList = listAfterHeading(tauriPage, '다문단 항목');
    const li = multiParagraphList.locator('> li').first();
    const paragraphs = li.locator('> p');
    await expect(paragraphs.nth(1)).toBeVisible();

    const firstBox = await paragraphs.nth(0).boundingBox();
    const secondBox = await paragraphs.nth(1).boundingBox();
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();

    const gap = secondBox!.y - (firstBox!.y + firstBox!.height);
    expect(gap).toBeGreaterThan(0);
  });
});
