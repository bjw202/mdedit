# SPEC-PREVIEW-018 plan.md — 구현 계획 (Tier S, v0.3.0)

## §A Context

- HTML 미리보기에 브라우저식 단계 배율을 더한다. 요구는 `spec.md` §2, 수용 기준은 `acceptance.md`.
- 기준: main HEAD 00c0edb(v0.19.0). 앵커는 아래 표가 plan 단계에서 직접 읽은 위치다.
- v0.3.0(2026-11-09): 사용자 결정으로 휠·핀치 입력을 범위에서 뺐다(spec.md HISTORY 0.3.0, §5). 이 계획은 버튼·키보드 단축키·전역 영속화만 다룬다.

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

- 명령(plan 단계에 실행한 그대로 기록): `grep -rnE "keydown|'wheel'|ctrlKey|metaKey" src`(테스트 제외), `grep -rnE "key: '" src`, `grep -rnE '\bsetZoom\b|set_zoom|zoomHotkeysEnabled|zoom_hotkeys_enabled' src src-tauri/src src-tauri/tauri.conf.json`.
- 결과: 문서 단위 `keydown` 리스너는 `SettingsModal.tsx:113`, `ConfirmDialog.tsx:101`, `EditorToolbar.tsx:140,278`(모두 `Escape` 처리)뿐이다. CodeMirror 키맵은 `Mod-s`·`Mod-Shift-s`·`Mod-n`·`Mod-f`·`Mod-Shift-i`·`Mod-Enter`·`Mod-b`·`Mod-i`·`Ctrl-/`다. 앱 코드에 `wheel` 리스너, Cmd/Ctrl+`=`/`-`/`0` 바인딩, Tauri 메뉴 단축키는 없다. 배율 API 정규식은 출력 없음(exit 1, 2026-11-09).
- 남은 확인: CodeMirror 기본 키맵에 `Mod-=`/`Mod--`/`Mod-0`이 없는지는 run 단계에서 설치된 `@codemirror/commands` 버전으로 확인한다(분할 보기에서 편집기 초점이어도 단축키가 HTML 배율로 가야 하기 때문).

## §B Known Issues (위험)

- **Windows WebView2 기본 배율 (가설, 미검증)**: WebView2는 기본 설정에서 Ctrl+`+`/`-`/`0`으로 웹뷰 전체를 확대·축소할 수 있다. Tauri v2가 이를 기본으로 끄는지 확인하지 않았다. 앱 셸 초점일 때는 REQ-004의 `preventDefault()`가 막지만, 초점이 iframe 안에 있으면 앱 셸이 키 이벤트를 받지 못하므로 막을 수 없다. Windows에서 Ctrl+`=`(그리고 Ctrl+`-`/`0`)가 웹뷰 전체를 확대하는지는 수동 M-5에서 확인하며, 바뀌면 REQ-007 결함으로 기록한다.
- **IME·자판 배치**: `event.key`가 `=`·`+`·`-`·`0`인지로 판정하고 `isComposing`이면 무시한다. 자판에 따라 Shift 조합인 `+`도, 숫자패드 `+`/`-`도 `key`로 받는다.

## §C Pre-flight (run 시작 점검)

1. `git rev-parse --short HEAD`가 00c0edb 또는 그 후손인지, 작업 위치(워크트리 또는 기능 브랜치)를 확인한다.
2. §A 앵커 행 번호와 sandbox 속성 줄 grep 결과(`1`)를 한 번 확인한다. 어긋나면 SPEC은 고치지 않고 재측정 값을 progress.md에 기록한다.
3. 기준선: `npx vitest run src/test/Header.test.tsx src/test/uiStore.test.ts src/test/HtmlFileViewer.test.tsx` 통과 수, `npx tsc --noEmit`, `npx eslint` 결과를 기록한다.

## §D Constraints

- iframe `sandbox` 속성 값·`src` 정규화·`@MX:WARN` 주석 무변경.
- `fontSize`·`getPreviewZoom`·`SvgFileViewer` 무변경. Tauri 웹뷰 zoom API·`zoomHotkeysEnabled` 사용 금지.
- 코드 주석은 한국어(`code_comments: ko`).

## §E Self-Verification (게이트)

- vitest + tsc + eslint + Playwright(기존 `e2e/html-file-viewer.spec.ts` 회귀).
- 수동 검증 M-1·M-2·M-4·M-5(acceptance.md)는 macOS·Windows 두 OS 모두 필요하며, 결과를 progress.md에 OS별로 기록한다. 이 수동 항목은 run 단계 완료 판정을 막지 않으며, 사용자가 sync/PR 단계에서 확인한다. 다만 기록되기 전에는 SPEC을 `completed`로 닫지 않는다.

## §F Milestones (바뀔 가능성이 큰 결정부터)

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

- [NEW] `src/lib/preview/htmlZoom.ts` — 단계 목록 상수, `stepUp(z)`·`stepDown(z)`·`snapToStep(v)`(`typeof v !== 'number'` 또는 비유한 수는 100, 같은 거리면 작은 쪽), 기본값 100. 순수 함수와 상수만. 단계 값은 spec.md REQ-002의 값이며, 바꾸려면 SPEC 개정이 필요하다.
- [MODIFY] `src/store/uiStore.ts` — `htmlZoom: number`(기본 100)와 `setHtmlZoom(v)`(내부에서 `snapToStep`), 필요하면 `stepHtmlZoom(dir)`·`resetHtmlZoom()`. 영속화 대상(partialize 제외 목록에 넣지 않음).
  - **persist 버전 결정**: zustand persist는 저장된 상태를 초기 상태 위에 얕게 합치므로 필드가 없으면 초기값 100이 남는다. 그래서 필드 추가만으로는 `version` 올림이 필요 없다. 단계 밖 값·비숫자 정규화는 `merge` 옵션 또는 재수화 직후 `snapToStep` 적용으로 처리하고, 둘 중 run 단계가 기존 `migrate`와 충돌이 적은 쪽을 고른다. `version`을 올리기로 하면 기존 0→1 분기를 보존하고 1→2 분기에서 `htmlZoom`만 정규화한다. 관찰 가능한 결과는 AC-006이 고정하며, 선택과 이유를 progress.md에 기록한다.
- [MODIFY] `src/components/preview/HtmlFileViewer.tsx` — 감싸개 + 배율 스타일. sandbox 속성 줄·src·`onError`·`data-testid` 유지. 감싸개에 `data-testid="html-preview-zoom-wrapper"`.
- 구현 중 확정: `getFileViewType`을 `src/lib/preview/fileViewType.ts`로 분리하고(동작 무변경) `PreviewContainer.tsx`에서 재공개한다. 헤더가 보기 종류를 판정할 때 `PreviewContainer`를 import하면 뷰어 전체가 헤더 테스트에 딸려 들어오기 때문이다. 기존 import 경로는 그대로 동작한다(progress.md §E.2 설계 결정).

### M2 — 입력: 키보드 단축키 (Priority High)

- **OS 판정**: `navigator.userAgentData?.platform` 값이 있으면 그것을, 없으면 `navigator.platform`을 쓰고, 값에 `Mac`이 들어 있으면 macOS로 본다. macOS는 `metaKey`만, 그 밖은 `ctrlKey`만 수정키로 받는다(macOS `ctrlKey`+`=`는 배율을 바꾸지 않는다). 판정 함수는 `htmlZoom.ts`에 두어 테스트가 `navigator` 값을 모의해 두 OS 조건을 만들 수 있게 한다.
- [MODIFY] 앱 셸 문서 단위 `keydown` 리스너 1개. 수정키 + `key ∈ {'=', '+', '-', '0'}` + 보기 종류 `html` + `!isComposing` + 열린 모달(`[role="dialog"][aria-modal="true"]`) 없음일 때만 처리하고 `preventDefault()`.
  - 구현 중 확정: 리스너는 `Header.tsx`의 `useEffect`에 두고 `html` 보기일 때만 등록한다. 헤더가 이미 보기 종류와 `htmlZoom`을 읽고, 버튼과 단축키가 같은 액션(`stepHtmlZoom`/`resetHtmlZoom`)을 쓰기 때문이다(progress.md §E.2 설계 결정).

### M3 — 헤더 컨트롤 (Priority Medium)

- [MODIFY] `src/components/layout/Header.tsx:202-210` — 보기 종류가 `html`이면 `.md-stepper` 자리에 `[− N% +]` 표시. 버튼 접근성 이름은 "Zoom out"·"Zoom in", 퍼센트 표시는 `button`이며 이름은 "Reset zoom to 100%"(REQ-001 확정값). 최댓값에서 "Zoom in", 최솟값에서 "Zoom out"을 `disabled`(REQ-002). 기존 `.md-stepper` 스타일을 재사용하고 새 CSS는 필요할 때만.
  - Header가 보기 종류를 알려면 `fileStore`의 `currentFile`·`previewStatus`와 `getFileViewType`을 쓴다(기존 함수 재사용, 구현 중 확정된 import 위치는 `src/lib/preview/fileViewType.ts`).

### M4 — 테스트·기록 (Priority Low)

- [NEW] `src/test/htmlZoom.test.ts` — 단계·경계·스냅·OS 판정(AC-002, AC-004 일부).
- [MODIFY] `src/test/uiStore.test.ts` — 기본값, 재수화 정규화(AC-006), `fontSize` 비간섭(AC-007).
- [MODIFY] `src/test/Header.test.tsx` — `html`/비`html` 렌더 분기, 버튼·리셋·비활성(AC-001·002).
- [MODIFY] `src/test/HtmlFileViewer.test.tsx` — 감싸개 스타일, 렌더된 iframe의 `sandbox` 속성 값 단언(AC-003).
- 단축키 단위 테스트(AC-004)는 리스너를 둔 곳의 테스트(`Header.test.tsx`)에 둔다.
- progress.md에 수동 검증 M-1·M-2·M-4·M-5 결과를 OS별로 기록(사용자 확인, sync/PR 단계).

## mx_plan

- `@MX:NOTE`: `HtmlFileViewer` 배율 스타일 위(크기 역보정 + scale을 쓰는 이유, CSS `zoom`·주입을 쓰지 않는 이유). `htmlZoom.ts` 단계 목록(spec 값, 바꾸려면 SPEC 개정).
- `@MX:WARN`: 기존 sandbox WARN 유지(신규 WARN 불필요).
- `@MX:ANCHOR`: `useUIStore` 기존 ANCHOR의 REASON에 `htmlZoom` 추가 한 줄(fan_in 변화 반영).

## §G Anti-Patterns

- iframe `sandbox`를 넓히거나 iframe 문서에 무언가를 주입하지 않는다.
- 웹뷰 전체 zoom API로 해결하지 않는다.
- jsdom 합성 이벤트 통과만으로 iframe 초점 경계·웹뷰 기본 배율 동작을 PASS로 적지 않는다.

## §H Cross-References

- `spec.md` §3 "iframe 안 키보드 초점", `acceptance.md` 수동 검증 M-1·M-2·M-4·M-5.
- `SPEC-PREVIEW-004` acceptance.md "보안 시나리오 3"(샌드박스), `SPEC-PREVIEW-008`(SVG 자체 배율, 무변경).
- plan-audit 1차: `.moai/reports/plan-audit/SPEC-PREVIEW-018-review-1.md`, 2차: `.moai/reports/plan-audit/SPEC-PREVIEW-018-review-2.md`.
