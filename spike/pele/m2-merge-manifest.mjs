// SPEC-PREVIEW-015 M2 spike only (deleted in M7). Rebuilds manifest.json: keeps the m1-frozen entries
// verbatim (never recaptured), replaces unit/ and browser/ with the M2 capture parts.
import fs from 'node:fs';
const P = 'src/test/fixtures/pele/manifest.json';
const old = JSON.parse(fs.readFileSync(P, 'utf8'));
const frozen = old.entries.filter((e) => e.bundle === 'm1-frozen');
const u = JSON.parse(fs.readFileSync('spike/pele/m2-unit-manifest-part.json', 'utf8'));
const b = JSON.parse(fs.readFileSync('spike/pele/m2-browser-manifest-part.json', 'utf8'));
const m = {
  description:
    'SPEC-PREVIEW-015 pele 1.10.0 real-render fixtures (design.md D14). m1-frozen/ = M1 unit captures (jsdom, M1 options, shared sanitizeSvg), frozen: true, never recaptured. ' +
    'unit/ = M2 recapture under vitest jsdom with the production fixed options (fontFamily/fontFamilyMono) and sanitizeDiagramSvg, byte-compare; math entries use an injected fixed box. ' +
    'browser/ = M2 recapture in webkit (canvas measurer, app fonts loaded), structural checks only; math entries measured by getBoundingClientRect. No hand-written SVG.',
  peleVersion: '1.10.0',
  entries: [...frozen, ...u, ...b],
};
fs.writeFileSync(P, JSON.stringify(m, null, 2) + '\n');
console.log(`entries=${m.entries.length} frozen=${frozen.length} unit=${u.length} browser=${b.length}`);
