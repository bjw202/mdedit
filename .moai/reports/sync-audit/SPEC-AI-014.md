# SPEC-AI-014 sync 감사 보고서 (sync-auditor)

- 대상: SPEC-AI-014 (도구별 AI 모델 선택, 고급 모델 토글·단발 버튼 제거, 추론 강도 = CLI 기본값)
- 기준: worktree `.claude/worktrees/t6`, 브랜치 `WT-model-picker`, HEAD `e43d3fd`, run 기준 커밋 `e04c16c`
- 감사 방식: 코드 직접 판독 + 읽기 전용 명령 + 단일 파일 단위 테스트 실행. 소스·문서·SPEC은 수정하지 않았다. 전체 테스트 스위트는 돌리지 않았다(CPU 공유).
- 감사 시점 입력 요약: 실행 코드 변경은 `8f44695`까지이고, 그 뒤 두 커밋(`20740de`, `e43d3fd`)은 문서만 바꾼다.

## 종합 판정

| 항목 | 값 |
|------|----|
| 최종 판정 | **PASS-WITH-DEBT** |
| 종합 점수 | **0.89** (가중 조화평균, 가중치 40/25/20/15) |
| must-pass 방화벽 | Functionality 0.92, Security 0.90 — 둘 다 통과 |
| BLOCKING 결함 | 0건 |
| SHOULD-FIX | 4건 (D1~D4) |
| MINOR | 7건 (D5~D11) |

| 차원 | 점수 | 판정 | 핵심 근거 |
|------|------|------|-----------|
| Functionality (40%) | 0.92 | PASS | REQ 18건 모두 구현·테스트 대응 확인. AC-019(실기기)만 대기(예상된 상태). 문서 1곳이 코드와 어긋남(D2). |
| Security (25%) | 0.90 | PASS | 모델 검증이 Rust에서 스폰 앞에 일어나고, `--model`은 별도 argv 원소다. codex 조회 슬러그의 문자 검증이 없는 점은 낮은 위험(D5). |
| Craft (20%) | 0.85 | PASS | 새 테스트는 구체 값을 단언한다. 단 RED 출력 부재, `ai_request` 통합 테스트 부재, 커버리지 수치 미측정, §E.3 누락. |
| Consistency (15%) | 0.88 | PASS | 한국어 주석·MX 태그·기존 패턴을 따른다. 단 `.moai/project/codemaps` 3개가 옛 모델 체계를 그대로 서술한다(D3). |

계산: 1 / (0.40/0.92 + 0.25/0.90 + 0.20/0.85 + 0.15/0.88) = 1 / 1.1183 = 0.894

## 1. Claim (검증 대상 주장)

C1. REQ-AI14-001~018이 모두 구현되었고 각각 테스트 근거가 있다. AC-001~018, 020, 021은 자동 PASS이고 AC-019만 수동 대기다.
C2. 모델 값은 Rust에서 허용 목록으로 검증한 뒤에만 CLI를 띄우며, 인자 주입 경로가 없다.
C3. 옛 체계(`AiModel`, `resolveModel`, `aiAdvancedModel`, `MAX_THINKING_TOKENS`, `model_reasoning_effort`, `mdedit-ai-advanced`)의 잔재가 없다.
C4. CHANGELOG·USER_GUIDE의 서술(저장 이전 방향, 오류 문구, gpt-5.5 실패, 변경 파일, 검증 수치)이 코드·증거와 일치한다.
C5. 검증 수치(typecheck 0, lint 0, vitest 122개 파일 2086건, cargo test 421건, Playwright 13 passed/1 skipped)가 현재 트리에 유효하다.

## 2. Evidence (명령과 출력)

### 2.1 AC grep 검사 (이 트리, HEAD e43d3fd)

```
$ git grep -nE "[\"'`](haiku|sonnet|opus|fable)[\"'`]" -- src ':!src/test'     # AC-003
src/store/uiStore.ts:31:// @MX:NOTE: SPEC-AI-014 REQ-AI14-002 — 프런트엔드에서 모델 이름 문자열('haiku'/'sonnet')이 나오는 유일한 곳
src/store/uiStore.ts:34:const DEFAULT_AI_MODELS: AiModelSelection = { claude: 'haiku', codex: null };
src/store/uiStore.ts:270:            aiModels: { claude: aiAdvancedModel === true ? 'sonnet' : 'haiku', codex: null },
$ git grep -n resolveModel -- src                                              # exit=1 (출력 없음)
$ git grep -nE "AiModel|from_opt|codex_model_arg|codex_reasoning_effort|codex_effort_display|advanced_model_label|claude_thinking_env" -- src-tauri/src   # AC-004, exit=1
$ git grep -nE "MAX_THINKING_TOKENS|model_reasoning_effort" -- src-tauri/src   # AC-011, exit=1
$ git grep -n "mdedit-ai-advanced" -- src                                      # AC-002, exit=1
$ git grep -n "pub async fn ai_detect_providers" -- src-tauri/src              # AC-016
src-tauri/src/ai/mod.rs:400:pub async fn ai_detect_providers() -> Result<Vec<ProviderStatus>, String> {
```

### 2.2 잔재 grep (고급 모델 / aiAdvancedModel / advancedModelLabel, 실행 코드·docs·README)

```
src-tauri/src/ai/provider.rs:206:        assert!(!json.contains("advancedModelLabel"));           # 부재 단언(정상)
src/store/uiStore.ts:264,267,270                                                  # v2→v3 이전 코드(정상)
e2e/spec-img-load-001.spec.ts:35,125  spec-img-load-002.spec.ts:39  spec-img-mode-003.spec.ts:38
e2e/spec-img-widget-002.spec.ts:41    unsaved-changes-guard.spec.ts:24            # `aiAdvancedModel: false` + `version: 1` 저장 상태 시드
```

`src/test`의 나머지 일치는 모두 부재 단언 또는 이전 규칙 시험이다. e2e 6곳은 `version: 1` 저장 상태를 심는 옛 상태 시드이고 v1→v3 이전 경로를 통과한다(progress.md는 이 5개 파일을 실행해 13 passed/1 skipped라고 기록).

### 2.3 문서 쪽 잔재 (확대 grep: `*.md`, `.moai/specs`·`.moai/reports`·`.claude`·CHANGELOG 제외)

```
.moai/project/codemaps/backend.md:169   `AiModel`(Haiku/Sonnet)
.moai/project/codemaps/backend.md:181   모델 선택: 기본 Haiku, 요청 시 Sonnet.
.moai/project/codemaps/backend.md:192   Haiku는 `MAX_THINKING_TOKENS=0`을 지정합니다.
.moai/project/codemaps/backend.md:193   모델은 두 단계 모두 `gpt-5.5`이며 추론 강도만 medium/high로 다릅니다.
.moai/project/codemaps/frontend.md:116  고급 모델 토글 ... `resolveModel` ... export
.moai/project/codemaps/frontend.md:217  타입: `AiModel`(`haiku`/`sonnet`)
.moai/project/codemaps/pipelines.md:331 모델은 `aiAdvancedModel`이 켜져 있으면 `sonnet`, 아니면 `haiku`.
video/src/scenes/S3AI.tsx:953           <ToggleRow label="고급 모델 사용 (sonnet — 더 정확, 더 느림)" on={false} />
```

### 2.4 이전 방향·오류 문구 (코드 대 CHANGELOG)

- `src/store/uiStore.ts:264-272`: `version < 3`에서 `aiAdvancedModel === true ? 'sonnet' : 'haiku'`, codex는 `null`. 테스트 `uiStore.test.ts`의 "버전 1 { aiAdvancedModel: false } 는 claude haiku 가 된다", "버전 1 { aiAdvancedModel: true, fontSize: 16 } 은 claude sonnet" 등이 양방향을 단언한다. CHANGELOG의 "켠 사용자는 sonnet, 끈 사용자는 haiku, codex는 CLI 기본값" 서술과 일치.
- `src-tauri/src/ai/models.rs:306`: ``format!("{name}에서 `{model}` 모델을 쓸 수 없어요. 설정 > AI에서 모델을 다시 골라 주세요.")`` — CHANGELOG 인용과 일치. 목록 미확정 문구는 `models.rs:309`.

### 2.5 gpt-5.5 실패 서술의 근거

- 옛 코드: `git show e04c16c:src-tauri/src/ai/codex_cli.rs` → `AiModel::Haiku | AiModel::Sonnet => "gpt-5.5"` (45행). 즉 옛 앱은 토글 켬·끔 **모두** codex에 `gpt-5.5`를 넘겼다.
- 저장소 안 증거 `.moai/specs/SPEC-AI-014-model-picker/m1-raw-results.json` rows[13]: `{"tool": "codex", "model": "gpt-5.5", "code": 1, "ok": false, "err": "Reading prompt from stdin...\n", "total": 2.31, "tries": 2}`. 실패 사실(종료 코드 1, 2회)은 지지하지만 인용된 오류 문장은 이 파일에 없다.
- 코디네이터 scratchpad 원본(저장소 밖) `.../scratchpad/m1/raw/codex-gpt-5.5.json`에는 `"The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account."`가 들어 있어 문장 자체는 사실이다. 다만 저장소에 남지 않는 임시 경로다.

### 2.6 시험 실행 (단일 범위)

```
$ cargo test --manifest-path src-tauri/Cargo.toml --lib ai::
test result: ok. 271 passed; 0 failed; 0 ignored; 0 measured; 150 filtered out; finished in 0.12s
$ npx vitest run src/test/uiStore.test.ts src/test/SettingsModal.test.tsx src/test/aiModelSelectionCard.test.ts src/test/aiModelSelectionGhost.test.ts
 Test Files  4 passed (4)
      Tests  137 passed (137)
$ npx tsc --noEmit -p .                                  # exit=0
$ npx eslint (변경한 주요 6개 프런트 파일)               # exit=0
```

### 2.7 AC-017 순서, 실행 코드 불변

```
$ git merge-base --is-ancestor 5fb70ff 4bdde44 && echo ok     # 판정 줄 커밋이 첫 실행 코드 커밋의 조상
AC017 ancestor ok
$ git diff --stat 8f44695 HEAD -- . ':!.moai'
 CHANGELOG.md       | 1 +
 docs/USER_GUIDE.md | 4 ++--
```

### 2.8 REQ별 구현·테스트 대응

| REQ | 구현 위치 | 테스트 근거 | 판정 |
|-----|-----------|-------------|------|
| 001 토글·버튼 제거 | `SettingsModal.tsx`(AdvancedModelToggle 삭제), `ai-suggestion-card.ts`(버튼·CSS 삭제) | SettingsModal.test AC-001, aiSuggestionCard.test:366, aiCardRetryLimit.test:188 | PASS |
| 002 중복 제거 | `currentAiModels()`(uiStore.ts:280), `models.rs` 단일 모듈 | 2.1 grep 전부 통과 | PASS |
| 003 드롭다운 | `SettingsModal.tsx` `ModelSelect`(aria-label "Claude 모델"/"Codex 모델", 입력칸 없음, 잠금·미설치·미로그인 disabled) | SettingsModal.test AC-005 4건 | PASS |
| 004/005 기본값·이전·모양 정규화 | `uiStore.ts` `DEFAULT_AI_MODELS`, `normalizeAiModels`, `migrate`(v<3) | uiStore.test 9건(양방향 이전, 모양 오류 항목별 복원) | PASS |
| 006 목록 밖 저장값 | `ModelSelect` `missing` 선택지 | SettingsModal.test AC-007 | PASS |
| 007 models 싣기·라우팅 도구 항목 | `AiRequestArgs.models`, `ModelSelection::for_provider`, `resolve_request_model` | mod.rs 테스트 5건, aiModelSelectionGhost AC-008, 툴바 테스트 | PASS |
| 008 모르는 모델 거부 | `models::validate`, `mod.rs:224` 스폰 앞(in-flight 교체보다도 앞) 호출 | models.rs 테스트(`validate_*`), `resolve_request_model_rejects_unlisted_model_before_any_spawn` | PASS |
| 009 `--model` 생략/한 쌍 | `build_claude_args`·`build_codex_args` | `claude_args_model_absent_vs_present`, `codex_args_model_absent_vs_present` | PASS |
| 010 추론 설정 없음 | 두 어댑터에서 `-c`·환경 변수 제거 | 2.1의 AC-011 grep, `codex_args_have_no_reasoning_override_and_keep_isolation` | PASS |
| 011 격리 플래그 | 인자 조립 함수 | 위 두 테스트 + stdin 테스트 유지 | PASS |
| 012 claude 고정 목록 | `CLAUDE_FIXED` | `claude_fixed_list_matches_m1_aliases_with_capitalized_labels` | PASS |
| 013 codex 조회·파싱 | `parse_codex_catalog`, `run_codex_debug_models`(절대 경로, 3초 한도, kill+wait, stdin null) | `parse_catalog_*`(fixture), `query_times_out_*` | PASS |
| 014 캐시·조회 중 표시 | `CodexCatalog`(`in_flight`, 잠금은 결과 기록 순간만) | `success_is_cached_*`, `request_path_queries_only_when_needed`, `in_flight_lookup_does_not_block_request_validation`, `unsettled_list_rejection_*` | PASS (D6 참고) |
| 015 감지 결과에 목록 | `ProviderStatus.models`, `attach_models`, `async fn ai_detect_providers`+`spawn_blocking` | provider.rs·mod.rs 테스트, grep | PASS |
| 016 실측 먼저 | progress.md §E.2 M1 실측, 커밋 순서 | 2.7 | PASS |
| 017 재요청 승계 | `fireReRequest`가 `originalArgs` 스프레드, `model` override 삭제 | aiModelSelectionCard 4건 + Ghost AC-018 | PASS |
| 018 고스트 거부 표시 | `ai-ghost-text.ts` `reportGhostRequestFailure`(failRequest + setStatusMessage) 4경로 | aiModelSelectionGhost AC-020 4건 | PASS |

AC 매핑 정직성: acceptance.md의 AC-001~018, 020, 021 대응 근거를 위 표와 2.1/2.6에서 직접 재확인했다. AC-019만 미실행이고 CHANGELOG·progress.md가 그렇게 적고 있어 서술은 정직하다. "21개 중 20개"는 `acceptance.md`의 AC 식별자 개수와 맞다.

## 3. Baseline-attribution (측정 기준)

- 2.1~2.5, 2.7 명령은 이번 감사에서 HEAD `e43d3fd` 트리에 직접 실행한 결과다.
- 2.6의 시험 결과(Rust 271건, vitest 137건, tsc, eslint)는 이번 감사에서 이 트리에 실행한 것이며, **일부 범위**다(`ai::` 필터, 4개 파일, 6개 파일).
- C5의 전체 수치(vitest 122개 파일 2086건, cargo test 421건, Playwright 13 passed/1 skipped, typecheck 0, lint 0)는 이번에 재실행하지 않았다. progress.md §E.2가 HEAD `8f44695`에서 얻었다고 기록한 값이며, `git diff --stat 8f44695 HEAD -- . ':!.moai'`가 CHANGELOG와 USER_GUIDE 두 문서만 보여 **실행 코드가 그 이후 같다는 점은 확인**했다. 따라서 귀속은 유효하되 "인용"으로 분류한다(재측정 아님).

## 4. Gaps (이번 감사가 확인하지 못한 것)

- AC-019 전부(macOS 실기기 4항목)와 Windows 전부.
- 전체 vitest·cargo·Playwright 스위트 재실행. CPU 공유 때문에 지시대로 돌리지 않았다.
- 커버리지 수치(85% 기준): 어떤 도구로도 측정하지 못했다. 새 Rust 모듈에 테스트 약 26건이 있으나 줄 단위 수치는 없다.
- `cargo clippy`, `cargo fmt --check` 미실행.
- 새 SettingsModal·카드 테스트의 변이(mutation) 검증. 소스를 수정할 수 없어 "테스트가 결함을 실제로 잡는지"는 확인하지 못했다. 단언이 구체 값(`['CLI 기본값','Haiku','Opus']`, `models` 객체 동등성, `statusMessage` 동등성)이라 공허 통과 위험은 낮다고 판독했다.
- `ai_request` 전체 경로(검증→스폰 거부)의 통합 테스트는 없다. 검증 단계 함수는 분리해 시험했고, 스폰 앞 호출 순서는 코드 판독(`mod.rs:224`, 단계 5가 단계 7 in-flight 교체 앞)으로만 확인했다.
- 실제 codex·claude 호출과 `ps` 확인(AC-019 3항).

## 5. Residual-risk (남는 위험)

- M1 실측은 한 ChatGPT 계정·codex-cli 0.167.0·claude 2.1.322 기준이다. 다른 계정 등급에서는 조회 목록에 있어도 CLI 실행 뒤 실패할 수 있다(spec §5가 수용한 한계).
- 고정 목록(claude 별칭 4개·codex 8개)은 시점 값이다. CLI 업데이트로 별칭이 사라지면 검증이 거부하고 안내하지만, 고정 목록을 고치려면 앱 릴리스가 필요하다.
- `ai_request`는 동기 명령이라 캐시가 비어 있고 고정 목록에 없는 codex 모델을 저장해 둔 드문 경우 최대 3초 멈춘다(spec REQ-014가 명시한 한계).
- codex 조회의 읽기 스레드는 손자 프로세스가 파이프를 쥐면 kill 뒤에도 남을 수 있다(`models.rs:138-140` `@MX:WARN`에 기록됨). 앱 시작마다 한 번 이 조회가 돌아 네트워크를 쓴다.
- Windows에서 codex는 `.cmd` 셈 경유라 인자 이스케이프가 다르다. 허용 목록 값만 인자가 되어 위험은 낮지만 이번 감사에서 확인하지 못했다.

## 6. 결함 목록

### SHOULD-FIX

**D1 [SHOULD-FIX] CHANGELOG의 gpt-5.5 서술이 범위를 좁게 잘못 적고 있다**
- 위치: `CHANGELOG.md:8` ("먼저 알려 드릴 점" 문장)
- 내용: "고급 모델 토글을 켠 codex 요청은 이전 버전에서도 실패하고 있었습니다"라고 적었다. 옛 코드는 토글 켬·끔 모두 `gpt-5.5`를 넘겼다(`e04c16c:src-tauri/src/ai/codex_cli.rs:45`, spec.md §1 "두 경우 모두 gpt-5.5"). 따라서 실제 범위는 "해당 계정에서 codex 요청 전부"다. 또 M1 시험은 옛 앱의 정확한 인자가 아니라 새 모양 인자(추론 설정 없음, stdin)로 한 것이라 "이전 버전에서도 실패"는 모델 단위 오류에서 온 추론이다.
- 필요한 수정: "토글을 켠" 한정을 빼고 "시험한 ChatGPT 계정에서는 이전 버전의 codex 요청이 모두 같은 모델로 나가 실패했을 가능성이 높습니다(M1은 새 인자 모양으로 시험)"처럼 근거 범위에 맞춘다.

**D2 [SHOULD-FIX] USER_GUIDE가 카드 재시도의 모델 적용 방식을 오해하게 쓴다**
- 위치: `docs/USER_GUIDE.md:257`
- 내용: "설정에서 다른 모델을 골라 다시 시도할 수 있습니다". REQ-AI14-017은 카드의 모든 재요청이 원래 요청의 `models`를 승계한다고 정했고, AC-018 테스트는 "카드가 열린 뒤 저장소를 바꿔도 원래 값"을 단언한다. 사용자가 설정을 바꾼 뒤 열려 있는 카드의 ↻를 눌러도 새 모델이 적용되지 않는다. 새 요청(다시 선택해 ✨ 실행)부터 적용된다.
- 필요한 수정: "설정에서 모델을 바꾼 뒤 글을 다시 선택해 새로 요청하면 바뀐 모델이 쓰입니다(열려 있는 카드의 ↻는 원래 모델을 유지합니다)"로 바꾼다.

**D3 [SHOULD-FIX] `.moai/project/codemaps`가 옛 모델 체계를 그대로 서술한다**
- 위치: `.moai/project/codemaps/backend.md:169,181,192,193`, `frontend.md:116,217`, `pipelines.md:331`
- 내용: `AiModel`(Haiku/Sonnet), `gpt-5.5`+추론 강도, `MAX_THINKING_TOKENS=0`, `resolveModel`, `aiAdvancedModel`을 현행 사실처럼 적는다. progress.md §E.4는 "README.md와 docs/ 다른 문서에는 바뀐 동작 언급이 없었음(grep 확인)"이라 했으나 grep 범위가 `.moai/project/codemaps`를 포함하지 않았다.
- 필요한 수정: `/moai codemaps`로 재생성하거나 해당 7줄을 `models.rs`·`aiModels`·`currentAiModels()` 기준으로 고친다.

**D4 [SHOULD-FIX] 증거 보존 결함 — 인용한 오류 문장의 원본이 저장소 밖 임시 경로에만 있다**
- 위치: `.moai/specs/SPEC-AI-014-model-picker/m1-raw-results.json` rows[13] `err`; `progress.md:26`(원본을 "코디네이터 scratchpad `m1/`"로 안내)
- 내용: CHANGELOG·progress.md가 인용한 `The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account`는 저장소 안 요약 파일에 없다(`err`는 "Reading prompt from stdin..."). 원본은 임시 폴더이므로 이 인용은 나중에 확인할 수 없다(verification-claim-integrity §2).
- 필요한 수정: rows[13]에 stdout의 `turn.failed` 메시지를 `err`로 복사해 넣거나, 해당 raw 파일 1개를 SPEC 디렉터리에 보존한다.

### MINOR

**D5 [MINOR, 선택] codex 조회 슬러그의 문자 검증이 없다**
- 위치: `src-tauri/src/ai/models.rs:102`
- 내용: `parse_codex_catalog`가 `slug`를 그대로 허용 목록에 넣는다. 슬러그는 같은 PC의 codex 바이너리가 만든 값이고 인자는 별도 원소라 실제 위협은 낮다. 다만 `-`로 시작하거나 공백을 담은 슬러그가 `--model` 뒤에 가면 CLI의 인자 해석에 걸릴 수 있다.
- 필요한 수정(선택): 슬러그를 `[A-Za-z0-9._-]+`이고 `-`로 시작하지 않는 것만 받는다. 방어 심화이므로 차단 사유가 아니다.

**D6 [MINOR] 미설치 codex를 검증 경로에서 조회하면 캐시가 `Failed`로 남는다**
- 위치: `src-tauri/src/ai/models.rs:297-299` (`validate`), 대비 `models.rs:265-276` (`list_for_status`)
- 내용: REQ-AI14-014는 "codex 미설치·미로그인이면 조회하지 않고 캐시를 비운 채 둔다"고 한다. 감지 경로(`list_for_status`)는 지켜서 시험도 있다. `validate`는 상태를 받지 않아 명시 선택으로 미설치 codex가 라우팅되고 모델이 고정 목록 밖이면 `run_codex_debug_models`가 곧바로 `None`을 돌려 `Failed`가 기록된다. 이후 요청 검증은 그 결과를 재사용하고, 감지 경로는 설치·로그인 뒤 다시 조회하므로 실질 피해는 거의 없다.
- 필요한 수정(선택): 해당 경로의 시험을 더하거나 `codex_binary()` 부재 시 `Failed`를 기록하지 않게 한다.

**D7 [MINOR] 드롭다운 목록과 허용 목록의 기준이 다르다(스펙 의도대로이나 사용자에게 모순처럼 보일 수 있음)**
- 위치: `src/components/settings/SettingsModal.tsx:285,312` 대 `models.rs:254-262`
- 내용: 화면은 조회 목록만 보이고(`list_for`), 요청 검증은 조회 ∪ 고정 목록을 허용한다. 저장값이 고정 목록에는 있고 조회 목록에서 사라졌다면 드롭다운은 "(목록에 없음)"이라 표시하는데 요청은 통과해 CLI까지 간다. spec REQ-AI14-006·008이 각각 이렇게 정의해 구현 결함은 아니다.
- 필요한 수정(선택): 문서에 한 줄 덧붙이거나 후속 SPEC에서 기준을 합친다.

**D8 [MINOR] RED 증거 부재가 공식 기록보다 넓다**
- 위치: `progress.md:87`
- 내용: "uiStore·고스트 테스트와 Rust는 RED 확인"이라 적었지만 §E.2 어디에도 RED 실패 출력이 없다(manager-develop 템플릿 E8은 verbatim 출력을 요구). 마일스톤마다 구현과 테스트가 한 커밋에 들어 있어 git으로도 순서를 복원할 수 없다. 보고된 "SettingsModal·카드 테스트 RED 없음"보다 실제 공백이 넓다.
- 필요한 수정: Gaps에 "RED 확인" 주장도 verbatim 출력 없음으로 정정한다. 코드 변경은 불필요.

**D9 [MINOR] progress.md에 §E.3 (Run-phase Audit-Ready Signal)이 없다**
- 위치: `progress.md` 헤더 순서 §E.1(3행) → §E.2(16행) → §E.4(90행)
- 내용: 스키마상 §E.3은 manager-develop의 run 완료 신호다. 누락되어 era 분류가 `§E.3` 마커를 찾지 못할 수 있다.
- 필요한 수정: run 완료 신호 섹션을 보강한다(문서 전용).

**D10 [MINOR] 옛 상태 시드 e2e 6곳이 `aiAdvancedModel`을 남긴다**
- 위치: `e2e/spec-img-load-001.spec.ts:35,125`, `spec-img-load-002.spec.ts:39`, `spec-img-mode-003.spec.ts:38`, `spec-img-widget-002.spec.ts:41`, `unsaved-changes-guard.spec.ts:24`
- 내용: 모두 `version: 1` 저장 상태 시드라 이전 경로를 지나고 5개 파일이 통과했다. 죽은 코드는 아니나, 새 사용자 상태(v3)를 시드하는 것이 아니라 이전 코드에 의존한다. 이전 코드를 나중에 걷어내면 이 6곳도 같이 바뀐다.
- 필요한 수정: 조치 불필요. 이전 코드 제거 시점에 함께 갱신할 것.

**D11 [MINOR] 영상 장면이 제거된 UI를 그린다**
- 위치: `video/src/scenes/S3AI.tsx:953` (`<ToggleRow label="고급 모델 사용 (sonnet — 더 정확, 더 느림)" ...>`), `video/STORYBOARD.md:53`
- 내용: progress.md는 STORYBOARD를 의도적으로 건드리지 않았다고만 적었고 장면 코드는 언급이 없다. 다음 영상 렌더에 사라진 토글이 나온다.
- 필요한 수정: 영상 갱신 때 모델 드롭다운으로 교체한다(이 SPEC 범위 밖, 후속 기록용).

## 7. 알려진 공백에 대한 평가: 구현 뒤에 쓴 SettingsModal·카드 테스트

- 판단: **감점 요인이나 차단 사유는 아니다.** 근거는 다음 셋이다.
  1. 새 테스트가 구체 값을 단언한다(드롭다운 선택지 배열, `selectedOptions[0].textContent`, `models` 객체 동등성, `statusMessage` 동등성). "아무 값이나 통과" 구조가 아니다.
  2. 같은 요구가 이중으로 덮인다. 저장소 쪽은 uiStore 테스트(RED 확인으로 기록)가, 백엔드 쪽은 Rust 테스트가 이미 독립적으로 단언한다.
  3. 이번 감사에서 이 테스트들이 현 트리에서 통과함을 직접 실행으로 확인했다(137건).
- 남는 한계: 테스트가 결함을 잡는다는 증명(RED)은 없다. Craft 점수에서 0.05~0.1 정도를 감했다. 더불어 D8처럼 "RED 확인" 서술 자체의 증거가 없다는 점이 공백을 키운다.

## 8. 권고

1. D1·D2는 문서 두 줄 수정이므로 병합 전에 반영한다(사용자에게 잘못된 서술이 나가는 것을 막는다).
2. D3은 병합 전 `/moai codemaps` 재생성 또는 해당 줄 수정으로 처리한다. 병합 뒤로 미루면 다음 SPEC이 옛 지도를 근거로 삼을 위험이 있다.
3. D4는 raw 한 줄 복사로 끝난다.
4. AC-019 수동 확인 4항목(특히 3항 `no-such-model` 거부 + `ps` 불변)은 병합 전 사용자 실기기에서 하는 것이 맞다. 거부가 CLI 실행 전에 일어난다는 핵심 계약의 유일한 end-to-end 증거가 될 것이다.
5. D5~D11은 후속 처리로 충분하다.
