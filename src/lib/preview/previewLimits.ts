// @MX:NOTE: [AUTO] SPEC-PREVIEW-007 결정 2 — 대용량 임계값 단일 상수.
// openFile에서 FileNode.size와 비교하여 임계값 초과 파일의 read를 회피한다.
// @MX:SPEC: SPEC-PREVIEW-007 REQ-PREVIEW007-005

/**
 * 대용량 파일 임계값 (바이트).
 * 이 값을 초과하는 파일은 미리보기를 건너뛰고 "too-large" 안내를 표시한다.
 * 5MB = 5 * 1024 * 1024 바이트.
 */
export const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024;
