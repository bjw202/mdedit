// @MX:ANCHOR: [AUTO] SettingsModal - AI 설정·감지·온보딩·정책의 단일 진입 다이얼로그
// @MX:REASON: [AUTO] Header 톱니 진입점이자 AI 활성/연결/온보딩/정책 잠금 상태를 모두 렌더하는
//   유일한 설정 표면 — AppLayout 마운트 + 향후 비 AI 설정도 여기 흡수(설계 §8.2)
// @MX:SPEC: SPEC-AI-001 REQ-AI-010 REQ-AI-011 REQ-AI-015 REQ-AI-017

import { useCallback, useEffect, useState } from 'react';
import { aiDetectProviders, aiPolicyStatus } from '@/lib/tauri/ipc';
import type { AiProviderStatus, AiPolicyStatus, AiModel } from '@/lib/tauri/ipc';
import { useUIStore } from '@/store/uiStore';

/** AI 도구 연결 상태(설계 §8.2 상태별 동작). */
export type AiConnectionState =
  | 'loading'
  | 'available'
  | 'connect-needed'
  | 'not-installed'
  | 'policy-locked';

// @MX:NOTE: 감지 신호 우선순위(설계 §8.2). 정책 kill-switch 가 최상위 — 설치·로그인과 무관하게
// AI 를 강제 비활성화한다(REQ-AI-017).
/** provider/policy 감지 결과를 연결 상태로 환원하는 순수 함수. */
export function deriveConnectionState(
  provider: AiProviderStatus | undefined,
  policy: AiPolicyStatus | undefined,
): AiConnectionState {
  if (!provider || !policy) return 'loading';
  if (policy.disabled) return 'policy-locked';
  if (!provider.installed) return 'not-installed';
  if (!provider.loggedIn) return 'connect-needed';
  return 'available';
}

/** 설치 명령(크로스플랫폼 동일 — npm 전역 설치). 온보딩 복사 버튼이 이 값을 클립보드로 넘긴다. */
const INSTALL_COMMAND = 'npm install -g @anthropic-ai/claude-code';

// @MX:NOTE: Windows 우선 판정(주 사용자 Windows, 설계 §8.2). ua 인자는 테스트 주입용.
/** userAgent 로 OS 를 판정한다(Windows 우선). */
export function detectOs(ua: string = navigator.userAgent): 'windows' | 'macos' | 'linux' {
  const s = ua.toLowerCase();
  if (s.includes('win')) return 'windows';
  if (s.includes('mac')) return 'macos';
  return 'linux';
}

// @MX:NOTE: 기본 haiku, "고급 모델" 토글 시 sonnet(설계 §8.2, REQ-AI-016). ↻ 3회 단발 폴백과 독립.
/** 고급 모델 토글 값을 실제 모델 id 로 환원한다. */
export function resolveModel(advanced: boolean): AiModel {
  return advanced ? 'sonnet' : 'haiku';
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

/** 다이얼로그 패널 공통 인라인 스타일(토큰만, raw hex 금지). */
const panelStyle: React.CSSProperties = {
  background: 'var(--md-surface-raised)',
  color: 'var(--md-text-primary)',
  border: '1px solid var(--md-border)',
  borderRadius: 'var(--md-radius-lg)',
  boxShadow: 'var(--md-shadow-lg)',
  fontFamily: 'var(--md-font-ui)',
  width: 'min(520px, 92vw)',
  maxHeight: '86vh',
  overflowY: 'auto',
  padding: 'var(--md-space-5)',
};

// 백드롭 스크림은 토큰 기반 클래스(.mdedit-ai-modal-backdrop, mdedit-components.css)로 정의한다.
// raw hex 를 컴포넌트에서 제거하기 위한 이동(T-019 part 2, --md 토큰 color-mix 스크림).

/**
 * 설정 다이얼로그. Header 톱니에서 열리며 첫 섹션은 AI 다(REQ-AI-011).
 * 열릴 때마다 설치·로그인·정책을 재감지하고(REQ-AI-012 선제 판정), 상태별 UI 를 렌더한다.
 * Esc·백드롭 클릭으로 닫힌다(TableGridPicker 팝오버 닫힘 관례).
 */
export function SettingsModal({ open, onClose }: SettingsModalProps): JSX.Element | null {
  const [provider, setProvider] = useState<AiProviderStatus>();
  const [policy, setPolicy] = useState<AiPolicyStatus>();
  const [showWizard, setShowWizard] = useState(false);

  const detect = useCallback(async (): Promise<void> => {
    const [providers, pol] = await Promise.all([aiDetectProviders(), aiPolicyStatus()]);
    setProvider(providers.find((p) => p.id === 'claude'));
    setPolicy(pol);
  }, []);

  // 열릴 때마다 상태를 비우고 재감지 — 미로그인/정책 변화를 첫 클릭 실패 없이 선반영한다.
  useEffect(() => {
    if (!open) return;
    setProvider(undefined);
    setPolicy(undefined);
    setShowWizard(false);
    void detect();
  }, [open, detect]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const state = deriveConnectionState(provider, policy);

  return (
    <div className="mdedit-ai-modal-backdrop" data-testid="settings-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="설정"
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontFamily: 'var(--md-font-display)',
            fontSize: 'var(--md-fs-wordmark)',
            margin: 0,
            marginBottom: 'var(--md-space-4)',
          }}
        >
          설정
        </h2>

        <section aria-label="AI">
          <h3 style={{ fontSize: 14, margin: 0, marginBottom: 'var(--md-space-3)' }}>AI 도구</h3>
          {showWizard && state !== 'available' && state !== 'policy-locked' ? (
            <OnboardingWizard onRecheck={detect} />
          ) : (
            <AiSection
              state={state}
              provider={provider}
              onStartOnboarding={() => setShowWizard(true)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

interface AiSectionProps {
  state: AiConnectionState;
  provider: AiProviderStatus | undefined;
  onStartOnboarding: () => void;
}

/** 감지 상태별 AI 섹션 본문. */
function AiSection({ state, provider, onStartOnboarding }: AiSectionProps): JSX.Element {
  const mutedRow: React.CSSProperties = { color: 'var(--md-text-muted)', fontSize: 13 };

  switch (state) {
    case 'loading':
      return <p style={mutedRow}>감지 중...</p>;

    case 'available':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--md-space-3)' }}>
          <NoticeBanner />
          <p style={{ fontSize: 13, margin: 0 }}>
            Claude Code{' '}
            <span style={{ color: 'var(--md-success)' }}>
              ✅ 사용 가능{provider?.version ? ` (v${provider.version})` : ''}
            </span>
          </p>
          <AiEnabledToggle disabled={false} />
          <AdvancedModelToggle disabled={false} />
        </div>
      );

    case 'connect-needed':
      return (
        <div>
          <p style={{ fontSize: 13, marginBottom: 'var(--md-space-3)' }}>
            Claude Code{' '}
            <span style={{ color: 'var(--md-dirty)' }}>연결 필요</span> — 로그인이 필요해요.
          </p>
          <button type="button" className="md-btn" onClick={onStartOnboarding}>
            연결 안내 보기
          </button>
        </div>
      );

    case 'not-installed':
      return (
        <div>
          <p style={{ fontSize: 13, marginBottom: 'var(--md-space-3)' }}>
            Claude Code가 설치되어 있지 않아요.
          </p>
          <button type="button" className="md-btn" onClick={onStartOnboarding}>
            설치 안내 보기
          </button>
        </div>
      );

    case 'policy-locked':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--md-space-3)' }}>
          <p style={mutedRow}>조직 정책으로 AI 기능이 비활성화되어 있어요 (토글 잠금).</p>
          <AiEnabledToggle disabled />
          <AdvancedModelToggle disabled />
        </div>
      );
  }
}

// @MX:NOTE: 데이터 전송 고지는 1회만 표시하고 확인 여부를 영속화한다(REQ-AI-013). "로컬 CLI =
// 프라이버시" 오해를 막기 위해 프롬프트가 클라우드로 전송됨을 명시한다(설계 §1 정직성 원칙).
/** AI 데이터 전송 고지 배너 — 확인 전까지 1회 표시. */
function NoticeBanner(): JSX.Element | null {
  const acknowledged = useUIStore((s) => s.aiNoticeAcknowledged);
  const setAcknowledged = useUIStore((s) => s.setAiNoticeAcknowledged);

  if (acknowledged) return null;

  return (
    <div
      data-testid="ai-notice-banner"
      role="note"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--md-space-3)',
        background: 'var(--md-accent-soft)',
        border: '1px solid var(--md-border)',
        borderRadius: 'var(--md-radius-md)',
        padding: 'var(--md-space-3)',
        fontSize: 12.5,
      }}
    >
      <p style={{ margin: 0, flex: 1, color: 'var(--md-text-muted)' }}>
        Claude로 AI 기능을 사용합니다. 선택한 텍스트와 문서 일부가 처리를 위해 전송됩니다.
      </p>
      <button type="button" className="md-btn" onClick={() => setAcknowledged(true)}>
        확인
      </button>
    </div>
  );
}

// @MX:SPEC: SPEC-AI-005 REQ-AI5-004 REQ-AI5-005 REQ-AI5-006
// @MX:NOTE: AI 기능 전체 켜기/끄기 토글(SPEC-AI-005) — AdvancedModelToggle 과 동일한 disabled+🔒
// 정책 잠금 관례를 따른다. onChange 는 setAiEnabled 로만 반영하고, ON→OFF 전이의 취소·정리
// 부수효과는 aiOffEffects.ts 의 store subscribe 가 별도로 담당한다(관심사 분리, D3).
/** AI 기능 사용자 켜기/끄기 토글. 정책 잠금 시 disabled + 자물쇠 표기(REQ-AI5-005). */
function AiEnabledToggle({ disabled }: { disabled: boolean }): JSX.Element {
  const aiEnabled = useUIStore((s) => s.aiEnabled);
  const setAiEnabled = useUIStore((s) => s.setAiEnabled);

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--md-space-2)',
        fontSize: 13,
        color: disabled ? 'var(--md-text-faint)' : 'var(--md-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      title="AI 기능(✨ 편집·힌트·이어쓰기)을 전체 켜고 끕니다."
    >
      <input
        type="checkbox"
        aria-label="AI 기능 사용"
        checked={aiEnabled}
        disabled={disabled}
        onChange={(e) => setAiEnabled(e.target.checked)}
      />
      AI 기능 사용{disabled ? ' 🔒' : ''}
    </label>
  );
}

/** 고급 모델(sonnet) 사용 토글. 정책 잠금 시 disabled + 자물쇠 표기. */
function AdvancedModelToggle({ disabled }: { disabled: boolean }): JSX.Element {
  const advanced = useUIStore((s) => s.aiAdvancedModel);
  const setAdvanced = useUIStore((s) => s.setAiAdvancedModel);

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--md-space-2)',
        fontSize: 13,
        color: disabled ? 'var(--md-text-faint)' : 'var(--md-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        aria-label="고급 모델 사용 (sonnet)"
        checked={advanced}
        disabled={disabled}
        onChange={(e) => setAdvanced(e.target.checked)}
      />
      고급 모델 사용 (sonnet — 더 정확, 더 느림){disabled ? ' 🔒' : ''}
    </label>
  );
}

// @MX:NOTE: 앱 내 완결 위저드 — 외부 링크·"터미널에서 claude 실행 후 다시 시도" 식 미완결
// 지시로 앱 밖 방치하지 않는다(REQ-AI-018). 마지막 단계의 [다시 확인]이 재감지로 흐름을 닫는다.
/** 온보딩 위저드: OS 감지 → 설치 명령 복사 → 터미널 안내 → 로그인 → 재감지(설계 §8.2). */
function OnboardingWizard({ onRecheck }: { onRecheck: () => Promise<void> }): JSX.Element {
  const os = detectOs();
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const terminalHint =
    os === 'windows'
      ? 'PowerShell 또는 명령 프롬프트를 여세요.'
      : '터미널을 여세요.';

  const steps: Array<{ title: string; body: JSX.Element }> = [
    {
      title: '1. 설치',
      body: (
        <div>
          <p style={{ fontSize: 13, marginBottom: 'var(--md-space-2)' }}>
            아래 명령을 복사해 실행하세요.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--md-space-2)' }}>
            <code
              style={{
                fontFamily: 'var(--md-font-mono)',
                fontSize: 12,
                background: 'var(--md-code-bg)',
                borderRadius: 'var(--md-radius-sm)',
                padding: '4px 6px',
                flex: 1,
                overflowX: 'auto',
              }}
            >
              {INSTALL_COMMAND}
            </code>
            <button
              type="button"
              className="md-btn"
              aria-label="설치 명령 복사"
              onClick={() => {
                void navigator.clipboard.writeText(INSTALL_COMMAND);
                setCopied(true);
              }}
            >
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
        </div>
      ),
    },
    {
      title: '2. 터미널 열기',
      body: <p style={{ fontSize: 13 }}>{terminalHint}</p>,
    },
    {
      title: '3. 로그인',
      body: (
        <p style={{ fontSize: 13 }}>
          설치가 끝나면 안내에 따라 Claude에 로그인하세요.
        </p>
      ),
    },
    {
      title: '4. 확인',
      body: (
        <p style={{ fontSize: 13 }}>
          준비가 되면 아래 [다시 확인]을 누르세요. 앱이 다시 감지합니다.
        </p>
      ),
    },
  ];

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <div aria-label="연결 안내">
      <h4 style={{ fontSize: 13, margin: 0, marginBottom: 'var(--md-space-3)' }}>
        연결 안내 — {steps[step].title}
      </h4>
      {steps[step].body}
      <div
        style={{
          display: 'flex',
          gap: 'var(--md-space-2)',
          marginTop: 'var(--md-space-4)',
        }}
      >
        {!isFirst && (
          <button type="button" className="md-btn" onClick={() => setStep((s) => s - 1)}>
            이전
          </button>
        )}
        {!isLast && (
          <button type="button" className="md-btn" onClick={() => setStep((s) => s + 1)}>
            다음
          </button>
        )}
        {isLast && (
          <button type="button" className="md-btn" onClick={() => void onRecheck()}>
            다시 확인
          </button>
        )}
      </div>
    </div>
  );
}
