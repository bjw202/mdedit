// SPEC-PREVIEW-015 M1b spike only (deleted in M7). Check 2 (sanitize allowlist round-trip) as a
// pure function so the SAME code runs in vitest jsdom and in Playwright webkit/chromium.
import { sanitizeSvg } from '../../../src/lib/preview/svgSanitize';
import { createDiagramPurifier, registerOnGlobal, createProbeInstance, GlobalDOMPurify } from './diagramSanitize';
import { HOSTILE, MUST_STRIP } from './hostile';

export interface FixturePair { file: string; raw: string; sanitized: string }

function sharedIdentical(pairs: FixturePair[]) {
  const mismatches = pairs.filter((p) => sanitizeSvg(p.raw) !== p.sanitized).map((p) => p.file);
  return { checked: pairs.length, mismatches };
}

export function runSanitizeChecks(pairs: FixturePair[], mathRaw: Record<string, string>) {
  const out: Record<string, unknown> = { domPurifyVersion: GlobalDOMPurify.version };

  // (a0) shared sanitizeSvg vs M1 recorded outputs, BEFORE any diagram-path use
  out.a_before = sharedIdentical(pairs);

  // diagram path (separate instance) on math + hostile inputs
  const D = createDiagramPurifier();
  const math: Record<string, unknown> = {};
  for (const [id, raw] of Object.entries(mathRaw)) {
    const s = D.sanitize(raw);
    const shared = sanitizeSvg(raw);
    math[id] = {
      rawForeignObjects: (raw.match(/<foreignObject class="pele-math"/g) || []).length,
      keptForeignObjects: (s.match(/<foreignObject class="pele-math"/g) || []).length,
      rawKatex: (raw.match(/class="katex"/g) || []).length,
      keptKatex: (s.match(/class="katex"/g) || []).length,
      rawMath: (raw.match(/<math/g) || []).length,
      keptMath: (s.match(/<math/g) || []).length,
      keptInlineStyles: (s.match(/ style="/g) || []).length,
      rawInlineStyles: (raw.match(/ style="/g) || []).length,
      // attribute-position only (KaTeX keeps TeX source as text, which may legitimately contain "javascript:")
      scriptOrHandler: /<script|\son[a-z]+=|="\s*javascript:/i.test(s),
      rawAnnotation: (raw.match(/<annotation/g) || []).length,
      keptAnnotation: (s.match(/<annotation/g) || []).length,
      rawSemantics: (raw.match(/<semantics/g) || []).length,
      keptSemantics: (s.match(/<semantics/g) || []).length,
      sharedSanitizeKeepsForeignObject: /foreignObject/i.test(shared),
      sanitizedLength: s.length,
      rawLength: raw.length,
    };
  }
  out.b_math = math;

  const hostile: Record<string, unknown> = {};
  for (const [id, raw] of Object.entries(HOSTILE)) {
    const s = D.sanitize(raw);
    hostile[id] = { survivors: MUST_STRIP.filter((m) => s.includes(m)), keptPeleMath: (s.match(/class="pele-math"/g) || []).length, output: s };
  }
  out.c_hostile = hostile;

  // (a1) shared sanitizeSvg again, AFTER the diagram instance ran (interleaving)
  out.a_afterDiagramInstance = sharedIdentical(pairs);

  // ---- hook isolation probes ----
  const probe = { n: 0 };
  const P = createProbeInstance(probe);
  sanitizeSvg(pairs[0]?.raw ?? '<svg></svg>');
  const probeAfterShared = probe.n;
  P.sanitize('<svg><g></g></svg>');
  const probeAfterOwn = probe.n;
  // does a fresh instance inherit the shared (global) href hook? -> sanitize a data: href with a bare instance
  const bare = (GlobalDOMPurify as unknown as (w: Window) => typeof GlobalDOMPurify)(window);
  const dataHref = HOSTILE.dataHrefImage;
  const bareOut = bare.sanitize(dataHref, { USE_PROFILES: { svg: true } }) as unknown as string;
  const sharedOut = sanitizeSvg(dataHref);
  const diagOut = D.sanitize(dataHref);
  // counter-experiment: a hook on the GLOBAL instance IS seen by sanitizeSvg
  const globalCounter = { n: 0 };
  const unregister = registerOnGlobal(globalCounter);
  sanitizeSvg(pairs[0]?.raw ?? '<svg></svg>');
  const globalSeenByShared = globalCounter.n;
  unregister();
  sanitizeSvg(pairs[0]?.raw ?? '<svg></svg>');
  const globalAfterRemove = globalCounter.n;
  // config leak: diagram config passed to the GLOBAL instance, then sanitizeSvg
  GlobalDOMPurify.sanitize(mathRaw[Object.keys(mathRaw)[0]] ?? '<svg></svg>', { USE_PROFILES: { svg: true, mathMl: true }, ADD_TAGS: ['foreignObject', 'div', 'span'], HTML_INTEGRATION_POINTS: { foreignobject: true } });
  const sharedAfterGlobalConfigCall = sanitizeSvg(mathRaw[Object.keys(mathRaw)[0]] ?? '');

  out.isolation = {
    separateInstanceHookFiredDuringSanitizeSvg: probeAfterShared, // expect 0
    separateInstanceHookFiredOnOwnCall: probeAfterOwn, // expect > 0
    freshInstanceInheritsSharedHrefHook: !/data:image/.test(bareOut) ? 'yes (stripped)' : 'no (data: href kept)',
    sharedStripsDataHref: !/data:image/.test(sharedOut),
    diagramPathStripsDataHref: !/data:image/.test(diagOut),
    diagramPathStripsExternalHref: !/evil\.example/.test(diagOut),
    diagramPathKeepsUseFragment: /href="#frag"/.test(diagOut),
    sharedKeepsUseFragment: /href="#frag"/.test(sharedOut),
    globalHookSeenBySanitizeSvg: globalSeenByShared, // > 0 = leak when registered globally
    globalHookAfterRemoveHook: globalAfterRemove,
    sanitizeSvgStillStripsForeignObjectAfterGlobalConfigCall: !/foreignObject/i.test(sharedAfterGlobalConfigCall),
  };

  // (a2) final identity pass after every experiment above
  out.a_final = sharedIdentical(pairs);
  return out;
}
