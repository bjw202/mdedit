---
id: SPEC-PREVIEW-001
version: "1.0.0"
status: approved
created: "2026-02-24"
updated: "2026-02-24"
author: "jw"
priority: P1
dependencies:
  - SPEC-UI-001
  - SPEC-EDITOR-001
tags:
  - preview
  - markdown-it
  - shiki
  - mermaid
  - rendering
---

## HISTORY

| Version | Date       | Author | Changes              |
| ------- | ---------- | ------ | -------------------- |
| 1.0.0   | 2026-02-24 | jw     | Initial SPEC creation |

---

## Overview

MdEdit 애플리케이션의 실시간 Markdown 미리보기 패널을 구현한다. markdown-it v14를 핵심 파서로 사용하여 CommonMark 호환 HTML을 생성하고, Shiki v1으로 100개 이상의 언어에 대한 VS Code 품질의 코드 블록 구문 강조를, Mermaid v11으로 다이어그램 렌더링(flowchart, sequence, state, git)을 제공한다. 에디터 콘텐츠 변경 시 300ms 디바운스로 실시간 미리보기를 업데이트하며, XSS 방지를 위해 HTML 렌더링을 비활성화한다.

### 범위

- markdown-it v14 기반 CommonMark 호환 Markdown-to-HTML 렌더링
- Shiki v1 코드 블록 구문 강조 (100+ 언어, VS Code 테마)
- Mermaid v11 다이어그램 렌더링 (flowchart, sequence, state, git)
- markdown-it 커스텀 플러그인: Mermaid 코드 블록 인터셉트
- 300ms 디바운스 기반 실시간 미리보기 업데이트
- XSS-safe 렌더링 (`html: false`)
- 테이블 렌더링 (정렬 지원)
- 각주(footnotes), 취소선(strikethrough) 지원
- Mermaid 다이어그램 지연 로딩 (스크롤 기반)
- 코드 블록 복사 버튼

### 범위 제외

- HTML-in-Markdown 렌더링 (보안 정책상 비활성화)
- 수학 수식 렌더링 (LaTeX/KaTeX - V2 범위)
- PDF/HTML 내보내기 (V2+ 범위)
- 미리보기 스크롤 동기화 (에디터와 미리보기 간 스크롤 연동 - V2 범위)

---

## EARS Requirements

### Ubiquitous Requirements (항상 활성)

- **REQ-PREVIEW-U01**: 시스템은 항상 markdown-it v14를 사용하여 Markdown을 HTML로 변환하며, CommonMark 사양을 준수해야 한다.

- **REQ-PREVIEW-U02**: 시스템은 항상 markdown-it의 `html` 옵션을 `false`로 설정하여 원시 HTML 태그 렌더링을 차단하고 XSS 공격을 방지해야 한다.

- **REQ-PREVIEW-U03**: 시스템은 항상 Mermaid의 `securityLevel`을 `'strict'`으로 설정하여 다이어그램 내 스크립트 실행을 차단해야 한다.

- **REQ-PREVIEW-U04**: 시스템은 항상 Shiki 하이라이터 인스턴스를 싱글턴으로 초기화하고 재사용하여 불필요한 메모리 할당을 방지해야 한다.

- **REQ-PREVIEW-U05**: 시스템은 항상 다음 Markdown 요소를 정확하게 렌더링해야 한다:
  - 헤더 (H1-H6)
  - 단락, 줄 바꿈
  - 볼드, 이탤릭, 볼드 이탤릭
  - 순서 있는/없는 리스트 (중첩 포함)
  - 링크, 이미지
  - 인라인 코드, 코드 블록 (언어 지정 포함)
  - 인용문 (중첩 포함)
  - 수평선
  - 테이블 (셀 정렬: 좌, 중앙, 우)
  - 각주 (footnotes)
  - 취소선 (strikethrough, `~~text~~`)

- **REQ-PREVIEW-U06**: 시스템은 항상 10KB Markdown 문서에 대해 HTML 변환 시간을 50ms 미만으로 유지해야 한다.

### Event-Driven Requirements (이벤트 기반)

- **REQ-PREVIEW-E01**: **WHEN** editorStore의 `content`가 변경되면, **THEN** 시스템은 300ms 디바운스 후 미리보기 패널의 렌더링을 업데이트해야 한다.

- **REQ-PREVIEW-E02**: **WHEN** Markdown 문서에 코드 블록(` ``` `)이 포함되어 있으면, **THEN** 시스템은 Shiki v1을 사용하여 해당 코드 블록의 구문을 강조해야 하며, 지정된 언어(` ```javascript ` 등)에 맞는 문법을 적용해야 한다.

- **REQ-PREVIEW-E03**: **WHEN** Markdown 문서에 언어가 `mermaid`로 지정된 코드 블록(` ```mermaid `)이 포함되어 있으면, **THEN** 시스템은 markdown-it 커스텀 플러그인을 통해 해당 블록을 인터셉트하고 Mermaid v11로 SVG 다이어그램을 렌더링해야 한다.

- **REQ-PREVIEW-E04**: **WHEN** Mermaid 다이어그램이 뷰포트에 진입하면, **THEN** 시스템은 해당 다이어그램의 렌더링을 시작해야 한다 (지연 로딩).

- **REQ-PREVIEW-E05**: **WHEN** 코드 블록의 복사 버튼이 클릭되면, **THEN** 시스템은 해당 코드 블록의 원본 텍스트(하이라이팅 전)를 클립보드에 복사해야 한다.

- **REQ-PREVIEW-E06**: **WHEN** MarkdownPreview 컴포넌트가 초기 마운트될 때, **THEN** 시스템은 Shiki 하이라이터 싱글턴을 비동기적으로 초기화해야 한다. 초기화 완료 전까지는 코드 블록을 일반 `<pre><code>` 태그로 표시해야 한다.

### State-Driven Requirements (상태 기반)

- **REQ-PREVIEW-S01**: **IF** editorStore의 `content`가 빈 문자열이면, **THEN** 시스템은 미리보기 패널에 빈 상태 또는 플레이스홀더 메시지를 표시해야 한다.

- **REQ-PREVIEW-S02**: **IF** Shiki 하이라이터가 아직 초기화되지 않은 상태이면, **THEN** 시스템은 코드 블록을 스타일 없는 `<pre><code>` 태그로 폴백 렌더링해야 한다.

- **REQ-PREVIEW-S03**: **IF** Mermaid 다이어그램의 구문이 유효하지 않으면, **THEN** 시스템은 에러 메시지를 다이어그램 위치에 인라인으로 표시하고, 전체 미리보기 렌더링을 중단하지 않아야 한다.

- **REQ-PREVIEW-S04**: **IF** 코드 블록에 언어가 지정되지 않았으면 (` ``` ` 단독), **THEN** 시스템은 일반 텍스트로 렌더링하되 코드 블록 배경 스타일은 적용해야 한다.

### Unwanted Behavior Requirements (금지 동작)

- **REQ-PREVIEW-N01**: 시스템은 미리보기 패널에서 `<script>`, `<iframe>`, `<object>`, `<embed>` 등의 실행 가능한 HTML 태그를 렌더링하면 안 된다.

- **REQ-PREVIEW-N02**: 시스템은 디바운스 기간 중 이전 렌더링 요청을 취소하지 않으면 안 된다. 불필요한 중복 렌더링을 방지해야 한다.

- **REQ-PREVIEW-N03**: 시스템은 Mermaid 다이어그램 렌더링 실패 시 전체 미리보기 패널의 렌더링을 중단하면 안 된다. 에러를 격리하여 해당 다이어그램 위치에만 표시해야 한다.

- **REQ-PREVIEW-N04**: 시스템은 Shiki 초기화 실패 시 미리보기 전체를 실패시키면 안 된다. 코드 블록을 스타일 없는 `<pre><code>`로 폴백 렌더링해야 한다.

- **REQ-PREVIEW-N05**: 시스템은 `innerHTML`을 사용하여 사용자 제공 HTML을 직접 주입하면 안 된다. markdown-it이 생성한 HTML만 렌더링해야 한다.

### Optional Requirements (선택 기능)

- **REQ-PREVIEW-O01**: 가능하면 시스템은 테이블 렌더링 시 Tailwind CSS 기반의 스타일링된 테이블을 제공해야 한다 (줄무늬 행, 호버 효과).

- **REQ-PREVIEW-O02**: 가능하면 시스템은 체크박스 리스트 (`- [ ]`, `- [x]`)를 시각적 체크박스로 렌더링해야 한다 (읽기 전용).

---

## Rendering Pipeline

미리보기의 전체 렌더링 파이프라인은 다음과 같다:

```
1. editorStore.content 변경 감지
   ↓
2. usePreview 훅: 300ms 디바운스 적용
   ↓
3. markdown-it.render(content) 호출
   ├── 3a. mermaidPlugin: 언어가 'mermaid'인 코드 블록 인터셉트
   │         → <div class="mermaid-container" data-diagram="..."> 로 변환
   ├── 3b. Shiki: 언어가 지정된 코드 블록에 구문 강조 적용
   │         → 하이라이팅된 HTML 반환
   └── 3c. 기타 Markdown 토큰 → 표준 HTML 변환
   ↓
4. 렌더링된 HTML을 PreviewRenderer 컴포넌트에 전달
   ↓
5. PreviewRenderer: dangerouslySetInnerHTML로 HTML 삽입
   (주의: markdown-it 생성 HTML만 허용, html: false로 사용자 HTML 차단)
   ↓
6. useEffect: DOM 업데이트 후 Mermaid 다이어그램 후처리
   ├── 6a. IntersectionObserver로 뷰포트 내 .mermaid-container 감지
   ├── 6b. mermaid.render(id, diagramCode) 호출
   └── 6c. 반환된 SVG를 해당 컨테이너에 주입
   ↓
7. 코드 블록 복사 버튼: useEffect로 각 코드 블록에 버튼 추가
```

### 파이프라인 성능 목표

| 단계                     | 목표 시간 | 비고                              |
| ------------------------ | --------- | --------------------------------- |
| 디바운스 대기            | 300ms     | 고정값, 타이핑 완료 후 실행       |
| markdown-it 변환 (10KB)  | < 50ms    | Shiki 하이라이팅 포함             |
| DOM 업데이트             | < 16ms    | React reconciliation              |
| Mermaid 다이어그램 렌더  | < 500ms   | 첫 렌더, 이후 캐시됨             |
| 전체 파이프라인 (10KB)   | < 850ms   | 디바운스 300ms + 변환 + DOM + Mermaid |

---

## Technical Constraints

### 라이브러리 버전

| 라이브러리              | 버전   | 용도                                 |
| ----------------------- | ------ | ------------------------------------ |
| `markdown-it`           | 14.x   | Markdown-to-HTML 파서               |
| `shiki`                 | 1.x    | VS Code 품질 코드 구문 강조         |
| `mermaid`               | 11.x   | 다이어그램 렌더링 엔진              |
| `react`                 | 18.x   | UI 프레임워크                        |
| `zustand`               | 5.x    | 상태 관리 (editorStore 구독)         |
| `typescript`            | 5.x+   | 타입 안전성                          |
| `tailwindcss`           | 3.x    | 미리보기 HTML 스타일링              |

### 성능 요구사항

| 지표                            | 목표값          |
| ------------------------------- | --------------- |
| Markdown-to-HTML 변환 (10KB)    | < 50ms          |
| Mermaid 다이어그램 렌더링       | < 500ms         |
| 디바운스 간격                   | 300ms           |
| Shiki 싱글턴 초기화             | < 1000ms        |
| 미리보기 전체 업데이트 (10KB)   | < 850ms         |

### 보안 요구사항

| 항목                   | 설정                    | 이유                              |
| ---------------------- | ----------------------- | --------------------------------- |
| markdown-it `html`     | `false`                 | XSS 방지: 사용자 HTML 차단       |
| Mermaid `securityLevel`| `'strict'`              | 다이어그램 내 스크립트 실행 차단  |
| innerHTML 사용         | markdown-it 출력만 허용 | 사용자 입력 HTML 직접 주입 금지   |

### 파일 구조

```
src/
  components/
    preview/
      MarkdownPreview.tsx        # 미리보기 패널 컨테이너
      PreviewRenderer.tsx        # HTML 렌더링 컴포넌트
      MermaidRenderer.tsx        # Mermaid 다이어그램 렌더러
      CodeBlockRenderer.tsx      # 코드 블록 렌더러 (복사 버튼 포함)
  hooks/
    usePreview.ts                # 디바운스 렌더링 훅
  lib/
    markdown/
      renderer.ts                # markdown-it 초기화 및 렌더링
      mermaidPlugin.ts           # markdown-it Mermaid 커스텀 플러그인
      codeHighlight.ts           # Shiki 통합 및 싱글턴 관리
```

---

## Dependencies

### SPEC 의존성

- **SPEC-UI-001**: 3-pane 레이아웃 시스템 (미리보기 패널 배치)
- **SPEC-EDITOR-001**: editorStore의 `content` 필드 구독 (렌더링 입력 소스)

### 외부 의존성

- `editorStore.content` (Zustand): 렌더링할 Markdown 콘텐츠 소스
- 시스템 클립보드 API: 코드 블록 복사 기능
- IntersectionObserver API: Mermaid 지연 로딩

### 하류 의존성 (이 SPEC에 의존하는 SPEC)

- 없음 (미리보기는 렌더링 파이프라인의 최종 단계)
