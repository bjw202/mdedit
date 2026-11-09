# SPEC Review Report: SPEC-PREVIEW-019
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.74 (Tier M 통과 기준 0.80 미달)

Reasoning context ignored per M1 Context Isolation. 오케스트레이터가 전한 배경(사용자 결정 Q1·Q2, SEC-001 병행 계획)은 "어디를 볼지"의 단서로만 썼다. 판정 근거는 SPEC 4개 파일, worktree 코드(HEAD c892654), 주 체크아웃의 018 감사 보고서, 그리고 아래 실측뿐이다.

## 요약

설계의 뼈대는 맞다. 프런트매터, REQ·AC 번호, GEARS 형식, 제외 범위, SEC-001 의존 선언과 run 시작 관문이 모두 제대로 들어 있다. 핵심 장치인 "셸 CSP에 해시 1개 → 상속된 CSP 아래에서 주입 스크립트만 실행 → `postMessage`로 `documentElement.style.zoom` 변경"은 실측에서 Chromium과 Playwright WebKit 둘 다 그대로 동작했다.

그러나 같은 실측에서 SPEC이 사실이라고 적은 주장 세 개가 틀렸다. (1) 상속된 `style-src 'self' 'unsafe-inline'`가 asset 출처의 `<link rel=stylesheet>`를 막는다. SPEC은 동일 폴더 스타일시트가 "동작한다"고 적었고 M-2도 그렇게 기대하는데, REQ-006은 `style-src` 변경을 금지한다. 즉 지금 설계로는 대부분의 HTML 파일이 스타일 없이 보인다. (2) "선명 모드에서 페이지 자체 스크립트는 계속 차단된다"는 주장은 프레임이 다른 문서로 이동하면 깨진다. `<meta http-equiv="refresh">`(클릭 없이)나 상대 링크 클릭으로 asset 문서로 이동하면 CSP 없이 페이지 스크립트가 실행된다. (3) `srcdoc` 문서는 doctype과 관계없이 항상 표준 모드라서, doctype이 없는 파일은 원본 보기(quirks 모드)와 렌더가 달라진다. REQ-003의 "렌더 모드를 바꾸지 않는다"는 사실과 다르다.

이 밖에 CI 얕은 클론에서 실패하는 AC-006 기준선, 프로젝트에 없는 Chromium e2e, 아직 `implemented` 상태인 018의 AC-007·완료 조건과의 충돌(미인정) 같은 결함이 있다. 결함 D1~D6을 고치기 전에는 run에 들어가면 안 된다.

### 실측 근거와 한계 (VCI §2)

- 명령: `node .moai/state/audit-scratch/run.cjs`(감사용 임시 스크립트, 실행 후 삭제·`git status --short`로 트리 깨끗함 확인). 셸 페이지는 `http://127.0.0.1:47811`, "asset" 서버는 `http://localhost:47812`로 두고, `index.html` 메타 CSP와 같은 구조(asset 출처만 포트 출처로 바꿈, `script-src`에 주입 스크립트 sha256 추가)를 적용한 뒤 `sandbox="allow-scripts"` `srcdoc` iframe을 띄웠다. Playwright 1.58.2(주 체크아웃 `node_modules`), 브라우저 chromium·webkit.
- 관찰 출력(두 엔진 동일):
  ```
  {"hash":"1","page":null,"color":"rgb(0, 0, 0)","img":1,"origin":"null","mode":"CSS1Compat","zoomAfterMsg":"1.5",
   "afterNavUrl":"http://localhost:47812/other.html","otherRan":"1","noDoctypeMode":"CSS1Compat",
   "refreshUrl":"http://localhost:47812/other.html","refreshOtherRan":"1"}
  chromium: Loading the stylesheet 'http://localhost:47812/style.css' violates ... "style-src 'self' 'unsafe-inline'"
  webkit:   Refused to load http://localhost:47812/style.css because it does not appear in the style-src directive
  ```
  읽는 법: 해시 스크립트 실행됨, 페이지 인라인 스크립트 차단됨, asset 스타일시트 **차단됨**(본문 색이 빨강이 아님), asset 이미지 로드됨, 출처 `null`, 배율 메시지 적용됨, 링크 클릭·meta refresh 뒤 asset 문서의 스크립트 **실행됨**, doctype 없는 srcdoc은 표준 모드.
- 한계: 실제 앱은 `tauri://localhost`·`asset://localhost`(Windows는 `http://tauri.localhost`·`http://asset.localhost`)이고 이 시험은 포트로 구분한 http 출처다. CSP `'self'`는 스킴·호스트가 다른 출처와 일치하지 않으므로 결론은 같다고 보지만, 실제 WKWebView·WebView2에서 재현한 것은 아니다. Playwright WebKit은 WKWebView와 같은 엔진 계열이지만 같은 빌드가 아니다.

## Must-Pass Results

- [PASS] MP-1 REQ 번호 일관성: spec.md L42·L48·L54·L60·L68·L74·L81·L88·L94·L100·L105·L112 — REQ-PREVIEW019-001~012, 빈 번호·중복 없음. AC는 acceptance.md L27~L138에서 001~015 연속. REQ 12·AC 15로 Tier M 상한(각 16) 이내.
- [PASS] MP-2 GEARS 형식 (요구 층 REQ-XXX 기준으로 판정, AC는 Given-When-Then이 맞는 형식이라 판정 대상 아님): 모든 REQ 항목이 "The <주어> shall …"(L44, L51, L76), "When …, the … shall …"(L46, L62, L83), "While …, when …, the … shall …"(L50), "While …"(L90, L96) 꼴이다. "사유:"(L72, L86)와 "(열린 질문 …)"(L92)은 명시적 비규범 주석이다. 다만 "shall not … 않는다" 이중 부정(L78, L102-103, L108)은 문면상 뜻이 뒤집힐 여지가 있어 D12로 따로 적는다(형식 위반은 아님).
- [PASS] MP-3 프런트매터: spec.md L2-13 — `id: SPEC-PREVIEW-019`, `title`(따옴표), `version: "0.1.0"`, `status: draft`, `created`/`updated: 2026-11-09`, `author`, `priority: High`, `phase: "v0.21.0 target"`(릴리스 대상, 금지 값 아님), `module`, `lifecycle: spec-anchored`, `tags`(쉼표 문자열) 12개 모두 있음. 금지 별칭 없음. 선택 필드 `tier: M`(L14), `depends_on: [SPEC-SEC-001]`(L15), `related_specs`(L16).
- [N/A] MP-4 언어 중립성: 단일 프로젝트(Tauri + React) 범위. 여러 언어 도구를 다루지 않는다.
- [PASS] MP-5 D7: 본문 참조 SPEC은 SPEC-SEC-001, SPEC-PREVIEW-004, SPEC-PREVIEW-018. `grep '^status:'` 결과 004 `completed`, 018 `implemented`. retired·superseded·archived 없음 → BLOCKING 없음. SPEC-SEC-001은 이 worktree에 없어 D7-5 SHOULD("referenced SPEC not found")에 해당하나, 다른 worktree에서 병행 계획 중인 의존 SPEC이며 `depends_on`(L15)과 run 시작 관문(spec.md L121, plan.md L45, acceptance.md L171)이 선언되어 있어 결함으로 세지 않는다.
- [PASS] MP-6 D8: spec·plan·acceptance·progress 모두 `syscall` 0회(`grep -c syscall` 결과 각 0). 자동 통과.
- [PASS] MP-7 clarification gate: `grep -rn 'NEEDS CLARIFICATION' .moai/specs/SPEC-PREVIEW-019-html-crisp-zoom/` 결과 없음. research.md 없음(Tier M이라 필수 아님).

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 | 대부분 해석이 하나로 정해진다(REQ-003 L56-58 주입 순서·위치, REQ-004 L62-66 메시지 형식·검사). 다만 REQ-005 L70의 `#top` 규칙이 `id="top"` 요소가 있을 때 어떻게 하는지 불명확(D8), REQ-002 L50 계기가 "파일을 열면"뿐이라 같은 파일에서 모드를 바꾸는 경우가 빠짐(D9), 이중 부정(D12) |
| Completeness | 0.75 | 0.75 | 필수 절 모두 있음(HISTORY L21, §1 L27, §2 L40, §3 L117, §4 L151, §5 L170의 `### Out of Scope — …` 7개, 각 `-` 항목 있음). 그러나 §3 한계 목록이 실제 동작과 어긋난다: 스타일시트 차단 누락·오기(D1), 이동 뒤 스크립트 실행 누락(D2), quirks 모드 차이 누락(D3), 018 미완료 상태와의 관계 누락(D4) |
| Testability | 0.60 | 0.50~0.75 사이 | 단위 AC 대부분은 이진 판정 가능(AC-001~005, 007~011). 그러나 AC-006(L84)은 CI 얕은 클론에서 `git show 57b3231` 실패(D5), AC-015(L140)·plan M7(L135)은 프로젝트에 없는 Chromium e2e를 전제(D6), AC-013 M-2(L127)는 설계상 성립할 수 없는 기대(D1), AC-014(L133)는 전제가 틀려 실제 공격 경로를 시험하지 않음(D2), AC-012(L123) "명확히 더 선명"은 판단 의존(D14) |
| Traceability | 0.90 | 0.75~1.0 사이 | 모든 REQ에 AC가 있고 고아 AC 없음. spec §4(L153-168)와 acceptance 추적 표(L5-21)가 일치. AC가 REQ에 없는 동작을 요구하는 경우 2건, REQ-012의 "외부 리소스" 문구를 AC-009가 검사하지 않음(D10) |

산출: 조화평균 4 / (1/0.75 + 1/0.75 + 1/0.60 + 1/0.90) ≈ 0.74.

## Defects Found (structured defect-list)

D1. CSP-STYLESHEET-BLOCKED — spec.md:L127, L134, L78 / acceptance.md:L127 — **상속된 `style-src`가 asset 출처 스타일시트를 막는다(실측).** 셸 메타 CSP(`index.html:7`)의 `style-src 'self' 'unsafe-inline'`에는 `asset:`·`http://asset.localhost`가 없고, `style-src`가 있으면 스타일시트에는 `default-src`가 쓰이지 않는다. `srcdoc`이 이 정책을 상속하므로 `<base>`로 풀린 `style.css`(asset 주소)는 차단된다. 실측에서 Chromium·WebKit 모두 차단 메시지를 냈고 본문 색이 바뀌지 않았다(위 실측 근거). 그런데 spec.md L134는 "`<link rel=stylesheet>`(동일 폴더 asset)은 동작한다", L127은 외부 http(s) 스타일시트만 막힌다고 적었고, acceptance.md L127(M-2)은 같은 폴더 `style.css`가 정상 로드된다고 기대한다. 동시에 REQ-006(L78)은 `style-src` 변경을 금지한다. 결과적으로 선명 모드(기본값)에서 외부 CSS 파일을 쓰는 대부분의 HTML이 스타일 없이 보이며, `<base>` 주입의 주된 목적 하나가 무너진다. 해시 장치의 설계 결정 Q1은 `script-src`만 다뤘으므로 이 문제는 사용자 결정 범위 밖이다. — Severity: critical — Class: blocking — Required fix: 오케스트레이터가 사용자 결정을 받아야 한다. 선택지 예: (a) 셸 `style-src`에 asset 출처(`asset: http://asset.localhost https://asset.localhost`)를 더한다 — REQ-006 L78의 "`script-src` 밖 지시어는 바꾸지 않는다"와 AC-006 L84를 함께 고치고, 셸 문서 자체에 미치는 영향(셸이 asset 스타일시트를 불러올 수 있게 됨)을 §3에 적는다. (b) 스타일시트 차단을 수용한다 — §3 한계 2·3(L133-134)을 "같은 폴더 스타일시트도 막힌다"로 고치고, M-2(acceptance L127)의 기대를 바꾸고, 헤더 툴팁(REQ-012)에 스타일시트를 넣는다. (c) 그 밖의 방법(예: 앱이 스타일시트를 읽어 인라인 `<style>`로 넣기)은 새 요구이므로 REQ·AC를 추가한다. 어느 쪽이든 실측 근거를 plan.md §A에 기록한다.

D2. SEC-SCRIPT-BLOCK-OVERCLAIM — spec.md:L126, L138 / plan.md:L35 / acceptance.md:L133-135 — **"선명 모드에서 페이지 자체 스크립트는 계속 차단된다"는 주장이 프레임 이동으로 깨진다(실측).** CSP 상속은 `srcdoc` 문서에만 적용된다. 프레임이 asset 문서로 이동하면 그 문서에는 CSP가 없고(`tauri.conf.json` `csp: null`, asset 응답에 CSP 헤더 없음), `sandbox="allow-scripts"`라 스크립트가 실행된다. 실측: 상대 링크 클릭 뒤 `otherRan: "1"`, 그리고 **클릭 없이** `<meta http-equiv="refresh" content="0;url=other.html">`만으로도 `refreshOtherRan: "1"`(두 엔진). 또한 표준상 파일 안의 `<iframe src="x.html">`(셸 `frame-src`가 `asset:`을 허용)은 CSP를 상속하지 않는 별도 문서라 스크립트가 실행될 것으로 본다(이 경로는 미실측, 추론). spec.md L138은 링크 이동을 언급하지만 "배율·주입 사라짐"만 적고 스크립트 실행은 빠졌으며 meta refresh는 언급이 없다. plan.md L35(R3)는 CSP 상속을 "추가 방어선"이라 부르지만 파일 내용만으로 우회된다. acceptance.md L133의 AC-014는 "상속된 CSP가 페이지 스크립트를 이미 막으므로" 임시 해시가 필요하다고 전제하는데, 실제 공격 경로는 빌드 수정 없이 meta refresh로 열린다. Windows에서는 wry가 하위 프레임에도 IPC 초기화 스크립트를 주입하므로(advisor 보고서 L19, L82) 이동한 문서의 스크립트가 `__TAURI_INTERNALS__`에 닿을 수 있다. 최종 방어가 SEC-001이라는 설계 판단 자체는 정직하게 적혀 있으나(spec.md L109, L121), 보조 방어선의 강도를 과장했다. — Severity: major — Class: blocking — Required fix: (1) L126의 "계속 차단된다"를 "`srcdoc` 문서 안에서만 차단된다. 프레임이 이동하면(링크 클릭, `<meta http-equiv=refresh>`, 중첩 `<iframe>`) 이동한 문서는 CSP 없이 스크립트를 실행한다"로 고친다. (2) §3 한계 7(L138)에 스크립트 실행과 meta refresh를 더한다. (3) plan R3(L35)에서 "추가 방어선" 표현을 "파일 내용으로 우회 가능하므로 방어로 세지 않는다"로 바꾼다. (4) AC-014(acceptance L133-136)와 M-6에 임시 해시 없는 시험 경로를 더한다: meta refresh로 같은 폴더의 시험 HTML로 이동한 뒤 그 문서의 인라인 스크립트에서 `invoke('read_file', …)`·`write_file` 시도, 중첩 `<iframe>` 경로도 함께. 임시 해시 시험은 남겨도 된다.

D3. QUIRKS-MODE-CLAIM-FALSE — spec.md:L57 / acceptance.md:L46, L51 — REQ-003 L57은 "`<!doctype>`은 항상 첫 노드로 유지되어 렌더 모드(표준/quirks)를 바꾸지 않는다"고 적었다. 그러나 HTML 파싱 규칙상 `srcdoc` 문서는 doctype이 없거나 구식 doctype이어도 quirks 모드가 되지 않는다(초기 삽입 모드의 quirks 전환이 "iframe srcdoc 문서가 아닐 때"에만 일어남). 실측: doctype 없는 `srcdoc`의 `document.compatMode`가 두 엔진 모두 `CSS1Compat`(`noDoctypeMode`). 같은 파일을 원본 보기(asset `src`)로 열면 표준상 quirks(`BackCompat`)로 렌더된다(이 대조는 미실측, 표준 근거). doctype 없는 옛 HTML·조각 파일은 두 모드에서 줄 높이·표 크기·박스 모델이 달라질 수 있는데 §3 한계 목록에 없다. — Severity: major — Class: blocking — Required fix: L57의 렌더 모드 문장을 "doctype 위치는 보존한다. 단 `srcdoc` 문서는 doctype과 관계없이 항상 표준 모드다"로 고치고, §3 한계 목록에 "quirks 모드 문서는 선명 모드에서 표준 모드로 렌더되어 원본 보기와 다를 수 있다"를 더한다. M-4(acceptance L129)에 doctype 없는 파일의 관찰 항목을 넣는다.

D4. REGRESSION-018-UNACKNOWLEDGED — spec.md:L144, L25 / plan.md:L119 — spec.md L144는 "018 문서는 병합·완료 상태"라고 적었지만 `.moai/specs/SPEC-PREVIEW-018-html-preview-zoom/spec.md:5`는 `status: implemented`다. 018 acceptance의 Definition of Done은 macOS·Windows 수동 M-1·M-2·M-4·M-5가 기록되어야 `completed`로 닫는다고 정했고 아직 닫히지 않았다. 019 run은 018의 미결 조건과 충돌한다: (a) 018 AC-007의 `git diff -w 00c0edb -- src/components/preview/HtmlFileViewer.tsx | grep -cE '^[-+][^-+].*sandbox'` = 0과 DoD "iframe `sandbox` 속성 줄과 `@MX:WARN` 주석이 바뀌지 않았다"는 019 M5(plan L118-124: 선명 분기 sandbox 줄 추가, `@MX:WARN` 갱신) 뒤에는 거짓이 된다. (b) 018 수동 M-1(미디어 쿼리가 배율에 반응)을 019 병합 뒤 기본값(선명 모드)에서 수행하면 §3 한계 5(L136)대로 실패로 보인다. SPEC은 이 충돌을 인정하지 않는다. — Severity: major — Class: blocking — Required fix: §3 "의도적 보안 변경" 절에 018과의 관계를 적는다: (1) 018의 상태가 `implemented`임을 바르게 적는다. (2) run 착수 조건(plan §C)에 "018 수동 M 항목이 기록되어 018이 `completed`로 닫혔는지" 확인을 넣거나, 닫히지 않았다면 018 수동 검증은 '원본 보기'로 수행해야 함을 명시한다. (3) 018 AC-007의 diff 조항이 선명 분기 추가로 더는 성립하지 않음을 적고, 원본 분기 보존은 019 AC-008(acceptance L97)의 grep이 대신 지킨다고 연결한다.

D5. AC006-BASELINE-SHALLOW-CLONE — acceptance.md:L84 / plan.md:L47 — AC-006은 "메타 CSP에서 해시 토큰만 뺀 문자열이 `git show 57b3231:index.html`의 메타 CSP와 바이트 단위로 같다"를 단위 테스트로 검사한다. 그런데 `.github/workflows/frontend-gates.yml:30`의 `actions/checkout@v4`에는 `fetch-depth`가 없어 기본 깊이 1이므로 CI에서 57b3231 객체가 없어 테스트가 실패한다. 또 plan.md L47(§C3)은 SEC-001이 `index.html` CSP를 바꿀 수 있다고 인정하므로, 그 경우 57b3231 기준선은 정의상 틀린다. 이후 CSP를 바꾸는 모든 SPEC도 이 테스트를 영구히 깨뜨린다. 토큰을 뺀 뒤의 공백 처리도 정해져 있지 않다(뒤 공백 하나로 바이트 비교 실패). — Severity: major — Class: blocking — Required fix: 기준선을 git 이력에서 읽지 말고 테스트 안의 고정 기대값으로 두거나(run 착수 시점, SEC-001 병합 뒤의 CSP에서 확정), 지시어별 토큰 집합 비교로 바꾼다(예: 지시어 이름 → 공백으로 나눈 토큰 집합. `script-src` 집합은 기준 집합 + 해시 1개, 나머지 지시어 집합은 기준과 같음). 이 비교 방식을 AC-006 본문에 적는다.

D6. E2E-BROWSER-MISMATCH — acceptance.md:L21, L23, L140 / plan.md:L135 — AC-015와 plan M7은 "e2e(Chromium, Playwright)"를 전제하고, acceptance L23은 "Chromium e2e는 WebKit·WebView2 증거가 아니다"라고 정리한다. 그러나 `playwright.config.ts:22-25`의 프로젝트는 `webkit` 하나뿐이고 CI(`frontend-gates.yml`)도 WebKit만 설치한다. plan의 파일 목록에는 `playwright.config.ts` 변경이 없다. 그대로 구현하면 e2e는 WebKit에서 돌고, 증거의 성격 서술이 실제와 어긋난다. — Severity: major — Class: blocking — Required fix: 둘 중 하나를 고른다. (a) 기존 WebKit 프로젝트에서 돌린다고 고쳐 쓰고, 증거 성격을 "Playwright WebKit(WKWebView와 같은 엔진 계열, 같은 빌드 아님)의 부분 증거"로 바꾼다. (b) Chromium 프로젝트를 추가한다면 `playwright.config.ts`와 CI 브라우저 설치를 변경 파일 목록에 넣는다.

D7. AC003-HEADER-TAG-CASE — acceptance.md:L44-54 / spec.md:L57 — 주입 위치 표에 `<head>`가 없고 `<header>`가 있는 문서(HTML5에서 흔함)가 없다. `/<head[^>]*>/i` 같은 흔한 정규식은 `<header>`에 일치해 `<base>`·스크립트를 본문 안에 넣는다. 파일 앞의 UTF-8 BOM(`read_to_string`이 지우지 않음) 사례도 없다. — Severity: minor — Class: optional — Required fix: 표에 `<html><body><header>h</header></body></html>` → `<header>` 뒤가 아니라 `<html>` 뒤에 `<head>` 생성, 그리고 BOM으로 시작하는 문서 행을 더한다.

D8. REQ005-TOP-SEMANTICS — spec.md:L70 / plan.md:L96 / acceptance.md:L75-77 — L70 문장이 "`#`이거나 `#top`이거나 대상이 없으면 `#top`·`#`은 맨 위로, 대상 없는 나머지는 아무 일도 하지 않는다"로 꼬여 있고, `id="top"` 요소가 있을 때 그 요소로 가는지 맨 위로 가는지 정하지 않는다(브라우저는 요소가 있으면 그 요소로 간다). plan 초안 스크립트는 요소가 있어도 맨 위로 간다. 잘못된 퍼센트 시퀀스는 초안상 `preventDefault` 뒤에 무시되는데 AC-005 L77은 `defaultPrevented` 값을 정하지 않는다. — Severity: minor — Class: optional — Required fix: "`id`/`name`이 `top`인 대상이 있으면 그 대상, 없으면 맨 위"처럼 한 문장으로 정하고, 잘못된 퍼센트 시퀀스의 `defaultPrevented` 기대값을 AC-005에 적는다.

D9. REQ002-MODE-SWITCH-TRIGGER — spec.md:L50 — 선명 렌더의 계기가 "미리보기가 파일을 열면"뿐이다. 같은 파일을 보던 중 헤더 토글로 `'original'` → `'crisp'`으로 바꿀 때 다시 읽는지가 REQ에 없다(경계 사례 acceptance L158은 암시만 한다). — Severity: minor — Class: optional — Required fix: L50의 계기를 "파일을 열거나 `htmlRenderMode`가 `'crisp'`으로 바뀌면"으로 넓히고 AC-004 또는 AC-009에 한 줄 더한다.

D10. AC-BEYOND-REQ — acceptance.md:L31, L92, L102 — AC-001 L31 "`setHtmlRenderMode`에 허용 밖 값을 주면 `'crisp'` 정규화", AC-007 L92 "`readFileSize`가 거부해도 읽기 시도"는 REQ-001·REQ-007에 없는 동작이다. 반대로 REQ-012 L114의 툴팁 "외부 리소스" 문구를 AC-009 L102는 검사하지 않는다. — Severity: minor — Class: optional — Required fix: 두 동작을 REQ-001·REQ-007에 한 줄씩 올리거나 AC에서 빼고, AC-009에 "외부"(또는 "리소스") 포함 검사를 더한다.

D11. CSP-SELF-SHELL-ORIGIN — spec.md:L126, L145 — 상속된 정책의 `'self'`는 셸 출처(`tauri://localhost`, Windows `http://tauri.localhost`)다. 따라서 HTML 파일이 절대 주소로 앱 번들의 스크립트(`tauri://localhost/assets/*.js`)를 `<script src>`로 부르면 프레임 안에서 실행될 수 있다. 공격자 코드는 아니지만 "페이지 스크립트는 막힌다"의 예외다. 이 판단은 CSP 규칙에서 추론했고 실측하지 않았다. — Severity: minor — Class: optional — Required fix: §3 한계 1에 "셸 출처의 스크립트는 `'self'`로 허용된다"를 한 줄 적는다.

D12. DOUBLE-NEGATIVE — spec.md:L78, L102-103, L108 — "shall not … 추가하지 않으며", "shall not … 바꾸지 않는다", "shall not … 하지 않는다"는 문면상 이중 부정이라 뜻이 뒤집힐 여지가 있다. — Severity: minor — Class: optional — Required fix: "shall not <동사 원형>" 또는 "shall <동사>지 않는다" 중 하나로 통일한다(예: "The 앱 셸 CSP shall not `script-src`에 `'unsafe-inline'`… 을 추가한다").

D13. JSDOM-FALLBACK-SELF-DEFEATING — plan.md:L136 — 자식 처리기 하네스의 대체안 `new JSDOM(..., { runScripts: 'dangerously' })`는 새 최상위 window를 만들어 `window.parent === window`가 되므로, AC-004 L65가 피하려는 상황을 다시 만든다. vitest의 jsdom 환경은 이미 `runScripts = "dangerously"`가 기본(`node_modules/vitest/dist/chunks/index.K90BXFOx.js:461`)이라 자식 iframe의 window에서 바로 실행할 수 있다. — Severity: minor — Class: optional — Required fix: 대체안을 지우거나 "새 JSDOM 안에 iframe을 하나 만들고 그 자식 window에서 실행"으로 고친다.

D14. AC012-SUBJECTIVE — acceptance.md:L123 — "글자 가장자리가 명확히 더 선명하다"는 사람의 판단에 기댄다. 실기기 수동 항목이라 불가피한 면이 있지만 판정 근거가 남지 않는다. — Severity: minor — Class: optional — Required fix: 같은 배율에서 두 모드의 스크린샷을 같은 영역으로 잘라 progress.md에 경로와 함께 남기는 것을 PASS 조건으로 적는다.

## Regression Check (Iteration 2+ only)

해당 없음(iteration 1).

## Recommendation

FAIL. manager-spec이 고칠 순서:

1. D1(critical)은 사용자 결정이 먼저다. 오케스트레이터가 "셸 `style-src`에 asset 출처 추가 / 스타일시트 차단 수용 / 앱이 인라인화" 중 하나를 받아 온 뒤, 그 결정에 맞춰 REQ-006(L78), §3 한계 2·3(L133-134), AC-006(L84), M-2(acceptance L127), REQ-012 툴팁을 함께 고친다.
2. D2: spec.md L126·L138, plan.md L35의 스크립트 차단 주장을 "srcdoc 문서 안에서만"으로 좁히고, AC-014·M-6에 meta refresh·링크 이동·중첩 iframe 경로의 `invoke` 시험을 더한다.
3. D3: REQ-003 L57의 렌더 모드 문장을 고치고 §3에 quirks 차이를 더한다.
4. D4: 018의 `implemented` 상태, AC-007 diff 조항과 DoD의 충돌, 018 수동 검증을 원본 보기로 해야 한다는 점을 §3과 plan §C에 적는다.
5. D5: AC-006의 기준선을 git 이력이 아닌 고정 기대값 또는 지시어별 토큰 집합 비교로 바꾼다.
6. D6: e2e 브라우저를 WebKit으로 고쳐 쓰거나 Chromium 프로젝트 추가를 변경 목록에 넣는다.
7. D7~D14는 선택 사항이다. 비용이 작은 D7·D8·D10은 같은 개정에서 처리할 것을 권한다.

잘 된 점(근거): 해시 장치는 설계대로 동작한다 — 셸 정책의 해시가 상속되어 주입 스크립트만 실행되고(`hash: "1"`, `page: null`), `<style>` 초기 배율과 CSSOM `style.zoom` 변경이 `style-src 'unsafe-inline'` 아래에서 적용되며(`zoomAfterMsg: "1.5"`), `about:srcdoc`은 `frame-src`에 걸리지 않고, `<base>`는 `base-uri` 미지정이라 허용되어 asset 이미지가 로드된다(`img: 1`). 불투명 출처 주장도 맞다(`origin: "null"`). AC-008의 원본 분기 grep(acceptance L97)과 AC-010의 금지 API grep(L110)은 현재 트리에서 각각 기대값과 맞는다(AC-010 grep 출력 없음, 직접 실행). SEC-001 의존과 run 시작 관문, M-1 macOS 첫 관문은 세 문서에 일관되게 들어 있다.
