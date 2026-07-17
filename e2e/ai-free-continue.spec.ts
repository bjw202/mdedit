// SPEC-AI-003 E2E: 자유 위치 이어쓰기(M2) 여정 (실 WebKit 엔진 = WKWebView 근사)
// 여정: 문서 중간 클릭 → Mod+Enter → 고스트 스트리밍 → [✓ 넣기] → 뒤 문맥 원문 그대로 보존
// 취소 경로: hang 시나리오로 스트리밍 대기 중 타이핑 → 고스트 소멸 + ai_cancel 취소(D1)
import { test, expect, AiMockScenario } from './fixtures/tauri-v2-ai-mock';
import type { Page } from '@playwright/test';

const DOC = '첫 문단이 끊겨서\n\n둘째 문단은 그대로 남아야 한다.';

async function openEditorAtFirstLineEnd(page: Page): Promise<void> {
  await page.goto('/');
  const editor = page.locator('.cm-content');
  await editor.waitFor({ timeout: 10_000 });
  await editor.click();
  await editor.fill(DOC);
  // 문서 처음으로 이동 후 첫 줄 끝(끊긴 지점)까지 — 문서 중간, 뒤에 실 내용이 있는 위치.
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('End');
}

async function setScenario(page: Page, scenario: AiMockScenario): Promise<void> {
  await page.evaluate((s) => {
    window.__AI_MOCK__.scenario = s;
  }, scenario);
}

test.describe('AI 자유 위치 이어쓰기 여정 (SPEC-AI-003)', () => {
  test('문서 중간 트리거 → 고스트 스트리밍 → 넣기 → 뒤 문맥 원문 그대로', async ({ aiPage }) => {
    const consoleErrors: string[] = [];
    aiPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    aiPage.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

    await openEditorAtFirstLineEnd(aiPage);
    await aiPage.keyboard.press('ControlOrMeta+Enter');

    const controls = aiPage.locator('.cm-ai-ghost-controls');
    await expect(controls).toBeVisible({ timeout: 5_000 });

    // ai_request 페이로드 계약 — feature/presetKind 하위호환 + contextAfter(REQ-AI3-008).
    const req = await aiPage.evaluate(() =>
      window.__AI_MOCK__.requests.find((r) => r.cmd === 'ai_request')
    );
    expect(req).toBeTruthy();
    const payload = req!.payload as { args: Record<string, unknown> };
    expect(payload.args.feature).toBe('section-fill');
    expect(payload.args.presetKind).toBe('continue');
    expect(payload.args.contextAfter).toContain('둘째 문단은 그대로 남아야 한다.');

    const confirmBtn = aiPage.locator('.cm-ai-ghost-btn', { hasText: '✓ 넣기' });
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();

    // 확정은 삽입 전용 — 커서 뒤 문맥(둘째 문단)이 원문 그대로 보존된다(AC-AI3-001).
    await expect(aiPage.locator('.cm-content')).toContainText('둘째 문단은 그대로 남아야 한다.');

    const critical = consoleErrors.filter(
      (e) => e.includes('RangeError') || e.includes('Uncaught') || e.startsWith('pageerror')
    );
    expect(critical).toHaveLength(0);
  });

  test('스트리밍 대기 중 타이핑 → 고스트 소멸 + ai_cancel 취소(D1)', async ({ aiPage }) => {
    await openEditorAtFirstLineEnd(aiPage);
    await setScenario(aiPage, 'hang');

    await aiPage.keyboard.press('ControlOrMeta+Enter');

    const placeholder = aiPage.locator('.mdedit-ai-ghost-placeholder');
    await expect(placeholder).toBeVisible({ timeout: 5_000 });

    await aiPage.keyboard.type('x');

    await expect(placeholder).toHaveCount(0);
    await expect
      .poll(async () =>
        aiPage.evaluate(() => window.__AI_MOCK__.requests.some((r) => r.cmd === 'ai_cancel'))
      )
      .toBe(true);
  });
});
