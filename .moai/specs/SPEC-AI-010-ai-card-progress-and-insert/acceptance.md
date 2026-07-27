---
id: SPEC-AI-010
version: "0.0.1"
status: draft
created: "2026-07-27"
updated: "2026-07-27"
author: "jw"
priority: high
issue_number: null
dependencies:
  - SPEC-AI-001
  - SPEC-AI-006
  - SPEC-AI-009
tags:
  - ai
  - card
  - progress
  - watchdog
  - insert
  - acceptance
lifecycle: spec-anchored
---

# SPEC-AI-010 Acceptance Criteria — AI 카드 재요청 진행 표시 · 종결 보장 · 블록 경계 삽입

> 본 문서는 spec.md의 AC-AI10-001~012를 Given-When-Then 형식으로 전개한다. 각 AC는 매핑된 REQ-AI10-XXX를 검증한다. 검증 수단은 (a) Vitest + Testing Library 단위·통합 테스트(주 수단), (b) **코드 리뷰(diff)** — 자동 테스트가 판정할 수 없는 무변경·구조 보존 항목, (c) 로컬 수동 검증(체감 지연·실문서 삽입 위치)으로 삼원화한다.
>
> **TDD 순서 계약**(`quality.yaml` `development_mode: tdd`, `test_coverage_target: 85`): 각 AC의 **Then** 절은 그대로 실패하는 테스트의 단언이 된다. 다음 다섯 회귀 단언은 **현행 코드에서 반드시 실패**해야 한다 — AC-AI10-001, AC-AI10-005, AC-AI10-007, AC-AI10-010 (a)(b)(c), AC-AI10-011 전자. 실패하지 않으면 재현 시나리오가 결함을 담아내지 못한 것이므로 시나리오를 다시 잡는다.
>
> **단언 완화 금지**: "무수정 통과" 대상 테스트가 실패하면 범위를 벗어난 변경이 들어간 신호다. 테스트를 느슨하게 고쳐 통과시키는 것은 FAIL 로 간주한다.

## 테스트 환경

### 자동화 (프론트 단위·통합 테스트)

- **실행 명령**: `npm test`(Vitest) / `npm run typecheck` / `npm run lint`
- **신규 파일**:
  - `src/test/aiCardRerequestProgress.test.ts` — AC-AI10-001·002·003
  - `src/test/aiCardWatchdog.test.ts` — AC-AI10-004·005·006
  - `src/test/aiCardCoexistence.test.ts` — AC-AI10-007·008
  - `src/test/aiBlockBoundary.test.ts` — AC-AI10-010(경계 함수 부분)·011
- **수정 파일**: `src/test/aiSuggestionApply.test.ts` — AC-AI10-010(삽입 위치 4케이스). **신규 `describe` 추가만 허용하고 기존 케이스는 수정 금지**.
- **무수정 통과 대상**: `aiSuggestionCardRerequest.test.ts`, `aiWaitNotice.test.ts`, `aiFileSwitchEffects.test.ts`, `aiSuggestionCard.test.ts`, `aiSuggestionCardRender.test.ts`, `aiSuggestionCardWidget.test.ts`, `aiRelay.test.ts`, `aiStore.test.ts`, `aiOffEffects.test.ts`
- **타이머**: `vi.useFakeTimers()` / `vi.advanceTimersByTime()`. 8초 대기 안내와 프론트 백스톱 임계를 실시간으로 기다리지 않는다.
- **mock 정책**: `aiRequest`/`aiCancel`(`@/lib/tauri/ipc`)과 `@tauri-apps/api/event` 의 `listen` 은 mock 으로 주입한다. 실제 Tauri 런타임 의존 금지 — 단위 테스트가 CI 에서 동작해야 한다. 기존 `aiSuggestionCardRerequest.test.ts`·`aiRelay.test.ts` 의 패턴을 차용한다.

### 코드 리뷰 (diff) — 자동 테스트가 판정할 수 없는 항목

> vitest 에는 baseline hash 가 없고, 변경 **이후에** 작성된 가드는 "그 파일이 바뀌지 않았다"를 증명하지 못한다. 이는 `git diff` 속성이다. 아래 항목은 PR 리뷰에서 사람이 확인하며, **테스트 통과를 근거로 준수를 주장하지 않는다**.

| 확인 항목 | 담당 REQ | 확인 대상 |
|-----------|----------|-----------|
| 신규 진행 UI·신규 `CardPhase`·신규 위젯 부재 | REQ-AI10-005 | `ai-suggestion-card.ts` diff — `CardPhase` 유니온(`:28-38`) 무변경, 진행률 관련 DOM 생성 코드 부재 |
| 파일 전환 정리 3모듈 무변경 | REQ-AI10-015 | `src/lib/ai/aiFileSwitchEffects.ts`·`src/lib/ai/aiOffEffects.ts`·`src/components/layout/AppLayout.tsx` diff |
| `applySuggestion` 무손상 구조 무변경 | REQ-AI10-022 | 원문 재검증(`:541-544`)의 위치·조건, dispatch 가 단일 `changes` 트랜잭션(`:547`·`:555`), `replace` 분기(`:546-549`) |
| 임계 상수의 배치·파생 형태·백엔드 참조 주석 | REQ-AI10-007 | `src/lib/ai/waitNotice.ts` diff — 백스톱이 백엔드 미러 상수에서 **파생**되었는지(독립 리터럴이 아닌지), `src-tauri/src/ai/mod.rs:32` 참조 주석 유무 |
| `aiStore.ts`·`src-tauri/` 무변경 | plan.md 채택안 C 계약 | 두 경로의 diff |
| 회귀 가드 테스트 파일 변경 여부 | 전 REQ | 10개 파일 중 `aiSuggestionApply.test.ts` 만 **추가** 허용, 나머지 9개는 diff 0줄 |

### 수동 검증 (로컬 실기기)

- **실행**: `npm run tauri dev` 로 mdedit 실행.
- **도구**: DevTools(이벤트·타이머 관측), 실제 문서 파일(표/목록으로 끝나는 마크다운), 네트워크 차단·프로세스 정지(백스톱 시나리오).

---

## Acceptance Criteria (Given-When-Then)

### AC-AI10-001 — 사용자 개시 재요청 5개 진입점 전부가 즉시 streaming 표시로 복귀 *(회귀)*

**매핑**: REQ-AI10-001, REQ-AI10-002, REQ-AI10-003

> **RED 확보 계약(HARD)**: 본 AC는 **현행 구현에서 5건 전부 실패**해야 한다. `onReRequest` 배선(`ai-suggestion-card.ts:1188-1193`)이 `fireReRequest`(`:1125-1138`) 반환값을 `boundRequestId` 에 대입하는데, `fireReRequest` 는 대입 **이전에** `store.startRequest`(`:1132`)를 실행하고 그 시점의 구독(`:1223-1224`)은 `s.requestId !== boundRequestId`(그때 `boundRequestId` 는 직전 id)로 단락된다. 따라서 카드는 첫 청크가 올 때까지 `done` phase 를 유지한다. 실패하지 않으면 재현 시나리오가 결함을 담아내지 못한 것이다.

**공통 Given**: `startSuggestionCard` 로 카드를 만들고, `aiRequest`/`aiCancel` mock 을 주입하고, 카드가 제안 본문 `'이전 제안 본문입니다.'` 를 가진 상태에 도달해 있다.

#### 진입점 1 — `↻`(방향 지시 버튼, `:271-279`)

**Given** 카드가 `done` phase 이고 방향 지시 입력에 `'더 짧게'` 가 입력되어 있으면

**When** `.mdedit-ai-redo` 를 클릭하고 **어떤 `ai://chunk` 도 발생시키지 않은 채** 렌더를 검사하면

**Then** 다음이 모두 참이다:
1. 카드 루트 요소가 `mdedit-ai-card-streaming` 클래스를 갖는다.
2. `.mdedit-ai-skeleton-line` 이 **정확히 3개** 존재한다(빈 버퍼 조건 `:315-324`).
3. 카드 DOM 의 텍스트에 `'이전 제안 본문입니다.'` 가 **포함되지 않는다**(버퍼 리셋, REQ-AI10-002).
4. `.mdedit-ai-apply` 버튼이 **존재하지 않는다**(done 컨트롤 소멸).
5. `.mdedit-ai-cancel`(`✕ 취소`)이 존재한다(streaming 렌더의 기존 구성, `:332-334`).

#### 진입점 2 — `↻ 다시`(blind, `:282-285`)

**Given** 카드가 `done` phase 이면

**When** `.mdedit-ai-retry` 를 클릭하고 동일하게 검사하면

**Then** 진입점 1과 **동일한 5개 단언**이 성립한다.

#### 진입점 3 — `⚡ 고급 모델로 다시 시도`(`:416-419`)

**Given** ↻ 를 상한(`MAX_RETRY = 3`, `:69`)까지 소진해 카드가 `retry-exhausted` phase 이면

**When** `.mdedit-ai-advanced` 를 클릭하고 동일하게 검사하면

**Then** 진입점 1과 동일한 5개 단언이 성립한다. 추가로 재요청이 `model: 'sonnet'` 으로 발행된다(기존 계약 보존, `:419`).

#### 진입점 4 — `다시 시도`(`error` phase, `errorKind` 기타, `:364-368`)

**Given** `controller.onError({ kind: 'other', message: '잠시 문제가 있었어요' })` 로 카드가 `error` phase 이면

**When** `.mdedit-ai-retry` 를 클릭하고 동일하게 검사하면

**Then** 진입점 1과 동일한 5개 단언이 성립하며, 추가로 오류 문구 `'잠시 문제가 있었어요'` 와 `.mdedit-ai-dismiss` 가 DOM 에서 사라진다.

#### 진입점 5 — `다시 요청`(`intruded` phase, `:383-385`)

**Given** `controller.intrude()` 로 카드가 `intruded` phase 이면

**When** `.mdedit-ai-rerequest` 를 클릭하고 동일하게 검사하면

**Then** 진입점 1과 동일한 5개 단언이 성립하며, 추가로 안내 문구 `'원문이 편집되어 이 제안을 멈췄어요'` 가 DOM 에서 사라진다.

#### 배선 단일성

**Given** 다섯 진입점의 구현을 검토하면

**When** phase 전이·버퍼 리셋·타이머 재무장 처리의 위치를 확인하면

**Then** 처리가 다섯 곳에 복제되지 않고 **공통 `onReRequest` 배선 한 곳**(또는 그 배선이 호출하는 컨트롤러 메서드 하나)에만 존재한다(REQ-AI10-003).

---

### AC-AI10-002 — 재요청 후 8초 대기 안내가 다시 나타남

**매핑**: REQ-AI10-004

**Given** `vi.useFakeTimers()` 상태에서 카드가 `done` phase 이고, `.mdedit-ai-wait-notice` 가 DOM 에 없으면

**When** `↻ 다시` 를 클릭하고 `vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS)`(8000ms)를 실행하면

**Then** `.mdedit-ai-wait-notice` 가 존재하고 그 텍스트가 `WAIT_NOTICE_TEXT`(`'아직 생성 중이에요 — 취소할 수 있어요'`, `waitNotice.ts:10`)와 일치한다.

**Given** 재요청 **직전** 요청에서 이미 8초가 경과해 대기 안내가 떠 있던 상태이면

**When** 재요청을 발행한 **직후**(타이머를 진행시키지 않고) 렌더를 검사하면

**Then** `.mdedit-ai-wait-notice` 가 **존재하지 않는다**(재무장으로 `waitingLong` 이 초기화됨, `:868-871`).

**Given** 위 상태에서 이어서

**When** `vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS)` 를 실행하면

**Then** 대기 안내가 **다시** 나타난다(재무장이 실제로 관측됨).

**Given** 재요청 후 8초가 경과하기 **전에** 첫 청크가 도착하면

**When** 렌더를 검사하면

**Then** 대기 안내가 나타나지 않고, 이후 8초가 더 지나도 나타나지 않는다(`onStream` 의 타이머 해제, `:894-900` — 기존 동작 보존).

---

### AC-AI10-003 — 가짜 진행 표시 부재 + 내부 개시 경로 회귀 없음

**매핑**: REQ-AI10-005, REQ-AI10-006

**Given** 재요청 직후의 streaming 렌더를

**When** 진행 지표 후보 요소로 조회하면 — `progress` 태그, `[role="progressbar"]`, 텍스트에 `%` 를 포함하는 요소, 텍스트에 `남은` 또는 `초 후` 를 포함하는 요소

**Then** 어느 것도 **존재하지 않는다**(REQ-AI10-005, SPEC-AI-006 REQ-AI6-009 연장).

**Given** 다이어그램 프리셋 카드에서 무효 mermaid 응답이 도착해 자동 재시도가 발생하면

**When** 재시도 상한(`decideDiagramOutcome` 판정)까지 반복해 최종 phase 를 확인하면

**Then** 상한 소진 시점과 최종 phase(`diagram-fallback`)가 개정 전과 동일하다 — 공통 배선의 전이 추가로 `stream` 이 중복 커밋되어도 `diagramAttempts` 궤적이 흔들리지 않는다(REQ-AI10-006).

**Given** 표 프리셋 카드에서 무효 표 응답이 도착하면

**When** 자동 재요청 횟수를 확인하면

**Then** **정확히 1회**다(`TABLE_MAX_VALIDATION_ATTEMPTS` 게이트 + `tableAttempts > 1` 이중 잠금, `:935-944` — 개정 전과 동일).

**Given** `✓ 목록으로`(목록 폴백)를 클릭한 뒤 재요청 응답이 도착하면

**When** 처리 경로를 확인하면

**Then** mermaid 검증 분기에 진입하지 않고 일반 제안으로 처리된다(`listFallbackActive`, `:909` — 개정 전과 동일).

**Given** `src/test/aiSuggestionCardRerequest.test.ts` 를

**When** **한 줄도 수정하지 않고** 실행하면

**Then** BUG-1/2/3(a)/5/6 시나리오와 `fireReRequest` providerId 오버라이드(SPEC-AI-009) 계약이 전수 통과한다.

**코드 리뷰(diff)**: 신규 `CardPhase` 값·신규 위젯 클래스·신규 CSS 애니메이션이 추가되지 않았음을 PR diff 로 확인한다(REQ-AI10-005). 자동 테스트는 "없는 것"의 부재만 확인할 수 있고 "추가되지 않았음"은 diff 속성이다.

---

### AC-AI10-004 — 세 타임아웃 계층의 단일 소스와 순서 불변식

**매핑**: REQ-AI10-007, REQ-AI10-008

**Given** `src/lib/ai/waitNotice.ts`(또는 이를 대체하는 단일 상수 모듈)에서 세 상수를 import 하면

**When** 값을 확인하면

**Then** 다음이 모두 참이다:
1. 소프트 대기 안내 값이 `8000`(기존 `WAIT_NOTICE_DELAY_MS` **무변경**).
2. 백엔드 하드 워치독 미러 값이 `60_000` — `src-tauri/src/ai/mod.rs:32` 의 `WATCHDOG_TIMEOUT_SECS = 60` 과 일치한다.
3. `소프트 대기 안내 < 백엔드 미러 < 프론트 백스톱` 순서가 성립한다(REQ-AI10-008 순서 불변식).
4. 프론트 백스톱과 백엔드 미러가 **같지 않다**(경합 순서가 보장되지 않으므로 동값도 금지).

**Given** 세 상수가 전부 **하나의 모듈**에서 export 되는지

**When** import 경로를 확인하면

**Then** 서로 다른 모듈에 흩어져 있지 않다(단일 소스, REQ-AI10-007).

**Given** 기존 `WAIT_NOTICE_TEXT` 를

**When** 확인하면

**Then** 값·이름·export 가 무변경이고 `src/test/aiWaitNotice.test.ts` 가 **무수정 전수 통과**한다.

**코드 리뷰(diff)**: 프론트 백스톱 값이 백엔드 미러 상수로부터 **파생**되었는지(예: 미러 + 유예), 독립된 두 번째 매직 넘버로 적혀 있지 않은지를 PR diff 로 확인한다. 백엔드 미러 상수에 `src-tauri/src/ai/mod.rs:32` 를 가리키는 주석이 붙어 있는지도 확인한다 — 백엔드만 값이 바뀌는 경우는 순서 불변식 테스트가 잡지 못하는 유일한 케이스이므로 사람이 읽을 단서가 필요하다(REQ-AI10-007).

---

### AC-AI10-005 — 프론트 백스톱: 종결 이벤트 부재 시 복구 가능한 오류 카드 *(회귀)*

**매핑**: REQ-AI10-009, REQ-AI10-011

> **RED 확보 계약(HARD)**: 본 AC는 **현행 구현에서 반드시 실패**한다. 프론트에는 종결 보장이 없어 카드가 `streaming` phase 에 영구 고착하며, 탈출 경로는 수동 `✕ 취소`(`:332-334`)뿐이다. `waitNoticeTimer`(`:858-865`)는 8초 뒤 안내 문구만 띄우고 스스로 해제되며 종결을 만들지 않는다.

**Given** `vi.useFakeTimers()` 상태에서 카드를 `streaming` phase 로 진입시키고, **`ai://chunk`·`ai://done`·`ai://error` 를 한 번도 발생시키지 않으면**

**When** `vi.advanceTimersByTime(프론트 백스톱 임계)` 를 실행하면

**Then** 다음이 모두 참이다:
1. `controller.getState().phase === 'error'` 다.
2. 카드에 렌더된 문구가 **한국어 분류 문구**이며, 문자열에 `undefined`·`null`·`{`·`Error:`·`at ` 같은 raw 노출 흔적이 **포함되지 않는다**(SPEC-AI-001 REQ-AI-040 연장).
3. `errorKind` 가 기존 집합(`login|network|parse|other`)에 속한다(신규 kind 부재).
4. 재시도 성격 컨트롤(`.mdedit-ai-retry`)이 존재한다.
5. `.mdedit-ai-dismiss`(`닫기`, SPEC-AI-009 REQ-AI9-036 의 기존 경로 `:240-243`)가 존재한다.
6. 4·5가 **동시에** 존재한다 — 사용자가 "다시 해보기"와 "치우기" 중 어느 쪽도 못 하는 막다른 상태가 아니다(REQ-AI10-011).

**Given** 백스톱으로 만들어진 `error` 카드에서

**When** `.mdedit-ai-retry` 를 클릭하면

**Then** AC-AI10-001 진입점 4와 동일하게 카드가 `streaming` 으로 복귀하고 백스톱 타이머가 재무장된다.

**Given** 백스톱 임계 **직전**(1ms 부족)까지만 시간을 진행시키면

**When** 렌더를 검사하면

**Then** 카드가 여전히 `streaming` phase 다(임계 미만에서 조기 발동하지 않는다).

**Given** 백스톱 임계 이전에 `ai://error{kind:'timeout'}`(백엔드 워치독 산출)이 도착하면

**When** 이후 백스톱 임계를 경과시키면

**Then** 카드의 `errorMessage` 가 **백엔드가 보낸 분류 문구 그대로**이고 백스톱 문구로 덮어써지지 않는다(REQ-AI10-008 의 계층 순서가 실제로 지켜짐을 확인).

---

### AC-AI10-006 — 백스톱 타이머 생명주기: 무장·재무장·7경로 해제·누수 부재

**매핑**: REQ-AI10-010

**Given** `startSuggestionCard` 로 컨트롤러가 생성된 직후이면

**When** 백스톱 임계를 경과시키면

**Then** 카드가 `error` phase 로 전이한다(생성 시 무장, REQ-AI10-010 (a)).

**Given** 재요청을 발행한 뒤 백스톱 임계의 **절반**만 경과시키고, 다시 재요청을 발행한 뒤 **절반**을 경과시키면

**When** 렌더를 검사하면

**Then** 카드가 `error` 로 전이하지 **않았다**(재무장으로 타이머가 처음부터 다시 셈, REQ-AI10-010 (b)).

**Given** 다음 7개 종결·소멸 경로 각각에 대해:

| # | 경로 | 유발 방법 |
|---|------|-----------|
| 1 | `ai://done` 수신 | `controller.onComplete('결과')` |
| 2 | `ai://error` 수신 | `controller.onError({kind:'other', message:'…'})` |
| 3 | 사용자 취소 | `.mdedit-ai-cancel` 클릭 |
| 4 | 원문 편집 침입 | `controller.intrude()` |
| 5 | 원문 불일치 | `controller.markStale()` |
| 6 | 새 요청에 의한 취소 | `controller.cancelByNew()` |
| 7 | 제안 적용 / 닫기 | `.mdedit-ai-apply` 클릭 / `.mdedit-ai-dismiss` 클릭 |

**When** 해당 경로를 유발한 **뒤** 백스톱 임계와 대기 안내 임계를 모두 경과시키면

**Then** 추가 상태 전이가 발생하지 않고(경로 직후의 `phase` 가 유지됨), 재렌더 알림(`notifyActiveCard` 스파이)이 추가 호출되지 않는다(타이머 누수 부재, REQ-AI10-010 (c)).

> 경로 4(`intrude`)와 5(`markStale`)는 현행 구현에서 **어떤 타이머도 해제하지 않으므로**(`:971-973`·`:982-985`) 본 단언이 이 두 경로에서 실패해야 한다 — 추가 RED 확보 지점이다.

**Given** 대기 안내 타이머와 백스톱 타이머를 함께

**When** `controller.destroy()` 를 호출한 뒤 두 임계를 모두 경과시키면

**Then** 어떤 콜백도 발화하지 않는다(`destroy()` 가 두 타이머를 **모두** 해제, `:881-883` 확장).

---

### AC-AI10-007 — 카드 A의 재요청이 카드 B의 스트림을 굶기지 않음 *(회귀)*

**매핑**: REQ-AI10-012, REQ-AI10-013

> **RED 확보 계약(HARD)**: 본 AC는 **현행 구현에서 반드시 실패**한다. 카드 A의 재요청이 `store.startRequest`(`:1132`)로 `aiStore.requestId` 를 A' 로 옮기면, 그 순간부터 `useAiRelay.isCurrent(B)`(`src/hooks/useAiRelay.ts:36-38`)가 항상 `false` 가 되어 카드 B의 청크·done·**심지어 백엔드 워치독의 `timeout` 오류까지** 스토어에 닿기 전에 폐기된다. 가중 요인으로 `startSuggestionCard`(`:1153`)의 `activeCardUnsub?.()` 가 직전 카드의 구독을 끊는다.

**Given** 다음 시나리오를 구성하면:
1. 카드 A 를 만들고 `ai://done` 을 주어 `done` phase(검토 대기)로 둔다 — requestId `'req-A'`.
2. 카드 B 를 만들어 `streaming` phase 로 둔다 — requestId `'req-B'`.
3. 두 카드가 모두 `getCardControllers()` 에 등록되어 있음을 확인한다(SPEC-AI-001 REQ-AI-034 — 검토 대기 카드는 새 요청에도 생존).

**When** 다음을 순서대로 실행하면:
4. 카드 A 의 `.mdedit-ai-retry` 를 클릭한다(재요청 발행 → in-flight 슬롯이 `'req-A2'` 로 이동).
5. `'req-B'` 를 requestId 로 하는 `ai://chunk` 를 **여러 번**(예: `'첫'`, `' 조각'`, `' 완성'`) 발생시킨다.
6. `'req-B'` 를 requestId 로 하는 `ai://done{result:'첫 조각 완성'}` 을 발생시킨다.

**Then** 다음이 모두 참이다:
1. 카드 B 의 `phase` 가 `'done'` 이다(굶지 않고 정상 종결).
2. 카드 B 의 DOM 에 제안 본문 `'첫 조각 완성'` **전체**가 렌더된다 — 마지막 청크만 남지 않는다(델타 누적이 올바름).
3. 카드 A 는 재요청에 따라 `streaming` phase 다(AC-AI10-001 과 일관).

**Given** 위 상태에서 이어서

**When** 카드 A 의 백스톱 임계를 경과시켜 A 만 백스톱을 발동시키면

**Then** 다음이 모두 참이다:
1. 카드 A 의 `phase` 가 `'error'` 다.
2. 카드 B 의 `phase` 가 **`'done'` 그대로**이고 제안 본문도 그대로다(백스톱의 국소성, REQ-AI10-013 (b)).
3. 편집기 문서 문자열이 백스톱 발동 전후로 **바이트 동일**하다(REQ-AI10-013 (a)).
4. 카드 B 에 대한 취소 IPC(`aiCancel` mock)가 호출되지 않았다(REQ-AI10-013 (c)).

**Given** 카드가 3개 이상 공존하는 상태에서

**When** 각각 자기 requestId 의 이벤트를 받으면

**Then** 각 카드가 **자기 이벤트만** 소비한다 — 어떤 카드도 다른 카드의 청크를 자기 버퍼에 누적하지 않는다(라우팅 정확성).

**Given** 컨트롤러가 `destroy()` 되면

**When** 그 카드의 requestId 로 이벤트를 발생시키면

**Then** 아무 일도 일어나지 않고 예외도 발생하지 않는다(구독 해제가 `destroy()` 에 묶임 — 채택안 C 계약).

**Given** `src/test/aiStore.test.ts` 와 `src/test/aiRelay.test.ts` 를

**When** **한 줄도 수정하지 않고** 실행하면

**Then** 전수 통과한다 — `aiStore` 의 단일 슬롯 의미론과 `useAiRelay` 의 기존 스토어 릴레이 경로가 보존되었음을 보증한다(고스트 텍스트 경로 무영향).

---

### AC-AI10-008 — clearCardRegistry 가 모든 컨트롤러의 타이머를 파괴

**매핑**: REQ-AI10-014

**Given** 컨트롤러 **2개 이상**이 `cardRegistry` 에 등록되어 있고 각각의 대기 안내 타이머·백스톱 타이머가 무장된 상태이면

**When** `clearCardRegistry()` 를 호출하고 대기 안내 임계와 백스톱 임계를 **모두** 경과시키면

**Then** 다음이 모두 참이다:
1. `getCardControllers()` 가 빈 배열이다.
2. 어떤 타이머 콜백도 발화하지 않는다 — `notifyActiveCard` 스파이가 `clearCardRegistry()` 호출 이후 **추가 호출되지 않는다**(`clearCardRegistry` 자신의 1회 호출은 제외).
3. 어떤 컨트롤러도 `error` phase 로 전이하지 않는다(사라진 카드에 대한 백스톱 발화 부재).

> **현행 구현에서 실패한다** — `clearCardRegistry`(`:806-812`)는 `cardRegistry.clear()` 로 Map 만 비우고 각 컨트롤러의 `destroy()`(`:881-883`)를 호출하지 않는다.

**Given** `clearCardRegistry()` 호출 이후

**When** 새 카드를 `startSuggestionCard` 로 만들면

**Then** 정상 등록·렌더되고 두 타이머가 무장된다(정리가 레지스트리를 영구 무력화하지 않음).

**Given** 등록된 컨트롤러가 **0개**인 상태에서

**When** `clearCardRegistry()` 를 호출하면

**Then** 예외 없이 no-op 으로 종료한다.

---

### AC-AI10-009 — 파일 전환 정리 회귀 없음 (SPEC-AI-009 계약 보존)

**매핑**: REQ-AI10-015

**Given** `src/test/aiFileSwitchEffects.test.ts` 와 `src/test/aiOffEffects.test.ts` 를

**When** **한 파일도 수정하지 않고** 실행하면

**Then** 전수 통과한다 — SPEC-AI-009 REQ-AI9-033/034/035 의 계약이 전부 유지된다:
1. `fileStore.currentFile` 이 다른 값으로 전이하면 in-flight 취소 + 고스트 `clearGhostEffect` dispatch + `clearCardRegistry()` 3동작이 **각각 1회** 발생.
2. 동일 경로 재설정 시 미발동.
3. 구독 해제 함수 호출 후 미발동.
4. 정리 전후 편집기 문서 문자열이 **바이트 동일**(무손상 불변, REQ-AI9-035).
5. `runAiOffCleanup`(AI OFF 전이)과 파일 전환 정리가 **동일한 공용 함수**(`runAiArtifactCleanup`, `aiOffEffects.ts:28-43`)를 호출.

**Given** REQ-AI10-014 의 `destroy()` 순회가 `clearCardRegistry` 에 추가된 뒤

**When** 파일 전환 정리를 실행하면

**Then** 3동작의 **발동 조건·순서·효과**가 동일하고, 추가로 타이머 누수만 사라진다 — `getCardControllers().length === 0` 이라는 관측 결과는 개정 전과 같다.

**코드 리뷰(diff)**: `src/lib/ai/aiFileSwitchEffects.ts`·`src/lib/ai/aiOffEffects.ts`·`src/components/layout/AppLayout.tsx` 세 파일의 diff 가 없음을 PR 에서 확인한다(REQ-AI10-015). 이 동작은 커밋 `37059a7`(v0.13.0)에 이미 구현되어 있으므로 본 SPEC 은 재구현하지 않는다.

---

### AC-AI10-010 — insert-below 가 마크다운 블록 바로 아래로 삽입 *(회귀)*

**매핑**: REQ-AI10-016, REQ-AI10-017, REQ-AI10-018, REQ-AI10-020, REQ-AI10-021

> **RED 확보 계약(HARD)**: 아래 (a)(b)(c)는 **현행 구현에서 반드시 실패**한다 — `applySuggestion` insert-below 분기(`:553-554`)가 `docText.slice(ctx.to).indexOf('\n\n')` 로 문단 끝을 찾고 빈 줄이 없으면 `view.state.doc.length` 로 폴백하므로, 세 케이스 모두 삽입이 **문서 맨 끝**으로 튄다.

#### 경계 함수 규칙 (REQ-AI10-016, REQ-AI10-017)

**Given** 블록 경계 순수 함수(예: `findBlockEnd(doc, from)`)가 export 된 상태에서

**When** React·CodeMirror·DOM 없이 문자열 인자만으로 호출하면

**Then** 정상 동작한다(순수 함수 계약, REQ-AI10-016).

**Given** 스캔 시작 줄 다음 줄이 다음 7종 중 하나이면 — ATX 제목(`# 제목`~`###### 제목`), 순서 없는 목록(`- 항목`/`* 항목`/`+ 항목`), 순서 있는 목록(`1. 항목`/`1) 항목`), 인용(`> 인용`), 표 행(`| a | b |`), 코드 펜스(` ``` `/`~~~`), 구분선(`---`/`***`/`___`)

**When** 함수를 호출하면

**Then** 각 케이스에서 **그 줄 직전에서 멈춘다** — 반환값이 시작 줄의 끝(개행 문자 **앞**) 오프셋이다.

**Given** 다음 줄이 빈 줄(`''`) 또는 공백만 있는 줄(`'   '`)이면

**When** 함수를 호출하면

**Then** 동일하게 그 줄 직전에서 멈춘다.

**Given** 다음 줄이 산문 연속 줄(비어 있지 않고 7종 블록 시작도 아님)이면

**When** 함수를 호출하면

**Then** 계속 전진해 블록 시작 줄·빈 줄·EOF 중 먼저 만나는 지점 직전에서 멈춘다.

**Given** **setext 밑줄 예외** — 산문 줄 바로 다음에 `-` 만으로 이뤄진 줄(`'---'`) 또는 `=` 만으로 이뤄진 줄(`'==='`)이 오면

**When** 함수를 호출하면

**Then** 그 줄을 **구분선이 아니라 setext 제목 밑줄**로 보아 연속 줄로 취급하고 멈추지 않는다(REQ-AI10-017 예외). 반대로 **빈 줄 다음**의 `'---'` 은 구분선이므로 멈춘다.

**Given** 들여쓰기가 있는 블록 시작 후보를

**When** 함수에 전달하면

**Then** 0~3칸 들여쓰기는 블록 시작으로 인정하고, **4칸 이상**은 들여쓴 코드로 보아 블록 시작으로 취급하지 않는다.

**Given** 스캔이 블록 시작 줄도 빈 줄도 만나지 못한 채 문서 끝에 도달하면

**When** 반환값을 확인하면

**Then** `doc.length` 다(REQ-AI10-021).

**Given** 반환값의 의미를

**When** 확인하면

**Then** **개행 문자 앞** 오프셋이다 — 개행을 포함하면 insert-below 가 `\n\n` 을 덧붙일 때 빈 줄이 하나 더 생긴다.

#### (a) 제목 + 단일 개행 목록 — 삽입이 제목 줄 바로 다음

**Given** 문서가 `'## 요약\n- 하나\n- 둘\n- 셋'` 이고 선택 범위가 `'## 요약'`(offset 0~5)이면

**When** `applySuggestion(view, { from:0, to:5, originalText:'## 요약', suggestion:'추가 문단', mode:'insert-below' })` 를 실행하면

**Then** 결과 문서가 정확히 `'## 요약\n\n추가 문단\n- 하나\n- 둘\n- 셋'` 이다 — 삽입이 제목 줄 바로 다음이며 문서 끝이 아니다.

#### (b) 표 영역 — 삽입이 현재 표 행 바로 다음

**Given** 문서가 `'| a | b |\n|---|---|\n| 1 | 2 |'` 이고 선택 범위가 첫 행 `'| a | b |'` 이면

**When** 동일하게 `insert-below` 로 `'삽입 내용'` 을 적용하면

**Then** 결과 문서가 정확히 `'| a | b |\n\n삽입 내용\n|---|---|\n| 1 | 2 |'` 이다 — 삽입 위치가 **문서 끝이 아니다**.

#### (c) 여러 줄 산문 문단 — 삽입이 문단 전체 뒤

**Given** 문서가 `'첫 줄입니다\n둘째 줄입니다\n셋째 줄입니다\n## 다음 절'` 이고 선택 범위가 `'첫 줄입니다'`(첫 줄)이면

**When** 동일하게 `insert-below` 로 `'삽입 내용'` 을 적용하면

**Then** 결과 문서가 정확히 `'첫 줄입니다\n둘째 줄입니다\n셋째 줄입니다\n\n삽입 내용\n## 다음 절'` 이다 — 삽입이 **문단 전체 뒤**이며 문장 사이(첫 줄과 둘째 줄 사이)가 **아니다**(REQ-AI10-020).

#### (d) 빈 줄 없이 EOF — 문서 끝 삽입 (현행 유지)

**Given** 문서가 `'- 하나\n- 둘\n- 셋'`(빈 줄 없음, 선택 이후 블록 시작만 이어지다 EOF)이고 선택 범위가 마지막 항목 `'- 셋'` 이면

**When** 동일하게 `insert-below` 로 `'삽입 내용'` 을 적용하면

**Then** 결과 문서가 정확히 `'- 하나\n- 둘\n- 셋\n\n삽입 내용'` 이다(REQ-AI10-021).

**Given** `src/test/aiSuggestionApply.test.ts` 의 기존 두 케이스 — `\n\n` 이 존재하는 케이스("keeps the original and inserts the suggestion after the paragraph with a blank line")와 EOF 케이스("inserts at document end when the selection is in the last paragraph") — 를

**When** **한 줄도 수정하지 않고** 실행하면

**Then** 전수 통과한다(회귀 가드, REQ-AI10-021).

---

### AC-AI10-011 — expandToSentenceBoundary 가 종결 부호 부재 시 EOF 까지 확장하지 않음 *(회귀)*

**매핑**: REQ-AI10-016, REQ-AI10-019

> **RED 확보 계약(HARD)**: 본 AC의 첫 단언은 **현행 구현에서 반드시 실패**한다 — `expandToSentenceBoundary`(`:501-502`)가 `doc.slice(to).indexOf('\n\n')` 로 문단 끝을 찾고 빈 줄이 없으면 `doc.length` 로 폴백한다. 이 산출은 카드의 `range` 가 되고 그 range 는 `applySuggestion` 의 **replace 모드에서 파괴적으로 덮어써지는 범위**이므로, 결함 3의 두 절반 중 더 위험한 쪽이다.

**Given** 문서가 `'## 제목\n- 하나\n- 둘\n- 셋'`(종결 부호 `.!?。` 가 하나도 없고 빈 줄도 없음)이고 `from=0, to=3`(제목 중간에서 끊긴 선택)이면

**When** `expandToSentenceBoundary(doc, 0, 3)` 을 호출하면

**Then** 반환 `to` 가 **`'## 제목'` 줄의 끝**(개행 앞)이고 `doc.length` 가 **아니다**. `expanded` 가 `true` 다.

**Given** 문서가 `'첫 줄\n둘째 줄\n## 다음 절'`(산문 연속 줄 뒤 제목)이고 `from=0, to=2` 이면

**When** 동일하게 호출하면

**Then** 반환 `to` 가 `'둘째 줄'` 의 끝이다 — 산문 문단 전체는 포함하되 다음 블록으로 넘어가지 않는다.

**Given** 종결 부호가 존재하는 기존 케이스 — 예: `'Keep this. Extra sentence here. Tail.'` 에서 문장 중간 선택 — 이면

**When** 동일하게 호출하면

**Then** 반환값이 개정 전과 **동일**하다(종결 부호를 먼저 찾는 루프 `:503-507` 무변경).

**Given** 선택이 이미 종결 부호에서 끝나거나(`prevChar` 가 `.!?。`) 문단 경계에서 끝나면(`nextChar` 가 `undefined` 또는 `'\n'`)

**When** 호출하면

**Then** `{ from, to, expanded: false }` 를 그대로 반환한다(조기 반환 `:493-499` 무변경).

**Given** insert-below 와 `expandToSentenceBoundary` 두 소비 지점의 구현을

**When** 검토하면

**Then** **동일한** 경계 함수를 호출한다 — 판정 규칙이 두 곳에 복제되어 있지 않다(REQ-AI10-019). 복제되면 파괴적 replace 범위와 비파괴적 삽입 위치가 서서히 갈라진다.

---

### AC-AI10-012 — 무손상 계약 보존 + 기존 테스트 무수정 통과

**매핑**: REQ-AI10-022

**Given** 카드 생성 시점 원문과 **다른** 텍스트가 range 에 들어 있는 상태에서

**When** `applySuggestion` 을 `replace`·`insert-below` 각 모드로 호출하면

**Then** 두 모드 모두 `{ applied: false, reason: 'stale' }` 를 반환하고 편집기 문서 문자열이 **바이트 동일**하다(원문 재검증 `:541-544` 보존).

**Given** 원문이 일치하는 상태에서 `insert-below` 로 제안을 적용하면

**When** `undo`(`Mod+Z` 상당)를 **1회** 실행하면

**Then** 문서가 적용 직전 상태와 **바이트 동일**하다 — 단일 `changes` 트랜잭션이므로 한 번에 복원된다(`:555` 구조 보존).

**Given** `replace` 모드로 제안을 적용하면

**When** 결과 문서와 `undo` 동작을 확인하면

**Then** 개정 전과 동일하다 — 본 SPEC 은 `replace` 분기(`:546-549`)를 건드리지 않는다.

**Given** 삽입 내용의 형태를

**When** 확인하면

**Then** 여전히 `'\n\n' + 제안 본문`(`PARAGRAPH_SEP` + suggestion, `:555`)이다 — 경계 **탐색** 에서만 `PARAGRAPH_SEP` 사용이 사라지고 **삽입 구분자** 용도는 그대로다.

**Given** 다음 회귀 가드 테스트 파일들을

**When** **한 파일도 수정하지 않고**(`aiSuggestionApply.test.ts` 는 신규 `describe` **추가**만) 실행하면

**Then** 전수 통과한다:
- `src/test/aiSuggestionApply.test.ts`(기존 케이스)
- `src/test/aiSuggestionCardRerequest.test.ts`
- `src/test/aiWaitNotice.test.ts`
- `src/test/aiFileSwitchEffects.test.ts`
- `src/test/aiSuggestionCard.test.ts`
- `src/test/aiSuggestionCardRender.test.ts`
- `src/test/aiSuggestionCardWidget.test.ts`
- `src/test/aiRelay.test.ts`
- `src/test/aiStore.test.ts`
- `src/test/aiOffEffects.test.ts`

**코드 리뷰(diff)**: 원문 재검증의 위치·조건, dispatch 가 단일 `changes` 트랜잭션이라는 **구조**, `replace` 분기의 무변경은 PR diff 로 확인한다 — 테스트는 동작을 확인할 수 있지만 "구조가 유지되었는지"는 diff 속성이다(REQ-AI10-022).

---

## Edge Cases (Additional Coverage)

> AC-AI10-001~012 외에 추가로 검증해야 할 경계 케이스.

### EC-1 — 재요청 직후 즉시 오류가 도착

**Given** 재요청을 발행해 카드가 `streaming` 으로 복귀한 직후

**When** 첫 청크 없이 `ai://error` 가 도착하면

**Then** 카드가 `error` phase 로 전이하고 두 타이머(대기 안내·백스톱)가 **모두** 해제된다. 스켈레톤은 사라지고 오류 문구 + 재시도 + 닫기가 렌더된다.

### EC-2 — 재요청을 연달아 빠르게 여러 번 클릭

**Given** 사용자가 `↻ 다시` 를 짧은 간격으로 3회 클릭하면

**When** 각 클릭이 재요청을 발행하면

**Then** 카드는 계속 `streaming` 이고 버퍼는 매번 리셋되며, 대기 안내·백스톱 타이머가 매번 재무장된다. 이전 요청들은 백엔드 in-flight 교체 로직이 처리하며 프론트는 마지막 `boundRequestId` 만 추적한다(기존 계약).

### EC-3 — 백스톱 발동 직후 지연된 `ai://done` 도착

**Given** 백스톱으로 카드가 `error` phase 가 된 직후

**When** 같은 requestId 의 `ai://done` 이 뒤늦게 도착하면

**Then** 카드가 `done` phase 로 전환된다(늦게라도 결과가 왔으면 보여주는 것이 사용자에게 유익하다). 단 문서 텍스트는 변경되지 않으며, 이미 사라진 카드(레지스트리 미등록)에는 아무 영향이 없다(SPEC-AI-009 EC-10 과 일관).

### EC-4 — 카드가 0개인 상태에서 이벤트 도착

**Given** 모든 카드가 닫히거나 적용되어 레지스트리가 비어 있으면

**When** 임의 requestId 의 `ai://chunk`/`done`/`error` 가 도착하면

**Then** 아무 일도 일어나지 않고 예외도 발생하지 않는다. 고스트 경로의 스토어 릴레이는 기존대로 동작한다.

### EC-5 — 파일 전환과 백스톱 만료가 경합

**Given** 카드의 백스톱 임계가 임박한 상태에서 사용자가 파일을 전환하면

**When** `runAiArtifactCleanup` → `clearCardRegistry` → 각 컨트롤러 `destroy()` 가 실행된 뒤 임계가 지나면

**Then** 백스톱 콜백이 발화하지 않는다(REQ-AI10-014). 문서 텍스트는 두 시점 모두 무변경이다.

### EC-6 — 선택 끝이 줄의 마지막 문자인 경우

**Given** 선택 범위의 끝이 줄의 마지막 문자 직후(개행 바로 앞)이면

**When** 경계 함수를 호출하면

**Then** 스캔은 **다음 줄부터** 시작한다 — 시작 줄 자신의 블록 시작 여부를 판정하지 않으므로, 선택된 줄이 목록 항목이어도 즉시 0폭으로 멈추지 않는다(REQ-AI10-017 규칙 1).

### EC-7 — 선택 끝이 문서 마지막 문자인 경우

**Given** 선택 범위의 끝이 `doc.length` 이면

**When** 경계 함수를 호출하면

**Then** 다음 줄이 없으므로 `doc.length` 를 반환하고, insert-below 는 문서 끝에 `\n\n` + 제안을 붙인다(기존 EOF 동작과 동일).

### EC-8 — 코드 펜스 내부 선택 (알려진 한계)

**Given** 선택이 펜스 코드 블록 **내부**에 있으면

**When** 경계 함수가 닫는 펜스 줄(` ``` `)을 만나면

**Then** 그 줄을 블록 시작으로 판정해 멈추고, 삽입 지점이 코드 본문과 닫는 펜스 **사이**가 된다. v1에서는 이를 **알려진 한계로 허용**한다 — AI 인라인 편집·표 생성·다이어그램 생성의 대상은 산문·표·목록이며 코드 블록 내부 텍스트를 선택해 "아래에 삽입"하는 것은 설계된 사용 흐름이 아니다(spec.md Design Notes·Exclusions). 실제 사용자 보고가 나오면 별도 REQ 로 다룬다.

### EC-9 — 빈 문서 / 한 줄짜리 문서

**Given** 문서가 `''` 또는 개행 없는 한 줄이면

**When** 경계 함수를 호출하면

**Then** `doc.length` 를 반환하고 예외가 발생하지 않는다.

### EC-10 — 백엔드 워치독 `timeout` 오류와 프론트 백스톱의 순서

**Given** 백엔드가 정상 동작해 60초 시점에 `ai://error{kind:'timeout'}` 을 emit 하면

**When** 프론트 백스톱 임계가 그보다 뒤에 도래하면

**Then** 사용자는 **백엔드의 분류된 timeout 오류**를 본다. 프론트 백스톱은 이미 해제되었으므로 문구를 덮어쓰지 않는다(REQ-AI10-008 계층 순서의 실효 확인).

---

## Definition of Done

> 아래 전부 충족 시 본 SPEC 구현이 완료된 것으로 간주한다.

### 코드 품질 게이트

- [ ] `npm run typecheck` 클린.
- [ ] `npm run lint` 클린(이 저장소에서 lint 는 실질 게이트다 — `console.log` 잔존은 실패로 이어진다).
- [ ] `npm test`(Vitest) 전수 통과 — 신규 4개 파일 + 회귀 가드 10개 파일 포함.
- [ ] `npm run test:e2e` 1회 실행(카드 렌더 변경의 영향 확인).
- [ ] `cargo test` + `cargo clippy` 무경고 — M0.3 기준선과 **동일**(백엔드 무변경).
- [ ] `cargo build --release` 성공.
- [ ] 테스트 커버리지 목표 85% 유지.

### SPEC 요구사항 커버리지

- [ ] REQ-AI10-001~022 전수(22건) 구현 및 매핑된 AC-AI10-001~012 전수(12건) 통과.
- [ ] "사전 합의 설계 결정(재검토 금지)" 4가지가 코드에 정확히 반영(기존 streaming 렌더 재사용 / 프론트 워치독+다중 카드 구독 범위 / 마크다운 블록 경계 / 순수 export 경계 함수).
- [ ] Exclusions 전 항목 준수(가짜 진행 표시 부재, 신규 phase 부재, `aiStore` 재설계 부재, 백엔드 무변경, 백스톱 순서 불변식, 파일 전환 정리 재구현 부재, 무손상 계약 무변경, 펜스 상태 추적 부재, `PARAGRAPH_SEP` 존치, IPC 무변경, 카드 영속화 부재).
- [ ] **결함 1 수정 확인** — 5개 진입점 전부에서 재요청 즉시 streaming 렌더 + 스켈레톤 + 직전 본문 부재, 8초 대기 안내 재출현(AC-AI10-001·002·003).
- [ ] **결함 2 수정 확인** — 세 임계 순서 불변식, 백스톱 만료 시 복구 가능한 error 카드, 타이머 7경로 해제, 카드 A 재요청이 카드 B를 굶기지 않음, `clearCardRegistry` 타이머 파괴(AC-AI10-004·005·006·007·008).
- [ ] **결함 3 수정 확인** — insert-below 4케이스가 블록 바로 아래로, `expandToSentenceBoundary` 가 EOF 까지 확장하지 않음, 경계 함수 규칙 전수(AC-AI10-010·011).
- [ ] **TDD 순서 준수** — AC-AI10-001·005·007·010 (a)(b)(c)·011 의 회귀 단언이 구현 **이전에** RED 로 관측됨. AC-AI10-006 의 `intrude`/`markStale` 경로 단언도 수정 전 실패해야 한다.

### 회귀 보장

- [ ] SPEC-AI-001 기존 AC 전수 통과 — 특히 REQ-AI-022/033/035 무손상 계약과 REQ-AI-034 검토 대기 카드 생존.
- [ ] SPEC-AI-006 기존 AC 전수 통과 — 8초 대기 안내 계약(REQ-AI6-007/008)과 가짜 진행 표시 금지(REQ-AI6-009).
- [ ] SPEC-AI-009 기존 AC 전수 통과 — 특히 REQ-AI9-033/034/035 파일 전환 정리와 REQ-AI9-036/037 종결 phase 닫기(AC-AI10-009).
- [ ] 회귀 가드 10개 테스트 파일이 **무수정** 통과(`aiSuggestionApply.test.ts` 는 신규 `describe` 추가만). **단언 완화 부재** — 통과시키려고 기존 단언을 느슨하게 고친 흔적이 없다.

### 코드 리뷰(diff) 계층

> 자동 테스트가 판정할 수 없는 항목이다. "테스트가 통과했으므로 지켜졌다"고 주장하지 않는다.

- [ ] 신규 `CardPhase` 값·신규 위젯·진행률 DOM 이 추가되지 않음(REQ-AI10-005).
- [ ] `src/lib/ai/aiFileSwitchEffects.ts`·`src/lib/ai/aiOffEffects.ts`·`src/components/layout/AppLayout.tsx` diff 없음(REQ-AI10-015).
- [ ] `applySuggestion` 의 원문 재검증 위치·단일 트랜잭션 구조·`replace` 분기 무변경(REQ-AI10-022).
- [ ] 프론트 백스톱이 백엔드 미러 상수에서 **파생**되고 독립 리터럴이 아니며, 미러 상수에 `src-tauri/src/ai/mod.rs:32` 참조 주석이 있음(REQ-AI10-007).
- [ ] `src/store/aiStore.ts` diff 없음, `src-tauri/` diff 없음(plan.md 채택안 C 계약).
- [ ] 회귀 가드 테스트 9개 파일 diff 0줄, `aiSuggestionApply.test.ts` 는 추가만.

### 수동 검증

- [ ] **M4.4** — 실기기에서 `↻`·`↻ 다시`·`⚡ 고급 모델로 다시 시도` 클릭 즉시 카드가 스켈레톤/글로우로 복귀하고 옛 제안 본문이 사라진다. 8초 이상 걸리는 요청에서 대기 안내가 뜬다.
- [ ] **M4.5** — 카드 A 검토 대기 + 카드 B 진행 중 상태에서 A 재요청 후 B가 정상 완료된다. 프로바이더 정지 시 백엔드 60초 오류가 먼저 오고, 그마저 없으면 프론트 백스톱이 복구 가능한 오류 카드를 낸다.
- [ ] **M4.6** — 표/목록으로 끝나는 실제 문서에서 "아래에 삽입"이 문서 맨 아래가 아니라 현재 블록 바로 다음에 들어간다. 여러 줄 산문 문단 중간을 선택해도 문장 사이로 끼어들지 않는다.

### 문서화

- [ ] SPEC 디렉토리(`.moai/specs/SPEC-AI-010-ai-card-progress-and-insert/`)에 spec.md, plan.md, acceptance.md 3개 파일 존재.
- [ ] PR 본문에 SPEC-ID 참조 및 주요 변경 사항 요약.
- [ ] `@MX:SPEC: SPEC-AI-010` 태그가 신규 함수(`enterReRequest`·백스톱 타이머·`findBlockEnd`)와 변경된 `@MX:ANCHOR` 대상(`applySuggestion`·`startSuggestionCard`)에 부착됨(MX Tag Protocol). @MX 서술·`@MX:REASON` 은 `code_comments: ko` 설정에 따라 **한국어**로 작성.

---

Version: 0.0.1 (draft)
Classification: spec-anchored
Last Updated: 2026-07-27
