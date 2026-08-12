// @MX:SPEC: SPEC-IMG-LOAD-002
// E2E (Playwright must-pass):
//   PT-A1-006:  4MB .md 파일 오픈 후 에디터 입력 → INPUT_RESPONSIVENESS_BUDGET_MS(5s) 이내 첫 paint
//               (REQ-IMG-LOAD-2-A-006, jsdom blind spot: main-thread 동결).
//   PT-A1-006b: ★ LINCHPIN ★ 4MB .md 의 첫 화면은 일반 텍스트, 거대 base64 라인이 폴드 너머에 존재.
//               스크롤하여 base64 라인이 뷰포트로 진입 → 글자 1자 입력 → 5s 이내 첫 paint.
//               본 테스트의 PASS/FAIL 이 Phase 2 (B/C) 활성화 여부를 결정한다 (plan.md Run-Phase Decision Rule).
//
// 동결 제거 주체는 REQ-A-001 (image-widget.ts buildDecorations 의 view.state.doc.toString()
// full-doc copy 제거 → view.visibleRanges 기반 부분 스캔) 이다. Lezer parse-ahead 에 의한
// 잔여 동결(base64 라인이 뷰포트로 스크롤인 시)은 본 테스트가 직접 측정한다 (spec.md
// "Residual Freeze Risk" 절).
//
// Tauri 런타임이 없으므로 injectTauriMock 의 가상 FS 핸들러를 확장한다. 4MB 문서는 브라우저
// 메모리에서 동적 생성한다 (string concatenation).

import { test as base, expect, type Page } from '@playwright/test';
import { injectTauriMock } from './fixtures/tauri-mock';

const INPUT_RESPONSIVENESS_BUDGET_MS = 5000; // OD-1

async function seedLargeFileScenario(page: Page): Promise<void> {
  // UI store 초기화 — lastWatchedPath = /proj (자동 복원), imageInsertMode = inline-blob
  await page.addInitScript(() => {
    localStorage.setItem(
      'mdedit-ui-store',
      JSON.stringify({
        state: {
          sidebarWidth: 250,
          previewWidth: 50,
          theme: 'system',
          fontSize: 14,
          sidebarCollapsed: false,
          scrollSyncEnabled: true,
          lastWatchedPath: '/proj',
          imageInsertMode: 'inline-blob',
          viewMode: 'split',
          aiNoticeAcknowledged: false,
          aiAdvancedModel: false,
          aiContinueLength: 'normal',
          aiEnabled: true,
        },
        version: 1,
      }),
    );
  });

  // 가상 FS: large.md (4MB, 거대 base64 라인 포함)
  await page.addInitScript(() => {
    function buildHugeMarkdownDoc(): string {
      const lines: string[] = [];
      for (let i = 1; i <= 50; i++) {
        lines.push(`# Section ${i}\n\nThis is normal text line ${i}. `.repeat(8) + '\n');
      }
      const base64 = 'A'.repeat(2 * 1024 * 1024);
      lines.push(`![huge](data:image/png;base64,${base64})`);
      return lines.join('\n');
    }
    const hugeDoc = buildHugeMarkdownDoc();
    (window as unknown as Record<string, unknown>).__HUGE_DOC_SIZE__ = hugeDoc.length;

    const fs = new Map<string, string>([['/proj/large.md', hugeDoc]]);

    const invoke = (cmd: string, args: Record<string, unknown>): Promise<unknown> => {
      switch (cmd) {
        case 'read_directory':
          return Promise.resolve([
            { name: 'large.md', path: '/proj/large.md', isDirectory: false, size: hugeDoc.length },
          ]);
        case 'read_file': {
          const p = String(args.path ?? '');
          if (fs.has(p)) return Promise.resolve(fs.get(p));
          return Promise.reject(new Error(`not found: ${p}`));
        }
        case 'read_file_size':
          return Promise.resolve(hugeDoc.length);
        case 'write_file':
          return Promise.resolve(null);
        case 'start_watch':
        case 'stop_watch':
        case 'register_asset_scope':
          return Promise.resolve(null);
        default:
          return Promise.resolve(null);
      }
    };

    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      invoke,
      convertFileSrc: (filePath: string) => `asset://localhost/${encodeURIComponent(filePath)}`,
      metadata: { currentWindow: { label: 'main' } },
      transformCallback: () => 0,
    };
    (window as unknown as Record<string, unknown>).__TAURI__ = {
      core: { invoke },
      event: {
        listen: () => Promise.resolve(() => undefined),
        emit: () => Promise.resolve(),
      },
    };
  });
}

const ptA1Env = base.extend<{ largeDocPage: Page }>({
  largeDocPage: async ({ page }, use) => {
    await injectTauriMock(page); // base (나중에 seedLargeFileScenario 가 overwrite)
    await seedLargeFileScenario(page);
    await page.goto('/');
    await use(page);
  },
});

// ============================================================
// PT-A1-006: 4MB 파일 오픈 후 에디터 입력 → 5s 이내 첫 paint
// ============================================================

ptA1Env.describe('SPEC-IMG-LOAD-002 PT-A1-006: 4MB .md 오픈 후 입력 응답 (REQ-A-006)', () => {
  ptA1Env('large.md 오픈 → 키 입력 후 5s 이내 DOM 반영', async ({ largeDocPage }) => {
    // 사이드바 파일 트리 대기
    await expect(largeDocPage.locator('[data-testid="file-tree-node"]'))
      .toHaveCount(1, { timeout: 10_000 });

    // large.md 클릭 — 에디터 로드
    await largeDocPage.getByText('large.md').first().click({ timeout: 10_000 });

    // 에디터 마운트 대기
    const editor = largeDocPage.locator('.cm-editor');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // 콘텐츠가 채워질 때까지 대기 (첫 라인)
    await expect(editor.locator('.cm-line').first()).toBeVisible({ timeout: 15_000 });

    // 에디터 포커스 후 첫 라인 끝으로 이동
    await editor.click();
    await largeDocPage.keyboard.press('End');

    // 측정 시작
    const t0 = Date.now();
    await largeDocPage.keyboard.type('X');
    // X 가 DOM 에 나타날 때까지 대기
    await expect.poll(
      async () => {
        const activeLineText = await editor.locator('.cm-activeLine').first().textContent();
        return activeLineText?.includes('X') ?? false;
      },
      { timeout: INPUT_RESPONSIVENESS_BUDGET_MS, intervals: [100] },
    ).toBe(true);
    const elapsed = Date.now() - t0;

    // 5s 이내 첫 paint — 동결이 없어야 함 (REQ-A-001 full-doc copy 제거)
    expect(elapsed).toBeLessThan(INPUT_RESPONSIVENESS_BUDGET_MS);
  });
});

// ============================================================
// PT-A1-006b: ★ LINCHPIN ★
// 거대 base64 라인이 뷰포트로 스크롤인 시 Lezer parse-ahead 동결 측정.
// PASS → A+D 로 충분, Phase 2(B/C) 무기한 연기.
// FAIL  → Lezer parse-ahead 동결이 잔존하며 B/C 로는 해소 불가 → 신규 Lezer-viewport SPEC 필요.
// ============================================================

ptA1Env.describe('SPEC-IMG-LOAD-002 PT-A1-006b (linchpin): base64 라인 뷰포트 진입 시 Lezer 동결 (REQ-A-006 잔여)', () => {
  ptA1Env('스크롤로 base64 라인 진입 → 키 입력 → 5s 이내 DOM 반영', async ({ largeDocPage }) => {
    await expect(largeDocPage.locator('[data-testid="file-tree-node"]'))
      .toHaveCount(1, { timeout: 10_000 });
    await largeDocPage.getByText('large.md').first().click({ timeout: 10_000 });

    const editor = largeDocPage.locator('.cm-editor');
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await expect(editor.locator('.cm-line').first()).toBeVisible({ timeout: 15_000 });

    // 에디터 하단(거대 base64 라인 근처)으로 스크롤 — base64 가 뷰포트로 진입
    await editor.locator('.cm-scroller').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    // 스크롤 안정화 대기
    await largeDocPage.waitForTimeout(300);

    // 에디터 포커스
    await editor.click();

    // 측정 시작
    const t0 = Date.now();
    await largeDocPage.keyboard.type('Y');
    await expect.poll(
      async () => {
        const text = await editor.locator('.cm-activeLine').first().textContent();
        return text?.includes('Y') ?? false;
      },
      { timeout: INPUT_RESPONSIVENESS_BUDGET_MS, intervals: [100] },
    ).toBe(true);
    const elapsed = Date.now() - t0;

    // 5s 이내 첫 paint — Lezer parse-ahead 동결이 REQ-A-001(뷰포트 위젯 바운딩) 만으로
    // 충분히 완화되는지를 측정한다. FAIL 시 런 에이전트는 정지+보고 후 신규 SPEC 분기.
    expect(elapsed).toBeLessThan(INPUT_RESPONSIVENESS_BUDGET_MS);
  });
});
