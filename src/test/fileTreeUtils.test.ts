// fileTreeUtils 단위 테스트 — SPEC-PREVIEW-008 (ImageFileViewer/SvgFileViewer 파일 크기 조회 공용 헬퍼)
import { describe, it, expect } from 'vitest';
import { findFileNodeSize } from '@/lib/preview/fileTreeUtils';
import type { FileNode } from '@/types/file';

const tree: FileNode[] = [
  { name: 'logo.png', path: '/project/logo.png', isDirectory: false, size: 1024 },
  {
    name: 'assets',
    path: '/project/assets',
    isDirectory: true,
    children: [
      { name: 'icon.svg', path: '/project/assets/icon.svg', isDirectory: false, size: 2048 },
    ],
  },
];

describe('findFileNodeSize', () => {
  it('최상위 파일 노드의 size를 반환한다', () => {
    expect(findFileNodeSize(tree, '/project/logo.png')).toBe(1024);
  });

  it('중첩된 디렉터리 안의 파일 size를 재귀적으로 찾는다', () => {
    expect(findFileNodeSize(tree, '/project/assets/icon.svg')).toBe(2048);
  });

  it('일치하는 노드가 없으면 undefined를 반환한다', () => {
    expect(findFileNodeSize(tree, '/project/missing.png')).toBeUndefined();
  });

  it('빈 트리에서 undefined를 반환한다', () => {
    expect(findFileNodeSize([], '/project/logo.png')).toBeUndefined();
  });
});
