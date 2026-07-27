// @MX:ANCHOR: [AUTO] useAiRelay - ai:// Tauri 이벤트를 aiStore 로 릴레이하는 단일 배선 훅
// @MX:REASON: [AUTO] 모든 AI 스트리밍 상태 갱신이 이 훅을 통과한다 — AppLayout 마운트 + 향후
//   AI 패널 등에서 재사용될 유일한 이벤트 경계(fan_in >= 2 예상, 릴레이 계약 단일 소스)
// @MX:SPEC: SPEC-AI-001 REQ-AI-004 REQ-AI-005 REQ-AI-007

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAiStore } from '@/store/aiStore';
import type { AiErrorKind } from '@/store/aiStore';
import { dispatchAiChunk, dispatchAiDone, dispatchAiError } from '@/lib/ai/aiEventRouter';

/** `ai://chunk` payload — 스트림 델타 조각(REQ-AI-004). */
export interface AiChunkEvent {
  requestId: string;
  text: string;
}

/** `ai://done` payload — 최종 result(권위 값) + 절단 여부(REQ-AI-004). */
export interface AiDoneEvent {
  requestId: string;
  result: string;
  truncated?: boolean;
}

/** `ai://error` payload — 분류된 원인 + 취소 주체(REQ-AI-040, §9 분류표). */
export interface AiErrorEvent {
  requestId: string;
  kind: AiErrorKind;
  message: string;
  cancelledBy?: 'new-request' | 'user';
}

/**
 * 이벤트가 현재 in-flight 요청 것인지 판정한다(stale-event 가드).
 * 취소된 이전 요청의 지각 델타가 새 요청 버퍼를 오염시키는 것을 막는다(설계 §3 "취소 대상은 in-flight만").
 */
function isCurrent(requestId: string): boolean {
  return useAiStore.getState().requestId === requestId;
}

/**
 * ai:// 이벤트(chunk/done/error)를 구독해 aiStore 로 릴레이한다.
 * 마운트 시 listen 등록, 언마운트 시 unlisten 정리(useFileWatcher 패턴).
 * store 접근은 getState() 비반응형 — 훅 자체는 렌더를 유발하지 않는다(research §2.7).
 */
export function useAiRelay(): void {
  useEffect(() => {
    let unlisteners: Array<() => void> = [];
    let cancelled = false;

    const register = async (): Promise<void> => {
      const [offChunk, offDone, offError] = await Promise.all([
        // SPEC-AI-010 REQ-AI10-012: 세 리스너 전부 **isCurrent 여부와 무관하게** 먼저
        // 라우터로 발송한 뒤, 기존 스토어 릴레이 경로를 그대로 통과시킨다. 스토어의 단일
        // 슬롯 게이트(isCurrent)는 한 글자도 바뀌지 않으므로 고스트·툴바·설정이 의존하는
        // 계약은 보존되고, 슬롯 밖으로 밀려난 카드만 라우터를 통해 자기 이벤트를 계속 받는다.
        listen<AiChunkEvent>('ai://chunk', (event) => {
          const { requestId, text } = event.payload;
          dispatchAiChunk(requestId, text);
          if (!isCurrent(requestId)) return;
          useAiStore.getState().appendChunk(text);
        }),
        listen<AiDoneEvent>('ai://done', (event) => {
          const { requestId, result, truncated } = event.payload;
          dispatchAiDone(requestId, result, truncated ?? false);
          if (!isCurrent(requestId)) return;
          useAiStore.getState().completeRequest(result, truncated ?? false);
        }),
        listen<AiErrorEvent>('ai://error', (event) => {
          const { requestId, kind, message } = event.payload;
          dispatchAiError(requestId, kind, message);
          if (!isCurrent(requestId)) return;
          useAiStore.getState().failRequest({ kind, message });
        }),
      ]);

      // 등록 완료 전에 언마운트되면 즉시 해제해 리스너 누수를 막는다.
      if (cancelled) {
        offChunk();
        offDone();
        offError();
        return;
      }
      unlisteners = [offChunk, offDone, offError];
    };

    void register();

    return () => {
      cancelled = true;
      unlisteners.forEach((off) => off());
    };
  }, []);
}
