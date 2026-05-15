import { test as base, expect, type Page } from '@playwright/test';

// Windows userAgent를 사용하여 convertFileSrc가 http://asset.localhost/ URL을 생성하도록 한다.
// convertFileSrc는 navigator.userAgent.includes('Windows') 여부로 프로토콜을 결정한다.
const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// __TAURI_INTERNALS__.convertFileSrc 구현:
// 실제 Tauri v2 런타임이 하는 것과 동일하게 Windows UA 여부에 따라
// http://asset.localhost/... 또는 asset://localhost/... URL을 반환한다.
function tauriInternalsConvertFileSrc(filePath: string, protocol: string): string {
  const isWindows = navigator.userAgent.includes('Windows');
  // 백슬래시를 슬래시로 정규화
  const normalized = filePath.replace(/\\/g, '/');
  const encoded = encodeURIComponent(normalized);
  if (isWindows) {
    return `http://${protocol}.localhost/${encoded}`;
  }
  return `${protocol}://localhost/${encoded}`;
}

async function injectTauriMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Tauri v2 core API: window.__TAURI_INTERNALS__ 모의 객체
    // convertFileSrc가 이 객체를 통해 URL을 생성한다.
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      convertFileSrc: (filePath: string, protocol = 'asset'): string => {
        const isWindows = navigator.userAgent.includes('Windows');
        const normalized = filePath.replace(/\\/g, '/');
        const encoded = encodeURIComponent(normalized);
        if (isWindows) {
          return `http://${protocol}.localhost/${encoded}`;
        }
        return `${protocol}://localhost/${encoded}`;
      },
      invoke: (_cmd: string) => Promise.resolve(null),
      metadata: {},
    };

    // Tauri v2 legacy: window.__TAURI__ (event/path API 등에 필요)
    (window as unknown as Record<string, unknown>).__TAURI__ = {
      core: { invoke: (_cmd: string) => Promise.resolve(null) },
      event: {
        listen: () => Promise.resolve(() => {}),
        emit: () => Promise.resolve(),
      },
    };
  });
}

// __TAURI_INTERNALS__ 를 포함한 확장 fixture
const test = base.extend<{ tauriPage: Page }>({
  tauriPage: async ({ page }, use) => {
    await injectTauriMock(page);
    await use(page);
  },
});

// tauriInternalsConvertFileSrc는 브라우저 context 외부이므로 직접 사용하지 않음.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
void tauriInternalsConvertFileSrc;

test.describe('HtmlFileViewer E2E', () => {
  test.use({ userAgent: WINDOWS_UA });

  test('HTML 파일 선택 시 iframe이 렌더링된다', async ({ tauriPage }) => {
    // asset.localhost 요청을 인터셉트하여 실제 파일 없이도 iframe src가 로드되도록 한다.
    await tauriPage.route('http://asset.localhost/**', async (route) => {
      await route.fulfill({
        contentType: 'text/html',
        body: '<html><body><h1>Test HTML</h1></body></html>',
        status: 200,
      });
    });

    await tauriPage.goto('/');
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 15_000 });

    // fileStore.currentFile을 .html 경로로 설정하여 HtmlFileViewer가 마운트되도록 한다.
    await tauriPage.evaluate(async (filePath: string) => {
      const mod = await import('/src/store/fileStore.ts');
      mod.useFileStore.getState().setCurrentFile(filePath);
    }, 'C:/test/page.html');

    // iframe이 DOM에 나타날 때까지 대기한다.
    const iframe = tauriPage.locator('[data-testid="html-preview-iframe"]');
    await expect(iframe).toBeVisible({ timeout: 8000 });

    // 오류 UI("HTML 로드 오류")가 표시되지 않아야 한다.
    await expect(tauriPage.getByText('HTML 로드 오류')).not.toBeVisible();
  });

  test('iframe src에 %5C(백슬래시)가 없다', async ({ tauriPage }) => {
    await tauriPage.route('http://asset.localhost/**', async (route) => {
      await route.fulfill({
        contentType: 'text/html',
        body: '<html><body><h1>Test HTML</h1></body></html>',
        status: 200,
      });
    });

    await tauriPage.goto('/');
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 15_000 });

    // Windows 백슬래시를 포함한 경로로 설정한다.
    await tauriPage.evaluate(async (filePath: string) => {
      const mod = await import('/src/store/fileStore.ts');
      mod.useFileStore.getState().setCurrentFile(filePath);
    }, 'C:\\test\\page.html');

    const iframe = tauriPage.locator('[data-testid="html-preview-iframe"]');
    await expect(iframe).toBeVisible({ timeout: 8000 });

    // iframe src 속성에 %5C(인코딩된 백슬래시)가 없어야 한다.
    const src = await iframe.getAttribute('src');
    expect(src).not.toBeNull();
    expect(src!.toLowerCase()).not.toContain('%5c');
  });

  test('iframe src가 http://asset.localhost/ 형식이다 (Windows UA)', async ({ tauriPage }) => {
    await tauriPage.route('http://asset.localhost/**', async (route) => {
      await route.fulfill({
        contentType: 'text/html',
        body: '<html><body><h1>Test HTML</h1></body></html>',
        status: 200,
      });
    });

    await tauriPage.goto('/');
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 15_000 });

    await tauriPage.evaluate(async (filePath: string) => {
      const mod = await import('/src/store/fileStore.ts');
      mod.useFileStore.getState().setCurrentFile(filePath);
    }, 'C:/test/page.html');

    const iframe = tauriPage.locator('[data-testid="html-preview-iframe"]');
    await expect(iframe).toBeVisible({ timeout: 8000 });

    // Windows UA에서 convertFileSrc는 http://asset.localhost/ 형식의 URL을 반환해야 한다.
    const src = await iframe.getAttribute('src');
    expect(src).not.toBeNull();
    expect(src!.startsWith('http://asset.localhost/')).toBe(true);
  });
});
