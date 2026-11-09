import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const host = process.env.TAURI_DEV_HOST;

// @MX:NOTE: index.html 메타 CSP에 font-src가 없어 data: 글꼴이 막힌다 — 글꼴은 항상 파일로 낸다.
// CSP에 data:를 더하는 대신 이 방식을 쓴다(SPEC-SEC-002).
// 글꼴이면 false(인라인 금지), 아니면 undefined(Vite 기본 4,096B 기준 유지).
const FONT_ASSET_RE = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i;
const assetsInlineLimit = (file: string): boolean | undefined =>
  FONT_ASSET_RE.test(file) ? false : undefined;

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  build: {
    assetsInlineLimit,
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    // Prevent WKWebView from caching JS/CSS in dev mode
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/e2e/**", "**/node_modules/**"],
    poolOptions: {
      forks: {
        execArgv: ["--max-old-space-size=4096"],
      },
    },
  },
}));
