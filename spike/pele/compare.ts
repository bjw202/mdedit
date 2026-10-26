// SPEC-PREVIEW-015 M1 spike only (deleted in M7).
// Browser-side harness driven by spike/pele/run-browser.mjs (Playwright webkit).
// Exposes window.M1 with small primitives; the driver composes the checks.
import mermaid from 'mermaid';
import { render, PeleError } from 'pele';
import MarkdownIt from 'markdown-it';
import { sanitizeSvg } from '../../src/lib/preview/svgSanitize';
import { mermaidPlugin } from '../../src/lib/markdown/mermaidPlugin';
import { getPreviewCss, buildHtmlDocument } from '../../src/lib/export/exportUtils';
import '../../src/styles/mdedit-tokens.css';

const raw = import.meta.glob('./samples/*.mmd', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const SAMPLES = Object.entries(raw)
  .map(([k, source]) => ({ id: k.replace('./samples/', '').replace('.mmd', ''), source }))
  .sort((a, b) => a.id.localeCompare(b.id));

const BASE = { autoDirection: false, links: false, images: false } as const;
// Same base config as PreviewRenderer.tsx:29 (+ theme as :110).
const MERMAID_BASE_CONFIG = { startOnLoad: false, securityLevel: 'strict' as const };

// Provisional --pele-* -> --md-* mapping (proposal for design.md D5, NOT decided).
// Fonts are deliberately not mapped: pele measures text with its fontFamily option, so mapping
// --pele-font without passing the same fontFamily would desync measured and displayed widths.
export const PELE_TO_MD: Record<string, string> = {
  '--pele-bg': '--md-bg',
  '--pele-fg': '--md-text-primary',
  '--pele-muted': '--md-text-muted',
  '--pele-line': '--md-text-muted',
  '--pele-surface': '--md-surface',
  '--pele-surface-alt': '--md-surface-raised',
  '--pele-border': '--md-border-strong',
  '--pele-accent': '--md-accent',
  '--pele-error': '--md-danger',
  '--pele-critical': '--md-danger',
};

const violations: { phase: string; directive: string; blocked: string; sample?: string }[] = [];
let phase = 'init';
document.addEventListener('securitypolicyviolation', (e) => {
  violations.push({ phase, directive: e.violatedDirective, blocked: e.blockedURI });
});

function peleErr(e: unknown) {
  return e instanceof PeleError
    ? { code: e.code, message: e.message, line: e.line, column: e.column }
    : { code: 'non-pele', message: String(e), line: 0, column: 0 };
}

function pele(source: string, opts: Record<string, unknown> = {}) {
  try {
    const r = render(source, { ...BASE, ...opts });
    return { ok: true as const, svg: r.svg, width: r.width, height: r.height, type: r.type, mermaidType: r.mermaidType };
  } catch (e) {
    return { ok: false as const, error: peleErr(e) };
  }
}

let mid = 0;
async function mermaidRender(source: string, theme: 'light' | 'dark') {
  mermaid.initialize({ ...MERMAID_BASE_CONFIG, theme: theme === 'dark' ? 'dark' : 'default' });
  try {
    await mermaid.parse(source);
    const { svg } = await mermaid.render(`mermaid-m1-${mid++}`, source);
    return { ok: true as const, svg };
  } catch (e) {
    return { ok: false as const, error: String((e as Error)?.message ?? e) };
  }
}

function tokens(theme: 'light' | 'dark') {
  const probe = document.createElement('div');
  probe.setAttribute('data-theme', theme);
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out: Record<string, string> = {};
  for (const [p, m] of Object.entries(PELE_TO_MD)) out[p] = cs.getPropertyValue(m).trim();
  probe.remove();
  return out;
}

// Replace every var(--pele-NAME,FALLBACK) with the table value (or its fallback) — design.md D6.
function literalize(svg: string, table: Record<string, string>) {
  return svg.replace(/var\((--pele-[a-z0-9-]+)\s*,\s*([^()]*)\)/g, (_m, name: string, fb: string) => table[name] || fb.trim());
}

function styleVars(table: Record<string, string>) {
  return Object.entries(table).map(([k, v]) => `${k}:${v}`).join(';');
}

function mount(html: string, opts: { width?: number; theme?: 'light' | 'dark'; vars?: boolean } = {}) {
  const host = document.getElementById('stage')!;
  const el = document.createElement('div');
  el.style.width = `${opts.width ?? 800}px`;
  if (opts.theme) {
    el.setAttribute('data-theme', opts.theme);
    el.style.background = opts.theme === 'dark' ? '#191b1d' : '#f2f2f3';
    if (opts.vars) el.setAttribute('style', `${el.getAttribute('style')};${styleVars(tokens(opts.theme))}`);
  }
  el.innerHTML = html;
  host.appendChild(el);
  return el;
}

function clear() {
  document.getElementById('stage')!.innerHTML = '';
}

function rectOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}

function overlap(a: ReturnType<typeof rectOf>, b: ReturnType<typeof rectOf>) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// Layout geometry of a mounted pele SVG: cluster title lines/overlap, node label overflow.
function geometry(el: Element) {
  const svg = el.querySelector('svg');
  if (!svg) return null;
  const clusters = [...svg.querySelectorAll('.pele-cluster')].map((c) => ({ id: c.getAttribute('data-id'), rect: rectOf(c.querySelector('rect')!) }));
  const titles = [...svg.querySelectorAll('.pele-cluster-label')].map((t) => ({
    text: t.textContent, tspans: t.querySelectorAll('tspan').length, rect: rectOf(t),
  }));
  const clusterOverlaps: string[] = [];
  for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
    if (overlap(clusters[i].rect, clusters[j].rect)) clusterOverlaps.push(`${clusters[i].id}~${clusters[j].id}`);
  }
  const titleFits = titles.map((t, i) => {
    const c = clusters.find((cl) => t.rect.x >= cl.rect.x - 1 && t.rect.x + t.rect.w <= cl.rect.x + cl.rect.w + 1);
    return { i, fitsInsideSomeCluster: !!c };
  });
  const labelOverflow: string[] = [];
  for (const n of svg.querySelectorAll('.pele-node')) {
    const shape = n.querySelector('rect,polygon,path,circle,ellipse');
    const label = n.querySelector('text');
    if (!shape || !label) continue;
    const s = rectOf(shape), l = rectOf(label);
    if (l.x < s.x - 1 || l.x + l.w > s.x + s.w + 1) labelOverflow.push(n.getAttribute('data-id') ?? '?');
  }
  const svgRect = rectOf(svg);
  return { clusters, titles, clusterOverlaps, titleFits, labelOverflow, svgRect };
}

function nodePositions(svg: string) {
  return [...svg.matchAll(/data-id="([^"]+)" transform="translate\(([-\d.]+),([-\d.]+)\)"/g)].map((m) => [m[1], +m[2], +m[3]]);
}

// Same data-URI -> Image -> canvas path as src/lib/export/exportDocx.ts:154-201, but sized by
// pele width/height (design.md D8) instead of getBoundingClientRect.
async function svgToPng(svgString: string, width: number, height: number) {
  const holder = mount(svgString);
  const svg = holder.querySelector('svg')!;
  const svgData = new XMLSerializer().serializeToString(svg);
  holder.remove();
  const utf8Bytes = new TextEncoder().encode(svgData);
  let binaryStr = '';
  for (let i = 0; i < utf8Bytes.length; i++) binaryStr += String.fromCharCode(utf8Bytes[i]);
  const dataUri = `data:image/svg+xml;base64,${btoa(binaryStr)}`;
  return new Promise<{ ok: boolean; png?: string; stats?: ReturnType<typeof pixelStats>; reason?: string }>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve({ ok: false, reason: 'no 2d context' });
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, width, height);
      resolve({ ok: true, png: canvas.toDataURL('image/png'), stats: pixelStats(ctx, canvas.width, canvas.height) });
    };
    img.onerror = () => resolve({ ok: false, reason: 'image load error' });
    img.src = dataUri;
  });
}

function pixelStats(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let opaque = 0, colored = 0, dark = 0, light = 0;
  const hues = new Set<string>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    opaque++;
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn > 40) { colored++; hues.add(`${r >> 5},${g >> 5},${b >> 5}`); }
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < 80) dark++; else if (lum > 200) light++;
  }
  return { pixels: w * h, opaque, colored, coloredBuckets: hues.size, dark, light };
}

function exportHtml(sources: string[], svgs: string[], theme: 'light' | 'dark') {
  const md = new MarkdownIt();
  md.use(mermaidPlugin);
  const doc = '# pele 내보내기 시제품\n\n' + sources.map((s, i) => `## 다이어그램 ${i + 1}\n\n\`\`\`mermaid\n${s}\n\`\`\`\n`).join('\n');
  const holder = document.createElement('div');
  holder.innerHTML = md.render(doc);
  holder.querySelectorAll('.mermaid-container').forEach((el, i) => { el.innerHTML = svgs[i] ?? ''; });
  return buildHtmlDocument({ title: `pele-export-${theme}`, content: holder.innerHTML, css: getPreviewCss(theme), theme });
}

async function timing(engine: 'mermaid' | 'pele', sources: string[], theme: 'light' | 'dark' = 'light') {
  clear();
  const containers = sources.map(() => mount('', { width: 800 }));
  const per: number[] = [];
  const t0 = performance.now();
  if (engine === 'pele') {
    sources.forEach((s, i) => {
      const a = performance.now();
      const r = render(s, { ...BASE, responsive: true });
      containers[i].innerHTML = sanitizeSvg(r.svg);
      per.push(performance.now() - a);
    });
  } else {
    // Mirrors PreviewRenderer.tsx:110-131 (initialize once, forEach async parse+render).
    mermaid.initialize({ ...MERMAID_BASE_CONFIG, theme: theme === 'dark' ? 'dark' : 'default' });
    await Promise.all(sources.map(async (s, i) => {
      const a = performance.now();
      await mermaid.parse(s);
      const { svg } = await mermaid.render(`mermaid-t-${mid++}`, s);
      containers[i].innerHTML = svg;
      per.push(performance.now() - a);
    }));
  }
  const total = performance.now() - t0;
  // force layout so the cost of the inserted SVG is included
  void document.body.offsetHeight;
  const withLayout = performance.now() - t0;
  return { engine, count: sources.length, totalMs: total, totalWithLayoutMs: withLayout, firstMs: per[0], maxMs: Math.max(...per) };
}

declare global { interface Window { M1: unknown } }
window.M1 = {
  samples: SAMPLES, BASE, PELE_TO_MD,
  pele, mermaidRender, tokens, literalize, sanitize: sanitizeSvg, mount, clear, geometry, nodePositions,
  svgToPng, exportHtml, timing,
  violations: () => violations.slice(), setPhase: (p: string) => { phase = p; },
  version: { pele: '1.10.0' },
};
document.title = 'pele M1 spike ready';
