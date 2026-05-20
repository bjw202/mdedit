// PreviewContainer 단위 테스트 — SPEC-PREVIEW-004 + SPEC-PREVIEW-005
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

// CodeFileViewer mock — SPEC-PREVIEW-005
vi.mock('@/components/preview/CodeFileViewer', () => ({
  CodeFileViewer: vi.fn(({ lang }: { lang: string }) => (
    <div data-testid="code-file-viewer" data-lang={lang} />
  )),
}));

// extensionLangMap mock — 실제 매핑을 사용하지 않고 테스트 제어용 목업
vi.mock('@/lib/preview/extensionLangMap', () => ({
  getLangForExtension: vi.fn((path: string | null | undefined) => {
    if (!path) return null;
    const ext = path.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      py: 'python',
      js: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      ts: 'typescript',
      json: 'json',
      jsonl: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      sh: 'bash',
      bash: 'bash',
      css: 'css',
    };
    return ext ? (map[ext] ?? null) : null;
  }),
  extensionLangMap: {
    py: 'python',
    js: 'javascript',
    ts: 'typescript',
    json: 'json',
    jsonl: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sh: 'bash',
    bash: 'bash',
    css: 'css',
  },
}));

// ---- getFileViewType 순수 함수 테스트 (SPEC-PREVIEW-004 기존 + SPEC-PREVIEW-005 신규) ----

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

  // ---- SPEC-PREVIEW-005 시나리오 A: 코드 파일 라우팅 분기 ----

  it('.py 파일 → code (시나리오 A)', () => {
    expect(getFileViewType('notes.py')).toBe('code');
  });

  it('.ts 파일 → code (시나리오 A — SPEC-PREVIEW-005 이전에는 markdown이었음)', () => {
    expect(getFileViewType('app.ts')).toBe('code');
  });

  it('.json 파일 → code (시나리오 A)', () => {
    expect(getFileViewType('config.json')).toBe('code');
  });

  it('.yaml 파일 → code (시나리오 A)', () => {
    expect(getFileViewType('data.yaml')).toBe('code');
  });

  it('.yml 파일 → code', () => {
    expect(getFileViewType('data.yml')).toBe('code');
  });

  it('.jsonl 파일 → code', () => {
    expect(getFileViewType('data.jsonl')).toBe('code');
  });

  it('.toml 파일 → code', () => {
    expect(getFileViewType('Cargo.toml')).toBe('code');
  });

  it('.sh 파일 → code', () => {
    expect(getFileViewType('script.sh')).toBe('code');
  });

  it('.css 파일 → code', () => {
    expect(getFileViewType('style.css')).toBe('code');
  });

  it('.js 파일 → code', () => {
    expect(getFileViewType('main.js')).toBe('code');
  });

  it('대문자 .PY → code (대소문자 무관)', () => {
    expect(getFileViewType('NOTES.PY')).toBe('code');
  });

  // ---- SPEC-PREVIEW-005 시나리오 B: 미지원 확장자 폴백 — 회귀 차단 ----

  it('미지원 확장자 .xyz → markdown (시나리오 B 폴백)', () => {
    expect(getFileViewType('archive.xyz')).toBe('markdown');
  });

  it('확장자 없는 파일 → markdown (폴백)', () => {
    expect(getFileViewType('Makefile')).toBe('markdown');
  });

  // ---- 분기 우선순위: .html이 코드 매핑보다 먼저 평가된다 ----
  it('.html은 코드 매핑 조회 전에 html로 분기된다', () => {
    // html은 extensionLangMap에 없으므로 순서 테스트: .html → 'html'
    expect(getFileViewType('index.html')).toBe('html');
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
    expect(screen.queryByTestId('code-file-viewer')).toBeNull();
  });

  it('.md 파일 → MarkdownPreview를 렌더링한다', async () => {
    mockCurrentFile.value = '/project/README.md';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('markdown-preview')).toBeDefined();
    expect(screen.queryByTestId('html-file-viewer')).toBeNull();
    expect(screen.queryByTestId('code-file-viewer')).toBeNull();
  });

  it('.html 파일 → HtmlFileViewer를 렌더링한다', async () => {
    mockCurrentFile.value = '/project/index.html';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('html-file-viewer')).toBeDefined();
    expect(screen.queryByTestId('markdown-preview')).toBeNull();
    expect(screen.queryByTestId('code-file-viewer')).toBeNull();
  });

  it('.HTML 파일(대문자) → HtmlFileViewer를 렌더링한다', async () => {
    mockCurrentFile.value = '/project/page.HTML';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('html-file-viewer')).toBeDefined();
    expect(screen.queryByTestId('code-file-viewer')).toBeNull();
  });

  it('HtmlFileViewer에 htmlPath prop이 올바르게 전달된다', async () => {
    mockCurrentFile.value = '/project/test.html';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    const viewer = screen.getByTestId('html-file-viewer');
    expect(viewer.getAttribute('data-path')).toBe('/project/test.html');
  });

  // ---- SPEC-PREVIEW-005 시나리오 A: CodeFileViewer 렌더 ----

  it('.py 파일 → CodeFileViewer를 렌더링한다 (시나리오 A)', async () => {
    mockCurrentFile.value = 'notes.py';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('code-file-viewer')).toBeDefined();
    expect(screen.queryByTestId('markdown-preview')).toBeNull();
    expect(screen.queryByTestId('html-file-viewer')).toBeNull();
  });

  it('.json 파일 → CodeFileViewer를 렌더링한다 (시나리오 A)', async () => {
    mockCurrentFile.value = 'config.json';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('code-file-viewer')).toBeDefined();
    expect(screen.queryByTestId('markdown-preview')).toBeNull();
  });

  it('.yaml 파일 → CodeFileViewer를 렌더링한다 (시나리오 A)', async () => {
    mockCurrentFile.value = 'data.yaml';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('code-file-viewer')).toBeDefined();
    expect(screen.queryByTestId('markdown-preview')).toBeNull();
  });

  it('.ts 파일 → CodeFileViewer를 렌더링한다 (시나리오 A)', async () => {
    mockCurrentFile.value = 'app.ts';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('code-file-viewer')).toBeDefined();
    expect(screen.queryByTestId('markdown-preview')).toBeNull();
  });

  // ---- SPEC-PREVIEW-005 시나리오 B: 미지원 확장자 폴백 — 회귀 차단 ----

  it('archive.xyz → MarkdownPreview를 렌더링한다 (시나리오 B)', async () => {
    mockCurrentFile.value = 'archive.xyz';
    const { PreviewContainer } = await import('@/components/preview/PreviewContainer');
    const ref = { current: null } as React.RefObject<HTMLDivElement>;
    render(<PreviewContainer previewRef={ref} />);
    expect(screen.getByTestId('markdown-preview')).toBeDefined();
    expect(screen.queryByTestId('code-file-viewer')).toBeNull();
    expect(screen.queryByTestId('html-file-viewer')).toBeNull();
  });
});
