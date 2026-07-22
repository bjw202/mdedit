---
id: SPEC-UI-008
version: "0.0.2"
status: planned
created: "2026-07-22"
updated: "2026-07-22"
author: "jw"
priority: medium
issue_number: 0
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.2 | 2026-07-22 | jw | Run-entry plan 작성 — spec.md/acceptance.md v0.0.2(plan-auditor review-2 PASS 0.97)와 정합. SPEC-UI-007 `plan.md`/`tasks.md` 구조를 준용(팝오버 셸·`onInsert*` 별도 prop·`insert*` 헬퍼·null 가드 배선). 실제 소스(EditorToolbar.tsx:43·90·140, keyboard-shortcuts.ts:119·184, AppLayout.tsx:227·300·314, PreviewRenderer.tsx:110–124, icons.tsx:10, index.ts, mdedit-components.css:97–113·235) 대조로 파일 경로·라인 근거를 확정. 개발 방법론 = TDD(브라운필드 Pre-RED 특성화 포함). 브랜치 = `feature/SPEC-UI-008-diagram-insert-menu`. |

## Overview

에디터 툴바에 **다이어그램** 트리거 버튼을 추가하고, 클릭 시 8개 항목(7종 프리셋 + 사용자 정의)의 세로 드롭다운 서브메뉴를 연다. 프리셋 항목 선택 시 커서 위치에 해당 프리셋의 3–5줄 한글 최소 예제를 담은 ```mermaid 펜스가 독립 블록으로 삽입되고, 커서는 첫 사용자 편집 토큰에 놓인다. 사용자 정의 항목은 빈 ```mermaid 펜스를 삽입하며, 빈/공백 펜스에 대해 프리뷰는 mermaid 파싱 오류(`⚠ Diagram syntax error`) 대신 안내 플레이스홀더를 표시한다.

본 SPEC은 SPEC-UI-007 Insert Table이 검증한 삽입 확장 패턴(팝오버 셸 재사용, `onInsertTable`과 병렬로 `onInsertDiagram` prop 신설, `insertTable`과 병렬로 `insertDiagram` 헬퍼, `handleFormat`/`FormatAction` 무변경)을 그대로 확장하는 최소 침습 변경이다.

- 개발 방법론: **TDD** (`quality.yaml` `development_mode: tdd`, RED-GREEN-REFACTOR, 브라운필드 Pre-RED 특성화 포함)
- 브랜치: `feature/SPEC-UI-008-diagram-insert-menu` (`/moai run` 단계에서 생성)
- 신규 런타임 의존성: **없음** (SPEC-UI-006 아이콘 규약 준수 — `svgProps` 인라인 SVG)
- 요구/수용 기준: spec.md REQ-UI-008-001~022, acceptance.md AC-UI-008-001~013 (본 plan은 이를 구현 관점으로 분해하며 요구사항 자체를 변경하지 않는다)

## Confirmed Design Decisions (사용자 승인, 재검토 금지)

spec.md HISTORY(0.0.1)·Summary의 사용자 확정 결정을 옮긴 것으로, Run phase에서 **재검토 금지**다.

1. **진입점 = EditorToolbar.tsx 신규 "다이어그램" 버튼** — SPEC-UI-007 `TableGridPicker`가 검증한 팝오버 셸(relative 래퍼 + `absolute top-full z-50`, 외부 mousedown + Escape 닫힘, 포털 없음)을 드롭다운 리스트 형태로 재사용한다.
2. **프리셋 7종 고정** = flowchart / sequenceDiagram / gantt / classDiagram / stateDiagram-v2 / pie / mindmap. 각 항목 = 흑백 스켈레톤 아이콘(SPEC-UI-006 `svgProps` 인라인, `stroke="currentColor"`) + 한글 라벨.
3. **프리셋 선택 = 즉시 오류 없이 렌더되는 3–5줄 한글 예제** ```mermaid 펜스 삽입 + 첫 사용자 편집 토큰에 커서. 스니펫은 mermaid 11.12.3으로 런타임 검증됨(spec.md "Preset Snippet Definitions") — **고정, 변경 금지**.
4. **사용자 정의(8번째) = 빈 ```mermaid 펜스 삽입** + 프리뷰 플레이스홀더("다이어그램 문법을 입력하세요" 스타일). 커서는 펜스 본문 빈 줄.
5. **AI 경계 = 수동 삽입 전용** — ai-suggestion-card + `mermaidValidate.ts`(SPEC-AI-003/004) 무변경, AI 토글(SPEC-AI-005) 상태 무관.
6. **계약 무변경** = `FormatAction` 유니언·`onFormat`·`onInsertTable`·`handleFormat` switch(@MX:ANCHOR) 불침범. 다이어그램 삽입은 별도 `onInsertDiagram(preset)` prop으로 전달.
7. **회귀 불변식** = 신규 런타임 의존성 0, 프리셋 정확히 8항목(17종 미추가), `markdownKeyBindings` 무변경, mermaid 핀 11.12.3 + `securityLevel: 'strict'` 유지.

## Task Decomposition

TDD 순서에 맞춰 각 유닛은 "테스트 먼저(RED) → 최소 구현(GREEN) → 정리(REFACTOR)"로 진행한다. 브라운필드 영역(PreviewRenderer, EditorToolbar 기존 계약)은 변경 전 **Pre-RED 특성화**로 기존 동작을 고정한 뒤 확장한다.

### T1. [Pre-RED] 브라운필드 특성화 — 기존 계약 고정

- 목적: 변경 대상 파일의 기존 동작을 회귀 기준선으로 고정한다(REQ-018/020 방어).
- 확인 대상:
  - `PreviewRenderer.tsx:113–124` — **비어 있지 않은** 잘못된 다이어그램 → `⚠ Diagram syntax error` 폴백(`el.innerHTML`, line 122)이 현재 통과함을 `PreviewRenderer.test.tsx`에서 확인/보강.
  - `EditorToolbar.tsx` — 기존 `onFormat` 콜백 테스트 + 접근성 스위트(모든 버튼 `aria-label`)가 green임을 확인.
  - `keyboard-shortcuts.ts:184` — `markdownKeyBindings` 스냅샷(길이/키 목록)을 회귀 가드 기준선으로 확보.
- 파일: `src/test/PreviewRenderer.test.tsx`(read/보강), `src/test/EditorToolbar.test.tsx`(read).
- Done: 변경 전 전체 vitest green, 위 3개 기준선이 명시적으로 존재.

### T2. [RED→GREEN→REFACTOR] 프리셋 스니펫 상수 + `insertDiagram` 헬퍼 — `src/components/editor/extensions/keyboard-shortcuts.ts`

- 프리셋 스니펫 상수 테이블: spec.md "Preset Snippet Definitions" 7종을 그대로 상수화(펜스 본문 + "첫 편집 토큰" 오프셋 메타). **스니펫 문자열은 spec.md 고정본과 문자 단위 일치**해야 한다.
- 시그니처: `insertDiagram(view: EditorView, preset: DiagramPreset): boolean` — `insertTable`(:119)과 나란히 배치. `preset`은 7종 프리셋 + `'custom'`(빈 펜스) 유니언.
- 삽입: `state.changeByRange`로 커서 위치에 ```mermaid 펜스 삽입. `insertTable`의 블록화 패턴(`lineAt`, `needsLeadingPad`/`needsTrailingPad`, :126–131) 재사용해 줄 중간 삽입 시 앞뒤 `\n` 패딩(REQ-015).
- 커서 배치: 프리셋은 스니펫 내 "첫 편집 토큰" 오프셋을 `EditorSelection.range`로 선택(REQ-009). 사용자 정의는 펜스 본문 빈 줄에 커서(REQ-010). `insertTable`의 `headerOffset`(:133–135) 선례.
- @MX: `insertDiagram`에 `@MX:NOTE`(스니펫 규칙·블록 패딩·커서 배치 의도) + `@MX:SPEC: SPEC-UI-008`.
- 테스트(RED first, 신규 `src/test/insertDiagram.test.ts`, jsdom `EditorView` 직접 구성 — `insertTable.test.ts`/`image-widget.test.ts` 선례):
  - 프리셋 7종 각각 정확한 펜스 삽입 + 첫 편집 토큰 selection 일치.
  - 사용자 정의 → 빈 펜스 + 본문 빈 줄 커서.
  - 줄 중간/줄 끝/줄 시작 삽입 → 앞뒤 패딩 분기.
  - (AC-004) 프리셋 7종 스니펫이 mermaid 11.12.3 `mermaid.parse`를 오류 없이 통과.
- 매핑: REQ-008/009/010/015, AC-003/004/005/008.

### T3. [RED→GREEN] 프리셋 7종 흑백 스켈레톤 아이콘 — `src/components/icons/icons.tsx` (+ `index.ts`)

- 7종 골격 아이콘을 기존 `svgProps(props)` 헬퍼(:10–24)로 인라인. `stroke="currentColor"` 상속, viewBox 24, 파일 내 그룹/알파벳 순서 유지.
- 형태 힌트(비이진, spec.md Design Notes): flowchart(상자→화살표), sequenceDiagram(2 라이프라인+화살표), gantt(수평 막대), classDiagram(제목 칸+속성 칸), stateDiagram(원+전이 화살표), pie(원+파이 슬라이스), mindmap(중심 원+방사 가지). **정확한 SVG path는 Run phase 재량**이나 7종 path 마크업이 서로 달라야 한다(REQ-003).
- `index.ts`는 `export * from './icons'`(현재 라인 3)이므로 신규 아이콘은 **자동 배럴 노출** — 별도 export 추가 불필요(아래 Discrepancy #1).
- 테스트: T4/T5 메뉴 렌더 테스트에서 `<svg>` 렌더 + `stroke="currentColor"` 상속 + 7종 마크업 상호 구별(중복 0)을 어서션.
- 매핑: REQ-002/003, AC-002.

### T4. [RED→GREEN→REFACTOR] DiagramInsertMenu 드롭다운 컴포넌트 — `src/components/editor/EditorToolbar.tsx` 내부(또는 동일 디렉토리 분리)

- 상태: `open`(useState), 래퍼 `ref`(useRef), 포커스 인덱스(키보드 순회용). `TableGridPicker`(:97–183) 셸 패턴 재사용.
- 렌더: 트리거 버튼(`aria-label`/`title`/`aria-haspopup="true"`/`aria-expanded={open}`, `md-tool-btn`) + `top-full z-50` 팝오버에 8개 항목을 `<button type="button">` 세로 리스트로. 각 항목 = 아이콘(프리셋 7종) + 한글 라벨 + 비어 있지 않은 `aria-label`(REQ-001/004/007).
- 상호작용: 항목 클릭 → `onInsertDiagram(preset)` 호출 후 닫힘. 외부 mousedown + Escape 닫힘(`TableGridPicker`/Header.tsx 선례, REQ-011). 방향키/Tab 포커스 순회 + Enter/Space 선택(REQ-012).
- CSS: 세로 리스트는 기존 `.md-menu`/`.md-menu-item`(css:97–113, 이미 `svg`+토큰 스타일 보유) 재사용을 우선 검토(Discrepancy #4). `.md-table-picker` 그리드 클래스는 부적합.
- @MX: 드롭다운에 `@MX:NOTE`(외부 mousedown + Esc 이중 닫힘 + 키보드 순회 근거) + `@MX:SPEC: SPEC-UI-008`.
- 테스트(RED first, 신규 `src/test/DiagramInsertMenu.test.tsx`, `TableGridPicker`/`aiSuggestionCardRender` 선례):
  - 버튼 클릭 → 열림(`aria-expanded` 토글) + 8개 항목 표시.
  - 항목 클릭 → `onInsertDiagram(preset)` 정확 인자 호출 + 닫힘.
  - 외부 mousedown / Escape → 닫힘. 방향키·Tab 순회 + Enter/Space 선택.
  - 8개 항목 개별 `aria-label` + 한글 라벨; 7종 아이콘 `<svg>` + `stroke="currentColor"` + 마크업 상호 구별.
- 매핑: REQ-001/004/007/011/012, AC-001/002/010.

### T5. [RED→GREEN] 툴바 통합(`onInsertDiagram` prop) — `src/components/editor/EditorToolbar.tsx`

- `EditorToolbarProps`에 `onInsertDiagram?: (preset: DiagramPreset) => void` 추가(:43 `onInsertTable` 인접). `onFormat`/`FormatAction`/`onInsertTable` 계약 **무변경**(REQ-018).
- `<TableGridPicker>`(:200) 인접에 `<DiagramInsertMenu onInsertDiagram={onInsertDiagram} />` 배치. `TOOLBAR_BUTTONS` 단순 액션 배열 무변경.
- 테스트: `src/test/EditorToolbar.test.tsx` 확장 — 다이어그램 버튼 렌더 + `aria-label`; 접근성 스위트가 신규 항목 포함 통과; 기존 `onFormat` 콜백 테스트 무변경 통과(회귀).
- 매핑: REQ-004/018, AC-001/012.

### T6. [RED→GREEN] AppLayout 배선(`handleInsertDiagram`) — `src/components/layout/AppLayout.tsx`

- `handleInsertDiagram(preset)` 신설: `viewRef.current` null 가드(`handleInsertTable`:300–304 패턴, view-only 시 no-op — REQ-016) → `insertDiagram(view, preset)` → `view.focus()`.
- `keyboard-shortcuts` import에 `insertDiagram` 추가(:25 기존 `insertTable` import 확장). `<EditorToolbar onInsertDiagram={handleInsertDiagram} />`(:320) 배선.
- `handleFormat` switch(@MX:ANCHOR) **무변경**. `handleInsertDiagram`은 별도 함수로 신설.
- @MX: `handleInsertDiagram`에 `@MX:NOTE`(null 가드 no-op 패턴, `handleInsertTable`과 동형). 기존 `handleFormat` `@MX:ANCHOR` 유지.
- 테스트: 삽입 로직은 T2 단위 테스트가 커버. 배선은 T4/T5 컴포넌트 테스트로 간접 검증(`handleInsertTable`과 동일 관례, spec.md/UI-007 선례).
- 매핑: REQ-016, AC-009/012.

### T7. [RED→GREEN→REFACTOR] 빈 펜스 플레이스홀더 분기 — `src/components/preview/PreviewRenderer.tsx`

- `containers.forEach`(:114–124)에 분기 추가: `diagram = el.getAttribute('data-diagram') ?? ''`를 `trim()`했을 때 빈 문자열이면 **`mermaid.parse`/`render`를 호출하지 않고** 플레이스홀더 마크업을 `el.innerHTML`에 주입(REQ-013). 비어 있지 않으면 기존 parse→render→catch 경로 유지(REQ-014, `⚠ Diagram syntax error` 폴백 불변).
- 플레이스홀더 문구/스타일: "다이어그램 문법을 입력하세요" 스타일, `--md-text-muted` 등 토큰 사용(spec.md Design Notes; 아래 Discrepancy #2 유의 — 인접 기존 폴백은 raw Tailwind 색이나 그 라인은 REQ-020으로 변경 금지).
- @MX: 플레이스홀더 분기에 `@MX:NOTE`(빈 본문 판정 = `trim()` 빈 문자열 → parse 생략) + `@MX:SPEC: SPEC-UI-008`. 기존 `@MX:ANCHOR`(:7) 유지.
- 테스트: `src/test/PreviewRenderer.test.tsx` 확장 —
  - 빈/공백 `data-diagram` → 플레이스홀더 표시 + `⚠ Diagram syntax error` **미표시**(AC-006).
  - 빈 펜스에 유효 내용 → 다이어그램 렌더로 전환; 잘못된 내용 → 기존 폴백(AC-007).
  - 기존 non-empty invalid 폴백 테스트 회귀 없음(T1 기준선).
- 매핑: REQ-013/014/020, AC-006/007.

### T8. [GREEN] CSS — `src/styles/mdedit-components.css`

- 드롭다운 리스트: 가능하면 기존 `.md-menu`/`.md-menu-item`(:97–113) 재사용. 부족 시 `.md-diagram-menu*` 신규 클래스 추가.
- 프리뷰 빈-펜스 플레이스홀더 클래스: `--md-text-muted` 등 토큰만.
- HARD: raw hex 금지, `--md-*` 토큰 + `currentColor`만. 다크모드는 `[data-theme="dark"]` 토큰 전환으로 자동(REQ-005, AC-011).
- 매핑: REQ-005, AC-011.

### T9. 회귀 가드 + 품질 게이트

- 회귀 가드 테스트(AC-013): `package.json` 신규 런타임 의존성 0(테스트/리뷰), 프리셋 목록 정확히 8항목, `markdownKeyBindings` 무변경(T1 스냅샷 대조).
- 게이트: `npm run typecheck`(`tsc --noEmit`) 클린 → `npm test`(vitest) 전체 통과(신규 2 + 확장 2 + 기존 무변경) → `npm run lint`(eslint, `.eslintrc.cjs` 존재·PR #37) 통과 → 기존 Playwright(`npm run test:e2e`) 무변경 통과(신규 E2E 없음, 확정 결정 = 컴포넌트 테스트만).
- 커버리지: 신규 코드 커밋당 80%+, 전체 목표 85%.
- 매핑: REQ-019/021/022, AC-013, Quality Gate Criteria.

### 실행 순서 및 의존성

```
T1 (Pre-RED 특성화) ──┐
T2 (snippet+insertDiagram) ─┐
T3 (icons) ─────────────────┼→ T4 (DiagramInsertMenu) → T5 (toolbar) → T6 (AppLayout) → T9 (게이트)
T8 (CSS) ───────────────────┘        ↑ T8은 T4와 병행 가능
T7 (PreviewRenderer 플레이스홀더) — T2~T6와 독립, 병행 가능
```

우선순위: T1(기준선) → T2(핵심 순수 로직)·T7(프리뷰 분기) > T3/T4(UI) > T5(툴바)·T6(배선) > T8(스타일) > T9(게이트). T3(아이콘)·T7·T8은 상호 독립적으로 언제든 착수 가능.

## Risk Analysis & Mitigation

| # | 리스크 | 영향 | 완화 |
|---|--------|------|------|
| 1 | **PreviewRenderer 교차-SPEC 터치** — 이 파일은 SPEC-PREVIEW-001/010이 소유(테마 연동·`@MX:ANCHOR`). 플레이스홀더 분기 추가가 기존 렌더/폴백 경로를 침범할 위험 | 다이어그램 렌더/테마 연동 회귀 | 분기는 `forEach` 내부 **빈 본문일 때만** parse 이전에서 조기 반환. 기존 non-empty 경로(parse→render→catch)·`isDark` 재초기화(:110)·`securityLevel` 무변경. T1 특성화 + AC-007 전환 테스트로 회귀 방어 |
| 2 | **mermaid 핀/patch-package 교란** — 11.12.3 핀(SPEC-PREVIEW-006)·`securityLevel: 'strict'`(SPEC-PREVIEW-010) 불변식 | 보안/렌더 계약 파손 | 본 SPEC은 `mermaid.initialize`/`MERMAID_BASE_CONFIG`·버전 핀·patch를 **건드리지 않음**. 프리셋 스니펫은 11.12.3으로 사전 검증됨(고정). AC-004/게이트에서 핀 유지 확인 |
| 3 | `FormatAction` 문자열 전용 계약 — preset 전달 불가 | `onFormat` 시그니처 변경 시 기존 테스트/`handleFormat` 파급 | 별도 `onInsertDiagram(preset)` prop 채택(확정 결정 6, UI-007 선례). `handleFormat` switch(@MX:ANCHOR)·기존 테스트 무변경 |
| 4 | 접근성 스위트가 모든 버튼 `aria-label` 강제(EditorToolbar.test.tsx) | 8개 메뉴 항목·트리거 라벨 누락 시 실패 | 트리거 + 8개 항목 각각 개별 `aria-label` 부여, 접근성 테스트를 신규 항목 포함으로 확장(REQ-001/004) |
| 5 | view-only 모드 — 에디터 숨김 상태에서도 툴바 렌더 | null view에 삽입 시도 | `handleInsertDiagram`에서 `if (!view) return`(`handleInsertTable`:300–304 동형). 메뉴는 열려도 삽입은 no-op, 닫힘 정상(REQ-016, AC-009) |
| 6 | Esc/키보드 순회 상호작용 신규 도입 | 팝오버 조작 회귀 | Esc 닫힘은 `TableGridPicker` 선례 재사용. 방향키/Tab 순회는 **드롭다운 내부 로컬**(전역 단축키 아님) — `markdownKeyBindings` 무변경(REQ-012/022) |
| 7 | SPEC-UI-006 아이콘 규약(인라인 SVG, 런타임 의존성 금지) | 규약 위반 시 리스킨 불변식 파손 | 7종 아이콘을 `svgProps` 헬퍼로 인라인, `lucide-react`/floating-ui 미도입(REQ-019). `index.ts` 와일드카드 배럴로 자동 노출 |

## MX Tag Plan

`code_comments = ko`(`language.yaml`).

| 위치 | 태그 | 사유 |
|------|------|------|
| `keyboard-shortcuts.ts` `insertDiagram` | `@MX:NOTE` + `@MX:SPEC: SPEC-UI-008` | 스니펫 상수/블록 패딩/첫 편집 토큰 커서 배치 의도 기록 |
| `EditorToolbar.tsx` DiagramInsertMenu | `@MX:NOTE` + `@MX:SPEC: SPEC-UI-008` | 외부 mousedown + Esc + 키보드 순회 닫힘/선택 패턴 근거 |
| `AppLayout.tsx` `handleInsertDiagram` | `@MX:NOTE` | null 가드 no-op 패턴(`handleInsertTable` 동형). 기존 `handleFormat` `@MX:ANCHOR` **유지** |
| `PreviewRenderer.tsx` 플레이스홀더 분기 | `@MX:NOTE` + `@MX:SPEC: SPEC-UI-008` | 빈 본문(`trim()` 빈 문자열) → `mermaid.parse` 생략 분기. 기존 `@MX:ANCHOR`(:7) 유지 |

## Exclusions (Non-Goals)

spec.md "Exclusions (What NOT to Build)"와 동일 — 요약: 나머지 17종 mermaid 유형 프리셋 없음, AI 보조 생성 변경 없음, 스니펫 i18n 없음, 삽입 전용 단축키 없음, 인-메뉴 다이어그램 프리뷰 썸네일 없음, mermaid 버전 변경 없음, 테마 연동 변경 없음, 포털/floating-ui 미도입, Rust 백엔드(`src-tauri/`) 무변경.

## Quality Gates (TDD)

- RED-GREEN-REFACTOR 준수, 테스트 선행 필수(`test_first_required: true`). 브라운필드 영역은 Pre-RED 특성화 선행.
- `npm run typecheck`(`tsc --noEmit`) 클린 · `npm test`(vitest) 전체 무변경 통과 · `npm run lint`(eslint) 통과 · 기존 Playwright 무변경 통과(신규 E2E 없음).
- 커밋당 커버리지 80%+, 전체 목표 85%.
- LSP run 게이트: errors 0 / type errors 0 / lint errors 0.
- 보안 불변식: mermaid `securityLevel: 'strict'`·`startOnLoad: false`·버전 핀 11.12.3 유지.

## Related Documents

- `spec.md` — EARS 요구사항(REQ-UI-008-001~022) + Preset Snippet Definitions + Delta
- `acceptance.md` — Given-When-Then 시나리오(AC-UI-008-001~013) + Quality Gate Criteria + Definition of Done
- `tasks.md` — Task 분해(T-001~T-011) + REQ/AC 매핑
- 선례: `.moai/specs/SPEC-UI-007-table-insert/{plan,tasks}.md`
</content>
</invoke>
