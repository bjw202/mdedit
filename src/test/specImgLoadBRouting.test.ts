// @MX:SPEC: SPEC-IMG-LOAD-001
// Group B — UT-B1 / UT-B5: getFileViewType 순수 함수 라우팅 단위 테스트.
//
// REQ-IMG-LOAD-B-001: previewStatus === 'too-large' 이고 .md/.markdown 인 경우 → 'unsupported'.
//   - too-large 재배치는 .md/.markdown 에 한정 (D1 fix).
// D1 회귀 가드 (UT-B5): 비-.md 확장자(.png/.svg/.html/.json 등)의 too-large 라우팅은
//   현행(SPEC-PREVIEW-008)을 유지해야 하며 'unsupported' 로 재라우팅되지 않는다.
//
// PreviewContainer.tsx 가 마크다운 렌더 파이프라인(mermaid 등)을 끌어오므로, getFileViewType
// 검증에 불필요한 자식 컴포넌트를 모킹해 모듈 로드를 가볍게 유지한다.

import { describe, it, expect, vi } from 'vitest';

// 순수 함수가 의존하는 매핑 유틸만 실제 구현 사용 — 라우팅 본연의 동작을 검증하기 위함.
// 자식 뷰어 컴포넌트는 모킹(mermaid/markdown-it 로드 회피).
vi.mock('@/components/preview/MarkdownPreview', () => ({
  MarkdownPreview: () => null,
}));
vi.mock('@/components/preview/HtmlFileViewer', () => ({ HtmlFileViewer: () => null }));
vi.mock('@/components/preview/CodeFileViewer', () => ({ CodeFileViewer: () => null }));
vi.mock('@/components/preview/UnsupportedFileViewer', () => ({
  UnsupportedFileViewer: () => null,
}));
vi.mock('@/components/preview/ImageFileViewer', () => ({ ImageFileViewer: () => null }));
vi.mock('@/components/preview/SvgFileViewer', () => ({ SvgFileViewer: () => null }));

import { getFileViewType } from '@/components/preview/PreviewContainer';

describe('SPEC-IMG-LOAD-001 REQ-B-001 (UT-B1): too-large .md/.markdown → unsupported', () => {
  it('too-large + .md → unsupported', () => {
    expect(getFileViewType('doc.md', 'too-large')).toBe('unsupported');
  });

  it('too-large + .markdown → unsupported', () => {
    expect(getFileViewType('notes.markdown', 'too-large')).toBe('unsupported');
  });

  it('too-large + .MD (대문자) → unsupported (대소문자 무관)', () => {
    expect(getFileViewType('README.MD', 'too-large')).toBe('unsupported');
  });

  it('too-large + 경로 포함 .md → unsupported', () => {
    expect(getFileViewType('/project/sub/doc.md', 'too-large')).toBe('unsupported');
  });

  // 회귀 가드: 정상 경로(.md + text/null)는 여전히 markdown 이어야 한다
  it('previewStatus=null + .md → markdown (정상 경로 유지)', () => {
    expect(getFileViewType('doc.md', null)).toBe('markdown');
  });

  it('previewStatus=text + .md → markdown (정상 읽기 경로 유지)', () => {
    expect(getFileViewType('doc.md', 'text')).toBe('markdown');
  });
});

describe('SPEC-IMG-LOAD-001 D1 회귀 가드 (UT-B5): 비-.md too-large 라우팅 무변경', () => {
  // SPEC-PREVIEW-008 래스터/SVG 보호 — too-large 재배치가 .md 에만 적용되는지 검증.
  it.each(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif'])(
    'too-large + .%s → image (SPEC-PREVIEW-008 래스터 보존)',
    (ext) => {
      expect(getFileViewType(`big.${ext}`, 'too-large')).toBe('image');
    },
  );

  it('too-large + .svg → svg (SPEC-PREVIEW-008 SVG 보존)', () => {
    expect(getFileViewType('logo.svg', 'too-large')).toBe('svg');
  });

  it('too-large + .html → html (SPEC-PREVIEW-004 HTML 보존)', () => {
    expect(getFileViewType('page.html', 'too-large')).toBe('html');
  });

  it('too-large + .json → code (확장자 매핑 우선순위 유지)', () => {
    expect(getFileViewType('data.json', 'too-large')).toBe('code');
  });

  it('too-large + .py → code', () => {
    expect(getFileViewType('script.py', 'too-large')).toBe('code');
  });

  it('too-large + 미매핑 확장자(.xyz) → unsupported (기존 6순위 too-large 분기 유지, .md 재배치와 무관)', () => {
    // .xyz: html 아님, md 아님, 래스터 아님, svg 아님, lang 매핑 없음 → 기존 too-large 분기
    expect(getFileViewType('huge.xyz', 'too-large')).toBe('unsupported');
  });
});
