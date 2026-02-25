/**
 * SPEC-EXPORT-001: Header Export UI tests
 *
 * TDD RED phase: Define expected behavior before implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '@/components/layout/Header';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Header: Export dropdown (REQ-EXPORT-011, REQ-EXPORT-012)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Export button', () => {
    render(<Header content="" />);
    expect(screen.getByLabelText('Export')).toBeInTheDocument();
  });

  it('Export button is disabled when content is empty (REQ-EXPORT-012)', () => {
    render(<Header content="" />);
    const exportBtn = screen.getByLabelText('Export');
    expect(exportBtn).toBeDisabled();
  });

  it('Export button is enabled when content is present', () => {
    render(<Header content="# Hello" />);
    const exportBtn = screen.getByLabelText('Export');
    expect(exportBtn).not.toBeDisabled();
  });

  it('shows export format menu on Export button click (REQ-EXPORT-011)', () => {
    render(<Header content="# Hello" />);
    const exportBtn = screen.getByLabelText('Export');
    fireEvent.click(exportBtn);

    expect(screen.getByText('Export as HTML')).toBeInTheDocument();
    expect(screen.getByText('Export as PDF')).toBeInTheDocument();
    expect(screen.getByText('Export as DOCX')).toBeInTheDocument();
  });

  it('calls onExportHtml when Export as HTML is clicked', () => {
    const onExportHtml = vi.fn();
    render(<Header content="# Hello" onExportHtml={onExportHtml} />);

    const exportBtn = screen.getByLabelText('Export');
    fireEvent.click(exportBtn);
    fireEvent.click(screen.getByText('Export as HTML'));

    expect(onExportHtml).toHaveBeenCalledOnce();
  });

  it('calls onExportPdf when Export as PDF is clicked', () => {
    const onExportPdf = vi.fn();
    render(<Header content="# Hello" onExportPdf={onExportPdf} />);

    const exportBtn = screen.getByLabelText('Export');
    fireEvent.click(exportBtn);
    fireEvent.click(screen.getByText('Export as PDF'));

    expect(onExportPdf).toHaveBeenCalledOnce();
  });

  it('calls onExportDocx when Export as DOCX is clicked', () => {
    const onExportDocx = vi.fn();
    render(<Header content="# Hello" onExportDocx={onExportDocx} />);

    const exportBtn = screen.getByLabelText('Export');
    fireEvent.click(exportBtn);
    fireEvent.click(screen.getByText('Export as DOCX'));

    expect(onExportDocx).toHaveBeenCalledOnce();
  });

  it('closes export menu when clicking outside', () => {
    render(<Header content="# Hello" />);
    const exportBtn = screen.getByLabelText('Export');
    fireEvent.click(exportBtn);

    // Menu is visible
    expect(screen.getByText('Export as HTML')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);

    // Menu should be closed
    expect(screen.queryByText('Export as HTML')).not.toBeInTheDocument();
  });

  it('shows loading state during export (REQ-EXPORT-013)', () => {
    const slowExport = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 1000)));
    render(<Header content="# Hello" onExportHtml={slowExport} exportLoading={true} />);

    // Loading indicator should be visible
    expect(screen.getByLabelText('Export loading')).toBeInTheDocument();
  });
});
