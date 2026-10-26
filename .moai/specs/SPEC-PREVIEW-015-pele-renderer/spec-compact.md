# SPEC-PREVIEW-015 — 요약본 (spec-compact)

> spec.md v0.4.2, acceptance.md, plan.md에서 기계적으로 뽑은 요약본이다. 요구사항·수용 기준·변경 파일·제외 범위만 담고 개요·접근 방식·조사 근거·이력은 뺐다. 원문과 다르면 원문(spec.md·acceptance.md·plan.md)이 우선한다. 결정 번호 D1–D15는 design.md 참조.

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

## 시나리오 (Given-When-Then)

### AC-PREVIEW015-001: M1 비교 보고서가 기계 확인 표를 앞에 두고 존재한다 — must-pass (evidence, HUMAN GATE)

- **Given** M1 작업이 끝났을 때
- **When** `.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/checks.md`와 `m1/report.html`을 열면
- **Then** `checks.md` 맨 앞 표에 아래 항목마다 실행 명령·출력·PASS/FAIL이 있고, `report.html`에 샘플별 mermaid | pele 나란히 비교(라이트·다크, 폭 560px·800px, `responsive` true/false)와 HTML·PDF·DOCX 내보내기 결과가 있다.
  1. 모든 샘플이 `PeleError` 없이 렌더된다. 단 `notarealdiagramtype foo!!!`는 오류(`code` 기록)로 거부된다.
  2. 시나리오 B·C 서브그래프 제목이 한 줄이고 상자가 겹치지 않는다.
  3. `autoDirection: false`이면 폭 560px에서 배치 방향이 800px과 같다.
  4. `links: false`이면 출력에 `href`를 가진 `<a>`가 없고, Tauri 개발 웹뷰에서 다이어그램을 클릭해도 이동하지 않는다. `images: false`이면 외부 이미지 문법이 든 샘플의 출력에 외부 주소 `href`가 없고 네트워크 요청이 생기지 않는다.
  5. HTML·PDF·DOCX PNG에서 색이 남는다(`--pele-*` 값을 풀어 넣은 경우). 풀어 넣지 않은 경우의 결과도 함께 보인다.
  6. DOCX용 SVG→PNG 변환 결과에 글자와 색이 보인다.
  7. `sanitizeSvg`를 통과한 뒤에도 모양이 같다(`<style>`·인라인 style·`id` 참조 보존 여부 기록).
  8. 앱 CSP(`index.html:7`) 아래에서 콘솔 CSP 오류가 없다.
  9. 다이어그램 30개 이상 문서에서 mermaid·pele 첫 렌더 시간(같은 기기).
  10. 엔티티 샘플에서 `data-diagram` 속성값과 펜스 토큰 원문이 pele 결과를 다르게 만드는지.
  11. vitest jsdom에서 pele 렌더 가능 여부.
  12. 여러 다이어그램 동시 렌더 시 SVG `id` 중복 여부.
  13. 수식 라벨: 수식이 든 샘플이 현재 앱 mermaid strict 설정과 pele + `sanitizeSvg`에서 각각 표시되는지(**측정만 하고 단정하지 않음**, design.md D15).
- **And** 사용자의 판정(통과/보류), `responsive` 선택, `--pele-*` 변수 목록, 단위 테스트 측정기(`jsdom-default` 또는 `fixed-width-test`)가 progress.md §E.2에 기록되어 있다. 보류이면 M2 이후 커밋이 없다. (REQ-002, REQ-023)

### AC-PREVIEW015-002: pele 픽스처는 실제 렌더에서 왔다 — must-pass (evidence + unit)

- **Given** `src/test/fixtures/pele/manifest.json`이 있을 때
- **When** vitest(jsdom)에서 픽스처 검증 테스트를 실행하면
- **Then** 매니페스트의 모든 항목에 입력 소스·옵션·`pele` 버전(`1.10.0`)·캡처 날짜·캡처 환경·측정기가 있다. 수식 항목에는 수식 크기를 정한 방법(jsdom 캡처는 주입한 크기 값, 브라우저 캡처는 `getBoundingClientRect` 측정)도 있다.
- **And** 측정기가 단위 테스트 측정기와 같은 항목(`unit/` 묶음)만, 현재 설치된 pele로 같은 옵션·같은 측정기로 다시 렌더한 결과가 저장된 픽스처와 바이트 단위로 같다.
- **And** 측정기가 `canvas`인 항목(`browser/` 묶음)은 바이트 비교 대상이 아니며, 같은 테스트에서 구조 불변식만 확인한다: 파일이 `<svg`로 시작하고, 매니페스트의 입력 소스에 있는 라벨 글자 가운데 `$$…$$` 구간을 **뺀** 글자가 모두 SVG 텍스트에 있으며, `<script`가 없다. 라벨에 `$$…$$`가 있는 항목은 그 TeX 원문이 `<annotation encoding="application/x-tex">` 안에 있음을 대신 확인한다. (REQ-023)

### AC-PREVIEW015-003: 엔진은 한 모듈에만 있고 mermaid는 없다 — must-pass (unit)

- **Given** M7이 끝난 트리일 때
- **When** 가드 테스트가 `src/`·`e2e/`의 import를 검사하면
- **Then** `pele` import는 `src/lib/diagram/` 모듈 하나에만 있고(테스트·픽스처 캡처 제외), `mermaid` import·동적 import·`vi.mock('mermaid')`는 0건이며, 모듈 밖에 다른 렌더러 선택 경로가 없다. (REQ-001, REQ-005)

### AC-PREVIEW015-004: 고정 옵션으로만 호출한다 — must-pass (unit)

- **Given** pele `render`를 감시하는 상태에서
- **When** 미리보기·AI 검증·AI 카드·내보내기·프리셋 경로로 각각 렌더하면
- **Then** 모든 호출의 옵션에 `autoDirection: false`, `links: false`, `images: false`, `responsive: true`와, 모듈의 일반 글꼴 상수와 같은 `fontFamily`, 고정폭 글꼴 상수와 같은 `fontFamilyMono`가 있다. 두 상수가 글꼴 목록의 기준이다. 확인 절차: 테스트가 `src/styles/mdedit-tokens.css` 파일 텍스트를 읽어 `:root`·`[data-theme="dark"]` 두 블록의 `--pele-font`·`--pele-font-mono` 값을 꺼내고, 각각이 해당 상수 문자열과 **글자 그대로 같은지** 비교한다(design.md D5 규칙상 두 변수는 `var(...)` 참조가 아닌 리터럴이다. `var(`가 들어 있으면 실패로 처리한다). 옵션은 호출자가 넘긴 값으로 바뀌지 않는다. (REQ-002)

### AC-PREVIEW015-005: 수식이 없는 다이어그램은 공유 `sanitizeSvg`와 같은 결과로 정화된다 — must-pass (unit)

- **Given** M1 고정 기준 묶음 `src/test/fixtures/pele/m1-frozen/`(M1 `unit/` 캡처의 정화 전·후 38쌍, M2가 `fontFamily` 반영 전에 옮겨 두며 다시 캡처하지 않음, 매니페스트에 `frozen: true`)의 수식 없는 항목마다 **정화 전** pele 출력과, M1 때 공유 `sanitizeSvg`가 만든 **정화 후** 출력이 있을 때
- **When** (unit) 같은 정화 전 SVG 문자열을 다이어그램 전용 정화 경로와 공유 `sanitizeSvg`에 각각 넣으면
- **Then** 두 결과 문자열이 **바이트 단위로** 같다. 두 결과 모두 `<script>`·`foreignObject`·`on*` 속성이 0개다. 공유 `sanitizeSvg`의 결과는 고정 기준 묶음의 **정화 후** 출력(M1 때 만들어 두고 이후 다시 만들지 않은 값)과도 바이트 단위로 같다. 이 비교는 지금의 `sanitizeSvg`를 그 함수가 지금 만든 결과와 비교하지 않는다. M1b 2a는 같은 38쌍에서 이 일치를 측정했다.
- 이 비교는 `sanitizeSvg`에 감시를 걸지 않는다. 다이어그램 모듈은 `sanitizeSvg`를 호출하지 않는다(design.md D4).
- 수식이 없는 입력에서 두 경로의 결과가 같다는 성질은 M1b에서 측정하지 않았다(2a는 공유 함수만, 2b는 수식 샘플만 측정). 그래서 이 AC는 M2에서 처음 확인하는 테스트다. 같지 않으면 정화 설정을 넓히지 않고 차이를 blocker로 보고한다.
- 수식이 있는 다이어그램의 `foreignObject.pele-math` 허용은 AC-025가 다룬다. `git diff`로 `src/lib/preview/svgSanitize.ts`가 바뀌지 않았음을 확인한다(코드 리뷰). (REQ-003)

### AC-PREVIEW015-006: 오류 문구에 소스·메시지가 HTML로 들어가지 않는다 — must-pass (unit)

- **Given** 라벨에 `<img src=x onerror=alert(1)>`가 든 거부되는 소스가 있을 때
- **When** 미리보기가 렌더하면
- **Then** 컨테이너 안에 `img` 요소가 생기지 않고, 오류 `<p>`의 자식은 텍스트 노드뿐이다. (REQ-004, REQ-009)

### AC-PREVIEW015-007: 오류 위치 접미사 형식 — must-pass (unit)

- **Given** M1에서 실제 pele 출력으로 확인한 거부 소스 두 종류가 있을 때: (a) 위치가 있는 소스 `sequenceDiagram\n  A->>B hello`(pele `line 2`, `column 14`) (b) 위치가 없는 소스 `pie\n  "a" : -1`(`semantic`, 0/0)과 `notarealdiagramtype foo!!!`(`unsupported-diagram`, 0/0)
- **When** 미리보기가 렌더하면
- **Then** (a)는 `⚠ Diagram syntax error (2행 14열)`, (b)의 두 소스는 접미사 없는 `⚠ Diagram syntax error`이고, 마크업은 `<p class="text-sm text-amber-500 italic py-2">`이다. 위치 숫자는 하드코딩하지 않고, 같은 소스로 모듈이 받은 `PeleError`의 `line`·`column`과 같음을 단언한다. (REQ-009)
- 참고: M1에서 "line만 있고 column은 0"인 출력은 변형 6,264개에서 한 번도 나오지 않아(report F5) 그 갈래는 요구에서 뺐다.

### AC-PREVIEW015-008: 한 다이어그램 실패가 다른 다이어그램을 막지 않는다 — must-pass (unit)

- **Given** 유효·거부·유효 순서의 펜스 3개가 있는 문서일 때
- **When** 미리보기가 렌더하면
- **Then** 첫째·셋째 컨테이너에 SVG가, 둘째에 오류 문구가 있고 예외가 밖으로 나가지 않는다. (REQ-009)

### AC-PREVIEW015-009: 빈 펜스는 안내만 보이고 pele를 부르지 않는다 — must-pass (unit)

- **Given** 본문이 비었거나 공백뿐인 ` ```mermaid ` 펜스가 있을 때
- **When** 미리보기가 렌더하면
- **Then** `<p class="md-diagram-placeholder">다이어그램 문법을 입력하세요</p>`가 표시되고 pele `render` 호출은 0회다. (REQ-010)

### AC-PREVIEW015-010: 같은 입력으로 렌더하고, 최신 내용만 보이며, id가 겹치지 않는다 — must-pass (unit)

- **Given** 엔티티 샘플 펜스와 유효 펜스 2개가 있는 문서일 때
- **When** 미리보기가 렌더하고, 이어서 내용을 다른 다이어그램으로 바꿔 다시 렌더하면
- **Then** pele에 넘어간 입력은 각 컨테이너의 `getAttribute('data-diagram')` 값과 같고, 다시 렌더한 뒤 화면에는 바꾼 내용의 다이어그램만 있으며, 문서 안 모든 SVG의 `id` 값에 중복이 없다. 렌더 중 모듈 밖 전역 설정 객체를 만들거나 바꾸는 호출이 없다. (REQ-006, REQ-007)

### AC-PREVIEW015-011: 테마 전환은 SVG를 다시 만들지 않고 색만 바꾼다 — must-pass (unit + e2e)

- **Given** 라이트 모드 미리보기에 다이어그램이 하나 있을 때
- **When** 테마를 다크로, 다시 라이트로, 그리고 system 모드에서 `prefers-color-scheme`을 바꾸면
- **Then** (unit) 컨테이너의 SVG 노드가 처음과 같은 객체이고 pele `render` 추가 호출이 0회다. (e2e) 노드의 계산된 채움색이 라이트·다크에서 서로 다르고 각 테마 토큰 값과 같다. **첫 렌더 확인 방법**: 페이지 이동 전에 `page.addInitScript`로 테마 설정을 다크로 저장해 두고, 다이어그램이 든 문서를 연 뒤 `page.waitForSelector('.mermaid-container svg')`가 처음 붙은 요소를 돌려준 직후 그 노드의 계산된 채움색을 읽는다. 이 값이 다크 토큰 값과 같고, 같은 노드가 이후 교체되지 않는다(`elementHandle`이 계속 연결됨). `mdedit-tokens.css`의 두 블록에 `--pele-*` 정의가 있다. (REQ-008)

### AC-PREVIEW015-012: 다이어그램에는 이동할 링크도 외부 이미지도 없다 — must-pass (unit + e2e)

- **Given** 노드 링크 문법(`click A "https://example.com"` 등 M1에서 pele가 링크로 해석함을 확인한 문법)이 든 다이어그램이 있을 때
- **When** (unit) 렌더 결과를 보고 (e2e) 미리보기에서 그 노드를 클릭하면
- **Then** SVG에 `href`·`xlink:href`를 가진 `<a>`가 0개이고, 클릭 뒤 페이지 URL이 그대로이며 `open_url_in_browser` IPC 호출이 0회다.
- **And Given** 외부 이미지 문법(`https://example.com/x.png`를 가리키는, M1에서 pele가 이미지로 해석함을 확인한 문법)이 든 다이어그램이 있을 때 **When** (unit) 모듈로 렌더하면 **Then** 정화 전 pele 출력과 정화 후 결과 모두에서 `http:`·`https:`·`//`로 시작하는 `href`·`xlink:href` 값이 0건이다(정화 전 0건이 `images: false`의 효과를, 정화 후 0건이 다이어그램 전용 정화 경로에 다시 등록한 href 차단 훅을 고정한다. 정화 전 출력에 외부 href를 넣은 입력으로 훅만 따로 확인하는 단언도 둔다). (REQ-002, REQ-011)

### AC-PREVIEW015-013: 긴 한글 서브그래프 제목은 한 줄이고 겹치지 않는다 — must-pass (e2e)

- **Given** `e2e/mermaid-subgraph-label.spec.ts` 시나리오 B(세로)·C(가로) 픽스처일 때
- **When** 미리보기에서 렌더하면
- **Then** 각 서브그래프 제목 `<text>`의 높이가 한 줄 높이의 1.6배 이하(줄바꿈 없음)이고, 제목이 자기 상자 안에 있으며, 서로 다른 서브그래프 상자끼리 겹치지 않는다. (REQ-006, SPEC-PREVIEW-006 REQ-001~003 목표 유지)

### AC-PREVIEW015-014: AI 검증은 같은 엔진이고 계약이 그대로다 — must-pass (unit + e2e)

- **Given** 유효한 flowchart, `notarealdiagramtype foo!!!`, M1의 문법 오류 샘플이 있을 때
- **When** `validateMermaid`를 호출하면
- **Then** 결과가 각각 `{ valid: true }`, `{ valid: false, error: E2 }`, `{ valid: false, error: E3 }`이고 Promise로 돌아온다. 여기서 E2·E3은 같은 소스를 diagram module의 렌더 함수로 렌더했을 때 받은 오류의 `PeleError.message`와 **같은 문자열**이다. `validateMermaid`가 미리보기와 같은 렌더 함수를 같은 고정 옵션으로 호출한다(통과형 감시 래퍼로 호출 1회와 옵션 확인). 유효 판정된 코드는 같은 모듈로 미리보기에서 SVG가 된다. `buildFallbackDecision(1)`·`(2)` 결과와 `aiCardRetryLimit`·`aiSuggestionCardRerequest`의 흐름 단언(자동 재요청 1회 → 목록 폴백, 재시도 카운터 미변경)이 그대로 통과한다.
- **And** (e2e) `e2e/ai-inline-edit.spec.ts`의 "1차 무효 → 자동 재요청 → 2차 유효" 시나리오에서 `.mdedit-ai-mermaid-preview`가 보이고 삽입된 문서에 ` ```mermaid `가 있다. (REQ-012)

### AC-PREVIEW015-015: AI 카드 미니 미리보기는 정화되고 테마를 따른다 — must-pass (unit)

- **Given** 운영 렌더러(`renderMermaidInto`)가 주입된 AI 카드가 `diagram-valid`에 이르렀을 때
- **When** 미니 미리보기가 그려지면
- **Then** `.mdedit-ai-mermaid-preview` 안 SVG는 모듈 결과(정화됨)와 같고, 렌더 실패 시 영역은 비어 있으며 카드의 삽입·닫기 동작이 그대로다. 다크 모드 색 확인은 AC-011과 같은 토큰 경로이므로 manual(AC-024) 점검에 포함한다. (REQ-013)

### AC-PREVIEW015-016: 삽입 프리셋 7종이 오류 없이 렌더된다 — must-pass (unit)

- **Given** `DIAGRAM_PRESETS`의 7종 body일 때
- **When** 모듈로 렌더하면
- **Then** 7종 모두 오류 없이 SVG를 돌려주고, 프리셋 개수 8개·순서·body 문자열 단언(`diagramRegressionGuard.test.ts:52-70`)이 수정 없이 통과한다. (REQ-014)

### AC-PREVIEW015-017: 내보내기는 미리보기 DOM 없이 원본에서 렌더한다 — must-pass (unit)

- **Given** 문서 DOM에 `.mermaid-container`가 하나도 없고, 내보낼 내용에 유효 펜스 2개와 엔티티 샘플 펜스가 있을 때
- **When** `exportToHtml`, `generateHtmlContent`(PDF 경로), `exportToDocx`를 각각 실행하면
- **Then** HTML·PDF 결과의 각 `.mermaid-container`에 SVG가 있고, DOCX에 다이어그램 PNG `ImageRun`이 3회 생성된다. 엔티티 샘플에 대해 세 경로가 pele에 넘긴 입력 문자열은 미리보기가 같은 펜스에 넘기는 문자열과 같다. 내보낸 HTML 안 모든 SVG의 `id` 값에 중복이 없다. (REQ-006, REQ-015)

### AC-PREVIEW015-018: 에디터 단독 보기에서도 다이어그램이 내보내진다 — must-pass (unit + manual)

- **Given** (unit) 미리보기 컴포넌트가 마운트되지 않은 상태 (manual) 앱 보기 모드가 에디터 단독일 때
- **When** HTML·PDF·DOCX로 내보내면
- **Then** (unit) AC-017과 같은 결과다. (manual) 내보낸 세 파일 모두에 다이어그램이 보이고, 분할 보기에서 내보낸 결과와 같다. (REQ-016)

### AC-PREVIEW015-019: 실패한 펜스는 자기 자리만 차지한다 — must-pass (unit)

- **Given** 유효 A, 거부 B, 빈 펜스 C, 유효 D 순서의 문서일 때
- **When** HTML과 DOCX로 내보내면
- **Then** HTML의 1·4번째 `.mermaid-container`에 각각 A·D의 SVG가 있고 2·3번째는 비어 있다. DOCX는 1번째 펜스 자리에 A의 PNG, 2·3번째 자리에 각 펜스 코드 텍스트, 4번째 자리에 D의 PNG가 있다(현재 코드에서는 D의 이미지가 B 자리로 밀려 실패하는 재현 테스트). (REQ-017)

### AC-PREVIEW015-020: 내보낸 다이어그램의 `--pele-*`는 모두 실제 값으로 치환된다 — must-pass (unit + manual)

- **Given** 라이트·다크 색 값 표(서로 다른 값)를 주입하고, `classDef`·`style` 색 지정 샘플, 일반 flowchart, 수식 다이어그램(`18-math-label`)이 든 문서일 때. 수식 다이어그램은 AC-025·수식 픽스처와 같은 방법으로 해석기에 고정 크기를 주입한다(jsdom은 DOM 크기를 0으로 재어 pele가 `$$…$$` 원문으로 되돌리기 때문, design.md D14)
- **When** 아래 6가지 조합으로 각각 내보내면: HTML × `light`/`dark`, PDF(`generateHtmlContent`) × `light`/`dark`, DOCX(래스터 입력 SVG) × `light`/`dark`
- **Then** (unit) 6가지 조합 **각각**에서 다음이 모두 참이다.
  0. 수식 다이어그램 SVG에 `foreignObject.pele-math`가 1개 이상 있다(이 전제가 거짓이면 아래 1번 단언은 수식 영역을 검사하지 못하므로 테스트 실패로 처리한다).
  1. 다이어그램 SVG 문자열(수식 다이어그램의 `foreignObject.pele-math` 감싸기 안쪽 포함)에 `var(--pele-` 부분 문자열이 **0번** 나온다(pele 내부 `var(--_…)`는 검사 대상이 아니다, report F9).
  2. 기대 테마의 값이 SVG 안에 1개 이상 있고, 다른 테마에만 있는 값은 없다. 기대 테마는 조합마다 다음과 같다.

     | 조합 | 기대 테마 |
     |------|-----------|
     | HTML × light | light |
     | HTML × dark | dark |
     | PDF × light | light |
     | PDF × dark | dark |
     | DOCX × light | light |
     | DOCX × dark | **light** — 다크 테마로 내보낸 DOCX도 라이트 값을 담고 다크에만 있는 값은 담지 않는다(design.md D6) |

  3. 사용자가 `classDef`·`style`로 지정한 색 값은 그대로 남는다.
- **And** (manual) 내보낸 HTML을 다른 브라우저에서, PDF를 미리보기 앱에서 열면 다이어그램 색과 글자가 내보내기 테마로 보이고, DOCX를 Word에서 열면 내보내기 테마와 상관없이 흰 페이지에 라이트 색으로 글자가 읽힌다. (REQ-018)

### AC-PREVIEW015-021: DOCX 다이어그램 크기는 pele 크기를 따른다 — must-pass (unit)

- **Given** pele가 `width: W, height: H`를 돌려준 다이어그램이 있고, 미리보기 `zoom`·패널 폭을 서로 다른 두 값으로 바꿨을 때
- **When** DOCX로 내보내면
- **Then** 두 경우 모두 `ImageRun`의 크기가 같고 가로세로 비율이 `W:H`와 같다(페이지 폭을 넘으면 비율 유지 축소). `getBoundingClientRect` 호출이 크기 결정에 쓰이지 않는다. (REQ-019)

### AC-PREVIEW015-022: 내보내기 안전·기존 계약 회귀 없음 — must-pass (unit)

- **Given** 기존 내보내기 테스트 전체와 다이어그램이 든 문서일 때
- **When** 전체 스위트를 실행하면
- **Then** 내보낸 HTML에 `<script`가 없고, 다이어그램은 인라인 `<svg>`로 들어가며, `exportToHtml`·`exportToDocx`는 성공 시 경로 문자열·취소 시 `null`을 돌려준다. SPEC-EXPORT-004 테스트(DM1 재작성분 제외)가 수정 없이 통과한다. (REQ-020)

### AC-PREVIEW015-023: 의존성 집합과 가드 — must-pass (unit)

- **Given** M2 이후 `package.json`일 때
- **When** 가드 테스트를 실행하고, 시험으로 `pele`를 `^1.10.0`으로 바꾸거나 `mermaid`를 다시 넣으면
- **Then** 원래 상태에서는 통과하고(`pele === "1.10.0"`, `mermaid`·`patch-package`·`postinstall` 없음, `dompurify`·`katex`·`@types/dompurify` 있음, 런타임 의존성 집합이 정한 목록과 같음), 바꾼 상태에서는 실패한다. `patches/mermaid+11.12.3.patch`가 없다. (REQ-021, REQ-022)

### AC-PREVIEW015-024: 다른 SPEC·문서가 새 엔진 기준이고, 앱에서 전체가 동작한다 — must-pass (evidence + manual)

- **Given** M6과 sync가 끝났을 때
- **When** spec.md "다른 SPEC 개정" 표의 각 SPEC과 문서를 확인하면
- **Then** 아래 표의 대상마다 "블록"을 잘라 금지 패턴이 0건이고 필수 문자열이 1건 이상이다. 표에 없는 줄(배경, 계획, HISTORY, 다른 REQ)은 검사하지 않는다.
  - **블록 정의**: `### REQ-…` 제목형이면 그 제목 줄부터 다음 `#` 제목 줄 직전까지. 목록·표 한 줄형(`- **REQ-…**`, `| AC-… |`)이면 그 한 줄. "내용 줄"은 적힌 문구를 담은 한 줄.
  - **공통 금지 패턴 F**: `11\.12\.3|securityLevel|startOnLoad|mermaid\.parse|initialize|patch-package|postinstall`

  | # | 파일 | 대상 | 금지 | 필수 |
  |---|------|------|------|------|
  | 1 | SPEC-PREVIEW-006/spec.md | REQ-PREVIEW006-003 블록 | `Tier 2` | — |
  | 2 | SPEC-PREVIEW-006/spec.md | REQ-PREVIEW006-004 블록 | F | `SPEC-PREVIEW-015` |
  | 3 | SPEC-PREVIEW-006/spec.md | REQ-PREVIEW006-005 블록 | F | `pele` |
  | 4 | SPEC-PREVIEW-006/spec.md | REQ-PREVIEW006-007 블록 | F | `pele` |
  | 27 | SPEC-PREVIEW-006/spec.md | REQ-PREVIEW006-006 블록 | `패치` | `SPEC-PREVIEW-015` |
  | 5 | SPEC-PREVIEW-010-mermaid-dark-theme/spec.md | REQ-PREVIEW010-001 블록 | F, `theme: 'dark'` | `--pele-` |
  | 6 | 같은 파일 | REQ-PREVIEW010-002 블록 | F | `CSS 변수` |
  | 7 | 같은 파일 | REQ-PREVIEW010-003 블록 | F | `재렌더 없이` |
  | 8 | 같은 파일 | REQ-PREVIEW010-004 블록 | F | `strict 모드` |
  | 9 | 같은 파일 | REQ-PREVIEW010-005 블록 | F | `위치 접미사` |
  | 10 | 같은 파일 | REQ-PREVIEW010-006 블록 | F | `pele 버전 핀` |
  | 11 | SPEC-UI-008-diagram-insert-menu/spec.md | `- **REQ-UI-008-008**` 줄 | F | `pele 1.10.0` |
  | 12 | 같은 파일 | `- **REQ-UI-008-019**` 줄 | — | `SPEC-PREVIEW-015` |
  | 13 | 같은 파일 | `- **REQ-UI-008-020**` 줄 | F | `pele 버전 핀` |
  | 14 | 같은 파일 | `\| AC-UI-008-004 \|` 표 줄 | F | `pele 1.10.0` |
  | 15 | 같은 파일 | "아래 7개 스니펫" 내용 줄 | F | `pele 1.10.0` |
  | 16 | 같은 파일 | "빈 펜스 플레이스홀더 판정 힌트" 내용 줄 | F | `다이어그램 모듈` |
  | 17 | SPEC-UI-008-diagram-insert-menu/acceptance.md | `### AC-UI-008-004` 블록 | F, `mermaid 파싱` | `pele 1.10.0` |
  | 18 | SPEC-AI-001/spec.md | `- **REQ-AI-023**` 줄 | F | `strict 모드` |
  | 19 | 같은 파일 | `- **REQ-AI-024**` 줄 | `mermaid 검증` | `다이어그램 검증` |
  | 20 | SPEC-AI-008-diagram-type-picker/spec.md | `- **REQ-AI-008-017**` 줄 | F | `다이어그램 모듈` |
  | 21 | 같은 파일 | `- **REQ-AI-008-019**` 줄 | — | `SPEC-PREVIEW-015` |
  | 22 | 같은 파일 | `- **REQ-AI-008-021**` 줄 | F | `pele 버전 핀` |
  | 23 | 같은 파일 | `\| AC-AI-008-013 \|` 표 줄 | F | `pele 핀` |
  | 24 | SPEC-EXPORT-004-export-image-path/spec.md | REQ-EXPORT004-012 블록의 "Mermaid 다이어그램" 내용 줄 | `캡처` | `SPEC-PREVIEW-015` |
  | 25 | SPEC-EXPORT-001/spec.md | `**REQ-EXPORT-020**` 줄과 바로 다음 줄 | `Mermaid JS` | — |
  | 26 | README.md, docs/USER_MANUAL.md, docs/USER_GUIDE.md | 파일 전체 | `11\.12\.3` | — |

- **And** 위 7개 SPEC 각각의 HISTORY 표에 `SPEC-PREVIEW-015`를 담은 행이 1개 이상 있다. USER_MANUAL 목차 `:15` 링크가 실제 부록 제목으로 이동한다.
- **And** (manual, macOS 앱) 다이어그램이 많은 실제 문서를 열어 라이트·다크 전환, 문법 오류 위치 표시, 빈 펜스 안내, 삽입 메뉴 7종, AI "다이어그램으로"(다크 모드 미니 미리보기 포함), HTML·PDF·DOCX 내보내기를 한 번씩 확인한다. (REQ-024)

### AC-PREVIEW015-025: 다이어그램 안 수식은 `mathml-bare`로 그려지고 허용 목록은 별도 인스턴스에만 걸린다 — must-pass (unit + e2e + manual)

- **Given** 수식 샘플 `18-math-label`(라벨에 `$$x^2 + y^2$$`), 글자와 수식 여러 개가 섞인 `m03`, 그리고 M1b 적대 입력 9종(`spike/pele/m1b/hostile.ts`에서 옮긴 것: 클래스 없는 `foreignObject`, `pele-math evil` 같은 다른 클래스, `foreignObject` 안 `<script>`, `onload`·`onclick`·`onerror`, `javascript:` href, `foreignObject` 밖 HTML·MathML, form·iframe·style, `annotation-xml` 안 HTML, `data:`·외부 href)이 있을 때
- **When** (unit) 해석기에 크기 측정 결과를 주입해 모듈로 렌더·정화하고, 같은 적대 입력을 공유 `sanitizeSvg`로도 정화하면
- **Then** (unit, 구조만 단언 — jsdom은 실제 크기를 잴 수 없다)
  1. KaTeX 호출 옵션이 `output: 'mathml'`, `trust: false`이고, 해석기 결과 `html`이 `<math`로 시작하며 `class="katex"` span을 담지 않는다.
  2. 다이어그램 결과에 `foreignObject.pele-math`가 수식 개수만큼 있고, 그 안에 `<math>`·`<semantics>`·`<annotation encoding="application/x-tex">`가 남는다.
  3. 적대 입력 9종 각각에 대해 다이어그램 결과에 남은 표지가 0개다.
  4. 공유 `sanitizeSvg` 결과는 같은 입력에서 `foreignObject`가 0개이고, M1 고정 기준 묶음(`src/test/fixtures/pele/m1-frozen/` 38쌍)의 정화 전 출력을 다이어그램 경로 사용 전·후에 정화한 결과가 모두 그 묶음의 정화 후 출력과 바이트 단위로 같다.
  5. 다이어그램 경로가 쓰는 DOMPurify가 전역 인스턴스와 다른 객체이고, 다이어그램 경로를 거친 뒤에도 전역 인스턴스에 등록된 훅 수가 늘지 않는다.
  6. 다이어그램 경로를 거친 뒤에도 전역 인스턴스의 설정이 바뀌지 않았다: 같은 `foreignObject.pele-math`가 든 입력을 공유 `sanitizeSvg`에 넣으면 `foreignObject`가 여전히 0개이고, 그 결과가 다이어그램 경로를 쓰기 전 같은 입력의 결과와 바이트 단위로 같다(M1b 2d에서 측정한 성질).
- **And** (e2e, webkit) 앱 CSP meta가 있는 미리보기에서 `18-math-label`을 렌더하면 `foreignObject.pele-math` 안 `<math>` 요소의 `getBoundingClientRect`가 그 `foreignObject` 상자 안에 있고, CSP 신호 두 가지를 **각각** 센다: (가) `securitypolicyviolation` 이벤트 수, (나) 콘솔의 CSP 거부 메시지 수. 같은 문서에서 수식을 뺀 기준 렌더와 비교해 두 수 모두 늘지 않는다(**다이어그램 수식으로 생기는 새 위반 0**). 판정은 "수식 있는 렌더의 (가)·(나) 각각 ≤ 기준 렌더의 같은 값"이다. 기준 렌더에 있는 거부(현재는 기존 `KaTeX_Size3-Regular.woff2` `data:` 글꼴 거부 1건, 범위 밖, 백로그 `t1`)는 이 비교에서 상쇄되며, 그 거부가 없어도(`t1`이 고쳐진 뒤) 판정은 같다. 그 1건 말고 다른 거부를 제외 대상으로 삼지 않는다. `exportToHtml` 결과와 PDF 경로의 `generateHtmlContent` 결과 모두에 KaTeX CSS(`.katex` 규칙)나 `@font-face`가 들어가지 않고, 두 결과 모두 수식 다이어그램의 `foreignObject.pele-math` 안에 `<math>`가 있다.
- **And** (unit) DOCX 내보내기에서 수식 다이어그램의 래스터 입력 SVG에 `foreignObject.pele-math`가 있고 `ImageRun`이 생성된다(펜스 코드 텍스트로 바뀌지 않음).
- **And** (manual) MANUAL-3(현재 앱 mermaid 수식 기준선)과 MANUAL-4(M3 이후 시스템 WKWebView에서 pele 수식이 상자 안에 그려짐)를 사용자가 확인한다. `m03`이 오류 없이 그려지는 것도 이때 함께 본다. 앱에서 수식 다이어그램이 든 문서를 라이트·다크로 PDF 내보내기(인쇄 → PDF 저장)해 수식이 상자 안에 보이는지도 확인한다(PDF 수식 표시는 M1b에서 측정하지 않았다). (REQ-003, REQ-025)

## 변경 파일

| 파일 | 마일스톤 | 변경 |
|------|----------|------|
| `spike/pele/**` | M1 생성 → M7 삭제 | 시험 렌더링 코드 |
| `.moai/specs/SPEC-PREVIEW-015-pele-renderer/m1/{report.html,checks.md}` | M1 | 비교 보고서·기계 확인 표 |
| `src/test/fixtures/pele/**` | M1·M2 | 실제 렌더 캡처 픽스처 + `manifest.json`. M2에서 M1 `unit/` 캡처를 `m1-frozen/`(고정 기준, 재캡처 없음)으로 옮기고 `unit/`·`browser/`를 `fontFamily`·`fontFamilyMono` 반영 뒤 다시 캡처, 수식 픽스처 추가 |
| `src/lib/diagram/diagramRenderer.ts` (신규) | M2 | 렌더·검증·위치 문구·색 풀어 넣기, KaTeX `mathml-bare` 수식 해석기, 별도 DOMPurify 인스턴스의 다이어그램 전용 정화 경로 |
| `src/test/diagramRenderer.test.ts` (신규) | M2 | 모듈 단위 테스트 |
| `package.json`, `package-lock.json` | M1·M2 | pele 추가, mermaid·patch-package·postinstall 제거 |
| `patches/mermaid+11.12.3.patch` | M2 | 삭제 |
| `src/styles/mdedit-tokens.css` | M2 | `--pele-*` 정의 |
| `src/test/diagramRegressionGuard.test.ts`, `src/test/aiDiagramTypeRegressionGuard.test.ts` | M2 | 의존성 집합·핀 개정 |
| `src/components/preview/PreviewRenderer.tsx` | M3 | 모듈 사용, 전역 설정·재렌더 제거 |
| `src/lib/ai/mermaidValidate.ts` | M3 | 내부만 모듈로 |
| `src/components/editor/extensions/ai-suggestion-card.ts` | M3 | `renderMermaidInto` 모듈 사용 |
| `src/test/{insertDiagram,PreviewRenderer,mermaidValidate,renderer,MarkdownPreview,aiCardRetryLimit,aiSuggestionCardRerequest,aiSuggestionCard}.test.ts(x)` | M3 | mermaid 의존 단언 개정 |
| `src/lib/export/exportHtml.ts`, `src/lib/export/exportDocx.ts`, `src/lib/export/exportUtils.ts` | M4 | 원본 렌더·색 풀어 넣기·위치 대응·크기 |
| `src/test/exportImageEmbed.test.ts` + 새 내보내기 다이어그램 테스트 | M4 | DM1 재작성, 새 AC 테스트 |
| `e2e/mermaid-subgraph-label.spec.ts`, `e2e/markdown-render.spec.ts`, `e2e/ai-inline-edit.spec.ts` + 새 e2e | M5 | 측정 대상 개정, 링크·테마 e2e |
| 7개 SPEC `spec.md`(+ SPEC-UI-008 `acceptance.md`) | M6 | 요구 문구 개정 (manager-spec) |
| `docs/USER_MANUAL.md`, `docs/USER_GUIDE.md`, `README.md`, `.moai/project/*` | Sync | 문서 |

변경하지 않는 파일: `src/lib/preview/svgSanitize.ts`, `src/lib/markdown/mermaidPlugin.ts`, `src/components/editor/extensions/keyboard-shortcuts.ts`(프리셋), `src-tauri/**`(프롬프트·`browser_ops.rs` 포함), `index.html`(CSP), `src/lib/export/types.ts`, `src/lib/image/imageResolver.ts`.

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
