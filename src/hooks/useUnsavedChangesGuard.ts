// @MX:NOTE: [AUTO] SPEC-FS-003: 미저장 변경 가드 상태 머신.
//   "의도한 동작"을 보관하고 모달 결과에 따라 실행/폐기한다. 재진입 차단은 큐잉이 아닌
//   폐기다(REQ-024/025) — 큐잉하면 사용자가 한 번 선택했는데 두 파일이 순차로 열린다.
//   종료 요청은 차단 예외(REQ-037) — 폐기하면 창이 영원히 닫히지 않는다.
// @MX:SPEC: SPEC-FS-003

import { useCallback, useRef, useState, createElement, Fragment, createContext, useContext } from 'react';
import type { DialogAction } from '@/components/common/ConfirmDialog';
import { useEditorStore } from '@/store/editorStore';
import { useAiStore } from '@/store/aiStore';
import { saveDocument } from '@/lib/save/saveDocument';
import { aiCancel } from '@/lib/tauri/ipc';

/** 미저장 변경 가드 3버튼 액션 세트 (저장이 마지막 = primary + 초기 포커스). */
const UNSAVED_ACTIONS: DialogAction[] = [
  { id: 'cancel', label: '취소' },
  { id: 'discard', label: '저장 안 함' },
  { id: 'save', label: '저장', variant: 'primary' },
];

// @MX:NOTE: [AUTO] SPEC-FS-003 REQ-022/034: 워처 충돌 모달 액션 순서는 안전 선택지가 기본 포커스를
//   갖도록 의도적으로 배치된다. ConfirmDialog 계약("마지막 항목 = primary + 초기 포커스")은 동결되어
//   있으므로, 파괴적인 '디스크에서 다시 읽기'를 첫 번째(danger)에 두고 안전한 '내 버전 유지'를
//   마지막(primary)에 둔다. 이 순서를 뒤집지 말 것 — Enter 연타로 미저장 작업이 파괴된다.
const WATCHER_ACTIONS: DialogAction[] = [
  { id: 'reload', label: '디스크에서 다시 읽기', variant: 'danger' },
  { id: 'cancel', label: '내 버전 유지', variant: 'primary' },
];

const BASE_MESSAGE = '저장하지 않은 변경이 있습니다. 어떻게 하시겠어요?';
const WATCHER_MESSAGE = '이 파일이 외부에서 변경되었습니다. 어떻게 하시겠어요?';
const AI_NOTICE = '진행 중인 AI 응답이 중단됩니다.';

export interface UseUnsavedChangesGuardReturn {
  open: boolean;
  title: string;
  message: React.ReactNode;
  actions: DialogAction[];
  /** 파일 전환·새 문서 등 가드 대상 동작을 요청한다. dirty면 모달, 아니면 즉시 실행. */
  requestGuardedAction: (action: () => void | Promise<void>) => void;
  /** 워처 충돌: dirty면 reload/cancel 모달(REQ-022). 모달 열린 동안은 재진입 차단(REQ-024). */
  requestWatcherConflict: (reloadAction: () => void | Promise<void>) => void;
  /** 윈도우 종료를 요청한다. 모달이 열려 있으면 승격(REQ-037). */
  requestClose: (closeAction: () => void | Promise<void>) => void;
  /** ConfirmDialog onAction 핸들러. async(저장 대기). ConfirmDialog의 (id)=>void prop에 할당 가능. */
  onAction: (id: string) => Promise<void>;
}

/**
 * 가드 API를 트리 전체에 공유하기 위한 컨텍스트.
 * AppLayout이 인스턴스화한 단일 가드를 FileTreeNode/MarkdownEditor가 소비한다.
 * Provider 없이 렌더된 컴포넌트(격리 테스트)는 null을 받아 폴백(직접 openFile/resetEditor)한다.
 */
export interface GuardApi {
  requestGuardedAction: (action: () => void | Promise<void>) => void;
  requestWatcherConflict: (reloadAction: () => void | Promise<void>) => void;
  requestClose: (closeAction: () => void | Promise<void>) => void;
}

export const GuardContext = createContext<GuardApi | null>(null);

/** 가드 컨텍스트를 소비한다. Provider 없으면 null(폴백). */
export function useGuard(): GuardApi | null {
  return useContext(GuardContext);
}

// @MX:ANCHOR: [AUTO] 가드 상태 머신의 단일 인스턴스 — App.tsx 가 한 번만 호출하고 AppLayout 이
//   GuardContext 로 내려 FileTreeNode·MarkdownEditor·useWindowCloseGuard 가 소비한다(소비처 3+).
//   불변식 2가지: (1) 보류 동작을 실행하기 전에 반드시 reset() 을 먼저 호출한다(onAction 의 모든 종료
//   경로). (2) 다른 컴포넌트에서 이 훅을 두 번째로 호출하지 않는다 — 소비는 useGuard() 로만 한다.
// @MX:REASON: [AUTO] (1)의 순서가 뒤집히면 pendingAction 이 실행되는 동안 open/busy 플래그가 살아 있어
//   그 동작이 유발한 다음 가드 요청이 REQ-024/025 재진입 차단에 걸려 조용히 폐기된다(파일이 안 열림).
//   (2)를 어기면 인스턴스마다 별도 open state 를 갖게 돼, 종료 승격(closePending, REQ-037)을 세운
//   인스턴스와 모달을 띄운 인스턴스가 달라져 창이 영원히 닫히지 않는다.
// @MX:SPEC: SPEC-FS-003
export function useUnsavedChangesGuard(): UseUnsavedChangesGuardReturn {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'unsaved' | 'watcher'>('unsaved');
  // aiStore 구독 — 스트리밍 여부에 따라 메시지가 갱신된다(REQ-039).
  const requestState = useAiStore((s) => s.requestState);
  const isStreaming = requestState === 'streaming';

  // 뮤터블 포인터는 ref로 (async onAction에서 stale closure 회피)
  // pendingActionRef는 unsaved의 의도 동작과 watcher의 reload 동작을 모두 보관한다(kind별 구분 불필요).
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const closeActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const closePendingRef = useRef(false);
  const busyRef = useRef(false);

  const baseMsg = kind === 'watcher' ? WATCHER_MESSAGE : BASE_MESSAGE;
  const message: React.ReactNode = isStreaming
    ? createElement(
        Fragment,
        null,
        baseMsg,
        createElement('br'),
        createElement('span', { style: { color: 'var(--md-text-faint)' } }, AI_NOTICE),
      )
    : baseMsg;

  const reset = useCallback((): void => {
    pendingActionRef.current = null;
    closeActionRef.current = null;
    closePendingRef.current = false;
    busyRef.current = false;
    setKind('unsaved');
    setOpen(false);
  }, []);

  const requestGuardedAction = useCallback(
    (action: () => void | Promise<void>): void => {
      // REQ-024/025: 모달 열림 또는 저장 진행 중이면 폐기(큐잉 금지)
      if (open || busyRef.current) return;
      const { dirty } = useEditorStore.getState();
      if (!dirty) {
        // REQ-026: dirty=false면 즉시 실행
        void action();
        return;
      }
      setKind('unsaved');
      pendingActionRef.current = action;
      setOpen(true);
    },
    [open],
  );

  const requestWatcherConflict = useCallback(
    (reloadAction: () => void | Promise<void>): void => {
      // REQ-024: 모달 열린 동안 워처 이벤트도 무시(재알림 없음 — REQ-025의 의도된 대가).
      if (open || busyRef.current) return;
      setKind('watcher');
      pendingActionRef.current = reloadAction;
      setOpen(true);
    },
    [open],
  );

  const requestClose = useCallback(
    (closeAction: () => void | Promise<void>): void => {
      // REQ-037: 모달이 이미 열려 있으면 승격 (closePending만 세움, 화면 변화 없음)
      if (open) {
        closeActionRef.current = closeAction;
        closePendingRef.current = true;
        return;
      }
      const { dirty } = useEditorStore.getState();
      if (!dirty) {
        // REQ-019: dirty=false면 즉시 종료
        void closeAction();
        return;
      }
      // dirty=true → 모달 오픈 (closeAction 보관). 종료는 unsaved 3버튼으로.
      setKind('unsaved');
      closeActionRef.current = closeAction;
      closePendingRef.current = true;
      setOpen(true);
    },
    [open],
  );

  const onAction = useCallback(
    async (id: string): Promise<void> => {
      if (id === 'cancel') {
        // REQ-016/023/037: 의도 동작·종료 모두 중단. closePending 리셋(재종료 가능, deadlock 부재).
        // unsaved '취소'와 watcher '내 버전 유지'(id=cancel) 모두 이 경로.
        reset();
        return;
      }

      // REQ-038: save·discard·reload 시 스트리밍 중이면 aiCancel을 가장 먼저 호출.
      // cancel(내 버전 유지)에서는 미호출 — 사용자가 아무것도 바꾸지 않기로 했으므로 스트리밍 계속.
      if (isStreaming) {
        const { requestId } = useAiStore.getState();
        if (requestId) {
          try {
            await aiCancel(requestId);
          } catch {
            // 취소 실패는 진행을 막지 않는다
          }
        }
      }

      if (id === 'save') {
        busyRef.current = true;
        const ok = await saveDocument();
        busyRef.current = false;
        if (!ok) {
          // REQ-017: 저장 실패 → 의도 동작 미수행, dirty 유지. closePending도 리셋(종료 취소).
          reset();
          return;
        }
      }

      // 저장 성공(save) / discard / reload — 의도 동작 실행.
      // closePending이면 종료 동작을, 아니면 원래 pendingAction(reload 포함)을 실행.
      if (closePendingRef.current) {
        const closeAction = closeActionRef.current;
        reset();
        if (closeAction) void closeAction();
      } else {
        const pending = pendingActionRef.current;
        reset();
        if (pending) void pending();
      }
    },
    [isStreaming, reset],
  );

  return {
    open,
    title: kind === 'watcher' ? '파일 변경 감지' : '미저장 변경',
    message,
    actions: kind === 'watcher' ? WATCHER_ACTIONS : UNSAVED_ACTIONS,
    requestGuardedAction,
    requestWatcherConflict,
    requestClose,
    onAction,
  };
}
