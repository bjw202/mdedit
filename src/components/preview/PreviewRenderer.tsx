import { useEffect, useMemo, useRef } from 'react';
import mermaid from 'mermaid';
import { openUrlInBrowser } from '@/lib/tauri/ipc';
import { sanitizeSvg } from '@/lib/preview/svgSanitize';

// @MX:ANCHOR: [AUTO] PreviewRenderer - sanitized HTML을 DOM에 렌더하고 mermaid 다이어그램을 처리하는 핵심 컴포넌트
// @MX:REASON: [AUTO] MarkdownPreview, 내보내기 함수 등에서 직접 사용되는 중심 렌더 타겟 (fan_in >= 3)
// @MX:SPEC: SPEC-PREVIEW-001
// @MX:SPEC: SPEC-PREVIEW-008 REQ-PREVIEW008-005 REQ-PREVIEW008-006
// @MX:NOTE: [AUTO] dangerouslySetInnerHTML은 의도적으로 사용됨
// markdown-it이 html:false로 렌더하므로 원시 HTML 주입이 차단되어 안전하다.
// SPEC-PREVIEW-008: renderer.ts가 남긴 data-mdedit-svg 마커만 예외적으로 svgSanitize(DOMPurify SVG
// 프로파일)를 거쳐 복원되며, 그 외 원시 HTML은 여전히 markdown-it html:false로 차단된다.
// @MX:WARN: [AUTO] mermaid.render()가 forEach 내부에서 async로 실행됨 — 다이어그램별로 개별 catch
// @MX:REASON: [AUTO] 하나의 깨진 다이어그램이 다른 다이어그램이나 미리보기 전체를 막아서는 안 됨
// @MX:NOTE: [AUTO] mermaid.parse()를 render() 전에 호출하여 문법 오류를 사전 검증
// mermaid 내장 bomb-icon 오류 SVG가 DOM에 삽입되는 것을 방지한다
// @MX:NOTE: [AUTO] zoom prop: fontSize → zoom(= fontSize/14) 변환은 MarkdownPreview에서 담당
// PreviewRenderer는 전달받은 zoom 값을 style={{ zoom }}으로 직접 적용한다
// @MX:NOTE: [AUTO] 링크 클릭 시 시스템 기본 브라우저로 열기
// Preview 패널 내부의 링크를 클릭하면 WebView 내부가 아닌 시스템 기본 브라우저로 엽니다.

// Initialize mermaid once at module load time
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });

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
 * 1. Mermaid diagram rendering (finds .mermaid-container divs)
 * 2. (Extension point) Copy buttons for code blocks
 */
export function PreviewRenderer({ html, zoom = 1 }: PreviewRendererProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // SPEC-PREVIEW-008: dangerouslySetInnerHTML 직전에 인라인 svg 마커를 sanitize된 svg로 복원한다.
  const safeHtml = useMemo(() => restoreInlineSvgMarkers(html), [html]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    // Mermaid diagram rendering
    const containers = containerRef.current.querySelectorAll('.mermaid-container');
    containers.forEach(async (el) => {
      const diagram = el.getAttribute('data-diagram') ?? '';
      try {
        await mermaid.parse(diagram);
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, diagram);
        el.innerHTML = svg;
      } catch {
        el.innerHTML = '<p class="text-sm text-amber-500 italic py-2">⚠ Diagram syntax error</p>';
      }
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

    containerRef.current.addEventListener('click', handleLinkClick);

    // Cleanup: 이벤트 리스너 제거
    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', handleLinkClick);
      }
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
