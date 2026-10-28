// @MX:SPEC: SPEC-PREVIEW-015, SPEC-PREVIEW-016
// 다이어그램 모듈(src/lib/diagram/diagramRenderer.ts) 단위 테스트 — 실제 pele 1.10.0 + 실제 캡처 픽스처.
// pele·katex는 통과형 감시 래퍼로만 감싼다(실제 구현에 그대로 위임, 반환값을 바꾸지 않음 — acceptance.md mock 원칙).
// 대상 AC(모듈 단위 부분): 002, 004, 005, 007·014(오류 형식·검증 계약), 010(id), 012, 023은 가드 테스트, 025(1–6).
// SPEC-PREVIEW-016: 015의 이중 블록 토큰 테스트를 고정 팔레트 단일 :root 계약(AC-PREVIEW016-001·002·003)으로 대체.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

vi.mock('pele', async (importOriginal) => {
  const real = await importOriginal<typeof import('pele')>();
  return { ...real, render: vi.fn(real.render) };
});
vi.mock('katex', async (importOriginal) => {
  const real = await importOriginal<typeof import('katex')>();
  const renderToString = vi.fn(real.default.renderToString);
  return { ...real, renderToString, default: { ...real.default, renderToString } };
});

import { render, PeleError } from 'pele';
import katex from 'katex';
import DOMPurify from 'dompurify';
import { sanitizeSvg } from '@/lib/preview/svgSanitize';
import {
  DIAGRAM_FONT_FAMILY,
  DIAGRAM_FONT_FAMILY_MONO,
  PELE_RENDER_OPTIONS,
  renderDiagram,
  renderDiagramForTest,
  validateDiagram,
  formatDiagramError,
  sanitizeDiagramSvg,
  katexMathMarkup,
  getDiagramPurifier,
} from '@/lib/diagram/diagramRenderer';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const FIX = resolve(here, 'fixtures', 'pele');

interface Entry {
  file: string;
  bundle: 'm1-frozen' | 'unit' | 'browser';
  stage: 'raw' | 'sanitized' | 'error';
  sample: string;
  source: string;
  options: Record<string, unknown>;
  peleVersion: string;
  capturedAt: string;
  environment: string;
  measurer: string;
  frozen?: boolean;
  math?: { method: string; width?: number; height?: number };
}
const manifest = JSON.parse(readFileSync(resolve(FIX, 'manifest.json'), 'utf-8')) as { entries: Entry[] };
const read = (file: string) => readFileSync(resolve(FIX, file), 'utf-8');
const sourceOf = (sample: string) => {
  const e = manifest.entries.find((x) => x.sample === sample && x.stage !== 'error');
  if (!e) throw new Error(`no fixture source for ${sample}`);
  return e.source;
};
const frozenErrors = JSON.parse(read('m1-frozen/errors.json')) as { id: string; source: string }[];
const errorSource = (id: string) => frozenErrors.find((e) => e.id === id)!.source;

const renderMock = vi.mocked(render);
const fixedMath = (width: number, height: number) => () => ({ width, height });

const FORBIDDEN_IN_RESULT = (s: string) => ({
  script: (s.match(/<script/gi) || []).length,
  foreignObject: (s.match(/<foreignObject/gi) || []).length,
  onAttr: (s.match(/\son[a-z]+=/gi) || []).length,
});

beforeEach(() => {
  renderMock.mockClear();
  vi.mocked(katex.renderToString).mockClear();
});

describe('AC-PREVIEW015-004 고정 옵션과 글꼴 상수', () => {
  it('모든 pele 호출이 고정 옵션과 두 글꼴 상수를 받는다', () => {
    renderDiagram(sourceOf('01-test-content'));
    validateDiagram(sourceOf('12-ai-mock-valid'));
    expect(renderMock).toHaveBeenCalledTimes(2);
    for (const [, opts] of renderMock.mock.calls) {
      expect(opts).toMatchObject({
        autoDirection: false,
        links: false,
        images: false,
        responsive: true,
        fontFamily: DIAGRAM_FONT_FAMILY,
        fontFamilyMono: DIAGRAM_FONT_FAMILY_MONO,
      });
      expect(opts).not.toHaveProperty('maxWidth');
      expect(typeof opts?.math).toBe('function');
    }
  });

  it('고정 옵션 객체는 바꿀 수 없다', () => {
    expect(Object.isFrozen(PELE_RENDER_OPTIONS)).toBe(true);
    expect(() => {
      (PELE_RENDER_OPTIONS as { links: boolean }).links = true;
    }).toThrow();
  });

});

// SPEC-PREVIEW-016 — 다이어그램 팔레트는 앱 테마를 따르지 않는다(고정 리터럴 단일 :root).
// 잉크 앤 허니 A안(2026-10-28 사용자 확정 — Option B 액센트 후보 기각).
describe('SPEC-PREVIEW-016 고정 팔레트 — 단일 :root 리터럴 (AC-PREVIEW016-001·002·003)', () => {
  const cssOf = () => readFileSync(resolve(repoRoot, 'src/styles/mdedit-tokens.css'), 'utf-8');
  const block = (css: string, selector: string) => {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf('\n}', start));
  };
  const peleDecls = (b: string) => {
    const decls: Record<string, string> = {};
    for (const m of b.matchAll(/^\s*(--pele-[\w-]+):[ \t]*([^;]+);/gm)) decls[m[1]] = m[2].trim();
    return decls;
  };
  // 승인 팔레트 표 — 글꼴은 diagramRenderer.ts 상수와 바이트 동일 계약이라 상수를 그대로 쓴다.
  const EXPECTED_PALETTE: Readonly<Record<string, string>> = {
    '--pele-bg': '#FAF9F6',
    '--pele-fg': '#222B33',
    '--pele-muted': '#67727C',
    '--pele-line': '#3A5673',
    '--pele-surface': '#EEF3F7',
    '--pele-surface-alt': '#F7F2E7',
    '--pele-border': '#97A4B1',
    '--pele-accent': '#3A5673',
    '--pele-error': '#AC3E31',
    '--pele-critical': '#AC3E31',
    '--pele-radius': '3px',
    '--pele-title-weight': '600',
    '--pele-heading-weight': '600',
    '--pele-series-1': '#3168A8',
    '--pele-series-2': '#C95F3B',
    '--pele-series-3': '#23997C',
    '--pele-series-4': '#B78511',
    '--pele-series-5': '#C76A95',
    '--pele-series-6': '#7A8A28',
    '--pele-series-7': '#6E5BC4',
    '--pele-series-8': '#96562F',
    '--pele-font': DIAGRAM_FONT_FAMILY,
    '--pele-font-mono': DIAGRAM_FONT_FAMILY_MONO,
  };

  it(':root의 pele 선언은 연속된 23개 묶음 하나뿐이고, 다크 블록에는 0개다 (AC-PREVIEW016-001)', () => {
    const css = cssOf();
    const rootBlock = block(css, ':root');
    const declLines = [...rootBlock.matchAll(/^\s*--pele-[\w-]+:/gm)].map((m) => rootBlock.slice(0, m.index!).split('\n').length);
    // 묶음: 23개 선언이 :root 안에서 연속된 줄에 모여 있다
    expect(declLines, 'pele 선언 줄 수').toHaveLength(23);
    for (let i = 1; i < declLines.length; i++) expect(declLines[i], `${i}번째 pele 선언 줄`).toBe(declLines[i - 1] + 1);
    // 다크 블록: pele 선언 0개
    expect(peleDecls(block(css, '[data-theme="dark"]'))).toEqual({});
    // 파일 전체 pele 선언 수 = :root의 23개(다른 블록에 흩어진 선언 금지)
    expect((css.match(/^\s*--pele-[\w-]+:/gm) || []).length).toBe(23);
    // 어떤 pele 값에도 --md-* 체이닝이 없다
    for (const [name, value] of Object.entries(peleDecls(rootBlock))) expect(value, name).not.toContain('var(--md-');
    expect(css).not.toMatch(/--pele-zoom-/);
  });

  it('23개 토큰 값이 승인 잉크 앤 허니 표와 하나씩 같다 (AC-PREVIEW016-002)', () => {
    const root = peleDecls(block(cssOf(), ':root'));
    expect(Object.keys(root).sort()).toEqual(Object.keys(EXPECTED_PALETTE).sort());
    for (const [name, expected] of Object.entries(EXPECTED_PALETTE)) expect(root[name], name).toBe(expected);
    // accent == line == #3A5673
    expect(root['--pele-accent']).toBe('#3A5673');
    expect(root['--pele-line']).toBe('#3A5673');
    // series는 정확히 8개, 서로 다른 값
    const series = Object.entries(root).filter(([k]) => /^--pele-series-\d+$/.test(k)).map(([, v]) => v);
    expect(series).toHaveLength(8);
    expect(new Set(series).size).toBe(8);
  });

  it('글꼴은 상수와 바이트 동일, 반경 3px, 제목·헤딩 굵기 600 (AC-PREVIEW016-003)', () => {
    const root = peleDecls(block(cssOf(), ':root'));
    expect(root['--pele-font']).toBe(DIAGRAM_FONT_FAMILY);
    expect(root['--pele-font-mono']).toBe(DIAGRAM_FONT_FAMILY_MONO);
    expect(root['--pele-radius']).toBe('3px');
    expect(root['--pele-title-weight']).toBe('600');
    expect(root['--pele-heading-weight']).toBe('600');
  });
});

describe('AC-PREVIEW015-005 수식 없는 입력은 공유 sanitizeSvg와 같은 결과', () => {
  const frozenRaw = manifest.entries.filter((e) => e.bundle === 'm1-frozen' && e.stage === 'raw');

  it('m1-frozen은 38쌍이고 모두 frozen: true다', () => {
    expect(frozenRaw).toHaveLength(38);
    expect(manifest.entries.filter((e) => e.bundle === 'm1-frozen').every((e) => e.frozen === true)).toBe(true);
  });

  it.each(frozenRaw.map((e) => [e.file, e] as const))('%s', (_f, e) => {
    const raw = read(e.file);
    // M1 캡처에는 수식 해석기가 없었으므로 38쌍 모두 수식 요소가 없다(18-math-label도 $$ 원문 글자뿐).
    expect(raw).not.toMatch(/<foreignObject|<math/);
    const frozenSanitized = read(e.file.replace('.raw.svg', '.sanitized.svg'));
    const diagram = sanitizeDiagramSvg(raw);
    const shared = sanitizeSvg(raw);
    expect(diagram).toBe(shared);
    expect(shared).toBe(frozenSanitized);
    expect(FORBIDDEN_IN_RESULT(diagram)).toEqual({ script: 0, foreignObject: 0, onAttr: 0 });
  });
});

describe('AC-PREVIEW015-007·009 오류 문구 형식(D9)과 오류 객체', () => {
  it('위치가 있는 오류는 (L행 C열), 위치가 0/0이면 접미사 없음 — 숫자는 PeleError와 같다', () => {
    for (const id of ['21-error-line-col', '22-error-line0-semantic', '11-ai-mock-invalid']) {
      const src = errorSource(id);
      let pe: PeleError | undefined;
      try {
        render(src, { ...PELE_RENDER_OPTIONS });
      } catch (e) {
        pe = e as PeleError;
      }
      expect(pe).toBeInstanceOf(PeleError);
      const r = renderDiagram(src);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.error).toEqual({ code: pe!.code, message: pe!.message, line: pe!.line, column: pe!.column });
      const text = formatDiagramError(r.error);
      if (pe!.line >= 1 && pe!.column >= 1) expect(text).toBe(`⚠ Diagram syntax error (${pe!.line}행 ${pe!.column}열)`);
      else expect(text).toBe('⚠ Diagram syntax error');
    }
  });

  it('(2행 14열) 실측 샘플과 0/0 샘플의 문구', () => {
    const a = renderDiagram(errorSource('21-error-line-col'));
    const b = renderDiagram(errorSource('22-error-line0-semantic'));
    expect(!a.ok && formatDiagramError(a.error)).toBe('⚠ Diagram syntax error (2행 14열)');
    expect(!b.ok && formatDiagramError(b.error)).toBe('⚠ Diagram syntax error');
  });

  it('line만 있고 column이 0인 경우도 접미사 없음', () => {
    expect(formatDiagramError({ code: 'x', message: 'm', line: 3, column: 0 })).toBe('⚠ Diagram syntax error');
  });
});

describe('AC-PREVIEW015-014 검증은 같은 렌더 함수·같은 옵션', () => {
  it('유효·무효 소스의 계약과 PeleError.message 일치', () => {
    expect(validateDiagram(sourceOf('12-ai-mock-valid'))).toEqual({ valid: true });
    for (const id of ['11-ai-mock-invalid', '21-error-line-col']) {
      const src = errorSource(id);
      const r = renderDiagram(src);
      renderMock.mockClear();
      const v = validateDiagram(src);
      expect(renderMock).toHaveBeenCalledTimes(1);
      expect(renderMock.mock.calls[0][1]).toMatchObject({ ...PELE_RENDER_OPTIONS });
      expect(v).toEqual({ valid: false, error: !r.ok ? r.error.message : 'unreachable' });
    }
  });

  it('렌더 단계 실패도 검증에서 같이 잡힌다(렌더 결과와 검증 결과가 항상 같다)', () => {
    for (const id of ['01-test-content', '17-entity', '19-link-click']) {
      expect(validateDiagram(sourceOf(id)).valid).toBe(renderDiagram(sourceOf(id)).ok);
    }
  });
});

// sync 감사 F2: 정화가 실패(예외 또는 빈 결과)하면 성공으로 보고하지 않는다 — 검증 통과·미리보기 빈 칸 불일치 방지.
describe('sync 감사 F2 — 정화 실패는 오류 결과', () => {
  const src = sourceOf('12-ai-mock-valid');

  const throwing = (): string => {
    throw new Error('purify boom');
  };
  const empty = (): string => '';
  it.each([
    ['예외', throwing],
    ['빈 결과', empty],
  ] as const)('정화 %s → ok: false, 위치 없는 sanitize 오류, 검증도 무효', (_label, impl) => {
    const spy = vi.spyOn(getDiagramPurifier(), 'sanitize').mockImplementation(impl as never);
    try {
      const r = renderDiagram(src);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.code).toBe('sanitize');
      expect(r.error.message).toBeTruthy();
      expect({ line: r.error.line, column: r.error.column }).toEqual({ line: 0, column: 0 });
      expect(formatDiagramError(r.error)).toBe('⚠ Diagram syntax error');
      expect(validateDiagram(src)).toEqual({ valid: false, error: r.error.message });
    } finally {
      spy.mockRestore();
    }
    expect(renderDiagram(src).ok).toBe(true);
  });
});

describe('REQ-PREVIEW015-014 프리셋 7종', () => {
  it.each(['04-preset-flowchart', '05-preset-sequenceDiagram', '06-preset-gantt', '07-preset-classDiagram', '08-preset-stateDiagram', '09-preset-pie', '10-preset-mindmap'])(
    '%s 렌더 성공',
    (id) => {
      const r = renderDiagram(sourceOf(id));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.svg.startsWith('<svg')).toBe(true);
        expect(r.width).toBeGreaterThan(0);
        expect(r.height).toBeGreaterThan(0);
      }
    },
  );
});

describe('AC-PREVIEW015-010 idPrefix — 렌더마다 고유', () => {
  it('호출마다 다른 idPrefix를 넘기고, 같은 문서의 SVG id가 겹치지 않는다', () => {
    const src = sourceOf('09-preset-pie');
    const a = renderDiagram(src);
    const b = renderDiagram(src);
    const prefixes = renderMock.mock.calls.map(([, o]) => o?.idPrefix);
    expect(prefixes.every((p) => typeof p === 'string' && p.length > 0)).toBe(true);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    const ids = [a, b].flatMap((r) => (r.ok ? [...r.svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]) : []));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('AC-PREVIEW015-012 링크·외부 이미지 없음', () => {
  const external = (s: string) => [...s.matchAll(/(?:xlink:)?href="([^"]*)"/g)].map((m) => m[1]).filter((v) => /^(https?:|\/\/)/i.test(v.trim()));

  it('링크 문법: href 가진 <a> 0개 (정화 전·후)', () => {
    const r = renderDiagram(sourceOf('19-link-click'));
    expect(r.ok).toBe(true);
    const raw = renderMock.mock.results[0].value.svg as string;
    for (const s of [raw, r.ok ? r.svg : '']) expect(/<a\b[^>]*href/i.test(s)).toBe(false);
  });

  it('외부 이미지 문법: 외부 href 0건 (정화 전 = images:false, 정화 후 = 재등록 훅)', () => {
    const r = renderDiagram(sourceOf('20-image-node'));
    expect(r.ok).toBe(true);
    const raw = renderMock.mock.results[0].value.svg as string;
    expect(external(raw)).toEqual([]);
    expect(external(r.ok ? r.svg : 'x')).toEqual([]);
  });

  it('다이어그램 정화 경로의 href 훅이 외부·data·javascript href를 지우고 #조각은 남긴다', () => {
    const probe =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
      '<image href="https://evil.example/t.png" width="1" height="1"/>' +
      '<image xlink:href="//evil.example/u.png" width="1" height="1"/>' +
      '<image href="data:image/png;base64,AAAA" width="1" height="1"/>' +
      '<a href="javascript:alert(1)"><text>t</text></a>' +
      '<image href="#frag" width="1" height="1"/></svg>';
    const out = sanitizeDiagramSvg(probe);
    expect(out).not.toMatch(/evil\.example|data:image|javascript:/);
    expect(out).toContain('href="#frag"');
  });
});

describe('AC-PREVIEW015-025 수식 — mathml-bare, 별도 인스턴스 허용 목록 (unit, 구조만)', () => {
  const MATH_SRC = sourceOf('18-math-label');

  it('1. KaTeX는 output mathml·trust false로 호출되고 결과는 바깥 .katex 없는 <math>', () => {
    const html = katexMathMarkup('x^2 + y^2');
    const calls = vi.mocked(katex.renderToString).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ output: 'mathml', trust: false });
    expect(html).not.toBeNull();
    expect(html!.startsWith('<math')).toBe(true);
    expect(html).not.toContain('class="katex"');
  });

  it('1b. KaTeX가 오류 마크업을 내면 null(pele가 원문으로 되돌림)', () => {
    expect(katexMathMarkup('\\frac{')).toBeNull();
  });

  it('2. 수식 개수만큼 foreignObject.pele-math가 남고 그 안에 math·semantics·annotation[encoding]', () => {
    const r = renderDiagramForTest(MATH_SRC, { measureMath: fixedMath(48, 20) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const texCount = (MATH_SRC.match(/\$\$(.+?)\$\$/g) || []).length;
    expect((r.svg.match(/<foreignObject class="pele-math"/g) || []).length).toBe(texCount);
    expect((r.svg.match(/<math\b/g) || []).length).toBe(texCount);
    expect((r.svg.match(/<semantics>/g) || []).length).toBe(texCount);
    expect((r.svg.match(/<annotation encoding="application\/x-tex">/g) || []).length).toBe(texCount);
    expect(r.svg).not.toContain('$$');
  });

  it('2b. 측정이 0이면(jsdom 기본) pele가 $$ 원문 글자로 되돌린다 — 기본 렌더는 jsdom에서 수식 상자를 만들지 않는다', () => {
    const r = renderDiagram(MATH_SRC);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.svg).not.toContain('<foreignObject');
  });

  // 공격 탐침(손으로 쓴 적대 입력 — pele 출력 픽스처가 아니다). M1b 시험 코드(spike/pele/m1b/hostile.ts, M7에서 삭제)에서 옮김.
  const FO = (cls: string | null, inner: string) =>
    `<foreignObject${cls === null ? '' : ` class="${cls}"`} x="0" y="0" width="80" height="20"><div xmlns="http://www.w3.org/1999/xhtml">${inner}</div></foreignObject>`;
  const HOSTILE: Record<string, string> = {
    foreignObjectNoClass: `<svg xmlns="http://www.w3.org/2000/svg">${FO(null, '<math><mi>NOCLASS</mi></math>')}</svg>`,
    foreignObjectOtherClass: `<svg xmlns="http://www.w3.org/2000/svg">${FO('evil', '<math><mi>OTHERCLASS</mi></math>')}${FO('pele-math evil', '<math><mi>MIXEDCLASS</mi></math>')}</svg>`,
    scriptInsideMath: `<svg xmlns="http://www.w3.org/2000/svg">${FO('pele-math', '<math><mi>ok</mi></math><script>window.__pwned=1</script>')}<script>window.__pwned=2</script></svg>`,
    onloadInsideMath: `<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=3">${FO('pele-math', '<math onclick="window.__pwned=4"><mi onmouseover="x()">ok</mi></math><img src="x" onerror="window.__pwned=5">')}</svg>`,
    javascriptHrefInsideMath: `<svg xmlns="http://www.w3.org/2000/svg">${FO('pele-math', '<math href="javascript:alert(2)"><mi>s</mi></math><a href="javascript:alert(1)">ja</a>')}<a href="javascript:alert(3)"><text>t</text></a></svg>`,
    htmlOutsideForeignObject: `<svg xmlns="http://www.w3.org/2000/svg"><g><div>OUTSIDE</div></g></svg><div>ROOTDIV</div><math><mi>ROOTMATH</mi></math>`,
    formsInsideMath: `<svg xmlns="http://www.w3.org/2000/svg">${FO('pele-math', '<form action="https://evil.example"><input name="p"></form><iframe src="https://evil.example"></iframe><style>*{display:none}</style><span>SPANHTML</span><math><mi>ok</mi></math>')}</svg>`,
    annotationXmlInsideMath: `<svg xmlns="http://www.w3.org/2000/svg">${FO('pele-math', '<math><semantics><mi>x</mi><annotation-xml encoding="text/html"><img src="x" onerror="window.__pwned=6"><span>AXML</span></annotation-xml></semantics></math>')}</svg>`,
    dataHrefImage: `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AAAA" width="1" height="1"/><image href="https://evil.example/t.png" width="1" height="1"/><use href="#frag"/></svg>`,
  };
  const MUST_STRIP = ['NOCLASS', 'OTHERCLASS', 'MIXEDCLASS', '<script', 'onload=', 'onclick=', 'onmouseover=', 'onerror=', 'javascript:', 'OUTSIDE', 'ROOTDIV', 'ROOTMATH', '<form', '<input', '<iframe', '<style', 'SPANHTML', 'data:image', 'evil.example', '<img', 'AXML', 'annotation-xml'];

  it.each(Object.keys(HOSTILE))('3. 적대 입력 %s: 남은 표지 0개, 공유 sanitizeSvg는 foreignObject 0개', (key) => {
    const out = sanitizeDiagramSvg(HOSTILE[key]);
    expect(MUST_STRIP.filter((m) => out.includes(m))).toEqual([]);
    expect((sanitizeSvg(HOSTILE[key]).match(/<foreignObject/gi) || []).length).toBe(0);
  });

  it('4. m1-frozen 38쌍: 다이어그램 경로 사용 전·후 공유 sanitizeSvg 결과가 고정 기준과 바이트 동일', () => {
    const pairs = manifest.entries
      .filter((e) => e.bundle === 'm1-frozen' && e.stage === 'raw')
      .map((e) => ({ raw: read(e.file), want: read(e.file.replace('.raw.svg', '.sanitized.svg')) }));
    const mismatches = () => pairs.filter((p) => sanitizeSvg(p.raw) !== p.want).length;
    expect(mismatches()).toBe(0);
    renderDiagramForTest(MATH_SRC, { measureMath: fixedMath(48, 20) });
    for (const k of Object.keys(HOSTILE)) sanitizeDiagramSvg(HOSTILE[k]);
    expect(mismatches()).toBe(0);
  });

  it('5·6. 다이어그램 경로는 전역 인스턴스를 쓰지 않고, 전역 설정·훅을 바꾸지 않는다', () => {
    expect(getDiagramPurifier()).not.toBe(DOMPurify);
    const mathInput = HOSTILE.scriptInsideMath.replace(/<script>[^<]*<\/script>/g, '');
    const before = sanitizeSvg(mathInput);
    let globalHookCalls = 0;
    const probe = () => {
      globalHookCalls++;
    };
    DOMPurify.addHook('uponSanitizeElement', probe);
    const addHook = vi.spyOn(DOMPurify, 'addHook');
    const setConfig = vi.spyOn(DOMPurify, 'setConfig');
    try {
      sanitizeDiagramSvg(mathInput);
      renderDiagramForTest(MATH_SRC, { measureMath: fixedMath(48, 20) });
      expect(globalHookCalls).toBe(0);
      expect(addHook).not.toHaveBeenCalled();
      expect(setConfig).not.toHaveBeenCalled();
    } finally {
      addHook.mockRestore();
      setConfig.mockRestore();
      DOMPurify.removeHook('uponSanitizeElement', probe);
    }
    const after = sanitizeSvg(mathInput);
    expect((after.match(/<foreignObject/gi) || []).length).toBe(0);
    expect(after).toBe(before);
  });
});

describe('AC-PREVIEW015-002 픽스처는 실제 렌더에서 왔다', () => {
  it('모든 항목에 필수 필드, 수식 항목에는 크기 결정 방법', () => {
    for (const e of manifest.entries) {
      for (const k of ['file', 'source', 'options', 'peleVersion', 'capturedAt', 'environment', 'measurer'] as const) {
        expect(e[k], `${e.file}.${k}`).toBeTruthy();
      }
      expect(e.peleVersion).toBe('1.10.0');
      if (/\$\$.+?\$\$/.test(e.source) && e.bundle !== 'm1-frozen' && e.stage !== 'error') {
        expect(e.math?.method, `${e.file}.math.method`).toBeTruthy();
      }
    }
  });

  it('unit/ 묶음(M2 재캡처)은 글꼴 상수를 담은 고정 옵션으로 캡처되었다', () => {
    const unit = manifest.entries.filter((e) => e.bundle === 'unit' && e.stage !== 'error');
    expect(unit.length).toBeGreaterThan(0);
    for (const e of unit) {
      expect(e.measurer).toBe('jsdom-default');
      expect(e.options).toMatchObject({ ...PELE_RENDER_OPTIONS });
    }
    const browser = manifest.entries.filter((e) => e.bundle === 'browser');
    expect(browser.length).toBeGreaterThan(0);
    for (const e of browser) {
      expect(e.measurer).toBe('canvas');
      expect(e.options).toMatchObject({ fontFamily: DIAGRAM_FONT_FAMILY, fontFamilyMono: DIAGRAM_FONT_FAMILY_MONO });
    }
  });

  it('unit/ 항목은 지금 설치된 pele로 같은 옵션·측정기로 다시 렌더하면 바이트 동일', () => {
    const mismatches: string[] = [];
    let checked = 0;
    for (const e of manifest.entries.filter((x) => x.bundle === 'unit' && x.stage !== 'error')) {
      // 수식 항목: 캡처 때와 같은 해석기(mathml-bare)에 매니페스트에 적힌 고정 크기를 주입한다.
      const injected = e.math?.method === 'injected-fixed' ? e.math : undefined;
      const math = (tex: string) => {
        const html = katexMathMarkup(tex);
        return html && injected ? { html, width: injected.width!, height: injected.height! } : null;
      };
      const raw = render(e.source, { ...(e.options as object), math }).svg;
      const now = e.stage === 'sanitized' ? sanitizeDiagramSvg(raw) : raw;
      if (now !== read(e.file)) mismatches.push(e.file);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });

  it('browser/ 항목은 구조 불변식만 확인한다', () => {
    for (const e of manifest.entries.filter((x) => x.bundle === 'browser')) {
      const svg = read(e.file);
      expect(svg.startsWith('<svg'), e.file).toBe(true);
      expect(/<script/i.test(svg), e.file).toBe(false);
      // 라벨 글자 존재(대략적 추출): `$$…$$` 구간과 click 줄(links:false라 툴팁이 없다)을 빼고, 글자를 가진 [..]·".." 라벨만 본다.
      const labelSource = e.source
        .split('\n')
        .filter((l) => !/^\s*click\b/.test(l))
        .join('\n')
        .replace(/\$\$.+?\$\$/g, ' ');
      for (const m of labelSource.matchAll(/\[([^\]"]+)\]|"([^"$]+)"/g)) {
        const label = (m[1] ?? m[2]).trim();
        const isLabel = label.length > 1 && /\p{L}/u.test(label) && !/[<>&]|:\/\//.test(label); // URL·한 글자 옵션값(pos: "t") 제외
        // 수식 구간을 뺀 나머지 글자는 낱말 단위로 확인한다(수식 자리에서 라벨이 여러 text/fO로 나뉜다).
        if (isLabel && e.stage === 'sanitized') for (const w of label.split(/\s+/)) expect(svg, `${e.file} label ${w}`).toContain(w);
      }
      // 수식 라벨: TeX 원문(pele가 엔티티를 풀기 전 소스 그대로가 아닐 수 있어 글자 수 비교 대신 annotation 존재 + $$ 원문 0)
      if (e.stage === 'sanitized' && /\$\$.+?\$\$/.test(e.source)) {
        const texCount = (e.source.match(/\$\$(.+?)\$\$/g) || []).length;
        expect((svg.match(/<annotation encoding="application\/x-tex">/g) || []).length, `${e.file} tex`).toBe(texCount);
        expect(svg).not.toContain('$$');
      }
    }
  });
});
