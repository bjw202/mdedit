// SPEC-PREVIEW-015 M2 spike only (deleted in M7).
// Run: npx vitest run --config spike/pele/vitest.capture.config.ts spike/pele/m2-unit.capture.ts
// Recaptures the `unit/` fixture bundle with the production fixed options (incl. fontFamily /
// fontFamilyMono, design.md D5) under the SAME jsdom + setup file as the unit tests (measurer
// `jsdom-default`, D14), sanitized with the production diagram sanitize path. Math samples use the
// production mathml-bare resolver markup with an INJECTED fixed box (jsdom measures 0, M1b 1a).
// Writes unit/ files + spike/pele/m2-unit-manifest-part.json. m1-frozen/ is never touched.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { it, expect } from 'vitest';
import { render, PeleError } from 'pele';
import { PELE_RENDER_OPTIONS, sanitizeDiagramSvg, katexMathMarkup } from '../../src/lib/diagram/diagramRenderer';

const ROOT = path.resolve(__dirname, '../..');
const FIX = path.join(ROOT, 'src/test/fixtures/pele');
const UNIT = path.join(FIX, 'unit');
const req = createRequire(import.meta.url);
const PELE_VERSION = req('pele/package.json').version as string;
const ERROR_IDS = new Set(['11-ai-mock-invalid', '21-error-line-col', '22-error-line0-semantic', '23-error-xss-label']);
const MATH_BOX = { width: 48, height: 20 } as const;

function samples() {
  const dirs = [['spike/pele/samples', ''], ['spike/pele/samples-m1b', '']] as const;
  return dirs.flatMap(([dir]) =>
    fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.mmd')).sort().map((f) => ({
      id: f.replace(/\.mmd$/, ''), file: `${dir}/${f}`, source: fs.readFileSync(path.join(ROOT, dir, f), 'utf8'),
    })),
  );
}

it('recaptures unit/ fixtures with M2 fixed options', () => {
  fs.mkdirSync(UNIT, { recursive: true });
  const capturedAt = new Date().toISOString();
  const environment = `vitest ${req('vitest/package.json').version} jsdom ${req('jsdom/package.json').version} (node ${process.version}, setup src/test/setup.ts)`;
  const options = { ...PELE_RENDER_OPTIONS };
  const entries: Record<string, unknown>[] = [];
  const errors: Record<string, unknown>[] = [];
  const mathResolver = (tex: string) => {
    const html = katexMathMarkup(tex);
    return html ? { html, ...MATH_BOX } : null;
  };

  for (const s of samples()) {
    if (ERROR_IDS.has(s.id)) {
      try { render(s.source, options); errors.push({ id: s.id, source: s.source, rendered: true }); }
      catch (e) {
        const pe = e as PeleError;
        errors.push({ id: s.id, source: s.source, rendered: false, error: { isPeleError: e instanceof PeleError, code: pe.code, message: pe.message, line: pe.line, column: pe.column } });
      }
      continue;
    }
    const hasMath = /\$\$(.+?)\$\$/.test(s.source);
    const r = render(s.source, { ...options, math: mathResolver });
    const again = render(s.source, { ...options, math: mathResolver });
    expect(again.svg, `${s.id} deterministic`).toBe(r.svg);
    const sanitized = sanitizeDiagramSvg(r.svg);
    for (const [stage, svg] of [['raw', r.svg], ['sanitized', sanitized]] as const) {
      const file = `unit/${s.id}.${stage}.svg`;
      fs.writeFileSync(path.join(FIX, file), svg);
      entries.push({
        file, bundle: 'unit', stage, sample: s.id, source: s.source, sourceOrigin: s.file,
        options, peleVersion: PELE_VERSION, capturedAt, environment, measurer: 'jsdom-default',
        ...(stage === 'sanitized' ? { sanitizer: 'sanitizeDiagramSvg (src/lib/diagram/diagramRenderer.ts)' } : {}),
        ...(hasMath ? { math: { method: 'injected-fixed', ...MATH_BOX, resolver: 'katexMathMarkup mathml-bare (output mathml, trust false)', note: 'jsdom measures 0 (M1b 1a); box injected, size not asserted' } } : {}),
        width: r.width, height: r.height, type: r.type, mermaidType: r.mermaidType,
      });
    }
  }
  fs.writeFileSync(path.join(UNIT, 'errors.json'), JSON.stringify(errors, null, 2) + '\n');
  entries.push({
    file: 'unit/errors.json', bundle: 'unit', stage: 'error', sample: [...ERROR_IDS].join(','),
    source: 'see each entry.source', sourceOrigin: 'spike/pele/samples', options, peleVersion: PELE_VERSION,
    capturedAt, environment, measurer: 'jsdom-default',
  });
  fs.writeFileSync(path.join(ROOT, 'spike/pele/m2-unit-manifest-part.json'), JSON.stringify(entries, null, 2) + '\n');
  console.log(`m2-unit entries=${entries.length} svgFiles=${entries.filter((e) => e.stage !== 'error').length} errors=${errors.length}`);
  expect(entries.length).toBeGreaterThan(0);
});
