// SPEC-PREVIEW-021 (카드 t2) — 선명 모드(srcdoc) HTML의 `pre.mermaid`·`div.mermaid` 블록을 pele SVG로 미리 그려 넣는다.
// 순수 문자열 변환이다: HTML 전체를 DOM으로 다시 직렬화하지 않고(doctype·스크립트·공백 보존), 같은 길이로 가린 사본에서
// 위치를 찾은 뒤 원본의 블록 안쪽만 오프셋으로 교체한다.
import { renderExportDiagram } from '@/lib/export/exportUtils';
import { readPeleThemeValues, renderDiagram, type PeleThemeValues } from '@/lib/diagram/diagramRenderer';

// 따옴표 값을 건너뛰는 속성 묶음. 시작 태그 정규식 전부가 이 조각을 쓴다.
const ATTRS = String.raw`((?:\s+[^\s=>/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*\/?>`;
const RAW_TEXT_TAGS = 'script|style|textarea|title|template|xmp|iframe|noembed|noframes|noscript';
const SCAN_RE = () => new RegExp(String.raw`<!--|<(${RAW_TEXT_TAGS})${ATTRS}`, 'gi');
const BLOCK_RE = () => new RegExp(String.raw`<(pre|div)${ATTRS}`, 'gi');
const DIV_DEPTH_RE = () => new RegExp(String.raw`<div${ATTRS}|<\/div\s*>`, 'gi');

const FAIL_MESSAGE = '⚠ 이 다이어그램은 그릴 수 없었습니다';
const SAFE_CSS_VALUE = /^[#\w\s.,()%-]+$/;
const SAFE_ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9.\-:[\]]+$/i;

interface Block {
  /** 시작 태그에 표시 속성을 넣을 위치(`>` 또는 `/>` 앞) */
  tagInsertAt: number;
  innerStart: number;
  innerEnd: number;
  /** 닫는 태그 끝 */
  end: number;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

/** 주석과 원문 텍스트 요소 안쪽을 같은 길이의 공백으로 바꾼 사본을 만든다(앞에서부터 한 번만 훑는다). */
function maskNonMarkup(html: string): string {
  const ranges: [number, number][] = [];
  const re = SCAN_RE();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[0] === '<!--') {
      const close = html.indexOf('-->', m.index + 4);
      const end = close === -1 ? html.length : close + 3;
      ranges.push([m.index, end]);
      re.lastIndex = end;
    } else {
      const afterTag = m.index + m[0].length;
      const closeRe = new RegExp(String.raw`<\/${m[1]}\s*>`, 'gi');
      closeRe.lastIndex = afterTag;
      const c = closeRe.exec(html);
      const innerEnd = c ? c.index : html.length;
      ranges.push([afterTag, innerEnd]);
      re.lastIndex = c ? c.index + c[0].length : html.length;
    }
  }
  if (ranges.length === 0) return html;
  let out = '';
  let pos = 0;
  for (const [a, b] of ranges) {
    out += html.slice(pos, a) + ' '.repeat(b - a);
    pos = b;
  }
  return out + html.slice(pos);
}

function classTokens(attrs: string): string[] {
  const m = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i.exec(attrs);
  const value = m ? (m[1] ?? m[2] ?? m[3] ?? '') : '';
  return value.split(/\s+/).filter(Boolean);
}

/** 가림 사본에서 mermaid 블록 위치를 찾는다. 짝을 못 찾거나 이미 그려진 블록은 넣지 않는다. */
function findMermaidBlocks(masked: string): Block[] {
  const blocks: Block[] = [];
  const re = BLOCK_RE();
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    const tag = m[1]!.toLowerCase();
    const attrs = m[2] ?? '';
    if (!classTokens(attrs).includes('mermaid')) continue;
    const innerStart = m.index + m[0].length;
    const innerEnd = findClosing(masked, tag, innerStart);
    if (innerEnd === -1) continue;
    const closeMatch = new RegExp(String.raw`<\/${tag}\s*>`, 'i').exec(masked.slice(innerEnd));
    const end = innerEnd + (closeMatch ? closeMatch[0].length : 0);
    // 같은 블록의 안쪽을 다시 훑지 않는다.
    re.lastIndex = end;
    if (/(?:^|\s)data-processed(?=\s|=|$)/i.test(attrs)) continue;
    if (/<svg/i.test(masked.slice(innerStart, innerEnd))) continue;
    blocks.push({ tagInsertAt: m.index + m[0].length - (m[0].endsWith('/>') ? 2 : 1), innerStart, innerEnd, end });
  }
  return blocks;
}

/** 닫는 태그의 시작 위치. `div`는 깊이를 센다. 못 찾으면 -1. */
function findClosing(masked: string, tag: string, from: number): number {
  if (tag === 'pre') {
    const re = /<\/pre\s*>/gi;
    re.lastIndex = from;
    const c = re.exec(masked);
    return c ? c.index : -1;
  }
  const re = DIV_DEPTH_RE();
  re.lastIndex = from;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return m.index;
  }
  return -1;
}

function dedent(text: string): string {
  const lines = text.split('\n');
  let prefix: string | null = null;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const lead = /^[ \t]*/.exec(line)![0];
    if (prefix === null) {
      prefix = lead;
      continue;
    }
    let i = 0;
    while (i < prefix.length && i < lead.length && prefix[i] === lead[i]) i++;
    prefix = prefix.slice(0, i);
  }
  const strip = prefix ?? '';
  return lines.map((l) => (l.startsWith(strip) ? l.slice(strip.length) : l)).join('\n');
}

/** 블록 안쪽 HTML에서 mermaid 원문을 뽑는다. 활성 문서에 넣지 않는 `<template>`만 쓴다. */
function extractSource(innerHtml: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = innerHtml;
  for (const br of Array.from(tpl.content.querySelectorAll('br'))) {
    br.replaceWith(document.createTextNode('<br/>'));
  }
  return dedent(tpl.content.textContent ?? '').trim();
}

function safeCss(value: string | undefined, fallback: string): string {
  return value && SAFE_CSS_VALUE.test(value) ? value : fallback;
}

function wrapperOpen(values: PeleThemeValues): string {
  const bg = safeCss(values['--pele-bg'], '#FAF9F6');
  const bd = safeCss(values['--pele-border'], '#97A4B1');
  const rad = safeCss(values['--pele-radius'], '3px');
  return `<div data-mdedit-diagram="" style="display:flex;justify-content:center;background:${bg};border:1px solid ${bd};border-radius:${rad};margin:0 0 1rem">`;
}

/** 실패 블록 뒤에 붙일 안내. 오류 메시지 문자열은 쓰지 않고 행·열 숫자만 쓴다. */
function failureNote(source: string): string {
  let suffix = '';
  try {
    const r = renderDiagram(source);
    if (!r.ok && Number.isFinite(r.error.line) && r.error.line > 0) {
      suffix = ` (${Math.trunc(r.error.line)}행 ${Math.trunc(r.error.column)}열)`;
    }
  } catch {
    /* 안내만 짧아진다 */
  }
  return `<p data-mdedit-diagram-error="" style="font-size:0.875rem;color:#F59E0B;font-style:italic;margin:0.25rem 0">${FAIL_MESSAGE}${suffix}</p>`;
}

/** 앱 출처 `@font-face` — pele가 쓰는 Barlow 400·600(→ 700 파일)과 IBM Plex Mono 400. 출처를 얻지 못하면 null. */
function fontStyle(): string | null {
  const origin = typeof location !== 'undefined' ? location.origin : '';
  if (!origin || !SAFE_ORIGIN.test(origin)) return null;
  const face = (family: string, weight: number, file: string) =>
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${origin}/fonts/${file}') format('woff2')}`;
  return `<style data-mdedit-diagram-fonts="">${face('Barlow', 400, 'barlow-400.woff2')}${face('Barlow', 600, 'barlow-700.woff2')}${face('IBM Plex Mono', 400, 'ibm-plex-mono-400.woff2')}</style>`;
}

// @MX:NOTE: 삽입 계약(SPEC-PREVIEW-021) — 블록의 안쪽만 교체하고 시작 태그에 data-processed만 더한다. 블록 밖 바이트는 그대로,
//   실패 블록은 원문 유지 + 안내 한 줄, 어떤 예외도 밖으로 내지 않고 입력을 그대로 돌려준다(동기 함수).
// @MX:WARN: srcdoc에 들어가는 마크업은 정화된 pele SVG와 이 파일의 고정 문자열만으로 조립한다
// @MX:REASON: srcdoc 안 페이지는 allow-scripts 샌드박스다. 원문·오류 메시지·페이지 문자열을 마크업에 이어 붙이면 XSS 경로가 된다.
/**
 * 선명 모드 HTML의 mermaid 블록을 pele SVG로 미리 그린다.
 * @param opts.fonts 앱 출처 글꼴 `<style>` 삽입 여부(기본 true). 단위 테스트가 글꼴을 끄고 켜는 데 쓴다.
 */
export function prerenderMermaidBlocks(html: string, opts?: { fonts?: boolean }): string {
  // 시작 태그 정규식은 닫는 `>`가 없으면 태그 수에 대해 이차 시간이 든다. 블록이 있을 수 없는 입력은 스캔 전에 돌려보낸다.
  if (!/mermaid/i.test(html) || html.indexOf('>') === -1) return html;
  try {
    const masked = maskNonMarkup(html);
    const blocks = findMermaidBlocks(masked);
    if (blocks.length === 0) return html;

    const values = readPeleThemeValues('light');
    const edits: Edit[] = [];
    let rendered = 0;
    for (const b of blocks) {
      const source = extractSource(html.slice(b.innerStart, b.innerEnd));
      if (!source) continue;
      const result = renderExportDiagram(source, values);
      if (result) {
        edits.push({ start: b.tagInsertAt, end: b.tagInsertAt, text: ' data-processed="true"' });
        edits.push({ start: b.innerStart, end: b.innerEnd, text: `${wrapperOpen(values)}${result.svg.outerHTML}</div>` });
        rendered++;
      } else {
        edits.push({ start: b.end, end: b.end, text: failureNote(source) });
      }
    }

    if (rendered > 0 && opts?.fonts !== false) {
      const style = fontStyle();
      if (style) {
        const bodyRe = /<\/body\s*>/gi;
        let at = html.length;
        let m: RegExpExecArray | null;
        while ((m = bodyRe.exec(masked)) !== null) {
          if (!blocks.some((b) => m!.index >= b.tagInsertAt && m!.index < b.end)) at = m.index;
        }
        edits.push({ start: at, end: at, text: style });
      }
    }

    // 큰 오프셋부터 치환해 앞쪽 오프셋이 흔들리지 않게 한다.
    edits.sort((a, b) => b.start - a.start);
    let out = html;
    for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    return out;
  } catch {
    return html;
  }
}
