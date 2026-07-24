// @MX:ANCHOR: [AUTO] claude stream-json 파싱 진입점 - 델타/최종 결과 추출 및 stderr 분류
// @MX:REASON: [AUTO] AI 릴레이 스레드가 라인마다 호출하는 파싱 계약 (fan_in >= 2: relay + result 2차 파싱)
// @MX:SPEC: SPEC-AI-001

//! claude CLI(`--output-format stream-json`) 및 codex CLI(`--json` JSONL) 출력과 stderr 를 해석하는
//! 순수 함수 모음.
//!
//! 모든 함수는 부작용이 없어 Tauri 런타임 없이 단위 테스트한다.
//! 파싱 실패는 절대 panic 하지 않으며 raw JSON 을 프론트로 노출하지 않는다(REQ-AI-040).
//! SPEC-AI-009: codex 전용 파서(parse_codex_agent_message/parse_codex_turn_completed)가 추가됐다.
//! 기존 claude 파서(parse_text_delta/parse_final_result/classify_stderr)는 무변경이다(REQ-AI9-023).

use serde_json::Value;

/// stderr 원인 분류. 프론트에는 이 enum(문자열화)만 전달하고 raw stderr는 감춘다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StderrKind {
    /// 로그인 세션 만료·인증 실패.
    LoginExpired,
    /// 네트워크 차단·프록시·타임아웃.
    Network,
    /// 그 외(도구 업데이트, 알 수 없는 실패).
    Other,
}

impl StderrKind {
    /// `ai://error` payload의 `kind` 문자열 키(IPC 계약: 'login'|'network'|'other', 'parse'는 별도).
    pub fn as_key(&self) -> &'static str {
        match self {
            StderrKind::LoginExpired => "login",
            StderrKind::Network => "network",
            StderrKind::Other => "other",
        }
    }
}

/// stream-json 한 줄에서 `text_delta`의 `text`를 추출한다.
///
/// 대상 형태:
/// `{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}}`
///
/// 형태가 다르거나 JSON 파싱이 실패하면 `None`(패닉·raw 노출 없음).
pub fn parse_text_delta(line: &str) -> Option<String> {
    let value: Value = serde_json::from_str(line.trim()).ok()?;

    if value.get("type")?.as_str()? != "stream_event" {
        return None;
    }
    let event = value.get("event")?;
    if event.get("type")?.as_str()? != "content_block_delta" {
        return None;
    }
    let delta = event.get("delta")?;
    if delta.get("type")?.as_str()? != "text_delta" {
        return None;
    }
    Some(delta.get("text")?.as_str()?.to_string())
}

/// 최종 결과 라인에서 `result` 문자열을 추출한다.
///
/// 대상 형태: `{"type":"result","subtype":"success","result":"<전문>"}`
///
/// `subtype`이 success가 아니거나 형태가 다르면 `None`(오류 처리는 stderr 분류가 담당).
pub fn parse_final_result(line: &str) -> Option<String> {
    let value: Value = serde_json::from_str(line.trim()).ok()?;

    if value.get("type")?.as_str()? != "result" {
        return None;
    }
    if value.get("subtype")?.as_str()? != "success" {
        return None;
    }
    Some(value.get("result")?.as_str()?.to_string())
}

/// stderr 텍스트를 로그인/네트워크/기타로 분류한다.
///
/// 휴리스틱: 인증 관련 키워드를 네트워크보다 우선 검사한다.
/// (네트워크 오류를 로그인 만료로 오안내하지 않기 위해 순서가 중요, REQ-AI-037)
pub fn classify_stderr(stderr: &str) -> StderrKind {
    let lower = stderr.to_lowercase();

    const LOGIN_MARKERS: &[&str] = &[
        "login",
        "log in",
        "logged in",
        "logged out",
        "auth",
        "unauthorized",
        "unauthenticated",
        "oauth",
        "token expired",
        "expired token",
        "session expired",
        "credential",
        "not authenticated",
        "please run",
        "invalid api key",
        "403",
        "401",
    ];
    const NETWORK_MARKERS: &[&str] = &[
        "network",
        "connection",
        "connect",
        "timeout",
        "timed out",
        "proxy",
        "econnrefused",
        "enotfound",
        "dns",
        "offline",
        "unreachable",
        "socket",
        "getaddrinfo",
        "certificate",
        "ssl",
        "tls",
    ];

    if LOGIN_MARKERS.iter().any(|m| lower.contains(m)) {
        return StderrKind::LoginExpired;
    }
    if NETWORK_MARKERS.iter().any(|m| lower.contains(m)) {
        return StderrKind::Network;
    }
    StderrKind::Other
}

// ============================================================================
// SPEC-AI-009 — codex JSONL 파싱 (REQ-AI9-009/010, AC-AI9-006)
// ============================================================================
// @MX:NOTE: [AUTO] codex --json 은 stream-json 과 완전히 다른 이벤트 모델을 쓴다 — item.completed 의
//   agent_message 가 완성본을 한 번에 실어 보낸다(토큰 단위 스트리밍 아님, 실측). 별도 파서로 분리.
// @MX:SPEC: SPEC-AI-009

/// codex `--json` 출력 한 줄에서 `item.completed(agent_message)` 의 본문 텍스트를 추출한다(순수, REQ-AI9-009).
///
/// 대상 형태(codex-cli 0.144.1 실측 기준):
/// `{"type":"event","event":{"type":"item.completed","item":{"type":"agent_message","text":"<본문>"}}}`
///
/// 이벤트 타입이 `item.completed` 이고 그 item.type 이 `"agent_message"` 면 `item.text` 를 반환한다.
/// 그 외 이벤트(`thread.started`, `turn.started`, `turn.completed`, `item.completed` 이더라도
/// item.type 이 reasoning 등 다른 경우)이거나 JSON 파싱 실패면 `None`(panic 없음, raw JSON 노출 없음).
/// `parse_text_delta`(stream.rs:40-55)와 동일한 안전 계약.
pub fn parse_codex_agent_message(line: &str) -> Option<String> {
    let value: Value = serde_json::from_str(line.trim()).ok()?;

    if value.get("type")?.as_str()? != "event" {
        return None;
    }
    let event = value.get("event")?;
    if event.get("type")?.as_str()? != "item.completed" {
        return None;
    }
    let item = event.get("item")?;
    if item.get("type")?.as_str()? != "agent_message" {
        return None;
    }
    item.get("text")?.as_str().map(|s| s.to_string())
}

/// codex `--json` 라인이 `turn.completed` 이벤트(usage 포함 최종 종료 신호)인지 판정한다(순수, REQ-AI9-010).
///
/// 대상 형태: `{"type":"event","event":{"type":"turn.completed","usage":{...}}}`
///
/// `turn.completed` 면 `true`, 그 외 이벤트이거나 JSON 파싱 실패면 `false`(panic 없음).
pub fn parse_codex_turn_completed(line: &str) -> bool {
    let Ok(value) = serde_json::from_str::<Value>(line.trim()) else {
        return false;
    };
    // m2 정정: 최상위 type=="event" 래퍼 검사(parse_codex_agent_message와 대칭).
    // 비정상 래퍼{"type":"other",...}에 대한 오탐을 방지한다.
    if value.get("type").and_then(|v| v.as_str()) != Some("event") {
        return false;
    }
    let Some(event_type) = value
        .get("event")
        .and_then(|e| e.get("type"))
        .and_then(|t| t.as_str())
    else {
        return false;
    };
    event_type == "turn.completed"
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- parse_text_delta ---

    #[test]
    fn extracts_text_from_valid_delta_line() {
        let line = r#"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"안녕"}}}"#;
        assert_eq!(parse_text_delta(line), Some("안녕".to_string()));
    }

    #[test]
    fn extracts_text_with_trailing_newline() {
        let line = "{\"type\":\"stream_event\",\"event\":{\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"x\"}}}\n";
        assert_eq!(parse_text_delta(line), Some("x".to_string()));
    }

    #[test]
    fn returns_none_for_result_line_in_delta_parser() {
        let line = r#"{"type":"result","subtype":"success","result":"done"}"#;
        assert_eq!(parse_text_delta(line), None);
    }

    #[test]
    fn returns_none_for_wrong_event_type() {
        let line = r#"{"type":"stream_event","event":{"type":"message_start","delta":{"type":"text_delta","text":"x"}}}"#;
        assert_eq!(parse_text_delta(line), None);
    }

    #[test]
    fn returns_none_for_non_text_delta() {
        let line = r#"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"thinking_delta","text":"x"}}}"#;
        assert_eq!(parse_text_delta(line), None);
    }

    #[test]
    fn returns_none_for_malformed_json() {
        assert_eq!(parse_text_delta("{not json"), None);
        assert_eq!(parse_text_delta(""), None);
        assert_eq!(parse_text_delta("   "), None);
        assert_eq!(parse_text_delta("plain log output"), None);
    }

    // --- parse_final_result ---

    #[test]
    fn extracts_final_result_success() {
        let line = r#"{"type":"result","subtype":"success","result":"최종 문장"}"#;
        assert_eq!(parse_final_result(line), Some("최종 문장".to_string()));
    }

    #[test]
    fn returns_none_for_non_success_subtype() {
        let line = r#"{"type":"result","subtype":"error_max_turns","result":"partial"}"#;
        assert_eq!(parse_final_result(line), None);
    }

    #[test]
    fn returns_none_for_delta_line_in_result_parser() {
        let line = r#"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"x"}}}"#;
        assert_eq!(parse_final_result(line), None);
    }

    #[test]
    fn result_parser_never_panics_on_broken_json() {
        assert_eq!(parse_final_result("}{"), None);
        assert_eq!(parse_final_result("null"), None);
        assert_eq!(parse_final_result("[]"), None);
    }

    // --- classify_stderr ---

    #[test]
    fn classifies_login_expired() {
        assert_eq!(
            classify_stderr("Error: Invalid API key · Please run /login"),
            StderrKind::LoginExpired
        );
        assert_eq!(
            classify_stderr("OAuth token expired"),
            StderrKind::LoginExpired
        );
        assert_eq!(
            classify_stderr("401 Unauthorized"),
            StderrKind::LoginExpired
        );
    }

    #[test]
    fn classifies_network() {
        assert_eq!(
            classify_stderr("connect ECONNREFUSED 127.0.0.1:443"),
            StderrKind::Network
        );
        assert_eq!(
            classify_stderr("request timed out"),
            StderrKind::Network
        );
        assert_eq!(
            classify_stderr("proxy tunnel failed"),
            StderrKind::Network
        );
    }

    #[test]
    fn classifies_other_as_fallback() {
        assert_eq!(
            classify_stderr("panic: unexpected token in stream"),
            StderrKind::Other
        );
        assert_eq!(classify_stderr(""), StderrKind::Other);
    }

    #[test]
    fn login_marker_wins_over_network_marker() {
        // 인증 실패 메시지에 network 단어가 섞여도 로그인으로 분류되어야 한다.
        assert_eq!(
            classify_stderr("unauthorized: could not reach auth network endpoint"),
            StderrKind::LoginExpired
        );
    }

    #[test]
    fn kind_key_strings_match_ipc_contract() {
        // IPC 계약: ai://error.kind ∈ {'login','network','parse','other'}
        assert_eq!(StderrKind::LoginExpired.as_key(), "login");
        assert_eq!(StderrKind::Network.as_key(), "network");
        assert_eq!(StderrKind::Other.as_key(), "other");
    }

    // --- SPEC-AI-009 codex JSONL 파싱 (REQ-AI9-009/010, AC-AI9-006) ---

    #[test]
    fn codex_extracts_text_from_agent_message_item_completed() {
        let line = r#"{"type":"event","event":{"type":"item.completed","item":{"type":"agent_message","text":"AI 완성 본문"}}}"#;
        assert_eq!(
            parse_codex_agent_message(line),
            Some("AI 완성 본문".to_string())
        );
    }

    #[test]
    fn codex_extracts_text_with_trailing_newline() {
        let line = "{\"type\":\"event\",\"event\":{\"type\":\"item.completed\",\"item\":{\"type\":\"agent_message\",\"text\":\"x\"}}}\n";
        assert_eq!(parse_codex_agent_message(line), Some("x".to_string()));
    }

    #[test]
    fn codex_extracts_multiline_text_intact() {
        // EC-1: 긴·다중 행 본문도 통째로 추출(청킹 금지 검증). JSON 안의 개행은 \n escape.
        let body = "line1\nline2\nline3";
        let v = serde_json::json!({
            "type": "event",
            "event": {
                "type": "item.completed",
                "item": {"type": "agent_message", "text": body}
            }
        });
        let line = serde_json::to_string(&v).unwrap();
        assert_eq!(parse_codex_agent_message(&line), Some(body.to_string()));
    }

    #[test]
    fn codex_returns_none_for_thread_started() {
        let line = r#"{"type":"event","event":{"type":"thread.started"}}"#;
        assert_eq!(parse_codex_agent_message(line), None);
    }

    #[test]
    fn codex_returns_none_for_turn_started() {
        let line = r#"{"type":"event","event":{"type":"turn.started"}}"#;
        assert_eq!(parse_codex_agent_message(line), None);
    }

    #[test]
    fn codex_returns_none_for_turn_completed_in_agent_parser() {
        let line = r#"{"type":"event","event":{"type":"turn.completed","usage":{"input_tokens":100}}}"#;
        assert_eq!(parse_codex_agent_message(line), None);
    }

    #[test]
    fn codex_returns_none_for_non_agent_message_item_type() {
        // item.completed 이더라도 item.type 이 reasoning 등 다른 경우 → None.
        let line = r#"{"type":"event","event":{"type":"item.completed","item":{"type":"reasoning","text":"..."}}}"#;
        assert_eq!(parse_codex_agent_message(line), None);
    }

    #[test]
    fn codex_returns_none_for_malformed_json() {
        assert_eq!(parse_codex_agent_message("{not json"), None);
        assert_eq!(parse_codex_agent_message(""), None);
        assert_eq!(parse_codex_agent_message("   "), None);
        assert_eq!(parse_codex_agent_message("plain log output"), None);
    }

    #[test]
    fn codex_agent_parser_never_panics_on_broken_input() {
        // raw JSON 노출 없이 None 반환(panic 방지).
        assert_eq!(parse_codex_agent_message("}{"), None);
        assert_eq!(parse_codex_agent_message("null"), None);
        assert_eq!(parse_codex_agent_message("[]"), None);
        assert_eq!(parse_codex_agent_message("42"), None);
    }

    #[test]
    fn codex_returns_none_when_event_wrapper_missing() {
        // type/event 경로가 다른 변형 → None(과잉 단언 없이 유연한 탐색).
        assert_eq!(
            parse_codex_agent_message(r#"{"item":{"type":"agent_message","text":"x"}}"#),
            None
        );
        assert_eq!(
            parse_codex_agent_message(r#"{"type":"event","event":{"type":"other"}}"#),
            None
        );
    }

    // --- parse_codex_turn_completed (REQ-AI9-010) ---

    #[test]
    fn codex_turn_completed_true_for_turn_completed_event() {
        let line = r#"{"type":"event","event":{"type":"turn.completed","usage":{"input_tokens":120,"output_tokens":80}}}"#;
        assert!(parse_codex_turn_completed(line));
    }

    #[test]
    fn codex_turn_completed_false_for_other_events() {
        assert!(!parse_codex_turn_completed(
            r#"{"type":"event","event":{"type":"thread.started"}}"#
        ));
        assert!(!parse_codex_turn_completed(
            r#"{"type":"event","event":{"type":"turn.started"}}"#
        ));
        assert!(!parse_codex_turn_completed(
            r#"{"type":"event","event":{"type":"item.completed","item":{"type":"agent_message","text":"x"}}}"#
        ));
    }

    #[test]
    fn codex_turn_completed_false_for_malformed() {
        assert!(!parse_codex_turn_completed(""));
        assert!(!parse_codex_turn_completed("}{"));
        assert!(!parse_codex_turn_completed("null"));
        assert!(!parse_codex_turn_completed("plain text"));
    }

    #[test]
    fn codex_turn_completed_false_when_event_field_missing() {
        assert!(!parse_codex_turn_completed(r#"{"type":"event"}"#));
        assert!(!parse_codex_turn_completed(
            r#"{"type":"event","event":null}"#
        ));
    }

    // --- EC-8: codex stderr 은 기존 classify_stderr 재사용 (REQ-AI9-014) ---

    #[test]
    fn codex_stderr_classified_by_existing_classify_stderr() {
        // REQ-AI9-014: codex 전용 stderr 파서를 새로 만들지 않는다. 기존 classify_stderr 로
        // login/network/other 분류가 동일하게 동작함을 검증.
        assert_eq!(
            classify_stderr("401 unauthorized"),
            StderrKind::LoginExpired
        );
        assert_eq!(
            classify_stderr("connect ETIMEDOUT"),
            StderrKind::Network
        );
        assert_eq!(classify_stderr("unexpected panic"), StderrKind::Other);
    }
}
