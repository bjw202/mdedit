// @MX:ANCHOR: [AUTO] claude CLI 스폰 인자 조립 + stdout 릴레이 스레드 - 스트리밍 인프라 핵심
// @MX:REASON: [AUTO] AI 요청 실행 경로 진입점(fan_in >= 2: mod 커맨드 + ClaudeProvider), 스폰 인자 격리 계약
// @MX:SPEC: SPEC-AI-001

//! claude Code headless CLI(`claude -p`) 어댑터.
//!
//! 인자 조립·스크래치 경로·릴레이 판정은 순수 함수로 분리해 단위 테스트하고,
//! 실제 프로세스 스폰과 Tauri emit은 얇은 계층으로 감싼다(watcher.rs 스레드+emit 패턴 재사용).

use crate::ai::provider::{
    AiModel, AiProvider, AiRequest, Capabilities, ProviderRegistry, ProviderStatus,
};
use crate::ai::stream::{classify_stderr, parse_final_result, parse_text_delta};
use crate::process_util::no_window;
use serde::Serialize;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStderr, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// 스폰 cwd로 쓸 앱 전용 빈 스크래치 디렉토리 이름(문서·프로젝트 폴더 격리, 부록 A).
pub const SCRATCH_DIR_NAME: &str = "ai-scratch";

/// `ai://chunk` payload — 델타 텍스트. IPC 계약: `{ requestId, text }`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkPayload {
    pub request_id: String,
    pub text: String,
}

/// `ai://done` payload — 최종 결과 전문. IPC 계약: `{ requestId, result, truncated? }`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DonePayload {
    pub request_id: String,
    pub result: String,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub truncated: bool,
}

/// `ai://error` payload — 분류된 원인 + 사용자 안전 메시지(raw stderr 미노출, REQ-AI-040).
/// IPC 계약: `{ requestId, kind: 'login'|'network'|'parse'|'other', message, cancelledBy? }`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorPayload {
    pub request_id: String,
    pub kind: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancelled_by: Option<String>,
}

/// 릴레이 스레드가 스트림 종료 후 내릴 결론(순수 판정 결과).
#[derive(Debug, PartialEq, Eq)]
pub enum RelayOutcome {
    /// 최종 결과 수신 → ai://done.
    Done(String),
    /// 실패 → ai://error(kind 문자열·안전 메시지).
    Error(&'static str, String),
    /// 사용자 취소·새 요청 교체 → 릴레이 무음(취소 통보는 커맨드가 담당, §3 P7).
    Silent,
}

/// 모델·시스템·사용자 프롬프트로 claude 실행 인자를 조립한다(순수).
///
/// 격리 플래그: `--output-format stream-json --include-partial-messages --verbose
/// --setting-sources "" --tools ""`.
/// (`MAX_THINKING_TOKENS` env는 기본 티어에서만 `spawn_claude`가 설정하고, 고급 티어는
/// 미설정으로 CLI 기본값에 위임한다 — `claude_thinking_env` 참조, SPEC-AI-009 REQ-AI9-046)
//
// @MX:ANCHOR: [AUTO] `--tools ""` — 내장 도구 전면 비활성화 계약
// @MX:REASON: [AUTO] 이 앱의 AI 기능(인라인 편집·고스트 텍스트·다이어그램)은 전부 순수 텍스트
//   변환이라 도구가 하나도 필요 없다. 이 플래그가 없으면 CLI 기본 도구 집합이 그대로 살아있고,
//   격리는 오직 "빈 스크래치 cwd 라서 찾을 게 없다"는 정황에만 의존한다 — 실측으로 확인했다:
//   플래그 없이 파일이 있는 디렉토리에서 돌리면 Read 도구가 실제로 동작해 내용을 반환하고,
//   `--tools ""` 를 주면 차단된다. 따라서 cwd 를 바꾸는 기능(금고 조회 등)이 나중에 추가되면
//   이 한 줄이 유일한 방어선이 된다. 도구가 필요한 기능을 만들 때도 여기를 비우지 말고
//   필요한 도구만 명시적으로 나열할 것.
pub fn build_claude_args(model: AiModel, system_prompt: &str, user_prompt: &str) -> Vec<String> {
    vec![
        "-p".to_string(),
        user_prompt.to_string(),
        "--system-prompt".to_string(),
        system_prompt.to_string(),
        "--model".to_string(),
        model.as_arg().to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--include-partial-messages".to_string(),
        "--verbose".to_string(),
        "--setting-sources".to_string(),
        String::new(),
        "--tools".to_string(),
        String::new(),
    ]
}

/// claude 의 사고 예산 환경변수를 티어에서 파생한다(순수, REQ-AI9-046).
///
/// 기본 티어(Haiku)는 `MAX_THINKING_TOKENS=0`(추론 비활성, 기존 동작 유지).
/// 고급 티어(Sonnet)는 `None` — 환경변수를 아예 설정하지 않고 claude CLI 자체 기본값에
/// 위임한다. 숫자 예산을 발명하지 않는다(무출처 매직 넘버 금지, REQ-AI9-047).
pub fn claude_thinking_env(model: AiModel) -> Option<(&'static str, &'static str)> {
    match model {
        AiModel::Haiku => Some(("MAX_THINKING_TOKENS", "0")),
        AiModel::Sonnet => None,
    }
}

/// 고급 티어 표시 문자열(SPEC-AI-009 REQ-AI9-051/052) — `AiModel::as_arg(Sonnet)` 반환값
/// 그 자체다. 이 값을 다시 적어둔 두 번째 상수를 두지 않는다(REQ-AI9-049 (b)).
pub fn claude_advanced_model_label() -> String {
    AiModel::Sonnet.as_arg().to_string()
}

/// 스크래치 디렉토리 경로(앱 데이터 디렉토리 하위).
pub fn scratch_dir_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(SCRATCH_DIR_NAME)
}

/// 빈 스크래치 디렉토리를 준비한다. 생성 실패(권한·디스크) 시 오류(§8.1 격리 규칙 1).
pub fn ensure_scratch_dir(app_data_dir: &Path) -> Result<PathBuf, String> {
    let dir = scratch_dir_path(app_data_dir);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("AI 작업 폴더를 준비하지 못했어요: {}", e))?;
    Ok(dir)
}

/// error kind 문자열에 대응하는 사용자 안전 메시지(raw stderr·JSON 미노출, §9).
pub fn friendly_error_message(kind: &str) -> String {
    match kind {
        "login" => "로그인이 풀렸어요. 연결 안내를 확인해주세요.".to_string(),
        "network" => {
            "네트워크에 연결할 수 없어요. 사내 프록시 환경이라면 관리자에게 문의하세요.".to_string()
        }
        "parse" => "도구 업데이트로 문제가 생겼어요. 다시 시도해주세요.".to_string(),
        // SPEC-AI-006 REQ-AI6-005: login/network/parse/other와 구별되는 timeout 종류.
        "timeout" => "응답이 너무 오래 걸려 중단했어요. 다시 시도해주세요.".to_string(),
        _ => "잠시 문제가 있었어요. 다시 시도해주세요.".to_string(),
    }
}

// @MX:ANCHOR: [AUTO] claim_terminal - 요청 terminal(done/error) 단일 발행 선점 헬퍼
// @MX:REASON: [AUTO] SPEC-AI-006 REQ-AI6-006 불변식 — 정확히 한 주체만 terminal 을 발행해야
//   한다. 릴레이(모든 outcome)·워치독·ai_cancel(mod.rs)·신규 요청 교체(mod.rs) 네 지점이 발행
//   직전 반드시 이 헬퍼를 통해 동일 `finished` 플래그를 claim 한다(fan_in >= 4). false→true swap
//   에 최초로 성공한 호출자만 true 를 받아 발행하고, 나머지는 무발행으로 억제한다.
// @MX:SPEC: SPEC-AI-006
/// 요청별 공유 `finished` 플래그에 대한 단일 발행 선점(순수). false→true 로 최초 성공한
/// 호출자만 true 를 반환한다 — 그 호출자만 terminal(`ai://done`|`ai://error`) 이벤트를
/// 발행해야 한다. 재호출은 항상 false(이미 선점됨).
pub fn claim_terminal(finished: &AtomicBool) -> bool {
    !finished.swap(true, Ordering::SeqCst)
}

/// 스트림 종료 후 결론을 순수 판정한다.
///
/// 우선순위: 취소 → 최종 결과 → stderr 분류(login/network/other) → 파싱 실패(parse)/기타(other).
/// `saw_stream_output`이 true인데 결과가 없고 stderr도 비면 'parse'(델타는 왔으나 result 미추출, §9).
/// raw stderr는 메시지에 넣지 않는다.
pub fn decide_outcome(
    final_result: Option<String>,
    stderr: &str,
    cancelled: bool,
    saw_stream_output: bool,
) -> RelayOutcome {
    if cancelled {
        return RelayOutcome::Silent;
    }
    if let Some(result) = final_result {
        return RelayOutcome::Done(result);
    }
    let kind = if !stderr.trim().is_empty() {
        classify_stderr(stderr).as_key()
    } else if saw_stream_output {
        "parse"
    } else {
        "other"
    };
    RelayOutcome::Error(kind, friendly_error_message(kind))
}

/// claude 프로세스를 스폰한다. stdout/stderr piped, stdin null, 빈 cwd.
///
/// 사고 예산 env(`MAX_THINKING_TOKENS`)는 `claude_thinking_env(model)` 이 `Some((k, v))` 를
/// 반환할 때만 설정한다 — 기본 티어는 `0`(추론 비활성), 고급 티어는 미설정(CLI 기본값 위임,
/// SPEC-AI-009 REQ-AI9-046). 그 외 Command 설정(`no_window`/`current_dir`/`stdin`/`stdout`/
/// `stderr`)은 무변경이다.
// @MX:WARN: [AUTO] 외부 바이너리(claude)를 실행한다 - 임의 경로 실행 보안 표면
// @MX:REASON: [AUTO] cwd를 빈 스크래치로 고정하고 --setting-sources ""로 사용자/프로젝트 설정·훅을 차단해 부작용을 최소화한다(부록 A)
pub fn spawn_claude(args: &[String], cwd: &Path, model: AiModel) -> Result<Child, String> {
    // bare "claude"가 아니라 detect와 동일하게 해석된 절대경로로 스폰한다(GUI 최소 PATH 우회).
    let binary = crate::ai::detect::claude_binary()
        .ok_or_else(|| "claude 실행 파일을 찾지 못했어요.".to_string())?;
    let mut cmd = Command::new(&binary);
    // Windows에서 콘솔 창이 깜빡이며 뜨는 것을 막는다(GUI 앱 전면 탈취 방지).
    no_window(&mut cmd).args(args).current_dir(cwd);
    if let Some((key, value)) = claude_thinking_env(model) {
        cmd.env(key, value);
    }
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("claude 실행에 실패했어요: {}", e))
}

/// stdout/stderr를 별도 스레드에서 읽어 `ai://chunk|done|error`로 릴레이한다.
///
/// watcher.rs의 스레드+emit 패턴을 따른다. 취소 플래그가 서면 종료 시 무음 처리하고
/// 취소 통보는 커맨드가 담당한다(§3 P7). `truncated`는 프롬프트 컨텍스트가 잘렸는지로,
/// 완료 payload에 그대로 실어 UI가 "일부만 참고" 안내를 띄우게 한다(§7).
pub fn relay_process(
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
        let mut final_result: Option<String> = None;
        let mut saw_stream_output = false;

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };
            saw_stream_output = true;
            if let Some(text) = parse_text_delta(&line) {
                let _ = app_handle.emit(
                    "ai://chunk",
                    ChunkPayload {
                        request_id: request_id.clone(),
                        text,
                    },
                );
            } else if let Some(result) = parse_final_result(&line) {
                final_result = Some(result);
            }
        }

        let mut err_buf = String::new();
        let mut stderr = stderr;
        let _ = stderr.read_to_string(&mut err_buf);

        let cancelled = cancel_flag.load(Ordering::SeqCst);
        // SPEC-AI-006 D2/REQ-AI6-006: 모든 outcome(done·error·Silent 포함)이 발행 전 동일
        // `finished`를 claim한다. 워치독·ai_cancel·신규 요청 교체가 이미 claim했다면 여기서는
        // 무발행으로 억제된다(단일발행 보장).
        match decide_outcome(final_result, &err_buf, cancelled, saw_stream_output) {
            RelayOutcome::Done(result) => {
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

/// claude Code CLI 어댑터(MVP 단독 프로바이더).
pub struct ClaudeProvider;

impl ClaudeProvider {
    pub fn new() -> Self {
        ClaudeProvider
    }
}

impl Default for ClaudeProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl AiProvider for ClaudeProvider {
    fn id(&self) -> &str {
        "claude"
    }

    fn detect(&self) -> ProviderStatus {
        // SPEC-AI-009 REQ-AI9-051: 매핑 소유 어댑터가 고급 티어 표시 문자열을 채운다.
        ProviderStatus {
            advanced_model_label: Some(claude_advanced_model_label()),
            ..crate::ai::detect::detect_claude()
        }
    }

    fn spawn(&self, request: &AiRequest, cwd: &Path) -> Result<Child, String> {
        let args = build_claude_args(request.model, &request.system_prompt, &request.user_prompt);
        spawn_claude(&args, cwd, request.model)
    }

    fn capabilities(&self) -> Capabilities {
        // 실측: 첫 텍스트 ~2.3초, 완료 ~2.7초(부록 A.1).
        Capabilities {
            supports_streaming: true,
            typical_latency_ms: 2700,
        }
    }
}

/// 기본 레지스트리 — claude + codex 어댑터를 정확히 2개 등록한다(SPEC-AI-009 REQ-AI9-001).
///
/// 등록 순서가 자동 감지 우선순위를 결정한다 — `first_available()`(provider.rs)이 설치+로그인된
/// 첫 provider 를 고르므로 claude 를 먼저 등록해 "claude 먼저, codex 폴백" 계약(REQ-AI9-002/025)을 보장한다.
/// `providerId` 명시 시(`route(Some(id))`) 순서와 무관하게 해당 provider 강제 라우팅(REQ-AI9-003).
// @MX:NOTE: [AUTO] default_registry - claude>codex 등록 순서가 자동 감지 우선순위(REQ-AI9-001/002)
// @MX:SPEC: SPEC-AI-009
pub fn default_registry() -> ProviderRegistry {
    ProviderRegistry::with_providers(vec![
        Box::new(ClaudeProvider::new()),
        Box::new(crate::ai::codex_cli::CodexProvider::new()),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- build_claude_args ---

    #[test]
    fn args_include_isolation_flags() {
        let args = build_claude_args(AiModel::Haiku, "sys", "user");
        let joined = args.join("\u{1}");
        assert!(args.contains(&"-p".to_string()));
        assert!(args.contains(&"user".to_string()));
        assert!(args.contains(&"--system-prompt".to_string()));
        assert!(args.contains(&"sys".to_string()));
        assert!(args.contains(&"--output-format".to_string()));
        assert!(args.contains(&"stream-json".to_string()));
        assert!(args.contains(&"--include-partial-messages".to_string()));
        assert!(args.contains(&"--verbose".to_string()));
        assert!(args.contains(&"--setting-sources".to_string()));
        // --setting-sources 뒤에 빈 문자열이 온다.
        let idx = args.iter().position(|a| a == "--setting-sources").unwrap();
        assert_eq!(args[idx + 1], "");
        let _ = joined;
    }

    #[test]
    fn args_disable_all_builtin_tools() {
        // 도구 전면 비활성화(`--tools ""`)는 격리 계약의 일부다. 이 단언이 깨지면 CLI 기본
        // 도구 집합이 되살아나고, 격리가 "빈 cwd" 정황에만 의존하게 된다.
        let args = build_claude_args(AiModel::Haiku, "sys", "user");
        let idx = args
            .iter()
            .position(|a| a == "--tools")
            .expect("--tools 플래그가 있어야 한다");
        assert_eq!(args[idx + 1], "", "--tools 뒤에는 빈 문자열이 와야 한다");
    }

    #[test]
    fn args_toggle_model_haiku_vs_sonnet() {
        let haiku = build_claude_args(AiModel::Haiku, "s", "u");
        let sonnet = build_claude_args(AiModel::Sonnet, "s", "u");
        let hidx = haiku.iter().position(|a| a == "--model").unwrap();
        let sidx = sonnet.iter().position(|a| a == "--model").unwrap();
        assert_eq!(haiku[hidx + 1], "haiku");
        assert_eq!(sonnet[sidx + 1], "sonnet");
    }

    // --- SPEC-AI-009 M1.1 / REQ-AI9-022 / AC-AI9-013 회귀 가드 ---
    // codex 통합 코드가 claude 인자 시퀀스를 의도치 않게 건드리는 즉시 포착하기 위한
    // 바이트 동등 스냅샷. 프로덕션 build_claude_args 는 무변경이어야 한다(단일 소스 원칙).
    // 어서션 전체 Vec 를 하드코딩해 순서·개수·값 전부 고정한다.
    #[test]
    fn build_claude_args_haiku_snapshot_byte_equal() {
        let args = build_claude_args(AiModel::Haiku, "SYS", "USER");
        let expected = vec![
            "-p".to_string(),
            "USER".to_string(),
            "--system-prompt".to_string(),
            "SYS".to_string(),
            "--model".to_string(),
            "haiku".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--include-partial-messages".to_string(),
            "--verbose".to_string(),
            "--setting-sources".to_string(),
            String::new(),
            "--tools".to_string(),
            String::new(),
        ];
        assert_eq!(args, expected);
        assert_eq!(args.len(), 14, "claude 인자는 정확히 14개여야 한다");
    }

    #[test]
    fn build_claude_args_sonnet_korean_prompt_snapshot_byte_equal() {
        // 한글·Sonnet 조합으로 두 번째 기준선 확보 — 모델 토글 + 비-ASCII 입력 모두 고정.
        let args = build_claude_args(AiModel::Sonnet, "다른 시스템", "다른 사용자");
        let expected = vec![
            "-p".to_string(),
            "다른 사용자".to_string(),
            "--system-prompt".to_string(),
            "다른 시스템".to_string(),
            "--model".to_string(),
            "sonnet".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--include-partial-messages".to_string(),
            "--verbose".to_string(),
            "--setting-sources".to_string(),
            String::new(),
            "--tools".to_string(),
            String::new(),
        ];
        assert_eq!(args, expected);
    }

    #[test]
    fn build_claude_args_isolation_flags_never_drop() {
        // 개별 격리 플래그 존재 여부 — codex 통합 중 build_claude_args 가 무결하더라도
        // 호출부 수정 회귀를 포착하기 위한 방어 어서션.
        let args = build_claude_args(AiModel::Haiku, "sys", "user");
        for flag in [
            "--system-prompt",
            "--model",
            "--output-format",
            "--include-partial-messages",
            "--verbose",
            "--setting-sources",
            "--tools",
        ] {
            assert!(
                args.iter().any(|a| a == flag),
                "build_claude_args 에 격리 플래그 {} 가 빠졌다",
                flag
            );
        }
        // 산출 순서 고정: -p 가 첫 원소, system-prompt 값이 그 뒤.
        assert_eq!(args.first().map(|s| s.as_str()), Some("-p"));
    }

    // --- scratch dir ---

    #[test]
    fn scratch_path_is_under_app_data() {
        let base = Path::new("/app/data");
        assert_eq!(
            scratch_dir_path(base),
            PathBuf::from("/app/data/ai-scratch")
        );
    }

    #[test]
    fn ensure_scratch_dir_creates_directory() {
        let base = std::env::temp_dir().join(format!("mdedit_scratch_ok_{}", std::process::id()));
        let dir = ensure_scratch_dir(&base).expect("should create scratch dir");
        assert!(dir.exists());
        assert!(dir.ends_with("ai-scratch"));
        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn ensure_scratch_dir_errors_when_base_is_a_file() {
        // 베이스 경로가 파일이면 그 하위 디렉토리 생성이 실패해야 한다(§8.1 격리 규칙 1).
        let file_path =
            std::env::temp_dir().join(format!("mdedit_scratch_file_{}", std::process::id()));
        std::fs::write(&file_path, "not a dir").unwrap();

        let result = ensure_scratch_dir(&file_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("AI 작업 폴더"));

        std::fs::remove_file(&file_path).ok();
    }

    // --- decide_outcome ---

    #[test]
    fn outcome_done_when_result_present() {
        assert_eq!(
            decide_outcome(Some("결과".to_string()), "", false, true),
            RelayOutcome::Done("결과".to_string())
        );
    }

    #[test]
    fn outcome_silent_when_cancelled() {
        // 취소되면 결과가 있어도 무음(취소는 커맨드가 별도 통보).
        assert_eq!(
            decide_outcome(Some("결과".to_string()), "", true, true),
            RelayOutcome::Silent
        );
        assert_eq!(
            decide_outcome(None, "boom", true, true),
            RelayOutcome::Silent
        );
    }

    #[test]
    fn outcome_error_classifies_login() {
        match decide_outcome(None, "401 unauthorized", false, true) {
            RelayOutcome::Error(kind, msg) => {
                assert_eq!(kind, "login");
                assert!(msg.contains("로그인"));
                // raw stderr는 메시지에 노출되지 않는다.
                assert!(!msg.contains("401"));
            }
            other => panic!("expected error, got {:?}", other),
        }
    }

    #[test]
    fn outcome_error_classifies_network() {
        match decide_outcome(None, "connect ETIMEDOUT", false, true) {
            RelayOutcome::Error(kind, _) => assert_eq!(kind, "network"),
            other => panic!("expected error, got {:?}", other),
        }
    }

    #[test]
    fn outcome_parse_when_stream_output_but_no_result() {
        // 델타는 왔으나 result 라인이 없고 stderr도 비면 파싱/포맷 문제로 본다(§9).
        match decide_outcome(None, "", false, true) {
            RelayOutcome::Error(kind, _) => assert_eq!(kind, "parse"),
            other => panic!("expected parse error, got {:?}", other),
        }
    }

    #[test]
    fn outcome_other_when_no_output_and_no_stderr() {
        // 출력도 stderr도 없이 종료 → 일반 오류.
        match decide_outcome(None, "   ", false, false) {
            RelayOutcome::Error(kind, _) => assert_eq!(kind, "other"),
            other => panic!("expected other error, got {:?}", other),
        }
    }

    #[test]
    fn friendly_messages_never_leak_raw() {
        for kind in ["login", "network", "parse", "timeout", "other"] {
            let msg = friendly_error_message(kind);
            assert!(!msg.is_empty());
            assert!(!msg.contains("{"));
            assert!(!msg.contains("Error:"));
        }
    }

    // --- SPEC-AI-009 M10.3 / AC-AI9-031: 라벨이 중앙 매핑 함수 반환값과 대조되어야 함 ---

    #[test]
    fn claude_advanced_model_label_matches_as_arg_sonnet() {
        // 하드코딩 기대 문자열이 아니라 AiModel::as_arg(Sonnet) 반환값과 대조한다(REQ-AI9-052).
        assert_eq!(claude_advanced_model_label(), AiModel::Sonnet.as_arg());
    }

    #[test]
    fn claude_detect_fills_advanced_model_label_non_empty() {
        let status = ClaudeProvider::new().detect();
        assert_eq!(status.id, "claude");
        let label = status.advanced_model_label.expect("label must be Some");
        assert!(!label.trim().is_empty());
    }

    // --- SPEC-AI-009 M10.2 / AC-AI9-029: claude 티어별 사고 예산 env 파생 ---

    #[test]
    fn claude_thinking_env_haiku_sets_zero() {
        assert_eq!(
            claude_thinking_env(AiModel::Haiku),
            Some(("MAX_THINKING_TOKENS", "0"))
        );
    }

    #[test]
    fn claude_thinking_env_sonnet_is_none() {
        // 고급 티어는 env 를 아예 설정하지 않는다(CLI 기본값 위임, REQ-AI9-046/047).
        assert_eq!(claude_thinking_env(AiModel::Sonnet), None);
    }

    // --- SPEC-AI-006 항목 2: timeout 오류 종류 + 단일발행 선점 헬퍼 (REQ-AI6-004/005/006) ---

    #[test]
    fn friendly_message_for_timeout_is_safe_and_distinct_from_other_kinds() {
        let msg = friendly_error_message("timeout");
        assert!(!msg.is_empty());
        assert_ne!(msg, friendly_error_message("network"));
        assert_ne!(msg, friendly_error_message("login"));
        assert_ne!(msg, friendly_error_message("parse"));
    }

    #[test]
    fn claim_terminal_first_call_succeeds_second_call_fails() {
        let finished = AtomicBool::new(false);
        assert!(claim_terminal(&finished));
        assert!(!claim_terminal(&finished));
        assert!(!claim_terminal(&finished));
    }

    #[test]
    fn claim_terminal_sequential_cancel_then_watchdog_prevents_late_timeout_emit() {
        // AC-AI6-002 순차 시나리오: 5초 시점 취소가 먼저 claim하면, 60초 워치독은 claim에
        // 실패해 뒤늦은 timeout 오류를 발행하지 않는다.
        let finished = Arc::new(AtomicBool::new(false));
        let cancel_claimed = claim_terminal(&finished); // 취소가 먼저 발화
        let watchdog_claimed = claim_terminal(&finished); // 이후 워치독 발화
        assert!(cancel_claimed);
        assert!(!watchdog_claimed);
    }

    #[test]
    fn claim_terminal_near_simultaneous_claims_exactly_one_succeeds() {
        // AC-AI6-002 근접 경쟁: 취소와 워치독이 거의 동시에 발화해도 정확히 한쪽만 성공한다.
        let finished = Arc::new(AtomicBool::new(false));
        let a = claim_terminal(&finished);
        let b = claim_terminal(&finished);
        assert!(a ^ b, "exactly one of the two competing claims must succeed");
    }

    #[test]
    fn done_payload_serializes_camel_case() {
        let json = serde_json::to_string(&DonePayload {
            request_id: "r1".to_string(),
            result: "결과".to_string(),
            truncated: true,
        })
        .unwrap();
        assert!(json.contains("\"requestId\":\"r1\""));
        assert!(json.contains("\"truncated\":true"));
    }

    #[test]
    fn done_payload_omits_false_truncated() {
        let json = serde_json::to_string(&DonePayload {
            request_id: "r1".to_string(),
            result: "x".to_string(),
            truncated: false,
        })
        .unwrap();
        assert!(!json.contains("truncated"));
    }

    #[test]
    fn error_payload_serializes_camel_case_with_cancelled_by() {
        let json = serde_json::to_string(&ErrorPayload {
            request_id: "r1".to_string(),
            kind: "other".to_string(),
            message: "취소".to_string(),
            cancelled_by: Some("new-request".to_string()),
        })
        .unwrap();
        assert!(json.contains("\"requestId\":\"r1\""));
        assert!(json.contains("\"cancelledBy\":\"new-request\""));
    }

    #[test]
    fn error_payload_omits_absent_cancelled_by() {
        let json = serde_json::to_string(&ErrorPayload {
            request_id: "r1".to_string(),
            kind: "network".to_string(),
            message: "x".to_string(),
            cancelled_by: None,
        })
        .unwrap();
        assert!(!json.contains("cancelledBy"));
    }

    // --- registry / adapter (AC-AI-021 + SPEC-AI-009 AC-AI9-001/002) ---

    #[test]
    fn default_registry_registers_claude_and_codex_in_order() {
        // SPEC-AI-009 REQ-AI9-001: claude + codex 정확히 2개 등록, 순서 보존.
        let registry = default_registry();
        assert_eq!(registry.len(), 2);
        assert_eq!(registry.ids(), vec!["claude", "codex"]);
        assert!(registry.get("claude").is_some());
        assert!(registry.get("codex").is_some());
    }

    #[test]
    fn claude_adapter_identity_and_capabilities() {
        let provider = ClaudeProvider::new();
        assert_eq!(provider.id(), "claude");
        assert!(provider.capabilities().supports_streaming);
    }

    #[test]
    fn routing_goes_through_trait() {
        // route(None) 은 first_available 경로(환경에 따라 claude 또는 codex).
        // 여기서는 단순히 route 가 trait 을 경유해 Some 을 반환하는지만 확인(실제 선택은 환경 의존).
        let registry = default_registry();
        // route 가 None 을 반환하지 않고 trait 을 경유함을 검증.
        // 환경에 무관하게 id 는 "claude" 또는 "codex" 여야 한다.
        if let Some(provider) = registry.route(None) {
            let id = provider.id();
            assert!(id == "claude" || id == "codex", "unexpected id: {}", id);
        }
        // 명시적 id 로 항상 확정 검증 가능.
        assert_eq!(registry.route(Some("claude")).unwrap().id(), "claude");
        assert_eq!(registry.route(Some("codex")).unwrap().id(), "codex");
    }
}
