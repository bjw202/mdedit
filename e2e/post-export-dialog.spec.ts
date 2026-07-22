import { test, expect } from '@playwright/test';
import { injectTauriMock, injectExportStubs } from './fixtures/tauri-mock';

// SPEC-EXPORT-002 E2E — 내보내기 완료 모달 가시성 + 닫기 + open/reveal invoke payload 단언.
// 검증 불가 경계(acceptance.md (1)): 실제 OS 앱 실행은 Playwright 관측 밖. payload 단언까지만.

test.beforeEach(async ({ page }) => {
  await injectTauriMock(page);
  await injectExportStubs(page, { format: 'html' });
});

async function typeContent(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  // CodeMirror 편집 영역에 포커스해 내용 입력 — Export 버튼 활성화 조건(content > 0).
  const editor = page.locator('.cm-content').first();
  await editor.click();
  await page.keyboard.type('# 내보내기 테스트 문서');
}

async function exportAsHtml(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: 'Export as HTML' }).click();
}

test.describe('SPEC-EXPORT-002: 내보내기 완료 모달', () => {
  test('HTML 내보내기 성공 시 완료 모달이 표시되고 저장 경로가 보인다 (AC-001/004)', async ({ page }) => {
    await typeContent(page);
    await exportAsHtml(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('내보내기 완료');
    // 저장 경로가 모달 본문에 표시된다(injectExportStubs 가 반환한 결정론적 경로).
    await expect(dialog).toContainText('/tmp/export-html.preview');
  });

  test('모달의 3개 액션이 닫기/폴더에서 보기/열기 순서이고 열기만 primary 다 (AC-003)', async ({ page }) => {
    await typeContent(page);
    await exportAsHtml(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const cancel = dialog.getByTestId('dialog-action-cancel');
    const reveal = dialog.getByTestId('dialog-action-reveal');
    const open = dialog.getByTestId('dialog-action-open');
    await expect(cancel).toHaveText('닫기');
    await expect(reveal).toHaveText('폴더에서 보기');
    await expect(open).toHaveText('열기');
    await expect(open).toHaveClass(/md-dialog-action-primary/);
    await expect(reveal).not.toHaveClass(/md-dialog-action-primary/);
    await expect(cancel).not.toHaveClass(/md-dialog-action-primary/);
  });

  test('닫기 액션 → 모달 소멸, open/reveal 호출 0건 (AC-007)', async ({ page }) => {
    await typeContent(page);
    await exportAsHtml(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByTestId('dialog-action-cancel').click();
    await expect(dialog).not.toBeVisible();

    const opens = await page.evaluate(() => (window as unknown as { __EXPORT_OPEN_CALLS__: unknown[] }).__EXPORT_OPEN_CALLS__);
    const reveals = await page.evaluate(() => (window as unknown as { __EXPORT_REVEAL_CALLS__: unknown[] }).__EXPORT_REVEAL_CALLS__);
    expect(opens).toHaveLength(0);
    expect(reveals).toHaveLength(0);
  });

  test('열기 액션 → open-path 가 저장 경로로 1회 호출된다 (AC-005, payload 단언)', async ({ page }) => {
    await typeContent(page);
    await exportAsHtml(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByTestId('dialog-action-open').click();
    await expect(dialog).not.toBeVisible();

    const opens = await page.evaluate(() =>
      (window as unknown as { __EXPORT_OPEN_CALLS__: Array<{ path: string }> }).__EXPORT_OPEN_CALLS__,
    );
    expect(opens).toHaveLength(1);
    expect(opens[0].path).toBe('/tmp/export-html.preview');
  });

  test('폴더에서 보기 액션 → reveal-item-in-dir 이 저장 경로로 1회 호출된다 (AC-006, payload 단언)', async ({ page }) => {
    await typeContent(page);
    await exportAsHtml(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByTestId('dialog-action-reveal').click();
    await expect(dialog).not.toBeVisible();

    const reveals = await page.evaluate(() =>
      (window as unknown as { __EXPORT_REVEAL_CALLS__: Array<{ paths: string[] }> }).__EXPORT_REVEAL_CALLS__,
    );
    expect(reveals).toHaveLength(1);
    expect(reveals[0].paths).toContain('/tmp/export-html.preview');
  });

  test('저장 다이얼로그 취소(savePath=null) 시 완료 모달 미표시 (AC-009)', async ({ page }) => {
    // 취소 시나리오: 별도 페이지에서 savePath=null 로 스텁 재주입.
    await injectExportStubs(page, { savePath: null });
    await page.goto('/');
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.type('# 취소 테스트');
    await exportAsHtml(page);

    // 모달이 나타나지 않음을 확인 — 충분한 대기 후에도 비가시.
    await page.waitForTimeout(500);
    await expect(page.getByText('내보내기 완료')).toHaveCount(0);
  });
});
