---
id: SPEC-AI-013
version: "0.1.0"
status: draft
created: 2026-11-13
updated: 2026-11-13
author: jw
---

# SPEC-AI-013 구현 계획

## 등급과 방법론

- **Tier M** — 수정 파일 약 10개(Rust 4, TS 5, 공유 fixture 1~2) + 테스트. 예상 변경량 300~700줄. REQ 20건, AC 14건(Tier M 상한 16 이내).
- 방법론: `quality.yaml` 의 TDD(RED-GREEN-REFACTOR). 외부 CLI 동작에 기대는 부분(M1)만 실측 스파이크로 먼저 확정한다.
- 시작 조건: SPEC-AI-012(카드 t4)가 `main` 에 병합된 뒤, `origin/main` 기준 새 워크트리에서 시작한다. `prompt.rs` 는 건드리지 않는다.

## 구현 원칙

1. **가장 작은 변경**: 판정 구조(가드의 편집/변환 두 계열, 세 타임아웃 계층)는 그대로 두고 상수·함수만 바꾼다. 새 추상화(예: 전송 전략 트레이트)는 만들지 않는다. `AiProvider::spawn` 시그니처도 그대로 두고, 각 프로바이더의 `spawn` 안에서 표준 입력 쓰기 스레드를 띄운다.
2. **사용자 텍스트는 argv 에 없다**: 인자 조립 순수 함수에서 프롬프트 매개변수를 제거해 컴파일 단계에서 실수를 막는다(`build_claude_args(model, system_prompt)`, `build_codex_args(model, scratch_dir)`).
3. **한 공식, 두 구현, 한 표**: Rust `watchdog_timeout_secs(n: usize) -> u64` 와 TS `backendWatchdogTimeoutMs(n: number)` 는 같은 공유 표로 테스트한다.
4. **알 수 없음은 완결이 아니다**: `completion` 기본값은 `unknown`. `complete` 는 claude 정지 사유를 실제로 봤을 때만.
5. **외부 CLI fixture 는 실측 캡처**: 정지 사유 파서 테스트는 M1 에서 캡처한 원문 줄을 쓴다(문서상 가정으로 fixture 를 만들지 않는다).

## Milestones (우선순위 순서)

### M1 — 실측 스파이크 (Priority: High, BLOCKER)

모델을 실제로 호출하는 확인이므로 짧은 입력과 기본 티어로 최소한만 한다. 결과는 `progress.md` §E.2 에 명령과 출력 원문으로 남긴다.

1. 한글 약 6,000자 프롬프트를 `claude -p --system-prompt ... --output-format stream-json --include-partial-messages --verbose --setting-sources "" --tools "" --model haiku` 에 **표준 입력으로** 넣어 정상 응답을 확인하고, 출력 전체를 파일로 저장한다.
2. 그 출력에서 정지 사유가 나오는 줄을 찾는다(`stream_event`/`message_delta`, `assistant` 메시지, `result` 줄 후보). 찾은 줄들을 `src-tauri/tests/fixtures/` 에 캡처 fixture 로 저장한다. 잘림(`max_tokens`) 사례는 `CLAUDE_CODE_MAX_OUTPUT_TOKENS` 를 아주 작게 주는 방식 등으로 캡처를 시도한다. 잘림 사례를 캡처하지 못하면, 정상 사례에서 확인한 같은 필드에 값만 다른 줄을 쓰되 그 사실을 fixture 옆 주석과 `progress.md` 에 적는다.
3. 같은 프롬프트를 `codex exec ... --json` 에 위치 인자 없이 표준 입력으로 넣어 정상 응답을 확인하고, JSONL 전체를 저장해 정지 사유에 해당하는 필드가 있는지 본다(없으면 D7대로 `unknown`).
4. 6,000자·12,000자 입력의 응답 시간을 두 CLI에서 한 번씩 잰다. D5 공식이 실측보다 짧으면 D6 범위 안에서 계수를 한 번 조정하고 spec.md 결정 표에 기록을 요청한다(SPEC 본문 수정은 manager-spec 소관이므로 run 워커는 차단 보고로 넘긴다).
5. Windows 는 이 단계에서 확인할 수 없다(개발 환경 macOS). AC-AI13-014 수동 확인으로 넘긴다.

종료 조건: 위 1~4의 명령·출력이 `progress.md` 에 있고, 정지 사유 필드가 확정(또는 "없음"으로 확정)되었다.

### M2 — 표준 입력 전달 (Priority: High)

- RED: `build_claude_args` 결과에 사용자 프롬프트 문자열이 없고 `-p`·`--system-prompt` 와 격리 플래그가 있다는 테스트, `build_codex_args` 결과 마지막이 `--json` 이라는 테스트, `build_codex_command` 가 stdin piped 라는 테스트, 쓰기 헬퍼(`write_prompt_to_stdin(stdin, bytes)` 같은 작은 함수)가 닫힌 파이프에서 패닉 없이 반환한다는 테스트.
- GREEN: 인자 함수에서 프롬프트 매개변수 제거, 두 `spawn_*` 에서 `Stdio::piped()` + `child.stdin.take()` 를 스레드로 넘겨 전체 쓰기 후 drop. codex 는 `combine_prompts` 결과를 표준 입력에 쓴다.
- 주석·`@MX` 갱신: codex 의 "stdin null 이 부작용 차단" 설명을 새 동작으로 바꾼다. `@MX:ANCHOR` 는 유지하고 REASON 만 갱신.

### M3 — 크기 비례 대기 한도 (Priority: High)

- RED: 공유 표 `src-tauri/tests/fixtures/ai-timeout-table.json` 을 먼저 만들고, Rust 테스트(`include_str!` + `serde_json`)와 TS 테스트(JSON import)가 각각 실패하는지 확인.
- GREEN: Rust `watchdog_timeout_secs(n)`, `ai_request` 에서 `args.selection` 의 `encode_utf16().count()` 로 계산해 워치독 스레드에 넘김. TS `backendWatchdogTimeoutMs(n)`·`frontendBackstopDelayMs(n)` 로 교체하고, 카드가 백스톱을 걸 때 그 카드의 선택 길이를 넣는다. 기존 상수 `BACKEND_WATCHDOG_TIMEOUT_MS`·`FRONTEND_BACKSTOP_DELAY_MS` 를 쓰는 테스트(`aiCardRetryLimit.test.ts`, `aiCardCoexistence.test.ts`)는 함수 호출(`frontendBackstopDelayMs(0)` 등)로 옮긴다.
- 순서 불변식 테스트: 표의 모든 행에서 8000 < 워치독 ms < 백스톱 ms.

### M4 — 길이 한도와 완결 판정 (Priority: High)

- 가드: `EDIT_LIMIT` 6000, `TRANSFORM_LIMIT` 12000, `SAFE_REPLACE_LIMIT` 2000. `aiLengthGuard.test.ts`·`aiSelectionToolbar.test.ts` 의 경계값을 새 값으로 옮긴다(안내 문구 숫자는 상수에서 파생되므로 문구 코드는 그대로일 것).
- 백엔드: `stream.rs` 에 M1 에서 확정한 정지 사유 파서 추가, claude 릴레이가 마지막으로 본 정지 사유로 `completion` 을 정해 `DonePayload` 에 싣는다. codex 릴레이는 `unknown`. `DonePayload` 직렬화 테스트에 `completion` 포함 확인.
- 프런트: `useAiRelay` → `aiEventRouter` → 카드 `onDone` 까지 `completion` 전달(없으면 `unknown`). 카드는 done 시점에 `deriveCardActions` 결과에 「바꾸기」 제거 판정(`selectionLength > SAFE_REPLACE_LIMIT && completion !== 'complete'` 또는 `completion === 'cutoff'`)을 더하고, 막을 때 D9 문구를 한 줄 보여준다. 판정은 카드 파일 안의 순수 함수로 두고 단위 테스트한다.

### M5 — 통합 확인 (Priority: Medium)

- `cargo test`(src-tauri 매니페스트), `npx vitest run` 중 이번 변경과 관련된 파일, `npx tsc --noEmit`, `npx eslint` 대상 파일.
- 실기기(macOS): 6,000자 한글 선택에 다듬기를 claude·codex 각각 실행 → 결과·버튼 상태 확인(AC-AI13-013).
- Windows 수동 확인(AC-AI13-014)은 사용자 몫으로 남기고 PR 본문에 적는다.

## 변경 파일 목록 (코디네이터 겹침 확인용)

| 파일 | 마일스톤 |
|------|----------|
| `src-tauri/src/ai/claude_cli.rs` | M2, M4 |
| `src-tauri/src/ai/codex_cli.rs` | M2, M4 |
| `src-tauri/src/ai/stream.rs` | M4 |
| `src-tauri/src/ai/mod.rs` | M3 |
| `src/lib/ai/waitNotice.ts` | M3 |
| `src/components/editor/extensions/ai-length-guard.ts` | M4 |
| `src/components/editor/extensions/ai-suggestion-card.ts` | M3, M4 (t4 / SPEC-AI-012 와 겹침 — t4 병합 후 시작) |
| `src/hooks/useAiRelay.ts` | M4 |
| `src/lib/ai/aiEventRouter.ts` | M4 |
| `src-tauri/tests/fixtures/ai-timeout-table.json` (신규) | M3 |
| `src-tauri/tests/fixtures/claude-*.jsonl` (신규, 이름은 M1 확정) | M1, M4 |
| `src/test/aiLengthGuard.test.ts`, `src/test/aiSelectionToolbar.test.ts`, `src/test/aiWaitNotice.test.ts`, `src/test/aiCardRetryLimit.test.ts`, `src/test/aiCardCoexistence.test.ts`, 카드 테스트 | M3, M4 |

`prompt.rs` 는 변경하지 않는다. `ai-selection-toolbar.ts` 는 코드 변경이 없을 것으로 예상한다(상수를 가드에서 가져옴).

## Risks & Mitigations

| 위험 | 대응 |
|------|------|
| claude 출력에 정지 사유가 없다 | D8 폴백: claude 도 `unknown` → 2,000자 초과는 두 CLI 모두 삽입 전용. 기능은 동작하고 안전 쪽으로 기운다. |
| Windows `.cmd` 셈에서 남은 `--system-prompt` 인자(여러 줄)가 이스케이프 거부된다 | 이 문제는 지금도 같은 인자로 존재한다(이번 변경이 새로 만드는 위험이 아님). 확인되면 `--system-prompt-file`(스크래치 폴더 파일)로 바꾸는 후속 작업으로 처리한다. |
| 표준 입력 쓰기와 자식 출력 읽기가 서로 막는다 | 쓰기를 전용 스레드에서 하므로 릴레이 스레드가 동시에 stdout/stderr 를 비운다. |
| 큰 입력에서 응답이 150초를 넘는다 | 워치독이 분류된 `timeout` 오류를 내고 카드는 재시도 가능 상태가 된다(기존 경로). 계수는 M1 실측으로 한 번 조정 가능(D6). |
| codex 사용자에게 2,000자 초과 다듬기가 항상 삽입 전용이 된다 | 의도된 안전 선택(D7). 이유 문구로 알린다. codex 가 완결 신호를 내보내게 되면 후속 SPEC에서 `complete` 매핑만 추가한다. |
| t4 병합 후 `ai-suggestion-card.ts` 줄 번호·구조가 달라진다 | run 시작 시 해당 파일을 다시 읽고 판정 함수만 추가한다. SPEC 의 줄 번호는 참고용이다. |

## Out of Scope

spec.md 「Exclusions」 절과 같다: 문맥 상한, 추론 강도, 분할 요청, 휴리스틱 잘림 추정, 새 대기 UI, `classify_stderr` 오탐.
