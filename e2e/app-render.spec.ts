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

// REQ-E2E-004: App smoke test
test.describe('App basic rendering (REQ-E2E-004)', () => {
  test('renders editor panel', async ({ tauriPage }) => {
    const consoleErrors: string[] = [];
    tauriPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await tauriPage.goto('/');

    // .cm-editor exists
    await expect(tauriPage.locator('.cm-editor')).toBeVisible({ timeout: 10_000 });

    // No critical Tauri IPC errors in console
    const tauriErrors = consoleErrors.filter(
      (err) => err.includes('__TAURI__') || err.includes('invoke') || err.includes('ipc')
    );
    expect(tauriErrors).toHaveLength(0);
  });

  test('renders preview-content after typing', async ({ tauriPage }) => {
    await tauriPage.goto('/');

    // Wait for editor to be ready
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 10_000 });

    // Inject content to trigger preview rendering
    const editor = tauriPage.locator('.cm-content');
    await editor.click();
    await tauriPage.keyboard.press('ControlOrMeta+A');
    await editor.fill(FIXTURE_CONTENT);

    // .preview-content appears once content is typed
    await expect(tauriPage.locator('.preview-content')).toBeVisible({ timeout: 10_000 });
  });
});
