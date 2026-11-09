// 앱 셸 메타 CSP ↔ 주입 스크립트 해시 일치 테스트 — SPEC-PREVIEW-019 (AC-006)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { HTML_ZOOM_FRAME_SCRIPT } from '@/lib/preview/htmlSrcdoc';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

function readMetaCsp(html: string): string {
  const m = html.match(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/i);
  if (!m) throw new Error('index.html에 메타 CSP가 없다');
  return m[1];
}

function parseDirectives(csp: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    out.set(tokens[0], new Set(tokens.slice(1)));
  }
  return out;
}

const sha256Token = (text: string): string =>
  `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

// 기준 집합: SPEC-SEC-001 병합(7302a2d, a97d63c) 시점 index.html 메타 CSP에서 이 SPEC의 변경(해시 1개,
// style-src asset 3개)을 뺀 값. git 이력이 아니라 고정 기대값이다(CI shallow checkout 대응).
// 이후 다른 SPEC이 CSP를 바꾸면 이 기대값을 함께 갱신한다.
const BASELINE: Record<string, string[]> = {
  'default-src': ["'self'", 'tauri:', 'asset:', 'http://asset.localhost', 'https://asset.localhost'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'img-src': ["'self'", 'data:', 'asset:', 'http://asset.localhost', 'https://asset.localhost'],
  'connect-src': [
    "'self'",
    'tauri:',
    'asset:',
    'http://asset.localhost',
    'https://asset.localhost',
    'ws://localhost:*',
    'http://localhost:*',
  ],
  'frame-src': ["'self'", 'asset:', 'http://asset.localhost', 'https://asset.localhost'],
};
const STYLE_ASSET_TOKENS = ['asset:', 'http://asset.localhost', 'https://asset.localhost'];

describe('앱 셸 메타 CSP (AC-006)', () => {
  const directives = parseDirectives(readMetaCsp(indexHtml));

  it('script-src의 sha256 토큰은 정확히 1개이고 주입 스크립트 상수의 해시와 같다', () => {
    const script = [...(directives.get('script-src') ?? [])];
    const hashes = script.filter((t) => t.startsWith("'sha256-"));
    expect(hashes).toEqual([sha256Token(HTML_ZOOM_FRAME_SCRIPT)]);
  });

  it("script-src에 'unsafe-inline'·'unsafe-eval'·asset:·http 출처가 없다", () => {
    const script = [...(directives.get('script-src') ?? [])];
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(script.some((t) => t === 'asset:' || t.startsWith('http'))).toBe(false);
  });

  it('script-src 토큰 집합 = 기준 + 해시 1개', () => {
    const expected = new Set([...BASELINE['script-src'], sha256Token(HTML_ZOOM_FRAME_SCRIPT)]);
    expect(directives.get('script-src')).toEqual(expected);
  });

  it('style-src 토큰 집합 = 기준 + asset 출처 3개 (그 밖의 토큰 없음)', () => {
    const expected = new Set([...BASELINE['style-src'], ...STYLE_ASSET_TOKENS]);
    expect(directives.get('style-src')).toEqual(expected);
  });

  it('나머지 지시어의 이름 집합과 토큰 집합은 기준과 같다', () => {
    expect(new Set(directives.keys())).toEqual(new Set(Object.keys(BASELINE)));
    for (const name of ['default-src', 'img-src', 'connect-src', 'frame-src']) {
      expect(directives.get(name), name).toEqual(new Set(BASELINE[name]));
    }
  });

  it('해시 일치 검사는 스크립트가 한 글자만 바뀌어도 불일치로 드러난다', () => {
    const mutated = `${HTML_ZOOM_FRAME_SCRIPT} `;
    expect(sha256Token(mutated)).not.toBe(sha256Token(HTML_ZOOM_FRAME_SCRIPT));
  });
});
