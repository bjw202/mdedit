// svgSanitize 단위 테스트 — SPEC-PREVIEW-008 REQ-PREVIEW008-005 (시나리오 F, must-pass 보안)
import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from '@/lib/preview/svgSanitize';

describe('sanitizeSvg', () => {
  it('정상 SVG 도형은 그대로 유지된다', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>';
    const result = sanitizeSvg(input);
    expect(result).toContain('<svg');
    expect(result).toContain('<circle');
  });

  it('<script> 태그를 제거한다 (evil.svg 픽스처)', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>window.__xssFlag = true;</script><rect width="10" height="10" /></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('__xssFlag');
    expect(result).toContain('<rect');
  });

  it('onload 이벤트 핸들러 속성을 제거한다', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__xssFlag = true"><circle r="4" /></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('onload');
    expect(result).not.toContain('__xssFlag');
  });

  it('onclick 등 다른 on* 이벤트 핸들러도 제거한다', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" width="1" height="1" /></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('onclick');
  });

  it('<foreignObject>를 제거한다', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>injected</div></foreignObject><circle r="1"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('foreignObject');
  });

  it('href의 javascript: 프로토콜을 제거한다', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><circle r="1"/></a></svg>';
    const result = sanitizeSvg(input);
    expect(result.toLowerCase()).not.toContain('javascript:');
  });

  it('빈 문자열 입력은 빈 문자열을 반환한다', () => {
    expect(sanitizeSvg('')).toBe('');
  });

  it('SVG가 아닌 임의 텍스트를 입력해도 예외를 던지지 않는다 (안전 폴백)', () => {
    expect(() => sanitizeSvg('not an svg at all')).not.toThrow();
  });

  it('파싱 불가능한 손상된 마크업도 예외를 던지지 않고 안전한 값을 반환한다', () => {
    const result = sanitizeSvg('<svg><circle r="1"');
    expect(typeof result).toBe('string');
  });

  // ---- 평가 결함 3(minor): data:/외부 URL 리소스 로드 차단 (spec.md 잔여 위험 대응) ----

  it('<image href="data:...">의 data: URI href를 제거한다 (data: 스킴 차단)', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;base64,PHNjcmlwdD53aW5kb3cuX194c3NGbGFnPXRydWU8L3NjcmlwdD4=" /></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('data:');
    expect(result).toContain('<image');
  });

  it('xlink:href의 data: URI도 제거한다', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><image xlink:href="data:image/png;base64,AAAA" /></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('data:');
  });

  it('href의 절대 외부 URL(https://)을 제거한다 (외부 리소스 로드 차단)', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example.com/track.svg" /></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('evil.example.com');
  });

  it('href의 protocol-relative URL(//)을 제거한다', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="//evil.example.com/track.svg" /></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('evil.example.com');
  });

  it('같은 문서 내부 프래그먼트 참조(#id)는 href에서 유지된다 (그라디언트/필터 재사용, 회귀 차단)', () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g1"></linearGradient></defs>' +
      '<rect fill="url(#g1)" /><image href="#g1" /></svg>';
    const result = sanitizeSvg(input);
    expect(result).toContain('href="#g1"');
  });
});
