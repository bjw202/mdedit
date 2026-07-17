---
id: SPEC-AI-006
version: "0.1.0"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 0
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | jw | 최초 acceptance 작성 — 프롬프트 정밀도·지연 워치독·이어쓰기 보조 UX 5종. 핵심 시나리오 6건(A-1/A-2 명시 포함) + 엣지 케이스 + 품질 게이트 + DoD. |

# Acceptance Criteria — SPEC-AI-006 (AI 프롬프트 정밀도·지연 워치독·이어쓰기 보조 UX)

검증 방식:
- **cargo test(Rust)**: 인라인 스코핑·Polish 언어 중립 프롬프트 단언(`prompt.rs` 테스트 확장), 이어쓰기/섹션 바이트 하위호환 가드, `build_continue_prompt_with_length`(Short 지시·Normal 바이트 동일), `friendly_error_message("timeout")`, 단일발행 선점 헬퍼(순수) 단위 테스트, `AiRequestArgs.length` 역직렬화. 선례: `prompt.rs`·`claude_cli.rs`·`mod.rs` `#[cfg(test)]`.
- **vitest(jsdom)**: `AiErrorKind` union('timeout') 타입, uiStore `aiContinueLength` persist·기본값 normal, SettingsModal 토글, 고스트 ↻ 재발행(동일 인자·새 requestId), 대기 문구 표시/제거(fake timers), 이어쓰기 발행 시 length 전달. 선례: `uiStore.test.ts`·`SettingsModal.test.tsx`·`aiSuggestionCardRender.test.ts`·`aiRelay.test.ts`.
- **Playwright(webkit)**: `ai-inline-edit.spec.ts`·`ai-free-continue.spec.ts` 확장 — 인라인 변환 결과의 타 섹션 미흡수, 이어쓰기 길이 토글 반영, 대기 문구 표출 중 검증 가능 범위 + 콘솔 에러 0. Tauri IPC 실물 스폰은 실행되지 않음(기존 제약).
- **수동(도그푸딩)**: A-1/A-2/R-1/R-2(`프롬프트-핫픽스-테스트.md`)로 흡수 부재·과교정 부재 확인.

## 핵심 시나리오

### AC-AI6-001: 인라인 변환 대상 스코핑 + Polish 언어 유지 (REQ-AI6-001, 002, 003)

- **Given** 앞뒤에 다른 섹션이 풍부한 문서(`프롬프트-핫픽스-테스트.md`)에서 한 문단만 선택했을 때
- **When (A-1)** "3. 인증 흐름" 본문 문단 하나만 선택 → ✨ → [짧게 줄이기]를 실행하면
- **Then** 선택한 인증 문단의 축약본만 나오고, "링크보드는 팀 단위 북마크…"·"수집기는 슬랙…" 등 **다른 섹션 내용이 결과에 섞이지 않는다**.
- **When (A-2)** "4. 태그 분류 규칙" 본문 문단 하나만 선택 → ✨ → [개요로 정리]를 실행하면
- **Then** 태그 분류 규칙만 불릿으로 정리되고, 개요/아키텍처/인증 등 **문서 전체가 개요화되지 않는다**.
- **And** 인라인 6기능(polish/outline/table/diagram/shorten/custom)의 시스템 프롬프트가 "오직 `[대상]`만 변환하고 `[앞/뒤 문맥]`은 읽기 전용 참고"라는 지시를 포함한다(cargo 단언).
- **And** Polish 시스템 프롬프트에 "한국어 문장 교정기" 하드코딩이 없고 입력 언어 유지를 지시한다(영어 문단 다듬기 시 한국어 혼입 없음).
- **And** `build_section_prompt`/`build_continue_prompt` 산출 바이트는 스코핑 절을 포함하지 않으며, 기존 이어쓰기 하위호환 테스트(prompt.rs:570-575/586-591)가 무개정 통과한다.

### AC-AI6-002: 요청 하드 타임아웃 → timeout 오류 + 워치독 오탐 0 (REQ-AI6-004, 005, 006)

- **Given** 요청이 발행되어 in-flight인 상태일 때
- **When** 하드 타임아웃(기본 60초)을 초과하도록 프로세스가 응답을 완료하지 못하면
- **Then** 해당 `claude` 자식 프로세스가 종료되고 in-flight가 정리되며, 그 요청에 대해 `login`/`network`/`parse`/`other`와 **구별되는 `timeout` 종류의 `ai://error`가 1회 발행**된다(안전 메시지, raw stderr 미노출).
- **And** `AiErrorKind` union에 `'timeout'`이 존재하고 `friendly_error_message("timeout")`이 비어있지 않은 안전 문구를 반환한다.
- **When** 요청이 타임아웃 전에 정상 완료·사용자 취소·신규 요청 교체로 종료되면
- **Then** 워치독은 **어떤 오탐 오류나 중복 terminal 이벤트도 발행하지 않는다** — 릴레이(done·error·EOF Silent 포함)·워치독·`ai_cancel`·신규 요청 교체 **네 개 발행 지점 전부**가 동일 `finished`를 발행 전 claim하여 정확히 한 주체만 terminal을 낸다(선점 헬퍼 단위 테스트: 첫 호출 true·재호출 false).
- **When (근접 경쟁)** 사용자 취소와 60초 워치독이 근접하게 발화하면
- **Then** `ai_cancel` claim과 워치독 claim 중 **먼저 성공한 한쪽만** `ai://error`를 발행하고, 동일 requestId에 **이중 발행이 없다**(AC "1회 발행" 보존).
- **When (순차)** 5초 시점에 사용자가 취소한 뒤 60초 시점에 워치독이 발화하면
- **Then** 릴레이가 취소 EOF(Silent) 경로에서 이미 `finished`를 claim했으므로 워치독은 claim에 실패해 **뒤늦은 timeout 오류를 발행하지 않는다**.

### AC-AI6-003: 장시간 대기 안내 문구 표시/제거 + 진행률 금지 (REQ-AI6-007, 008, 009)

- **Given** AI 요청이 발행되어 첫 응답 전 대기 중일 때
- **When** 대기 임계(기본 8초) 경과 전이면
- **Then** 카드 스켈레톤·고스트 플레이스홀더에 대기 안내 문구가 없다.
- **When** 대기 임계를 넘겨도 첫 청크가 없으면
- **Then** 카드 스켈레톤과 고스트 플레이스홀더에 "아직 생성 중이에요 — 취소할 수 있어요" 형태의 보조 문구가 표시된다.
- **When** 첫 청크 도착·완료·오류·취소 중 하나가 발생하면
- **Then** 대기 안내 문구와 타이머가 즉시 제거된다.
- **And** 대기 안내에 백분율 진행률 바 등 가짜 진행 표시가 없다(DOM에 진행률 요소 부재).

### AC-AI6-004: 고스트 재요청(↻) — done 전용·동일 인자 재발행 (REQ-AI6-010, 011)

- **Given** 이어쓰기 고스트가 완료(done) 상태로 표시될 때
- **Then** 고스트 컨트롤에 `[✓ 넣기]`·`[✕ 지우기]`와 함께 재요청(↻) 버튼이 노출된다.
- **When** 사용자가 ↻를 실행하면
- **Then** 그 고스트를 발행했던 트리거 인자(feature/presetKind/model/outline/앞·뒤 문맥)를 재사용해 **새 `requestId`로 이어쓰기 요청이 다시 발행**된다(mock `aiRequest` 인자 단언).
- **And** 고스트가 streaming 상태인 동안에는 ↻가 노출되지 않고 `[■ 중지]`만 제공된다.

### AC-AI6-005: 이어쓰기 길이 옵션(짧게/보통) (REQ-AI6-012, 013, 014)

- **Given** 이어쓰기 길이 설정 `aiContinueLength`가 존재할 때
- **Then** 최초값(미설정 사용자)의 기본은 '보통'(normal)이고, 재시작 후에도 persist(localStorage `mdedit-ui-store`)로 유지된다.
- **When** 설정을 '짧게'(short)로 두고 이어쓰기(continue)를 발행하면
- **Then** 이어쓰기 프롬프트에 "한두 문장만" 취지의 분량 지시가 포함된다(`build_continue_prompt_with_length(Short)` 단언).
- **When** 설정이 '보통'(normal)이면
- **Then** 이어쓰기 프롬프트 산출이 기존 `build_continue_prompt`와 **바이트 동일**하다.
- **And** 길이 옵션은 이어쓰기에만 적용되며 인라인 변환·섹션 채우기 프롬프트에는 영향을 주지 않는다.

### AC-AI6-006: 하위호환 (REQ-AI6-015) [regression]

- **Given** 기본 설정(길이='보통')의 기존 사용자일 때
- **Then** 인라인 변환·이어쓰기·섹션 채우기의 관찰 가능한 동작이 SPEC-AI-006 이전과 동일하다.
- **And** 이어쓰기/섹션 프롬프트의 산출 바이트가 보존되고, 신규 런타임 의존성이 없으며(package.json/Cargo.toml diff 없음), 기존 vitest 962+ 단언이 **무개정으로 통과**한다.
- **And** cargo 테스트는 착수 시 재확정한 기준선 대비 신규(스코핑·길이·timeout·선점)만 증가하고 기존 단언은 무개정 통과한다.

## 엣지 케이스

- **R-1 과교정 금지**: 이미 깨끗한 문장 선택 → [다듬기] — 스코핑·언어 중립화 후에도 사실상 그대로 나옴(과교정 X, `isEmptyOrIdentical` 방어 유지).
- **R-2 표 흡수 금지**: "8. 요금제" 문단 선택 → [표로 만들기] — 요금제만 표가 되고 다른 섹션 미흡수(스코핑 확인).
- **혼용 문서 Polish**: 영어/혼용 문단 다듬기 → 입력 언어 유지(한국어 강제 결과 없음).
- **타임아웃 직전 첫 청크 도착**: 워치독 선점 전에 릴레이가 terminal 선점 → 정상 done, 워치독 무발행.
- **타임아웃과 사용자 취소 동시**: 둘 중 먼저 선점한 주체만 발행, 다른 쪽 무발행(중복 없음).
- **고스트 재요청 중 문서 이동**: 보관 인자 재사용이므로 원 컨텍스트로 재생성(재파생 아님 — 수용).
- **길이 '짧게' + 뒤 문맥 있음(자유 위치)**: 길이 지시가 "끊긴 문장 완성·반복/선점 금지" 조건절과 공존(둘 다 부착).
- **persist 저장소 손상/부재**: `aiContinueLength` 기본 'normal'로 폴백(zustand persist 기본 동작), 크래시 없음.
- **대기 문구 타이머 언마운트**: 카드/고스트 제거 시 타이머 clear(누수 없음).

## Quality Gate Criteria

- `tsc --noEmit` 클린
- `vitest run` 전량 통과 — **기준선 962개 이상**(신규 union·uiStore·설정 토글·고스트 ↻·대기 문구·길이 전달 테스트 포함, 기존 무개정)
- `cargo test` 전량 통과 — **착수 시 기준선 재확정 후 신규 포함 증가**(인라인 스코핑·`build_continue_prompt_with_length`·"timeout" 메시지·선점 헬퍼). 기존 이어쓰기 바이트 테스트 무개정 통과
- `cargo clippy` 클린
- Playwright(webkit) 통과 + 신규/확장 여정에서 콘솔 에러 0
- `npm run lint`는 **게이트 아님** — eslint config 부재로 main 포함 상시 실패(알려진 프로젝트 제약, 회귀 오판 금지)

## Definition of Done

- [ ] REQ-AI6-001~015 전부가 AC-AI6-001~006 중 최소 1개에 매핑되어 검증됨
- [ ] 결정 D1~D5가 구현·테스트에 반영됨
- [ ] A-1/A-2 흡수 실패 시나리오가 스코핑 프롬프트로 해소됨(수동/e2e 확인)
- [ ] 이어쓰기/섹션 프롬프트 바이트 하위호환 보존(기존 cargo 테스트 무개정 통과)
- [ ] 워치독 단일발행 선점으로 정상완료/취소/교체 시 오탐 0
- [ ] 기본 길이 '보통'으로 기존 관찰 동작 무변경
- [ ] 신규 런타임 의존성 0 확인(package.json/Cargo.toml diff 없음)
- [ ] MX 태그 부착: @MX:ANCHOR 1곳(단일발행 선점 헬퍼) + @MX:NOTE 2곳(스코핑 절·타임아웃 상수)
