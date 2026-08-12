// @MX:NOTE: [AUTO] App root - 파일 워처 + 윈도우 종료 가드 + 폴더 복원 통합.
//   가드 상태 머신은 루트에서 인스턴스화해 AppLayout(렌더/ConfirmDialog)과 워처 콜백이 공유한다.
// @MX:SPEC: SPEC-FS-002 SPEC-FS-003

import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { useFileWatcher } from '@/hooks/useFileWatcher';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useEditorStore } from '@/store/editorStore';
import { useUIStore } from '@/store/uiStore';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useWindowCloseGuard } from '@/hooks/useWindowCloseGuard';

function App(): JSX.Element {
  const currentFilePath = useEditorStore((s) => s.currentFilePath);
  const { openFolderPath, openFile } = useFileSystem();

  // SPEC-FS-003: 가드 상태 머신. 루트에서 인스턴스화 — AppLayout(ConfirmDialog 렌더)과
  // 워처 콜백(REQ-022 충돌 모달)이 단일 인스턴스를 공유한다.
  const guard = useUnsavedChangesGuard();
  useWindowCloseGuard(guard.requestClose);

  // Set platform attribute for platform-specific CSS targeting (Windows WebView2 vs macOS WKWebView)
  useEffect(() => {
    const isWindows = navigator.userAgent.includes('Windows');
    document.documentElement.setAttribute('data-platform', isWindows ? 'windows' : 'other');
  }, []);

  // Restore last watched folder on app start (REQ-UI-003-06, REQ-UI-003-07)
  useEffect(() => {
    const { lastWatchedPath, setLastWatchedPath } = useUIStore.getState();
    if (!lastWatchedPath) return;
    openFolderPath(lastWatchedPath).catch(() => {
      // Path no longer valid (deleted/moved) — clear persisted path
      setLastWatchedPath(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SPEC-FS-003 T9 (REQ-021/022/023): 워처 충돌 분기.
  //   dirty=false → 자동 재로드 유지. dirty=true → reload/cancel 별도 모달(안전 선택지 기본 포커스).
  //   모달 열린 동안 추가 워처 이벤트는 폐기(REQ-024, 재알림 없음 — 의도된 동작).
  useFileWatcher({
    onFileChanged: (event) => {
      if (event.kind !== 'Modified' || event.path !== currentFilePath) return;
      const { dirty } = useEditorStore.getState();
      // @MX:SPEC: SPEC-IMG-LOAD-001 REQ-IMG-LOAD-B-003
      // @MX:NOTE: [AUTO] 워쳐 reload 를 openFile 경로(크기 가드 포함)로 위임한다.
      //   종전 readFile 직접 호출은 크기 가드를 우회해 대용량 파일 로드 시 UI 동결을 유발했다.
      //   openFile 은 setCurrentFile/setContent/setCurrentFilePath/previewStatus 를
      //   일관되게 갱신하므로 setContent/setDirty 직접 호출을 대체한다(OD-5: openFile 재사용 채택).
      if (!dirty) {
        // REQ-021: dirty=false → 자동 재로드
        void openFile(event.path);
        return;
      }
      // REQ-022/023: dirty=true → 충돌 모달. 'reload'는 디스크 내용으로 덮어쓰기.
      guard.requestWatcherConflict(() => {
        void openFile(event.path);
      });
    },
  });

  return <AppLayout guard={guard} />;
}

export default App;
