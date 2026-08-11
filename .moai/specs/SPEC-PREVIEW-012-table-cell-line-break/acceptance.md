# SPEC-PREVIEW-012 — 수용 기준

> 게이트 = tsc + vitest(+ eslint). 렌더 단위 변환은 Vitest로 충분(문자열 입력 → HTML 출력). 포인터 상호작용 없음. 보안 시나리오(F)와 회귀(H)가 must-pass.

## 사전 준비

- **픽스처(마크다운 문자열)**:
  - 기본 표: `| a<br>b | c |\n|---|---|\n| d | e |`(한 셀에 `<br>` 하나)
  - 셀프클로징: `| a<br/>b | c |`, `| a<br />b | c |`
  - 다중: `| x<br><br>y | z |`(연속 `<br>`)
  - 헤더 셀: `| H1<br>H2 |\n|---|---|\n| a | b |`
  - 굵게/기울임 조합: `| **a**<br>**b** | c |`
  - 셀 시작/끝 엣지: `| <br>a | b |`, `| a<br> | b |`
  - 단락(표 외부): `plain <br> text`
  - 인용·목록: `> quote <br> text`, `- list <br> item`
  - 코드펜스: ` ```\n<br>\n``` `(언어 미지정)
  - 인라인 코드: `` `a<br>b` ``(백틱)
  - 속성 포함: `| a<br onload="alert(1)">b | c |`, `| a<br foo="bar">b | c |`
  - 비표준 닫기: `| a</br>b | c |`
  - 회귀용 복합 마크다운: 인라인 수식 `$a^2$` + 표 `<br>` + 이미지 `![](img.png)` 혼합
- **mock**: `src/test/renderer.test.ts` 기존 mock 재사용(`@tauri-apps/api/core`의 `convertFileSrc`·`invoke`, `shiki`의 `createHighlighter`, `mermaid`의 `initialize`·`render`). 신규 mock 불필요.
- **DOMPurify 검증(참고사항)**: 본 SPEC은 DOMPurify 미의존(DP3). `<br>`가 DOMPurify 기본 허용 태그임은 향후 전체 sanitize 도입 시 회귀 방어용으로 기록. 현재 메인 경로 테스트에는 DOMPurify 불필요.

---

## 기능 시나리오

### 시나리오 A: 표 셀 안 `<br>`을 줄바꿈으로 렌더 (REQ-001, 002) — must-pass

- **Given** 마크다운 `| a<br>b | c |\n|---|---|\n| d | e |` 가 주어지고
- **When** `renderMarkdown(content, null)` 로 렌더하면
- **Then** 첫 번째 데이터 셀(`<td>`)의 HTML이 `a<br>\nb` 또는 `a<br>b`(markdown-it `hardbreak` 표준 출력; `<br>` 후 선택적 개행)를 포함하고
- **And** 사용자가 쓴 리터럴 `<br>` 텍스트는 더 이상 이스케이프 형태(`&lt;br&gt;`)로 나타나지 않는다.
- **And** 변환이 `core.ruler` 체인에서 수행되었는지는 출력 단언으로 간접 검증(플러그인 등록 여부 자체는 구현 세부).

### 시나리오 B: 셀프클로징 변형 지원 (REQ-001)

- **Given** `| a<br/>b | c |` 와 `| a<br />b | c |` 가 각각 주어지고
- **When** 렌더하면
- **Then** 두 경우 모두 `<br>\n`(또는 동등한 hardbreak 출력)로 변환되고
- **And** `&lt;br/&gt;`·`&lt;br /&gt;` 가 잔존하지 않는다.

### 시나리오 C: 단락의 `<br>` 텍스트는 변환하지 않음 (REQ-003) — must-pass

- **Given** 마크다운 `plain <br> text`(단락, 표 외부)가 주어지고
- **When** 렌더하면
- **Then** 출력이 `&lt;br&gt;` 를 포함하고
- **And** `<br>` 태그(실제 HTML 요소)는 포함하지 않는다(기존 동작 유지).
- **And** 인용·목록에서도 동일하게 미변환(`> quote <br> text`, `- list <br> item`).

### 시나리오 D: 코드 영역의 `<br>` 텍스트는 보호 (REQ-004) — must-pass

- **Given** 코드펜스(언어 미지정) 안 `<br>` 텍스트와 인라인 코드 스판 안 `<br>` 텍스트가 각각 주어지고
- **When** 렌더하면
- **Then** 코드펜스 안 `<br>`는 이스케이프된 코드 텍스트(`&lt;br&gt;`)로 표시되고
- **And** 인라인 코드 안 `<br>`도 `<code>&lt;br&gt;</code>` 로 변환되지 않은 채 보존된다.
- **And** 표 셀 안에 인라인 코드 `` `a<br>b` `` 가 있어도 인라인 코드 안의 `<br>`는 변환되지 않는다(표 셀 컨텍스트 안에서도 코드 보호 우선).

### 시나리오 E: 헤더 셀(th)에서도 변환 (REQ-001, 002)

- **Given** `| H1<br>H2 |\n|---|---|\n| a | b |` 가 주어지고
- **When** 렌더하면
- **Then** `<th>` 안에 `<br>\n` 이 포함되고
- **And** `H1`·`H2` 가 줄바꿈으로 분리된다.

### 시나리오 F: 속성 포함 `<br>`는 변환 거부 → XSS 차단 (REQ-005, 006) — must-pass (보안)

- **Given** `| a<br onload="alert(1)">b | c |` 와 `| a<br foo="bar">b | c |` 가 각각 주어지고
- **When** 렌더하면
- **Then** `<br onload=...>` 와 `<br foo=...>` 는 매칭되지 않아 이스케이프 형태(`&lt;br onload=...&gt;`)로 표시되고
- **And** 실제 `<br>` HTML 태그가 DOM에 주입되지 않으며
- **And** `onload` 등 이벤트 핸들러 속성이 바인딩되지 않는다(`html:false`가 속성 포함 원시 HTML을 이스케이프).
- **And** 변환 중 예외가 발생해도 앱이 중단되지 않고 원본 텍스트가 유지된다(REQ-006).

### 시나리오 G: 비표준 닫기 태그 `</br>` 거부 (REQ-005)

- **Given** `| a</br>b | c |` 가 주어지고
- **When** 렌더하면
- **Then** `</br>` 는 매칭되지 않아 이스케이프 형태로 표시되고
- **And** 줄바꿈이 발생하지 않는다(`<br>`는 void 요소, `</br>`는 비표준).

### 시나리오 H: 기존 플러그인 회귀 차단 (REQ-007) — must-pass

- **Given** 아래 마크다운이 주어지고:
  ```
  | col1 | col2 |
  |---|---|
  | ![img](pic.png) | text |
  ```
- **When** 렌더하면
- **Then** `data-line` 속성이 표 블록(`<table>`)에 여전히 주입되고(SPEC-PREVIEW-002 회귀)·
- **And** `<div class="table-scroll-wrapper">` 래핑이 유지되며(`tableScrollPlugin` 회귀)·
- **And** 표 셀 안 이미지가 여전히 imageResolver를 거쳐 `asset://` URL로 변환된다(mdFilePath 전달 시, `imageResolverPlugin` 회귀).
- **And** 기존 표 렌더 테스트(renderer.test.ts:80-94, "renders table correctly with inline border styles")가 무변경으로 통과한다.
- **And** 인라인 SVG(SPEC-PREVIEW-008) 마커가 표 셀 안에서도 정상 동작한다(혼합 콘텐츠 회귀 점검).

---

## 테스트 매핑 (REQ → 시나리오 → 도구)

| REQ | 시나리오 | 도구 | must-pass |
|-----|----------|------|-----------|
| REQ-PREVIEW012-001 | A, B, E | Vitest(`renderMarkdown` 출력 문자열 단언) | Y(A) |
| REQ-PREVIEW012-002 | A, E | Vitest(td/th 컨텍스트 추적 단언) | Y(A) |
| REQ-PREVIEW012-003 | C | Vitest(단락·인용·목록 `<br>` 미변환) | Y |
| REQ-PREVIEW012-004 | D | Vitest(코드펜스·인라인 코드 보호, 표 셀 내 인라인 코드도 보호) | Y |
| REQ-PREVIEW012-005 | F, G | Vitest(속성 거부·비표준 거부) | Y(F) |
| REQ-PREVIEW012-006 | F | Vitest(예외 시 원본 유지 — 속성 포함 `<br>` 케이스로 간접 검증) | Y |
| REQ-PREVIEW012-007 | H | Vitest(data-line·tableScrollPlugin·imageResolver·인라인 SVG 회귀) | Y |

## Definition of Done

- [ ] 시나리오 A~H 전체 통과, must-pass(A·C·D·F·H) 100%.
- [ ] `tsc` 0 에러, `vitest` 전체 그린(`renderer.test.ts` 신규 블록 포함).
- [ ] `eslint` 0 에러(PR #37 이후 lint는 게이트; 신규 파일·소량 수정이므로 회귀 가능성 낮음).
- [ ] 속성 포함 `<br onload="alert(1)">` 픽스처에서 XSS 미발생 가드 고정(시나리오 F).
- [ ] 기존 표 렌더·data-line·tableScrollPlugin·imageResolver·인라인 SVG 회귀 없음(시나리오 H).
- [ ] `html:false`(renderer.ts:292) 무변경 확인.
- [ ] 전역 `breaks` 옵션 미전환 확인(`md.set('breaks', true)` 등의 코드가 추가되지 않았음을 확인).
- [ ] 단락·코드블록·인라인 코드의 `<br>` 텍스트가 이스케이프 상태로 유지됨 확인(시나리오 C·D).
- [ ] 비표준 `</br>` 닫기 태그가 매칭되지 않음 확인(시나리오 G).
- [ ] 신규 플러그인 모듈에 @MX 태그 부여(`@MX:NOTE`·`@MX:SPEC`·`@MX:WARN`[속성 거부 정책] + `@MX:REASON`).
- [ ] `renderMarkdown` 기존 `@MX:ANCHOR`·`@MX:SPEC`에 SPEC-PREVIEW-012 추가.

## Open Verification Items (run phase에서 확인)

- markdown-it 14.1.1의 `hardbreak` 렌더 규칙 기본 출력이 정확히 `<br>\n`(xhtmlOut=false)인지 실측. 테스트 단언은 유연하게 작성(`<br>` 포함 여부로 우선 검증, 개행은 weak assertion).
- `md.core.ruler.push`의 실행 순서가 `dataLinePlugin` 등록 순서와 일치하는지 확인. 불일치 시 `ruler.after('data_line', ...)` 로 명시적 순서 보장.
- 표 셀 안 inline 토큰의 children 구조가 예상(text → strong_open → text → strong_close → text)과 일치하는지 run phase에서 디버그 로그로 확인 후 토큰 walk 로직 확정.
