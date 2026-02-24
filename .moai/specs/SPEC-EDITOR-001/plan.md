# Implementation Plan: SPEC-EDITOR-001

## 개요

CodeMirror 6 기반 Markdown 전용 에디터 구현 계획. 에디터 핵심 통합, Zustand 상태 관리, 마크다운 전용 확장(구문 강조, 키보드 단축키), 서식 툴바를 단계별로 구현한다.

---

## Task Decomposition

### Milestone 1: 핵심 에디터 통합 (Primary Goal)

editorStore와 CodeMirror 6 기본 인스턴스를 연동하여 편집 가능한 에디터를 구현한다.

#### Task 1.1: Zustand editorStore 생성

- **파일**: `src/store/editorStore.ts`
- **내용**:
  - `content: string` - 현재 편집 중인 Markdown 콘텐츠
  - `currentFilePath: string | null` - 현재 파일 경로
  - `cursorPosition: { line: number; col: number }` - 커서 위치
  - `dirty: boolean` - 미저장 변경 여부
  - `setContent(content: string): void` - 콘텐츠 업데이트 (dirty 플래그 자동 설정)
  - `setCurrentFilePath(path: string | null): void` - 파일 경로 설정
  - `setCursorPosition(pos): void` - 커서 위치 업데이트
  - `setDirty(dirty: boolean): void` - dirty 플래그 직접 설정
  - `resetEditor(): void` - 에디터 상태 초기화
- **참조**: REQ-EDITOR-U06, REQ-EDITOR-U07, REQ-EDITOR-E10

#### Task 1.2: MarkdownEditor 기본 컴포넌트

- **파일**: `src/components/editor/MarkdownEditor.tsx`
- **내용**:
  - CodeMirror 6 EditorView 인스턴스 생성 및 React ref 연동
  - `@codemirror/lang-markdown` 언어 지원 활성화
  - `useEffect`로 마운트/언마운트 lifecycle 관리
  - 언마운트 시 `EditorView.destroy()` 호출 (REQ-EDITOR-N01)
  - editorStore와 양방향 동기화:
    - EditorView `updateListener` -> editorStore.setContent()
    - editorStore 외부 변경 -> EditorView `dispatch`
  - 기본 확장: `lineNumbers()`, `highlightActiveLine()`, `EditorView.lineWrapping`
- **참조**: REQ-EDITOR-U01, REQ-EDITOR-U02, REQ-EDITOR-U03, REQ-EDITOR-U04, REQ-EDITOR-N01

#### Task 1.3: 기본 키보드 단축키

- **파일**: `src/components/editor/extensions/keyboard-shortcuts.ts`
- **내용**:
  - `Ctrl+Z` / `Cmd+Z`: 실행 취소 (CodeMirror 내장 `undo`)
  - `Ctrl+Shift+Z` / `Cmd+Shift+Z`: 다시 실행 (CodeMirror 내장 `redo`)
  - `Ctrl+F` / `Cmd+F`: 찾기/바꾸기 패널 열기 (`@codemirror/search`)
  - `keymap.of()` 확장으로 번들링
- **참조**: REQ-EDITOR-U09, REQ-EDITOR-E05, REQ-EDITOR-E06, REQ-EDITOR-E07

---

### Milestone 2: 구문 강조 및 테마 (Primary Goal)

Markdown 요소에 대한 VS Code 스타일 구문 강조를 구현한다.

#### Task 2.1: 구문 강조 테마 정의

- **파일**: `src/components/editor/extensions/syntax-highlighting.ts`
- **내용**:
  - `@codemirror/language`의 `HighlightStyle.define()` 사용
  - 태그별 스타일 매핑:
    - `tags.heading1` ~ `tags.heading6`: 크기 및 색상 구분
    - `tags.strong`: 볼드 스타일
    - `tags.emphasis`: 이탤릭 스타일
    - `tags.link`, `tags.url`: 링크 색상 및 밑줄
    - `tags.monospace`: 인라인 코드 배경색
    - `tags.quote`: 인용문 색상
    - `tags.list`: 리스트 마커 색상
    - `tags.meta`: 프론트매터 구분
  - 라이트/다크 테마 양쪽 지원
  - `syntaxHighlighting()` 확장으로 번들링
- **참조**: REQ-EDITOR-U08

#### Task 2.2: Markdown 확장 번들

- **파일**: `src/components/editor/extensions/markdown-extensions.ts`
- **내용**:
  - `@codemirror/lang-markdown`의 `markdown()` 함수 호출
  - 코드 블록 내 언어 지원 (GFM 코드 펜스)
  - 프론트매터 인식 (`---` 구분자 사이 YAML 블록)
  - 모든 Markdown 전용 확장을 하나의 배열로 번들링
- **참조**: REQ-EDITOR-U08

---

### Milestone 3: 마크다운 서식 단축키 (Secondary Goal)

Markdown 전용 서식 지정 키보드 단축키와 자동 들여쓰기를 구현한다.

#### Task 3.1: 서식 단축키 구현

- **파일**: `src/components/editor/extensions/keyboard-shortcuts.ts` (확장)
- **내용**:
  - `Ctrl+B` / `Cmd+B`: 볼드 토글 (`**text**`)
  - `Ctrl+I` / `Cmd+I`: 이탤릭 토글 (`*text*`)
  - `Ctrl+/` / `Cmd+/`: 주석 토글 (`<!-- text -->`)
  - `Ctrl+S` / `Cmd+S`: 파일 저장 (Tauri IPC 연동)
  - 선택 영역 있을 때와 없을 때의 동작 분리
- **참조**: REQ-EDITOR-E01, REQ-EDITOR-E02, REQ-EDITOR-E03, REQ-EDITOR-E04

#### Task 3.2: 리스트/인용문 자동 들여쓰기

- **파일**: `src/components/editor/extensions/keyboard-shortcuts.ts` (확장)
- **내용**:
  - `Enter` 키: 리스트 항목 자동 연속 생성
    - `-`, `*`: 동일 마커로 새 항목
    - `1.`, `2.`: 번호 자동 증가
    - 빈 리스트 항목에서 Enter: 리스트 종료
  - `Enter` 키: 인용문 자동 연속 (`>` 접두사 유지)
  - `Tab`: 리스트 항목 들여쓰기 증가
  - `Shift+Tab`: 리스트 항목 들여쓰기 감소
- **참조**: REQ-EDITOR-E08, REQ-EDITOR-E09, REQ-EDITOR-E12, REQ-EDITOR-E13

#### Task 3.3: 저장 기능 Tauri IPC 연동

- **파일**: `src/components/editor/extensions/keyboard-shortcuts.ts` (Ctrl+S 핸들러)
- **내용**:
  - `currentFilePath` 존재 시: Tauri `invoke('write_file', { path, content })` 직접 호출
  - `currentFilePath` 미존재 시: Tauri `dialog.save()` 호출 후 저장
  - 성공 시: `editorStore.setDirty(false)`
  - 실패 시: 에러 메시지 표시, `dirty` 플래그 유지
- **참조**: REQ-EDITOR-E01, REQ-EDITOR-S01, REQ-EDITOR-S02, REQ-EDITOR-N02

---

### Milestone 4: EditorToolbar 컴포넌트 (Secondary Goal)

시각적 서식 버튼 툴바를 구현한다.

#### Task 4.1: EditorToolbar 컴포넌트 구현

- **파일**: `src/components/editor/EditorToolbar.tsx`
- **내용**:
  - 서식 버튼 목록:
    - Bold (B), Italic (I), Heading (H1-H3 드롭다운)
    - 순서 없는 리스트, 순서 있는 리스트
    - 인라인 코드, 코드 블록
    - 링크 삽입, 인용문
  - 각 버튼 클릭 시 에디터에 마크다운 구문 적용
  - EditorView 인스턴스에 대한 ref 또는 콜백 패턴으로 명령 전달
  - Tailwind CSS 기반 스타일링
  - 아이콘 표시 (SVG 또는 텍스트 기반)
- **참조**: REQ-EDITOR-E11

---

### Milestone 5: 찾기/바꾸기 및 대용량 파일 (Final Goal)

찾기/바꾸기 고급 기능과 대용량 파일 최적화를 구현한다.

#### Task 5.1: 찾기/바꾸기 패널 통합

- **파일**: `src/components/editor/MarkdownEditor.tsx` (확장 추가)
- **내용**:
  - `@codemirror/search`의 `search()` 확장 통합
  - 정규식 검색 옵션 활성화
  - 일치 항목 시각적 강조
  - 현재 일치 위치 표시 (N/M)
  - 바꾸기 및 전체 바꾸기 기능
- **참조**: REQ-EDITOR-E07, REQ-EDITOR-S04

#### Task 5.2: 대용량 파일 최적화

- **파일**: `src/components/editor/MarkdownEditor.tsx`
- **내용**:
  - CodeMirror 6의 내장 가상 스크롤링 검증
  - 50KB+ 파일에서 성능 프로파일링
  - 필요 시 구문 강조 최적화 (viewport-only 하이라이팅)
  - `EditorView.scrollDOM` 최적화
- **참조**: REQ-EDITOR-S03, REQ-EDITOR-U05

---

### Milestone 6: 선택 기능 (Optional Goal)

선택적 편의 기능을 구현한다.

#### Task 6.1: 링크/이미지 삽입 단축키

- `Ctrl+K`: 링크 삽입 (`[text](url)`)
- `Ctrl+Shift+K`: 이미지 삽입 (`![alt](url)`)
- **참조**: REQ-EDITOR-O01, REQ-EDITOR-O02

#### Task 6.2: 괄호 쌍 색상화

- 코드 블록 내 괄호 쌍 색상화
- `@codemirror/language`의 bracketMatching 확장 활용
- **참조**: REQ-EDITOR-O03

---

## Technology Stack

| 기술                        | 버전   | 용도                        |
| --------------------------- | ------ | --------------------------- |
| CodeMirror 6                | 6.x    | 핵심 에디터 엔진            |
| @codemirror/lang-markdown   | 6.x    | Markdown 언어 지원          |
| @codemirror/search          | 6.x    | 찾기/바꾸기                 |
| @codemirror/commands        | 6.x    | 표준 편집 커맨드            |
| Zustand                     | 5.x    | 상태 관리                   |
| React                       | 18.x   | UI 프레임워크               |
| TypeScript                  | 5.x+   | 타입 안전성                 |
| Tailwind CSS                | 3.x    | EditorToolbar 스타일링      |
| Tauri v2 IPC                | 2.x    | 파일 저장 백엔드 통신       |

---

## File Manifest

| 파일 경로                                              | 신규/수정 | 설명                         |
| ------------------------------------------------------ | --------- | ---------------------------- |
| `src/store/editorStore.ts`                             | 신규      | Zustand 에디터 상태 관리     |
| `src/components/editor/MarkdownEditor.tsx`             | 신규      | CodeMirror 6 메인 컴포넌트   |
| `src/components/editor/EditorToolbar.tsx`              | 신규      | 서식 버튼 툴바               |
| `src/components/editor/extensions/markdown-extensions.ts` | 신규   | Markdown 확장 번들           |
| `src/components/editor/extensions/syntax-highlighting.ts` | 신규   | 구문 강조 테마 정의          |
| `src/components/editor/extensions/keyboard-shortcuts.ts`  | 신규   | 키보드 단축키 정의           |

---

## Risk Analysis

### 리스크 1: CodeMirror 6 React 통합 복잡성

- **가능성**: 중간
- **영향**: 높음
- **설명**: CodeMirror 6은 자체 DOM 관리 체계를 가지므로 React의 가상 DOM과 충돌 가능성이 있다.
- **대응**: `useRef`와 `useEffect`를 사용하여 CodeMirror를 비제어(uncontrolled) 컴포넌트로 관리. 외부 상태 변경 시에만 `dispatch`로 동기화.

### 리스크 2: editorStore 양방향 동기화 무한 루프

- **가능성**: 높음
- **영향**: 높음
- **설명**: CodeMirror onChange -> editorStore 업데이트 -> CodeMirror 재렌더링의 무한 루프 가능성.
- **대응**: `EditorView.updateListener`에서 `docChanged` 플래그 확인. 외부 변경과 사용자 입력 구분 로직 구현. 동기화 방향 플래그를 사용하여 루프 차단.

### 리스크 3: 50KB+ 파일에서의 성능 저하

- **가능성**: 낮음
- **영향**: 중간
- **설명**: 대용량 파일에서 구문 강조와 줄 바꿈이 렌더링 성능에 영향을 줄 수 있다.
- **대응**: CodeMirror 6의 내장 가상 스크롤링에 의존. 필요 시 viewport 외부 구문 강조를 지연 처리.

### 리스크 4: 단축키 플랫폼 호환성

- **가능성**: 중간
- **영향**: 낮음
- **설명**: macOS와 Windows/Linux 간 단축키(Cmd vs Ctrl) 처리 차이.
- **대응**: CodeMirror의 `keymap` 시스템이 플랫폼별 키 매핑을 자동 처리. 추가적으로 `Prec.highest`로 커스텀 단축키 우선순위 설정.

---

## Architecture Design Direction

### 컴포넌트 계층 구조

```
MarkdownEditor (최상위)
  ├── EditorToolbar (서식 버튼)
  └── CodeMirror EditorView (비제어 인스턴스)
        ├── markdown-extensions (언어 지원)
        ├── syntax-highlighting (테마)
        └── keyboard-shortcuts (단축키)
```

### 데이터 흐름

```
사용자 입력 -> CodeMirror EditorView
  -> updateListener (docChanged 확인)
  -> editorStore.setContent()
  -> dirty flag = true
  -> SPEC-PREVIEW-001 구독 -> 미리보기 렌더링

Ctrl+S -> keyboard-shortcuts 핸들러
  -> currentFilePath 확인
  -> Tauri IPC write_file 또는 dialog.save()
  -> 성공 시 editorStore.setDirty(false)

EditorToolbar 버튼 클릭
  -> EditorView.dispatch() 로 마크다운 구문 삽입
  -> updateListener 트리거 -> editorStore 동기화
```

### 상태 관리 원칙

- editorStore는 에디터 관련 상태만 관리 (단일 책임)
- CodeMirror 내부 상태(스크롤 위치, 선택 영역)는 CodeMirror 자체에서 관리
- editorStore에는 외부 공유가 필요한 상태만 포함 (content, dirty, currentFilePath, cursorPosition)
- Store 간 교차 업데이트 금지 (editorStore가 fileStore를 직접 수정하지 않음)
