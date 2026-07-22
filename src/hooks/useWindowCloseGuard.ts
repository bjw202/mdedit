// @MX:WARN: [AUTO] 윈도우 종료 경로 — 오구현 시 창이 닫히지 않거나 무경고 데이터 손실 발생.
// @MX:REASON: [AUTO] preventDefault 누락 = 미저장 변경 무경고 종료; destroy 누락 = 창이 영원히 안 닫힘.
//   requestClose 를 ref 로 보관하지 않으면 open 토글마다 리스너가 재등록되어 close 이벤트 처리
//   중 경쟁이 생기고 destroy 호출이 누락된다(창이 닫히지 않는 현상).
// @MX:SPEC: SPEC-FS-003

import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEditorStore } from '@/store/editorStore';

/**
 * 윈도우 종료 가드 (REQ-018/019/020).
 *
 * V1 해소(node_modules/@tauri-apps/api/window.js:1622 근거): 프런트엔드 onCloseRequested +
 * event.preventDefault() 단독으로 충분. Rust on_window_event + api.prevent_close() 불필요.
 * onCloseRequested 핸들러에서 preventDefault()를 호출하면 destroy()가 호출되지 않아 창이 유지된다.
 *
 * 동작:
 * - dirty=false: preventDefault 생략 → onCloseRequested 래퍼가 destroy() 호출 (REQ-019).
 * - dirty=true: preventDefault → 가드 모달(requestClose). 저장/폐기 시 destroy, 취소 시 유지(REQ-020).
 *
 * Tauri 런트임이 없으면(Vite dev/jsdom) 리스너를 등록하지 않는다.
 */
export function useWindowCloseGuard(
  requestClose: (closeAction: () => void | Promise<void>) => void,
): void {
  // requestClose 는 useUnsavedChangesGuard 의 open state 에 의존해 토글마다 재생성된다.
  // useEffect 의존성에 직접 두면 리스너가 해제→재등록되며, close 이벤트 처리 중 경쟁으로
  // destroy 호출이 누락되어 창이 닫히지 않는다. ref 로 보관해 리스너를 한 번만 등록한다.
  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  }, [requestClose]);

  useEffect(() => {
    // Tauri 런타임 확인 — 없으면 no-op (Vite dev / jsdom / E2E 브라우저)
    const internals = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    if (!internals) return;

    let unlisten: (() => void) | undefined;
    let active = true;

    try {
      getCurrentWindow()
        .onCloseRequested(async (event) => {
          const { dirty } = useEditorStore.getState();
          if (!dirty) return; // preventDefault 안 함 → onCloseRequested 래퍼가 destroy 호출 (REQ-019)
          event.preventDefault(); // 종료 보류 (REQ-018/020)
          requestCloseRef.current(async () => {
            // 사용자가 저장/폐기 선택 → 실제 종료
            await getCurrentWindow().destroy();
          });
        })
        .then((u) => {
          if (active) {
            unlisten = u;
          } else {
            u();
          }
        })
        .catch(() => {
          // 리스너 등록 실패(비-Tauri) — 조용히 무시
        });
    } catch {
      // getCurrentWindow() 자체가 실패(불완전한 Tauri internals) — no-op
    }

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);
}
