# Acceptance Criteria: SPEC-PREVIEW-002 Editor-Preview Scroll Synchronization

## Test Scenarios

### Scenario 1: data-line 속성 주입 - 단락

- **Given**: Markdown 콘텐츠에 3번째 라인에 단락이 있는 상태
  ```
  # Title

  This is a paragraph.
  ```
- **When**: markdown-it으로 렌더링될 때
- **Then**: `<p data-line="2">This is a paragraph.</p>`와 같이 data-line 속성이 주입되어야 한다
- **And**: `<h1 data-line="0">Title</h1>`에도 data-line이 있어야 한다

### Scenario 2: data-line 속성 주입 - 코드 블록

- **Given**: Markdown 콘텐츠에 5번째 라인에 코드 블록이 있는 상태
- **When**: markdown-it으로 렌더링될 때
- **Then**: `<pre data-line="4">` 속성이 주입되어야 한다
- **And**: Shiki 하이라이팅에 영향을 주지 않아야 한다

### Scenario 3: data-line 속성 주입 - 리스트, 테이블, 인용문

- **Given**: Markdown 콘텐츠에 리스트, 테이블, 인용문이 포함된 상태
- **When**: markdown-it으로 렌더링될 때
- **Then**: `<ul data-line="N">`, `<table data-line="N">`, `<blockquote data-line="N">`에 각각 data-line이 주입되어야 한다

### Scenario 4: 기존 렌더링 영향 없음

- **Given**: Mermaid 다이어그램과 Shiki 코드 블록이 포함된 Markdown
- **When**: data-line 플러그인이 활성화된 상태에서 렌더링될 때
- **Then**: Mermaid 다이어그램이 정상적으로 렌더링되어야 한다
- **And**: Shiki 코드 하이라이팅이 정상적으로 적용되어야 한다
- **And**: data-line 속성만 추가되고 다른 렌더링은 변경되지 않아야 한다

### Scenario 5: 에디터 스크롤 → 미리보기 동기화

- **Given**: 스크롤 동기화가 활성화되고 에디터와 미리보기에 100라인의 문서가 로드된 상태
- **When**: 에디터를 50번째 라인 위치로 스크롤할 때
- **Then**: 미리보기가 data-line="49" (또는 가장 가까운 data-line) 요소 위치로 스크롤되어야 한다
- **And**: 동기화 응답 시간이 50ms 미만이어야 한다

### Scenario 6: 스크롤 동기화 비활성화

- **Given**: 스크롤 동기화가 비활성화된 상태 (scrollSyncEnabled: false)
- **When**: 에디터를 스크롤할 때
- **Then**: 미리보기 스크롤 위치가 변경되지 않아야 한다
- **And**: 에디터와 미리보기가 독립적으로 스크롤되어야 한다

### Scenario 7: Footer 토글 버튼 - 활성화

- **Given**: 스크롤 동기화가 비활성화된 상태
- **When**: Footer의 스크롤 동기화 토글 버튼을 클릭할 때
- **Then**: 스크롤 동기화가 활성화되어야 한다
- **And**: 토글 버튼이 활성화 상태 스타일(파란색/강조)로 변경되어야 한다
- **And**: uiStore의 scrollSyncEnabled가 true로 설정되어야 한다

### Scenario 8: Footer 토글 버튼 - 비활성화

- **Given**: 스크롤 동기화가 활성화된 상태
- **When**: Footer의 스크롤 동기화 토글 버튼을 클릭할 때
- **Then**: 스크롤 동기화가 비활성화되어야 한다
- **And**: 토글 버튼이 비활성화 상태 스타일(회색)로 변경되어야 한다

### Scenario 9: 설정 persist - 앱 재시작

- **Given**: 스크롤 동기화를 비활성화하고 앱을 종료한 상태
- **When**: 앱을 다시 시작할 때
- **Then**: scrollSyncEnabled가 false 상태로 복원되어야 한다
- **And**: Footer 토글 버튼이 비활성화 상태로 표시되어야 한다

### Scenario 10: 콘텐츠 변경 후 재동기화

- **Given**: 스크롤 동기화가 활성화되고 에디터가 50번째 라인에 스크롤된 상태
- **When**: 에디터에서 30번째 라인에 새로운 텍스트를 추가할 때
- **Then**: 미리보기 재렌더링 후 에디터의 현재 스크롤 위치에 맞춰 미리보기가 재동기화되어야 한다

### Scenario 11: 보간(Interpolation) - data-line 없는 구간

- **Given**: 에디터가 빈 라인(data-line이 없는 위치)에 스크롤된 상태
  ```
  # Title    <- data-line="0"
               <- 빈 라인 (data-line 없음)
               <- 빈 라인 (data-line 없음)
  Paragraph  <- data-line="3"
  ```
- **When**: 에디터가 1번째 라인(빈 라인)으로 스크롤될 때
- **Then**: 미리보기가 data-line="0"(Title)과 data-line="3"(Paragraph) 사이의 적절한 위치로 스크롤되어야 한다

### Scenario 12: onViewReady 콜백

- **Given**: MarkdownEditor 컴포넌트가 렌더링되는 시점
- **When**: EditorView 인스턴스가 생성 완료될 때
- **Then**: onViewReady 콜백이 EditorView 인스턴스와 함께 호출되어야 한다
- **And**: 부모 컴포넌트(AppLayout)의 viewRef에 EditorView가 설정되어야 한다

---

## Edge Cases

### Edge Case 1: 빈 문서

- **Condition**: editorStore의 content가 빈 문자열인 상태에서 스크롤 동기화가 활성화됨
- **Expected**: 동기화가 수행되지 않아야 한다 (data-line 요소 없음). 에러 발생 없이 정상 동작.

### Edge Case 2: 매우 큰 문서 (1000+ 라인)

- **Condition**: 1000라인 이상의 문서에서 스크롤 동기화
- **Expected**: querySelectorAll 결과 탐색이 5ms 미만으로 완료되어야 한다. requestAnimationFrame 스로틀링으로 부드러운 동기화.

### Edge Case 3: 빠른 연속 스크롤

- **Condition**: 사용자가 에디터를 빠르게 연속 스크롤할 때
- **Expected**: requestAnimationFrame으로 스로틀링되어 최대 60fps로 동기화. 이전 동기화 요청은 자동 취소. UI 프리징 없음.

### Edge Case 4: 피드백 루프 방지

- **Condition**: 에디터 스크롤 → 미리보기 스크롤 변경 → 미리보기 스크롤 이벤트 발생
- **Expected**: isSyncing 플래그로 미리보기 스크롤 이벤트가 에디터에 영향을 주지 않아야 한다. 무한 루프 발생 없음.

### Edge Case 5: EditorView null 상태

- **Condition**: EditorView가 아직 생성되지 않은 상태 (초기 로딩)
- **Expected**: useScrollSync가 null 체크 후 동기화를 건너뛰어야 한다. 에러 발생 없음.

### Edge Case 6: data-line 주입 성능

- **Condition**: data-line 플러그인이 활성화된 상태에서 10KB 문서 렌더링
- **Expected**: 기존 렌더링 시간 대비 5ms 미만의 오버헤드만 추가되어야 한다.

### Edge Case 7: 이미지/다이어그램이 많은 문서

- **Condition**: 이미지와 Mermaid 다이어그램이 여러 개 포함된 문서에서 스크롤 동기화
- **Expected**: 이미지/다이어그램의 높이가 에디터와 크게 다르므로 정확한 동기화가 어려울 수 있지만, 가장 가까운 data-line 요소 기준으로 합리적인 위치에 동기화되어야 한다.

### Edge Case 8: 스크롤 동기화 토글 중 스크롤 위치

- **Condition**: 스크롤 동기화를 비활성화한 후 미리보기를 다른 위치로 수동 스크롤하고, 다시 활성화
- **Expected**: 활성화 시 에디터의 현재 스크롤 위치에 맞춰 미리보기가 즉시 동기화되어야 한다.

### Edge Case 9: Mermaid 블록의 data-line

- **Condition**: Mermaid 코드 블록이 mermaidPlugin에 의해 `<div class="mermaid-container">`로 변환된 경우
- **Expected**: mermaidPlugin 변환 전 원본 fence 토큰의 data-line이 보존되거나, 변환된 div에 data-line이 추가되어야 한다.

---

## Performance Criteria

| 측정 항목 | 목표 | 측정 방법 |
|-----------|------|-----------|
| data-line 주입 오버헤드 (10KB) | < 5ms | 플러그인 없이 렌더링 vs 플러그인 있이 렌더링 차이 |
| 스크롤 동기화 응답 | < 50ms | 에디터 스크롤 이벤트 ~ 미리보기 scrollTop 변경 |
| data-line 요소 탐색 | < 5ms | querySelectorAll + 이진 탐색 시간 |
| 스크롤 이벤트 스로틀링 | 16ms (60fps) | requestAnimationFrame 간격 |
| 보간 계산 | < 1ms | 이전/다음 data-line 요소 간 비율 계산 |
| 1000라인 문서 동기화 | < 80ms | 전체 동기화 파이프라인 (이벤트 → 스크롤) |

---

## Quality Gates

### TRUST 5 검증

- **Tested**: data-line 주입 플러그인 단위 테스트, useScrollSync 훅 테스트 (EditorView mock), Footer 토글 테스트, uiStore persist 테스트
- **Readable**: TypeScript strict mode, 훅 파라미터 명확한 타입 정의, 동기화 로직 주석
- **Unified**: Tailwind CSS 일관된 스타일링, Zustand persist 패턴 일관성, markdown-it 플러그인 패턴 일관성
- **Secured**: XSS 방지 (data-line은 숫자 값만 허용), DOM 조작 안전성
- **Trackable**: SPEC-PREVIEW-002 태그로 커밋 추적, 요구사항별 테스트 매핑

### Definition of Done

- [ ] data-line 주입 markdown-it 플러그인 구현 완료
- [ ] 8개 블록 토큰 유형에 data-line 속성 주입 확인
- [ ] 기존 렌더링(Shiki, Mermaid)에 영향 없음 확인
- [ ] uiStore scrollSyncEnabled 상태 추가 및 persist 구현 완료
- [ ] useScrollSync 훅 구현 완료 (에디터 → 미리보기 단방향)
- [ ] 피드백 루프 방지 (isSyncing 플래그) 구현 완료
- [ ] requestAnimationFrame 스로틀링 적용 완료
- [ ] 보간(interpolation) 로직 구현 완료
- [ ] MarkdownPreview에 previewRef 추가 완료
- [ ] AppLayout에서 useScrollSync 연결 완료
- [ ] Footer 스크롤 동기화 토글 버튼 구현 완료
- [ ] 10KB 문서 기준 동기화 응답 < 50ms 확인
- [ ] data-line 주입 오버헤드 < 5ms 확인
- [ ] TypeScript 타입 에러 0건
- [ ] ESLint 경고 0건
- [ ] 85% 이상 테스트 커버리지 달성

---

## Traceability

- SPEC Reference: SPEC-PREVIEW-002
- Requirements Coverage: REQ-PREVIEW002-U01 ~ U03, E01 ~ E05, S01 ~ S04, N01 ~ N04, O01 ~ O02
