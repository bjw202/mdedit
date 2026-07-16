import { create } from 'zustand';

// @MX:SPEC: SPEC-AI-001 REQ-AI-007 REQ-AI-008
// @MX:NOTE: AI 요청 생명주기 상태. 스트림 버퍼·요청 상태는 전부 트랜지언트이므로
// uiStore 와 달리 persist 로 감싸지 않는다(설계 §3, research §2.7). 앱 재시작 시 잔류 금지.

/** 요청 진행 상태 (설계 §3 aiStore 상태 머신). */
export type AiRequestState = 'idle' | 'streaming' | 'done' | 'error';

/** stderr 분류 결과(설계 §9). raw JSON 이 아니라 분류된 종류만 UI 로 전달한다(REQ-AI-040). */
export type AiErrorKind = 'login' | 'network' | 'parse' | 'other';

/** 요청을 유발한 기능 종류. 프론트는 이 종류 + 텍스트 조각만 Rust 로 넘긴다(설계 §3). */
export type AiFeature = 'inline-edit' | 'section-fill' | 'ghost' | 'diagram' | 'chat';

export interface AiErrorInfo {
  kind: AiErrorKind;
  message: string;
}

/** 순수 전이 대상이 되는 트랜지언트 슬라이스(세션 카운터 제외). */
export interface AiTransientSlice {
  requestState: AiRequestState;
  streamBuffer: string;
  requestId: string | null;
  feature: AiFeature | null;
  errorInfo: AiErrorInfo | null;
  /** 백엔드가 컨텍스트 상한으로 원문을 절단했는지(ai://done truncated). 카드/배너 고지에 사용(설계 §7). */
  truncated: boolean;
}

export interface AiState extends AiTransientSlice {
  sessionRequestCount: number;
  startRequest: (requestId: string, feature: AiFeature) => void;
  appendChunk: (delta: string) => void;
  completeRequest: (finalText: string, truncated?: boolean) => void;
  failRequest: (errorInfo: AiErrorInfo) => void;
  cancelRequest: () => void;
  incrementCount: () => void;
}

/** 초기(idle) 트랜지언트 슬라이스. 취소 시에도 이 값으로 되돌린다. */
export const idleSlice: AiTransientSlice = {
  requestState: 'idle',
  streamBuffer: '',
  requestId: null,
  feature: null,
  errorInfo: null,
  truncated: false,
};

// 순수 전이 함수: 스토어 밖에서 단위 테스트 가능하도록 분리한다(insertTable 순수 헬퍼 관례).

/** 새 요청 시작 — streaming 진입, 버퍼·오류·절단 플래그 초기화, 요청 id·기능 설정. */
export function reduceStartRequest(requestId: string, feature: AiFeature): AiTransientSlice {
  return { requestState: 'streaming', streamBuffer: '', requestId, feature, errorInfo: null, truncated: false };
}

/** 델타 누적 — 스트림 조각을 도착 순서대로 이어 붙인다. */
export function reduceAppendChunk(prev: AiTransientSlice, delta: string): AiTransientSlice {
  return { ...prev, streamBuffer: prev.streamBuffer + delta };
}

/** 완료 — 스트림 버퍼를 최종 result 문자열(권위 값)로 확정하고 절단 여부를 기록한다(부록 A.1 result). */
export function reduceCompleteRequest(
  prev: AiTransientSlice,
  finalText: string,
  truncated = false,
): AiTransientSlice {
  return { ...prev, requestState: 'done', streamBuffer: finalText, truncated };
}

/** 실패 — 분류된 오류만 담는다. raw JSON 노출 금지(REQ-AI-040). */
export function reduceFailRequest(prev: AiTransientSlice, errorInfo: AiErrorInfo): AiTransientSlice {
  return { ...prev, requestState: 'error', errorInfo };
}

/** 취소 — idle 로 리셋하고 버퍼를 비운다(in-flight 취소, REQ-AI-005). */
export function reduceCancel(): AiTransientSlice {
  return { ...idleSlice };
}

export const useAiStore = create<AiState>()((set) => ({
  ...idleSlice,
  sessionRequestCount: 0,
  startRequest: (requestId, feature) => set(reduceStartRequest(requestId, feature)),
  appendChunk: (delta) => set((s) => reduceAppendChunk(s, delta)),
  completeRequest: (finalText, truncated) => set((s) => reduceCompleteRequest(s, finalText, truncated)),
  failRequest: (errorInfo) => set((s) => reduceFailRequest(s, errorInfo)),
  cancelRequest: () => set(reduceCancel()),
  incrementCount: () => set((s) => ({ sessionRequestCount: s.sessionRequestCount + 1 })),
}));
