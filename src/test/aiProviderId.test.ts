// @MX:SPEC: SPEC-AI-009 REQ-AI9-003
// resolveProviderId 가 uiStore.aiSelectedProvider 값을 aiRequest args 용 providerId 로
// 올바르게 환원하는지 검증한다. TDD RED phase: written before impl lands in aiPolicy.ts.
//
// 매핑 계약(백엔드 src-tauri/src/ai/provider.rs::ProviderRegistry::route 와 일치):
//   'auto'   → undefined  (백엔드가 first_available() 로 자동 감지, claude > codex)
//   'claude' → 'claude'   (claude 강제 라우팅)
//   'codex'  → 'codex'    (codex 강제 라우팅)

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';

beforeEach(() => {
  // 각 테스트 직전에 스토어를 깨끗한 기본값으로 되돌린다.
  useUIStore.setState({ aiSelectedProvider: 'auto' });
});

describe('resolveProviderId: aiSelectedProvider → providerId mapping (SPEC-AI-009)', () => {
  it('returns undefined for the default "auto" selection (backend auto-detect)', async () => {
    const { resolveProviderId } = await import('@/store/aiPolicy');
    expect(resolveProviderId()).toBeUndefined();
  });

  it('returns "claude" when aiSelectedProvider is "claude"', async () => {
    useUIStore.setState({ aiSelectedProvider: 'claude' });
    const { resolveProviderId } = await import('@/store/aiPolicy');
    expect(resolveProviderId()).toBe('claude');
  });

  it('returns "codex" when aiSelectedProvider is "codex"', async () => {
    useUIStore.setState({ aiSelectedProvider: 'codex' });
    const { resolveProviderId } = await import('@/store/aiPolicy');
    expect(resolveProviderId()).toBe('codex');
  });

  it('reflects live changes to aiSelectedProvider without re-import', async () => {
    const { resolveProviderId } = await import('@/store/aiPolicy');
    expect(resolveProviderId()).toBeUndefined();
    useUIStore.setState({ aiSelectedProvider: 'codex' });
    expect(resolveProviderId()).toBe('codex');
    useUIStore.setState({ aiSelectedProvider: 'claude' });
    expect(resolveProviderId()).toBe('claude');
    useUIStore.setState({ aiSelectedProvider: 'auto' });
    expect(resolveProviderId()).toBeUndefined();
  });
});
