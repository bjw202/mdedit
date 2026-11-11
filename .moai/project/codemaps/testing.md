# 테스트 아키텍처 - MdEdit v0.21.0

> **Last Updated**: 2026-11-10 | **Version**: 0.21.0
> **Frontend**: Vitest 2 + jsdom 28 + Testing Library | **E2E**: Playwright 1.58 (webkit) | **Backend**: cargo test

이 문서의 개수는 파일 목록과 grep으로 센 값입니다. 테스트를 직접 실행해 통과를 확인한 값이 아닙니다.

## 테스트 구성 한눈에 보기

| 계층 | 위치 | 규모 (grep 기준) | 실행 |
|------|------|------------------|------|
| 프런트 단위·컴포넌트 | `src/test/` | 테스트 파일 118개 + `setup.ts` | `npm test` (`vitest run`) |
| 릴리스 스크립트 | `scripts/check-release-version.test.mjs` | `it()` 15개 | `npm test`에 함께 포함 (기본 include 패턴, 실행해서 확인하지는 않음) |
| 브라우저 E2E | `e2e/` | spec 21개, `test(` 호출 73개 | `npm run test:e2e` |
| Rust 단위 | `src-tauri/src` 아래 소스 22개 파일 안의 `#[cfg(test)]` | `#[test]` 313 + `#[tokio::test]` 58 = 371 | `cargo test` |
| Rust 통합 | `src-tauri/tests/` | 11개 (ACL 3, charset 8) | `cargo test` |

CI(`frontend-gates.yml`)의 단계 이름에는 "vitest, 1405 tests", "Playwright webkit, 56 tests"라고 적혀 있습니다. 위 grep 집계(E2E 73개)와 맞지 않으므로 단계 이름의 숫자는 낡았을 가능성이 있습니다. 어느 쪽이 현재 값인지는 테스트를 실행해야 확인할 수 있습니다.

## Vitest 설정 (`vite.config.ts`의 test 블록)

별도 `vitest.config.ts`는 없고 `vite.config.ts` 안에 있습니다.

- `environment: "jsdom"`, `globals: true`, `setupFiles: ["./src/test/setup.ts"]`
- `exclude`: `**/e2e/**`, `**/node_modules/**`
- `poolOptions.forks.execArgv`: `--max-old-space-size=4096` (메모리 상한)
- 커버리지 설정은 없습니다.
- 앱 빌드와 공유하는 별칭: `@` → `./src`

`src/test/setup.ts`가 넣는 jsdom 보조 설정:

| 항목 | 내용 |
|------|------|
| `@testing-library/jest-dom` | 매처 확장 |
| `window.matchMedia` | `matches: false`를 돌려주는 `vi.fn()` 스텁 (node 환경 테스트도 이 파일을 읽으므로 `typeof window` 가드 있음) |
| `navigator.clipboard` | `writeText`가 `vi.fn()` (재정의 가능) |
| `Element.prototype.scrollIntoView` | 없으면 빈 함수 |

`setup.ts`는 `@tauri-apps/*`를 전역으로 모킹하지 않습니다. 각 테스트 파일이 자기 `vi.mock`을 가집니다.

## Vitest 테스트 그룹 (`src/test/`)

| 그룹 | 개수(대략) | 대표 파일 |
|------|-----------|----------|
| 컴포넌트 | 약 33 | `src/test/FileExplorer.test.tsx`, `src/test/MarkdownEditor.test.tsx`, `src/test/HtmlFileViewer.test.tsx`, `src/test/SettingsModal.test.tsx`, `src/test/EditorToolbar.test.tsx` |
| HTML 미리보기 | 4+ | `src/test/HtmlFileViewerCrisp.test.tsx`, `src/test/HtmlFileViewerOsMode.test.tsx`, `src/test/htmlSrcdoc.test.ts`, `src/test/htmlSrcdocCsp.test.ts`, `src/test/htmlMermaid.test.ts`, `src/test/htmlZoom.test.ts` |
| 스토어 | 5 | `src/test/aiStore.test.ts`, `src/test/editorStore.test.ts`, `src/test/fileStore.test.ts`, `src/test/uiStore.test.ts`, `src/test/uiStoreRenderMode.test.ts` |
| 훅 | 6 | `src/test/useFileSystem.test.ts`, `src/test/useFileWatcher.test.ts`, `src/test/usePreview.test.ts`, `src/test/useScrollSync.test.ts`, `src/test/useTheme.test.ts`, `src/test/useUnsavedChangesGuard.test.tsx` |
| AI | 약 29 | `src/test/aiSuggestionCard.test.ts`, `src/test/aiGhostConfirm.test.ts`, `src/test/aiRelay.test.ts`, `src/test/aiCardWatchdog.test.ts`, `src/test/aiIntegration.test.tsx`, `src/test/aiLengthGuard.test.ts` |
| 라이브러리 | 다수 | `src/test/renderer.test.ts`, `src/test/diagramRenderer.test.ts`, `src/test/exportHtml.test.ts`, `src/test/exportDocx.test.ts`, `src/test/exportPdf.test.ts`, `src/test/exportImageEmbed.test.ts`, `src/test/imageHandler.test.ts`, `src/test/imageResolver.test.ts`, `src/test/svgSanitize.test.ts`, `src/test/saveDocument.test.ts`, `src/test/previewLimits.test.ts`, `src/test/longLineFold.test.ts`, `src/test/mermaidValidate.test.ts`, `src/test/tableValidate.test.ts` |
| SPEC 이름 테스트 | 11 | `src/test/SPEC-FS-004-external-open.test.ts`, `src/test/SPEC-FS-004-external-open-flow.test.tsx`, `src/test/SPEC-PREVIEW-007.test.tsx`, `src/test/specImgLoadBFileSystem.test.ts` 등 |

SPEC 번호를 파일 이름이나 `@MX:SPEC` 주석으로 단 테스트가 많습니다 (`MX:SPEC` 포함 파일 67개).

### 계약·회귀 방지 테스트 (UI가 아니라 저장소 파일을 읽어 불변식을 지킴)

| 파일 | 지키는 것 |
|------|----------|
| `src/test/appCommandAcl.contract.test.ts` | `src/` 안 비테스트 코드의 `invoke('이름')` 리터럴이 전부 `src-tauri/app_commands.rs`의 `APP_COMMANDS`에 있는지 확인. 변수로 넘기는 `invoke(변수)`는 이 정적 검사가 잡지 못함 |
| `src/test/diagramRegressionGuard.test.ts` | 새 런타임 의존성 없음, 프리셋 정확히 8개, `markdownKeyBindings` 불변 |
| `src/test/aiDiagramTypeRegressionGuard.test.ts` | npm·cargo 런타임 의존성 증가 없음, 팝오버 라이브러리 금지, 하위 메뉴 8항목, pele 1.10.0 핀 유지 |
| `src/test/exportOpenRegressionGuard.test.ts` | `src-tauri/capabilities/main.json`의 opener 권한 유지, 핸들러 목록 불변 |
| `src/test/image-widget.regression.test.ts` | 뷰포트 기반 데코레이션 변경 뒤에도 이미지 위젯 요구사항 유지, `doc.toString()` 미사용 |
| `src/test/viteFontInline.test.ts` | 글꼴 파일을 base64로 인라인하지 않음 (CSP에 `font-src`가 없어 `data:` 글꼴이 막히기 때문, SPEC-SEC-002) |
| `src/test/infrastructure.test.ts` | ESM·globals·jsdom 기본 동작 |

### 고정 픽스처: pele 다이어그램 (`src/test/fixtures/pele/`)

실제 pele 1.10.0로 캡처한 SVG 쌍(`*.raw.svg`, `*.sanitized.svg`)과 `manifest.json`입니다.

| 폴더 | 내용 | 비교 방식 |
|------|------|----------|
| `src/test/fixtures/pele/m1-frozen` | 1차 jsdom 캡처, `rtrue`/`rfalse` 변형, 고정(재캡처 금지) | 고정 기준선 |
| `src/test/fixtures/pele/unit` | 운영 옵션으로 vitest jsdom에서 재캡처 | 바이트 단위 비교 |
| `src/test/fixtures/pele/browser` | WebKit에서 캡처 | 구조 검사만 (수식은 `getBoundingClientRect`로 측정) |

`src/test/diagramRenderer.test.ts`가 이 픽스처와 실제 pele를 사용하고, E2E의 `e2e/diagram-preview-behavior.spec.ts`, `e2e/mermaid-subgraph-label.spec.ts`도 같은 폴더를 참조합니다.

### 모킹 패턴

| 대상 | 빈도 | 설명 |
|------|------|------|
| `@/lib/tauri/ipc` | 41곳 | 타입이 있는 IPC 래퍼 계층이 가장 흔한 모킹 경계 |
| `@tauri-apps/api/core` (`invoke`) | 28곳 | 래퍼를 거치지 않는 직접 호출 테스트 |
| `@tauri-apps/api/event` | 10곳 | 이벤트 `listen` 모킹 |
| `@tauri-apps/plugin-opener` | 2곳 | |
| `pele`, `docx`, `shiki` | 4 / 3 / 2곳 | 무거운 라이브러리 대체 |
| `@codemirror/*` | 각 3곳 | |

`mockIPC` 같은 `@tauri-apps/api/mocks`는 어디에서도 쓰지 않습니다.

## Playwright E2E (`e2e/`)

`playwright.config.ts` 요점:

- `testDir: ./e2e`, 제한 시간 30초, `retries: 1`, 리포터 `list` + `html`(열지 않음)
- `webServer`: `npm run dev-vite`를 띄우고 `http://localhost:1420`을 기다림 (CI가 아니면 기존 서버 재사용)
- `use`: `trace: on-first-retry`, `screenshot: only-on-failure`
- 프로젝트는 `webkit`(Desktop Safari) 하나
- 실제 Tauri가 아니라 Vite 개발 서버 위에서, Tauri IPC를 모킹해 실행합니다.

### 모킹 픽스처

| 파일 | 역할 |
|------|------|
| `e2e/fixtures/tauri-mock.ts` | 가상 파일 시스템을 가진 Tauri IPC 모킹. `read_directory`, `read_file`, `write_file`, `save_file_as`, `start_watch`, `stop_watch`, `register_asset_scope` 내장. 모르는 커맨드는 기본(graceful)이면 null, strict면 예외. `seedFs`, `injectExportStubs`(내보내기·opener 호출 기록) 제공 |
| `e2e/fixtures/tauri-v2-ai-mock.ts` | AI용 고충실도 v2 모킹. `ai_request`는 최상위 `args` 키가 없으면 거부(실제 Rust와 동일). `window.__AI_MOCK__.scenario`로 success, login-error, network-error, invoke-reject, hang, diagram-fenced-then-valid 시나리오를 고름 |
| `e2e/fixtures/test-content.md` | 렌더 테스트용 공용 마크다운 |

### spec 목록 (21개)

| spec | 다루는 것 |
|------|----------|
| `e2e/app-render.spec.ts` | 앱 기본 렌더, 입력 뒤 미리보기 |
| `e2e/markdown-render.spec.ts` | 제목·표·다이어그램 렌더, 느슨한 목록 기하 |
| `e2e/table-border.spec.ts` | WebKit 표 테두리 기하 |
| `e2e/pane-resize.spec.ts` | 패널 구분선 드래그 |
| `e2e/unsaved-changes-guard.spec.ts` | 저장 안 한 변경 모달 |
| `e2e/post-export-dialog.spec.ts` | 내보내기 완료 모달 |
| `e2e/html-file-viewer.spec.ts` | HtmlFileViewer iframe과 asset src |
| `e2e/image-svg-viewer.spec.ts` | 이미지·SVG 뷰어 |
| `e2e/diagram-preview-behavior.spec.ts` | 테마를 바꿔도 같은 SVG 노드 유지, 링크·외부 이미지 없음 |
| `e2e/diagram-export-colors.spec.ts` | 내보내기 색이 고정 팔레트에서 나옴 |
| `e2e/diagram-shape-tone.spec.ts` | 모양 기반 자동 톤, 에지 라벨 이음새 |
| `e2e/mermaid-subgraph-label.spec.ts` | 서브그래프 제목이 한 줄 |
| `e2e/ai-inline-edit.spec.ts` | 선택 툴바, 프리셋 메뉴, 스트리밍, 제안 적용, 오류 |
| `e2e/ai-006.spec.ts` | 재요청, 이어쓰기 길이, 긴 대기 안내 |
| `e2e/ai-free-continue.spec.ts` | 자유 위치 이어쓰기 |
| `e2e/ai-toggle.spec.ts` | AI 켜기·끄기 |
| `e2e/ai-008-diagram-submenu-flip.spec.ts` | 다이어그램·표 메뉴가 에디터 창 안에서 뒤집힘·고정 |
| `e2e/spec-img-load-001.spec.ts` | 인라인 이미지 모드의 Save-As 생략, 큰 파일 처리 |
| `e2e/spec-img-load-002.spec.ts` | 4MB `.md` 입력 지연, 긴 base64 줄 뷰포트 처리 |
| `e2e/spec-img-mode-003.spec.ts` | 지연 Save-As, 드롭 게이트, 10MB 초과 토스트 |
| `e2e/spec-img-widget-002.spec.ts` | 거대한 base64 줄의 이미지 위젯 |

## Rust 테스트

`cargo test`는 `src-tauri/` 매니페스트 기준으로 실행합니다.

| 위치 | 개수 | 내용 |
|------|------|------|
| `src-tauri/src/ai/prompt.rs` | 52 | 프롬프트 조립, 문단 경계 자르기, 스냅샷 |
| `src-tauri/src/ai/detect.rs` | 37 | 바이너리 경로 탐색, 로그인 판정 |
| `src-tauri/src/ai/stream.rs` | 35 | 스트림 파서, stderr 분류 |
| `src-tauri/src/ai/claude_cli.rs` | 31 | 인자 구성, 중계, 종료 선점 |
| `src-tauri/src/ai/codex_cli.rs` | 27 | codex 인자·중계 |
| `src-tauri/src/commands/file_ops.rs` | 73 (`#[test]` 41 + `#[tokio::test]` 32) | 파일 CRUD, 경로 검증 |
| `src-tauri/src/commands/image_ops.rs` | 42 (23 + 19) | 이미지 저장·읽기 |
| `src-tauri/src/commands/directory_ops.rs` | 21 (14 + 7) | 목록, 경로 정규화 |
| `src-tauri/tests/app_acl.rs` | 3 | 핸들러·APP_COMMANDS·capability 일치, `remote` 키 없음 |
| `src-tauri/tests/asset_charset.rs` | 8 | charset 패치 판정, vendor 사본 사용 여부 |

그 밖에 `src-tauri/src/commands/watcher.rs`, `src-tauri/src/commands/file_open.rs`, `src-tauri/src/state/app_state.rs`, `src-tauri/src/models/`, `src-tauri/src/lib.rs`, `src-tauri/src/process_util.rs`에도 단위 테스트가 있습니다. 비동기 커맨드는 `AppHandle`이 필요해 순수 보조 함수 위주로 검증합니다. `#[tokio::test]`가 있는 파일은 위 세 파일뿐입니다. `src-tauri/vendor/tauri`에 자체 테스트나 CI가 있는지는 확인하지 않았습니다.

## 스크립트

| 파일 | 역할 |
|------|------|
| `scripts/prebuild.mjs` | npm `prebuild` 훅. Windows에서만 `cargo clean`을 실행하고 `SKIP_CARGO_CLEAN=1`이면 건너뜀 |
| `scripts/check-release-version.mjs` | 릴리스 태그(`vX.Y.Z`)와 `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`의 버전 일치 검사, 이전 태그 계산 |
| `scripts/check-release-version.test.mjs` | 위 스크립트의 테스트 15개 (임시 폴더 사용) |

## CI 워크플로 (`.github/workflows/`)

### `.github/workflows/frontend-gates.yml` — Frontend Quality Gates

- 트리거: `pull_request`, `main` 푸시. 같은 ref의 이전 실행은 취소.
- 작업 하나(`quality-gates`), `macos-latest`, 제한 20분. E2E 단언이 macOS WebKit 픽셀 기하에 맞춰져 있어 macOS를 씁니다.
- 순서: checkout → Node 24 + npm 캐시 → `npm ci` → Playwright 버전 확인 → webkit 브라우저 캐시 → `npx playwright install webkit`(캐시 미스일 때) → `npm run lint` → `npm run typecheck` → `npm test` → `npm run test:e2e` → 실패 시에만 `playwright-report/`, `test-results/` 업로드(7일 보관)
- Rust는 의도적으로 범위 밖입니다. 워크플로 어디에서도 `cargo test`를 돌리지 않으므로 Rust 테스트는 로컬에서만 실행됩니다.

### `.github/workflows/release.yml` — Release (SPEC-INFRA-002)

- 트리거: `v숫자.숫자.숫자` 형태의 태그 푸시(프리릴리스 태그는 제외).
- 작업 3개:
  1. `version-check` (ubuntu): 태그와 세 설정 파일 버전 일치 검사, `tag`/`version`/`previous_tag` 출력
  2. `create-release` (ubuntu, `needs` 1번): 같은 태그의 릴리스가 이미 있으면 실패, 자동 노트 앞에 `.github/release-notes-header.md`를 붙여 **초안(draft)** 릴리스 생성
  3. `build` (`needs` 2번, 제한 60분, `fail-fast: false`): macOS(`aarch64-apple-darwin`)와 Windows 행렬로 `tauri-apps/tauri-action`(커밋 SHA 고정)이 산출물을 초안 릴리스에 업로드
- lint·tsc·vitest·Playwright 게이트는 이 워크플로에 없습니다 (PR 단계에서 `frontend-gates.yml`이 담당).
- 게시는 수동입니다. 서명·공증 시크릿은 워크플로에 없습니다. `src-tauri/tauri.conf.json`의 번들 대상과 서명 설정이 산출물을 정확히 어떻게 정하는지는 확인하지 않았습니다.

## ESLint (`.eslintrc.cjs`)

ESLint 8 eslintrc 형식. `eslint:recommended` + `@typescript-eslint/recommended` + `react-hooks` 권장 규칙. `no-unused-vars`는 오류이며 `_` 접두사를 예외로 둡니다. `dist`, `src-tauri`, `playwright-report` 등과 `*.config.*`는 제외하고, `npm run lint`는 `--max-warnings 0`으로 `e2e/`와 `src/`를 검사합니다.

## 실행 방법

```bash
npm test                 # vitest run (src/test, scripts/*.test.mjs)
npm run typecheck        # tsc --noEmit
npm run lint             # eslint, 경고 0 허용
npm run test:e2e         # Playwright (webkit, dev 서버 자동 기동)
cd src-tauri && cargo test   # Rust 단위 + 통합 (CI에는 없음)
```

## 알려진 공백

- 로컬에서 위 명령을 실행해 통과를 확인하지 않았습니다. 이 문서의 숫자는 정적 집계입니다.
- Rust는 CI에서 검증되지 않고, E2E는 실제 Tauri 창이 아니라 모킹된 IPC 위에서 돕니다. macOS·Windows 실기기에서의 동작은 수동 확인 영역입니다.
