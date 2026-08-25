// @MX:SPEC: SPEC-FS-004
// 합성 흐름 단위 테스트 (REQ-002/007/008/011/012) — 실제 App 컴포지션을 렌더하고
// ipc 레이어(@/lib/tauri/ipc — 단일 모킹 지점)와 'open-file' listen 만 모킹하며,
// 가드는 AC-008 규정대로 fake(immediate/modal 폭)로 주입한다.
//   - 다른 폴더: readDirectory→readFile 순서 + startWatch/registerAssetScope + 복원 스킵
//   - 같은 폴더: readDirectory 재호출 없음 / dirty=true → 가드 모달 / 취소 → 파일 IPC 없음
//   - 폴더 실패 → readFile 중단 / 연속 오픈 버스트 → 단일 일관 상태(latest-wins)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';

const {
  mockReadDirectory, mockReadFile, mockReadFileSize,
  mockStartWatch, mockRegisterAssetScope, mockTake,
  listenMock, unlistenMock,
} = vi.hoisted(() => ({
  mockReadDirectory: vi.fn(),
  mockReadFile: vi.fn(),
  mockReadFileSize: vi.fn(),
  mockStartWatch: vi.fn(),
  mockRegisterAssetScope: vi.fn(),
  mockTake: vi.fn(),
  listenMock: vi.fn(),
  unlistenMock: vi.fn(),
}));

// 가드 fake — AC-008 "가드 fake 기반": immediate(즉시 실행)/modal(캡처 후 보류) 두 폭.
// REQ-009: 모달 열림 중 재진입은 폐기(큐잉 금지) — 실제 가드 머신(SPEC-FS-003 REQ-024/025) 계약 반영.
const { fakeGuard, guardState } = vi.hoisted(() => {
  const guardState = {
    mode: 'immediate' as 'immediate' | 'modal',
    captured: null as null | (() => void | Promise<void>),
  };
  const fakeGuard = {
    open: false,
    title: '',
    message: '',
    actions: [],
    requestGuardedAction: (action: () => void | Promise<void>): void => {
      if (guardState.mode === 'modal') {
        if (guardState.captured !== null) return; // 모달 열림 중 재진입 → 폐기(REQ-009)
        guardState.captured = action;
        return;
      }
      void action();
    },
    requestWatcherConflict: vi.fn(),
    requestClose: vi.fn(),
    onAction: vi.fn(),
  };
  return { fakeGuard, guardState };
});

vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/tauri/ipc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tauri/ipc')>();
  return {
    ...actual,
    readDirectory: mockReadDirectory,
    readFile: mockReadFile,
    readFileSize: mockReadFileSize,
    startWatch: mockStartWatch,
    registerAssetScope: mockRegisterAssetScope,
    takePendingOpenFile: mockTake,
  };
});
vi.mock('@/hooks/useUnsavedChangesGuard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useUnsavedChangesGuard')>();
  return { ...actual, useUnsavedChangesGuard: () => fakeGuard };
});

import App from '../App';
import type { PendingOpenFile } from '@/lib/tauri/ipc';
import { useFileStore } from '@/store/fileStore';
import { useEditorStore } from '@/store/editorStore';
import { useUIStore } from '@/store/uiStore';

/** 훅이 등록한 'open-file' 라이브 핸들러 캡처 (listen mock 경유). */
let openFileEventHandler: ((event: { payload: unknown }) => void) | null = null;

/** IPC 호출 순서 로그 — 순서 단언(readDirectory → readFile)의 기준. */
const order: string[] = [];

function flush(times = 8): Promise<void> {
  let p: Promise<void> = Promise.resolve();
  for (let i = 0; i < times; i += 1) {
    p = p
      .then(() => act(async () => { await Promise.resolve(); }).then(() => undefined))
      // 마이크로태스크뿐 아니라 스케줄러/rAF 등 매크로태스크 진행까지 보장 —
      // 마이크로태스크 플러시만으로는 다음 테스트 창으로 체인이 새는 관측(RED 실행)이 있었다.
      .then(() => new Promise<void>((res) => { setTimeout(res, 0); }));
  }
  return p;
}

function seedStores(watchedPath: string | null): void {
  useFileStore.setState({ fileTree: [], currentFile: null, watchedPath, isLoading: false, previewStatus: null });
  useEditorStore.setState({ dirty: false, content: '', currentFilePath: null });
  useUIStore.setState({ lastWatchedPath: null });
}

beforeEach(() => {
  order.length = 0;
  openFileEventHandler = null;
  guardState.mode = 'immediate';
  guardState.captured = null;
  fakeGuard.open = false;

  // 호출 이력 초기화 — mockImplementation 재설정만으로는 이전 테스트의 call history 가 남는다.
  mockReadDirectory.mockReset();
  mockReadFile.mockReset();
  mockReadFileSize.mockReset();
  mockStartWatch.mockReset();
  mockRegisterAssetScope.mockReset();

  mockReadDirectory.mockImplementation(async (path: string) => {
    order.push(`readDirectory:${path}`);
    return [];
  });
  mockReadFile.mockImplementation(async (path: string) => {
    order.push(`readFile:${path}`);
    return '# t';
  });
  mockReadFileSize.mockImplementation(async (path: string) => {
    order.push(`readFileSize:${path}`);
    return 10;
  });
  mockStartWatch.mockImplementation(async (path: string) => {
    order.push(`startWatch:${path}`);
  });
  mockRegisterAssetScope.mockImplementation(async (path: string) => {
    order.push(`registerAssetScope:${path}`);
  });
  mockTake.mockReset();
  mockTake.mockResolvedValue(null);

  listenMock.mockReset();
  unlistenMock.mockClear();
  listenMock.mockImplementation((event: string, handler: (e: { payload: unknown }) => void) => {
    if (event === 'open-file') openFileEventHandler = handler;
    return Promise.resolve(unlistenMock);
  });

  const w = window as unknown as Record<string, unknown>;
  w.__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: 'main' } } };
  seedStores(null);
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

// ── REQ-011: 마운트 드레인 우선 — 복원 if-else ─────────────────────────────────
describe('SPEC-FS-004 합성 흐름: 마운트 드레인 vs lastWatchedPath 복원 (REQ-011)', () => {
  it('take 가 Some 면 외부 오픈만 실행되고 lastWatchedPath 복원의 openFolderPath 는 호출되지 않는다', async () => {
    useUIStore.setState({ lastWatchedPath: '/old/ws' });
    mockTake.mockResolvedValue({ path: '/ws/B/note.md', dir: '/ws/B' } satisfies PendingOpenFile);
    await act(async () => { render(<App />); });
    await flush();
    expect(mockReadDirectory).toHaveBeenCalledTimes(1);
    expect(mockReadDirectory).toHaveBeenCalledWith('/ws/B');
    expect(mockReadDirectory).not.toHaveBeenCalledWith('/old/ws');
  });

  it('take 가 null 이면 기존 lastWatchedPath 복원 경로가 그대로 실행된다', async () => {
    seedStores(null);
    useUIStore.setState({ lastWatchedPath: '/old/ws' });
    mockTake.mockResolvedValue(null);
    await act(async () => { render(<App />); });
    await flush();
    expect(mockReadDirectory).toHaveBeenCalledWith('/old/ws');
    expect(useFileStore.getState().watchedPath).toBe('/old/ws');
  });

  it('마운트 take 인플라이트 중 라이브 take 가 Some 을 가져가면, 마운트 take 의 null 확정 시 복원은 스킵된다 (미러 경합, sync-audit F1)', async () => {
    seedStores(null);
    useUIStore.setState({ lastWatchedPath: '/old/ws' });
    // take#1(마운트 consume) 은 지연(resolve 보류), take#2(라이브 이벤트) 는 Some.
    let resolveMountTake: (v: PendingOpenFile | null) => void = () => {};
    const mountTake = new Promise<PendingOpenFile | null>((res) => { resolveMountTake = res; });
    mockTake
      .mockImplementationOnce(() => mountTake)
      .mockImplementationOnce(async () => ({ path: '/ws/B/note.md', dir: '/ws/B' } satisfies PendingOpenFile));

    // 외부 전환의 readDirectory('/ws/B') 는 수동 게이트 — 마운트 null 확정 시점에
    // 전환이 여전히 인플라이트(레이스 창) 상태를 만든다.
    let resolveB: () => void = () => {};
    const gateB = new Promise<void>((res) => { resolveB = res; });
    mockReadDirectory.mockImplementation(async (path: string) => {
      order.push(`readDirectory:${path}`);
      if (path === '/ws/B') await gateB;
      return [];
    });

    await act(async () => { render(<App />); });
    await flush();
    expect(openFileEventHandler).not.toBeNull();

    // 마운트 take 인플라이트 상태에서 라이브 이벤트 도착 → take#2 Some → 외부 전환 시작(게이트 보류).
    await act(async () => {
      openFileEventHandler!({ payload: { path: 'IGNORED', dir: 'IGNORED' } });
      await Promise.resolve();
    });
    await flush(3);
    expect(order).toContain('readDirectory:/ws/B');

    // 마운트 take 가 null 로 확정 — 미러 경합 지점. 외부 전환이 인플라이트인 동안
    // lastWatchedPath('/old/ws') 복원이 시작되면 두 openFolderPath 가 경쟁한다(결함).
    await act(async () => {
      resolveMountTake(null);
      await Promise.resolve();
    });
    await flush();
    expect(mockReadDirectory).not.toHaveBeenCalledWith('/old/ws');

    // 게이트 해제 — 외부 전환 완료, 종착 상태는 외부 오픈의 워크스페이스.
    await act(async () => { resolveB(); });
    await flush();
    expect(useFileStore.getState().watchedPath).toBe('/ws/B');
  });
});

// ── REQ-002: 다른 폴더 전환 — 순서 + 워처/스코프 + 상태 일관성 ───────────────────
describe('SPEC-FS-004 합성 흐름: 다른 폴더 (REQ-002/012)', () => {
  it('readDirectory(폴더) 가 readFile(파일) 보다 먼저 호출되고 startWatch·registerAssetScope 가 폴더로 호출된다', async () => {
    mockTake.mockResolvedValue({ path: '/ws/B/note.md', dir: '/ws/B' } satisfies PendingOpenFile);
    await act(async () => { render(<App />); });
    await flush();
    expect(order.indexOf('readDirectory:/ws/B')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('readDirectory:/ws/B')).toBeLessThan(order.indexOf('readFile:/ws/B/note.md'));
    expect(mockStartWatch).toHaveBeenCalledWith('/ws/B');
    expect(mockRegisterAssetScope).toHaveBeenCalledWith('/ws/B');
    expect(useFileStore.getState().watchedPath).toBe('/ws/B');
    expect(useEditorStore.getState().currentFilePath).toBe('/ws/B/note.md');
    expect(useUIStore.getState().lastWatchedPath).toBe('/ws/B');
  });
});

// ── REQ-007: 같은 폴더 스킵 ────────────────────────────────────────────────────
describe('SPEC-FS-004 합성 흐름: 같은 폴더 스킵 (REQ-007)', () => {
  it('같은 폴더(트레일링 슬래시 차이)면 readDirectory 재호출 없이 openFile 만 수행한다', async () => {
    seedStores('/ws/B');
    mockTake.mockResolvedValue({ path: '/ws/B/other.md', dir: '/ws/B/' } satisfies PendingOpenFile);
    await act(async () => { render(<App />); });
    await flush();
    expect(mockReadDirectory).not.toHaveBeenCalled();
    expect(mockStartWatch).not.toHaveBeenCalled();
    expect(mockReadFile).toHaveBeenCalledWith('/ws/B/other.md');
    expect(useFileStore.getState().watchedPath).toBe('/ws/B');
    expect(useEditorStore.getState().currentFilePath).toBe('/ws/B/other.md');
  });

  it('같은 폴더 + dirty=true 면 가드 모달이 열리고(fake 캡처) 확정 전까지 파일 IPC 가 없다', async () => {
    seedStores('/ws/B');
    useEditorStore.setState({ dirty: true });
    guardState.mode = 'modal';
    mockTake.mockResolvedValue({ path: '/ws/B/x.md', dir: '/ws/B' } satisfies PendingOpenFile);
    await act(async () => { render(<App />); });
    await flush();
    // 모달 보류 중 — 어떤 파일 IPC 도 없음.
    expect(guardState.captured).not.toBeNull();
    expect(mockReadDirectory).not.toHaveBeenCalled();
    expect(mockReadFileSize).not.toHaveBeenCalled();
    expect(mockReadFile).not.toHaveBeenCalled();
    // 사용자가 저장/저장 안 함 선택(확정) → 전환 실행, 여전히 같은 폴더라 readDirectory 없음.
    await act(async () => { await guardState.captured!(); });
    await flush();
    expect(mockReadFile).toHaveBeenCalledWith('/ws/B/x.md');
    expect(mockReadDirectory).not.toHaveBeenCalled();
  });
});

// ── REQ-008/009: 가드 래핑·취소 중단 ──────────────────────────────────────────
describe('SPEC-FS-004 합성 흐름: 가드 취소 중단 (REQ-008/009)', () => {
  it('가드에서 취소(캡처된 동작 미실행 폐기)되면 어떤 파일 IPC 도 호출되지 않는다', async () => {
    guardState.mode = 'modal';
    mockTake.mockResolvedValue({ path: '/ws/B/x.md', dir: '/ws/B' } satisfies PendingOpenFile);
    await act(async () => { render(<App />); });
    await flush();
    expect(guardState.captured).not.toBeNull();
    guardState.captured = null; // 취소 — 보류 동작 폐기
    expect(mockReadDirectory).not.toHaveBeenCalled();
    expect(mockReadFileSize).not.toHaveBeenCalled();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockStartWatch).not.toHaveBeenCalled();
    expect(mockRegisterAssetScope).not.toHaveBeenCalled();
  });

  it('모달 열림 중 도착한 외부 오픈은 큐잉 없이 폐기된다 — 확정 시 첫 요청만 실행된다 (AC-009)', async () => {
    seedStores('/ws/B');
    guardState.mode = 'modal';
    mockTake
      .mockImplementationOnce(async () => ({ path: '/ws/B/first.md', dir: '/ws/B' } satisfies PendingOpenFile))
      .mockImplementationOnce(async () => ({ path: '/ws/B/second.md', dir: '/ws/B' } satisfies PendingOpenFile));
    await act(async () => { render(<App />); });
    await flush();
    expect(guardState.captured).not.toBeNull(); // 첫 요청 → 모달
    // 모달 열림 중 두 번째 외부 오픈 도착(라이브 이벤트) → 폐기, pendingAction 대체 없음.
    await act(async () => {
      openFileEventHandler!({ payload: { path: 'IGNORED', dir: 'IGNORED' } });
      await Promise.resolve();
    });
    await flush();
    expect(mockReadFile).not.toHaveBeenCalled();
    // 사용자가 첫 요청을 확정 → 첫 파일만 열린다(두 번째는 폐기 — 큐 재생 없음).
    await act(async () => { await guardState.captured!(); });
    await flush();
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockReadFile).toHaveBeenCalledWith('/ws/B/first.md');
    expect(mockReadFile).not.toHaveBeenCalledWith('/ws/B/second.md');
  });
});

// ── REQ-012: 폴더 실패 → 전체 중단 ────────────────────────────────────────────
describe('SPEC-FS-004 합성 흐름: 폴더 실패 중단 (REQ-012)', () => {
  it('openFolderPath(폴더) 가 실패하면 openFile(readFile) 을 시도하지 않고 전체가 중단된다', async () => {
    seedStores(null);
    mockReadDirectory.mockImplementation(async (path: string) => {
      order.push(`readDirectory:${path}`);
      if (path === '/gone') throw new Error('folder vanished');
      return [];
    });
    mockTake.mockResolvedValue({ path: '/gone/a.md', dir: '/gone' } satisfies PendingOpenFile);
    await act(async () => { render(<App />); });
    await flush();
    expect(mockReadDirectory).toHaveBeenCalledWith('/gone');
    expect(mockReadFileSize).not.toHaveBeenCalled();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(useFileStore.getState().watchedPath).toBeNull();
  });
});

// ── AC-008 4th: 연속 오픈 버스트 — single-flight latest-wins ────────────────────
describe('SPEC-FS-004 합성 흐름: 연속 오픈 버스트 (AC-008 4th, single-flight latest-wins)', () => {
  it('B 실행 중 C·D 가 take되면 B 다음 D 만 실행(C 폐기) — 인터리브 없이 단일 일관 상태로 종착', async () => {
    seedStores(null);
    // 마운트 consume 은 null(드레인 없음), 이후 라이브 이벤트 take 3회: B → C → D.
    mockTake
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => ({ path: '/ws/B/note.md', dir: '/ws/B' } satisfies PendingOpenFile))
      .mockImplementationOnce(async () => ({ path: '/ws/C/mid.md', dir: '/ws/C' } satisfies PendingOpenFile))
      .mockImplementationOnce(async () => ({ path: '/ws/D/f.md', dir: '/ws/D' } satisfies PendingOpenFile));

    // B 의 readDirectory 는 수동 게이트 — 전환 실행 중(인플라이트) 상태를 만든다.
    let resolveB: () => void = () => {};
    const gateB = new Promise<void>((res) => { resolveB = res; });
    mockReadDirectory.mockImplementation(async (path: string) => {
      order.push(`readDirectory:${path}`);
      if (path === '/ws/B') await gateB;
      return [];
    });

    await act(async () => { render(<App />); });
    await flush();
    expect(openFileEventHandler).not.toBeNull();

    // 이벤트#1 → take B → 전환 B 시작(readDirectory 보류).
    await act(async () => {
      openFileEventHandler!({ payload: { path: 'IGNORED', dir: 'IGNORED' } });
      await Promise.resolve();
    });
    await flush(3);
    expect(order).toContain('readDirectory:/ws/B');
    expect(order).not.toContain('readFile:/ws/B/note.md');

    // 이벤트#2(C)·#3(D) — B 인플라이트 중 도착. 큐는 최신(D)으로 대체.
    await act(async () => {
      openFileEventHandler!({ payload: { path: 'IGNORED', dir: 'IGNORED' } });
      await Promise.resolve();
    });
    await act(async () => {
      openFileEventHandler!({ payload: { path: 'IGNORED', dir: 'IGNORED' } });
      await Promise.resolve();
    });
    await flush(3);
    expect(mockReadDirectory).not.toHaveBeenCalledWith('/ws/C');

    // B 완료 → 체인이 D 실행 → 최종 상태는 정확히 하나의 워크스페이스+파일 쌍(D).
    await act(async () => { resolveB(); });
    await flush();
    expect(mockReadDirectory).not.toHaveBeenCalledWith('/ws/C');
    expect(order.indexOf('readFile:/ws/B/note.md')).toBeLessThan(order.indexOf('readDirectory:/ws/D'));
    expect(order.indexOf('readDirectory:/ws/D')).toBeLessThan(order.indexOf('readFile:/ws/D/f.md'));
    expect(useFileStore.getState().watchedPath).toBe('/ws/D');
    expect(useEditorStore.getState().currentFilePath).toBe('/ws/D/f.md');
  });
});
