---
id: SPEC-PREVIEW-011
version: "1.0.0"
status: draft
created: "2026-07-29"
updated: "2026-07-29"
author: "jw"
priority: medium
issue_number: 0
dependencies:
  - SPEC-PREVIEW-001
  - SPEC-EXPORT-001
  - SPEC-E2E-001
tags:
  - preview
  - export
  - css
  - markdown
  - list
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-29 | jw | 최초 SPEC 작성 — CommonMark **loose list**(항목 사이 빈 줄)에서 불릿/번호 마커와 항목 텍스트가 서로 다른 줄에 렌더되는 결함을 수정한다. 원인은 확정 진단됨: `list-style-position: inside`(마커가 `<li>` 내부 인라인 박스) + loose list의 `<li> > <p>`(블록) 조합 → 블록이 새 줄에서 시작. 부수 결함도 동일 경로에서 확인: loose list는 `ul/ol`의 `space-y-1`과 `li > p`의 `mb-4`가 겹쳐 항목 간격이 tight list보다 눈에 띄게 넓다. 사용자 확정 범위: (1) 프리뷰(`src/index.css`)와 내보내기(`src/lib/export/exportUtils.ts`) **양쪽** 수정 + 두 규칙 세트 동등성 유지, (2) tight/loose 항목 간격 정규화, (3) `e2e/markdown-render.spec.ts`에 **기하(bounding box) 기반** Playwright 회귀 테스트 추가(computed style 단독 검증은 불충분). |

## Summary

`mdedit`의 마크다운 프리뷰와 HTML/PDF 내보내기에서, **항목 사이에 빈 줄이 있는 리스트(loose list)** 는 마커(`•`, `1.`)만 한 줄을 차지하고 항목 텍스트가 그 다음 줄로 밀려나 렌더된다. 예:

```
- 항목 A

- 항목 B
- 항목 C
```

현재 결과: 1행 `•`, 2행 `항목 A`. 기대 결과(GitHub / VS Code / 표준 CommonMark 렌더러와 동일): 마커와 텍스트가 **같은 줄**, 줄바꿈된 연속 행은 텍스트 기준으로 **행잉 인덴트(hanging indent)** 정렬.

본 SPEC은 리스트 마커 배치 규칙을 `inside` → `outside` 계열로 교정하고, loose/tight 리스트의 항목 간격을 동일하게 정규화하며, 프리뷰와 내보내기 스타일시트를 동등하게 유지한다. 마크다운 파서(markdown-it)는 건드리지 않는다 — 순수 CSS 변경이다.

## Background & Rationale

### 확정된 원인 (재조사 불필요)

CommonMark에서 리스트 항목 사이에 빈 줄이 하나라도 있으면 리스트 전체가 **loose list** 가 되고, 모든 `<li>`의 내용이 `<p>`로 감싸진다. tight list는 `<li>텍스트</li>`, loose list는 `<li><p>텍스트</p></li>`.

`mdedit`의 마크다운 CSS는 `ul`/`ol`에 `list-style-position: inside`를 지정한다. 이 값에서 마커는 `<li>`의 **콘텐츠 박스 안 인라인 박스**로 배치된다. 그런데 `<li>`의 자식 `<p>`는 **블록 박스**이므로 인라인 마커와 같은 줄에 놓일 수 없고 새 줄에서 시작한다. 결과적으로 마커가 홀로 한 줄을 차지한다. tight list는 `<p>`가 없어 마커와 텍스트가 같은 인라인 흐름에 놓이므로 이 증상이 나타나지 않는다 — 즉 **loose list에서만** 재현된다.

### 확정된 부수 결함 (동일 경로)

loose list는 항목 간격도 tight list와 다르다. `ul`/`ol`에 `space-y-1`(항목 간 상단 여백)이 걸려 있는 동시에, `<li>` 안의 `<p>`가 `mb-4`(1rem 하단 여백)를 상속받는다. 두 여백이 합산되어 loose list 항목 간격이 tight list보다 눈에 띄게 넓다. 같은 문서 안에 tight/loose가 섞이면 간격이 들쭉날쭉하게 보인다.

### 확정된 영향 위치 (소스 검증 완료)

1. **프리뷰 패널** — `src/index.css:180-190`
   - `.preview-content ul { @apply list-disc list-inside mb-4 space-y-1; }`
   - `.preview-content ol { @apply list-decimal list-inside mb-4 space-y-1; }`
   - `.preview-content li { @apply ml-2; }`
   - 문단 여백 원천: `.preview-content p { @apply mb-4; }` (`src/index.css:176-178`)
2. **HTML/PDF 내보내기 스타일시트** — `src/lib/export/exportUtils.ts:126-145` (Tailwind가 아닌 **평문 CSS 문자열**)
   - `.preview-content ul { list-style-type: disc; list-style-position: inside; margin-bottom: 1rem; }`
   - `.preview-content ol { list-style-type: decimal; list-style-position: inside; margin-bottom: 1rem; }`
   - `.preview-content li { margin-left: 0.5rem; margin-bottom: 0.25rem; }`
   - `.preview-content p { margin-bottom: 1rem; }` (`exportUtils.ts:126`)
3. **E2E 회귀 테스트 위치** — `e2e/markdown-render.spec.ts` (현재 39줄, `Markdown rendering (REQ-E2E-005)` describe 1건: heading/table/mermaid 가시성만 검증). loose list 기하 회귀 테스트를 여기에 추가한다.

프리뷰와 내보내기는 동일한 `.preview-content` 셀렉터를 쓰지만 **서로 다른 두 벌의 CSS 소스**(Tailwind `@apply` vs 평문 CSS 문자열)로 관리된다. 한쪽만 고치면 화면과 출력물이 어긋나므로 양쪽을 함께 수정하고 동등성을 유지해야 한다.

### 파서는 무관

`src/lib/markdown/renderer.ts`는 markdown-it 기반이며 loose/tight 판정과 `<p>` 래핑은 CommonMark 표준 동작이다. 본 결함은 **렌더된 HTML이 아니라 CSS의 문제**이므로 파서·플러그인·토큰 파이프라인은 변경하지 않는다.

## Environment & Assumptions

- 프론트엔드: React 18, TypeScript strict, Tailwind CSS 3, markdown-it 14.
- 프리뷰 스타일 원천: `src/index.css`의 `.preview-content *` 규칙(Tailwind `@apply`).
- 내보내기 스타일 원천: `src/lib/export/exportUtils.ts`가 생성하는 독립 CSS 문자열(HTML/PDF 공통). Tailwind 런타임이 없으므로 유틸리티 클래스를 쓸 수 없고 평문 CSS 속성으로 동등 규칙을 작성해야 한다.
- **태스크 리스트 전제(소스 검증됨)**: 본 저장소에는 `markdown-it-task-lists` 계열 플러그인이 **설치되어 있지 않다**(`package.json` 의존성은 `markdown-it` + `@traptitech/markdown-it-katex`뿐이며, `renderer.ts`가 등록하는 플러그인은 mermaid / table-scroll / image-resolver / data-line 4종). 따라서 `- [x] 항목`은 `<input type="checkbox">`가 아니라 **리터럴 텍스트 `[x] 항목`** 으로 렌더된다. 본 SPEC의 태스크 리스트 요구는 "체크박스 위젯 정렬"이 아니라 "`[x]`/`[ ]` 텍스트가 마커와 같은 줄에 남고 정렬이 깨지지 않는 것"으로 정의한다(REQ-PREVIEW-011-006).
- 테스트 환경: vitest(단위/DOM), Playwright(`e2e/`, `tauri-mock` 픽스처). 기하 검증은 Playwright `boundingBox()` 사용.

## Requirements (EARS)

> 요구사항 원자성: 마커 동일 줄(001/002)·인덴트(003/004)·목록 종류 동등(005/006)·간격(007)·프리뷰↔내보내기 동등(008)·회귀 차단(009~011)으로 분리했다. 각 요구는 렌더 결과에 대한 이진 술어로 서술한다.

### Ubiquitous Requirements

- **REQ-PREVIEW-011-001**: The system **shall** 항상 프리뷰(`.preview-content`)에서 리스트 항목의 마커와 해당 항목의 첫 텍스트 줄을 **동일한 수직 위치의 시각적 한 줄**에 렌더한다. loose list(`<li>` 내부에 `<p>`가 존재)와 tight list(`<p>` 없음) 모두에 동일하게 적용된다.
- **REQ-PREVIEW-011-002**: The system **shall** 항상 내보내기 스타일시트(`exportUtils.ts`가 생성하는 HTML/PDF CSS)에서도 REQ-001과 동일한 렌더 결과(마커와 첫 텍스트 줄이 같은 줄)를 산출한다.
- **REQ-PREVIEW-011-003**: The system **shall** 항상 리스트 항목의 마커를 항목 콘텐츠 박스 **바깥**에 배치하여, 항목 텍스트가 줄바꿈될 때 두 번째 줄 이후가 마커 아래가 아니라 **첫 줄 텍스트의 좌측 경계에 정렬(행잉 인덴트)** 되게 한다.
- **REQ-PREVIEW-011-004**: The system **shall** 항상 중첩 리스트(`ul`/`ol` 내부의 `ul`/`ol`)를 부모 리스트의 텍스트 시작 지점보다 시각적으로 더 들여쓴 위치에 렌더하여, 중첩 깊이가 시각적으로 구별되게 한다.
- **REQ-PREVIEW-011-005**: The system **shall** 항상 순서 있는 목록(`ol`, 십진 번호 마커)에 순서 없는 목록(`ul`, 불릿 마커)과 **동일한 마커 배치·인덴트 규칙**을 적용한다(마커 종류만 다르고 배치 규칙은 동일).
- **REQ-PREVIEW-011-006**: The system **shall** 항상 GFM 스타일 태스크 리스트 표기(`- [x] 항목`, `- [ ] 항목`)를 포함한 리스트 항목에서, 마커와 `[x]`/`[ ]` 표기와 뒤따르는 텍스트를 같은 줄에 유지하고, 다른 리스트 항목과 동일한 좌측 텍스트 정렬선을 갖게 한다(현재 파서에서 `[x]`는 체크박스 위젯이 아닌 리터럴 텍스트로 렌더됨 — Environment 참조).
- **REQ-PREVIEW-011-007**: The system **shall** 항상 loose list의 항목 간 수직 간격을 tight list의 항목 간 수직 간격과 동일하게 렌더한다. 구체적으로 `<li>` 내부 **마지막** `<p>`가 기여하는 하단 여백을 제거하여, `ul`/`ol`의 항목 간격 규칙과 문단 하단 여백이 합산되지 않게 한다.
- **REQ-PREVIEW-011-008**: The system **shall** 항상 프리뷰 스타일시트(`src/index.css`)와 내보내기 스타일시트(`exportUtils.ts`)의 리스트 관련 규칙(마커 배치, 좌측 인덴트 크기, 항목 간격, 항목 내부 문단 여백)이 **동등한 렌더 결과**를 내도록 유지한다. 한쪽만 변경된 상태를 허용하지 않는다.

### State-Driven Requirements

- **REQ-PREVIEW-011-009**: **WHILE** 한 `<li>`가 두 개 이상의 `<p>`를 포함하는 동안(여러 문단으로 구성된 리스트 항목), **the system shall** 항목 내부 문단 사이의 수직 간격을 유지하여 문단 구분이 시각적으로 보이게 한다(REQ-007의 여백 제거는 항목의 마지막 문단에만 적용된다).
- **REQ-PREVIEW-011-010**: **WHILE** 앱이 라이트 모드 또는 다크 모드인 동안, **the system shall** 두 테마에서 동일한 리스트 마커 배치·인덴트·간격 규칙을 적용한다(본 SPEC의 변경은 색상이 아닌 레이아웃이므로 테마별 분기를 도입하지 않는다).

### Unwanted Behavior Requirements

- **REQ-PREVIEW-011-011**: The system **shall not** tight list의 렌더를 인덴트 변화 외의 측면에서 변경한다. 구체적으로 tight list에서 마커와 텍스트가 같은 줄에 있는 현재 동작, 마커 종류(disc / decimal), 리스트 블록의 하단 여백(`margin-bottom: 1rem`)은 유지된다.
- **REQ-PREVIEW-011-012**: The system **shall not** 마크다운 파서(`src/lib/markdown/renderer.ts`, markdown-it 설정·플러그인·토큰 규칙)를 변경하거나 태스크 리스트 플러그인 등 신규 의존성을 추가한다(`package.json` 무변경).
- **REQ-PREVIEW-011-013**: The system **shall not** 리스트 이외의 블록 요소(heading, paragraph, blockquote, code/pre, table, mermaid 컨테이너, 이미지) 스타일을 변경한다. 단 `.preview-content p`의 전역 `margin-bottom` 값 자체는 유지하고, 리스트 항목 내부 문단에 한정한 하위 셀렉터만 추가한다.
- **REQ-PREVIEW-011-014**: The system **shall not** 프리뷰의 스크롤 싱크(`data-line` 속성), 인라인 SVG sanitize 경로, mermaid 렌더 경로, 테이블 스크롤 래퍼를 변경한다.

## Visual Change Notice (의도된 전역 변화)

> [HARD] 이 절은 요구사항의 일부로 취급한다 — 리뷰어와 구현자가 "회귀"로 오인하지 않도록 명시한다.

마커를 콘텐츠 박스 바깥으로 옮기면(`inside` → `outside` 계열) **모든 리스트의 들여쓰기가 소폭 변한다.** 마커가 차지하던 자리가 리스트 컨테이너의 좌측 패딩으로 이동하므로, 기존 문서에서도 리스트의 좌측 정렬선이 지금과 달라진다. 이는 **의도된 시각적 변경**이며 결함이 아니다. 영향 범위는 tight/loose, `ul`/`ol`, 중첩 여부와 무관하게 **모든 기존 문서의 모든 리스트**다.

따라서 구현 시 다음을 육안 점검(spot-check)한다:

- 라이트 테마와 다크 테마 **양쪽** 에서 프리뷰 리스트 렌더를 확인한다(REQ-010은 테마 분기 없음을 요구하지만, 배경 대비에 따라 정렬 어긋남이 눈에 띄는 정도가 다르므로 두 테마 모두 확인한다).
- 프로젝트 자체 문서(`README.md`, `ROADMAP.md`, `USER_GUIDE` 계열 등 리스트·태스크 리스트를 많이 쓰는 문서)를 프리뷰로 열어 정렬선과 중첩 깊이를 확인한다. **단, 이 문서들의 내용은 수정하지 않는다**(Exclusions 참조).
- HTML 내보내기 결과와 PDF 내보내기 결과를 각각 열어 프리뷰와 동일한 정렬인지 확인한다.

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [MODIFY] | `src/index.css` (180-190 부근) | `.preview-content ul`/`ol`의 `list-inside` 제거 → `list-style-position: outside` + `padding-left: 1.5rem`(확정값); `.preview-content li`의 `ml-2` **제거**(패딩과 합산 방지); 리스트 항목 내부 마지막 문단의 하단 여백 제거 규칙 추가(REQ-001~007, 009) |
| [MODIFY] | `src/lib/export/exportUtils.ts` (126-145 부근) | 내보내기 CSS 문자열의 `ul`/`ol`/`li` 규칙을 프리뷰와 **동등한 렌더 결과**(`list-style-position: outside` + `padding-left: 1.5rem`, `li`의 `margin-left: 0.5rem` 제거)로 갱신 + 리스트 내부 문단 여백 규칙 추가(REQ-002, 007, 008, 009) |
| [MODIFY] | `e2e/markdown-render.spec.ts` | loose list 기하 회귀 테스트 추가 — 마커와 텍스트 동일 줄(bounding box 비교), 행잉 인덴트, `ol` 동등성, 태스크 리스트 표기, tight/loose 간격 일치(AC-002~AC-006) |
| [NEW] | `e2e/fixtures/`(신규 또는 기존 픽스처 확장) | loose list / tight list / 중첩 리스트 / `ol` / 태스크 리스트를 포함하는 검증용 마크다운 픽스처. 기존 `test-content.md`를 확장할지 별도 픽스처를 둘지는 Run phase 재량(기존 테스트 회귀 금지가 조건) |

## Verification Strategy

각 수용 기준이 **무엇으로 강제되는지** 를 명시한다. 자동 검증 범위를 넘어서는 항목은 코드 리뷰/육안 점검으로 정직하게 분류한다.

| 검증 계층 | 대상 | 강제 수단 |
|-----------|------|-----------|
| Playwright E2E (기하) | REQ-001, 003, 004, 005, 006, 007, 011 | `e2e/markdown-render.spec.ts` — `boundingBox()` 기반 좌표 비교 |
| 코드 리뷰(diff) | REQ-002, 008 (프리뷰↔내보내기 동등성) | 두 스타일시트의 리스트 규칙을 나란히 대조. **자동 테스트가 두 CSS 소스의 동등성을 증명하지 않는다** — 내보내기 CSS는 문자열이며 Playwright는 앱 프리뷰만 렌더하므로, 동등성은 리뷰로 강제한다 |
| 육안 점검(수동) | Visual Change Notice, REQ-010 | 라이트/다크 테마 프리뷰 + HTML 내보내기 + PDF 내보내기 각 1회 |
| 회귀 게이트 | REQ-012, 013, 014 | `npm run typecheck` + `npm test` + `npm run test:e2e` + `npm run lint` 전체 통과, `package.json` diff 0줄 |

## Acceptance Criteria

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-PREVIEW-011-001 | REQ-001 | loose list(항목 사이 빈 줄) 픽스처를 프리뷰에 렌더했을 때, 첫 `<li>`의 마커 렌더 영역과 항목 텍스트의 bounding box가 **수직으로 겹친다**(텍스트 box의 y 범위가 `<li>` 첫 줄 y 범위 안에 포함). 텍스트 box의 top이 `<li>` top + 1행 높이 이상으로 밀려나지 않는다 |
| AC-PREVIEW-011-002 | REQ-001, 007, 011 | 동일 문서 안의 tight list와 loose list를 렌더했을 때, 두 리스트의 인접 항목 간 수직 간격(다음 `<li>` top − 이전 `<li>` bottom) 차이가 허용 오차(예: 2px) 이내로 동일하다 |
| AC-PREVIEW-011-003 | REQ-003 | 한 줄을 넘겨 줄바꿈되는 긴 항목에서, 두 번째 줄 텍스트의 좌측 x 좌표가 첫 줄 텍스트의 좌측 x 좌표와 동일하다(마커 아래로 흘러내리지 않음) |
| AC-PREVIEW-011-004 | REQ-004 | 중첩 리스트 픽스처에서 자식 `<li>` 텍스트의 좌측 x 좌표가 부모 `<li>` 텍스트의 좌측 x 좌표보다 크다(더 들여쓰기됨) |
| AC-PREVIEW-011-005 | REQ-005 | loose `ol` 픽스처에서 번호 마커와 항목 텍스트가 같은 줄이며(AC-001과 동일 판정), 항목 텍스트 정렬선 규칙이 `ul`과 동일하다 |
| AC-PREVIEW-011-006 | REQ-006 | `- [x] 완료`, `- [ ] 미완료`를 포함한 리스트에서 `[x]`/`[ ]` 텍스트가 마커와 같은 줄에 있고, 해당 항목의 텍스트 좌측 x 좌표가 같은 리스트의 일반 항목과 동일하다 |
| AC-PREVIEW-011-007 | REQ-009 | 한 항목이 두 문단으로 구성된 loose list에서, 항목 내부 두 문단 사이 수직 간격이 0보다 크다(문단 구분 유지) |
| AC-PREVIEW-011-008 | REQ-002, 008 | 내보내기 CSS 문자열의 `ul`/`ol`/`li`/리스트 내부 문단 규칙이 프리뷰 규칙과 동등한 렌더 결과를 산출함을 diff 리뷰로 확인. `list-style-position: inside` 잔존 0건 |
| AC-PREVIEW-011-009 | REQ-010, Visual Change Notice | 라이트/다크 두 테마에서 프리뷰 리스트를 육안 확인, HTML·PDF 내보내기 결과를 각각 열어 프리뷰와 동일 정렬임을 확인(체크리스트 기록) |
| AC-PREVIEW-011-010 | REQ-012, 013, 014 | `package.json` 무변경(diff 0줄), `renderer.ts` 무변경, 기존 `e2e/markdown-render.spec.ts`의 heading/table/mermaid 어서션 및 전체 vitest·Playwright 스위트 무변경 통과 |

REQ 커버리지 대조(001–014 전수): 001→AC1·AC2, 002→AC8, 003→AC3, 004→AC4, 005→AC5, 006→AC6, 007→AC2, 008→AC8, 009→AC7, 010→AC9, 011→AC2·AC10, 012→AC10, 013→AC10, 014→AC10. 미커버 REQ 없음.

**Quality Gates (AC 외 공통 게이트)**: `npm run typecheck`(`tsc --noEmit`) 클린 + `npm test`(vitest) 전체 통과 + `npm run test:e2e`(Playwright) 전체 통과 + `npm run lint` 통과.

## Risks & Regression Watchlist

| # | 위험 | 왜 위험한가 | 완화 |
|---|------|-------------|------|
| R1 | **중첩 리스트 인덴트 붕괴** | `list-inside` → `outside` 전환 시 마커 공간이 부모의 패딩으로 이동한다. 부모/자식 패딩을 잘못 잡으면 자식 리스트가 부모와 같은 위치에 붙거나 과도하게 밀려난다 | REQ-004 + AC-004로 x 좌표 대소를 기하 검증 |
| R2 | **태스크 리스트 표기 정렬** | 프로젝트 문서가 `- [x]`를 많이 쓴다. 현재 파서에서는 리터럴 텍스트지만, 향후 task-list 플러그인이 도입되면 `<input>`이 `<li>` 첫 인라인 요소가 되어 정렬 전제가 달라진다 | REQ-006 + AC-006으로 현재 동작을 고정. 플러그인 도입은 본 SPEC 범위 밖(별도 SPEC에서 재검증 필요) |
| R3 | **PDF 페이지네이션·폭 변화** | 좌측 패딩이 늘어나면 내보내기 PDF에서 긴 리스트 줄의 줄바꿈 위치가 바뀌고, 페이지 경계에 걸린 항목이 이동하거나 리스트가 우측으로 넘칠 수 있다 | AC-009 육안 점검에 PDF 내보내기 1회 포함. 좌측 패딩은 `1.5rem` 확정(기존 `ml-2` 0.5rem은 제거하여 합산 금지). Run phase는 명시된 수용 기준이 실패할 때만 이 값을 조정한다 |
| R4 | **기존 E2E 스냅샷/좌표 어서션 파손** | `e2e/`에 좌표·스크린샷 기반 어서션이 있으면 인덴트 변화로 실패할 수 있다 | 구현 시 `e2e/` 전체에서 `toHaveScreenshot`/좌표 어서션을 grep으로 확인하고 필요 시 baseline 갱신(현재 `markdown-render.spec.ts`에는 가시성 어서션만 존재) |
| R5 | **프리뷰↔내보내기 드리프트** | 두 CSS 소스는 문법(Tailwind vs 평문)이 달라 한쪽만 고치기 쉽고, 자동 테스트가 동등성을 증명하지 못한다 | REQ-008 + AC-008을 **코드 리뷰 계층**으로 명시 배정(Verification Strategy 참조) |
| R6 | **스크롤 싱크 오프셋** | `data-line` 기반 스크롤 싱크는 요소 위치를 사용하므로 리스트 높이 변화가 싱크 정확도에 영향 줄 수 있다 | REQ-014로 싱크 로직 무변경을 고정하고, 육안 점검 시 긴 리스트 문서에서 스크롤 싱크 이상 여부를 함께 확인 |

## Exclusions (What NOT to Build)

- **마크다운 파서 변경 없음** — `src/lib/markdown/renderer.ts`, markdown-it 설정·플러그인·토큰 규칙 무변경. loose/tight 판정과 `<p>` 래핑은 CommonMark 표준 동작이며 이를 우회하지 않는다.
- **태스크 리스트 플러그인 도입 없음** — `markdown-it-task-lists` 등으로 `[x]`를 실제 `<input type="checkbox">`로 바꾸는 작업은 범위 밖(별도 SPEC). 본 SPEC은 현재의 리터럴 텍스트 렌더를 전제로 정렬만 보장한다.
- **콘텐츠 파일 수정 없음** — `ROADMAP.md`, `README.md`, `USER_GUIDE` 등 어떤 문서 파일의 리스트 표기도 수정하지 않는다. 수정 대상은 CSS와 테스트뿐이다.
- **리스트 외 블록 요소 리스타일 없음** — heading, blockquote, table, code/pre, mermaid, 이미지 스타일 무변경. `.preview-content p`의 전역 `margin-bottom` 값도 그대로 둔다(리스트 항목 한정 하위 셀렉터만 추가).
- **마커 커스터마이징 없음** — 커스텀 불릿 문자, `::marker` 색상/크기 튜닝, 번호 형식 변경(로마자 등)은 범위 밖.
- **디자인 토큰 마이그레이션 없음** — `.preview-content` 리스트 규칙을 `--md-*` 시맨틱 토큰 체계로 옮기는 리팩터링은 범위 밖(레이아웃 결함 수정에 집중).
- **에디터(CodeMirror) 렌더 변경 없음** — 에디터 쪽 리스트 표시/들여쓰기 동작 무변경.
- **Rust 백엔드 무변경** — `src-tauri/` 미접촉.

## References

- SPEC-PREVIEW-001 — 마크다운 렌더링 파이프라인(`renderer.ts` + `PreviewRenderer`), 회귀 검증 대상
- SPEC-EXPORT-001 — HTML/PDF 내보내기 스타일시트 계보(`exportUtils.ts`)
- SPEC-E2E-001 — Playwright E2E 스위트 및 `tauri-mock` 픽스처 규약
- `src/index.css:176-190` — `.preview-content p` / `ul` / `ol` / `li` (프리뷰 변경 대상)
- `src/lib/export/exportUtils.ts:126-145` — 내보내기 CSS 문자열의 `p` / `ul` / `ol` / `li` (내보내기 변경 대상)
- `e2e/markdown-render.spec.ts:15-38` — 기존 마크다운 렌더 E2E(회귀 무변경 + 신규 loose list 테스트 추가 지점)
- CommonMark Spec — Lists (loose vs tight, `<p>` 래핑 규칙)
