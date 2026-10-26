// SPEC-PREVIEW-015 M1b spike only (deleted in M7). Exploratory probe for F11: does overriding the
// app-global `.katex{position:relative}` inside foreignObject.pele-math fix WebKit's paint position?
// Prereq: the same vite preview as run-m1b.mjs (http://localhost:4318). Run: node spike/pele/run-m1b-position.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit, chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, '.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/exports/m1b');
for (const type of [webkit, chromium]) {
  const b = await type.launch(); const p = await b.newPage({ viewport: { width: 700, height: 500 } });
  await p.goto(process.env.SPIKE_URL ?? 'http://localhost:4318/m1b.html');
  await p.waitForFunction(() => document.title === 'pele M1b spike ready');
  await p.evaluate(() => window.M1B.loadKatexFonts());
  for (const v of ['html', 'mathml', 'mathml-static', 'html-static']) {
    await p.evaluate((v) => {
      const B = window.M1B; const src = B.samples.find((s) => s.id === 'm03-text-and-math').source;
      const svg = B.diagram.sanitize(B.pele(src, { output: v.startsWith('html') ? 'html' : 'mathml' }).svg);
      B.clear(); const el = B.mount(svg);
      document.getElementById('probe-style')?.remove();
      if (v.endsWith('static')) { const s = document.createElement('style'); s.id = 'probe-style'; s.textContent = 'foreignObject.pele-math .katex{position:static}'; document.head.appendChild(s); }
      el.style.marginTop = '120px';
    }, v);
    await p.screenshot({ path: path.join(OUT, `position-${type.name()}-${v}.png`) });
  }
  await b.close();
}
console.log('done');
