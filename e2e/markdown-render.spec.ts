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

// REQ-E2E-005: Markdown rendering test
test.describe('Markdown rendering (REQ-E2E-005)', () => {
  test('renders heading, table, and mermaid from fixture content', async ({ tauriPage }) => {
    await tauriPage.goto('/');

    // Wait for editor to be ready
    await tauriPage.locator('.cm-editor').waitFor({ timeout: 10_000 });

    // Inject fixture content into CodeMirror editor
    const editor = tauriPage.locator('.cm-content');
    await editor.click();
    await tauriPage.keyboard.press('ControlOrMeta+A');
    await editor.fill(FIXTURE_CONTENT);

    // Wait for preview to render h1 from "# E2E 테스트 픽스처"
    await expect(tauriPage.locator('.preview-content h1')).toBeVisible({ timeout: 5_000 });

    // Assert table exists
    await expect(tauriPage.locator('.preview-content table')).toBeVisible({ timeout: 5_000 });

    // Assert mermaid container exists
    await expect(tauriPage.locator('.preview-content .mermaid-container')).toBeVisible({
      timeout: 5_000,
    });
  });
});
