# SPEC Review Report: SPEC-AI-008
Iteration: 2/3
Verdict: PASS
Overall Score: 0.96

Note: 호출 프롬프트의 수정 주장(remediation summary)은 M1 Context Isolation에 따라 미검증 주장으로 취급하고, 모든 수정을 디스크의 spec.md v0.0.2 및 현재 브랜치(`feature/SPEC-UI-008-diagram-insert-menu`)의 실제 Rust/TS 소스에 대해 독립 재검증했다. **특히 D1(RED phase를 깨뜨렸을 함정)은 prompt.rs 실제 코드에 대해 엄격 대조했다.**

## Must-Pass Results

- [PASS] MP-1 REQ 번호 일관성: REQ-AI-008-001 ~ 025 개별 확인(spec.md:L85–L118). Ubiquitous 001–005, Event 006–013, State 014–016, Unwanted 017–025 = 5+8+3+9 = 25. bold 정의 25개, `grep` 유니크 25개, 순차·결번 0·중복 0. 신규 REQ-025는 Unwanted 절 말미에 정상 삽입(L118). AC ID 001–014 순차(L169–L182). stale 카운트("24"/"13") 잔존 없음 — 인트로 L165·대조표 L184 모두 "001~025"로 갱신됨.
- [PASS] MP-2 EARS 형식 준수: Ubiquitous 001–005 "The system shall 항상 …"; Event 006–013 "WHEN …, the system shall …"; State 014–016 "WHILE …, the system shall …"; Unwanted 017–025 전부 "The system shall not [긍정 동사]"(단일 부정). REQ-025도 "shall not 변경한다"(L118) 단일 부정. REQ-017은 순수 shall-not + 근거 괄호로 정정(D5).
- [PASS] MP-3 YAML frontmatter 유효성: id "SPEC-AI-008"(L2), version "0.0.2" 문자열(L3), status "draft"(L4), created "2026-07-22" ISO(L5), priority "medium"(L8), tags 7개 배열(L17–24). 프로젝트 표준 스키마.
- [N/A] MP-4 언어 중립성: N/A — 단일 프로젝트 SPEC(mdedit TS+Rust 특정 기능, 템플릿 바운드 범용 콘텐츠 아님).

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 1.00 | 1.0 (단일 명확 해석) | 프롬프트 조립 모델이 이제 소스와 정확히 일치 — Summary(L50)/REQ-018(L111)이 "공유 `build_inline_prompt`, 조립 = `system_prompt() + \n\n + INLINE_SCOPE`"로 서술, prompt.rs:196과 바이트 대응. 종류 게이팅이 "feature가 Diagram일 때만"으로 명시(L97) |
| Completeness | 0.95 | 0.75–1.0 사이 | 전 섹션 완비 + AC 14건 인라인. -0.05: acceptance.md/plan.md 부재(ACs가 spec.md 인라인이라 plan-audit 비차단, O3) |
| Testability | 1.00 | 1.0 (모든 AC 이진) | **AC-004가 이제 미변경 코드에서 통과하는 올바른 스냅샷 불변식**(현행 조립 결과와 바이트 동일, prompt.rs:196 대조 확인). REQ-006 이진화("hover 시 연다", L93), REQ-023 이진화("`d` path 문자열 동일", L116). REQ-025 회귀 가드는 기존 테스트 `inline_scope_clause_present_for_all_six_inline_features`(prompt.rs:713)에 근거 |
| Traceability | 1.00 | 1.0 (양방향 완전) | REQ 001–025 전수가 AC에 매핑(대조표 L184 ↔ AC 표 L169–182 항목별 일치). orphan AC 0, uncovered REQ 0. REQ-023은 AC3(단일 소스)·AC14(렌더 무변경) 이중 매핑, REQ-025→AC14 — 모두 정합 |

## Defects Found

차단 결함 없음 — Chain-of-Verification Pass에서 확정.

비차단 관찰(수용 가능, 후속 권장):
- **O1 (경미, AC-014 이종 결합)**: AC-014(L182)가 D3(TS 아이콘 렌더 무변경)와 D2(Rust 비-diagram 5기능 프롬프트 바이트 동일) 두 가지를 한 AC로 묶는다. 두 어서션은 서로 다른 테스트 레이어(diagramIcons 테스트 vs prompt.rs `#[cfg(test)]`)에 속한다. 단 (a) 각각 REQ-023/REQ-025로 개별 추적되고 각기 이진 검증 가능하며, (b) 본 SPEC의 회귀-가드 AC 관례(AC-013도 5개 이종 가드 번들)와 일관된다 → 비차단. 테스트 스위트 명료성을 위해 AC-014를 아이콘/프롬프트 2개로 분할하면 개선(선택).
- **O2 (경미, Delta 테스트 파일명 부정확)**: Delta L157이 아이콘 회귀 테스트 대상을 "`src/test/icons.test.tsx` 또는 인접 아이콘 테스트"로 적으나 `src/test/icons.test.tsx`는 부재하고 실제 UI-008 다이어그램 아이콘 테스트는 `src/test/diagramIcons.test.tsx`(실재)다. "또는 인접" 헤지가 있어 dangling 참조는 아니나, 실제 파일명(`diagramIcons.test.tsx`)으로 명시하면 정확해진다 → 비차단.
- **O3 (경미, acceptance.md/plan.md 부재)**: AC 14건이 spec.md에 인라인되어 있어 plan-audit 승인은 차단하지 않으며, 별도 acceptance.md/plan.md 생성은 `/moai run` 진입 게이트로 이연 가능(SPEC-UI-008 감사와 동일 판정). 승인 시 사용자에게 "run 진입 시 생성 예정" 한 줄 고지 권장.

## Chain-of-Verification Pass

2차 재검토 대상: 전체 REQ L85–L118(25개 개별 정독), AC 표 L169–182 및 대조표 L184, Fragments 표 L124–132, Delta L150–161, Design Notes L140–146, Rust/TS 소스 앵커.

- **D1 엄격 재검증(RED 함정)**: prompt.rs:196 = `system_prompt: format!("{}\n\n{}", feature.system_prompt(), INLINE_SCOPE)` 실측. REQ-018(L111)·AC-004(L172)의 새 앵커 "현행 조립 결과(= `AiFeature::Diagram.system_prompt()` + `\n\n` + INLINE_SCOPE)와 바이트 동일"은 이 코드와 **정확히 일치** → AC-004는 미변경 코드에서 스냅샷 등가로 통과한다(review-1에서 지적한 "변경 전에도 실패" 함정 해소). 확정 RESOLVED.
- **D2 재검증**: mod.rs:147 `_ => build_inline_prompt(...)` — 격리 Diagram 분기 부재, 공유 경로 실측. REQ-010(L97)·Delta(L154–155)가 "공유 `build_inline_prompt` 경로 안에서 feature가 Diagram일 때만" 게이팅으로 정정되어 코드 현실과 부합. INLINE_SCOPE가 6기능(polish/outline/table/diagram/shorten/custom, prompt.rs:24) 커버 → REQ-025의 "비-diagram 5기능"(polish/outline/table/shorten/custom)이 정확. 기존 테스트 `inline_scope_clause_present_for_all_six_inline_features`(prompt.rs:713)가 회귀 가드 근거로 실재. 확정 RESOLVED.
- **REQ→AC 전수 재대조**: 대조표 L184의 25개 매핑을 AC 표 Requirement 열과 항목별 대조 — 전부 일치. AC1(005,006,007)/AC2(001,004)/AC3(002,023)/AC4(008,018)/AC5(009)/AC6(010)/AC7(011,015)/AC8(012)/AC9(013)/AC10(014,017)/AC11(016)/AC12(003)/AC13(019,020,021,022,024)/AC14(023,025). uncovered REQ 0, orphan AC 0.
- **회귀 없음 spot-check(이전 검증 양호 항목)**: 코드 앵커(ai-selection-toolbar.ts:128/622/692, fireReRequest:1101 스프레드, mod.rs serde(default)/no deny_unknown_fields, prompt.rs:101–106, icons.tsx:279–333 7종)는 브랜치 무변경으로 유효 유지. IPC 하위호환 불변. 7종 프롬프트 조각 키워드(L126–132) v1과 동일, `stateDiagram`→`stateDiagram-v2` 매핑 유지 — parse 파손 없음. 스코프 경계(REQ-020 UI-008 무변경, icons.tsx만 UI-008 파일 접촉하되 REQ-023/025+AC-14로 가드) 유지.
- **재번호 무결성**: REQ 24→25, AC 13→14 재번호 후 stale 카운트/참조 없음 확인(인트로·대조표·Delta·Fragments 인트로·Design Notes 모두 갱신). Fragments 인트로(L122)가 "feature가 Diagram일 때만 ... 비-diagram 5기능 경로는 게이팅에 진입하지 않는다(REQ-025)"로 신규 REQ와 정합.
- 2차 신규 차단 결함: 없음. Exclusions 10항목 구체적, 요구와 모순 없음.

## Regression Check (Iteration 2+ only)

review-1(SPEC-AI-008-review-1, FAIL 0.80) 결함 처리 결과:

- **D1 (major, 바이트 동일 불변식 오설정)**: [RESOLVED] — REQ-018(L111)·AC-004(L172)·Summary(L50)가 `Diagram.system_prompt()` 단독 → 실제 조립 결과(`system_prompt() + \n\n + INLINE_SCOPE`, prompt.rs:196)로 재앵커. AC-004는 미변경 코드 통과 스냅샷 등가로 진술. 코드 대조 정확.
- **D2 (major, 비-diagram 5기능 회귀 미가드)**: [RESOLVED] — 신규 REQ-025(L118, Unwanted)가 polish/outline/table/shorten/custom 조립 프롬프트 바이트 동일 보증. 신규 AC-014(L182) + Delta prompt.rs `#[cfg(test)]` 5기능 회귀 테스트 행(L160). REQ-010/Delta가 "공유 경로 내 diagram 전용 게이팅"으로 정정되어 격리 분기 부재 현실과 부합.
- **D3 (minor, icons.tsx 리팩터 회귀 미가드)**: [RESOLVED] — REQ-023(L116)이 "양쪽 소비자 렌더 path 문자열 동일 + 추출 후 JSX 아이콘 7종 렌더 SVG(`d` path) 무변경"으로 이진화. AC-014 + Delta 아이콘 테스트 행(L157) 추가(실제 파일은 `diagramIcons.test.tsx` — O2).
- **D4 (minor, REQ-006 비이진 지연)**: [RESOLVED] — REQ-006(L93)이 "hover 시 서브메뉴를 연다"로 이진화, 지연은 Design Notes(L141)로 이관.
- **D5 (minor, REQ-017 금지+긍정 혼합)**: [RESOLVED] — REQ-017(L110) 본문이 순수 shall-not, 긍정 단언은 "(근거: … Design Notes 참조.)" 괄호 + Design Notes(L146)로 분리.

5개 결함 전부 해소. 정체 결함 없음. 수정 과정에서 신규 차단 결함 유입 없음(경미 관찰 O1–O3만).

## Recommendation

PASS. must-pass 기준별 근거:
- MP-1: REQ-001..025 순차·유일, 재번호 후 stale 참조 0(spec.md:L85–L118, 대조표 L184).
- MP-2: 25개 요구 전부 shall/shall-not EARS 패턴, Unwanted 절 긍정형 잔존 0.
- MP-3: frontmatter 완비·타입 정상(프로젝트 스키마).
- MP-4: N/A.

핵심으로, review-1의 두 major(프롬프트 조립 모델 오설정)가 실제 prompt.rs:196/mod.rs:147 코드에 대해 정확히 교정되었고, AC-004는 이제 RED phase를 깨뜨리지 않는다. 본 SPEC은 주석/승인 게이트로 진행 가능하며 추가 plan-auditor 반복은 불필요하다. 승인 시 경미 후속 3건만 남는다: (O1) AC-014를 아이콘/프롬프트로 분할(선택), (O2) Delta 아이콘 테스트 파일명을 `diagramIcons.test.tsx`로 정정, (O3) acceptance.md/plan.md는 `/moai run` 진입 시 생성 예정 고지. 셋 다 비차단.
