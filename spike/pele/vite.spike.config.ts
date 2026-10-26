// SPEC-PREVIEW-015 M1 spike only (deleted in M7). Production build of compare.html so the page
// runs under the app CSP without Vite dev-server inline scripts.
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  base: './',
  // M2: serve the app's public/ so /fonts/*.woff2 from mdedit-fonts.css resolve (Barlow, IBM Plex Mono).
  publicDir: path.resolve(__dirname, '../../public'),
  resolve: { alias: { '@': path.resolve(__dirname, '../../src') } },
  build: { outDir: process.env.SPIKE_OUT ?? path.resolve(__dirname, 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 10000, rollupOptions: { input: path.resolve(__dirname, 'compare.html') } },
  preview: { port: 4317, strictPort: true },
});
