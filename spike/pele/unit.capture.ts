// SPEC-PREVIEW-015 M1 spike only (deleted in M7).
// Run: npx vitest run --config spike/pele/vitest.capture.config.ts
// Captures the `unit/` fixture bundle (real pele 1.10.0 renders under vitest jsdom, same setup
// file as the unit tests) and records the jsdom-feasibility evidence for AC-001 check 11.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { it, expect } from 'vitest';
import { render, PeleError } from 'pele';
import MarkdownIt from 'markdown-it';
import { sanitizeSvg } from '../../src/lib/preview/svgSanitize';
import { mermaidPlugin } from '../../src/lib/markdown/mermaidPlugin';
import { DIAGRAM_PRESETS } from '../../src/components/editor/extensions/keyboard-shortcuts';

const ROOT = path.resolve(__dirname, '../..');
const SAMPLES = path.join(ROOT, 'spike/pele/samples');
const FIX = path.join(ROOT, 'src/test/fixtures/pele');
const UNIT = path.join(FIX, 'unit');
const EVIDENCE = path.join(ROOT, '.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/evidence');
const req = createRequire(import.meta.url);
const PELE_VERSION = req('pele/package.json').version as string;
const JSDOM_VERSION = req('jsdom/package.json').version as string;
const VITEST_VERSION = req('vitest/package.json').version as string;
const BASE = { autoDirection: false, links: false, images: false } as const;
const ERROR_SAMPLES = new Set(['11-ai-mock-invalid', '21-error-line-col', '22-error-line0-semantic', '23-error-xss-label']);

function samples() {
  return fs
    .readdirSync(SAMPLES)
    .filter((f) => f.endsWith('.mmd'))
    .sort()
    .map((f) => ({ id: f.replace(/\.mmd$/, ''), file: `spike/pele/samples/${f}`, source: fs.readFileSync(path.join(SAMPLES, f), 'utf8') }));
}

function peleErr(e: unknown) {
  if (e instanceof PeleError) return { isPeleError: true, code: e.code, message: e.message, line: e.line, column: e.column, snippet: e.snippet, type: e.type, mermaidType: e.mermaidType };
  return { isPeleError: false, message: String(e) };
}

it('captures unit fixtures and jsdom evidence', () => {
  fs.mkdirSync(UNIT, { recursive: true });
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const capturedAt = new Date().toISOString();
  const environment = `vitest ${VITEST_VERSION} jsdom ${JSDOM_VERSION} (node ${process.version}, setup src/test/setup.ts)`;
  const evidence: Record<string, unknown> = { capturedAt, environment, peleVersion: PELE_VERSION };

  // --- check 11: what measurer can jsdom offer? ---
  let ctx: unknown = 'threw';
  try { ctx = document.createElement('canvas').getContext('2d'); } catch (e) { ctx = `threw: ${String(e)}`; }
  evidence.jsdom = {
    offscreenCanvas: typeof (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas,
    canvasGetContext2d: ctx === null ? 'null' : String(ctx),
    documentFonts: typeof (document as { fonts?: unknown }).fonts,
  };

  // --- presets verbatim check (samples 04-10 vs DIAGRAM_PRESETS) ---
  const presetCheck = DIAGRAM_PRESETS.filter((p) => p.preset !== 'custom').map((p, i) => {
    const f = fs.readdirSync(SAMPLES).find((n) => n.startsWith(String(4 + i).padStart(2, '0') + '-preset-'))!;
    return { preset: p.preset, sample: f, verbatim: fs.readFileSync(path.join(SAMPLES, f), 'utf8') === p.body };
  });
  evidence.presetVerbatim = presetCheck;

  const manifest: Record<string, unknown>[] = [];
  const results: Record<string, unknown>[] = [];
  const errors: Record<string, unknown>[] = [];
  const fixedWidth = { width: (t: string, size: number) => t.length * size * 0.6 };

  for (const s of samples()) {
    if (ERROR_SAMPLES.has(s.id)) {
      try { render(s.source, { ...BASE }); errors.push({ id: s.id, source: s.source, rendered: true }); }
      catch (e) { errors.push({ id: s.id, source: s.source, rendered: false, error: peleErr(e) }); }
      continue;
    }
    const row: Record<string, unknown> = { id: s.id };
    for (const responsive of [true, false]) {
      const opts = { ...BASE, responsive };
      const a = render(s.source, opts);
      const b = render(s.source, opts); // determinism
      const fw = render(s.source, { ...opts, measurer: fixedWidth });
      const sanitized = sanitizeSvg(a.svg);
      const tag = `r${responsive}`;
      for (const [stage, svg] of [['raw', a.svg], ['sanitized', sanitized]] as const) {
        const file = `unit/${s.id}.${tag}.${stage}.svg`;
        fs.writeFileSync(path.join(FIX, file), svg);
        manifest.push({
          file, bundle: 'unit', stage, sample: s.id, source: s.source, sourceOrigin: s.file,
          options: opts, peleVersion: PELE_VERSION, capturedAt, environment, measurer: 'jsdom-default',
          width: a.width, height: a.height, type: a.type, mermaidType: a.mermaidType,
        });
      }
      row[tag] = {
        width: a.width, height: a.height, type: a.type,
        deterministic: a.svg === b.svg,
        fixedWidthDiffers: fw.svg !== a.svg, fixedWidthSize: [fw.width, fw.height],
        sanitizedEqualsRaw: sanitized === a.svg, rawLen: a.svg.length, sanitizedLen: sanitized.length,
        styleAttrRaw: (a.svg.match(/ style="/g) || []).length, styleAttrSan: (sanitized.match(/ style="/g) || []).length,
        styleTagRaw: (a.svg.match(/<style/g) || []).length, styleTagSan: (sanitized.match(/<style/g) || []).length,
        idsRaw: (a.svg.match(/ id="/g) || []).length, idsSan: (sanitized.match(/ id="/g) || []).length,
        peleVarRaw: (a.svg.match(/var\(--pele-/g) || []).length, peleVarSan: (sanitized.match(/var\(--pele-/g) || []).length,
        anchorHref: /<a\b[^>]*href/.test(a.svg), foreignObject: a.svg.includes('foreignObject'), script: /<script/i.test(sanitized),
      };
    }
    results.push(row);
  }

  // --- check 10: entity sample, data-diagram attribute path vs raw fence token path ---
  const md = new MarkdownIt();
  md.use(mermaidPlugin);
  const entitySrc = fs.readFileSync(path.join(SAMPLES, '17-entity.mmd'), 'utf8');
  const doc = '```mermaid\n' + entitySrc + '\n```\n';
  const token = md.parse(doc, {}).find((t) => t.type === 'fence')!;
  const holder = document.createElement('div');
  holder.innerHTML = md.render(doc);
  const attr = holder.querySelector('.mermaid-container')!.getAttribute('data-diagram')!;
  const rTok = render(token.content, { ...BASE, responsive: true });
  const rAttr = render(attr, { ...BASE, responsive: true });
  const labels = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  evidence.entity = {
    tokenContent: token.content, dataDiagramAttr: attr, inputsEqual: token.content === attr,
    tokenLabels: labels(rTok.svg), attrLabels: labels(rAttr.svg), svgEqual: rTok.svg === rAttr.svg,
  };

  // --- check 12: id uniqueness, many diagrams in one document ---
  const all = samples().filter((s) => !ERROR_SAMPLES.has(s.id));
  const collect = (prefix: boolean) => {
    const ids: string[] = [];
    all.forEach((s, i) => {
      const svg = render(s.source, { ...BASE, responsive: true, ...(prefix ? { idPrefix: `d${i}-` } : {}) }).svg;
      ids.push(...[...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    });
    const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
    return { totalIds: ids.length, duplicates: [...new Set(dup)] };
  };
  evidence.ids = { withoutIdPrefix: collect(false), withIdPrefix: collect(true) };

  // --- --pele-* variables actually emitted ---
  const vars = new Set<string>();
  for (const s of all) for (const m of render(s.source, { ...BASE }).svg.matchAll(/var\((--pele-[a-z0-9-]+)/g)) vars.add(m[1]);
  evidence.peleVarsEmitted = [...vars].sort();

  // --- links / images options (check 4, string level) ---
  const link = fs.readFileSync(path.join(SAMPLES, '19-link-click.mmd'), 'utf8');
  const img = fs.readFileSync(path.join(SAMPLES, '20-image-node.mmd'), 'utf8');
  const lOff = render(link, { ...BASE }); const lOn = render(link, { autoDirection: false, images: false });
  const iOff = render(img, { ...BASE }); const iOn = render(img, { autoDirection: false, links: false });
  evidence.linksImages = {
    linksFalse: { anchorWithHref: /<a\b[^>]*href/.test(lOff.svg), linksInfo: lOff.links },
    linksDefault: { anchorWithHref: /<a\b[^>]*href/.test(lOn.svg), linksInfo: lOn.links, sanitizedKeepsHref: /<a\b[^>]*href/.test(sanitizeSvg(lOn.svg)) },
    imagesFalse: { imageEl: /<image/.test(iOff.svg), externalUrl: iOff.svg.includes('example.com') },
    imagesDefault: { imageEl: /<image/.test(iOn.svg), externalUrl: iOn.svg.includes('example.com'), sanitizedKeepsUrl: sanitizeSvg(iOn.svg).includes('example.com') },
  };

  // --- check 13 (measure only): math label ---
  const math = render(fs.readFileSync(path.join(SAMPLES, '18-math-label.mmd'), 'utf8'), { ...BASE });
  evidence.math = { foreignObject: math.svg.includes('foreignObject'), labels: labels(math.svg), labelsAfterSanitize: labels(sanitizeSvg(math.svg)) };

  fs.writeFileSync(path.join(FIX, 'unit/errors.json'), JSON.stringify(errors, null, 2) + '\n');
  manifest.push({
    file: 'unit/errors.json', bundle: 'unit', stage: 'error', sample: [...ERROR_SAMPLES].join(','),
    source: 'see each entry.source', sourceOrigin: 'spike/pele/samples', options: { ...BASE },
    peleVersion: PELE_VERSION, capturedAt, environment, measurer: 'jsdom-default',
  });

  fs.writeFileSync(path.join(EVIDENCE, 'unit-capture.json'), JSON.stringify({ ...evidence, results, errors }, null, 2) + '\n');
  fs.writeFileSync(path.join(EVIDENCE, 'unit-manifest-part.json'), JSON.stringify(manifest, null, 2) + '\n');
  expect(manifest.length).toBeGreaterThan(0);
});
