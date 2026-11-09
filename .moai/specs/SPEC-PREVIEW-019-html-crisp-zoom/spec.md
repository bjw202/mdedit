---
id: SPEC-PREVIEW-019
title: "HTML 미리보기 선명한 확대 — srcdoc 불투명 출처 렌더와 문서 자체 zoom"
version: "0.1.1"
status: completed
created: 2026-11-09
updated: 2026-11-09
author: jw (bjw202)
priority: High
phase: "v0.21.0 target"
module: src/components/preview
lifecycle: spec-anchored
tags: "preview, html, zoom, srcdoc, sandbox, csp, crisp"
tier: M
depends_on: [SPEC-SEC-001]
related_specs: [SPEC-PREVIEW-004, SPEC-PREVIEW-018, SPEC-SEC-001]
---

# SPEC-PREVIEW-019: HTML 미리보기 선명한 확대

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-11-09 | jw | 최초 작성. 배경: SPEC-PREVIEW-018(병합, main 57b3231)의 배율은 감싸개 + `transform: scale`이라 macOS(WebKit)에서 100% 초과 시 iframe 비트맵이 늘어나 흐리다(사용자 실측). iframe 요소의 CSS `zoom`은 WebKit에서 내용에 효과가 없음이 실기기에서 확인됐다. 기각된 018 v0.4.0 설계(`mdhtml` 사용자 정의 스킴)는 Local 출처 판정 때문에 Windows에서 앱 IPC에 노출되어 기각됐다(`.moai/reports/plan-audit/SPEC-PREVIEW-018-review-3.md` D1, `SPEC-PREVIEW-018-advisor.md`). 사용자 결정(오케스트레이터 경유, 2026-11-09): (1) 100% 초과 확대가 선명해야 하며 그것이 최우선이다 (2) 방식은 `srcdoc`(advisor 후보 (b)) (3) 보안 SPEC(SPEC-SEC-001, 앱 ACL 매니페스트)과 병행 계획하되 구현은 SEC-001 병합 뒤 (4) **Q1=A**: 앱 셸 메타 CSP의 `script-src`에 고정 주입 스크립트의 sha256 해시 1개만 추가한다(`'unsafe-inline'` 금지) (5) **Q2=토글 포함**: 기본은 선명 모드(srcdoc), 헤더의 '원본 보기' 토글로 기존 asset iframe 방식을 쓸 수 있고 선택은 전역 영속(`htmlRenderMode`). 코디네이터 기본값(열린 질문, §7): 원본 보기 모드에서는 SPEC-PREVIEW-018 동작(transform 배율, 100% 초과 시 흐림)을 그대로 유지한다. plan 단계 실측: 앱 셸 `index.html`의 메타 CSP는 `srcdoc` iframe에 상속된다(Chromium 직접 확인, §3). plan-audit 1차(FAIL 0.74) 후 사용자 결정(2026-11-09, 오케스트레이터 경유) **D1=A**: 상속된 `style-src`가 asset 스타일시트를 막는 문제(Chromium·WebKit 실측)에 대해 셸 CSP `style-src`에 `asset: http://asset.localhost https://asset.localhost` 3개만 추가한다(`script-src` 해시 외 다른 지시어 불변). 확정 사용자 결정이며 열린 질문이 아니다. 1차 감사 지적 D2~D14 반영: 선명 모드의 스크립트 차단은 `srcdoc` 문서 안에서만 유효하며 프레임 이동(링크·`<meta refresh>`·중첩 iframe) 뒤에는 CSP 없는 문서의 스크립트가 실행된다고 정정(보안 경계로 세지 않음, SEC-001 시험 항목으로 전달), `srcdoc` 항상 표준 모드 한계 추가, SPEC-PREVIEW-018 `implemented` 충돌 명시, AC-006 토큰 집합 비교, e2e는 기존 webkit 프로젝트. |
| 0.1.1 | 2026-11-09 | jw | 수동 확인 종결: macOS M-1~M-4·M-6 PASS(캡처 기록), Windows 동일 항목 PASS(사용자 보고). status implemented → completed. |
| 0.1.1 (주석) | 2026-11-09 | jw | REQ-001 기본값은 SPEC-PREVIEW-020이 OS별로 개정(Windows `'original'`, macOS·Linux `'crisp'`; 저장 모델 `null` 허용, persist v2). 본문 요구는 바꾸지 않았다. |

## §1 Overview

### 배경

- HTML 미리보기는 현재 샌드박스 iframe(`sandbox="allow-scripts allow-same-origin"`)이 `asset://`(Windows는 `http://asset.localhost`) 주소를 직접 불러와 렌더한다. 018이 그 위에 감싸개와 `transform: scale`로 67~200% 배율을 더했다.
- 문제: `transform: scale`은 iframe을 1배로 래스터한 뒤 합성기가 늘리므로 100% 초과에서 글자가 흐리다. 브라우저의 Cmd/Ctrl+`+` 배율은 레이아웃부터 다시 계산하고 다시 그려서 선명하다.
- 해법의 원리: iframe **문서 자신**의 `documentElement`에 `zoom`을 걸면 WebKit·Chromium 모두 레이아웃부터 다시 하고 다시 래스터한다(원리상 선명. 실기기 확인은 run 첫 관문). 그러려면 앱이 iframe 문서에 코드를 넣을 수 있어야 한다. cross-origin인 asset 주소로는 불가능하므로 HTML 텍스트를 앱이 읽어 `srcdoc`으로 렌더한다.
- 부수 이득: `srcdoc` 프레임을 `sandbox="allow-scripts"`만으로 렌더하면 문서 출처가 불투명(opaque)해진다. 지금의 asset iframe보다 격리가 강해진다(SPEC-PREVIEW-004/018의 `allow-same-origin`을 선명 모드에서 의도적으로 뺀다).

### Tier 판단

- **Tier M.** 소스 변경 5~6개(새 srcdoc 조립 모듈, 뷰어, UI 저장소, 헤더, 앱 셸 `index.html` CSP)와 짝이 되는 테스트·e2e. 추정 300~700 LOC. 활성 REQ 12건·AC 15건으로 Tier M 상한(각 16) 안이다. 동작 면에서는 보안 경계(샌드박스 출처, CSP 해시)와 엔진별 실기기 확인이 크므로 Tier S로 낮추지 않는다. 의존: SPEC-SEC-001.

## §2 Requirements (GEARS)

#### REQ-PREVIEW019-001: 렌더 모드 상태와 기본값 (Ubiquitous + Event-driven)

- The 앱 shall HTML 렌더 모드 `htmlRenderMode`를 `'crisp'`(선명 모드) 또는 `'original'`(원본 보기) 중 하나로 가지며 기본값은 `'crisp'`이다.
- The `htmlRenderMode` shall 모든 HTML 파일에 공통인 하나의 값이고, 기존 UI 저장소(`mdedit-ui-store`)에 함께 저장되어 앱 재시작 후에도 유지된다.
- **When** 저장된 상태에 `htmlRenderMode`가 없거나 `'crisp'`·`'original'` 외의 값(다른 문자열, 숫자, `null` 포함)이면, the 앱 shall `'crisp'`을 쓴다.
- **When** `setHtmlRenderMode`가 `'crisp'`·`'original'` 외의 값을 받으면, the 앱 shall `'crisp'`으로 정규화한다.

#### REQ-PREVIEW019-002: 선명 모드 렌더 (Event-driven + Ubiquitous)

- **While** `htmlRenderMode`가 `'crisp'`이고 현재 파일의 보기 종류가 `html`일 때, **when** 미리보기가 파일을 열거나 `htmlRenderMode`가 `'crisp'`으로 바뀌면, the HTML 미리보기 shall 파일 내용을 기존 `read_file` 명령(`readFile`)으로 UTF-8 텍스트로 읽어 REQ-003대로 조립한 문서를 `<iframe srcdoc>`으로 렌더한다.
- The 선명 모드 iframe shall `sandbox` 속성 값으로 정확히 `"allow-scripts"`만 가지며, `src` 속성을 갖지 않는다.
- The 선명 모드 iframe shall not 018의 감싸개 `transform`/크기 역보정 스타일을 쓴다(배율은 REQ-004의 문서 `zoom`이 맡는다).

#### REQ-PREVIEW019-003: 주입 내용과 위치 (Ubiquitous)

- The HTML 미리보기 shall 읽은 HTML 텍스트에 다음 세 가지를 이 순서로 한 번 주입한다. (a) `<base href="…">` — 해당 파일이 있는 폴더의 asset 주소(018의 `convertFileSrc` + `%2F`·`%5C` → `/` 정규화 결과에서 마지막 `/`까지 자른 값, 끝 `/` 포함) (b) 현재 배율을 `html { zoom: <z/100> }`로 담은 `<style>` — 생성 시점의 `htmlZoom` 한 번만 반영 (c) 고정 스크립트 `<script>`(REQ-004·005·006).
- The 주입 위치 shall 첫 `<head …>` 시작 태그 바로 뒤로 한다. `<head>`가 없고 `<html …>`이 있으면 그 뒤에 `<head>…</head>`를 새로 만들어 넣고, 둘 다 없으면 문서 맨 앞(단, `<!doctype …>`이 있으면 그 바로 뒤)에 넣는다. HTML 주석(`<!-- … -->`) 안의 `<head>`·`<html>`은 일치로 보지 않는다. `<!doctype>`은 항상 문서의 첫 노드로 유지한다. 단 `srcdoc` 문서는 doctype 유무와 관계없이 표준 모드(`CSS1Compat`)로 렌더되므로 doctype이 없거나 quirks를 유발하는 문서는 원본 보기와 렌더 모드가 달라질 수 있다(§3 한계 10).
- **When** 원본 문서에 이미 `<base href>`가 있으면, the HTML 미리보기 shall 주입한 `<base>`가 먼저 오므로 먼저 나온 쪽이 적용되어 원본 `<base>`는 무시된다(§3 한계로 명시).

#### REQ-PREVIEW019-004: 배율 적용 — 재렌더 없는 문서 zoom (Event-driven + Unwanted)

- **When** `htmlZoom`이 바뀌면, the HTML 미리보기 shall iframe의 `contentWindow`로 메시지 `{ type: 'mdedit-html-zoom', zoom: <htmlZoom/100> }`를 보내고, the 주입 스크립트 shall `document.documentElement.style.zoom`을 그 값으로 바꾼다.
- The HTML 미리보기 shall `htmlZoom` 변경으로 `srcdoc` 값을 바꾸거나 iframe을 다시 만들지 않는다(문서 다시 로드·스크롤 위치 초기화 금지).
- The 주입 스크립트 shall `event.source === window.parent`가 아닌 메시지, `data.type`이 위 값이 아닌 메시지, `data.zoom`이 유한한 `number`가 아니거나 `0.67` 미만·`2` 초과인 메시지를 무시한다.
- The 부모 shall 메시지 대상 origin으로 `'*'`를 쓴다 — 선명 모드 프레임의 출처는 불투명이라 구체적인 origin을 지정할 수 없고, 보내는 값은 배율 숫자뿐이다.
- The 부모 shall not 이 프레임이 보내는 메시지를 받는 `message` 리스너를 둔다(방향은 부모 → 자식 한 방향).

#### REQ-PREVIEW019-005: 해시 링크 가로채기 (Event-driven)

- **When** 사용자가 선명 모드 프레임 안에서 `href`가 `#`으로 시작하는 `<a>`를 누르면, the 주입 스크립트 shall 기본 동작을 막고 문서 안에서 대상 요소(`id` 일치, 없으면 `name` 일치)로 `scrollIntoView`한다. `id` 또는 `name`이 `top`인 요소가 있으면 `#top`은 그 요소로 이동하고, 없으면 `#`과 `#top`은 문서 맨 위로 이동한다. 대상이 없는 그 밖의 `#…`는 기본 동작만 막고 아무 일도 하지 않는다. 퍼센트 인코딩이 잘못되어 해석할 수 없는 `href`도 기본 동작만 막고 아무 일도 하지 않는다.
- The 주입 스크립트 shall `#`으로 시작하지 않는 링크는 가로채지 않는다(§3: 상대 파일·외부 링크 이동은 이 SPEC 범위 밖).
- 사유: `<base>`가 있으면 `#anchor`가 base 기준 주소로 풀려 프레임이 `srcdoc`을 벗어나 asset 주소로 이동한다.

#### REQ-PREVIEW019-006: 앱 셸 CSP — 스크립트 해시 1개 + 스타일 asset 출처 (Ubiquitous + Unwanted)

- The 앱 셸 `index.html`의 메타 CSP `script-src` shall 기존 토큰에 더해, REQ-003(c) 고정 스크립트 본문의 sha256 해시 `'sha256-<base64>'` 정확히 1개를 갖는다.
- The 해시 shall 주입 스크립트 상수 본문(태그 사이의 바이트 그대로)의 sha256 base64 값과 일치한다. 스크립트가 바뀌면 해시도 함께 바뀌어야 하며, 이 일치를 자동 검사하는 테스트가 있다.
- The 앱 셸 `index.html`의 메타 CSP `style-src` shall 기존 토큰에 더해 asset 출처 토큰 `asset:`, `http://asset.localhost`, `https://asset.localhost` 정확히 3개를 갖는다(사용자 결정 D1=A, 2026-11-09). 사유: 선명 모드 `srcdoc` 문서는 셸 CSP를 상속하므로 `<base>`로 풀린 같은 폴더 `<link rel=stylesheet>`가 `style-src`에 막힌다(audit review-1 실측).
- The 앱 셸 CSP shall not `'unsafe-inline'`, `'unsafe-eval'`, 새 출처를 `script-src`에 추가한다. 또한 shall not `script-src`·`style-src` 외 지시어(`default-src`, `img-src`, `connect-src`, `frame-src` 등)를 바꾼다. `style-src`에는 위 asset 출처 3개 외 토큰을 더하지 않는다.
- The 주입 스크립트 상수 shall 동적 값을 담지 않는 고정 문자열이다(초기 배율은 REQ-003(b)의 `<style>`로 전달).

#### REQ-PREVIEW019-007: 읽기 실패·비 UTF-8·대용량 폴백 (Event-driven)

- **When** 선명 모드에서 `readFile`이 오류를 반환하거나(파일 없음, UTF-8이 아닌 내용 포함), 파일 크기(`read_file_size`)가 `HTML_CRISP_MAX_BYTES`(10 MiB)를 초과하면, the HTML 미리보기 shall 그 파일을 `'original'` 방식(REQ-008)으로 렌더하고 `role="status"` 안내 문구를 표시한다. 문구는 사유(UTF-8이 아님·읽기 실패·크기 초과)를 구분한다.
- **When** 크기 조회(`readFileSize`)가 오류를 반환하면, the HTML 미리보기 shall 크기 검사를 건너뛰고 읽기를 시도한다. 크기가 정확히 `HTML_CRISP_MAX_BYTES`이면 폴백하지 않고 선명 모드로 렌더한다.
- The 폴백 shall not 저장된 `htmlRenderMode`를 바꾼다(그 파일 한정, 다른 파일을 열면 다시 선명 모드 시도).
- The 폴백 shall not 앱을 중단시키거나 빈 화면을 남긴다.
- 사유: `srcdoc`은 파일 전체를 JS 문자열로 메모리에 올린다. 018까지 "asset 스트리밍이라 크기 임계가 없다"던 전제가 선명 모드에서는 성립하지 않는다.

#### REQ-PREVIEW019-008: 원본 보기 모드 (State-driven)

- **While** `htmlRenderMode`가 `'original'`이거나 REQ-007 폴백이 걸린 파일이면, the HTML 미리보기 shall SPEC-PREVIEW-018 동작과 같게 렌더한다: asset 주소 `src`, `sandbox="allow-scripts allow-same-origin"`, 감싸개 + 크기 역보정 + `transform: scale`.
- The 원본 보기 분기 shall not 018에서 병합된 `sandbox` 속성 줄·`src` 정규화·`onError` 처리를 바꾼다.
- (열린 질문 §7-1) 원본 보기에서 배율은 018 그대로 동작하며 100% 초과 시 흐린 것도 그대로다.

#### REQ-PREVIEW019-009: 헤더 모드 토글 (State-driven + Event-driven)

- **While** 현재 파일의 보기 종류가 `html`일 때, the 헤더 shall 018 배율 컨트롤 옆에 토글 버튼(접근성 이름 `Original view`, 눌림 상태는 `aria-pressed`)을 표시한다. `'original'`이면 `aria-pressed="true"`.
- **When** 사용자가 토글을 누르면, the 앱 shall `htmlRenderMode`를 `'crisp'` ↔ `'original'`으로 바꾼다.
- The 토글 shall `html`이 아닌 보기 종류에서 표시되지 않는다.

#### REQ-PREVIEW019-010: 018 사용자 경험 불변 (Unwanted)

- The 이 SPEC shall not 018의 배율 컨트롤(`[− N% +]`, 접근성 이름, 단계 목록 67~200, 경계 비활성), 키보드 단축키(Cmd/Ctrl+`=`·`+`·`-`·`0`, `isComposing`·모달 무시), 전역 영속화(`htmlZoom`, `mdedit-ui-store`), 다른 뷰어와의 분리(REQ-PREVIEW018-007)를 바꾼다.
- The 이 SPEC shall not 앱 전체 웹뷰 배율 API를 쓰거나, 휠·핀치 입력을 더한다.

#### REQ-PREVIEW019-011: 보안 경계 (Unwanted)

- The 선명 모드 iframe shall not `allow-same-origin`, `allow-popups`, `allow-forms`, `allow-top-navigation`, `allow-modals` 등 `allow-scripts` 외 권한을 갖는다.
- The 주입 스크립트 shall not `fetch`, `XMLHttpRequest`, 부모로의 `postMessage`, `__TAURI*` 접근, 저장소 접근을 쓴다(받기 전용).
- The 선명 모드 프레임에서 앱 명령(`invoke`)을 호출하면, the 앱 shall 거부해야 한다 — 단 이 보장은 SPEC-SEC-001(앱 ACL 매니페스트) 병합이 전제이며, 실기기 확인 항목(M-6)으로 검증한다(§3).
- The `@MX:WARN` 주석 shall 두 모드의 sandbox 값과 근거(불투명 출처 도입, 의도적 조임)를 설명하도록 갱신한다.

#### REQ-PREVIEW019-012: 한계 안내 (Ubiquitous)

- The 헤더 토글의 `title`(툴팁) shall 선명 모드의 한계(스크립트·외부 리소스가 필요한 페이지는 원본 보기 사용)를 알린다.
- The 알려진 한계 전체 목록 shall §3에 규범적으로 남는다.

## §3 Constraints and Known Limitations

### 선행 조건 — SPEC-SEC-001

- `depends_on: [SPEC-SEC-001]`. run 단계는 SEC-001이 `status: completed`(병합)가 된 뒤에만 시작한다(`spec-workflow.md` Depends_on Pre-flight). 사유: advisor 처방 3절 — 앱 ACL 매니페스트가 없으면 Remote/불투명 출처에서 온 앱 명령도 ACL을 건너뛴다. 선명 모드는 `postMessage` 폴백 경로로 도달 시 Remote로 분류되는데, 이 경로의 최종 안전성은 SEC-001 + 실기기 M-6에 걸려 있다.

### CSP 상속 (plan 단계 실측)

- `srcdoc` 문서는 임베더(앱 셸)의 CSP를 상속한다. Chromium(Playwright)에서 셸 메타 CSP 그대로 `sandbox="allow-scripts"` `srcdoc`에 인라인 스크립트를 넣었더니 `Executing inline script violates … script-src 'self' 'wasm-unsafe-eval'`로 차단됐고, CSP 없는 대조군에서는 실행됐다. WebKit·WebView2 동작은 실기기 확인(M-5)으로 남는다.
- 그래서 REQ-006: 고정 스크립트 하나에만 해시 허용을 준다. **HTML 페이지 자체의 인라인·외부 `<script>`는 `srcdoc` 문서 안에서만 상속된 `script-src 'self'`로 차단된다.** 이는 사용자가 수용한 제약이며 '원본 보기'가 우회 수단이다.
- **이 차단은 보안 경계가 아니다 (audit review-1 실측)**: CSP 상속은 `srcdoc` 문서에만 적용된다. 프레임이 asset 문서로 이동하면 — 링크 클릭, **클릭 없는 `<meta http-equiv="refresh">`**, (표준상 추론, 미실측) 중첩 `<iframe src>` — 이동한 문서에는 CSP가 없고 `sandbox="allow-scripts"` 아래에서 스크립트가 실행된다. Playwright Chromium·WebKit 모두 링크 클릭과 meta refresh 뒤 이동한 문서의 스크립트가 실행됨을 확인했다. 따라서 파일 내용만으로 우회되는 이 차단을 방어선으로 세지 않으며, 앱 명령 노출의 최종 방어는 SPEC-SEC-001이다.
- 상속된 정책의 `'self'`는 셸 출처(`tauri://localhost`, Windows `http://tauri.localhost`)다. 따라서 HTML이 절대 주소로 앱 번들 스크립트를 부르면 프레임 안에서 실행될 수 있다(CSP 규칙에서 추론, 미실측).
- 같은 이유로 `default-src`(`'self' tauri: asset: http(s)://asset.localhost`), `style-src`(REQ-006으로 asset 출처가 더해진 값), `img-src`(`'self' data: asset: http(s)://asset.localhost`)가 프레임에 적용된다 — 같은 폴더(asset) 스타일시트·이미지는 동작하고, 외부 http(s) 이미지·스타일시트·웹폰트(CDN)는 선명 모드에서 막힌다. 018의 asset iframe은 CSP가 없어 이들이 모두 동작했으므로 **퇴행**이다.
- `tauri.conf.json`의 `csp`는 현재 `null`이다. 이후 SPEC이 Tauri가 CSP를 주입하는 설정(`csp` 값 지정)으로 바꾸면 Tauri가 자체 nonce/해시를 덧붙이므로 이 SPEC의 해시 토큰과의 공존을 그때 다시 검증해야 한다.

### 선명 모드 알려진 한계 (규범)

1. **페이지 자체 스크립트 차단**(`srcdoc` 문서 한정, 위). 인터랙티브 페이지는 동작하지 않는다. 셸 출처 스크립트는 `'self'`로 허용된다.
2. **외부 리소스 차단**: CDN 스크립트/스타일시트/웹폰트, 외부 http(s) 이미지.
3. **CORS 의존 코드**: `fetch`/`XMLHttpRequest`로 상대 파일 읽기, `<script type="module">`, `@font-face` 웹폰트, `crossorigin` 속성 자원은 asset 응답의 `Access-Control-Allow-Origin`이 앱 셸 출처로 고정되어 있어 실패한다(스크립트 자체가 막혀 있어 일부는 1번과 겹친다). `<img>`, `<link rel=stylesheet>`(동일 폴더 asset)은 동작한다.
4. **저장소 접근**: 불투명 출처에서 `localStorage`/`sessionStorage`/쿠키 접근은 `SecurityError`.
5. **미디어 쿼리**: 문서 `zoom`은 CSS 뷰포트 폭을 바꾸지 않으므로 `@media (max-width …)`는 **배율에 반응하지 않는다.** 018(원본 보기)은 반응했다. 이는 의도된 차이이며 사용자가 '브라우저처럼 반응'을 원하면 원본 보기를 쓴다.
6. **`<base>` 충돌**: 원본 문서의 `<base href>`는 무시된다(REQ-003).
7. **링크 이동**: `#` 해시 링크는 프레임 안에서 처리하지만, 상대 파일 링크·외부 링크는 가로채지 않는다. 상대 파일 링크는 프레임이 그 asset 주소로 이동하며(불투명 샌드박스는 유지, 배율·주입 사라짐, **이동한 문서는 CSP 없이 스크립트를 실행**), `<meta http-equiv="refresh">`는 클릭 없이도 같은 이동을 일으킨다. `target="_blank"` 등 새 창은 sandbox가 막는다. 이동 뒤에는 미리보기가 배율을 더 적용하지 못한다. 이 동작은 향후 SPEC 후보다.
8. **파일 전체 메모리 적재**: 10 MiB 초과는 원본 방식 폴백(REQ-007). 파일이 UTF-8이 아니면 폴백.
9. **저장 후 갱신**: 선명 모드는 `htmlPath` 변경 시 다시 읽는다. 같은 경로 파일이 바뀐 뒤 갱신하는 동작은 018의 asset iframe과 같은 수준(경로 변경 기준)으로 맞춘다 — run 단계에서 018 동작을 재측정해 progress.md에 기록한다.

10. **quirks 모드 차이**: `srcdoc` 문서는 doctype이 없거나 오래된 doctype이어도 항상 표준 모드(`CSS1Compat`)다(Playwright Chromium·WebKit 실측). 같은 파일을 원본 보기(asset `src`)로 열면 표준상 quirks(`BackCompat`)이므로(이 대조는 미실측) 줄 높이·표 크기·박스 모델이 달라질 수 있다.

### 의도적 보안 변경 (SPEC-PREVIEW-004/018 대비)

- 선명 모드 `sandbox="allow-scripts"`는 004/018의 `allow-scripts allow-same-origin`보다 **조인 것**이다(불투명 출처). 004 REQ-002/005와 018 REQ-003의 "sandbox 값 불변"은 asset 방식(원본 보기)에 계속 적용되며, 선명 모드는 새 분기이므로 위반이 아니다.
- **SPEC-PREVIEW-018과의 관계 (인정되는 충돌)**: 018은 병합됐지만 `status: implemented`이며 `completed`가 아니다(수동 M-1·M-2·M-4·M-5 미기록, 018 acceptance DoD). 이 SPEC의 run은 018의 다음 조건을 더는 참으로 만들 수 없다: (a) 018 AC-007의 `git diff -w 00c0edb -- HtmlFileViewer.tsx | grep sandbox` = 0 과 DoD "sandbox 속성 줄과 `@MX:WARN`이 바뀌지 않았다"(선명 분기 sandbox 줄 추가·`@MX:WARN` 갱신) — 원본 분기 보존은 이 SPEC의 AC-008 grep이 대신 지킨다. (b) 018 수동 M-1(미디어 쿼리가 배율에 반응)은 019 병합 뒤 기본값(선명 모드)에서 수행하면 한계 5로 실패해 보이므로 **원본 보기에서 수행해야 한다.** 이 SPEC은 018 본문을 수정하지 않는다.
- 앱 셸 CSP는 두 곳만 넓어진다: `script-src`에 해시 1개, `style-src`에 asset 출처 3개(사용자 결정 Q1=A, D1=A). 해시가 허용하는 것은 앱이 만든 고정 스크립트 한 덩어리뿐이다. `style-src`의 asset 출처는 앱 셸 문서도 asset 출처 스타일시트를 불러올 수 있게 한다 — CSS 한정이며 `img-src`·`frame-src`·`default-src`에 이미 asset 출처가 있어 추가 노출은 작다고 판단한다(CSS 기반 데이터 유출 경로는 `connect-src`/`img-src`가 기존대로 제한).

### 배율 방식 가정 (run 첫 관문)

- 문서 `documentElement.style.zoom`이 WebKit(WKWebView)에서 레이아웃·래스터를 다시 해 선명하다는 것은 원리상 기대일 뿐 실기기에서 확인되지 않았다(iframe **요소**의 `zoom`이 무효였다는 실측과 별개 문제). run 단계 첫 작업은 M-1(macOS에서 150%·200% 선명도)이며, 실패하면 run을 멈추고 차단 보고를 돌려 사용자가 고른다(후보: 100% 상한 등 advisor (d)).

## §4 REQ-AC 대응

| REQ | AC | 검증 기법 |
|-----|-----|----------|
| REQ-PREVIEW019-001 | AC-PREVIEW019-001 | unit — 저장소 기본값·재수화 정규화 |
| REQ-PREVIEW019-002 | AC-PREVIEW019-002 | unit — 렌더 속성 (readFile 모의) |
| REQ-PREVIEW019-003 | AC-PREVIEW019-003 | unit — 조립 함수 표 |
| REQ-PREVIEW019-004 | AC-PREVIEW019-004 | unit — 재렌더 없음·메시지·자식 처리기 |
| REQ-PREVIEW019-005 | AC-PREVIEW019-005 | unit — 자식 문서 클릭 |
| REQ-PREVIEW019-006 | AC-PREVIEW019-006 | unit — 해시 일치·CSP 형태 |
| REQ-PREVIEW019-007 | AC-PREVIEW019-007 | unit — 폴백 3종 |
| REQ-PREVIEW019-008 | AC-PREVIEW019-008 | unit + grep — 018 회귀 |
| REQ-PREVIEW019-009, 012 | AC-PREVIEW019-009 | unit — 헤더 |
| REQ-PREVIEW019-010 | AC-PREVIEW019-010 | unit + git diff + grep |
| REQ-PREVIEW019-011 | AC-PREVIEW019-011, AC-PREVIEW019-014 | unit + grep + 수동 M-6 |
| REQ-PREVIEW019-002, 004 | AC-PREVIEW019-012 | 수동 M-1 (macOS·Windows 선명도) |
| REQ-PREVIEW019-003, 004, 005 | AC-PREVIEW019-013 | 수동 M-2·M-3·M-4 |
| REQ-PREVIEW019-006 | AC-PREVIEW019-015 | 수동 M-5 (엔진별 CSP 상속·해시 스크립트 실행) |

## §5 Exclusions (What NOT to Build)

### Out of Scope — 페이지 스크립트·외부 리소스 지원

- 선명 모드에서 HTML 페이지 자체 스크립트나 외부 CDN 리소스를 허용하려고 셸 CSP를 더 넓히지 않는다(`script-src`에 `'unsafe-inline'`·`asset:`·http(s) 출처 추가 금지, `style-src`·`img-src` 등에 외부 http(s) 출처 추가 금지 — REQ-006의 `http(s)://asset.localhost`는 asset 출처이므로 예외). REQ-006의 해시 1개와 `style-src` asset 출처 3개가 전부다. 필요한 페이지는 원본 보기를 쓴다.

### Out of Scope — 미디어 쿼리 반응

- 선명 모드에서 `@media` 폭 조건이 배율에 반응하게 만들기 위한 iframe 크기 조작(018식 역보정)은 하지 않는다. 문서 `zoom`과 크기 역보정의 병용은 선명도를 되돌리므로 금지한다.

### Out of Scope — 원본 보기 선명화

- 원본 보기(asset iframe)의 100% 초과 흐림을 고치지 않는다(§7-1).

### Out of Scope — 링크 이동·새 창

- 상대 파일 링크·외부 링크의 가로채기, 새 창 열기, 폼 제출 허용을 만들지 않는다.

### Out of Scope — 휠·핀치, 앱 전체 배율

- 018이 제외한 휠·핀치 입력과 앱 전체 웹뷰 배율 API는 계속 제외한다.

### Out of Scope — Rust 명령 변경

- 새 Rust 명령을 만들지 않는다. 기존 `read_file`, `read_file_size`만 쓴다. 앱 ACL 매니페스트 도입과 명령 권한 정리는 SPEC-SEC-001의 몫이다.

### Out of Scope — 내보내기

- 선명 모드·배율은 화면 미리보기에만 적용하며 내보내기 결과에 영향을 주지 않는다.

## §6 References

- 수용 기준: `acceptance.md`. 구현 계획·결정·위험: `plan.md`. 진행 기록: `progress.md`.
- 선행: `.moai/specs/SPEC-PREVIEW-018-html-preview-zoom/`(병합됨), `.moai/specs/SPEC-PREVIEW-004/`(샌드박스), SPEC-SEC-001(병행 계획 중, 앱 ACL 매니페스트).
- 기각 설계와 근거: `.moai/reports/plan-audit/SPEC-PREVIEW-018-v0.4.0-rejected-spec.md`, `SPEC-PREVIEW-018-review-3.md`(D1 critical), `SPEC-PREVIEW-018-advisor.md`(§2 (b), §3, §4).
- 코드 앵커: `src/components/preview/HtmlFileViewer.tsx`, `src/components/layout/Header.tsx`, `src/store/uiStore.ts`, `src/lib/tauri/ipc.ts`(`readFile`, `readFileSize`), `src/lib/preview/htmlZoom.ts`, `index.html`(메타 CSP), `src-tauri/src/commands/file_ops.rs`(`read_file`, `read_file_size`).
- plan-audit: `.moai/reports/plan-audit/SPEC-PREVIEW-019-review-N.md` (진행 중).

## §7 Open Questions (코디네이터/사용자)

1. **원본 보기의 배율 (코디네이터 기본값 적용 중)**: 원본 보기에서 018의 transform 배율을 그대로 유지한다(100% 초과 흐림 감수). 대안은 원본 보기 배율을 100% 고정으로 비활성화하는 것이다. 사용자가 다르게 고르면 REQ-008과 AC-008만 바뀐다.
2. **SPEC-SEC-001 진행 상황 의존**: SEC-001의 명령 권한 범위(특히 Remote/불투명 출처에서의 앱 명령 거부)가 확정되면 REQ-011의 세 번째 항목과 M-6의 기대값을 SEC-001 문서와 대조해 갱신한다.
