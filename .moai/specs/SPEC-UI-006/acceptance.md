# SPEC-UI-006 — 수용 기준 (acceptance.md)

> development_mode = tdd. 이 SPEC은 **표현 계층 리스킨**이므로 수용 기준은 (1) 동작 무변경 불변식 회귀 방어와 (2) 신규 시각/브리지 검증으로 구성된다.
> **Must-pass**: AC-UI-006-001 (동작 무변경 diff 경계), AC-UI-006-002 (vitest 무변경/갱신), AC-UI-006-003 (E2E 셀렉터 보존), AC-UI-006-006 (테마 브리지), AC-UI-006-014 (드래그 리사이즈 보존 + 고정 grid 미적용).
> [HARD] 불변식: 이벤트 핸들러 / 스토어 로직 / Tauri IPC / CodeMirror 확장 / 마크다운 렌더링 / export 로직 / 스크롤 싱크 / 파일 IO **제로 변경**. 변경 = className/마크업(아이콘·라벨), CSS, 테마 이펙트 브리지 한 줄, 폰트 에셋, 아이콘 컴포넌트.

## 사전 준비

- **테마 테스트**: `useTheme` 렌더 후 `document.documentElement`의 `classList`와 `getAttribute('data-theme')`를 검사. `useUIStore.setState({ theme })`로 모드 주입. system 모드는 `window.matchMedia` mock 필요.
- **시각 검증**: Playwright에서 라이트/다크 각각 스크린샷 또는 대상 요소의 클래스/computed style 확인. 로컬 폰트 로드는 network 요청에 `fonts.googleapis.com`이 없음으로 검증.
- **diff 경계 검증**: `git diff --name-only`와 hunk 내용으로 변경이 허용 범위(className·CSS·아이콘·폰트·`useTheme.ts` 브리지)로 한정됨을 확인.
- **회귀 스위트**: 기존 vitest 전체 + Playwright(`e2e/app-render`, `markdown-render`, `html-file-viewer`, `table-border`, `mermaid-subgraph-label`).

---

## 기능 시나리오

### AC-UI-006-001: 동작 무변경 diff 경계 (REQ-UI-006-014) — must-pass

- **Given** 리스킨 구현 완료 후
- **When** `git diff`를 검토하면
- **Then** 변경 hunk가 다음으로 한정된다: className/마크업(아이콘 노드·라벨 텍스트), CSS 파일(`*.css`), 아이콘 컴포넌트(`src/components/icons/`), 폰트 에셋, `src/hooks/useTheme.ts`의 `data-theme` 브리지 한 줄
- **And** 이벤트 핸들러, 스토어(state/action) 로직, `src/lib/tauri/` IPC, CodeMirror 확장, 마크다운 렌더링, export 로직, 스크롤 싱크, 파일 IO 코드에는 로직 변경이 없다.

### AC-UI-006-002: 기존 vitest 통과 + 어서션 갱신 규칙 (REQ-UI-006-016) — must-pass

- **Given** 리스킨 완료 후
- **When** `npm run test`를 실행하면
- **Then** 전체 vitest 스위트가 통과한다
- **And** 이모지/글리프 리터럴(☀️/🌙/`|`/`A-` 등)에 의존하던 테스트는 접근성 마크업(`getByRole`/`aria-label`) 기반 어서션으로 갱신되었다
- **And** 갱신된 테스트의 **동작(behavior) 어서션은 약화되지 않았다**(호출/상태 전이 검증 유지).

### AC-UI-006-003: Playwright E2E + 셀렉터 보존 (REQ-UI-006-006) — must-pass

- **Given** 리스킨 완료 후
- **When** `e2e/` Playwright 스위트를 실행하면
- **Then** 전 스펙(app-render, markdown-render, html-file-viewer, table-border, mermaid-subgraph-label)이 통과한다
- **And** `data-testid`(`markdown-editor`, `html-preview-iframe`, `html-view-only-placeholder`, `unsupported-file-viewer`, `file-tree-node`), `role`, `aria-label` 셀렉터가 보존된다.

### AC-UI-006-004: 타입/린트 클린

- **Given** 리스킨 완료 후
- **When** `tsc --noEmit`와 eslint(`--max-warnings 0`)를 실행하면
- **Then** 타입 에러 0, 린트 에러/워닝 0 이다.

### AC-UI-006-005: CSS 로드 순서 + 루트 래핑 (REQ-UI-006-001, REQ-UI-006-002)

- **Given** 앱을 렌더하면
- **When** 로드된 스타일시트 순서와 DOM 루트를 확인하면
- **Then** `mdedit-tokens.css`가 `mdedit-components.css`보다 먼저 로드되고
- **And** 앱 루트 컨테이너가 `.md-root`와 `.md-app`(세로 3영역 셸) 클래스를 가진다.

### AC-UI-006-006: 테마 브리지 dark/light (REQ-UI-006-007, REQ-UI-006-008) — must-pass

- **Given** `useUIStore.setState({ theme: 'dark' })`로 `useTheme`를 렌더하면
- **Then** `document.documentElement`에 `.dark` 클래스가 있고 `getAttribute('data-theme') === 'dark'` 이다
- **And When** `useUIStore.setState({ theme: 'light' })`로 갱신하면
- **Then** `.dark` 클래스가 제거되고 `getAttribute('data-theme') === 'light'` 이다.

### AC-UI-006-007: system 모드 동기화 (REQ-UI-006-013)

- **Given** `theme: 'system'`이고 `matchMedia('(prefers-color-scheme: dark)')`가 dark로 mock된 상태에서 `useTheme`를 렌더하면
- **Then** `.dark`와 `data-theme="dark"`가 함께 설정되고
- **And When** matchMedia change 이벤트로 light로 전환하면
- **Then** `.dark`가 제거되고 `data-theme="light"`로 함께 갱신된다.

### AC-UI-006-008: 라이트/다크 전 surface 렌더 (REQ-UI-006-012)

- **Given** 앱을 라이트, 다크 각각으로 렌더하면
- **When** 타이틀바/사이드바/파일트리/에디터툴바/에디터/프리뷰/상태바를 확인하면
- **Then** 각 surface가 해당 테마의 `--md-*` 토큰 값으로 렌더된다(색 대비 깨짐·미적용 없음, 스크린샷/computed style 검증).

### AC-UI-006-009: 로컬 폰트 + 의존성 불변 (REQ-UI-006-004, REQ-UI-006-015)

- **Given** 앱을 로드하면
- **When** 네트워크 요청과 `package.json`을 확인하면
- **Then** 3종 폰트(Barlow, Barlow Condensed, IBM Plex Mono)가 로컬 에셋에서 로드되고 `fonts.googleapis.com` 런타임 요청이 없다
- **And** `package.json` dependencies/devDependencies에 신규 항목(`lucide-react`, 폰트 CDN 패키지 등)이 없다.

### AC-UI-006-010: 아이콘 전용 버튼 aria-label + Lucide SVG (REQ-UI-006-003)

- **Given** 리스킨된 헤더/툴바/사이드바를 렌더하면
- **When** 아이콘 전용 버튼(사이드바 토글, 테마 토글, 폰트 스테퍼, Export, 포맷 버튼 등)을 확인하면
- **Then** 각 버튼이 기존 텍스트 `aria-label`을 유지하며(`getByRole('button', { name })`로 도달 가능)
- **And** 렌더된 아이콘이 이모지/파이프/텍스트 글리프가 아닌 Lucide SVG(`stroke="currentColor"`)이다.

### AC-UI-006-011: 포커스 아웃라인 (REQ-UI-006-005)

- **Given** 인터랙티브 요소(버튼/토글/트리 행/검색 입력)를 렌더하면
- **When** 키보드로 포커스하면(`:focus-visible`)
- **Then** 2px `--md-accent` 아웃라인이 표시된다(브라우저 기본 아웃라인 아님).

### AC-UI-006-012: dirty 표시 (REQ-UI-006-011)

- **Given** 현재 문서가 dirty(미저장) 상태이면
- **When** 타이틀바와 상태 바를 확인하면
- **Then** 파일명 옆에 `--md-dirty` 점(`.md-dirty-dot`)이, 상태 바에 `.dirty` 항목이 표시된다(dirty 판정 로직은 무변경, 시각만).

### AC-UI-006-013: 테마 상태 머신 무변경 (REQ-UI-006-017)

- **Given** 기존 `src/test/useTheme.test.ts`를
- **When** 실행하면
- **Then** light/dark/system 상태·전이 검증이 무변경으로 통과한다(브리지 추가가 기존 동작을 깨지 않음).

### AC-UI-006-014: 드래그 리사이즈 보존 + 고정 grid 미적용 (REQ-UI-006-020) — must-pass

- **Given** 리스킨된 앱을 렌더하면
- **When** 본문 pane 스플리터를 드래그하면
- **Then** pane 크기가 기존과 동일하게 리사이즈된다(`ResizablePanels` 드래그-투-리사이즈 동작 보존)
- **And** `.md-app`/`.md-body`에 핸드오프 고정 grid 트랙(`232px 6px 1fr 6px 1fr`)이 적용되지 않는다(스플리터는 `.md-pane-divider`/`--md-divider-pane` 시각만 적용)
- **And** `ResizablePanels.tsx`의 드래그 핸들러/크기 상태 로직에 코드 diff가 없다.

---

## Edge Cases / 엣지 케이스

### EC-1: system 테마 전환 중 브리지 일관성

- system 모드에서 OS 다크모드 토글 시 `.dark`와 `data-theme`가 **항상 함께** 갱신되어 상태가 어긋나지 않는다(둘 중 하나만 바뀌는 순간 없음).

### EC-2: 매우 좁은 pane 폭에서 리사이즈

- 스플리터를 최소 폭 근처까지 드래그해도 기존 `ResizablePanels`의 최소/최대 제약이 그대로 동작한다(시각 토큰이 제약 로직에 영향 없음).

### EC-3: 폰트 로드 실패 시 폴백

- 로컬 woff2 로드 실패 시 `--md-font-*`의 폴백 체인(system-ui/ui-monospace 등)으로 안전하게 렌더되고 레이아웃이 깨지지 않는다.

### EC-4: 아이콘 색 상속

- 다크/라이트 전환 시 `stroke="currentColor"` 아이콘이 텍스트 색을 따라 자동 반전된다(하드코딩 색 없음).

### EC-5: SPEC-UI-005 statusMessage 트랜지언트 메시지 회귀

- Footer 리스킨 후에도 Copy Path/Name 성공/실패 트랜지언트 메시지(SPEC-UI-005)가 동일하게 표시·자동 clear 된다(동작 무변경).

---

## 품질 게이트 (Quality Gates)

- [ ] 모든 AC 시나리오(AC-UI-006-001 ~ 014) 검증됨.
- [ ] Must-pass AC(001, 002, 003, 006, 014) 모두 통과.
- [ ] `npm run test` 통과, 기존 테스트 회귀 없음.
- [ ] `tsc --noEmit` 클린, eslint `--max-warnings 0` 클린.
- [ ] 기존 Playwright E2E 전부 통과, 셀렉터 보존.
- [ ] `package.json` / `package-lock.json` 신규 의존성 없음.
- [ ] `src-tauri/` 변경 없음.
- [ ] 라이트/다크/system 전 surface 정상 렌더.
- [ ] @MX 태그 대상 파일에 ko 로 추가(파일당 3개 한도).

## Definition of Done

- 모든 EARS 요구사항(REQ-UI-006-001 ~ 020)이 구현·검증됨.
- acceptance.md 모든 AC 시나리오 통과.
- [HARD] 동작 무변경 불변식 유지: 이벤트 핸들러/스토어/IPC/CodeMirror/렌더/export/스크롤싱크/파일IO 코드 변경 없음.
- 드래그-투-리사이즈 보존, 핸드오프 고정 grid 미채택.
- TRUST 5 게이트 통과(Tested/Readable/Unified/Secured/Trackable).
- 신규 런타임 의존성·Rust 백엔드 변경 없음.
- 구현은 `feature/SPEC-UI-006-ui-reskin` 브랜치에서 revert-safe PR로 전달.
</content>
