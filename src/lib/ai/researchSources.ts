// @MX:NOTE: [AUTO] SPEC-AI-016 D7 — 리서치 결과의 출처 검증(순수 함수). 결과 텍스트에서 주소를 뽑아
//   백엔드가 "열어 본 페이지"로 기록한 목록과 비교한다. 결과 텍스트는 고치지 않는다(알림 전용).
// @MX:SPEC: SPEC-AI-016 REQ-AI16-012

/** 주소 비교용 정규화 — 스킴·호스트 소문자, `#` 뒤 제거, 끝 `/` 제거. 경로 대소문자는 유지한다. */
export function normalizeUrl(url: string): string {
  const noFragment = url.replace(/#.*$/, '');
  const m = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?]*)(.*)$/.exec(noFragment);
  const base = m ? `${m[1].toLowerCase()}://${m[2].toLowerCase()}${m[3]}` : noFragment;
  return base.replace(/\/+$/, '');
}

/** 맨 주소가 끝나는 문자: 공백·`<`·`>`·`]`·백틱·`"`·`'`. `)` 는 짝이 맞을 때만 이어진다. */
const BARE_STOP = /[\s<>\]`"']/;
const TRAILING_PUNCT = /[.,;]+$/;

/** `://` 뒤에 호스트가 있는지(스킴 뒤 첫 글자가 `/`·`?`·끝이 아닌지) 확인한다. */
function hasHost(url: string): boolean {
  const rest = url.slice(url.indexOf('://') + 3);
  return rest.length > 0 && !/^[/?#]/.test(rest);
}

/**
 * 결과 텍스트에서 http(s) 주소를 발생 순서대로 뽑는다(중복 제거).
 * - 마크다운 링크 `](…)` 의 대상은 짝이 맞는 닫는 괄호까지(1단계 중첩 허용)
 * - 맨 주소는 BARE_STOP 이나 짝 없는 `)` 전까지, 끝의 `.`·`,`·`;` 는 뺀다
 */
export function extractUrls(text: string): string[] {
  const found: string[] = [];
  const re = /https?:\/\//gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    let depth = 0;
    let i = start;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (BARE_STOP.test(ch)) break;
      if (ch === '(') depth++;
      else if (ch === ')') {
        if (depth === 0) break; // 짝 없는 닫는 괄호
        depth--;
      }
    }
    const url = text.slice(start, i).replace(TRAILING_PUNCT, '');
    re.lastIndex = Math.max(i, start + 1);
    if (!hasHost(url)) continue;
    if (!found.includes(url)) found.push(url);
  }
  return found;
}

/** 결과 텍스트의 주소 가운데, 정규화 후 `opened` 에 없는 것을 발생 순서대로 돌려준다. */
export function findUnverifiedSources(result: string, opened: readonly string[]): string[] {
  const openedSet = new Set(opened.map(normalizeUrl));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of extractUrls(result)) {
    const key = normalizeUrl(url);
    if (openedSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}
