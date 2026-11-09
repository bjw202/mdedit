# SPEC-PREVIEW-021 acceptance.md — 수용 기준 (Tier M, v0.1.0)

## 추적성

| AC | REQ | 검증 기법 |
|----|-----|----------|
| AC-PREVIEW021-001 | REQ-PREVIEW021-001 | unit — 선명 모드 srcdoc에 SVG |
| AC-PREVIEW021-002 | REQ-PREVIEW021-002 | unit — 감지 표(잡는 것) |
| AC-PREVIEW021-003 | REQ-PREVIEW021-002 | unit — 감지 표(잡지 않는 것) |
| AC-PREVIEW021-004 | REQ-PREVIEW021-003 | unit — 원문 추출 |
| AC-PREVIEW021-005 | REQ-PREVIEW021-004 | unit — 렌더 삽입 |
| AC-PREVIEW021-006 | REQ-PREVIEW021-005 | unit — 실패 안내 |
| AC-PREVIEW021-007 | REQ-PREVIEW021-006 | unit — 블록 밖 바이트 보존 |
| AC-PREVIEW021-008 | REQ-PREVIEW021-007 | unit — 동기·예외 안전·재실행 없음 |
| AC-PREVIEW021-009 | REQ-PREVIEW021-001 | unit — 원본 보기·폴백 미적용 |
| AC-PREVIEW021-010 | REQ-PREVIEW021-008 | M1 관문 기록 + unit(선택 경로) |
| AC-PREVIEW021-011 | REQ-PREVIEW021-009, 010 | unit + grep + git diff |
| AC-PREVIEW021-012 | REQ-PREVIEW021-001, 004, 008 | e2e(Playwright WebKit, 부분 증거) + 수동 M-1·M-2 |

검증 계층 원칙: 탐색·추출·조립은 순수 문자열 함수라 vitest + jsdom으로 충분하다. jsdom에서 pele는 내장 글자 폭 표를 쓰고 `readPeleThemeValues`는 빈 표를 돌려주므로(대체값 사용), 단위 테스트는 구조(SVG 존재·`var(--pele-` 0개·감싸개 속성·바이트 보존)만 단언하고 실제 색·글꼴·라벨 넘침은 e2e와 실기기 수동 확인이 맡는다. Playwright WebKit 결과는 WKWebView·WebView2 실기기 증거가 아니다.

글꼴 삽입 상태 규칙: 단위 AC-001~009·011은 **글꼴 삽입을 끈 상태**로 판정한다 — `P`를 직접 부를 때는 `prerenderMermaidBlocks(x, { fonts: false })`, 뷰어 시험(AC-001·008·009)은 뷰어가 기본값으로 부르므로 글꼴 `<style>`이 섞일 수 있지만, 그 시험의 단언(`<svg` 개수, 정확한 속성 개수, 호출 수, sandbox)은 글꼴 `<style>`과 겹치지 않는다(plan.md M4). 글꼴을 켠 상태(`{ fonts: true }`)는 AC-007 둘째 항목과 AC-010에서만 쓴다. 횟수를 세는 단언은 부분 문자열 `data-mdedit-diagram`이 아니라 정확한 속성 `data-mdedit-diagram=""`(또는 DOM 선택자 `[data-mdedit-diagram]`)로 센다 — `data-mdedit-diagram-fonts`·`data-mdedit-diagram-error`와 섞이지 않게 하기 위해서다.

아래에서 `P(x)`는 `prerenderMermaidBlocks(x)`, `OK`는 pele가 그릴 수 있는 원문 `flowchart LR\n  A --> B`, `BAD`는 그릴 수 없는 원문으로, 기존 `src/test/diagramRenderer.test.ts`가 쓰는 오류 픽스처 `errorSource('21-error-line-col')`(실측 `2행 14열`)를 뜻한다. `BAD0`는 위치가 0/0인 픽스처 `errorSource('22-error-line0-semantic')`다. 픽스처 원문을 블록 안에 넣을 때는 `&`·`<`·`>`를 엔티티로 바꿔 넣는다.

## 시나리오

### AC-PREVIEW021-001 — 선명 모드 srcdoc에 SVG (unit)

- **Given** 실제 렌더 모드가 `'crisp'`이고 `readFileSize`가 작은 값, `readFile`이 `<!doctype html><html><head></head><body><pre class="mermaid">OK</pre></body></html>`를 돌려주도록 모의했을 때, **When** `HtmlFileViewer`를 렌더하고 읽기가 끝나면,
- **Then** iframe `srcdoc`에 `<svg`가 정확히 1번 나오고 `data-mdedit-diagram=""`이 1번 나오며, 원문 `A --> B`는 블록 안에 남지 않는다.
- **And** iframe `sandbox`는 정확히 `"allow-scripts"`이고 `srcdoc`에는 019 주입(`<base`, `<style>html{zoom:`, 고정 스크립트)이 그대로 1번씩 있다.

### AC-PREVIEW021-002 — 감지: 잡는 것 (unit, 표 구동)

각 행의 입력을 `P`(글꼴 끔)에 넣으면 결과에 정확한 속성 `data-mdedit-diagram=""`이 기대 횟수만큼 있다.

| 입력 | 기대 횟수 |
|------|----------|
| `<pre class="mermaid">OK</pre>` | 1 |
| `<div class="mermaid">OK</div>` | 1 |
| `<PRE CLASS="mermaid">OK</PRE>` (태그·속성 이름 대문자) | 1 |
| `<pre class='diagram mermaid big'>OK</pre>` (작은따옴표, 여러 토큰) | 1 |
| `<div class=mermaid>OK</div>` (따옴표 없음) | 1 |
| `<div id="x" class="mermaid" data-a="1">OK</div>` (다른 속성 함께) | 1 |
| `<div class="mermaid"><div>OK</div></div><p>after</p>` (중첩 div — 바깥 블록 1개, `<p>after</p>`는 블록 밖에 그대로) | 1 |
| `<pre class="mermaid">OK</pre><div class="mermaid">OK</div>` (2개) | 2 |
| `<script>var s='<!--';</script><pre class="mermaid">OK</pre>` (스크립트 안의 닫히지 않은 `<!--`가 뒤 블록을 가리지 않음) | 1 |
| `<div title="a>b" class="mermaid">OK</div>` (따옴표 안 `>`) | 1 |
| `<div class="mermaid"><!-- </div> --><div>OK</div></div>` (주석 안 `</div>`는 깊이에 안 셈) | 1 |

### AC-PREVIEW021-003 — 감지: 잡지 않는 것 (unit, 표 구동)

각 행의 입력에 대해 `P(입력) === 입력`이다(바이트 동일).

| 입력 | 이유 |
|------|------|
| `<pre><code class="language-mermaid">OK</code></pre>` | 범위 밖 형식 |
| `<code class="mermaid">OK</code>` | `pre`·`div`가 아님 |
| `<div class="mermaid-x">OK</div>` / `<div class="Mermaid">OK</div>` | 토큰 불일치(대소문자 구분) |
| `<!-- <pre class="mermaid">OK</pre> -->` | 주석 안 |
| `<script>var s='<pre class="mermaid">OK</pre>'</script>` | 스크립트 안 |
| `<style>/* <div class="mermaid">OK</div> */</style>` | 스타일 안 |
| `<textarea><pre class="mermaid">OK</pre></textarea>` | textarea 안 |
| `<template><pre class="mermaid">OK</pre></template>` | template 안 |
| `<title><pre class="mermaid">OK</pre></title>` / `<noscript><div class="mermaid">OK</div></noscript>` | 원문 텍스트 요소 안 |
| `<pre class="mermaid">OK` (닫는 태그 없음) | 닫기 실패 |
| `<div class="mermaid"><svg id="m"></svg></div>` | 이미 그려짐(`<svg`) |
| `<pre class="mermaid" data-processed="true">OK</pre>` | 이미 그려짐(`data-processed`) |
| `<pre class="mermaid">   \n  </pre>` | 빈 원문(안내도 없음) |
| `` (빈 문자열) / `<p>no diagrams</p>` | 블록 없음 |

### AC-PREVIEW021-004 — 원문 추출 (unit)

pele에 넘기는 원문을 관찰하기 위해 테스트는 `renderExportDiagram`을 `vi.spyOn`(또는 모듈 모의)으로 감싸 첫 인자를 기록한다.

- `<pre class="mermaid">flowchart LR\n  A[R&amp;D] --&gt; B</pre>` → 원문 `flowchart LR\n  A[R&D] --> B`(엔티티 디코드. 첫 줄 들여쓰기가 0이라 dedent로 바뀌는 것은 없다).
- `<pre class="mermaid">\n    flowchart TD\n      A --> B\n    </pre>` → 원문 `flowchart TD\n  A --> B`(공통 4칸 제거, 앞뒤 trim).
- `<div class="mermaid">flowchart LR\n  A[a<br>b] --> B</div>` → 원문에 `a<br/>b`가 있다(`<br>` 요소 → 글자).
- `<div class="mermaid">flowchart LR\n  A[<b>x</b>] --> B</div>` → 원문에 `A[x]`(다른 태그는 버려짐).
- `&#65;`·`&#x41;` → `A`로 디코드된다.
- `<pre class="mermaid">\n\tflowchart TD\n\n\t  A --> B\n</pre>` → 원문 `flowchart TD\n\n  A --> B`(탭 접두사 공통 제거, 빈 줄은 계산에서 제외).
- `<pre class="mermaid">\n  &nbsp;flowchart TD\n  A --> B</pre>` → dedent는 공백 2칸만 걷어 내고(U+00A0는 공통 접두사에 넣지 않음), 마지막 `String.prototype.trim`이 앞의 U+00A0를 지워 원문은 `flowchart TD\nA --> B`다.
- 추출 중 `document.body`의 자식 수가 바뀌지 않는다(비활성 `<template>`만 사용).

### AC-PREVIEW021-005 — 렌더 삽입 (unit)

- **Given** 입력 `<body><pre class="mermaid" id="d1">OK</pre></body>`, **When** `P`, **Then**
  - 결과는 `<body><pre class="mermaid" id="d1" data-processed="true">`로 시작하고 `</pre></body>`로 끝난다(시작 태그는 표시 속성만 추가, 닫는 태그 원문 유지). 결과를 다시 `P`에 넣으면 같은 문자열이 나온다(이미 그려진 블록으로 건너뜀).
  - 시작 태그가 `<div class="mermaid"/>`·`<div class=mermaid >`처럼 `/>`·공백으로 끝나도 표시 속성은 `>`(또는 `/>`) 바로 앞에 한 번만 들어간다.
  - 그 사이는 `<div data-mdedit-diagram="" style="…">` 하나이고, 그 안에 `<svg` 1개가 있다.
  - 결과 전체에 `var(--pele-`가 0번 나온다.
  - 감싸개 `style`에 `background`·`border`·`border-radius`가 있고 값에 `var(`가 없다. jsdom(빈 값 표)에서는 값이 각각 `#FAF9F6`·`#97A4B1`·`3px`를 포함한다.
- **And** `renderExportDiagram`의 두 번째 인자는 `readPeleThemeValues('light')`의 결과이며, 블록이 3개여도 `P` 한 번 호출에 `readPeleThemeValues`는 1번만 호출된다.
- **And** 판단 노드가 있는 원문(`flowchart TD\n  A{x?} --> B`)이면 결과 SVG의 `.pele-shape-diam` 노드 `style`에 `--_s:`가 있다(모양 톤이 `renderExportDiagram`을 통해 들어옴).

### AC-PREVIEW021-006 — 실패 안내 (unit)

- **Given** 입력 `<pre class="mermaid">BAD</pre><p>x</p>`, **When** `P`, **Then** 결과는 `<pre class="mermaid">BAD</pre><p data-mdedit-diagram-error="" style="…">⚠ 이 다이어그램은 그릴 수 없었습니다…</p><p>x</p>`이다(블록 바이트 그대로 + 바로 뒤 안내 1개).
- **And** `BAD`이면 안내 문구가 정확히 `⚠ 이 다이어그램은 그릴 수 없었습니다 (2행 14열)`이고, `BAD0`이면 정확히 `⚠ 이 다이어그램은 그릴 수 없었습니다`다(실제 pele 실행, 모의 없음).
- **And** `renderExportDiagram`이 `null`, `renderDiagram`이 `{ ok: false, error: { code: 'x', message: '<img src=x onerror=alert(1)>', line: 1, column: 2 } }`를 돌려주도록 모의하면, 안내 `<p>`의 안쪽 HTML이 정확히 `⚠ 이 다이어그램은 그릴 수 없었습니다 (1행 2열)`이다(오류 메시지 문자열 미포함, 결과 전체에 `onerror`가 없다).
- **And** `renderExportDiagram`이 `null`인데 두 번째 `renderDiagram`이 `ok: true`를 돌려주도록 모의하면 안내 문구는 접미사 없이 정확히 `⚠ 이 다이어그램은 그릴 수 없었습니다`다.
- **And** 성공 1 + 실패 1 블록 입력에서 성공 블록은 그려지고 실패 블록에만 안내가 붙는다.

### AC-PREVIEW021-007 — 블록 밖 바이트 보존 (unit)

- 입력 `H = '<!doctype html>\n<html><head><script src="https://cdn.example/mermaid.js"></script><script>mermaid.initialize({theme:"dark"})</script></head><body>\n<p>앞</p>\n<pre class="mermaid">OK</pre>\n<p>뒤</p>\n</body></html>'`에 대해:
  - 글꼴 삽입을 끈 상태(`{ fonts: false }`)에서, `P(H)`에서 블록 안쪽 영역과 ` data-processed="true"` 삽입분을 빼고 이어 붙인 문자열이 `H`에서 같은 블록 안쪽 영역을 뺀 문자열과 같다.
  - 글꼴 삽입을 켠 상태(`{ fonts: true }`, 경로 (A)/(B)를 골랐을 때만)에서는 위 비교에서 `<style data-mdedit-diagram-fonts="">…</style>` 1개를 추가로 빼면 같다.
  - 두 `<script>` 태그가 바이트 그대로 남아 있다.
- AC-003 표의 모든 입력에서 `P(x) === x`.

### AC-PREVIEW021-008 — 동기·예외 안전·재실행 없음 (unit)

- `P`의 반환값은 `Promise`가 아닌 `string`이다.
- `renderExportDiagram`이 예외를 던지도록 모의하면 `P(x)`는 예외 없이 `x`를 그대로 돌려준다.
- `HtmlFileViewer` 선명 모드에서 읽기가 끝난 뒤 `htmlZoom`을 100 → 125로 바꾸거나 앱 테마를 바꿔도 `renderExportDiagram` 호출 수가 늘지 않고 iframe `srcdoc` 문자열이 같다.

### AC-PREVIEW021-009 — 원본 보기·폴백 미적용 (unit)

- 실제 렌더 모드가 `'original'`이면 iframe에 `srcdoc`이 없고 `src`(asset 주소)가 있으며 `renderExportDiagram`이 호출되지 않는다.
- 선명 모드에서 `readFileSize`가 10 MiB 초과(크기 폴백), `readFile`이 일반 오류로 거부(읽기 폴백), `readFile`이 `utf-8` 문구를 담은 오류로 거부(UTF-8 폴백)되는 세 경우 모두 `renderExportDiagram`이 호출되지 않는다.

### AC-PREVIEW021-010 — 글꼴 경로 (M1 관문 + unit)

- progress.md에 M1 결과표가 있다: macOS 개발·배포 빌드에서 경로 (A)의 `document.fonts.check` 결과·라벨 폭 관찰, 셸 CSP `font-src` 값(run 시점 origin/main), 선택한 경로 (A)/(B)/(C)와 근거. Windows 측정 시점과 정지 규칙은 바로 아래 항목을 따른다.
- M1 표는 OS·빌드별로 앱 출처, 굵기 ↔ 파일 대응(400 → `barlow-400.woff2`, 600 → 실제 고른 파일), `await document.fonts.load('600 16px Barlow')` 뒤의 `document.fonts.check` 결과, 라벨 폭 관찰을 적는다. macOS는 필수, Windows는 가능하면 M1에서 함께 잰다. Windows를 M1에서 재지 못했다면 M-2에서 Windows가 고른 경로로 실패할 때 run을 멈추고 코디네이터에 blocker로 올린다(조용히 넘어가지 않는다).
- 경로 (A) 또는 (B)를 골랐다면: 렌더 성공 블록이 1개 이상인 입력의 결과에 `data-mdedit-diagram-fonts` `<style>`이 정확히 1번, 어느 블록 안에도 있지 않은 마지막 `</body>` 바로 앞(없으면 끝)에 있고 — 블록 안쪽 원문에 `</body>` 글자가 있어도 그 위치는 쓰지 않는다 —, `font-family` 값에 `Barlow`가 있다. 성공 블록이 0개(실패만, 블록 없음)인 입력에는 없다.
- 경로 (C)를 골랐다면: 코디네이터를 거친 사용자 확인이 progress.md에 기록되어 있고, spec.md §3 한계에 글꼴 대체 항목이 추가되어 있다(manager-spec 개정).

### AC-PREVIEW021-011 — 보안·불변 형태 (unit + grep + git diff)

- `git diff origin/main -- index.html src/lib/preview/htmlSrcdoc.ts src/lib/diagram src/lib/export src-tauri` 출력이 없다.
- `grep -n 'sandbox="allow-scripts"' src/components/preview/HtmlFileViewer.tsx` 결과 1줄 이상(선명 분기 불변).
- `grep -n "innerHTML" src/lib/preview/htmlMermaid.ts`의 모든 결과가 `createElement('template')`로 만든 요소에 대한 것이다(코드 검토로 확인, 결과를 progress.md에 인용).
- `grep -n "@MX:WARN" src/lib/preview/htmlMermaid.ts` 1줄 이상, 바로 아래 `@MX:REASON` 있음. `grep -n "pre.mermaid\|div.mermaid" src/components/preview/HtmlFileViewer.tsx` 결과가 `@MX:NOTE` 주석 안에 있다(REQ-010).

### AC-PREVIEW021-012 — 실제 표시 (e2e 부분 증거 + 수동 M-1·M-2)

- e2e(Playwright, 기존 `webkit` 프로젝트, 기존 선명 모드 시드·`read_file` 모의 방식): HTML 상수에 `<pre class="mermaid">OK</pre>`, `<div class="mermaid">BAD</div>`, `<pre><code class="language-mermaid">OK</code></pre>`를 넣고 열면, 프레임 안에서 `[data-mdedit-diagram] svg` 1개, `[data-mdedit-diagram-error]` 1개가 보이고 `code.language-mermaid`는 글자 그대로다. 프레임 `script` 요소 중 페이지 것은 실행되지 않는다(019 동작 유지).
- 수동 M-1(macOS WKWebView·Windows WebView2): 같은 성격의 실제 HTML 파일(mermaid CDN 스크립트 포함)을 선명 모드로 열어 그림이 마크다운 미리보기와 같은 색(잉크 앤 허니 바탕 `#FAF9F6`, 판단 노드 허니 톤)으로 보이고, '원본 보기'로 바꾸면 페이지 자체 mermaid가 그린다.
- 수동 M-2(두 OS): 라벨이 노드 상자 밖으로 넘치지 않는다(REQ-008 경로 결과 확인). 150%·200% 배율에서 그림이 선명하다.

## 수동 검증 항목 (실기기, OS별 기록)

| ID | 내용 | macOS (WKWebView) | Windows (WebView2) |
|----|------|-------------------|--------------------|
| M-0 | 글꼴 관문 (M1, AC-010) — **run 첫 관문** | 필수 | 가능하면 M1에서, 못 하면 M-2에서(실패 시 정지 — AC-010) |
| M-1 | 선명 모드 그림 표시·색·원본 보기 대조 (AC-012) | 필수 | 필수 |
| M-2 | 라벨 넘침 없음·배율 선명도 (AC-012) | 필수 | 필수 |

## 경계 사례

- `<pre class="mermaid">` 바로 뒤 줄바꿈: 안쪽 HTML을 `<template>`에 넣을 때는 `pre`가 아니라 내용만 파싱되므로 줄바꿈은 남고, 마지막 trim 단계에서 사라진다(AC-004).
- 같은 문서에 블록 수십 개: 동기 렌더로 한 번에 처리한다(spec §3 한계 6). 시험은 블록 20개 입력에서 결과 블록 수 20을 확인하는 정도로 둔다.
- `div.mermaid` 안에 `</div>`를 담은 주석: 가림 사본에서 주석이 공백이 되어 깊이 계산이 흔들리지 않는다.
- 블록 안에 `<script>`: 블록 안쪽은 교체되거나(성공) 그대로 남는다(실패). 어느 쪽이든 그 스크립트는 셸 CSP 때문에 실행되지 않는다(019 동작).

## 품질 게이트

- `npx vitest run src/test/htmlMermaid.test.ts src/test/HtmlFileViewerCrisp.test.tsx src/test/HtmlFileViewer.test.tsx src/test/htmlSrcdoc.test.ts src/test/htmlSrcdocCsp.test.ts src/test/exportDiagram.test.ts` 통과. 전체 스위트는 CI가 돌린다.
- `npx tsc --noEmit` 오류 0, 바꾼 파일에 대한 `npx eslint` 새 오류 0.
- `npx playwright test e2e/html-file-viewer.spec.ts` 통과.

## Definition of Done

- run 단계 완료: 활성 AC 001~011 PASS + AC-012의 e2e 부분 PASS + 품질 게이트 통과. 미검증 항목이 있으면 완료가 아니다. AC-012의 수동 부분(M-1·M-2)은 SPEC을 `completed`로 닫는 조건이다.
- run 착수 조건: SPEC-PREVIEW-019·015 `status: completed` 확인 + origin/main 병합(t1·t3 반영) + M1 글꼴 관문 결과 기록.
- SPEC을 `completed`로 닫으려면 수동 M-0~M-2가 macOS·Windows 모두에서 progress.md에 OS별로 남아 있어야 한다.
