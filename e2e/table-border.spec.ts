import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures/tauri-mock';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_CONTENT = readFileSync(
  join(__dirname, 'fixtures/test-content.md'),
  'utf-8'
);

// REQ-E2E-003: Table border visual verification
test.describe('Table border rendering (REQ-E2E-003)', () => {
  test.beforeEach(async ({ tauriPage }) => {
    await tauriPage.goto('/');

    // Wait for editor to be ready
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 10_000 });

    // Inject fixture content into CodeMirror editor
    const editor = tauriPage.locator('.cm-content');
    await editor.click();
    await tauriPage.keyboard.press('ControlOrMeta+A');
    await editor.fill(FIXTURE_CONTENT);

    // Wait for table to render in preview
    await tauriPage.waitForSelector('.preview-content td', { timeout: 5_000 });
  });

  test('td has 1px right border (WebKit border-collapse fix)', async ({ tauriPage }) => {
    const borderRight = await tauriPage.evaluate(() => {
      const td = document.querySelector('.preview-content td');
      if (!td) return null;
      return window.getComputedStyle(td).borderRightWidth;
    });
    expect(borderRight).toBe('1px');
  });

  test('td has 1px bottom border', async ({ tauriPage }) => {
    const borderBottom = await tauriPage.evaluate(() => {
      const td = document.querySelector('.preview-content td');
      if (!td) return null;
      return window.getComputedStyle(td).borderBottomWidth;
    });
    expect(borderBottom).toBe('1px');
  });

  test('th has 1px right border', async ({ tauriPage }) => {
    const borderRight = await tauriPage.evaluate(() => {
      const th = document.querySelector('.preview-content th');
      if (!th) return null;
      return window.getComputedStyle(th).borderRightWidth;
    });
    expect(borderRight).toBe('1px');
  });

  // src/index.css:212-220: horizontal scroll ownership is platform-branched by design.
  // Windows/WebView2 -> `.table-scroll-wrapper` owns overflow-x (Chromium clips at the
  // scroll container it is given, so the wrapper itself must be the scroll container).
  // macOS/WKWebView  -> the wrapper has no overflow-x of its own; the parent `.preview-scroll`
  // panel owns the horizontal scroll instead (src/index.css:107-116).
  // We branch on the REAL `data-platform` attribute the app set (src/App.tsx:26-30) rather
  // than forcing it, so each platform's actually-shipped contract is what gets verified.
  // This webkit e2e project emulates macOS Safari, so in practice this always exercises the
  // non-Windows branch here; the Windows branch exists for when this suite runs on real Windows CI.
  test('horizontal scroll container matches the platform-specific contract', async ({
    tauriPage,
  }) => {
    const platform = await tauriPage.evaluate(() =>
      document.documentElement.getAttribute('data-platform')
    );

    if (platform === 'windows') {
      // Windows contract: `.table-scroll-wrapper` itself is `overflow-x: auto|scroll`.
      const overflowX = await tauriPage.evaluate(() => {
        const wrapper = document.querySelector('.table-scroll-wrapper');
        if (!wrapper) return null;
        return window.getComputedStyle(wrapper).overflowX;
      });
      expect(['auto', 'scroll']).toContain(overflowX);
    } else {
      // macOS/WKWebView contract: the wrapper does not scroll itself; `.preview-scroll`
      // (the panel that wraps the whole preview) is the real horizontal scroll container.
      const overflowX = await tauriPage.evaluate(() => {
        const scrollPanel = document.querySelector('.preview-scroll');
        if (!scrollPanel) return null;
        return window.getComputedStyle(scrollPanel).overflowX;
      });
      expect(['auto', 'scroll']).toContain(overflowX);
    }
  });

  test('wide table triggers horizontal scroll in wrapper', async ({ tauriPage }) => {
    // The fixture table has 10 columns with long cell text - it should overflow the preview panel
    const canScroll = await tauriPage.evaluate(() => {
      const wrapper = document.querySelector('.preview-content .table-scroll-wrapper') as HTMLElement;
      if (!wrapper) return false;
      return wrapper.scrollWidth > wrapper.clientWidth;
    });
    expect(canScroll).toBe(true);
  });

  // Same platform split as the test above: whichever element actually owns horizontal
  // scroll (`.table-scroll-wrapper` on Windows, `.preview-scroll` on macOS/WKWebView) is the
  // container whose right edge the last td's border must respect once scrolled fully right.
  test('last td right border is not clipped by the real scroll container', async ({
    tauriPage,
  }) => {
    // This test verifies the WebKit border-collapse + overflow-x clipping bug is fixed.
    // When the bug is present, the right border of the last cell is clipped at the
    // container boundary and visually invisible even though getComputedStyle returns '1px'.
    const platform = await tauriPage.evaluate(() =>
      document.documentElement.getAttribute('data-platform')
    );

    const isVisible = await tauriPage.evaluate((isWindows) => {
      const lastTd = document.querySelector(
        '.preview-content tr:first-child td:last-child'
      ) as HTMLElement;
      if (!lastTd) return false;

      // Windows: `.table-scroll-wrapper` is the scroll container. macOS: `.preview-scroll`
      // (the whole preview panel) is the scroll container instead (src/index.css:212-220).
      const scrollContainer = (
        isWindows
          ? document.querySelector('.preview-content .table-scroll-wrapper')
          : document.querySelector('.preview-scroll')
      ) as HTMLElement;
      if (!scrollContainer) return false;

      // Scroll the real container to the far right so the last column is in view
      scrollContainer.scrollLeft = scrollContainer.scrollWidth;

      const containerRect = scrollContainer.getBoundingClientRect();
      const tdRect = lastTd.getBoundingClientRect();

      // The right edge of the last td must be within (or at) the container's right edge.
      // A 2px tolerance accounts for subpixel rendering differences.
      // If tdRight > containerRect.right + 2, the border is being clipped by the container.
      return tdRect.right <= containerRect.right + 2;
    }, platform === 'windows');
    expect(isVisible).toBe(true);
  });
});
