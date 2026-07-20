# SPEC 감사 보고서: SPEC-AI-004 (AI 프롬프트 핫픽스)
반복(Iteration): 1/3
판정(Verdict): **PASS**
종합 점수: **0.93** (임계 0.90)

> M1 컨텍스트 격리 준수: 작성자 추론 맥락은 무시하고 문서 5종(spec.md / spec-compact.md / plan.md / acceptance.md / research.md)과 실제 main 코드(731f05f)만으로 감사함. SPEC-AI-003-review-1.md는 형식·채점 기준 참조용으로만 사용.

---

## Must-Pass 결과

- **[PASS] MP-1 REQ 번호 일관성**: REQ-AI4-001~012 (spec.md:L68~L118) 종단 확인 — 001,002,003(모듈1)·004,005(모듈2)·006,007(모듈3)·008,009,010(모듈4)·011,012(모듈5). 결번·중복 없음, 3자리 제로패딩 일관. spec-compact.md(L29~L52)도 동일 서열.
- **[PASS] MP-2 EARS 형식**: 12개 전부 5개 패턴 중 하나에 정합.
  - Event-driven(WHEN…the system shall): REQ-001(L68), 005(L86), 009(L106).
  - Ubiquitous(The system shall): REQ-002(L72), 004(L82), 006(L92), 008(L102), 011(L116), 012(L118).
  - Unwanted(IF…then the system shall): REQ-003(L76), 007(L96), 010(L110).
  Given-When-Then은 acceptance.md에만 존재하며 EARS로 오표기되지 않음.
- **[PASS] MP-3 YAML frontmatter**: spec.md:L1~L21에 id(SPEC-AI-004)·version("0.1.0")·status(draft)·created("2026-07-17", ISO)·priority(high)·tags(배열 5종) 전부 존재·정형. dependencies(SPEC-AI-001/002/003)·lifecycle(spec-anchored)도 포함 — SPEC-AI-003 iteration-1의 FAIL 원인(tags 누락)이 이번엔 해소됨.
- **[N/A] MP-4 언어 중립성**: 단일 제품 SPEC(Rust/Tauri + TS/CodeMirror). 다중 언어 툴링 범위 아님.

---

## 감사 차원별 점수 (요청된 6차원)

| 차원 | 점수 | 근거(파일:섹션) |
|------|------|------------------|
| 1. EARS 적합성 | 0.92 | 12개 전부 패턴 정합. 관찰 가능 계약(바이트 동일·contains 키워드). 감점: REQ-008/009 정상 텍스트에 구현 식별자·정규식 원문 노출(HOW 누수, 아래 F3) |
| 2. Traceability | 0.86 | REQ 12개 전부 ≥1 AC 매핑·역방향 실재. 결함 D-A~D-D → REQ·AC·T1~T4 끊김 없음. 그러나 **AC-AI4-009 REQ 라벨 "001~006"이 실제 검증 대상(s10=D-C=REQ-008, s02=D-D=REQ-007)을 누락**(F1, major) |
| 3. Verifiability | 0.90 | D2 수동 게이트 기준 정확 명시(치명 0/3·품질 ≤1/3, acceptance.md:L88). 시나리오 판정 기계적(acceptance.md:L100~L111). 감점: 입력 "요지"만 고정·전문은 스크래치 의존(F4) |
| 4. 코드 정합성 | 0.97 | 인용 좌표 전부 라인 단위 일치. 회귀면 :570-575 예측이 실제 테스트와 정확 부합(아래 검증). 사소 off-by-one만 |
| 5. Scope 규율 | 0.96 | Exclusions 8종 구체·결함 4종 전부 커버·스코프 크리프 없음 |
| 6. Risk 완전성 | 0.95 | 교차오염·haiku 한계·D6 회귀 위장 전부 다룸(plan.md:L103~L113, L44) |

종합 = 6차원 평균 ≈ 0.9267 → **0.93**. Must-pass 무실패 + 임계 0.90 초과 → **PASS**.

---

## 코드 정합성 spot-check (실제 main @ 731f05f Read 결과)

| 문서 주장 | 실제 코드 | 판정 |
|---|---|---|
| COMMON_INSTRUCTION prompt.rs:16-18 | L16-18 일치("결과 텍스트만 출력하라…요청받은 경우에만") | ✓ |
| Continue base prompt.rs:101-103 | L101-103 일치(문자열 L102) | ✓ |
| Diagram system_prompt prompt.rs:86-91 | 어깨 L86-91, 문자열 L90("```mermaid 코드펜스나…없이") | ✓ |
| 조건부 뒤 문맥 지시 prompt.rs:234-243 | L234-243, L240 원문 "…반복하거나 선점하는 것은 금지한다" 정확 일치 | ✓ |
| build_inline_prompt prompt.rs:151-178 | L151-178 일치, 문맥 조립 L160-171 | ✓ |
| stripMermaidFence ai-suggestion-card.ts:870-874, 정규식 `/```mermaid\s*\n([\s\S]*?)```/` | L871-874, 정규식 원문 정확 일치 | ✓ |
| handleDiagramComplete :800-816, strip=:804/validate=:805 | L800/L804/L805/L806 일치 | ✓ (호출부 :788 주장 → 실제 L789, off-by-one) |
| ensureMermaidFence :881-885 | L881-885 일치 | ✓ |
| 테스트 파일 :398-411 기존 3케이스 | src/test/aiSuggestionCard.test.ts:397 describe + 398-412 3케이스 | ✓ |

**회귀면 핵심 주장 검증** — plan.md:L42/L109·research.md §4.1이 `continue_prompt_omits_after_instruction_when_after_empty`(:570-575)의 `!contains("금지")`가 D-D/D-B 지시로 파손될 것이라 예측. 실제 prompt.rs:570-575 확인:
```
assert_eq!(prompt.system_prompt, AiFeature::Continue.system_prompt());  // L573
assert!(!prompt.system_prompt.contains("금지"));                         // L574
```
→ 예측 정확. D-B("재복창 금지")가 Continue base에 "금지" 어휘를 주입하면 L574 파손 확정. `assert_eq!`(L573)는 base 수정으로 양변 동시 변경돼 유지된다는 논리도 코드상 타당. D6 개정 대상 특정(`!contains("금지")` → `!contains("뒤 문맥")`) 근거 견고. 나머지 회귀 테스트(:351-356, :410-426, :484-501, :562-568, :368-386)도 실제 단언이 문서 서술과 정확 일치, 무개정 통과 가정 성립.

일반화 정규식 `/```[a-z]*\s*\n([\s\S]*?)```/i`를 기존 3케이스(:400/:405/:410-411)에 수기 대입 → 전부 기존 기대값 유지(무태그·prose-wrap·무펜스 모두 정상). AC-AI4-007 기계 판정 가능.

---

## 결함 목록

**F1 [major] — acceptance.md:L84 / spec.md:L145: AC-AI4-009 REQ 매핑 라벨 오기**
AC-AI4-009는 결함 5종(s07/s09/s10/s11/s02)을 재실행하며 Then(acceptance.md:L88)에서 **s10(D-C)·s02(D-D)를 명시 검증**한다. 그러나 REQ 라벨은 "REQ-AI4-001~006"으로, D-C의 REQ-008(다이어그램 양성 예시, s10이 직접 검증하는 대상)과 D-D의 REQ-007을 누락. 정확한 라벨은 최소 "REQ-AI4-001~008"이어야 함. 단, 해당 REQ들은 AC-005/006/007에서 별도 커버되어 **고아 REQ는 없음**(총 커버리지 무결) → 매트릭스 정밀도 결함이지 커버리지 공백 아님. 그래도 문서 교차 대조의 신뢰성을 훼손하므로 수정 필요.

**F2 [minor] — spec.md:L9 / plan.md:L9 / acceptance.md:L9: `issue_number: 0`**
존재하지 않는 이슈 #0 placeholder. SPEC-AI-003 감사 D2와 동일 패턴. `null` 또는 실제 이슈 번호 권장.

**F3 [minor] — spec.md:L102, L106: 정상(normative) 텍스트에 구현 세부 노출**
REQ-AI4-008 shall절이 테스트 함수명(`diagram_prompt_forbids_markdown_fence_output`)과 단언식(`!contains("코드펜스로 감싸")`)을, REQ-AI4-009가 정규식 원문(`/```[a-z]*\s*\n([\s\S]*?)```/i`)을 WHAT이 아닌 HOW로 포함. SPEC-AI-003 D3와 동종. "사전 합의 설계 결정(재검토 금지)" 섹션(spec.md:L46)이 브라운필드 고정 제약으로 정당화하나 WHAT/HOW 경계는 흐림. 비차단.

**F4 [minor] — acceptance.md:L96~L98: 수동 게이트 입력 재현성 부분적**
시나리오 고정 표가 입력 "요지"와 판정 기준만 고정하고 전문은 세션 스크래치 의존("스크래치 소실 대비"). haiku 출력은 입력 민감 → 스크래치 소실 시 0/3·≤1/3 게이트의 엄밀 재현이 저하. 판정 기준 자체는 기계적으로 고정돼 있어 심각도 낮음. 공개적으로 인정된 한계.

**F5 [minor] — acceptance.md:L1~L10 / plan.md:L1~L10: 하위 문서 frontmatter 축소**
spec.md는 tags/dependencies/lifecycle 포함하나 acceptance.md·plan.md frontmatter는 미포함. SPEC-AI-003 감사 권고(미러링)와 불일치. 감사 대상은 spec.md라 MP-3 무영향, 일관성상 minor.

**F6 [minor, 정보] — research.md:L101: 미정의 시나리오 s12 참조**
"s01/s02/s03/s11/s12" 중 s12는 본 SPEC 어느 표에도 정의 없음(SPEC-AI-003 시나리오 세트 잔재). 판정 무영향.

---

## Chain-of-Verification (2차 자기비판)

재독으로 확인:
- **REQ 서열 종단 재확인**(스팟 아님): spec.md 001~012 연속, spec-compact.md 라벨(E/U/Un)까지 교차 일치.
- **Traceability 역방향 전수**: spec.md:L135-146 표에서 REQ별 역맵 구성 → 001~012 전부 ≥1 AC. F1(AC-009 라벨) 외 매핑 오류 없음. acceptance.md AC 헤더 REQ 참조가 spec 표와 1:1(AC-009 제외 전부 일치).
- **결함 4종 종단**: D-A→REQ-001/002/003→T2→AC-001/002/003, D-B→REQ-004/005→T1→AC-004, D-D→REQ-006/007→T1→AC-005, D-C→REQ-008/009/010→T3→AC-006/007/008. 자동 게이트 경로 전부 무결. 수동 경로만 F1.
- **Decision D1~D6 반영**: D1(환경 L48), D2(AC-009 기준 L88), D3(REQ-008+009), D4(REQ-002), D5(REQ-004/005/006), D6(사전합의5 L52 + Delta L126 + plan D6열거 L38-47 + DoD). 전부 요구사항/AC/태스크에 착지.
- **코드 좌표 전수 대조**: 위 표대로 Read로 라인 확인 — 실 코드와 라인 단위 부합(사소 off-by-one 2건). 회귀 예측 :570-575는 실제 단언과 정확 일치.
- **Exclusions 구체성 재독**: 8종 전부 구체 아티팩트(함수·필드·decision ID) 명명 — 모호 항목 없음.
- **모순 스윕**: REQ-006(새 형식 도입 금지) vs REQ-007(코드 인접 산문 정당 이어쓰기 허용) — 온건형/절대금지형 구분으로 양립(모순 아님). Continue base(D-B/D-D) vs FillSection 분리 격리(AC-002 And, T1 `fill_section_prompt_has_no_continue_only_guards`)로 오염 차단.

신규 결함: F6(s12 잔재) 1건 추가. 기존 F1~F5 유지.

---

## 회귀 점검 (Iteration 2+ 전용)
N/A — iteration 1.

---

## 권고

PASS(0.93). 차단 결함 없음. 코드 정합성·Scope·Risk는 매우 높음. 다음 최소 편집으로 정밀도 보강 권장(전부 비차단):

1. **F1(우선)** acceptance.md:L84 및 spec.md:L145 — AC-AI4-009 REQ 라벨 "REQ-AI4-001~006" → "REQ-AI4-001~008"(s10=REQ-008, s02=REQ-006/007 검증 반영). 매트릭스 역방향 정합 회복.
2. **F2** spec/plan/acceptance L9 — `issue_number: 0` → `null` 또는 실제 번호.
3. **F5** acceptance.md·plan.md frontmatter에 tags/dependencies/lifecycle 미러링(SPEC-AI-003 권고 일관).
4. **F3/F4/F6** 비차단 — 사전 합의 설계 섹션으로 수용 가능. F4는 Run 단계에서 조립 프롬프트 전문을 manual-verification.md에 함께 고정하면 완화.

Requirements 본문·AC 오라클·Exclusions의 내용 재작업은 불필요. F1 라벨 수정만으로 Traceability가 ~0.95로 상승, 종합 ~0.95 예상.

판정: **PASS (0.93)**
