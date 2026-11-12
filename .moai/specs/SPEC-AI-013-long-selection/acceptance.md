---
id: SPEC-AI-013
version: "0.1.0"
status: draft
created: 2026-11-13
updated: 2026-11-13
author: jw
---

# SPEC-AI-013 인수 기준

검증 수단: (a) Rust 단위 테스트(`cargo test --manifest-path src-tauri/Cargo.toml`), (b) Vitest 단위·통합 테스트, (c) 실기기 수동 확인. TDD 순서상 AC-001·002·004·005·006·007·010·011 은 현행 코드에서 **반드시 실패**해야 한다(실패하지 않으면 시나리오가 변경을 담지 못한 것).

## 자동 테스트

### AC-AI13-001 — claude 인자에 사용자 프롬프트가 없다 (REQ-AI13-001, 005)

- **Given** 시스템 프롬프트 `"SYS"` 와 고유 표지 문자열 `"선택-표지-7f3a"` 를 담은 사용자 프롬프트가 있다
- **When** claude 인자 목록을 조립한다
- **Then** 어떤 인자도 `"선택-표지-7f3a"` 를 포함하지 않는다
- **And** `-p`, `--system-prompt` 바로 뒤의 `"SYS"`, `--model`, `--output-format stream-json`, `--include-partial-messages`, `--verbose`, `--setting-sources ""`, `--tools ""` 가 모두 있다

### AC-AI13-002 — codex 인자에 결합 프롬프트가 없다 (REQ-AI13-002, 005)

- **Given** 같은 표지 문자열이 든 결합 프롬프트가 있다
- **When** codex 인자 목록을 조립한다
- **Then** 어떤 인자도 표지 문자열을 포함하지 않고, 마지막 인자는 `--json` 이다
- **And** `exec`, `-C <scratch>`, `--ignore-user-config`, `--skip-git-repo-check`, `--ephemeral`, `--sandbox read-only`, `--model`, `-c model_reasoning_effort=...` 가 기존 순서대로 있다

### AC-AI13-003 — 표준 입력 쓰기 (REQ-AI13-003, 004)

- **Given** codex Command 구성 함수와 표준 입력 쓰기 헬퍼가 있다
- **When** Command 를 조립한다
- **Then** stdin 설정이 piped 다(테스트 가능한 방식: 구성 함수 결과 또는 구성 값 노출로 확인)
- **And** 쓰기 헬퍼에 메모리 버퍼를 넘기면 전체 바이트(UTF-8 한글 포함)가 그대로 쓰이고 핸들이 닫힌다
- **And** 이미 닫힌 파이프(읽는 쪽을 먼저 닫은 OS 파이프)에 쓰면 헬퍼는 패닉 없이 반환한다

### AC-AI13-004 — Rust 대기 한도가 공유 표와 같다 (REQ-AI13-006, 008)

- **Given** `src-tauri/tests/fixtures/ai-timeout-table.json` 에 `{ "input": <문자열 또는 길이>, "utf16Len": n, "expectedSecs": s }` 행들이 있고, 최소 0, 2000, 2001, 3000, 6000, 12000, 상한에 처음 닿는 길이, 상한을 넘는 길이, 이모지가 섞인 문자열 행을 포함한다
- **When** 각 행에 대해 Rust 대기 한도 함수를 계산한다(이모지 행은 실제 문자열의 `encode_utf16().count()` 로)
- **Then** 모든 행에서 결과가 `expectedSecs` 와 같다. 예: 0→60, 2000→60, 2001→68, 6000→92, 12000→140, 상한 이후→150

### AC-AI13-005 — TS 대기 한도가 공유 표와 같고 순서가 지켜진다 (REQ-AI13-007, 008, 009)

- **Given** 같은 공유 표
- **When** 각 행에 대해 `backendWatchdogTimeoutMs(n)`·`frontendBackstopDelayMs(n)` 를 계산한다(이모지 행은 실제 문자열의 `.length`)
- **Then** `backendWatchdogTimeoutMs(n) === expectedSecs × 1000`, `frontendBackstopDelayMs(n) === expectedSecs × 1000 + 5000`
- **And** 모든 행에서 `WAIT_NOTICE_DELAY_MS(8000) < backendWatchdogTimeoutMs(n) < frontendBackstopDelayMs(n)`

### AC-AI13-006 — 긴 선택 카드의 백스톱 시점 (REQ-AI13-007)

- **Given** 가짜 타이머 환경에서 선택 6,000자 카드가 요청을 보냈고 종결 이벤트는 오지 않는다
- **When** 65,000ms 가 지난다
- **Then** 카드는 아직 `streaming` 이다
- **When** 97,000ms 까지 진행한다
- **Then** 카드는 백스톱 오류(`BACKSTOP_ERROR_TEXT`)로 종결된다
- **And** 같은 카드에서 재요청하면 백스톱이 같은 선택 길이 기준(97,000ms)으로 다시 걸린다

### AC-AI13-007 — 새 길이 한도 경계값 (REQ-AI13-010, 011, 012)

| 선택 길이 | 다듬기·직접 입력 | 개요·표·다이어그램·짧게 |
|-----------|------------------|-------------------------|
| 6,000 | 허용, `insertOnly: false` | 허용, `insertOnly: false` |
| 6,001 | 비활성, 안내에 "6,001자"·"6,000자" | 허용, `insertOnly: true` |
| 12,000 | 비활성 | 허용, `insertOnly: true` |
| 12,001 | 비활성 | 비활성, 안내에 "12,001자"·"12,000자" |

- **Then** 위 표와 같고, 메뉴 상단 안내 줄(`evaluateMenuNotice`)도 6,001자에서 `partial`, 12,001자에서 `block` 이다

### AC-AI13-008 — claude 완결 판정 (REQ-AI13-013, 014)

- **Given** M1 에서 캡처한 claude stream-json 출력 원문 fixture(정상 종료 사례, 그리고 잘림 사례 또는 M1 기록대로 만든 잘림 줄)
- **When** 줄들을 차례로 정지 사유 파서에 넣고 완결 값을 정한다
- **Then** 정상 종료 사례 → `complete`, 잘림 사례 → `cutoff`, 정지 사유가 든 줄을 뺀 사례 → `unknown`
- **And** `DonePayload` 직렬화 결과 JSON 에 `"completion"` 키가 있고 기존 `requestId`·`result` 는 그대로다(`truncated` 는 false 일 때 생략되는 기존 규칙 유지)

### AC-AI13-009 — codex 완결 값 (REQ-AI13-015)

- **Given** codex 릴레이가 done 을 만드는 경로(정상 `turn.completed`, EOF 폴백)
- **Then** 두 경로 모두 `completion: "unknown"` 이다(릴레이의 done payload 조립 함수를 순수 함수로 분리해 테스트하거나, 조립 지점의 상수 값을 테스트한다)

### AC-AI13-010 — 2,000자 초과 선택의 「바꾸기」 판정 (REQ-AI13-016, 018)

- **Given** 3,000자 선택에 다듬기를 요청한 카드
- **When** `completion: "unknown"` 인 done 을 받는다
- **Then** 「아래에 삽입」만 보이고 「바꾸기」는 없다
- **And** "응답이 끝까지 왔는지 확인할 수 없어 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요" 문구가 보인다
- **When** 같은 조건에서 `completion: "complete"` 를 받는다
- **Then** 「바꾸기」와 「아래에 삽입」이 모두 보이고 기본 강조는 「바꾸기」다

### AC-AI13-011 — 잘림 확인 시 「바꾸기」 차단 (REQ-AI13-017, 018)

- **Given** 500자 선택에 다듬기를 요청한 카드
- **When** `completion: "cutoff"` 인 done 을 받는다
- **Then** 「아래에 삽입」만 보이고 "응답이 중간에 끊겨서 원문이 지워지지 않도록 「아래에 삽입」만 할 수 있어요" 문구가 보인다

### AC-AI13-012 — 2,000자 이하 회귀 없음 (REQ-AI13-019, 020)

- **Given** 500자 선택 카드(다듬기 한 번, 표 한 번)
- **When** `completion: "unknown"` 또는 필드가 없는 done 을 받는다
- **Then** 버튼 구성과 기본 강조가 현행과 같다(다듬기: 바꾸기 강조 + 아래에 삽입, 표: 아래에 삽입 강조 + 바꾸기)
- **And** 요청 조립 결과 `args.selection` 은 입력 선택 문자열과 같다(6,000자 선택에서도 길이·내용 동일)

## 수동 확인

### AC-AI13-013 — macOS 실기기 (REQ-AI13-001~004)

- **Given** 빌드한 앱, 한글 약 6,000자 문단 선택
- **When** claude 로 다듬기, codex 로 다듬기를 각각 실행한다
- **Then** 둘 다 대기 한도 안에 결과 카드가 완료된다
- **And** claude 결과는 (M1 에서 정지 사유가 확인되었다면) 「바꾸기」가 보이고, codex 결과는 「아래에 삽입」만 보이며 이유 문구가 있다

### AC-AI13-014 — Windows 실기기 (REQ-AI13-001~004)

- **Given** Windows 에서 npm 으로 설치한 `claude.cmd` 또는 `codex.cmd` 를 쓰는 환경, 한글 약 6,000자 선택
- **When** 다듬기를 실행한다
- **Then** 스폰 실패 없이 결과 카드가 완료된다
- **And** 실패하면 오류 문구와 함께 결과를 기록하고, `--system-prompt` 인자 문제인지 표준 입력 문제인지 구분해 후속 작업으로 넘긴다

## 완료 정의

- AC-AI13-001~012 자동 테스트 통과(명령과 출력 원문을 `progress.md` 에 기록)
- `cargo test`·관련 Vitest·`tsc --noEmit`·변경 파일 eslint 통과
- AC-AI13-013 수행 기록, AC-AI13-014 는 수행 또는 사용자 확인 대기로 명시
