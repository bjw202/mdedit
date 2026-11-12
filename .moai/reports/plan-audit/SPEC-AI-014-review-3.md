# SPEC Review Report: SPEC-AI-014
Iteration: 3/3 (마지막 허용 회차)
Verdict: PASS (MINOR 2건과 선택 1건을 부채로 남김)
Overall Score: 0.91 (Tier L 기준 0.85 이상. 회차별 0.78 → 0.89 → 0.91로 상승해 점수 하락 STOP 해당 없음)

작성자 추론 맥락과 코디네이터의 변경 요약은 M1 Context Isolation 원칙에 따라 판정 근거로 쓰지 않았다. 근거는 커밋 `6ed99cc`의 변경분(`git diff 468cf56 6ed99cc`)과 산출물 원문이다. 이번 회차는 2차 결함 10건(N1~N10)의 해결 여부와, 이번 수정이 새로 만든 결함만 범위로 했다. codex·claude CLI는 실행하지 않았다.

## 요약

2차 결함 10건은 모두 해결됐다. 가장 중요했던 캐시 잠금 경합(N1)과 AC-017의 오검사(N5)도 규칙과 AC로 정확히 메워졌다. 이번 수정으로 생긴 문제는 문서 정합성 두 가지다.

- 새 "조회 중이면 기다리지 않는다" 규칙의 부작용이 적혀 있지 않다. 앱 시작 직후 조회가 아직 끝나지 않았을 때, 정상인 codex 조회 목록 모델을 "다시 고르라"는 오류로 거부할 수 있다.
- 알려진 한계 문장이 같은 REQ의 다른 조항과 모순된다.

둘 다 구현 정확성을 흔들지 않는 minor이고, 점수와 Must-Pass 7개는 통과한다.

## Must-Pass Results

- [PASS] MP-1: REQ-AI14-001~018과 AC-001~021 모두 변화가 없고 빈칸이 없다.
- [PASS] MP-2(요구사항 층만 판정): 새 조항은 GEARS 형태다. "The 캐시 잠금 shall …"과 "**While** 다른 조회가 진행 중인 동안 …"(spec.md:L143), "**Where** codex가 설치·로그인되지 않았으면, the 백엔드 shall …"(L144), REQ-AI14-018의 "**When** 고스트 경로 네 명령 … the 앱 shall …"(L174)이 해당한다. L144의 `Where`는 실행 중 상태를 나타내므로 `While`이 더 정확하지만, 형식 위반은 아니다.
- [PASS] MP-3: `version: "0.1.2"`(spec.md:L4)와 HISTORY 0.1.2 행이 일치하고, 12개 필드가 유지된다.
- [N/A] MP-4: 다국어 개발 도구 SPEC이 아니다.
- [PASS] MP-5: 새 SPEC 참조가 없다. BLOCKING 0건.
- [PASS] MP-6: `syscall` 0건.
- [PASS] MP-7: plan.md와 research.md에 `NEEDS CLARIFICATION` 0건.

## Category Scores

| 항목 | 점수 | 등급 | 근거 |
|------|------|------|------|
| Clarity | 0.85 | 0.75~1.0 사이 | 잠금 규칙(spec.md:L143)과 조회 생략(L144)은 한 가지로 읽힌다. 알려진 한계 문장(L145, design.md:L63)은 L141~L143과 모순된다(N12). |
| Completeness | 0.95 | 1.0에 가까움 | 동시성 규칙, `spawn_blocking`, 미설치 생략, 고스트 네 명령, §5 한계 두 가지가 더해졌다. 경합 창의 잘못된 거부만 빠졌다(N11). |
| Testability | 0.90 | 1.0에 가까움 | AC-015의 새 조항(acceptance.md:L91~L92)은 시간과 호출 수로 이진 판정된다. AC-017은 `-S 'codex-list-verdict:'`로 의도한 커밋을 짚는다(L103). AC-020과 AC-008은 명령 이름으로 네 경로를 특정한다. |
| Traceability | 0.95 | 1.0에 가까움 | 새 REQ 조항은 기존 추적표의 REQ-AI14-014 → AC-015, REQ-AI14-018 → AC-020에 그대로 걸린다. 고아 AC도, 덮이지 않은 REQ도 없다. |

조화평균은 약 0.91이다.

## Regression Check (2차 결함)

| 2차 | 상태 | 근거 |
|-----|------|------|
| N1 캐시 잠금 경합 | RESOLVED | spec.md:L143(대기 중 잠금 미보유, 조회 중 표시, 진행 중엔 기다리지 않음, 조회 불필요 검증은 잠금 미사용). design.md:L60~L61(`AtomicBool` `compare_exchange`, `spawn_blocking`). AC-015 새 조항(acceptance.md:L91 "100ms 안에 돌아오며 실행기 호출 수가 늘지 않는다") |
| N2 plan.md 옛 문장 | RESOLVED | plan.md §A가 "✨ 툴바·카드 경로에서는 … 고스트 경로는 … REQ-AI14-018이 상태 표시줄 경로를 더한다"로 바뀌었다 |
| N3 고스트 진입점 모호 | RESOLVED | REQ-AI14-018(spec.md:L174), AC-020과 AC-008이 `startSectionFillCommand`·`startContinueWritingCommand`·`startFreeContinueWritingCommand`(+↻)를 명시한다. 세 명령은 실제로 `ai-ghost-text.ts`의 551·589·628행에 있다(코드 확인) |
| N4 한계 전제 | RESOLVED(새 모순 발생) | 시작 시 조회와 AppLayout.tsx:65가 반영됐다(spec.md:L145, plan §A). 다만 고친 문장이 새 모순을 만들었다(N12) |
| N5 AC-017 M0 충돌 | RESOLVED | acceptance.md:L103의 `-S 'codex-list-verdict:'`. 현재 progress.md에는 그 문자열이 0건이라 plan 단계 커밋과도 섞이지 않는다 |
| N6 ps 패턴 | RESOLVED | acceptance.md:L123 `[c]laude -p.*--setting-sources`, 요청 전후 비교. 보조 지적은 N13 |
| N7 M0 상태 기준 | RESOLVED | plan M0가 `completed`만 허용한다(run 게이트와 같음) |
| N8 §5 과장 | RESOLVED | spec.md:L203이 고스트 실행 오류 미표시를 한계로 적는다 |
| N9 비동기 안 차단 대기 | RESOLVED | design.md:L60 `spawn_blocking` |
| N10 `models` 누락 기본값 | RESOLVED | spec.md:L204가 의도된 동작이라고 적는다 |

## Defects Found

N11. RACE-FALSE-REJECT — spec.md:L143, design.md:L60 — 새 규칙에 따르면 조회가 진행 중일 때 `ai_request` 검증은 기다리지 않고 그 순간의 허용 목록(캐시가 비었으면 고정 목록)으로 판정한다. 이 규칙의 부작용이 적혀 있지 않다. 앱 시작 직후, 즉 AppLayout의 시작 조회가 끝나기 전(이 기기 약 0.57초)에 고정 목록에 없는 codex 조회 목록 모델을 저장한 사용자가 요청을 보내는 경우다. 이때 정상 모델이 "쓸 수 없어요. 설정 > AI에서 모델을 다시 골라 주세요" 오류로 거부되고, 메시지는 사용자를 잘못된 행동(다시 고르기)으로 이끈다. 비슷한 경우가 하나 더 있다. 시작 때 codex가 미로그인이라 조회를 건너뛰었는데 그 결과를 실패로 캐시하는지 정해지지 않았다. 캐시한다면 로그인 뒤에도 설정을 열거나 앱을 다시 켤 때까지 같은 거부가 이어진다. 멈춤을 없애려고 고른 합리적 맞교환이지만 기록이 없다. — Severity: minor — Class: blocking(문서 정합성) — Required fix: REQ-AI14-014 알려진 한계에 이 경합 창의 거부를 적는다. 다음 두 방법 가운데 하나를 고른다. (a) 진행 중에 검증이 실패하면 "모델 목록을 확인하는 중이에요. 잠시 뒤 다시 시도해 주세요"처럼 다른 메시지를 쓴다. (b) 한계로 수용한다. 미설치·미로그인으로 조회를 건너뛴 경우 캐시를 비운 채로 두는지도 한 줄로 정한다.

N12. LIMITATION-CONTRADICTION — spec.md:L145, design.md:L63 — "`ai_request`가 동기 조회를 하는 경우는 시작 때 조회가 실패했거나 아직 끝나지 않았고 …"가 같은 REQ의 세 조항과 모순된다.
- L141: 실패 결과는 검증에 재사용하므로 요청마다 조회하지 않는다.
- L142: 캐시가 비었을 때만 조회한다.
- L143: 진행 중이면 기다리지 않는다.

규칙대로라면 `ai_request`의 동기 조회와 최대 3초 멈춤은 "캐시가 비어 있고 진행 중인 조회도 없을 때"만 생긴다. 예를 들어 시작 감지가 아직 시작되지 않았거나, 시작 때 codex가 사용 불가라 조회를 건너뛴 뒤 사용 가능해진 경우다. 구현자가 한계 문장을 근거로 동작을 정하면 L141~L143과 다르게 구현할 위험이 있다. — Severity: minor — Class: blocking(내부 모순) — Required fix: L145와 design.md:L63의 조건을 "캐시가 비어 있고 진행 중인 조회가 없을 때(시작 감지 전, 또는 시작 때 codex가 사용 불가였던 경우)"로 고친다.

N13. PS-TRUNCATION — acceptance.md:L123 — `ps -ax`는 환경에 따라 명령줄을 잘라 보여 줄 수 있다. 프롬프트가 인자로 들어가면 명령줄이 길어져 `--setting-sources`가 잘릴 수 있다. 그러면 요청 전후 값이 모두 0이라 검사가 항상 통과한다. SPEC-AI-013 병합 뒤 프롬프트가 표준 입력으로 가면 영향이 작다. macOS의 정확한 잘림 동작은 이 감사에서 실측하지 않았다. — Severity: minor — Class: optional — Required fix: `ps -axww`로 바꾼다.

## Recommendation

PASS. 점수 0.91과 Must-Pass 7개 모두 통과했고, 2차 결함 10건이 모두 해결됐다. N11과 N12는 문장 몇 줄로 끝나는 문서 수정이다. 마지막 회차이므로 추가 감사 없이 다음 두 방법 가운데 하나를 권한다.

1. run 착수 승인 전에 manager-spec이 N11·N12·N13을 고치고, 그 변경분만 코디네이터가 대조한다. 판정을 바꾸는 범위의 수정이 아니다.
2. 부채로 기록한 채 run에 들어간다. 이 경우 구현 지시문에 "REQ-AI14-014의 동작 기준은 L141~L143이며, L145 한계 문장의 조건은 틀렸다"고 명시해 N12로 인한 오구현을 막는다.

## 미검증 항목 (Gaps)

- research.md §2의 CLI 측정 사실은 비용 제약으로 다시 실행하지 않았다.
- N11의 경합 창 길이(약 0.57초)는 research의 1회 측정값에 기댄 것이다.
- N13의 `ps` 잘림 여부는 실측하지 않았다.
- 이번 회차는 범위를 2차 결함과 새 수정분으로 좁혔다. 1차와 2차에서 PASS로 확인한 다른 절은 다시 전수 검토하지 않았다.
