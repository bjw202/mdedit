# SPEC-AI-011 — 구현 계획

> 대상: AI 선택 툴바 "🧜 다이어그램으로" 트리거의 hover/click 충돌 해소 + 서브메뉴 키보드 내비게이션 신설. 순수 프론트엔드 상호작용·접근성 수정이며 Rust·프롬프트·IPC는 접근하지 않는다.

## 핵심 문제 요약 (Root Cause)

실제 포인터 클릭의 DOM 이벤트 순서는 `mouseenter` → `mousedown` → `mouseup` → `click`으로 고정되어 있다. `ai-selection-toolbar.ts:606-607`이 앞의 `mouseenter`에 "열기"를, 뒤의 `click`에 "토글"을 바인딩했으므로 **모든 실제 마우스 클릭은 열었다가 곧바로 닫는다** — 순 효과 no-op.

키보드 Enter/Space는 `mouseenter` 없이 `click`만 합성 발화하므로 토글이 닫힌 상태에서 호출되어 정상 동작한다. **결함은 포인터 한정, 키보드는 정상.** 이 비대칭성이 (1) "click 핸들러 삭제" 수정을 회귀로 만들고, (2) 기존 단위 테스트가 초록인 채로 결함을 통과시킨 원인이다.

근본적으로 이것은 SPEC-AI-008의 **명세 충돌**이다 — REQ-AI-008-006(hover 열림)과 REQ-AI-008-007(클릭 토글)은 포인터 입력에서 동시 만족 불가능하다. REQ-007의 전제절 "hover 불가 환경에서"는 런타임에 판별할 수 없다.

## 결정 사항 (Decisions)

### D1 — 트리거 클릭은 열기 전용(open-only)으로 만든다

닫힌 서브메뉴에 대한 클릭은 연다. **이미 열려 있는 서브메뉴에 대한 클릭은 무시한다**(닫지 않는다).

근거: 열기 연산이 **멱등**해지므로, `mouseenter`와 `click`이 같은 제스처에서 연달아 발화해도 결과가 "열림"으로 수렴한다. 입력 종류를 판별할 필요가 없다. 관례적 데스크톱 메뉴(부모 항목은 열기만 하고 닫지 않음)와 일치하며, SPEC-AI-008 REQ-006(hover로 열림)과 REQ-007의 취지(클릭으로 도달 가능 + 즉시 발행 안 함)를 **둘 다** 보존한다.

기각한 대안 (a)(b)(c)(d)(e)는 `spec.md`의 Rejected Alternatives 표에 사유와 함께 기록됨 — 재검토 금지.

### D2 — `click` 핸들러는 반드시 존치한다

핸들러를 삭제하는 대신 콜백만 `toggleDiagramSubmenu` → `openDiagramSubmenu`로 교체한다.

근거: 키보드 Enter/Space는 `click` 이벤트로만 도달한다. 삭제하면 키보드 사용자가 서브메뉴를 여는 유일한 수단을 잃는다 — 현재 **정상 동작 중인** 경로를 깨는 회귀다(REQ-017).

### D3 — `toggleDiagramSubmenu()` 함수 자체를 제거한다

열기 전용 전환 후 이 함수의 호출자는 0이 된다. 남겨 두면 "죽은 API"가 되고, 다음 세션이 이를 다시 배선해 결함을 부활시킬 수 있다.

근거: 프로젝트 규약 — 채택되지 않은 안을 계약·인터페이스에 잔재로 남기지 않는다. 열기·닫기는 `openDiagramSubmenu` / `closeDiagramSubmenu` 두 함수로 충분하다.

### D4 — 포인터 닫기 경로를 신설한다(REQ-013)

D1이 클릭-토글을 없애면 **포인터만으로 서브메뉴를 닫을 수단이 외부 클릭뿐**이 된다(현재 코드에 `mouseleave` 닫기가 전혀 없음). 여기에 더해 진단 단계에서 **이 플라이아웃이 좁은 폭에서 좌측으로 flip될 때 트리거 행 전체를 시각적으로 덮는 것**이 확인되었다(`scheduleSubmenuFlipMeasurement` → `computeFlyoutOffset`의 flip→clamp 경로). 서브메뉴가 열린 채 방치되면 상위 프리셋 항목을 가려 **REQ-015(서브메뉴 열린 중에도 상위 항목 클릭 가능)와 정면 충돌**한다. 따라서 "다른 프리셋 항목으로 포인터 이동 시 닫힘"은 D1의 **필수 짝**이지 부가 기능이 아니다.

판정 기준은 트리거 단독 `mouseleave`가 **아니라** "같은 프리셋 목록의 다른 항목에 진입"으로 정의한다. 트리거와 서브메뉴 사이에 `SUBMENU_GAP = 4px`(`:313`) 간극이 있어, 트리거 `mouseleave`를 쓰면 포인터가 트리거→서브메뉴로 이동하는 도중 서브메뉴가 눈앞에서 닫힌다(R2).

구현 후보(Run 재량):
- (i) 다른 프리셋 `<button>` 각각에 `mouseenter` → `closeDiagramSubmenu()` 바인딩 — 간극 문제 없음, 가장 단순.
- (ii) 래퍼(`.mdedit-ai-diagram-wrap`)의 `mouseleave` + `relatedTarget`이 서브메뉴 내부가 아닌지 검사.

(i)을 권장한다 — 간극과 무관하고 판정이 이진이다.

### D5 — 키보드 내비게이션은 `EditorToolbar.tsx:316-330` 패턴을 이식한다

새 관례를 발명하지 않는다. SPEC-UI-008이 이미 확립한 계약을 명령형 DOM으로 옮긴다:

- ArrowDown/ArrowUp → `preventDefault()` 후 `(activeIndex + delta + len) % len`로 **래핑 순환** 포커스.
- Enter/Space → `preventDefault()` 후 선택 호출. `preventDefault`가 네이티브 `<button>`의 `click` 합성을 막아 **이중 발행을 차단**한다(R4 — AI 요청은 비용이 있으므로 2회 발행이 실질 피해).

추가로 명령형 컨텍스트에서 필요한 것:
- 트리거 자체의 `keydown`: 닫힌 상태 ArrowDown → 열고 첫 항목, ArrowUp → 열고 마지막 항목(REQ-008).
- `click`(= Enter/Space 활성화 포함) 시 열림 후 첫 항목으로 포커스 이동(REQ-007). 현재는 어떤 코드도 서브메뉴 항목에 `.focus()`를 호출하지 않는다.

### D6 — Escape는 서브메뉴 리스너가 소비하지 않는다

서브메뉴 keydown 리스너는 ArrowDown/ArrowUp/Enter/Space만 처리하고 Escape는 그대로 버블링시킨다.

근거: Escape 복귀는 `dom`의 기존 `handleKeyDown`(`:662-669`)이 이미 올바르게 처리하고 있다(서브메뉴만 닫고 `closeDiagramSubmenu(true)`로 트리거 포커스 복귀). 서브메뉴에서 `stopPropagation`을 잘못 넣으면 이 경로가 죽는다(R3). **동작하는 코드를 건드리지 않는다.**

### D7 — ARIA는 `role` 부여까지만. `aria-haspopup`은 손대지 않고, roving tabindex는 범위 밖

컨테이너 `role="menu"`, 항목 `role="menuitem"`만 부여한다. `aria-expanded` 동기화는 현행(`:516`, `:547`)이 이미 정확하므로 유지한다.

**`aria-haspopup`은 현행 `"true"`를 그대로 둔다.** ARIA 사양상 `"true"`는 `"menu"`의 별칭이라 `"menu"`로 바꿔도 **기능 효과가 0**인데, 기존 테스트(`aiSelectionToolbar.test.ts:905`)까지 함께 수정해야 한다. 표기 통일만을 위한 diff는 만들지 않는다. 반면 `role="menu"`/`role="menuitem"` 추가는 **실제 접근성 효과가 있으므로** 범위에 남긴다.

roving tabindex(항목에 `tabindex="-1"`, 단일 진입점) · 타입어헤드 · `aria-activedescendant`는 도입하지 않는다 — 저장소 선례(`EditorToolbar.tsx`)도 같은 수준(role + 방향키 래핑)이며, 완전한 WAI-ARIA menu 패턴은 별도 SPEC 사안이다. 현재 항목은 네이티브 `<button>`이라 Tab으로도 순회 가능하며 이 성질을 유지한다.

### D8 — SPEC-AI-008 개정을 run 단계 작업으로 편입한다 (같은 PR)

개정 5건(a~e)을 **구현 순서의 마지막 단계(9)** 로 넣어 본 SPEC 구현과 **같은 PR**에서 적용한다. plan 단계인 현 시점에서는 AI-008 파일을 편집하지 않는다.

근거: 코드는 "클릭=열기 전용"인데 SPEC-AI-008이 "클릭=토글"이라고 서술하는 상태가 단 하루라도 존재하면, 다음 세션이 문서를 근거로 구현을 되돌릴 수 있다(R7). **모순 공존 기간을 0으로 만드는 것**이 리뷰 단위 분리보다 우선한다. 개정 문언은 이미 확정되어 있어 리뷰 부담도 작다. 이중 방어로 코드에는 `@MX:WARN`을 각인한다.

## 코드 변경 지도 (Change Map)

모든 앵커는 조사 시점에 검증된 실제 라인이다.

| # | 파일:라인 | 현재 | 변경 | REQ |
|---|-----------|------|------|-----|
| C1 | `ai-selection-toolbar.ts:553-556` | `toggleDiagramSubmenu()` — 열려 있으면 닫고 아니면 연다 | **함수 제거**(D3). 호출자 0 | 001, 002 |
| C2 | `ai-selection-toolbar.ts:606-607` | `mouseenter`→`open`, `click`→`toggle` | `mouseenter`→`open` **유지**, `click`→`open` + 첫 항목 포커스 이동(D2, D5) | 001~004, 007, 017, 018 |
| C3 | `ai-selection-toolbar.ts:604-608` (신규) | 트리거 `keydown` 없음 | 트리거에 `keydown` 추가 — 닫힌 상태 ArrowDown→열기+첫 항목, ArrowUp→열기+마지막 항목 | 008 |
| C4 | `ai-selection-toolbar.ts:598-599` | `aria-haspopup="true"` | **무변경**(D7 — 기능 효과 0인 표기 diff 금지). `aria-expanded` 로직도 무변경 | 006 |
| C5 | `ai-selection-toolbar.ts:523-524` | `sub.className = '...'` (role 없음) | `sub.setAttribute('role', 'menu')` | 005 |
| C6 | `ai-selection-toolbar.ts:526-529` | 항목 `<button>` + `aria-label`만 | `item.setAttribute('role', 'menuitem')` | 005 |
| C7 | `ai-selection-toolbar.ts:521-551` (신규) | 서브메뉴 `keydown` 없음 | 서브메뉴 컨테이너에 `keydown` — 방향키 래핑 순환 + Enter/Space `preventDefault` 후 단일 선택. **Escape는 통과**(D6) | 009, 010 |
| C8 | `ai-selection-toolbar.ts:521-551` (신규) | 포커스 진입 코드 없음 | 첫/마지막 항목 포커스 헬퍼. rAF 배치 측정(`:550`)과의 경합 대비 `focus({ preventScroll: true })` 검토(R5) | 007, 008 |
| C9 | `ai-selection-toolbar.ts:578-622` (프리셋 루프) | 포인터 닫기 경로 없음 | 다른 프리셋 항목 `mouseenter` → `closeDiagramSubmenu()`(D4 후보 i) | 013 |
| C10 | `ai-selection-toolbar.ts:489-492` | `@MX:NOTE` — "hover/클릭이 이 서브메뉴를 열고" | 열기 전용 불변식 반영해 갱신 + `@MX:WARN` 신설(아래 @MX 절) | — |
| C11 | `ai-selection-toolbar.ts:686-694` (`destroy`) | `closeDiagramSubmenu()` + `dom` keydown 해제 | C7/C9가 추가한 리스너 정리 확인(SPEC-AI-008 REQ-015 누수 없음 계약 유지) | — |
| C12 | `src/styles/mdedit-components.css:444-464` | 서브메뉴/래퍼 스타일 | R2 완화가 필요한 경우에 한해 최소 조정. 토큰·`currentColor`만 | 013 |
| C13 | `src/test/aiSelectionToolbar.test.ts:926-934` | `'click toggles the submenu open then closed'` — **금지 동작을 단언 중** | 열기 전용 계약으로 **재작성**(삭제 아님) | 002 |
| C14 | `src/test/aiSelectionToolbar.test.ts:910-924` | `click` 단독 / `mouseenter` 단독 dispatch | `mouseenter` → `click` **순서 재현** 테스트 신규 추가 | 001 |
| C15 | `src/test/aiSelectionToolbar.test.ts` (신규 describe) | 없음 | ARIA role, 방향키 순환, Enter/Space 단일 발화, 포커스 진입/복귀, 다른 프리셋 hover 닫힘 | 005~010, 013 |
| C16 | `e2e/ai-inline-edit.spec.ts:191-203` | hover-only 우회 + "알려진 UI 결함" 주석 | `click()` 경로 행사 + 주석 갱신 | 022 |
| C17 | `.moai/specs/SPEC-AI-008-diagram-type-picker/spec.md` | REQ-006/007/013, AC-001/009가 "클릭 토글"을 서술 | 개정 문언 (a)~(e) 적용 + HISTORY 항목 추가 + `version`/`updated` 갱신(`status: draft` 유지) | 023 |
| C18 | `.moai/specs/SPEC-AI-008-diagram-type-picker/acceptance.md` | AC-001/009 대응 항목이 토글·Tab만 서술 | 열기 전용 + 방향키 순환에 맞춰 갱신 | 023 |

**무변경 확인 대상(diff 0줄)**: `src/components/editor/EditorToolbar.tsx`, `src/lib/ui/menuPlacement.ts`, `src/lib/tauri/ipc.ts`, `src-tauri/**`, `package.json`, `src-tauri/Cargo.toml`.

## 구현 순서 (Implementation Ordering)

의존성 기반 순서. 각 단계는 독립 커밋 가능하며 앞 단계가 초록이어야 다음으로 간다.

1. **테스트 계약 먼저 뒤집기 (C13, C14)** — 기존 `:926` 토글 테스트를 열기 전용 계약으로 재작성하고, `mouseenter` → `click` 순서 재현 테스트를 추가한다. 이 시점에 **두 테스트 모두 실패해야 한다**(빨강 확인 = 재현 성공). 실패하지 않으면 재현이 잘못된 것이므로 멈춘다.
2. **열기 전용 전환 (C1, C2)** — `toggleDiagramSubmenu` 제거, `click`을 `openDiagramSubmenu`로. 1의 테스트가 초록으로 전환된다. **여기까지가 결함 수정의 최소 단위**이며 단독 릴리스 가능하다.
3. **ARIA role 부여 (C5, C6)** — 컨테이너 `role="menu"` + 항목 `role="menuitem"`. 순수 속성 추가로 동작 변화 없음. `aria-haspopup`은 건드리지 않는다(C4 = 무변경, D7). 테스트 추가(C15 일부).
4. **키보드 내비게이션 (C7, C8, C3)** — 서브메뉴 keydown → 트리거 keydown → 포커스 진입 순. Escape 회귀(C7에서 `stopPropagation` 금지)를 각 단계마다 기존 Escape 테스트(`:427`, `:451` 인접)로 확인.
5. **포인터 닫기 경로 (C9, C12)** — D4 후보 (i) 배선. 수동으로 트리거→서브메뉴 이동이 조기에 닫히지 않는지 확인(R2).
6. **정리 검증 (C11)** — `destroy()` 리스너 누수 확인.
7. **@MX 태그 갱신 (C10)**.
8. **E2E 갱신 (C16)** — 실제 포인터 클릭이 열린 채 유지됨을 증명하는 유일한 계층.
9. **SPEC-AI-008 개정 적용 (C17, C18)** — 후속 액션 표 (a)~(e)의 확정 문언을 그대로 적용하고 HISTORY 항목을 추가한다. **같은 PR에 포함**하여 코드와 문서가 모순되는 기간을 0으로 만든다(D8, REQ-023, AC-014). 완료 후 `grep -n "토글" .moai/specs/SPEC-AI-008-diagram-type-picker/spec.md`로 잔존 문장이 없는지 확인한다.

## 테스트 계획

### 계층별로 무엇을 실제로 증명할 수 있는가 (정직한 구분)

| 계층 | 증명 가능 | 증명 **불가** |
|------|-----------|----------------|
| **vitest / jsdom** | 열기 전용 상태 기계(열림→클릭→여전히 열림), ARIA 속성값, 방향키 인덱스 순환, Enter/Space 호출 횟수, 포커스 대상(`document.activeElement`), 리스너 정리 | **실제 브라우저의 이벤트 순서.** jsdom은 합성 이벤트만 다룬다 — 테스트가 `mouseenter` 다음에 `click`을 쓴 것은 *가정의 문서화*이지 브라우저 동작의 증명이 아니다. **현재 결함이 초록으로 통과한 이유가 정확히 이것**(`:910`, `:926`이 `click` 단독 dispatch) |
| **Playwright (Chromium)** | 실제 포인터 클릭 회귀 — `locator.click()`은 CDP로 마우스 이동+클릭을 주입하므로 `mouseenter` → `click`이 **브라우저에 의해** 발화된다. hover 열림, Escape, 외부 클릭 | Tauri 실제 웹뷰(WKWebView/WebView2)가 아님. 플랫폼별 포커스·Tab 순회 차이 |
| **수동 (실기기)** | macOS/Windows 실제 앱에서의 포인터 체감, 물리 키보드 Tab 도달성, 포인터 이탈 닫기의 조기 발화 여부 | 자동 회귀 불가 — 체크리스트 기록만 |
| **코드 리뷰 (diff)** | `click`/`mouseenter` 핸들러 존치, `pointerType`/`matchMedia` 0건, 타 팝오버·Rust 무변경 | — |

### [HARD] 계층 배정 원칙 — 포인터 상호작용 요구는 jsdom에 배정하지 않는다

> 이것은 테스트 하나를 고치는 문제가 아니라 **앞으로 지켜야 할 계층 배정 원칙**이다. 이번 결함이 정확히 이 원칙을 어겨서 발생했으므로, 근거와 함께 못 박아 둔다.

**원칙**: 포인터 제스처의 이벤트 순서에 의존하는 요구(hover로 열고 click으로 조작하는 메뉴, 드래그, 이탈 판정 등)는 **vitest/jsdom 단위 테스트에 배정하지 않는다.** 반드시 Playwright 계층에 must-pass로 배정하고, 단위 테스트는 보조 상태 기계 가드로만 쓴다.

**근거 (이번 사례가 바로 그 증거)**:

- `element.dispatchEvent(new MouseEvent('click'))`는 `mouseenter`를 선행 발화하지 **않는다**. jsdom은 합성 이벤트를 던진 그대로 전달할 뿐, 브라우저의 포인터 상태 기계를 모사하지 않는다.
- 그 결과 `aiSelectionToolbar.test.ts:910`("클릭하면 서브메뉴가 열린다")과 `:926`("클릭 토글")은 **실질적으로 키보드 경로만 검증하고 있었다** — Enter/Space가 `mouseenter` 없이 `click`만 발화시키는 것과 동일한 조건이기 때문이다.
- SPEC-AI-008은 REQ-006(hover 열림)·REQ-007(클릭 토글)을 모두 AC-AI-008-001에 걸어 두었지만, 그 AC를 **전부 jsdom에 배정**했다. 두 요구가 같은 제스처에서 충돌한다는 사실은 원리적으로 jsdom에서 드러날 수 없다. **테스트 스위트는 초록이었고 기능은 사용자에게 완전히 깨져 있었다.**
- 즉 이번 결함은 "구현 실수를 테스트가 못 잡았다"가 아니라 **"검증 계층을 잘못 배정해서 검증한 적이 없었다"** 에 가깝다.

**적용 방법**:

- 단위 테스트에서 포인터 경로를 다룰 때는 `mouseenter` → `click`을 **명시적으로 순서대로** dispatch하고, 그것이 브라우저 동작의 증명이 아니라 **가정의 문서화**임을 테스트 주석이나 SPEC에 밝힌다.
- 새 SPEC에서 hover 관련 REQ를 쓸 때는 Verification Strategy 표에서 해당 REQ의 강제 수단이 jsdom 단독이 아닌지 확인한다. jsdom 단독이면 그 REQ는 사실상 미검증이다.
- C13(기존 토글 테스트 재작성)은 이 원칙의 **한 사례일 뿐**이다. 재작성으로 끝내지 말고 대응하는 Playwright 어서션(A1-2)을 반드시 함께 둔다.

이 한계를 숨기지 않고 `acceptance.md`의 must-pass 배정(AC-001에 Playwright 포함)에 반영한다.

### 단위 테스트 설계 (vitest, `aiSelectionToolbar.test.ts`)

기존 `describe('createPresetMenu: diagram type flyout submenu (SPEC-AI-008)')`(`:887`)의 `build()` 헬퍼를 재사용한다.

- **열기 전용 (C14)**: `trigger.dispatchEvent(new MouseEvent('mouseenter'))` → `trigger.dispatchEvent(new MouseEvent('click'))` → 서브메뉴 DOM 존재 + `aria-expanded === 'true'`. 이어 `click`을 2회 더 던져도 여전히 존재.
- **재작성 (C13)**: `:926`의 "open then closed"를 "open then still open"으로. 테스트 이름도 계약을 서술하도록 변경.
- **발행 없음**: 위 모든 단계에서 `callbacks.onSelectPreset` 호출 0회.
- **ARIA**: `sub.getAttribute('role') === 'menu'`; 8개 항목 전부 `role === 'menuitem'`. 트리거 `aria-haspopup`은 **`'true'` 그대로**이며 기존 테스트(`:905`)가 무변경 통과해야 한다(D7).
- **방향키**: 열린 상태에서 첫 항목 `.focus()` 후 ArrowUp keydown → `activeElement`가 8번째 항목(래핑). 마지막에서 ArrowDown → 첫 항목.
- **트리거 방향키**: 닫힌 상태 트리거에 ArrowDown → 열림 + `activeElement` = 첫 항목. ArrowUp → 열림 + 마지막 항목.
- **Enter/Space 단일 발화**: 항목에 포커스 후 `keydown` Enter → `onSelectPreset` 호출 횟수 **정확히 1**. (jsdom은 keydown에서 click을 자동 합성하지 않으므로 이 테스트는 이중 발화를 완전히 증명하지 못한다 — 명시적 한계로 기록하고, `preventDefault()` 호출 여부를 함께 단언해 계약을 고정한다.)
- **Escape 회귀**: 서브메뉴 항목에 포커스가 있는 상태의 Escape가 여전히 서브메뉴만 닫고 트리거로 포커스를 되돌리는지(기존 `:662-669` 경로가 죽지 않았는지).
- **다른 프리셋 hover 닫힘**: 트리거 `mouseenter` → 다른 프리셋 버튼 `mouseenter` → 서브메뉴 DOM 제거 + `aria-expanded === 'false'`.
- **disabled 게이트**: `build(4001)`에서 트리거가 disabled이고 hover/click/keydown 어느 것도 서브메뉴를 만들지 않음.
- **페이로드 회귀**: 기존 `:979`("자동" → `('diagram', undefined)`)와 `:990`(7종 각각)이 **무변경 통과**.

### Playwright 설계 (`e2e/ai-inline-edit.spec.ts`)

기존 다이어그램 테스트(`:184`)의 시퀀스를 다음으로 교체한다:

```
sparkle 클릭 → 프리셋 메뉴 → diagramTrigger.click()   // hover() 대신 click()
→ expect(diagramSubmenu).toBeVisible()                 // 열린 채 유지 = REQ-001/002
→ (선택) 한 번 더 click() 후에도 여전히 visible        // 토글 닫힘 회귀 가드
→ [data-diagram-auto="true"] 클릭 → 카드 흐름은 기존 그대로
```

`:191-195` 주석은 "알려진 결함이므로 hover만 쓴다"에서 "SPEC-AI-011로 클릭이 열기 전용이 되어 hover·click 양쪽 유효, 클릭-토글로 되돌리지 말 것"으로 갱신한다. **다운스트림 어서션(`ai_request` 2회 호출, 카드 미니 렌더 등)은 전부 무변경**이어야 한다 — 페이로드가 안 바뀌었음의 부수 증명이 된다.

### 기존 테스트 회귀

- `src/test/menuPlacement.test.ts`, `src/test/diagramMenuPlacement.test.tsx` — 배치 로직 무변경이므로 diff 0줄, 무변경 통과.
- `aiSelectionToolbar.test.ts`의 나머지 describe 전체(`extractParagraphContext` ~ `createAiSelectionToolbar`) 무변경 통과.
- `e2e/` 나머지 스펙 무변경 통과.

## @MX Tag Targets

`.claude/rules/moai/workflow/mx-tag-protocol.md` 기준. `code_comments: ko`이므로 태그 설명은 한국어.

현재 `ai-selection-toolbar.ts`의 태그 현황(검증됨): 총 17건, `@MX:ANCHOR` 2건(`:181`, `:875`), `@MX:WARN` 1건(`:168`). 한도(anchor 3 / warn 5) 여유 있음.

| 대상 | 태그 | 사유 |
|------|------|------|
| `:489-492` 기존 `@MX:NOTE` | **갱신** | 현재 "hover/클릭이 이 서브메뉴를 열고"라고 서술 — 열기 전용 불변식과 "클릭은 닫지 않는다"를 명시하도록 갱신. `@MX:SPEC: SPEC-AI-011` 추가 |
| 트리거 이벤트 바인딩 지점(`:604-608` 부근) | **`@MX:WARN` 신설** | 위험 구역 — `click`을 토글로 되돌리면 실제 포인터에서 열자마자 닫히는 no-op이 부활한다. `@MX:REASON`(**필수**): "실제 포인터 클릭은 mouseenter → click 순으로 발화하므로, 열기(hover) + 토글(click) 조합은 순 no-op가 된다. 열기 전용 멱등 의미론이 유일하게 안전하다. click 핸들러 삭제도 금지 — 키보드 Enter/Space가 도달하는 유일한 이벤트다." `@MX:SPEC: SPEC-AI-011` |
| 서브메뉴 keydown 핸들러(C7) | **`@MX:NOTE` 신설** | Escape를 소비하지 않고 통과시키는 계약(D6) + Enter/Space `preventDefault`로 이중 발행 차단(R4)을 각인. `@MX:SPEC: SPEC-AI-011` |
| `createPresetMenu`(`:479`) | ANCHOR **불필요** | fan_in 검증 결과 비테스트 호출자 1건(`:802`)뿐 — 임계값(3) 미달. 기존 태그 유지 |
| `openDiagramSubmenu` / `closeDiagramSubmenu` | ANCHOR **보류** | 변경 후 호출 지점이 늘어나므로 Run phase에서 fan_in 재측정. 3 이상이면 `@MX:ANCHOR` + `@MX:REASON` 부여, 미만이면 NOTE 유지 |

`@MX:TODO`는 생성하지 않는다(미완 작업 없음 — SPEC-AI-008 개정은 아래 표대로 구현 순서 9단계에서 완결된다).

## SPEC-AI-008 개정 문언 (구현 순서 9단계 작업 — 같은 PR)

plan 단계인 현 시점에서는 `.moai/specs/SPEC-AI-008-diagram-type-picker/` 파일을 편집하지 않는다. 아래 5건은 **run 단계 마지막 작업(C17, C18)** 으로 본 SPEC 구현과 같은 PR에서 적용한다(D8, REQ-023, AC-014):

| # | 대상 | 현재 문언 | 개정 문언 |
|---|------|-----------|-----------|
| a | `spec.md` REQ-AI-008-007 | "플라이아웃 서브메뉴를 **토글(열림↔닫힘)** 한다" | "플라이아웃 서브메뉴를 **연다. 이미 열려 있으면 상태를 바꾸지 않는다**"(전제절 "hover 불가 환경에서"도 삭제 — 런타임 판별 불가) |
| b | `spec.md` REQ-AI-008-006 | "hover 가능 포인터가 … 올라오면 … 연다" | 유지하되 "hover 열림과 클릭 열림은 상호 배타적이지 않으며 둘 다 멱등 열기 연산이다" 명확화 추가 |
| c | `spec.md` REQ-AI-008-013 | "키보드(Tab / Enter / Space)로 조작하면 … 포커스를 이동시키고" | "Tab / **방향키** / Enter / Space" + `role="menu"`/`role="menuitem"` 요구 추가 |
| d | `spec.md` AC-AI-008-001 | "클릭(no-hover) → **토글**" | "클릭 → 열림(이미 열려 있으면 무변경)" |
| e | `spec.md` AC-AI-008-009 / `acceptance.md` 대응 항목 | "Tab 포커스 순회 + Enter/Space" | 방향키 래핑 순환 + 포커스 진입/복귀 포함으로 확장 |

추가로 AI-008의 `version`/`updated`/HISTORY에 "SPEC-AI-011로 REQ-006/007 충돌 해소 — 클릭 열기 전용으로 개정" 항목을 남긴다. 이 저장소 관례상 머지된 SPEC도 `status: draft`를 유지하므로 status는 건드리지 않는다.

완료 판정: `grep -n "토글" .moai/specs/SPEC-AI-008-diagram-type-picker/spec.md`가 서브메뉴 클릭 동작을 "토글"로 서술하는 잔존 문장을 반환하지 않는다(AC-AI-011-014).

## 리스크 및 완화 (요약)

`spec.md`의 Risks & Regression Watchlist(R1~R8) 전문 참조. 구현 관점 요약:

- **R1 기존 테스트가 금지 동작 단언** → 1단계에서 **먼저** 재작성(삭제 금지).
- **R2 포인터 닫기 조기 발화** → D4 후보 (i) 채택으로 간극 문제 원천 회피 + 수동 점검.
- **R3 Escape 경합** → D6, 서브메뉴 리스너에서 `stopPropagation` 금지.
- **R4 Enter/Space 이중 발화** → `preventDefault()` 필수, 호출 횟수 단언.
- **R5 포커스 vs rAF 배치** → `focus({ preventScroll: true })`.
- **R6 Playwright ≠ 실기기** → 수동 점검 항목으로 정직하게 분류.
- **R7 AI-008 문서 드리프트** → 구현 순서 9단계에서 **같은 PR로 개정**(모순 공존 기간 0) + `@MX:WARN` 이중 방어.
- **R8 터치 미검증** → 열기 전용 의미론이 터치도 함께 해소할 것으로 **예상**하나 실기기 검증 안 함. 수동 체크리스트에 넣지 않고 미검증 사실만 명시(검증 안 한 것을 검증했다고 적지 않는다).

## 검증 게이트

- `npm run typecheck`(`tsc --noEmit`) 클린
- `npm test`(vitest) 전체 통과 — 재작성된 `:926` 포함
- `npm run lint` 통과
- `npm run test:e2e`(Playwright) 전체 통과 — 갱신된 다이어그램 테스트 포함
- diff 확인: `EditorToolbar.tsx` / `menuPlacement.ts` / `ipc.ts` / `src-tauri/**` / `package.json` / `Cargo.toml` **0줄**
- grep 확인: `pointerType` · `matchMedia` 신규 도입 **0건**
- grep 확인: `aria-haspopup` 값이 `"true"` 그대로이며 `aiSelectionToolbar.test.ts:905` 무변경 통과
- grep 확인: SPEC-AI-008 개정 완료 — `grep -n "토글" .moai/specs/SPEC-AI-008-diagram-type-picker/spec.md` 잔존 0건
