// CodeFileViewer 단위 테스트 — SPEC-PREVIEW-005
// TDD: Shiki 구문 강조 출력·테마 전환·폴백 동작을 검증한다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { EditorState } from '@/store/editorStore';

// ---- Mock: editorStore ----
const mockEditorState: { content: string; currentFilePath: string | null } = {
  content: 'print("hi")',
  currentFilePath: 'notes.py',
};

vi.mock('@/store/editorStore', () => ({
  useEditorStore: vi.fn((selector: (s: EditorState) => unknown) =>
    selector({
      content: mockEditorState.content,
      currentFilePath: mockEditorState.currentFilePath,
      cursorLine: 1,
      cursorCol: 1,
      dirty: false,
      setContent: vi.fn(),
      setCursor: vi.fn(),
      setDirty: vi.fn(),
      setCurrentFilePath: vi.fn(),
      resetEditor: vi.fn(),
    })
  ),
}));

// ---- Mock: uiStore ----
// fontSize를 포함하여 zoom 파생 로직을 테스트할 수 있도록 확장
const mockUIState: { theme: string; fontSize: number } = { theme: 'light', fontSize: 14 };

vi.mock('@/store/uiStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useUIStore: vi.fn((selector: (s: any) => unknown) =>
    selector({ theme: mockUIState.theme, fontSize: mockUIState.fontSize })
  ),
}));

// ---- Mock: extensionLangMap ----
vi.mock('@/lib/preview/extensionLangMap', () => ({
  getLangForExtension: vi.fn((_path: string | null | undefined) => 'python'),
  extensionLangMap: {},
}));

// ---- Mock: codeHighlight ----
// codeToHtml mock — 시나리오별로 beforeEach에서 재설정됨
const mockCodeToHtml = vi.fn((_code: string, _opts: unknown) =>
  '<pre class="shiki"><code><span class="line"><span>print</span></span></code></pre>'
);

const mockHighlighterInstance = {
  codeToHtml: mockCodeToHtml,
};

vi.mock('@/lib/markdown/codeHighlight', () => ({
  getHighlighter: vi.fn(),
}));

// ---- 헬퍼 ----
function setDarkMode(isDark: boolean): void {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * 하이라이터 초기화 + 디바운스를 모두 거친 후의 상태를 얻는 헬퍼.
 *
 * CodeFileViewer 렌더 시퀀스:
 * 1. 마운트 → Effect 1(getHighlighter Promise) + Effect 2(300ms 타이머) 동시 예약
 * 2. 300ms 타이머 발동 → highlighter가 null이므로 return
 * 3. getHighlighter Promise 완료 → setHighlighter → 리렌더
 * 4. 리렌더 → Effect 2 재실행 → 새 300ms 타이머
 * 5. 새 타이머 발동 → codeToHtml 호출
 *
 * 따라서 두 번의 300ms 진행이 필요하다.
 */
async function waitForHighlight(): Promise<void> {
  // 1차 타이머 발동 (highlighter = null → return)
  await act(async () => {
    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();
  });
  // getHighlighter Promise 완료 후 리렌더
  await act(async () => {
    await Promise.resolve();
  });
  // 2차 타이머 발동 (highlighter != null → codeToHtml 호출)
  await act(async () => {
    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();
  });
}

// ---- 테스트 ----

describe('CodeFileViewer', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // getHighlighter mock 복원 — clearAllMocks()가 mockResolvedValue를 지우므로 재설정
    const { getHighlighter } = await import('@/lib/markdown/codeHighlight');
    vi.mocked(getHighlighter).mockResolvedValue(mockHighlighterInstance as never);

    // 기본 상태
    mockEditorState.content = 'print("hi")';
    mockEditorState.currentFilePath = 'notes.py';
    mockUIState.theme = 'light';
    mockUIState.fontSize = 14;
    setDarkMode(false);

    // codeToHtml 기본 반환값 복원
    mockCodeToHtml.mockReturnValue(
      '<pre class="shiki"><code><span class="line"><span>print</span></span></code></pre>'
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove('dark');
  });

  // ---- 시나리오 C: Shiki 구문 강조 출력 렌더 ----

  describe('시나리오 C: Shiki 구문 강조 출력 렌더', () => {
    it('마운트 후 하이라이터 초기화 + 디바운스 경과 시 <pre class="shiki">가 DOM에 표시된다', async () => {
      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');
      render(<CodeFileViewer lang="python" />);

      // 초기 상태: 강조 HTML 없음
      expect(document.querySelector('pre.shiki')).toBeNull();

      await waitForHighlight();

      const pre = document.querySelector('pre.shiki');
      expect(pre).not.toBeNull();
    });

    it('codeToHtml이 content와 lang으로 호출된다', async () => {
      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');
      render(<CodeFileViewer lang="python" />);

      await waitForHighlight();

      expect(mockCodeToHtml).toHaveBeenCalledWith(
        'print("hi")',
        expect.objectContaining({ lang: 'python' })
      );
    });

    it('라이트 테마에서는 github-light 테마로 호출된다', async () => {
      setDarkMode(false);
      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');
      render(<CodeFileViewer lang="python" />);

      await waitForHighlight();

      expect(mockCodeToHtml).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ theme: 'github-light' })
      );
    });

    it('다크 테마에서는 github-dark 테마로 호출된다', async () => {
      setDarkMode(true);
      mockUIState.theme = 'dark';

      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');
      render(<CodeFileViewer lang="python" />);

      await waitForHighlight();

      expect(mockCodeToHtml).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ theme: 'github-dark' })
      );
    });

    it('span 토큰이 포함된 강조 출력이 렌더링된다', async () => {
      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');
      render(<CodeFileViewer lang="python" />);

      await waitForHighlight();

      const spans = document.querySelectorAll('pre.shiki span');
      expect(spans.length).toBeGreaterThan(0);
    });
  });

  // ---- 시나리오 D: 테마 전환 시 재강조 ----

  describe('시나리오 D: 테마 전환 시 재강조', () => {
    it('라이트→다크 전환 시 github-dark 테마로 재강조된다', async () => {
      const { useUIStore } = await import('@/store/uiStore');
      const mockStore = vi.mocked(useUIStore);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockStore.mockImplementation((selector: (s: any) => unknown) =>
        selector({ theme: 'light' })
      );
      setDarkMode(false);

      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');
      const { rerender } = render(<CodeFileViewer lang="python" />);

      await waitForHighlight();

      // 라이트 테마로 첫 번째 호출 확인
      expect(mockCodeToHtml).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ theme: 'github-light' })
      );

      const callCount = mockCodeToHtml.mock.calls.length;

      // 다크 테마로 전환
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockStore.mockImplementation((selector: (s: any) => unknown) =>
        selector({ theme: 'dark' })
      );
      setDarkMode(true);

      rerender(<CodeFileViewer lang="python" />);

      // 테마 변경 후 디바운스 경과
      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // 다크 테마로 추가 호출 확인
      expect(mockCodeToHtml.mock.calls.length).toBeGreaterThan(callCount);
      expect(mockCodeToHtml).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ theme: 'github-dark' })
      );
    });
  });

  // ---- 시나리오 E: 미로드/미지원 언어 안전 폴백 ----

  describe('시나리오 E: 미로드/미지원 언어 안전 폴백', () => {
    it('codeToHtml이 throw하면 앱이 중단되지 않는다', async () => {
      mockCodeToHtml.mockImplementation(() => {
        throw new Error('Language not loaded');
      });

      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');

      expect(() => {
        render(<CodeFileViewer lang="toml" />);
      }).not.toThrow();

      await waitForHighlight();

      // 앱이 크래시하지 않았으므로 이 줄에 도달 가능
      expect(true).toBe(true);
    });

    it('getHighlighter가 reject되면 앱이 중단되지 않는다', async () => {
      const { getHighlighter } = await import('@/lib/markdown/codeHighlight');
      vi.mocked(getHighlighter).mockRejectedValueOnce(new Error('Init failed'));

      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');

      expect(() => {
        render(<CodeFileViewer lang="python" />);
      }).not.toThrow();

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // 앱이 크래시하지 않았으므로 이 줄에 도달 가능
      expect(true).toBe(true);
    });

    it('강조 오류 시 plaintext 폴백이 표시된다 (내용 손실 없음)', async () => {
      mockEditorState.content = 'fallback content';
      mockCodeToHtml.mockImplementation(() => {
        throw new Error('Highlight failed');
      });

      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');
      const { container } = render(<CodeFileViewer lang="python" />);

      await waitForHighlight();

      // 오류 시 plaintext 폴백: <pre><code>이 렌더링되어야 한다
      const pre = container.querySelector('pre');
      expect(pre).not.toBeNull();
      // content가 손실 없이 표시된다
      expect(container.textContent).toContain('fallback content');
    });

    it('빈 content(0바이트 파일)는 오류 없이 처리된다', async () => {
      mockEditorState.content = '';
      mockCodeToHtml.mockReturnValue('<pre class="shiki"><code></code></pre>');

      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');
      render(<CodeFileViewer lang="python" />);

      await waitForHighlight();

      const pre = document.querySelector('pre.shiki');
      expect(pre).not.toBeNull();
    });
  });

  // ---- 추가 엣지 케이스 ----

  describe('엣지 케이스', () => {
    it('300ms 이전에는 codeToHtml이 호출되지 않는다 (디바운스)', async () => {
      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');
      render(<CodeFileViewer lang="python" />);

      // getHighlighter resolve 없이 시간만 진행
      await act(async () => {
        vi.advanceTimersByTime(299);
      });

      // 디바운스 미완료 → codeToHtml 미호출
      expect(mockCodeToHtml).not.toHaveBeenCalled();
    });

    it('fontSize=28이면 내부 콘텐츠 래퍼의 style.zoom이 "2"이다 (비례 스케일)', async () => {
      // mockUIState.fontSize를 28로 설정 → zoom = 28/14 = 2
      mockUIState.fontSize = 28;

      // 시나리오 D가 mockImplementation을 교체했을 수 있으므로 명시적으로 복원
      const { useUIStore } = await import('@/store/uiStore');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(useUIStore).mockImplementation((selector: (s: any) => unknown) =>
        selector({ theme: mockUIState.theme, fontSize: mockUIState.fontSize })
      );

      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');
      const { container } = render(<CodeFileViewer lang="python" />);

      await waitForHighlight();

      // 내부 zoom 래퍼 div를 찾아 style.zoom 확인
      const zoomWrapper = container.querySelector('.code-file-viewer > div') as HTMLElement | null;
      expect(zoomWrapper).not.toBeNull();
      expect(zoomWrapper?.style.zoom).toBe('2');
    });

    it('content가 변경되면 새로운 디바운스 타이머로 재강조된다', async () => {
      const { useEditorStore } = await import('@/store/editorStore');
      const mockStore = vi.mocked(useEditorStore);

      mockStore.mockImplementation((selector: (s: EditorState) => unknown) =>
        selector({
          content: 'initial',
          currentFilePath: 'notes.py',
          cursorLine: 1,
          cursorCol: 1,
          dirty: false,
          setContent: vi.fn(),
          setCursor: vi.fn(),
          setDirty: vi.fn(),
          setCurrentFilePath: vi.fn(),
          resetEditor: vi.fn(),
        })
      );

      const { CodeFileViewer } = await import('@/components/preview/CodeFileViewer');
      const { rerender } = render(<CodeFileViewer lang="python" />);

      // 하이라이터 초기화 완료 대기
      await waitForHighlight();
      const initialCallCount = mockCodeToHtml.mock.calls.length;

      // content 변경
      mockStore.mockImplementation((selector: (s: EditorState) => unknown) =>
        selector({
          content: 'updated',
          currentFilePath: 'notes.py',
          cursorLine: 1,
          cursorCol: 1,
          dirty: false,
          setContent: vi.fn(),
          setCursor: vi.fn(),
          setDirty: vi.fn(),
          setCurrentFilePath: vi.fn(),
          resetEditor: vi.fn(),
        })
      );
      rerender(<CodeFileViewer lang="python" />);

      // 새 디바운스 완료
      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // content 변경 후 추가 호출 확인
      expect(mockCodeToHtml.mock.calls.length).toBeGreaterThan(initialCallCount);
      expect(mockCodeToHtml).toHaveBeenLastCalledWith('updated', expect.anything());
    });
  });
});
