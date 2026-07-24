// @MX:SPEC: SPEC-FS-003
// saveDocument 단일 저장 함수 테스트 (REQ-009, 010, 035)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { saveDocument } from '@/lib/save/saveDocument';
import { useEditorStore } from '@/store/editorStore';
import { useFileStore } from '@/store/fileStore';
import { useUIStore } from '@/store/uiStore';

// IPC 레이어 모킹
vi.mock('@/lib/tauri/ipc', () => ({
  writeFile: vi.fn(),
  saveFileAs: vi.fn(),
}));

import * as ipc from '@/lib/tauri/ipc';

describe('saveDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
    useFileStore.setState({
      watchedPath: null,
      currentFile: null,
      fileTree: [],
      expandedDirs: new Set(),
      isLoading: false,
    } as never);
    useUIStore.setState({ saveStatus: 'new' } as never);
  });

  it('경로가 있으면 writeFile으로 덮어쓰고 dirty=false, saved를 반환한다 (REQ-009/010)', async () => {
    useEditorStore.setState({ content: '내용', currentFilePath: '/doc.md', dirty: true });
    vi.mocked(ipc.writeFile).mockResolvedValue(undefined);

    const result = await saveDocument();

    expect(ipc.writeFile).toHaveBeenCalledWith('/doc.md', '내용');
    expect(result).toBe(true);
    expect(useEditorStore.getState().dirty).toBe(false);
    expect(useUIStore.getState().saveStatus).toBe('saved');
  });

  it('경로가 없으면 saveFileAs를 watchedPath 기본 디렉터리와 함께 호출한다 (REQ-035)', async () => {
    useEditorStore.setState({ content: '새 내용', currentFilePath: null, dirty: true });
    useFileStore.setState({ watchedPath: '/proj' } as never);
    vi.mocked(ipc.saveFileAs).mockResolvedValue('/proj/new.md');

    const result = await saveDocument();

    expect(ipc.saveFileAs).toHaveBeenCalledWith('새 내용', '/proj');
    expect(result).toBe(true);
    expect(useEditorStore.getState().currentFilePath).toBe('/proj/new.md');
    expect(useFileStore.getState().currentFile).toBe('/proj/new.md');
    expect(useEditorStore.getState().dirty).toBe(false);
    expect(useUIStore.getState().saveStatus).toBe('saved');
  });

  it('watchedPath가 null이면 saveFileAs에 undefined를 전달한다 (REQ-035, 경로별 차이 0)', async () => {
    useEditorStore.setState({ content: 'x', currentFilePath: null, dirty: true });
    vi.mocked(ipc.saveFileAs).mockResolvedValue('/somewhere/f.md');

    await saveDocument();

    expect(ipc.saveFileAs).toHaveBeenCalledWith('x', undefined);
  });

  it('Save As 취소(null) 시 false를 반환하고 dirty를 유지한다 (REQ-017)', async () => {
    useEditorStore.setState({ content: 'x', currentFilePath: null, dirty: true });
    vi.mocked(ipc.saveFileAs).mockResolvedValue(null);

    const result = await saveDocument();

    expect(result).toBe(false);
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(useUIStore.getState().saveStatus).toBe('unsaved');
  });

  it('writeFile 실패 시 false를 반환하고 dirty를 true로 유지한다 (REQ-010)', async () => {
    useEditorStore.setState({ content: 'x', currentFilePath: '/doc.md', dirty: true });
    vi.mocked(ipc.writeFile).mockRejectedValue(new Error('disk full'));

    const result = await saveDocument();

    expect(result).toBe(false);
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(useUIStore.getState().saveStatus).toBe('unsaved');
  });

  it('진입 시 saveStatus를 saving으로 설정한다', async () => {
    useEditorStore.setState({ content: 'x', currentFilePath: '/doc.md', dirty: true });
    let resolveWrite: () => void;
    vi.mocked(ipc.writeFile).mockReturnValue(
      new Promise<void>((r) => { resolveWrite = r; }),
    );

    const promise = saveDocument();
    expect(useUIStore.getState().saveStatus).toBe('saving');

    await act(async () => { resolveWrite!(); await promise; });
  });

  describe('forceDialog (REQ-FS-003-041~044, Save As on existing file)', () => {
    it('기존 파일 + forceDialog:true 이면 writeFile이 아니라 saveFileAs(다이얼로그)를 호출한다', async () => {
      useEditorStore.setState({ content: '내용', currentFilePath: '/doc.md', dirty: true });
      useFileStore.setState({ watchedPath: '/proj' } as never);
      vi.mocked(ipc.saveFileAs).mockResolvedValue('/proj/doc.md');

      const result = await saveDocument({ forceDialog: true });

      expect(ipc.saveFileAs).toHaveBeenCalledWith('내용', '/proj');
      expect(ipc.writeFile).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('기존 파일 + 옵션 없음(Save)이면 다이얼로그 없이 직접 writeFile로 덮어쓴다 (REQ-009 회귀 가드)', async () => {
      useEditorStore.setState({ content: '내용', currentFilePath: '/doc.md', dirty: true });
      vi.mocked(ipc.writeFile).mockResolvedValue(undefined);

      const result = await saveDocument();

      expect(ipc.writeFile).toHaveBeenCalledWith('/doc.md', '내용');
      expect(ipc.saveFileAs).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('신규 파일(currentFilePath null) + 옵션 없음이면 다이얼로그를 호출한다 (기존 동작 불변)', async () => {
      useEditorStore.setState({ content: '새 내용', currentFilePath: null, dirty: true });
      vi.mocked(ipc.saveFileAs).mockResolvedValue('/proj/new.md');

      const result = await saveDocument();

      expect(ipc.saveFileAs).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('Save As로 새 경로에 저장하면 추적 경로가 새 경로로 전환된다', async () => {
      useEditorStore.setState({ content: '내용', currentFilePath: '/old.md', dirty: true });
      vi.mocked(ipc.saveFileAs).mockResolvedValue('/new/path.md');

      const result = await saveDocument({ forceDialog: true });

      expect(result).toBe(true);
      expect(useEditorStore.getState().currentFilePath).toBe('/new/path.md');
      expect(useFileStore.getState().currentFile).toBe('/new/path.md');
    });

    it('Save As 다이얼로그 취소(savedPath null) 시 쓰기가 발생하지 않고 dirty가 유지된다', async () => {
      useEditorStore.setState({ content: '내용', currentFilePath: '/doc.md', dirty: true });
      vi.mocked(ipc.saveFileAs).mockResolvedValue(null);

      const result = await saveDocument({ forceDialog: true });

      expect(ipc.writeFile).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(useEditorStore.getState().dirty).toBe(true);
      expect(useEditorStore.getState().currentFilePath).toBe('/doc.md');
    });
  });
});
