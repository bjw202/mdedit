import { test as base, expect, type Page } from '@playwright/test';

// SPEC-PREVIEW-008 E2E — 이미지/SVG 뷰어(줌·팬·토글)와 인라인 SVG XSS 미실행을 실제 브라우저에서 검증한다.
// Windows userAgent를 사용하여 convertFileSrc가 http://asset.localhost/ URL을 생성하도록 한다
// (app-render.spec.ts / html-file-viewer.spec.ts와 동일한 패턴).
const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function injectTauriMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
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
    (window as unknown as Record<string, unknown>).__TAURI__ = {
      core: { invoke: (_cmd: string) => Promise.resolve(null) },
      event: {
        listen: () => Promise.resolve(() => {}),
        emit: () => Promise.resolve(),
      },
    };
  });
}

const test = base.extend<{ tauriPage: Page }>({
  tauriPage: async ({ page }, use) => {
    await injectTauriMock(page);
    await use(page);
  },
});

// 1x1 투명 PNG (base64)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function setFileAndContent(page: Page, filePath: string, content: string): Promise<void> {
  await page.evaluate(
    async ({ filePath, content }: { filePath: string; content: string }) => {
      const fileMod = await import('/src/store/fileStore.ts');
      const editorMod = await import('/src/store/editorStore.ts');
      editorMod.useEditorStore.getState().setContent(content);
      fileMod.useFileStore.getState().setCurrentFile(filePath);
    },
    { filePath, content },
  );
}

test.describe('ImageFileViewer E2E (SPEC-PREVIEW-008 시나리오 A/B/C)', () => {
  test.use({ userAgent: WINDOWS_UA });

  test('.png 파일 선택 시 ImageFileViewer가 렌더되고 zoom 컨트롤이 동작한다', async ({ tauriPage }) => {
    await tauriPage.route('http://asset.localhost/**', async (route) => {
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(TINY_PNG_BASE64, 'base64'),
        status: 200,
      });
    });

    await tauriPage.goto('/');
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 15_000 });

    await setFileAndContent(tauriPage, 'C:/test/logo.png', '');

    const viewer = tauriPage.locator('[data-testid="image-file-viewer"]');
    await expect(viewer).toBeVisible({ timeout: 8000 });

    const img = tauriPage.locator('[data-testid="image-file-viewer-img"]');
    await expect(img).toHaveAttribute('data-zoom-mode', 'fit');

    // 100% 버튼 → custom 모드, scale=1
    await tauriPage.locator('[data-testid="image-zoom-100"]').click();
    await expect(img).toHaveAttribute('data-zoom-mode', 'custom');
    await expect(img).toHaveAttribute('data-scale', '1');

    // 줌인 → scale 증가
    await tauriPage.locator('[data-testid="image-zoom-in"]').click();
    const scaleAfterZoomIn = await img.getAttribute('data-scale');
    expect(Number(scaleAfterZoomIn)).toBeGreaterThan(1);

    // 체커보드 컨테이너 존재
    await expect(tauriPage.locator('[data-testid="image-checkerboard"]')).toBeVisible();
  });
});

test.describe('SvgFileViewer E2E (SPEC-PREVIEW-008 시나리오 D/E/F, must-pass)', () => {
  test.use({ userAgent: WINDOWS_UA });

  const NORMAL_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>';

  test('.svg 파일 선택 시 렌더 뷰가 기본이며 소스 토글이 동작한다 (시나리오 D)', async ({ tauriPage }) => {
    await tauriPage.goto('/');
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 15_000 });

    await setFileAndContent(tauriPage, 'C:/test/icon.svg', NORMAL_SVG);

    const renderCanvas = tauriPage.locator('[data-testid="svg-render-canvas"]');
    await expect(renderCanvas).toBeVisible({ timeout: 8000 });
    await expect(tauriPage.locator('[data-testid="svg-render-content"] circle')).toBeVisible();

    // 소스 토글
    await tauriPage.locator('[data-testid="svg-view-source"]').click();
    await expect(renderCanvas).toBeHidden();

    // 다시 렌더 토글
    await tauriPage.locator('[data-testid="svg-view-render"]').click();
    await expect(renderCanvas).toBeVisible();
  });

  test('evil.svg의 <script>/onload가 실행되지 않는다 (시나리오 F, must-pass 보안)', async ({ tauriPage }) => {
    const evilSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__e2eXssFlag = true">' +
      '<script>window.__e2eXssFlag = true;</script><rect width="1" height="1" /></svg>';

    await tauriPage.goto('/');
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 15_000 });

    await tauriPage.evaluate(() => {
      (window as unknown as Record<string, unknown>).__e2eXssFlag = undefined;
    });

    await setFileAndContent(tauriPage, 'C:/test/evil.svg', evilSvg);

    const renderContent = tauriPage.locator('[data-testid="svg-render-content"]');
    await expect(renderContent).toBeVisible({ timeout: 8000 });

    // DOM에 <script> 노드가 없어야 한다
    expect(await renderContent.locator('script').count()).toBe(0);

    // 위험하지 않은 도형(rect)은 유지되어야 한다
    await expect(renderContent.locator('rect')).toBeVisible();

    // 전역 부작용이 없어야 한다 (스크립트 미실행)
    const flag = await tauriPage.evaluate(
      () => (window as unknown as Record<string, unknown>).__e2eXssFlag,
    );
    expect(flag).toBeUndefined();
  });
});

test.describe('인라인 마크다운 SVG + 일반 HTML 차단 E2E (SPEC-PREVIEW-008 시나리오 G, must-pass)', () => {
  test.use({ userAgent: WINDOWS_UA });

  test('본문의 <svg>는 렌더되고 <script>는 실행되지 않는다', async ({ tauriPage }) => {
    await tauriPage.goto('/');
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 15_000 });

    await tauriPage.evaluate(() => {
      (window as unknown as Record<string, unknown>).__e2eInlineXssFlag = undefined;
    });

    const content = [
      '# Inline SVG + HTML',
      '',
      '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4" /></svg>',
      '',
      '<script>window.__e2eInlineXssFlag = true;</script>',
      '',
      '일반 텍스트',
    ].join('\n');

    const editor = tauriPage.locator('.cm-content');
    await editor.click();
    await tauriPage.keyboard.press('ControlOrMeta+A');
    await editor.fill(content);

    await expect(tauriPage.locator('.preview-content svg circle')).toBeVisible({ timeout: 8000 });
    expect(await tauriPage.locator('.preview-content script').count()).toBe(0);

    const flag = await tauriPage.evaluate(
      () => (window as unknown as Record<string, unknown>).__e2eInlineXssFlag,
    );
    expect(flag).toBeUndefined();
  });
});
