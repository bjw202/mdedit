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
void tauriInternalsConvertFileSrc;

test.describe('HtmlFileViewer E2E', () => {
  test.use({ userAgent: WINDOWS_UA });

  // SPEC-PREVIEW-019/020: 기본 렌더 모드는 OS에 따라 달라지므로, 아래 asset iframe 시나리오는
  // 원본 보기 모드를 저장소(영속 버전 2)에 시드해서 실행한다. 선명 모드는 파일 하단의 별도 describe가 시험한다.
  test.beforeEach(async ({ tauriPage }) => {
    await tauriPage.addInitScript(() => {
      localStorage.setItem(
        'mdedit-ui-store',
        JSON.stringify({ state: { htmlRenderMode: 'original' }, version: 2 }),
      );
    });
  });

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

// ---- SPEC-PREVIEW-019 (AC-015 부분 증거): 선명 모드 srcdoc ----
// Playwright WebKit의 부분 증거다. WKWebView·WebView2 실기기 증거가 아니다(수동 M-5).
test.describe('HtmlFileViewer E2E — 선명 모드 (SPEC-PREVIEW-019)', () => {
  test.use({ userAgent: WINDOWS_UA });

  const PAGE_HTML =
    '<!doctype html><html><head><title>t</title></head><body><h1>Crisp</h1>' +
    '<script>document.body.setAttribute("data-page-script","ran")</script></body></html>';

  test.beforeEach(async ({ tauriPage }) => {
    // SPEC-PREVIEW-020: 기본값이 OS에 따라 달라지므로 선명 모드를 명시 시드한다(영속 버전 2).
    //   WINDOWS_UA가 navigator.platform까지 바꾸는지는 확인하지 않았으므로 이 시드로 의존을 끊는다.
    await tauriPage.addInitScript(() => {
      localStorage.setItem(
        'mdedit-ui-store',
        JSON.stringify({ state: { htmlRenderMode: 'crisp' }, version: 2 }),
      );
    });
    // read_file / read_file_size만 응답하도록 invoke 모의를 덧씌운다(나머지는 기존 모의 그대로).
    await tauriPage.addInitScript((html: string) => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a?: unknown) => Promise<unknown> } })
        .__TAURI_INTERNALS__;
      const original = internals.invoke;
      internals.invoke = (cmd: string, args?: unknown) => {
        if (cmd === 'read_file') return Promise.resolve(html);
        if (cmd === 'read_file_size') return Promise.resolve(html.length);
        return original(cmd, args);
      };
    }, PAGE_HTML);
  });

  test('해시 스크립트가 실행되어 배율이 적용되고 페이지 인라인 스크립트는 막힌다', async ({ tauriPage }) => {
    const consoleMessages: string[] = [];
    tauriPage.on('console', (m) => consoleMessages.push(m.text()));

    await tauriPage.goto('/');
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 15_000 });
    await tauriPage.evaluate(async (filePath: string) => {
      const mod = await import('/src/store/fileStore.ts');
      mod.useFileStore.getState().setCurrentFile(filePath);
    }, 'C:/test/page.html');

    const iframe = tauriPage.locator('[data-testid="html-preview-iframe"]');
    await expect(iframe).toBeVisible({ timeout: 8000 });
    expect(await iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(await iframe.getAttribute('src')).toBeNull();

    const handle = await iframe.elementHandle();
    const frame = await handle!.contentFrame();
    expect(frame).not.toBeNull();
    await frame!.waitForLoadState('load');

    await tauriPage.getByLabel('Zoom in').click();
    await expect
      .poll(() => frame!.evaluate(() => document.documentElement.style.zoom), { timeout: 5000 })
      .toBe('1.1');

    // 페이지 자체 인라인 스크립트는 상속된 CSP(script-src)가 막는다.
    expect(await frame!.evaluate(() => document.body.getAttribute('data-page-script'))).toBeNull();
    expect(consoleMessages.some((t) => /script-src|Content Security Policy|Refused to execute/i.test(t))).toBe(true);
  });
});

// ---- SPEC-PREVIEW-021 (AC-012 부분 증거): 선명 모드 mermaid 미리 그리기 ----
// Playwright WebKit의 부분 증거다. WKWebView·WebView2 실기기 증거가 아니다(수동 M-1·M-2).
test.describe('HtmlFileViewer E2E — mermaid 미리 그리기 (SPEC-PREVIEW-021)', () => {
  test.use({ userAgent: WINDOWS_UA });

  // 성공 1(pre), 실패 1(div, 기존 오류 픽스처 21-error-line-col), 범위 밖 형식 1(code.language-mermaid)
  const MERMAID_PAGE_HTML =
    '<!doctype html><html><head><title>t</title></head><body>' +
    '<pre class="mermaid">flowchart LR\n  A --&gt; B</pre>' +
    '<div class="mermaid">sequenceDiagram\n  A-&gt;&gt;B hello</div>' +
    '<pre><code class="language-mermaid">flowchart LR\n  X --&gt; Y</code></pre>' +
    '<script>document.body.setAttribute("data-page-script","ran")</script></body></html>';

  test.beforeEach(async ({ tauriPage }) => {
    await tauriPage.addInitScript(() => {
      localStorage.setItem(
        'mdedit-ui-store',
        JSON.stringify({ state: { htmlRenderMode: 'crisp' }, version: 2 }),
      );
    });
    await tauriPage.addInitScript((html: string) => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a?: unknown) => Promise<unknown> } })
        .__TAURI_INTERNALS__;
      const original = internals.invoke;
      internals.invoke = (cmd: string, args?: unknown) => {
        if (cmd === 'read_file') return Promise.resolve(html);
        if (cmd === 'read_file_size') return Promise.resolve(html.length);
        return original(cmd, args);
      };
    }, MERMAID_PAGE_HTML);
  });

  test('성공 블록은 SVG로, 실패 블록은 원문 + 안내로, 범위 밖 형식은 그대로 보인다', async ({ tauriPage }) => {
    await tauriPage.goto('/');
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 15_000 });
    await tauriPage.evaluate(async (filePath: string) => {
      const mod = await import('/src/store/fileStore.ts');
      mod.useFileStore.getState().setCurrentFile(filePath);
    }, 'C:/test/page.html');

    const iframe = tauriPage.locator('[data-testid="html-preview-iframe"]');
    await expect(iframe).toBeVisible({ timeout: 8000 });
    expect(await iframe.getAttribute('sandbox')).toBe('allow-scripts');

    const handle = await iframe.elementHandle();
    const frame = await handle!.contentFrame();
    expect(frame).not.toBeNull();
    await frame!.waitForLoadState('load');

    await expect(frame!.locator('[data-mdedit-diagram] svg')).toHaveCount(1);
    await expect(frame!.locator('[data-mdedit-diagram-error]')).toHaveCount(1);
    await expect(frame!.locator('[data-mdedit-diagram-error]')).toContainText('그릴 수 없었습니다');
    await expect(frame!.locator('code.language-mermaid')).toContainText('X --> Y');
    // 019 동작 유지: 페이지 자체 스크립트는 실행되지 않는다.
    expect(await frame!.evaluate(() => document.body.getAttribute('data-page-script'))).toBeNull();
  });
});
