---
id: SPEC-AI-013
title: "긴 선택 허용 — 표준 입력 전달·크기 비례 대기 한도·원문 손실 방지"
version: "0.2.1"
status: draft
created: 2026-11-13
updated: 2026-11-13
author: jw
priority: High
phase: "v0.22.0"
module: "src-tauri/src/ai, src/lib/ai, src/store, src/components/editor/extensions"
lifecycle: spec-anchored
tags: "ai, long-selection, stdin, watchdog, length-guard, truncation"
tier: M
depends_on:
  - SPEC-AI-012
issue_number: null
---

> 관련 SPEC(참조, 선행 아님): SPEC-AI-001(길이 가드 REQ-AI-026/027), SPEC-AI-006(워치독), SPEC-AI-009(codex 프로바이더), SPEC-AI-010(프런트 백스톱·이벤트 라우터). 선행 의존은 SPEC-AI-012(카드 t4) 하나다 — `ai-suggestion-card.ts` 와 `mod.rs` 를 먼저 바꾸기 때문이다.

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-11-13 | jw | 최초 작성 — 백로그 카드 t5(긴 선택 허용). 사용자는 자리를 비운 상태에서 자율 진행을 허락했고, 계획 워커가 사용자 대신 내린 결정은 「사용자 대신 내린 결정」 절에 남긴다. |
| 0.2.1 | 2026-11-13 | jw | plan-auditor 2차(FAIL 0.87, 막힘 2건) 반영. (1) 시스템 프롬프트 파일을 작업 폴더(`ai-scratch`, 비어 있어야 하는 격리 폴더) 밖 `<app_data>/ai-prompt/` 로 옮기고 AC-AI13-001 에 작업 폴더가 비어 있음을 확인하는 단언 추가. (2) 2,000/2,001자 경계 AC 추가(AC-AI13-012). 부수: `--system-prompt-file` 제거 위험, AC-003 읽기 순서, 겹침 표, 지시문 길이 미반영 근거 보강. |
| 0.2.0 | 2026-11-13 | jw | plan-auditor 1차(FAIL 0.77) 반영. (1) 정상 경로에서 `done` 은 라우터가 아니라 `aiStore` 구독으로 카드에 닿으므로 `completion` 을 스토어까지 실어 나르도록 범위에 `src/store/aiStore.ts` 추가. (2) REQ 20건 → 15건으로 병합(Tier M 상한 16). (3) claude 시스템 프롬프트도 `--system-prompt-file` 로 옮김 — 직접 입력 프리셋은 사용자가 친 지시문을 시스템 프롬프트에 넣으므로(`prompt.rs:111`) 인자로 남기면 Windows 한도·여러 줄 이스케이프 문제가 그대로 남는다. (4) 한 번이라도 `max_tokens` 를 보면 `cutoff` 로 고정. (5) 「바꾸기」 판정 길이·이유 문구 표시 조건·이모지 표 행 조건 명확화. (6) 위험 표에 Rust 테스트 CI 미실행·Windows 미확인 추가. 줄 번호 정정. |

## Summary

긴 선택 영역에 AI 프리셋(다듬기·직접 입력·개요·표·다이어그램·짧게)을 안전하게 쓸 수 있게 한다. 지금은 편집 계열 2,000자, 변환 계열 4,000자에서 막힌다. 이 SPEC은 네 가지를 함께 바꾼다.

1. **전달 경로** — 사용자 프롬프트(선택 텍스트 포함)는 **표준 입력**으로, claude 시스템 프롬프트는 **파일**(`--system-prompt-file`)로 넘겨 명령줄 인자에 사용자 텍스트와 여러 줄 문자열이 남지 않게 한다. Windows 명령줄 한도(CreateProcess 32,767자, `.cmd` 셈을 거칠 때 cmd.exe 약 8,191자)에 걸리지 않게 하는 것이 목적이며, Windows 실기기 동작은 아직 확인하지 못했다(AC-AI13-014 수동 확인).
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
| D1 | **사용자 텍스트는 어떤 경우에도 명령줄 인자에 싣지 않는다.** claude: 사용자 프롬프트는 표준 입력, 시스템 프롬프트는 **작업 폴더(`ai-scratch`) 바깥의 형제 폴더** `<app_data>/ai-prompt/system-prompt.txt` 에 써서 `--system-prompt-file <절대 경로>` 로 넘긴다. 작업 폴더는 지금처럼 비어 있어야 한다(격리 계약, `claude_cli.rs:23`·`:77`, `mod.rs:180-185`) — 두 CLI가 같은 작업 폴더를 쓰므로 거기에 파일을 두면 codex 가 다음 요청에서 그 파일(직접 입력 지시문 포함)을 읽을 수 있다. codex: 시스템·사용자 결합 프롬프트를 표준 입력으로 넘긴다(위치 인자 없음). | 두 CLI 모두 프롬프트 인자를 빼면 표준 입력에서 읽는다(「실측 기록」). 직접 입력 프리셋은 사용자가 친 지시문을 시스템 프롬프트에 넣고(`prompt.rs:111` `format!("{}\n\n지시: {}", COMMON_INSTRUCTION, instruction.trim())`) 그 입력칸에는 길이 제한이 없으며, 모든 claude 시스템 프롬프트는 여러 줄이다. 따라서 시스템 프롬프트를 인자로 남기면 이 SPEC의 목적이 절반만 달성된다. `--system-prompt-file` 은 `claude --help` 본문에 `--system-prompt[-file]` 로 언급되어 있으나 플래그 목록에는 단독 항목이 없으므로, M1 에서 동작을 실측으로 확인한다. |
| D2 | 표준 입력 쓰기는 **스폰 직후 전용 스레드**에서 하고, 다 쓰면 핸들을 닫아(EOF) 끝을 알린다. 쓰기 실패(자식이 먼저 죽어 파이프가 닫힘)는 무시하고 결과 분류는 기존 릴레이·워치독에 맡긴다. | 파이프 버퍼보다 큰 입력을 호출 스레드에서 쓰면 교착 위험이 있다. 결과 판정 경로를 하나로 유지한다. |
| D3 | 편집 계열(다듬기·직접 입력) 한도 `EDIT_LIMIT` **2,000 → 6,000자**, 변환 계열 한도 `TRANSFORM_LIMIT` **4,000 → 12,000자**. 판정 구조(편집 계열은 한도 초과 시 비활성, 변환 계열은 `EDIT_LIMIT` 초과~`TRANSFORM_LIMIT` 구간에서 삽입 전용)는 그대로 둔다. | U2(긴 작업 비기대)와 대기 상한(D5)이 맞물리는 값. 구조를 유지하면 메뉴 안내·툴바 코드는 상수만 따라온다. |
| D4 | **안전 교체 한도 `SAFE_REPLACE_LIMIT = 2,000자`**(기존 편집 한도와 같은 값)를 새로 둔다. 비교 대상 길이는 **요청이 `selection` 으로 보낸 텍스트의 UTF-16 길이**(모델이 처리하라고 받은 대상)다. 이 값 이하면 지금과 같이 「바꾸기」를 허용하고(잘림이 확인되면 막는다), 넘으면 응답이 끝까지 왔다고 확인된 경우에만 허용한다. | 2,000자 이하는 지금까지 문제 없이 써 온 범위다. 원문 손실 위험은 "모델이 받은 대상 전체를 출력했는가"에 달려 있으므로 모델이 받은 텍스트 길이로 판정한다. 「바꾸기」가 문장 경계로 넓힌 범위(`expandToSentenceBoundary`)를 지우는 동작은 기존 그대로다. |
| D5 | 대기 한도 공식: `timeout_secs(n) = min(60 + 8 × ceil(max(0, n − 2000) / 1000), 150)`, `n` = 선택 텍스트의 **UTF-16 길이**(JS `String.length` 와 같은 단위). 프런트 백스톱 = `timeout_secs(n) × 1000 + 5000` ms. 8초 대기 안내는 바꾸지 않는다. | 2,000자 이하는 60초 그대로(회귀 없음), 6,000자 92초, 12,000자 140초. UI 최대 선택(12,000자)으로는 상한 150초에 닿지 않으며(처음 닿는 길이는 13,001), 상한은 가드가 바뀌어도 대기가 무한정 늘지 않게 하는 안전판이다. 직접 입력 지시문 길이는 `n` 에 넣지 않는다 — 지시문은 보통 한두 문장이고, 출력 분량을 정하는 것은 처리 대상인 선택 텍스트다. 단위를 UTF-16 으로 고정해야 이모지 등에서 Rust `chars().count()` 와 JS `length` 가 어긋나지 않는다. |
| D6 | 계수(60·8·1000·2000·150)는 M1 지연 실측 결과로 **한 번** 조정할 수 있다. 조정 시 공식의 모양은 유지하고, 상한은 180초를 넘기지 않는다. 조정하면 Rust 상수·TS 상수·공유 표 세 곳을 함께 고치고 이 표에 기록한다. | 두 CLI의 실제 처리 속도는 모델 호출 없이 잴 수 없다. |
| D7 | 응답 완결 신호는 `ai://done` 에 `completion: "complete" \| "cutoff" \| "unknown"` 필드로 싣는다. claude: 한 실행 안에서 정지 사유 `max_tokens` 를 **한 번이라도** 보면 `cutoff`(이후 다른 정지 사유로 덮지 않음), 그렇지 않고 `end_turn`·`stop_sequence` 를 봤으면 `complete`, 정지 사유를 하나도 못 봤으면 `unknown`. codex: 항상 `unknown`(현재 파서·실측 fixture `stream.rs:338` 기준 `turn.completed` 는 `usage` 만 가진다). | 「알 수 없음」을 「완결」로 취급하지 않는 것이 원문 손실 방지의 핵심이다. 한 실행에 assistant 메시지가 여러 개일 가능성을 배제할 수 없으므로 잘림을 끈적하게 유지한다. |
| D8 | claude 정지 사유를 어느 줄에서 읽는지(`stream_event` 의 `message_delta.delta.stop_reason`, `assistant` 메시지, `result` 줄 등)는 **M1 실측 캡처로 확정**하고, M1 에서 한 실행당 정지 사유가 몇 번 나오는지도 센다. 실측에서 정지 사유가 없으면 claude 도 `unknown` 을 보내며, 그 경우 2,000자 초과 선택은 두 CLI 모두 삽입 전용이 된다(안전 쪽 폴백). | 외부 CLI 출력 파서의 fixture 는 문서상 가정이 아니라 실측 캡처여야 한다(과거 SPEC-AI-009 사례). |
| D9 | 완결 규칙(REQ-AI13-013)이 「바꾸기」를 없앨 때 카드에 이유 한 줄을 보여준다. 잘림 확인 시: "응답이 중간에 끊겨서 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요". 완결 미확인 시: "응답이 끝까지 왔는지 확인할 수 없어 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요". 길이 가드가 이미 삽입 전용으로 정한 카드(변환 계열 6,001자 이상)에는 이 줄을 붙이지 않는다 — 그 구간은 메뉴 안내 줄이 이미 이유를 알린다. | 침묵 금지 원칙(SPEC-AI-001 P7). 같은 이유를 두 번 말하지 않는다. |

## 실측 기록 (계획 단계, 모델 호출 없음)

환경: macOS, `claude` 2.1.322, `codex-cli` 0.167.0, 빈 작업 폴더, 표준 입력 = `/dev/null`, 프롬프트 인자 없음.

| 명령 | 출력 | 해석 |
|------|------|------|
| `claude -p --setting-sources "" --tools "" < /dev/null` | `Error: Input must be provided either through stdin or as a prompt argument when using --print` | 프롬프트 인자가 없으면 표준 입력을 입력원으로 쓴다. 모델 호출 전에 끝났다. |
| `codex exec --skip-git-repo-check --ephemeral --sandbox read-only --json < /dev/null` | `Reading prompt from stdin...` / `No prompt provided via stdin.` | 프롬프트 인자가 없으면 표준 입력에서 읽는다. 모델 호출 전에 끝났다. |
| `codex exec --help` | "If not provided as an argument (or if `-` is used), instructions are read from stdin. If stdin is piped and a prompt is also provided, stdin is appended as a `<stdin>` block" | 인자와 표준 입력을 동시에 주면 안 된다 — 인자를 **빼야** 한다. |
| `claude --help` | `--input-format <format>  "text" (default), or "stream-json"` / 설명 본문에 "Explicitly provide context via: --system-prompt[-file], --append-system-prompt[-file], ..." | 기본 `text` 형식이면 표준 입력을 그대로 프롬프트로 읽는다. `--system-prompt-file` 은 설명 본문에만 언급되어 M1 확인이 필요하다. |

**아직 확인하지 못한 것(M1 스파이크로 넘김)**: (a) 실제 긴 한글 프롬프트를 표준 입력으로 보냈을 때 두 CLI가 정상 응답하는지, (b) `--system-prompt-file` 이 `--system-prompt` 와 같은 효과(기본 시스템 프롬프트 대체)를 내는지, (c) claude stream-json 출력에서 정지 사유가 나오는 줄·필드·횟수, (d) 6,000자·12,000자 입력의 실제 응답 시간. Windows `.cmd` 셈 동작은 개발 환경에서 확인할 수 없어 AC-AI13-014 로 넘긴다.

**곁가지 관찰(이 SPEC 범위 밖)**: (1) 위 claude 실행의 stderr 첫 줄에 로그인 만료 예고 경고("this sign-in can end at any time ... Run claude auth login now")가 찍혔다. `classify_stderr` 의 로그인 표지(`login`, `auth`)와 겹치므로, 다른 원인의 실패가 로그인 오류로 안내될 수 있다. (2) 카드의 스토어 구독 경로는 `controller.onComplete(s.streamBuffer)` 로 `truncated` 를 넘기지 않는다(`ai-suggestion-card.ts:1477`). 두 가지 모두 이 SPEC 이전부터 있던 문제라 고치지 않고 열린 질문으로 넘긴다.

## Background — 현재 동작 (소스 대조, SPEC-AI-012 병합 전 기준)

- **claude 인자**: `build_claude_args`(`src-tauri/src/ai/claude_cli.rs:82-98`)가 `-p <user_prompt> --system-prompt <system_prompt> ...` 를 만들고, `spawn_claude`(`:194-209`)는 `stdin(Stdio::null())`.
- **codex 인자**: `combine_prompts`(`codex_cli.rs:33-35`)로 합친 문자열을 `build_codex_args`(`:97-119`) 마지막 위치 인자로 넣고, `build_codex_command`(`:134-150`)는 `stdin(Stdio::null())` — 주석은 "codex 가 stdin 을 읽으려는 부작용 차단"을 이유로 든다. 프롬프트 인자를 빼면 그 동작이 곧 원하는 입력 경로가 된다.
- **Windows 셈**: `detect.rs:123-142`, `:318-340` 가 `%APPDATA%\npm\claude.cmd` / `codex.cmd` 를 후보로 삼는다. `.cmd` 실행은 cmd.exe 를 거쳐 명령줄이 약 8,191자로 묶이고, Rust 표준 라이브러리는 배치 파일 인자를 안전하게 이스케이프할 수 없으면 스폰을 거부한다.
- **대기 한도**: `WATCHDOG_TIMEOUT_SECS = 60`(`src-tauri/src/ai/mod.rs:32`), 워치독 스레드(`:282-305`)가 `Duration::from_secs(WATCHDOG_TIMEOUT_SECS)` 로 잔다. 프런트는 `src/lib/ai/waitNotice.ts` 에서 `BACKEND_WATCHDOG_TIMEOUT_MS = 60_000` 미러 + `FRONTEND_BACKSTOP_GRACE_MS = 5_000` 로 `FRONTEND_BACKSTOP_DELAY_MS` 를 파생하고, `ai-suggestion-card.ts:1035` 가 이 고정값으로 백스톱을 건다. 파일 주석 스스로 "백엔드만 바뀌는 경우를 잡지 못하는 사각지대"라고 적고 있다.
- **길이 가드**: 실제 위치는 `src/components/editor/extensions/ai-length-guard.ts:19-20`(카드 본문이 적은 `src/lib/ai/` 가 아님) — `EDIT_LIMIT = 2000`, `TRANSFORM_LIMIT = 4000`. `evaluateSelectionGuard` 를 `ai-selection-toolbar.ts`(메뉴 항목·안내 줄·요청 조립)가 소비하고, 그 결과 `insertOnly` 가 카드의 `deriveCardActions`(`ai-suggestion-card.ts:166`)로 흘러간다.
- **`done` 이 카드에 닿는 두 경로**: (a) 정상 경로 — `useAiRelay` 가 현재 슬롯 요청의 `ai://done` 을 `aiStore.completeRequest(result, truncated)`(`useAiRelay.ts:67`, `aiStore.ts:36·88`)로 넣고, 카드는 스토어 구독(`ai-suggestion-card.ts:1469-1477`)에서 `controller.onComplete(s.streamBuffer)` 를 부른다. (b) 슬롯을 잃은 카드 — `aiEventRouter` 의 `onDone(result, truncated)` 경로(`:1495-1505`, 슬롯을 쥔 동안은 `isStoreSlot()` 로 즉시 반환). 새 필드는 **두 경로 모두**로 전달되어야 한다.
- **완결 감지 없음**: `parse_final_result`(`src-tauri/src/ai/stream.rs:65-75`)는 `subtype == "success"` 의 `result` 문자열만 꺼내고 정지 사유를 보지 않는다. codex 는 스트리밍이 아니라 `agent_message` 한 번 + `turn.completed`(usage 만) 이다. `DonePayload`(`claude_cli.rs:37-42`)에는 `request_id`·`result`·`truncated`(문맥 절단 여부)만 있다.

## Environment & Assumptions

- A1. 선행 카드 t4(SPEC-AI-012, 프롬프트 구조 보강)가 `prompt.rs`·`ai-suggestion-card.ts`·`mod.rs` 를 먼저 바꾸고 병합된 뒤 이 SPEC의 run 을 시작한다. 이 SPEC은 `prompt.rs` 를 바꾸지 않는다(조립 결과 `AssembledPrompt` 를 그대로 쓴다). 위 줄 번호는 t4 병합 전 기준이며 run 시작 시 다시 확인한다.
- A2. 동시 요청은 1개(`in_flight` 슬롯)라는 기존 전제는 그대로다. 시스템 프롬프트 파일(`<app_data>/ai-prompt/system-prompt.txt`)은 스폰 직전에 덮어쓰며, 새 요청은 옛 프로세스를 kill 한 뒤에 스폰하므로(`mod.rs` 7단계) 한 파일을 써도 경합하지 않는다. 파일은 요청 사이에 남지만 작업 폴더 밖이고 앱 데이터 폴더 안이다(사용자 문서와 같은 보호 수준).
- A3. 표준 입력과 시스템 프롬프트 파일은 UTF-8 로 쓴다. 두 CLI가 이를 UTF-8 로 읽는다고 가정하며, M1 에서 한글로 확인한다.
- A4. 선택이 없는 기능(이어쓰기·섹션 채우기)은 `n = 0` 으로 60초를 쓴다.
- A5. Rust 테스트(`cargo test`)는 현재 CI 어디에서도 돌지 않는다(`.github/workflows/release.yml:11` 주석). 따라서 Rust 쪽 AC 는 run 단계에서 로컬 실행 결과를 `progress.md` 에 남겨 증명한다. 공유 표의 TS 쪽 검사는 CI(프런트 게이트)에서 돈다.

## Requirements (EARS)

### 모듈 1 — 명령줄 밖으로 프롬프트 전달

- **REQ-AI13-001** (Ubiquitous) **[MODIFY]**: The system **shall** claude 를 스폰할 때 사용자 프롬프트는 자식 프로세스의 표준 입력으로, 시스템 프롬프트는 작업 폴더 바깥(`<app_data>/ai-prompt/`)에 쓴 파일의 절대 경로를 `--system-prompt-file` 로 전달하며(작업 폴더는 비어 있는 상태를 유지한다), 인자 목록에는 `-p`, `--system-prompt-file <경로>`, `--model`, 기존 격리 플래그(`--output-format stream-json --include-partial-messages --verbose --setting-sources "" --tools ""`)만 남긴다. 어떤 인자도 사용자 선택 텍스트나 직접 입력 지시문을 담지 않는다.
- **REQ-AI13-002** (Ubiquitous) **[MODIFY]**: The system **shall** codex 를 스폰할 때 시스템·사용자 결합 프롬프트를 위치 인자 없이 표준 입력으로 전달하고, 기존 격리 인자(`exec -C <scratch> --ignore-user-config --skip-git-repo-check --ephemeral --sandbox read-only --model ... -c model_reasoning_effort=... --json`)는 그대로 유지한다.
- **REQ-AI13-003** (Ubiquitous): The system **shall** 표준 입력 쓰기를 호출 스레드가 아닌 전용 스레드에서 수행하고 프롬프트 전체를 쓴 뒤 핸들을 닫아 입력 끝(EOF)을 알리며, 쓰기가 실패해도(자식이 먼저 종료해 파이프가 닫힌 경우 등) 패닉하거나 별도 이벤트를 발행하지 않고 결과 판정을 기존 릴레이·워치독 경로(단일 발행 `claim_terminal`)에 맡긴다.

### 모듈 2 — 입력 크기에 따른 대기 한도

- **REQ-AI13-004** (Ubiquitous) **[MODIFY]**: The system **shall** 요청별 워치독 대기 시간을 D5 공식 `timeout_secs(n) = min(60 + 8 × ceil(max(0, n − 2000) / 1000), 150)` 로 계산한다. `n` 은 요청 인자 `selection` 의 UTF-16 길이이며, 선택이 없으면 0 이다.
- **REQ-AI13-005** (Ubiquitous) **[MODIFY]**: The system **shall** 프런트 백스톱 지연을 같은 공식의 프런트 구현 결과에 고정 유예 5,000ms 를 더한 값(`timeout_secs(n) × 1000 + 5000`)으로 계산하고, 카드가 백스톱을 걸 때마다(첫 요청과 모든 재요청) 그 카드 요청의 선택 길이로 계산한다.
- **REQ-AI13-006** (Ubiquitous): The system **shall** 대기 한도 공식을 백엔드(Rust)와 프런트(TS)에 각각 순수 함수로 두고, **한 공유 표 파일**(입력 → 기대 초)을 두 쪽 테스트가 모두 읽어 같은 값을 내는지 검증한다. 표에는 최소 0, 2000, 2001, 3000, 6000, 12000, 13001, 20000 과, **UTF-16 길이 2,001·문자 수 2,000 이하인 이모지 문자열(기대값 68초)** 행이 들어간다.
- **REQ-AI13-007** (Ubiquitous): The system **shall** 세 타임아웃 계층의 순서 불변식(대기 안내 8초 < 백엔드 워치독 < 프런트 백스톱)을 모든 `n` 에서 유지한다. 8초 대기 안내 값은 바꾸지 않는다.

### 모듈 3 — 선택 길이 한도 완화

- **REQ-AI13-008** (Ubiquitous) **[MODIFY]**: The system **shall** 편집 계열 프리셋(다듬기·직접 입력)을 선택 길이 6,000자 이하에서 허용하고, 그 초과에서는 지금과 같은 방식(비활성 + 현재 글자 수와 한도를 담은 안내)으로 막는다. 안내 문구 속 숫자는 상수에서 파생한다.
- **REQ-AI13-009** (Ubiquitous) **[MODIFY]**: The system **shall** 변환 계열 프리셋(개요·표·다이어그램·짧게)을 6,000자 이하에서 정상 허용하고, 6,001~12,000자에서는 「아래에 삽입」 전용으로 허용하며, 12,000자 초과에서는 비활성 + 안내로 막는다. 안내 문구 속 숫자는 상수에서 파생한다.

### 모듈 4 — 응답 완결 확인과 원문 손실 방지

- **REQ-AI13-010** (Ubiquitous) **[MODIFY]**: The system **shall** `ai://done` 이벤트에 `completion` 필드(`"complete" | "cutoff" | "unknown"`)를 싣고, 이 값을 카드에 닿는 **두 경로 모두** — `aiStore`(`completeRequest`)를 거치는 정상 경로와 `aiEventRouter` 의 `onDone` 경로 — 로 전달한다. 기존 `requestId`·`result`·`truncated` 의 의미는 바꾸지 않으며, 필드가 없으면 `"unknown"` 으로 읽는다.
- **REQ-AI13-011** (Event-Driven): **WHEN** claude 한 실행의 출력에서 정지 사유를 관측하면, **the system shall** D7 규칙대로 `completion` 을 정한다 — `max_tokens` 를 한 번이라도 보면 `"cutoff"`(이후 덮지 않음), 그렇지 않고 `end_turn`·`stop_sequence` 를 보면 `"complete"`, 정지 사유를 하나도 못 보면 `"unknown"`. 정지 사유를 읽는 줄·필드는 M1 실측 캡처로 확정하고, 파서 테스트 fixture 는 그 캡처 원문을 쓴다.
- **REQ-AI13-012** (Ubiquitous): The system **shall** codex 완료에는 `completion: "unknown"` 을 보낸다.
- **REQ-AI13-013** (State-Driven): **WHILE** 카드가 받은 `completion` 이 `"cutoff"` 이거나, 요청 선택 길이가 `SAFE_REPLACE_LIMIT`(2,000자)를 넘고 `completion` 이 `"complete"` 가 아니면, **the system shall** 그 카드의 「바꾸기」를 제공하지 않고 「아래에 삽입」만 제공하며, 길이 가드가 이 카드에 「바꾸기」를 허용했던 경우에 한해 D9 의 이유 문구 한 줄(잘림 확인과 완결 미확인을 구별)을 보여준다.
- **REQ-AI13-014** (Ubiquitous): The system **shall** 선택 길이가 2,000자 이하이고 `completion` 이 `"cutoff"` 가 아닌 경우(`"unknown"` 포함) 「바꾸기」 제공 여부와 기본 강조 동작을 지금과 똑같이 유지한다(회귀 금지).
- **REQ-AI13-015** (Ubiquitous): The system **shall** 선택 텍스트를 어떤 단계에서도 잘라서 보내지 않는다는 기존 불변식(SPEC-AI-001 REQ-AI-027)을 유지한다.

## Exclusions (What NOT to Build)

### Out of Scope — 이 SPEC에서 하지 않는 것

- 주변 문맥 상한 변경(U1) — `prompt.rs` 무변경.
- 추론 강도·모델 선택 인자 변경(U3, SPEC-AI-014 담당).
- 긴 선택을 여러 조각으로 나눠 여러 번 요청하는 분할 처리.
- 출력 길이·원문 비율 같은 휴리스틱으로 잘림을 추정하는 기능.
- 진행률 표시 등 새 대기 UI. 8초 대기 안내 문구도 그대로다.
- 「실측 기록」 곁가지 관찰 두 건(`classify_stderr` 로그인 표지 오탐, 스토어 경로의 `truncated` 누락) 수정.
- Rust 테스트를 CI 에 추가하는 일.

## Delta (Brownfield Changes)

| 종류 | 파일 | 변경 |
|------|------|------|
| [MODIFY] | `src-tauri/src/ai/claude_cli.rs` | `build_claude_args` 에서 사용자·시스템 프롬프트 매개변수 제거 → `--system-prompt-file <경로>` (REQ-AI13-001). codex 와 같은 모양의 `build_claude_command(binary, args, cwd, model)` 추출, stdin piped, 시스템 프롬프트 파일 쓰기(`<app_data>/ai-prompt/`, `ensure_scratch_dir` 옆에 같은 모양의 준비 함수), 표준 입력 쓰기 스레드(REQ-AI13-003). 릴레이에서 정지 사유 → `completion` 결정(REQ-AI13-011). `DonePayload` 에 `completion` 추가(REQ-AI13-010). |
| [MODIFY] | `src-tauri/src/ai/codex_cli.rs` | `build_codex_args` 에서 결합 프롬프트 매개변수 제거(REQ-AI13-002), `build_codex_command` stdin piped, 표준 입력 쓰기 스레드, done payload `completion: "unknown"`(REQ-AI13-012). stdin null 이유 주석·`@MX` 갱신. |
| [MODIFY] | `src-tauri/src/ai/stream.rs` | claude 정지 사유 파서(M1 캡처 fixture 기반, REQ-AI13-011). |
| [MODIFY] | `src-tauri/src/ai/mod.rs` | `WATCHDOG_TIMEOUT_SECS` 고정 상수를 `watchdog_timeout_secs(n)` 순수 함수로 대체(REQ-AI13-004), `ai_request` 가 `selection` 의 `encode_utf16().count()` 로 계산해 워치독 스레드에 넘김. 표준 입력 쓰기 헬퍼를 두 프로바이더가 공유한다면 이 모듈 또는 `claude_cli.rs` 에 둔다. |
| [MODIFY] | `src/lib/ai/waitNotice.ts` | 고정 미러 `BACKEND_WATCHDOG_TIMEOUT_MS`·`FRONTEND_BACKSTOP_DELAY_MS` 를 `backendWatchdogTimeoutMs(n)`·`frontendBackstopDelayMs(n)` 로 대체(REQ-AI13-005/007). `WAIT_NOTICE_DELAY_MS` 무변경. |
| [MODIFY] | `src/components/editor/extensions/ai-length-guard.ts` | `EDIT_LIMIT` 6000, `TRANSFORM_LIMIT` 12000, `SAFE_REPLACE_LIMIT` 2000 신설(REQ-AI13-008/009/013). 근거 주석 갱신. |
| [MODIFY] | `src/store/aiStore.ts` | 트랜지언트 슬라이스에 `completion` 추가, `completeRequest(finalText, truncated, completion)` 확장(REQ-AI13-010). 다른 소비자(고스트·툴바)는 이 필드를 쓰지 않는다. |
| [MODIFY] | `src/hooks/useAiRelay.ts`, `src/lib/ai/aiEventRouter.ts` | `ai://done` payload 의 `completion` 을 스토어와 라우터 양쪽에 전달(REQ-AI13-010). |
| [MODIFY] | `src/components/editor/extensions/ai-suggestion-card.ts` | 백스톱을 선택 길이 기반 함수로 계산(REQ-AI13-005), 두 done 경로에서 `completion` 수신, 「바꾸기」 제거 판정 순수 함수 + 이유 문구(REQ-AI13-013/014). SPEC-AI-012 병합 후 그 위에서 수정. |
| [NEW] | `src-tauri/tests/fixtures/ai-timeout-table.json` | 대기 한도 공유 표(REQ-AI13-006). Rust 는 `include_str!`, TS 는 JSON import 로 읽는다. |
| [NEW] | `src-tauri/tests/fixtures/claude-stop-reason-*.jsonl` (이름은 M1 에서 확정) | M1 실측 캡처 원문(REQ-AI13-011). |
| [TEST] | `src/test/aiLengthGuard.test.ts`, `aiSelectionToolbar.test.ts`, `aiWaitNotice.test.ts`, `aiCardRetryLimit.test.ts`, `aiCardCoexistence.test.ts`, `aiCardWatchdog.test.ts`, 카드·릴레이 테스트, Rust 단위 테스트 | 한도·공식·인자·완결 판정·전달 경로 테스트 갱신·추가. |

`ai-selection-toolbar.ts` 는 상수를 가드에서 가져오므로 코드 변경이 없을 것으로 본다(테스트만 갱신). `prompt.rs` 는 바꾸지 않는다.

## Acceptance Criteria

상세 Given-When-Then 은 `acceptance.md`. 요약:

| AC | REQ | 내용 |
|----|-----|------|
| AC-AI13-001 | 001 | claude 인자 목록에 사용자 프롬프트·시스템 프롬프트 본문이 없고 `--system-prompt-file` 과 격리 플래그가 있다; 파일 내용이 시스템 프롬프트와 같고, 파일은 작업 폴더 밖에 있으며 작업 폴더는 비어 있다. |
| AC-AI13-002 | 002 | codex 인자 목록 마지막이 `--json` 이고 결합 프롬프트가 없다. |
| AC-AI13-003 | 001, 002, 003 | 두 Command 구성으로 실제 자식(`cat`)을 띄우면 stdin 이 열려 있고, 쓰기 헬퍼로 쓴 한글이 그대로 돌아온다; 실패하는 writer 에 쓰면 패닉 없이 끝난다. |
| AC-AI13-004 | 004, 006 | Rust 대기 한도 함수가 공유 표의 모든 행과 일치한다. |
| AC-AI13-005 | 005, 006, 007 | TS 함수가 공유 표와 일치하고 모든 행에서 8000 < 워치독 < 백스톱. |
| AC-AI13-006 | 005 | 6,000자 선택 카드는 65초에 백스톱이 걸리지 않고 97초에 걸린다; 재요청도 같다. |
| AC-AI13-007 | 008, 009 | 가드 경계값 6000/6001/12000/12001 판정과 안내 문구 숫자. |
| AC-AI13-008 | 010, 011 | claude 캡처 fixture 로 `complete`/`cutoff`/`unknown` 판정, `cutoff` 끈적임, `DonePayload` 직렬화. |
| AC-AI13-009 | 012 | codex done payload 는 `completion: "unknown"`. |
| AC-AI13-010 | 010, 013 | **정상 경로**(`useAiRelay` → `aiStore` → 카드 구독)로 3,000자 선택 + `unknown` → 삽입만 + 이유 문구; `complete` → 「바꾸기」 제공. |
| AC-AI13-011 | 010, 013 | **라우터 경로**(슬롯을 잃은 카드)로 500자 선택 + `cutoff` → 삽입만 + 잘림 문구. |
| AC-AI13-012 | 013, 014, 015 | 500자 + `unknown`/필드 없음 → 현행과 같은 버튼·강조; 2,000자는 현행 그대로, 2,001자는 삽입만 + 이유 문구(경계); 변환 계열 7,000자 카드에는 이유 문구가 붙지 않음; 6,000자 요청의 `selection` 은 원문과 같다. |
| AC-AI13-013 | 001~003 | 실기기(macOS): 6,000자 한글 선택 다듬기가 두 CLI 모두 정상 완료. |
| AC-AI13-014 | 001~003 | 실기기(Windows, `.cmd` 셈): 6,000자 한글 선택 다듬기·직접 입력이 스폰 오류 없이 완료. |
