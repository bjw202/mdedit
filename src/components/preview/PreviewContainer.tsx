// @MX:ANCHOR: [AUTO] 프리뷰 패널 파일 종류 분기 컴포넌트 — AppLayout의 공통 진입점
// @MX:REASON: AppLayout과 네 가지 프리뷰 컴포넌트(MarkdownPreview, HtmlFileViewer, CodeFileViewer, UnsupportedFileViewer)의 연결점.
//   currentFile + previewStatus 변경 시 이 컴포넌트가 올바른 뷰로 라우팅하지 않으면 프리뷰 전환이 깨진다.
//   fan_in: AppLayout(1) + 미래 통합 진입점 추가 가능성 → ANCHOR 유지.
// @MX:SPEC: SPEC-PREVIEW-004 REQ-PREVIEW004-001, SPEC-PREVIEW-005 REQ-PREVIEW005-001
// @MX:SPEC: SPEC-PREVIEW-007 REQ-PREVIEW007-003 REQ-PREVIEW007-004 REQ-PREVIEW007-005 REQ-PREVIEW007-007

import type { RefObject } from 'react';
import { useFileStore } from '@/store/fileStore';
import type { PreviewStatus } from '@/store/fileStore';
import { getLangForExtension } from '@/lib/preview/extensionLangMap';
import { MarkdownPreview } from './MarkdownPreview';
import { HtmlFileViewer } from './HtmlFileViewer';
import { CodeFileViewer } from './CodeFileViewer';
import { UnsupportedFileViewer } from './UnsupportedFileViewer';

/**
 * 파일 종류를 판단하는 순수 함수 (경로 기반 기본 분류 + previewStatus 오버라이드).
 *
 * 분기 우선순위 (SPEC-PREVIEW-007 결정 1, 회귀 수정):
 * 1. .html(대소문자 무관) → 'html'  (SPEC-PREVIEW-004 기존 동작 유지)
 * 2. .md / .markdown(대소문자 무관) → 'markdown'  (회귀 수정: previewStatus='text'로 덮어써지지 않도록)
 * 3. extensionLangMap 조회 성공 → 'code'  (SPEC-PREVIEW-005 기존 동작 유지)
 * 4. previewStatus = 'binary' | 'too-large' → 'unsupported'  (SPEC-PREVIEW-007 신규)
 * 5. previewStatus = 'text' → 'text'  (SPEC-PREVIEW-007 신규)
 * 6. 그 외 → 'markdown'  (기존 폴백)
 *
 * @param path - 파일 경로 또는 파일명
 * @param previewStatus - openFile이 판정한 파일 분류 결과 (단일 진실 공급원)
 * @returns 'html' | 'code' | 'unsupported' | 'text' | 'markdown'
 */
export function getFileViewType(
  path: string | null | undefined,
  previewStatus: PreviewStatus = null
): 'html' | 'code' | 'unsupported' | 'text' | 'markdown' {
  if (!path) return 'markdown';

  const lower = path.toLowerCase();

  // 1순위: .html 분기 — SPEC-PREVIEW-004 동작 무변경
  if (lower.endsWith('.html')) return 'html';

  // 2순위: 마크다운 확장자 명시적 체크 — previewStatus보다 반드시 앞에 위치해야 함
  // openFile이 .md를 읽으면 previewStatus='text'로 설정하지만,
  // .md 파일은 항상 마크다운 뷰어로 렌더되어야 한다 (핵심 기능 보호)
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';

  // 3순위: 코드 매핑 조회 — SPEC-PREVIEW-005 기존 동작 유지
  if (getLangForExtension(path) !== null) return 'code';

  // 4순위: previewStatus 기반 분류 — SPEC-PREVIEW-007 신규
  // 경로만으로는 바이너리·대용량 여부를 알 수 없으므로 openFile이 판정한 상태를 참조한다
  if (previewStatus === 'binary' || previewStatus === 'too-large') return 'unsupported';
  if (previewStatus === 'text') return 'text';

  // 5순위: 폴백
  return 'markdown';
}

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
