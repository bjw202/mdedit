# SPEC-IMG-001: 마크다운 에디터 이미지 지원 기능

- **Status**: Implemented
- **Created**: 2026-03-05
- **Implemented**: 2026-03-05
- **Author**: jw (bjw202)

---

## Context

MdEdit(Tauri v2 마크다운 에디터)에 이미지 지원 기능을 추가한다. 현재 이미지 관련 기능이 전혀 없으며, DOCX 익스포트 시 이미지는 alt 텍스트로만 출력된다. VS Code의 마크다운 이미지 붙여넣기 기능을 참고하여, 클립보드 붙여넣기/파일 선택/드래그앤드롭으로 이미지를 삽입하고, 프리뷰 렌더링 및 익스포트(HTML/PDF/DOCX)까지 완전히 지원한다.

---

## EARS 형식 요구사항

| ID | Type | 요구사항 |
|----|------|---------|
| REQ-IMG-001 | Event-Driven | 사용자가 이미지가 포함된 클립보드 내용을 붙여넣으면(Cmd+V), 시스템은 이미지를 `images/` 서브폴더에 타임스탬프 기반 파일명으로 저장하고 `![image](./images/{filename})` 링크를 커서 위치에 삽입한다 |
| REQ-IMG-002 | Event-Driven | 사용자가 툴바 "이미지 삽입" 또는 Cmd+Shift+I를 실행하면, 시스템은 이미지 파일 다이얼로그를 열고 선택된 파일을 `images/` 폴더에 복사 후 마크다운 링크를 삽입한다 |
| REQ-IMG-003 | Event-Driven | 사용자가 이미지 파일을 에디터에 드래그앤드롭하면, 시스템은 각 파일을 `images/` 폴더에 복사하고 드롭 위치에 링크를 삽입한다 |
| REQ-IMG-004 | State-Driven | 이미지 삽입 시 `images/` 서브폴더가 없으면 자동 생성한다. 파일이 저장되지 않은 상태면 먼저 Save As를 요청한다 |
| REQ-IMG-005 | Behavior | 프리뷰 패널에서 상대경로 이미지를 Tauri `asset:` 프로토콜로 렌더링한다 |
| REQ-IMG-006 | Behavior | 이미지는 `max-width: 100%; height: auto`로 페이지 폭에 맞춰 표시한다. PDF 익스포트 시 인쇄 영역 내에 맞춤 |
| REQ-IMG-007 | Behavior | HTML 익스포트 시 로컬 이미지를 base64 데이터 URI로 임베드하여 self-contained HTML을 생성한다 |
| REQ-IMG-008 | Behavior | PDF 익스포트 시 이미지가 인쇄 뷰에서 올바르게 렌더링되며 `page-break-inside: avoid` 적용 |
| REQ-IMG-009 | Behavior | DOCX 익스포트 시 이미지 바이너리 데이터를 읽어 `ImageRun`으로 임베드한다 (현재 alt 텍스트 플레이스홀더 대체) |
| REQ-IMG-010 | Constraint | 모든 이미지 경로는 `validate_path()`를 통해 검증. 경로 탐색 공격 방지 |
| REQ-IMG-011 | State-Driven | 미저장 파일에서 이미지 삽입 시도 시 Save As를 먼저 실행하도록 가이드 |

---

## 인수 기준 (Acceptance Criteria)

### AC-1: 클립보드 이미지 붙여넣기
- **Given** 마크다운 파일이 저장된 상태
- **When** 클립보드에 이미지를 복사한 뒤 에디터에서 Cmd+V
- **Then** `images/` 폴더에 `{timestamp}.png` 파일 저장, 에디터에 `![image](./images/{timestamp}.png)` 삽입, 프리뷰에 이미지 렌더링

### AC-2: 파일 다이얼로그 이미지 삽입
- **Given** 마크다운 파일이 저장된 상태
- **When** 툴바 이미지 버튼 클릭 또는 Cmd+Shift+I
- **Then** 네이티브 파일 다이얼로그 표시, 이미지 선택 시 `images/` 폴더에 복사, 마크다운 링크 삽입

### AC-3: 드래그앤드롭 이미지 삽입
- **Given** 마크다운 파일이 저장된 상태
- **When** 이미지 파일을 에디터에 드래그앤드롭
- **Then** `images/` 폴더에 복사, 드롭 위치에 마크다운 링크 삽입, 복수 파일 처리 지원

### AC-4: 미저장 파일 처리
- **Given** 파일이 저장되지 않은 상태 (currentFilePath null)
- **When** 이미지 삽입 시도 (붙여넣기/드롭/다이얼로그)
- **Then** Save As 다이얼로그 먼저 실행, 저장 완료 후 이미지 삽입 진행

### AC-5: HTML 익스포트 이미지 임베딩
- **Given** 이미지가 포함된 마크다운 문서
- **When** HTML 익스포트 실행
- **Then** 로컬 이미지가 base64 데이터 URI로 임베드된 self-contained HTML 생성

### AC-6: DOCX 익스포트 이미지 임베딩
- **Given** 이미지가 포함된 마크다운 문서
- **When** DOCX 익스포트 실행
- **Then** 이미지가 ImageRun으로 실제 바이너리 포함 (alt 텍스트가 아닌 실제 이미지)

### AC-7: 경로 보안
- **Given** 경로 탐색 공격 시도 (예: `../../../etc/passwd`)
- **When** 이미지 커맨드 호출
- **Then** `validate_path()` 에서 거부, 에러 반환

---

## 구현 계획

### Phase 1: Rust 백엔드 - 이미지 커맨드

**새 파일: `src-tauri/src/commands/image_ops.rs`**

4개 Tauri 커맨드:
- `save_image_from_clipboard(md_file_path, image_data_base64)` → `{md_dir}/images/{timestamp}.png` 저장, 상대경로 반환
- `copy_image_to_folder(source_path, md_file_path)` → `images/` 폴더로 복사 (중복 시 suffix), 상대경로 반환
- `read_image_as_base64(image_path)` → base64 데이터 URI 반환
- `open_image_dialog(app)` → 이미지 필터 네이티브 파일 다이얼로그

**수정 파일:**
- `src-tauri/Cargo.toml` → `base64 = "0.22"` 의존성
- `src-tauri/src/commands/mod.rs` → `pub mod image_ops`
- `src-tauri/src/lib.rs` → 4개 커맨드 등록

### Phase 2: 프론트엔드 IPC + 이미지 유틸

**새 파일:**
- `src/lib/image/imageHandler.ts` → 클립보드/드롭/다이얼로그 핸들러
- `src/lib/image/imageResolver.ts` → 상대경로 → `asset:` URL 변환

**수정 파일:**
- `src/lib/tauri/ipc.ts` → 4개 IPC 래퍼

### Phase 3: 프리뷰 이미지 렌더링

**수정 파일:**
- `src/lib/markdown/renderer.ts` → `imageResolverPlugin` + `mdFilePath` 파라미터
- `src/hooks/usePreview.ts` → `currentFilePath` 전달

### Phase 4: 에디터 통합

**수정 파일:**
- `src/components/editor/MarkdownEditor.tsx` → paste/drop 이벤트 핸들러 + Cmd+Shift+I
- `src/components/editor/EditorToolbar.tsx` → `'image'` 포맷 액션 + 버튼
- `src/components/layout/AppLayout.tsx` → image 액션 핸들러 + export에 mdFilePath 전달

### Phase 5: 익스포트 개선

**수정 파일:**
- `src/lib/export/types.ts` → `mdFilePath` 필드
- `src/lib/export/exportHtml.ts` → `embedLocalImages()` base64 임베딩
- `src/lib/export/exportPdf.ts` → `img { page-break-inside: avoid }` CSS
- `src/lib/export/exportDocx.ts` → `ImageRun`으로 실제 이미지 임베딩

---

## 파일 변경 요약

### 새 파일 (3)
| 파일 | 목적 |
|------|------|
| `src-tauri/src/commands/image_ops.rs` | Rust 이미지 커맨드 (저장/복사/읽기/다이얼로그) |
| `src/lib/image/imageHandler.ts` | 붙여넣기/드롭/다이얼로그 핸들러 |
| `src/lib/image/imageResolver.ts` | 상대경로 → asset: URL 변환 |

### 수정 파일 (13)
| 파일 | 변경 내용 |
|------|----------|
| `src-tauri/Cargo.toml` | `base64` 의존성 추가 |
| `src-tauri/src/commands/mod.rs` | `pub mod image_ops` |
| `src-tauri/src/lib.rs` | 4개 커맨드 등록 |
| `src/lib/tauri/ipc.ts` | 4개 IPC 래퍼 추가 |
| `src/lib/markdown/renderer.ts` | `mdFilePath` 파라미터 + imageResolverPlugin |
| `src/hooks/usePreview.ts` | `currentFilePath` 전달 |
| `src/components/editor/MarkdownEditor.tsx` | paste/drop 핸들러 |
| `src/components/editor/EditorToolbar.tsx` | 이미지 버튼 |
| `src/components/layout/AppLayout.tsx` | image 액션 + export에 mdFilePath 전달 |
| `src/lib/export/types.ts` | `mdFilePath` 필드 추가 |
| `src/lib/export/exportHtml.ts` | 로컬 이미지 base64 임베드 |
| `src/lib/export/exportPdf.ts` | print CSS 이미지 page-break |
| `src/lib/export/exportDocx.ts` | ImageRun으로 실제 이미지 임베드 |

---

## 참조 구현 패턴

- **validate_path()**: `src-tauri/src/commands/file_ops.rs` — 경로 검증 재사용
- **Mermaid ImageRun**: `src/lib/export/exportDocx.ts:92-168` — DOCX 이미지 임베딩 패턴
- **IPC 래퍼 패턴**: `src/lib/tauri/ipc.ts` — invoke 호출 패턴
- **markdown-it 플러그인**: `src/lib/markdown/renderer.ts` (tableScrollPlugin) — 렌더러 룰 오버라이드
- **CodeMirror 키맵**: `src/components/editor/MarkdownEditor.tsx:85-148` — 키보드 단축키 패턴

---

## 리스크 및 엣지 케이스

| 리스크 | 완화 방안 |
|--------|----------|
| 미저장 파일 (mdFilePath null) | Save As 강제 실행 후 이미지 삽입 |
| 대용량 이미지 (>10MB) | Rust에서 크기 제한 적용 |
| 파일명 중복 | 타임스탬프+해시 또는 suffix 추가 |
| 경로 탐색 공격 | `validate_path()` 검증 |
| 삭제된 이미지 | img onerror로 graceful fallback |
| 크로스 플랫폼 경로 | 마크다운 링크는 `/` 사용, Rust는 `std::path` 사용 |
| 네트워크 이미지 | 로컬 경로만 임베드, http/https는 그대로 유지 |

---

## 테스트 결과

### Rust 단위 테스트
- `cargo test` — 97개 테스트 통과 (image_ops 모듈 16개 포함)
  - validate_path, save_image_from_clipboard, copy_image_to_folder, read_image_as_base64
  - 경로 탐색 방지, 중복 파일명 처리, 잘못된 base64 입력

### 프론트엔드 단위 테스트
- `npx vitest run` — 267개 테스트 통과
  - usePreview.test.ts — renderMarkdown 시그니처 변경 반영
  - MarkdownEditor.test.tsx — domEventHandlers 모킹 추가

### TypeScript 컴파일
- `npx tsc --noEmit` — 에러 0개
