# SPEC-E2E-001 인수 기준

## 인프라

- [ ] AC-E2E-001: `@playwright/test` devDependency 설치됨
- [ ] AC-E2E-002: `playwright.config.ts` 루트에 존재하며 WebKit 프로젝트 설정됨
- [ ] AC-E2E-003: `npm run test:e2e` 스크립트 `package.json`에 존재
- [ ] AC-E2E-004: `e2e/` 디렉토리 구조 생성됨

## Tauri Mock

- [ ] AC-E2E-005: `e2e/fixtures/tauri-mock.ts` 생성됨
- [ ] AC-E2E-006: E2E 테스트 실행 시 Tauri IPC 관련 콘솔 오류 없음

## 테이블 테두리 검증 (REQ-E2E-003)

- [ ] AC-E2E-007: `getComputedStyle(td).borderRightWidth === '1px'`
- [ ] AC-E2E-008: `getComputedStyle(td).borderBottomWidth === '1px'`
- [ ] AC-E2E-009: `getComputedStyle(th).borderRightWidth === '1px'`
- [ ] AC-E2E-010: `.table-scroll-wrapper`의 `overflow-x`가 `auto`임

## Smoke Test (REQ-E2E-004)

- [ ] AC-E2E-011: `.preview-content` 요소가 페이지에 존재함
- [ ] AC-E2E-012: `.cm-editor` 또는 에디터 영역이 존재함

## 마크다운 렌더링 (REQ-E2E-005)

- [ ] AC-E2E-013: `# 제목` 입력 후 `.preview-content h1` 존재함
- [ ] AC-E2E-014: 미리보기 업데이트가 2초 이내에 완료됨
