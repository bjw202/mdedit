# Progress: SPEC-FS-004

- id: SPEC-FS-004
- title: ".md 파일 연동 — 더블클릭으로 mdedit 직접 열기"
- tier: M
- current_phase: run (M2 완료 — M3 설정·번들·문서 대기)

## §F.1 Plan-phase Completion

- plan_complete_at: 2026-08-25T02:17:14Z
- plan_status: audit-ready

판정 근거: plan-auditor iteration-1 **PASS** — 종합 1.0 (Tier M 임계 0.80), must-pass 7/7.
보고서: `.moai/reports/plan-audit/SPEC-FS-004-review-1.md`

## 개정 이력

- v1.0.0 (2026-08-25): Phase 10 최초 작성 (spec/plan/acceptance/spec-compact + research.md)
- v1.1.0 (2026-08-25): post-PASS 개정 — 감사 D1/D2/D4 + 렌즈 F1~F7 + 교차모델(codex) 4건 반영.
  핵심: REQ-008 가드 전체 래핑(같은 폴더 경로 포함, 데이터 유실 방지) · REQ-011 atomic-take 계약(이벤트=알림 전용) ·
  연속 오픈 single-flight latest-wins · 대소문자 접기 Windows 전용 · REQ-004 Linux unverified-by-design ·
  REQ-010 전 진입 경로 first-.md-only 일반화 · AC-001 `npm run build` 수정.

## 런타임 참고 (run-phase 진입 시)

- 실행 모드: Phase 4에서 재판정 (Tier M, coding-heavy → `serial` 예상)
- Git: Late-branch 경로 (git-strategy `auto_enabled: false`) — SPEC은 main에 커밋, PR 시점에 브랜치 분기
- 수동 인수 5종(AC-001/002/004/005/006)은 설치 빌드 필요 — `tauri dev`로 재현 불가

## §E.2 Run-phase Evidence

### M1 — Rust 배관 (계약의 생산자) — 2026-08-25, base 5311b05, worktree 격리 환경

**TDD RED (구현 전 사전 실패 — verbatim)**

- 명령: `cd src-tauri && cargo test` → **exit 101**
- 관측 요약: `test result: FAILED. 337 passed; 21 failed; 0 ignored; 0 measured; 0 filtered out`
- 신규 21건 전부 `todo!()` 스텁에서 panic — 발생 지점: `file_open.rs:9`(is_markdown_path 2건) /
  `file_open.rs:16`(find_md_in_args 5건) / `file_open.rs:22`(first_md_url 4건) /
  `file_open.rs:31`(resolve_md_path 5건) / `pending_open.rs:18`(payload 3건 + app_state 2건).
  app_state 기본-None 구조 테스트 1건은 필드 초기화만 검증하므로 RED 시점 통과(구현 의존 없음).

**Baseline (변경 전 오너 실측 — 본 트리)**

- `cd src-tauri && cargo test` → exit 0, `test result: ok. 336 passed; 0 failed` @ 5311b05

**GREEN (구현 후) / Wiring 빌드**

- GREEN: `cd src-tauri && cargo test` → exit 0, `test result: ok. 358 passed; 0 failed` (기존 336 + 신규 22)
- Wiring 후(single-instance v2.4.3 + lib.rs 3개소 + 커맨드 등록): `cargo test` → exit 0, 358 passed
- `cargo build` → **exit 0, warning 0건**

**AC 매트릭스 (M1 자동 계층 — 전부 cargo test 인라인)**

| AC | 상태 | 근거(테스트) |
|----|------|------|
| AC-003 비-.md 제외 매트릭스 | PASS | `is_markdown_path` 대소문자 5건 true·6건 false + `find_md_in_args` 플래그 스킵/first-only/argv0 5건 |
| AC-010 다중 url 첫 .md만 | PASS | `first_md_url` 다중·비-file 스킴·비-.md·전부-무시 4건 |
| AC-012 부재/디렉터리/상대경로 | PASS | `resolve_md_path` temp-dir 5건 (존재→Some{path,dir=parent} / 부재→None / `.md` 디렉터리→None / 상대+cwd→절대 결합 / 비-.md→None) |
| AC-013 \\?\ 부재 (cargo측) | PASS-WITH-DEBT | `#[cfg(windows)]` 테스트 존재·컴파일 확인(본 macOS 호스트 미실행 — Windows 검증 이관). macOS 대체 실증: temp-dir 테스트가 dir 비정규화(`/var` 심링크 미해소)를 어서션 — canonicalize 도입 시 즉시 실패 |

**PRESERVE 무변경 확인 (E5)**

- `git status --short src/hooks/useFileSystem.ts src/hooks/useUnsavedChangesGuard.ts src-tauri/capabilities/main.json` → 빈 출력 (diff 없음)

**서브에이전트 경계 (E4)**

- `grep -rn AskUserQuestion src-tauri/src/commands/file_open.rs src-tauri/src/models/pending_open.rs src-tauri/src/state/app_state.rs src-tauri/src/lib.rs` → 0 매치 (exit 1)

**구현 노트**

- `AppState`에 `set_pending_open_file`/`take_pending_open_file` 메서드 추가(커맨드 얇게 + set/take 계약 단위 테스트 가능 형태). `#[tauri::command] take_pending_open_file`은 메서드 위임.
- `generate_handler` 기존 목록(실측 24개) 끝에 `file_open::take_pending_open_file` 추가(25번째 — 코드 기준 재확인).
- `.run(ctx)` → `.build(ctx).expect(...).run(클로저)` 전환으로 `RunEvent::Opened` 수신.
- single-instance 콜백은 .md 유무와 무관 항상 `set_focus`(REQ-FS-006).

### M2 — 프론트 배선 (계약의 소비자) — 2026-08-25, base 475f819, worktree 격리 환경

**TDD RED (구현 전 사전 실패 — verbatim)**

- 명령: `npx vitest run src/test/SPEC-FS-004-external-open.test.ts src/test/SPEC-FS-004-external-open-flow.test.tsx` → **exit 1**
- 관측: `Test Files  2 failed (2)` / `Tests  8 failed (8)` — 훅 파일은 `Error: Failed to resolve import "@/hooks/useExternalOpenFile"`(구현 부재),
  플로우 파일은 배선 전 App 에서 8건 전부 행동 단언 실패(예: `AssertionError: expected "spy" to be called with arguments: [ '/ws/B' ]` — 마운트 드레인 없음).

**Baseline (변경 전 오너 실측 — 본 트리 475f819)**

- `npm run test` → **Tests  2 failed | 1547 passed (1549)** — 실패 2건은 M1 적법 추가 대비 스테일 핀:
  `exportOpenRegressionGuard`(generate_handler 24→25) / `aiDiagramTypeRegressionGuard`(cargo deps +tauri-plugin-single-instance).
  M1 은 TS 미수정이나 두 가드가 lib.rs/Cargo.toml 을 디스크에서 읽어 영향 — 위임 문서의 "1549/1549 green" 기술과 불일치(실측 우선).
  M2 가 SPEC-FS-004 기입 핀 갱신으로 해소(SPEC-IMG-LOAD-001 핀 유지보수 계약 선례 준수, 날짜+SPEC 주석 기입).

**GREEN (구현 후)**

- 신규 2파일: exit 0, `Tests  29 passed (29)`. 초회 GREEN 실행 5건 실패 — 1건은 체인 실결함(실행 실패 시 대기
  드레인 누락 → pump-큐 재설계로 해소), 4건은 테스트 하네스(호출이력 미초기화 누수 + 가드 fake 가 REQ-009 폐기
  미모델링 + 매크로태스크 플러시 부재) 수정 후 전부 green.
- 전체: `npm run test` → exit 0, `Tests  1578 passed (1578)` (104 files; 기존 1549 + 신규 29 — `app.test.tsx` 복원 경로 유지 포함, AC-014)
- `npm run typecheck` → exit 0 (0 errors) / `npm run lint` → exit 0 (0 warnings, `--max-warnings 0`)
- Rust 동결 증명: `cd src-tauri && cargo test` → exit 0, `test result: ok. 358 passed; 0 failed`(lib 바이너리 — M1 baseline 과 동일, `src-tauri/**` 무변경)

**AC 매트릭스 (M2 자동 계층 — 전부 vitest)**

| AC | 상태 | 근거(테스트) |
|----|------|------|
| AC-007 같은 폴더 스킵 | PASS | 같은 폴더(트레일링 슬래시 차이) readDirectory·startWatch 0회 + readFile 만 수행 / 같은 폴더+dirty=true → 가드 fake 캡처, 확정 시에만 readFile (external-open-flow) + isSameWorkspaceDir 매트릭스 (external-open) |
| AC-008 가드 래핑 | PASS | dirty=false 즉시 실행 / dirty=true 모달(캡처) 확정 후 실행 / 취소 → 파일 IPC 0건 / 연속 버스트 single-flight latest-wins(B 실행 중 C·D take → B→D 만 실행·C 폐기, readDirectory(B)<readFile(B)<readDirectory(D)<readFile(D) 순서 단언, 종착 상태 D 쌍) |
| AC-009 모달 중 폐기 | PASS | 모달 열림 중 2차 외부 오픈 도착 → 큐잉 없이 폐기(가드 fake 재진입 폐기 반영), 확정 시 첫 파일만 open(2차 파일 IPC 영구 0회) |
| AC-011 런치 레이스 | PASS | take Some → lastWatchedPath 복원 openFolderPath 미호출(우선) / take null → 기존 복원 경로 실행 / 이벤트 페이로드 직접 소비 금지(위조 payload≠take 값 단언) / 마운트 take 인플라이트 중 이벤트 인터리브 → 전환 정확히 1회 / ipc 거부 → false 폴백(복원으로) |
| AC-012 폴더 실패 중단 (vitest측) | PASS | readDirectory 거부 → readFileSize·readFile 미호출, watchedPath null 유지(전체 중단) |
| AC-013 정규화 동일성 (vitest측) | PASS | isSameWorkspaceDir: Windows 접기("C:\Docs"≡"c:/docs/")·접두사 겸침 false("C:\Docs2")·POSIX 대소문자 정확 비교·watchedPath null false — 경로 형태 기반 접기(비-Windows 호스트에서 Windows 조합 검증) |
| AC-014 비-Tauri no-op | PASS | __TAURI_INTERNALS__ 부재 → listen·take 0회 호출, consumePendingOpenFile false 반환 + 전체 suite green(app.test.tsx 포함) |

**PRESERVE 무변경 확인 (E5)**

- `git status --short src-tauri src/hooks/useFileSystem.ts src/hooks/useUnsavedChangesGuard.ts src-tauri/capabilities/main.json` → 빈 출력 (diff 없음)

**서브에이전트 경계 (E4)**

- `grep -rn AskUserQuestion src/hooks/useExternalOpenFile.ts src/lib/tauri/ipc.ts src/test/SPEC-FS-004-external-open.test.ts src/test/SPEC-FS-004-external-open-flow.test.tsx src/App.tsx` → 0 매치 (exit 1)

**구현 노트**

- 훅 순서 계약(B5): `useExternalOpenFile` 을 guard 뒤·복원 이펙트 앞 배치 — 리스너 이펙트가 마운트 consume(복원)보다 먼저 등록된다.
- 복원 이펙트는 단일 if-else: `await consumePendingOpenFile()` true → 복원 스킵 / false → 기존 lastWatchedPath 복원(cleanup cancelled 플래그로 언마운트 후 복원 차단).
- single-flight 체인(`createLatestWinsChain`)은 pump-큐 설계: 대기 2+ 시 마지막(최신)만 실행·나머지 즉시 확정(폐기), 실행 실패(각 호출자 reject 전달) 후에도 대기 드레인 지속.
- 가드는 체인 밖에서 전체 래핑(`guard.requestGuardedAction(() => chain(payload))`) — 모달 중 재진입은 체인 진입 전 가드가 폐기(REQ-009)하므로 체인 대기열에 쌓이지 않는다.
- 폴더 실패는 전환 내부에서 흡수(REQ-012 중단) — openFile 미시도, unhandled rejection 없음.
- 회귀 가드 2건 핀 갱신: exportOpenRegressionGuard(+`file_open::take_pending_open_file`)·aiDiagramTypeRegressionGuard(+`tauri-plugin-single-instance`) — SPEC-FS-004 (2026-08-25) 주석 기입.

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_status: m2-complete          # M3(tauri.conf.json fileAssociations + 번들 검증 + 문서 + 수동 인수 5종) 대기 — run 전체 미완
run_complete_at: pending-M3
run_commit_sha: pending-M-final
m1_scope: "Rust 배관 — Cargo.toml/lock, models/pending_open(+mod), commands/file_open(+mod), state/app_state, lib.rs 3개소"
m2_scope: "프론트 배선 — lib/tauri/ipc.ts(PendingOpenFile+takePendingOpenFile), hooks/useExternalOpenFile(신규: atomic-take 리스너·consume·isSameWorkspaceDir·latest-wins 체인), App.tsx(handleExternalOpen 가드 전체 래핑+단일 if-else 복원), 테스트 2종 신규 + 회귀 가드 핀 갱신 2종(M1 계단식)"
ac_pass_count: 8                 # AC-003/010/012/014 + M2 완료 AC-007/008/009/011 (AC-012 vitest측 PASS — 양측 완료)
ac_pass_with_debt_count: 1       # AC-013 — cargo #[cfg(windows)] 실행 Windows 이관(vitest 정규화 매트릭스는 PASS)
ac_fail_count: 0
ac_deferred_count: 5             # AC-001/002/004/005/006(수동 M3 — 설치 빌드)
preserve_list_post_run_count: 3  # useFileSystem.ts / useUnsavedChangesGuard.ts / capabilities/main.json — diff 0 확인(M2 재확인)
new_warnings_or_lints_introduced: 0
cross_platform_build:
  macos_cargo_test: "pass 358/358 (M2 종료 시점 재확인 — Rust 동결)"
  macos_cargo_build: "pass, 0 warnings"
  windows_cargo_test: "compile-verified only — #[cfg(windows)] 실행 Windows CI/수동 이관"
total_run_phase_files: 15         # M1 기준: 신규 2 + 수정 6 (Cargo.toml/Cargo.lock/commands/mod/models/mod/app_state/lib.rs)
m1_to_mN_commit_strategy: milestone-per-commit, Late-branch(SPEC worktree branch), push none
```
