/**
 * SPEC-EXPORT-002: 내보내기 완료 모달 통합 테스트 (AC-001 ~ AC-012).
 *
 * AppLayout 에서 ConfirmDialog(SPEC-FS-003 소유)를 소비하여 완료 모달을 렌더하고,
 * 액션 라우팅(open/reveal/cancel)·표시 조건·실패 처리·단일 슬롯 덮어쓰기를 검증한다.
 *
 * 검증 불가 경계(acceptance.md): open/reveal 의 실제 OS 앱 실행은 Playwright 관측 밖이므로
 * "래퍼가 올바른 경로로 정확히 1회 호출됐다"까지만 단언한다(모킹된 plugin payload).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from '../App';
import { useEditorStore } from '@/store/editorStore';

// --- 모킹 ---
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
  emit: vi.fn().mockResolvedValue(undefined),
}));

// opener 플러그인 — 래퍼(openExportedFile/revealExportedFile)이 이들을 경유하는지 검증.
vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn().mockResolvedValue(undefined),
  revealItemInDir: vi.fn().mockResolvedValue(undefined),
}));

// 내보내기 함수 — 반환값(저장 경로)을 제어해 모달 표시 조건을 만든다 (SPEC-EXPORT-002 REQ-007).
const mockExportToHtml = vi.fn();
const mockExportToDocx = vi.fn();
const mockExportToPdf = vi.fn();
vi.mock('@/lib/export/exportHtml', () => ({
  exportToHtml: (...args: unknown[]) => mockExportToHtml(...args),
  generateHtmlContent: vi.fn().mockResolvedValue('<html></html>'),
}));
vi.mock('@/lib/export/exportDocx', () => ({
  exportToDocx: (...args: unknown[]) => mockExportToDocx(...args),
}));
vi.mock('@/lib/export/exportPdf', () => ({
  exportToPdf: (...args: unknown[]) => mockExportToPdf(...args),
}));

// Shiki 하이라이터 로딩 회피.
vi.mock('@/lib/markdown/codeHighlight', () => ({
  getHighlighter: vi.fn().mockResolvedValue(null),
}));

async function openExportMenu(): Promise<void> {
  const exportBtn = await screen.findByRole('button', { name: 'Export' });
  await act(async () => {
    fireEvent.click(exportBtn);
  });
}

async function clickExportItem(label: string): Promise<void> {
  const item = await screen.findByRole('menuitem', { name: label });
  await act(async () => {
    fireEvent.click(item);
  });
}

describe('SPEC-EXPORT-002: 내보내기 완료 모달', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      content: '# 테스트 문서',
      dirty: false,
      currentFilePath: '/tmp/test.md',
      cursorLine: 1,
      cursorCol: 1,
    });
    window.alert = vi.fn();
  });

  it('AC-001: HTML 내보내기 성공 시 완료 모달이 표시되고 경로가 본문에 포함된다', async () => {
    mockExportToHtml.mockResolvedValueOnce('/tmp/out/test.html');
    render(<App />);

    await openExportMenu();
    await clickExportItem('Export as HTML');

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('내보내기 완료')).toBeInTheDocument();
    expect(screen.getByText('/tmp/out/test.html')).toBeInTheDocument();
  });

  it('AC-002: DOCX 내보내기 성공 시 완료 모달이 표시된다', async () => {
    mockExportToDocx.mockResolvedValueOnce('/tmp/out/test.docx');
    render(<App />);

    await openExportMenu();
    await clickExportItem('Export as DOCX');

    expect(await screen.findByText('내보내기 완료')).toBeInTheDocument();
    expect(screen.getByText('/tmp/out/test.docx')).toBeInTheDocument();
  });

  it('AC-003: actions 가 cancel→reveal→open 순서, open 만 primary, title === "내보내기 완료"', async () => {
    mockExportToHtml.mockResolvedValueOnce('/tmp/x.html');
    render(<App />);

    await openExportMenu();
    await clickExportItem('Export as HTML');
    await screen.findByRole('dialog');

    // 좌→우 순서의 버튼들(data-testid `dialog-action-<id>`).
    const cancelBtn = screen.getByTestId('dialog-action-cancel');
    const revealBtn = screen.getByTestId('dialog-action-reveal');
    const openBtn = screen.getByTestId('dialog-action-open');
    expect(cancelBtn).toHaveTextContent('닫기');
    expect(revealBtn).toHaveTextContent('폴더에서 보기');
    expect(openBtn).toHaveTextContent('열기');
    // open 만 primary 스타일 클래스.
    expect(openBtn.className).toContain('md-dialog-action-primary');
    expect(revealBtn.className).not.toContain('md-dialog-action-primary');
    expect(cancelBtn.className).not.toContain('md-dialog-action-primary');
  });

  it('AC-005: 열기 액션 → openPath 를 경로로 정확히 1회 호출하고 모달이 닫힌다 (reveal 0회)', async () => {
    const { openPath, revealItemInDir } = await import('@tauri-apps/plugin-opener');
    mockExportToHtml.mockResolvedValueOnce('/tmp/open-me.html');
    render(<App />);

    await openExportMenu();
    await clickExportItem('Export as HTML');
    await screen.findByRole('dialog');

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action-open'));
    });

    await waitFor(() => {
      expect(openPath).toHaveBeenCalledTimes(1);
    });
    expect(openPath).toHaveBeenCalledWith('/tmp/open-me.html');
    expect(revealItemInDir).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC-006: 폴더에서 보기 액션 → revealItemInDir 을 경로로 1회 호출하고 모달이 닫힌다 (open 0회)', async () => {
    const { openPath, revealItemInDir } = await import('@tauri-apps/plugin-opener');
    mockExportToHtml.mockResolvedValueOnce('/tmp/reveal-me.html');
    render(<App />);

    await openExportMenu();
    await clickExportItem('Export as HTML');
    await screen.findByRole('dialog');

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action-reveal'));
    });

    await waitFor(() => {
      expect(revealItemInDir).toHaveBeenCalledTimes(1);
    });
    expect(revealItemInDir).toHaveBeenCalledWith('/tmp/reveal-me.html');
    expect(openPath).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC-007: 닫기 액션 → open/reveal 모두 0회, 모달 닫힘', async () => {
    const { openPath, revealItemInDir } = await import('@tauri-apps/plugin-opener');
    mockExportToHtml.mockResolvedValueOnce('/tmp/cancel-me.html');
    render(<App />);

    await openExportMenu();
    await clickExportItem('Export as HTML');
    await screen.findByRole('dialog');

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action-cancel'));
    });

    expect(openPath).not.toHaveBeenCalled();
    expect(revealItemInDir).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC-008: open/reveal reject 시 window.alert 호출 + 모달 닫힘 + unhandled rejection 없음', async () => {
    const { openPath } = await import('@tauri-apps/plugin-opener');
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    // 프로미스 거부 — 컴포넌트가 잡지 않으면 unhandled rejection 발생.
    vi.mocked(openPath).mockRejectedValueOnce(new Error('no default app'));
    mockExportToHtml.mockResolvedValueOnce('/tmp/fail.html');
    render(<App />);

    await openExportMenu();
    await clickExportItem('Export as HTML');
    await screen.findByRole('dialog');

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action-open'));
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    alertSpy.mockRestore();
  });

  it('AC-009: 저장 다이얼로그 취소(반환 null) 시 완료 모달 미표시', async () => {
    mockExportToHtml.mockResolvedValueOnce(null);
    render(<App />);

    await openExportMenu();
    await clickExportItem('Export as HTML');

    // 모달이 나타나지 않음을 확인 — 잠시 대기 후에도 없어야 한다.
    await waitFor(() => {
      expect(screen.queryByText('내보내기 완료')).not.toBeInTheDocument();
    });
  });

  it('AC-010: 내보내기 예외 시 완료 모달 미표시 + 기존 alert 유지', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockExportToHtml.mockRejectedValueOnce(new Error('render failed'));
    render(<App />);

    await openExportMenu();
    await clickExportItem('Export as HTML');

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
    expect(screen.queryByText('내보내기 완료')).not.toBeInTheDocument();
    alertSpy.mockRestore();
  });

  it('AC-011: PDF 내보내기 시 완료 모달 미표시 (REQ-019)', async () => {
    mockExportToPdf.mockResolvedValueOnce(undefined);
    render(<App />);

    await openExportMenu();
    await clickExportItem('Export as PDF');

    await waitFor(() => {
      expect(mockExportToPdf).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('내보내기 완료')).not.toBeInTheDocument();
  });

  it('AC-012: 모달 열린 상태에서 두 번째 성공 도달 시 경로가 최신으로 교체된다 (단일 슬롯, REQ-016)', async () => {
    mockExportToHtml
      .mockResolvedValueOnce('/tmp/first.html')
      .mockResolvedValueOnce('/tmp/second.html');
    render(<App />);

    // 첫 내보내기.
    await openExportMenu();
    await clickExportItem('Export as HTML');
    await screen.findByText('/tmp/first.html');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    // 모달이 열린 상태에서 두 번째 내보내기 트리거.
    // (배경 입력이 차단되더라도 핸들러를 직접 호출하는 상황을 시뮬레이션하기 위해
    //  메뉴를 다시 연다 — ConfirmDialog 의 백드롭이 배경 클릭을 가로채므로, 먼저 닫기 없이
    //  연속 성공 슬롯 덮어쓰기를 검증하려면 핸들러 자체가 덮어쓰는지를 확인한다.)
    // 현실적인 경로: 첫 모달을 닫지 않은 채 두 번째 export 가 완료되면 경로가 교체된다.
    await openExportMenu();
    await clickExportItem('Export as HTML');

    // 두 번째 경로로 교체되고 모달은 여전히 1개.
    await waitFor(() => {
      expect(screen.getByText('/tmp/second.html')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByText('/tmp/first.html')).not.toBeInTheDocument();
  });
});

// SPEC-EXPORT-004: 임베드하지 못한 이미지 보고 (REQ-009·010).
//   내보내기 함수는 mock 이며, mock 구현이 options.onUnembeddedImages / confirmUnembeddedImages 를 호출해
//   다이얼로그 렌더와 "다이얼로그 액션 → Promise 값" 배선만 검증한다. 실제 인쇄 흐름은 exportPdf.test.ts(PF).
type ExportOpts = {
  onUnembeddedImages?: (names: string[]) => void;
  confirmUnembeddedImages?: (names: string[]) => Promise<boolean>;
};

describe('SPEC-EXPORT-004: 누락 이미지 보고', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      content: '# 테스트 문서',
      dirty: false,
      currentFilePath: '/tmp/test.md',
      cursorLine: 1,
      cursorCol: 1,
    });
    window.alert = vi.fn();
  });

  it('F1: HTML 완료 모달에 누락 개수 문구와 이름이 표시되고 제목·경로·액션은 그대로다', async () => {
    mockExportToHtml.mockImplementationOnce(async (opts: ExportOpts) => {
      opts.onUnembeddedImages?.(['./img/없음.png']);
      return '/tmp/out/test.html';
    });
    render(<App />);
    await openExportMenu();
    await clickExportItem('Export as HTML');

    await screen.findByRole('dialog');
    expect(screen.getByText('내보내기 완료')).toBeInTheDocument();
    expect(screen.getByText('/tmp/out/test.html')).toBeInTheDocument();
    const block = screen.getByTestId('unembedded-images');
    expect(block).toHaveTextContent('이미지 1개를 포함하지 못했습니다.');
    expect(block).toHaveTextContent('./img/없음.png');
    expect(screen.getByTestId('dialog-action-cancel')).toHaveTextContent('닫기');
    expect(screen.getByTestId('dialog-action-reveal')).toHaveTextContent('폴더에서 보기');
    expect(screen.getByTestId('dialog-action-open')).toHaveTextContent('열기');
  });

  it('F1(DOCX): DOCX 완료 모달에도 누락이 표시된다', async () => {
    mockExportToDocx.mockImplementationOnce(async (opts: ExportOpts) => {
      opts.onUnembeddedImages?.(['a.png', 'b.png']);
      return '/tmp/out/test.docx';
    });
    render(<App />);
    await openExportMenu();
    await clickExportItem('Export as DOCX');

    const block = await screen.findByTestId('unembedded-images');
    expect(block).toHaveTextContent('이미지 2개를 포함하지 못했습니다.');
  });

  it('F2: 누락 0개면 경고 블록이 없다', async () => {
    mockExportToHtml.mockResolvedValueOnce('/tmp/out/test.html');
    render(<App />);
    await openExportMenu();
    await clickExportItem('Export as HTML');

    await screen.findByRole('dialog');
    expect(screen.queryByTestId('unembedded-images')).not.toBeInTheDocument();
  });

  it('F2(연속): 이전 내보내기의 누락 목록은 다음 내보내기에 남지 않는다', async () => {
    mockExportToHtml
      .mockImplementationOnce(async (opts: ExportOpts) => {
        opts.onUnembeddedImages?.(['old.png']);
        return '/tmp/first.html';
      })
      .mockResolvedValueOnce('/tmp/second.html');
    render(<App />);
    await openExportMenu();
    await clickExportItem('Export as HTML');
    await screen.findByTestId('unembedded-images');
    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action-cancel'));
    });

    await openExportMenu();
    await clickExportItem('Export as HTML');
    await screen.findByText('/tmp/second.html');
    expect(screen.queryByTestId('unembedded-images')).not.toBeInTheDocument();
  });

  it('F4: 누락 12개면 이름 10개와 "외 2개"를 표시한다', async () => {
    const names = Array.from({ length: 12 }, (_, i) => `img${i + 1}.png`);
    mockExportToHtml.mockImplementationOnce(async (opts: ExportOpts) => {
      opts.onUnembeddedImages?.(names);
      return '/tmp/out/test.html';
    });
    render(<App />);
    await openExportMenu();
    await clickExportItem('Export as HTML');

    const block = await screen.findByTestId('unembedded-images');
    expect(block).toHaveTextContent('이미지 12개를 포함하지 못했습니다.');
    for (const n of names.slice(0, 10)) expect(block).toHaveTextContent(n);
    expect(block).not.toHaveTextContent('img11.png');
    expect(block).not.toHaveTextContent('img12.png');
    expect(block).toHaveTextContent('외 2개');
  });

  async function startPdfWithMissing(): Promise<{ result: () => boolean | undefined }> {
    let recorded: boolean | undefined;
    mockExportToPdf.mockImplementationOnce(async (opts: ExportOpts) => {
      recorded = await opts.confirmUnembeddedImages?.(['a.png']);
    });
    render(<App />);
    await openExportMenu();
    await clickExportItem('Export as PDF');
    return { result: () => recorded };
  }

  it('F5: PDF 누락 시 ConfirmDialog 를 열고 "계속 인쇄"는 true 로 이어진다', async () => {
    const { result } = await startPdfWithMissing();

    await screen.findByRole('dialog');
    const block = screen.getByTestId('unembedded-images');
    expect(block).toHaveTextContent('이미지 1개를 포함하지 못했습니다.');
    expect(block).toHaveTextContent('a.png');
    const buttons = screen.getAllByTestId(/^dialog-action-/);
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual(['dialog-action-cancel', 'dialog-action-print']);
    expect(screen.getByTestId('dialog-action-cancel')).toHaveTextContent('취소');
    expect(screen.getByTestId('dialog-action-print')).toHaveTextContent('계속 인쇄');
    expect(screen.getByTestId('dialog-action-print').className).toContain('md-dialog-action-primary');
    expect(screen.getByTestId('dialog-action-cancel').className).not.toContain('md-dialog-action-primary');

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-action-print'));
    });

    await waitFor(() => expect(result()).toBe(true));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });

  for (const [label, close] of [
    ['취소 버튼', () => fireEvent.click(screen.getByTestId('dialog-action-cancel'))],
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ['백드롭', () => fireEvent.click(screen.getByTestId('confirm-dialog-backdrop'))],
  ] as const) {
    it(`F9: PDF 확인 다이얼로그를 ${label}로 닫으면 false 로 이어지고 로딩 표시가 해제된다`, async () => {
      const { result } = await startPdfWithMissing();
      await screen.findByRole('dialog');

      await act(async () => {
        close();
      });

      await waitFor(() => expect(result()).toBe(false));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(screen.queryByLabelText('Export loading')).not.toBeInTheDocument());
      expect(window.alert).not.toHaveBeenCalled();
    });
  }
});

describe('SPEC-EXPORT-004: PDF 확인 다이얼로그 언마운트 정리 (sync-audit F5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      content: '# 테스트 문서',
      dirty: false,
      currentFilePath: '/tmp/test.md',
      cursorLine: 1,
      cursorCol: 1,
    });
    window.alert = vi.fn();
  });

  it('F5-unmount: 다이얼로그가 열린 채 언마운트되면 확인 Promise 가 false 로 정리된다', async () => {
    let recorded: boolean | undefined;
    mockExportToPdf.mockImplementationOnce(async (opts: ExportOpts) => {
      recorded = await opts.confirmUnembeddedImages?.(['a.png']);
    });
    const { unmount } = render(<App />);
    await openExportMenu();
    await clickExportItem('Export as PDF');
    await screen.findByRole('dialog');

    unmount();

    await waitFor(() => expect(recorded).toBe(false));
  });
});
