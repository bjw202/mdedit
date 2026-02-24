---
id: SPEC-EDITOR-001
version: "1.0.0"
status: approved
created: "2026-02-24"
updated: "2026-02-24"
author: "jw"
priority: P1
dependencies:
  - SPEC-UI-001
tags:
  - editor
  - codemirror
  - markdown
  - zustand
---

## HISTORY

| Version | Date       | Author | Changes              |
| ------- | ---------- | ------ | -------------------- |
| 1.0.0   | 2026-02-24 | jw     | Initial SPEC creation |

---

## Overview

MdEdit 애플리케이션의 핵심 편집기 컴포넌트로, CodeMirror 6 기반의 Markdown 전용 에디터를 구현한다. VS Code 수준의 구문 강조, 줄 번호, 자동 줄 바꿈, 마크다운 전용 키보드 단축키, 찾기/바꾸기, 실행 취소/다시 실행 기능을 포함하며, Zustand 기반 editorStore를 통해 상태를 관리한다. 50KB 이상의 대용량 파일도 가상 스크롤링을 통해 지연 없이 처리한다.

### 범위

- CodeMirror 6 에디터 통합 및 Markdown 언어 지원
- VS Code 스타일 구문 강조 (헤더, 볼드, 이탤릭, 링크, 코드 블록, 리스트, 인용문, 프론트매터)
- 줄 번호, 자동 줄 바꿈, 현재 줄 강조
- 마크다운 전용 서식 단축키 및 표준 편집 단축키
- 찾기/바꾸기 (정규식 지원)
- EditorToolbar 컴포넌트 (서식 버튼)
- Zustand editorStore (content, cursor, dirty flag, currentFilePath)
- 대용량 파일 (50KB+) 가상 스크롤링 지원

### 범위 제외

- 프로그래밍 언어별 고급 구문 강조 (Markdown 내 코드 블록 제외)
- 멀티 커서 편집 (V2 범위)
- 스크롤바 미니맵 (V2 범위)
- 코드 접기 기능 (V2 범위)

---

## EARS Requirements

### Ubiquitous Requirements (항상 활성)

- **REQ-EDITOR-U01**: 시스템은 항상 CodeMirror 6 에디터 인스턴스를 `MarkdownEditor` 컴포넌트 내에서 관리하며, Markdown 언어 지원(`@codemirror/lang-markdown`)을 기본으로 활성화해야 한다.

- **REQ-EDITOR-U02**: 시스템은 항상 에디터 좌측에 줄 번호를 표시해야 한다.

- **REQ-EDITOR-U03**: 시스템은 항상 자동 줄 바꿈(word wrap)을 활성화하여 수평 스크롤 없이 모든 텍스트를 표시해야 한다.

- **REQ-EDITOR-U04**: 시스템은 항상 현재 커서가 위치한 줄을 시각적으로 강조 표시해야 한다.

- **REQ-EDITOR-U05**: 시스템은 항상 키 입력에서 화면 표시까지의 지연 시간을 50ms 미만으로 유지해야 한다.

- **REQ-EDITOR-U06**: 시스템은 항상 에디터 콘텐츠 변경 시 editorStore의 `content` 필드와 실시간으로 동기화해야 한다.

- **REQ-EDITOR-U07**: 시스템은 항상 editorStore에서 `dirty` 플래그를 관리하여 저장되지 않은 변경 사항의 존재 여부를 추적해야 한다.

- **REQ-EDITOR-U08**: 시스템은 항상 Markdown 구문 요소에 대해 VS Code 스타일의 구문 강조를 적용해야 한다. 대상 요소는 다음과 같다:
  - 헤더 (`#`, `##`, `###`, `####`, `#####`, `######`) - 레벨별 시각적 구분
  - 볼드 (`**text**`) 및 이탤릭 (`*text*`)
  - 링크 (`[text](url)`) 및 이미지 (`![alt](url)`)
  - 인라인 코드 (`` `code` ``)
  - 코드 블록 (``` ``` ```) - 언어 태그 표시 포함
  - 순서 있는/없는 리스트 및 중첩 리스트
  - 인용문 (`>`) - 중첩 레벨 구분
  - 수평선 (`---`, `***`)
  - YAML 프론트매터 (`---` 구분자 내 메타데이터)

- **REQ-EDITOR-U09**: 시스템은 항상 실행 취소(Undo) 및 다시 실행(Redo) 기능을 전체 편집 이력에 대해 지원해야 한다.

### Event-Driven Requirements (이벤트 기반)

- **REQ-EDITOR-E01**: **WHEN** 사용자가 `Ctrl+S` (macOS: `Cmd+S`)를 입력하면, **THEN** 시스템은 현재 에디터 콘텐츠를 Tauri IPC `write_file` 커맨드를 통해 파일 시스템에 저장하고, 성공 시 editorStore의 `dirty` 플래그를 `false`로 설정해야 한다.

- **REQ-EDITOR-E02**: **WHEN** 사용자가 `Ctrl+B` (macOS: `Cmd+B`)를 입력하면, **THEN** 시스템은 현재 선택 영역을 볼드 마크다운 구문(`**text**`)으로 감싸거나, 선택 영역이 없으면 커서 위치에 `****`를 삽입하고 커서를 중앙에 배치해야 한다.

- **REQ-EDITOR-E03**: **WHEN** 사용자가 `Ctrl+I` (macOS: `Cmd+I`)를 입력하면, **THEN** 시스템은 현재 선택 영역을 이탤릭 마크다운 구문(`*text*`)으로 감싸거나, 선택 영역이 없으면 커서 위치에 `**`를 삽입하고 커서를 중앙에 배치해야 한다.

- **REQ-EDITOR-E04**: **WHEN** 사용자가 `Ctrl+/` (macOS: `Cmd+/`)를 입력하면, **THEN** 시스템은 현재 줄 또는 선택된 줄들을 HTML 주석(`<!-- -->`) 또는 주석 해제 토글해야 한다.

- **REQ-EDITOR-E05**: **WHEN** 사용자가 `Ctrl+Z` (macOS: `Cmd+Z`)를 입력하면, **THEN** 시스템은 마지막 편집 동작을 실행 취소해야 한다.

- **REQ-EDITOR-E06**: **WHEN** 사용자가 `Ctrl+Shift+Z` (macOS: `Cmd+Shift+Z`)를 입력하면, **THEN** 시스템은 마지막으로 실행 취소된 동작을 다시 실행해야 한다.

- **REQ-EDITOR-E07**: **WHEN** 사용자가 `Ctrl+F` (macOS: `Cmd+F`)를 입력하면, **THEN** 시스템은 찾기/바꾸기 패널을 표시해야 하며, 정규식 검색 옵션을 제공해야 한다.

- **REQ-EDITOR-E08**: **WHEN** 사용자가 리스트 항목(`-`, `*`, `1.`) 끝에서 `Enter`를 입력하면, **THEN** 시스템은 동일한 레벨의 새 리스트 항목을 자동 생성하고, 순서 있는 리스트의 경우 번호를 자동 증가시켜야 한다.

- **REQ-EDITOR-E09**: **WHEN** 사용자가 인용문(`>`) 끝에서 `Enter`를 입력하면, **THEN** 시스템은 동일한 중첩 레벨의 새 인용문 줄을 자동 생성해야 한다.

- **REQ-EDITOR-E10**: **WHEN** 에디터 콘텐츠가 변경되면, **THEN** 시스템은 editorStore의 `dirty` 플래그를 `true`로 설정해야 한다 (현재 `dirty`가 `false`인 경우).

- **REQ-EDITOR-E11**: **WHEN** EditorToolbar의 서식 버튼(볼드, 이탤릭, 헤더, 리스트, 코드, 링크, 인용문)이 클릭되면, **THEN** 시스템은 해당 마크다운 구문을 에디터의 현재 선택 영역 또는 커서 위치에 적용해야 한다.

- **REQ-EDITOR-E12**: **WHEN** 사용자가 `Tab`을 리스트 항목 시작 위치에서 입력하면, **THEN** 시스템은 해당 리스트 항목의 들여쓰기 레벨을 1단계 증가시켜야 한다.

- **REQ-EDITOR-E13**: **WHEN** 사용자가 `Shift+Tab`을 리스트 항목 시작 위치에서 입력하면, **THEN** 시스템은 해당 리스트 항목의 들여쓰기 레벨을 1단계 감소시켜야 한다 (최소 0단계).

### State-Driven Requirements (상태 기반)

- **REQ-EDITOR-S01**: **IF** editorStore에 `currentFilePath`가 설정되어 있으면, **THEN** 시스템은 `Ctrl+S` 저장 시 해당 경로로 직접 저장해야 한다.

- **REQ-EDITOR-S02**: **IF** editorStore에 `currentFilePath`가 `null`이면, **THEN** 시스템은 `Ctrl+S` 저장 시 Tauri 네이티브 파일 저장 대화상자를 표시하여 경로를 선택하도록 해야 한다.

- **REQ-EDITOR-S03**: **IF** 현재 편집 중인 파일의 크기가 50KB를 초과하면, **THEN** 시스템은 CodeMirror의 가상 스크롤링을 활용하여 눈에 띄는 지연 없이 편집 성능을 유지해야 한다.

- **REQ-EDITOR-S04**: **IF** 찾기/바꾸기 패널이 활성화되어 있으면, **THEN** 시스템은 일치하는 텍스트를 시각적으로 강조 표시하고, 현재 일치 항목 위치를 표시해야 한다.

### Unwanted Behavior Requirements (금지 동작)

- **REQ-EDITOR-N01**: 시스템은 에디터 컴포넌트 언마운트 시 CodeMirror 인스턴스를 정리(destroy)하지 않으면 안 된다. 메모리 누수를 방지해야 한다.

- **REQ-EDITOR-N02**: 시스템은 저장 작업 실패 시 editorStore의 `dirty` 플래그를 `false`로 변경하면 안 된다. 사용자에게 에러를 표시해야 한다.

- **REQ-EDITOR-N03**: 시스템은 원본 파일의 인코딩(UTF-8)을 변경하거나 숨겨진 문자를 추가하면 안 된다.

- **REQ-EDITOR-N04**: 시스템은 에디터 내에서 XSS 공격 벡터가 될 수 있는 HTML을 실행하면 안 된다.

### Optional Requirements (선택 기능)

- **REQ-EDITOR-O01**: 가능하면 시스템은 `Ctrl+K` 단축키로 마크다운 링크 삽입 대화상자를 제공해야 한다.

- **REQ-EDITOR-O02**: 가능하면 시스템은 `Ctrl+Shift+K` 단축키로 마크다운 이미지 삽입 구문을 제공해야 한다.

- **REQ-EDITOR-O03**: 가능하면 시스템은 괄호 쌍 색상화(bracket pair colorization)를 코드 블록 내에서 제공해야 한다.

---

## Technical Constraints

### 라이브러리 버전

| 라이브러리                       | 버전   | 용도                        |
| -------------------------------- | ------ | --------------------------- |
| `@codemirror/view`               | 6.x    | CodeMirror 에디터 뷰 레이어 |
| `@codemirror/state`              | 6.x    | CodeMirror 상태 관리        |
| `@codemirror/lang-markdown`      | 6.x    | Markdown 언어 지원          |
| `@codemirror/commands`           | 6.x    | 표준 편집 커맨드            |
| `@codemirror/search`             | 6.x    | 찾기/바꾸기 기능            |
| `@codemirror/autocomplete`       | 6.x    | 자동 완성 (선택)            |
| `@codemirror/language`           | 6.x    | 언어 지원 기반              |
| `zustand`                        | 5.x    | 상태 관리 라이브러리        |
| `react`                          | 18.x   | UI 프레임워크               |
| `typescript`                     | 5.x+   | 타입 안전성                 |

### 성능 요구사항

| 지표                             | 목표값           |
| -------------------------------- | ---------------- |
| 키 입력-화면 표시 지연           | < 50ms           |
| 50KB 파일 초기 로딩              | < 500ms          |
| 찾기/바꾸기 10KB 문서 검색       | < 100ms          |
| editorStore 상태 동기화          | < 16ms (1 frame) |

### 파일 구조

```
src/
  components/
    editor/
      MarkdownEditor.tsx          # CodeMirror 6 통합 메인 컴포넌트
      EditorToolbar.tsx            # 서식 버튼 툴바
      extensions/
        markdown-extensions.ts     # Markdown 전용 확장 번들
        syntax-highlighting.ts     # 구문 강조 테마 설정
        keyboard-shortcuts.ts      # 커스텀 키보드 단축키
  store/
    editorStore.ts                 # Zustand 에디터 상태 관리
```

---

## Dependencies

### SPEC 의존성

- **SPEC-UI-001**: 3-pane 레이아웃 시스템 (에디터 패널 배치)

### 외부 의존성

- Tauri v2 IPC: `write_file` 커맨드 (파일 저장)
- Tauri v2 Dialog: 파일 저장 대화상자 (새 파일 저장 시)
- editorStore: Zustand 스토어 (콘텐츠, 커서, dirty flag, currentFilePath)

### 하류 의존성 (이 SPEC에 의존하는 SPEC)

- **SPEC-PREVIEW-001**: editorStore의 `content` 필드를 구독하여 실시간 미리보기 렌더링
