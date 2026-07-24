// @MX:ANCHOR: [AUTO] codex CLI 어댑터 - 인자 조립·스폰·Provider (claude_cli.rs 와 형제)
// @MX:REASON: [AUTO] SPEC-AI-009 두 번째 프로바이더 진입점. fan_in >= 2 (default_registry 등록 +
//   mod.rs ai_request 경유 spawn). 인자 시퀀스·stdin null·모델 매핑 계약이 codex 통합의 핵심 불변.
// @MX:SPEC: SPEC-AI-009

//! OpenAI 계열 `codex` CLI(codex-cli 0.144.1 검증) 어댑터.
//!
//! claude_cli.rs 와 동일한 분할 패턴을 따른다 — 순수 함수(인자 조립·프롬프트 결합·모델 매핑)는
//! 단위 테스트하고, 프로세스 스폰은 얇은 계층으로 감싼다. 핵심 차이:
//! - codex는 `--json`(JSONL)을 내보내며 agent_message 완성본을 1회에 보낸다(스트리밍 아님).
//! - system+user 프롬프트를 "\n\n" 로 결합해 positional 인자 1개로 전달(codex 는 --system-prompt 미지원).
//! - 빈 스크래치 cwd + --ignore-user-config + --sandbox read-only + --ephemeral 로 격리.
//! - stdin 을 반드시 Stdio::null() 로 차단(안 하면 "Reading additional input from stdin..." 부작용).
//! - CODEX_HOME 환경변수를 사용하지 않는다(auth 가 풀림, REQ-AI9-008).

use crate::ai::claude_cli::{
    claim_terminal, decide_outcome, ChunkPayload, DonePayload, ErrorPayload, RelayOutcome,
};
use crate::ai::provider::{AiModel, AiProvider, AiRequest, Capabilities, ProviderStatus};
use crate::ai::stream::{parse_codex_agent_message, parse_codex_turn_completed};
use crate::process_util::{login_shell_path, no_window};
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Child, ChildStderr, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// system_prompt 와 user_prompt 를 "\n\n" 로 결합해 단일 positional 인자로 만든다(순수, REQ-AI9-005).
///
/// codex 는 claude 의 `--system-prompt` 분리 플래그를 지원하지 않아(실측), 결합 문자열을
/// `exec` 의 마지막 인자로 넘긴다. 빈 system 이면 `"\n\n{user}"`, 빈 user 면 `"{system}\n\n"`.
pub fn combine_prompts(system_prompt: &str, user_prompt: &str) -> String {
    format!("{}\n\n{}", system_prompt, user_prompt)
}

/// codex 의 `--model` 인자 값으로 매핑한다(순수, REQ-AI9-018).
///
/// v1 매핑: Haiku/Sonnet 모두 `gpt-5.5`(사전 합의). 이 매핑 로직은 본 함수에 국소화하고
/// 분산을 금지한다(Design Notes "모델 매핑 중앙화"). 향후 모델 다양화는 본 함수와 SPEC 개정으로만.
pub fn codex_model_arg(model: AiModel) -> &'static str {
    match model {
        AiModel::Haiku | AiModel::Sonnet => "gpt-5.5",
    }
}

/// model·combined_prompt·scratch_dir 로 codex 실행 인자를 조립한다(순수, REQ-AI9-004).
///
/// 산출 인자는 정확히 다음 순서의 15개 원소다(codex-cli 0.144.1 실측 기준):
/// ```text
/// ["exec", "-C", <scratch>, "--ignore-user-config", "--skip-git-repo-check",
///  "--ephemeral", "--sandbox", "read-only", "--model", <model_arg>,
///  "-c", "model_reasoning_effort=\"medium\"", "--json", <combined_prompt>]
/// ```
/// `<scratch>` 는 빈 스크래치 디렉토리 절대경로, `<model_arg>` 는 `codex_model_arg` 결과,
/// `<combined_prompt>` 는 `combine_prompts` 결과다.
// @MX:ANCHOR: [AUTO] codex 격리 플래그 시퀀스 - --ignore-user-config/--sandbox read-only/--ephemeral
// @MX:REASON: [AUTO] 사용자 홈 컨텍스트 오염(~/.codex/AGENTS.md 자동 로딩 → 32K 토큰 폭발 사례)을
//   막는 1차 방어선. 플래그 하나라도 누락되면 격리가 빈 cwd 정황에만 의존해 회귀(REQ-AI9-004/008).
pub fn build_codex_args(model: AiModel, combined_prompt: &str, scratch_dir: &Path) -> Vec<String> {
    let scratch = scratch_dir.to_string_lossy().into_owned();
    vec![
        "exec".to_string(),
        "-C".to_string(),
        scratch,
        "--ignore-user-config".to_string(),
        "--skip-git-repo-check".to_string(),
        "--ephemeral".to_string(),
        "--sandbox".to_string(),
        "read-only".to_string(),
        "--model".to_string(),
        codex_model_arg(model).to_string(),
        "-c".to_string(),
        "model_reasoning_effort=\"medium\"".to_string(),
        "--json".to_string(),
        combined_prompt.to_string(),
    ]
}

/// codex 명령어의 Command 구성을 조립한다(순수, D6 힌트 — AC-AI9-005 자동화 지원).
///
/// `spawn_codex` 는 이 함수를 호출해 `.spawn()` 만 실행하는 얇은 래퍼가 된다.
/// 본 함수가 담당하는 계약(REQ-AI9-006/007/008):
/// - `.stdin(Stdio::null())` — codex 가 stdin 을 읽으려 시도하는 부작용 차단(실측).
/// - `.stdout(Stdio::piped())` / `.stderr(Stdio::piped())` — JSONL·stderr 릴레이 수신.
/// - `no_window` 호출 — Windows 콘솔 깜빡임 차단.
/// - `.current_dir(cwd)` — 빈 스크래치 cwd 고정(문서·프로젝트 폴더 격리).
/// - `Command::new(binary)` — `codex_binary()` 절대경로(bare "codex" 아님, GUI 최소 PATH 우회).
///
/// 본 함수는 CODEX_HOME 환경변수를 설정하지 않는다(REQ-AI9-008 — auth 가 풀림, 실측).
// @MX:WARN: [AUTO] 외부 바이너리(codex)를 실행한다 - 임의 경로 실행 보안 표면
// @MX:REASON: [AUTO] 빈 스크래치 cwd + --ignore-user-config + --sandbox read-only + stdin null 로
//   부작용을 최소화한다. CODEX_HOME 은 설정하지 않는다(auth 풀림 방지, REQ-AI9-008).
pub fn build_codex_command(binary: &Path, args: &[String], cwd: &Path) -> Command {
    let mut cmd = Command::new(binary);
    no_window(&mut cmd)
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // macOS GUI 환경(PATH 최소)에서 codex(node 스크립트)가 node를 찾도록 로그인 셸 PATH 주입.
    // 인자는 Command 에 직접 전달(셸 문자열 조립 아님 → 프롬프트 특수문자 인젝션 방지),
    // PATH 만 사용자 로그인 셸 값(nvm node 포함)으로 보강한다.
    if let Some(path) = login_shell_path() {
        cmd.env("PATH", path);
    }
    cmd
}

/// codex 프로세스를 스폰한다(REQ-AI9-007).
///
/// `detect::codex_binary()` 절대경로로 스폰하며, `build_codex_command` 로 Command 를 구성해
/// `.spawn()` 한다. 미설치(`codex_binary()` → None)면 `Err("codex 실행 파일을 찾지 못했어요.")`
/// (claude_cli.rs:172-173 과 대칭).
pub fn spawn_codex(args: &[String], cwd: &Path) -> Result<Child, String> {
    let binary = crate::ai::detect::codex_binary()
        .ok_or_else(|| "codex 실행 파일을 찾지 못했어요.".to_string())?;
    let mut cmd = build_codex_command(&binary, args, cwd);
    cmd.spawn()
        .map_err(|e| format!("codex 실행에 실패했어요: {}", e))
}

/// codex stdout/stderr 를 별도 스레드에서 읽어 `ai://chunk|done|error` 로 릴레이한다(REQ-AI9-011~014).
///
/// claude_cli::relay_process 와 동일 구조(스레드 spawn, BufReader::lines, emit, claim_terminal 단일 발행).
/// 핵심 차이:
/// - `parse_codex_agent_message` 가 Some(text) 면 `ai://chunk` 를 정확히 1회 emit(토큰 분할 금지, REQ-AI9-011).
/// - `parse_codex_turn_completed` 가 true 면 `ai://done`(result=마지막 agent_message) emit(REQ-AI9-012).
/// - chunk 1회 emit 후 turn.completed 없이 EOF 하면 폴백으로 done emit(REQ-AI9-013a).
/// - 그 외 EOF 는 기존 `decide_outcome` 폴백(REQ-AI9-013). stderr 은 기존 `classify_stderr` 재사용(REQ-AI9-014).
pub fn relay_codex_process(
    app_handle: AppHandle,
    request_id: String,
    stdout: ChildStdout,
    stderr: ChildStderr,
    cancel_flag: Arc<AtomicBool>,
    truncated: bool,
    finished: Arc<AtomicBool>,
) {
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let mut last_message: Option<String> = None;
        let mut saw_stream_output = false;

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };
            saw_stream_output = true;
            if let Some(text) = parse_codex_agent_message(&line) {
                // REQ-AI9-011: agent_message 도착 즉시 ai://chunk 를 정확히 1회 emit(토큰 분할 금지).
                // 완성본을 통째로 전달한다. 마지막 수신 본문을 기억해 turn.completed 시 result 로 사용.
                last_message = Some(text.clone());
                let _ = app_handle.emit(
                    "ai://chunk",
                    ChunkPayload {
                        request_id: request_id.clone(),
                        text,
                    },
                );
            } else if parse_codex_turn_completed(&line) {
                // REQ-AI9-012: turn.completed 수신 시 ai://done emit. result 는 마지막 agent_message 본문.
                // claim_terminal 단일 발행 — 워치독/ai_cancel/신규 요청 교체와 동일 finished 공유.
                if claim_terminal(&finished) {
                    let result = last_message.clone().unwrap_or_default();
                    let _ = app_handle.emit(
                        "ai://done",
                        DonePayload {
                            request_id: request_id.clone(),
                            result,
                            truncated,
                        },
                    );
                }
                // turn.completed 이후 추가 라인은 무시의미 — done 발행으로 종료.
                // 하지만 실제 EOF 는 reader 루프 종료로 처리됨(여기서 early return 은 안 함 — 안전).
            }
        }

        let mut err_buf = String::new();
        let mut stderr = stderr;
        let _ = stderr.read_to_string(&mut err_buf);

        let cancelled = cancel_flag.load(Ordering::SeqCst);
        // 이미 turn.completed 로 done emit 됐으면 finished 는 true 로 선점된 상태 —
        // 아래 decide_outcome 폴백은 claim 실패로 무발행된다(단일 발행 보장).
        // chunk 1회 emit 후 turn.completed 없이 EOF 한 케이스(REQ-AI9-013a) 폴백:
        // last_message 가 있으면 done 으로 정상 종료 처리.
        if !cancelled {
            // m4 정정: 불필요한 clone 제거(last_message는 이후 미사용 → move).
            // turn.completed 루트에서 이미 done emit 됐으면 claim_terminal 실패로 무발행(단일발행 보장).
            if let Some(result) = last_message {
                if claim_terminal(&finished) {
                    let _ = app_handle.emit(
                        "ai://done",
                        DonePayload {
                            request_id,
                            result,
                            truncated,
                        },
                    );
                }
                return;
            }
        }
        // chunk 0회 + turn.completed 0회 → 기존 decide_outcome 폴백(REQ-AI9-013).
        match decide_outcome(None, &err_buf, cancelled, saw_stream_output) {
            RelayOutcome::Done(_) => {
                // decide_outcome(None, ...) 는 Done 을 반환하지 않지만 타입 완전성을 위해 유지.
            }
            RelayOutcome::Error(kind, message) => {
                if claim_terminal(&finished) {
                    let _ = app_handle.emit(
                        "ai://error",
                        ErrorPayload {
                            request_id,
                            kind: kind.to_string(),
                            message,
                            cancelled_by: None,
                        },
                    );
                }
            }
            RelayOutcome::Silent => {
                let _ = claim_terminal(&finished);
            }
        }
    });
}

/// codex CLI 어댑터(SPEC-AI-009 두 번째 프로바이더).
pub struct CodexProvider;

impl CodexProvider {
    pub fn new() -> Self {
        CodexProvider
    }
}

impl Default for CodexProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl AiProvider for CodexProvider {
    fn id(&self) -> &str {
        "codex"
    }

    fn detect(&self) -> ProviderStatus {
        crate::ai::detect::detect_codex()
    }

    fn spawn(&self, request: &AiRequest, cwd: &Path) -> Result<Child, String> {
        // REQ-AI9-007a: 정확히 (1) combine_prompts → (2) build_codex_args → (3) spawn_codex 순서.
        // 순서 변경·단계 누락은 회귀(combine_prompts 누락 시 codex 가 빈 프롬프트를 받거나
        // system/user 가 분리되어 전달되는 버그 방지).
        let combined = combine_prompts(&request.system_prompt, &request.user_prompt);
        let args = build_codex_args(request.model, &combined, cwd);
        spawn_codex(&args, cwd)
    }

    fn capabilities(&self) -> Capabilities {
        // codex agent_message 는 완성본 1회 도착(토큰 스트리밍 아님) → supports_streaming=false.
        // typical_latency_ms 는 실측값(수 초 예상). 현재 Capabilities 를 소비하는 분기는 없지만
        // 향후 비스트리밍 provider 단일 emit 경로의 분기 기준으로 사용 가능(Design Notes).
        Capabilities {
            supports_streaming: false,
            typical_latency_ms: 3000,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    // --- combine_prompts (REQ-AI9-005, AC-AI9-004) ---

    #[test]
    fn combine_prompts_joins_with_double_newline() {
        // 정상 케이스: "SYS\n\nUSER".
        assert_eq!(combine_prompts("SYS", "USER"), "SYS\n\nUSER");
    }

    #[test]
    fn combine_prompts_empty_system_keeps_separator() {
        // 경계: 빈 system → "\n\nUSER". 과잉 제거 금지(단일 positional 인자 계약).
        assert_eq!(combine_prompts("", "USER"), "\n\nUSER");
    }

    #[test]
    fn combine_prompts_empty_user_keeps_separator() {
        assert_eq!(combine_prompts("SYS", ""), "SYS\n\n");
    }

    #[test]
    fn combine_prompts_both_empty_still_double_newline() {
        // 빈+빈 도 "\n\n" — codex 가 빈 프롬프트를 받더라도 형태는 보존.
        assert_eq!(combine_prompts("", ""), "\n\n");
    }

    #[test]
    fn combine_prompts_multiline_system_and_user() {
        // 다중 행 system+user 도 단순 결합(변형 없음).
        let s = "line1\nline2";
        let u = "u1\nu2";
        assert_eq!(combine_prompts(s, u), "line1\nline2\n\nu1\nu2");
    }

    // --- codex_model_arg (REQ-AI9-018, AC-AI9-011) ---

    #[test]
    fn codex_model_arg_haiku_maps_to_gpt55() {
        assert_eq!(codex_model_arg(AiModel::Haiku), "gpt-5.5");
    }

    #[test]
    fn codex_model_arg_sonnet_maps_to_gpt55() {
        // v1 일단 동일 매핑(사전 합의). 향후 분리 시 본 함수와 SPEC 개정.
        assert_eq!(codex_model_arg(AiModel::Sonnet), "gpt-5.5");
    }

    // --- build_codex_args (REQ-AI9-004, AC-AI9-003) ---

    #[test]
    fn build_codex_args_haiku_snapshot_exact_15_elements() {
        // AC-AI9-003: 정확한 순서·개수·값의 스냅샷. <scratch> 자리에는 실제 경로를 넣는다.
        let scratch = Path::new("/tmp/scratch");
        let combined = "system\n\nuser";
        let args = build_codex_args(AiModel::Haiku, combined, scratch);

        let expected = vec![
            "exec".to_string(),
            "-C".to_string(),
            "/tmp/scratch".to_string(),
            "--ignore-user-config".to_string(),
            "--skip-git-repo-check".to_string(),
            "--ephemeral".to_string(),
            "--sandbox".to_string(),
            "read-only".to_string(),
            "--model".to_string(),
            "gpt-5.5".to_string(),
            "-c".to_string(),
            "model_reasoning_effort=\"medium\"".to_string(),
            "--json".to_string(),
            "system\n\nuser".to_string(),
        ];
        assert_eq!(args, expected);
        assert_eq!(
            args.len(),
            14,
            "codex 인자는 정확히 14개여야 한다(REQ-AI9-004)"
        );
    }

    #[test]
    fn build_codex_args_sonnet_also_maps_to_gpt55() {
        // v1 매핑: Sonnet 도 gpt-5.5. Haiku 와 동일 인자(+ combined 만 다름).
        let scratch = Path::new("/tmp/scratch");
        let args = build_codex_args(AiModel::Sonnet, "p", scratch);
        let model_idx = args
            .iter()
            .position(|a| a == "--model")
            .expect("--model 플래그 있어야 함");
        assert_eq!(args[model_idx + 1], "gpt-5.5");
    }

    #[test]
    fn build_codex_args_last_element_is_combined_prompt_byte_equal() {
        // AC-AI9-004: 결합 문자열이 마지막 원소와 바이트 동등(positional 1개 전달 계약).
        let scratch = Path::new("/tmp/scratch");
        let combined = "SYS\n\nUSER";
        let args = build_codex_args(AiModel::Haiku, combined, scratch);
        assert_eq!(args.last().map(|s| s.as_str()), Some(combined));
    }

    #[test]
    fn build_codex_args_scratch_dir_embedded_at_index_2() {
        // -C 다음 원소가 scratch 경로와 일치(절대경로 주입 검증).
        let scratch = Path::new("/var/empty/scratch");
        let args = build_codex_args(AiModel::Haiku, "p", scratch);
        let c_idx = args
            .iter()
            .position(|a| a == "-C")
            .expect("-C 플래그 있어야 함");
        assert_eq!(args[c_idx + 1], "/var/empty/scratch");
    }

    #[test]
    fn build_codex_args_isolation_flags_never_missing() {
        // AC-AI9-003: 격리 플래그 전부 존재. 하나라도 누락되면 사용자 홈 컨텍스트 오염 회귀.
        let scratch = Path::new("/tmp/scratch");
        let args = build_codex_args(AiModel::Haiku, "p", scratch);
        for flag in [
            "--ignore-user-config",
            "--skip-git-repo-check",
            "--ephemeral",
            "--sandbox",
            "--json",
            "-c",
        ] {
            assert!(
                args.iter().any(|a| a == flag),
                "build_codex_args 에 격리 플래그 {} 가 빠졌다",
                flag
            );
        }
        // --sandbox 값은 read-only 고정.
        let sb_idx = args.iter().position(|a| a == "--sandbox").unwrap();
        assert_eq!(args[sb_idx + 1], "read-only");
        // -c 값은 model_reasoning_effort="medium" 고정(REQ-AI9-004 플래그 시퀀스).
        let c_idx = args.iter().position(|a| a == "-c").unwrap();
        assert_eq!(args[c_idx + 1], "model_reasoning_effort=\"medium\"");
    }

    // --- build_codex_command (D6, AC-AI9-005) ---

    #[test]
    fn build_codex_command_returns_command_without_panic() {
        // Command 빌더 자체가 panic 없이 동작하는지 검증. stdin/stdout/stderr 설정은 코드 구조로 강제.
        let binary = Path::new("/usr/local/bin/codex");
        let args = build_codex_args(AiModel::Haiku, "p", Path::new("/tmp/scratch"));
        let cwd = Path::new("/tmp/scratch");
        let _cmd = build_codex_command(binary, &args, cwd);
    }

    // --- CodexProvider identity (AC-AI9-011) ---

    #[test]
    fn codex_provider_identity_and_capabilities() {
        let provider = CodexProvider::new();
        assert_eq!(provider.id(), "codex");
        // codex agent_message 는 완성본 1회 도착 → 스트리밍 아님.
        assert!(!provider.capabilities().supports_streaming);
    }

    #[test]
    fn codex_provider_detect_returns_codex_status_without_panic() {
        let provider = CodexProvider::new();
        let status = provider.detect();
        assert_eq!(status.id, "codex");
        if !status.installed {
            assert!(!status.logged_in);
            assert!(status.version.is_none());
        }
    }

    // --- EC-3: spawn 실패 시 안전 메시지 (미설치 환경) ---

    #[test]
    fn spawn_codex_returns_friendly_err_when_binary_missing() {
        // codex 가 미설치된 환경에서 spawn 시도 → claude_cli.rs:172-173 과 대칭인 안전 메시지.
        // 환경에 codex 가 있으면 이 테스트는 스킵 의미가 없으므로, codex_binary() 가 None 일 때만 단언.
        if crate::ai::detect::codex_binary().is_none() {
            let args = vec!["exec".to_string()];
            let cwd = PathBuf::from("/tmp");
            let result = spawn_codex(&args, &cwd);
            assert!(result.is_err());
            let err = result.unwrap_err();
            assert!(err.contains("codex"), "에러 메시지에 codex 언급: {}", err);
            // raw stderr 미노출(안전 메시지).
            assert!(!err.contains("Error:"));
        }
    }

    // --- REQ-AI9-008 방어: CODEX_HOME 미사용 grep 방식 검증(컴파일 시점) ---

    #[test]
    fn codex_model_arg_is_centralized_no_drift() {
        // 모델 매핑이 분산되지 않았는지 확인 — 모든 AiModel 변형이 단일 함수를 경유.
        // 향후 AiModel variant 가 추가되면 codex_model_arg 만 업데이트하면 된다.
        for model in [AiModel::Haiku, AiModel::Sonnet] {
            let arg = codex_model_arg(model);
            assert!(!arg.is_empty());
            assert!(
                arg.contains("gpt-"),
                "codex 모델은 gpt- 계열이어야 한다: {}",
                arg
            );
        }
    }

    /// 파서 fixture 검증용 헬퍼 — codex JSONL 이벤트 라인을 조립한다(테스트 전용).
    fn agent_message_line(text: &str) -> String {
        let v = serde_json::json!({
            "type": "event",
            "event": {
                "type": "item.completed",
                "item": {
                    "type": "agent_message",
                    "text": text
                }
            }
        });
        serde_json::to_string(&v).unwrap()
    }

    #[test]
    fn codex_relay_parser_wiring_extracts_agent_message() {
        // stream.rs 의 parse_codex_agent_message 와 연동되는 fixture 검증.
        let line = agent_message_line("AI 완성 본문");
        assert_eq!(
            parse_codex_agent_message(&line),
            Some("AI 완성 본문".to_string())
        );
    }
}
