---
id: SPEC-AI-010
version: "0.0.2"
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
  - markdown
  - retry-limit
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.1 | 2026-07-27 | jw | 최초 SPEC 작성 — v0.13.0(커밋 `37059a7`) 이후 실사용에서 확인된 AI 제안 카드 결함 3건을 근원 대조로 확정해 요구사항화. **결함 1 — 사용자 개시 재요청 중 진행 표시 없음**: `onReRequest` 배선(`ai-suggestion-card.ts:1188-1193`)이 `fireReRequest`(`:1125-1138`)의 반환값을 `boundRequestId` 에 대입하는데, `fireReRequest` 는 **대입 이전에** `store.startRequest`(`:1132`)·`store.incrementCount`(`:1133`)를 실행한다. 그 시점의 zustand 구독(`:1223-1224`)은 `s.requestId !== boundRequestId` 로 단락되므로(그 순간 `boundRequestId` 는 **직전** id) `streaming` 전이가 카드 컨트롤러에 커밋되지 않는다. 결과적으로 카드는 첫 `ai://chunk` 가 도착할 때까지 `done` phase(옛 제안 텍스트 + 버튼)를 유지하며, codex/claude CLI 첫 토큰 지연 동안 **얼어붙은 카드**로 보인다. `rearmWaitNotice()`(`:1192`) 역시 무력하다 — 8초 대기 안내(`WAIT_NOTICE_TEXT`)는 `renderSuggestionCard` 의 `phase === 'streaming'` 분기 안(`:326-331`)에서만 렌더되기 때문이다. 대조 근거: **내부 개시** 재요청 경로 3종(`enterListFallback` `:997-1000`, `handleTableComplete` `:941`, `handleDiagramComplete` 자동 재시도 `:957`)은 전부 `commit({type:'stream'})` 을 **명시적으로** 수행한다 — 누락된 것은 **사용자 개시** 5개 진입점뿐이다. 부수 조건: 컨트롤러의 `streamBuffer`(`:838`)는 `onComplete`(`:903-923`)에서 초기화되지 않아 직전 응답 본문이 남아 있으므로, `stream` 커밋만 하면 3줄 shimmer 스켈레톤(`:315-324`) 대신 **낡은 텍스트**가 렌더된다 — 버퍼 리셋이 재요청 진입의 일부여야 한다. **결함 2 — 요청 무한 정지 + 카드 굶김**: (2a) 프론트에 종결 보장이 없다 — 백엔드 하드 워치독(`src-tauri/src/ai/mod.rs:32` `WATCHDOG_TIMEOUT_SECS = 60`, 스레드 `:282-283`)이 유일한 방어선이고, `ai://done`/`ai://error` 가 유실되거나 프론트가 "현재"로 보지 않는 requestId 로 도착하면 카드는 `streaming` 에 영구 고착되며 탈출 경로는 수동 `✕ 취소` 뿐이다. (2b) 구조적 굶김 경로 확인 — `aiStore`(`src/store/aiStore.ts:23-30`)는 in-flight 요청을 **단 1개**만 보유(`requestId`/`streamBuffer`/`requestState`)하는데 `cardRegistry`(`:773`)는 N개 컨트롤러를 보유하고 검토 대기 카드는 새 요청에도 의도적으로 생존한다(SPEC-AI-001 REQ-AI-034). `useAiRelay.isCurrent`(`src/hooks/useAiRelay.ts:36-38`)가 `useAiStore.getState().requestId` 와 다른 모든 이벤트를 **스토어 진입 이전에** 폐기하므로, 카드 A(done, 검토 대기) + 카드 B(streaming) 상태에서 A의 `↻` 를 누르면 `aiStore.requestId` 가 A의 새 id 로 옮겨가 **B의 청크와 done 이 조용히 버려지고 B는 영원히 멈춘다**. 가중 요인: `startSuggestionCard`(`:1152-1153`)가 `activeCardUnsub?.()` 로 **직전 카드의 구독을 해제**하므로 어느 시점에도 단 1개 카드만 스토어에 바인딩된다. 추가 버그: `clearCardRegistry`(`:806-812`)가 `controller.destroy()`(`:881-883`) 없이 Map 만 비워 `waitNoticeTimer`(`:847`)를 누수시킨다. (2c) 파일 전환 잔존은 **이미 해결됨** — `initAiFileSwitchEffects`(`src/lib/ai/aiFileSwitchEffects.ts`) + `runAiArtifactCleanup`(`src/lib/ai/aiOffEffects.ts:28-43`)가 SPEC-AI-009 REQ-AI9-033/034/035 를 구현하고 `AppLayout.tsx:91` 에서 1회 등록되며, 이는 직전 커밋 `37059a7`(v0.13.0)에서 반영되었다. 본 SPEC은 이를 **회귀 가드로만** 다루고 재구현 요구를 쓰지 않는다. **결함 3 — "아래에 삽입"이 문서 맨 아래로 감**: `applySuggestion` 의 insert-below 분기(`:551-556`)가 `docText.slice(ctx.to).indexOf(PARAGRAPH_SEP)`(`PARAGRAPH_SEP = '\n\n'`, `:478`)로 문단 끝을 찾고 **빈 줄이 하나도 없으면 `view.state.doc.length`** 로 폴백한다. 마크다운은 제목·목록 항목·표 행·인용을 단일 `\n` 으로 구분하므로 선택 이후 구간에 빈 줄이 없는 문서에서는 항상 발동한다("가끔" 관측과 일치, 사용자 보고 사례는 표/목록 영역 아래 표 삽입). 동일한 `\n\n` 전제가 `expandToSentenceBoundary`(`:501-502`)에도 있으며, 그쪽은 **파괴적 replace 범위**를 조용히 문서 끝까지 넓히므로 결함 3의 위험한 절반이다. 사용자 확정 수정 방향은 **마크다운 블록 경계** 탐색이며(대안 검토 종료), 추출되는 경계 탐색기는 이 파일의 확립된 관례(`expandToSentenceBoundary`·`isEmptyOrIdentical`·`deriveCardActions`)대로 **순수·export·단위 테스트 가능**해야 한다. REQ 22건(REQ-AI10-001~022), AC 12건(AC-AI10-001~012). |
| 0.0.2 | 2026-07-27 | jw | **결함 4 추가 — `retry-exhausted` phase 도달 불가(SPEC-AI-001 REQ-AI-025 사실상 미구현)**. M1~M3(REQ-AI10-001~022)은 이미 구현·머지되었고 M4.4~M4.6 수동 검증만 남은 상태에서, 같은 파일을 재조사하다 네 번째 결함을 확인했다. `reduceCard` 는 `{ type: 'retry' }` 이벤트(`ai-suggestion-card.ts:65`)와 `retry-exhausted` phase(`:39`)를 정의하고 상한 전이(`:97-100`)까지 갖췄으며 `renderSuggestionCard` 에도 전용 분기(`:418-430`)가 있다. 그러나 `grep` 결과 **프로덕션 코드 어디에서도 `commit({type:'retry'})` 를 수행하지 않는다** — `{ type: 'retry' }` 를 소비하는 곳은 `src/test/aiSuggestionCard.test.ts:55`·`:63` 리듀서 단위 테스트 2건뿐이다. 따라서 `retryCount`(`:51`)는 프로덕션에서 **영구히 0**이고, `MAX_RETRY = 3`(`:75`)은 죽은 상수이며, `[⚡ 고급 모델로 다시 시도]`(`:422`)는 실기기에서 **도달 불가능**하다. SPEC-AI-001 **REQ-AI-025**("WHEN ↻ 방향 없는 재요청이 연속 3회 소진되면, the system shall 방향 지시 입력을 안내하고 설정 진입 없이 1회성 sonnet 재시도를 인라인 제안한다", AC-AI-011)는 상태 머신·렌더까지 준비된 채 **배선만 빠져 미구현**이다. 한 줄 수정이 아닌 이유는 그 도달 불가 분기 자체에 결함 2건이 더 있기 때문이다. (i) 안내 문구가 `'방향을 알려주시면 더 정확해요 (위 입력칸)'`(`:421`)인데 그 분기는 **방향 지시 입력칸을 렌더하지 않는다**(`renderDoneControls` `:266-300` 미호출) — 문구가 존재하지 않는 컨트롤을 가리킨다. (ii) 그 분기에 **닫기 컨트롤이 없다**. SPEC-AI-009 REQ-AI9-036/037 이 종결 phase 4종(error/empty/cancelled-by-new/stale)에 `appendDismissButton`(`:245-249`)을 붙일 때 `retry-exhausted` 는 도달 불가라 누락되었으므로, 현 상태로 도달 가능하게 만들면 **닫을 수 없는 카드**를 출시하게 된다. (iii) 그 분기는 `state.suggestion` 과 적용 버튼도 버린다 — ↻ 를 네 번째로 누르면 멀쩡한 제안이 화면에서 사라진다. 사용자 확정 설계 결정 4건(D5 증강 렌더 / D6 3분류 카운터 / D7 소진 시 미발행 / D8 `MAX_RETRY` 존치)을 사전 합의 절에 추가하고, 이를 REQ-AI10-023~033(11건)·AC-AI10-013~019(7건)으로 요구사항화한다. 변경 표면은 `src/components/editor/extensions/ai-suggestion-card.ts` **1개 파일**이며 `aiStore`·`src-tauri` 는 무변경이다. 누적: REQ 33건(001~033), AC 19건(001~019). |

## Summary

`mdedit`(Tauri v2 + React 18 + TypeScript + CodeMirror 6)의 AI 제안 카드는 v0.13.0 시점에 네 가지 관측 가능한 결함을 갖는다. 본 SPEC은 이 넷을 각각 독립 모듈로 수정한다(모듈 1~3은 v0.0.1, 모듈 4는 v0.0.2 에서 추가).

1. **모듈 1 — 재요청 진행 표시(결함 1)**: 사용자가 개시한 재요청(↻ / ↻ 다시 / ⚡ 고급 모델로 다시 시도 / 다시 시도 / 다시 요청) 5개 진입점 전부가 발행 즉시 카드를 **기존 streaming 표시**(글로우 테두리 + 3줄 shimmer 스켈레톤 → 실시간 텍스트)로 되돌리고, 8초 대기 안내 타이머를 재무장한다. 새 진행 UI를 발명하지 않는다.
2. **모듈 2 — 종결 보장 + 카드 공존(결함 2)**: 카드마다 프론트 백스톱 타임아웃을 두어 어떤 경우에도 `streaming` 영구 고착이 생기지 않게 하고, 카드 A의 재요청이 카드 B의 스트림을 굶기지 않도록 이벤트 소비 경로를 카드 단위로 독립시킨다. `clearCardRegistry` 의 타이머 누수도 함께 닫는다.
3. **모듈 3 — 마크다운 블록 경계 삽입(결함 3)**: "아래에 삽입"과 문장 경계 확장이 `\n\n` 유무가 아니라 **마크다운 블록 경계**로 끝 지점을 찾게 한다.
4. **모듈 4 — 재요청 소진 안내 도달 가능화(결함 4)**: 방향 없는(`blind`) 재요청만 세는 카운터를 실제로 배선해 `retry-exhausted` phase 가 도달 가능해지게 하고, 도달했을 때 나오는 카드가 **닫을 수 있고 제안을 잃지 않으며 안내 문구가 가리키는 입력칸이 실제로 존재하는** 상태가 되게 한다. SPEC-AI-001 REQ-AI-025 를 개정하지 않고 **구현 가능하게** 만드는 작업이다.

핵심 특성:

- **표시 계약 재사용**: 결함 1은 새 렌더 분기를 만들지 않는다 — `renderSuggestionCard` 의 기존 `phase === 'streaming'` 분기(`ai-suggestion-card.ts:305-336`)를 **그대로** 재사용한다. 가짜 진행 표시(진행률 바·퍼센트·ETA)는 SPEC-AI-006 REQ-AI6-009 가 이미 금지하며 본 SPEC도 이를 연장한다.
- **계층 분리된 타임아웃**: 8초 소프트 대기 안내(`WAIT_NOTICE_DELAY_MS`) → 60초 백엔드 하드 워치독(`WATCHDOG_TIMEOUT_SECS`) → 그보다 **엄격히 큰** 프론트 백스톱, 세 단계의 순서가 불변식으로 고정된다. 백엔드가 정상 동작하면 분류된 `timeout` 오류가 항상 먼저 도달하고, 프론트 백스톱은 그것마저 실패했을 때만 발동한다.
- **무손상 계약 무변경**: 문서 텍스트는 여전히 사용자의 명시적 [바꾸기]/[아래에 삽입] 확정에 의해서만, **단일 트랜잭션**으로만 바뀐다(SPEC-AI-001 REQ-AI-022/033/035). 모듈 3은 삽입 **위치 계산**만 바꾸며 적용 경로의 재검증·트랜잭션 구조는 손대지 않는다.
- **이미 고쳐진 것은 재구현하지 않음**: 파일 전환 시 AI 산출물 정리(SPEC-AI-009 REQ-AI9-033~035)는 `37059a7` 에서 이미 반영되었다. 본 SPEC은 회귀 가드만 둔다.
- **상위 SPEC 문언 무개정**: 모듈 4는 SPEC-AI-001 REQ-AI-025 / AC-AI-011 의 **요구 문언을 한 글자도 바꾸지 않는다**. 그 요구는 이미 옳고, 빠진 것은 배선뿐이다. 본 SPEC이 하는 일은 그 요구를 **실행 가능하게** 만드는 것이다.

## 사전 합의 설계 결정 (재검토 금지)

> 아래 8가지는 사용자가 결함 진단·수정 방향 합의 단계에서 확정한 결정이다(1~4는 v0.0.1, 5~8은 v0.0.2). Run phase에서 재검토하지 않는다. 변경이 필요하면 SPEC 개정(버전 올림)으로만 반영한다.

1. **재요청 진행 표시는 기존 streaming 렌더 재사용**
   - 새 위젯·새 phase·진행률 표시를 도입하지 않는다. 카드가 `streaming` phase 로 돌아가는 것만으로 글로우 테두리·스켈레톤·대기 안내가 전부 따라온다.
   - 스켈레톤이 실제로 보이려면 컨트롤러의 `streamBuffer` 가 비어 있어야 한다 — 버퍼 리셋은 이 결정의 **불가분한 일부**다.

2. **결함 2의 범위 = 프론트 워치독 + 다중 카드 구독 수정**
   - 백엔드(`src-tauri/src/ai/`)는 변경하지 않는다. 백엔드 하드 워치독 60초는 그대로 두고, 프론트는 그보다 뒤에서 받는 **백스톱**만 추가한다.
   - 파일 전환 정리(2c)는 이미 구현되어 있으므로 회귀 가드로만 다룬다.

3. **결함 3의 수정 방향 = 마크다운 블록 경계**
   - 선택 끝 이후를 **줄 단위로** 전진 스캔하며, 빈 줄이거나 새 마크다운 블록을 시작하는 첫 줄 **직전**에서 멈춘다.
   - 여러 줄 산문 문단은 중간에서 쪼개지지 않는다. EOF 에 닿으면 EOF 에 삽입한다(현행 동작이 옳고 기존 테스트가 이를 고정하고 있다).

4. **경계 탐색기는 순수·export 함수**
   - `expandToSentenceBoundary`(`ai-suggestion-card.ts:492-509`)·`isEmptyOrIdentical`(`:72-75`)·`deriveCardActions` 와 동일한 관례를 따른다 — CodeMirror `EditorView` 없이 문자열만으로 단위 테스트할 수 있어야 한다.
   - insert-below 와 `expandToSentenceBoundary` 는 **같은** 탐색기를 공유한다(판정 규칙 이중화 금지).

5. **소진 카드는 기존 done 카드를 대체하지 않고 증강한다(D5)**
   - `retry-exhausted` 분기는 `done` 렌더를 **그대로 포함**한다 — 제안 본문(`ai-suggestion-card.ts:447-450`), `truncated` 고지(`:453-458`), `renderDoneControls`(`:266-300` — 방향 지시 입력칸 + `↻` + 적용 버튼 + `✕ 취소`).
   - 그 **위에** 안내 문구와 `[⚡ 고급 모델로 다시 시도]` 를 **덧붙인다**. 대체가 아니라 증강이다.
   - 따라서 안내 문구가 가리키는 "위 입력칸"이 **실제로 존재**하게 되고, 제안과 적용 경로가 보존된다.
   - 닫기 수단은 `renderDoneControls` 가 이미 제공하는 `✕ 취소`(`:292-295`)로 충족되므로 **`appendDismissButton`(`:245-249`)을 추가하지 않는다**. 근거는 그 헬퍼가 streaming 분기에 대해 이미 명시한 규칙과 같다 — "streaming 은 이미 [✕ 취소]가 있으므로 이 헬퍼를 쓰지 않는다(중복 종료 컨트롤 금지)"(`:243`).

6. **"연속" 카운터 규칙은 3분류이며 호출부가 명시 전달한다(D6)**
   - 재요청은 정확히 세 종류로 분류되고, **각 호출부가 자기 종류를 인자로 명시 전달**한다. 지시 문자열의 내용이나 모델 인자로부터 **추론하지 않는다**.

   | 종류 | 해당 컨트롤 | 카운터 효과 |
   |------|-------------|-------------|
   | `blind` | done 카드의 `[↻ 다시]`(`:288-291`), 그리고 방향 지시 입력칸이 **빈 상태**에서 누른 `[↻]`(`:277-283`) | **+1 (센다)** |
   | `directed` | 방향 지시 입력칸에 **내용이 있는 상태**에서 누른 `[↻]` 또는 Enter | **0 으로 리셋(연속을 끊는다)** |
   | `exempt` | `[⚡ 고급 모델로 다시 시도]`(`:422-426`), error 카드의 `[다시 시도]`(`:370-374`), intruded 카드의 `[다시 요청]`(`:389-392`), 그리고 컨트롤러 내부 자동 재요청 — 표 검증 실패(`:1090`)·다이어그램 오류 동봉(`:1106`)·목록 폴백(`:1377-1384`) | **세지도 리셋하지도 않는다** |

   - `exempt` 의 근거: error/intruded 의 재시도는 **품질 반복이 아니라 복구 동작**이며, 그 phase 에는 `suggestion` 이 없어 D5 의 증강 렌더가 성립하지 않는다. 따라서 `retry-exhausted` 는 오직 `done` phase 에서만 도달 가능하다 — 이 불변식을 요구사항으로 못 박는다(REQ-AI10-027).
   - 세 값 전부 **실제 소비자를 가져야 한다**. 선택되지 않은 값을 계약에 남기지 않는다.

7. **소진 시점에는 요청을 발행하지 않는다(D7)**
   - `blind` 재요청이 상한을 넘기게 되면 배선은 `fireReRequest` 를 **호출하지 않고**, `enterReRequest()` 도 **호출하지 않는다**. 카드는 `retry-exhausted` 로 전이해 **제안을 그대로 가진 채** 머문다.
   - 그 상태의 탈출구는 셋이다: (a) 방향 지시 입력 후 `↻`(`directed` — 카운터 리셋 후 정상 발행), (b) `[⚡ 고급 모델로 다시 시도]`(`exempt` — 1회성 sonnet 발행), (c) 적용(바꾸기/아래에 삽입)과 `✕ 취소` — 셋 다 그대로 동작한다.

8. **소진 임계는 기존 상수를 그대로 쓴다(D8)**
   - `MAX_RETRY = 3`(`:75`)의 **값도 이름도 바꾸지 않는다**.
   - **4번째** `blind` 시도에서 소진 안내가 나타난다(3회는 실제로 발행된다). 이는 기존 `reduceCard` 의 `state.retryCount >= MAX_RETRY` 판정(`:98`)과 **동일한 경계**이며, SPEC-AI-001 AC-AI-011 의 "연속 3회 수행한 상태에서 3회가 소진되면"과 일치한다.

## Background & Rationale

네 결함은 서로 다른 계층에 있지만 하나의 사용자 서사를 공유한다 — "AI가 뭘 하는지 알 수 없고, 멈춰도 알 수 없고, 결과가 엉뚱한 곳에 들어가고, 계속 다시 눌러도 나아질 길이 안내되지 않는다".

### 결함 1 — 재요청 중 진행 표시 없음 (소스 대조 확인)

`fireReRequest`(`ai-suggestion-card.ts:1125-1138`)는 순서상 다음을 수행한다.

```
1125  function fireReRequest(originalArgs, overrides): string {
1132    store.startRequest(requestId, merged.feature);   // ← 구독 콜백이 여기서 동기 실행됨
1133    store.incrementCount();
1134    void aiRequest(merged)...
1137    return requestId;                                 // ← boundRequestId 대입은 이 이후
1138  }
```

zustand `set` 은 구독자를 **동기적으로** 호출한다. `:1132` 시점에 `useAiStore.subscribe` 콜백(`:1223`)이 실행되지만 첫 줄 `if (s.requestId !== boundRequestId) return;`(`:1224`)에서 `boundRequestId` 는 아직 **직전** 요청의 id 이므로 단락된다. `:1133` 도 동일하다. 이후 `boundRequestId` 가 갱신되지만 스토어에는 더 이상 변경이 없으므로 구독이 다시 깨어날 계기가 없다 — 첫 `ai://chunk` 가 도착해 `appendChunk` 가 실행될 때까지.

그 사이 카드가 렌더하는 것은 여전히 `done` phase 다: 옛 제안 본문 + [바꾸기]/[아래에 삽입]/[↻ 다시]/[✕ 취소]. 사용자가 ↻ 를 눌렀는데 화면이 **아무것도 변하지 않는다**. CLI 프로바이더의 첫 토큰 지연은 수 초 단위이므로(codex 는 완성본 1회 도착이라 더 길다 — SPEC-AI-009 사전 합의 §4) 체감상 "먹통"이다.

`rearmWaitNotice()`(`:1192`)가 호출되지만 이 역시 관측되지 않는다. 8초 후 `waitingLong = true` 가 되고 `notifyActiveCard()` 로 재렌더가 일어나지만, `WAIT_NOTICE_TEXT` 를 렌더하는 코드는 `phase === 'streaming'` 분기 내부(`:326-331`)에만 있다. 카드가 `done` 이면 안내 문구는 **어디에도 나타나지 않는다**.

**이것이 누락이지 설계가 아니라는 결정적 근거**: 같은 파일의 **내부 개시** 재요청 경로 3종이 전부 명시적으로 `streaming` 을 커밋한다.

| 경로 | 위치 | `stream` 커밋 |
|------|------|---------------|
| `enterListFallback()`(다이어그램 목록 폴백) | `:997-1000` | `this.commit({ type: 'stream' })` ✓ |
| `handleTableComplete()`(표 검증 실패 자동 재요청) | `:941` | `this.commit({ type: 'stream' })` ✓ |
| `handleDiagramComplete()`(다이어그램 자동 재시도) | `:957` | `this.commit({ type: 'stream' })` ✓ |
| **사용자 개시 5종** | `:1188-1193` (공통 배선) | **없음** ✗ |

`enterListFallback` 의 독스트링은 그 의도를 명시한다 — "카드를 즉시 streaming(스켈레톤/글로우)으로 되돌려 재요청이 진행 중임을 보여준다"(`:995`). 사용자 개시 경로에만 이 처리가 빠져 있다.

**부수 조건 — 낡은 버퍼**: `commit({type:'stream'})` 만 추가하면 `renderSuggestionCard` 는 `input.streamBuffer`(`:311`)를 본문으로 렌더한다. 컨트롤러의 `private streamBuffer`(`:838`)는 `onComplete`(`:903-923`)에서 초기화되지 않으므로 **직전 응답 본문이 그대로 남아 있고**, `:315` 의 `trim() === ''` 조건이 거짓이 되어 스켈레톤이 렌더되지 않는다. 즉 사용자는 "새 요청을 눌렀는데 옛 답이 그대로 떠 있는" 더 나쁜 상태를 본다. 버퍼 리셋이 재요청 진입 상태의 일부여야 하는 이유다.

### 결함 2 — 요청 영구 정지 + 카드 굶김 (소스 대조 확인)

#### (2a) 프론트 종결 보장 부재

백엔드는 요청당 워치독 스레드를 띄운다.

```rust
// src-tauri/src/ai/mod.rs:32
pub const WATCHDOG_TIMEOUT_SECS: u64 = 60;
// :282-283
std::thread::spawn(move || {
    std::thread::sleep(Duration::from_secs(WATCHDOG_TIMEOUT_SECS));
    ...  // claim_terminal 성공 시 자식 kill + ai://error{kind:"timeout"}
```

이 방어선은 **백엔드가 정상 동작할 때만** 유효하다. 프론트 관점에서 종결 이벤트가 유실되거나(이벤트 리스너 등록 경합), 프론트가 "현재"로 보지 않는 requestId 로 도착하면(아래 2b), 카드는 `streaming` phase 에 영구히 남는다. `waitNoticeTimer` 는 8초 뒤 안내 문구만 띄우고 스스로 해제되며(`:860-864`) 종결을 만들지 않는다. 사용자의 유일한 탈출 경로는 `✕ 취소`(`:332-334`) 수동 클릭이다.

#### (2b) 단일 스토어 슬롯 vs N-카드 레지스트리

| 계층 | 보유 개수 | 근거 |
|------|-----------|------|
| `aiStore` in-flight 요청 | **1개** | `AiTransientSlice { requestState, streamBuffer, requestId, ... }`(`src/store/aiStore.ts:23-30`) |
| `cardRegistry` 컨트롤러 | **N개** | `new Map<string, AiSuggestionCardController>()`(`:773`), 검토 대기 카드는 새 요청에도 생존(SPEC-AI-001 REQ-AI-034, `:1155-1158`) |
| 스토어 구독 슬롯 | **1개** | `let activeCardUnsub`(`:1084`), `startSuggestionCard` 첫 줄이 `activeCardUnsub?.()`(`:1153`) |

이벤트 릴레이는 스토어의 단일 슬롯을 게이트로 쓴다.

```ts
// src/hooks/useAiRelay.ts:36-38
function isCurrent(requestId: string): boolean {
  return useAiStore.getState().requestId === requestId;
}
// :52-66 — chunk/done/error 세 리스너 전부 !isCurrent(requestId) 면 return
```

따라서 다음 시퀀스가 **B를 영구 정지시킨다**.

```
1. 카드 B 요청 발행 → aiStore.requestId = B, B streaming
2. (그 사이) 카드 A 는 done 상태로 검토 대기 중
3. 사용자가 A 의 ↻ 클릭 → fireReRequest → aiStore.requestId = A'
4. B 의 ai://chunk 도착 → isCurrent(B) === false → 폐기
5. B 의 ai://done 도착 → isCurrent(B) === false → 폐기
6. B 는 streaming 에 영구 고착. 백엔드 워치독조차 B 를 구하지 못한다
   (워치독은 ai://error 를 emit 하지만 그 역시 isCurrent 에서 폐기된다)
```

6번이 핵심이다 — **백엔드 하드 타임아웃마저 이 경로에서는 무력하다.** 그래서 2a(프론트 백스톱)와 2b(이벤트 라우팅)는 함께 고쳐야 하며, 어느 하나만으로는 이 시나리오가 닫히지 않는다.

가중 요인으로 `startSuggestionCard`(`:1153`)의 `activeCardUnsub?.()` 가 있다. 새 카드가 만들어질 때마다 직전 카드의 스토어 구독이 끊기므로, 설령 릴레이가 이벤트를 통과시켜도 옛 카드는 이를 소비할 수단이 없다.

#### (2c) 파일 전환 잔존 — 이미 해결됨

`initAiFileSwitchEffects`(`src/lib/ai/aiFileSwitchEffects.ts`)가 `fileStore.currentFile` 전이를 관찰해 `runAiArtifactCleanup`(`src/lib/ai/aiOffEffects.ts:28-43`)을 호출하고, `AppLayout.tsx:91` 에서 마운트 1회 등록된다. SPEC-AI-009 REQ-AI9-033/034/035 의 구현이며 직전 커밋 `37059a7`(v0.13.0)에 반영되었다. 본 SPEC은 이를 **재구현하지 않고 회귀 가드로만** 다룬다(REQ-AI10-015).

다만 그 정리 경로가 호출하는 `clearCardRegistry`(`:806-812`)에 별개의 버그가 있다 — `cardRegistry.clear()` 로 Map 만 비우고 각 컨트롤러의 `destroy()`(`:881-883`)를 호출하지 않아 `waitNoticeTimer`(그리고 본 SPEC이 추가할 백스톱 타이머)가 살아남는다. 이는 본 SPEC 범위다(REQ-AI10-014).

### 결함 3 — insert-below 가 문서 맨 아래로 감 (소스 대조 확인)

```ts
// ai-suggestion-card.ts:551-556 (insert-below 분기)
const docText = view.state.doc.toString();
const sepAfter = docText.slice(ctx.to).indexOf(PARAGRAPH_SEP);   // PARAGRAPH_SEP = '\n\n' (:478)
const paraEnd = sepAfter === -1 ? view.state.doc.length : ctx.to + sepAfter;
view.dispatch({ changes: { from: paraEnd, insert: `${PARAGRAPH_SEP}${ctx.suggestion}` } });
```

`sepAfter === -1` 폴백이 문제의 전부다. 마크다운은 다음을 **단일 `\n`** 으로 구분한다.

| 구조 | 예 |
|------|-----|
| 제목과 본문 | `## 제목\n- 항목` |
| 목록 항목 | `- 하나\n- 둘\n- 셋` |
| 표 행 | `\| a \| b \|\n\|---\|---\|\n\| 1 \| 2 \|` |
| 인용 | `> 첫 줄\n> 둘째 줄` |

따라서 선택 이후 구간에 빈 줄이 하나도 없으면 — 표/목록으로 끝나는 문서, 또는 표/목록 영역이 문서 끝까지 이어지는 경우 — 삽입 지점이 **문서 맨 끝**으로 튄다. 사용자의 "가끔" 관측과 정확히 일치하며, 보고된 사례(표/목록 영역 아래에 AI 생성 표를 넣으려 함)가 바로 이 조건이다.

**같은 전제가 `expandToSentenceBoundary` 에도 있다.**

```ts
// :501-502
const sepAfter = doc.slice(to).indexOf(PARAGRAPH_SEP);
const paraEnd = sepAfter === -1 ? doc.length : to + sepAfter;
```

이쪽이 **더 위험하다**. `expandToSentenceBoundary` 의 산출은 카드의 `range`(`SuggestionCardModel.range`)가 되고, 그 range 는 `applySuggestion` 의 **replace 모드에서 파괴적으로 덮어써지는 범위**다(`:546-549`). 종결 부호가 하나도 없는 구간(제목·목록·표만 있는 영역)에서 문장 경계 확장이 발동하면 replace 범위가 조용히 문서 끝까지 넓어진다. 실제 파괴는 `applySuggestion` 의 원문 재검증(`:541-544`)이 대부분 막지만 — 넓어진 범위의 원문이 스냅샷과 일치하면 그대로 통과한다 — "카드에 미리 보여준 범위"가 문서 절반이 되는 것 자체가 사용자에게 관측되는 결함이다. 결함 3의 두 절반 중 이쪽을 먼저 닫는 것이 옳다.

**기존 테스트의 커버리지 공백**: `src/test/aiSuggestionApply.test.ts:124-168` 은 (a) `\n\n` 이 존재하는 케이스, (b) EOF 케이스 두 가지만 다룬다. `\n\n` 이 없는데 EOF 도 아닌 중간 케이스 — 즉 결함이 발생하는 정확한 조건 — 이 비어 있다. 두 기존 테스트는 수정 후에도 **무수정 통과**해야 한다(회귀 가드).

### 결함 4 — `retry-exhausted` phase 도달 불가 (소스 대조 확인)

> **줄 번호 기준**: 이 절과 모듈 4의 모든 줄 번호는 **M1~M3 구현 이후(현재 브랜치)** 의 `ai-suggestion-card.ts` 를 가리킨다. 결함 1~3 서술의 줄 번호는 개정 이전(v0.0.1 작성 시점) 기준이므로 두 계열이 서로 다르다.

#### (4a) 상태 머신과 렌더는 있는데 배선이 없다

`reduceCard` 는 재요청 카운터를 위한 모든 조각을 갖추고 있다.

```ts
// :65
| { type: 'retry' }
// :75
const MAX_RETRY = 3;
// :97-100
case 'retry':
  return state.retryCount >= MAX_RETRY
    ? { ...state, phase: 'retry-exhausted' }
    : { ...state, phase: 'streaming', retryCount: state.retryCount + 1 };
```

`renderSuggestionCard` 에도 전용 분기가 있다(`:418-430`). 그런데 `grep -rn "type: 'retry'" src/` 의 결과는 다음 셋뿐이다.

| 위치 | 성격 |
|------|------|
| `src/components/editor/extensions/ai-suggestion-card.ts:65` | 타입 선언 |
| `src/test/aiSuggestionCard.test.ts:55` | 리듀서 단위 테스트(카운터 증가) |
| `src/test/aiSuggestionCard.test.ts:63` | 리듀서 단위 테스트(상한 소진) |

즉 **프로덕션 코드는 이 이벤트를 한 번도 커밋하지 않는다**. 재요청 5종은 전부 `callbacks.onReRequest` 로 수렴하고(`:279`·`:290`·`:372`·`:391`·`:425`), 그 배선(`:1362-1372`)은 `controller.enterReRequest()` → `fireReRequest` 만 수행한다. `enterReRequest()`(`:1177-1182`)는 버퍼 리셋·타이머 재무장·`commit({type:'stream'})` 셋만 하며 카운터를 건드리지 않는다.

**결과**: `retryCount`(`:51`)는 프로덕션에서 영원히 `0` 이고, `MAX_RETRY`(`:75`)는 죽은 상수이며, `retry-exhausted` 분기와 그 안의 `[⚡ 고급 모델로 다시 시도]`(`:422`)는 **실기기에서 도달할 수 없다**. SPEC-AI-001 REQ-AI-025(AC-AI-011)는 상태 머신·렌더까지 준비된 채 배선만 빠진 **미구현 요구**다.

#### (4b) 도달 가능하게 만들기만 하면 더 나빠지는 세 가지

현행 `retry-exhausted` 분기는 다음과 같다.

```ts
// :418-430
if (state.phase === 'retry-exhausted') {
  const msg = ...;
  msg.textContent = '방향을 알려주시면 더 정확해요 (위 입력칸)';
  const advanced = makeButton('mdedit-ai-advanced', '⚡ 고급 모델로 다시 시도');
  advanced.addEventListener('click', () => callbacks.onReRequest(buildRetryInstruction(), 'sonnet'));
  card.appendChild(msg);
  card.appendChild(advanced);
  return card;
}
```

| # | 문제 | 근거 |
|---|------|------|
| 1 | **문구가 존재하지 않는 컨트롤을 가리킨다** | 안내 문구는 "(위 입력칸)"이라고 하지만 이 분기는 `renderDoneControls`(`:266-300`)를 호출하지 않아 방향 지시 입력칸이 **없다** |
| 2 | **닫을 수 없는 카드** | SPEC-AI-009 REQ-AI9-036/037 이 `appendDismissButton`(`:245-249`)을 종결 phase 4종(error `:378` / empty `:349` / cancelled-by-new `:405` / stale `:414`)에 붙였으나 `retry-exhausted` 는 **도달 불가라 누락**되었다. 현 상태로 도달 가능하게 만들면 사용자가 치울 수단이 없는 카드가 출시된다 |
| 3 | **멀쩡한 제안이 사라진다** | 이 분기는 `state.suggestion` 을 렌더하지 않고 적용 버튼도 만들지 않는다. ↻ 를 네 번째로 누른 순간 직전의 쓸 만한 제안이 화면에서 증발한다 |

3번이 이 결함을 "한 줄 배선 추가"로 끝낼 수 없게 만드는 지점이다. 카운터만 배선하면 사용자는 **재요청을 한 번 더 눌렀다는 이유로 결과를 잃는다** — 고치기 전보다 나쁘다. 그래서 D5(증강 렌더)·D7(소진 시 미발행)이 카운터 배선과 **같은 모듈에** 묶인다.

#### (4c) 왜 `blind` 만 세는가

REQ-AI-025 의 문언은 "**↻ 방향 없는** 재요청이 **연속** 3회"다. 두 수식어가 각각 D6 의 `blind` 분류와 `directed` 리셋에 대응한다.

- 방향을 준 재요청은 사용자가 이미 "더 나은 지시"라는 탈출구를 쓴 것이므로 소진 안내를 띄울 이유가 없다 — 연속이 끊긴다.
- error/intruded 의 재시도는 **복구 동작**이지 품질 반복이 아니다. 게다가 그 phase 에는 `suggestion` 이 없어 D5 의 증강 렌더가 성립하지 않는다. 따라서 이 경로들이 카운터를 밀어 `retry-exhausted` 에 도달시키면 **제안 없는 소진 카드**라는 렌더 불가능한 상태가 생긴다.
- 컨트롤러 내부 자동 재요청(표 `:1090`, 다이어그램 `:1106`, 목록 폴백 `:1377-1384`)은 사용자가 누른 것이 아니다. 이것이 카운터를 밀면 사용자는 자기가 한 번도 누르지 않은 소진 안내를 보게 된다.

이 셋이 전부 `exempt` 인 이유이며, 결과적으로 **`retry-exhausted` 는 오직 `done` phase 에서 출발한 `blind` 재요청으로만 도달 가능**하다는 불변식이 성립한다(REQ-AI10-027).

## Environment & Assumptions

- **프론트엔드**: React 18, TypeScript strict, CodeMirror 6. 변경 표면은 `src/components/editor/extensions/ai-suggestion-card.ts`(3개 모듈 전부의 주 지점), `src/lib/ai/waitNotice.ts`(임계 상수), 그리고 결함 2b의 이벤트 라우팅 지점(`src/hooks/useAiRelay.ts` + 신규 라우터 모듈 후보 — plan.md 결정 기록 참조).
- **백엔드**: `src-tauri/` **무변경**. `WATCHDOG_TIMEOUT_SECS = 60`(`src-tauri/src/ai/mod.rs:32`)은 본 SPEC의 프론트 백스톱이 참조하는 **읽기 전용 상수**다.
- **모듈 4의 변경 표면**: `src/components/editor/extensions/ai-suggestion-card.ts` **1개 파일뿐이다** — `CardEvent`/`reduceCard`(순수 상태 머신), `CardCallbacks.onReRequest` 시그니처와 그 5개 렌더 호출부 + 3개 내부 호출부, `onReRequest` 배선(`:1362-1372`), `retry-exhausted` 렌더 분기(`:418-430`). `waitNotice.ts`·`useAiRelay.ts`·`aiStore.ts`·`src-tauri/` 전부 무변경이다.
- **개발 모드**: `quality.yaml` `development_mode: tdd`, `test_coverage_target: 85`. 네 모듈 전부 **실패하는 테스트를 먼저** 작성한다(RED → GREEN → REFACTOR). AC-AI10-001·005·007·010·013·014 는 현행 코드에서 **반드시 실패**해야 하며, 실패하지 않으면 재현 시나리오가 결함을 담아내지 못한 것이므로 시나리오를 다시 잡는다.
- **테스트 환경**: Vitest + Testing Library + jsdom. 타이머 검증은 `vi.useFakeTimers()` / `vi.advanceTimersByTime()`. Tauri IPC(`aiRequest`/`aiCancel`)와 `@tauri-apps/api/event` 의 `listen` 은 mock 으로 주입한다 — 실제 런타임 의존 금지(CI 실행 가능해야 함).
- **언어 설정**: `code_comments: ko`, `documentation: ko`, `error_messages: en`. `@MX` 태그 서술과 코드 주석은 한국어로 작성한다.
- **이벤트 계약**: `ai://chunk`(`{requestId, text}`), `ai://done`(`{requestId, result, truncated?}`), `ai://error`(`{requestId, kind, message, cancelledBy?}`) — 전부 기존 계약(`src/hooks/useAiRelay.ts:11-30`)이며 본 SPEC은 payload 스키마를 변경하지 않는다.
- **IPC 계약**: `AiRequestArgs`·`AiProviderStatus`·`ai_cancel` 무변경. 신규 IPC 커맨드·신규 필드를 도입하지 않는다.

## Requirements (EARS)

> 변경 유형 태그: **[NEW]** = 신규 파일/함수, **[MODIFY]** = 기존 파일 수정, **[EXISTING]** = 기존 자산 재사용(회귀 가드 대상), **[REGRESSION_GUARD]** = 변경 금지 계약. REQ ID 접두사 `AI10` 은 SPEC-AI-001(`REQ-AI-XXX`)·SPEC-AI-006(`REQ-AI6-XXX`)·SPEC-AI-009(`REQ-AI9-XXX`) 계보를 잇는다.

### 모듈 1 — 사용자 개시 재요청의 진행 표시 (결함 1)

- **REQ-AI10-001** (Event-Driven) **[MODIFY]**: **WHEN** 사용자가 개시한 재요청이 발행되면, **the system shall** 해당 카드를 **즉시**(첫 `ai://chunk` 도착 이전에) `streaming` phase 로 전이시킨다. 이 전이는 새 요청의 스트림이 도착하는지 여부와 무관하게 발행 시점에 관측 가능해야 한다.
- **REQ-AI10-002** (Ubiquitous) **[MODIFY]**: The system **shall** REQ-AI10-001 의 전이와 **같은 시점에** 해당 카드 컨트롤러의 스트림 버퍼를 빈 문자열로 되돌린다. 그렇지 않으면 직전 응답 본문이 남아 3줄 shimmer 스켈레톤 대신 낡은 텍스트가 렌더된다(`ai-suggestion-card.ts:311`·`:315` 의 빈 버퍼 조건). 버퍼 리셋과 phase 전이는 **분리 불가한 한 쌍**이다.
- **REQ-AI10-003** (Ubiquitous) **[MODIFY]**: The system **shall** REQ-AI10-001/002 를 다음 **사용자 개시 재요청 5개 진입점 전부**에 적용한다. 어느 하나라도 누락되면 그 진입점에서 결함이 잔존한다.

  | # | 컨트롤 | 렌더 위치 | 성격 |
  |---|--------|-----------|------|
  | 1 | `↻`(방향 지시 입력 + 버튼/Enter) | `ai-suggestion-card.ts:271-279` | directed |
  | 2 | `↻ 다시` | `:282-285` | blind |
  | 3 | `⚡ 고급 모델로 다시 시도` | `:416-419` | sonnet 승격 |
  | 4 | `다시 시도`(`error` phase, `errorKind` 기타) | `:364-368` | 오류 복구 |
  | 5 | `다시 요청`(`intruded` phase) | `:383-385` | 편집 침입 복구 |

  다섯 진입점은 모두 `callbacks.onReRequest` 라는 **단일 배선**(`:1188-1193`)으로 수렴하므로, 그 배선 한 곳에서 처리하는 것이 다섯 곳에 흩뿌리는 것보다 옳다(중복 금지).
- **REQ-AI10-004** (Event-Driven) **[MODIFY]**: **WHEN** REQ-AI10-001 의 전이가 일어나면, **the system shall** 8초 대기 안내 타이머를 재무장해, 새 요청이 임계를 넘도록 응답하지 않으면 대기 안내 문구가 **실제로 화면에 나타나게** 한다. 현행 `rearmWaitNotice()`(`:868-871`) 호출은 유지되지만, 안내 문구가 `phase === 'streaming'` 분기(`:326-331`)에서만 렌더되므로 REQ-AI10-001 없이는 관측되지 않는다 — 두 요구는 함께여야 의미를 갖는다.
- **REQ-AI10-005** (Unwanted) **[MODIFY]**: **IF** 구현이 재요청 진행 표시를 위해 (a) 진행률 바·퍼센트·남은 시간(ETA) 등 실제 진척도가 없는 **가짜 진행 지표**를 도입하거나, (b) `streaming` 외의 신규 phase·신규 위젯·신규 CSS 애니메이션을 추가하려 시도하면, **then** the system **shall** 이를 거부한다. 재사용 대상은 `renderSuggestionCard` 의 기존 `phase === 'streaming'` 분기(`:305-336`) **그 자체**다. 근거: SPEC-AI-006 REQ-AI6-009 가 가짜 진행 표시를 이미 금지하고 있으며(`waitNotice.ts:9` 주석이 이를 명시), 본 결함은 표시 수단의 부재가 아니라 **전이 누락**이므로 새 수단이 필요하지 않다.
- **REQ-AI10-006** (Unwanted) **[REGRESSION_GUARD]**: **IF** 모듈 1의 구현이 이미 올바르게 동작하는 **내부 개시** 재요청 경로 — `enterListFallback()`(`:997-1000`), `handleTableComplete()`(`:941`), `handleDiagramComplete()` 자동 재시도(`:957`) — 의 관측 가능한 동작을 바꾸려 시도하면, **then** the system **shall** 이를 거부한다. 이 세 경로는 이미 `commit({type:'stream'})` 을 수행하므로, 공통 배선에 처리를 추가한 결과 **같은 카드에 대해 `stream` 이 두 번 커밋되어** 다이어그램·표 검증 흐름(재시도 상한 카운터·목록 폴백 플래그)이 흔들려서는 안 된다. `diagramAttempts`·`tableAttempts`·`listFallbackActive` 의 값 궤적이 개정 전과 동일해야 한다.

### 모듈 2 — 종결 보장(프론트 백스톱) + 카드 공존 (결함 2)

- **REQ-AI10-007** (Ubiquitous) **[MODIFY]**: The system **shall** AI 요청의 세 타임아웃 계층을 **단일 상수 모듈**(`src/lib/ai/waitNotice.ts` 또는 이를 대체하는 동등한 단일 소스)에 함께 정의하고, 각 값의 역할과 상호 관계를 그 자리에서 문서화한다. 세 계층은 다음이다.

  | 계층 | 역할 | 값의 출처 |
  |------|------|-----------|
  | 소프트 대기 안내 | "아직 생성 중이에요" 보조 문구 표시 | 기존 `WAIT_NOTICE_DELAY_MS = 8000`(`waitNotice.ts:7`) — **무변경** |
  | 백엔드 하드 워치독 | 자식 프로세스 kill + 분류된 `ai://error{kind:"timeout"}` | `src-tauri/src/ai/mod.rs:32` `WATCHDOG_TIMEOUT_SECS = 60` 을 **미러링**한 프론트 상수 |
  | 프론트 백스톱 | 백엔드 종결마저 도달하지 않았을 때의 최후 방어 | 백엔드 미러 값에서 **파생**(고정 유예를 더한 값) |

  프론트 백스톱 값은 독립된 두 번째 매직 넘버로 적지 않고 **백엔드 미러 상수로부터 파생**한다 — 그래야 백엔드 값이 바뀔 때 편집 지점이 하나로 유지된다.
- **REQ-AI10-008** (Unwanted) **[MODIFY]**: **IF** 프론트 백스톱 임계가 백엔드 하드 워치독 값 **이하**로 설정되면, **then** the system **shall** 이를 거부한다. 세 계층은 항상 `소프트 대기 안내 < 백엔드 하드 워치독 < 프론트 백스톱` 순서를 만족해야 한다. 근거: 백엔드가 정상 동작하는 한 사용자는 **분류된** `timeout` 오류(원인이 명확하고 기존 문구 체계를 따름)를 받아야 하며, 프론트 백스톱이 먼저 발동하면 정상 요청을 가로채 덜 유용한 오류로 덮어쓴다. 이 순서 불변식은 상수만으로 판정 가능하므로 단위 테스트로 고정한다.
- **REQ-AI10-009** (Event-Driven) **[MODIFY]**: **WHEN** 어떤 카드가 `streaming` phase 로 진입한 뒤 프론트 백스톱 임계를 넘도록 **어떤 종결 이벤트(`ai://done`/`ai://error`)도 수신하지 못하면**, **the system shall** 그 카드를 기존 `error` phase 로 전이시키고 **분류된 사용자 문구**를 표시한다. raw JSON·stderr·스택 트레이스·내부 식별자를 노출하지 않는다(SPEC-AI-001 REQ-AI-040 계약 연장). 신규 `errorKind` 값을 만들지 않고 기존 집합(`login|network|parse|other`)에 머문다.
- **REQ-AI10-010** (Ubiquitous) **[MODIFY]**: The system **shall** 백스톱 타이머의 생명주기를 기존 `waitNoticeTimer`(`:847`, `armWaitNoticeTimer` `:858-865`, `clearWaitNoticeTimer` `:873-878`, `destroy` `:881-883`)와 **동일한 규율**로 관리한다: (a) 카드 컨트롤러 생성 시 무장, (b) 재요청(REQ-AI10-001)마다 재무장, (c) 종결·소멸 사건 — `ai://done` 수신, `ai://error` 수신, 사용자 취소, 원문 편집 침입(`intrude`), 원문 불일치(`stale`), 새 요청에 의한 취소(`cancel-by-new`), 제안 적용, 닫기 — 에서 **즉시 해제**. 어떤 경로로도 해제되지 않은 채 컨트롤러가 레지스트리에서 사라지는 일이 없어야 한다(타이머 누수 금지).
- **REQ-AI10-011** (Ubiquitous) **[MODIFY]**: The system **shall** REQ-AI10-009 로 만들어진 `error` 카드에 **재시도 컨트롤과 닫기 컨트롤을 모두** 제공한다. 닫기는 SPEC-AI-009 REQ-AI9-036 이 도입한 기존 경로(`appendDismissButton`, `:240-243`)를 재사용하며 새 컨트롤을 만들지 않는다. 사용자가 "다시 해보기"와 "치우기" 중 어느 쪽도 선택할 수 없는 막다른 상태가 남아서는 안 된다.
- **REQ-AI10-012** (Ubiquitous) **[MODIFY]**: The system **shall** 카드가 여러 개 공존할 때 각 카드가 **자신의 requestId 에 해당하는 스트림·종결 이벤트를 끝까지 수신**하게 한다. 구체적으로: 카드 A가 검토 대기(`done`) 상태이고 카드 B가 `streaming` 인 상황에서 사용자가 카드 A에 재요청을 발행해도, 카드 B는 자신의 `ai://chunk` 를 계속 받아 `ai://done` 으로 정상 종결해야 한다. 현행 구조에서 이것이 성립하지 않는 두 지점은 (i) `useAiRelay.isCurrent`(`src/hooks/useAiRelay.ts:36-38`)가 단일 슬롯 `aiStore.requestId` 와 다른 이벤트를 스토어 진입 이전에 폐기하는 것, (ii) `startSuggestionCard`(`:1153`)의 `activeCardUnsub?.()` 가 직전 카드의 구독을 해제해 어느 시점에도 1개 카드만 바인딩되는 것이다. 두 지점이 **모두** 해소되어야 본 요구가 충족된다.
- **REQ-AI10-013** (Unwanted) **[MODIFY]**: **IF** REQ-AI10-009 의 백스톱 발동이 (a) 문서 텍스트를 삽입·삭제·치환하거나, (b) 발동 대상 카드 **이외의** 카드 상태를 바꾸거나, (c) 다른 카드의 in-flight 요청을 취소하려 시도하면, **then** the system **shall** 이를 거부한다. 백스톱은 **자기 카드 하나만** `error` 로 전이시키는 국소 효과여야 한다 — 그렇지 않으면 카드 하나의 정체가 정상 동작 중인 다른 카드를 함께 무너뜨린다.
- **REQ-AI10-014** (Ubiquitous) **[MODIFY]**: The system **shall** `clearCardRegistry()`(`:806-812`)가 레지스트리를 비우기 전에 등록된 **모든** 컨트롤러의 `destroy()`(`:881-883`)를 호출하게 한다. 현행 구현은 `cardRegistry.clear()` 로 Map 만 비워 각 컨트롤러의 `waitNoticeTimer`(및 REQ-AI10-010 의 백스톱 타이머)를 누수시킨다 — 해제되지 않은 타이머는 이미 사라진 카드에 대해 발화해 불필요한 재렌더를 유발하고, 테스트 간 격리를 깬다.
- **REQ-AI10-015** (Unwanted) **[REGRESSION_GUARD]**: **IF** 모듈 2의 구현이 활성 문서 전환 시 AI 산출물 정리 동작(SPEC-AI-009 REQ-AI9-033/034/035 — `initAiFileSwitchEffects` + `runAiArtifactCleanup` 의 취소 → 고스트 정리 → 레지스트리 비움 3동작, `AppLayout.tsx:91` 1회 등록, 문서 텍스트 무변경 불변)을 바꾸려 시도하면, **then** the system **shall** 이를 거부한다. 이 동작은 커밋 `37059a7`(v0.13.0)에서 이미 구현·검증되었으므로 본 SPEC은 **재구현하지 않는다** — REQ-AI10-014 의 `destroy()` 호출 추가는 정리 **효과**를 바꾸지 않고 누수만 막는 보강이며, 3동작의 발동 조건·순서·문서 무손상 계약은 그대로다.

### 모듈 3 — 마크다운 블록 경계 기반 삽입·확장 (결함 3)

- **REQ-AI10-016** (Ubiquitous) **[NEW]**: The system **shall** 마크다운 블록 끝 지점을 찾는 **순수·export 함수**를 제공한다. 이 함수는 (문서 문자열, 스캔 시작 오프셋)만 받아 블록 끝 오프셋을 반환하며, CodeMirror `EditorView`·DOM·스토어에 의존하지 않아 문자열만으로 단위 테스트할 수 있어야 한다(`expandToSentenceBoundary`(`:492`)·`isEmptyOrIdentical`(`:72`)·`deriveCardActions` 와 동일 관례).
- **REQ-AI10-017** (Ubiquitous) **[NEW]**: The system **shall** REQ-AI10-016 함수의 탐색 규칙을 다음으로 고정한다.
  1. 스캔은 **시작 오프셋이 속한 줄의 다음 줄**부터 시작한다(시작 줄 자신은 현재 블록의 일부이므로 그 줄의 블록 시작 여부를 판정하지 않는다).
  2. 각 줄에 대해 **빈 줄**(공백만 포함하는 줄 포함)이거나 **새 마크다운 블록을 시작하는 줄**이면 스캔을 멈추고, 블록 끝 = **직전 줄의 끝**(개행 문자 앞)으로 확정한다.
  3. 그렇지 않으면(= 산문 연속 줄) 계속 전진한다.
  4. 문서 끝에 도달하면 블록 끝 = 문서 길이.

  "새 마크다운 블록을 시작하는 줄"은 다음 7종으로 한정한다(들여쓰기 0~3칸 허용, 4칸 이상은 들여쓴 코드로 보아 블록 시작으로 취급하지 않는다).

  | 종류 | 형태 |
  |------|------|
  | ATX 제목 | `#`~`######` 뒤에 공백 또는 줄 끝 |
  | 순서 없는 목록 | `-`·`*`·`+` 뒤에 공백 |
  | 순서 있는 목록 | 숫자 + `.` 또는 `)` 뒤에 공백 |
  | 인용 | `>` |
  | 표 행 | `\|` |
  | 코드 펜스 | ` ``` ` 또는 `~~~` |
  | 구분선 | `-`·`*`·`_` 3개 이상만으로 이뤄진 줄 |

  **예외(setext 밑줄)**: `-` 만으로 또는 `=` 만으로 이뤄진 줄이 **비어 있지 않고 블록 시작도 아닌 줄(= 산문 줄) 바로 다음**에 오면, 그 줄은 구분선이 아니라 **setext 제목의 밑줄**이므로 블록 시작으로 취급하지 않고 연속 줄로 본다. 이 예외 없이는 제목 텍스트와 그 밑줄 사이에 내용이 삽입되어 문서 구조가 깨진다.
- **REQ-AI10-018** (Ubiquitous) **[MODIFY]**: The system **shall** "아래에 삽입"(insert-below) 모드의 삽입 지점을 REQ-AI10-016 함수의 반환값으로 결정한다. `docText.slice(ctx.to).indexOf(PARAGRAPH_SEP)` 와 `sepAfter === -1 ? view.state.doc.length` 폴백(`:553-554`)을 이 호출로 대체한다. 삽입 내용의 형태(`\n\n` + 제안 본문)와 단일 `dispatch` 트랜잭션 구조(`:555`)는 **무변경**이다.
- **REQ-AI10-019** (Ubiquitous) **[MODIFY]**: The system **shall** `expandToSentenceBoundary`(`:492-509`)의 문단 끝 계산(`:501-502`)도 **동일한** REQ-AI10-016 함수로 대체한다. 종결 부호가 발견되지 않은 채 블록 끝에 닿으면 확장 범위는 그 **블록 끝**까지이며 문서 끝까지 넓어지지 않는다. 이 경로의 산출은 `applySuggestion` 의 replace 모드가 **파괴적으로 덮어쓰는 범위**이므로, 두 소비자가 같은 판정을 쓰는 것은 편의가 아니라 안전 요건이다(판정 규칙 이중화 금지).
- **REQ-AI10-020** (Unwanted) **[MODIFY]**: **IF** REQ-AI10-016 의 탐색이 **여러 줄로 이어지는 산문 문단을 중간에서 끊으려** 시도하면, **then** the system **shall** 이를 거부한다 — 문단 내부의 줄바꿈은 블록 경계가 아니다. 결과적으로 여러 줄 산문 문단 안 어디를 선택하든 삽입 지점은 그 **문단 전체의 뒤**여야 하며, 문장 두 개 사이에 제안이 끼어드는 일이 없어야 한다.
- **REQ-AI10-021** (State-Driven) **[MODIFY]**: **WHILE** 스캔이 블록 시작 줄도 빈 줄도 만나지 못한 채 문서 끝에 도달한 상태이면, the system **shall** 블록 끝을 문서 길이로 확정하고 문서 끝에 삽입한다. 이는 **현행 동작이 이미 옳은 유일한 경우**이며 기존 테스트(`src/test/aiSuggestionApply.test.ts` 의 "inserts at document end when the selection is in the last paragraph")가 이를 고정하고 있으므로, 본 개정 후에도 그 테스트가 **무수정 통과**해야 한다.
- **REQ-AI10-022** (Unwanted) **[REGRESSION_GUARD]**: **IF** 모듈 3의 구현이 `applySuggestion`(`:540-557`)의 무손상 계약 — (a) dispatch 직전 `view.state.sliceDoc(from, to) === ctx.originalText` 원문 재검증(`:541-544`)과 불일치 시 무변경 `stale` 반환, (b) 적용이 **단일 `changes` 트랜잭션**으로 이뤄져 `Mod+Z` 한 번에 복원되는 성질(`:547`·`:555`), (c) `replace` 모드 분기(`:546-549`)의 동작 — 을 바꾸려 시도하면, **then** the system **shall** 이를 거부한다. 본 모듈이 바꾸는 것은 **삽입 지점 계산 하나뿐**이며, 문서 텍스트는 여전히 사용자의 명시적 [바꾸기]/[아래에 삽입] 확정으로만 변한다(SPEC-AI-001 REQ-AI-022/033/035).

### 모듈 4 — 재요청 소진 안내 도달 가능화 (결함 4)

> 줄 번호는 **M1~M3 구현 이후(현재 브랜치)** 기준이다. 모듈 4는 SPEC-AI-001 REQ-AI-025 / AC-AI-011 의 **문언을 개정하지 않고** 그 요구를 실행 가능하게 만든다.

- **REQ-AI10-023** (Ubiquitous) **[MODIFY]**: The system **shall** 재요청을 정확히 세 종류(`blind` / `directed` / `exempt`)로 분류하고, 그 종류를 `CardCallbacks.onReRequest`(`ai-suggestion-card.ts:199`)의 **명시 인자**로 전달한다. 호출부가 자기 종류를 직접 넘기며, 시스템은 **지시 문자열의 내용이나 모델 인자로부터 종류를 추론하지 않는다** — 추론은 `buildRetryInstruction()`(`:118-121`)의 기본 문구와 사용자가 우연히 같은 문구를 입력한 경우를 구별할 수 없고, 새 호출부가 추가될 때마다 조용히 오분류된다. 이 인자는 **선택적이며 기본값은 `exempt`** 다(REQ-AI10-033 의 호환성 계약).
- **REQ-AI10-024** (Event-Driven) **[MODIFY]**: **WHEN** `blind` 재요청이 발행되면, **the system shall** 해당 카드에 기존 `{ type: 'retry' }` 이벤트(`:65`)를 커밋해 `retryCount`(`:51`)를 1 증가시킨다. 이로써 프로덕션 코드에 `'retry'` 이벤트의 **최초 소비자**가 생기고 `MAX_RETRY`(`:75`)가 실효를 갖는다. `blind` 의 범위는 done 카드의 `[↻ 다시]`(`:288-291`)와 **방향 지시 입력칸이 빈 상태**에서 누른 `[↻]`/Enter(`:277-283`) 둘이다.
- **REQ-AI10-025** (Event-Driven) **[MODIFY]**: **WHEN** `directed` 재요청이 발행되면, **the system shall** 그 카드의 연속 카운터를 **0 으로 되돌린다**. "연속"이 REQ-AI-025 문언의 일부이므로 방향을 준 시점에 연속은 끊긴다. 리셋은 `reduceCard` 에 **전용 이벤트를 신설**해 표현하며, 기존 `'retry'` 케이스(`:97-100`)의 의미는 건드리지 않는다 — 하나의 이벤트에 두 의미를 얹으면 리듀서 단위 테스트(`aiSuggestionCard.test.ts:54-66`)가 덮는 계약이 흔들린다.
- **REQ-AI10-026** (Ubiquitous) **[MODIFY]**: The system **shall** 다음 재요청을 `exempt` 로 분류해 **세지도 리셋하지도 않는다**.

  | # | 호출부 | 위치 | 면제 근거 |
  |---|--------|------|-----------|
  | 1 | `[⚡ 고급 모델로 다시 시도]` | `:422-426` | 소진 상태의 **탈출구**다. 이것이 카운트되면 자기 자신을 즉시 재소진시킨다(REQ-AI10-032) |
  | 2 | `[다시 시도]`(error phase) | `:370-374` | 품질 반복이 아니라 **복구 동작**. 그 phase 에는 `suggestion` 이 없어 D5 증강 렌더가 성립하지 않는다 |
  | 3 | `[다시 요청]`(intruded phase) | `:389-392` | 위와 동일 — 편집 침입으로부터의 복구다 |
  | 4 | 표 검증 실패 자동 재요청 | `:1090` | 사용자가 누른 것이 아니다. 카운트하면 누른 적 없는 소진 안내가 뜬다 |
  | 5 | 다이어그램 오류 동봉 자동 재요청 | `:1106` | 위와 동일 |
  | 6 | 목록 폴백 재요청 | `:1377-1384` | 위와 동일. 이 경로는 `onReRequest` 를 거치지 않고 `fireReRequest` 를 직접 호출하므로 **구조적으로도** 카운터에 닿지 않는다 |

  세 분류값은 **전부 실제 소비자를 가져야 한다** — 선택되지 않은 값을 계약에 남기면 소비자 0인 죽은 API 가 된다.
- **REQ-AI10-027** (State-Driven) **[MODIFY]**: **WHILE** 카드가 `done` phase 가 아닌 상태이면, the system **shall** 그 카드가 `retry-exhausted` phase 로 전이하지 않게 한다. `retry-exhausted` 는 오직 **`done` phase 에서 출발한 `blind` 재요청**으로만 도달 가능하다. 이 불변식이 D5 증강 렌더의 전제다 — `retry-exhausted` 렌더는 `state.suggestion` 이 존재한다고 가정하며, `suggestion` 이 빈 phase(error/intruded/empty)에서 도달하면 본문 없는 껍데기 카드가 된다.
- **REQ-AI10-028** (Event-Driven) **[MODIFY]**: **WHEN** `blind` 재요청이 상한을 초과하게 되면(`state.retryCount >= MAX_RETRY`, `:98`), **the system shall** 요청을 **발행하지 않는다**. 구체적으로 `fireReRequest`(`:1370`)를 호출하지 않고, `controller.enterReRequest()`(`:1368`)도 호출하지 않으며, `boundRequestId`(`:1345`)와 `lastHandledTerminal`(`:1347`)을 갱신하지 않는다. 카드는 `retry-exhausted` 로 전이해 **`state.suggestion` 을 그대로 보존한 채** 머문다. 근거: 이 시점의 시스템 판단은 "같은 방식의 재시도는 더 나아지지 않는다"이며, 그럼에도 요청을 쏘면 사용자를 기다리게 하고 프로바이더 비용을 쓰면서 이미 가진 제안을 스켈레톤으로 덮는다.
- **REQ-AI10-029** (Ubiquitous) **[MODIFY]**: The system **shall** `retry-exhausted` 렌더 분기(`:418-430`)가 `done` 렌더의 구성 요소를 **전부 포함**하게 한다 — (a) 제안 본문(`.mdedit-ai-suggestion`, `:447-450`), (b) `truncated` 일 때 절단 고지(`:453-458`), (c) `renderDoneControls`(`:266-300`) 전체(방향 지시 입력칸 + `[↻]` + 적용 버튼 + `[↻ 다시]` + `[✕ 취소]`). 그 **뒤에** 안내 문구와 `[⚡ 고급 모델로 다시 시도]` 를 덧붙인다. 순서가 중요하다 — 안내 문구는 "(위 입력칸)"이라고 말하므로 입력칸이 문구보다 **위에** 렌더되어야 문구가 참이 된다.
- **REQ-AI10-030** (Unwanted) **[MODIFY]**: **IF** 구현이 `retry-exhausted` 분기에 `appendDismissButton`(`:245-249`)을 추가하려 시도하면, **then** the system **shall** 이를 거부한다. REQ-AI10-029 가 포함시키는 `renderDoneControls` 가 이미 `[✕ 취소]`(`:292-295`)를 제공하므로 닫기 수단은 충족되며, 둘을 함께 두면 **중복 종료 컨트롤**이 된다 — 같은 파일이 streaming 분기에 대해 명시한 규칙과 동일한 근거다(`:243`). 결과적으로 `retry-exhausted` 카드의 종료 성격 컨트롤은 **정확히 1개**여야 한다.
- **REQ-AI10-031** (Ubiquitous) **[MODIFY]**: The system **shall** `retry-exhausted` 상태에서 다음 탈출 경로를 **전부** 동작하게 한다: (a) 방향 지시 입력 후 `[↻]`/Enter → `directed` 로 분류되어 카운터가 0 으로 리셋되고 요청이 **정상 발행**된다, (b) `[⚡ 고급 모델로 다시 시도]` → `exempt` 로 분류되어 카운터를 건드리지 않고 `model: 'sonnet'` 1회성 요청이 발행된다(기존 계약 `:425` 보존), (c) `[✓ 바꾸기]`/`[⤵ 아래에 삽입]` 적용과 `[✕ 취소]` 닫기가 done 카드와 동일하게 동작한다. 어느 하나라도 막히면 소진 카드가 막다른 상태가 된다.
- **REQ-AI10-032** (Unwanted) **[MODIFY]**: **IF** `[⚡ 고급 모델로 다시 시도]` 로 발행된 재요청이 자기 자신을 카운트해 **즉시 재소진**을 일으키면, **then** the system **shall** 이를 거부한다. 이 버튼은 `retry-exhausted` 상태에서만 눌리므로 카운트되는 순간 `retryCount >= MAX_RETRY` 가 다시 참이 되어 REQ-AI10-028 의 미발행 게이트에 걸리고, 사용자는 **누를 수는 있지만 아무 일도 일어나지 않는 버튼**을 보게 된다. 이 경로는 `exempt` 여야 한다(REQ-AI10-026 #1).
- **REQ-AI10-033** (Unwanted) **[REGRESSION_GUARD]**: **IF** 모듈 4의 구현이 다음 셋 중 하나라도 바꾸려 시도하면, **then** the system **shall** 이를 거부한다. (a) `MAX_RETRY`(`:75`)의 **값 `3` 과 이름** — 임계 조정은 본 SPEC 범위 밖이다. (b) `reduceCard` 의 기존 `'retry'` 전이 의미(`:97-100`) — 상한 미만이면 `streaming` + `retryCount + 1`, 상한 이상이면 `retry-exhausted`. 리셋은 **신설 이벤트**로 표현하며 이 케이스에 얹지 않는다(REQ-AI10-025). (c) 이미 출시된 M1 의 `enterReRequest()`(`:1177-1182`) 동작 — 버퍼 리셋 → 대기 안내 재무장 → 백스톱 재무장 → `commit({type:'stream'})` 네 줄의 내용과 순서. 모듈 4가 추가하는 것은 그 **호출 여부를 결정하는 게이트**이지 메서드 자체가 아니다.

## 검증 계층 (자동 테스트 vs 코드 리뷰)

> 어떤 요구가 **무엇에 의해 강제되는지**를 명시한다. 자동 테스트가 증명할 수 없는 것을 테스트가 증명하는 척하면, CI green 상태로 요구를 위반할 수 있다.

| 검증 계층 | 담당 REQ | 수단 |
|-----------|----------|------|
| Vitest 단위·통합 테스트 | 001~004, 006, 007(순서 불변식), 008, 009~014, 016~021, 024~029, 031, 032 | 관측 가능한 DOM·반환값·타이머·스파이 단언 |
| Rust 단위 테스트 | (없음) | 백엔드 무변경 |
| **코드 리뷰(diff)** | 005(신규 진행 UI 부재), 015(파일 전환 정리 무변경), 022(무손상 구조 무변경), 007(상수의 배치·문서화), 023(분류 인자가 명시 전달이며 문자열 추론이 아님), 030(`appendDismissButton` 미추가), 033(`MAX_RETRY`·`'retry'` 전이·`enterReRequest` 무변경) | PR diff 검토 — 파일 무변경·구조 보존은 `git diff` 속성이지 vitest 가 판정할 수 있는 속성이 아니다 |
| 수동 실기기 검증 | 001~004(체감 지연), 009(실제 정체 시나리오), 018~019(실문서 삽입 위치), 028~031(4번째 ↻ 의 실제 감각) | 로컬 앱 실행 |

REQ-AI10-005·015·022·023·030·033 은 "코드 리뷰" 행에 배정된다. 이들에 대해 "테스트가 통과했으므로 지켜졌다"고 주장하지 않는다 — AC 본문에도 이 구분을 명시한다. 다만 030 과 033 은 **관측 가능한 부분**(종료 컨트롤 개수, `MAX_RETRY` 값의 실효 경계)이 있어 테스트도 함께 덮는다 — 테스트가 덮지 못하는 것은 "추가되지 않았음"과 "이름이 그대로임"이다.

## Design Notes / Future Considerations

> 아래는 요구사항이 아니며(AC 없음), Run phase의 설계 참고 사항이다.

- **재요청 진입을 단일 지점에 두는 이유(REQ-AI10-003 구현 힌트)**: 다섯 진입점은 전부 `callbacks.onReRequest(instruction, model)` 로 수렴하고, 그 구현은 `startSuggestionCard` 안의 단 하나(`:1188-1193`)다. 따라서 "phase 전이 + 버퍼 리셋 + 대기 타이머 재무장"을 컨트롤러의 **단일 메서드**(예: `enterReRequest()`)로 묶고 그 배선에서 1회 호출하는 것이 가장 작은 변경이다. 렌더 쪽 다섯 버튼 핸들러를 각각 손대는 접근은 다섯 배 중복이며 여섯 번째 진입점이 생기면 다시 누락된다. 참고로 `enterListFallback()`(`:997-1000`)이 이미 "플래그 갱신 + `commit({type:'stream'})`" 형태의 선례를 제공한다.
- **`commit({type:'stream'})` 만으로 부족한 이유(REQ-AI10-002 근거)**: `reduceCard` 의 `'stream'` 케이스(`:83-84`)는 `{...state, phase: 'streaming'}` 만 반환하고 버퍼는 상태 머신 밖(`private streamBuffer`, `:838`)에 있다. 따라서 상태 머신을 손대지 않고 컨트롤러 필드를 함께 리셋해야 한다 — `reduceCard` 에 버퍼를 끌어들이는 것은 순수 상태 머신의 책임 범위를 넓히는 과잉 설계다.
- **중복 커밋 위험(REQ-AI10-006 구현 힌트)**: `handleTableComplete`·`handleDiagramComplete` 는 `commit({type:'stream'})` **직후** `callbacks.onReRequest(...)` 를 호출한다(`:941-942`, `:957-958`). 공통 배선에 전이를 추가하면 이 경로에서는 `stream` 이 두 번 커밋된다. `reduceCard` 의 `'stream'` 은 멱등(`phase` 를 `'streaming'` 으로 덮어쓸 뿐)이므로 **상태 자체는 안전**하지만, 버퍼 리셋과 타이머 재무장이 두 번 일어나고 `notifyActiveCard()` 가 두 번 발화한다. 관측 가능한 회귀는 없어야 하지만 REQ-AI10-006 이 이를 계약으로 고정한다. 중복이 실제로 문제를 일으키면 내부 경로에서 선행 `commit` 을 제거하는 편이 배선에서 조건 분기를 두는 것보다 낫다(단일 책임).
- **프론트 백스톱 값의 유예 폭(REQ-AI10-007 구현 힌트)**: 백엔드 워치독은 `sleep(60s)` 이후 `claim_terminal` → 프로세스 kill → `emit` 순으로 진행되므로, 프론트가 `ai://error{kind:"timeout"}` 을 받는 시점은 60초보다 약간 뒤다. 유예 폭은 이 전달 지연과 이벤트 큐 여유를 덮을 만큼이면 충분하며, 크게 잡을수록 "진짜로 죽었을 때 사용자가 기다리는 시간"이 늘어난다. 구체적 값은 Run phase 재량이되 **파생 상수 하나**로 표현하고 그 근거를 주석에 남긴다. 백엔드 값을 미러링하는 프론트 상수에는 `src-tauri/src/ai/mod.rs:32` 를 가리키는 주석을 반드시 붙인다 — 두 값이 갈라지는 것은 REQ-AI10-008 순서 불변식 테스트가 잡지 못하는 유일한 케이스(백엔드만 바뀌는 경우)이므로 사람이 읽을 단서가 필요하다.
- **백스톱 오류 문구(REQ-AI10-009 구현 힌트)**: 기존 `error` phase 렌더(`:347-373`)는 `errorKind` 가 `login`/`network` 가 아니면 "잠시 문제가 있었어요" 계열 문구 + [다시 시도] + [닫기] 를 낸다. 백스톱은 이 기타 분기에 그대로 얹으면 REQ-AI10-011 이 자동으로 충족된다. 다만 사용자가 원인을 짐작할 수 있도록 "응답이 오지 않아 중단했어요" 정도의 **분류된** 문구를 `errorMessage` 로 전달하는 것이 낫다 — 신규 `errorKind` 를 만들 필요는 없다(REQ-AI10-009).
- **이벤트 라우팅 접근 선택(REQ-AI10-012 — 결정 기록은 plan.md)**: 카드마다 `useAiStore.subscribe` 를 갖게 하는 것만으로는 **충분하지 않다**. `aiStore.requestId` 가 단일 슬롯이므로 카드 B의 이벤트는 `useAiRelay.isCurrent`(`useAiRelay.ts:36-38`)에서 **스토어에 닿기도 전에** 폐기된다. 따라서 수정은 릴레이 계층에서 시작해야 한다. 선택지와 기각 사유는 plan.md "결정 기록 — 결함 2b 구독 방식"에 전개한다. 여기서는 제약만 남긴다: `aiStore` 의 단일 슬롯 의미론(`streamBuffer` 를 최종 `result` 로 확정하는 권위 값 계약, SPEC-AI-009 Design Notes)은 고스트 텍스트 경로가 의존하므로 **가벼이 다시 설계하지 않는다**.
- **블록 경계 함수의 시그니처(REQ-AI10-016 구현 힌트)**: `expandToSentenceBoundary(doc, from, to)` 가 이미 `(문서 문자열, 오프셋)` 형태를 쓰므로 새 함수도 같은 관례를 따르는 것이 자연스럽다(예: `findBlockEnd(doc: string, from: number): number`). 반환값은 **개행 문자 앞** 오프셋이어야 한다 — 개행을 포함하면 insert-below 가 `\n\n` 을 덧붙일 때 빈 줄이 하나 더 생긴다. 기존 두 소비 지점(`:501-502`, `:553-554`)이 모두 "개행 앞" 의미의 `paraEnd` 를 쓰고 있으므로 동일 의미를 유지하면 호출부 변경이 한 줄로 끝난다.
- **코드 펜스 내부 선택의 한계(REQ-AI10-017 알려진 한계)**: 선택이 펜스 코드 블록 **내부**에 있으면 스캔은 닫는 펜스 줄(` ``` `)을 블록 시작으로 판정해 멈추고, 삽입 지점이 코드 본문과 닫는 펜스 **사이**가 된다. v1에서는 이를 허용한다 — AI 인라인 편집·표 생성·다이어그램 생성의 대상은 산문·표·목록이며 코드 블록 내부 텍스트를 선택해 "아래에 삽입"하는 것은 설계된 사용 흐름이 아니다. 펜스 상태 추적(열림/닫힘 토글)을 도입하면 함수가 순수 줄 단위 판정에서 상태 기계로 승격되므로, 실제 사용자 보고가 나온 뒤에 별도 REQ로 다룬다.
- **`PARAGRAPH_SEP` 상수의 잔존(REQ-AI10-018 구현 힌트)**: `PARAGRAPH_SEP = '\n\n'`(`:478`)은 **삽입 내용의 구분자**로도 쓰인다(`:555` `` `${PARAGRAPH_SEP}${ctx.suggestion}` ``). 경계 **탐색**에서만 제거하고 삽입 구분자 용도로는 그대로 둔다 — 상수 자체를 지우려 하면 삽입 형태가 바뀌어 기존 테스트가 깨진다.
- **결함 3의 두 절반 중 우선순위**: insert-below(`:553-554`)는 **비파괴적**이고(원문을 그대로 두고 잘못된 위치에 추가할 뿐) `expandToSentenceBoundary`(`:501-502`)는 **파괴적 replace 범위**를 넓힌다. 사용자가 보고한 증상은 전자지만 위험도는 후자가 높다. 두 지점이 같은 함수를 공유하므로 한 번에 닫히지만, 테스트 작성 순서는 후자를 먼저 두는 것이 결함의 실제 무게에 맞다.
- **분류 인자를 선택적으로 두는 이유(REQ-AI10-023 구현 힌트)**: `CardCallbacks.onReRequest`(`:199`)는 `aiSuggestionCardRerequest.test.ts`·`aiSuggestionCardRender.test.ts`·`aiSuggestionCard.test.ts`·`aiIntegration.test.tsx`·`tableValidate.test.ts` 등 다수의 테스트에서 2인자로 호출·mock 된다. 그 파일들은 M0.2 의 **무수정 통과** 대상이므로 인자를 필수로 만들면 계약이 즉시 깨진다. 기본값을 `exempt` 로 두면 기존 호출부는 "세지도 리셋하지도 않는" 현행 동작을 그대로 유지한다 — 이것이 모듈 4의 **하중을 지는 호환성 결정**이다. 다만 기본값에 기대어 프로덕션 호출부가 종류를 생략해서는 안 된다: 8개 호출부(`:279`·`:290`·`:372`·`:391`·`:425`·`:1090`·`:1106`, 그리고 `renderDoneControls` 의 Enter 핸들러)는 전부 **명시 전달**해야 하며 이는 코드 리뷰가 확인한다.
- **`blind` 와 `directed` 를 구별하는 지점(REQ-AI10-023/024 구현 힌트)**: `renderDoneControls` 의 `fireDirected`(`:278-279`)는 `input$.value` 를 갖고 있다. 종류 판정은 **그 자리에서** `input$.value.trim() === '' ? 'blind' : 'directed'` 로 끝난다 — 호출부가 자기 입력 요소를 보는 것이지 지시 문자열을 사후 해석하는 것이 아니다. `buildRetryInstruction()`(`:118-121`)은 빈 입력에 기본 문구를 채워 주므로 **그 반환값으로는 두 종류를 구별할 수 없다**(사용자가 우연히 같은 문구를 입력하면 오분류된다). 이것이 REQ-AI10-023 이 추론을 금지하는 구체적 이유다.
- **게이트를 배선에 두는 이유(REQ-AI10-028 구현 힌트)**: 소진 판정은 "요청을 발행할 것인가"를 결정하므로 **발행 지점**인 `onReRequest` 배선(`:1362-1372`)에 있어야 한다. `enterReRequest()` 안에 넣으면 이미 `fireReRequest` 를 호출하기로 결정한 뒤라 늦고, 렌더 핸들러 다섯 곳에 흩뿌리면 M1 이 해소한 중복이 되살아난다. 배선의 형태는 대략 "종류에 따라 카운터 이벤트를 커밋 → 그 결과 phase 가 `retry-exhausted` 면 여기서 return, 아니면 `enterReRequest()` + `fireReRequest`"이며, 이렇게 두면 소진 판정이 **기존 `reduceCard` 의 상한 판정 하나**만 참조해 이중화가 생기지 않는다.
- **리셋 이벤트의 이름(REQ-AI10-025 구현 힌트)**: `CardEvent` 유니온(`:61-72`)에 추가되는 값이며 `reduceCard` 의 기존 케이스를 건드리지 않는다. `phase` 를 바꾸지 않고 `retryCount` 만 0 으로 되돌리는 것이 최소 형태다 — `directed` 재요청은 그 직후 `enterReRequest()` 가 `stream` 을 커밋하므로 phase 전이를 이 이벤트가 겸할 이유가 없다(두 이벤트가 각각 한 가지만 한다).
- **증강 렌더의 구현 형태(REQ-AI10-029 구현 힌트)**: 현행 `retry-exhausted` 분기(`:418-430`)를 **삭제하고** `done` 렌더 경로(`:446-475`)에 합류시키는 편이, done 렌더를 그 분기 안에 복제하는 것보다 낫다 — 복제하면 done 카드의 향후 변경이 소진 카드에 반영되지 않고 서서히 갈라진다. 구체적으로는 `state.phase === 'retry-exhausted'` 를 done 과 같은 낙하 경로로 흘려보내고, `renderDoneControls` 뒤에 안내 문구 + 고급 버튼을 조건부로 덧붙이는 형태가 된다. 이때 `diagram-valid` 분기(`:460-472`)의 조기 반환이 영향을 받지 않도록 주의한다.

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [MODIFY] | `src/components/editor/extensions/ai-suggestion-card.ts` | **모듈 1** — 컨트롤러에 재요청 진입 메서드 신설(phase → `streaming` 전이 + `streamBuffer` 리셋 + 대기 타이머 재무장, REQ-AI10-001/002/004)하고 `onReRequest` 배선(`:1188-1193`)에서 1회 호출(REQ-AI10-003). **모듈 2** — 백스톱 타이머 필드·무장·재무장·해제를 `waitNoticeTimer`(`:847`, `:858-878`) 규율 그대로 추가(REQ-AI10-010), 만료 시 `error` phase 전이(REQ-AI10-009/013), `destroy()`(`:881-883`)가 두 타이머를 모두 해제, `clearCardRegistry`(`:806-812`)가 각 컨트롤러 `destroy()` 호출 후 Map 비움(REQ-AI10-014), 카드별 이벤트 바인딩 독립화(`activeCardUnsub` 단일 슬롯 `:1084`·`:1153` 해소, REQ-AI10-012). **모듈 3** — 블록 경계 순수 함수 신설·export(REQ-AI10-016/017), insert-below 분기(`:551-556`)와 `expandToSentenceBoundary`(`:501-502`)가 이를 호출(REQ-AI10-018/019/020/021). `applySuggestion` 의 원문 재검증·단일 트랜잭션·`replace` 분기는 무변경(REQ-AI10-022). |
| [MODIFY] | `src/lib/ai/waitNotice.ts` | **모듈 2** — 백엔드 하드 워치독 미러 상수 + 그로부터 파생된 프론트 백스톱 상수 추가, 세 계층(8초 소프트 → 60초 백엔드 하드 → 프론트 백스톱)의 관계를 파일 상단 주석에 문서화(REQ-AI10-007). 기존 `WAIT_NOTICE_DELAY_MS = 8000`·`WAIT_NOTICE_TEXT`(`:7`·`:10`)는 **무변경**. 백엔드 미러 상수에는 `src-tauri/src/ai/mod.rs:32` 를 가리키는 주석을 붙인다. |
| [MODIFY] | `src/hooks/useAiRelay.ts` | **모듈 2(2b)** — `isCurrent`(`:36-38`) 단일 슬롯 게이트가 카드 이벤트까지 폐기하지 않도록 릴레이 경로 조정(REQ-AI10-012). 구체적 형태는 plan.md 결정 기록 참조. `AiChunkEvent`/`AiDoneEvent`/`AiErrorEvent` payload 타입(`:11-30`)과 등록·해제 생명주기(`:46-85`)는 무변경. |
| [NEW] | `src/lib/ai/` 이벤트 라우팅 모듈(후보) | **모듈 2(2b)** — requestId 별 이벤트 구독·발송을 담당하는 소규모 모듈. 도입 여부·이름은 plan.md 결정 기록에서 확정한다. 신규 IPC·신규 이벤트 타입을 만들지 않으며 기존 3종 payload 를 그대로 중계한다. |
| [MODIFY] | `src/components/editor/extensions/ai-suggestion-card.ts` | **모듈 4** — `CardEvent` 유니온(`:61-72`)에 카운터 리셋 이벤트 신설(REQ-AI10-025), `CardCallbacks.onReRequest`(`:199`)에 **선택적** 재요청 종류 인자 추가(기본값 `exempt`, REQ-AI10-023/033)하고 8개 호출부(`:279`·`:290`·`:372`·`:391`·`:425`·`:1090`·`:1106` + `renderDoneControls` Enter 핸들러)가 명시 전달, `onReRequest` 배선(`:1362-1372`)에 카운터 커밋 + 소진 게이트 추가(REQ-AI10-024/026/027/028), `retry-exhausted` 렌더 분기(`:418-430`)를 done 렌더 합류형 증강 렌더로 교체(REQ-AI10-029/030/031). `MAX_RETRY`(`:75`)·`reduceCard` 의 `'retry'` 케이스(`:97-100`)·`enterReRequest()`(`:1177-1182`)는 **무변경**(REQ-AI10-033). |
| [NEW] | `src/test/aiCardRetryLimit.test.ts` | AC-AI10-013~019 — blind 3회 발행 + 4번째 미발행, 증강 카드 구성과 종료 컨트롤 1개, directed 리셋, 고급 모델 폴백의 면제, error/intruded 재시도 면제, 내부 자동 재요청 면제, 분류 인자 기본값 계약. |
| [NEW] | `src/test/aiCardRerequestProgress.test.ts` | AC-AI10-001·002·003 — 5개 진입점 각각의 재요청이 첫 청크 이전에 `streaming` 렌더 + 빈 버퍼(스켈레톤 관측)로 복귀, 재요청 후 8초 경과 시 대기 안내 재출현, 내부 개시 경로 회귀 없음. |
| [NEW] | `src/test/aiCardWatchdog.test.ts` | AC-AI10-004·005·006 — 세 임계 순서 불변식, fake timers 로 백스톱 만료 → 복구 가능한 `error` 카드(재시도 + 닫기), 타이머 무장·재무장·해제 생명주기와 누수 부재. |
| [NEW] | `src/test/aiCardCoexistence.test.ts` | AC-AI10-007·008 — 카드 A 재요청이 카드 B 스트림을 굶기지 않음(B가 `ai://done` 까지 도달), 백스톱 발동의 국소성, `clearCardRegistry` 가 모든 컨트롤러 타이머를 파괴. |
| [NEW] | `src/test/aiBlockBoundary.test.ts` | AC-AI10-010·011 — 블록 경계 순수 함수의 규칙 전수(7종 블록 시작 + 빈 줄 + setext 예외 + EOF + 산문 연속), `expandToSentenceBoundary` 가 종결 부호 부재 시 EOF 까지 가지 않음. |
| [MODIFY] | `src/test/aiSuggestionApply.test.ts` | AC-AI10-010 — insert-below 의 결함 조건(빈 줄 없음, EOF 아님) 케이스 신규 추가(제목 + 단일 개행 목록 / 표 영역 / 여러 줄 산문 문단). **기존 2개 테스트(`:124-168` — `\n\n` 존재 케이스, EOF 케이스)는 무수정 통과해야 한다**(REQ-AI10-021, 회귀 가드). |
| [EXISTING] | `src/test/aiSuggestionCardRerequest.test.ts` | 무수정 통과 — BUG-1/2/3(a)/5/6 재요청 결함 체인과 `fireReRequest` providerId 오버라이드(SPEC-AI-009) 계약이 모듈 1·2 변경에도 유지됨(REQ-AI10-006). |
| [EXISTING] | `src/test/aiWaitNotice.test.ts` | 무수정 통과 — 8초 지연·가짜 진행 요소 부재·첫 청크 도착 시 해제(SPEC-AI-006) 계약이 REQ-AI10-007 상수 추가 후에도 유지됨. |
| [EXISTING] | `src/test/aiFileSwitchEffects.test.ts` | 무수정 통과 — SPEC-AI-009 REQ-AI9-033/034/035 파일 전환 정리 3동작이 REQ-AI10-014 `destroy()` 추가 후에도 동일(REQ-AI10-015). |
| [EXISTING] | `src/test/aiSuggestionCard.test.ts` / `aiSuggestionCardRender.test.ts` / `aiSuggestionCardWidget.test.ts` / `aiRelay.test.ts` / `aiStore.test.ts` / `aiOffEffects.test.ts` | 무수정 통과 — 카드 상태 머신·렌더 분기·위젯 key·릴레이 계약·스토어 리듀서의 기존 단언이 전부 보존된다. |
| [EXISTING] | `src/test/aiSuggestionCard.test.ts` / `aiIntegration.test.tsx` / `tableValidate.test.ts` / `aiSuggestionCardWidget.test.ts` | 무수정 통과 — 이 4개 파일이 `onReRequest` 를 **2인자로** 호출하거나 `vi.fn()` 으로 mock 한다(`aiSuggestionCard.test.ts:333-345`·`:370-371`, `tableValidate.test.ts:105-151`, `aiIntegration.test.tsx:153`, `aiSuggestionCardWidget.test.ts:21`). REQ-AI10-023 의 종류 인자가 **선택적**이어야 하는 직접적 이유다. `aiSuggestionCard.test.ts:54-66` 의 `{type:'retry'}` 리듀서 단언 2건도 REQ-AI10-033 (b) 로 보호된다. |
| [NOT MODIFIED] | `src-tauri/` 전체 | **의도적 미변경** — `WATCHDOG_TIMEOUT_SECS = 60`(`mod.rs:32`)·워치독 스레드(`:282-283`)·릴레이·파서·프롬프트 조립 전부 무변경. 프론트 백스톱은 백엔드를 **대체하지 않고 뒤에서 받는다**(REQ-AI10-008). |
| [NOT MODIFIED] | `src/store/aiStore.ts` | **의도적 미변경(기본 방침)** — 단일 in-flight 슬롯(`:23-30`)과 `reduceCompleteRequest` 의 권위 값 계약(`:65-71`)을 유지한다. 다중 요청 스토어로의 재설계는 Exclusions 로 금지되며, 불가피하다고 판단되면 SPEC 개정으로만 반영한다. |
| [NOT MODIFIED] | `src/lib/ai/aiFileSwitchEffects.ts` / `src/lib/ai/aiOffEffects.ts` / `src/components/layout/AppLayout.tsx` | **의도적 미변경** — SPEC-AI-009 REQ-AI9-033/034/035 구현(커밋 `37059a7`)을 재구현하지 않는다(REQ-AI10-015). 본 행은 "변경 없음"을 명시적 계약으로 고정하기 위한 항목이다. |

> 핵심 불변: 문서 텍스트는 사용자의 명시적 [바꾸기]/[아래에 삽입] 확정에 의해서만, 원문 재검증을 통과한 뒤, 단일 트랜잭션으로만 바뀐다(SPEC-AI-001 REQ-AI-022/033/035). 본 SPEC의 네 모듈 중 어느 것도 이 계약을 건드리지 않는다 — 모듈 3은 **위치 계산**만, 모듈 1·2는 **표시와 종결**만, 모듈 4는 **재요청 발행 여부와 소진 카드의 구성**만 다룬다.

## Acceptance Criteria

> 전부 Vitest + Testing Library 단위·통합 테스트로 검증하며, 자동 테스트가 판정할 수 없는 항목은 "검증 계층" 표의 **코드 리뷰(diff)** 행에 배정된다. 각 AC의 Given-When-Then 상세는 sibling `acceptance.md`(AC-AI10-001~019)에 전개되어 있다. 개발 모드는 TDD 이므로 각 AC는 **실패하는 테스트를 먼저** 쓸 수 있도록 관측 가능한 단언으로 기술한다.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-AI10-001 *(회귀)* | REQ-AI10-001, 002, 003 | **5개 진입점 전수** — `↻`/`↻ 다시`/`⚡ 고급 모델로 다시 시도`/`다시 시도`(error)/`다시 요청`(intruded) 각각을 클릭하면, **어떤 `ai://chunk` 도 도착하지 않은 상태에서** 카드가 `streaming` 렌더로 복귀하고 3줄 shimmer 스켈레톤이 관측되며 직전 제안 본문이 DOM 에 남아 있지 않다. **현행 구현에서 반드시 실패한다**(카드가 `done` phase 를 유지) |
| AC-AI10-002 | REQ-AI10-004 | 재요청 발행 후 `vi.advanceTimersByTime(WAIT_NOTICE_DELAY_MS)` 로 8초를 경과시키면 대기 안내 문구(`WAIT_NOTICE_TEXT`)가 카드에 렌더된다. 재요청 이전 요청에서 이미 안내가 떠 있었더라도 재요청 시점에 사라졌다가 다시 8초 뒤에 나타난다(재무장이 관측됨) |
| AC-AI10-003 | REQ-AI10-005, 006 | 재요청 후 렌더에 진행률 요소(`progress`·`role="progressbar"`·퍼센트 텍스트·ETA)가 **존재하지 않는다**. 다이어그램 자동 재시도·표 검증 재요청·목록 폴백 3경로의 관측 가능한 궤적(재시도 상한 카운터 소진 시점, 목록 폴백 이후 mermaid 검증 미진입)이 개정 전과 동일하다. 신규 phase·신규 위젯 부재는 **코드 리뷰(diff)** 로 확인 |
| AC-AI10-004 | REQ-AI10-007, 008 | 세 임계 상수가 **한 모듈에서 export** 되고 `WAIT_NOTICE_DELAY_MS < 백엔드 미러 값 < 프론트 백스톱` 순서를 만족한다. 백엔드 미러 값이 `src-tauri/src/ai/mod.rs` 의 `WATCHDOG_TIMEOUT_SECS = 60` 과 일치한다(60_000ms). 프론트 백스톱이 미러 값에서 파생되었음(독립 리터럴이 아님)은 **코드 리뷰(diff)** 로 확인 |
| AC-AI10-005 *(회귀)* | REQ-AI10-009, 011 | fake timers 로 카드를 `streaming` 진입시킨 뒤 **어떤 종결 이벤트도 주지 않고** 프론트 백스톱 임계를 경과시키면, 카드가 `error` phase 로 전이하고 (a) 분류된 한국어 문구가 렌더되며 raw JSON·스택·`undefined` 가 노출되지 않고, (b) 재시도 컨트롤과 `닫기` 컨트롤이 **둘 다** 존재한다. **현행 구현에서 반드시 실패한다**(카드가 `streaming` 에 영구 고착) |
| AC-AI10-006 | REQ-AI10-010 | 백스톱 타이머가 컨트롤러 생성 시 무장되고, 재요청마다 재무장되며, 종결·소멸 7경로(`done`/`error`/취소/`intrude`/`stale`/`cancel-by-new`/적용·닫기) 각각에서 해제된다. 각 경로 뒤 임계를 경과시켜도 추가 상태 전이·재렌더가 발생하지 않는다(누수 부재) |
| AC-AI10-007 *(회귀)* | REQ-AI10-012, 013 | 카드 A(`done`, 검토 대기) + 카드 B(`streaming`) 공존 상태에서 카드 A에 재요청을 발행한 뒤 **카드 B의 requestId 로** `ai://chunk` → `ai://done` 을 발생시키면, 카드 B가 청크를 수신해 `done` phase 로 정상 종결한다. 카드 A의 백스톱이 발동해도 카드 B의 상태·in-flight 는 영향을 받지 않는다. **현행 구현에서 반드시 실패한다**(B의 이벤트가 `isCurrent` 에서 폐기됨) |
| AC-AI10-008 | REQ-AI10-014 | 대기 타이머·백스톱 타이머가 무장된 컨트롤러 2개 이상이 등록된 상태에서 `clearCardRegistry()` 를 호출하면 레지스트리가 비고, 이후 두 임계를 모두 경과시켜도 어떤 타이머 콜백도 발화하지 않는다(`notifyActiveCard` 스파이 미호출) |
| AC-AI10-009 | REQ-AI10-015 | `src/test/aiFileSwitchEffects.test.ts` 가 **무수정 전수 통과**한다 — 파일 전환 시 취소·고스트 정리·레지스트리 비움 3동작, 동일 경로 재설정 미발동, 구독 해제 후 미발동, 문서 텍스트 무변경이 REQ-AI10-014 의 `destroy()` 추가 후에도 동일하다. 정리 모듈 3종의 무변경은 **코드 리뷰(diff)** 로 확인 |
| AC-AI10-010 *(회귀)* | REQ-AI10-016, 017, 018, 020, 021 | **insert-below 4케이스** — (a) 제목 + 단일 개행 목록: 삽입이 제목 줄 **바로 다음**, (b) 표 영역: 삽입이 현재 표 행 바로 다음이며 문서 끝이 아님, (c) 여러 줄 산문 문단: 삽입이 **문단 전체 뒤**이고 문장 사이가 아님, (d) 빈 줄 없이 EOF: 문서 끝 삽입(현행 유지). 경계 함수 자체는 7종 블록 시작·빈 줄·setext 밑줄 예외·들여쓰기 0~3칸을 전수 검증한다. **(a)(b)(c)는 현행 구현에서 반드시 실패한다**(전부 문서 끝으로 감) |
| AC-AI10-011 *(회귀)* | REQ-AI10-016, 019 | `expandToSentenceBoundary(doc, from, to)` 가 종결 부호(`.!?。`)를 하나도 만나지 못한 채 블록 끝에 닿으면 확장 `to` 가 **블록 끝**이며 `doc.length` 가 아니다. 종결 부호가 존재하는 기존 케이스의 반환값은 개정 전과 동일하다. **전자는 현행 구현에서 반드시 실패한다** |
| AC-AI10-012 | REQ-AI10-022 | `applySuggestion` 의 무손상 계약 보존 — 원문 불일치 시 `{applied:false, reason:'stale'}` + 문서 무변경, 적용은 단일 트랜잭션(`undo` 1회로 완전 복원), `replace` 모드 동작 무변경. 기존 테스트 `aiSuggestionApply.test.ts`·`aiSuggestionCardRerequest.test.ts`·`aiWaitNotice.test.ts`·`aiFileSwitchEffects.test.ts` 가 **무수정 전수 통과**. 트랜잭션 구조 자체의 무변경은 **코드 리뷰(diff)** 로 확인 |
| AC-AI10-013 *(회귀)* | REQ-AI10-024, 028 | **blind 3회 발행 + 4번째 미발행** — done 카드에서 `[↻ 다시]` 를 3회 누르면 `aiRequest` mock 이 정확히 3회 호출되고 `retryCount` 가 3 이 된다. **4번째** 클릭에서는 `aiRequest` 가 추가 호출되지 **않고**(총 3회 유지) 카드 phase 가 `retry-exhausted` 로 전이하며 `state.suggestion` 이 보존된다. **현행 구현에서 반드시 실패한다**(프로덕션이 `{type:'retry'}` 를 커밋하지 않아 `retryCount` 가 0 에 머물고 4번째도 그냥 발행된다) |
| AC-AI10-014 *(회귀)* | REQ-AI10-029, 030 | **증강 카드 구성** — `retry-exhausted` 카드에 제안 본문(`.mdedit-ai-suggestion`)·방향 지시 입력칸(`.mdedit-ai-direct-input`)·적용 버튼(`.mdedit-ai-apply`)·`[✕ 취소]`(`.mdedit-ai-cancel`)가 **전부 존재**하고, 추가로 안내 문구와 `.mdedit-ai-advanced` 가 존재한다. 종료 성격 컨트롤은 **정확히 1개** — `.mdedit-ai-dismiss` 가 **존재하지 않는다**. DOM 순서상 입력칸이 안내 문구보다 **앞**이다("위 입력칸" 문구가 참). **현행 구현에서 반드시 실패한다**(현행 분기는 문구 + 고급 버튼 2개만 렌더) |
| AC-AI10-015 | REQ-AI10-025, 031 | **directed 리셋** — blind 2회 후 방향 지시 입력칸에 `'더 짧게'` 를 넣고 `[↻]` 를 누르면 요청이 정상 발행되고 `retryCount` 가 **0** 이 된다. 이어서 blind 를 다시 **3회** 눌러도 전부 발행되며 4번째에 비로소 `retry-exhausted` 가 된다(연속이 실제로 끊겼음) |
| AC-AI10-016 | REQ-AI10-026, 031, 032 | **고급 모델 폴백의 면제** — `retry-exhausted` 상태에서 `.mdedit-ai-advanced` 를 클릭하면 요청이 `model: 'sonnet'` 으로 **발행되고**, `retryCount` 가 클릭 전후로 **불변**이며, 카드가 `streaming` 으로 복귀한다(즉시 재소진 부재). |
| AC-AI10-017 | REQ-AI10-026, 027 | **error/intruded 재시도 면제** — `error`(kind 기타) 카드의 `[다시 시도]` 와 `intruded` 카드의 `[다시 요청]` 을 각각 상한을 넘길 만큼(4회 이상) 반복해도 `retryCount` 가 0 을 유지하고 어떤 카드도 `retry-exhausted` 에 도달하지 않으며 매 클릭마다 요청이 발행된다(`done` 전용 도달성 불변식) |
| AC-AI10-018 | REQ-AI10-026, 027 | **내부 자동 재요청 면제** — 표 검증 실패 자동 재요청·다이어그램 오류 동봉 자동 재시도·목록 폴백 재요청 각각의 뒤에서 `retryCount` 가 **0 그대로**이고, 이들이 반복돼도 `retry-exhausted` 에 도달하지 않는다. `tableValidate.test.ts` 의 재요청 횟수 단언이 **무수정 통과**한다 |
| AC-AI10-019 | REQ-AI10-023, 033 | **분류 계약과 회귀 가드** — `onReRequest` 를 **종류 인자 없이** 2인자로 호출하면 카운터가 증가하지도 리셋되지도 않는다(기본값 `exempt`). 세 분류값 `blind`·`directed`·`exempt` 가 전부 AC-AI10-013~018 중 최소 1건에서 실제로 소비된다. `MAX_RETRY` 의 실효 경계가 3(4번째에 소진)이고 `reduceCard({type:'retry'})` 의 기존 전이 의미가 그대로다 — `aiSuggestionCard.test.ts:54-66` 이 무수정 통과. 이름·상수 무변경과 `appendDismissButton` 미추가는 **코드 리뷰(diff)** 로 확인 |

REQ 커버리지 대조(001–033 전수): 001→AC1, 002→AC1, 003→AC1, 004→AC2, 005→AC3, 006→AC3, 007→AC4, 008→AC4, 009→AC5, 010→AC6, 011→AC5, 012→AC7, 013→AC7, 014→AC8, 015→AC9, 016→AC10·AC11, 017→AC10, 018→AC10, 019→AC11, 020→AC10, 021→AC10, 022→AC12, 023→AC19, 024→AC13, 025→AC15, 026→AC16·AC17·AC18, 027→AC17·AC18, 028→AC13, 029→AC14, 030→AC14, 031→AC15·AC16, 032→AC16, 033→AC19. 총 REQ 33건, 총 AC 19건. 미커버 REQ 없음, 고아 AC 없음.

**Quality Gates (AC 외 공통 게이트)**: `npm run typecheck` 클린 + `npm run lint` 클린 + `npm test`(Vitest) 전수 통과 + `npm run test:e2e` 1회 실행(카드 렌더 변경의 영향 확인) + `cargo test`·`cargo clippy` 기준선 그대로 통과(백엔드 무변경) + `cargo build --release` 성공. TDD 순서 준수 — AC-AI10-001·005·007·010·011·013·014 의 회귀 단언이 구현 **이전에** RED 로 관측되어야 한다.

## Exclusions (What NOT to Build)

- **가짜 진행 표시 금지** — 재요청 진행을 알리기 위해 진행률 바·퍼센트·남은 시간(ETA)·단계 카운터를 도입하지 않는다. 실제 진척도 정보가 없는 상태에서의 진행 표시는 거짓말이다. SPEC-AI-006 REQ-AI6-009 가 이미 금지하고 있으며(`waitNotice.ts:9`), 본 SPEC은 기존 `streaming` 표시(글로우 + 스켈레톤 + 8초 보조 문구)를 **그대로** 재사용한다(REQ-AI10-005).
- **신규 카드 phase·신규 위젯 금지** — 재요청 중 상태를 위한 `re-requesting` 류의 새 `CardPhase` 나 전용 위젯을 만들지 않는다. `reduceCard`(`ai-suggestion-card.ts:81-109`)의 상태 집합은 무변경이다 — 결함 1은 표시 수단의 부재가 아니라 기존 수단으로의 **전이 누락**이다.
- **`aiStore` 다중 요청 재설계 금지(기본 방침)** — `AiTransientSlice` 를 requestId 별 Map 으로 바꾸는 재설계를 **하지 않는다**. 이 슬라이스는 고스트 텍스트 브리지·툴바·설정 화면이 공유하며, `reduceCompleteRequest` 의 "`streamBuffer` 는 완료 시 `ai://done` 의 `result` 라는 권위 값으로 확정된다"는 계약(SPEC-AI-009 Design Notes)이 그 위에 서 있다. REQ-AI10-012 는 **이벤트 라우팅 계층**에서 해결하며, 더 작은 방법이 성립하지 않는다는 것이 Run phase 에서 증명되면 숫자를 임의로 고치지 말고 근거를 보고해 SPEC 개정으로 처리한다.
- **백엔드 변경 금지** — `src-tauri/` 는 무변경이다. `WATCHDOG_TIMEOUT_SECS` 를 줄이거나, 프론트 백스톱을 이유로 백엔드 워치독을 제거하거나, 신규 IPC 커맨드·신규 이벤트 타입을 추가하지 않는다. 프론트 백스톱은 백엔드를 **대체하지 않고 뒤에서 받는다**(REQ-AI10-008).
- **백스톱 임계를 백엔드 이하로 두기 금지** — 프론트가 먼저 발동하면 백엔드의 **분류된** `timeout` 오류를 덜 유용한 오류로 덮어쓴다. 두 값이 같은 것도 금지다(경합 순서가 보장되지 않는다). 순서 불변식은 단위 테스트로 고정한다(REQ-AI10-008).
- **파일 전환 정리 재구현 금지** — SPEC-AI-009 REQ-AI9-033/034/035 의 구현(`initAiFileSwitchEffects`·`runAiArtifactCleanup`·`AppLayout.tsx:91` 등록)은 커밋 `37059a7` 에 이미 있다. 같은 동작을 다시 쓰거나, 정리 호출을 `useFileSystem.openFile`·`uiStore`·`fileStore` 내부에 결합하지 않는다(SPEC-AI-009 Exclusions 연장). 본 SPEC이 손대는 것은 `clearCardRegistry` 의 타이머 누수뿐이다(REQ-AI10-014).
- **무손상 계약 변경 금지** — 문서 텍스트는 여전히 사용자의 명시적 [바꾸기]/[아래에 삽입] 확정으로만, 원문 재검증(`:541-544`)을 통과한 뒤, **단일 트랜잭션**으로만 바뀐다(SPEC-AI-001 REQ-AI-022/033/035). 모듈 3은 삽입 지점 계산만 바꾼다 — 자동 적용·부분 적용·되돌리기·본문 복원 같은 새 문서 변경 동작을 도입하지 않는다(REQ-AI10-022).
- **코드 펜스 상태 추적 금지(v1)** — 블록 경계 탐색기를 펜스 열림/닫힘을 추적하는 상태 기계로 승격시키지 않는다. 줄 단위 순수 판정을 유지한다. 펜스 내부 선택은 알려진 한계로 문서화하고(Design Notes), 실제 사용자 보고가 나오면 별도 REQ로 다룬다.
- **`PARAGRAPH_SEP` 상수 제거 금지** — 이 상수는 경계 **탐색**뿐 아니라 **삽입 구분자**(`:555`)로도 쓰인다. 탐색 용도에서만 제거하고 삽입 형태(`\n\n` + 제안)는 무변경으로 유지한다 — 지우면 삽입 결과가 바뀌어 기존 테스트가 깨진다.
- **`expandToSentenceBoundary` 종결 부호 집합 변경 금지** — `SENTENCE_TERMINATORS = '.!?。'`(`:477`)와 이미 종결 부호·문단 경계에서 끝나면 확장하지 않는 조기 반환(`:493-499`)은 무변경이다. 본 SPEC이 바꾸는 것은 종결 부호를 **찾지 못했을 때의 상한**뿐이다(REQ-AI10-019).
- **IPC 계약 변경 금지** — `AiRequestArgs`·`AiProviderStatus`·`ai_cancel` 시그니처와 `ai://chunk`/`ai://done`/`ai://error` payload 스키마는 무변경이다. 결함 2b의 이벤트 라우팅은 **기존 3종 payload 를 그대로 중계**하며 새 필드·새 이벤트를 만들지 않는다.
- **카드 상태 영속화 금지** — 백스톱으로 error 가 된 카드나 진행 중 카드를 앱 재시작·파일 전환 후 복원하지 않는다. 카드는 세션·문서 스코프의 휘발성 산출물이다(SPEC-AI-009 Exclusions 연장).
- **SPEC-AI-001 REQ-AI-025 / AC-AI-011 개정 금지** — 모듈 4는 그 요구사항의 **문언을 바꾸지 않는다**. "↻ 방향 없는 재요청이 연속 3회 소진되면 방향 지시 입력을 안내하고 1회성 sonnet 재시도를 인라인 제안한다"는 요구는 이미 옳고, 빠진 것은 배선뿐이다. 본 SPEC이 하는 일은 그 요구를 **구현 가능하게** 만드는 것이며, 요구를 재해석하거나 축소·확대하지 않는다.
- **`MAX_RETRY` 값 변경 금지** — `3`(`ai-suggestion-card.ts:75`)을 늘리거나 줄이거나, 설정으로 노출하거나, 이름을 바꾸지 않는다. 임계 조정은 별도 SPEC 으로 다룰 사안이며, 본 SPEC은 **기존 임계를 실효화**할 뿐이다(REQ-AI10-033 (a)).
- **error/intruded 재시도 버튼의 라벨·동작 변경 금지** — `[다시 시도]`(`:370-374`)와 `[다시 요청]`(`:389-392`)의 문구·클래스·발행 동작은 무변경이다. 모듈 4가 이 둘에 더하는 것은 `exempt` 분류 인자 하나뿐이며, 그 결과 관측 가능한 동작은 개정 전과 **완전히 동일**하다(카운터에 닿지 않으므로).
- **`aiStore`·`src-tauri` 변경 금지(모듈 4)** — 재요청 카운터는 카드 컨트롤러의 상태 머신(`reduceCard`)에만 존재한다. `aiStore` 에 카운터를 두면 카드 N개가 단일 슬롯을 공유해 카드 A의 ↻ 가 카드 B의 카운터를 밀게 되며, 이는 모듈 2가 이벤트 라우팅 계층에서 해소한 문제와 정확히 같은 형태다. 백엔드는 재요청 횟수를 알 필요가 없다.
- **소진 시점 자동 승격 금지** — 4번째 blind 시도에서 시스템이 사용자 확인 없이 자동으로 sonnet 재요청을 발행하지 않는다. `[⚡ 고급 모델로 다시 시도]` 는 **사용자가 누르는 제안**이다(REQ-AI-025 의 "인라인 제안"). 자동 승격은 사용자가 요청한 적 없는 상위 모델 비용을 발생시킨다.

---

Version: 0.0.2 (draft)
Classification: spec-anchored
Last Updated: 2026-07-27
