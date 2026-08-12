// @MX:SPEC: SPEC-IMG-LOAD-001
// Group A — UT-A1/A2/A3: AppLayout `case 'image'` 호출부 모드 인지 분기 단위 테스트.
// REQ-IMG-LOAD-A-001 (inline-blob + 미저장 → Save-As 스킵)
// REQ-IMG-LOAD-A-002 (file-save + 미저장 → 기존 Save-As 게이트 유지)
// REQ-IMG-LOAD-A-003 (이미 저장된 문서 → 모드 무관 직접 호출)
//
// 전략: EditorToolbar 를 모킹해 onFormat 콜백을 캡처하고, MarkdownEditor 를 모킹해
// 가짜 EditorView 를 viewRef 에 주입한다. 그 후 캡처한 onFormat('image')를 호출해
// handleFormat의 이미지 분기가 각 모드/경로 조건에서 올바른 IPC 호출 패턴을 내는지 단언한다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React from 'react';
import type { EditorView } from '@codemirror/view';
import { useEditorStore } from '@/store/editorStore';
import { useUIStore } from '@/store/uiStore';
import { useFileStore } from '@/store/fileStore';

// ---- 캡처용 mock ----
const { mockSaveFileAs, mockInsertImageFromDialog } = vi.hoisted(() => ({
  mockSaveFileAs: vi.fn().mockResolvedValue('/saved/doc.md'),
  mockInsertImageFromDialog: vi.fn().mockResolvedValue(undefined),
}));

// EditorView 스텁 — view.state.doc.toString() 이 모드 분기에 쓰일 수 있도록 실제처럼 동작
const fakeView = {
  state: {
    doc: { toString: () => 'doc content' },
    selection: { main: { head: 0 } },
  },
  dispatch: vi.fn(),
  focus: vi.fn(),
} as unknown as EditorView;

// ---- Tauri API 모킹 (AppLayout 이 마운트 효과에서 깨지지 않게) ----
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }));

// ---- IPC 모킹: AppLayout 이 직접 import 하는 함수 전체 포함 ----
vi.mock('@/lib/tauri/ipc', () => ({
  saveFileAs: mockSaveFileAs,
  aiDetectProviders: vi.fn().mockResolvedValue([]),
  aiPolicyStatus: vi.fn().mockResolvedValue({ disabled: false }),
  openExportedFile: vi.fn().mockResolvedValue(undefined),
  revealExportedFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  createFile: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  readDirectory: vi.fn().mockResolvedValue([]),
  openDirectoryDialog: vi.fn().mockResolvedValue(null),
  startWatch: vi.fn().mockResolvedValue(undefined),
  stopWatch: vi.fn().mockResolvedValue(undefined),
  registerAssetScope: vi.fn().mockResolvedValue(undefined),
  exportSaveDialog: vi.fn(),
  writeBinaryFile: vi.fn(),
  printCurrentWindow: vi.fn(),
}));

// ---- imageHandler 모킹 ----
vi.mock('@/lib/image/imageHandler', () => ({
  insertImageFromDialog: mockInsertImageFromDialog,
  handleImagePaste: vi.fn(),
  handleImageDrop: vi.fn(),
  decideImageInsert: vi.fn(() => 'ignore'),
  extractImageFile: vi.fn(() => null),
  insertImageFile: vi.fn(),
}));

// ---- EditorToolbar 모킹: onFormat 캡처 ----
let capturedOnFormat: ((action: string) => void) | null = null;
vi.mock('@/components/editor/EditorToolbar', () => ({
  EditorToolbar: ({ onFormat }: { onFormat: (a: string) => void }) => {
    capturedOnFormat = onFormat;
    return null;
  },
}));

// ---- MarkdownEditor 모킹: onViewReady 로 fakeView 주입 ----
vi.mock('@/components/editor/MarkdownEditor', () => ({
  MarkdownEditor: ({ onViewReady }: { onViewReady: (v: EditorView) => void }) => {
    React.useEffect(() => {
      onViewReady(fakeView);
    }, [onViewReady]);
    return null;
  },
}));

// ---- 마운트 효과 부작용 회피용 경량 모킹 ----
vi.mock('@/lib/ai/aiOffEffects', () => ({ initAiToggleEffects: () => () => undefined }));
vi.mock('@/lib/ai/aiFileSwitchEffects', () => ({ initAiFileSwitchEffects: () => () => undefined }));
vi.mock('@/components/editor/extensions/ai-suggestion-card', () => ({
  setAiLoggedIn: vi.fn(),
  registerOnboardingOpener: vi.fn(),
}));
vi.mock('@/store/aiPolicy', () => ({ setAiPolicyDisabled: vi.fn() }));
vi.mock('@/hooks/useAiRelay', () => ({ useAiRelay: () => ({}) }));
vi.mock('@/lib/save/saveDocument', () => ({ saveDocument: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/markdown/codeHighlight', () => ({ getHighlighter: vi.fn().mockResolvedValue({}) }));
// useScrollSync는 실제 CodeMirror DOM(.cm-scroller)이 필요 — MarkdownEditor 모킹 환경에서는
// 대상 DOM이 없어 효과 등록 시 크래시. Group A 테스트는 스크롤 동작과 무관하므로 no-op 처리.
vi.mock('@/hooks/useScrollSync', () => ({ useScrollSync: () => undefined }));
vi.mock('@/lib/export/exportHtml', () => ({ exportToHtml: vi.fn() }));
vi.mock('@/lib/export/exportPdf', () => ({ exportToPdf: vi.fn() }));
vi.mock('@/lib/export/exportDocx', () => ({ exportToDocx: vi.fn() }));

// PreviewContainer / FileExplorer / Header / Footer / SettingsModal / ConfirmDialog 는
// AppLayout 마운트를 방해하지 않는 한 실제 컴포넌트로 둔다(최소 모킹 원칙). 다만 PreviewContainer
// 의 getFileViewType 재export 는 AppLayout 이 직접 import 하므로 실제 구현을 그대로 쓴다.

import { AppLayout } from '@/components/layout/AppLayout';
import type { UseUnsavedChangesGuardReturn } from '@/hooks/useUnsavedChangesGuard';

const stubGuard: UseUnsavedChangesGuardReturn = {
  open: false,
  title: '',
  message: null,
  actions: [],
  requestGuardedAction: (fn: () => void | Promise<void>) => {
    void fn();
  },
  requestWatcherConflict: (fn: () => void | Promise<void>) => {
    void fn();
  },
  requestClose: (fn: () => void | Promise<void>) => {
    void fn();
  },
  onAction: vi.fn().mockResolvedValue(undefined),
};

/** Promise 체인(.then) 내 store 갱신이 flush 될 때까지 대기 */
async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('SPEC-IMG-LOAD-001 Group A — AppLayout case "image" 모드 인지', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnFormat = null;
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
    useUIStore.setState({ imageInsertMode: 'inline-blob', saveStatus: 'new' });
    useFileStore.setState({ currentFile: null, previewStatus: null, fileTree: [] });
  });
  afterEach(cleanup);

  // UT-A1: inline-blob + 미저장 → Save-As 스킵 (REQ-IMG-LOAD-A-001)
  it('UT-A1: inline-blob + 미저장 문서 → saveFileAs 미호출, insertImageFromDialog(view, "") 직접 호출', async () => {
    useEditorStore.setState({ currentFilePath: null });
    useUIStore.setState({ imageInsertMode: 'inline-blob' });

    render(<AppLayout guard={stubGuard} />);
    expect(capturedOnFormat).not.toBeNull();

    await act(async () => {
      capturedOnFormat!('image');
      await flushPromises();
    });

    expect(mockSaveFileAs).not.toHaveBeenCalled();
    expect(mockInsertImageFromDialog).toHaveBeenCalledWith(fakeView, '');
  });

  // UT-A2: file-save + 미저장 → 기존 Save-As 게이트 유지 (REQ-IMG-LOAD-A-002)
  it('UT-A2: file-save + 미저장 문서 → saveFileAs 호출 후 insertImageFromDialog(view, savedPath)', async () => {
    useEditorStore.setState({ currentFilePath: null });
    useUIStore.setState({ imageInsertMode: 'file-save' });

    render(<AppLayout guard={stubGuard} />);

    await act(async () => {
      capturedOnFormat!('image');
      await flushPromises();
    });

    expect(mockSaveFileAs).toHaveBeenCalledWith('doc content');
    expect(mockInsertImageFromDialog).toHaveBeenCalledWith(fakeView, '/saved/doc.md');
  });

  // UT-A3: 이미 저장된 문서 → 모드 무관 직접 호출 (REQ-IMG-LOAD-A-003)
  it('UT-A3a: 저장된 문서 + inline-blob → saveFileAs 없이 insertImageFromDialog(view, path)', async () => {
    useEditorStore.setState({ currentFilePath: '/existing/doc.md' });
    useUIStore.setState({ imageInsertMode: 'inline-blob' });

    render(<AppLayout guard={stubGuard} />);

    await act(async () => {
      capturedOnFormat!('image');
      await flushPromises();
    });

    expect(mockSaveFileAs).not.toHaveBeenCalled();
    expect(mockInsertImageFromDialog).toHaveBeenCalledWith(fakeView, '/existing/doc.md');
  });

  it('UT-A3b: 저장된 문서 + file-save → 동일하게 직접 호출', async () => {
    useEditorStore.setState({ currentFilePath: '/existing/doc.md' });
    useUIStore.setState({ imageInsertMode: 'file-save' });

    render(<AppLayout guard={stubGuard} />);

    await act(async () => {
      capturedOnFormat!('image');
      await flushPromises();
    });

    expect(mockSaveFileAs).not.toHaveBeenCalled();
    expect(mockInsertImageFromDialog).toHaveBeenCalledWith(fakeView, '/existing/doc.md');
  });
});
