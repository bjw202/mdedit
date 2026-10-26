import { validateDiagram } from '@/lib/diagram/diagramRenderer';

// @MX:SPEC: SPEC-AI-001 REQ-AI-023 REQ-AI-024 SPEC-PREVIEW-015 REQ-PREVIEW015-012
// @MX:WARN: [AUTO] strict 모드 = pele 기본 보안 + 다이어그램 전용 정화(별도 DOMPurify 인스턴스, 재등록한 href 차단 훅,
//   수식용으로 foreignObject.pele-math·그 안의 감싸기 div·MathML 태그·semantics·annotation[encoding]만 추가 허용) + links/images false.
//   옵션·정화를 약화하지 않는다
// @MX:REASON: [AUTO] 검증은 미리보기와 같은 렌더 함수(validateDiagram → renderDiagram)를 같은 고정 옵션으로 호출해야
//   "검증 통과, 미리보기 실패" 불일치가 생기지 않는다(design.md D3). 여기서 별도 엔진 설정·parse 전용 경로를 만들지 않는다.

export interface MermaidValidationResult {
  valid: boolean;
  /** valid=false 일 때 파서 오류 메시지(자동 재요청에 동봉, 설계 §4.2 C). */
  error?: string;
}

/**
 * 삽입 전 다이어그램 모듈로 코드를 사전 검증한다(설계 §4.2 시나리오 C).
 * 미리보기와 같은 렌더 함수·같은 고정 옵션을 쓰며, 실패 시 error에는 pele 오류 메시지를 그대로 담는다(design.md D9).
 * 렌더는 동기지만 기존 호출 계약을 지키려고 Promise로 돌려준다.
 */
export async function validateMermaid(code: string): Promise<MermaidValidationResult> {
  const r = validateDiagram(code);
  return r.valid ? { valid: true } : { valid: false, error: r.error };
}

/** mermaid 검증 실패 시 다음 행동(설계 §4.2 C, REQ-AI-024). */
export type FallbackDecision = { action: 'auto-retry' } | { action: 'offer-list-fallback' };

/**
 * 실패 누적 횟수로 폴백 결정을 만든다.
 * 1회차 실패 → 오류를 동봉해 자동 1회 재요청. 2회차 이상 → "목록으로 정리" 폴백 제안.
 */
export function buildFallbackDecision(attemptCount: number): FallbackDecision {
  return attemptCount <= 1 ? { action: 'auto-retry' } : { action: 'offer-list-fallback' };
}
