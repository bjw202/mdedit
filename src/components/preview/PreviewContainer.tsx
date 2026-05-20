// @MX:ANCHOR: [AUTO] 프리뷰 패널 파일 종류 분기 컴포넌트 — AppLayout의 공통 진입점
// @MX:REASON: AppLayout과 세 가지 프리뷰 컴포넌트(MarkdownPreview, HtmlFileViewer, CodeFileViewer)의 연결점.
//   currentFile 변경 시 이 컴포넌트가 올바른 뷰로 라우팅하지 않으면 HTML/마크다운/코드 모드 전환이 깨진다.
//   fan_in: AppLayout(1) + 미래 통합 진입점 추가 가능성 → ANCHOR 유지.
// @MX:SPEC: SPEC-PREVIEW-004 REQ-PREVIEW004-001, SPEC-PREVIEW-005 REQ-PREVIEW005-001

import type { RefObject } from 'react';
import { useFileStore } from '@/store/fileStore';
import { getLangForExtension } from '@/lib/preview/extensionLangMap';
import { MarkdownPreview } from './MarkdownPreview';
import { HtmlFileViewer } from './HtmlFileViewer';
import { CodeFileViewer } from './CodeFileViewer';

/**
 * 파일 종류를 판단하는 순수 함수.
 *
 * 분기 우선순위:
 * 1. .html(대소문자 무관) → 'html'  (SPEC-PREVIEW-004 기존 동작 유지)
 * 2. extensionLangMap 조회 성공 → 'code'  (SPEC-PREVIEW-005 신규)
 * 3. 그 외(매핑 미등록·확장자 없음·null) → 'markdown'  (기존 폴백 유지)
 *
 * @param path - 파일 경로 또는 파일명
 * @returns 'html' | 'code' | 'markdown'
 */
export function getFileViewType(path: string | null | undefined): 'html' | 'code' | 'markdown' {
  if (!path) return 'markdown';

  // 1순위: .html 분기 — SPEC-PREVIEW-004 동작 무변경
  if (path.toLowerCase().endsWith('.html')) return 'html';

  // 2순위: 코드 매핑 조회 — SPEC-PREVIEW-005 신규
  if (getLangForExtension(path) !== null) return 'code';

  // 3순위: 폴백 — 기존 마크다운 경로 유지
  return 'markdown';
}

interface PreviewContainerProps {
  /** 스크롤 싱크용 프리뷰 컨테이너 ref (마크다운 경로에서만 사용) */
  previewRef: RefObject<HTMLDivElement>;
}

/**
 * 현재 선택된 파일 종류에 따라 마크다운·HTML·코드 프리뷰를 렌더링하는 컨테이너.
 *
 * - .html 파일 → HtmlFileViewer (샌드박스 iframe)
 * - 코드 매핑 확장자(.py/.ts/.json 등) → CodeFileViewer (Shiki 구문 강조)
 * - 그 외 → MarkdownPreview (기존 마크다운 렌더링 파이프라인)
 *
 * 기존 MarkdownPreview / PreviewRenderer / HtmlFileViewer는 변경 없이 재사용된다.
 */
export function PreviewContainer({ previewRef }: PreviewContainerProps): JSX.Element {
  const currentFile = useFileStore((s) => s.currentFile);
  const viewType = getFileViewType(currentFile);

  if (viewType === 'html' && currentFile) {
    return <HtmlFileViewer htmlPath={currentFile} />;
  }

  if (viewType === 'code') {
    // getLangForExtension은 viewType === 'code'일 때 반드시 non-null을 반환한다
    const lang = getLangForExtension(currentFile) ?? 'text';
    return <CodeFileViewer lang={lang} />;
  }

  return <MarkdownPreview previewRef={previewRef} />;
}
