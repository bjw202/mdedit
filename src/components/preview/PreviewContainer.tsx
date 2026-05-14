// @MX:ANCHOR: [AUTO] 프리뷰 패널 파일 종류 분기 컴포넌트 — AppLayout의 공통 진입점
// @MX:REASON: AppLayout과 양쪽 프리뷰 컴포넌트(MarkdownPreview, HtmlFileViewer)의 연결점.
//   currentFile 변경 시 이 컴포넌트가 올바른 뷰로 라우팅하지 않으면 HTML/마크다운 모드 전환이 깨진다.
//   fan_in: AppLayout(1) + 미래 통합 진입점 추가 가능성 → ANCHOR 부여.
// @MX:SPEC: SPEC-PREVIEW-004 REQ-PREVIEW004-001

import type { RefObject } from 'react';
import { useFileStore } from '@/store/fileStore';
import { MarkdownPreview } from './MarkdownPreview';
import { HtmlFileViewer } from './HtmlFileViewer';

/**
 * 파일 종류를 판단하는 순수 함수.
 * 대소문자 무관하게 .html 확장자를 HTML로 처리한다.
 *
 * @param path - 파일 경로 또는 파일명
 * @returns 'html' | 'markdown'
 */
export function getFileViewType(path: string | null | undefined): 'html' | 'markdown' {
  if (!path) return 'markdown';
  return path.toLowerCase().endsWith('.html') ? 'html' : 'markdown';
}

interface PreviewContainerProps {
  /** 스크롤 싱크용 프리뷰 컨테이너 ref (마크다운 경로에서만 사용) */
  previewRef: RefObject<HTMLDivElement>;
}

/**
 * 현재 선택된 파일 종류에 따라 마크다운 또는 HTML 프리뷰를 렌더링하는 컨테이너.
 *
 * - .html 파일 → HtmlFileViewer (샌드박스 iframe)
 * - 그 외 → MarkdownPreview (기존 마크다운 렌더링 파이프라인)
 *
 * 기존 MarkdownPreview / PreviewRenderer는 변경 없이 재사용된다.
 */
export function PreviewContainer({ previewRef }: PreviewContainerProps): JSX.Element {
  const currentFile = useFileStore((s) => s.currentFile);
  const viewType = getFileViewType(currentFile);

  if (viewType === 'html' && currentFile) {
    return <HtmlFileViewer htmlPath={currentFile} />;
  }

  return <MarkdownPreview previewRef={previewRef} />;
}
