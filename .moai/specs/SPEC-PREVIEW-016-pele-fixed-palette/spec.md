---
id: SPEC-PREVIEW-016
title: "다이어그램 고정 팔레트(Ink & Honey) — pele 토큰 테마 독립화"
version: "0.1.1"
status: in-progress
created: 2026-10-28
updated: 2026-10-28
author: jw (bjw202)
priority: High
phase: "v0.18.0 target"
module: src/styles
lifecycle: spec-anchored
tags: "pele, palette, diagram, theme, export"
tier: M
depends_on: [SPEC-PREVIEW-015]
---

# SPEC-PREVIEW-016: 다이어그램 고정 팔레트(Ink & Honey) — pele 토큰 테마 독립화

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-10-28 | jw | 최초 작성. Phase 8 기획 제안을 DP1 게이트에서 사용자가 Proceed로 승인(2026-10-28), Tier M 확정. 디자인 확정(2026-10-28): 다이어그램 팔레트를 잉크 앤 허니(Ink & Honey)로 고정해 앱 테마에서 독립시킨다. 기각된 Option B 액센트 `#C08A28`는 저장소 잔여 0을 요구한다(AC-PREVIEW016-009). 출시 목표는 v0.18.0이며, 라이트 테마는 카드를 두지 않기로 함(다크 전용 종이 카드). SPEC-PREVIEW-015의 이중 블록 체이닝(REQ-PREVIEW015-008 1번 불릿)과 테마 추종 절(REQ-PREVIEW015-008 2·3번 불릿, AC-011 e2e 절, AC-015 문구, AC-020 기대값 표)을 폐기하고 대체한다. 코드 앵커는 전부 origin/main 39c39e9(v0.17.0, pele 1.10.0) 기준으로 검증했다 — 로컬 작업 트리는 v0.16.1(pre-pele)이므로 run 단계는 반드시 origin/main 기반 브랜치에서 실행한다. REQ 9건·AC 9건. |
| 0.1.1 | 2026-10-28 | jw | plan-audit 1차 리뷰(`.moai/reports/plan-audit/SPEC-PREVIEW-016-review-1.md`) 결함 반영. D1: e2e 2종(`e2e/diagram-preview-behavior.spec.ts` 159-165, `e2e/diagram-export-colors.spec.ts` 36-37·85-94·119-127)을 plan M3 테스트 정렬 범위에 추가 — REQ·AC 식별자 변경 없음. D2: REQ-PREVIEW015-013 "현재 앱 테마를 따른다" 절 폐기 행을 개정 표에 추가(015 spec.md 125행 실측). D3: 굵기 토큰명 `--pele-title-weight`·`--pele-heading-weight` 명시(mdedit-tokens.css 111-112행 실측). D4: REQ-002 비규범 문장을 shall 절에 흡수. D5: exportDiagram.test.ts 앵커 경계를 실측값 36-60·296-303으로 정정. D6: AC-006에 PDF 경유 경로 절 추가(exportHtml.ts:57·:90 실측). |

## Overview

### 배경

- pele 1.10.0은 pele 기본 팔레트를 `--pele-*` CSS 변수로 읽는다. 현재 `src/styles/mdedit-tokens.css`는 이 블록을 두 번 선언한다 — `:root`(92-123행, 값이 `var(--md-…)`에 체이닝)와 `[data-theme="dark"]`(162-186행) — 그래서 다이어그램 색이 앱 테마를 따라간다.
- 디자인 결정(2026-10-28, 사용자): 다이어그램은 테마와 무관한 고정 "잉크 앤 허니" 종이 카드 팔레트를 쓴다. 다크 테마에서는 다이어그램을 종이 카드로 제시한다.
- 내보내기 이음매(`getPreviewCss`, `src/lib/export/exportUtils.ts:79,107-109`)는 오늘날 앱 배경색 3항 선택(`#191b1d`/`#f2f2f3`)을 미러링한다. 고정 팔레트에서는 상수 `#FAF9F6`가 된다.

### 환경 주의 (run 단계 전제)

- 로컬 작업 트리는 v0.16.1(pre-pele)이다. 이 SPEC의 모든 코드 앵커는 origin/main 블롭 39c39e9(v0.17.0, pele 1.10.0) 기준으로 검증했다.
- run 단계는 반드시 origin/main 기반 브랜치에서 실행한다. pele 관련 사실 확인은 작업 트리 `src/`가 아니라 `git show origin/main:<path>`로만 한다.

## Requirements (GEARS)

#### REQ-PREVIEW016-001: 토큰 단일 블록 리터럴 (Ubiquitous)

- The pele 토큰 선언(`src/styles/mdedit-tokens.css`) shall 모든 `--pele-*` 변수를 `:root` 블록 안에서 리터럴 값으로 정확히 한 번 선언한다. 값 어디에도 `var(--md-…)` 체이닝을 두지 않는다.
- The pele 토큰 선언 shall `[data-theme="dark"]` 블록의 `--pele-*` 선언을 모두 제거한다(현 162-186행 블록 삭제).

#### REQ-PREVIEW016-002: 팔레트 값 표가 유일 기준 (Ubiquitous)

- The pele 토큰의 색 값 shall 승인된 잉크 앤 허니 팔레트 표만을 따른다: bg `#FAF9F6`, fg `#222B33`, muted `#67727C`, line `#3A5673`, surface `#EEF3F7`, surface-alt `#F7F2E7`, border `#97A4B1`, accent `#3A5673`(line과 같은 값), error/critical `#AC3E31`, series-1..8 `#3168A8` `#C95F3B` `#23997C` `#B78511` `#C76A95` `#7A8A28` `#6E5BC4` `#96562F`.
- The pele 토큰 shall not 이 표 밖의 색 값을 선언한다(기각된 Option B 액센트 `#C08A28` 포함).

#### REQ-PREVIEW016-003: 글꼴·반경·굵기 유지 (Ubiquitous)

- The pele 토큰의 글꼴 값 shall `src/lib/diagram/diagramRenderer.ts`의 `DIAGRAM_FONT_FAMILY`·`DIAGRAM_FONT_FAMILY_MONO` 상수와 바이트 단위로 같은 글꼴 목록을 단일 `:root` 리터럴로 유지한다(SPEC-PREVIEW-015 AC-004 계약 유지 — 검증 절차 문구와 테스트 루프만 단일 블록으로 기계적 수정).
- The pele 토큰의 반경 값 shall `3px`(`--md-radius-sm`와 같은 값, 현재 테마 무관)을 유지한다.
- The pele 토큰의 제목·헤딩 굵기 값(`--pele-title-weight`·`--pele-heading-weight`) shall `600`을 유지한다.

#### REQ-PREVIEW016-004: 테마 무관 불변식 (Ubiquitous)

- The 렌더된 다이어그램 shall 라이트 테마와 다크 테마 어디에서 렌더해도 같은 색 값으로 직렬화된다. 테마는 다이어그램 색의 입력이 아니다.

#### REQ-PREVIEW016-005: 다크 배경 종이 카드 (State-driven)

- **While** 다크 테마(`data-theme="dark"`)가 활성 상태일 때, the 미리보기와 내보낸 HTML shall 다이어그램을 종이 카드로 표현한다 — 배경 `--pele-bg`, 테두리 `--pele-border`, 반경 `--pele-radius`.
- **While** 라이트 테마가 활성 상태일 때, the 미리보기와 내보낸 HTML shall 다이어그램 카드 규칙(배경·테두리·반경)을 추가하지 않는다(승인 기본값 2026-10-28: 라이트 무카드 — 라이트 배경 `#f2f2f3`와 종이 `#FAF9F6`는 근접한 흰색 차이라 이음매 상수가 값을 지킨다).

#### REQ-PREVIEW016-006: 내보내기 이음매 상수화 (Ubiquitous)

- The 내보내기 이음매(`src/lib/export/exportUtils.ts`의 `getPreviewCss`) shall 다이어그램 컨테이너 배경을 두 테마 모두에서 `#FAF9F6` 상수로 둔다. 현 3항 선택(`#191b1d`/`#f2f2f3`, exportUtils.ts:109)은 제거한다.
- The 내보낸 HTML·PDF shall 다크 테마에서 카드 테두리와 반경을 함께 내보낸다.

#### REQ-PREVIEW016-007: 치환 경로·테마 인자 무관성 (Ubiquitous)

- The 색 치환 경로(`src/lib/export/exportHtml.ts`의 `replaceMermaidPlaceholders`) shall not 내보낸 SVG에 `var(--pele-` 잔여를 남긴다(SPEC-PREVIEW-015 AC-020 zero-residue 계약 유지).
- The 다이어그램 값 경로 shall 테마 인자가 색 값을 바꾸지 않음을 보장한다 — 같은 문서를 `theme=light`와 `theme=dark`로 내보내도 다이어그램 색이 같다. 사용자가 직접 쓴 `classDef`·`style` 색은 치환하지 않고 보존한다(015 AC-020 사용자 색 절 유지).

#### REQ-PREVIEW016-008: 재렌더 금지 유지 (Event-driven)

- **When** 테마가 전환될 때(사용자 토글 또는 OS 스킴 변경), the 미리보기 shall 같은 SVG 노드를 유지하고 추가 pele 렌더 호출을 발생시키지 않는다(015 "same SVG node, zero re-render" 불변식 유지 — 폐기되는 것은 재색칠 절이지 이 불변식이 아니다).

#### REQ-PREVIEW016-009: 선행 SPEC 개정 기록 (Ubiquitous)

- The 본 SPEC 기록 shall SPEC-PREVIEW-015의 폐기 절과 유지 계약을 명시한다 — § "다른 SPEC 개정" 표 기준. run 단계는 015의 `spec.md`·`acceptance.md`에 폐기 포인터만 더한다(본문 재작성 금지).

## REQ-AC 대응

| REQ | AC | 검증 기법 |
|-----|-----|----------|
| REQ-PREVIEW016-001 | AC-PREVIEW016-001 | unit — CSS 파싱 |
| REQ-PREVIEW016-002 | AC-PREVIEW016-002 | unit — 값 표 대조 |
| REQ-PREVIEW016-003 | AC-PREVIEW016-003 | unit — 글꼴·반경·굵기 |
| REQ-PREVIEW016-004 | AC-PREVIEW016-004 | unit + e2e — 테마 동일성 |
| REQ-PREVIEW016-005 | AC-PREVIEW016-005 | unit + e2e + manual — 다크 카드 |
| REQ-PREVIEW016-006 | AC-PREVIEW016-006 | unit — 내보내기 상수 |
| REQ-PREVIEW016-007 | AC-PREVIEW016-007 | unit — 테마 인자 무관성 |
| REQ-PREVIEW016-008 | AC-PREVIEW016-008 | unit — 재렌더 금지 가드 |
| REQ-PREVIEW016-009 | AC-PREVIEW016-009 | evidence + grep — 개정 기록 |

## 다른 SPEC 개정 (REQ-PREVIEW016-009 대상)

| 015 절 | 처분 | 근거 |
|--------|------|------|
| REQ-PREVIEW015-008 1번 불릿(이중 블록 체이닝) | 폐기 | 고정 팔레트는 단일 `:root` 리터럴(REQ-PREVIEW016-001) |
| REQ-PREVIEW015-008 2·3번 불릿(테마별 재색칠) | 폐기 | 테마는 다이어그램 색의 입력이 아님(REQ-PREVIEW016-004) |
| REQ-PREVIEW015-013의 "그 색은 현재 앱 테마를 따른다" 절(AI 카드 미니 미리보기 색, 015 spec.md 125행) | 폐기 | 다이어그램 색은 테마 입력이 아님(REQ-PREVIEW016-004) — AI 카드 미니 렌더도 같은 다이어그램 모듈을 쓴다 |
| REQ-PREVIEW015-008의 "same SVG node, zero re-render" 불변식 | 유지 | REQ-PREVIEW016-008로 승계 |
| AC-011 e2e 절(테마별 값 + 이중 블록) | 폐기 | 모든 조합이 같은 고정 값(AC-PREVIEW016-004) |
| AC-011 단위 재렌더 금지 절 | 유지 | AC-PREVIEW016-008 |
| AC-015 테마 추종 문구 | 폐기 | 고정 팔레트로 대체 |
| AC-020 기대값 표(테마별) | 폐기 | 6조합 전부 같은 고정 값 |
| AC-020 zero-residue + 사용자 classDef 절 | 유지 | REQ-PREVIEW016-007 |
| AC-004 글꼴 리터럴 계약 | 유지 | REQ-PREVIEW016-003(검증 절차 문구·테스트 루프만 기계적 수정) |

## Exclusions (What NOT to Build)

### Out of Scope — 의존성 버전

- pele는 1.10.0에 고정한다. 1.12.0으로 올리는 작업은 이 SPEC 범위 밖이다.

### Out of Scope — 기각된 설계 대안

- Option B 액센트 `#C08A28`는 쓰지 않는다. 저장소 잔여 0을 grep으로 검증한다(AC-PREVIEW016-009). 재도입도 하지 않는다.

### Out of Scope — 앱 토큰·엔진 변경

- `--md-*` 토큰은 바꾸지 않는다.
- pele 엔진·옵션·새니타이저를 바꾸지 않고, mermaid로 되돌리지 않는다. 팔레트를 고르는 화면(토글·다이어그램별 팔레트 같은 팔레트 테마 노출면)도 만들지 않는다.

### Out of Scope — run 단계 확인 항목

- pele mock/`.mockup`의 accent·surface 소비 검증은 run 단계 사전 점검(plan.md §C)으로 미룬다. plan 단계를 막는 항목이 아니다.

### Out of Scope — DOCX 경로

- DOCX는 이미 라이트 고정(`exportDocx.ts:95`의 `readPeleThemeValues('light')`)이라 고정 팔레트와 구조적으로 같은 값을 내므로 코드 변경이 없다.

## Acceptance

수용 기준과 Given/When/Then 시나리오는 `acceptance.md`, 마일스톤·변경 파일·위험은 `plan.md` 참조.

## References

- 기획 입력(승인됨): `.moai/cache/spec-preview-016-proposal.md` — Phase 8 제안, 앵커는 origin/main 39c39e9 기준 검증
- 선행 SPEC: `.moai/specs/SPEC-PREVIEW-015-pele-renderer/spec.md`(origin/main 기준 v0.4.3, status completed) — 폐기/유지 대응은 본 문서 "다른 SPEC 개정" 표
- 디자인 확정: 2026-10-28 사용자 결정 — 잉크 앤 허니 A안(색값 전체 + 코드 앵커 기록), Option B(`#C08A28`) 기각
