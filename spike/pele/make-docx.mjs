// SPEC-PREVIEW-015 M1 spike only (deleted in M7). Builds DOCX prototypes from the PNGs that
// run-browser.mjs produced via the exportDocx.ts data-URI -> Image -> canvas path.
// Insert size follows exportDocx.ts (0.75x of the 1x CSS size; PNG itself is 2x).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, Packer, Paragraph, ImageRun, HeadingLevel } from 'docx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M1 = path.join(ROOT, '.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1');
const run = JSON.parse(fs.readFileSync(path.join(M1, 'evidence/browser-run.json'), 'utf8'));
const made = [];
for (const [key, pngs] of Object.entries(run.exports.docx)) {
  const children = [new Paragraph({ text: `pele DOCX 시제품 (${key})`, heading: HeadingLevel.HEADING_1 })];
  for (const p of pngs) {
    children.push(new Paragraph({ text: p.id, heading: HeadingLevel.HEADING_2 }));
    if (!p.ok) { children.push(new Paragraph({ text: `변환 실패: ${p.reason}` })); continue; }
    children.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: fs.readFileSync(path.join(M1, p.file)), transformation: { width: Math.round(p.width * 0.75), height: Math.round(p.height * 0.75) } })] }));
  }
  const buf = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  const f = path.join(M1, `exports/docx-${key}.docx`);
  fs.writeFileSync(f, buf);
  made.push({ file: path.relative(M1, f), bytes: buf.length });
}
console.log(JSON.stringify(made));
