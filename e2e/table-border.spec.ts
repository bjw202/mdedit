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

  test('table-scroll-wrapper has overflow-x: auto or scroll', async ({ tauriPage }) => {
    const overflowX = await tauriPage.evaluate(() => {
      const wrapper = document.querySelector('.table-scroll-wrapper');
      if (!wrapper) return null;
      return window.getComputedStyle(wrapper).overflowX;
    });
    expect(['auto', 'scroll']).toContain(overflowX);
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

  test('last td right border is not clipped by overflow container', async ({ tauriPage }) => {
    // This test verifies the WebKit border-collapse + overflow-x:auto clipping bug is fixed.
    // When the bug is present, the right border of the last cell is clipped at the
    // container boundary and visually invisible even though getComputedStyle returns '1px'.
    const isVisible = await tauriPage.evaluate(() => {
      const wrapper = document.querySelector('.preview-content .table-scroll-wrapper') as HTMLElement;
      const lastTd = wrapper?.querySelector('tr:first-child td:last-child') as HTMLElement;
      if (!wrapper || !lastTd) return false;

      // Scroll the wrapper to the far right so the last column is in view
      wrapper.scrollLeft = wrapper.scrollWidth;

      const wrapperRect = wrapper.getBoundingClientRect();
      const tdRect = lastTd.getBoundingClientRect();

      // The right edge of the last td must be within (or at) the wrapper's right edge.
      // A 2px tolerance accounts for subpixel rendering differences.
      // If tdRight > wrapperRect.right + 2, the border is being clipped by the container.
      return tdRect.right <= wrapperRect.right + 2;
    });
    expect(isVisible).toBe(true);
  });
});
