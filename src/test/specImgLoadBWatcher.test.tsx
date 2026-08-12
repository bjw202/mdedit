// @MX:SPEC: SPEC-IMG-LOAD-001
// Group B — UT-B3: 파일 워쳐 reload 가 openFile 경로(크기 가드 포함)를 경유하는지 단언.
// REQ-IMG-LOAD-B-003: 워쳐 Modified 이벤트 수신 시 readFile 직접 호출이 아닌 openFile 위임.
//
// 전략: useFileWatcher 가 register 하는 listen 콜백을 캡처한 뒤, 이벤트를 수동 발생시켜
// openFile 스파이가 호출되고 readFile 스파이는 호출되지 않음을 단언한다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useEditorStore } from '@/store/editorStore';

// ---- 캡처용 mock ----
const { mockOpenFile, mockReadFile } = vi.hoisted(() => ({
  mockOpenFile: vi.fn().mockResolvedValue(undefined),
  mockReadFile: vi.fn().mockResolvedValue('reloaded content'),
}));

// 워쳐 listener 캡처
let watcherCallback:
  | ((event: { payload?: unknown; kind?: string; path?: string; timestamp?: number }) => void)
  | null = null;

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockImplementation((_event: string, cb: (e: unknown) => void) => {
    // Tauri listen 은 (event, handler) → unlisten 을 반환. handler 는 { payload } 래핑.
    watcherCallback = (raw) => cb({ payload: raw });
    return Promise.resolve(() => undefined);
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));

// useFileSystem 전체 모킹 — openFile 스파이가 호출되는지만 검증.
vi.mock('@/hooks/useFileSystem', () => ({
  useFileSystem: () => ({
    openFolder: vi.fn().mockResolvedValue(undefined),
    openFolderPath: vi.fn().mockResolvedValue(undefined),
    changeFolder: vi.fn().mockResolvedValue(undefined),
    openFile: mockOpenFile,
    saveFileAs: vi.fn().mockResolvedValue(null),
    createFile: vi.fn().mockResolvedValue(undefined),
    deleteNode: vi.fn().mockResolvedValue(undefined),
    renameNode: vi.fn().mockResolvedValue(undefined),
  }),
}));

// App.tsx 가 더 이상 직접 import 하지 않는 readFile 모킹(현재 구현 잔재 검거용)
vi.mock('@/lib/tauri/ipc', () => ({
  readFile: mockReadFile,
}));

// AppLayout 은 무거운 컴포넌트이므로 App 렌더 자체는 AppLayout 모킹으로 가볍게 유지.
// (본 테스트의 관심은 App.tsx 의 useFileWatcher onFileChanged 콜백 라우팅)
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: () => null,
}));

// 가드 스텁 — dirty=true 케이스에서 requestWatcherConflict 가 즉시 콜백을 실행하도록.
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({
    open: false,
    title: '',
    message: null,
    actions: [],
    requestGuardedAction: (fn: () => void) => fn(),
    requestWatcherConflict: (fn: () => void) => fn(),
    requestClose: (fn: () => void) => fn(),
    onAction: vi.fn().mockResolvedValue(undefined),
  }),
  GuardContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

vi.mock('@/hooks/useWindowCloseGuard', () => ({
  useWindowCloseGuard: () => undefined,
}));

import App from '../App';

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('SPEC-IMG-LOAD-001 REQ-B-003 (UT-B3): 워쳐 reload 크기 가드', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    watcherCallback = null;
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
  });
  afterEach(cleanup);

  it('UT-B3a: dirty=false + 현재 파일 Modified → openFile 경유, readFile 직접 호출 배제', async () => {
    useEditorStore.setState({ currentFilePath: '/project/large.md', dirty: false });

    render(<App />);
    await flushPromises();
    expect(watcherCallback).not.toBeNull();

    await act(async () => {
      watcherCallback!({ kind: 'Modified', path: '/project/large.md', timestamp: 0 });
      await flushPromises();
    });

    expect(mockOpenFile).toHaveBeenCalledWith('/project/large.md');
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('UT-B3b: dirty=true + 현재 파일 Modified → 가드 경유 openFile 호출, readFile 배제', async () => {
    useEditorStore.setState({ currentFilePath: '/project/large.md', dirty: true });

    render(<App />);
    await flushPromises();

    await act(async () => {
      watcherCallback!({ kind: 'Modified', path: '/project/large.md', timestamp: 0 });
      await flushPromises();
    });

    expect(mockOpenFile).toHaveBeenCalledWith('/project/large.md');
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('UT-B3c: 다른 파일 Modified 이벤트 → openFile 미호출 (현재 파일이 아닐 때 no-op)', async () => {
    useEditorStore.setState({ currentFilePath: '/project/current.md', dirty: false });
    render(<App />);
    await flushPromises();

    await act(async () => {
      watcherCallback!({ kind: 'Modified', path: '/project/other.md', timestamp: 0 });
      await flushPromises();
    });

    expect(mockOpenFile).not.toHaveBeenCalled();
  });

  it('UT-B3d: Created 이벤트 → openFile 미호출 (Modified 전용)', async () => {
    useEditorStore.setState({ currentFilePath: '/project/current.md', dirty: false });
    render(<App />);
    await flushPromises();

    await act(async () => {
      watcherCallback!({ kind: 'Created', path: '/project/current.md', timestamp: 0 });
      await flushPromises();
    });

    expect(mockOpenFile).not.toHaveBeenCalled();
  });
});
