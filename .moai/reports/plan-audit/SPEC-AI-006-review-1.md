# SPEC 감사 보고서: SPEC-AI-006 (AI 프롬프트 정밀도·지연 워치독·이어쓰기 보조 UX)
반복(Iteration): 1/3
종합 판정(Verdict): **PASS (조건부 — Major 2건 선해소 권장)**
종합 점수: **0.85**

> M1 컨텍스트 격리 준수: 작성자 추론 맥락은 무시하고 문서 4종(spec.md / research.md / plan.md / acceptance.md)과 실제 main 코드(731f05f), 그리고 `프롬프트-핫픽스-테스트.md`만으로 감사함. SPEC-AI-005-review-1.md는 형식·채점 기준 참조용으로만 사용.

---

## 파일별 판정

| 파일 | 판정 | 요지 |
|------|------|------|
| research.md | **PASS-with-notes** | 코드 정합성 높음. §2 D2 워치독 단일발행 서술이 취소/교체 경로 흡수를 주장하나 기제가 릴레이+워치독만 결속(Major 1). 좌표 1건 드리프트 |
| spec.md | **PASS-with-notes** | MP 전부 통과·Traceability 완결. REQ-AI6-013의 "이어쓰기 발행부 3곳" 중 L390은 섹션 채우기(Major 2). REQ-AI6-006 shall-text 결속 불완전(Major 1) |
| plan.md | **PASS-with-notes** | D2 워치독 갭 계승(Major 1). T5 Reference "발행부 434/440/468" 좌표 오기(Minor) |
| acceptance.md | **PASS-with-notes** | A-1/A-2/R-1/R-2가 도그푸딩 노트와 정확 일치(강점). AC-AI6-002 "1회 발행"이 Major 1의 기제 갭을 드러냄 |

---

## Must-Pass 결과

- **[PASS] MP-1 REQ 번호 일관성**: REQ-AI6-001~015 (spec.md:L76~L139) 종단 확인. 모듈1(001·002·003)·모듈2(004·005·006)·모듈3(007·008·009)·모듈4(010·011)·모듈5(012·013·014)·모듈6(015). 15개 distinct, 결번·중복 없음, 3자리 제로패딩 일관.
- **[PASS] MP-2 EARS 형식**: 15개 전부 5개 패턴 중 하나에 정합.
  - Ubiquitous: 001(L76), 002(L77), 005(L91), 009(L109), 012(L125), 014(L133), 015(L139).
  - Event-driven(WHEN…shall): 004(L87), 008(L105), 010(L115), 013(L129).
  - State-driven(WHILE…shall): 007(L101), 011(L119).
  - Unwanted(IF…then shall): 003(L81), 006(L95).
  - 유의: REQ-AI6-009는 "Unwanted Behaviour" 헤딩 아래 있으나 IF-조건 없는 부정형 Ubiquitous("…사용하지 않는다"). EARS로는 수용, 헤딩 라벨만 부정합(Minor F5).
- **[PASS(주의) MP-3 YAML frontmatter**: spec.md:L1~L21에 id(SPEC-AI-006)·version("0.1.0")·status(draft)·created("2026-07-17")·priority(high)·tags(배열 5종)·dependencies·author·updated·lifecycle 존재·정형. 필드명이 `created_at`/`labels`가 아닌 `created`/`tags`이나 AI-001~005 전 SPEC 공통 선례로 일관 — 통과(Minor F4).
- **[N/A] MP-4 언어 중립성**: 단일 제품 SPEC(Rust/Tauri + TS/CodeMirror). 다중 언어 툴링 범위 아님.

---

## 감사 차원별 점수 (요청된 5차원)

| 차원 | 점수 | 근거 |
|------|------|------|
| 1. EARS 적합성 | 0.90 | 15개 전부 패턴 정합, 관찰 가능 계약(바이트 동일·선점 헬퍼 true/false·mock 인자). 감점: REQ-009 헤딩 오라벨(F5), shall-text HOW 누수(`finished` swap·`aiContinueLength`, F6) |
| 2. 코드 정합성 | 0.82 | 인용 좌표 대부분 실제 main과 함수 단위 일치(아래 표). **감점 大: REQ-AI6-013 "발행부 3곳(390/421/452)" 중 L390은 섹션 채우기이며 continue 아님(Major 2)**. 카드 스켈레톤 좌표 277-286→실제 287-294(F3) |
| 3. Scope 규율 | 0.94 | 정확히 5항목. Exclusions 9종 구체(truncated 죽은 코드·히스토리·랭킹·outline 비대화 명시 포함). 크리프 없음 |
| 4. 내부 일관성 | 0.80 | Traceability 완결(AC 6개가 REQ 15개 전수 커버). D1~D5↔spec 사전합의↔plan 교차 일관. **감점: 워치독 단일발행 결속이 REQ/Delta에서 취소·교체 경로를 누락(Major 1); plan T5 좌표 오기(F2); REQ-013↔REQ-014 자기모순(Major 2)** |
| 5. Risk 완전성 | 0.80 | 프롬프트 바이트 계약·타이머 누수·시그니처 파손·union 회귀 전부 다룸. **감점: 워치독 vs 취소/교체 이중발행 경쟁이 리스크 표·기제에서 미해소(Major 1)** |

종합 = 5차원 평균 ≈ 0.852 → **0.85**. Must-pass 무실패 + Critical 0 → **PASS**, 단 Major 2건은 Run 착수 전 해소 권장.

---

## 코드 정합성 spot-check (실제 main Read 결과)

| 문서 주장 | 실제 코드 | 판정 |
|---|---|---|
| `build_inline_prompt`(prompt.rs:151), `system_prompt`(L75-106), Custom 조기 return(L95-97) | L151-178 조립, L75-106 매치, L95-97 `return format!` | ✓ 삽입점·조기 return 정확 |
| 이어쓰기 바이트 하위호환 테스트 L570-575 / L586-591 | L570-575 `==Continue.system_prompt()`+`!contains("금지")`, L585-591 `==` + `!contains([뒤 문맥])` | ✓ 계약 실재 |
| `build_continue_prompt`(L207) 3인자, `continue_system_prompt`(L234) 조건절 | L207-229, L234-243 has_after 분기 | ✓ D3 위임 대상 정확 |
| Polish "한국어 문장 교정기"(prompt.rs:78) | L78 하드코딩 확인 | ✓ 언어 편향 실재 |
| `ai_request`/in-flight/교체(mod.rs:99-207), `AiRequestArgs`(L74-94) | L99-207, L74-94, 교체 emit L149-167 | ✓ |
| 정책 kill-switch(mod.rs:106-108) | L106-108 실재 | ✓ |
| `relay_process`(claude_cli.rs:162) 블로킹·타임아웃 없음, done/error emit | L162-224, `reader.lines()` 블로킹, L200-222 emit, cancelled→Silent(L221) | ✓ 워치독 부재 확정 |
| `friendly_error_message`(L101-110) login/network/parse/other | L101-110 매치("timeout" arm 부재 확인) | ✓ |
| `AiErrorKind`(aiStore.ts:11) union 4종 | L11 `'login'|'network'|'parse'|'other'` | ✓ |
| uiStore `aiAdvancedModel` 상태·setter·partialize 선례 | 상태 L51, 초기값 L102, setter L138, partialize L144(`statusMessage`만 제외) | ✓ 복제 원본 정확 |
| `GhostControlsWidget`(ghost-text.ts:334) done/streaming 분기 | L327-350, streaming=`[■ 중지]` / done=`[✓ 넣기]·[✕ 지우기]` | ✓ ↻ 부재 확정 |
| `GhostPlaceholderWidget`(ghost-text.ts:276) | L276-289 상수 eq() | ✓ |
| 카드 `fireReRequest`(card.ts:968) 선례 | L958 `@MX:ANCHOR`, L968 정의 | ✓ |
| truncated 죽은 코드 `onComplete(s.streamBuffer)`(card.ts:1059) — truncated 미전달 | L1059 `controller.onComplete(s.streamBuffer)`(opts 없음), onComplete 시그니처 L784 `opts?.truncated` | ✓ Exclusion 근거 정확 |
| **이어쓰기 발행 3경로 presetKind** | L390 section-fill(presetKind 없음)·L438 `presetKind:'continue'`·L468 `presetKind:'continue'` | ✗ **L390은 continue 아님 → Major 2** |

**도그푸딩 시나리오 대조**: acceptance.md A-1("3. 인증 흐름"→짧게, 링크보드/수집기 미흡수)·A-2("4. 태그 분류 규칙"→개요로)·R-1(과교정 X)·R-2("8. 요금제"→표로 미흡수)가 `프롬프트-핫픽스-테스트.md`(L14-17/L23-25/L75/L76)와 **문자열·섹션 단위로 정확 일치**. 강점.

---

## 결함 목록

**M1 [major] — spec.md:L95(REQ-AI6-006) / research.md §2·§8-2 / plan.md D2·Risk / Delta L148 : 워치독 단일발행이 취소·교체 경로를 결속하지 않음**

터미널 `ai://error`는 현재 **세 지점**에서 발행된다: (a) `relay_process`(claude_cli.rs:200-222, cancelled면 Silent), (b) `ai_cancel`(mod.rs:224, **무조건 발행**·cancelledBy:user), (c) 신규 요청 교체(mod.rs:156, **무조건 발행**·cancelledBy:new-request). REQ-AI6-006 shall-text·D2·Delta는 단일발행 선점(`finished` swap)을 **릴레이+워치독 2주체에만** 결속한다. 그러나 (b)(c)는 `cancel_flag`만 세우고 `finished`를 claim하지 않은 채 자체 emit한다.

- 결과 1(동시성): 사용자 취소와 60초 워치독이 근접 발화하면 `ai_cancel` emit(게이트 없음) + 워치독 emit(finished claim 성공)이 **동일 requestId에 이중 발행** → AC-AI6-002 "`timeout` 오류가 1회 발행"·엣지 "먼저 선점한 주체만 발행"(acceptance.md:L46,L90) 위반.
- 결과 2(순차): 5초에 사용자 취소 → 60초에 워치독 발화 시, 릴레이가 EOF Silent 경로에서도 `finished`를 claim해야 워치독이 억제되는데, spec은 "릴레이가 Silent 시에도 EOF에서 claim한다"를 명시하지 않음.
- Delta 표(spec.md:L143-158)에 `ai_cancel`·교체 emit을 `finished` 참여로 MODIFY한다는 항목이 없음.
- 권고: REQ-AI6-006/Delta를 (i) 릴레이가 **모든 outcome(Silent 포함)에서 EOF 시 finished claim**, (ii) `ai_cancel`·교체 emit도 **발행 전 finished claim**하도록 확장하거나, 이중발행이 프론트에서 무해함을 근거와 함께 명시. research §2 "취소·교체와의 경쟁도 선점 규칙으로 흡수"의 *의도*는 옳으나 규범 텍스트·태스크가 이를 실현하지 않음.

**M2 [major] — spec.md:L129(REQ-AI6-013) : "이어쓰기 발행부 3곳(390/421/452)" 중 L390은 섹션 채우기 — REQ-AI6-014와 자기모순**

REQ-AI6-013은 "이어쓰기 발행부 3곳(ghost-text.ts:390/421/452)에 length 전달"을 지시한다. 그러나 `startSectionFillCommand`(L390)는 `feature:'section-fill'`·**presetKind 없음**(L406-412) → `AiFeature::FillSection`으로 resolve되어 이어쓰기(continue)가 **아니다**. 실제 continue 발행은 L421(`presetKind:'continue'`, L438)·L452(L468) **2곳뿐**이다. L390에 length를 싣는 것은 REQ-AI6-014("길이 옵션을 이어쓰기에만 적용, 섹션 채우기 프롬프트에 영향 없음")와 정면 모순이다.

- 런타임 영향: Rust가 length를 `Continue` 분기에서만 매핑(REQ-AI6-014)하므로 실행상 무해(섹션 채우기 length는 무시). 그러나 spec 텍스트가 사실 오류(L390=continue로 오기) + 자기모순이라 Run 착지 혼동 유발.
- 권고: REQ-AI6-013을 "이어쓰기 발행부 2곳(ghost-text.ts:421/452)"으로 정정. Delta L152·plan T5도 동기화.

**F2 [minor] — plan.md:L75(T5 Reference) : "발행부(ghost-text.ts:434/440/468)" 좌표 오기**

실제 `aiRequest(` 호출은 L406/435/465, 커맨드 정의는 L390/421/452. spec은 390/421/452를 인용하나 plan T5는 434/440/468을 인용 — 세 지점 모두 실좌표와 불일치하며 spec과도 어긋남. 좌표 정정 권장.

**F3 [minor] — spec.md:L101,L153 / research.md §5 : 카드 스켈레톤 좌표 드리프트**

"카드 스켈레톤(card.ts:277-286)"으로 반복 인용하나 실제 스켈레톤 생성은 L287-294. ~10줄 드리프트. `mdedit-ai-truncated-note`(L407)·placeholder(L276)는 정확.

**F4 [minor] — 전 문서 L5 : frontmatter `created`/`tags` (표준 `created_at`/`labels` 아님)**

MP-3 표준 필드명과 상이하나 AI-001~005 전 SPEC 공통 선례로 일관 — 비차단. 감사 대상 spec.md 통과.

**F5 [minor] — spec.md:L107-109 : REQ-AI6-009 헤딩 오라벨**

"Unwanted Behaviour" 아래 있으나 IF-조건 없는 부정형 Ubiquitous("The system shall …사용하지 않는다"). EARS 수용이나 Ubiquitous 헤딩이 정확. 비차단.

**F6 [minor] — spec.md:L95(REQ-006), L129(REQ-013) : shall-text HOW 누수**

REQ-006 shall 본문에 `finished` swap(구현 기법), REQ-013에 `aiContinueLength`(구현 심볼) 유입. 대괄호 [NEW/MODIFY] 격리가 원칙이나 일부가 본문에 노출. AI-005 F4와 동류. 비차단.

**F7 [minor] — plan.md·acceptance.md frontmatter 축소**

spec.md는 tags/dependencies/lifecycle 포함하나 plan/acceptance frontmatter는 id~issue_number까지만. `issue_number: 0` placeholder도 4문서 공통(AI-005 F1 동일). 일관성상 minor.

---

## Chain-of-Verification (2차 자기비판)

재독으로 확인:
- **REQ 서열 종단 재확인**(스팟 아님): spec.md 001~015 전수 → 결번·중복 0. acceptance 매핑표(L164-171)와 AC 헤더 REQ 참조 1:1 대조 — 불일치 0.
- **Traceability 역방향 전수**: AC-001→{001,002,003}, 002→{004,005,006}, 003→{007,008,009}, 004→{010,011}, 005→{012,013,014}, 006→{015}. 합집합={001…015} 15개 전부. 고아 REQ·비실재 AC 참조 0.
- **코드 좌표 전수 대조**: 위 표대로 Read 확인. 핵심 반증 대상 "이어쓰기 발행 3경로"를 실제 Read(L390-475)로 검증 → L390이 section-fill임을 확정(Major 2 근거 견고, 스킴 아닌 실측).
- **워치독 이중발행 경쟁 재검**: emit 3지점(relay L200-222 / ai_cancel L224 / 교체 L156)을 모두 Read. `finished` 미참여 2지점 확정 → Major 1 근거 견고.
- **Exclusions 구체성 재독**: 9종 중 truncated 죽은 코드(card.ts:1059 실측 일치)·히스토리·랭킹·outline 비대화·채팅·자동트리거·length 확장·진행률·의존성 명명. 크리프 0.
- **모순 스윕**: REQ-013("발행부 3곳"에 length) vs REQ-014(continue 전용) — L390 section-fill 포함으로 **모순 확정**(Major 2). REQ-003(파급 금지) vs D1(인라인 조립 지점 한정) — `build_inline_prompt`가 `feature.system_prompt()` 뒤 부착이고 section/continue는 별도 조립이므로 양립(모순 아님, 설계 건전).

신규 결함: Major 2를 실측 Read로 1차→확정, Major 1을 emit 3지점 대조로 확정. F2·F3 좌표 드리프트 2차 확정. Critical 없음.

---

## 회귀 점검 (Iteration 2+ 전용)
N/A — iteration 1.

---

## 권고

PASS(0.85). Must-pass 무실패·Critical 0으로 착수 가능하나, **Major 2건은 Run 착수 전 정정 강권**(둘 다 문서·설계 텍스트 수정으로 해소, 코드 재설계 불요):

1. **M1(우선)** spec.md REQ-AI6-006 / Delta / plan D2 — 단일발행 선점을 (i) 릴레이가 **Silent 포함 모든 EOF에서 finished claim**, (ii) `ai_cancel`(mod.rs:224)·교체 emit(mod.rs:156)도 **발행 전 finished claim**하도록 확장. 그렇지 않으면 취소·타임아웃 근접 시 이중발행으로 AC-AI6-002·엣지(acceptance.md:L90) 위반.
2. **M2** spec.md REQ-AI6-013 / Delta L152 / plan T5 — "이어쓰기 발행부"를 **2곳(ghost-text.ts:421/452)**으로 정정(L390 제외). REQ-AI6-014와의 자기모순 제거.
3. **F2/F3** plan T5·spec 카드 스켈레톤 좌표를 실좌표(aiRequest 421/452, 스켈레톤 287-294)로 동기화.
4. **F4~F7** 비차단 — frontmatter 필드명·헤딩 라벨·shall-text HOW 격리·하위문서 frontmatter 미러링.

Requirements 골격·AC 오라클·Exclusions·도그푸딩 시나리오(A-1/A-2/R-1/R-2 실측 일치)는 재작업 불요. M1·M2 정정 시 코드 정합성 ~0.92·내부 일관성 ~0.92·종합 ~0.91 예상.

판정: **PASS (0.85) — Major 2건 선해소 권장**
