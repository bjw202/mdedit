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

/// FLAT(PRIMARY) 우선, 실패 시 `event` 래퍼(FALLBACK)로 폴백해 이벤트 노드를 선택한다
/// (REQ-AI9-009/010 공용, M8.1.4 REFACTOR — 두 파서의 "FLAT vs 래핑 노드 선택" 중복 제거).
///
/// `value`의 최상위 `type`이 `expected_type`과 일치하면 그 값 자체를 반환한다
/// (PRIMARY, codex-cli 0.144.1 실측 — `event` 래퍼 없음).
/// 일치하지 않으면 최상위 `type`이 `"event"`이고 `event.type`이 `expected_type`인 경우
/// `event` 서브값을 반환한다(FALLBACK, 레거시/미래 호환 래핑 형태).
/// 둘 다 아니거나 형태가 어긋나면 `None`(panic 없음).
fn codex_event_node<'a>(value: &'a Value, expected_type: &str) -> Option<&'a Value> {
    if value.get("type")?.as_str()? == expected_type {
        return Some(value);
    }
    if value.get("type")?.as_str()? == "event" {
        let event = value.get("event")?;
        if event.get("type")?.as_str()? == expected_type {
            return Some(event);
        }
    }
    None
}

/// codex `--json` 출력 한 줄에서 `item.completed(agent_message)` 의 본문 텍스트를 추출한다(순수, REQ-AI9-009).
///
/// 인정하는 라인 형태(우선순위 순, M8.1.3 GREEN — 결함 1 수정):
/// - **PRIMARY(실측, codex-cli 0.144.1)** — `event` 래퍼 없는 FLAT 형태:
///   `{"type":"item.completed","item":{"type":"agent_message","text":"<본문>"}}`
/// - **FALLBACK(레거시/미래 호환)** — 래핑 형태:
///   `{"type":"event","event":{"type":"item.completed","item":{"type":"agent_message","text":"<본문>"}}}`
///
/// 두 형태 모두 `item.type == "agent_message"`이면 `item.text`를 반환한다.
/// 그 외 이벤트(`thread.started`, `turn.started`, `turn.completed`, `item.completed` 이더라도
/// item.type 이 reasoning 등 다른 경우)이거나 JSON 파싱 실패면 `None`(panic 없음, raw JSON 노출 없음).
/// `parse_text_delta`(stream.rs:40-55)와 동일한 안전 계약.
pub fn parse_codex_agent_message(line: &str) -> Option<String> {
    let value: Value = serde_json::from_str(line.trim()).ok()?;

    let event = codex_event_node(&value, "item.completed")?;
    let item = event.get("item")?;
    if item.get("type")?.as_str()? != "agent_message" {
        return None;
    }
    item.get("text")?.as_str().map(|s| s.to_string())
}

/// codex `--json` 라인이 `turn.completed` 이벤트(usage 포함 최종 종료 신호)인지 판정한다(순수, REQ-AI9-010).
///
/// 인정하는 라인 형태(우선순위 순, M8.1.3 GREEN — 결함 1 수정):
/// - **PRIMARY(실측)** — FLAT: `{"type":"turn.completed","usage":{...}}`
/// - **FALLBACK** — 래핑: `{"type":"event","event":{"type":"turn.completed","usage":{...}}}`
///
/// 둘 중 하나에 해당하면 `true`, 그 외 이벤트이거나 JSON 파싱 실패면 `false`(panic 없음).
/// `usage` 필드의 존재 여부는 판정 조건이 아니다(있으면 참고, 없어도 `true`).
pub fn parse_codex_turn_completed(line: &str) -> bool {
    let Ok(value) = serde_json::from_str::<Value>(line.trim()) else {
        return false;
    };
    codex_event_node(&value, "turn.completed").is_some()
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
    // M8.1.1/M8.1.2 (RED): codex-cli 0.144.1 실측 캡처 4줄(acceptance.md AC-AI9-006).
    // PRIMARY = event 래퍼 없는 FLAT 형태. FALLBACK = 래핑(event 래퍼) 형태.
    // 아래 4개 상수는 실측 원문 그대로이며(날조 금지, Design Notes), 다른 fixture 조립에 사용하지 않는다.

    const CODEX_CAPTURE_THREAD_STARTED: &str =
        r#"{"type":"thread.started","thread_id":"019f9446-9070-7750-bcbe-798b7622ce1f"}"#;
    const CODEX_CAPTURE_TURN_STARTED: &str = r#"{"type":"turn.started"}"#;
    const CODEX_CAPTURE_AGENT_MESSAGE: &str =
        r#"{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"Hi"}}"#;
    const CODEX_CAPTURE_TURN_COMPLETED: &str = r#"{"type":"turn.completed","usage":{"input_tokens":14976,"cached_input_tokens":4480,"output_tokens":5,"reasoning_output_tokens":0}}"#;

    #[test]
    fn codex_primary_flat_extracts_agent_message_text() {
        // PRIMARY(실측, codex-cli 0.144.1) — event 래퍼 없는 FLAT 형태에서 text 추출.
        assert_eq!(
            parse_codex_agent_message(CODEX_CAPTURE_AGENT_MESSAGE),
            Some("Hi".to_string())
        );
    }

    #[test]
    fn codex_primary_flat_returns_none_for_thread_started_and_turn_started() {
        // PRIMARY 라인 중 agent_message 가 아닌 이벤트는 None(panic 없음).
        assert_eq!(parse_codex_agent_message(CODEX_CAPTURE_THREAD_STARTED), None);
        assert_eq!(parse_codex_agent_message(CODEX_CAPTURE_TURN_STARTED), None);
    }

    #[test]
    fn codex_primary_flat_returns_none_for_non_agent_message_item_type() {
        // FLAT item.completed 이더라도 item.type 이 reasoning 등 다른 경우 → None.
        let line = r#"{"type":"item.completed","item":{"type":"reasoning","text":"..."}}"#;
        assert_eq!(parse_codex_agent_message(line), None);
    }

    #[test]
    fn codex_fallback_wrapped_extracts_agent_message_text() {
        // FALLBACK(레거시/미래 호환) — event 래퍼가 있는 래핑 형태도 인정한다(사용자 확정 결정).
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
    fn codex_primary_flat_turn_completed_true() {
        // PRIMARY(실측) — event 래퍼 없는 FLAT turn.completed 라인.
        assert!(parse_codex_turn_completed(CODEX_CAPTURE_TURN_COMPLETED));
    }

    #[test]
    fn codex_primary_flat_turn_completed_false_for_other_flat_events() {
        assert!(!parse_codex_turn_completed(CODEX_CAPTURE_THREAD_STARTED));
        assert!(!parse_codex_turn_completed(CODEX_CAPTURE_TURN_STARTED));
        assert!(!parse_codex_turn_completed(CODEX_CAPTURE_AGENT_MESSAGE));
    }

    #[test]
    fn codex_fallback_wrapped_turn_completed_true() {
        // FALLBACK — event 래퍼가 있는 래핑 turn.completed 라인도 인정.
        let line = r#"{"type":"event","event":{"type":"turn.completed","usage":{"input_tokens":120,"output_tokens":80}}}"#;
        assert!(parse_codex_turn_completed(line));
    }

    #[test]
    fn codex_fallback_wrapped_turn_completed_false_for_other_events() {
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
