---
id: SPEC-AI-005
version: "0.1.0"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 19
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | jw | 최초 plan 작성 — AI 기능 사용자 켜기/끄기 토글. research.md 확정 사실 기반 태스크 분해(T1~T6), 결정 로그 D1~D5 확정, 리스크 분석, MX 태그 계획. TDD RED-first. |

## Overview

SPEC-AI-001/002/003 인프라 위에 AI 표면 전체 켜기/끄기 토글을 얹는다. 신규성은 (1) 편집기 표면의 공통 게이트(정책 미인지였던 기존 미비 부수 해결), (2) `effectiveAiEnabled` 합성 셀렉터, (3) OFF 부수효과(취소+정리) — 나머지 상태·영속·취소 인프라는 전부 기존 경로 재사용이다.

- 개발 방법론: **TDD** (RED-GREEN-REFACTOR, 브라운필드 Pre-RED — 기존 표면 게이트·uiStore·SettingsModal 코드 선독)
- 신규 런타임 의존성: **없음**
- IPC·Rust·프롬프트: **무변경**(D4)
- 게이트 기준선: vitest 939 / cargo 235(무변경) / tsc 클린 / clippy 클린. `npm run lint`는 게이트 아님(eslint config 부재)

## Decision Log (본 SPEC에서 확정)

| ID | 질문 | 결정 | 근거 |
|----|------|------|------|
| **D1** | 상태 저장 위치·기본값 | **`uiStore` persist `aiEnabled: boolean`, 기본 true, `setAiEnabled` setter** (REQ-AI5-001) | `uiStore`가 이미 zustand persist(localStorage `mdedit-ui-store`)를 쓰고 `aiAdvancedModel` 선례가 상태·setter·partialize 패턴을 제공한다. partialize는 `statusMessage`만 제외하므로 신규 필드가 자동 영속(research.md §1). 기본 ON은 하위호환(REQ-AI5-015)의 전제. |
| **D2** | 공통 셀렉터 배치·정책 주입 | **정책 캐시 `getAiPolicyDisabled()` 싱글턴(`getAiLoggedIn` 동형) + `AppLayout`에서 `aiPolicyStatus()` 세팅. `getUiState()`에 `enabled`(=effective) 필드 추가가 단일 배선 지점. 셀렉터는 store/독립 모듈** (REQ-AI5-013) | 편집기 표면은 `getUiState()`(`markdown-extensions.ts`)로만 상태를 조회하므로 여기에 `enabled` 한 필드를 추가하면 ✨·힌트·Mod+Enter가 동시에 게이트된다(단일 배선). 정책 캐시는 `getAiLoggedIn` 선례(`ai-suggestion-card.ts`)와 동형으로 stale 수용. 셀렉터를 SettingsModal에 두면 `ai-ghost-text.ts→resolveModel` import와 순환하므로 store/독립 모듈 배치(research.md §6). |
| **D3** | 게이트 4지점 중 확정(confirmGhostCommand)·진행 중 고스트 [넣기] 처리 | **OFF 시 전체 정리 정책 — 신규 트리거만 차단하고, 진행 중 산출물은 부수효과(모듈 4)가 취소·정리** (REQ-AI5-009/011) | "전체 숨김"의 일관성. 설정 모달에서의 의도적·저빈도 조작이므로 생성물 소실을 수용한다. 문서 본문은 무손상(삽입 전 산출물만 정리, REQ-AI-033과 무충돌). 확정 커맨드 분기 자체를 조건 분기로 오염시키기보다 상태 전이 시 일괄 정리가 단순하다. |
| **D4** | Rust 측 이중 방어 | **미변경 — 프론트 게이트=완전 차단** (REQ-AI5-015) | 요청은 프론트에서만 발원하므로 프론트 게이트가 요청 0을 보장한다(research.md 리스크 1). 정책 kill-switch(조직 강제)와 달리 사용자 토글은 개인 편의 기능이라 Rust/IPC/prompt 이중 방어가 불요. 무변경으로 cargo 235 기준선 유지. |
| **D5** | 정책 캐시 신선도 | **stale 캐시 수용 — 부팅 + 설정 모달 열람 시 갱신** (REQ-AI5-013) | `getAiLoggedIn`과 동일한 한계·기존 수용 선례. 정책 변경은 저빈도이며, 설정 모달 열람 시 재조회로 최신화된다. 실시간 폴링은 비용 대비 이득 없음. |

## Task Decomposition

각 유닛은 "테스트 먼저(RED) → 최소 구현(GREEN) → 정리(REFACTOR)". 순서는 의존성 순(상태 → 셀렉터/배선 → 게이트 → UI → 부수효과 → e2e).

### T1. [MODIFY] uiStore 상태 + persist

- `uiStore`에 `aiEnabled: boolean`(기본 true) + `setAiEnabled(v)` 추가 — `aiAdvancedModel` 라인 복제. partialize는 무변경(자동 영속 확인).
- **RED first**: `src/test/uiStore.test.ts` 확장 — persist 라운드트립(`aiEnabled` 저장·복원), 기본값 true(미설정 사용자), setter 갱신. 기존 케이스 무개정.
- Reference: `src/store/uiStore.ts`(`aiAdvancedModel` 상태·setter·partialize), `src/test/uiStore.test.ts`(persist 검증 패턴).
- 매핑: REQ-AI5-001, 002, 003.

### T2. [NEW] 공통 셀렉터 + AppLayout 정책 주입 + getUiState 배선

- 정책 캐시 `getAiPolicyDisabled()`/`setAiPolicyDisabled()` 싱글턴(`getAiLoggedIn`/`setAiLoggedIn` 동형, store 또는 독립 모듈 — SettingsModal 비의존, D2/D3).
- `AppLayout`에서 부팅 시 `aiPolicyStatus()` 결과를 정책 캐시에 세팅(`getAiLoggedIn` 세팅 지점 옆).
- `getUiState()`(`markdown-extensions.ts`)에 `enabled = !getAiPolicyDisabled() && useUiStore.getState().aiEnabled` 필드 추가.
- **RED first**: `src/test/aiToggle.test.ts`(가칭) — effective 계산 진리표(정책×사용자 4조합), 셀렉터가 정책·사용자 둘 중 하나 거짓이면 false.
- Reference: `getAiLoggedIn` 싱글턴 선례(`ai-suggestion-card.ts`), `AppLayout.tsx`(`aiPolicyStatus()` 호출 지점), `markdown-extensions.ts`(`getUiState()`).
- 매핑: REQ-AI5-013, 014.

### T3. [MODIFY] 표면 게이트 4지점

- `buildToolbarDecorations`(`ai-selection-toolbar.ts`) 최상단: `!enabled`면 빈 데코레이션 반환(✨ 미렌더).
- `evaluateHintEligibility`(또는 `armTimer`, `ai-ghost-text.ts`): `!enabled`면 조기 부정(힌트 미표시).
- `modEnterCommand`(`ai-ghost-text.ts`): 신규 이어쓰기 트리거 분기 진입 전 `!enabled`면 false 반환(폴스루, 요청 0). **확정 분기(진행 중 고스트 [넣기])는 차단하지 않음** — 정리는 T5가 담당(D3).
- **RED first**: aiToggle.test.ts — OFF 매트릭스(✨ 데코 없음/힌트 없음/Mod+Enter false/aiRequest 호출 0=토큰 0), ON 복귀 시 즉시 재활성(재시작 불요).
- Reference: `ai-selection-toolbar.ts`(`buildToolbarDecorations`), `ai-ghost-text.ts`(`evaluateHintEligibility`/`armTimer`/`modEnterCommand`), 토큰 0 단언 패턴(`aiContinueContext.test.ts`).
- 매핑: REQ-AI5-007, 008, 009, 010.

### T4. [MODIFY] SettingsModal 토글 UI

- AI 섹션(정책 인지 지점 기존재)에 토글 추가 — 현재 `aiEnabled` 반영, onChange→`setAiEnabled`. 정책 잠금 시 disabled+🔒(`AdvancedModelToggle` 선례). 토글 안내 툴팁 1줄 허용(Exclusions 예외).
- **RED first**: `src/test/SettingsModal.test.tsx` 확장 — 토글 렌더(현재값 반영), 정책 잠금 시 disabled+🔒(policyMock 패턴), 클릭 시 `setAiEnabled` 호출·상태 반영. 기존 케이스 무개정.
- Reference: `SettingsModal.*`(정책 인지·`AdvancedModelToggle` 선례), `SettingsModal.test.tsx`(policyMock 패턴).
- 매핑: REQ-AI5-004, 005, 006.

### T5. [NEW] OFF 부수효과 (취소 + 정리, 문서 무변경)

- `setAiEnabled(false)` 전이 부수효과 헬퍼: in-flight 취소(`aiCancel`(`ipc.ts`)+aiStore `cancelRequest`) + 활성 고스트 정리(`clearGhostEffect` 선례) + streaming/검토 중 카드 정리(`getCardControllers()` 선례). 문서 본문은 무변경(삽입 전 산출물만).
- 전이 관찰 지점(store subscribe 또는 setter 래핑)에서 수행 — dispatch 중 재진입 금지 유의.
- **RED first**: aiToggle.test.ts — ON→OFF 전이 시 취소 1회 호출 + 고스트/카드 정리 + 문서 텍스트 바이트 동일(무변경) 단언. OFF→OFF·이미 없는 상태에서 오취소 없음.
- Reference: `ai_cancel`(`mod.rs`)+`aiCancel`(`ipc.ts`)+`cancelRequest`(`aiStore.ts`), 고스트 정리(`ai-ghost-text.ts`), 카드 정리·`getCardControllers()`(`ai-suggestion-card.ts`).
- 매핑: REQ-AI5-011, 012.

### T6. [NEW] e2e 여정 + 하위호환 확인

- Playwright(webkit) 1여정: 설정 열기 → 토글 OFF → ✨/힌트 사라짐 → `Mod+Enter` 무반응 → 토글 ON → 표면 복귀, 콘솔 에러 0. `ai-inline-edit.spec.ts` 패턴 준용.
- 하위호환: 기존 vitest 939·cargo 235 무개정 통과 확인(기본 ON), package.json/Cargo.toml diff 없음.
- Reference: `e2e/ai-inline-edit.spec.ts`(여정 패턴), `e2e/fixtures/tauri-v2-ai-mock.ts`(mock).
- 매핑: AC-AI5-001·006 e2e 커버, REQ-AI5-015.

## Risk Analysis (research.md)

| 리스크 | 완화 |
|--------|------|
| 순환 import(`ai-ghost-text.ts→SettingsModal.resolveModel`) | 공통 셀렉터를 store/독립 모듈에 배치(D2/D3, research.md §6) |
| 정책 미인지 기존 표면(정책 잠금이어도 ✨·힌트 노출) | 공통 게이트가 정책도 인지 → 부수 수정(REQ-AI5-014), 회귀 테스트로 고정 |
| 프론트만 게이트 시 요청 누수 | 요청은 프론트 발원뿐 → 프론트 게이트=완전 차단(D4, research.md 리스크 1). aiRequest 호출 0 단언으로 검증 |
| 진행 중 고스트/카드 소실 사용자 인지 | 설정 모달 저빈도·의도적 조작이므로 수용(D3). 문서 본문은 무손상(REQ-AI5-012) |
| stale 정책 캐시 | `getAiLoggedIn`과 동일 한계 수용 — 부팅+모달 열람 시 갱신(D5) |
| store subscribe 부수효과 재진입 | 취소·정리를 전이 관찰 지점으로 분리, dispatch 중 재진입 금지(T5 설계 노트) |
| 기존 테스트 파괴 | 기본 ON + 게이트는 추가만 → 기존 관찰 동작 무변경, 무개정 통과(REQ-AI5-015) |

## MX Tag Plan

`@MX:SPEC: SPEC-AI-005` 공통 부착, code_comments = ko.

| 위치 | 태그 | 사유 |
|------|------|------|
| 공통 셀렉터 effective 계산 함수(T2) | `@MX:ANCHOR` | 전 표면 게이트의 단일 판정 계약(REQ-AI5-013) — ✨·힌트·Mod+Enter·`getUiState()`가 호출(fan_in ≥ 4 예정) |
| OFF 부수효과 헬퍼(T5) | `@MX:NOTE` | 전체 정리 정책(D3/D5)의 근거·문서 무손상 계약 기록(REQ-AI5-011/012) |

## Quality Gates

- `tsc --noEmit` 클린 / `vitest run` ≥939 통과(신규 포함 전량) / `cargo test` 235 통과(무변경 확인) / `cargo clippy` 클린 / Playwright(webkit) 통과 + 콘솔 에러 0.
- Rust 코드 무변경이므로 cargo 신규 테스트 없음(D4).
- `npm run lint`는 게이트 아님(eslint config 부재 — main 포함 상시 실패, 회귀 오판 금지).
- SPEC frontmatter 커밋 시 포맷터 손상 주의: 한 Bash 호출 내 checkout→edit→add(프로젝트 알려진 제약).
