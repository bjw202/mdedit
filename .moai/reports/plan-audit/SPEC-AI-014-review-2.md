# SPEC Review Report: SPEC-AI-014
Iteration: 2/3
Verdict: PASS-WITH-DEBT (점수와 Must-Pass는 통과, run 시작 전에 고치면 좋은 SHOULD-FIX 2건이 남음)
Overall Score: 0.89 (Tier L 기준 0.85 이상, 1차 0.78에서 상승 — 점수 하락 STOP 해당 없음)

작성자 추론 맥락과 코디네이터의 변경 요약은 M1 Context Isolation 원칙에 따라 판정 근거로 쓰지 않았다. 판정 근거는 커밋 `468cf56`의 산출물 6개와 작업 트리 코드를 직접 읽은 결과다. 1차 결함 19건은 하나씩 원문과 코드로 다시 확인했다. codex·claude CLI는 실행하지 않았다.

## 요약

1차 감사의 핵심 결함(고스트 경로의 거부 메시지가 보이지 않음)은 REQ-AI14-018과 AC-020으로 제대로 메워졌다. 동기 명령 문제는 `ai_detect_providers`를 비동기로 바꾸고 `ai_request`의 조회 조건을 좁혀 해결했다. 남은 멈춤은 알려진 한계로 적었다. 산출물 소유권 위반, 추적 공백, 마이그레이션 함정도 모두 고쳐졌다. 19건 가운데 18건은 해결됐고 1건(AC-017)은 부분 해결이다.

수정 과정에서 새 결함이 몇 개 생겼다. 가장 중요한 것은 두 가지다.

- 비동기로 바뀐 감지 명령이 조회하는 동안 캐시 잠금을 잡고 있으면, 메인 스레드의 `ai_request`가 그 잠금을 기다리며 멈출 수 있다. 이 동시성 규칙이 정해져 있지 않다.
- AC-017의 순서 검사는 M0 기록 커밋을 M1 기록 커밋으로 잘못 짚을 수 있다.

나머지는 문서 정합성 수준의 minor다.

## Must-Pass Results

- [PASS] MP-1 REQ 번호: REQ-AI14-001~018이 빈칸과 중복 없이 이어진다(spec.md:L64~L169, 새 REQ-AI14-018은 L169). AC-001~021도 빈칸이 없다(acceptance.md:L33~L118).
- [PASS] MP-2 GEARS(요구사항 층만 판정): 새 REQ-AI14-018은 "**When** … 거부되면, the 앱 shall … 띄운다"(spec.md:L171) 형태다. REQ-AI14-014의 새 조항 "**When** `ai_request`가 검증할 때, the 백엔드 shall …"(L141)과 REQ-AI14-016의 "The 기록 위치 shall …"(L156)도 GEARS 형태다. AC의 Given-When-Then 여부는 판정하지 않았다.
- [PASS] MP-3 프런트매터: 필수 12개 필드가 있다. `version: "0.1.1"`(spec.md:L4)과 HISTORY 0.1.1 행(L26)이 일치한다. 거부되는 별칭은 없다.
- [N/A] MP-4: 다국어 개발 도구 SPEC이 아니다.
- [PASS] MP-5 D7: 새로 참조한 SPEC은 없다. 012·013·015는 여전히 기준 커밋에 없어 SHOULD 등급이지만, plan.md M0가 run 전 확인 단계를 둔다(plan.md:L25~L29).
- [PASS] MP-6 D8: `syscall` 0건.
- [PASS] MP-7: plan.md와 research.md에 `NEEDS CLARIFICATION` 0건.

## Category Scores

| 항목 | 점수 | 등급 | 근거 |
|------|------|------|------|
| Clarity | 0.85 | 0.75~1.0 사이 | 조회 조건(spec.md:L141), 기록 위치(L156), 개정 흐름(L157)이 한 가지로 읽힌다. 다만 plan.md:L10의 옛 문장이 L12와 모순되고(N2), REQ-AI14-014의 한계 설명이 시작 시 감지 호출을 빠뜨렸다(N4). |
| Completeness | 0.90 | 0.75~1.0 사이 | 고스트 오류 표시, 마이그레이션 대체 대상, M0 사전 점검이 더해졌다. 캐시 잠금과 동시성 규칙이 비어 있다(N1). |
| Testability | 0.85 | 0.75~1.0 사이 | AC-001(vitest), AC-003(정규식 확장), AC-011(정확한 원소), AC-021이 이진 판정된다. AC-017 순서 검사(N5), AC-020·AC-008의 진입점 모호(N3), AC-019-3의 `ps` 패턴(N6)이 약하다. |
| Traceability | 0.95 | 1.0에 가까움 | REQ 18개가 모두 추적표에 있다(acceptance.md:L12~L29). AC-020은 REQ-018, AC-021은 REQ-007에 연결된다. 모든 AC가 실재 REQ를 가리킨다. |

조화평균은 약 0.89다.

## Regression Check (1차 결함)

| 1차 | 상태 | 근거 |
|-----|------|------|
| D1 고스트 거부 비표시 | RESOLVED | REQ-AI14-018(spec.md:L169~L173), REQ-AI14-008 정정(L108), AC-020(acceptance.md:L109), design D-6·D-8 정정, research §3 정정. `setStatusMessage`는 실제로 2초 타이머로 메시지를 띄운다(uiStore.ts:175-187, 코드 확인). 잔여는 N2·N3. |
| D2 동기 명령 멈춤 | RESOLVED(수용 포함) | `ai_detect_providers` 비동기화(spec.md:L147, AC-016 L96). `ai_request`는 동기로 두고 조회 조건 축소와 알려진 한계 명시(L141~L142, design D-7). 잔여는 N1·N4. |
| D3 조회 조건 모호 | RESOLVED | spec.md:L141의 네 조건, AC-015 0회 단언(acceptance.md:L90) |
| D4 소유권 위반 | RESOLVED | 기록은 progress.md §E.2(spec.md:L156), 다르면 차단 보고 → manager-spec(L157), plan M1(plan.md:L35~L36), design D-2 개정 경로 |
| D5 라우팅 선택 AC 없음 | RESOLVED | AC-021(acceptance.md:L110~L114) |
| D6 감지 목록 채움 AC 없음 | RESOLVED | AC-016 세 번째 조항(acceptance.md:L95) |
| D7 sonnet 이전 대상 | RESOLVED | spec.md:L91, design D-3. AC-006의 `sonnet` 단언은 기본 설계일 때만 맞고, 아니면 L157 개정 흐름에서 함께 고친다(일관됨) |
| D8 e2e 개수 | RESOLVED | research.md:L76 "5개 파일 6곳"(spec-img-load-001 35·125행 포함, 코드 grep과 일치) |
| D9 툴바 77행 | RESOLVED | research.md 표 30-38·77행, plan M4·design D-8에 `BuildSelectionRequestInput.models` |
| D10 provider.rs 목 4곳 | RESOLVED | research 표와 plan M2 |
| D11 AC-017 명령 | PARTIAL | `merge-base --is-ancestor`로 판정 가능해졌다. 그러나 A를 "progress.md를 처음 건드린 커밋"으로 잡아 M0 커밋이 걸린다(N5) |
| D12 AC-019-3 약한 OR | RESOLVED | 진입점별 (a)(b)와 `ps` 필수(acceptance.md:L121). 패턴 약점은 N6 |
| D13 AC-003 따옴표 | RESOLVED | acceptance.md:L38 |
| D14 AC-011 `-c` | RESOLVED | `args.iter().all(\|a\| a != "-c")`(L77) |
| D15 AC-005 미로그인 | RESOLVED | L48 |
| D16 명령 불일치 | RESOLVED | plan M5(plan.md:L67) |
| D17 선행 SPEC 부재 | RESOLVED | plan M0, spec §5(L187). 상태 기준 차이는 N7 |
| D18 고스트 ↻ 모델 | RESOLVED | REQ-AI14-017 두 번째 조항(L165), AC-018 다섯 번째 경로(L105) |
| D19 AC-001 주석 함정 | RESOLVED | grep 대신 vitest `queryByText`와 상태 키 검사(L33) |

## Defects Found

N1. CACHE-LOCK-CONTENTION — design.md D-7(캐시와 "언제 조회하나"), spec.md:L141~L147 — `ai_detect_providers`는 앱 시작 때도 불린다(`src/components/layout/AppLayout.tsx:65`). 이제 이 명령은 비동기로 돌며 캐시가 비었으면 조회한다. 설계는 캐시를 `static CODEX_MODELS: Mutex<…>`로 정했지만, 조회(최대 3초) 동안 잠금을 잡는지는 정하지 않았다. 흔한 구현처럼 "잠금 → 비었으면 조회 → 저장"으로 만들면 두 가지 문제가 생긴다. 시작 직후 메인 스레드의 `ai_request` 검증이 그 잠금을 기다리며 앱이 멈출 수 있다. 또 "조회하지 않는다"고 정한 경우(claude 라우팅, `null`, 고정 목록 모델)에도 `allowed()`가 잠금을 잡으면 똑같이 멈출 수 있다. 반대로 잠금 없이 조회하면 두 경로가 동시에 조회해 중복 실행이 생긴다. — Severity: major — Class: blocking — Required fix: design D-7에 두 규칙을 적는다. (a) 하위 프로세스를 기다리는 동안 캐시 잠금을 잡지 않는다(잠금은 결과 읽기와 쓰기에만 쓰고, 진행 중 표시나 `OnceLock` 계열로 중복 조회를 막는다). (b) 요청 검증은 claude, `null`, 고정 목록 모델이면 캐시 잠금을 잡지 않고 판정한다. 가능하면 AC-015에 "조회 진행 중에도 (a)(b)(c) 검증은 즉시 반환" 단언을 더한다(진행 중 상태를 흉내 낸 실행기 사용).

N2. PLAN-STALE-LINE — plan.md:L10 — "invoke 거부는 이미 카드 오류로 표시된다. 검증 오류에 새 UI 경로가 필요 없다"가 그대로 남아 같은 절 L12("고스트 경로는 … 보여 주지 않는다. REQ-AI14-018이 이를 고친다")와 모순된다. — Severity: minor — Class: blocking — Required fix: L10을 "✨ 툴바와 카드 경로의 invoke 거부는 카드 오류로 표시된다. 고스트 경로는 REQ-AI14-018이 새 표시 경로를 더한다"로 고친다.

N3. GHOST-ENTRY-AMBIG — acceptance.md:L63, L109; spec.md:L171 — 고스트 쪽 `aiRequest(...).catch`는 네 곳이다. 세 개의 시작 명령(`startSectionFillCommand` 551행, `startContinueWritingCommand` 589행, `startFreeContinueWritingCommand` 628행)과 ↻ 재시도(509행)다. AC-020은 "고스트 이어쓰기, 자유 위치 이어쓰기, ↻"의 세 경로만 다룬다. "고스트 이어쓰기"가 섹션 채우기인지 문서 끝 이어쓰기인지 정해지지 않아, 네 `.catch` 중 하나는 검증되지 않는다. AC-008도 같은 문제로 고스트 시작 명령 셋 중 둘만 다룬다. — Severity: minor — Class: optional — Required fix: AC-020과 AC-008의 진입점을 명령 이름으로 적고 네 경로(AC-008은 세 시작 명령)를 모두 단언한다.

N4. LIMITATION-PREMISE — spec.md:L142, design.md D-7 "알려진 한계" — "앱 실행 후 설정을 한 번도 열지 않았고 …인 경우에만 생긴다"는 전제가 코드와 다르다. 감지는 앱 시작 때 자동으로 한 번 불린다(AppLayout.tsx:65). 따라서 실제로 멈춤이 생기는 창은 "시작 직후 감지 조회가 끝나기 전"(또는 시작 조회 실패 뒤)이다. 함께 생기는 부작용도 문서에 없다. CATALOG 판정이면 codex가 설치된 사용자는 앱을 켤 때마다 `codex debug models`(네트워크, 약 686KB 출력)가 한 번 실행된다. — Severity: minor — Class: blocking — Required fix: 한계 문구를 실제 조건으로 고친다. "시작 시 1회 조회"를 research §3의 사용처(AppLayout)와 spec §5 가정에 적는다.

N5. AC017-M0-COLLISION — acceptance.md:L101, plan.md:L28~L29 — AC-017은 A를 "`<base>..HEAD`에서 progress.md를 처음 건드린 커밋"으로 잡는다. 그런데 M0도 progress.md에 시그니처 변화와 기준 품질 게이트 결과를 적는다. M0 커밋이 A가 되면 M1 기록이 코드 변경보다 늦어도 AC-017이 통과한다. 즉 이 AC는 주장한 순서를 검증하지 못한다. — Severity: major — Class: blocking — Required fix: A를 판정 줄이 처음 들어간 커밋으로 잡는다. 예: `A=$(git log --reverse --format=%H -S 'codex-list-verdict:' <base>..HEAD -- .moai/specs/SPEC-AI-014-model-picker/progress.md | head -1)`.

N6. AC019-PS-PATTERN — acceptance.md:L121 — `ps -ax | grep -c '[c]laude -p'`는 이 기기에서 다른 도구나 세션이 띄운 `claude -p` 프로세스도 센다. 그러면 거부가 정상이어도 실패로 판정될 수 있다. — Severity: minor — Class: optional — Required fix: 앱 고유 인자로 좁히고(`'[c]laude -p.*--setting-sources'`) 요청 직전 값과 직후 값이 같음으로 판정한다.

N7. M0-STATUS-MISMATCH — plan.md:L27 — M0는 SPEC-AI-012·013의 `status`가 `implemented` 또는 `completed`이면 진행한다. 그러나 run의 Depends_on 사전 점검(spec-workflow.md § Depends_on Pre-flight Check)은 `completed`만 충족으로 본다. `implemented` 상태에서 시작하면 run 게이트에서 막히거나 `--ignore-deps` 우회와 기록이 필요하다. — Severity: minor — Class: optional — Required fix: M0 기준을 `completed`로 맞추거나, `implemented`면 `--ignore-deps`와 사유 기록이 필요하다고 적는다.

N8. GHOST-RUNTIME-ERROR-CLAIM — spec.md:L200 — "목록에 있어도 계정 등급 때문에 실제 요청이 실패하는 모델은 오류 카드로 드러난다"는 고스트 경로에서 성립하지 않는다. 실행 중 오류(`ai://error`)는 `useAiRelay.ts:69-74`에서 `failRequest`로만 가고, 고스트는 `error`에서 지워진다. REQ-AI14-018은 이 경우를 명시적으로 범위 밖에 둔다(L173). 결정 자체는 일관되지만 이 문장은 과장이다. — Severity: minor — Class: optional — Required fix: "카드 경로는 오류 카드로, 고스트 경로는 기존처럼 표시 없이 사라진다(REQ-AI14-018 범위 밖, 알려진 한계)"로 고친다.

N9. ASYNC-BLOCKING-WAIT — design.md D-7 — 비동기 명령 안에서 `recv_timeout(3초)` 같은 차단 대기를 하면 비동기 런타임의 작업 스레드 하나를 붙잡는다. UI는 막히지 않지만 바람직한 형태는 아니다. — Severity: minor — Class: optional — Required fix: 조회를 `tauri::async_runtime::spawn_blocking`으로 감싸는 방법을 design D-7에 한 줄 적는다(선택).

N10. MISSING-MODELS-DEFAULT — acceptance.md:L112 — `models` 키가 없는 요청은 두 항목이 `None`이 되므로 claude가 "CLI 기본값"(haiku가 아닐 수 있음)으로 돈다. 앱 안의 호출자는 모두 `models`를 싣게 되므로 실제 영향은 없다. 의도한 동작이라는 한 줄이 있으면 오해가 없다. — Severity: minor — Class: optional — Required fix: design D-1 호환성 문단에 이 동작을 적는다(선택).

## Recommendation

PASS-WITH-DEBT. 점수(0.89)와 Must-Pass 7개는 통과 기준을 넘는다. run 착수 승인(Implementation Kickoff Approval) 전에 다음 SHOULD-FIX를 고치기를 권한다. 모두 짧은 문서 수정이다.

1. N1: design D-7에 "하위 프로세스 대기 중 잠금 미보유"와 "조회하지 않는 검증은 잠금을 잡지 않음" 규칙을 적는다.
2. N5: AC-017의 A를 `-S 'codex-list-verdict:'` 조건으로 바꾼다.
3. N2·N4: plan.md:L10과 spec.md:L142의 문구를 코드 사실에 맞춘다.

나머지(N3, N6~N10)는 선택 사항이다. 고칠 경우 3차 감사는 위 결함 목록에만 범위를 좁혀 확인하면 된다.

## 미검증 항목 (Gaps)

- research.md §2의 CLI 측정 사실(모델 목록, 0.57초, 버전)은 비용 제약으로 다시 실행하지 않았다.
- "동기 Tauri 명령은 메인 스레드에서 돈다"(plan.md:L13, spec.md:L147)는 Tauri 공식 문서 지식에 근거한 것이며 이 앱에서 실측하지 않았다.
- N1의 잠금 경합은 아직 존재하지 않는 구현에 대한 설계 공백 지적이다. 실제로 멈춤이 생기는지는 구현 방식에 달려 있다.
- SPEC-AI-012·013·015 산출물은 이 worktree 밖에 있을 수 있으나 작업 범위 제약으로 읽지 않았다.
