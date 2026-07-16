// @MX:NOTE: [AUTO] SPEC-PREVIEW-008 — ImageFileViewer/SvgFileViewer가 FileNode.size(파일 크기)를
// 조회하기 위한 공용 헬퍼. useFileSystem.openFile의 기존 findNodeSize 재귀 탐색과 동일한 로직이며,
// 뷰어 컴포넌트에서 재사용하기 위해 분리했다 (fan_in >= 2).

import type { FileNode } from '@/types/file';

/**
 * fileTree에서 targetPath와 일치하는 노드의 size를 재귀적으로 탐색한다.
 * 디렉터리 노드는 children을 순회하며, 일치하는 노드가 없으면 undefined를 반환한다.
 */
export function findFileNodeSize(nodes: FileNode[], targetPath: string): number | undefined {
  for (const node of nodes) {
    if (node.path === targetPath) return node.size;
    if (node.children) {
      const found = findFileNodeSize(node.children, targetPath);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}
