// HtmlFileViewer OS별 기본 렌더 모드 단위 테스트 — SPEC-PREVIEW-020 (AC-002 기본값 비저장, AC-005 뷰어)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { detectPlatform } from '@/lib/preview/htmlZoom';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
  invoke: vi.fn(),
}));

vi.mock('@/lib/tauri/ipc', () => ({
  readFile: vi.fn(async () => '<html><head></head><body>hi</body></html>'),
  readFileSize: vi.fn(async () => 1024),
}));

// detectPlatform만 모의한다. 기본 반환은 빈 문자열(미모의 undefined가 우연히 crisp이 되는 것을 막음).
vi.mock('@/lib/preview/htmlZoom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/preview/htmlZoom')>()),
  detectPlatform: vi.fn().mockReturnValue(''),
}));
const mockPlatform = (p: string): void => {
  vi.mocked(detectPlatform).mockReturnValue(p);
};

import { HtmlFileViewer } from '@/components/preview/HtmlFileViewer';

const PATH = '/project/test.html';

async function iframeOf(): Promise<HTMLIFrameElement> {
  return (await screen.findByTestId('html-preview-iframe')) as HTMLIFrameElement;
}

function expectOriginal(iframe: HTMLIFrameElement): void {
  expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
  expect(iframe.hasAttribute('src')).toBe(true);
  expect(iframe.hasAttribute('srcdoc')).toBe(false);
}

function expectCrisp(iframe: HTMLIFrameElement): void {
  expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
  expect(iframe.hasAttribute('srcdoc')).toBe(true);
  expect(iframe.hasAttribute('src')).toBe(false);
}

beforeEach(() => {
  localStorage.removeItem('mdedit-ui-store');
  useUIStore.setState({ htmlRenderMode: null, htmlZoom: 100, fontSize: 14 });
});

describe('HtmlFileViewer 해소된 모드 (SPEC-PREVIEW-020 AC-005)', () => {
  it('Windows + 미선택(null)이면 원본 보기를 렌더한다', async () => {
    mockPlatform('Win32');
    render(<HtmlFileViewer htmlPath={PATH} />);
    expectOriginal(await iframeOf());
  });

  it('macOS + 미선택(null)이면 선명 모드를 렌더한다', async () => {
    mockPlatform('MacIntel');
    render(<HtmlFileViewer htmlPath={PATH} />);
    expectCrisp(await iframeOf());
  });

  it('Windows + 명시적 crisp이면 선명 모드를 렌더한다', async () => {
    mockPlatform('Win32');
    useUIStore.setState({ htmlRenderMode: 'crisp' });
    render(<HtmlFileViewer htmlPath={PATH} />);
    expectCrisp(await iframeOf());
  });

  it('macOS + 명시적 original이면 원본 보기를 렌더한다', async () => {
    mockPlatform('MacIntel');
    useUIStore.setState({ htmlRenderMode: 'original' });
    render(<HtmlFileViewer htmlPath={PATH} />);
    expectOriginal(await iframeOf());
  });

  it('렌더 중에 저장값을 바꾸면 해소된 모드에 맞는 경로로 전환된다', async () => {
    mockPlatform('Win32');
    render(<HtmlFileViewer htmlPath={PATH} />);
    expectOriginal(await iframeOf());
    act(() => useUIStore.getState().setHtmlRenderMode('crisp'));
    expectCrisp(await iframeOf());
  });
});

describe('OS 기본값은 저장하지 않는다 (SPEC-PREVIEW-020 AC-002, REQ-006)', () => {
  it.each(['Win32', 'MacIntel'])('%s: 해소 결과가 저장소에 새지 않는다', async (platform) => {
    mockPlatform(platform);
    render(<HtmlFileViewer htmlPath={PATH} />);
    await iframeOf();
    // 다른 필드를 바꿔 persist가 쓰게 한다.
    act(() => useUIStore.getState().setFontSize(16));
    const raw = JSON.parse(localStorage.getItem('mdedit-ui-store') as string);
    expect(raw.state.fontSize).toBe(16);
    expect(raw.state.htmlRenderMode).toBeNull();
  });
});
