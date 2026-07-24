import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import type { EditorView } from '@codemirror/view';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/store/uiStore';
import { useEditorStore } from '@/store/editorStore';
import { useFileStore } from '@/store/fileStore';
import { saveFileAs as saveFileAsIpc, aiDetectProviders, aiPolicyStatus, openExportedFile, revealExportedFile } from '@/lib/tauri/ipc';
import { saveDocument } from '@/lib/save/saveDocument';
import { type UseUnsavedChangesGuardReturn, GuardContext } from '@/hooks/useUnsavedChangesGuard';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useAiRelay } from '@/hooks/useAiRelay';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { setAiLoggedIn, registerOnboardingOpener } from '@/components/editor/extensions/ai-suggestion-card';
import { setAiPolicyDisabled } from '@/store/aiPolicy';
import { initAiToggleEffects } from '@/lib/ai/aiOffEffects';
import { initAiFileSwitchEffects } from '@/lib/ai/aiFileSwitchEffects';
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
import { wrapSelection, prefixLine, insertTable, insertDiagram } from '@/components/editor/extensions/keyboard-shortcuts';
import type { DiagramPreset } from '@/components/editor/extensions/keyboard-shortcuts';
import { useScrollSync } from '@/hooks/useScrollSync';
import { insertImageFromDialog } from '@/lib/image/imageHandler';
import { getFileViewType } from '@/components/preview/PreviewContainer';
import { PanelLeftIcon } from '@/components/icons';

interface AppLayoutProps {
  /** 루트(App)에서 인스턴스화한 가드. AppLayout이 ConfirmDialog에 바인딩하고 GuardContext로 공유. */
  guard: UseUnsavedChangesGuardReturn;
}

// @MX:NOTE: Root layout component - composes Header, 3-pane panels, Footer
// Entry point for the entire application UI shell
export function AppLayout({ guard }: AppLayoutProps): JSX.Element {
  useTheme(); // Apply theme side effects

  // SPEC-AI-001 (T-018): ai:// 스트리밍 이벤트를 aiStore 로 릴레이하는 단일 배선.
  useAiRelay();

  // 설정 모달(첫 섹션 AI). Header 톱니 / 카드 로그인 오류(온보딩)가 연다.
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 카드 로그인 만료 오류가 "연결 안내 보기"로 설정 온보딩을 열 수 있게 오프너를 등록한다(REQ-AI-037).
  useEffect(() => {
    registerOnboardingOpener(() => setSettingsOpen(true));
    return () => registerOnboardingOpener(null);
  }, []);

  // 시작 시 로그인·정책 상태를 1회 감지해 캐시한다 — ✨ "연결 필요" 게이팅의 소스(REQ-AI-012/015)이자
  // SPEC-AI-005 effectiveAiEnabled(REQ-AI5-013/014)의 정책 절반이다(getAiLoggedIn 세팅 지점 옆).
  // SPEC-AI-009: 자동 감지 우선순위(claude > codex)를 반영한다. claude 가 사용 가능하면 claude,
  // 아니면 codex 를 fallback 으로 삼고, 둘 다 없으면 claude 기준(기존 동작)을 유지한다 —
  // 클라라가 없고 codex 만 설치+로그인된 사용자도 ✨ 툴바가 "연결 필요"로 막히지 않아야 한다.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([aiDetectProviders(), aiPolicyStatus()])
      .then(([providers, policy]) => {
        if (cancelled) return;
        const claude = providers.find((p) => p.id === 'claude');
        const codex = providers.find((p) => p.id === 'codex');
        const effective = claude?.installed && claude.loggedIn ? claude
                        : codex?.installed && codex.loggedIn ? codex
                        : claude;
        setAiLoggedIn(effective?.loggedIn ?? false);
        setAiPolicyDisabled(policy.disabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // SPEC-AI-005 REQ-AI5-011: aiEnabled ON→OFF 전이를 앱 수명 동안 관찰해 in-flight 취소 +
  // 고스트/카드 정리를 수행한다. 마운트 1회 등록, 언마운트 시 해제.
  useEffect(() => {
    return initAiToggleEffects();
  }, []);

  // SPEC-AI-009 REQ-AI9-033/034: 활성 문서 전환(결함 3a)을 앱 수명 동안 관찰해 in-flight 취소 +
  // 고스트/카드 정리를 수행한다. 마운트 1회 등록, 언마운트 시 해제(initAiToggleEffects 와 동일 형태).
  useEffect(() => {
    return initAiFileSwitchEffects();
  }, []);

  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const saveStatus = useUIStore((s) => s.saveStatus);
  const scrollSyncEnabled = useUIStore((s) => s.scrollSyncEnabled);
  const toggleScrollSync = useUIStore((s) => s.toggleScrollSync);

  const currentFile = useFileStore((s) => s.currentFile);
  // Handle both Unix ('/') and Windows ('\') path separators
  const filename = currentFile ? (currentFile.split(/[/\\]/).pop() ?? 'Untitled') : 'Untitled';

  // SPEC-FS-003 T4 (REQ-009): 저장 단일 함수로 수렴. 헤더 Save/Save As 양쪽 모두 saveDocument 위임.
  // REQ-FS-003-041~044: Save As는 기존 파일이 있어도 항상 다이얼로그를 띄워야 하므로 forceDialog:true 전달.
  const handleSaveAs = async (): Promise<void> => {
    await saveDocument({ forceDialog: true });
  };

  const handleSave = async (): Promise<void> => {
    await saveDocument();
  };

  const handleNew = (): void => {
    useEditorStore.getState().resetEditor();
    useFileStore.getState().setCurrentFile(null);
    useUIStore.getState().setSaveStatus('new');
  };

  // SPEC-FS-003 T7 (REQ-013): 새 문서·파일 전환·종료 가드 상태 머신. 단일 인스턴스를
  //   GuardContext로 트리 전체에 공유(FileTreeNode/MarkdownEditor가 소비). ConfirmDialog 렌더.
  // SPEC-FS-003: 가드는 App(루트)에서 인스턴스화해 전달받는다(워처 콜백과 공유).
  const handleGuardedNew = (): void => {
    guard.requestGuardedAction(() => handleNew());
  };

  const content = useEditorStore((s) => s.content);
  const cursorLine = useEditorStore((s) => s.cursorLine);
  const cursorCol = useEditorStore((s) => s.cursorCol);

  const [exportLoading, setExportLoading] = useState(false);
  // SPEC-EXPORT-002 (REQ-015/016): 완료 모달 단일 경로 슬롯. null=닫힘, string=해당 경로로 열림.
  //   연속 성공 시 최신 경로로 덮어쓴다(큐잉/중첩 없음). try 블록에서만 설정, catch 절대 불가(REQ-018).
  const [exportedPath, setExportedPath] = useState<string | null>(null);
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
      const savePath = await exportToHtml({
        content: c,
        filename: currentFile ?? 'document.md',
        theme: exportTheme,
        highlighter,
        mdFilePath: currentFile,
      });
      // SPEC-EXPORT-002 REQ-009: 저장 성공 시에만 모달 슬롯 설정. catch 절대 불가(REQ-018).
      if (savePath !== null) setExportedPath(savePath);
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
      const savePath = await exportToDocx({
        content: c,
        filename: currentFile ?? 'document.md',
        theme: exportTheme,
        highlighter,
        mdFilePath: currentFile,
      });
      // SPEC-EXPORT-002 REQ-010: 저장 성공 시에만 모달 슬롯 설정. catch 절대 불가(REQ-018).
      if (savePath !== null) setExportedPath(savePath);
    } catch (err) {
      console.error('DOCX export failed:', err);
      window.alert(`DOCX export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportLoading(false);
    }
  }, [exportTheme]);

  // @MX:NOTE: [AUTO] SPEC-EXPORT-002 완료 모달 액션 라우팅 (REQ-011/012/013/014).
  //   - 'open' → openExportedFile(path) 1회, 'reveal' → revealExportedFile(path) 1회.
  //   - 'cancel'(및 Escape/백드롭이 emit하는 동일 id) → opener 호출 0회, 모달만 닫음.
  //   - open/reveal reject 시 window.alert 로 실패 알림(기존 내보내기 실패 UX 동일) + 모달 닫힘.
  //   - 예외는 try/catch 로 흡수해 전역으로 전파하지 않는다(unhandled rejection 0건).
  //   - PDF 는 본 모달의 대상이 아니다(handleExportPdf 무변경, REQ-019).
  //   - 단일 슬롯 덮어쓰기(REQ-016): setExportedPath(null) 로 닫고, 새 성공이 다시 채운다.
  // @MX:SPEC: SPEC-EXPORT-002
  const handleExportDialogAction = useCallback(
    async (id: string): Promise<void> => {
      if (id === 'cancel') {
        setExportedPath(null);
        return;
      }
      const path = exportedPath;
      if (path === null) return;
      try {
        if (id === 'open') {
          await openExportedFile(path);
        } else if (id === 'reveal') {
          await revealExportedFile(path);
        }
      } catch (err) {
        // REQ-014: 기존 내보내기 실패 알림과 동일 채널(window.alert). 예외 미전파.
        window.alert(`파일을 여는 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setExportedPath(null);
      }
    },
    [exportedPath],
  );
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

  // @MX:NOTE: [AUTO] Insert Table 핸들러 — handleFormat과 동일한 null 가드 패턴(view-only no-op).
  // FormatAction/handleFormat switch(@MX:ANCHOR)는 변경하지 않고 별도 핸들러로 분리한다.
  // AC-UI-007-006 테스트 커버리지 결정: 이 null 가드는 기존 handleFormat(line 195-196)과 동일한
  // 검증되지 않은 관례를 따른다 — handleFormat도 AppLayout 렌더 기반 null-view 전용 단위 테스트가
  // 없다(Tauri IPC 전체 모킹이 필요해 방어 코드 한 줄 대비 비용이 과도). 대신 insertTable() 자체는
  // src/test/insertTable.test.ts에서 뷰 상태 전 분기를 직접 검증했고(GridPicker.test.tsx는
  // onInsertTable === undefined일 때도 셀 클릭이 예외 없이 동작함을 확인), 이 함수는 3줄의 위임
  // 로직만 담아 회귀 위험이 낮다고 판단해 AppLayout 통합 테스트는 추가하지 않는다.
  // @MX:SPEC: SPEC-UI-007
  const handleInsertTable = (rows: number, cols: number): void => {
    const view = viewRef.current;
    if (!view) return;
    insertTable(view, rows, cols);
    view.focus();
  };

  // @MX:NOTE: [AUTO] 다이어그램 삽입 핸들러 — handleInsertTable과 동일한 null 가드(view-only no-op).
  // view가 null(보기 전용)이면 문서 변경 없이 반환하고, 그 외에는 insertDiagram 후 포커스를 복귀한다.
  // @MX:SPEC: SPEC-UI-008
  const handleInsertDiagram = (preset: DiagramPreset): void => {
    const view = viewRef.current;
    if (!view) return;
    insertDiagram(view, preset);
    view.focus();
  };

  // SPEC-PREVIEW-007: html/binary/too-large 파일은 편집 불가 — isViewOnly로 확장
  // previewStatus를 fileStore에서 읽어 binary/too-large 여부를 판정한다
  // SPEC-PREVIEW-008: image/svg도 보기 전용 — 이미지·SVG는 편집/주석·소스 저장을 다루지 않는다
  // (Non-Goals). 여기서 제외하면 MarkdownEditor가 편집기 버퍼(빈 값 또는 SVG 원본)를 편집 가능하게
  // 노출해 SPEC-PREVIEW-008의 보기 전용 요구(REQ-PREVIEW008-001)를 어기게 된다.
  const previewStatus = useFileStore((s) => s.previewStatus);
  const viewType = getFileViewType(currentFile, previewStatus);
  const isViewOnly =
    viewType === 'html' || viewType === 'unsupported' || viewType === 'image' || viewType === 'svg';

  // Editor panel: toolbar + editor (inlined to avoid re-creating the component function on every render)
  const editorPanel = (
    <div className="h-full flex flex-col">
      <EditorToolbar
        onFormat={handleFormat}
        onInsertTable={handleInsertTable}
        onInsertDiagram={handleInsertDiagram}
      />
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
    <GuardContext.Provider
      value={{
        requestGuardedAction: guard.requestGuardedAction,
        requestWatcherConflict: guard.requestWatcherConflict,
        requestClose: guard.requestClose,
      }}
    >
      {/* SPEC-UI-006: .md-root/.md-app apply the handoff base font/color/background and the
          vertical titlebar/body/statusbar shell. Existing Tailwind sizing/overflow classes are
          preserved verbatim (h-screen/w-screen/bg-white/dark:bg-gray-900) so app.test.tsx's
          structural assertions keep passing — the two class systems are additive, not a replacement. */}
      <div className="md-root md-app flex flex-col h-screen w-screen bg-white dark:bg-gray-900 overflow-hidden">
        <Header
          filename={filename}
          isDirty={saveStatus === 'unsaved'}
          content={content}
          onNew={handleGuardedNew}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onExportHtml={handleExportHtml}
          onExportPdf={handleExportPdf}
          onExportDocx={handleExportDocx}
          exportLoading={exportLoading}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <div className="flex flex-1 overflow-hidden relative">
          {/* Sidebar toggle button */}
          <button
            onClick={toggleSidebar}
            className="md-icon-btn absolute left-2 top-2 z-10"
            aria-label="Toggle sidebar"
          >
            <PanelLeftIcon width={16} height={16} />
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
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        {/* SPEC-FS-003: 미저장 변경 가드 모달 (단일 가드 인스턴스에 바인딩) */}
        <ConfirmDialog
          open={guard.open}
          title={guard.title}
          message={guard.message}
          actions={guard.actions}
          onAction={guard.onAction}
        />
        {/* SPEC-EXPORT-002: HTML/DOCX 내보내기 완료 모달. ConfirmDialog(SPEC-FS-003 소유) 소비.
            PDF 는 비대상(REQ-019). 액션 순서: 닫기→폴더에서 보기→열기(마지막=primary+초기 포커스). */}
        <ConfirmDialog
          open={exportedPath !== null}
          title="내보내기 완료"
          message={
            exportedPath === null ? null : (
              <div>
                <div>내보낸 파일이 아래 경로에 저장되었습니다.</div>
                <code data-testid="exported-path">{exportedPath}</code>
              </div>
            )
          }
          actions={[
            { id: 'cancel', label: '닫기' },
            { id: 'reveal', label: '폴더에서 보기' },
            { id: 'open', label: '열기', variant: 'primary' },
          ]}
          onAction={handleExportDialogAction}
        />
      </div>
    </GuardContext.Provider>
  );
}
