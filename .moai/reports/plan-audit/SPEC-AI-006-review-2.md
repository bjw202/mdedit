# SPEC 재검증 보고서 (scoped): SPEC-AI-006
반복(Iteration): 2/3 — **집중 재검증**(전체 재감사 아님)
종합 판정(Verdict): **APPROVED (Run 착수 가능) — 조언 1건(N1) T2 RED에서 고정 권장**

> M1 컨텍스트 격리 준수: 작성자 추론 맥락 무시, 문서 4종 + main 코드(731f05f)만으로 review-1의 Major 2건·Minor 지적의 반영 여부만 좁게 검증함. review-1(SPEC-AI-006-review-1.md)의 결함 ID를 회귀 기준으로 사용.

---

## 회귀 점검 — review-1 결함 해소 여부

| review-1 결함 | 판정 | 근거(반영 위치) |
|---|---|---|
| **M1** 워치독 단일발행이 취소·교체 경로 미결속 | **RESOLVED** | 아래 M1 상세 |
| **M2** REQ-AI6-013 "발행부 3곳"에 section-fill(L390) 포함 → REQ-014와 모순 | **RESOLVED** | 아래 M2 상세 |
| **F2** plan T5 발행부 좌표 434/440/468 오기 | **RESOLVED** | plan.md T5(L73/L75)·D5(L35) 좌표를 command L421/L452 + `aiRequest` L435/L465로 정정 |
| **F3** 카드 스켈레톤 좌표 277-286 드리프트 | **RESOLVED** | spec.md:L101/L154, plan.md T3(L59/L61), research §5(L61) 모두 287-294로 정정 |
| **F5** REQ-AI6-009 "Unwanted" 헤딩 오라벨 | **RESOLVED** | spec.md:L107 헤딩이 `#### Ubiquitous`로 변경(009=부정형 Ubiquitous 정합) |
| **F6** shall-text HOW 누수(`finished` swap·`aiContinueLength`) | **RESOLVED** | REQ-006(L95) shall 본문은 "정확히 하나의 terminal 이벤트만 발행"(WHAT)으로 재작성, `finished` claim은 [NEW:…] 대괄호로 이관. REQ-013(L129) shall 본문은 "이어쓰기 길이 설정"(제네릭)으로, `aiContinueLength` 심볼 제거 |
| F4/F7(frontmatter 필드명·하위문서 축소·issue_number 0) | 미변경(비차단) | review-1에서 비차단 처리, 이번 스코프 밖 |

---

## M1 상세 — 4지점 단일발행 결속 검증 (RESOLVED)

review-1 요구: 릴레이(Silent/EOF claim 포함)·워치독·`ai_cancel`(mod.rs:224)·교체(mod.rs:156) **네 지점 전부**를 하나의 선점에 결속 + Delta 대응행 + 신규 경쟁 시나리오 2종.

- **REQ-AI6-006**(spec.md:L95): "**IF** 하나의 요청이 정상 완료·타임아웃·사용자 취소·신규 요청 교체 중 둘 이상의 종료 경로에서 근접하게 종료되면, **then the system shall** 그 요청에 대해 정확히 하나의 terminal 이벤트만 발행"으로 재작성. [NEW]에 "릴레이의 **모든 outcome(정상 done·오류·EOF Silent 포함)**, 워치독, `ai_cancel`(mod.rs:224), 신규 요청 교체(mod.rs:156) — 이 **네 개 terminal 발행 지점 전부**가 공유 단일발행 선점(`Arc<AtomicBool>` claim…)에 참여" 명시. ✓
- **plan.md D2**(L32): 현재 3발행 지점(릴레이·`ai_cancel` L224·교체 L156)을 명시하고 "릴레이+워치독만 결속하면…이중 발행"을 근거로 4지점 claim을 확정. ✓
- **plan.md T2**(L52-54): "터미널 발행 4지점 전부가 발행 전 claim" (a)릴레이 모든 outcome (b)워치독 (c)`ai_cancel` (d)교체. Reference에 mod.rs:224·mod.rs:156 추가. ✓
- **plan.md Risk**(L92): 신규 행 "**터미널 이중발행**(워치독 emit + `ai_cancel`/교체 emit 근접)" → 4지점 claim 완화. ✓
- **research §2**(L37·L41): "터미널 `ai://error`는 릴레이 외에도 두 지점에서 무조건 발행"(L37)로 M1 근거를 서술하고, L41에서 4지점 선점 + "릴레이가 Silent(취소) 경로에서도 claim해야 순차 시나리오(5초 취소 → 60초 워치독)에서 워치독 억제" 명시. ✓
- **Delta 표**(spec.md:L147-149): mod.rs 행이 "`ai_cancel`(L224)·교체(L156)의 `ai://error` 발행을 **발행 전 `finished` claim 게이트**로 감쌈"; claude_cli.rs 행이 "릴레이가 **모든 outcome(done·error·EOF Silent 포함)에서 발행 전 claim**"; **신규 선점 헬퍼 행**(`Arc<AtomicBool>` claim, 4지점 공용, `@MX:ANCHOR`) 추가. ✓
- **경쟁 시나리오 2종**(acceptance.md AC-AI6-002, L47-50): **(근접 경쟁)** "사용자 취소와 60초 워치독이 근접" → "먼저 성공한 한쪽만 발행, 이중 발행 없음"; **(순차)** "5초 취소 → 60초 워치독" → "릴레이가 취소 EOF(Silent)에서 이미 claim…워치독 claim 실패". 둘 다 선점 헬퍼 단위(첫 호출 true·재호출 false)로 testable. ✓
- MX 정합: mx_plan(spec.md:L180)·plan MX(L106) 모두 fan_in ≥ 4, 4지점 공유로 갱신. ✓

→ M1 **RESOLVED**. 4지점 결속·Delta 대응행·경쟁 2종·테스트 전략 전부 반영, 문서 4종 간 표현 일관.

## M2 상세 — continue 발행부 2곳 일관성 (RESOLVED)

- **REQ-AI6-013**(spec.md:L129): "continue 발행부는 **2곳**뿐 — `startContinueWritingCommand`(ghost-text.ts:421)·`startFreeContinueWritingCommand`(ghost-text.ts:452)에만 length 전달. `startSectionFillCommand`(L390)는 섹션 채우기이므로 제외(REQ-AI6-014와 정합)". ✓
- **Environment**(spec.md:L64): 커맨드 3종을 presetKind와 함께 명시하고 "이어쓰기(continue)는 뒤 2종뿐이며 섹션 채우기는 continue가 아니다". ✓ (실코드 대조: L390 feature='section-fill'·presetKind 없음, L438/L468 presetKind:'continue' — review-1 실측과 일치)
- **Delta**(spec.md:L153): "continue 발행부 2곳(L421·L452, `aiRequest` L435·L465)에 length 전달…`startSectionFillCommand`(L390)는 제외". ✓
- **REQ-AI6-010**(spec.md:L115): ↻ 의미론을 "**동일 종류의 요청**(원 트리거가 continue든 section-fill이든)"으로 일반화 — 고스트 ↻가 section-fill 고스트에도 적용되는 실제 코드와 정합(length(항목4)과 독립). ✓
- **plan D5/T4/T5**(L35/L66/L73-75)·**research §4**(L53/L56): continue 정확히 2경로(L421 aiRequest L435 / L452 aiRequest L465), L390은 section-fill로 제외, 프론트 length도 continue 2곳에서만 전달 — 모두 일관. ✓
- REQ-013 ↔ REQ-014 모순 해소: 013이 continue 2곳으로 한정되어 014("이어쓰기에만 적용, 섹션 채우기 무영향")와 정합. ✓

→ M2 **RESOLVED**. 4문서 전반에서 continue=2, L390 제외가 일관.

## Minor 스팟 — 신규 불일치 여부

- 좌표 287-294(스켈레톤)·L421/L452(command)·L435/L465(aiRequest)·L390/L406(section-fill)·mod.rs L224/L156 — review-1 실측치와 문서 4종 간 상호 일치, 신규 좌표 드리프트 없음. ✓
- REQ-009 카테고리 이동으로 모듈 3 EARS 라벨(State/Event/Ubiquitous) 정합, 번호 서열(007→008→009) 불변 → MP-1 무영향. ✓
- Traceability 불변: AC-001~006 ↔ REQ-001~015 매핑표(spec.md:L167-172) 무변경, 전 15개 여전히 커버. ✓
- shall-text HOW 제거가 requirement 의미를 축소하지 않음(WHAT 보존). ✓

---

## 신규 조언 결함

**N1 [minor, 비차단] — 릴레이 Silent 경로 claim이 취소/교체 terminal을 소거할 수 있는 순서 경쟁** (spec.md:L148 Delta / research §2 L41 / acceptance L50)

설계는 "릴레이가 **EOF Silent 포함 모든 outcome에서 발행 전 claim**"하고 `ai_cancel`(mod.rs:224)·교체(mod.rs:156)는 "**발행 전** claim"한다. 그러나 `ai_cancel`은 현재 순서상 `child.kill()`(mod.rs:223) **후** 발행(L224)한다. claim을 kill 이후·emit 직전에 두면, kill로 촉발된 **옛 릴레이의 EOF→Silent→claim**과 `ai_cancel`의 claim이 경쟁한다. 릴레이가 먼저 claim에 성공하면(Silent라 무발행) `ai_cancel` claim이 실패 → **그 requestId에 terminal이 0건** 발행되어 카드/고스트 스켈레톤이 다시 무한 대기(본 SPEC이 없애려는 실패 모드)될 수 있다.

- 근접·순차 회귀 테스트는 선점 헬퍼(순수)만 검증하므로 이 **kill↔claim 순서 경쟁**은 헬퍼 단위 테스트로는 드러나지 않는다.
- 권고(둘 중 하나를 T2 RED 계약에 고정): (i) **릴레이는 Silent(취소) 경로에서 claim하지 않는다** — done·error만 claim, 취소/교체 requestId의 유일 발행자는 `ai_cancel`/교체로 확정, 또는 (ii) `ai_cancel`·교체가 **`child.kill()` 이전에** claim하여 릴레이의 후속 EOF claim이 항상 실패하도록 순서 고정. 어느 쪽이든 "취소 시 정확히 1개 terminal" 통합 회귀(mock)로 커버.
- 비차단 판단 근거: 의도(단일발행)는 명확·정확하고 4지점 결속의 큰 골격은 옳다. N1은 구현 **순서** 한 줄을 고정하면 해소되는 좁은 경쟁으로, TDD "취소 시 terminal 정확히 1회" 테스트를 T2에 추가하면 착지 시 포착된다. Run 착수를 막을 정도는 아니나 계약에 명시 권장.

---

## Chain-of-Verification (2차 자기비판)

재확인:
- **4지점 문구 교차 일치 전수**: spec REQ-006/D2/Delta/mx_plan, plan D2/T2/Risk/MX, research §2, acceptance AC-002 — "릴레이(done·error·EOF Silent)·워치독·`ai_cancel`(mod.rs:224)·교체(mod.rs:156)" 표현이 8개 착지점에서 동일. 좌표 mod.rs:224/156도 실코드(review-1 실측 L224 취소 emit·L156 교체 emit)와 일치.
- **continue=2 전수**: spec REQ-013/Env/Delta, plan D5/T4/T5, research §4 — 전부 L421/L452(aiRequest L435/L465), L390 제외. 상호 모순 0.
- **신규 경쟁 시나리오 실효성**: 근접·순차 2종이 AC-002에 명문화되고 선점 헬퍼로 판정 가능 — 단, N1의 kill↔claim 순서 경쟁은 별도(위 지적).
- **모순 스윕**: REQ-010(↻ 일반화: continue·section-fill 모두) vs REQ-013/014(length continue 전용) — ↻는 원 트리거 재발행(길이와 독립), length는 continue 발행 2곳 한정으로 **양립**(plan T4 L66이 "길이 옵션 항목 4와 독립" 명시). 모순 아님.
- 신규 좌표/번호/매핑 회귀 없음 확인.

신규 결함: N1(minor, 비차단) 1건. review-1 Major 2 + Minor 3(F2/F3/F5/F6) 전부 RESOLVED. 신규 Critical/Major 없음.

---

## 권고

review-1의 차단성 Major 2건(M1 워치독 4지점 단일발행, M2 continue=2 정합)은 **완전 해소**되었고 문서 4종 간 표현이 일관된다. F2/F3/F5/F6 Minor도 반영됐다. **Run 착수 승인(APPROVED)**.

착수 시 1건만 계약에 고정 권장:
1. **N1** — T2 RED에 "취소/교체 시 terminal 정확히 1회" 통합 회귀를 추가하고, 릴레이의 Silent-경로 claim을 (i) 제거하거나 (ii) claimer(`ai_cancel`/교체)의 claim을 `child.kill()` 이전으로 순서 고정. (선점 순수 헬퍼 단위 테스트만으로는 kill↔claim 경쟁이 안 잡힘.)

판정: **APPROVED (Run 착수 가능) — N1은 T2 RED에서 고정**
