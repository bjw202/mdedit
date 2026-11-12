# SPEC-AI-014 — Progress

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-11-13
- plan 산출물: spec.md, plan.md, acceptance.md, design.md, research.md (Tier L의 계획 산출물 5개). status: draft.
- 기준: `origin/main` `5c617ae`, 브랜치 `WT-model-picker`, worktree `.claude/worktrees/t6`.
- 백로그 카드: t6. 선행: SPEC-AI-012(t4), SPEC-AI-013(t5). run은 두 SPEC 병합 뒤 그 `main`에서 시작한다(plan.md §E).
- 사용자 대신 정한 결정: design.md D-1~D-8 (코디네이터 브리프의 자율 진행 권한).
- plan-audit 1차: FAIL 0.78(Clarity 0.75 / Completeness 0.75 / Testability 0.80 / Traceability 0.85), 보고서 `.moai/reports/plan-audit/SPEC-AI-014-review-1.md`. 결함 19건(BLOCKING 1, SHOULD-FIX 8, MINOR 10)을 spec.md 0.1.1과 plan.md·acceptance.md·design.md·research.md에 반영했다. REQ 17→18, AC 19→21.
- plan-audit 2차: PASS-WITH-DEBT 0.89(Clarity 0.85 / Completeness 0.90 / Testability 0.85 / Traceability 0.95), 보고서 `.moai/reports/plan-audit/SPEC-AI-014-review-2.md`. 1차 결함 18건 해결·1건(AC-017) 부분 해결. 새 결함 SHOULD-FIX 2·MINOR 6·선택 2건을 spec.md 0.1.2 등에 반영했다.
- plan-audit 3차: **PASS 0.91**(Clarity 0.85 / Completeness 0.95 / Testability 0.90 / Traceability 0.95), 보고서 `.moai/reports/plan-audit/SPEC-AI-014-review-3.md`. 2차 결함 10건 해결 확인. 남은 MINOR 3건(시작 직후 거부 문구, 한계 문장 조건, `ps -axww`)은 spec.md 0.1.3에서 몇 줄로 고쳤다. 최대 감사 횟수(3회)에 도달해 이 수정분은 재감사하지 않았다.
- 코디네이터 지시(task_e6046de4fcf8, 2026-11-13): SPEC-AI-013(t5)의 표준 입력 전달 결정에 맞춰 REQ-AI14-011(spec.md 0.1.4), design.md D-2·D-7, plan.md §E 겹침 표, acceptance.md AC-010을 고쳤다. 감사 횟수 한도 때문에 재감사하지 않았다(요구사항 수·의미 변화 없음).

## §E.2 Run-phase Evidence

### M0 선행 확인 (2026-11-13)

- `git merge --no-ff origin/main` 완료. SPEC-AI-012·013 디렉터리가 들어왔다. 두 spec.md 프런트매터 `status`는 `implemented`다(`completed` 아님). 코디네이터 브리프가 두 PR(#96, #97) 병합을 확인했으므로 진행한다.
- 기준 게이트: `npm run typecheck` 출력 오류 없음, `npm run lint` 출력 오류 없음(병합 직후, 변경 전).
- 병합본 시그니처: `build_claude_args(model: AiModel, system_prompt_path)` 13개 인자, `build_claude_command(binary, args, cwd, model)`, `spawn_claude(args, cwd, model, user_prompt)`, `build_codex_args(model: AiModel, scratch_dir)` 13개 인자(위치 인자 프롬프트 없음), `combine_prompts`·`spawn_stdin_writer`는 건드리지 않는다.

### M1 실측

시험 모양: 앱의 최종 인자와 같게 하되 모델 인자만 바꾸고 추론 설정은 뺐다. claude는 `-p --system-prompt-file <파일> [--model X] --output-format stream-json --include-partial-messages --verbose --setting-sources "" --tools ""`, 사용자 프롬프트 `Reply with exactly: OK`를 표준 입력으로 쓰고 EOF. `MAX_THINKING_TOKENS`는 해제. codex는 `exec -C <빈 디렉터리> --ignore-user-config --skip-git-repo-check --ephemeral --sandbox read-only [--model X] --json`, 결합 프롬프트를 표준 입력으로. 도구 버전 claude 2.1.322, codex-cli 0.167.0. 원본 캡처: `m1-raw-results.json`(요약), 스크립트와 모델별 원본은 코디네이터 scratchpad `m1/`.

| 도구 | 모델 | 종료 코드 | `OK` 포함 | 오류 요약 | 소요(초) |
|------|------|-----------|-----------|-----------|----------|
| claude | haiku | 0 | 예 | - | 2.16 |
| claude | sonnet | 0 | 예 | - | 2.58 |
| claude | opus | 0 | 예 | - | 2.38 |
| claude | fable | 0 | 예 | - | 4.09 |
| claude | (CLI 기본값) | 0 | 예 | - | 2.14 |
| codex | gpt-6.1-sol | 0 | 예 | - | 4.90 |
| codex | gpt-6-astra | 0 | 예 | - | 3.85 |
| codex | gpt-6.1-terra | 0 | 예 | - | 3.95 |
| codex | gpt-6-sol | 0 | 예 | - | 3.43 |
| codex | gpt-6-luna | 0 | 예 | - | 3.33 |
| codex | gpt-5.6-sol | 0 | 예 | - | 3.12 |
| codex | gpt-5.6-terra | 0 | 예 | - | 2.76 |
| codex | gpt-5.6-luna | 0 | 예 | - | 2.73 |
| codex | gpt-5.5 (내장 목록 전용, 참고) | 1 (2회 모두) | 아니오 | `The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account` | 2.31 |
| codex | (CLI 기본값) | 0 | 예 | - | 3.40 |

haiku 사고 예산 비교(고스트 크기 프롬프트, 각 3회, 중앙값): `MAX_THINKING_TOKENS=0` 첫 출력 0.23초·전체 2.38초 vs 미설정 첫 출력 0.26초·전체 2.39초. 개별 값 — 0: (0.22/2.38, 0.23/2.69, 0.25/2.32), 미설정: (0.26/2.38, 0.25/2.44, 0.26/2.39). 첫 출력은 스트림 첫 바이트(초기화 이벤트)라 첫 토큰이 아니고, 전체 시간이 실질 지표다. 차이 없음.

```
codex-list-verdict: CATALOG
claude-aliases: haiku, sonnet, opus, fable
codex-fixed-list: gpt-6.1-sol, gpt-6-astra, gpt-6.1-terra, gpt-6-sol, gpt-6-luna, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna
codex-default: CLI 기본값
haiku-thinking: 0 설정 중앙값 2.38s vs 미설정 중앙값 2.39s (차이 없음)
```

판정(design.md D-2): R1 통과(별칭 4개 전부 성공), R2 `CATALOG`(조회 목록 8개 전부 성공), R4 해당 없음(codex `--model` 없음 성공). 기본 설계와 같으므로 SPEC 개정 없이 M2로 간다. `gpt-5.5`는 내장 목록에만 있고 이 계정에서 실패한다(기존 앱이 박아 둔 모델이 실제로 깨져 있었다는 증거). 고정 목록 순서는 조회 `priority` 오름차순이다. 테스트 fixture: `src-tauri/tests/fixtures/codex-models-sample.json`(실제 조회 출력에서 모델 3개 + `hide` 1개를 뽑고 긴 문자열만 80자로 자름, 순서는 정렬 시험용으로 섞음).
