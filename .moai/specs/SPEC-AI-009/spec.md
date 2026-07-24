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
  - abstraction
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.1 | 2026-07-24 | jw | 최초 SPEC 작성 — `codex` CLI(0.144.1 검증)를 두 번째 AI 프로바이더로 `ProviderRegistry`에 통합. `provider.rs`의 `AiProvider` trait은 본 확장을 전제로 설계됐다(provider.rs:5-6 "M4 codex 도입 시 어댑터만 추가하면 되도록 trait 계약 확정"). 6개 모듈로 전개: (M1) provider 추상화 확장 — registry 다중 프로바이더 + 자동 감지 우선순위(claude>codex) + `providerId` 수동 오버라이드(기존 `AiRequestArgs.provider_id` 재사용, 신규 IPC 필드 0건); (M2) codex 인자 조립 — `build_codex_args`(순수)가 `exec -C <scratch> --ignore-user-config --skip-git-repo-check --ephemeral --sandbox read-only --model <model> -c 'model_reasoning_effort="medium"' --json "<결합 프롬프트>"` 산출, stdin은 `Stdio::null()`로 의무 차단(안 하면 "Reading additional input from stdin..." 부작용, 실측); (M3) codex JSONL 파싱 — `parse_codex_agent_message`가 `item.completed`+`item.type=="agent_message"`에서 `item.text` 추출해 `ai://chunk`로 **정확히 1회** 통째로 emit(토큰 단위 분할 금지 — agent_message는 완성본 1회 도착, 실측), `turn.completed`에서 `ai://done`으로 마무리, stderr은 기존 `classify_stderr` 재사용; (M4) codex 감지 — `resolve_codex_binary`(PATH → 표준 위치) + `~/.codex/auth.json` 로그인 판정(claude의 `oauthAccount`과 대칭); (M5) provider별 모델 매핑 — claude{haiku,sonnet} / codex{gpt-5.5,gpt-5.5(v1 동일)}로 `AiModel::Haiku/Sonnet`을 그대로 재사용해 UI 변경 최소화; (M6) 무손상 가드 — 기존 claude 빌드/파싱/조립 경로는 동일 입력에 대해 동일 출력(바이트 동등 회귀 테스트로 검증). 4가지 사전 합의 결정(provider 자동 감지+수동 오버라이드 / 모델 매핑 테이블 / system+user "\n\n" 결합 / agent_message 1회 emit + 기존 플레이스홀더 재사용)은 "사전 합의 설계 결정(재검토 금지)" 섹션에 고정. |
| 0.0.2 | 2026-07-24 | jw | plan-auditor 1차 감사(FAIL 0.78/1.00) 피드백 반영 — 결함 6건 개정. **D1**(major): Unwanted REQ 8건(006/008/019/020/022/023/024/025)을 정규 EARS "IF [조건], then the system shall [응답]" 패턴으로 개정(SPEC-AI-001 REQ-AI-008/009/018/027 계보 정합). **D2**(major): 신규 **REQ-AI9-013a**(Event-Driven) 추가 — "chunk 1회 emit 후 turn.completed 누락 EOF" 시나리오를 담당, 기존 AC-AI9-007 case 3의 고아 AC를 이 REQ로 매핑. **D3**(minor): 신규 **REQ-AI9-007a**(Ubiquitous) 추가 — `CodexProvider::spawn`이 `combine_prompts → build_codex_args → spawn_codex` 순서로 호출하는 계약 명시(구현자가 combine_prompts 누락하는 회귀 방지). **D4**(minor): 신규 **AC-AI9-015**(수동 통합) 추가 — `~/.codex/AGENTS.md` 자동 로딩 차단 검증(`--ignore-user-config` + 빈 cwd가 사용자 홈 컨텍스트 오염을 방어하는지 확인, 32K 토큰 폭발 회귀). **D5**(minor): Delta 표에 `claude_cli.rs #[cfg(test)]` 행 추가(REQ-AI9-022 회귀 스냅샷; 프로덕션 코드 무변경, plan.md M1.1과 일치). **D6**(minor): plan.md M3.3에 `build_codex_command(binary, args, cwd) -> Command` 순수 함수 추출 힌트 추가(spawn_codex의 Command 구성을 단위 테스트 가능하게 분리, AC-AI9-005 자동화). REQ 25→27, AC 14→15, 커버리지 대조표 동기화. |

## Summary

`mdedit`(Tauri v2 + React 18 + TypeScript + CodeMirror 6)의 AI 글쓰기 도우미는 현재 `claude` CLI를 단일 서브프로세스 프로바이더로 호출한다. 본 SPEC은 **`codex` CLI(codex-cli 0.144.1)**를 두 번째 프로바이더로 `ProviderRegistry`에 추가해, 사용자 기기에 두 CLI 중 하나라도 설치·로그인되어 있으면 AI 기능이 동작하도록 만든다. `provider.rs`의 trait 설계는 이미 이 확장을 전제로 했다(provider.rs:5-6, 57-74).

핵심 특성:

- **격리 우선**: codex는 `--ignore-user-config --skip-git-repo-check --ephemeral --sandbox read-only`와 빈 스크래치 cwd를 결합해 부작용을 차단한다(`CODEX_HOME` 격리는 시도하지 않는다 — 인증이 풀림, 실측).
- **다른 스트림 포맷**: codex는 `--json`(JSONL)을 내보내며, `claude`의 `stream-json`(`text_delta` 토큰 스트리밍)과는 완전히 다른 이벤트 모델을 쓴다. `item.completed`의 `agent_message`가 **완성본을 한 번에** 실어 보낸다(토큰 단위 스트리밍 아님).
- **UI 무변경**: 프론트의 기존 `aiAdvancedModel` 토글(uiStore)·`ai://chunk|done|error` 이벤트 계약·`waitNotice.ts`의 "✨ 작성 중…" 플레이스홀더·`GhostPlaceholderWidget`은 그대로 재사용된다. provider 전환 UI는 v1에서 도입하지 않는다.
- **하위호환 절대 보존**: 기존 `claude` 경로(`build_claude_args`, `parse_text_delta`, `ClaudeProvider`, `spawn_claude`, prompt.rs 조립)는 바이트 단위로 동등하게 유지된다(회귀 스냅샷 테스트로 검증).

## 사전 합의 설계 결정 (재검토 금지)

> 아래 4가지는 사용자가 기능 합의 단계에서 확정한 결정이다. Run phase에서 재검토하지 않는다. 요구사항 변경이 필요하면 SPEC 개정(버전 올림)으로만 반영한다.

1. **provider 선택 — 자동 감지 + 수동 오버라이드**
   - 두 CLI 중 하나라도 설치+로그인 → AI 기능 동작.
   - 자동 감지 우선순위: **claude 먼저, 그다음 codex**. `claude`가 설치된 환경에서는 `claude`가 기본 프로바이더다.
   - 수동 오버라이드: 프론트 `AiRequestArgs.providerId`(이미 존재, `provider_id: Option<String>`, mod.rs:89)로 특정 provider 강제 선택.
   - `detect.rs`의 기존 `ProviderStatus { id, installed, version?, loggedIn }` 구조체를 그대로 재사용(provider.rs:47-55). 신규 필드·새 enum 금지.

2. **모델 매핑 — provider별 테이블 + 기존 토글 재사용**
   - `AiModel::Haiku`/`AiModel::Sonnet`(provider.rs:13-17)을 **"기본/고급" 의사 티어로 재해석**해 그대로 유지. enum 확장·이름 변경 금지.
   - provider별 매핑:
     | Provider | `AiModel::Haiku`(기본) | `AiModel::Sonnet`(고급) |
     |----------|------------------------|--------------------------|
     | claude   | `haiku`                | `sonnet`                 |
     | codex    | `gpt-5.5`              | `gpt-5.5` (v1 일단 동일) |
   - 프론트의 기존 `aiAdvancedModel` 토글(`uiStore`)을 그대로 재사용 — UI 변경·새 토글 금지.

3. **system_prompt 전달 — `"\n\n"` 결합해 positional 1개로**
   - `prompt.rs`가 산출하는 `(system_prompt, user_prompt)` 쌍을 `format!("{}\n\n{}", system, user)`로 단순 결합해 codex의 **positional 인자 정확히 1개**로 넘긴다(codex는 `claude --system-prompt` 분리 불가, 실측).
   - 결합 문자열은 codex `exec`의 마지막 인자(따옴표로 감싼 단일 arg).

4. **스트리밍 UX — agent_message 도착 시 `ai://chunk` 1회 + 기존 플레이스홀더 재사용**
   - `item.completed`/`agent_message` 도착 순간, 해당 본문 전체를 `ai://chunk` payload로 **정확히 1회** emit(토큰 단위 분할 금지 — codex 자체가 완성본을 한 번에 보냄, 실측).
   - 본문 도착 전까지 기존 "✨ 작성 중…" 플레이스홀더(`waitNotice.ts`, `GhostPlaceholderWidget`)를 재사용. 새 "대기 중" UI 금지.
   - `turn.completed`에서 `ai://done`(payload: `result`=마지막 agent_message 본문, `truncated`=기존 정책 전달)으로 마무리.

## Background & Rationale

현재 `mdedit`의 AI 기능(인라인 편집·고스트 텍스트·섹션 채우기·다이어그램 생성 등)은 전부 `claude` CLI에 단일 의존한다. 사용자 기기 분포를 보면 `claude` 대신 `codex`가 설치된 경우가 있어, 단일 프로바이더 고정이 진입 장벽으로 작용한다. `provider.rs`는 본 확장을 대비해 `AiProvider` trait(`id`/`detect`/`spawn`/`capabilities`)과 `ProviderRegistry`(다중 provider·`route(provider_id)`)를 미리 확정했다(provider.rs:5-6, 65-127).

`codex` CLI는 OpenAI 계열 사용자에게 익숙하고, `claude`와는 별개 인증(`~/.codex/auth.json`)·별도 출력 포맷(JSONL)을 쓴다. 본 SPEC은 이 차이를 trait 뒤에 숨기고, 호출부(mod.rs:122 `ai_request`)는 동일한 `route → spawn → relay` 경로를 유지하게 만든다.

기술 컨텍스트(소스 근거, 실측):

- **provider trait 확장 지점**: `provider.rs:65-74`의 `AiProvider` trait 4개 메서드 + `Capabilities { supports_streaming, typical_latency_ms }`(provider.rs:58-62). codex는 `supports_streaming = false`에 가까운 의미(`agent_message` 1회 도착 = UI 입장에서 스트리밍이 아닌 한 번에 표시)로 설정해 `relay` 계약을 분기 가능하게 한다(다만 `ai://chunk` 1회 emit으로 프론트 호환성은 유지).
- **레지스트리 등록 지점**: `claude_cli.rs:305-307`의 `claude_registry()`가 현재 `vec![Box::new(ClaudeProvider::new())]`로 단일 provider를 등록한다. 본 SPEC은 동일 지점에 codex를 추가 등록하거나 새 `default_registry()`를 신설한다(REQ-AI9-003).
- **route 계약 재사용**: `ProviderRegistry::route(provider_id)`(provider.rs:121-126)는 `Some(id)`→이름 조회, `None`→`default_provider()`(첫 등록). `mod.rs:173-175`는 이미 `registry.route(args.provider_id.as_deref())`를 호출하고 있어 **IPC부터 route까지의 배선은 이미 완성되어 있다** — 본 SPEC이 다루는 것은 registry의 내용과 각 provider의 구현뿐이다.
- **빈 스크래치 cwd 재사용**: `claude_cli.rs:106-111`의 `ensure_scratch_dir(app_data_dir)`이 앱 데이터 디렉토리 하위 `ai-scratch/`를 빈 디렉토리로 보장한다. codex도 동일 cwd를 쓴다(`-C <scratch>`).
- **stdin null 패턴**: `claude_cli.rs:180`는 `.stdin(Stdio::null())`로 claude의 stdin 대기를 차단한다. codex도 동일 패턴 적용 — 안 하면 codex가 "Reading additional input from stdin..."을 출력하며 stdin을 읽으려 시도한다(실측, 4회 테스트).
- **절대경로 스폰**: `claude_cli.rs:172-174`는 `detect::claude_binary()`가 해석한 절대경로로 스폰한다(GUI 최소 PATH 우회). codex도 `detect::codex_binary()` 절대경로를 쓴다.
- **스트림 파서 분리 필요**: `stream.rs:40-55`의 `parse_text_delta`는 claude 전용(`stream_event`/`content_block_delta`/`text_delta` 경로). codex JSONL은 `item.completed`/`agent_message`/`turn.completed` 등 다른 이벤트 타입을 써서 **별도 파서가 필요**하다(stream.rs에 신규 함수 추가).
- **stderr 분류 재사용**: `stream.rs:78-126`의 `classify_stderr`는 login/network/other 휴리스틱을 표준화해 둔다. codex stderr에도 그대로 적용한다 — codex 전용 분류 로직 중복 금지.
- **로그인 판정 대칭**: `detect.rs:99-107`의 `is_logged_in(home)`은 `~/.claude.json`의 `oauthAccount` 키 또는 레거시 자격 파일로 claude 로그인을 판정한다. codex는 `~/.codex/auth.json` 존재로 판정한다(단일 휴리스틱).
- **AI 토글 무관**: `mod.rs:128-130`의 `ai_policy_disabled` kill-switch는 provider 무관. SPEC-AI-005의 `effectiveAiEnabled` 토글도 provider 무관. 본 SPEC은 토글 분기를 추가하지 않는다.

## Environment & Assumptions

- **codex CLI**: `codex-cli 0.144.1`(실측, 2026-07-24). 향후 상위 버전은 `-c 'model_reasoning_effort="medium"'` 등 플래그 호환성을 전제로 한다(플래그 시퀀스는 REQ-AI9-004에 고정, codex-cli 버전업 시 단위 테스트로 회귀 포착).
- **작동 명령(macOS, 빈 스크래치 cwd)**:
  ```
  codex exec -C <빈TMP> --ignore-user-config --skip-git-repo-check --ephemeral \
    --sandbox read-only --model gpt-5.5 -c 'model_reasoning_effort="medium"' \
    --json "<결합된 프롬프트>"
  ```
- **백엔드**: Rust `src-tauri/src/ai/{mod.rs, provider.rs, claude_cli.rs, stream.rs, detect.rs, prompt.rs}`. `Cargo.toml` 의존성 무변경(신규 런타임 크레이트 금지, `std::process::Command` 사용).
- **프론트엔드**: React 18, TypeScript strict. `src/lib/tauri/ipc.ts`의 `AiRequestArgs` 타입에 `providerId?`가 이미 존재(mod.rs:89와 대칭). 본 SPEC은 프론트 파일을 수정하지 않는다(자동 감지 + 기존 토글 재사용).
- **IPC 계약**: `AiRequestArgs`의 camelCase → snake_case 매핑(mod.rs:84-116). 본 SPEC은 새 필드를 추가하지 않는다(`provider_id`만 재사용).
- **출력 이벤트**: `ai://chunk`(`{requestId, text}`), `ai://done`(`{requestId, result, truncated?}`), `ai://error`(`{requestId, kind, message, cancelledBy?}`) — 전부 기존 계약(claude_cli.rs:27-54).
- **테스트 환경**: Rust `#[cfg(test)]` 단위 테스트(claude_cli.rs:309-, detect.rs:290-, stream.rs:128- 패턴). codex 감지 함수는 순수/부작용 분리해 단위 테스트. codex JSONL 파서는 JSON fixture 기반 단위 테스트.

## Requirements (EARS)

> 변경 유형 태그: **[NEW]** = 신규 파일/함수/메서드, **[MODIFY]** = 기존 파일 수정, **[EXISTING]** = 기존 자산 변경 없이 재사용(회귀 가드 대상). REQ ID 접두사 `AI9`는 SPEC-AI-001의 `REQ-AI-XXX`와 충돌하지 않는다(SPEC-AI-003의 `AI3`, SPEC-AI-005의 `AI5`, SPEC-AI-006의 `AI6` 계보).

### 모듈 1 — Provider 추상화 확장 (registry에 codex 등록, 자동 감지, 수동 오버라이드)

- **REQ-AI9-001** (Ubiquitous) **[MODIFY]**: The system **shall** 항상 `ProviderRegistry`에 `claude`와 `codex` 프로바이더를 **정확히 2개** 등록하고, `claude`를 첫 번째(등록 순서상 default)로 둔다. `registry.ids()`는 `["claude", "codex"]`를 반환한다.
- **REQ-AI9-002** (Ubiquitous) **[MODIFY]**: The system **shall** `default_provider()`가 "installed && logged_in" 조건을 만족하는 첫 프로바이더를 자동 선택하게 한다. `claude`가 설치+로그인된 환경에서는 `claude`가 기본이고, `claude`가 미설치 또는 미로그인이고 `codex`만 사용 가능하면 `codex`가 기본이다. 둘 다 사용 불가면 `None`(기존 "사용 가능한 AI 도구가 없어요" 오류로 연결).
- **REQ-AI9-003** (Ubiquitous) **[EXISTING]**: The system **shall** `ProviderRegistry::route(args.provider_id.as_deref())`(provider.rs:121-126) 호출을 그대로 재사용해, `providerId`가 명시되면 해당 provider, 생략되면 REQ-AI9-002의 자동 감지 결과로 라우팅한다. `mod.rs:173-175`의 호출부 변경 없음(이미 `route(provider_id)`를 쓰고 있음).

### 모듈 2 — codex 인자 조립 (검증된 플래그, stdin null, system+user 결합)

- **REQ-AI9-004** (Ubiquitous) **[NEW]**: The system **shall** `build_codex_args(model: AiModel, combined_prompt: &str) -> Vec<String>` 순수 함수를 `codex_cli.rs`에 제공한다. 산출 인자는 정확히 다음 순서여야 한다:
  ```
  ["exec", "-C", "<scratch>", "--ignore-user-config", "--skip-git-repo-check",
   "--ephemeral", "--sandbox", "read-only", "--model", "<model_arg>",
   "-c", "model_reasoning_effort=\"medium\"", "--json", "<combined_prompt>"]
  ```
  여기서 `<scratch>`는 빈 스크래치 디렉토리 절대경로, `<model_arg>`는 REQ-AI9-019의 매핑 결과, `<combined_prompt>`는 REQ-AI9-006의 결합 결과다. 인자 순서·개수는 codex-cli 0.144.1 실측을 기준으로 한다.
- **REQ-AI9-005** (Ubiquitous) **[NEW]**: The system **shall** codex 호출 시 `system_prompt`와 `user_prompt`를 `format!("{}\n\n{}", system_prompt, user_prompt)`로 결합해 단일 positional 인자로 전달한다. 결합 문자열은 codex `exec`의 마지막 인자(REQ-AI9-004)이다. `--system-prompt` 같은 분리 플래그를 쓰지 않는다(codex 미지원, 실측).
- **REQ-AI9-006** (Unwanted) **[NEW]**: **IF** `spawn_codex` 호출 시 codex 프로세스의 stdin이 열려 있으면(Stdio::null()로 차단되지 않은 상태), **then** the system **shall** 반드시 `.stdin(Stdio::null())`로 stdin을 차단한다 — 그렇지 않으면 codex가 "Reading additional input from stdin..."을 출력하며 환경 의존적 부작용을 유발한다(실측). `claude_cli.rs:180`과 동일 패턴.
- **REQ-AI9-007** (Ubiquitous) **[NEW]**: The system **shall** `spawn_codex(args: &[String], cwd: &Path) -> Result<Child, String>`를 제공한다. 이 함수는 (a) `detect::codex_binary()`가 해석한 절대경로로 스폰(GUI 최소 PATH 우회), (b) `process_util::no_window`로 Windows 콘솔 깜빡임 차단, (c) `cwd`를 빈 스크래치 디렉토리로 고정, (d) `.stdin(Stdio::null())`, `.stdout(Stdio::piped())`, `.stderr(Stdio::piped())`를 적용한다(`spawn_claude` claude_cli.rs:170-185과 동일 구조).
- **REQ-AI9-007a** (Ubiquitous) **[NEW]**: The system **shall** `CodexProvider::spawn(request, cwd)`이 **정확히 다음 순서**로 내부 호출을 수행하게 한다: (1) `combine_prompts(request.system_prompt, request.user_prompt)` → 결합 문자열, (2) `build_codex_args(request.model, combined)` → 인자 벡터, (3) `spawn_codex(args, cwd)` → 자식 프로세스. 이 순서를 건너뛰거나 임의로 바꾸는 구현을 허용하지 않는다(구현자가 `combine_prompts` 누락 시 codex가 빈 프롬프트를 받거나 system/user가 분리되어 전달되는 회귀 방지).
- **REQ-AI9-008** (Unwanted) **[NEW]**: **IF** 코드가 `CODEX_HOME` 환경변수를 설정해 codex 인증·설정을 격리하려 시도하면, **then** the system **shall** 이를 거부한다 — codex 도움말에 명시된 대로 auth도 `CODEX_HOME`을 써서 이 값을 바꾸면 인증이 풀린다(실측). 격리는 빈 cwd(`-C <scratch>`) + `--ignore-user-config` + `--sandbox read-only` 조합으로만 달성한다(`build_codex_args`가 반드시 이 3개 플래그를 포함하는지 단위 테스트로 검증).

### 모듈 3 — codex JSONL 파싱 (agent_message → ai://chunk 1회, turn.completed → done)

- **REQ-AI9-009** (Ubiquitous) **[NEW]**: The system **shall** `parse_codex_agent_message(line: &str) -> Option<String>` 순수 함수를 `stream.rs`에 제공한다. 이 함수는 codex `--json` 출력 한 줄을 파싱해, 해당 라인이 `item.completed` 이벤트이고 그 `item.type`이 `"agent_message"`이면 `item.text` 필드의 문자열을 반환한다. 그 외 이벤트 타입(`thread.started`, `turn.started`, `turn.completed`, 기타)이거나 JSON 파싱에 실패하면 `None`을 반환한다(panic 없음, raw JSON 노출 없음 — `parse_text_delta` stream.rs:40-55와 동일한 안전 계약).
- **REQ-AI9-010** (Ubiquitous) **[NEW]**: The system **shall** `parse_codex_turn_completed(line: &str) -> bool` 순수 함수를 제공한다. `turn.completed` 이벤트(usage 포함 최종 종료 신호) 라인이면 `true`, 그 외에는 `false`를 반환한다. 파싱 실패 시 `false`(panic 없음).
- **REQ-AI9-011** (Event-Driven) **[NEW]**: **WHEN** codex 릴레이 스레드가 stdout에서 `parse_codex_agent_message`가 `Some(text)`를 반환하는 라인을 수신하면, **the system shall** 해당 `text` 전체를 `ai://chunk` payload(`{requestId, text}`)로 **정확히 1회** emit한다. 토큰 단위 분할·청킹 금지 — codex의 `agent_message`는 완성본을 한 번에 보낸다(실측).
- **REQ-AI9-012** (Event-Driven) **[NEW]**: **WHEN** codex 릴레이가 `parse_codex_turn_completed`가 `true`인 라인을 수신하면, **the system shall** `ai://done` payload(`{requestId, result, truncated}`)을 발행한다. `result`는 가장 마지막으로 수신한 `agent_message` 본문(앞서 emit한 `ai://chunk`의 text와 동일). `truncated`는 기존 `assemble.truncated`(mod.rs:166) 값을 전달한다.
- **REQ-AI9-013** (Unwanted) **[NEW]**: **IF** codex stdout이 `agent_message`도 `turn.completed`도 없는 채 EOF에 도달하면, **then** the system shall 기존 `decide_outcome(final_result, stderr, cancelled, saw_stream_output)`(claude_cli.rs:145-165) 경로로 폴백한다. `final_result`는 `None`, `saw_stream_output`은 "stdout에 JSON 라인이 하나라도 왔는지"로 정의한다 — 이 경우 `parse` 또는 `other` kind의 `ai://error`가 발행된다(새 오류 종류·새 분기 금지).
- **REQ-AI9-013a** (Event-Driven) **[NEW]**: **WHEN** codex 릴레이가 `ai://chunk`(REQ-AI9-011)를 1회 emit한 이후 `turn.completed` 라인 수신 없이 stdout이 EOF하면, **the system shall** 마지막으로 수신한 `agent_message` 본문을 `result`로 하는 `ai://done` payload(`{requestId, result, truncated}`)을 발행한다(이미 사용자에게 본문이 전달된 상태이므로 `parse` 폴백 대신 정상 종료 처리). `truncated`는 기존 `assemble.truncated` 값을 전달한다. (참고: 본 REQ는 `chunk`를 1회라도 emit 한 케이스를 담당하며, `chunk` 0회인 폴백은 REQ-AI9-013이 담당한다.) 단, `claim_terminal` 단일 발행(SPEC-AI-006 REQ-AI6-006)을 선점한 경우에만 emit한다.
- **REQ-AI9-014** (Ubiquitous) **[NEW]**: The system **shall** codex stderr을 기존 `classify_stderr(stderr)`(stream.rs:78-126)로 분류한다. codex 전용 stderr 분류 로직·새 marker 상수를 중복 정의하지 않는다(단, `classify_stderr` 자체는 변경하지 않는다).

### 모듈 4 — codex 감지 (resolve_codex_binary, ~/.codex/auth.json 로그인)

- **REQ-AI9-015** (Ubiquitous) **[NEW]**: The system **shall** `resolve_codex_binary() -> Option<PathBuf>` 함수를 `detect.rs`에 제공한다. PATH의 각 디렉토리 + `codex`(Windows는 `codex.exe`) 후보를 먼저 만들고, 이어서 플랫폼 표준 설치 위치(macOS: `/opt/homebrew/bin/codex`, `/usr/local/bin/codex`, `~/.local/bin/codex`; Windows: `~/.local/bin/codex.exe`, `%APPDATA%\npm\codex.cmd`) 후보를 추가한다. 첫 번째로 존재하는 경로를 반환한다(`resolve_claude_binary` detect.rs:226-248과 동일 구조, 별도 함수). nvm 후보나 로그인셸 프로브는 v1에서 생략한다(별도 REQ로 확장 가능).
- **REQ-AI9-016** (Ubiquitous) **[NEW]**: The system **shall** `is_codex_logged_in(home: &Path) -> bool` 순수 함수를 제공한다. `home.join(".codex").join("auth.json")` 경로가 존재하면 `true`, 그 외 `false`를 반환한다(파일 내용 파싱은 v1에서 요구하지 않는다 — 존재 사실만). claude의 `is_logged_in`(detect.rs:99-107)과 대칭.
- **REQ-AI9-017** (Ubiquitous) **[NEW]**: The system **shall** `detect_codex() -> ProviderStatus`를 제공한다. `codex --version`(또는 `codex --help`의 버전 출력)이 성공하면 `installed=true` + 파싱된 version, 실패하면 `installed=false` + `version=None`으로 `ProviderStatus { id: "codex", installed, version, logged_in }`를 반환한다(`detect_claude` detect.rs:262-288과 동일 구조). `logged_in`은 `installed && is_codex_logged_in(home)`. 미설치 환경에서도 panic 없이 `id="codex"` 상태를 반환한다.

### 모듈 5 — 모델 매핑 (provider별 테이블, 기존 AiModel 재사용)

- **REQ-AI9-018** (Ubiquitous) **[NEW]**: The system **shall** codex의 `--model` 인자 값을 `AiModel::Haiku → "gpt-5.5"`, `AiModel::Sonnet → "gpt-5.5"`(v1 일단 동일)로 매핑한다. 매핑 로직은 `build_codex_args`(REQ-AI9-004) 내부 또는 `CodexProvider` 메서드로 중앙화한다(분산 금지). "Model Mapping" 표(아래) 참조.
- **REQ-AI9-019** (Unwanted) **[NEW]**: **IF** 코드가 `AiModel` enum의 변형(variant) 이름을 바꾸거나 신규 variant 추가를 시도하면, **then** the system **shall** 이를 거부한다 — `Haiku`/`Sonnet` 이름은 claude 특정 값처럼 보이나 본 SPEC에서는 **"기본/고급 티어" 의사 이름**으로 재해석해 그대로 유지한다. 프론트의 `aiAdvancedModel` 토글(uiStore)·`ipc.ts`의 `model?: 'haiku'|'sonnet'` 계약이 이 enum에 묶여 있어 변경하면 연쇄 파급이 발생한다(회귀 스냅샷 어서션으로 검증).
- **REQ-AI9-020** (Unwanted) **[NEW]**: **IF** 코드가 프론트엔드에 provider 선택 UI·provider 상태 표시·"codex 사용 중" 인디케이터 등 새 컴포넌트 도입을 시도하면, **then** the system **shall** 이를 거부한다(v1). provider 선택은 (a) 자동 감지(REQ-AI9-002)와 (b) 설정 파일 또는 개발자 도구에서의 `providerId` 오버라이드(REQ-AI9-003)로만 이뤄진다. 사용자용 설정 UI는 본 SPEC 범위 밖(별도 SPEC). PR diff에서 `src/components/` 변경 파일이 0건임을 어서션(AC-AI9-011).

### 모듈 6 — 무손상/하위호환 (claude 경로·IPC·프롬프트 조립 무변경, 회귀 가드)

- **REQ-AI9-021** (Ubiquitous) **[EXISTING]**: The system **shall** 기존 IPC 계약 `AiRequestArgs.providerId`(`provider_id: Option<String>`, mod.rs:89, `#[serde(default)]`)를 재사용한다. 새 IPC 필드·새 이벤트 타입을 추가하지 않는다. `ai://chunk`/`ai://done`/`ai://error` payload 스키마(claude_cli.rs:27-54)도 무변경.
- **REQ-AI9-022** (Unwanted) **[REGRESSION_GUARD]**: **IF** codex 통합 코드가 기존 claude 인자 조립(`build_claude_args(model, system_prompt, user_prompt)`, claude_cli.rs:81-98)을 수정하려 시도하면, **then** the system **shall** 이를 거부한다 — 동일 `(AiModel, &str, &str)` 입력에 대해 산출 `Vec<String>`이 **변경 전과 바이트 단위로 동일**해야 한다(Rust `#[cfg(test)]` 회귀 스냅샷 어서션, `claude_cli.rs` 내 `#[cfg(test)]`에 신규 추가).
- **REQ-AI9-023** (Unwanted) **[REGRESSION_GUARD]**: **IF** codex 통합 코드가 기존 claude 파서(`parse_text_delta`(stream.rs:40-55)·`parse_final_result`(stream.rs:62-72))를 수정하려 시도하면, **then** the system **shall** 이를 거부한다 — 동일 JSON 라인 입력에 대해 동일 `Option<String>`을 반환해야 한다(회귀 단위 테스트로 검증).
- **REQ-AI9-024** (Unwanted) **[REGRESSION_GUARD]**: **IF** codex 통합 코드가 기존 claude 프롬프트 조립(`prompt.rs`의 `build_inline_prompt`/`build_section_prompt`/`build_continue_prompt_with_length`)을 수정하려 시도하면, **then** the system **shall** 이를 거부한다 — 동일 `(feature, presetKind, customInstruction, selection, contextBefore, contextAfter, outline, diagramType)` 입력에 대해 산출 `(system_prompt, user_prompt)` 쌍이 **변경 전과 바이트 단위로 동일**해야 한다(SPEC-AI-008 REQ-AI-008-025 회귀 가드와 동일 계약, 회귀 스냅샷 테스트로 검증).
- **REQ-AI9-025** (Unwanted) **[GUARD]**: **IF** 자동 감지 로직이 `claude`가 설치+로그인된 환경에서 `codex`를 기본 프로바이더로 선택하려 시도하면, **then** the system **shall** 이를 거부하고 `claude`를 기본으로 둔다(REQ-AI9-002 우선순위 계약). `claude` 미설치 환경에서만 `codex`가 폴백 기본이다(`first_available()` 단위 테스트로 검증).

## Model Mapping

아래 표는 REQ-AI9-018의 매핑 계약을 고정한다. `AiModel::Haiku`/`Sonnet`은 provider 무관 "기본/고급" 티어 의사 이름이며, 각 provider가 자체 문자열로 변환한다.

| Provider | `AiModel::Haiku` → `--model` 값 | `AiModel::Sonnet` → `--model` 값 | 매핑 소유 함수 |
|----------|----------------------------------|----------------------------------|----------------|
| claude   | `haiku`                          | `sonnet`                         | `AiModel::as_arg()` (provider.rs:21-26, 기존 무변경) |
| codex    | `gpt-5.5`                        | `gpt-5.5` (v1 동일)              | `build_codex_args` 내부 match (REQ-AI9-004, REQ-AI9-018) |

> codex의 양 티어가 동일한 `gpt-5.5`로 매핑되는 것은 v1 한정 결정이다(사전 합의). 이후 SPEC 개정으로 `gpt-5.5` 이외 모델을 도입할 때는 본 표와 REQ-AI9-018을 함께 개정한다.

## Design Notes / Future Considerations

> 아래는 요구사항이 아니며(AC 없음), Run phase의 설계 참고 사항이다.

- **`default_registry()` 신설 힌트(REQ-AI9-001)**: `claude_cli.rs:305-307`의 `claude_registry()`를 `default_registry()`로 리네임하고 codex를 추가 등록하는 방식을 상정한다. 또는 `claude_registry()`를 남기고 `default_registry()`를 별도 함수로 두는 방식도 허용된다 — 어느 쪽이든 `mod.rs:172`의 호출 지점이 새 함수를 가리키게 한다. 기존 `claude_registry()`를 호출하는 테스트(claude_cli.rs:551-572 `registry_registers_exactly_one_claude_adapter` 등)는 새 구조에 맞게 업데이트한다.
- **`ProviderRegistry::default_provider()` 강화 힌트(REQ-AI9-002)**: 현재 `default_provider()`는 단순 `first()`(provider.rs:111-113)를 반환한다. "installed && logged_in 필터"를 적용하려면 (a) `default_provider()` 자체를 강화하거나, (b) `first_available()` 신규 메서드를 두고 `route(None)`이 이를 호출하게 한다. (a)는 기존 테스트(provider.rs:193-207)에 영향을 주므로, (b)가 회귀 측면에서 안전하다.
- **`Capabilities` 분기 힌트**: codex `CodexProvider::capabilities()`는 `supports_streaming = false`(완성본 1회 도착이므로), `typical_latency_ms`는 실측 값(수 초)으로 둔다. 현재 `Capabilities`를 소비하는 분기는 없지만(모든 provider가 동일한 `relay_process` 경로를 탐), 향후 "비스트리밍 provider 전용 단일 emit 경로"를 도입할 때 분기 기준으로 쓰일 수 있다.
- **`build_codex_args` 인자 순서 검증 힌트(REQ-AI9-004)**: codex-cli 버전 업그레이드 시 플래그 호환성이 깨질 수 있다. 단위 테스트는 (a) 정확한 순서·개수·값의 스냅샷 어서션, (b) `--ignore-user-config`/`--sandbox read-only`/`--json` 등 격리·출력 플래그가 빠지지 않았는지 개별 어서션을 둔다.
- **codex 로그인 판정 고도화(REQ-AI9-016 확장)**: v1은 `auth.json` 존재만 본다. 향후 `auth.json`의 JSON 내용(예: 만료 시간)을 파싱해 토큰 만료를 선제 판정하려면 별도 REQ로 도입한다. 본 v1에서는 "파일 있음 = 로그인 됨" 휴리스틱만 유지한다.
- **`~/.codex/AGENTS.md` 오염 문서화(REQ-AI9-008 보조)**: `--ignore-user-config`는 `~/.codex/AGENTS.md` 자동 로딩을 차단하지만, 사용자 기기에 이 파일이 있으면 빈 cwd에서도 일부 컨텍스트 주입이 가능하다는 보고가 있다(실측: 32K 토큰 폭발 사례). 본 v1에서는 `--ignore-user-config` + 빈 cwd로 1차 방어하고, 추가 차단(예: 별도 환경변수)은 후속 SPEC에서 다룬다. Run phase는 `build_codex_args`에 `--ignore-user-config`가 반드시 포함되는지 단위 테스트로 검증한다(REQ-AI9-004).
- **`item.completed` JSON 형태 확정(REQ-AI9-009 구현 힌트)**: codex 0.144.1 실측 기준 `agent_message` 본문은 `item.completed` 이벤트의 `item.text`에 문자열로 들어있다. 정확한 JSON 경로(예: 최상위 `type` vs `event.type`)와 `item` 배열/단일 여부는 Run phase에서 실제 출력을 붙잡아 확정한다 — 파서는 형태가 다르면 `None`을 반환해 안전하게 폴백(REQ-AI9-013)되므로, 과잉 단언보다는 유연한 탐색 + 단위 테스트 fixture로 검증한다.
- **모델 매핑 중앙화(REQ-AI9-018 구현 힌트)**: `build_codex_args` 내부에서 `match model { Haiku|Sonnet => "gpt-5.5" }`로 직접 처리하는 것이 가장 단순하다. `AiProvider` trait에 `fn model_arg(&self, AiModel) -> &str`를 추가하는 것은 확장성은 좋으나 기존 trait 호출부(claude_cli.rs:291 `build_claude_args(request.model, ...)`)에 영향을 주므로 v1에서는 과잉 설계다. 매핑 로직이 3곳 이상으로 퍼지면 그때 trait 메서드로 통합한다.

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [NEW] | `src-tauri/src/ai/codex_cli.rs` | 신규 파일. `CodexProvider` 구조체 + `build_codex_args`(순수, REQ-AI9-004) + `spawn_codex`(REQ-AI9-007) + `CodexProvider::capabilities()`(supports_streaming=false, typical_latency_ms=실측) + `CodexProvider::detect()` 위임(detect.rs). `claude_cli.rs` 구조를 차용, 예상 ~150줄. |
| [MODIFY] | `src-tauri/src/ai/stream.rs` | `parse_codex_agent_message`(REQ-AI9-009) + `parse_codex_turn_completed`(REQ-AI9-010) 순수 함수 추가. 기존 `parse_text_delta`/`parse_final_result`/`classify_stderr`은 무변경(REQ-AI9-023). `#[cfg(test)]`에 codex JSONL fixture 단위 테스트 추가. |
| [MODIFY] | `src-tauri/src/ai/detect.rs` | `resolve_codex_binary`(REQ-AI9-015) + `codex_binary`(캐시 래퍼, `claude_binary` detect.rs:251-258과 대칭) + `is_codex_logged_in`(REQ-AI9-016) + `detect_codex`(REQ-AI9-017) 추가. 기존 claude 함수들은 무변경. `#[cfg(test)]`에 codex 경로/로그인 판정 단위 테스트 추가. |
| [MODIFY] | `src-tauri/src/ai/claude_cli.rs` 또는 `provider.rs` | 기존 `claude_registry()`를 `default_registry()`로 리네임하거나(또는 신규 `default_registry()` 추가) `ProviderRegistry::first_available()`(REQ-AI9-002) 신설. 어느 쪽이든 `mod.rs:172`의 호출 지점이 새 함수를 가리키게 업데이트. 기존 `claude_registry()` 단위 테스트(claude_cli.rs:551-572)는 새 구조에 맞게 이동/확장(claude 1개 + codex 1개 등록 어서션으로 교체). |
| [MODIFY] | `src-tauri/src/ai/claude_cli.rs` (`#[cfg(test)]`) | **REQ-AI9-022 회귀 스냅샷 추가** — `build_claude_args`의 `(AiModel, &str, &str)` 입력별 산출 `Vec<String>`을 하드코딩 어서션으로 고정(프로덕션 코드 `build_claude_args` 자체는 무변경). 본 행은 plan.md M1.1과 일치하며, codex 통합 코드가 의도치 않게 claude 인자 시퀀스를 건드린 경우 즉시 포착. |
| [MODIFY] | `src-tauri/src/ai/mod.rs` | (a) `ai_request`(mod.rs:122)가 `default_registry()`를 쓰도록 호출 지점 변경(이미 `route(args.provider_id.as_deref())`는 호출 중). (b) codex 릴레이 진입 시 `parse_codex_agent_message`/`parse_codex_turn_completed`를 쓰는 경로 분기 추가 — 단, 분기는 provider id 또는 `Capabilities::supports_streaming`으로 판단. `claude` 경로는 기존 `parse_text_delta`/`parse_final_result` 그대로(REQ-AI9-023 회귀 가드). |
| [MODIFY] | `src-tauri/src/ai/codex_cli.rs` (`#[cfg(test)]`) | `build_codex_args` 인자 순서/개수/값 스냅샷, 모델 매핑(Haiku/Sonnet → gpt-5.5), stdin null/절대경로/cwd 설정 단위 테스트 추가. |
| [MODIFY] | `src-tauri/src/ai/stream.rs` (`#[cfg(test)]`) | codex JSONL fixture(`thread.started`/`turn.started`/`item.completed(agent_message)`/`turn.completed`/비정형 라인)로 `parse_codex_agent_message`/`parse_codex_turn_completed` 단위 테스트 추가. 기존 claude 파서 테스트(stream.rs:128-258) 무변경(REQ-AI9-023). |
| [MODIFY] | `src-tauri/src/ai/detect.rs` (`#[cfg(test)]`) | `resolve_codex_binary` 후보 순서·표준 위치 포함 어서션, `is_codex_logged_in` true/false 케이스, `detect_codex` 미설치 환경 panic 없음 어서션 추가. |
| [NEW] | `src-tauri/src/ai/claude_cli.rs` (`#[cfg(test)]`) 또는 `provider.rs` (`#[cfg(test)]`) | REQ-AI9-001 registry 2개 등록(claude+codex) 어서션 + REQ-AI9-002 자동 감지 우선순위(claude 설치 시 claude 기본, claude 미설치 시 codex 폴백) 회귀 테스트. |

> 핵심 불변(단일 소스 원칙): 기존 `claude` 관련 코드(`build_claude_args`, `parse_text_delta`, `parse_final_result`, `classify_stderr`, `ClaudeProvider`, `spawn_claude`, prompt.rs 전체)는 **직접 수정하지 않는다**(REQ-AI9-022, REQ-AI9-023, REQ-AI9-024). codex는 신규 파일·신규 함수로 분리되며, 공유 지점은 `ProviderRegistry`와 `route()` 호출뿐이다.

## Acceptance Criteria

> 컴포넌트 단위는 Rust `#[cfg(test)]`로 검증(순수 함수 중심). 통합 검증(codex 실제 호출)은 로컬 수동 테스트로 별도 수행. 각 AC의 Given-When-Then 상세는 sibling `acceptance.md`(AC-AI9-001~014)에 전개되어 있다.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-AI9-001 | REQ-AI9-001, 002, 003 | `default_registry()`가 `claude`+`codex` 정확히 2개 등록; 자동 감지가 "설치+로그인" 첫 provider 선택(claude 설치 시 claude, codex만 사용 가능 시 codex, 둘 다 불가 시 None) |
| AC-AI9-002 | REQ-AI9-001, 025 | registry.ids() == ["claude", "codex"]; `providerId` 명시 시 해당 provider 강제 라우팅, 미명시 시 우선순위 적용; codex가 claude 설치 환경에서 기본이 되지 않음 |
| AC-AI9-003 | REQ-AI9-004, 018 | `build_codex_args(Haiku, "combine")` 산출 `Vec<String>`이 플래그 전체(`exec`/`-C`/`--ignore-user-config`/`--skip-git-repo-check`/`--ephemeral`/`--sandbox read-only`/`--model gpt-5.5`/`-c model_reasoning_effort="medium"`/`--json`/결합 프롬프트)를 정확한 순서로 포함 |
| AC-AI9-004 | REQ-AI9-005 | system+user 결합이 `format!("{}\n\n{}", s, u)`로 단일 인자 생성; codex 산출 인자의 마지막 원소가 결합 문자열과 바이트 동일 |
| AC-AI9-005 | REQ-AI9-006, 007, 008 | `spawn_codex`가 `.stdin(Stdio::null())` + `.stdout(piped())` + `.stderr(piped())` + `no_window` + 빈 scratch cwd + 절대경로 `codex_binary()` 사용; `CODEX_HOME` 환경변수 설정 코드 부재 |
| AC-AI9-006 | REQ-AI9-009, 010 | `parse_codex_agent_message`가 `item.completed`+`agent_message` 라인에서 `item.text` 추출(`Some`), 그 외 이벤트/비정형 라인은 `None`; `parse_codex_turn_completed`가 `turn.completed` 라인에서만 `true` |
| AC-AI9-007 | REQ-AI9-011, 012 | codex 릴레이가 `agent_message` 수신 시 `ai://chunk`를 정확히 1회 emit(토큰 분할 금지); `turn.completed` 수신 시 `ai://done`({result=마지막 agent_message, truncated=전달값}) emit |
| AC-AI9-008 | REQ-AI9-013, 014 | codex stdout이 비었거나 비정형 라인만 있는 채 EOF 시 기존 `decide_outcome` 경로로 폴백(`parse`/`other` kind `ai://error`); codex stderr은 기존 `classify_stderr`로 분류(login/network/other) — codex 전용 분류 코드 부재 |
| AC-AI9-009 | REQ-AI9-015 | `resolve_codex_binary`가 PATH 후보 + 플랫폼 표준 위치(macOS/Linux/Windows) 후보를 생성하고 첫 존재 경로 반환; 미설치 환경에서 `None`(panic 없음) |
| AC-AI9-010 | REQ-AI9-016, 017 | `is_codex_logged_in(home)`이 `~/.codex/auth.json` 존재 시 `true`, 부재 시 `false`; `detect_codex()`가 `id="codex"` + installed/logged_in 상태를 panic 없이 반환 |
| AC-AI9-011 | REQ-AI9-018, 019, 020 | codex `--model` 매핑이 Haiku/Sonnet 모두 `gpt-5.5`; `AiModel` enum variant 무변경; 프론트 provider 선택 UI 신규 컴포넌트 부재(`src/components/` 무변경) |
| AC-AI9-012 | REQ-AI9-021 | IPC 계약 변경 없음 — `AiRequestArgs` 신규 필드 부재, `provider_id`만 재사용; `ai://chunk`/`done`/`error` payload 스키마 무변경 |
| AC-AI9-013 | REQ-AI9-022, 023 | 회귀 가드 통과 — `build_claude_args` 동일 입력에 동일 산출(바이트 동등 스냅샷); `parse_text_delta`/`parse_final_result` 동일 입력에 동일 `Option<String>`(단위 테스트 전수 통과) |
| AC-AI9-014 | REQ-AI9-024 | `prompt.rs` 조립 회귀 가드 통과 — 비-diagram 5기능(polish/outline/table/shorten/custom) + diagram + section + continue 전 분기가 동일 입력에 동일 `(system_prompt, user_prompt)` 산출(바이트 동등 스냅샷, SPEC-AI-008 AC-AI-008-014와 동일 계약) |
| AC-AI9-015 | REQ-AI9-004, 008 | **수동 통합** — `~/.codex/AGENTS.md`(또는 글로벌 스킬)가 존재하는 사용자 환경에서 codex 요청 실행 시 AI 응답이 해당 파일 내용에 영향받지 않음(빈 환경 대비 응답 범위 동일, `usage.input_tokens`가 폭발하지 않음). `--ignore-user-config` + 빈 cwd가 1차 방어선으로 기능함을 확인. 완전 자동화가 어려워 수동 테스트로 표기(M7 단계). |

REQ 커버리지 대조(001–025 + 007a, 013a 전수): 001→AC1·AC2, 002→AC1, 003→AC2, 004→AC3·AC15, 005→AC4, 006→AC5, 007→AC5, **007a→AC5**(spawn 호출 순서), 008→AC5·AC15, 009→AC6, 010→AC6, 011→AC7, 012→AC7, 013→AC8, **013a→AC7**(chunk 1회 emit 후 turn.completed 누락 EOF), 014→AC8, 015→AC9, 016→AC10, 017→AC10, 018→AC3·AC11, 019→AC11, 020→AC11, 021→AC12, 022→AC13, 023→AC13, 024→AC14, 025→AC2. 미커버 REQ 없음.

**Quality Gates (AC 외 공통 게이트)**: `cargo test`(codex_cli.rs/detect.rs/stream.rs 단위 테스트 전수 통과) + `cargo clippy` 무경고 + `cargo build` 성공 + 기존 claude 회귀 테스트(claude_cli.rs:309-, stream.rs:128-, detect.rs:290-) 100% 통과(REQ-AI9-022/023/024 가드) + `npm run typecheck` 클린(프론트 무변경이므로 영향 0 예상) + 수동 통합 테스트(실제 codex CLI 1회 이상 호출, 빈 scratch cwd에서 `agent_message` 1회 도착·`turn.completed` 종료 확인).

## Exclusions (What NOT to Build)

- **`CODEX_HOME` 환경변수 격리 시도 금지** — auth도 `CODEX_HOME`을 써서 인증이 풀림(실측, codex 도움말 명시). 빈 cwd + `--ignore-user-config` + `--sandbox read-only` 조합으로만 격리(REQ-AI9-008).
- **codex 전용 stderr 분류 로직 금지** — 기존 `classify_stderr`(stream.rs:78-126)를 그대로 재사용. login/network/other marker 상수 중복 정의 금지(REQ-AI9-014).
- **프론트 provider 전환 UI 금지(v1)** — provider 콤보박스·상태 표시·"codex 사용 중" 인디케이터 등 신규 컴포넌트 도입 안 함(REQ-AI9-020). 사용자용 설정 UI는 별도 SPEC.
- **`AiModel` enum 변경 금지** — `Haiku`/`Sonnet` variant 이름 유지. `Codex`/`Gpt55` 등 신규 variant 추가 안 함(REQ-AI9-019).
- **기존 claude 빌드/파싱/조립 로직 직접 수정 금지** — `build_claude_args`, `parse_text_delta`, `parse_final_result`, `ClaudeProvider`, `spawn_claude`, prompt.rs는 무변경(REQ-AI9-022, REQ-AI9-023, REQ-AI9-024, "단일 소스 원칙").
- **codex 모델 다양화 금지(v1)** — `gpt-5.5` 외의 모델(`o1`/`gpt-4o` 등) 선택 옵션은 v1에서 제외. "Model Mapping" 표 개정으로만 도입(REQ-AI9-018).
- **토큰 단위 스트리밍 금지** — codex의 `agent_message`는 완성본 1회 도착(실측). 이를 인위적으로 청킹해 `ai://chunk`를 여러 번 emit하지 않는다(REQ-AI9-011).
- **`~/.codex/AGENTS.md` 오염 사용자 안내 UI 금지** — 문서화(Design Notes)로만 다루고, Run phase에서 별도 차단 로직·사용자 경고 UI를 도입하지 않는다(별도 SPEC).
- **신규 런타임 의존성 금지** — `src-tauri/Cargo.toml` dependencies 무변경. codex는 외부 CLI로 `std::process::Command`로 호출(REQ-AI9-007).
- **nvm 후보·로그인셸 프로브 적용 안 함(codex 한정)** — `resolve_claude_binary`의 nvm 탐지(detect.rs:153-176)·로그인셸 프로브(detect.rs:192-223)는 codex에 v1에서 적용하지 않는다(REQ-AI9-015). 표준 설치 위치 후보만으로 충분.
- **`Capabilities` 소비 분기 신설 안 함** — `supports_streaming`/`typical_latency_ms` 필드는 존재하지만, v1에서는 이를 기반으로 한 런타임 분기를 만들지 않는다(codex도 동일 `relay_process` 패턴을 탄다). 향후 고도화시 별도 REQ.
- **codex 로그인 고도화(토큰 만료 선제 판정) 금지(v1)** — `auth.json` 존재 여부만으로 로그인 판정(REQ-AI9-016). JSON 내용 파싱·만료 검증은 후속 SPEC.
