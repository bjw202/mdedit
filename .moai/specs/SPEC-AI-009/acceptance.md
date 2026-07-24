---
id: SPEC-AI-009
version: "0.0.2"
status: draft
created: "2026-07-24"
updated: "2026-07-24"
author: "jw"
priority: high
issue_number: 0
dependencies:
  - SPEC-AI-001
  - SPEC-AI-003
  - SPEC-AI-006
  - SPEC-AI-008
tags:
  - ai
  - provider
  - codex
  - cli
  - integration
  - acceptance
lifecycle: spec-anchored
---

# SPEC-AI-009 Acceptance Criteria — codex CLI 두 번째 AI 프로바이더 통합

> 본 문서는 spec.md의 AC-AI9-001~014를 Given-When-Then 형식으로 전개한다. 각 AC는 매핑된 REQ-AI9-XXX를 검증한다. 테스트 전략은 (a) Rust `#[cfg(test)]` 단위 테스트(순수 함수 중심)와 (b) 로컬 수동 통합 테스트(실제 codex CLI 의존)로 이원화.

## 테스트 환경

### 자동화(Rust 단위 테스트)

- **실행 명령**: `cargo test --lib ai::`(또는 `cargo test`)
- **위치**: `src-tauri/src/ai/codex_cli.rs`, `stream.rs`, `detect.rs`, `provider.rs`(또는 `claude_cli.rs`)의 `#[cfg(test)]` 모듈
- **커버리지 범위**: 순수 함수(build_codex_args, combine_prompts, parse_codex_*, resolve_codex_binary, is_codex_logged_in, codex_binary_candidates) + 레지스트리 통합(default_registry, first_available, route) + 회귀 가드 스냅샷(build_claude_args, parse_text_delta, parse_final_result, prompt.rs 조립)

### 수동(통합 테스트)

- **사전 조건**: macOS/Linux/Windows 중 1개 환경에 `codex` CLI 0.144.1 이상 설치 + `~/.codex/auth.json` 존재(로그인 됨).
- **실행**: `cargo tauri dev`로 mdedit 실행 → AI 요청 트리거(섹션 채우기/이어쓰기/다이어그램 등).
- **검증 도구**: 브라우저 DevTools(`tauri::Event` 수신 확인), `ps aux | grep codex`(프로세스 스폰 확인), 임시 디렉토리 cwd 확인.

## Acceptance Criteria (Given-When-Then)

### AC-AI9-001 — ProviderRegistry 2개 등록 + 자동 감지 첫 provider 선택

**매핑**: REQ-AI9-001, REQ-AI9-002, REQ-AI9-003

**Given** `default_registry()`가 초기화된 상태에서

**When** `registry.ids()`를 호출하면

**Then** 반환값이 정확히 `["claude", "codex"]`이다(순서 보존). `registry.len() == 2`.

**Given** `claude`가 설치+로그인된 환경(MockProvider `installed=true, logged_in=true` 2개로 시뮬레이션)에서

**When** `first_available()`를 호출하면

**Then** 반환 provider의 `id()`가 `"claude"`이다(우선순위 계약, REQ-AI9-002).

**Given** `claude`가 미설치(MockProvider `installed=false`)이고 `codex`만 `installed=true, logged_in=true`인 환경에서

**When** `first_available()`를 호출하면

**Then** 반환 provider의 `id()`가 `"codex"`이다.

**Given** 두 provider 모두 미사용 가능(installed=false 또는 logged_in=false)인 환경에서

**When** `first_available()`를 호출하면

**Then** 반환값이 `None`이다. `route(None)` 호출 시 `mod.rs:174-175`의 기존 "사용 가능한 AI 도구가 없어요" 오류로 이어진다.

**Given** `providerId="codex"`가 명시된 요청이 들어오면

**When** `route(Some("codex"))`를 호출하면

**Then** 반환 provider의 `id()`가 `"codex"`이다(수동 오버라이드).

**Given** 존재하지 않는 `providerId="unknown"`이 명시된 요청이 들어오면

**When** `route(Some("unknown"))`를 호출하면

**Then** 반환값이 `None`이다(기존 오류 메시지 재사용, 새 오류 메시지 금지).

---

### AC-AI9-002 — 자동 감지 우선순위: codex가 claude 설치 환경에서 기본이 되지 않음

**매핑**: REQ-AI9-001, REQ-AI9-025

**Given** `claude`와 `codex` 양쪽 다 설치+로그인된 환경에서

**When** `route(None)`(providerId 생략)을 호출하면

**Then** 반환 provider의 `id()`가 반드시 `"claude"`이다(codex가 폴백 기본이 되지 않음, REQ-AI9-025).

**Given** 레지스트리에 codex가 ClaudeProvider보다 먼저 등록된 상태라도(claude_cli.rs의 등록 순서가 바뀌는 실수가 발생해도)

**When** `first_available()`이 실행되면

**Then** 설치+로그인된 provider 중 **등록 순서상 첫 번째**를 선택한다. 단, M5.1 구현이 `vec![Claude, Codex]` 순서를 강제하므로 이 케이스는 방어적 어서션으로만 둔다(우선순위 테스트와 별개).

---

### AC-AI9-003 — build_codex_args 인자 순서·값·매핑

**매핑**: REQ-AI9-004, REQ-AI9-018

**Given** `AiModel::Haiku`와 `combined_prompt = "system\n\nuser"`를 `build_codex_args`에 전달하면

**When** 반환 `Vec<String>`을 검증하면

**Then** 정확히 다음 순서의 14개 인자를 포함한다:
```
["exec", "-C", "<scratch>", "--ignore-user-config", "--skip-git-repo-check",
 "--ephemeral", "--sandbox", "read-only", "--model", "gpt-5.5",
 "-c", "model_reasoning_effort=\"medium\"", "--json", "system\n\nuser"]
```
마지막 원소가 `combined_prompt`와 바이트 동일.

**Given** `AiModel::Sonnet`을 전달해도

**When** 동일 함수를 호출하면

**Then** `--model` 값이 여전히 `"gpt-5.5"`이다(v1 매핑, Haiku/Sonnet 동일).

**Given** 임의의 `AiModel`과 `combined_prompt`에 대해

**When** 산출 벡터에서 개별 플래그를 찾으면

**Then** 다음이 반드시 존재한다: `--ignore-user-config`(REQ-AI9-004 격리), `--sandbox read-only`(샌드박스), `--ephemeral`(임시 세션), `--skip-git-repo-check`(git 검사 우회), `--json`(JSONL 출력), `-c model_reasoning_effort="medium"`(추론 노력). 어느 하나라도 누락되면 테스트 실패.

---

### AC-AI9-004 — system+user 결합이 단일 positional 인자로

**매핑**: REQ-AI9-005

**Given** `system_prompt = "SYS"`와 `user_prompt = "USER"`를 `combine_prompts`에 전달하면

**When** 반환 문자열을 검증하면

**Then** 정확히 `"SYS\n\nUSER"`이다(빈 문자열 과잉 없음).

**Given** `system_prompt = ""`, `user_prompt = "USER"`이면

**When** 결합 결과는

**Then** `"\n\nUSER"`이다(경계 케이스).

**Given** 결합된 문자열을 `build_codex_args(Haiku, combined)`의 마지막 인자로 전달하면

**When** 산출 벡터의 마지막 원소를 검증하면

**Then** 결합 문자열과 바이트 동일(positional 1개 전달 계약).

---

### AC-AI9-005 — spawn_codex 격리 설정 (stdin null, 절대경로, 빈 cwd, CODEX_HOME 미설정, 호출 순서)

**매핑**: REQ-AI9-006, REQ-AI9-007, **REQ-AI9-007a**(D3 호출 순서), REQ-AI9-008

**Given** `spawn_codex` 함수가 컴파일 포함된 상태에서

**When** 함수 시그니처와 내부 `Command` 구성을 코드 검토/테스트로 검증하면

**Then** 다음이 모두 참이다:
1. `.stdin(Stdio::null())` 호출이 존재(REQ-AI9-006, 안 하면 codex가 stdin 읽기 시도).
2. `.stdout(Stdio::piped())`와 `.stderr(Stdio::piped())`가 모두 설정.
3. `process_util::no_window(&mut cmd)`가 호출(Windows 콘솔 차단).
4. `.current_dir(cwd)`가 빈 스크래치 디렉토리를 가리킴(`ensure_scratch_dir` 결과).
5. `Command::new(&binary)`의 `binary`가 `detect::codex_binary()`의 절대경로 반환값(bare "codex" 아님).

**Given** `CodexProvider::spawn(request, cwd)`를 호출하면(REQ-AI9-007a)

**When** 내부 호출 시퀀스를 추적하면(mock 주입 또는 코드 검토)

**Then** 정확히 다음 순서로 실행된다: (1) `combine_prompts(request.system_prompt, request.user_prompt)`, (2) `build_codex_args(request.model, &combined)`, (3) `spawn_codex(&args, cwd)`. 어떤 단계도 건너뛰지 않으며, 순서도 바뀌지 않는다.

**Given** `codex_cli.rs` 전체와 `mod.rs`의 `ai_request`를 grep하면

**When** `CODEX_HOME` 문자열을 검색하면

**Then** 코드 베이스에 `CODEX_HOME` 환경변수 설정 코드가 존재하지 않는다(REQ-AI9-008, 인증 풀림 방지).

**수동 통합 테스트**(M7.3 보조):
**Given** codex가 설치된 환경에서 mdedit으로 AI 요청을 트리거하면

**When** `ps aux | grep codex`로 스폰된 프로세스를 확인하면

**Then** 명령어 인자에 `-C <빈 스크래치 경로>`와 `--ignore-user-config`, `--sandbox read-only`가 포함되어 있고, 환경 변수에 `CODEX_HOME`이 설정되어 있지 않다.

---

### AC-AI9-006 — codex JSONL 파서 (agent_message 추출, turn.completed 감지)

**매핑**: REQ-AI9-009, REQ-AI9-010

**Given** 정상적인 codex `item.completed` 라인(예: `{"type":"event","event":{"type":"item.completed","item":{"type":"agent_message","text":"AI 완성 본문"}}}`)을

**When** `parse_codex_agent_message(line)`에 전달하면

**Then** 반환값이 `Some("AI 완성 본문")`이다.

**Given** `thread.started` 라인, `turn.started` 라인, `turn.completed` 라인, `item.type`이 `agent_message`가 아닌 `item.completed`(예: `reasoning`) 라인을 각각

**When** `parse_codex_agent_message`에 전달하면

**Then** 모두 `None`을 반환한다(panic 없음).

**Given** 비정형 JSON(`}{`), 빈 문자열, 일반 텍스트(`"plain log"`), `null`, `[]`를

**When** `parse_codex_agent_message`에 전달하면

**Then** 모두 `None`을 반환한다(panic 없음, raw JSON 노출 없음).

**Given** 정상 `turn.completed` 라인(예: `{"type":"event","event":{"type":"turn.completed","usage":{...}}}`)을

**When** `parse_codex_turn_completed(line)`에 전달하면

**Then** 반환값이 `true`이다.

**Given** 다른 이벤트 라인(`thread.started`, `item.completed` 등)과 비정형 라인을

**When** `parse_codex_turn_completed`에 전달하면

**Then** 모두 `false`를 반환한다(panic 없음).

---

### AC-AI9-007 — 릴레이 emit 순서 (chunk 1회 → done)

**매핑**: REQ-AI9-011, REQ-AI9-012, **REQ-AI9-013a**(D2 — chunk 1회 emit 후 turn.completed 누락 EOF 시나리오)

**Given** codex 릴레이 스레드가 `parse_codex_agent_message`가 `Some("본문")`을 반환하는 stdout 라인을 수신하면

**When** 해당 라인 처리를 완료할 때

**Then** `ai://chunk` 이벤트가 정확히 **1회** emit된다. payload는 `{requestId, text: "본문"}`이다. 본문이 긴 경우에도 청킹하지 않고 통째로 1회 emit(토큰 분할 금지).

**Given** codex 릴레이가 이어서 `parse_codex_turn_completed`가 `true`인 라인을 수신하면

**When** 해당 라인 처리를 완료할 때

**Then** `ai://done` 이벤트가 정확히 1회 emit된다. payload는 `{requestId, result: "본문"(마지막 agent_message), truncated: <assemble.truncated 값>}`이다. `truncated`는 기존 prompt.rs 조립 결과의 truncated 필드 값을 그대로 전달.

**Given** `ai://chunk` emit이 1회 발생한 이후 `turn.completed` 라인이 수신되지 않은 채 stdout이 EOF하면(REQ-AI9-013a 시나리오)

**When** 릴레이가 종료 처리를 수행하면

**Then** 마지막으로 수신한 `agent_message` 본문을 `result`로 하는 `ai://done` payload(`{requestId, result, truncated}`)이 발행된다. 이미 사용자에게 본문이 전달된 상태이므로 `parse` 폴백(REQ-AI9-013)이 아닌 정상 종료(`RelayOutcome::Done`)로 처리된다. `claim_terminal` 단일 발행 선점(SPEC-AI-006 REQ-AI6-006)을 통해 정확히 한 주체만 `ai://done`을 emit한다(chunk 1회 + done 1회, 정상 종료).

**수동 통합 테스트**(M7.3):
**Given** 실제 codex CLI로 AI 요청을 트리거하면

**When** 브라우저 DevTools로 `tauri::Event`를 모니터링하면

**Then** 이벤트 순서가 `ai://chunk`(1회) → `ai://done`(1회)이다. `ai://chunk`가 2회 이상 emit되지 않는다(codex는 토큰 스트리밍이 아닌 완성본 1회 도착).

---

### AC-AI9-008 — 비정상 종료 시 decide_outcome 폴백 + classify_stderr 재사용

**매핑**: REQ-AI9-013, REQ-AI9-014

**Given** codex stdout이 `agent_message`도 `turn.completed`도 없이 바로 EOF하거나, 비정형 JSON 라인만 출력하고 종료되면

**When** 릴레이가 `decide_outcome(None, stderr, cancelled, saw_stream_output)`을 호출하면

**Then** `saw_stream_output=true`(JSON 라인이 하나라도 왔으면)이고 `final_result=None`이면 `RelayOutcome::Error("parse", friendly_message)`로 `ai://error{kind:"parse"}`가 발행된다(기존 claude_cli.rs:145-165 경로 재사용).

**Given** codex가 stderr에 인증 오류 메시지(예: `"401 unauthorized"`, `"token expired"`)를 출력하면

**When** `classify_stderr(stderr)`를 호출하면

**Then** 반환값이 `StderrKind::LoginExpired`이고, `as_key()`가 `"login"`이다. codex 전용 분류 로직·새 marker 상수는 코드 베이스에 존재하지 않는다(기존 `classify_stderr` stream.rs:78-126 재사용).

**Given** codex가 stderr에 네트워크 오류(예: `"connect ETIMEDOUT"`)를 출력하면

**When** 동일하게 `classify_stderr`를 호출하면

**Then** 반환값이 `StderrKind::Network`이고, `as_key()`가 `"network"`이다.

**Given** `src-tauri/src/ai/` 디렉토리를 grep하면

**When** `parse_codex_stderr` 또는 `classify_codex_stderr` 문자열을 검색하면

**Then** codex 전용 stderr 파서가 존재하지 않는다(REQ-AI9-014, 중복 금지).

---

### AC-AI9-009 — resolve_codex_binary 후보 순서 + 미설치 안전

**매핑**: REQ-AI9-015

**Given** macOS 환경(`is_windows=false`)에서 `path_dirs = ["/usr/bin", "/bin"]`, `home = "/Users/jw"`를

**When** `codex_binary_candidates(&path_dirs, &home, false)`를 호출하면

**Then** 산출 벡터가 다음을 순서대로 포함한다:
- `/usr/bin/codex`
- `/bin/codex`
- `/Users/jw/.local/bin/codex`
- `/opt/homebrew/bin/codex`
- `/usr/local/bin/codex`

**Given** Windows 환경(`is_windows=true`)에서 `path_dirs = ["C:/Windows"]`, `home = "C:/Users/jw"`를

**When** `codex_binary_candidates(&path_dirs, &home, true)`를 호출하면

**Then** 산출 벡터가 다음을 포함한다:
- `C:/Windows/codex.exe`
- `C:/Users/jw/.local/bin/codex.exe`
- `C:/Users/jw/AppData/Roaming/npm/codex.cmd`

**Given** 어떤 후보도 존재하지 않는 환경(임시 디렉토리 등)에서

**When** `resolve_codex_binary()`를 호출하면

**Then** 반환값이 `None`이다(panic 없음).

**Given** 단위 테스트용 임시 디렉토리에 `codex` 실행 파일을 수동 생성하고(`std::fs::write(&path, "#!/bin/sh\n")`)

**When** `resolve_from_candidates`로 해당 경로를 찾으면

**Then** 반환값이 `Some(해당 경로)`이다(detect.rs:539-555 `reproduces_gui_path_finds_local_bin` 패턴 차용).

**Given** `codex_binary()`를 최초 호출해 `Some(path)`를 얻은 뒤

**When** 두 번째 호출하면

**OnceLock** 캐시로 동일 경로가 반환된다(detect.rs:251-258 `claude_binary`와 대칭).

---

### AC-AI9-010 — codex 로그인 판정 + detect_codex 안전성

**매핑**: REQ-AI9-016, REQ-AI9-017

**Given** 임시 home 디렉토리에 `.codex/auth.json` 파일을 생성하면

**When** `is_codex_logged_in(&home)`를 호출하면

**Then** 반환값이 `true`이다.

**Given** `.codex/auth.json` 파일이 없는 임시 home 디렉토리에서

**When** `is_codex_logged_in(&home)`를 호출하면

**Then** 반환값이 `false`이다(panic 없음).

**Given** `codex`가 실제로 설치되지 않은 환경(또는 단위 테스트용 mock)에서

**When** `detect_codex()`를 호출하면

**Then** 반환 `ProviderStatus`가 다음을 만족한다:
- `id == "codex"`
- `installed == false`
- `version == None`
- `logged_in == false`

**Given** `codex --version`이 성공적으로 버전 문자열을 반환하는 환경에서

**When** `detect_codex()`를 호출하면

**Then** 반환 `ProviderStatus`가 다음을 만족한다:
- `id == "codex"`
- `installed == true`
- `version == Some(<파싱된 버전>)`(예: `"0.144.1"`)
- `logged_in == installed && is_codex_logged_in(home)` 결과

**Given** `detect_codex()`가 어떤 환경에서든

**When** 호출되면

**Then** panic 없이 `ProviderStatus`를 반환한다(미설치 환경에서도).

---

### AC-AI9-011 — 모델 매핑 + AiModel 무변경 + 프론트 UI 무변경

**매핑**: REQ-AI9-018, REQ-AI9-019, REQ-AI9-020

**Given** `build_codex_args(AiModel::Haiku, "prompt")`의 산출 벡터에서

**When** `--model` 인덱스의 다음 원소를 확인하면

**Then** 값이 `"gpt-5.5"`이다.

**Given** `build_codex_args(AiModel::Sonnet, "prompt")`에 대해서도

**When** 동일 검증을 수행하면

**Then** 값이 `"gpt-5.5"`이다(v1 일단 동일 매핑).

**Given** `src-tauri/src/ai/provider.rs`의 `AiModel` enum 정의를 검토하면

**When** variant를 확인하면

**Then** 기존 `Haiku`/`Sonnet` 2개만 존재한다(신규 variant 추가 없음, 이름 변경 없음).

**Given** 본 SPEC 구현 PR의 diff를 검토하면

**When** `src/components/` 디렉토리의 변경 파일을 확인하면

**Then** 변경 파일이 0건이다(프론트엔드 무변경, provider 선택 UI·상태 표시 신규 컴포넌트 도입 없음).

**Given** 본 SPEC 구현 PR의 diff에서 `src/lib/tauri/ipc.ts`를 검토하면

**When** `AiRequestArgs` 타입 정의를 확인하면

**Then** 신규 필드가 없다(`providerId?`만 기존에 존재).

---

### AC-AI9-012 — IPC 계약·이벤트 payload 스키마 무변경

**매핑**: REQ-AI9-021

**Given** `src-tauri/src/ai/mod.rs`의 `AiRequestArgs` 구조체 정의를 검토하면

**When** 필드를 나열하면

**Then** 기존 필드(`request_id`, `provider_id`, `feature`, `preset_kind`, `model`, `selection`, `context_before`, `context_after`, `outline`, `custom_instruction`, `length`, `diagram_type`)만 존재한다(신규 필드 추가 없음).

**Given** codex 경로를 통한 요청-응답 사이클에서

**When** emit되는 `ai://chunk`/`ai://done`/`ai://error` 이벤트를 모니터링하면

**Then** payload가 기존 스키마를 그대로 따른다:
- `ai://chunk`: `{requestId, text}`(ChunkPayload, claude_cli.rs:27-32).
- `ai://done`: `{requestId, result, truncated?}`(DonePayload, claude_cli.rs:35-42).
- `ai://error`: `{requestId, kind, message, cancelledBy?}`(ErrorPayload, claude_cli.rs:46-54).

`kind`는 기존 `"login"|"network"|"parse"|"other"|"timeout"` 집합에 머문다(codex 전용 kind 신설 없음).

---

### AC-AI9-013 — claude 빌드·파싱 회귀 가드 (바이트 동등)

**매핑**: REQ-AI9-022, REQ-AI9-023

**Given** 본 SPEC 구현 PR이 머지된 상태에서

**When** `build_claude_args(AiModel::Haiku, "sys", "user")`를 호출하면

**Then** 반환 `Vec<String>`이 main 브랜치 기준선 스냅샷과 바이트 단위로 동일하다.

**Given** 동일하게 `build_claude_args(AiModel::Sonnet, "다른 sys", "다른 user")`에 대해

**When** 산출을 비교하면

**Then** main 기준선과 바이트 동등.

**Given** `parse_text_delta` 단위 테스트(stream.rs:134-170)의 전체 입력 케이스에 대해

**When** 본 SPEC 구현 후 동일 입력을 전달하면

**Then** 반환값이 기존과 동일하다(회귀 없음).

**Given** `parse_final_result` 단위 테스트(stream.rs:174-197)의 전체 입력 케이스에 대해

**When** 동일하게 검증하면

**Then** 반환값이 기존과 동일하다.

**Given** `classify_stderr` 단위 테스트(stream.rs:201-258)의 전체 입력 케이스에 대해

**When** 동일하게 검증하면

**Then** 반환 `StderrKind`가 기존과 동일하다(REQ-AI9-014 — codex가 reuse하므로 변형 금지).

---

### AC-AI9-014 — prompt.rs 조립 회귀 가드 (비-diagram 5기능 + diagram + section + continue)

**매핑**: REQ-AI9-024

**Given** 본 SPEC 구현 후 `prompt.rs`의 `build_inline_prompt`/`build_section_prompt`/`build_continue_prompt_with_length`를 기존과 동일 입력으로 호출하면

**When** 각 분기의 산출 `(system_prompt, user_prompt)`를 비교하면

**Then** main 브랜치 기준선과 바이트 단위로 동일하다. 특히 다음 분기 전부:
- `AiFeature::Polish` / `Outline` / `Table` / `Shorten` / `Custom`(비-diagram 5기능)
- `AiFeature::Diagram`(`diagram_type=None` 및 7종 키 각각)
- `AiFeature::FillSection`
- `AiFeature::Continue`(`length=short|normal`, `after` 유무 각각)

**Given** SPEC-AI-008 AC-AI-008-014 회귀 테스트(비-diagram 5기능 바이트 동등)가 이미 존재하면

**When** 본 SPEC 구현 후 해당 테스트를 실행하면

**Then** 전수 통과(SPEC-AI-008 계약 보존).

**Given** 본 SPEC 구현 PR의 diff에서 `src-tauri/src/ai/prompt.rs`를 확인하면

**When** 수정 라인을 검토하면

**Then** 변경 라인이 0건이다(또는 주석/공백만). prompt.rs는 신규 분기·신규 매핑·신규 조각을 추가하지 않는다(codex는 system+user 결합만 소비, REQ-AI9-005).

---

### AC-AI9-015 — AGENTS.md 자동 로딩 차단 검증 (수동 통합, 보안)

**매핑**: REQ-AI9-004, REQ-AI9-008(D4 — 격리 플래그가 사용자 홈 컨텍스트 오염을 방어하는지 확인)

> **자동화 제약**: 본 AC는 사용자 홈 디렉토리의 `~/.codex/AGENTS.md` 존재 여부에 의존하므로 CI 단위 테스트로 자동화하기 어렵다. M7 통합 검증 단계에서 수동으로 수행한다.

**사전 조건**: 테스트용 기기에 다음 두 환경을 교대로 구성한다.
- 환경 A(오염 원 없음): `~/.codex/AGENTS.md` 미존재, 글로벌 스킬 미설치.
- 환경 B(오염 원 존재): `~/.codex/AGENTS.md`에 긴 지시문(예: 500줄 이상의 임의 지시) 작성, 가능 시 글로벌 스킬도 추가.

**Given** 환경 B(`~/.codex/AGENTS.md` 존재)에서

**When** mdedit으로 동일한 AI 요청(예: "짧은 문단 다듬기", selection="...")을 3회 반복 실행하면

**Then** 다음이 모두 참이다:
1. AI 응답 **내용**이 환경 A(오염 원 없음)에서의 응답과 본질적으로 동일한 범위에 머무른다 — `AGENTS.md`의 지시문이 반영되지 않는다(예: 응답에 `AGENTS.md`에만 존재하는 특정 키워드·포맷·지시가 나타나지 않음).
2. codex CLI의 `usage.input_tokens`(codex `--json`의 `turn.completed` 이벤트에 포함)이 환경 A와 비교해 **폭발하지 않는다**(실측 사례: 32K 토큰 폭발). 환경 B가 환경 A 대비 token 수가 수배 이상 증가하면 FAIL.
3. `build_codex_args` 산출 인자에 `--ignore-user-config`가 반드시 포함된다(REQ-AI9-004 단위 테스트로 1차 검증, 본 AC는 실제 효과를 통합 검증).

**Given** 환경 B에서 `--ignore-user-config` 플래그가 빠진 채로 스폰되는 버그가 회귀하면(방어적 시나리오)

**When** 동일 요청을 실행하면

**Then** `usage.input_tokens`가 환경 A 대비 급증(수배 이상)하고 응답이 `AGENTS.md` 지시문의 영향을 받는다. 이 경우 테스트 FAIL로 간주해 `--ignore-user-config` 누락 회귀를 즉시 포착.

**완화 조치(실패 시)**: 환경 B에서 본 AC가 FAIL하면 `build_codex_args`의 `--ignore-user-config` 플래그 재확인 + 빈 cwd(`-C <scratch>`) 검증. 사용자 기기 파일 자체를 통제할 수 없으므로 본 AC는 완전 차단이 아닌 1차 방어선 검증임을 명시.

---

## Edge Cases (Additional Coverage)

> AC-AI9-001~014 외에 추가로 검증해야 할 경계 케이스.

### EC-1 — codex `agent_message` 본문이 매우 긴 경우

**Given** codex가 수천 자의 `agent_message.text`를 1회 반환하면

**When** `parse_codex_agent_message`가 추출해 emit하면

**Then** `ai://chunk` 1회로 통째로 전달(청킹 금지). 프론트의 기존 고스트 텍스트 렌더링이 긴 문자열을 처리 가능(이미 claude 스트리밍에서 검증됨).

### EC-2 — `item.completed`가 순서 없이 여러 번 도착하는 경우

**Given** codex가 `item.completed(agent_message)`를 여러 번 emit하는 예외 케이스(실측과 다르지만 방어)가 발생하면

**When** 릴레이가 각 라인을 처리하면

**Then** 각 라인마다 `ai://chunk` 1회씩 emit(총 N회). 마지막 `agent_message`가 `turn.completed` 시점의 `result`로 사용. `claim_terminal` 단일 발행은 유지.

### EC-3 — codex 프로세스 스폰 실패

**Given** `codex_binary()`가 `None`(미설치)인데 `spawn_codex`가 호출되면(논리적으로 발생하지 않아야 하지만 방어)

**When** 스폰을 시도하면

**Then** `Err("codex 실행 파일을 찾지 못했어요.")` 반환(claude_cli.rs:172-173과 대칭). `ai://error{kind:"other"}`로 연결.

### EC-4 — 워치독 타임아웃과 codex 릴레이의 단일 발행 경합

**Given** codex 요청이 `WATCHDOG_TIMEOUT_SECS`(mod.rs:261)를 초과해 지연되면

**When** 워치독 스레드가 `claim_terminal`을 선점하면

**Then** `ai://error{kind:"timeout"}`이 발행되고, codex 릴레이의 `turn.completed` 처리는 `claim_terminal` 실패로 무발행(SPEC-AI-006 REQ-AI6-006 계약 codex에 동일 적용).

### EC-5 — 동시 요청 교체가 codex 진행 중 발생

**Given** codex 요청이 진행 중일 때 새 요청이 들어오면

**When** `mod.rs:186-210`의 in-flight 교체 로직이 실행되면

**Then** 기존 codex 자식 프로세스가 kill되고, `claim_terminal`이 교체 요청에 의해 선점되어 구 요청에 `ai://error{kind:"other", cancelledBy:"new-request"}`가 발행된다.

### EC-6 — codex 로그인은 됐으나 네트워크 오류

**Given** `is_codex_logged_in`은 `true`이지만 실제 요청 시 네트워크 차단

**When** codex가 stderr에 `"connect ETIMEDOUT"`을 출력하며 종료

**Then** `classify_stderr`가 `Network`로 분류하고, `ai://error{kind:"network", message:"네트워크에 연결할 수 없어요..."}`가 발행(claude와 동일 사용자 경험).

### EC-7 — codex 토큰 만료(로그인은 됐으나 실제 호출 시 401)

**Given** `auth.json`은 존재하지만 토큰이 만료된 상태

**When** codex 호출 시 stderr에 `"401 unauthorized"` 출력

**Then** `classify_stderr`가 `LoginExpired`로 분류하고, `ai://error{kind:"login", message:"로그인이 풀렸어요..."}` 발행. v1의 `is_codex_logged_in`이 토큰 만료를 선제 감지하지 못하므로 사용자가 첫 요청에서야 발견(Design Notes에 문서화된 한계).

---

## Definition of Done

> 아래 전부 충족 시 본 SPEC 구현이 완료된 것으로 간주한다.

### 코드 품질 게이트

- [ ] `cargo test` 전수 통과(신규 codex 단위 테스트 + 기존 claude/prompt.rs 회귀 가드).
- [ ] `cargo clippy` 무경고.
- [ ] `cargo build --release` 성공.
- [ ] `cargo fmt --check` 클린(포맷팅).
- [ ] `src-tauri/Cargo.toml` dependencies 무변경(신규 크레이트 금지).

### SPEC 요구사항 커버리지

- [ ] REQ-AI9-001~025 + 007a + 013a 전수 구현 및 매핑된 AC-AI9-001~015 전수 통과(14 자동 + 1 수동).
- [ ] "사전 합의 설계 결정(재검토 금지)" 4가지가 코드에 정확히 반영(provider 자동 감지 / 모델 매핑 / system+user 결합 / chunk 1회 emit).
- [ ] Exclusions 전 항목 준수(CODEX_HOME 미사용, AiModel 무변경, 신규 IPC 필드 없음, prompt.rs 무변경 등).
- [ ] D1~D6 감사 피드백 개정 사항 반영(Unwanted REQ 8건 If/then 구조화, REQ-AI9-013a/007a 신규 추가, Delta 표 claude_cli.rs #[cfg(test)] 행 추가, AGENTS.md 차단 수동 AC 추가, build_codex_command 추출 힌트).

### 회귀 보장

- [ ] SPEC-AI-001 기존 AC 전수 통과(claude 경로 무변경).
- [ ] SPEC-AI-003/006/008의 prompt.rs 관련 AC 통과(바이트 동등).
- [ ] SPEC-AI-006 `claim_terminal` 단일 발행 계약이 codex 경로에도 유효.

### 통합 검증

- [ ] M7.3(실제 codex CLI 통합 테스트) 수동 통과.
- [ ] M7.4(claude+codex 미설치 환경 폴백) 수동 통과.
- [ ] M7.5(claude 설치 환경 자동 감지 claude 우선) 수동 통과.
- [ ] M7.6(취소·단일 발행) 수동 통과.
- [ ] **M7.7(AC-AI9-015 — `~/.codex/AGENTS.md` 자동 로딩 차단 검증) 수동 통과**.

### 문서화

- [ ] SPEC 디렉토리(`.moai/specs/SPEC-AI-009/`)에 spec.md, plan.md, acceptance.md 3개 파일 존재.
- [ ] PR 본문에 SPEC-ID 참조 및 주요 변경 사항 요약.
- [ ] `@MX:SPEC: SPEC-AI-009` 태그가 codex_cli.rs 핵심 함수에 부착됨(MX Tag Protocol).

---

Version: 0.0.2 (draft)
Classification: spec-anchored
Last Updated: 2026-07-24
