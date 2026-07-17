---
id: SPEC-AI-005
version: "0.1.0"
status: draft
created: "2026-07-17"
updated: "2026-07-17"
author: "jw"
priority: high
issue_number: 19
dependencies:
  - SPEC-AI-001
  - SPEC-AI-002
  - SPEC-AI-003
tags:
  - ai
  - settings
  - toggle
  - editor
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-17 | jw | 최초 SPEC 작성 — AI 기능 사용자 켜기/끄기 토글. 사용자가 설정 모달에서 AI 표면 전체를 켜고 끌 수 있는 영속 토글. 꺼짐 = ✨·힌트·Mod+Enter 신규 트리거 전부 비활성 + 진행 중 요청 즉시 취소. 정책 잠금(REQ-AI-017)이 사용자 토글에 우선. research.md 확정 사실 6건 반영, 설계 결정 D1~D5 확정(plan.md Decision Log). TDD RED-first. |

## Summary

`mdedit`에 **AI 기능 전체를 사용자가 켜고 끌 수 있는 영속 토글**을 추가한다. 사용자가 설정 모달의 AI 섹션에서 토글을 끄면 편집기의 AI 표면 전체 — ✨ 선택 툴바, 3초 유휴 힌트 알약, `Mod+Enter` 신규 이어쓰기 트리거 — 가 즉시 사라지고, 진행 중인 요청은 취소되며, 어떤 AI 요청도 발원하지 않는다(토큰 0). 토글은 재시작 이후에도 유지된다(기본값 ON).

우선순위는 `effectiveAiEnabled = !policyDisabled && userAiEnabled`로, 조직 정책 잠금(REQ-AI-017)이 사용자 토글에 항상 우선한다. 정책 잠금 상태에서는 설정 모달의 사용자 토글이 비활성(disabled)+🔒으로 표시되며(`AdvancedModelToggle` 선례), 사용자 OFF 값은 정책과 독립적으로 저장되어 정책이 해제되어도 사용자 OFF가 유지된다.

상태는 `uiStore`의 zustand persist에 신규 필드로 얹으며(`aiAdvancedModel` 선례 복제), 편집기 표면 게이트는 **정책 미인지였던 기존 미비를 부수 해결**한다(research.md §2 — 현재는 정책 잠금이어도 ✨·힌트가 뜸). IPC·Rust·프롬프트는 무변경이다.

## Background & Rationale

- 배포 대상 기능(외부 안내 예정)으로, 사용자가 AI 표면 노출 자체를 통제할 수 있어야 한다는 요구에서 출발한다. 정책 kill-switch(조직 강제)와 별개로, 개인 사용자가 방해 없는 순수 편집 모드를 선택할 수 있는 경로가 없었다.
- 편집기 표면(✨ `ai-selection-toolbar.ts` `buildToolbarDecorations`, 힌트 `ai-ghost-text.ts` `evaluateHintEligibility`/`armTimer`, Mod+Enter `ai-ghost-text.ts` `modEnterCommand`)은 현재 `getUiState()`(`markdown-extensions.ts`)로 `loggedIn`/`advancedModel`만 조회하고 **정책은 인지하지 못한다**(research.md §2). 즉 정책 잠금 상태에서도 ✨·힌트가 뜨는 기존 미비가 존재한다. 본 SPEC의 공통 게이트가 이를 부수적으로 닫는다(회귀 테스트 추가 가치).
- 영속화 인프라는 이미 존재한다: `uiStore`(`src/store/uiStore.ts`)가 zustand persist(localStorage `mdedit-ui-store`)를 사용하고, `aiAdvancedModel` 선례가 상태·setter·partialize 패턴을 제공한다. partialize는 `statusMessage`만 제외하므로 신규 `aiEnabled: boolean`(기본 true)이 자동 영속된다(research.md §1).
- 취소 인프라도 완성되어 있다: Rust in-flight 1개 모델(`mod.rs`), `ai_cancel`(`mod.rs`)+`aiCancel`(`ipc.ts`)+aiStore `cancelRequest`(`aiStore.ts`), 고스트 정리 선례(`ai-ghost-text.ts`), 카드 정리 선례(`ai-suggestion-card.ts`) — OFF 부수효과는 이들을 조합만 한다(research.md §4).

## 사전 합의 설계 결정 (재검토 금지)

> 아래 항목 번호는 plan.md Decision Log(D1~D5)와 교차 대조된다. 각 항목 말미에 대응 D번호를 병기한다(내용은 plan.md Decision Log가 규범).

1. **끄기 범위 = AI 표면 전체 숨김**: ✨ 선택 툴바, 힌트 알약, `Mod+Enter` 신규 트리거 전부 비활성 + 진행 중 요청 즉시 취소. 일부 기능만 끄는 세분 옵션은 범위 밖(Exclusions). (→ plan.md **D3** 전체 정리 정책)
2. **우선순위 확정**: `effectiveAiEnabled = !policyDisabled && userAiEnabled`. 정책 잠금 시 설정 모달의 사용자 토글은 disabled+🔒(`AdvancedModelToggle` 선례). 사용자 OFF 값은 정책과 독립 저장(정책 해제돼도 사용자 OFF 유지). (→ plan.md **D2** 셀렉터·정책 주입)
3. **공통 셀렉터는 SettingsModal이 아닌 store/독립 모듈에 배치** — `ai-ghost-text.ts`가 SettingsModal의 `resolveModel`을 import하므로 순환 방지(research.md §6). (→ plan.md **D2** 셀렉터 배치)
4. **Rust/IPC/프롬프트 무변경** — 요청은 프론트에서만 발원하므로 프론트 게이트가 완전 차단이며, 정책 kill-switch(조직 강제)와 달리 이중 방어 불요. (→ plan.md **D4** Rust 미변경)
5. **OFF 시 전체 정리 정책** — in-flight 취소 + 활성 고스트/streaming·검토 중 카드 정리. 문서 본문은 무손상(삽입 전 산출물만 정리, REQ-AI-033과 무충돌). (→ plan.md **D3** 정리 정책, **D5** 정책 캐시 신선도)

> 상태 저장 위치·기본값(**D1**)과 정책 캐시 신선도(**D5**)는 위 항목의 배경 전제로, 상세는 plan.md Decision Log 참조.

## Environment & Assumptions

- SPEC-AI-001(M0+M1), SPEC-AI-002(대기 시각 피드백), SPEC-AI-003(M2 자유 위치 이어쓰기)이 main에 머지 완료. `uiStore` persist·✨ 툴바·힌트·고스트·카드·`ai_cancel`·aiStore 전부 가용.
- `uiStore`는 zustand persist(localStorage `mdedit-ui-store`)를 사용하며 partialize는 `statusMessage`만 제외한다 → 신규 `aiEnabled`가 자동 영속(research.md §1).
- 정책은 현재 Rust `ai_request` 진입과 SettingsModal 2곳만 인지한다(research.md §2). 편집기 표면은 정책 미인지 — 본 SPEC이 공통 게이트로 배선한다.
- 우클릭 AI 메뉴는 존재하지 않는다(FileTreeNode 파일 메뉴뿐) — 표면 인벤토리에서 제외(research.md §3).
- 테스트 선례: `SettingsModal.test.tsx`(정책 잠금·persist 토글 케이스 기존재, policyMock 패턴), `uiStore.test.ts`(persist 검증). e2e에 설정 모달 여정은 없음 — 신규 시 `ai-inline-edit.spec.ts` 패턴 준용(research.md §5).
- `npm run lint`는 eslint config 부재로 main 포함 항상 실패 — 게이트에서 제외(회귀 오판 금지).
- 신규 런타임 의존성 없음. IPC·Rust·프롬프트 무변경(D4).

## Requirements (EARS)

### 모듈 1 — 상태·영속 (uiStore)

#### Ubiquitous

- **REQ-AI5-001**: The system **shall** AI 기능 사용자 토글 상태를 `uiStore`의 영속(persist) 필드 `aiEnabled: boolean`으로 보관하고, 최초값(미설정 사용자)은 켜짐(true)으로 한다. [NEW: `src/store/uiStore.ts` — `aiAdvancedModel` 라인 복제(상태·`setAiEnabled` setter). partialize가 `statusMessage`만 제외하므로 자동 영속, research.md §1]
- **REQ-AI5-003**: The system **shall** 사용자 OFF 값을 조직 정책 상태와 독립적으로 저장하여, 정책 잠금이 해제되더라도 사용자가 명시적으로 켜기 전까지 사용자 OFF를 유지한다. [NEW: 정책은 `aiEnabled`에 기록하지 않음 — effective 계산 시점에만 합성(REQ-AI5-013)]

#### Event-Driven

- **REQ-AI5-002**: **WHEN** 애플리케이션이 재시작되어 persist 저장소에서 상태를 복원하면, **the system shall** 직전 세션의 `aiEnabled` 값을 그대로 복원하여 적용한다. [EXISTING: zustand persist(localStorage `mdedit-ui-store`) — 동작 상속 확인]

### 모듈 2 — 설정 UI (SettingsModal)

#### Event-Driven

- **REQ-AI5-004**: **WHEN** 사용자가 설정 모달의 AI 섹션을 열면, **the system shall** AI 기능 켜기/끄기 토글을 현재 `aiEnabled` 값을 반영하여 렌더한다. [MODIFY: SettingsModal AI 섹션 — 정책 인지 지점(기존)에 토글 UI 추가]
- **REQ-AI5-006**: **WHEN** 사용자가 토글을 조작(켜기/끄기)하면, **the system shall** `setAiEnabled`로 상태를 즉시 갱신하고 그 결과가 편집기 표면(모듈 3)과 부수효과(모듈 4)에 즉시 반영되도록 한다. [MODIFY: SettingsModal 토글 onChange → `setAiEnabled`]

#### State-Driven

- **REQ-AI5-005**: **WHILE** 조직 정책이 AI를 잠근 상태인 동안, **the system shall** 설정 모달의 사용자 토글을 비활성(disabled) 상태로 렌더하고 잠금 아이콘(🔒)을 함께 표시하여 사용자 조작이 정책을 우회할 수 없음을 알린다(`AdvancedModelToggle` 선례). [MODIFY: SettingsModal — 정책 잠금 시 토글 disabled+🔒]

### 모듈 3 — 표면 게이트 (편집기)

#### State-Driven

- **REQ-AI5-007**: **WHILE** `effectiveAiEnabled`(REQ-AI5-013)가 거짓인 동안, **the system shall** ✨ 선택 툴바 데코레이션을 렌더하지 않는다(빈 데코레이션 반환). [MODIFY: `buildToolbarDecorations`(`ai-selection-toolbar.ts`) 최상단 조기 return]
- **REQ-AI5-008**: **WHILE** `effectiveAiEnabled`가 거짓인 동안, **the system shall** 3초 유휴 이어쓰기 힌트 알약을 표시하지 않는다(자격 판정 조기 부정). [MODIFY: `evaluateHintEligibility`(또는 `armTimer`) 조기 return(`ai-ghost-text.ts`)]

#### Unwanted Behaviour

- **REQ-AI5-009**: **IF** `effectiveAiEnabled`가 거짓인 상태에서 사용자가 `Mod+Enter`로 신규 이어쓰기를 트리거하려 하면, **then the system shall** 신규 트리거를 거부(false 반환)하여 다음 키 바인딩으로 폴스루하고, 어떤 AI 요청도 발생시키지 않는다(토큰 0). [MODIFY: `modEnterCommand`의 신규 트리거 분기만 차단 — 이미 활성인 고스트의 확정([넣기])은 모듈 4의 정리 정책이 담당]

#### Event-Driven

- **REQ-AI5-010**: **WHEN** 사용자가 토글을 다시 켜면(`effectiveAiEnabled`가 참으로 전이), **the system shall** ✨ 툴바·힌트·`Mod+Enter` 신규 트리거를 즉시 재활성화하며, 재활성화를 위한 재시작이나 문서 재로드를 요구하지 않는다. [MODIFY: 게이트가 반응형으로 `getUiState().enabled`를 조회]

### 모듈 4 — OFF 부수효과 (정리)

#### Event-Driven

- **REQ-AI5-011**: **WHEN** 사용자 토글이 켜짐에서 꺼짐으로 전이하면, **the system shall** 진행 중(in-flight)인 AI 요청을 취소(`ai_cancel`+`cancelRequest`)하고, 활성 고스트 텍스트와 streaming·검토 중 제안 카드를 모두 정리한다. [NEW: OFF 부수효과 헬퍼 — 취소는 `aiCancel`(`ipc.ts`)+aiStore `cancelRequest`, 고스트 정리는 `clearGhostEffect` 선례, 카드 정리는 `getCardControllers()` 선례(research.md §4)]

#### Ubiquitous

- **REQ-AI5-012**: The system **shall** OFF 부수효과 정리 과정에서 편집기 문서 본문을 변경하지 않는다 — 아직 삽입되지 않은 AI 산출물(고스트·검토 중 카드 제안)만 폐기하며, 이미 문서에 삽입·확정된 내용은 한 글자도 건드리지 않는다. 이는 SPEC-AI-001의 **무손상 원칙(REQ-AI-033)** 을 근거로 하며, 삽입 전 산출물만 폐기하므로 REQ-AI-033과 충돌하지 않는다. [NEW: 정리 헬퍼는 삽입 전 산출물에만 작용]

### 모듈 5 — 정책 우선

#### Ubiquitous

- **REQ-AI5-013**: The system **shall** 표면 게이트가 참조하는 실효값을 `effectiveAiEnabled = !policyDisabled && userAiEnabled`로 계산하여, 정책 잠금과 사용자 토글 중 하나라도 비활성이면 AI 표면을 숨긴다. [NEW: 공통 셀렉터 — `getUiState()`에 `enabled`(=effective) 필드 추가가 단일 배선 지점. 셀렉터는 store/독립 모듈 배치(D3, 순환 방지)]

#### State-Driven

- **REQ-AI5-014**: **WHILE** 조직 정책이 AI를 잠근 상태인 동안, **the system shall** 사용자 토글 값과 무관하게 편집기 표면(✨·힌트·`Mod+Enter` 신규 트리거)을 숨긴다 — 이는 정책 잠금 시에도 ✨·힌트가 뜨던 기존 미비를 부수적으로 수정한다(research.md §2). [MODIFY: 공통 게이트가 정책도 인지 — 기존 표면은 정책 미인지였음]

### 모듈 6 — 하위호환·기존 동작 보존

#### Ubiquitous

- **REQ-AI5-015**: The system **shall** 기본값이 켜짐(ON)이므로 토글을 조작하지 않은 기존 사용자의 관찰 가능한 동작(✨·힌트·이어쓰기 흐름)을 변경 없이 유지하고, IPC·Rust·프롬프트를 변경하지 않으며, 기존 테스트를 개정 없이 통과시킨다. [EXISTING: IPC/Rust/prompt 무변경(D4) — 프론트 게이트만 추가]

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [MODIFY] | `src/store/uiStore.ts` | `aiEnabled: boolean`(기본 true) 상태 + `setAiEnabled` setter 신설(`aiAdvancedModel` 라인 복제). partialize 무변경(자동 영속) |
| [NEW] | 공통 셀렉터 모듈(store 또는 독립 모듈) | `getAiPolicyDisabled()` 정책 캐시 싱글턴(`getAiLoggedIn` 동형) + `effectiveAiEnabled` 계산. SettingsModal 비의존(D3 순환 방지) |
| [MODIFY] | `src/components/layout/AppLayout.tsx` | 부팅 시 `aiPolicyStatus()` 호출 결과를 정책 캐시에 세팅(`getAiLoggedIn` 세팅 선례 옆) |
| [MODIFY] | `src/components/editor/extensions/markdown-extensions.ts` | `getUiState()`에 `enabled`(=effective) 필드 추가 — 표면 게이트의 단일 배선 지점 |
| [MODIFY] | `src/components/editor/extensions/ai-selection-toolbar.ts` | `buildToolbarDecorations` 최상단 `enabled` 거짓 시 빈 데코레이션 조기 return |
| [MODIFY] | `src/components/editor/extensions/ai-ghost-text.ts` | `evaluateHintEligibility`(또는 `armTimer`) 조기 return + `modEnterCommand` 신규 트리거 분기 차단(확정 분기 불변) |
| [MODIFY] | `src/components/settings/SettingsModal.*` | AI 섹션에 토글 UI + 정책 잠금 시 disabled+🔒 + onChange→`setAiEnabled` |
| [NEW] | OFF 부수효과 헬퍼 | `setAiEnabled(false)` 전이 시 in-flight 취소 + 고스트/카드 정리(문서 무변경) |
| [EXISTING] | `src-tauri/**`, `src/lib/tauri/ipc.ts`(계약), `aiStore.ts` 취소 경로 | 무변경 — 프론트 게이트만으로 완전 차단(D4) |
| [NEW] | `src/test/aiToggle.test.ts`(가칭) | 게이트 4지점 OFF 매트릭스(✨/힌트/Mod+Enter/요청0) + OFF 부수효과 취소 |
| [MODIFY] | `src/test/uiStore.test.ts` | `aiEnabled` persist·기본값 케이스 추가(기존 무개정) |
| [MODIFY] | `src/test/SettingsModal.test.tsx` | 토글 렌더·정책 disabled·클릭 반영 케이스 추가(기존 무개정) |
| [NEW] | `e2e/ai-toggle.spec.ts`(가칭) | webkit 1여정(설정 열기→OFF→표면 소멸→Mod+Enter 무반응→ON→복귀) |

## Acceptance Criteria 매핑

> acceptance.md의 Given-When-Then과 대응. REQ-AI5-001~015 전 요구사항이 최소 1개 AC에 매핑된다.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-AI5-001 | REQ-AI5-007, 008, 009 | 토글 OFF → ✨/힌트/Mod+Enter 신규 트리거 전부 비활성 + aiRequest 미호출(토큰 0) |
| AC-AI5-002 | REQ-AI5-001, 002 | persist 영속 + 재시작 유지 + 기본값 ON |
| AC-AI5-003 | REQ-AI5-004, 006 | 설정 모달 토글 렌더 + 클릭 즉시 반영 |
| AC-AI5-004 | REQ-AI5-005, 013, 014 | 정책 잠금 → 토글 disabled+🔒 + 사용자 값과 무관하게 표면 숨김 |
| AC-AI5-005 | REQ-AI5-011, 012 | OFF 부수효과 — in-flight 취소 1회 + 고스트/카드 정리 + 문서 본문 무변경 |
| AC-AI5-006 | REQ-AI5-010 | ON 복귀 → ✨/힌트/Mod+Enter 즉시 재활성(재시작 불요) |
| AC-AI5-007 | REQ-AI5-003 | 사용자 OFF 값이 정책과 독립 저장(정책 해제돼도 OFF 유지) |
| AC-AI5-008 | REQ-AI5-015 | 하위호환 — 기본 ON, 기존 테스트 무개정 통과, IPC·Rust 무변경 |

## mx_plan

code_comments = ko (`language.yaml`). `@MX:SPEC: SPEC-AI-005` 공통 부착.

| 위치 | 태그 | 사유 |
|------|------|------|
| 공통 셀렉터(effective 계산 함수) | `@MX:ANCHOR` | 전 표면 게이트의 단일 판정 계약(REQ-AI5-013), ✨·힌트·Mod+Enter·`getUiState()`가 호출(fan_in ≥ 4 예정) |
| OFF 부수효과 헬퍼 | `@MX:NOTE` | 전체 정리 정책(D5)의 근거·문서 무손상 계약 기록(REQ-AI5-011/012) |

## Exclusions (What NOT to Build)

- **힌트만 끄기 등 세분 옵션** — 기능별(프리셋별) 개별 토글은 범위 밖(전체 숨김 정책, 사전 합의 1).
- **Rust 측 토글 저장** — 요청은 프론트에서만 발원하므로 프론트 게이트가 완전 차단, Rust 무변경(D4).
- **단축키 커스터마이즈** — `Mod+Enter` 등 트리거 키 변경 UI 없음.
- **기능별(프리셋별) 개별 토글** — 인라인 편집/섹션 채우기/이어쓰기 개별 온오프 없음.
- **정책 파일 편집 UI** — 조직 정책 잠금은 읽기 전용, 사용자가 편집하는 표면 없음.
- **온보딩 문구 개정** — 토글 안내 툴팁 1줄은 허용하되 온보딩 전면 개정은 범위 밖.
- **신규 의존성** — npm/cargo 추가 없음.
