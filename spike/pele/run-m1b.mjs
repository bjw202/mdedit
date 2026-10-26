// SPEC-PREVIEW-015 M1b spike only (deleted in M7).
// Prereq: SPIKE_OUT=<dir> npx vite build --config spike/pele/vite.m1b.config.ts
//         SPIKE_OUT=<dir> npx vite preview --config spike/pele/vite.m1b.config.ts   (http://localhost:4318)
// Then:   node spike/pele/run-m1b.mjs
// Drives m1b.html in Playwright webkit (full) and chromium (comparison) and writes M1b evidence.
// Every number written here is measured in this run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { webkit, chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M1 = path.join(ROOT, '.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1');
const EV = path.join(M1, 'evidence');
const IMG = path.join(M1, 'img');
const EXP = path.join(M1, 'exports', 'm1b');
const FIX = path.join(ROOT, 'src/test/fixtures/pele');
const URL_ = process.env.SPIKE_URL ?? 'http://localhost:4318/m1b.html';
const req = createRequire(import.meta.url);
const PW = req('@playwright/test/package.json').version;
for (const d of [EV, IMG, EXP]) fs.mkdirSync(d, { recursive: true });

// ---- KaTeX CSS variants for the HTML export (built here, where the file system is) ----
const KATEX_DIR = path.join(ROOT, 'node_modules/katex/dist');
const katexCss = fs.readFileSync(path.join(KATEX_DIR, 'katex.min.css'), 'utf8');
let fontBytes = 0;
const katexCssDataFonts = katexCss.replace(/src:url\(fonts\/([^)]+?)\.woff2\) format\("woff2"\)(,url\([^)]+\) format\("[a-z]+"\))*/g, (_m, name) => {
  const buf = fs.readFileSync(path.join(KATEX_DIR, 'fonts', `${name}.woff2`));
  fontBytes += buf.length;
  return `src:url(data:font/woff2;base64,${buf.toString('base64')}) format("woff2")`;
});
const katexCssNoFonts = katexCss.replace(/@font-face\{[^}]*\}/g, '');
const OUTPUTS = ['html', 'mathml', 'mathml-bare'];
const EXPORT_VARIANTS = {
  'E0-html-noKatexCss': { output: 'html', css: '' },
  'E1-html-katexCss-dataFonts': { output: 'html', css: katexCssDataFonts },
  'E2-html-katexCss-noFonts': { output: 'html', css: katexCssNoFonts },
  'E3-mathml-noKatexCss': { output: 'mathml', css: '' },
  'E4-mathmlBare-noKatexCss': { output: 'mathml-bare', css: '' },
  'E5-mathmlBare-katexCss-dataFonts': { output: 'mathml-bare', css: katexCssDataFonts },
};

// ---- M1 browser fixture pairs (webkit canvas measurer) for check 2a ----
const manifest = JSON.parse(fs.readFileSync(path.join(FIX, 'manifest.json'), 'utf8'));
const pairs = manifest.entries.filter((e) => e.bundle === 'browser' && e.stage === 'raw').map((e) => ({
  file: e.file, raw: fs.readFileSync(path.join(FIX, e.file), 'utf8'), sanitized: fs.readFileSync(path.join(FIX, e.file.replace('.raw.svg', '.sanitized.svg')), 'utf8'),
}));

async function pass(type, full) {
  const browser = await type.launch();
  const res = { environment: `playwright ${PW} ${type.name()} ${browser.version()} (headless, macOS)` };
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleMsgs = [];
  page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 300) }));
  page.on('pageerror', (e) => consoleMsgs.push({ type: 'pageerror', text: String(e).slice(0, 300) }));
  const fontRequests = [];
  page.on('request', (r) => { if (/woff|ttf|font/.test(r.url())) fontRequests.push(r.url().slice(0, 120)); });
  try {
    await page.goto(URL_);
    await page.waitForFunction(() => document.title === 'pele M1b spike ready');
    const M = (fn, arg) => page.evaluate(fn, arg);
    res.cold = await M(() => ({ fontsStatusAtStart: window.M1B.coldFontsStatus, log: window.M1B.coldLog }));
    const samples = await M(() => window.M1B.samples);

    // ---------- check 5 part 1: load every KaTeX font under the CSP ----------
    await M(() => window.M1B.setPhase('katex-fonts-load'));
    res.fonts = await M(() => window.M1B.loadKatexFonts());

    // ---------- check 1: preview render (warm fonts), fit, paint position, screenshots ----------
    await M(() => window.M1B.setPhase('pele-math-render'));
    res.preview = {};
    const mathRaw = {};
    const eng = type.name();
    for (const s of samples) {
      const row = {};
      for (const output of OUTPUTS) {
        const r = await M(({ src, output }) => { const B = window.M1B; const p = B.pele(src, { output, measure: 'dom' }); return { svg: p.svg, width: p.width, height: p.height, log: p.log, sanitized: B.diagram.sanitize(p.svg) }; }, { src: s.source, output });
        mathRaw[`${s.id}.${output}`] = r.svg;
        row[output] = { width: r.width, height: r.height, log: r.log, sanitizedKeepsPeleMath: (r.sanitized.match(/class="pele-math"/g) || []).length };
        const themes = full ? (output === 'mathml' ? ['light'] : ['light', 'dark']) : (output === 'mathml' ? [] : ['light']);
        for (const theme of themes) {
          const info = await M(({ svg, theme }) => { const B = window.M1B; B.clear(); const el = B.mount(svg, { theme }); return { fit: B.fit(el), rects: B.foRectsIn(el) }; }, { svg: r.sanitized, theme });
          const loc = page.locator('#stage > div').first();
          const withMath = await loc.screenshot({ path: path.join(IMG, `m1b-${s.id}-pele-${output}-${theme}${full ? '' : '-' + eng}.png`) });
          await M(() => window.M1B.stripMath(document.querySelector('#stage > div')));
          const without = await loc.screenshot();
          const paint = await M(({ a, b, rects }) => window.M1B.paintCheck(a, b, rects), { a: 'data:image/png;base64,' + withMath.toString('base64'), b: 'data:image/png;base64,' + without.toString('base64'), rects: info.rects });
          row[output][theme] = { fit: info.fit, paint };
        }
      }
      if (full) {
        for (const theme of ['light', 'dark']) {
          const m = await M(async ({ src, theme }) => { const B = window.M1B; B.setPhase('mermaid-render'); const r = await B.mermaidRender(src, theme); B.setPhase('pele-math-render'); if (r.ok) { B.clear(); B.mount(r.svg, { theme }); } return { ok: r.ok, error: r.error, foreignObject: r.ok && r.svg.includes('foreignObject'), katex: r.ok && /class="katex/.test(r.svg), mathml: r.ok && r.svg.includes('<math') }; }, { src: s.source, theme });
          row[`mermaid-${theme}`] = m;
          if (m.ok) await page.locator('#stage > div').first().screenshot({ path: path.join(IMG, `m1b-${s.id}-mermaid-${theme}.png`) });
        }
      }
      res.preview[s.id] = row;
    }
    // raw text (no resolver) for comparison, sample 18
    res.noResolver18 = await M((src) => { const p = window.M1B.pele(src, { output: 'none' }); return { width: p.width, height: p.height, dollars: (p.svg.match(/\$\$/g) || []).length }; }, samples.find((s) => s.id === '18-math-label').source);

    // resolver cost: render time with/without resolver (warm), 50 renders each
    res.renderCost = await M(({ srcs, outputs }) => {
      const B = window.M1B; const out = {};
      for (const o of ['none', ...outputs]) { const t = performance.now(); for (let i = 0; i < 50; i++) for (const s of srcs) B.pele(s, { output: o, measure: 'dom' }); out[o] = +((performance.now() - t) / (50 * srcs.length)).toFixed(3); }
      return { msPerDiagram: out, diagrams: srcs.length };
    }, { srcs: samples.map((s) => s.source), outputs: OUTPUTS });

    // ---------- check 2 in this engine (browser fixtures were captured in webkit) ----------
    await M(() => window.M1B.setPhase('sanitize-checks'));
    const sc = await M(({ pairs, mathRaw }) => window.M1B.runSanitizeChecks(pairs, mathRaw), { pairs, mathRaw });
    for (const v of Object.values(sc.c_hostile)) v.output = v.output.slice(0, 600);
    res.sanitize = sc;

    // ---------- check 4: DOCX PNG path ----------
    await M(() => window.M1B.setPhase('docx-png'));
    res.docx = {};
    for (const id of ['18-math-label', 'm03-text-and-math']) {
      const src = samples.find((s) => s.id === id).source;
      for (const output of ['html', 'mathml', 'mathml-bare', 'none', 'textsvg']) {
        const r = await M(async ({ src, output }) => {
          const B = window.M1B; const p = B.pele(src, { output, measure: 'dom' });
          const svg = output.startsWith('html') || output.startsWith('mathml') ? B.diagram.sanitize(p.svg) : B.sanitize(p.svg);
          return { ...(await B.svgToPng(svg, p.width, p.height)), width: p.width, height: p.height };
        }, { src, output });
        if (r.png) { const f = path.join(EXP, `docx-png-${type.name()}-${id}-${output}.png`); fs.writeFileSync(f, Buffer.from(r.png.split(',')[1], 'base64')); r.file = path.relative(M1, f); delete r.png; }
        res.docx[`${id}.${output}`] = r;
      }
    }

    // ---------- check 3: HTML export variants (built in-page, opened from file:// offline) ----------
    if (full) {
      await M(() => window.M1B.setPhase('html-export-build'));
      res.htmlExport = { katexCssBytes: katexCss.length, katexWoff2Bytes: fontBytes, variants: {} };
      const ids = ['18-math-label', 'm03-text-and-math'];
      const srcs = ids.map((id) => samples.find((s) => s.id === id).source);
      for (const [name, v] of Object.entries(EXPORT_VARIANTS)) {
        for (const theme of ['light', 'dark']) {
          const html = await M(({ srcs, output, css, theme }) => {
            const B = window.M1B; const svgs = srcs.map((s) => B.diagram.sanitize(B.pele(s, { output, measure: 'dom' }).svg));
            return B.exportHtml(srcs, svgs, theme, css);
          }, { srcs, output: v.output, css: v.css, theme });
          const f = path.join(EXP, `html-${name}-${theme}.html`);
          fs.writeFileSync(f, html);
          res.htmlExport.variants[`${name}-${theme}`] = { file: path.relative(M1, f), bytes: Buffer.byteLength(html) };
        }
      }
    }
  } finally {
    res.violations = await page.evaluate(() => window.M1B?.violations?.() ?? []).catch((e) => `error ${e}`);
    res.console = consoleMsgs.filter((m) => m.type === 'error' || m.type === 'pageerror' || /Content Security Policy|Refused/i.test(m.text));
    res.fontRequests = fontRequests;
    await browser.close();
  }
  return res;
}

// Open the exported HTML files offline (no CSP, no app CSS) and inspect math rendering.
async function openExports(type, out) {
  const browser = await type.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  for (const [key, v] of Object.entries(out.htmlExport.variants)) {
    await page.goto(pathToFileURL(path.join(M1, v.file)).href);
    await page.evaluate(() => document.fonts.ready);
    v[type.name()] = await page.evaluate(() => {
      const fos = [...document.querySelectorAll('foreignObject.pele-math')];
      const k = document.querySelector('foreignObject.pele-math .katex-html .mord');
      const body = document.querySelector('p .katex');
      return {
        peleMath: fos.length,
        katexHtmlFontFamily: k ? getComputedStyle(k).fontFamily : null,
        katexMainLoaded: document.fonts.check('16px KaTeX_Main'),
        mathmlVisibleInsideDiagram: fos.some((f) => { const m = f.querySelector('.katex-mathml, math'); return !!m && m.getBoundingClientRect().width > 1; }),
        katexHtmlVisibleInsideDiagram: fos.some((f) => { const m = f.querySelector('.katex-html'); return !!m && m.getBoundingClientRect().width > 1; }),
        foOverflowX: fos.map((f) => { const a = f.getBoundingClientRect(); const b = (f.querySelector('.katex') ?? f).getBoundingClientRect(); return +(b.width - a.width).toFixed(1); }),
        bodyMath: body ? { mathmlVisible: (body.querySelector('.katex-mathml')?.getBoundingClientRect().width ?? 0) > 1, htmlVisible: (body.querySelector('.katex-html')?.getBoundingClientRect().width ?? 0) > 1 } : null,
      };
    });
    const shot = path.join(EXP, `html-${key}-${type.name()}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    v[`${type.name()}Screenshot`] = path.relative(M1, shot);
  }
  await browser.close();
}

const out = { startedAt: new Date().toISOString(), url: URL_, browserFixturePairs: pairs.length };
out.webkit = await pass(webkit, true);
out.chromium = await pass(chromium, false);
await openExports(webkit, out.webkit);
await openExports(chromium, out.webkit);
out.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(EV, 'm1b-browser.json'), JSON.stringify(out, null, 2) + '\n');
console.log('done', out.webkit.environment, '|', out.chromium.environment);
