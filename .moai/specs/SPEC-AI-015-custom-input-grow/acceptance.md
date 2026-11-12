# SPEC-AI-015 — 수용 기준

> 각 항목은 검증 명령 또는 수동 절차, 기대 결과, 해당 REQ 를 갖는다. 자동과 수동을 절로 나눴다.

## 사전 준비

```bash
npm ci
npm run typecheck
```

소스 앵커(origin/main `5c617ae` 기준):

| 앵커 | 의미 |
|------|------|
| `src/components/editor/extensions/ai-selection-toolbar.ts:639-666` | `renderCustomInput`(교체 대상) |
| 같은 파일 `:668-672` / `:674-690` | `setMode` / `handleKeyDown` |
| 같은 파일 `:451-472` | `scheduleMenuFlipMeasurement` |
| `src/styles/mdedit-components.css:424,431-441` | 공유 규칙(분리 대상) |
| `src/test/aiSelectionToolbar.test.ts:402-457` | 기존 직접 입력 테스트 |

---

## A. 자동 검증

### AC-AI-015-001: textarea 로 교체 — must-pass

```bash
npm test -- aiSelectionToolbar
```

기대: "직접 입력..." 클릭 후 `.mdedit-ai-custom-input`의 `tagName === 'TEXTAREA'`, `getAttribute('rows') === '1'`, placeholder 에 `영어로 번역` 포함, `document.activeElement`가 그 textarea. 프리셋 항목은 DOM 에 없음.

해당 REQ: **001**

### AC-AI-015-002: Enter 전송 · Shift+Enter 줄바꿈 — must-pass

```bash
npm test -- aiSelectionToolbar
```

기대:
- 값 `'  더 짧게\n존댓말로  '` + Enter(Shift 없음) → `onSubmitCustom`이 `'더 짧게\n존댓말로'`로 정확히 1회 호출, 이벤트 `defaultPrevented === true`.
- 값 `'   \n  '` + Enter → 호출 0회, `defaultPrevented === true`.
- Shift+Enter → 호출 0회, `defaultPrevented === false`.
- e2e(`npm run test:e2e -- ai-custom-input-grow`): 텍스트 입력 후 Enter → 프리셋 메뉴가 닫히고 픽스처의 기존 관측 수단으로 요청 1건 발행 확인.

해당 REQ: **009, 010**

### AC-AI-015-003: IME 조합 중 Enter/Escape 무시 — must-pass

```bash
npm test -- aiSelectionToolbar
```

기대:
- `new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })` → 호출 0회, `defaultPrevented === false`.
- `keyCode`가 229 인 Enter(`Object.defineProperty`로 주입, `isComposing: false`) → 호출 0회, `defaultPrevented === false`.
- `isComposing: true` Escape → 직접 입력 상태 유지(textarea 존재), `onClose` 0회.
- 조합 아님 Escape → 기존대로 프리셋 목록 복귀.
- 다이어그램 서브메뉴 Escape 관련 기존 SPEC-AI-011 테스트 전부 통과.

해당 REQ: **012, 013**

### AC-AI-015-004: 직접 입력 상태에서만 폭 확대

```bash
npm test -- aiSelectionToolbar
npm run test:e2e -- ai-custom-input-grow
```

기대:
- 단위: 진입 시 `dom.classList`에 `mdedit-ai-preset-menu--custom`. ← 또는 Escape 복귀 시 클래스 없음, `dom.style.width === ''`. 목 rect 로 spaceRight 200·spaceLeft 100 → 진입 rAF 뒤 `dom.style.width === '192px'`이고 `--end` 없음; spaceRight 100·spaceLeft 250 → `'242px'`이고 `--end` 있음; spaceRight 800 → `dom.style.width === ''`.
- 순수 함수 `computeCustomMenuWidth`: `(800, 0) → null`, `(348, 0) → null`, `(347, 0) → 339`, `(200, 100) → 192`, `(100, 250) → 242`, `(150, 100) → 190`.
- e2e(넓은 패널): 메뉴 너비 340±2. 프리셋 상태 너비는 340 미만(기존 내용 맞춤).
- e2e(에디터 패널 ≈ 420px, ✨ 가 줄 중간인 경우와 줄 끝인 경우): 두 경우 모두 메뉴 box 좌·우 모서리가 `.md-editor` 패널 안(±1px), 줄 중간 경우는 메뉴 너비 < 340. (패널 폭 W ≥ 372 이면 ✨ 위치와 무관하게 한쪽 공간이 198px 이상이라 담김이 성립한다. 그보다 좁은 패널의 줄 중간은 R1 Known Limitation 이라 검증 대상이 아니다.)
- 단위 테스트의 `getBoundingClientRect` 목은 메뉴 너비로 **적용된 폭**(인라인 width, 없으면 340)을 돌려준다 — 기존 테스트처럼 `width: 0`을 돌려주면 `--end` 판정이 성립하지 않는다.

해당 REQ: **003, 004, 005**

### AC-AI-015-005: 모드 전환 시 위치 재계산

```bash
npm test -- aiSelectionToolbar
```

기대: rAF 목 + `getBoundingClientRect` 목(기존 `:499-745` 패턴). 생성 직후 측정 1회 외에, 직접 입력 진입과 프리셋 복귀 각각에서 rAF 가 새로 예약되고 실행 후 `--above`/`--end` 가 그 시점의 목 rect 기준으로 갱신된다. 예: 목 메뉴 높이를 프리셋 180, 직접 입력 60 으로 두고 아래 공간 150·위 400 이면 프리셋 → `--above`, 직접 입력 → (선호 높이 200 적용으로) `--above` 유지, 아래 공간 260 이면 직접 입력 → `--above` 없음. 클리핑 조상 목 rect 의 bottom 이 뷰포트보다 위(예: 뷰포트 높이 900, 패널 rect top 0·bottom 700, 앵커 rect top 400·bottom 550, 직접 입력 실측 높이 60)이면 직접 입력 세로 판정은 패널 기준 아래 공간 150 으로 계산되어 `--above`(D4).
- 빠른 왕복: 진입 직후 rAF 실행 전에 ← 복귀 → 대기 중 rAF 를 모두 실행해도 `--custom` 없음, `dom.style.width === ''`, 예외 없음.

해당 REQ: **006, 007(방향)**

### AC-AI-015-006: 높이 증가와 상한 — must-pass

```bash
npm test -- aiSelectionToolbar
npm run test:e2e -- ai-custom-input-grow
```

기대:
- 순수 함수 `computeCustomInputHeight({ scrollHeight, borderY, maxHeight })`: `(20, 2, 300)` → `{ height: 28, overflowY: 'hidden' }`; `(120, 2, 300)` → `{122, 'hidden'}`; `(298, 2, 300)` → `{300, 'hidden'}`; `(299, 2, 300)` → `{300, 'auto'}`; `(500, 2, 300)` → `{300, 'auto'}`; `(500, 2, null)` → `{502, 'hidden'}`.
- `computeCustomInputMaxHeight`: 아래 방향, anchorBottom 400, boundaryBottom 900, chrome 20 → 472; 위 방향, anchorTop 100, boundaryTop 0, chrome 20 → 72; 가용 거리가 30 → 28(하한).
- 단위 배선: 목 상한 계산 후 `scrollHeight` 500·`offsetHeight` 30·`clientHeight` 28 로 목킹하고 `input` 이벤트 → `style.height === '<상한>px'`, `style.overflowY === 'auto'`.
- e2e: Shift+Enter 로 3줄 → textarea 높이가 1줄 때보다 큼, `scrollHeight <= clientHeight + 1`. 60줄 → 메뉴 box 의 위·아래 모서리가 뷰포트와 `.md-editor` 패널 세로 범위 안(±1px), textarea `scrollHeight > clientHeight`, 계산 스타일 `overflow-y === 'auto'`.

해당 REQ: **007(상한), 008, 014**

### AC-AI-015-007: 타이핑 중 방향 고정

```bash
npm test -- aiSelectionToolbar
npm run test:e2e -- ai-custom-input-grow
```

기대:
- 단위: 진입 rAF 실행 뒤 `input` 이벤트를 여러 번 보내도 rAF 가 추가 예약되지 않는다.
- e2e: 문서 아래쪽 줄에서 ✨ 를 열어 직접 입력 진입 시 `--above`; 60줄 입력 후에도 `--above` 유지.

해당 REQ: **011**

### AC-AI-015-008: 제안 카드 방향 지시 칸 불변 — must-pass

```bash
git diff origin/main -- src/styles/mdedit-components.css
npm test -- aiSuggestionCard
```

기대: diff 에서 `.mdedit-ai-direct-input`·`.mdedit-ai-direct-row`에 적용되는 선언(속성·값)의 추가·삭제·변경이 0건 — 바뀌는 것은 선택자 목록에서 custom 쪽이 빠지는 것뿐이다. `src/components/editor/extensions/ai-suggestion-card.ts` diff 0줄. 제안 카드 단위 테스트 전부 통과.

해당 REQ: **002**

### AC-AI-015-009: 범위·의존성 불변 (범위 가드 — 특정 REQ 가 아니라 Delta·Exclusions 를 지킨다)

```bash
git diff --stat origin/main -- src e2e package.json
npm run typecheck && npm run lint
```

기대: 변경 파일은 `ai-selection-toolbar.ts`, `mdedit-components.css`, `src/test/aiSelectionToolbar.test.ts`, `e2e/ai-custom-input-grow.spec.ts` 4개뿐. `package.json` 변경 없음. typecheck·lint 통과.

해당 REQ: 없음(범위 가드 — spec.md §Delta, §Exclusions)

---

## B. 수동 검증 (실기기 WKWebView — 릴리스 빌드 또는 `npm run tauri dev`)

| ID | 절차 | 기대 |
|----|------|------|
| M-1 | 직접 입력에서 한글 "번역해" 를 조합 중인 상태로 Enter | 조합만 확정되고 전송되지 않음. 다시 Enter 하면 전송 |
| M-2 | 한글 조합 중 Escape | 조합만 취소/확정되고 직접 입력 칸은 유지(프리셋으로 돌아가지 않음). 다시 Escape 하면 프리셋 목록 |
| M-3 | 긴 지시를 여러 줄(Shift+Enter) 입력해 창 아래 끝까지 | 칸이 늘다가 창 안에서 멈추고 칸 안에 스크롤바. 메뉴가 화면·에디터 패널 밖으로 잘리지 않음. 다크 모드에서도 제안 카드 방향 지시 칸 모양은 이전과 같음 |

수동 항목은 PR 병합 전 사용자 확인 항목으로 남긴다(자동 검증이 WKWebView 의 실제 조합 이벤트 순서를 재현하지 못함 — SPEC-AI-011 교훈).

---

## REQ ↔ AC 추적

| REQ | AC |
|-----|----|
| 001 | 001 |
| 002 | 008 |
| 003 | 004 |
| 004 | 004 |
| 005 | 004 |
| 006 | 005 |
| 007 | 005, 006 |
| 008 | 006, M-3 |
| 009 | 002 |
| 010 | 002 |
| 011 | 007 |
| 012 | 003, M-1, M-2 |
| 013 | 003 |
| 014 | 006 |

## Definition of Done

- AC-001~009 자동 검증 통과(로컬 범위 + CI 전체).
- M-1~M-3 은 사용자 확인 항목으로 PR 본문에 체크리스트로 남김.
- `@MX:WARN`(IME 가드)·`@MX:NOTE`(측정 순서) 추가, SPEC-AI-011 `@MX:WARN` 보존.
