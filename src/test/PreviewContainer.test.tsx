// PreviewContainer 단위 테스트 — SPEC-PREVIEW-004
// TDD: getFileViewType 순수 함수 + 컴포넌트 분기 동작
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { getFileViewType } from '@/components/preview/PreviewContainer';

// fileStore mock
const mockCurrentFile: { value: string | null } = { value: null };

vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((selector: (s: { currentFile: string | null }) => unknown) =>
    selector({ currentFile: mockCurrentFile.value })
  ),
}));

// MarkdownPreview mock
vi.mock('@/components/preview/MarkdownPreview', () => ({
  MarkdownPreview: vi.fn(() => <div data-testid="markdown-preview" />),
}));

// HtmlFileViewer mock
vi.mock('@/components/preview/HtmlFileViewer', () => ({
  HtmlFileViewer: vi.fn(({ htmlPath }: { htmlPath: string }) => (
    <div data-testid="html-file-viewer" data-path={htmlPath} />
  )),
}));

// ---- getFileViewType 순수 함수 테스트 ----

describe('getFileViewType', () => {
  it('null 경로 → markdown', () => {
    expect(getFileViewType(null)).toBe('markdown');
  });

  it('undefined → markdown', () => {
    expect(getFileViewType(undefined)).toBe('markdown');
  });

  it('빈 문자열 → markdown', () => {
    expect(getFileViewType('')).toBe('markdown');
  });

  it('.md 파일 → markdown', () => {
    expect(getFileViewType('/project/README.md')).toBe('markdown');
  });

  it('.ts 파일 → markdown', () => {
    expect(getFileViewType('/project/main.ts')).toBe('markdown');
  });

  it('.html 파일(소문자) → html', () => {
    expect(getFileViewType('/project/index.html')).toBe('html');
  });

  it('.HTML 파일(대문자) → html (대소문자 무관)', () => {
    expect(getFileViewType('/project/index.HTML')).toBe('html');
  });

  it('.Html 혼합 대소문자 → html', () => {
    expect(getFileViewType('/project/page.Html')).toBe('html');
  });

  it('경로 없이 파일명만 → html', () => {
    expect(getFileViewType('index.html')).toBe('html');
  });

  it('경로 없이 마크다운 파일명만 → markdown', () => {
    expect(getFileViewType('notes.md')).toBe('markdown');
  });
});

// ---- PreviewContainer 컴포넌트 분기 테스트 ----

describe('PreviewContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentFile.value = null;
  });

  it('currentFile이 null이면 MarkdownPreview를 렌더링한다', async () => {
    mockCurrentFile.value = null;
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('markdown-preview')).toBeDefined();
    expect(screen.queryByTestId('html-file-viewer')).toBeNull();
  });

  it('.md 파일 → MarkdownPreview를 렌더링한다', async () => {
    mockCurrentFile.value = '/project/README.md';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('markdown-preview')).toBeDefined();
    expect(screen.queryByTestId('html-file-viewer')).toBeNull();
  });

  it('.html 파일 → HtmlFileViewer를 렌더링한다', async () => {
    mockCurrentFile.value = '/project/index.html';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('html-file-viewer')).toBeDefined();
    expect(screen.queryByTestId('markdown-preview')).toBeNull();
  });

  it('.HTML 파일(대문자) → HtmlFileViewer를 렌더링한다', async () => {
    mockCurrentFile.value = '/project/page.HTML';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('html-file-viewer')).toBeDefined();
  });

  it('HtmlFileViewer에 htmlPath prop이 올바르게 전달된다', async () => {
    mockCurrentFile.value = '/project/test.html';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    const viewer = screen.getByTestId('html-file-viewer');
    expect(viewer.getAttribute('data-path')).toBe('/project/test.html');
  });
});
