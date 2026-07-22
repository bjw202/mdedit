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
