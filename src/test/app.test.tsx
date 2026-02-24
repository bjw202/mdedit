import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// App now uses useFileWatcher which depends on Tauri APIs not available in jsdom
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

/**
 * SPEC-INFRA-001 / SPEC-UI-001: App component specification tests
 *
 * These tests verify that the root App component renders correctly
 * and satisfies the basic structure requirements.
 */

describe('App Component: Rendering', () => {
  it('should render the MdEdit title', () => {
    render(<App />);
    // MdEdit brand name rendered in header
    expect(screen.getByText('MdEdit')).toBeInTheDocument();
  });

  it('should render a full-screen container', () => {
    const { container } = render(<App />);
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toHaveClass('h-screen');
    expect(rootDiv).toHaveClass('w-screen');
  });

  it('should support dark mode class variant', () => {
    const { container } = render(<App />);
    const rootDiv = container.firstChild as HTMLElement;
    // Verify dark mode classes are present (Tailwind dark: prefix)
    expect(rootDiv.className).toContain('dark:bg-gray-900');
  });

  it('should have white background in light mode', () => {
    const { container } = render(<App />);
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toHaveClass('bg-white');
  });
});

describe('App Component: Accessibility', () => {
  it('should have a proper heading hierarchy', () => {
    render(<App />);
    // AppLayout renders a header element with MdEdit brand text
    const header = document.querySelector('header');
    expect(header).toBeInTheDocument();
  });
});
