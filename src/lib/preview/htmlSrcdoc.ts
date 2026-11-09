// HTML 미리보기 선명 모드 — srcdoc 조립 모듈 (SPEC-PREVIEW-019)

// @MX:NOTE: [AUTO] 이 스크립트 상수는 index.html 메타 CSP의 sha256 해시와 한 몸이다.
//   한 글자라도 바꾸면 해시가 달라져 배율이 조용히 안 먹는다. 바꾸면 index.html의 해시를 함께
//   갱신할 것(src/test/htmlSrcdocCsp.test.ts가 일치를 검사한다). 동적 값은 절대 보간하지 않는다
//   (초기 배율은 <style>로 전달한다).
// @MX:SPEC: SPEC-PREVIEW-019 REQ-PREVIEW019-006

/** 부모 → 자식 배율 메시지 type */
export const FRAME_ZOOM_MESSAGE_TYPE = 'mdedit-html-zoom';

/** 선명 모드로 읽을 수 있는 최대 파일 크기(10 MiB). 초과하면 원본 방식으로 폴백한다. */
export const HTML_CRISP_MAX_BYTES = 10 * 1024 * 1024;

/**
 * srcdoc 문서에 주입하는 고정 스크립트 본문(태그 사이 바이트 그대로 해시 대상).
 * - 부모가 보낸 배율 메시지만 받아 documentElement.style.zoom을 바꾼다.
 * - `#` 해시 링크는 <base> 때문에 프레임이 srcdoc을 벗어나므로 문서 안에서 직접 스크롤한다.
 */
export const HTML_ZOOM_FRAME_SCRIPT = `(function () {
  var MIN = 0.67, MAX = 2;
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    var d = e.data;
    if (!d || d.type !== 'mdedit-html-zoom') return;
    var z = d.zoom;
    if (typeof z !== 'number' || !isFinite(z) || z < MIN || z > MAX) return;
    document.documentElement.style.zoom = String(z);
  });
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var h = a.getAttribute('href');
    if (!h || h.charAt(0) !== '#') return;
    e.preventDefault();
    var id;
    try { id = decodeURIComponent(h.slice(1)); } catch (_) { return; }
    var t = id === '' ? null : (document.getElementById(id) || document.getElementsByName(id)[0]);
    if (t) { t.scrollIntoView(); return; }
    if (id === '' || id === 'top') window.scrollTo(0, 0);
  }, true);
})();`;

/**
 * 018 정규화가 끝난 asset 주소에서 파일이 있는 폴더 주소(끝 `/` 포함)를 만든다.
 * 쿼리·해시는 없다고 본다.
 */
export function baseHrefFromAssetUrl(assetUrl: string): string {
  const i = assetUrl.lastIndexOf('/');
  return i >= 0 ? assetUrl.slice(0, i + 1) : assetUrl;
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** 주석을 같은 길이의 공백으로 가려 위치 탐색에서 제외한다(오프셋 보존). */
function maskComments(html: string): string {
  return html.replace(/<!--[\s\S]*?(?:-->|$)/g, (m) => ' '.repeat(m.length));
}

export interface BuildSrcdocOptions {
  /** 폴더 asset 주소(끝 `/` 포함) */
  baseHref: string;
  /** 생성 시점의 배율(%) */
  zoomPercent: number;
}

/**
 * 읽은 HTML 텍스트에 <base>, 초기 zoom <style>, 고정 <script>를 이 순서로 한 번 주입한다.
 * 위치: 첫 <head> 뒤 → <html> 뒤에 <head> 생성 → doctype 뒤 → 맨 앞.
 */
export function buildSrcdoc(html: string, opts: BuildSrcdocOptions): string {
  const z = opts.zoomPercent / 100;
  const inject =
    `<base href="${escapeAttr(opts.baseHref)}">` +
    `<style>html{zoom:${z}}</style>` +
    `<script>${HTML_ZOOM_FRAME_SCRIPT}</script>`;

  const masked = maskComments(html);

  const head = /<head(?:\s[^>]*)?>/i.exec(masked);
  if (head) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + inject + html.slice(at);
  }
  const htmlTag = /<html(?:\s[^>]*)?>/i.exec(masked);
  if (htmlTag) {
    const at = htmlTag.index + htmlTag[0].length;
    return html.slice(0, at) + `<head>${inject}</head>` + html.slice(at);
  }
  const doctype = /<!doctype[^>]*>/i.exec(masked);
  if (doctype) {
    const at = doctype.index + doctype[0].length;
    return html.slice(0, at) + inject + html.slice(at);
  }
  return inject + html;
}
