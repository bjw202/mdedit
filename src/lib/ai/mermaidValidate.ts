import mermaid from 'mermaid';

// @MX:SPEC: SPEC-AI-001 REQ-AI-023 REQ-AI-024
// @MX:WARN: [AUTO] securityLevel 을 'strict' 보다 약한 값으로 절대 덮어쓰지 않는다.
// @MX:REASON: [AUTO] mermaid 라벨 HTML 이스케이프/스크립트 차단이 풀리면 XSS 경로가 열린다.
//   PreviewRenderer.tsx 의 MERMAID_BASE_CONFIG 와 동일 계약을 재선언한다(그쪽을 지금 리팩터하지 않는다).
export const MERMAID_STRICT_CONFIG = { startOnLoad: false, securityLevel: 'strict' as const };

export interface MermaidValidationResult {
  valid: boolean;
  /** valid=false 일 때 파서 오류 메시지(자동 재요청에 동봉, 설계 §4.2 C). */
  error?: string;
}

/**
 * 삽입 전 로컬 mermaid 파서로 다이어그램 코드를 사전 검증한다(설계 §4.2 시나리오 C).
 * render 없이 parse 만 수행하므로 DOM 없이 문법 검증이 가능하다(PreviewRenderer.tsx:114 선례).
 * 항상 strict 로 initialize 한 뒤 parse 한다.
 */
export async function validateMermaid(code: string): Promise<MermaidValidationResult> {
  mermaid.initialize(MERMAID_STRICT_CONFIG);
  try {
    await mermaid.parse(code);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e) };
  }
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
