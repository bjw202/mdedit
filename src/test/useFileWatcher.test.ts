// @MX:SPEC: SPEC-FS-002
// Tests for useFileWatcher hook - filesystem watcher integration with Tauri events

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock Tauri event API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

// Mock Tauri core invoke API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useFileWatcher } from '@/hooks/useFileWatcher';

describe('useFileWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listen).mockResolvedValue(vi.fn());
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return isWatching, startWatch, and stopWatch', () => {
    const { result } = renderHook(() =>
      useFileWatcher({ onFileChanged: vi.fn() }),
    );

    expect(typeof result.current.isWatching).toBe('boolean');
    expect(typeof result.current.startWatch).toBe('function');
    expect(typeof result.current.stopWatch).toBe('function');
  });

  it('should start with isWatching = false', () => {
    const { result } = renderHook(() =>
      useFileWatcher({ onFileChanged: vi.fn() }),
    );

    expect(result.current.isWatching).toBe(false);
  });

  it('should register a file-changed listener on mount', async () => {
    renderHook(() => useFileWatcher({ onFileChanged: vi.fn() }));

    // Allow microtasks to complete
    await act(async () => {
      await Promise.resolve();
    });

    expect(listen).toHaveBeenCalledWith('file-changed', expect.any(Function));
  });

  it('should call cleanup (unlisten) on unmount', async () => {
    const mockUnlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(mockUnlisten);

    const { unmount } = renderHook(() =>
      useFileWatcher({ onFileChanged: vi.fn() }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(mockUnlisten).toHaveBeenCalledTimes(1);
  });

  it('startWatch: should invoke start_watch command with path', async () => {
    const { result } = renderHook(() =>
      useFileWatcher({ onFileChanged: vi.fn() }),
    );

    await act(async () => {
      await result.current.startWatch('/test/path');
    });

    expect(invoke).toHaveBeenCalledWith('start_watch', { path: '/test/path' });
  });

  it('startWatch: should set isWatching to true', async () => {
    const { result } = renderHook(() =>
      useFileWatcher({ onFileChanged: vi.fn() }),
    );

    await act(async () => {
      await result.current.startWatch('/test/path');
    });

    expect(result.current.isWatching).toBe(true);
  });

  it('stopWatch: should invoke stop_watch command', async () => {
    const { result } = renderHook(() =>
      useFileWatcher({ onFileChanged: vi.fn() }),
    );

    await act(async () => {
      await result.current.startWatch('/test/path');
      await result.current.stopWatch();
    });

    expect(invoke).toHaveBeenCalledWith('stop_watch');
  });

  it('stopWatch: should set isWatching to false', async () => {
    const { result } = renderHook(() =>
      useFileWatcher({ onFileChanged: vi.fn() }),
    );

    await act(async () => {
      await result.current.startWatch('/test/path');
      await result.current.stopWatch();
    });

    expect(result.current.isWatching).toBe(false);
  });

  it('should not listen when enabled=false', async () => {
    renderHook(() =>
      useFileWatcher({ onFileChanged: vi.fn(), enabled: false }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(listen).not.toHaveBeenCalled();
  });

  it('should call onFileChanged when a file-changed event is received', async () => {
    const onFileChanged = vi.fn();
    // Use 'unknown' for the mock implementation to avoid type coupling with Tauri internals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedHandler: ((event: any) => void) | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(listen).mockImplementation(async (_event: string, handler: any) => {
      capturedHandler = handler;
      return vi.fn();
    });

    renderHook(() => useFileWatcher({ onFileChanged }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedHandler).not.toBeNull();

    const mockEvent = {
      kind: 'Modified' as const,
      path: '/test/file.md',
      timestamp: 1234567890,
    };

    act(() => {
      capturedHandler!({ payload: mockEvent });
    });

    expect(onFileChanged).toHaveBeenCalledWith(mockEvent);
  });

  it('startWatch: should do nothing when enabled=false', async () => {
    const { result } = renderHook(() =>
      useFileWatcher({ onFileChanged: vi.fn(), enabled: false }),
    );

    await act(async () => {
      await result.current.startWatch('/test/path');
    });

    expect(invoke).not.toHaveBeenCalled();
    expect(result.current.isWatching).toBe(false);
  });
});
