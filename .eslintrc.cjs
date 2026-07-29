/**
 * ESLint 설정 (ESLint 8 / eslintrc 형식).
 *
 * 이 파일이 없어서 `npm run lint` 가 실행 즉시 실패하고 있었다 —
 * 즉 린트 품질 게이트가 처음부터 돌지 않았다.
 *
 * 규칙은 typescript-eslint 권장 세트를 기준으로 하되, 타입 정보를 요구하는
 * (느린) 규칙은 켜지 않는다. 린트가 빠르게 돌아야 실제로 쓰인다.
 *
 * react-refresh 플러그인은 의도적으로 쓰지 않는다. 이 코드베이스는 컴포넌트
 * 파일에 관련 상수를 함께 두는 방식을 일관되게 따르는데, 해당 규칙은 그것을
 * 전부 경고로 잡는다(6곳). Vite HMR 편의를 위한 규칙일 뿐 정확성과는 무관하므로,
 * 규칙에 맞추려고 파일을 쪼개는 대신 규칙을 채택하지 않는 쪽을 택했다.
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  rules: {
    ...require('eslint-plugin-react-hooks').configs.recommended.rules,

    // _ 접두사는 "의도적으로 안 쓰는 값" 관용구로 허용한다.
    // ignoreRestSiblings: rest 로 특정 키를 걷어내는 관용구를 허용한다.
    //   const { statusMessage, ...rest } = state;  // statusMessage 를 제외하려는 의도
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],

    // `while (true) { ... break; }` 는 정상적인 순회 관용구다.
    // 조건식이 아닌 곳의 상수 조건만 잡는다.
    'no-constant-condition': ['error', { checkLoops: false }],
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'src-tauri',
    // video/ 는 자체 tsconfig 를 쓰는 독립 Remotion 프로젝트다.
    'video',
    // Playwright 가 생성하는 리포트·트레이스 번들. .gitignore 대상이지만 eslint 는
    // .gitignore 를 읽지 않으므로 여기 명시하지 않으면 e2e 를 한 번이라도 돌린 뒤
    // 린트 게이트가 번들된 서드파티 코드에서 항상 실패한다.
    'playwright-report',
    'test-results',
    '*.config.js',
    '*.config.ts',
    '.eslintrc.cjs',
  ],
};
