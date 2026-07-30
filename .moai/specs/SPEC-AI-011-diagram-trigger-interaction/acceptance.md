# SPEC-AI-011 — 수용 기준

> 실행 가능한 체크리스트. 각 항목은 **검증 명령 또는 수동 절차 / 기대 결과 / 소멸시키는 REQ**를 갖는다.
> 자동 검증과 수동 검증을 절 단위로 분리했다 — 어느 쪽인지 애매하게 두지 않는다.

## 사전 준비

```bash
cd /Users/byunjungwon/Dev/my-project-01/markdown-editor-rust
npm ci                      # 의존성 (package.json 은 무변경이어야 함)
npm run typecheck           # tsc --noEmit
```

검증에 쓰는 소스 앵커(조사 시점 확정):

| 앵커 | 의미 |
|------|------|
| `src/components/editor/extensions/ai-selection-toolbar.ts:604-608` | 트리거 이벤트 바인딩(결함 지점) |
| `src/components/editor/extensions/ai-selection-toolbar.ts:553-556` | `toggleDiagramSubmenu`(제거 대상) |
| `src/components/editor/extensions/ai-selection-toolbar.ts:662-679` | `dom` Escape 핸들러(보존 대상) |
| `src/test/aiSelectionToolbar.test.ts:887-` | 다이어그램 서브메뉴 describe |
| `src/test/aiSelectionToolbar.test.ts:926-934` | 금지 동작을 단언 중인 테스트(재작성 대상) |
| `e2e/ai-inline-edit.spec.ts:184-203` | 결함 우회 주석 + hover-only 시퀀스 |

---

## A. 자동 검증 (테스트가 증명하는 항목)

### AC-AI-011-001: 트리거 클릭 열기 전용 — must-pass

가장 중요한 항목. **jsdom과 Playwright 두 계층 모두**에서 확인한다.

**A1-1 (단위, vitest)**

```bash
npm test -- aiSelectionToolbar
```

기대:
- `mouseenter` → `click`을 **이 순서로** dispatch한 뒤 `.mdedit-ai-diagram-submenu`가 DOM에 **존재**하고 트리거 `aria-expanded === "true"`.
- 열린 상태에서 `click`을 추가로 2회 dispatch해도 서브메뉴가 **여전히 존재**한다.
- 위 전 과정에서 `callbacks.onSelectPreset` 호출 **0회**.
- 기존 `:926` 테스트가 "open then closed"가 아니라 열기 전용 계약을 단언하도록 **재작성**되어 있다(테스트 이름 포함).

**A1-2 (E2E, Playwright) — 이 결함의 실질 가드**

```bash
npm run test:e2e -- ai-inline-edit
```

기대: 다이어그램 테스트가 트리거를 **`hover()`가 아니라 `click()`으로** 열고, `.mdedit-ai-diagram-submenu`가 `toBeVisible()`을 만족한다. `locator.click()`은 실제 마우스 이동+클릭을 주입하므로 `mouseenter` → `click`이 브라우저에 의해 자연 발화된다 — **수정 전이라면 반드시 실패하는 어서션**이다.

소멸 REQ: **001, 002, 003**

---

### AC-AI-011-002: hover 열림 보존

```bash
npm test -- aiSelectionToolbar
npm run test:e2e -- ai-inline-edit
```

기대: `mouseenter` 단독(또는 Playwright `hover()`)으로 서브메뉴가 열린다. SPEC-AI-008 REQ-006 회귀 없음.

소멸 REQ: **004, 018**

---

### AC-AI-011-003: ARIA role 및 상태

```bash
npm test -- aiSelectionToolbar
```

기대:
- 서브메뉴 컨테이너 `role === "menu"`
- 8개 항목 **전부** `role === "menuitem"`
- 서브메뉴가 DOM에 있는 동안 `aria-expanded === "true"`, 제거된 뒤 `"false"` (열기/닫기 각 경로마다 확인)
- 트리거 `aria-haspopup === "true"` — **변경하지 않는다.** ARIA 사양상 `"menu"`와 동치라 기능 효과가 0이므로 표기 통일만을 위한 diff를 만들지 않는다. 기존 테스트 `aiSelectionToolbar.test.ts:905`가 **무변경 통과**해야 한다

소멸 REQ: **005, 006**

---

### [WITHDRAWN v1.1.0 — 도달 불가 확인, spec.md HISTORY 참조] AC-AI-011-004: 키보드 활성화 → 열림 + 첫 항목 포커스

```bash
npm test -- aiSelectionToolbar
grep -n "addEventListener('click'" src/components/editor/extensions/ai-selection-toolbar.ts
```

기대:
- 트리거에 포커스를 준 뒤 Enter(및 Space) 활성화 → 서브메뉴 열림 + `document.activeElement`가 **첫 항목**(`[data-diagram-auto="true"]`).
- grep 결과에 트리거의 `click` 리스너가 **존치**한다(삭제되지 않았음 = 키보드 경로 보존).

소멸 REQ: **007, 017**

---

### [WITHDRAWN v1.1.0 — 도달 불가 확인, spec.md HISTORY 참조] AC-AI-011-005: 방향키 열기 및 래핑 순환

```bash
npm test -- aiSelectionToolbar
```

기대:
- 닫힌 트리거에 ArrowDown keydown → 열림 + `activeElement` = 항목[0]
- 닫힌 트리거에 ArrowUp keydown → 열림 + `activeElement` = 항목[7]
- 열린 서브메뉴에서 항목[7] 포커스 후 ArrowDown → 항목[0] (래핑)
- 항목[0] 포커스 후 ArrowUp → 항목[7] (래핑)
- 위 방향키 이벤트들이 `preventDefault()`된다(`event.defaultPrevented === true`)

소멸 REQ: **008, 009**

---

### [WITHDRAWN v1.1.0 — 도달 불가 확인, spec.md HISTORY 참조] AC-AI-011-006: Enter/Space 단일 발화

```bash
npm test -- aiSelectionToolbar
```

기대: 서브메뉴 항목에 포커스를 두고 Enter(및 Space) keydown → `onSelectPreset` 호출 횟수 **정확히 1**, 그리고 해당 keydown이 `preventDefault()`된다.

> **정직한 한계**: jsdom은 `keydown`에서 네이티브 `click`을 자동 합성하지 않는다. 따라서 이 단위 테스트는 "실제 브라우저에서 이중 발화가 없음"을 완전히 증명하지 못한다. `preventDefault()` 호출 단언이 계약을 고정하는 대리 지표이며, 실제 이중 발화 여부는 D-2 수동 점검에서 확인한다.

소멸 REQ: **010**

---

### AC-AI-011-007: Escape → 서브메뉴만 닫힘 + 트리거 포커스 복귀

```bash
npm test -- aiSelectionToolbar
```

기대:
- 서브메뉴 열림 상태(포커스가 서브메뉴 항목에 있는 경우 포함)에서 Escape → 서브메뉴 DOM 제거, `activeElement` = 트리거.
- 상위 프리셋 목록(`.mdedit-ai-preset-list`)과 메뉴(`.mdedit-ai-preset-menu`)는 **그대로 남는다**(`callbacks.onClose` 호출 0회).
- 서브메뉴가 닫힌 상태에서의 Escape는 기존대로 `onClose`를 호출한다(회귀 없음, 기존 `:451` 테스트 통과).

소멸 REQ: **011**

---

### AC-AI-011-008: 외부 mousedown 닫힘 + 상위 항목 클릭 가능

```bash
npm test -- aiSelectionToolbar
npm run test:e2e -- ai-inline-edit
```

기대:
- 툴바 래퍼 외부 mousedown → 서브메뉴 + 상위 메뉴 함께 닫힘(기존 위젯 경로 회귀 없음).
- 서브메뉴가 열린 상태에서 상위 프리셋의 다른 항목(예: `[data-preset="polish"]`)을 클릭하면 `onSelectPreset('polish')`가 발행된다 — 즉 서브메뉴가 상위 항목을 가로막지 않는다.
- DOM에 차단 오버레이(backdrop) 요소가 **존재하지 않는다**.

소멸 REQ: **012, 015**

---

### AC-AI-011-009: 다른 프리셋 항목 진입 시 닫힘

```bash
npm test -- aiSelectionToolbar
```

기대: 트리거 `mouseenter`로 연 뒤, 같은 목록의 다른 프리셋 버튼에 `mouseenter`를 dispatch하면 서브메뉴 DOM이 제거되고 `aria-expanded === "false"`가 된다.

> 이 항목은 AC-001(클릭-토글 제거)의 **필수 짝**이다. 클릭 토글을 없애면 포인터만으로 닫을 수단이 외부 클릭뿐이 되는데, 이 플라이아웃은 좁은 폭에서 좌측으로 flip될 때 **트리거 행 전체를 시각적으로 덮는다**(진단 단계 확인). 열린 채 방치되면 상위 프리셋 항목을 가려 REQ-015(AC-008)와 정면 충돌하므로, 포인터 닫기 경로는 설계의 필수 구성 요소다.

소멸 REQ: **013**

---

### AC-AI-011-010: disabled 게이트

```bash
npm test -- aiSelectionToolbar
```

기대: `build(4001)`(SPEC-AI-007 가드로 다이어그램 프리셋 disabled)에서 트리거에 `mouseenter` / `click` / Enter / ArrowDown 어느 것을 dispatch해도 `.mdedit-ai-diagram-submenu`가 **생성되지 않는다**.

소멸 REQ: **014**

---

### AC-AI-011-011: 페이로드·의존성·단축키 무변경 — must-pass

```bash
npm test                      # 전체 vitest
git diff --stat -- package.json src-tauri/Cargo.toml src-tauri/ src/lib/tauri/ipc.ts
grep -rn "markdownKeyBindings" src/ | head
```

기대:
- SPEC-AI-008의 기존 발행 테스트(`aiSelectionToolbar.test.ts:979`, `:990`)가 **무변경 통과** — "자동" → `onSelectPreset('diagram', undefined)`, 7종 각각 → `onSelectPreset('diagram', <type>)`.
- `git diff --stat` 결과 위 경로 전부 **0줄 변경**.
- `markdownKeyBindings` 무변경(전역 단축키 미추가).

소멸 REQ: **016, 021**

---

### AC-AI-011-012: 포인터 종류 분기 없음 + 타 팝오버 무변경

```bash
grep -rn "pointerType\|matchMedia\|hover: hover" src/ | grep -v node_modules
git diff --stat -- src/components/editor/EditorToolbar.tsx src/lib/ui/menuPlacement.ts
npm test -- menuPlacement
npm test -- diagramMenuPlacement
```

기대:
- 첫 grep에서 **신규 도입 0건**(기존에 없었으므로 결과가 비어 있어야 한다).
- `EditorToolbar.tsx`, `menuPlacement.ts` diff **0줄**.
- `menuPlacement.test.ts`, `diagramMenuPlacement.test.tsx` 무변경 통과.

> Popover Audit 결과 저장소 내 동일 충돌 컴포넌트는 `ai-selection-toolbar.ts` 하나뿐이므로, 타 팝오버는 "손대지 않았음"만 증명하면 된다.

소멸 REQ: **019, 020**

---

### AC-AI-011-013: E2E 우회 주석·시퀀스 갱신 — must-pass

```bash
grep -n "알려진 UI 결함\|hover()\|click()" e2e/ai-inline-edit.spec.ts
npm run test:e2e -- ai-inline-edit
```

기대:
- `:193-195`의 "알려진 UI 결함 … 트리거를 hover() 만 하고 click() 하지 않는다 … 단일 클릭으로 되돌리지 말 것" 주석이 **제거 또는 갱신**되어 현재 결함을 서술하지 않는다. 갱신 후 문언은 "SPEC-AI-011로 클릭이 열기 전용이 되어 hover·click 양쪽 유효; 클릭-토글로 되돌리지 말 것" 취지여야 한다.
- 테스트가 `diagramTrigger.click()`을 실제로 호출한다.
- 다운스트림 어서션(`ai_request` 호출 2회 이상, 카드 표시, 미니 렌더)은 **무변경**으로 통과한다 — 페이로드 불변의 부수 증명.

소멸 REQ: **022**

---

### AC-AI-011-014: SPEC-AI-008 개정 동시 적용 — must-pass

본 SPEC 구현과 **같은 PR** 안에서 확인한다(모순 공존 기간 0).

```bash
grep -n "토글" .moai/specs/SPEC-AI-008-diagram-type-picker/spec.md
git diff --stat -- .moai/specs/SPEC-AI-008-diagram-type-picker/
```

기대:
- 첫 grep이 서브메뉴 클릭 동작을 "토글"로 서술하는 **잔존 문장을 반환하지 않는다**(HISTORY의 과거 경위 서술은 예외로 허용).
- `spec.md`의 REQ-AI-008-006 / 007 / 013, AC-AI-008-001 / 009가 plan.md 개정 문언 표 (a)~(e)대로 갱신되어 있다.
- `acceptance.md`의 대응 항목도 함께 갱신되어 있다.
- AI-008 HISTORY에 "SPEC-AI-011로 REQ-006/007 충돌 해소 — 클릭 열기 전용으로 개정" 항목과 `version`/`updated` 갱신이 있다. `status: draft`는 저장소 관례상 유지.

> plan 단계(SPEC 작성 시점)에서는 이 편집을 하지 않는다 — **run 단계 구현 순서 9단계** 작업이다.

소멸 REQ: **023**

---

## B. 수동 검증 (자동 테스트가 증명할 수 없는 항목)

> 아래 항목들은 Playwright(Chromium)가 Tauri 실제 웹뷰(macOS WKWebView / Windows WebView2)가 아니기 때문에, 또는 체감 품질이기 때문에 **자동 회귀가 불가능하다.** 체크리스트로만 남기며, 이 사실을 숨기지 않는다.

실행: `npm run dev`(= `tauri dev`) 후 아무 문서에서 텍스트를 선택 → ✨ 클릭 → 프리셋 메뉴 노출. `cargo`가 PATH에 없는 셸에서는 `export PATH="$HOME/.cargo/bin:$PATH"`를 선행한다.

- [x] **B-1 포인터 클릭 (핵심 회귀)** — 마우스로 "🧜 다이어그램으로"를 **클릭**한다. 서브메뉴가 열린 채 유지된다(수정 전에는 아무 일도 일어나지 않았다). 같은 항목을 여러 번 연타해도 닫히지 않는다. → REQ-001, 002
  - **실측 결과 (2026-07-30, macOS, `npm run dev` 개발 빌드)**: 통과. 마우스 클릭으로 서브메뉴가 열리고 유지됨을 사용자가 직접 확인. 연타 무해성은 별도로 확인하지 않았다.
- [ ] **B-2 Enter/Space 이중 발화 확인** — 서브메뉴 항목에 포커스를 두고 Enter를 **한 번** 누른다. AI 요청이 **1회만** 발행되는지 카드/네트워크 활동으로 확인한다(2회 발행 시 비용 있는 중복 요청). → REQ-010 (AC-006의 jsdom 한계 보완)
- [ ] **B-3 트리거→서브메뉴 포인터 이동** — 트리거에 hover해 연 뒤, 포인터를 서브메뉴 항목 위로 **천천히** 옮긴다. 4px 간극을 지나는 동안 서브메뉴가 조기에 닫히지 **않는다**. → REQ-013 / R2
- [ ] **B-4 다른 프리셋으로 이동 시 닫힘** — 트리거에 hover해 연 뒤 포인터를 "다듬기" 등 다른 프리셋으로 옮기면 서브메뉴가 닫힌다. → REQ-013
- [x] **B-5 물리 키보드 도달성 (macOS)** — **v1.1.0: 미검증이 아니라 실패로 확정.** Tab으로 프리셋 항목을 순회해도 다이어그램 트리거에 도달하지 못한다 — 원인 3가지가 실기기에서 확인됨: (1) 프리셋 메뉴 루트 `dom.tabIndex = -1`이고 메뉴/버튼을 열 때 아무도 focus()하지 않음, (2) Tab은 `markdown-extensions.ts:120`의 `indentWithTab`이 소비해 CodeMirror 밖으로 나가지 않음, (3) macOS WebKit은 `<button>` 클릭 시 포커스를 주지 않아 ✨ 클릭 이후에도 포커스가 에디터에 남는다. 즉 이 항목은 머지 시점에 **미검증**으로 남아 있던 것이 실제로는 **설계상 항상 실패**했던 것으로 드러났다 — 이 B-5를 머지 전에 실행했다면 결함을 잡았을 것이다. REQ-007, 008은 이 결과에 따라 spec.md v1.1.0에서 WITHDRAWN 처리했다. → REQ-007, 008 / R6 (철회)
- [ ] **B-6 Escape 복귀** — 서브메뉴가 열린 상태에서 Escape → 서브메뉴만 닫히고 프리셋 목록이 남으며, 다시 Escape → 툴바가 닫힌다. → REQ-011
- [ ] **B-7 다크/라이트 테마** — 두 테마에서 서브메뉴 포커스 링(`:focus-visible`, `mdedit-components.css:462`)이 보이는지 확인한다(키보드 내비게이션이 새로 실질화되므로 포커스 가시성이 중요해진다).
- [ ] **B-8 Windows 스모크** (가능한 경우) — WebView2에서 B-1, B-3만 재확인.

> **수동 검증 현황 (2026-07-30)**: B-1만 실기기 확인 완료. **B-2 ~ B-8은 미검증**이며, 검증하지 않은 것을 검증했다고 적지 않는다. 따라서 REQ-010(Enter/Space 단일 발화)은 jsdom의 `preventDefault` 대리 검증 + Playwright까지만 근거가 있고 실기기 근거는 없다. REQ-013(포인터 닫기) 역시 Playwright까지만 검증됐다.

---

## C. 테스트 매핑 (REQ → AC → 도구)

| REQ | AC | 검증 도구 | 계층 |
|-----|-----|-----------|------|
| 001 트리거 클릭 열기 | AC-001 | vitest + **Playwright** | 자동 (must-pass) |
| 002 열린 상태 클릭 무변경 | AC-001 | vitest + **Playwright** | 자동 (must-pass) |
| 003 트리거 활성화가 발행 안 함 | AC-001 | vitest | 자동 |
| 004 hover 열림 | AC-002 | vitest + Playwright | 자동 |
| 005 role menu/menuitem (haspopup 무변경) | AC-003 | vitest | 자동 |
| 006 aria-expanded 동기화 | AC-003 | vitest | 자동 |
| 007 Enter/Space → 열림+첫 항목 | AC-004 | vitest | 자동 (+ B-5 보완) |
| 008 방향키 열기 | AC-005 | vitest | 자동 |
| 009 방향키 래핑 순환 | AC-005 | vitest | 자동 |
| 010 Enter/Space 단일 발화 | AC-006 | vitest (한계 있음) | 자동 + **B-2 수동 보완** |
| 011 Escape 복귀 | AC-007 | vitest | 자동 (+ B-6) |
| 012 외부 mousedown 닫힘 | AC-008 | vitest + Playwright | 자동 |
| 013 다른 항목 진입 시 닫힘 | AC-009 | vitest | 자동 (+ B-3, B-4 수동) |
| 014 disabled 게이트 | AC-010 | vitest | 자동 |
| 015 상위 항목 클릭 가능 | AC-008 | vitest | 자동 |
| 016 페이로드 무변경 | AC-011 | vitest + git diff | 자동 (must-pass) |
| 017 click 핸들러 존치 | AC-004 | grep + vitest | 자동 |
| 018 hover 제거 금지 | AC-002 | vitest | 자동 |
| 019 pointerType 분기 금지 | AC-012 | grep | 자동 |
| 020 타 팝오버 무변경 | AC-012 | git diff + vitest | 자동 |
| 021 의존성·단축키 무변경 | AC-011 | git diff + grep | 자동 |
| 022 E2E 주석·시퀀스 갱신 | AC-013 | grep + Playwright | 자동 (must-pass) |
| 023 SPEC-AI-008 개정 동시 적용 | AC-014 | grep + git diff | 자동 (must-pass) |

미커버 REQ **없음** (001–023 전수).

---

## D. Definition of Done

- [ ] AC-001 ~ AC-014 **전부** 통과 (must-pass: AC-001, AC-011, AC-013, AC-014)
- [ ] `npm run typecheck` 클린
- [ ] `npm test` 전체 통과 — 재작성된 `aiSelectionToolbar.test.ts:926` 포함
- [ ] `npm run lint` 통과
- [ ] `npm run test:e2e` 전체 통과
- [ ] `toggleDiagramSubmenu` 함수가 소스에서 **제거**되었다(죽은 API 잔재 없음, D3)
- [ ] `git diff --stat`: `package.json` · `src-tauri/Cargo.toml` · `src-tauri/**` · `src/lib/tauri/ipc.ts` · `src/components/editor/EditorToolbar.tsx` · `src/lib/ui/menuPlacement.ts` **0줄**
- [ ] `@MX:WARN`(클릭-토글 금지 + `@MX:REASON`) 및 `@MX:NOTE` 갱신 완료 — `.claude/rules/moai/workflow/mx-tag-protocol.md` 준수, `code_comments: ko`
- [ ] `aria-haspopup`이 `"true"`로 유지되고 `aiSelectionToolbar.test.ts:905`가 무변경 통과했다(불필요한 표기 diff 없음)
- [ ] 수동 체크리스트 B-1 ~ B-7 수행 및 결과 기록(B-8은 Windows 접근 가능 시). **터치 항목은 의도적으로 없다** — 미검증이며, 검증하지 않은 것을 검증 항목으로 적지 않는다(R8)
- [ ] SPEC-AI-008 개정 5건(plan.md 개정 문언 표 a~e)이 **같은 PR에 포함**되어 적용 완료(AC-014) — 코드와 문서가 모순되는 기간 0
