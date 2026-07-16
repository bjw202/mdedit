---
id: SPEC-UI-007
version: "0.0.2"
status: draft
created: "2026-07-16"
updated: "2026-07-16"
author: "jw"
priority: medium
issue_number: 0
generated_from: spec.md
---

# SPEC-UI-007 Compact — Insert Table (그리드 피커 팝오버)

> Run phase용 자동 생성 압축본. 원본: spec.md / acceptance.md / plan.md.

## Requirements (EARS)

### Ubiquitous

- **REQ-UI-007-001**: The system shall 항상 그리드 셀 버튼 64개 전부에 개별 `aria-label`(예: `"Insert 3 by 4 table"` = 3행 × 4열)을 제공한다.
- **REQ-UI-007-002**: The system shall 항상 신규 스타일을 `--md-*` 토큰만으로 렌더한다(raw hex 금지, 다크모드 자동).
- **REQ-UI-007-003**: The system shall 항상 트리거 버튼에 `aria-label`, `title`, `aria-haspopup="true"`, `aria-expanded`를 유지한다.

### Event-Driven

- **REQ-UI-007-004**: WHEN Insert Table 버튼 클릭, the system shall 버튼 아래(`top-full`, `z-50`)에 8×8 그리드 피커 팝오버를 연다.
- **REQ-UI-007-005**: WHEN 셀 (r행, c열) 호버, the system shall r×c 범위를 `--md-accent-soft` + `--md-accent`로 하이라이트하고 **행 우선** 크기 라벨 `"r × c"`를 `--md-text-muted`로 표시한다.
- **REQ-UI-007-006**: WHEN 셀 (r, c) 클릭, the system shall 커서 위치에 스켈레톤을 삽입하고 팝오버를 닫는다. 스켈레톤 = `Header 1..c` 헤더 행 1 + `| --- |` 구분 행 1 + **(r−1)개** 공백 패딩 빈 본문 행(`|     |`). **r = 헤더 포함 총 행 수** (r=1 → 본문 0행).
- **REQ-UI-007-007**: WHEN 삽입 완료, the system shall 첫 헤더 셀 `Header 1` 플레이스홀더를 선택 상태로 만들고 에디터에 포커스를 복귀시킨다(즉시 타이핑 시 교체).
- **REQ-UI-007-008**: WHEN 팝오버 열림 중 외부 mousedown 또는 Escape, the system shall 팝오버를 닫는다.

### State-Driven

- **REQ-UI-007-009**: WHILE 커서가 줄 중간(앞/뒤 텍스트 존재), 삽입 시 the system shall 필요한 쪽에 빈 줄을 삽입해 독립 블록화한다.
- **REQ-UI-007-010**: WHILE view-only(EditorView null), the system shall 셀 클릭을 no-op 처리하고 팝오버를 닫는다.

### Unwanted

- **REQ-UI-007-011**: The system shall not `FormatAction` 유니언·`onFormat` 시그니처·`handleFormat` switch(@MX:ANCHOR)를 변경한다. 별도 `onInsertTable(rows, cols)` prop 사용.
- **REQ-UI-007-012**: The system shall not 신규 런타임 의존성을 추가한다(`lucide-react`, floating-ui, 포털 라이브러리 금지).
- **REQ-UI-007-013**: The system shall not 신규 키보드 단축키 바인딩을 등록한다(`markdownKeyBindings` 무변경).
- **REQ-UI-007-014**: IF EditorView null 상태에서 삽입 요청, then the system shall dispatch 없이 조용히 반환한다(예외 없음).

> 요구사항은 REQ-UI-007-001~014. 우측 정렬(`right-0`) 폴백은 요구사항이 아닌 Design Note(spec.md "Design Notes / Future Considerations" 참조).

## Acceptance Criteria

| AC ID | REQ | Summary |
|-------|-----|---------|
| AC-UI-007-001 | 003, 004 | 버튼 클릭 → 팝오버 열림(`aria-expanded` 토글) + 64셀 표시 |
| AC-UI-007-002 | 005 | (4행, 3열) 호버 → 12셀 하이라이트 + "4 × 3" 라벨(행 우선) |
| AC-UI-007-003 | 006, 007 | 빈 줄 (3, 4) 클릭 → 헤더 4열 + 구분 행 + 빈 본문 2행, `Header 1` 선택, 포커스 복귀, 팝오버 닫힘 |
| AC-UI-007-004 | 009 | 줄 중간 삽입 → 앞뒤 빈 줄 패딩(줄 시작/끝은 한쪽만) |
| AC-UI-007-005 | 006 | (1,1) → 헤더 1열 + 구분 행만(본문 0행); (8,8) → 헤더 8열 + 본문 7행 |
| AC-UI-007-006 | 010, 014 | view-only 셀 클릭 → 문서 무변경, 예외 없음, 팝오버 닫힘 |
| AC-UI-007-007 | 008 | 외부 mousedown 닫힘; Escape 닫힘; 팝오버 내부 클릭은 유지 |
| AC-UI-007-008 | 001 | 트리거 + 64셀 전부 `aria-label` 보유(접근성 스위트 통과) |
| AC-UI-007-009 | 011, 012, 013 | 기존 `onFormat` 테스트 무변경 통과, `package.json` 무변경, 키맵 무변경 |
| AC-UI-007-010 | 002 | 신규 CSS는 `--md-*` 토큰만, raw hex 없음 |

품질 게이트: `tsc --noEmit` 클린 + 전체 vitest 통과(접근성 스위트 포함) + 기존 Playwright 무변경 통과. **신규 E2E 없음**(컴포넌트 테스트만). 커밋당 커버리지 80%+. `npm run lint`는 config 부재로 게이트 제외(알려진 프로젝트 제약).

## Files to Modify

| Delta | 파일 |
|-------|------|
| [MODIFY] | `src/components/icons/icons.tsx` — `TableIcon` 인라인 추가 |
| [MODIFY] | `src/components/icons/index.ts` — 배럴 export |
| [MODIFY] | `src/components/editor/extensions/keyboard-shortcuts.ts` — `insertTable(view, rows, cols): boolean` (@MX:NOTE) |
| [MODIFY] | `src/components/editor/EditorToolbar.tsx` — `onInsertTable` prop + 버튼/그리드 피커(Quote–Image 사이) |
| [MODIFY] | `src/components/layout/AppLayout.tsx` — `handleInsertTable`(null 가드 + `view.focus()`) 배선 |
| [MODIFY] | `src/styles/mdedit-components.css` — `.md-table-picker*` 클래스(토큰만) |
| [MODIFY] | `src/test/EditorToolbar.test.tsx` — 버튼 렌더/접근성 확장 |
| [NEW] | `src/test/insertTable.test.ts` — jsdom EditorView 단위 테스트 |
| [NEW] | `src/test/TableGridPicker.test.tsx` — 팝오버 컴포넌트 테스트 |

## Exclusions

- 키보드 단축키 없음 (v1)
- 화살표 키 그리드 탐색 없음 — 마우스 + Esc만 (v1)
- 기존 테이블 편집/포맷팅 없음
- 컬럼 정렬 옵션 없음 — 구분 행 `---` 고정
- WYSIWYG 테이블 에디터 없음
- 8×8 초과 그리드/직접 숫자 입력 없음
- 포털/floating-ui 미도입 — 신규 런타임 의존성 0
- 신규 Playwright E2E 없음 — 컴포넌트 테스트만
- Rust 백엔드(`src-tauri/`) 무변경
