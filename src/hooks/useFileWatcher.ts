// @MX:ANCHOR: [AUTO] useFileWatcher - React hook for Tauri filesystem change events
// @MX:REASON: [AUTO] Used by App.tsx for auto-reload and potentially other consumers (fan_in >= 2)
// @MX:SPEC: SPEC-FS-002

import { useEffect, useRef, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

/** The kind of filesystem change that occurred. */
export type FileChangeKind = 'Created' | 'Modified' | 'Deleted' | 'Renamed';

/** Event payload emitted by the Rust watcher when a file changes. */
export interface FileChangedEvent {
  kind: FileChangeKind;
  path: string;
  timestamp: number;
}

/** Options for configuring useFileWatcher. */
export interface UseFileWatcherOptions {
  /** Callback invoked for each filesystem change event. */
  onFileChanged: (event: FileChangedEvent) => void;
  /**
   * When false, the listener is not registered and commands are not invoked.
   * Defaults to true.
   */
  enabled?: boolean;
}

/** Return value of useFileWatcher. */
export interface UseFileWatcherResult {
  /** True when a watch is currently active (start_watch was called successfully). */
  isWatching: boolean;
  /** Starts watching the given directory path and sets isWatching to true. */
  startWatch: (path: string) => Promise<void>;
  /** Stops the current watcher and sets isWatching to false. */
  stopWatch: () => Promise<void>;
}

/**
 * Registers a Tauri `file-changed` event listener and exposes startWatch/stopWatch
 * commands. Cleans up the listener on unmount.
 *
 * @example
 * const { isWatching, startWatch } = useFileWatcher({
 *   onFileChanged: (event) => console.log('changed', event.path),
 * });
 */
export function useFileWatcher({
  onFileChanged,
  enabled = true,
}: UseFileWatcherOptions): UseFileWatcherResult {
  const [isWatching, setIsWatching] = useState<boolean>(false);

  // Keep a stable ref to the callback to avoid re-registering the listener
  // when the parent component re-renders with a new inline function.
  const onFileChangedRef = useRef(onFileChanged);
  useEffect(() => {
    onFileChangedRef.current = onFileChanged;
  }, [onFileChanged]);

  useEffect(() => {
    if (!enabled) return;

    let unlisten: (() => void) | null = null;

    const register = async (): Promise<void> => {
      unlisten = await listen<FileChangedEvent>('file-changed', (event) => {
        onFileChangedRef.current(event.payload);
      });
    };

    void register();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [enabled]);

  const startWatch = useCallback(
    async (path: string): Promise<void> => {
      if (!enabled) return;
      await invoke<void>('start_watch', { path });
      setIsWatching(true);
    },
    [enabled],
  );

  const stopWatch = useCallback(async (): Promise<void> => {
    await invoke<void>('stop_watch');
    setIsWatching(false);
  }, []);

  return { isWatching, startWatch, stopWatch };
}
