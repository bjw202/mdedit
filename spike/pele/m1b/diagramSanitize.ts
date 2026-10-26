// SPEC-PREVIEW-015 M1b spike only (deleted in M7). NOT production code.
// Prototype of the diagram-only sanitize path (design.md D4): sanitizeSvg's rules PLUS
// foreignObject[class="pele-math"] and the KaTeX markup inside it -- and nothing else.
//
// Isolation: DOMPurify's default export is ONE global instance; svgSanitize.ts registers an
// `uponSanitizeAttribute` hook on it at import time. `DOMPurify(window)` (createDOMPurify) returns a
// fresh instance with its own hook map and config, so hooks added here cannot reach sanitizeSvg --
// and, symmetrically, the shared href hook does NOT exist here unless re-registered (we re-register it).
import DOMPurify, { type Config } from 'dompurify';

const FORBID_ATTR = [
  'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup', 'onfocus',
  'onblur', 'onchange', 'onsubmit', 'onanimationstart', 'onanimationend', 'onanimationiteration',
  'onbegin', 'onend', 'onrepeat',
];
const DANGEROUS_HREF_RE = /^(?:data:|[a-z][a-z0-9+.-]*:|\/\/)/i;
const SVG_NS = 'http://www.w3.org/2000/svg';
const HTML_NS = 'http://www.w3.org/1999/xhtml';
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

export const DIAGRAM_SANITIZE_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true, mathMl: true },
  // Only the HTML tags KaTeX `output:'html'` emits (span) + pele's wrapper div. No full HTML profile.
  // + MathML <semantics>/<annotation>: absent from DOMPurify's mathMl list; without them the TeX source in
  // <annotation> survives as a loose text node inside <math> (measured in M1b).
  ADD_TAGS: ['foreignObject', 'div', 'span', 'semantics', 'annotation'],
  ADD_ATTR: ['encoding'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'img', 'a'],
  FORBID_ATTR,
  // Without this, DOMPurify's namespace check drops every HTML child of an SVG foreignObject
  // (default HTML_INTEGRATION_POINTS is only 'annotation-xml').
  HTML_INTEGRATION_POINTS: { 'annotation-xml': true, foreignobject: true },
};

function insidePeleMath(node: Element) {
  for (let p = node.parentElement as Element | null; p; p = p.parentElement) {
    if (p.namespaceURI === SVG_NS && p.localName === 'foreignObject') return p.getAttribute('class') === 'pele-math';
  }
  return false;
}

function hrefHook(_node: Element, data: { attrName: string; attrValue: string; keepAttr: boolean }) {
  if (data.attrName !== 'href' && data.attrName !== 'xlink:href') return;
  const value = data.attrValue.trim();
  if (value.startsWith('#')) return;
  if (DANGEROUS_HREF_RE.test(value)) data.keepAttr = false;
}

export function createDiagramPurifier(win: Window & typeof globalThis = window) {
  const P = DOMPurify(win);
  P.addHook('uponSanitizeAttribute', hrefHook as never);
  P.addHook('uponSanitizeElement', (node) => {
    const el = node as Element;
    if (el.nodeType !== 1) return;
    if (el.namespaceURI === SVG_NS && el.localName === 'foreignObject') {
      if (el.getAttribute('class') !== 'pele-math') el.remove();
      return;
    }
    // HTML / MathML is only legal inside foreignObject.pele-math. The walk root (DOMPurify parses the
    // string into <body>) must be skipped: detaching it makes DOMPurify 3.4 fail closed (throws).
    if (!el.parentElement || (el.namespaceURI === HTML_NS && (el.localName === 'body' || el.localName === 'html'))) return;
    if ((el.namespaceURI === HTML_NS || el.namespaceURI === MATHML_NS) && !insidePeleMath(el)) el.remove();
  });
  return {
    instance: P,
    sanitize(raw: string) {
      if (!raw) return '';
      try { return P.sanitize(raw, DIAGRAM_SANITIZE_CONFIG) as unknown as string; } catch { return ''; }
    },
  };
}

/** Counter-experiment: the same hooks registered on the GLOBAL default instance (what D4 must avoid). */
export function registerOnGlobal(counter: { n: number }) {
  const hook = () => { counter.n++; };
  DOMPurify.addHook('uponSanitizeElement', hook);
  return () => DOMPurify.removeHook('uponSanitizeElement', hook);
}

export function createProbeInstance(counter: { n: number }, win: Window & typeof globalThis = window) {
  const P = DOMPurify(win);
  P.addHook('uponSanitizeElement', () => { counter.n++; });
  return P;
}

export { DOMPurify as GlobalDOMPurify };
