// SPEC-PREVIEW-015 M1b spike only (deleted in M7). Check 5 isolation: which action triggers the
// font-src CSP violation? Fresh page per scenario, no forced font loading unless the scenario says so.
// Prereq: the same vite preview as run-m1b.mjs (http://localhost:4318). Run: node spike/pele/run-m1b-csp.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit, chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EV = path.join(ROOT, '.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/evidence');
const URL_ = process.env.SPIKE_URL ?? 'http://localhost:4318/m1b.html';
const SCENARIOS = {
  'load-only': async () => {},
  'pele-math-html-render': async (page) => page.evaluate(() => { const B = window.M1B; for (const s of B.samples) B.mount(B.diagram.sanitize(B.pele(s.source, { output: 'html', measure: 'dom' }).svg)); }),
  'pele-math-mathml-render': async (page) => page.evaluate(() => { const B = window.M1B; for (const s of B.samples) B.mount(B.diagram.sanitize(B.pele(s.source, { output: 'mathml', measure: 'dom' }).svg)); }),
  'pele-math-mathml-bare-render': async (page) => page.evaluate(() => { const B = window.M1B; for (const s of B.samples) B.mount(B.diagram.sanitize(B.pele(s.source, { output: 'mathml-bare', measure: 'dom' }).svg)); }),
  'body-katex-big-delimiter': async (page) => page.evaluate(() => { const B = window.M1B; B.mount(B.katexMarkup('\\Bigg( x \\Bigg)', 'html')); }),
  'mermaid-math-render': async (page) => page.evaluate(async () => { const B = window.M1B; for (const s of B.samples) { const r = await B.mermaidRender(s.source, 'light'); if (r.ok) B.mount(r.svg); } }),
  'force-load-all-katex-fonts': async (page) => page.evaluate(() => window.M1B.loadKatexFonts()),
};
const out = { startedAt: new Date().toISOString() };
for (const type of [webkit, chromium]) {
  const browser = await type.launch();
  out[type.name()] = { version: browser.version(), scenarios: {} };
  for (const [name, run] of Object.entries(SCENARIOS)) {
    const page = await browser.newPage();
    const refused = [];
    page.on('console', (m) => { if (/Refused|Content Security Policy|font/i.test(m.text())) refused.push(m.text().slice(0, 60)); });
    await page.goto(URL_);
    await page.waitForFunction(() => document.title === 'pele M1b spike ready');
    await run(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const v = await page.evaluate(() => window.M1B.violations());
    const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
    out[type.name()].scenarios[name] = { violations: v.length, directives: [...new Set(v.map((x) => `${x.directive} ${x.blocked}`))], consoleRefusals: refused.length, loadedKatexFaces: fonts.length };
    await page.close();
  }
  await browser.close();
}
fs.writeFileSync(path.join(EV, 'm1b-csp.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 1));
