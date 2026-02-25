import { test as base, Page } from '@playwright/test';

async function injectTauriMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__TAURI__ = {
      core: {
        invoke: () => Promise.resolve(null),
      },
      event: {
        listen: () => Promise.resolve(() => {}),
        emit: () => Promise.resolve(),
      },
    };
  });
}

export const test = base.extend<{ tauriPage: Page }>({
  tauriPage: async ({ page }, use) => {
    await injectTauriMock(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
