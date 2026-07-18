# SPEC-AI-005 "AI 기능 사용자 켜기/끄기 토글" 리서치 보고서

> 본 문서는 SPEC-AI-005 착수 전 확정된 사실을 수록한다. 아래 사실은 재조사 불필요.

## 0. 핵심 발견 요약 (가장 중요)

**AI 표면을 끄는 데 필요한 인프라(영속·취소·정리)는 전부 이미 존재하며, 유일한 신규성은 "편집기 표면의 공통 게이트"다.** SPEC-AI-001/002/003이 남긴 자산으로 다음이 이미 가용하다:

- 영속: `uiStore`(zustand persist, localStorage `mdedit-ui-store`)에 `aiAdvancedModel` 선례가 상태·setter·partialize 패턴을 완비.
- 취소: Rust in-flight 1개 모델 + `ai_cancel` + `aiCancel`(`ipc.ts`) + aiStore `cancelRequest`.
- 정리: 고스트 정리(`ai-ghost-text.ts`), 카드 정리(`ai-suggestion-card.ts` `getCardControllers()`).

따라서 SPEC-AI-005의 실제 델타는 **(1) `uiStore`에 `aiEnabled` 추가, (2) `effectiveAiEnabled` 합성 셀렉터 + 정책 캐시 주입, (3) 표면 게이트 4지점, (4) OFF 부수효과(취소+정리)** 로 한정되며, IPC·Rust·프롬프트는 무변경이다.

**중복 SPEC 없음**: `.moai/specs/`의 AI 관련은 SPEC-AI-001/002/003뿐이며, 어느 것도 사용자 표면 토글을 다루지 않는다.

---

## 1. 영속화 인프라 (재사용)

- `src/store/uiStore.ts` — zustand persist(localStorage `mdedit-ui-store`).
- 선례 `aiAdvancedModel`(상태 선언, setter `setAiAdvancedModel`, initial state, persist 등록)이 신규 필드의 복제 원본.
- partialize는 `statusMessage`만 제외한다 → 신규 `aiEnabled: boolean`(기본 true)이 별도 배선 없이 **자동 영속**된다.
- **확정**: 상태 = `uiStore` `aiEnabled`(기본 true) + `setAiEnabled` — `aiAdvancedModel` 라인 복제.

## 2. 정책 게이트 현황 (부수 수정 대상)

- 정책은 현재 **2곳만** 인지한다: Rust `ai_request` 진입(`mod.rs`)과 SettingsModal.
- 편집기 표면은 정책을 **인지하지 못한다**:
  - ✨ 선택 툴바: `ai-selection-toolbar.ts` `buildToolbarDecorations`
  - 힌트 알약: `ai-ghost-text.ts` `evaluateHintEligibility` / `armTimer`
  - Mod+Enter: `ai-ghost-text.ts` `modEnterCommand`
- 이들은 `getUiState()`(`markdown-extensions.ts`)로 `loggedIn`/`advancedModel`만 조회한다.
- **함의**: 정책 잠금 상태에서도 현재 ✨·힌트가 뜨는 **기존 미비**가 존재한다. 본 SPEC의 공통 게이트가 이를 부수적으로 닫는다(회귀 테스트 추가 가치, REQ-AI5-014).
- **확정**: 공통 게이트는 `getUiState()`에 `enabled`(=effective) 필드를 추가하는 것이 단일 배선 지점.

## 3. 표면 인벤토리

- 끌 대상 표면은 3종: ✨ 선택 툴바, 3초 유휴 힌트 알약, `Mod+Enter` 신규 이어쓰기 트리거.
- **우클릭 AI 메뉴는 존재하지 않는다** — `FileTreeNode`의 파일 메뉴뿐이므로 표면 인벤토리에서 제외.

## 4. 취소·정리 경로 (재사용)

- Rust in-flight 1개 모델(`mod.rs`), `ai_cancel`(`mod.rs`).
- 프론트 취소: `aiCancel`(`ipc.ts`) + aiStore `cancelRequest`(`aiStore.ts`).
- 고스트 정리 선례: `ai-ghost-text.ts`(파괴/취소 경로).
- 카드 정리 선례: `ai-suggestion-card.ts` + `getCardControllers()`.
- **확정**: OFF 부수효과 = 이들을 조합(취소 + 고스트/카드 정리). 문서 본문은 삽입 전 산출물만 폐기(무손상).

## 5. 테스트 선례

- `SettingsModal.test.tsx`: 정책 잠금·persist 토글 케이스 기존재, `policyMock` 패턴.
- `uiStore.test.ts`: persist 검증(라운드트립·기본값).
- e2e에 설정 모달 여정은 **없음** — 신규 필요 시 `ai-inline-edit.spec.ts` 패턴 준용.
- 게이트 4지점 검증은 기존 `aiHint`/`aiFreeContinue`/toolbar 테스트 패턴 재사용, OFF 시 `aiRequest` 미호출=토큰 0 단언은 `aiContinueContext.test.ts` 패턴.

## 6. 결합 주의 (순환 방지)

- `ai-ghost-text.ts`가 SettingsModal의 `resolveModel`을 import한다.
- 따라서 공통 셀렉터를 SettingsModal에 두면 `ai-ghost-text.ts → SettingsModal` 순환이 발생한다.
- **확정**: 공통 셀렉터는 SettingsModal이 아닌 **store/별도 모듈**에 배치한다(순환 방지).

---

## 7. 설계 결정 요약 (plan.md Decision Log에 상세 기록)

- **D1**: 상태 = `uiStore` `aiEnabled`(기본 true) + `setAiEnabled` — `aiAdvancedModel` 라인 복제.
- **D2**: 공통 셀렉터 = 정책 캐시 `getAiPolicyDisabled()` 싱글턴(`getAiLoggedIn` 동형) + `AppLayout`에서 `aiPolicyStatus()` 호출로 세팅. `getUiState()`에 `enabled`(=effective) 필드 추가가 단일 배선 지점. 셀렉터는 store/독립 모듈(순환 방지, §6).
- **D3**: 게이트 4지점 — `buildToolbarDecorations` 최상단 return / `evaluateHintEligibility`(또는 `armTimer`) 조기 return / `modEnterCommand` 신규 트리거만 차단. **확정 커맨드·진행 중 [넣기]는 OFF 시 전체 정리 정책 채택**: `setAiEnabled(false)` 부수효과로 in-flight 취소 + 활성 고스트·streaming/검토 카드 정리. 근거: "전체 숨김"의 일관성, 설정 모달 저빈도·의도적 조작이므로 생성물 소실 수용(문서 본문 무손상 — 삽입 전 산출물만, REQ-AI-033 무충돌).
- **D4**: Rust 미변경 — 요청은 프론트에서만 발원하므로 프론트 게이트=완전 차단. 정책 kill-switch(조직 강제)와 달리 이중 방어 불요. Rust/IPC/prompt 무변경.
- **D5**: stale 캐시 수용 — `getAiPolicyDisabled` 캐시는 부팅+설정 모달 열람 시 갱신(`getAiLoggedIn`과 동일 한계, 기존 수용 선례).

## 8. 리스크 & 암묵 계약

1. **순환 import**: 셀렉터 배치 위치로 원천 회피(§6, D2/D3).
2. **프론트만 게이트 시 요청 누수**: 요청 발원이 프론트뿐이므로 프론트 게이트가 요청 0을 보장(D4). aiRequest 호출 0 단언으로 검증.
3. **진행 중 산출물 소실**: 설정 모달 저빈도·의도적 조작이므로 수용(D3). 문서 본문은 무손상(REQ-AI5-012).
4. **stale 정책 캐시**: `getAiLoggedIn`과 동일 수용 선례(D5).
5. **store subscribe 부수효과 재진입**: 취소·정리를 전이 관찰 지점으로 분리, dispatch 중 재진입 금지.
6. **기존 테스트 파괴**: 기본 ON + 게이트 추가만 → 관찰 동작 무변경, 무개정 통과(REQ-AI5-015).
7. **알려진 게이트 제약**: `npm run lint` 상시 실패(eslint config 부재) — 게이트는 `tsc --noEmit`+`vitest run`+`cargo test`+`cargo clippy`+Playwright(webkit). 기준선: vitest 939 / cargo 235(무변경).

## 9. 권장 구현 접근 스케치 (분석만, 코드 아님)

1. **상태**: `uiStore`에 `aiEnabled`(기본 true)+`setAiEnabled` 추가(`aiAdvancedModel` 복제), partialize 무변경.
2. **셀렉터/배선**: 정책 캐시 싱글턴 + `AppLayout` 세팅 + `getUiState().enabled = !getAiPolicyDisabled() && aiEnabled`.
3. **게이트**: `buildToolbarDecorations`/`evaluateHintEligibility`(또는 `armTimer`)/`modEnterCommand` 신규 트리거에 `enabled` 조기 분기.
4. **부수효과**: `setAiEnabled(false)` 전이 관찰 지점에서 취소+고스트/카드 정리(문서 무변경).
5. **UI**: SettingsModal AI 섹션에 토글(정책 잠금 시 disabled+🔒).
6. **테스트**: §5 패턴 준수. e2e는 webkit 1여정(설정 열기→OFF→표면 소멸→Mod+Enter 무반응→ON→복귀).
