import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { openUrlInBrowser } from '@/lib/tauri/ipc';

// @MX:ANCHOR: [AUTO] PreviewRenderer - sanitized HTML을 DOM에 렌더하고 mermaid 다이어그램을 처리하는 핵심 컴포넌트
// @MX:REASON: [AUTO] MarkdownPreview, 내보내기 함수 등에서 직접 사용되는 중심 렌더 타겟 (fan_in >= 3)
// @MX:SPEC: SPEC-PREVIEW-001
// @MX:NOTE: [AUTO] dangerouslySetInnerHTML은 의도적으로 사용됨
// markdown-it이 html:false로 렌더하므로 원시 HTML 주입이 차단되어 안전하다
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
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="preview-content"
      // zoom을 적용해 헤딩·코드·테이블 등 Tailwind 고정 크기 요소까지 전체 비례 스케일
      style={{ zoom }}
      // Safe: markdown-it html:false prevents raw HTML injection
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
