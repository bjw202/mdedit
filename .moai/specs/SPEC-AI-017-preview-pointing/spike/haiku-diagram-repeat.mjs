// SPEC-AI-017 스파이크 (c-2) — claude haiku 가 다이어그램 지시를 무시하고 원본을 그대로 돌려준 사례(cli-roundtrip 1회차)가
// 재현되는지, 그리고 지시 반영 문장을 더한 개정 문구가 고치는지 3회씩 잰다.
// 실행: node .moai/specs/SPEC-AI-017-preview-pointing/spike/haiku-diagram-repeat.mjs <임시 폴더>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = process.argv[2];
fs.mkdirSync(tmp, { recursive: true });
const sys0 = fs.readFileSync(path.join(here, 'captures/diagram-node.system.txt'), 'utf8');
const user0 = fs.readFileSync(path.join(here, 'captures/diagram-node.user.txt'), 'utf8');
const ORIGINAL = ['flowchart LR', '  A[장바구니] --> B[주문서 작성]', '  B --> C{결제}', '  C -->|성공| D[주문 완료]', '  C -->|실패| B'].join('\n');

// 개정: 「그대로 두어라」 앞에 지시 반영을 먼저 못 박고, 원본을 그대로 돌려주지 말라고 한다.
const OLD = '첫 줄의 다이어그램 종류는 바꾸지 말고, 지시와 관계없는 노드·연결선·ID·스타일은 그대로 두어라.';
const NEW = '지시한 변경은 반드시 결과에 반영하라. 첫 줄의 다이어그램 종류는 바꾸지 말고, 지시와 관계없는 노드·연결선·ID·스타일은 그대로 두어라.';
const variants = {
  draft: { system: sys0, user: user0 },
  revised: { system: sys0.split(OLD).join(NEW), user: user0.split(OLD).join(NEW) },
};
if (!variants.revised.system.includes(NEW)) throw new Error('개정 치환 실패');

const out = [];
for (const [name, v] of Object.entries(variants)) {
  for (let i = 1; i <= 3; i++) {
    const sp = path.join(tmp, `rep-${name}-${i}.txt`);
    fs.writeFileSync(sp, v.system);
    const t0 = Date.now();
    const r = spawnSync('claude', ['-p', '--system-prompt-file', sp, '--model', 'haiku', '--output-format', 'stream-json',
      '--include-partial-messages', '--verbose', '--setting-sources', '', '--tools', ''],
    { input: v.user, encoding: 'utf8', timeout: 180_000, cwd: tmp });
    const ms = Date.now() - t0;
    let text = '';
    for (const line of (r.stdout || '').split('\n')) {
      try { const ev = JSON.parse(line); if (ev.type === 'result') text = ev.result; } catch { /* 무시 */ }
    }
    const changed = text.trim() !== ORIGINAL;
    const hasCache = /캐시/.test(text);
    out.push({ variant: name, run: i, ms, changed, hasCacheNode: hasCache });
    console.log(JSON.stringify(out[out.length - 1]));
    if (i === 1) fs.writeFileSync(path.join(here, `captures/diagram-node.claude-haiku.${name}-repeat1.out.txt`), text);
  }
}
fs.writeFileSync(path.join(here, 'haiku-diagram-repeat.json'), JSON.stringify(out, null, 1));
