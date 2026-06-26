/**
 * SPEC-PREVIEW-007 TDD 테스트 — FileExplorer 전체 파일 노출 (시나리오 A, B)
 *
 * RED 단계: allowlist 제거 전에는 dotfile, 바이너리, 확장자 없는 파일이 숨겨져 있어 테스트 실패.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFileStore } from '@/store/fileStore';
import type { FileNode } from '@/types/file';

// FileExplorer의 의존성 mock
vi.mock('@/hooks/useFileSystem', () => ({
  useFileSystem: () => ({
    openFolder: vi.fn(),
    openFolderPath: vi.fn(),
    changeFolder: vi.fn(),
    openFile: vi.fn(),
    saveFileAs: vi.fn(),
    createFile: vi.fn(),
    deleteNode: vi.fn(),
    renameNode: vi.fn(),
  }),
}));

vi.mock('@/lib/tauri/ipc', () => ({
  openDirectoryDialog: vi.fn(),
  readDirectory: vi.fn().mockResolvedValue([]),
  readFile: vi.fn(),
  createFile: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  saveFileAs: vi.fn().mockResolvedValue(null),
  startWatch: vi.fn().mockResolvedValue(undefined),
  stopWatch: vi.fn().mockResolvedValue(undefined),
  registerAssetScope: vi.fn().mockResolvedValue(undefined),
}));

// acceptance.md 사전 준비: 전체 노출 픽스처
const allFilesTree: FileNode[] = [
  { name: 'README.md', path: '/project/README.md', isDirectory: false },
  { name: 'index.html', path: '/project/index.html', isDirectory: false },
  { name: 'app.ts', path: '/project/app.ts', isDirectory: false },
  { name: '.gitignore', path: '/project/.gitignore', isDirectory: false },    // dotfile
  { name: 'main.rs', path: '/project/main.rs', isDirectory: false },          // 미매핑 텍스트
  { name: 'data.csv', path: '/project/data.csv', isDirectory: false },         // 미매핑 텍스트
  { name: 'notes', path: '/project/notes', isDirectory: false },               // 확장자 없음
  { name: 'logo.png', path: '/project/logo.png', isDirectory: false },         // 바이너리
  { name: 'archive.zip', path: '/project/archive.zip', isDirectory: false },   // 바이너리
  { name: 'src', path: '/project/src', isDirectory: true, children: [
    { name: 'main.rs', path: '/project/src/main.rs', isDirectory: false },
  ]},
];

describe('FileExplorer — 전체 파일 노출 (SPEC-PREVIEW-007 시나리오 A, B)', () => {
  beforeEach(() => {
    useFileStore.setState({
      fileTree: allFilesTree,
      currentFile: null,
      expandedDirs: new Set(['/project/src']),
      watchedPath: '/project',
      isLoading: false,
    });
  });

  // ── 시나리오 A: 전체 노출 ────────────────────────────────────────────────────

  it('시나리오 A: dotfile(.gitignore)이 파일 트리에 표시된다', async () => {
    const { FileExplorer } = await import('@/components/sidebar/FileExplorer');
    render(<FileExplorer />);
    // RED: filterMdOnly가 .gitignore를 제거함
    expect(screen.queryByText('.gitignore')).not.toBeNull();
  });

  it('시나리오 A: 미매핑 텍스트(main.rs)가 파일 트리에 표시된다', async () => {
    const { FileExplorer } = await import('@/components/sidebar/FileExplorer');
    render(<FileExplorer />);
    // main.rs가 여러 개 있을 수 있음(루트 + src/main.rs) — 최소 1개 이상
    const elements = screen.queryAllByText('main.rs');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('시나리오 A: 바이너리(logo.png)가 파일 트리에 표시된다', async () => {
    const { FileExplorer } = await import('@/components/sidebar/FileExplorer');
    render(<FileExplorer />);
    // RED: filterMdOnly가 logo.png를 제거함
    expect(screen.queryByText('logo.png')).not.toBeNull();
  });

  it('시나리오 A: 확장자 없는 파일(notes)이 파일 트리에 표시된다', async () => {
    const { FileExplorer } = await import('@/components/sidebar/FileExplorer');
    render(<FileExplorer />);
    // RED: filterMdOnly가 notes를 제거함
    expect(screen.queryByText('notes')).not.toBeNull();
  });

  it('시나리오 A: archive.zip이 파일 트리에 표시된다', async () => {
    const { FileExplorer } = await import('@/components/sidebar/FileExplorer');
    render(<FileExplorer />);
    expect(screen.queryByText('archive.zip')).not.toBeNull();
  });

  it('시나리오 A: data.csv가 파일 트리에 표시된다', async () => {
    const { FileExplorer } = await import('@/components/sidebar/FileExplorer');
    render(<FileExplorer />);
    expect(screen.queryByText('data.csv')).not.toBeNull();
  });

  it('시나리오 A: 기존 지원 파일(README.md, index.html, app.ts)도 계속 표시된다 (회귀 차단)', async () => {
    const { FileExplorer } = await import('@/components/sidebar/FileExplorer');
    render(<FileExplorer />);
    expect(screen.queryByText('README.md')).not.toBeNull();
    expect(screen.queryByText('index.html')).not.toBeNull();
    expect(screen.queryByText('app.ts')).not.toBeNull();
  });

  it('시나리오 A: 디렉터리(src)가 표시된다', async () => {
    const { FileExplorer } = await import('@/components/sidebar/FileExplorer');
    render(<FileExplorer />);
    expect(screen.queryByText('src')).not.toBeNull();
  });

  // ── 시나리오 B: 검색 필터는 기존대로 ───────────────────────────────────────

  it('시나리오 B: 검색어 "main"으로 필터 시 main.rs만 표시되고 logo.png는 숨겨진다', async () => {
    const { FileExplorer } = await import('@/components/sidebar/FileExplorer');
    render(<FileExplorer />);
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'main' } });
    // filterTree 동작: main.rs는 표시, logo.png는 숨겨짐
    // 검색 결과는 allowlist가 아닌 이름 필터만 적용
    expect(screen.queryByText('logo.png')).toBeNull();
  });

  it('시나리오 B: 검색어 초기화 시 모든 파일이 다시 표시된다', async () => {
    const { FileExplorer } = await import('@/components/sidebar/FileExplorer');
    render(<FileExplorer />);
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'main' } });
    fireEvent.change(searchInput, { target: { value: '' } });
    // 모든 파일이 다시 보여야 한다
    expect(screen.queryByText('.gitignore')).not.toBeNull();
    expect(screen.queryByText('logo.png')).not.toBeNull();
  });

  // ── SPEC-PREVIEW-005 기존 테스트 회귀 확인 ──────────────────────────────────

  it('SPEC-PREVIEW-005 회귀: .ts 코드 파일도 표시된다', async () => {
    const { FileExplorer } = await import('@/components/sidebar/FileExplorer');
    render(<FileExplorer />);
    expect(screen.queryByText('app.ts')).not.toBeNull();
  });
});
