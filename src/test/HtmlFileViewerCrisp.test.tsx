// HtmlFileViewer 선명 모드(srcdoc) 단위 테스트 — SPEC-PREVIEW-019 (AC-002·004·007·008·011)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { HTML_CRISP_MAX_BYTES } from '@/lib/preview/htmlSrcdoc';
import { useUIStore } from '@/store/uiStore';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
  invoke: vi.fn(),
}));

const readFileMock = vi.fn<(path: string) => Promise<string>>();
const readFileSizeMock = vi.fn<(path: string) => Promise<number>>();
vi.mock('@/lib/tauri/ipc', () => ({
  readFile: (p: string) => readFileMock(p),
  readFileSize: (p: string) => readFileSizeMock(p),
}));

// SPEC-PREVIEW-020: 플랫폼을 Windows로 고정한다 — 'crisp' 명시 시드가 OS 기본값('original')을 이긴다는 것도 겸해 확인한다.
vi.mock('@/lib/preview/htmlZoom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/preview/htmlZoom')>()),
  detectPlatform: vi.fn().mockReturnValue('Win32'),
}));

import { HtmlFileViewer } from '@/components/preview/HtmlFileViewer';

const HTML = '<html><head></head><body>hi</body></html>';

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  readFileMock.mockResolvedValue(HTML);
  readFileSizeMock.mockResolvedValue(1024);
  useUIStore.setState({ htmlRenderMode: 'crisp', htmlZoom: 100 });
});

describe('선명 모드 렌더 (AC-002)', () => {
  it('srcdoc iframe을 sandbox="allow-scripts"만으로 렌더하고 src는 없다', async () => {
    render(<HtmlFileViewer htmlPath="/project/test.html" />);
    const iframe = (await screen.findByTestId('html-preview-iframe')) as HTMLIFrameElement;

    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.hasAttribute('src')).toBe(false);
    expect(iframe.getAttribute('srcdoc')).toContain('hi');
    expect(iframe.getAttribute('srcdoc')).toContain('<base href="asset://localhost//project/">');
    expect(readFileMock).toHaveBeenCalledTimes(1);
    expect(readFileMock).toHaveBeenCalledWith('/project/test.html');
  });

  it('018 역보정 transform을 쓰지 않는다 (배율 150에서도)', async () => {
    useUIStore.setState({ htmlZoom: 150 });
    render(<HtmlFileViewer htmlPath="/project/test.html" />);
    const iframe = (await screen.findByTestId('html-preview-iframe')) as HTMLIFrameElement;
    expect(iframe.style.transform).toBe('');
    expect(iframe.style.width).toBe('');
    expect(iframe.getAttribute('srcdoc')).toContain('zoom:1.5');
  });

  it('읽는 동안에는 iframe 없이 로딩 표시가 있다', async () => {
    const d = deferred<string>();
    readFileMock.mockReturnValue(d.promise);
    render(<HtmlFileViewer htmlPath="/project/test.html" />);
    await waitFor(() => expect(screen.getByTestId('html-preview-loading')).toBeDefined());
    expect(screen.queryByTestId('html-preview-iframe')).toBeNull();
    await act(async () => {
      d.resolve(HTML);
    });
    expect(await screen.findByTestId('html-preview-iframe')).toBeDefined();
  });

  it('경로가 a → b로 바뀌면 늦게 끝난 a 결과는 반영되지 않는다', async () => {
    const a = deferred<string>();
    readFileMock.mockImplementation((p: string) =>
      p === '/p/a.html' ? a.promise : Promise.resolve('<p>B-CONTENT</p>'),
    );
    const { rerender } = render(<HtmlFileViewer htmlPath="/p/a.html" />);
    rerender(<HtmlFileViewer htmlPath="/p/b.html" />);
    const iframe = (await screen.findByTestId('html-preview-iframe')) as HTMLIFrameElement;
    expect(iframe.getAttribute('srcdoc')).toContain('B-CONTENT');

    await act(async () => {
      a.resolve('<p>A-CONTENT</p>');
    });
    const after = screen.getByTestId('html-preview-iframe') as HTMLIFrameElement;
    expect(after.getAttribute('srcdoc')).toContain('B-CONTENT');
    expect(after.getAttribute('srcdoc')).not.toContain('A-CONTENT');
  });
});

describe('재렌더 없는 배율 (AC-004)', () => {
  it('배율 변경은 같은 iframe·같은 srcdoc을 유지하고 postMessage만 보낸다', async () => {
    render(<HtmlFileViewer htmlPath="/project/test.html" />);
    const iframe = (await screen.findByTestId('html-preview-iframe')) as HTMLIFrameElement;
    const srcdoc = iframe.getAttribute('srcdoc');
    const spy = vi.spyOn(iframe.contentWindow as Window, 'postMessage');
    const readsBefore = readFileMock.mock.calls.length;

    act(() => useUIStore.getState().setHtmlZoom(150));

    const now = screen.getByTestId('html-preview-iframe') as HTMLIFrameElement;
    expect(now.isSameNode(iframe)).toBe(true);
    expect(now.getAttribute('srcdoc')).toBe(srcdoc);
    expect(spy).toHaveBeenCalledWith({ type: 'mdedit-html-zoom', zoom: 1.5 }, '*');
    expect(readFileMock.mock.calls.length).toBe(readsBefore);
  });

  it('원본 보기로 바꾸면 iframe이 교체되고, 다시 선명으로 바꾸면 파일을 다시 읽는다', async () => {
    render(<HtmlFileViewer htmlPath="/project/test.html" />);
    const crisp1 = (await screen.findByTestId('html-preview-iframe')) as HTMLIFrameElement;
    expect(readFileMock).toHaveBeenCalledTimes(1);

    act(() => useUIStore.getState().setHtmlRenderMode('original'));
    const original = screen.getByTestId('html-preview-iframe') as HTMLIFrameElement;
    expect(original.isSameNode(crisp1)).toBe(false);
    expect(original.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(original.hasAttribute('srcdoc')).toBe(false);

    act(() => useUIStore.getState().setHtmlRenderMode('crisp'));
    const crisp2 = (await screen.findByTestId('html-preview-iframe')) as HTMLIFrameElement;
    expect(crisp2.hasAttribute('srcdoc')).toBe(true);
    expect(readFileMock).toHaveBeenCalledTimes(2);
  });
});

describe('폴백 (AC-007)', () => {
  async function expectOriginalWithNotice(): Promise<{ iframe: HTMLIFrameElement; notice: string }> {
    const status = await screen.findByRole('status');
    const iframe = screen.getByTestId('html-preview-iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(iframe.hasAttribute('src')).toBe(true);
    expect(iframe.hasAttribute('srcdoc')).toBe(false);
    return { iframe, notice: status.textContent ?? '' };
  }

  it('(a) UTF-8이 아니면 원본 방식 + UTF-8 안내', async () => {
    readFileMock.mockRejectedValue('Failed to read file: stream did not contain valid UTF-8');
    render(<HtmlFileViewer htmlPath="/p/a.html" />);
    const { notice } = await expectOriginalWithNotice();
    expect(notice).toContain('UTF-8');
    expect(useUIStore.getState().htmlRenderMode).toBe('crisp');
  });

  it('(b) 읽기 실패면 원본 방식 + 읽기 실패 안내', async () => {
    readFileMock.mockRejectedValue('File not found: /p/a.html');
    render(<HtmlFileViewer htmlPath="/p/a.html" />);
    const { notice } = await expectOriginalWithNotice();
    expect(notice).toContain('읽지 못해');
    expect(useUIStore.getState().htmlRenderMode).toBe('crisp');
  });

  it('(c) 10 MiB 초과면 파일을 읽지 않고 원본 방식 + 크기 안내', async () => {
    readFileSizeMock.mockResolvedValue(HTML_CRISP_MAX_BYTES + 1);
    render(<HtmlFileViewer htmlPath="/p/big.html" />);
    const { notice } = await expectOriginalWithNotice();
    expect(notice).toContain('10MB');
    expect(readFileMock).not.toHaveBeenCalled();
    expect(useUIStore.getState().htmlRenderMode).toBe('crisp');
  });

  it('세 안내 문구는 서로 다르다', async () => {
    const notices: string[] = [];
    for (const setup of [
      () => readFileMock.mockRejectedValue('stream did not contain valid UTF-8'),
      () => readFileMock.mockRejectedValue('File not found'),
      () => readFileSizeMock.mockResolvedValue(HTML_CRISP_MAX_BYTES + 1),
    ]) {
      vi.clearAllMocks();
      readFileMock.mockResolvedValue(HTML);
      readFileSizeMock.mockResolvedValue(1024);
      setup();
      const { unmount } = render(<HtmlFileViewer htmlPath="/p/x.html" />);
      notices.push((await screen.findByRole('status')).textContent ?? '');
      unmount();
    }
    expect(new Set(notices).size).toBe(3);
  });

  it('정확히 10 MiB는 폴백이 아니다', async () => {
    readFileSizeMock.mockResolvedValue(HTML_CRISP_MAX_BYTES);
    render(<HtmlFileViewer htmlPath="/p/edge.html" />);
    const iframe = (await screen.findByTestId('html-preview-iframe')) as HTMLIFrameElement;
    expect(iframe.hasAttribute('srcdoc')).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('크기 조회가 실패해도 읽기를 시도한다 (읽기까지 실패하면 읽기 실패 폴백)', async () => {
    readFileSizeMock.mockRejectedValue('size failed');
    render(<HtmlFileViewer htmlPath="/p/a.html" />);
    const iframe = (await screen.findByTestId('html-preview-iframe')) as HTMLIFrameElement;
    expect(iframe.hasAttribute('srcdoc')).toBe(true);
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });

  it('크기 조회·읽기가 모두 실패하면 읽기 실패 폴백이다', async () => {
    readFileSizeMock.mockRejectedValue('size failed');
    readFileMock.mockRejectedValue('File not found');
    render(<HtmlFileViewer htmlPath="/p/a.html" />);
    const { notice } = await expectOriginalWithNotice();
    expect(notice).toContain('읽지 못해');
  });

  it('폴백 뒤 다른 정상 파일로 바뀌면 다시 srcdoc으로 렌더한다', async () => {
    readFileMock.mockImplementation((p: string) =>
      p === '/p/bad.html' ? Promise.reject('File not found') : Promise.resolve(HTML),
    );
    const { rerender } = render(<HtmlFileViewer htmlPath="/p/bad.html" />);
    await expectOriginalWithNotice();

    rerender(<HtmlFileViewer htmlPath="/p/good.html" />);
    await waitFor(() => {
      const iframe = screen.getByTestId('html-preview-iframe') as HTMLIFrameElement;
      expect(iframe.hasAttribute('srcdoc')).toBe(true);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('폴백 안내 중 헤더에서 모드를 바꾸면 안내가 사라지고 선택한 모드가 적용된다', async () => {
    readFileMock.mockRejectedValue('File not found');
    render(<HtmlFileViewer htmlPath="/p/a.html" />);
    await expectOriginalWithNotice();

    act(() => useUIStore.getState().setHtmlRenderMode('original'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(
      (screen.getByTestId('html-preview-iframe') as HTMLIFrameElement).getAttribute('sandbox'),
    ).toBe('allow-scripts allow-same-origin');
  });
});

describe('원본 보기 회귀 (AC-008)', () => {
  it('원본 모드 배율 125에서 018 결과와 같고 파일을 읽지 않는다', async () => {
    useUIStore.setState({ htmlRenderMode: 'original', htmlZoom: 125 });
    render(<HtmlFileViewer htmlPath="/project/test.html" />);
    const iframe = screen.getByTestId('html-preview-iframe') as HTMLIFrameElement;
    expect(iframe.style.width).toBe('80%');
    expect(iframe.style.height).toBe('80%');
    expect(iframe.style.transform).toBe('scale(1.25)');
    expect(['0 0', '0px 0px']).toContain(iframe.style.transformOrigin);
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(iframe.getAttribute('src')).toBe('asset://localhost//project/test.html');
    expect(screen.getByTestId('html-preview-zoom-wrapper').style.overflow).toBe('hidden');
    expect(readFileMock).not.toHaveBeenCalled();
    expect(readFileSizeMock).not.toHaveBeenCalled();
  });
});

describe('보안 형태 (AC-011)', () => {
  it('선명 모드 sandbox 토큰 집합은 {allow-scripts} 하나다', async () => {
    render(<HtmlFileViewer htmlPath="/project/test.html" />);
    const iframe = (await screen.findByTestId('html-preview-iframe')) as HTMLIFrameElement;
    const tokens = (iframe.getAttribute('sandbox') ?? '').split(/\s+/).filter(Boolean);
    expect(tokens).toEqual(['allow-scripts']);
  });
});
