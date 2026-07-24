// @MX:SPEC: SPEC-AI-001 REQ-AI-010 REQ-AI-011 REQ-AI-015
// SettingsModal — AI 섹션이 감지 상태별로 렌더되는지, Esc/백드롭 닫힘이 되는지 검증.
// TDD RED phase: written before src/components/settings/SettingsModal.tsx exists.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';

// ipc 감지 래퍼만 모킹 — SettingsModal 은 aiDetectProviders/aiPolicyStatus 만 사용한다.
const detectMock = vi.fn();
const policyMock = vi.fn();
vi.mock('@/lib/tauri/ipc', () => ({
  aiDetectProviders: () => detectMock(),
  aiPolicyStatus: () => policyMock(),
}));

const installed = { id: 'claude' as const, installed: true, version: '2.1.211', loggedIn: true };

beforeEach(() => {
  detectMock.mockReset();
  policyMock.mockReset();
  detectMock.mockResolvedValue([installed]);
  policyMock.mockResolvedValue({ disabled: false });
});
afterEach(() => cleanup());

describe('deriveConnectionState: pure state machine', () => {
  it('policy disabled dominates every other signal', async () => {
    const { deriveConnectionState } = await import('@/components/settings/SettingsModal');
    expect(deriveConnectionState(installed, { disabled: true, source: 'env' })).toBe('policy-locked');
  });

  it('maps installed+loggedIn → available, installed+!loggedIn → connect-needed, !installed → not-installed', async () => {
    const { deriveConnectionState } = await import('@/components/settings/SettingsModal');
    const policy = { disabled: false };
    expect(deriveConnectionState({ ...installed, loggedIn: true }, policy)).toBe('available');
    expect(deriveConnectionState({ ...installed, loggedIn: false }, policy)).toBe('connect-needed');
    expect(deriveConnectionState({ id: 'claude', installed: false, loggedIn: false }, policy)).toBe('not-installed');
  });

  it('undefined provider/policy is still loading', async () => {
    const { deriveConnectionState } = await import('@/components/settings/SettingsModal');
    expect(deriveConnectionState(undefined, undefined)).toBe('loading');
  });
});

describe('SettingsModal: open/close', () => {
  it('renders nothing when closed', async () => {
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a dialog with an AI section first when open', async () => {
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'AI' })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={onClose} />);
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click but not on panel click', async () => {
    const onClose = vi.fn();
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={onClose} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('settings-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsModal: AI detection states', () => {
  it('available → shows "사용 가능" with the detected version', async () => {
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    expect(await screen.findByText(/사용 가능/)).toBeInTheDocument();
    expect(screen.getByText(/2\.1\.211/)).toBeInTheDocument();
  });

  it('connect-needed → shows "연결 필요" (installed but not logged in)', async () => {
    detectMock.mockResolvedValue([{ ...installed, loggedIn: false }]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    expect(await screen.findByText(/연결 필요/)).toBeInTheDocument();
  });

  it('not-installed → shows onboarding entry', async () => {
    detectMock.mockResolvedValue([{ id: 'claude', installed: false, loggedIn: false }]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    // 온보딩 진입 버튼(설치 안내)이 나타난다.
    expect(await screen.findByRole('button', { name: /설치 안내|연결 안내/ })).toBeInTheDocument();
  });

  it('policy-locked → shows a lock message and no enabled AI toggle', async () => {
    policyMock.mockResolvedValue({ disabled: true, source: 'env' });
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    expect(await screen.findByText(/정책|잠금|비활성/)).toBeInTheDocument();
  });

  it('re-detects each time it is opened', async () => {
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    const { rerender } = render(<SettingsModal open={false} onClose={() => {}} />);
    rerender(<SettingsModal open onClose={() => {}} />);
    await waitFor(() => expect(detectMock).toHaveBeenCalledTimes(1));
  });
});

describe('detectOs: Windows-first OS detection', () => {
  it('classifies Windows, macOS, and Linux user agents', async () => {
    const { detectOs } = await import('@/components/settings/SettingsModal');
    expect(detectOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
    expect(detectOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')).toBe('macos');
    expect(detectOs('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux');
  });
});

describe('SettingsModal: onboarding wizard (T-010)', () => {
  it('opens the wizard from the not-installed onboarding entry', async () => {
    detectMock.mockResolvedValue([{ id: 'claude', installed: false, loggedIn: false }]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /설치 안내/ }));
    expect(await screen.findByRole('button', { name: /설치 명령 복사/ })).toBeInTheDocument();
  });

  it('copies the install command to the clipboard', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    detectMock.mockResolvedValue([{ id: 'claude', installed: false, loggedIn: false }]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /설치 안내/ }));
    fireEvent.click(await screen.findByRole('button', { name: /설치 명령 복사/ }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('claude-code')),
    );
  });

  it('navigates wizard steps forward and back', async () => {
    detectMock.mockResolvedValue([{ id: 'claude', installed: false, loggedIn: false }]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /설치 안내/ }));
    // 첫 단계에는 이전 버튼이 없다.
    expect(screen.queryByRole('button', { name: /이전/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /다음/ }));
    // 다음 단계로 이동하면 이전 버튼이 나타난다.
    expect(screen.getByRole('button', { name: /이전/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /이전/ }));
    expect(screen.queryByRole('button', { name: /이전/ })).toBeNull();
  });

  it('[다시 확인] re-runs detection (in-app completion, no dead-end)', async () => {
    detectMock.mockResolvedValue([{ id: 'claude', installed: false, loggedIn: false }]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /설치 안내/ }));
    // 마지막 단계까지 진행: 설치 → 터미널 → 로그인 → 확인
    fireEvent.click(screen.getByRole('button', { name: /다음/ })); // → 터미널
    fireEvent.click(screen.getByRole('button', { name: /다음/ })); // → 로그인
    fireEvent.click(screen.getByRole('button', { name: /다음/ })); // → 확인
    const before = detectMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /다시 확인/ }));
    await waitFor(() => expect(detectMock.mock.calls.length).toBe(before + 1));
  });
});

describe('resolveModel: advanced toggle → model id', () => {
  it('advanced ON → sonnet, OFF → haiku', async () => {
    const { resolveModel } = await import('@/components/settings/SettingsModal');
    expect(resolveModel(true)).toBe('sonnet');
    expect(resolveModel(false)).toBe('haiku');
  });
});

describe('SettingsModal: notice banner + advanced toggle + policy lock (T-011)', () => {
  beforeEach(() => {
    useUIStore.setState({ aiNoticeAcknowledged: false, aiAdvancedModel: false });
    localStorage.clear();
  });

  it('shows the one-time data-transfer notice when available and not acknowledged', async () => {
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const banner = await screen.findByTestId('ai-notice-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/전송/);
  });

  it('dismisses the notice on 확인 and persists the acknowledgement', async () => {
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    await screen.findByTestId('ai-notice-banner');
    fireEvent.click(screen.getByRole('button', { name: /확인/ }));
    expect(screen.queryByTestId('ai-notice-banner')).toBeNull();
    expect(useUIStore.getState().aiNoticeAcknowledged).toBe(true);
  });

  it('does not show the notice again once acknowledged', async () => {
    useUIStore.setState({ aiNoticeAcknowledged: true });
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    await screen.findByText(/사용 가능/);
    expect(screen.queryByTestId('ai-notice-banner')).toBeNull();
  });

  it('advanced-model toggle reflects and persists aiAdvancedModel', async () => {
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const toggle = await screen.findByRole('checkbox', { name: /고급 모델/ });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(useUIStore.getState().aiAdvancedModel).toBe(true);
  });

  it('policy-locked disables the advanced-model toggle (lock indicator)', async () => {
    policyMock.mockResolvedValue({ disabled: true, source: 'env' });
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const toggle = await screen.findByRole('checkbox', { name: /고급 모델/ });
    expect(toggle).toBeDisabled();
  });
});

describe('SettingsModal: continue length toggle (SPEC-AI-006 REQ-AI6-012)', () => {
  beforeEach(() => {
    useUIStore.setState({ aiContinueLength: 'normal' });
    localStorage.clear();
  });

  it('defaults unchecked (normal) and sets aiContinueLength to "short" on click', async () => {
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const toggle = await screen.findByRole('checkbox', { name: /이어쓰기 짧게/ });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(useUIStore.getState().aiContinueLength).toBe('short');
  });

  it('reflects a persisted "short" value as checked', async () => {
    useUIStore.setState({ aiContinueLength: 'short' });
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const toggle = await screen.findByRole('checkbox', { name: /이어쓰기 짧게/ });
    expect(toggle).toBeChecked();
  });

  it('policy-locked disables the continue-length toggle (lock indicator)', async () => {
    policyMock.mockResolvedValue({ disabled: true, source: 'env' });
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const toggle = await screen.findByRole('checkbox', { name: /이어쓰기 짧게/ });
    expect(toggle).toBeDisabled();
  });
});

describe('SettingsModal: AI provider dropdown (SPEC-AI-009)', () => {
  beforeEach(() => {
    useUIStore.setState({ aiNoticeAcknowledged: true, aiSelectedProvider: 'auto' });
    localStorage.clear();
  });

  it('renders the AI provider dropdown with "자동 감지" option when available', async () => {
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const select = await screen.findByRole('combobox', { name: /AI 엔진/ });
    expect(select).toBeInTheDocument();
    // 기본값: 자동 감지
    expect((select as HTMLSelectElement).value).toBe('auto');
  });

  it('selecting "codex" updates aiSelectedProvider immediately', async () => {
    // codex 설치+로그인, claude 도 사용 가능 → 두 옵션 모두 활성
    detectMock.mockResolvedValue([
      { id: 'claude', installed: true, version: '2.1.211', loggedIn: true },
      { id: 'codex', installed: true, version: '0.1.0', loggedIn: true },
    ]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const select = await screen.findByRole('combobox', { name: /AI 엔진/ });
    fireEvent.change(select, { target: { value: 'codex' } });
    expect(useUIStore.getState().aiSelectedProvider).toBe('codex');
  });

  it('disables the codex option when codex is not installed', async () => {
    detectMock.mockResolvedValue([
      { id: 'claude', installed: true, version: '2.1.211', loggedIn: true },
      { id: 'codex', installed: false, loggedIn: false },
    ]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    await screen.findByRole('combobox', { name: /AI 엔진/ });
    // codex 옵션이 비활성 상태이고 설치 필요 안내가 보인다.
    const codexOption = screen.getByRole('option', { name: /codex.*설치 필요/ });
    expect((codexOption as HTMLOptionElement).disabled).toBe(true);
  });

  it('disables the claude option with "로그인 필요" when claude is installed but not logged in', async () => {
    detectMock.mockResolvedValue([
      { id: 'claude', installed: true, loggedIn: false },
      { id: 'codex', installed: true, version: '0.1.0', loggedIn: true },
    ]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    await screen.findByRole('combobox', { name: /AI 엔진/ });
    const claudeOption = screen.getByRole('option', { name: /Claude.*로그인 필요/ });
    expect((claudeOption as HTMLOptionElement).disabled).toBe(true);
  });

  it('reflects a persisted "codex" selection as the dropdown value', async () => {
    useUIStore.setState({ aiSelectedProvider: 'codex' });
    detectMock.mockResolvedValue([
      { id: 'claude', installed: true, version: '2.1.211', loggedIn: true },
      { id: 'codex', installed: true, version: '0.1.0', loggedIn: true },
    ]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const select = await screen.findByRole('combobox', { name: /AI 엔진/ });
    expect((select as HTMLSelectElement).value).toBe('codex');
  });

  it('policy-locked disables the dropdown with a lock indicator', async () => {
    policyMock.mockResolvedValue({ disabled: true, source: 'env' });
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const select = await screen.findByRole('combobox', { name: /AI 엔진/ });
    expect((select as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/AI 엔진.*🔒/)).toBeInTheDocument();
  });

  it('shows available state when only codex is usable (claude not installed)', async () => {
    // 다중 provider 감지 핵심 케이스: claude 가 없어도 codex 가 사용 가능하면 available 상태로
    // 드롭다운이 노출되어야 한다.
    detectMock.mockResolvedValue([
      { id: 'claude', installed: false, loggedIn: false },
      { id: 'codex', installed: true, version: '0.1.0', loggedIn: true },
    ]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const select = await screen.findByRole('combobox', { name: /AI 엔진/ });
    expect(select).toBeInTheDocument();
    // 자동 감지 옵션은 활성, claude 옵션은 비활성
    const autoOption = screen.getByRole('option', { name: /자동 감지/ });
    expect((autoOption as HTMLOptionElement).disabled).toBeFalsy();
  });
});

describe('SettingsModal: AI enabled toggle (SPEC-AI-005 T4)', () => {
  beforeEach(() => {
    useUIStore.setState({ aiNoticeAcknowledged: true, aiEnabled: true });
    localStorage.clear();
  });

  it('renders the AI enabled toggle reflecting the current aiEnabled value (REQ-AI5-004)', async () => {
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const toggle = await screen.findByRole('checkbox', { name: /AI 기능 사용/ });
    expect(toggle).toBeChecked();
  });

  it('reflects aiEnabled=false as unchecked', async () => {
    useUIStore.setState({ aiEnabled: false });
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const toggle = await screen.findByRole('checkbox', { name: /AI 기능 사용/ });
    expect(toggle).not.toBeChecked();
  });

  it('clicking the toggle calls setAiEnabled and updates state (REQ-AI5-006)', async () => {
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const toggle = await screen.findByRole('checkbox', { name: /AI 기능 사용/ });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(useUIStore.getState().aiEnabled).toBe(false);
  });

  it('policy-locked disables the AI enabled toggle with a lock indicator (REQ-AI5-005)', async () => {
    policyMock.mockResolvedValue({ disabled: true, source: 'env' });
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const toggle = await screen.findByRole('checkbox', { name: /AI 기능 사용/ });
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/AI 기능 사용 🔒/)).toBeInTheDocument();
  });
});
