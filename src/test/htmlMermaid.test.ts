// SPEC-PREVIEW-021 (카드 t2) — 선명 모드 HTML의 mermaid 블록 미리 그리기. AC-002~008, 010(글꼴 삽입 위치).
// jsdom에서는 pele가 내장 글자 폭 표를 쓰고 readPeleThemeValues가 빈 표를 돌려주므로 구조만 단언한다(픽셀·색은 e2e·수동).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

vi.mock('@/lib/export/exportUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/export/exportUtils')>();
  return { ...actual, renderExportDiagram: vi.fn(actual.renderExportDiagram) };
});
vi.mock('@/lib/diagram/diagramRenderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/diagram/diagramRenderer')>();
  return {
    ...actual,
    renderDiagram: vi.fn(actual.renderDiagram),
    readPeleThemeValues: vi.fn(actual.readPeleThemeValues),
  };
});

import { renderExportDiagram } from '@/lib/export/exportUtils';
import { renderDiagram, readPeleThemeValues } from '@/lib/diagram/diagramRenderer';
import { prerenderMermaidBlocks } from '@/lib/preview/htmlMermaid';

const here = dirname(fileURLToPath(import.meta.url));
const frozenErrors = JSON.parse(
  readFileSync(resolve(here, 'fixtures', 'pele', 'm1-frozen', 'errors.json'), 'utf-8'),
) as { id: string; source: string }[];
const errorSource = (id: string) => frozenErrors.find((e) => e.id === id)!.source;
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const OK = 'flowchart LR\n  A --> B';
const BAD = escapeHtml(errorSource('21-error-line-col'));
const BAD0 = escapeHtml(errorSource('22-error-line0-semantic'));

const P = (x: string) => prerenderMermaidBlocks(x, { fonts: false });
const count = (s: string, needle: string) => s.split(needle).length - 1;
const DIAGRAM = 'data-mdedit-diagram=""';

const renderSpy = vi.mocked(renderExportDiagram);
const renderDiagramSpy = vi.mocked(renderDiagram);
const themeSpy = vi.mocked(readPeleThemeValues);

beforeEach(() => {
  renderSpy.mockClear();
  renderDiagramSpy.mockClear();
  themeSpy.mockClear();
});

describe('AC-PREVIEW021-002 감지: 잡는 것', () => {
  const rows: [string, string, number][] = [
    ['pre', `<pre class="mermaid">${OK}</pre>`, 1],
    ['div', `<div class="mermaid">${OK}</div>`, 1],
    ['대문자 태그·속성', `<PRE CLASS="mermaid">${OK}</PRE>`, 1],
    ['작은따옴표·여러 토큰', `<pre class='diagram mermaid big'>${OK}</pre>`, 1],
    ['따옴표 없음', `<div class=mermaid>${OK}</div>`, 1],
    ['다른 속성 함께', `<div id="x" class="mermaid" data-a="1">${OK}</div>`, 1],
    ['중첩 div', `<div class="mermaid"><div>${OK}</div></div><p>after</p>`, 1],
    ['2개', `<pre class="mermaid">${OK}</pre><div class="mermaid">${OK}</div>`, 2],
    ['스크립트 안 닫히지 않은 주석', `<script>var s='<!--';</script><pre class="mermaid">${OK}</pre>`, 1],
    ['따옴표 안 >', `<div title="a>b" class="mermaid">${OK}</div>`, 1],
    ['주석 안 </div>', `<div class="mermaid"><!-- </div> --><div>${OK}</div></div>`, 1],
    ['속성 값 안 </div>', `<div class="mermaid"><div title="</div>">${OK}</div></div><p>after</p>`, 1],
  ];
  it.each(rows)('%s', (_name, input, expected) => {
    expect(count(P(input), DIAGRAM)).toBe(expected);
  });

  it('중첩 div 뒤 <p>after</p>는 블록 밖에 그대로 남는다', () => {
    const out = P(`<div class="mermaid"><div>${OK}</div></div><p>after</p>`);
    expect(out.endsWith('</div><p>after</p>')).toBe(true);
  });
});

describe('AC-PREVIEW021-003 감지: 잡지 않는 것', () => {
  const rows: [string, string][] = [
    ['code.language-mermaid', `<pre><code class="language-mermaid">${OK}</code></pre>`],
    ['code.mermaid', `<code class="mermaid">${OK}</code>`],
    ['mermaid-x', `<div class="mermaid-x">${OK}</div>`],
    ['Mermaid(대소문자)', `<div class="Mermaid">${OK}</div>`],
    ['주석 안', `<!-- <pre class="mermaid">${OK}</pre> -->`],
    ['script 안', `<script>var s='<pre class="mermaid">${OK}</pre>'</script>`],
    ['style 안', `<style>/* <div class="mermaid">${OK}</div> */</style>`],
    ['textarea 안', `<textarea><pre class="mermaid">${OK}</pre></textarea>`],
    ['template 안', `<template><pre class="mermaid">${OK}</pre></template>`],
    ['title 안', `<title><pre class="mermaid">${OK}</pre></title>`],
    ['noscript 안', `<noscript><div class="mermaid">${OK}</div></noscript>`],
    ['닫는 태그 없음', `<pre class="mermaid">${OK}`],
    ['이미 svg', `<div class="mermaid"><svg id="m"></svg></div>`],
    ['data-processed', `<pre class="mermaid" data-processed="true">${OK}</pre>`],
    ['빈 원문', `<pre class="mermaid">   \n  </pre>`],
    ['빈 문자열', ''],
    ['블록 없음', '<p>no diagrams</p>'],
  ];
  it.each(rows)('%s', (_name, input) => {
    expect(P(input)).toBe(input);
  });
});

describe('AC-PREVIEW021-004 원문 추출', () => {
  const firstSource = () => renderSpy.mock.calls[0]![0];

  it('엔티티를 디코드한다', () => {
    P('<pre class="mermaid">flowchart LR\n  A[R&amp;D] --&gt; B</pre>');
    expect(firstSource()).toBe('flowchart LR\n  A[R&D] --> B');
  });
  it('공통 들여쓰기를 걷고 앞뒤를 trim한다', () => {
    P('<pre class="mermaid">\n    flowchart TD\n      A --> B\n    </pre>');
    expect(firstSource()).toBe('flowchart TD\n  A --> B');
  });
  it('<br> 요소를 글자 <br/>로 바꾼다', () => {
    P('<div class="mermaid">flowchart LR\n  A[a<br>b] --> B</div>');
    expect(firstSource()).toContain('a<br/>b');
  });
  it('다른 태그는 버린다', () => {
    P('<div class="mermaid">flowchart LR\n  A[<b>x</b>] --> B</div>');
    expect(firstSource()).toContain('A[x]');
  });
  it('숫자 엔티티를 디코드한다', () => {
    P('<pre class="mermaid">flowchart LR\n  &#65; --> &#x41;B</pre>');
    expect(firstSource()).toContain('A --> AB');
  });
  it('탭 접두사를 걷고 빈 줄은 계산에서 뺀다', () => {
    P('<pre class="mermaid">\n\tflowchart TD\n\n\t  A --> B\n</pre>');
    expect(firstSource()).toBe('flowchart TD\n\n  A --> B');
  });
  it('U+00A0는 공통 접두사에 넣지 않고 마지막 trim이 지운다', () => {
    P('<pre class="mermaid">\n  &nbsp;flowchart TD\n  A --> B</pre>');
    expect(firstSource()).toBe('flowchart TD\nA --> B');
  });
  it('document.body 자식 수가 바뀌지 않는다', () => {
    const before = document.body.childNodes.length;
    P(`<pre class="mermaid">${OK}</pre>`);
    expect(document.body.childNodes.length).toBe(before);
  });
});

describe('AC-PREVIEW021-005 렌더 삽입', () => {
  it('안쪽만 감싸개로 교체하고 시작 태그에 표시 속성만 더한다', () => {
    const out = P(`<body><pre class="mermaid" id="d1">${OK}</pre></body>`);
    expect(out.startsWith('<body><pre class="mermaid" id="d1" data-processed="true">')).toBe(true);
    expect(out.endsWith('</pre></body>')).toBe(true);
    expect(count(out, '<svg')).toBe(1);
    expect(count(out, DIAGRAM)).toBe(1);
    expect(out).not.toContain('var(--pele-');
    expect(P(out)).toBe(out); // 다시 넣으면 건너뜀
  });

  it('감싸개 style에 background·border·border-radius가 있고 var( 가 없다', () => {
    const out = P(`<pre class="mermaid">${OK}</pre>`);
    const style = /data-mdedit-diagram="" style="([^"]*)"/.exec(out)![1]!;
    expect(style).toContain('background:#FAF9F6');
    expect(style).toContain('#97A4B1');
    expect(style).toContain('border-radius:3px');
    expect(style).not.toContain('var(');
  });

  it('/> 와 공백으로 끝나는 시작 태그에도 표시 속성은 한 번, > 바로 앞에 들어간다', () => {
    const a = P(`<div class="mermaid"/>${OK}</div>`);
    const b = P(`<div class=mermaid >${OK}</div>`);
    expect(count(a, 'data-processed="true"')).toBe(1);
    expect(count(b, 'data-processed="true"')).toBe(1);
    expect(a.startsWith('<div class="mermaid" data-processed="true"/>')).toBe(true);
    expect(/^<div class=mermaid\s*data-processed="true">/.test(b)).toBe(true);
  });

  it('readPeleThemeValues는 호출당 1번, 렌더 두 번째 인자로 넘어간다', () => {
    P(`<pre class="mermaid">${OK}</pre><pre class="mermaid">${OK}</pre><pre class="mermaid">${OK}</pre>`);
    expect(themeSpy).toHaveBeenCalledTimes(1);
    expect(themeSpy).toHaveBeenCalledWith('light');
    const values = themeSpy.mock.results[0]!.value;
    expect(renderSpy).toHaveBeenCalledTimes(3);
    for (const call of renderSpy.mock.calls) expect(call[1]).toBe(values);
  });

  it('판단 노드에 모양 톤이 들어온다', () => {
    const decision = P('<pre class="mermaid">flowchart TD\n  A{x?} --> B</pre>');
    const plain = P('<pre class="mermaid">flowchart TD\n  A[x] --> B</pre>');
    // 판단 노드가 없으면 판단 테두리 색이 나오지 않아야 하고, 있으면 나와야 한다(공허한 단언 방지).
    expect(decision.toLowerCase()).toContain('#8a6410');
    expect(plain.toLowerCase()).not.toContain('#8a6410');
  });

  it('블록 20개를 모두 그린다', () => {
    const many = Array.from({ length: 20 }, () => `<pre class="mermaid">${OK}</pre>`).join('\n');
    expect(count(P(many), DIAGRAM)).toBe(20);
  });
});

describe('AC-PREVIEW021-006 실패 안내', () => {
  const MSG = '⚠ 이 다이어그램은 그릴 수 없었습니다';

  it('블록은 그대로 두고 바로 뒤에 안내 1개', () => {
    const input = `<pre class="mermaid">${BAD}</pre><p>x</p>`;
    const out = P(input);
    expect(out.startsWith(`<pre class="mermaid">${BAD}</pre><p data-mdedit-diagram-error="" style="`)).toBe(true);
    expect(out.endsWith('</p><p>x</p>')).toBe(true);
    expect(count(out, 'data-mdedit-diagram-error=""')).toBe(1);
  });

  it('실제 pele 실패의 행·열을 쓴다', () => {
    expect(P(`<pre class="mermaid">${BAD}</pre>`)).toContain(`>${MSG} (2행 14열)</p>`);
    expect(P(`<pre class="mermaid">${BAD0}</pre>`)).toContain(`>${MSG}</p>`);
  });

  it('오류 메시지 문자열은 안내에 들어가지 않는다', () => {
    renderSpy.mockReturnValueOnce(null);
    renderDiagramSpy.mockReturnValueOnce({
      ok: false,
      error: { code: 'x', message: '<img src=x onerror=alert(1)>', line: 1, column: 2 },
    });
    const out = P(`<pre class="mermaid">${OK}</pre>`);
    expect(out).toContain(`>${MSG} (1행 2열)</p>`);
    expect(out).not.toContain('onerror');
  });

  it('두 번째 renderDiagram이 ok면 접미사가 없다', () => {
    renderSpy.mockReturnValueOnce(null);
    const out = P(`<pre class="mermaid">${OK}</pre>`);
    expect(out).toContain(`>${MSG}</p>`);
  });

  it('성공 1 + 실패 1: 실패 블록에만 안내', () => {
    const out = P(`<pre class="mermaid">${OK}</pre><pre class="mermaid">${BAD}</pre>`);
    expect(count(out, DIAGRAM)).toBe(1);
    expect(count(out, 'data-mdedit-diagram-error=""')).toBe(1);
  });
});

describe('AC-PREVIEW021-007 블록 밖 바이트 보존', () => {
  const H =
    '<!doctype html>\n<html><head><script src="https://cdn.example/mermaid.js"></script><script>mermaid.initialize({theme:"dark"})</script></head><body>\n<p>앞</p>\n<pre class="mermaid">OK</pre>\n<p>뒤</p>\n</body></html>'.replace(
      '>OK<',
      `>${OK}<`,
    );
  const INNER = OK;

  it('블록 안쪽과 표시 속성을 빼면 원문과 같다(글꼴 끔)', () => {
    const out = P(H);
    const stripped = out
      .replace(/(<pre class="mermaid") data-processed="true">[\s\S]*<\/pre>/, '$1>' + INNER + '</pre>');
    expect(stripped).toBe(H);
    expect(out).toContain('<script src="https://cdn.example/mermaid.js"></script><script>mermaid.initialize({theme:"dark"})</script>');
  });

  it('글꼴 삽입을 켜면 <style> 1개만 더 빠진다', () => {
    const out = prerenderMermaidBlocks(H, { fonts: true });
    const stripped = out
      .replace(/<style data-mdedit-diagram-fonts="">[\s\S]*?<\/style>/, '')
      .replace(/(<pre class="mermaid") data-processed="true">[\s\S]*<\/pre>/, '$1>' + INNER + '</pre>');
    expect(stripped).toBe(H);
  });
});

describe('AC-PREVIEW021-008 동기·예외 안전', () => {
  it('string을 동기로 돌려준다', () => {
    expect(typeof P(`<pre class="mermaid">${OK}</pre>`)).toBe('string');
  });
  it('렌더가 예외를 던지면 입력을 그대로 돌려준다', () => {
    renderSpy.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const input = `<pre class="mermaid">${OK}</pre>`;
    expect(P(input)).toBe(input);
  });
});

describe('AC-PREVIEW021-010 글꼴 <style> 삽입 위치', () => {
  const run = (html: string) => prerenderMermaidBlocks(html, { fonts: true });

  it('성공 블록이 있으면 마지막 </body> 앞에 정확히 1번, Barlow 포함', () => {
    const out = run(`<html><body><pre class="mermaid">${OK}</pre></body></html>`);
    expect(count(out, 'data-mdedit-diagram-fonts')).toBe(1);
    expect(out).toContain('Barlow');
    expect(out.indexOf('data-mdedit-diagram-fonts')).toBeLessThan(out.lastIndexOf('</body>'));
    expect(/<\/style><\/body><\/html>$/.test(out)).toBe(true);
  });
  it('</body>가 없으면 끝에 넣는다', () => {
    const out = run(`<pre class="mermaid">${OK}</pre>`);
    expect(out.endsWith('</style>')).toBe(true);
  });
  it('블록 안쪽 원문의 </body> 글자는 위치로 쓰지 않는다', () => {
    const out = run(`<body><div class="mermaid">flowchart LR\n  A[&lt;/body&gt;] --> B</div></body>`);
    const fontsAt = out.indexOf('data-mdedit-diagram-fonts');
    expect(fontsAt).toBeGreaterThan(out.indexOf('</div>'));
    expect(count(out, 'data-mdedit-diagram-fonts')).toBe(1);
  });
  it('성공 블록이 0개면 넣지 않는다', () => {
    const failOnly = `<pre class="mermaid">${BAD}</pre>`;
    expect(count(run(failOnly), 'data-mdedit-diagram-fonts')).toBe(0);
    expect(count(run('<p>none</p>'), 'data-mdedit-diagram-fonts')).toBe(0);
  });
});

describe('입력 폭주 방어 (sync-audit F1)', () => {
  it('닫는 `>`가 없는 시작 태그 4만 개도 즉시 입력을 그대로 돌려준다', () => {
    const hostile = '<div '.repeat(40000) + ' mermaid';
    const t0 = Date.now();
    expect(P(hostile)).toBe(hostile);
    expect(Date.now() - t0).toBeLessThan(500);
  });

  it('mermaid 글자가 없으면 스캔 없이 입력을 그대로 돌려준다', () => {
    const hostile = '<div '.repeat(40000);
    const t0 = Date.now();
    expect(P(hostile)).toBe(hostile);
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
