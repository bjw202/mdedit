// extensionLangMap 단위 테스트 — SPEC-PREVIEW-005
// TDD RED phase: 구현 전에 먼저 작성. 확장자→Shiki 언어 매핑의 동작을 정의한다.
import { describe, it, expect } from 'vitest';

// 구현 전에는 import가 실패한다 (RED 상태 확인용)
// GREEN 단계에서 src/lib/preview/extensionLangMap.ts를 생성한 후 통과된다.

describe('extensionLangMap', () => {
  describe('extensionLangMap 객체', () => {
    it('py 확장자가 python에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['py']).toBe('python');
    });

    it('js 확장자가 javascript에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['js']).toBe('javascript');
    });

    it('mjs 확장자가 javascript에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['mjs']).toBe('javascript');
    });

    it('cjs 확장자가 javascript에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['cjs']).toBe('javascript');
    });

    it('ts 확장자가 typescript에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['ts']).toBe('typescript');
    });

    it('json 확장자가 json에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['json']).toBe('json');
    });

    it('jsonl 확장자가 json에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['jsonl']).toBe('json');
    });

    it('yaml 확장자가 yaml에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['yaml']).toBe('yaml');
    });

    it('yml 확장자가 yaml에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['yml']).toBe('yaml');
    });

    it('toml 확장자가 toml에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['toml']).toBe('toml');
    });

    it('sh 확장자가 bash에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['sh']).toBe('bash');
    });

    it('bash 확장자가 bash에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['bash']).toBe('bash');
    });

    it('css 확장자가 css에 매핑된다', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['css']).toBe('css');
    });

    it('md 확장자는 매핑에 없다 (마크다운은 별도 경로)', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['md']).toBeUndefined();
    });

    it('html 확장자는 매핑에 없다 (HTML은 별도 경로)', async () => {
      const { extensionLangMap } = await import('@/lib/preview/extensionLangMap');
      expect(extensionLangMap['html']).toBeUndefined();
    });
  });

  describe('getLangForExtension 조회 헬퍼', () => {
    it('파일 경로에서 python lang을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('notes.py')).toBe('python');
    });

    it('절대 경로에서도 올바르게 확장자를 추출한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('/home/user/project/app.ts')).toBe('typescript');
    });

    it('json 파일에서 json lang을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('config.json')).toBe('json');
    });

    it('yaml 파일에서 yaml lang을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('data.yaml')).toBe('yaml');
    });

    it('yml 파일에서 yaml lang을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('data.yml')).toBe('yaml');
    });

    it('대문자 확장자를 소문자로 변환하여 조회한다 — NOTES.PY → python', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('NOTES.PY')).toBe('python');
    });

    it('대문자 CONFIG.JSON → json', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('CONFIG.JSON')).toBe('json');
    });

    it('혼합 대소문자 App.Ts → typescript', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('App.Ts')).toBe('typescript');
    });

    it('매핑에 없는 확장자는 null을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('archive.xyz')).toBeNull();
    });

    it('마크다운 파일은 null을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('readme.md')).toBeNull();
    });

    it('html 파일은 null을 반환한다 (HTML은 별도 경로)', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('index.html')).toBeNull();
    });

    it('확장자 없는 파일은 null을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('Makefile')).toBeNull();
    });

    it('null 경로는 null을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension(null)).toBeNull();
    });

    it('undefined 경로는 null을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension(undefined)).toBeNull();
    });

    it('빈 문자열은 null을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('')).toBeNull();
    });

    it('jsonl 파일에서 json lang을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('data.jsonl')).toBe('json');
    });

    it('toml 파일에서 toml lang을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('Cargo.toml')).toBe('toml');
    });

    it('sh 파일에서 bash lang을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('script.sh')).toBe('bash');
    });

    it('css 파일에서 css lang을 반환한다', async () => {
      const { getLangForExtension } = await import('@/lib/preview/extensionLangMap');
      expect(getLangForExtension('style.css')).toBe('css');
    });
  });
});
