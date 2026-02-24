// @MX:NOTE: [AUTO] App root - integrates useFileWatcher for external file change detection
// @MX:SPEC: SPEC-FS-002

import { AppLayout } from './components/layout/AppLayout';
import { useFileWatcher } from '@/hooks/useFileWatcher';
import { useEditorStore } from '@/store/editorStore';
import { readFile } from '@/lib/tauri/ipc';

function App(): JSX.Element {
  const currentFilePath = useEditorStore((s) => s.currentFilePath);
  const setContent = useEditorStore((s) => s.setContent);

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
