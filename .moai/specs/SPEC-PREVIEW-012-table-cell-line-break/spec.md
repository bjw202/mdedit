---
id: SPEC-PREVIEW-012
version: "1.0.1"
status: completed
created: "2026-08-11"
updated: "2026-08-11"
author: "jw"
priority: medium
issue_number: 0
dependencies:
  - SPEC-PREVIEW-001
  - SPEC-PREVIEW-002
  - SPEC-PREVIEW-008
tags:
  - preview
  - markdown
  - table
  - multi-line-cell
  - line-break
  - token-manipulation
  - xss-prevention
lifecycle: spec-first
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-08-11 | jw | 최초 SPEC 작성 — GFM 표 셀 안에서 줄바꿈을 허용한다. `html:false`(renderer.ts:292, @MX:WARN)·전역 `breaks` 옵션 미사용을 전제로, 리터럴 `<br>`/`<br/>`/`<br />` 텍스트를 표 셀 컨텍스트에서만 markdown-it `hardbreak` 토큰으로 변환하는 `core.ruler` 플러그인을 추가한다(DP1 권장안). 일반 단락·코드블록·인라인 코드의 `<br>` 텍스트는 기존대로 이스케이프. 속성 포함 `<br>`(예: `<br onload=...>`)과 비표준 `</br>`는 매칭하지 않아 XSS 벡터 차단. 소스 편집기(CodeMirror) 원문 표시는 변경하지 않는다(non-goal). SPEC-PREVIEW-008 인라인 SVG placeholder-and-restore와 동일한 `html:false` 불변식 철학을 따른다. |
| 1.0.1 | 2026-08-11 | jw | as-implemented — REQ-PREVIEW012-001~007 전 요구사항 구현·전 게이트 그린(tsc 클린, eslint 클린, vitest 1435/1435 통과, renderer.test.ts 62/62, renderer.ts 커버리지 98.3%). 배선 편차 2건(모두 plan.md review note가 허용한 범위): (a) 별도 파일 대신 `tableCellLineBreakPlugin`을 `renderer.ts`에 인라인으로 구현 — dataLinePlugin·tableScrollPlugin·imageResolverPlugin이 모두 renderer.ts에 인라인인 기존 패턴에 일치시킴(크기 ~90줄, 과업 지시가 "in src/lib/markdown/renderer.ts"를 명시); (b) `md.core.ruler.after('data_line', ...)` 대신 자연스러운 `md.use()` 호출 순서에 의존(dataLinePlugin이 먼저 등록되고 그 다음 tableCellLineBreakPlugin 등록) — DP4 요구사항(table_cell_br이 data_line 이후 실행)을 동일하게 만족. 정규식 `/<br\s*\/?>/i`로 속성 거부 패턴 고정(REQ-005). `html:false`(renderer.ts:292)·전역 `breaks` 옵션 미사용·기존 플러그인(dataLine/tableScroll/imageResolver/mermaid/KaTeX/Shiki/SVG-restore) 무간섭 불변식 유지. |

## Overview

`mdedit`의 GFM 표 파이프라인(`md.enable('table')`, renderer.ts:311)은 각 셀을 단일 라인으로 파싱한다. markdown-it 생성자의 `html: false`(renderer.ts:292, @MX:WARN at renderer.ts:288-291)가 원시 HTML을 차단하므로, 사용자가 셀 안에 `<br>`를 적어도 `&lt;br&gt;`로 이스케이프되어 줄바꿈이 표시되지 않는다. 결과적으로 표 셀에 두 줄 이상의 콘텐츠를 넣을 방법이 없다.

본 SPEC은 이 제약을 **`html:false`를 유지한 채** 푼다. 전략은 SPEC-PREVIEW-008의 인라인 SVG placeholder-and-restore와 같은 안전 철학을 따르되, 문자열 기반 전·후처리 대신 **markdown-it `core.ruler` 체인에서 토큰을 직접 조작**한다(과업 요구사항이 명시한 "narrowly-scoped rule" 접근):

1. `md.core.ruler.push('table_cell_br', fn)`로 표 셀 전용 규칙을 등록한다(`dataLinePlugin` 이후, D4).
2. 토큰 스트림을 순회하며 `td_open`/`th_open` ~ `td_close`/`th_close` 사이의 `inline` 토큰을 찾는다(D2).
3. inline 자식의 `text` 토큰 안에서 리터럴 `<br>`, `<br/>`, `<br />` 문자열을 검색해 잘라내고, 사이에 표준 `hardbreak` 토큰을 삽입한다(D1, D6).
4. markdown-it 기본 `hardbreak` 렌더 규칙이 `<br>\n`(또는 XHTML 모드에서 `<br />\n`)을 출력한다.
5. 속성 포함 형태(`<br foo="bar">`, `<br onload=...>`)는 매칭하지 않는다(D7, XSS 방어).

**왜 이 접근인가:**
- 사용자에게 가장 익숙한 `<br>` 문법을 그대로 지원한다. GitHub·GitLab·Bitbucket 모두 표 셀에서 `<br>`를 허용한다.
- `html:false`와 전역 `breaks` 옵션을 건드리지 않는다. 일반 단락의 `\n` 시맨틱이 무결하다(REQ-003).
- `<br>`를 사용자 원시 HTML이 아니라 markdown-it 자체 `hardbreak` 렌더 규칙의 산출물로 만든다. 따라서 사용자가 쓴 `<br>` 텍스트는 출력에 절대 도달하지 않으며, 출력의 `<br>`는 markdown-it이 통제한다(REQ-005·006).
- 코드블록·인라인 코드 안의 `<br>` 텍스트는 규칙 적용 대상이 아니므로 자연스럽게 보호된다(REQ-004).

구현 계획·브라운필드 변경 지도·@MX 태그 대상은 plan.md, Given-When-Then 수용 시나리오·테스트 매핑은 acceptance.md 참조.

## Glossary

- **GFM 표 셀(GFM table cell)**: markdown-it의 `table` 플러그인이 만드는 `td_open`/`th_open`으로 시작해 `td_close`/`th_close`로 끝나는 셀. 각 셀은 단일 라인으로 파싱된다.
- **리터럴 `<br>` 텍스트**: 사용자가 소스 마크다운 셀 안에 적은 `<br>`, `<br/>`, `<br />` 형태의 텍스트. `html:false`에서는 이스케이프되어 `&lt;br&gt;`로 렌더된다(본 SPEC 도입 전).
- **`hardbreak` 토큰**: markdown-it의 표준 인라인 토큰 타입. 기본 렌더 규칙이 `<br>\n`(xhtmlOut=false) 또는 `<br />\n`(xhtmlOut=true)을 출력한다. 일반적으로 소스의 `\`+`\n`이 변환되지만, 본 SPEC은 토큰을 직접 주입한다(D6).
- **표 셀 컨텍스트(table-cell context)**: `td_open` 또는 `th_open` 토큰 이후, 대응하는 닫기 토큰까지의 범위. 본 SPEC의 규칙은 이 범위 안의 inline 자식에게만 적용된다(D2).
- **전역 `breaks` 옵션**: markdown-it의 `breaks: true` 설정. 소스의 모든 `\n`을 `<br>`로 바꾼다. 본 SPEC은 이 옵션을 **true로 전환하지 않는다**(기존 시맨틱 유지 불변식, REQ-003).
- **`html:false` 불변식**: renderer.ts:286-308의 markdown-it 생성자에서 `html: false`를 하드코딩한 설정. @MX:WARN(renderer.ts:288-291)이 전환 금지를 명시. 인라인 SVG(SPEC-PREVIEW-008)·표 셀 줄바꿈(본 SPEC) 모두 이 제약 안에서 해결한다.
- **속성 거부 정책(attribute-rejection policy)**: 본 규칙의 `<br>` 매칭 정규식은 속성을 가진 형태를 거부한다(`<br foo="bar">`, `<br onload=...>` 매칭 안 함, D7). XSS 벡터 원천 차단.

## EARS Requirements

### REQ-PREVIEW012-001: 표 셀 안 리터럴 `<br>`을 줄바꿈으로 렌더 (Event-driven)

- **WHEN** 사용자가 표 셀 안에 리터럴 `<br>`, `<br/>`, `<br />` 텍스트를 작성하면, **the system shall** 해당 텍스트를 줄바꿈(`<br>`)으로 렌더한다.
- The system **shall** 변환을 markdown-it의 `core.ruler` 체인에 등록된 단일 규칙으로 수행한다.
- The system **shall** 변환 결과로 표준 `hardbreak` 토큰을 삽입하고, 출력되는 `<br>`는 markdown-it의 기본 렌더 규칙이 생성하도록 둔다(사용자 원시 HTML이 출력에 도달하지 않음).

### REQ-PREVIEW012-002: 표 셀 컨텍스트로 변환 범위 한정 (State-driven)

- **WHILE** inline 토큰이 `td_open`/`th_open` ~ `td_close`/`th_close` 범위 안에 있는 동안, **the system shall** 리터럴 `<br>` 변환을 적용한다.
- **WHILE** inline 토큰이 표 셀 외부(단락·인용·목록·헤딩 등)에 있는 동안, **the system shall** 리터럴 `<br>` 텍스트를 이스케이프된 상태(`&lt;br&gt;`)로 두고 변환하지 않는다.

### REQ-PREVIEW012-003: 일반 단락 시맨틱 회귀 차단 (Unwanted behavior)

- **IF** 표 셀 밖의 단락·코드블록·인용·목록 등에 리터럴 `<br>` 텍스트가 포함되면, **then the system shall** 기존 동작(이스케이프된 텍스트로 표시)을 유지하고 줄바꿈으로 렌더하지 않는다.
- The system **shall not** markdown-it의 전역 `breaks` 옵션을 `true`로 전환한다(`\n` 시맨틱 무결).

### REQ-PREVIEW012-004: 코드 영역 보호 (Unwanted behavior)

- **IF** 코드펜스(``` ``` ```) 또는 인라인 코드 스판(백틱) 안에 `<br>` 텍스트가 포함되면, **then the system shall** 이를 줄바꿈으로 변환하지 않고 코드 콘텐츠로 그대로 둔다.
- The system **shall** 표 셀 내부라도 inline 자식이 코드 컨텍스트(`code_inline`/`code_block`/`fence`)인 경우 변환을 건너뛴다.

### REQ-PREVIEW012-005: 속성 포함 `<br>` 및 비표준 닫기 태그 거부 (Unwanted behavior)

- **IF** 표 셀 안에라도 속성을 가진 `<br>` 형태(`<br foo="bar">`, `<br onload="...">` 등)가 나타나면, **then the system shall** 이를 매칭하지 않고 이스케이프된 텍스트로 둔다.
- **IF** 비표준 닫기 태그 `</br>`가 나타나면, **then the system shall** 이를 매칭하지 않는다(`<br>`는 void 요소, 닫기 태그 비표준).
- The system **shall** `<br>` 매칭 정규식을 속성 거부 패턴으로 고정한다(D7).

### REQ-PREVIEW012-006: `html:false` 유지 및 출력 안전성 (Ubiquitous)

- The system **shall** markdown-it의 `html: false` 설정을 유지한다(renderer.ts:292).
- The system **shall not** `<br>`를 허용하기 위해 `html: true`로 전환하거나 전역 원시 HTML 허용을 도입하지 않는다.
- The system **shall** `<br>` 출력을 markdown-it `hardbreak` 렌더 규칙의 산출물로 한정한다.
- The system **shall** 변환 중 텍스트·토큰을 분할할 때 markdown-it의 escape 규칙을 준수하여 나머지 셀 콘텐츠가 이중 이스케이프되지 않도록 한다.
- **IF** 변환 중 예외가 발생하면, **then the system shall** 앱을 중단시키지 않고 원본 텍스트를 그대로 둔 채 규칙을 건너뛴다.

### REQ-PREVIEW012-007: 기존 플러그인과 회귀 없는 조합 (Unwanted behavior)

- **IF** 표에 `data-line` 속성 주입(SPEC-PREVIEW-002), `tableScrollPlugin` 래핑(renderer.ts:58-89), 이미지 문법 `imageResolverPlugin` 변환(renderer.ts:236-256)이 이미 적용되어 있으면, **then the system shall** 본 규칙이 이들과 충돌하지 않고 각각의 동작을 보존한다.
- The system **shall** 본 규칙을 `data_line` 코어 규칙 이후에 실행하여 블록 단위 `data-line` 속성이 영향받지 않도록 한다(본 규칙은 inline 자식만 조작).

## Security

### 위협 모델

`<br>`는 void HTML 요소로 속성이나 자식 콘텐츠를 가질 수 없다. 사용자가 `<br onload="alert(1)">`를 시도할 수 있으나, 본 SPEC의 변환은 오직 속성 없는 리터럴 `<br>`/`<br/>`/`<br />` 토큰 문자열만 매칭한다(D7, 정규식 `/<br\s*\/?>/i`). 속성을 포함한 형태는 매칭 대상이 아니므로 변환되지 않고, `html:false`가 이스케이프한다.

### DOMPurify 경로 분석 (사전 검증 항목 — 과업 기술과 소스 불일치)

과업 요구사항이 "렌더된 HTML이 DOMPurify를 통과한다"라고 기술했으나, **소스 검증 결과 메인 HTML 경로는 DOMPurify를 거치지 않는다**:

- `PreviewRenderer.tsx`의 `dangerouslySetInnerHTML`(PreviewRenderer.tsx:97, 186) 직전에 호출되는 `restoreInlineSvgMarkers`(PreviewRenderer.tsx:47-59)는 `data-mdedit-svg` 마커만 `sanitizeSvg`로 변환할 뿐, 전체 HTML을 sanitize하지 않는다.
- 메인 경로의 XSS 1차 방어선은 `html:false`(renderer.ts:292)이며, 이는 사용자 원시 HTML을 토큰화 단계에서 차단한다.
- `svgSanitize.ts`의 DOMPurify 사용은 SVG 마커 복원 경로에만 국한된다(SPEC-PREVIEW-008).

**안전성 근거(과업 요구사항 3 교정):**
1. 본 SPEC의 변환은 사용자가 쓴 `<br>` 텍스트를 **제거**하고 markdown-it의 `hardbreak` 토큰으로 **교체**한다.
2. 출력의 `<br>`는 사용자 입력이 아니라 markdown-it의 고정된 렌더 규칙(`hardbreak` → `<br>\n`)이 만든다.
3. 따라서 사용자 원시 HTML이 출력에 도달하는 경로가 없고, DOMPurify 의존 여부와 무관하게 안전하다.

만약 향후 전체 HTML sanitize가 도입되더라도 `<br>`는 DOMPurify 기본 허용 태그이므로 회귀하지 않는다(acceptance.md 테스트 항목으로 기록).

### 잔여 위험

- `<br>` 뒤에 오는 셀 내 마크업(굵게·기울임 등)이 셀 경계와 어떻게 상호작용하는지 테스트로 고정(M2).
- 향후 markdown-it 메이저 업그레이드(14.x → 15.x 등) 시 `hardbreak` 토큰 생성자·렌더 규칙 시그니처 변동 가능 — 가드 테스트로 고정.
- 마크다운-it의 `linkify`·`typographer`가 `<br>` 주변 텍스트를 변형할 가능성은 낮지만 회귀 테스트로 확인(M2).

## Decision Points (사용자 확정 필요 — Run phase 진입 전)

본 SPEC은 아래 결정을 권장안과 함께 제시한다. Run phase(`moai run`) 진입 전 사용자의 명시적 승인을 요구한다(MoAI orchestrator가 AskUserQuestion으로 진행 권장).

### DP1: 마커 문법 — 권장: 리터럴 `<br>`/`<br/>`/`<br />` 인터셉트

| 후보 | 평가 |
|------|------|
| **(권장) 리터럴 `<br>` 텍스트를 core 룰에서 `hardbreak` 토큰으로 교체** | GitHub·GitLab·Bitbucket 호환. `html:false` 유지. 출력 `<br>`는 markdown-it 생성(사용자 원시 HTML 도달 없음). 표 셀로 자연스럽게 범위 한정. |
| 백슬래시-뉴라인(`\`+`\n`) | GFM 표는 셀 단위 라인 파싱이라 소스 줄바꿈이 셀을 종료시킨다 — 표 셀 안에서 물리적으로 불가능. |
| `breaks: true` 전역 적용 + 표 셀 특수처리 | 모든 `\n`이 `<br>`로 바뀌어 기존 단락 시맨틱이 회귀. 위험도 높음. |
| 유니코드 커스텀 토큰(`⏎`) | 사용자 학습 비용. GitHub 호환 안 됨. 타 에디터와 문법 상이. |

### DP2: 적용 범위 — 권장: 표 셀(td/th) 내부로 한정

변환은 `td_open`/`th_open` ~ 닫기 토큰 범위의 inline 자식에게만 적용. 단락·코드블록·인라인 코드의 `<br>` 텍스트는 기존대로 이스케이프(REQ-002·003·004).

### DP3: DOMPurify 의존 — 권장: 의존하지 않음(`html:false` + 토큰 조작으로 안전)

사용자 원시 HTML이 출력에 도달하지 않으므로 DOMPurify가 필요 없다. 메인 HTML 경로는 현재 DOMPurify를 거치지 않음을 소스로 확인(위 Security 참조). `<br>`가 DOMPurify 기본 허용 태그임은 참고사항으로 기록(향후 전체 sanitize 도입 시 회귀 방어용 가드 테스트에서 검증).

### DP4: 플러그인 순서 — 권장: `data_line` 직후 실행

`md.core.ruler.push('table_cell_br', fn)`를 `dataLinePlugin` 이후에 등록. `dataLinePlugin`은 블록 토큰의 `data-line` 속성만 건드리므로 inline 조작과 충돌하지 않는다. `tableScrollPlugin`(render 규칙)·`imageResolverPlugin`(image render 규칙)과도 무관.

### DP5: CodeMirror 소스 표시 — 권장: 변경 없음(non-goal)

편집기는 원문 `<br>`를 그대로 표시한다. 미리보기와 소스 간 1:1 매핑을 해치지 않기 위해 하이라이트·치환을 도입하지 않는다.

## Exclusions (What NOT to Build) / Non-Goals

- **전역 `breaks: true` 도입 미포함** — 모든 `\n`을 `<br>`로 바꾸는 전역 옵션은 기존 단락 시맨틱을 회귀시킨다(REQ-003).
- **`html: true` 전환 미포함** — XSS 방어선 무너뜨리므로 불가(@MX:WARN renderer.ts:288-291).
- **표 셀 외부의 `<br>` 변환 미포함** — 단락·헤딩·인용·목록의 `<br>` 텍스트는 이스케이프 상태 유지(REQ-003).
- **코드블록/인라인 코드 안 `<br>` 변환 미포함** — 코드 콘텐츠로 보호(REQ-004).
- **CodeMirror 표시 변경 미포함** — 편집기 원문 렌더링은 그대로. 구문 강조·아이콘 치환 미포함(DP5).
- **`</br>` 비표준 닫기 태그 지원 미포함** — `<br>`는 void 요소. `</br>`는 비표준이므로 매칭하지 않는다(REQ-005).
- **속성 포함 `<br>`(예: `<br style="...">`, `<br onload=...>`) 허용 미포함** — 속성을 가진 `<br>`는 매칭하지 않고 이스케이프. XSS 벡터 차단(REQ-005, D7).
- **HTML 테이블 비-GFM 확장 미포함** — 셀 병합(rowspan/colspan)·열 너비 지정 등은 별도 SPEC.
- **엑스포트 경로(HTML/DOCX) 추가 변환 미포함** — `renderMarkdown`(`@MX:ANCHOR`, fan_in >= 3)을 공용으로 쓰므로 본 SPEC의 변환이 자동 적용됨. 엑스포트 전용 로직은 추가하지 않는다.
- **DOMPurify 전체 HTML sanitize 도입 미포함** — 본 SPEC 범위 밖. 현재 메인 경로는 `html:false`에만 의존하며 이를 유지한다.

## References

- SPEC-PREVIEW-001 — 마크다운 렌더링 파이프라인(`renderMarkdown` 공용 API, 회귀 검증 대상)
- SPEC-PREVIEW-002 — `dataLinePlugin` data-line 속성 주입(본 규칙 직전 실행, 순서 의존)
- SPEC-PREVIEW-008 — 인라인 SVG placeholder-and-restore(동일 `html:false` 불변식, 안전 패턴 선례)
- `src/lib/markdown/renderer.ts:38-48` — `dataLinePlugin`(@MX:NOTE, 본 규칙 직전 실행)
- `src/lib/markdown/renderer.ts:58-89` — `tableScrollPlugin`(표 래핑·셀 보더, 무관)
- `src/lib/markdown/renderer.ts:236-256` — `imageResolverPlugin`(이미지 문법 경로, 무관)
- `src/lib/markdown/renderer.ts:286-308` — markdown-it 생성자(`html:false` @MX:WARN, 무변경)
- `src/lib/markdown/renderer.ts:311` — `md.enable('table')`
- `src/components/preview/PreviewRenderer.tsx:47-59` — `restoreInlineSvgMarkers`(DOMPurify 경로 분석 근거)
- `src/test/renderer.test.ts:80-94` — 표 렌더 기존 테스트(회귀 기준선)
- `src/test/renderer.test.ts:259-386` — SPEC-PREVIEW-008 인라인 SVG 테스트(토큰 조작·회귀 패턴 선례)

## Implementation Notes (as-implemented)

본 섹션은 구현 완료 후 실제 코드 베이스 상태를 기록한다. 원 REQ·DP·Security 분석은 보존하고, 구현 세부만 부록으로 추가한다.

### 실제 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/markdown/renderer.ts` | 신규 `tableCellLineBreakPlugin`(인라인, 약 90줄) + 헬퍼 3종(`TABLE_CELL_BR_TEST_RE`, `splitTextOnHardbreak`, `splitCellChildrenOnHardbreak`) 추가. markdown-it 생성자에 `md.use(tableCellLineBreakPlugin)` 등록(`dataLinePlugin` 직후). `html:false`·전역 `breaks`·다른 모든 플러그인 무변경. |
| `src/test/renderer.test.ts` | 21개 신규 테스트 추가(시나리오 A-H + 엣지 케이스). |

### 게이트 결과

- `tsc --noEmit`: 클린
- `eslint`: 클린
- `vitest run`: 1435/1435 통과(renderer.test.ts 62/62 포함)
- 커버리지: `src/lib/markdown/renderer.ts` 98.3%

### DP1-DP5 적용 결과

| DP | 권장안 | 적용 |
|----|--------|------|
| DP1 | 리터럴 `<br>`/`<br/>`/`<br />` 인터셉트 | 적용 — 정규식 `/<br\s*\/?>/i`로 매칭 |
| DP2 | 표 셀(td/th) 내부로 한정 | 적용 — `td_open`/`th_open` ~ 닫기 토큰 사이의 inline 자식만 조작 |
| DP3 | DOMPurify 의존 없음 | 적용 — `html:false` + 토큰 교체로 안전. 메인 HTML 경로는 DOMPurify를 거치지 않으므로 의존 불가 |
| DP4 | `data_line` 직후 실행 | 적용 — `md.use()` 자연 순서로 `dataLinePlugin` 직후 등록 |
| DP5 | CodeMirror 소스 표시 변경 없음(non-goal) | 적용 — 편집기 원문 무변경 |

### 정규식 및 보안 근거 (REQ-PREVIEW012-005)

매칭 정규식: `/<br\s*\/?>/i`

매칭 형태: `<br>`, `<br/>`, `<br />`, `<BR>`, `<Br/>`(대소문자 무관, 옵션 공백 + 옵션 `/`).

거부 형태(XSS 방어):
- `<br foo="bar">`, `<br onload="alert(1)">` — 속성이 들어가면 `>`가 바로 오지 않아 매칭 실패.
- `</br>` — `<` 다음 `/`가 와서 `<br` 리터럴이 성립하지 않음. void 요소 비표준 닫기 태그.
- `<brr>`, `<brr/>` 등 — `<br` 뒤 `>` 또는 `/`가 아니면 매칭 안 함.

출력의 `<br>`는 markdown-it 기본 `hardbreak` 렌더 규칙(`<br>\n`, xhtmlOut=false)이 만든다. 사용자가 쓴 원시 `<br>` 텍스트는 토큰 교체 단계에서 제거되어 출력에 도달하지 않는다(REQ-PREVIEW012-006).

### 불변식 보존 (회귀 없음)

- `html: false`(renderer.ts:292) — 무변경. @MX:WARN renderer.ts:288-291 전환 금지 존중.
- 전역 `breaks` 옵션 — 미사용 유지. 일반 단락의 `\n` 시맨틱 무결(REQ-003).
- 기존 플러그인 — dataLinePlugin·tableScrollPlugin·imageResolverPlugin·mermaidPlugin·KaTeX·Shiki·SVG-restore 모두 무간섭.
- `renderMarkdown`(@MX:ANCHOR, fan_in >= 3) 공용 API — 엑스포트(HTML/PDF) 경로가 동일 함수를 사용하므로 본 SPEC 변환이 자동 적용.

### plan.md 대비 편차

1. **별도 파일 대신 인라인 구현**: `tableCellLineBreakPlugin`을 별도 `tableCellLineBreakPlugin.ts` 파일이 아닌 `renderer.ts`에 인라인으로 구현. 근거: 기존 패턴 일관성(dataLinePlugin·tableScrollPlugin·imageResolverPlugin이 모두 renderer.ts 인라인), 플러그인 크기 약 90줄로 분리 임계치 미달, 과업 지시가 "Add a new markdown-it plugin in src/lib/markdown/renderer.ts"를 명시. mermaidPlugin만 복잡도로 인해 별도 파일.
2. **`ruler.after` 대신 자연 `md.use` 순서**: 명시적 `md.core.ruler.after('data_line', ...)` 대신 `md.use(dataLinePlugin)` 호출 이후 `md.use(tableCellLineBreakPlugin)` 호출하는 자연 순서에 의존. plan.md review note가 이 대안을 허용했으며, DP4 요구사항(table_cell_br이 data_line 이후 실행)을 동일하게 만족.
