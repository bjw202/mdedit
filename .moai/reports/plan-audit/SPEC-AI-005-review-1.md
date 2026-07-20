# SPEC 감사 보고서: SPEC-AI-005 (AI 기능 사용자 켜기/끄기 토글)
반복(Iteration): 1/3
판정(Verdict): **PASS**
종합 점수: **0.94** (임계 0.90)

> M1 컨텍스트 격리 준수: 작성자 추론 맥락은 무시하고 문서 5종(spec.md / spec-compact.md / plan.md / acceptance.md / research.md)과 실제 main 코드만으로 감사함. SPEC-AI-004-review-1.md는 형식·채점 기준 참조용으로만 사용.

---

## Must-Pass 결과

- **[PASS] MP-1 REQ 번호 일관성**: REQ-AI5-001~015 (spec.md:L67~L124) 종단 확인. 모듈1(001·003·002)·모듈2(004·006·005)·모듈3(007·008·009·010)·모듈4(011·012)·모듈5(013·014)·모듈6(015). 15개 distinct, 결번·중복 없음, 3자리 제로패딩 일관. spec-compact.md(L22~L51)도 동일 서열. (모듈 내 서열이 001,003,002 식으로 비순차 배열되나 전체 집합에 결번 없음 — 통과.)
- **[PASS] MP-2 EARS 형식**: 15개 전부 5개 패턴 중 하나에 정합.
  - Ubiquitous(The system shall): 001(L67), 003(L68), 012(L108), 013(L114), 015(L124).
  - Event-driven(WHEN…the system shall): 002(L72), 004(L78), 006(L79), 010(L98), 011(L104).
  - State-driven(WHILE…the system shall): 005(L83), 007(L89), 008(L90), 014(L118).
  - Unwanted(IF…then the system shall): 009(L94).
  Given-When-Then은 acceptance.md에만 존재하며 EARS로 오표기되지 않음.
- **[PASS] MP-3 YAML frontmatter**: spec.md:L1~L20에 id(SPEC-AI-005)·version("0.1.0")·status(draft)·created("2026-07-17", ISO)·priority(high)·tags(배열 4종) 전부 존재·정형. dependencies(SPEC-AI-001/002/003)·lifecycle(spec-anchored)·author·updated 포함. (필드명 `created`는 AI-004 선례와 동일 — 통과.)
- **[N/A] MP-4 언어 중립성**: 단일 제품 SPEC(Rust/Tauri + TS/CodeMirror). 다중 언어 툴링 범위 아님.

---

## 감사 차원별 점수 (요청된 6차원)

| 차원 | 점수 | 근거(파일:섹션) |
|------|------|------------------|
| 1. EARS 적합성 | 0.92 | 15개 전부 패턴 정합. 관찰 가능 계약(토큰 0=mock 카운트 0·바이트 동일). 감점: REQ-011 shall절에 `ai_cancel`+`cancelRequest`, REQ-007/008 "빈 데코레이션 반환" 등 HOW 누수(F4) |
| 2. Traceability | 0.93 | REQ 15개 전부 ≥1 AC 매핑·역방향 실재(spec.md:L148~L157). 결정 착지·사용자 확정 3항 전부 반영. 감점: spec "사전 합의 1~5"와 plan "D1~D5"의 번호 불일치(F2) |
| 3. Verifiability | 0.92 | 토큰 0 단언(mock 카운트, aiContinueContext 선례)·바이트 동일·취소 1회 전부 기계 판정. 감점: "재시작 유지"의 최강 검증(실프로세스 재기동)이 e2e 여정에 없고 vitest localStorage 라운드트립 프록시 의존(F6) |
| 4. 코드 정합성 | 0.96 | 인용 좌표 전부 실제 main과 함수·라인 단위 일치. 핵심 주장 "정책 잠금이어도 ✨·힌트가 뜬다" 검증 완료(아래). 감점: research.md가 라인 좌표 없이 함수명만 인용(F3) |
| 5. Scope 규율 | 0.95 | Exclusions 7종 구체·크리프 없음·"우클릭 AI 메뉴 없음" 사실 확인. 사소 중복(F7) |
| 6. Risk 완전성 | 0.94 | 카드 소실 vs 무손상(REQ-AI-033)·stale 캐시(D5)·resolveModel 순환(리서치 6)·subscribe 재진입 전부 다룸. 감점: REQ-AI-033 미인용(F5) |

종합 = 6차원 평균 ≈ 0.937 → **0.94**. Must-pass 무실패 + 임계 0.90 초과 → **PASS**.

---

## 코드 정합성 spot-check (실제 main Read 결과)

| 문서 주장 | 실제 코드 | 판정 |
|---|---|---|
| uiStore `aiAdvancedModel` 상태·setter·partialize(51/74/95/130-138) | 상태 L51, setter타입 L74, 초기값 L95, setter구현 L130, partialize L135-138(`statusMessage`만 제외) | ✓ 복제 원본 정확 |
| `getUiState()` 정책 미인지(markdown-extensions.ts:126-132) | L126-132 `{loggedIn: getAiLoggedIn(), advancedModel: …}` — **enabled/policy 필드 없음** | ✓ 단일 배선 지점 정확 |
| `buildToolbarDecorations`(ai-selection-toolbar.ts:564-595) | L564-595, 정책·loggedIn 미조회(클릭 시 onConnectNeeded로만 게이트) | ✓ ✨ 데코가 정책과 무관 렌더 |
| `modEnterCommand`(ai-ghost-text.ts:480-490) | L480-484 4중 트리거(confirmGhost∥sectionFill∥continue∥freeContinue), keymap L487-490 | ✓ 확정 분기 존재 확인 |
| `evaluateHintEligibility`:510 / `armTimer`:584 | L510(순수 로컬 판정, 정책·loggedIn 미조회), L584-594(고스트+자격만 체크) | ✓ 힌트가 정책과 무관 노출 |
| resolveModel 순환(리서치 6) | ai-ghost-text.ts:20 `import { resolveModel } from '@/components/settings/SettingsModal'` — 실재 | ✓ 셀렉터 store 배치 근거 견고 |
| `AdvancedModelToggle` disabled+🔒 선례(SettingsModal:246-270) | L245-271, disabled 시 `🔒` 부착(L268), policy-locked case L201-207가 `<AdvancedModelToggle disabled />` | ✓ 토글 UI 선례 정확 |
| `getAiLoggedIn`/`setAiLoggedIn` 싱글턴(ai-suggestion-card.ts:672-679) | L673 `loggedInCache=true`, setter L674, getter L677 | ✓ 정책 캐시 동형 근거 |
| `getCardControllers()` 카드 정리 선례(714-717) | L715 정의, L701 register/L708 remove/L720 active | ✓ 카드 정리 조합 가능 |
| `AppLayout` 부팅 감지 세팅 선례(47-59) | L46-58 useEffect에서 `aiDetectProviders()`→`setAiLoggedIn` | ✓ (단 `aiPolicyStatus()`는 현재 미호출 — Delta의 NEW 배선 필요, 문서가 명시) |
| mod.rs ai_request 정책 kill-switch(106-108) | L106-108 `if *state.ai_policy_disabled…return Err` | ✓ Rust 진입 정책 실재 |
| 취소 경로 `ai_cancel`+`aiCancel`+`cancelRequest` | mod.rs:212, ipc.ts:234, aiStore.ts:90 전부 실재 | ✓ OFF 부수효과 조합 가능 |

**핵심 주장 검증 — "정책 잠금이어도 ✨·힌트가 뜬다"(research.md §2, REQ-AI5-014)**: `getUiState()`(markdown-extensions.ts:127-130)는 `loggedIn`·`advancedModel`만 반환하고 정책을 조회하지 않는다. `buildToolbarDecorations`는 선택 유무(`from===to`)만으로 ✨ 위젯을 배치하며 정책·loggedIn을 보지 않는다. `evaluateHintEligibility`/`armTimer`도 순수 로컬 자격만 판정한다. 반면 정책 인지는 Rust `ai_request` 진입(mod.rs:106-108)과 SettingsModal(L84 `aiPolicyStatus`) 2곳뿐이다. → 정책 잠금 상태에서 ✨·힌트가 실제로 노출되는 **기존 미비 확정**. 본 SPEC 공통 게이트가 `getUiState().enabled = !policyDisabled && aiEnabled`로 이를 부수 수정한다는 논리 성립. REQ-AI5-014의 "부수 수정" 주장 견고.

**"우클릭 AI 메뉴 없음"(research.md §3)**: `src/components/editor/` 전역 grep — `contextmenu`/`onContextMenu`/우클릭 핸들러 0건. 표면 인벤토리 3종(✨/힌트/Mod+Enter) 완전성 확인. 사실 정확.

**REQ-AI-033 무충돌 논증**: REQ-AI-033(SPEC-AI-001 spec.md:156) = "어떤 AI 실패에서도 문서 무변경, 변경은 사용자 확정으로만". OFF 부수효과는 **삽입 전 산출물(미확정 고스트·검토 중 카드)만 폐기**하고 이미 확정·삽입된 본문은 손대지 않으므로(REQ-AI5-012 바이트 동일), REQ-AI-033의 "확정 없이 문서 변경 금지"와 정면 정합(오히려 미확정물 폐기는 무변경 원칙 강화). D3 "생성물 소실 수용"은 UX 손실이나 무손상 계약 위반이 아님 — 논증 타당.

---

## 결함 목록

**F1 [minor] — spec/plan/acceptance/spec-compact L9: `issue_number: 0`**
존재하지 않는 이슈 #0 placeholder(4개 문서 공통). SPEC-AI-004 F2와 동일 패턴. `null` 또는 실제 이슈 번호 권장. 비차단.

**F2 [minor] — spec.md:L43~L49 vs plan.md:L29~L35: 결정 번호 체계 불일치**
spec.md "사전 합의 설계 결정 (재검토 금지)"는 항목 **1~5**(1=전체숨김, 2=우선순위, 3=셀렉터배치, 4=Rust무변경, 5=OFF전체정리)를 열거하고, plan.md Decision Log는 **D1~D5**(D1=상태저장, D2=셀렉터배치, D3=확정처리/전체정리, D4=Rust이중방어, D5=stale캐시)를 정의하는데 두 5항 집합의 내용·순서가 다르다(spec#1 전체숨김 ↔ plan에 대응 D 없음; plan D1 상태저장 ↔ spec 사전합의에 없음). acceptance.md DoD(L104) "결정 D1~D5"는 plan 쪽을 지칭. 커버리지 공백은 아니나(양측 항목 모두 REQ/AC에 착지) 교차 대조 시 독자 혼동 유발. 라벨 구분(예: 사전합의 PA1~PA5) 또는 정렬 권장.

**F3 [minor] — research.md 전반: 라인 좌표 부재**
research.md는 파일+함수명만 인용하고 라인 번호를 제공하지 않는다(예 §1~§6). SPEC-AI-004 research의 라인 단위 정밀도 대비 후퇴. 본 감사의 좌표 검증은 감사 프롬프트가 제공한 좌표에 의존했으며, 모든 함수는 실재 확인됐으나 Run 단계 착지 정밀도를 위해 라인 refs 보강 권장. 비차단.

**F4 [minor] — spec.md:L104, L89, L90: normative shall-text HOW 누수**
REQ-AI5-011 shall절이 `ai_cancel`+`cancelRequest`(구현 심볼)를, REQ-AI5-007/008이 "빈 데코레이션 반환"(구현 기법)을 포함. 대부분의 구현 세부는 대괄호 [NEW/MODIFY] 주석으로 격리돼 있으나 일부가 shall 본문에 유입. REQ-AI5-013의 `effectiveAiEnabled = !policyDisabled && userAiEnabled` 공식은 실효값 정의(WHAT)로 정당. 비차단.

**F5 [minor] — spec.md:L49, L108 / research.md §7 D3: REQ-AI-033 미인용**
무충돌 논증이 외부 SPEC(SPEC-AI-001)의 REQ-AI-033에 의존하나 해당 REQ 본문을 인용하지 않아 독자가 외부 문서를 조회해야 검증 가능. 논증 자체는 타당(위 검증)하나 자기완결성 저하. dependencies에 SPEC-AI-001이 있어 추적은 가능. 비차단.

**F6 [minor] — acceptance.md:L40~L41, L23 / plan.md T6: 재시작 지속성 e2e 부재**
AC-AI5-002가 "애플리케이션을 재시작하면 aiEnabled=false 복원"을 요구하나, e2e 여정(T6: 설정 열기→OFF→표면 소멸→Mod+Enter 무반응→ON→복귀)에 재기동 단계가 없다. 검증은 vitest localStorage 라운드트립 프록시에 의존. 프록시는 유효하나 실프로세스 지속성의 직접 증거는 아님. 공개적으로 e2e Tauri IPC 미스폰 제약(L23) 하에 수용 가능.

**F7 [minor] — spec.md:L170, L173: Exclusions 항목 중복**
"힌트만 끄기 등 세분 옵션"(L170)과 "기능별(프리셋별) 개별 토글"(L173)이 의미상 중첩(둘 다 세분 온오프 배제). 한 항으로 통합 권장. 비차단.

**F8 [minor] — plan.md·acceptance.md·spec-compact.md frontmatter 축소**
spec.md는 tags/dependencies/lifecycle 포함하나 하위 3문서 frontmatter는 id~issue_number까지만. SPEC-AI-004 F5와 동일. 감사 대상은 spec.md라 MP-3 무영향, 일관성상 minor.

---

## Chain-of-Verification (2차 자기비판)

재독으로 확인:
- **REQ 서열 종단 재확인**(스팟 아님): spec.md 001~015 전수 → 결번·중복 없음. spec-compact.md 라벨(U/E/S/Un)까지 교차 일치. acceptance.md AC 헤더 REQ 참조가 spec 매핑표와 1:1 대조 — 불일치 0.
- **Traceability 역방향 전수**: AC-001→007/008/009, 002→001/002, 003→004/006, 004→005/013/014, 005→011/012, 006→010, 007→003, 008→015. 합집합 = {001…015} 15개 전부. 고아 REQ·미커버 REQ·비실재 AC 참조 0.
- **결정 착지 전수**: plan D1(REQ-001·T1), D2(REQ-013·T2), D3(REQ-009/011/012·T3/T5), D4(REQ-015·D4열), D5(REQ-013·risk L96). 사용자 확정 3항(전체숨김→REQ-007/008/009/014+Exclusions, 정책우선→REQ-005/013/014, OFF전체정리→REQ-011/012/D3) 전부 반영. F2(번호 불일치)만 정밀도 결함.
- **코드 좌표 전수 대조**: 위 표대로 Read로 라인 확인 — 실 코드와 함수·라인 단위 부합. 핵심 주장(정책 미인지 표면)·우클릭 메뉴 부재·취소 경로·순환 import 전부 실측 검증.
- **Exclusions 구체성 재독**: 7종 중 6종 구체 아티팩트(Rust 저장·단축키·정책파일 UI·온보딩·의존성) 명명. F7 중복 1건.
- **모순 스윕**: REQ-AI5-009(신규 트리거만 차단, 확정 분기 불변) vs D3(전체 정리) — 확정 대상 자체를 부수효과가 선제 정리하므로 "확정 분기는 막지 않되 대상이 없음"으로 양립(acceptance.md:L88 엣지 케이스 명시, 모순 아님). REQ-AI5-012(무손상) vs D3(카드 소실) — 삽입 전/후 구분으로 양립(위 REQ-AI-033 검증). REQ-AI5-003(정책 독립 저장) vs REQ-AI5-013(effective 합성) — 저장은 사용자값만, 정책은 계산 시점 합성으로 분리(모순 아님).

신규 결함: F6·F7·F8을 2차 재독에서 확정. F1~F5 유지. 신규 major/critical 없음.

---

## 회귀 점검 (Iteration 2+ 전용)
N/A — iteration 1.

---

## 권고

PASS(0.94). 차단 결함 없음. 코드 정합성·Scope·Risk 매우 높고 핵심 주장("정책 잠금이어도 ✨·힌트 노출")은 실측 검증됨. 다음 최소 편집으로 정밀도 보강 권장(전부 비차단):

1. **F2(우선)** plan.md·spec.md — spec "사전 합의 설계 결정 1~5"와 plan "D1~D5"의 번호 정렬 또는 라벨 구분(예 PA1~PA5). acceptance.md DoD "결정 D1~D5"가 지칭하는 집합 명확화.
2. **F3** research.md — 인용 함수에 라인 좌표 보강(Run 착지 정밀도).
3. **F1** 4개 문서 L9 — `issue_number: 0` → `null` 또는 실제 번호.
4. **F5** spec.md — REQ-AI-033 요지 1줄 인용(무충돌 논증 자기완결).
5. **F6** acceptance.md/plan.md — 재시작 지속성이 vitest 프록시 검증임을 AC-002에 명시(또는 e2e에 reload 스텝 추가 검토).
6. **F4/F7/F8** 비차단 — shall-text HOW 격리·Exclusions 중복 통합·하위문서 frontmatter 미러링.

Requirements 본문·AC 오라클·Exclusions 내용 재작업은 불필요. F2 정렬만으로 Traceability ~0.96, 종합 ~0.95 예상.

판정: **PASS (0.94)**
