# SPEC-PREVIEW-021 동기화 감사 보고서 (sync-auditor)

- 대상: SPEC-PREVIEW-021 (카드 t2) — HTML 미리보기 선명 모드에서 `pre.mermaid`·`div.mermaid` 블록을 pele SVG로 미리 그리기
- 범위: `git diff 8e5f1b8...HEAD` (src/, e2e/, CHANGELOG.md, docs/USER_MANUAL.md, SPEC 4개 문서). 브랜치 `WT-mermaid-prerender`, HEAD `782541e`
- 계층: Tier M (통과 기준 0.80). 감사 방식: 독립 재실행 + 소규모 임시 프로브(저장소 밖으로 옮겨 둠, 추적 파일 변화 없음)

## 쉬운 말 요약

선명 모드에서 HTML 안의 mermaid 블록을 앱이 미리 그림으로 바꿔 넣는 기능이 설계대로 동작합니다. 직접 다시 돌린 테스트 167개가 모두 통과했고, 새 모듈의 문장 커버리지는 98.25%입니다. 악의적인 라벨(`</script>`, `<img onerror>`, `<svg onload>`)을 넣어 봤지만 모두 글자로 이스케이프되어 스크립트가 끼어들 길은 찾지 못했습니다. 고칠 만한 점은 세 가지입니다. (1) `>` 문자가 하나도 없는 이상한 파일에서 정규식이 매우 느려질 수 있습니다. (2) 테스트 하나가 아무것도 검증하지 못하는 단언입니다. (3) CHANGELOG가 호출 순서를 반대로 적었습니다. 배포 빌드·Windows 글꼴과 색·라벨 넘침은 아직 사람이 보지 않았고, 이는 SPEC에 이미 PARTIAL로 적혀 있어 `implemented`(completed 아님)가 맞습니다.

## 판정

**PASS-WITH-DEBT** (전체 0.85 / 기준 0.80). BLOCKING 결함 없음. 필수 통과 차원(Functionality, Security) 모두 0.80 이상.

| 차원 | 점수 | 판정 |
|------|------|------|
| Functionality | 0.85 | PASS |
| Security | 0.84 | PASS |
| Craft | 0.82 | PASS |
| Consistency | 0.88 | PASS |
| 전체(조화평균) | 0.85 | PASS-WITH-DEBT |

조화평균 계산: 4 / (1/0.85 + 1/0.84 + 1/0.82 + 1/0.88) = 4 / 4.7228 = 0.847. 점수는 감사자 판단이며 측정값이 아니다.

## 1. Claim (주장)

- C1: AC-001~009·011은 구현·테스트가 충족한다. AC-010·012는 PARTIAL(수동 대기)이다.
- C2: `htmlMermaid.ts`는 블록 감지·원문 추출·오프셋 교체·바이트 보존·실패 안내(오류 메시지 없음)·예외 시 입력 반환을 만족한다.
- C3: 보안 경계(sandbox, CSP, `index.html`, `htmlSrcdoc.ts`, `src/lib/diagram`, `src/lib/export`, `src-tauri`)는 변하지 않았고 페이지 콘텐츠가 사전 렌더 경로로 스크립트를 주입할 수 없다.
- C4: CHANGELOG·USER_MANUAL 서술은 코드와 일치한다.
- C5: `status: implemented`가 맞고 progress.md §E.4는 갭을 정직하게 적었다.

## 2. Evidence (증거)

### 2.1 직접 실행한 명령과 출력

```
$ npx vitest run src/test/htmlMermaid.test.ts src/test/HtmlFileViewerCrisp.test.tsx src/test/HtmlFileViewer.test.tsx src/test/htmlSrcdoc.test.ts src/test/htmlSrcdocCsp.test.ts src/test/exportDiagram.test.ts --coverage --coverage.include=src/lib/preview/htmlMermaid.ts --coverage.reporter=text
 ✓ src/test/htmlMermaid.test.ts (57 tests) 449ms
 ✓ src/test/HtmlFileViewerCrisp.test.tsx (21 tests) 345ms
 ✓ src/test/exportDiagram.test.ts (27 tests) 597ms
 Test Files  6 passed (6)
      Tests  167 passed (167)
 File            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
 htmlMermaid.ts  |   98.25 |    86.45 |     100 |   98.25 | 109-110,161

$ npm run typecheck
> mdedit@0.20.0 typecheck
> tsc --noEmit            (오류 출력 없음)

$ npx eslint src/lib/preview/htmlMermaid.ts src/components/preview/HtmlFileViewer.tsx src/test/htmlMermaid.test.ts src/test/HtmlFileViewerCrisp.test.tsx e2e/html-file-viewer.spec.ts --report-unused-disable-directives --max-warnings 0
(출력 없음)

$ git diff 8e5f1b8 HEAD --stat -- index.html src/lib/preview/htmlSrcdoc.ts src/lib/diagram src/lib/export src-tauri | wc -l
0

$ grep -n "innerHTML" src/lib/preview/htmlMermaid.ts
133:  tpl.innerHTML = innerHtml;          (바로 위 132행: document.createElement('template'))

$ grep -n 'sandbox="allow-scripts"' src/components/preview/HtmlFileViewer.tsx
162:        sandbox="allow-scripts"

$ grep -n "@MX:WARN\|@MX:REASON" src/lib/preview/htmlMermaid.ts
176:// @MX:WARN: srcdoc에 들어가는 마크업은 정화된 pele SVG와 이 파일의 고정 문자열만으로 조립한다
177:// @MX:REASON: srcdoc 안 페이지는 allow-scripts 샌드박스다. ...
```

### 2.2 프로브 출력 (임시 vitest, 저장소 밖 보관: `/private/tmp/claude-501/-Users-byunjungwon-Dev-my-project-01-markdown-editor-rust/81e5a7d0-6fac-4ecd-a42a-4150eb600a9b/scratchpad/probe-021.test.ts`, `probe-021b.test.ts`)

적대적 라벨 (모두 `<pre class="mermaid">` 안, 엔티티로 이스케이프해 넣음):

| # | 입력 요지 | 결과 |
|---|-----------|------|
| 0 | 라벨 `<img src=x onerror=alert(1)>` | pele가 그리지 못함 → 원문 유지(이스케이프된 `&lt;img…`) + 안내 `(2행 29열)`. 안내에 오류 메시지 없음 |
| 1 | 라벨 `</script><script>alert(1)</script>` | 그려짐, 결과에 `<script` 0개 |
| 2 | 라벨 `</style><script>alert(2)</script>` | 그려짐, 결과에 `<script` 0개 |
| 3 | `click A href "javascript:alert(3)"` | 그려짐, `javascript:` 0개 |
| 4 | `style A fill:red" onload="alert(4)` | 그리지 못함 → 원문 유지(블록 안은 `<pre>` 텍스트) + 안내 |
| 5 | 라벨 `<svg onload=alert(5)>` | 그려짐. `onload`는 `<text class="pele-label">&lt;svg onload=alert(5)&gt;</text>` 안의 이스케이프된 글자일 뿐 |
| 6 | 라벨 `a</pre><script>alert(6)</script>` | 블록이 `</pre>`에서 끊겨 그리지 못함 → 원문 유지 + 안내, `<script` 0개 |

주의: 0번·4번의 `onerror`·`onload` 일치는 원문 블록을 바이트 그대로 둔 부분(이스케이프된 텍스트)에서 나왔으며 실행 가능한 속성이 아니다.

동작 프로브:

```
### attr with <!-- value then block                  false   (아래 F6)
### pre.mermaid containing code child                true
### init directive (%%{init…}%%)                     true
### graph TD classic / sequenceDiagram              true / true
### data-processed-by substring attr                 true  (정확 일치만 건너뜀)
### uppercase DATA-PROCESSED                         false (건너뜀, 의도대로)
### fail+fonts same-offset  → …</pre><style data-mdedit-diagram-fonts="">…</style><p data-mdedit-diagram-error="" …>⚠ …(1행 6열)</p></body>
### location.origin  http://localhost:3000
```

성능 프로브:

```
### unclosed <div x20000      3811 ms
### unclosed <div x40000     15507 ms
### unclosed <div x80000     64294 ms
### unclosed <pre x40000     16282 ms
### unclosed <script x40000  20768 ms
### realistic 10000 rows (1.2 MB, no mermaid): 3 ms
### realistic 20000 rows (2.5 MB, no mermaid): 4 ms
### realistic 40000 rows (5.0 MB, no mermaid): 15 ms
### unclosed <div x20000 then one '>' at end: 0 ms
### <div a=" x20000: 1 ms
### 'x <pre ' x20000: 6614 ms
```

### 2.3 AC 매트릭스 (감사자 판정)

| AC | 판정 | 근거 |
|----|------|------|
| 001 | PASS | `HtmlFileViewerCrisp.test.tsx:271-282` (srcdoc `<svg` 1, `data-mdedit-diagram=""` 1, sandbox `allow-scripts`, `<base`·`<style>html{zoom:` 각 1) 재실행 통과 |
| 002 | PASS | `htmlMermaid.test.ts:50-73` 12행 + 중첩 div 뒤 `<p>after</p>` 보존 |
| 003 | PASS | `:75-98` 17행 모두 `P(x) === x` |
| 004 | PASS | `:100-136` 8케이스 (엔티티·dedent·`<br/>`·태그 제거·숫자 엔티티·탭·U+00A0·body 자식 수) |
| 005 | PASS(일부 약함) | 속성 삽입·감싸개·`/>`·1회 호출·20블록은 확인. 판단 노드 톤 단언 `:176-179`은 공허함(F2) |
| 006 | PASS | `:187-225` 실제 pele `(2행 14열)`, 위치 0이면 접미사 없음, 모의한 오류 메시지 `onerror`가 결과에 없음 |
| 007 | PASS | `:227-250` 글꼴 끔·켬 두 경우 + 스크립트 보존 |
| 008 | PASS(일부 약함) | 동기 string, 예외 시 입력 반환, 배율 변경 후 호출 수·srcdoc 불변. "앱 테마 변경" 절반은 시험 없음(F5) |
| 009 | PASS | 원본 보기·크기/읽기/UTF-8 폴백에서 `renderExportDiagram` 미호출 |
| 010 | PARTIAL | 글꼴 `<style>` 위치·수 단위 시험 통과. macOS 개발 빌드만 화면 관찰, `document.fonts.check`·배포·Windows 미측정(progress.md 표에 그대로 적힘) |
| 011 | PASS | 불변 파일 diff 0줄, sandbox 유지, `innerHTML`은 `template` 1곳, `@MX:WARN`+`@MX:REASON` 있음. 문구 일치는 F4 참고 |
| 012 | PARTIAL | e2e 부분 증거(작성 확인; 이번 감사에서 Playwright는 재실행하지 않음). 수동 M-1·M-2 대기 |

e2e 실패 픽스처 `sequenceDiagram\n  A->>B hello`는 `errors.json`의 `21-error-line-col` 원문과 동일함을 확인했다.

### 2.4 코드 검토 소견 (htmlMermaid.ts)

- 블록 감지: 주석·원문 텍스트 요소를 같은 길이 공백으로 가린 사본에서 찾고(`:34-62`), 교체는 원본의 오프셋에 대해서만 한다(`:218-221`, 큰 오프셋부터). 바이트 보존 구조가 맞다.
- 원문 추출: 비활성 `<template>` + `<br>`→`<br/>` + dedent + trim (`:131-138`). 스펙 REQ-003과 일치.
- 실패 안내: 고정 문자열 + 정수만 사용 (`:152-163`). `Math.trunc` 사용, 오류 메시지 문자열 미사용.
- 글꼴 `<style>`: 부모 문서의 `location.origin`을 `SAFE_ORIGIN`으로 거른 뒤 보간(`:16`, `:166-172`). `'`·`)`·`<`·`;`가 통과하지 못해 CSS/HTML 탈출 경로가 없다. 삽입 위치는 어느 블록 안에도 있지 않은 마지막 `</body>` 앞(`:204-214`).
- 예외 안전: 전체가 `try/catch`로 감싸져 입력을 그대로 돌려준다(`:222-224`).
- 동일 오프셋 편집 순서: 실패 안내와 글꼴 `<style>`이 같은 위치면 `<style>`이 안내 앞에 놓인다(위 프로브). 동작에는 영향 없는 순서 차이.

### 2.5 문서 주장 대조

- CHANGELOG.md:7 "`prerenderMermaidBlocks`가 `buildSrcdoc` 결과를 받아 블록만 바꾸는 동기 함수" ← 코드는 반대 순서다. `HtmlFileViewer.tsx` diff: `buildSrcdoc(prerenderMermaidBlocks(text), {…})`. 스펙 REQ-007도 "`buildSrcdoc` 직전". 틀린 서술(F3).
- CHANGELOG의 나머지(감지 2종, 실패 시 원문+안내, 오류 메시지 미포함, 예외 시 입력 반환, 글꼴 경로 (A) 조건부 주입, 불변 파일 목록, 미확인 항목)는 코드·progress.md와 일치.
- CHANGELOG의 "118 파일, 2039 테스트"는 progress.md §E.4가 "오케스트레이터가 재실행해 전달한 값"이라 명시한 값이다. 산술은 §E.2(117/2028)에 SEC-002 병합분(+1 파일, +11 테스트: 2028+11=2039)을 더한 값과 맞다. 이번 감사에서 전체 스위트는 재실행하지 않았다.
- USER_MANUAL.md:472, 480 수정은 코드 동작과 일치한다.
- `status: implemented`(spec.md frontmatter 확인)는 맞다. AC-010·012 PARTIAL이고 수동 M-0~M-2가 macOS·Windows 양쪽에 없으므로 `completed`는 DoD 위반이다.
- progress.md §E.4의 갭 서술은 정직하다: 배포·Windows 글꼴, `document.fonts.check` 부재, 전체 스위트 재실행이 오케스트레이터 전달값이라는 점을 모두 적었다.

## 3. Baseline-attribution (baseline 귀속)

- 위 모든 명령은 이번 실행에서, 이 트리(HEAD `782541e`, 워크트리 `.claude/worktrees/html-mermaid-prerender`)에 대해 직접 실행했다. `git status --short` 결과는 감사 시작 시와 같다(`M .moai/state/session-memo.md`, `?? .moai/logs/` 두 줄만).
- 프로브 테스트 파일 2개는 gitignore된 `.moai/state/verify/`에 잠시 두었다가 스크래치패드로 옮겼다(Write 훅과 heredoc 가드가 스크래치패드 직접 쓰기를 막았기 때문). 삭제(`rm`)는 하지 않았다.
- 비교 기준: `8e5f1b8`(origin/main, 병합 완료).

## 4. Gaps (미검증)

- 전체 vitest 스위트(118 파일/2039 테스트)는 재실행하지 않았다. progress.md가 전하는 값에 의존한다. CPU 절약 요청에 따라 SPEC 품질 게이트 6개 파일만 돌렸다.
- Playwright e2e 5건은 재실행하지 않았다(작성만 검토).
- 실제 브라우저(WKWebView·WebView2)에서의 글꼴 로드, CORS(불투명 출처 srcdoc에서 `tauri://localhost/fonts/*.woff2` 요청), 색(`#FAF9F6`·판단 노드 톤), 라벨 넘침, 150%·200% 선명도는 jsdom으로 볼 수 없다. 사람 수동 확인(M-0~M-2) 전까지 미검증.
- `readPeleThemeValues('light')`가 실기기에서 토큰 값을 해결해서 돌려주는지(jsdom은 빈 표) 미확인. 빈 표면 폴백 리터럴로 떨어져 색 자체는 같지만, 값이 `var(...)`로 남는 경우의 동작은 보지 못했다.
- pele SVG 정화기 자체의 완전성은 이 SPEC 이전 코드라 재감사하지 않았다. 적대적 라벨 7종에서 주입은 없었다는 사실만 확인했다.
- 코드 경로 커버리지 미커버 줄: `htmlMermaid.ts` 109-110(`findClosing`의 `div` 깊이 미달 반환), 161(`failureNote`의 `catch`).

## 5. Residual-risk (잔여 위험)

- 배포 빌드·Windows에서 글꼴이 막히면 pele가 재어 둔 글자 폭과 달라 라벨이 노드 밖으로 넘칠 수 있다. 코드 주석과 CHANGELOG에는 적혀 있다.
- SPEC-PREVIEW-020 기본값 때문에 Windows 사용자는 기본이 원본 보기라서 이 기능을 기본으로는 보지 못한다. 선명 모드를 직접 골라야 한다.
- 동기 렌더라 블록이 매우 많은 문서에서는 UI가 잠시 멈춘다(spec §3 한계 6, 수용됨).
- 페이지 CSS가 `.mermaid`·`pre`에 준 스타일은 그대로 적용된다(spec §3 한계 5).
- F1(정규식 폭주)은 `>`가 하나도 없는 조작된 파일에서만 재현된다. 하지만 탐색기가 모든 파일을 노출하고 선명 모드가 macOS·Linux 기본이라, 그런 파일을 단순히 선택하는 것만으로 메인 스레드가 멈추면 저장 안 된 편집 내용을 잃을 위험이 있다.

## 결함 목록 (구조화)

| ID | 심각도 | 분류 | 위치 | 설명 | 필수 수정 |
|----|--------|------|------|------|-----------|
| F1 | SHOULD-FIX | optional (수정 강력 권장) | `src/lib/preview/htmlMermaid.ts:8-12` (`ATTRS`, `SCAN_RE`, `BLOCK_RE`, `DIV_DEPTH_RE`) | 시작 태그 속성 정규식이 닫는 `>`를 못 찾으면 시작 태그 수에 대해 이차 시간이 든다. `<div ` 20,000개(약 100 KB, `>` 없음)에 3.8초, 40,000개 15.5초, 80,000개(약 400 KB) 64초, `x <pre ` 20,000개 6.6초. 10 MiB 상한이면 사실상 정지. 실제 HTML 5 MB는 15 ms로 선형이고, 뒤에 `>`가 하나만 있어도 0 ms. 즉 `>` 없는 조작된 파일에서만 발생. 이전에는 미리보기 단계에 정규식 스캔이 없었으므로 회귀다 | (a) 입력에 `mermaid`(대소문자 무시)가 없으면 스캔 전에 `return html`로 빠진다. (b) 속성 스캔을 원자적으로(`(?=(…))\1` 또는 수동 스캐너) 만들거나, 길이/시간 상한을 둬서 초과 시 입력을 그대로 돌려준다. (c) 조작 입력(`'<div '.repeat(40000)`)이 수백 ms 안에 끝나는 회귀 시험 추가 |
| F2 | SHOULD-FIX | optional | `src/test/htmlMermaid.test.ts:176-179` | "판단 노드에 모양 톤이 들어온다" 단언 `toContain('--_s:')`이 공허하다. 판단 노드가 없는 출력에서도 svg 루트 style에 `--_s:#f3f3f3`이 이미 있다(프로브 출력). AC-005 셋째 항목(`.pele-shape-diam` 노드 style의 `--_s:`)을 실제로 검증하지 못한다 | 출력 문자열을 `template`/`DOMParser`로 파싱해 `.pele-shape-diam`의 `style`에 `--_s:`가 있는지, 그리고 사각 노드(`pele-shape-rect`)에는 톤이 추가되지 않았는지를 단언 |
| F3 | SHOULD-FIX | optional (사용자에게 가는 문서, 한 줄 수정) | `CHANGELOG.md:7` | "`buildSrcdoc` 결과를 받아 블록만 바꾸는 동기 함수"는 틀렸다. 실제는 파일 텍스트를 먼저 변환하고 그 결과를 `buildSrcdoc`에 넣는다(`HtmlFileViewer.tsx` `buildSrcdoc(prerenderMermaidBlocks(text), …)`, REQ-007 "`buildSrcdoc` 직전") | "읽은 HTML 텍스트를 받아 블록만 바꾼 뒤 `buildSrcdoc`에 넘기는 동기 함수"로 고친다 |
| F4 | MINOR | optional | `src/lib/preview/htmlMermaid.ts:1-3`, `src/components/preview/HtmlFileViewer.tsx:72-75` | REQ-PREVIEW021-010은 `@MX:NOTE`와 새 모듈 머리 주석에 한계 1·2·4(감지 2종만, **페이지** mermaid 테마 무시, 원본 보기 미적용)를 한 줄씩 적으라고 한다. 뷰어 NOTE는 한계 1과 앱 테마/글꼴 한계는 적었으나 페이지 테마 무시·원본 보기 미적용이 없고, 모듈 머리 주석에는 셋 다 없다. AC-011 문자 그대로(grep 결과가 NOTE 안)는 통과 | 두 주석에 한계 2·4 각 한 줄, 모듈 머리 주석에 한계 1 한 줄 추가 |
| F5 | MINOR | optional | `src/test/HtmlFileViewerCrisp.test.tsx:284-296` | AC-008 "앱 테마를 바꿔도 호출 수·srcdoc 불변" 절반은 시험이 없다(`htmlZoom`만 바꿈) | 앱 테마 변경 이벤트를 하나 발생시키는 단언 추가, 또는 AC 문구를 배율만으로 정정 |
| F6 | MINOR | optional | `src/lib/preview/htmlMermaid.ts:9-10, 34-52` | 속성 값 안의 `<!--`(예: `<div title="<!--">`)가 주석으로 가려져 다음 `-->`(없으면 문서 끝)까지 뒤쪽 mermaid 블록이 조용히 그려지지 않는다(프로브: false). 안전한 방향의 과소 감지(원문 그대로) | 수용 가능. spec §3 한계 9에 한 줄 기록하거나, 속성 값을 건너뛰도록 `SCAN_RE`에 일반 태그 분기 추가 |
| F7 | MINOR | optional | `.moai/specs/SPEC-PREVIEW-021-html-mermaid-prerender/progress.md` §E.2 AC-010, acceptance.md "Definition of Done" | 기록은 정직하다. 다만 DoD는 "run 단계 완료: AC 001~011 PASS"를 요구하는데 AC-010은 PARTIAL(`document.fonts.check` 값 없음, macOS 배포 미측정)이다. 사용자 지연 결정이 progress.md에 적혀 있으나 acceptance.md의 DoD에서 이를 PASS-WITH-DEBT로 연결하는 문장은 없다 | 별도 조치 불필요. 수동 확인 결과가 들어올 때 AC-010 행을 갱신 |

BLOCKING 결함: 없음.

## 권고

1. F1·F3은 비용이 매우 작으므로 병합 전에 고치는 것을 권한다(F1의 (a) 한 줄만으로 일반 파일의 위험이 사라진다). F2도 같은 커밋에 넣기 쉽다.
2. F4~F7은 다음 개정 때 처리하면 된다.
3. SPEC은 `implemented`로 두고, 0.21.0 초안 빌드의 수동 M-0(배포·Windows 글꼴)·M-1(색·원본 대조)·M-2(라벨 넘침·150/200%)가 macOS·Windows 양쪽에서 기록된 뒤에만 `completed`로 올린다.
