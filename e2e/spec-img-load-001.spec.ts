// @MX:SPEC: SPEC-IMG-LOAD-001
// E2E (Playwright must-pass):
//   PT-A1: inline-blob + 미저장 문서에서 이미지 버튼 클릭 시 Save-As 다이얼로그 없이
//          이미지 피커가 직접 열린다 (REQ-IMG-LOAD-A-001, jsdom blind spot: 다이얼로그 UX).
//   PT-B4: 접힌 폴더 내 대용량 .md 파일 오픈 시 UI 동결 없이 UnsupportedFileViewer 가 렌더링된다
//          (REQ-IMG-LOAD-B-004, jsdom blind spot: main-thread 동결 관측).
//
// Tauri 런타임이 없으므로 window.__TAURI_INTERNALS__.invoke 를 가상 FS 핸들러로 주입한다
// (e2e/fixtures/tauri-mock.ts 패턴). 다이얼로그 자체는 OS 네이티브이므로 Playwright 관측 밖 —
// invoke payload(save_file_as / open_image_dialog) 호출 여부로 단언한다.

import { test as base, expect, type Page } from '@playwright/test';
import { injectTauriMock } from './fixtures/tauri-mock';

// ---- PT-A1: inline-blob + 미저장 → Save-As 스킵 ----

async function seedInlineBlobUnsaved(page: Page): Promise<void> {
  // imageInsertMode = inline-blob (기본값이지만 명시), currentFilePath = null(미저장) 보장.
  // lastWatchedPath 를 비워 폴더 자동 복원이 일어나지 않게(미저장 상태 유지).
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
          lastWatchedPath: null,
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

  // save_file_as / open_image_dialog / read_image_as_base64 호출 추적 핸들러 주입.
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__SAVE_AS_CALLS__ = [];
    (window as unknown as Record<string, unknown>).__OPEN_IMAGE_CALLS__ = [];
    const ext: Record<string, (a: Record<string, unknown>) => unknown> = {
      save_file_as: (args) => {
        (window as unknown as { __SAVE_AS_CALLS__: unknown[] }).__SAVE_AS_CALLS__.push(args);
        return '/tmp/phantom-saved.md'; // graceful: 사용자가 저장했다고 가정
      },
      open_image_dialog: (args) => {
        (window as unknown as { __OPEN_IMAGE_CALLS__: unknown[] }).__OPEN_IMAGE_CALLS__.push(args);
        return '/tmp/photo.png'; // 이미지 피커가 파일을 선택했다고 가정
      },
      read_image_as_base64: () => 'data:image/png;base64,iVBORw0KGgo=',
      copy_image_to_folder: () => './images/photo.png',
      save_image_from_clipboard: () => './images/clipboard.png',
    };
    const holder = (
      window as unknown as { __TAURI_MOCK_HANDLERS__?: Record<string, (a: Record<string, unknown>) => unknown> }
    ).__TAURI_MOCK_HANDLERS__;
    if (holder) {
      for (const [k, v] of Object.entries(ext)) holder[k] = v;
    }
  });
}

const ptA1 = base.extend<{ unsavedPage: Page }>({
  unsavedPage: async ({ page }, use) => {
    await injectTauriMock(page); // graceful base mock
    await seedInlineBlobUnsaved(page);
    await page.goto('/');
    await use(page);
  },
});

ptA1.describe('SPEC-IMG-LOAD-001 PT-A1: inline-blob + 미저장 → Save-As 스킵 (REQ-A-001)', () => {
  ptA1('이미지 버튼 클릭 → save_file_as 미호출, open_image_dialog 호출', async ({ unsavedPage }) => {
    // 에디터 대기
    await expect(unsavedPage.locator('.cm-editor')).toBeVisible({ timeout: 10_000 });

    // 이미지 버튼 클릭
    const imageBtn = unsavedPage.getByRole('button', { name: /insert image/i });
    await expect(imageBtn).toBeVisible();
    await imageBtn.click();

    // 잠시 대기 (invoke 마이크로태스크 flush)
    await unsavedPage.waitForTimeout(500);

    // save_file_as 는 한 번도 호출되지 않아야 한다 (REQ-A-001 핵심)
    const saveAsCalls = await unsavedPage.evaluate(() => {
      return (window as unknown as { __SAVE_AS_CALLS__: unknown[] }).__SAVE_AS_CALLS__.length;
    });
    expect(saveAsCalls).toBe(0);

    // 이미지 피커(open_image_dialog)는 호출되어야 한다
    const openImageCalls = await unsavedPage.evaluate(() => {
      return (window as unknown as { __OPEN_IMAGE_CALLS__: unknown[] }).__OPEN_IMAGE_CALLS__.length;
    });
    expect(openImageCalls).toBe(1);
  });
});

// ---- PT-B4: 접힌 폴더 + 대용량 파일 → UI 동결 없이 UnsupportedFileViewer ----

async function seedCollapsedLargeFile(page: Page): Promise<void> {
  // lastWatchedPath = /proj (자동 복원), imageInsertMode = inline-blob
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

  // 완전 자체 Mock: injectTauriMock 의 base 핸들러가 read_directory 에 size 를 항상 채우므로,
  // 접힌 폴더(size=undefined) 시나리오를 만들기 위해 __TAURI_INTERNALS__ 를 통째로 교체한다.
  // addInitScript 는 FIFO 로 실행되므로 injectTauriMock 보다 나중에 실행되어 덮어쓴다.
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__READ_FILE_CALLS__ = [];
    (window as unknown as Record<string, unknown>).__READ_FILE_SIZE_CALLS__ = [];

    const tree = [
      { name: 'small.md', path: '/proj/small.md', isDirectory: false, size: 100 },
      // huge.md: 접힌 폴더 시나리오 — FileNode.size 가 undefined (read_file_size 로만 알 수 있음)
      { name: 'huge.md', path: '/proj/huge.md', isDirectory: false, size: undefined },
    ];

    const invoke = (cmd: string, args: Record<string, unknown>): Promise<unknown> => {
      switch (cmd) {
        case 'read_directory':
          return Promise.resolve(tree);
        case 'read_file_size': {
          (window as unknown as { __READ_FILE_SIZE_CALLS__: Array<Record<string, unknown>> }).__READ_FILE_SIZE_CALLS__.push(args);
          return Promise.resolve(6 * 1024 * 1024); // 6MB > FILE_SIZE_THRESHOLD
        }
        case 'read_file': {
          (window as unknown as { __READ_FILE_CALLS__: Array<Record<string, unknown>> }).__READ_FILE_CALLS__.push(args);
          return Promise.reject(new Error('should not be called for too-large file'));
        }
        case 'start_watch':
        case 'stop_watch':
        case 'register_asset_scope':
          return Promise.resolve(null);
        default:
          return Promise.resolve(null);
      }
    };

    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      invoke,
      convertFileSrc: (filePath: string) => `asset://localhost/${encodeURIComponent(filePath)}`,
      metadata: { currentWindow: { label: 'main' } },
      transformCallback: () => 0,
    };
    (window as unknown as Record<string, unknown>).__TAURI__ = {
      core: { invoke },
      event: {
        listen: () => Promise.resolve(() => undefined),
        emit: () => Promise.resolve(),
      },
    };
  });
}

const ptB4 = base.extend<{ largeFilePage: Page }>({
  largeFilePage: async ({ page }, use) => {
    await injectTauriMock(page); // base mock (나중에 seedCollapsedLargeFile 이 덮어씀)
    await seedCollapsedLargeFile(page);
    await page.goto('/');
    await use(page);
  },
});

ptB4.describe('SPEC-IMG-LOAD-001 PT-B4: 접힌 폴더 대용량 파일 → UnsupportedFileViewer (REQ-B-004)', () => {
  ptB4('huge.md 클릭 → 5초 이내 UnsupportedFileViewer 렌더링, readFile 미호출', async ({ largeFilePage }) => {
    // 파일 트리 렌더 대기
    await expect(largeFilePage.locator('[data-testid="file-tree-node"]'))
      .toHaveCount(2, { timeout: 10_000 });

    // huge.md 클릭
    await largeFilePage.getByText('huge.md').first().click({ timeout: 10_000 });

    // 5초 이내 UnsupportedFileViewer 가 나타나야 한다 (UI 동결 없음).
    // data-testid="unsupported-file-viewer" 는 UnsupportedFileViewer.tsx 의 실제 testid.
    await expect(
      largeFilePage.locator('[data-testid="unsupported-file-viewer"]')
    ).toBeVisible({ timeout: 5_000 });

    // read_file 은 한 번도 호출되지 않아야 한다 (too-large 가드가 readFile 을 회피)
    const readFileCalls = await largeFilePage.evaluate(() => {
      return (window as unknown as { __READ_FILE_CALLS__: unknown[] }).__READ_FILE_CALLS__.length;
    });
    expect(readFileCalls).toBe(0);

    // read_file_size 는 huge.md 에 대해 호출되었어야 한다 (접힌 폴더 보호, REQ-B-004)
    const readSizeCalls = await largeFilePage.evaluate(() => {
      return (window as unknown as { __READ_FILE_SIZE_CALLS__: Array<{ path?: string }> }).__READ_FILE_SIZE_CALLS__;
    });
    expect(readSizeCalls.some((c) => c.path === '/proj/huge.md')).toBe(true);
  });
});
