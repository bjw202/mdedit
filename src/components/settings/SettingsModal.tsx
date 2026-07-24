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
  const [providers, setProviders] = useState<AiProviderStatus[]>([]);
  const [provider, setProvider] = useState<AiProviderStatus | undefined>(undefined);
  const [policy, setPolicy] = useState<AiPolicyStatus>();
  const [showWizard, setShowWizard] = useState(false);

  const detect = useCallback(async (): Promise<void> => {
    const [providerList, pol] = await Promise.all([aiDetectProviders(), aiPolicyStatus()]);
    setProviders(providerList);
    // 자동 감지 우선순위(claude > codex)로 "유효 provider"를 결정한다. installed+loggedIn 인
    // 첫 provider(레지스트리 순서 = 백엔드 first_available 와 동일)를, 없으면 claude, 그 외엔
    // 첫 항목을 picking 한다. deriveConnectionState 는 이 단일 provider 를 기준으로 동작한다(호환성).
    const effective =
      providerList.find((p) => p.installed && p.loggedIn) ??
      providerList.find((p) => p.id === 'claude') ??
      providerList[0];
    setProvider(effective);
    setPolicy(pol);
  }, []);

  // 열릴 때마다 상태를 비우고 재감지 — 미로그인/정책 변화를 첫 클릭 실패 없이 선반영한다.
  useEffect(() => {
    if (!open) return;
    setProviders([]);
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
              providers={providers}
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
  /** SPEC-AI-009 v0.0.4: 감지된 provider 배열 — registry 순서 그대로 대등한 행으로 렌더한다. */
  providers: AiProviderStatus[];
  onStartOnboarding: () => void;
}

/** 감지 상태별 AI 섹션 본문. loading 만 별도 분기 — 그 외에는 항상 대등 provider 행 목록을 렌더한다. */
function AiSection({ state, providers, onStartOnboarding }: AiSectionProps): JSX.Element {
  const mutedRow: React.CSSProperties = { color: 'var(--md-text-muted)', fontSize: 13 };

  if (state === 'loading') {
    return <p style={mutedRow}>감지 중...</p>;
  }

  // @MX:NOTE: [AUTO] M8.2.4: deriveConnectionState 는 여기서 섹션 수준 분기(loading/policy-locked
  // 안내 문구)에만 쓰인다 — 행 렌더 여부는 각 행의 deriveProviderRowState 만으로 결정된다
  // (REQ-AI9-029). policy-locked 여부만 전 행에 공통으로 전파한다(REQ-AI9-031).
  const policyLocked = state === 'policy-locked';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--md-space-3)' }}>
      {policyLocked && (
        <p style={mutedRow}>조직 정책으로 AI 기능이 비활성화되어 있어요 (토글 잠금).</p>
      )}
      <NoticeBanner />
      <div role="group" aria-label="AI 도구">
        {providers.map((p) => (
          <ProviderRow
            key={p.id}
            provider={p}
            policyLocked={policyLocked}
            onStartOnboarding={onStartOnboarding}
          />
        ))}
      </div>
      <AiEnabledToggle disabled={policyLocked} />
      <AdvancedModelToggle disabled={policyLocked} providers={providers} />
      <ContinueLengthToggle disabled={policyLocked} />
    </div>
  );
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

// @MX:SPEC: SPEC-AI-009 REQ-AI9-048 REQ-AI9-049 REQ-AI9-053
// @MX:NOTE: [AUTO] 고급 티어 표시는 백엔드가 내려준 advancedModelLabel 을 그대로 감싸 렌더한다
//   (REQ-AI9-048). 프론트에 provider id → 모델명 리터럴 테이블을 두지 않으며, 필드가 부재·빈
//   값이면 기존 providerDisplayName 기반 폴백으로만 강등한다(REQ-AI9-053).
/** 'auto' 를 감지 배열에서 selectable 인 첫 provider 로 해석하고, 그 외는 id 로 직접 조회한다. */
function findEffectiveAdvancedProvider(
  providers: AiProviderStatus[],
  selected: 'auto' | 'claude' | 'codex',
): AiProviderStatus | undefined {
  if (selected === 'auto') {
    return providers.find((p) => deriveProviderRowState(p).selectable);
  }
  return providers.find((p) => p.id === selected);
}

/**
 * 고급 모델 토글의 라벨/aria-label 텍스트를 파생한다(순수, AC-AI9-030).
 * 우선순위: 유효 provider 의 advancedModelLabel(비어있지 않음) → providerDisplayName 기반
 * 폴백({표시명} 고급 티어) → 유효 provider 자체가 없으면 중립 문구.
 */
export function deriveAdvancedModelLabel(
  providers: AiProviderStatus[],
  selected: 'auto' | 'claude' | 'codex',
): { text: string; ariaLabel: string } {
  const effective = findEffectiveAdvancedProvider(providers, selected);
  let content = '';
  if (effective) {
    const raw = effective.advancedModelLabel;
    content = raw && raw.trim() !== '' ? raw : `${providerDisplayName(effective.id)} 고급 티어`;
  }
  if (content) {
    return {
      text: `고급 모델 사용 (${content} — 더 정확, 더 느림)`,
      ariaLabel: `고급 모델 사용 (${content})`,
    };
  }
  return {
    text: '고급 모델 사용 (더 정확, 더 느림)',
    ariaLabel: '고급 모델 사용',
  };
}

/** 고급 모델 사용 토글. 라벨은 백엔드 공급 advancedModelLabel 을 그대로 렌더한다(REQ-AI9-048). */
function AdvancedModelToggle({
  disabled,
  providers,
}: {
  disabled: boolean;
  providers: AiProviderStatus[];
}): JSX.Element {
  const advanced = useUIStore((s) => s.aiAdvancedModel);
  const setAdvanced = useUIStore((s) => s.setAiAdvancedModel);
  const selected = useUIStore((s) => s.aiSelectedProvider);

  const { text, ariaLabel } = deriveAdvancedModelLabel(providers, selected);

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
        aria-label={ariaLabel}
        checked={advanced}
        disabled={disabled}
        onChange={(e) => setAdvanced(e.target.checked)}
      />
      {text}
      {disabled ? ' 🔒' : ''}
    </label>
  );
}

// @MX:SPEC: SPEC-AI-006 REQ-AI6-012
// @MX:NOTE: 이어쓰기 길이 옵션 토글 — AdvancedModelToggle 과 동일한 disabled+🔒 정책 잠금 관례를
// 따른다. onChange 는 setAiContinueLength 로만 반영한다(uiStore persist, 기본 'normal').
/** 이어쓰기(continue) 길이 옵션 토글(짧게/보통). 정책 잠금 시 disabled + 자물쇠 표기. */
function ContinueLengthToggle({ disabled }: { disabled: boolean }): JSX.Element {
  const length = useUIStore((s) => s.aiContinueLength);
  const setLength = useUIStore((s) => s.setAiContinueLength);

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
      title="이어쓰기(✨ 이어쓰기) 응답 분량을 짧게 제한합니다."
    >
      <input
        type="checkbox"
        aria-label="이어쓰기 짧게 쓰기"
        checked={length === 'short'}
        disabled={disabled}
        onChange={(e) => setLength(e.target.checked ? 'short' : 'normal')}
      />
      이어쓰기 짧게 쓰기 (한두 문장만){disabled ? ' 🔒' : ''}
    </label>
  );
}

// @MX:SPEC: SPEC-AI-009 REQ-AI9-027
// @MX:NOTE: [AUTO] provider 표시명 소스 — id → 표시명 매핑, 미등록 id 는 원본 id 로 폴백한다.
//   registry 에 3번째 provider 가 추가돼도(REQ-AI9-029) SettingsModal.tsx 를 고치지 않고 이
//   테이블에 한 줄만 추가하면 표시명이 붙는다(plan.md Open Questions §7).
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'codex',
};

/** provider id → 사람이 읽는 표시명(미등록 id 는 id 원문으로 폴백). */
function providerDisplayName(id: string): string {
  return PROVIDER_DISPLAY_NAMES[id] ?? id;
}

// @MX:ANCHOR: [AUTO] deriveProviderRowState - provider 행 상태 파생의 단일 소스
// @MX:REASON: [AUTO] ProviderRow 렌더와 SettingsModal.test.tsx 의 순수 함수 단위 테스트(AC-AI9-017)
//   양쪽이 이 함수 하나만 참조한다(fan_in >= 2, 향후 행 UI 변형이 늘면 fan_in 이 늘어난다).
//   deriveConnectionState(섹션 수준)와 달리 오직 해당 provider 자신의 ProviderStatus 만 입력받는다
//   — 다른 provider·"유효 provider" 개념에 의존하지 않는다(REQ-AI9-027).
/**
 * provider 행 상태를 그 provider 자신의 ProviderStatus 만으로 파생한다(REQ-AI9-027).
 * - installed && loggedIn → "사용 가능" + selectable
 * - installed && !loggedIn → "로그인 필요" + not selectable
 * - !installed → "미설치" + not selectable(loggedIn 값 무시)
 */
export function deriveProviderRowState(
  p: AiProviderStatus,
): { label: string; selectable: boolean; reason: string } {
  if (!p.installed) return { label: '미설치', selectable: false, reason: '미설치' };
  if (!p.loggedIn) return { label: '로그인 필요', selectable: false, reason: '로그인 필요' };
  return { label: '사용 가능', selectable: true, reason: '' };
}

/** aiSelectedProvider 가 실제로 다룰 수 있는 provider id 도메인('auto'|'claude'|'codex', REQ-AI9-030(a)). */
function isKnownProviderId(id: string): id is 'claude' | 'codex' {
  return id === 'claude' || id === 'codex';
}

// @MX:SPEC: SPEC-AI-009 REQ-AI9-026 REQ-AI9-028 REQ-AI9-029 REQ-AI9-030 REQ-AI9-031 REQ-AI9-032
// @MX:NOTE: [AUTO] provider 대등 행(결함 2 수정, v0.0.4) — 드롭다운(AiProviderSelect, 개정 전)을
//   대체한다. 각 행은 (1) radio, (2) 표시명, (3) 상태 배지, (4) 버전(있으면) 순서로 4요소를
//   렌더한다(REQ-AI9-026). 미사용 행은 disabled + 사유 인라인(REQ-AI9-028), installed 이지만
//   미로그인인 행에는 온보딩 진입 컨트롤을 함께 노출한다(REQ-AI9-032).
/** provider 1개를 렌더하는 대등 행 — registry 순서 그대로 부모(AiSection)가 순회 호출한다. */
function ProviderRow({
  provider,
  policyLocked,
  onStartOnboarding,
}: {
  provider: AiProviderStatus;
  policyLocked: boolean;
  onStartOnboarding: () => void;
}): JSX.Element {
  const selected = useUIStore((s) => s.aiSelectedProvider);
  const setSelected = useUIStore((s) => s.setAiSelectedProvider);

  const { label, selectable } = deriveProviderRowState(provider);
  const disabled = policyLocked || !selectable;
  const name = providerDisplayName(provider.id);

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--md-space-2)',
        fontSize: 13,
        padding: '4px 0',
        color: disabled ? 'var(--md-text-faint)' : 'var(--md-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        type="radio"
        name="ai-provider-row"
        aria-label={name}
        checked={selected === provider.id}
        disabled={disabled}
        onChange={() => {
          // REQ-AI9-028/031: disabled(미사용 또는 정책 잠금) 상태에서는 change 이벤트가 오더라도
          // 선택을 반영하지 않는다 — disabled 어트리뷰트만으로는 jsdom 합성 이벤트를 막지 못한다.
          if (!disabled && isKnownProviderId(provider.id)) setSelected(provider.id);
        }}
      />
      <span>{name}</span>
      <span style={{ color: selectable ? 'var(--md-success)' : 'var(--md-text-muted)' }}>
        {selectable ? '✅ ' : ''}
        {label}
        {policyLocked ? ' 🔒' : ''}
      </span>
      {provider.version && <span>(v{provider.version})</span>}
      {!provider.installed && (
        <button type="button" className="md-btn" onClick={onStartOnboarding}>
          설치 안내 보기
        </button>
      )}
      {provider.installed && !provider.loggedIn && (
        <button type="button" className="md-btn" onClick={onStartOnboarding}>
          연결 안내 보기
        </button>
      )}
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
