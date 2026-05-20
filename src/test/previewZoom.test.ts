// previewZoom 유틸리티 단위 테스트 — zoom 파생 로직 검증
import { describe, it, expect } from 'vitest';

describe('previewZoom', () => {
  it('getPreviewZoom(14) === 1 (기본 fontSize → zoom 1.0)', async () => {
    const { getPreviewZoom } = await import('@/lib/preview/previewZoom');
    expect(getPreviewZoom(14)).toBe(1);
  });

  it('getPreviewZoom(28) === 2 (fontSize 두 배 → zoom 2.0)', async () => {
    const { getPreviewZoom } = await import('@/lib/preview/previewZoom');
    expect(getPreviewZoom(28)).toBe(2);
  });

  it('getPreviewZoom(7) === 0.5 (fontSize 절반 → zoom 0.5)', async () => {
    const { getPreviewZoom } = await import('@/lib/preview/previewZoom');
    expect(getPreviewZoom(7)).toBe(0.5);
  });

  it('getPreviewZoom(24) ≈ 24/14 (최대 fontSize)', async () => {
    const { getPreviewZoom } = await import('@/lib/preview/previewZoom');
    expect(getPreviewZoom(24)).toBeCloseTo(24 / 14);
  });

  it('PREVIEW_ZOOM_BASE_PX === 14 (uiStore.fontSize 기본값과 일치)', async () => {
    const { PREVIEW_ZOOM_BASE_PX } = await import('@/lib/preview/previewZoom');
    expect(PREVIEW_ZOOM_BASE_PX).toBe(14);
  });
});
