// @MX:SPEC: SPEC-EXPORT-002
// 정적 회귀 가드 (REQ-001/008/021, AC-003/013/014).
// 이 가드는 "실제로 증명할 수 있는 것만" 담는다(plan.md T7):
//   1. capabilities/main.json 에 opener:allow-reveal-item-in-dir 포함 + 기존 항목 미제거 (REQ-008)
//   2. lib.rs invoke_handler 등록 목록 무변경 — 본 SPEC용 신규 command 0건 (REQ-021)
//   3. 리포지토리 스캔 — 완료 모달 용도의 별도 다이얼로그 컴포넌트 부재 (REQ-001 부정절)
// 파일 "무변경"(PDF, browser_ops.rs, devDeps 등)은 baseline hash 가 없어 vitest 로 단언 불가 →
// 코드 리뷰(diff) 항목으로 별도 처리된다(spec.md §3, acceptance.md 검증 불가 경계 (3)).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

describe('SPEC-EXPORT-002 regression guard', () => {
  it('capabilities/main.json 에 opener:allow-reveal-item-in-dir 포함 + 기존 항목 유지 (REQ-008, AC-013)', () => {
    const caps = JSON.parse(
      readFileSync(resolve(repoRoot, 'src-tauri', 'capabilities', 'main.json'), 'utf-8'),
    ) as { permissions: string[] };

    expect(caps.permissions).toContain('opener:allow-reveal-item-in-dir');
    // 기존 항목 미제거 확인(회귀 방지).
    for (const required of [
      'core:default',
      'dialog:allow-open',
      'dialog:allow-save',
      'dialog:allow-message',
      'opener:default',
      'shell:allow-execute',
      'shell:allow-spawn',
    ]) {
      expect(caps.permissions).toContain(required);
    }
  });

  it('lib.rs invoke_handler 에 본 SPEC용 신규 command 가 없다 (REQ-021, AC-014)', () => {
    const libRs = readFileSync(resolve(repoRoot, 'src-tauri', 'src', 'lib.rs'), 'utf-8');
    // invoke_handler(generate_handler![...]) 블록 추출.
    const start = libRs.indexOf('generate_handler![');
    expect(start).toBeGreaterThan(-1);
    const block = libRs.slice(start, libRs.indexOf('])', start));
    // 등록된 command 들 추출(접두사 모듈명 포함 그대로).
    const commands = block
      .split('\n')
      .map((l) => l.match(/([A-Za-z0-9_:]+),/)?.[1])
      .filter((m): m is string => typeof m === 'string' && m.length > 0)
      .map((s) => s.replace(/,$/, ''));
    // 기준선(본 SPEC 착수 시점) — 신규 command 가 추가되면 이 단언이 실패한다.
    expect(commands).toEqual([
      'file_ops::read_file',
      'file_ops::write_file',
      'file_ops::create_file',
      'file_ops::delete_file',
      'file_ops::rename_file',
      'file_ops::save_file_as',
      'file_ops::export_save_dialog',
      'file_ops::write_binary_file',
      'file_ops::print_current_window',
      'directory_ops::read_directory',
      'directory_ops::open_directory_dialog',
      'directory_ops::register_asset_scope',
      'watcher::start_watch',
      'watcher::stop_watch',
      'image_ops::save_image_from_clipboard',
      'image_ops::copy_image_to_folder',
      'image_ops::read_image_as_base64',
      'image_ops::open_image_dialog',
      'browser_ops::open_url_in_browser',
      'ai::ai_request',
      'ai::ai_cancel',
      'ai::ai_detect_providers',
      'ai::ai_policy_status',
    ]);
  });

  it('완료 모달 용도의 별도 다이얼로그 컴포넌트가 존재하지 않는다 (REQ-001 부정절, AC-003)', () => {
    // src/components/ 를 재귀 순회하며 "내보내기 완료" 전용 다이얼로그/모달 컴포넌트가
    // 없는지 확인. ConfirmDialog(SPEC-FS-003 소유, 공유)만 허용된다.
    const componentsDir = resolve(repoRoot, 'src', 'components');
    const offenderPattern = /(export.*(complete|completion|done|success))|(complete|completion|done|success).*(dialog|modal)/i;

    function* walk(dir: string): Generator<string> {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const name of entries) {
        const full = join(dir, name);
        let st: ReturnType<typeof statSync>;
        try {
          st = statSync(full);
        } catch {
          continue;
        }
        if (st.isDirectory()) {
          yield* walk(full);
        } else {
          yield name;
        }
      }
    }

    const matches: string[] = [];
    for (const name of walk(componentsDir)) {
      if (offenderPattern.test(name)) matches.push(name);
    }
    expect(matches).toEqual([]);
  });
});
