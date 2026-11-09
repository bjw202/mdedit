// @MX:WARN: [AUTO] sandbox 속성 설정 — iframe 보안 격리의 핵심 제어점 (두 렌더 모드)
// @MX:REASON: 선명 모드(srcdoc)는 sandbox="allow-scripts"만 쓴다 — allow-same-origin이 없으므로 문서 출처가
//   불투명(opaque)이라 004/018의 asset 방식보다 의도적으로 조인 것이다. 앱이 만든 고정 스크립트만 셸 CSP의
//   sha256 해시로 실행되고, 페이지 자체 스크립트는 srcdoc 문서 안에서 상속된 CSP가 막는다(단 프레임이
//   asset 문서로 이동하면 CSP 없이 실행되므로 이 차단은 보안 경계가 아니다 — 앱 명령 방어는 SPEC-SEC-001).
//   원본 보기(asset iframe)는 sandbox="allow-scripts allow-same-origin" 그대로다: iframe은 asset:// origin이라
//   앱 셸(tauri://)과 cross-origin이므로 __TAURI__·parent 접근은 차단된다(수동 검증 5-B). allow-popups·
//   allow-forms·allow-top-navigation 등 추가 권한은 두 모드 모두 부여 금지. sandbox 권한 변경 시
//   acceptance 시나리오 3(앱 권한 탈취 차단)과 SPEC-PREVIEW-019 AC-014(M-6)를 반드시 재검증할 것.
// @MX:SPEC: SPEC-PREVIEW-004 REQ-PREVIEW004-002, REQ-PREVIEW004-005, SPEC-PREVIEW-019 REQ-PREVIEW019-011

import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useUIStore } from '@/store/uiStore';
import { readFile, readFileSize } from '@/lib/tauri/ipc';
import {
  FRAME_ZOOM_MESSAGE_TYPE,
  HTML_CRISP_MAX_BYTES,
  baseHrefFromAssetUrl,
  buildSrcdoc,
} from '@/lib/preview/htmlSrcdoc';

interface HtmlFileViewerProps {
  /** 렌더링할 HTML 파일의 절대 경로 */
  htmlPath: string;
}

/** convertFileSrc 결과의 %2F·%5C를 슬래시로 되돌린 계층적 asset 주소 (두 모드 공통). */
function toAssetUrl(htmlPath: string): string {
  // convertFileSrc는 전체 경로를 encodeURIComponent로 인코딩(슬래시 → %2F, 백슬래시 → %5C)
  // 하므로 iframe 내부 상대경로 해소가 깨진다. macOS는 %2F만 나오지만 Windows는 %5C도
  // 함께 나오므로 둘 다 슬래시로 정규화하여 계층적 URL을 만든다. asset 핸들러가
  // percent-decode하면 `C:/path/...` 형태가 되어 Windows 파일시스템에서도 정상 해소된다.
  return convertFileSrc(htmlPath).replace(/%2F/gi, '/').replace(/%5C/gi, '/');
}

/**
 * HTML 파일 미리보기. 렌더 모드(htmlRenderMode)에 따라 분기한다 (SPEC-PREVIEW-019).
 * - 'original': asset iframe + 감싸개 transform 배율 (SPEC-PREVIEW-004/018 동작 그대로)
 * - 'crisp'(기본): 파일을 읽어 srcdoc iframe으로 렌더, 배율은 문서 자체 zoom
 */
export function HtmlFileViewer({ htmlPath }: HtmlFileViewerProps): JSX.Element {
  const mode = useUIStore((state) => state.htmlRenderMode);
  return mode === 'original' ? (
    <OriginalHtmlView htmlPath={htmlPath} />
  ) : (
    <CrispHtmlView htmlPath={htmlPath} />
  );
}

// ---- 선명 모드 (SPEC-PREVIEW-019) ----

type FallbackReason = 'utf8' | 'read' | 'size';

type CrispState =
  | { kind: 'loading' }
  | { kind: 'ready'; srcdoc: string }
  | { kind: 'fallback'; reason: FallbackReason };

const FALLBACK_MESSAGE: Record<FallbackReason, string> = {
  utf8: 'UTF-8 형식이 아니라서 원본 보기로 표시합니다.',
  read: '파일을 읽지 못해 원본 보기로 표시합니다.',
  size: '파일이 10MB보다 커서 원본 보기로 표시합니다. (선명 모드는 파일 전체를 메모리에 올립니다.)',
};

// @MX:NOTE: [AUTO] 선명 모드 — 앱이 HTML 텍스트를 읽어 <base>·초기 zoom·고정 스크립트를 주입한 srcdoc로 렌더하고,
// 배율 변경은 부모 → 자식 postMessage로 documentElement.style.zoom만 바꾼다(srcdoc 문자열·iframe 불변, 스크롤 유지).
// 문서 자신의 zoom은 레이아웃부터 다시 그려 100% 초과에서도 선명하다(iframe 요소 transform은 비트맵 확대라 흐림).
// 018식 크기 역보정을 함께 쓰면 선명도가 되돌아가므로 쓰지 않는다. 부모는 이 프레임의 message를 받지 않는다.
// @MX:SPEC: SPEC-PREVIEW-019
function CrispHtmlView({ htmlPath }: HtmlFileViewerProps): JSX.Element {
  const htmlZoom = useUIStore((state) => state.htmlZoom);
  const [state, setState] = useState<CrispState>({ kind: 'loading' });
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    void (async () => {
      // 크기 조회 실패는 검사를 건너뛰고 읽기를 시도한다. 정확히 상한과 같으면 폴백하지 않는다.
      const size = await readFileSize(htmlPath).catch(() => null);
      if (cancelled) return;
      if (size !== null && size > HTML_CRISP_MAX_BYTES) {
        setState({ kind: 'fallback', reason: 'size' });
        return;
      }
      try {
        const text = await readFile(htmlPath);
        if (cancelled) return;
        // 초기 배율은 조립 시점에 한 번만 읽는다 — 이후 배율 변경이 srcdoc 문자열을 바꾸지 않게 한다.
        const srcdoc = buildSrcdoc(text, {
          baseHref: baseHrefFromAssetUrl(toAssetUrl(htmlPath)),
          zoomPercent: useUIStore.getState().htmlZoom,
        });
        setState({ kind: 'ready', srcdoc });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setState({ kind: 'fallback', reason: /utf-?8/i.test(msg) ? 'utf8' : 'read' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [htmlPath]);

  const postZoom = (percent: number): void => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: FRAME_ZOOM_MESSAGE_TYPE, zoom: percent / 100 },
      // 선명 모드 프레임의 출처는 불투명이라 구체적인 origin을 지정할 수 없다. 보내는 값은 배율 숫자뿐이다.
      '*',
    );
  };

  // 배율 변경: 재렌더 없이 메시지만 보낸다.
  useEffect(() => {
    postZoom(htmlZoom);
  }, [htmlZoom]);

  if (state.kind === 'fallback') {
    return (
      <div className="h-full flex flex-col">
        <div
          role="status"
          className="shrink-0 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"
        >
          {FALLBACK_MESSAGE[state.reason]}
        </div>
        <div className="flex-1 min-h-0">
          <OriginalHtmlView htmlPath={htmlPath} />
        </div>
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div
        className="h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500"
        data-testid="html-preview-loading"
      >
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden" data-testid="html-preview-zoom-wrapper">
      <iframe
        ref={iframeRef}
        srcDoc={state.srcdoc}
        title="HTML 파일 미리보기"
        className="w-full h-full border-0"
        // 선명 모드는 allow-scripts만: allow-same-origin을 빼서 문서 출처를 불투명으로 만든다.
        sandbox="allow-scripts"
        // 문서가 로드된 직후 현재 배율을 한 번 보낸다(로드 중 배율이 바뀐 경우 불일치 방지).
        onLoad={() => postZoom(useUIStore.getState().htmlZoom)}
        data-testid="html-preview-iframe"
      />
    </div>
  );
}

// ---- 원본 보기 (SPEC-PREVIEW-004/018 동작 그대로) ----

/**
 * HTML 파일을 샌드박스 iframe 안에서 렌더링하는 원본 보기.
 *
 * - iframe + asset 프로토콜은 OS-level 파일 스트리밍이므로 파일 크기 임계를 두지 않는다
 *   (Rust/JS가 파일 내용을 메모리에 적재하지 않는다). v1.3.0에서 5MB 임계 제거.
 * - iframe 로드 오류 시 오류 안내를 표시하고 앱을 중단하지 않는다.
 * - sandbox="allow-scripts allow-same-origin": 스크립트 실행 + 동일-폴더 asset 자산
 *   (CSS·이미지) 로드를 허용한다. iframe은 asset:// origin이라 앱 셸과는 cross-origin이므로
 *   앱 본체·권한 접근은 여전히 차단된다 (수동 검증 5-B에서 확정).
 */
function OriginalHtmlView({ htmlPath }: HtmlFileViewerProps): JSX.Element {
  const [loadError, setLoadError] = useState(false);
  const htmlZoom = useUIStore((state) => state.htmlZoom);

  // iframe 로드 오류 안내
  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0l6.354 12.748zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">HTML 로드 오류</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          파일을 불러오는 중 오류가 발생했습니다.
        </p>
      </div>
    );
  }

  // asset:// URL로 변환하여 iframe에 전달.
  const assetUrl = toAssetUrl(htmlPath);

  // @MX:NOTE: [AUTO] 브라우저식 배율 — 감싸개 + 크기 역보정 + transform: scale (SPEC-PREVIEW-018).
  // 배율 z에서 iframe을 (100/z)%로 키운 뒤 z배로 줄여 감싸개를 정확히 채운다. 그러면 iframe 문서의
  // CSS 뷰포트 폭이 감싸개 폭 / z가 되어 줄바꿈·미디어 쿼리가 배율에 반응하고, iframe 자체 스크롤도
  // 그대로 동작한다. iframe 요소의 CSS zoom은 엔진마다 결과가 갈리고, iframe 문서에 CSS를 주입하는
  // 방법은 cross-origin(asset:// vs tauri://)이라 불가능하며 iframe 권한 확대도 금지라 쓰지 않는다.
  // 이 방식은 100% 초과에서 흐리다 — 선명한 확대는 선명 모드(SPEC-PREVIEW-019)가 맡는다.
  // @MX:SPEC: SPEC-PREVIEW-018
  const scale = htmlZoom / 100;
  const zoomStyle =
    htmlZoom === 100
      ? undefined
      : {
          width: `${100 / scale}%`,
          height: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
        };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ overflow: 'hidden' }}
      data-testid="html-preview-zoom-wrapper"
    >
      <iframe
        src={assetUrl}
        title="HTML 파일 미리보기"
        className="w-full h-full border-0"
        style={zoomStyle}
        // sandbox 속성: allow-scripts allow-same-origin
        // allow-same-origin은 iframe을 자기 asset: 자산과만 묶을 뿐 앱 셸과는 cross-origin 유지
        sandbox="allow-scripts allow-same-origin"
        onError={() => setLoadError(true)}
        data-testid="html-preview-iframe"
      />
    </div>
  );
}
