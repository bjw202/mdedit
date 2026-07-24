// @MX:SPEC: SPEC-AI-005 REQ-AI5-013 REQ-AI5-014
// @MX:NOTE: 정책 캐시 + effective 셀렉터 — SettingsModal 이 아닌 독립 모듈에 배치한다.
// ai-ghost-text.ts 가 SettingsModal 의 resolveModel 을 import 하므로, 이 셀렉터를 SettingsModal
// 에 두면 ai-ghost-text.ts → SettingsModal 순환 import 가 발생한다(research.md §6, plan.md D2/D3).

import { useUIStore } from './uiStore';

// @MX:NOTE: [AUTO] 부팅 시 감지된 조직 정책 잠금 캐시(AppLayout 이 aiPolicyStatus()로 세팅).
// getAiLoggedIn(ai-suggestion-card.ts)과 동형 — stale 캐시를 수용하고 부팅 + 설정 모달 열람 시
// 갱신한다(D5). 낙관적 기본값은 false(잠금 없음).
let policyDisabledCache = false;

/** 조직 정책 잠금 캐시를 갱신한다(AppLayout 부팅 시, SettingsModal 열람 시). */
export function setAiPolicyDisabled(value: boolean): void {
  policyDisabledCache = value;
}

/** 현재 캐시된 조직 정책 잠금 여부. */
export function getAiPolicyDisabled(): boolean {
  return policyDisabledCache;
}

// @MX:ANCHOR: [AUTO] getEffectiveAiEnabled - 전 표면 게이트의 단일 판정 계약
// @MX:REASON: [AUTO] ✨ 선택 툴바(buildToolbarDecorations) · 힌트(armTimer) · Mod+Enter
//   (modEnterCommand) · markdown-extensions getUiState() 배선이 모두 이 함수를 통해서만 AI 표면
//   노출 여부를 판정한다(fan_in >= 4). 정책 잠금이 사용자 토글보다 항상 우선한다
//   (REQ-AI5-013/014) — 정책 미인지였던 기존 표면 미비를 부수적으로 닫는다(research.md §2).
// @MX:SPEC: SPEC-AI-005
/** effectiveAiEnabled = !policyDisabled && userAiEnabled (REQ-AI5-013). */
export function getEffectiveAiEnabled(): boolean {
  return !getAiPolicyDisabled() && useUIStore.getState().aiEnabled;
}

// @MX:ANCHOR: [AUTO] resolveProviderId - aiRequest args.providerId 의 단일 소스
// @MX:REASON: [AUTO] 발행 지점 5곳(startSectionFill/startContinueWriting/startFreeContinueWriting/
//   buildSelectionRequest/fireReRequest)과 재요청 1곳(reRequestGhost)이 모두 이 함수를 통해
//   providerId 를 결정한다(fan_in >= 5). 단일 소스화가 핵심 — aiSelectedProvider 가 바뀌면
//   모든 발행 지점이 즉시 따라간다. 백엔드 ProviderRegistry::route(None) 는 first_available()
//   로 자동 감지(claude > codex), route(Some("claude"|"codex")) 는 해당 provider 강제 라우팅
//   (src-tauri/src/ai/provider.rs 참조).
// @MX:SPEC: SPEC-AI-009
/**
 * uiStore.aiSelectedProvider 를 aiRequest args.providerId 용 값으로 환원한다.
 * - 'auto' → undefined (백엔드 자동 감지에 위임, claude > codex 우선)
 * - 'claude' → 'claude' (claude 강제)
 * - 'codex' → 'codex' (codex 강제)
 */
export function resolveProviderId(): string | undefined {
  const sel = useUIStore.getState().aiSelectedProvider;
  return sel === 'auto' ? undefined : sel;
}
