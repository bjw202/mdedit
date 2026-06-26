# Changelog

All notable changes to MdEdit are documented here.

## [Unreleased]

### Fixed
- **mermaid subgraph 제목 줄바꿈 (SPEC-PREVIEW-006)**:
  - 긴 한국어 subgraph(cluster) 제목이 mermaid의 하드코딩 `foreignObject width=200`(mermaid #6110) 때문에 2줄로 줄바꿈되던 문제를 patch-package로 해결 — 이제 1줄로 표시
  - cluster `rect` 렌더러의 `createText` 호출에 명시적 width 전달 (`patches/mermaid+11.12.3.patch`)
  - mermaid를 정확히 `11.12.3`으로 고정 + `postinstall`로 패치 결정론적 재적용
  - Playwright 가드 테스트로 1줄 표시·무겹침 검증 (버전 드리프트·패치 누락 시 자동 실패)
  - config-only / CSS·JS patchwork / ELK 대안은 검증 후 기각 (SPEC에 근거 기록)
  - 앱 소스 변경 없음, 신규 런타임 의존성 없음

---

## [0.6.0] - 2026-05-21

### Added
- **뷰 모드 토글 (SPEC-UI-004)**:
  - Header에 3-버튼 세그먼티드 토글(편집/분할/미리보기) 추가
  - Editor/Preview 영역을 split(기본값) / editor / preview 세 모드로 전환
  - 선택한 뷰 모드는 앱 재시작 후에도 복원(localStorage 자동 영속화)
  - `.html` 파일은 editor 모드에서 자동 미리보기 표시(렌더링 한정, store 값 보존)
  - 신규 `ViewModeToggle` 컴포넌트로 분리(ImageModeToggle 패턴 재사용)
  - 22개 신규 테스트 추가 (전체 테스트 448 통과)
  - 신규 의존성 없음

- **소스/설정 파일 제네릭 보기 (SPEC-PREVIEW-005)**:
  - 코드·데이터 파일 `.py`, `.js`/`.mjs`/`.cjs`, `.ts`, `.json`, `.jsonl`, `.yaml`/`.yml`, `.toml`, `.sh`/`.bash`, `.css`를 확장자 기반 라우팅으로 감지
  - 신규 `CodeFileViewer` 컴포넌트가 공유 Shiki 하이라이터로 구문 강조된 보기 전용 렌더링 제공
  - 에디터 버퍼 변경 시 300ms 디바운스로 라이브 재렌더
  - 다크/라이트 테마 자동 감지 및 연동 (`github-dark`/`github-light`)
  - 구문 강조 오류 또는 미지원 확장자 발생 시 안전한 텍스트 폴백 처리
  - 신규 의존성 없음 — 기존 Shiki 싱글톤 재사용
  - 79개 신규/확장 테스트 추가 (전체 테스트 424 통과)
  - `src/lib/preview/extensionLangMap.ts` + `src/components/preview/CodeFileViewer.tsx` 신규 작성
  - `PreviewContainer.tsx` 타입 확장 (`'code'` 분기 추가)
  - `src/lib/markdown/codeHighlight.ts` `toml` 언어 추가

### Fixed
- **미리보기 폰트 크기 축소/확대 (A-/A+) 통합**: 헤더의 A-/A+ 폰트 조절이 마크다운 미리보기의 헤딩·코드·표·이미지·간격을 zoom 배율로 함께 확대/축소하도록 통합
  - 이전: A-/A+ 버튼은 에디터만 확대/축소, 미리보기 헤딩과 코드는 고정 크기 적용 (인라인 코드, 표도 동일)
  - 현재: fontSize 설정을 CSS zoom = fontSize/14로 해석하여 미리보기 및 코드 뷰어에 동시 적용, 모든 요소가 브라우저 zoom처럼 비례 축소
  - 대상 파일: `src/lib/preview/previewZoom.ts` (신규), `MarkdownPreview.tsx`, `CodeFileViewer.tsx`, `src/index.css`, 관련 테스트 개선
  - `.html` iframe 뷰어와 에디터는 변경 없음
  - 신규 npm 의존성 없음 (456개 테스트 통과, 타입 체크 통과)

---

## [0.5.0] - 2026-05-19

### Added
- **독립 HTML 파일 보기 (SPEC-PREVIEW-004)**:
  - 사이드바 파일 트리에서 `.html` 파일 표시 및 선택 가능
  - 샌드박스 iframe (`sandbox="allow-scripts allow-same-origin"`)에서 보기 전용 렌더링
  - 같은 폴더의 외부 자산(CSS, 이미지)과 스크립트 정상 로드
  - Tauri asset 프로토콜 + 런타임 scope 등록으로 열린 폴더로만 접근 제한
  - 편집기 패널에는 "이 형식은 편집할 수 없습니다" 플레이스홀더 표시
  - 마크다운 렌더링 파이프라인에 미영향
- **사이드바 파일 익스플로러 `.md` 필터**: 마크다운 파일만 표시하도록 필터 적용
- **Playwright E2E 회귀 테스트**: `e2e/html-file-viewer.spec.ts`로 HtmlFileViewer 동작 검증
- **HTML 미리보기 샘플 4종**: `samples/html/`에 basic / rich-content / interactive 샘플 + README 추가

### Changed
- **HTML 파일 미리보기 5MB 임계 제거** (SPEC-PREVIEW-004 v1.3.0): Tauri asset 스트리밍 기반으로 변경되어 대용량 HTML도 미리보기 가능

### Fixed
- **Windows WebView2 CSP 차단 수정** (SPEC-PREVIEW-004 Windows 호환성):
  - Tauri v2 IPC(`ipc:`) 및 `tauri:` 호스트를 CSP `frame-src`에 허용
  - `frame-src`를 스킴 단위(`asset:`, `tauri:`, `https:` 등)로 광범위 허용해 Windows에서 iframe 차단 해소
  - iframe asset URL의 Windows 백슬래시(`%5C`) 인코딩을 슬래시로 정규화
  - `index.html` 메타 CSP를 Windows asset URL 차단 회귀에 맞춰 정정 (SPEC-PREVIEW-004 v1.3.1)
  - `directory_ops.rs` 보강으로 asset scope 등록 안정화
  - CSP 진단 과정에서 일시 비활성화했던 설정을 본 fix 이후 정상 복구

---

## [0.4.0] - 2026-04-01

### Added
- **KaTeX LaTeX 수식 렌더링 (SPEC)**
- **이미지 위젯 장식 (SPEC-IMG-WIDGET-001)**:
  - CodeMirror 6 ViewPlugin + WidgetType으로 inline-blob 이미지를 컴팩트 위젯으로 시각화
  - Data URI 이미지(`data:image/...;base64,...`) 자동 감지 및 위젯 렌더링
  - 위젯은 썸네일(최대 80px 높이), alt 텍스트, MIME 타입, 파일 크기 KB 단위 표시
  - 파일 경로(`./images/...`)나 HTTP URL(`https://...`)은 위젯 미적용 (Data URI만 처리)
  - 문서 변경 시 동적 업데이트 (이미지 붙여넣기, 삭제 등)
  - 위젯 클릭으로 원본 마크다운 텍스트 접근 가능
  - 다크/라이트 모드 테마 자동 적응 (CSS 변수 사용)
  - 32개 TDD 테스트 추가 (모두 통과)
- **이미지 삽입 모드 설정 (SPEC-IMG-MODE-001)**:
  - 기본값: 이미지 inline-blob 모드 (base64로 마크다운에 직접 임베드)
  - `Image` 드롭다운 메뉴로 Inline/File 모드 전환 가능
  - 선택한 모드는 localStorage에 자동 저장
- **이미지 지원 (SPEC-IMG-001)**:
  - 클립보드 붙여넣기(Cmd+V)로 이미지 삽입 → `images/` 폴더에 자동 저장
  - 툴바 이미지 버튼 또는 Cmd+Shift+I로 파일 다이얼로그 이미지 삽입
  - 이미지 파일 드래그앤드롭 지원 (복수 파일 처리)
  - 미저장 파일에서 이미지 삽입 시 Save As 자동 안내
  - 미리보기 패널에서 상대경로 이미지를 Tauri `asset:` 프로토콜로 렌더링
  - HTML 익스포트 시 로컬 이미지 base64 임베드 (self-contained HTML)
  - PDF 익스포트 시 `page-break-inside: avoid` CSS 적용
  - DOCX 익스포트 시 `ImageRun`으로 실제 이미지 바이너리 임베드
  - 경로 탐색 공격 방지 (`validate_path()` 검증), 이미지 크기 10MB 제한
- **File explorer with standard navigation UI**:
  - `..` parent directory entry at top of file list for quick parent navigation
  - Go Up (↑) button in sidebar header with parent path tooltip
  - Refresh button to reload directory contents after external changes
  - Search/filter input to find files within opened folder
- **File tree directory navigation**: click directory to navigate into it
- **File node serialization**: `FileNode` Rust model now serializes with `camelCase` JSON keys (`#[serde(rename_all = "camelCase")]`)
  matching TypeScript interface — fixes directory detection always returning `undefined`
- **Non-blocking file watcher**: File watcher (`startWatch`) runs non-blocking; watcher failure no longer prevents folder navigation
- Test suite: 192 tests passing (21 test files, frontend) + 78 tests passing (Rust backend)

### Fixed
- **Directory navigation bug**: Clicking a directory triggered `openFile` instead of `openFolderPath` because
  `node.isDirectory` was always `undefined` (Rust serialized `is_directory` instead of `isDirectory`)
- **Unhandled Promise rejection**: "Path is a directory, not a file" when clicking `.claude` folder
- **Test mock fix**: `openFolderPath` returned `undefined` instead of `Promise<void>`, causing `.catch()` errors
- **system 테마 export 정합성**: `system` 테마일 때 HTML/PDF/DOCX export가 항상 라이트 테마로 출력되던 버그 수정 — `window.matchMedia('prefers-color-scheme: dark')`로 실제 OS 다크 모드를 반영 (`AppLayout.tsx`)
- **파일 경로 이중 상태 불일치**: `Mod-Shift-s`, `Mod-Shift-i` 단축키 및 이미지 붙여넣기/드래그 핸들러에서 `fileStore.currentFile`이 갱신되지 않아 헤더 파일명이 구버전을 표시하던 버그 수정 (`MarkdownEditor.tsx`)
- **단축키 일관성**: `Mod-s`를 미저장 파일에서 실행 시 아무 동작도 하지 않던 문제를 수정 — 헤더 Save 버튼과 동일하게 Save As 다이얼로그로 연결 (`MarkdownEditor.tsx`)
- **`Mod-n` 단축키**: 새 문서 생성 시 `fileStore.currentFile`을 초기화하지 않아 헤더에 이전 파일명이 남던 버그 수정 (`MarkdownEditor.tsx`)

---

## [0.1.0] — Initial Implementation

### Added
- Tauri v2 + React 18 desktop application scaffold
- CodeMirror 6 Markdown editor with syntax highlighting
- Real-time Markdown preview via markdown-it 14
- Shiki 3 syntax highlighting for code blocks in preview
- Mermaid 11 diagram rendering (flowcharts, sequence, state, etc.)
- Zustand 5 state management (fileStore, uiStore)
- Resizable sidebar / editor / preview panels
- System dark/light theme support
- File explorer sidebar with context menu (New File, New Folder, Rename, Delete)
- Rust backend file operations: read, write, create, delete, rename
- Path traversal attack prevention in all Rust file commands
- File watcher integration for external change detection
- Lazy directory loading (children fetched on first expand)
- Header with font size controls and theme toggle
- Footer with cursor position, line count, and encoding info
- Full test suite: Vitest (frontend) + cargo test (Rust backend)
