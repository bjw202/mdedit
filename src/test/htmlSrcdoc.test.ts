// srcdoc 조립 모듈·자식 처리기 단위 테스트 — SPEC-PREVIEW-019 (AC-003·004·005·011)
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  HTML_ZOOM_FRAME_SCRIPT,
  FRAME_ZOOM_MESSAGE_TYPE,
  baseHrefFromAssetUrl,
  buildSrcdoc,
} from '@/lib/preview/htmlSrcdoc';

const BASE = 'asset://localhost/proj/';
const build = (html: string, zoomPercent = 100): string =>
  buildSrcdoc(html, { baseHref: BASE, zoomPercent });

// ---- AC-003: 조립 함수 ----

describe('buildSrcdoc (AC-003)', () => {
  const INJECT_RE = /<base href="[^"]*"><style>[^<]*<\/style><script>[\s\S]*?<\/script>/;

  function expectInjectedOnce(out: string): void {
    expect(out.split('<base ').length - 1).toBe(1 + (out.includes('https://x/') ? 1 : 0));
    expect(out.split('<script>').length - 1).toBe(1);
    expect(out.split('<style>html{zoom:').length - 1).toBe(1);
    expect(INJECT_RE.test(out)).toBe(true);
  }

  it('doctype 문서: doctype이 첫 문자열이고 <head> 시작 태그 바로 뒤에 주입한다', () => {
    const out = build('<!doctype html><html><head><title>t</title></head><body>b</body></html>');
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toMatch(/<head><base href=/);
    expect(out.indexOf('<base ')).toBeLessThan(out.indexOf('<title>'));
    expectInjectedOnce(out);
  });

  it('대문자 <HEAD>도 찾는다', () => {
    const out = build('<HTML><HEAD></HEAD><BODY>x</BODY></HTML>');
    expect(out).toMatch(/<HEAD><base href=/);
    expectInjectedOnce(out);
  });

  it('속성 있는 head 시작 태그 전체 뒤에 주입한다', () => {
    const out = build('<html><head lang=x><title>t</title></head></html>');
    expect(out).toMatch(/<head lang=x><base href=/);
  });

  it('head가 없으면 <html> 뒤에 <head>를 만들어 넣고 <body> 앞이다', () => {
    const out = build('<html><body>b</body></html>');
    expect(out).toMatch(/^<html><head><base href=/);
    expect(out.indexOf('</head>')).toBeLessThan(out.indexOf('<body>'));
    expectInjectedOnce(out);
  });

  it('html·head가 없는 조각은 맨 앞에 주입한다', () => {
    const out = build('<p>fragment</p>');
    expect(out.startsWith('<base href=')).toBe(true);
    expect(out.endsWith('<p>fragment</p>')).toBe(true);
  });

  it('doctype만 있으면 doctype 바로 뒤에 주입한다', () => {
    const out = build('<!doctype html><p>x</p>');
    expect(out).toMatch(/^<!doctype html><base href=/);
  });

  it('주석 안의 <head>는 건너뛰고 실제 <head> 뒤에 주입한다', () => {
    const out = build('<!-- <head> --><head></head>');
    expect(out.startsWith('<!-- <head> --><head><base href=')).toBe(true);
  });

  it('주입 <base>가 원본 <base>보다 앞이다', () => {
    const out = build('<head><base href="https://x/"></head>');
    expect(out.indexOf(`<base href="${BASE}">`)).toBeLessThan(out.indexOf('<base href="https://x/">'));
  });

  it('<header>는 <head>가 아니다', () => {
    const out = build('<html><body><header>h</header></body></html>');
    expect(out).toMatch(/^<html><head><base href=/);
    expect(out.indexOf('</head>')).toBeLessThan(out.indexOf('<header>'));
  });

  it('UTF-8 BOM으로 시작해도 BOM이 첫 문자로 남고 doctype이 그 뒤 첫 노드다', () => {
    const out = build('﻿<!doctype html><html><head></head></html>');
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.slice(1).startsWith('<!doctype html>')).toBe(true);
    expect(out).toMatch(/<head><base href=/);
  });

  it('빈 문자열은 주입만 있는 문서다', () => {
    const out = build('');
    expect(INJECT_RE.test(out)).toBe(true);
    expect(out.startsWith('<base href=')).toBe(true);
  });

  it('초기 배율을 <style>에 넣는다', () => {
    expect(build('', 125)).toContain('zoom:1.25');
    expect(build('', 67)).toContain('zoom:0.67');
    expect(build('', 200)).toContain('zoom:2}');
  });

  it('<script> 사이 텍스트는 상수와 한 글자도 다르지 않다 (AC-006 일부)', () => {
    const out = build('<html><head></head></html>', 150);
    expect(out).toContain(`<script>${HTML_ZOOM_FRAME_SCRIPT}</script>`);
  });

  it('baseHref의 " < & 는 이스케이프된다', () => {
    const out = buildSrcdoc('', { baseHref: 'a"b<c&d/', zoomPercent: 100 });
    expect(out).toContain('<base href="a&quot;b&lt;c&amp;d/">');
  });
});

describe('baseHrefFromAssetUrl (AC-003)', () => {
  it('마지막 /까지(끝 / 포함) 자른다', () => {
    expect(baseHrefFromAssetUrl('http://asset.localhost/C%3A/Users/u/A/page.html')).toBe(
      'http://asset.localhost/C%3A/Users/u/A/',
    );
    expect(baseHrefFromAssetUrl('asset://localhost//Users/u/A/page.html')).toBe(
      'asset://localhost//Users/u/A/',
    );
  });

  it('이미 인코딩된 한글·공백 폴더 이름을 이중 인코딩하지 않는다', () => {
    const u = 'asset://localhost//Users/u/%ED%95%9C%EA%B8%80%20dir/p.html';
    expect(baseHrefFromAssetUrl(u)).toBe('asset://localhost//Users/u/%ED%95%9C%EA%B8%80%20dir/');
  });
});

// ---- 자식 처리기 하네스 (AC-004·005) ----

interface ChildFrame {
  win: Window & { eval: (s: string) => unknown };
  doc: Document;
  frame: HTMLIFrameElement;
}

const frames: HTMLIFrameElement[] = [];

function makeChild(bodyHtml = ''): ChildFrame {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  frames.push(frame);
  const win = frame.contentWindow as ChildFrame['win'];
  const doc = frame.contentDocument as Document;
  doc.body.innerHTML = bodyHtml;
  return { win, doc, frame };
}

function runScript(child: ChildFrame): void {
  child.win.eval(HTML_ZOOM_FRAME_SCRIPT);
}

function sendZoom(child: ChildFrame, source: unknown, data: unknown): void {
  const ev = new MessageEvent('message', { data, source: source as MessageEventSource | null });
  child.win.dispatchEvent(ev);
}

afterEach(() => {
  for (const f of frames.splice(0)) f.remove();
});

describe('자식 처리기: 배율 메시지 (AC-004)', () => {
  const ok = { type: FRAME_ZOOM_MESSAGE_TYPE, zoom: 1.5 };

  it('부모가 보낸 유효한 메시지는 documentElement.style.zoom을 바꾼다', () => {
    const c = makeChild();
    runScript(c);
    sendZoom(c, c.win.parent, ok);
    expect(c.doc.documentElement.style.zoom).toBe('1.5');
  });

  it('경계값 0.67과 2는 적용된다', () => {
    const c = makeChild();
    runScript(c);
    sendZoom(c, c.win.parent, { type: FRAME_ZOOM_MESSAGE_TYPE, zoom: 0.67 });
    expect(c.doc.documentElement.style.zoom).toBe('0.67');
    sendZoom(c, c.win.parent, { type: FRAME_ZOOM_MESSAGE_TYPE, zoom: 2 });
    expect(c.doc.documentElement.style.zoom).toBe('2');
  });

  it('source가 부모가 아니면(형제 window, null) 무시한다', () => {
    const c = makeChild();
    const sibling = makeChild();
    runScript(c);
    sendZoom(c, sibling.win, ok);
    sendZoom(c, null, ok);
    expect(c.doc.documentElement.style.zoom).toBe('');
  });

  it.each([
    ['type 불일치', { type: 'other', zoom: 1.5 }],
    ['문자열 zoom', { type: FRAME_ZOOM_MESSAGE_TYPE, zoom: '1.5' }],
    ['NaN', { type: FRAME_ZOOM_MESSAGE_TYPE, zoom: NaN }],
    ['Infinity', { type: FRAME_ZOOM_MESSAGE_TYPE, zoom: Infinity }],
    ['범위 미만 0.5', { type: FRAME_ZOOM_MESSAGE_TYPE, zoom: 0.5 }],
    ['범위 초과 2.5', { type: FRAME_ZOOM_MESSAGE_TYPE, zoom: 2.5 }],
    ['음수', { type: FRAME_ZOOM_MESSAGE_TYPE, zoom: -1 }],
    ['data null', null],
    ['data 문자열', 'zoom'],
  ])('잘못된 메시지(%s)는 무시한다', (_name, data) => {
    const c = makeChild();
    runScript(c);
    sendZoom(c, c.win.parent, data);
    expect(c.doc.documentElement.style.zoom).toBe('');
  });
});

describe('자식 처리기: 해시 링크 가로채기 (AC-005)', () => {
  const BODY = `
    <a id="l-sec2" href="#sec2"><span id="inner">sec2</span></a>
    <a id="l-old" href="#old">old</a>
    <a id="l-top" href="#top">top</a>
    <a id="l-empty" href="#">empty</a>
    <a id="l-missing" href="#missing">missing</a>
    <a id="l-file" href="other.html">file</a>
    <a id="l-ext" href="https://x/">ext</a>
    <a id="l-ko" href="#%ED%95%9C">ko</a>
    <a id="l-bad" href="#%E0%A4%A">bad</a>
    <h2 id="sec2">s2</h2><a name="old"></a><h2 id="한">ko</h2>`;

  function setup(extraBody = ''): {
    c: ChildFrame;
    scrollInto: Map<string, number>;
    scrollTo: ReturnType<typeof vi.fn>;
    click: (id: string) => boolean;
  } {
    const c = makeChild(BODY + extraBody);
    const scrollInto = new Map<string, number>();
    (c.win as unknown as { Element: typeof Element }).Element.prototype.scrollIntoView = function (
      this: Element,
    ) {
      scrollInto.set(this.id || this.getAttribute('name') || '?', (scrollInto.get(this.id) ?? 0) + 1);
    };
    const scrollTo = vi.fn();
    (c.win as unknown as { scrollTo: unknown }).scrollTo = scrollTo;
    runScript(c);
    const click = (id: string): boolean => {
      const el = c.doc.getElementById(id) as HTMLElement;
      const ev = new (c.win as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    return { c, scrollInto, scrollTo, click };
  }

  it('#sec2는 기본 동작을 막고 대상으로 scrollIntoView 한다 (내부 span 클릭 포함)', () => {
    const { click, scrollInto } = setup();
    expect(click('inner')).toBe(true);
    expect(scrollInto.get('sec2')).toBe(1);
  });

  it('name 속성 대상도 찾는다', () => {
    const { click, scrollInto } = setup();
    expect(click('l-old')).toBe(true);
    expect(scrollInto.size).toBe(1);
  });

  it('#top·#는 맨 위로 이동한다', () => {
    const { click, scrollTo } = setup();
    expect(click('l-top')).toBe(true);
    expect(click('l-empty')).toBe(true);
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('id="top" 요소가 있으면 #top은 그 요소로 이동하고 scrollTo는 부르지 않는다', () => {
    const { click, scrollInto, scrollTo } = setup('<div id="top">t</div>');
    expect(click('l-top')).toBe(true);
    expect(scrollInto.get('top')).toBe(1);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('대상 없는 #missing은 막기만 하고 스크롤하지 않는다', () => {
    const { click, scrollInto, scrollTo } = setup();
    expect(click('l-missing')).toBe(true);
    expect(scrollInto.size).toBe(0);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('해시가 아닌 링크는 가로채지 않는다', () => {
    const { click } = setup();
    expect(click('l-file')).toBe(false);
    expect(click('l-ext')).toBe(false);
  });

  it('퍼센트 인코딩 한글 id는 디코드해서 찾는다', () => {
    const { click, scrollInto } = setup();
    expect(click('l-ko')).toBe(true);
    expect(scrollInto.get('한')).toBe(1);
  });

  it('잘못된 퍼센트 시퀀스는 예외 없이 막기만 한다', () => {
    const { click, scrollInto, scrollTo } = setup();
    expect(click('l-bad')).toBe(true);
    expect(scrollInto.size).toBe(0);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

// ---- AC-011: 스크립트 상수 형태 ----

describe('HTML_ZOOM_FRAME_SCRIPT 형태 (AC-006·011)', () => {
  it.each(['fetch', 'XMLHttpRequest', 'parent.', 'top.', '__TAURI', 'postMessage', 'localStorage', 'eval(', 'Function(', 'import('])(
    '금지 토큰 %s 이 없다',
    (token) => {
      expect(HTML_ZOOM_FRAME_SCRIPT.includes(token)).toBe(false);
    },
  );

  it('</script, <!-- 를 포함하지 않는다', () => {
    expect(HTML_ZOOM_FRAME_SCRIPT.includes('</script')).toBe(false);
    expect(HTML_ZOOM_FRAME_SCRIPT.includes('<!--')).toBe(false);
  });

  it('메시지 type 상수가 스크립트 안 문자열과 같다', () => {
    expect(HTML_ZOOM_FRAME_SCRIPT.includes(`'${FRAME_ZOOM_MESSAGE_TYPE}'`)).toBe(true);
  });
});
