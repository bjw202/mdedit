# SPEC Review Report: SPEC-PREVIEW-019
Iteration: 2/3
Verdict: PASS
Overall Score: 0.92 (Tier M 통과 기준 0.80 이상, iteration 1의 0.74에서 상승 — STOP 신호 없음)

Reasoning context ignored per M1 Context Isolation. 오케스트레이터가 전한 "개정 사실" 목록은 확인 대상 목록으로만 썼고, 판정은 worktree HEAD 447350c의 SPEC 4개 파일, 코드·설정 파일, 그리고 아래 실측에만 근거한다.

## 요약

1차 감사의 막힘 결함 6건(D1~D6)이 모두 해결됐고, 선택 결함 8건(D7~D14)도 모두 반영됐다. 가장 큰 문제였던 D1(같은 폴더 스타일시트가 막힘)은 사용자 결정대로 셸 CSP `style-src`에 asset 출처 3개를 더하는 방식으로 바뀌었고, 이번에 실제 호스트 이름(`http://tauri.localhost` 셸, `http://asset.localhost` 자원)으로 다시 재 보니 Chromium과 WebKit 모두에서 스타일시트, 그 안의 `@import`, CSS 배경 이미지가 적용되면서 해시 스크립트는 실행되고 페이지 인라인 스크립트는 여전히 막혔다. 보안 주장(D2)은 "srcdoc 문서 안에서만 막힌다, 보안 경계가 아니다"로 바르게 좁혀졌고, quirks 모드 한계(D3), 018과의 충돌(D4), CI 얕은 클론 문제(D5), e2e 브라우저(D6)도 정리됐다.

새로 찾은 결함은 경미한 문구 문제 3건뿐이다(N1~N3, 모두 선택 사항). run 착수 조건(SPEC-SEC-001 병합, M-1 macOS 관문)은 그대로 유효하며 이 PASS가 그 조건을 대신하지 않는다.

### 실측 근거와 한계 (VCI §2)

- 명령: `node .moai/state/audit-scratch/run.cjs`, `node .moai/state/audit-scratch/bom.cjs` (감사용 임시 스크립트, 실행 후 `rm -rf .moai/state/audit-scratch` 삭제, `git status --short` 결과 `?? .moai/logs/`만 — 감사 전과 같음). Playwright(주 체크아웃 `node_modules`), chromium·webkit. 셸과 자원은 `page.route`로 `http://tauri.localhost/**`·`http://asset.localhost/**`에 응답했다. 셸 메타 CSP는 `index.html:7` 그대로에 `script-src` 해시 1개를 더하고, `style-src`는 (a) 현재 값 (b) REQ-006 값(`'self' 'unsafe-inline' asset: http://asset.localhost https://asset.localhost`) 두 가지로 돌렸다. 프레임은 `sandbox="allow-scripts"` `srcdoc`, `<base href="http://asset.localhost/dir/">`, `<link rel=stylesheet href="style.css">`(안에 `@import "b.css"`와 `background-image:url(bg.png)`), `<img src="a.png">`, 해시 스크립트, 페이지 인라인 스크립트.
- 관찰 출력(요약 아님, JSON 그대로에서 발췌):
  ```
  chromium styleAsset=false {"hash":"1","page":null,"color":"rgb(0, 0, 0)","weight":"400","img":1,"zoom":"1.5","origin":"null"} reqs ["/dir/a.png"]
     "Loading the stylesheet 'http://asset.localhost/dir/style.css' violates ... \"style-src 'self' 'unsafe-inline'\""
  chromium styleAsset=true  {"hash":"1","page":null,"color":"rgb(255, 0, 0)","weight":"700","img":1,"zoom":"1.5","origin":"null"} reqs ["/dir/style.css","/dir/a.png","/dir/b.css","/dir/bg.png"]
  webkit   styleAsset=false {"hash":"1","page":null,"color":"rgb(0, 0, 0)","weight":"400","img":1,"zoom":"1.5","origin":"null"} reqs ["/dir/a.png"]
     "Refused to load http://asset.localhost/dir/style.css because it does not appear in the style-src directive"
  webkit   styleAsset=true  {"hash":"1","page":null,"color":"rgb(255, 0, 0)","weight":"700","img":1,"zoom":"1.5","origin":"null"} reqs ["/dir/style.css","/dir/a.png","/dir/b.css","/dir/bg.png"]
  ```
  읽는 법: REQ-006 값에서는 스타일시트(빨강), `@import`(굵게), CSS `url()` 이미지 요청이 모두 이뤄지고, 해시 스크립트 실행(`hash:"1"`), 페이지 인라인 스크립트 차단(`page:null`, 두 엔진 모두 CSP 위반 메시지), `postMessage` 배율 적용(`zoom:"1.5"`), 불투명 출처(`origin:"null"`)는 그대로다. 현재 값에서는 1차 감사와 같이 스타일시트가 막힌다.
- BOM 확인(같은 실행): `srcdoc = "﻿" + "<!doctype html>…"`일 때 Chromium·WebKit 모두 `doctype:true`, `<head>` 자식 `TITLE,STYLE`, 본문 첫 노드 `P`, `<p>` 위치 0 — BOM 없는 대조군과 같다. 즉 AC-003 BOM 행의 "BOM 유지" 기대는 렌더 결과에 해가 없다.
- jsdom 하네스 확인(같은 실행, `new JSDOM(…, { runScripts: 'dangerously' })` 안의 자식 iframe): `parentIsTop:true`, `contentWindow.eval` 있음, 형제 iframe window를 `source`로 준 `MessageEvent`는 무시(`""`), 부모 window를 준 것은 적용(`"1.5"`). plan M7 L137의 하네스 방식이 그대로 동작한다.
- 한계: `asset:` 스킴 토큰(macOS `asset://localhost`)은 Playwright로 사용자 정의 스킴을 흉내 낼 수 없어 시험하지 않았다. Windows 형식(`http://asset.localhost`)만 실제 호스트 이름으로 시험했다. Playwright WebKit은 WKWebView와 같은 엔진 계열이지만 같은 빌드가 아니고, WebView2는 시험하지 않았다. 이 부분은 SPEC이 이미 수동 M-2·M-5로 남겨 두었다(acceptance.md L129, L143).

## Must-Pass Results

- [PASS] MP-1 REQ 번호 일관성: spec.md L42, L49, L55, L61, L69, L75, L83, L91, L97, L103, L108, L115 — REQ-PREVIEW019-001~012, 빈 번호·중복 없음. AC는 acceptance.md L27, L33, L40, L62, L73, L81, L89, L96, L102, L108, L115, L122, L127, L133, L140 — 001~015 연속. Tier M 상한(각 16) 이내.
- [PASS] MP-2 GEARS 형식 (요구 층 REQ-XXX 기준, AC의 Given-When-Then은 판정 대상 아님): 모든 REQ 항목이 "The <주어> shall …"(L44, L77, L79), "When …, the … shall …"(L46, L47, L63, L85, L86), "While …, when …, the … shall …"(L51), "While …, the … shall …"(L93, L99), "The … shall not …"(L53, L67, L80, L87, L105, L110)의 꼴이다. "사유:"(L73, L79 끝, L89)와 "(열린 질문 …)"(L95)은 명시적 비규범 주석이다. 1차의 이중 부정(D12)은 "shall not <동사>다" 또는 "shall …지 않는다" 꼴로 정리되어 뜻이 하나로 읽힌다.
- [PASS] MP-3 프런트매터: spec.md L2-13 — `id: SPEC-PREVIEW-019`, `title`(따옴표), `version: "0.1.0"`, `status: draft`, `created: 2026-11-09`, `updated: 2026-11-09`, `author: jw (bjw202)`, `priority: High`, `phase: "v0.21.0 target"`(릴리스 대상 — 금지 값 아님), `module: src/components/preview`, `lifecycle: spec-anchored`, `tags`(쉼표 문자열). 12개 모두 있음, 금지 별칭 없음. 선택 필드 `tier: M`(L14), `depends_on: [SPEC-SEC-001]`(L15), `related_specs`(L16).
- [N/A] MP-4 언어 중립성: 단일 프로젝트(Tauri + React) 범위. 여러 언어 도구를 다루지 않는다.
- [PASS] MP-5 D7: 4개 파일에서 뽑은 참조는 SPEC-PREVIEW-004, SPEC-PREVIEW-018, SPEC-PREVIEW-019(자기 자신), SPEC-SEC-001. `grep '^status:'` 결과 004 `completed`, 018 `implemented`. retired·superseded·archived 없음 → BLOCKING 없음. SPEC-SEC-001은 이 worktree에 없어 D7-5 SHOULD("referenced SPEC not found")에 해당하나, 다른 worktree에서 병행 계획 중인 의존 SPEC(호출자 설명과 progress.md L10이 일치)이며 `depends_on`(L15), run 착수 관문(spec.md L124, plan.md L45, acceptance.md L173)이 선언되어 있어 결함으로 세지 않는다.
- [PASS] MP-6 D8: `grep -rn "syscall" .moai/specs/SPEC-PREVIEW-019-html-crisp-zoom/` 결과 없음(종료 코드 1). 자동 통과.
- [PASS] MP-7 clarification gate: `grep -rn "NEEDS CLARIFICATION" .moai/specs/SPEC-PREVIEW-019-html-crisp-zoom/` 결과 없음(위와 같은 명령, 종료 코드 1). research.md 없음(Tier M이라 필수 아님).

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.90 | 0.75~1.0 사이 | `#top` 규칙이 한 문장으로 정해짐(spec.md L71), 계기가 모드 전환까지 넓어짐(L51), 이중 부정 정리. 남은 것은 문구 두 곳: 제외 절 L182의 "http(s) 출처 추가 금지"가 REQ-006이 넣는 `http://asset.localhost`와 문면상 겹침(N1), §3 L132의 CSP 인용이 실제 `index.html:7`보다 짧음(N2) |
| Completeness | 0.90 | 0.75~1.0 사이 | 필수 절 모두 있음(HISTORY L21, §1 L27, §2 L40, §3 L120, §4 L159, §5 L178의 `### Out of Scope — …` 7개, 각 `-` 항목 있음). §3 한계 목록이 실측과 맞게 고쳐짐(L129-131, L137, L139, L143, L147, L152-153). 수동 검증 요약표 M-4 행(acceptance.md L152)에 새로 넣은 quirks 관찰이 빠짐(N3) |
| Testability | 0.90 | 0.75~1.0 사이 | AC-006이 토큰 집합 비교 + 테스트 안 고정 기대값으로 바뀜(acceptance.md L86), e2e는 기존 webkit 프로젝트(L142, `playwright.config.ts:24` `name: 'webkit'`), AC-014가 빌드 수정 없는 실제 경로를 시험(L135-136), AC-012에 스크린샷 PASS 조건(L125), AC-005의 `defaultPrevented` 기대값 명시(L77, L79). AC-012의 "명확히 더 선명"은 사람 눈 판정이 남지만 근거 보존 조건이 붙어 수용 가능 |
| Traceability | 1.0 | 1.0 | 모든 REQ에 AC가 있고 고아 AC 없음. spec §4(L161-176)와 acceptance 추적 표(L5-21)가 일치. 1차의 "REQ에 없는 AC 동작"(D10)은 REQ-001 L47, REQ-007 L86으로 올라갔고, REQ-012 툴팁의 "외부"를 AC-009 L104가 검사 |

산출: 조화평균 4 / (1/0.90 + 1/0.90 + 1/0.90 + 1/1.0) ≈ 0.92.

## Defects Found (structured defect-list)

N1. OOS-HTTP-WORDING — spec.md:L182 — 제외 절이 "`style-src`·`img-src` 등에 http(s) 출처 추가 금지"라고 적은 바로 그 문장 묶음에서 REQ-006(L79)은 `style-src`에 `http://asset.localhost`·`https://asset.localhost`를 더한다. 다음 문장 "REQ-006의 해시 1개와 `style-src` asset 출처 3개가 전부다"가 예외를 밝히므로 실제 모순은 아니지만, 문장만 떼어 읽으면 충돌로 보인다. — Severity: minor — Class: optional — Required fix: "외부 http(s) 출처(CDN 등, asset 출처 제외) 추가 금지"처럼 asset 출처를 문장 안에서 빼 준다.

N2. CSP-QUOTE-TRUNCATED — spec.md:L132 — "`default-src 'self' tauri: asset:`, … `img-src 'self' data: asset:`"로 인용했지만 실제 `index.html:7`은 두 지시어 모두 `http://asset.localhost https://asset.localhost`를 포함한다. 결론(같은 폴더 자원 허용, 외부 http(s) 차단)은 맞으나, Windows의 `http://asset.localhost` 자원이 이 지시어로 허용되는 근거가 인용에서 빠졌다. — Severity: minor — Class: optional — Required fix: 두 지시어를 `index.html:7` 그대로 인용하거나 "… asset 출처 3종"으로 줄여 쓴다.

N3. MANUAL-TABLE-M4-STALE — acceptance.md:L152 — 수동 검증 요약표 M-4 행이 "미디어 쿼리 비반응·인라인 스크립트 차단 관찰"만 적고, AC-013 M-4(L131)에 새로 넣은 doctype 없는 파일의 렌더 차이 관찰이 빠졌다. 본문 AC가 기준이라 판정에는 영향이 없다. — Severity: minor — Class: optional — Required fix: M-4 행에 "doctype 없는 파일 렌더 차이"를 더한다.

## Regression Check (Iteration 2+ only)

Defects from previous iteration:

- D1 CSP-STYLESHEET-BLOCKED — **RESOLVED**: 사용자 결정 D1=A가 HISTORY(spec.md L25), REQ-006(L79-80, `style-src`에 asset 출처 정확히 3개, 그 밖의 지시어 불변), §3(L132, L139 "동일 폴더 asset 스타일시트는 동작", L153 셸 문서 쪽 영향 서술), 제외 절(L182), AC-006(acceptance.md L86, `style-src` 토큰 집합 = 기준 + 3개), M-2(L129), plan §D(L54), M3(L110)에 일관되게 들어갔다. 위 실측에서 REQ-006 값으로 스타일시트·`@import`·CSS 이미지가 적용되고 해시 스크립트 실행과 페이지 스크립트 차단은 유지됨을 두 엔진에서 확인했다. 남은 미검증은 `asset:` 스킴(macOS)뿐이며 M-2·M-5가 덮는다.
- D2 SEC-SCRIPT-BLOCK-OVERCLAIM — **RESOLVED**: spec.md L129("`srcdoc` 문서 안에서만"), L130("이 차단은 보안 경계가 아니다" — 링크·클릭 없는 meta refresh·중첩 iframe, 마지막 경로는 미실측으로 표시), L137, L143(이동한 문서의 스크립트 실행), plan R3 L35("방어로 세지 않는다"), AC-014 L135-137(meta refresh → `probe.html`, 링크, 중첩 iframe 세 경로의 `invoke`·`write_file` 시험, 임시 해시는 커밋하지 않는 보조 빌드로만).
- D3 QUIRKS-MODE-CLAIM-FALSE — **RESOLVED**: REQ-003 L58("`srcdoc` 문서는 doctype 유무와 관계없이 표준 모드"), §3 한계 10(L147, 실측과 미실측 대조를 구분해 표시), AC-013 M-4(L131).
- D4 REGRESSION-018-UNACKNOWLEDGED — **RESOLVED**: spec.md L152(018 `status: implemented`, AC-007 diff 조항·DoD와의 충돌 인정, 018 M-1은 원본 보기에서 수행, 원본 분기 보존은 019 AC-008이 대신 지킴), plan §C 3a(L48), acceptance DoD(L173-174). 018 쪽 근거도 일치: `.moai/specs/SPEC-PREVIEW-018-html-preview-zoom/spec.md:5` `status: implemented`, 018 acceptance L110 "iframe `sandbox` 속성 줄과 `@MX:WARN` 주석이 바뀌지 않았다(AC-007)".
- D5 AC006-BASELINE-SHALLOW-CLONE — **RESOLVED**: AC-006(acceptance.md L86)이 git 이력 대신 테스트 안 고정 기대값을 쓰고, 지시어별 토큰 집합 비교로 공백·순서 차이를 무시한다. plan §C3(L47)도 같은 내용이며 "git 이력 비교 금지: CI shallow checkout"을 적었다(CI `.github/workflows/frontend-gates.yml`에 `fetch-depth` 없음은 그대로라 이 방식이 맞다).
- D6 E2E-BROWSER-MISMATCH — **RESOLVED**: acceptance.md L21, L23, L142와 plan M7 L136이 모두 기존 `webkit` 프로젝트·설정 변경 없음·"Playwright WebKit 부분 증거"로 고쳐졌다. `playwright.config.ts:24` `name: 'webkit'`, CI L58 `npx playwright install webkit`과 일치.
- D7 AC003-HEADER-TAG-CASE — **RESOLVED**: acceptance.md L54(`<header>` 행), L55(BOM 행). BOM 행의 "BOM 유지" 기대는 위 실측에서 두 엔진 모두 렌더에 영향이 없음을 확인했다.
- D8 REQ005-TOP-SEMANTICS — **RESOLVED**: spec.md L71이 `id`/`name`이 `top`인 대상 우선, 없으면 맨 위, 잘못된 퍼센트 시퀀스는 기본 동작만 막음으로 정했고, AC-005 L77·L79가 `scrollIntoView`/`scrollTo`와 `defaultPrevented === true`를 정했다. plan M2 스크립트 초안(L95-99)도 이 순서와 맞다.
- D9 REQ002-MODE-SWITCH-TRIGGER — **RESOLVED**: REQ-002 L51 계기에 "`htmlRenderMode`가 `'crisp'`으로 바뀌면" 추가, AC-004 L66에 대응 검사 추가.
- D10 AC-BEYOND-REQ — **RESOLVED**: REQ-001 L47(`setHtmlRenderMode` 정규화), REQ-007 L86(크기 조회 실패 시 읽기 시도, 정확히 상한값은 폴백 아님), AC-009 L104(`title`에 "외부" 검사).
- D11 CSP-SELF-SHELL-ORIGIN — **RESOLVED**: spec.md L131(추론·미실측 표시)과 한계 1 L137.
- D12 DOUBLE-NEGATIVE — **RESOLVED**: L53, L64, L67, L80, L87-88, L94, L105-106, L110-111 모두 "shall not <동사>다" 또는 "shall …지 않는다" 한 가지 부정으로 읽힌다.
- D13 JSDOM-FALLBACK-SELF-DEFEATING — **RESOLVED**: plan M7 L137이 새 `JSDOM` 대안을 버리고 자식 iframe의 `contentWindow`에서 실행하도록 고쳤다. 위 jsdom 실측에서 이 방식으로 부모·형제 `source` 구분이 동작했다.
- D14 AC012-SUBJECTIVE — **RESOLVED**(선택 사항 수준): AC-012 L125에 "같은 영역을 잘라낸 두 모드 스크린샷을 OS·배율별로 저장하고 경로를 progress.md에 적지 않으면 PASS가 아니다"가 붙었다. 눈 판정 자체는 실기기 시각 기준이라 남는다.

정체 결함(세 번 연속 그대로인 결함): 없음.

## Recommendation

PASS. 근거:

- MP-1~MP-7: 위 must-pass 절의 줄 인용대로 모두 통과(MP-4는 N/A).
- 1차 막힘 결함 D1~D6 모두 해결, 선택 결함 D7~D14 모두 반영. 핵심 장치(해시 1개 + `style-src` asset 출처 3개)를 실제 호스트 이름으로 두 엔진에서 다시 재서 SPEC의 서술과 같은 결과를 얻었다.
- 점수 0.92는 Tier M 기준 0.80을 넘고 1차 0.74보다 높다(STOP 신호 없음).

남은 N1~N3은 모두 선택 사항이며 run 전에 고치지 않아도 된다. 고친다면 같은 문서 개정 한 번으로 끝나는 크기다.

이 PASS가 바꾸지 않는 것: (1) run은 SPEC-SEC-001이 `status: completed`가 된 뒤에만 시작한다(spec.md L124, Depends_on Pre-flight). (2) run 첫 작업은 macOS M-1 선명도 관문이며 실패하면 run을 멈춘다(spec.md L157, plan M1). (3) Implementation Kickoff Approval은 이 판정과 무관하게 필요하다. (4) `asset:` 스킴(macOS)에서의 스타일시트 허용과 WKWebView·WebView2의 CSP 상속은 이 감사가 실측하지 않았고 M-2·M-5로 남는다.
