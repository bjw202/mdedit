---
id: SPEC-PREVIEW-015
title: "Mermaid 렌더러를 pele로 전면 교체 — 미리보기·AI 검증·내보내기를 한 엔진으로"
version: "0.4.3"
status: in-progress
created: 2026-10-26
updated: 2026-10-26
author: jw (bjw202)
priority: High
phase: "v0.17.0 target"
module: lib/diagram
lifecycle: spec-anchored
tags: "preview, diagram, mermaid, pele, export, theme, security, dependency"
tier: L
issue_number: 0
related_specs: [SPEC-PREVIEW-006, SPEC-PREVIEW-010, SPEC-UI-008, SPEC-AI-001, SPEC-AI-008, SPEC-EXPORT-001, SPEC-EXPORT-004]
---

# SPEC-PREVIEW-015: Mermaid 렌더러를 pele로 전면 교체

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-10-26 | jw | 최초 작성. 사용자 결정(2026-10-26): `mermaid` 11.12.3과 그 패치(`patches/mermaid+11.12.3.patch`, `patch-package`, `postinstall`)를 npm `pele` **1.10.0 정확 고정**으로 전면 교체한다. 두 라이브러리 병행·설정 토글·mermaid 폴백은 두지 않는다. 입력 언어는 Mermaid 문법 그대로이며 Rust AI 프롬프트(`src-tauri/src/ai/prompt.rs`)는 바꾸지 않는다. M1 시험 렌더링 보고서를 사용자가 읽고 통과를 결정한 뒤에만 M2 이후 교체 작업을 한다(사람 게이트). 근거 조사: 같은 폴더 `research.md`, 타당성 보고서 `.moai/reports/mermaid-pele-feasibility-2026-10-24.md`(주 체크아웃). |
| 0.2.0 | 2026-10-26 | jw | plan-audit iteration 1(FAIL 0.76) 결함 D1–D12 반영. `images: false` 고정(사용자 결정)을 고정 옵션에 추가. Tier L 산출물 `design.md` 신설 — 확정 결정 D1–D15와 Design Note를 옮김. 내보내기 색은 모든 `var(--pele-…)`를 내보내기 테마의 실제 값으로 치환하는 한 가지 방식으로 정함(D6, AC-020 이진 확인). REQ-012: 검증은 미리보기와 같은 렌더 함수·같은 옵션으로 하고 `error`는 `PeleError.message`와 같음. REQ-023: 픽스처 매니페스트에 캡처 환경·측정기 기록, 바이트 비교는 같은 측정기 픽스처끼리만. Exclusions에 수식 라벨 미지원 추가. 수용 기준: AC-024를 개정 대상 줄만 검사하도록 좁힘, AC-002 측정기 범위, AC-006 추적 보정, AC-011 관찰 방법, AC-014 메시지 동일성, AC-017 내보낸 HTML `id` 중복 검사, 통과형 감시 래퍼 허용 명시. REQ 24건·AC 24건 유지. plan-audit iteration 2(PASS 0.91) 소견 N1–N5 반영: PREVIEW-010 REQ-003 행을 "교체"로 바로잡고 `REQ-PREVIEW010-002`를 명시, PREVIEW-006 REQ-006 개정 행과 AC-024 검사 행 추가, USER_GUIDE 인용 줄을 `:206-208`로 수정, AC-UI-008-004 대체 Given/When/Then 전문 제시, plan.md M6에 완료 SPEC(EXPORT-004) 편집 전 `moai spec audit` 확인 절차 추가. |
| 0.3.0 | 2026-10-26 | jw | M1 판정 반영(사용자 통과 판정, 근거 `m1/checks.md`·`m1/report.html`). `responsive: true` 고정(REQ-002, AC-004). 내보내기 색: HTML·PDF는 내보내기 테마, DOCX는 항상 라이트 값(REQ-018, AC-020). 오류 위치 접미사를 "line·column 모두 있음 → `(L행 C열)`, 그 밖에는 접미사 없음" 두 갈래로 정리(REQ-009, AC-007 — M1에서 "line만 있음" 0건/6,264). 다이어그램 안 수식은 사용자 결정에 따라 pele `math` 옵션을 기존 `katex`에 연결하는 것으로 정함 — 잠정 REQ-025·AC-025 추가, 최종 문구는 plan.md M1b 보강 측정·게이트 뒤 확정(REQ-003·Exclusions·D4·D15). design.md에 D5 변수 목록·`fontFamily` M2 확인 항목, D14 측정기 `jsdom-default`, 받아들인 배치 변화(§3) 기록. REQ 25건·AC 25건(Tier L 상한 25). |
| 0.4.0 | 2026-10-26 | jw | M1b 판정 반영(사용자 통과 판정, 근거 `m1/checks.md` "M1b"·`m1/report-m1b.html`). REQ-025·AC-025의 잠정 표시를 지우고 최종 문구로 확정: 해석기는 KaTeX `output:'mathml'`에서 바깥 `.katex` span을 걷어 낸 `mathml-bare`(`trust:false` 유지, HTML 출력은 webkit 어긋남·CSS+글꼴 386,784 B로 탈락), 크기는 브라우저 `getBoundingClientRect` 측정. REQ-003: 다이어그램 정화는 별도 `DOMPurify(window)` 인스턴스에서 href 차단 훅을 다시 등록하고 `HTML_INTEGRATION_POINTS: {foreignobject: true}`로 수식 허용 목록만 더함(전역 인스턴스 훅 누수 43회 측정), 공유 `sanitizeSvg`는 M1 픽스처와 바이트 동일. HTML·PDF는 KaTeX CSS·글꼴 불필요, DOCX는 별도 대체안 없음. CSP는 "다이어그램 수식으로 생기는 새 위반 0"(기존 KaTeX_Size3 결함은 범위 밖, 백로그 `t1`). Exclusions(수식 라벨) 최종 문구. REQ 25건·AC 25건 유지. |
| 0.4.1 | 2026-10-26 | jw | plan-audit 3회차 반영(FAIL 0.85, `.moai/reports/plan-audit/SPEC-PREVIEW-015-review-3.md`). D2: 공유 `sanitizeSvg` 훅을 다이어그램 경로의 방어선으로 적은 곳을 모두 "다이어그램 전용 정화 경로(별도 DOMPurify 인스턴스, 재등록한 href 훅)"로 고치고, M6이 7개 SPEC에 옮겨 적는 "strict 모드" 공통 정의를 그 자체로 완결된 문구로 다시 씀. D1: AC-005를 감시 없는 출력 비교(수식 없는 `unit/` 픽스처에서 두 경로 결과 바이트 동일, M2 첫 확인)로 다시 씀. D8: `fontFamily`를 고정 옵션에 넣고(REQ-002, AC-004) M2에서 `unit/` 픽스처를 다시 캡처하는 규칙으로 정함. D4: 픽스처 출처(M1·M2)와 수식 픽스처 크기 결정 방법을 매니페스트 계약에 넣음(REQ-023, AC-002). D5: AC-025 CSP 확인이 이벤트와 콘솔 거부를 각각 셈. D6: 엔티티 근거를 M1 측정(출력 바이트 동일)으로 고침. D7: REQ-003 추적에 AC-025 추가, 전역 설정 무변경 단언. D10: 수식 다이어그램의 PDF·색 치환 확인 추가. REQ 25건·AC 25건 유지. |
| 0.4.2 | 2026-10-26 | jw | plan-audit 4회차 반영 (PASS-WITH-DEBT 조건 해소, 0.88, `.moai/reports/plan-audit/SPEC-PREVIEW-015-review-4.md`). N1: M1 `unit/` 캡처 38쌍을 다시 캡처하지 않는 고정 기준 묶음 `src/test/fixtures/pele/m1-frozen/`(매니페스트 `frozen: true`)으로 두고, REQ-003·AC-005·AC-025 4번·design.md D4·D5·D14의 공유 `sanitizeSvg` 비교 기준을 그 묶음으로 통일. N2: "strict 모드" 공통 정의의 추가 허용 목록을 REQ-003·D4와 같게(`foreignObject.pele-math`·감싸기 `div`·MathML 태그·`semantics`·`annotation[encoding]`). N3: M7 MX 문구를 MX 표 기준으로. N4: AC-020 수식 다이어그램에 크기 주입과 `foreignObject.pele-math` 존재 전제 추가. N5: AC-025 CSP를 기준 렌더 이하 비교로. N6·N7: `fontFamilyMono`를 고정 옵션에 추가하고 두 글꼴 상수를 기준으로 CSS 리터럴과 문자열 비교. N8: 위험 행·결정 이력 정리, M2에서 `browser/`도 다시 캡처. REQ 25건·AC 25건 유지. |
| 0.4.3 | 2026-10-26 | jw | run-phase M6. design.md D6에 라이트 색 값 읽기 방식을 적었다 — 라이트 값은 `data-theme="light"`를 단 임시 요소로 읽으며, 이를 위해 `src/styles/mdedit-tokens.css`의 라이트 토큰 블록 선택자가 `[data-theme="light"], :root`로 바뀌었다(커밋 828dd92, 사용자 유지 결정 2026-10-26). 같은 M6에서 "다른 SPEC 개정" 표대로 7개 SPEC 본문을 고쳤다(기록은 progress.md §E.2 "M6"). REQ·AC 문구는 무변경, REQ 25건·AC 25건 유지. |

## Overview

### 배경

- 현재 미리보기·AI 검증·AI 카드 미니 렌더가 같은 mermaid 전역 설정(`initialize`)을 서로 덮어쓴다. AI 검증은 테마 없이 초기화하므로 다크 모드 미리보기가 라이트 색으로 그려질 수 있다(research.md §1.3).
- mermaid 출력은 어느 경로에서도 `sanitizeSvg`를 거치지 않는다(research.md §1.6).
- 서브그래프 제목 줄바꿈 문제를 패치로 막고 있어, 버전을 올릴 때마다 패치가 깨질 위험이 있다(SPEC-PREVIEW-006).
- 내보내기는 미리보기 DOM의 SVG를 복사한다. 그래서 (a) 에디터 단독 보기에서는 미리보기가 마운트되지 않아 다이어그램이 빠지고(`ResizablePanels.tsx:171-172`), (b) DOCX에서 중간 다이어그램 하나가 실패하면 뒤 이미지가 모두 앞 펜스로 한 칸씩 밀린다(`exportDocx.ts:134-144, 242`). 두 결함 모두 research.md §2에서 코드로 확인했다.

### pele 1.10.0 (2026-10-26 npm 레지스트리·API 문서 확인)

- `render(source, options?)`는 동기 호출이며 `{ svg, width, height, type, mermaidType, links }`를 돌려준다. `parse(text, options?)`가 있다.
- 실패는 `PeleError`(`code`: `unsupported-diagram` / `syntax` / `semantic` / `limit`, `line`·`column`은 1부터, 위치가 없으면 `0`)로 알린다.
- 관련 옵션 기본값: `responsive: true`(컨테이너에 맞춰 축소), `autoDirection: true`(`directionBreakpoint` 640px 미만에서 세로 배치로 전환), `links: true`, `images: true`.
- 색은 CSS 변수 `--pele-*`로 정한다. 테마 전환에 재렌더가 필요 없다. 라벨은 SVG `<text>`다. 수식 해석기(`math` 옵션)를 주지 않으면 `$$…$$`는 원문 글자로 나오고, 해석기가 HTML을 돌려주면 pele가 `<foreignObject class="pele-math">`로 감싼다(M1 측정, `node_modules/pele/dist/types.d.ts:5-14, 35`, design.md D15).

## Requirements (GEARS)

### A. 렌더 엔진과 안전

#### REQ-PREVIEW015-001: 다이어그램 엔진은 한 모듈에만 있다 (Ubiquitous)

- The diagram module(`src/lib/diagram/` 아래 모듈 하나) shall 미리보기, AI 검증, AI 카드 미니 렌더, 내보내기, 프리셋 검증이 다이어그램을 렌더하거나 검증하는 유일한 경로가 된다.
- The application source shall not 이 모듈 밖에서 `pele`를 import하거나, 어디에서든 `mermaid`를 import한다.

#### REQ-PREVIEW015-002: 렌더 옵션은 고정이다 (Ubiquitous)

- The diagram module shall 모든 pele 호출에 `autoDirection: false`, `links: false`, `images: false`, 그리고 `fontFamily`(일반 글꼴 상수)와 `fontFamilyMono`(고정폭 글꼴 상수)를 넘긴다. 두 상수가 글꼴 목록의 기준이며 M2에서 정한다. `mdedit-tokens.css`의 `--pele-font`·`--pele-font-mono`는 두 블록 모두 같은 글꼴 목록을 리터럴로 적는다(design.md D5).
- The diagram module shall `responsive: true`(M1 판정)로 고정하고, 호출자가 pele 옵션을 바꿀 수 있는 경로를 열지 않는다.

#### REQ-PREVIEW015-003: 출력은 정화를 거친다 — 공유 정화기는 그대로 (Ubiquitous, Unwanted)

- The diagram module shall pele가 만든 SVG를 문서(미리보기 DOM, AI 카드, 내보낸 파일)에 넣기 전에 다이어그램 전용 정화 경로로 정화한다. 이 경로의 기본 규칙은 `src/lib/preview/svgSanitize.ts`의 `sanitizeSvg`와 같고, 수식(REQ-PREVIEW015-025)을 위해 `foreignObject.pele-math`, pele가 만드는 감싸기 `div`, MathML 태그, `semantics`, `encoding` 속성이 있는 `annotation`만 더 허용한다.
- The diagram sanitize path shall 전역 DOMPurify 인스턴스가 아닌 **별도 인스턴스**(`DOMPurify(window)`)를 쓰고, 그 인스턴스에 href 차단 훅(`data:`·스킴 있는 외부 주소 제거)을 다시 등록한다.
- The diagram sanitize path shall not 전역 DOMPurify 인스턴스에 훅이나 설정을 추가한다.
- The diagram module shall not `svgSanitize.ts`의 공유 설정이나 훅을 바꾼다. SVG 파일 뷰어가 쓰는 `sanitizeSvg`의 결과는 M1 고정 기준 묶음(`src/test/fixtures/pele/m1-frozen/`, M1 `unit/` 캡처의 정화 전·후 38쌍을 M2 재캡처 전에 옮겨 둔 것, 다시 캡처하지 않음)의 정화 후 출력과 바이트 단위로 같아야 한다.

#### REQ-PREVIEW015-004: 오류 문구는 텍스트로만 넣는다 (Unwanted)

- The preview renderer shall not `PeleError` 메시지나 다이어그램 소스 문자열을 HTML로 해석되는 방식(`innerHTML`, HTML 문자열 결합)으로 문서에 넣는다. 오류·위치 문구는 텍스트 노드로만 넣는다.

#### REQ-PREVIEW015-005: 다른 렌더러로 되돌아가지 않는다 (Unwanted)

- The application shall not pele가 실패했을 때 mermaid나 다른 렌더러로 대신 그리거나, 렌더러를 고르는 설정·토글을 둔다.

### B. 미리보기

#### REQ-PREVIEW015-006: 미리보기는 같은 입력 문자열로 렌더한다 (Event-driven)

- **When** 미리보기 내용에 ` ```mermaid ` 펜스가 있으면, the preview renderer shall `mermaidPlugin`이 만든 `.mermaid-container`의 `data-diagram` 속성값(지금과 같은 이스케이프 계약 — `"`만 `&quot;`로 바꾸고 속성 파싱이 엔티티를 디코드한 문자열)을 pele 입력으로 써서 그 컨테이너에 SVG를 표시한다.
- The preview renderer shall `.mermaid-container`·`.md-diagram-placeholder` 클래스 이름과 컨테이너 배치를 바꾸지 않는다.
- **While** 한 문서에 다이어그램이 여러 개 있으면, the diagram module shall 각 SVG의 내부 `id`(마커·그라디언트 등)가 문서 안에서 겹치지 않게 렌더한다.

#### REQ-PREVIEW015-007: 최신 내용만 보인다 (Event-driven)

- **When** 미리보기 내용이 바뀌면, the preview renderer shall 그 시점 내용의 다이어그램만 표시하며, 이전 내용으로 시작한 렌더 결과가 새 결과를 덮어쓰지 않는다.
- The preview renderer shall 렌더할 때 모듈 밖에 공유되는 전역 렌더러 설정을 만들거나 바꾸지 않는다.

#### REQ-PREVIEW015-008: 테마 전환은 다시 그리지 않고 색만 바뀐다 (Event-driven)

- The application theme tokens shall `src/styles/mdedit-tokens.css`의 라이트(`:root`)와 다크(`[data-theme="dark"]`) 블록에 pele가 쓰는 `--pele-*` 변수를 기존 `--md-*` 토큰에 연결해 정의한다.
- **When** 사용자가 테마를 라이트·다크·system 사이에서 바꾸거나 system 모드에서 OS 색 구성이 바뀌면, the preview renderer shall 다이어그램 SVG를 다시 만들지 않고(같은 SVG 노드 유지) 새 테마 색으로 표시한다.
- **When** 다크 모드에서 미리보기가 처음 열리면, the preview renderer shall 라이트 색으로 먼저 그리지 않고 처음부터 다크 색으로 표시한다.

#### REQ-PREVIEW015-009: 문법 오류는 위치와 함께 알린다 (Event-driven, 실패 감지)

- **When** 비어 있지 않은 다이어그램 소스를 pele가 거부하면(`PeleError`), the preview renderer shall 그 컨테이너에 지금과 같은 마크업(`<p class="text-sm text-amber-500 italic py-2">`)으로 `⚠ Diagram syntax error`를 표시하고, 위치를 다음 규칙으로 덧붙인다.
  - `line ≥ 1`이고 `column ≥ 1`이면 `⚠ Diagram syntax error (3행 12열)` 형식
  - 그 밖의 경우(`line`이나 `column`이 `0`이거나 위치 정보가 없음)는 접미사 없이 `⚠ Diagram syntax error`
  - (M1 측정: pele 1.10.0은 위치를 "line·column 모두" 또는 "0/0"으로만 알렸다. design.md D9)
- **When** 한 다이어그램이 실패하면, the preview renderer shall 같은 문서의 다른 다이어그램과 나머지 미리보기를 그대로 렌더하고 앱을 중단시키지 않는다.

#### REQ-PREVIEW015-010: 빈 펜스 안내는 그대로다 (Event-driven)

- **When** `data-diagram` 문자열을 `trim()`한 결과가 비어 있으면, the preview renderer shall pele를 호출하지 않고 지금과 같은 `<p class="md-diagram-placeholder">다이어그램 문법을 입력하세요</p>`를 표시한다.

#### REQ-PREVIEW015-011: 다이어그램 안에는 이동할 링크도 외부 이미지도 없다 (Ubiquitous, Unwanted)

- The rendered diagram SVG shall `href`나 `xlink:href`를 가진 `<a>` 요소를 포함하지 않는다.
- The rendered diagram SVG shall not 외부 주소(`http:`·`https:`·`//`로 시작)를 가리키는 `href`·`xlink:href`를 가진 `<image>` 요소나 그 밖의 요소를 포함한다.
- **When** 사용자가 미리보기의 다이어그램 안을 클릭하면, the preview shall Tauri 웹뷰를 다른 주소로 이동시키지 않고 `openUrlInBrowser`도 호출하지 않는다.

### C. AI와 프리셋

#### REQ-PREVIEW015-012: AI 검증은 미리보기와 같은 엔진이다 (Ubiquitous, Event-driven)

- The `validateMermaid` function shall 지금과 같은 계약(비동기, `{ valid: boolean; error?: string }` 반환)을 지키며, 미리보기가 쓰는 diagram module의 **같은 렌더 함수를 같은 고정 옵션으로** 호출해 검증한다(pele `parse`만 따로 부르지 않는다). 그래서 검증을 통과한 코드는 미리보기에서도 렌더된다.
- The AI diagram flow shall `buildFallbackDecision`, `decideDiagramOutcome`, `stripMermaidFence`, `ensureMermaidFence`의 동작과, 1회 자동 재요청 후 목록 폴백 흐름(SPEC-AI-001 REQ-AI-024)을 바꾸지 않는다.
- **When** AI 응답이 지원하지 않는 다이어그램 종류이거나 문법 오류이면(예: `notarealdiagramtype foo!!!`), the `validateMermaid` function shall `valid: false`와, diagram module이 같은 소스로 만든 `PeleError.message`와 같은 문자열을 `error`로 돌려준다.

#### REQ-PREVIEW015-013: AI 카드 미니 미리보기도 같은 경로를 탄다 (Event-driven)

- **When** AI 카드가 `diagram-valid` 단계에 이르면, the AI suggestion card shall diagram module로 렌더하고 정화한 SVG를 `.mdedit-ai-mermaid-preview`에 표시하며, 그 색은 현재 앱 테마를 따른다.
- **When** 미니 렌더가 실패하면, the AI suggestion card shall 지금처럼 미리보기 영역을 비워 두고 카드의 다른 동작을 막지 않는다.

#### REQ-PREVIEW015-014: 삽입 프리셋 7종은 오류 없이 렌더된다 (Ubiquitous)

- The diagram module shall `DIAGRAM_PRESETS`(`keyboard-shortcuts.ts:194-257`)의 7종(flowchart, sequenceDiagram, gantt, classDiagram, stateDiagram-v2, pie, mindmap) body를 각각 오류 없이 렌더한다.
- The diagram insert menu shall 프리셋 body 문자열과 항목 8개(7종 + custom)를 바꾸지 않는다.

### D. 내보내기

#### REQ-PREVIEW015-015: 내보내기는 원본에서 다시 렌더한다 (Ubiquitous)

- The HTML, PDF, and DOCX exports shall 내보내기 시점의 마크다운 원본(`ExportOptions.content`)에 있는 각 mermaid 펜스를 diagram module로 렌더하며, 미리보기 DOM에서 SVG를 찾거나 복사하지 않는다.
- The exports shall 같은 펜스에 대해 미리보기가 pele에 넘기는 것과 같은 입력 문자열(REQ-006의 이스케이프 계약)을 넘긴다.

#### REQ-PREVIEW015-016: 에디터 단독 보기에서도 다이어그램이 내보내진다 (State-driven)

- **While** 보기 모드가 에디터 단독이어서 미리보기가 마운트되지 않았으면, the HTML, PDF, and DOCX exports shall 분할 보기에서 내보낸 것과 같은 다이어그램을 포함한다.

#### REQ-PREVIEW015-017: 실패한 다이어그램은 자기 자리만 차지한다 (Event-driven, 실패 감지)

- **When** 내보낼 문서의 한 mermaid 펜스가 빈 펜스이거나 pele에 거부되면, the exports shall 그 펜스 자리에만 형식별 대체 결과를 두고 다른 모든 펜스는 각자 자기 다이어그램을 유지한다(앞뒤로 밀리지 않음).
  - HTML·PDF: 그 자리의 `.mermaid-container`를 빈 채로 둔다(지금 동작).
  - DOCX: 그 자리에 펜스 코드 텍스트를 넣는다(지금 동작).

#### REQ-PREVIEW015-018: 내보낸 다이어그램의 색은 앱 밖에서도 남는다 (Ubiquitous)

- The HTML and PDF exports shall 내보내기 `theme` 옵션(`'light' | 'dark'`)에 해당하는 `--pele-*` 값을 실제 색 값으로 풀어 내보낸 SVG에 직접 넣는다. 그래서 앱 CSS가 없는 브라우저·인쇄에서도 다이어그램의 색과 글자가 보인다.
- The DOCX export shall 내보내기 `theme`과 상관없이 **라이트 테마**의 `--pele-*` 값을 풀어 넣은 SVG를 PNG로 바꾸며, 결과 PNG는 흰 페이지에서 글자와 색이 보인다(M1 사용자 판정, design.md D6).

#### REQ-PREVIEW015-019: DOCX 다이어그램 크기는 pele가 알려 준 크기를 따른다 (Ubiquitous)

- The DOCX export shall 다이어그램 이미지 크기를 pele가 돌려준 `width`·`height`에서 정하고 가로세로 비율을 지키며, 미리보기 확대(`zoom`)나 패널 폭에 영향을 받지 않는다.

#### REQ-PREVIEW015-020: 내보내기의 기존 안전 계약은 그대로다 (Ubiquitous)

- The HTML export shall not 내보낸 파일에 JavaScript를 넣는다(SPEC-EXPORT-001 REQ-EXPORT-020). 다이어그램은 정화한 인라인 SVG로만 들어간다(REQ-EXPORT-003).
- The exports shall SPEC-EXPORT-004의 이미지 임베드·누락 보고 동작과 `exportToHtml`·`exportToDocx`의 반환 계약(성공 시 경로, 취소 시 `null`)을 바꾸지 않는다.

### E. 의존성·검증·기록

#### REQ-PREVIEW015-021: 의존성 집합 (Ubiquitous)

- The `package.json` shall `pele`를 캐럿·틸드 없이 정확히 `"1.10.0"`으로 런타임 의존성에 둔다.
- The `package.json` shall not `mermaid`, `patch-package`, `postinstall` 스크립트를 담고, the repository shall not `patches/mermaid+11.12.3.patch`를 담는다.
- The `package.json` shall `dompurify`, `katex`, `@types/dompurify`를 그대로 두고, `pele` 외에 새 런타임 의존성을 추가하지 않는다.

#### REQ-PREVIEW015-022: 가드 테스트가 새 의존성을 고정한다 (Event-driven, 실패 감지)

- **When** `pele` 버전이 `1.10.0`에서 바뀌거나, `mermaid`가 다시 들어오거나, 런타임 의존성 집합이 정한 집합과 달라지면, the regression guard tests(`diagramRegressionGuard.test.ts`, `aiDiagramTypeRegressionGuard.test.ts`) shall 실패한다.

#### REQ-PREVIEW015-023: 교체는 시험 렌더링 판정 뒤에만 한다 (Ubiquitous)

- The replacement work shall 운영 코드(`src/` 아래 테스트·픽스처가 아닌 파일), `package.json`의 mermaid 항목, 패치 파일을 바꾸기 전에 M1 비교 보고서(plan.md M1)를 만들고, 사용자의 통과 결정이 기록된 뒤에만 진행한다.
- The unit-test fixtures for pele output shall 실제 pele 1.10.0 렌더 결과를 캡처한 것이어야 하며, 손으로 쓴 SVG를 pele 출력 픽스처로 쓰지 않는다. 각 픽스처에는 입력 소스, 옵션, pele 버전, 캡처 날짜, 캡처 환경(실행기와 버전), 글자 폭 측정기를 함께 기록하고, 수식 픽스처에는 수식 크기를 정한 방법(주입한 크기 값 또는 브라우저 측정)도 기록한다.
- The unit tests shall 픽스처와 바이트 단위로 비교할 때, 그 테스트와 **같은 측정기**로 캡처한 픽스처만 쓴다. 다른 측정기(예: 브라우저 캔버스)로 캡처한 픽스처는 구조 확인과 e2e 참고에만 쓴다(design.md D14).

#### REQ-PREVIEW015-024: 다른 SPEC과 문서를 새 엔진에 맞춘다 (Ubiquitous)

- The SPEC records shall 아래 "다른 SPEC 개정" 절의 요구 문구를 새 문구로 바꾸고, 각 SPEC의 HISTORY에 이 SPEC을 근거로 한 행을 남긴다.
- The user documentation shall `docs/USER_MANUAL.md` Mermaid 부록(`:498-665`)과 목차의 깨진 앵커(`:15`), `docs/USER_GUIDE.md:206-208`(`### Mermaid 다이어그램` 절), `README.md:15,104`를 pele 기준으로 고친다.

#### REQ-PREVIEW015-025: 다이어그램 안 수식을 KaTeX MathML로 그린다 (Event-driven)

- **When** 다이어그램 라벨에 `$$…$$` 수식이 있으면, the diagram module shall pele `math` 옵션(`MathResolver = (tex, size) => { svg | html, width, height }`, `node_modules/pele/dist/types.d.ts:5-14, 35`)에 기존 `katex` 의존성으로 만든 해석기를 넘겨 수식으로 렌더한다. 새 의존성은 추가하지 않는다.
- The math resolver shall KaTeX를 `output: 'mathml'`, `trust: false`로 호출하고, 결과에서 바깥 `<span class="katex">`를 걷어 낸 MathML(`mathml-bare`)을 `html`로 돌려준다. The math resolver shall not KaTeX HTML 출력(`output: 'html'`)을 쓴다.
- The math resolver shall `width`·`height`를 브라우저에서 pele의 감싸기 `div`와 같은 스타일로 문서에 붙여 `getBoundingClientRect`로 잰 값으로 돌려준다.
- The diagram sanitize path shall 수식 영역에서 `foreignObject.pele-math`, pele가 만드는 감싸기 `div`, MathML 태그, `semantics`, `encoding` 속성이 있는 `annotation`만 남기고, 그 밖의 `foreignObject`·`<script>`·이벤트 핸들러 속성·`javascript:`/`data:`/외부 href는 지운다(REQ-PREVIEW015-003).
- The HTML and PDF exports shall 다이어그램 수식을 KaTeX CSS나 글꼴 없이 표시하며, 다이어그램 수식 때문에 KaTeX CSS·글꼴을 내보낸 파일에 넣지 않는다.
- The DOCX export shall 같은 `mathml-bare` 출력을 지금의 SVG→PNG 변환 경로로 그리며, 별도 대체 방식을 두지 않는다.
- The diagram math rendering shall not 앱 CSP(`index.html:7`) 아래에서 새 콘솔 CSP 위반을 만든다.

## 다른 SPEC 개정 (REQ-PREVIEW015-024 대상)

공통 정의: 이 SPEC 이후 "strict 모드"는 다음 세 가지를 모두 뜻한다. (1) pele 1.10.0 기본 보안: 텍스트 이스케이프, 위험 URL 차단, 입력·출력 크기 제한. (2) pele 렌더 옵션 `links: false`, `images: false`. (3) 다이어그램 전용 정화: 앱의 SVG 정화 규칙(`src/lib/preview/svgSanitize.ts`의 `sanitizeSvg`와 같은 규칙)을 **전역이 아닌 별도 DOMPurify 인스턴스**에서 적용하고, 그 인스턴스에 `data:`·외부 주소 href를 지우는 훅을 따로 등록하며, 수식을 위해 `class="pele-math"`인 `foreignObject`, pele가 그 안에 만드는 감싸기 `div`, MathML 태그, `semantics`, `encoding` 속성이 있는 `annotation`만 추가로 허용한다. 공유 `sanitizeSvg`의 훅은 이 인스턴스에 물려지지 않는다(SPEC-PREVIEW-015 REQ-003). 아래 문구는 각 SPEC의 해당 REQ 본문을 대체한다. 실제 편집은 run 단계 M6에서 한다(plan.md).

| SPEC | 요구 | 새 문구 |
|------|------|---------|
| SPEC-PREVIEW-006 | REQ-PREVIEW006-001~003 | **유지.** 목표(긴 한글 subgraph 제목 1줄, 클리핑·겹침 없음)는 라이브러리와 무관하다. "Tier 2 패치" 언급만 삭제한다. |
| SPEC-PREVIEW-006 | REQ-PREVIEW006-004 | **폐기 → 대체.** "The system shall 다이어그램 렌더에 패치를 쓰지 않는다. subgraph 제목 1줄 배치는 pele 1.10.0 기본 동작으로 만족한다(SPEC-PREVIEW-015)." |
| SPEC-PREVIEW-006 | REQ-PREVIEW006-005 | "The system shall `package.json`에서 다이어그램 렌더러 `pele`를 정확히 `1.10.0`으로 고정한다(SPEC-PREVIEW-015 REQ-021)." |
| SPEC-PREVIEW-006 | REQ-PREVIEW006-006 | **교체.** 이 SPEC 이후 패치가 없으므로 "패치 적용" 전제를 없앤다. "The system shall pele 교체(SPEC-PREVIEW-015) 뒤에도 subgraph가 아닌 다이어그램·노드 라벨·기존 마크다운 렌더 경로(SPEC-PREVIEW-001/002/003)를 회귀 없이 렌더한다." |
| SPEC-PREVIEW-006 | REQ-PREVIEW006-007 | "**When** pele 버전이 `1.10.0`에서 바뀌거나 mermaid가 다시 의존성에 들어오면, the regression guard tests shall 실패한다." |
| SPEC-PREVIEW-010 | REQ-PREVIEW010-001 | "**While** 앱이 다크(라이트) 모드이면, the preview shall 다이어그램을 `--pele-*`가 연결된 다크(라이트) 토큰 색으로 표시하고, 다크 모드에서 처음 열 때 라이트 색으로 먼저 그리지 않는다." |
| SPEC-PREVIEW-010 | REQ-PREVIEW010-002 | "**When** 사용자가 테마를 토글하면, the preview shall 이미 보이는 다이어그램을 다시 렌더하지 않고 CSS 변수만으로 새 테마 색을 적용한다." (`initialize`·`render` 재호출 문구 삭제) |
| SPEC-PREVIEW-010 | REQ-PREVIEW010-003 | **교체**(research.md §3.2 근거, 기존 "system 테마 모드 대응" 본문 대체). "**When** system 모드에서 OS 색 구성이 바뀌면, the preview shall REQ-PREVIEW010-002와 같이 재렌더 없이 색을 바꾼다." |
| SPEC-PREVIEW-010 | REQ-PREVIEW010-004 | "The diagram module shall 모든 렌더를 strict 모드(위 공통 정의)로 한다." (`securityLevel`·`startOnLoad` 문구 삭제) |
| SPEC-PREVIEW-010 | REQ-PREVIEW010-005 | "**When** pele가 다이어그램을 거부하면, the preview shall `⚠ Diagram syntax error`에 위치 접미사(SPEC-PREVIEW-015 REQ-009)를 붙여 표시하고, 다른 다이어그램을 막지 않는다." (재렌더 경로 문구 삭제) |
| SPEC-PREVIEW-010 | REQ-PREVIEW010-006 | 셋째 줄을 "The system shall pele 버전 핀(1.10.0, SPEC-PREVIEW-015)을 바꾸지 않는다."로, 둘째 줄을 "내보내기 다이어그램 색은 SPEC-PREVIEW-015 REQ-018을 따른다."로 바꾼다. 첫째 줄은 유지. |
| SPEC-UI-008 | REQ-UI-008-008 | 마지막 문장을 "삽입된 펜스는 pele 1.10.0에서 오류 없이 즉시 렌더된다."로 바꾼다. |
| SPEC-UI-008 | REQ-UI-008-019 | 끝에 "단, SPEC-PREVIEW-015의 `mermaid` → `pele` 교체는 예외다."를 붙인다. |
| SPEC-UI-008 | REQ-UI-008-020 | "The system shall not pele 버전 핀(1.10.0), strict 모드(SPEC-PREVIEW-015 공통 정의), 비어 있지 않은 잘못된 다이어그램에 대한 `⚠ Diagram syntax error` 폴백(위치 접미사 포함, SPEC-PREVIEW-015 REQ-009)을 바꾼다." |
| SPEC-UI-008 | AC-UI-008-004 (spec.md 표 `:248`, acceptance.md `:56-61`) | spec.md 표 줄: "프리셋 7종 스니펫이 각각 pele 1.10.0에서 오류 없이 렌더된다; pele 버전 핀 무변경." acceptance.md 블록은 제목을 "### AC-UI-008-004: 프리셋 스니펫 pele 렌더 성공 (REQ-UI-008-008, 020)"으로 바꾸고 본문 4줄을 다음으로 대체한다: "- **Given** spec.md에 정의된 7종 프리셋 스니펫(펜스 내부 본문)이 있을 때 / - **When** 다이어그램 모듈(pele 1.10.0, SPEC-PREVIEW-015 고정 옵션)로 각 스니펫을 렌더하면 / - **Then** flowchart / sequenceDiagram / gantt / classDiagram / stateDiagram-v2 / pie / mindmap 7종 전부가 오류 없이 SVG를 돌려준다(삽입 즉시 렌더 가능). / - **And** pele 버전 핀(1.10.0, SPEC-PREVIEW-015)은 변경되지 않는다." (`/`는 줄 구분). spec.md `:107`의 "mermaid 11.12.3 문법으로 검증" → "pele 1.10.0으로 검증", `:220`의 `mermaid.parse` → "다이어그램 모듈 호출". |
| SPEC-AI-001 | REQ-AI-023 | "삽입 전 로컬 다이어그램 모듈(pele)로 코드를 검증하고, 성공 시 카드에 코드블록과 미니 렌더 미리보기를 함께 표시한다. (설계 제약: strict 모드 — SPEC-PREVIEW-015 공통 정의)" |
| SPEC-AI-001 | REQ-AI-024 | "mermaid 검증" → "다이어그램 검증"으로만 바꾼다. 흐름은 유지. |
| SPEC-AI-008 | REQ-AI-008-017 | "`mermaid.parse` 유효성" → "다이어그램 모듈(pele) 검증 결과"로 바꾼다. 나머지 무변경. |
| SPEC-AI-008 | REQ-AI-008-019 | 끝에 "단, SPEC-PREVIEW-015의 `mermaid` → `pele` 교체는 예외다."를 붙인다. |
| SPEC-AI-008 | REQ-AI-008-021 | "The system shall not pele 버전 핀(1.10.0, SPEC-PREVIEW-015) 또는 strict 모드를 바꾼다." |
| SPEC-AI-008 | AC-AI-008-013 | "mermaid 핀·`securityLevel` 무변경" → "pele 핀·strict 모드 무변경"; "신규 의존성 0건" 뒤에 "(SPEC-PREVIEW-015 교체 제외)". |
| SPEC-EXPORT-004 | REQ-EXPORT004-012 (`spec.md:130`) | "The DOCX export shall Mermaid 다이어그램 삽입 동작(SPEC-PREVIEW-015 REQ-015·017 — 원본에서 렌더, 실패 펜스는 코드 텍스트)과, 임베드하지 못한 이미지 자리에 `[alt]` 텍스트를 넣는 동작을 유지한다." |
| SPEC-EXPORT-001 | REQ-EXPORT-003, REQ-EXPORT-020 | **문구 확인만.** pele에서도 "인라인 SVG, JavaScript 없음"이 그대로 성립한다. REQ-EXPORT-020의 괄호 "Mermaid JS 제거"는 "다이어그램 JS 없음"으로 다듬는다. |

## Design Note — 왜 이렇게 하는가

설계 근거(원본 렌더, 입력 문자열 일치, 검증·렌더 단일 함수, `links: false`·`images: false`, CSS 변수 테마, 색 치환 단일 방식)는 `design.md` §2로 옮겼다. 결정 D1–D15는 `design.md` §1에 있다.

## Exclusions (What NOT to Build)

### Out of Scope — AI 프롬프트

- Rust AI 프롬프트(`src-tauri/src/ai/prompt.rs`)와 그 스냅숏 테스트는 바꾸지 않는다. 입력 언어는 Mermaid 문법 그대로다.

### Out of Scope — 링크·상호작용

- 다이어그램 안의 클릭 가능한 링크, HTML 라벨, JavaScript `click` 콜백은 지원하지 않는다.
- Rust `open_url_in_browser`의 스킴 검증 추가는 하지 않는다(`links: false`로 다이어그램에서 이 경로에 닿지 않는다). 별도 보안 정리 후보로 기록한다.

### Out of Scope — 테마·렌더러 선택

- Mermaid `theme`·`themeVariables` 지원, 사용자가 고르는 다이어그램 테마는 만들지 않는다.
- mermaid와 pele를 함께 두는 구성, 렌더러 선택 설정, mermaid 폴백은 만들지 않는다.

### Out of Scope — 수식 라벨

- KaTeX HTML 출력(`output: 'html'`), KaTeX 외 수식 엔진(MathJax 등), 새 의존성은 쓰지 않는다. M1b에서 HTML 출력은 webkit에서 `foreignObject` 밖으로 어긋나 그려졌고, 내보낼 때 KaTeX CSS와 글꼴이 필요했다(386,784 B).
- KaTeX `trust: true`(`\href`·`\htmlClass` 등)는 켜지 않는다.
- DOCX 수식의 별도 대체 방식(원문 표시, 글자 SVG 등)은 만들지 않는다. M1b에서 `mathml-bare`가 DOCX PNG에도 그려졌다.
- 이미 있는 CSP 결함 — Vite가 `KaTeX_Size3-Regular.woff2`를 `data:` URI로 넣는데 CSP에 `font-src`가 없어 막히는 문제 — 은 고치지 않는다. 수식이 없는 문서에서도 생기는 기존 결함이며 백로그 카드 `t1`로 따로 다룬다.
- 마크다운 본문 수식(KaTeX)의 동작은 바꾸지 않는다.
- 시스템 WKWebView에서의 실제 표시는 자동 검증하지 않는다. MANUAL-3(현재 앱 기준선)과 MANUAL-4(M3 이후 pele 수식)로 사람이 확인한다.

### Out of Scope — 정화기·비다이어그램 내보내기

- `svgSanitize.ts`의 공유 설정 완화는 하지 않는다. 다이어그램 전용 정화 경로는 REQ-PREVIEW015-003·025의 수식 허용 목록(`foreignObject.pele-math`, pele가 만드는 감싸기 `div`, MathML 태그, `semantics`, `encoding` 속성이 있는 `annotation`)만 더하며, 그 밖의 허용 확대는 하지 않는다.
- 다이어그램이 아닌 내보내기 동작(이미지 임베드, 표, 코드 하이라이트, 완료 모달 등)은 바꾸지 않는다.

## Acceptance

수용 기준과 테스트 배치는 `acceptance.md`, 설계 결정과 근거는 `design.md`, 마일스톤·변경 파일·위험은 `plan.md`, 코드 근거는 `research.md` 참조.

## References

- `src/components/preview/PreviewRenderer.tsx:25-29, 35-39, 79-94, 99-176` — 전역 initialize, 테마 판정, 렌더 effect, 링크 클릭 처리 `:136-170`
- `src/lib/ai/mermaidValidate.ts:7, 20-28, 37-39` — 검증 계약
- `src/components/editor/extensions/ai-suggestion-card.ts:18, 485-491, 1141-1155, 1287-1298, 1468` — 카드 검증·미니 렌더
- `src/lib/markdown/mermaidPlugin.ts:13-24` — 펜스 → `data-diagram` 계약
- `src/lib/preview/svgSanitize.ts:13-35, 45-56` — 정화 설정·href 훅
- `src/components/editor/extensions/keyboard-shortcuts.ts:194-257` — `DIAGRAM_PRESETS`
- `src/lib/export/exportHtml.ts:43-46, 99-131`, `src/lib/export/exportPdf.ts:32-38`, `src/lib/export/exportDocx.ts:79, 125-201, 241-272`, `src/lib/export/exportUtils.ts:43-73, 297-320`
- `src/components/layout/ResizablePanels.tsx:171-172` — 에디터 단독 보기
- `src/styles/mdedit-tokens.css:11, 89` — 테마 토큰 블록
- `package.json:18, 37, 59`, `patches/mermaid+11.12.3.patch`
- pele API: https://pele.run/api (2026-10-26 확인), npm `pele@1.10.0` (2026-10-26 `npm view` 확인)
