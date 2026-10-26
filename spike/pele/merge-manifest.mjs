// SPEC-PREVIEW-015 M1 spike only (deleted in M7). Merges the two capture parts into manifest.json.
import fs from 'node:fs';
const ev = '.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/evidence/';
const u = JSON.parse(fs.readFileSync(ev + 'unit-manifest-part.json', 'utf8'));
const b = JSON.parse(fs.readFileSync(ev + 'browser-manifest-part.json', 'utf8'));
const m = { description: 'SPEC-PREVIEW-015 M1 pele 1.10.0 real-render fixtures (design.md D14). unit/ = vitest jsdom, byte-compare; browser/ = webkit canvas measurer, structural checks only. No hand-written SVG.', peleVersion: '1.10.0', entries: [...u, ...b] };
fs.writeFileSync('src/test/fixtures/pele/manifest.json', JSON.stringify(m, null, 2) + '\n');
console.log('entries', m.entries.length);
