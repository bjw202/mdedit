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
import { writeFile } from '@/lib/tauri/ipc';
import { createMarkdownExtensions } from './extensions/markdown-extensions';

/**
 * MarkdownEditor - CodeMirror 6 based Markdown editor component.
 *
 * Responsibilities:
 * - Initialize CodeMirror 6 EditorView with Markdown extension bundle
 * - Sync content changes and cursor position to editorStore
 * - Handle Ctrl+S / Cmd+S to save file via Tauri writeFile IPC
 * - Ctrl+F / Cmd+F: open CodeMirror search panel
 * - Cleanup EditorView on unmount (prevent memory leak)
 */
export function MarkdownEditor(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const content = useEditorStore((s) => s.content);
  const currentFilePath = useEditorStore((s) => s.currentFilePath);
  const setContent = useEditorStore((s) => s.setContent);
  const setCursor = useEditorStore((s) => s.setCursor);
  const setDirty = useEditorStore((s) => s.setDirty);

  // Use refs for values used inside the one-time useEffect to avoid stale closures
  const currentFilePathRef = useRef(currentFilePath);
  const setContentRef = useRef(setContent);
  const setCursorRef = useRef(setCursor);
  const setDirtyRef = useRef(setDirty);
  // Flag to skip dirty-marking when content is set externally (e.g., file open)
  const isExternalUpdateRef = useRef(false);

  // Keep refs in sync with latest values
  useEffect(() => { currentFilePathRef.current = currentFilePath; }, [currentFilePath]);
  useEffect(() => { setContentRef.current = setContent; }, [setContent]);
  useEffect(() => { setCursorRef.current = setCursor; }, [setCursor]);
  useEffect(() => { setDirtyRef.current = setDirty; }, [setDirty]);

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

    // @MX:NOTE: [AUTO] EditorView initialization - createMarkdownExtensions provides the full extension bundle
    const editorSaveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: (view) => {
          const filePath = currentFilePathRef.current;
          if (filePath) {
            const docContent = view.state.doc.toString();
            writeFile(filePath, docContent)
              .then(() => {
                setDirtyRef.current(false);
              })
              .catch(() => {
                // Save failed silently - dirty flag remains true
              });
          }
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
      }

      if (update.selectionSet || update.docChanged) {
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        setCursorRef.current(line.number, head - line.from + 1);
      }
    });

    const startState = EditorState.create({
      doc: content,
      extensions: [
        ...createMarkdownExtensions(),
        editorSaveKeymap,
        updateListener,
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

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
