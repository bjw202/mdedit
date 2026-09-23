// @MX:SPEC: SPEC-IMG-WIDGET-002
// E2E:
//   (가) AC-C-003 계열 — 거대 base64 라인이 뷰포트에 있을 때 이미지 위젯(span.cm-image-widget)이
//        실제로 렌더되고, 원문 base64 문자열이 에디터 텍스트로 노출되지 않는다.
//        (본 SPEC 의 회귀 자체: 썸네일 대신 base64 원문이 보이던 결함)
//   (나) AC-C-004 (REQ-C-004) — 거대 base64 라인 가시 상태에서 키 입력이
//        INPUT_RESPONSIVENESS_BUDGET_MS(5,000ms) 이내에 DOM 에 반영된다.
//        plan.md §E-3: 로컬 must-pass / CI warning-only 관례는 기존 PT-A1-006/006b 와 동일하게
//        expect(elapsed).toBeLessThan(BUDGET) 단일 단언으로 표현한다.
//
// plan.md §E-4: 픽스처 라인은 2,097,183자이며 LINE_FOLD_THRESHOLD 3MB 상향 이후에는 폴드되지
// 않고 전량 스캔된다. 따라서 본 측정은 회귀 확인이 아니라 이 시나리오의 최초 측정이다.
// (기존 941ms 는 폴드 상태의 값이므로 기준선이 아니다.)
//
// 픽스처는 e2e/spec-img-load-002.spec.ts 의 seedLargeFileScenario 구조를 복제/각색했다
// (기존 스펙 파일은 "변경 없음" 이므로 export 하지 않는다).

import { test as base, expect, type Page } from '@playwright/test';
import { injectTauriMock } from './fixtures/tauri-mock';
import { INPUT_RESPONSIVENESS_BUDGET_MS } from '../src/lib/preview/previewLimits';

// 문서 본문에 등장하지 않는 문자 — 입력 반영 탐지용 마커
const TYPE_MARKER = 'Z';

async function seedLargeFileScenario(page: Page): Promise<void> {
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

const widgetEnv = base.extend<{ largeDocPage: Page }>({
  largeDocPage: async ({ page }, use) => {
    await injectTauriMock(page);
    await seedLargeFileScenario(page);
    await page.goto('/');
    await use(page);
  },
});

/** large.md 를 열고 거대 base64 라인이 뷰포트에 오도록 스크롤한다. */
async function openLargeDocAtBase64Line(page: Page) {
  await expect(page.locator('[data-testid="file-tree-node"]')).toHaveCount(1, { timeout: 10_000 });
  await page.getByText('large.md').first().click({ timeout: 10_000 });

  const editor = page.locator('.cm-editor');
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await expect(editor.locator('.cm-line').first()).toBeVisible({ timeout: 15_000 });

  // 경험적 관찰(M4): 위젯이 붙기 전 거대 base64 라인의 **추정** 높이는 약 7,000,000px 이고,
  // 위젯이 렌더되는 순간 실제 높이(약 24,000px)로 붕괴한다. 따라서 `scrollTop = scrollHeight`
  // 방식은 수렴하지 않는다 — 추정 높이 위에서 계산된 위치가 라인 중간(위젯 대체 구간 바깥)에
  // 착지하고, 붕괴 후에는 다시 라인 밖으로 벗어나 진동한다.
  // 커서를 문서 끝으로 보내면 CodeMirror 가 커서를 뷰포트로 스크롤해 주므로 결정적이다.
  await editor.click();
  await page.keyboard.press('Meta+ArrowDown'); // macOS: 문서 끝으로 이동
  await expect(editor.locator('span.cm-image-widget').first()).toBeAttached({ timeout: 15_000 });
  return editor;
}

// ============================================================
// (가) 위젯 렌더 — 본 SPEC 회귀의 직접 단언
// ============================================================

widgetEnv.describe('SPEC-IMG-WIDGET-002: 거대 base64 라인의 인라인 이미지 위젯', () => {
  widgetEnv('거대 base64 라인이 뷰포트에 들어오면 위젯이 렌더되고 원문이 노출되지 않는다', async ({
    largeDocPage,
  }) => {
    const editor = await openLargeDocAtBase64Line(largeDocPage);

    // 위젯 루트 present (image-widget.ts:108-133) — openLargeDocAtBase64Line 이 이미 대기했다.
    const widget = editor.locator('span.cm-image-widget');
    await expect(widget).toHaveCount(1);

    // 하위 구성요소
    await expect(widget.first().locator('img.cm-image-widget-thumb')).toBeAttached();
    await expect(widget.first().locator('span.cm-image-widget-info')).toBeAttached();
    await expect(widget.first().locator('span.cm-image-widget-alt')).toHaveText('huge');
    await expect(widget.first().locator('span.cm-image-widget-meta')).toContainText('KB');

    // 원문 base64 가 에디터 텍스트로 노출되지 않는다 —
    // 위젯이 대체한 라인의 텍스트 길이가 원문(2,097,183자)에 비해 무시할 만큼 작아야 한다.
    const widgetLineTextLength = await widget
      .first()
      .evaluate((el) => el.closest('.cm-line')?.textContent?.length ?? -1);
    console.log(`[SPEC-IMG-WIDGET-002] widget line textContent length = ${widgetLineTextLength}`);
    expect(widgetLineTextLength).toBeGreaterThanOrEqual(0);
    expect(widgetLineTextLength).toBeLessThan(1000);

    // 'A' 의 장문 연속(원문 base64) 이 렌더된 어떤 라인에도 없어야 한다.
    const hasRawBase64Run = await editor.evaluate((el) =>
      /A{2000,}/.test(el.querySelector('.cm-content')?.textContent ?? ''),
    );
    expect(hasRawBase64Run).toBe(false);
  });

  // ============================================================
  // (나) AC-C-004 — 입력 응답
  // ============================================================

  widgetEnv('거대 base64 라인 가시 상태에서 키 입력이 5s 이내 반영된다', async ({ largeDocPage }) => {
    const editor = await openLargeDocAtBase64Line(largeDocPage);

    // atomicRanges 로 인해 커서가 위젯 밖으로 밀릴 수 있으므로,
    // 마커가 "어느 라인에 들어갔는지"를 가정하지 않고 렌더된 전체 콘텐츠에서 탐지한다.
    const t0 = Date.now();
    await largeDocPage.keyboard.type(TYPE_MARKER);
    await expect
      .poll(
        async () =>
          editor.evaluate(
            (el, marker) => (el.querySelector('.cm-content')?.textContent ?? '').includes(marker),
            TYPE_MARKER,
          ),
        { timeout: INPUT_RESPONSIVENESS_BUDGET_MS, intervals: [100] },
      )
      .toBe(true);
    const elapsed = Date.now() - t0;

    // [HARD] 측정값을 출력한다 — PT-A1-006b 가 값을 남기지 않았던 문제의 교정.
    console.log(
      `[SPEC-IMG-WIDGET-002][AC-C-004] input responsiveness elapsed = ${elapsed} ms ` +
        `(budget ${INPUT_RESPONSIVENESS_BUDGET_MS} ms)`,
    );

    // 커서 착지 지점 — 경험적 기록용 (단언하지 않는다)
    const landedLine = await editor.evaluate((el, marker) => {
      const lines = Array.from(el.querySelectorAll('.cm-line'));
      const idx = lines.findIndex((l) => (l.textContent ?? '').includes(marker));
      return {
        index: idx,
        renderedLineCount: lines.length,
        text: (lines[idx]?.textContent ?? '').slice(0, 80),
        onWidgetLine: idx >= 0 ? Boolean(lines[idx]?.querySelector('span.cm-image-widget')) : false,
      };
    }, TYPE_MARKER);
    console.log(
      `[SPEC-IMG-WIDGET-002][cursor] ${JSON.stringify(landedLine)}`,
    );

    expect(elapsed).toBeLessThan(INPUT_RESPONSIVENESS_BUDGET_MS);
  });
});
