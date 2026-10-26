// @MX:SPEC: SPEC-PREVIEW-015 REQ-PREVIEW015-001 REQ-PREVIEW015-002 REQ-PREVIEW015-003 REQ-PREVIEW015-018 REQ-PREVIEW015-025
// 다이어그램(Mermaid 문법) 렌더·검증의 유일한 경로. pele 1.10.0을 이 파일에서만 import한다(design.md D3).
// 정화는 전역 DOMPurify가 아닌 별도 인스턴스로 하며, 공유 sanitizeSvg(svgSanitize.ts)는 호출도 수정도 하지 않는다(D4).

import { render, PeleError, type MathResolver, type RenderOptions } from 'pele';
import katex from 'katex';
import DOMPurify, { type Config } from 'dompurify';

/** 다이어그램 일반 글꼴 목록. mdedit-tokens.css의 --pele-font와 글자 그대로 같아야 한다(design.md D5, AC-004). */
export const DIAGRAM_FONT_FAMILY = '"Barlow", system-ui, sans-serif';
/** 다이어그램 고정폭 글꼴 목록. mdedit-tokens.css의 --pele-font-mono와 글자 그대로 같아야 한다. */
export const DIAGRAM_FONT_FAMILY_MONO = '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace';

// @MX:NOTE: [AUTO] 고정 옵션 — autoDirection·links·images·responsive와 두 글꼴 상수(design.md D2·D5·D13). maxWidth는 넣지 않는다(간격이 바뀜, M1 report F7).
// @MX:WARN: [AUTO] links·images를 켜거나 이 객체를 호출자가 바꿀 수 있게 열면 보안 경계가 무너진다
// @MX:REASON: [AUTO] links: true면 스킴 검증 없는 open_url_in_browser(browser_ops.rs) 경로가 열리고, images: true면 외부 요청 차단을
//   정화 훅 하나에만 맡기게 된다. 두 값은 사용자 결정(D2·D13)이며 REQ-PREVIEW015-002가 호출자 변경 경로를 금지한다.
export const PELE_RENDER_OPTIONS = Object.freeze({
  autoDirection: false,
  links: false,
  images: false,
  responsive: true,
  fontFamily: DIAGRAM_FONT_FAMILY,
  fontFamilyMono: DIAGRAM_FONT_FAMILY_MONO,
} as const satisfies RenderOptions);

export interface DiagramError {
  code: string;
  message: string;
  line: number;
  column: number;
}

export type DiagramRenderResult =
  | { ok: true; svg: string; width: number; height: number }
  | { ok: false; error: DiagramError };

export type DiagramValidation = { valid: true } | { valid: false; error: string };

export type MathMeasure = (html: string, size: number) => { width: number; height: number };

// ── 수식 해석기 ─────────────────────────────────────────────────────────

// @MX:NOTE: [AUTO] KaTeX output 'mathml' + 바깥 <span class="katex"> 제거(mathml-bare), trust: false.
//   HTML 출력은 webkit에서 foreignObject 밖으로 어긋나 탈락(design.md D15, M1b 확인 1). KaTeX 오류 마크업이면 null을 돌려
//   pele가 $$…$$ 원문으로 되돌리게 한다.
export function katexMathMarkup(tex: string): string | null {
  let html: string;
  try {
    html = katex.renderToString(tex, { output: 'mathml', throwOnError: false, displayMode: false, trust: false });
  } catch {
    return null;
  }
  const m = /^<span class="katex">(<math[\s\S]*<\/math>)<\/span>$/.exec(html);
  return m ? m[1] : null;
}

/** pele의 foreignObject 안 감싸기 div와 같은 스타일로 문서에 붙여 크기를 잰다(REQ-PREVIEW015-025). jsdom에서는 0을 돌려준다. */
function measureInDom(html: string, size: number): { width: number; height: number } {
  if (typeof document === 'undefined' || !document.body) return { width: 0, height: 0 };
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;left:-100000px;top:0;visibility:hidden;font-size:${size}px;line-height:normal;white-space:nowrap;display:inline-block`;
  // 측정용 임시 노드: 같은 경로로 정화한 마크업만 넣는다.
  el.innerHTML = sanitizeMathFragment(html);
  document.body.appendChild(el);
  const r = el.getBoundingClientRect();
  el.remove();
  return { width: Math.ceil(r.width), height: Math.ceil(r.height) };
}

/** pele `math` 해석기. 기본 측정은 문서 배치(getBoundingClientRect)이며, 픽스처 캡처·시험에서만 측정을 바꿔 넘긴다. */
export function createMathResolver(measure: MathMeasure = measureInDom): MathResolver {
  return (tex, size) => {
    const html = katexMathMarkup(tex);
    if (!html) return null;
    const box = measure(html, size);
    // 크기가 0이면 pele가 결과를 버리고 원문을 쓰지만, 의도를 분명히 하려고 여기서 먼저 null을 돌려준다.
    if (!(box.width > 0 && box.height > 0)) return null;
    return { html, width: box.width, height: box.height };
  };
}

// ── 다이어그램 전용 정화 경로 ────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
const HTML_NS = 'http://www.w3.org/1999/xhtml';
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';
const DANGEROUS_HREF_RE = /^(?:data:|[a-z][a-z0-9+.-]*:|\/\/)/i;

// 기본 규칙은 svgSanitize.ts의 SVG_SANITIZE_CONFIG와 같다(USE_PROFILES svg·svgFilters, 같은 FORBID_ATTR, script 금지).
// 차이는 수식 허용분뿐이다: mathMl 프로필, foreignObject(클래스는 훅이 pele-math로 제한), 감싸기 div, semantics, annotation[encoding],
// 그리고 foreignObject 안 HTML이 버려지지 않게 하는 HTML_INTEGRATION_POINTS (design.md D4, REQ-PREVIEW015-003·025).
const DIAGRAM_SANITIZE_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true, mathMl: true },
  ADD_TAGS: ['foreignObject', 'div', 'semantics', 'annotation'],
  ADD_ATTR: ['encoding'],
  FORBID_TAGS: ['script'],
  FORBID_ATTR: [
    'onload',
    'onerror',
    'onclick',
    'onmouseover',
    'onmouseout',
    'onmousedown',
    'onmouseup',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit',
    'onanimationstart',
    'onanimationend',
    'onanimationiteration',
    'onbegin',
    'onend',
    'onrepeat',
  ],
  HTML_INTEGRATION_POINTS: { 'annotation-xml': true, foreignobject: true },
};

/** 가장 가까운 foreignObject 조상이 정확히 class="pele-math"인지. */
function insidePeleMath(node: Element): boolean {
  for (let p = node.parentElement; p; p = p.parentElement) {
    if (p.namespaceURI === SVG_NS && p.localName === 'foreignObject') return p.getAttribute('class') === 'pele-math';
  }
  return false;
}

type Purifier = ReturnType<typeof DOMPurify>;
let purifier: Purifier | null = null;

// @MX:WARN: [AUTO] 다이어그램 정화는 반드시 별도 DOMPurify(window) 인스턴스에서 한다 — 전역 인스턴스에 훅·설정을 걸지 말 것
// @MX:REASON: [AUTO] 전역 인스턴스에 건 훅은 SVG 파일 뷰어의 sanitizeSvg 한 번 호출에서 43회 실행되어 공유 경로로 새어 들었다(M1b 2d).
//   새 인스턴스는 svgSanitize.ts의 href 훅을 물려받지 않으므로 아래에서 href 차단 훅을 다시 등록해야 한다(design.md D4·D13).
export function getDiagramPurifier(): Purifier {
  if (purifier) return purifier;
  const p = DOMPurify(window);
  p.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName !== 'href' && data.attrName !== 'xlink:href') return;
    const value = data.attrValue.trim();
    if (value.startsWith('#')) return; // 같은 문서 조각 참조는 허용
    if (DANGEROUS_HREF_RE.test(value)) data.keepAttr = false;
  });
  p.addHook('uponSanitizeElement', (node) => {
    const el = node as Element;
    if (el.nodeType !== 1) return;
    if (el.namespaceURI === SVG_NS && el.localName === 'foreignObject') {
      if (el.getAttribute('class') !== 'pele-math') el.remove();
      return;
    }
    // 파싱 루트(body/html)는 건너뛴다 — 떼어 내면 DOMPurify가 예외로 실패한다(M1b 측정).
    if (!el.parentElement || (el.namespaceURI === HTML_NS && (el.localName === 'body' || el.localName === 'html'))) return;
    if (el.namespaceURI === HTML_NS) {
      // HTML은 foreignObject.pele-math 바로 아래의 감싸기 div만 허용한다.
      const parent = el.parentElement;
      const isWrapper = el.localName === 'div' && parent.namespaceURI === SVG_NS && parent.localName === 'foreignObject';
      if (!isWrapper || !insidePeleMath(el)) el.remove();
      return;
    }
    if (el.namespaceURI === MATHML_NS && !insidePeleMath(el)) el.remove();
  });
  purifier = p;
  return p;
}

/** pele 출력(SVG 문자열)을 다이어그램 전용 경로로 정화한다. 실패 시 빈 문자열. */
export function sanitizeDiagramSvg(raw: string): string {
  if (!raw) return '';
  try {
    return getDiagramPurifier().sanitize(raw, DIAGRAM_SANITIZE_CONFIG) as unknown as string;
  } catch {
    return '';
  }
}

/** 측정용: 해석기 마크업을 foreignObject.pele-math에 넣었을 때와 같은 규칙으로 정화한 안쪽 HTML. */
function sanitizeMathFragment(html: string): string {
  const wrapped = `<svg xmlns="${SVG_NS}"><foreignObject class="pele-math"><div xmlns="${HTML_NS}">${html}</div></foreignObject></svg>`;
  const out = sanitizeDiagramSvg(wrapped);
  const m = /<div[^>]*>([\s\S]*)<\/div>/.exec(out);
  return m ? m[1] : '';
}

// ── 렌더 ────────────────────────────────────────────────────────────────

let renderSeq = 0;

function toDiagramError(e: unknown): DiagramError {
  if (e instanceof PeleError) return { code: e.code, message: e.message, line: e.line, column: e.column };
  return { code: 'unknown', message: e instanceof Error ? e.message : String(e), line: 0, column: 0 };
}

function renderWith(source: string, measure: MathMeasure): DiagramRenderResult {
  // @MX:NOTE: [AUTO] 호출마다 고유 idPrefix — 한 문서에 여러 SVG가 있어도 내부 id(마커·그라디언트)가 겹치지 않는다(design.md D3, AC-010·017).
  const idPrefix = `pd${++renderSeq}`;
  try {
    const r = render(source, { ...PELE_RENDER_OPTIONS, idPrefix, math: createMathResolver(measure) });
    return { ok: true, svg: sanitizeDiagramSvg(r.svg), width: r.width, height: r.height };
  } catch (e) {
    return { ok: false, error: toDiagramError(e) };
  }
}

// @MX:ANCHOR: [AUTO] 다이어그램 렌더 진입점 — 미리보기·AI 검증·AI 카드·HTML/PDF/DOCX 내보내기가 모두 이 함수를 지난다
// @MX:REASON: [AUTO] fan_in ≥ 3(M3·M4 이후 5곳 이상). 고정 옵션·정화 단계를 바꾸면 모든 경로가 함께 바뀐다. 예외를 밖으로 던지지 않는다.
export function renderDiagram(source: string): DiagramRenderResult {
  return renderWith(source, measureInDom);
}

/** 시험용 진입점: 수식 크기 측정만 주입한다(jsdom은 크기를 잴 수 없다). pele 옵션은 바꿀 수 없다. */
export function renderDiagramForTest(source: string, deps: { measureMath: MathMeasure }): DiagramRenderResult {
  return renderWith(source, deps.measureMath);
}

// @MX:ANCHOR: [AUTO] 다이어그램 검증 진입점 — validateMermaid가 이 함수를 쓴다
// @MX:REASON: [AUTO] renderDiagram과 같은 렌더 함수·같은 고정 옵션을 그대로 호출한다(design.md D3). pele parse만 부르도록 바꾸면
//   렌더 단계에서만 나는 실패(limit·출력 한도) 때문에 "검증 통과, 미리보기 실패" 불일치가 다시 생긴다.
export function validateDiagram(source: string): DiagramValidation {
  const r = renderDiagram(source);
  return r.ok ? { valid: true } : { valid: false, error: r.error.message };
}

// ── 내보내기용 색 값 치환 (design.md D6) ──────────────────────────────────

/** mdedit-tokens.css가 정의하는 --pele-* 변수 목록(design.md D5). */
export const PELE_THEME_VARS = [
  '--pele-accent', '--pele-bg', '--pele-border', '--pele-fg', '--pele-font', '--pele-font-mono',
  '--pele-heading-weight', '--pele-line', '--pele-muted', '--pele-radius',
  '--pele-series-1', '--pele-series-2', '--pele-series-3', '--pele-series-4',
  '--pele-series-5', '--pele-series-6', '--pele-series-7', '--pele-series-8',
  '--pele-surface', '--pele-surface-alt', '--pele-title-weight', '--pele-error', '--pele-critical',
] as const;

/** 변수 이름(`--pele-…`) → 실제 값. 빠진 이름은 pele 대체값으로 채운다. */
export type PeleThemeValues = Readonly<Record<string, string>>;

/**
 * 쓸 테마의 --pele-* 값을 앱 CSS에서 읽는다. data-theme를 단 탐침 요소를 잠깐 붙여 getComputedStyle로 읽고 바로 뗀다.
 * 라이트 탐침은 mdedit-tokens.css의 `[data-theme="light"], :root` 블록이 다크 루트 아래에서도 라이트 값을 다시 선언해 준다.
 * jsdom처럼 값을 계산하지 못하는 환경에서는 빈 표를 돌려주며, 치환은 pele 대체값으로 채워진다.
 */
export function readPeleThemeValues(theme: 'light' | 'dark'): PeleThemeValues {
  const out: Record<string, string> = {};
  if (typeof document === 'undefined' || !document.body || typeof getComputedStyle !== 'function') return out;
  const probe = document.createElement('div');
  probe.setAttribute('data-theme', theme);
  probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
  document.body.appendChild(probe);
  try {
    const cs = getComputedStyle(probe);
    for (const name of PELE_THEME_VARS) {
      const value = cs.getPropertyValue(name).trim();
      if (value) out[name] = value;
    }
  } finally {
    probe.remove();
  }
  return out;
}

const PELE_VAR_MARK = 'var(--pele-';

// @MX:WARN: [AUTO] 내보내기 테마 기준으로 모든 var(--pele-…)를 치환해야 한다 — 하나라도 남기지 말 것
// @MX:REASON: [AUTO] pele는 항상 라이트 대체값(var(--pele-bg,#fff) 등)을 붙여 출력하므로, 참조가 하나라도 남으면 앱 밖에서
//   그 부분이 조용히 라이트로 그려져 다크 내보내기가 라이트가 된다(AC-020). 표에 없는 이름은 대체값으로 채워 0건을 지킨다.
/** CSS 텍스트 안의 모든 `var(--pele-이름[, 대체값])`을 표의 값(없으면 대체값, 중첩 해석)으로 바꾼다. 다른 var()는 그대로 둔다. */
export function resolvePeleVars(css: string, values: PeleThemeValues): string {
  let out = '';
  let from = 0;
  for (;;) {
    const start = css.indexOf(PELE_VAR_MARK, from);
    if (start < 0) return out + css.slice(from);
    let depth = 0;
    let comma = -1;
    let end = start + 3; // '(' 위치
    for (; end < css.length; end++) {
      const ch = css[end];
      if (ch === '(') depth++;
      else if (ch === ')' && --depth === 0) break;
      else if (ch === ',' && depth === 1 && comma < 0) comma = end;
    }
    if (end >= css.length) return out + css.slice(from); // 괄호가 닫히지 않은 비정상 입력은 건드리지 않는다
    const name = css.slice(start + 4, comma >= 0 ? comma : end).trim();
    const fallback = comma >= 0 ? css.slice(comma + 1, end).trim() : '';
    out += css.slice(from, start) + (values[name] || resolvePeleVars(fallback, values));
    from = end + 1;
  }
}

/** 다이어그램 SVG 요소(정화된 모듈 결과)의 속성 값과 <style> 텍스트에서 var(--pele-…)를 모두 치환한다(제자리 변경). */
export function resolveDiagramColors(root: Element, values: PeleThemeValues): void {
  const visit = (el: Element): void => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes(PELE_VAR_MARK)) attr.value = resolvePeleVars(attr.value, values);
    }
    if (el.localName === 'style' && el.textContent?.includes(PELE_VAR_MARK)) {
      el.textContent = resolvePeleVars(el.textContent, values);
    }
    for (const child of Array.from(el.children)) visit(child);
  };
  visit(root);
}

/** 미리보기 오류 문구(design.md D9): line·column이 모두 1 이상이면 "(L행 C열)"을 붙이고, 그 밖에는 접미사 없이. */
export function formatDiagramError(error: DiagramError): string {
  const base = '⚠ Diagram syntax error';
  return error.line >= 1 && error.column >= 1 ? `${base} (${error.line}행 ${error.column}열)` : base;
}
