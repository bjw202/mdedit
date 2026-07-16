// @MX:ANCHOR: [AUTO] 인라인 SVG(마크다운) + SvgFileViewer 렌더 뷰가 공용하는 단일 sanitize 유틸
// @MX:REASON: [AUTO] fan_in >= 2 (PreviewRenderer.tsx의 인라인 svg 복원 단계, SvgFileViewer.tsx의
//   렌더 뷰). 두 지점이 서로 다른 sanitize 설정을 쓰면 정책이 갈라져 한쪽만 XSS에 노출될 수 있다.
//   설정 변경(USE_PROFILES/FORBID_TAGS/FORBID_ATTR)은 반드시 이 파일 하나만 수정해서 양쪽에
//   동시에 반영되도록 유지할 것 (SPEC-PREVIEW-008 Security 섹션 "적용 지점 단일화").
// @MX:SPEC: SPEC-PREVIEW-008 REQ-PREVIEW008-005 REQ-PREVIEW008-006

import DOMPurify, { type Config } from 'dompurify';

// @MX:WARN: [AUTO] DOMPurify 설정 완화(USE_PROFILES 확장, FORBID_TAGS/ATTR 축소) 시 XSS 노출 위험
// @MX:REASON: [AUTO] evil.svg 픽스처(<script>, onload)의 스크립트 미실행이 이 설정에 의존한다.
//   설정을 바꿀 경우 svgSanitize.test.ts의 가드 테스트를 반드시 재검증할 것 (spec.md 잔여 위험).
const SVG_SANITIZE_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ['script', 'foreignObject'],
  FORBID_ATTR: [
    'onload',
    'onerror',
    'onclick',
    'onmouseover',
    'onmouseout',
    'onmousedown',
    'onmouseup',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit',
    'onanimationstart',
    'onanimationend',
    'onanimationiteration',
    'onbegin',
    'onend',
    'onrepeat',
  ],
};

// @MX:WARN: [AUTO] 평가 결함 3 수정 — href/xlink:href의 data: 스킴 및 외부(cross-origin) URL을
// 명시적으로 차단한다(spec.md "잔여 위험: data·외부 URL 리소스 로드 차단" 대응).
// @MX:REASON: [AUTO] DOMPurify SVG 프로파일 기본 설정은 <image href="data:...">나
// <image href="https://evil.example.com/...">를 그대로 통과시킨다. data: URI는 인코딩된
// 스크립트/HTML을 재귀적으로 실어 나를 수 있고, 외부 URL은 원격 리소스 로드(정보 유출/추적)
// 벡터가 된다. 같은 문서 내부 프래그먼트 참조(href="#id", 그라디언트/필터 재사용)는 반드시
// 허용을 유지해야 하므로 fragment는 이 훅에서 예외 처리한다. 이 훅은 모듈 전역 DOMPurify
// 인스턴스에 1회만 등록된다 — 이 앱에서 DOMPurify를 사용하는 지점은 svgSanitize 하나뿐이다.
const DANGEROUS_HREF_RE = /^(?:data:|[a-z][a-z0-9+.-]*:|\/\/)/i;

DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName !== 'href' && data.attrName !== 'xlink:href') return;

  const value = data.attrValue.trim();
  if (value.startsWith('#')) return; // 같은 문서 프래그먼트 참조는 허용 (그라디언트/필터/use 재사용)

  if (DANGEROUS_HREF_RE.test(value)) {
    data.keepAttr = false;
  }
});

/**
 * SVG 마크업(파일 또는 마크다운 인라인)을 DOMPurify SVG 프로파일로 sanitize한다.
 *
 * - `<script>`, 이벤트 핸들러(`on*`), `<foreignObject>`, `javascript:` 등 위험 요소를 제거한다.
 * - 파싱 실패 등 예외 상황에서도 앱을 중단시키지 않고 빈 문자열(안전 폴백)을 반환한다.
 * - 인라인 SVG(PreviewRenderer)와 SvgFileViewer 렌더 뷰가 동일 설정을 공유한다(정책 단일화).
 *
 * @param rawSvg - 원본(비신뢰) SVG 마크업 문자열
 * @returns sanitize된 안전한 SVG 마크업 문자열. 실패 시 빈 문자열.
 */
export function sanitizeSvg(rawSvg: string): string {
  if (!rawSvg) return '';

  try {
    return DOMPurify.sanitize(rawSvg, SVG_SANITIZE_CONFIG);
  } catch {
    // 파싱 오류 등 예상치 못한 실패 시 앱 중단 대신 안전한 빈 렌더로 폴백 (REQ-PREVIEW008-005)
    return '';
  }
}
