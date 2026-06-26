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
