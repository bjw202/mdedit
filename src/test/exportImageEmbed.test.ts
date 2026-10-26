// @MX:SPEC: SPEC-EXPORT-004
// 내보내기(HTML/PDF용 HTML/DOCX) 로컬 이미지 임베드 재현 테스트.
// 실제 renderMarkdown·markdown-it·exportHtml·exportDocx 를 그대로 쓰고 IPC(@/lib/tauri/ipc)만 mock 한다.
// 그래야 markdown-it 의 실제 퍼센트 인코딩·엔티티 이스케이프 결과가 해석기에 들어간다.

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

const ipc = vi.hoisted(() => ({
  readImageAsBase64: vi.fn(),
  readRelativeImageAsBase64: vi.fn(),
  exportSaveDialog: vi.fn(),
  writeFile: vi.fn(),
  writeBinaryFile: vi.fn(),
}));

vi.mock('@/lib/tauri/ipc', () => ipc);

// imageResolver.ts 가 convertFileSrc 를 import 하므로 플랫폼 경계만 대체한다(렌더러는 실제 코드).
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((p: string) => p),
}));

// jsdom 은 data URI 에 대해 Image onload 를 발생시키지 않으므로 exportDocx.test.ts 와 같은 스텁을 쓴다.
vi.stubGlobal(
  'Image',
  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 100;
    naturalHeight = 80;
    private _src = '';
    get src() {
      return this._src;
    }
    set src(value: string) {
      this._src = value;
      Promise.resolve().then(() => {
        if (this.onload) this.onload();
      });
    }
  },
);

vi.mock('docx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('docx')>();
  const ImageRunSpy = vi.fn().mockImplementation((opts: unknown) => {
    return new actual.ImageRun(opts as ConstructorParameters<typeof actual.ImageRun>[0]);
  });
  const TextRunSpy = vi.fn().mockImplementation((opts: unknown) => {
    return new actual.TextRun(opts as ConstructorParameters<typeof actual.TextRun>[0]);
  });
  return { ...actual, ImageRun: ImageRunSpy, TextRun: TextRunSpy };
});

import { ImageRun, TextRun } from 'docx';
import { exportToHtml, generateHtmlContent } from '@/lib/export/exportHtml';
import { exportToDocx } from '@/lib/export/exportDocx';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const DATA = `data:image/png;base64,${TINY_PNG_BASE64}`;
const MD = '/docs/a.md';

/** 지정한 경로만 data URI 로 resolve, 나머지는 reject. */
function readable(...paths: string[]) {
  ipc.readImageAsBase64.mockImplementation((p: string) =>
    paths.includes(p) ? Promise.resolve(DATA) : Promise.reject(new Error(`not found: ${p}`)),
  );
}

/** 전용 명령 래퍼가 지정한 (md, rel) 쌍만 resolve. */
function relReadable(...rels: string[]) {
  ipc.readRelativeImageAsBase64.mockImplementation((_md: string, rel: string) =>
    rels.includes(rel) ? Promise.resolve(DATA) : Promise.reject(new Error(`not found: ${rel}`)),
  );
}

const readCalls = () => ipc.readImageAsBase64.mock.calls.map((c) => c[0]);
const writtenHtml = () => String(ipc.writeFile.mock.calls[0]?.[1] ?? '');
const imageRunCount = () => vi.mocked(ImageRun).mock.calls.length;
// 참고: markdown-it 이미지 토큰의 alt 속성은 빈 문자열이고 대체 텍스트는 children 에 있어,
// 기존 폴백은 실제로 `[]` 를 만든다(이번 SPEC 범위 밖). 따라서 `[...]` 형태의 폴백 개수만 센다.
const altFallbacks = () =>
  vi
    .mocked(TextRun)
    .mock.calls.map((c) => (c[0] as { text?: string }).text)
    .filter((t): t is string => typeof t === 'string' && /^\[.*\]$/.test(t));

function htmlOpts(content: string, mdFilePath: string | null = MD, onUnembeddedImages?: (n: string[]) => void) {
  return { content, filename: 'a.md', theme: 'light' as const, highlighter: null, mdFilePath, onUnembeddedImages };
}

beforeEach(() => {
  vi.clearAllMocks();
  ipc.readImageAsBase64.mockReset();
  ipc.readRelativeImageAsBase64.mockReset();
  ipc.readRelativeImageAsBase64.mockRejectedValue(new Error('no relative read'));
  ipc.exportSaveDialog.mockImplementation((kind: string) => Promise.resolve(`/out/a.${kind}`));
  ipc.writeFile.mockResolvedValue(undefined);
  ipc.writeBinaryFile.mockResolvedValue(undefined);
});

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;

afterEach(() => {
  // DM1 격리: 다이어그램 DOM 과 canvas 스텁이 H·P1 결과에 섞이지 않게 정리한다.
  document.querySelectorAll('.mermaid-container').forEach((el) => el.remove());
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toBlob = originalToBlob;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('SPEC-EXPORT-004 HTML 내보내기 (exportToHtml, 실제 렌더러)', () => {
  it('H1: 한글 파일명은 디코드한 경로로 먼저 읽고 data URI 로 임베드한다', async () => {
    readable('/docs/images/사진.png');
    await exportToHtml(htmlOpts('![](./images/사진.png)'));
    expect(readCalls()[0]).toBe('/docs/images/사진.png');
    expect(writtenHtml()).toContain(`src="${DATA}"`);
  });

  it('H2: 꺾쇠 목적지의 공백 파일명은 %20 을 디코드해 읽는다', async () => {
    readable('/docs/images/my photo.png');
    await exportToHtml(htmlOpts('![](<./images/my photo.png>)'));
    expect(readCalls()[0]).toBe('/docs/images/my photo.png');
    expect(writtenHtml()).toContain(`src="${DATA}"`);
  });

  it('H3: 렌더 HTML 의 &amp; 를 되돌려 읽고, 해당 img src 를 data URI 로 치환한다', async () => {
    readable('/docs/images/a&b.png');
    await exportToHtml(htmlOpts('![](images/a&b.png)'));
    expect(readCalls()[0]).toBe('/docs/images/a&b.png');
    expect(writtenHtml()).toContain(`src="${DATA}"`);
    expect(writtenHtml()).not.toContain('a&amp;b.png');
  });

  it('H4: 상위 폴더 이미지는 전용 명령으로만 읽는다', async () => {
    readable();
    relReadable('../assets/a.png');
    await exportToHtml(htmlOpts('![](../assets/a.png)'));
    expect(ipc.readRelativeImageAsBase64).toHaveBeenCalledTimes(1);
    expect(ipc.readRelativeImageAsBase64).toHaveBeenCalledWith(MD, '../assets/a.png');
    expect(ipc.readImageAsBase64).not.toHaveBeenCalled();
    expect(writtenHtml()).toContain(`src="${DATA}"`);
  });

  it('H5: Windows 마크다운 경로에서는 구분자를 \\ 로 통일한다', async () => {
    readable('C:\\docs\\images\\x.png');
    await exportToHtml(htmlOpts('![](images/x.png)', 'C:\\docs\\a.md'));
    expect(readCalls()[0]).toBe('C:\\docs\\images\\x.png');
    expect(writtenHtml()).toContain(`src="${DATA}"`);
  });
});

describe('SPEC-EXPORT-004 DOCX 내보내기 (exportToDocx, 실제 markdown-it)', () => {
  it('X1: 한글 파일명은 디코드한 경로로 읽고 ImageRun 을 만든다', async () => {
    readable('/docs/images/사진.png');
    await exportToDocx(htmlOpts('![사진](./images/사진.png)'));
    expect(readCalls()[0]).toBe('/docs/images/사진.png');
    expect(imageRunCount()).toBe(1);
    expect(altFallbacks()).toEqual([]);
  });

  it('X2: 공백 파일명은 디코드한 경로로 읽는다', async () => {
    readable('/docs/images/my photo.png');
    await exportToDocx(htmlOpts('![p](<./images/my photo.png>)'));
    expect(readCalls()[0]).toBe('/docs/images/my photo.png');
    expect(imageRunCount()).toBe(1);
  });

  it('X3: 토큰 src 는 & 가 이스케이프되지 않으므로 그대로 읽는다', async () => {
    readable('/docs/images/a&b.png');
    await exportToDocx(htmlOpts('![p](images/a&b.png)'));
    expect(readCalls()[0]).toBe('/docs/images/a&b.png');
    expect(imageRunCount()).toBe(1);
  });

  it('X4: 상위 폴더 이미지는 전용 명령으로만 읽는다', async () => {
    readable();
    relReadable('../assets/a.png');
    await exportToDocx(htmlOpts('![p](../assets/a.png)'));
    expect(ipc.readRelativeImageAsBase64).toHaveBeenCalledWith(MD, '../assets/a.png');
    expect(ipc.readImageAsBase64).not.toHaveBeenCalled();
    expect(imageRunCount()).toBe(1);
  });

  it('X5: Windows 마크다운 경로에서는 구분자를 \\ 로 통일한다', async () => {
    readable('C:\\docs\\images\\x.png');
    await exportToDocx(htmlOpts('![p](images/x.png)', 'C:\\docs\\a.md'));
    expect(readCalls()[0]).toBe('C:\\docs\\images\\x.png');
    expect(imageRunCount()).toBe(1);
  });
});

describe('SPEC-EXPORT-004 엔티티 출처 구분 (E1)', () => {
  it('E1(HTML): 렌더 HTML 의 엔티티는 정확히 한 번만 되돌린다', async () => {
    readable('/docs/a&amp;b.png');
    await exportToHtml(htmlOpts('![](a\\&amp;b.png)'));
    expect(readCalls()[0]).toBe('/docs/a&amp;b.png');
    expect(writtenHtml()).toContain(`src="${DATA}"`);
  });

  it('E1(DOCX): 토큰 src 에는 엔티티 디코드를 걸지 않는다', async () => {
    readable('/docs/a&amp;b.png');
    await exportToDocx(htmlOpts('![p](a\\&amp;b.png)'));
    expect(readCalls()[0]).toBe('/docs/a&amp;b.png');
    expect(imageRunCount()).toBe(1);
  });
});

describe('SPEC-EXPORT-004 PDF 용 HTML (generateHtmlContent, mock 없음)', () => {
  it('P1: 한글 파일명을 디코드해 읽고 반환 HTML 에 data URI 를 넣는다', async () => {
    readable('/docs/images/사진.png');
    const html = await generateHtmlContent(htmlOpts('![](./images/사진.png)'));
    expect(readCalls()[0]).toBe('/docs/images/사진.png');
    expect(html).toContain(`src="${DATA}"`);
  });
});

describe('SPEC-EXPORT-004 누락 보고', () => {
  const unsavedDoc = '![](./img/a.png)\n\n![](img/b.png)\n\n![](/abs/x.png)';

  it('F3(HTML): 미저장 문서는 어떤 로컬 이미지도 읽지 않고 셋 모두 누락으로 보고한다', async () => {
    readable('/abs/x.png');
    const onUnembedded = vi.fn();
    const result = await exportToHtml(htmlOpts(unsavedDoc, null, onUnembedded));
    expect(result).toBe('/out/a.html');
    expect(ipc.readImageAsBase64).not.toHaveBeenCalled();
    expect(ipc.readRelativeImageAsBase64).not.toHaveBeenCalled();
    expect(writtenHtml()).toContain('src="./img/a.png"');
    expect(writtenHtml()).toContain('src="img/b.png"');
    expect(writtenHtml()).toContain('src="/abs/x.png"');
    expect(onUnembedded).toHaveBeenCalledTimes(1);
    expect(onUnembedded.mock.calls[0][0]).toEqual(['./img/a.png', 'img/b.png', '/abs/x.png']);
  });

  it('F3(DOCX): 미저장 문서는 어떤 로컬 이미지도 읽지 않고 셋 모두 [alt] 폴백 + 누락 보고', async () => {
    readable('/abs/x.png');
    const onUnembedded = vi.fn();
    const result = await exportToDocx(htmlOpts('![a](./img/a.png)\n\n![b](img/b.png)\n\n![x](/abs/x.png)', null, onUnembedded));
    expect(result).toBe('/out/a.docx');
    expect(ipc.readImageAsBase64).not.toHaveBeenCalled();
    expect(ipc.readRelativeImageAsBase64).not.toHaveBeenCalled();
    expect(altFallbacks()).toHaveLength(3);
    expect(onUnembedded).toHaveBeenCalledTimes(1);
    expect(onUnembedded.mock.calls[0][0]).toEqual(['./img/a.png', 'img/b.png', '/abs/x.png']);
  });

  it('F6: http·data 이미지만 있으면 읽지 않고 누락 보고도 하지 않는다', async () => {
    readable();
    const onUnembedded = vi.fn();
    await exportToHtml(htmlOpts('![](http://e.com/a.png)\n\n![](data:image/png;base64,AA)', MD, onUnembedded));
    expect(ipc.readImageAsBase64).not.toHaveBeenCalled();
    expect(ipc.readRelativeImageAsBase64).not.toHaveBeenCalled();
    expect(onUnembedded).not.toHaveBeenCalled();
    expect(writtenHtml()).toContain('src="http://e.com/a.png"');
    expect(writtenHtml()).toContain('src="data:image/png;base64,AA"');
  });

  it('F7(HTML): 같은 실패 src 가 두 번 나와도 누락 이름은 한 번, 두 img 모두 원래 src 유지', async () => {
    readable();
    const onUnembedded = vi.fn();
    await exportToHtml(htmlOpts('![](img/none.png)\n\n![](img/none.png)', MD, onUnembedded));
    expect(onUnembedded).toHaveBeenCalledTimes(1);
    expect(onUnembedded.mock.calls[0][0]).toEqual(['img/none.png']);
    expect(writtenHtml().match(/src="img\/none\.png"/g)).toHaveLength(2);
  });

  it('F7(DOCX): 같은 실패 src 가 두 번 나와도 누락 이름은 한 번, 두 위치 모두 [alt] 폴백', async () => {
    readable();
    const onUnembedded = vi.fn();
    await exportToDocx(htmlOpts('![n](img/none.png)\n\n![n](img/none.png)', MD, onUnembedded));
    expect(onUnembedded).toHaveBeenCalledTimes(1);
    expect(onUnembedded.mock.calls[0][0]).toEqual(['img/none.png']);
    expect(altFallbacks()).toHaveLength(2);
  });

  it('F10: DOCX 에서 읽기는 성공했지만 base64 변환이 실패하면 [alt] 폴백 + 누락 보고', async () => {
    ipc.readImageAsBase64.mockResolvedValue('data:image/png;base64,@@@');
    const onUnembedded = vi.fn();
    await exportToDocx(htmlOpts('![bad](img/bad.png)', MD, onUnembedded));
    expect(altFallbacks()).toHaveLength(1);
    expect(imageRunCount()).toBe(0);
    expect(onUnembedded).toHaveBeenCalledTimes(1);
    expect(onUnembedded.mock.calls[0][0]).toEqual(['img/bad.png']);
  });

  it('R5: 저장된 문서의 / 절대경로는 디코드 없이 일반 IPC 로 1회 읽는다 (HTML·DOCX)', async () => {
    readable('/abs/x.png');
    await exportToHtml(htmlOpts('![](/abs/x.png)'));
    expect(readCalls()).toEqual(['/abs/x.png']);
    expect(writtenHtml()).toContain(`src="${DATA}"`);

    ipc.readImageAsBase64.mockClear();
    await exportToDocx(htmlOpts('![x](/abs/x.png)'));
    expect(readCalls()).toEqual(['/abs/x.png']);
    expect(ipc.readRelativeImageAsBase64).not.toHaveBeenCalled();
    expect(imageRunCount()).toBe(1);
  });
});

describe('SPEC-EXPORT-004 DOCX Mermaid 회귀 (DM1)', () => {
  it('DM1: 문서 DOM 의 Mermaid SVG 를 PNG ImageRun 으로 넣고, 펜스 코드는 텍스트로 넣지 않는다', async () => {
    const container = document.createElement('div');
    container.className = 'mermaid-container';
    container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
    document.body.appendChild(container);

    const bytes = new Uint8Array([1, 2, 3, 4]);
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      scale: vi.fn(),
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb({ arrayBuffer: () => Promise.resolve(bytes.buffer) } as unknown as Blob);
    };

    await exportToDocx(htmlOpts('```mermaid\ngraph TD; DIAGRAM_SRC-->B\n```'));

    expect(vi.mocked(ImageRun)).toHaveBeenCalledTimes(1);
    const opts = vi.mocked(ImageRun).mock.calls[0][0] as { type: string; data: Uint8Array };
    expect(opts.type).toBe('png');
    expect(Array.from(opts.data)).toEqual([1, 2, 3, 4]);
    const texts = vi.mocked(TextRun).mock.calls.map((c) => JSON.stringify(c[0]));
    expect(texts.some((t) => t.includes('DIAGRAM_SRC'))).toBe(false);
  });
});

// SPEC-EXPORT-004 sync-audit F1: img 태그 치환 문자열 안의 `$'`·`$&` 등이 String.replace 의
// 특수 치환 패턴으로 해석되면 alt 와 그 뒤 문서 내용이 깨진다.
describe('SPEC-EXPORT-004 치환 패턴 회귀 (sync-audit F1)', () => {
  for (const pattern of ["$'", '$&', '$`', '$$', '$1']) {
    it(`F1-${pattern}: alt 에 ${pattern} 가 있어도 alt 와 뒤 문서 텍스트가 그대로다`, async () => {
      readable('/docs/a.png');
      await exportToHtml(htmlOpts(`![cost ${pattern} tail](a.png) END`));
      const html = writtenHtml();
      expect(html).toContain(`src="${DATA}"`);
      // markdown-it 은 alt 의 & 를 &amp; 로 이스케이프한다
      expect(html).toContain(`alt="cost ${pattern.replace(/&/g, '&amp;')} tail"`);
      expect(html.match(/ END/g)).toHaveLength(1);
      expect(html).toMatch(/alt="cost [^"]* tail"[^>]*> END<\/p>/);
    });
  }
});
