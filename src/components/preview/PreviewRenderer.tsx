import { useEffect, useMemo, useRef } from 'react';
import { openUrlInBrowser } from '@/lib/tauri/ipc';
import { sanitizeSvg } from '@/lib/preview/svgSanitize';
import { renderDiagram, formatDiagramError } from '@/lib/diagram/diagramRenderer';

// @MX:ANCHOR: [AUTO] PreviewRenderer - sanitized HTML을 DOM에 렌더하고 다이어그램 펜스를 다이어그램 모듈로 렌더하는 핵심 컴포넌트
// @MX:REASON: [AUTO] 미리보기 화면의 중심 렌더 타겟. 운영 코드 직접 사용처는 MarkdownPreview.tsx 1곳이다(M7 grep 측정, fan_in = 1).
//   SPEC-PREVIEW-015 M4 이후 내보내기는 이 컴포넌트의 DOM을 읽지 않고 원본 펜스를 직접 렌더한다. fan_in < 3이므로 NOTE 강등 후보(보고만, 자동 삭제 금지).
// @MX:SPEC: SPEC-PREVIEW-001
// @MX:SPEC: SPEC-PREVIEW-008 REQ-PREVIEW008-005 REQ-PREVIEW008-006
// @MX:SPEC: SPEC-PREVIEW-010 SPEC-PREVIEW-015
// @MX:NOTE: [AUTO] dangerouslySetInnerHTML은 의도적으로 사용됨
// markdown-it이 html:false로 렌더하므로 원시 HTML 주입이 차단되어 안전하다.
// SPEC-PREVIEW-008: renderer.ts가 남긴 data-mdedit-svg 마커만 예외적으로 svgSanitize(DOMPurify SVG
// 프로파일)를 거쳐 복원되며, 그 외 원시 HTML은 여전히 markdown-it html:false로 차단된다.
// @MX:NOTE: [AUTO] 다이어그램은 컨테이너마다 renderDiagram을 동기로 호출하고 결과를 따로 넣는다.
// 모듈은 예외를 던지지 않으므로 한 다이어그램의 실패가 다른 다이어그램이나 미리보기 전체를 막지 않는다(REQ-PREVIEW015-009).
// @MX:NOTE: [AUTO] 다이어그램 SVG는 테마와 무관한 고정 팔레트(잉크 앤 허니 리터럴)로 렌더되므로 테마 전환 시 다시 렌더하지 않는다
// (SPEC-PREVIEW-016 REQ-PREVIEW016-008). 그래서 이 컴포넌트는 테마 상태를 구독하지 않는다.
// @MX:NOTE: [AUTO] zoom prop: fontSize → zoom(= fontSize/14) 변환은 MarkdownPreview에서 담당
// PreviewRenderer는 전달받은 zoom 값을 style={{ zoom }}으로 직접 적용한다
// @MX:NOTE: [AUTO] 링크 클릭 시 시스템 기본 브라우저로 열기
// Preview 패널 내부의 링크를 클릭하면 WebView 내부가 아닌 시스템 기본 브라우저로 엽니다.
// 다이어그램 안에는 링크가 없다(links: false + 다이어그램 전용 정화) — 이 처리는 마크다운 본문 링크용이다.

// @MX:WARN: [AUTO] strict 모드 = pele 기본 보안 + 다이어그램 전용 정화(별도 DOMPurify 인스턴스, 재등록한 href 차단 훅,
//   수식용으로 foreignObject.pele-math·그 안의 감싸기 div·MathML 태그·semantics·annotation[encoding]만 추가 허용) + links/images false.
//   옵션·정화를 약화하지 않는다
// @MX:REASON: [AUTO] 다이어그램 SVG는 innerHTML로 들어가므로 renderDiagram을 거치지 않은 렌더나 옵션·정화 약화는 곧 XSS·외부 요청 경로다.
//   오류 문구도 textContent로만 넣는다(REQ-PREVIEW015-004).
const DIAGRAM_ERROR_CLASS = 'text-sm text-amber-500 italic py-2';

// SPEC-PREVIEW-008 D4: renderer.ts(extractInlineSvg)가 남긴 마커 형식과 반드시 일치해야 한다.
const SVG_MARKER_RE = /<div data-mdedit-svg="([^"]*)"><\/div>/g;

// @MX:NOTE: [AUTO] 인라인 SVG sanitize + 복원 — SvgFileViewer 렌더 뷰와 동일한 svgSanitize를 사용한다
// (적용 지점 단일화, SPEC-PREVIEW-008 Security). 이 함수는 순수 문자열 변환이므로 렌더 본문에서
// dangerouslySetInnerHTML에 넘기기 직전에 동기적으로 호출해도 안전하다(부수효과 없음).
function restoreInlineSvgMarkers(html: string): string {
  if (!html.includes('data-mdedit-svg=')) return html;

  return html.replace(SVG_MARKER_RE, (_match, encoded: string) => {
    try {
      const raw = decodeURIComponent(encoded);
      return sanitizeSvg(raw);
    } catch {
      // 디코딩/파싱 실패 시 앱 중단 대신 빈 렌더로 폴백 (REQ-PREVIEW008-005)
      return '';
    }
  });
}

/** Props for the PreviewRenderer component */
interface PreviewRendererProps {
  html: string;
  /** CSS zoom 비율 — fontSize/14 로 파생된 값. 기본 1(변화 없음).
   *  헤딩·코드·테이블 등 Tailwind 고정 크기 요소를 포함해 전체를 비례 스케일한다. */
  zoom?: number;
}

/**
 * Renders pre-sanitized HTML from markdown-it into the DOM.
 * After mounting/updating, also handles:
 * 1. Diagram rendering via the diagram module (finds .mermaid-container divs)
 * 2. (Extension point) Copy buttons for code blocks
 */
export function PreviewRenderer({ html, zoom = 1 }: PreviewRendererProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // SPEC-PREVIEW-008: dangerouslySetInnerHTML 직전에 인라인 svg 마커를 sanitize된 svg로 복원한다.
  const safeHtml = useMemo(() => restoreInlineSvgMarkers(html), [html]);

  useEffect(() => {
    // cleanup 시점의 containerRef.current 는 리스너를 붙인 그 노드가 아닐 수 있다
    // (리렌더로 교체되었을 수 있음). 노드를 지금 붙잡아 두고 cleanup 에서 그대로 쓴다.
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // 다이어그램 렌더: 컨테이너마다 모듈을 동기로 호출한다(SPEC-PREVIEW-015 D3).
    const containers = container.querySelectorAll('.mermaid-container');
    containers.forEach((el) => {
      const diagram = el.getAttribute('data-diagram') ?? '';
      // @MX:NOTE: [AUTO] SPEC-UI-008 빈 펜스 분기 — 본문을 trim()했을 때 빈 문자열이면
      // 렌더를 호출하지 않고(빈 입력은 오류가 되므로) 안내 플레이스홀더를
      // 표시한다. 비어 있지 않으면 아래 통상 렌더→오류 문구(⚠ 폴백) 경로를 그대로 탄다.
      // @MX:SPEC: SPEC-UI-008
      if (diagram.trim() === '') {
        el.innerHTML =
          '<p class="md-diagram-placeholder">다이어그램 문법을 입력하세요</p>';
        return;
      }
      const result = renderDiagram(diagram);
      if (result.ok) {
        // 정화된 SVG(다이어그램 전용 정화 경로)만 넣는다.
        el.innerHTML = result.svg;
        return;
      }
      // 오류 문구는 텍스트 노드로만 넣는다(D9) — 소스·메시지가 HTML로 해석되지 않는다.
      const p = document.createElement('p');
      p.className = DIAGRAM_ERROR_CLASS;
      p.textContent = formatDiagramError(result.error);
      el.replaceChildren(p);
    });

    // 링크 클릭 핸들러 - 시스템 기본 브라우저로 열기
    const handleLinkClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor) {
        const href = anchor.getAttribute('href');

        // 유효한 HTTP/HTTPS 링크만 처리
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          event.preventDefault();
          event.stopPropagation();

          console.log('[PreviewRenderer] Opening URL:', href);

          try {
            // Tauri shell 플러그인을 사용하여 시스템 브라우저로 열기
            await openUrlInBrowser(href);
            console.log('[PreviewRenderer] URL opened successfully via shell command');
          } catch (err) {
            console.error('[PreviewRenderer] Failed to open URL:', err);

            // fallback: window.open 시도
            const opened = window.open(href, '_blank', 'noopener,noreferrer');
            if (!opened) {
              console.error('[PreviewRenderer] Failed to open URL via window.open as fallback');
            }
          }
        } else if (href) {
          // 상대 경로나 다른 프로토콜은 기본 동작 허용
          console.log('[PreviewRenderer] Skipping non-HTTP link:', href);
        }
      }
    };

    container.addEventListener('click', handleLinkClick);

    // Cleanup: 이벤트 리스너 제거
    return () => {
      container.removeEventListener('click', handleLinkClick);
    };
  }, [safeHtml]);

  return (
    <div
      ref={containerRef}
      className="preview-content"
      // zoom을 적용해 헤딩·코드·테이블 등 Tailwind 고정 크기 요소까지 전체 비례 스케일
      style={{ zoom }}
      // Safe: markdown-it html:false prevents raw HTML injection; svg 마커만 svgSanitize를 거쳐
      // safeHtml에 복원되었다 (SPEC-PREVIEW-008 REQ-PREVIEW008-005/006)
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
