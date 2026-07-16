// @MX:SPEC: SPEC-AI-001 REQ-AI-004 REQ-AI-005 REQ-AI-007
// Tests for the frontend AI relay: ipc wrappers (ai_request/cancel/detect/policy) and the
// useAiRelay hook wiring ai:// events → aiStore. TDD RED phase: written before impl exists.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---- Tauri mocks (captured so tests can drive events + assert invoke calls) ----
type EventHandler = (event: { payload: unknown }) => void;
const listeners: Record<string, EventHandler> = {};
const unlistenMock = vi.fn();
const listenMock = vi.fn(async (name: string, handler: EventHandler) => {
  listeners[name] = handler;
  return unlistenMock;
});
const invokeMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: [string, EventHandler]) => listenMock(...args),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

/** Emit an ai:// event to the registered handler, mimicking the Rust emit. */
function emit(channel: string, payload: unknown): void {
  const handler = listeners[channel];
  if (!handler) throw new Error(`no listener registered for ${channel}`);
  handler({ payload });
}

/** Flush the microtask queue so the hook's async listen() registrations resolve. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  for (const k of Object.keys(listeners)) delete listeners[k];
  unlistenMock.mockClear();
  listenMock.mockClear();
  invokeMock.mockClear();
  const { useAiStore, idleSlice } = await import('@/store/aiStore');
  useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
});

describe('ipc AI wrappers: command + arg passthrough', () => {
  it('aiRequest invokes ai_request with the payload nested under `args`', async () => {
    // Tauri 커맨드 fn ai_request(args: AiRequestArgs, ...) 는 invoke 페이로드에서 파라미터
    // 이름 `args` 키로 역직렬화한다. 필드를 최상위로 펼치면 Tauri 가 `args` 를 못 찾아 본문
    // 실행 전에 거부한다(모든 요청 실패). 반드시 { args: {...} } 로 감싸야 한다.
    const { aiRequest } = await import('@/lib/tauri/ipc');
    const args = {
      requestId: 'req-1',
      feature: 'inline-edit' as const,
      presetKind: 'outline',
      model: 'haiku' as const,
      selection: '문단1\n\n문단2',
      contextBefore: '앞',
      contextAfter: '뒤',
    };
    await aiRequest(args);
    expect(invokeMock).toHaveBeenCalledWith('ai_request', { args });
  });

  it('aiCancel invokes ai_cancel with the requestId nested under `args`', async () => {
    const { aiCancel } = await import('@/lib/tauri/ipc');
    await aiCancel('req-9');
    expect(invokeMock).toHaveBeenCalledWith('ai_cancel', { args: { requestId: 'req-9' } });
  });

  it('aiDetectProviders invokes ai_detect_providers and returns the provider list', async () => {
    invokeMock.mockResolvedValueOnce([
      { id: 'claude', installed: true, version: '2.1.211', loggedIn: true },
    ]);
    const { aiDetectProviders } = await import('@/lib/tauri/ipc');
    const providers = await aiDetectProviders();
    expect(invokeMock).toHaveBeenCalledWith('ai_detect_providers');
    expect(providers[0]).toMatchObject({ id: 'claude', installed: true, loggedIn: true });
  });

  it('aiPolicyStatus invokes ai_policy_status and returns the disabled flag', async () => {
    invokeMock.mockResolvedValueOnce({ disabled: true, source: 'env' });
    const { aiPolicyStatus } = await import('@/lib/tauri/ipc');
    const status = await aiPolicyStatus();
    expect(invokeMock).toHaveBeenCalledWith('ai_policy_status');
    expect(status).toEqual({ disabled: true, source: 'env' });
  });

  it('ipcErrorMessage surfaces the classified reject reason, not a bare generic (P7)', async () => {
    const { ipcErrorMessage } = await import('@/lib/tauri/ipc');
    // Rust Err(String) 은 이미 분류된 한국어 메시지 — 그대로 노출한다(REQ-AI-040 위반 아님).
    expect(ipcErrorMessage('사용 가능한 AI 도구가 없어요.')).toBe('사용 가능한 AI 도구가 없어요.');
    expect(ipcErrorMessage(new Error('앱 데이터 폴더를 찾지 못했어요'))).toBe('앱 데이터 폴더를 찾지 못했어요');
    // 사유가 비면 폴백 문구.
    expect(ipcErrorMessage('')).toBe('요청을 시작할 수 없어요.');
    expect(ipcErrorMessage(undefined)).toBe('요청을 시작할 수 없어요.');
  });
});

describe('useAiRelay: ai:// events → aiStore', () => {
  it('registers listeners for all three ai:// channels on mount', async () => {
    const { useAiRelay } = await import('@/hooks/useAiRelay');
    renderHook(() => useAiRelay());
    await flush();
    expect(Object.keys(listeners).sort()).toEqual(['ai://chunk', 'ai://done', 'ai://error']);
  });

  it('ai://chunk accumulates text into the store buffer (matching requestId)', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    const { useAiRelay } = await import('@/hooks/useAiRelay');
    renderHook(() => useAiRelay());
    await flush();

    useAiStore.getState().startRequest('req-1', 'inline-edit');
    emit('ai://chunk', { requestId: 'req-1', text: 'Hello' });
    emit('ai://chunk', { requestId: 'req-1', text: ', world' });
    expect(useAiStore.getState().streamBuffer).toBe('Hello, world');
    expect(useAiStore.getState().requestState).toBe('streaming');
  });

  it('ai://done completes the request with the authoritative result', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    const { useAiRelay } = await import('@/hooks/useAiRelay');
    renderHook(() => useAiRelay());
    await flush();

    useAiStore.getState().startRequest('req-1', 'inline-edit');
    emit('ai://chunk', { requestId: 'req-1', text: 'partial' });
    emit('ai://done', { requestId: 'req-1', result: '최종 결과', truncated: false });
    expect(useAiStore.getState().requestState).toBe('done');
    expect(useAiStore.getState().streamBuffer).toBe('최종 결과');
    expect(useAiStore.getState().truncated).toBe(false);
  });

  it('ai://done forwards the truncated flag into the store (context was clipped)', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    const { useAiRelay } = await import('@/hooks/useAiRelay');
    renderHook(() => useAiRelay());
    await flush();

    useAiStore.getState().startRequest('req-1', 'section-fill');
    emit('ai://done', { requestId: 'req-1', result: '결과', truncated: true });
    expect(useAiStore.getState().requestState).toBe('done');
    expect(useAiStore.getState().truncated).toBe(true);
  });

  it('ai://error fails the request carrying the classified kind', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    const { useAiRelay } = await import('@/hooks/useAiRelay');
    renderHook(() => useAiRelay());
    await flush();

    useAiStore.getState().startRequest('req-1', 'inline-edit');
    emit('ai://error', { requestId: 'req-1', kind: 'login', message: '로그인이 풀렸어요' });
    expect(useAiStore.getState().requestState).toBe('error');
    expect(useAiStore.getState().errorInfo).toEqual({ kind: 'login', message: '로그인이 풀렸어요' });
  });

  it('ignores events whose requestId does not match the current request (stale guard)', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    const { useAiRelay } = await import('@/hooks/useAiRelay');
    renderHook(() => useAiRelay());
    await flush();

    useAiStore.getState().startRequest('req-current', 'inline-edit');
    // A late chunk from a previously-cancelled request must not corrupt the buffer.
    emit('ai://chunk', { requestId: 'req-stale', text: 'GHOST' });
    expect(useAiStore.getState().streamBuffer).toBe('');
    // A stale done/error must not flip state either.
    emit('ai://done', { requestId: 'req-stale', result: 'stale-result' });
    emit('ai://error', { requestId: 'req-stale', kind: 'other', message: 'stale' });
    expect(useAiStore.getState().requestState).toBe('streaming');
  });

  it('calls every unlisten on unmount', async () => {
    const { useAiRelay } = await import('@/hooks/useAiRelay');
    const { unmount } = renderHook(() => useAiRelay());
    await flush();
    unmount();
    expect(unlistenMock).toHaveBeenCalledTimes(3);
  });
});
