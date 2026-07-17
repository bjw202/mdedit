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
| 0.1.0 | 2026-07-17 | jw | 최초 acceptance 작성 — AI 기능 사용자 토글. 핵심 시나리오 8건 + 엣지 케이스 + 품질 게이트 + DoD. |

# Acceptance Criteria — SPEC-AI-005 (AI 기능 사용자 켜기/끄기 토글)

검증 방식:
- **vitest(jsdom)**: uiStore persist 라운드트립·기본값, effective 계산 진리표, 게이트 4지점 OFF 매트릭스(`markdown()` 확장 포함 headless `EditorState`, 기존 aiHint/aiFreeContinue/toolbar 패턴 재사용), OFF 시 `aiRequest` 미호출(토큰 0), OFF 부수효과 취소 1회. 선례: `uiStore.test.ts`, `SettingsModal.test.tsx`, `aiContinueContext.test.ts`, `aiHint.test.ts`.
- **SettingsModal(RTL)**: 토글 렌더(현재값 반영), 정책 잠금 시 disabled+🔒(policyMock 패턴), 클릭 시 `setAiEnabled` 호출·상태 반영.
- **Playwright(webkit)**: `ai-inline-edit.spec.ts` 패턴으로 설정 열기→OFF→표면 소멸→Mod+Enter 무반응→ON→복귀 1여정 + 콘솔 에러 0. Tauri IPC 실물 스폰은 실행되지 않음(기존 제약).
- Rust 코드 무변경이므로 cargo 신규 테스트 없음(D4) — 기준선 235 무개정 통과만 확인.

## 핵심 시나리오

### AC-AI5-001: 토글 OFF → 표면 전체 비활성 + 토큰 0 (REQ-AI5-007, 008, 009)

- **Given** AI 토글이 켜진 상태에서 편집기에 ✨ 툴바·힌트·이어쓰기가 정상 동작할 때
- **When** 사용자가 설정에서 토글을 끄면(`effectiveAiEnabled` 거짓)
- **Then** 텍스트를 선택해도 ✨ 선택 툴바가 렌더되지 않고, 3초 이상 멈춰도 이어쓰기 힌트 알약이 표시되지 않으며, `Mod+Enter` 신규 이어쓰기 트리거는 false를 반환해 다음 바인딩으로 폴스루한다.
- **And** 위 어떤 조작에서도 **`aiRequest`가 한 번도 호출되지 않는다**(토큰 0 — mock 호출 카운트 0 단언).

### AC-AI5-002: persist 영속 + 재시작 유지 + 기본 ON (REQ-AI5-001, 002)

- **Given** 최초 실행(사용자가 토글을 조작한 적 없는) 상태일 때
- **When** `uiStore`를 조회하면
- **Then** `aiEnabled`의 기본값은 켜짐(true)이다.
- **When** 사용자가 토글을 끄고 애플리케이션을 재시작하면
- **Then** persist 저장소(localStorage `mdedit-ui-store`)에서 `aiEnabled=false`가 복원되어 꺼짐 상태가 유지된다.

### AC-AI5-003: 설정 모달 토글 렌더 + 클릭 반영 (REQ-AI5-004, 006)

- **Given** 사용자가 설정 모달의 AI 섹션을 열었을 때
- **Then** 현재 `aiEnabled` 값을 반영한 AI 기능 켜기/끄기 토글이 렌더된다.
- **When** 사용자가 토글을 클릭하면
- **Then** `setAiEnabled`가 호출되어 상태가 즉시 갱신되고, 그 결과가 편집기 표면(모듈 3)에 즉시 반영된다.

### AC-AI5-004: 정책 잠금 우선 — disabled+🔒 + 표면 숨김 (REQ-AI5-005, 013, 014)

- **Given** 조직 정책이 AI를 잠근 상태일 때
- **When** 사용자가 설정 모달을 열면
- **Then** 사용자 토글이 비활성(disabled)으로 렌더되고 잠금 아이콘(🔒)이 함께 표시된다(`AdvancedModelToggle` 선례).
- **And** 사용자 토글 값이 켜짐이든 꺼짐이든 무관하게 편집기 표면(✨·힌트·`Mod+Enter` 신규 트리거)이 숨겨진다 — `effectiveAiEnabled = !policyDisabled && userAiEnabled`가 거짓이므로. (정책 잠금이어도 ✨·힌트가 뜨던 기존 미비의 부수 수정 확인.)

### AC-AI5-005: OFF 부수효과 — 취소 + 정리 + 문서 무변경 (REQ-AI5-011, 012)

- **Given** AI 요청이 진행 중(in-flight)이고 활성 고스트 또는 검토 중 제안 카드가 있을 때
- **When** 사용자가 토글을 끄면(ON→OFF 전이)
- **Then** 진행 중인 요청이 `ai_cancel`+`cancelRequest`로 **1회 취소**되고, 활성 고스트와 streaming/검토 중 카드가 모두 정리된다.
- **And** 편집기 문서 본문은 **삽입 전 산출물만 폐기되고 한 글자도 변경되지 않는다**(바이트 단위 동일 — 이미 삽입·확정된 내용은 무변경).
- **And** 진행 중 요청이 없는 상태(OFF→OFF 또는 idle)에서 토글을 꺼도 오취소가 발생하지 않는다.

### AC-AI5-006: ON 복귀 → 즉시 재활성 (REQ-AI5-010)

- **Given** AI 토글이 꺼진 상태일 때
- **When** 사용자가 토글을 다시 켜면(`effectiveAiEnabled` 참으로 전이, 단 정책 미잠금)
- **Then** ✨ 툴바·힌트·`Mod+Enter` 신규 트리거가 즉시 재활성화되며, 재시작이나 문서 재로드 없이 다음 조작부터 정상 동작한다.

### AC-AI5-007: 사용자 OFF 값의 정책 독립 저장 (REQ-AI5-003)

- **Given** 사용자가 토글을 끈(`aiEnabled=false`) 상태에서 이후 조직 정책 잠금이 걸렸다가 해제될 때
- **When** 정책 잠금이 해제된 뒤 effective 값을 재계산하면
- **Then** 사용자 `aiEnabled=false`가 그대로 보존되어(정책이 `aiEnabled`에 기록되지 않음), 사용자가 명시적으로 다시 켜기 전까지 표면은 계속 숨겨진다.

### AC-AI5-008: 하위호환 (REQ-AI5-015) [regression]

- **Given** 토글을 조작하지 않은 기존 사용자(기본 ON)일 때
- **Then** ✨·힌트·이어쓰기의 관찰 가능한 동작이 SPEC-AI-005 이전과 동일하다.
- **And** IPC·Rust·프롬프트가 변경되지 않으며(package.json/Cargo.toml/src-tauri diff 없음), 기존 vitest 939·cargo 235 단언이 **무개정으로 통과**한다.

## 엣지 케이스

- **정책 잠금 + 사용자 ON**: effective 거짓 → 표면 숨김, 토글 disabled+🔒(정책 우선 확인).
- **정책 잠금 + 사용자 OFF**: effective 거짓 → 표면 숨김, 정책 해제 시 사용자 OFF 유지(AC-AI5-007).
- **OFF 전이 시점에 첫 청크 전(hang)**: 플레이스홀더 고스트도 정리 + 취소(AC-AI5-005와 동일 계약).
- **OFF 중 confirmGhostCommand(진행 중이던 [넣기])**: 게이트 신규 트리거만 차단하므로 확정 경로 자체는 막지 않으나, OFF 전이가 이미 고스트를 정리해 확정 대상이 없음(D3 — 소실 수용, 문서 무변경).
- **persist 저장소 손상/부재**: 기본값 ON으로 폴백(zustand persist 기본 동작), 크래시 없음.
- **토글 연타(ON↔OFF 빠른 전이)**: 각 전이가 멱등적으로 게이트·정리, 중복 취소 없음.

## Quality Gate Criteria

- `tsc --noEmit` 클린
- `vitest run` 전량 통과 — **기준선 939개 이상**(신규 uiStore persist·effective·게이트 4지점·부수효과 테스트 포함, 기존 테스트 무개정)
- `cargo test` 전량 통과 — **기준선 235개(무변경 확인)**. Rust 코드 무변경이므로 신규 없음(D4)
- `cargo clippy` 클린
- Playwright(webkit) 통과 + 신규 여정에서 콘솔 에러 0
- `npm run lint`는 **게이트 아님** — eslint config 부재로 main 포함 상시 실패(알려진 프로젝트 제약, 회귀 오판 금지)

## Definition of Done

- [ ] REQ-AI5-001~015 전부가 AC-AI5-001~008 중 최소 1개에 매핑되어 검증됨
- [ ] 결정 D1~D5가 구현·테스트에 반영됨
- [ ] 기본 ON으로 기존 사용자 관찰 동작 무변경(기존 테스트 무개정 통과)
- [ ] IPC·Rust·프롬프트 무변경 확인(package.json/Cargo.toml/src-tauri diff 없음)
- [ ] 신규 런타임 의존성 0 확인
- [ ] MX 태그 부착(plan.md MX Tag Plan): @MX:ANCHOR 1곳(공통 셀렉터) + @MX:NOTE 1곳(OFF 부수효과 헬퍼)
- [ ] 정책 잠금이어도 ✨·힌트가 뜨던 기존 미비의 부수 수정 회귀 테스트 확보(REQ-AI5-014)
