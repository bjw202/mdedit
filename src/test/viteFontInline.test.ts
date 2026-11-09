// @vitest-environment node
// SPEC-SEC-002 AC-001: vite.config.ts 의 build.assetsInlineLimit 판정 함수 검증.
// vite.config.ts 를 정적 import 하지 않고 resolveConfig 로 읽는다(tsconfig.node.json 은 composite 프로젝트).
import path from 'path';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from 'vite';

type InlineLimit = (file: string, content: Buffer) => boolean | undefined;

async function loadInlineLimit(): Promise<unknown> {
  const config = await resolveConfig(
    { configFile: path.resolve(process.cwd(), 'vite.config.ts') },
    'build',
  );
  return config.build.assetsInlineLimit;
}

describe('SPEC-SEC-002 글꼴 자산 인라인 금지', () => {
  it('build.assetsInlineLimit 가 함수로 연결되어 있다', async () => {
    expect(typeof (await loadInlineLimit())).toBe('function');
  });

  it.each([
    '/x/KaTeX_Size3-Regular.woff2',
    '/x/a.woff',
    '/x/a.ttf',
    '/x/a.otf',
    '/x/a.eot',
    '/x/a.woff2?v=1',
    '/x/A.WOFF2',
  ])('글꼴 %s 는 크기와 무관하게 인라인하지 않는다(false)', async (file) => {
    const fn = (await loadInlineLimit()) as InlineLimit;
    expect(fn(file, Buffer.alloc(10))).toBe(false);
  });

  it.each(['/x/a.png', '/x/a.svg', '/x/a.css'])(
    '글꼴이 아닌 %s 는 Vite 기본 기준에 맡긴다(undefined)',
    async (file) => {
      const fn = (await loadInlineLimit()) as InlineLimit;
      expect(fn(file, Buffer.alloc(10))).toBeUndefined();
    },
  );
});
