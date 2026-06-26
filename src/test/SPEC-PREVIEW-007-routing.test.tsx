/**
 * SPEC-PREVIEW-007 TDD 테스트 — PreviewContainer 라우팅 + UnsupportedFileViewer
 *
 * RED 단계: text/unsupported 분기 + UnsupportedFileViewer 신규 컴포넌트 테스트.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

// ─── fileStore mock — previewStatus 포함 ──────────────────────────────────────

const mockFileState: { currentFile: string | null; previewStatus: string | null } = {
  currentFile: null,
  previewStatus: null,
};

vi.mock('@/store/fileStore', () => ({
  useFileStore: vi.fn((selector: (s: typeof mockFileState) => unknown) =>
    selector(mockFileState)
  ),
}));

// ─── 컴포넌트 mock ─────────────────────────────────────────────────────────────

vi.mock('@/components/preview/MarkdownPreview', () => ({
  MarkdownPreview: vi.fn(() => <div data-testid="markdown-preview" />),
}));

vi.mock('@/components/preview/HtmlFileViewer', () => ({
  HtmlFileViewer: vi.fn(({ htmlPath }: { htmlPath: string }) => (
    <div data-testid="html-file-viewer" data-path={htmlPath} />
  )),
}));

vi.mock('@/components/preview/CodeFileViewer', () => ({
  CodeFileViewer: vi.fn(({ lang }: { lang: string }) => (
    <div data-testid="code-file-viewer" data-lang={lang} />
  )),
}));

// UnsupportedFileViewer: 실제 파일을 import (RED 단계에서 스텁으로 동작)
// 스텁은 아무것도 렌더링하지 않으므로 테스트는 실패한다

// ─── extensionLangMap mock ─────────────────────────────────────────────────────

vi.mock('@/lib/preview/extensionLangMap', () => ({
  getLangForExtension: vi.fn((path: string | null | undefined) => {
    if (!path) return null;
    const ext = path.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      py: 'python', js: 'javascript', ts: 'typescript',
      json: 'json', yaml: 'yaml', yml: 'yaml',
      toml: 'toml', sh: 'bash', css: 'css',
    };
    return ext ? (map[ext] ?? null) : null;
  }),
}));

// ─── getFileViewType 라우팅 확장 테스트 ───────────────────────────────────────

describe('getFileViewType — text/unsupported 분기 추가 (SPEC-PREVIEW-007)', () => {
  it('path=null, previewStatus=null → "markdown" (기존 폴백 유지)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    // 현재 구현은 단일 인자만 받음 → RED: 두 번째 인자 무시
    expect(getFileViewType(null, null as never)).toBe('markdown');
  });

  it('.md + previewStatus=null → "markdown" (회귀 차단)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    expect(getFileViewType('/project/README.md', null as never)).toBe('markdown');
  });

  it('.html + previewStatus=null → "html" (회귀 차단)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    expect(getFileViewType('/project/index.html', null as never)).toBe('html');
  });

  it('.ts + previewStatus=null → "code" (회귀 차단)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    expect(getFileViewType('/project/app.ts', null as never)).toBe('code');
  });

  it('미지원 확장자 + previewStatus="text" → "text" (신규)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    // RED: 현재 구현은 두 번째 파라미터 없음 → 'markdown'을 반환
    expect(getFileViewType('/project/.gitignore', 'text' as never)).toBe('text');
  });

  it('미지원 확장자 + previewStatus="binary" → "unsupported" (신규)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    expect(getFileViewType('/project/logo.png', 'binary' as never)).toBe('unsupported');
  });

  it('미지원 확장자 + previewStatus="too-large" → "unsupported" (신규)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    expect(getFileViewType('/project/bigfile.bin', 'too-large' as never)).toBe('unsupported');
  });

  it('.rs + previewStatus="text" → "text" (신규 — .rs는 extensionLangMap에 없음)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    expect(getFileViewType('/project/main.rs', 'text' as never)).toBe('text');
  });

  it('확장자 없는 파일 + previewStatus="text" → "text" (신규)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    expect(getFileViewType('/project/notes', 'text' as never)).toBe('text');
  });

  it('.html + previewStatus="html" → "html" (html 분기 우선순위 확인)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    expect(getFileViewType('/project/index.html', 'html' as never)).toBe('html');
  });

  // ─── 회귀 버그 재현: .md + previewStatus='text' → 반드시 'markdown' 이어야 함 ─────
  // previewStatus='text' 로 인해 .md 파일이 plain text 뷰어로 빠지는 버그
  it('[BUG] notes.md + previewStatus="text" → "markdown" (plain text로 빠지면 FAIL)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    expect(getFileViewType('notes.md', 'text' as never)).toBe('markdown');
  });

  it('[BUG] README.markdown + previewStatus="text" → "markdown" (plain text로 빠지면 FAIL)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    expect(getFileViewType('README.markdown', 'text' as never)).toBe('markdown');
  });

  it('notes.md + previewStatus=null → "markdown" (기존 동작 유지)', async () => {
    const { getFileViewType } = await import('@/components/preview/PreviewContainer');
    expect(getFileViewType('notes.md', null as never)).toBe('markdown');
  });
});

// ─── PreviewContainer 컴포넌트 분기 테스트 ────────────────────────────────────

describe('PreviewContainer — text/unsupported 렌더 (SPEC-PREVIEW-007)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileState.currentFile = null;
    mockFileState.previewStatus = null;
  });

  it('previewStatus="text" → CodeFileViewer를 lang="text"로 렌더한다', async () => {
    mockFileState.currentFile = '/project/.gitignore';
    mockFileState.previewStatus = 'text';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    // RED: 현재 구현에 'text' 분기 없음 → MarkdownPreview가 렌더됨
    const viewer = screen.queryByTestId('code-file-viewer');
    expect(viewer).not.toBeNull();
    expect(viewer!.getAttribute('data-lang')).toBe('text');
  });

  it('previewStatus="binary" → UnsupportedFileViewer를 reason="binary"로 렌더한다', async () => {
    mockFileState.currentFile = '/project/logo.png';
    mockFileState.previewStatus = 'binary';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    // RED: 현재 구현에 'binary' 분기 없음 → 스텁은 아무것도 렌더링하지 않음
    const viewer = screen.queryByTestId('unsupported-file-viewer');
    expect(viewer).not.toBeNull();
    expect(viewer!.getAttribute('data-reason')).toBe('binary');
  });

  it('previewStatus="too-large" → UnsupportedFileViewer를 reason="too-large"로 렌더한다', async () => {
    mockFileState.currentFile = '/project/bigfile.bin';
    mockFileState.previewStatus = 'too-large';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    const viewer = screen.queryByTestId('unsupported-file-viewer');
    expect(viewer).not.toBeNull();
    expect(viewer!.getAttribute('data-reason')).toBe('too-large');
  });

  it('UnsupportedFileViewer에 파일명이 올바르게 전달된다', async () => {
    mockFileState.currentFile = '/project/logo.png';
    mockFileState.previewStatus = 'binary';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    const viewer = screen.queryByTestId('unsupported-file-viewer');
    expect(viewer).not.toBeNull();
    // 파일명만 추출: 'logo.png'
    expect(viewer!.getAttribute('data-filename')).toBe('logo.png');
  });

  it('.md + previewStatus=null → MarkdownPreview 렌더 (회귀 차단)', async () => {
    mockFileState.currentFile = '/project/README.md';
    mockFileState.previewStatus = null;
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('markdown-preview')).toBeDefined();
    expect(screen.queryByTestId('unsupported-file-viewer')).toBeNull();
    expect(screen.queryByTestId('code-file-viewer')).toBeNull();
  });

  it('.html + previewStatus="html" → HtmlFileViewer 렌더 (회귀 차단)', async () => {
    mockFileState.currentFile = '/project/index.html';
    mockFileState.previewStatus = 'html';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('html-file-viewer')).toBeDefined();
    expect(screen.queryByTestId('unsupported-file-viewer')).toBeNull();
  });

  it('.ts + previewStatus=null → CodeFileViewer 렌더, lang="typescript" (회귀 차단)', async () => {
    mockFileState.currentFile = '/project/app.ts';
    mockFileState.previewStatus = null;
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    const viewer = screen.queryByTestId('code-file-viewer');
    expect(viewer).not.toBeNull();
    expect(viewer!.getAttribute('data-lang')).toBe('typescript');
  });

  // ─── 회귀 버그 재현: .md + previewStatus='text' → MarkdownPreview가 렌더되어야 함 ─
  it('[BUG] .md + previewStatus="text" → MarkdownPreview 렌더, NOT CodeFileViewer', async () => {
    mockFileState.currentFile = '/project/notes.md';
    mockFileState.previewStatus = 'text';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    // .md 파일은 previewStatus가 무엇이든 항상 markdown으로 렌더되어야 한다
    expect(screen.getByTestId('markdown-preview')).toBeDefined();
    expect(screen.queryByTestId('code-file-viewer')).toBeNull();
  });
});

// ─── UnsupportedFileViewer 컴포넌트 테스트 ────────────────────────────────────

describe('UnsupportedFileViewer (신규, SPEC-PREVIEW-007 REQ-PREVIEW007-004/005)', () => {
  it('reason="binary"일 때 "미리보기 불가" 문구를 표시한다', async () => {
    const { UnsupportedFileViewer } = await import('@/components/preview/UnsupportedFileViewer');
    render(<UnsupportedFileViewer reason="binary" filename="logo.png" />);
    // RED: 스텁은 아무것도 렌더링하지 않음
    expect(screen.getByText(/미리보기 불가/)).toBeDefined();
  });

  it('reason="too-large"일 때 "건너뜁니다" 문구를 표시한다', async () => {
    const { UnsupportedFileViewer } = await import('@/components/preview/UnsupportedFileViewer');
    render(<UnsupportedFileViewer reason="too-large" filename="bigfile.bin" />);
    // "미리보기를 건너뜁니다" 제목 또는 관련 문구가 있어야 한다
    const allMatches = screen.getAllByText(/건너뜁니다/);
    expect(allMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('파일명을 화면에 표시한다', async () => {
    const { UnsupportedFileViewer } = await import('@/components/preview/UnsupportedFileViewer');
    render(<UnsupportedFileViewer reason="binary" filename="logo.png" />);
    // RED: 스텁은 파일명을 표시하지 않음
    expect(screen.getByText(/logo\.png/)).toBeDefined();
  });

  it('reason="binary"와 "too-large"에 따라 다른 안내 문구를 표시한다', async () => {
    const { UnsupportedFileViewer } = await import('@/components/preview/UnsupportedFileViewer');
    const { rerender } = render(<UnsupportedFileViewer reason="binary" filename="logo.png" />);
    expect(screen.queryByText(/건너뜁니다|건너뜀/)).toBeNull();

    rerender(<UnsupportedFileViewer reason="too-large" filename="bigfile.bin" />);
    expect(screen.queryByText(/미리보기 불가/)).toBeNull();
  });
});
