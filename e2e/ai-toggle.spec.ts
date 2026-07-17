// SPEC-AI-005 E2E: AI 기능 사용자 켜기/끄기 토글 전체 여정 (실 WebKit 엔진).
// 여정: 설정 열기 → 토글 확인(기본 ON) → OFF → 표면 전체 비활성(✨ 없음, Mod+Enter 무반응,
// aiRequest 미호출) → ON 복귀 → ✨ 즉시 재활성(재로드 없이).
// 선례: ai-inline-edit.spec.ts (aiPage fixture, openEditorWithSelection 패턴).
import { test, expect } from './fixtures/tauri-v2-ai-mock';
import type { Page } from '@playwright/test';

const SAMPLE = '이 문장은 다듬기 대상 문단입니다. 조금 어색한 표현이 들어 있어요.';

async function openEditorWithSelection(page: Page): Promise<void> {
  await page.goto('/');
  const editor = page.locator('.cm-content');
  await editor.waitFor({ timeout: 10_000 });
  await editor.click();
  await editor.fill(SAMPLE);
  await page.keyboard.press('ControlOrMeta+A');
}

async function openSettings(page: Page): Promise<void> {
  await page.locator('button[aria-label="Settings"]').click();
  await expect(page.locator('[role="dialog"][aria-label="설정"]')).toBeVisible({
    timeout: 5_000,
  });
}

async function closeSettings(page: Page): Promise<void> {
  // 백드롭 클릭으로 닫는다(SettingsModal 관례 — Esc·백드롭 클릭 모두 지원).
  await page.locator('[data-testid="settings-backdrop"]').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('[role="dialog"][aria-label="설정"]')).toHaveCount(0, {
    timeout: 3_000,
  });
}

function aiToggle(page: Page) {
  return page.locator('input[aria-label="AI 기능 사용"]');
}

test.describe('AI 기능 켜기/끄기 토글 여정 (SPEC-AI-005)', () => {
  test('OFF → 표면 전체 비활성(토큰 0) → ON → 즉시 재활성', async ({ aiPage }) => {
    const consoleErrors: string[] = [];
    aiPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    aiPage.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

    // 1) 설정 열기 → 토글 기본 ON 확인
    await aiPage.goto('/');
    await openSettings(aiPage);
    const toggle = aiToggle(aiPage);
    await expect(toggle).toBeVisible({ timeout: 5_000 });
    await expect(toggle).toBeChecked();

    // 2) OFF 로 전환 → 설정 닫기
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await closeSettings(aiPage);

    // 3) 텍스트 선택 → ✨ 선택 툴바가 나타나지 않는다
    await openEditorWithSelection(aiPage);
    await expect(aiPage.locator('.mdedit-ai-sparkle-btn')).toHaveCount(0, { timeout: 2_000 });

    // 4) Mod+Enter → 신규 이어쓰기/고스트가 나타나지 않는다(폴스루)
    await aiPage.keyboard.press('ControlOrMeta+End');
    await aiPage.keyboard.press('ControlOrMeta+Enter');
    await expect(aiPage.locator('.cm-ai-ghost')).toHaveCount(0, { timeout: 1_500 });
    await expect(aiPage.locator('.mdedit-ai-card')).toHaveCount(0, { timeout: 500 });

    // OFF 상태의 모든 조작에서 ai_request 가 단 한 번도 호출되지 않았다(토큰 0).
    const requestCount = await aiPage.evaluate(
      () => window.__AI_MOCK__.requests.filter((r) => r.cmd === 'ai_request').length
    );
    expect(requestCount).toBe(0);

    // 5) 다시 ON 으로 전환 → 재로드 없이 즉시 ✨ 재활성
    await openSettings(aiPage);
    await expect(aiToggle(aiPage)).not.toBeChecked();
    await aiToggle(aiPage).click();
    await expect(aiToggle(aiPage)).toBeChecked();
    await closeSettings(aiPage);

    // 이미 선택되어 있던 텍스트에 새로 선택을 발생시켜 ✨ 재등장을 확인한다(재로드 없음).
    const editor = aiPage.locator('.cm-content');
    await editor.click();
    await aiPage.keyboard.press('ControlOrMeta+A');
    await expect(aiPage.locator('.mdedit-ai-sparkle-btn')).toBeVisible({ timeout: 5_000 });

    // 콘솔 크래시 없음
    const critical = consoleErrors.filter(
      (e) => e.includes('RangeError') || e.includes('Uncaught') || e.startsWith('pageerror')
    );
    expect(critical).toHaveLength(0);
  });
});
