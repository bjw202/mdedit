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
lifecycle: spec-anchored
---

# SPEC-AI-010 Implementation Plan — AI 카드 재요청 진행 표시 · 종결 보장 · 블록 경계 삽입

> 본 plan.md는 spec.md의 REQ-AI10-001~022를 구현 순서로 전개한다. 사전 합의된 4가지 결정(기존 streaming 렌더 재사용 / 프론트 워치독+다중 카드 구독 범위 / 마크다운 블록 경계 / 순수 export 경계 함수)은 본 plan 전체에 걸쳐 불변 전제로 둔다.
>
> **불변 제약(전 마일스톤 공통)**: (a) `src-tauri/` **무변경** — 백엔드 워치독 60초·릴레이·파서·프롬프트 조립 전부 그대로다. (b) `applySuggestion` 의 원문 재검증·단일 트랜잭션·`replace` 분기 **무변경**(REQ-AI10-022). (c) SPEC-AI-009 REQ-AI9-033/034/035 파일 전환 정리는 **재구현하지 않는다**(REQ-AI10-015). (d) IPC 계약·이벤트 payload 스키마 무변경.

## 개발 방법론

`quality.yaml` `development_mode: tdd`, `test_coverage_target: 85` — M1·M2·M3의 모든 작업은 **RED → GREEN → REFACTOR** 순서로 수행한다.

- **RED**: 대응 AC의 **Then** 절을 그대로 실패하는 테스트로 옮긴다. 다음 다섯 회귀 단언은 **수정 전 반드시 실패**해야 하며, 실패하지 않으면 재현이 잘못된 것이므로 시나리오를 다시 잡는다.
  - AC-AI10-001(재요청 직후 `streaming` 렌더 + 스켈레톤) — 현행은 `done` phase 유지
  - AC-AI10-005(백스톱 만료 → 복구 가능 `error`) — 현행은 `streaming` 영구 고착
  - AC-AI10-007(카드 A 재요청이 카드 B를 굶기지 않음) — 현행은 B의 이벤트가 `isCurrent` 에서 폐기
  - AC-AI10-010 (a)(b)(c)(insert-below 블록 경계) — 현행은 전부 문서 끝으로 감
  - AC-AI10-011(`expandToSentenceBoundary` 상한) — 현행은 `doc.length` 까지 확장
- **GREEN**: 테스트를 통과시키는 최소 변경만 수행한다.
- **REFACTOR**: 중복 제거(경계 판정 헬퍼 공유, 타이머 생명주기 공통화)를 이 단계에서 수행하고 테스트 그린을 유지한다.

## 구현 원칙

1. **단일 진입 지점 원칙**: 사용자 개시 재요청 5종은 이미 `callbacks.onReRequest` 하나로 수렴한다(`ai-suggestion-card.ts:1188-1193`). 진행 표시 처리를 다섯 렌더 핸들러에 흩뿌리지 않고 그 배선 한 곳에서 처리한다 — 여섯 번째 진입점이 생겨도 자동으로 덮인다.
2. **순수 함수 우선**: 블록 경계 탐색은 `(string, number) => number` 순수 함수로 분리해 CodeMirror 없이 단위 테스트한다(`expandToSentenceBoundary`·`isEmptyOrIdentical` 의 확립된 관례).
3. **타이머 규율 복제**: 백스톱 타이머는 기존 `waitNoticeTimer`(`:847`, `:858-878`, `:881-883`)의 arm/rearm/clear/destroy 규율을 **그대로** 따른다 — 새 패턴을 발명하면 해제 누락 지점이 늘어난다.
4. **가장 작은 변경**: 결함 2b는 이벤트 라우팅 계층에서 닫고 `aiStore` 는 건드리지 않는다(M2.3 결정 기록). 결함 3은 두 소비 지점이 같은 함수를 호출하도록 바꾸는 것으로 끝난다.
5. **회귀 가드 우선 배치**: 각 마일스톤의 첫 단계에서 기존 테스트가 현재 그린인지 확인해 기준선을 고정한 뒤 변경을 시작한다.

## Milestones (우선순위 순서, 시간 추정 금지)

> Time estimate 는 품질 게이트 설정(coding-standards.md)에 따라 금지. Priority 라벨과 순서만 명시.

### Milestone M0 — 기준선 확보 (Priority: High, BLOCKER)

> 어떤 프로덕션 코드도 건드리기 전에 완료되어야 한다.

- **M0.1**: `npm run typecheck` + `npm run lint` + `npm test` 를 현행 main 에서 실행해 **전수 그린**을 확인한다. 그린이 아니면 본 SPEC 범위 밖의 실패이므로 먼저 보고한다.
- **M0.2**: 회귀 가드 대상 테스트 파일을 명시적으로 기록한다 — `aiSuggestionApply.test.ts`, `aiSuggestionCardRerequest.test.ts`, `aiWaitNotice.test.ts`, `aiFileSwitchEffects.test.ts`, `aiSuggestionCard.test.ts`, `aiSuggestionCardRender.test.ts`, `aiSuggestionCardWidget.test.ts`, `aiRelay.test.ts`, `aiStore.test.ts`, `aiOffEffects.test.ts`. 이 10개는 본 SPEC 구현 후 **무수정 통과**해야 한다(단, `aiSuggestionApply.test.ts` 는 신규 케이스 **추가**만 허용하고 기존 케이스는 수정 금지).
- **M0.3**: `cargo test` + `cargo clippy` 기준선 확인. 백엔드 무변경이므로 이 값이 최종 상태와 같아야 한다.

**완료 기준**: 프론트·백엔드 품질 게이트가 현행에서 전수 그린이고, 회귀 가드 대상 목록이 고정됨.

### Milestone M1 — 결함 1: 사용자 개시 재요청의 진행 표시 (Priority: High)

> 변경 표면은 `src/components/editor/extensions/ai-suggestion-card.ts` 1개 파일이다. M2·M3와 파일이 겹치지만 손대는 함수가 달라(컨트롤러 메서드 + `onReRequest` 배선) 순차 진행이 안전하다.

- **M1.1 (RED — 5개 진입점 전수)**: `src/test/aiCardRerequestProgress.test.ts` 신설. `startSuggestionCard` 로 카드를 만들고 스토어를 구동해 각 진입점의 렌더 상태로 도달시킨 뒤, 해당 컨트롤을 클릭하고 **어떤 청크도 주지 않은 채** 다음을 단언한다: (1) 카드 루트에 `mdedit-ai-card-streaming` 클래스, (2) `.mdedit-ai-skeleton-line` 정확히 3개, (3) 직전 제안 본문 문자열이 카드 DOM 에 부재, (4) `.mdedit-ai-apply` 버튼 부재. 5개 진입점(`.mdedit-ai-redo` / `.mdedit-ai-retry`(done) / `.mdedit-ai-advanced` / `.mdedit-ai-retry`(error) / `.mdedit-ai-rerequest`) 각각에 대해 반복한다. **현행 구현에서 5건 전부 실패해야 한다** — RED 확인.
  - 진입점 4·5는 각각 `error`(errorKind 기타)·`intruded` phase 를 먼저 만들어야 한다. `controller.onError({kind:'other', message:'…'})` / `controller.intrude()` 로 도달한다.
  - `aiRequest` IPC 는 mock 으로 주입한다(`vi.mock('@/lib/tauri/ipc')`) — `aiSuggestionCardRerequest.test.ts` 의 기존 mock 패턴을 그대로 차용한다.
- **M1.2 (RED — 대기 안내 재무장)**: 같은 파일에 AC-AI10-002 를 작성한다. `vi.useFakeTimers()` 로 재요청 발행 → `advanceTimersByTime(WAIT_NOTICE_DELAY_MS)` → `.mdedit-ai-wait-notice` 존재를 단언한다. 추가로 "재요청 **직전** 이미 안내가 떠 있던 경우 재요청 시점에 사라졌다가 8초 뒤 다시 나타난다"를 단언해 재무장이 실제로 관측되게 한다.
- **M1.3 (GREEN — 컨트롤러 진입 메서드)**: `AiSuggestionCardController` 에 재요청 진입 메서드를 신설한다(예: `enterReRequest()`). 본문은 정확히 3가지다: (1) `this.streamBuffer = ''`(REQ-AI10-002), (2) `this.commit({ type: 'stream' })`(REQ-AI10-001), (3) `this.rearmWaitNotice()`(REQ-AI10-004, 기존 `:868-871` 재사용). `enterListFallback()`(`:997-1000`)이 "플래그 갱신 + `commit({type:'stream'})`" 형태의 선례이므로 그 바로 아래 형제 위치에 둔다.
- **M1.4 (GREEN — 배선)**: `onReRequest` 콜백(`:1188-1193`)에서 `fireReRequest` 호출 **이전에** `controller.enterReRequest()` 를 호출한다. 순서가 중요하다 — `fireReRequest` 내부의 `store.startRequest`(`:1132`)가 구독을 동기 발화시키므로, 그 이전에 카드가 이미 `streaming` 이어야 화면이 한 번도 `done` 으로 보이지 않는다. 기존 `controller.rearmWaitNotice()`(`:1192`) 호출은 `enterReRequest` 로 흡수되므로 **중복 호출을 남기지 않는다**.
- **M1.5 (GREEN — `onListFallback` 정합)**: `onListFallback` 배선(`:1194-1207`)도 `controller.enterListFallback()` + `fireReRequest` + `rearmWaitNotice()` 순서를 이미 갖고 있다. `enterListFallback` 은 `commit({type:'stream'})` 을 하지만 **버퍼는 리셋하지 않으므로** 같은 낡은 텍스트 문제를 갖는다 — `enterListFallback` 내부에서도 버퍼를 리셋해 두 경로의 동작을 일치시킨다. 단, 이는 REQ-AI10-006 의 "관측 가능한 동작 무변경" 대상이 아니다(목록 폴백의 `listFallbackActive` 플래그 궤적과 재시도 카운터는 그대로다) — 개선 근거를 커밋 메시지에 남긴다.
- **M1.6 (REFACTOR — 중복 커밋 확인)**: `handleTableComplete`(`:941`)·`handleDiagramComplete`(`:957`)는 `commit({type:'stream'})` 직후 `callbacks.onReRequest(...)` 를 호출하므로, M1.4 이후 이 경로에서 `stream` 이 두 번 커밋된다. `reduceCard` 의 `'stream'` 은 멱등(`:83-84`)이므로 상태는 안전하지만 `notifyActiveCard()` 가 두 번 발화한다. 관측 가능한 회귀가 없음을 AC-AI10-003 으로 확인하고, 중복이 실제 문제를 일으키면 **내부 경로의 선행 `commit` 을 제거**한다(배선에 조건 분기를 넣지 않는다 — 단일 책임).
- **M1.7 (RED→GREEN — 내부 경로 회귀)**: AC-AI10-003 을 작성한다. (1) 진행률 요소(`progress`·`[role="progressbar"]`·`%` 텍스트) 부재, (2) 다이어그램 자동 재시도 상한 소진 시점이 개정 전과 동일(`diagramAttempts` 궤적), (3) 목록 폴백 이후 mermaid 검증 미진입(`listFallbackActive`), (4) 표 검증 재요청이 정확히 1회. `aiSuggestionCardRerequest.test.ts` 의 기존 BUG-1/3(a)/6 시나리오가 **무수정 통과**하는 것으로 (2)(3)(4)의 상당 부분이 이미 덮이므로, 신규 테스트는 겹치지 않는 부분만 추가한다.

**완료 기준**: AC-AI10-001·002·003 전수 통과 + `aiSuggestionCardRerequest.test.ts`·`aiWaitNotice.test.ts` 무수정 통과.

### Milestone M2 — 결함 2: 종결 보장 + 카드 공존 (Priority: High)

> M2.1(상수) → M2.2(백스톱 타이머) → M2.3(이벤트 라우팅) → M2.4(레지스트리 누수) 순서. M2.3 이 가장 크므로 M2.2 까지 GREEN 을 확보한 뒤 착수한다.

#### M2.1 — 임계 상수 3계층 단일 소스

- **M2.1.1 (RED)**: `src/test/aiCardWatchdog.test.ts` 신설. AC-AI10-004 를 작성한다 — 세 상수를 `src/lib/ai/waitNotice.ts` 에서 import 해 (a) 백엔드 미러 값 === `60_000`, (b) `WAIT_NOTICE_DELAY_MS < 백엔드 미러 < 프론트 백스톱` 순서 불변식을 단언한다. 상수가 아직 없으므로 **컴파일 실패로 RED** 확인.
- **M2.1.2 (GREEN)**: `waitNotice.ts` 에 두 상수를 추가한다. 백엔드 미러 상수에는 `src-tauri/src/ai/mod.rs:32` 의 `WATCHDOG_TIMEOUT_SECS = 60` 을 가리키는 주석을 붙이고, 프론트 백스톱은 **미러 값 + 고정 유예**로 **파생**시킨다(독립 리터럴 금지, REQ-AI10-007). 파일 상단 `@MX:NOTE` 를 갱신해 세 계층(8초 소프트 → 60초 백엔드 하드 → 프론트 백스톱)의 관계와 각 값의 근거를 한국어로 문서화한다.
- **M2.1.3 (경계 확인)**: 기존 `WAIT_NOTICE_DELAY_MS`·`WAIT_NOTICE_TEXT`(`:7`·`:10`)의 값·이름·export 는 무변경이다. `aiWaitNotice.test.ts` 가 무수정 통과해야 한다.

#### M2.2 — 카드별 백스톱 타이머

- **M2.2.1 (RED)**: AC-AI10-005 를 작성한다. `vi.useFakeTimers()` 로 카드를 `streaming` 진입시킨 뒤 **어떤 종결 이벤트도 주지 않고** 프론트 백스톱 임계를 경과시키고 다음을 단언한다: (1) `phase === 'error'`, (2) 카드에 분류된 한국어 문구가 렌더되고 `undefined`·`{`·`Error:` 가 포함되지 않음, (3) 재시도 성격 컨트롤(`.mdedit-ai-retry`)과 `.mdedit-ai-dismiss` 가 **둘 다** 존재. **현행 구현에서 반드시 실패한다**(카드가 `streaming` 유지) — RED 확인.
- **M2.2.2 (RED — 생명주기)**: AC-AI10-006 을 작성한다. 종결·소멸 7경로(`onComplete` / `onError` / `onCancel` / `intrude` / `markStale` / `cancelByNew` / 적용·닫기) 각각을 유발한 뒤 임계를 경과시키고 **추가 상태 전이·재렌더가 없음**을 단언한다(`notifyActiveCard` 스파이 또는 `getState().phase` 불변). 재요청 시 재무장도 함께 단언한다.
- **M2.2.3 (GREEN)**: `AiSuggestionCardController` 에 `watchdogTimer` 필드 + `armWatchdogTimer`/`clearWatchdogTimer` 를 `waitNoticeTimer`(`:847`·`:858-878`) **바로 아래 형제 위치**에 추가한다. 생성자(`:850-856`)에서 무장하고, `destroy()`(`:881-883`)가 **두 타이머를 모두** 해제하도록 확장한다. 만료 콜백은 `this.commit({ type: 'fail', kind: 'other', message: <분류된 문구> })` 만 수행한다 — 문서를 건드리지 않고 다른 카드에 접근하지 않는다(REQ-AI10-013).
- **M2.2.4 (GREEN — 해제 지점 배선)**: `onComplete`(`:903-905`)·`onError`(`:964-966`)·`cancelByNew`(`:976-979`)가 이미 `clearWaitNoticeTimer()` 를 호출하는 자리에 `clearWatchdogTimer()` 를 나란히 추가한다. `intrude()`(`:971-973`)·`markStale()`(`:982-985`)는 현재 타이머를 해제하지 않으므로 **양쪽 타이머 해제를 함께 추가**한다 — 이 두 경로는 in-flight 가 사실상 끝난 상태이므로 백스톱이 뒤늦게 발화하면 사용자에게 의미 없는 오류가 뜬다. 적용·닫기 경로는 이미 `controller.destroy()` 를 호출한다(`:1108`·`:1212`).
- **M2.2.5 (GREEN — 재무장)**: M1.3의 `enterReRequest()` 가 `rearmWaitNotice()` 와 나란히 백스톱도 재무장하게 한다(REQ-AI10-010 (b)). 두 재무장을 한 메서드로 묶을지는 REFACTOR 재량이되, 재요청마다 **양쪽 모두** 재무장되어야 한다.
- **M2.2.6 (REFACTOR)**: `waitNoticeTimer` 와 `watchdogTimer` 의 arm/clear 가 형태상 동일하므로, 두 타이머를 배열이나 작은 내부 헬퍼로 묶어 "해제 지점을 한 곳만 고치면 되게" 만든다. 다만 두 타이머는 **임계와 만료 동작이 다르므로** 완전 통합하지 않고 해제만 공통화하는 선에서 멈춘다(과잉 추상화 방지).

#### M2.3 — 카드 공존: 이벤트 라우팅

> **선행 조건**: M2.2 GREEN. 백스톱이 있어야 이 마일스톤의 회귀 테스트에서 "굶은 카드"와 "백스톱으로 종결된 카드"를 구분할 수 있다.

- **M2.3.1 (RED)**: `src/test/aiCardCoexistence.test.ts` 신설. AC-AI10-007 을 작성한다.
  1. 카드 B 요청 발행 → B `streaming`.
  2. 카드 A 를 `done` 상태로 만들어 검토 대기시킨다(별도 requestId).
  3. 카드 A 의 `↻` 클릭 → `aiStore.requestId` 가 A' 로 이동.
  4. **카드 B 의 requestId 로** `ai://chunk` → `ai://done` 을 발생시킨다(릴레이 리스너 mock 을 통해 주입).
  5. 단언: 카드 B 가 청크를 수신해 최종적으로 `done` phase 에 도달하고, B 의 제안 본문이 카드 DOM 에 렌더된다.
  6. 추가 단언: 카드 A 의 백스톱이 발동해도 카드 B 의 phase·in-flight 는 영향을 받지 않는다(REQ-AI10-013).
  **현행 구현에서 반드시 실패한다** — 4단계의 이벤트가 `useAiRelay.isCurrent`(`useAiRelay.ts:36-38`)에서 폐기된다.
- **M2.3.2 (GREEN)**: 아래 "결정 기록"의 채택안대로 구현한다.
- **M2.3.3 (GREEN — 단일 슬롯 구독 해소)**: `activeCardUnsub`(`:1084`)와 `startSuggestionCard` 첫 줄의 `activeCardUnsub?.()`(`:1153`)를 제거하고, 각 컨트롤러가 **자기 구독 해제 함수를 보유**해 `destroy()` 에서 호출하도록 바꾼다. `clearCardRegistry`(`:806-812`)의 `activeCardUnsub?.()` 호출도 M2.4 의 `destroy()` 순회로 대체된다.
- **M2.3.4 (경계 유지)**: `aiStore` 는 **손대지 않는다** — `AiTransientSlice`(`aiStore.ts:23-30`)·`reduceCompleteRequest`(`:65-71`) 무변경. 고스트 텍스트 경로(`ghostStoreBridge`)는 여전히 스토어의 단일 슬롯을 소비하며, 고스트는 동시에 하나만 존재하므로 이 제약이 문제되지 않는다. `aiStore.test.ts`·`aiRelay.test.ts` 가 무수정 통과해야 한다.

#### M2.4 — 레지스트리 타이머 누수

- **M2.4.1 (RED)**: AC-AI10-008 을 작성한다. 컨트롤러 2개 이상을 등록하고 두 타이머를 무장시킨 뒤 `clearCardRegistry()` 를 호출하고, 두 임계를 모두 경과시켜도 어떤 타이머 콜백도 발화하지 않음을 단언한다. **현행 구현에서 실패한다**(`cardRegistry.clear()` 가 `destroy()` 를 호출하지 않는다).
- **M2.4.2 (GREEN)**: `clearCardRegistry`(`:806-812`)가 `cardRegistry.clear()` **이전에** 등록된 모든 컨트롤러의 `destroy()` 를 순회 호출하도록 수정한다. 기존 `lastController = null` · `notifyActiveCard()` 배치는 무변경.
- **M2.4.3 (회귀 확인)**: `aiFileSwitchEffects.test.ts`·`aiOffEffects.test.ts` 를 **무수정** 실행해 전수 통과를 확인한다(AC-AI10-009). `runAiArtifactCleanup`(`aiOffEffects.ts:28-43`)의 3동작 순서·조건은 그대로이며, `clearCardRegistry` 의 **효과**만 보강되었다.

**완료 기준**: AC-AI10-004·005·006·007·008·009 전수 통과 + `aiStore.test.ts`·`aiRelay.test.ts`·`aiOffEffects.test.ts`·`aiFileSwitchEffects.test.ts` 무수정 통과.

### Milestone M3 — 결함 3: 마크다운 블록 경계 삽입·확장 (Priority: High)

> 변경 표면은 `ai-suggestion-card.ts` 의 순수 함수 영역(`:477-557`)이다. M1·M2와 같은 파일이지만 함수가 완전히 분리되어 있어 충돌하지 않는다. **테스트 작성 순서는 `expandToSentenceBoundary` 를 먼저** 둔다 — 그쪽이 파괴적 replace 범위를 넓히는 위험한 절반이기 때문이다(Design Notes).

- **M3.1 (RED — 경계 함수 규칙 전수)**: `src/test/aiBlockBoundary.test.ts` 신설. AC-AI10-010 의 경계 함수 부분을 작성한다 — 7종 블록 시작(ATX 제목 / 순서 없는 목록 / 순서 있는 목록 / 인용 / 표 행 / 코드 펜스 / 구분선) 각각에서 멈춤, 빈 줄·공백만 줄에서 멈춤, **setext 밑줄 예외**(산문 줄 바로 다음의 `---`·`===` 는 연속으로 취급), 들여쓰기 0~3칸은 블록 시작·4칸 이상은 아님, 산문 연속 줄은 전진, EOF 도달 시 `doc.length`. 함수가 아직 없으므로 **컴파일 실패로 RED** 확인.
- **M3.2 (RED — `expandToSentenceBoundary` 상한)**: AC-AI10-011 을 작성한다. 종결 부호(`.!?。`)가 하나도 없는 제목·목록·표 영역 문서에서 `expandToSentenceBoundary(doc, from, to)` 의 반환 `to` 가 **블록 끝**이고 `doc.length` 가 아님을 단언한다. 동시에 종결 부호가 존재하는 기존 케이스의 반환값이 개정 전과 동일함도 단언한다. **전자는 현행에서 반드시 실패한다** — RED 확인.
- **M3.3 (RED — insert-below 4케이스)**: `src/test/aiSuggestionApply.test.ts` 에 신규 `describe` 를 **추가**한다(기존 케이스 수정 금지). 네 케이스 각각의 결과 문서 문자열을 정확히 단언한다.
  - (a) 제목 + 단일 개행 목록: `## 제목\n- 하나\n- 둘` 에서 제목을 선택 → 삽입이 제목 줄 바로 다음
  - (b) 표 영역: 표 행을 선택 → 삽입이 그 행 바로 다음이며 문서 끝이 아님
  - (c) 여러 줄 산문 문단: 문단 첫 줄을 선택 → 삽입이 **문단 전체 뒤**, 문장 사이가 아님
  - (d) 빈 줄 없이 EOF: 문서 끝 삽입(현행 유지 — 이미 기존 테스트가 덮으므로 신규 케이스는 "빈 줄 없는 다중 줄 문서"로 보강)
  **(a)(b)(c)는 현행에서 반드시 실패한다**(전부 문서 끝) — RED 확인.
- **M3.4 (GREEN — 경계 함수)**: `ai-suggestion-card.ts` 의 `SENTENCE_TERMINATORS`/`PARAGRAPH_SEP`(`:477-478`) 인근에 `findBlockEnd(doc: string, from: number): number` 를 신설·export 한다(REQ-AI10-016/017). 반환값은 **개행 문자 앞** 오프셋이어야 한다 — 기존 두 호출부가 모두 그 의미의 `paraEnd` 를 쓰고 있으므로 호출부 변경이 한 줄로 끝난다. 블록 시작 판정은 파일 내부 헬퍼(예: `isBlockStartLine(line, prevLine)`)로 분리해 setext 예외가 `prevLine` 을 볼 수 있게 한다.
- **M3.5 (GREEN — 두 호출부 교체)**: (1) `expandToSentenceBoundary`(`:501-502`)의 `sepAfter`/`paraEnd` 2줄을 `const paraEnd = findBlockEnd(doc, to);` 로 교체(REQ-AI10-019). (2) `applySuggestion` insert-below 분기(`:552-554`)의 `docText`/`sepAfter`/`paraEnd` 3줄을 `const paraEnd = findBlockEnd(view.state.doc.toString(), ctx.to);` 로 교체(REQ-AI10-018). **`:555` 의 dispatch 는 한 글자도 바꾸지 않는다** — 삽입 내용 형태(`\n\n` + 제안)와 단일 트랜잭션 구조가 무변경이어야 한다(REQ-AI10-022).
- **M3.6 (경계 유지)**: `PARAGRAPH_SEP` 상수(`:478`)는 **제거하지 않는다** — `:555` 의 삽입 구분자로 계속 쓰인다(Exclusions). `SENTENCE_TERMINATORS`(`:477`)와 `expandToSentenceBoundary` 의 조기 반환(`:493-499`)도 무변경이다.
- **M3.7 (RED→GREEN — 무손상 회귀)**: AC-AI10-012 를 작성·확인한다. `applySuggestion` 이 (1) 원문 불일치 시 `{applied:false, reason:'stale'}` + 문서 무변경, (2) 적용이 단일 트랜잭션이라 `undo` 1회로 완전 복원, (3) `replace` 모드 동작 무변경. `aiSuggestionApply.test.ts` 의 기존 케이스가 이미 (1)(2)(3)을 덮으므로 대부분 **무수정 통과 확인**으로 충족된다.
- **M3.8 (REFACTOR)**: 블록 시작 판정 정규식이 여러 개로 늘어나면 파일 상단 상수 배열로 모으고, 각 항목에 어떤 마크다운 구조인지 한국어 주석을 붙인다. `@MX:NOTE` 로 setext 예외의 근거(제목 텍스트와 밑줄 사이 삽입 방지)를 1줄 남긴다.

**완료 기준**: AC-AI10-010·011·012 전수 통과 + `aiSuggestionApply.test.ts` 기존 케이스 무수정 통과.

### Milestone M4 — 통합 검증 (Priority: Medium)

- **M4.1 (품질 게이트)**: `npm run typecheck` + `npm run lint` + `npm test` 전수 통과. `cargo test` + `cargo clippy` 가 M0.3 기준선과 동일(백엔드 무변경). `cargo build --release` 성공.
- **M4.2 (회귀 확인)**: M0.2 의 10개 파일이 **무수정** 전수 통과(`aiSuggestionApply.test.ts` 는 추가만).
- **M4.3 (코드 리뷰 계층)**: spec.md "검증 계층" 표의 **코드 리뷰(diff)** 행을 PR 에서 사람이 확인한다 — REQ-AI10-005(신규 진행 UI·신규 phase 부재), REQ-AI10-015(파일 전환 정리 3모듈 무변경), REQ-AI10-022(무손상 구조 무변경), REQ-AI10-007(상수 배치·파생 형태·백엔드 참조 주석). **이 항목들에 대해 "테스트가 통과했으므로 지켜졌다"고 주장하지 않는다** — vitest 는 파일 무변경을 판정할 수 없다.
- **M4.4 (수동 — 결함 1)**: 실제 앱에서 AI 제안을 받은 뒤 `↻`·`↻ 다시`·`⚡ 고급 모델로 다시 시도`를 각각 눌러, 클릭 즉시 카드가 스켈레톤/글로우로 돌아가고 옛 제안 본문이 사라지는지 확인한다. 8초 이상 걸리는 요청에서 대기 안내가 뜨는지도 확인한다.
- **M4.5 (수동 — 결함 2)**: 카드 A를 검토 대기 상태로 두고 카드 B 요청을 띄운 뒤 A에서 재요청을 발행해, B가 멈추지 않고 정상 완료되는지 확인한다. 프로바이더를 인위적으로 정지시킨 상태(예: 네트워크 차단 + 프로세스 SIGSTOP)에서 백엔드 60초 오류가 먼저 오는지, 그마저 오지 않으면 프론트 백스톱이 복구 가능한 오류 카드를 내는지 확인한다.
- **M4.6 (수동 — 결함 3)**: 표/목록으로 끝나는 실제 문서에서 표 생성 AI를 실행하고 "아래에 삽입"을 눌러, 결과가 문서 맨 아래가 아니라 현재 블록 바로 다음에 들어가는지 확인한다. 여러 줄 산문 문단 중간을 선택했을 때 문장 사이로 끼어들지 않는지도 확인한다.

**완료 기준**: M4.1~M4.6 전부 통과. PR 머지 가능 상태.

## 결정 기록 — 결함 2b 구독 방식

> spec.md REQ-AI10-012 는 "카드 B가 굶지 않는다"는 **행동**만 요구하고 방식을 지정하지 않는다. 아래가 그 방식의 결정 기록이다.

### 문제의 정확한 형태

세 개의 사실이 겹쳐 카드 B가 굶는다.

1. `useAiRelay.isCurrent`(`src/hooks/useAiRelay.ts:36-38`)가 `useAiStore.getState().requestId` 와 다른 모든 `ai://` 이벤트를 **스토어에 닿기 전에** 폐기한다.
2. `aiStore` 는 in-flight 요청을 **1개**만 보유한다(`src/store/aiStore.ts:23-30`).
3. `startSuggestionCard`(`:1153`)가 `activeCardUnsub?.()` 로 직전 카드의 구독을 끊어, 어느 시점에도 **1개 카드만** 스토어에 바인딩된다.

### 기각안 A — 카드별 `useAiStore.subscribe` 만 도입 (증명 가능하게 불충분)

3번만 고치는 안이다. 각 컨트롤러가 자기 `boundRequestId` 로 필터링하는 자체 구독을 갖게 한다.

**기각 사유(증명)**: 1번과 2번이 그대로 남는다. 카드 A가 재요청하면 `store.startRequest` 가 `aiStore.requestId` 를 A' 로 옮기고, 그 순간부터 `isCurrent(B)` 는 항상 `false` 다. 카드 B의 청크·done·**심지어 백엔드 워치독의 `timeout` 오류까지** 릴레이 단계에서 폐기되므로, B의 구독이 몇 개 있든 스토어에는 B에 대한 어떤 변경도 도달하지 않는다. 즉 이 안은 **AC-AI10-007 을 통과시킬 수 없다**. 이것이 spec.md REQ-AI10-012 가 "두 지점이 **모두** 해소되어야 한다"고 못박은 이유다.

### 기각안 B — `aiStore` 를 다중 요청 스토어로 재설계

`AiTransientSlice` 를 `Map<requestId, slice>` 로 바꾸는 안이다.

**기각 사유**:
- **폭발 반경**: `streamBuffer`/`requestState`/`requestId` 를 소비하는 지점이 카드뿐이 아니다 — 고스트 텍스트 브리지(`ghostStoreBridge`, `ai-ghost-text.ts`), 선택 툴바, 설정 화면, 그리고 `aiStore.test.ts`·`aiRelay.test.ts`·`aiGhost*.test.ts` 계열 테스트가 전부 단일 슬롯 형태를 전제한다.
- **문서화된 계약 파괴**: `reduceCompleteRequest` 의 `streamBuffer = finalText` 는 "완료 시 버퍼는 `ai://done` 의 `result` 라는 **권위 값**으로 확정된다"는 계약이며, SPEC-AI-009 Design Notes("terminal-empty 를 렌더 계층에서 파생하는 이유")가 이를 명시적으로 보존 대상으로 지정했다. 다중 슬롯화는 이 계약의 의미를 바꾼다.
- **사용자 관측 이득 0**: 고스트는 동시에 하나만 존재하고 툴바·설정은 "현재 요청" 개념만 필요하다. 다중 슬롯이 주는 것은 카드가 이미 라우팅 계층에서 얻을 수 있는 것뿐이다.
- spec.md Exclusions 가 이 재설계를 기본 방침으로 금지한다.

### 채택안 C — requestId 기준 이벤트 라우팅 + 카드별 바인딩

1번(릴레이 게이트)과 3번(단일 구독 슬롯)을 함께 고치고 2번(스토어 단일 슬롯)은 **그대로 둔다**.

- **소규모 라우터 모듈 신설**(`src/lib/ai/` 하위). requestId 별 핸들러 등록/해제와 이벤트 발송만 담당한다. 신규 IPC·신규 이벤트 타입을 만들지 않고 기존 3종 payload(`AiChunkEvent`/`AiDoneEvent`/`AiErrorEvent`, `useAiRelay.ts:11-30`)를 그대로 중계한다.
- **`useAiRelay` 는 두 가지를 한다**: (i) 기존대로 `isCurrent` 통과 이벤트를 `aiStore` 로 릴레이(고스트·툴바·설정의 단일 슬롯 계약 **완전 보존**), (ii) `isCurrent` 여부와 **무관하게** 모든 이벤트를 라우터로 발송. 등록·해제 생명주기(`:46-85`)는 무변경이다.
- **카드는 라우터를 구독한다**. `startSuggestionCard` 가 `useAiStore.subscribe` 대신 라우터에 `boundRequestId` 로 등록하고, 재요청 시 등록 키를 새 id 로 옮긴다(현행 `boundRequestId` 갱신과 같은 자리, `:1190`). 해제 함수는 컨트롤러가 보유해 `destroy()` 에서 호출한다 — 모듈 전역 `activeCardUnsub`(`:1084`)는 제거된다.

**대가와 그 처리**:
- 카드는 지금 스토어에서 **누적된** `s.streamBuffer` 를 받지만(`:1226`·`:1231`), 라우터에서는 **원시 델타**를 받는다. 따라서 컨트롤러가 자체 누적해야 한다. 이는 오히려 REQ-AI10-002(재요청 시 버퍼 리셋)와 잘 맞는다 — 버퍼 소유권이 컨트롤러로 일원화되기 때문이다. M1.3 의 `enterReRequest()` 가 이미 `this.streamBuffer = ''` 를 하므로 추가 작업이 작다.
- `ai://done` 의 `result` 는 권위 값이므로 누적 버퍼를 **덮어써야** 한다(스토어의 `reduceCompleteRequest` 와 같은 의미론). 컨트롤러의 done 처리에서 이를 명시한다.
- 중복 종결 처리 방지를 위한 `lastHandledTerminal` 가드(`:1173`·`:1228-1236`)는 라우터 등록에도 그대로 필요하다 — 옮겨 심는다.

**최소성 근거**: 기각안 A는 **AC를 통과시킬 수 없고**(증명됨), 기각안 B는 통과시키지만 스토어 계약과 3개 이상의 소비자를 흔든다. 채택안 C는 AC를 통과시키면서 `aiStore` 를 **한 줄도 바꾸지 않는다**. "가장 작으면서 통과 가능한" 지점이 여기다.

**Run phase 재량 범위**: 라우터 모듈의 이름·파일 경로·API 형태(콜백 객체 vs 개별 핸들러)는 재량이다. 다만 (a) `aiStore` 무변경, (b) `useAiRelay` 의 기존 스토어 릴레이 경로 보존, (c) 카드별 해제 함수가 `destroy()` 에 묶임 — 이 셋은 계약이다.

## Technical Approach

### 핵심 아키텍처 결정

1. **재요청 진입을 컨트롤러 메서드 1개로** — `enterReRequest()` 가 phase 전이·버퍼 리셋·두 타이머 재무장을 묶는다. 다섯 진입점이 수렴하는 단일 배선에서 1회 호출하므로 진입점이 늘어도 자동으로 덮인다.
2. **백스톱은 기존 타이머의 형제** — 새 패턴을 만들지 않고 `waitNoticeTimer` 의 arm/rearm/clear/destroy 규율을 복제한다. 해제 지점이 이미 열거되어 있어 누락 위험이 낮다.
3. **라우팅은 릴레이에서, 스토어는 그대로** — 결정 기록 채택안 C. 스토어의 단일 슬롯 의미론이 고스트 경로의 계약이므로 건드리지 않는다.
4. **경계 판정은 순수 함수 1개, 소비자 2곳** — 판정 규칙을 두 곳에 복제하면 파괴적 replace 범위와 비파괴적 삽입 위치가 서서히 갈라진다. 같은 함수를 공유하는 것이 안전 요건이다.

### 의존성 그래프

```
M0 (기준선) ── BLOCKER for all
   ↓
   ├─ M1 (결함 1: 재요청 진행 표시) ── ai-suggestion-card.ts (컨트롤러 + onReRequest 배선)
   │     ↓ (enterReRequest() 가 M2.2.5 의 재무장 지점)
   ├─ M2 (결함 2: 종결 보장 + 공존)
   │     ├─ M2.1 (임계 상수)      ── waitNotice.ts
   │     │     ↓
   │     ├─ M2.2 (백스톱 타이머)  ── ai-suggestion-card.ts (컨트롤러)
   │     │     ↓
   │     ├─ M2.3 (이벤트 라우팅)  ── useAiRelay.ts + 신규 라우터 + ai-suggestion-card.ts (구독)
   │     └─ M2.4 (레지스트리 누수) ── ai-suggestion-card.ts (clearCardRegistry)
   │
   └─ M3 (결함 3: 블록 경계)      ── ai-suggestion-card.ts (순수 함수 영역 :477-557)
         ↓
      M4 (통합 검증)
```

- **M0 이 BLOCKER 인 이유**: 현행 그린 기준선 없이는 "무수정 통과" 계약(AC-AI10-009·012)을 판정할 수 없다.
- **M1 → M2.2.5 순서 이유**: 백스톱 재무장은 `enterReRequest()` 안에 들어가므로 그 메서드가 먼저 존재해야 한다.
- **M2.2 → M2.3 순서 이유**: 백스톱이 없으면 M2.3 회귀 테스트에서 "굶은 카드"와 "정상 종결된 카드"를 구분할 수단이 약하다(둘 다 그냥 멈춰 보인다).
- **M3 은 M1·M2와 독립**: 같은 파일이지만 순수 함수 영역(`:477-557`)만 만지므로 논리적 충돌이 없다. 다만 같은 파일이라 물리적 병렬 편집은 피하고 순차 진행한다.

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| M1.4 의 전이 추가가 내부 개시 경로에서 `stream` 을 두 번 커밋해 다이어그램·표 재시도 흐름을 흔듦 | 중 | 중 | `reduceCard` 의 `'stream'` 은 멱등(`:83-84`)이라 상태는 안전. REQ-AI10-006 + AC-AI10-003 이 재시도 카운터·목록 폴백 플래그 궤적을 단언하고, `aiSuggestionCardRerequest.test.ts` 의 BUG-1/3(a)/6 시나리오가 무수정 통과해야 한다. 문제가 실증되면 배선에 조건 분기를 넣지 말고 **내부 경로의 선행 `commit` 을 제거**한다(M1.6). |
| 버퍼 리셋 없이 phase 만 전이시켜 **낡은 제안 본문**이 streaming 렌더에 그대로 노출 | **높** | **높** | 이것이 "고쳤는데 더 나빠지는" 대표 형태다. REQ-AI10-002 가 리셋을 전이와 분리 불가한 쌍으로 못박고, AC-AI10-001 의 단언 (2)(3)(스켈레톤 3줄 존재 + 직전 본문 부재)이 이를 직접 잡는다. |
| 프론트 백스톱이 백엔드 60초보다 먼저 발동해 **분류된** `timeout` 오류를 덜 유용한 오류로 덮어씀 | 중 | 중 | REQ-AI10-008 순서 불변식 + AC-AI10-004 단위 테스트. 백스톱 값을 백엔드 미러 상수에서 **파생**시켜 독립 표류를 구조적으로 막는다(M2.1.2). 백엔드만 바뀌는 경우는 테스트가 잡지 못하므로 미러 상수에 `mod.rs:32` 참조 주석을 필수로 붙인다. |
| 백스톱이 `intrude`/`stale` 상태에서 뒤늦게 발화해 의미 없는 오류 카드로 덮어씀 | 중 | 중 | M2.2.4 가 이 두 경로에 타이머 해제를 **새로** 추가한다(현재는 대기 타이머조차 해제하지 않는다). AC-AI10-006 이 7경로 전수를 단언한다. |
| M2.3 라우팅 도입이 고스트 텍스트 경로의 단일 슬롯 계약을 깨뜨림 | 중 | **높** | 채택안 C가 `useAiRelay` 의 **기존 스토어 릴레이 경로를 그대로 유지**하고 라우터 발송을 추가만 한다. `aiStore` diff 0줄은 **코드 리뷰**로, 동작 보존은 `aiStore.test.ts`·`aiRelay.test.ts`·`aiGhost*.test.ts` 무수정 통과로 확인한다(M2.3.4). |
| 라우터가 원시 델타를 주는데 컨트롤러가 누적을 잊어 카드에 마지막 청크만 보임 | 중 | 중 | 스토어는 `appendChunk` 로 누적하지만(`aiStore.ts:60-62`) 라우터는 그러지 않는다. 채택안 C의 "대가와 그 처리" 항목이 이를 명시하고, AC-AI10-007 의 카드 B 시나리오가 **여러 청크**를 보내 최종 본문 전체를 단언하도록 작성한다. |
| `findBlockEnd` 가 개행을 **포함한** 오프셋을 반환해 삽입 시 빈 줄이 하나 더 생김 | 중 | 중 | 기존 두 호출부가 모두 "개행 앞" 의미의 `paraEnd` 를 쓰므로 의미를 유지해야 호출부 변경이 한 줄로 끝난다(M3.4). AC-AI10-010 이 결과 문서 문자열을 **정확히** 단언하므로 한 글자만 어긋나도 잡힌다. |
| setext 밑줄 예외 누락으로 제목 텍스트와 `---` 사이에 제안이 삽입되어 문서 구조 파괴 | 중 | **높** | `---` 는 구분선과 setext h2 밑줄이 형태상 같다. REQ-AI10-017 예외 조항 + M3.1 전용 테스트 케이스로 고정한다. `===` 는 setext 전용이므로 항상 연속으로 취급한다. |
| 코드 펜스 내부 선택 시 닫는 펜스 앞에 삽입되어 코드 블록이 깨짐 | 낮 | 중 | v1 알려진 한계로 문서화(Design Notes). 펜스 상태 추적은 Exclusions 로 금지 — 순수 줄 단위 판정을 유지하고 실제 보고가 나오면 별도 REQ. |
| `PARAGRAPH_SEP` 을 "이제 안 쓰니까" 제거해 삽입 형태가 바뀜 | 중 | 중 | 이 상수는 삽입 **구분자**(`:555`)로도 쓰인다. Exclusions + M3.6 이 명시하고, `aiSuggestionApply.test.ts` 기존 케이스가 `${original}\n\n- item one` 형태를 단언하므로 즉시 잡힌다. |
| "무수정 통과" 계약을 지키려다 테스트를 **약화**시켜 통과 | 중 | **높** | 회귀 가드 테스트는 단언 **완화 금지**다. 기존 케이스가 실패하면 범위를 벗어난 변경이 들어간 신호이므로 테스트가 아니라 구현을 고친다. M4.2 가 `git diff` 로 테스트 파일 변경을 확인한다(추가만 허용). |
| 파일 전환 정리(SPEC-AI-009)를 "다시 구현"하려는 시도 | 중 | 중 | 이미 `37059a7` 에 있다. REQ-AI10-015 + Exclusions + Delta 표 `[NOT MODIFIED]` 3행이 못박고, M2.4.3 이 `aiFileSwitchEffects.test.ts` 무수정 통과로 확인한다. |

## Testing Strategy

### 신규 프론트 테스트 (Vitest + Testing Library)

1. **재요청 진행 표시**(`src/test/aiCardRerequestProgress.test.ts`, AC-AI10-001·002·003): 5개 진입점 전수 × (streaming 클래스 / 스켈레톤 3줄 / 직전 본문 부재 / 적용 버튼 부재), 재요청 후 8초 대기 안내 재출현, 진행률 요소 부재, 내부 개시 경로 궤적 보존.
2. **백스톱 타이머**(`src/test/aiCardWatchdog.test.ts`, AC-AI10-004·005·006): 세 임계 순서 불변식 + 백엔드 미러 값 60_000ms, fake timers 로 만료 → `error` phase + 분류 문구 + 재시도·닫기 병존, 무장/재무장/7경로 해제 생명주기.
3. **카드 공존**(`src/test/aiCardCoexistence.test.ts`, AC-AI10-007·008): A 재요청 후 B가 여러 청크를 수신해 `done` 도달, A 백스톱 발동의 국소성, `clearCardRegistry` 후 두 임계 경과에도 콜백 미발화.
4. **블록 경계**(`src/test/aiBlockBoundary.test.ts`, AC-AI10-010·011): 경계 함수 규칙 전수(7종 + 빈 줄 + setext 예외 + 들여쓰기 + 산문 연속 + EOF), `expandToSentenceBoundary` 상한.
5. **삽입 위치**(`src/test/aiSuggestionApply.test.ts` 신규 `describe` 추가, AC-AI10-010): 4케이스의 결과 문서 문자열 정확 단언.

### 회귀 가드 (무수정 통과)

`aiSuggestionCardRerequest.test.ts` / `aiWaitNotice.test.ts` / `aiFileSwitchEffects.test.ts` / `aiSuggestionCard.test.ts` / `aiSuggestionCardRender.test.ts` / `aiSuggestionCardWidget.test.ts` / `aiRelay.test.ts` / `aiStore.test.ts` / `aiOffEffects.test.ts` / `aiSuggestionApply.test.ts`(기존 케이스). **단언 완화 금지** — 실패는 범위 이탈 신호다.

### mock 정책

`aiRequest`/`aiCancel`(`@/lib/tauri/ipc`)과 `@tauri-apps/api/event` 의 `listen` 은 mock 으로 주입한다. 실제 Tauri 런타임에 의존하면 CI 에서 실행할 수 없다. 기존 `aiSuggestionCardRerequest.test.ts`·`aiRelay.test.ts` 의 mock 패턴을 그대로 차용한다.

### 검증 계층 분리 (중요)

spec.md "검증 계층" 표대로, 다음은 **자동 테스트가 아니라 코드 리뷰(diff)** 가 담당한다 — 이 항목들에 대해 테스트 통과를 근거로 준수를 주장하지 않는다.

| 항목 | 담당 REQ |
|------|----------|
| 신규 진행 UI·신규 phase 부재 | REQ-AI10-005 |
| 파일 전환 정리 3모듈 무변경 | REQ-AI10-015 |
| `applySuggestion` 무손상 **구조** 무변경(재검증 순서·단일 트랜잭션) | REQ-AI10-022 |
| 상수의 배치·파생 형태·백엔드 참조 주석 | REQ-AI10-007 |
| `aiStore.ts`·`src-tauri/` 무변경 | 채택안 C 계약 |

### 품질 게이트

- `npm run typecheck` 클린, `npm run lint` 클린(이 저장소에서 lint 는 실질 게이트다 — `console.log` 잔존은 실패로 이어진다).
- `npm test` 전수 통과, 커버리지 목표 85% 유지.
- `npm run test:e2e` 1회 실행(카드 렌더 변경의 영향 확인).
- `cargo test` + `cargo clippy` 가 M0.3 기준선과 동일, `cargo build --release` 성공.
- SPEC-AI-001/006/009 의 기존 AC 회귀 없음 — 특히 SPEC-AI-006 의 대기 안내 계약(8초·가짜 진행 금지)과 SPEC-AI-009 의 파일 전환 정리·종결 phase 닫기 계약.

## Open Questions (Run phase에서 해결 가능한 사항만)

> 사전 합의된 4가지 결정과 결함 2b 구독 방식(채택안 C)은 제외. Run phase 재량에 맡긴 세부 선택지만 나열.

1. **백스톱 유예 폭**(M2.1.2): 백엔드 미러 60초에 더할 고정 유예의 크기. 백엔드 워치독의 `sleep → claim_terminal → kill → emit` 전달 지연과 이벤트 큐 여유를 덮되, 크게 잡을수록 "진짜로 죽었을 때 기다리는 시간"이 늘어난다. 값은 재량이되 **파생 상수 하나**로 표현하고 근거를 주석에 남긴다.
2. **백스톱 오류 문구**(M2.2.3): "응답이 오지 않아 중단했어요" 계열의 정확한 표현. AC-AI10-005 는 "분류된 한국어 문구 + raw 노출 부재"만 단언하므로 문구 자체는 자유롭다. 기존 `error` 렌더의 기타 분기(`:362-368`) 문구 체계와 어울리게 한다.
3. **두 타이머의 통합 정도**(M2.2.6): 해제만 공통화할지, arm 까지 배열로 묶을지. 임계와 만료 동작이 다르므로 완전 통합은 과잉 추상화다. 해제 지점 누락을 막는 선에서 멈추는 것을 권장.
4. **라우터 모듈의 이름·경로·API 형태**(M2.3.2): `src/lib/ai/` 하위 배치는 고정이나 파일명과 API(콜백 객체 vs 개별 핸들러 등록)는 재량. 계약은 (a) `aiStore` 무변경, (b) `useAiRelay` 기존 릴레이 경로 보존, (c) 해제 함수가 `destroy()` 에 묶임 셋뿐이다.
5. **`findBlockEnd` 의 이름·시그니처**(M3.4): `expandToSentenceBoundary(doc, from, to)` 관례상 `(doc: string, from: number) => number` 를 권장하나, 블록 시작 판정 헬퍼를 함께 export 할지는 재량(테스트 편의 vs 표면 최소화). AC-AI10-010 이 경계 함수 규칙을 직접 단언하므로 최소한 경계 함수 자체는 export 되어야 한다.
6. **들여쓰기 허용 폭의 구현 방식**(M3.4): CommonMark 의 0~3칸 규칙을 정규식 `^ {0,3}` 로 표현할지 별도 전처리로 뺄지. 4칸 이상을 들여쓴 코드로 보아 블록 시작이 아니라는 결과만 지키면 재량이다.
7. **표 행 판정의 엄밀도**(M3.4): `|` 로 시작하는 줄을 전부 표 행으로 볼지, 구분 행(`|---|`) 패턴까지 구별할지. v1은 `|` 시작만으로 충분하다고 보나(삽입 위치 결정이 목적이지 표 파싱이 아니다), 실제 문서에서 오탐이 관측되면 보고한다.

---

Version: 0.0.1 (draft)
Classification: spec-anchored
Last Updated: 2026-07-27
