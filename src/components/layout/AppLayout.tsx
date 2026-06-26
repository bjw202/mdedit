import { useRef, useMemo, useState, useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/store/uiStore';
import { useEditorStore } from '@/store/editorStore';
import { useFileStore } from '@/store/fileStore';
import { writeFile, saveFileAs as saveFileAsIpc } from '@/lib/tauri/ipc';
import { exportToHtml } from '@/lib/export/exportHtml';
import { exportToPdf } from '@/lib/export/exportPdf';
import { exportToDocx } from '@/lib/export/exportDocx';
import { getHighlighter } from '@/lib/markdown/codeHighlight';
import { Header } from './Header';
import { Footer } from './Footer';
import { ResizablePanels } from './ResizablePanels';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import type { FormatAction } from '@/components/editor/EditorToolbar';
import { FileExplorer } from '@/components/sidebar/FileExplorer';
import { PreviewContainer } from '@/components/preview/PreviewContainer';
import { wrapSelection, prefixLine } from '@/components/editor/extensions/keyboard-shortcuts';
import { useScrollSync } from '@/hooks/useScrollSync';
import { insertImageFromDialog } from '@/lib/image/imageHandler';
import { getFileViewType } from '@/components/preview/PreviewContainer';

// @MX:NOTE: Root layout component - composes Header, 3-pane panels, Footer
// Entry point for the entire application UI shell
export function AppLayout(): JSX.Element {
  useTheme(); // Apply theme side effects

  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const saveStatus = useUIStore((s) => s.saveStatus);
  const scrollSyncEnabled = useUIStore((s) => s.scrollSyncEnabled);
  const toggleScrollSync = useUIStore((s) => s.toggleScrollSync);

  const currentFile = useFileStore((s) => s.currentFile);
  const watchedPath = useFileStore((s) => s.watchedPath);
  // Handle both Unix ('/') and Windows ('\') path separators
  const filename = currentFile ? (currentFile.split(/[/\\]/).pop() ?? 'Untitled') : 'Untitled';

  const handleSaveAs = async (): Promise<void> => {
    const { content } = useEditorStore.getState();
    useUIStore.getState().setSaveStatus('saving');
    // Default save dialog to the currently open explorer folder, if any
    const defaultDir = watchedPath ?? undefined;
    try {
      const savedPath = await saveFileAsIpc(content, defaultDir);
      if (savedPath !== null) {
        useEditorStore.getState().setCurrentFilePath(savedPath);
        useFileStore.getState().setCurrentFile(savedPath);
        useEditorStore.getState().setDirty(false);
        useUIStore.getState().setSaveStatus('saved');
      } else {
        const isDirty = useEditorStore.getState().dirty;
        useUIStore.getState().setSaveStatus(isDirty ? 'unsaved' : 'saved');
      }
    } catch {
      useUIStore.getState().setSaveStatus('unsaved');
    }
  };

  const handleSave = async (): Promise<void> => {
    const { content: c, currentFilePath } = useEditorStore.getState();
    if (!currentFilePath) {
      await handleSaveAs();
      return;
    }
    useUIStore.getState().setSaveStatus('saving');
    try {
      await writeFile(currentFilePath, c);
      useEditorStore.getState().setDirty(false);
      useUIStore.getState().setSaveStatus('saved');
    } catch {
      useUIStore.getState().setSaveStatus('unsaved');
    }
  };

  const handleNew = (): void => {
    useEditorStore.getState().resetEditor();
    useFileStore.getState().setCurrentFile(null);
    useUIStore.getState().setSaveStatus('new');
  };

  const content = useEditorStore((s) => s.content);
  const cursorLine = useEditorStore((s) => s.cursorLine);
  const cursorCol = useEditorStore((s) => s.cursorCol);

  const [exportLoading, setExportLoading] = useState(false);
  const themeRaw = useUIStore((s) => s.theme);
  // Resolve 'system' theme to actual light/dark for export CSS
  // 'system' must check OS preference; themeRaw !== 'dark' alone would always export as light
  const exportTheme: 'light' | 'dark' =
    themeRaw === 'dark' ||
    (themeRaw === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';

  // @MX:NOTE: [AUTO] Export handlers for SPEC-EXPORT-001 - HTML/PDF/DOCX export
  const handleExportHtml = useCallback(async (): Promise<void> => {
    setExportLoading(true);
    try {
      const { content: c } = useEditorStore.getState();
      const currentFile = useFileStore.getState().currentFile;
      const highlighter = await getHighlighter();
      await exportToHtml({
        content: c,
        filename: currentFile ?? 'document.md',
        theme: exportTheme,
        highlighter,
        mdFilePath: currentFile,
      });
    } catch (err) {
      console.error('HTML export failed:', err);
      window.alert(`HTML export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportLoading(false);
    }
  }, [exportTheme]);

  const handleExportPdf = useCallback(async (): Promise<void> => {
    setExportLoading(true);
    try {
      const { content: c } = useEditorStore.getState();
      const currentFile = useFileStore.getState().currentFile;
      const highlighter = await getHighlighter();
      await exportToPdf({
        content: c,
        filename: currentFile ?? 'document.md',
        theme: exportTheme,
        highlighter,
        mdFilePath: currentFile,
      });
    } catch (err) {
      console.error('PDF export failed:', err);
      window.alert(`PDF export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportLoading(false);
    }
  }, [exportTheme]);

  const handleExportDocx = useCallback(async (): Promise<void> => {
    setExportLoading(true);
    try {
      const { content: c } = useEditorStore.getState();
      const currentFile = useFileStore.getState().currentFile;
      const highlighter = await getHighlighter();
      await exportToDocx({
        content: c,
        filename: currentFile ?? 'document.md',
        theme: exportTheme,
        highlighter,
        mdFilePath: currentFile,
      });
    } catch (err) {
      console.error('DOCX export failed:', err);
      window.alert(`DOCX export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportLoading(false);
    }
  }, [exportTheme]);

  // EditorView ref - NOT stored in Zustand (REQ-EDITOR002-N04 / REQ-PREVIEW002-N02)
  const viewRef = useRef<EditorView | null>(null);
  // Preview container ref for scroll sync
  const previewRef = useRef<HTMLDivElement>(null);
  // Track current EditorView in state for useScrollSync reactivity
  const [currentView, setCurrentView] = useState<EditorView | null>(null);

  // Activate scroll sync between editor and preview
  useScrollSync(currentView, previewRef, scrollSyncEnabled);

  // Compute word count and char count from editor content
  const wordCount = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter((w) => w.length > 0).length;
  }, [content]);

  const charCount = content.length;

  // Line count derived from content
  const lineCount = useMemo(() => {
    if (!content) return 0;
    return content.split('\n').length;
  }, [content]);

  const handleViewReady = (view: EditorView): void => {
    viewRef.current = view;
    setCurrentView(view);
  };

  // @MX:ANCHOR: [AUTO] Format handler - connects EditorToolbar buttons to CodeMirror editor operations
  // @MX:REASON: [AUTO] Central handler used by EditorToolbar and passed to MarkdownEditor (fan_in >= 3)
  const handleFormat = (action: FormatAction): void => {
    const view = viewRef.current;
    if (!view) return;

    switch (action) {
      case 'bold':
        wrapSelection(view, '**', '**');
        break;
      case 'italic':
        wrapSelection(view, '*', '*');
        break;
      case 'code':
        wrapSelection(view, '`', '`');
        break;
      case 'link':
        wrapSelection(view, '[', '](url)');
        break;
      case 'h1':
        prefixLine(view, '# ');
        break;
      case 'h2':
        prefixLine(view, '## ');
        break;
      case 'h3':
        prefixLine(view, '### ');
        break;
      case 'ul':
        prefixLine(view, '- ');
        break;
      case 'ol':
        prefixLine(view, '1. ');
        break;
      case 'quote':
        prefixLine(view, '> ');
        break;
      case 'image': {
        const filePath = useEditorStore.getState().currentFilePath;
        if (!filePath) {
          // Unsaved file - Save As first, then insert image
          const docContent = view.state.doc.toString();
          saveFileAsIpc(docContent).then((savedPath) => {
            if (savedPath) {
              useEditorStore.getState().setCurrentFilePath(savedPath);
              useFileStore.getState().setCurrentFile(savedPath);
              useEditorStore.getState().setDirty(false);
              useUIStore.getState().setSaveStatus('saved');
              insertImageFromDialog(view, savedPath);
            }
          });
        } else {
          insertImageFromDialog(view, filePath);
        }
        break;
      }
    }
  };

  // SPEC-PREVIEW-007: html/binary/too-large 파일은 편집 불가 — isViewOnly로 확장
  // previewStatus를 fileStore에서 읽어 binary/too-large 여부를 판정한다
  const previewStatus = useFileStore((s) => s.previewStatus);
  const viewType = getFileViewType(currentFile, previewStatus);
  const isViewOnly = viewType === 'html' || viewType === 'unsupported';

  // Editor panel: toolbar + editor (inlined to avoid re-creating the component function on every render)
  const editorPanel = (
    <div className="h-full flex flex-col">
      <EditorToolbar onFormat={handleFormat} />
      <div className="flex-1 overflow-hidden">
        {isViewOnly ? (
          // 보기 전용 플레이스홀더 — HTML/바이너리/대용량 파일 편집 불가 안내
          // SPEC-PREVIEW-004: .html, SPEC-PREVIEW-007: binary/too-large
          <div
            className="h-full flex flex-col items-center justify-center gap-2 p-4 text-center select-none bg-gray-50 dark:bg-gray-900"
            data-testid="html-view-only-placeholder"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-gray-300 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              이 형식은 편집할 수 없습니다
            </p>
            <p className="text-xs text-gray-300 dark:text-gray-600">
              {viewType === 'html'
                ? 'HTML 파일은 보기 전용입니다. 프리뷰 패널에서 내용을 확인하세요.'
                : '이 파일은 편집기에서 열 수 없습니다. 프리뷰 패널의 안내를 확인하세요.'}
            </p>
          </div>
        ) : (
          <MarkdownEditor onViewReady={handleViewReady} />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-gray-900 overflow-hidden">
      <Header
        filename={filename}
        isDirty={saveStatus === 'unsaved'}
        content={content}
        onNew={handleNew}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportHtml={handleExportHtml}
        onExportPdf={handleExportPdf}
        onExportDocx={handleExportDocx}
        exportLoading={exportLoading}
      />
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
          editor={editorPanel}
          preview={<PreviewContainer previewRef={previewRef} />}
        />
      </div>
      <Footer
        saveStatus={saveStatus}
        wordCount={wordCount}
        charCount={charCount}
        lineCount={lineCount}
        cursorLine={cursorLine}
        cursorCol={cursorCol}
        scrollSyncEnabled={scrollSyncEnabled}
        onScrollSyncToggle={toggleScrollSync}
      />
    </div>
  );
}
