---
id: SPEC-PREVIEW-002
version: "1.0.0"
status: implemented
created: "2026-02-24"
updated: "2026-02-24"
author: "jw"
priority: P2
tags: [preview, scroll-sync, data-line, markdown-it, editor-view, codemirror]
dependencies: [SPEC-EDITOR-001, SPEC-PREVIEW-001, SPEC-UI-001]
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-24 | jw | Initial SPEC creation |

## Overview

MdEdit의 에디터-미리보기 스크롤 동기화를 구현한다. markdown-it 렌더링 시 소스 라인 번호를 `data-line` 속성으로 HTML 요소에 주입하고, 에디터의 커서/스크롤 위치에 따라 미리보기를 동기화하는 `useScrollSync` 훅을 생성한다. 에디터의 `EditorView`를 `onViewReady` 패턴으로 외부에 노출하고, 미리보기의 스크롤 컨테이너 ref를 연결하여 양방향(또는 단방향) 스크롤 동기화를 구현한다. Footer에 스크롤 동기화 토글 버튼을 추가하고 uiStore에 persist한다.

### 범위

- `renderer.ts`에 markdown-it 플러그인으로 `data-line` 속성 주입
- `useScrollSync` 커스텀 훅 신규 생성
- MarkdownEditor `onViewReady` prop과 MarkdownPreview `previewRef` 연결
- Footer에 스크롤 동기화 토글 버튼 (uiStore persist)
- 라인 번호 기반 스크롤 매핑 (퍼센트 기반 대비 정확도 우수)

### 범위 제외

- 미리보기 → 에디터 역방향 스크롤 동기화 (V2+ 범위, 현재는 에디터 → 미리보기 단방향)
- 에디터 미니맵 스크롤 (V2+ 범위)
- 수학 수식 블록의 라인 매핑 (V2+ 범위)

---

## EARS Requirements

### Ubiquitous Requirements

- **REQ-PREVIEW002-U01**: 시스템은 항상 markdown-it 렌더링 시 블록 레벨 HTML 요소(p, h1-h6, pre, blockquote, ul, ol, table, hr)에 `data-line` 속성을 주입하여 소스 Markdown 라인 번호를 기록해야 한다.
- **REQ-PREVIEW002-U02**: 시스템은 항상 uiStore에 `scrollSyncEnabled` 상태를 persist하여 앱 재시작 시에도 사용자 설정을 유지해야 한다.
- **REQ-PREVIEW002-U03**: 시스템은 항상 라인 번호 기반 매핑을 사용하여 스크롤 동기화를 수행해야 한다 (퍼센트 기반 동기화 금지).

### Event-Driven Requirements

- **REQ-PREVIEW002-E01**: WHEN 에디터의 스크롤 위치가 변경될 때, THEN 시스템은 현재 보이는 최상단 라인 번호를 계산하고, 미리보기에서 해당 `data-line` 속성을 가진 요소로 스크롤해야 한다.
- **REQ-PREVIEW002-E02**: WHEN 에디터의 커서 위치가 변경될 때, THEN 시스템은 커서가 위치한 라인에 대응하는 미리보기 요소가 뷰포트에 보이도록 스크롤해야 한다.
- **REQ-PREVIEW002-E03**: WHEN 사용자가 Footer의 스크롤 동기화 토글 버튼을 클릭할 때, THEN 시스템은 `scrollSyncEnabled` 상태를 토글하고 uiStore에 persist해야 한다.
- **REQ-PREVIEW002-E04**: WHEN 스크롤 동기화가 활성화된 상태에서 에디터 콘텐츠가 변경될 때, THEN 시스템은 미리보기 재렌더링 후 현재 에디터 스크롤 위치에 맞춰 미리보기를 재동기화해야 한다.
- **REQ-PREVIEW002-E05**: WHEN MarkdownEditor 컴포넌트가 마운트되고 EditorView가 생성될 때, THEN 시스템은 `onViewReady` 콜백을 통해 부모 컴포넌트에 EditorView 인스턴스를 전달해야 한다.

### State-Driven Requirements

- **REQ-PREVIEW002-S01**: IF `scrollSyncEnabled`가 `false`이면, THEN 에디터와 미리보기는 독립적으로 스크롤되어야 한다.
- **REQ-PREVIEW002-S02**: IF `scrollSyncEnabled`가 `true`이면, THEN 에디터 스크롤 시 미리보기가 자동으로 동기화되어야 한다.
- **REQ-PREVIEW002-S03**: IF 미리보기에 대응하는 `data-line` 요소가 없는 라인이면 (예: 빈 라인, 인라인 요소 내부), THEN 시스템은 가장 가까운 이전 `data-line` 요소를 기준으로 보간(interpolation)해야 한다.
- **REQ-PREVIEW002-S04**: IF editorStore의 `content`가 빈 문자열이면, THEN 스크롤 동기화는 비활성 상태여야 한다 (동기화할 콘텐츠 없음).

### Unwanted Behavior Requirements

- **REQ-PREVIEW002-N01**: 시스템은 스크롤 동기화 중 미리보기의 스크롤 이벤트가 에디터 스크롤에 피드백되어 무한 루프를 발생시키지 않아야 한다.
- **REQ-PREVIEW002-N02**: 시스템은 EditorView 인스턴스를 Zustand store에 직접 저장하지 않아야 한다 (DOM 객체 store 저장은 안티패턴).
- **REQ-PREVIEW002-N03**: 시스템은 스크롤 동기화가 비활성화된 상태에서 에디터 스크롤 이벤트를 처리하지 않아야 한다 (불필요한 계산 방지).
- **REQ-PREVIEW002-N04**: 시스템은 `data-line` 속성 주입으로 인해 기존 markdown-it 렌더링 성능을 10% 이상 저하시키지 않아야 한다.

### Optional Requirements

- **REQ-PREVIEW002-O01**: 가능하면 스크롤 동기화 시 smooth scroll 애니메이션을 적용해야 한다 (성능 허용 시).
- **REQ-PREVIEW002-O02**: 가능하면 Footer 토글 버튼에 동기화 상태를 시각적으로 표시(아이콘 색상 변경)해야 한다.

---

## Technical Constraints

### 신규 파일

| 파일 | 역할 |
|------|------|
| `src/hooks/useScrollSync.ts` | 에디터-미리보기 스크롤 동기화 훅 |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/markdown/renderer.ts` | data-line 주입 markdown-it 플러그인 추가 |
| `src/store/uiStore.ts` | `scrollSyncEnabled` 상태 추가 (persist) |
| `src/components/layout/Footer.tsx` | 스크롤 동기화 토글 버튼 추가 |
| `src/components/preview/MarkdownPreview.tsx` | 스크롤 컨테이너 ref 추가 (previewRef) |
| `src/components/editor/MarkdownEditor.tsx` | onViewReady prop 추가 (SPEC-EDITOR-002와 공유) |
| `src/components/layout/AppLayout.tsx` | viewRef, previewRef 연결, useScrollSync 호출 |

### data-line 주입 플러그인 설계

```
markdown-it 렌더링 파이프라인:
  Token 파싱 → 각 블록 토큰에 map 속성 존재 [startLine, endLine]
  → 플러그인: token.attrSet('data-line', token.map[0])
  → HTML 출력: <p data-line="5">텍스트</p>
```

대상 토큰 유형:
- `paragraph_open` → `<p data-line="N">`
- `heading_open` → `<h1-h6 data-line="N">`
- `fence` → `<pre data-line="N">`
- `blockquote_open` → `<blockquote data-line="N">`
- `bullet_list_open` → `<ul data-line="N">`
- `ordered_list_open` → `<ol data-line="N">`
- `table_open` → `<table data-line="N">`
- `hr` → `<hr data-line="N">`

### useScrollSync 훅 설계

```
Input:
  - editorView: EditorView | null (onViewReady에서 전달)
  - previewRef: RefObject<HTMLDivElement> (미리보기 스크롤 컨테이너)
  - enabled: boolean (scrollSyncEnabled)

Behavior:
  1. EditorView의 scrollDOM에 scroll 이벤트 리스너 등록
  2. 에디터 최상단 보이는 라인 번호 계산:
     - EditorView.lineBlockAtHeight(scrollTop) → 라인 번호
  3. 미리보기에서 data-line 요소 탐색:
     - querySelectorAll('[data-line]')
     - 가장 가까운 라인 요소 찾기
  4. 미리보기 스크롤:
     - element.scrollIntoView() 또는 scrollTop 직접 설정
  5. requestAnimationFrame으로 스크롤 이벤트 스로틀링

Cleanup:
  - 이벤트 리스너 해제
  - 피드백 루프 방지 플래그 관리
```

### 성능 요구사항

| 지표 | 목표값 |
|------|--------|
| data-line 주입 오버헤드 (10KB) | < 5ms (기존 렌더링 대비) |
| 스크롤 동기화 응답 시간 | < 50ms (에디터 스크롤 ~ 미리보기 이동) |
| data-line 요소 탐색 | < 5ms (querySelectorAll) |
| 스크롤 이벤트 스로틀링 | requestAnimationFrame (16ms) |

### 기술 스택 제약

- React 18.x with TypeScript strict mode
- CodeMirror 6 (EditorView.scrollDOM, lineBlockAtHeight)
- markdown-it 14.x (token.map, token.attrSet)
- Zustand 5.x with persist middleware
- Tailwind CSS 3.x

---

## Dependencies

### 내부 의존성

| SPEC ID | 의존 내용 |
|---------|-----------|
| SPEC-EDITOR-001 | CodeMirror EditorView 인스턴스, editorStore |
| SPEC-PREVIEW-001 | markdown-it renderer.ts, MarkdownPreview 컴포넌트 |
| SPEC-UI-001 | AppLayout 3-pane 레이아웃, Footer 컴포넌트 영역 |
| SPEC-EDITOR-002 | onViewReady 패턴 공유 (EditorView 외부 노출) |

### 외부 라이브러리

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| markdown-it | 14.x | 토큰 기반 data-line 주입 |
| @codemirror/view | 6.x | EditorView.scrollDOM, lineBlockAtHeight |
| react | 18.x | useRef, useEffect, useCallback |
| zustand | 5.x | scrollSyncEnabled persist |

### 하류 의존성

- 없음 (스크롤 동기화는 UX 기능의 최종 단계)

---

## Traceability

- **Product Reference**: product.md - Core Feature 2 (Real-Time Preview), UX Enhancement (Scroll Sync)
- **Structure Reference**: structure.md - `src/hooks/`, `src/lib/markdown/`, `src/components/preview/`, `src/components/layout/`
- **Tech Reference**: tech.md - CodeMirror 6, markdown-it 14, Zustand persist
