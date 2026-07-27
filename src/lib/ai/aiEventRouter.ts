// @MX:ANCHOR: [AUTO] aiEventRouter - requestId 기준 ai:// 이벤트 팬아웃(카드 다중 공존 경로)
// @MX:REASON: [AUTO] `aiStore` 는 in-flight 요청을 단 1개(requestId 단일 슬롯)만 보유하는데
//   카드 레지스트리는 N개를 보유하고, 검토 대기 카드는 새 요청에도 의도적으로 생존한다.
//   그래서 `useAiRelay.isCurrent` 게이트만 있으면 카드 A의 재요청이 슬롯을 가져가는 순간
//   카드 B의 chunk·done·**심지어 백엔드 워치독의 timeout 오류까지** 스토어에 닿기도 전에
//   폐기되어 B가 영원히 멈춘다(실기기 재현). 이 라우터는 그 폐기 경로를 우회해 각 카드가
//   자기 requestId 의 이벤트를 끝까지 받게 하는 유일한 지점이다 — `aiStore` 는 한 줄도
//   바꾸지 않으며, 고스트/툴바/설정이 의존하는 단일 슬롯 의미론은 그대로 보존된다.
// @MX:SPEC: SPEC-AI-010 REQ-AI10-012

import type { AiErrorKind } from '@/store/aiStore';

/** 구독자가 받는 이벤트 핸들러. payload 는 기존 3종 계약 그대로이며 새 필드를 만들지 않는다. */
export interface AiEventHandlers {
  /** `ai://chunk` — **원시 델타**다(스토어처럼 누적된 버퍼가 아니다). 구독자가 직접 누적한다. */
  onChunk?: (text: string) => void;
  /** `ai://done` — `result` 는 권위 값이므로 누적 버퍼를 덮어써야 한다. */
  onDone?: (result: string, truncated: boolean) => void;
  /** `ai://error` — 분류된 kind/message. raw 노출 금지 계약은 상위에서 유지한다. */
  onError?: (kind: AiErrorKind, message: string) => void;
}

interface Subscription {
  /** 구독 대상 requestId 를 **호출 시점에** 읽는다 — 재요청마다 id 가 바뀌기 때문이다. */
  getRequestId: () => string;
  handlers: AiEventHandlers;
}

let subscriptions: Subscription[] = [];

/**
 * requestId 로 ai:// 이벤트를 구독한다. 반환된 해제 함수는 구독자(카드 컨트롤러)가 보유해
 * `destroy()` 에서 호출한다 — 모듈 전역 단일 슬롯을 두지 않으므로 새 구독이 기존 구독을
 * 끊지 않는다.
 */
export function subscribeAiEvents(
  getRequestId: () => string,
  handlers: AiEventHandlers,
): () => void {
  const sub: Subscription = { getRequestId, handlers };
  subscriptions.push(sub);
  return () => {
    subscriptions = subscriptions.filter((s) => s !== sub);
  };
}

function fanout(requestId: string, invoke: (h: AiEventHandlers) => void): void {
  // 발송 중 구독이 해제될 수 있으므로 스냅샷을 순회한다.
  for (const sub of [...subscriptions]) {
    if (sub.getRequestId() !== requestId) continue;
    invoke(sub.handlers);
  }
}

export function dispatchAiChunk(requestId: string, text: string): void {
  fanout(requestId, (h) => h.onChunk?.(text));
}

export function dispatchAiDone(requestId: string, result: string, truncated: boolean): void {
  fanout(requestId, (h) => h.onDone?.(result, truncated));
}

export function dispatchAiError(requestId: string, kind: AiErrorKind, message: string): void {
  fanout(requestId, (h) => h.onError?.(kind, message));
}

/** 등록된 구독을 전부 비운다(테스트 격리용). */
export function clearAiEventRouter(): void {
  subscriptions = [];
}
