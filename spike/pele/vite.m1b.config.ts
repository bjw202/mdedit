// SPEC-PREVIEW-015 M1b spike only (deleted in M7). Production build of m1b.html (no dev-server inline
// scripts) so the page runs under the app CSP. Default assetsInlineLimit (4096) kept = same as the app build.
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  base: './',
  resolve: { alias: { '@': path.resolve(__dirname, '../../src') } },
  build: { outDir: process.env.SPIKE_OUT ?? path.resolve(__dirname, 'dist-m1b'), emptyOutDir: true, chunkSizeWarningLimit: 10000, rollupOptions: { input: path.resolve(__dirname, 'm1b.html') } },
  preview: { port: 4318, strictPort: true },
});
