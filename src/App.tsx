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
import { readFile } from '@/lib/tauri/ipc';

function App(): JSX.Element {
  const currentFilePath = useEditorStore((s) => s.currentFilePath);
  const setContent = useEditorStore((s) => s.setContent);
  const setDirty = useEditorStore((s) => s.setDirty);
  const { openFolderPath } = useFileSystem();

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
      if (!dirty) {
        // REQ-021: dirty=false → 자동 재로드
        void readFile(event.path).then((content) => setContent(content));
        return;
      }
      // REQ-022/023: dirty=true → 충돌 모달. 'reload'는 디스크 내용으로 덮어쓰기 + dirty false.
      guard.requestWatcherConflict(() => {
        void readFile(event.path).then((content) => {
          setContent(content);
          setDirty(false);
        });
      });
    },
  });

  return <AppLayout guard={guard} />;
}

export default App;
