---
id: SPEC-EDITOR-002
version: "1.0.0"
status: implemented
created: "2026-02-24"
updated: "2026-02-24"
author: "jw"
priority: P1
tags: [editor, ux, save-feedback, save-as, toolbar, shortcuts, word-count, footer, unsaved-warning]
dependencies: [SPEC-EDITOR-001, SPEC-FS-001, SPEC-UI-001]
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-24 | jw | Initial SPEC creation |

## Overview

MdEdit 에디터의 UX를 개선하는 6가지 기능을 정의한다. 저장 피드백(Footer status bar), 다른 이름으로 저장(Ctrl+Shift+S), 미저장 변경사항 경고(파일 전환 시), 툴바 버튼 동작 연결(기존 `wrapSelection` 재사용), 새 파일 단축키(Ctrl+N), 단어/글자 수 표시(Footer)를 포함한다.

이 SPEC은 에디터 중심의 사용성 개선을 다루며, 기존 코드베이스의 패턴(`keyboard-shortcuts.ts`의 `wrapSelection`, `directory_ops.rs`의 `open_directory_dialog`)을 최대한 재사용하여 구현한다.

### 범위

- Footer status bar에 저장 상태 피드백 (Saved / Unsaved / Saving...)
- Ctrl+Shift+S 다른 이름으로 저장 (Tauri dialog 연동)
- 파일 전환 시 미저장 변경사항 경고 다이얼로그
- 툴바 버튼과 에디터 포맷 함수 연결 (`wrapSelection`, `prefixLine` 재사용)
- Ctrl+N 새 파일 생성 단축키
- Footer에 단어/글자 수 실시간 표시

### 범위 제외

- 에디터-미리보기 스크롤 동기화 (SPEC-PREVIEW-002 범위)
- 자동 저장 기능 (V2+ 범위)
- 멀티탭 에디터 (V2+ 범위)

---

## EARS Requirements

### Ubiquitous Requirements

- **REQ-EDITOR002-U01**: 시스템은 항상 Footer status bar에 현재 저장 상태(Saved, Unsaved, Saving...)를 표시해야 한다.
- **REQ-EDITOR002-U02**: 시스템은 항상 Footer에 현재 에디터 콘텐츠의 단어 수와 글자 수를 표시해야 한다.
- **REQ-EDITOR002-U03**: 시스템은 항상 uiStore를 통해 `saveStatus` 상태를 관리해야 한다.
- **REQ-EDITOR002-U04**: 시스템은 항상 툴바의 포맷 버튼(Bold, Italic, Strikethrough, Code, Link, Heading, List, Quote, Horizontal Rule)이 에디터의 포맷 함수와 연결되어야 한다.

### Event-Driven Requirements

- **REQ-EDITOR002-E01**: WHEN 사용자가 Ctrl+S(macOS: Cmd+S)를 누를 때, THEN 시스템은 현재 파일을 저장하고 Footer saveStatus를 "Saving..." → "Saved"로 업데이트해야 한다.
- **REQ-EDITOR002-E02**: WHEN 사용자가 Ctrl+Shift+S(macOS: Cmd+Shift+S)를 누를 때, THEN 시스템은 Tauri 네이티브 파일 저장 대화상자를 열고, 사용자가 선택한 경로로 파일을 저장해야 한다.
- **REQ-EDITOR002-E03**: WHEN 미저장 변경사항이 있는 상태에서 사용자가 다른 파일을 선택할 때, THEN 시스템은 "저장하지 않은 변경사항이 있습니다. 저장하시겠습니까?" 경고 다이얼로그를 표시해야 한다.
- **REQ-EDITOR002-E04**: WHEN 사용자가 미저장 경고 다이얼로그에서 "저장"을 선택할 때, THEN 시스템은 현재 파일을 저장한 후 선택한 파일로 전환해야 한다.
- **REQ-EDITOR002-E05**: WHEN 사용자가 미저장 경고 다이얼로그에서 "저장하지 않음"을 선택할 때, THEN 시스템은 변경사항을 버리고 선택한 파일로 전환해야 한다.
- **REQ-EDITOR002-E06**: WHEN 사용자가 미저장 경고 다이얼로그에서 "취소"를 선택할 때, THEN 시스템은 파일 전환을 취소하고 현재 파일을 유지해야 한다.
- **REQ-EDITOR002-E07**: WHEN 사용자가 Ctrl+N(macOS: Cmd+N)을 누를 때, THEN 시스템은 에디터를 비워 새 파일 편집 상태로 전환해야 한다.
- **REQ-EDITOR002-E08**: WHEN 사용자가 툴바의 Bold 버튼을 클릭할 때, THEN 시스템은 에디터의 선택된 텍스트를 `**` 로 감싸야 한다.
- **REQ-EDITOR002-E09**: WHEN 사용자가 툴바의 Italic 버튼을 클릭할 때, THEN 시스템은 에디터의 선택된 텍스트를 `*` 로 감싸야 한다.
- **REQ-EDITOR002-E10**: WHEN 사용자가 툴바의 Heading 버튼을 클릭할 때, THEN 시스템은 현재 라인 앞에 `## ` 접두사를 추가해야 한다.
- **REQ-EDITOR002-E11**: WHEN 사용자가 툴바의 List 버튼을 클릭할 때, THEN 시스템은 현재 라인 앞에 `- ` 접두사를 추가해야 한다.
- **REQ-EDITOR002-E12**: WHEN 사용자가 툴바의 Quote 버튼을 클릭할 때, THEN 시스템은 현재 라인 앞에 `> ` 접두사를 추가해야 한다.
- **REQ-EDITOR002-E13**: WHEN editorStore의 `content`가 변경될 때, THEN 시스템은 Footer의 단어 수와 글자 수를 즉시 업데이트해야 한다.
- **REQ-EDITOR002-E14**: WHEN editorStore의 `content`가 변경될 때, THEN 시스템은 saveStatus를 "Unsaved"로 업데이트해야 한다.
- **REQ-EDITOR002-E15**: WHEN "다른 이름으로 저장" 대화상자에서 사용자가 경로를 선택하고 확인할 때, THEN 시스템은 해당 경로로 파일을 저장하고 editorStore의 `currentFile`을 새 경로로 업데이트해야 한다.

### State-Driven Requirements

- **REQ-EDITOR002-S01**: IF 현재 열린 파일이 없는 상태이면(새 파일), THEN Footer saveStatus는 "New"로 표시되어야 한다.
- **REQ-EDITOR002-S02**: IF editorStore의 `isDirty`가 `true`이면, THEN Footer saveStatus는 "Unsaved"로 표시되고 시각적으로 구분(예: 노란색 점)되어야 한다.
- **REQ-EDITOR002-S03**: IF 에디터에 텍스트 선택이 없는 상태에서 포맷 버튼을 클릭하면, THEN 시스템은 플레이스홀더 텍스트(예: `**bold**`)를 삽입해야 한다.
- **REQ-EDITOR002-S04**: IF editorStore의 `content`가 빈 문자열이면, THEN Footer의 단어 수는 0, 글자 수는 0으로 표시되어야 한다.

### Unwanted Behavior Requirements

- **REQ-EDITOR002-N01**: 시스템은 미저장 변경사항 확인 없이 파일을 전환하지 않아야 한다 (isDirty가 true인 경우).
- **REQ-EDITOR002-N02**: 시스템은 "다른 이름으로 저장" 시 기존 파일을 사용자 확인 없이 덮어쓰지 않아야 한다 (Tauri dialog가 자체 처리).
- **REQ-EDITOR002-N03**: 시스템은 파일 저장 중 에러 발생 시 saveStatus를 "Saved"로 표시하지 않아야 한다.
- **REQ-EDITOR002-N04**: 시스템은 EditorView 인스턴스를 Zustand store에 직접 저장하지 않아야 한다 (DOM 객체 store 저장은 안티패턴).

### Optional Requirements

- **REQ-EDITOR002-O01**: 가능하면 저장 성공 시 Footer saveStatus에 타임스탬프("Saved at 14:32")를 함께 표시해야 한다.
- **REQ-EDITOR002-O02**: 가능하면 Ctrl+N 시 미저장 변경사항이 있으면 경고 다이얼로그를 표시해야 한다.
- **REQ-EDITOR002-O03**: 가능하면 Footer에 현재 커서 위치(Line:Column)를 표시해야 한다.

---

## Technical Constraints

### 컴포넌트 수정 범위

| 컴포넌트 | 파일 경로 | 변경 내용 |
|----------|-----------|-----------|
| MarkdownEditor | `src/components/editor/MarkdownEditor.tsx` | Save-As keymap, Ctrl+N, onViewReady prop, 저장 피드백 |
| EditorToolbar | `src/components/editor/EditorToolbar.tsx` | onFormat 콜백 prop 연결 |
| AppLayout | `src/components/layout/AppLayout.tsx` | EditorPanel viewRef 전달, onFormat, word count |
| Footer | `src/components/layout/Footer.tsx` | saveStatus 표시, word count 표시 |

### 상태 관리

| Store | 파일 경로 | 추가 상태 |
|-------|-----------|-----------|
| uiStore | `src/store/uiStore.ts` | `saveStatus: 'new' \| 'saved' \| 'unsaved' \| 'saving'` |

### Hook 수정

| Hook | 파일 경로 | 변경 내용 |
|------|-----------|-----------|
| useFileSystem | `src/hooks/useFileSystem.ts` | unsaved warning 로직 추가, saveFileAs 함수 추가 |

### 백엔드 수정

| 파일 | 변경 내용 |
|------|-----------|
| `src-tauri/src/commands/file_ops.rs` | `save_file_as` 커맨드 추가 |
| `src-tauri/src/lib.rs` | `save_file_as` 커맨드 등록 |
| `src/lib/tauri/ipc.ts` | `saveFileAs` wrapper 함수 추가 |

### 기술 참고사항

- **`wrapSelection`**: `keyboard-shortcuts.ts`에 이미 구현되어 있음. 툴바 버튼은 이 함수를 재사용하여 Bold(`**`), Italic(`*`), Code(`` ` ``), Strikethrough(`~~`), Link(`[]()`) 적용
- **`prefixLine`**: 새로 추가할 헬퍼 함수. Heading(`## `), List(`- `), Quote(`> `) 처리
- **`EditorView` 외부 노출**: `onViewReady` prop 패턴 채택. MarkdownEditor가 EditorView 생성 시 부모에 콜백으로 전달. Store에 DOM 객체 저장은 안티패턴이므로 금지.
- **`tauri-plugin-dialog`**: Rust 백엔드에 이미 등록됨 (Cargo.toml + lib.rs). npm `@tauri-apps/plugin-dialog`만 추가 필요
- **`directory_ops.rs`의 `open_directory_dialog`**: Save-As dialog 구현의 레퍼런스 패턴

### 성능 요구사항

| 지표 | 목표값 |
|------|--------|
| 저장 피드백 상태 전환 | < 16ms |
| 단어/글자 수 계산 (10KB) | < 10ms |
| 툴바 버튼 ~ 에디터 반영 | < 16ms |
| Save-As 대화상자 표시 | < 200ms |
| 미저장 경고 다이얼로그 표시 | < 16ms |

### 기술 스택 제약

- React 18.x with TypeScript strict mode
- CodeMirror 6 (EditorView API)
- Zustand 5.x for uiStore
- Tauri v2 IPC + tauri-plugin-dialog
- Tailwind CSS 3.x for styling

---

## Dependencies

### 내부 의존성

| SPEC ID | 의존 내용 |
|---------|-----------|
| SPEC-EDITOR-001 | CodeMirror 에디터 인스턴스, editorStore (content, currentFile, isDirty) |
| SPEC-FS-001 | Tauri 백엔드 파일 저장 커맨드 (save_file), useFileSystem Hook |
| SPEC-UI-001 | AppLayout 3-pane 레이아웃, Footer 컴포넌트 영역 |

### 외부 라이브러리

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| @tauri-apps/plugin-dialog | 2.x | 네이티브 Save-As 대화상자 |
| @codemirror/view | 6.x | EditorView API (wrapSelection, dispatch) |
| react | 18.x | UI 프레임워크 |
| zustand | 5.x | 상태 관리 |

### 하류 의존성

- SPEC-PREVIEW-002: Footer 영역 공유 (스크롤 동기화 토글 버튼)

---

## Traceability

- **Product Reference**: product.md - Core Feature 1 (Markdown Editor), Core Feature 4 (File Operations)
- **Structure Reference**: structure.md - `src/components/editor/`, `src/components/layout/`, `src/store/uiStore.ts`, `src/hooks/useFileSystem.ts`
- **Tech Reference**: tech.md - CodeMirror 6, Tauri IPC, Zustand
