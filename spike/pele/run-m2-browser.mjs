// SPEC-PREVIEW-015 M2 spike only (deleted in M7).
// Prereq: build the spike page (SPIKE_OUT=<dir> npx vite build --config spike/pele/vite.spike.config.ts), then:
//   SPIKE_OUT=<dir> node spike/pele/run-m2-browser.mjs   (starts and stops its own vite preview server)
// Recaptures ONLY the browser/ fixture bundle (webkit, canvas measurer) with the production fixed options
// (fontFamily/fontFamilyMono, design.md D5) and the production mathml-bare resolver measured by
// getBoundingClientRect (D14/D15). Does not touch M1 evidence. Writes spike/pele/m2-browser-manifest-part.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { webkit } from '@playwright/test';
import { preview } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIX = path.join(ROOT, 'src/test/fixtures/pele');
const URL_ = process.env.SPIKE_URL ?? 'http://localhost:4317/compare.html';
const PW = createRequire(import.meta.url)('@playwright/test/package.json').version;
const ERROR_IDS = new Set(['11-ai-mock-invalid', '21-error-line-col', '22-error-line0-semantic', '23-error-xss-label']);

// The preview server lives inside this process and is closed in `finally` (no orphan server).
const server = await preview({ configFile: path.join(ROOT, 'spike/pele/vite.spike.config.ts') });
const browser = await webkit.launch();
const environment = `playwright ${PW} webkit ${browser.version()} (headless, macOS)`;
try {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 })).newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(URL_);
  await page.waitForFunction(() => document.title === 'pele M1 spike ready');
  const fonts = await page.evaluate(() => window.M1.m2LoadFonts());
  const fixedOptions = await page.evaluate(() => window.M1.fixedOptions);
  const samples = await page.evaluate(() => window.M1.samplesM2);
  fs.rmSync(path.join(FIX, 'browser'), { recursive: true, force: true });
  fs.mkdirSync(path.join(FIX, 'browser'), { recursive: true });
  const capturedAt = new Date().toISOString();
  const entries = [];
  for (const s of samples) {
    if (ERROR_IDS.has(s.id)) continue;
    const r = await page.evaluate((src) => window.M1.m2Fixture(src), s.source);
    if (!r.ok) throw new Error(`${s.id}: ${JSON.stringify(r.error)}`);
    const hasMath = /\$\$(.+?)\$\$/.test(s.source);
    const origin = s.id.startsWith('m0') ? `spike/pele/samples-m1b/${s.id}.mmd` : `spike/pele/samples/${s.id}.mmd`;
    for (const stage of ['raw', 'sanitized']) {
      const file = `browser/${s.id}.${stage}.svg`;
      fs.writeFileSync(path.join(FIX, file), r[stage]);
      entries.push({
        file, bundle: 'browser', stage, sample: s.id, source: s.source, sourceOrigin: origin,
        options: fixedOptions, peleVersion: '1.10.0', capturedAt, environment: `${environment}; fonts ${JSON.stringify(fonts)}`,
        measurer: 'canvas',
        ...(stage === 'sanitized' ? { sanitizer: 'sanitizeDiagramSvg (src/lib/diagram/diagramRenderer.ts)' } : {}),
        ...(hasMath ? { math: { method: 'getBoundingClientRect', resolver: 'createMathResolver() default DOM measure, katexMathMarkup mathml-bare', calls: r.mathCalls } } : {}),
        width: r.width, height: r.height, type: r.type, mermaidType: r.mermaidType,
      });
    }
  }
  fs.writeFileSync(path.join(ROOT, 'spike/pele/m2-browser-manifest-part.json'), JSON.stringify(entries, null, 2) + '\n');
  console.log(`m2-browser entries=${entries.length} env="${environment}" fonts=${JSON.stringify(fonts)} consoleErrors=${consoleErrors.length}`);
  for (const e of consoleErrors) console.log('console error:', e.slice(0, 200));
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
