---
id: SPEC-AI-013
version: "0.2.1"
status: draft
created: 2026-11-13
updated: 2026-11-13
author: jw
---

# SPEC-AI-013 구현 계획

## 등급과 방법론

- **Tier M** — 수정 파일 약 11개(Rust 4, TS 6, 공유 fixture 1~2) + 테스트. 예상 변경량 300~700줄. 요구사항 15건, 인수 기준 14건(Tier M 상한: 요구사항 16, 인수 기준 16 — 각각 따로 센다).
- 방법론: `quality.yaml` 의 TDD(RED-GREEN-REFACTOR). 외부 CLI 동작에 기대는 부분(M1)만 실측 스파이크로 먼저 확정한다.
- 시작 조건: SPEC-AI-012(카드 t4)가 `main` 에 병합된 뒤, `origin/main` 기준 새 워크트리에서 시작한다. `prompt.rs` 는 건드리지 않는다.

## 구현 원칙

1. **가장 작은 변경**: 판정 구조(가드의 편집/변환 두 계열, 세 타임아웃 계층)는 그대로 두고 상수·함수만 바꾼다. `AiProvider::spawn` 시그니처도 그대로 두고, 각 프로바이더의 `spawn` 안에서 시스템 프롬프트 파일 쓰기와 표준 입력 쓰기 스레드를 처리한다. claude 쪽은 codex 에 이미 있는 `build_codex_command` 와 같은 모양의 `build_claude_command` 를 하나 추출할 뿐, 새 추상화는 만들지 않는다.
2. **사용자 텍스트는 argv 에 없다**: 인자 조립 함수에서 프롬프트 매개변수를 없애 실수가 컴파일 단계에서 막히게 한다 — `build_claude_args(model, system_prompt_path)`, `build_codex_args(model, scratch_dir)`.
3. **한 공식, 두 구현, 한 표**: Rust `watchdog_timeout_secs(n: usize) -> u64` 와 TS `backendWatchdogTimeoutMs(n: number)` 는 같은 공유 표로 테스트한다.
4. **알 수 없음은 완결이 아니다**: `completion` 기본값은 `unknown`. `complete` 는 claude 정지 사유를 실제로 봤을 때만, `cutoff` 는 한 번 보면 끝까지 유지.
5. **외부 CLI fixture 는 실측 캡처**: 정지 사유 파서 테스트는 M1 에서 캡처한 원문 줄을 쓴다.
6. **두 done 경로를 함께**: `completion` 은 `aiStore` 경로와 `aiEventRouter` 경로에 동시에 실어야 한다. 한쪽만 바꾸면 정상 경로(스토어)에서 값이 사라져 긴 claude 카드가 모두 삽입 전용이 된다.

## Milestones (우선순위 순서)

### M1 — 실측 스파이크 (Priority: High, BLOCKER)

모델을 실제로 호출하는 확인이므로 짧은 입력과 기본 티어로 최소한만 한다. 모든 명령과 출력 원문(긴 출력은 파일 경로 + 끝부분)을 `progress.md` §E.2 에 남긴다.

1. `--system-prompt-file` 확인: "답의 첫 줄에 반드시 ZQX-표지를 써라" 같은 시스템 프롬프트를 스크래치 파일에 써서 `claude -p --system-prompt-file <파일> --output-format stream-json --include-partial-messages --verbose --setting-sources "" --tools "" --model haiku` 에 짧은 표준 입력으로 넣고, 표지가 응답에 나오는지 본다. 나오지 않거나 플래그가 거부되면 **차단 보고**로 코디네이터에 넘긴다(대안: 시스템 프롬프트를 인자로 유지하되 Windows 위험을 받아들이거나, 시스템 프롬프트를 표준 입력 앞에 붙이는 방식 — 사용자 결정 필요).
2. 한글 약 6,000자 프롬프트를 같은 명령에 표준 입력으로 넣어 정상 응답을 확인하고 출력 전체를 파일로 저장한다.
3. 그 출력에서 정지 사유가 나오는 줄(`stream_event`/`message_delta`, `assistant` 메시지, `result` 줄 후보)과 **한 실행당 등장 횟수**를 기록한다. 찾은 줄을 `src-tauri/tests/fixtures/` 에 캡처 fixture 로 저장한다. 잘림(`max_tokens`) 사례는 출력 토큰 상한을 아주 작게 주는 방법(예: `CLAUDE_CODE_MAX_OUTPUT_TOKENS` 환경변수 — 동작 여부도 기록)으로 캡처를 시도한다. 잘림 사례를 캡처하지 못하면 정상 사례에서 확인한 같은 필드에 값만 바꾼 줄을 쓰고, 그 사실을 fixture 옆 주석과 `progress.md` 에 적는다.
4. 같은 프롬프트를 `codex exec ... --json` 에 위치 인자 없이 표준 입력으로 넣어 정상 응답을 확인하고, JSONL 전체를 저장해 정지 사유에 해당하는 필드가 있는지 본다(없으면 D7대로 `unknown`).
5. 6,000자·12,000자 입력의 응답 시간을 두 CLI에서 한 번씩 잰다. D5 공식이 실측보다 짧으면 D6 범위 안에서 계수 조정이 필요하다 — SPEC 본문 수정은 manager-spec 소관이므로 run 워커는 수치와 함께 차단 보고로 넘긴다.
6. Windows 는 이 단계에서 확인할 수 없다(개발 환경 macOS). AC-AI13-014 수동 확인으로 넘긴다.

종료 조건: 1~5의 명령·출력이 `progress.md` 에 있고, `--system-prompt-file` 동작과 정지 사유 필드가 확정(또는 "없음"으로 확정)되었다.

### M2 — 명령줄 밖으로 프롬프트 전달 (Priority: High)

- RED: AC-AI13-001(claude 인자·파일 내용), AC-AI13-002(codex 인자), AC-AI13-003(`/bin/cat` 으로 실제 파이프 왕복 + 실패 writer) 테스트를 먼저 쓰고 실패를 확인한다.
- GREEN:
  - `build_claude_args(model, system_prompt_path)` — `-p`, `--system-prompt-file <경로>`, 나머지 기존 플래그.
  - `build_claude_command(binary, args, cwd, model)` — `no_window`, args, `current_dir`, 사고 예산 env(현행 그대로), stdin/stdout/stderr piped. `spawn_claude` 는 이를 스폰만 하는 얇은 래퍼.
  - 시스템 프롬프트 파일: 작업 폴더(`ai-scratch`)가 아니라 그 형제 폴더 `<app_data>/ai-prompt/system-prompt.txt` 에 스폰 직전 덮어쓴다(A2). `AiProvider::spawn` 은 작업 폴더 경로(`cwd`)만 받으므로 `cwd.parent()` 기준으로 형제 폴더를 구하거나 `ensure_scratch_dir` 와 같은 모양의 준비 함수를 하나 둔다. 작업 폴더에는 아무것도 쓰지 않는다(격리 계약).
  - 표준 입력 쓰기 헬퍼: `fn spawn_stdin_writer<W: Write + Send + 'static>(w: W, bytes: Vec<u8>) -> JoinHandle<()>` — 전체 쓰기 후 drop, 오류는 무시. 두 프로바이더가 공유.
  - `build_codex_args(model, scratch_dir)`, `build_codex_command` stdin piped, `spawn_codex` 에서 헬퍼로 `combine_prompts` 결과를 쓴다.
- 주석·`@MX` 갱신: codex 의 "stdin null 이 부작용 차단" 설명을 새 동작으로 바꾼다. `@MX:ANCHOR` 는 유지하고 REASON 만 갱신. `--tools ""` 계약 주석은 그대로 둔다.

### M3 — 크기 비례 대기 한도 (Priority: High)

- RED: 공유 표 `src-tauri/tests/fixtures/ai-timeout-table.json` 을 먼저 만들고, Rust 테스트(`include_str!` + `serde_json`)와 TS 테스트(JSON import)가 실패하는지 확인한다(AC-AI13-004/005).
- GREEN: Rust `watchdog_timeout_secs(n)` 을 `mod.rs` 에 두고, `ai_request` 에서 `args.selection` 의 `encode_utf16().count()` 로 계산해 워치독 스레드에 넘긴다. TS `backendWatchdogTimeoutMs(n)`·`frontendBackstopDelayMs(n)` 로 교체하고 카드가 백스톱을 걸 때 그 카드의 선택 길이를 넣는다(AC-AI13-006).
- 기존 상수를 쓰는 테스트 3개(`aiCardRetryLimit.test.ts`, `aiCardCoexistence.test.ts`, `aiCardWatchdog.test.ts`)를 함수 호출로 옮긴다. 기존 상수는 남기지 않는다(고정값이 남아 있으면 다시 고정값을 쓰는 실수가 생긴다).

### M4 — 길이 한도와 완결 판정 (Priority: High)

- 가드: `EDIT_LIMIT` 6000, `TRANSFORM_LIMIT` 12000, `SAFE_REPLACE_LIMIT` 2000. `aiLengthGuard.test.ts`·`aiSelectionToolbar.test.ts` 경계값을 새 값으로 옮긴다(AC-AI13-007).
- 백엔드: `stream.rs` 에 M1 에서 확정한 정지 사유 파서를 추가하고, claude 릴레이가 D7 규칙(끈적이는 `cutoff`)으로 `completion` 을 정해 `DonePayload` 에 싣는다. codex 릴레이는 done payload 조립을 순수 함수로 분리해 `unknown` 을 싣는다(AC-AI13-008/009).
- 전달: `aiStore` 트랜지언트 슬라이스에 `completion` 추가 + `completeRequest(finalText, truncated, completion)`, `useAiRelay` 가 payload 의 값을 넘기고(없으면 `unknown`), `aiEventRouter` 의 `onDone` 에도 세 번째 인자로 넘긴다.
- 카드: 두 done 경로 모두에서 `completion` 을 받아, 순수 함수(예: `applyCompletionToActions(actions, { selectionLength, completion, guardInsertOnly })` → `{ actions, reason }`)로 「바꾸기」 제거와 이유 문구를 정한다(AC-AI13-010/011/012).

### M5 — 통합 확인 (Priority: Medium)

- `cargo test --manifest-path src-tauri/Cargo.toml`, 이번 변경과 관련된 Vitest 파일, `npx tsc --noEmit`, 변경 파일 eslint. Rust 결과는 CI 에서 돌지 않으므로 원문을 `progress.md` 에 남긴다.
- 실기기(macOS): 6,000자 한글 선택에 다듬기를 claude·codex 각각 실행 → 결과·버튼 상태 확인(AC-AI13-013).
- Windows 수동 확인(AC-AI13-014)은 사용자 몫으로 남기고 PR 본문에 적는다.

## 변경 파일 목록 (코디네이터 겹침 확인용)

| 파일 | 마일스톤 | 겹침 |
|------|----------|------|
| `src-tauri/src/ai/claude_cli.rs` | M2, M4 | SPEC-AI-014(t6)가 `AiModel`·`claude_thinking_env` 를 없앤다 — 새 `build_claude_command` 의 `model` 인자와 사고 예산 env 처리는 먼저 병합된 쪽에 맞춘다 |
| `src-tauri/src/ai/codex_cli.rs` | M2, M4 | SPEC-AI-014(t6)가 codex 인자·stdin 서술을 다룬다 — 아래 위험 표 참고 |
| `src-tauri/src/ai/stream.rs` | M4 | — |
| `src-tauri/src/ai/mod.rs` | M3 | SPEC-AI-012(t4)도 수정 — t4 병합 후 시작 |
| `src/lib/ai/waitNotice.ts` | M3 | — |
| `src/components/editor/extensions/ai-length-guard.ts` | M4 | — |
| `src/components/editor/extensions/ai-suggestion-card.ts` | M3, M4 | SPEC-AI-012(t4)도 수정 — t4 병합 후 시작 |
| `src/store/aiStore.ts` | M4 | — |
| `src/hooks/useAiRelay.ts` | M4 | — |
| `src/lib/ai/aiEventRouter.ts` | M4 | — |
| `src-tauri/tests/fixtures/ai-timeout-table.json` (신규) | M3 | — |
| `src-tauri/tests/fixtures/claude-*.jsonl` (신규, 이름은 M1 확정) | M1, M4 | — |
| `src/test/aiLengthGuard.test.ts`, `aiSelectionToolbar.test.ts`, `aiWaitNotice.test.ts`, `aiCardRetryLimit.test.ts`, `aiCardCoexistence.test.ts`, `aiCardWatchdog.test.ts`, 카드·릴레이 테스트 | M3, M4 | — |

`prompt.rs` 는 변경하지 않는다. `ai-selection-toolbar.ts` 는 코드 변경이 없을 것으로 예상한다(상수를 가드에서 가져옴).

## Risks & Mitigations

| 위험 | 대응 |
|------|------|
| `--system-prompt-file` 이 기대대로 동작하지 않는다 | M1-1 에서 먼저 확인하고, 안 되면 run 을 멈추고 차단 보고(사용자 결정 사항). |
| 이후 claude 버전이 플래그 목록에 없는 `--system-prompt-file` 을 없앤다 | 그러면 모든 claude 요청이 인자 오류로 실패한다. 기존 stderr 분류로 오류 카드가 뜨므로 조용히 망가지지는 않는다. 플래그 존재 확인을 `detect.rs` 버전 검사에 넣는 일은 이 SPEC 범위 밖으로 두고, 발생 시 후속 작업으로 처리한다. |
| claude 출력에 정지 사유가 없다 | D8 폴백: claude 도 `unknown` → 2,000자 초과는 두 CLI 모두 삽입 전용. 기능은 동작하고 안전 쪽으로 기운다. |
| 한 실행에 정지 사유가 여러 번 나온다 | D7 끈적이는 `cutoff` 로 잘림을 놓치지 않는다. M1 에서 횟수를 기록한다. |
| Windows `.cmd` 셈 동작 미확인 | 인자에 사용자 텍스트·여러 줄 문자열이 없도록 설계했으나, 실기기 확인 전까지는 미검증이다. AC-AI13-014 수동 확인, 실패 시 후속 작업. |
| Rust 테스트가 CI 에서 돌지 않는다 | 공유 표의 Rust 쪽 검사는 로컬 실행 기록으로만 증명된다. run 완료 보고에 `cargo test` 원문을 요구한다(A5). |
| 표준 입력 쓰기와 자식 출력 읽기가 서로 막는다 | 쓰기를 전용 스레드에서 하므로 릴레이 스레드가 동시에 stdout/stderr 를 비운다. |
| 큰 입력에서 응답이 대기 한도를 넘는다 | 워치독이 분류된 `timeout` 오류를 내고 카드는 재시도 가능 상태가 된다(기존 경로). 계수는 M1 실측으로 한 번 조정 가능(D6). |
| codex 사용자는 2,000자 초과 다듬기가 항상 삽입 전용이 된다 | 의도된 안전 선택(D7). 이유 문구로 알린다. codex 가 완결 신호를 내보내게 되면 후속 SPEC에서 매핑만 추가한다. |
| SPEC-AI-012 병합 후 `ai-suggestion-card.ts`·`mod.rs` 구조가 달라진다 | run 시작 시 해당 파일을 다시 읽는다. SPEC 의 줄 번호는 참고용이다. |
| SPEC-AI-014(t6)가 "codex 는 stdin 을 막는다"를 전제로 서술한다 | 두 SPEC 중 먼저 병합되는 쪽 기준으로 나중 SPEC 의 run 이 맞춘다. 코디네이터에 충돌을 보고한다. |

## Out of Scope

spec.md 「Out of Scope — 이 SPEC에서 하지 않는 것」 절과 같다.
