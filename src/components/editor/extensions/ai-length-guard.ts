// @MX:SPEC: SPEC-AI-001 REQ-AI-026 REQ-AI-027
// @MX:NOTE: 선택 길이 가드 상한(설계 §4.4). 편집 프리셋 2,000자 / 변환 프리셋 4,000자.
// 이 값은 "교체 대상 상한"이며 선택 텍스트를 절단하지 않기 위한 방어선이다 — 절단된 결과로
// 선택 전체를 교체하면 무손실 삭제가 발생한다(REQ-AI-027). 초과 시 프리셋을 비활성화할 뿐,
// 절대 잘라서 진행하지 않는다.

/** ✨ 프리셋 5종 + 직접 입력. 편집 계열(polish/custom)과 변환 계열(outline/table/diagram/shorten)로 나뉜다. */
export type AiPresetKind = 'polish' | 'custom' | 'outline' | 'table' | 'diagram' | 'shorten';

export interface SelectionGuardResult {
  /** 요청 진행 허용 여부. false 면 프리셋 비활성 + reason 안내(P7, 침묵 금지). */
  allowed: boolean;
  /** true 면 결과를 "아래에 삽입"만 허용하고 "바꾸기"는 비활성(원문 파괴 차단). */
  insertOnly: boolean;
  /** allowed=false 일 때 사용자 안내 문구. */
  reason?: string;
}

const EDIT_LIMIT = 2000;
const TRANSFORM_LIMIT = 4000;
const EDIT_PRESETS: readonly AiPresetKind[] = ['polish', 'custom'];
const TOO_LONG_REASON = '선택이 너무 길어요. 문단 단위로 나눠 선택해주세요.';

/**
 * 선택 길이와 프리셋 종류로 가드 결과를 판정한다(설계 §4.4).
 *
 * - ≤ 2,000자: 모든 프리셋 정상 처리.
 * - 편집 프리셋(다듬기·직접 입력) > 2,000자: 비활성 + 안내.
 * - 변환 프리셋(개요/표/다이어그램/짧게) 2,001~4,000자: 허용하되 "아래에 삽입" 전용.
 * - 변환 프리셋 > 4,000자: 비활성 + 안내.
 */
export function evaluateSelectionGuard(
  selectionLength: number,
  presetKind: AiPresetKind,
): SelectionGuardResult {
  if (selectionLength <= EDIT_LIMIT) {
    return { allowed: true, insertOnly: false };
  }

  if (EDIT_PRESETS.includes(presetKind)) {
    return { allowed: false, insertOnly: false, reason: TOO_LONG_REASON };
  }

  if (selectionLength <= TRANSFORM_LIMIT) {
    return { allowed: true, insertOnly: true };
  }

  return { allowed: false, insertOnly: false, reason: TOO_LONG_REASON };
}
