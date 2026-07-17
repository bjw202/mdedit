---
id: SPEC-AI-006
version: "0.1.0"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 21
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | jw | 최초 plan 작성 — 프롬프트 정밀도·지연 워치독·이어쓰기 보조 UX 5종. research.md 확정 사실 기반 태스크 분해(T1~T6, 의존성 순), 결정 로그 D1~D5 확정, 리스크 분석, MX 태그 계획. TDD RED-first. 항목 1·2·4는 Rust 수정 → cargo 테스트 증가. |

## Overview

리서치가 도출한 5개 항목을 기존 프롬프트 계층(Rust)·릴레이·고스트/카드 인프라 위에 국소 수정으로 얹는다. 신규성은 (1) 인라인 조립 지점의 대상-스코핑·언어-유지 절, (2) 요청 워치독 하드 타임아웃 + `timeout` 오류 종류(단일발행 선점), (3) 고스트 ↻ 재요청, (4) 이어쓰기 길이 옵션(지속 설정 + 프롬프트 지시), (5) 대기 안내 문구다.

- 개발 방법론: **TDD** (RED-GREEN-REFACTOR, 브라운필드 Pre-RED — 기존 프롬프트/릴레이/고스트 코드 선독)
- 신규 런타임 의존성: **없음**. 새 IPC 이벤트 없음(기존 `ai://error` kind 확장 + `AiRequestArgs.length` 선택 필드)
- **본 SPEC은 Rust를 수정한다(항목 1·2·4)** — SPEC-AI-005와 달리 cargo 테스트가 증가한다
- 게이트 기준선: vitest 962+(main 현재) / cargo는 착수 시 `cargo test`로 재확정(신규 포함 증가) / tsc 클린 / clippy 클린. `npm run lint`는 게이트 아님(eslint config 부재)

## Decision Log (본 SPEC에서 확정)

| ID | 질문 | 결정 | 근거 |
|----|------|------|------|
| **D1** | 항목 1 프롬프트 삽입 전략(대상 스코핑·언어 편향) | **대상-스코핑 + 입력-언어-유지 절을 `build_inline_prompt` 조립 지점에서 `feature.system_prompt()` 뒤에 부착(인라인 6기능 균일). Polish 문자열을 언어 중립("주어진 텍스트의 언어를 유지한 채 맞춤법·문장을 다듬어라")으로 재작성. `COMMON_INSTRUCTION`·`Continue` base·`build_section_prompt`/`build_continue_prompt`는 무변경** (REQ-AI6-001/002/003) | 인라인 6기능(polish/outline/table/diagram/shorten/custom)의 유일 조립 지점은 `build_inline_prompt`(prompt.rs:151)이고 `Custom`은 `system_prompt()`에서 조기 return하므로, 조립 지점에서 덧붙여야 6기능이 균일 커버된다. 언어-유지를 `COMMON_INSTRUCTION`에 넣으면 이어쓰기 바이트 하위호환 테스트(prompt.rs:570-575 `!contains("금지")`·586-591 `==Continue.system_prompt()`)가 깨지므로 인라인 한정 삽입이 강제된다(research.md §1/§8). Polish 언어 편향은 리서치 케이스 d/g의 오작동 뿌리. |
| **D2** | 항목 2 타임아웃 기본값·발행 기제 | **하드 타임아웃 기본 60초 상수(구성 가능). 요청당 워치독 스레드 + 요청별 공유 `Arc<AtomicBool> finished` 선점(swap false→true 성공자만 terminal 발행). 선점에 참여하는 발행 지점은 넷: (a) 릴레이 `relay_process`가 done·error·EOF Silent 포함 모든 outcome에서 발행 전 claim, (b) 워치독이 타임아웃 시 claim 성공하면 자식 kill + in-flight 정리 + `ai://error{kind:"timeout"}`, (c) `ai_cancel`(mod.rs:224)이 발행 전 claim, (d) 신규 요청 교체(mod.rs:156)가 발행 전 claim. claim 실패한 지점은 무발행.** (REQ-AI6-004/006) | 릴레이(`relay_process`, claude_cli.rs:162)는 블로킹 순회이며 타임아웃이 없다. **터미널 `ai://error`는 현재 세 지점에서 발행된다** — 릴레이(cancelled면 Silent), `ai_cancel`(mod.rs:224, 무조건 발행), 신규 요청 교체(mod.rs:156, 무조건 발행). 여기에 워치독을 더하면 4지점이므로, 릴레이+워치독만 결속하면 취소·교체 emit과 워치독 emit이 동일 requestId에 이중 발행된다. 정상 완료 후에도 in-flight 죽은 child가 잔류하는 구조라(research.md §2) 4지점 전부가 동일 `finished`를 claim해야 정상완료·타임아웃·취소·교체 근접 경쟁을 안전히 흡수한다(AC-AI6-002 "1회 발행"). 60초는 실측 typical ~2.7초(claude_cli.rs:256-260) 대비 p99 훨씬 상회로 프록시 콜드스타트를 죽이지 않으면서 무한 행만 차단. 소프트 안내(항목 5)는 별개 짧은 임계 8초. |
| **D3** | 항목 4 `build_continue_prompt` 시그니처 하위호환 | **`ContinueLength{Short,Normal}` enum + `build_continue_prompt_with_length(outline,before,after,length)` 신설. 기존 `build_continue_prompt`(3인자)는 `Normal`로 위임해 바이트 동일 유지. `Normal`=추가 지시 없음, `Short`="짧게, 한두 문장만 작성하라" 부착.** (REQ-AI6-012/013/015) | 기존 이어쓰기 테스트 ~10개(prompt.rs:531-591)가 3인자로 호출하므로 시그니처에 인자를 추가하면 전 호출부·테스트가 깨진다. 위임 방식이면 기존 테스트 무개정 + `Normal` 바이트 동일 하위호환(REQ-AI6-015). 길이 지시는 `continue_system_prompt(has_after)`의 조건절 뒤에 부착. |
| **D4** | 항목 4 길이 옵션 배치 | **지속 설정 `uiStore.aiContinueLength`('short'|'normal', 기본 'normal', `aiAdvancedModel` 선례 복제) + SettingsModal AI 섹션 토글. IPC `AiRequestArgs.length: Option<String>`로 전달.** (REQ-AI6-012) | 길이는 발행 *전* 정해져야 하는데 이어쓰기 트리거는 힌트 클릭과 `Mod+Enter` 두 경로가 있고 `Mod+Enter`엔 힌트 알약이 없다. 지속 설정만이 두 경로를 균일 커버하고 재요청(항목 3)에도 그대로 실린다(research.md §4). 힌트 알약 변형은 알약 다중화·`Mod+Enter` 미커버로 기각. `aiAdvancedModel` persist 패턴 재사용으로 신규 인프라 0. |
| **D5** | 항목 3 고스트 재요청 의미론 | **↻는 마지막 트리거 인자(feature/presetKind/model/outline/before/after/anchor) 재사용으로 새 `requestId` 발행(재파생 아님). `GhostControlsWidget` done 상태에만 노출, streaming 중엔 `[■ 중지]`만.** (REQ-AI6-010/011) | 카드 `fireReRequest`(card.ts:968)와 동일 의미론 — 문서/커서가 이동해도 원 컨텍스트로 재생성한다(재파생은 이동 시 다른 컨텍스트가 됨). 고스트 발행 커맨드 3종(`startSectionFillCommand` L390·`startContinueWritingCommand` L421·`startFreeContinueWritingCommand` L452)이 인자를 만들므로 발행 시 보관 모듈에 저장하면 재사용이 단순하다(각 `aiRequest` 호출 L406·L435·L465). |

> 항목 5 대기 문구 임계(기본 8초 프론트 상수)는 D2의 60초 하드 kill과 짝을 이루는 소프트 절반. 응답/취소/언마운트 시 타이머 clear(리스크 5).

## Task Decomposition

각 유닛은 "테스트 먼저(RED) → 최소 구현(GREEN) → 정리(REFACTOR)". 순서는 의존성 순(프롬프트 → 타임아웃/오류 → 프론트 대기문구 → 고스트 재요청 → 길이 옵션 → e2e).

### T1. [MODIFY] 인라인 대상 스코핑 + Polish 언어 중립 (Rust, 항목 1)

- `build_inline_prompt`(prompt.rs:151)에서 `system_prompt = feature.system_prompt() + INLINE_SCOPE`(대상 한정 + 입력 언어 유지). Polish 문자열(L78) 언어 중립화. `COMMON_INSTRUCTION`·`Continue` base 무변경.
- **RED first**: prompt.rs 테스트 확장 — (a) 인라인 6기능 system_prompt에 "[대상]만"·"참고"·"언어" 취지 지시 포함, (b) Polish에 "한국어 문장 교정기" 부재·언어-유지 포함, (c) `build_section_prompt`/`build_continue_prompt` 산출 바이트가 스코핑 절을 포함하지 않음(하위호환 가드), (d) 기존 이어쓰기 바이트 테스트(:570-575/:586-591) 무개정 통과.
- Reference: `build_inline_prompt`(prompt.rs:151-178), `AiFeature::system_prompt`(L75-106), 기존 인라인 테스트(L475-508), 이어쓰기 하위호환 테스트(L570-591).
- 매핑: REQ-AI6-001, 002, 003. A-1/A-2는 T6 e2e/수동 검증에서 흡수 확인.

### T2. [MODIFY] 요청 워치독 하드 타임아웃 + timeout 오류 (Rust + 프론트 union)

- 단일발행 선점 헬퍼(순수, 예: `claim_terminal(&AtomicBool) -> bool`) + 요청별 공유 `finished` 플래그 + 요청당 워치독 스레드(기본 60초 상수)를 `ai_request`(mod.rs:99)에 배선. **터미널 발행 4지점 전부가 발행 전 claim**: (a) 릴레이(claude_cli.rs:162)가 done·error·EOF Silent 포함 모든 outcome에서, (b) 워치독이 타임아웃 시(claim 성공 시 자식 kill + in-flight 정리 + `ai://error{kind:"timeout"}`), (c) `ai_cancel`(mod.rs:224), (d) 신규 요청 교체(mod.rs:156). claim 실패 지점은 무발행. `friendly_error_message`에 "timeout" arm. 프론트 `AiErrorKind`에 `'timeout'` 추가.
- **RED first**: claude_cli.rs — `friendly_error_message("timeout")` 비어있지 않음·안전 문구; 선점 헬퍼 단위(첫 호출 true·재호출 false); `AiErrorKind` union 타입 단언(tsc). 동시성 회귀: 동일 `finished`에 대해 취소 claim 성공 후 워치독 claim 실패(순차: 취소→60초 무발행), 워치독 claim 성공 후 취소 claim 실패(근접: 이중발행 0) — 선점 헬퍼 단위로 검증. 워치독 통합은 순수 로직 분리로 최대 검증, 실 스폰은 e2e mock 제약상 제외.
- **[감사 review-2 N1 고정]** kill↔claim 순서 경합 주의: `ai_cancel`·교체 경로가 `child.kill()` **이후** claim하면, kill이 유발한 릴레이 EOF→Silent claim이 먼저 선점해 터미널 0건(스켈레톤 영구 대기)이 될 수 있다. T2 RED에서 다음 중 하나로 고정: (i) 릴레이는 Silent 경로에서 claim하지 않음(done/error만), 또는 (ii) `ai_cancel`·교체가 `child.kill()` **이전에** claim. 회귀 테스트 "취소/교체 시 터미널 정확히 1회" 포함.
- Reference: `ai_request`/`InFlightRequest`(mod.rs:99-207), 취소 emit(mod.rs:224)·교체 emit(mod.rs:156), `relay_process`/`decide_outcome`/`friendly_error_message`(claude_cli.rs:117-224), `AiErrorKind`(aiStore.ts:11), `useAiRelay`(무변경 확인).
- 매핑: REQ-AI6-004, 005, 006.

### T3. [NEW] 장시간 대기 안내 문구 (프론트, 항목 5)

- 발행 후 대기 임계(기본 8초 상수) 무응답 시 카드 스켈레톤(card.ts:287-294)·고스트 플레이스홀더(ghost-text.ts:276)에 "아직 생성 중이에요 — 취소할 수 있어요" 보조 문구. 첫 청크/완료/오류/취소/언마운트 시 타이머 clear. 진행률 바 금지.
- **RED first**: 카드 렌더 테스트(`aiSuggestionCardRender.test.ts` 패턴) — 8초 경과 전 문구 없음, 경과 후 문구 표시, 첫 청크 시 제거(fake timers). 고스트 플레이스홀더 동형. 진행률 요소 부재 단언.
- Reference: 카드 스켈레톤(card.ts:287-294)·`mdedit-ai-truncated-note` note DOM 선례(card.ts:405-407), 고스트 플레이스홀더(ghost-text.ts:276-289), aiStore 상태 전이.
- 매핑: REQ-AI6-007, 008, 009.

### T4. [MODIFY] 고스트 재요청(↻) (프론트, 항목 3)

- 고스트 발행 커맨드 3종(ghost-text.ts:390 section-fill·421 continue·452 free-continue)이 발행 시 마지막 트리거 인자를 보관. `GhostControlsWidget.toDOM`(L334) done 상태에 ↻ 버튼 추가 → 보관 인자(원 트리거 종류 그대로) 재사용해 새 requestId로 재발행(dismiss 후 재트리거). streaming 상태엔 ↻ 미노출. (재요청은 continue·section-fill 어느 고스트든 원 트리거를 재발행 — 길이 옵션 항목 4와 독립.)
- **RED first**: 고스트 컨트롤 렌더 — done 상태에 ↻ 존재·streaming 상태에 부재; ↻ 클릭 시 동일 인자(outline/before/after/model)로 `aiRequest` 재호출(mock 인자 단언), 새 requestId.
- Reference: `GhostControlsWidget`(ghost-text.ts:327-354), 발행부(L390/421/452), 카드 `fireReRequest`(card.ts:968) 의미론.
- 매핑: REQ-AI6-010, 011.

### T5. [MODIFY] 이어쓰기 길이 옵션 (Rust + 프론트 설정, 항목 4)

- `ContinueLength{Short,Normal}` + `build_continue_prompt_with_length`; 기존 `build_continue_prompt`는 `Normal` 위임. `AiRequestArgs.length: Option<String>`(mod.rs) + `Continue` 분기 매핑. `uiStore.aiContinueLength`(기본 'normal') + SettingsModal 토글. **continue 발행부 2곳**(`startContinueWritingCommand` L421·`startFreeContinueWritingCommand` L452, `aiRequest` 호출 L435·L465)에 length 전달. `startSectionFillCommand`(L390)는 제외(섹션 채우기, REQ-AI6-014).
- **RED first**: prompt.rs — `build_continue_prompt_with_length(Short)`가 "한두 문장" 취지 지시 포함, `Normal`이 기존 `build_continue_prompt` 산출과 바이트 동일; mod.rs — `AiRequestArgs` length 역직렬화(camelCase), `Continue` 분기만 length 반영·인라인/섹션 무영향. 프론트 — uiStore persist·기본값 normal(`uiStore.test.ts`), SettingsModal 토글(`SettingsModal.test.tsx`), continue 발행 2곳에서 length 전달(섹션 채우기 미전달).
- Reference: `build_continue_prompt`/`continue_system_prompt`(prompt.rs:207-243), `AiRequestArgs`/`ai_request` Continue 분기(mod.rs:74-128), `aiAdvancedModel` persist(uiStore.ts), continue 발행부(ghost-text.ts:421/452, `aiRequest` L435·L465).
- 매핑: REQ-AI6-012, 013, 014, 015.

### T6. [NEW] e2e + 하위호환 확인

- Playwright(webkit): 기존 `ai-inline-edit.spec.ts`·`ai-free-continue.spec.ts` 확장 — 인라인 변환 후 결과가 문서 다른 섹션 문자열을 포함하지 않음(스코핑, mock 응답 기반), 이어쓰기 길이 토글 반영, 대기 문구 표출 중 webkit 검증 가능 범위. 콘솔 에러 0.
- 하위호환: 기존 vitest 962+ 무개정 통과, `build_continue_prompt` Normal 바이트 동일 회귀. package.json/Cargo.toml diff 없음(신규 의존성 0).
- A-1/A-2(프롬프트-핫픽스-테스트.md): 스코핑 프롬프트 부착 후 흡수 부재를 수동/e2e mock 시나리오로 확인(AC-AI6-001 근거).
- Reference: `e2e/ai-inline-edit.spec.ts`·`e2e/ai-free-continue.spec.ts`, `e2e/fixtures/tauri-v2-ai-mock.ts`.
- 매핑: AC-AI6-001·005 e2e 커버, REQ-AI6-015.

## Risk Analysis (research.md)

| 리스크 | 완화 |
|--------|------|
| 프롬프트 하위호환 파손(스코핑·언어절이 이어쓰기 바이트 계약 침범) | 인라인 조립 지점 한정 삽입, `COMMON_INSTRUCTION`·`Continue` base 무변경(D1). 하위호환 가드 테스트(T1c/d) |
| 워치독 오탐(정상 완료 후 죽은 child 잔류) | 단일발행 선점(`finished` swap)으로 정상완료·취소·교체와의 경쟁 흡수(D2, REQ-AI6-006). 선점 헬퍼 단위 테스트 |
| **터미널 이중발행**(워치독 emit + `ai_cancel`/교체 emit이 동일 requestId에 근접) | 4지점(릴레이·워치독·`ai_cancel` mod.rs:224·교체 mod.rs:156) 전부 발행 전 동일 `finished` claim → 최초 성공자만 발행(D2, REQ-AI6-006). 근접·순차 경쟁 모두 선점 헬퍼 단위 회귀로 고정(AC-AI6-002) |
| 타임아웃 기본값 과소/과대 | 60초=p99 상회로 정당 지연 보존 + 무한 행 차단. 상수 노출로 조정 여지(D2) |
| 길이 옵션 시그니처 파손(기존 이어쓰기 테스트 다수) | `build_continue_prompt` 3인자 유지 + `_with_length` 위임(D3). `Normal` 바이트 동일 |
| 대기 문구 타이머 누수 | 응답/취소/언마운트 시 clear 필수(T3). 가짜 진행률 금지(REQ-AI6-009) |
| 오류 union 확장 회귀 | `AiErrorKind`에 'timeout' 추가 시 exhaustive switch 컴파일 강제, 카드 폴백이 login 외 흡수 → 런타임 무해 |
| 고스트 재요청 인자 staleness | 보관 인자 재사용(재파생 아님) — 카드 의미론과 동일, 수용(D5) |
| 기존 테스트 파괴 | 기본 normal + 인라인 한정 삽입 + 위임 → 관찰 동작 무변경, 무개정 통과(REQ-AI6-015) |

## MX Tag Plan

`@MX:SPEC: SPEC-AI-006` 공통 부착, code_comments = ko.

| 위치 | 태그 | 사유 |
|------|------|------|
| 단일발행 선점 헬퍼(T2) | `@MX:ANCHOR` | 정확히 한 주체만 terminal 발행하는 불변식(REQ-AI6-006), 릴레이·워치독·`ai_cancel`·신규 요청 교체 4지점 공유(fan_in ≥ 4). `@MX:REASON` 필수 |
| `build_inline_prompt` 스코핑 절(T1) | `@MX:NOTE` | 인라인 6기능 균일 대상-스코핑·언어-유지 계약 + 이어쓰기 바이트 하위호환 경계(REQ-AI6-001/003) |
| 워치독 하드 타임아웃 상수(T2) | `@MX:NOTE` | 기본 60초 근거(p99 상회, 무한 행 차단) 기록(REQ-AI6-004) |

## Quality Gates

- `tsc --noEmit` 클린 / `vitest run` ≥962 통과(신규 포함 전량, 기존 무개정) / `cargo test` 전량 통과(**착수 시 기준선 재확정 후 신규 포함 증가** — 항목 1·2·4가 Rust 수정) / `cargo clippy` 클린 / Playwright(webkit) 통과 + 콘솔 에러 0.
- **SPEC-AI-005와 달리 cargo 테스트가 변경된다** — `build_inline_prompt` 스코핑, `build_continue_prompt_with_length`, `friendly_error_message` "timeout", 선점 헬퍼 신규 단위 테스트 포함.
- `npm run lint`는 게이트 아님(eslint config 부재 — main 포함 상시 실패, 회귀 오판 금지).
- SPEC frontmatter 커밋 시 포맷터 손상 주의: 한 Bash 호출 내 checkout→edit→add(프로젝트 알려진 제약).
