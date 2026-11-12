# SPEC-AI-015 — 구현 계획

> Tier M · cycle_type=tdd · 변경 파일 4개(소스 2, 테스트 2). 단일 브랜치, 마일스톤 3개.

## 핵심 설계 요약

직접 입력 상태만 바뀐다. 프리셋 목록 상태와 제안 카드는 건드리지 않는다.

```
setMode('custom-input')
  ├─ dom.classList.add('mdedit-ai-preset-menu--custom')   // CSS 폭 340px
  ├─ renderCustomInput()                                   // textarea rows=1 + 리스너
  └─ scheduleMenuFlipMeasurement(dom, anchorEl)            // 다음 rAF
        ├─ if (!dom.isConnected) return
        ├─ ta = getCustomInput()        // 실행 시점: 직접 입력 상태 && textarea 연결 → textarea, 아니면 null (D5)
        ├─ ta 있으면: 폭 = computeCustomMenuWidth(spaceRight, spaceLeft) → 340 미만이면 inline width (D1)
        │            메뉴 rect 다시 읽기
        │            세로: decideMenuFlipDirection(실효 경계 공간, menuHeight = max(실측, 200))   (D4)
        │  ta 없으면: inline width 제거, 세로: 기존 그대로(뷰포트)
        ├─ 가로: decideMenuHorizontalDirection(기존 그대로)
        └─ ta 있으면: customMaxHeight = computeCustomInputMaxHeight(...) 후 높이 1회 갱신  (D3)
textarea 'input' → computeCustomInputHeight({ scrollHeight, borderY: offsetHeight − clientHeight, maxHeight }) → style.height / overflowY
```

세로 방향은 rAF 측정 때만 정해지므로 타이핑 중에는 바뀌지 않는다(REQ-011).

## 순수 함수 (export, 단위 테스트 대상)

| 함수 | 입력 | 출력 |
|------|------|------|
| `computeCustomMenuWidth({ spaceRight, spaceLeft })` | 기존 가로 flip 과 같은 좌·우 공간(px) | `w = max(spaceRight, spaceLeft) − 8`; `w >= 340` 이면 `null`(CSS 340 그대로), 아니면 `max(190, w)` |
| `computeCustomInputMaxHeight({ direction, anchorTop, anchorBottom, boundaryTop, boundaryBottom, chromeHeight })` | 방향 + 앵커·실효 경계 세로 좌표 + 메뉴 외곽 높이 | `max(28, 가용 거리 − chromeHeight − 8)`. 가용 거리 = 아래면 `boundaryBottom − anchorBottom`, 위면 `anchorTop − boundaryTop` |
| `computeCustomInputHeight({ scrollHeight, borderY, maxHeight })` | 내용 높이, 위아래 테두리 합(`offsetHeight − clientHeight`), 상한(`number \| null`) | `need = scrollHeight + borderY`; `height = max(28, maxHeight === null ? need : min(need, maxHeight))`; `overflowY = maxHeight !== null && need > maxHeight ? 'auto' : 'hidden'` |

실효 세로 경계 = `top: max(0, clip?.top ?? 0)`, `bottom: min(window.innerHeight, clip?.bottom ?? ∞)`. `clip`은 기존 `findClippingAncestor(dom)`의 rect 를 재사용한다(새 탐색 함수 없음).

세로 판정용 실효 공간(직접 입력 상태만): `spaceBelow = 경계.bottom − anchorRect.bottom`, `spaceAbove = anchorRect.top − 경계.top`.

상수: `CUSTOM_INPUT_PREFERRED_HEIGHT = 200`, `CUSTOM_MENU_WIDTH = 340`, `CUSTOM_MENU_MIN_WIDTH = 190`, `CUSTOM_INPUT_MIN_HEIGHT = 28`, `CUSTOM_INPUT_MARGIN = 8`(세로 여백·가로 여백 공용).

## 코드 변경 지도

| 위치 | 변경 |
|------|------|
| `ai-selection-toolbar.ts` 상단 상수부(`:142` 부근) | 위 상수 추가 |
| `:382-414` 부근 | 순수 함수 3개 추가(기존 flip 함수 옆) |
| `:451-472` `scheduleMenuFlipMeasurement` | 선택 인자 `custom?: { getCustomInput(): HTMLTextAreaElement \| null; onMaxHeight(maxH: number): void }` 추가(`createPresetMenu`가 클로저로 `mode`·textarea 를 읽는 getter 를 넘김). `dom.isConnected` 가 false 면 즉시 반환(R3). getter 결과가 있으면 폭 → rect 재측정 → 세로(실효 경계, 선호 높이 200) → 가로 → 상한 계산 순서. 없으면 기존 동작 그대로(인라인 width 제거 포함). 생성 시 호출(`:696`)도 같은 인자를 넘긴다 |
| `:639-666` `renderCustomInput` | `<textarea rows=1 class="mdedit-ai-custom-input">`, `input` 리스너(높이 갱신), `keydown`(IME 가드 → `Enter && !shiftKey` 이면 `preventDefault` + trim 전송) |
| `:668-672` `setMode` | 수식 클래스 토글, presets 로 갈 때 인라인 width 제거, 렌더 후 `if (anchorEl) scheduleMenuFlipMeasurement(...)` |
| `:674-690` `handleKeyDown` | 맨 앞 `if (event.isComposing \|\| event.keyCode === 229) return;` — SPEC-AI-011 Escape 순서는 그 아래 그대로 |
| `mdedit-components.css:424,431,437,438` | 공유 선택자에서 custom 제거(direct 쪽 선언은 그대로) |
| 같은 파일, 위 규칙 아래 | 새 규칙: `.mdedit-ai-preset-menu--custom { width: 340px; }`, `.mdedit-ai-custom-row { display:flex; align-items:flex-start; gap; padding }`, `.mdedit-ai-custom-input { flex:1; min-height:28px; padding: 5px var(--md-space-2); line-height:1.4; resize:none; overflow-y:hidden; box-sizing:border-box; display:block; + 기존 색·테두리·caret 토큰 }`, placeholder·focus-visible 규칙 복제 |

`←` 버튼(`.mdedit-ai-back`, 높이 28px)은 그대로 둔다 — `flex-start` 정렬로 첫 줄 옆에 붙는다.

## 마일스톤

1. **M1 — 순수 함수(RED→GREEN)**: `computeCustomMenuWidth`·`computeCustomInputMaxHeight`·`computeCustomInputHeight` 테스트 먼저, 그다음 구현. (REQ-004 축소 폭, 007 상한, 008 높이, 014 하한)
2. **M2 — DOM 배선 + CSS**: textarea 교체, Enter/Shift+Enter/IME, `setMode` 재측정·클래스 토글, `handleKeyDown` 가드, CSS 분리. jsdom 테스트를 먼저 갱신·추가(기존 `:402-457` 직접 입력 테스트의 `HTMLInputElement` 캐스트를 `HTMLTextAreaElement`로). (REQ-001, 004~013)
3. **M3 — WebKit e2e + 회귀**: `e2e/ai-custom-input-grow.spec.ts` 신규. 전체 앱 레이아웃에서 폭·증가·상한·스크롤·flip 고정 확인. 기존 `ai-inline-edit`, `ai-008-diagram-submenu-flip` e2e 와 `aiSelectionToolbar`·제안 카드 단위 테스트 회귀 확인.

## 테스트 계획

### 계층별로 무엇을 증명하나

- **jsdom(vitest)**: 요소 종류·속성, 클래스 토글, 키 분기(전송 횟수·`defaultPrevented`·모드 전환 없음), rAF 목으로 측정 배선(목 rect·`scrollHeight`로 인라인 width·height·overflowY 값). 레이아웃 실측은 하지 않는다.
- **Playwright webkit**: 실제 폭(340 또는 패널 축소폭), 실제 높이 증가, 상한 도달 후 `scrollHeight > clientHeight`와 메뉴가 뷰포트·에디터 패널 안에 머묾, 타이핑 중 `--above` 불변.
- **수동(실기기 WKWebView)**: 한글 조합 중 Enter/Escape, 조합 확정 Enter 직후 동작.

### jsdom 단위 테스트(`src/test/aiSelectionToolbar.test.ts`)

- 기존 "morphs into a one-line input" → textarea·`rows=1`·placeholder·포커스 확인으로 갱신.
- Enter 전송(trim, 내부 줄바꿈 보존 `'  a\nb  '` → `'a\nb'`), `defaultPrevented === true`.
- 빈 값/공백만 Enter → 전송 0회, `defaultPrevented === true`.
- Shift+Enter → 전송 0회, `defaultPrevented === false`.
- `isComposing: true` Enter, `keyCode: 229` Enter → 전송 0회, `defaultPrevented === false`.
- `isComposing: true` Escape → 직접 입력 상태 유지, `onClose` 0회. (`KeyboardEvent` 생성자의 `isComposing` 옵션 사용, `keyCode`는 `Object.defineProperty`로 주입.)
- 직접 입력 진입 → `--custom` 클래스 존재, ← 복귀 → 클래스·인라인 width 제거.
- 모드 전환마다 rAF 콜백이 다시 예약되는지(기존 `:499-745` 의 rAF 목 패턴 재사용) + 목 rect 기준 `--above`/`--end` 갱신.
- 상한 배선: 목 rect(아래 공간 120px, 위 500px)에서 진입 → `--above` + 상한이 위 공간 기준으로 계산; `scrollHeight`·`offsetHeight`·`clientHeight` 목(필요 높이 > 상한) → `style.height === 상한px`, `overflowY === 'auto'`.
- 빠른 왕복: 직접 입력 진입 직후 rAF 를 실행하기 전에 ← 로 복귀, 그다음 대기 중 rAF 전부 실행 → `--custom` 없음, `dom.style.width === ''`, 예외 없음(D5).
- 타이핑(input 이벤트) 뒤 rAF 가 추가로 예약되지 않음 → 방향 재판정 없음(REQ-011 의 jsdom 측 근거).
- 다이어그램 서브메뉴 Escape 회귀: 기존 SPEC-AI-011 테스트가 그대로 통과.

### Playwright(`e2e/ai-custom-input-grow.spec.ts`, 신규)

선례 `e2e/ai-008-diagram-submenu-flip.spec.ts`의 헬퍼 패턴(✨ 띄우기, `.md-editor` 패널 rect, 사이드바 접기)과 픽스처 `e2e/fixtures/tauri-v2-ai-mock.ts`를 따른다. 전체 앱을 띄운 상태에서만 측정한다(메모리 교훈: 단독 렌더는 겹침을 놓친다).

1. 넓은 패널: 직접 입력 진입 → 메뉴 `boundingBox().width`가 340±2.
2. 좁은 패널(스플리터를 끌어 에디터 패널 ≈ 300px, ✨ 가 줄 중간과 줄 끝에 있는 두 경우): 메뉴 폭 < 340, 메뉴 box 의 좌·우 모서리가 `.md-editor` 패널 안(±1px).
3. 증가: 줄바꿈 3개 입력(Shift+Enter) → textarea 높이가 1줄일 때보다 커지고 내부 스크롤 없음(`scrollHeight <= clientHeight + 1`).
4. 상한: 줄바꿈 60개 입력 → 메뉴 box 가 뷰포트와 `.md-editor` 패널 세로 범위 안, textarea `scrollHeight > clientHeight`, 계산 `overflow-y` 가 `auto`.
5. flip 고정: 문서 아래쪽 줄에서 열어 `--above` 상태로 진입 → 60줄 입력 후에도 `--above` 클래스 유지.
6. 전송: 텍스트 입력 후 Enter → 메뉴가 닫히고 요청이 발행됨(픽스처의 기존 관측 수단 사용).

## @MX 태그 대상

- `scheduleMenuFlipMeasurement`: `@MX:NOTE` — 직접 입력 상태에서 폭 적용 → rect 재측정 순서가 필요한 이유(폭이 바뀌면 가로 flip 결과가 바뀜), 방향은 모드 진입 때만 판정(타이핑 중 flip 깜빡임 방지).
- textarea keydown 핸들러와 `handleKeyDown` 가드: `@MX:WARN` — `isComposing` 만으로는 부족하다(WebKit 은 compositionend 를 확정 keydown 보다 먼저 보낼 수 있음), `keyCode === 229` 를 지우지 말 것. `@MX:REASON` 포함.
- 기존 SPEC-AI-011 `@MX:WARN`(`:603-613`)은 손대지 않는다.

## 리스크 대응

spec.md §Risks 참조. run 단계에서 추가로 지킬 것:

- `.mdedit-ai-direct-input` 계열 선언은 diff 상 문자 그대로 보존(R4, AC-008).
- rAF 콜백은 실행 시점의 `mode`를 읽어 분기(R5).
- 측정 시작에 `dom.isConnected` 확인(R3).

## 검증 게이트

```bash
npm run typecheck
npm run lint
npm test -- aiSelectionToolbar
npm test -- aiSuggestionCard   # 제안 카드 회귀(aiSuggestionCard*.test.ts 전부 매칭)
npm run test:e2e -- ai-custom-input-grow ai-inline-edit ai-008-diagram-submenu-flip
```

전체 단위 테스트·e2e 는 CI 에 맡긴다(로컬은 변경이 닿는 범위만).
