# SPEC-AI-013 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-11-13
- backlog_card: t5
- worktree: .claude/worktrees/t5 (branch WT-long-selection, base origin/main 5c617ae)
- tier: M (REQ 15, AC 14)
- plan-audit:
  - iter1 FAIL 0.77 — `.moai/reports/plan-audit/SPEC-AI-013-review-1.md`
  - iter2 FAIL 0.87 (막힘 2건) — `.moai/reports/plan-audit/SPEC-AI-013-review-2.md`
  - iter3 **PASS 0.95** — `.moai/reports/plan-audit/SPEC-AI-013-review-3.md` (사소한 지적 R1~R3 반영 완료)
- run 시작 조건: SPEC-AI-012(카드 t4) 병합 후 origin/main 기준 새 워크트리. 첫 마일스톤은 M1 실측 스파이크.

## §E.2 Run-phase Evidence

### M1 — 실측 스파이크 (2026-11-13, macOS, claude 2.1.322 / codex-cli 0.167.0, 모델 haiku)

모든 실행은 빈 작업 폴더 + 프롬프트 인자 없음 + 표준 입력. 원문 캡처는 세션 scratchpad(`.../scratchpad/m1/`)에 두고, 정지 사유에 필요한 줄만 fixture 로 옮겼다(`system` 줄에 로컬 경로·소켓 경로가 있어 `system`/`rate_limit_event`/`user` 줄만 제외, 나머지는 원문 그대로).

| # | 명령(요지) | 결과 |
|---|-----------|------|
| 1 | `printf '안녕하세요 오늘 날씨가 좋네요' \| claude -p --system-prompt-file <작업폴더 밖 파일> --output-format stream-json --include-partial-messages --verbose --setting-sources "" --tools "" --model haiku` | exit 0, 2.9초. 응답 첫 줄 `ZQX-표지` → **`--system-prompt-file` 동작 확인**(시스템 프롬프트 대체 효과 확인). D1 유지. |
| 2 | 같은 플래그, 한글 6,000자(UTF-16 6000) 표준 입력 + 다듬기 시스템 프롬프트 | exit 0, **23.6초**, 826줄. 정지 사유 `end_turn` 2회. |
| 3 | 같은 플래그, 한글 12,000자 표준 입력 | exit 0, **39.5초**. |
| 4 | `CLAUDE_CODE_MAX_OUTPUT_TOKENS=40` + 6,000자 입력(잘림 유도) | exit **1**, 5.95초. 변수 동작함. `max_tokens` `message_delta` **4회**(CLI 가 4턴 재시도), 마지막 `result` 줄: `subtype:"success"`, `is_error:true`, `terminal_reason:"api_error"`, **최상위 `stop_reason:"stop_sequence"`**, `result:"API Error: Claude's response exceeded the 40 output token maximum..."`. |
| 5 | `codex exec -C <worktree> --ignore-user-config --ephemeral --sandbox read-only --json < 6,000자 결합 프롬프트` (위치 인자 없음) | exit 0, **75.5초**. 이벤트 4개: `thread.started`, `turn.started`, `item.completed(agent_message)`, `turn.completed{usage}`. 정지 사유·finish 필드 **없음**(`grep -ci 'stop_reason\|finish_reason\|incomplete'` = 0). D7 `unknown` 확정. |
| 6 | 위와 같고 12,000자 | exit 0, **151.7초**. |

확정 사항:
- **정지 사유를 읽는 줄(D8)**: (a) `{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"end_turn"|"max_tokens"|"stop_sequence",...}}}` — 한 턴당 1회, 위 4번처럼 CLI 가 재시도하면 여러 번. (b) `result` 줄의 최상위 `stop_reason` — 단 4번처럼 오류 종결이면 `stop_sequence` 로 **잘림을 가린다**. 따라서 파서는 `message_delta` 줄을 보고 끈적이는 `cutoff` 를 적용하며(D7), `result` 줄 값은 쓰지 않는다. `assistant` 줄에는 non-null 정지 사유가 없었다(부분 메시지).
- **잘림 fixture 는 실측 캡처**: `src-tauri/tests/fixtures/claude-stop-reason-cutoff.jsonl`(4번), 정상은 `claude-stop-reason-complete.jsonl`(1번). 둘 다 만들어 낸 줄 없음.
- **지연(D5/D6)**: 도달 가능한 최악 조합(편집 계열 6,000자 polish)은 claude 23.6초 / codex 75.5초로 공식 92초 안. 12,000자 polish 는 codex 151.7초로 140초를 넘지만, UI 에서 12,000자는 변환 계열(출력이 입력보다 짧은 개요·표·다이어그램·짧게)만 도달 가능하고 편집 계열은 6,000자에서 막히므로 이 조합은 도달할 수 없다. → **계수 조정(D6) 불필요**. 단 codex 6,000자는 공식 대비 여유 18%로 얇다 — 열린 질문.
- 곁가지 관찰: `parse_final_result` 는 `is_error:true` 인 `result` 줄(4번)도 정상 결과로 읽는다(`subtype == "success"` 만 검사). 인위적으로 출력 상한을 낮춰야만 재현되고(실제 모델 최대 128,000토큰) SPEC 범위 밖이라 고치지 않는다. `completion:"cutoff"` 이므로 이 경우도 「아래에 삽입」만 남아 원문은 지워지지 않는다.
- Windows `.cmd` 셈 동작은 이 환경에서 확인 불가(AC-AI13-014 수동).
- 가드 참고: 작업 세션의 명령 가드가 `--skip-git-repo-check` 문자열을 git 조작으로 오인해 거부하여, codex 실측은 worktree 루트(git 저장소)를 `-C` 로 줘 그 플래그 없이 실행했다. 출력 형식에는 영향 없음.

### M2~M4 구현 및 게이트 (오케스트레이터 직접 재실행, 2026-11-13, 트리: WT-long-selection, 구현 에이전트 2개 작업 후)

구현은 `general-purpose` 에이전트 2개(Rust / TS, 파일 겹침 없음)가 TDD 로 수행. RED: Rust 는 새 시그니처 부재로 컴파일 실패(`error[E0433]: ... undeclared type Completion`, `E0425: cannot find function watchdog_timeout_secs`, `could not compile mdedit (lib test) due to 49 previous errors`) — 동작 단위 RED 는 관찰하지 못함(컴파일 RED 만). TS 는 6개 파일 50개 테스트 실패(`backendWatchdogTimeoutMs is not a function` 등) 확인 후 GREEN.

| 명령 | 결과 |
|------|------|
| `cargo test --manifest-path src-tauri/Cargo.toml` | exit 0 — lib `404 passed; 0 failed`, app_acl `3 passed`, asset_charset `8 passed` |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 (`--max-warnings 0`) |
| `npx vitest run --dir src` | exit 0 — `Test Files 120 passed (120)`, `Tests 2077 passed (2077)` |

Playwright: plan.md 가 지정한 spec 이 없어 실행하지 않았다(UI 외형 변경 없음, 이유 문구는 CSS 없는 `completion-notice` 클래스 — 카드 t7 이 CSS 소유).

### AC 상태

| AC | 상태 | 근거 |
|----|------|------|
| AC-AI13-001 | PASS | `args_have_no_prompt_text_and_no_newlines_and_file_is_outside_scratch` (Rust) |
| AC-AI13-002 | PASS | `build_codex_args_has_no_prompt_and_last_element_is_json` (Rust) |
| AC-AI13-003 | PASS | `/bin/cat` 실제 파이프 왕복(claude·codex Command) + BrokenPipe writer (Rust, unix) |
| AC-AI13-004 | PASS | 공유 표 9행 + 이모지 chars 대조 (Rust) |
| AC-AI13-005 | PASS | 공유 표 9행 + 순서 불변식 (TS) |
| AC-AI13-006 | PASS | 6,000자 카드 65s streaming / 97s 백스톱, 재요청 동일 (TS) |
| AC-AI13-007 | PASS | 6000/6001/12000/12001 경계 + 안내 문구 (TS) |
| AC-AI13-008 | PASS | 실측 fixture 로 complete/cutoff/unknown/끈적임 + DonePayload 직렬화 (Rust) |
| AC-AI13-009 | PASS | `codex_done_payload` 두 경로 (Rust) |
| AC-AI13-010 | PASS | useAiRelay → aiStore → 카드 구독 경로 (TS, `src/test/aiLongSelection.test.ts`) |
| AC-AI13-011 | PASS | 라우터 경로 cutoff (TS) |
| AC-AI13-012 | PASS | 회귀·2000/2001 경계·7,000자 변환 카드 무문구·6,000자 selection 무절단 (TS) |
| AC-AI13-013 | **대기** | 실기기(macOS) 앱에서 6,000자 다듬기 — 사용자 수동. CLI 수준 실측은 M1 로 완료. |
| AC-AI13-014 | **대기** | Windows `.cmd` 실기기 — 사용자 확인 대기. |

### 결정(위임 중 취한 기본값)
- 시스템 프롬프트 파일 경로는 `cwd.parent()/ai-prompt/system-prompt.txt` (`AiProvider::spawn` 이 app_data 를 직접 받지 않음).
- 카드는 `selectionLength` 가 모델에 없으면 `originalText.length` 로 대신하고, 재요청 시작 시 `completion` 을 `unknown` 으로 초기화.
- `completion-notice` 클래스 CSS 없음(t7 소유 CSS 불변 원칙) — 후속 스타일 필요.

### 열린 질문 / 한계
- codex 6,000자 polish 75.5s vs 공식 92s(여유 18%) — 느린 계정/모델에서 timeout 가능. 필요 시 후속 계수 조정(D6).
- `parse_final_result` 가 `is_error:true` 결과도 정상으로 읽음(범위 밖, M1 4번 캡처).
- Windows `.cmd` 미확인. `--system-prompt-file` 제거 시 모든 claude 요청 인자 오류(위험 표 기재).
- Rust 쪽 AC 는 CI 에서 돌지 않음 — 위 `cargo test` 원문이 유일한 증거.

### D6 계수 조정 (코디네이터 지시, 2026-11-13, 1회 사용)

- 사유: codex 6,000자 다듬기 실측 75.5초가 공식 92초 대비 여유 18%뿐이고, 카드 t6 이 codex 추론 강도 강제를 없애 CLI 기본값으로 바뀌면 더 느려질 수 있다.
- 변경: `min(60 + 8×k, 150)` → `min(60 + 12×k, 180)` (k = ceil(max(0,n−2000)/1000)). 6,000자 92→108초(여유 43%), 12,000자 140→180초(상한에 처음 닿음), 2,001자 68→72초. 상한 180은 D6 허용 한도.
- 수정 위치: Rust `watchdog_timeout_secs`(mod.rs), TS `backendWatchdogTimeoutMs`(waitNotice.ts), 공유 표 `ai-timeout-table.json`, 테스트(Rust 이모지 행 기대값 72, `aiLongSelection.test.ts` 백스톱 시점 113초), spec.md D5/D6/REQ-004/006/AC 요약, acceptance.md AC-004/006 숫자.
- 재실행(영향 범위만):
  - `cargo test --manifest-path src-tauri/Cargo.toml ai::tests::watchdog` → exit 0, `2 passed; 0 failed`
  - `npx vitest run src/test/aiLongSelection.test.ts aiCardWatchdog.test.ts aiCardRetryLimit.test.ts aiCardCoexistence.test.ts aiWaitNotice.test.ts` → exit 0, `Test Files 5 passed (5)`, `Tests 79 passed (79)`
- 한계: 전체 스위트는 재실행하지 않았다(상수·기대값만 바뀜). 위 §AC 표의 AC-004~006 은 새 값 기준으로 여전히 PASS.

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_status: audit-ready
sync_complete_at: 2026-11-13
backlog_card: t5
spec_status_transition: "draft -> implemented (completed 는 AC-AI13-013/014 수동 확인 후)"
files_changed_in_sync:
  - CHANGELOG.md            # [Unreleased] ### Changed 에 SPEC-AI-013 항목 추가 (SPEC-AI-012 항목 위)
  - docs/USER_GUIDE.md      # 「선택 길이 제한」 문단: 6,000/12,000자 + 「바꾸기」 숨김·이유 문구 설명
  - src/styles/mdedit-components.css  # .mdedit-ai-completion-notice (오케스트레이터 추가, 흐린 글자색)
  - .moai/specs/SPEC-AI-013-long-selection/spec.md  # frontmatter status/updated 만
  - .moai/specs/SPEC-AI-013-long-selection/progress.md  # 본 절
readme_user_manual_checked: "README.md, docs/USER_MANUAL.md 에 옛 선택 길이 수치(2,000/4,000자) 없음 (grep 확인), 수정 안 함"
pending_manual_checks:
  - AC-AI13-013  # macOS 실제 앱, 6,000자 다듬기
  - AC-AI13-014  # Windows .cmd 셈 경유 실행
gaps:
  - "CI 는 cargo test 를 돌리지 않음 — Rust 증거는 §E.2 로컬 실행 원문뿐"
  - "D6 계수 조정(8/150 -> 12/180) 뒤 전체 스위트 미재실행 (영향 범위만: cargo ai::tests::watchdog 2건, vitest 5파일 79건)"
  - "codex 6,000자 다듬기 여유 43% (75.5s / 108s) — 느린 계정에서 시간 초과 가능"
  - "parse_final_result 가 is_error:true result 를 정상으로 읽음 (범위 밖)"
  - "§E.2 의 'completion-notice CSS 없음' 기록은 sync 에서 CSS 가 추가되어 현재는 해당 없음"
sync-audit: (pending)
```
