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
lifecycle: spec-anchored
---

# SPEC-AI-009 Implementation Plan — codex CLI 두 번째 AI 프로바이더 통합

> 본 plan.md는 spec.md의 REQ-AI9-001~025를 구현 순서로 전개한다. 사전 합의된 4가지 결정(provider 자동 감지 / 모델 매핑 테이블 / system+user "\n\n" 결합 / agent_message 1회 emit)은 본 plan 전체에 걔쳐 불변 전제로 둔다.

## 구현 원칙

1. **단일 소스 원칙**: 기존 `claude` 경로(`build_claude_args`, `parse_text_delta`, `ClaudeProvider`, `spawn_claude`, `prompt.rs`)는 직접 수정하지 않는다. codex는 신규 파일·신규 함수로 완전 분리(REQ-AI9-022/023/024 회귀 가드).
2. **순수 함수 우선**: 인자 조립(`build_codex_args`)·JSONL 파싱(`parse_codex_agent_message`/`parse_codex_turn_completed`)·경로 해석(`resolve_codex_binary`)·로그인 판정(`is_codex_logged_in`)은 전부 순수 함수로 분리해 `Tauri` 런타임 없이 단위 테스트. `claude_cli.rs`/`detect.rs`의 기존 분리 패턴을 그대로 차용.
3. **회귀 가드 우선 배치**: 신규 로직 작성 전, 기존 claude 경로에 대한 바이트 동등 스냅샷 테스트를 먼저 확보해 둔다(REQ-AI9-022/023/024). 이후 codex 추가 중에 의도치 않은 claude 회귀가 즉시 테스트로 포착되게 한다.
4. **가장 작은 확장**: `provider.rs` trait 변경 최소화. `AiModel` enum 무변경. IPC 필드 무변경. 매핑 로직은 `build_codex_args` 내부에 국소화(Design Notes 참조).

## Milestones (우선순위 순서, 시간 추정 금지)

> Time estimate는 품질 게이트 설정(language.yaml, coding-standards.md)에 따라 금지. Priority 라벨과 순서만 명시.

### Milestone M1 — 회귀 가드 스냅샷 확보 (Priority: High, BLOCKER)

> codex 코드를 한 줄도 쓰기 전에 완료되어야 한다. 기존 claude 경로의 바이트 동등 기준선을 고정해 이후 회귀를 자동 포착.

- **M1.1**: `build_claude_args` 스냅샷 테스트 추가(`claude_cli.rs` 내 `#[cfg(test)]`). `(AiModel::Haiku, "sys", "user")`, `(AiModel::Sonnet, "다른 시스템", "다른 사용자")` 등 몇 가지 입력에 대한 산출 `Vec<String>`을 하드코딩 어서션으로 고정. 후속 회귀 시 어서션 실패. **D5 매핑**: 본 단계가 spec.md Delta 표의 `claude_cli.rs (`#[cfg(test)]`)` 행과 일치(프로덕션 코드 무변경, 테스트만 추가).
- **M1.2**: `parse_text_delta`/`parse_final_result` 입력-출력 매트릭스 단위 테스트 보강(stream.rs `#[cfg(test)]`). 이미 존재하는 테스트(stream.rs:134-197)를 그대로 두고, 누락된 edge case(예: `content_block_delta`/`thinking_delta` 변형) 몇 건 추가.
- **M1.3**: `prompt.rs` 조립 바이트 동등 스냅샷 — SPEC-AI-008 AC-AI-008-014가 이미 이 가드를 요구하므로, 존재 여부 확인. 없으면 신규 추가: 비-diagram 5기능(polish/outline/table/shorten/custom) + diagram + section + continue 전 분기의 `(system_prompt, user_prompt)` 산출을 스냅샷 어서션.
- **M1.4**: M1.1~M1.3 전부 `cargo test` 통과 확인. 이 시점이 "claude 무변경 기준선 확보" 완료.

**완료 기준**: 기존 claude/prompt.rs 회귀 테스트 100% 통과, 신규 스냅샷 어서션이 main 브랜치 기준선과 바이트 동등.

### Milestone M2 — codex 감지 (detect.rs 확장, Priority: High)

> M4의 codex_cli.rs가 의존하므로 먼저 구현. 순수 함수 위주라 단위 테스트 빠르게 확보.

- **M2.1**: `codex_binary_candidates(path_dirs, home, is_windows) -> Vec<PathBuf>` 순수 함수 추가. claude의 `claude_binary_candidates`(detect.rs:123-142)와 동일 구조, 실행파일명만 `codex`/`codex.exe`로 교체. macOS 표준 위치: `/opt/homebrew/bin/codex`, `/usr/local/bin/codex`, `~/.local/bin/codex`. Windows: `~/.local/bin/codex.exe`, `%APPDATA%\npm\codex.cmd`. 단위 테스트로 후보 순서·포함 여부 검증(detect.rs:497-519 패턴 차용).
- **M2.2**: `resolve_codex_binary() -> Option<PathBuf>` 추가. PATH → 표준 위치 후보만 조회(REQ-AI9-015 제외사항: nvm·로그인셸 프로브는 v1 생략). `resolve_from_candidates`(detect.rs:145-150) 재사용.
- **M2.3**: `CODEX_BINARY: OnceLock<PathBuf>` 정적 변수 + `codex_binary()` 캐시 래퍼 추가(detect.rs:24-25, 251-258과 대칭).
- **M2.4**: `is_codex_logged_in(home: &Path) -> bool` 순수 함수 추가. `home.join(".codex").join("auth.json").exists()`. 단위 테스트: 임시 디렉토리에 `auth.json` 생성/미생성 케이스 각각 검증(detect.rs:385-403 패턴 차용).
- **M2.5**: `detect_codex() -> ProviderStatus` 추가. `codex --version`(또는 codex 도움말이 권장하는 버전 출력 플래그) 실행 → `parse_version_output`(detect.rs:35-44 재사용)로 버전 파싱. installed = version.is_some(), logged_in = installed && is_codex_logged_in(home). 단위 테스트: 미설치 환경에서 panic 없이 `id="codex"`, installed=false, logged_in=false 반환(detect.rs:577-587 패턴 차용).

**완료 기준**: `cargo test --lib ai::detect` 전수 통과, `detect_codex()`가 실제 codex 미설치 환경에서도 안전 동작.

### Milestone M3 — codex 인자 조립 + 스폰 (codex_cli.rs 신규, Priority: High)

> 신규 파일 `src-tauri/src/ai/codex_cli.rs` 생성. claude_cli.rs 구조 차용.

- **M3.1**: `build_codex_args(model: AiModel, combined_prompt: &str) -> Vec<String>` 순수 함수. 인자 순서·값은 REQ-AI9-004에 명시된 대로. 모델 매핑은 내부 `match model { Haiku|Sonnet => "gpt-5.5" }`로 국소화(REQ-AI9-018). 단위 테스트: (a) 전체 인자 스냅샷 어서션, (b) `--ignore-user-config`/`--sandbox read-only`/`--json` 개별 플래그 존재 어서션, (c) 결합 프롬프트가 마지막 인자, (d) Haiku/Sonnet 모두 `gpt-5.5` 매핑.
- **M3.2**: `combine_prompts(system_prompt: &str, user_prompt: &str) -> String` 순수 헬퍼. `format!("{}\n\n{}", system_prompt, user_prompt)`(REQ-AI9-005). 단위 테스트: 경계(빈 system, 빈 user, 둘 다 빈) 케이스.
- **M3.3**: `spawn_codex(args: &[String], cwd: &Path) -> Result<Child, String>` 추가. `detect::codex_binary()` 절대경로 사용, `process_util::no_window`, `cwd` 고정, `.stdin(Stdio::null())`(필수, REQ-AI9-006), `.stdout(Stdio::piped())`, `.stderr(Stdio::piped())`. 단위 테스트는 `Command` formation을 직접 검증하기 어려우므로, `build_codex_args` + `combine_prompts`의 순수성 검증으로 대체 + 통합 테스트(수동)로 보완. **D6 힌트(AC-AI9-005 자동화)**: `spawn_codex` 내부의 `Command` 구성 부분을 `build_codex_command(binary: &Path, args: &[String], cwd: &Path) -> Command` 순수 함수로 추출해 단위 테스트 가능하게 분리 권장. 이렇게 하면 (a) `.stdin(Stdio::null())` 적용 여부, (b) `no_window` 호출 여부, (c) `.current_dir(cwd)`·`.stdout(piped())`·`.stderr(piped())` 설정을 `Command` formation 단계에서 직접 어서션 가능(AC-AI9-005 자동화). `spawn_codex`는 이 순수 함수를 호출해 `.spawn()`만 실행하는 얇은 래퍼가 된다(claude_cli.rs:170-185 `spawn_claude`도 동일 패턴으로 리팩터 가능하나 본 SPEC 범위 밖 — 회귀 가드 REQ-AI9-022 준수).
- **M3.4**: `CodexProvider` 구조체 + `AiProvider` trait 구현. `id()` → `"codex"`, `detect()` → `detect::detect_codex()` 위임, `spawn(request, cwd)` → `combine_prompts` + `build_codex_args` + `spawn_codex` 순서 호출, `capabilities()` → `Capabilities { supports_streaming: false, typical_latency_ms: <실측 값> }`.

**완료 기준**: codex_cli.rs 컴파일 성공 + 순수 함수 단위 테스트 전수 통과 + `CodexProvider`가 `AiProvider` trait 만족.

### Milestone M4 — codex JSONL 파싱 (stream.rs 확장, Priority: High)

> stream.rs에 codex 전용 파서 추가. 기존 claude 파서는 무변경(REQ-AI9-023).

- **M4.1**: `parse_codex_agent_message(line: &str) -> Option<String>` 순수 함수. JSON 파싱 → `item.completed` + `item.type == "agent_message"` 확인 → `item.text` 반환. 그 외/실패 시 `None`. `serde_json::Value` 기반 탐색, panic 없음. 단위 테스트: (a) 정상 `item.completed(agent_message)` 라인에서 text 추출, (b) `thread.started`/`turn.started`/`turn.completed` 라인은 `None`, (c) 비정형 JSON·빈 라인은 `None`, (d) `item.type`이 `agent_message`가 아닌 경우(`reasoning` 등)은 `None`.
- **M4.2**: `parse_codex_turn_completed(line: &str) -> bool` 순수 함수. JSON 파싱 → `turn.completed` 이벤트 확인 → `true`. 그 외 `false`. 단위 테스트: 정상 종료 라인 vs 다른 이벤트 vs 비정형.
- **M4.3**: codex 전용 fixture 파일 추가(`src-tauri/tests/fixtures/codex/*.jsonl` 또는 인라인 문자열). `thread.started` → `turn.started` → `item.completed(agent_message)` → `turn.completed` 전체 시퀀스 fixture로 릴레이 파싱 단위 테스트에 사용.

**완료 기준**: `cargo test --lib ai::stream` 전수 통과, codex fixture 기반 파싱 검증 완료.

### Milestone M5 — 레지스트리 통합 (Priority: High)

> `ProviderRegistry`에 codex 등록. `route()` 호출부(mod.rs:172-175)는 이미 완성되어 있으므로, registry 내용만 확장.

- **M5.1**: `claude_cli.rs:305-307`의 `claude_registry()`를 `default_registry()`로 리네임(또는 별도 함수 신규 추가). `vec![Box::new(ClaudeProvider::new()), Box::new(CodexProvider::new())]`로 2개 등록. `mod.rs:172`의 호출 지점이 새 함수를 가리키도록 수정.
- **M5.2**: 기존 `claude_registry()` 단위 테스트(claude_cli.rs:551-572) 업데이트. `registry.len() == 2`, `registry.ids() == ["claude", "codex"]` 어서션으로 교체.
- **M5.3**: `ProviderRegistry::first_available() -> Option<&dyn AiProvider>` 신규 메서드(REQ-AI9-002 Design Notes 권장안). `providers` 순회하며 `detect()`가 `installed && logged_in`인 첫 provider 반환. `default_provider()`(provider.rs:111-113) 자체는 무변경하고, `route(None)`이 `first_available()`을 호출하도록 수정(또는 `default_provider()` 의미를 재정의). 회귀 테스트: 기존 `route_uses_default_when_unspecified`(provider.rs:194-199)가 새 동작에 맞게 통과하는지 확인.
- **M5.4**: 자동 감지 우선순위 단위 테스트 추가 — `MockProvider` 2개(claude 설치+로그인 / codex 동일)로 first_available이 claude 선택, claude 미설치 시 codex 선택, 둘 다 불가 시 None 검증.

**완료 기준**: registry에 codex 등록됨 + 자동 감지 우선순위 단위 테스트 통과 + 기존 route 테스트 회귀 없음.

### Milestone M6 — 릴레이 분기 (mod.rs 확장, Priority: Medium)

> `ai_request`(mod.rs:122)가 provider에 따라 적절한 파서를 쓰도록 분기. `claude` 경로는 기존 `parse_text_delta`/`parse_final_result` 그대로.

- **M6.1**: `relay_process`를 provider-aware로 확장. 두 가지 접근 중 하나 선택:
  - **(a) 신규 `relay_codex_process` 함수**: codex 전용 릴레이. `parse_codex_agent_message`/`parse_codex_turn_completed` 사용. `claude_cli::relay_process`(claude_cli.rs:192-264)와 동일 구조(스레드 spawn, `BufReader::lines`, emit 로직, `claim_terminal` 단일 발행).
  - **(b) `relay_process` 매개변수 확장**: `provider_id: &str` 또는 `Capabilities`를 받아 내부에서 분기. 단일 함수지만 provider별 파서 선택.
  - **권장**: (a). codex 파싱 로직이 claude와 충분히 달라(스트리밍 vs 완성본 1회) 단일 함수 내 분기가 복잡해진다. (a)가 단일 책임 원칙에 부합.
- **M6.2**: `ai_request`의 스폰 이후 릴레이 배선(mod.rs:233-241)이 provider id에 따라 `relay_process`(claude) 또는 `relay_codex_process`(codex)를 선택 호출.
- **M6.3**: codex 릴레이의 `decide_outcome` 폴백 보존 — `agent_message`도 `turn.completed`도 없는 채 EOF 시 기존 `decide_outcome`(claude_cli.rs:145-165) 경로로 `parse`/`other` `ai://error` 발행(REQ-AI9-013).
- **M6.4**: `claim_terminal` 단일 발행 계약 유지 — codex 릴레이·워치독·`ai_cancel`·신규 요청 교체(mod.rs:186-210) 네 지점이 동일 `finished` 플래그를 공유. SPEC-AI-006 REQ-AI6-006 계약을 codex에도 그대로 적용.

**완료 기준**: codex 경로가 `ai://chunk`(1회) → `ai://done` 순서로 정상 emit + 오류 시 기존 분류 경로 폴백 + 단일 발행 선점 정상 동작.

### Milestone M7 — 통합 검증 (Priority: Medium)

> 로컬 실기기 테스트. 자동화가 어려운 부분(외부 CLI 의존)은 수동으로 검증.

- **M7.1**: `cargo test` 전체 스위트 통과(신규 codex 단위 테스트 + 기존 claude/prompt.rs 회귀 스냅샷).
- **M7.2**: `cargo clippy` 무경고.
- **M7.3**: 수동 통합 테스트 — `codex` CLI가 설치된 환경에서 mdedit 실행, AI 요청 트리거(예: `aiAdvancedModel=false` 인라인 편집). 빈 scratch cwd에서 codex가 정상 스폰, `agent_message` 1회 도착 → "✨ 작성 중…" 플레이스홀더 교체 → `ai://chunk` 1회 수신 → `turn.completed` → `ai://done` 순서 확인.
- **M7.4**: 수동 폴백 테스트 — `claude`와 `codex` 모두 미설치된 환경에서 "사용 가능한 AI 도구가 없어요" 오류 정상 노출.
- **M7.5**: 수동 우선순위 테스트 — `claude` 설치·`codex` 설치된 환경에서 자동 감지가 `claude`를 기본으로 선택. `providerId="codex"` 명시 시 codex 강제 라우팅.
- **M7.6**: 수동 취소 테스트 — codex 요청 진행 중 `ai_cancel` 호출 → 프로세스 kill + `ai://error{kind:"other", cancelledBy:"user"}` 정상 발행 + 릴레이 무음(단일 발행 선점 정상).
- **M7.7**(D4): 수동 AC-AI9-015 — `~/.codex/AGENTS.md` 자동 로딩 차단 검증. 환경 A(오염 원 없음) vs 환경 B(`AGENTS.md` 존재) 교대 측정. 환경 B에서 응답 내용·`usage.input_tokens` 수치가 폭발하지 않는지 확인(자세한 절차는 acceptance.md AC-AI9-015).

**완료 기준**: M7.1~M7.7 전부 통과. PR 머지 가능 상태.

## Technical Approach

### 핵심 아키텍처 결정

1. **codex_cli.rs를 claude_cli.rs의 형제 파일로** — 동일 디렉토리(`src-tauri/src/ai/`)에 배치, 동일 책임 분할(인자 조립 순수 함수 + 스폰 + Provider 구조체). `claude_cli.rs`를 리팩터하지 않고 신규 파일 추가만으로 확장 완료.
2. **trait 메서드 확장 최소화** — `AiProvider` trait에 신규 메서드(`model_arg` 등)를 추가하지 않는다. 매핑 로직은 각 Provider 내부에 국소화(claude는 기존 `AiModel::as_arg`, codex는 `build_codex_args` 내부 match). trait 확장은 3번째 provider가 도입될 때로 연기.
3. **relay 함수 분리(Relay-Codex)** — `relay_process`(claude)와 `relay_codex_process`(codex)를 분리. 공통 로직(스레드 spawn, emit, `claim_terminal`)은 `claude_cli.rs`의 기존 헬퍼(`claim_terminal`, `decide_outcome`, `ChunkPayload`/`DonePayload`/`ErrorPayload`)을 재사용.
4. **회귀 가드 우선** — M1에서 기존 claude/prompt.rs 스냅샷을 먼저 확보해, codex 추가 중 발생하는 의도치 않은 회귀를 자동 포착.

### 의존성 그래프

```
M1 (회귀 가드) ── BLOCKER for all
   ↓
M2 (codex 감지) ── detect.rs
   ↓
M3 (codex_cli.rs) ── codex Provider
   ↓                 ↓
M4 (stream.rs 파서)   │
   ↓                 │
M5 (registry 통합) ←─┘
   ↓
M6 (릴레이 분기) ── mod.rs
   ↓
M7 (통합 검증)
```

M1이 BLOCKER인 이유: M1 없이 codex를 추가하면 `prompt.rs`나 `claude_cli.rs`에 의도치 않은 파급이 발생해도 즉시 포착되지 않는다.

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| codex JSONL 이벤트 포맷이 버전업되어 파서가 빈 손 반환 | 중 | 중 | `parse_codex_agent_message`/`parse_codex_turn_completed`가 형태 불일치 시 `None`/`false` 반환 → `decide_outcome` 폴백으로 `parse` 오류 분류(REQ-AI9-013). 사용자는 "도구 업데이트로 문제가 생겼어요" 메시지 수신. |
| `~/.codex/AGENTS.md` 자동 로딩으로 프롬프트 오염(32K 토큰 폭발 사례) | 중 | 중 | `--ignore-user-config` + 빈 cwd로 1차 방어. 사용자 기기 파일은 통제 불가능하므로 Design Notes에 문서화, 별도 SPEC에서 추가 차단 검토. |
| `first_available()` 도입이 기존 route 테스트를 깜 | 중 | 낮 | `default_provider()`는 무변환하고 `first_available()`을 신규 메서드로 두어 회귀 최소화(M5.3 Design Notes 권장안). 기존 테스트(provider.rs:194-207)는 `default_provider()`를 직접 호출하므로 영향 없음. |
| `claude`와 `codex` 양쪽 다 로그인된 환경에서 사용자가 어느 쪽이 쓰이는지 인지 못함 | 높 | 낮 | v1은 UI 표시 없음(REQ-AI9-020 제외). 자동 감지가 `claude` 우선이므로 대부분 사용자는 기존 경험과 동일. codex 강제 선택은 개발자 도구/설정 파일의 `providerId`로 노출(별도 SPEC). |
| codex `--model gpt-5.5` 매핑이 향후 codex 버전에서 깜 | 낮 | 중 | `build_codex_args` 단위 테스트로 매핑 고정(REQ-AI9-018). 버전업 시 테스트 업데이트 + SPEC 개정. |
| Windows PATH/표준 설치 위치 후보 누락 | 중 | 중 | `codex_binary_candidates` 단위 테스트로 Windows/macOS/Linux 후보 검증(M2.1). 표준 위치는 claude와 동일(`~/.local/bin`, `%APPDATA%\npm`)하게 유지. |

## Testing Strategy

### 자동화된 테스트(핵심)

1. **순수 함수 단위 테스트(Rust `#[cfg(test)]`)**:
   - `build_codex_args`: 인자 순서·값·매핑 스냅샷(M3.1).
   - `combine_prompts`: 결합 경계(M3.2).
   - `parse_codex_agent_message`/`parse_codex_turn_completed`: JSONL fixture 전 수 케이스(M4.1, M4.2).
   - `codex_binary_candidates`/`is_codex_logged_in`/`detect_codex`: 감지 로직(M2.1, M2.4, M2.5).
2. **회귀 가드 스냅샷(M1)**: `build_claude_args`·`parse_text_delta`·`parse_final_result`·`prompt.rs` 조립 결과가 main 기준선과 바이트 동등.
3. **레지스트리 통합 테스트(M5)**: 2개 provider 등록, 자동 감지 우선순위, route 계약.

### 수동 통합 테스트(M7)

- 실제 `codex` CLI가 설치된 환경에서의 엔드투엔드 요청-응답.
- `providerId` 오버라이드 강제 라우팅.
- `claude` 미설치 환경에서 codex 폴백.
- 취소(`ai_cancel`)·워치독 타임아웃·동시 요청 교체가 단일 발행 선점과 충돌 없는지.

### 품질 게이트

- `cargo test` 전수 통과(회귀 + 신규).
- `cargo clippy` 무경고.
- `cargo build --release` 성공.
- 프론트 무변경이므로 `npm run typecheck`/`npm test`/`npm run test:e2e`는 영향 없음 예상(확인용으로 1회 실행).
- SPEC-AI-001/003/006/008의 기존 AC가 전부 회귀 없이 통과(특히 SPEC-AI-008 AC-AI-008-014 비-diagram 5기능 바이트 동등).

## Open Questions (Run phase에서 해결 가능한 사항만)

> 사전 합의된 4가지 결정은 제외. Run phase 재량에 맡긴 세부 구현 선택지만 나열.

1. **`default_registry()` vs `claude_registry()` 리네임 vs 신규 함수**(M5.1): 어느 쪽이 회귀 측면에서 안전한가? `git log`로 `claude_registry()` 참조 지점 전수 확인 후 결정 권장.
2. **`relay_codex_process` vs `relay_process` 매개변수 확장**(M6.1): 단일 책임 vs 중복 코드. 150줄 규모 예상이므로 분리 함수가 가독성에 유리 예상.
3. **codex `--version` 플래그 확정**(M2.5): `codex --version` vs `codex -V` vs `codex --help`의 버전 출력. 실측으로 확정 필요(이미 사용자가 4회 테스트 완료 사항이므로 정보 제공 가능).
4. **`Capabilities::typical_latency_ms` 실측 값**(M3.4): codex 완성본 도착 시간. 1회 테스트로 측정 후 명시.

---

Version: 0.0.2 (draft)
Classification: spec-anchored
Last Updated: 2026-07-24
