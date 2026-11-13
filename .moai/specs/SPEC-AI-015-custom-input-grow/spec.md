---
id: SPEC-AI-015
title: "AI 직접 입력 칸 — 폭 확대·자동 높이 증가 textarea"
version: "1.0.1"
status: completed
created: 2026-11-13
updated: 2026-11-13
author: jw
priority: Medium
phase: "v0.22.0"
module: "src/components/editor/extensions"
lifecycle: spec-anchored
tags: "ai, editor, toolbar, input, ime, placement"
tier: M
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-11-13 | jw | 최초 작성 — 백로그 카드 t7. AI 선택 툴바(✨) 프리셋 메뉴의 "직접 입력" 칸을 한 줄 `<input>`에서 자동으로 높이가 늘어나는 `<textarea>`로 바꾸고, 직접 입력 상태에서만 메뉴 폭을 넓힌다. 사용자 결정(2026-11-13): Enter 전송·Shift+Enter 줄바꿈, 입력에 맞춰 계속 늘어나다 화면 가용 공간을 넘으면 그때 멈추고 스크롤. 나머지 세부 결정은 사용자가 자율 진행을 위임해 plan 단계에서 기본값으로 정하고 §Decisions 에 기록했다. Tier M(요구 14개가 Tier S 상한 8을 넘고, 테스트·e2e 포함 예상 변경량이 300 LOC 를 넘음). 관련 SPEC-AI-008·SPEC-AI-011 은 동작 보존 대상이며 `depends_on`으로 걸지 않는다(둘 다 이미 병합된 기능이고, 저장소 관례상 `status: draft`로 남아 있어 run 사전 점검을 막기 때문). |
| 1.0.0 (개정 1) | 2026-11-13 | jw | plan-auditor 1차(FAIL 0.81) 반영 — D1 폭을 앵커 기준 넓은 쪽 공간으로(감사 D3), D4 세로 판정도 실효 경계 기준(D2), D5 실행 시점 상태 getter(D4), D9·REQ-008 높이에 테두리 포함(D1), `null` 상한 처리 명시(D5), REQ-012~014 GEARS 형식·분류 정리(D6·D7), Out of Scope 소제목(D9), 검증 계층 표 정정(D8), R6 추가. |
| 1.0.0 (개정 2) | 2026-11-13 | jw | plan-auditor 2차(PASS 0.92) 잔여 지적 반영 — 좁은 패널 e2e 를 420px 로(S1), 단위 rect 목이 적용 폭을 돌려주도록 명시(N1), REQ-014 무조건 형식(N2), HISTORY 개정 표기(N3). 재감사 불필요 판정. |
| 1.0.1 | 2026-11-13 | jw | 완료 처리 — 사용자가 실제 앱에서 수동 확인 항목을 확인함("잘 된다"). status implemented → completed. |

## Summary

AI 선택 툴바의 "직접 입력..."을 고르면 프리셋 목록이 한 줄짜리 입력 칸(`<input type="text">`, 높이 28px, 메뉴 최소 폭 190px)으로 바뀐다. 지시문이 조금만 길어도 앞부분이 가려져 자기가 쓴 내용을 다시 읽을 수 없고, 줄을 나눌 방법도 없다. 또한 한글 입력 중 조합 확정용 Enter 가 전송으로 처리될 수 있다.

본 SPEC 은 직접 입력 상태에 한해 다음을 바꾼다.

1. 입력 칸을 `<textarea>`로 교체하고 입력에 맞춰 높이를 늘린다. 가용 공간의 상한에 닿으면 더 늘리지 않고 칸 안에 세로 스크롤을 띄운다.
2. 직접 입력 상태에서만 메뉴 폭을 340px 로 넓힌다(✨ 기준 좌·우 중 넓은 쪽 공간이 그보다 좁으면 그 공간에 맞춰 줄인다).
3. Enter 는 전송, Shift+Enter 는 줄바꿈. 한글 등 IME 조합 중의 Enter/Escape 는 무시한다.
4. 프리셋 목록 ↔ 직접 입력 전환 때마다 메뉴 위치(위/아래, 좌/우 정렬)를 다시 계산한다.
5. 제안 카드의 "방향 지시" 칸(`.mdedit-ai-direct-input`)은 지금 모습을 그대로 유지한다 — 공유 CSS 규칙을 분리한다.

## Background (소스 검증 완료 — origin/main `5c617ae` 기준)

| 위치 | 현재 상태 |
|------|-----------|
| `src/components/editor/extensions/ai-selection-toolbar.ts:639-666` `renderCustomInput()` | `<input type="text" class="mdedit-ai-custom-input">` 생성. `keydown` 에서 `event.key === 'Enter'` 이면 trim 후 비어 있지 않을 때 `callbacks.onSubmitCustom(value)`. IME 처리 없음. |
| 같은 파일 `:668-672` `setMode()` | `renderPresets()` / `renderCustomInput()`로 자식만 교체한다. 위치 재계산 없음. |
| 같은 파일 `:674-690` `handleKeyDown()` | 메뉴 루트 `dom`의 keydown. Escape 처리 순서: (1) 다이어그램 서브메뉴 열림 → 서브메뉴만 닫음(SPEC-AI-011), (2) 직접 입력 상태 → 프리셋 목록 복귀, (3) 그 외 → `onClose()`. IME 처리 없음. |
| 같은 파일 `:451-472` `scheduleMenuFlipMeasurement()` | 다음 rAF 에서 세로 flip(`decideMenuFlipDirection`, 뷰포트 기준)과 가로 flip(`decideMenuHorizontalDirection`, 클리핑 조상 기준)을 한 번 판정. 호출은 `:696` 메뉴 생성 시 1회뿐이다. |
| 같은 파일 `:382-389` `decideMenuFlipDirection()` | 순수 함수. `spaceBelow >= menuHeight` 이면 아래, 아니면 위쪽 공간이 더 클 때만 위. |
| `src/styles/mdedit-components.css:388-394` | `.mdedit-ai-preset-menu` — `min-width: 190px`, 내용에 맞춰 줄어드는 폭. |
| 같은 파일 `:424` | `.mdedit-ai-custom-row, .mdedit-ai-direct-row` 공유 — `align-items: center`. |
| 같은 파일 `:431-441` | `.mdedit-ai-custom-input, .mdedit-ai-direct-input` 공유(기본·placeholder·focus-visible 3개 규칙) — `height: 28px` 고정 등. `.mdedit-ai-direct-input`은 `ai-suggestion-card.ts:297-301`의 제안 카드 "방향 지시" 칸이다. |
| `src/components/layout/ResizablePanels.tsx:25` | `MIN_PANE_PX = 240` — 에디터 패널은 340px 보다 좁아질 수 있다. |
| `src/lib/preview/htmlZoom.ts:77` | 저장소 내 유일한 IME 가드 선례(`e.isComposing`). |

WebKit(사용자 macOS WKWebView)은 `compositionend`를 조합 확정 keydown 보다 먼저 발화할 수 있어, 확정용 Enter 의 keydown 에서 `isComposing === false` 인 경우가 있다. 이때 `keyCode === 229`가 조합 중 keydown 을 식별하는 보조 신호다. 그래서 가드는 `event.isComposing || event.keyCode === 229` 두 조건을 함께 쓴다.

## Environment & Assumptions

- 대상 런타임: Tauri v2 WKWebView(macOS), WebView2(Windows). 테스트: vitest+jsdom(레이아웃 없음), Playwright `webkit` 프로젝트(`playwright.config.ts`).
- `field-sizing: content`의 사용자 WKWebView 지원은 확인되지 않았다 → 높이 증가는 JS `scrollHeight` 측정으로 구현한다(D2).
- `callbacks.onSubmitCustom(instruction)`의 하류(요청 조립)는 지시문에 줄바꿈이 섞여도 문자열로 그대로 전달한다고 가정한다. 하류 코드는 본 SPEC 에서 바꾸지 않는다.
- 위젯은 `ignoreEvent() === true`(`ai-selection-toolbar.ts:838-841`)라 textarea 의 키 입력은 CodeMirror 로 넘어가지 않는다 — 기존 `<input>`과 같은 조건이다.

## Decisions (사용자 위임에 따라 plan 단계에서 정함)

| ID | 결정 | 이유 |
|----|------|------|
| D1 | 직접 입력 상태 메뉴 폭 = `clamp(190, max(spaceRight, spaceLeft) − 8, 340)` px. `spaceRight`·`spaceLeft`는 기존 가로 flip 이 쓰는 값 그대로(클리핑 경계 오른쪽 − 앵커 left, 앵커 right − 클리핑 경계 왼쪽; 경계가 없으면 뷰포트). 340 이면 CSS 클래스만으로, 340 미만이면 인라인 `width`로 준다. 이렇게 하면 넓은 쪽 공간에 메뉴가 들어가므로 기존 가로 flip(`decideMenuHorizontalDirection`)이 그쪽을 고르고, 별도 가로 clamp 없이 패널 안에 머문다. | 카드의 "약 340~360px" 하한. 패널 최소 폭이 240px 이고 ✨ 는 보통 줄 중간에 있어, 패널 폭이 아니라 앵커 기준 넓은 쪽 공간으로 폭을 정해야 잘리지 않는다(감사 D3). |
| D2 | 높이 증가는 JS(`style.height = 'auto'` → `scrollHeight` 측정 → 상한과 비교)로 한다. `field-sizing`은 쓰지 않는다. | WKWebView 지원 미확인. JS 방식은 jsdom 에서 `scrollHeight` 목으로 단위 검증이 가능하다. |
| D3 | 높이 상한 = 선택된 방향(위/아래)으로 앵커에서 **실효 세로 경계**까지의 거리 − 메뉴 외곽 높이(측정 시점의 메뉴 높이 − textarea 높이) − 여백 8px. 실효 세로 경계는 뷰포트(`0`~`window.innerHeight`)와 클리핑 조상 rect 의 교집합이다. 상한은 1줄 높이(28px) 아래로 내려가지 않는다. | 사용자 결정 "화면을 넘으면 스크롤" + 리뷰 지적 "고정 줄 수가 아니라 가용 공간". 메뉴가 에디터 패널 아래로 잘리는 경우도 막는다. |
| D4 | 직접 입력 상태의 세로 방향은 모드 진입 시 **한 번만** 판정하고, 타이핑 중에는 다시 판정하지 않는다. 판정은 기존 순수 함수 `decideMenuFlipDirection`을 재사용하되 (a) `menuHeight`에 `max(실측 메뉴 높이, CUSTOM_INPUT_PREFERRED_HEIGHT = 200)`을 넣고, (b) `spaceBelow`·`spaceAbove`를 D3 과 같은 **실효 세로 경계** 기준으로 계산한다. 프리셋 목록 상태의 세로 판정은 지금처럼 뷰포트 기준으로 둔다(REQ-003 범위 보존). | 타이핑 중 위/아래가 뒤집히는 깜빡임 방지. 아래 공간이 200px 미만이고 위가 더 넓으면 처음부터 위로 열어 자랄 공간을 확보한다. 방향과 상한이 같은 경계를 써야 "위가 넓다고 골랐는데 상한은 패널 경계로 잘리는" 불일치가 없다(감사 D2). 새 판정 함수를 만들지 않는다. |
| D5 | 모드 전환(`setMode`) 때마다 `scheduleMenuFlipMeasurement`를 다시 호출한다(세로·가로 모두). rAF 콜백은 고정 옵션이 아니라 **실행 시점의 상태**를 읽는다: 호출자가 넘긴 getter `getCustomInput()`이 "현재 모드가 직접 입력이고 textarea 가 문서에 붙어 있으면 그 textarea, 아니면 `null`"을 돌려주고, 콜백은 그 결과로 분기한다. 직접 입력 분기에서는 D1 폭을 먼저 적용한 뒤 메뉴 rect 를 다시 읽어 세로(D4)·가로 flip 과 D3 상한을 계산한다. 콜백 시작에 `dom.isConnected`가 false 면 아무것도 하지 않는다. | 카드 "모드 전환 시 메뉴 위치 재계산". 폭이 바뀌면 가로 flip 결과도 바뀐다. 빠른 왕복 전환에서 앞선 콜백이 다른 모드 기준으로 계산하지 않게 한다(감사 D4). |
| D6 | IME 가드는 두 곳: textarea keydown 처리 맨 앞, 메뉴 루트 `handleKeyDown` 맨 앞. 조건은 `event.isComposing \|\| event.keyCode === 229`. 가드에 걸리면 아무것도 하지 않고 기본 동작도 막지 않는다. | Escape 는 메뉴 루트에서 처리되므로 루트에도 가드가 필요하다. 프리셋 상태에는 조합 입력이 없어 루트 가드는 기존 동작에 영향이 없다. |
| D7 | Enter(Shift 없음, 조합 아님) → `preventDefault()`. trim 결과가 비어 있지 않으면 `onSubmitCustom(trim 결과)`, 비어 있으면 아무것도 하지 않음(줄바꿈도 넣지 않음). Shift+Enter 는 기본 동작(줄바꿈)에 맡긴다. trim 은 앞뒤 공백·줄바꿈만 없애고 내부 줄바꿈은 보존한다. | 사용자 결정. 기존 trim·빈 값 무시 동작 유지. |
| D8 | textarea 는 기존 클래스 `mdedit-ai-custom-input`을 그대로 쓰고 `rows=1`, `resize: none`. CSS 는 공유 선택자에서 `.mdedit-ai-custom-input`·`.mdedit-ai-custom-row`를 떼어 직접 입력 전용 규칙으로 분리한다. `.mdedit-ai-direct-input`·`.mdedit-ai-direct-row`에 적용되는 선언은 바꾸지 않는다. 메뉴 폭은 직접 입력 상태에만 붙는 수식 클래스 `mdedit-ai-preset-menu--custom`(기본 340px)과, D1 축소가 필요할 때만 쓰는 인라인 `width`로 준다. | 카드 "제안 카드 '방향 지시' 칸과 스타일 분리". 기존 테스트 선택자 재사용으로 변경 최소화. |
| D9 | 높이는 테두리 상자 기준으로 계산한다: 필요한 외곽 높이 = `scrollHeight + (offsetHeight − clientHeight)`(`scrollHeight`에는 위아래 테두리가 빠져 있고, 저장소 전역 `box-sizing: border-box`에서는 `style.height`가 테두리를 포함하므로). 이 값이 상한을 넘으면 높이를 상한에 고정하고 `overflow-y: auto`, 아니면 `overflow-y: hidden`. 직접 입력 행은 `align-items: flex-start`(← 버튼이 첫 줄 옆에 붙음). | 사용자 결정 "멈추고 스크롤". |
| D10 | 창 크기 변경·에디터 스크롤 중 상한/방향 재계산은 하지 않는다. | 카드 범위는 "열 때/모드 전환 시". 추측성 기능 배제. |

## Requirements (EARS)

### Ubiquitous

- **REQ-AI-015-001**: 직접 입력 상태의 입력 칸은 `<textarea>` 요소이며 클래스 `mdedit-ai-custom-input`, `rows` 속성 1, placeholder `CUSTOM_PLACEHOLDER`(`예: 영어로 번역해줘`)를 갖고, 생성 직후 포커스를 받는다.
- **REQ-AI-015-002**: 제안 카드의 방향 지시 칸(`.mdedit-ai-direct-input`)과 그 행(`.mdedit-ai-direct-row`)에 적용되는 CSS 선언은 본 SPEC 이전과 같다.
- **REQ-AI-015-003**: 프리셋 목록 상태의 메뉴 폭 규칙(`min-width: 190px`, 내용 맞춤)과 세로 flip 경계(뷰포트)는 바뀌지 않는다.
- **REQ-AI-015-014**: 프리셋 메뉴는 직접 입력 칸의 높이 상한을 항상 28px 이상으로 잡아야 한다(D3 계산 결과가 더 작아도 칸이 사라지지 않음).

### Event-Driven

- **REQ-AI-015-004**: WHEN 메뉴가 직접 입력 상태로 전환되면, THEN 메뉴는 즉시 `mdedit-ai-preset-menu--custom` 클래스를 가지며, 다음 rAF 에서 D1 폭이 340 미만일 때만 인라인 `width`를 그 값으로 지정한다.
- **REQ-AI-015-005**: WHEN 메뉴가 프리셋 목록 상태로 돌아가면, THEN `mdedit-ai-preset-menu--custom` 클래스와 직접 입력 상태에서 붙인 인라인 `width`가 즉시 제거된다.
- **REQ-AI-015-006**: WHEN 모드가 전환되면(어느 방향이든), THEN 다음 rAF 에서 세로·가로 flip 판정이 다시 수행되어 `--above`/`--end` 클래스가 새 크기 기준으로 갱신된다.
- **REQ-AI-015-007**: WHEN 직접 입력 상태로 전환된 뒤의 rAF 측정이 수행되면, THEN 세로 방향은 `decideMenuFlipDirection`에 실효 세로 경계 기준 공간과 `menuHeight = max(실측 메뉴 높이, 200)`을 넣어 판정하고(D4), textarea 의 높이 상한은 D3 식으로 계산되어 보관된다. 측정 콜백이 실행될 때 직접 입력 상태가 아니거나 textarea 가 문서에 없으면 직접 입력 분기(폭·상한)는 수행되지 않는다(D5).
- **REQ-AI-015-008**: WHEN textarea 의 내용이 바뀌면(`input` 이벤트), THEN 필요 높이 `need = scrollHeight + (offsetHeight − clientHeight)`에 대해 높이는 `max(28, min(need, 상한))` px 로 설정되고, `need > 상한`이면 `overflow-y: auto`, 아니면 `overflow-y: hidden`이 된다. 상한이 아직 계산되지 않았으면(`null`) 상한 없이 `need`를 따르고 `overflow-y: hidden`이다.
- **REQ-AI-015-009**: WHEN Shift 없이 Enter 가 눌리고 IME 조합 중이 아니면, THEN 기본 동작(줄바꿈)을 막고, trim 결과가 비어 있지 않으면 `callbacks.onSubmitCustom(trim 결과)`를 정확히 1회 호출한다. trim 결과가 비어 있으면 호출하지 않는다.
- **REQ-AI-015-010**: WHEN Shift+Enter 가 눌리면, THEN 전송하지 않고 기본 동작(줄바꿈 삽입)을 막지 않는다.

### State-Driven

- **REQ-AI-015-011**: While 직접 입력 상태에 머무는 동안, 프리셋 메뉴는 textarea 입력으로 높이가 바뀌어도 세로 flip 방향(`--above` 유무)을 다시 판정하지 않아야 한다.
- **REQ-AI-015-013**: While 다이어그램 서브메뉴가 열려 있는 동안, 프리셋 메뉴는 조합 중이 아닌 Escape 에 대해 SPEC-AI-011 의 처리 순서(서브메뉴만 닫고 트리거로 포커스 복귀)를 그대로 따라야 한다.

### Unwanted Behavior

- **REQ-AI-015-012**: When keydown 이벤트가 `isComposing === true` 이거나 `keyCode === 229` 인 것이 감지되면, 프리셋 메뉴는 textarea 의 Enter 처리와 메뉴 루트의 Escape 처리에서 아무 동작도 하지 않아야 한다(전송·모드 전환·메뉴 닫힘·`preventDefault`·`stopPropagation` 모두 없음).

## Rejected Alternatives

- **CSS `field-sizing: content`만으로 자동 증가** — 사용자 WKWebView 지원 미확인, jsdom 검증 불가(D2).
- **고정 최대 줄 수(예: 8줄)** — 사용자 결정은 "화면을 넘을 때만 멈춤". 화면이 넓은데 일찍 스크롤되는 것은 요구와 다르다.
- **타이핑할 때마다 flip 재판정** — 경계 근처에서 위/아래가 번갈아 뒤집힌다(D4).
- **`menuPlacement.ts`로 배치 로직 이관** — 범위 확대. 본 SPEC 은 기존 flip 함수를 재사용만 한다.
- **새 클래스명(`mdedit-ai-custom-textarea`)** — 기존 테스트 선택자와 이름이 어긋날 뿐 이득이 없다(D8).

## Delta (Brownfield Changes)

| 파일 | 변경 |
|------|------|
| `src/components/editor/extensions/ai-selection-toolbar.ts` | `renderCustomInput()`을 textarea + 높이 증가 + IME/Enter 처리로 교체. `setMode()`에서 수식 클래스·인라인 폭 토글과 재측정 호출. `handleKeyDown()` 맨 앞 IME 가드. 직접 입력 상태 측정(폭·세로 방향·상한)을 기존 rAF 패스 안에 추가. 순수 함수 `computeCustomInputHeight`·`computeCustomInputMaxHeight`·`computeCustomMenuWidth` 추가·export, 상수 `CUSTOM_INPUT_PREFERRED_HEIGHT = 200`. |
| `src/styles/mdedit-components.css` | 공유 선택자 `:424`, `:431`, `:437`, `:438`에서 custom 쪽을 분리. 새 규칙: `.mdedit-ai-preset-menu--custom`(width 340px), `.mdedit-ai-custom-row`(flex-start), `.mdedit-ai-custom-input`(textarea: `min-height: 28px`, `resize: none`, 세로 패딩·line-height, 기본 `overflow-y: hidden`, 기존 색·테두리·포커스 링 토큰 유지). |
| `src/test/aiSelectionToolbar.test.ts` | 직접 입력 describe(`:402-457`) 갱신·추가, 순수 함수 테스트 추가. |
| `e2e/ai-custom-input-grow.spec.ts` (신규) | 실제 WebKit 전체 앱 레이아웃에서 폭·증가·상한·스크롤·위치 검증. |

`package.json` 의존성 변경 없음. 위 4개 외 파일 변경 없음.

## Verification Strategy

| 요구 | 계층 | 이유 |
|------|------|------|
| 001, 004(클래스), 005, 009, 010, 012, 013 | vitest(jsdom) | DOM 구조·이벤트 분기는 레이아웃 없이 증명된다. |
| 004(폭 계산)·006(재측정 배선)·007·008·014 계산 로직 | vitest — 순수 함수 + `scrollHeight`·`offsetHeight`·`clientHeight`·`getBoundingClientRect`·rAF 목 | jsdom 은 레이아웃이 없어 실측 불가 → 계산식은 순수 함수로 떼어 검증하고 배선은 목으로 확인. |
| 004 실제 폭·패널 안 머묾, 008 실제 증가·스크롤, 009 실제 전송, 011 | Playwright `webkit`(전체 앱 레이아웃) | 메모리 교훈: 배치·겹침은 오버레이를 포함한 전체 레이아웃에서 재현해야 한다. |
| 002, 003 | CSS diff 검토 + 기존 제안 카드·메뉴 테스트 회귀 | 선언 불변은 diff 로 확인. |
| 실기기 IME(한글)·실기기 Shift+Enter | 수동 점검 M-1, M-2 | Playwright 합성 키 입력은 WKWebView 의 실제 조합 이벤트 순서를 재현하지 못한다(SPEC-AI-011 교훈). |

## Acceptance Criteria

`acceptance.md` 참조. 요약: AC-AI-015-001~009(자동), M-1~M-3(수동).

## Risks

| ID | 위험 | 완화 |
|----|------|------|
| R1 | 앵커 좌·우 어느 쪽 공간도 198px(190 + 8) 미만이면(패널이 아주 좁고 ✨ 가 가운데) 190px 메뉴도 일부 잘린다. | D1 이 넓은 쪽 공간에 맞춰 폭을 줄이므로 그 외 경우는 패널 안에 들어간다. 남는 경우는 Known Limitation(프리셋 상태 190px 메뉴도 같은 조건에서 잘리는 기존 동작). |
| R6 | 실효 세로 공간이 위·아래 모두 56px(28 + 외곽 20 + 여백 8) 안팎보다 작으면, 28px 하한 때문에 메뉴가 패널 경계를 넘을 수 있다. | 직접 입력 칸이 사라지는 것보다 낫다고 보고 하한을 유지 — Known Limitation. |
| R2 | rAF 측정 전 한 프레임 동안 메뉴가 이전 방향·상한 없음 상태로 보일 수 있다. | 기존 flip 과 같은 조건. 포커스 직후라 그 사이 입력은 없다. |
| R3 | 메뉴가 destroy 된 뒤 rAF 가 실행되어 분리된 DOM 을 측정. | 측정 시작에 `dom.isConnected` 확인(D5). |
| R4 | 공유 CSS 분리 중 `.mdedit-ai-direct-input` 선언이 실수로 바뀜. | AC-AI-015-008 이 diff 로 확인. |
| R5 | 모드를 빠르게 왕복하면 앞선 rAF 측정이 뒤늦게 실행되어 다른 모드 기준으로 계산. | 콜백이 `getCustomInput()`으로 실행 시점 상태를 읽는다(D5). AC-AI-015-005 에 왕복 테스트 포함. |

## Known Limitations

- R1 — 앵커 양쪽 공간이 모두 198px 미만인 아주 좁은 패널에서는 메뉴 일부가 잘린다(가로 clamp 이동은 하지 않는다).
- R6 — 실효 세로 공간이 위·아래 모두 아주 작으면 28px 하한 때문에 메뉴가 패널 경계를 넘을 수 있다.
- 창 크기 변경·스크롤 중 상한 재계산 없음(D10).

## Exclusions (What NOT to Build)

### Out of Scope — 본 SPEC 이 만들지 않는 것

- 제안 카드 "방향 지시" 칸의 textarea 화 또는 스타일 변경.
- 프리셋 목록 상태의 폭·배치 변경.
- `menuPlacement.ts` 이관, 가로 위치 clamp(이동).
- 프리셋 목록 상태의 세로 판정 경계 변경(뷰포트 기준 유지).
- 입력 내용 기억(히스토리), 글자 수 제한·카운터, 전송 버튼 추가.
- 창 resize 리스너.
- 키보드 내비게이션 추가(SPEC-AI-011 v1.1.0 에서 철회된 범위).

## References

- 백로그 카드 t7, 사용자 결정 2026-11-13
- SPEC-AI-008(프리셋 메뉴·서브메뉴), SPEC-AI-011(Escape 순서, `@MX:WARN` 포인터 전용 click)
- 선례 e2e: `e2e/ai-008-diagram-submenu-flip.spec.ts`, 픽스처 `e2e/fixtures/tauri-v2-ai-mock.ts`
