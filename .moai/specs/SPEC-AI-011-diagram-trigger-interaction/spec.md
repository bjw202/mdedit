---
id: SPEC-AI-011
version: "1.1.0"
status: draft
created: "2026-07-30"
updated: "2026-07-30"
author: "jw"
priority: high
issue_number: 0
dependencies:
  - SPEC-AI-008
  - SPEC-UI-008
  - SPEC-AI-005
  - SPEC-AI-007
  - SPEC-E2E-001
tags:
  - ai
  - editor
  - toolbar
  - flyout
  - a11y
  - keyboard
  - interaction
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-30 | jw | 최초 SPEC 작성 — AI 선택 툴바 "🧜 다이어그램으로" 트리거의 **hover/click 충돌** 해소. 원인은 확정 진단됨: 실제 포인터 클릭은 `mouseenter` → `click` 순으로 발화하므로, `ai-selection-toolbar.ts:606-607`에 각각 바인딩된 `openDiagramSubmenu()`와 `toggleDiagramSubmenu()`가 연달아 실행되어 **열자마자 닫힌다**(포인터 사용자에게 트리거 클릭은 순 no-op). 이는 단순 코딩 실수가 아니라 **SPEC-AI-008의 명세 충돌**이다 — REQ-AI-008-006(hover 시 연다)과 REQ-AI-008-007(클릭 토글)은 포인터 입력에서 동시에 만족될 수 없다. 비대칭성 주의: 키보드 활성화(Tab → Enter/Space)는 `mouseenter` 없이 `click`만 발화하므로 **키보드 경로는 현재 정상 동작하고 포인터 경로만 깨져 있다**. 사용자 확정 결정: (1) 트리거 클릭을 **열기 전용**(open-only)으로 — 닫힌 상태면 열고, 이미 열려 있으면 무시(닫지 않음), (2) 서브메뉴 **키보드 내비게이션 범위 포함**(방향키·role·포커스 이동 — 현재 전무), (3) 타 팝오버 동일 충돌 감사 완료(결과: 해당 없음 — Popover Audit 절). |
| 1.0.0 | 2026-07-30 | jw | **SPEC-AI-008 개정 필요 사항 기록(후속 액션, 본 SPEC은 AI-008 파일을 수정하지 않는다)**: (a) `REQ-AI-008-007`의 "플라이아웃 서브메뉴를 **토글(열림↔닫힘)**"을 "**연다. 이미 열려 있으면 상태를 바꾸지 않는다**"로 개정, (b) `REQ-AI-008-006`을 "hover 가능 포인터 진입 시 연다(클릭과 상호 배타적이지 않음 — 두 경로 모두 열기 전용)"로 명확화, (c) `REQ-AI-008-013`의 "Tab / Enter / Space"를 "Tab / 방향키 / Enter / Space"로 확장하고 role 요구를 추가, (d) `AC-AI-008-001`의 "클릭(no-hover) → 토글"을 "클릭 → 열림(재클릭 무해)"으로 개정, (e) `AC-AI-008-009`를 방향키 순환 포함으로 확장. **이 5건과 AI-008의 version/updated/HISTORY 갱신은 run 단계 구현 순서의 마지막 작업으로 편입하여 본 SPEC 구현과 같은 PR에 포함한다**(두 SPEC이 모순 상태로 공존하는 기간을 0으로 만들기 위함 — REQ-AI-011-023, R7). 단 plan 단계인 현 시점에서는 AI-008 파일을 편집하지 않는다. `status: draft`는 저장소 관례상 유지한다. |
| 1.1.0 | 2026-07-30 | jw | **키보드 내비게이션 요구 WITHDRAWN(철회)** — REQ-AI-011-007(트리거 Enter/Space 시 첫 항목 포커스 진입), REQ-AI-011-008(ArrowDown/ArrowUp 진입), REQ-AI-011-009(방향키 래핑 순환), REQ-AI-011-010(Enter/Space 단일 선택)을 철회한다. 원인: 실제 macOS WKWebView 앱에서 포커스가 서브메뉴에 **결코 도달하지 않는다** — (1) 프리셋 메뉴 루트 `dom.tabIndex = -1`이고 메뉴/버튼을 열 때 아무도 focus()를 호출하지 않음, (2) Tab은 `markdown-extensions.ts:120`의 `indentWithTab`이 소비해 CodeMirror 밖으로 포커스가 나가지 않음, (3) macOS WebKit은 `<button>` 클릭 시 포커스를 주지 않음. 결과적으로 모든 keydown이 툴바가 아니라 CodeMirror로 간다 — 사용자가 실기기에서 방향키·Tab이 무반응이고 Enter가 선택 텍스트를 파괴함을 확인했다. 이 도달 불가성은 jsdom/Playwright(Chromium)가 클릭 시 버튼에 포커스를 주는 반면 실제 macOS 웹뷰는 그렇지 않기 때문에 **단위·E2E 테스트 모두 초록이었음에도** 놓쳤다 — Verification Strategy 표의 수동 점검 행(R6, B-5 항목)이 이 차이를 잡아냈어야 했으나 머지 시점에 미검증 상태로 남아 있었다. 사용자 결정: 키보드 내비게이션은 애초에 원하지 않았고 마우스 상호작용으로 충분하다 — 죽은 코드를 남기지 않고 제거한다(REQ-005/006의 ARIA role 요구는 스크린리더 등 키 입력 무관 보조기술에 유효하므로 그대로 유지). 관련 `ai-selection-toolbar.ts`의 `focusDiagramItem`, 서브메뉴 `keydown` 리스너, 트리거 `keydown` 리스너를 삭제하고 `@MX:WARN`을 실제 근거(포인터 전용 click 유지 사유)로 재작성했다. |

## Summary

`mdedit` AI 선택 툴바(✨)의 프리셋 메뉴에서 **"🧜 다이어그램으로"** 항목을 **마우스로 클릭하면 아무 일도 일어나지 않는다.** 포인터가 항목 위로 들어오는 순간 `mouseenter`가 서브메뉴를 열지만, 뒤이어 같은 제스처의 `click`이 `toggleDiagramSubmenu()`를 호출해 방금 열린 서브메뉴를 즉시 닫기 때문이다. 결과적으로 마우스 사용자는 **클릭으로는 다이어그램 종류에 도달할 수 없고**, 트리거에 hover한 뒤 포인터를 서브메뉴 항목 위로 옮기는 경로만 유효하다.

본 SPEC은 이 충돌을 **트리거 클릭의 열기 전용(open-only) 의미론**으로 해소한다. 닫힌 서브메뉴에 대한 클릭은 연다. 이미 열려 있는 서브메뉴에 대한 클릭은 **무시한다**(토글로 닫지 않는다). 이는 데스크톱 메뉴의 관례적 동작이며, SPEC-AI-008이 의도한 REQ-006(hover 열림)과 REQ-007(클릭으로 도달 가능)의 취지를 **양쪽 다** 보존한다.

동시에, 서브메뉴의 **키보드 내비게이션을 신설**한다. 현재 이 파일의 `keydown` 핸들러는 custom-input의 Enter 처리(`ai-selection-toolbar.ts:643`)와 `dom`의 Escape 처리(`:662`, `:679`) 두 개뿐이며, 서브메뉴로 진입하거나 서브메뉴 안에서 이동하는 방향키가 **전혀 없다**. `closeDiagramSubmenu(returnFocus)`는 트리거로 포커스를 되돌릴 수 있지만, 그 반대 방향 — 서브메뉴 항목으로 포커스를 넣는 코드는 **존재하지 않는다**. 서브메뉴 컨테이너와 항목에는 `role`이 부여되어 있지 않다(항목은 `aria-label`만 가진 네이티브 `<button>`).

발행되는 페이로드는 **바뀌지 않는다** — "자동"은 `diagramType` 없이, 종류 항목은 `diagramType`을 실어 발행한다(SPEC-AI-008 REQ-008/009). Rust 프롬프트 조립(`prompt.rs`)은 접근하지 않는다. 본 SPEC은 순수 **프론트엔드 상호작용·접근성 수정**이다.

## Background & Rationale

### 확정된 원인 (재조사 불필요)

`src/components/editor/extensions/ai-selection-toolbar.ts:604-608`:

```js
diagramTrigger = btn;
// hover 시 열림(REQ-006), 클릭 토글(REQ-007) — 클릭은 즉시 발행하지 않는다.
btn.addEventListener('mouseenter', () => openDiagramSubmenu());
btn.addEventListener('click', () => toggleDiagramSubmenu());
```

DOM 이벤트 순서는 고정되어 있다. 실제 포인터로 버튼을 클릭하려면 포인터가 먼저 버튼 위로 진입해야 하고, 그때 `mouseenter`가 발화한다. 이어서 `mousedown` → `mouseup` → `click`이 발화한다. 따라서 **모든 실제 마우스 클릭은 예외 없이 `mouseenter`를 선행시킨다.**

- `mouseenter` → `openDiagramSubmenu()` → `diagramSubmenu !== null`
- `click` → `toggleDiagramSubmenu()` → `diagramSubmenu`가 truthy이므로 `closeDiagramSubmenu()`

순 효과는 **no-op**이다. 사용자는 클릭했는데 화면이 그대로다(정확히는 열렸다 닫히지만 같은 프레임 안이라 깜빡임조차 인지되지 않는다).

### 이것은 명세 충돌이다 (코딩 실수가 아니다)

SPEC-AI-008은 두 요구를 나란히 두었다:

- **REQ-AI-008-006**: "**WHEN** hover 가능 포인터가 '다이어그램으로' 항목 위에 올라오면, the system shall 플라이아웃 서브메뉴를 **연다**."
- **REQ-AI-008-007**: "**WHEN** hover 불가(터치/키보드) 환경에서 '다이어그램으로' 항목이 클릭·활성화되면, the system shall 플라이아웃 서브메뉴를 **토글(열림↔닫힘)** 한다."

REQ-007의 전제절은 "hover 불가 환경"이지만, **구현이 그 전제를 런타임에 판별할 수 없다** — `click` 이벤트만으로는 그것이 hover 가능한 마우스에서 왔는지 hover 불가한 터치/키보드에서 왔는지 알 수 없다. 따라서 무조건 바인딩된 `click` 핸들러가 hover 가능 환경에도 그대로 적용되고, 두 요구가 같은 제스처에서 정면 충돌한다. **REQ-006과 REQ-007은 포인터 입력에 대해 동시 만족 불가능한 요구쌍이다.** 구현자가 두 요구를 문자 그대로 성실히 배선한 결과가 지금의 결함이다.

본 SPEC은 이 충돌을 해소하고 SPEC-AI-008을 개정한다(HISTORY의 개정 항목 (a)~(e) — 실제 편집은 후속 액션).

### 비대칭성: 키보드는 지금도 동작한다

`click` 이벤트는 포인터 전용이 아니다. 네이티브 `<button>`에 포커스가 있을 때 Enter 또는 Space를 누르면 브라우저가 **`mouseenter` 없이 `click`을 합성 발화**한다. 그러면 `toggleDiagramSubmenu()`가 닫힌 상태(`diagramSubmenu === null`)에서 호출되어 서브메뉴가 정상적으로 열린다.

즉 **현재 결함은 포인터 경로 한정이며, 키보드 경로는 온전하다.** 이 비대칭성은 두 가지 실무적 함의를 갖는다:

1. `click` 핸들러를 삭제하는 "간단한 수정"은 **키보드 사용자를 회귀시킨다** — 트리거를 키보드로 여는 유일한 수단이 사라진다(Rejected Alternatives (c) 참조).
2. 기존 vitest 단위 테스트(`src/test/aiSelectionToolbar.test.ts:910`, `:926`)는 jsdom에서 `dispatchEvent(new MouseEvent('click'))`만 던지므로 `mouseenter`가 선행하지 않는다 — **즉 단위 테스트는 키보드 경로만 검증하고 있었고, 그래서 결함이 있는 채로 초록이었다.** 이 SPEC의 검증 전략은 이 사실을 정면으로 다룬다(Verification Strategy 참조).

### 확정된 현재 상태 (소스 검증 완료)

`ai-selection-toolbar.ts` 전체에서 확인한 사실:

| 항목 | 현재 상태 | 근거 라인 |
|------|-----------|-----------|
| 트리거 hover 바인딩 | `mouseenter` → `openDiagramSubmenu()` | `:606` |
| 트리거 click 바인딩 | `click` → `toggleDiagramSubmenu()` | `:607` |
| 토글 함수 | 열려 있으면 닫고, 아니면 연다 | `:553-556` |
| 트리거 ARIA | `aria-haspopup="true"`, `aria-expanded` 동기화됨 | `:598-599`, `:516`, `:547` |
| 서브메뉴 컨테이너 role | **없음** (`div.mdedit-ai-diagram-submenu`, role 미지정) | `:523-524` |
| 서브메뉴 항목 role | **없음** (네이티브 `<button>` + `aria-label`만) | `:526-529` |
| 방향키 내비게이션 | **없음** — 파일 내 `keydown` 핸들러는 custom-input Enter(`:643`)와 `dom` Escape(`:662`, `:679`) 둘뿐 | — |
| 서브메뉴로 포커스 진입 | **없음** — 어떤 코드도 서브메뉴 항목에 `.focus()`를 호출하지 않는다 | — |
| 트리거로 포커스 복귀 | 존재 — `closeDiagramSubmenu(true)`가 Escape 경로에서만 호출됨 | `:512-519`, `:667` |
| `mouseleave` 닫기 | **없음** — 포인터가 트리거를 떠나도 서브메뉴는 열린 채 남는다 | — |
| Escape 닫기 | 존재 — 서브메뉴만 닫고 트리거로 포커스 복귀, 툴바 유지 | `:662-669` |
| 외부 mousedown 닫기 | 존재 — 위젯의 `onOutsideMouseDown` → `closeMenu()` → `menu.destroy()` → `closeDiagramSubmenu()` | `:688-693`, `:744-749` |

### 저장소 내 참조 구현이 이미 있다

`src/components/editor/EditorToolbar.tsx`의 `DiagramInsertMenu`(SPEC-UI-008 수동 삽입 드롭다운)는 본 SPEC이 필요로 하는 키보드 패턴을 **이미 구현해 두었다**:

- `role="menu"`(`:351`) + `role="menuitem"`(`:360`)
- `handleMenuKeyDown`(`:316-330`): ArrowDown/ArrowUp이 항목 포커스를 **래핑 순환**시키고, Enter/Space는 `preventDefault()` 후 선택하여 네이티브 버튼 활성화와의 **이중 발화를 차단**한다.
- 파일 상단 `@MX:NOTE`(`:245-249`)가 이 계약을 명시한다.

본 SPEC은 이 패턴을 명령형 DOM으로 이식한다. 새 상호작용 관례를 발명하지 않는다.

## Popover Audit (조사 결과 — 확정)

> 사용자 요청에 따라 "다른 팝오버도 같은 충돌을 갖는가"를 전수 조사했다. **결론: 해당 없음.** 따라서 본 SPEC의 요구사항 집합은 **AI 선택 툴바 한정**이며, "혹시 다른 곳도" 류의 미결 조항을 남기지 않는다.

`src/`와 `e2e/` 전체에서 `mouseenter` / `mouseover` / `mouseleave` / `pointerenter` / `onMouseEnter` / `onMouseOver` / `onMouseLeave`를 전수 검색한 결과 6개 지점이 나왔고, 각각을 분류했다:

| 파일:라인 | 이벤트 | 용도 | 팝오버 열림/닫힘 제어인가 | 동일 충돌 |
|-----------|--------|------|---------------------------|-----------|
| `src/components/editor/extensions/ai-selection-toolbar.ts:606` | `mouseenter` | 다이어그램 서브메뉴 **열기** | **예** | **예 — 본 SPEC의 대상** |
| `src/components/editor/EditorToolbar.tsx:202` | `onMouseLeave` (그리드 컨테이너) | 표 삽입 그리드의 **셀 하이라이트 해제**(`setHovered(null)`) | 아니오 | 아니오 |
| `src/components/editor/EditorToolbar.tsx:213` | `onMouseOver` (그리드 셀) | 표 크기 **미리보기 하이라이트**(`setHovered({row,col})`) | 아니오 | 아니오 |
| `src/components/layout/ResizablePanels.tsx:141` | `onMouseLeave` | 패널 리사이즈 **드래그 취소** | 아니오 | 아니오 |
| `src/components/preview/ImageFileViewer.tsx:176` | `onMouseLeave` | 이미지 팬 **드래그 취소** | 아니오 | 아니오 |
| `src/components/preview/SvgFileViewer.tsx:160` | `onMouseLeave` | SVG 팬 **드래그 취소** | 아니오 | 아니오 |

`menuPlacement.ts`(SPEC-UI-008이 도입한 flip+clamp 배치 표준) 소비자도 전수 확인했다 — `ai-selection-toolbar.ts`와 `EditorToolbar.tsx` 둘뿐이다. `EditorToolbar.tsx`가 소유한 두 팝오버는 모두 **클릭 전용 열림**이다:

- **TableGridPicker**(`:113-243`): `onClick={() => setOpen(...)}`로만 열린다. 그리드 셀의 `onMouseOver`/`onMouseLeave`는 팝오버가 **이미 열린 뒤** 셀 하이라이트만 갱신하며, 열림/닫힘 상태(`open`)를 건드리지 않는다.
- **DiagramInsertMenu**(`:250-378`): `onClick={() => setOpen((prev) => !prev)}`(`:340`)로만 열린다. hover 핸들러가 전혀 없다. 클릭 토글이지만 **hover 열림이 없으므로 충돌하지 않는다** — 토글이 안전한 유일한 조건이다.

**감사 결론**: 저장소 전체에서 "hover로 열고 click으로 토글"하는 컴포넌트는 `ai-selection-toolbar.ts` **단 하나**다. 본 SPEC의 REQ 범위를 AI 선택 툴바로 한정하며(REQ-AI-011-020), 타 팝오버는 무변경 회귀 대상으로만 취급한다.

## Environment & Assumptions

- 프론트엔드: React 18, TypeScript strict, CodeMirror 6, Tailwind CSS 3 + `.md-*`/`.mdedit-*` 토큰(SPEC-UI-006).
- 대상 컴포넌트는 **명령형 DOM**(`document.createElement`)이다. React 리라이트 없음 — SPEC-AI-008 REQ-019의 계보를 잇는다.
- 배포 형태: **데스크톱 Tauri v2 앱**(macOS = WKWebView, Windows = WebView2). 물리 마우스/트랙패드 + 물리 키보드가 1차 입력 수단이다.
- 테스트 환경: vitest + jsdom(단위), Playwright(Chromium, `e2e/`, `tauri-mock` 픽스처).
- **jsdom 한계(중요)**: `element.dispatchEvent(new MouseEvent('click'))`는 `mouseenter`를 선행 발화하지 않는다. jsdom에서 실제 포인터 시퀀스를 재현하려면 `mouseenter`와 `click`을 **명시적으로 순서대로 dispatch**해야 한다. 이 사실이 현재 결함이 단위 테스트를 통과한 이유다.
- **Playwright 한계**: Playwright는 Chromium에서 실행되며 Tauri의 실제 웹뷰(WKWebView/WebView2)가 아니다. 포커스·Tab 순회의 플랫폼 차이(특히 macOS의 "전체 키보드 접근" 설정이 꺼져 있으면 WKWebView에서 `<button>`이 Tab 순회에 참여하지 않을 수 있음)는 Playwright가 증명하지 못한다. 명시적 `.focus()` 호출로 이동하는 방향키 경로는 이 차이의 영향을 받지 않는다.
- 프리셋 가드(SPEC-AI-007): 선택 길이 4001자 이상이면 다이어그램 프리셋이 `disabled`가 되고(`:590`), 이때 `diagramTrigger` 바인딩 자체가 건너뛰어진다(`:603` `if (!item.disabled)`).

## Requirements (EARS)

> 요구사항 원자성: 클릭 의미론(001~003)·hover 보존(004)·ARIA(005~006)·키보드 진입(007~008)·키보드 이동/선택(009~010)·닫기 경로(011~013)·상태 게이트(014~015)·회귀 금지(016~021)·문서 정합(022)으로 분리했다. 각 요구는 관찰 가능한 이진 술어로 서술한다.

### Ubiquitous Requirements

- **REQ-AI-011-001**: The system **shall** 항상 다이어그램 트리거의 클릭(포인터·키보드 어느 경로든)을 **열기 전용 연산**으로 처리한다 — 서브메뉴가 닫혀 있으면(`diagramSubmenu === null`) 연다.
- **REQ-AI-011-002**: The system **shall** 항상 서브메뉴가 이미 열려 있는 동안 발생한 트리거 클릭을 **상태 무변경으로 처리**한다 — 서브메뉴는 열린 채로 남고 `aria-expanded`는 `"true"`를 유지한다. (실제 포인터 클릭에서는 선행 `mouseenter`가 이미 열어 두므로, 이 요구가 곧 "포인터 클릭이 no-op가 되지 않는다"를 보장한다.)
- **REQ-AI-011-003**: The system **shall not** 다이어그램 트리거의 어떤 활성화 경로(hover / 포인터 클릭 / Enter / Space / 방향키)에서도 AI 요청을 발행한다. 요청 발행은 서브메뉴의 8개 항목 선택으로만 일어난다(SPEC-AI-008 REQ-008/009 계약 유지).
- **REQ-AI-011-004**: The system **shall** 항상 hover 가능 포인터가 다이어그램 트리거에 진입할 때 서브메뉴를 연다(SPEC-AI-008 REQ-AI-008-006 유지). hover 열림과 클릭 열림은 **상호 배타적이지 않으며**, 둘 다 열기 전용이므로 같은 제스처에서 연달아 실행되어도 결과가 동일하다(멱등).
- **REQ-AI-011-005**: The system **shall** 항상 서브메뉴 컨테이너에 `role="menu"`를, 8개 항목 각각에 `role="menuitem"`을 부여한다(현재는 컨테이너·항목 모두 role 미지정이며, 항목은 `aria-label`만 가진 네이티브 `<button>`이다). 저장소 선례 `EditorToolbar.tsx:351/360`과 동일한 수준이다. **트리거의 `aria-haspopup`은 현행 `"true"`를 그대로 유지한다** — ARIA 사양상 `"true"`는 `"menu"`와 동치이므로 표기 변경은 기능 효과가 0이며, 기존 테스트(`aiSelectionToolbar.test.ts:905`)까지 건드리는 순수 표기 diff를 만들지 않는다.
- **REQ-AI-011-006**: The system **shall** 항상 트리거의 `aria-expanded` 값을 서브메뉴 DOM의 존재 여부와 일치시킨다 — 서브메뉴가 문서에 존재하는 동안 `"true"`, 그 외 `"false"`.

### Event-Driven Requirements

- **[WITHDRAWN v1.1.0 — 도달 불가 확인, HISTORY 참조] REQ-AI-011-007**: **WHEN** 트리거에 포커스가 있는 상태에서 Enter 또는 Space로 활성화되면, **the system shall** 서브메뉴를 열고 **첫 번째 항목("자동 (AI 판단)")으로 포커스를 이동**시킨다. (현재는 열리기만 하고 포커스가 트리거에 남아 있어, 키보드 사용자가 서브메뉴에 도달할 명시적 수단이 없다.)
- **[WITHDRAWN v1.1.0 — 도달 불가 확인, HISTORY 참조] REQ-AI-011-008**: **WHEN** 서브메뉴가 닫힌 상태에서 트리거에 포커스가 있고 ArrowDown이 눌리면, **the system shall** 서브메뉴를 열고 첫 항목으로 포커스를 이동시킨다. ArrowUp이 눌리면 서브메뉴를 열고 **마지막 항목**으로 포커스를 이동시킨다.
- **[WITHDRAWN v1.1.0 — 도달 불가 확인, HISTORY 참조] REQ-AI-011-009**: **WHEN** 서브메뉴가 열린 상태에서 포커스가 서브메뉴 항목에 있고 ArrowDown 또는 ArrowUp이 눌리면, **the system shall** 기본 스크롤 동작을 막고(`preventDefault`) 8개 항목 사이에서 포커스를 **래핑 순환** 이동시킨다(마지막에서 ArrowDown → 첫 항목, 첫 항목에서 ArrowUp → 마지막 항목).
- **[WITHDRAWN v1.1.0 — 도달 불가 확인, HISTORY 참조] REQ-AI-011-010**: **WHEN** 서브메뉴 항목에 포커스가 있는 상태에서 Enter 또는 Space가 눌리면, **the system shall** 해당 항목을 **정확히 한 번** 선택 발행한다 — 네이티브 `<button>`의 기본 활성화와 커스텀 키 핸들러가 이중 발화하지 않아야 한다(`EditorToolbar.tsx:326-329` 선례와 동형).
- **REQ-AI-011-011**: **WHEN** 서브메뉴가 열린 상태에서 Escape가 눌리면, **the system shall** 서브메뉴만 닫고 트리거로 포커스를 복귀시키며 상위 프리셋 메뉴와 툴바는 유지한다(현행 `:662-669` 동작 보존).
- **REQ-AI-011-012**: **WHEN** 서브메뉴가 열린 상태에서 툴바 래퍼(`.mdedit-ai-toolbar`) 외부에 mousedown이 발생하면, **the system shall** 서브메뉴를 상위 메뉴와 함께 닫는다(현행 위젯 `onOutsideMouseDown` 경로 보존).
- **REQ-AI-011-013**: **WHEN** 포인터가 다이어그램 트리거와 서브메뉴를 모두 벗어나 같은 프리셋 목록의 **다른 항목** 위로 이동하면, **the system shall** 서브메뉴를 닫는다.

  > **왜 이것이 필수 짝인가 (장식이 아닌 근거)**: REQ-002가 클릭-토글을 제거하면 포인터만으로 서브메뉴를 닫을 수단이 **외부 클릭뿐**이 된다(현재 코드에 `mouseleave` 닫기 경로가 전혀 없음). 그런데 진단 단계에서 **이 플라이아웃이 좁은 폭에서 좌측으로 flip될 때 트리거 행 전체를 시각적으로 덮는 것**이 확인되었다(`scheduleSubmenuFlipMeasurement` / `computeFlyoutOffset`의 flip→clamp 경로). 서브메뉴가 열린 채 방치되면 상위 프리셋 항목들을 가려 버리고, 이는 **REQ-AI-011-015("서브메뉴가 열려 있는 동안에도 상위 프리셋 항목을 클릭 가능하게 유지한다")와 정면으로 충돌한다.** 즉 REQ-013은 채택된 열기 전용 설계가 성립하기 위한 구성 요소이지 부가 편의 기능이 아니다.

### State-Driven Requirements

- **REQ-AI-011-014**: **WHILE** 다이어그램 프리셋이 선택 길이 가드(SPEC-AI-007)로 `disabled` 상태인 동안, **the system shall** hover·클릭·키보드 어느 입력으로도 서브메뉴를 열지 않는다(현행 `:603` `if (!item.disabled)` 바인딩 게이트 보존).
- **REQ-AI-011-015**: **WHILE** 서브메뉴가 열려 있는 동안, **the system shall** 상위 프리셋 메뉴의 다른 항목들을 계속 포인터로 클릭 가능한 상태로 유지한다 — 서브메뉴를 차단 오버레이(backdrop) 위에 띄우거나 상위 항목의 `pointer-events`를 끄지 않는다.

### Unwanted Behavior Requirements

- **REQ-AI-011-016**: The system **shall not** 서브메뉴 항목 선택 시 발행되는 요청 페이로드를 변경한다 — "자동"은 `diagramType` 없이(`onSelectPreset('diagram', undefined)`), 7종 항목은 해당 `diagramType`을 실어 발행한다(SPEC-AI-008 REQ-008/009). `buildSelectionRequest`, IPC 계약, Rust 프롬프트 조립(`src-tauri/src/ai/prompt.rs`, `mod.rs`)은 접근하지 않는다.
- **REQ-AI-011-017**: The system **shall not** 트리거의 `click` 핸들러를 제거한다. `click`은 키보드 Enter/Space 활성화가 도달하는 유일한 이벤트이므로, 제거는 키보드 사용자 회귀다(Rejected Alternatives (c)).
- **REQ-AI-011-018**: The system **shall not** hover 열림(`mouseenter` → 열기)을 제거하거나 클릭 전용 메뉴로 대체한다(Rejected Alternatives (b)).
- **REQ-AI-011-019**: The system **shall not** 포인터 종류 판별 분기(`PointerEvent.pointerType`, `matchMedia('(hover: hover)')`, 터치 감지 휴리스틱 등)를 도입한다. 채택된 열기 전용 의미론은 **입력 종류와 무관하게 올바르므로** 분기가 불필요하다(Touch/Pen Scope 절 참조).
- **REQ-AI-011-020**: The system **shall not** 타 팝오버 컴포넌트를 변경한다 — `EditorToolbar.tsx`의 `TableGridPicker`·`DiagramInsertMenu`, `src/lib/ui/menuPlacement.ts`, 그리고 `scheduleMenuFlipMeasurement`/`scheduleSubmenuFlipMeasurement`/`computeFlyoutOffset` 배치 로직은 무변경이다(Popover Audit 결과: 동일 충돌 없음).
- **REQ-AI-011-021**: The system **shall not** 신규 런타임 의존성(`package.json`, `src-tauri/Cargo.toml` 무변경)이나 신규 전역 키보드 단축키(`markdownKeyBindings` 무변경)를 추가한다. 서브메뉴 내부 키 처리는 지역 리스너이므로 전역 등록에 해당하지 않는다.
- **REQ-AI-011-022**: The system **shall not** `e2e/ai-inline-edit.spec.ts:193-195`의 우회 주석("알려진 UI 결함 … 트리거를 hover() 만 하고 click() 하지 않는다 … 단일 클릭으로 되돌리지 말 것")을 현재 결함을 서술하는 상태로 남겨 둔다. 수정 후 해당 테스트는 트리거 `click()` 경로를 실제로 행사하고, 주석은 "결함이 존재한다"가 아니라 "SPEC-AI-011로 클릭이 열기 전용이 되어 클릭·hover 양쪽이 유효하다"는 사실을 서술해야 한다.
- **REQ-AI-011-023**: The system **shall not** 본 SPEC의 구현이 머지된 뒤 SPEC-AI-008을 모순 상태로 남겨 둔다 — REQ-AI-008-007(클릭 토글)을 비롯한 개정 대상 5건(plan.md 후속 액션 표 a~e)은 **본 SPEC 구현과 같은 PR에서** 개정되어야 하며, 코드가 "클릭=열기 전용"인데 SPEC-AI-008이 "클릭=토글"이라고 서술하는 기간이 존재해서는 안 된다.

## Touch / Pen Scope (명시적 결정)

> 사용자 요청에 따라 터치·펜 입력의 범위 포함 여부를 명시한다. 미결로 남기지 않는다.

**결정: 터치/펜 전용 코드 경로는 범위 밖. 단, 채택된 수정이 터치를 부수적으로 함께 고친다.**

근거:

1. `mdedit`는 **데스크톱 Tauri 앱**이며 배포 대상은 macOS/Windows 데스크톱이다. 터치 스크린 데스크톱이 존재하지만 1차 사용 시나리오가 아니고, 검증 매트릭스(Playwright Chromium + 수동 macOS 확인)에 터치 디바이스가 없다. **검증할 수 없는 요구를 명세하지 않는다.**
2. 터치도 **같은 원인으로 깨져 있을 가능성이 높다.** 브라우저는 일반적으로 터치 탭에 대해 호환성 마우스 이벤트를 합성하며 그 순서에서 `mouseenter`(또는 `mouseover`)가 `click`보다 앞선다. 그렇다면 SPEC-AI-008 REQ-007이 상정한 "hover 불가 환경에서는 click만 온다"는 전제가 터치에서도 성립하지 않는다. **다만 합성 `mouseenter`의 발생 여부·순서는 WebView 구현별 편차가 있으며, 본 SPEC은 이를 실기기에서 검증하지 않았다.**
3. 채택한 **열기 전용 의미론은 입력 종류에 무관하게 올바르다** — 이벤트가 몇 개 오든, 어떤 순서로 오든 결과는 "열림"으로 수렴한다(멱등). 따라서 터치 역시 `pointerType` 분기 없이 **함께 해소될 것으로 예상하나, 이는 추론이며 검증된 사실이 아니다**(R8). REQ-019가 분기 도입을 금지하는 이유는 이 멱등성이 분기를 불필요하게 만들기 때문이다.
4. 터치 전용으로 남는 미해결 항목은 **REQ-013(포인터 이탈 시 닫기)** 이다 — 터치에는 "이탈"이 없으므로 터치 사용자는 Escape·외부 탭·항목 선택으로만 닫을 수 있다. 외부 탭 닫기(REQ-012)가 존재하므로 **막다른 상태(trap)는 발생하지 않는다.** 터치 전용 닫기 어포던스(✕ 버튼 등)는 범위 밖이다.
5. **수동 체크리스트에 터치 항목을 넣지 않는다.** 데스크톱 Tauri 앱이라 우선순위가 낮고, 검증하지 않은 것을 검증 항목으로 적어 두는 것보다 **적지 않고 미검증임을 명시하는 편이 정확**하기 때문이다.

## Rejected Alternatives (재검토 금지)

> 사용자 확정 결정. 각 대안의 기각 사유를 기록해 후속 세션이 같은 논의를 반복하지 않게 한다.

| # | 기각된 대안 | 기각 사유 |
|---|-------------|-----------|
| (a) | **트리거 클릭이 "자동"을 즉시 발행** (SPEC-AI-008 이전의 단일 클릭 동작으로 부분 복귀) | 서브메뉴 부모 항목을 클릭했을 뿐인데 **비용이 큰 AI 요청이 예기치 않게 발행된다.** 사용자는 종류를 고르려고 클릭했는데 "자동"으로 요청이 나가 버린다. 관례적 메뉴 동작(부모 항목은 열기만 함)에도 어긋나며, SPEC-AI-008 REQ-007의 "이 항목의 활성화는 즉시 다이어그램 요청을 발행하지 않는다"를 정면으로 뒤집는다. |
| (b) | **hover 열림을 완전히 제거하고 클릭 전용으로 전환** | SPEC-AI-008이 **의도적으로 설계한 hover UX를 폐기**한다(REQ-AI-008-006 + Design Notes의 hover intent 지연 설계). 또한 모든 종류 선택에 클릭이 한 번씩 추가되어(트리거 클릭 → 항목 클릭) 상호작용 비용이 늘어난다. 현재 hover 경로는 **유일하게 동작하는 포인터 경로**이며 사용자 불만도 없다. |
| (c) | **click 핸들러를 삭제하고 hover 전용으로 전환** | **키보드 회귀.** Enter/Space는 `click` 이벤트로 도달하며 `mouseenter`를 발화시키지 않는다. 핸들러를 삭제하면 키보드 사용자가 서브메뉴를 여는 수단이 완전히 사라진다 — 현재 정상 동작하는 유일한 경로를 깨는 셈이다. REQ-017이 이를 금지한다. |
| (d) | **`pointerType` / `matchMedia('(hover: hover)')`로 입력 종류를 판별해 클릭 토글을 hover 불가 환경에만 적용** (REQ-AI-008-007의 문언을 문자 그대로 구현) | 매체 질의는 **디바이스 능력**을 보고할 뿐 **현재 제스처의 출처**를 보고하지 않는다(터치 스크린 노트북은 마우스와 터치를 모두 가진다). 판별 분기는 재현하기 어려운 환경 의존 버그를 낳으며, 열기 전용 의미론은 분기 없이 모든 입력에서 올바르다. REQ-019가 금지한다. |
| (e) | **hover에 지연(hover intent)을 넣어 클릭이 hover보다 먼저 처리되게 유도** | 경합 조건을 타이밍으로 감추는 것이지 해소가 아니다. 느린 포인터 이동에서는 여전히 hover가 먼저 열고 클릭이 닫는다. 타이밍 의존 동작은 테스트가 불가능하다. |

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [MODIFY] | `src/components/editor/extensions/ai-selection-toolbar.ts:553-556` | `toggleDiagramSubmenu()` 제거 또는 열기 전용 의미로 대체 — 트리거 활성화 경로에서 닫기 분기를 없앤다(REQ-001, 002) |
| [MODIFY] | `src/components/editor/extensions/ai-selection-toolbar.ts:604-608` | `click` 바인딩을 `openDiagramSubmenu()`로 교체(핸들러 자체는 유지 — REQ-017). 키보드 활성화 시 첫 항목 포커스 이동 배선(REQ-007). 트리거 `keydown`(ArrowDown/ArrowUp) 바인딩 추가(REQ-008) |
| [MODIFY] | `src/components/editor/extensions/ai-selection-toolbar.ts:521-551` | `openDiagramSubmenu()`에 `role="menu"`(컨테이너)·`role="menuitem"`(8항목) 부여(REQ-005), 서브메뉴 `keydown` 리스너(방향키 순환·Enter/Space 단일 발화) 배선(REQ-009, 010), 포커스 진입 API(첫/마지막 항목) 노출(REQ-007, 008) |
| [UNCHANGED] | `src/components/editor/extensions/ai-selection-toolbar.ts:598-599` | 트리거 `aria-haspopup="true"` **무변경**(ARIA 사양상 `"menu"`와 동치 — 표기 통일만을 위한 diff 금지). `aria-expanded` 동기화 로직도 현행 유지(REQ-006) |
| [MODIFY] | `src/components/editor/extensions/ai-selection-toolbar.ts` (프리셋 목록 루프 `:578-622`) | 다른 프리셋 항목 진입 시 서브메뉴 닫기 경로 추가(REQ-013). 리스너는 `destroy()`에서 정리(SPEC-AI-008 REQ-015 계약 유지) |
| [MODIFY] | `src/components/editor/extensions/ai-selection-toolbar.ts:489-492` | 기존 `@MX:NOTE`가 "hover/클릭이 이 서브메뉴를 열고"라고만 서술 — 열기 전용 불변식과 클릭-토글 금지 계약을 반영해 갱신(@MX Tag Targets 참조) |
| [MODIFY] | `src/styles/mdedit-components.css:444-464` | 필요 시 서브메뉴/래퍼의 hover 이탈 판정을 위한 최소 스타일 조정(간극으로 인한 조기 닫힘 방지). 토큰·`currentColor`만 사용, 신규 색상 리터럴 없음 |
| [MODIFY] | `src/test/aiSelectionToolbar.test.ts:926-934` | **기존 테스트 `'click toggles the submenu open then closed'`는 본 SPEC이 금지하는 동작을 단언하고 있다** — 열기 전용 계약으로 재작성(REQ-002) |
| [MODIFY] | `src/test/aiSelectionToolbar.test.ts:910-924` | 실제 포인터 시퀀스(`mouseenter` → `click`) 재현 테스트 신규 추가 — 현재 테스트는 `click` 단독이라 결함을 놓쳤다(Verification Strategy 참조) |
| [NEW] | `src/test/aiSelectionToolbar.test.ts` (신규 describe 또는 기존 확장) | ARIA role/state, 방향키 순환, Enter/Space 단일 발화, 포커스 진입/복귀, 다른 프리셋 hover 시 닫힘 단위 테스트(REQ-005~010, 013) |
| [MODIFY] | `e2e/ai-inline-edit.spec.ts:191-203` | 우회 주석 갱신 + 트리거 `click()` 경로를 실제로 행사하도록 시퀀스 변경(REQ-022). **실제 포인터 클릭 회귀를 증명하는 유일한 계층** |
| [MODIFY] | `.moai/specs/SPEC-AI-008-diagram-type-picker/spec.md` | **run 단계 작업** — REQ-AI-008-006/007/013, AC-AI-008-001/009 개정(plan.md 후속 액션 표 a~e의 확정 문언 적용) + HISTORY 항목 추가 + `version`/`updated` 갱신. 두 SPEC이 모순 상태로 공존하는 기간을 0으로 만들기 위해 본 SPEC 구현과 **같은 PR**에 포함한다. `status: draft`는 저장소 관례상 유지 |
| [MODIFY] | `.moai/specs/SPEC-AI-008-diagram-type-picker/acceptance.md` | **run 단계 작업** — AC-AI-008-001("클릭 → 토글")과 AC-AI-008-009(키보드) 대응 항목을 개정 문언에 맞춰 갱신 |

## Verification Strategy

각 수용 기준이 **무엇으로 강제되는지**, 그리고 **각 계층이 실제로 무엇을 증명할 수 있는지**를 명시한다.

| 검증 계층 | 대상 REQ | 강제 수단 | 이 계층이 증명하지 **못하는** 것 |
|-----------|----------|-----------|----------------------------------|
| vitest / jsdom (단위) | 001, 002, 003, 005, 006, 007, 008, 009, 010, 011, 013, 014, 015, 016 | `src/test/aiSelectionToolbar.test.ts` — `mouseenter` → `click` 순서를 **명시적으로 dispatch**해 실제 포인터 시퀀스를 재현 | **실제 포인터의 이벤트 순서를 보장하지 못한다.** jsdom은 합성 이벤트만 다루므로, 테스트가 순서를 직접 써 준 것에 불과하다. 현재 결함이 초록으로 통과한 이유가 정확히 이것이다(`:910`, `:926`이 `click` 단독 dispatch) |
| Playwright (E2E) | 001, 002, 004, 011, 012, 022 | `e2e/ai-inline-edit.spec.ts` — `locator.click()`이 CDP를 통해 **실제 마우스 이동 + 클릭**을 주입하므로 `mouseenter` → `click`이 브라우저에 의해 자연 발화 | Tauri 실제 웹뷰(WKWebView/WebView2)가 아니라 Chromium이다. 플랫폼별 포커스·Tab 순회 차이는 증명 못 함 |
| 수동 점검 (실기기) | 004, 007, 013 + 체감 | 실제 `mdedit` 앱에서 마우스로 트리거 클릭 / 물리 키보드 Tab·방향키 / 포인터 이탈 닫힘 확인 | 자동 회귀 불가 — 체크리스트 기록으로만 남는다 |
| 코드 리뷰 (diff) | 017, 018, 019, 020, 021 | `click`·`mouseenter` 핸들러 존치 확인, `pointerType`/`matchMedia` 도입 0건, `EditorToolbar.tsx`·`menuPlacement.ts`·`package.json`·`Cargo.toml` diff 0줄 | — |
| 회귀 게이트 | 016, 020, 021 | `npm run typecheck` + `npm test` + `npm run lint` + `npm run test:e2e` 전체 통과 | — |

> **[HARD] 핵심 검증 원칙**: 단위 테스트만으로는 이 결함의 재발을 막을 수 없다. 실제 포인터 클릭이 서브메뉴를 열어 둔 채 유지하는지는 **Playwright 계층이 유일한 실질 가드**다. 단위 테스트의 `mouseenter`+`click` 명시 dispatch는 회귀 탐지에 유용하지만, 브라우저의 실제 이벤트 순서를 증명하는 것이 아니라 **가정을 문서화**하는 것임을 정직하게 인정한다.

## Acceptance Criteria

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-AI-011-001 | REQ-001, 002, 003 | `mouseenter` → `click`을 순서대로 발화시켰을 때 서브메뉴가 **열린 채로 남고**(`aria-expanded="true"`), 열린 상태에서 클릭을 반복해도 닫히지 않으며, 어느 경로에서도 `onSelectPreset`이 호출되지 않는다 |
| AC-AI-011-002 | REQ-004, 018 | `mouseenter` 단독으로 서브메뉴가 열린다(SPEC-AI-008 REQ-006 회귀 없음). Playwright 실제 포인터 `hover()`에서도 동일 |
| AC-AI-011-003 | REQ-005, 006 | 서브메뉴 컨테이너 `role="menu"`; 8개 항목 각각 `role="menuitem"`; `aria-expanded`가 서브메뉴 DOM 존재 여부와 항상 일치. 트리거 `aria-haspopup`은 **`"true"` 그대로 유지**(기존 테스트 `aiSelectionToolbar.test.ts:905` 무변경 통과) |
| AC-AI-011-004 | REQ-007, 017 | 트리거에 포커스를 준 뒤 Enter(및 Space)로 활성화하면 서브메뉴가 열리고 `document.activeElement`가 **첫 항목("자동")** 이다. `click` 리스너가 존치한다(diff 확인) |
| AC-AI-011-005 | REQ-008, 009 | 닫힌 트리거에서 ArrowDown → 열림 + 첫 항목 포커스, ArrowUp → 열림 + 마지막 항목 포커스. 열린 서브메뉴에서 ArrowDown/ArrowUp이 8항목을 **래핑 순환**(마지막→첫, 첫→마지막)하며 `preventDefault`된다 |
| AC-AI-011-006 | REQ-010 | 서브메뉴 항목에 포커스를 두고 Enter(및 Space)를 누르면 `onSelectPreset`이 **정확히 1회** 호출된다(이중 발화 없음) |
| AC-AI-011-007 | REQ-011 | 서브메뉴 열림 상태에서 Escape → 서브메뉴만 닫히고 `document.activeElement`가 트리거로 복귀, 상위 프리셋 목록·툴바 유지 |
| AC-AI-011-008 | REQ-012, 015 | 툴바 외부 mousedown → 서브메뉴 + 상위 메뉴 함께 닫힘. 서브메뉴가 열린 동안에도 상위 프리셋 항목(예: "다듬기")이 클릭으로 발행 가능하며, 차단 오버레이가 DOM에 존재하지 않는다 |
| AC-AI-011-009 | REQ-013 | 트리거 hover로 서브메뉴를 연 뒤 포인터가 같은 목록의 다른 프리셋 항목으로 이동하면 서브메뉴가 닫힌다(`aria-expanded="false"`, 서브메뉴 DOM 제거) |
| AC-AI-011-010 | REQ-014 | 선택 길이 4001자(다이어그램 프리셋 disabled)에서 hover·클릭·Enter·ArrowDown 어느 입력으로도 서브메뉴가 생성되지 않는다 |
| AC-AI-011-011 | REQ-016, 021 | "자동" 선택 → `onSelectPreset('diagram', undefined)`, 7종 각각 → `onSelectPreset('diagram', <type>)` (SPEC-AI-008 기존 테스트 무변경 통과). `package.json`·`Cargo.toml`·`src-tauri/src/ai/**` diff 0줄, `markdownKeyBindings` 무변경 |
| AC-AI-011-012 | REQ-019, 020 | `pointerType`·`matchMedia`·터치 감지 휴리스틱 신규 도입 0건(grep). `EditorToolbar.tsx`·`src/lib/ui/menuPlacement.ts` diff 0줄이며 관련 기존 테스트(`menuPlacement.test.ts`, `diagramMenuPlacement.test.tsx`) 무변경 통과 |
| AC-AI-011-013 | REQ-022 | `e2e/ai-inline-edit.spec.ts`의 다이어그램 테스트가 트리거를 **`click()`으로** 열고 서브메뉴가 보인 채 유지됨을 단언한다. `:193-195`의 "알려진 UI 결함" 우회 주석이 제거·갱신되어 현재 결함을 서술하지 않는다 |

| AC-AI-011-014 | REQ-023 | 같은 PR 안에서 `.moai/specs/SPEC-AI-008-diagram-type-picker/spec.md`의 REQ-AI-008-006/007/013 및 AC-AI-008-001/009가 개정되어 있고 HISTORY 항목이 추가되어 있다. `grep -n "토글" .moai/specs/SPEC-AI-008-diagram-type-picker/spec.md`가 서브메뉴 클릭 동작을 "토글"로 서술하는 잔존 문장을 반환하지 않는다 |

REQ 커버리지 대조(001–023 전수): 001→AC1, 002→AC1, 003→AC1, 004→AC2, 005→AC3, 006→AC3, 007→AC4, 008→AC5, 009→AC5, 010→AC6, 011→AC7, 012→AC8, 013→AC9, 014→AC10, 015→AC8, 016→AC11, 017→AC4, 018→AC2, 019→AC12, 020→AC12, 021→AC11, 022→AC13, 023→AC14. **미커버 REQ 없음.**

**Quality Gates (AC 외 공통 게이트)**: `npm run typecheck`(`tsc --noEmit`) 클린 + `npm test`(vitest) 전체 통과 + `npm run lint` 통과 + `npm run test:e2e`(Playwright) 전체 통과.

## Risks & Regression Watchlist

| # | 위험 | 왜 위험한가 | 완화 |
|---|------|-------------|------|
| R1 | **기존 단위 테스트가 금지 동작을 단언 중** | `aiSelectionToolbar.test.ts:926-934`는 "클릭이 토글로 닫는다"를 명시적으로 단언한다. 이 테스트를 그대로 두면 올바른 구현이 **테스트 실패로 거부**된다. 반대로 무비판적으로 지우면 회귀 가드가 사라진다 | Delta에 명시적 [MODIFY]로 등재. 삭제가 아니라 **열기 전용 계약으로 재작성**(AC-001) |
| R2 | **REQ-013 닫기 경로 과잉 발화** | 트리거와 서브메뉴 사이에 CSS 간극(`SUBMENU_GAP = 4px`, `ai-selection-toolbar.ts:313`)이 있어, 포인터가 트리거→서브메뉴로 이동하는 도중 간극을 지나며 "이탈"로 오판되면 서브메뉴가 **사용자 눈앞에서 닫힌다**. 이 결함은 현재 hover 경로(유일하게 동작하는 포인터 경로)를 직접 깨뜨린다 | 닫기 판정을 트리거 단독 `mouseleave`가 아니라 **래퍼(`.mdedit-ai-diagram-wrap`) 또는 "다른 프리셋 항목 진입"** 기준으로 정의(REQ-013 문언이 이미 후자). AC-009 + 수동 점검으로 검증 |
| R3 | **Escape 이벤트 경합** | 서브메뉴 항목에 포커스가 있을 때의 Escape는 `dom`의 keydown 핸들러(`:662`)로 버블링되어 처리된다. 서브메뉴에 자체 keydown 리스너를 추가하면서 `stopPropagation`을 잘못 넣으면 Escape가 상위에 도달하지 못해 **복귀 경로가 죽는다** | REQ-011 + AC-007로 고정. 서브메뉴 keydown은 방향키·Enter·Space만 소비하고 Escape는 통과시킨다 |
| R4 | **Enter/Space 이중 발화** | 네이티브 `<button>`은 Enter/Space에서 `click`을 자동 합성한다. 커스텀 keydown이 `preventDefault` 없이 선택을 호출하면 **요청이 2회 발행**된다(비용 있는 AI 호출) | REQ-010 + AC-006(정확히 1회 호출 단언). `EditorToolbar.tsx:326-329` 선례 그대로 이식 |
| R5 | **포커스 이동과 rAF 배치 측정의 경합** | `openDiagramSubmenu()`는 `scheduleSubmenuFlipMeasurement`로 다음 프레임에 위치를 재계산한다(`:550`). 열자마자 첫 항목에 `.focus()`를 걸면 브라우저가 아직 배치되지 않은 요소로 스크롤을 유발할 수 있다 | Run phase에서 `focus({ preventScroll: true })` 사용 검토. AC-004는 `activeElement`만 단언하므로 계약과 충돌 없음 |
| R6 | **Playwright 실기기 괴리** | Playwright는 Chromium이고 Tauri는 WKWebView/WebView2다. 특히 macOS에서 "전체 키보드 접근"이 꺼져 있으면 `<button>`이 Tab 순회에 참여하지 않아 **키보드로 트리거에 도달 자체가 불가**할 수 있다 | 방향키·Enter 경로는 명시적 `.focus()`로 이동하므로 영향 적음. 수동 점검 항목에 macOS 실기기 Tab 확인을 포함(정직하게 "자동 증명 불가"로 분류) |
| R7 | **SPEC-AI-008 문서 드리프트** | 본 SPEC이 REQ-AI-008-007을 실질 개정한다. 개정이 늦어지면 두 SPEC이 모순된 상태로 공존해 다음 세션이 "토글이 맞다"고 되돌릴 수 있다 | **개정 (a)~(e)를 run 단계 구현 순서의 마지막 작업으로 편입**하여 모순 공존 기간을 0으로 만든다(Delta에 AI-008 파일 [MODIFY] 등재, plan.md 9단계). 개정 문언은 HISTORY에 확정 기록. 추가로 코드에 `@MX:WARN`으로 클릭-토글 금지 계약을 각인해 이중 방어 |
| R8 | **터치 동작 미검증** | "열기 전용 의미론이 터치도 함께 고친다"는 것은 합성 마우스 이벤트 순서에 대한 **추론이며 실기기 검증을 하지 않았다.** WebView 구현별로 합성 `mouseenter` 발생 여부가 다를 수 있어, 터치 디바이스에서 결함이 남아 있을 가능성을 배제할 수 없다 | 데스크톱 Tauri 앱이므로 우선순위 낮음으로 수용. **미검증 사실 자체를 명시**하고 수동 체크리스트에 넣지 않는다(검증하지 않은 것을 검증했다고 적지 않는다). 터치 결함이 실제 보고되면 별도 SPEC으로 다룬다 |

## Exclusions (What NOT to Build)

- **AI 요청 페이로드·프롬프트 조립 변경 없음** — `src-tauri/src/ai/prompt.rs`, `mod.rs`, IPC `AiRequestArgs`, `buildSelectionRequest` 무변경. "자동"의 종류 없는 발행과 7종의 `diagramType` 발행 계약은 SPEC-AI-008 그대로다.
- **다이어그램 종류 목록 변경 없음** — 서브메뉴는 정확히 8항목(자동 + 7종)으로 고정. 나머지 17종 mermaid 유형 미추가(SPEC-AI-008 REQ-022 계승).
- **타 팝오버 리팩터 없음** — `EditorToolbar.tsx`의 `TableGridPicker`·`DiagramInsertMenu`, `menuPlacement.ts` 무변경. Popover Audit 결과 동일 충돌이 없으므로 손대지 않는다. 두 팝오버의 키보드/ARIA 개선도 범위 밖이다.
- **React 리라이트 없음** — 서브메뉴는 명령형 DOM 패턴 유지. floating-ui·포털·헤드리스 메뉴 라이브러리 미도입.
- **완전한 WAI-ARIA menu 패턴 구현 없음** — roving tabindex(`tabindex="-1"` + 단일 진입점), 타입어헤드(문자 입력 점프), `aria-activedescendant`는 범위 밖이다. 본 SPEC은 `role` 부여 + 방향키 순환 + 포커스 진입/복귀까지만 명세하며, 이는 저장소 선례(`EditorToolbar.tsx:316-330`)와 동일한 수준이다.
- **hover intent 지연 도입 없음** — SPEC-AI-008 Design Notes의 ~120ms 지연은 여전히 미구현이며 본 SPEC도 도입하지 않는다(타이밍 의존은 Rejected Alternatives (e)).
- **터치/펜 전용 경로 없음** — Touch/Pen Scope 절 참조. 터치 전용 닫기 어포던스나 `pointerType` 분기 미도입.
- **서브메뉴 배치 로직 변경 없음** — `scheduleSubmenuFlipMeasurement`, `computeFlyoutOffset`, `SUBMENU_GAP` 값 무변경(R2 완화가 CSS 간극 조정을 요구하는 경우에 한해 최소 조정 허용).
- **AI 토글 동작 변경 없음** — SPEC-AI-005 `effectiveAiEnabled` OFF 시 툴바 미노출 계약 무변경.
- **Rust 백엔드 무변경** — `src-tauri/` 미접촉.
- **`aria-haspopup` 표기 변경 없음** — 트리거는 현행 `"true"`를 유지한다. ARIA 사양상 `"menu"`와 동치라 기능 효과가 0인데 기존 테스트까지 건드리게 되므로, 표기 통일만을 위한 diff는 만들지 않는다. `role="menu"`/`role="menuitem"` 추가(REQ-005)는 실제 접근성 효과가 있으므로 범위에 남는다.
- **SPEC-AI-008 개정은 plan 단계 작업이 아님** — 개정 문언 5건(a~e)은 확정해 두되, `.moai/specs/SPEC-AI-008-diagram-type-picker/`의 실제 파일 편집은 **run 단계**에서 본 SPEC 구현과 같은 PR로 수행한다(REQ-023). plan 단계인 현 시점에서는 편집하지 않는다.

## References

- SPEC-AI-008 — 다이어그램 종류 플라이아웃 서브메뉴(본 SPEC이 개정하는 REQ-006/007/013, AC-001/009의 원천)
- SPEC-UI-008 — 수동 삽입 다이어그램 드롭다운. `EditorToolbar.tsx:316-330`의 방향키 순환 + `role="menu"`/`role="menuitem"` **참조 구현**
- SPEC-AI-005 — AI 토글(`effectiveAiEnabled`)과 툴바 노출 게이트
- SPEC-AI-007 — 선택 길이 가드(프리셋 disabled 상태, REQ-014의 전제)
- SPEC-E2E-001 — Playwright 스위트 및 `tauri-mock` 픽스처 규약
- `src/components/editor/extensions/ai-selection-toolbar.ts:604-608` — 결함 지점(hover/click 충돌)
- `src/components/editor/extensions/ai-selection-toolbar.ts:512-556` — `closeDiagramSubmenu` / `openDiagramSubmenu` / `toggleDiagramSubmenu`
- `src/components/editor/extensions/ai-selection-toolbar.ts:662-679` — `handleKeyDown`(Escape 전용, 방향키 부재)
- `src/components/editor/EditorToolbar.tsx:316-330` — 이식 대상 키보드 내비게이션 선례
- `src/test/aiSelectionToolbar.test.ts:910-934` — 결함을 놓친 기존 단위 테스트(재작성 대상)
- `e2e/ai-inline-edit.spec.ts:191-203` — 결함 우회 주석 + hover-only 시퀀스(갱신 대상)
