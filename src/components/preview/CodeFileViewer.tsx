// @MX:NOTE: [AUTO] 코드/설정 파일을 구문 강조하여 표시하는 보기 전용 컴포넌트.
//   에디터 버퍼(useEditorStore.content)를 구독하고 공유 Shiki 싱글톤으로 강조한다.
//   usePreview 훅의 디바운스(300ms) + 테마 구독 + 하이라이터 초기화 패턴을 복제한다.
//   usePreview 자체는 수정하지 않아 마크다운 렌더 경로 회귀를 방지한다.
//
//   Shiki XSS 보안 posture:
//   Shiki는 입력 소스 텍스트를 HTML 이스케이프한 후 토큰화하므로
//   dangerouslySetInnerHTML 사용 시 추가 sanitize가 불필요하다.
//   PreviewRenderer(마크다운)가 신뢰된 renderMarkdown 출력에 대해 취하는 포스처와 동일하다.
// @MX:SPEC: SPEC-PREVIEW-005 REQ-PREVIEW005-002 REQ-PREVIEW005-003

import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useUIStore } from '@/store/uiStore';
import { getHighlighter } from '@/lib/markdown/codeHighlight';
import type { ShikiHighlighter } from '@/lib/markdown/codeHighlight';

/** 마크다운 경로(usePreview)와 동일한 디바운스 간격 */
const DEBOUNCE_MS = 300;

interface CodeFileViewerProps {
  /** extensionLangMap에서 결정된 Shiki 언어 식별자 */
  lang: string;
}

/**
 * 보기 전용 소스/설정 파일 뷰어.
 *
 * - useEditorStore.content를 구독하여 라이브 재렌더
 * - 300ms 디바운스로 과도한 강조 방지
 * - github-dark / github-light 테마를 useUIStore.theme에 연동
 * - Shiki 초기화 실패 또는 강조 오류 시 plaintext 폴백(앱 중단 없음)
 */
export function CodeFileViewer({ lang }: CodeFileViewerProps): JSX.Element {
  const [html, setHtml] = useState('');
  const [highlighter, setHighlighter] = useState<ShikiHighlighter | null>(null);
  // 이전 html 값을 stale closure 없이 참조하기 위한 ref
  const htmlRef = useRef('');

  const content = useEditorStore((s) => s.content);
  // theme 구독: 테마 전환 시 effect 재실행을 트리거한다
  const theme = useUIStore((s) => s.theme);

  // html state와 ref를 동기화
  const updateHtml = (next: string): void => {
    htmlRef.current = next;
    setHtml(next);
  };

  // Shiki 싱글톤을 마운트 시 한 번 초기화
  useEffect(() => {
    getHighlighter()
      .then((h) => setHighlighter(h))
      .catch(() => {
        // 초기화 실패 시 강조 없이 계속 진행 (plaintext 폴백)
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!highlighter) return;

      // DOM 클래스로 현재 다크 모드 여부 판단 (usePreview와 동일한 패턴)
      const isDark = document.documentElement.classList.contains('dark');
      const shikiTheme = isDark ? 'github-dark' : 'github-light';

      try {
        const highlighted = highlighter.codeToHtml(content, { lang, theme: shikiTheme });
        updateHtml(highlighted);
      } catch {
        // 미로드 언어 또는 강조 오류 처리:
        // - 이전 출력이 없으면 plaintext 폴백으로 파일 내용을 표시한다 (내용 손실 방지)
        // - 이전 출력이 있으면 유지한다 (htmlRef.current 참조로 stale closure 회피)
        if (!htmlRef.current) {
          const escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          updateHtml(`<pre><code>${escaped}</code></pre>`);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [content, highlighter, lang, theme]); // theme 변경 시 재강조

  return (
    <div
      className="code-file-viewer h-full overflow-auto p-4"
      // Shiki XSS posture: 입력이 이스케이프되므로 안전
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
