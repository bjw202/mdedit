# SPEC-PREVIEW-018 plan.md — 구현 계획 (Tier S, v0.2.0)

## §A Context

- HTML 미리보기에 브라우저식 단계 배율을 더한다. 요구는 `spec.md` §2, 수용 기준은 `acceptance.md`.
- 기준: main HEAD 00c0edb(v0.19.0). 앵커는 아래 표가 plan 단계에서 직접 읽은 위치다.

### 검증된 코드 앵커 (HEAD 00c0edb)

| 앵커 | 내용 |
|------|------|
| `src/components/preview/HtmlFileViewer.tsx:1-8` | sandbox `@MX:WARN`(SPEC-PREVIEW-004 REQ-002·005) — 바꾸지 않음 |
| `src/components/preview/HtmlFileViewer.tsx:62-76` | asset URL 정규화 + `<iframe className="w-full h-full border-0" sandbox=... data-testid="html-preview-iframe">` — 감싸개 추가 위치 |
| `src/components/preview/HtmlFileViewer.tsx:72` | `sandbox="allow-scripts allow-same-origin"` 속성 줄. 같은 리터럴은 파일에 3회(L2 `@MX:REASON` 주석, L24 JSDoc, L72 속성) — 2026-11-09 `grep -c` 결과 `3`, 속성 줄 한정 `grep -cE '^[[:space:]]+sandbox="allow-scripts allow-same-origin"$'` 결과 `1` |
| `src/components/layout/Header.tsx:202-210` | `.md-stepper` A-/A+(`setFontSize(fontSize ± 1)`) — HTML 배율 컨트롤 분기 위치 |
| `src/store/uiStore.ts:105-192` | zustand persist, `name: 'mdedit-ui-store'`, `version: 1`, `partialize`(statusMessage·saveStatus 제외), `migrate`(0→1) |
| `src/lib/preview/previewZoom.ts` | `getPreviewZoom(fontSize)` = fontSize/14 — 바꾸지 않음 |
| `src/components/preview/PreviewContainer.tsx:43,104-106` | `getFileViewType` 정의 시작, `'html'` 분기에서 `HtmlFileViewer` |
| `src/components/settings/SettingsModal.tsx:124-125`, `src/components/common/ConfirmDialog.tsx:138-139` | 두 모달 모두 `role="dialog"` + `aria-modal="true"` — 단축키 무시 조건(REQ-004)의 관찰 기준 |
| `src/test/Header.test.tsx`, `src/test/uiStore.test.ts`, `src/test/HtmlFileViewer.test.tsx` | 기존 단위 테스트 — 확장 대상 |
| `src/test/SvgFileViewer.test.tsx`, `src/test/previewZoom.test.ts` | 기존 단위 테스트 — 수정 금지(AC-007 `git diff --quiet`) |
| `e2e/html-file-viewer.spec.ts` | 기존 HTML 뷰어 e2e — 회귀 확인 |

### 단축키·배율 API 조사 (plan 단계 grep)

- 명령: `grep -rnE "keydown|'wheel'|ctrlKey|metaKey" src`(테스트 제외), `grep -rnE "key: '" src`, `grep -rnE '\bsetZoom\b|set_zoom|zoomHotkeysEnabled|zoom_hotkeys_enabled' src src-tauri/src src-tauri/tauri.conf.json`.
- 결과: 문서 단위 `keydown` 리스너는 `SettingsModal.tsx:113`, `ConfirmDialog.tsx:101`, `EditorToolbar.tsx:140,278`(모두 `Escape` 처리)뿐이다. CodeMirror 키맵은 `Mod-s`·`Mod-Shift-s`·`Mod-n`·`Mod-f`·`Mod-Shift-i`·`Mod-Enter`·`Mod-b`·`Mod-i`·`Ctrl-/`다. 앱 코드에 `wheel` 리스너, Cmd/Ctrl+`=`/`-`/`0` 바인딩, Tauri 메뉴 단축키는 없다. 배율 API 정규식은 출력 없음(exit 1, 2026-11-09).
- 남은 확인: CodeMirror 기본 키맵에 `Mod-=`/`Mod--`/`Mod-0`이 없는지는 run 단계에서 설치된 `@codemirror/commands` 버전으로 확인한다(분할 보기에서 편집기 초점이어도 단축키가 HTML 배율로 가야 하기 때문).

## §B Known Issues (위험)

- **iframe 위 휠·핀치 도달 여부 (가장 큰 위험, 미측정)**: iframe이 미리보기 영역을 채우므로 포인터가 미리보기 위에 있는 한 휠·핀치 이벤트는 iframe 문서로 갈 가능성이 있다. 도달 여부는 §F M0 실측 관문으로 판정한다. 이 계획은 결과를 미리 가정하지 않는다.
- **Windows WebView2 기본 배율 (가설, 미검증)**: WebView2는 기본 설정에서 Ctrl+휠·Ctrl+`+`로 웹뷰 전체를 확대할 수 있다. Tauri v2가 이를 기본으로 끄는지 확인하지 않았다. M0 측정과 수동 M-5에서 함께 확인한다.
- **macOS 트랙패드 핀치 이벤트 형태**: WebKit은 핀치를 `ctrlKey`가 켜진 `wheel`로 보내거나 `gesture*` 이벤트로 보낼 수 있다. M0에서 어느 쪽인지 기록한다. `gesture*`만 앱 셸에 오고 `ctrlKey` 휠이 오지 않으면 "도달하지 않음"으로 보고 M0의 정지 규칙을 따른다.
- **IME·자판 배치**: `event.key`가 `=`·`+`·`-`·`0`인지로 판정하고 `isComposing`이면 무시한다. 자판에 따라 Shift 조합인 `+`도, 숫자패드 `+`/`-`도 `key`로 받는다.

## §C Pre-flight (run 시작 점검)

1. `git rev-parse --short HEAD`가 00c0edb 또는 그 후손인지, 작업 위치(워크트리 또는 기능 브랜치)를 확인한다.
2. §A 앵커 행 번호와 sandbox 속성 줄 grep 결과(`1`)를 한 번 확인한다. 어긋나면 SPEC은 고치지 않고 재측정 값을 progress.md에 기록한다.
3. 기준선: `npx vitest run src/test/Header.test.tsx src/test/uiStore.test.ts src/test/HtmlFileViewer.test.tsx` 통과 수, `npx tsc --noEmit`, `npx eslint` 결과를 기록한다.
4. §F M0 실측 관문을 수행한다. M0가 끝나기 전에는 휠·핀치 코드를 쓰지 않는다.

## §D Constraints

- iframe `sandbox` 속성 값·`src` 정규화·`@MX:WARN` 주석 무변경.
- `fontSize`·`getPreviewZoom`·`SvgFileViewer` 무변경. Tauri 웹뷰 zoom API·`zoomHotkeysEnabled` 사용 금지.
- iframe 위 입력 덮개(상시·조건부 모두) 금지 — 사용자 결정이 있기 전까지.
- 코드 주석은 한국어(`code_comments: ko`).

## §E Self-Verification (게이트)

- vitest + tsc + eslint + Playwright(기존 `e2e/html-file-viewer.spec.ts` 회귀).
- 수동 검증 M-1~M-5(acceptance.md)는 macOS·Windows 둘 다 필수이며, 결과를 progress.md §E.2에 OS별로 기록한다. 하나라도 미수행이면 SPEC을 completed로 닫지 않는다.

## §F Milestones (바뀔 가능성이 큰 결정부터)

### M0 — 휠·핀치 실측 관문 (Priority High, 구현 전 필수)

- 방법: 측정용 임시 코드(앱 셸 `window`와 HTML 뷰어 감싸개에 `wheel`·`gesturestart`·`gesturechange` 로그 리스너)를 로컬에서만 붙여 실행하고, 측정 뒤 되돌린다. 측정용 코드는 커밋하지 않는다.
- 측정 항목(두 OS 각각): 포인터가 iframe 위일 때 Cmd/Ctrl+마우스 휠, 트랙패드 핀치(macOS·Windows 정밀 터치패드)가 앱 셸 리스너에 도달하는지, 도달하면 `ctrlKey`/`metaKey`/`deltaY`/`deltaMode` 값, 웹뷰 전체 배율이 바뀌는지.
- 결과 기록: progress.md §E.2 "M0 실측" 표.
- 분기:
  - 두 OS 모두 휠과 핀치가 `ctrlKey`/`metaKey` 휠로 앱 셸에 도달 → M1~M4 진행.
  - 하나라도 도달하지 않음 → 휠·핀치 구현을 시작하지 않고 run을 멈춘 뒤 차단 보고를 돌려준다. 차단 보고에는 측정표와 함께, 오케스트레이터가 사용자에게 제시할 선택지를 적는다: (1) 제한을 받아들이고 휠·핀치를 iframe 밖 앱 셸 영역에서만 지원, (2) 수정키를 누른 동안에만 iframe 위에 덮개를 띄우는 조건부 방식, (3) 휠·핀치 입력을 이 SPEC에서 뺀다. 이 계획은 이 중 어느 것도 채택하지 않는다. 선택 결과는 manager-spec이 SPEC 개정으로 반영한다.
  - 버튼·단축키 부분(M1 상태·M3 헤더·키 리스너)은 휠 결과와 무관하므로, 차단 보고 시 그때까지 끝낸 범위와 남은 범위를 함께 적는다.

### M1 — 배율 적용 기제와 상태 모양 (Priority High)

결정: **iframe 감싸개 + 크기 역보정 + `transform: scale`** (채택)

- 감싸개 `div`(`overflow: hidden`, `position: relative`, `w-full h-full`) 안에 iframe을 두고, 배율 z일 때 iframe에 `width: (100/z)%`, `height: (100/z)%`, `transform: scale(z)`, `transform-origin: 0 0`을 준다.
- 효과: iframe 문서의 CSS 뷰포트 폭이 감싸개 폭 / z가 되어 줄바꿈과 미디어 쿼리가 반응하고, 확대·축소 뒤 크기는 감싸개를 정확히 채우며, iframe 자체 스크롤바가 그대로 동작한다. WebKit과 Chromium에서 같은 CSS 의미로 동작한다.
- z = 1일 때는 변환 없이 기존 클래스와 같은 결과가 되게 한다(회귀 최소화).

기각한 대안:

| 대안 | 기각 이유 |
|------|-----------|
| iframe 요소에 CSS `zoom` | iframe 내용에 대한 `zoom`의 효과(뷰포트 폭 재계산 여부, 좌표 처리)가 엔진마다 달라 macOS WebKit과 Windows Chromium의 결과가 갈릴 수 있다 |
| iframe 문서에 CSS 주입(`html { zoom }` 등) | iframe은 `asset://`, 앱 셸은 `tauri://`라 cross-origin이어서 `contentDocument` 접근이 막힌다. 샌드박스 권한 변경도 금지 |
| Tauri 웹뷰 전체 zoom / `zoomHotkeysEnabled` | 헤더·탐색기·편집기까지 앱 UI 전체가 커진다(REQ-007 위반) |

- [NEW] `src/lib/preview/htmlZoom.ts` — 단계 목록 상수, `stepUp(z)`·`stepDown(z)`·`snapToStep(v)`(`typeof v !== 'number'` 또는 비유한 수는 100, 같은 거리면 작은 쪽), 기본값 100, 휠 상수 `WHEEL_GESTURE_IDLE_MS = 150`·`WHEEL_STEP_THRESHOLD_PX = 50`·`WHEEL_LINE_PX = 16`. 순수 함수와 상수만. 상수 값은 spec.md REQ-005의 값이며, 바꾸려면 SPEC 개정이 필요하다.
- [MODIFY] `src/store/uiStore.ts` — `htmlZoom: number`(기본 100)와 `setHtmlZoom(v)`(내부에서 `snapToStep`), 필요하면 `stepHtmlZoom(dir)`·`resetHtmlZoom()`. 영속화 대상(partialize 제외 목록에 넣지 않음).
  - **persist 버전 결정**: zustand persist는 저장된 상태를 초기 상태 위에 얕게 합치므로 필드가 없으면 초기값 100이 남는다. 그래서 필드 추가만으로는 `version` 올림이 필요 없다. 단계 밖 값·비숫자 정규화는 `merge` 옵션 또는 재수화 직후 `snapToStep` 적용으로 처리하고, 둘 중 run 단계가 기존 `migrate`와 충돌이 적은 쪽을 고른다. `version`을 올리기로 하면 기존 0→1 분기를 보존하고 1→2 분기에서 `htmlZoom`만 정규화한다. 관찰 가능한 결과는 AC-006이 고정하며, 선택과 이유를 progress.md에 기록한다.
- [MODIFY] `src/components/preview/HtmlFileViewer.tsx` — 감싸개 + 배율 스타일. sandbox 속성 줄·src·`onError`·`data-testid` 유지. 감싸개에 `data-testid="html-preview-zoom-wrapper"`.

### M2 — 입력: 단축키·휠 (Priority High, 휠은 M0 통과 시에만)

- **OS 판정**: `navigator.userAgentData?.platform` 값이 있으면 그것을, 없으면 `navigator.platform`을 쓰고, 값에 `Mac`이 들어 있으면 macOS로 본다. macOS는 `metaKey`만, 그 밖은 `ctrlKey`만 수정키로 받는다(macOS `ctrlKey`+`=`는 배율을 바꾸지 않는다). 판정 함수는 `htmlZoom.ts`에 두어 테스트가 `navigator` 값을 모의해 두 OS 조건을 만들 수 있게 한다. 휠의 경우 핀치가 `ctrlKey`로 오므로 macOS에서도 `ctrlKey` 휠은 받는다(REQ-005).
- [MODIFY 또는 NEW] 앱 셸 문서 단위 `keydown` 리스너 1개(헤더 또는 `PreviewContainer`의 `html` 분기 근처, run 선택). 수정키 + `key ∈ {'=', '+', '-', '0'}` + 보기 종류 `html` + `!isComposing` + 열린 모달(`[role="dialog"][aria-modal="true"]`) 없음일 때만 처리하고 `preventDefault()`.
- [MODIFY] 감싸개(`HtmlFileViewer`)와, M0에서 이벤트가 도달한 것으로 확인된 대상에 `wheel` 리스너를 `{ passive: false }`로 등록. 수정키 휠일 때만 `preventDefault()` 후 REQ-005의 제스처 규칙(150ms 무입력 경계, 누적 50px, 제스처당 한 단계)으로 처리. React `onWheel`은 passive라 `preventDefault`가 안 되므로 `addEventListener`를 쓴다.

### M3 — 헤더 컨트롤 (Priority Medium)

- [MODIFY] `src/components/layout/Header.tsx:202-210` — 보기 종류가 `html`이면 `.md-stepper` 자리에 `[− N% +]` 표시. 버튼 접근성 이름은 "Zoom out"·"Zoom in", 퍼센트 표시는 `button`이며 이름은 "Reset zoom to 100%"(REQ-001 확정값). 최댓값에서 "Zoom in", 최솟값에서 "Zoom out"을 `disabled`(REQ-002). 기존 `.md-stepper` 스타일을 재사용하고 새 CSS는 필요할 때만.
  - Header가 보기 종류를 알려면 `fileStore`의 `currentFile`·`previewStatus`와 `getFileViewType`을 쓴다(기존 함수 재사용).

### M4 — 테스트·기록 (Priority Low)

- [NEW] `src/test/htmlZoom.test.ts` — 단계·경계·스냅·OS 판정·제스처 논리(AC-002, AC-004 일부, AC-005 단위 부분).
- [MODIFY] `src/test/uiStore.test.ts` — 기본값, 재수화 정규화(AC-006), `fontSize` 비간섭(AC-007).
- [MODIFY] `src/test/Header.test.tsx` — `html`/비`html` 렌더 분기, 버튼·리셋·비활성(AC-001·002).
- [MODIFY] `src/test/HtmlFileViewer.test.tsx` — 감싸개 스타일, 렌더된 iframe의 `sandbox` 속성 값 단언(AC-003), 휠 핸들러(AC-005 단위 부분).
- 단축키 단위 테스트(AC-004)는 리스너를 둔 곳의 테스트에 둔다.
- progress.md §E.2에 M0 실측표와 수동 검증 M-1~M-5 결과를 OS별로 기록.

## mx_plan

- `@MX:NOTE`: `HtmlFileViewer` 배율 스타일 위(크기 역보정 + scale을 쓰는 이유, CSS `zoom`·주입을 쓰지 않는 이유). `htmlZoom.ts` 단계 목록·휠 상수(spec 값, 바꾸려면 SPEC 개정).
- `@MX:WARN`: 기존 sandbox WARN 유지. `wheel` 리스너의 `passive: false` 이유를 NOTE로 남긴다(신규 WARN 불필요).
- `@MX:ANCHOR`: `useUIStore` 기존 ANCHOR의 REASON에 `htmlZoom` 추가 한 줄(fan_in 변화 반영).

## §G Anti-Patterns

- iframe `sandbox`를 넓히거나 iframe 문서에 무언가를 주입하지 않는다.
- iframe 위에 입력 덮개(상시·조건부)를 사용자 결정 없이 두지 않는다.
- 웹뷰 전체 zoom API로 해결하지 않는다.
- M0 실측 전에 휠·핀치 코드를 쓰지 않는다. 측정 결과가 "도달하지 않음"인데 제한으로 처리하고 진행하지 않는다.
- 휠 이벤트마다 한 단계씩 움직여 트랙패드에서 단계가 폭주하게 두지 않는다.
- jsdom 합성 이벤트 통과만으로 휠·핀치·초점 경계 동작을 PASS로 적지 않는다.

## §H Cross-References

- `spec.md` §3 실측 관문, `acceptance.md` 수동 검증 M-1~M-5.
- `SPEC-PREVIEW-004` acceptance.md "보안 시나리오 3"(샌드박스), `SPEC-PREVIEW-008`(SVG 자체 배율, 무변경).
- plan-audit 1차: `.moai/reports/plan-audit/SPEC-PREVIEW-018-review-1.md`.
