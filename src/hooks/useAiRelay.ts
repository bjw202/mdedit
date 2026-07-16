// @MX:ANCHOR: [AUTO] useAiRelay - ai:// Tauri 이벤트를 aiStore 로 릴레이하는 단일 배선 훅
// @MX:REASON: [AUTO] 모든 AI 스트리밍 상태 갱신이 이 훅을 통과한다 — AppLayout 마운트 + 향후
//   AI 패널 등에서 재사용될 유일한 이벤트 경계(fan_in >= 2 예상, 릴레이 계약 단일 소스)
// @MX:SPEC: SPEC-AI-001 REQ-AI-004 REQ-AI-005 REQ-AI-007

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAiStore } from '@/store/aiStore';
import type { AiErrorKind } from '@/store/aiStore';

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
        listen<AiChunkEvent>('ai://chunk', (event) => {
          const { requestId, text } = event.payload;
          if (!isCurrent(requestId)) return;
          useAiStore.getState().appendChunk(text);
        }),
        listen<AiDoneEvent>('ai://done', (event) => {
          const { requestId, result, truncated } = event.payload;
          if (!isCurrent(requestId)) return;
          useAiStore.getState().completeRequest(result, truncated ?? false);
        }),
        listen<AiErrorEvent>('ai://error', (event) => {
          const { requestId, kind, message } = event.payload;
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
