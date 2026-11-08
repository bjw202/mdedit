// @MX:ANCHOR: [AUTO] 프리뷰 패널 파일 종류 분기 컴포넌트 — AppLayout의 공통 진입점
// @MX:REASON: AppLayout과 네 가지 프리뷰 컴포넌트(MarkdownPreview, HtmlFileViewer, CodeFileViewer, UnsupportedFileViewer)의 연결점.
//   currentFile + previewStatus 변경 시 이 컴포넌트가 올바른 뷰로 라우팅하지 않으면 프리뷰 전환이 깨진다.
//   fan_in: AppLayout(1) + 미래 통합 진입점 추가 가능성 → ANCHOR 유지.
// @MX:SPEC: SPEC-PREVIEW-004 REQ-PREVIEW004-001, SPEC-PREVIEW-005 REQ-PREVIEW005-001
// @MX:SPEC: SPEC-PREVIEW-007 REQ-PREVIEW007-003 REQ-PREVIEW007-004 REQ-PREVIEW007-005 REQ-PREVIEW007-007
// @MX:SPEC: SPEC-PREVIEW-008 REQ-PREVIEW008-001 REQ-PREVIEW008-004 REQ-PREVIEW008-008
// @MX:SPEC: SPEC-IMG-LOAD-001 REQ-IMG-LOAD-B-001

import type { RefObject } from 'react';
import { useFileStore } from '@/store/fileStore';
import { getLangForExtension } from '@/lib/preview/extensionLangMap';
import { getFileViewType } from '@/lib/preview/fileViewType';
import { MarkdownPreview } from './MarkdownPreview';
import { HtmlFileViewer } from './HtmlFileViewer';
import { CodeFileViewer } from './CodeFileViewer';
import { UnsupportedFileViewer } from './UnsupportedFileViewer';
import { ImageFileViewer } from './ImageFileViewer';
import { SvgFileViewer } from './SvgFileViewer';

// 기존 import 경로 호환: getFileViewType은 '@/lib/preview/fileViewType'로 옮겨졌다 (SPEC-PREVIEW-018).
export { getFileViewType };

interface PreviewContainerProps {
  /** 스크롤 싱크용 프리뷰 컨테이너 ref (마크다운 경로에서만 사용) */
  previewRef: RefObject<HTMLDivElement>;
}

/**
 * 현재 선택된 파일 종류에 따라 마크다운·HTML·코드·평문·미지원 프리뷰를 렌더링하는 컨테이너.
 *
 * - .html 파일 → HtmlFileViewer (샌드박스 iframe)
 * - 코드 매핑 확장자(.py/.ts/.json 등) → CodeFileViewer (Shiki 구문 강조)
 * - binary/too-large → UnsupportedFileViewer (미리보기 불가 플레이스홀더)
 * - 그 외 텍스트 파일 → CodeFileViewer lang='text' (평문 표시, SPEC-PREVIEW-007)
 * - .md / previewStatus=null → MarkdownPreview (기존 마크다운 렌더링 파이프라인)
 *
 * 기존 MarkdownPreview / HtmlFileViewer / CodeFileViewer는 변경 없이 재사용된다.
 */
export function PreviewContainer({ previewRef }: PreviewContainerProps): JSX.Element {
  const currentFile = useFileStore((s) => s.currentFile);
  const previewStatus = useFileStore((s) => s.previewStatus);
  const viewType = getFileViewType(currentFile, previewStatus);

  if (viewType === 'html' && currentFile) {
    return <HtmlFileViewer htmlPath={currentFile} />;
  }

  if (viewType === 'image' && currentFile) {
    return <ImageFileViewer imagePath={currentFile} />;
  }

  if (viewType === 'svg' && currentFile) {
    return <SvgFileViewer svgPath={currentFile} />;
  }

  if (viewType === 'code') {
    // getLangForExtension은 viewType === 'code'일 때 반드시 non-null을 반환한다
    const lang = getLangForExtension(currentFile) ?? 'text';
    return <CodeFileViewer lang={lang} />;
  }

  if (viewType === 'unsupported' && currentFile) {
    // 파일명 추출 (경로의 마지막 세그먼트)
    const filename = currentFile.split(/[/\\]/).pop() ?? currentFile;
    const reason = previewStatus === 'too-large' ? 'too-large' : 'binary';
    return <UnsupportedFileViewer reason={reason} filename={filename} />;
  }

  if (viewType === 'text') {
    // 미매핑 텍스트 파일: CodeFileViewer를 lang='text'로 재사용 (SPEC-PREVIEW-007 결정 4)
    return <CodeFileViewer lang="text" />;
  }

  // 기존 마크다운 경로 — .md 파일 또는 폴백
  return <MarkdownPreview previewRef={previewRef} />;
}
