# SPEC-PREVIEW-018 acceptance.md — 수용 기준 (Tier S, 검증 층 분리, v0.2.0)

## 추적성

| AC | REQ | 검증 기법 |
|----|-----|----------|
| AC-PREVIEW018-001 | REQ-PREVIEW018-001 | unit — 헤더 렌더링 |
| AC-PREVIEW018-002 | REQ-PREVIEW018-002 | unit — 단계 함수·저장소·버튼 비활성 |
| AC-PREVIEW018-003 | REQ-PREVIEW018-003 | unit + 수동 M-1 |
| AC-PREVIEW018-004 | REQ-PREVIEW018-004 | unit + 수동 M-2 |
| AC-PREVIEW018-005 | REQ-PREVIEW018-005 | unit(제스처 논리) + 수동 M-3 필수(두 OS) |
| AC-PREVIEW018-006 | REQ-PREVIEW018-006 | unit — 재수화 |
| AC-PREVIEW018-007 | REQ-PREVIEW018-007 | unit + grep + git diff |
| AC-PREVIEW018-008 | REQ-PREVIEW018-004, REQ-PREVIEW018-007 | 수동 M-4·M-5(두 OS) |

검증 계층 원칙: 단계 계산·저장소·헤더 렌더링·키 이벤트 분기는 vitest + jsdom으로 충분하다. 휠·핀치의 실제 전달 경로, iframe 안 초점, iframe 문서의 뷰포트 폭, 웹뷰 기본 배율과의 충돌은 jsdom이 재현하지 못하므로(합성 이벤트는 실제 브라우저 전달 순서와 cross-origin 경계를 거치지 않는다) 실기기 수동 검증 없이 PASS로 기록하지 않는다.

## 시나리오

### AC-PREVIEW018-001 — HTML 전용 배율 컨트롤 (unit)

- **Given** `fileStore.currentFile`이 `/tmp/page.html`이고 `htmlZoom`이 110인 상태에서,
- **When** `Header`를 렌더하면,
- **Then** 접근성 이름이 "Zoom out"·"Zoom in"·"Reset zoom to 100%"인 버튼과 `110%` 텍스트가 보이고, "Decrease font size"·"Increase font size" 버튼은 없다.
- **And Given** `currentFile`이 `/tmp/note.md`(또는 `.ts`, `.txt`)이면, **Then** 기존 "Decrease font size"·"Increase font size" 버튼과 `{fontSize}px` 텍스트가 보이고 HTML 배율 컨트롤은 없다.

### AC-PREVIEW018-002 — 단계 배율과 경계 (unit)

- **Given** 단계 목록 `[67, 75, 80, 90, 100, 110, 125, 150, 175, 200]`과 배율 100인 상태에서,
- **When** "Zoom in"을 한 번 누르면 **Then** 110, 이어서 "Zoom out"을 두 번 누르면 **Then** 90이다.
- **When** 배율이 200이면 **Then** "Zoom in" 버튼이 `disabled`이고, `stepUp(200)`은 200이다. 배율이 67이면 **Then** "Zoom out" 버튼이 `disabled`이고, `stepDown(67)`은 67이다.
- **When** 배율 150에서 "Reset zoom to 100%"를 누르면 **Then** 100이다.

### AC-PREVIEW018-003 — 브라우저식 적용 (unit + 수동 M-1)

- **Given** `htmlZoom`이 125인 상태에서 `HtmlFileViewer`를 렌더하면,
- **When** 테스트가 iframe 요소의 인라인 스타일을 읽으면,
- **Then** `width`와 `height`가 `80%`(=100/1.25), `transform`이 `scale(1.25)`, `transform-origin`이 `0 0`(또는 `0px 0px`)이고, 감싸개(`data-testid="html-preview-zoom-wrapper"`)의 `overflow`가 `hidden`이다. `htmlZoom`이 100이면 변환이 없다(`transform`이 비었거나 `none`).
- **And** 렌더된 iframe의 `getAttribute('sandbox')`가 정확히 `"allow-scripts allow-same-origin"`이고, `src`는 기존 정규화(`%2F`·`%5C` → `/`) 결과와 같다.
- **And** 수동 M-1 결과가 두 OS 모두 progress.md에 기록되어 있다.

### AC-PREVIEW018-004 — 키보드 단축키 (unit + 수동 M-2)

- **Given** 보기 종류가 `html`이고 배율이 100이며 초점이 앱 셸 문서에 있고, 테스트가 `navigator` 플랫폼 값을 macOS(`MacIntel`)로 모의한 상태에서,
- **When** `document`에 `keydown`(`key: '='`, `metaKey: true`, `cancelable: true`)을 보내면,
- **Then** 배율이 110이 되고 이벤트의 `defaultPrevented`가 `true`다. 같은 조건에서 `key: '+'`도 한 단계 올리고, `key: '-'`는 한 단계 내리고, `key: '0'`은 100으로 되돌린다.
- **And** macOS 조건에서 `ctrlKey: true` + `key: '='`는 배율을 바꾸지 않고 `defaultPrevented`가 `false`다. 플랫폼 값을 Windows(`Win32`)로 모의하면 `ctrlKey: true` + `key: '='`가 한 단계 올리고, `metaKey: true` + `key: '='`는 바꾸지 않는다.
- **And** `isComposing: true`이거나, 문서에 `role="dialog"` + `aria-modal="true"` 요소가 있으면(설정 모달·확인 대화상자 열림), 같은 키는 배율을 바꾸지 않고 `defaultPrevented`가 `false`다.
- **And Given** 보기 종류가 `markdown`이면, **When** 같은 키를 보내면 **Then** `htmlZoom`과 `fontSize`가 모두 그대로이고 `defaultPrevented`가 `false`다.
- **And** 수동 M-2 결과가 두 OS 모두 progress.md에 기록되어 있다.

### AC-PREVIEW018-005 — Cmd/Ctrl + 휠·핀치 (unit 논리 + 수동 M-3 필수)

단위 부분(가짜 타이머 사용):

- **Given** 보기 종류가 `html`이고 배율이 100인 상태에서,
- **When** 감싸개에 `WheelEvent('wheel', { deltaY: -60, deltaMode: 0, ctrlKey: true, cancelable: true })`를 보내면,
- **Then** 배율이 110이 되고 `defaultPrevented`가 `true`다. 같은 조건에서 `deltaY: 60`이면 90이 된다. `ctrlKey`·`metaKey`가 모두 없으면 배율은 그대로이고 `defaultPrevented`는 `false`다.
- **And When** `deltaY: -10` 이벤트를 각각 20ms 간격으로 30번 보내면(누적 −300px, 간격이 150ms보다 짧아 한 제스처), **Then** 배율은 110으로 한 단계만 바뀐다. 이어서 150ms 이상 이벤트 없이 기다린 뒤 같은 묶음을 다시 보내면 **Then** 125가 된다(새 제스처).
- **And When** 한 제스처 안에서 누적 절댓값이 50px 미만(예: `deltaY: -10` 4번)이면, **Then** 배율이 바뀌지 않는다. `deltaMode: 1`(줄 단위) `deltaY: -4`는 −64px로 환산되어 한 단계 올린다.

실기기 부분(필수):

- **Given** 두 OS(macOS WKWebView, Windows WebView2) 각각에서 반응형 HTML 파일을 연 상태에서,
- **When** 포인터를 iframe 위(HTML 내용 위)에 두고 Cmd/Ctrl+마우스 휠을 한 번 굴리고, 트랙패드로 핀치 확대·축소를 한 번씩 하면,
- **Then** 두 OS 모두에서 각 동작마다 배율이 정확히 한 단계 바뀌고, 앱 UI 전체 크기는 바뀌지 않는다.
- 이 AC는 위 실기기 관찰이 두 OS 모두에서 확인될 때만 PASS다. 휠 배율이 어느 위치에서도 동작하지 않거나 한 OS에서라도 iframe 위에서 동작하지 않으면 FAIL이며, 그 경우 run 단계는 spec.md §3 실측 관문에 따라 멈추고 차단 보고를 돌려준다.

### AC-PREVIEW018-006 — 전역 영속화 (unit)

- **Given** `localStorage['mdedit-ui-store']`에 `htmlZoom`이 없는 기존 형식 상태(`fontSize: 16` 등)가 저장되어 있을 때,
- **When** 저장소가 재수화되면,
- **Then** `htmlZoom`은 100이고 `fontSize`는 16 그대로다.
- **And** 저장값이 113이면 110, 77.5면 75(같은 거리면 작은 쪽), 999면 200, 10이면 67이다. 저장값이 `"150"`(숫자 문자열), `"abc"`, `null`, `true`이거나 비유한 수이면 100이다.
- **And** `setHtmlZoom(150)` 뒤 저장된 JSON에 `"htmlZoom":150`이 있다(재시작 후 유지). 서로 다른 두 HTML 파일을 차례로 열어도 같은 값이 쓰인다.

### AC-PREVIEW018-007 — 다른 크기 조절과 분리 (unit + grep + git diff)

- **Given** `fontSize` 18, `htmlZoom` 100인 상태에서,
- **When** HTML 배율을 200까지 올리고 100으로 되돌리면,
- **Then** `fontSize`는 18 그대로다.
- **And** `git diff --quiet 00c0edb -- src/test/SvgFileViewer.test.tsx src/test/previewZoom.test.ts src/components/preview/SvgFileViewer.tsx src/lib/preview/previewZoom.ts`의 종료 코드가 0이고, 두 테스트 파일이 통과한다.
- **And** `grep -rnE '\bsetZoom\b|set_zoom|zoomHotkeysEnabled|zoom_hotkeys_enabled' src src-tauri/src src-tauri/tauri.conf.json`의 출력이 비어 있다(plan 단계 HEAD 00c0edb에서 출력 없음 확인).
- **And** `grep -cE '^[[:space:]]+sandbox="allow-scripts allow-same-origin"$' src/components/preview/HtmlFileViewer.tsx`가 `1`이다(plan 단계 HEAD 00c0edb에서 `1` 확인. 리터럴 전체 개수는 주석 포함 `3`이며 이 AC는 속성 줄만 센다).
- **And** `git diff -w 00c0edb -- src/components/preview/HtmlFileViewer.tsx | grep -cE '^[-+][^-+].*sandbox'`가 `0`이다(공백 변화 무시. iframe을 감싸개로 옮기며 들여쓰기만 바뀌는 것은 허용하고, sandbox 속성 줄과 sandbox 설명 주석의 내용은 바뀌지 않았다).

### AC-PREVIEW018-008 — iframe 초점·웹뷰 배율 경계 (수동 M-4·M-5, 두 OS)

- **Given** 두 OS 각각에서 HTML 파일을 연 상태에서,
- **When** iframe 안 문서를 클릭해 초점을 옮긴 뒤 Cmd/Ctrl+`=`를 누르면,
- **Then** 앱이 멈추거나 오류를 내지 않고 앱 UI 전체(헤더·탐색기) 크기가 바뀌지 않는다. 이 상태에서 HTML 배율 값이 바뀌지 않는 것은 spec.md §3 "iframe 안 키보드 초점" 제한에 해당한다. 이어서 헤더를 한 번 누른 뒤 같은 키를 누르면 배율이 한 단계 오른다(REQ-004).
- **And When** iframe 안 초점 상태에서 Ctrl/Cmd+`=`·`-`·`0`을 누르거나, 포인터를 iframe 위에 두고 Ctrl/Cmd+휠을 굴리면, **Then** 앱 UI 전체 크기가 바뀌지 않는다(REQ-007). 바뀌면 결함으로 기록한다.

## 수동 검증 항목 (실기기, OS별 기록 — 모두 필수)

| ID | 내용 | macOS (WKWebView) | Windows (WebView2) |
|----|------|-------------------|--------------------|
| M-0 | plan.md §F M0 휠·핀치 도달 실측(구현 전) | 필수 | 필수 |
| M-1 | 반응형 규칙이 있는 HTML(예: `@media (max-width: 600px)`)을 열고 배율을 올릴 때 줄바꿈이 다시 계산되고 미디어 쿼리가 전환되는지, 배율 뒤에도 iframe 스크롤로 문서 끝까지 보이는지 | 필수 | 필수 |
| M-2 | 초점이 헤더·탐색기·편집기에 있을 때 Cmd/Ctrl+`=`/`+`/`-`/`0`이 동작하고 웹뷰 자체 배율이 함께 바뀌지 않는지 | 필수 | 필수 |
| M-3 | 포인터가 iframe 위일 때 마우스 휠·트랙패드 핀치로 동작당 정확히 한 단계 바뀌는지(AC-005 실기기 부분) | 필수 | 필수 |
| M-4 | iframe 안 초점 상태 단축키(AC-008 첫 시나리오) | 필수 | 필수 |
| M-5 | iframe 안 초점 상태 Ctrl/Cmd+`=`/`-`/`0`, iframe 위 Ctrl/Cmd+휠이 앱 UI 전체 크기를 바꾸지 않는지(AC-008 둘째 시나리오) | 필수 | 필수 |

## 경계 사례

- 분할 보기에서 HTML 소스 편집기에 초점이 있을 때: 단축키는 HTML 배율로 간다(편집기에 해당 키 바인딩 없음 — plan.md §A 조사, run에서 CodeMirror 기본 키맵 재확인).
- 설정 모달·확인 대화상자가 열려 있을 때: 단축키는 무시되고 기본 동작도 막지 않는다(AC-004).
- HTML 로드 오류 화면(`loadError`)에서도 헤더 컨트롤은 보이며 값 변경은 다음 로드에 적용된다.
- 편집기 전용 보기 모드에서 HTML 파일이면 헤더 컨트롤은 보이되 화면 변화는 없다(값은 저장됨).

## 품질 게이트

- `npx vitest run` 전부 통과, 새·수정 테스트 포함.
- `npx tsc --noEmit` 오류 0, `npx eslint` 새 오류 0.
- `npx playwright test e2e/html-file-viewer.spec.ts` 회귀 없음.

## Definition of Done

- AC-PREVIEW018-001~008이 모두 PASS다. 미검증 항목이 있으면 완료가 아니다.
- 수동 검증 M-0~M-5가 macOS와 Windows 두 OS 모두에서 수행되어 결과가 progress.md §E.2에 OS별로 남아 있다. 한 OS에서라도 미수행인 항목이 있으면 SPEC은 `completed`로 닫지 않는다.
- M-0 결과가 "도달하지 않음"이면 이 SPEC은 이 판의 범위로는 완료될 수 없으며, 사용자 결정에 따른 SPEC 개정 후 다시 판정한다.
- iframe `sandbox` 속성 줄과 `@MX:WARN` 주석이 바뀌지 않았다(AC-007).
