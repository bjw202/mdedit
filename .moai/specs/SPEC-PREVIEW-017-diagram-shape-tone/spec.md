---
id: SPEC-PREVIEW-017
title: "다이어그램 모양 기반 자동 톤 — 판단·시작/끝 노드 구조 강조 + 간선 라벨 이음매"
version: "0.1.1"
status: completed
created: 2026-10-29
updated: 2026-10-29
author: jw (bjw202)
priority: Medium
phase: "v0.19.0 target"
module: src/styles
lifecycle: spec-anchored
tags: "pele, palette, diagram, shape, tone, export, a11y"
tier: M
depends_on: [SPEC-PREVIEW-016]
---

# SPEC-PREVIEW-017: 다이어그램 모양 기반 자동 톤 — 판단·시작/끝 노드 구조 강조 + 간선 라벨 이음매

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-10-29 | jw | 최초 작성. 사용자 결정(2026-10-29, AskUserQuestion): 범위는 판단(`pele-shape-diam`)·시작/끝(`pele-shape-stadium`) 노드만, 판단 테두리는 새 진한 꿀색 토큰, 간선 라벨 이음매 포함. `circle`은 시작/끝에서 제외(research.md §7.1). 코드 앵커는 워크트리 HEAD 4bef707(v0.18.0 + .gitattributes) 기준, pele 사실은 1.10.0 dist 읽기 전용 실측. REQ 8건·AC 8건. |
| 0.1.1 | 2026-10-29 | jw | plan-audit 1차 리뷰(`.moai/reports/plan-audit/SPEC-PREVIEW-017-review-1.md`, FAIL 0.75) 결함 반영. D1: 라벨 이음매 해법을 사용자 결정(2026-10-29, AskUserQuestion)으로 (a) 확정 — 라이트 미리보기 다이어그램 컨테이너에 바탕 `var(--pele-bg)`(`#FAF9F6`)만 추가, 테두리·반경 없음; 016 REQ-005 배경 부분 개정을 무조건 행으로 기록, 미결 표지 3곳 제거. D2: 기각된 이음매 대안은 research.md 기각 기록에만 남기고 spec·plan·acceptance에서 제거. D3: `src/test/exportDiagram.test.ts:37-40,288`(23개 `VAR_NAMES`)을 테스트 영향 목록에 추가. D4: REQ-005에 측정 가능한 색상 기준(HSL hue 41.9°±5°, `#F7F2E7` 대비 3:1 이상)과 `#C08A28` 금지 추가. D5: 토큰↔탐침 목록 동기화·내보내기 대체 리터럴=토큰 값 가드 추가(REQ-006, AC-005·006). D6~D11(경미) 반영: 톤 규칙 블록 표지, 3톤 상한을 이 SPEC이 더하는 톤으로 한정, 016 "23개" 표기 위치 정정, shall 절 분리, AC-001 리터럴 rgb, 클러스터 `--_a` 50%·원 계열 별칭 사실 기록. REQ·AC 식별자 변경 없음. |

## Overview

### 배경

- SPEC-PREVIEW-016이 다이어그램 팔레트를 잉크 앤 허니로 고정했지만, 플로차트의 모든 노드가 같은 채움 `#EEF3F7`·테두리 `#97A4B1`이라 단조롭다. LLM이 쓴 마크다운은 `classDef`가 드물어 렌더러가 구조 기반 기본값을 줘야 한다.
- 모양이 이미 역할(판단·단말·처리)을 표현하므로, 색은 그 역할을 중복 부호화로 강조한다. 근거와 실측은 `research.md`.

### Tier 판단

- Tier M. 표면이 미리보기(CSS)·내보내기(HTML·PDF·DOCX 공통 경로)·토큰·테스트 4곳에 걸치고 016 계약 일부를 개정한다. 알고리즘 난도는 낮아 design.md는 두지 않는다. 사용자 요청과 외부 근거 기록을 위해 research.md를 추가 산출물로 둔다.

## Requirements (GEARS)

#### REQ-PREVIEW017-001: 판단 노드 톤 (Ubiquitous)

- The 렌더된 다이어그램 shall 판단 모양 노드(`pele-shape-diam`)를 채움 `--pele-surface-alt`(`#F7F2E7`)와 테두리 `--pele-decision-border`(진한 꿀색)로 칠한다.

#### REQ-PREVIEW017-002: 시작/끝 노드 톤과 나머지 모양 유지 (Ubiquitous)

- The 렌더된 다이어그램 shall 시작/끝 모양 노드(`pele-shape-stadium`)를 채움 `--pele-surface`(`#EEF3F7`) 그대로, 테두리 `--pele-accent`(`#3A5673`), 테두리 두께 `1.5px`로 칠한다.
- The 렌더된 다이어그램 shall 그 밖의 모양(`rect`·`cyl`·`circle` 등)과 클러스터(`pele-cluster`)의 채움·테두리를 016 기본값 그대로 둔다.
- The 모양 기반 톤 shall 판단·시작/끝 2종의 톤만 더한다(기본 톤 포함 3종). 이 상한은 이 SPEC이 더하는 톤에만 적용되며, 작성자 `classDef`·`style` 색이나 pele가 계열 색으로 칠하는 다른 다이어그램 종류의 색은 세지 않는다.

#### REQ-PREVIEW017-003: 작성자 스타일 우선 (Unwanted)

- The 모양 기반 톤 shall not 작성자가 `classDef`·`class`·`style`로 지정한 속성(채움·테두리·테두리 두께)을 덮어쓴다.
- The 모양 기반 톤 shall 작성자가 지정하지 않은 속성만 채운다.
- The 모양 기반 톤 규칙(미리보기 CSS와 내보내기 주입) shall not `!important`를 쓴다.

#### REQ-PREVIEW017-004: 문구·순서 기반 추론 금지 (Unwanted)

- The 모양 기반 톤 shall not 노드 라벨 문구(예: "실패"·"아니오"·"yes")나 노드 순서·인덱스로 톤을 고른다.
- The 모양 기반 톤 shall pele 모양 클래스만을 입력으로 쓴다.

#### REQ-PREVIEW017-005: 판단 테두리 토큰 (Ubiquitous)

- The pele 토큰 선언(`src/styles/mdedit-tokens.css`) shall 새 토큰 `--pele-decision-border`를 016 고정 `:root` pele 블록 안에 리터럴로 정확히 한 번 선언하고, 다크 블록에는 다시 선언하지 않는다.
- The `--pele-decision-border` 값 shall `#F7F2E7`에 대해 WCAG 대비 3:1 이상이고, HSL 색상(hue)이 series-4 꿀색 `#B78511`의 41.9°에서 ±5° 안(36.9°~46.9°)이다(후보 `#8A6410` = 4.81:1, hue 41.3°; 최종 값은 run 단계에서 확정).
- The `--pele-decision-border` 값 shall not `#B78511`·`#96562F`·`#C08A28` 중 하나다.
- The pele 글꼴 리터럴 shall 015 AC-004 계약(`DIAGRAM_FONT_FAMILY`·`DIAGRAM_FONT_FAMILY_MONO` 바이트 동일)을 그대로 유지한다.

#### REQ-PREVIEW017-006: 내보내기 동일 톤·0-잔여·값 동기화 (Ubiquitous)

- The 내보낸 HTML·PDF·DOCX의 다이어그램 shall 미리보기와 같은 모양 기반 톤을 리터럴 값으로 담는다.
- The 내보낸 다이어그램 SVG shall not `var(--pele-` 문자열을 남긴다(015 AC-020 0-잔여 계약 유지).
- The 내보낸 다이어그램 SVG shall 작성자 `classDef`·`style` 색을 치환 없이 보존한다.
- The 내보내기 색 탐침 목록 shall `:root`에 선언된 모든 `--pele-*` 이름을 포함한다.
- The 내보내기 주입에 쓰이는 대체 리터럴 shall 대응 토큰의 `:root` 값과 같다.

#### REQ-PREVIEW017-007: 테마 무관 (Ubiquitous)

- The 모양 기반 톤 shall 라이트·다크 테마에서 같은 값으로 칠해진다(미리보기·내보내기 모두).
- The 모양 기반 톤 shall not 테마를 입력으로 쓴다.

#### REQ-PREVIEW017-008: 간선 라벨 이음매 (Ubiquitous + State-driven + Event-driven)

- The 간선 라벨 바탕 상자(`pele-edge-label` 안 `rect`) shall 두 테마 모두에서 그 상자가 놓인 표면과 이음매 없이 같은 색이다.
- **While** 라이트 테마가 활성 상태일 때, the 미리보기 다이어그램 컨테이너 shall 바탕 `--pele-bg`(`#FAF9F6`)를 가지며 테두리·반경은 추가하지 않는다(사용자 결정 2026-10-29, 해법 (a)).
- **When** run 단계가 이 요구를 구현하기 시작하면, the 구현 shall 수정 전에 라이트·다크 미리보기에서 다이어그램 컨테이너 뒤 실제 계산 바탕과 라벨 상자 계산 채움을 측정해 기록한다.
- The 내보내기 다이어그램 컨테이너 바탕 shall 두 테마 모두 `#FAF9F6` 상수를 유지한다(016 REQ-006).

## REQ-AC 대응

| REQ | AC | 검증 기법 |
|-----|-----|----------|
| REQ-PREVIEW017-001 | AC-PREVIEW017-001 | e2e — 계산 스타일 |
| REQ-PREVIEW017-002 | AC-PREVIEW017-002 | e2e — 계산 스타일 |
| REQ-PREVIEW017-003 | AC-PREVIEW017-003 | e2e(계산 스타일) + unit(내보내기 문자열) + grep |
| REQ-PREVIEW017-004 | AC-PREVIEW017-004 | e2e + grep |
| REQ-PREVIEW017-005 | AC-PREVIEW017-005 | unit — CSS 파싱·대비·색상 계산 |
| REQ-PREVIEW017-006 | AC-PREVIEW017-006 | unit — 내보내기 문자열·동기화 가드 |
| REQ-PREVIEW017-007 | AC-PREVIEW017-007 | e2e + unit |
| REQ-PREVIEW017-008 | AC-PREVIEW017-008 | evidence(측정) + unit + e2e |

## 다른 SPEC 개정

| 016 절 | 처분 | 근거 |
|--------|------|------|
| REQ-PREVIEW016-002 값 표("표 밖 색 금지") | 확장 — `--pele-decision-border` 1행 추가 | REQ-PREVIEW017-005. 기각 색 `#C08A28` 금지는 유지 |
| AC-PREVIEW016-002 문구 "고정 23개 토큰 기준"(016 acceptance.md:27), 016 spec-compact.md:34 "23값" | 24개로 갱신(개수만). AC-PREVIEW016-001의 23개 단정은 문서 문구가 아니라 테스트(`src/test/diagramRenderer.test.ts:149-159`)에만 있어 테스트 갱신으로 처리 | 새 토큰 1개 |
| REQ-PREVIEW016-005 라이트 절 "배경·테두리·반경 추가 안 함" | 배경 부분 개정 — 라이트 미리보기 컨테이너에 바탕 `--pele-bg` 추가. 테두리·반경은 계속 다크 전용 | REQ-PREVIEW017-008(사용자 결정 2026-10-29, 해법 (a)) |
| REQ-PREVIEW016-004·007·008, 015 AC-004·AC-020 | 유지 | REQ-PREVIEW017-005·006·007 |

run 단계는 016 `spec.md`·`acceptance.md`·`spec-compact.md`에 개정 포인터만 더한다(본문 재작성 금지).

## Exclusions (What NOT to Build)

### Out of Scope — 대상 모양 확장

- `rect`·`cyl`·`circle`·클러스터(서브그래프) 톤은 바꾸지 않는다. `circle`을 시작/끝으로 취급하지 않는다(research.md §7.1).
- 데이터 계열·클러스터 착색은 하지 않는다.

### Out of Scope — 의미 추론

- 라벨 문구 기반 착색, 노드 순서 기반 착색은 만들지 않는다.

### Out of Scope — 엔진·팔레트 노출면

- pele 버전(1.10.0)·옵션·새니타이저를 바꾸지 않는다.
- 사용자가 톤을 켜고 끄거나 고르는 설정 화면을 만들지 않는다.
- `--md-*` 앱 토큰은 바꾸지 않는다.
- 라이트 컨테이너에 종이 카드 테두리·반경을 추가하지 않는다.

## Acceptance

수용 기준과 Given/When/Then 시나리오는 `acceptance.md`, 마일스톤·변경 파일·위험은 `plan.md`, 근거·실측은 `research.md` 참조.

## References

- 선행 SPEC: `.moai/specs/SPEC-PREVIEW-016-pele-fixed-palette/spec.md`(고정 팔레트), `.moai/specs/SPEC-PREVIEW-015-pele-renderer/`(AC-004 글꼴, AC-020 0-잔여)
- 사용자 결정: 2026-10-29 AskUserQuestion(범위·판단 테두리·라벨 이음매·워크트리), 같은 날 두 번째 결정(라벨 이음매 해법 (a))
- plan-audit: `.moai/reports/plan-audit/SPEC-PREVIEW-017-review-1.md`
