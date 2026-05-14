// @MX:WARN: [AUTO] sandbox 속성 설정 — iframe 보안 격리의 핵심 제어점
// @MX:REASON: sandbox 권한을 잘못 확장(예: allow-same-origin 추가)하면 iframe 내 스크립트가
//   앱 본체 DOM·권한에 접근할 수 있어 앱 권한 탈취 위험이 생긴다.
//   현재 allow-scripts만 부여: 스크립트 실행은 허용, 앱 본체 접근은 차단.
//   변경 전 반드시 acceptance 시나리오 3(앱 권한 탈취 차단)을 재검증할 것.
// @MX:SPEC: SPEC-PREVIEW-004 REQ-PREVIEW004-002, REQ-PREVIEW004-005

import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useFileStore } from '@/store/fileStore';

// HTML 미리보기 최대 파일 크기 임계값 (5MB)
// 튜닝이 필요할 경우 이 상수 하나만 수정한다.
export const HTML_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;

/**
 * 파일 크기가 렌더링 임계값 이하인지 판단하는 순수 함수.
 * @param sizeBytes - 파일 크기(바이트)
 * @returns 렌더링 가능하면 true, 초과하면 false
 */
export function shouldRenderHtml(sizeBytes: number): boolean {
  return sizeBytes <= HTML_PREVIEW_MAX_BYTES;
}

interface HtmlFileViewerProps {
  /** 렌더링할 HTML 파일의 절대 경로 */
  htmlPath: string;
}

/**
 * HTML 파일을 샌드박스 iframe 안에서 렌더링하는 뷰어 컴포넌트.
 *
 * - 파일 크기가 5MB 초과 시 "미리보기 불가" 안내를 표시한다.
 * - iframe 로드 오류 시 오류 안내를 표시하고 앱을 중단하지 않는다.
 * - sandbox="allow-scripts": 스크립트 실행만 허용, 앱 본체 접근 차단.
 *   NOTE: allow-same-origin 미부여. 만약 CSS/이미지 같은 동일-폴더 자산이
 *   로드되지 않는 경우 수동 검증 체크리스트(manual-verification.md) 5-B 항목을 참고하라.
 */
export function HtmlFileViewer({ htmlPath }: HtmlFileViewerProps): JSX.Element {
  const [loadError, setLoadError] = useState(false);

  // fileStore.fileTree에서 파일 크기를 조회 (별도 stat IPC 불필요)
  const fileTree = useFileStore((s) => s.fileTree);
  const fileSize = findFileSizeInTree(fileTree, htmlPath);

  // 파일 크기 초과 시 렌더링 불가 안내
  if (fileSize !== undefined && !shouldRenderHtml(fileSize)) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 text-yellow-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">미리보기 불가</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          파일 크기가 5MB를 초과하여 미리보기를 표시할 수 없습니다.
        </p>
      </div>
    );
  }

  // iframe 로드 오류 안내
  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0l6.354 12.748zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">HTML 로드 오류</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          파일을 불러오는 중 오류가 발생했습니다.
        </p>
      </div>
    );
  }

  // asset:// URL로 변환하여 iframe에 전달
  const assetUrl = convertFileSrc(htmlPath);

  return (
    <iframe
      src={assetUrl}
      title="HTML 파일 미리보기"
      className="w-full h-full border-0"
      // sandbox 속성: allow-scripts만 허용
      // allow-same-origin 미부여 — 앱 본체 접근 완전 차단
      sandbox="allow-scripts"
      onError={() => setLoadError(true)}
      data-testid="html-preview-iframe"
    />
  );
}

/**
 * fileTree를 재귀 탐색하여 주어진 경로의 파일 크기를 반환한다.
 * 찾지 못하면 undefined를 반환한다.
 */
import type { FileNode } from '@/types/file';

function findFileSizeInTree(nodes: FileNode[], targetPath: string): number | undefined {
  for (const node of nodes) {
    if (!node.isDirectory && node.path === targetPath) {
      return node.size;
    }
    if (node.isDirectory && node.children) {
      const found = findFileSizeInTree(node.children, targetPath);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}
