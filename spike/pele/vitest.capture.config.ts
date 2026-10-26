// SPEC-PREVIEW-015 M1 spike only (deleted in M7).
// Runs spike/pele/*.capture.ts under the SAME jsdom environment + setup file as the unit tests,
// so the unit fixture bundle is captured with the unit-test measurer (design.md D14).
// File suffix `.capture.ts` is outside vitest's default include, so `npm test` never collects it.
import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

export default defineConfig({
  root,
  resolve: { alias: { '@': path.resolve(root, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(root, 'src/test/setup.ts')],
    include: ['spike/pele/**/*.capture.ts'],
    testTimeout: 120_000,
  },
});
