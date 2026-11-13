// SPEC-AI-017 스파이크 (a)+(b) — 실제 문서의 표·다이어그램에서 "누른 대상이 소스에서 하나로 찾아지는가"를 잰다.
// 실행: node .moai/specs/SPEC-AI-017-preview-pointing/spike/targeting-rate.mjs <저장소 루트>
// 결과: 같은 폴더 targeting-rate.json 에 저장해 둔 값이 이 스크립트의 출력이다.
import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { render } from 'pele';

const root = process.argv[2] ?? '.';
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      // 이 SPEC 자신의 문서(표·예시)는 측정 대상에서 뺀다.
      if (e.name !== 'node_modules' && e.name !== 'SPEC-AI-017-preview-pointing') walk(p);
    } else if (p.endsWith('.md')) files.push(p);
  }
}
for (const d of ['.moai/specs', 'docs', 'README.md', '.moai/project']) {
  const p = path.join(root, d);
  if (!fs.existsSync(p)) continue;
  if (fs.statSync(p).isDirectory()) walk(p);
  else files.push(p);
}
const md = new MarkdownIt();
md.enable('table');

// tableValidate.ts splitRow 와 같은 규칙(markdown-it escapedSplit 대응).
function splitRow(line) {
  const cells = [];
  let cur = '';
  let last = 0;
  let esc = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '|') {
      if (esc) {
        cur += line.slice(last, i - 1);
        last = i;
      } else {
        cells.push(cur + line.slice(last, i));
        cur = '';
        last = i + 1;
      }
    }
    esc = ch === '\\';
  }
  cells.push(cur + line.slice(last));
  if (cells.length && cells[0].trim() === '') cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map((c) => c.trim());
}

const T = {
  tables: 0,
  nestedInListOrQuote: 0,
  tablesWithRowMap: 0,
  rows: 0,
  rowsSourceCellCountDiffersFromRendered: 0,
  headerCols: 0,
  headerTextUniqueInTable: 0,
  emptyHeader: 0,
  bodyCells: 0,
  bodyCellTextUniqueInTable: 0,
  // 최상위 표 블록 길이(UTF-16 길이, 표 줄 전체) — D9·D10 판단 근거
  topLevelTables: 0,
  topLevelOver2000: 0,
  topLevelOver6000: 0,
  topLevelOver12000: 0,
  topLevelMaxChars: 0,
};
const D = {
  blocks: 0,
  rendered: 0,
  renderFailed: 0,
  byType: {},
  nodes: 0,
  nodeIdFoundInSource: 0,
  nodeIdOnExactlyOneLine: 0,
  nodeIdOnSeveralLines: 0,
  nodeIdNotInSource: 0,
  clusters: 0,
  clusterIdFoundInSource: 0,
  edges: 0,
  edgeIdPatternL: 0,
  renderFailures: [],
  notInSourceSamples: [],
  topLevelFenceMaxChars: 0,
  fencesNestedInListOrQuote: 0,
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const toks = md.parse(src, {});
  let depth = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (/^(blockquote|bullet_list|ordered_list)_open$/.test(t.type)) depth++;
    if (/^(blockquote|bullet_list|ordered_list)_close$/.test(t.type)) depth--;

    if (t.type === 'table_open') {
      T.tables++;
      if (depth > 0) T.nestedInListOrQuote++;
      else {
        const len = lines.slice(t.map[0], t.map[1]).join('\n').length;
        T.topLevelTables++;
        if (len > 2000) T.topLevelOver2000++;
        if (len > 6000) T.topLevelOver6000++;
        if (len > 12000) T.topLevelOver12000++;
        T.topLevelMaxChars = Math.max(T.topLevelMaxChars, len);
      }
      let rowsOk = true;
      let header = null;
      const body = [];
      for (let j = i + 1; j < toks.length && toks[j].type !== 'table_close'; j++) {
        const r = toks[j];
        if (r.type !== 'tr_open') continue;
        T.rows++;
        if (!r.map) {
          rowsOk = false;
          continue;
        }
        let n = 0;
        for (let k = j + 1; toks[k].type !== 'tr_close'; k++) if (/^t[hd]_open$/.test(toks[k].type)) n++;
        if (depth > 0) continue; // 들여쓴 표는 접두어를 벗겨야 해서 따로 센다(위 nested 수)
        const cells = splitRow(lines[r.map[0]]);
        if (cells.length !== n) T.rowsSourceCellCountDiffersFromRendered++;
        if (header === null) header = cells;
        else body.push(...cells);
      }
      if (rowsOk) T.tablesWithRowMap++;
      if (header) {
        const cnt = {};
        header.forEach((h) => (cnt[h] = (cnt[h] || 0) + 1));
        T.headerCols += header.length;
        T.headerTextUniqueInTable += header.filter((h) => cnt[h] === 1).length;
        T.emptyHeader += header.filter((h) => h === '').length;
        const c2 = {};
        body.forEach((x) => (c2[x] = (c2[x] || 0) + 1));
        T.bodyCells += body.length;
        T.bodyCellTextUniqueInTable += body.filter((x) => c2[x] === 1).length;
      }
    }

    if (t.type === 'fence' && t.info.trim() === 'mermaid') {
      D.blocks++;
      const code = t.content;
      if (depth > 0) D.fencesNestedInListOrQuote++;
      D.topLevelFenceMaxChars = Math.max(D.topLevelFenceMaxChars, depth > 0 ? 0 : code.length);
      let r;
      try {
        r = render(code, { links: false, images: false, autoDirection: false });
      } catch (err) {
        D.renderFailed++;
        D.renderFailures.push(path.basename(path.dirname(f)) + ': ' + String(err.message || err).slice(0, 90));
        continue;
      }
      D.rendered++;
      const ty = r.type || r.mermaidType;
      D.byType[ty] = D.byType[ty] || { blocks: 0, nodes: 0, nodeIdInSource: 0, clusters: 0, edges: 0 };
      D.byType[ty].blocks++;
      const grab = (cls) =>
        // class 는 "pele-node pele-shape-rect" 처럼 보조 클래스가 붙는다 — 첫 토큰만 맞춘다.
        [...r.svg.matchAll(new RegExp('<g class="' + cls + '(?: [^"]*)?"[^>]*data-id="([^"]*)"', 'g'))].map((m) => m[1]);
      const nodes = grab('pele-node');
      const clusters = grab('pele-cluster');
      const edges = grab('pele-edge');
      D.byType[ty].nodes += nodes.length;
      D.byType[ty].clusters += clusters.length;
      D.byType[ty].edges += edges.length;
      const codeLines = code.split('\n');
      for (const id of nodes) {
        D.nodes++;
        const re = new RegExp('(^|[^\\p{L}\\p{N}_])' + esc(id) + '($|[^\\p{L}\\p{N}_])', 'u');
        const hits = codeLines.filter((l) => re.test(l)).length;
        if (hits > 0) {
          D.nodeIdFoundInSource++;
          D.byType[ty].nodeIdInSource++;
        } else {
          D.nodeIdNotInSource++;
          if (D.notInSourceSamples.length < 8) D.notInSourceSamples.push(ty + ':' + id);
        }
        if (hits === 1) D.nodeIdOnExactlyOneLine++;
        if (hits > 1) D.nodeIdOnSeveralLines++;
      }
      for (const id of clusters) {
        D.clusters++;
        if (code.includes(id)) D.clusterIdFoundInSource++;
      }
      for (const id of edges) {
        D.edges++;
        if (/^L_.+_.+_\d+$/.test(id)) D.edgeIdPatternL++;
      }
    }
  }
}
D.renderFailures = D.renderFailures.slice(0, 10);
console.log(JSON.stringify({ files: files.length, table: T, diagram: D }, null, 1));
