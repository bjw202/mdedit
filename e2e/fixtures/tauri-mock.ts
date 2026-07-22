import { test as base, expect, type Page } from '@playwright/test';

/**
 * 가상 파일시스템 기반 Tauri IPC 목 (SPEC-FS-003 T2b).
 *
 * 두 모드:
 *  - graceful(기본, opts 없음): 알려진 명령은 빈 응답, 미지원 명령은 null. 기존 E2E 5종 호환.
 *  - seeded(opts.files): 시드 파일로 read_directory/read_file/write_file이 동작. strict 모드에선
 *    미지원 명령을 reject(유령 통과 방지).
 *
 * 확장성(SPEC-EXPORT-002): 핸들러 테이블을 window.__TAURI_MOCK_HANDLERS__에 노출해 후속 SPEC이
 * 같은 페이지에서 명령을 추가할 수 있게 한다(포크 금지). FS 명령은 fs Map 클로저를 쓰므로 base
 * 스크립트에서 설정하되, fs가 불필요한 명령(export_save_dialog 등)은 후속 addInitScript로 추가 가능.
 */
export async function injectTauriMock(
  page: Page,
  opts: { files?: Record<string, string>; strict?: boolean } = {},
): Promise<void> {
  const files = opts.files ?? {};
  const strict = opts.strict ?? false;
  await page.addInitScript(
    ([seed, isStrict]) => {
      // 가상 파일시스템: 경로 → 내용
      const fs = new Map<string, string>(Object.entries(seed));

      function buildTree(root: string): unknown[] {
        const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
        const rootNorm = norm(root);
        const seen = new Set<string>();
        const result: unknown[] = [];
        for (const path of fs.keys()) {
          const p = norm(path);
          if (rootNorm && !p.startsWith(rootNorm + '/')) continue;
          const rel = rootNorm ? p.slice(rootNorm.length + 1) : p;
          if (!rel || rel.includes('/')) continue; // 직접 자식 파일만 (단순화)
          seen.add(p);
          result.push({ name: rel, path, isDirectory: false, size: (fs.get(path) ?? '').length });
        }
        result.sort((a, b) => (a as { name: string }).name.localeCompare((b as { name: string }).name));
        return result;
      }

      const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
        read_directory: (args) => buildTree(String(args.path ?? '')),
        read_file: (args) => {
          const p = String(args.path ?? '');
          if (fs.has(p)) return fs.get(p);
          throw new Error(`read_file: not found: ${p}`);
        },
        write_file: (args) => {
          fs.set(String(args.path ?? ''), String(args.content ?? ''));
          return null;
        },
        save_file_as: (args) => {
          // 결정론적 경로 반환 (사용자가 파일을 선택했다고 가정). 취소 시나리오는 핸들러 교체로.
          const dp = args.defaultPath ? String(args.defaultPath) : '/tmp';
          return `${dp}/saved-${Date.now()}.md`;
        },
        start_watch: () => null,
        stop_watch: () => null,
        register_asset_scope: () => null,
        // 비-FS 명령(ai_*, open_directory_dialog 등)은 graceful 모드에선 null, strict 모드에선
        // reject — 앱이 .catch로 흡수하므로 안전. 특정 값을 주면 기존 E2E(AI spec 등) 동작이 변한다.
      };

      function dispatch(cmd: string, args: Record<string, unknown>): unknown {
        const h = handlers[cmd] ?? (window as unknown as { __TAURI_MOCK_HANDLERS__?: Record<string, (a: Record<string, unknown>) => unknown> }).__TAURI_MOCK_HANDLERS__?.[cmd];
        if (h) return h(args ?? {});
        if (isStrict) throw new Error(`tauri-mock: unsupported command (strict): ${cmd}`);
        return null;
      }

      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: (cmd: string, args: Record<string, unknown>) =>
          Promise.resolve(dispatch(cmd, args)),
        convertFileSrc: (filePath: string) => `asset://localhost/${encodeURIComponent(filePath)}`,
        // getCurrentWindow()가 metadata.currentWindow.label을 읽고, 이벤트 listen이
        // transformCallback을 호출하므로 둘 다 스텁한다(실제 이벤트는 발생하지 않음).
        metadata: { currentWindow: { label: 'main' } },
        transformCallback: () => 0,
      };
      (window as unknown as Record<string, unknown>).__TAURI__ = {
        core: { invoke: (cmd: string, args: Record<string, unknown>) => Promise.resolve(dispatch(cmd, args)) },
        event: {
          listen: () => Promise.resolve(() => {}),
          emit: () => Promise.resolve(),
        },
      };
      // 확장 포인트: 후속 SPEC이 같은 페이지에서 명령을 추가한다 (fs 클로저 불필요한 명령만).
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_HANDLERS__ = {};
    },
    [files, strict] as const,
  );
}

/**
 * 시드 파일로 가상 FS를 설정하고 strict 모드로 주입한다 (미지원 명령 reject).
 * FS-003 E2E(AC-022)용. 사용: await seedFs(page, { '/proj/a.md': '내용A' });
 */
export async function seedFs(page: Page, files: Record<string, string>): Promise<void> {
  await injectTauriMock(page, { files, strict: true });
}

export const test = base.extend<{ tauriPage: Page }>({
  tauriPage: async ({ page }, use) => {
    await injectTauriMock(page);
    await use(page);
  },
});

export { expect };
