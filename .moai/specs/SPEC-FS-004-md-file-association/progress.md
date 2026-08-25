# Progress: SPEC-FS-004

- id: SPEC-FS-004
- title: ".md 파일 연동 — 더블클릭으로 mdedit 직접 열기"
- tier: M
- current_phase: run (M3 완료 — 자동 계층 종료, 수동 인수 5종 대기)

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

## §F Phase 4 Mode Selection

- 판정 시각: 2026-08-25 (Implementation Kickoff Approval 승인 직후 — 사용자 확정: 구현 시작·자율 진행·Late-branch)
- 입력 파라미터: tier=M │ scope≈14파일 (Rust 7 + TS/테스트 5 + 설정/문서 2) │ 도메인 수=2-3 (Rust 백엔드 배관 / TS 프론트 배선 / 설정·문서) │ 언어 혼합=Rust+TypeScript+JSON+Markdown │ 동시성 편익=LOW (코딩 집약 — M1→M2→M3 계약 의존 직렬 체인)
- 모드 평가: direct 미선정 (다중 파일 구현 — 오케스트레이터 직접 구현 금지) / **serial 선정** / fanout 미선정 (coding-heavy — Anthropic 코딩 과제 병렬화 주의) / sweep 미선정 (14파일 < ~30 · 다중 규칙 의미론 작업 — 기계적 단일 변환 아님) / agent-team 미선정 (명시 요청 전용 — 요청 없음)
- Decision: serial
- 근거: Tier M 코딩 집약 구현으로 M2는 M1의 커맨드/이벤트 계약을 소비하고 M3는 M1+M2 완료 후 번들이 필요한 직렬 의존 체인이다. Anthropic 코딩 과제 병렬화 주의("most coding tasks involve fewer truly parallelizable tasks than research")에 따라 마일스톤당 1회 manager-develop(cycle_type=tdd) 순차 위임이 최적이다.
- 진행 모드: 자율 (ac_converge 골 무장 — 자동 검증 AC + 품질 게이트 한정; 수동 인수 5종은 별도 사용자 작업으로 분리)
- Git 전략: Late-branch (run 커밋 SPEC 브랜치 적재 → 완료 시점 브랜치 분기·PR — 사용자 확정; 런타임이 M1·M2를 자동 워크트리로 격리하여 워크트리 브랜치 체인이 SPEC 통합 브랜치로 승계됨)

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

### M3 — 설정·번들·문서 — 2026-08-25, base 77b774c, worktree 격리 환경

**TDD RED**: N/A — M3은 신규 자동화 동작 테스트가 없는 설정·문서 마일스톤이다 (TDD 계약 "신규 테스트 가능 코드 없음 = 테스트 없음" 충족 — RED 증거가 없음을 명시적으로 기록하며 날조하지 않는다).

**번들 설정 (bundle.fileAssociations — AC-001 코드 리뷰 절반)**

- `src-tauri/tauri.conf.json` `bundle` 섹션에 `fileAssociations` 추가:
  `{"ext": ["md"], "name": "Markdown Document", "role": "Editor", "mimeType": "text/markdown"}` —
  ext는 `["md"]` 단독(다른 확장자 금지 — 사용자 고정 전제)이며 이외 키(targets "all"·identifier `com.mdedit.app` 등)는 무변경.
- JSON 파싱 검증: `node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8'))"` → `json ok` (exit 0)
- 설정 로드·검증: `npx tauri info` → exit 0 (App 섹션이 현 conf 파일을 읽음 — build-type bundle / frontendDist ../dist / devUrl :1420)
- 런타임 등록 API 부재(REQ-001 정적 등록 원칙): `grep -rn "set_default\|register.*association\|ShellExecute" src-tauri/src` → 0 매치 (exit 1)

**문서**

- README 주요 기능: `.md` 파일 연동 항목 1행 추가 (더블클릭 → 해당 폴더 워크스페이스 + 파일 열림 / 실행 중이면 기존 창 전환·미저장 시 모달)
- USER_GUIDE §1.6 신설 (기본 프로그램 설정 — Windows "연결 프로그램 → 다른 앱 선택" 1회 / macOS "이 정보로 열기 → 항상 이 앱으로 열기") + §6 FAQ 4항 추가: ①기본 프로그램으로 안 열림(UserChoice 해시 보호 — 1회 수동 선택) ②더블클릭 무반응(모달 중 도착 폐기 — 의도된 동작) ③설치본 실행 중 `npm run dev` 즉시 종료(식별자 `com.mdedit.app` 공유) ④NSIS/MSI 연속 설치 미지원·제거 시 등록 해제
- CHANGELOG `[Unreleased]` Added에 SPEC-FS-004 항목 추가 — 사전 가드 `grep -c 'SPEC-FS-004' CHANGELOG.md` → `0` 확인 후 기입

**최종 게이트 (M3 종료 — 4종 전부, M3 트리 기준)**

- `cd src-tauri && cargo test` → exit 0, `test result: ok. 358 passed; 0 failed; 0 ignored` (서브에이전트 PATH에 cargo 부재로 절대경로 `~/.cargo/bin/cargo` 실행 — M2 종료 시점과 동일 358, Rust 동결 유지)
- `npm run test` → exit 0, `Test Files 104 passed (104)` / `Tests 1578 passed (1578)`
- `npm run typecheck` → exit 0 (`tsc --noEmit`, 0 errors)
- `npm run lint` → exit 0 (`eslint . --ext ts,tsx --max-warnings 0`, 0 warnings)
- `npm run build`(전체 tauri 번들 빌드)은 위임 계약상 실행하지 않음 — 수동 인수 시점에 사용자 실행으로 이관

**FREEZE/PRESERVE 확인 (E5)**

- `git status --short src-tauri/src src/hooks src/App.tsx src/lib/tauri/ipc.ts` → 빈 출력 (M3의 코드 영역 무변경 — 수정은 tauri.conf.json 번들 키와 문서 3종·progress.md뿐, `.rs` 파일 0건)

**서브에이전트 경계 (E4)**

- `grep -rn "AskUserQuestion" src-tauri/tauri.conf.json README.md docs/USER_GUIDE.md CHANGELOG.md` → 0 매치 (exit 1)

**AC 매트릭스 (M3 계층)**

| AC | 상태 | 근거 |
|----|------|------|
| AC-001 (코드 리뷰 절반) | PASS | fileAssociations ext `["md"]` 단독(conf JSON 블록) + 런타임 등록 API 부재 grep 0 매치 |
| AC-001 (수동 절반) + AC-002/004/005/006 | DEFERRED-to-user | 설치 빌드 수동 인수 — §E.3 `manual_acceptance_handoff`의 시나리오 5종 참조 |

### sync-audit 보충 — Playwright e2e 스모크 (F2 기록 갭 메움, 2026-08-25)

- `npm run test:e2e` → exit 0, `62 passed + 1 skipped (22.5s)` — **sync-auditor 실측**(본 체인에서 sync-audit 단계 실행; sync-audit 보고서 전용 귀속 — run 에이전트 재실행 아님)

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_status: m3-complete (자동 계층 완료 — 수동 인수 대기)
run_complete_at: 2026-08-25T04:32:25Z   # 자동 계층(M1+M2+M3) 종료 — 수동 인수 5종은 별도 사용자 작업
run_commit_sha: 555a16c               # M3 마일스톤 커밋(자동 계층 완료 시점 HEAD) — SHA 자기참조 불가로 직후 백필 커밋로 기입
m1_scope: "Rust 배관 — Cargo.toml/lock, models/pending_open(+mod), commands/file_open(+mod), state/app_state, lib.rs 3개소"
m2_scope: "프론트 배선 — lib/tauri/ipc.ts(PendingOpenFile+takePendingOpenFile), hooks/useExternalOpenFile(신규: atomic-take 리스너·consume·isSameWorkspaceDir·latest-wins 체인), App.tsx(handleExternalOpen 가드 전체 래핑+단일 if-else 복원), 테스트 2종 신규 + 회귀 가드 핀 갱신 2종(M1 계단식)"
m3_scope: "설정·번들·문서 — tauri.conf.json bundle.fileAssociations(ext [md] 단독), README 기능 항목, USER_GUIDE §1.6+§6 FAQ 4항, CHANGELOG [Unreleased], progress.md §F+§E.2 M3+§E.3 — 코드(.rs/.ts) 0건 수정"
ac_pass_count: 9                 # AC-003/007/008/009/010/011/012/014 + AC-013-vitest(정규화 매트릭스)
ac_pass_with_debt_count: 1       # AC-013-cargo — #[cfg(windows)] 실행 Windows 이관
ac_fail_count: 0
ac_deferred_count: 5             # AC-001(수동 절반)/002/004/005/006 — 설치 빌드 수동 인수(아래 handoff)
manual_acceptance_handoff: "AC-001(수동): 양 OS 설치 후 .md '연결 프로그램'(Win)/'이 정보로 열기'(macOS) 후보에 mdedit 노출 / AC-002: 미실행 상태에서 폴더 B note.md 더블클릭 → 런치+워크스페이스 B+파일 열림+재실행 시 B 복원 / AC-004: Windows(NSIS) 실행 중 타 폴더 .md 더블클릭 → 2번째 창 없이 기존 창 전환(dirty 시 모달)·MSI 스팟체크·제거 시 등록 해제 / AC-005: macOS 실행 중 Finder .md 더블클릭 → 기존 인스턴스 재활성화+워크스페이스 전환 / AC-006: dock·작업표시줄 아이콘 재클릭 → 2번째 프로세스 없이 기존 창 포커스"
preserve_list_post_run_count: 3  # useFileSystem.ts / useUnsavedChangesGuard.ts / capabilities/main.json — diff 0 확인(M3 재확인)
new_warnings_or_lints_introduced: 0
cross_platform_build:
  macos_cargo_test: "pass 358/358 (M3 종료 시점 재확인 — Rust 동결 유지)"
  macos_cargo_build: "pass, 0 warnings (M1 시점)"
  windows_cargo_test: "syntax-checked only — cfg-stripped on macOS host; compile+run deferred to Windows"
  bundle_full_build: "deferred-to-user — npm run build는 수동 인수 시점 실행(위임 계약 — tauri info+JSON 파싱으로 설정 검증 대체)"
total_run_phase_files: 21         # M1+M2 17파일(5311b05..77b774c 실측) + M3 신규 4(tauri.conf.json/README/USER_GUIDE/CHANGELOG; progress.md는 기존 포함)
m1_to_mN_commit_strategy: milestone-per-commit, Late-branch(SPEC worktree branch), push none
```

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_status: complete
sync_complete_at: 2026-08-25T05:10:00Z
sync_commit_sha: 010e3ee             # 커밋은 자기 SHA를 알 수 없음 — 확립 패턴대로 직후 백필 커밋에서 기입(§E.3 run_commit_sha 555a16c→a51837a와 동일 계약)
doc_verification:
  changelog_entry: verified-as-is    # CHANGELOG.md [Unreleased] SPEC-FS-004 항목 — 기술 주장 전건 코드 대조 결과 사실 정확, 중복 append 금지(grep 카운트 1), 원문 유지
  ac_count_match: "14/14"            # acceptance.md distinct AC = 14 (AC-001..AC-014), CHANGELOG 기술(자동/수동 분리 포함)과 일치
  file_paths_verified: 7             # file_open.rs / pending_open.rs / lib.rs / useExternalOpenFile.ts / ipc.ts / 테스트 2종 — ls 전건 존재 확인
  readme_feature_item: verified-as-is # README 기능 항목 — 더블클릭·워크스페이스·single-instance·미저장 모달 주장이 구현(가드 래핑·single-instance 선행 등록)과 일치
  user_guide_section_1_6: verified-as-is # §1.6 — fileAssociations ext ["md"] 단독(conf L40-44 실측)·UserChoice 보호 설명 일치
  user_guide_faq_4: verified-as-is   # FAQ 4항 — UserChoice 1회 선택 / 모달 중 폐기 의도됨(설계 계약) / dev-식별자 충돌(conf identifier com.mdedit.app 공유 실측) / NSIS·MSI 연속 설치 미지원 — 전항 코드·계약과 일치
mx_validation:
  stage_pending_open_anchor: present   # file_open.rs L65-68 @MX:ANCHOR + REASON + SPEC
  resolve_md_path_warn: present        # file_open.rs L38-40 @MX:WARN + REASON + SPEC
  lib_rs_anchor_includes_spec: present # lib.rs L1-3 @MX:SPEC: SPEC-FS-001, SPEC-FS-004
  use_external_open_file_notes: present # 2× @MX:NOTE + SPEC (L1-3, L15-20)
  is_same_workspace_dir_note: present  # L15 NOTE — isSameWorkspaceDir 정규화 방향
  new_test_file_headers: present       # 테스트 2종 @MX:SPEC 헤더 + Rust 인라인 테스트 @MX:SPEC 6건
  missing_tags: 0
frontmatter_close:
  spec_md: "in-progress → completed (3-phase close — 본 sync 커밋에서 종단)"   # updated: 2026-08-25 (기존값 동일)
  other_artifacts: "plan.md/acceptance.md/progress.md는 YAML frontmatter 없음(헤딩 문서) — close 대상 없음, 본문 미수정"
code_changes_in_sync: 0                # .md 전용 — 게이트 재실행 불요(§E.2 + 오케스트레이터 독립 재실행에 의존)
```
