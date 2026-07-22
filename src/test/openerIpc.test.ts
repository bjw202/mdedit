/**
 * SPEC-EXPORT-002 (REQ-006, 011, 012): opener IPC 래퍼 단위 테스트.
 *
 * 컴포넌트가 @tauri-apps/plugin-opener 를 직접 import 하지 못하게 ipc.ts 래퍼로 모은다(REQ-006).
 * 각 래퍼가 올바른 플러그인 API(openPath / revealItemInDir)를 올바른 경로 인자로
 * 정확히 1회 호출하는지 검증한다. 플러그인 모듈 자체는 모킹한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 플러그인 JS API 를 모킹 — 래퍼가 이들을 경유하는지 검증하기 위함.
vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn().mockResolvedValue(undefined),
  revealItemInDir: vi.fn().mockResolvedValue(undefined),
}));

describe('opener IPC wrappers (SPEC-EXPORT-002 REQ-006/011/012)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('openExportedFile 은 openPath 를 경로 인자로 정확히 1회 호출한다 (REQ-011)', async () => {
    const { openPath } = await import('@tauri-apps/plugin-opener');
    const { openExportedFile } = await import('@/lib/tauri/ipc');

    await openExportedFile('/tmp/exported.html');

    expect(openPath).toHaveBeenCalledTimes(1);
    expect(openPath).toHaveBeenCalledWith('/tmp/exported.html');
  });

  it('revealExportedFile 은 revealItemInDir 을 경로 인자로 정확히 1회 호출한다 (REQ-012)', async () => {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
    const { revealExportedFile } = await import('@/lib/tauri/ipc');

    await revealExportedFile('/tmp/exported.docx');

    expect(revealItemInDir).toHaveBeenCalledTimes(1);
    expect(revealItemInDir).toHaveBeenCalledWith('/tmp/exported.docx');
  });

  it('openExportedFile 은 revealItemInDir 을 호출하지 않는다 (액션 분리)', async () => {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
    const { openExportedFile } = await import('@/lib/tauri/ipc');

    await openExportedFile('/tmp/x.html');

    expect(revealItemInDir).not.toHaveBeenCalled();
  });

  it('revealExportedFile 은 openPath 를 호출하지 않는다 (액션 분리)', async () => {
    const { openPath } = await import('@tauri-apps/plugin-opener');
    const { revealExportedFile } = await import('@/lib/tauri/ipc');

    await revealExportedFile('/tmp/x.docx');

    expect(openPath).not.toHaveBeenCalled();
  });
});
