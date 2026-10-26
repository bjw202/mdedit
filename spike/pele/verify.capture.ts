// SPEC-PREVIEW-015 M1 spike only (deleted in M7). Rehearsal of AC-PREVIEW015-002 against the
// captured manifest: unit/ entries re-render byte-identically; browser/ entries pass structural checks.
import fs from 'node:fs';
import path from 'node:path';
import { it, expect } from 'vitest';
import { render } from 'pele';
import { sanitizeSvg } from '../../src/lib/preview/svgSanitize';

const FIX = path.resolve(__dirname, '../../src/test/fixtures/pele');
const manifest = JSON.parse(fs.readFileSync(path.join(FIX, 'manifest.json'), 'utf8'));

it('unit entries re-render byte-identically, browser entries keep structure', () => {
  let unitChecked = 0, browserChecked = 0;
  const mismatches: string[] = [];
  for (const e of manifest.entries) {
    for (const k of ['file', 'source', 'options', 'peleVersion', 'capturedAt', 'environment', 'measurer']) expect(e[k], `${e.file}.${k}`).toBeTruthy();
    if (e.stage === 'error') continue;
    const stored = fs.readFileSync(path.join(FIX, e.file), 'utf8');
    if (e.bundle === 'unit') {
      const r = render(e.source, e.options).svg;
      const now = e.stage === 'sanitized' ? sanitizeSvg(r) : r;
      if (now !== stored) mismatches.push(e.file);
      unitChecked++;
    } else {
      expect(stored.startsWith('<svg')).toBe(true);
      expect(/<script/i.test(stored)).toBe(false);
      browserChecked++;
    }
  }
  console.log(`unitChecked=${unitChecked} browserChecked=${browserChecked} mismatches=${mismatches.length}`);
  expect(mismatches).toEqual([]);
});
