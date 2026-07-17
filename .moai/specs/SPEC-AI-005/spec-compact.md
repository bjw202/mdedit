---
id: SPEC-AI-005
version: "0.1.0"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 19
generated_from: spec.md
---

# SPEC-AI-005 Compact — AI 기능 사용자 켜기/끄기 토글

> Run phase용 압축본. 원본: spec.md / plan.md / acceptance.md / research.md.
> 설정 모달에서 AI 표면 전체를 켜고 끄는 영속 토글. OFF = ✨·힌트·Mod+Enter 신규 트리거 전부 비활성 + in-flight 취소 + 고스트/카드 정리(문서 무손상). 우선순위 `effective = !policyDisabled && userAiEnabled`. 정책 잠금 시 토글 disabled+🔒. 상태는 uiStore persist(`aiEnabled` 기본 true, 자동 영속). IPC·Rust·프롬프트 무변경. 방법론 TDD.

## Requirements (EARS)

### 모듈 1 — 상태·영속

- **REQ-AI5-001** (U): `uiStore` persist `aiEnabled: boolean`, 최초값 true. `aiAdvancedModel` 라인 복제, partialize 무변경(자동 영속).
- **REQ-AI5-002** (E): WHEN 재시작 복원, 직전 세션 `aiEnabled` 그대로 적용.
- **REQ-AI5-003** (U): 사용자 OFF 값은 정책과 독립 저장 — 정책 해제돼도 OFF 유지(정책은 effective 계산 시점에만 합성).

### 모듈 2 — 설정 UI

- **REQ-AI5-004** (E): WHEN AI 섹션 열림, 현재 `aiEnabled` 반영 토글 렌더.
- **REQ-AI5-005** (S): WHILE 정책 잠금, 토글 disabled+🔒(`AdvancedModelToggle` 선례).
- **REQ-AI5-006** (E): WHEN 토글 조작, `setAiEnabled` 즉시 갱신 → 표면·부수효과 즉시 반영.

### 모듈 3 — 표면 게이트

- **REQ-AI5-007** (S): WHILE effective 거짓, `buildToolbarDecorations` 빈 데코 조기 return(✨ 미렌더).
- **REQ-AI5-008** (S): WHILE effective 거짓, `evaluateHintEligibility`/`armTimer` 조기 return(힌트 미표시).
- **REQ-AI5-009** (Un): IF effective 거짓 + Mod+Enter 신규 트리거, then false 폴스루 + 요청 0(토큰 0). 확정 분기는 불변.
- **REQ-AI5-010** (E): WHEN 재점등(effective 참 전이), ✨/힌트/Mod+Enter 즉시 재활성(재시작 불요).

### 모듈 4 — OFF 부수효과

- **REQ-AI5-011** (E): WHEN ON→OFF 전이, in-flight `ai_cancel`+`cancelRequest` + 활성 고스트·streaming/검토 카드 정리.
- **REQ-AI5-012** (U): 정리 중 문서 본문 무변경 — 삽입 전 산출물만 폐기(REQ-AI-033 무충돌).

### 모듈 5 — 정책 우선

- **REQ-AI5-013** (U): `effective = !policyDisabled && userAiEnabled`. 공통 셀렉터, `getUiState().enabled` 단일 배선. 셀렉터는 store/독립 모듈(순환 방지).
- **REQ-AI5-014** (S): WHILE 정책 잠금, 사용자 값 무관하게 표면 숨김 — 기존 정책 미인지 미비 부수 수정.

### 모듈 6 — 하위호환

- **REQ-AI5-015** (U): 기본 ON → 미조작 사용자 관찰 동작 무변경. IPC·Rust·프롬프트 무변경, 기존 테스트 무개정.

## Acceptance (요약)

| AC | 내용 |
|----|------|
| AC-AI5-001 | OFF → ✨/힌트/Mod+Enter 신규 트리거 전부 비활성 + aiRequest 호출 0(토큰 0) |
| AC-AI5-002 | persist 영속 + 재시작 유지 + 기본 ON |
| AC-AI5-003 | 설정 모달 토글 렌더 + 클릭 즉시 반영 |
| AC-AI5-004 | 정책 잠금 → disabled+🔒 + 사용자 값 무관 표면 숨김 |
| AC-AI5-005 | OFF 부수효과 취소 1회 + 고스트/카드 정리 + 문서 본문 무변경 |
| AC-AI5-006 | ON 복귀 → 즉시 재활성(재시작 불요) |
| AC-AI5-007 | 사용자 OFF 값 정책과 독립 저장(정책 해제돼도 OFF 유지) |
| AC-AI5-008 | 하위호환 — 기본 ON, 기존 테스트 무개정, IPC·Rust 무변경 |

## Files to Modify

| Delta | 파일 | 요지 |
|-------|------|------|
| [MODIFY] | `src/store/uiStore.ts` | `aiEnabled`(기본 true)+`setAiEnabled`(`aiAdvancedModel` 복제), partialize 무변경 |
| [NEW] | 공통 셀렉터 모듈 | `getAiPolicyDisabled()` 캐시 싱글턴 + `effective` 계산, SettingsModal 비의존(순환 방지) |
| [MODIFY] | `src/components/layout/AppLayout.tsx` | 부팅 시 `aiPolicyStatus()` → 정책 캐시 세팅(`getAiLoggedIn` 선례 옆) |
| [MODIFY] | `markdown-extensions.ts` | `getUiState()`에 `enabled`(=effective) 필드 추가(단일 배선) |
| [MODIFY] | `ai-selection-toolbar.ts` | `buildToolbarDecorations` 최상단 조기 return |
| [MODIFY] | `ai-ghost-text.ts` | `evaluateHintEligibility`/`armTimer` 조기 return + `modEnterCommand` 신규 트리거 차단(확정 불변) |
| [MODIFY] | `SettingsModal.*` | AI 섹션 토글 + 정책 disabled+🔒 + onChange→`setAiEnabled` |
| [NEW] | OFF 부수효과 헬퍼 | 취소 + 고스트/카드 정리(문서 무변경) |
| [NEW] | `src/test/aiToggle.test.ts` | 게이트 4지점 OFF 매트릭스 + 취소 |
| [MODIFY] | `uiStore.test.ts`, `SettingsModal.test.tsx`, `e2e/ai-toggle.spec.ts` | persist·토글·정책 disabled 케이스 + webkit 1여정(기존 무개정) |

## Exclusions

힌트만 끄기 세분 옵션 / Rust 측 토글 저장 / 단축키 커스터마이즈 / 기능별 개별 토글 / 정책 파일 편집 UI / 온보딩 전면 개정(툴팁 1줄은 허용) / 신규 의존성.

## Gates

tsc 클린 / vitest ≥939 기준선+신규 / cargo test 235(무변경) / clippy 클린 / Playwright(webkit) + 콘솔 에러 0. **lint는 게이트 아님**(eslint config 부재). Rust 무변경이므로 cargo 신규 테스트 없음.
