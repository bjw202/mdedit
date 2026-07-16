---
id: SPEC-UI-007
version: "0.0.2"
status: draft
created: "2026-07-16"
updated: "2026-07-16"
author: "jw"
priority: medium
issue_number: 0
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.1 | 2026-07-16 | jw | 최초 acceptance 작성 — Given-When-Then 시나리오 10건 + 품질 게이트. Human gate 확정 결정 반영: r = 헤더 포함 총 행 수, 라벨 행 우선 "r × c", 공백 패딩 빈 셀, view-only no-op, 컴포넌트 테스트만(신규 E2E 없음). |
| 0.0.2 | 2026-07-16 | jw | plan-audit 리뷰(SPEC-UI-007-review-1) 반영: D5 위즐 워드("정상적으로") 제거, DoD의 REQ 범위를 001~014로 정정(REQ-UI-007-015는 spec.md Design Notes로 이동·삭제됨). AC ID 1:1 매핑은 spec.md 측 표 수정(D1)으로 복원 — acceptance.md AC 내용 무변경. |

# Acceptance Criteria — SPEC-UI-007 (Insert Table)

검증 방식: **컴포넌트 테스트 전용** — vitest + @testing-library/react(팝오버/툴바) + jsdom `EditorView` 직접 구성(`insertTable` 단위 테스트, `src/test/image-widget.test.ts` 선례). 신규 Playwright E2E는 작성하지 않으며, 기존 E2E 스위트는 무변경 통과해야 한다.

## Given-When-Then Scenarios

### AC-UI-007-001: 팝오버 열림 (REQ-UI-007-003, 004)

- **Given** 에디터 툴바가 렌더되어 있고 팝오버가 닫힌 상태(`aria-expanded="false"`)일 때
- **When** 사용자가 Insert Table 버튼(Quote와 Image 사이)을 클릭하면
- **Then** 팝오버가 열리고 트리거의 `aria-expanded="true"`가 되며, 8열 × 8행 = 64개의 그리드 셀 버튼이 표시된다.

### AC-UI-007-002: 그리드 하이라이트 + 행 우선 크기 라벨 (REQ-UI-007-005)

- **Given** 그리드 피커 팝오버가 열려 있을 때
- **When** 사용자가 4번째 행, 3번째 열의 셀을 호버하면
- **Then** 좌상단 기준 4×3 = 12개 셀에 하이라이트 클래스(`--md-accent-soft` 채움 + `--md-accent` 강조)가 적용되고, 그리드 아래에 크기 라벨 **"4 × 3"**(행 × 열, 행 우선 행렬 표기)이 `--md-text-muted`로 표시된다.

### AC-UI-007-003: 빈 줄 삽입 + Header 1 선택 + 포커스 복귀 (REQ-UI-007-006, 007)

- **Given** 커서가 빈 줄에 위치한 EditorView가 있을 때
- **When** 그리드 셀 (3행, 4열)을 클릭하면
- **Then** 커서 위치에 다음 스켈레톤이 삽입된다 (r=3 = 헤더 포함 총 3행 → 본문 2행):

  ```markdown
  | Header 1 | Header 2 | Header 3 | Header 4 |
  | --- | --- | --- | --- |
  |     |     |     |     |
  |     |     |     |     |
  ```

  (빈 본문 셀은 공백 패딩 `|     |` 스타일 — markdown-it GFM 정상 렌더)
- **And** 에디터 selection이 첫 헤더 셀의 `Header 1` 텍스트 범위와 정확히 일치하고(즉시 타이핑 시 교체됨), `view.focus()`로 에디터가 포커스를 가지며, 팝오버는 닫힌다.

### AC-UI-007-004: 줄 중간 삽입 — 블록 패딩 (REQ-UI-007-009) [edge]

- **Given** 커서가 텍스트가 있는 줄의 중간(커서 앞뒤 모두 텍스트 존재)에 위치할 때
- **When** 그리드 셀을 클릭해 테이블을 삽입하면
- **Then** 테이블 앞뒤에 빈 줄이 삽입되어 테이블이 독립된 markdown 블록이 된다.
- **And** 커서가 줄 시작(앞 텍스트 없음) 또는 줄 끝(뒤 텍스트 없음)에 있으면 필요한 쪽에만 패딩된다.

### AC-UI-007-005: 경계값 1×1 / 8×8 (REQ-UI-007-006) [edge]

- **Given** 그리드 피커 팝오버가 열려 있을 때
- **When** 최소 셀 (1행, 1열)을 클릭하면
- **Then** 헤더 1열 + 구분 행만 삽입된다 (r=1 = 헤더 포함 총 1행 → **본문 0행**):

  ```markdown
  | Header 1 |
  | --- |
  ```

- **When** 최대 셀 (8행, 8열)을 클릭하면
- **Then** `Header 1..Header 8` 헤더 행 + 구분 행 + 공백 패딩 빈 본문 **7행**(총 8행 × 8열)이 삽입된다.

### AC-UI-007-006: view-only 모드 no-op (REQ-UI-007-010, 014) [edge]

- **Given** view-only 모드로 EditorView가 null(`viewRef.current === null`)이고 툴바는 렌더된 상태일 때
- **When** 팝오버를 열고 그리드 셀을 클릭하면
- **Then** 문서 변경이 발생하지 않고, 예외/에러가 발생하지 않으며, 팝오버는 닫힌다 (기존 `handleFormat` null 가드 패턴과 동일한 no-op).

### AC-UI-007-007: 외부 클릭 / Escape 닫힘 (REQ-UI-007-008) [edge]

- **Given** 그리드 피커 팝오버가 열려 있을 때
- **When** 팝오버와 트리거 버튼 외부 요소에 mousedown이 발생하면
- **Then** 팝오버가 닫히고 `aria-expanded="false"`가 된다.
- **When** (다시 연 상태에서) Escape 키가 눌리면
- **Then** 팝오버가 닫힌다. 팝오버 내부 클릭(셀 호버 영역 등 비-셀 영역)은 팝오버를 닫지 않는다.

### AC-UI-007-008: 접근성 — 모든 버튼 aria-label (REQ-UI-007-001)

- **Given** 팝오버가 열린 툴바가 렌더되어 있을 때
- **When** 접근성 스위트(기존 `EditorToolbar.test.tsx:175–183` 패턴 확장)가 모든 `role="button"` 요소를 검사하면
- **Then** Insert Table 트리거와 64개 그리드 셀 버튼 전부가 비어 있지 않은 `aria-label`을 갖는다 (셀 예: `"Insert 4 by 3 table"` = 4행 × 3열).

### AC-UI-007-009: 기존 계약 회귀 방어 (REQ-UI-007-011, 012, 013)

- **Given** 본 SPEC의 전체 변경이 적용된 상태에서
- **When** 기존 테스트 스위트와 diff 리뷰를 수행하면
- **Then** 기존 `onFormat` 콜백 테스트가 **무변경** 통과하고, `FormatAction` 유니언·`handleFormat` switch(@MX:ANCHOR)가 변경되지 않았으며, `package.json` 의존성이 무변경이고(신규 런타임 의존성 0), `markdownKeyBindings`에 신규 바인딩이 없다.

### AC-UI-007-010: 다크모드 토큰 (REQ-UI-007-002)

- **Given** 그리드 피커 관련 신규 CSS가 적용된 상태에서
- **When** CSS를 검사하면
- **Then** 모든 신규 클래스가 `--md-*` 토큰만 참조하고 raw hex 색상이 없다 (다크모드는 `[data-theme="dark"]` 토큰 전환으로 자동).

## Quality Gate Criteria

| 게이트 | 기준 |
|--------|------|
| 타입 체크 | `tsc --noEmit` 클린 (에러 0) |
| 단위/컴포넌트 테스트 | 전체 vitest 스위트 통과 — 신규(`insertTable.test.ts`, `TableGridPicker.test.tsx`) + 확장(`EditorToolbar.test.tsx` 접근성 스위트 포함) + 기존 전체 무변경 통과 |
| E2E | 기존 Playwright 스위트 무변경 통과. **신규 E2E 작성 없음**(확정 결정 5) |
| 커버리지 | 신규 코드 커밋당 80% 이상 (`tdd_settings.min_coverage_per_commit`), 전체 목표 85% |
| Lint | `npm run lint`는 **게이트 제외** — eslint config 부재로 main 포함 항상 실패하는 알려진 프로젝트 제약. 회귀로 오판 금지 |
| 의존성 | `package.json` dependencies/devDependencies 무변경 |

## Definition of Done

- [ ] AC-UI-007-001 ~ 010 전 시나리오에 대응하는 테스트가 존재하고 통과
- [ ] REQ-UI-007-001 ~ 014 전 요구사항이 테스트 또는 diff 리뷰로 검증됨
- [ ] `tsc --noEmit` 클린, 전체 vitest 통과, 기존 Playwright 무변경 통과
- [ ] @MX 태그 적용 (plan.md MX Tag Plan 참조: `insertTable` @MX:NOTE, `handleFormat` @MX:ANCHOR 유지)
- [ ] 신규 런타임 의존성 0 확인
