# Changelog

All notable changes to MdEdit are documented here.

## [Unreleased]

### Added
- **AI 인라인 편집·섹션 채우기 (SPEC-AI-001, 로컬 Claude Code CLI 기반)**:
  - ✨ 선택 툴바: 텍스트 선택 시 ✨ 버튼 → 프리셋 6종(🖊 다듬기, 📋 개요로 정리, 📊 표로 만들기, 🧜 다이어그램으로(mermaid — 사전 검증·자동 재요청·목록 폴백), ✂️ 짧게 줄이기, ✏️ 직접 입력)
  - 제안 카드: 실시간 스트리밍 → 검토 → 바꾸기/아래 삽입, Cmd+Z 1회 복원, ↻ 다시/직접 지시 재요청, 고급 모델(sonnet) 토글
  - 섹션 채우기: 빈 헤딩 아래 빈 줄에서 Cmd+Enter(또는 3초 멈춤 힌트 클릭) → 회색 고스트 스트리밍 → Cmd+Enter 확정 / Esc 버리기, [✓ 넣기]·[✕ 지우기]·[■ 중지] 버튼
  - 문서 끝 이어쓰기: 문서 끝 빈 줄에서 Cmd+Enter 또는 "✨ 이어쓰기" 힌트로 문체 상속 이어쓰기
  - 전제: 로컬 Claude Code CLI(`claude`) 설치·로그인 필요, 설정 모달(헤더 톱니)에서 연결 상태 확인, 미로그인 시 온보딩 안내, 조직 정책 kill-switch(`MDEDIT_AI_DISABLED=1` 또는 정책 파일) 지원
  - 프라이버시: 문서 내용은 로컬 CLI를 통해서만 전송, 앱 자체 서버 없음, 요청당 CLI 프로세스 1개·동시 1개 처리
- **AI 작업 중 로딩 인디케이터 (SPEC-AI-002)**: 제안 카드에 글로우 그라데이션 테두리 + shimmer 스켈레톤, 고스트 텍스트에 "✨ 작성 중…" 펄스 애니메이션, `prefers-reduced-motion` 설정 시 정적 표시로 대체
- **에디터 툴바 표 삽입 (SPEC-UI-007)**: 툴바에 표 삽입 버튼 + 8×8 그리드 피커 팝오버 추가 — 셀 호버 시 "행 × 열" 크기 라벨과 하이라이트 표시, 클릭 시 헤더/구분 행 포함 markdown 표 스켈레톤을 커서 위치에 삽입하고 첫 헤더 셀 선택 상태로 포커스 복귀 (#11)

---

## [0.8.0] - 2026-07-16

### Added
- **이미지·SVG 뷰어 (SPEC-PREVIEW-008)**:
  - `ImageFileViewer`(png/jpg/gif/webp/bmp/ico/avif): `asset://` 로드, zoom/pan, 체커보드 배경, 픽셀·용량 메타 표시
  - `SvgFileViewer`: 렌더↔소스 토글, DOMPurify SVG 프로파일 sanitize
  - 마크다운 내 인라인 `<svg>`: placeholder-restore + DOMPurify 복원(`html:false` 유지)
- **Mermaid 다이어그램 라이트/다크 테마 연동 (SPEC-PREVIEW-010)**:
  - mermaid 다이어그램 테마가 앱 라이트/다크 모드를 따라감(dark→`dark`, light→`default`)
  - 테마 토글 시 이미 렌더된 다이어그램도 라이브 재채색(SVG 색이 baked되므로 재초기화+재렌더)
  - `securityLevel: 'strict'`는 베이스 상수화로 약화 차단, `system` 모드는 OS `prefers-color-scheme` 변경에 반응

### Fixed
- **코드 파일 미리보기 배경을 앱 서피스에 맞춤**: Shiki 인라인 배경을 투명화해 컨테이너 배경 상속(라이트/다크 정합)
- **사이드바 접기 토글과 헤더 겹침 해소**
- **파일 탐색기 상위 폴더 화살표 아이콘 광학 정렬 수정**
- **인라인코드 `<svg>` 언급이 실제 SVG 추출을 막던 버그 수정 (SPEC-PREVIEW-008)**
- **Windows: 작업표시줄에 옛 아이콘이 표시되던 문제**: 실행 시 모든 창에 `set_icon`(WM_SETICON)으로 아이콘을 직접 세팅해 AppUserModelID별 셸 iconcache를 덮어씀 (tauri `image-png` feature 추가)
- **Windows: 릴리즈 빌드에서 바뀐 아이콘이 .exe에 재임베드되지 않던 문제**: `build.rs`에 아이콘·설정 파일 `cargo:rerun-if-changed` 등록으로 아이콘 변경 시 리소스 자동 재임베드

---

## [0.7.0] - 2026-07-15

### Changed
- **UI 디자인 시스템 리스킨 (SPEC-UI-006)**:
  - Claude Design 핸드오프(steel-blue 디자인 시스템)를 채택한 전체 UI 리스킨 — 헤더·푸터·사이드바·에디터·프리뷰 표면의 시각 스타일 전면 교체
  - 시맨틱 디자인 토큰 CSS(`mdedit-tokens.css`) + 컴포넌트 클래스 CSS(`mdedit-components.css`) 도입, 라이트/다크 테마 정비
  - 이모지·리터럴 파이프 아이콘을 인라인 SVG 아이콘(Lucide 기반)으로 교체
  - Barlow / Barlow Condensed / IBM Plex Mono 로컬 웹폰트 번들(오프라인 데스크톱 앱, 신규 런타임 의존성 없음)
  - `useTheme`에 `data-theme` 테마 브리지 추가
  - 앱 아이콘 교체: 기존 밝은 파란 M 스퀘어클 → 다크 나이트 타일 + 흰색 해시(#) + steel-blue 연필. Codex로 SVG 디자인, `tauri icon`으로 전체 세트(PNG/icns/ico/android/ios) 재생성. 새 디자인 시스템과 톤 통일.
  - 동작 로직(Tauri IPC, export, CodeMirror extensions, store) 무변경 — 표현 계층만 변경

---

## [0.6.3] - 2026-07-15

### Fixed
- **폴더 이름의 연속 점('..')으로 폴더가 열리지 않던 문제**:
  - 경로 검증 가드가 `path.contains("..")` 부분 문자열 검사를 사용해, 이름에 연속된 점이 포함된 정상 폴더(예: `...오징어게임..-시장...`)를 경로 탈출로 오탐하여 폴더 열기·파일 작업을 차단하던 문제 수정
  - `validate_path`(모든 파일/디렉터리 IPC 경유)와 `canonicalize_folder_path`(asset scope 등록)를 경로 컴포넌트 단위 `Component::ParentDir` 판정으로 교체
  - 이름 내부의 `..`는 허용하고 실제 `../` 경로 탈출만 차단 — 보안 무손상(기존 탈출 거부 테스트 유지)
  - 회귀 방지 단위 테스트 2건 추가, 실제 폴더 경로 통합 검증 통과 (command 테스트 76 통과)
  - 앱 소스(프론트엔드) 변경 없음, 신규 의존성 없음

---

## [0.6.2] - 2026-06-26

### Changed
- **파일 탐색기 전체 파일 노출 (SPEC-PREVIEW-007)**:
  - 확장자 allowlist 필터 제거 — 폴더의 모든 파일(dotfile·확장자 없는 파일 포함)과 디렉터리를 노출 (SPEC-PREVIEW-004/005의 필터 동작 대체)
  - 인식 안 되는 텍스트 파일(`.gitignore`, `.rs`, `.log`, `.csv` 등)은 평문으로 표시 + 편집 가능
  - 바이너리/읽기 불가 파일(`.png`, `.pdf`, `.zip` 등)은 "미리보기 불가" 플레이스홀더 표시, 편집기에 로드하지 않음 (신규 `UnsupportedFileViewer`)
  - 대용량 파일(5MB 초과)은 전체 로드 없이 "미리보기 건너뜀" 안내 (`FileNode.size` 기반 사전 가드)
  - `.md`/`.markdown`은 항상 마크다운으로 렌더 — 평문 폴백 회귀 방지
  - 모든 파일 클릭이 예외 없이 안전하게 처리됨(이전 "모든 파일 노출 시 깨짐" 버그 해소)
  - Rust 변경 없음, 신규 런타임 의존성 없음, 55개 테스트 추가 (전체 534 통과)

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
