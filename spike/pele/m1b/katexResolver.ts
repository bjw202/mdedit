// SPEC-PREVIEW-015 M1b spike only (deleted in M7). NOT production code.
// pele `math` resolver backed by the existing `katex` dependency (design.md D15).
//
// pele 1.10.0 contract (read from node_modules/pele/dist/pele.js, not assumed):
//   - labels are scanned with /\$\$(.+?)\$\$/g (non-greedy, single line); `tex` is the captured text
//     after pele's own entity decode (`at()`), i.e. WITHOUT the `$$` delimiters.
//   - `size` is the label font size in px (the same number pele writes as `font-size:${size}px` on the
//     <div> inside <foreignObject class="pele-math">).
//   - width/height must be finite and > 0, else pele drops the result and prints `$$tex$$` as text.
//   - results are cached per render by `${size}\n${tex}`.
//   - returned `html` is inserted verbatim (pele does not escape it) -> sanitising is the caller's job.
import katex from 'katex';

export type MathOutput = 'html' | 'mathml' | 'mathml-bare';
export type Measure = 'dom' | 'estimate';
export interface ResolverLog { tex: string; size: number; width: number; height: number; returned: 'html' | 'svg' | 'null'; reason?: string }

export function katexMarkup(tex: string, output: MathOutput) {
  // throwOnError:false + trust:false (KaTeX default) = same safety posture as the markdown body plugin.
  const html = katex.renderToString(tex, { output: output === 'html' ? 'html' : 'mathml', throwOnError: false, displayMode: false, trust: false });
  // 'mathml-bare': drop KaTeX's outer <span class="katex"> so the app-global katex.min.css rule
  // `.katex{position:relative}` cannot match inside the diagram (WebKit paints positioned descendants of
  // a foreignObject at the SVG origin -- measured in M1b). Error output (no <math>) is kept as-is.
  if (output === 'mathml-bare') { const m = /^<span class="katex">(<math[\s\S]*<\/math>)<\/span>$/.exec(html); return m ? m[1] : html; }
  return html;
}

/** Lays the KaTeX markup out exactly the way pele's foreignObject <div> does and reads its box. */
export function measureInDom(html: string, size: number) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;left:-100000px;top:0;visibility:hidden;font-size:${size}px;line-height:normal;white-space:nowrap;display:inline-block`;
  el.innerHTML = html;
  document.body.appendChild(el);
  const r = el.getBoundingClientRect();
  el.remove();
  return { width: Math.ceil(r.width), height: Math.ceil(r.height) };
}

/** Text-only estimate (what a jsdom unit test could do without layout). Deliberately crude. */
export function estimate(tex: string, size: number) {
  const visible = tex.replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}^_\s]/g, '');
  return { width: Math.max(1, Math.ceil(visible.length * size * 0.6)), height: Math.ceil(size * 1.6) };
}

export function makeKatexResolver(opts: { output: MathOutput; measure: Measure; log?: ResolverLog[] }) {
  return (tex: string, size: number) => {
    let html: string;
    try { html = katexMarkup(tex, opts.output); } catch (e) {
      opts.log?.push({ tex, size, width: 0, height: 0, returned: 'null', reason: `katex threw: ${String(e)}` });
      return null;
    }
    const box = opts.measure === 'dom' ? measureInDom(html, size) : estimate(tex, size);
    if (!(box.width > 0 && box.height > 0)) {
      opts.log?.push({ tex, size, ...box, returned: 'null', reason: 'zero box (no layout)' });
      return null;
    }
    opts.log?.push({ tex, size, ...box, returned: 'html' });
    return { html, width: box.width, height: box.height };
  };
}

// DOCX fallback candidate F2: no foreignObject at all -- the TeX source (without `$$`) as SVG <text>.
export function makeTexTextResolver(log?: ResolverLog[]) {
  return (tex: string, size: number) => {
    const esc = tex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const width = Math.max(1, Math.ceil(tex.length * size * 0.55));
    const height = Math.ceil(size * 1.3);
    log?.push({ tex, size, width, height, returned: 'svg' });
    return { svg: `<text x="0" y="${Math.round(size)}" font-size="${size}" font-style="italic" fill="currentColor">${esc}</text>`, width, height };
  };
}
