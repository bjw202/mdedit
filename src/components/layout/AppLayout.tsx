import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/store/uiStore';
import { Header } from './Header';
import { Footer } from './Footer';
import { ResizablePanels } from './ResizablePanels';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { FileExplorer } from '@/components/sidebar/FileExplorer';
import { MarkdownPreview } from '@/components/preview/MarkdownPreview';

// Editor panel with toolbar and CodeMirror editor
function EditorPanel(): JSX.Element {
  return (
    <div className="h-full flex flex-col">
      <EditorToolbar />
      <div className="flex-1 overflow-hidden">
        <MarkdownEditor />
      </div>
    </div>
  );
}

// @MX:NOTE: Root layout component - composes Header, 3-pane panels, Footer
// Entry point for the entire application UI shell
export function AppLayout(): JSX.Element {
  useTheme(); // Apply theme side effects

  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-gray-900 overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar toggle button */}
        <button
          onClick={toggleSidebar}
          className="absolute left-2 top-2 z-10 p-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <ResizablePanels
          sidebar={<FileExplorer />}
          editor={<EditorPanel />}
          preview={<MarkdownPreview />}
        />
      </div>
      <Footer />
    </div>
  );
}
