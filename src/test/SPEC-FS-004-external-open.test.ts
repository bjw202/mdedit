// @MX:SPEC: SPEC-FS-004
// 훅 메커니즘 단위 테스트 (REQ-007/011/014) — isSameWorkspaceDir 정규화 매트릭스 /
// 비-Tauri 완전 no-op / 리스너 1회 등록·언마운트 해제 / atomic-take(이벤트 페이로드 직접
// 소비 금지 + 인플라이트 인터리빙) / take Some·null·거부 3분기 / single-flight latest-wins 체인.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// vi.mock 은 호이스트되므로 모킹 대상은 vi.hoisted 로 선언한다.
const { mockTake, listenMock, unlistenMock } = vi.hoisted(() => ({
  mockTake: vi.fn(),
  listenMock: vi.fn(),
  unlistenMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));
vi.mock('@/lib/tauri/ipc', () => ({ takePendingOpenFile: mockTake }));

import {
  useExternalOpenFile,
  isSameWorkspaceDir,
  createLatestWinsChain,
} from '@/hooks/useExternalOpenFile';
import type { PendingOpenFile } from '@/lib/tauri/ipc';

/** 훅이 등록한 'open-file' 라이브 핸들러 캡처 (listen mock 경유). */
let capturedOpenFileHandler: (() => void) | null = null;

function setTauriRuntime(present: boolean): void {
  const w = window as unknown as Record<string, unknown>;
  if (present) {
    w.__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: 'main' } } };
  } else {
    delete w.__TAURI_INTERNALS__;
  }
}

function payload(path: string, dir: string): PendingOpenFile {
  return { path, dir };
}

beforeEach(() => {
  mockTake.mockReset();
  listenMock.mockReset();
  unlistenMock.mockClear();
  capturedOpenFileHandler = null;
  listenMock.mockImplementation(
    (event: string, handler: () => void) => {
      if (event === 'open-file') capturedOpenFileHandler = handler;
      return Promise.resolve(unlistenMock);
    },
  );
});

afterEach(() => {
  setTauriRuntime(false);
});

// ── isSameWorkspaceDir: AC-013 vitest 정규화 매트릭스 ─────────────────────────
describe('isSameWorkspaceDir (AC-013, REQ-007/013)', () => {
  it('Windows 조합은 구분자·트레일링 슬래시·대소문자 접기로 동일 판정한다 ("C:\\Docs" vs "c:/docs/")', () => {
    expect(isSameWorkspaceDir('C:\\Docs', 'c:/docs/')).toBe(true);
  });

  it('Windows 접두사 겹침은 다른 폴더로 판정한다 ("C:\\Docs" vs "C:\\Docs2")', () => {
    expect(isSameWorkspaceDir('C:\\Docs', 'C:\\Docs2')).toBe(false);
  });

  it('Windows 같은 폴더 + 트레일링 슬래시 차이만 접는다 ("C:\\Docs" vs "C:\\Docs/")', () => {
    expect(isSameWorkspaceDir('C:\\Docs', 'C:\\Docs/')).toBe(true);
  });

  it('watchedPath null/빈값은 항상 false (워크스페이스 없음 → 폴더 오픈 필요)', () => {
    expect(isSameWorkspaceDir(null, '/any/dir')).toBe(false);
    expect(isSameWorkspaceDir('', '/any/dir')).toBe(false);
  });

  it('POSIX 조합은 대소문자가 다르면 false — 접기는 Windows 형태 경로에만 적용 (macOS 대소문자 구분 볼륨 안전)', () => {
    expect(isSameWorkspaceDir('/Users/a/Docs', '/Users/a/docs')).toBe(false);
  });

  it('POSIX 같은 폴더의 트레일링 슬래시 차이는 접는다 (대소문자는 정확 비교)', () => {
    expect(isSameWorkspaceDir('/Users/a/Docs', '/Users/a/Docs/')).toBe(true);
    expect(isSameWorkspaceDir('/Users/a/Docs', '/Users/a/Docs')).toBe(true);
  });
});

// ── 비-Tauri 완전 no-op: AC-014 ───────────────────────────────────────────────
describe('useExternalOpenFile: 비-Tauri no-op (AC-014, REQ-014)', () => {
  it('__TAURI_INTERNALS__ 부재 시 listen() 을 호출하지 않는다', async () => {
    setTauriRuntime(false);
    const onExternalOpen = vi.fn();
    renderHook(() => useExternalOpenFile({ onExternalOpen }));
    await act(async () => { await Promise.resolve(); });
    expect(listenMock).not.toHaveBeenCalled();
  });

  it('__TAURI_INTERNALS__ 부재 시 consumePendingOpenFile() 은 take IPC 없이 false 를 반환한다', async () => {
    setTauriRuntime(false);
    const onExternalOpen = vi.fn();
    const { result } = renderHook(() => useExternalOpenFile({ onExternalOpen }));
    let consumed: boolean | undefined;
    await act(async () => { consumed = await result.current.consumePendingOpenFile(); });
    expect(consumed).toBe(false);
    expect(mockTake).not.toHaveBeenCalled();
    expect(onExternalOpen).not.toHaveBeenCalled();
  });
});

// ── 리스너 수명: 등록 1회 + 언마운트 해제 + 콜백 identity 교체 재등록 없음 ──────────
describe('useExternalOpenFile: 리스너 수명 (REQ-011 통지 등록)', () => {
  it('Tauri 런타임에서 open-file 리스너를 정확히 1회 등록하고 언마운트 시 해제한다', async () => {
    setTauriRuntime(true);
    const onExternalOpen = vi.fn();
    const { unmount } = renderHook(() => useExternalOpenFile({ onExternalOpen }));
    await act(async () => { await Promise.resolve(); });
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(listenMock.mock.calls[0][0]).toBe('open-file');
    unmount();
    expect(unlistenMock).toHaveBeenCalledTimes(1);
  });

  it('콜백 identity 가 바뀌어도 재등록하지 않는다 (ref 안정화 — useFileWatcher 패턴)', async () => {
    setTauriRuntime(true);
    const first = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useExternalOpenFile({ onExternalOpen: cb }),
      { initialProps: { cb: first } },
    );
    await act(async () => { await Promise.resolve(); });
    rerender({ cb: vi.fn() });
    rerender({ cb: vi.fn() });
    await act(async () => { await Promise.resolve(); });
    expect(listenMock).toHaveBeenCalledTimes(1);
  });
});

// ── atomic-take: 이벤트 페이로드 직접 소비 금지 + take 반환값만 처리 (REQ-011) ─────
describe('useExternalOpenFile: atomic-take (AC-011, REQ-011)', () => {
  it('라이브 이벤트 핸들러는 이벤트 페이로드를 직접 소비하지 않고 take 반환값만 처리한다', async () => {
    setTauriRuntime(true);
    const onExternalOpen = vi.fn();
    renderHook(() => useExternalOpenFile({ onExternalOpen }));
    await act(async () => { await Promise.resolve(); });
    expect(capturedOpenFileHandler).not.toBeNull();
    // 이벤트 페이로드(사우이값)와 take 반환값(진짜)을 의도적으로 다르게 주입.
    mockTake.mockResolvedValue(payload('/take/real.md', '/take'));
    const bogusEventPayload = { payload: payload('/event/bogus.md', '/event') };
    // 핸들러 시그니처는 (event) 지만 훅은 event 를 전혀 읽지 않는다 — 사우이 페이로드로 호출.
    await act(async () => {
      (capturedOpenFileHandler as unknown as (e: unknown) => void)(bogusEventPayload);
      await Promise.resolve();
    });
    await act(async () => { await Promise.resolve(); });
    expect(mockTake).toHaveBeenCalledTimes(1);
    expect(onExternalOpen).toHaveBeenCalledTimes(1);
    expect(onExternalOpen).toHaveBeenCalledWith(payload('/take/real.md', '/take'));
  });

  it('마운트 take 인플라이트 중 라이브 이벤트가 take하면 정확히 1회의 전환만 발생한다 (인터리브 이중 처리 없음)', async () => {
    setTauriRuntime(true);
    const onExternalOpen = vi.fn();
    const { result } = renderHook(() => useExternalOpenFile({ onExternalOpen }));
    await act(async () => { await Promise.resolve(); });

    // take#1(마운트 consume) 은 지연(resolve 보류), take#2(라이브 핸들러) 는 null.
    let resolveTake1: (v: PendingOpenFile | null) => void = () => {};
    const take1 = new Promise<PendingOpenFile | null>((res) => { resolveTake1 = res; });
    mockTake.mockImplementationOnce(() => take1);
    mockTake.mockImplementationOnce(async () => null);

    let consumed: boolean | undefined;
    let consumeDone: Promise<void> = Promise.resolve();
    await act(async () => {
      const p = result.current.consumePendingOpenFile();
      consumeDone = p.then(() => undefined);
      // take#1 인플라이트 상태에서 라이브 이벤트 도착.
      (capturedOpenFileHandler as unknown as () => void)();
      await Promise.resolve();
    });
    // take#1 이 아직 보류 — 두 번째 take(null) 만 완료된 시점.
    await act(async () => { await Promise.resolve(); });
    expect(onExternalOpen).not.toHaveBeenCalled();

    await act(async () => {
      resolveTake1(payload('/race/winner.md', '/race'));
      await consumeDone;
    });
    // 두 take 중 하나만 Some → 전환 정확히 1회, 값은 take#1(Some) 의 것.
    expect(mockTake).toHaveBeenCalledTimes(2);
    expect(onExternalOpen).toHaveBeenCalledTimes(1);
    expect(onExternalOpen).toHaveBeenCalledWith(payload('/race/winner.md', '/race'));
    expect(consumed === undefined || consumed === true).toBe(true);
  });

  it('이벤트 경로 take 가 null 이면 핸들러는 아무것도 처리하지 않는다', async () => {
    setTauriRuntime(true);
    const onExternalOpen = vi.fn();
    renderHook(() => useExternalOpenFile({ onExternalOpen }));
    await act(async () => { await Promise.resolve(); });
    mockTake.mockResolvedValue(null);
    await act(async () => {
      (capturedOpenFileHandler as unknown as () => void)();
      await Promise.resolve();
    });
    await act(async () => { await Promise.resolve(); });
    expect(onExternalOpen).not.toHaveBeenCalled();
  });

  it('consume: take 가 Some 면 핸들러 호출 후 true 를 반환한다 (REQ-011 드레인 판정)', async () => {
    setTauriRuntime(true);
    const onExternalOpen = vi.fn();
    const { result } = renderHook(() => useExternalOpenFile({ onExternalOpen }));
    mockTake.mockResolvedValue(payload('/m/a.md', '/m'));
    let consumed: boolean | undefined;
    await act(async () => { consumed = await result.current.consumePendingOpenFile(); });
    expect(consumed).toBe(true);
    expect(onExternalOpen).toHaveBeenCalledTimes(1);
    expect(onExternalOpen).toHaveBeenCalledWith(payload('/m/a.md', '/m'));
  });

  it('consume: take 가 null 이면 false 를 반환한다 (복원 경로 진입)', async () => {
    setTauriRuntime(true);
    const onExternalOpen = vi.fn();
    const { result } = renderHook(() => useExternalOpenFile({ onExternalOpen }));
    mockTake.mockResolvedValue(null);
    let consumed: boolean | undefined;
    await act(async () => { consumed = await result.current.consumePendingOpenFile(); });
    expect(consumed).toBe(false);
    expect(onExternalOpen).not.toHaveBeenCalled();
  });

  it('consume: ipc 거부(reject) 시 false 로 폴백한다 (AC-011)', async () => {
    setTauriRuntime(true);
    const onExternalOpen = vi.fn();
    const { result } = renderHook(() => useExternalOpenFile({ onExternalOpen }));
    mockTake.mockRejectedValue(new Error('ipc down'));
    let consumed: boolean | undefined;
    await act(async () => { consumed = await result.current.consumePendingOpenFile(); });
    expect(consumed).toBe(false);
    expect(onExternalOpen).not.toHaveBeenCalled();
  });

  it('이벤트 경로 take 거부는 조용히 흡수된다 (미처리 예외 없음)', async () => {
    setTauriRuntime(true);
    const onExternalOpen = vi.fn();
    renderHook(() => useExternalOpenFile({ onExternalOpen }));
    await act(async () => { await Promise.resolve(); });
    mockTake.mockRejectedValue(new Error('ipc down'));
    await act(async () => {
      (capturedOpenFileHandler as unknown as () => void)();
      await Promise.resolve();
    });
    await act(async () => { await Promise.resolve(); });
    expect(onExternalOpen).not.toHaveBeenCalled();
  });
});

// ── single-flight latest-wins 체인: AC-008 4th 시나리오의 직렬화 기계 ───────────
describe('createLatestWinsChain (AC-008 4th, single-flight latest-wins)', () => {
  it('실행 중 전환은 동시에 인터리브 실행되지 않는다 — 후속 호출은 실행 완료 후 시작', async () => {
    const order: string[] = [];
    let resolveA: () => void = () => {};
    const gateA = new Promise<void>((res) => { resolveA = res; });
    const run = vi.fn(async (id: string): Promise<void> => {
      order.push(`start:${id}`);
      if (id === 'A') await gateA;
      order.push(`end:${id}`);
    });
    const chained = createLatestWinsChain(run);

    const pA = chained('A');
    const pB = chained('B');
    await Promise.resolve();
    // A 가 게이트 보류 중 — B 는 시작되지 않는다(인터리브 금지).
    expect(order).toEqual(['start:A']);
    resolveA();
    await Promise.all([pA, pB]);
    expect(order).toEqual(['start:A', 'end:A', 'start:B', 'end:B']);
  });

  it('큐는 최신 페이로드로 대체된다 — A 실행 중 B·C 가 들어오면 A 다음 C 만 실행(B 폐기)', async () => {
    const order: string[] = [];
    let resolveA: () => void = () => {};
    const gateA = new Promise<void>((res) => { resolveA = res; });
    const run = vi.fn(async (id: string): Promise<void> => {
      order.push(`run:${id}`);
      if (id === 'A') await gateA;
    });
    const chained = createLatestWinsChain(run);

    const pA = chained('A');
    chained('B'); // 대체 대상 1
    const pC = chained('C'); // B 를 덮어쓴 최신
    resolveA();
    await Promise.all([pA, pC]);
    expect(order).toEqual(['run:A', 'run:C']);
    expect(run).not.toHaveBeenCalledWith('B');
  });

  it('실행 중 실패해도 체인 상태는 해제되어 대기 페이로드가 이어 실행된다', async () => {
    const order: string[] = [];
    let rejectA: () => void = () => {};
    const gateA = new Promise<void>((_, rej) => { rejectA = rej; });
    const run = vi.fn(async (id: string): Promise<void> => {
      order.push(`run:${id}`);
      if (id === 'A') await gateA;
    });
    const chained = createLatestWinsChain(run);

    const pA = chained('A');
    const pC = chained('C'); // A 실패 후 이어 실행되어야 함
    rejectA();
    await expect(pA).rejects.toBeUndefined();
    await pC;
    expect(order).toEqual(['run:A', 'run:C']);
  });
});
