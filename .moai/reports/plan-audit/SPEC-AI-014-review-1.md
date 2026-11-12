# SPEC Review Report: SPEC-AI-014
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.78 (Tier L 통과 기준 0.85 미달)

작성자 추론 맥락은 M1 Context Isolation 원칙에 따라 무시했다. 근거는 산출물 6개(spec.md, plan.md, acceptance.md, design.md, research.md, progress.md)와 기준 커밋 `4e2711c` 작업 트리의 코드를 직접 읽은 결과뿐이다. codex·claude CLI는 실행하지 않았다(비용 제약). 그래서 research.md §2의 CLI 측정 사실(모델 목록, 0.57초, CLI 버전)은 **미검증**으로 남는다.

## 요약

문서 구조, 프런트매터, REQ·AC 번호, 추적표는 깔끔하다. research.md §3의 코드 줄 번호도 대부분 실제와 맞는다. 하지만 설계 전제 하나가 코드와 다르다. "invoke 거부는 세 경로 모두 카드에 표시된다"는 주장이 고스트 텍스트·이어쓰기 경로에서는 거짓이다. 그 경로에서 백엔드가 모델을 거부하면 사용자에게 아무것도 보이지 않는다. 이는 이 SPEC의 핵심 목표("조용한 대체 대신 이유를 알린다")를 가장 자주 쓰는 경로에서 무너뜨린다. 그 밖에 동기 Tauri 명령 안에서 3초 조회를 하는 문제, 산출물 소유권 위반(구현자가 spec.md를 고침), AC가 없는 REQ 조항 두 개가 있다.

## Must-Pass Results

- [PASS] MP-1 REQ 번호 일관성: REQ-AI14-001~017이 빈칸과 중복 없이 이어진다(spec.md:L63, L68, L76, L82, L87, L93, L99, L104, L110, L114, L119, L125, L129, L135, L142, L149, L157). AC-001~019도 빈칸이 없다(acceptance.md:L32~L105).
- [PASS] MP-2 GEARS 형식(요구사항 층 `REQ-XXX`만 판정): 모든 REQ가 `The <주체> shall …`, `When …`, `While …`, `Where …`, `shall not` 형태다. 예: spec.md:L65 "The 앱 shall not …", L90 "**When** 저장 상태의 버전이 3 미만이면", L112 "**While** 라우팅된 도구의 선택이 `null`인 동안", L131 Where+When 복합. AC 층의 Given-When-Then 여부는 MP-2에서 판정하지 않았다. REQ-AI14-016(L151)은 주체가 "구현자"인 절차 요구지만 GEARS 형식은 지킨다(내용상 문제는 D4).
- [PASS] MP-3 프런트매터: 필수 12개 필드가 모두 있다(spec.md:L2~L13). `id: SPEC-AI-014`는 정규식에 맞고, `version: "0.1.0"`은 따옴표를 친 문자열이다. `status: draft`, 날짜는 ISO 형식, `priority: Medium`, `phase: "v0.22.0 target"`(단계 이름이 아님), `lifecycle: spec-anchored`, `tags`는 문자열이다. 거부되는 별칭은 없다. `tier: L`과 `depends_on`은 허용된 선택 필드이고, `related_specs`는 스키마에 없는 추가 필드라 무시된다.
- [N/A] MP-4 언어 중립성: 다국어 개발 도구를 다루는 SPEC이 아니다. 대상은 AI CLI(claude, codex) 모델 선택이다.
- [PASS] MP-5 D7 교차 SPEC: 참조 SPEC은 001·005·009·010·012·013·015다. 001(draft), 005(completed), 009(draft), 010(draft) 중 retired·superseded·archived인 것은 없다. 012·013·015는 이 worktree의 `.moai/specs/`에 없어서 SHOULD 등급이다(D17). BLOCKING은 없다.
- [PASS] MP-6 D8: spec.md에 `syscall` 문자열이 0건이다.
- [PASS] MP-7 확인 대기 표시: `grep -n "NEEDS CLARIFICATION" plan.md research.md`가 0건이다(종료 코드 1).

## Category Scores

| 항목 | 점수 | 등급 | 근거 |
|------|------|------|------|
| Clarity | 0.75 | 0.75 | 요구 대부분이 한 가지로 읽힌다. 다만 REQ-AI14-014(spec.md:L140)는 `ai_request`가 언제 조회를 하는지(라우팅이 claude일 때, 선택이 `null`일 때, 고정 목록에 있는 값일 때) 정하지 않았다. REQ-AI14-008의 "카드에 표시된다"(L107)는 사실과 다르다. |
| Completeness | 0.75 | 0.75 | 절과 프런트매터, Out of Scope H3 4개(spec.md:L189~L204)가 모두 있다. 그러나 고스트 텍스트 경로의 거부 오류 표시 요구가 빠졌다(D1). 마이그레이션 대상 `sonnet`이 M1 결과에 따라 사라질 경우도 다루지 않았다(D7). |
| Testability | 0.80 | 0.75~1.0 사이 | AC 대부분이 명령·단언으로 이진 판정된다. 다만 AC-017의 git 명령으로는 판정이 불가능하다(D11). AC-019-3에는 "또는 응답이 나오지 않음"이라는 약한 OR가 있다(D12). AC-003·AC-011의 grep과 단언은 우회되거나 모호하다(D13, D14). |
| Traceability | 0.85 | 0.75~1.0 사이 | 추적표(acceptance.md:L10~L28)가 REQ 17개를 모두 AC에 연결한다. 하지만 REQ-AI14-007의 두 번째 조항(라우팅된 도구의 항목만 사용, L102)과 REQ-AI14-015의 첫 조항(`ai_detect_providers`가 목록을 채움, L144)은 이를 실제로 단언하는 AC가 없다(D5, D6). |

조화평균은 약 0.78로 Tier L 기준 0.85에 못 미친다.

## 코드 대조 결과

| 문서 주장 | 확인 결과 |
|-----------|-----------|
| research §3 provider.rs 13-35, 38-43, 48-62, 128-136 | 맞음(`enum AiModel` L14, `AiRequest` L39, `advanced_model_label` L60, `first_available` L128) |
| claude_cli.rs 82-99, 106-117, 194-208, 310-321 | 맞음(L82, L106, L115, L194, L310, L318) |
| codex_cli.rs 41-82, 97-118, 293-307 | 맞음(L41, L52, L64, L75, L97, L293, L301). 머리 주석의 "0.144.1"(L6)도 맞음 |
| mod.rs 84-110, 169-170, 349-352 | 맞음(`AiRequestArgs` L87, `model` L96, `from_opt` L170, `ai_detect_providers` L350) |
| detect.rs 297, 419 | 맞음. 다만 provider.rs 테스트 픽스처 4곳(L174, L206, L295, L310)이 누락됨(D10) |
| ipc.ts 258-259, 266, 303-309 / uiStore 영속 version 2 | 맞음(ipc.ts L259, L266, L309; uiStore L209 `version: 2`, migrate L233) |
| SettingsModal 45-48, 195, 268-347, 424 | 맞음 |
| ai-selection-toolbar.ts:77 = `AiToolbarUiState` | **틀림.** `AiToolbarUiState`는 L30-34에 있다. L77은 `BuildSelectionRequestInput.model: AiModel`이고, 이는 plan M4에 없는 또 하나의 사용처다(D9) |
| ai-ghost-text.ts 21, 569, 603, 641 / failRequest 509·578·616·655 | 줄 번호는 맞음 |
| "invoke 거부는 세 경로 모두 카드에 표시"(research.md:L69, design.md:L51, spec.md:L107, plan.md:L10) | **틀림(고스트 경로).** D1 참고 |
| fireReRequest가 `{...originalArgs, ...overrides, requestId, providerId}`로 합침(ai-suggestion-card.ts:1361) | 맞음. 단 `providerId`는 재요청 시점에 `resolveProviderId()`로 다시 정한다. 모델은 원래 값, 도구는 현재 값이지만 두 도구 선택을 모두 싣는 설계라 문제는 없다 |
| 새 명령이 없으면 ACL 불변(app_commands.rs) | 맞음. `src-tauri/app_commands.rs` 머리 주석이 세 곳 동시 수정 규칙을 적고 있고, `ai_request`(L46)와 `ai_detect_providers`(L48)가 이미 등록되어 있다 |
| e2e 버전 1 fixture 4개 | **틀림.** 5개다. `e2e/spec-img-widget-002.spec.ts:41`이 빠졌다(D8) |
| AC-013 FIXED-ONLY `git grep '"debug"' -- src-tauri/src`가 비어 있음 | 지금 기준선에서 0건이라 판정할 수 있음 |
| npm 스크립트 typecheck/lint/test/test:e2e | package.json L13~L17에 있음 |

## Defects Found

D1. FACT-GHOST-ERROR — spec.md:L107, design.md:L51, research.md:L69, plan.md:L10 — "검증 오류는 기존 invoke 거부 경로로 카드에 표시된다"는 고스트 텍스트·이어쓰기(section-fill) 요청에서 거짓이다. 근거는 세 가지다. (1) 카드의 aiStore 구독은 `if (s.requestId !== boundRequestId) return;`(ai-suggestion-card.ts:1470)으로 자기 카드 요청만 처리한다. (2) 고스트 브리지는 `requestState === 'error'`이면 고스트를 지울 뿐 메시지를 보여 주지 않는다(ai-ghost-text.ts:919-924). (3) `src/`의 테스트 밖 코드에서 `errorInfo`를 읽는 곳은 카드뿐이다(grep 확인). 따라서 저장된 claude 모델이 허용 목록에서 빠지면(CLI 업데이트, M1 결과 등) 가장 자주 쓰는 고스트 텍스트가 이유 없이 사라진다. 이는 REQ-AI14-008의 "이유를 알린다"와 REQ-AI14-006의 의도에 어긋나는 "조용한 실패"다. 실기기 재현은 하지 않았고 코드 읽기로 확인했다. — Severity: critical — Class: blocking — Required fix: (a) REQ-AI14-008에 "고스트 텍스트·이어쓰기 요청이 거부되면 그 메시지를 사용자에게 보인다(예: `uiStore.setStatusMessage`나 고스트 자리 안내)"를 더한다. (b) vitest AC를 더한다: `aiRequest`가 거부되도록 모의한 뒤 섹션 채우기와 자유 위치 이어쓰기를 각각 발행하면 화면이나 상태 메시지에 거부 메시지(모델 이름 포함)가 나타난다. (c) research.md:L69와 design.md:L51의 주장을 "카드 경로만 표시, 고스트 경로는 표시 경로 없음(이 SPEC이 추가)"으로 고친다. (d) AC-019-3에 고스트 텍스트 확인 항목을 따로 넣는다.

D2. SYNC-CMD-BLOCK — design.md:L57, spec.md:L131/L139 — `ai_request`(mod.rs:122-123)와 `ai_detect_providers`(mod.rs:349-350)는 `async`가 없는 `#[tauri::command] pub fn`이다. Tauri 2에서 동기 명령은 메인 스레드에서 돈다(Tauri 문서 기준이며 이 감사에서 실측하지는 않음). CATALOG 판정이면 설정을 열 때와 첫 요청 때 최대 3초(실측 0.57초) 동안 `codex debug models`를 기다리므로 창이 멈출 수 있다. 조회가 실패한 뒤 설정을 열 때마다 다시 조회하는 규칙(REQ-AI14-014 L139) 때문에 실패 상황에서 정지가 반복될 수 있다. — Severity: major — Class: blocking — Required fix: design.md D-7에 실행 위치를 정한다. 예를 들어 두 명령을 `async`로 바꾸거나 조회를 별도 스레드·앱 시작 시 선조회로 돌린다. 아니면 메인 스레드 정지를 "알려진 한계"로 명시해 수용하고 M1에서 설정 열기 체감 지연을 기록한다. 어느 쪽이든 FIXED-ONLY 판정이면 해당이 없다고 적는다.

D3. QUERY-TRIGGER-AMBIG — spec.md:L108, L140 — 허용 목록이 "캐시된 조회 목록 ∪ 고정 목록"인데, `ai_request`가 캐시가 비었을 때 언제 조회하는지 정해지지 않았다. 라우팅된 도구가 claude일 때, 선택이 `null`일 때, 선택값이 이미 고정 목록에 있을 때도 조회하는지 알 수 없다. 구현에 따라 claude 요청마다 첫 회 0.57~3초 지연이 생길 수 있다. — Severity: major — Class: blocking — Required fix: REQ-AI14-014에 "조회는 라우팅된 도구가 codex이고, 선택이 `null`이 아니며, 그 값이 고정 목록에 없고, 캐시가 비었을 때만 한다"를 명시한다. AC-015에 "claude 라우팅·`null`·고정 목록 값이면 실행기 호출 0회" 단언을 더한다.

D4. OWNERSHIP-CROSSING — spec.md:L153, acceptance.md:L97, plan.md:L15/L27 — REQ-AI14-016은 "구현자"가 spec.md HISTORY와 REQ·AC를 고치도록 한다. 그러나 프로젝트 규칙(spec-frontmatter-schema.md § Forbidden ownership crossings)은 manager-develop의 spec.md·acceptance.md 본문 수정을 금지한다. 이대로라면 run 에이전트가 규칙을 어기거나 AC-017을 통과할 수 없다. — Severity: major — Class: blocking — Required fix: 구현자는 research.md §M1에 기록하고 blocker 보고를 돌려준다. 오케스트레이터가 manager-spec에 재위임해 개정하고 plan-auditor가 재감사한다. REQ-AI14-016과 AC-017의 행위 주체와 판정 문구를 이 흐름에 맞춘다.

D5. TRACE-ROUTING — spec.md:L102 — "백엔드는 라우팅으로 정해진 도구(명시 선택이든 자동 감지든)의 항목만 쓴다"를 단언하는 AC가 없다. AC-009는 `validate`의 도구별 판정과 거부만 본다. `ModelSelection::for_provider`와 자동 모드 선택 연결은 검증되지 않는다. — Severity: major — Class: blocking — Required fix: AC-009에 cargo test를 더한다. `models = { claude: Some("opus"), codex: Some("not-allowed") }`로 claude가 라우팅되면 `Ok(Some("opus"))`이고 codex 항목은 무시된다. 반대 경우도 단언한다. `models` 필드가 빠진 JSON의 역직렬화 결과(serde default)도 함께 단언한다.

D6. TRACE-DETECT-FILL — spec.md:L144, acceptance.md:L91 — AC-016은 직렬화 모양("목록이 있으면")과 `detect()`의 빈 목록만 확인한다. `ai_detect_providers`가 실제로 도구마다 `list_for(id)`를 채우는지는 단언하지 않는다. — Severity: minor — Class: blocking — Required fix: 감지 결과에 목록을 붙이는 순수 함수(예: `attach_models(Vec<ProviderStatus>)`)를 두고 claude 결과의 `models` id가 고정 목록과 같음을 cargo test로 단언하는 AC를 더한다.

D7. MIGRATION-SONNET — spec.md:L90, acceptance.md:L51, spec.md:L127/L153 — 이전 규칙은 `aiAdvancedModel === true`를 `sonnet`으로 바꾼다. 그런데 REQ-AI14-012는 M1에서 실패한 별칭을 목록에서 빼고, REQ-AI14-016의 개정 범위는 claude 목록과 codex 출처만 다룬다. sonnet이 M1에서 빠지면 고급 모델을 쓰던 사용자는 모든 요청이 거부된다. 고스트 경로에서는 D1 때문에 거부 이유도 보이지 않는다. — Severity: major — Class: blocking — Required fix: REQ-AI14-016의 개정 대상에 "sonnet이 claude-aliases에 없으면 이전 대상을 haiku로 바꾼다(AC-006 포함)"를 더한다.

D8. FACT-E2E-COUNT — research.md:L75, plan.md:L11, design.md:L68 — `aiAdvancedModel`을 담은 버전 1 e2e fixture는 4개가 아니라 5개다. `e2e/spec-img-widget-002.spec.ts:41`(version 1, L45)이 빠졌다. 결론("손대지 않는다")은 그대로 유효하다. — Severity: minor — Class: optional — Required fix: 목록에 그 파일을 더한다.

D9. FACT-TOOLBAR-L77 — research.md:L62, plan.md:L50 — ai-selection-toolbar.ts:77은 `AiToolbarUiState`가 아니다. 그 줄은 `BuildSelectionRequestInput.model: AiModel`이며, `AiToolbarUiState`는 L30-34에 있다. `buildSelectionRequest`의 입력 계약도 바뀌어야 하는데 plan M4에 없다. — Severity: minor — Class: optional — Required fix: research §3 표를 고치고 M4 항목에 `BuildSelectionRequestInput.model` → `models`를 더한다.

D10. FACT-PROVIDER-FIXTURES — research.md:L45, plan.md:L37 — `advanced_model_label: None`은 detect.rs 두 곳 말고도 provider.rs 테스트 4곳(L174, L206, L295, L310)에 있다. — Severity: minor — Class: optional — Required fix: research §3과 M2 목록에 더한다.

D11. AC017-CMD — acceptance.md:L97 — `git log --format=%h --reverse <base>..HEAD`는 SHA만 나열하므로 "M1 기록 커밋이 src 변경 첫 커밋보다 앞선다"를 판정할 수 없다. — Severity: minor — Class: blocking — Required fix: 예를 들어 `git log --reverse --format=%h <base>..HEAD -- .moai/specs/SPEC-AI-014-model-picker/research.md | head -1`과 `git log --reverse --format=%h <base>..HEAD -- src src-tauri/src | head -1`을 비교하고, 앞의 SHA가 `git merge-base --is-ancestor`로 뒤의 SHA의 조상임을 확인하는 명령으로 바꾼다.

D12. AC019-WEAK-OR — acceptance.md:L108 — "`ps`로 claude 프로세스가 뜨지 않았음을 확인하거나 응답이 나오지 않음"에서 뒤 조건은 다른 원인(네트워크, 시간 초과)으로도 성립한다. 어느 진입점에서 요청하는지도 정해져 있지 않다. — Severity: minor — Class: blocking — Required fix: `ps` 확인(또는 앱 로그의 스폰 기록 부재)을 필수로 하고, ✨ 툴바와 고스트 텍스트 두 진입점을 각각 적는다(D1과 연동).

D13. AC003-QUOTES — acceptance.md:L37 — 정규식이 작은따옴표 리터럴만 잡아서 큰따옴표나 백틱 문자열은 빠져나간다. — Severity: minor — Class: optional — Required fix: ``git grep -nE "['\"\`](haiku|sonnet|opus|fable)['\"\`]" -- src ':!src/test'``로 넓힌다.

D14. AC011-DASHC — acceptance.md:L76 — "어떤 원소에도 `-c`가 없음"이 원소 일치인지 부분 문자열인지 모호하다. 인자에는 `-C`(스크래치)와 프롬프트 원소가 있다. — Severity: minor — Class: optional — Required fix: `!args.iter().any(|a| a == "-c")`와 `!args.iter().any(|a| a.contains("model_reasoning_effort"))`로 명시한다.

D15. AC005-LOGIN — acceptance.md:L47, spec.md:L80 — REQ-AI14-003은 미설치와 미로그인 모두 비활성화를 요구하지만 AC-005는 미설치만 본다. — Severity: minor — Class: optional — Required fix: "설치됨·미로그인" 주입 경우를 더한다.

D16. CMD-INCONSISTENT — plan.md:L58 — M5가 `npx tsc --noEmit`, `npx vitest run`을 쓰고 acceptance.md:L111은 npm 스크립트를 쓴다. 결과는 같지만 출처가 둘이다. — Severity: minor — Class: optional — Required fix: plan M5를 `npm run typecheck`, `npm test`로 통일한다.

D17. D7-NOT-FOUND — spec.md:L15-16, plan.md:L66-75 — SPEC-AI-012, 013, 015는 기준 커밋의 `.moai/specs/`에 없다(D7 SHOULD). `depends_on` 사전 점검은 의존 SPEC의 `status: completed`를 요구하므로 지금은 해석되지 않는다. §E 표가 "백로그 카드 기준 예상"이라고 밝힌 점은 정직하다. — Severity: minor — Class: optional — Required fix: plan §A에 "run 시작 전 012·013 completed 확인과 §E 함수 목록 재대조"를 명시적 사전 점검 단계로 둔다.

D18. GHOST-RETRY-MODELS — spec.md:L101, L159 — 고스트 ↻ 재요청(ai-ghost-text.ts:509, `lastGhostTrigger` 재사용)이 원래 `models`를 이어받는지 현재 저장값을 쓰는지 정해지지 않았다. REQ-AI14-017은 카드만 다루고 AC-008에도 이 경로가 없다. — Severity: minor — Class: optional — Required fix: REQ-AI14-007이나 017에 고스트 재요청 규칙을 한 줄 더하고 AC-008에 그 경로를 넣는다.

D19. AC001-COMMENT-TRAP — acceptance.md:L32 — `git grep "고급 모델" -- src ':!src/test'`는 주석도 잡는다. uiStore.ts:105에 지금 그 문구가 있고, 이전(migration) 코드 주석에 쓰기 쉬운 표현이다. 판정 자체는 이진이라 결함이라기보다 함정이다. — Severity: minor — Class: optional — Required fix: plan M3에 "이전 코드 주석에 '고급 모델' 문구를 쓰지 않는다(AC-001)"를 메모한다.

## 설계 결정 검토 (design.md)

- D-1 두 도구 선택을 함께 전송: 타당하다. 자동 모드 라우팅이 백엔드에 있으므로 중복을 없앤다. 다만 `#[serde(default)]` 때문에 `models`가 빠진 요청은 claude가 "CLI 기본값"으로 돈다. 이 동작을 단언으로 고정해야 한다(D5).
- D-2 M1 판정 규칙: R1~R4는 잘 정의되어 있다. 판정별 AC 분기(AC-013·014·015의 N/A 기록)도 모호하지 않다. 부족한 점은 개정 경로의 행위 주체(D4)와 sonnet 이전 대상(D7)이다. claude `--model` 없음이 실패했을 때의 처리는 "기록만"으로 읽히는데, 기본값이 haiku라서 영향은 없다.
- D-3 기본값: 사용자 결정 범위다. 근거도 일관된다.
- D-4 감지 결과에 목록 싣기: ACL 회피 근거는 코드로 확인했다. 동기 명령 문제는 D2에서 다뤘다.
- D-5 사고 예산 제거: 사용자 결정이므로 거부하지 않는다. 측정 기록 계획은 적절하다.
- D-6 검증 위치: 목록 소속 검사가 `-c` 같은 인자 주입을 막는다는 판단은 타당하다. 조회 목록 slug는 codex 바이너리 출력에서 오므로 신뢰 경계가 약하다. slug 문자 집합 검사(예: `[A-Za-z0-9._-]`, `-`로 시작 금지)를 더하면 방어가 한 겹 늘어난다(선택).
- D-7 시간 한도 조회: 표준 라이브러리만 쓰는 방식은 적절하다. 실행 스레드 문제는 D2.
- D-8 프런트엔드: 구조는 합리적이다. 고스트 오류 표시 누락(D1)과 `BuildSelectionRequestInput`(D9)을 보완해야 한다.

## Tier·범위

Tier L 분류는 정직하다. 실행 파일 14개와 테스트 약 10개로 15개를 넘고, LOC 추정(600~900)이 M 범위라는 점도 밝혔다. REQ 17개와 AC 19개는 Tier L 상한 25 안에 있다. CATALOG 경로의 캐시와 실패 재시도는 사용자 결정(조회 사용)에서 나온 것이라 과잉 설계로 보지 않는다.

## Recommendation

FAIL. 다음 순서로 고친 뒤 재감사한다.

1. D1: 고스트 텍스트·이어쓰기 거부 오류의 표시 요구와 AC를 추가하고, research·design의 잘못된 주장을 고친다.
2. D2·D3: 조회 실행 위치(메인 스레드 회피 또는 수용 명시)와 `ai_request`가 조회하는 조건을 REQ-AI14-014와 design D-7에 정하고 AC-015에 0회 호출 단언을 더한다.
3. D4: M1 판정이 기본 설계와 다를 때의 개정을 blocker → manager-spec 재위임 흐름으로 바꾸고, REQ-AI14-016과 AC-017 문구를 맞춘다.
4. D5·D6: 라우팅된 도구 항목 선택과 감지 결과 목록 채움을 단언하는 cargo test AC를 더한다.
5. D7: sonnet이 M1에서 빠질 때의 이전 대상을 개정 규칙에 넣는다.
6. D11·D12: AC-017 명령과 AC-019-3 판정 조건을 이진화한다.
7. 나머지 minor(D8~D10, D13~D19)는 함께 정리하면 좋다.

## 미검증 항목 (Gaps)

- research.md §2의 CLI 측정 사실(목록 8개와 9개, `gpt-5.5` 부재, 0.57초, 버전)은 비용 제약으로 다시 실행하지 않았다.
- Tauri 2 동기 명령의 메인 스레드 실행은 공식 문서 지식에 근거한 것이며 이 앱에서 실측하지 않았다(D2).
- D1은 코드 읽기와 grep으로 확인했고 실행 재현은 하지 않았다. run 단계에서 실패하는 재현 테스트로 먼저 확인하기를 권한다.
- SPEC-AI-012·013·015 산출물은 이 worktree 밖에 있을 수 있으나 작업 범위 제약으로 읽지 않았다.
