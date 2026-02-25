---
id: SPEC-UI-003
type: acceptance
version: 1.0.0
tags:
  - SPEC-UI-003
---

# SPEC-UI-003 인수 기준: 루트 폴더 변경 UI 개선

## 테스트 시나리오

### ACC-01: Happy Path -- 폴더 변경 성공

```gherkin
Feature: 루트 폴더 변경

  Scenario: 사용자가 열린 폴더를 다른 폴더로 변경한다
    Given FileExplorer에 "/Users/jw/project-a" 폴더가 열려 있다
    And 파일 트리에 project-a의 파일들이 표시되어 있다
    And 검색 쿼리에 "README"가 입력되어 있다
    When 사용자가 헤더의 "Change Folder" 버튼을 클릭한다
    Then OS 네이티브 폴더 선택 다이얼로그가 표시된다
    When 사용자가 "/Users/jw/project-b" 폴더를 선택한다
    Then 파일 트리가 project-b의 파일들로 업데이트된다
    And watchedPath가 "/Users/jw/project-b"로 변경된다
    And 검색 쿼리가 빈 문자열로 초기화된다
    And 이전 폴더("/Users/jw/project-a")의 파일시스템 감시가 중지된다
    And 새 폴더("/Users/jw/project-b")에 대한 파일시스템 감시가 시작된다
```

### ACC-02: 다이얼로그 취소 -- 현재 폴더 유지

```gherkin
  Scenario: 사용자가 폴더 선택 다이얼로그를 취소한다
    Given FileExplorer에 "/Users/jw/project-a" 폴더가 열려 있다
    And 파일 트리에 project-a의 파일들이 표시되어 있다
    When 사용자가 헤더의 "Change Folder" 버튼을 클릭한다
    Then OS 네이티브 폴더 선택 다이얼로그가 표시된다
    When 사용자가 다이얼로그를 취소한다 (Cancel 클릭 또는 ESC)
    Then 현재 폴더가 "/Users/jw/project-a"로 유지된다
    And 파일 트리가 변경되지 않는다
    And 파일시스템 감시가 변경되지 않는다
```

### ACC-03: 빈 상태 호환성

```gherkin
  Scenario: 폴더가 열려 있지 않은 빈 상태에서의 동작
    Given FileExplorer에 열린 폴더가 없다 (watchedPath === null)
    Then "Open Folder" 버튼이 표시된다
    And "Change Folder" 버튼은 표시되지 않는다
    When 사용자가 "Open Folder" 버튼을 클릭한다
    Then OS 네이티브 폴더 선택 다이얼로그가 표시된다 (기존 동작 유지)
```

### ACC-04: 마지막 폴더 영속성 및 자동 복원

```gherkin
Feature: 마지막 폴더 자동 복원

  Scenario: 앱 재시작 후 마지막 폴더가 자동으로 열린다
    Given 사용자가 이전 세션에서 "/Users/jw/project-a" 폴더를 열었다
    And localStorage의 lastWatchedPath에 "/Users/jw/project-a"가 저장되어 있다
    And "/Users/jw/project-a" 경로가 파일 시스템에 존재한다
    When 애플리케이션이 시작된다
    Then FileExplorer에 "/Users/jw/project-a" 폴더가 자동으로 열린다
    And 파일 트리에 project-a의 파일들이 표시된다
    And 파일시스템 감시가 시작된다
```

### ACC-05: 유효하지 않은 마지막 폴더 경로 처리

```gherkin
  Scenario: 저장된 마지막 폴더 경로가 더 이상 존재하지 않는 경우
    Given localStorage의 lastWatchedPath에 "/Users/jw/deleted-project"가 저장되어 있다
    And "/Users/jw/deleted-project" 경로가 파일 시스템에 존재하지 않는다
    When 애플리케이션이 시작된다
    Then lastWatchedPath가 null로 초기화된다
    And FileExplorer는 빈 상태("Open Folder" 버튼)를 표시한다
    And 에러 메시지나 크래시가 발생하지 않는다
```

### ACC-06: 미저장 변경 경고 (Optional)

```gherkin
Feature: 미저장 변경 경고

  Scenario: 미저장 변경이 있을 때 폴더 변경 시도
    Given FileExplorer에 폴더가 열려 있다
    And 에디터에 미저장 변경이 있다 (dirty === true)
    When 사용자가 "Change Folder" 버튼을 클릭한다
    Then "You have unsaved changes. Continue?" 확인 다이얼로그가 표시된다

  Scenario: 미저장 경고에서 확인을 선택
    Given 미저장 경고 다이얼로그가 표시되어 있다
    When 사용자가 "OK"를 클릭한다
    Then OS 네이티브 폴더 선택 다이얼로그가 표시된다

  Scenario: 미저장 경고에서 취소를 선택
    Given 미저장 경고 다이얼로그가 표시되어 있다
    When 사용자가 "Cancel"을 클릭한다
    Then 폴더 변경이 중단된다
    And 현재 폴더와 에디터 상태가 유지된다
```

---

## Quality Gate 기준

### Definition of Done

- [ ] REQ-UI-003-01 ~ REQ-UI-003-08: 모든 필수 요구사항 구현 완료
- [ ] REQ-UI-003-09 ~ REQ-UI-003-10: Optional 요구사항 구현 (가능한 경우)
- [ ] ACC-01 ~ ACC-05: 모든 필수 인수 테스트 시나리오 통과
- [ ] TypeScript 컴파일: 에러 0건
- [ ] Lint 검사: 에러 0건
- [ ] 기존 테스트: 전체 통과 (회귀 없음)
- [ ] 빈 상태 "Open Folder" 기능: 정상 동작 확인
- [ ] 상위/하위 폴더 이동: 정상 동작 확인
- [ ] 크로스 플랫폼: macOS, Windows 기본 동작 확인

### 검증 방법

| 검증 항목 | 방법 | 도구 |
|----------|------|------|
| UI 렌더링 | "Change Folder" 버튼 조건부 렌더링 확인 | React Testing Library |
| 폴더 변경 플로우 | IPC 호출 및 상태 업데이트 확인 | Vitest + mock |
| 검색 초기화 | `searchQuery` 상태 변경 확인 | Vitest |
| localStorage 영속성 | `lastWatchedPath` 저장/로드 확인 | Vitest + localStorage mock |
| 앱 초기화 복원 | `useEffect` 호출 및 `openFolderPath` 실행 확인 | Vitest + mock |
| 경로 유효성 검증 | 존재하지 않는 경로에 대한 에러 처리 확인 | Vitest |
| 미저장 경고 | `window.confirm` 호출 및 분기 확인 | Vitest + mock |
