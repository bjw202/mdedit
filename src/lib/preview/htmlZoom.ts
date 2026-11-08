// HTML 미리보기 브라우저식 배율 — 순수 함수와 상수 (SPEC-PREVIEW-018)

// @MX:NOTE: [AUTO] 단계 목록은 spec.md REQ-PREVIEW018-002의 값이다. 바꾸려면 SPEC 개정이 필요하다.
// @MX:SPEC: SPEC-PREVIEW-018
export const HTML_ZOOM_STEPS: readonly number[] = [67, 75, 80, 90, 100, 110, 125, 150, 175, 200];

export const HTML_ZOOM_DEFAULT = 100;

/** 바로 위 단계로 올린다. 최댓값이면 그대로. */
export function stepUp(z: number): number {
  const next = HTML_ZOOM_STEPS.find((s) => s > z);
  return next ?? HTML_ZOOM_STEPS[HTML_ZOOM_STEPS.length - 1];
}

/** 바로 아래 단계로 내린다. 최솟값이면 그대로. */
export function stepDown(z: number): number {
  for (let i = HTML_ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (HTML_ZOOM_STEPS[i] < z) return HTML_ZOOM_STEPS[i];
  }
  return HTML_ZOOM_STEPS[0];
}

/**
 * 임의 값을 단계 값으로 맞춘다.
 * number가 아니거나 유한하지 않으면 100, 단계 밖이면 가장 가까운 단계(같은 거리면 작은 쪽).
 */
export function snapToStep(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return HTML_ZOOM_DEFAULT;
  let best = HTML_ZOOM_STEPS[0];
  for (const s of HTML_ZOOM_STEPS) {
    // 단계 목록이 오름차순이므로 `<`만 쓰면 같은 거리에서 먼저 나온 작은 쪽이 남는다.
    if (Math.abs(s - v) < Math.abs(best - v)) best = s;
  }
  return best;
}

/** 플랫폼 문자열에 Mac이 들어 있으면 macOS로 본다. */
export function isMacPlatform(platform: string): boolean {
  return /mac/i.test(platform);
}

/** 현재 실행 환경의 플랫폼 문자열(userAgentData 우선). */
export function detectPlatform(): string {
  if (typeof navigator === 'undefined') return '';
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return uaData?.platform || navigator.platform || '';
}

export type ZoomShortcut = 'in' | 'out' | 'reset';

/**
 * 키 이벤트가 배율 단축키인지 판정한다.
 * macOS는 metaKey만, 그 밖의 OS는 ctrlKey만 수정키로 받는다. 조합 입력 중이면 무시한다.
 */
export function matchZoomShortcut(e: KeyboardEvent, isMac: boolean): ZoomShortcut | null {
  if (e.isComposing) return null;
  const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (!mod) return null;
  switch (e.key) {
    case '=':
    case '+':
      return 'in';
    case '-':
      return 'out';
    case '0':
      return 'reset';
    default:
      return null;
  }
}
