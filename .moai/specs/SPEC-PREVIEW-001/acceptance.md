# Acceptance Criteria: SPEC-PREVIEW-001

## 개요

SPEC-PREVIEW-001 (Real-Time Markdown Preview)의 상세 인수 기준. 모든 시나리오는 Given-When-Then 형식으로 작성되며, 렌더링 파이프라인의 정확성, 보안, 성능을 검증한다.

---

## Test Scenarios

### Scenario 1: 기본 Markdown 렌더링

- **Given**: editorStore의 `content`에 `# Hello World\n\nThis is **bold** and *italic*.`가 설정된 상태
- **When**: 300ms 디바운스 후 미리보기가 업데이트될 때
- **Then**:
  - `<h1>Hello World</h1>` 헤더가 렌더링되어야 한다
  - `<strong>bold</strong>` 볼드 텍스트가 렌더링되어야 한다
  - `<em>italic</em>` 이탤릭 텍스트가 렌더링되어야 한다
  - 단락 태그로 감싸져야 한다

### Scenario 2: 디바운스 동작 검증

- **Given**: editorStore의 `content`가 비어 있는 상태
- **When**: 200ms 간격으로 3회 연속 콘텐츠가 변경될 때 (A -> B -> C)
- **Then**:
  - 마지막 변경(C) 이후 300ms 후에만 렌더링이 수행되어야 한다
  - 중간 변경(A, B)에 대한 렌더링은 발생하지 않아야 한다
  - 최종 렌더링 결과는 C 콘텐츠에 대한 것이어야 한다

### Scenario 3: 코드 블록 Shiki 하이라이팅

- **Given**: editorStore의 `content`에 JavaScript 코드 블록이 포함된 상태
  ````
  ```javascript
  const x = 42;
  console.log(x);
  ```
  ````
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - 코드 블록에 Shiki 구문 강조가 적용되어야 한다
  - `const`, `42`, `console` 등 토큰이 각각 다른 색상으로 표시되어야 한다
  - 코드 블록에 배경색과 둥근 모서리 스타일이 적용되어야 한다

### Scenario 4: Shiki 미초기화 시 폴백 렌더링

- **Given**: Shiki 하이라이터가 아직 초기화되지 않은 상태
- **When**: 코드 블록이 포함된 Markdown이 렌더링될 때
- **Then**:
  - 코드 블록이 스타일 없는 `<pre><code>` 태그로 렌더링되어야 한다
  - Shiki 초기화 완료 후 자동으로 구문 강조가 적용되어야 한다

### Scenario 5: 언어 미지정 코드 블록

- **Given**: 언어가 지정되지 않은 코드 블록 (` ``` ` 단독)이 있는 상태
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - 일반 텍스트로 렌더링되어야 한다
  - 코드 블록 배경 스타일은 적용되어야 한다
  - Shiki 하이라이팅은 적용되지 않아야 한다

### Scenario 6: Mermaid 다이어그램 렌더링

- **Given**: editorStore의 `content`에 Mermaid flowchart 코드 블록이 포함된 상태
  ````
  ```mermaid
  graph TD
    A[Start] --> B[Process]
    B --> C[End]
  ```
  ````
- **When**: 미리보기가 렌더링되고 해당 영역이 뷰포트에 있을 때
- **Then**:
  - Mermaid가 flowchart SVG 다이어그램을 렌더링해야 한다
  - "Start", "Process", "End" 노드와 화살표가 표시되어야 한다
  - 렌더링 시간이 500ms 미만이어야 한다

### Scenario 7: Mermaid 지연 로딩

- **Given**: 미리보기 하단에 Mermaid 다이어그램이 있고 현재 뷰포트 밖에 있는 상태
- **When**: 미리보기가 처음 렌더링될 때
- **Then**:
  - 뷰포트 밖의 Mermaid 다이어그램은 렌더링되지 않아야 한다
  - 사용자가 해당 영역으로 스크롤하면 다이어그램이 렌더링 시작되어야 한다

### Scenario 8: 유효하지 않은 Mermaid 구문

- **Given**: 유효하지 않은 Mermaid 구문이 포함된 코드 블록이 있는 상태
  ````
  ```mermaid
  graph INVALID
    <<<broken syntax>>>
  ```
  ````
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - 해당 다이어그램 위치에 에러 메시지가 인라인으로 표시되어야 한다
  - 다른 Markdown 콘텐츠는 정상적으로 렌더링되어야 한다
  - 미리보기 전체가 중단되지 않아야 한다

### Scenario 9: 테이블 렌더링

- **Given**: 정렬이 지정된 Markdown 테이블이 있는 상태
  ```
  | Left | Center | Right |
  |:-----|:------:|------:|
  | A    | B      | C     |
  ```
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - `<table>` 태그가 렌더링되어야 한다
  - 첫 번째 열은 좌측 정렬, 두 번째 열은 중앙 정렬, 세 번째 열은 우측 정렬이어야 한다
  - 테이블 스타일링 (줄무늬 행 등)이 적용되어야 한다

### Scenario 10: 각주 렌더링

- **Given**: 각주가 포함된 Markdown이 있는 상태
  ```
  This has a footnote[^1].

  [^1]: Footnote content here.
  ```
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - 본문에 각주 참조 링크가 표시되어야 한다
  - 문서 하단에 각주 내용이 렌더링되어야 한다

### Scenario 11: 취소선 렌더링

- **Given**: 취소선이 포함된 Markdown이 있는 상태 (`~~strikethrough~~`)
- **When**: 미리보기가 렌더링될 때
- **Then**: `<del>strikethrough</del>` 취소선 스타일이 적용되어야 한다

### Scenario 12: 코드 블록 복사 버튼

- **Given**: 코드 블록이 포함된 미리보기가 렌더링된 상태
- **When**: 코드 블록의 복사 버튼을 클릭할 때
- **Then**:
  - 코드 블록의 원본 텍스트(하이라이팅 마크업 제외)가 클립보드에 복사되어야 한다
  - 복사 성공 피드백 (체크마크 아이콘 등)이 표시되어야 한다

### Scenario 13: XSS 방지 검증

- **Given**: editorStore의 `content`에 `<script>alert('xss')</script>`가 포함된 상태
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - `<script>` 태그가 실행되지 않아야 한다
  - 해당 텍스트가 이스케이프되어 일반 텍스트로 표시되어야 한다

### Scenario 14: 빈 콘텐츠 처리

- **Given**: editorStore의 `content`가 빈 문자열인 상태
- **When**: 미리보기가 렌더링될 때
- **Then**: 플레이스홀더 메시지 또는 빈 상태 UI가 표시되어야 한다

### Scenario 15: 중첩 리스트 렌더링

- **Given**: 중첩된 순서 없는/있는 리스트가 포함된 Markdown이 있는 상태
  ```
  - Item 1
    - Nested 1
    - Nested 2
  - Item 2
    1. Ordered 1
    2. Ordered 2
  ```
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - 올바른 중첩 구조로 렌더링되어야 한다
  - 순서 없는 리스트와 순서 있는 리스트가 정확히 구분되어야 한다
  - 들여쓰기 레벨이 시각적으로 구분되어야 한다

### Scenario 16: 인용문 중첩 렌더링

- **Given**: 중첩된 인용문이 포함된 Markdown이 있는 상태
  ```
  > Level 1 quote
  >> Level 2 quote
  >>> Level 3 quote
  ```
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - 3단계 중첩 `<blockquote>` 태그가 렌더링되어야 한다
  - 각 레벨이 시각적으로 구분 (좌측 보더, 들여쓰기)되어야 한다

### Scenario 17: 이미지 렌더링

- **Given**: 이미지 Markdown (`![Alt text](image-url.png)`)이 포함된 상태
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - `<img>` 태그가 렌더링되어야 한다
  - alt 속성이 "Alt text"로 설정되어야 한다
  - src 속성이 "image-url.png"으로 설정되어야 한다

### Scenario 18: 여러 Mermaid 다이어그램 유형

- **Given**: flowchart, sequence, state, gitGraph 등 다양한 Mermaid 다이어그램이 포함된 상태
- **When**: 각 다이어그램이 뷰포트에 진입할 때
- **Then**:
  - 각 다이어그램 유형이 올바른 SVG로 렌더링되어야 한다
  - 개별 다이어그램 실패가 다른 다이어그램에 영향을 주지 않아야 한다

### Scenario 19: 수평선 렌더링

- **Given**: `---` 또는 `***`가 포함된 Markdown이 있는 상태
- **When**: 미리보기가 렌더링될 때
- **Then**: `<hr>` 태그가 렌더링되어 시각적 구분선이 표시되어야 한다

### Scenario 20: 링크 렌더링

- **Given**: `[Google](https://google.com)`이 포함된 Markdown이 있는 상태
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - `<a>` 태그가 렌더링되어야 한다
  - href가 "https://google.com"이어야 한다
  - 텍스트가 "Google"이어야 한다

---

## Edge Cases

### Edge Case 1: 매우 큰 Mermaid 다이어그램

- **Given**: 50개 이상의 노드가 있는 복잡한 flowchart Mermaid 코드가 있는 상태
- **When**: 해당 다이어그램이 렌더링될 때
- **Then**:
  - 렌더링이 완료되어야 한다 (최대 2000ms 허용)
  - 렌더링 실패 시 타임아웃 에러를 인라인으로 표시해야 한다
  - 다른 미리보기 콘텐츠는 정상적으로 표시되어야 한다

### Edge Case 2: 동시에 10개 이상의 코드 블록

- **Given**: 10개 이상의 서로 다른 언어 코드 블록이 포함된 Markdown이 있는 상태
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - 모든 코드 블록에 구문 강조가 적용되어야 한다
  - 전체 렌더링 시간이 합리적 범위 (< 2000ms) 이내여야 한다
  - 각 코드 블록에 복사 버튼이 있어야 한다

### Edge Case 3: Shiki가 지원하지 않는 언어

- **Given**: Shiki에 등록되지 않은 언어 (예: ` ```brainfuck `)가 지정된 코드 블록이 있는 상태
- **When**: 미리보기가 렌더링될 때
- **Then**:
  - 코드 블록이 일반 텍스트로 렌더링되어야 한다
  - 코드 블록 배경 스타일은 적용되어야 한다
  - 에러가 발생하지 않아야 한다

### Edge Case 4: 빈 코드 블록

- **Given**: 내용이 없는 빈 코드 블록 (` ``` ``` `)이 있는 상태
- **When**: 미리보기가 렌더링될 때
- **Then**: 빈 코드 블록이 배경 스타일과 함께 렌더링되어야 한다

### Edge Case 5: 빠른 연속 타이핑 중 미리보기

- **Given**: 사용자가 100WPM 이상의 속도로 타이핑 중인 상태
- **When**: 타이핑이 계속될 때
- **Then**:
  - 디바운스가 정상 작동하여 마지막 입력 후 300ms 뒤에만 렌더링되어야 한다
  - 에디터 입력이 미리보기 렌더링으로 인해 차단되지 않아야 한다
  - 메모리 누수가 발생하지 않아야 한다 (이전 디바운스 타이머 정리)

### Edge Case 6: markdown-it 플러그인 충돌

- **Given**: mermaidPlugin과 Shiki highlight가 동시에 활성화된 상태
- **When**: ` ```mermaid ` 코드 블록이 렌더링될 때
- **Then**:
  - mermaidPlugin이 해당 블록을 인터셉트하여 `<div data-diagram>`으로 변환해야 한다
  - Shiki가 mermaid 블록을 하이라이팅하지 않아야 한다
  - 비-mermaid 코드 블록은 정상적으로 Shiki 처리되어야 한다

### Edge Case 7: 특수 문자 포함 다이어그램

- **Given**: Mermaid 다이어그램에 HTML 특수 문자 (`<`, `>`, `&`, `"`)가 포함된 상태
- **When**: 다이어그램이 렌더링될 때
- **Then**: 특수 문자가 올바르게 이스케이프되어 렌더링되어야 한다

---

## Performance Criteria

| 지표                              | 기준값         | 측정 방법                              |
| --------------------------------- | -------------- | -------------------------------------- |
| markdown-it 변환 시간 (10KB)      | < 50ms         | Performance API: render() 시작~종료    |
| markdown-it 변환 시간 (50KB)      | < 200ms        | Performance API: render() 시작~종료    |
| Mermaid 단일 다이어그램 렌더링    | < 500ms        | IntersectionObserver 트리거 ~ SVG 삽입 |
| Shiki 싱글턴 초기화               | < 1000ms       | createHighlighter() 호출 ~ resolve     |
| Shiki 코드 블록 하이라이팅 (단일) | < 30ms         | highlightCode() 호출 ~ HTML 반환       |
| 디바운스 정확도                   | 300ms +/- 50ms | 마지막 입력 ~ 렌더링 시작 시간 차이    |
| 전체 파이프라인 (10KB, Mermaid 포함)| < 850ms      | 콘텐츠 변경 ~ 최종 DOM 업데이트 완료   |
| 메모리 사용량 (미리보기 단독)     | < 80MB 추가    | 기본 앱 메모리 대비 증가량             |
| 코드 블록 복사 응답 시간          | < 100ms        | 버튼 클릭 ~ 클립보드 복사 완료         |

---

## Quality Gates

### TRUST 5 Framework

| 차원        | 기준                                                              |
| ----------- | ----------------------------------------------------------------- |
| Tested      | 모든 REQ에 대응하는 테스트 존재, 85%+ 코드 커버리지               |
| Readable    | TypeScript strict 모드, 명확한 변수/함수명, JSDoc 주석            |
| Unified     | ESLint + Prettier 규칙 통과, Tailwind 클래스 정렬                 |
| Secured     | XSS 방지 (html: false), Mermaid strict, innerHTML 사용 제한      |
| Trackable   | 모든 커밋에 SPEC-PREVIEW-001 참조                                 |

### 보안 검증 체크리스트

- [ ] markdown-it의 `html` 옵션이 `false`로 설정됨 확인
- [ ] Mermaid의 `securityLevel`이 `'strict'`로 설정됨 확인
- [ ] `<script>` 태그 주입 테스트 통과
- [ ] `<iframe>` 태그 주입 테스트 통과
- [ ] `javascript:` URI 스킴 테스트 통과
- [ ] Event handler 속성 (`onclick` 등) 주입 테스트 통과

### Definition of Done

- [ ] 모든 Ubiquitous Requirements (U01-U06) 구현 완료
- [ ] 모든 Event-Driven Requirements (E01-E06) 구현 완료
- [ ] 모든 State-Driven Requirements (S01-S04) 구현 완료
- [ ] 모든 Unwanted Behavior Requirements (N01-N05) 검증 완료
- [ ] markdown-it 변환 10KB < 50ms 성능 테스트 통과
- [ ] Mermaid 렌더링 < 500ms 성능 테스트 통과
- [ ] 300ms 디바운스 정확성 테스트 통과
- [ ] Shiki 싱글턴 초기화 및 폴백 검증 완료
- [ ] XSS 보안 테스트 6항목 모두 통과
- [ ] Mermaid 에러 격리 검증 완료
- [ ] 코드 블록 복사 버튼 동작 확인
- [ ] 각주, 취소선, 테이블 렌더링 검증 완료
- [ ] flowchart, sequence, state, gitGraph 4종 Mermaid 다이어그램 렌더링 확인
- [ ] TypeScript strict 모드 타입 오류 0개
- [ ] ESLint 경고/오류 0개
