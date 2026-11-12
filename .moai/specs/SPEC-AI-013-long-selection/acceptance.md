---
id: SPEC-AI-013
version: "0.2.0"
status: draft
created: 2026-11-13
updated: 2026-11-13
author: jw
---

# SPEC-AI-013 인수 기준

검증 수단: (a) Rust 단위 테스트(`cargo test --manifest-path src-tauri/Cargo.toml`, CI 미실행이므로 run 단계에서 로컬 실행 결과를 `progress.md` 에 원문 기록), (b) Vitest 단위·통합 테스트(CI 프런트 게이트), (c) 실기기 수동 확인. TDD 순서상 AC-001·002·004·005·006·007·008·010·011 은 현행 코드에서 **반드시 실패**해야 한다(실패하지 않으면 시나리오가 변경을 담지 못한 것).

## 자동 테스트

### AC-AI13-001 — claude 인자에 프롬프트 본문이 없다 (REQ-AI13-001)

- **Given** 시스템 프롬프트 `"SYS-표지-91c2\n둘째 줄"` 과 고유 표지 `"선택-표지-7f3a"` 를 담은 사용자 프롬프트가 있다
- **When** claude 인자 목록을 조립하고 시스템 프롬프트 파일을 쓴다(스크래치 폴더는 테스트 임시 폴더)
- **Then** 어떤 인자도 `"선택-표지-7f3a"` 나 `"SYS-표지-91c2"` 를 포함하지 않고, 어떤 인자에도 줄바꿈이 없다
- **And** `-p`, `--system-prompt-file` 바로 뒤의 파일 경로, `--model`, `--output-format stream-json`, `--include-partial-messages`, `--verbose`, `--setting-sources ""`, `--tools ""` 가 있고 `--system-prompt`(파일 아님)는 없다
- **And** 그 경로의 파일 내용(UTF-8)이 시스템 프롬프트와 바이트 단위로 같다

### AC-AI13-002 — codex 인자에 결합 프롬프트가 없다 (REQ-AI13-002)

- **Given** 같은 표지 문자열이 든 결합 프롬프트가 있다
- **When** codex 인자 목록을 조립한다
- **Then** 어떤 인자도 표지 문자열을 포함하지 않고, 마지막 인자는 `--json` 이다
- **And** `exec`, `-C <scratch>`, `--ignore-user-config`, `--skip-git-repo-check`, `--ephemeral`, `--sandbox read-only`, `--model`, `-c model_reasoning_effort=...` 가 기존 순서대로 있다

### AC-AI13-003 — 표준 입력이 실제로 자식에게 간다 (REQ-AI13-001, 002, 003)

Rust `Command` 는 stdin 설정을 읽는 getter 가 없으므로, 구성 함수가 만든 Command 로 **실제 자식을 띄워** 확인한다(`#[cfg(unix)]`, 바이너리 자리에 `/bin/cat`, 인자 없음). 닫힌 파이프 재현에 `std::io::pipe`(Rust 1.87+)를 쓰지 않는다 — `Cargo.toml` 의 `rust-version = "1.77.2"` 를 올리지 않기 위해서다.

- **Given** `build_codex_command(Path::new("/bin/cat"), &[], tmp)` 와 `build_claude_command(Path::new("/bin/cat"), &[], tmp, model)` 로 만든 Command 각각
- **When** 스폰한 뒤 `child.stdin.take()` 를 표준 입력 쓰기 헬퍼에 넘겨 한글 6,000자 문자열을 쓰고, 헬퍼 스레드가 끝나기를 기다린 뒤 stdout 을 끝까지 읽는다
- **Then** `child.stdin` 이 `Some` 이었고, 읽은 stdout 이 쓴 문자열과 바이트 단위로 같으며, 자식이 정상 종료한다(헬퍼가 핸들을 닫아 EOF 가 전달됨)
- **And** 항상 `Err(BrokenPipe)` 를 반환하는 테스트용 writer 를 헬퍼에 넘기면 헬퍼 스레드가 패닉 없이 끝나고(`join()` 이 `Ok`), 어떤 이벤트도 발행하지 않는다(헬퍼는 `AppHandle` 을 받지 않는다)

### AC-AI13-004 — Rust 대기 한도가 공유 표와 같다 (REQ-AI13-004, 006)

- **Given** `src-tauri/tests/fixtures/ai-timeout-table.json` 의 행들(`input` 문자열 또는 반복 지정, `expectedSecs`)이 0, 2000, 2001, 3000, 6000, 12000, 13001, 20000 과 이모지 행(UTF-16 길이 2,001, 문자 수 2,000 이하)을 포함한다
- **When** 각 행의 실제 문자열에 대해 `encode_utf16().count()` 로 길이를 구해 Rust 대기 한도 함수를 계산한다
- **Then** 모든 행에서 결과가 `expectedSecs` 와 같다: 0→60, 2000→60, 2001→68, 3000→68, 6000→92, 12000→140, 13001→150, 20000→150, 이모지 행→68
- **And** 같은 이모지 문자열의 `chars().count()` 로 계산하면 60 이 나온다(단위가 실제로 갈리는 행임을 테스트가 스스로 확인)

### AC-AI13-005 — TS 대기 한도가 공유 표와 같고 순서가 지켜진다 (REQ-AI13-005, 006, 007)

- **Given** 같은 공유 표
- **When** 각 행 문자열의 `.length` 로 `backendWatchdogTimeoutMs(n)`·`frontendBackstopDelayMs(n)` 를 계산한다
- **Then** `backendWatchdogTimeoutMs(n) === expectedSecs × 1000`, `frontendBackstopDelayMs(n) === expectedSecs × 1000 + 5000`
- **And** 모든 행에서 `WAIT_NOTICE_DELAY_MS(8000) < backendWatchdogTimeoutMs(n) < frontendBackstopDelayMs(n)`

### AC-AI13-006 — 긴 선택 카드의 백스톱 시점 (REQ-AI13-005)

- **Given** 가짜 타이머 환경에서 선택 6,000자 카드가 요청을 보냈고 종결 이벤트는 오지 않는다
- **When** 65,000ms 가 지난다
- **Then** 카드는 아직 `streaming` 이다
- **When** 97,000ms 까지 진행한다
- **Then** 카드는 백스톱 오류(`BACKSTOP_ERROR_TEXT`)로 종결된다
- **And** 같은 카드에서 재요청하면 재요청 시점부터 96,999ms 에는 `streaming`, 97,000ms 에 백스톱 오류다

### AC-AI13-007 — 새 길이 한도 경계값 (REQ-AI13-008, 009)

| 선택 길이 | 다듬기·직접 입력 | 개요·표·다이어그램·짧게 |
|-----------|------------------|-------------------------|
| 6,000 | 허용, `insertOnly: false` | 허용, `insertOnly: false` |
| 6,001 | 비활성, 안내에 "6,001자"·"6,000자" | 허용, `insertOnly: true` |
| 12,000 | 비활성 | 허용, `insertOnly: true` |
| 12,001 | 비활성 | 비활성, 안내에 "12,001자"·"12,000자" |

- **Then** `evaluateSelectionGuard` 결과가 위 표와 같고, 메뉴 상단 안내 줄(`evaluateMenuNotice`)은 6,000자에서 `null`, 6,001자에서 `partial`(문구에 "6,000자"), 12,001자에서 `block` 이다

### AC-AI13-008 — claude 완결 판정 (REQ-AI13-010, 011)

- **Given** M1 에서 캡처한 claude stream-json 출력 원문 fixture: (a) 정상 종료 사례, (b) 잘림 사례(또는 M1 기록대로 만든 잘림 줄 — 만든 경우 fixture 옆 주석에 명시)
- **When** 각 사례의 줄들을 차례로 완결 판정기에 넣는다
- **Then** (a) → `complete`, (b) → `cutoff`, (a)에서 정지 사유가 든 줄을 모두 뺀 사례 → `unknown`
- **And** (b)의 `max_tokens` 줄 뒤에 `end_turn` 줄을 덧붙인 사례도 `cutoff` 다(끈적임)
- **And** `DonePayload` 직렬화 JSON 에 `"completion"` 키가 있고 `requestId`·`result` 는 그대로다(`truncated` 는 false 일 때 생략되는 기존 규칙 유지)

### AC-AI13-009 — codex 완결 값 (REQ-AI13-012)

- **Given** codex 릴레이가 done 을 만드는 두 경로(정상 `turn.completed`, chunk 후 EOF 폴백)
- **When** 릴레이가 done payload 를 조립한다(조립을 순수 함수로 분리해 두 경로가 그 함수를 쓰게 한다)
- **Then** 두 경로 모두 `completion: "unknown"` 이다

### AC-AI13-010 — 정상 경로로 받은 완결 값이 「바꾸기」를 정한다 (REQ-AI13-010, 013)

- **Given** 3,000자 선택에 다듬기를 요청해 `aiStore` 현재 슬롯을 쥔 카드(`useAiRelay` 리스너가 등록되어 있고 Tauri `listen` 은 모의 객체)
- **When** 모의 `ai://done` 이벤트 `{ requestId, result, completion: "unknown" }` 를 발생시킨다(이벤트는 `useAiRelay` → `aiStore.completeRequest` → 카드 스토어 구독 경로로 간다)
- **Then** 「아래에 삽입」만 보이고 「바꾸기」는 없으며, "응답이 끝까지 왔는지 확인할 수 없어 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요" 문구가 보인다
- **When** 같은 조건에서 `completion: "complete"` 로 발생시킨다
- **Then** 「바꾸기」와 「아래에 삽입」이 모두 보이고 기본 강조는 「바꾸기」이며 이유 문구는 없다

### AC-AI13-011 — 라우터 경로에서도 잘림이 「바꾸기」를 막는다 (REQ-AI13-010, 013)

- **Given** 500자 선택 다듬기 카드 A 가 요청 중이고, 다른 카드 B 의 재요청이 `aiStore` 슬롯을 가져가 A 는 라우터 경로로만 이벤트를 받는다
- **When** A 의 requestId 로 `ai://done` `{ completion: "cutoff" }` 가 온다
- **Then** A 에는 「아래에 삽입」만 보이고 "응답이 중간에 끊겨서 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요" 문구가 보인다

### AC-AI13-012 — 회귀 없음과 이유 문구 표시 조건 (REQ-AI13-013, 014, 015)

- **Given** 500자 선택 카드(다듬기 한 번, 표 한 번)
- **When** `completion: "unknown"` 또는 필드가 없는 done 을 받는다
- **Then** 버튼 구성과 기본 강조가 현행과 같다(다듬기: 바꾸기 강조 + 아래에 삽입, 표: 아래에 삽입 강조 + 바꾸기)이고 이유 문구가 없다
- **Given** 7,000자 선택 개요 카드(가드가 이미 `insertOnly: true`)
- **When** `completion: "unknown"` done 을 받는다
- **Then** 「아래에 삽입」만 보이고 D9 이유 문구는 **없다**
- **And** 6,000자 선택으로 조립한 요청의 `args.selection` 은 입력 선택 문자열과 길이·내용이 같다

## 수동 확인

### AC-AI13-013 — macOS 실기기 (REQ-AI13-001~003)

- **Given** 빌드한 앱, 한글 약 6,000자 문단 선택
- **When** claude 로 다듬기, codex 로 다듬기를 각각 실행한다
- **Then** 둘 다 대기 한도 안에 결과 카드가 완료된다
- **And** claude 결과는 M1 에서 정지 사유가 확인된 경우 「바꾸기」가 보이고(확인되지 않았다면 codex 와 같이 삽입 전용 + 이유 문구), codex 결과는 「아래에 삽입」만 보이며 이유 문구가 있다

### AC-AI13-014 — Windows 실기기 (REQ-AI13-001~003)

- **Given** Windows 에서 npm 으로 설치한 `claude.cmd` 또는 `codex.cmd` 를 쓰는 환경, 한글 약 6,000자 선택, 줄바꿈이 든 긴 직접 입력 지시문
- **When** 다듬기와 직접 입력을 각각 실행한다
- **Then** 두 요청 모두 스폰 오류 없이 결과 카드가 완료된다

## 완료 정의

- AC-AI13-001~012 자동 테스트 통과. Rust 쪽은 명령과 출력 원문을 `progress.md` 에 기록.
- `cargo test`·관련 Vitest·`tsc --noEmit`·변경 파일 eslint 통과.
- AC-AI13-013 수행 기록.
- AC-AI13-014 는 수행 결과를 기록하거나, 수행하지 못했으면 "사용자 확인 대기"로 PR 본문과 `progress.md` 에 명시한다. 실패하면 오류 문구를 기록하고 원인(시스템 프롬프트 파일·표준 입력·기타)을 구분해 후속 작업으로 넘긴다.
