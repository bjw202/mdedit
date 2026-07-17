// @MX:SPEC: SPEC-AI-005 REQ-AI5-011 REQ-AI5-012
// @MX:NOTE: [AUTO] setAiEnabled(false) 전이(ON→OFF) 부수효과 — in-flight 취소 + 활성 고스트/
// streaming·검토 중 제안 카드 정리. 전부 삽입 전(pre-insertion) 산출물만 폐기하므로 문서 본문은
// 절대 변경하지 않는다(SPEC-AI-001 REQ-AI-033 무손상 원칙과 무충돌, D3/D5). 순환 방지를 위해
// uiStore 가 아닌 독립 모듈에 배치하고, uiStore.subscribe 로 전이를 관찰한다(재진입 없음 — 아래
// 콜백은 useUIStore 를 다시 쓰지 않는다).
// @MX:SPEC: SPEC-AI-005

import { useUIStore } from '@/store/uiStore';
import { useAiStore } from '@/store/aiStore';
import { aiCancel } from '@/lib/tauri/ipc';
import { aiGhostField, clearGhostEffect } from '@/components/editor/extensions/ai-ghost-text';
import {
  getActiveEditorView,
  getCardControllers,
  clearCardRegistry,
} from '@/components/editor/extensions/ai-suggestion-card';

/**
 * OFF 전이 정리를 1회 수행한다(REQ-AI5-011). 문서 텍스트는 건드리지 않는다(REQ-AI5-012) —
 * 고스트 clearGhostEffect 는 뷰 레이어 전용 StateEffect 이고, 카드 레지스트리 정리는 아직 문서에
 * 삽입되지 않은 제안만 폐기한다.
 */
export function runAiOffCleanup(): void {
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
