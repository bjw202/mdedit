// @MX:NOTE: [AUTO] SPEC-PREVIEW-007 REQ-PREVIEW007-004/005 — 미리보기 불가 플레이스홀더.
// 바이너리/읽기 불가(binary) 또는 대용량(too-large) 파일 선택 시 표시되는 보기 전용 컴포넌트.
// 편집기에 내용을 로드하지 않는 파일에 대해 UX 안내를 제공한다.
// AppLayout의 editor-disable 플레이스홀더(SPEC-PREVIEW-004) 시각 패턴을 재사용한다.
// @MX:SPEC: SPEC-PREVIEW-007 REQ-PREVIEW007-004 REQ-PREVIEW007-005

export interface UnsupportedFileViewerProps {
  /** 미리보기 불가 사유: 'binary' = 바이너리/읽기 불가, 'too-large' = 대용량 */
  reason: 'binary' | 'too-large';
  /** 표시할 파일명 */
  filename: string;
}

/**
 * 미리보기가 불가능한 파일(바이너리/대용량)을 선택했을 때 표시하는 보기 전용 플레이스홀더.
 * 사유(binary/too-large)와 파일명을 안내 문구와 함께 표시한다.
 */
export function UnsupportedFileViewer({ reason, filename }: UnsupportedFileViewerProps): JSX.Element {
  // 사유별 안내 문구
  const title = reason === 'binary' ? '미리보기 불가' : '미리보기를 건너뜁니다';
  const description =
    reason === 'binary'
      ? '바이너리 또는 읽기 불가 파일입니다. 이 형식은 미리보기를 지원하지 않습니다.'
      : '파일이 커서 미리보기를 건너뜁니다. 외부 편집기를 사용하세요.';

  return (
    <div
      className="h-full flex flex-col items-center justify-center gap-2 p-4 text-center select-none bg-gray-50 dark:bg-gray-900"
      data-testid="unsupported-file-viewer"
      data-reason={reason}
      data-filename={filename}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-8 h-8 text-gray-300 dark:text-gray-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        {reason === 'binary' ? (
          /* 자물쇠 아이콘 — 바이너리/접근 불가 */
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        ) : (
          /* 파일 건너뜀 아이콘 — 대용량 */
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
          />
        )}
      </svg>
      <p className="text-sm text-gray-400 dark:text-gray-500">{title}</p>
      <p className="text-xs text-gray-300 dark:text-gray-600">{filename}</p>
      <p className="text-xs text-gray-300 dark:text-gray-600">{description}</p>
    </div>
  );
}
