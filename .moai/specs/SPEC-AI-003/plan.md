---
id: SPEC-AI-003
version: "0.1.0"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 15
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | jw | 최초 plan 작성 — M2 자유 위치 이어쓰기. research.md §6 접근 스케치 기반 태스크 분해(T1~T6), 결정 로그 D1~D4 확정, 리스크 분석(research.md §4), MX 태그 계획. TDD RED-first. |

## Overview

SPEC-AI-001/002 인프라 위에 자유 위치 이어쓰기(M2)를 얹는다. 신규성은 (1) lezer `syntaxTree` 기반 자격 게이트(코드베이스 최초의 구문 인지 위치 로직), (2) [뒤 문맥] 프롬프트 설계, (3) 2단 힌트 자격 정책 — 나머지는 전부 기존 경로 재사용이다.

- 개발 방법론: **TDD** (RED-GREEN-REFACTOR, 브라운필드 Pre-RED — 기존 자격/프롬프트 코드 선독)
- 신규 런타임 의존성: **없음** — `@codemirror/language ^6.12.1` 재사용
- 게이트 기준선: vitest 913 / cargo 221 / tsc 클린 / clippy 클린. `npm run lint`는 게이트 아님(eslint config 부재)

## Decision Log (본 SPEC에서 확정)

| ID | 질문 | 결정 | 근거 |
|----|------|------|------|
| **D1** | 타이핑 소멸 시 in-flight 요청도 취소하는가? | **예 — `ai_cancel` 연동, 토스트 없음** (REQ-AI3-013) | 현행은 `dismissGhostCommand`만 취소하고 타이핑 파괴 경로는 스트림이 백그라운드에서 계속 도는 누수성 동작(research.md §3.3, ghostStoreBridge 526행 `if (ghost)` 무시). 취소하면 토큰·프로세스 낭비 제거 + 동시 1개 상태 명료화. 타이핑 소멸은 Esc와 동급의 사용자 자발 종료이므로 REQ-AI-034(무통보 금지)의 명시적 예외로 문서화하고 토스트를 띄우지 않는다. |
| **D2** | ListItem/Blockquote 내부 정책 | **수동 `Mod+Enter` 허용 + 힌트 제외** (REQ-AI3-004). FencedCode/Table은 완전 배제(REQ-AI3-003) | 리스트 항목의 끊긴 문장 이어쓰기는 정당한 사용 사례이고 삽입 전용 고스트는 구조를 직접 파손하지 않는다. 반면 리스트는 체류 시간이 길어 힌트 스팸 위험이 높다 → 2단 자격의 중간 지대로 배치. 코드펜스/표는 AI 산출물이 구문을 깨기 쉬워 무손상 원칙(REQ-AI-033) 관점에서 보수적 완전 배제(research.md §3.2 옵션 (a)). |
| **D3** | 기존 문서 끝 테스트(aiContinueContext.test.ts:47-53 "문서 중간 빈 줄 → null") 일반화 전략 | **병행 전략 — 신규 자유 위치 판정 함수를 별도 신설, 기존 `getContinueContext`와 그 테스트는 무개정** (REQ-AI3-015) | 기존 함수는 "문서 끝 힌트 자격"으로 의미가 유지되고(우선순위 상위 경로), 자유 위치는 신규 함수가 담당. 기존 단언 913개를 건드리지 않아 하위호환 증명이 테스트 무변경으로 성립한다. `evaluateHintEligibility`에는 신규 자격을 최하위 우선순위로 추가만 한다. |
| **D4** | 절단 고지의 고스트 UI 표면화 | **범위 밖(Exclusion)** — `truncated` 릴레이만 유지(REQ-AI3-011) | 카드 경로에만 절단 고지가 있고 고스트에는 원래 없는 기존 갭(research.md §4.6). M2에서 [뒤 문맥] 절단으로 갭이 커지지만, 고스트 UI 신규 표면은 별도 UX 설계가 필요해 후속 SPEC으로 이관. spec.md Exclusions에 명시. |

## Task Decomposition

각 유닛은 "테스트 먼저(RED) → 최소 구현(GREEN) → 정리(REFACTOR)". 순서는 의존성 순(판정 → 힌트 → 트리거/IPC → Rust → D1 → e2e).

### T1. [NEW] 자유 위치 자격 판정 + syntaxTree 게이트 (프론트 순수 함수)

- 신규 판정 함수(예: `getFreeContinueContext(state, pos)`) — 반환에 `outline`/`contextBefore`(`sliceDoc(0, head)`)/`contextAfter`(`sliceDoc(head)`) 포함. 기존 `getContinueContext`는 무변경(D3).
- 구문 게이트 순수 함수(예: `isContinueBlockedNode(state, pos)`) — `syntaxTree(state).resolveInner(pos, -1)`로 FencedCode/CodeBlock/Table 조상 탐지 시 배제, ListItem/Blockquote는 "힌트만 배제" 플래그 반환(D2, 2단 자격 입력).
- **RED first**: `src/test/aiFreeContinue.test.ts` — `markdown()` 확장 포함 state로 자격 매트릭스(일반 문단 중간/줄 끝/코드펜스 내부/표 내부/리스트 내부/인용 내부/문서 끝/빈 문서). "배제 위치에서 aiRequest 미호출 = 토큰 0" 단언은 aiContinueContext.test.ts:23-84 패턴.
- Reference: `src/components/editor/extensions/ai-ghost-text.ts:80-92` (기존 판정), `src/test/aiContinueContext.test.ts:23-84` (매트릭스 패턴), research.md §3.2.
- 매핑: REQ-AI3-001, 002, 003, 004, 015.

### T2. [MODIFY] 힌트 2단 자격 정책

- `evaluateHintEligibility`(ai-ghost-text.ts:377-381)에 최하위 우선순위로 자유 위치 힌트 자격 추가 — 보수 조건: 비어있지 않은 줄의 줄 끝 + 문장 미종결(종결 부호 판정은 ai-suggestion-card.ts:435 선례) + T1 게이트 통과 + 힌트-배제 플래그 아님(D2).
- 3초 타이머·hide/재무장 로직(`AiHintPluginValue`)은 무변경 재사용.
- **RED first**: `src/test/aiHint.test.ts` 확장 — fake timer로 보수 조건 충족/미충족 매트릭스, 기존 케이스 무개정.
- Reference: `src/components/editor/extensions/ai-ghost-text.ts:431-500` (힌트 플러그인), `src/test/aiHint.test.ts` (fake timer 패턴).
- 매핑: REQ-AI3-005, 006, 007.

### T3. [MODIFY] 트리거 커맨드 일반화 + contextAfter 전달

- `startContinueWritingCommand`(ai-ghost-text.ts:323-346)를 일반화(또는 자유 위치 커맨드 신설 후 `modEnterCommand` 체인 351-352행 말미에 추가) — 자격 시 `aiRequest({feature:'section-fill', presetKind:'continue', outline, contextBefore, contextAfter})`. requestId `cw-` prefix + `startRequest` 선행 순서 유지(stale-event 가드, useAiRelay.ts:36-38).
- `ghostStoreBridge`·aiStore·ipc.ts **무변경 확인**(하위호환 경로 유지, `contextAfter`는 기존 필드).
- Mod+Enter 체인 폴스루 검증: 배제 위치에서 false 반환 → 기존 바인딩(있다면)으로 폴스루.
- **RED first**: aiFreeContinue.test.ts — mock aiRequest로 페이로드 계약(contextAfter 포함) 단언, 배제 위치 false 반환.
- Reference: `src/components/editor/extensions/ai-ghost-text.ts:323-346` (트리거 뼈대), `src/components/editor/extensions/ai-ghost-text.ts:514-558` (브리지 feature 필터 — @MX:NOTE 대상), `src/lib/tauri/ipc.ts:195-231` (`{ args }` 래핑 계약).
- 매핑: REQ-AI3-008, 012.

### T4. [MODIFY] Rust 프롬프트 — build_continue_prompt(outline, before, after)

- `build_continue_prompt`(prompt.rs:199-215)에 `after` 파라미터 추가, `truncate_head_at_paragraph`(prompt.rs:119-129) + 전용 상한 상수(예: `CONTINUE_HEAD_MAX`)로 절단, [뒤 문맥] 섹션 조립. 빈 after 시 섹션·지시 생략(기존 출력과 바이트 동일 — REQ-AI3-010).
- 시스템 지시 확장: "끊긴 문장부터 완성, 뒤 문맥으로 매끄럽게 연결, 뒤 문맥 반복·선점 금지"(뒤 문맥 존재 시 조건부). 기존 문체 상속 지시(prompt.rs:99-101) 유지.
- `mod.rs:125` continue 분기에서 `contextAfter` 전달. IPC 역직렬화 테스트(mod.rs:336-350 `request_args_deserialize_continue_preset_kind` 패턴)에 contextAfter 케이스 추가.
- **RED first**: prompt.rs `#[cfg(test)]`(217-524행 스타일) — [뒤 문맥] 조립·truncate_head 절단·빈 after 생략·금지 지시 포함 단언.
- Reference: `src-tauri/src/ai/prompt.rs:149-176` (`build_inline_prompt` 3섹션 패턴), `src-tauri/src/ai/prompt.rs:119-146` (truncate 헬퍼 쌍), `src-tauri/src/ai/mod.rs:122-127` (프롬프트 분기).
- 매핑: REQ-AI3-009, 010, 011.

### T5. [MODIFY] 타이핑 소멸 → in-flight 취소 (D1)

- 고스트 파괴 경로(effect 없는 docChanged, ai-ghost-text.ts:138)에서 해당 requestId의 in-flight 요청을 `aiCancel`로 취소. 확정 삽입 트랜잭션(clearGhostEffect 동승, 266-276행)은 파괴 경로를 우회하므로 오취소 없음 — 이 구분이 테스트 핵심.
- 토스트·배너 없음(D1). StateField `update` 안에서 부수효과 금지 — 취소 호출은 파괴 관찰 지점(브리지 subscribe 또는 update listener)에서 수행하는 설계로 Run phase 재량.
- **RED first**: aiFreeContinue.test.ts — 스트리밍 중 타이핑 트랜잭션 → 고스트 null + aiCancel 호출 1회; 확정 트랜잭션 → aiCancel 미호출.
- Reference: `src/components/editor/extensions/ai-ghost-text.ts:117-140` (파괴형 StateField), `ai-ghost-text.ts:266-289` (확정/지우기 경로), research.md §3.3.
- 매핑: REQ-AI3-013, 014.

### T6. [MODIFY] e2e 여정 + mock 계약

- Playwright(webkit): "문서 중간 클릭 → Mod+Enter → 고스트 스트리밍 → [✓ 넣기] → 뒤 문맥 원문 그대로" 여정(mock `success`), `hang` 시나리오로 타이핑 소멸+취소, `window.__AI_MOCK__.requests`로 contextAfter 페이로드 단언, 콘솔 에러 0 가드.
- Reference: `e2e/ai-inline-edit.spec.ts` (여정 패턴), `e2e/fixtures/tauri-v2-ai-mock.ts:10-18,74-79` (시나리오·`{ args }` 래핑 검증).
- 매핑: AC-AI3-001~004 e2e 커버.

## Risk Analysis (research.md §4)

| 리스크 | 완화 |
|--------|------|
| `ghostStoreBridge` feature 필터 하드코딩(524행) | feature 값 불변(`'section-fill'`) 유지로 원천 회피 + @MX:NOTE로 계약 명시 |
| `AiFeature::resolve` presetKind 키 충돌 | 신규 presetKind 없음(`'continue'` 재사용) — 충돌 불가 |
| 검토 중 제안 카드와 고스트 공존 | 동시 1개 계약(REQ-AI-008) 회귀 확인만 — in-flight만 취소, 카드 유지. 신규 UX 설계는 Exclusion |
| 기존 문서 끝 테스트 파괴 | D3 병행 전략 — 기존 함수·테스트 무변경 |
| stale-event 가드 순서 | `startRequest` 선행 순서를 T3 테스트로 고정 |
| 프롬프트 품질(뒤 문맥 반복·선점) | 프롬프트 지시로만 제어(프론트 후처리 선례 없음) — acceptance 수동 검증 항목으로 격리, 지시 포함 여부는 Rust 유닛으로 고정 |
| `truncated` 고지 갭 확대 | D4 범위 밖 명시 — 릴레이 계약만 회귀 확인 |
| StateField update 내 부수효과(D1 구현) | 취소 호출을 파괴 "관찰" 지점으로 분리(설계 노트) — dispatch 중 재진입 금지 |

## MX Tag Plan

`@MX:SPEC: SPEC-AI-003` 공통 부착, code_comments = ko.

| 위치 | 태그 | 사유 |
|------|------|------|
| 자유 위치 자격 판정 순수 함수(T1) | `@MX:ANCHOR` | 토큰 0 불변식 + 트리거 자격 단일 진입 계약 — 힌트·커맨드 양쪽이 호출(fan_in ≥ 2 예정) |
| syntaxTree 게이트 함수(T1) | `@MX:ANCHOR` | FencedCode/Table 배제·ListItem 힌트 제외 정책(D2)의 단일 판정 지점 |
| `build_continue_prompt`(T4) | `@MX:ANCHOR` | 3섹션 조립 + 반복·선점 금지 지시 계약, 빈 after 하위호환 |
| `ghostStoreBridge` feature 필터(ai-ghost-text.ts:524) | `@MX:NOTE` | `'section-fill'` 하드코딩 = 이어쓰기 하위호환 경로의 암묵 계약(변경 시 브리지·aiStore·ipc 동시 수정) |
| 타이핑 소멸→취소 연동 지점(T5) | `@MX:NOTE` | REQ-AI-034 무통보 금지의 명시적 예외(D1) 근거 기록 |

## Quality Gates

- `tsc --noEmit` 클린 / `vitest run` ≥913 통과(신규 포함 전량) / `cargo test` ≥221 통과 / `cargo clippy` 클린 / Playwright(webkit) 통과.
- `npm run lint`는 게이트 아님(eslint config 부재 — main 포함 상시 실패, 회귀 오판 금지).
- SPEC frontmatter 커밋 시 포맷터 손상 주의: 한 Bash 호출 내 checkout→edit→add(프로젝트 알려진 제약).
