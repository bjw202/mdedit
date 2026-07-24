// @MX:SPEC: SPEC-AI-005 REQ-AI5-011 REQ-AI5-012
// @MX:SPEC: SPEC-AI-009 REQ-AI9-033 REQ-AI9-034
// @MX:NOTE: [AUTO] AI 산출물 정리 부수효과 — in-flight 취소 + 활성 고스트/streaming·검토 중 제안
// 카드 정리. 전부 삽입 전(pre-insertion) 산출물만 폐기하므로 문서 본문은 절대 변경하지 않는다
// (SPEC-AI-001 REQ-AI-033 무손상 원칙과 무충돌, D3/D5). 순환 방지를 위해 uiStore/fileStore 가
// 아닌 독립 모듈에 배치하고, store.subscribe 로 전이를 관찰한다(재진입 없음 — 아래 콜백은 해당
// store 를 다시 쓰지 않는다).

import { useUIStore } from '@/store/uiStore';
import { useAiStore } from '@/store/aiStore';
import { aiCancel } from '@/lib/tauri/ipc';
import { aiGhostField, clearGhostEffect } from '@/components/editor/extensions/ai-ghost-text';
import {
  getActiveEditorView,
  getCardControllers,
  clearCardRegistry,
} from '@/components/editor/extensions/ai-suggestion-card';

// @MX:ANCHOR: [AUTO] runAiArtifactCleanup - AI OFF 전이 + 파일 전환 두 트리거의 공용 정리 본문
// @MX:REASON: [AUTO] M8.3.1(SPEC-AI-009): 본문을 복제하면 두 경로가 서서히 갈라진다(v0.0.4
//   결함 3a 재발 방지). runAiOffCleanup(OFF 전이)과 initAiFileSwitchEffects(파일 전환)가 이
//   함수 하나만 호출하도록 고정한다 — 본문을 두 곳에 복제하지 않는다.
/**
 * in-flight 취소 + 고스트 정리 + 카드 레지스트리 비움을 1회 수행한다(REQ-AI5-011/REQ-AI9-033).
 * 문서 텍스트는 건드리지 않는다(REQ-AI5-012/REQ-AI9-035) — 고스트 clearGhostEffect 는 뷰 레이어
 * 전용 StateEffect 이고, 카드 레지스트리 정리는 아직 문서에 삽입되지 않은 제안만 폐기한다.
 */
export function runAiArtifactCleanup(): void {
  const ai = useAiStore.getState();
  if (ai.requestState === 'streaming' && ai.requestId) {
    void aiCancel(ai.requestId);
    ai.cancelRequest();
  }

  const view = getActiveEditorView();
  if (view && view.state.field(aiGhostField, false)) {
    view.dispatch({ effects: clearGhostEffect.of(null) });
  }

  if (getCardControllers().length > 0) {
    clearCardRegistry();
  }
}

/**
 * OFF 전이 정리를 1회 수행한다(REQ-AI5-011). runAiArtifactCleanup 의 얇은 래퍼 — export
 * 시그니처·동작은 무변경(SPEC-AI-009 M8.3.1, 기존 REQ-AI5-011 테스트 회귀 방지).
 */
export function runAiOffCleanup(): void {
  runAiArtifactCleanup();
}

/**
 * uiStore.aiEnabled 의 true→false 전이를 관찰해 runAiOffCleanup 을 1회 호출한다. AppLayout 이
 * 마운트 시 1회 등록한다(D3/D5). 반환된 함수로 구독을 해제한다(테스트·언마운트 시 재사용).
 */
export function initAiToggleEffects(): () => void {
  let previousAiEnabled = useUIStore.getState().aiEnabled;
  return useUIStore.subscribe((state) => {
    if (previousAiEnabled && !state.aiEnabled) {
      runAiOffCleanup();
    }
    previousAiEnabled = state.aiEnabled;
  });
}
