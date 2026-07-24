// @MX:SPEC: SPEC-AI-009 REQ-AI9-033 REQ-AI9-034 REQ-AI9-035
// @MX:NOTE: [AUTO] 활성 문서 전환(결함 3a) 정리 — fileStore.currentFile 전이를 관찰해
// runAiArtifactCleanup()(aiOffEffects.ts, OFF 전이와 공유)을 1회 호출한다. aiOffEffects.ts 의
// initAiToggleEffects 구조를 그대로 차용한다 — 순환 방지를 위해 fileStore/uiStore 가 아닌 독립
// 모듈에 배치하고, 콜백 내부에서 useFileStore 를 다시 쓰지 않는다(재진입 없음).

import { useFileStore } from '@/store/fileStore';
import { runAiArtifactCleanup } from '@/lib/ai/aiOffEffects';

/**
 * fileStore.currentFile 의 전이(이전 값과 다른 값 — null 전이 포함, EC-9)를 관찰해
 * runAiArtifactCleanup 을 1회 호출한다(REQ-AI9-033/034). AppLayout 이 마운트 시 1회 등록한다.
 * 반환된 함수로 구독을 해제한다(테스트·언마운트 시 재사용).
 */
export function initAiFileSwitchEffects(): () => void {
  let previousCurrentFile = useFileStore.getState().currentFile;
  return useFileStore.subscribe((state) => {
    if (state.currentFile !== previousCurrentFile) {
      runAiArtifactCleanup();
    }
    previousCurrentFile = state.currentFile;
  });
}
