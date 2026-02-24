# Implementation Plan: SPEC-PREVIEW-001

## 개요

markdown-it v14 기반 실시간 Markdown 미리보기 구현 계획. 핵심 렌더러, Shiki 코드 하이라이팅, Mermaid 다이어그램, 디바운스 로직, 복사 버튼을 단계별로 구현한다.

---

## Task Decomposition

### Milestone 1: 핵심 렌더링 파이프라인 (Primary Goal)

markdown-it 초기화, usePreview 훅, 기본 미리보기 컴포넌트를 구현하여 Markdown 실시간 미리보기의 기본 흐름을 완성한다.

#### Task 1.1: markdown-it 렌더러 초기화

- **파일**: `src/lib/markdown/renderer.ts`
- **내용**:
  - markdown-it v14 인스턴스 생성
  - 기본 옵션 설정:
    - `html: false` (XSS 방지)
    - `linkify: true` (URL 자동 링크)
    - `typographer: true` (스마트 따옴표 등)
    - `breaks: true` (줄바꿈 처리)
  - GFM 확장 플러그인 활성화:
    - 테이블 렌더링 (셀 정렬 지원)
    - 각주 (footnotes)
    - 취소선 (strikethrough)
  - `render(markdown: string): string` 함수 export
  - 싱글턴 패턴으로 인스턴스 관리
- **참조**: REQ-PREVIEW-U01, REQ-PREVIEW-U02, REQ-PREVIEW-U05

#### Task 1.2: usePreview 커스텀 훅

- **파일**: `src/hooks/usePreview.ts`
- **내용**:
  - editorStore의 `content` 구독
  - 300ms 디바운스 로직 구현 (디바운스 중 이전 요청 취소)
  - `useMemo` 또는 `useRef`로 디바운스 타이머 관리
  - markdown-it `render()` 호출 -> HTML 문자열 반환
  - 반환값: `{ html: string; isRendering: boolean }`
  - 빈 콘텐츠 처리: 빈 문자열 시 플레이스홀더 반환
- **참조**: REQ-PREVIEW-E01, REQ-PREVIEW-S01, REQ-PREVIEW-N02

#### Task 1.3: MarkdownPreview 컨테이너 컴포넌트

- **파일**: `src/components/preview/MarkdownPreview.tsx`
- **내용**:
  - usePreview 훅 사용하여 렌더링된 HTML 수신
  - PreviewRenderer 컴포넌트에 HTML 전달
  - 스크롤 가능한 컨테이너 레이아웃
  - 로딩 상태 표시 (Shiki 초기화 중)
  - Tailwind CSS 기반 프로즈 스타일링 (`prose` 클래스)
- **참조**: REQ-PREVIEW-E01

#### Task 1.4: PreviewRenderer 컴포넌트

- **파일**: `src/components/preview/PreviewRenderer.tsx`
- **내용**:
  - `dangerouslySetInnerHTML`을 사용하여 markdown-it 생성 HTML 렌더링
  - markdown-it 출력 HTML만 허용 (사용자 HTML 직접 주입 차단)
  - Tailwind Typography (`@tailwindcss/typography`) 프로즈 스타일 적용
  - 테이블 스타일링 (줄무늬 행, 정렬)
- **참조**: REQ-PREVIEW-U05, REQ-PREVIEW-N05

---

### Milestone 2: Shiki 코드 하이라이팅 (Primary Goal)

코드 블록에 VS Code 품질의 구문 강조를 적용한다.

#### Task 2.1: Shiki 싱글턴 초기화

- **파일**: `src/lib/markdown/codeHighlight.ts`
- **내용**:
  - `shiki`의 `createHighlighter()` 비동기 초기화
  - 싱글턴 패턴: 초기화 Promise 캐싱
  - 기본 테마: `'github-dark'` (다크 모드), `'github-light'` (라이트 모드)
  - 기본 로딩 언어: `javascript`, `typescript`, `python`, `rust`, `json`, `yaml`, `bash`, `markdown`, `css`, `html`
  - 추가 언어 On-Demand 로딩 지원
  - 초기화 상태 추적: `isReady(): boolean`
  - export: `highlightCode(code: string, lang: string): string`
- **참조**: REQ-PREVIEW-U04, REQ-PREVIEW-E06

#### Task 2.2: markdown-it와 Shiki 통합

- **파일**: `src/lib/markdown/renderer.ts` (확장)
- **내용**:
  - markdown-it의 `highlight` 옵션에 Shiki 하이라이터 연결
  - `highlight(code, lang, attrs)` 콜백 구현:
    - Shiki 초기화 완료 시: `highlightCode(code, lang)` 호출
    - Shiki 미초기화 시: `<pre><code>` 폴백 렌더링
    - 언어 미지정 시: 일반 텍스트 렌더링
  - 언어 `mermaid`는 건너뛰기 (mermaidPlugin에서 처리)
- **참조**: REQ-PREVIEW-E02, REQ-PREVIEW-S02, REQ-PREVIEW-S04, REQ-PREVIEW-N04

#### Task 2.3: CodeBlockRenderer 컴포넌트

- **파일**: `src/components/preview/CodeBlockRenderer.tsx`
- **내용**:
  - 코드 블록 복사 버튼 UI
  - `useEffect`로 렌더링된 DOM 내 코드 블록 요소 탐색
  - 각 `<pre>` 요소에 복사 버튼 동적 추가
  - 클릭 시 `navigator.clipboard.writeText()` 호출
  - 복사 성공/실패 피드백 (아이콘 변경, 토스트)
- **참조**: REQ-PREVIEW-E05

---

### Milestone 3: Mermaid 다이어그램 렌더링 (Secondary Goal)

Mermaid 코드 블록을 SVG 다이어그램으로 렌더링한다.

#### Task 3.1: markdown-it Mermaid 커스텀 플러그인

- **파일**: `src/lib/markdown/mermaidPlugin.ts`
- **내용**:
  - markdown-it 플러그인 규격에 맞는 함수 작성
  - `fence` 토큰 렌더러 오버라이드
  - 언어가 `mermaid`인 코드 블록 감지
  - 인터셉트 시 `<div class="mermaid-container" data-diagram="...">` 출력
  - 다이어그램 원본 코드를 `data-diagram` 속성에 HTML 인코딩하여 저장
  - 비-mermaid 코드 블록은 기본 렌더러로 패스스루
- **참조**: REQ-PREVIEW-E03

#### Task 3.2: MermaidRenderer 컴포넌트

- **파일**: `src/components/preview/MermaidRenderer.tsx`
- **내용**:
  - `useEffect`로 DOM 내 `.mermaid-container` 요소 탐색
  - IntersectionObserver를 사용한 지연 로딩:
    - 뷰포트 진입 시 `mermaid.render()` 호출
    - 뷰포트 밖의 다이어그램은 렌더링하지 않음
  - `mermaid.initialize({ securityLevel: 'strict' })` 설정
  - 렌더링된 SVG를 컨테이너에 주입
  - 지원 다이어그램 유형: flowchart, sequence, state, gitGraph
  - 에러 처리: 유효하지 않은 구문 시 에러 메시지 인라인 표시
  - 렌더링 결과 캐싱 (동일 다이어그램 코드에 대해)
- **참조**: REQ-PREVIEW-E04, REQ-PREVIEW-U03, REQ-PREVIEW-S03, REQ-PREVIEW-N03

#### Task 3.3: renderer.ts에 mermaidPlugin 등록

- **파일**: `src/lib/markdown/renderer.ts` (확장)
- **내용**:
  - markdown-it 인스턴스에 mermaidPlugin 등록
  - 플러그인 로딩 순서: mermaidPlugin -> Shiki highlight
  - Mermaid 코드 블록이 Shiki로 처리되지 않도록 순서 보장
- **참조**: REQ-PREVIEW-E03

---

### Milestone 4: 미리보기 후처리 및 스타일링 (Secondary Goal)

렌더링된 HTML의 후처리, 스타일링, 복사 버튼 통합을 완성한다.

#### Task 4.1: 미리보기 스타일링

- **파일**: `src/components/preview/MarkdownPreview.tsx` (스타일 확장)
- **내용**:
  - Tailwind Typography 플러그인 (`@tailwindcss/typography`) 적용
  - `prose` 클래스 기반 기본 타이포그래피
  - 테이블 스타일: 줄무늬 행, 호버 효과, 셀 패딩
  - 인용문 스타일: 좌측 보더, 배경색
  - 코드 블록 스타일: 둥근 모서리, 배경색, 패딩
  - 체크박스 리스트 시각적 렌더링 (선택)
  - 다크/라이트 테마 대응
- **참조**: REQ-PREVIEW-O01, REQ-PREVIEW-O02

#### Task 4.2: DOM 후처리 통합

- **파일**: `src/components/preview/MarkdownPreview.tsx`
- **내용**:
  - `useEffect`에서 DOM 업데이트 후 순차 처리:
    1. CodeBlockRenderer: 복사 버튼 추가
    2. MermaidRenderer: 다이어그램 렌더링
  - 렌더링 완료 이벤트 발행 (성능 측정용)
- **참조**: REQ-PREVIEW-E05, REQ-PREVIEW-E04

---

### Milestone 5: 최적화 및 에러 복원력 (Final Goal)

성능 최적화와 에러 격리를 구현한다.

#### Task 5.1: Mermaid 렌더링 캐시

- **내용**:
  - 다이어그램 코드 해시 기반 캐시
  - 동일 다이어그램 재렌더링 방지
  - 캐시 크기 제한 (최대 50개)
  - LRU 캐시 전략

#### Task 5.2: Shiki 언어 On-Demand 로딩

- **내용**:
  - 기본 10개 언어 외 추가 언어 감지 시 동적 로딩
  - 로딩 중 폴백: `<pre><code>` 표시
  - 로딩 완료 후 자동 재렌더링

#### Task 5.3: 에러 격리 강화

- **내용**:
  - Mermaid 에러: 해당 다이어그램 위치에 에러 메시지 표시
  - Shiki 에러: 코드 블록을 스타일 없는 `<pre><code>`로 폴백
  - markdown-it 에러: 원본 Markdown 텍스트 표시
  - React ErrorBoundary로 미리보기 패널 전체 보호

---

## Technology Stack

| 기술                    | 버전    | 용도                                 |
| ----------------------- | ------- | ------------------------------------ |
| markdown-it             | 14.x   | Markdown-to-HTML 파서               |
| markdown-it-footnote    | 4.x    | 각주 플러그인                        |
| markdown-it-attrs       | -      | 속성 지정 (선택)                     |
| shiki                   | 1.x    | 코드 구문 강조 (VS Code 품질)       |
| mermaid                 | 11.x   | 다이어그램 렌더링                    |
| React                   | 18.x   | UI 프레임워크                        |
| Zustand                 | 5.x    | 상태 관리 (editorStore 구독)         |
| TypeScript              | 5.x+   | 타입 안전성                          |
| Tailwind CSS            | 3.x    | 미리보기 스타일링                    |
| @tailwindcss/typography | 0.5.x  | 프로즈 타이포그래피 스타일           |

---

## File Manifest

| 파일 경로                                          | 신규/수정 | 설명                              |
| -------------------------------------------------- | --------- | --------------------------------- |
| `src/lib/markdown/renderer.ts`                     | 신규      | markdown-it 초기화 및 렌더링      |
| `src/lib/markdown/mermaidPlugin.ts`                | 신규      | Mermaid 코드 블록 인터셉트 플러그인|
| `src/lib/markdown/codeHighlight.ts`                | 신규      | Shiki 싱글턴 및 하이라이팅        |
| `src/hooks/usePreview.ts`                          | 신규      | 디바운스 렌더링 훅                |
| `src/components/preview/MarkdownPreview.tsx`       | 신규      | 미리보기 패널 컨테이너            |
| `src/components/preview/PreviewRenderer.tsx`       | 신규      | HTML 렌더링 컴포넌트              |
| `src/components/preview/MermaidRenderer.tsx`       | 신규      | Mermaid 다이어그램 렌더러         |
| `src/components/preview/CodeBlockRenderer.tsx`     | 신규      | 코드 블록 복사 버튼 렌더러        |

---

## Risk Analysis

### 리스크 1: Shiki 초기 로딩 시간

- **가능성**: 높음
- **영향**: 중간
- **설명**: Shiki는 TextMate 문법 파일을 비동기 로딩하므로 첫 렌더링 시 코드 하이라이팅이 지연될 수 있다.
- **대응**: 싱글턴 패턴으로 초기화를 앱 시작 시 1회만 수행. 초기화 완료 전 폴백 렌더링(`<pre><code>`) 제공. 기본 언어 10개만 프리로딩.

### 리스크 2: Mermaid 번들 크기

- **가능성**: 높음
- **영향**: 중간
- **설명**: Mermaid v11은 ~1MB의 번들 크기를 가지며 초기 로딩 시간에 영향을 줄 수 있다.
- **대응**: 동적 import (`import('mermaid')`)를 사용하여 Mermaid를 지연 로딩. 미리보기 패널이 활성화되고 실제 Mermaid 코드 블록이 감지될 때만 로딩.

### 리스크 3: XSS 보안 취약점

- **가능성**: 낮음
- **영향**: 매우 높음
- **설명**: `dangerouslySetInnerHTML` 사용 시 XSS 공격 벡터가 될 수 있다.
- **대응**: markdown-it의 `html: false` 설정으로 사용자 HTML 완전 차단. Mermaid의 `securityLevel: 'strict'` 적용. 미리보기 HTML은 오직 markdown-it 출력만 사용.

### 리스크 4: 대용량 문서의 렌더링 성능

- **가능성**: 중간
- **영향**: 중간
- **설명**: 50KB+ 문서에서 markdown-it 변환 + Shiki 하이라이팅 + Mermaid 렌더링이 성능 목표를 초과할 수 있다.
- **대응**: 300ms 디바운스로 불필요한 렌더링 방지. Mermaid IntersectionObserver 지연 로딩. Shiki 결과 캐싱. 필요 시 증분 렌더링(변경된 부분만) 도입.

### 리스크 5: 디바운스 중 상태 불일치

- **가능성**: 중간
- **영향**: 낮음
- **설명**: 빠른 타이핑 시 디바운스 대기 중 미리보기가 에디터 내용과 일시적으로 불일치할 수 있다.
- **대응**: 디바운스는 의도된 동작(300ms 지연)이며, 사용자 경험상 허용 가능한 수준. `isRendering` 상태로 렌더링 진행 중임을 시각적으로 표시 가능.

---

## Architecture Design Direction

### 컴포넌트 계층 구조

```
MarkdownPreview (최상위 컨테이너)
  ├── PreviewRenderer (HTML 렌더링)
  │     ├── Tailwind prose 스타일링
  │     └── dangerouslySetInnerHTML
  ├── CodeBlockRenderer (코드 블록 후처리)
  │     └── 복사 버튼 동적 주입
  └── MermaidRenderer (다이어그램 후처리)
        ├── IntersectionObserver
        └── mermaid.render() -> SVG 주입
```

### 데이터 흐름

```
editorStore.content (변경 감지)
  → usePreview 훅 (300ms 디바운스)
  → renderer.render(content)
      ├── mermaidPlugin: mermaid 블록 -> <div data-diagram>
      ├── Shiki highlight: 코드 블록 -> 하이라이팅 HTML
      └── markdown-it: 표준 Markdown -> HTML
  → PreviewRenderer (innerHTML)
  → useEffect 후처리
      ├── CodeBlockRenderer: 복사 버튼 추가
      └── MermaidRenderer: SVG 다이어그램 렌더링
```

### 핵심 설계 원칙

1. **보안 우선**: `html: false`, `securityLevel: 'strict'`, markdown-it 출력만 렌더링
2. **에러 격리**: 개별 다이어그램/코드 블록 실패가 전체 미리보기를 중단하지 않음
3. **지연 로딩**: Mermaid 라이브러리와 다이어그램 모두 필요 시점에만 로딩
4. **싱글턴 패턴**: Shiki 하이라이터와 markdown-it 인스턴스를 싱글턴으로 관리
5. **디바운스**: 300ms 디바운스로 불필요한 렌더링 방지 및 성능 보장
