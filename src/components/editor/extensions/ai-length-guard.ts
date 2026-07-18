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

export const EDIT_LIMIT = 2000;
export const TRANSFORM_LIMIT = 4000;
const EDIT_PRESETS: readonly AiPresetKind[] = ['polish', 'custom'];

/** 계열별 프리셋 이름 — 조사까지 포함한다(받침 유무가 달라 템플릿으로 못 붙인다). */
const EDIT_PRESET_NAMES = '다듬기·직접 입력은';
const TRANSFORM_PRESET_NAMES = '개요·표·다이어그램·짧게는';

/** 1000 단위 쉼표. 5170 → "5,170" — 한도와 나란히 놓았을 때 자릿수 비교가 쉬워진다. */
export function formatCharCount(n: number): string {
  return n.toLocaleString('ko-KR');
}

/**
 * 길이 초과 안내 문구를 만든다. 현재 글자 수와 해당 계열의 한도를 함께 보여주고,
 * 왜 잘라서라도 처리하지 않는지까지 설명한다 — 숫자가 없으면 사용자는 무엇에 걸렸는지,
 * 얼마나 줄여야 하는지 알 수 없다.
 */
function buildTooLongReason(selectionLength: number, limit: number, presetNames: string): string {
  return (
    `지금 ${formatCharCount(selectionLength)}자예요 — ${presetNames} ${formatCharCount(limit)}자까지만 돼요. ` +
    '더 길면 AI가 일부만 읽고 답하게 되는데, 그 결과로 선택한 곳 전체를 바꾸면 못 읽은 부분이 조용히 사라져요. ' +
    '그래서 잘라서 진행하지 않고 막아둡니다. 문단 단위로 나눠 선택해주세요.'
  );
}

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
    return {
      allowed: false,
      insertOnly: false,
      reason: buildTooLongReason(selectionLength, EDIT_LIMIT, EDIT_PRESET_NAMES),
    };
  }

  if (selectionLength <= TRANSFORM_LIMIT) {
    return { allowed: true, insertOnly: true };
  }

  return {
    allowed: false,
    insertOnly: false,
    reason: buildTooLongReason(selectionLength, TRANSFORM_LIMIT, TRANSFORM_PRESET_NAMES),
  };
}
