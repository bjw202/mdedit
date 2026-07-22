// @MX:SPEC: SPEC-FS-003
// useUnsavedChangesGuard 가드 상태 머신 테스트 (REQ-012~017, 024~026, 037~040)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, render } from '@testing-library/react';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useEditorStore } from '@/store/editorStore';
import { useAiStore } from '@/store/aiStore';

// saveDocument 모킹
vi.mock('@/lib/save/saveDocument', () => ({
  saveDocument: vi.fn(),
}));
// aiCancel IPC 모킹
vi.mock('@/lib/tauri/ipc', () => ({
  aiCancel: vi.fn().mockResolvedValue(undefined),
}));

import { saveDocument } from '@/lib/save/saveDocument';
import { aiCancel } from '@/lib/tauri/ipc';

function setIdle(): void {
  useAiStore.setState({
    requestState: 'idle',
    streamBuffer: '',
    requestId: null,
    feature: null,
    errorInfo: null,
    truncated: false,
  });
}

function setStreaming(): void {
  useAiStore.setState({
    requestState: 'streaming',
    streamBuffer: 'partial',
    requestId: 'req-1',
    feature: 'inline-edit',
    errorInfo: null,
    truncated: false,
  });
}

describe('useUnsavedChangesGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      content: '',
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      currentFilePath: null,
    });
    setIdle();
  });

  // ---- REQ-026: dirty=false 즉시 실행 ----

  it('dirty=false면 모달 없이 action을 즉시 실행한다 (REQ-026)', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const action = vi.fn();
    act(() => result.current.requestGuardedAction(action));
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBe(false);
  });

  // ---- REQ-012/013: dirty=true 모달 표시 ----

  it('dirty=true면 모달을 열고 action을 즉시 실행하지 않는다 (REQ-012)', () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const action = vi.fn();
    act(() => result.current.requestGuardedAction(action));
    expect(action).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
    expect(result.current.actions.map((a) => a.id)).toEqual(['cancel', 'discard', 'save']);
  });

  it('3버튼 actions 배열이 [cancel, discard, save] 순서이고 save가 primary다', () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    act(() => result.current.requestGuardedAction(vi.fn()));
    const save = result.current.actions.find((a) => a.id === 'save');
    expect(save?.variant).toBe('primary');
  });

  // ---- REQ-014/015/016: 액션 처리 ----

  it('save 선택 시 saveDocument 성공 후 action이 실행된다 (REQ-014)', async () => {
    useEditorStore.setState({ dirty: true });
    vi.mocked(saveDocument).mockResolvedValue(true);
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const action = vi.fn();
    act(() => result.current.requestGuardedAction(action));
    await act(async () => { await result.current.onAction('save'); });
    expect(saveDocument).toHaveBeenCalled();
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBe(false);
  });

  it('discard 선택 시 저장 없이 action이 즉시 실행된다 (REQ-015)', async () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const action = vi.fn();
    act(() => result.current.requestGuardedAction(action));
    await act(async () => { await result.current.onAction('discard'); });
    expect(saveDocument).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBe(false);
  });

  it('cancel 선택 시 action이 실행되지 않고 모달이 닫힌다 (REQ-016)', async () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const action = vi.fn();
    act(() => result.current.requestGuardedAction(action));
    await act(async () => { await result.current.onAction('cancel'); });
    expect(action).not.toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });

  // ---- REQ-017: 저장 실패 시 중단 ----

  it('save 실패 시 action이 실행되지 않고 dirty가 유지된다 (REQ-017)', async () => {
    useEditorStore.setState({ dirty: true });
    vi.mocked(saveDocument).mockResolvedValue(false);
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const action = vi.fn();
    act(() => result.current.requestGuardedAction(action));
    await act(async () => { await result.current.onAction('save'); });
    expect(action).not.toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });

  // ---- REQ-024/025: 재진입 차단 (폐기, 큐잉 금지) — 3 트리거 ----

  it('모달 열린 동안 파일 클릭 트리거는 무시된다 (REQ-024, 파일 1개만)', async () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const openA = vi.fn();
    const openB = vi.fn();
    act(() => result.current.requestGuardedAction(openA)); // 파일 A → 모달 오픈
    act(() => result.current.requestGuardedAction(openB)); // 파일 B → 무시 (폐기)
    await act(async () => { await result.current.onAction('discard'); });
    expect(openA).toHaveBeenCalledTimes(1);
    expect(openB).not.toHaveBeenCalled();
  });

  it('모달 열린 동안 새 문서 트리거는 무시된다 (REQ-024, resetEditor 미호출)', async () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const openFile = vi.fn();
    const newDoc = vi.fn();
    act(() => result.current.requestGuardedAction(openFile)); // 파일 → 모달
    act(() => result.current.requestGuardedAction(newDoc));  // 새 문서 → 무시
    await act(async () => { await result.current.onAction('discard'); });
    expect(openFile).toHaveBeenCalledTimes(1);
    expect(newDoc).not.toHaveBeenCalled();
  });

  it('save 진행 중(busy) 파일 클릭은 무시된다 (REQ-025, 저장 1회)', async () => {
    useEditorStore.setState({ dirty: true });
    let resolveSave!: () => void;
    vi.mocked(saveDocument).mockReturnValue(
      new Promise<boolean>((r) => { resolveSave = () => r(true); }),
    );
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const openA = vi.fn();
    const openB = vi.fn();
    act(() => result.current.requestGuardedAction(openA));
    let savePromise!: Promise<void>;
    act(() => { savePromise = result.current.onAction('save'); }); // 저장 시작 (busy)
    // 저장 진행 중 파일 B 클릭 → 무시
    act(() => result.current.requestGuardedAction(openB));
    await act(async () => { resolveSave(); await savePromise; });
    expect(saveDocument).toHaveBeenCalledTimes(1); // 저장 1회
    expect(openA).toHaveBeenCalledTimes(1);
    expect(openB).not.toHaveBeenCalled();
  });

  // ---- REQ-037: 종료 승격 ----

  it('모달 열린 상태에서 종료 요청은 두 번째 모달 없이 승격된다 (REQ-037)', () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const openFile = vi.fn();
    const closeWin = vi.fn();
    act(() => result.current.requestGuardedAction(openFile)); // 파일 → 모달
    act(() => result.current.requestClose(closeWin));         // 종료 → 승격 (모달 유지)
    expect(result.current.open).toBe(true);
    expect(openFile).not.toHaveBeenCalled();
    expect(closeWin).not.toHaveBeenCalled();
  });

  it('승격 모달에서 save 선택 시 closeAction만 실행되고 pendingAction은 실행되지 않는다 (REQ-037)', async () => {
    useEditorStore.setState({ dirty: true });
    vi.mocked(saveDocument).mockResolvedValue(true);
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const openFile = vi.fn();
    const closeWin = vi.fn();
    act(() => result.current.requestGuardedAction(openFile));
    act(() => result.current.requestClose(closeWin));
    await act(async () => { await result.current.onAction('save'); });
    expect(closeWin).toHaveBeenCalledTimes(1);
    expect(openFile).not.toHaveBeenCalled(); // 파일 B는 열리지 않음
  });

  it('승격 모달에서 discard 선택 시 closeAction만 실행된다 (REQ-037)', async () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const openFile = vi.fn();
    const closeWin = vi.fn();
    act(() => result.current.requestGuardedAction(openFile));
    act(() => result.current.requestClose(closeWin));
    await act(async () => { await result.current.onAction('discard'); });
    expect(closeWin).toHaveBeenCalledTimes(1);
    expect(openFile).not.toHaveBeenCalled();
  });

  it('승격 모달에서 cancel 선택 시 종료 중단 + 재종료 가능 (REQ-037 deadlock 부재)', async () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const openFile = vi.fn();
    const closeWin = vi.fn();
    act(() => result.current.requestGuardedAction(openFile));
    act(() => result.current.requestClose(closeWin));
    await act(async () => { await result.current.onAction('cancel'); });
    expect(closeWin).not.toHaveBeenCalled();
    expect(openFile).not.toHaveBeenCalled();
    expect(result.current.open).toBe(false);
    // 재종료 가능 — closePending 리셋되어 다시 종료 시도 시 정상 동작
    act(() => result.current.requestClose(closeWin));
    expect(result.current.open).toBe(true);
  });

  it('dirty=false에서 종료 요청 시 모달 없이 즉시 종료 (REQ-019)', () => {
    useEditorStore.setState({ dirty: false });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const closeWin = vi.fn();
    act(() => result.current.requestClose(closeWin));
    expect(closeWin).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBe(false);
  });

  // ---- REQ-038/040: AI 스트리밍 취소 ----

  it('스트리밍 중 save 선택 시 aiCancel이 saveDocument보다 먼저 호출된다 (REQ-038, 순서)', async () => {
    useEditorStore.setState({ dirty: true });
    setStreaming();
    vi.mocked(saveDocument).mockResolvedValue(true);
    const order: string[] = [];
    vi.mocked(aiCancel).mockImplementation(async () => { order.push('aiCancel'); });
    vi.mocked(saveDocument).mockImplementation(async () => { order.push('saveDocument'); return true; });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    act(() => result.current.requestGuardedAction(vi.fn()));
    await act(async () => { await result.current.onAction('save'); });
    expect(order).toEqual(['aiCancel', 'saveDocument']);
  });

  it('스트리밍 중 discard 선택 시 aiCancel이 호출된다 (REQ-038)', async () => {
    useEditorStore.setState({ dirty: true });
    setStreaming();
    const { result } = renderHook(() => useUnsavedChangesGuard());
    act(() => result.current.requestGuardedAction(vi.fn()));
    await act(async () => { await result.current.onAction('discard'); });
    expect(aiCancel).toHaveBeenCalledWith('req-1');
  });

  it('cancel 선택 시 aiCancel이 호출되지 않는다 (스트리밍 유지, REQ-038)', async () => {
    useEditorStore.setState({ dirty: true });
    setStreaming();
    const { result } = renderHook(() => useUnsavedChangesGuard());
    act(() => result.current.requestGuardedAction(vi.fn()));
    await act(async () => { await result.current.onAction('cancel'); });
    expect(aiCancel).not.toHaveBeenCalled();
  });

  it('스트리밍 중이 아닐 때 save 선택 시 aiCancel이 호출되지 않는다', async () => {
    useEditorStore.setState({ dirty: true });
    setIdle();
    vi.mocked(saveDocument).mockResolvedValue(true);
    const { result } = renderHook(() => useUnsavedChangesGuard());
    act(() => result.current.requestGuardedAction(vi.fn()));
    await act(async () => { await result.current.onAction('save'); });
    expect(aiCancel).not.toHaveBeenCalled();
  });

  // ---- REQ-039: AI 중단 고지 문구 ----

  it('스트리밍 중 모달 메시지에 AI 응답 중단 고지가 포함된다 (REQ-039)', () => {
    useEditorStore.setState({ dirty: true });
    setStreaming();
    const { result } = renderHook(() => useUnsavedChangesGuard());
    act(() => result.current.requestGuardedAction(vi.fn()));
    const { container } = render(<div>{result.current.message}</div>);
    expect(container.textContent).toMatch(/중단/);
  });

  it('스트리밍 중이 아닐 때 모달 메시지에 AI 고지가 없다 (REQ-039)', () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    act(() => result.current.requestGuardedAction(vi.fn()));
    const { container } = render(<div>{result.current.message}</div>);
    expect(container.textContent).not.toMatch(/AI 응답.*중단/);
  });

  // ---- SPEC-FS-003 T9 (REQ-021/022/023/034): 워처 충돌 모달 ----

  it('requestWatcherConflict가 [reload(danger), cancel(primary)] 순서 모달을 연다 (REQ-022/034)', () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    act(() => result.current.requestWatcherConflict(vi.fn()));
    expect(result.current.open).toBe(true);
    const ids = result.current.actions.map((a) => a.id);
    expect(ids).toEqual(['reload', 'cancel']);
    // 마지막(cancel=내 버전 유지)이 primary = 안전 선택지 기본 포커스 (REQ-034)
    expect(result.current.actions[1].variant).toBe('primary');
    expect(result.current.actions[0].variant).toBe('danger');
  });

  it('워처 모달에서 reload 선택 시 reload 액션이 실행된다 (REQ-023)', async () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const reload = vi.fn();
    act(() => result.current.requestWatcherConflict(reload));
    await act(async () => { await result.current.onAction('reload'); });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBe(false);
  });

  it('워처 모달에서 cancel(내 버전 유지) 선택 시 reload가 실행되지 않는다 (REQ-023)', async () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const reload = vi.fn();
    act(() => result.current.requestWatcherConflict(reload));
    await act(async () => { await result.current.onAction('cancel'); });
    expect(reload).not.toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });

  it('모달 열린 동안 워처 이벤트는 무시된다 (REQ-024, 재알림 없음)', async () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const reloadA = vi.fn();
    const reloadB = vi.fn();
    act(() => result.current.requestWatcherConflict(reloadA)); // 첫 이벤트 → 모달
    act(() => result.current.requestWatcherConflict(reloadB)); // 두 번째 → 무시(폐기)
    await act(async () => { await result.current.onAction('reload'); });
    expect(reloadA).toHaveBeenCalledTimes(1);
    expect(reloadB).not.toHaveBeenCalled();
  });

  it('워처 모달 열린 상태에서 종료 요청은 승격된다 (REQ-037)', async () => {
    useEditorStore.setState({ dirty: true });
    const { result } = renderHook(() => useUnsavedChangesGuard());
    const reload = vi.fn();
    const closeWin = vi.fn();
    act(() => result.current.requestWatcherConflict(reload));
    act(() => result.current.requestClose(closeWin)); // 종료 → 승격
    expect(result.current.open).toBe(true);
    // reload 선택 → 종료 실행(reload 아님, REQ-037: 디스크에서 다시 읽기 후 종료)
    await act(async () => { await result.current.onAction('reload'); });
    expect(closeWin).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });
});
