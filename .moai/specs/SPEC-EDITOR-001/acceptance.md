# Acceptance Criteria: SPEC-EDITOR-001

## 개요

SPEC-EDITOR-001 (Markdown Editor - CodeMirror 6)의 상세 인수 기준. 모든 시나리오는 Given-When-Then 형식으로 작성되며, 기능 완료의 명확한 판단 기준을 제공한다.

---

## Test Scenarios

### Scenario 1: 에디터 초기화 및 기본 렌더링

- **Given**: MarkdownEditor 컴포넌트가 마운트된 상태
- **When**: 컴포넌트가 화면에 렌더링될 때
- **Then**:
  - CodeMirror 6 에디터 인스턴스가 생성되어야 한다
  - 좌측에 줄 번호가 표시되어야 한다
  - 자동 줄 바꿈이 활성화되어 수평 스크롤바가 나타나지 않아야 한다
  - 현재 커서 줄이 강조 표시되어야 한다
  - Markdown 언어 지원이 활성화되어야 한다

### Scenario 2: 에디터 콘텐츠와 Store 동기화

- **Given**: 에디터가 초기화되고 editorStore의 dirty가 `false`인 상태
- **When**: 사용자가 에디터에 텍스트를 입력할 때
- **Then**:
  - editorStore의 `content`가 입력된 텍스트로 업데이트되어야 한다
  - editorStore의 `dirty`가 `true`로 변경되어야 한다
  - editorStore의 `cursorPosition`이 현재 커서 위치로 업데이트되어야 한다

### Scenario 3: Ctrl+S 파일 저장 (기존 파일)

- **Given**: editorStore의 `currentFilePath`가 `/path/to/file.md`이고, `dirty`가 `true`인 상태
- **When**: 사용자가 `Ctrl+S` (macOS: `Cmd+S`)를 입력할 때
- **Then**:
  - Tauri IPC `write_file` 커맨드가 해당 경로와 현재 콘텐츠로 호출되어야 한다
  - 저장 성공 시 editorStore의 `dirty`가 `false`로 변경되어야 한다
  - 파일 저장 대화상자가 나타나지 않아야 한다

### Scenario 4: Ctrl+S 파일 저장 (새 파일)

- **Given**: editorStore의 `currentFilePath`가 `null`인 상태
- **When**: 사용자가 `Ctrl+S`를 입력할 때
- **Then**:
  - Tauri 네이티브 파일 저장 대화상자가 표시되어야 한다
  - 사용자가 경로를 선택하면 해당 경로로 저장되어야 한다
  - 저장 성공 시 editorStore의 `currentFilePath`가 선택된 경로로 설정되어야 한다
  - editorStore의 `dirty`가 `false`로 변경되어야 한다

### Scenario 5: 저장 실패 시 동작

- **Given**: editorStore의 `dirty`가 `true`인 상태
- **When**: 파일 저장이 실패할 때 (권한 오류, 디스크 부족 등)
- **Then**:
  - 사용자에게 에러 메시지가 표시되어야 한다
  - editorStore의 `dirty`는 `true`로 유지되어야 한다
  - 에디터 콘텐츠는 변경되지 않아야 한다

### Scenario 6: Ctrl+B 볼드 서식 (선택 영역 있음)

- **Given**: 에디터에서 "hello" 텍스트가 선택된 상태
- **When**: 사용자가 `Ctrl+B`를 입력할 때
- **Then**: 선택 영역이 `**hello**`로 변경되어야 한다

### Scenario 7: Ctrl+B 볼드 서식 (선택 영역 없음)

- **Given**: 에디터에서 선택 영역이 없는 상태
- **When**: 사용자가 `Ctrl+B`를 입력할 때
- **Then**:
  - 커서 위치에 `****`가 삽입되어야 한다
  - 커서가 두 `**` 사이에 배치되어야 한다

### Scenario 8: Ctrl+I 이탤릭 서식

- **Given**: 에디터에서 "world" 텍스트가 선택된 상태
- **When**: 사용자가 `Ctrl+I`를 입력할 때
- **Then**: 선택 영역이 `*world*`로 변경되어야 한다

### Scenario 9: Ctrl+/ 주석 토글

- **Given**: 에디터에서 커서가 일반 텍스트 줄에 있는 상태
- **When**: 사용자가 `Ctrl+/`를 입력할 때
- **Then**: 해당 줄이 `<!-- text -->`로 감싸져야 한다

- **Given**: 에디터에서 커서가 `<!-- text -->` 주석 줄에 있는 상태
- **When**: 사용자가 `Ctrl+/`를 입력할 때
- **Then**: 주석이 제거되고 `text`만 남아야 한다

### Scenario 10: 리스트 자동 연속 생성 (순서 없는 리스트)

- **Given**: 에디터에서 `- item` 줄 끝에 커서가 있는 상태
- **When**: 사용자가 `Enter`를 입력할 때
- **Then**: 새 줄에 `- `가 자동으로 삽입되어야 한다

### Scenario 11: 리스트 자동 연속 생성 (순서 있는 리스트)

- **Given**: 에디터에서 `1. first item` 줄 끝에 커서가 있는 상태
- **When**: 사용자가 `Enter`를 입력할 때
- **Then**: 새 줄에 `2. `가 자동으로 삽입되어야 한다

### Scenario 12: 빈 리스트 항목에서 Enter

- **Given**: 에디터에서 `- ` (빈 리스트 항목) 줄에 커서가 있는 상태
- **When**: 사용자가 `Enter`를 입력할 때
- **Then**: 리스트 마커가 제거되고 일반 빈 줄이 생성되어야 한다

### Scenario 13: 인용문 자동 연속

- **Given**: 에디터에서 `> quote text` 줄 끝에 커서가 있는 상태
- **When**: 사용자가 `Enter`를 입력할 때
- **Then**: 새 줄에 `> `가 자동으로 삽입되어야 한다

### Scenario 14: Tab 리스트 들여쓰기

- **Given**: 에디터에서 `- item` 줄 시작 위치에 커서가 있는 상태
- **When**: 사용자가 `Tab`을 입력할 때
- **Then**: 리스트 항목이 한 단계 들여쓰기 되어야 한다 (`  - item`)

### Scenario 15: Shift+Tab 리스트 내어쓰기

- **Given**: 에디터에서 `  - item` (들여쓰기된 리스트 항목) 줄에 커서가 있는 상태
- **When**: 사용자가 `Shift+Tab`을 입력할 때
- **Then**: 리스트 항목의 들여쓰기가 한 단계 감소되어야 한다 (`- item`)

### Scenario 16: 찾기/바꾸기 패널

- **Given**: 에디터에 `Hello World Hello`라는 텍스트가 있는 상태
- **When**: 사용자가 `Ctrl+F`를 입력하고 "Hello"를 검색할 때
- **Then**:
  - 찾기/바꾸기 패널이 표시되어야 한다
  - 일치하는 "Hello" 2개가 시각적으로 강조되어야 한다
  - 현재 일치 위치가 표시되어야 한다 (예: 1/2)

### Scenario 17: 정규식 검색

- **Given**: 찾기/바꾸기 패널이 열려 있고 정규식 모드가 활성화된 상태
- **When**: 사용자가 `\d+` 패턴을 입력할 때
- **Then**: 문서 내 모든 숫자 시퀀스가 강조되어야 한다

### Scenario 18: Markdown 구문 강조

- **Given**: 에디터가 초기화된 상태
- **When**: 사용자가 `# Heading 1`을 입력할 때
- **Then**: 헤더 텍스트에 구문 강조 스타일(더 큰 글꼴, 색상 변경)이 적용되어야 한다

- **Given**: 에디터가 초기화된 상태
- **When**: 사용자가 ` ```javascript\nconsole.log();\n``` `을 입력할 때
- **Then**: 코드 블록에 배경색이 적용되고 언어 태그가 표시되어야 한다

### Scenario 19: EditorToolbar 서식 버튼

- **Given**: 에디터에서 "text" 가 선택된 상태
- **When**: EditorToolbar의 "Bold" 버튼을 클릭할 때
- **Then**: 선택 영역이 `**text**`로 변경되어야 한다

- **Given**: 에디터에서 커서가 빈 줄에 있는 상태
- **When**: EditorToolbar의 "Unordered List" 버튼을 클릭할 때
- **Then**: 커서 위치에 `- `가 삽입되어야 한다

### Scenario 20: 에디터 언마운트 시 정리

- **Given**: MarkdownEditor 컴포넌트가 마운트된 상태
- **When**: 컴포넌트가 언마운트될 때
- **Then**:
  - CodeMirror EditorView의 `destroy()` 메서드가 호출되어야 한다
  - 메모리 누수가 발생하지 않아야 한다 (이벤트 리스너 정리 확인)

---

## Edge Cases

### Edge Case 1: 빈 문서에서의 서식 적용

- **Given**: 에디터에 콘텐츠가 없는 빈 문서 상태
- **When**: `Ctrl+B`를 입력할 때
- **Then**: `****`가 삽입되고 커서가 중앙에 위치해야 한다

### Edge Case 2: 전체 선택 후 서식 적용

- **Given**: 에디터의 전체 콘텐츠가 선택된 상태
- **When**: `Ctrl+B`를 입력할 때
- **Then**: 전체 콘텐츠가 `**content**`로 감싸져야 한다

### Edge Case 3: 이미 볼드 처리된 텍스트에 Ctrl+B

- **Given**: 에디터에서 `**bold text**`의 "bold text" 부분이 선택된 상태
- **When**: `Ctrl+B`를 입력할 때
- **Then**: 볼드가 해제되어 `bold text`만 남아야 한다

### Edge Case 4: 50KB 초과 파일 로딩

- **Given**: 50KB 이상의 Markdown 파일이 존재하는 상태
- **When**: 해당 파일을 에디터에 로딩할 때
- **Then**:
  - 파일이 500ms 이내에 에디터에 표시되어야 한다
  - 스크롤 시 지연 없이 콘텐츠가 렌더링되어야 한다
  - 키 입력 지연이 50ms 미만이어야 한다

### Edge Case 5: 동시 저장 요청

- **Given**: 파일 저장이 진행 중인 상태
- **When**: 사용자가 다시 `Ctrl+S`를 입력할 때
- **Then**: 중복 저장이 방지되어야 한다 (첫 번째 저장 완료 후 처리)

### Edge Case 6: 특수 문자 포함 파일명

- **Given**: 파일 경로에 공백, 한글, 특수 문자가 포함된 상태
- **When**: 해당 파일을 저장할 때
- **Then**: 파일이 정상적으로 저장되어야 한다

### Edge Case 7: 외부 파일 변경 중 저장

- **Given**: 다른 프로그램에서 현재 편집 중인 파일을 수정한 상태
- **When**: 사용자가 MdEdit에서 `Ctrl+S`를 입력할 때
- **Then**: 현재 에디터 콘텐츠로 파일이 덮어쓰기 저장되어야 한다

---

## Performance Criteria

| 지표                          | 기준값          | 측정 방법                              |
| ----------------------------- | --------------- | -------------------------------------- |
| 키 입력-화면 표시 지연        | < 50ms          | Performance API 타이밍 측정            |
| 에디터 초기화 시간            | < 300ms         | 컴포넌트 마운트 ~ 첫 입력 가능 시점    |
| 50KB 파일 로딩 시간           | < 500ms         | 파일 읽기 시작 ~ 에디터 표시 완료      |
| editorStore 동기화 시간       | < 16ms          | onChange ~ store 업데이트 완료         |
| 찾기/바꾸기 10KB 문서 검색    | < 100ms         | 검색 쿼리 입력 ~ 결과 강조 완료       |
| 메모리 사용량 (에디터 단독)   | < 50MB 추가     | 기본 앱 메모리 대비 증가량             |

---

## Quality Gates

### TRUST 5 Framework

| 차원        | 기준                                                     |
| ----------- | -------------------------------------------------------- |
| Tested      | 모든 REQ에 대응하는 테스트 존재, 85%+ 코드 커버리지      |
| Readable    | TypeScript strict 모드, 명확한 변수/함수명               |
| Unified     | ESLint + Prettier 규칙 통과, Tailwind 클래스 정렬        |
| Secured     | XSS 벡터 차단, 안전한 파일 경로 처리                     |
| Trackable   | 모든 커밋에 SPEC-EDITOR-001 참조                         |

### Definition of Done

- [ ] 모든 Ubiquitous Requirements (U01-U09) 구현 완료
- [ ] 모든 Event-Driven Requirements (E01-E13) 구현 완료
- [ ] 모든 State-Driven Requirements (S01-S04) 구현 완료
- [ ] 모든 Unwanted Behavior Requirements (N01-N04) 검증 완료
- [ ] 키 입력 지연 < 50ms 성능 테스트 통과
- [ ] 50KB 파일 성능 테스트 통과
- [ ] editorStore 양방향 동기화 무한 루프 없음 확인
- [ ] CodeMirror 언마운트 시 메모리 누수 없음 확인
- [ ] EditorToolbar 모든 버튼 동작 확인
- [ ] macOS, Windows, Linux 플랫폼 키보드 단축키 호환성 확인
- [ ] TypeScript strict 모드 타입 오류 0개
- [ ] ESLint 경고/오류 0개
