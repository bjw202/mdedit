// SPEC-AI-017 E2E: 미리보기에서 가리켜 지시하기 (실 WebKit 엔진)
// M1 확인(AC-AI17-014 4단계 전제): 실제 브라우저에서 노드 안쪽 ⌥+클릭이 노드 ID 로 이어지고,
// 표 칸 ⌥+클릭이 텍스트 선택을 만들지 않는지 먼저 잰다.
import { test, expect } from './fixtures/tauri-v2-ai-mock';
import type { Page } from '@playwright/test';

export const EXAMPLE_DOC = `# 요금

| 요금제 | 월 요금 | 저장 공간 |
|---|---:|---|
| 무료 | 0원 | 5GB |
| 기본 | [9,900원](https://example.com/p) | 100GB |
| 프로 | 19,900원 | 1TB |

\`\`\`mermaid
flowchart LR
  A[장바구니] --> B[주문서 작성]
  B --> C{결제}
  C -->|성공| D[주문 완료]
  C -->|실패| B
\`\`\`

- 목록 안 표
  | a | b |
  |---|---|
  | 1 | 2 |
`;

export async function openDoc(page: Page, content: string): Promise<void> {
  await page.goto('/');
  await page.locator('.cm-editor').waitFor({ timeout: 15_000 });
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await editor.fill(content);
  await page.locator('.preview-content .mermaid-container svg').waitFor({ timeout: 15_000 });
}

test.describe('M1 — 실제 브라우저 클릭 확인 (SPEC-AI-017)', () => {
  test('노드 안쪽 text/path 위 ⌥+클릭이 closest(g.pele-node[data-id]) 로 ID 를 돌려준다', async ({
    aiPage,
  }) => {
    await openDoc(aiPage, EXAMPLE_DOC);
    await aiPage.evaluate(() => {
      (window as unknown as { __hits: string[] }).__hits = [];
      document.addEventListener(
        'click',
        (e) => {
          const t = e.target as Element;
          const g = t.closest('g.pele-node[data-id]');
          (window as unknown as { __hits: string[] }).__hits.push(
            `${t.tagName.toLowerCase()}|${g ? g.getAttribute('data-id') : 'none'}|alt=${e.altKey}`
          );
        },
        true
      );
    });
    // 노드 C(결제) 의 글자와 도형 각각
    const nodeC = aiPage.locator('.preview-content .mermaid-container g.pele-node[data-id="C"]').first();
    await expect(nodeC).toBeVisible();
    const textBox = await nodeC.locator('text').first().boundingBox();
    expect(textBox).toBeTruthy();
    await aiPage.keyboard.down('Alt');
    await aiPage.mouse.click(textBox!.x + textBox!.width / 2, textBox!.y + textBox!.height / 2);
    const shapeBox = await nodeC.locator('path, rect, polygon').first().boundingBox();
    expect(shapeBox).toBeTruthy();
    // 도형 가장자리 근처(글자와 겹치지 않는 곳)
    await aiPage.mouse.click(shapeBox!.x + 3, shapeBox!.y + shapeBox!.height / 2);
    await aiPage.keyboard.up('Alt');
    const hits = await aiPage.evaluate(() => (window as unknown as { __hits: string[] }).__hits);
    console.log('M1 node hits:', JSON.stringify(hits));
    expect(hits.length).toBe(2);
    for (const h of hits) expect(h).toMatch(/\|C\|alt=true$/);
  });

  test('표 칸 ⌥+클릭이 텍스트 선택을 만들지 않는다', async ({ aiPage }) => {
    await openDoc(aiPage, EXAMPLE_DOC);
    const cell = aiPage.locator('.preview-content table').first().locator('td', { hasText: '19,900원' });
    const box = await cell.boundingBox();
    expect(box).toBeTruthy();
    await aiPage.evaluate(() => {
      // 캡처 단계에서 기본 동작을 막는 것이 설계 전제 — mousedown 선택 시작 여부도 함께 잰다.
      (window as unknown as { __sel: string }).__sel = '';
    });
    await aiPage.keyboard.down('Alt');
    await aiPage.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await aiPage.keyboard.up('Alt');
    const sel = await aiPage.evaluate(() => window.getSelection()?.toString() ?? '');
    console.log('M1 selection after alt+click:', JSON.stringify(sel));
    expect(sel).toBe('');
  });
});
