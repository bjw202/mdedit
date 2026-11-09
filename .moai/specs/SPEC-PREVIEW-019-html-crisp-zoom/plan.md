# SPEC-PREVIEW-019 plan.md — 구현 계획 (Tier M, v0.1.0)

## §A Context

- 목표: HTML 미리보기 100% 초과 확대를 선명하게 만든다. 방식은 HTML 텍스트를 앱이 읽어 `<base>`·초기 `zoom` 스타일·고정 스크립트를 주입한 `srcdoc` iframe(`sandbox="allow-scripts"`, 불투명 출처)이고, 배율 변경은 부모 → 자식 `postMessage`로 `documentElement.style.zoom`만 바꾼다. 요구는 `spec.md` §2, 수용 기준은 `acceptance.md`.
- 기준: origin/main 57b3231(SPEC-PREVIEW-018 병합 포함). **이 계획은 구현하지 않는다. Implementation Kickoff Approval은 받지 않았고, run은 SPEC-SEC-001 병합 뒤에만 시작한다.**
- 사용자 결정(오케스트레이터 경유): Q1=A(셸 CSP `script-src`에 고정 스크립트 sha256 1개), Q2=원본 보기 토글 포함·전역 영속. 코디네이터 기본값: 원본 보기 배율은 018 그대로(spec.md §7-1).

### 검증된 코드 앵커 (HEAD 57b3231, plan 단계에서 직접 읽음)

| 앵커 | 내용 |
|------|------|
| `src/components/preview/HtmlFileViewer.tsx:1-8` | `@MX:WARN`(sandbox, SPEC-PREVIEW-004) — 선명 모드 추가에 맞춰 갱신(REQ-011) |
| `src/components/preview/HtmlFileViewer.tsx:59-65` | `convertFileSrc` + `%2F`·`%5C` → `/` 정규화 — `baseHrefFromAssetUrl`의 입력 |
| `src/components/preview/HtmlFileViewer.tsx:67-102` | 018 감싸개 + 크기 역보정 + `transform` + `sandbox="allow-scripts allow-same-origin"` 속성 줄(L97) — **원본 분기로 보존** |
| `src/store/uiStore.ts:118-215` | zustand persist `mdedit-ui-store`, `version: 1`, `merge`(L202-209, `htmlZoom` 정규화 선례), `htmlZoom` 액션 L181-186 |
| `src/components/layout/Header.tsx:230-262` | HTML 배율 컨트롤 `.md-stepper`(L237-260), `ViewModeToggle`·`ImageModeToggle` 주변 — 토글 배치 위치 |
| `src/lib/preview/htmlZoom.ts` | 단계 목록·`snapToStep` — 무변경 |
| `src/lib/tauri/ipc.ts:12-18, 28-35` | `readFile`(UTF-8 문자열), `readFileSize`(`read_file_size`) — 재사용 |
| `src-tauri/src/commands/file_ops.rs:35-45` | `read_file`: `validate_path`는 `..`만 막음, `read_to_string` — 비 UTF-8이면 오류 반환(폴백 근거) |
| `index.html:7` | 메타 CSP — `script-src 'self' 'wasm-unsafe-eval'`, `frame-src 'self' asset: http://asset.localhost https://asset.localhost`(srcdoc은 `about:srcdoc`이라 `frame-src` 영향 없음) |
| `src-tauri/tauri.conf.json:21-26` | `csp: null`, `assetProtocol.scope: []`(폴더 열 때 `register_asset_scope`로 런타임 등록) |
| `src/components/preview/PreviewContainer.tsx:46` | `<HtmlFileViewer htmlPath={currentFile} />` — 시그니처 불변 |
| `e2e/html-file-viewer.spec.ts` | 기존 asset iframe 시나리오 — 원본 모드 시드 필요 |

### plan 단계 실측 (이 실행, 이 트리)

- Chromium(Playwright 설치본)에서 `index.html` 메타 CSP를 그대로 적용한 페이지 안 `sandbox="allow-scripts"` `srcdoc` iframe의 인라인 스크립트: **차단**(`Executing inline script violates the following Content Security Policy directive 'script-src 'self' 'wasm-unsafe-eval''…`, 프레임 텍스트 `x` 유지). CSP 없는 대조군: 실행(`script-ran`). → srcdoc은 셸 CSP를 상속한다. WebKit·WebView2는 미실측(M-5).
- 일회성 시험 스크립트는 저장소에 남기지 않았다(삭제 확인).

## §B Known Issues (위험)

1. **R1 문서 `zoom`이 WKWebView에서 선명하지 않을 가능성 (High)**: iframe 요소의 `zoom`이 무효였다는 실측은 있으나 문서 `documentElement` `zoom`의 선명도는 미확인. 완화: M1 관문(프로토타입, macOS 실기기)에서 150·200%를 측정하고 실패하면 run 정지·차단 보고.
2. **R2 엔진별 CSP 상속 차이 (Medium)**: 엔진이 상속하지 않으면 페이지 스크립트가 돈다(해시 토큰은 무해). 반대로 더 엄격하면 배율 스크립트도 막힐 수 있다(해시 불일치 시). 완화: AC-006 해시 일치 테스트 + M-5 실기기.
3. **R3 Windows IPC 노출 (High, SEC-001 의존)**: advisor 처방 — Windows는 하위 프레임에도 IPC 초기화 스크립트가 주입되며(wry `lib.rs:1007`), 앱 ACL 매니페스트가 없으면 앱 명령이 출처와 무관하게 ACL을 건너뛴다. 선명 모드의 CSP 상속은 `srcdoc` 문서 안에서만 페이지 스크립트를 막고, 프레임이 이동하면(링크 클릭, 클릭 없는 `<meta http-equiv="refresh">`, 중첩 `<iframe>`) 이동한 asset 문서는 CSP 없이 스크립트를 실행한다(audit review-1이 Playwright Chromium·WebKit에서 실측). 파일 내용만으로 우회되므로 **방어로 세지 않는다.** 완화: SEC-001 선행 + M-6.
4. **R4 `fetch`/모듈/폰트/저장소 등 알려진 한계**: spec.md §3. 완화: 원본 보기 토글 + 툴팁 안내.
5. **R5 해시-스크립트 드리프트 (Medium)**: 스크립트 한 글자라도 바뀌면 해시가 달라져 배율이 조용히 안 먹는다. 완화: AC-006 테스트가 상수 → 해시 → `index.html`을 대조(CI 실패로 드러남), 스크립트는 고정 상수 한 곳(`htmlSrcdoc.ts`).
6. **R6 미래 Tauri CSP 설정과의 충돌**: `csp: null`이 바뀌면 Tauri가 자체 해시/nonce를 덧붙이므로 공존 재검증 필요(spec.md §3). SEC-001이 CSP를 건드리는지 run 착수 전 확인.
7. **R7 asset scope**: `<base>`로 풀린 상대 자원은 asset 프로토콜을 타므로 파일이 속한 폴더가 asset scope에 있어야 한다. 현재 asset iframe과 같은 전제(폴더 열기 시 `register_asset_scope`). 폴더 밖 단독 파일 열기에서 자원이 안 보이는 것도 018과 같은 한계이며 새로 만들지 않는다.
8. **R8 대용량 메모리**: 10 MiB 상한 폴백(REQ-007). 상한 값은 `HTML_CRISP_MAX_BYTES` 상수 한 곳.
9. **R9 갱신 동작 차이**: 같은 경로 파일이 바뀐 뒤 갱신 — asset iframe 쪽 동작을 run에서 재측정 후 맞춘다(spec.md §3-9).

## §C Pre-flight (run 시작 점검)

1. `moai`/`spec-workflow.md` Depends_on Pre-flight: `.moai/specs/SPEC-SEC-001*/spec.md`의 `status: completed`가 아니면 run을 시작하지 않는다(AskUserQuestion: wait/override/abort).
2. `git rev-parse --short HEAD`가 57b3231 또는 후손(SEC-001 병합 포함)인지, 작업 위치를 확인한다. §A 앵커 행 번호를 재확인하고 어긋나면 SPEC은 고치지 않고 재측정 값을 progress.md에 기록한다.
3. SEC-001이 `index.html` CSP·`tauri.conf.json`·`capabilities/`를 바꿨는지 확인한다(R6). 바꿨으면 해시 토큰 위치·공존을 다시 확인한다. AC-006의 기준 토큰 집합은 **이 시점의 `index.html` 메타 CSP에서 해시를 뺀 값으로 확정**해 테스트에 고정한다(git 이력 비교 금지: CI shallow checkout).
3a. SPEC-PREVIEW-018 상태(`status`)를 확인한다. `implemented`(수동 M-1·M-2·M-4·M-5 미기록)면 018 수동 확인은 원본 보기에서 수행해야 함을 progress.md에 적는다(spec.md §3 "SPEC-PREVIEW-018과의 관계").
4. 기준선: `npx vitest run src/test/HtmlFileViewer.test.tsx src/test/Header.test.tsx src/test/uiStore.test.ts`, `npx tsc --noEmit`, `npx eslint` 결과를 기록한다.

## §D Constraints

- 원본 분기의 `sandbox="allow-scripts allow-same-origin"` 속성 줄·`src` 정규화·`onError`·감싸개 스타일 무변경.
- 셸 CSP 변경은 정확히 두 가지: `script-src`에 해시 토큰 1개, `style-src`에 asset 출처 3개(`asset:`, `http://asset.localhost`, `https://asset.localhost`). `unsafe-inline`/`unsafe-eval`/그 밖의 새 출처 금지. 다른 지시어 무변경(사용자 결정 Q1=A, D1=A).
- 새 Rust 명령 금지(기존 `read_file`, `read_file_size`만).
- 018 배율 컨트롤·단축키·`htmlZoom` 영속화·`previewZoom.ts`·`SvgFileViewer` 무변경. 웹뷰 zoom API·휠 리스너 금지.
- 부모에 이 프레임용 `message` 리스너 금지. 주입 스크립트에 네트워크·저장소·`parent`/`top` 접근 금지.
- 코드 주석은 한국어(`code_comments: ko`).

## §E Self-Verification (게이트)

- vitest + tsc + eslint + Playwright(원본 모드 시드로 기존 e2e 회귀 + 새 선명 모드 e2e).
- AC-006 해시 일치 테스트가 CI에서 실패하지 않는 것을 확인(스크립트 한 글자 변경 시 실패하는지 사전 확인 포함).
- 수동 M-1~M-6은 macOS·Windows 모두, OS별로 progress.md에 기록. M-6은 SEC-001 적용 후 결과.

## §F Milestones (바뀔 가능성이 큰 결정부터)

### M1 — 프로토타입 관문 (Priority High, 커밋 금지)

- 버려질 임시 변경으로 macOS 실기기에서: `sandbox="allow-scripts"` `srcdoc` + `html { zoom }`이 150·200%에서 선명한지, 해시 스크립트가 실행되는지, `postMessage`로 `style.zoom`이 바뀌는지, 스크롤이 유지되는지 본다. 결과(스크린샷 경로 포함)를 progress.md에 쓴다.
- 통과 → M2 진행. 실패(흐림 또는 스크립트 차단) → **run 정지, 차단 보고**. 사용자 선택지: 100% 상한(advisor (d)), 네이티브 자식 webview 장기안 (e) 등. 어떤 대안도 사용자 결정 없이 구현하지 않는다.

### M2 — 조립 모듈 `src/lib/preview/htmlSrcdoc.ts` (Priority High, 순수 함수)

- 내보냄: `HTML_ZOOM_FRAME_SCRIPT`(고정 문자열 상수), `HTML_CRISP_MAX_BYTES = 10 * 1024 * 1024`, `baseHrefFromAssetUrl(assetUrl)`, `buildSrcdoc(html, { baseHref, zoomPercent })`, `FRAME_ZOOM_MESSAGE_TYPE = 'mdedit-html-zoom'`.
- 주입 스크립트 초안(최종 텍스트는 run에서 확정, 확정 후 해시 계산):

```js
(function () {
  var MIN = 0.67, MAX = 2;
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    var d = e.data;
    if (!d || d.type !== 'mdedit-html-zoom') return;
    var z = d.zoom;
    if (typeof z !== 'number' || !isFinite(z) || z < MIN || z > MAX) return;
    document.documentElement.style.zoom = String(z);
  });
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var h = a.getAttribute('href');
    if (!h || h.charAt(0) !== '#') return;
    e.preventDefault();
    var raw = h.slice(1), id;
    try { id = decodeURIComponent(raw); } catch (_) { return; }
    var t = id === '' ? null : (document.getElementById(id) || document.getElementsByName(id)[0]);
    if (t) { t.scrollIntoView(); return; }
    if (id === '' || id === 'top') window.scrollTo(0, 0);
  }, true);
})();
```

- 주입 위치 규칙(REQ-003): 주석 건너뛰기 → 첫 `<head …>` 뒤 → `<html …>` 뒤에 `<head>` 생성 → doctype 뒤 → 맨 앞. 정규식은 주석을 먼저 마스킹(같은 길이 공백)한 사본에서 위치를 찾고 원본 문자열에 삽입한다(오프셋 보존).
- `baseHrefFromAssetUrl`: 입력은 018 정규화가 끝난 주소. 쿼리·해시는 없다고 보고 마지막 `/`까지 자른다. `<base href>` 속성값은 `&`, `"`, `<`를 이스케이프.
- 기각한 대안: 스크립트에 초기 배율을 보간(해시가 배율마다 달라져 CSP 불가) → 초기 배율은 `<style>`로 전달. 각 문자열 보간 대신 고정 상수 + `<style>` 분리.

### M3 — 앱 셸 CSP 해시 + 스타일 asset 출처 (Priority High)

- `index.html` 메타 CSP 두 곳만 변경: `style-src 'self' 'unsafe-inline' asset: http://asset.localhost https://asset.localhost`(사용자 결정 D1=A, review-1 실측: 상속된 `style-src`가 asset 스타일시트를 차단), `script-src 'self' 'wasm-unsafe-eval' 'sha256-<base64>'`. 해시는 `HTML_ZOOM_FRAME_SCRIPT`에서 계산한 값(계산 한 줄 명령을 progress.md에 기록). 개발 서버(vite)와 번들 빌드 모두에서 메타가 변형되지 않는지 확인(번들 산출물의 `index.html` 메타에 토큰이 남는지 `grep`).
- [NEW] `src/test/htmlSrcdocCsp.test.ts` — AC-006.

### M4 — 저장소 `htmlRenderMode` (Priority Medium)

- [MODIFY] `src/store/uiStore.ts` — `htmlRenderMode: 'crisp' | 'original'`(기본 `'crisp'`), `setHtmlRenderMode`, 영속화. `merge`에서 허용 밖 값을 `'crisp'`으로 정규화(018 `htmlZoom` 선례, `version` 범프 불필요 — 필드 추가 + merge 정규화). `@MX:ANCHOR` REASON에 `htmlRenderMode` 한 줄 추가.

### M5 — 뷰어 (Priority High)

- [MODIFY] `src/components/preview/HtmlFileViewer.tsx` — 모드 분기:
  - `original` 또는 폴백 → 기존 렌더(앵커 L59-102) 코드를 `OriginalHtmlView` 안쪽으로 옮기되 속성 줄·스타일 로직 그대로(들여쓰기 변화만).
  - `crisp` → `useEffect`로 `readFileSize` → (상한 검사) → `readFile` → `buildSrcdoc`. 취소 플래그로 늦은 응답 무시. 읽는 동안 `data-testid="html-preview-loading"`.
  - `srcdoc` 문자열은 `[text, baseHref]`에만 의존. 초기 배율은 `useUIStore.getState().htmlZoom`을 조립 시점에 한 번 읽는다(`htmlZoom` 변경이 문자열을 바꾸지 않게; ESLint exhaustive-deps는 주석으로 근거를 남기고 ref 사용).
  - 배율 변경 `useEffect([htmlZoom])`: `iframeRef.current?.contentWindow?.postMessage({ type, zoom: htmlZoom/100 }, '*')`. 프레임 `onLoad`에서도 한 번 보내 로드 직후 배율 불일치를 막는다.
  - 폴백 안내: `role="status"`, 사유별 문구, 모드 저장값 불변.
  - `@MX:WARN` 갱신(두 모드의 sandbox와 근거), `@MX:NOTE`(불투명 출처 조임, 018·004 대비), `@MX:SPEC: SPEC-PREVIEW-019`.
- 로드 오류 처리(기존 `loadError`)는 두 모드에 공통 유지.

### M6 — 헤더 토글 (Priority Medium)

- [MODIFY] `src/components/layout/Header.tsx` — 018 배율 컨트롤 옆(`isHtmlView`일 때) 토글 버튼. 접근성 이름 `Original view`, `aria-pressed`, `title`에 한계 안내(REQ-012). 기존 `.md-stepper`/툴바 스타일 재사용, 새 CSS는 필요할 때만.

### M7 — 테스트·e2e·기록 (Priority Low)

- [NEW] `src/test/htmlSrcdoc.test.ts`(AC-003, 자식 처리기 AC-004/005는 자식 iframe 하네스), [NEW] `src/test/htmlSrcdocCsp.test.ts`(AC-006).
- [MODIFY] `src/test/HtmlFileViewer.test.tsx`(AC-002·004·007·008, 기존 018 시나리오는 `original` 시드), `src/test/uiStore.test.ts`(AC-001), `src/test/Header.test.tsx`(AC-009·010).
- [MODIFY] `e2e/html-file-viewer.spec.ts` — 기존 시나리오 `original` 시드(localStorage `mdedit-ui-store`에 `htmlRenderMode`). [NEW] 선명 모드 e2e(AC-015 부분 증거: 해시 스크립트 실행 + 인라인 페이지 스크립트 차단). 프로젝트의 e2e는 `playwright.config.ts`의 `webkit` 프로젝트 하나뿐이고 CI(`frontend-gates.yml`)도 WebKit만 설치하므로 **설정·CI 변경 없이 그 프로젝트에서 돌린다**(Playwright WebKit = 부분 증거, WKWebView/WebView2 실기기 증거 아님).
- 자식 처리기 하네스: vitest jsdom 환경(기본 `runScripts: 'dangerously'`)의 문서에 자식 iframe을 만들고 그 `contentWindow`에서 스크립트를 실행(`contentWindow.eval` 또는 자식 문서에 `<script>` 삽입)한 뒤 합성 `MessageEvent`를 `dispatchEvent`. 최상위 window에서 실행하지 않는다(`window.parent === window`가 되어 `source` 검사를 시험할 수 없다). 새 `JSDOM` 인스턴스를 만들어 쓰는 방식은 같은 문제를 다시 만들므로 쓰지 않는다.
- progress.md에 수동 M-1~M-6 결과를 OS별로 기록.

## mx_plan

- `@MX:WARN`: `HtmlFileViewer` sandbox 설명(갱신) — 두 모드, `allow-same-origin` 제거의 의도적 조임, `acceptance 보안 시나리오 3` 재검증 지침 유지.
- `@MX:NOTE`: `htmlSrcdoc.ts` 스크립트 상수(해시와 한 몸 — 바꾸면 `index.html` 해시 갱신, AC-006), 주입 위치 규칙, 초기 배율을 `<style>`로 넣는 이유.
- `@MX:ANCHOR`: `useUIStore` 기존 ANCHOR REASON에 `htmlRenderMode` 추가.

## §G Anti-Patterns

- 셸 CSP를 `'unsafe-inline'`·출처 추가로 넓혀 페이지 스크립트를 살리려는 시도 — 금지(사용자 결정 Q1).
- `zoom`과 크기 역보정(018식)을 한 프레임에 함께 적용 — 선명도를 되돌린다.
- 주입 스크립트에 동적 값 보간 — 해시가 깨진다.
- 부모가 프레임 메시지를 신뢰하거나 `message` 리스너를 다는 것.
- jsdom 합성 이벤트 통과만으로 선명도·CSP 상속·IPC 거부를 PASS로 적는 것.

## §H Cross-References

- `spec.md` §3 한계·가정, `acceptance.md` 수동 M-1~M-6.
- `.moai/reports/plan-audit/SPEC-PREVIEW-018-advisor.md` §2(b)·§3·§4, `SPEC-PREVIEW-018-review-3.md` D1.
- SPEC-SEC-001(병행 계획), SPEC-PREVIEW-004/018.
