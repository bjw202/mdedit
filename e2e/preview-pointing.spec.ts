// SPEC-AI-017 E2E: 미리보기에서 가리켜 지시하기 (실 WebKit 엔진)
// M1 확인(AC-AI17-014 4단계 전제): 실제 브라우저에서 노드 안쪽 ⌥+클릭이 노드 ID 로 이어지고,
// 표 칸 ⌥+클릭이 텍스트 선택을 만들지 않는지 먼저 잰다.
import { test, expect } from './fixtures/tauri-v2-ai-mock';
import type { Page, Locator } from '@playwright/test';

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

// ---------------------------------------------------------------------------
// AC-AI17-014 — 포인터 순서와 정리 (8단계)
// ---------------------------------------------------------------------------

const VALID_TABLE =
  '| 요금제 | 월 요금 | 저장 공간 |\n|---|---:|---|\n| 무료 | 10원 | 5GB |\n| 기본 | [9,900원](https://example.com/p) | 100GB |\n| 프로 | 19,900원 | 1TB |';
const VALID_DIAGRAM =
  'flowchart LR\n  A[장바구니] --> B[주문서 작성]\n  B --> C{결제 수단}\n  C -->|성공| D[주문 완료]\n  C -->|실패| B\n  B --> E[쿠폰]';
const ORIGINAL_TABLE_TEXT =
  '| 요금제 | 월 요금 | 저장 공간 |\n|---|---:|---|\n| 무료 | 0원 | 5GB |\n| 기본 | [9,900원](https://example.com/p) | 100GB |\n| 프로 | 19,900원 | 1TB |';

const popover = (page: Page): Locator => page.locator('.md-point-popover');
const previewTable = (page: Page): Locator => page.locator('.preview-content table').first();
const pendingTargets = (page: Page): Locator =>
  page.locator('.preview-content .md-point-target--pending');

async function center(loc: Locator): Promise<{ x: number; y: number }> {
  const box = await loc.boundingBox();
  expect(box).toBeTruthy();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function altClick(page: Page, loc: Locator): Promise<void> {
  const { x, y } = await center(loc);
  await page.keyboard.down('Alt');
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
  await page.keyboard.up('Alt');
}

async function requests(
  page: Page,
  cmd: string
): Promise<Array<{ cmd: string; payload: unknown }>> {
  return page.evaluate((c) => window.__AI_MOCK__.requests.filter((r) => r.cmd === c), cmd);
}

async function setResult(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    window.__AI_MOCK__.resultText = t;
  }, text);
}

async function sendInstruction(page: Page, text: string): Promise<void> {
  const input = page.locator('textarea.md-point-popover__input');
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press('Enter');
}

/** 에디터의 해당 줄 맨 앞에서 두 글자 뒤에 문자를 끼워 넣는다. */
async function editLine(page: Page, lineText: string, insert: string): Promise<void> {
  await page.locator('.cm-line', { hasText: lineText }).first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(insert);
}

async function setViewMode(
  page: Page,
  label: '편집 모드' | '분할 모드' | '미리보기 모드'
): Promise<void> {
  await page.locator(`button[aria-label="${label}"]`).click();
}

async function toggleAi(page: Page, on: boolean): Promise<void> {
  await page.locator('button[aria-label="Settings"]').click();
  const dlg = page.locator('[role="dialog"][aria-label="설정"]');
  await expect(dlg).toBeVisible();
  const t = page.locator('input[aria-label="AI 기능 사용"]');
  if ((await t.isChecked()) !== on) await t.click();
  await page.locator('[data-testid="settings-backdrop"]').click({ position: { x: 5, y: 5 } });
  await expect(dlg).toHaveCount(0);
}

async function pointTable(page: Page, instruction = '월 요금 열을 바꿔줘'): Promise<void> {
  await setResult(page, VALID_TABLE);
  await altClick(page, previewTable(page).locator('td', { hasText: '0원' }).first());
  await expect(popover(page)).toBeVisible();
  await sendInstruction(page, instruction);
  await expect(page.locator('.mdedit-ai-suggestion')).toBeVisible({ timeout: 8_000 });
}

test.describe('AC-AI17-014 포인터 순서와 정리', () => {
  test('1단계: ⌥ 없는 클릭과 드래그는 입력창을 열지 않고 드래그는 선택을 만든다', async ({
    aiPage,
  }) => {
    await openDoc(aiPage, EXAMPLE_DOC);
    const cell = previewTable(aiPage).locator('td', { hasText: '19,900원' });
    const { x, y } = await center(cell);
    await aiPage.mouse.click(x, y);
    await expect(popover(aiPage)).toHaveCount(0);

    const box = (await cell.boundingBox())!;
    await aiPage.mouse.move(box.x + 3, y);
    await aiPage.mouse.down();
    await aiPage.mouse.move(box.x + box.width - 3, y, { steps: 6 });
    await aiPage.mouse.up();
    const sel = await aiPage.evaluate(() => window.getSelection()?.toString() ?? '');
    expect(sel.length).toBeGreaterThan(0);
    await expect(popover(aiPage)).toHaveCount(0);
  });

  test('2단계: ⌥ 를 누른 채 머리 위로 이동하면 그 th 에만 강조, 떼면 사라진다', async ({
    aiPage,
  }) => {
    await openDoc(aiPage, EXAMPLE_DOC);
    const th = previewTable(aiPage).locator('th', { hasText: '월 요금' });
    const { x, y } = await center(th);
    await aiPage.mouse.move(x - 40, y - 2);
    await aiPage.keyboard.down('Alt');
    await aiPage.mouse.move(x, y, { steps: 4 });
    const hover = aiPage.locator('.preview-content .md-point-target--hover');
    await expect(hover).toHaveCount(1);
    await expect(th).toHaveClass(/md-point-target--hover/);
    await aiPage.keyboard.up('Alt');
    await expect(hover).toHaveCount(0);
  });

  test('3단계: ⌥+클릭 링크는 입력창만 열고 열기 호출 없음, 평범한 클릭은 열기 호출', async ({
    aiPage,
  }) => {
    await openDoc(aiPage, EXAMPLE_DOC);
    const link = previewTable(aiPage).locator('a', { hasText: '9,900원' });
    await altClick(aiPage, link);
    await expect(popover(aiPage)).toBeVisible();
    expect((await requests(aiPage, 'open_url_in_browser')).length).toBe(0);

    await aiPage.keyboard.press('Escape');
    await expect(popover(aiPage)).toHaveCount(0);
    const { x, y } = await center(link);
    await aiPage.mouse.click(x, y);
    await expect
      .poll(async () => (await requests(aiPage, 'open_url_in_browser')).length)
      .toBe(1);
    await expect(popover(aiPage)).toHaveCount(0);
  });

  test('4단계: 노드 C 글자 ⌥+클릭 → 요약 `노드: 결제 (C)`', async ({ aiPage }) => {
    await openDoc(aiPage, EXAMPLE_DOC);
    const nodeC = aiPage
      .locator('.preview-content .mermaid-container g.pele-node[data-id="C"]')
      .first();
    await altClick(aiPage, nodeC.locator('text').first());
    await expect(aiPage.locator('.md-point-popover__summary')).toHaveText('노드: 결제 (C)');
  });

  test('5단계 (표): 요청 1건·카드·강조 유지·제목 수정은 유지·셀 수정은 해제', async ({
    aiPage,
  }) => {
    await openDoc(aiPage, EXAMPLE_DOC);
    await pointTable(aiPage);

    const reqs = await requests(aiPage, 'ai_request');
    expect(reqs.length).toBe(1);
    const args = (reqs[0].payload as { args: Record<string, unknown> }).args;
    expect(args.presetKind).toBe('point-table');
    expect(args.selection).toBe(ORIGINAL_TABLE_TEXT);
    expect(args.customInstruction).toBe('월 요금 열을 바꿔줘');
    expect(typeof args.pointer).toBe('string');
    expect(String(args.pointer)).not.toBe('');
    expect(args.contextBefore ?? null).toBeNull();
    expect(args.contextAfter ?? null).toBeNull();
    await expect(aiPage.locator('.mdedit-ai-card')).toHaveCount(1);
    await expect(popover(aiPage)).toHaveCount(0);

    await expect(pendingTargets(aiPage).first()).toBeVisible();
    const pendingCount = await pendingTargets(aiPage).count();
    expect(pendingCount).toBeGreaterThan(0);

    // 제목 줄 수정 → 미리보기가 다시 그려져도 강조 유지
    await editLine(aiPage, '# 요금', 'X');
    await expect(aiPage.locator('.preview-content h1')).toContainText('X');
    await expect(pendingTargets(aiPage)).toHaveCount(pendingCount);

    // 대상 표 칸 수정 → 강조 해제
    await editLine(aiPage, '| 무료 |', 'Z');
    await expect(pendingTargets(aiPage)).toHaveCount(0);
  });

  test('5단계 (다이어그램+취소): 노드 지시 → 강조 → 새 가리키기 후 취소하면 강조 해제', async ({
    aiPage,
  }) => {
    await openDoc(aiPage, EXAMPLE_DOC);
    await setResult(aiPage, VALID_DIAGRAM);
    const nodeC = aiPage
      .locator('.preview-content .mermaid-container g.pele-node[data-id="C"]')
      .first();
    await altClick(aiPage, nodeC.locator('text').first());
    await sendInstruction(aiPage, '결제 수단으로 바꾸고 쿠폰 추가');
    await expect(aiPage.locator('.mdedit-ai-card')).toBeVisible({ timeout: 8_000 });
    const reqs = await requests(aiPage, 'ai_request');
    expect(reqs.length).toBe(1);
    const args = (reqs[0].payload as { args: Record<string, unknown> }).args;
    expect(args.presetKind).toBe('point-diagram');
    await expect(
      aiPage.locator('.preview-content g.pele-node.md-point-target--pending')
    ).not.toHaveCount(0);
    await expect(aiPage.locator('.mdedit-ai-mermaid-preview svg')).toBeVisible({
      timeout: 8_000,
    });

    // 다이어그램 카드 「취소」 → 강조 해제. 이어서 새로 가리켜 카드를 띄운 뒤 다시 「취소」.
    await aiPage.locator('.mdedit-ai-card .mdedit-ai-cancel').first().click();
    await expect(aiPage.locator('.mdedit-ai-card')).toHaveCount(0);
    await expect(pendingTargets(aiPage)).toHaveCount(0);
    await altClick(aiPage, previewTable(aiPage).locator('td', { hasText: '0원' }).first());
    await setResult(aiPage, VALID_TABLE);
    await sendInstruction(aiPage, '표도 바꿔줘');
    await expect(aiPage.locator('.mdedit-ai-suggestion')).toBeVisible({ timeout: 8_000 });
    await expect(pendingTargets(aiPage).first()).toBeVisible();
    await aiPage.locator('.mdedit-ai-card .mdedit-ai-cancel').first().click();
    await expect(aiPage.locator('.mdedit-ai-card')).toHaveCount(0);
    await expect(pendingTargets(aiPage)).toHaveCount(0);
  });

  test('6단계: 미리보기 전용 보기에서는 ⌥+클릭이 아무것도 열지 않는다', async ({ aiPage }) => {
    await openDoc(aiPage, EXAMPLE_DOC);
    await setViewMode(aiPage, '미리보기 모드');
    await expect(aiPage.locator('.cm-editor')).toHaveCount(0);
    await altClick(aiPage, previewTable(aiPage).locator('td', { hasText: '0원' }).first());
    await expect(popover(aiPage)).toHaveCount(0);
  });

  test('7단계: AI 토글 끄면 카드·강조 정리, 켠 뒤 칸을 고치고 「바꾸기」하면 stale 안내', async ({
    aiPage,
  }) => {
    await openDoc(aiPage, EXAMPLE_DOC);
    await pointTable(aiPage);
    await expect(pendingTargets(aiPage).first()).toBeVisible();

    await toggleAi(aiPage, false);
    await expect(aiPage.locator('.mdedit-ai-card')).toHaveCount(0);
    await expect(pendingTargets(aiPage)).toHaveCount(0);

    await toggleAi(aiPage, true);
    await pointTable(aiPage);
    await editLine(aiPage, '| 무료 |', 'Z');
    await aiPage.locator('.mdedit-ai-apply[data-mode="replace"]').click();
    await expect(aiPage.locator('.mdedit-ai-card')).toContainText(
      '원문이 바뀌어 적용할 수 없어요'
    );
    const doc = await aiPage.locator('.cm-content').innerText();
    expect(doc).toContain('Z');
    expect(doc).toContain('0원');
    expect(doc).not.toContain('10원');
  });

  test('8단계: 긴 문서에서 에디터를 펜스 줄까지 스크롤하면 미리보기 다이어그램이 보인다', async ({
    aiPage,
  }) => {
    const filler = Array.from({ length: 120 }, (_, i) => `문단 ${i + 1} 입니다. 채움 문장이에요.`).join(
      '\n\n'
    );
    const doc = EXAMPLE_DOC.replace('```mermaid', filler + '\n\n```mermaid');
    await openDoc(aiPage, doc);
    const svg = aiPage.locator('.preview-content .mermaid-container svg').first();
    const fenceLine = aiPage.locator('.cm-line', { hasText: 'flowchart LR' }).first();
    // 미리보기의 실제 스크롤 뷰포트(가장 가까운 스크롤 가능한 조상) 기준으로 가시 여부를 잰다.
    const svgInView = (): Promise<boolean> =>
      svg.evaluate((el) => {
        let host: HTMLElement | null = el.parentElement;
        while (host && !(host.scrollHeight > host.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(host).overflowY))) {
          host = host.parentElement;
        }
        if (!host) throw new Error('미리보기 스크롤 컨테이너를 찾지 못했다');
        const r = el.getBoundingClientRect();
        const h = host.getBoundingClientRect();
        return r.bottom > h.top && r.top < h.bottom;
      });
    // 스크롤 전에는 다이어그램이 미리보기 보이는 영역 밖이어야 이 검사가 의미가 있다.
    await aiPage.locator('.cm-scroller').hover();
    for (let i = 0; i < 80 && (await svgInView()); i++) {
      await aiPage.mouse.wheel(0, -600);
      await aiPage.waitForTimeout(50);
    }
    expect(await svgInView()).toBe(false);
    // 에디터를 펜스 줄까지 휠로 스크롤해 동기화 경로를 탄다.
    for (let i = 0; i < 60; i++) {
      const inView =
        (await fenceLine.count()) > 0 &&
        (await fenceLine.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const h = el.closest('.cm-scroller')!.getBoundingClientRect();
          return r.top >= h.top && r.bottom <= h.bottom;
        }));
      if (inView) break;
      await aiPage.mouse.wheel(0, 400);
    }
    await expect.poll(svgInView, { timeout: 8_000 }).toBe(true);
  });
});
