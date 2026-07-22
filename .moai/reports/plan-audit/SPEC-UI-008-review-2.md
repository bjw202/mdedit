# SPEC Review Report: SPEC-UI-008
Iteration: 2/3
Verdict: PASS
Overall Score: 0.97

Note: 호출 프롬프트에 담긴 작성자의 수정 주장(remediation summary)은 M1 Context Isolation에 따라 미검증 주장으로 취급하고 무시했다. 모든 수정은 디스크에서 읽은 spec.md v0.0.2와 acceptance.md v0.0.1에 대해 독립적으로 재검증했다. 스니펫은 mermaid 11.12.3으로 재파싱했다.

## Must-Pass Results

- [PASS] MP-1 REQ 번호 일관성: REQ-UI-008-001 ~ 022를 끝까지 개별 확인(spec.md:L73–L103). Ubiquitous 001–006(L73–78), Event 007–012(L82–87), State 013–016(L91–94), Unwanted 017–022(L98–103) = 6+6+4+6 = 22개. bold 정의 라인 수 = 22, `grep`로 001–022 각 1회 정의 확인. 순차·결번 0·중복 0·3자리 zero-padding 일관. spec.md 내 모든 REQ 참조가 001–022 범위 내이며 stale ID(구 016=AI 토글 등) 잔존 없음. AC ID 001–013 순차(L245–L257).
- [PASS] MP-2 EARS 형식 준수: Ubiquitous 001–006 "The system shall …"(L73–78, REQ-006 AI-토글 요구가 긍정형이므로 Ubiquitous로 이동됨 — D1); Event 007–012 "WHEN …, the system shall …"(L82–87); State 013–016 "WHILE …, the system shall …"(L91–94); Unwanted 017–022 전부 "The system shall not [긍정 동사]"(L98–103, 단일 부정, 이중부정 없음). Unwanted 절에 긍정형 요구 잔존 없음. acceptance.md의 AC는 Given-When-Then으로 올바르게 라벨링됨(L24–L133), EARS 위장 없음.
- [PASS] MP-3 YAML frontmatter 유효성: spec.md — id "SPEC-UI-008"(L2), version "0.0.2" 문자열(L3), status "draft"(L4), created "2026-07-22" ISO(L5), priority "medium"(L8), tags 6개 문자열 배열(L15–21). 프로젝트 표준 스키마(`created`/`tags`) 일치. acceptance.md frontmatter도 id/version/status/created/priority 완비(L2–8).
- [N/A] MP-4 Section 22 언어 중립성: N/A — 단일 언어 SPEC(mdedit TypeScript/React; spec.md:L34, L61).

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 1.00 | 1.0 (단일 명확 해석) | 비이진 "16–24px 판독 가능" 문구가 정규 요구에서 제거되어 Design Notes로 이관(L218, "수용 기준이 아닌 참고 지표"). REQ-002/003/005 분해로 각 요구가 단일 관심사(SVG+currentColor / 형상 구별 / 토큰·raw hex). 비규범 콘텐츠는 "요구사항 아님(AC 없음)" 명시 하에 격리(L216) |
| Completeness | 0.95 | 1.0 (전 섹션 존재) | spec.md 전 섹션 완비(HISTORY L25 정확한 0.0.2 changelog L30 / WHY L46 / WHAT L32 / HOW=Delta L223 / Requirements L67 / AC L239 / Exclusions 9항목 L267–275). acceptance.md 신규 작성(G-W-T 13건 + Quality Gate Criteria L135 + DoD L147). -0.05: plan.md 부재(아래 비차단 관찰 O2 — plan-audit 단계 비차단) |
| Testability | 1.00 | 1.0 (모든 AC 이진) | AC-004 스니펫 parse는 감사자가 mermaid 11.12.3으로 7종 전부 PASS 재확인(증거 갱신). REQ-002 "`<svg>` 렌더 + `currentColor` 상속"(L74) 이진; REQ-003 "서로 다른 SVG path 마크업"(L75) 이진(AC-002 중복 0 검증); weasel "정상 동작" 제거됨. AC-006/007용 `PreviewRenderer.test.tsx`가 Delta에 명시(L235) |
| Traceability | 1.00 | 1.0 (양방향 완전 커버) | REQ 001–022 전수가 AC에 매핑(spec.md L259 대조표 + 감사자 재대조). AC-013(신규)이 회귀 가드 019/021/022 커버. spec.md AC 표(L245–257) ↔ acceptance.md AC 헤더(L24–133) 13건 REQ 매핑 pairwise 완전 일치. orphan AC 0, uncovered REQ 0 |

## Defects Found

차단 결함 없음 — Chain-of-Verification Pass에서 확정.

비차단 관찰(수용 가능, 후속 권장):
- **O1 (경미, 문서 버전 스큐)**: acceptance.md frontmatter version "0.0.1"(L3)이 spec.md "0.0.2"(L3)와 불일치. 단 acceptance.md는 이번 반복에서 신규 생성된 문서로 자체 첫 개정이 0.0.1인 것은 이력상 타당하며, 내용은 spec.md와 1:1 정합한다. 선례 UI-007은 두 문서를 동일 버전으로 맞췄으므로, 차기 편집 시 acceptance.md를 spec.md 버전에 정렬하면 교차 문서 추적이 깔끔해진다. — 비차단.
- **O2 (경미, plan.md 부재)**: 아래 "plan.md 판정" 참조. plan-audit 단계에서는 비차단.

## plan.md 부재 판정 (코디네이터 요청 명시 답변)

plan.md 부재는 **plan-audit 승인을 차단하지 않으며, /moai run 진입 게이트로 이연 가능**하다고 판정한다. 근거:

1. plan-auditor의 검증 대상 및 must-pass(MP-1~4)는 모두 spec.md의 EARS·추적성·테스트 가능성·frontmatter 품질에 관한 것으로, 어느 것도 plan.md 존재에 의존하지 않는다. 4개 must-pass 전부 spec.md/acceptance.md만으로 PASS.
2. plan.md는 구현 작업 분해(task breakdown) 아티팩트로, spec-workflow.md 상 Plan→Run 전환 및 Run phase 진입에 속한다. 본 SPEC의 Delta 표(L225–237)가 변경 파일 10건 + 테스트 4건을 이미 열거하여 경량 구현 계획을 대체하고 있다.
3. 따라서 plan.md는 승인 게이트 통과 후 `/moai run` 진입 시 tasks.md/plan.md 생성 단계에서 채우는 것이 워크플로 순서에 부합한다. 승인 전 필수 산출물이 아니다.

권고: 승인 게이트에서 "plan.md/tasks.md는 run 진입 시 생성 예정"임을 사용자에게 한 줄로 고지할 것(누락이 아니라 이연임을 명확히).

## Chain-of-Verification Pass

2차 재검토 대상: 전체 REQ L73–L103(22개 개별 정독), AC 표 L245–L257 및 커버리지 대조표 L259, acceptance.md AC 헤더 L24–L133, Delta L225–L237, Design Notes L216–L221 cross-reference, 스니펫 L109–L212.

- **재번호 무결성(최대 위험) 전수 검증**: `grep`로 spec.md의 REQ 참조를 전수 추출 → 전부 001–022 범위, 구 번호(v1의 016=AI 토글, 020=17종+단축키 등) 잔존 0. 본문 내 cross-reference 정합: 스니펫 섹션 "REQ-UI-008-009"(L107, 프리셋 커서 배치=Event 009 ✓), 사용자 정의 "REQ-UI-008-010"(L206 ✓), Design Notes "002/003"(L218)·"009/010"(L219)·"013"(L220 ✓), Delta "REQ-013/014"(L232, L235 ✓), REQ-022의 "REQ-UI-008-012" 자기참조(L103, 드롭다운 키보드 조작 ✓) — 모두 의미상 정확.
- **REQ→AC 전수 매핑 재대조**: L259 대조표(001→AC2 … 022→AC13)를 실제 AC 표(L245–257)의 Requirement 열과 항목별 대조 — 22개 전부 일치, 결번·중복·stale 없음. AC-013이 019/021/022를 커버해 review-1의 D2(미커버 REQ 018/020)가 완전 해소됨(현 번호 019/021/022).
- **spec.md ↔ acceptance.md 1:1 정합**: 13개 AC 각각의 REQ 매핑을 두 문서에서 pairwise 대조 — AC-001(004,007), 002(001,002,003), 003(008,009), 004(008,020), 005(010), 006(013), 007(014), 008(015), 009(016), 010(011,012), 011(005), 012(006,017,018), 013(019,021,022) — 전부 동일. 게이트 기준 모순 없음(acceptance.md Quality Gate L135–145와 spec.md Quality Gates L261 일치, lint=PR #37 정상 게이트 서술 일관).
- **스니펫 무변경 spot-check + 런타임 재검증**: 7종 펜스 본문을 추출해 v1과 바이트 동일 확인, mermaid 11.12.3 `mermaid.parse`로 7종 전부 PASS 재확인. 빈 문자열은 "No diagram type detected …" throw → REQ-013(빈 본문 시 parse 생략·플레이스홀더) 전제 유효. review-1의 런타임 검증 유효성 유지.
- **모순 스캔**: Unwanted 017–022 전부 shall-not 단일부정; REQ-006 긍정형이 Ubiquitous에 적절 배치. Exclusions(단축키 없음 L270)와 REQ-012(드롭다운 내 키보드 조작)은 REQ-022가 "전역 단축키 등록 아님"으로 명시 carve-out(L103) — 충돌 없음. 확정 범위(7 프리셋+빈 펜스, AI 범위 밖) 대비 은근한 확장 없음.
- **HISTORY 정확성**: spec.md 0.0.2 changelog(L30)가 D1~D6 실제 수정 내용과 일치, 과대 주장 없음(신 REQ-006/002·003·005/021·022, AC-013, acceptance.md 신규, PreviewRenderer.test 추가 모두 실재 확인).

2차 재검토 신규 결함: 없음 — 1차가 철저했음을 위 섹션 재독으로 확인.

## Regression Check (Iteration 2+ only)

review-1(SPEC-UI-008-review-1, FAIL 0.71) 결함 처리 결과:

- **D1 (major, REQ-016 긍정형이 Unwanted에 오분류 + "정상 동작" weasel)**: [RESOLVED] — AI-토글 요구가 Ubiquitous 절 REQ-UI-008-006으로 이동(L78), "정상 동작시킨다" → 이진 술어 "AI 토글 상태를 참조하지 않고 … 노출하며, 비활성 상태에서도 … 삽입 동작을 동일하게 수행한다"로 치환. Unwanted 절(017–022)은 전부 shall-not(L98–103). AC-012(L256)로 검증 연결.
- **D2 (major, REQ-018/020 미커버 uncovered REQ)**: [RESOLVED] — 신규 AC-UI-008-013(L257, acceptance.md L127)이 회귀 가드 REQ-019(의존성 0)/021(프리셋 8항목 고정)/022(markdownKeyBindings 무변경)를 커버. spec.md L259 커버리지 대조표에서 001–022 전수 매핑 확인, 미커버 REQ 0.
- **D3 (major, acceptance.md 부재 + dangling 참조)**: [RESOLVED] — acceptance.md 신규 작성(G-W-T 13건 L24–133 + Quality Gate Criteria L135 + DoD L147). spec.md 주석이 "승인 게이트 이후 작성" → "본 SPEC과 함께 작성됨"(L241)으로 갱신, L261의 "acceptance.md Quality Gate Criteria 참조"가 실존 섹션(acceptance.md:L135)을 가리킴.
- **D4 (minor, REQ-002 비이진 판독성)**: [RESOLVED] — REQ-002가 "`<svg>` 렌더 + `stroke=currentColor` 상속"으로 이진화(L74). "16–24px 판독 가능"은 Design Notes로 완전 이관되며 "수용 기준이 아닌 참고 지표"로 명시(L218).
- **D5 (minor, Delta에 PreviewRenderer 테스트 누락)**: [RESOLVED] — Delta에 `[MODIFY] src/test/PreviewRenderer.test.tsx`(빈-펜스 플레이스홀더 검증, REQ-013/014, AC-006/007 연결) 추가(L235). acceptance.md Quality Gate에도 반영(L140).
- **D6 (minor, REQ 원자성)**: [RESOLVED] — 구 REQ-002(4관심사)를 002(SVG+currentColor)/003(형상 구별)/005(토큰·raw hex)로 분해; 구 REQ-020(17종+단축키)을 021(프리셋 8항목 고정)/022(markdownKeyBindings 무변경)로 분해. 클린 재번호 001–022 순차 확인.

6개 결함 전부 해소. 정체(stagnation) 결함 없음. 수정 과정에서 신규 결함 유입 없음.

## Recommendation

PASS. must-pass 기준별 근거:
- MP-1: REQ-001..022 순차·유일, spec.md/acceptance.md 교차 정합(spec.md:L73–L103, 커버리지 대조표 L259).
- MP-2: 22개 요구 전부 shall/shall-not EARS 패턴 준수, Unwanted 절 긍정형 잔존 0; G-W-T AC 13건이 올바르게 라벨링·1:1 추적.
- MP-3: 양 문서 frontmatter 완비·타입 정상(프로젝트 스키마).
- MP-4: N/A(단일 언어 SPEC).

본 SPEC은 주석/승인 게이트로 진행 가능하다. 추가 plan-auditor 반복은 불필요하다. 승인 시 (O1) acceptance.md 버전을 spec.md에 정렬, (O2) plan.md/tasks.md는 `/moai run` 진입 시 생성 예정임을 사용자에게 고지하는 두 가지 경미 후속만 남긴다(둘 다 비차단).
