// @MX:NOTE: [AUTO] CodeMirror 6 integration - main editor component
// Initializes EditorView with Markdown extensions, syncs state to editorStore,
// handles Ctrl+S save via Tauri IPC, and cleans up on unmount.
// @MX:WARN: EditorView.destroy() must be called on unmount to prevent memory leak
// @MX:REASON: [AUTO] CodeMirror EditorView holds DOM references and event listeners; not destroying causes leak

import { useEffect, useRef } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { openSearchPanel } from '@codemirror/search';
import { useEditorStore } from '@/store/editorStore';
import { useUIStore } from '@/store/uiStore';
import { writeFile, saveFileAs } from '@/lib/tauri/ipc';
import { createMarkdownExtensions, cursorCompartment, createCursorTheme } from './extensions/markdown-extensions';
import { handleImagePaste, handleImageDrop, insertImageFromDialog } from '@/lib/image/imageHandler';

interface MarkdownEditorProps {
  /** Callback invoked with the EditorView instance after initialization */
  onViewReady?: (view: EditorView) => void;
}

/**
 * MarkdownEditor - CodeMirror 6 based Markdown editor component.
 *
 * Responsibilities:
 * - Initialize CodeMirror 6 EditorView with Markdown extension bundle
 * - Sync content changes and cursor position to editorStore
 * - Handle Ctrl+S / Cmd+S to save file via Tauri writeFile IPC
 * - Handle Ctrl+Shift+S / Cmd+Shift+S to save as via Tauri save dialog
 * - Handle Ctrl+N / Cmd+N to create new file (reset editor)
 * - Ctrl+F / Cmd+F: open CodeMirror search panel
 * - Cleanup EditorView on unmount (prevent memory leak)
 * - Notify parent via onViewReady when EditorView is created
 */
export function MarkdownEditor({ onViewReady }: MarkdownEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const content = useEditorStore((s) => s.content);
  const currentFilePath = useEditorStore((s) => s.currentFilePath);
  const setContent = useEditorStore((s) => s.setContent);
  const setCursor = useEditorStore((s) => s.setCursor);
  const setDirty = useEditorStore((s) => s.setDirty);
  const setCurrentFilePath = useEditorStore((s) => s.setCurrentFilePath);
  const resetEditor = useEditorStore((s) => s.resetEditor);

  // Subscribe to theme so cursor color updates when user switches dark/light mode
  const theme = useUIStore((s) => s.theme);

  // Use refs for values used inside the one-time useEffect to avoid stale closures
  const currentFilePathRef = useRef(currentFilePath);
  const setContentRef = useRef(setContent);
  const setCursorRef = useRef(setCursor);
  const setDirtyRef = useRef(setDirty);
  const setCurrentFilePathRef = useRef(setCurrentFilePath);
  const resetEditorRef = useRef(resetEditor);
  const onViewReadyRef = useRef(onViewReady);
  // Flag to skip dirty-marking when content is set externally (e.g., file open)
  const isExternalUpdateRef = useRef(false);

  // Keep refs in sync with latest values
  useEffect(() => { currentFilePathRef.current = currentFilePath; }, [currentFilePath]);
  useEffect(() => { setContentRef.current = setContent; }, [setContent]);
  useEffect(() => { setCursorRef.current = setCursor; }, [setCursor]);
  useEffect(() => { setDirtyRef.current = setDirty; }, [setDirty]);
  useEffect(() => { setCurrentFilePathRef.current = setCurrentFilePath; }, [setCurrentFilePath]);
  useEffect(() => { resetEditorRef.current = resetEditor; }, [resetEditor]);
  useEffect(() => { onViewReadyRef.current = onViewReady; }, [onViewReady]);

  // Reconfigure cursor color when theme changes (dark ↔ light)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const isDark = document.documentElement.classList.contains('dark');
    view.dispatch({ effects: cursorCompartment.reconfigure(createCursorTheme(isDark)) });
  }, [theme]);

  // Sync external content changes (file open) into the CodeMirror editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== content) {
      isExternalUpdateRef.current = true;
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: content },
      });
    }
  }, [content]);

  useEffect(() => {
    if (!containerRef.current) return;

    const setSaveStatus = useUIStore.getState().setSaveStatus;

    // @MX:NOTE: [AUTO] EditorView initialization - createMarkdownExtensions provides the full extension bundle
    const editorSaveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: (view) => {
          const filePath = currentFilePathRef.current;
          if (filePath) {
            const docContent = view.state.doc.toString();
            setSaveStatus('saving');
            writeFile(filePath, docContent)
              .then(() => {
                setDirtyRef.current(false);
                useUIStore.getState().setSaveStatus('saved');
              })
              .catch(() => {
                // Save failed - revert to unsaved
                useUIStore.getState().setSaveStatus('unsaved');
              });
          }
          return true;
        },
        preventDefault: true,
      },
      {
        key: 'Mod-Shift-s',
        run: (view) => {
          const docContent = view.state.doc.toString();
          useUIStore.getState().setSaveStatus('saving');
          saveFileAs(docContent)
            .then((savedPath) => {
              if (savedPath !== null) {
                setCurrentFilePathRef.current(savedPath);
                setDirtyRef.current(false);
                useUIStore.getState().setSaveStatus('saved');
              } else {
                // User cancelled - restore previous status
                const isDirty = useEditorStore.getState().dirty;
                useUIStore.getState().setSaveStatus(isDirty ? 'unsaved' : 'saved');
              }
            })
            .catch(() => {
              useUIStore.getState().setSaveStatus('unsaved');
            });
          return true;
        },
        preventDefault: true,
      },
      {
        key: 'Mod-n',
        run: () => {
          resetEditorRef.current();
          useUIStore.getState().setSaveStatus('new');
          return true;
        },
        preventDefault: true,
      },
      {
        key: 'Mod-f',
        run: (view) => {
          openSearchPanel(view);
          return true;
        },
        preventDefault: true,
      },
      {
        key: 'Mod-Shift-i',
        run: (view) => {
          const filePath = currentFilePathRef.current;
          if (!filePath) {
            // Unsaved file - trigger Save As first
            const docContent = view.state.doc.toString();
            saveFileAs(docContent).then((savedPath) => {
              if (savedPath) {
                setCurrentFilePathRef.current(savedPath);
                setDirtyRef.current(false);
                useUIStore.getState().setSaveStatus('saved');
                insertImageFromDialog(view, savedPath);
              }
            });
          } else {
            insertImageFromDialog(view, filePath);
          }
          return true;
        },
        preventDefault: true,
      },
    ]);

    // Update listener syncs content changes and cursor position to editorStore
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        // Skip dirty-marking for external updates (e.g., file open dispatched above)
        if (isExternalUpdateRef.current) {
          isExternalUpdateRef.current = false;
          return;
        }
        const newContent = update.state.doc.toString();
        setContentRef.current(newContent);
        setDirtyRef.current(true);
        useUIStore.getState().setSaveStatus('unsaved');
      }

      if (update.selectionSet || update.docChanged) {
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        setCursorRef.current(line.number, head - line.from + 1);
      }
    });

    // Image paste/drop event handlers
    const imageEventHandlers = EditorView.domEventHandlers({
      paste(event: ClipboardEvent, view: EditorView) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const hasImage = Array.from(items).some((item) => item.type.startsWith('image/'));
        if (!hasImage) return false;

        const filePath = currentFilePathRef.current;
        if (!filePath) {
          // Unsaved file - prompt Save As first
          event.preventDefault();
          const docContent = view.state.doc.toString();
          saveFileAs(docContent).then((savedPath) => {
            if (savedPath) {
              setCurrentFilePathRef.current(savedPath);
              setDirtyRef.current(false);
              useUIStore.getState().setSaveStatus('saved');
              handleImagePaste(view, event, savedPath);
            }
          });
          return true;
        }

        event.preventDefault();
        handleImagePaste(view, event, filePath);
        return true;
      },
      drop(event: DragEvent, view: EditorView) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const hasImage = Array.from(files).some((f) => f.type.startsWith('image/'));
        if (!hasImage) return false;

        const filePath = currentFilePathRef.current;
        if (!filePath) {
          event.preventDefault();
          const docContent = view.state.doc.toString();
          saveFileAs(docContent).then((savedPath) => {
            if (savedPath) {
              setCurrentFilePathRef.current(savedPath);
              setDirtyRef.current(false);
              useUIStore.getState().setSaveStatus('saved');
              handleImageDrop(view, event, savedPath);
            }
          });
          return true;
        }

        event.preventDefault();
        handleImageDrop(view, event, filePath);
        return true;
      },
    });

    const startState = EditorState.create({
      doc: content,
      extensions: [
        ...createMarkdownExtensions(),
        editorSaveKeymap,
        updateListener,
        imageEventHandlers,
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Notify parent that the EditorView is ready
    onViewReadyRef.current?.(view);

    // Cleanup: destroy EditorView on unmount to prevent memory leak
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Initialize only once on mount; store actions accessed via refs

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      data-testid="markdown-editor"
    />
  );
}
