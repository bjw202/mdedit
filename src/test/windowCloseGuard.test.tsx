// @MX:SPEC: SPEC-FS-003
// 윈도우 종료 가드 단위 테스트 (REQ-018/019/020) — @tauri-apps/api/window 모킹
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { useWindowCloseGuard } from '@/hooks/useWindowCloseGuard';
import { useEditorStore } from '@/store/editorStore';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

// onCloseRequested 핸들러를 캡처하기 위한 모킹
const mockDestroy = vi.fn().mockResolvedValue(undefined);
let capturedCloseHandler: ((event: { preventDefault: () => void }) => void | Promise<void>) | null = null;
const mockOnCloseRequested = vi.fn().mockImplementation((handler) => {
  capturedCloseHandler = handler;
  return Promise.resolve(() => { capturedCloseHandler = null; });
});

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: mockOnCloseRequested,
    destroy: mockDestroy,
  }),
}));

function TestComponent({ requestClose }: { requestClose: (a: () => void | Promise<void>) => void }): JSX.Element {
  useWindowCloseGuard(requestClose);
  return <div />;
}

describe('useWindowCloseGuard (REQ-018/019/020)', () => {
  beforeEach(() => {
    capturedCloseHandler = null;
    mockDestroy.mockClear();
    mockOnCloseRequested.mockClear();
    // Tauri 런타임 존재 시뮬레이션
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: 'main' } } };
    useEditorStore.setState({ dirty: false, content: '', currentFilePath: null, cursorLine: 1, cursorCol: 1 });
  });
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('dirty=false면 preventDefault 없이 통과한다 (REQ-019)', async () => {
    const requestClose = vi.fn();
    await act(async () => { render(<TestComponent requestClose={requestClose} />); });
    expect(capturedCloseHandler).not.toBeNull();
    const preventDefault = vi.fn();
    await act(async () => { await capturedCloseHandler!({ preventDefault }); });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(requestClose).not.toHaveBeenCalled();
  });

  it('dirty=true면 preventDefault + requestClose로 종료 가드를 연다 (REQ-020)', async () => {
    useEditorStore.setState({ dirty: true });
    const requestClose = vi.fn();
    await act(async () => { render(<TestComponent requestClose={requestClose} />); });
    const preventDefault = vi.fn();
    await act(async () => { await capturedCloseHandler!({ preventDefault }); });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(requestClose).toHaveBeenCalledTimes(1);
    // requestClose에 전달된 closeAction이 destroy를 호출하는지
    const closeAction = requestClose.mock.calls[0][0] as () => Promise<void>;
    await act(async () => { await closeAction(); });
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('Tauri 런타임이 없으면(__TAURI_INTERNALS__ 부재) 리스너를 등록하지 않는다 (Vite dev/jsdom 안전)', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    const requestClose = vi.fn();
    await act(async () => { render(<TestComponent requestClose={requestClose} />); });
    expect(mockOnCloseRequested).not.toHaveBeenCalled();
  });

  it('capabilities/main.json 에 core:window:allow-destroy 포함 (close 가드 전제 — 누락 시 destroy() 권한 거부로 창이 안 닫힘, REQ-018/019/020)', () => {
    const caps = JSON.parse(
      readFileSync(resolve(repoRoot, 'src-tauri', 'capabilities', 'main.json'), 'utf-8'),
    ) as { permissions: string[] };
    // core:window:default 는 읽기/조회 권한만 포함(allow-get-*/allow-is-* 등). destroy 는 별도
    // explicit 권한 — 없으면 getCurrentWindow().destroy() 가 권한 거부로 창을 닫지 못한다.
    expect(caps.permissions).toContain('core:window:allow-destroy');
  });
});
