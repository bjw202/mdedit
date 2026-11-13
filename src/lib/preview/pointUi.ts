// @MX:SPEC: SPEC-AI-017 REQ-AI17-015
// @MX:NOTE: 가리키기 UI(입력창·강조) 정리 레지스트리. PreviewRenderer 가 마운트 동안 정리 콜백을 등록하고,
// runAiArtifactCleanup(AI 끄기·파일 전환 공용)이 runPointUiCleanup 을 불러 입력창을 닫고 강조를 지운다.
// aiOffEffects 가 React 컴포넌트를 직접 import 하지 않도록 모듈 레지스트리로 잇는다(순환 방지).
import { clearAllPointMarks } from './pointHighlight';

const cleanups = new Set<() => void>();

/** 정리 콜백을 등록한다. 반환 함수로 해제. */
export function registerPointUiCleanup(fn: () => void): () => void {
  cleanups.add(fn);
  return () => {
    cleanups.delete(fn);
  };
}

/** 입력창을 닫고 모든 강조를 지운다. 문서·카드 레지스트리는 건드리지 않는다. */
export function runPointUiCleanup(): void {
  cleanups.forEach((fn) => fn());
  clearAllPointMarks();
}
