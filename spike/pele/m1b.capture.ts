// SPEC-PREVIEW-015 M1b spike only (deleted in M7).
// Run: npx vitest run --config spike/pele/vitest.capture.config.ts spike/pele/m1b.capture.ts
// jsdom half of M1b: what the unit-test path can and cannot do with a KaTeX math resolver, and
// check 2 (sanitize allowlist round-trip + DOMPurify hook isolation) against the M1 unit/ fixtures.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { it, expect } from 'vitest';
import { render } from 'pele';
import { makeKatexResolver, type ResolverLog } from './m1b/katexResolver';
import { runSanitizeChecks, type FixturePair } from './m1b/sanitizeChecks';

const ROOT = path.resolve(__dirname, '../..');
const FIX = path.join(ROOT, 'src/test/fixtures/pele');
const EV = path.join(ROOT, '.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/evidence');
const req = createRequire(import.meta.url);
const BASE = { autoDirection: false, links: false, images: false, responsive: true } as const;

function mathSamples() {
  const ids = ['18-math-label'];
  const out: { id: string; source: string }[] = ids.map((id) => ({ id, source: fs.readFileSync(path.join(ROOT, 'spike/pele/samples', `${id}.mmd`), 'utf8') }));
  for (const f of fs.readdirSync(path.join(ROOT, 'spike/pele/samples-m1b')).sort()) {
    out.push({ id: f.replace(/\.mmd$/, ''), source: fs.readFileSync(path.join(ROOT, 'spike/pele/samples-m1b', f), 'utf8') });
  }
  return out;
}

it('M1b jsdom: resolver feasibility + sanitize round-trip', () => {
  const environment = `vitest ${req('vitest/package.json').version} jsdom ${req('jsdom/package.json').version} (node ${process.version}, setup src/test/setup.ts)`;
  const ev: Record<string, unknown> = { capturedAt: new Date().toISOString(), environment, katex: req('katex/package.json').version, pele: req('pele/package.json').version };

  // --- resolver under jsdom ---
  const resolver: Record<string, unknown> = {};
  const mathRaw: Record<string, string> = {};
  for (const s of mathSamples()) {
    const row: Record<string, unknown> = {};
    for (const measure of ['dom', 'estimate'] as const) {
      for (const output of ['html', 'mathml', 'mathml-bare'] as const) {
        const log: ResolverLog[] = [];
        const r = render(s.source, { ...BASE, math: makeKatexResolver({ output, measure, log }) });
        row[`${measure}-${output}`] = {
          foreignObjects: (r.svg.match(/<foreignObject class="pele-math"/g) || []).length,
          rawDollarTextLeft: (r.svg.match(/\$\$/g) || []).length / 2,
          width: r.width, height: r.height, calls: log,
        };
        if (measure === 'estimate') mathRaw[`${s.id}.${output}`] = r.svg;
      }
    }
    // same render twice -> deterministic?
    const a = render(s.source, { ...BASE, math: makeKatexResolver({ output: 'html', measure: 'estimate' }) }).svg;
    const b = render(s.source, { ...BASE, math: makeKatexResolver({ output: 'html', measure: 'estimate' }) }).svg;
    row.estimateDeterministic = a === b;
    resolver[s.id] = row;
  }
  ev.resolver = resolver;

  // --- check 2 against M1 unit fixtures (jsdom-default measurer, no math) ---
  const manifest = JSON.parse(fs.readFileSync(path.join(FIX, 'manifest.json'), 'utf8'));
  const pairs: FixturePair[] = [];
  for (const e of manifest.entries) {
    if (e.bundle !== 'unit' || e.stage !== 'raw') continue;
    const sanFile = e.file.replace('.raw.svg', '.sanitized.svg');
    pairs.push({ file: e.file, raw: fs.readFileSync(path.join(FIX, e.file), 'utf8'), sanitized: fs.readFileSync(path.join(FIX, sanFile), 'utf8') });
  }
  ev.sanitize = runSanitizeChecks(pairs, mathRaw);

  fs.writeFileSync(path.join(EV, 'm1b-unit.json'), JSON.stringify(ev, null, 2) + '\n');
  const s = ev.sanitize as { a_before: { mismatches: string[] }; a_final: { mismatches: string[] } };
  console.log(`m1b-unit pairs=${pairs.length} a_before.mismatches=${s.a_before.mismatches.length} a_final.mismatches=${s.a_final.mismatches.length}`);
  expect(pairs.length).toBeGreaterThan(0);
});
