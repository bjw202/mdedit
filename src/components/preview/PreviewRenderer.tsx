import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { openUrlInBrowser } from '@/lib/tauri/ipc';

// @MX:ANCHOR: [AUTO] PreviewRenderer - renders sanitized HTML and triggers mermaid diagram rendering
// @MX:REASON: [AUTO] Central render target used by MarkdownPreview and exported HTML functions (fan_in >= 3)
// @MX:SPEC: SPEC-PREVIEW-001
// @MX:NOTE: [AUTO] dangerouslySetInnerHTML is intentionally used here
// This is safe because markdown-it renders with html:false which blocks raw HTML injection
// @MX:WARN: [AUTO] mermaid.render() is async inside forEach - errors per-diagram are caught individually
// @MX:REASON: [AUTO] One broken diagram must not prevent other diagrams or the preview from rendering
// @MX:NOTE: [AUTO] mermaid.parse() is called before render() to pre-validate syntax
// This prevents mermaid's native bomb-icon error SVG from being rendered into the DOM
// @MX:NOTE: [AUTO] 링크 클릭 시 시스템 기본 브라우저로 열기
// Preview 패널 내부의 링크를 클릭하면 WebView 내부가 아닌 시스템 기본 브라우저로 엽니다.

// Initialize mermaid once at module load time
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });

/** Props for the PreviewRenderer component */
interface PreviewRendererProps {
  html: string;
  /** Font size in px applied to preview content */
  fontSize?: number;
}

/**
 * Renders pre-sanitized HTML from markdown-it into the DOM.
 * After mounting/updating, also handles:
 * 1. Mermaid diagram rendering (finds .mermaid-container divs)
 * 2. (Extension point) Copy buttons for code blocks
 */
export function PreviewRenderer({ html, fontSize }: PreviewRendererProps): JSX.Element {
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
      style={fontSize !== undefined ? { fontSize: `${fontSize}px` } : undefined}
      // Safe: markdown-it html:false prevents raw HTML injection
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
