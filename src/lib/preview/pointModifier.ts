// @MX:SPEC: SPEC-AI-017 REQ-AI17-001
// @MX:NOTE: 가리키기 수정키 판정의 단일 출처. macOS 는 ⌥(Alt) 만, 그 밖의 OS 는 Alt 또는 Ctrl 을 받는다.
// macOS 의 Ctrl+클릭은 컨텍스트 메뉴이므로 절대 가리키기로 취급하지 않는다.
import { detectPlatform, isMacPlatform } from './htmlZoom';

/** 현재 실행 환경이 macOS 인지(플랫폼 문자열 기준). */
export function isPointMac(): boolean {
  return isMacPlatform(detectPlatform());
}

/** 마우스·키 이벤트의 수정키 상태가 가리키기 수정키인지 판정한다. */
export function isPointModifierHeld(
  e: { altKey: boolean; ctrlKey: boolean },
  isMac: boolean
): boolean {
  return isMac ? e.altKey : e.altKey || e.ctrlKey;
}

/** keydown/keyup 의 key 값이 가리키기 수정키 자체인지 판정한다. */
export function isPointModifierKey(key: string, isMac: boolean): boolean {
  return key === 'Alt' || (!isMac && key === 'Control');
}
