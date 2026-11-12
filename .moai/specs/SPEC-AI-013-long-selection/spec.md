---
id: SPEC-AI-013
title: "긴 선택 허용 — 표준 입력 전달·크기 비례 대기 한도·원문 손실 방지"
version: "0.1.0"
status: draft
created: 2026-11-13
updated: 2026-11-13
author: jw
priority: High
phase: "v0.22.0"
module: "src-tauri/src/ai, src/lib/ai, src/components/editor/extensions"
lifecycle: spec-anchored
tags: "ai, long-selection, stdin, watchdog, length-guard, truncation"
tier: M
depends_on:
  - SPEC-AI-012
issue_number: null
---

> 관련 SPEC(참조, 선행 아님): SPEC-AI-001(길이 가드 REQ-AI-026/027), SPEC-AI-006(워치독), SPEC-AI-009(codex 프로바이더), SPEC-AI-010(프런트 백스톱). 선행 의존은 SPEC-AI-012(카드 t4) 하나뿐이다 — 같은 파일 `ai-suggestion-card.ts` 를 먼저 바꾸기 때문이다.

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-11-13 | jw | 최초 작성 — 백로그 카드 t5(긴 선택 허용). 사용자는 자리를 비운 상태에서 자율 진행을 허락했고, 계획 워커가 사용자 대신 내린 결정은 「사용자 대신 내린 결정」 절에 D1~D9 로 남긴다. |

## Summary

긴 선택 영역에 AI 프리셋(다듬기·직접 입력·개요·표·다이어그램·짧게)을 안전하게 쓸 수 있게 한다. 지금은 편집 계열 2,000자, 변환 계열 4,000자에서 막힌다. 이 SPEC은 네 가지를 함께 바꾼다.

1. **전달 경로** — 사용자 프롬프트(선택 텍스트 포함)를 명령줄 인자 대신 **표준 입력**으로 CLI에 넘긴다. Windows 명령줄 한도(CreateProcess 32,767자, `.cmd` 셈을 거칠 때 cmd.exe 약 8,191자)와 여러 줄 인자 이스케이프 문제를 근본적으로 없앤다.
2. **대기 한도** — 백엔드 워치독(60초 고정)과 프런트 백스톱(65초 고정)을 **선택 길이에 따라 늘어나는 한 공식**으로 바꾸고, 두 쪽이 같은 값을 내는지 공유 표로 검증한다.
3. **길이 한도** — 편집 계열 6,000자, 변환 계열 12,000자로 완화한다.
4. **원문 손실 방지** — 응답이 끝까지 왔다는 신호를 백엔드가 `ai://done` 에 실어 보내고, 2,000자를 넘는 선택은 **끝까지 왔다고 확인된 경우에만** 「바꾸기」를 허용한다. 확인할 수 없거나(codex) 잘렸다고 확인되면(claude `max_tokens`) 「아래에 삽입」만 남긴다.

주변 문맥 상한(`prompt.rs:10-14` 의 `INLINE_SIDE_MAX 1000` / `SECTION_TAIL_MAX 1500` / `CONTINUE_HEAD_MAX 1500`)은 바꾸지 않는다. 목표는 문맥을 넓히는 것이 아니라 **선택 자체를 길게** 허용하는 것이다.

## 사용자 확정 사항 (2026-11-13, 재검토 금지)

- U1. 목표는 **긴 선택 허용**이다. 주변 문맥 상한은 유지한다.
- U2. 대기 시간은 입력 크기에 맞춰 늘어나야 한다. 다만 이 편집기에서 아주 오래 걸리는 작업은 기대하지 않는다(상한을 둔다).
- U3. 추론 강도는 CLI 기본값을 유지한다(카드 t6 / SPEC-AI-014 가 고급 토글을 없앤다). 이 SPEC은 추론 관련 인자를 건드리지 않는다.

## 사용자 대신 내린 결정 (계획 워커, 2026-11-13)

사용자가 자는 동안 자율 진행을 허락했으므로, 아래 결정은 계획 워커가 가장 작은 설계를 기준으로 정했다. 사용자가 바꾸려면 이 표만 고치면 된다.

| ID | 결정 | 근거 |
|----|------|------|
| D1 | **두 CLI 모두 사용자 프롬프트를 표준 입력으로 넘긴다.** claude 는 `-p` 뒤의 위치 인자를 빼고 표준 입력에 쓴다. codex 는 결합 프롬프트 위치 인자를 빼고 표준 입력에 쓴다. claude 의 `--system-prompt` 는 인자로 남긴다(고정 문구, 수백 자, 사용자 텍스트 없음). | 계획 단계 실측(「실측 기록」): 두 CLI 모두 프롬프트 인자를 빼면 표준 입력에서 읽는다. |
| D2 | 표준 입력 쓰기는 **스폰 직후 전용 스레드**에서 하고, 다 쓰면 핸들을 닫아(EOF) 끝을 알린다. 쓰기 실패(자식이 먼저 죽어 파이프가 닫힘)는 무시하고 결과 분류는 기존 릴레이·워치독에 맡긴다. | 파이프 버퍼(Windows 는 작다)보다 큰 입력을 호출 스레드에서 쓰면 교착 위험이 있다. 결과 판정 경로를 하나로 유지한다. |
| D3 | 편집 계열(다듬기·직접 입력) 한도 `EDIT_LIMIT` **2,000 → 6,000자**, 변환 계열 한도 `TRANSFORM_LIMIT` **4,000 → 12,000자**. 판정 구조(편집 계열은 한도 초과 시 비활성, 변환 계열은 `EDIT_LIMIT` 초과~`TRANSFORM_LIMIT` 구간에서 삽입 전용)는 그대로 둔다. | U2(긴 작업 비기대)와 대기 상한(D5)이 맞물리는 값. 구조를 유지하면 메뉴 안내·툴바 코드는 상수만 따라온다. |
| D4 | **안전 교체 한도 `SAFE_REPLACE_LIMIT = 2,000자`**(기존 편집 한도와 같은 값)를 새로 둔다. 선택이 이 값 이하이면 지금과 같이 「바꾸기」를 허용한다(단, 잘림이 확인되면 막는다). 이 값을 넘으면 응답이 **끝까지 왔다고 확인된 경우에만** 「바꾸기」를 허용한다. | 2,000자 이하는 지금까지 문제 없이 써 온 범위다. 그 위에서만 새 확인 절차를 요구해 회귀 범위를 줄인다. |
| D5 | 대기 한도 공식: `timeout_secs(n) = min(60 + 8 × ceil(max(0, n − 2000) / 1000), 150)`, `n` = 선택 텍스트의 **UTF-16 길이**(JS `String.length` 와 같은 단위). 프런트 백스톱 = `timeout_secs(n) × 1000 + 5000` ms. 8초 대기 안내는 바꾸지 않는다. | 2,000자 이하는 60초 그대로(회귀 없음), 6,000자 92초, 12,000자 140초, 상한 150초(U2). 단위를 UTF-16 으로 고정해야 이모지 등에서 Rust `chars().count()` 와 JS `length` 가 어긋나지 않는다. |
| D6 | 계수(60·8·1000·2000·150)는 M1 지연 실측 결과로 **한 번** 조정할 수 있다. 조정 시 공식의 모양은 유지하고, 상한은 180초를 넘기지 않는다. 조정하면 Rust 상수·TS 상수·공유 표 세 곳을 함께 고치고 결정 표에 기록한다. | 두 CLI의 실제 처리 속도는 모델 호출 없이 잴 수 없다. |
| D7 | 응답 완결 신호는 `ai://done` 에 `completion: "complete" \| "cutoff" \| "unknown"` 필드로 싣는다. claude 는 출력의 정지 사유(`stop_reason`)가 `end_turn`·`stop_sequence` 면 `complete`, `max_tokens` 면 `cutoff`, 정지 사유를 못 보면 `unknown`. codex 는 항상 `unknown`(현재 파서·실측 fixture 기준 `turn.completed` 는 `usage` 만 가진다). | 「알 수 없음」을 「완결」로 취급하지 않는 것이 원문 손실 방지의 핵심이다. |
| D8 | claude 정지 사유를 어느 줄에서 읽는지(`stream_event` 의 `message_delta.delta.stop_reason`, `result` 줄의 `stop_reason` 등)는 **M1 실측 캡처로 확정**한다. 실측에서 어느 줄에도 정지 사유가 없으면 claude 도 `unknown` 을 보내며, 그 경우 2,000자 초과 선택은 두 CLI 모두 삽입 전용이 된다(안전 쪽 폴백). | 외부 CLI 출력 파서의 fixture 는 문서상 가정이 아니라 실측 캡처여야 한다(과거 SPEC-AI-009 사례). |
| D9 | 「바꾸기」를 막을 때 카드에 이유 한 줄을 보여준다. 잘림 확인 시: "응답이 중간에 끊겨서 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요". 완결 미확인 시: "응답이 끝까지 왔는지 확인할 수 없어 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요". | 침묵 금지 원칙(SPEC-AI-001 P7). |

## 실측 기록 (계획 단계, 모델 호출 없음)

환경: macOS, `claude` 2.1.322, `codex-cli` 0.167.0, 빈 작업 폴더, 표준 입력 = `/dev/null`, 프롬프트 인자 없음.

| 명령 | 출력 | 해석 |
|------|------|------|
| `claude -p --setting-sources "" --tools "" < /dev/null` | `Error: Input must be provided either through stdin or as a prompt argument when using --print` | 프롬프트 인자가 없으면 표준 입력을 입력원으로 쓴다. 모델 호출 전에 끝났다. |
| `codex exec --skip-git-repo-check --ephemeral --sandbox read-only --json < /dev/null` | `Reading prompt from stdin...` / `No prompt provided via stdin.` | 프롬프트 인자가 없으면 표준 입력에서 읽는다. 모델 호출 전에 끝났다. |
| `codex exec --help` | "If not provided as an argument (or if `-` is used), instructions are read from stdin. If stdin is piped and a prompt is also provided, stdin is appended as a `<stdin>` block" | 인자와 표준 입력을 동시에 주면 안 된다 — 인자를 **빼야** 한다. |
| `claude --help` | `--input-format <format>  "text" (default), or "stream-json"` | 기본 `text` 형식이면 표준 입력을 그대로 프롬프트로 읽는다. |

**아직 확인하지 못한 것(M1 스파이크로 넘김)**: (a) 실제 긴 한글 프롬프트를 표준 입력으로 보냈을 때 두 CLI가 정상 응답하는지, (b) claude stream-json 출력에서 정지 사유가 나오는 줄과 필드, (c) Windows `.cmd` 셈을 거칠 때 표준 입력 전달과 남은 `--system-prompt` 인자가 정상인지, (d) 6,000자·12,000자 입력의 실제 응답 시간.

**곁가지 관찰(이 SPEC 범위 밖)**: 위 claude 실행의 stderr 첫 줄에 로그인 만료 예고 경고("this sign-in can end at any time ... Run claude auth login now")가 찍혔다. `classify_stderr` 의 로그인 표지(`login`, `auth`)와 겹치므로, 다른 원인의 실패가 로그인 오류로 안내될 수 있다. 전달 경로와 무관한 기존 문제라 여기서는 고치지 않고 열린 질문으로 넘긴다.

## Background — 현재 동작 (소스 대조)

- **claude 인자**: `build_claude_args`(`src-tauri/src/ai/claude_cli.rs:83-99`)가 `-p <user_prompt> --system-prompt <system_prompt> ...` 를 만들고, `spawn_claude`(`:191-207`)는 `stdin(Stdio::null())`.
- **codex 인자**: `combine_prompts`(`codex_cli.rs:33-35`)로 합친 문자열을 `build_codex_args`(`:97-120`) 마지막 위치 인자로 넣고, `build_codex_command`(`:135-151`)는 `stdin(Stdio::null())` — 주석은 "codex 가 stdin 을 읽으려는 부작용 차단"을 이유로 든다. 프롬프트 인자를 빼면 그 동작이 곧 원하는 입력 경로가 된다.
- **Windows 셈**: `detect.rs:123-142`, `:318-340` 가 `%APPDATA%\npm\claude.cmd` / `codex.cmd` 를 후보로 삼는다. `.cmd` 실행은 cmd.exe 를 거쳐 명령줄이 약 8,191자로 묶이고, Rust 표준 라이브러리는 배치 파일 인자를 안전하게 이스케이프할 수 없으면 스폰을 거부한다.
- **대기 한도**: `WATCHDOG_TIMEOUT_SECS = 60`(`src-tauri/src/ai/mod.rs:32`), 워치독 스레드(`:279-305`)가 `Duration::from_secs(WATCHDOG_TIMEOUT_SECS)` 로 잔다. 프런트는 `src/lib/ai/waitNotice.ts` 에서 `BACKEND_WATCHDOG_TIMEOUT_MS = 60_000` 미러 + `FRONTEND_BACKSTOP_GRACE_MS = 5_000` 로 `FRONTEND_BACKSTOP_DELAY_MS` 를 파생하고, `ai-suggestion-card.ts:1034-1035` 가 이 고정값으로 백스톱을 건다. 파일 주석 스스로 "백엔드만 바뀌는 경우를 잡지 못하는 사각지대"라고 적고 있다.
- **길이 가드**: 실제 위치는 `src/components/editor/extensions/ai-length-guard.ts:19-20`(카드 본문이 적은 `src/lib/ai/` 가 아님) — `EDIT_LIMIT = 2000`, `TRANSFORM_LIMIT = 4000`. `evaluateSelectionGuard` 를 `ai-selection-toolbar.ts`(메뉴 항목·안내 줄·요청 조립)가 소비하고, 그 결과 `insertOnly` 가 카드의 `deriveCardActions`(`ai-suggestion-card.ts:166-174`)로 흘러간다.
- **완결 감지 없음**: `parse_final_result`(`src-tauri/src/ai/stream.rs:65-75`)는 `subtype == "success"` 의 `result` 문자열만 꺼내고 정지 사유를 보지 않는다. codex 는 스트리밍이 아니라 `agent_message` 한 번 + `turn.completed`(usage 만) 이다. `DonePayload`(`claude_cli.rs:37-42`)에는 `request_id`·`result`·`truncated`(문맥 절단 여부)만 있다.

## Environment & Assumptions

- A1. 선행 카드 t4(SPEC-AI-012, 프롬프트 구조 보강)가 `prompt.rs` 와 `ai-suggestion-card.ts` 를 먼저 바꾸고 병합된 뒤 이 SPEC의 run 을 시작한다. 이 SPEC은 `prompt.rs` 를 바꾸지 않는다(조립 결과 `AssembledPrompt` 를 그대로 쓴다). 위 줄 번호는 t4 병합 전 기준이다.
- A2. 동시 요청은 1개(`in_flight` 슬롯)라는 기존 전제는 그대로다.
- A3. 표준 입력은 UTF-8 바이트로 쓴다. 두 CLI가 표준 입력을 UTF-8 로 읽는다고 가정하며, M1 에서 한글로 확인한다.
- A4. 선택 길이 `n` 은 프런트가 이미 `args.selection` 으로 백엔드에 보내는 문자열의 UTF-16 길이다. 선택이 없는 기능(이어쓰기·섹션 채우기)은 `n = 0` 으로 60초를 쓴다.

## Requirements (EARS)

### 모듈 1 — 표준 입력 전달

- **REQ-AI13-001** (Ubiquitous) **[MODIFY]**: The system **shall** claude 를 스폰할 때 사용자 프롬프트를 명령줄 인자에 넣지 않고 자식 프로세스의 표준 입력으로 전달한다. 인자 목록에는 `-p` 플래그, `--system-prompt <시스템 프롬프트>`, `--model`, 기존 격리 플래그(`--output-format stream-json --include-partial-messages --verbose --setting-sources "" --tools ""`)만 남는다.
- **REQ-AI13-002** (Ubiquitous) **[MODIFY]**: The system **shall** codex 를 스폰할 때 시스템·사용자 결합 프롬프트를 위치 인자로 넣지 않고 표준 입력으로 전달한다. 기존 격리 인자(`exec -C <scratch> --ignore-user-config --skip-git-repo-check --ephemeral --sandbox read-only --model ... -c model_reasoning_effort=... --json`)는 그대로 유지한다.
- **REQ-AI13-003** (Ubiquitous): The system **shall** 표준 입력 쓰기를 호출 스레드가 아닌 전용 스레드에서 수행하고, 프롬프트 전체를 쓴 뒤 표준 입력 핸들을 닫아 입력 끝(EOF)을 알린다.
- **REQ-AI13-004** (Unwanted): **IF** 표준 입력 쓰기가 실패하면(자식이 먼저 종료해 파이프가 닫힌 경우 등), **then the system shall** 패닉하거나 별도 이벤트를 발행하지 않고, 그 요청의 결과 판정을 기존 릴레이·워치독 경로(단일 발행 `claim_terminal`)에 맡긴다.
- **REQ-AI13-005** (Ubiquitous): The system **shall** 사용자 선택 텍스트가 어떤 형태로도 자식 프로세스의 명령줄 인자에 나타나지 않게 한다(두 CLI 공통).

### 모듈 2 — 입력 크기에 따른 대기 한도

- **REQ-AI13-006** (Ubiquitous) **[MODIFY]**: The system **shall** 요청별 워치독 대기 시간을 D5 공식 `timeout_secs(n) = min(60 + 8 × ceil(max(0, n − 2000) / 1000), 150)` 로 계산한다. `n` 은 요청 인자 `selection` 의 UTF-16 길이이며, 선택이 없으면 0 이다.
- **REQ-AI13-007** (Ubiquitous) **[MODIFY]**: The system **shall** 프런트 백스톱 지연을 같은 공식의 프런트 구현 결과에 고정 유예 5,000ms 를 더한 값(`timeout_secs(n) × 1000 + 5000`)으로 계산하고, 카드가 백스톱을 걸 때마다(첫 요청과 모든 재요청) 그 카드 요청의 선택 길이로 계산한다.
- **REQ-AI13-008** (Ubiquitous): The system **shall** 대기 한도 공식을 백엔드(Rust)와 프런트(TS)에 각각 순수 함수로 두고, **한 공유 표 파일**(입력 길이 → 기대 초)을 두 쪽 테스트가 모두 읽어 같은 값을 내는지 검증한다. 표에는 최소 0, 2000, 2001, 3000, 6000, 12000, 상한에 처음 닿는 길이, 상한을 넘는 길이, 이모지가 섞인 문자열(UTF-16 길이와 문자 수가 다른 사례)이 들어간다.
- **REQ-AI13-009** (Ubiquitous): The system **shall** 세 타임아웃 계층의 순서 불변식(대기 안내 8초 < 백엔드 워치독 < 프런트 백스톱)을 모든 `n` 에서 유지한다. 8초 대기 안내 값은 바꾸지 않는다.

### 모듈 3 — 선택 길이 한도 완화

- **REQ-AI13-010** (Ubiquitous) **[MODIFY]**: The system **shall** 편집 계열 프리셋(다듬기·직접 입력)을 선택 길이 6,000자 이하에서 허용하고, 그 초과에서는 지금과 같은 방식(비활성 + 현재 글자 수와 한도를 담은 안내)으로 막는다.
- **REQ-AI13-011** (Ubiquitous) **[MODIFY]**: The system **shall** 변환 계열 프리셋(개요·표·다이어그램·짧게)을 6,000자 이하에서 정상 허용하고, 6,001~12,000자에서는 「아래에 삽입」 전용으로 허용하며, 12,000자 초과에서는 비활성 + 안내로 막는다.
- **REQ-AI13-012** (Ubiquitous): The system **shall** 길이 안내 문구가 바뀐 한도 값을 그대로 보여주게 한다(문구 속 숫자는 상수에서 파생하며 별도 리터럴로 적지 않는다).

### 모듈 4 — 응답 완결 확인과 원문 손실 방지

- **REQ-AI13-013** (Ubiquitous) **[MODIFY]**: The system **shall** `ai://done` 이벤트에 `completion` 필드(`"complete" | "cutoff" | "unknown"`)를 싣는다. 기존 `requestId`·`result`·`truncated` 의 의미는 바꾸지 않는다. 프런트는 필드가 없으면 `"unknown"` 으로 읽는다.
- **REQ-AI13-014** (Event-Driven): **WHEN** claude 출력에서 정지 사유가 `end_turn` 또는 `stop_sequence` 로 관측되면 **the system shall** `completion: "complete"` 를, `max_tokens` 로 관측되면 `completion: "cutoff"` 를 보낸다. 정지 사유를 관측하지 못하면 `"unknown"` 을 보낸다. 정지 사유를 읽는 줄·필드는 M1 실측 캡처로 확정하고, 파서 테스트 fixture 는 그 캡처 원문을 쓴다.
- **REQ-AI13-015** (Ubiquitous): The system **shall** codex 완료에는 `completion: "unknown"` 을 보낸다.
- **REQ-AI13-016** (State-Driven): **WHILE** 카드의 선택 길이가 `SAFE_REPLACE_LIMIT`(2,000자)를 넘고 받은 `completion` 이 `"complete"` 가 아니면, **the system shall** 그 카드의 「바꾸기」를 제공하지 않고 「아래에 삽입」만 제공한다.
- **REQ-AI13-017** (Event-Driven): **WHEN** 받은 `completion` 이 `"cutoff"` 이면, **the system shall** 선택 길이와 무관하게 「바꾸기」를 제공하지 않고 「아래에 삽입」만 제공한다.
- **REQ-AI13-018** (Ubiquitous): The system **shall** REQ-AI13-016/017 로 「바꾸기」를 막을 때 카드에 D9 의 이유 문구 한 줄을 보여준다(잘림 확인과 완결 미확인을 구별한 문구).
- **REQ-AI13-019** (Ubiquitous): The system **shall** 선택 길이가 2,000자 이하이고 `completion` 이 `"cutoff"` 가 아닌 경우(`"unknown"` 포함) 「바꾸기」 제공 여부와 기본 강조 동작을 지금과 똑같이 유지한다(회귀 금지).
- **REQ-AI13-020** (Ubiquitous): The system **shall** 선택 텍스트를 어떤 단계에서도 잘라서 보내지 않는다는 기존 불변식(SPEC-AI-001 REQ-AI-027)을 유지한다.

## Exclusions (What NOT to Build)

- 주변 문맥 상한 변경(U1) — `prompt.rs` 무변경.
- 추론 강도·모델 선택 인자 변경(U3, SPEC-AI-014 담당).
- 긴 선택을 여러 조각으로 나눠 여러 번 요청하는 분할 처리.
- 출력 길이·원문 비율 같은 휴리스틱으로 잘림을 추정하는 기능.
- 진행률 표시 등 새 대기 UI. 8초 대기 안내 문구도 그대로다.
- `--system-prompt-file` 전환은 M1 에서 Windows 문제가 확인될 때만 하는 폴백이며, 확인 전에는 만들지 않는다.
- `classify_stderr` 의 로그인 표지 오탐(「실측 기록」 곁가지 관찰) 수정.

## Delta (Brownfield Changes)

| 종류 | 파일 | 변경 |
|------|------|------|
| [MODIFY] | `src-tauri/src/ai/claude_cli.rs` | `build_claude_args` 에서 사용자 프롬프트 위치 인자 제거(REQ-AI13-001), `spawn_claude` stdin piped + 전용 쓰기 스레드(REQ-AI13-003/004), 릴레이에서 정지 사유 → `completion` 결정 후 발행(REQ-AI13-013/014). `DonePayload` 에 `completion` 필드 추가. |
| [MODIFY] | `src-tauri/src/ai/codex_cli.rs` | `build_codex_args` 에서 결합 프롬프트 위치 인자 제거(REQ-AI13-002), `build_codex_command` stdin piped, 쓰기 스레드, done 발행 시 `completion: "unknown"`(REQ-AI13-015). stdin null 이유 주석·`@MX` 갱신. |
| [MODIFY] | `src-tauri/src/ai/stream.rs` | claude 정지 사유 파서 추가(M1 캡처 fixture 기반, REQ-AI13-014). |
| [MODIFY] | `src-tauri/src/ai/mod.rs` | `WATCHDOG_TIMEOUT_SECS` 고정 상수를 `watchdog_timeout_secs(n)` 순수 함수로 대체(REQ-AI13-006), `ai_request` 가 `selection` 의 UTF-16 길이로 계산해 워치독 스레드에 넘김. |
| [MODIFY] | `src/lib/ai/waitNotice.ts` | 고정 미러 `BACKEND_WATCHDOG_TIMEOUT_MS`·`FRONTEND_BACKSTOP_DELAY_MS` 를 `backendWatchdogTimeoutMs(n)`·`frontendBackstopDelayMs(n)` 함수로 대체(REQ-AI13-007/009). `WAIT_NOTICE_DELAY_MS` 무변경. |
| [MODIFY] | `src/components/editor/extensions/ai-length-guard.ts` | `EDIT_LIMIT` 6000, `TRANSFORM_LIMIT` 12000, `SAFE_REPLACE_LIMIT` 2000 신설(REQ-AI13-010/011/016). 근거 주석 갱신. |
| [MODIFY] | `src/components/editor/extensions/ai-suggestion-card.ts` | 백스톱을 선택 길이 기반 함수로 계산(REQ-AI13-007), done 수신 시 `completion` 과 선택 길이로 「바꾸기」 제공 여부 재판정 + 이유 문구(REQ-AI13-016~019). t4 병합 후 그 위에서 수정. |
| [MODIFY] | `src/hooks/useAiRelay.ts`, `src/lib/ai/aiEventRouter.ts` | `ai://done` payload 의 `completion` 을 카드 `onDone` 까지 전달(필드 없으면 `"unknown"`). |
| [NEW] | `src-tauri/tests/fixtures/ai-timeout-table.json` | 대기 한도 공유 표(REQ-AI13-008). Rust 는 `include_str!`, TS 는 JSON import 로 읽는다. |
| [NEW] | `src-tauri/tests/fixtures/claude-stop-reason-*.jsonl` (이름은 M1 에서 확정) | M1 실측 캡처 원문(REQ-AI13-014). |
| [TEST] | `src/test/aiLengthGuard.test.ts`, `src/test/aiSelectionToolbar.test.ts`, `src/test/aiWaitNotice.test.ts`, 카드 테스트, Rust 단위 테스트 | 한도·공식·인자·완결 판정 테스트 갱신·추가. |

`ai-selection-toolbar.ts` 는 상수를 가드에서 가져오므로 코드 변경이 없을 것으로 본다(테스트만 갱신). `prompt.rs` 는 바꾸지 않는다.

## Acceptance Criteria

상세 Given-When-Then 은 `acceptance.md`. 요약:

| AC | REQ | 내용 |
|----|-----|------|
| AC-AI13-001 | 001, 005 | claude 인자 목록에 사용자 프롬프트(선택 텍스트)가 없다; `-p`·`--system-prompt`·격리 플래그는 있다. |
| AC-AI13-002 | 002, 005 | codex 인자 목록 마지막이 `--json` 이고 결합 프롬프트가 없다. |
| AC-AI13-003 | 003, 004 | 두 Command 구성이 stdin piped; 쓰기 헬퍼가 전체 바이트를 쓰고 닫으며, 닫힌 파이프에 쓰면 패닉 없이 반환한다. |
| AC-AI13-004 | 006, 008 | Rust `watchdog_timeout_secs` 가 공유 표의 모든 행과 일치한다. |
| AC-AI13-005 | 007, 008, 009 | TS 함수가 공유 표와 일치하고 모든 행에서 8000 < 워치독 < 백스톱. |
| AC-AI13-006 | 007 | 6,000자 선택 카드는 65초에 백스톱이 걸리지 않고 97초에 걸린다. |
| AC-AI13-007 | 010, 011, 012 | 가드 경계값 6000/6001/12000/12001 에서 편집·변환 계열 판정과 안내 문구 숫자. |
| AC-AI13-008 | 013, 014 | claude 정지 사유 캡처 fixture 로 `complete`/`cutoff`/`unknown` 판정. |
| AC-AI13-009 | 015 | codex done 은 `completion: "unknown"`. |
| AC-AI13-010 | 016, 018 | 3,000자 선택 + `unknown` → 「아래에 삽입」만, 이유 문구. 3,000자 + `complete` → 「바꾸기」 제공. |
| AC-AI13-011 | 017, 018 | 500자 선택 + `cutoff` → 「아래에 삽입」만, 잘림 문구. |
| AC-AI13-012 | 019, 020 | 500자 선택 + `unknown` → 기존과 같은 버튼·기본 강조(회귀). 요청 인자의 `selection` 은 원문과 같다. |
| AC-AI13-013 | 001~004 | 실기기(macOS): 6,000자 한글 선택 다듬기가 두 CLI 모두 정상 완료(M1 스파이크 + M5). |
| AC-AI13-014 | 001~004 | 실기기(Windows, `.cmd` 셈): 6,000자 한글 선택 다듬기 정상 완료(수동). |
