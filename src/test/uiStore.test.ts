import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { useUIStore } from '@/store/uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useUIStore.setState({
      sidebarWidth: 250,
      previewWidth: 50,
      theme: 'system',
      fontSize: 14,
      sidebarCollapsed: false,
    });
  });

  it('should have default values', () => {
    const state = useUIStore.getState();
    expect(state.sidebarWidth).toBe(250);
    expect(state.previewWidth).toBe(50);
    expect(state.theme).toBe('system');
    expect(state.fontSize).toBe(14);
    expect(state.sidebarCollapsed).toBe(false);
  });

  it('should enforce minimum sidebar width', () => {
    const { setSidebarWidth } = useUIStore.getState();
    act(() => setSidebarWidth(50));
    expect(useUIStore.getState().sidebarWidth).toBe(180);
  });

  it('should enforce maximum sidebar width', () => {
    const { setSidebarWidth } = useUIStore.getState();
    act(() => setSidebarWidth(1000));
    expect(useUIStore.getState().sidebarWidth).toBe(600);
  });

  it('should toggle sidebar', () => {
    const { toggleSidebar } = useUIStore.getState();
    act(() => toggleSidebar());
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    act(() => toggleSidebar());
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('should set theme', () => {
    const { setTheme } = useUIStore.getState();
    act(() => setTheme('dark'));
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('should enforce font size bounds - minimum', () => {
    const { setFontSize } = useUIStore.getState();
    act(() => setFontSize(5));
    expect(useUIStore.getState().fontSize).toBe(10);
  });

  it('should enforce font size bounds - maximum', () => {
    const { setFontSize } = useUIStore.getState();
    act(() => setFontSize(100));
    expect(useUIStore.getState().fontSize).toBe(24);
  });

  it('should enforce minimum preview width', () => {
    const { setPreviewWidth } = useUIStore.getState();
    act(() => setPreviewWidth(10));
    expect(useUIStore.getState().previewWidth).toBe(20);
  });

  it('should enforce maximum preview width', () => {
    const { setPreviewWidth } = useUIStore.getState();
    act(() => setPreviewWidth(90));
    expect(useUIStore.getState().previewWidth).toBe(80);
  });
});
