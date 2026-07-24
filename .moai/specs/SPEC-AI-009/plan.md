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
lifecycle: spec-anchored
---

# SPEC-AI-009 Implementation Plan — codex CLI 두 번째 AI 프로바이더 통합

> 본 plan.md는 spec.md의 REQ-AI9-001~053(+007a, 013a)을 구현 순서로 전개한다. 사전 합의된 4가지 결정(provider 자동 감지 / 모델 매핑 테이블 / system+user "\n\n" 결합 / agent_message 1회 emit)은 본 plan 전체에 걸쳐 불변 전제로 둔다.
>
> **v0.0.4 개정 안내**: M1~M7은 이미 구현·머지된 초기 릴리즈(커밋 044c857·1b74772·80e067b) 범위다. 구현 후 확인된 결함 3건에 대한 수정 작업은 **M8(결함 수정 마일스톤)** 에 별도로 전개한다. M8은 M1~M7의 산출물을 전제로 하며, codex 인자 벡터·격리 플래그·모델 매핑·PATH 주입·스크래치 cwd·stdin-null 계약과 claude 릴레이 경로를 **건드리지 않는다**.
>
> **v0.0.5 개정 안내**: M8(결함 1~3)은 구현 완료·품질 게이트 통과 상태이며 본 개정은 M1~M8을 **일절 변경하지 않는다**. 새로 확인된 결함 4(빈 응답 종결 시 고스트가 "작성 중…" 으로 고착)의 수정은 **M9** 에 별도로 전개한다. M9의 프로덕션 변경 표면은 `src/components/editor/extensions/ai-ghost-text.ts` **1개 파일**이며, `src/store/aiStore.ts`·`src-tauri/src/ai/codex_cli.rs`·`src-tauri/src/ai/stream.rs` 는 **의도적으로 무변경**이다(REQ-AI9-043, Design Notes).
>
> **v0.0.6 개정 안내**: M9(결함 4)까지는 구현 완료·품질 게이트 통과 상태이며 본 개정은 M1~M9를 **일절 변경하지 않는다**. 새로 확인된 결함 5("고급 모델 사용" 토글이 codex 에서 완전히 무효 + 라벨이 provider 무관하게 `sonnet` 을 하드코딩)의 수정은 **M10** 에 별도로 전개한다.
>
> **v0.0.7 개정 안내**: M10의 **라벨 설계만** 교체된다(M10.3 전면 개정) — 사용자가 v0.0.6에서 연기 항목으로 남겨둔 "백엔드가 매핑 소유자로서 표시 문자열을 내려주는 안"을 채택했다. M10.1(codex reasoning effort)·M10.2(claude 사고 예산)는 **무변경**이다. M10의 프로덕션 변경 표면은 `codex_cli.rs`·`claude_cli.rs`(티어 파생 + 라벨 파생)·`provider.rs`(`ProviderStatus` 선택 필드 1개)·`detect.rs`(생성 지점 `None`)·`src/lib/tauri/ipc.ts`(`AiProviderStatus` 선택 필드 1개)·`SettingsModal.tsx`(라벨 렌더 + 폴백) **6개 파일**이다. `src-tauri/src/ai/prompt.rs`(컨텍스트 상한)·`src/store/uiStore.ts`·`ai-selection-toolbar.ts` 는 **여전히 diff 0줄**이며, `provider.rs` 의 `AiModel`·`as_arg`·`from_opt` 와 `ipc.ts` 의 `AiRequestArgs` 도 무변경이다(REQ-AI9-047/049/050/051, Design Notes). ⚠️ v0.0.6이 `provider.rs`·`ipc.ts` 를 통째로 "diff 0줄"로 단언했던 제약은 여기서 **명시적으로 정정**된 것이다.

## 개발 방법론 (v0.0.4 명시, v0.0.5·v0.0.6 확장)

`quality.yaml` `development_mode: tdd` — M8·M9·M10의 모든 작업은 **RED → GREEN → REFACTOR** 순서로 수행한다.

- **RED**: 대응 AC의 **Then** 절을 그대로 실패하는 테스트로 옮긴다. 특히 AC-AI9-006 PRIMARY 단언(FLAT 라인)과 AC-AI9-024 회귀 시나리오(파일 A 오류 카드 → 파일 B), *(v0.0.5)* AC-AI9-026 회귀 시나리오(빈 done → 플레이스홀더 부재)는 **수정 전 반드시 실패**해야 한다 — 실패하지 않으면 재현이 잘못된 것이므로 시나리오를 다시 잡는다.
- **GREEN**: 테스트를 통과시키는 최소 변경만 수행한다.
- **REFACTOR**: 중복 제거(예: `runAiOffCleanup` 본문 공용 함수 추출)를 이 단계에서 수행하고 테스트 그린을 유지한다.

## 구현 원칙

1. **단일 소스 원칙**: 기존 `claude` 경로(`build_claude_args`, `parse_text_delta`, `ClaudeProvider`, `spawn_claude`, `prompt.rs`)는 직접 수정하지 않는다. codex는 신규 파일·신규 함수로 완전 분리(REQ-AI9-022/023/024 회귀 가드).
2. **순수 함수 우선**: 인자 조립(`build_codex_args`)·JSONL 파싱(`parse_codex_agent_message`/`parse_codex_turn_completed`)·경로 해석(`resolve_codex_binary`)·로그인 판정(`is_codex_logged_in`)은 전부 순수 함수로 분리해 `Tauri` 런타임 없이 단위 테스트. `claude_cli.rs`/`detect.rs`의 기존 분리 패턴을 그대로 차용.
3. **회귀 가드 우선 배치**: 신규 로직 작성 전, 기존 claude 경로에 대한 바이트 동등 스냅샷 테스트를 먼저 확보해 둔다(REQ-AI9-022/023/024). 이후 codex 추가 중에 의도치 않은 claude 회귀가 즉시 테스트로 포착되게 한다.
4. **가장 작은 확장**: `provider.rs` trait 변경 최소화. `AiModel` enum 무변경. 매핑 로직은 `build_codex_args`/`codex_model_arg`/`codex_reasoning_effort` 내부에 국소화(Design Notes 참조). *(v0.0.7 정정)* "IPC 필드 무변경"은 **`AiRequestArgs` 와 이벤트 payload 에 한정**된다 — `ProviderStatus`/`AiProviderStatus` 는 백엔드 공급 라벨을 위해 **선택 필드 1개**(`advancedModelLabel`)를 추가한다(REQ-AI9-051). 그 이상의 IPC 확장은 도입하지 않는다.

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

### Milestone M8 — 구현 후 결함 3건 수정 (v0.0.4 신설, Priority: High)

> M1~M7 머지 이후 확인된 결함 3건을 TDD로 수정한다. **불변 제약**: codex 인자 벡터·격리 플래그(`--ignore-user-config`/`--skip-git-repo-check`/`--ephemeral`/`--sandbox read-only`)·모델 매핑·로그인셸 PATH 주입·스크래치 cwd·stdin-null 계약은 무변경이며, claude 릴레이 경로(`parse_text_delta`/`parse_final_result`/`build_claude_args`/`prompt.rs`)도 무변경이다(REQ-AI9-022/023/024 회귀 가드 유지).

#### M8.1 — 결함 1: codex JSONL 파서 계약 정정 (BLOCKER — 이것 없이는 codex가 전혀 동작하지 않음)

- **M8.1.1 (RED)**: `stream.rs`의 `#[cfg(test)]`에 **실측 캡처 원문**(acceptance.md AC-AI9-006의 4줄) 기반 PRIMARY fixture를 추가하고, `parse_codex_agent_message`(FLAT `item.completed`)와 `parse_codex_turn_completed`(FLAT `turn.completed`) 단언을 작성한다. 현행 구현(`stream.rs:150` `type=="event"` 요구, `stream.rs:175` 동일)은 이 단언에서 실패해야 한다 — RED 확인.
- **M8.1.2 (RED)**: 래핑 FALLBACK fixture 단언을 별도 테스트로 추가(테스트 이름에 `fallback`/`wrapped` 명시). 현행 구현은 이 테스트만 통과한다.
- **M8.1.3 (GREEN)**: `parse_codex_agent_message`를 "FLAT 우선 → 실패 시 `event` 래퍼 fallback" 2단 판정으로 수정(REQ-AI9-009). `parse_codex_turn_completed`도 대칭으로 수정(REQ-AI9-010). 그 외 형태·파싱 실패는 `None`/`false`, panic 없음, raw JSON 미노출 유지.
- **M8.1.4 (REFACTOR)**: 두 함수의 "FLAT vs 래핑 노드 선택" 로직이 중복되면 내부 헬퍼(예: `codex_event_node(&Value) -> &Value`)로 추출한다. `stream.rs`의 claude 파서·`classify_stderr`은 손대지 않는다.
- **M8.1.5 (fixture 위생, REQ 재발 방지)**: `codex_cli.rs:489`의 `agent_message_line` 헬퍼를 **실측 FLAT 형태**를 산출하도록 교체하고, 래핑 형태 헬퍼는 `wrapped_agent_message_line` 등 별도 이름으로 분리한다. 날조 fixture가 PRIMARY 자리를 차지하지 않게 한다(AC-AI9-006).
- **M8.1.6 (수동 재검증)**: 실제 codex 요청 1회 — `ai://chunk` 1회 → `ai://done` 정상 완료, "잠시 문제가 있었어요"가 더 이상 뜨지 않음. (성공 시에도 codex stderr이 non-empty이므로, 파서가 잡히면 EOF 폴백 자체를 타지 않는다는 점을 확인.)

**완료 기준**: AC-AI9-006 전수 통과 + 수동 재검증 통과 + 기존 claude 파서 테스트 회귀 없음.

#### M8.2 — 결함 2: 대등한 provider 선택 행 UI

- **M8.2.1 (RED)**: `src/test/SettingsModal.test.tsx`에 AC-AI9-016~019 테스트를 작성한다 — 2행 렌더 대칭성, mock 배열 순서 = DOM 순서, **3번째 provider mock에서 `SettingsModal.tsx` 무수정 3행 렌더**, 행 상태 파생 순수 함수 3케이스, 미사용 행 `disabled` + 클릭해도 `aiSelectedProvider` 무변경 + 인라인 사유, 미로그인 행의 `onStartOnboarding` 도달, `aria-label="AI 엔진 선택"` 부재, 정책 잠금 시 전 행 `disabled` + 🔒. 현행 구현에서 실패 확인.
- **M8.2.2 (GREEN)**: `SettingsModal.tsx` 수정 — (a) Claude 전용 하드코딩 상태 블록(~180/196/209행 리터럴 `"Claude Code"` + 배지·버전·온보딩 문구) 제거, (b) `AiProviderSelect` 드롭다운(~358행~) 제거, (c) `providers` 배열을 **순회**하는 라디오 행 목록 렌더(동일 `name` 그룹), (d) 행 상태 파생 순수 함수 `deriveProviderRowState(p: AiProviderStatus): { label: string; selectable: boolean; reason: string }` 신설 및 export.
- **M8.2.3 (GREEN)**: 미사용 행 `disabled` + 사유 인라인, 정책 잠금 시 전 행 `disabled` + 🔒, 미로그인 행에 온보딩 진입 컨트롤 배치.
- **M8.2.4 (경계 유지)**: `deriveConnectionState`는 **섹션 수준 분기**(loading / policy-locked / 온보딩 표시)에만 계속 사용하고, 그 값이 행 렌더 여부를 좌우하지 않게 한다(REQ-AI9-029). `aiSelectedProvider` 영속화 키·`providerId` IPC 타입·`resolveProviderId` 매핑은 무변경 — `src/test/aiProviderId.test.ts`가 수정 없이 통과해야 한다.

**완료 기준**: AC-AI9-016~019 전수 통과 + `aiProviderId.test.ts` 무수정 통과 + `src/components/` 변경이 `SettingsModal.tsx` 1개 파일로 한정(AC-AI9-011).

#### M8.3 — 결함 3a: 파일 전환 시 AI 산출물 정리

- **M8.3.1 (REFACTOR 선행)**: `src/lib/ai/aiOffEffects.ts`의 `runAiOffCleanup` 본문(취소 → 고스트 `clearGhostEffect` → `clearCardRegistry`)을 공용 함수 **`runAiArtifactCleanup()`** 로 추출하고, `runAiOffCleanup`은 이를 호출하는 얇은 래퍼로 남긴다. **본문 복제 금지** — 두 트리거가 같은 함수를 공유해야 한다(Design Notes 권장안). 기존 export 시그니처(`runAiOffCleanup`/`initAiToggleEffects`)와 OFF 전이 동작은 무변경이며, SPEC-AI-005 REQ-AI5-011 기존 테스트가 그대로 통과해야 한다.
- **M8.3.2 (RED)**: `src/test/aiFileSwitchEffects.test.ts` 신설 — AC-AI9-020·021 작성. `aiCancel` spy, 편집기 `dispatch` spy, 레지스트리 상태를 준비하고 `useFileStore.setState({ currentFile })`로 전이를 유발한다. 동일 경로 재설정 미발동, 해제 함수 호출 후 미발동, 정리 전후 문서 문자열 바이트 동일도 함께 단언.
- **M8.3.3 (GREEN)**: `src/lib/ai/aiFileSwitchEffects.ts` 신설 — `initAiFileSwitchEffects(): () => void`가 `useFileStore.subscribe`로 `currentFile` 전이를 관찰해 `runAiArtifactCleanup()`을 1회 호출(REQ-AI9-033). `aiOffEffects.ts`의 `initAiToggleEffects` 구조를 그대로 차용하고, 콜백 내부에서 `useFileStore`를 재호출하지 않는다(재진입 없음, REQ-AI9-034). `null` 전이도 정리 대상(EC-9).
- **M8.3.4 (GREEN)**: `AppLayout.tsx`의 기존 `useEffect(() => initAiToggleEffects(), [])`(84행 인근) 옆에 `useEffect(() => initAiFileSwitchEffects(), [])`를 마운트 1회 등록.
- **M8.3.5 (금지 확인)**: `useFileSystem.openFile`·`uiStore`·`fileStore` 액션 내부에 정리 호출을 심지 않았는지 grep으로 확인(REQ-AI9-034, Exclusions). `openFile`은 워처·복원 경로에서도 재사용되므로 결합 시 오발동한다.
- **M8.3.6 (무손상 가드)**: 정리 경로가 dispatch하는 transaction에 `changes`가 포함되지 않는지 단언(AC-AI9-021, REQ-AI9-035).

**완료 기준**: AC-AI9-020·021 전수 통과 + SPEC-AI-005 OFF 전이 테스트 회귀 없음.

#### M8.4 — 결함 3b: 종결 phase 닫기 컨트롤

- **M8.4.1 (RED)**: `src/test/aiSuggestionCard.test.ts`에 AC-AI9-022·023 작성 — `error` 3종 kind(`login`/`network`/`other`) 전부에 `닫기` 존재 + 기존 액션 버튼 병존, 클릭 시 `getCardControllers()`에서 제거·문서 텍스트 무변경·`onReRequest` 미호출, `streaming`에는 `닫기` 부재, `empty`/`cancelled-by-new`/`stale`에도 `닫기` 존재, `intruded`/`retry-exhausted`/`diagram-fallback`은 기존 컨트롤만 유지.
- **M8.4.2 (GREEN)**: `ai-suggestion-card.ts` 수정 — `error` 분기(329-353행) 3개 kind 전부와 `empty`(321-327)·`cancelled-by-new`(372-379)·`stale`(381-387) 분기에 `makeButton('mdedit-ai-dismiss', '닫기')` 추가. 핸들러는 **레지스트리 제거 1가지 부수효과만** 수행한다(REQ-AI9-038).
- **M8.4.3 (콜백 설계)**: 기존 `callbacks.onCancel`은 `intruded`에서 "요청 취소 + 카드 제거" 의미로 쓰인다. 종결 phase에는 취소할 in-flight가 없으므로 **의미가 겹치지 않는 별도 콜백**(예: `callbacks.onDismiss`)을 `CardCallbacks`(187행)에 추가하고, 런타임 배선(1159행 인근)에서 `removeCardController(this)`만 호출하도록 연결한다. `onCancel`을 재사용해 취소 IPC가 불필요하게 발사되지 않게 한다.
- **M8.4.4 (REFACTOR)**: 4개 분기에 동일 컨트롤을 붙이므로 `appendDismissButton(card, callbacks)` 헬퍼로 중복을 제거한다.
- **M8.4.5 (RED→GREEN, 회귀 AC)**: AC-AI9-024 — 파일 A의 `error` 카드가 파일 B 열기 후 레지스트리·DOM에서 사라지고 파일 B 본문 무변경. M8.3 완료 시점에 GREEN이 되어야 하며, 수동 닫기 경로도 함께 단언한다.

**완료 기준**: AC-AI9-022·023·024 전수 통과.

#### M8.5 — 통합 검증 (v0.0.4)

- **M8.5.1**: `cargo test` + `cargo clippy` 무경고 + `cargo build --release` 성공.
- **M8.5.2**: `npm run typecheck` + `npm run lint` + `npm test` 전수 통과.
- **M8.5.3**: 수동 — 실제 codex 요청 정상 완료(M8.1.6).
- **M8.5.4**: 수동 — 설정 다이얼로그에 두 도구가 대등한 행으로 표시되고 선택이 영속화됨.
- **M8.5.5**: 수동 — 파일 A AI 요청 실패 → 오류 카드 → 파일 B 열기 → 카드 소멸(AC-AI9-024 재현 시나리오).
- **M8.5.6**: 회귀 — claude 경로로 요청 시 기존 스트리밍 UX가 그대로 동작(REQ-AI9-023 가드).

**완료 기준**: M8.1~M8.5 전부 통과. PR 머지 가능 상태.

### Milestone M9 — 결함 4 수정: 고스트 종결-빈 결과 상태 (v0.0.5 신설, Priority: High)

> M8 머지 이후 확인된 결함 4를 TDD로 수정한다. **불변 제약**: (a) `src/store/aiStore.ts` 의 `reduceCompleteRequest`(`streamBuffer = finalText` 권위 값 계약) **무변경**, (b) `src-tauri/src/ai/codex_cli.rs` `relay_codex_process`(`last_message.clone().unwrap_or_default()`)와 `stream.rs` 파서 **무변경** — 빈 `result` 의 `ai://done` 은 두 provider 모두에서 적법한 종결이며 표현은 프론트 단일 지점이 담당한다(REQ-AI9-043), (c) 비어있지 않은 스트리밍·done 경로 **무변경**. 프로덕션 변경 표면은 `src/components/editor/extensions/ai-ghost-text.ts` 1개 파일이다.

- **M9.1 (RED — 회귀 재현 고정)**: AC-AI9-026을 실패하는 테스트로 작성한다. `createAiGhostText()` 확장을 얹은 `EditorView` 를 문서 `'Question: 15 나누기 3 더하기 20은 얼마인가요?\n'` 로 만들고 → `startGhostEffect.of({ from: doc.length })` → `useAiStore.getState().startRequest('req-1', 'section-fill')` → `completeRequest('', false)` 를 구동한 뒤 다음 4가지를 단언한다: (1) `view.dom.querySelector('.mdedit-ai-ghost-placeholder') === null`, (2) 라벨에 `넣기` 를 포함하는 컨트롤 부재, (3) 라벨에 `닫기` 를 포함하는 컨트롤 정확히 1개, (4) `.mdedit-ai-wait-notice` 부재. **현행 구현에서 (1)(2)(3)이 실패해야 한다** — `ghostDecorations`(`ai-ghost-text.ts:257-269`)가 `text === ''` 로 `GhostPlaceholderWidget` 을 렌더하고 `GhostControlsWidget`(`ai-ghost-text.ts:363-389`)이 `status === 'done'` 으로 [✓ 넣기]/[✕ 지우기]를 렌더하기 때문이다. RED 확인.
- **M9.2 (RED — 렌더 계약)**: AC-AI9-025를 작성한다. 안내 문구 `더 쓸 내용을 찾지 못했어요` 존재, 닫기 정확히 1개, 재요청/↻ 컨트롤 부재, 공백만(`'   '`)·개행만(`'\n\n'`)·혼합(`' \n '`) 3케이스가 동일 렌더, 비어있지 않은 done 은 기존 2버튼 + `.cm-ai-ghost-redo-btn` 유지, `status='streaming'` + 빈 텍스트는 기존 `✨ 작성 중…` 유지.
- **M9.3 (GREEN — 파생 판정)**: `ai-ghost-text.ts` 의 `ghostDecorations`(257-269행)에서 terminal-empty 를 `value.status === 'done' && value.text.trim() === ''` 조합으로 파생한다(REQ-AI9-039/040). 이 조건일 때 `GhostPlaceholderWidget` 대신 안내 위젯을 렌더한다. 판정 문자열 규칙을 새로 쓰지 말고 카드의 `isEmptyOrIdentical`(`ai-suggestion-card.ts:72-75`) 빈/공백-only 의미론을 재사용한다 — `isEmptyOrIdentical(text, '')` 로 직접 호출하거나, 두 곳이 공유하는 1인자 헬퍼(예: `isEffectivelyEmpty(text: string): boolean`)를 추출하고 `isEmptyOrIdentical` 이 이를 호출하도록 얇게 리팩터한다. 후자를 택하면 `isEmptyOrIdentical` 의 시그니처·동작은 무변경이어야 하고 카드 테스트가 무수정 통과해야 한다(REQ-AI9-040, Design Notes).
- **M9.4 (GREEN — 컨트롤)**: `GhostControlsWidget`(363-389행)에 terminal-empty 분기를 추가해 [✓ 넣기]/[✕ 지우기]/↻ 대신 [✕ 닫기] **1개만** 렌더한다(REQ-AI9-039/044). 닫기 핸들러는 기존 `dismissGhostCommand` 를 **재사용**한다 — 문서 텍스트를 건드리지 않고 `clearGhostEffect` 만 dispatch하며, `requestState` 가 이미 `done` 이라 취소 IPC도 발사되지 않는다(`ai-ghost-text.ts:482-493` 가드). 신규 확정 경로를 만들지 않는다(REQ-AI9-042). `eq()` 비교가 새 상태를 구분하도록 위젯의 식별 값(`status` 만이 아닌 terminal-empty 여부)을 함께 반영한다.
- **M9.5 (테스트 위생 — 임시 스캐폴드 처리)**: `src/test/aiGhostEmptyDone.repro.test.ts` 는 **임시 재현 스캐폴드**이며 현행 형태로 잔존시키지 않는다. 저장소 명명 관례에 맞는 정식 회귀 테스트로 **전환**하거나(파일명·`describe` 명을 관례에 맞게 교체, `console.log` 및 `eslint-disable no-console` 제거, 단언을 AC-AI9-026의 4개 전체로 강화) **삭제 후 재작성**한다. `npm run lint` 가 실질 게이트이므로 `console.log` 잔존은 게이트 실패로 이어진다.
- **M9.6 (REFACTOR)**: terminal-empty 판정이 `ghostDecorations` 와 `GhostControlsWidget` 두 곳에서 필요하면 파일 내부 헬퍼(예: `isTerminalEmptyGhost(value: GhostValue | null): boolean`)로 1회 추출해 중복을 제거한다. `ghostStoreBridge`(827-884행)·`confirmGhostCommand`(468-479행)·`dismissGhostCommand`(482-493행)·`reRequestGhost`(439-458행)는 **손대지 않는다**.
- **M9.7 (무변경 검증)**: diff 검사로 다음을 확인한다 — `src/store/aiStore.ts` 0줄 변경, `src-tauri/src/ai/codex_cli.rs` 0줄 변경, `src-tauri/src/ai/stream.rs` 0줄 변경(AC-AI9-027). 빈 `ai://done` 을 억제·오류 전환하는 코드가 추가되지 않았는지 grep으로 재확인한다.
- **M9.8 (기존 고스트 테스트 회귀 확인)**: `aiGhostControls.test.ts`, `aiGhostConfirm.test.ts`, `aiWaitNotice.test.ts`, `aiGhostRerequest.test.ts`, `aiFreeContinue.test.ts` 를 **한 파일도 수정하지 않고** 실행해 전수 통과를 확인한다(AC-AI9-027). 특히 `aiGhostControls.test.ts` 의 "done 상태 `.cm-ai-ghost-btn` 정확히 2개" 단언이 그대로 통과해야 한다 — terminal-empty 는 배타적 상태이므로 이 단언의 대상이 아니며, 이 단언을 통과시키려고 done 경로의 버튼 구성을 바꾸는 것은 금지다.
- **M9.9 (통합 검증)**: `npm run typecheck` + `npm run lint` + `npm test` 전수 통과. `cargo test`·`cargo clippy` 는 백엔드 무변경이므로 기준선 그대로 통과해야 한다.
- **M9.10 (수동 재현 검증)**: 실제 앱에서 codex provider로 빈 응답이 나오는 요청(예: 이어쓸 내용이 없는 문서 끝에서 이어쓰기)을 실행해 `ℹ 더 쓸 내용을 찾지 못했어요` + [✕ 닫기]가 뜨고, "✨ 작성 중…" 이 남지 않으며, 닫기로 정상 소멸하는지 확인한다.

**완료 기준**: AC-AI9-025·026·027 전수 통과 + M9.7 무변경 검증 통과 + M9.8 기존 고스트 테스트 5종 무수정 통과 + M9.5 임시 스캐폴드 처리 완료.

### Milestone M10 — 결함 5 수정: 고급 모델 토글의 provider 대등성 (v0.0.6 신설, Priority: High)

> M9 머지 이후 확인된 결함 5를 TDD로 수정한다. **불변 제약**: (a) `build_claude_args`(`claude_cli.rs:81-98`)·`build_codex_args` 의 **인자 원소 개수·순서·격리 플래그** 무변경(REQ-AI9-022/050 — 격리 단언을 통과시키려고 느슨하게 고치는 것은 금지), (b) `AiModel` enum variant 이름·`as_arg`·`from_opt` 무변경(REQ-AI9-019, Design Notes "AiModel 명명 결정"), (c) IPC 계약 `model?: 'haiku'|'sonnet'`·`providerId?` 및 프론트 `resolveModel` 2곳(`SettingsModal.tsx:46-48`, `ai-selection-toolbar.ts:168-170`) 무변경, (d) `prompt.rs` 컨텍스트 상한 3종 무변경(REQ-AI9-024 연장, Exclusions), (e) `codex_model_arg` 무변경(양 티어 `gpt-5.5`).

#### M10.1 — codex: 티어별 reasoning effort 파생

- **M10.1.1 (RED)**: `src-tauri/src/ai/codex_cli.rs` 의 `#[cfg(test)]` 에 AC-AI9-028 을 작성한다. `build_codex_args(AiModel::Haiku, "p", scratch)` 와 `build_codex_args(AiModel::Sonnet, "p", scratch)` 를 각각 산출한 뒤 `zip` 으로 **원소별 비교**해 (1) 두 벡터 길이가 모두 15, (2) 상이한 인덱스가 **정확히 1개**, (3) 그 인덱스의 값이 각각 `model_reasoning_effort="medium"` / `model_reasoning_effort="high"`, (4) `--model` 다음 원소가 두 티어 모두 `gpt-5.5` 임을 단언한다. **현행 구현에서 (2)가 "상이한 인덱스 0개"로 실패해야 한다** — `build_codex_args`(`codex_cli.rs:60-80`)가 effort 를 하드코딩하므로 두 벡터가 완전히 동일하다. RED 확인.
- **M10.1.2 (GREEN)**: `codex_reasoning_effort(model: AiModel) -> &'static str` 순수 함수를 `codex_model_arg`(`codex_cli.rs:41-45`) **바로 아래 형제 위치**에 신설한다 — `Haiku => "medium"`, `Sonnet => "high"`(REQ-AI9-045). `build_codex_args` 의 하드코딩 문자열 `"model_reasoning_effort=\"medium\"".to_string()` 을 `format!("model_reasoning_effort=\"{}\"", codex_reasoning_effort(model))` 로 교체한다. **다른 원소는 한 줄도 손대지 않는다.**
- **M10.1.3 (스냅샷 의도적 갱신, 완화 금지)**: 기존 스냅샷 테스트를 **의도적으로** 갱신한다 — `build_codex_args_haiku_snapshot_exact_14_elements`(`codex_cli.rs:331`)는 기본 티어이므로 **기대값이 바뀌지 않아야 한다**(바뀌면 기본 티어 회귀, REQ-AI9-050 (a)). `build_codex_args_sonnet_also_maps_to_gpt55`(`codex_cli.rs:362`)는 `--model` 단언은 그대로 두고 effort 가 `"high"` 임을 **추가 단언**한다(제목이 `--model` 매핑을 뜻하므로 이름은 유지). `build_codex_args_isolation_flags_never_missing`(`codex_cli.rs:395`)·`build_codex_args_scratch_dir_embedded_at_index_2`(383)·`build_codex_args_last_element_is_combined_prompt_byte_equal`(374)의 단언은 **한 줄도 약화하지 않는다** — 격리 플래그 어서션이 통과하도록 값을 느슨하게 바꾸는 것(예: `contains` 로 완화)은 금지다. 두 티어 각각에 대해 격리 플래그 존재를 검증하도록 **범위만 확장**한다.

#### M10.2 — claude: 티어별 사고 예산 env 파생

- **M10.2.1 (RED)**: `src-tauri/src/ai/claude_cli.rs` 의 `#[cfg(test)]` 에 AC-AI9-029 를 작성한다. `claude_thinking_env(AiModel::Haiku) == Some(("MAX_THINKING_TOKENS", "0"))`, `claude_thinking_env(AiModel::Sonnet) == None` 을 단언한다. 함수가 아직 없으므로 **컴파일 실패로 RED**를 확인한다.
- **M10.2.2 (GREEN)**: `claude_thinking_env(model: AiModel) -> Option<(&'static str, &'static str)>` 순수 함수를 `build_claude_args` 인근에 신설한다 — `Haiku => Some(("MAX_THINKING_TOKENS", "0"))`, `Sonnet => None`(REQ-AI9-046). **숫자 예산을 발명하지 않는다**(REQ-AI9-047) — 고급 티어는 env 미설정으로 claude CLI 기본값에 위임한다.
- **M10.2.3 (GREEN — 배선)**: `spawn_claude(args: &[String], cwd: &Path)`(`claude_cli.rs:170-185`) 시그니처를 `spawn_claude(args: &[String], cwd: &Path, model: AiModel)` 로 확장하고, 무조건 걸려 있던 `.env("MAX_THINKING_TOKENS", "0")`(179행)을 `claude_thinking_env(model)` 이 `Some((k, v))` 를 반환할 때만 호출하도록 바꾼다. 유일한 호출부 `ClaudeProvider::spawn`(`claude_cli.rs:290-293`)에서 `spawn_claude(&args, cwd, request.model)` 로 갱신한다. `Command` 빌더 체인의 다른 설정(`no_window`·`current_dir`·`stdin(null)`·`stdout(piped)`·`stderr(piped)`)은 **무변경**이다.
- **M10.2.4 (회귀 — 스냅샷 무수정 통과 확인)**: `build_claude_args_haiku_snapshot_byte_equal`(`claude_cli.rs:370`)·`build_claude_args_sonnet_korean_prompt_snapshot_byte_equal`(393)·`build_claude_args_isolation_flags_never_drop`(416) 3종을 **한 줄도 수정하지 않고** 실행해 통과를 확인한다(REQ-AI9-022/050 (b)). `build_claude_args` 는 본 마일스톤에서 손대지 않으므로 이 테스트가 실패하면 범위를 벗어난 변경이 들어간 것이다.
- **M10.2.5 (문서 동기화)**: `claude_cli.rs:71` 독스트링의 "(`MAX_THINKING_TOKENS=0` env는 `spawn_claude`에서 설정)" 문구를 "기본 티어에서만 설정, 고급 티어는 미설정(CLI 기본값 위임)"로 갱신한다. `@MX:NOTE` 로 위임 근거(무출처 매직 넘버 회피)를 1줄 남긴다.
- **M10.2.6 (금지 확인)**: `rg "MAX_THINKING_TOKENS" src-tauri/src` 로 값 리터럴이 기본 티어의 `"0"` **하나뿐**임을 확인한다(REQ-AI9-047, AC-AI9-029).

#### M10.3 — 백엔드 공급 라벨: Rust 필드 → IPC 타입 → 프론트 렌더 → 폴백 *(v0.0.7 전면 개정)*

> v0.0.6의 M10.3(프론트가 `providerDisplayName` 만으로 `{표시명} 고급 티어` 를 구성)은 **폴백 경로로 강등**되었다(M10.3.6). 채택된 설계는 **매핑 소유자(Rust)가 표시 문자열도 소유**하는 것이다 — 라벨이 실제 스폰 인자와 구조적으로 어긋날 수 없게 만드는 것이 이 단계의 목적이다. **선행 조건**: M10.1(`codex_reasoning_effort`)이 GREEN 이어야 M10.3.2를 시작할 수 있다 — codex 라벨이 그 함수의 반환값을 소비하기 때문이다.

- **M10.3.1 (RED — Rust 단일 소스)**: `codex_cli.rs`·`claude_cli.rs` 의 `#[cfg(test)]` 에 AC-AI9-031 을 작성한다. 핵심은 **하드코딩 기대 문자열만으로 비교하지 않는 것**이다 — claude 라벨이 `AiModel::as_arg(AiModel::Sonnet)` **반환값과** 일치하고, codex 라벨이 `codex_model_arg(AiModel::Sonnet)` 및 `codex_reasoning_effort(AiModel::Sonnet)` **반환값으로부터** 조립됨을 대조 단언한다(예: `assert!(label.starts_with(codex_model_arg(Sonnet)))` + effort 표기 대조). 이렇게 해야 향후 매핑을 바꿨을 때 테스트가 자동으로 새 값을 요구하고, 라벨만 옛 값에 머무는 상황이 **테스트를 통과할 수 없다**. 함수가 아직 없으므로 컴파일 실패로 RED 확인.
- **M10.3.2 (GREEN — Rust 필드 + 파생)**: (1) `provider.rs` 의 `ProviderStatus`(44-55행)에 `#[serde(skip_serializing_if = "Option::is_none")] pub advanced_model_label: Option<String>` 추가(REQ-AI9-051). (2) `detect.rs` 의 두 생성 지점(`detect_claude` 282-287행, `detect_codex`)에 `advanced_model_label: None` 추가 — **매핑 지식을 `detect.rs` 로 들이지 않는다**. (3) `claude_cli.rs` 에 라벨 함수 신설: 값 = `AiModel::as_arg(AiModel::Sonnet)`. (4) `codex_cli.rs` 에 라벨 함수 + `codex_effort_display(effort: &str) -> &str` 신설: 값 = `format!("{} · {}", codex_model_arg(Sonnet), codex_effort_display(codex_reasoning_effort(Sonnet)))`, `codex_effort_display` 는 `"high" → "높은 추론"`, `"medium" → "보통 추론"`, **그 외 알 수 없는 키는 원문 그대로 통과**(REQ-AI9-052 — 모르면 날것을 보여줄지언정 틀린 것을 자신 있게 말하지 않는다). (5) 두 어댑터의 `detect()`(`ClaudeProvider::detect` 286-288행, `CodexProvider::detect`)가 `detect::detect_*()` 결과에 필드를 채워 반환.
- **M10.3.3 (GREEN — IPC 타입)**: `src/lib/tauri/ipc.ts` 의 `AiProviderStatus`(259-264행)에 `advancedModelLabel?: string` 추가(REQ-AI9-051). `AiRequestArgs`·`AiPolicyStatus`·이벤트 payload 타입은 손대지 않는다. `aiDetectProviders()`(299-301행)는 시그니처 변경 없이 새 필드를 그대로 통과시킨다.
- **M10.3.4 (RED — 프론트 렌더)**: `src/test/SettingsModal.test.tsx` 에 AC-AI9-030 을 작성한다 — mock 이 `advancedModelLabel: 'sonnet'`(claude) / `'gpt-5.5 · 높은 추론'`(codex)를 내려줄 때 선택된 provider 에 따라 라벨이 `고급 모델 사용 (gpt-5.5 · 높은 추론 — 더 정확, 더 느림)` 형태가 되고 `aria-label` 도 동일 소스를 쓰는지, mock 값을 임의 문자열(예: `'ZZZ-테스트'`)로 바꾸면 라벨이 **그 값을 그대로 따라가는지**(프론트가 재구성하지 않음을 증명), 프론트 소스 유래 리터럴 `sonnet` 이 없는지 단언한다. 현행 구현에서 실패 확인.
- **M10.3.5 (GREEN — 프론트 렌더)**: `AdvancedModelToggle`(`SettingsModal.tsx:269-293`)이 `uiStore.aiSelectedProvider` + `providers` 배열로 유효 provider 를 파생(`'auto'` 면 `deriveProviderRowState(p).selectable` 인 첫 provider)하고, 그 provider 의 `advancedModelLabel` 을 **그대로** 감싸 렌더한다(REQ-AI9-048). `AiSection`(`SettingsModal.tsx:166-197`)이 이미 `providers` 를 보유하므로 prop 으로 내려주면 되고 신규 IPC 호출은 필요 없다.
- **M10.3.6 (GREEN — 폴백 3경로)**: (a) `advancedModelLabel` 이 `undefined` 이거나 (b) 빈 문자열·공백만이면 v0.0.6 형태 `고급 모델 사용 ({providerDisplayName(id)} 고급 티어 — 더 정확, 더 느림)` 로 폴백하고, (c) 유효 provider 자체가 없으면 중립 문구 `고급 모델 사용 (더 정확, 더 느림)` 을 렌더한다(REQ-AI9-053). 세 경로 모두 예외를 던지지 않고 `undefined`·`null` 문자열이 화면에 노출되지 않아야 한다 — 3번째 provider 나 구버전 백엔드 조합에서 실제로 발생 가능한 경로다.
- **M10.3.7 (금지 확인)**: (a) 프론트에 provider id → 모델명 리터럴 테이블이 없는지, (b) **Rust 에 같은 문자열을 다시 적어둔 두 번째 상수**(예: `const CODEX_ADVANCED_LABEL = "gpt-5.5 · 높은 추론"`)가 없는지, (c) 라벨 조립부에 `"sonnet"`/`"gpt-5.5"`/`"high"` 리터럴이 없는지 grep 으로 확인한다(REQ-AI9-049, Exclusions). 표시명 폴백 소스는 기존 `PROVIDER_DISPLAY_NAMES` + `?? id` **하나뿐**이어야 한다.
- **M10.3.8 (경계 유지)**: `resolveModel`(`SettingsModal.tsx:46-48`)·`deriveProviderRowState`·`ProviderRow`·`aiAdvancedModel` 스토어 배선·정책 잠금 `disabled`+🔒 관례는 **무변경**이다. 기존 AC-AI9-016~019 테스트가 무수정 통과해야 한다. `provider.rs` 에서 변경이 허용되는 것은 `ProviderStatus` 의 필드 1개뿐이며 `AiModel`·`as_arg`·`from_opt`·`Capabilities`·`AiProvider` trait 시그니처는 손대지 않는다.

#### M10.4 — 무변경 검증 + 통합 검증

- **M10.4.1 (무변경 diff 검사)** *(v0.0.7 정정)*: diff 로 다음을 확인한다 — `src-tauri/src/ai/prompt.rs` **0줄**(컨텍스트 상한 3종 무변경, Exclusions), `src/store/uiStore.ts` **0줄**, `src/components/editor/extensions/ai-selection-toolbar.ts` **0줄**. `src-tauri/src/ai/provider.rs` 는 **`ProviderStatus` 필드 1줄(+ serde 어트리뷰트) 추가만** 허용되고 `AiModel`·`as_arg`·`from_opt`·`Capabilities`·`AiProvider` trait 는 무변경, `src/lib/tauri/ipc.ts` 는 **`AiProviderStatus` 선택 필드 1줄 추가만** 허용되고 `AiRequestArgs` 는 무변경이다(REQ-AI9-050 (d), REQ-AI9-051). ⚠️ **v0.0.6은 `provider.rs`·`ipc.ts` 를 "0줄"로 단언했다** — 그 제약은 백엔드 공급 라벨 채택으로 v0.0.7에서 위 범위로 **명시적으로 정정**된 것이며, 몰래 위반된 것이 아니다.
- **M10.4.2 (품질 게이트)**: `cargo test` + `cargo clippy` 무경고 + `cargo build --release` 성공 + `npm run typecheck` + `npm run lint` + `npm test` 전수 통과.
- **M10.4.3 (수동 — codex 티어 관측)**: codex 를 선택한 상태에서 고급 토글 OFF/ON 으로 각 1회 요청하고 `ps aux | grep codex` 로 스폰 인자를 확인한다. `model_reasoning_effort="medium"` → `"high"` 로 **그 원소만** 달라지고 나머지 14개 원소는 동일해야 한다.
- **M10.4.4 (수동 — claude 티어 관측)**: claude 를 선택한 상태에서 고급 토글 OFF/ON 으로 각 1회 요청한다. OFF 는 `--model haiku` + `MAX_THINKING_TOKENS=0`, ON 은 `--model sonnet` + 해당 env **부재**여야 한다(프로세스 환경 확인). 고급 티어 응답이 기본 티어보다 지연이 길어지는지도 관측해 위임이 실제로 효과가 있는지 확인한다 — 만약 두 티어의 동작이 구분되지 않으면 "미설정 = CLI 기본값" 가정이 성립하지 않는 것이므로, **숫자를 채워 넣지 말고** 관측 결과를 보고해 SPEC 개정으로 처리한다(REQ-AI9-047, Design Notes).
- **M10.4.5 (수동 — 라벨)** *(v0.0.7 개정)*: 설정 다이얼로그에서 provider 를 claude ↔ codex 로 바꿔가며 라벨이 `고급 모델 사용 (sonnet — 더 정확, 더 느림)` ↔ `고급 모델 사용 (gpt-5.5 · 높은 추론 — 더 정확, 더 느림)` 로 바뀌는지 확인한다. **교차 검증**: M10.4.3에서 관찰한 실제 스폰 인자(`--model` 값, `model_reasoning_effort` 값)와 라벨에 표시된 문자열이 **일치**하는지 대조한다 — 이 대조가 어긋나면 단일 소스 파생(REQ-AI9-052)이 깨진 것이다.

**완료 기준**: AC-AI9-028·029·030·031 전수 통과 + M10.1.3 격리 단언 미완화 확인 + M10.2.4 claude 스냅샷 3종 무수정 통과 + M10.3.7 복제 부재 확인 + M10.4.1 무변경 diff 검증(정정된 범위) 통과.

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
   ↓
M8 (v0.0.4 결함 수정)
   ├─ M8.1 (결함 1: 파서 계약) ── BLOCKER, 독립
   ├─ M8.2 (결함 2: provider 행 UI) ── 독립
   ├─ M8.3 (결함 3a: 파일 전환 정리) ── M8.4.5 회귀 AC의 선행
   │     ↓
   └─ M8.4 (결함 3b: 종결 phase 닫기)
         ↓
      M8.5 (통합 검증)
   ↓
M9 (v0.0.5 결함 4: 고스트 종결-빈 결과) ── 독립, ai-ghost-text.ts 단일 파일
   ↓
M10 (v0.0.6 결함 5: 고급 토글 provider 대등성)
   ├─ M10.1 (codex reasoning effort) ── codex_cli.rs
   ├─ M10.2 (claude 사고 예산 env)   ── claude_cli.rs
   │     ↓ (codex_reasoning_effort 를 라벨이 소비)
   ├─ M10.3 (백엔드 공급 라벨) ── provider.rs + detect.rs + *_cli.rs + ipc.ts + SettingsModal.tsx
   └─ M10.4 (무변경·통합 검증)
```

M1이 BLOCKER인 이유: M1 없이 codex를 추가하면 `prompt.rs`나 `claude_cli.rs`에 의도치 않은 파급이 발생해도 즉시 포착되지 않는다.

M8.1이 BLOCKER인 이유: 파서 계약이 틀린 동안 codex는 **모든 요청에서 실패**한다(성공 시에도 non-empty stderr → `Other` 분류 → 오도적 "잠시 문제가 있었어요"). M8.2의 대등 UI가 완성되어도 codex를 실제로 쓸 수 없으므로 M8.1을 먼저 닫는다.

M8.1 / M8.2 / M8.3 세 갈래는 파일 소유가 겹치지 않아(각각 `stream.rs`+`codex_cli.rs` / `SettingsModal.tsx` / `aiOffEffects.ts`+신규 모듈+`AppLayout.tsx`) 병렬 진행이 가능하다. 다만 M8.4.5(AC-AI9-024 회귀)는 M8.3 완료 이후에만 GREEN이 된다.

*(v0.0.7 개정)* M10.1 / M10.2 는 파일 소유가 겹치지 않아(각각 `codex_cli.rs` / `claude_cli.rs`) 병렬 진행이 가능하다. **M10.3은 v0.0.7에서 두 파일을 모두 만지게 되었고(어댑터 `detect()` 에 라벨 채움) codex 라벨이 `codex_reasoning_effort` 를 소비하므로 M10.1 GREEN 이후에 시작한다** — v0.0.6의 "세 갈래 병렬 가능" 서술은 여기서 갱신된다. M10.4의 수동 관측은 세 갈래가 모두 GREEN 이 된 뒤에만 의미가 있다.

M9가 M8 이후인 이유: 결함 4의 codex 경로(`agent_message` 없이 `turn.completed` → 빈 `result`)는 M8.1의 파서 계약 정정이 머지된 **이후에야 실제로 도달 가능**해졌다. 그 전에는 두 파서가 모두 실패해 요청이 오류로 퇴화했다. M9 자체는 `ai-ghost-text.ts` 1개 파일만 만지므로 M8의 어떤 갈래와도 파일 소유가 겹치지 않는다.

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| codex JSONL 이벤트 포맷이 버전업되어 파서가 빈 손 반환 | 중 | 중 | `parse_codex_agent_message`/`parse_codex_turn_completed`가 형태 불일치 시 `None`/`false` 반환 → `decide_outcome` 폴백으로 `parse` 오류 분류(REQ-AI9-013). 사용자는 "도구 업데이트로 문제가 생겼어요" 메시지 수신. |
| `~/.codex/AGENTS.md` 자동 로딩으로 프롬프트 오염(32K 토큰 폭발 사례) | 중 | 중 | `--ignore-user-config` + 빈 cwd로 1차 방어. 사용자 기기 파일은 통제 불가능하므로 Design Notes에 문서화, 별도 SPEC에서 추가 차단 검토. |
| `first_available()` 도입이 기존 route 테스트를 깜 | 중 | 낮 | `default_provider()`는 무변환하고 `first_available()`을 신규 메서드로 두어 회귀 최소화(M5.3 Design Notes 권장안). 기존 테스트(provider.rs:194-207)는 `default_provider()`를 직접 호출하므로 영향 없음. |
| `claude`와 `codex` 양쪽 다 로그인된 환경에서 사용자가 어느 쪽이 쓰이는지 인지 못함 | 높 | 낮 | v1은 UI 표시 없음(REQ-AI9-020 제외). 자동 감지가 `claude` 우선이므로 대부분 사용자는 기존 경험과 동일. codex 강제 선택은 개발자 도구/설정 파일의 `providerId`로 노출(별도 SPEC). |
| codex `--model gpt-5.5` 매핑이 향후 codex 버전에서 깜 | 낮 | 중 | `build_codex_args` 단위 테스트로 매핑 고정(REQ-AI9-018). 버전업 시 테스트 업데이트 + SPEC 개정. |
| Windows PATH/표준 설치 위치 후보 누락 | 중 | 중 | `codex_binary_candidates` 단위 테스트로 Windows/macOS/Linux 후보 검증(M2.1). 표준 위치는 claude와 동일(`~/.local/bin`, `%APPDATA%\npm`)하게 유지. |
| *(v0.0.4)* 외부 CLI 출력 형태를 문서 가정으로 fixture화 → 결함이 단위 테스트를 통과 | **발생함** | **높** | 결함 1의 직접 원인. AC-AI9-006이 "실측 캡처 fixture 필수 + 날조 금지"를 계약으로 못박고, PRIMARY/FALLBACK 헬퍼를 이름으로 분리한다(M8.1.5). 외부 CLI 출력을 다루는 새 파서를 추가할 때마다 동일 규칙을 적용한다. |
| *(v0.0.4)* 파서 실패가 `parse`가 아닌 `other` 오류로 퇴화해 진단이 어긋남 | **발생함** | 중 | codex는 성공 시에도 stderr이 non-empty(`models cache` ERROR)라 EOF 폴백이 `classify_stderr` → `Other`로 귀결된다. Design Notes에 퇴화 경로를 기록했고, 향후 파서 계약 변경 시 증상이 아닌 실측 fixture로 판단한다. |
| *(v0.0.4)* `runAiOffCleanup` 본문을 복제해 파일 전환 정리를 구현 → 두 경로가 서서히 갈라짐 | 중 | 중 | M8.3.1에서 공용 함수 `runAiArtifactCleanup()` 추출을 **선행 단계로 고정**. AC-AI9-020 마지막 절이 "두 경로가 동일 함수를 호출"을 단언한다. |
| *(v0.0.4)* 정리 로직을 `openFile`에 결합 → 워처·복원 경로 재사용 시 오발동 | 중 | 중 | REQ-AI9-034가 독립 effects 모듈 + `subscribe` + `AppLayout` 1회 등록을 계약으로 고정하고, M8.3.5가 grep으로 결합 부재를 확인한다. Exclusions에도 명시. |
| *(v0.0.4)* 닫기 핸들러가 `onCancel`을 재사용해 불필요한 취소 IPC 발사 | 중 | 낮 | M8.4.3에서 `onDismiss` 별도 콜백을 두고 `removeCardController`만 호출하도록 배선. AC-AI9-022가 `onReRequest` 미호출을 단언하고, 취소 IPC spy로 보강 가능. |
| *(v0.0.4)* 행 목록 전환 과정에서 온보딩 진입점 소실 | 중 | 중 | 드롭다운 제거 시 `onStartOnboarding` 경로가 함께 사라질 수 있다. REQ-AI9-032 + AC-AI9-018 마지막 절이 미로그인 행의 온보딩 도달을 명시적으로 단언한다. |
| *(v0.0.5)* 빈 결과 렌더를 `aiStore` 리듀서에서 처리해 권위 값 계약이 깨짐 | 중 | 높 | `reduceCompleteRequest` 의 `streamBuffer = finalText` 는 문서화된 계약이고 카드·고스트가 공유한다. REQ-AI9-039/043 + AC-AI9-027이 `aiStore.ts` diff 0줄을 단언하고, M9.7이 이를 검증한다. 판정은 고스트 렌더 계층에서 파생한다. |
| *(v0.0.5)* 백엔드에서 빈 `ai://done` 을 억제해 codex/claude 동작 경로가 갈라짐 | 중 | 중 | `codex_cli.rs` 에서 `unwrap_or_default()` 를 손대면 claude 경로(빈 `parse_final_result`)는 여전히 빈 done을 보내므로 두 provider가 다르게 동작한다. REQ-AI9-043이 백엔드 무변경을 계약으로 고정하고 AC-AI9-027이 diff 0줄을 단언한다. |
| *(v0.0.5)* 새 컨트롤 추가로 기존 `.cm-ai-ghost-btn` 개수 단언이 깨짐 | 중 | 중 | `aiGhostControls.test.ts` 가 done 상태 버튼 개수를 정확히 2개로 단언한다(그 때문에 ↻는 `ai-ghost-text.ts:347` 대로 별도 클래스를 쓴다). terminal-empty 는 배타적 상태라 이 단언의 대상이 아니며, M9.8이 5개 테스트 파일의 **무수정** 통과를 확인한다. |
| *(v0.0.5)* 빈 결과 고스트를 자동 제거해 사용자가 원인을 모른 채 사라짐 | 중 | 중 | 무통보 취소 금지(P7) 위배. REQ-AI9-042 (b)가 자동 소멸을 금지하고 AC-AI9-027이 타이머 진행 후에도 고스트가 유지됨을 단언한다. |
| *(v0.0.6)* 기존 codex 스냅샷 테스트가 깨지자 격리 플래그 단언까지 함께 느슨하게 고침 | 중 | **높** | 격리 플래그는 `~/.codex/AGENTS.md` 오염(32K 토큰 폭발)의 유일한 1차 방어선이다(REQ-AI9-004/008). M10.1.3이 "단언 완화 금지, 범위 확장만 허용"을 명시하고, 기본 티어 스냅샷(`build_codex_args_haiku_snapshot_exact_14_elements`)의 **기대값이 바뀌면 회귀**임을 계약으로 고정한다(REQ-AI9-050 (a)). |
| *(v0.0.6)* 고급 티어 사고 예산에 임의의 숫자를 채워 넣음 | 중 | 중 | 무출처 매직 상수는 사후 정당화가 불가능하고 CLI 기본값 변경에 추종하지 못한다. REQ-AI9-047이 숫자 리터럴을 금지하고 AC-AI9-029가 소스 내 `MAX_THINKING_TOKENS` 값 리터럴이 `"0"` 하나뿐임을 단언한다. "미설정이 성립하지 않는다"는 근거를 발견하면 SPEC 개정으로 처리한다(M10.4.4). |
| *(v0.0.6, v0.0.7 갱신)* 라벨 문자열이 복제되어 매핑 개정 시 조용히 거짓말 | 중 | 중 | 결함 5 자체가 이 형태다(라벨은 `sonnet`, 실제는 `gpt-5.5`). v0.0.7은 **구조로** 차단한다 — 라벨을 인자 조립과 동일한 중앙 함수에서 파생해 백엔드가 내려주고(REQ-AI9-052), AC-AI9-031이 중앙 함수 **반환값과 대조**해 단언하므로 매핑을 바꾸면 테스트가 자동으로 새 값을 요구한다. 프론트 리터럴·두 번째 Rust 상수는 REQ-AI9-049로 금지하고 M10.3.7이 grep 으로 확인한다. |
| *(v0.0.7)* `codex_reasoning_effort` 가 새 키를 반환하는데 라벨은 여전히 "높은 추론"이라 주장 | 낮 | 중 | `codex_effort_display` 가 **알 수 없는 키를 원문 그대로 통과**시키도록 계약(REQ-AI9-052) — 모르면 날것을 보여줄지언정 틀린 것을 자신 있게 말하지 않는다. AC-AI9-031이 이 통과 규칙을 단언한다. 티어→표기 매칭을 라벨 쪽에서 다시 하는 구현은 REQ-AI9-049 (b) 위반. |
| *(v0.0.7)* IPC 필드 추가가 구버전 조합·3번째 provider 에서 `undefined` 노출 | 중 | 낮 | 필드는 `Option`/선택 타입이며 REQ-AI9-053이 폴백 3경로(부재 / 빈·공백 / 유효 provider 부재)를 계약으로 고정한다. AC-AI9-030이 세 경로 모두 예외 없이 동작하고 `undefined` 문자열이 노출되지 않음을 단언한다(M10.3.6). |
| *(v0.0.7)* v0.0.6의 "provider.rs·ipc.ts diff 0줄" 제약을 인지하지 못한 채 위반 | 중 | 중 | 본 개정이 그 제약을 **명시적으로 정정**했다(REQ-AI9-050 (d), M10.4.1의 ⚠️ 항목, HISTORY 0.0.7 행). 두 파일의 허용 변경은 각각 선택 필드 1개로 한정되며, 그 외 필드·타입 변경은 여전히 위반이다. |
| *(v0.0.6)* `spawn_claude` 시그니처 확장이 claude 회귀를 유발 | 낮 | 중 | 변경은 env 배선 1줄 + 시그니처 + 유일 호출부다. `build_claude_args` 는 손대지 않으므로 기존 스냅샷 3종이 무수정 통과해야 하며(M10.2.4), 실패하면 범위를 벗어난 변경이 들어간 신호다. |
| *(v0.0.6)* "고급 모델이니 컨텍스트도 늘리자"는 선의의 상수 상향 | 중 | 중 | `INLINE_SIDE_MAX`/`SECTION_TAIL_MAX`/`CONTINUE_HEAD_MAX` 는 지연·초점 설계값이며 세 모델 모두 컨텍스트 창이 1500자를 압도한다. Exclusions·Design Notes·M10.4.1(prompt.rs diff 0줄)이 3중으로 못박고, 재검토는 `truncated` 발생 빈도 계측에서 시작하도록 지정했다. |

## Testing Strategy

### 자동화된 테스트(핵심)

1. **순수 함수 단위 테스트(Rust `#[cfg(test)]`)**:
   - `build_codex_args`: 인자 순서·값·매핑 스냅샷(M3.1).
   - `combine_prompts`: 결합 경계(M3.2).
   - `parse_codex_agent_message`/`parse_codex_turn_completed`: JSONL fixture 전 수 케이스(M4.1, M4.2).
   - `codex_binary_candidates`/`is_codex_logged_in`/`detect_codex`: 감지 로직(M2.1, M2.4, M2.5).
2. **회귀 가드 스냅샷(M1)**: `build_claude_args`·`parse_text_delta`·`parse_final_result`·`prompt.rs` 조립 결과가 main 기준선과 바이트 동등.
3. **레지스트리 통합 테스트(M5)**: 2개 provider 등록, 자동 감지 우선순위, route 계약.

### 프론트 단위 테스트(v0.0.4, M8 — Vitest + Testing Library)

1. **provider 행 UI**(`src/test/SettingsModal.test.tsx`, AC-AI9-016~019): 행 렌더 대칭성, mock 배열 순서 = DOM 순서, 3번째 provider 무수정 렌더, 상태 파생 순수 함수 3케이스, 미사용 행 선택 차단 + 인라인 사유, 온보딩 진입점, 드롭다운 부재, 정책 잠금 🔒.
2. **파일 전환 정리**(`src/test/aiFileSwitchEffects.test.ts` + 기존 `aiOffEffects.test.ts`, AC-AI9-020·021): 3동작 각 1회, 동일 경로 미발동, 해제 후 미발동, 공용 함수 공유, 문서 텍스트 바이트 동일.
3. **종결 phase 닫기**(`src/test/aiSuggestionCard.test.ts`, AC-AI9-022~024): `error` 3종 kind 닫기 존재, `streaming` 닫기 부재, 종결 phase 확장, 레지스트리 제거 + 문서 무변경, **파일 A → 파일 B 회귀 시나리오**.

### 프론트 단위 테스트(v0.0.5, M9 — Vitest)

4. **고스트 종결-빈 결과**(고스트 빈 결과 회귀 테스트, AC-AI9-025~027): terminal-empty 렌더(안내 + 닫기 1개), 공백만/개행만/혼합 3케이스 동일 판정, **빈 done 시 `.mdedit-ai-ghost-placeholder` 및 [넣기] 부재(회귀)**, 비어있지 않은 done 기존 렌더 유지, `streaming` + 빈 텍스트는 기존 플레이스홀더 유지, 문서 텍스트 바이트 동일, 자동 소멸 없음.
5. **무회귀 확인**: `aiGhostControls.test.ts`·`aiGhostConfirm.test.ts`·`aiWaitNotice.test.ts`·`aiGhostRerequest.test.ts`·`aiFreeContinue.test.ts` 를 **무수정** 실행해 전수 통과(M9.8).

### 티어 파생 테스트(v0.0.6, M10)

6. **codex 인자 벡터 비교**(`codex_cli.rs` `#[cfg(test)]`, AC-AI9-028): 기본/고급 벡터를 원소별로 비교해 **상이 인덱스가 정확히 1개**임을 단언(단순 스냅샷 2개보다 강한 계약 — "다른 원소가 슬쩍 바뀌는" 회귀까지 포착). 격리 플래그 단언은 두 티어 각각에 대해 유지.
7. **claude 사고 예산 파생**(`claude_cli.rs` `#[cfg(test)]`, AC-AI9-029): `claude_thinking_env` 2케이스 + `MAX_THINKING_TOKENS` 값 리터럴이 `"0"` 하나뿐인지 소스 검사. 기존 `build_claude_args_*` 스냅샷 3종 **무수정** 통과.
8. **라벨 렌더**(`src/test/SettingsModal.test.tsx`, AC-AI9-030) *(v0.0.7 개정)*: mock 이 내려준 `advancedModelLabel` 이 라벨·`aria-label` 에 그대로 포함되고, mock 값을 임의 문자열로 바꾸면 라벨이 그대로 따라감(프론트 재구성 부재 증명), 폴백 3경로(부재 / 빈·공백 / 유효 provider 부재), `undefined` 미노출, 프론트 유래 `sonnet` 리터럴 부재. 기존 AC-AI9-016~019 테스트 무수정 통과.
9. **라벨-인자 단일 소스**(`claude_cli.rs`/`codex_cli.rs` `#[cfg(test)]`, AC-AI9-031) *(v0.0.7 신설)*: 라벨이 `AiModel::as_arg(Sonnet)`/`codex_model_arg(Sonnet)`/`codex_reasoning_effort(Sonnet)` **반환값과 대조**해 일치(하드코딩 기대 문자열 단독 비교 금지 — 매핑 변경 시 테스트가 자동으로 새 값을 요구해야 한다), `codex_effort_display` 알 수 없는 키 원문 통과, `detect()` 가 필드를 `Some(non-empty)` 로 채움, `detect.rs` 생성 지점은 `None`.

IPC(`ai_detect_providers`·`ai_policy_status`·`aiCancel`)는 mock으로 주입한다 — 실제 Tauri 런타임에 의존하면 CI에서 실행할 수 없다.

### 수동 통합 테스트(M7)

- 실제 `codex` CLI가 설치된 환경에서의 엔드투엔드 요청-응답.
- `providerId` 오버라이드 강제 라우팅.
- `claude` 미설치 환경에서 codex 폴백.
- 취소(`ai_cancel`)·워치독 타임아웃·동시 요청 교체가 단일 발행 선점과 충돌 없는지.

### 품질 게이트

- `cargo test` 전수 통과(회귀 + 신규).
- `cargo clippy` 무경고.
- `cargo build --release` 성공.
- *(v0.0.4 개정)* 프론트 변경이 범위에 포함되므로 `npm run typecheck`·`npm run lint`·`npm test`는 **실질 게이트**다(무영향 가정 폐기). `npm run test:e2e`는 설정 다이얼로그·카드 렌더 변경의 영향을 확인용으로 1회 실행.
- SPEC-AI-001/003/006/008의 기존 AC가 전부 회귀 없이 통과(특히 SPEC-AI-008 AC-AI-008-014 비-diagram 5기능 바이트 동등).
- *(v0.0.4)* SPEC-AI-005 REQ-AI5-011/012(AI OFF 전이 정리 + 무손상) 기존 테스트가 `runAiArtifactCleanup` 추출 후에도 무수정 통과.
- *(v0.0.4)* `src/test/aiProviderId.test.ts`(`resolveProviderId` 계약)가 드롭다운 제거 후에도 무수정 통과.
- *(v0.0.5)* `src/store/aiStore.ts`·`src-tauri/src/ai/codex_cli.rs`·`src-tauri/src/ai/stream.rs` diff 0줄(AC-AI9-027), 고스트 관련 기존 테스트 5종 무수정 통과, 임시 재현 스캐폴드(`aiGhostEmptyDone.repro.test.ts`) 잔존 없음(M9.5). *(v0.0.6 주의)* 이 diff-0줄 계약은 **결함 4의 검증 시점 계약**이다 — M10은 `codex_cli.rs` 를 REQ-AI9-045 범위(reasoning effort 파생) 안에서만 변경하며, 빈 `ai://done` 을 억제·오류 전환하는 코드는 여전히 도입하지 않는다(REQ-AI9-043 유지).
- *(v0.0.6, v0.0.7 정정)* `src-tauri/src/ai/prompt.rs`·`src/store/uiStore.ts`·`src/components/editor/extensions/ai-selection-toolbar.ts` diff **0줄**; `src-tauri/src/ai/provider.rs`·`src/lib/tauri/ipc.ts` 는 **선택 필드 1개 추가만** 허용(그 외 무변경) — v0.0.6의 "0줄" 단언은 백엔드 공급 라벨 채택에 따라 이 범위로 정정됨(M10.4.1). 기존 `build_claude_args_*` 스냅샷 3종·AC-AI9-016~019 테스트 무수정 통과, codex 격리 플래그 단언 미완화(M10.1.3), 라벨 문자열 복제 부재(M10.3.7).

## Open Questions (Run phase에서 해결 가능한 사항만)

> 사전 합의된 4가지 결정은 제외. Run phase 재량에 맡긴 세부 구현 선택지만 나열.

1. **`default_registry()` vs `claude_registry()` 리네임 vs 신규 함수**(M5.1): 어느 쪽이 회귀 측면에서 안전한가? `git log`로 `claude_registry()` 참조 지점 전수 확인 후 결정 권장.
2. **`relay_codex_process` vs `relay_process` 매개변수 확장**(M6.1): 단일 책임 vs 중복 코드. 150줄 규모 예상이므로 분리 함수가 가독성에 유리 예상.
3. **codex `--version` 플래그 확정**(M2.5): `codex --version` vs `codex -V` vs `codex --help`의 버전 출력. 실측으로 확정 필요(이미 사용자가 4회 테스트 완료 사항이므로 정보 제공 가능).
4. **`Capabilities::typical_latency_ms` 실측 값**(M3.4): codex 완성본 도착 시간. 1회 테스트로 측정 후 명시.
5. *(v0.0.4)* **공용 정리 함수의 배치**(M8.3.1): `runAiArtifactCleanup()`을 `aiOffEffects.ts`에 그대로 둘지, 중립적인 `src/lib/ai/aiCleanup.ts`로 옮길지. 후자가 이름-의미 정합에 유리하나 기존 import 경로가 바뀐다. `aiOffEffects.ts`의 기존 export를 유지하는 선에서 Run phase 재량.
6. *(v0.0.4)* **닫기 컨트롤 라벨·표기**(M8.4.2): 텍스트 `닫기` vs `✕`. 기존 카드 컨트롤이 `✕ 취소`(streaming)·`무시`(intruded)로 혼재하므로, 종결 phase 4개는 **`닫기` 단일 라벨**을 권장(REQ-AI9-037 일관성 계약). 아이콘 병기 여부는 Run phase 재량.
7. *(v0.0.4)* **provider 표시명 소스**(M8.2.2): `ProviderStatus.id`(`"claude"`/`"codex"`)를 그대로 노출할지, id → 표시명 매핑 테이블을 둘지. 매핑 테이블을 두면 3번째 provider가 미등록 시 fallback이 필요하므로, "매핑에 있으면 표시명, 없으면 id" 방식이 REQ-AI9-029(무수정 3행 렌더)와 양립한다.
8. *(v0.0.5)* **빈 판정 헬퍼 공유 방식**(M9.3): `isEmptyOrIdentical(text, '')` 직접 호출 vs 1인자 `isEffectivelyEmpty` 추출 후 카드 헬퍼가 이를 호출. 후자가 의도 표현에 유리하나 `ai-suggestion-card.ts` 를 함께 만지게 된다(그 경우에도 시그니처·동작 무변경 + 카드 테스트 무수정 통과가 조건). Run phase 재량.
9. *(v0.0.5)* **안내 위젯의 아이콘 표기**(M9.3): `ℹ` 병기 여부와 CSS 클래스명(`mdedit-ai-ghost-empty` 등). 기존 카드의 `mdedit-ai-notice` 관례를 참고하되 고스트 전용 클래스를 새로 두는 편이 셀렉터 충돌이 없다. Run phase 재량이나, AC-AI9-026이 클래스가 아닌 **라벨 텍스트**로 단언하므로 테스트를 클래스에 결합시키지 않는다.
10. *(v0.0.5)* **닫기 라벨**(M9.4): `✕ 닫기` vs `닫기`. 고스트의 기존 컨트롤이 `✕ 지우기`·`■ 중지` 형태로 아이콘을 병기하므로 `✕ 닫기` 를 권장한다. AC 단언은 "라벨에 `닫기` 포함"이므로 어느 쪽이든 통과한다.
11. ~~*(v0.0.6)* **고급 토글 라벨 문구**~~ *(v0.0.7에서 해소)*: 라벨의 티어 표기는 백엔드가 내려준 `advancedModelLabel` 을 그대로 감싼 `고급 모델 사용 ({label} — 더 정확, 더 느림)` 로 **확정**되었다(REQ-AI9-048). 남은 재량은 폴백 문구의 `고급 티어` 표현 정도이며, 이는 AC-AI9-030이 표시명 포함만 단언하므로 자유롭다.
12. *(v0.0.6)* **유효 provider 파생 위치**(M10.3.5): `'auto'` 해석을 `AdvancedModelToggle` 내부에서 할지, `AiSection` 이 계산해 prop 으로 내릴지. 후자가 향후 provider 인지 표시가 늘어날 때 재사용에 유리하다. 어느 쪽이든 파생 규칙은 "첫 selectable provider"(REQ-AI9-048) 하나여야 하며 두 곳에 복제하지 않는다. Run phase 재량.
13. *(v0.0.7)* **codex 라벨의 구분자**(M10.3.2): `gpt-5.5 · 높은 추론` 의 ` · ` 를 그대로 쓸지 `, ` 등으로 바꿀지. AC-AI9-031은 "모델 문자열과 effort 표기가 중앙 함수 반환값에서 파생됨"만 단언하므로 구분자는 재량이나, 목표 라벨과 일치하는 ` · ` 를 권장한다.
14. *(v0.0.7)* **`codex_effort_display` 의 배치**(M10.3.2): `codex_cli.rs` 에 두는 것이 자연스러우나, 향후 다른 provider 도 effort 표기를 갖게 되면 공용 위치로 옮길 수 있다. v1은 `codex_cli.rs` 국소화를 권장(매핑 중앙화 원칙과 동일 근거). Run phase 재량.

---

Version: 0.0.7 (draft)
Classification: spec-anchored
Last Updated: 2026-07-25
