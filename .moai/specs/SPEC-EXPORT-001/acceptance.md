---
id: SPEC-EXPORT-001
type: acceptance
version: 1.0.0
tags:
  - SPEC-EXPORT-001
---

# SPEC-EXPORT-001 인수 기준: Markdown Document Export (PDF/HTML/DOCX)

## 테스트 시나리오

### ACC-01: HTML 내보내기 -- Self-Contained HTML 생성

```gherkin
Feature: HTML 내보내기

  Scenario: 마크다운을 self-contained HTML 파일로 내보낸다
    Given 에디터에 마크다운 콘텐츠가 작성되어 있다
    And 콘텐츠에 제목, 코드 블록, 리스트, 표가 포함되어 있다
    And 프리뷰 패널에 렌더링이 완료되어 있다
    When 사용자가 Export 드롭다운에서 "Export as HTML"을 선택한다
    Then OS 네이티브 파일 저장 다이얼로그가 `.html` 필터와 함께 표시된다
    And 기본 파일명이 현재 파일명 기반이다 (예: "document.html")
    When 사용자가 저장 경로를 선택한다
    Then HTML 파일이 지정된 경로에 저장된다
    And 생성된 HTML 파일은 외부 의존성 없이 브라우저에서 단독으로 렌더링 가능하다

  Scenario: HTML 내보내기에 인라인 CSS가 포함된다
    Given 마크다운이 HTML로 내보내기 되었다
    When 생성된 HTML 파일을 텍스트 에디터로 열면
    Then `<style>` 태그 내에 프리뷰 CSS가 인라인으로 포함되어 있다
    And 외부 CSS 파일 참조(`<link rel="stylesheet">`)가 없다

  Scenario: HTML 내보내기에 Mermaid 다이어그램이 SVG로 포함된다
    Given 에디터 콘텐츠에 Mermaid 다이어그램 코드 블록이 포함되어 있다
    And 프리뷰 패널에서 Mermaid SVG가 렌더링 완료되었다
    When HTML로 내보내기 한다
    Then 생성된 HTML에 Mermaid 다이어그램이 인라인 `<svg>` 요소로 포함된다
    And Mermaid JavaScript 라이브러리 참조가 포함되지 않는다
    And 다이어그램이 브라우저에서 올바르게 표시된다

  Scenario: HTML 내보내기에 Shiki 구문 강조가 보존된다
    Given 에디터 콘텐츠에 코드 블록이 포함되어 있다
    When HTML로 내보내기 한다
    Then 코드 블록에 Shiki의 인라인 스타일 (color 속성)이 보존된다
    And 구문 강조 색상이 프리뷰 패널과 동일하다

  Scenario: HTML에 JavaScript가 포함되지 않는다
    Given 마크다운이 HTML로 내보내기 되었다
    When 생성된 HTML 파일을 검사하면
    Then `<script>` 태그가 존재하지 않는다
```

### ACC-02: PDF 내보내기 -- Print-to-PDF

```gherkin
Feature: PDF 내보내기

  Scenario: 마크다운을 PDF로 내보낸다
    Given 에디터에 마크다운 콘텐츠가 작성되어 있다
    And 프리뷰 패널에 렌더링이 완료되어 있다
    When 사용자가 Export 드롭다운에서 "Export as PDF"를 선택한다
    Then 시스템이 print 기능을 호출한다
    And 사용자가 PDF로 저장할 수 있는 print 다이얼로그가 표시된다

  Scenario: PDF에 Mermaid 다이어그램과 Shiki 구문 강조가 보존된다
    Given 에디터 콘텐츠에 Mermaid 다이어그램과 코드 블록이 포함되어 있다
    When PDF로 내보내기 한다
    Then PDF에 다이어그램이 렌더링되어 있다
    And 코드 블록에 구문 강조 색상이 표시된다
    And 프리뷰 패널과 시각적으로 동일하다

  Scenario: PDF용 Print CSS가 적용된다
    Given PDF 내보내기가 실행되었다
    When print 미디어 쿼리가 활성화되면
    Then 에디터 UI 요소(사이드바, 헤더, 툴바)가 숨겨진다
    And 코드 블록이 페이지 경계에서 잘리지 않는다
    And 배경색이 정상적으로 출력된다
```

### ACC-03: DOCX 내보내기 -- 포맷 보존

```gherkin
Feature: DOCX 내보내기

  Scenario: 마크다운을 DOCX 파일로 내보낸다
    Given 에디터에 마크다운 콘텐츠가 작성되어 있다
    And 콘텐츠에 제목, 코드 블록, 리스트, 표, 볼드, 이탤릭이 포함되어 있다
    When 사용자가 Export 드롭다운에서 "Export as DOCX"를 선택한다
    Then OS 네이티브 파일 저장 다이얼로그가 `.docx` 필터와 함께 표시된다
    And 기본 파일명이 현재 파일명 기반이다 (예: "document.docx")
    When 사용자가 저장 경로를 선택한다
    Then DOCX 파일이 지정된 경로에 저장된다

  Scenario: DOCX에 마크다운 서식이 올바르게 매핑된다
    Given DOCX 파일이 생성되었다
    When Microsoft Word 또는 Google Docs에서 열면
    Then 제목(#, ##, ###)이 해당 Heading 스타일로 표시된다
    And 볼드 텍스트(**text**)가 굵게 표시된다
    And 이탤릭 텍스트(*text*)가 기울임체로 표시된다
    And 순서 없는 리스트가 bullet 포인트로 표시된다
    And 표가 테이블 형식으로 표시된다
    And 코드 블록이 모노스페이스 글꼴로 표시된다
    And 인용구가 들여쓰기와 함께 표시된다
    And 링크가 하이퍼링크로 표시된다

  Scenario: DOCX에 Shiki 구문 강조 색상이 보존된다
    Given 에디터 콘텐츠에 코드 블록이 포함되어 있다
    When DOCX로 내보내기 한다
    Then 코드 블록 내 텍스트에 Shiki 구문 강조 색상이 적용되어 있다

  Scenario: DOCX에 Mermaid 다이어그램이 이미지로 포함된다
    Given 에디터 콘텐츠에 Mermaid 다이어그램이 포함되어 있다
    When DOCX로 내보내기 한다
    Then 다이어그램이 PNG 이미지로 DOCX에 삽입되어 있다

  Scenario: Mermaid SVG -> PNG 변환 실패 시 대체 처리
    Given Mermaid SVG의 PNG 변환이 실패했다
    When DOCX 내보내기가 완료되면
    Then 해당 위치에 "[Diagram]" 텍스트 플레이스홀더가 삽입된다
    And 내보내기 자체는 성공적으로 완료된다
    And 사용자에게 경고가 표시된다
```

### ACC-04: Export UI 드롭다운

```gherkin
Feature: Export 드롭다운 UI

  Scenario: Header에 Export 드롭다운 버튼이 표시된다
    Given 애플리케이션이 실행 중이다
    Then Header 영역에 Export 드롭다운 버튼이 표시된다

  Scenario: Export 드롭다운 메뉴가 올바르게 동작한다
    Given Header에 Export 드롭다운 버튼이 표시되어 있다
    When 사용자가 Export 버튼을 클릭한다
    Then 드롭다운 메뉴가 펼쳐진다
    And "Export as HTML" 옵션이 표시된다
    And "Export as PDF" 옵션이 표시된다
    And "Export as DOCX" 옵션이 표시된다

  Scenario: 에디터 콘텐츠가 비어있을 때 Export 버튼이 비활성화된다
    Given 에디터에 콘텐츠가 없다 (content === "")
    Then Export 드롭다운 버튼이 disabled 상태이다
    And 클릭해도 드롭다운이 열리지 않는다

  Scenario: 에디터에 콘텐츠가 있을 때 Export 버튼이 활성화된다
    Given 에디터에 마크다운 콘텐츠가 작성되어 있다
    Then Export 드롭다운 버튼이 enabled 상태이다
    And 클릭하면 드롭다운이 열린다
```

### ACC-05: 내보내기 진행 상태

```gherkin
Feature: 내보내기 진행 상태 표시

  Scenario: 내보내기 진행 중 로딩 상태가 표시된다
    Given 사용자가 내보내기 포맷을 선택하고 저장 경로를 지정했다
    When 내보내기 처리가 진행 중이다
    Then Export 버튼에 로딩 인디케이터가 표시된다
    And 내보내기 완료 시 로딩 인디케이터가 사라진다

  Scenario: 내보내기 완료 후 성공 피드백
    Given 내보내기가 성공적으로 완료되었다
    Then 사용자에게 내보내기 성공 알림이 표시된다
```

### ACC-06: 테마 인식 내보내기

```gherkin
Feature: 테마 인식 내보내기

  Scenario: 다크 모드에서 HTML 내보내기
    Given 사용자가 다크 모드를 사용 중이다
    When HTML로 내보내기 한다
    Then 생성된 HTML에 다크 모드 스타일이 적용되어 있다
    And 배경색이 어두운 색상이다
    And 텍스트 색상이 밝은 색상이다

  Scenario: 라이트 모드에서 HTML 내보내기
    Given 사용자가 라이트 모드를 사용 중이다
    When HTML로 내보내기 한다
    Then 생성된 HTML에 라이트 모드 스타일이 적용되어 있다
    And 배경색이 밝은 색상이다
    And 텍스트 색상이 어두운 색상이다
```

### ACC-07: 파일 저장 다이얼로그

```gherkin
Feature: 내보내기 파일 저장 다이얼로그

  Scenario: HTML 내보내기 시 올바른 파일 필터가 적용된다
    Given 현재 편집 중인 파일이 "README.md"이다
    When 사용자가 "Export as HTML"을 선택한다
    Then 저장 다이얼로그의 기본 파일명이 "README.html"이다
    And 파일 필터가 ".html" 확장자로 설정되어 있다

  Scenario: DOCX 내보내기 시 올바른 파일 필터가 적용된다
    Given 현재 편집 중인 파일이 "README.md"이다
    When 사용자가 "Export as DOCX"를 선택한다
    Then 저장 다이얼로그의 기본 파일명이 "README.docx"이다
    And 파일 필터가 ".docx" 확장자로 설정되어 있다

  Scenario: 새 파일(미저장)에서 내보내기 시 기본 파일명 처리
    Given 에디터에 새 파일이 열려 있다 (파일명 없음)
    When 내보내기를 시도한다
    Then 저장 다이얼로그의 기본 파일명이 "untitled.{format}"이다

  Scenario: 저장 다이얼로그 취소
    Given 내보내기 저장 다이얼로그가 표시되어 있다
    When 사용자가 다이얼로그를 취소한다 (Cancel 또는 ESC)
    Then 내보내기가 중단된다
    And 에디터 상태가 변경되지 않는다
    And 파일이 생성되지 않는다
```

### ACC-08: 에러 처리

```gherkin
Feature: 내보내기 에러 처리

  Scenario: 내보내기 실패 시 에러 메시지 표시
    Given 내보내기 처리 중 에러가 발생했다 (예: 디스크 쓰기 실패)
    Then 사용자에게 명확한 에러 메시지가 표시된다
    And 에디터 콘텐츠가 수정되지 않는다
    And 에디터는 정상 사용 가능한 상태를 유지한다

  Scenario: 내보내기 중 에디터 콘텐츠 보호
    Given 내보내기가 진행 중이다
    Then editorStore의 content가 내보내기 로직에 의해 수정되지 않는다
    And 사용자가 에디터에서 계속 편집할 수 있다
```

---

## Quality Gate 기준

### Definition of Done

- [ ] REQ-EXPORT-001 ~ REQ-EXPORT-004: HTML 내보내기 전체 구현
- [ ] REQ-EXPORT-005 ~ REQ-EXPORT-006: PDF 내보내기 전체 구현
- [ ] REQ-EXPORT-007 ~ REQ-EXPORT-010: DOCX 내보내기 전체 구현
- [ ] REQ-EXPORT-011 ~ REQ-EXPORT-013: Export UI 전체 구현
- [ ] REQ-EXPORT-014 ~ REQ-EXPORT-015: 테마 인식 내보내기 구현
- [ ] REQ-EXPORT-016 ~ REQ-EXPORT-017: 파일 저장 다이얼로그 구현
- [ ] REQ-EXPORT-018 ~ REQ-EXPORT-020: 에러 처리 구현
- [ ] ACC-01 ~ ACC-08: 모든 인수 테스트 시나리오 통과
- [ ] TypeScript 컴파일: 에러 0건
- [ ] `cargo clippy`: 경고 0건
- [ ] 기존 305개 테스트: 전체 통과 (회귀 없음)
- [ ] 각 포맷 내보내기: 50KB 마크다운 기준 5초 이내 완료
- [ ] HTML 출력: Chrome, Firefox, Safari에서 정상 렌더링
- [ ] DOCX 출력: Word, Google Docs, LibreOffice에서 정상 열림
- [ ] 크로스 플랫폼: macOS, Windows에서 기본 동작 확인

### 검증 방법

| 검증 항목 | 방법 | 도구 |
|----------|------|------|
| HTML 구조 | self-contained HTML 구조 검증 (인라인 CSS, 인라인 SVG, no JS) | Vitest + DOM 파싱 |
| HTML 렌더링 | 브라우저에서 열어 시각적 확인 | Manual (Chrome, Firefox, Safari) |
| PDF 품질 | print 호출 및 결과물 시각적 확인 | Manual |
| DOCX 구조 | 마크다운 요소 -> DOCX 서식 매핑 단위 테스트 | Vitest |
| DOCX 렌더링 | Word, Google Docs, LibreOffice에서 열어 확인 | Manual |
| Mermaid SVG 추출 | DOM에서 SVG 추출 로직 단위 테스트 | Vitest + JSDOM |
| Shiki 색상 보존 | 인라인 스타일에서 색상 추출 및 매핑 단위 테스트 | Vitest |
| UI 드롭다운 | 렌더링, disabled 상태, 메뉴 항목 확인 | React Testing Library |
| 파일 저장 다이얼로그 | IPC 호출 및 파일 필터 확인 | Vitest + Tauri mock |
| 에러 처리 | 에러 시나리오 시뮬레이션 및 사용자 피드백 확인 | Vitest |
| 성능 | 50KB 마크다운 내보내기 타이밍 측정 | Vitest + performance.now() |
| 회귀 테스트 | 기존 전체 테스트 스위트 실행 | Vitest + cargo test |
| Rust 명령어 | Tauri 명령어 단위 테스트 | cargo test |
| 테마 인식 | dark/light 모드별 내보내기 결과 비교 | Vitest + DOM 검사 |
