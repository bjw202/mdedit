// @MX:NOTE: [AUTO] 런치 레이스 전제 — Tauri emit은 큐잉되지 않는다. 유실은 마운트 전 도착뿐이며
//   AppState 슬롯+take가 커버, 겹침 창은 atomic-take 계약으로 봉쇄(모든 소비자가 take 반환값만 처리).
// @MX:SPEC: SPEC-FS-004

import { useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { takePendingOpenFile } from '@/lib/tauri/ipc';
import type { PendingOpenFile } from '@/lib/tauri/ipc';

/** Tauri 런타임 존재 여부 — 부재 시(jsdom/Playwright/Vite dev) 완전 no-op (REQ-FS-004-014). */
function hasTauriRuntime(): boolean {
  return Boolean((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__);
}

// @MX:NOTE: [AUTO] 정규화 방향 — 오판 시 "다른 폴더로 오판"뿐 → idempotent 재오픈이라 실패-안전.
//   대소문자 접기는 Windows 형태 경로(드라이브 문자 접두 또는 백슬래시 포함)에만 적용하고
//   POSIX 는 정확 비교한다(macOS 대소문자 구분 볼륨의 서로 다른 디렉터리를 동일시하지 않는다,
//   REQ-FS-004-007). 접기 여부는 런타임 OS 가 아니라 경로 문자열 형태로 판정한다 — 정규화
//   매트릭스(AC-013)가 Windows 조합을 비-Windows 호스트에서도 검증해야 하기 때문.
// @MX:SPEC: SPEC-FS-004
export function isSameWorkspaceDir(watchedPath: string | null, dir: string): boolean {
  if (!watchedPath) return false;
  const normalize = (p: string): string => {
    const unified = p.replace(/\\/g, '/');
    return unified.length > 1 ? unified.replace(/\/+$/, '') : unified;
  };
  const windowsShaped = (p: string): boolean => /^[A-Za-z]:[\\/]/.test(p) || p.includes('\\');
  const a = normalize(watchedPath);
  const b = normalize(dir);
  return windowsShaped(watchedPath) && windowsShaped(dir)
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

/**
 * single-flight latest-wins 직렬화 (AC-008 4th 시나리오).
 * 실행 중(in-flight) 전환이 있을 때 새 호출은 동시에 인터리브 실행되지 않고 대기열에
 * 쌓였다가 실행 완료 후 대기 중 마지막(최신) 페이로드 하나만 이어 실행된다(나머지 폐기) —
 * 최종 상태는 항상 정확히 하나의 일관된 워크스페이스+파일 쌍이 된다. 실행 실패(reject)는
 * 각 호출자의 결과로 전달되며 체인은 멈추지 않는다: 실패한 실행 뒤에도 대기 페이로드가
 * 이어 실행된다(예: 폴더 B 가 삭제되어 전환 실패 → 이후 유효한 C 는 여전히 열린다).
 */
export function createLatestWinsChain<A>(
  run: (arg: A) => Promise<void>,
): (arg: A) => Promise<void> {
  interface QueueItem {
    arg: A;
    resolve: () => void;
    reject: (e: unknown) => void;
  }
  let pumping = false;
  const queue: QueueItem[] = [];

  const pump = async (): Promise<void> => {
    if (pumping) return; // single-flight — 동시 펌프 금지
    pumping = true;
    try {
      while (queue.length > 0) {
        // latest-wins: 대기가 2개 이상이면 마지막(최신)만 실행, 앞의 대기는 즉시 확정(폐기).
        while (queue.length > 1) {
          queue.shift()!.resolve();
        }
        const item = queue.shift()!;
        try {
          await run(item.arg);
          item.resolve();
        } catch (e) {
          item.reject(e); // 각 호출자는 자기 실행 결과를 받는다 — 체인은 계속
        }
      }
    } finally {
      pumping = false;
    }
  };

  const chained = (arg: A): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      queue.push({ arg, resolve, reject });
      if (queue.length === 1) {
        void pump(); // 유휴 상태에서의 진입만 펌프 기동 — 실행 중이면 진행 pump 가 이어 소비
      }
    });
  return chained;
}

/** Options for useExternalOpenFile. */
export interface UseExternalOpenFileOptions {
  /**
   * 외부 오픈 핸들러 — App 의 handleExternalOpen(guard.requestGuardedAction 이 동작 전체를
   * 래핑한 호출부). identity 가 자주 바뀌어도 리스너는 재등록되지 않는다(ref 안정화).
   */
  onExternalOpen: (payload: PendingOpenFile) => void;
}

/** Return value of useExternalOpenFile. */
export interface UseExternalOpenFileResult {
  /**
   * 마운트 시 1회 드레인 판정 (REQ-FS-004-011): take Some → onExternalOpen 호출 후 true,
   * None → false, ipc 거부 → false 폴백. 비-Tauri 런타임에서는 take 없이 항상 false.
   */
  consumePendingOpenFile: () => Promise<boolean>;
}

/**
 * 외부 .md 오픈 소비 훅 (SPEC-FS-004 계약의 소비자).
 *
 * - 라이브 리스너: 'open-file' 이벤트는 통지일 뿐 — 페이로드를 직접 소비하지 않고
 *   takePendingOpenFile() 을 수행해 반환값만 처리한다 (atomic-take, REQ-FS-004-011).
 * - consumePendingOpenFile: 마운트 효과(복원 이펙트)가 호출 — lastWatchedPath 복원에 우선.
 * - Tauri 런타임 부재 시 완전 no-op: listen/take 모두 미호출 (REQ-FS-004-014).
 *
 * @example
 * const { consumePendingOpenFile } = useExternalOpenFile({ onExternalOpen: handleExternalOpen });
 */
export function useExternalOpenFile({
  onExternalOpen,
}: UseExternalOpenFileOptions): UseExternalOpenFileResult {
  // 콜백 안정화(useFileWatcher 패턴) — 부모 재렌더로 identity 가 바뀌어도 재등록 없음.
  const onExternalOpenRef = useRef(onExternalOpen);
  useEffect(() => {
    onExternalOpenRef.current = onExternalOpen;
  }, [onExternalOpen]);

  // 라이브 이벤트 경로 dispatch — take 반환값 기반만 처리(이벤트 페이로드 미참조).
  const dispatchTaken = useCallback(async (): Promise<void> => {
    if (!hasTauriRuntime()) return;
    try {
      const pending = await takePendingOpenFile();
      if (pending) onExternalOpenRef.current(pending);
    } catch {
      // take 실패 — 조용히 무시(atomic-take: 처리 기준은 take 반환값뿐이라 부분 처리 없음)
    }
  }, []);

  const dispatchTakenRef = useRef(dispatchTaken);
  useEffect(() => {
    dispatchTakenRef.current = dispatchTaken;
  }, [dispatchTaken]);

  // 리스너 수명: 1회 등록 + 언마운트 해제. 등록 promise 경합(race)은 active 플래그로 봉쇄
  // (useWindowCloseGuard 패턴 — unlisten 이 등록 완료보다 먼저 불리는 창 방지).
  useEffect(() => {
    if (!hasTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    listen('open-file', () => {
      // 통지일 뿐 — event.payload 를 직접 소비하지 않는다(atomic-take, REQ-FS-004-011).
      void dispatchTakenRef.current();
    })
      .then((u) => {
        if (active) {
          unlisten = u;
        } else {
          u();
        }
      })
      .catch(() => {
        // 리스너 등록 실패(불완전한 Tauri internals) — 조용히 무시
      });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const consumePendingOpenFile = useCallback(async (): Promise<boolean> => {
    if (!hasTauriRuntime()) return false; // REQ-FS-004-014: take 없이 false → 복원 경로 유지
    try {
      const pending = await takePendingOpenFile();
      if (!pending) return false;
      onExternalOpenRef.current(pending);
      return true;
    } catch {
      return false; // ipc 거부 → false 폴백(복원으로, AC-011)
    }
  }, []);

  return { consumePendingOpenFile };
}
