// mediaExtensions 단위 테스트 — SPEC-PREVIEW-008 D1 (확장자 우선 분기 판정 유틸)
import { describe, it, expect } from 'vitest';
import { isRasterImagePath, isSvgPath, RASTER_IMAGE_EXTENSIONS } from '@/lib/preview/mediaExtensions';

describe('isRasterImagePath', () => {
  it.each(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif'])(
    '.%s 확장자는 래스터 이미지로 판정한다',
    (ext) => {
      expect(isRasterImagePath(`/project/logo.${ext}`)).toBe(true);
    },
  );

  it('대소문자를 무관하게 판정한다', () => {
    expect(isRasterImagePath('/project/LOGO.PNG')).toBe(true);
  });

  it('.svg는 래스터 이미지가 아니다', () => {
    expect(isRasterImagePath('/project/icon.svg')).toBe(false);
  });

  it('.md는 래스터 이미지가 아니다', () => {
    expect(isRasterImagePath('/project/README.md')).toBe(false);
  });

  it('null/undefined는 false를 반환한다', () => {
    expect(isRasterImagePath(null)).toBe(false);
    expect(isRasterImagePath(undefined)).toBe(false);
  });

  it('RASTER_IMAGE_EXTENSIONS는 정확히 8개 확장자를 포함한다', () => {
    expect(RASTER_IMAGE_EXTENSIONS.size).toBe(8);
  });
});

describe('isSvgPath', () => {
  it('.svg 확장자는 true를 반환한다', () => {
    expect(isSvgPath('/project/icon.svg')).toBe(true);
  });

  it('대소문자를 무관하게 판정한다', () => {
    expect(isSvgPath('/project/ICON.SVG')).toBe(true);
  });

  it('.png는 false를 반환한다', () => {
    expect(isSvgPath('/project/logo.png')).toBe(false);
  });

  it('null/undefined는 false를 반환한다', () => {
    expect(isSvgPath(null)).toBe(false);
    expect(isSvgPath(undefined)).toBe(false);
  });
});
