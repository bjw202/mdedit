---
id: SPEC-AI-009
version: "0.0.7"
status: draft
created: "2026-07-24"
updated: "2026-07-25"
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

> 본 문서는 spec.md의 AC-AI9-001~031을 Given-When-Then 형식으로 전개한다. 각 AC는 매핑된 REQ-AI9-XXX를 검증한다. 테스트 전략은 (a) Rust `#[cfg(test)]` 단위 테스트(백엔드 순수 함수 중심), (b) Vitest + Testing Library 단위 테스트(프론트 — 모듈 7 provider 행 UI, 모듈 8 카드 생명주기, 모듈 9 고스트 종결-빈 결과, 모듈 10 고급 토글 라벨), (c) 로컬 수동 통합 테스트(실제 codex CLI 의존)로 삼원화.
>
> **TDD 순서 계약**(`quality.yaml` `development_mode: tdd`): 각 AC의 **Then** 절은 그대로 실패하는 테스트의 단언이 된다. 구현 전에 RED를 먼저 확보하고, 특히 AC-AI9-024(회귀)는 **현재 코드에서 반드시 실패**해야 한다 — 실패하지 않으면 결함 3 재현이 잘못된 것이므로 시나리오를 다시 잡는다. *(v0.0.5)* AC-AI9-026(결함 4 회귀)에도 동일한 RED 확보 계약이 적용된다. *(v0.0.6)* AC-AI9-028(codex 기본/고급 인자 벡터 상이 인덱스 1개)과 AC-AI9-030(리터럴 `sonnet` 부재)에도 동일한 RED 확보 계약이 적용된다. *(v0.0.7)* AC-AI9-030은 "백엔드가 보낸 문자열을 그대로 렌더"로, AC-AI9-031은 "중앙 함수 반환값과 대조"로 단언이 강화되었다.

## 테스트 환경

### 자동화(프론트 단위 테스트 — v0.0.4 신설)

- **실행 명령**: `npm test`(Vitest) / `npm run typecheck` / `npm run lint`
- **위치**: `src/test/SettingsModal.test.tsx`(AC-AI9-016~019), `src/test/aiFileSwitchEffects.test.ts`·`src/test/aiOffEffects.test.ts`(AC-AI9-020·021), `src/test/aiSuggestionCard.test.ts`(AC-AI9-022~024), *(v0.0.5)* 고스트 빈 결과 회귀 테스트(AC-AI9-025~027 — `src/test/aiGhostEmptyDone.repro.test.ts` 를 전환하거나 저장소 관례에 맞는 이름으로 재작성), *(v0.0.6, v0.0.7)* `src/test/SettingsModal.test.tsx`(AC-AI9-030 라벨 렌더·폴백 3경로)
- **커버리지 범위**: provider 행 렌더·상태 파생 순수 함수·선택 차단·정책 잠금·온보딩 진입점 / 파일 전환 정리 3동작·무손상 불변 / 종결 phase 닫기 컨트롤·레지스트리 제거·회귀 시나리오 / *(v0.0.5)* 고스트 terminal-empty 렌더·플레이스홀더 및 [넣기] 부재·문서 무변경·기존 고스트 테스트 무회귀
- **주의**: `ai_detect_providers`·`ai_policy_status`·`aiCancel` IPC는 mock으로 주입한다. 실제 Tauri 런타임 의존 금지(단위 테스트가 CI에서 동작해야 함).

### 자동화(Rust 단위 테스트)

- **실행 명령**: `cargo test --lib ai::`(또는 `cargo test`)
- **위치**: `src-tauri/src/ai/codex_cli.rs`, `stream.rs`, `detect.rs`, `provider.rs`(또는 `claude_cli.rs`)의 `#[cfg(test)]` 모듈
- **커버리지 범위**: 순수 함수(build_codex_args, combine_prompts, parse_codex_*, resolve_codex_binary, is_codex_logged_in, codex_binary_candidates) + 레지스트리 통합(default_registry, first_available, route) + 회귀 가드 스냅샷(build_claude_args, parse_text_delta, parse_final_result, prompt.rs 조립) + *(v0.0.6)* 티어 파생(codex_reasoning_effort, claude_thinking_env, 기본/고급 인자 벡터 원소별 비교) + *(v0.0.7)* 라벨-인자 단일 소스 파생(advanced_model_label 이 as_arg/codex_model_arg/codex_reasoning_effort 반환값과 대조 일치, codex_effort_display 미등록 키 원문 통과)

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

### AC-AI9-006 — codex JSONL 파서 (FLAT primary + 래핑 fallback, 실측 fixture 필수) *(v0.0.4 개정 — 결함 1)*

**매핑**: REQ-AI9-009, REQ-AI9-010

> **fixture 출처 계약(HARD)**: 본 AC의 PRIMARY fixture는 **codex-cli 0.144.1의 실측 캡처 원문**이어야 한다(`build_codex_args`가 산출하는 인자 벡터를 그대로 실행해 얻은 stdout). SPEC 문서의 가정이나 손으로 조립한 형태를 **유일 fixture로 사용하는 것을 금지**한다 — 결함 1이 단위 테스트를 통과한 직접 원인이 `codex_cli.rs:489`의 `agent_message_line` 헬퍼가 실제 출력 대신 래핑 형태를 날조한 것이었다. 래핑 fixture는 FALLBACK 검증용으로만 **별도 이름의 헬퍼**로 분리하고, 테스트 이름에 `primary`/`fallback`을 명시해 둘을 구분한다.

**실측 캡처 원문(PRIMARY, codex-cli 0.144.1)** — `event` 래퍼가 없는 FLAT 형태:

```
{"type":"thread.started","thread_id":"019f9446-9070-7750-bcbe-798b7622ce1f"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"Hi"}}
{"type":"turn.completed","usage":{"input_tokens":14976,"cached_input_tokens":4480,"output_tokens":5,"reasoning_output_tokens":0}}
```

**Given** 위 실측 캡처의 3번째 라인(FLAT `item.completed` + `item.type=="agent_message"`)을

**When** `parse_codex_agent_message(line)`에 전달하면

**Then** 반환값이 `Some("Hi")`이다. (PRIMARY 계약 — 현행 구현 `stream.rs:147-162`는 최상위 `type=="event"`를 요구하므로 이 단언은 수정 전 반드시 **실패**한다. RED 확보 지점.)

**Given** 래핑 형태 `{"type":"event","event":{"type":"item.completed","item":{"type":"agent_message","text":"AI 완성 본문"}}}`을

**When** `parse_codex_agent_message(line)`에 전달하면

**Then** 반환값이 `Some("AI 완성 본문")`이다(FALLBACK 계약 — 향후 codex CLI가 래퍼를 재도입해도 회귀하지 않게 하기 위한 사용자 확정 결정).

**Given** 실측 캡처의 1·2·4번째 라인(FLAT `thread.started` / `turn.started` / `turn.completed`)과 `item.type`이 `agent_message`가 아닌 `item.completed`(예: `reasoning`) 라인을 각각

**When** `parse_codex_agent_message`에 전달하면

**Then** 모두 `None`을 반환한다(panic 없음).

**Given** 비정형 JSON(`}{`), 빈 문자열, 일반 텍스트(`"plain log"`), `null`, `[]`를

**When** `parse_codex_agent_message`에 전달하면

**Then** 모두 `None`을 반환한다(panic 없음, raw JSON 노출 없음).

**Given** 실측 캡처의 4번째 라인(FLAT `{"type":"turn.completed","usage":{...}}`)을

**When** `parse_codex_turn_completed(line)`에 전달하면

**Then** 반환값이 `true`이다(PRIMARY 계약 — 현행 구현 `stream.rs:169-186`은 `type=="event"` 래퍼를 요구하므로 수정 전 반드시 **실패**한다).

**Given** `usage` 필드가 아예 없는 FLAT 라인 `{"type":"turn.completed"}`를

**When** `parse_codex_turn_completed`에 전달하면

**Then** 반환값이 `true`이다(`usage` 존재 여부를 판정 조건으로 삼지 않는다, REQ-AI9-010).

**Given** 래핑 형태 `{"type":"event","event":{"type":"turn.completed","usage":{...}}}`을

**When** `parse_codex_turn_completed`에 전달하면

**Then** 반환값이 `true`이다(FALLBACK 계약).

**Given** 다른 이벤트 라인(FLAT·래핑 양쪽의 `thread.started`, `turn.started`, `item.completed`)과 비정형 라인을

**When** `parse_codex_turn_completed`에 전달하면

**Then** 모두 `false`를 반환한다(panic 없음).

**Given** `src-tauri/src/ai/` 의 `#[cfg(test)]` fixture 헬퍼를 검토하면

**When** `agent_message_line` 계열 헬퍼가 조립하는 JSON 형태를 확인하면

**Then** PRIMARY 헬퍼는 위 실측 캡처와 **바이트 동일한 형태**를 산출하고, 래핑 형태를 산출하는 헬퍼는 이름에 `fallback`/`wrapped`가 드러나 별도로 존재한다(날조 fixture가 PRIMARY 자리를 차지하지 않음).

> **진단 메모(회귀 재발 방지)**: codex는 **성공한 요청에서도** stderr에 `ERROR codex_models_manager::cache: failed to load models cache: missing field 'supports_reasoning_summaries'`를 남긴다. 따라서 파서가 한 줄도 잡지 못하면 EOF 폴백 `decide_outcome(None, stderr, false, true)`이 비어있지 않은 stderr을 `classify_stderr`로 넘기고, 이 문자열은 login/network 마커에 걸리지 않아 `Other`로 분류된다 — 파싱 실패가 진단에 유용한 `parse` 오류가 아니라 오도적인 `other`("잠시 문제가 있었어요")로 **퇴화**한다. 증상만 보고는 파서 문제임을 알 수 없으므로, 파서 계약을 손볼 때는 반드시 본 AC의 실측 fixture로 검증한다.

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

### AC-AI9-011 — 모델 매핑 + AiModel 무변경 + 프론트 변경 범위 한정 *(v0.0.4 개정 — 결함 2)*

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

**Then** 변경 파일이 다음 3개로 한정된다(REQ-AI9-020의 허용 표면):
- `src/components/settings/SettingsModal.tsx`(결함 2 — 대등 provider 행 목록)
- `src/components/layout/AppLayout.tsx`(결함 3a — `initAiFileSwitchEffects` 1회 등록)
- `src/components/editor/extensions/ai-suggestion-card.ts`(결함 3b — 종결 phase 닫기 컨트롤)

그 외 `src/components/` 파일은 변경되지 않는다. ~~"변경 파일 0건"(v0.0.1~0.0.2)~~ 어서션은 폐기됨.

**Given** 동일 diff에서 신규 컴포넌트 도입 여부를 확인하면

**When** provider 관련 UI 표면을 전수 조사하면

**Then** provider별 개별 설정 화면·탭, 편집 화면의 상시 "codex 사용 중" 인디케이터, 설정 다이얼로그 `AI 도구` 섹션 **외부**의 provider 선택 컨트롤이 존재하지 않는다(REQ-AI9-020 금지 목록).

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

### AC-AI9-016 — provider 행 렌더 대칭성 + registry 순서 구동 *(v0.0.4 신설, 결함 2)*

**매핑**: REQ-AI9-026, REQ-AI9-029

> **테스트 방식**: `aiDetectProviders` mock이 반환하는 배열을 바꿔가며 `SettingsModal`을 렌더하고 DOM을 검사한다.

**Given** `aiDetectProviders` mock이 `[{id:'claude',installed:true,version:'2.1.218',loggedIn:true}, {id:'codex',installed:true,version:'0.144.1',loggedIn:true}]`를 반환하고 정책이 비잠금인 상태에서

**When** `SettingsModal`을 `open`으로 렌더하면

**Then** `AI 도구` 섹션에 provider 행이 **정확히 2개** 존재하고, 각 행이 다음 4요소를 같은 순서로 포함한다: (1) `type="radio"` 입력(두 행이 동일 `name` 그룹), (2) provider 표시명, (3) 상태 배지 문구, (4) 버전 문자열. 두 행의 요소 구성이 동일하다(한쪽에만 있는 추가 문구·배지·강조 없음).

**Given** 동일 상태에서

**When** 렌더된 행의 DOM 순서를 mock 배열 순서와 비교하면

**Then** 행 순서가 `['claude', 'codex']`로 **IPC 반환 배열 순서와 동일**하다.

**Given** mock이 `[claude, codex, {id:'gemini',installed:true,version:'1.0.0',loggedIn:true}]` **3개**를 반환하도록 바꾸면

**When** `SettingsModal.tsx`를 **한 줄도 수정하지 않고** 다시 렌더하면

**Then** 행이 3개 렌더되고 3번째 행의 표시명이 `gemini` 계열이며, 앞 두 행의 렌더는 변하지 않는다(registry 순서 구동 계약, REQ-AI9-029).

**Given** `SettingsModal.tsx` 소스를 검토하면

**When** provider 행 구성 코드를 확인하면

**Then** `providers.find((p) => p.id === 'claude')` 류의 id 하드코딩 조회로 행을 구성하지 않는다(배열 순회만). 리터럴 `"Claude Code"` 전용 상태 블록(개정 전 ~180/196/209행)이 제거되어 있다.

**Given** `version`이 `undefined`인 provider가 목록에 포함되면

**When** 해당 행을 렌더하면

**Then** 버전 요소만 생략되고 나머지 3요소(radio·표시명·배지)는 그대로 유지된다(REQ-AI9-026).

---

### AC-AI9-017 — 행별 상태 파생 순수 함수 *(v0.0.4 신설, 결함 2)*

**매핑**: REQ-AI9-027

**Given** 행 상태 파생 함수(예: `deriveProviderRowState(p: AiProviderStatus)`)가 export된 상태에서

**When** `{installed: true, loggedIn: true}`를 전달하면

**Then** 배지 문구가 `사용 가능`이고 선택 가능(`selectable === true`)이다.

**Given** 동일 함수에

**When** `{installed: true, loggedIn: false}`를 전달하면

**Then** 배지 문구가 `로그인 필요`이고 선택 불가(`selectable === false`)이다.

**Given** 동일 함수에

**When** `{installed: false, loggedIn: true}`와 `{installed: false, loggedIn: false}`를 각각 전달하면

**Then** 두 경우 모두 배지 문구가 `미설치`이고 선택 불가다(`loggedIn` 값은 무시된다, REQ-AI9-027 표).

**Given** 이 함수를 호출할 때

**When** 인자 목록을 확인하면

**Then** 인자는 **해당 provider의 `ProviderStatus` 하나뿐**이다 — 다른 provider 목록·`deriveConnectionState` 결과·"유효 provider" 값을 받지 않는다.

**Given** 이 함수를

**When** React 렌더 없이(`render()` 호출 없이) 직접 호출하면

**Then** 정상 동작한다(순수 함수 계약, 단위 테스트 가능).

---

### AC-AI9-018 — 미사용 행 선택 차단 + 인라인 사유 + 온보딩 진입점 보존 *(v0.0.4 신설, 결함 2)*

**매핑**: REQ-AI9-028, REQ-AI9-032

**Given** mock이 `[{id:'claude',installed:true,loggedIn:false}, {id:'codex',installed:false,loggedIn:false}]`를 반환하는 상태에서

**When** `SettingsModal`을 렌더하고 claude 행의 radio를 확인하면

**Then** radio가 `disabled` 상태다.

**Given** 동일 상태에서

**When** claude 행 radio를 클릭(`fireEvent.click`)하면

**Then** `uiStore.aiSelectedProvider` 값이 **변경되지 않는다**(선택 거부, REQ-AI9-028).

**Given** 동일 상태에서

**When** claude 행 요소의 텍스트 내용을 조회하면

**Then** 그 행 **안에** `로그인 필요` 문구가 포함되어 있다. codex 행 안에는 `미설치` 문구가 포함되어 있다. 두 사유 문구 모두 `title` 툴팁 전용·별도 다이얼로그·섹션 하단 각주로 옮겨져 있지 않다(행 단위 자족성).

**Given** `installed==true && loggedIn==false`인 claude 행에서

**When** 그 행 안의 온보딩 컨트롤을 클릭하면

**Then** `onStartOnboarding`이 호출되어 `OnboardingWizard`가 렌더된다(REQ-AI9-032 — 드롭다운 제거로 온보딩 경로가 소실되지 않음).

**Given** `installed==false`인 codex 행에서

**When** 렌더 결과를 확인하면

**Then** 선택 컨트롤은 여전히 `disabled`이며 사유가 인라인으로 표시된다.

---

### AC-AI9-019 — 드롭다운 제거 + 영속화·IPC 무변경 + 정책 잠금 *(v0.0.4 신설, 결함 2)*

**매핑**: REQ-AI9-030, REQ-AI9-031

**Given** `SettingsModal`을 어떤 provider 조합으로 렌더해도

**When** `aria-label="AI 엔진 선택"`을 가진 요소를 조회하면

**Then** 해당 요소가 DOM에 **존재하지 않는다**(`AiProviderSelect` 드롭다운이 행 목록으로 대체됨, 두 표면 공존 금지, REQ-AI9-030).

**Given** claude·codex 모두 `installed && loggedIn`인 상태에서

**When** codex 행 radio를 선택하면

**Then** `uiStore.aiSelectedProvider === 'codex'`가 되고, 값 도메인이 여전히 `'auto' | 'claude' | 'codex'`다(신규 값·신규 키 없음).

**Given** 본 SPEC 구현 PR의 diff에서

**When** `src/store/uiStore.ts`와 `src/lib/tauri/ipc.ts`를 확인하면

**Then** `aiSelectedProvider` 영속화 키와 `providerId?: string` 타입이 무변경이고, `src/test/aiProviderId.test.ts`의 `resolveProviderId` 계약 테스트가 수정 없이 전수 통과한다.

**Given** `aiPolicyStatus` mock이 `{disabled: true}`를 반환하면

**When** `SettingsModal`을 렌더하면

**Then** 모든 provider 행의 radio가 `disabled`이고 자물쇠 표기(🔒)가 렌더된다(`AdvancedModelToggle`/`AiEnabledToggle`의 기존 정책 잠금 관례와 동일).

**Given** 정책 잠금 상태에서

**When** 임의의 행 radio를 클릭하면

**Then** `uiStore.aiSelectedProvider`가 변경되지 않는다(정책 잠금 하에 선택 변경 경로 부재, REQ-AI9-031).

---

### AC-AI9-020 — 파일 전환 시 AI 산출물 정리 3동작 *(v0.0.4 신설, 결함 3a)*

**매핑**: REQ-AI9-033, REQ-AI9-034

> **테스트 방식**: `aiCancel` IPC와 편집기 `view.dispatch`를 spy로 주입하고, `useFileStore.setState({ currentFile })`로 전이를 직접 유발한다.

**Given** `initAiFileSwitchEffects()`가 1회 등록되고, `aiStore`가 `requestState==='streaming'`·`requestId==='req-1'`이며, 활성 고스트 텍스트가 존재하고, 카드 레지스트리에 컨트롤러가 1개 이상 등록된 상태에서 `currentFile === '/a.md'`이면

**When** `useFileStore.setState({ currentFile: '/b.md' })`로 파일 전환을 유발하면

**Then** 다음이 **각각 정확히 1회** 발생한다:
1. `aiCancel('req-1')` 호출 + `aiStore.cancelRequest()` 반영(`requestState !== 'streaming'`).
2. 편집기에 `clearGhostEffect` 가 dispatch되어 `view.state.field(aiGhostField, false)`가 비워짐.
3. `clearCardRegistry()` 호출로 `getCardControllers().length === 0`.

**Given** 동일 등록 상태에서

**When** `useFileStore.setState({ currentFile: '/a.md' })`로 **같은 경로**를 다시 설정하면

**Then** 위 3동작이 **한 번도** 발생하지 않는다(전이 없음 = 미발동).

**Given** in-flight 요청이 없고(`requestState !== 'streaming'`) 고스트도 카드도 없는 상태에서

**When** 파일을 전환하면

**Then** `aiCancel`·`dispatch`·`clearCardRegistry`가 호출되지 않는다(불필요한 부수효과 없음, `runAiOffCleanup`의 조건부 실행 관례와 동일).

**Given** `initAiFileSwitchEffects()`가 반환한 해제 함수를 호출한 뒤

**When** 파일을 전환하면

**Then** 3동작이 발생하지 않는다(구독 해제 계약 — 언마운트 누수 없음).

**Given** 소스를 검토하면

**When** `src/hooks/useFileSystem.ts`·`src/store/uiStore.ts`·`src/store/fileStore.ts`에서 `clearCardRegistry`/`aiCancel`/`clearGhostEffect` 호출을 grep하면

**Then** 해당 호출이 존재하지 않는다(정리 로직이 독립 effects 모듈에만 있음, REQ-AI9-034).

**Given** `src/components/layout/AppLayout.tsx`를 검토하면

**When** `initAiFileSwitchEffects` 등록 지점을 확인하면

**Then** 기존 `initAiToggleEffects` 등록과 동일한 형태로 **마운트 1회** `useEffect`에서 등록되고 반환 함수로 해제된다.

**Given** `aiFileSwitchEffects.ts`의 구독 콜백을 검토하면

**When** 콜백 본문을 확인하면

**Then** `useFileStore`를 다시 호출하지 않는다(재진입 없음 — `aiOffEffects.ts:1-7`이 문서화한 속성과 동일).

**Given** 리팩터 후 `aiOffEffects.ts`를 검토하면

**When** `runAiOffCleanup`과 파일 전환 정리의 본문을 비교하면

**Then** 두 경로가 **동일한 공용 함수**를 호출한다(본문 복제 없음, Design Notes 권장안). `runAiOffCleanup`/`initAiToggleEffects` export 시그니처는 무변경이고 SPEC-AI-005 REQ-AI5-011 기존 테스트가 전수 통과한다.

---

### AC-AI9-021 — 파일 전환 정리의 무손상 불변 *(v0.0.4 신설, 결함 3a)*

**매핑**: REQ-AI9-035

**Given** 파일 A의 본문이 로드되어 있고 카드·고스트가 활성인 상태에서 전환 직전 `editorStore.content`와 편집기 `view.state.doc.toString()`을 스냅샷하면

**When** 파일 B로 전환해 정리가 수행되면

**Then** 정리 직후 편집기 문서 문자열이 **정리 직전 스냅샷과 바이트 동일**하다(정리 자체가 텍스트를 바꾸지 않음 — 문서 교체는 `openFile`의 `setContent` 책임이며 정리와 분리된다).

**Given** 파일 B가 로드된 후

**When** 파일 B의 본문을 확인하면

**Then** 남아 있던 제안·고스트 텍스트가 **삽입되지 않은** 원본 그대로다(삽입 전 산출물만 폐기, SPEC-AI-001 REQ-AI-033 / SPEC-AI-005 REQ-AI5-012).

**Given** 정리 경로의 소스를 검토하면

**When** dispatch되는 transaction을 확인하면

**Then** `changes`를 포함하는 transaction이 없다(`clearGhostEffect` 같은 뷰 레이어 전용 `StateEffect`만 사용).

---

### AC-AI9-022 — error phase 닫기 컨트롤 (3종 kind 전부) *(v0.0.4 신설, 결함 3b)*

**매핑**: REQ-AI9-036, REQ-AI9-038

**Given** 카드 상태가 `{phase:'error', errorKind:'other', errorMessage:'잠시 문제가 있었어요'}`이면

**When** 카드를 렌더하면

**Then** `닫기` 컨트롤과 기존 `다시 시도` 버튼이 **함께** 존재한다(닫기가 재시도를 대체하지 않음).

**Given** 카드 상태가 `{phase:'error', errorKind:'login'}`이면

**When** 카드를 렌더하면

**Then** `닫기` 컨트롤과 기존 `연결 안내 보기` 버튼이 함께 존재한다.

**Given** 카드 상태가 `{phase:'error', errorKind:'network'}`이면

**When** 카드를 렌더하면

**Then** 액션 버튼이 없어도 `닫기` 컨트롤이 **반드시** 존재한다(개정 전에는 버튼이 하나도 없어 사용자가 카드를 치울 수 없었다).

**Given** 컨트롤러가 레지스트리에 등록된 `error` 카드에서

**When** `닫기`를 클릭하면

**Then** 다음이 모두 참이다:
1. 해당 컨트롤러가 `getCardControllers()`에서 사라진다.
2. 편집기 문서 문자열이 클릭 전후로 바이트 동일하다(REQ-AI9-038 (a)).
3. 재요청·재시도 콜백(`onReRequest`)이 호출되지 않는다(REQ-AI9-038 (c)).

**Given** 카드 상태가 `{phase:'streaming'}`이면

**When** 카드를 렌더하면

**Then** `닫기` 컨트롤이 **존재하지 않고** 기존 `✕ 취소`만 존재한다(REQ-AI9-038 (b), 중복 종료 컨트롤 금지).

---

### AC-AI9-023 — 나머지 종결 phase 닫기 확장 *(v0.0.4 신설, 결함 3b)*

**매핑**: REQ-AI9-037

**Given** 카드 상태가 `{phase:'empty'}`("이미 자연스러워서 바꿀 곳이 없어요")이면

**When** 카드를 렌더하면

**Then** `닫기` 컨트롤이 존재하고, 클릭 시 레지스트리에서 제거되며 문서 텍스트는 무변경이다.

**Given** 카드 상태가 `{phase:'cancelled-by-new'}`("새 요청으로 취소되었어요")이면

**When** 동일하게 검증하면

**Then** 같은 결과다.

**Given** 카드 상태가 `{phase:'stale'}`("원문이 바뀌어 적용할 수 없어요")이면

**When** 동일하게 검증하면

**Then** 같은 결과다.

**Given** 카드 상태가 `{phase:'intruded'}` / `{phase:'retry-exhausted'}` / `{phase:'diagram-fallback'}`이면

**When** 각각 렌더하면

**Then** 기존 종료 컨트롤(`무시` / `⚡ 고급 모델로 다시 시도` / `✓ 목록으로`·`✕`)이 그대로 유지되고 `닫기`가 **중복 추가되지 않는다**.

**Given** 4개 종결 phase(`error`·`empty`·`cancelled-by-new`·`stale`)의 닫기 컨트롤을 비교하면

**When** 라벨과 클릭 동작을 확인하면

**Then** 라벨(`닫기`)과 동작(레지스트리 제거 1가지)이 모두 동일하다(일관성 계약).

---

### AC-AI9-024 — 회귀: 파일 A의 오류 카드가 파일 B에서 사라짐 *(v0.0.4 신설, 결함 3 재현 AC)*

**매핑**: REQ-AI9-033, REQ-AI9-036

> **RED 확보 계약**: 본 AC는 **현재 코드에서 반드시 실패**해야 한다(파일 전환 정리 경로 부재). 실패하지 않으면 재현 시나리오가 결함을 담아내지 못한 것이므로 시나리오를 다시 잡는다.

**Given** 파일 A(`/a.md`)가 열려 있고 AI 요청이 실패해 `{phase:'error', errorKind:'other'}` 카드가 문서 내 특정 `range`에 렌더된 채 레지스트리에 남아 있으면

**When** 파일 B(`/b.md`)를 열어 `fileStore.currentFile`이 전이하면

**Then** 다음이 모두 참이다:
1. `getCardControllers()`가 비어 있다(카드가 레지스트리에서 사라짐).
2. 편집기 DOM에 AI 제안 카드 요소가 렌더되지 않는다(이전 문서의 `range`에 앵커된 유령 카드 없음).
3. 파일 B의 본문이 무변경이다(무손상 불변, AC-AI9-021과 일관).

**Given** 동일한 파일 A 오류 카드 상태에서 **파일 전환 없이**

**When** 사용자가 카드의 `닫기`를 클릭하면

**Then** 카드가 레지스트리·DOM에서 사라지고 파일 A 본문은 무변경이다(수동 경로).

**Given** 위 두 경로(자동 전환 / 수동 닫기) 중 어느 쪽을 거쳐도

**When** 이후 새 AI 요청을 트리거하면

**Then** 새 카드가 정상 등록·렌더된다(정리가 레지스트리를 영구 무력화하지 않음).

**수동 확인**(M8 단계): 실제 앱에서 파일 A의 AI 요청을 실패시킨 뒤(예: 네트워크 차단) 오류 카드가 뜬 상태에서 탐색기로 파일 B를 열면 카드가 즉시 사라진다. 개정 전에는 카드가 남아 파일 B의 무관한 위치에 다시 렌더되었다(스크린샷으로 확인된 증상).

---

### AC-AI9-025 — 고스트 terminal-empty 렌더 + "실질적 빈 값" 정의 *(v0.0.5 신설, 결함 4)*

**매핑**: REQ-AI9-039, REQ-AI9-040, REQ-AI9-044

> **테스트 방식**: `createAiGhostText()` 확장을 얹은 `EditorView` 를 만들고 `startGhostEffect` 로 앵커를 생성한 뒤, `useAiStore.getState().startRequest(id, 'section-fill')` → `completeRequest(<최종 텍스트>, false)` 로 종결시켜 DOM을 검사한다. IPC(`aiRequest`/`aiCancel`)는 mock으로 주입한다.

**Given** `feature='section-fill'` 고스트 요청이 진행 중이고 앵커가 존재하는 상태에서

**When** `completeRequest('', false)` 로 요청이 종결되면

**Then** 고스트가 terminal-empty 상태로 렌더되어 다음이 모두 참이다:
1. 안내 문구 `더 쓸 내용을 찾지 못했어요` 가 렌더된 요소 안에 존재한다(`ℹ` 병기 허용).
2. 닫기 컨트롤이 **정확히 1개** 존재한다(라벨에 `닫기` 포함).
3. 재요청/재시도 성격의 컨트롤(↻ 포함)이 존재하지 않는다(REQ-AI9-044).

**Given** 동일 상태에서 최종 텍스트가 공백만(`'   '`), 개행만(`'\n\n'`), 공백+개행 혼합(`' \n '`)인 각 케이스에 대해

**When** 동일하게 `completeRequest(<값>, false)` 를 호출하면

**Then** 세 케이스 모두 위와 동일한 terminal-empty 렌더가 나타난다("실질적 빈 값" = `trim()` 결과가 빈 문자열, REQ-AI9-040).

**Given** 판정 헬퍼의 의미론을 검토하면

**When** 고스트 경로의 빈 판정과 `isEmptyOrIdentical(finalText, original)`(`ai-suggestion-card.ts:72-75`)의 빈/공백-only 판정부를 비교하면

**Then** 두 판정이 동일 규칙(`finalText.trim() === ''`)을 따른다. 고스트 경로가 **새 문자열 판정 규칙을 별도로 정의하지 않는다**. `isEmptyOrIdentical` 의 "원문과 동일" 부분은 고스트에 적용되지 않는다(대체 대상 원문 부재).

**Given** 최종 텍스트가 비어있지 않은 정상 완료(`completeRequest('이어지는 내용', false)`)이면

**When** 동일하게 렌더를 검사하면

**Then** 기존 동작이 그대로 유지된다 — 회색 고스트 텍스트가 렌더되고 `.cm-ai-ghost-btn` 이 **정확히 2개**([✓ 넣기]/[✕ 지우기])이며 ↻ 재요청 버튼(`.cm-ai-ghost-redo-btn`)이 별도로 존재한다. terminal-empty 안내는 부재다(두 상태 배타, REQ-AI9-044).

**Given** 요청이 아직 진행 중(`requestState='streaming'`)이고 첫 청크가 도착하지 않아 텍스트가 비어 있는 상태에서

**When** 렌더를 검사하면

**Then** 기존 `✨ 작성 중…` 플레이스홀더가 그대로 렌더되고 terminal-empty 안내는 렌더되지 않는다(대기 상태와 종결-빈 상태의 구분, REQ-AI9-039).

---

### AC-AI9-026 — 회귀: 빈 done 이 "작성 중…" + [넣기] 를 동시 렌더하지 않음 *(v0.0.5 신설, 결함 4 재현 AC)*

**매핑**: REQ-AI9-041

> **RED 확보 계약(HARD)**: 본 AC는 **현행 구현에서 반드시 실패**해야 한다. 현재는 `ghostDecorations`(`ai-ghost-text.ts:257-269`)가 `text === ''` 를 "첫 청크 미도착"으로 해석해 `GhostPlaceholderWidget` 을 렌더하고, 동시에 `status === 'done'` 이라 `GhostControlsWidget` 이 [✓ 넣기]/[✕ 지우기]를 렌더한다. 실패하지 않으면 재현 시나리오가 결함을 담아내지 못한 것이므로 시나리오를 다시 잡는다.
>
> **재현 원본**: 임시 스캐폴드 `src/test/aiGhostEmptyDone.repro.test.ts` 가 관측한 출력 — `placeholder = ✨ 작성 중…  | buttons = [ '✓ 넣기', '✕ 지우기' ]`. 이 파일은 정식 회귀 테스트로 전환하거나 삭제 후 재작성한다(현행 형태 잔존 금지, plan.md M9.5).

**Given** 다음 시나리오를 구성하면:
1. `createAiGhostText()` 확장이 적용된 `EditorView` 를 문서 `'Question: 15 나누기 3 더하기 20은 얼마인가요?\n'` 로 생성한다.
2. `view.dispatch({ effects: startGhostEffect.of({ from: doc.length }) })` 로 고스트 앵커를 만든다.
3. `useAiStore.getState().startRequest('req-1', 'section-fill')` 로 요청을 시작한다.

**When** `useAiStore.getState().completeRequest('', false)` 를 호출해 빈 결과로 종결시키면

**Then** 다음이 모두 참이다:
1. `view.dom.querySelector('.mdedit-ai-ghost-placeholder')` 가 **`null`** 이다(대기 플레이스홀더 부재).
2. 렌더된 고스트 컨트롤 중 라벨에 `넣기` 를 포함하는 요소가 **하나도 없다**(조용한 no-op 컨트롤 부재, REQ-AI9-041 (b)).
3. 라벨에 `닫기` 를 포함하는 컨트롤이 **정확히 1개 존재**한다.
4. 대기 안내(`.mdedit-ai-wait-notice`, `WAIT_NOTICE_TEXT`)가 렌더되지 않는다.

**Given** 동일 시나리오에서 `waitingLong` 이 이미 `true` 로 설정된 뒤 빈 결과로 종결되면

**When** 렌더를 검사하면

**Then** 위 4개 단언이 동일하게 성립한다(종결 시 대기 표시는 잔존하지 않는다).

**Given** terminal-empty 상태에서 사용자가 닫기 컨트롤을 클릭하면

**When** 이후 상태를 검사하면

**Then** 고스트가 제거되고(`view.state.field(aiGhostField, false)` 가 `null`) 안내·컨트롤이 DOM에서 사라진다.

---

### AC-AI9-027 — 무손상 불변 + 백엔드·스토어 무변경 + 기존 고스트 테스트 회귀 없음 *(v0.0.5 신설, 결함 4)*

**매핑**: REQ-AI9-042, REQ-AI9-043

**Given** terminal-empty 렌더 직전 `view.state.doc.toString()` 을 스냅샷하면

**When** 빈 결과로 종결되어 안내가 렌더되고, 이어서 닫기를 클릭하면

**Then** 두 시점 모두 문서 문자열이 **스냅샷과 바이트 동일**하다(고스트는 뷰 레이어 전용 `StateEffect`, REQ-AI9-042 (a) / SPEC-AI-001 REQ-AI-033).

**Given** terminal-empty 상태가 렌더된 뒤 사용자가 아무 조작도 하지 않으면

**When** 타이머·후속 틱을 진행시켜(예: `vi.advanceTimersByTime`) 상태를 재검사하면

**Then** 고스트가 **스스로 사라지지 않는다**(무통보 자동 제거 금지, REQ-AI9-042 (b)). 사라짐은 사용자 조작(닫기/Esc) 또는 문서 편집(`docChanged`) 같은 기존 소멸 경로로만 발생한다.

**Given** 렌더 경로가 dispatch하는 transaction을 검토하면

**When** transaction 내용을 확인하면

**Then** `changes` 를 포함하는 transaction이 없다.

**Given** 본 개정 구현 PR의 diff를 검토하면

**When** `src/store/aiStore.ts` 를 확인하면

**Then** 변경 라인이 **0건**이다 — `reduceCompleteRequest` 의 `streamBuffer = finalText`(권위 값 계약)가 무변경이다(빈 결과 판정은 렌더 계층에서 파생, Design Notes).

**Given** 동일 diff에서 `src-tauri/src/ai/codex_cli.rs` 와 `src-tauri/src/ai/stream.rs` 를 확인하면

**When** 변경 라인을 검토하면

**Then** 변경 라인이 **0건**이다. `relay_codex_process` 의 `last_message.clone().unwrap_or_default()` 가 그대로 유지되고, 빈 `result` 의 `ai://done` emit을 억제하거나 `ai://error` 로 전환하는 코드가 존재하지 않는다(REQ-AI9-043).

**Given** 기존 고스트 관련 테스트 파일들에 대해

**When** `aiGhostControls.test.ts`, `aiGhostConfirm.test.ts`, `aiWaitNotice.test.ts`, `aiGhostRerequest.test.ts`, `aiFreeContinue.test.ts` 를 실행하면

**Then** **한 파일도 수정하지 않은 채 전수 통과**한다 — 비어있지 않은 스트리밍·done 경로가 무변경임을 보증한다. 특히 `aiGhostControls.test.ts` 의 "done 상태 `.cm-ai-ghost-btn` 정확히 2개" 단언이 그대로 통과한다(terminal-empty 는 배타적 상태이므로 이 단언의 대상이 아니다, REQ-AI9-044).

---

### AC-AI9-028 — codex 인자 벡터: 기본 vs 고급이 `model_reasoning_effort` **한 원소만** 다름 *(v0.0.6 신설, 결함 5)*

**매핑**: REQ-AI9-045, REQ-AI9-050

> **RED 확보 계약(HARD)**: 본 AC의 "상이한 인덱스가 정확히 1개" 단언은 **현행 구현에서 반드시 실패**한다 — `build_codex_args`(`codex_cli.rs:60-80`)가 `-c model_reasoning_effort="medium"` 을 하드코딩하므로 두 티어의 산출 벡터가 **완전히 동일**하다(상이 인덱스 0개). 실패하지 않으면 재현이 잘못된 것이다.

**Given** 동일한 `combined_prompt`("SYS\n\nUSER")와 동일한 `scratch_dir` 로

**When** `build_codex_args(AiModel::Haiku, combined, scratch)` 와 `build_codex_args(AiModel::Sonnet, combined, scratch)` 를 각각 산출해 원소별로 비교하면

**Then** 다음이 모두 참이다:
1. 두 벡터의 길이가 모두 **15** 다.
2. 값이 다른 인덱스가 **정확히 1개**다(단순 스냅샷 2개 비교가 아니라 원소별 diff — "다른 원소가 슬쩍 바뀌는" 회귀까지 포착한다).
3. 그 인덱스의 값이 각각 `model_reasoning_effort="medium"`(Haiku) / `model_reasoning_effort="high"`(Sonnet)이다.
4. 그 인덱스 직전 원소가 `-c` 다(플래그-값 쌍 유지).

**Given** 두 티어의 벡터 각각에 대해

**When** `--model` 원소의 다음 값을 확인하면

**Then** **두 티어 모두** `"gpt-5.5"` 다(사전 합의 §2 모델 매핑 무변경 — 본 개정은 `--model` 값을 건드리지 않는다).

**Given** 두 티어의 벡터 각각에 대해

**When** 격리·출력 플래그를 조회하면

**Then** `-C`(+ scratch 경로가 인덱스 2), `--ignore-user-config`, `--skip-git-repo-check`, `--ephemeral`, `--sandbox read-only`, `--json` 이 **모두** 존재하고 마지막 원소가 `combined_prompt` 와 바이트 동일하다. 기존 단언(`build_codex_args_isolation_flags_never_missing`·`_scratch_dir_embedded_at_index_2`·`_last_element_is_combined_prompt_byte_equal`)을 **약화하지 않고 두 티어로 범위만 확장**한다 — 통과시키려고 `contains` 등으로 느슨하게 고치는 것은 FAIL 로 간주한다(REQ-AI9-004/008 격리는 `~/.codex/AGENTS.md` 오염의 유일한 1차 방어선).

**Given** 기본 티어 스냅샷 테스트 `build_codex_args_haiku_snapshot_exact_14_elements`(`codex_cli.rs:331`)를

**When** 본 개정 후 실행하면

**Then** **기대값이 한 원소도 바뀌지 않은 채** 통과한다(REQ-AI9-050 (a) — 기대값을 고쳐야 통과한다면 기본 티어 회귀다).

**Given** `codex_cli.rs` 소스를 검토하면

**When** effort 문자열의 출처를 확인하면

**Then** `"medium"`/`"high"` 리터럴이 **단일 순수 함수**(예: `codex_reasoning_effort`) 안에만 존재하고 `build_codex_args` 본문·다른 모듈에 분산되어 있지 않다(REQ-AI9-045 중앙화).

---

### AC-AI9-029 — claude 사고 예산: 기본 티어만 `MAX_THINKING_TOKENS=0`, 고급 티어는 미설정 *(v0.0.6 신설, 결함 5)*

**매핑**: REQ-AI9-046, REQ-AI9-047, REQ-AI9-050

**Given** 사고 예산 파생 순수 함수(예: `claude_thinking_env(model: AiModel)`)가 존재하면

**When** `AiModel::Haiku` 를 전달하면

**Then** 반환값이 `Some(("MAX_THINKING_TOKENS", "0"))` 이다(기본 티어는 추론 비활성 — 기존 동작 유지).

**Given** 동일 함수에

**When** `AiModel::Sonnet` 을 전달하면

**Then** 반환값이 **`None`** 이다 — 고급 티어는 환경변수를 **설정하지 않고** claude CLI 자체 기본값에 위임한다(REQ-AI9-046). 숫자 예산을 반환하지 않는다.

**Given** `spawn_claude` 의 `Command` 구성을 검토하면

**When** env 설정 경로를 확인하면

**Then** `.env(k, v)` 호출이 `claude_thinking_env(model)` 이 `Some((k, v))` 를 반환할 때에만 실행된다(무조건 호출이던 `claude_cli.rs:179` 가 조건부로 바뀜). `no_window`·`.current_dir(cwd)`·`.stdin(Stdio::null())`·`.stdout(piped())`·`.stderr(piped())` 는 **무변경**이다.

**Given** `src-tauri/src` 전체를

**When** `MAX_THINKING_TOKENS` 로 grep 하면

**Then** 이 키에 결합되는 **값 리터럴이 `"0"` 하나뿐**이다 — `"4000"`·`"8000"` 같은 숫자 예산 하드코딩이 존재하지 않는다(REQ-AI9-047).

**Given** 기존 claude 인자 스냅샷 테스트 3종(`build_claude_args_haiku_snapshot_byte_equal`(`claude_cli.rs:370`), `build_claude_args_sonnet_korean_prompt_snapshot_byte_equal`(393), `build_claude_args_isolation_flags_never_drop`(416))을

**When** 본 개정 후 **한 줄도 수정하지 않고** 실행하면

**Then** 전수 통과한다 — `build_claude_args` 는 본 개정에서 변경되지 않으며(`--model` 값은 기존 `AiModel::as_arg()` 가 이미 티어별로 `haiku`/`sonnet` 을 산출한다), 실패한다면 범위를 벗어난 변경이 들어간 신호다(REQ-AI9-022/050 (b)).

**수동 관측**(M10.4.4):

**Given** claude 를 선택한 상태에서

**When** 고급 토글 OFF/ON 으로 각 1회 요청하고 스폰된 프로세스의 인자·환경을 확인하면

**Then** OFF 는 `--model haiku` + `MAX_THINKING_TOKENS=0`, ON 은 `--model sonnet` + 해당 env **부재**다. 두 티어의 동작이 전혀 구분되지 않으면 "미설정 = CLI 기본값" 가정이 성립하지 않는 것이므로 **숫자를 임의로 채우지 말고** 관측 결과를 보고해 SPEC 개정으로 처리한다(REQ-AI9-047, Design Notes).

---

### AC-AI9-030 — 설정 라벨이 백엔드가 보낸 문자열을 렌더 + 폴백 3경로 *(v0.0.6 신설, v0.0.7 개정)*

**매핑**: REQ-AI9-048, REQ-AI9-050, REQ-AI9-053

> **RED 확보 계약**: "리터럴 `sonnet` 부재" 및 "백엔드 문자열 포함" 단언은 **현행 구현에서 반드시 실패**한다(`SettingsModal.tsx:286` 라벨 `고급 모델 사용 (sonnet — 더 정확, 더 느림)`, `:291` `aria-label="고급 모델 사용 (sonnet)"` — 프론트가 문자열을 자체 보유한다).
>
> **v0.0.7 개정 요지**: v0.0.6은 "표시명 포함 + `sonnet` 부재"만 단언했다. 그것만으로는 **프론트가 라벨을 스스로 재구성해도 통과**한다 — 즉 매핑 개정 시 라벨이 거짓말하는 것을 막지 못한다. v0.0.7은 (1) 백엔드가 보낸 문자열이 라벨에 **그대로** 들어가는지, (2) 그 값을 바꾸면 라벨이 **따라가는지**(재구성 부재의 증명), (3) 폴백 3경로를 단언한다.

**Given** `aiDetectProviders` mock 이 `[{id:'claude', installed:true, loggedIn:true, version:'2.1.218', advancedModelLabel:'sonnet'}, {id:'codex', installed:true, loggedIn:true, version:'0.144.1', advancedModelLabel:'gpt-5.5 · 높은 추론'}]` 를 반환하고 `uiStore.aiSelectedProvider === 'codex'` 인 상태에서

**When** `SettingsModal` 을 렌더해 고급 모델 토글의 라벨 텍스트와 `aria-label` 을 조회하면

**Then** 라벨이 `고급 모델 사용 (gpt-5.5 · 높은 추론 — 더 정확, 더 느림)` 이고 `aria-label` 도 **동일 소스 문자열**(`gpt-5.5 · 높은 추론`)을 포함한다.

**Given** 동일 상태에서 `uiStore.aiSelectedProvider === 'claude'` 로 바꾸면

**When** 동일하게 조회하면

**Then** 라벨이 `고급 모델 사용 (sonnet — 더 정확, 더 느림)` 이다. 이 `sonnet` 은 **mock 이 내려준 값**이며 프론트 소스에서 온 것이 아니다(아래 소스 검사 단언이 이를 구분한다).

**Given** mock 의 `advancedModelLabel` 을 임의의 무관한 문자열(예: `'ZZZ-테스트-라벨'`)로 바꾸면

**When** 라벨과 `aria-label` 을 조회하면

**Then** 둘 다 `ZZZ-테스트-라벨` 을 **그대로** 포함한다 — 프론트가 값을 재구성·가공·검증하지 않고 통과시킨다는 증명이다(REQ-AI9-048). 이 단언이 있어야 "프론트가 우연히 같은 문자열을 만들어내서 통과"하는 위양성을 배제할 수 있다.

**Given** `uiStore.aiSelectedProvider === 'auto'` 인 상태에서 mock 이 `[{claude: installed=false}, {codex: installed=true, loggedIn=true, advancedModelLabel:'gpt-5.5 · 높은 추론'}]` 를 반환하면

**When** 라벨을 조회하면

**Then** 감지 배열에서 `deriveProviderRowState(p).selectable === true` 인 **첫 provider**(= codex)의 `advancedModelLabel` 이 쓰인다(백엔드 `first_available()` 우선순위와 동일 규칙, REQ-AI9-048).

**폴백 경로 (a) — 필드 부재**

**Given** 유효 provider 의 `advancedModelLabel` 이 `undefined` 인 mock(3번째 provider `{id:'gemini', installed:true, loggedIn:true}` 또는 구버전 백엔드 응답 시뮬레이션)에서

**When** 라벨과 `aria-label` 을 조회하면

**Then** `고급 모델 사용 (gemini 고급 티어 — 더 정확, 더 느림)` 형태로 폴백한다 — `providerDisplayName` 의 `?? id` 폴백으로 `gemini` 원문이 쓰이고, 예외가 발생하지 않으며 `undefined`·`null` 문자열이 화면에 나타나지 않는다(REQ-AI9-053).

**폴백 경로 (b) — 빈·공백 문자열**

**Given** `advancedModelLabel` 이 `''` 또는 `'   '`(공백만)인 mock 에서

**When** 라벨을 조회하면

**Then** (a)와 **동일한** 표시명 기반 폴백이 적용된다. 빈 괄호 `고급 모델 사용 ( — 더 정확, 더 느림)` 같은 깨진 문구가 렌더되지 않는다.

**폴백 경로 (c) — 유효 provider 부재**

**Given** 모든 provider 가 선택 불가(`installed=false` 또는 `loggedIn=false`)인 mock 에서

**When** 라벨을 조회하면

**Then** provider 를 언급하지 않는 중립 문구 `고급 모델 사용 (더 정확, 더 느림)` 이 렌더되고 예외가 발생하지 않는다(REQ-AI9-053).

**Given** `SettingsModal.tsx` 소스를 검토하면

**When** 라벨 구성 코드를 확인하면

**Then** provider id → 모델명(`'sonnet'`/`'gpt-5.5'`/`'high'`) 리터럴 테이블이 **존재하지 않고**, 티어 표기의 소스가 `advancedModelLabel` **하나뿐**이며, 폴백 표시명 소스가 기존 `PROVIDER_DISPLAY_NAMES` + `?? id` **하나뿐**이다(REQ-AI9-049 (a)/(c)).

**Given** 본 개정 PR 의 diff 에서

**When** `resolveModel`(`SettingsModal.tsx:46-48`, `ai-selection-toolbar.ts:168-170`)·`src/store/uiStore.ts`·`src-tauri/src/ai/prompt.rs` 를 확인하면

**Then** 변경 라인이 **0건**이다 — 토글 상태 키(`aiAdvancedModel`)·`resolveModel` 반환 도메인·컨텍스트 상한 3종(`INLINE_SIDE_MAX`/`SECTION_TAIL_MAX`/`CONTINUE_HEAD_MAX`)이 무변경이다(REQ-AI9-024/050 (d), Exclusions).

**Given** 동일 diff 에서 `src-tauri/src/ai/provider.rs` 와 `src/lib/tauri/ipc.ts` 를 확인하면

**When** 변경 내용을 검토하면

**Then** 각각 **선택 필드 1개 추가만** 존재한다 — `provider.rs` 는 `ProviderStatus.advanced_model_label`(+ serde 어트리뷰트)뿐이고 `AiModel` variant 이름·`as_arg`·`from_opt`·`Capabilities`·`AiProvider` trait 시그니처는 무변경, `ipc.ts` 는 `AiProviderStatus.advancedModelLabel?: string` 뿐이고 `AiRequestArgs`(`model?: 'haiku'|'sonnet'`, `providerId?`)·이벤트 payload 타입은 무변경이다. ⚠️ **v0.0.6의 본 AC는 이 두 파일을 "변경 라인 0건"으로 단언했다** — 백엔드 공급 라벨 채택(REQ-AI9-051)에 따라 그 제약은 v0.0.7에서 위 범위로 **명시적으로 정정**된 것이며, 조용히 위반된 것이 아니다.

**Given** `aiPolicyStatus` mock 이 `{disabled: true}` 를 반환하면

**When** 토글을 렌더하면

**Then** 기존 정책 잠금 관례(`disabled` + 🔒)가 **그대로** 동작하고, 기존 AC-AI9-016~019 테스트가 **무수정 전수 통과**한다.

---

### AC-AI9-031 — 라벨과 인자가 동일 함수에서 파생됨 (거짓말 불가 구조) *(v0.0.7 신설, 결함 5)*

**매핑**: REQ-AI9-049, REQ-AI9-051, REQ-AI9-052

> **테스트 방식(HARD)**: 본 AC의 핵심 단언은 **하드코딩된 기대 문자열과의 단독 비교가 아니라, 중앙 매핑 함수의 반환값과의 대조**여야 한다. `assert_eq!(label, "gpt-5.5 · 높은 추론")` 만 쓰면 매핑을 바꿨을 때 테스트와 라벨이 **함께** 낡아 결함 5가 그대로 재발한다. `codex_model_arg(Sonnet)` 등을 호출해 그 반환값과 대조해야 매핑 변경이 테스트를 자동으로 실패시키고, 구현자가 라벨을 함께 갱신하도록 강제된다.

**Given** `ProviderStatus`(`src-tauri/src/ai/provider.rs`)의 정의를 검토하면

**When** 필드를 나열하면

**Then** 기존 4필드(`id`/`installed`/`version`/`logged_in`)에 더해 `advanced_model_label: Option<String>` 이 **정확히 1개** 추가되어 있고, `version` 과 동일하게 `#[serde(skip_serializing_if = "Option::is_none")]` 가 붙어 있다. 구조체의 `#[serde(rename_all = "camelCase")]` 에 의해 IPC 직렬화 키는 `advancedModelLabel` 이다. `src/lib/tauri/ipc.ts` 의 `AiProviderStatus` 에 대응 필드 `advancedModelLabel?: string` 가 존재한다(REQ-AI9-051).

**Given** claude 고급 티어 라벨 함수를

**When** 호출하고 그 결과를 `AiModel::as_arg(AiModel::Sonnet)` 의 반환값과 대조하면

**Then** 두 값이 **일치**한다(현재 값은 `"sonnet"` 이지만 테스트는 리터럴이 아니라 함수 반환값으로 비교한다, REQ-AI9-052).

**Given** codex 고급 티어 라벨 함수를

**When** 호출하고 그 결과를 `codex_model_arg(AiModel::Sonnet)` 및 `codex_reasoning_effort(AiModel::Sonnet)` 의 반환값과 대조하면

**Then** 라벨이 `codex_model_arg(Sonnet)` 반환값으로 시작하고, 그 뒤에 구분자와 `codex_effort_display(codex_reasoning_effort(Sonnet))` 결과가 이어진다(현재 값은 `"gpt-5.5 · 높은 추론"`). 어느 단언도 모델명·effort 리터럴을 기대값으로 직접 적지 않는다.

**Given** `codex_effort_display` 에

**When** `"high"`, `"medium"`, 그리고 **등록되지 않은 키**(예: `"ultra"`, `""`)를 각각 전달하면

**Then** `"high" → "높은 추론"`, `"medium" → "보통 추론"` 이고, **알 수 없는 키는 원문 그대로 반환**된다 — 라벨이 모르는 강도를 "높은 추론" 이라고 **거짓 주장하지 않는다**(REQ-AI9-052). 향후 `codex_reasoning_effort` 가 새 키를 반환해도 라벨은 그 키를 날것으로 노출할 뿐이다.

**Given** `ClaudeProvider::detect()` 와 `CodexProvider::detect()` 를

**When** 호출해 반환된 `ProviderStatus` 를 검사하면

**Then** `advanced_model_label` 이 `Some(s)` 이고 `s` 가 비어 있지 않다(공백만도 아니다). 두 어댑터 모두에서 성립한다.

**Given** `src-tauri/src/ai/detect.rs` 의 `detect_claude`·`detect_codex` 내부 `ProviderStatus` 생성 지점을 검토하면

**When** `advanced_model_label` 초기값을 확인하면

**Then** `None` 이다 — 모델·추론 강도 매핑 지식이 `detect.rs` 로 새지 않고 어댑터에만 머문다(REQ-AI9-051).

**Given** `src-tauri/src` 전체를

**When** 라벨 조립부에서 `"sonnet"`·`"gpt-5.5"`·`"high"` 문자열 리터럴을 grep 하면

**Then** 라벨을 만드는 코드 경로에 이 리터럴들이 **존재하지 않는다**. `AiModel::as_arg` 내부의 `"sonnet"`/`"haiku"` 와 `codex_model_arg` 내부의 `"gpt-5.5"`, `codex_reasoning_effort` 내부의 `"high"`/`"medium"` 은 **중앙 매핑 그 자체**이므로 유일한 정당한 등장 지점이다. 같은 문자열을 다시 적어둔 두 번째 상수(예: `const CODEX_ADVANCED_LABEL`)가 존재하지 않는다(REQ-AI9-049 (b)).

**수동 교차 검증**(M10.4.5):

**Given** codex 를 선택하고 고급 토글을 켠 상태에서

**When** 실제 요청을 실행해 스폰된 인자(`--model` 값, `model_reasoning_effort` 값)를 확인하고 설정 화면의 라벨과 대조하면

**Then** 라벨에 표시된 문자열이 실제 스폰 값과 **일치**한다. 어긋나면 단일 소스 파생(REQ-AI9-052)이 깨진 것이므로 FAIL 로 간주한다.

---

## Edge Cases (Additional Coverage)

> AC-AI9-001~031 외에 추가로 검증해야 할 경계 케이스.

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

### EC-8 — 파일 전환과 AI OFF 전이가 연속 발생 *(v0.0.4 신설)*

**Given** 카드·고스트가 활성인 상태에서 사용자가 파일을 전환하고 곧바로 AI 토글을 OFF로 내리면

**When** 두 정리 트리거가 연달아 실행되면

**Then** 두 번째 정리는 이미 비워진 레지스트리·고스트에 대해 **no-op**이고 예외가 발생하지 않는다(공용 정리 함수의 조건부 실행 계약). 문서 텍스트는 두 번 모두 무변경이다.

### EC-9 — 파일 전환 시 `currentFile`이 `null`로 가는 경우 *(v0.0.4 신설)*

**Given** 열린 파일이 있는 상태에서 폴더 변경 등으로 `currentFile`이 `null`로 전이하면

**When** 파일 전환 구독이 실행되면

**Then** 정리 3동작이 수행된다(문서가 닫혔으므로 이전 문서 기준 카드는 반드시 폐기되어야 한다). `null → null` 유지는 미발동.

### EC-10 — 닫기 직후 동일 requestId로 done 이벤트가 뒤늦게 도착 *(v0.0.4 신설)*

**Given** 사용자가 `error` 카드를 `닫기`로 제거한 직후 동일 `requestId`의 지연 이벤트가 도착하면

**When** 카드 런타임이 이벤트를 처리하면

**Then** 레지스트리에 해당 컨트롤러가 없으므로 카드가 되살아나지 않고 문서 텍스트도 변경되지 않는다(닫기의 종결성).

### EC-11 — 빈 결과 종결 직후 지연 chunk 도착 *(v0.0.5 신설)*

**Given** 고스트가 terminal-empty 상태로 렌더된 직후 동일 요청의 지연 `ai://chunk` 가 도착해 `streamBuffer` 가 비어있지 않게 되면

**When** `ghostStoreBridge` 가 이를 미러링하면

**Then** 고스트는 기존 done(비어있지 않음) 렌더로 자연 전환된다(terminal-empty 는 `text.trim()===''` 조건에만 걸리는 파생 상태이므로 별도 잠금이 없다). 문서 텍스트는 이 전환에서도 무변경이다.

### EC-12 — 빈 결과 종결 후 Esc / 문서 편집 *(v0.0.5 신설)*

**Given** terminal-empty 상태에서

**When** 사용자가 Esc 를 누르거나 문서를 편집(`docChanged`)하면

**Then** 기존 소멸 경로(`dismissGhostCommand` / `aiGhostField` 의 `docChanged` 규칙)가 그대로 동작해 고스트가 사라진다. 신규 소멸 경로를 추가하지 않는다.

### EC-13 — 유효 provider 가 하나도 없을 때의 고급 토글 라벨 *(v0.0.6 신설)*

**Given** `aiSelectedProvider === 'auto'` 이고 감지된 provider 중 `selectable` 인 것이 **하나도 없으면**

**When** 고급 모델 토글 라벨을 렌더하면

**Then** 예외 없이 렌더되고 표시명 자리에 provider 이름이 비는 형태(또는 provider 언급 없는 중립 문구)가 쓰인다. 리터럴 `sonnet` 은 이 경우에도 등장하지 않으며, 토글 자체는 기존 정책 잠금 규칙과 독립적으로 동작한다(AI 도구 부재는 요청 시점의 기존 "사용 가능한 AI 도구가 없어요" 오류가 담당한다).

### EC-14 — 요청 도중 provider 를 바꿔도 이미 스폰된 프로세스의 티어는 불변 *(v0.0.6 신설)*

**Given** codex 고급 티어 요청이 진행 중일 때

**When** 사용자가 설정에서 provider 나 고급 토글을 바꾸면

**Then** 이미 스폰된 프로세스의 인자 벡터는 바뀌지 않는다(인자는 스폰 시점에 확정). 라벨만 즉시 갱신되며, 다음 요청부터 새 티어가 적용된다. 진행 중 요청이 취소되거나 오류로 전환되지 않는다.

---

## Definition of Done

> 아래 전부 충족 시 본 SPEC 구현이 완료된 것으로 간주한다.

### 코드 품질 게이트

- [ ] `cargo test` 전수 통과(신규 codex 단위 테스트 + 기존 claude/prompt.rs 회귀 가드).
- [ ] `cargo clippy` 무경고.
- [ ] `cargo build --release` 성공.
- [ ] `cargo fmt --check` 클린(포맷팅).
- [ ] `src-tauri/Cargo.toml` dependencies 무변경(신규 크레이트 금지).
- [ ] `npm run typecheck` 클린 *(v0.0.4)*.
- [ ] `npm run lint` 클린 *(v0.0.4)*.
- [ ] `npm test`(Vitest) 전수 통과 — `SettingsModal.test.tsx`, `aiFileSwitchEffects.test.ts`, `aiOffEffects.test.ts`, `aiSuggestionCard.test.ts`, `aiProviderId.test.ts` 포함 *(v0.0.4)*.
- [ ] TDD 순서 준수 — AC-AI9-016~024의 테스트가 구현 **이전에** 작성되어 RED로 관측됨(특히 AC-AI9-006 PRIMARY 단언과 AC-AI9-024 회귀 시나리오가 수정 전 실패) *(v0.0.4)*.

### SPEC 요구사항 커버리지

- [ ] REQ-AI9-001~053 + 007a + 013a 전수(55건) 구현 및 매핑된 AC-AI9-001~031 전수(30 자동 + 1 수동) 통과 *(v0.0.7 갱신)*.
- [ ] "사전 합의 설계 결정(재검토 금지)" 4가지가 코드에 정확히 반영(provider 자동 감지 / 모델 매핑 / system+user 결합 / chunk 1회 emit).
- [ ] Exclusions 전 항목 준수(CODEX_HOME 미사용, AiModel 무변경, 신규 IPC 필드 없음, prompt.rs 무변경 등).
- [ ] D1~D6 감사 피드백 개정 사항 반영(Unwanted REQ 8건 If/then 구조화, REQ-AI9-013a/007a 신규 추가, Delta 표 claude_cli.rs #[cfg(test)] 행 추가, AGENTS.md 차단 수동 AC 추가, build_codex_command 추출 힌트).
- [ ] **결함 1 수정 확인** — codex JSONL 파서가 FLAT(PRIMARY)·래핑(FALLBACK) 둘 다 인식하고, fixture가 실측 캡처에서 출발하며, 날조 헬퍼가 PRIMARY 자리를 차지하지 않음(AC-AI9-006) *(v0.0.4)*.
- [ ] **결함 2 수정 확인** — 설정 다이얼로그 `AI 도구` 섹션이 대등 provider 행 목록이고 드롭다운이 제거됨(AC-AI9-016~019) *(v0.0.4)*.
- [ ] **결함 3 수정 확인** — 파일 전환 시 AI 산출물 정리 + 종결 phase 닫기 컨트롤(AC-AI9-020~024) *(v0.0.4)*.
- [ ] **불변 제약 준수** — codex 인자 벡터·격리 플래그·모델 매핑·PATH 주입·스크래치 cwd·stdin-null 계약 무변경, claude 릴레이 경로 무변경(REQ-AI9-023) *(v0.0.4)*.
- [ ] **결함 4 수정 확인** — 빈 결과 종결 시 고스트가 `더 쓸 내용을 찾지 못했어요` + 닫기 1개를 렌더하고, `✨ 작성 중…`·[✓ 넣기]가 부재(AC-AI9-025·026) *(v0.0.5)*.
- [ ] **결함 4 무변경 계약 준수** — `src/store/aiStore.ts`·`src-tauri/src/ai/codex_cli.rs`·`stream.rs` diff 0줄, 기존 고스트 테스트 5종 무수정 통과(AC-AI9-027) *(v0.0.5)*.
- [ ] **임시 재현 스캐폴드 처리** — `src/test/aiGhostEmptyDone.repro.test.ts` 가 정식 회귀 테스트로 전환되었거나 삭제·재작성되었고, `console.log` 가 남아 있지 않다 *(v0.0.5)*.
- [ ] **결함 5 수정 확인** — codex 기본/고급 인자 벡터가 `model_reasoning_effort` 한 원소에서만 다르고(medium/high), claude 기본 티어는 `MAX_THINKING_TOKENS=0`·고급 티어는 미설정이며, 설정 라벨·`aria-label` 이 **백엔드가 보낸 `advancedModelLabel` 을 그대로** 렌더하고 폴백 3경로가 동작(AC-AI9-028·029·030) *(v0.0.6, v0.0.7 개정)*.
- [ ] **라벨-인자 단일 소스 확인** *(v0.0.7)* — `advanced_model_label` 이 `AiModel::as_arg`/`codex_model_arg`/`codex_reasoning_effort` **반환값과 대조 단언**으로 일치하고(하드코딩 기대 문자열 단독 비교 아님), `codex_effort_display` 가 알 수 없는 키를 원문 통과시키며, 라벨 문자열의 두 번째 상수·프론트 리터럴이 부재(AC-AI9-031).
- [ ] **결함 5 무변경 계약 준수** *(v0.0.7 정정)* — `prompt.rs`(컨텍스트 상한 3종)·`uiStore.ts`·`ai-selection-toolbar.ts` diff **0줄**; `provider.rs` 는 `ProviderStatus` 선택 필드 1개, `ipc.ts` 는 `AiProviderStatus` 선택 필드 1개 추가만 존재하고 `AiModel`·`as_arg`·`from_opt`·`AiRequestArgs` 는 무변경. 기존 `build_claude_args_*` 스냅샷 3종 및 AC-AI9-016~019 테스트 무수정 통과, codex 격리 플래그 단언 미완화. *(v0.0.6이 `provider.rs`·`ipc.ts` 를 "0줄"로 단언했던 것은 REQ-AI9-051 채택에 따라 명시적으로 정정됨.)*
- [ ] **숫자 사고 예산 부재** — `MAX_THINKING_TOKENS` 에 결합된 값 리터럴이 기본 티어의 `"0"` 하나뿐이며 고급 티어용 숫자 상수가 도입되지 않음(REQ-AI9-047) *(v0.0.6)*.
- [ ] **M10.4.3~M10.4.5 수동 관측 통과** — codex 티어별 인자 1원소 차이, claude 티어별 env 유무, **라벨 표시 문자열과 실제 스폰 값의 교차 대조 일치** *(v0.0.6, v0.0.7 개정)*.

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
- [ ] **M8.5(결함 1 실기기 재검증) 수동 통과** — 실제 codex 요청이 `ai://chunk` 1회 → `ai://done`으로 정상 완료되고, "잠시 문제가 있었어요"가 더 이상 뜨지 않음 *(v0.0.4)*.
- [ ] **M8.6(결함 3 실기기 재현 시나리오) 수동 통과** — 파일 A에서 AI 요청 실패 → 오류 카드 표시 → 파일 B 열기 → 카드 소멸 확인(AC-AI9-024) *(v0.0.4)*.

### 문서화

- [ ] SPEC 디렉토리(`.moai/specs/SPEC-AI-009/`)에 spec.md, plan.md, acceptance.md 3개 파일 존재.
- [ ] PR 본문에 SPEC-ID 참조 및 주요 변경 사항 요약.
- [ ] `@MX:SPEC: SPEC-AI-009` 태그가 codex_cli.rs 핵심 함수에 부착됨(MX Tag Protocol).

---

Version: 0.0.7 (draft)
Classification: spec-anchored
Last Updated: 2026-07-25
