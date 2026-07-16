// @MX:SPEC: SPEC-AI-001 REQ-AI-007 REQ-AI-008
// Tests for aiStore — transient (NON-persisted) zustand store for AI request lifecycle.
// TDD RED phase: written before src/store/aiStore.ts exists.

import { describe, it, expect, beforeEach } from 'vitest';

describe('aiStore reducers: pure state transitions', () => {
  it('reduceStartRequest enters streaming, clears buffer, sets id/feature, clears error', async () => {
    const { reduceStartRequest } = await import('@/store/aiStore');
    const slice = reduceStartRequest('req-1', 'inline-edit');
    expect(slice.requestState).toBe('streaming');
    expect(slice.streamBuffer).toBe('');
    expect(slice.requestId).toBe('req-1');
    expect(slice.feature).toBe('inline-edit');
    expect(slice.errorInfo).toBeNull();
  });

  it('reduceAppendChunk accumulates deltas in order', async () => {
    const { reduceStartRequest, reduceAppendChunk } = await import('@/store/aiStore');
    let slice = reduceStartRequest('req-1', 'inline-edit');
    slice = reduceAppendChunk(slice, 'Hello');
    slice = reduceAppendChunk(slice, ', ');
    slice = reduceAppendChunk(slice, 'world');
    expect(slice.streamBuffer).toBe('Hello, world');
    expect(slice.requestState).toBe('streaming');
  });

  it('reduceCompleteRequest transitions to done and adopts the authoritative final text', async () => {
    const { reduceStartRequest, reduceAppendChunk, reduceCompleteRequest } = await import('@/store/aiStore');
    let slice = reduceStartRequest('req-1', 'inline-edit');
    slice = reduceAppendChunk(slice, 'partial stream');
    slice = reduceCompleteRequest(slice, 'final authoritative result');
    expect(slice.requestState).toBe('done');
    expect(slice.streamBuffer).toBe('final authoritative result');
    expect(slice.truncated).toBe(false); // 기본값
  });

  it('reduceCompleteRequest carries the truncated flag when the backend clipped context', async () => {
    const { reduceStartRequest, reduceCompleteRequest } = await import('@/store/aiStore');
    let slice = reduceStartRequest('req-1', 'section-fill');
    slice = reduceCompleteRequest(slice, '결과', true);
    expect(slice.truncated).toBe(true);
  });

  it('reduceStartRequest and reduceCancel reset truncated to false', async () => {
    const { reduceStartRequest, reduceCompleteRequest, reduceCancel } = await import('@/store/aiStore');
    expect(reduceStartRequest('r', 'inline-edit').truncated).toBe(false);
    let slice = reduceCompleteRequest(reduceStartRequest('r', 'inline-edit'), 'x', true);
    expect(slice.truncated).toBe(true);
    slice = reduceCancel();
    expect(slice.truncated).toBe(false);
  });

  it('reduceFailRequest carries a classified error kind (never raw JSON) and message', async () => {
    const { reduceStartRequest, reduceFailRequest } = await import('@/store/aiStore');
    let slice = reduceStartRequest('req-1', 'inline-edit');
    slice = reduceFailRequest(slice, { kind: 'login', message: '로그인이 풀렸어요' });
    expect(slice.requestState).toBe('error');
    expect(slice.errorInfo).toEqual({ kind: 'login', message: '로그인이 풀렸어요' });
    // classified kind must be one of the known union members, not a raw payload
    expect(['login', 'network', 'parse', 'other']).toContain(slice.errorInfo?.kind);
  });

  it('reduceCancel resets to idle and clears the buffer', async () => {
    const { reduceStartRequest, reduceAppendChunk, reduceCancel } = await import('@/store/aiStore');
    let slice = reduceStartRequest('req-1', 'inline-edit');
    slice = reduceAppendChunk(slice, 'in progress');
    slice = reduceCancel();
    expect(slice.requestState).toBe('idle');
    expect(slice.streamBuffer).toBe('');
    expect(slice.requestId).toBeNull();
    expect(slice.feature).toBeNull();
    expect(slice.errorInfo).toBeNull();
  });
});

describe('aiStore: store integration', () => {
  beforeEach(async () => {
    const { useAiStore, idleSlice } = await import('@/store/aiStore');
    useAiStore.setState({ ...idleSlice, sessionRequestCount: 0 });
    localStorage.clear();
  });

  it('startRequest → appendChunk → completeRequest drives store state', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    useAiStore.getState().startRequest('req-42', 'section-fill');
    expect(useAiStore.getState().requestState).toBe('streaming');
    expect(useAiStore.getState().feature).toBe('section-fill');

    useAiStore.getState().appendChunk('a');
    useAiStore.getState().appendChunk('b');
    expect(useAiStore.getState().streamBuffer).toBe('ab');

    useAiStore.getState().completeRequest('final');
    expect(useAiStore.getState().requestState).toBe('done');
    expect(useAiStore.getState().streamBuffer).toBe('final');
  });

  it('cancelRequest resets a streaming request to idle', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    useAiStore.getState().startRequest('req-1', 'inline-edit');
    useAiStore.getState().appendChunk('half done');
    useAiStore.getState().cancelRequest();
    expect(useAiStore.getState().requestState).toBe('idle');
    expect(useAiStore.getState().streamBuffer).toBe('');
    expect(useAiStore.getState().requestId).toBeNull();
  });

  it('incrementCount increases the session request counter', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    expect(useAiStore.getState().sessionRequestCount).toBe(0);
    useAiStore.getState().incrementCount();
    useAiStore.getState().incrementCount();
    expect(useAiStore.getState().sessionRequestCount).toBe(2);
  });

  it('is NOT persisted — mutating the store writes nothing to localStorage', async () => {
    const { useAiStore } = await import('@/store/aiStore');
    useAiStore.getState().startRequest('req-1', 'inline-edit');
    useAiStore.getState().appendChunk('data');
    useAiStore.getState().incrementCount();
    // A persist-wrapped store would flush a key here; a transient store must not.
    expect(localStorage.length).toBe(0);
  });
});
