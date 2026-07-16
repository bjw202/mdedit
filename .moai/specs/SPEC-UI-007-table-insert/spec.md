---
id: SPEC-UI-007
version: "0.0.2"
status: draft
created: "2026-07-16"
updated: "2026-07-16"
author: "jw"
priority: medium
issue_number: 11
dependencies:
  - SPEC-UI-006
tags:
  - ui
  - editor
  - toolbar
  - table
  - popover
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.1 | 2026-07-16 | jw | 최초 SPEC 작성 — 에디터 툴바 "Insert Table" 버튼 + 8×8 그리드 피커 팝오버. Human gate 확정 결정 5건 반영: (1) 그리드 (r, c) 선택 = **총 r행(헤더 포함, 본문 r-1행)** × c열, (2) 크기 라벨 = **행 우선** 행렬 표기 "r × c", (3) 빈 본문 셀 = 공백 패딩 `|     |` 스타일, (4) view-only 모드 = no-op(기존 포맷 버튼 가드 패턴), (5) 테스트 범위 = 컴포넌트 테스트만(신규 Playwright E2E 없음). |
| 0.0.2 | 2026-07-16 | jw | plan-audit 리뷰(SPEC-UI-007-review-1) 반영: **D1** AC 매핑 표 수정 — AC-UI-007-010을 REQ-UI-007-002(다크모드 토큰)로 정정, tsc/vitest 게이트는 표 밖 Quality Gates 노트로 이동(acceptance.md와 1:1 복원, REQ-002 커버·고아 AC 제거). **D2** REQ-UI-007-015("적용할 수 있다", shall 아님, AC 없음)를 Requirements에서 삭제하고 Design Notes / Future Considerations로 이동(REQ는 001–014). **D3** REQ-011/012/013 이중 부정 제거(shall not + 긍정형 동사). **D4** REQ-007에서 API 식별자(`EditorSelection.range`, `view.focus()`)를 행동 서술로 교체, 구현 지시는 Delta/Design Notes로 이동. **D5** REQ-010/"정상적으로" 제거. |

## Summary

`mdedit` (Tauri v2 + React 18 + TypeScript + CodeMirror 6) 에디터 툴바에 **Insert Table** 버튼을 추가한다. 버튼은 Quote와 Image 사이에 배치되며, 클릭 시 8×8 그리드 피커 팝오버가 열린다. 사용자가 그리드 셀 (r, c)를 호버하면 좌상단 기준 r×c 범위가 하이라이트되고 "r × c"(행 × 열) 크기 라벨이 표시된다. 셀 클릭 시 커서 위치에 markdown 테이블 스켈레톤 — 헤더 행(`Header 1..c` 플레이스홀더) + `| --- |` 구분 행 + (r−1)개의 공백 패딩 빈 본문 행 — 이 독립 블록으로 삽입되고, 첫 헤더 셀의 `Header 1` 텍스트가 선택된 상태로 에디터 포커스가 복귀한다.

핵심 설계 결정(사용자 승인, 재검토 금지):

- **`TableIcon`**: Lucide `table` 글리프를 `src/components/icons/icons.tsx`에 인라인(stroke 1.5, `currentColor`), SPEC-UI-006 아이콘 규약 준수 — `lucide-react` 런타임 의존성 미도입.
- **팝오버**: `.md-menu` 디자인 언어 재사용(`--md-surface-raised`, `--md-border`, `--md-shadow-md`), relative 래퍼 + `absolute top-full z-50`, 포털 없음. 다크모드는 토큰으로 자동.
- **그리드 시맨틱**: 셀 (r, c) 선택 = 총 r행(헤더 1행 + 본문 r−1행) × c열. r=1이면 헤더 행만 삽입(본문 0행).
- **콜백 계약**: 기존 `FormatAction` 문자열 계약과 `handleFormat` switch를 변경하지 않고, 별도 `onInsertTable(rows, cols)` prop을 신설한다.
- **닫힘**: 외부 mousedown(Header.tsx export-menu 패턴) 및 Escape 키.

## Background & Rationale

현재 툴바는 bold/italic/heading/list/code/link/quote/image 포맷 액션만 제공하며, 테이블 작성은 사용자가 직접 파이프 문법을 타이핑해야 한다. markdown 테이블은 구분 행 문법(`| --- |`)이 오류 유발이 높은 반복 작업이므로, 시각적 그리드 피커로 스켈레톤을 삽입해 진입 장벽을 낮춘다.

기술 컨텍스트(research.md 근거):

- 툴바의 `onFormat?: (action: FormatAction) => void`는 문자열 전용 계약이라 rows/cols를 전달할 수 없다 → 별도 prop 신설이 최소 침습 (EditorToolbar.tsx:22–33).
- 팝오버 셸(relative 래퍼 + absolute `.md-menu` + 외부 mousedown 닫기)은 Header.tsx export 메뉴에 검증된 선례가 있다 (Header.tsx:54–75, 127–163). Esc 닫기는 선례가 없는 신규 패턴이나 본 SPEC의 명시적 범위이다.
- 삽입 헬퍼는 기존 `wrapSelection`/`prefixLine`과 동일한 CodeMirror dispatch 패턴으로 `keyboard-shortcuts.ts`에 배치한다 (keyboard-shortcuts.ts:16–90).

## Environment & Assumptions

- 프론트엔드: React 18, TypeScript strict, CodeMirror 6, Tailwind CSS 3 + SPEC-UI-006 `.md-*` 토큰/컴포넌트 CSS.
- EditorView 접근: `AppLayout.tsx`의 `viewRef.current` (`handleViewReady`, AppLayout.tsx:187–190).
- 프리뷰 렌더러: markdown-it v14 (GFM 테이블) — 공백 패딩 빈 셀(`|     |`)을 정상 렌더한다.
- 테스트 환경: vitest + @testing-library/react + jsdom(EditorView 직접 구성 선례: `image-widget.test.ts`).

## Requirements (EARS)

### Ubiquitous Requirements

- **REQ-UI-007-001**: The system **shall** 항상 그리드 피커의 모든 셀 버튼(64개)에 삽입될 크기를 설명하는 개별 `aria-label`(예: `"Insert 3 by 4 table"` = 3행 × 4열)을 제공한다.
- **REQ-UI-007-002**: The system **shall** 항상 팝오버·그리드·라벨 스타일을 `--md-*` 시맨틱 토큰만으로 렌더한다(raw hex 금지). 다크모드는 토큰 전환으로 자동 적용된다.
- **REQ-UI-007-003**: The system **shall** 항상 Insert Table 트리거 버튼에 `aria-label`, `title`, `aria-haspopup="true"`, `aria-expanded`(열림 상태 반영)를 유지한다.

### Event-Driven Requirements

- **REQ-UI-007-004**: **WHEN** 사용자가 Insert Table 버튼을 클릭하면, **the system shall** 버튼 아래(`top-full`, `z-50`)에 8열 × 8행 그리드 피커 팝오버를 연다.
- **REQ-UI-007-005**: **WHEN** 사용자가 그리드 셀 (r행, c열)을 호버하면, **the system shall** 좌상단 기준 r×c 범위 셀을 `--md-accent-soft` 채움 + `--md-accent` 강조로 하이라이트하고, 그리드 아래에 **행 우선** 표기 크기 라벨 `"r × c"`(예: 4행 3열 호버 시 `"4 × 3"`)를 `--md-text-muted`로 표시한다.
- **REQ-UI-007-006**: **WHEN** 사용자가 그리드 셀 (r, c)를 클릭하면, **the system shall** 커서 위치에 markdown 테이블 스켈레톤을 삽입하고 팝오버를 닫는다. 스켈레톤 구성: c개의 `Header 1..c` 플레이스홀더 헤더 행 1행 + `| --- |` 구분 행 1행 + **(r−1)개**의 공백 패딩 빈 본문 행(`|     |` 스타일). 즉 선택한 r은 **헤더를 포함한 총 행 수**이다.
- **REQ-UI-007-007**: **WHEN** 테이블 삽입이 완료되면, **the system shall** 첫 헤더 셀의 `Header 1` 플레이스홀더 텍스트를 선택 상태로 만들고 에디터에 포커스를 복귀시켜, 즉시 타이핑하면 플레이스홀더가 교체되게 한다.
- **REQ-UI-007-008**: **WHEN** 팝오버가 열린 상태에서 팝오버·트리거 외부에 mousedown이 발생하거나 Escape 키가 눌리면, **the system shall** 팝오버를 닫는다.

### State-Driven Requirements

- **REQ-UI-007-009**: **WHILE** 커서가 비어 있지 않은 줄의 중간(커서 앞 또는 뒤에 텍스트 존재)에 있는 동안 삽입이 발생하면, **the system shall** 필요한 쪽에 빈 줄을 삽입하여 테이블이 독립된 markdown 블록이 되게 한다.
- **REQ-UI-007-010**: **WHILE** view-only 모드(EditorView가 null) 동안, **the system shall** 셀 클릭 시 문서 변경 없이 no-op 처리하고 팝오버를 닫는다(기존 `handleFormat`의 null 가드 패턴과 동일).

### Unwanted Behavior Requirements

- **REQ-UI-007-011**: The system **shall not** 기존 `FormatAction` 유니언 타입, `onFormat` 콜백 시그니처, `handleFormat` switch(@MX:ANCHOR)를 변경한다. 테이블 삽입은 별도 `onInsertTable(rows, cols)` prop으로 전달된다.
- **REQ-UI-007-012**: The system **shall not** 신규 런타임 의존성(`lucide-react`, floating-ui, 포털/팝오버 라이브러리 등)을 추가한다.
- **REQ-UI-007-013**: The system **shall not** 신규 키보드 단축키 바인딩을 등록한다(`markdownKeyBindings` 무변경).
- **REQ-UI-007-014**: **IF** EditorView가 null인 상태에서 삽입이 요청되면, **then** the system **shall** 문서 dispatch를 시도하지 않고 조용히 반환한다(에러/예외 없음).

## Design Notes / Future Considerations

> 아래 항목은 요구사항이 아니며(AC 없음), Run phase의 설계 참고 사항이다.

- **우측 정렬 폴백**: 팝오버가 창 우측 경계를 넘는 상황이 확인되면 우측 정렬(`right-0`) 폴백을 검토한다. 그리드 폭이 작아 실질 위험은 낮음(plan.md 추가 리스크 참조). 채택 시 별도 REQ/AC로 승격한다.
- **삽입 후 선택/포커스 구현 힌트**: REQ-UI-007-007의 행동은 CodeMirror `EditorSelection.range`로 첫 헤더 셀 오프셋을 선택하고 `view.focus()`를 호출하는 방식을 상정한다(plan.md T2/T5 참조). 구현 세부는 Run phase 재량.

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [MODIFY] | `src/components/icons/icons.tsx` | `TableIcon` 추가(Lucide `table` 인라인, 알파벳 순서 유지) |
| [MODIFY] | `src/components/icons/index.ts` | `TableIcon` 배럴 export |
| [MODIFY] | `src/components/editor/extensions/keyboard-shortcuts.ts` | `insertTable(view, rows, cols): boolean` 헬퍼 추가 |
| [MODIFY] | `src/components/editor/EditorToolbar.tsx` | `onInsertTable` prop + Insert Table 버튼/그리드 피커 팝오버(Quote–Image 사이) |
| [MODIFY] | `src/components/layout/AppLayout.tsx` | `handleInsertTable` 핸들러 신설 + `EditorToolbar` 배선(`view.focus()` 포함) |
| [MODIFY] | `src/styles/mdedit-components.css` | 그리드 피커 클래스(`.md-table-picker*`) 추가(토큰만 사용) |
| [MODIFY] | `src/test/EditorToolbar.test.tsx` | Insert Table 버튼 렌더/접근성 어서션 확장 |
| [NEW] | `src/test/insertTable.test.ts` | `insertTable` jsdom EditorView 단위 테스트 |
| [NEW] | `src/test/TableGridPicker.test.tsx` | 그리드 피커 팝오버 컴포넌트 테스트 |

## Acceptance Criteria

> acceptance.md의 Given-When-Then 시나리오와 1:1 매핑. 전 시나리오 **컴포넌트 테스트**(vitest + testing-library + jsdom EditorView)로 검증 — 신규 Playwright E2E 없음(확정 결정 5).

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-UI-007-001 | REQ-UI-007-003, 004 | 버튼 클릭 → 팝오버 열림(`aria-expanded` 토글) + 8×8 그리드 표시 |
| AC-UI-007-002 | REQ-UI-007-005 | 셀 (4행, 3열) 호버 → 12개 셀 하이라이트 + "4 × 3" 라벨(행 우선) |
| AC-UI-007-003 | REQ-UI-007-006, 007 | 빈 줄에서 (3, 4) 클릭 → 헤더 4열 + 구분 행 + 빈 본문 2행 삽입, `Header 1` 선택, 포커스 복귀, 팝오버 닫힘 |
| AC-UI-007-004 | REQ-UI-007-009 | 줄 중간 커서에서 삽입 → 앞뒤 빈 줄 패딩으로 독립 블록화 |
| AC-UI-007-005 | REQ-UI-007-006 | 경계값: (1, 1) → 헤더 1열 + 구분 행만(본문 0행); (8, 8) → 헤더 8열 + 본문 7행 |
| AC-UI-007-006 | REQ-UI-007-010, 014 | view-only(view null)에서 셀 클릭 → 문서 무변경, 예외 없음, 팝오버 닫힘 |
| AC-UI-007-007 | REQ-UI-007-008 | 외부 mousedown → 닫힘; Escape → 닫힘 |
| AC-UI-007-008 | REQ-UI-007-001 | 접근성 스위트: 트리거 + 64개 그리드 셀 전부 `aria-label` 보유 |
| AC-UI-007-009 | REQ-UI-007-011, 012, 013 | 기존 `onFormat` 테스트 무변경 통과, `package.json` 의존성 무변경, 키맵 무변경 |
| AC-UI-007-010 | REQ-UI-007-002 | 다크모드 토큰 — 신규 CSS가 `--md-*` 토큰만 사용, raw hex 없음 |

**Quality Gates (AC 외 공통 게이트)**: `tsc --noEmit` 클린 + 전체 vitest 통과(접근성 스위트 포함) + 기존 Playwright 무변경 통과. `npm run lint`는 eslint config 부재로 게이트에서 제외(프로젝트 알려진 제약). 상세 기준은 acceptance.md "Quality Gate Criteria" 참조.

## Exclusions (What NOT to Build)

- **키보드 단축키 없음** — Mod-Shift-t 등 신규 바인딩 미도입 (v1).
- **화살표 키 그리드 탐색 없음** — 팝오버 조작은 마우스 + Esc 닫기만 (v1).
- **기존 테이블 편집/포맷팅 없음** — 이미 존재하는 markdown 테이블의 정렬·열 추가·재포맷 기능 미포함.
- **정렬 옵션 없음** — `:---:` 등 컬럼 정렬 지정 UI 미제공, 구분 행은 `---` 고정.
- **WYSIWYG 테이블 에디터 없음** — 순수 markdown 텍스트 삽입만.
- **8×8 초과 그리드 없음** — 직접 숫자 입력 등 확장 입력 미제공.
- **포털/floating-ui 미도입** — 순수 CSS 포지셔닝, 신규 런타임 의존성 없음.
- **신규 Playwright E2E 없음** — 컴포넌트 테스트만(확정 결정 5). 기존 E2E는 무변경 통과 대상.
- **Rust 백엔드 무변경** — `src-tauri/` 미접촉.
