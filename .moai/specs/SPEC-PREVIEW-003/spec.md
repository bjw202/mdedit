---
id: SPEC-PREVIEW-003
version: "1.0.0"
status: draft
created: "2026-04-01"
updated: "2026-04-01"
author: "jw"
priority: P2
issue_number: 0
dependencies:
  - SPEC-PREVIEW-001
tags:
  - preview
  - markdown-it
  - katex
  - math
  - latex
---

## HISTORY

| Version | Date       | Author | Changes              |
| ------- | ---------- | ------ | -------------------- |
| 1.0.0   | 2026-04-01 | jw     | 최초 SPEC 작성       |

---

## Overview

MdEdit 애플리케이션의 미리보기 패널에 LaTeX 수학 수식 렌더링 기능을 추가한다. 현재 `$r = \frac{mz}{2}$`나 `$\alpha$` 같은 LaTeX 수식이 원시 텍스트로 표시되는 문제를 해결한다.

KaTeX 라이브러리와 `@traptitech/markdown-it-katex` 플러그인을 사용하여 markdown-it 렌더링 파이프라인에 수학 수식 지원을 통합한다. KaTeX는 약 300KB의 경량 라이브러리로 Tauri 앱에 적합하며, 인라인 수식(`$...$`)과 블록 수식(`$$...$$`) 구문을 모두 지원한다.

### 범위

- KaTeX 기반 인라인 수학 수식 렌더링 (`$...$`)
- KaTeX 기반 블록 수학 수식 렌더링 (`$$...$$`)
- KaTeX CSS 스타일시트 통합
- 기존 markdown-it 플러그인 체인과의 호환성 보장 (Shiki, Mermaid, 테이블 등)

### 범위 제외

- MathJax 지원 (KaTeX로 단일화)
- 수식 편집기 UI (WYSIWYG 수식 입력)
- 수식 자동 완성
- 수식 번호 매기기 (equation numbering)

---

## EARS Requirements

### Ubiquitous Requirements (항상 활성)

- **REQ-PREVIEW3-U01**: 시스템은 항상 KaTeX를 사용하여 LaTeX 수학 수식을 렌더링해야 하며, `katex/dist/katex.min.css` 스타일시트가 로드되어 수식이 올바르게 표시되어야 한다.

- **REQ-PREVIEW3-U02**: 시스템은 항상 `@traptitech/markdown-it-katex` 플러그인을 통해 markdown-it 렌더링 파이프라인에 수학 수식 처리를 통합해야 한다.

- **REQ-PREVIEW3-U03**: 시스템은 항상 수학 수식 렌더링이 기존 미리보기 기능(코드 하이라이팅, Mermaid 다이어그램, 테이블, 이미지 등)과 공존하며 간섭하지 않아야 한다.

### Event-Driven Requirements (이벤트 기반)

- **REQ-PREVIEW3-E01**: **WHEN** Markdown 문서에 인라인 수식 구문(`$...$`)이 포함되어 있으면, **THEN** 시스템은 해당 구문을 KaTeX로 렌더링하여 수학 기호와 수식을 시각적으로 표시해야 한다.

- **REQ-PREVIEW3-E02**: **WHEN** Markdown 문서에 블록 수식 구문(`$$...$$`)이 포함되어 있으면, **THEN** 시스템은 해당 구문을 KaTeX로 렌더링하여 중앙 정렬된 독립 블록 수식으로 표시해야 한다.

- **REQ-PREVIEW3-E03**: **WHEN** 하나의 Markdown 문서에 수학 수식, 테이블, 코드 블록, Mermaid 다이어그램이 혼합되어 있으면, **THEN** 시스템은 각 요소를 올바르게 파싱하고 렌더링해야 한다.

### Unwanted Behavior Requirements (금지 동작)

- **REQ-PREVIEW3-N01**: 시스템은 유효하지 않은 LaTeX 구문이 포함된 경우 전체 미리보기 렌더링을 중단하면 안 된다. 해당 수식 위치에 에러를 표시하고 나머지 콘텐츠는 정상 렌더링해야 한다.

- **REQ-PREVIEW3-N02**: 시스템은 달러 기호(`$`)가 수학 수식 구분자가 아닌 통화 표기로 사용된 경우(예: `$100`, `$50 USD`) 이를 수식으로 해석하면 안 된다. 단독 달러 기호 뒤에 공백이 오는 경우는 수식으로 처리하지 않아야 한다.

- **REQ-PREVIEW3-N03**: 시스템은 KaTeX 수식 렌더링으로 인해 기존 미리보기 디바운스 시간(300ms)에 50ms 이상의 추가 지연을 발생시키면 안 된다.

### State-Driven Requirements (상태 기반)

- **REQ-PREVIEW3-S01**: **IF** 수식 구문 내부가 비어 있으면 (`$$`나 `$$$$`), **THEN** 시스템은 빈 수식을 무시하고 원시 텍스트로 표시해야 한다.

- **REQ-PREVIEW3-S02**: **IF** 수식 내에 중첩된 중괄호가 포함되어 있으면 (예: `$\frac{\sqrt{x^{2}+1}}{y}$`), **THEN** 시스템은 중괄호 중첩을 올바르게 파싱하여 수식을 렌더링해야 한다.

### Optional Requirements (선택 기능)

- **REQ-PREVIEW3-O01**: 가능하면 시스템은 수식 렌더링 시 다크 모드에서 수식 색상이 배경과 대비되도록 적절한 스타일을 적용해야 한다.

- **REQ-PREVIEW3-O02**: 가능하면 시스템은 이스케이프된 달러 기호(`\$`)를 리터럴 달러 기호로 렌더링하여 수식 구분자로 해석하지 않아야 한다.

---

## Affected Files

| 파일 경로                              | 변경 유형 | 설명                                                |
| -------------------------------------- | --------- | --------------------------------------------------- |
| `package.json`                         | 수정      | `katex`, `@traptitech/markdown-it-katex` 의존성 추가 |
| `src/lib/markdown/renderer.ts`         | 수정      | `md.use(markdownItKatex)` 플러그인 등록              |
| `src/index.css` 또는 `src/main.tsx`    | 수정      | KaTeX CSS (`katex/dist/katex.min.css`) import 추가   |

---

## Technical Constraints

### 라이브러리 버전

| 라이브러리                        | 버전    | 용도                                   |
| --------------------------------- | ------- | -------------------------------------- |
| `katex`                           | latest  | LaTeX 수식 렌더링 엔진                 |
| `@traptitech/markdown-it-katex`   | latest  | markdown-it용 KaTeX 플러그인           |
| `markdown-it`                     | 14.x    | Markdown 파서 (기존)                   |

> 정확한 버전은 `/moai:2-run` 구현 단계에서 최신 안정 버전으로 확정한다.

### 성능 요구사항

| 지표                                    | 목표값       |
| --------------------------------------- | ------------ |
| 수식 포함 10KB 문서 렌더링 추가 지연    | < 50ms       |
| KaTeX CSS 번들 크기                     | ~ 300KB      |
| 기존 미리보기 파이프라인 성능 영향      | 무시 가능    |

### 보안 요구사항

| 항목                    | 설정/방침                                                | 이유                                |
| ----------------------- | -------------------------------------------------------- | ----------------------------------- |
| KaTeX `throwOnError`    | `false`                                                  | 잘못된 수식이 전체 렌더링 중단 방지 |
| Tauri CSP               | KaTeX CSS가 인라인 스타일을 사용하므로 CSP 호환성 확인 필요 | WebView 보안 정책 준수              |
| `html: false` 유지      | markdown-it의 기존 보안 설정 변경 없음                   | XSS 방지 정책 유지                  |

---

## Dependencies

### SPEC 의존성

- **SPEC-PREVIEW-001**: 기본 markdown-it 렌더링 파이프라인 (이 SPEC의 기반)

### 외부 의존성

- `markdown-it` v14: 기존 파서 인스턴스에 플러그인 등록
- KaTeX 폰트 파일: `katex/dist/fonts/` (CSS와 함께 번들링)

### 하류 의존성 (이 SPEC에 의존하는 SPEC)

- 없음
