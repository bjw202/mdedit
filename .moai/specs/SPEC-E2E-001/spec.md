# SPEC-E2E-001: Playwright E2E 테스트 인프라 구축

**Status:** Implemented
**Created:** 2026-02-25
**Author:** MoAI (jw)
**Method:** Playwright Method A (WebKit + Vite dev server)

---

## 1. 배경 및 목적

### 문제

현재 Vitest + jsdom 기반 테스트는 CSS 렌더링 엔진이 없어 시각적 버그를 감지할 수 없다.

구체적 증상: 마크다운 미리보기의 테이블 오른쪽 테두리가 렌더링되지 않음.
구체적 원인: `border-collapse: collapse` + `.table-scroll-wrapper(overflow-x: auto)` 조합에서
WebKit이 스크롤 컨테이너 경계의 테두리를 클리핑하는 WebKit 렌더링 버그.

### 해결 방법

Playwright + WebKit 브라우저로 실제 렌더링을 검증하는 E2E 테스트 레이어를 추가한다.

---

## 2. 범위

### In Scope
- Playwright 테스트 인프라 설정 (설치, 설정, fixtures)
- 테이블 테두리 시각적 렌더링 E2E 테스트
- 앱 기본 렌더링 E2E 테스트 (smoke test)
- Tauri IPC mock 전략
- `npm run test:e2e` 스크립트 추가

### Out of Scope
- tauri-driver 기반 네이티브 통합 테스트
- CI/CD 파이프라인 설정
- 전체 앱 기능 E2E 커버리지

---

## 3. 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| E2E Framework | `@playwright/test` | 글로벌 설치 v1.58.2 존재, WebKit 지원 |
| Browser Engine | WebKit | WKWebView(macOS Tauri)와 동일한 렌더링 엔진 |
| Target Server | Vite dev server (localhost:1420) | Tauri IPC 없이 프론트엔드 독립 테스트 |
| Server Start | `webServer` 옵션 | 테스트 전 Vite 자동 시작 |

---

## 4. EARS 요구사항

### REQ-E2E-001: Playwright 설치 및 설정

**WHEN** `npm run test:e2e`를 실행하면
**THE SYSTEM SHALL** Playwright가 WebKit 브라우저로 `http://localhost:1420`에서 E2E 테스트를 실행해야 한다.

**수용 조건:**
- `@playwright/test` devDependency로 설치됨
- `playwright.config.ts`에 WebKit 프로젝트 설정됨
- `webServer`가 `npm run dev-vite`를 자동 시작함
- `package.json`에 `"test:e2e": "playwright test"` 스크립트 존재

---

### REQ-E2E-002: Tauri IPC Mock

**WHEN** Playwright가 `http://localhost:1420`을 열면
**THE SYSTEM SHALL** Tauri IPC 호출이 오류 없이 처리되어야 한다.

**수용 조건:**
- `window.__TAURI__` 객체가 mock으로 주입됨
- Tauri invoke 호출이 silent하게 resolve됨 (콘솔 오류 없음)
- 모든 E2E 테스트에 fixture로 자동 적용됨

**배경:**
Vite dev server는 Tauri IPC를 지원하지 않는다. 앱은 `invoke('get_files')` 등을 호출하므로,
테스트 환경에서는 이를 mock하여 콘솔 오류를 억제해야 한다.

---

### REQ-E2E-003: 테이블 테두리 시각적 검증

**WHEN** 마크다운 에디터에 `e2e/fixtures/test-content.md` 내용을 로드하면
**THE SYSTEM SHALL** 미리보기 패널의 모든 테이블 셀(th, td)이 1px solid 테두리를 가져야 한다.

**수용 조건:**
- `getComputedStyle(td).borderRightWidth === '1px'`
- `getComputedStyle(td).borderBottomWidth === '1px'`
- `getComputedStyle(th).borderRightWidth === '1px'`
- 테이블 컨테이너(`div.table-scroll-wrapper`)가 `overflow-x: auto` 스타일을 가짐
- WebKit 브라우저에서 테스트 실행

**에디터 주입 방법:**
- `fs.readFileSync('./e2e/fixtures/test-content.md', 'utf-8')`로 픽스처 파일 읽기
- `page.locator('.cm-content').click()` + `Ctrl+A` + `fill(content)` 로 주입
- CodeMirror는 `contenteditable="true"`를 사용하므로 `fill()` 작동

**픽스처 파일 설계 (test-content.md):**
- 가로로 긴 테이블 (10컬럼 이상, 각 셀에 긴 텍스트)
- mermaid 다이어그램 (flowchart)
- 가로로 긴 코드 블록 (한 줄이 100자 이상)
- 긴 일반 텍스트 문단

---

### REQ-E2E-004: 앱 기본 렌더링 Smoke Test

**WHEN** 앱이 로드되면
**THE SYSTEM SHALL** 주요 UI 요소가 렌더링되어야 한다.

**수용 조건:**
- 페이지 제목이 존재함
- 에디터 영역이 존재함 (`.cm-editor` 또는 `[data-testid="editor"]`)
- 미리보기 패널이 존재함 (`.preview-content`)
- 페이지 로드 시 콘솔 오류 없음

---

### REQ-E2E-005: 마크다운 렌더링 시각적 검증

**WHEN** 마크다운 에디터에 내용을 입력하면
**THE SYSTEM SHALL** 미리보기 패널에 해당 HTML이 렌더링되어야 한다.

**수용 조건:**
- `# 제목` 입력 → `<h1>` 요소 렌더링됨
- `**굵게**` 입력 → `<strong>` 요소 렌더링됨
- 미리보기 업데이트가 입력 후 2초 이내에 완료됨

---

## 5. 파일 구조

```
markdown-editor-rust/
├── playwright.config.ts          # Playwright 설정 (새로 생성)
├── e2e/                          # E2E 테스트 디렉토리 (새로 생성)
│   ├── fixtures/
│   │   ├── tauri-mock.ts         # Tauri IPC mock fixture
│   │   └── test-content.md       # 테스트용 마크다운 픽스처 (새로 추가)
│   ├── table-border.spec.ts      # REQ-E2E-003 구현
│   ├── app-render.spec.ts        # REQ-E2E-004 구현
│   └── markdown-render.spec.ts   # REQ-E2E-005 구현
└── package.json                  # test:e2e 스크립트 추가
```

---

## 6. 구현 세부 사항

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  webServer: {
    command: 'npm run dev-vite',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },

  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

### e2e/fixtures/tauri-mock.ts

```typescript
import { test as base, Page } from '@playwright/test';

async function injectTauriMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__TAURI__ = {
      core: {
        invoke: () => Promise.resolve(null),
      },
      event: {
        listen: () => Promise.resolve(() => {}),
        emit: () => Promise.resolve(),
      },
    };
  });
}

export const test = base.extend<{ tauriPage: Page }>({
  tauriPage: async ({ page }, use) => {
    await injectTauriMock(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

### e2e/fixtures/test-content.md (픽스처 파일)

```markdown
# E2E 테스트 픽스처

## 가로 스크롤 테이블

| 이름 | 나이 | 직업 | 회사 | 부서 | 연락처 | 입사일 | 위치 | 등급 | 비고 |
|------|------|------|------|------|--------|--------|------|------|------|
| 홍길동 | 30 | 소프트웨어 엔지니어 | ACME Corporation | 백엔드 개발팀 | hong@example.com | 2020-01-15 | 서울특별시 강남구 | Senior | 재직 중 |
| 김철수 | 25 | UI/UX 디자이너 | Beta Company | 프로덕트 디자인 | kim@example.com | 2022-03-20 | 부산광역시 해운대구 | Junior | 재직 중 |

## Mermaid 다이어그램

\`\`\`mermaid
graph TD
  A[사용자 입력] --> B{마크다운 파싱}
  B --> C[HTML 렌더링]
  B --> D[미리보기 업데이트]
  C --> E[Shiki 하이라이팅]
  D --> F[스크롤 동기화]
\`\`\`

## 긴 코드 블록

\`\`\`typescript
const veryLongFunctionNameForTestingHorizontalScrollBehaviorInCodeBlocks = (param1: string, param2: number, param3: boolean): Promise<{ result: string; count: number }> => Promise.resolve({ result: param1, count: param2 });
\`\`\`
```

### e2e/table-border.spec.ts (핵심 테스트)

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';
import { test, expect } from './fixtures/tauri-mock';

const FIXTURE_CONTENT = readFileSync(
  join(__dirname, 'fixtures/test-content.md'),
  'utf-8'
);

test.describe('Table border rendering (REQ-E2E-003)', () => {
  test('td has visible right border (WebKit)', async ({ tauriPage }) => {
    await tauriPage.goto('/');
    // 픽스처 파일 내용을 CodeMirror contenteditable에 주입
    const editor = tauriPage.locator('.cm-content');
    await editor.click();
    await tauriPage.keyboard.press('ControlOrMeta+A');
    await editor.fill(FIXTURE_CONTENT);
    // 미리보기 렌더링 대기
    await tauriPage.waitForSelector('.preview-content td', { timeout: 5000 });
    // getComputedStyle로 테두리 검증
    const borderRight = await tauriPage.evaluate(() => {
      const td = document.querySelector('.preview-content td');
      return window.getComputedStyle(td!).borderRightWidth;
    });
    expect(borderRight).toBe('1px');
  });
});
```

---

## 7. 수용 기준 요약

| ID | 설명 | 검증 방법 |
|----|------|----------|
| AC-E2E-001 | `npm run test:e2e` 실행 성공 | 명령어 실행 |
| AC-E2E-002 | WebKit 브라우저로 테스트 실행 | playwright.config 확인 |
| AC-E2E-003 | Tauri IPC 콘솔 오류 없음 | 콘솔 오류 assertion |
| AC-E2E-004 | td.borderRightWidth === '1px' | getComputedStyle |
| AC-E2E-005 | th.borderRightWidth === '1px' | getComputedStyle |
| AC-E2E-006 | 앱 smoke test 통과 | .preview-content 존재 확인 |
| AC-E2E-007 | 마크다운 렌더링 E2E 통과 | h1, strong 요소 존재 확인 |

---

## 8. 리스크 및 대응

| 리스크 | 발생 조건 | 대응 |
|--------|----------|------|
| Tauri IPC 오류로 앱 렌더링 실패 | invoke() 에러 핸들링 없을 때 | tauri-mock으로 전역 mock |
| CodeMirror 에디터 선택자 불안정 | DOM 구조 변경 시 | data-testid 속성 추가 고려 |
| Vite 서버 cold start timeout | 첫 실행 시 | webServer.timeout: 60초 설정 |
| WebKit headless 렌더링 차이 | 헤드리스 모드 특성 | screenshot으로 디버깅 |

---

## 9. 구현 순서 (TDD RED-GREEN-REFACTOR)

1. **RED**: `@playwright/test` 설치 → `playwright.config.ts` 생성 → 테스트 실행 (실패 확인)
2. **GREEN**: Tauri mock fixture 생성 → 테스트 파일 작성 → 테스트 통과
3. **REFACTOR**: 공통 fixture 정리 → `package.json` scripts 정리

---

## 10. 참조 파일

- `src/lib/markdown/renderer.ts`: tableScrollPlugin (인라인 스타일 주입)
- `src/index.css:84-104`: .preview-content table CSS
- `vite.config.ts:14-31`: 서버 설정
- `src/test/renderer.test.ts`: 기존 단위 테스트 패턴

---

## 11. 구현 노트 (Implementation Notes)

**구현 완료일:** 2026-02-25

### 원안과 실제 구현의 차이

| 항목 | 원안 | 실제 구현 | 이유 |
|------|------|----------|------|
| 테이블 스크롤 방식 | 테이블별 `overflow-x: auto` wrapper | 패널 전체 `overflow: scroll !important` | 사용자가 패널 수준 단일 스크롤바 요구 |
| macOS 스크롤바 가시성 | 미언급 | `::-webkit-scrollbar` 커스텀 스타일 추가 | macOS WKWebView 오버레이 스크롤바 숨김 문제 |
| CSS 클래스 | `overflow-y-auto` | `overflow-auto preview-scroll` | 패널 수평+수직 통합 스크롤 지원 |

### 추가 생성 파일

- `.moai/learning/lesson-learned.md` - 디버깅 과정 교훈 문서 (한국어)
- `e2e/diagnostic.spec.ts` - 임시 진단용 파일 (향후 정리 대상)
- `vite.config.ts` - e2e/ 디렉토리를 Vitest 테스트 제외 목록에 추가

### 디버깅 인사이트

5회 반복 디버깅 끝에 도출한 핵심 교훈:

1. macOS WKWebView는 `overflow: auto`로 설정해도 스크롤바가 기본 숨김
2. `::-webkit-scrollbar` 커스텀 스타일로 가시성 강제 필요
3. `border-collapse: collapse` + 스크롤 컨테이너 = WebKit 테두리 클리핑 버그
4. Playwright WebKit 뷰포트(1280x720)와 실제 Tauri WKWebView 뷰포트 불일치 주의
5. 진단 오버레이 (DOM 상태 표시)가 실제 문제 파악에 결정적

참고: `.moai/learning/lesson-learned.md`
