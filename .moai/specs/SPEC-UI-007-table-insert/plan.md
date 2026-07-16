---
id: SPEC-UI-007
version: "0.0.1"
status: completed
created: "2026-07-16"
updated: "2026-07-16"
author: "jw"
priority: medium
issue_number: 0
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.1 | 2026-07-16 | jw | 최초 plan 초안 — 에디터 툴바 "Insert Table" 버튼 + 그리드 피커 팝오버. research.md(Phase 0.5) 분석 결과 반영. 사용자 확정 설계(TableIcon 인라인, Quote–Image 사이 배치, `.md-menu` 팝오버, 8x8 그리드, `Header 1` 선택 + `view.focus()`, 외부 클릭 + Esc 닫힘) 기준. spec.md/acceptance.md는 승인 게이트 이후 작성 예정. |
| 0.0.1 | 2026-07-16 | jw | Human gate 승인 — 확정 결정 5건 반영: (1) 그리드 (r, c) = 총 r행(헤더 포함, 본문 r−1행) × c열, (2) 크기 라벨 = 행 우선 "r × c", (3) 빈 본문 셀 = 공백 패딩 `\|     \|`, (4) view-only = no-op, (5) 컴포넌트 테스트만(신규 E2E 없음). Open Questions 전량 해소·삭제. spec.md/acceptance.md/spec-compact.md 작성 완료. |

## Overview

에디터 툴바에 **Insert Table** 버튼을 추가한다. 클릭 시 8×8 그리드 피커 팝오버가 열리고, 셀 (r행, c열)을 호버하면 좌상단부터 r×c 범위가 하이라이트되며 **행 우선** 표기 "r × c"(예: "4 × 3" = 4행 × 3열) 크기 라벨이 표시된다. 셀 클릭 시 커서 위치에 markdown 테이블 스켈레톤 — 헤더 행 `Header 1..c` + `| --- |` 구분 행 + **(r−1)개**의 공백 패딩 빈 본문 행(`|     |`) — 이 블록 단위로 삽입되고(r = 헤더 포함 총 행 수), 첫 헤더 셀의 `Header 1` 텍스트가 선택된 상태로 에디터에 포커스가 복귀한다.

- 개발 방법론: **TDD** (`quality.yaml` `development_mode: tdd`, RED-GREEN-REFACTOR, 브라운필드 Pre-RED 포함)
- 브랜치: `feature/SPEC-UI-007-table-insert` (`/moai run` 단계에서 생성)
- 신규 런타임 의존성: **없음** (SPEC-UI-006 아이콘 규약 준수 — Lucide SVG 로컬 인라인)

## Confirmed Design Decisions (사용자 승인 + Human gate 확정, 재검토 금지)

1. `TableIcon`: Lucide `table` 글리프 인라인, stroke 1.5, `currentColor`, SPEC-UI-006 규약 (`lucide-react` 미도입).
2. 버튼 위치: Quote와 Image 사이.
3. 팝오버: `.md-menu` 디자인 언어 재사용 (`--md-surface-raised`/`--md-border`/`--md-shadow-md`), relative 래퍼 + `absolute top-full z-50`, 포털 없음. 다크모드는 토큰으로 자동.
4. 그리드: 최대 8열 × 8행. 호버 시 `--md-accent-soft` 채움 + `--md-accent` 강조로 r×c 범위 하이라이트.
5. **[GATE] 그리드 시맨틱**: 셀 (r행, c열) 선택 = **헤더 포함 총 r행**(헤더 1행 + 본문 r−1행) × c열. r=1이면 헤더 행만(본문 0행).
6. **[GATE] 크기 라벨**: **행 우선** 행렬 표기 `"r × c"` (예: 4번째 행, 3번째 열 호버 → "4 × 3" = 4행 × 3열). `--md-text-muted`.
7. **[GATE] 빈 본문 셀**: 공백 패딩 `|     |` 스타일 (markdown-it GFM 정상 렌더 확인).
8. 삽입: 커서 위치에 테이블 스켈레톤. 커서가 줄 중간이면 앞뒤 빈 줄 삽입으로 블록화.
9. 삽입 후: 첫 헤더 셀 `Header 1` 선택 + `view.focus()`.
10. 닫힘: 외부 mousedown(Header.tsx export-menu 패턴) **및** Escape 키.
11. **[GATE] view-only 모드**: no-op (기존 포맷 버튼과 동일한 null 가드 패턴, 팝오버는 정상 닫힘). disabled 처리 안 함.
12. 콜백 계약: `FormatAction` 문자열 계약을 넓히지 않고 별도 `onInsertTable(rows, cols)` prop 신설 (research.md 리스크 1 권고 채택).
13. **[GATE] 테스트 범위**: 컴포넌트 테스트만 (vitest + testing-library + jsdom EditorView 단위 테스트). **신규 Playwright E2E 없음**. 기존 E2E는 무변경 통과 대상.

## Task Decomposition

TDD 순서에 맞춰 각 유닛은 "테스트 먼저(RED) → 최소 구현(GREEN) → 정리(REFACTOR)"로 진행한다.

### T1. [MODIFY] TableIcon 추가 — `src/components/icons/icons.tsx`, `src/components/icons/index.ts`

- Lucide `table` 글리프를 기존 `svgProps(props)` 헬퍼 패턴으로 인라인 (viewBox 24, stroke 1.5, `currentColor`, `aria-hidden`).
- 파일 내 알파벳 순서 유지, `index.ts` 배럴 export 추가.
- Reference: research.md → `src/components/icons/icons.tsx`:8–24 (svgProps 헬퍼), :74 (Columns2Icon 인접 삽입 지점)
- 테스트: 기존 아이콘은 개별 단위 테스트가 없으므로 T4 툴바 렌더 테스트에서 간접 검증.

### T2. [MODIFY] `insertTable(view, rows, cols)` 헬퍼 — `src/components/editor/extensions/keyboard-shortcuts.ts`

- 시그니처: `insertTable(view: EditorView, rows: number, cols: number): boolean` — `wrapSelection`/`prefixLine`과 나란히 배치. `rows` = **헤더 포함 총 행 수** (확정 결정 5).
- 스켈레톤 생성: 헤더 행(`| Header 1 | ... | Header N |`) 1행, 구분 행(`| --- | ... |`) 1행, **(rows − 1)개**의 공백 패딩 빈 본문 행(`|     |` 스타일, 확정 결정 7). rows=1이면 본문 0행(헤더+구분 행만).
- 블록화: `state.doc.lineAt(range.from)`으로 줄 경계 판정. `range.from > line.from`(커서 앞 텍스트)이면 선행 `\n` 추가, `range.to < line.to`(커서 뒤 텍스트)이면 후행 `\n` 추가.
- 삽입 후 선택: 스켈레톤 내 첫 `Header 1` 오프셋을 계산해 `EditorSelection.range(start, end)`로 dispatch (`{ changes, selection }`).
- Reference: research.md → keyboard-shortcuts.ts:16–52 (wrapSelection changeByRange 패턴), :59–90 (prefixLine lineAt 패턴), imageHandler.ts:16–27 (단순 insert 대비점)
- 테스트 (RED first, 신규 파일 예: `src/test/insertTable.test.ts`): jsdom `EditorView`/`EditorState` 직접 구성 (`src/test/image-widget.test.ts`, `mediaExtensions.test.ts` 선례).
  - 빈 줄에서 삽입 → 스켈레톤 정확 일치, 빈 줄 패딩 없음(또는 최소 패딩)
  - 줄 중간 삽입 → 앞뒤 `\n` 패딩 확인
  - 줄 끝/줄 시작 삽입 → 한쪽만 패딩
  - 1×1 경계값 → 헤더 1열 + 구분 행만, **본문 0행**; 8×8 → 헤더 8열 + 본문 7행
  - 빈 본문 셀이 공백 패딩 `|     |` 형태인지 확인
  - 삽입 후 selection이 첫 `Header 1` 범위와 일치

### T3. [NEW] GridPicker 팝오버 컴포넌트 — `src/components/editor/EditorToolbar.tsx` 내부 (또는 동일 디렉토리 분리)

- 상태: `open`(useState), `hovered {rows, cols}`(useState), 래퍼 `ref`(useRef).
- 8×8 = 64개 셀을 `<button type="button">`으로 렌더, **각 셀에 `aria-label`** (예: `"Insert 3 by 4 table"` — 리스크 2 대응).
- 호버 셀 (r, c) 기준 `row <= r && col <= c` 셀에 하이라이트 클래스 부여. 크기 라벨 **`"{r} × {c}"`** — 행 우선 행렬 표기, 확정 결정 6 (`--md-text-muted`).
- 셀 클릭 → `onInsertTable(rows, cols)` 호출 후 팝오버 닫기.
- 트리거 버튼: `aria-haspopup="true"`, `aria-expanded={open}`, 기존 `md-tool-btn` 클래스 + `aria-label`/`title`.
- 닫힘: (a) document `mousedown` 리스너 — 래퍼 밖 클릭 시 닫기 (Header.tsx:65–75 패턴), (b) `keydown` Escape — 신규 패턴(선례 없음, 명시적 범위 내).
- Reference: research.md → Header.tsx:54–75, 127–163 (팝오버 셸 + 외부 클릭), EditorToolbar.tsx:47–59 (ToolbarButton), :63–75 (TOOLBAR_BUTTONS)
- 테스트 (RED first, 신규 예: `src/test/TableGridPicker.test.tsx`, `ExportHeader.test.tsx` 선례):
  - 버튼 클릭 → 팝오버 열림 (`aria-expanded` 토글)
  - 셀 클릭 → `onInsertTable(rows, cols)` 정확한 인자 호출 + 팝오버 닫힘
  - 외부 mousedown → 닫힘 / Escape → 닫힘
  - 크기 라벨 텍스트 표시

### T4. [MODIFY] 툴바 통합 — `src/components/editor/EditorToolbar.tsx`

- `EditorToolbarProps`에 `onInsertTable?: (rows: number, cols: number) => void` 추가 (`onFormat` 계약 무변경 — 리스크 1 대응).
- Quote와 Image 사이에 테이블 버튼+팝오버 렌더. `TOOLBAR_BUTTONS` 배열은 단순 액션 전용으로 유지하고, 배열을 Quote까지/Image부터 두 구간으로 렌더하거나 인덱스 분기.
- Reference: research.md → EditorToolbar.tsx:63–75 (버튼 배열), :85–88 (toolbar 컨테이너/key)
- 테스트: `src/test/EditorToolbar.test.tsx` 확장 —
  - Insert Table 버튼 렌더 + `aria-label` 존재
  - 접근성 스위트(:175–183 "모든 버튼 aria-label") 그리드 셀 포함 통과
  - 기존 `onFormat` 콜백 테스트 무변경 통과 (회귀 방어)

### T5. [MODIFY] AppLayout 배선 — `src/components/layout/AppLayout.tsx`

- `handleInsertTable(rows, cols)` 핸들러 신설: `viewRef.current` null 가드(`handleFormat`:195 패턴, isViewOnly 시 no-op — 리스크 4 대응) → `insertTable(view, rows, cols)` → `view.focus()`.
- `keyboard-shortcuts`에서 `insertTable` import 추가 (line 20 기존 import 확장).
- `<EditorToolbar onInsertTable={handleInsertTable} />` (line 264) 배선.
- Reference: research.md → AppLayout.tsx:187–190 (handleViewReady), :192–249 (handleFormat + @MX:ANCHOR), :256–264 (isViewOnly + EditorToolbar)
- 테스트: T2 단위 테스트가 삽입 로직을 커버하므로 배선은 T3/T4 컴포넌트 테스트 + 수동/E2E로 검증. `handleFormat` switch는 무변경(회귀 없음).

### T6. [MODIFY] CSS — `src/styles/mdedit-components.css`

- 신규 클래스(예): `.md-table-picker`(팝오버 컨테이너 — `.md-menu` 토큰 재사용), `.md-table-picker-grid`, `.md-table-picker-cell`(+`.is-armed` 하이라이트: `--md-accent-soft` 배경 + `--md-accent` 테두리), `.md-table-picker-label`(`--md-text-muted`).
- HARD 규칙: raw hex 금지, `--md-*` 토큰만 사용 (mdedit-tokens.css:7–8). 다크모드는 토큰으로 자동.
- Reference: research.md → mdedit-components.css:97–103 (.md-menu), :221–230 (.md-tool-btn 상태), mdedit-tokens.css (accent/soft/muted 토큰)

### T7. 테스트 마무리 및 품질 게이트

- 전체 vitest 스위트 + `tsc --noEmit` 클린 (참고: `npm run lint`는 config 부재로 main 포함 항상 실패 — 게이트에서 제외, 회귀로 오판 금지).
- 기존 Playwright E2E 무변경 통과. **신규 E2E 작성 없음** (확정 결정 13 — 컴포넌트 테스트만).
- 커버리지: 신규 코드 커밋당 80% 이상 (tdd_settings.min_coverage_per_commit).

### 실행 순서 및 의존성

```
T1 (icon) ──┐
T2 (helper) ─┼→ T3 (GridPicker) → T4 (toolbar) → T5 (AppLayout) → T7 (게이트)
T6 (CSS) ───┘                        ↑ T6는 T3와 병행 가능
```

우선순위: T2(핵심 로직, 순수 함수) > T3/T4(UI) > T5(배선) > T6(스타일) > T1(아이콘, 독립적으로 언제든).

## Risk Analysis & Mitigation (research.md 리스크 1–7)

| # | 리스크 | 영향 | 완화 |
|---|--------|------|------|
| 1 | `FormatAction` 문자열 전용 계약 — rows/cols 전달 불가 | onFormat 시그니처 변경 시 기존 테스트/핸들러 파급 | **별도 `onInsertTable(rows, cols)` prop 채택(확정)**. `handleFormat` switch와 기존 테스트 무변경 |
| 2 | 접근성 스위트가 모든 버튼의 `aria-label`을 강제 (EditorToolbar.test.tsx:175–183) | 그리드 셀 64개 버튼이 라벨 누락 시 테스트 실패 | 모든 그리드 셀 버튼에 개별 `aria-label`(예: "Insert 3 by 4 table") 부여, 접근성 테스트를 셀 포함으로 확장 |
| 3 | z-index/클리핑 — 팝오버가 인접 pane에 가려질 가능성 | 팝오버 일부 미표시 | Export 메뉴와 동일한 `z-50` 관례. 툴바는 `overflow-hidden` 에디터 래퍼(AppLayout:265)의 **형제**라 하향 오버랩 안전. Run phase에서 조상 클리핑 육안/E2E 확인 |
| 4 | view-only 모드 — 에디터 숨김 상태에서도 툴바 렌더 | null view에 삽입 시도 | `handleInsertTable`에서 `if (!view) return` 가드(기존 `handleFormat` 패턴 동일). 팝오버는 열려도 삽입은 no-op, 닫힘은 정상 동작 |
| 5 | 키보드 단축키 충돌 | 기존 바인딩 파손 | **v1은 단축키 미도입**(Exclusions). `markdownKeyBindings` 무변경 |
| 6 | Esc 닫힘 선례 부재 (Export 메뉴는 외부 클릭만) | 신규 패턴 도입 리스크 | Esc는 **명시적 범위 내**(확정 설계). 팝오버 open 시에만 keydown 리스너 등록, 언마운트/닫힘 시 해제. 화살표 키 그리드 탐색은 범위 밖 |
| 7 | SPEC-UI-006 아이콘 규약 (인라인 SVG, 런타임 의존성 금지) | 규약 위반 시 리스킨 불변식 파손 | `TableIcon`을 `svgProps` 헬퍼 패턴으로 인라인, `lucide-react` 미도입, 알파벳 순서 유지 |

추가 리스크: 툴바가 좁을 때 팝오버 좌측 정렬(`left-0`)이 창 우측 경계를 넘을 가능성 → 그리드 폭이 작아(약 8×20px 내외) 실질 위험 낮음. Run phase에서 확인, 필요 시 `right-0` 분기.

## MX Tag Plan

code_comments = ko (`language.yaml`).

| 위치 | 태그 | 사유 |
|------|------|------|
| `keyboard-shortcuts.ts` `insertTable` | `@MX:NOTE` | 스켈레톤 생성 규칙(헤더 플레이스홀더/블록 패딩/삽입 후 `Header 1` 선택) 의도 기록. `@MX:SPEC: SPEC-UI-007` |
| `AppLayout.tsx` `handleFormat` | 기존 `@MX:ANCHOR` **유지** | switch 무변경. `handleInsertTable`은 별도 함수로 신설하므로 앵커 계약 불침범. 필요 시 `handleInsertTable`에 `@MX:NOTE` |
| `EditorToolbar.tsx` GridPicker | `@MX:NOTE` | 외부 mousedown + Esc 이중 닫힘 패턴(Header.tsx 선례 + 신규 Esc) 근거. `@MX:SPEC: SPEC-UI-007` |

## Exclusions (Non-Goals)

- **키보드 단축키 없음** — Mod-Shift-t 등 신규 바인딩 미도입 (v1).
- **화살표 키 그리드 탐색 없음** — 팝오버 조작은 마우스 + Esc 닫기만 (v1).
- **기존 테이블 편집/포맷팅 없음** — 이미 존재하는 markdown 테이블의 정렬/열 추가/재포맷 기능 미포함.
- **정렬 옵션 없음** — `:---:` 등 컬럼 정렬 지정 UI 미제공, 구분 행은 `---` 고정.
- **WYSIWYG 테이블 에디터 없음** — 순수 markdown 텍스트 삽입만.
- **8×8 초과 그리드 없음** — 확장 입력(직접 숫자 입력 등) 미제공.
- **포털/floating-ui 미도입** — 순수 CSS 포지셔닝, 신규 런타임 의존성 없음.
- **Rust 백엔드 무변경** — `src-tauri/` 미접촉.

## Quality Gates (TDD)

- RED-GREEN-REFACTOR 준수, 테스트 선행 필수 (`test_first_required: true`).
- 커밋당 커버리지 80%+, 전체 목표 85%.
- `tsc --noEmit` 클린, 기존 vitest/Playwright 전체 무변경 통과.
- LSP run 게이트: errors 0 / type errors 0 / lint errors 0.

## Related Documents

- `spec.md` — EARS 요구사항 (REQ-UI-007-001 ~ 014; 우측 정렬 폴백은 Design Notes로 이동, plan-audit review-1 D2 반영)
- `acceptance.md` — Given-When-Then 시나리오 (AC-UI-007-001 ~ 010) + 품질 게이트
- `spec-compact.md` — Run phase용 압축본
- `research.md` — Phase 0.5 탐색 결과 (file:line 근거)

> 이전 초안의 Open Questions 4건은 Human gate에서 전량 해소되어 Confirmed Design Decisions 5–7, 11, 13에 반영됨.
