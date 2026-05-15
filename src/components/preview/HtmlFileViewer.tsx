// @MX:WARN: [AUTO] sandbox 속성 설정 — iframe 보안 격리의 핵심 제어점
// @MX:REASON: sandbox="allow-scripts allow-same-origin" — iframe 콘텐츠는 asset:// origin에서
//   제공되어 앱 셸(tauri://) origin과 분리된다. allow-same-origin은 iframe을 자기 자신의
//   asset: 자산(CSS·이미지)과만 same-origin으로 묶을 뿐 앱 셸과는 여전히 cross-origin이므로
//   __TAURI__·parent 접근은 차단된다(수동 검증 5-B에서 확정). allow-popups·allow-forms·
//   allow-top-navigation 등 추가 권한은 부여 금지. sandbox 권한 변경 시 acceptance
//   시나리오 3(앱 권한 탈취 차단)을 반드시 재검증할 것.
// @MX:SPEC: SPEC-PREVIEW-004 REQ-PREVIEW004-002, REQ-PREVIEW004-005

import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface HtmlFileViewerProps {
  /** 렌더링할 HTML 파일의 절대 경로 */
  htmlPath: string;
}

/**
 * HTML 파일을 샌드박스 iframe 안에서 렌더링하는 뷰어 컴포넌트.
 *
 * - iframe + asset 프로토콜은 OS-level 파일 스트리밍이므로 파일 크기 임계를 두지 않는다
 *   (Rust/JS가 파일 내용을 메모리에 적재하지 않는다). v1.3.0에서 5MB 임계 제거.
 * - iframe 로드 오류 시 오류 안내를 표시하고 앱을 중단하지 않는다.
 * - sandbox="allow-scripts allow-same-origin": 스크립트 실행 + 동일-폴더 asset 자산
 *   (CSS·이미지) 로드를 허용한다. iframe은 asset:// origin이라 앱 셸과는 cross-origin이므로
 *   앱 본체·권한 접근은 여전히 차단된다 (수동 검증 5-B에서 확정).
 */
export function HtmlFileViewer({ htmlPath }: HtmlFileViewerProps): JSX.Element {
  const [loadError, setLoadError] = useState(false);

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
  // convertFileSrc는 전체 경로를 encodeURIComponent로 인코딩(슬래시 → %2F, 백슬래시 → %5C)
  // 하므로 iframe 내부 상대경로 해소가 깨진다. macOS는 %2F만 나오지만 Windows는 %5C도
  // 함께 나오므로 둘 다 슬래시로 정규화하여 계층적 URL을 만든다. asset 핸들러가
  // percent-decode하면 `C:/path/...` 형태가 되어 Windows 파일시스템에서도 정상 해소된다.
  const rawUrl = convertFileSrc(htmlPath);
  const assetUrl = rawUrl.replace(/%2F/gi, '/').replace(/%5C/gi, '/');

  // [DEBUG] Windows WebView2 차단 진단용 — 작동 확인 후 제거 예정.
  // 콘솔에서 htmlPath, convertFileSrc 원본, replace 후 URL을 모두 확인할 수 있다.
  // eslint-disable-next-line no-console
  console.log('[HtmlFileViewer]', { htmlPath, rawUrl, assetUrl });

  return (
    <iframe
      src={assetUrl}
      title="HTML 파일 미리보기"
      className="w-full h-full border-0"
      // sandbox 속성: allow-scripts allow-same-origin
      // allow-same-origin은 iframe을 자기 asset: 자산과만 묶을 뿐 앱 셸과는 cross-origin 유지
      sandbox="allow-scripts allow-same-origin"
      onError={() => setLoadError(true)}
      data-testid="html-preview-iframe"
    />
  );
}
