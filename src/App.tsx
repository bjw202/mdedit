// @MX:NOTE: [AUTO] App root - 파일 워처 + 윈도우 종료 가드 + 폴더 복원 통합.
//   가드 상태 머신은 루트에서 인스턴스화해 AppLayout(렌더/ConfirmDialog)과 워처 콜백이 공유한다.
// @MX:SPEC: SPEC-FS-002 SPEC-FS-003 SPEC-FS-004

import { useCallback, useEffect, useRef } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { useFileWatcher } from '@/hooks/useFileWatcher';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useExternalOpenFile, isSameWorkspaceDir, createLatestWinsChain } from '@/hooks/useExternalOpenFile';
import type { PendingOpenFile } from '@/lib/tauri/ipc';
import { useEditorStore } from '@/store/editorStore';
import { useFileStore } from '@/store/fileStore';
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

  // ── SPEC-FS-004: 외부 .md 오픈 소비 배선 (가드 뒤·복원 이펙트 앞 배치 — 훅 순서 계약) ──

  // REQ-007/012: 외부 오픈 전환 — 같은 폴더면 openFolderPath 스킵, 다르면 폴더 오픈 후
  //   openFile. 폴더 실패는 여기서 흡수해 전체 중단(openFile 미시도 — 폴더가 없으면 파일도 없다).
  const runExternalTransition = useCallback(
    async (payload: PendingOpenFile): Promise<void> => {
      const { watchedPath } = useFileStore.getState();
      if (!isSameWorkspaceDir(watchedPath, payload.dir)) {
        try {
          await openFolderPath(payload.dir);
        } catch {
          return; // REQ-012: 폴더 실패 → openFile 시도 없이 전체 중단(openFolderPath가 이미 로그)
        }
      }
      await openFile(payload.path);
    },
    [openFolderPath, openFile],
  );

  // 전환 체인은 최신 실행 함수를 ref 로 참조(useFileSystem 함수 identity 가 렌더마다 바뀌어도 안전).
  const runExternalTransitionRef = useRef(runExternalTransition);
  useEffect(() => {
    runExternalTransitionRef.current = runExternalTransition;
  }, [runExternalTransition]);

  // AC-008 4th: single-flight latest-wins — 실행 중 전환은 대기 슬롯의 최신 페이로드로 대체.
  const externalChainRef = useRef<((payload: PendingOpenFile) => Promise<void>) | null>(null);
  if (externalChainRef.current === null) {
    externalChainRef.current = createLatestWinsChain(async (payload) => {
      await runExternalTransitionRef.current(payload);
    });
  }

  // REQ-008: 가드가 동작 전체를 래핑 — 같은 폴더 스킵 경로 포함(dirty=true 면 같은 폴더여도 모달.
  //   openFile 이 setDirty(false)+콘텐츠 교체하므로 가드 없는 스킵 경로는 미저장 편집을 조용히 버린다).
  const handleExternalOpen = useCallback(
    (payload: PendingOpenFile): void => {
      guard.requestGuardedAction(() => externalChainRef.current?.(payload));
    },
    [guard],
  );

  const { consumePendingOpenFile } = useExternalOpenFile({ onExternalOpen: handleExternalOpen });

  // Set platform attribute for platform-specific CSS targeting (Windows WebView2 vs macOS WKWebView)
  useEffect(() => {
    const isWindows = navigator.userAgent.includes('Windows');
    document.documentElement.setAttribute('data-platform', isWindows ? 'windows' : 'other');
  }, []);

  // Restore last watched folder on app start (REQ-UI-003-06, REQ-UI-003-07).
  // SPEC-FS-004 REQ-011: 마운트 take 드레인이 복원에 우선한다 — 단일 if-else 흐름으로
  //   경쟁하는 openFolderPath 2회(외부 오픈 폴더 vs 복원 폴더)를 구조적으로 방지한다.
  useEffect(() => {
    let cancelled = false;
    const restore = async (): Promise<void> => {
      const consumed = await consumePendingOpenFile();
      if (consumed || cancelled) return; // 외부 오픈이 처리됨 → 복원 스킵
      const { lastWatchedPath, setLastWatchedPath } = useUIStore.getState();
      if (!lastWatchedPath) return;
      openFolderPath(lastWatchedPath).catch(() => {
        // Path no longer valid (deleted/moved) — clear persisted path
        setLastWatchedPath(null);
      });
    };
    void restore();
    return () => {
      cancelled = true;
    };
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
