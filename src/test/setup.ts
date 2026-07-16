import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia for jsdom environment
// jsdom does not implement matchMedia, so we provide a minimal mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// SPEC-UI-005: Mock navigator.clipboard.writeText — jsdom 은 clipboard API 를 구현하지 않음.
// Object.defineProperty 로 직접 정의하여 configurable: true (이후 테스트에서 mockRejectedValue 교체 가능).
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  configurable: true,
});

// BUG-8: jsdom 은 Element.scrollIntoView 를 구현하지 않는다. 여러 확장(카드/고스트/뷰)이
// 마운트/phase 전환 시 실제 requestAnimationFrame 콜백에서(테스트가 rAF 를 스텁하지 않는 파일
// 포함) 이를 호출하므로, 전역 no-op 폴백을 깔아 "scrollIntoView is not a function" 런타임
// 오류를 막는다. 호출 자체를 검증하려는 테스트는 이 값을 vi.fn() 으로 개별 교체해서 쓴다.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
