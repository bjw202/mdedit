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
import { useFileStore } from '@/store/fileStore';
import { useUIStore } from '@/store/uiStore';
import { saveFileAs } from '@/lib/tauri/ipc';
import { saveDocument } from '@/lib/save/saveDocument';
import { useGuard } from '@/hooks/useUnsavedChangesGuard';
import { createMarkdownExtensions, cursorCompartment, createCursorTheme, fontSizeCompartment, createFontSizeTheme } from './extensions/markdown-extensions';
import { handleImagePaste, handleImageDrop, insertImageFromDialog, decideImageInsert, extractImageFile, insertImageFile } from '@/lib/image/imageHandler';

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

  // Subscribe to fontSize so editor font size updates when user changes it
  const fontSize = useUIStore((s) => s.fontSize);

  // Use refs for values used inside the one-time useEffect to avoid stale closures
  const currentFilePathRef = useRef(currentFilePath);
  const setContentRef = useRef(setContent);
  const setCursorRef = useRef(setCursor);
  const setDirtyRef = useRef(setDirty);
  const setCurrentFilePathRef = useRef(setCurrentFilePath);
  const resetEditorRef = useRef(resetEditor);
  const onViewReadyRef = useRef(onViewReady);

  // SPEC-FS-003 T7 (REQ-013): Mod-n 가드. AppLayout의 GuardContext에서 제공(단일 인스턴스).
  //   격이 렌더(Provider 없음)에서는 null → 직접 resetEditor.
  const guard = useGuard();
  const requestNewGuardRef = useRef(guard?.requestGuardedAction ?? null);
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
  useEffect(() => { requestNewGuardRef.current = guard?.requestGuardedAction ?? null; }, [guard]);

  // Reconfigure font size when user changes it via A+/A- buttons
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: fontSizeCompartment.reconfigure(createFontSizeTheme(fontSize)) });
  }, [fontSize]);

  // Reconfigure cursor color when theme changes (dark ↔ light).
  // Derives isDark from the store value to avoid React effect ordering issues:
  // MarkdownEditor (child) effects run before AppLayout (parent) useTheme() effect,
  // so document.documentElement.classList.contains('dark') is unreliable at this point.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
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

    // @MX:NOTE: [AUTO] EditorView initialization - createMarkdownExtensions provides the full extension bundle
    // SPEC-FS-003 T4 (REQ-009): Mod-s / Mod-Shift-s 모두 단일 saveDocument()로 수렴.
    //   에디터 updateListener(:222-233)가 docChanged마다 동기적으로 editorStore.content를 갱신하므로
    //   saveDocument가 읽는 store content는 항상 최신이다(view.state.doc 우회 불필요).
    const editorSaveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          void saveDocument();
          return true;
        },
        preventDefault: true,
      },
      {
        key: 'Mod-Shift-s',
        // REQ-FS-003-041~044: Mod-Shift-s는 Save As — 기존 파일이 있어도 항상 다이얼로그를 띄운다.
        run: () => {
          void saveDocument({ forceDialog: true });
          return true;
        },
        preventDefault: true,
      },
      {
        key: 'Mod-n',
        run: () => {
          // SPEC-FS-003 REQ-013: 새 문서 전 가드. Provider 없으면 직접 실행(격리 테스트 호환).
          const doNewDoc = (): void => {
            resetEditorRef.current();
            useFileStore.getState().setCurrentFile(null);
            useUIStore.getState().setSaveStatus('new');
          };
          const guardedNew = requestNewGuardRef.current;
          if (guardedNew) {
            guardedNew(doNewDoc);
          } else {
            doNewDoc();
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
                useFileStore.getState().setCurrentFile(savedPath);
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

        const filePath = currentFilePathRef.current;
        const decision = decideImageInsert({
          hasImage: Array.from(items).some((item) => item.type.startsWith('image/')),
          hasPlainText: (event.clipboardData?.getData('text/plain') ?? '') !== '',
          mode: useUIStore.getState().imageInsertMode,
          hasFilePath: filePath !== null,
        });

        // 텍스트 붙여넣기 등 — CodeMirror 기본 동작에 맡긴다.
        if (decision === 'ignore') return false;

        event.preventDefault();

        if (decision === 'insert') {
          // inline-blob 은 경로를 쓰지 않고, file-save 는 여기서 filePath 가 반드시 있다.
          handleImagePaste(view, event, filePath ?? '');
          return true;
        }

        // require-file-path: file-save 모드 + 미저장 문서 — 저장 위치를 먼저 받는다.
        //
        // 대화상자를 띄우면 이 핸들러는 즉시 반환되고 브라우저가 clipboardData 를
        // 무효화한다. 따라서 기다리기 전에 이미지를 지금 꺼내 둔다.
        const pendingImage = extractImageFile(event);
        const docContent = view.state.doc.toString();
        saveFileAs(docContent).then((savedPath) => {
          if (savedPath) {
            setCurrentFilePathRef.current(savedPath);
            useFileStore.getState().setCurrentFile(savedPath);
            setDirtyRef.current(false);
            useUIStore.getState().setSaveStatus('saved');
            if (pendingImage) {
              insertImageFile(view, pendingImage, savedPath);
            }
          }
        });
        return true;
      },
      // @MX:NOTE: drop 은 paste 와 달리 decideImageInsert 를 쓰지 않는다.
      // handleImageDrop 은 imageInsertMode 와 무관하게 항상 copyImageToFolder /
      // saveImageFromClipboard 로 기준 경로를 요구하므로, inline-blob 이라고 경로 없이
      // 진행시키면 빈 경로가 넘어가 깨진다. 또 드롭은 dataTransfer.files 만 보므로
      // 텍스트/이미지 flavor 혼동 문제도 없다.
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
              useFileStore.getState().setCurrentFile(savedPath);
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

    // Apply correct initial cursor color using store state (not DOM class) because
    // useTheme() runs in the parent component after this child's effects complete.
    const initTheme = useUIStore.getState().theme;
    const initIsDark =
      initTheme === 'dark' ||
      (initTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    view.dispatch({ effects: cursorCompartment.reconfigure(createCursorTheme(initIsDark)) });

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
    // SPEC-UI-006: .md-editor applies chrome-only tokens (font/line-height/color via CSS;
    // gutter/selection colors are bridged through the existing --cm-* variables in index.css,
    // which now also draw from --md-* tokens). CodeMirror extensions/logic are untouched —
    // this component still just owns the mount container.
    <div
      ref={containerRef}
      className="md-editor h-full w-full overflow-hidden"
      data-testid="markdown-editor"
    />
  );
}
