// @MX:NOTE: [AUTO] v1 매핑 범위가 의도적으로 작다 — 사용자 지명 포맷(py·js·ts·json·yaml) +
//   무료 extras(toml·sh·css). .rs/.go/.java 등은 매핑 미등록으로 두어 범위를 작게 유지한다.
//   확장이 필요하면 extensionLangMap 객체에 항목을 추가하면 된다.
// @MX:SPEC: SPEC-PREVIEW-005 REQ-PREVIEW005-001

/**
 * 파일 확장자 → Shiki 언어 식별자 명시 매핑.
 *
 * 이 매핑에 포함된 확장자만 코드 보기(`'code'`)로 라우팅된다.
 * 마크다운(.md)과 HTML(.html)은 별도 경로를 사용하므로 의도적으로 제외된다.
 *
 * 키는 소문자 확장자(점 제외), 값은 Shiki lang 식별자.
 */
export const extensionLangMap: Record<string, string> = {
  // Python
  py: 'python',
  // JavaScript 변형
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  // TypeScript
  ts: 'typescript',
  // JSON 계열
  json: 'json',
  jsonl: 'json', // JSON Lines — json 언어로 강조
  // YAML 계열
  yaml: 'yaml',
  yml: 'yaml',
  // TOML (싱글톤에 추가 필요 — codeHighlight.ts에서 관리)
  toml: 'toml',
  // 셸 스크립트
  sh: 'bash',
  bash: 'bash',
  // CSS
  css: 'css',
};

/**
 * 파일 경로에서 확장자를 추출하고 extensionLangMap에서 Shiki 언어를 조회한다.
 *
 * 대소문자를 무시하고 조회한다(예: NOTES.PY → python).
 * 매핑에 없는 확장자나 경로가 없으면 null을 반환한다.
 *
 * @param path - 파일 경로 또는 파일명. null/undefined 허용.
 * @returns Shiki 언어 식별자 또는 null
 */
export function getLangForExtension(path: string | null | undefined): string | null {
  if (!path) return null;

  // 마지막 점 이후 문자열을 소문자로 변환하여 확장자 추출
  const dotIndex = path.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === path.length - 1) return null;

  const ext = path.slice(dotIndex + 1).toLowerCase();
  return extensionLangMap[ext] ?? null;
}
