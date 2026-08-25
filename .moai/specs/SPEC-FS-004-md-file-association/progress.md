# Progress: SPEC-FS-004

- id: SPEC-FS-004
- title: ".md 파일 연동 — 더블클릭으로 mdedit 직접 열기"
- tier: M
- current_phase: run (M1 완료 — M2 프론트 배선·M3 설정/문서 대기)

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

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_status: m1-complete          # M2(프론트 배선)·M3(설정/번들/문서) 대기 — run 전체 미완
run_complete_at: pending-M3
run_commit_sha: pending-M-final
m1_scope: "Rust 배관 — Cargo.toml/lock, models/pending_open(+mod), commands/file_open(+mod), state/app_state, lib.rs 3개소"
ac_pass_count: 3                 # AC-003 / AC-010 / AC-012(cargo측)
ac_pass_with_debt_count: 1       # AC-013(cargo측) — #[cfg(windows)] 실행 Windows 이관
ac_fail_count: 0
ac_deferred_count: 10            # AC-001/002/004/005/006(수동 M3) + AC-007/008/009/011/014(vitest M2)
preserve_list_post_run_count: 3  # useFileSystem.ts / useUnsavedChangesGuard.ts / capabilities/main.json — diff 0 확인
new_warnings_or_lints_introduced: 0
cross_platform_build:
  macos_cargo_test: "pass 358/358"
  macos_cargo_build: "pass, 0 warnings"
  windows_cargo_test: "compile-verified only — #[cfg(windows)] 실행 Windows CI/수동 이관"
total_run_phase_files: 8         # M1 기준: 신규 2 + 수정 6 (Cargo.toml/Cargo.lock/commands/mod/models/mod/app_state/lib.rs)
m1_to_mN_commit_strategy: milestone-per-commit, main 직젙(Late-branch), push 없음
```
