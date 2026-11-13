# SPEC-AI-016 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-11-13 (plan-auditor 2회차 PASS 0.90)
- 작업 위치: `.claude/worktrees/t8`, 브랜치 `WT-web-research`(origin/main 7480a95 기준), 카드 t8
- 산출물: spec.md, plan.md, acceptance.md, spike/(실측 캡처 8개·기준 프롬프트·탐침 프롬프트·정리 스크립트)
- 계획 단계 실측: spec.md 「실측 기록」 R1~R14 (claude 2.1.323, codex-cli 0.167.0, macOS)
- plan-auditor: (아래에 회차별 기록)

### plan-auditor 회차 기록

| 회차 | 판정 | 점수 | 보고서 | 반영 |
|------|------|------|--------|------|
| 1 | FAIL | 0.82 (Clarity 0.75 / Completeness 0.85 / Testability 0.80 / Traceability 0.90) | `.moai/reports/plan-audit/SPEC-AI-016-review-1.md` | v0.2.0 — 막힘 D1(실측 프롬프트≠조립기 → 정본 문구 고정 + R14 재측정), D2(로컬 접근 → R12·R13 실측, 잔여 위험 정정), 막힘급 D3(리서치 카드 완결 안내 숨김), D4(하위 에이전트 → R10 실측, AC-014 반영), 경미 D5~D16 전부 반영 |
| 2 | PASS | 0.90 (Clarity 0.85 / Completeness 0.90 / Testability 0.90 / Traceability 0.95) | `.moai/reports/plan-audit/SPEC-AI-016-review-2.md` | D1~D16 전부 해소 확인. 새 경미 지적 N1~N6 은 v0.2.1 에서 반영(재감사 없음 — 문구·규칙 보강만) |

## §E.2 Run-phase Evidence

- run 환경: 워크트리 `.claude/worktrees/t8`, 브랜치 `WT-web-research`, origin/main 03450c1(카드 t10 핫픽스 PR #100) 병합 후 시작(762325d). claude 2.1.323 / codex-cli 0.167.0 / macOS.
- 구현 위임: Rust(M1~M3)·프런트(M4) 각각 `general-purpose` 에이전트 1개(순차, worktree 격리 미사용). 코디네이터 워커(이 세션)가 아래 게이트를 직접 다시 실행해 원문을 확인했다.
- 커밋: 476d2a6(M1 픽스처) · f9902d5(M2 백엔드) · 4f545ee(M3 스트림·릴레이) · de22d1c(M4 출처 검증 모듈) · adbdd2a(M4 메뉴·카드).

### 결정(사용자 대신, run 단계)

- R-1. D4 는 카드 t10 이 이미 넣은 `-c` 4쌍을 그대로 두고, `build_codex_args(model, scratch, web_allowed)` 로 `web_search` 값만 `live`/`disabled` 로 바꿨다(플래그 중복 없음).
- R-2. 리서치 프롬프트 조립은 `prompt.rs` 의 `build_research_prompt` 한 곳(앞뒤 문맥 빈 문자열로 `build_inline_prompt_ex` 호출). 리서치 범위 절은 별도 함수, 기존 `scope_clause` 무변경.
- R-3. 웹 허용은 `AiFeature::allows_web()` → `AiRequest.web_allowed` 한 경로뿐(`mod.rs:68`, `:296`). 프런트(`src/`)에 웹 허용 필드 없음(grep 0건).
- R-4. 릴레이 함수 두 개에 `research: bool` 인자를 더했다. 리서치 진행 문구는 카드 스트리밍 렌더 안 한 줄(`.mdedit-ai-research-progress`).
- R-5. AC-AI16-014 프로브는 앱 정식 인자에서 `--skip-git-repo-check` 만 뺐다(아래 「편차」).

### 게이트 원문 (이 세션에서 직접 실행, 워크트리 루트)

```
$ npm run typecheck                       → exit 0   (tsc --noEmit, 출력 없음)
$ npm run lint                            → exit 0   (eslint . --max-warnings 0, 출력 없음)
$ npx vitest run --dir src                → exit 0
   Test Files  124 passed (124)
        Tests  2159 passed (2159)
$ cargo test --manifest-path src-tauri/Cargo.toml   → exit 0   (PATH=$HOME/.cargo/bin)
   test result: ok. 443 passed; 0 failed   (lib)
   test result: ok. 0 passed; 0 failed     (main)
   test result: ok. 3 passed; 0 failed     (tests/app_acl.rs)
   test result: ok. 8 passed; 0 failed     (tests/asset_charset.rs)
   test result: ok. 0 passed; 0 failed     (doc-tests)
```
(vitest 출력에 스택 트레이스 줄이 보이지만 실패 0건, 종료 코드 0.) 원문 로그는 `.moai/logs/gate-*.txt`(미추적).
Rust 테스트는 CI 가 돌리지 않는다(`release.yml:11`). 위가 유일한 Rust 증거다.

### RED 증거 (에이전트 보고 발췌)

- Rust: 구현 전 컴파일 오류 — `no variant or associated item named 'Research' found for enum 'AiFeature'`, `cannot find value 'RESEARCH_WATCHDOG_SECS'`, `build_claude_args takes 2 arguments but 3 were supplied`, `cannot find type 'ResearchActivity'`. 컴파일 오류형 RED 이고 단언 실패형이 아니다. codex 인자 테스트는 RED 실행을 따로 캡처하지 못했다(갭).
- TS: 구현 전 `aiResearch.test.ts 26 tests | 19 failed`, `researchSources.test.ts` 모듈 없음으로 로드 실패.

### AC-AI16-014 — codex 실 CLI 프로브 (이 세션에서 직접 실행)

- 인자: `codex exec -C <빈 폴더> --ignore-user-config --ephemeral --sandbox read-only -c features.apps=false -c features.shell_tool=false -c features.view_image=false -c web_search=disabled --json`, 프롬프트는 표준 입력. **편차: 앱 정식 인자의 `--skip-git-repo-check` 를 뺐다**(워크트리 보호 훅이 그 문자열이 든 명령을 거부함). 대신 워크트리 안 빈 폴더(`.moai/logs/probe-cwd`, git 저장소 내부라 그 플래그 없이도 실행됨)를 `-C` 로 썼다. 이 플래그는 신뢰 폴더 검사일 뿐 도구 목록과 무관하다고 보지만, 정식 인자 그대로 확인한 것은 아니다.
- 항목 종류별 개수(`item.completed` 기준, 원문 출력은 연결 앱 목록이 담길 수 있어 저장소에 넣지 않음):

| 실행 | agent_message | mcp_tool_call | web_search | command_execution | codex_apps 서버 |
|------|---------------|---------------|------------|-------------------|-----------------|
| probe-search-prompt (disabled) | 2 | 0 | 0 | 0 | 0 |
| probe-tools-prompt (disabled) | 2 | 2 | 0 | 0 | 0 |
| 하위 에이전트 시험 (disabled) | 1 | 0 | 0 | 0 | 0 |
| 대조: research-prompt (live) | 1 | 0 | 2 | 0 | 0 |

- tools 실행의 `mcp_tool_call` 2건은 서버 `codex`(내장)의 `list_mcp_resource_templates`·`list_mcp_resources` 목록 조회뿐이다(`codex_apps` 아님, 셸·웹 아님).
- 하위 에이전트: stderr 에 `collab spawn failed … no rollout found for thread id …` — 시작 실패(R10 재확인). 하위 에이전트 활동 0건. `multi_agent=false` 추가는 필요 없다.
- 대조(live): `web_search` 항목 2개 중 `open_page` 이면서 결과에 같은 `url` 이 있는 것이 1개 → 통과 조건 충족.
- 최종 판정: 통과 조건(`web_search`·`command_execution` 0, `codex_apps` 0, spawn_agent 실패) 충족.

### AC 상태

| AC | 상태 | 근거 |
|----|------|------|
| AC-AI16-001 | 통과(자동) | `aiResearch.test.ts`, `aiSelectionToolbar.test.ts` |
| AC-AI16-002 | 통과(자동, Rust) | `AiFeature::resolve`/`allows_web`, `web_allowed_comes_only_from_feature` |
| AC-AI16-003 | 통과(자동, Rust) | 조립 결과가 `research-system.txt`·`research-user.txt` 와 바이트 동일(두 파일 모두 끝 개행 없음) |
| AC-AI16-004 | 통과(자동) | 6000 허용 / 6001 차단, 안내에 `다듬기·직접 입력·리서치는` |
| AC-AI16-005 | 통과(자동, Rust) | claude 인자 웹 허용 거짓=현행, 참=`--tools`·`--allowedTools` `WebSearch,WebFetch` |
| AC-AI16-006 | 통과(자동, Rust) | 17/19개, `live`↔`disabled` 한 원소만 차이, `--disable` 없음 |
| AC-AI16-007~009 | 통과(자동, Rust) | 캡처 8개 전부 표와 일치, narration 캡처 0청크(비리서치는 113) |
| AC-AI16-010~012 | 통과(자동) | 진행 문구·삽입 전용·미검증 출처 알림 |
| AC-AI16-013 | 통과(자동) | Rust 180초 / TS 180000·185000 |
| AC-AI16-014 | 통과(실 CLI, 편차 있음) | 위 표 |
| AC-AI16-015 | **미확인(사용자 수동)** | macOS 앱 전체 흐름 — claude·codex 각 1회, 서술 문장 없음, 알림이 열어 본 주소엔 안 뜸(A1 순서) |
| AC-AI16-016 | **미확인(사용자 수동)** | Windows 실기기 없음 |

### 갭 / 남은 위험

- Playwright: plan 이 지정한 스펙 없음. 기존 e2e(`ai-006`, `ai-inline-edit` 등)는 메뉴 전체 목록·개수를 단언하지 않아 실행하지 않았다(미실행, 근거는 프런트 에이전트의 grep 보고 — 이 세션에서 재확인하지 않음).
- `ai://research` → `ai://done` 순서는 같은 릴레이 스레드·함수 구조로만 보장되고 실제 Tauri 이벤트 루프에서는 시험하지 않았다(AC-AI16-015 에서 확인, plan 위험 표 첫 줄 대응책 유효).
- codex 인자 테스트의 RED 단계 캡처 누락(위).
- 정식 인자 그대로의 프로브가 아님(`--skip-git-repo-check` 제외).
- 옛 codex 버전의 `web_search` 키 무시(A3), claude WebFetch 의 로컬 HTTPS 접근(R12)은 spec.md 잔여 위험 그대로.

## §E.3 Run-phase Audit-Ready Signal

- run_status: audit-ready (수동 확인 AC-AI16-015·016 은 사용자 몫으로 대기)
- run_complete_at: 2026-11-13
