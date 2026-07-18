---
id: SPEC-AI-006
version: "0.1.1"
status: completed
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 21
dependencies:
  - SPEC-AI-001
  - SPEC-AI-002
  - SPEC-AI-003
tags:
  - ai
  - prompt
  - timeout
  - ghost
  - editor
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | jw | 최초 SPEC 작성 — AI 프롬프트 정밀도·지연 워치독·이어쓰기 보조 UX 5종. (1)인라인 변환 대상 스코핑 + Polish 언어 편향 제거, (2)요청 하드 타임아웃 워치독 + timeout 오류 종류, (3)고스트 재요청 ↻, (4)이어쓰기 길이 옵션(짧게/보통), (5)장시간 대기 안내 문구. research.md 확정 사실 반영, 설계 결정 D1~D5 확정(plan.md Decision Log). 항목 1은 미생성 유령 SPEC-AI-004의 프롬프트 핫픽스 미해결분(D-A 흡수·언어 편향) 계승. TDD RED-first. 항목 1·2·4는 Rust를 수정한다. |
| 0.1.1 | 2026-07-17 | jw | 구현 완료(commit f120230, vitest 985/cargo 240/tsc·clippy 클린/e2e ai-006.spec.ts 통과). 동작 계약 무변경, as-implemented 세부만 기록: (a) N1 경합은 REQ-AI6-006의 옵션 ii(kill 전 claim)로 해소 — 워치독이 자식 kill보다 먼저 `finished` claim을 시도해 릴레이와의 경합에서도 단일발행 보장, (b) 카드 `buildCardKey`에 waiting suffix 추가 — 대기 문구 표시 전이 시 위젯 재렌더를 강제하기 위함(REQ-AI6-007), (c) 고스트 재요청(↻) 버튼은 기존 버튼 카운트 단언(테스트)을 보호하기 위해 별도 클래스 `cm-ai-ghost-redo-btn` 사용(REQ-AI6-010), (d) 고스트 대기 타이머는 신규 이벤트 구독 없이 CodeMirror `updateListener` 단일 관찰점에 배선(REQ-AI6-007/008). lifecycle: spec-anchored 유지(Level 2). |

## Summary

`mdedit` AI("가벼운 인에디터 어시스턴트")의 사용성 리서치(`.moai/reports/ai-usability-research-2026-07-17.md`)와 오너 도그푸딩(`프롬프트-핫픽스-테스트.md`·`이어쓰기-테스트.md`)에서 도출된 **프롬프트 정밀도·지연 체감·이어쓰기 보조 UX 5개 항목**을 처리한다. 새 인프라·새 표면·아웃오브스코프(채팅/에이전트)를 도입하지 않고, 기존 프롬프트 계층(Rust)·릴레이·고스트/카드 인프라 위에 국소 수정만 얹는다.

1. **[High] 인라인 변환 대상 스코핑** — 인라인 변환 시스템 프롬프트가 `[대상]`만 변환하고 `[앞 문맥]`/`[뒤 문맥]`은 읽기 전용 참고로 취급하도록 명시(흡수 방지, 오너 A-1/A-2 실패 해소). 동시에 Polish의 "너는 한국어 문장 교정기다" 언어 편향을 입력 언어 유지로 중립화한다. **프롬프트 문자열 수정 한정**.
2. **[High] 요청 하드 타임아웃 워치독** — 요청마다 스폰되는 `claude` 프로세스에 워치독이 없어 행(hang) 시 스켈레톤이 무한정 돈다. Rust에 하드 타임아웃(기본 60초 상수)을 추가해 프로세스를 종료하고 **login/network/parse/other와 구별되는 `timeout` 오류**를 프론트에 전달한다.
3. **[Minor] 고스트 재요청(↻)** — 카드에는 재요청(`fireReRequest`)이 있으나 고스트에는 없다. 완료(done) 고스트에 ↻ 재요청 어포던스를 추가해 동일 트리거 인자로 한 번 더 발행한다(기존 인프라 재사용).
4. **[Minor] 이어쓰기 길이 옵션(짧게/보통)** — haiku의 문단 통짜 생성을 완화하는 경량 길이 제어. 지속 설정(`aiContinueLength`, 기본 보통) + 이어쓰기 프롬프트 지시 1줄. 이어쓰기(continue)에만 적용.
5. **[Minor] 장시간 대기 안내 문구** — 항목 2의 프론트 짝. N초(기본 8초) 무응답 시 기존 로딩 표면(카드 스켈레톤·고스트 플레이스홀더)에 "아직 생성 중이에요 — 취소할 수 있어요" 보조 문구를 표시한다.

## Background & Rationale

- 리서치의 남은 핵심 3축은 (1) 인라인 변환 흡수, (2) 지연 무한 스켈레톤, (3) 침묵/편향 정리다. 본 SPEC은 이 중 사용자 체감이 큰 (1)(2)를 High로, 이어쓰기 보조 UX 3종을 Minor로 담는다.
- **항목 1은 미생성 유령 SPEC-AI-004를 상위대체한다**: `.moai/reports/plan-audit/SPEC-AI-004-review-1.md`(PASS 0.93)가 프롬프트 핫픽스 4종(D-A 흡수/D-B 재복창/D-C 펜스/D-D 과잉생성)을 감사했으나 `.moai/specs/SPEC-AI-004/` 디렉토리는 생성되지 않았다. D-C·D-B는 SPEC-AI-003 코드로 이미 반영됐고(prompt.rs:86-91 펜스 금지, L234-243 반복/선점 금지), **D-A(대상 스코핑 흡수)·언어 편향은 미해결**이다(리서치 "핫픽스 2탄 필요"). 항목 1이 이 미해결분을 흡수한다.
- 프롬프트 조립은 전부 Rust(`prompt.rs`) 단일 소스다(REQ-AI-003). 인라인 6기능(polish/outline/table/diagram/shorten/custom)은 `build_inline_prompt`가 유일 조립 지점이며, `Custom`은 `system_prompt()`에서 조기 return하므로 **스코핑·언어 지시는 조립 지점에서 덧붙여야** 6기능이 균일 커버된다. 이어쓰기/섹션 채우기 프롬프트는 바이트 동일 하위호환 테스트(prompt.rs:570-575, 586-591)를 가지므로 `COMMON_INSTRUCTION`·`Continue` base는 절대 건드리지 않는다(research.md §1).
- 요청 릴레이(`relay_process`, claude_cli.rs:162)는 블로킹 라인 순회이며 타임아웃이 없다. 정상 완료 시에도 in-flight 슬롯의 죽은 child가 잔류하는 구조이므로, 워치독은 릴레이와 공유하는 단일발행 선점 플래그로 오탐을 차단해야 한다(research.md §2, D2).
- 이어쓰기 길이는 힌트 클릭·`Mod+Enter` 두 경로를 균일 커버하고 재요청(항목 3)에도 실려야 하므로 지속 설정이 유일 배치다(research.md §4, D4).

## 사전 합의 설계 결정 (재검토 금지)

> 아래 항목 번호는 plan.md Decision Log(D1~D5)와 교차 대조된다. 내용은 plan.md Decision Log가 규범.

1. **항목 1 삽입 전략**: 대상-스코핑 + 입력-언어-유지 절을 **`build_inline_prompt` 조립 지점**에 덧붙여 인라인 6기능 균일 적용. `COMMON_INSTRUCTION`·`Continue` base·`build_section_prompt`/`build_continue_prompt`는 무변경(이어쓰기 바이트 하위호환 보존). Polish 문자열은 언어 중립으로 재작성. (→ plan.md **D1**)
2. **항목 2 타임아웃 기본값·기제**: 하드 타임아웃 **기본 60초 상수**. 요청당 워치독 스레드 + **요청별 공유 `finished` 선점(swap false→true, 최초 성공자만 발행)** 으로 단일 terminal 발행 보장. 선점에 참여하는 발행 지점은 **넷**이다 — 릴레이(done·error·EOF Silent 포함), 워치독, `ai_cancel`(mod.rs:224), 신규 요청 교체(mod.rs:156). 워치독 선점 시 자식 kill + in-flight 정리 + `ai://error{kind:"timeout"}`. (→ plan.md **D2**)
3. **항목 4 시그니처 하위호환**: `ContinueLength{Short,Normal}` + `build_continue_prompt_with_length`; 기존 `build_continue_prompt`(3인자)는 `Normal`로 위임해 바이트 동일 → 기존 이어쓰기 테스트 무개정. `Normal`=추가 지시 없음, `Short`="한두 문장만". (→ plan.md **D3**)
4. **항목 4 배치**: 이어쓰기 길이는 **지속 설정** `uiStore.aiContinueLength`('short'|'normal', 기본 'normal', `aiAdvancedModel` 선례) + SettingsModal AI 섹션 토글. 힌트 알약·에페메럴 컨트롤 배치는 기각(두 트리거 경로 균일 커버·재요청 승계 이유). (→ plan.md **D4**)
5. **항목 3 재요청 의미론**: 고스트 ↻는 **마지막 트리거 인자 재사용**(재파생 아님)으로 새 requestId 발행 — 카드 `fireReRequest`와 동일 의미론. done 상태에서만 노출, streaming 중엔 `[■ 중지]`만. (→ plan.md **D5**)

> 항목 5의 대기 문구 임계(기본 8초)는 항목 2의 60초 하드 kill과 짝을 이루는 소프트 절반으로, 상세는 plan.md Decision Log(D2 비고) 참조.

## Environment & Assumptions

- SPEC-AI-001/002/003이 main에 머지 완료. 프롬프트 계층(`prompt.rs`)·릴레이(`mod.rs`/`claude_cli.rs`)·고스트(`ai-ghost-text.ts`)·카드(`ai-suggestion-card.ts`)·`ai_cancel`·`aiStore` 전부 가용.
- 프롬프트 조립은 전부 Rust(REQ-AI-003). 인라인 유일 조립 지점 `build_inline_prompt`(prompt.rs:151), 이어쓰기 `build_continue_prompt`(L207). 이어쓰기 바이트 하위호환 테스트 존재(L570-575, L586-591).
- 오류 종류: Rust `ErrorPayload.kind: String` + `friendly_error_message`(claude_cli.rs:101), 프론트 `AiErrorKind='login'|'network'|'parse'|'other'`(aiStore.ts:11), 릴레이 `useAiRelay`가 kind 통과.
- 고스트 발행 커맨드 3종(ghost-text.ts): `startSectionFillCommand`(L390, `feature:'section-fill'`·presetKind 없음), `startContinueWritingCommand`(L421, `presetKind:'continue'`), `startFreeContinueWritingCommand`(L452, `presetKind:'continue'`). 이어쓰기(continue)는 뒤 2종뿐이며 섹션 채우기는 continue가 아니다. 컨트롤 위젯 `GhostControlsWidget`(L334).
- 지속 설정 인프라: `uiStore` zustand persist(localStorage `mdedit-ui-store`), `aiAdvancedModel` 선례(상태·setter·partialize). partialize는 `statusMessage`만 제외 → 신규 필드 자동 영속.
- **본 SPEC은 Rust를 수정한다(항목 1·2·4)** — cargo 테스트가 증가하며 착수 시 `cargo test`로 기준선 재확정. vitest 기준선 962+.
- `npm run lint`는 eslint config 부재로 상시 실패 — 게이트에서 제외(회귀 오판 금지).
- 신규 런타임 의존성 없음. 새 IPC 이벤트 없음(기존 `ai://error` kind 확장 + `AiRequestArgs.length` 선택 필드만).

## Requirements (EARS)

### 모듈 1 — 인라인 변환 대상 스코핑 + 언어 중립 (항목 1, Rust)

#### Ubiquitous

- **REQ-AI6-001**: The system **shall** 인라인 변환(polish/outline/table/diagram/shorten/custom) 시스템 프롬프트에 "오직 `[대상]` 텍스트만 변환·정리하고 `[앞 문맥]`/`[뒤 문맥]`은 이해를 돕는 읽기 전용 참고 자료이며 결과에 포함하지 말라"는 지시를 포함한다. [MODIFY: `build_inline_prompt`(prompt.rs:151) 조립 시 `feature.system_prompt()` 뒤에 스코핑 절 부착 — 6기능 균일, Custom 포함]
- **REQ-AI6-002**: The system **shall** 인라인 변환 결과가 입력(`[대상]`)의 언어를 그대로 따르도록 지시하고, Polish 시스템 프롬프트의 "한국어 문장 교정기" 하드코딩을 언어 중립 표현으로 대체한다. [MODIFY: Polish 문자열(prompt.rs:78) 언어 중립화 + 스코핑 절에 "입력 텍스트의 언어를 유지하라" 포함]

#### Unwanted Behaviour

- **REQ-AI6-003**: **IF** 스코핑·언어 지시를 추가하는 변경이 이어쓰기·섹션 채우기 프롬프트에 파급되려 하면, **then the system shall** 그 파급을 금지한다 — `COMMON_INSTRUCTION`·`AiFeature::Continue` base·`build_section_prompt`/`build_continue_prompt`의 산출 바이트를 변경하지 않는다(이어쓰기 하위호환 계약, prompt.rs:570-575/586-591). [EXISTING: 인라인 조립 지점 한정 삽입으로 계약 보존]

### 모듈 2 — 요청 하드 타임아웃 워치독 (항목 2, Rust + 프론트 오류 표면)

#### Event-Driven

- **REQ-AI6-004**: **WHEN** 진행 중인 AI 요청이 하드 타임아웃(기본 60초, 구성 가능 상수)을 초과하도록 응답을 완료하지 못하면, **the system shall** 해당 `claude` 자식 프로세스를 종료(kill)하고 in-flight 상태를 정리한 뒤 그 요청에 대해 `timeout` 종류의 오류를 프론트로 발행한다. [NEW: `mod.rs`/`claude_cli.rs` — 요청당 워치독 스레드 + 자식 kill + `ai://error{kind:"timeout"}`]

#### Ubiquitous

- **REQ-AI6-005**: The system **shall** 타임아웃 오류를 기존 `login`/`network`/`parse`/`other`와 **구별되는 `timeout` 종류**로 표현하여 프론트가 이를 별개 원인으로 인지·표시(안전 메시지)할 수 있게 한다. [MODIFY: Rust `friendly_error_message`에 "timeout" arm + 프론트 `AiErrorKind` union에 `'timeout'` 추가(aiStore.ts:11)]

#### Unwanted Behaviour

- **REQ-AI6-006**: **IF** 하나의 요청이 정상 완료·타임아웃·사용자 취소·신규 요청 교체 중 둘 이상의 종료 경로에서 근접하게 종료되면, **then the system shall** 그 요청에 대해 정확히 하나의 terminal 이벤트(`ai://done` 또는 `ai://error`)만 발행하고 어떤 중복·오탐 이벤트도 발행하지 않는다. [NEW: 릴레이의 **모든 outcome(정상 done·오류·EOF Silent 포함)**, 워치독, `ai_cancel`(mod.rs:224), 신규 요청 교체(mod.rs:156) — 이 **네 개 terminal 발행 지점 전부**가 공유 단일발행 선점(`Arc<AtomicBool>` claim, 최초 성공자만 발행·나머지는 억제)에 참여. 선점 판정은 순수 헬퍼로 분리해 단위 테스트]

### 모듈 3 — 장시간 대기 안내 문구 (항목 5, 프론트)

#### State-Driven

- **REQ-AI6-007**: **WHILE** AI 요청이 발행된 뒤 첫 응답 없이 대기 임계(기본 8초, 구성 가능 상수)를 넘겨 진행 중인 동안, **the system shall** 활성 로딩 표면(카드 스켈레톤·고스트 플레이스홀더)에 "아직 생성 중이에요 — 취소할 수 있어요" 형태의 보조 문구를 표시한다. [NEW: 카드 스켈레톤(card.ts:287-294)·고스트 플레이스홀더(ghost-text.ts:276) 대기 타이머]

#### Event-Driven

- **REQ-AI6-008**: **WHEN** 요청이 첫 청크 도착·완료·오류·취소 중 하나로 상태가 전이하면, **the system shall** 대기 안내 문구와 그 타이머를 즉시 제거한다. [NEW: 응답/취소/언마운트 시 타이머 clear]

#### Ubiquitous

- **REQ-AI6-009**: The system **shall** 대기 안내에 백분율 진행률 바 등 가짜 진행 표시를 사용하지 않는다 — 스트림에는 총량이 없으므로 조작된 진행률을 만들지 않는다. [NEW: 텍스트 보조 문구만, 진행률 금지]

### 모듈 4 — 고스트 재요청(↻) (항목 3, 프론트)

#### Event-Driven

- **REQ-AI6-010**: **WHEN** 사용자가 완료(done) 상태의 고스트에서 재요청(↻)을 실행하면, **the system shall** 그 고스트를 발행했던 트리거 인자(feature/presetKind/model/outline/앞·뒤 문맥/앵커)를 재사용해 새 `requestId`로 **동일 종류의 요청**(원 트리거가 continue든 section-fill이든)을 다시 발행한다. [NEW: `GhostControlsWidget` done에 ↻ + 마지막 트리거 인자 보관·재발행(카드 `fireReRequest` 의미론)]

#### State-Driven

- **REQ-AI6-011**: **WHILE** 고스트가 streaming 상태인 동안, **the system shall** 재요청(↻)을 노출하지 않고 `[■ 중지]`만 제공한다 — 재요청은 done 상태에서만 가능하다. [MODIFY: `GhostControlsWidget.toDOM`(ghost-text.ts:334) 분기]

### 모듈 5 — 이어쓰기 길이 옵션 (항목 4, Rust + 프론트 설정)

#### Ubiquitous

- **REQ-AI6-012**: The system **shall** 이어쓰기 길이 설정을 `uiStore`의 영속 필드 `aiContinueLength: 'short' | 'normal'`로 보관하고, 최초값(미설정 사용자)은 '보통'(normal)으로 한다. [NEW: `uiStore`(`aiAdvancedModel` 라인 복제) + SettingsModal AI 섹션 토글]

#### Event-Driven

- **REQ-AI6-013**: **WHEN** 이어쓰기(continue) 요청이 발행되면, **the system shall** 현재 이어쓰기 길이 설정을 프롬프트 지시로 반영하여, '짧게'면 "한두 문장만" 분량을 지시하고 '보통'이면 기존 분량 지시를 유지한다. [NEW: IPC `AiRequestArgs.length`(선택) + `build_continue_prompt_with_length`(Short/Normal). continue 발행부는 **2곳**뿐 — `startContinueWritingCommand`(ghost-text.ts:421)·`startFreeContinueWritingCommand`(ghost-text.ts:452)에만 length 전달. `startSectionFillCommand`(L390)는 섹션 채우기이므로 제외(REQ-AI6-014와 정합)]

#### Ubiquitous

- **REQ-AI6-014**: The system **shall** 길이 옵션을 이어쓰기(continue)에만 적용하고, 인라인 변환·섹션 채우기 프롬프트에는 영향을 주지 않는다. [NEW: mod.rs `ai_request`의 `Continue` 분기에서만 length 매핑, 그 외 분기 무영향]

### 모듈 6 — 하위호환·기존 동작 보존

#### Ubiquitous

- **REQ-AI6-015**: The system **shall** 기본 설정(길이='보통')에서 관찰 가능한 기존 동작(인라인 변환·이어쓰기·섹션 채우기)을 변경 없이 유지하고, 이어쓰기/섹션 프롬프트의 산출 바이트를 보존하며, 기존 vitest·cargo 테스트를 개정 없이 통과시킨다. 신규 런타임 의존성을 추가하지 않는다. [EXISTING: 인라인 한정 프롬프트 삽입 + `build_continue_prompt` 위임 + 기본값 normal]

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [MODIFY] | `src-tauri/src/ai/prompt.rs` | `build_inline_prompt`에 대상-스코핑·언어-유지 절 부착(6기능 균일); Polish 문자열 언어 중립화. `COMMON_INSTRUCTION`·`Continue` base 무변경 |
| [NEW] | `src-tauri/src/ai/prompt.rs` | `ContinueLength{Short,Normal}` + `build_continue_prompt_with_length`; 기존 `build_continue_prompt`는 `Normal` 위임(바이트 동일) |
| [MODIFY] | `src-tauri/src/ai/mod.rs` | `ai_request`에 요청당 워치독 스폰(하드 타임아웃 상수) + 요청별 공유 `finished` 플래그 생성; `ai_cancel`(L224) 및 신규 요청 교체(L156)의 `ai://error` 발행을 **발행 전 `finished` claim 게이트**로 감쌈(이중발행 방지, REQ-AI6-006); `AiRequestArgs.length: Option<String>` + `Continue` 분기 length 매핑 |
| [MODIFY] | `src-tauri/src/ai/claude_cli.rs` | `friendly_error_message`에 "timeout" arm; 릴레이가 **모든 outcome(done·error·EOF Silent 포함)에서 발행 전 `finished` claim**; 워치독은 claim 성공 시에만 `ai://error{kind:"timeout"}` 발행. 릴레이·워치독·`ai_cancel`·교체 4지점이 동일 `finished`를 공유(단일발행 선점) |
| [NEW] | `src-tauri/src/ai` — 단일발행 선점 헬퍼 | `Arc<AtomicBool>` claim(최초 true 성공자만 발행) 순수 헬퍼 — 4개 terminal 발행 지점 공용(`@MX:ANCHOR`) |
| [MODIFY] | `src/store/aiStore.ts` | `AiErrorKind` union에 `'timeout'` 추가 |
| [MODIFY] | `src/store/uiStore.ts` | `aiContinueLength: 'short'|'normal'`(기본 'normal') + setter(`aiAdvancedModel` 라인 복제), partialize 무변경 |
| [MODIFY] | `src/components/settings/SettingsModal.*` | AI 섹션에 이어쓰기 길이 토글(짧게/보통) + onChange→setter |
| [MODIFY] | `src/components/editor/extensions/ai-ghost-text.ts` | continue 발행부 2곳(`startContinueWritingCommand` L421·`startFreeContinueWritingCommand` L452, `aiRequest` 호출 L435·L465)에 `length` 전달; 마지막 트리거 인자 보관; `GhostControlsWidget` done에 ↻ 재요청 버튼. `startSectionFillCommand`(L390)는 제외 |
| [MODIFY] | `src/components/editor/extensions/ai-suggestion-card.ts` | 카드 스켈레톤(L287-294)에 대기 안내 문구(기존 note DOM 패턴 재사용) |
| [NEW] | 대기 안내 타이머 헬퍼(프론트) | 발행 후 8초 무응답 시 문구 표시, 응답/취소 시 clear (카드+고스트 공용) |
| [EXISTING] | `src/hooks/useAiRelay.ts` | kind를 그대로 통과 — 무변경(timeout도 자동 릴레이) |
| [NEW] | `src-tauri` 프롬프트/오류 테스트 | 스코핑·언어-유지 단언, `build_continue_prompt_with_length` Short 지시, "timeout" 메시지, 선점 헬퍼 단위 테스트 |
| [NEW] | 프론트 테스트 | uiStore `aiContinueLength` persist·기본값, SettingsModal 토글, 고스트 ↻ 재발행, 대기 문구 표시/제거, 이어쓰기 발행 length 전달 |
| [MODIFY] | `e2e/ai-*.spec.ts` | 인라인 스코핑·이어쓰기 길이·대기 문구 중 webkit 검증 가능 범위 확장 |

## Acceptance Criteria 매핑

> acceptance.md의 Given-When-Then과 대응. REQ-AI6-001~015 전 요구사항이 최소 1개 AC에 매핑된다.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-AI6-001 | REQ-AI6-001, 002, 003 | 대상 스코핑 — A-1(짧게)·A-2(개요로) 다른 섹션 미흡수 + Polish 언어 유지 + 이어쓰기/섹션 프롬프트 바이트 불변 |
| AC-AI6-002 | REQ-AI6-004, 005, 006 | 하드 타임아웃 → kill + `timeout` 오류; 정상 완료/취소/교체 시 워치독 오탐·중복 발행 0 |
| AC-AI6-003 | REQ-AI6-007, 008, 009 | 8초 후 카드·고스트에 대기 문구 표시 → 응답 시 제거 + 진행률 바 없음 |
| AC-AI6-004 | REQ-AI6-010, 011 | done 고스트 ↻ → 동일 인자 새 요청; streaming 중 미노출 |
| AC-AI6-005 | REQ-AI6-012, 013, 014 | '짧게' 설정 시 이어쓰기 프롬프트에 "한두 문장" 지시; 기본 '보통'; 인라인/섹션 무영향; 재시작 유지 |
| AC-AI6-006 | REQ-AI6-015 | 하위호환 — 기본 보통, 이어쓰기/섹션 바이트 보존, 기존 테스트 무개정, 신규 의존성 0 |

## mx_plan

code_comments = ko (`language.yaml`). `@MX:SPEC: SPEC-AI-006` 공통 부착.

| 위치 | 태그 | 사유 |
|------|------|------|
| 단일발행 선점 헬퍼(모듈 2) | `@MX:ANCHOR` | 정확히 한 주체만 terminal을 발행하는 불변식(REQ-AI6-006) — 릴레이·워치독·`ai_cancel`·신규 요청 교체 4지점이 공유(fan_in ≥ 4). `@MX:REASON` 필수 |
| `build_inline_prompt` 스코핑 절(모듈 1) | `@MX:NOTE` | 인라인 6기능 균일 대상-스코핑·언어-유지 계약과 이어쓰기 바이트 하위호환 경계 기록(REQ-AI6-001/003) |
| 워치독 하드 타임아웃 상수(모듈 2) | `@MX:NOTE` | 기본 60초 근거(p99 상회, 무한 행 차단) 기록(REQ-AI6-004) |

## Exclusions (What NOT to Build)

- **`truncated` 고지 죽은 코드 수정** — 카드 `onComplete(s.streamBuffer)`(ai-suggestion-card.ts:1059)가 `s.truncated`를 넘기지 않아 "일부만 참고" 고지가 안 뜨는 원라이너 후보이나, 사용자가 본 SPEC 범위에서 명시적으로 제외했다(별도 처리).
- **히스토리 기능** — 영속 상태·별도 패널은 라이트 어시스턴트 포지셔닝 이탈로 기각.
- **다후보 제안 랭킹** — 비용·지연 배수로 보류(리텐션 데이터 확인 후 재검토).
- **개요(outline) 무절단 비대화 경로** — 별개 관심사(prompt.rs `build_continue_prompt`/`build_section_prompt`의 outline 상한)로 본 SPEC 범위 밖.
- **채팅 패널 / 멀티턴 에이전트 표면** — 명시적 아웃오브스코프, 인에디터 어시스턴트 정체성과 충돌.
- **인라인 자동 트리거(타이핑 중 자동 제안)** — REQ-AI-032(토큰 0 로컬 판정) 원칙과 충돌.
- **길이 옵션의 섹션 채우기·인라인 확장** — 길이 제어는 이어쓰기(continue) 전용(REQ-AI6-014).
- **진행률 바·가짜 진행 표시** — 스트림엔 총량이 없어 조작 금지(REQ-AI6-009).
- **오류별 정교한 UI 분기 신설** — `timeout`은 카드의 기존 "다시 시도" 폴백에 귀속(login 외 종류 흡수), 신규 오류 전용 화면 없음.
- **신규 의존성** — npm/cargo 추가 없음.
