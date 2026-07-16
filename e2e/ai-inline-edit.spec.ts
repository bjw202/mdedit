// SPEC-AI-001 E2E: 인라인 편집 전체 여정 (실 WebKit 엔진 = WKWebView 근사)
// 여정: 텍스트 선택 → ✨ 툴바 → 프리셋 클릭 → 스트리밍 카드 → 제안 → 바꾸기 적용
// 오류 경로: login 오류 카드, invoke 거부 사유 노출, 사용자 취소
import { test, expect, AiMockScenario } from './fixtures/tauri-v2-ai-mock';
import type { Page } from '@playwright/test';

const SAMPLE = '이 문장은 다듬기 대상 문단입니다. 조금 어색한 표현이 들어 있어요.';

async function openEditorWithSelection(page: Page): Promise<void> {
  await page.goto('/');
  const editor = page.locator('.cm-content');
  await editor.waitFor({ timeout: 10_000 });
  await editor.click();
  await editor.fill(SAMPLE);
  // 전체 선택 → 비어있지 않은 선택으로 ✨ 툴바 트리거
  await page.keyboard.press('ControlOrMeta+A');
}

async function setScenario(page: Page, scenario: AiMockScenario): Promise<void> {
  await page.evaluate((s) => {
    window.__AI_MOCK__.scenario = s;
  }, scenario);
}

test.describe('AI 인라인 편집 여정 (SPEC-AI-001)', () => {
  test('선택 시 ✨ 툴바가 나타난다', async ({ aiPage }) => {
    await openEditorWithSelection(aiPage);
    await expect(aiPage.locator('.mdedit-ai-sparkle-btn')).toBeVisible({ timeout: 5_000 });
  });

  test('✨ 클릭 → 프리셋 메뉴 → 다듬기 → 스트리밍 → 제안 → 바꾸기 적용', async ({ aiPage }) => {
    const consoleErrors: string[] = [];
    aiPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    aiPage.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

    await openEditorWithSelection(aiPage);
    await aiPage.locator('.mdedit-ai-sparkle-btn').click();

    // 프리셋 메뉴
    const menu = aiPage.locator('.mdedit-ai-preset-menu');
    await expect(menu).toBeVisible({ timeout: 3_000 });
    await menu.locator('.mdedit-ai-preset-item', { hasText: '다듬기' }).click();

    // 카드 등장(스트리밍 or 제안) → 최종 제안 상태
    const card = aiPage.locator('.mdedit-ai-card');
    await expect(card).toBeVisible({ timeout: 5_000 });
    await expect(aiPage.locator('.mdedit-ai-suggestion')).toBeVisible({ timeout: 5_000 });
    await expect(aiPage.locator('.mdedit-ai-suggestion')).toContainText('다듬은 결과 문장이에요.');

    // ai_request 페이로드가 { args } 래핑 + camelCase 인지 계약 검증
    const req = await aiPage.evaluate(() =>
      window.__AI_MOCK__.requests.find((r) => r.cmd === 'ai_request')
    );
    expect(req).toBeTruthy();
    const payload = req!.payload as { args: Record<string, unknown> };
    expect(payload.args).toBeTruthy();
    expect(typeof payload.args.requestId).toBe('string');
    expect(payload.args.feature).toBe('inline-edit');
    expect(payload.args.presetKind).toBe('polish');

    // 바꾸기 적용 → 에디터 본문이 제안으로 교체됨
    await aiPage.locator('.mdedit-ai-apply').click();
    await expect(aiPage.locator('.cm-content')).toContainText('다듬은 결과 문장이에요.', {
      timeout: 3_000,
    });
    // 카드 소멸
    await expect(card).toHaveCount(0, { timeout: 3_000 });

    // 콘솔 크래시 없음 (bug-2 RangeError 재발 가드)
    const critical = consoleErrors.filter(
      (e) => e.includes('RangeError') || e.includes('Uncaught') || e.startsWith('pageerror')
    );
    expect(critical).toHaveLength(0);
  });

  test('login 오류 → 오류 카드 + 연결 안내 버튼', async ({ aiPage }) => {
    await openEditorWithSelection(aiPage);
    await setScenario(aiPage, 'login-error');
    await aiPage.locator('.mdedit-ai-sparkle-btn').click();
    await aiPage
      .locator('.mdedit-ai-preset-menu .mdedit-ai-preset-item', { hasText: '다듬기' })
      .click();

    await expect(aiPage.locator('.mdedit-ai-notice')).toContainText('로그인이 풀렸어요', {
      timeout: 5_000,
    });
    await expect(aiPage.locator('.mdedit-ai-connect')).toBeVisible();
  });

  test('invoke 거부 → 거부 사유가 카드에 노출된다 (조용한 실패 금지)', async ({ aiPage }) => {
    await openEditorWithSelection(aiPage);
    await setScenario(aiPage, 'invoke-reject');
    await aiPage.locator('.mdedit-ai-sparkle-btn').click();
    await aiPage
      .locator('.mdedit-ai-preset-menu .mdedit-ai-preset-item', { hasText: '다듬기' })
      .click();

    await expect(aiPage.locator('.mdedit-ai-notice')).toContainText(
      'AI 기능이 조직 정책으로 비활성화',
      { timeout: 5_000 }
    );
  });

  test('스트리밍 중 취소 → 카드가 취소 처리된다', async ({ aiPage }) => {
    await openEditorWithSelection(aiPage);
    await setScenario(aiPage, 'hang');
    await aiPage.locator('.mdedit-ai-sparkle-btn').click();
    await aiPage
      .locator('.mdedit-ai-preset-menu .mdedit-ai-preset-item', { hasText: '다듬기' })
      .click();

    const cancelBtn = aiPage.locator('.mdedit-ai-cancel');
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });
    await cancelBtn.click();

    // ai_cancel 호출 계약({ args: { requestId } }) 확인
    await expect
      .poll(async () =>
        aiPage.evaluate(() => window.__AI_MOCK__.requests.some((r) => r.cmd === 'ai_cancel'))
      )
      .toBe(true);
    const cancelReq = await aiPage.evaluate(
      () => window.__AI_MOCK__.requests.find((r) => r.cmd === 'ai_cancel')!.payload
    );
    expect((cancelReq as { args: { requestId: string } }).args.requestId).toBeTruthy();
  });
});
