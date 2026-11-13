// @MX:SPEC: SPEC-AI-016 REQ-AI16-012
// AC-AI16-012 — 출처 검증 순수 함수. 픽스처는 실측 캡처(src-tauri/tests/fixtures/*.jsonl)에서
// 뽑은 최종 텍스트와 "열어 본 주소" 목록이다(acceptance.md 표와 같은 값).

import { describe, it, expect } from 'vitest';
import {
  extractUrls,
  normalizeUrl,
  findUnverifiedSources,
} from '@/lib/ai/researchSources';
import claudeCanonical from './fixtures/research/claude-research-canonical.json';
import claudeHaiku from './fixtures/research/claude-research-haiku.json';
import codexCanonical from './fixtures/research/codex-research-canonical.json';
import codexLive from './fixtures/research/codex-research-live.json';
import claudeWebfetchError from './fixtures/research/claude-webfetch-error.json';

const T = 'https://v2.tauri.app';

describe('픽스처 값이 acceptance.md 표와 같다', () => {
  it('열어 본 주소(발생 순서)', () => {
    expect(claudeCanonical.opened).toEqual([`${T}/blog/tauri-20/`, `${T}/security/capabilities/`]);
    expect(claudeHaiku.opened).toEqual([`${T}/security/capabilities/`, `${T}/blog/tauri-20/`]);
    expect(codexCanonical.opened).toEqual([`${T}/blog/tauri-20/`]);
    expect(codexLive.opened).toEqual([`${T}/blog/tauri-20/`]);
    expect(claudeWebfetchError.opened).toEqual([]);
  });
});

describe('normalizeUrl', () => {
  it('스킴·호스트 소문자, # 뒤 제거, 끝 / 제거', () => {
    expect(normalizeUrl('https://Example.com/a/')).toBe(normalizeUrl('https://example.com/a#x'));
  });
  it('경로 대소문자는 유지한다', () => {
    expect(normalizeUrl('https://example.com/A')).not.toBe(normalizeUrl('https://example.com/a'));
  });
  it('스킴 대문자도 소문자로', () => {
    expect(normalizeUrl('HTTPS://EXAMPLE.com/Path')).toBe('https://example.com/Path');
  });
});

describe('extractUrls', () => {
  it('마크다운 링크의 괄호 1단계 중첩을 허용한다', () => {
    expect(
      extractUrls('[t](https://en.wikipedia.org/wiki/Rust_(programming_language))'),
    ).toEqual(['https://en.wikipedia.org/wiki/Rust_(programming_language)']);
  });
  it('맨 주소 끝의 마침표를 뺀다', () => {
    expect(extractUrls('보라 https://a.b/c.')).toEqual(['https://a.b/c']);
  });
  it('꺾쇠로 감싼 주소', () => {
    expect(extractUrls('<https://a.b/c>')).toEqual(['https://a.b/c']);
  });
  it('같은 주소는 한 번만', () => {
    expect(extractUrls('https://a.b/c 그리고 [x](https://a.b/c)')).toEqual(['https://a.b/c']);
  });
  it('짝 없는 닫는 괄호·따옴표·백틱 앞에서 끊고 호스트 없는 http:// 는 버린다', () => {
    expect(extractUrls('(https://a.b/c) "https://d.e/f" `http://`')).toEqual([
      'https://a.b/c',
      'https://d.e/f',
    ]);
  });
  it('쉼표·세미콜론도 끝에서 뺀다', () => {
    expect(extractUrls('https://a.b/c, https://d.e/f;')).toEqual(['https://a.b/c', 'https://d.e/f']);
  });
  it('실측 텍스트(claude-webfetch-error)에서는 마커 주소 하나뿐이다', () => {
    expect(extractUrls(claudeWebfetchError.text)).toEqual(['http://127.0.0.1:47613/marker.txt']);
  });
});

describe('findUnverifiedSources', () => {
  it('codex-research-live → capabilities 주소 하나', () => {
    expect(findUnverifiedSources(codexLive.text, codexLive.opened)).toEqual([
      `${T}/security/capabilities/`,
    ]);
  });
  it.each([
    ['claude-research-canonical', claudeCanonical],
    ['codex-research-canonical', codexCanonical],
    ['claude-research-haiku', claudeHaiku],
  ])('%s → 빈 목록', (_n, fx) => {
    expect(findUnverifiedSources(fx.text, fx.opened)).toEqual([]);
  });
  it('정규화 후 비교한다', () => {
    expect(findUnverifiedSources('https://Example.com/a/', ['https://example.com/a#x'])).toEqual([]);
  });
});
