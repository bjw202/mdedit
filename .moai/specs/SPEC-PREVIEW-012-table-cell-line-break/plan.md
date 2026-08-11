# SPEC-PREVIEW-012 — 구현 계획

> 본 문서는 WHAT/WHY(spec.md)에 대한 HOW를 다룬다. 확정된 기술 결정과 브라운필드 변경 지도, @MX 태그 대상을 기록한다. Given-When-Then 수용 시나리오는 acceptance.md 참조. 모든 DP(결정점)는 사용자 확정 후 본 파일에 확정값으로 고정한다.

## 확정 기술 결정 (Locked Decisions)

> 아래 결정은 spec.md Decision Points의 권장안이다. Run phase 진입 전 사용자 승인으로 확정된다.

| # | 결정 | 내용 | 근거 |
|---|------|------|------|
| D1 | **마커 = 리터럴 `<br>`/`<br/>`/`<br />` 인터셉트** | 사용자가 표 셀 안에 적은 리터럴 `<br>`(및 셀프클로징 변형) 텍스트를 찾아 markdown-it `hardbreak` 토큰으로 교체한다. 속성 포함 형태(`<br foo>`)는 매칭하지 않는다. | GitHub·GitLab 호환 문법. `html:false` 유지. 출력 `<br>`는 markdown-it이 생성(사용자 원시 HTML 도달 없음). |
| D2 | **적용 범위 = 표 셀 컨텍스트(td/th) 한정** | 변환은 `td_open`/`th_open` ~ `td_close`/`th_close` 범위의 `inline` 토큰 자식에게만 적용. 단락·코드블록·인라인 코드는 제외. | 전역 시맨틱 무결(REQ-002·003·004). 코드 컨텍스트 자연 보호. |
| D3 | **구현 지점 = `core.ruler` 토큰 조작** | `md.core.ruler.push('table_cell_br', fn)`로 등록. inline 자식을 walk해 text 토큰을 분할하고 사이에 `hardbreak` 토큰 삽입. 문자열 전처리(post-render substitution) 방식은 미사용. | 토큰 단위 조작이 문자열 치환보다 안전(이스케이프 충돌 없음). `dataLinePlugin`과 동일한 코어 룰 체인 방식. SVG 선례(SPEC-PREVIEW-008)는 문자열 기반이지만 표 셀은 토큰 경계가 명확해 토큰 조작이 더 자연스럽다. |
| D4 | **실행 순서 = `data_line` 직후** | `md.core.ruler.push('table_cell_br', fn)`를 `dataLinePlugin` 이후에 실행되도록 등록. `ruler.push`는 체인 끝에 추가하며, renderer.ts에서 `dataLinePlugin`을 먼저 `md.use`하므로 자연 순서가 보장된다. 명시적 보장이 필요하면 `ruler.after('data_line', 'table_cell_br', fn)` 사용(검토 사항). | `data_line`은 블록 토큰 속성만 건드리고 inline은 건드리지 않아 순서 의존성 없음. 그러나 향후 플러그인 추가 시 순서 드리프트를 방지하기 위해 명시적 등록 권장. |
| D5 | **DOMPurify 의존 = 없음** | `<br>`는 markdown-it의 `hardbreak` 렌더 규칙이 생성하므로 사용자 원시 HTML이 출력에 도달하지 않음. 메인 HTML 경로는 DOMPurify를 거치지 않음(소스 검증 완료, spec.md Security 참조). | SVG 경로(SPEC-PREVIEW-008)와 달리 사용자 원시 HTML이 아예 없으므로 DOMPurify 불필요. |
| D6 | **`hardbreak` 토큰 직접 생성** | markdown-it `Token` 생성자로 `hardbreak` 토큰을 직접 생성해 inline children 배열에 삽입. markdown-it 기본 렌더 규칙이 `<br>\n`을 출력. | 표준 토큰 타입을 재사용해 커스텀 렌더 규칙 불필요. 구현 세부(생성자 시그니처)는 run phase에서 확정. |
| D7 | **`<br>` 정규식 = 속성 거부** | 매칭 정규식: `/<br\s*\/?>/i`(단순 형태만). `<br foo="bar">`, `<br onload="...">` 등 속성 포함 형태는 매칭하지 않음. | XSS 벡터 원천 차단. 속성이 없는 void 요소만 허용. |

## 구현 마일스톤 (우선순위 순, 시간 추정 없음)

### M1 (우선순위: High) — 코어 플러그인 구현 + 단위 테스트

- `tableCellLineBreakPlugin`(가칭, `src/lib/markdown/tableCellLineBreakPlugin.ts`) 함수 신규 작성:
  - `md.core.ruler.push('table_cell_br', fn)`로 등록.
  - 토큰 스트림 순회: `td_open`/`th_open` 진입 → 다음 `td_close`/`th_close`까지의 `inline` 토큰 찾기.
  - inline 자식 walk: `text` 토큰 안에서 `/<br\s*\/?>/i` 매칭 → 토큰을 분할(text 앞부분 + `hardbreak` + text 뒷부분)해 children 배열 교체.
  - 코드 컨텍스트(`code_inline` 등) 자식은 건너뜀(REQ-004).
  - try/catch로 감싸 예외 시 원본 반환(REQ-006).
- renderer.ts에 플러그인 import·`md.use(tableCellLineBreakPlugin)` 추가(`dataLinePlugin` 등록 직후).
- 단위 테스트(`renderer.test.ts`에 `describe('renderMarkdown: table cell line break (SPEC-PREVIEW-012)', ...)` 블록 신규 추가):
  - 표 셀 안 `<br>` → `<br>\n` 렌더 확인.
  - `<br/>`·`<br />` 셀프클로징 변형 확인.
  - 단락·코드블록·인라인 코드 안 `<br>`는 변환되지 않음(이스케이프 유지) 확인.
- 검증: 시나리오 A·B·C·D·E.

### M2 (우선순위: High) — 엣지 케이스 및 회귀 가드

- 속성 포함 `<br>` 매칭 거부 테스트(`<br foo="bar">`, `<br onload="alert(1)">`는 이스케이프 유지).
- `</br>` 비표준 닫기 태그 거부 테스트.
- 다중 `<br>` 연속(`a<br><br>b`) 처리.
- 셀 시작/끝의 `<br>` 엣지 케이스(`| <br>a |` 등).
- 표 셀 안 굵게/기울임과 `<br>`의 조합(`| **a**<br>**b** |`).
- `dataLinePlugin` 회귀: 표 블록 `data-line` 속성 유지 확인.
- `tableScrollPlugin` 회귀: `<div class="table-scroll-wrapper">` 래핑·셀 보더 스타일 유지 확인.
- `imageResolverPlugin` 회귀: 표 셀 안 이미지 문법 `![](img.png)`가 여전히 imageResolver를 거쳐 `asset://`로 변환되는지 확인.
- 기존 표 렌더 테스트(renderer.test.ts:80-94) 무변경 통과 확인.
- 검증: 시나리오 F·G·H.

### M3 (우선순위: Medium) — @MX 태그 부여 및 문서화

- 신규 플러그인 함수에 다음 태그 부여:
  - `@MX:NOTE`: "`html:false` 유지하에 표 셀 리터럴 `<br>`를 `hardbreak` 토큰으로 교체. 단락·코드 컨텍스트는 미적용(REQ-002~004)."
  - `@MX:SPEC: SPEC-PREVIEW-012`.
  - `@MX:WARN`: "속성 포함 `<br>` 매칭을 허용하면 XSS 벡터. 정규식은 반드시 `/<br\s*\/?>/i` 속성 거부 패턴 유지." + `@MX:REASON`.
- renderer.ts의 `renderMarkdown` 기존 `@MX:ANCHOR`·`@MX:SPEC`에 SPEC-PREVIEW-012 추가.
- `html:false` 라인의 기존 `@MX:WARN`(renderer.ts:288-291)은 무변경(본 SPEC이 전환하지 않음 명시).

## [DELTA] Brownfield Change Map

| 분류 | 대상 | 변경 내용 |
|------|------|-----------|
| [NEW] | `src/lib/markdown/tableCellLineBreakPlugin.ts`(가칭) | 신규 플러그인 모듈. `md.core.ruler.push('table_cell_br', fn)`로 등록. inline 자식 walk → text 토큰 분할 → `hardbreak` 삽입. 속성 포함 `<br>`는 매칭 거부(D7). try/catch로 예외 시 원본 반환(REQ-006). |
| [MODIFY] | `src/lib/markdown/renderer.ts` | import 추가. `md.use(tableCellLineBreakPlugin)`를 플러그인 등록 블록(renderer.ts:315-328 근방)에 추가. 순서: `dataLinePlugin` 직후 권장(D4). `html:false` 라인은 무변경(@MX:WARN 유지). `renderMarkdown`의 기존 `@MX:ANCHOR`·`@MX:SPEC`에 SPEC-PREVIEW-012 추가. |
| [MODIFY] | `src/test/renderer.test.ts` | `describe('renderMarkdown: table cell line break (SPEC-PREVIEW-012)', ...)` 블록 신규 추가. 시나리오 A~H 단위 테스트. 기존 테스트는 무변경(회귀 기준선). 기존 mock(`@tauri-apps/api/core`, `shiki`, `mermaid`) 재사용. |
| [EXISTING] | `src/components/preview/PreviewRenderer.tsx` | 변경 없음 — 메인 HTML 경로는 DOMPurify 미사용(D5). |
| [EXISTING] | `src/lib/preview/svgSanitize.ts` | 변경 없음 — SVG 경로와 무관. |
| [EXISTING] | `src/lib/markdown/mermaidPlugin.ts` | 변경 없음 — mermaid 컨테이너와 무관. |
| [EXISTING] | `src/lib/image/imageResolver.ts`(renderer.ts 내 imageResolverPlugin) | 변경 없음 — 본 규칙과 충돌 없음(시나리오 H로 검증). |
| [EXISTING] | `src/components/preview/MarkdownPreview.tsx`, `HtmlFileViewer.tsx`, `CodeFileViewer.tsx` | 변경 없음 — `renderMarkdown` 공용 API 출력이 변경되어도 컴포넌트는 그대로 소비. |
| [EXISTING] | 엑스포트 경로(`exportHtml`, `exportDocx`) | 변경 없음 — `renderMarkdown`을 공용으로 쓰므로 변환이 자동 적용. |

## @MX Tag Targets

- **`tableCellLineBreakPlugin` (신규)** — 신규 코어 룰.
  - `@MX:NOTE`: "`html:false` 유지하에 표 셀 리터럴 `<br>`를 `hardbreak` 토큰으로 교체. 단락·코드 컨텍스트는 미적용."
  - `@MX:SPEC: SPEC-PREVIEW-012`.
  - `@MX:WARN`: "속성 포함 `<br>` 매칭을 허용하면 XSS 벡터. 정규식은 반드시 속성 거부 패턴 유지." + `@MX:REASON`.
  - `@MX:ANCHOR` 후보(fan_in 관점): 현재는 `renderer.ts` 한 곳에서만 `md.use`되므로 fan_in = 1 → ANCHOR 미달. 향후 다른 진입점(엑스포트 등)이 직접 참조하면 승격.
- **`renderer.ts` `renderMarkdown`** — 이미 `@MX:ANCHOR`(fan_in >= 3, @MX:SPEC: SPEC-PREVIEW-001).
  - `@MX:SPEC`에 SPEC-PREVIEW-012 추가.
  - 플러그인 등록 라인에 `@MX:NOTE` 추가: "tableCellLineBreakPlugin은 data_line 직후 실행, inline 자식만 조작".
- **markdown-it 생성자 라인(renderer.ts:286-308)** — 본 SPEC이 `html:false`를 건드리지 않으므로 기존 `@MX:WARN`·`@MX:REASON` 유지.

## 리스크 및 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| `<br>` 정규식이 속성을 실수로 매칭해 XSS 허용 | 높음(보안) | 정규식을 `/<br\s*\/?>/`로 고정(속성 거부, D7). `<br onload=...>`가 변환되지 않음을 가드 테스트로 고정(M2, 시나리오 F). |
| 토큰 분할 시 이스케이프 규칙 위반해 셀 콘텐츠 깨짐 | 중간 | 분할 후 나머지 텍스트를 새 `text` 토큰으로 생성해 markdown-it이 다시 이스케이프하도록 위임. 기존 표 렌더 테스트 기준선로 회귀 확인(M2). |
| markdown-it 메이저 버전업(14.1.1 → 15.x) 시 `hardbreak` 토큰 생성자 시그니처 변경 | 낮음 | markdown-it 14.1.1 핀 권장. 가드 테스트로 시그니처 고정(M2). |
| 표 셀 밖 단락에서 실수로 변환 적용 | 중간 | `td_open`/`th_open` 컨텍스트 추적 로직을 가드 테스트로 고정(시나리오 C, 단락·인용·목록에서 미변환). |
| `data-line` 속성과 충돌해 스크롤 동기화 회귀 | 낮음 | 본 규칙은 inline 자식만 조작, 블록 토큰 `map` 불변. 기존 data-line 테스트 기준선로 확인(M2, 시나리오 H). |
| `tableScrollPlugin`의 보더 인라인 스타일이 분할된 셀에서 깨짐 | 낮음 | `td_open`/`th_open` 토큰 자체는 건드리지 않으므로 충돌 없음 예상. 회귀 테스트로 확인(M2). |
| 링크 파싱·`typographer`가 `<br>` 주변 텍스트를 변형 | 낮음 | 회귀 테스트로 확인(M2). |

## 검증 게이트

- 본 저장소 게이트: **tsc + vitest + Playwright**(eslint 포함 — PR #37 이후 `.eslintrc.cjs` 추가로 lint 실패는 진짜 결함).
- 본 SPEC은 렌더 단위 변환이므로 **Vitest가 주된 게이트**(문자열 입력 → HTML 출력 단언). Playwright는 선택(포인터 상호작용 없음).
- must-pass: 시나리오 A(핵심 변환)·C(단락 미변환)·D(코드 보호)·F(속성 거부/XSS)·H(회귀). acceptance.md 테스트 매핑 참조.
