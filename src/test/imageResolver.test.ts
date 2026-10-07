// @MX:SPEC: SPEC-PREVIEW-014
// embedPreviewImages 단위 테스트 — 퍼센트 인코딩된(한글 등) 상대경로 이미지 디코드 + 원문 경로 대체

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockReadImageAsBase64 } = vi.hoisted(() => {
  return {
    mockReadImageAsBase64: vi.fn(),
  };
});

// imageResolver.ts 가 convertFileSrc 를 import 하므로 invoke 와 함께 내보낸다.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn(),
}));

vi.mock('@/lib/tauri/ipc', () => ({
  readImageAsBase64: mockReadImageAsBase64,
}));

import { embedPreviewImages } from '@/lib/image/imageResolver';

const MD = '/docs/a.md';
const DATA = 'data:image/png;base64,OK';

/** 지정한 경로만 data URI 로 resolve, 나머지는 reject 하도록 mock 을 구성한다. */
function readable(...paths: string[]) {
  mockReadImageAsBase64.mockImplementation((p: string) =>
    paths.includes(p) ? Promise.resolve(DATA) : Promise.reject(new Error(`not found: ${p}`)),
  );
}

const img = (src: string) => `<img src="${src}" alt="x">`;
const calls = () => mockReadImageAsBase64.mock.calls.map((c) => c[0]);

beforeEach(() => {
  mockReadImageAsBase64.mockReset();
});

describe('embedPreviewImages — SPEC-PREVIEW-014', () => {
  it('T1: 퍼센트 인코딩된 한글 상대경로를 디코드한 경로로 먼저 읽는다', async () => {
    readable('/docs/figures_svg/도01_frame.png');
    const out = await embedPreviewImages(img('figures_svg/%EB%8F%8401_frame.png'), MD);
    expect(calls()[0]).toBe('/docs/figures_svg/도01_frame.png');
    expect(out).toContain(`src="${DATA}"`);
  });

  it('T2: Windows 경로에서도 디코드 후 구분자를 치환한다', async () => {
    readable('C:\\docs\\figures_svg\\도01_frame.png');
    const out = await embedPreviewImages(img('figures_svg/%EB%8F%8401_frame.png'), 'C:\\docs\\a.md');
    expect(calls()[0]).toBe('C:\\docs\\figures_svg\\도01_frame.png');
    expect(out).toContain(`src="${DATA}"`);
  });

  it('T3: 잘못된 퍼센트 시퀀스는 예외 없이 원문 경로로 1회 읽고, 다른 이미지는 계속 처리한다', async () => {
    readable('/docs/ok.png');
    const html = img('%E0%A4.png') + img('ok.png');
    const out = await embedPreviewImages(html, MD);
    expect(calls().filter((p) => p === '/docs/%E0%A4.png')).toHaveLength(1);
    expect(calls()).toEqual(['/docs/%E0%A4.png', '/docs/ok.png']);
    expect(out).toContain('src="%E0%A4.png"');
    expect(out).toContain(`src="${DATA}"`);
  });

  it('T4: 100%25.png 는 디코드 경로 100%.png 에서 1회로 성공한다', async () => {
    readable('/docs/100%.png');
    const out = await embedPreviewImages(img('100%25.png'), MD);
    expect(calls()).toEqual(['/docs/100%.png']);
    expect(out).toContain(`src="${DATA}"`);
  });

  it('T5: 디코드 경로 실패 시 원문 경로로 한 번 더 읽는다', async () => {
    readable('/docs/a%20b.png');
    const out = await embedPreviewImages(img('a%20b.png'), MD);
    expect(calls()).toEqual(['/docs/a b.png', '/docs/a%20b.png']);
    expect(out).toContain(`src="${DATA}"`);
  });

  it('T6: 두 경로 모두 실패하면 예외 없이 원래 src 를 유지한다', async () => {
    readable();
    const html = img('%EB%8F%84.png');
    const out = await embedPreviewImages(html, MD);
    expect(calls()).toEqual(['/docs/도.png', '/docs/%EB%8F%84.png']);
    expect(out).toBe(html);
  });

  it('T7: ASCII 상대경로와 ./ 접두 경로는 기존 경로로 1회씩만 읽는다', async () => {
    readable('/docs/figures_svg/fig01_frame.png', '/docs/img/x.png');
    const out = await embedPreviewImages(img('figures_svg/fig01_frame.png') + img('./img/x.png'), MD);
    expect(calls()).toEqual(['/docs/figures_svg/fig01_frame.png', '/docs/img/x.png']);
    expect(out).not.toContain('figures_svg');
    expect(out).not.toContain('./img/x.png');
  });

  it('T8: http(s)·data src 는 읽지 않고 HTML 을 그대로 둔다', async () => {
    readable();
    const html = img('http://e.com/a.png') + img('https://e.com/a.png') + img('data:image/png;base64,AA');
    const out = await embedPreviewImages(html, MD);
    expect(mockReadImageAsBase64).not.toHaveBeenCalled();
    expect(out).toBe(html);
  });

  it('T9: 절대경로는 디코드 없이 그대로 1회 읽는다', async () => {
    readable('/abs/x.png');
    const out = await embedPreviewImages(img('/abs/x.png'), MD);
    expect(calls()).toEqual(['/abs/x.png']);
    expect(out).toContain(`src="${DATA}"`);
  });

  it('T10: 같은 한글 src 가 두 번 나와도 한 번만 읽고 둘 다 치환한다', async () => {
    readable('/docs/도.png');
    const html = img('%EB%8F%84.png') + img('%EB%8F%84.png');
    const out = await embedPreviewImages(html, MD);
    expect(calls()).toEqual(['/docs/도.png']);
    expect(out).toBe(img(DATA) + img(DATA));
  });

  it('T11: 디코드 결과의 .. 는 정리하지 않고 그대로 전달하며, 실패 시 원래 src 를 유지한다', async () => {
    readable();
    const html = img('%2E%2E/secret.png');
    const out = await embedPreviewImages(html, MD);
    expect(calls()).toEqual(['/docs/../secret.png', '/docs/%2E%2E/secret.png']);
    expect(out).toBe(html);
  });
});
