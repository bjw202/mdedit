// @MX:NOTE: [AUTO] SPEC-PREVIEW-008 D1 — 이미지·SVG 확장자 판정을 단일 진실 공급원으로 통합.
// PreviewContainer(getFileViewType)와 useFileSystem(openFile)이 동일한 판정 로직을 공유해야
// 라우팅(뷰어 선택)과 파일 로드(read_file 회피/시도)가 어긋나지 않는다.
// @MX:SPEC: SPEC-PREVIEW-008 REQ-PREVIEW008-001 REQ-PREVIEW008-004

/** 래스터 이미지로 취급하는 확장자 집합 (소문자, 점 제외). */
export const RASTER_IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'avif',
]);

/**
 * 경로에서 소문자 확장자(점 제외)를 추출한다.
 * 확장자가 없으면 빈 문자열을 반환한다.
 */
function getExtension(path: string): string {
  const lower = path.toLowerCase();
  const dotIndex = lower.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === lower.length - 1) return '';
  return lower.slice(dotIndex + 1);
}

/** 경로가 래스터 이미지 확장자(.png/.jpg/.jpeg/.gif/.webp/.bmp/.ico/.avif)인지 판정한다 (대소문자 무관). */
export function isRasterImagePath(path: string | null | undefined): boolean {
  if (!path) return false;
  return RASTER_IMAGE_EXTENSIONS.has(getExtension(path));
}

/** 경로가 .svg 확장자인지 판정한다 (대소문자 무관). */
export function isSvgPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return getExtension(path) === 'svg';
}
