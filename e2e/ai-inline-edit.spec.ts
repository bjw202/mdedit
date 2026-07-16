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

    // SPEC-AI-002: 스트림이 도착하지 않는 대기 구간(hang) — 글로우 테두리 + 3줄 shimmer
    // 스켈레톤이 보여야 한다(AC-AI2-001). 취소는 대기 시각물 표시 중에도 항상 동작해야 한다
    // (REQ-AI2-009).
    const card = aiPage.locator('.mdedit-ai-card-streaming');
    await expect(card).toBeVisible({ timeout: 5_000 });
    await expect(card.locator('.mdedit-ai-skeleton-line')).toHaveCount(3);

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

  // BUG-4 실기기 재현: 글로우 테두리가 첫 청크 도착 이후(스켈레톤→텍스트 전환) 사라지지 않는지
  // 실 WebKit 엔진(playwright.config.ts projects: webkit = Desktop Safari)으로 검증한다.
  test('스트리밍 첫 청크 도착 후에도 글로우 테두리 애니메이션이 유지된다(BUG-4)', async ({
    aiPage,
  }) => {
    await openEditorWithSelection(aiPage);
    await setScenario(aiPage, 'hang');
    await aiPage.locator('.mdedit-ai-sparkle-btn').click();
    await aiPage
      .locator('.mdedit-ai-preset-menu .mdedit-ai-preset-item', { hasText: '다듬기' })
      .click();

    const card = aiPage.locator('.mdedit-ai-card-streaming');
    await expect(card).toBeVisible({ timeout: 5_000 });
    await expect(card.locator('.mdedit-ai-skeleton-line')).toHaveCount(3);

    const glowBefore = await card.evaluate(
      (el) => getComputedStyle(el, '::before').animationName
    );
    expect(glowBefore).toBe('mdedit-ai-glow-flow');

    // 대기 중인 requestId 로 첫 청크를 수동 주입한다(hang 시나리오는 자동으로 스트리밍하지 않음).
    const requestId = await aiPage.evaluate(() => {
      const req = window.__AI_MOCK__.requests.find((r) => r.cmd === 'ai_request');
      return (req!.payload as { args: { requestId: string } }).args.requestId;
    });
    await aiPage.evaluate(
      ({ id }) => window.__AI_MOCK__.emit('ai://chunk', { requestId: id, text: '다듬는 중' }),
      { id: requestId }
    );

    // 스켈레톤 → 텍스트 전환(REQ-AI2-004/005 위젯 1회 재생성 허용 지점).
    await expect(card.locator('.mdedit-ai-skeleton-line')).toHaveCount(0, { timeout: 3_000 });
    await expect(card.locator('.mdedit-ai-stream')).toContainText('다듬는 중');

    const glowAfter = await card.evaluate(
      (el) => getComputedStyle(el, '::before').animationName
    );
    expect(glowAfter).toBe('mdedit-ai-glow-flow');
  });

  // BUG-1/2/3 실기기 재현 여정: 다이어그램 프리셋 → 1차 응답이 펜스로 감쌌지만 무효 문법 →
  // 자동 재요청(새 requestId) → 2차 응답이 펜스로 감싼 유효 mermaid → 카드가 미니 렌더 +
  // 아래에 삽입 버튼까지 도달한다. 수정 전에는 재요청 스트림을 아무도 받지 못해 카드가
  // '✕ 취소'만 보이는 streaming 에 영원히 멈춘다(사용자 실기기 재현).
  test('다이어그램: 펜스 무효 응답 → 자동 재요청 → 유효 응답 → 미니 렌더 + 아래에 삽입', async ({
    aiPage,
  }) => {
    await openEditorWithSelection(aiPage);
    await setScenario(aiPage, 'diagram-fenced-then-valid');
    await aiPage.locator('.mdedit-ai-sparkle-btn').click();
    await aiPage
      .locator('.mdedit-ai-preset-menu .mdedit-ai-preset-item', { hasText: '다이어그램으로' })
      .click();

    const card = aiPage.locator('.mdedit-ai-card');
    await expect(card).toBeVisible({ timeout: 5_000 });

    // 자동 재요청까지 발행된다(1차 무효 판정 + ai_request 2회 호출).
    await expect
      .poll(
        async () =>
          aiPage.evaluate(
            () => window.__AI_MOCK__.requests.filter((r) => r.cmd === 'ai_request').length
          ),
        { timeout: 5_000 }
      )
      .toBeGreaterThanOrEqual(2);

    // 재요청도 원본 selection/컨텍스트를 그대로 실어 보낸다(BUG-2).
    const secondReq = await aiPage.evaluate(() => {
      const reqs = window.__AI_MOCK__.requests.filter((r) => r.cmd === 'ai_request');
      return reqs[reqs.length - 1].payload as { args: Record<string, unknown> };
    });
    expect(secondReq.args.selection).toBeTruthy();

    // 2차(유효) 응답이 diagram-valid 카드로 반영된다 — 수정 전에는 여기서 타임아웃.
    await expect(aiPage.locator('.mdedit-ai-mermaid-preview')).toBeVisible({ timeout: 5_000 });
    const insertBtn = aiPage.locator('.mdedit-ai-apply[data-mode="insert-below"]');
    await expect(insertBtn).toBeVisible({ timeout: 3_000 });

    // BUG-5 실기기 재현: 삽입 전 카드는 펜스를 벗긴 코드로 검증·미리보기 되지만, 문서에
    // 실제로 들어가는 텍스트는 마크다운 미리보기가 다이어그램으로 렌더하도록 펜스가
    // 복원되어야 한다 — 수정 전에는 문서에 펜스 없는 맨 mermaid 코드만 삽입된다.
    await insertBtn.click();
    await expect(aiPage.locator('.cm-content')).toContainText('```mermaid', { timeout: 3_000 });
  });
});
