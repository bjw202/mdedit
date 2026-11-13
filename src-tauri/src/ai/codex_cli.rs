// @MX:ANCHOR: [AUTO] codex CLI 어댑터 - 인자 조립·스폰·Provider (claude_cli.rs 와 형제)
// @MX:REASON: [AUTO] SPEC-AI-009 두 번째 프로바이더 진입점. fan_in >= 2 (default_registry 등록 +
//   mod.rs ai_request 경유 spawn). 인자 시퀀스·표준 입력 전달(프롬프트 인자 없음)·모델 매핑 계약이
//   codex 통합의 핵심 불변.
// @MX:SPEC: SPEC-AI-009

//! OpenAI 계열 `codex` CLI(codex-cli 0.144.1 검증) 어댑터.
//!
//! claude_cli.rs 와 동일한 분할 패턴을 따른다 — 순수 함수(인자 조립·프롬프트 결합·모델 매핑)는
//! 단위 테스트하고, 프로세스 스폰은 얇은 계층으로 감싼다. 핵심 차이:
//! - codex는 `--json`(JSONL)을 내보내며 agent_message 완성본을 1회에 보낸다(스트리밍 아님).
//! - system+user 프롬프트를 "\n\n" 로 결합해 표준 입력으로 전달(codex 는 --system-prompt 미지원,
//!   위치 인자를 빼면 표준 입력에서 읽는다 — SPEC-AI-013 으로 인자 한도·여러 줄 이스케이프 문제 제거).
//! - 빈 스크래치 cwd + --ignore-user-config + --sandbox read-only + --ephemeral 로 격리.
//! - CODEX_HOME 환경변수를 사용하지 않는다(auth 가 풀림, REQ-AI9-008).

use crate::ai::claude_cli::{
    claim_terminal, decide_outcome, spawn_stdin_writer, ChunkPayload, DonePayload, ErrorPayload,
    RelayOutcome, ResearchPayload,
};
use crate::ai::provider::{AiProvider, AiRequest, Capabilities, ProviderStatus};
use crate::ai::stream::{
    decide_codex_line, parse_codex_agent_message, parse_codex_turn_completed, Completion,
    ResearchActivity,
};
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

/// model·scratch_dir 로 codex 실행 인자를 조립한다(순수, REQ-AI9-004 → SPEC-AI-014).
///
/// `model` 이 `None`(CLI 기본값)이면 `--model` 쌍을 넣지 않아 17개, `Some` 이면 19개 원소다:
/// ```text
/// ["exec", "-C", <scratch>, "--ignore-user-config", "--skip-git-repo-check",
///  "--ephemeral", "--sandbox", "read-only",
///  "-c", "features.apps=false", "-c", "features.shell_tool=false",
///  "-c", "features.view_image=false", "-c", "web_search=disabled",
///  ["--model", <model>,] "--json"]
/// ```
/// `web_allowed`(리서치 전용, SPEC-AI-016 D4)이면 마지막 쌍만 `web_search=live` 로 바뀐다 —
/// 나머지 셋(apps·shell_tool·view_image)은 항상 끈다. 원소 수는 두 경우 모두 같다.
/// 도구 잠금용 `-c` 4쌍 외에 추론 설정(reasoning effort 등)은 넘기지 않는다(CLI 기본값).
/// `<scratch>` 는 빈 스크래치 디렉토리 절대경로다.
/// 결합 프롬프트(`combine_prompts`)는 위치 인자가 아니라 표준 입력으로 전달한다 — 위치 인자를
/// 빼면 codex 가 표준 입력에서 읽는다(SPEC-AI-013 REQ-AI13-002, 실측).
// @MX:ANCHOR: [AUTO] codex 격리 플래그 시퀀스 - --ignore-user-config/--sandbox read-only/--ephemeral
// @MX:REASON: [AUTO] 사용자 홈 컨텍스트 오염(~/.codex/AGENTS.md 자동 로딩 → 32K 토큰 폭발 사례)을
//   막는 1차 방어선. 플래그 하나라도 누락되면 격리가 빈 cwd 정황에만 의존해 회귀(REQ-AI9-004/008).
// @MX:WARN: [AUTO] codex 도구 잠금 -c 4쌍 - 선택 영역에 주입된 문장이 셸·연결 앱을 부리는 경로 차단
// @MX:REASON: [AUTO] 기본값에서는 셸 도구(exec_command)와 연결 앱 도구 200여 개(메일 발송·삭제,
//   GitHub 병합·파일 삭제 등)가 열려 있어, 사용자 선택 텍스트의 프롬프트 주입이 실제 동작으로 이어진다
//   (codex-cli 0.167.0 실측). apps·shell_tool·view_image 를 끄고 web_search 를 disabled 로 둔다.
//   `-c features.<이름>=false` 는 모르는 이름을 무시하고(구버전 안전), 잘못된 web_search 값은 오류가 난다(실측).
//   웹 리서치(SPEC-AI-016)는 web_search 값만 live 로 바꾸며 나머지 셋은 항상 끈다.
// @MX:NOTE: [AUTO] 리서치 live — web_search=live 에서 open_page 가 실제로 일어남(codex-cli 0.167.0 에서 검증, 실측 R5·R14)
// @MX:SPEC: SPEC-AI-016
pub fn build_codex_args(model: Option<&str>, scratch_dir: &Path, web_allowed: bool) -> Vec<String> {
    let scratch = scratch_dir.to_string_lossy().into_owned();
    let mut args = vec![
        "exec".to_string(),
        "-C".to_string(),
        scratch,
        "--ignore-user-config".to_string(),
        "--skip-git-repo-check".to_string(),
        "--ephemeral".to_string(),
        "--sandbox".to_string(),
        "read-only".to_string(),
    ];
    // @MX:NOTE: [AUTO] 도구 잠금 4쌍 — 셸·연결 앱·이미지 보기·웹 검색 끔(codex-cli 0.167.0 검증, 위 WARN 참조)
    let web_search = if web_allowed {
        "web_search=live"
    } else {
        "web_search=disabled"
    };
    for kv in [
        "features.apps=false",
        "features.shell_tool=false",
        "features.view_image=false",
        web_search,
    ] {
        args.push("-c".to_string());
        args.push(kv.to_string());
    }
    if let Some(model) = model {
        args.push("--model".to_string());
        args.push(model.to_string());
    }
    args.push("--json".to_string());
    args
}

/// codex 명령어의 Command 구성을 조립한다(순수, D6 힌트 — AC-AI9-005 자동화 지원).
///
/// `spawn_codex` 는 이 함수를 호출해 `.spawn()` 만 실행하는 얇은 래퍼가 된다.
/// 본 함수가 담당하는 계약(REQ-AI9-006/007/008):
/// - `.stdin(Stdio::piped())` — 결합 프롬프트를 표준 입력으로 전달한다(SPEC-AI-013 REQ-AI13-002).
///   위치 인자가 없으면 codex 는 표준 입력에서 지시문을 읽는다(실측). 쓰기 후 핸들을 닫아 EOF 를 알린다.
/// - `.stdout(Stdio::piped())` / `.stderr(Stdio::piped())` — JSONL·stderr 릴레이 수신.
/// - `no_window` 호출 — Windows 콘솔 깜빡임 차단.
/// - `.current_dir(cwd)` — 빈 스크래치 cwd 고정(문서·프로젝트 폴더 격리).
/// - `Command::new(binary)` — `codex_binary()` 절대경로(bare "codex" 아님, GUI 최소 PATH 우회).
///
/// 본 함수는 CODEX_HOME 환경변수를 설정하지 않는다(REQ-AI9-008 — auth 가 풀림, 실측).
// @MX:WARN: [AUTO] 외부 바이너리(codex)를 실행한다 - 임의 경로 실행 보안 표면
// @MX:REASON: [AUTO] 빈 스크래치 cwd + --ignore-user-config + --sandbox read-only 로
//   부작용을 최소화한다(프롬프트는 표준 입력이라 인자에 사용자 텍스트가 없다). CODEX_HOME 은
//   설정하지 않는다(auth 풀림 방지, REQ-AI9-008).
pub fn build_codex_command(binary: &Path, args: &[String], cwd: &Path) -> Command {
    let mut cmd = Command::new(binary);
    no_window(&mut cmd)
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::piped())
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
/// (claude_cli.rs:172-173 과 대칭). 결합 프롬프트는 전용 스레드로 표준 입력에 쓰고 EOF 로 마감한다.
pub fn spawn_codex(args: &[String], cwd: &Path, combined_prompt: &str) -> Result<Child, String> {
    let binary = crate::ai::detect::codex_binary()
        .ok_or_else(|| "codex 실행 파일을 찾지 못했어요.".to_string())?;
    let mut cmd = build_codex_command(&binary, args, cwd);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("codex 실행에 실패했어요: {}", e))?;
    if let Some(stdin) = child.stdin.take() {
        let _ = spawn_stdin_writer(stdin, combined_prompt.as_bytes().to_vec());
    }
    Ok(child)
}

/// codex 완료 `ai://done` payload 를 조립한다(순수, SPEC-AI-013 REQ-AI13-012).
///
/// 정상 `turn.completed` 경로와 chunk 후 EOF 폴백 경로가 모두 이 함수를 쓴다. 현재 파서·실측 기준
/// `turn.completed` 는 `usage` 만 가져 완결 신호가 없으므로 `completion` 은 항상 `Unknown` 이다.
pub fn codex_done_payload(request_id: String, result: String, truncated: bool) -> DonePayload {
    DonePayload {
        request_id,
        result,
        truncated,
        completion: Completion::Unknown,
    }
}

/// `turn.completed` 없이 EOF 했을 때 마지막 agent_message 를 정상 결과로 쓸지 정한다(순수).
///
/// 비리서치는 REQ-AI9-013a 대로 마지막 본문을 결과로 쓴다. 리서치(SPEC-AI-016)는 도구 호출 앞의
/// 서술 문장("…확인하겠습니다")이 마지막 본문일 수 있어 결과로 쓰지 않는다(None → 오류 폴백).
pub fn codex_eof_result(last_message: Option<String>, research: bool) -> Option<String> {
    if research {
        return None;
    }
    last_message
}

/// codex stdout/stderr 를 별도 스레드에서 읽어 `ai://chunk|done|error` 로 릴레이한다(REQ-AI9-011~014).
///
/// claude_cli::relay_process 와 동일 구조(스레드 spawn, BufReader::lines, emit, claim_terminal 단일 발행).
/// 핵심 차이:
/// - `parse_codex_agent_message` 가 Some(text) 면 `ai://chunk` 를 정확히 1회 emit(토큰 분할 금지, REQ-AI9-011).
/// - `parse_codex_turn_completed` 가 true 면 `ai://done`(result=마지막 agent_message) emit(REQ-AI9-012).
/// - chunk 1회 emit 후 turn.completed 없이 EOF 하면 폴백으로 done emit(REQ-AI9-013a).
/// - 그 외 EOF 는 기존 `decide_outcome` 폴백(REQ-AI9-013). stderr 은 기존 `classify_stderr` 재사용(REQ-AI9-014).
/// - `research`(SPEC-AI-016)면 `agent_message` 를 청크로 보내지 않고(마지막 본문은 그대로 최종 결과),
///   도구 활동 누적값이 바뀔 때 `ai://research` 를 발행한다(항상 `ai://done` 보다 먼저).
pub fn relay_codex_process(
    app_handle: AppHandle,
    request_id: String,
    stdout: ChildStdout,
    stderr: ChildStderr,
    cancel_flag: Arc<AtomicBool>,
    truncated: bool,
    finished: Arc<AtomicBool>,
    research: bool,
) {
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let mut last_message: Option<String> = None;
        let mut saw_stream_output = false;
        let mut activity = ResearchActivity::default();

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };
            saw_stream_output = true;
            let decision = decide_codex_line(&line, research, &mut activity);
            if let Some(snapshot) = decision.activity {
                let _ = app_handle.emit(
                    "ai://research",
                    ResearchPayload::new(&request_id, snapshot),
                );
            }
            if let Some(text) = parse_codex_agent_message(&line) {
                // REQ-AI9-011: agent_message 도착 즉시 ai://chunk 를 정확히 1회 emit(토큰 분할 금지).
                // 완성본을 통째로 전달한다. 마지막 수신 본문을 기억해 turn.completed 시 result 로 사용.
                // 리서치(SPEC-AI-016)에서는 청크를 보내지 않고 최종 결과로만 쓴다(decision.chunk 가 None).
                last_message = Some(text);
                if let Some(chunk) = decision.chunk {
                    let _ = app_handle.emit(
                        "ai://chunk",
                        ChunkPayload {
                            request_id: request_id.clone(),
                            text: chunk,
                        },
                    );
                }
            } else if parse_codex_turn_completed(&line) {
                // REQ-AI9-012: turn.completed 수신 시 ai://done emit. result 는 마지막 agent_message 본문.
                // claim_terminal 단일 발행 — 워치독/ai_cancel/신규 요청 교체와 동일 finished 공유.
                if claim_terminal(&finished) {
                    let result = last_message.clone().unwrap_or_default();
                    let _ = app_handle.emit(
                        "ai://done",
                        codex_done_payload(request_id.clone(), result, truncated),
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
            if let Some(result) = codex_eof_result(last_message, research) {
                if claim_terminal(&finished) {
                    let _ = app_handle.emit(
                        "ai://done",
                        codex_done_payload(request_id, result, truncated),
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
        // 모델 목록은 조회하지 않는다 — 자동 모드에서 요청마다 불리므로 명령 계층이 붙인다(SPEC-AI-014).
        crate::ai::detect::detect_codex()
    }

    fn spawn(&self, request: &AiRequest, cwd: &Path) -> Result<Child, String> {
        // REQ-AI9-007a: 정확히 (1) combine_prompts → (2) build_codex_args → (3) spawn_codex 순서.
        // 순서 변경·단계 누락은 회귀(combine_prompts 누락 시 codex 가 빈 프롬프트를 받거나
        // system/user 가 분리되어 전달되는 버그 방지). 결합 프롬프트는 인자가 아니라 표준 입력으로
        // 전달된다(SPEC-AI-013 REQ-AI13-002).
        let combined = combine_prompts(&request.system_prompt, &request.user_prompt);
        let args = build_codex_args(request.model.as_deref(), cwd, request.web_allowed);
        spawn_codex(&args, cwd, &combined)
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

    // --- SPEC-AI-014: 모델 인자 계약 (AC-010, AC-011) ---

    #[test]
    fn codex_args_model_absent_vs_present() {
        let scratch = Path::new("/tmp/scratch");
        let none = build_codex_args(None, scratch, false);
        assert_eq!(
            none,
            vec![
                "exec",
                "-C",
                "/tmp/scratch",
                "--ignore-user-config",
                "--skip-git-repo-check",
                "--ephemeral",
                "--sandbox",
                "read-only",
                "-c",
                "features.apps=false",
                "-c",
                "features.shell_tool=false",
                "-c",
                "features.view_image=false",
                "-c",
                "web_search=disabled",
                "--json"
            ]
        );
        let some = build_codex_args(Some("m-a"), scratch, false);
        assert_eq!(some.len(), none.len() + 2);
        let midx = some.iter().position(|a| a == "--model").unwrap();
        assert_eq!(some[midx + 1], "m-a");
        assert_eq!(some.iter().filter(|a| a.as_str() == "m-a").count(), 1);
        assert_eq!(some.last().map(|s| s.as_str()), Some("--json"));
    }

    #[test]
    fn codex_args_have_no_reasoning_override_and_keep_isolation() {
        let scratch = Path::new("/tmp/scratch");
        for model in [None, Some("m-a")] {
            let args = build_codex_args(model, scratch, false);
            // 도구 잠금 -c 4쌍만 허용하고, 추론(reasoning) 관련 -c 는 없어야 한다.
            for (i, a) in args.iter().enumerate() {
                if a == "-c" {
                    let v = &args[i + 1];
                    assert!(!v.contains("reasoning"), "추론 설정 -c 가 있다: {v}");
                    assert!(
                        v.starts_with("features.") || v == "web_search=disabled",
                        "예상 밖 -c: {v}"
                    );
                }
            }
            for flag in [
                "--ignore-user-config",
                "--skip-git-repo-check",
                "--ephemeral",
                "--json",
            ] {
                assert!(args.iter().any(|a| a == flag), "{flag} 누락");
            }
            let sb = args.iter().position(|a| a == "--sandbox").unwrap();
            assert_eq!(args[sb + 1], "read-only");
            let c = args.iter().position(|a| a == "-C").unwrap();
            assert_eq!(args[c + 1], "/tmp/scratch");
        }
    }

    #[test]
    fn codex_args_lock_down_tools_with_four_c_pairs_in_order() {
        // 카드 t10: 셸·연결 앱·이미지 보기·웹 검색을 끄는 -c 4쌍이 격리 플래그 뒤에 이 순서로 있어야 한다.
        let scratch = Path::new("/tmp/scratch");
        let expected = [
            "features.apps=false",
            "features.shell_tool=false",
            "features.view_image=false",
            "web_search=disabled",
        ];
        for model in [None, Some("m-a")] {
            let args = build_codex_args(model, scratch, false);
            let c_values: Vec<&str> = args
                .iter()
                .enumerate()
                .filter(|(_, a)| a.as_str() == "-c")
                .map(|(i, _)| args[i + 1].as_str())
                .collect();
            assert_eq!(c_values, expected, "-c 쌍이 정확히 4개·순서대로여야 함");
            let sb = args.iter().position(|a| a == "--sandbox").unwrap();
            let first_c = args.iter().position(|a| a == "-c").unwrap();
            assert!(first_c > sb + 1, "-c 쌍은 --sandbox read-only 뒤에 온다");
            assert_eq!(args.last().map(|s| s.as_str()), Some("--json"));
        }
    }

    #[test]
    fn codex_detect_reports_no_models() {
        assert!(CodexProvider::new().detect().models.is_empty());
    }

    #[test]
    fn build_codex_args_has_no_prompt_and_last_element_is_json() {
        // AC-AI13-002: 결합 프롬프트는 인자에 없고(표준 입력으로 전달), 마지막 인자는 `--json` 이다.
        let scratch = Path::new("/tmp/scratch");
        let args = build_codex_args(None, scratch, false);
        assert_eq!(args.last().map(|s| s.as_str()), Some("--json"));
        let combined = combine_prompts("SYS-표지-91c2\n둘째 줄", "선택-표지-7f3a");
        assert!(args
            .iter()
            .all(|a| !a.contains("SYS-표지-91c2") && !a.contains("선택-표지-7f3a")));
        assert!(!args.contains(&combined));
    }

    #[test]
    fn codex_done_payload_completion_is_always_unknown() {
        // AC-AI13-009: 정상(turn.completed)·EOF 폴백 두 경로가 쓰는 조립 함수의 completion.
        let p = codex_done_payload("r1".to_string(), "본문".to_string(), false);
        assert_eq!(p.completion, crate::ai::stream::Completion::Unknown);
        let json = serde_json::to_string(&p).unwrap();
        assert!(json.contains("\"completion\":\"unknown\""));
        assert!(json.contains("\"requestId\":\"r1\""));
        assert!(!json.contains("truncated"));
        let t = codex_done_payload("r2".to_string(), "x".to_string(), true);
        assert!(serde_json::to_string(&t)
            .unwrap()
            .contains("\"truncated\":true"));
    }

    #[test]
    fn build_codex_args_scratch_dir_embedded_at_index_2() {
        // -C 다음 원소가 scratch 경로와 일치(절대경로 주입 검증).
        let scratch = Path::new("/var/empty/scratch");
        let args = build_codex_args(None, scratch, false);
        let c_idx = args
            .iter()
            .position(|a| a == "-C")
            .expect("-C 플래그 있어야 함");
        assert_eq!(args[c_idx + 1], "/var/empty/scratch");
    }

    // --- build_codex_command (D6, AC-AI9-005) ---

    #[test]
    fn build_codex_command_returns_command_without_panic() {
        // Command 빌더 자체가 panic 없이 동작하는지 검증. stdin/stdout/stderr 설정은 코드 구조로 강제.
        let binary = Path::new("/usr/local/bin/codex");
        let args = build_codex_args(Some("m-a"), Path::new("/tmp/scratch"), false);
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
            let result = spawn_codex(&args, &cwd, "p");
            assert!(result.is_err());
            let err = result.unwrap_err();
            assert!(err.contains("codex"), "에러 메시지에 codex 언급: {}", err);
            // raw stderr 미노출(안전 메시지).
            assert!(!err.contains("Error:"));
        }
    }

    /// 파서 fixture 검증용 헬퍼 — codex JSONL **PRIMARY(FLAT)** 이벤트 라인을 조립한다(테스트 전용).
    ///
    /// codex-cli 0.144.1 실측 출력 형태(`event` 래퍼 없음)를 반영한다. M8.1.5 fixture 위생 —
    /// 이 헬퍼는 결함 1 재발 방지를 위해 반드시 실측 FLAT 형태를 산출해야 하며, 래핑 형태는
    /// [`wrapped_agent_message_line`]으로 별도 분리한다(AC-AI9-006, primary vs fallback 구분).
    fn agent_message_line(text: &str) -> String {
        let v = serde_json::json!({
            "type": "item.completed",
            "item": {
                "id": "item_0",
                "type": "agent_message",
                "text": text
            }
        });
        serde_json::to_string(&v).unwrap()
    }

    /// 파서 fixture 검증용 헬퍼 — codex JSONL **FALLBACK(래핑)** 이벤트 라인을 조립한다(테스트 전용).
    ///
    /// 향후 codex CLI가 `event` 래퍼를 재도입해도 회귀하지 않도록 하는 FALLBACK 계약 검증 전용이며,
    /// PRIMARY 자리에 쓰지 않는다(AC-AI9-006).
    fn wrapped_agent_message_line(text: &str) -> String {
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
    fn codex_relay_parser_wiring_extracts_agent_message_primary_flat() {
        // stream.rs 의 parse_codex_agent_message 와 연동되는 PRIMARY(FLAT) fixture 검증.
        let line = agent_message_line("AI 완성 본문");
        assert_eq!(
            parse_codex_agent_message(&line),
            Some("AI 완성 본문".to_string())
        );
    }

    #[test]
    fn codex_relay_parser_wiring_extracts_agent_message_fallback_wrapped() {
        // 래핑(event 래퍼) FALLBACK 형태도 연동 경로에서 인식되는지 검증(REQ-AI9-009 FALLBACK 계약).
        let line = wrapped_agent_message_line("AI 완성 본문");
        assert_eq!(
            parse_codex_agent_message(&line),
            Some("AI 완성 본문".to_string())
        );
    }
    // --- SPEC-AI-016: 웹 허용 인자 (AC-AI16-006) ---

    fn c_values(args: &[String]) -> Vec<&str> {
        args.iter()
            .enumerate()
            .filter(|(_, a)| a.as_str() == "-c")
            .map(|(i, _)| args[i + 1].as_str())
            .collect()
    }

    #[test]
    fn codex_args_web_allowed_switches_only_web_search_value() {
        let scratch = Path::new("/tmp/scratch");
        for model in [None, Some("m-a")] {
            let off = build_codex_args(model, scratch, false);
            let on = build_codex_args(model, scratch, true);
            // 원소 수는 같고(17/19) 바뀌는 것은 web_search 값 하나뿐이다.
            assert_eq!(off.len(), if model.is_some() { 19 } else { 17 });
            assert_eq!(on.len(), off.len());
            assert_eq!(
                c_values(&on),
                [
                    "features.apps=false",
                    "features.shell_tool=false",
                    "features.view_image=false",
                    "web_search=live"
                ]
            );
            assert!(on.iter().any(|a| a == "web_search=live"));
            assert!(!on.iter().any(|a| a == "web_search=disabled"));
            assert!(off.iter().any(|a| a == "web_search=disabled"));
            assert!(!off.iter().any(|a| a == "web_search=live"));
            // --disable 은 모르는 이름이면 실행이 실패한다(R9) — 어느 경우에도 쓰지 않는다.
            assert!(!on.iter().any(|a| a == "--disable"));
            assert!(!off.iter().any(|a| a == "--disable"));
            let diff: Vec<_> = on.iter().zip(off.iter()).filter(|(a, b)| a != b).collect();
            assert_eq!(diff.len(), 1, "{diff:?}");
            assert_eq!(on.last().map(|s| s.as_str()), Some("--json"));
        }
    }

    // --- SPEC-AI-016 F1: 리서치 중 turn.completed 없이 끝난 스트림 ---

    const CODEX_NONRESEARCH: &str =
        include_str!("../../tests/fixtures/codex-nonresearch-hardened.jsonl");

    /// 실측 픽스처의 앞 3줄(서술 메시지까지, turn.completed 이전)을 릴레이 루프처럼 처리한다.
    fn replay_truncated_before_completion() -> (Option<String>, bool) {
        let mut last: Option<String> = None;
        let mut completed = false;
        for line in CODEX_NONRESEARCH.lines().take(3) {
            if let Some(t) = parse_codex_agent_message(line) {
                last = Some(t);
            } else if parse_codex_turn_completed(line) {
                completed = true;
            }
        }
        (last, completed)
    }

    #[test]
    fn research_eof_without_turn_completed_does_not_use_narration_as_result() {
        let (last, completed) = replay_truncated_before_completion();
        assert!(!completed);
        assert!(last.as_deref().unwrap().contains("확인하겠습니다"));
        assert_eq!(codex_eof_result(last, true), None);
    }

    #[test]
    fn non_research_eof_without_turn_completed_keeps_last_message_fallback() {
        let (last, _) = replay_truncated_before_completion();
        assert_eq!(codex_eof_result(last.clone(), false), last);
    }
}
