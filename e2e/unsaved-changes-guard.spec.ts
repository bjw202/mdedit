import { test as base, expect, type Page } from '@playwright/test';
import { seedFs } from './fixtures/tauri-mock';

// SPEC-FS-003 E2E — AC-007/008/009/012/013 (가상 FS 픽스처 기반)
// 종료 가드(AC-010)는 Playwright 범위 밖(Tauri 런타임 필요) — 수동 체크리스트로 검증.

// lastWatchedPath를 시드해 앱 시작 시 /proj 폴더가 자동 복원되게 한다(파일 트리 렌더링 조건).
async function seedLastWatched(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'mdedit-ui-store',
      JSON.stringify({
        state: {
          sidebarWidth: 250,
          previewWidth: 50,
          theme: 'system',
          fontSize: 14,
          sidebarCollapsed: false,
          scrollSyncEnabled: true,
          lastWatchedPath: '/proj',
          imageInsertMode: 'inline-blob',
          viewMode: 'split',
          aiNoticeAcknowledged: false,
          aiAdvancedModel: false,
          aiContinueLength: 'normal',
          aiEnabled: true,
        },
        version: 1,
      }),
    );
  });
}

const test = base.extend<{ fsPage: Page }>({
  fsPage: async ({ page }, use) => {
    await seedFs(page, {
      '/proj/a.md': '# File A\n',
      '/proj/b.md': '# File B\n',
    });
    await seedLastWatched(page);
    await page.goto('/');
    await use(page);
  },
});

async function makeDirty(page: Page): Promise<void> {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await editor.fill('# dirty edit\n');
}

test.describe('SPEC-FS-003 미저장 변경 가드 (AC-007/008/009/012/013)', () => {
  test('AC-013: dirty=false에서 파일 클릭 시 모달 없이 즉시 열린다', async ({ fsPage }) => {
    // 파일 트리가 렌더링될 때까지 대기
    await expect(fsPage.locator('[data-testid="file-tree-node"]')).toHaveCount(2, { timeout: 10_000 });

    // a.md 클릭 (dirty 아님)
    await fsPage.getByText('a.md').first().click();
    // 모달 없음
    await expect(fsPage.getByTestId('confirm-dialog')).toHaveCount(0);
  });

  test('AC-007: dirty=true에서 파일 클릭 시 3버튼 모달 표시', async ({ fsPage }) => {
    await expect(fsPage.locator('[data-testid="file-tree-node"]')).toHaveCount(2, { timeout: 10_000 });
    await fsPage.getByText('a.md').first().click();
    await makeDirty(fsPage);

    // b.md 클릭 → 모달
    await fsPage.getByText('b.md').first().click();
    await expect(fsPage.getByTestId('confirm-dialog')).toBeVisible({ timeout: 5_000 });
    await expect(fsPage.getByTestId('dialog-action-cancel')).toBeVisible();
    await expect(fsPage.getByTestId('dialog-action-discard')).toBeVisible();
    await expect(fsPage.getByTestId('dialog-action-save')).toBeVisible();
  });

  test('AC-008: discard 선택 시 새 파일이 즉시 열린다', async ({ fsPage }) => {
    await expect(fsPage.locator('[data-testid="file-tree-node"]')).toHaveCount(2, { timeout: 10_000 });
    await fsPage.getByText('a.md').first().click();
    await makeDirty(fsPage);
    await fsPage.getByText('b.md').first().click();
    await expect(fsPage.getByTestId('confirm-dialog')).toBeVisible({ timeout: 5_000 });

    await fsPage.getByTestId('dialog-action-discard').click();
    // 모달 닫힘
    await expect(fsPage.getByTestId('confirm-dialog')).toHaveCount(0);
    // 에디터에 b.md 내용 표시
    await expect(fsPage.locator('.cm-content')).toContainText('File B', { timeout: 5_000 });
  });

  test('AC-009: cancel 선택 시 에디터 내용 유지', async ({ fsPage }) => {
    await expect(fsPage.locator('[data-testid="file-tree-node"]')).toHaveCount(2, { timeout: 10_000 });
    await fsPage.getByText('a.md').first().click();
    await makeDirty(fsPage);
    await fsPage.getByText('b.md').first().click();
    await expect(fsPage.getByTestId('confirm-dialog')).toBeVisible({ timeout: 5_000 });

    await fsPage.getByTestId('dialog-action-cancel').click();
    await expect(fsPage.getByTestId('confirm-dialog')).toHaveCount(0);
    // dirty 편집 내용 유지 (File B로 덮어씌워지지 않음)
    await expect(fsPage.locator('.cm-content')).toContainText('dirty edit');
  });

  test('AC-012: 모달은 단일 인스턴스만 존재하며 discard 시 의도한 파일 1개만 열린다 (재진입 차단)', async ({ fsPage }) => {
    // 재진입 차단(REQ-024/025)의 관측 가능한 면:
    //  (1) 모달 백드롭(z-index 100)이 배경 클릭을 물리적으로 차단 — 두 번째 클릭이 트리에 닿지 않음.
    //  (2) 가드의 open 체크가 논리적으로 두 번째 requestGuardedAction를 폐기(단위 테스트 검증).
    //  (3) ConfirmDialog는 단일 인스턴스만 마운트되므로 중첩 모달이 구조적으로 불가능.
    // 여기서는 (3)+(관측 결과)를 검증 — 모달 열린 동안 ConfirmDialog가 정확히 1개이고,
    // discard 시 의도한 파일(b.md)만 열린다.
    await expect(fsPage.locator('[data-testid="file-tree-node"]')).toHaveCount(2, { timeout: 10_000 });
    await fsPage.getByText('a.md').first().click();
    await makeDirty(fsPage);

    await fsPage.getByText('b.md').first().click();
    await expect(fsPage.getByTestId('confirm-dialog')).toBeVisible({ timeout: 5_000 });
    // 모달은 정확히 1개 (중첩 불가)
    await expect(fsPage.getByTestId('confirm-dialog')).toHaveCount(1);

    await fsPage.getByTestId('dialog-action-discard').click();
    // b.md만 열림 (File B)
    await expect(fsPage.locator('.cm-content')).toContainText('File B', { timeout: 5_000 });
  });
});
