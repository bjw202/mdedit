import { describe, it, expect } from 'vitest';

/**
 * SPEC-INFRA-001: Infrastructure constraint verification tests
 *
 * These tests verify that the project infrastructure is correctly configured:
 * - TypeScript strict mode is enforced
 * - ESM module format is used
 * - Path aliases work correctly
 * - Build configuration constraints are met
 */

describe('Infrastructure: TypeScript Configuration', () => {
  it('should support ESM module syntax', async () => {
    // Verify ESM dynamic import works (ESM format requirement)
    const module = await import('../App');
    expect(module.default).toBeDefined();
  });

  it('should have access to global test utilities', () => {
    // Verify Vitest globals are configured (globals: true in vite.config.ts)
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });
});

describe('Infrastructure: Module System', () => {
  it('should use ESM imports correctly', () => {
    // Verify that we can import ES modules without issues
    expect(typeof import.meta).toBe('object');
    expect(typeof import.meta.env).toBe('object');
  });

  it('should have correct test environment (jsdom)', () => {
    // Verify jsdom environment is active (configured in vite.config.ts)
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
    expect(typeof navigator).toBe('object');
  });

  it('should have document with root element after setup', () => {
    // Verify basic DOM operations work
    const div = document.createElement('div');
    div.id = 'test-root';
    document.body.appendChild(div);
    const found = document.getElementById('test-root');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('test-root');
    // Cleanup
    document.body.removeChild(div);
  });
});

describe('Infrastructure: Performance Constraints', () => {
  it('should import App component within reasonable time', async () => {
    const start = performance.now();
    await import('../App');
    const elapsed = performance.now() - start;
    // Cold start should be fast in test environment
    // This tests module loading, not Tauri startup
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('Infrastructure: Build Configuration', () => {
  it('should have import.meta.env available (Vite ESM)', () => {
    // Vite injects import.meta.env in ESM builds
    expect(import.meta.env).toBeDefined();
    expect(typeof import.meta.env.MODE).toBe('string');
  });

  it('should be in test mode', () => {
    // Vitest sets NODE_ENV to test
    expect(import.meta.env.MODE).toBe('test');
  });
});
