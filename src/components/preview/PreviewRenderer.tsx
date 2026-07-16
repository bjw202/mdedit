import { useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { openUrlInBrowser } from '@/lib/tauri/ipc';
import { sanitizeSvg } from '@/lib/preview/svgSanitize';
import { useUIStore } from '@/store/uiStore';

// @MX:ANCHOR: [AUTO] PreviewRenderer - sanitized HTML을 DOM에 렌더하고 mermaid 다이어그램을 처리하는 핵심 컴포넌트
// @MX:REASON: [AUTO] MarkdownPreview, 내보내기 함수 등에서 직접 사용되는 중심 렌더 타겟 (fan_in >= 3)
// @MX:SPEC: SPEC-PREVIEW-001
// @MX:SPEC: SPEC-PREVIEW-008 REQ-PREVIEW008-005 REQ-PREVIEW008-006
// @MX:SPEC: SPEC-PREVIEW-010
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

// SPEC-PREVIEW-010 D2: securityLevel/startOnLoad는 고정 베이스 상수로 유지하고 theme만 동적으로
// 교체한다. 재초기화 시 이 상수를 재사용하여 securityLevel: 'strict' 약화를 원천 차단한다(REQ-004).
// @MX:WARN: [AUTO] securityLevel을 'strict'보다 약한 값으로 절대 덮어쓰지 않는다
// @MX:REASON: [AUTO] mermaid 라벨 HTML 이스케이프/스크립트 차단이 풀리면 XSS 경로가 열린다
const MERMAID_BASE_CONFIG = { startOnLoad: false, securityLevel: 'strict' as const };

/**
 * theme(light/dark/system) 값으로부터 실효 다크 여부를 판정한다.
 * system 모드에서는 OS `prefers-color-scheme`를 직접 조회한다(useTheme.ts와 동일한 판정 로직).
 */
function getEffectiveIsDark(theme: string): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

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

  // SPEC-PREVIEW-010: 앱 테마 신호를 구독해 mermaid 다이어그램 테마를 연동한다.
  const theme = useUIStore((s) => s.theme);
  const [isDark, setIsDark] = useState<boolean>(() => getEffectiveIsDark(theme));

  // system 모드에서는 명시적 theme 값이 바뀌지 않아도 OS 색 구성 변경(change 이벤트)에
  // 반응해야 하므로, matchMedia 리스너로 실효 다크 여부를 별도 파생한다(REQ-003).
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDark(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent): void => setIsDark(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
    setIsDark(theme === 'dark');
    return undefined;
  }, [theme]);

  // SPEC-PREVIEW-008: dangerouslySetInnerHTML 직전에 인라인 svg 마커를 sanitize된 svg로 복원한다.
  const safeHtml = useMemo(() => restoreInlineSvgMarkers(html), [html]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    // SPEC-PREVIEW-010 REQ-001/002: mermaid.render가 산출한 SVG는 색을 굽어 넣으므로(baked),
    // 테마가 바뀔 때마다 현재 테마로 재초기화한 뒤 컨테이너를 다시 render해야 재채색된다.
    // 이 effect의 의존성에 isDark를 포함시켜 테마 토글만으로도 재실행되게 한다(D5).
    mermaid.initialize({ ...MERMAID_BASE_CONFIG, theme: isDark ? 'dark' : 'default' });

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
  }, [safeHtml, isDark]);

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
