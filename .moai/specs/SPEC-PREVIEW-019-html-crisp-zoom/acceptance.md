# SPEC-PREVIEW-019 acceptance.md — 수용 기준 (Tier M, v0.1.0)

## 추적성

| AC | REQ | 검증 기법 |
|----|-----|----------|
| AC-PREVIEW019-001 | REQ-PREVIEW019-001 | unit — 저장소 |
| AC-PREVIEW019-002 | REQ-PREVIEW019-002 | unit — 뷰어 렌더 |
| AC-PREVIEW019-003 | REQ-PREVIEW019-003 | unit — 조립 함수 |
| AC-PREVIEW019-004 | REQ-PREVIEW019-004 | unit — 재렌더 없음·메시지·자식 처리기 |
| AC-PREVIEW019-005 | REQ-PREVIEW019-005 | unit — 자식 문서 클릭 |
| AC-PREVIEW019-006 | REQ-PREVIEW019-006 | unit — 해시 일치·CSP 형태 |
| AC-PREVIEW019-007 | REQ-PREVIEW019-007 | unit — 폴백 |
| AC-PREVIEW019-008 | REQ-PREVIEW019-008 | unit + grep — 018 회귀 |
| AC-PREVIEW019-009 | REQ-PREVIEW019-009, 012 | unit — 헤더 |
| AC-PREVIEW019-010 | REQ-PREVIEW019-010 | unit + git diff + grep |
| AC-PREVIEW019-011 | REQ-PREVIEW019-011 | unit + grep |
| AC-PREVIEW019-012 | REQ-PREVIEW019-002, 004 | 수동 M-1 (두 OS) |
| AC-PREVIEW019-013 | REQ-PREVIEW019-003, 004, 005 | 수동 M-2·M-3·M-4 (두 OS) |
| AC-PREVIEW019-014 | REQ-PREVIEW019-011 | 수동 M-6 (두 OS, SEC-001 이후) |
| AC-PREVIEW019-015 | REQ-PREVIEW019-006 | 수동 M-5 (두 OS) + e2e(Chromium) |

검증 계층 원칙: 조립 함수·저장소·헤더·자식 처리기 논리는 vitest + jsdom으로 충분하다. 렌더 선명도, WebKit·WebView2의 CSP 상속과 해시 허용, 불투명 출처에서의 IPC 거부는 jsdom이 재현하지 못하므로(레이아웃·래스터·네이티브 IPC가 없다) 실기기 수동 검증 없이 PASS로 기록하지 않는다. Chromium e2e는 해시 허용이 실제로 스크립트를 실행시키는지에 대한 부분 증거일 뿐 WebKit·WebView2 증거가 아니다.

## 시나리오

### AC-PREVIEW019-001 — 렌더 모드 상태 (unit)

- **Given** `localStorage['mdedit-ui-store']`에 `htmlRenderMode`가 없는 기존 형식 상태가 저장되어 있을 때, **When** 저장소가 재수화되면 **Then** `htmlRenderMode`는 `'crisp'`이고 `htmlZoom`·`fontSize` 등 다른 값은 그대로다.
- **And** 저장값이 `'original'`이면 `'original'`, `'crisp'`이면 `'crisp'`이다. 저장값이 `'Crisp'`, `'srcdoc'`, `1`, `null`, `true`, `{}`이면 `'crisp'`이다.
- **And** `setHtmlRenderMode('original')` 뒤 저장된 JSON에 `"htmlRenderMode":"original"`이 있다. 허용 밖 값을 `setHtmlRenderMode`에 주면 `'crisp'`으로 정규화된다.

### AC-PREVIEW019-002 — 선명 모드 렌더 속성 (unit)

- **Given** `htmlRenderMode`가 `'crisp'`이고 `readFileSize`가 1024, `readFile`이 `"<html><head></head><body>hi</body></html>"`를 돌려주도록 모의한 상태에서 `HtmlFileViewer`를 렌더하고 읽기가 끝나기를 기다리면,
- **Then** 렌더된 iframe의 `getAttribute('sandbox')`가 정확히 `"allow-scripts"`이고, `hasAttribute('src')`가 `false`이며, `srcdoc` 속성이 있고 `hi`를 포함한다. `readFile`은 모의된 경로 인자로 정확히 한 번 호출된다.
- **And** iframe 인라인 스타일에 `transform`이 없고(018 역보정 미사용), 감싸개의 `overflow`는 `hidden`이어도 무방하다.
- **And** 읽는 동안에는 iframe이 없고 `data-testid="html-preview-loading"` 요소가 있다. 경로를 빠르게 `a.html` → `b.html`로 바꾸면 늦게 끝난 `a.html` 결과는 반영되지 않는다.

### AC-PREVIEW019-003 — 조립 함수 `buildSrcdoc` (unit, 표 구동)

`buildSrcdoc(html, { baseHref, zoomPercent })` 결과를 검사한다. 모든 행에서 결과는 (a) `<base href="…">`가 (b) `<style>` (c) `<script>` 앞에 오며 각각 정확히 한 번 나타난다.

| 입력 | 기대 |
|------|------|
| `<!doctype html><html><head><title>t</title></head><body>b</body></html>` | `<!doctype html>`이 결과의 첫 문자열이고 주입은 `<head>` 시작 태그 바로 뒤 |
| `<HTML><HEAD></HEAD>…` (대문자) | 첫 `<HEAD>` 뒤에 주입 |
| `<head lang=x>` 속성 있는 head | 시작 태그 전체 뒤에 주입 |
| `<html><body>b</body></html>` (head 없음) | `<html>` 뒤에 `<head>`+주입+`</head>` 생성, `<body>` 이전 |
| `<p>fragment</p>` (html·head 없음) | 문서 맨 앞에 주입 |
| `<!doctype html><p>x</p>` | doctype 바로 뒤에 주입 |
| `<!-- <head> --><head></head>` | 주석 안의 `<head>`는 건너뛰고 실제 `<head>` 뒤에 주입 |
| `<head><base href="https://x/"></head>` | 주입 `<base>`가 원본 `<base>`보다 앞 |
| 빈 문자열 | 주입만 있는 유효한 문서 |

- **And** `<style>`에는 `zoom: 1.25`(zoomPercent 125일 때)가 들어 있고, zoomPercent 67이면 `0.67`, 200이면 `2`다.
- **And** `baseHrefFromAssetUrl("http://asset.localhost/C%3A/Users/u/A/page.html")` → `"http://asset.localhost/C%3A/Users/u/A/"`, `"asset://localhost//Users/u/A/page.html"` → `"asset://localhost//Users/u/A/"`처럼 마지막 `/`까지(끝 `/` 포함)이고, 폴더 이름의 한글·공백이 이중 인코딩되지 않는다.
- **And** HTML 속성에 들어가는 `baseHref`의 `"`·`<`·`&`는 이스케이프된다.

### AC-PREVIEW019-004 — 재렌더 없는 배율 (unit)

- **Given** 선명 모드로 렌더된 뷰어에서 iframe 요소와 `srcdoc` 값을 기록하고, `iframe.contentWindow.postMessage`를 스파이로 감시한 상태에서,
- **When** `setHtmlZoom(150)`을 호출하면 **Then** 같은 iframe 요소가 유지되고(`isSameNode`), `srcdoc` 속성 값이 그대로이며, 스파이가 `({ type: 'mdedit-html-zoom', zoom: 1.5 }, '*')`로 호출된다.
- **And** 모드를 `'original'`로 바꾸면 iframe 요소가 교체된다(다른 모드 분기).
- **자식 처리기 시험 구조**: 주입 스크립트 상수를 jsdom 문서 안 **자식 iframe의 window**에서 실행한다(최상위 window에서 실행하면 `window.parent === window`라 `source` 검사를 시험할 수 없다). 자식 window에 합성 `MessageEvent`를 `dispatchEvent`한다.
  - `source: window.parent`(부모 window), `data: {type:'mdedit-html-zoom', zoom:1.5}` → `documentElement.style.zoom`이 `1.5`.
  - `source`가 다른 window(형제 iframe의 window) 또는 `null`이면 → 변화 없음.
  - `data.type`이 다르거나, `zoom`이 `'1.5'`(문자열), `NaN`, `Infinity`, `0.5`, `2.5`, `-1`이거나, `data`가 `null`/문자열이면 → 변화 없음.
  - 경계값 `0.67`과 `2`는 적용된다.

### AC-PREVIEW019-005 — 해시 링크 가로채기 (unit)

- 자식 iframe 문서에 `<a href="#sec2">`, `<h2 id="sec2">`, `<a name="old">`, `<a href="#top">`, `<a href="#">`, `<a href="#missing">`, `<a href="other.html">`, `<a href="https://x/">`를 넣고 주입 스크립트를 실행한다. `scrollIntoView`와 `scrollTo`는 스텁한다.
- `#sec2` 클릭 → `defaultPrevented === true`, `#sec2` 대상의 `scrollIntoView` 호출 1회. `name="old"` 대상도 `#old`로 찾는다.
- `#top`·`#` 클릭 → `defaultPrevented === true`, 문서 맨 위로 이동(스텁된 `scrollTo(0, 0)` 호출). `#missing` → `defaultPrevented === true`, 스크롤 호출 없음.
- `other.html`·`https://x/`·내부 요소(`<a>` 안의 `<span>`을 눌러도 `closest('a')`로 해석) 중 해시가 아닌 링크는 `defaultPrevented === false`.
- 퍼센트 인코딩된 `#%ED%95%9C`(한글 id)는 디코드해서 찾는다. 잘못된 퍼센트 시퀀스(`#%E0%A4%A`)는 예외 없이 무시한다.

### AC-PREVIEW019-006 — CSP 해시 일치 (unit)

- **Given** 주입 스크립트 상수 `HTML_ZOOM_FRAME_SCRIPT`와 저장소의 `index.html`을 읽는 테스트에서,
- **Then** `sha256(HTML_ZOOM_FRAME_SCRIPT)`의 base64가 `index.html` 메타 CSP `script-src`의 `'sha256-…'` 토큰 값과 정확히 같다. 해시 토큰은 `script-src` 안에 정확히 1개다.
- **And** `script-src` 지시어 값에 `'unsafe-inline'`, `'unsafe-eval'`이 없고, `asset:`·`http`로 시작하는 출처 토큰이 없다.
- **And** 메타 CSP에서 해시 토큰만 제거한 문자열이 기준(HEAD 57b3231)의 메타 CSP와 바이트 단위로 같다(`git show 57b3231:index.html`에서 추출). 즉 `script-src` 밖 지시어와 기존 `script-src` 토큰은 그대로다.
- **And** 스크립트 상수에 `</script`, `<!--`이 들어 있지 않다. 스크립트 상수는 템플릿 보간 없는 고정 문자열이며 `buildSrcdoc`이 태그 사이에 한 글자도 바꾸지 않고 넣는다(`buildSrcdoc` 결과에서 `<script>…</script>` 사이 텍스트가 상수와 동일).

### AC-PREVIEW019-007 — 폴백 (unit)

- **Given** 선명 모드에서 (a) `readFile`이 `"Failed to read file: stream did not contain valid UTF-8"`로 reject (b) `readFile`이 `"File not found: …"`로 reject (c) `readFileSize`가 `10 * 1024 * 1024 + 1` 반환 — 각각에서,
- **Then** (a)(b)(c) 모두 asset `src`가 있는 iframe(`sandbox="allow-scripts allow-same-origin"`, 원본 방식)이 렌더되고 `role="status"` 안내가 보이며, 안내 문구는 (a) UTF-8 사유 (b) 읽기 실패 사유 (c) 크기 초과 사유로 서로 다르다. (c)에서는 `readFile`이 호출되지 않는다.
- **And** `useUIStore.getState().htmlRenderMode`는 여전히 `'crisp'`이다. 이어서 다른 파일(정상)로 경로가 바뀌면 다시 `srcdoc` 방식으로 렌더된다.
- **And** `readFileSize`가 reject해도(크기 조회 실패) 읽기를 시도하고, 읽기까지 실패하면 (b) 폴백이다. 정확히 `10 * 1024 * 1024`는 폴백이 아니다.

### AC-PREVIEW019-008 — 원본 보기 018 회귀 (unit + grep)

- **Given** `htmlRenderMode`가 `'original'`이고 `htmlZoom`이 125일 때 `HtmlFileViewer`를 렌더하면, 018 AC-003과 같은 결과다: iframe `width`·`height` `80%`, `transform` `scale(1.25)`, `transform-origin` `0 0`, 감싸개 `overflow: hidden`, `getAttribute('sandbox') === "allow-scripts allow-same-origin"`, `src`는 기존 정규화(`%2F`·`%5C` → `/`) 결과, `readFile` 미호출.
- **And** `grep -cE '^[[:space:]]+sandbox="allow-scripts allow-same-origin"$' src/components/preview/HtmlFileViewer.tsx`가 `1`이다(원본 분기 속성 줄 보존. 선명 분기의 sandbox는 다른 줄·다른 값).
- **And** 기존 `src/test/HtmlFileViewer.test.tsx`의 018 시나리오는 `htmlRenderMode: 'original'`을 시드하는 최소 수정만으로 통과한다(어서션 약화 금지).

### AC-PREVIEW019-009 — 헤더 토글 (unit)

- **Given** 현재 파일이 `/tmp/page.html`이면 **Then** 018 배율 컨트롤(접근성 이름 "Zoom out"·"Zoom in"·"Reset zoom to 100%")과 함께 이름이 `Original view`인 토글이 보이고, `htmlRenderMode`가 `'crisp'`이면 `aria-pressed="false"`, `'original'`이면 `"true"`다. 토글의 `title`에 "스크립트"와 "원본 보기"가 포함된다.
- **When** 토글을 누르면 **Then** `htmlRenderMode`가 `'crisp'` ↔ `'original'`으로 바뀐다.
- **And Given** 현재 파일이 `/tmp/note.md`·`.ts`·`.txt`이면 토글이 없고 기존 A-/A+가 그대로다.

### AC-PREVIEW019-010 — 018 UX 불변 (unit + git diff + grep)

- 018 테스트(`Header.test.tsx`의 배율 시나리오, `htmlZoom.test.ts`, `uiStore.test.ts`의 `htmlZoom` 시나리오)가 수정 없이 통과한다(`htmlRenderMode` 추가에 따른 시드 보강 제외, 어서션 변경 없음).
- `git diff --quiet 57b3231 -- src/lib/preview/htmlZoom.ts src/components/preview/SvgFileViewer.tsx src/lib/preview/previewZoom.ts src/test/SvgFileViewer.test.tsx src/test/previewZoom.test.ts`의 종료 코드가 0이다.
- `grep -rnE '\bsetZoom\b|set_zoom|zoomHotkeysEnabled|zoom_hotkeys_enabled|addEventListener\(.wheel' src src-tauri/src src-tauri/tauri.conf.json`의 출력이 비어 있다.
- 키보드 단축키 시나리오(018 AC-004)는 선명·원본 두 모드 모두에서 같은 결과다.

### AC-PREVIEW019-011 — 보안 형태 (unit + grep)

- 선명 모드 iframe의 `sandbox` 토큰 집합이 `{allow-scripts}` 하나이며 `allow-same-origin`, `allow-popups`, `allow-forms`, `allow-top-navigation*`, `allow-modals`가 없다(속성 값을 공백으로 나눈 토큰 비교).
- `grep -nE "addEventListener\(['\"]message['\"]" src/components/preview/HtmlFileViewer.tsx`의 출력이 비어 있다(부모는 프레임 메시지를 받지 않는다).
- 주입 스크립트 상수에 `fetch`, `XMLHttpRequest`, `parent.`, `top.`, `__TAURI`, `postMessage`, `localStorage`, `eval(`, `Function(`, `import(`가 없다(문자열 포함 검사).
- `HtmlFileViewer.tsx`의 `@MX:WARN` 주석에 `allow-scripts`만 쓰는 선명 모드와 `allow-same-origin`을 쓰는 원본 모드가 모두 서술되고 `SPEC-PREVIEW-019`가 명시된다.

### AC-PREVIEW019-012 — 선명도 (수동 M-1, 두 OS)

- **Given** 글자·선·이미지가 있는 HTML(예: 12~16px 본문, 1px 테두리, 상대경로 PNG)을 선명 모드로 열고,
- **When** 배율을 150%·200%로 올리면 **Then** 같은 배율의 원본 보기(018)와 나란히 비교했을 때 글자 가장자리가 명확히 더 선명하다(비트맵 확대 흔적 없음). 확대·축소 때 스크롤 위치가 유지되고 문서가 다시 로드되지 않는다(깜빡임·스크롤 초기화 없음). macOS(WKWebView)와 Windows(WebView2) 모두 기록한다. **이 시험이 macOS에서 실패하면 run을 멈추고 차단 보고**(spec.md §3).

### AC-PREVIEW019-013 — 상대 자원·해시 링크·한계 관찰 (수동 M-2·M-3·M-4, 두 OS)

- M-2: 같은 폴더의 `style.css`, 하위 폴더 `img/a.png`, 한글·공백 폴더 이름 아래 자원이 `<base>`로 정상 로드된다(Windows는 `C%3A` 형식 경로 포함).
- M-3: 긴 문서에서 `#section` 목차 링크를 누르면 프레임 안에서 해당 위치로 스크롤하고 프레임이 asset 주소로 이동하지 않는다. 이어서 배율을 바꿔도 `srcdoc`이 유지된다.
- M-4(한계 관찰, 실패가 아니라 기록): `@media (max-width)` 페이지가 배율에 반응하지 않는 것, 인라인 `<script>`가 막히는 것(콘솔 CSP 위반)을 확인하고 결과를 기록한다. 같은 페이지가 원본 보기에서는 위 두 가지가 018대로 동작한다.

### AC-PREVIEW019-014 — 앱 명령 거부 (수동 M-6, 두 OS, SEC-001 병합 이후)

- 배경: 선명 모드에서는 상속된 CSP가 페이지 인라인 스크립트를 이미 막으므로(spec.md §3), 앱 명령 거부 자체를 시험하려면 시험용 스크립트가 실행되어야 한다. 그래서 **커밋하지 않는 검증용 빌드**에서만 시험 HTML의 인라인 스크립트 sha256을 `script-src`에 임시로 더한다. 이 임시 허용은 저장소에 남기지 않으며 시험 방법과 해시는 progress.md에 기록한다.
- **Given** 시험 HTML이 다음을 화면에 써 주는 인라인 스크립트를 담고 선명 모드로 열린 상태에서: `typeof window.__TAURI_INTERNALS__`, `window.__TAURI_INTERNALS__?.invoke('read_file', { path: <민감하지 않은 임시 파일> })`의 결과/오류, 같은 방식의 `write_file`, `window.chrome?.webview?.postMessage` 시도 뒤 앱 동작.
- **Then** 앱 명령 호출이 모두 거부되고 파일이 읽히거나 쓰이지 않는다(SEC-001 적용 후). SEC-001 적용 전·후 결과를 모두 기록하고, Windows에서는 원본 보기(asset iframe) 기준선도 함께 기록한다(advisor 처방 4-1~4-3).
- 거부되지 않으면 결함이며 SPEC-SEC-001 또는 이 SPEC에 되돌려 보고한다.

### AC-PREVIEW019-015 — 엔진별 CSP 상속·해시 스크립트 실행 (수동 M-5, 두 OS + e2e)

- e2e(Chromium, Playwright): 개발 서버 `index.html`의 메타 CSP 그대로 선명 모드 HTML을 열고 "Zoom in"을 누르면 프레임의 `documentElement.style.zoom`이 `1.1`이 된다(해시가 스크립트를 허용). 같은 프레임 안 페이지 인라인 스크립트는 실행되지 않는다(CSP 위반 콘솔 메시지).
- 수동 M-5: macOS(WKWebView)·Windows(WebView2)에서 같은 두 가지를 확인한다 — "Zoom in"이 프레임에 적용되는지(해시 허용), 인라인 페이지 스크립트가 막히는지(상속). 엔진이 CSP를 상속하지 않아 페이지 스크립트가 도는 경우는 §3 한계 서술을 갱신 대상으로 기록한다(실패 아님).

## 수동 검증 항목 (실기기, OS별 기록)

| ID | 내용 | macOS (WKWebView) | Windows (WebView2) |
|----|------|-------------------|--------------------|
| M-1 | 선명도(150·200%)·스크롤 유지·재로드 없음 (AC-012) — **run 첫 관문** | 필수 | 필수 |
| M-2 | 상대 자원 `<base>` 로드 (AC-013) | 필수 | 필수 |
| M-3 | 해시 링크 프레임 안 이동 (AC-013) | 필수 | 필수 |
| M-4 | 미디어 쿼리 비반응·인라인 스크립트 차단 관찰 (AC-013) | 필수 | 필수 |
| M-5 | 엔진별 CSP 상속·해시 스크립트 실행 (AC-015) | 필수 | 필수 |
| M-6 | `invoke` 거부 — SEC-001 전·후, 원본 보기 기준선 (AC-014) | 필수 | 필수 |

## 경계 사례

- 분할 보기에서 HTML 소스를 편집·저장한 직후: 선명 모드는 경로가 같으면 다시 읽지 않는다(018 asset iframe의 갱신 동작을 run에서 재측정해 같은 수준으로 맞춘다, spec.md §3-9).
- `htmlPath`가 바뀌는 중 읽기가 겹침: 마지막 경로 결과만 반영(AC-002).
- 폴백 안내 중 사용자가 헤더에서 모드를 바꾸면 폴백 안내는 사라지고 선택한 모드가 적용된다.
- 배율 67%(축소)에서도 선명 모드는 문서 `zoom`을 쓴다(축소 흐림 문제는 없었으나 동작을 하나로 통일).
- 파일이 비어 있어도 주입만 있는 유효한 문서를 렌더한다(AC-003 마지막 행).

## 품질 게이트

- `npx vitest run` 전부 통과, 새·수정 테스트 포함.
- `npx tsc --noEmit` 오류 0, `npx eslint` 새 오류 0.
- `npx playwright test e2e/html-file-viewer.spec.ts`(원본 보기 시드로 회귀 없음) + 새 선명 모드 e2e 통과.

## Definition of Done

- 활성 AC 001~011이 모두 PASS이고 품질 게이트 통과. 미검증 항목이 있으면 완료가 아니다.
- run 착수 조건: SPEC-SEC-001 `status: completed`(병합) 확인 + M-1 프로토타입 관문(macOS) 통과 기록.
- run 단계 완료 표시: AC 001~011(+ AC-006 해시 일치) PASS. 수동 M-1~M-6은 macOS·Windows 모두에서 수행되어 결과가 progress.md에 OS별로 남아 있어야 SPEC을 `completed`로 닫는다. M-6은 SEC-001 적용 상태에서 기록된 결과여야 한다.
- 원본 보기 분기의 sandbox 속성 줄과 선명 분기를 설명하는 갱신된 `@MX:WARN`이 존재한다(AC-008·011).
