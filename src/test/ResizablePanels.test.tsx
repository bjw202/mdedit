import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResizablePanels } from '@/components/layout/ResizablePanels';
import { useUIStore } from '@/store/uiStore';

describe('ResizablePanels', () => {
  it('renders sidebar, editor and preview panels', () => {
    render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
    expect(screen.getByText('Editor Content')).toBeInTheDocument();
    expect(screen.getByText('Preview Content')).toBeInTheDocument();
  });

  it('hides sidebar when collapsed', () => {
    useUIStore.setState({ sidebarCollapsed: true });
    render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.queryByText('Sidebar Content')).not.toBeInTheDocument();
  });

  it('shows sidebar when not collapsed', () => {
    useUIStore.setState({ sidebarCollapsed: false, sidebarWidth: 250 });
    render(
      <ResizablePanels
        sidebar={<div>Sidebar Content</div>}
        editor={<div>Editor Content</div>}
        preview={<div>Preview Content</div>}
      />
    );
    expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
  });
});
