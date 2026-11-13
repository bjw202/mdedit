// SPEC-AI-017 후속(카드 t12): 다이어그램 노드 강조가 실제로 "보이는지" 픽셀로 확인한다 (실 WebKit 엔진).
// 클래스 존재만 세던 기존 spec 은 WebKit 이 SVG <g> 의 CSS filter 를 그리지 않아도 통과했다.
import { test, expect } from './fixtures/tauri-v2-ai-mock';
import type { Page, Locator } from '@playwright/test';

const DOC = `# 다이어그램

\`\`\`mermaid
flowchart LR
  A[장바구니] --> B[주문서 작성]
  B --> C{결제}
\`\`\`

\`\`\`mermaid
sequenceDiagram
  participant U as 사용자
  participant S as 서버
  U->>S: 요청
\`\`\`
`;

async function openDoc(page: Page, content: string): Promise<void> {
  await page.goto('/');
  await page.locator('.cm-editor').waitFor({ timeout: 15_000 });
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await editor.fill(content);
  await page.locator('.preview-content .mermaid-container svg').nth(1).waitFor({ timeout: 15_000 });
}

async function shot(page: Page, node: Locator): Promise<Buffer> {
  const box = await node.boundingBox();
  expect(box).toBeTruthy();
  const pad = 10;
  return page.screenshot({
    clip: { x: box!.x - pad, y: box!.y - pad, width: box!.width + pad * 2, height: box!.height + pad * 2 },
  });
}

const targets: Array<[string, string, number]> = [
  ['flowchart 노드', 'g.pele-node[data-id="C"]', 0],
  ['sequence 참가자', 'g.pele-node[data-id="S"]', 1],
];

for (const [label, sel, idx] of targets) {
  test.describe(label, () => {
    test('⌥ 호버 강조가 픽셀로 보인다', async ({ aiPage }) => {
      await openDoc(aiPage, DOC);
      const node = aiPage.locator('.preview-content .mermaid-container').nth(idx).locator(sel).first();
      await node.scrollIntoViewIfNeeded();
      await aiPage.mouse.move(2, 2);
      const before = await shot(aiPage, node);
      const box = (await node.boundingBox())!;
      await aiPage.keyboard.down('Alt');
      await aiPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(aiPage.locator('.preview-content .md-point-target--hover').first()).toBeAttached();
      const after = await shot(aiPage, node);
      await aiPage.keyboard.up('Alt');
      expect(after.equals(before), '호버 전후 화면이 같으면 강조가 보이지 않는 것').toBe(false);
    });

    test('대기(pending) 강조가 호버보다 진하게 보인다', async ({ aiPage }) => {
      await openDoc(aiPage, DOC);
      const node = aiPage.locator('.preview-content .mermaid-container').nth(idx).locator(sel).first();
      await node.scrollIntoViewIfNeeded();
      await aiPage.mouse.move(2, 2);
      const before = await shot(aiPage, node);
      await node.evaluate((g) => g.classList.add('md-point-target', 'md-point-target--hover'));
      const hover = await shot(aiPage, node);
      await node.evaluate((g) => g.classList.replace('md-point-target--hover', 'md-point-target--pending'));
      const pending = await shot(aiPage, node);
      expect(pending.equals(before), '대기 강조가 보이지 않음').toBe(false);
      expect(pending.equals(hover), '대기와 호버가 구분되지 않음').toBe(false);
    });
  });
}
