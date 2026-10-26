// SPEC-PREVIEW-015 M1b spike only (deleted in M7).
// Browser harness for the M1b math-resolver checks, driven by spike/pele/run-m1b.mjs.
// KaTeX CSS is loaded the SAME way the app loads it (src/main.tsx:6 `import 'katex/dist/katex.min.css'`).
import 'katex/dist/katex.min.css';
import '../../src/styles/mdedit-tokens.css';
import mermaid from 'mermaid';
import { render } from 'pele';
import katex from 'katex';
import MarkdownIt from 'markdown-it';
import { sanitizeSvg } from '../../src/lib/preview/svgSanitize';
import { mermaidPlugin } from '../../src/lib/markdown/mermaidPlugin';
import { getPreviewCss, buildHtmlDocument } from '../../src/lib/export/exportUtils';
import { makeKatexResolver, makeTexTextResolver, measureInDom, katexMarkup, type ResolverLog, type MathOutput, type Measure } from './m1b/katexResolver';
import { createDiagramPurifier } from './m1b/diagramSanitize';
import { runSanitizeChecks, type FixturePair } from './m1b/sanitizeChecks';

const raw18 = import.meta.glob('./samples/18-math-label.mmd', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const rawB = import.meta.glob('./samples-m1b/*.mmd', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const SAMPLES = Object.entries({ ...raw18, ...rawB })
  .map(([k, source]) => ({ id: k.replace(/^.*\//, '').replace('.mmd', ''), source }))
  .sort((a, b) => a.id.localeCompare(b.id));

const BASE = { autoDirection: false, links: false, images: false, responsive: true } as const;
const MERMAID_BASE_CONFIG = { startOnLoad: false, securityLevel: 'strict' as const };
const PELE_TO_MD: Record<string, string> = {
  '--pele-bg': '--md-bg', '--pele-fg': '--md-text-primary', '--pele-muted': '--md-text-muted', '--pele-line': '--md-text-muted',
  '--pele-surface': '--md-surface', '--pele-surface-alt': '--md-surface-raised', '--pele-border': '--md-border-strong',
  '--pele-accent': '--md-accent', '--pele-error': '--md-danger', '--pele-critical': '--md-danger',
};

const violations: { phase: string; directive: string; blocked: string; sample: string }[] = [];
let phase = 'init';
document.addEventListener('securitypolicyviolation', (e) => {
  violations.push({ phase, directive: e.violatedDirective, blocked: e.blockedURI, sample: (e.sample || '').slice(0, 80) });
});

// Cold measurement: run the resolver once at module start, before any KaTeX font has loaded.
const coldLog: ResolverLog[] = [];
const coldFontsStatus = [...(document.fonts as unknown as Iterable<FontFace>)].filter((f) => f.family.includes('KaTeX')).map((f) => f.status);
for (const s of SAMPLES) render(s.source, { ...BASE, math: makeKatexResolver({ output: 'html', measure: 'dom', log: coldLog }) });

function pele(source: string, o: { output?: MathOutput | 'textsvg' | 'none'; measure?: Measure } = {}) {
  const log: ResolverLog[] = [];
  const math = o.output === 'none' ? undefined
    : o.output === 'textsvg' ? makeTexTextResolver(log)
    : makeKatexResolver({ output: o.output ?? 'html', measure: o.measure ?? 'dom', log });
  const r = render(source, { ...BASE, ...(math ? { math } : {}) });
  return { svg: r.svg, width: r.width, height: r.height, log };
}

let mid = 0;
async function mermaidRender(source: string, theme: 'light' | 'dark') {
  mermaid.initialize({ ...MERMAID_BASE_CONFIG, theme: theme === 'dark' ? 'dark' : 'default' });
  try { await mermaid.parse(source); const { svg } = await mermaid.render(`mermaid-m1b-${mid++}`, source); return { ok: true, svg }; }
  catch (e) { return { ok: false, error: String((e as Error)?.message ?? e) }; }
}

function tokens(theme: 'light' | 'dark') {
  const probe = document.createElement('div'); probe.setAttribute('data-theme', theme); document.body.appendChild(probe);
  const cs = getComputedStyle(probe); const out: Record<string, string> = {};
  for (const [p, m] of Object.entries(PELE_TO_MD)) out[p] = cs.getPropertyValue(m).trim();
  probe.remove(); return out;
}

function mount(html: string, o: { theme?: 'light' | 'dark'; width?: number } = {}) {
  const host = document.getElementById('stage')!;
  const el = document.createElement('div');
  const theme = o.theme ?? 'light';
  el.setAttribute('data-theme', theme);
  if (theme === 'dark') el.classList.add('dark');
  const vars = Object.entries(tokens(theme)).map(([k, v]) => `${k}:${v}`).join(';');
  el.setAttribute('style', `width:${o.width ?? 640}px;padding:8px;background:${theme === 'dark' ? '#191b1d' : '#f2f2f3'};color:${theme === 'dark' ? '#e5e7eb' : '#111827'};${vars}`);
  el.innerHTML = html;
  host.appendChild(el);
  return el;
}
/** foreignObject rects relative to the mounted host element (for screenshot pixel checks). */
function foRectsIn(el: Element) {
  const h = el.getBoundingClientRect();
  return [...el.querySelectorAll('foreignObject.pele-math')].map((f) => { const r = f.getBoundingClientRect(); return [r.x - h.x, r.y - h.y, r.width, r.height]; });
}
function stripMath(el: Element) { el.querySelectorAll('foreignObject.pele-math').forEach((f) => f.remove()); }

/** Where did the math actually PAINT? Diff a screenshot with math against one without; report how many
 *  changed pixels fall inside the foreignObject rects (layout boxes) vs outside them. */
async function paintCheck(withPng: string, withoutPng: string, rects: number[][]) {
  const load = (src: string) => new Promise<HTMLImageElement>((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const [a, b] = await Promise.all([load(withPng), load(withoutPng)]);
  const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
  const px = (img: HTMLImageElement) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!; x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
  const A = px(a), B = px(b);
  let inside = 0, outside = 0;
  const pad = 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) < 60) continue;
    const inRect = rects.some(([rx, ry, rw, rh]) => x >= rx - pad && x <= rx + rw + pad && y >= ry - pad && y <= ry + rh + pad);
    if (inRect) inside++; else outside++;
  }
  return { changedInside: inside, changedOutside: outside, insideRatio: inside + outside ? +(inside / (inside + outside)).toFixed(3) : null };
}
function clear() { document.getElementById('stage')!.innerHTML = ''; }

/** Does the KaTeX box fit the foreignObject box pele reserved? */
function fit(el: Element) {
  return [...el.querySelectorAll('foreignObject.pele-math')].map((fo) => {
    const f = fo.getBoundingClientRect();
    const k = (fo.querySelector('.katex') ?? fo.querySelector('math') ?? fo.firstElementChild)!.getBoundingClientRect();
    const katexHtml = fo.querySelector('.katex-html');
    return {
      fo: [+f.width.toFixed(1), +f.height.toFixed(1)], katex: [+k.width.toFixed(1), +k.height.toFixed(1)],
      overflowX: +(k.width - f.width).toFixed(1), overflowY: +(k.height - f.height).toFixed(1),
      katexHtmlFont: katexHtml ? getComputedStyle(katexHtml.querySelector('.mord') ?? katexHtml).fontFamily : null,
      mathmlDisplayed: !!fo.querySelector('math') && getComputedStyle(fo.querySelector('math')!).display !== 'none',
    };
  });
}

/** Load every KaTeX @font-face so CSP sees each font request; report per-face status. */
async function loadKatexFonts() {
  const faces = [...(document.fonts as unknown as Iterable<FontFace>)].filter((f) => f.family.replace(/"/g, '').startsWith('KaTeX'));
  const res = await Promise.all(faces.map(async (f) => {
    try { await f.load(); return { family: f.family, weight: f.weight, style: f.style, status: f.status }; }
    catch (e) { return { family: f.family, weight: f.weight, style: f.style, status: `error: ${String(e)}` }; }
  }));
  await document.fonts.ready;
  return res;
}

// Same data-URI -> Image -> canvas path as src/lib/export/exportDocx.ts:154-201 (+ toDataURL and toBlob).
async function svgToPng(svgString: string, width: number, height: number) {
  const holder = mount(svgString);
  const svg = holder.querySelector('svg')!;
  // foreignObject rects in SVG user units (width/height space), from the mounted layout.
  const sr = svg.getBoundingClientRect(); const k = width / sr.width;
  const foRects = [...svg.querySelectorAll('foreignObject.pele-math')].map((f) => { const r = f.getBoundingClientRect(); return [(r.x - sr.x) * k, (r.y - sr.y) * k, r.width * k, r.height * k]; });
  const svgData = new XMLSerializer().serializeToString(svg);
  holder.remove();
  const bytes = new TextEncoder().encode(svgData);
  let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const dataUri = `data:image/svg+xml;base64,${btoa(bin)}`;
  return new Promise<Record<string, unknown>>((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
      const ctx = canvas.getContext('2d')!; ctx.scale(2, 2); ctx.drawImage(img, 0, 0, width, height);
      const out: Record<string, unknown> = { loaded: true, dataUriBytes: dataUri.length };
      try { out.png = canvas.toDataURL('image/png'); out.toDataURL = 'ok'; } catch (e) { out.toDataURL = `${(e as Error).name}: ${(e as Error).message}`; }
      out.toBlob = await new Promise((r) => { try { canvas.toBlob((b) => r(b ? `ok ${b.size}B` : 'null blob'), 'image/png'); } catch (e) { r(`${(e as Error).name}: ${(e as Error).message}`); } });
      try {
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const region = (x: number, y: number, w: number, h: number) => {
          let ink = 0, opaque = 0;
          for (let yy = Math.floor(y * 2); yy < Math.ceil((y + h) * 2); yy++) for (let xx = Math.floor(x * 2); xx < Math.ceil((x + w) * 2); xx++) {
            const i = (yy * canvas.width + xx) * 4; if (d[i + 3] > 128) { opaque++; const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; if (lum < 120) ink++; }
          }
          return { ink, opaque };
        };
        let ink = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] < 120) ink++;
        out.inkPixelsTotal = ink; out.foRects = foRects; out.foRegions = foRects.map(([x, y, w, h]) => region(Math.max(0, x), Math.max(0, y), w, h));
      } catch (e) { out.getImageData = `${(e as Error).name}: ${(e as Error).message}`; }
      resolve(out);
    };
    img.onerror = () => resolve({ loaded: false, reason: 'image load error' });
    img.src = dataUri;
  });
}

function exportHtml(sources: string[], svgs: string[], theme: 'light' | 'dark', extraCss: string) {
  const md = new MarkdownIt();
  md.use(mermaidPlugin);
  const doc = '# M1b 수식 내보내기 시제품\n\n' + sources.map((s, i) => `## 다이어그램 ${i + 1}\n\n\`\`\`mermaid\n${s}\n\`\`\`\n`).join('\n');
  const holder = document.createElement('div');
  holder.innerHTML = md.render(doc);
  holder.querySelectorAll('.mermaid-container').forEach((el, i) => { el.innerHTML = svgs[i] ?? ''; });
  // Baseline: how the CURRENT app exports body math (renderer.ts:412 KaTeX default output, no KaTeX CSS in export).
  const body = document.createElement('p');
  body.innerHTML = `본문 수식(현행 방식 재현): ${katex.renderToString('x^2 + \\frac{a}{b}', { throwOnError: false })}`;
  holder.prepend(body);
  return buildHtmlDocument({ title: `m1b-export-${theme}`, content: holder.innerHTML, css: getPreviewCss(theme) + '\n' + extraCss, theme });
}

declare global { interface Window { M1B: unknown } }
window.M1B = {
  samples: SAMPLES, coldLog, coldFontsStatus,
  pele, mermaidRender, mount, clear, fit, foRectsIn, stripMath, paintCheck, loadKatexFonts, svgToPng, exportHtml, measureInDom, katexMarkup,
  sanitize: sanitizeSvg, diagram: createDiagramPurifier(),
  runSanitizeChecks: (pairs: FixturePair[], mathRaw: Record<string, string>) => runSanitizeChecks(pairs, mathRaw),
  violations: () => violations.slice(), setPhase: (p: string) => { phase = p; },
};
document.title = 'pele M1b spike ready';
