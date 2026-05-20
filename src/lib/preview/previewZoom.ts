// @MX:NOTE: [AUTO] uiStore.fontSize 기본값과 일치하는 줌 기준 px — zoom 파생의 기준점
/** uiStore의 fontSize 기본값(14px)과 동일한 zoom 기준값. zoom = fontSize / PREVIEW_ZOOM_BASE_PX */
export const PREVIEW_ZOOM_BASE_PX = 14;

/**
 * fontSize(px)를 CSS zoom 비율로 변환한다.
 *
 * 기본값(14px) → 1.0, 두 배(28px) → 2.0, 절반(7px) → 0.5.
 * .preview-content 또는 코드 뷰어 래퍼에 style={{ zoom }} 으로 적용하면
 * heading, 코드, 테이블, 이미지 등 모든 요소가 비례 스케일된다.
 */
export function getPreviewZoom(fontSize: number): number {
  return fontSize / PREVIEW_ZOOM_BASE_PX;
}
