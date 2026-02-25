# SPEC-E2E-001 Research: Playwright E2E Testing Setup

## 1. Problem Statement

현재 Vitest + jsdom 기반 단위 테스트는 시각적 렌더링 버그를 감지할 수 없다.

### 근본 원인

| 테스트 계층 | CSS 처리 | 레이아웃 계산 | 오버플로 클리핑 |
|------------|----------|--------------|----------------|
| Vitest (jsdom) | 없음 | 없음 | 없음 |
| Playwright (WebKit) | 완전 | 완전 | 완전 |

구체적 버그: `border-collapse: collapse` + `overflow-x: auto` 조합에서
WebKit이 스크롤 컨테이너 경계의 오른쪽 테두리를 클리핑함.

## 2. 현재 프로젝트 상태

### 테스트 환경
- Vitest v2.0.0 (jsdom 환경)
- `src/test/` 디렉토리에 27개 테스트 파일
- `vite.config.ts`에 테스트 설정 포함
- `@playwright/test` 미설치

### Playwright 글로벌 설치 상태
```
playwright v1.58.2 (globally installed)
WebKit browser: webkit-2248 (cached at ~/.cache/ms-playwright)
```

### Vite 개발 서버
- Port: 1420 (tauri dev 또는 npm run dev-vite)
- `strictPort: true` 설정됨
- `Cache-Control: no-store` 헤더 추가됨

## 3. 기술적 접근법 선택

### Method A: Playwright + Vite dev server (선택)

**장점:**
- Tauri IPC 없이 프론트엔드만 독립 테스트 가능
- `webServer` 옵션으로 자동 서버 시작
- WebKit 브라우저 엔진 = WKWebView와 동일한 렌더링
- CI/CD 파이프라인에서 실행 가능

**단점:**
- Tauri IPC 호출 → 오류 발생 (mock 필요)
- 실제 파일시스템 접근 불가

### Method B: tauri-driver (미선택)

**이유:** 설정 복잡도 높음, tauri-driver는 Tauri v1용 도구.
Tauri v2는 공식 E2E 지원 미완성 상태.

## 4. 핵심 구현 패턴

### playwright.config.ts 설계
```typescript
// webServer: Vite dev server 자동 시작
// project: WebKit 단일 엔진
// baseURL: http://localhost:1420
// timeout: 30초 (Vite cold start 고려)
```

### Tauri IPC Mock 전략
```typescript
// e2e/fixtures/tauri-mock.ts
// window.__TAURI__ 객체를 브라우저 컨텍스트에서 mock
// page.addInitScript()로 모든 테스트에 자동 주입
```

### 테이블 테두리 검증 방법
```typescript
// getComputedStyle(td).borderRightWidth === '1px'
// getBoundingClientRect()로 레이아웃 검증
// 스크롤 가능 여부 확인
```

## 5. 파일 구조 계획

```
e2e/
  fixtures/
    tauri-mock.ts       # Tauri IPC mock
  table-border.spec.ts  # 테이블 테두리 E2E 테스트
  app-render.spec.ts    # 앱 기본 렌더링 테스트
playwright.config.ts    # Playwright 설정
```

## 6. 의존성

```json
{
  "devDependencies": {
    "@playwright/test": "^1.50.0"
  }
}
```

## 7. 참조

- `src/lib/markdown/renderer.ts`: tableScrollPlugin (인라인 스타일 주입)
- `src/index.css`: .preview-content table, th, td CSS
- `vite.config.ts`: 서버 설정 (port: 1420)
- `src/test/renderer.test.ts`: 현재 단위 테스트 패턴
