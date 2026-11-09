// @MX:SPEC: SPEC-SEC-001
// 프런트엔드 계약 테스트(REQ-SEC001-005): 프런트가 invoke('…') 리터럴로 호출하는 앱 명령은
// 모두 src-tauri/app_commands.rs 의 APP_COMMANDS 에 있어야 한다.
// 앱 ACL 매니페스트 도입 후 목록에 없는 명령은 런타임에서 거부되므로 여기서 먼저 잡는다.
// 한계: invoke(변수) 같은 동적 이름 호출은 문자열 검색으로 잡히지 않는다(M-3 스모크가 보완).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const srcRoot = resolve(repoRoot, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** app_commands.rs 의 APP_COMMANDS 문자열 리터럴을 모은다. */
function appCommands(): string[] {
  const text = readFileSync(resolve(repoRoot, 'src-tauri', 'app_commands.rs'), 'utf-8');
  const body = /APP_COMMANDS\s*:\s*&\[&str\]\s*=\s*&\[([\s\S]*?)\]\s*;/.exec(text);
  if (!body) throw new Error('APP_COMMANDS 선언을 찾지 못했다');
  return [...body[1].matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
}

/** src/** 비테스트 파일의 invoke('name') / invoke<T>('name') 리터럴. 숫자 포함 이름(base64) 필수. */
function literalInvokes(): string[] {
  const names = new Set<string>();
  for (const file of walk(srcRoot)) {
    const text = readFileSync(file, 'utf-8');
    for (const m of text.matchAll(/\binvoke(?:<[^>]*>)?\(\s*['"]([a-z0-9_]+)['"]/g)) names.add(m[1]);
  }
  return [...names].sort();
}

describe('SPEC-SEC-001 프런트엔드 앱 명령 계약', () => {
  it('invoke 리터럴 명령이 모두 APP_COMMANDS 에 있다', () => {
    const found = literalInvokes();
    // 정규식이 깨져 빈 집합을 통과시키는 일을 막는다.
    expect(found.length).toBeGreaterThan(0);
    console.log(`invoke 리터럴 명령 ${found.length}개`);
    const allowed = new Set(appCommands());
    const missing = found.filter((c) => !allowed.has(c));
    expect(missing).toEqual([]);
  });

  it('APP_COMMANDS 는 26개이고 중복이 없다', () => {
    const list = appCommands();
    expect(list.length).toBe(26);
    expect(new Set(list).size).toBe(26);
  });
});
