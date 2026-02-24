# Implementation Plan: SPEC-EDITOR-002 Editor UX Enhancements

## Task Decomposition

### Milestone 1: 저장 피드백 시스템 (Priority High - Primary Goal)

저장 상태를 uiStore에서 관리하고 Footer에 표시하는 기반을 구축한다.

**Task 1.1: uiStore에 saveStatus 상태 추가**
- 파일: `src/store/uiStore.ts`
- 추가 상태:
  - `saveStatus: 'new' | 'saved' | 'unsaved' | 'saving'` - 현재 저장 상태
- Action 함수:
  - `setSaveStatus(status)` - 저장 상태 변경
- 초기값: `'new'`
- editorStore의 `content` 변경 시 → `'unsaved'` 자동 전환 로직

**Task 1.2: Footer saveStatus 표시**
- 파일: `src/components/layout/Footer.tsx`
- uiStore의 `saveStatus` 구독
- 상태별 표시:
  - `'new'`: "New" (회색)
  - `'saved'`: "Saved" (초록색 점 + 텍스트)
  - `'unsaved'`: "Unsaved" (노란색 점 + 텍스트)
  - `'saving'`: "Saving..." (회전 아이콘)
- Tailwind CSS 스타일링

**Task 1.3: 저장 시 saveStatus 업데이트 연동**
- 파일: `src/hooks/useFileSystem.ts`, `src/components/editor/MarkdownEditor.tsx`
- Ctrl+S 저장 시: `setSaveStatus('saving')` → 저장 완료 → `setSaveStatus('saved')`
- 콘텐츠 변경 시: `setSaveStatus('unsaved')` 자동 전환
- 저장 에러 시: `setSaveStatus('unsaved')` 유지 + 에러 알림

---

### Milestone 2: 다른 이름으로 저장 (Priority High - Primary Goal)

Ctrl+Shift+S 단축키와 Tauri 네이티브 Save-As 대화상자를 연동한다.

**Task 2.1: save_file_as Tauri 커맨드 구현**
- 파일: `src-tauri/src/commands/file_ops.rs`
- `save_file_as(path: String, content: String)` 커맨드 추가
- `directory_ops.rs`의 `open_directory_dialog` 패턴 참고
- 파일 쓰기 + 경로 반환

**Task 2.2: save_file_as 커맨드 등록**
- 파일: `src-tauri/src/lib.rs`
- `save_file_as` 커맨드를 invoke_handler에 등록

**Task 2.3: saveFileAs IPC wrapper**
- 파일: `src/lib/tauri/ipc.ts`
- `saveFileAs(path: string, content: string)` 함수 추가
- `invoke('save_file_as', { path, content })` 호출

**Task 2.4: npm @tauri-apps/plugin-dialog 설치 및 Save-As 다이얼로그**
- npm: `@tauri-apps/plugin-dialog` 추가 (이미 Rust 측은 등록됨)
- `save()` dialog API를 사용한 파일 경로 선택
- 파일 경로 선택 후 `saveFileAs()` 호출

**Task 2.5: Ctrl+Shift+S 키맵 등록**
- 파일: `src/components/editor/MarkdownEditor.tsx`
- CodeMirror keymap에 `Mod-Shift-s` 추가
- Save-As 다이얼로그 트리거 → 파일 저장 → editorStore currentFile 업데이트

---

### Milestone 3: 미저장 변경사항 경고 (Priority High - Primary Goal)

파일 전환 시 미저장 변경사항을 감지하고 사용자에게 경고한다.

**Task 3.1: 미저장 경고 다이얼로그 구현**
- useFileSystem Hook에 `openFileWithWarning(path)` 함수 추가
- editorStore의 `isDirty` 상태 확인
- isDirty가 true이면 경고 다이얼로그 표시:
  - "저장" → 현재 파일 저장 후 전환
  - "저장하지 않음" → 변경사항 버리고 전환
  - "취소" → 파일 전환 취소
- isDirty가 false이면 즉시 파일 전환

**Task 3.2: FileTreeNode 클릭 핸들러 연동**
- `FileTreeNode` 또는 `useFileSystem`의 `openFile`을 `openFileWithWarning`으로 교체
- 기존 파일 클릭 동작에 unsaved warning 추가

---

### Milestone 4: 툴바 버튼 동작 연결 (Priority Medium - Secondary Goal)

EditorToolbar의 포맷 버튼을 에디터의 기존 포맷 함수와 연결한다.

**Task 4.1: EditorView 외부 노출 (onViewReady 패턴)**
- 파일: `src/components/editor/MarkdownEditor.tsx`
- `onViewReady?: (view: EditorView) => void` prop 추가
- EditorView 생성 완료 시 부모 컴포넌트에 콜백 호출
- AppLayout에서 `viewRef` (useRef)로 EditorView 참조 보관

**Task 4.2: keyboard-shortcuts.ts에 applyMarkdownFormat, prefixLine 추가**
- 파일: `src/components/editor/extensions/keyboard-shortcuts.ts`
- `applyMarkdownFormat(view: EditorView, format: string)` export 함수 추가
  - format 종류: `'bold'`, `'italic'`, `'code'`, `'strikethrough'`, `'link'`
  - 내부적으로 `wrapSelection` 재사용
- `prefixLine(view: EditorView, prefix: string)` export 함수 추가
  - prefix 종류: `'heading'` → `## `, `'list'` → `- `, `'quote'` → `> `, `'hr'` → `---`
  - 현재 커서 라인 앞에 접두사 추가

**Task 4.3: EditorToolbar onFormat 콜백 연결**
- 파일: `src/components/editor/EditorToolbar.tsx`
- `onFormat?: (format: string) => void` prop 추가
- 각 툴바 버튼 클릭 시 `onFormat('bold')`, `onFormat('italic')` 등 호출
- AppLayout에서 onFormat 핸들러 구현: `viewRef.current`로 `applyMarkdownFormat`/`prefixLine` 호출

---

### Milestone 5: 새 파일 단축키 (Priority Medium - Secondary Goal)

Ctrl+N으로 새 파일을 생성하는 기능을 구현한다.

**Task 5.1: Ctrl+N 키맵 등록**
- 파일: `src/components/editor/MarkdownEditor.tsx`
- CodeMirror keymap에 `Mod-n` 추가
- 미저장 경고 확인 후 에디터 초기화:
  - editorStore의 `content`를 빈 문자열로 설정
  - editorStore의 `currentFile`을 null로 설정
  - uiStore의 `saveStatus`를 `'new'`로 설정

---

### Milestone 6: 단어/글자 수 표시 (Priority Medium - Secondary Goal)

Footer에 현재 에디터 콘텐츠의 단어 수와 글자 수를 실시간 표시한다.

**Task 6.1: 단어/글자 수 계산 로직**
- editorStore의 `content`에서 계산
- 단어 수: 공백/줄바꿈 기준 분할 후 빈 문자열 제외 카운트
- 글자 수: `content.length` (공백 포함)
- 빈 콘텐츠 시 0, 0 반환

**Task 6.2: Footer에 단어/글자 수 표시**
- 파일: `src/components/layout/Footer.tsx`
- editorStore의 `content` 구독 (또는 계산된 값 전달)
- 표시 형식: "123 words 456 chars"
- saveStatus 영역과 함께 Footer 좌측/우측에 배치

---

## Technology Stack

| 기술 | 버전 | 역할 |
|------|------|------|
| React | 18.x | UI 프레임워크 |
| TypeScript | 5.x+ | 타입 안전성 |
| CodeMirror | 6.x | 에디터 API (EditorView, keymap) |
| Zustand | 5.x | 상태 관리 (uiStore, editorStore) |
| @tauri-apps/plugin-dialog | 2.x | 네이티브 Save-As 대화상자 |
| Tauri | 2.x | 백엔드 IPC |
| Tailwind CSS | 3.x | 유틸리티 CSS 스타일링 |

---

## Risk Analysis

### Risk 1: EditorView 외부 노출 패턴

- **확률**: Low
- **영향**: High (아키텍처 안티패턴 유발 가능)
- **완화 전략**: `onViewReady` 콜백 패턴으로 EditorView를 부모 컴포넌트의 `useRef`에 보관. Zustand store에 DOM 객체 저장 금지.
- **대안**: 커스텀 이벤트 기반 통신 또는 React Context 활용

### Risk 2: 다른 이름으로 저장 시 권한 문제

- **확률**: Medium
- **영향**: Medium (저장 실패)
- **완화 전략**: Tauri dialog는 OS 레벨 권한 검증을 자체 처리. 저장 실패 시 에러 메시지 표시. saveStatus를 'unsaved'로 유지.
- **대안**: 파일 쓰기 전 경로 접근 권한 사전 검증

### Risk 3: 미저장 경고 다이얼로그와 비동기 파일 작업 충돌

- **확률**: Medium
- **영향**: Low (이중 저장 가능)
- **완화 전략**: 다이얼로그 표시 중 파일 전환 이벤트 차단. 저장 중 추가 저장 요청 무시 (debounce).
- **대안**: 전역 lock 상태로 동시 파일 작업 방지

### Risk 4: 단어 수 계산 성능 (대용량 문서)

- **확률**: Low
- **영향**: Low (계산 지연)
- **완화 전략**: 10KB 문서 기준 < 10ms 목표. 필요 시 debounce 적용 또는 Web Worker 오프로딩.
- **대안**: 에디터 변경 시 증분 계산 (변경된 라인만 재계산)

### Risk 5: tauri-plugin-dialog npm 패키지 미설치

- **확률**: Low
- **영향**: High (Save-As 대화상자 미동작)
- **완화 전략**: Rust 측은 이미 등록되어 있으므로 npm 패키지만 추가 필요. 설치 확인 테스트 포함.
- **대안**: 직접 Tauri IPC invoke로 OS 대화상자 호출

---

## File Manifest

| 파일 경로 | 유형 | 설명 |
|-----------|------|------|
| `src/store/uiStore.ts` | Store (수정) | saveStatus 상태 및 setSaveStatus 액션 추가 |
| `src/components/layout/Footer.tsx` | Component (수정) | saveStatus 표시, 단어/글자 수 표시 |
| `src/components/editor/MarkdownEditor.tsx` | Component (수정) | Save-As keymap, Ctrl+N, onViewReady prop |
| `src/components/editor/EditorToolbar.tsx` | Component (수정) | onFormat 콜백 prop 연결 |
| `src/components/editor/extensions/keyboard-shortcuts.ts` | Extension (수정) | applyMarkdownFormat, prefixLine 함수 추가 |
| `src/components/layout/AppLayout.tsx` | Component (수정) | viewRef 관리, onFormat 핸들러, word count 전달 |
| `src/hooks/useFileSystem.ts` | Hook (수정) | unsaved warning 로직, saveFileAs 추가 |
| `src/lib/tauri/ipc.ts` | Utility (수정) | saveFileAs wrapper 추가 |
| `src-tauri/src/commands/file_ops.rs` | Rust Command (수정) | save_file_as 커맨드 추가 |
| `src-tauri/src/lib.rs` | Rust Config (수정) | save_file_as 커맨드 등록 |

---

## Traceability

- SPEC Reference: SPEC-EDITOR-002
- Product Reference: product.md - Core Feature 1 (Markdown Editor), Core Feature 4 (File Operations)
- Structure Reference: structure.md - `src/components/editor/`, `src/components/layout/`, `src/store/uiStore.ts`
