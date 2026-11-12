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

  it('connect-needed → shows "로그인 필요" row badge (installed but not logged in, v0.0.4 row wording)', async () => {
    detectMock.mockResolvedValue([{ ...installed, loggedIn: false }]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    expect(await screen.findByText(/로그인 필요/)).toBeInTheDocument();
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

describe('SettingsModal: notice banner + policy lock (T-011)', () => {
  beforeEach(() => {
    useUIStore.setState({ aiNoticeAcknowledged: false, aiModels: { claude: 'haiku', codex: null } });
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

// @MX:SPEC: SPEC-AI-009 REQ-AI9-027
// 행 상태 파생 순수 함수 — 렌더 없이 직접 호출 가능(AC-AI9-017). deriveProviderRowState 는
// 대상 provider 자신의 ProviderStatus 하나만 입력으로 받는다(다른 provider·deriveConnectionState
// 의존 없음).
describe('deriveProviderRowState: 행별 상태 파생 순수 함수 (AC-AI9-017)', () => {
  it('installed+loggedIn → "사용 가능" + selectable', async () => {
    const { deriveProviderRowState } = await import('@/components/settings/SettingsModal');
    const s = deriveProviderRowState({ id: 'claude', installed: true, loggedIn: true });
    expect(s.label).toBe('사용 가능');
    expect(s.selectable).toBe(true);
  });

  it('installed+!loggedIn → "로그인 필요" + not selectable', async () => {
    const { deriveProviderRowState } = await import('@/components/settings/SettingsModal');
    const s = deriveProviderRowState({ id: 'claude', installed: true, loggedIn: false });
    expect(s.label).toBe('로그인 필요');
    expect(s.selectable).toBe(false);
  });

  it('!installed → "미설치" + not selectable, regardless of loggedIn', async () => {
    const { deriveProviderRowState } = await import('@/components/settings/SettingsModal');
    expect(
      deriveProviderRowState({ id: 'codex', installed: false, loggedIn: true }).label,
    ).toBe('미설치');
    const s = deriveProviderRowState({ id: 'codex', installed: false, loggedIn: false });
    expect(s.label).toBe('미설치');
    expect(s.selectable).toBe(false);
  });
});

// @MX:SPEC: SPEC-AI-014 REQ-AI14-001 REQ-AI14-003 REQ-AI14-006
// 도구별 모델 드롭다운(AC-001·005·007). 선택지는 백엔드가 내려준 models 만 쓴다.
describe('SettingsModal: 도구별 모델 드롭다운 (SPEC-AI-014)', () => {
  const both = [
    {
      id: 'claude',
      installed: true,
      loggedIn: true,
      models: [
        { id: 'haiku', label: 'Haiku' },
        { id: 'opus', label: 'Opus' },
      ],
    },
    { id: 'codex', installed: true, loggedIn: true, models: [{ id: 'm-a', label: 'M A' }] },
  ];

  beforeEach(() => {
    useUIStore.setState({
      aiNoticeAcknowledged: true,
      aiSelectedProvider: 'auto',
      aiModels: { claude: 'haiku', codex: null },
    });
    localStorage.clear();
  });

  const optionTexts = (sel: HTMLElement) =>
    Array.from((sel as HTMLSelectElement).options).map((o) => o.textContent);

  it('AC-001: 고급 모델 토글이 없고 저장소에도 aiAdvancedModel 키가 없다', async () => {
    detectMock.mockResolvedValue(both);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    await screen.findByRole('combobox', { name: 'Claude 모델' });
    expect(screen.queryByRole('checkbox', { name: /고급 모델/ })).toBeNull();
    expect(screen.queryByText(/고급 모델/)).toBeNull();
    expect('aiAdvancedModel' in useUIStore.getState()).toBe(false);
  });

  it('AC-005: 두 드롭다운, 선택지 텍스트, 텍스트 입력 없음, 선택이 저장소에 반영된다', async () => {
    detectMock.mockResolvedValue(both);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const claude = await screen.findByRole('combobox', { name: 'Claude 모델' });
    const codex = screen.getByRole('combobox', { name: 'Codex 모델' });
    expect(optionTexts(claude)).toEqual(['CLI 기본값', 'Haiku', 'Opus']);
    expect(optionTexts(codex)).toEqual(['CLI 기본값', 'M A']);
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.change(claude, { target: { value: 'opus' } });
    expect(useUIStore.getState().aiModels.claude).toBe('opus');
    fireEvent.change(claude, { target: { value: '' } });
    expect(useUIStore.getState().aiModels.claude).toBeNull();
    fireEvent.change(codex, { target: { value: 'm-a' } });
    expect(useUIStore.getState().aiModels.codex).toBe('m-a');
  });

  it('AC-005: 정책 잠금이면 두 드롭다운이 비활성이다', async () => {
    policyMock.mockResolvedValue({ disabled: true, source: 'env' });
    detectMock.mockResolvedValue(both);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    expect(await screen.findByRole('combobox', { name: 'Claude 모델' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Codex 모델' })).toBeDisabled();
  });

  it('AC-005: codex 미설치면 codex 드롭다운이 비활성이다', async () => {
    detectMock.mockResolvedValue([both[0], { id: 'codex', installed: false, loggedIn: false }]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    expect(await screen.findByRole('combobox', { name: 'Codex 모델' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Claude 모델' })).not.toBeDisabled();
  });

  it('AC-005: codex 설치·미로그인이면 codex 드롭다운이 비활성이다', async () => {
    detectMock.mockResolvedValue([both[0], { id: 'codex', installed: true, loggedIn: false }]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    expect(await screen.findByRole('combobox', { name: 'Codex 모델' })).toBeDisabled();
  });

  it('AC-007: 목록에 없는 저장값은 "(목록에 없음)"으로 보이고 저장소는 그대로다', async () => {
    useUIStore.setState({ aiModels: { claude: 'haiku', codex: 'gone-model' } });
    detectMock.mockResolvedValue(both);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const codex = (await screen.findByRole('combobox', { name: 'Codex 모델' })) as HTMLSelectElement;
    expect(codex.selectedOptions[0].textContent).toBe('gone-model (목록에 없음)');
    expect(useUIStore.getState().aiModels.codex).toBe('gone-model');
  });
});

// @MX:SPEC: SPEC-AI-009 REQ-AI9-026 REQ-AI9-028 REQ-AI9-029 REQ-AI9-030 REQ-AI9-031 REQ-AI9-032
// 대등 provider 행 목록(결함 2 수정, v0.0.4) — AC-AI9-016~019. 드롭다운(AiProviderSelect)은
// 제거되고 registry 순서를 그대로 순회하는 라디오 행 목록으로 대체된다.
describe('SettingsModal: 대등 provider 행 목록 (SPEC-AI-009 v0.0.4, AC-AI9-016~019)', () => {
  beforeEach(() => {
    useUIStore.setState({ aiNoticeAcknowledged: true, aiSelectedProvider: 'auto' });
    localStorage.clear();
  });

  it('두 provider 모두 사용 가능 → 형태가 동일한 행 2개, registry 순서(claude, codex) 그대로 렌더 (AC-AI9-016)', async () => {
    detectMock.mockResolvedValue([
      { id: 'claude', installed: true, version: '2.1.218', loggedIn: true },
      { id: 'codex', installed: true, version: '0.144.1', loggedIn: true },
    ]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(2);
    // 동일 name 그룹
    const names = new Set(radios.map((r) => (r as HTMLInputElement).name));
    expect(names.size).toBe(1);
    // DOM 순서 = registry(IPC) 반환 순서
    expect(radios[0]).toHaveAccessibleName(/Claude/i);
    expect(radios[1]).toHaveAccessibleName(/codex/i);
    expect(screen.getByText(/2\.1\.218/)).toBeInTheDocument();
    expect(screen.getByText(/0\.144\.1/)).toBeInTheDocument();
  });

  it('3번째 provider mock에서도 SettingsModal.tsx 무수정 3행 렌더 (registry 순서 구동, REQ-AI9-029)', async () => {
    detectMock.mockResolvedValue([
      { id: 'claude', installed: true, version: '2.1.218', loggedIn: true },
      { id: 'codex', installed: true, version: '0.144.1', loggedIn: true },
      { id: 'gemini', installed: true, version: '1.0.0', loggedIn: true },
    ]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[2]).toHaveAccessibleName(/gemini/i);
  });

  it('version 이 undefined 인 provider 는 버전 요소만 생략하고 나머지 3요소는 유지 (REQ-AI9-026)', async () => {
    detectMock.mockResolvedValue([{ id: 'claude', installed: true, loggedIn: true }]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(1);
    expect(screen.getByText(/사용 가능/)).toBeInTheDocument();
  });

  it('미사용 행은 disabled + 클릭해도 aiSelectedProvider 무변경 + 사유 인라인 + 온보딩 진입점 보존 (AC-AI9-018)', async () => {
    detectMock.mockResolvedValue([
      { id: 'claude', installed: true, loggedIn: false },
      { id: 'codex', installed: false, loggedIn: false },
    ]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const radios = await screen.findAllByRole('radio');
    expect(radios[0]).toBeDisabled(); // claude: 로그인 필요
    expect(radios[1]).toBeDisabled(); // codex: 미설치

    fireEvent.click(radios[0]);
    expect(useUIStore.getState().aiSelectedProvider).toBe('auto'); // 무변경(선택 거부)

    // 사유가 그 행 안에 인라인으로 존재한다.
    expect(screen.getByText(/로그인 필요/)).toBeInTheDocument();
    expect(screen.getByText(/미설치/)).toBeInTheDocument();

    // installed && !loggedIn 행에는 온보딩 진입 컨트롤이 있다.
    const onboardingBtn = screen.getByRole('button', { name: /연결 안내/ });
    fireEvent.click(onboardingBtn);
    expect(await screen.findByLabelText('연결 안내')).toBeInTheDocument();
  });

  it('아리아 라벨 "AI 엔진 선택" 드롭다운은 DOM에 부재 — 두 표면 공존 금지 (REQ-AI9-030)', async () => {
    detectMock.mockResolvedValue([
      { id: 'claude', installed: true, version: '2.1.218', loggedIn: true },
      { id: 'codex', installed: true, version: '0.144.1', loggedIn: true },
    ]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    await screen.findAllByRole('radio');
    expect(screen.queryByLabelText('AI 엔진 선택')).toBeNull();
    // 모델 드롭다운(SPEC-AI-014)은 엔진 선택이 아니다 — 엔진 선택용 combobox 만 없어야 한다.
    expect(screen.queryByRole('combobox', { name: /엔진/ })).toBeNull();
  });

  it('codex 행 선택 시 aiSelectedProvider 가 즉시 갱신되고 값 도메인은 무변경 (REQ-AI9-030(a))', async () => {
    detectMock.mockResolvedValue([
      { id: 'claude', installed: true, version: '2.1.218', loggedIn: true },
      { id: 'codex', installed: true, version: '0.144.1', loggedIn: true },
    ]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const radios = await screen.findAllByRole('radio');
    fireEvent.click(radios[1]);
    expect(useUIStore.getState().aiSelectedProvider).toBe('codex');
  });

  it('정책 잠금 시 전 행 radio 가 disabled + 🔒 렌더, 선택 변경 경로 없음 (REQ-AI9-031)', async () => {
    policyMock.mockResolvedValue({ disabled: true, source: 'env' });
    detectMock.mockResolvedValue([
      { id: 'claude', installed: true, version: '2.1.218', loggedIn: true },
      { id: 'codex', installed: true, version: '0.144.1', loggedIn: true },
    ]);
    const { SettingsModal } = await import('@/components/settings/SettingsModal');
    render(<SettingsModal open onClose={() => {}} />);
    const radios = await screen.findAllByRole('radio');
    expect(radios.every((r) => (r as HTMLInputElement).disabled)).toBe(true);
    expect(screen.getAllByText(/🔒/).length).toBeGreaterThan(0);

    fireEvent.click(radios[1]);
    expect(useUIStore.getState().aiSelectedProvider).toBe('auto');
  });

  it('SettingsModal.tsx 소스는 id 하드코딩 조회(providers.find) 대신 배열 순회만 사용한다 (REQ-AI9-029)', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/components/settings/SettingsModal.tsx', 'utf-8');
    expect(src).not.toMatch(/providers\.find\(\s*\(?p\)?\s*=>\s*p\.id\s*===\s*['"]claude['"]/);
    expect(src).not.toMatch(/Claude Code\s*\{/); // 개정 전 하드코딩 상태 블록 리터럴 제거
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
