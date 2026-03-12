# Changelog

All notable changes to MdEdit are documented here.

## [Unreleased]

### Added
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
- File explorer with standard navigation UI
  - `..` parent directory entry at top of file list for quick parent navigation
  - Go Up (↑) button in sidebar header with parent path tooltip
  - Refresh button to reload directory contents after external changes
  - Search/filter input to find files within opened folder
- File tree directory navigation: click directory to navigate into it
- `FileNode` Rust model now serializes with `camelCase` JSON keys (`#[serde(rename_all = "camelCase")]`)
  matching TypeScript interface — fixes directory detection always returning `undefined`
- File watcher (`startWatch`) runs non-blocking; watcher failure no longer prevents folder navigation
- Regression test: `test_file_node_serializes_with_camel_case_keys` guards against snake_case regression

### Fixed
- **Critical**: Clicking a directory triggered `openFile` instead of `openFolderPath` because
  `node.isDirectory` was always `undefined` (Rust serialized `is_directory` instead of `isDirectory`)
- Unhandled Promise rejection "Path is a directory, not a file" when clicking `.claude` folder
- Test mock for `openFolderPath` returned `undefined` instead of `Promise<void>`, causing `.catch()` errors

### Tests
- Frontend: 192 tests passing (21 test files)
- Rust: 78 tests passing

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
