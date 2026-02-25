// @MX:NOTE: [AUTO] App root - integrates useFileWatcher for external file change detection
// @MX:SPEC: SPEC-FS-002

import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { useFileWatcher } from '@/hooks/useFileWatcher';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useEditorStore } from '@/store/editorStore';
import { useUIStore } from '@/store/uiStore';
import { readFile } from '@/lib/tauri/ipc';

function App(): JSX.Element {
  const currentFilePath = useEditorStore((s) => s.currentFilePath);
  const setContent = useEditorStore((s) => s.setContent);
  const { openFolderPath } = useFileSystem();

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

  useFileWatcher({
    onFileChanged: (event) => {
      // Auto-reload if the currently open file was modified externally
      if (event.kind === 'Modified' && event.path === currentFilePath) {
        void readFile(event.path).then((content) => setContent(content));
      }
    },
  });

  return <AppLayout />;
}

export default App;
