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

test('DIAGNOSTIC: dump table rendering state', async ({ tauriPage }) => {
  await tauriPage.goto('/');
  await tauriPage.locator('.cm-editor').waitFor({ timeout: 10_000 });

  const editor = tauriPage.locator('.cm-content');
  await editor.click();
  await tauriPage.keyboard.press('ControlOrMeta+A');
  await editor.fill(FIXTURE_CONTENT);

  await tauriPage.waitForSelector('.preview-content td', { timeout: 5_000 });

  // Dump full rendering state
  const state = await tauriPage.evaluate(() => {
    const wrapper = document.querySelector('.preview-content .table-scroll-wrapper') as HTMLElement;
    const table = wrapper?.querySelector('table') as HTMLElement;
    const firstTd = document.querySelector('.preview-content td') as HTMLElement;
    const lastTdInRow = wrapper?.querySelector('tr:first-child td:last-child') as HTMLElement;
    const previewContent = document.querySelector('.preview-content') as HTMLElement;
    const previewPanel = previewContent?.parentElement as HTMLElement; // MarkdownPreview div

    if (!wrapper || !table) return { error: 'wrapper or table not found' };

    return {
      // Viewport
      viewportWidth: window.innerWidth,

      // Preview panel (MarkdownPreview div)
      previewPanel: {
        clientWidth: previewPanel?.clientWidth,
        overflowX: window.getComputedStyle(previewPanel).overflowX,
        overflowY: window.getComputedStyle(previewPanel).overflowY,
        className: previewPanel?.className,
      },

      // .preview-content
      previewContent: {
        clientWidth: previewContent.clientWidth,
        scrollWidth: previewContent.scrollWidth,
        overflowX: window.getComputedStyle(previewContent).overflowX,
      },

      // .table-scroll-wrapper
      wrapper: {
        clientWidth: wrapper.clientWidth,
        scrollWidth: wrapper.scrollWidth,
        overflowX: window.getComputedStyle(wrapper).overflowX,
        paddingRight: window.getComputedStyle(wrapper).paddingRight,
        boundingRect: wrapper.getBoundingClientRect(),
      },

      // table
      table: {
        clientWidth: table.clientWidth,
        scrollWidth: table.scrollWidth,
        offsetWidth: table.offsetWidth,
        style: table.getAttribute('style'),
        computedWidth: window.getComputedStyle(table).width,
        computedMinWidth: window.getComputedStyle(table).minWidth,
        computedBorderCollapse: window.getComputedStyle(table).borderCollapse,
      },

      // First td
      firstTd: {
        borderRightWidth: window.getComputedStyle(firstTd).borderRightWidth,
        borderRightStyle: window.getComputedStyle(firstTd).borderRightStyle,
        borderRightColor: window.getComputedStyle(firstTd).borderRightColor,
      },

      // Last td in first row
      lastTd: lastTdInRow ? {
        borderRightWidth: window.getComputedStyle(lastTdInRow).borderRightWidth,
        rect: lastTdInRow.getBoundingClientRect(),
      } : null,

      // Does table overflow wrapper?
      tableOverflows: wrapper.scrollWidth > wrapper.clientWidth,

      // All ancestor overflow values
      ancestorOverflows: (() => {
        const result: Array<{ tag: string; class: string; overflowX: string; overflowY: string; width: number }> = [];
        let el: HTMLElement | null = wrapper;
        while (el && result.length < 8) {
          const cs = window.getComputedStyle(el);
          result.push({
            tag: el.tagName,
            class: el.className?.substring(0, 60),
            overflowX: cs.overflowX,
            overflowY: cs.overflowY,
            width: el.clientWidth,
          });
          el = el.parentElement;
        }
        return result;
      })(),
    };
  });

  console.log('=== TABLE RENDERING DIAGNOSTIC ===');
  console.log(JSON.stringify(state, null, 2));

  // This test always passes - it's for diagnostic output only
  expect(state).toBeTruthy();
});
