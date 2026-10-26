// SPEC-PREVIEW-015 M1 spike only (deleted in M7).
// Prereq: build + serve the spike page (commands in m1/checks.md "재현 명령"), then:  node spike/pele/run-browser.mjs
// Drives the built compare page in Playwright webkit and writes evidence under m1/ plus the
// browser/ fixture bundle. Every number written here is measured in this run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { webkit, chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M1 = path.join(ROOT, '.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1');
const EV = path.join(M1, 'evidence');
const IMG = path.join(M1, 'img');
const EXP = path.join(M1, 'exports');
const FIX = path.join(ROOT, 'src/test/fixtures/pele');
const URL_ = process.env.SPIKE_URL ?? 'http://localhost:4317/compare.html';
const req = createRequire(import.meta.url);
const PW = req('@playwright/test/package.json').version;
for (const d of [EV, IMG, EXP, path.join(FIX, 'browser')]) fs.mkdirSync(d, { recursive: true });

const ERROR_IDS = new Set(['11-ai-mock-invalid', '21-error-line-col', '22-error-line0-semantic', '23-error-xss-label']);
const out = { startedAt: new Date().toISOString(), url: URL_ };

const browser = await webkit.launch();
out.environment = `playwright ${PW} webkit ${browser.version()} (headless, macOS)`;
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const consoleMsgs = [];
const requests = [];
page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => consoleMsgs.push({ type: 'pageerror', text: String(e) }));
page.on('request', (r) => requests.push(r.url()));

async function load() {
  await page.goto(URL_);
  await page.waitForFunction(() => document.title === 'pele M1 spike ready');
}

try {
  await load();
  const samples = await page.evaluate(() => window.M1.samples);
  out.sampleIds = samples.map((s) => s.id);

  // ---------- 1. render every sample with both engines (+ CSP phase markers) ----------
  const svgs = {};
  const renders = [];
  await page.evaluate(() => window.M1.setPhase('pele-render-and-insert'));
  for (const s of samples) {
    const r = await page.evaluate(({ src }) => {
      const M = window.M1;
      const res = {};
      for (const responsive of [true, false]) {
        const p = M.pele(src, { responsive });
        res[`r${responsive}`] = p.ok
          ? { ok: true, raw: p.svg, sanitized: M.sanitize(p.svg), width: p.width, height: p.height, type: p.type, mermaidType: p.mermaidType }
          : { ok: false, error: p.error };
      }
      if (res.rtrue.ok) { M.clear(); M.mount(res.rtrue.sanitized, { theme: 'light', vars: true }); }
      return res;
    }, { src: s.source });
    svgs[s.id] = { pele: r };
    renders.push({ id: s.id, rtrue: r.rtrue.ok ? { width: r.rtrue.width, height: r.rtrue.height, type: r.rtrue.type } : { error: r.rtrue.error } });
  }
  out.violationsAfterPele = await page.evaluate(() => window.M1.violations());
  out.consoleAfterPele = consoleMsgs.filter((m) => m.type === 'error' || m.type === 'pageerror' || /Content Security Policy|Refused/i.test(m.text));

  await page.evaluate(() => window.M1.setPhase('mermaid-render-and-insert'));
  for (const s of samples) {
    const m = await page.evaluate(async ({ src }) => {
      const M = window.M1;
      const light = await M.mermaidRender(src, 'light');
      const dark = await M.mermaidRender(src, 'dark');
      if (light.ok) { M.clear(); M.mount(light.svg); }
      return { light, dark };
    }, { src: s.source });
    svgs[s.id].mermaid = m;
    const row = renders.find((x) => x.id === s.id);
    row.mermaid = { light: m.light.ok ? 'ok' : `error: ${m.light.error.slice(0, 160)}`, dark: m.dark.ok ? 'ok' : `error: ${m.dark.error.slice(0, 160)}` };
  }
  out.renders = renders;
  out.violationsAll = await page.evaluate(() => window.M1.violations());
  out.consoleAll = consoleMsgs.filter((m) => m.type === 'error' || m.type === 'pageerror' || /Content Security Policy|Refused/i.test(m.text));
  out.tokens = { light: await page.evaluate(() => window.M1.tokens('light')), dark: await page.evaluate(() => window.M1.tokens('dark')) };
  fs.writeFileSync(path.join(EV, 'browser-svgs.json'), JSON.stringify(svgs) + '\n');

  // ---------- 2. browser fixture bundle (canvas measurer) ----------
  const capturedAt = new Date().toISOString();
  const manifest = [];
  for (const s of samples) {
    if (ERROR_IDS.has(s.id)) continue;
    for (const responsive of [true, false]) {
      const p = svgs[s.id].pele[`r${responsive}`];
      for (const stage of ['raw', 'sanitized']) {
        const file = `browser/${s.id}.r${responsive}.${stage}.svg`;
        fs.writeFileSync(path.join(FIX, file), p[stage]);
        manifest.push({
          file, bundle: 'browser', stage, sample: s.id, source: s.source, sourceOrigin: `spike/pele/samples/${s.id}.mmd`,
          options: { autoDirection: false, links: false, images: false, responsive }, peleVersion: '1.10.0',
          capturedAt, environment: out.environment, measurer: 'canvas', width: p.width, height: p.height, type: p.type, mermaidType: p.mermaidType,
        });
      }
    }
  }
  fs.writeFileSync(path.join(EV, 'browser-manifest-part.json'), JSON.stringify(manifest, null, 2) + '\n');

  // ---------- 3. geometry: subgraph B/C, label overflow, at 560 and 800 ----------
  out.geometry = {};
  for (const s of samples) {
    if (ERROR_IDS.has(s.id)) continue;
    out.geometry[s.id] = {};
    for (const width of [560, 800]) {
      out.geometry[s.id][width] = await page.evaluate(({ svg, width }) => {
        const M = window.M1; M.clear();
        return M.geometry(M.mount(svg, { width, theme: 'light', vars: true }));
      }, { svg: svgs[s.id].pele.rtrue.sanitized, width });
    }
  }
  for (const id of ['02-subgraph-B-vertical', '03-subgraph-C-horizontal']) {
    for (const width of [560, 800]) {
      await page.evaluate(({ svg, width }) => { const M = window.M1; M.clear(); M.mount(svg, { width, theme: 'light', vars: true }); }, { svg: svgs[id].pele.rtrue.sanitized, width });
      await page.locator('#stage > div').first().screenshot({ path: path.join(IMG, `${id}-pele-${width}.png`) });
      await page.evaluate(({ svg, width }) => { const M = window.M1; M.clear(); M.mount(svg, { width }); }, { svg: svgs[id].mermaid.light.svg, width });
      await page.locator('#stage > div').first().screenshot({ path: path.join(IMG, `${id}-mermaid-${width}.png`) });
    }
  }

  // ---------- 4. autoDirection: maxWidth 560 vs 800 ----------
  out.autoDirection = await page.evaluate((ids) => {
    const M = window.M1; const res = {};
    for (const s of M.samples.filter((x) => ids.includes(x.id))) {
      const f560 = M.pele(s.source, { maxWidth: 560 }), f800 = M.pele(s.source, { maxWidth: 800 });
      const t560 = M.pele(s.source, { autoDirection: true, maxWidth: 560 }), t800 = M.pele(s.source, { autoDirection: true, maxWidth: 800 });
      const pos = (r) => (r.ok ? JSON.stringify(M.nodePositions(r.svg)) : 'err');
      res[s.id] = {
        falseSameLayout560vs800: pos(f560) === pos(f800), falseSvgEqual560vs800: f560.svg === f800.svg,
        falseSize: [[f560.width, f560.height], [f800.width, f800.height]],
        trueSameLayout560vs800: pos(t560) === pos(t800), trueSize: [[t560.width, t560.height], [t800.width, t800.height]],
      };
    }
    return res;
  }, ['01-test-content', '03-subgraph-C-horizontal', '12-ai-mock-valid', '13-classdef-style', '15-mindmap-deep']);

  // ---------- 5. sanitize visual round-trip (raw vs sanitized pixels) ----------
  out.sanitizeVisual = {};
  for (const s of samples) {
    if (ERROR_IDS.has(s.id)) continue;
    const shots = [];
    for (const stage of ['raw', 'sanitized']) {
      await page.evaluate(({ svg }) => { const M = window.M1; M.clear(); M.mount(svg, { width: 820, theme: 'light', vars: true }); }, { svg: svgs[s.id].pele.rtrue[stage] });
      shots.push(await page.locator('#stage > div svg').first().screenshot());
    }
    out.sanitizeVisual[s.id] = { pixelIdentical: Buffer.compare(shots[0], shots[1]) === 0, bytes: [shots[0].length, shots[1].length] };
  }

  // ---------- 6. links:false click + images:false network ----------
  const reqBefore = requests.length;
  const urlBefore = page.url();
  let popups = 0; page.on('popup', () => popups++);
  await page.evaluate(({ svg }) => { const M = window.M1; M.clear(); M.mount(svg, { theme: 'light', vars: true }); }, { svg: svgs['19-link-click'].pele.rtrue.sanitized });
  await page.locator('#stage .pele-node[data-id="A"]').click();
  await page.locator('#stage .pele-node[data-id="B"]').click();
  await page.waitForTimeout(500);
  await page.evaluate(({ svg }) => { const M = window.M1; M.clear(); M.mount(svg, { theme: 'light', vars: true }); }, { svg: svgs['20-image-node'].pele.rtrue.sanitized });
  await page.waitForTimeout(500);
  const newReqs = requests.slice(reqBefore);
  out.linksImagesBrowser = {
    urlUnchanged: page.url() === urlBefore, popups,
    anchorsInDom: 0, requestsDuringChecks: newReqs, externalRequests: newReqs.filter((u) => !u.startsWith('http://localhost:4317')),
  };

  // ---------- 7. id uniqueness when many diagrams share one document ----------
  out.domIds = await page.evaluate(() => {
    const M = window.M1; M.clear();
    for (const s of M.samples) { const p = M.pele(s.source); if (p.ok) M.mount(M.sanitize(p.svg)); }
    const ids = [...document.querySelectorAll('#stage [id]')].map((e) => e.id);
    return { diagrams: document.querySelectorAll('#stage svg').length, idCount: ids.length, duplicates: ids.filter((v, i) => ids.indexOf(v) !== i) };
  });

  // ---------- 8. math label (measure only) ----------
  const mathSvgM = svgs['18-math-label'].mermaid.light;
  out.math = {
    pele: { foreignObject: svgs['18-math-label'].pele.rtrue.raw.includes('foreignObject'), texts: [...svgs['18-math-label'].pele.rtrue.sanitized.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]) },
    mermaid: mathSvgM.ok ? { foreignObject: mathSvgM.svg.includes('foreignObject'), katexMarkup: /class="katex/.test(mathSvgM.svg), mathml: mathSvgM.svg.includes('<math') } : { error: mathSvgM.error },
  };
  for (const eng of ['pele', 'mermaid']) {
    const svg = eng === 'pele' ? svgs['18-math-label'].pele.rtrue.sanitized : mathSvgM.svg;
    if (!svg) continue;
    await page.evaluate(({ svg }) => { const M = window.M1; M.clear(); M.mount(svg, { theme: 'light', vars: true }); }, { svg });
    await page.locator('#stage > div').first().screenshot({ path: path.join(IMG, `18-math-label-${eng}.png`) });
  }

  // ---------- 9. export prototypes ----------
  const exportIds = ['13-classdef-style', '09-preset-pie', '05-preset-sequenceDiagram'];
  out.exports = { ids: exportIds, html: {}, docx: {} };
  const exportSources = exportIds.map((id) => samples.find((s) => s.id === id).source);
  for (const theme of ['light', 'dark']) {
    for (const variant of ['literal', 'as-is']) {
      const res = await page.evaluate(async ({ ids, theme, variant, sources }) => {
        const M = window.M1; const table = M.tokens(theme);
        const base = ids.map((id, i) => M.sanitize(M.pele(sources[i]).svg));
        const svgs = variant === 'literal' ? base.map((s) => M.literalize(s, table)) : base;
        const html = M.exportHtml(sources, svgs, theme);
        const pngs = [];
        for (let i = 0; i < svgs.length; i++) {
          const p = M.pele(sources[i]);
          pngs.push({ ...(await M.svgToPng(svgs[i], p.width, p.height)), width: p.width, height: p.height });
        }
        return { html, pngs, peleVarCount: svgs.map((s) => (s.match(/var\(--pele-/g) || []).length) };
      }, { ids: exportIds, theme, variant, sources: exportSources });
      const key = `${theme}-${variant}`;
      const htmlFile = path.join(EXP, `html-${key}.html`);
      fs.writeFileSync(htmlFile, res.html);
      out.exports.html[key] = { file: path.relative(M1, htmlFile), peleVarCount: res.peleVarCount, varPeleInFile: (res.html.match(/var\(--pele-/g) || []).length };
      out.exports.docx[key] = res.pngs.map((p, i) => {
        if (!p.ok) return { id: exportIds[i], ok: false, reason: p.reason };
        const f = path.join(EXP, `docx-png-${key}-${exportIds[i]}.png`);
        fs.writeFileSync(f, Buffer.from(p.png.split(',')[1], 'base64'));
        return { id: exportIds[i], ok: true, file: path.relative(M1, f), width: p.width, height: p.height, stats: p.stats };
      });
    }
  }
  // HTML exports opened as files in webkit (offline, no app CSS)
  const p2 = await context.newPage();
  for (const key of Object.keys(out.exports.html)) {
    await p2.goto(pathToFileURL(path.join(EXP, `html-${key}.html`)).href);
    await p2.screenshot({ path: path.join(EXP, `html-${key}.png`), fullPage: true });
    out.exports.html[key].screenshot = `exports/html-${key}.png`;
  }
  await p2.close();

  // ---------- 10. timing: >= 30 diagrams, fresh page per run ----------
  const ok = samples.filter((s) => !ERROR_IDS.has(s.id) && svgs[s.id].mermaid.light.ok && svgs[s.id].pele.rtrue.ok);
  const doc = [];
  while (doc.length < 32) doc.push(ok[doc.length % ok.length].source);
  out.timing = { diagrams: doc.length, distinctSamples: ok.map((s) => s.id), runs: [] };
  for (let run = 1; run <= 3; run++) {
    for (const engine of ['mermaid', 'pele']) {
      await load();
      out.timing.runs.push({ run, ...(await page.evaluate(({ engine, doc }) => window.M1.timing(engine, doc), { engine, doc })) });
    }
  }
  // single-diagram cold first render (fresh page each)
  out.timing.single = [];
  for (const engine of ['mermaid', 'pele']) {
    for (let run = 1; run <= 3; run++) {
      await load();
      out.timing.single.push({ run, ...(await page.evaluate(({ engine, src }) => window.M1.timing(engine, [src]), { engine, src: samples.find((s) => s.id === '01-test-content').source })) });
    }
  }
} finally {
  await browser.close();
}

// ---------- 11. PDF proxy (Chromium print-to-PDF of the exported HTML; NOT the app print path) ----------
try {
  const cb = await chromium.launch();
  out.pdfProxy = { environment: `playwright ${PW} chromium ${cb.version()}`, files: [] };
  const cp = await cb.newPage();
  for (const key of Object.keys(out.exports.html)) {
    await cp.goto(pathToFileURL(path.join(EXP, `html-${key}.html`)).href);
    const f = path.join(EXP, `pdf-proxy-${key}.pdf`);
    await cp.pdf({ path: f, format: 'A4', printBackground: true });
    out.pdfProxy.files.push(path.relative(M1, f));
  }
  await cb.close();
} catch (e) {
  out.pdfProxy = { error: String(e) };
}

out.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(EV, 'browser-run.json'), JSON.stringify(out, null, 2) + '\n');
console.log('done', out.environment, 'samples', out.sampleIds.length);
