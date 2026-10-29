# SPEC-INFRA-002 progress.md

## Phase Notes (plan)

- 작성: manager-spec, 2026-10-29. 워크트리 `.claude/worktrees/release-automation`, 브랜치 `WT-release-automation`, 작성 기준 커밋 061e828, 현재 origin/main 97b7db5(대상 파일 무영향 — plan.md §A).
- 외부 근거: manager-spec이 WebFetch로 직접 조회(URL은 `research.md` 각 절). 미확인 항목은 research.md §9.
- 사용자 결정: `interview.md` Round 1~4(Round 3 = 감사 1차 뒤 결정, Round 4 = 승인 게이트 선택).
- Tier M — 산출물: interview.md / research.md / spec.md / plan.md / acceptance.md / spec-compact.md / progress.md(design.md 없음).
- 미결 표지: 없음(v0.2.0에서 모두 해소 — 아래 감사 기록).
- 참고: 이 워크트리에는 `.claude/skills/moai/workflows/plan/`과 `.claude/rules/moai/development/spec-frontmatter-schema.md`가 없어 주 체크아웃의 같은 경로를 읽기 전용으로 참조했다.

## Plan-audit History

- Audit iteration 1 — FAIL 0.75(Tier M 기준 0.80), 2026-10-29 — `.moai/reports/plan-audit/SPEC-INFRA-002-iter1.md`. Claude 단독 감사(MCP 백엔드 연결 실패).
  - 사용자 결정(Round 3, 2026-10-29, `interview.md`): (1) macOS ad-hoc 서명 포함(`signingIdentity: "-"`, `xattr` 안내 안 함), (2) 첫 자동 릴리스 v0.19.0, (3) main 포함 여부 검사 요구 삭제 → BUILD.md 절차·잔여 위험, (4) 자산 확인 job 삭제.
  - v0.2.0 반영 결함: D1·D2·D3·D4·D5·D6·D7·D8·D9·D10·D11(BLOCKING·SHOULD-FIX 전부), D12·D13·D14·D15·D16·D17·D18(MINOR). D19는 남김 — 오케스트레이터 지시로 manager-spec이 `plan_status: audit-ready`를 기록하지 않음.
  - REQ 17→16, AC 14→16, 전 문서 번호 재정렬.
- Audit iteration 2 — PASS-WITH-DEBT 0.90, 2026-10-29 — `.moai/reports/plan-audit/SPEC-INFRA-002-iter2.md`. 차단 결함 없음.
  - Decision Point 1: 사용자 승인(2026-10-29). Round 4 선택(`interview.md`): tauri-action SHA `1deb371b0cd8bd54025b384f1cd735e725c4060f` + `# v1.0.0`, 안내 블록 링크 = Releases URL(앵커 없음), R-8 수용.
  - v0.3.0 반영 부채: N1(빌드 job `shell: bash`)·N2(R-8 문구, 사용자 수용)·N3(정확한 SHA 요구)·N4(BUILD.md 고정 문구)·N5(`github.token` 검사)·N6(이 파일과 plan.md §G 낡은 문구)·N7(서로 다른 사례 수)·N8(로컬 macOS ad-hoc 서명 안내)·N9(`$W` 같은 명령 안에서 정의). REQ·AC 번호 변경 없음(16/16).
  - v0.3.1(2026-10-29): Round 4 선택 (2) 정정 — 안내 블록 링크는 README `https://github.com/bjw202/mdedit`(앵커·`/releases` 없음). REQ-005·AC-005만 수정.
  - 남은 부채: D19 — §E.1 audit-ready 신호는 오케스트레이터가 결과 확인 뒤 기록(지시에 따라 manager-spec은 쓰지 않음). → 2026-10-29T05:02:40Z에 기록 완료(아래 §E.1).
- Run Phase 1 (Plan Audit Gate, 최종본 0.3.1 대상, 새 감사관) — PASS-WITH-DEBT 0.90, 2026-10-29
  - audit_verdict: PASS-WITH-DEBT
  - audit_report: .moai/reports/plan-audit/SPEC-INFRA-002-review-1.md
  - 차단 결함 없음. 선택 부채 D1~D6: D1(acceptance.md:L10, grep 계열 AC의 종료 코드 해석이 반대), D2·D3(AC-005 정규식 경계), D4·D5(낡은 Round/보고서 참조), D6(AC-008이 단계 단위 env 미검사). 구현 담당에는 D1 해석과 D2·D3·D6 보강 정규식을 프롬프트로 전달한다.
  - 이 감사 이후 plan_artifact_hash가 바뀌는 SPEC 문서 수정이 있으면 그 사실을 아래에 기록한다.

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-10-29T05:02:40Z
- plan_status: audit-ready
- 근거: plan-audit 2차 PASS-WITH-DEBT 0.90(`.moai/reports/plan-audit/SPEC-INFRA-002-iter2.md`), 사용자 승인(Decision Point 1, 2026-10-29), SPEC 0.3.1.
- 오케스트레이터 확인(직접 grep): REQ 16건·AC 16건, 범위 밖 번호 0건, 미해결 질문 마커 0건, spec.md 프런트매터 12필드 + `tier` 정상.
- 확인하지 못한 것: AC 명령들은 한 번도 실행되지 않았다(`node_modules` 없음 — run 단계 `npm ci` 이후). 리허설·실기기 AC-013~016은 병합 뒤 사용자 행동이 필요하다.

## §E.2 Run-phase Evidence

- 작성: manager-develop(cycle_type=tdd), 2026-10-29. 실행 위치: 격리 워크트리 `.claude/worktrees/release-automation/.claude/worktrees/agent-a469ba6de3a0b16a7`(브랜치 `worktree-agent-a469ba6de3a0b16a7`, 시작 HEAD 10d95f9 = `WT-release-automation`과 같은 커밋). 병합 기준 커밋 97b7db5.
- 원문 로그(커밋하지 않는 런타임 경로): `.moai/state/verify/SPEC-INFRA-002/` — `ac-pre.log`(구현 전), `ac-final.log`(구현 후), `m1-red.log`, `m1-green.log`, `m1-refactor.log`, `baseline-*.log`, `after-*.log`. AC 명령은 acceptance.md 원문을 `ac.sh`에 그대로 옮겨 한 번에 실행했다.

### 구현 전 기준(pre-flight)

- `npm test` → 종료 0, `Test Files 108 passed (108)`, `Tests 1765 passed (1765)`. `npx tsc --noEmit` → 종료 0. `npm run lint` → 종료 0.
- AC 구현 전 결과는 acceptance.md 10~16행 예측과 같았다: AC-001~009·011 FAIL(`No test files found`, `ENOENT`, `MISSING …`, AC-007 `TypeError: Cannot read properties of undefined (reading 'signingIdentity')`, AC-011b는 낡은 `gh release create`·`v0.9.0`·`우클릭`·`xattr` 줄 출력), AC-010 PASS(출력 없음).

### TDD 증거 (M1)

- RED: `npx vitest run scripts/check-release-version.test.mjs` → 종료 1, `Error: Failed to resolve import "./check-release-version.mjs" from "scripts/check-release-version.test.mjs". Does the file exist?`, `Test Files 1 failed (1)`.
- GREEN 1회차: 22 passed / 1 failed — 실패는 테스트 도우미 결함(`??`가 `null`을 기본값으로 바꿈)이라 도우미를 고쳤다(구현 무변경).
- GREEN·REFACTOR 후: `Tests 23 passed (23)`, 종료 0. 커버리지(v8, 이 파일만): 구문 94.82% · 분기 91.3% · 함수 90%. 덮지 못한 부분은 실제 `git tag` 호출 함수와 직접 실행 분기(CLI 스모크로 확인: `node scripts/check-release-version.mjs v0.19.0` → 종료 0·직전 태그 v0.18.0, `v0.0.1` → 종료 1·파일 3개 메시지, `v0x19x0`·`v0.19.0-rc.1` → 종료 1).

### 자동 AC 결과 (구현 후, `ac-final.log`)

| AC | 명령(요지 — 원문은 acceptance.md) | 관측 출력 | 판정 |
|----|-----------------------------------|-----------|------|
| 001 | `npx vitest run scripts/check-release-version.test.mjs` / `grep -oE … \| sort -u \| wc -l` | `Tests 23 passed (23)` 종료 0 / `3` | PASS |
| 002 | 같은 테스트 파일 | 종료 0 | PASS |
| 003 | `actionlint .github/workflows/release.yml` + node 단언 2개 | 출력 없음 종료 0 / 종료 0·0 | PASS |
| 004 | node 단언 2개 + 금지 문구 grep | 종료 0·0 / grep 출력 없음(종료 1) | PASS |
| 005 | node 단언 4개 + 안내 블록 for 반복 | 종료 0×4 / 출력 없음 | PASS |
| 006 | node 단언 3개 | 종료 0×3 | PASS |
| 007 | `git show <merge-base>:src-tauri/tauri.conf.json \| node -e …` | 종료 0 | PASS |
| 008 | node 단언 4개 + `grep -oE "secrets\.[A-Za-z_]+" … \| sort -u` | 종료 0×4 / `secrets.GITHUB_TOKEN` 한 줄 | PASS |
| 009 | node 단언 2개 + `test … -eq …` | 종료 0·0 / 종료 0 | PASS |
| 010 | `git diff --stat "$(git merge-base origin/main HEAD)" -- .github/workflows/frontend-gates.yml` | 출력 없음 | PASS |
| 011 | README·BUILD.md for 반복 / CHANGELOG `grep -c` 2개 | 출력 없음·출력 없음 / `1`·`0` | PASS |
| 012 | `npm test` / `npm run lint` / `npm run typecheck` | 종료 0, `Test Files 109 passed (109)`, `Tests 1788 passed (1788)`(= 기준 1765 + 새 23) / 종료 0 / 종료 0 | PASS |

### 오케스트레이터 독립 확인 (2026-10-29, 위 구현 담당 보고와 별개로 직접 실행)

- 병합: 구현 브랜치 `worktree-agent-a469ba6de3a0b16a7`(커밋 0d82ae4·47833ee·0cf857e)를 `WT-release-automation`(시작 10d95f9)으로 fast-forward 병합했다. 변경 파일은 `git diff --stat`로 정확히 10개(계획된 신규 4 + 수정 4 + progress.md + spec.md 프런트매터)임을 확인했다. 병합·로그 이전 뒤 격리 워크트리와 임시 브랜치는 제거했다(위 "실행 위치" 경로는 지금은 없음; 원문 로그는 이 SPEC의 `.moai/state/verify/SPEC-INFRA-002/`로 옮겨 경로가 유효하다).
- 직접 실행(이 워크트리, `npm ci` 후): `npx vitest` 전체 109 파일 · 1788 테스트 통과, `npx tsc --noEmit` 종료 0, `npm run lint` 종료 0, `actionlint .github/workflows/release.yml`·`frontend-gates.yml` 종료 0·출력 없음.
- AC-001~011: 구현 담당의 `ac.sh`(acceptance.md 명령 전사본)를 이 워크트리 루트에서 다시 실행(`orch-ac-run.log`)해 AC-001b `3`, AC-008d `secrets.GITHUB_TOKEN`, AC-011c `1`, AC-011d `0`, 나머지 node 단언 종료 0·금지 문구 grep 출력 없음을 확인했다. (`ac.sh`는 전사본이므로 acceptance.md 원문과의 글자 단위 일치는 따로 대조하지 않았다 — Gap.)
- 주의(검증 함정): 격리 워크트리가 이 워크트리의 `.claude/worktrees/` 아래에 있는 동안 `npm test`(`vitest run`)는 그 안의 `src` 복사본까지 모아 218 파일·65 파일 실패로 나왔다. 실패는 전부 `.claude/worktrees/…` 복사본이었고(65/65), 제거 뒤 같은 `npm test`가 109 파일·1788 테스트 종료 0으로 돌아왔다. 변경 코드의 결함이 아니다. 별도로, `vite.config.ts`가 `.claude/**`를 테스트 대상에서 빼지 않는 기존 약점이다(범위 밖, 후속 제안).
- 불변 조건: `git diff --stat 97b7db5 -- .github/workflows/frontend-gates.yml` 출력 없음, `git tag -l 'v0.19*'` 출력 없음, 푸시 없음.

### 수동 AC (미실행)

- AC-013~016은 병합 뒤 사용자 행동(태그 푸시·실기기 실행)이 필요해 run 단계에서 실행하지 않았다. 실제 워크플로 실행, macOS ad-hoc 서명 결과, Windows SmartScreen 문구는 관측하지 않았다.

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-10-29T05:25:53Z
run_commit_sha: 0cf857e   # M3 (sync 단계 backfill); M1 0d82ae4, M2 47833ee; 이후 보완 c6d2835·f5f4707·e137b3c
run_status: audit-ready
ac_pass_count: 12        # 자동 AC 001~012
ac_fail_count: 0
manual_ac_pending: 4     # AC-013~016 (병합 뒤 사용자 행동)
preserve_list_post_run_count: 0   # frontend-gates.yml·package.json·vite.config.ts·src/** 무변경
l44_pre_commit_fetch: not-run     # 푸시 금지 지시로 원격 동기화 확인 생략
l44_post_push_fetch: not-applicable
new_warnings_or_lints_introduced: 0   # eslint·tsc 종료 0, actionlint 출력 없음
cross_platform_build:
  local_macos_tauri_build: not-run    # 지시에 따라 npm run build/tauri build 미실행
  windows_runner: not-observed
total_run_phase_files: 9   # 신규 4 + 수정 4(tauri.conf.json·README·BUILD.md·CHANGELOG) + progress.md (spec.md 프런트매터 1줄 별도)
m1_to_mN_commit_strategy: per-milestone local commits (M1·M2·M3), no push
```

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_complete_at: 2026-10-29T05:53:01Z
sync_commit_sha: pending-backfill-sync   # sync 커밋 자신의 SHA는 같은 커밋에 넣을 수 없음
sync_status: audit-ready
status_transition: in-progress -> implemented -> completed   # spec.md 프런트매터, 이 sync 커밋에서 한 번에
sync_audit: PASS-WITH-DEBT 0.85   # .moai/reports/sync-audit/SPEC-INFRA-002-sync-audit.md, Critical/High 없음
security_review: no Critical/High; M-1 accepted   # 오케스트레이터 전달 결과(이 에이전트가 직접 재실행하지 않음)
b12_self_test_a: pass   # 커밋 전 [0.19.0] 절 SPEC-INFRA-002 = 1, [Unreleased] = 0 (중복 없음, 기존 항목 수정만)
b12_self_test_b: pass   # grep 고유 토큰 20개 = 정식 AC-INFRA002-001~016 16개 + 본문 속 짧은 역참조 4개(AC-001·007·010·014). CHANGELOG 항목은 AC 수를 적지 않고 테스트 수만 적음(24, 실측)
b12_self_test_c: pass   # CHANGELOG가 언급한 파일 경로 전부 ls로 존재 확인
changelog_entry_position: "[0.19.0] - 2026-10-29"
orchestrator_observed:   # 오케스트레이터 독립 확인 수치(전달값)
  npm_test: "109 files / 1789 tests"
  tsc_lint_actionlint: "exit 0"
  script_coverage: "94.82% statements (BOM 테스트 추가 전 측정)"
sync_local_rerun:   # 이 sync에서 직접 재실행(로그: .moai/state/verify/SPEC-INFRA-002/sync-*.log)
  npm_test: "Test Files 109 passed (109), Tests 1789 passed (1789), exit 0"
  tsc: "exit 0"
  lint: "exit 0"
  actionlint_release_yml: "exit 0, 출력 없음"
  ac_sh: "AC-001~011 전부 PASS 출력(001a 24 passed, 001b 3, 008d secrets.GITHUB_TOKEN, 011c 1, 011d 0)"
  ac004_sh: "AC-004a exit 0, AC-004b grep exit 1(출력 없음)"
optional_fix_disposition:
  applied: [F1, F7, F9, F10, F4, F6]   # F4는 spec.md 위험 기록, F6은 docs/BUILD.md 절차·규칙(이 sync 커밋)
  F2: "AC-004b 정규식 확장(SPEC 0.3.3)으로 반영"
  F5: "실제 초안 v0.13.2에 읽기 전용 gh api로 권한 있는 호출자 기준 무해 확인"
  F8: "프로젝트 lint가 .mjs를 보지 않음 — 변경 없음, 후속 과제"
  F11_F12: "첫 실제 실행(AC-014~016) 결과에 따라 문구 조정"
unobserved:
  - 실제 워크플로 실행(전 job, 자산 이름·개수, 노트 범위)
  - macOS ad-hoc 서명 결과(Signature=adhoc)
  - Windows SmartScreen 실제 버튼 문구
  - 수동 AC-013~016
```

## §F Phase 4 Mode Selection

- 일시: 2026-10-29. 사용자 구현 착수 승인(Implementation Kickoff Approval) 뒤 기록. 승인 선택: 진행 방식 = 자동 진행(`/moai goal`은 걸지 않음 — 한 번의 연속 흐름으로 이끌고, 서술형 조건 오저장 위험이 이 저장소 기억에 기록돼 있음), Git 처리 = 로컬 커밋만(푸시·PR은 나중에 묻기), actionlint = Homebrew 설치 허가(1.7.12 설치 확인).
- Input parameters: tier = M / scope = 파일 8개(신규 4: release.yml, release-notes-header.md, check-release-version.mjs, 그 테스트 / 수정 4: tauri.conf.json, README.md, docs/BUILD.md, CHANGELOG.md) / domain count = 2(CI·릴리스 스크립트, 문서) / file language mix = YAML·Node(.mjs)·JSON·Markdown 혼합 / concurrency benefit = LOW(코딩 위주, 파일 간 의존: 워크플로가 스크립트를 호출하고 문서가 워크플로 동작을 서술).

| Mode | 선택 여부 | 근거 |
|------|-----------|------|
| direct | not selected | 의미 있는 새 코드와 외부로 나가는 CI 설정이라 사소한 수정이 아님 |
| serial | **selected** | 파일 8개·도메인 2개로 fanout 기준(도메인 3개 이상 또는 파일 10개 이상) 미달, 코딩 위주 |
| fanout | not selected | 연구 위주 다중 도메인이 아님 |
| sweep | not selected | 파일 30개 이상의 균일한 기계적 변환이 아님 |

- Decision: serial
- Justification: 파일이 8개뿐이고 워크플로·설정·문서가 서로의 사실에 의존해서(예: 문서가 워크플로의 job 구조와 문구를 서술) 병렬로 나눌 독립 작업이 없다. Anthropic의 코딩 작업 병렬화 주의에 따라 단일 manager-develop 순차 스폰(M1 TDD → M2 → M3)이 가장 단순하다. 임계값 경계 사례 없음(파일 8 < 10, 도메인 2 < 3).
