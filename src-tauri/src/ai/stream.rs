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

/// 응답이 끝까지 왔는지에 대한 판정. `ai://done` payload 에 소문자 문자열로 실린다(SPEC-AI-013 D7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Completion {
    /// 정지 사유 `end_turn`·`stop_sequence` 를 확인했다.
    Complete,
    /// 정지 사유 `max_tokens` 를 확인했다(응답이 중간에 끊김).
    Cutoff,
    /// 정지 사유를 확인하지 못했다(codex 포함). 「완결」로 취급하지 않는다.
    Unknown,
}

/// claude stream-json 한 줄에서 정지 사유를 읽는다(순수).
///
/// 대상 형태(M1 실측): `{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"end_turn",...}}}`.
/// `result` 줄 최상위 `stop_reason` 은 읽지 않는다 — 실측에서 `max_tokens` 실패에도 `stop_sequence` 로
/// 찍혔다. `assistant` 줄의 `message.stop_reason` 도 읽지 않는다(스트림 이벤트가 정본).
pub fn parse_stop_reason(line: &str) -> Option<String> {
    let value: Value = serde_json::from_str(line.trim()).ok()?;
    if value.get("type")?.as_str()? != "stream_event" {
        return None;
    }
    let event = value.get("event")?;
    if event.get("type")?.as_str()? != "message_delta" {
        return None;
    }
    Some(event.get("delta")?.get("stop_reason")?.as_str()?.to_string())
}

/// 한 실행 동안 정지 사유를 끈적하게 모으는 순수 집계기(SPEC-AI-013 D7).
///
/// `max_tokens` 를 한 번이라도 보면 이후 다른 사유로 덮지 않고 `Cutoff`, 아니면 `end_turn`·
/// `stop_sequence` 를 봤을 때 `Complete`, 하나도 못 봤으면 `Unknown`.
#[derive(Debug, Default, Clone, Copy)]
pub struct CompletionTracker {
    saw_cutoff: bool,
    saw_complete: bool,
}

impl CompletionTracker {
    /// stdout 한 줄을 넣는다(정지 사유가 없는 줄은 무시).
    pub fn observe(&mut self, line: &str) {
        match parse_stop_reason(line).as_deref() {
            Some("max_tokens") => self.saw_cutoff = true,
            Some("end_turn") | Some("stop_sequence") => self.saw_complete = true,
            _ => {}
        }
    }

    pub fn completion(&self) -> Completion {
        if self.saw_cutoff {
            Completion::Cutoff
        } else if self.saw_complete {
            Completion::Complete
        } else {
            Completion::Unknown
        }
    }
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

// ============================================================================
// SPEC-AI-016 — 리서치 도구 활동 집계 (REQ-AI16-008/009, D6/D7)
// ============================================================================
// @MX:NOTE: [AUTO] 리서치 스트림에서 검색 횟수·"열어 본 페이지" 주소를 집계하는 순수 계층. 파서는
//   spike 실측 캡처(tests/fixtures/*research*, *webfetch-error*, *open-page-failed*)로만 검증한다.
//   "열어 본" 판정: claude — user 줄 tool_use_result 객체의 url + 2xx code(실패는 문자열, R12);
//   codex — open_page 의 results 안에 action.url 과 같은 url(정규화 후)이 있을 때(실패는 url 없음, R13).
// @MX:SPEC: SPEC-AI-016

/// 리서치 중 누적된 도구 활동. `ai://research` payload 의 원본이다.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ResearchActivity {
    /// 웹 검색 횟수.
    pub searches: usize,
    /// 열어 본 페이지 주소(발생 순서, 정규화 기준 중복 없음).
    pub opened: Vec<String>,
}

/// 도구 활동 한 건.
#[derive(Debug, Clone, PartialEq, Eq)]
enum ResearchEvent {
    Search,
    Opened(String),
}

impl ResearchActivity {
    /// 활동 이벤트를 반영하고, 누적값이 바뀌었을 때만 현재 스냅샷을 돌려준다(중복 발행 방지).
    fn apply(&mut self, events: Vec<ResearchEvent>) -> Option<ResearchActivity> {
        let mut changed = false;
        for ev in events {
            match ev {
                ResearchEvent::Search => {
                    self.searches += 1;
                    changed = true;
                }
                ResearchEvent::Opened(url) => {
                    let key = normalize_url(&url);
                    if !self.opened.iter().any(|u| normalize_url(u) == key) {
                        self.opened.push(url);
                        changed = true;
                    }
                }
            }
        }
        changed.then(|| self.clone())
    }
}

/// 주소 비교용 정규화(D7): 스킴·호스트 소문자, `#` 뒤 제거, 끝 `/` 제거. 경로 대소문자는 유지한다.
pub fn normalize_url(url: &str) -> String {
    let no_fragment = url.split('#').next().unwrap_or("");
    let (scheme, rest) = match no_fragment.split_once("://") {
        Some((s, r)) => (s.to_lowercase() + "://", r),
        None => (String::new(), no_fragment),
    };
    let (host, path) = match rest.find('/') {
        Some(i) => (&rest[..i], &rest[i..]),
        None => (rest, ""),
    };
    let mut out = format!("{}{}{}", scheme, host.to_lowercase(), path);
    while out.ends_with('/') {
        out.pop();
    }
    out
}

/// claude stream-json 한 줄의 도구 활동: `assistant` 줄의 `WebSearch` 호출은 검색 1회,
/// `user` 줄의 `tool_use_result` 가 `url` 과 2xx `code` 를 가진 객체면 열어 본 주소.
fn parse_claude_research_events(line: &str) -> Vec<ResearchEvent> {
    let Ok(value) = serde_json::from_str::<Value>(line.trim()) else {
        return vec![];
    };
    match value.get("type").and_then(Value::as_str) {
        Some("assistant") => value
            .get("message")
            .and_then(|m| m.get("content"))
            .and_then(Value::as_array)
            .map(|blocks| {
                blocks
                    .iter()
                    .filter(|b| {
                        b.get("type").and_then(Value::as_str) == Some("tool_use")
                            && b.get("name").and_then(Value::as_str) == Some("WebSearch")
                    })
                    .map(|_| ResearchEvent::Search)
                    .collect()
            })
            .unwrap_or_default(),
        Some("user") => {
            let Some(result) = value.get("tool_use_result").and_then(Value::as_object) else {
                return vec![];
            };
            let ok = result
                .get("code")
                .and_then(Value::as_u64)
                .is_some_and(|c| (200..300).contains(&c));
            match (ok, result.get("url").and_then(Value::as_str)) {
                (true, Some(url)) => vec![ResearchEvent::Opened(url.to_string())],
                _ => vec![],
            }
        }
        _ => vec![],
    }
}

/// codex JSONL 한 줄의 도구 활동: `item.completed` 의 `web_search` 항목 중 `action.type == "search"` 는
/// 검색 1회, `"open_page"` 는 `results` 에 `action.url` 과 같은 `url` 이 있을 때만 열어 본 주소.
fn parse_codex_research_events(line: &str) -> Vec<ResearchEvent> {
    let Ok(value) = serde_json::from_str::<Value>(line.trim()) else {
        return vec![];
    };
    let Some(node) = codex_event_node(&value, "item.completed") else {
        return vec![];
    };
    let Some(item) = node.get("item") else {
        return vec![];
    };
    if item.get("type").and_then(Value::as_str) != Some("web_search") {
        return vec![];
    }
    let Some(action) = item.get("action") else {
        return vec![];
    };
    match action.get("type").and_then(Value::as_str) {
        Some("search") => vec![ResearchEvent::Search],
        Some("open_page") => {
            let Some(url) = action.get("url").and_then(Value::as_str) else {
                return vec![];
            };
            let key = normalize_url(url);
            let confirmed = item
                .get("results")
                .and_then(Value::as_array)
                .is_some_and(|rs| {
                    rs.iter().any(|r| {
                        r.get("url")
                            .and_then(Value::as_str)
                            .is_some_and(|u| normalize_url(u) == key)
                    })
                });
            if confirmed {
                vec![ResearchEvent::Opened(url.to_string())]
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

/// 릴레이가 한 줄에서 내보낼 것(순수 판정 결과) — 스레드·emit 은 호출부가 얇게 맡는다.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct RelayLine {
    /// `ai://chunk` 로 보낼 텍스트. 리서치에서는 항상 `None`(D6 — 중간 서술을 카드로 보내지 않는다).
    pub chunk: Option<String>,
    /// `ai://research` 로 보낼 누적 스냅샷(리서치이고 누적값이 바뀐 줄에서만).
    pub activity: Option<ResearchActivity>,
}

/// claude 한 줄 판정. 리서치가 아니면 기존처럼 `text_delta` 가 청크, 리서치면 청크 없이 활동만 센다.
/// 최종 결과(`result` 줄)·완결 추적은 호출부가 `parse_final_result`/`CompletionTracker` 로 그대로 처리한다.
pub fn decide_claude_line(line: &str, research: bool, acc: &mut ResearchActivity) -> RelayLine {
    if research {
        RelayLine {
            chunk: None,
            activity: acc.apply(parse_claude_research_events(line)),
        }
    } else {
        RelayLine {
            chunk: parse_text_delta(line),
            activity: None,
        }
    }
}

/// codex 한 줄 판정. 리서치가 아니면 `agent_message` 마다 청크, 리서치면 청크 없이 활동만 센다.
/// 마지막 `agent_message` 를 최종 결과로 기억하는 일은 호출부가 `parse_codex_agent_message` 로 그대로 한다.
pub fn decide_codex_line(line: &str, research: bool, acc: &mut ResearchActivity) -> RelayLine {
    if research {
        RelayLine {
            chunk: None,
            activity: acc.apply(parse_codex_research_events(line)),
        }
    } else {
        RelayLine {
            chunk: parse_codex_agent_message(line),
            activity: None,
        }
    }
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

    // --- SPEC-AI-013 완결 판정 (AC-AI13-008): M1 실측 캡처 원문 fixture ---

    const COMPLETE_FIXTURE: &str =
        include_str!("../../tests/fixtures/claude-stop-reason-complete.jsonl");
    const CUTOFF_FIXTURE: &str =
        include_str!("../../tests/fixtures/claude-stop-reason-cutoff.jsonl");

    fn run_tracker<'a>(lines: impl IntoIterator<Item = &'a str>) -> Completion {
        let mut t = CompletionTracker::default();
        for l in lines {
            t.observe(l);
        }
        t.completion()
    }

    /// message_delta 줄(정지 사유를 담은 줄)인지.
    fn is_message_delta(line: &str) -> bool {
        line.contains("\"type\":\"message_delta\"")
    }

    #[test]
    fn parse_stop_reason_reads_only_stream_event_message_delta() {
        let delta = COMPLETE_FIXTURE
            .lines()
            .find(|l| is_message_delta(l))
            .expect("fixture 에 message_delta 줄이 있어야 한다");
        assert_eq!(parse_stop_reason(delta), Some("end_turn".to_string()));
        // assistant 줄·result 줄의 정지 사유는 읽지 않는다(M1: result 줄은 max_tokens 에서도 stop_sequence).
        for l in COMPLETE_FIXTURE.lines().filter(|l| !is_message_delta(l)) {
            assert_eq!(parse_stop_reason(l), None, "{}", &l[..l.len().min(80)]);
        }
        assert_eq!(parse_stop_reason("not json"), None);
        assert_eq!(parse_stop_reason(""), None);
    }

    #[test]
    fn completion_complete_fixture_is_complete() {
        assert_eq!(run_tracker(COMPLETE_FIXTURE.lines()), Completion::Complete);
    }

    #[test]
    fn completion_cutoff_fixture_is_cutoff() {
        assert_eq!(run_tracker(CUTOFF_FIXTURE.lines()), Completion::Cutoff);
    }

    #[test]
    fn completion_without_stop_reason_lines_is_unknown() {
        // 정지 사유가 든 message_delta 줄을 모두 뺀다. assistant·result 줄의 정지 사유는 세지 않는다.
        let stripped = COMPLETE_FIXTURE.lines().filter(|l| !is_message_delta(l));
        assert_eq!(run_tracker(stripped), Completion::Unknown);
    }

    #[test]
    fn completion_cutoff_is_sticky_against_later_end_turn() {
        let end_turn = COMPLETE_FIXTURE
            .lines()
            .find(|l| is_message_delta(l))
            .unwrap();
        let lines: Vec<&str> = CUTOFF_FIXTURE.lines().chain(std::iter::once(end_turn)).collect();
        assert_eq!(run_tracker(lines), Completion::Cutoff);
    }

    #[test]
    fn completion_serializes_lowercase() {
        assert_eq!(serde_json::to_string(&Completion::Complete).unwrap(), "\"complete\"");
        assert_eq!(serde_json::to_string(&Completion::Cutoff).unwrap(), "\"cutoff\"");
        assert_eq!(serde_json::to_string(&Completion::Unknown).unwrap(), "\"unknown\"");
    }
    // --- SPEC-AI-016 M3: 리서치 도구 활동 집계 (AC-AI16-007/008/009) ---

    const CLAUDE_CANONICAL: &str = include_str!("../../tests/fixtures/claude-research-canonical.jsonl");
    const CLAUDE_HAIKU: &str = include_str!("../../tests/fixtures/claude-research-haiku.jsonl");
    const CLAUDE_NARRATION: &str = include_str!("../../tests/fixtures/claude-research-narration.jsonl");
    const CLAUDE_FETCH_ERROR: &str = include_str!("../../tests/fixtures/claude-webfetch-error.jsonl");
    const CODEX_CANONICAL: &str = include_str!("../../tests/fixtures/codex-research-canonical.jsonl");
    const CODEX_LIVE: &str = include_str!("../../tests/fixtures/codex-research-live.jsonl");
    const CODEX_OPEN_FAILED: &str = include_str!("../../tests/fixtures/codex-open-page-failed.jsonl");
    const CODEX_NONRESEARCH: &str =
        include_str!("../../tests/fixtures/codex-nonresearch-hardened.jsonl");

    const TAURI_BLOG: &str = "https://v2.tauri.app/blog/tauri-20/";
    const TAURI_CAPS: &str = "https://v2.tauri.app/security/capabilities/";

    /// 픽스처 전 줄을 판정 함수에 넣어 (청크 수, 스냅샷 목록, 마지막 누적값, 최종 결과)를 모은다.
    struct Replay {
        chunks: Vec<String>,
        snapshots: Vec<ResearchActivity>,
        last: ResearchActivity,
        final_result: Option<String>,
    }

    fn replay_claude(fixture: &str, research: bool) -> Replay {
        let mut acc = ResearchActivity::default();
        let mut r = Replay {
            chunks: vec![],
            snapshots: vec![],
            last: ResearchActivity::default(),
            final_result: None,
        };
        for line in fixture.lines() {
            let d = decide_claude_line(line, research, &mut acc);
            r.chunks.extend(d.chunk);
            r.snapshots.extend(d.activity);
            if let Some(f) = parse_final_result(line) {
                r.final_result = Some(f);
            }
        }
        r.last = acc;
        r
    }

    fn replay_codex(fixture: &str, research: bool) -> Replay {
        let mut acc = ResearchActivity::default();
        let mut r = Replay {
            chunks: vec![],
            snapshots: vec![],
            last: ResearchActivity::default(),
            final_result: None,
        };
        for line in fixture.lines() {
            let d = decide_codex_line(line, research, &mut acc);
            r.chunks.extend(d.chunk);
            r.snapshots.extend(d.activity);
            if let Some(m) = parse_codex_agent_message(line) {
                r.final_result = Some(m);
            }
        }
        r.last = acc;
        r
    }

    fn act(searches: usize, opened: &[&str]) -> ResearchActivity {
        ResearchActivity {
            searches,
            opened: opened.iter().map(|s| s.to_string()).collect(),
        }
    }

    #[test]
    fn claude_research_narration_emits_no_chunks_but_normal_mode_emits_113() {
        let research = replay_claude(CLAUDE_NARRATION, true);
        assert_eq!(research.chunks.len(), 0);
        let result = research.final_result.expect("result 줄");
        assert!(!result.contains("검색하겠습니다"));
        assert!(!result.contains("열어보겠습니다"));
        let normal = replay_claude(CLAUDE_NARRATION, false);
        assert_eq!(normal.chunks.len(), 113);
        assert!(normal.snapshots.is_empty(), "리서치가 아니면 활동을 내지 않는다");
        assert_eq!(normal.final_result.as_deref(), Some(result.as_str()));
    }

    #[test]
    fn claude_activity_final_values_match_captures() {
        assert_eq!(replay_claude(CLAUDE_CANONICAL, true).last, act(2, &[TAURI_BLOG, TAURI_CAPS]));
        assert_eq!(replay_claude(CLAUDE_HAIKU, true).last, act(2, &[TAURI_CAPS, TAURI_BLOG]));
        assert_eq!(
            replay_claude(CLAUDE_NARRATION, true).last,
            act(1, &["https://v2.tauri.app/blog/tauri-2-0-0-beta/", TAURI_BLOG])
        );
        // WebFetch 실패는 tool_use_result 가 문자열이라 열어 본 것으로 치지 않는다(R12).
        assert_eq!(replay_claude(CLAUDE_FETCH_ERROR, true).last, act(0, &[]));
    }

    #[test]
    fn claude_snapshots_emit_once_per_change() {
        let r = replay_claude(CLAUDE_CANONICAL, true);
        assert_eq!(
            r.snapshots,
            vec![
                act(1, &[]),
                act(2, &[]),
                act(2, &[TAURI_BLOG]),
                act(2, &[TAURI_BLOG, TAURI_CAPS]),
            ]
        );
        assert_eq!(replay_claude(CLAUDE_FETCH_ERROR, true).snapshots.len(), 0);
    }

    #[test]
    fn claude_repeated_open_does_not_emit_again() {
        let mut acc = ResearchActivity::default();
        let line = r#"{"type":"user","tool_use_result":{"url":"https://a.b/c","code":200}}"#;
        assert!(decide_claude_line(line, true, &mut acc).activity.is_some());
        assert!(decide_claude_line(line, true, &mut acc).activity.is_none());
        // 4xx 응답은 열어 본 것으로 치지 않는다.
        let bad = r#"{"type":"user","tool_use_result":{"url":"https://a.b/d","code":404}}"#;
        assert!(decide_claude_line(bad, true, &mut acc).activity.is_none());
        assert_eq!(acc, act(0, &["https://a.b/c"]));
    }

    #[test]
    fn codex_activity_final_values_match_captures() {
        assert_eq!(replay_codex(CODEX_CANONICAL, true).last, act(1, &[TAURI_BLOG]));
        // 같은 url 이 results 에 있는 open_page 만 센다. action.type 이 other 인 항목은 세지 않는다.
        assert_eq!(replay_codex(CODEX_LIVE, true).last, act(1, &[TAURI_BLOG]));
        assert_eq!(replay_codex(CODEX_OPEN_FAILED, true).last, act(0, &[]));
        assert_eq!(replay_codex(CODEX_NONRESEARCH, true).last, act(0, &[]));
        assert_eq!(
            replay_codex(CODEX_CANONICAL, true).snapshots,
            vec![act(1, &[]), act(1, &[TAURI_BLOG])]
        );
    }

    #[test]
    fn codex_research_suppresses_chunks_and_keeps_last_message_as_final() {
        let research = replay_codex(CODEX_NONRESEARCH, true);
        assert_eq!(research.chunks.len(), 0);
        let normal = replay_codex(CODEX_NONRESEARCH, false);
        assert_eq!(normal.chunks.len(), 2, "리서치가 아니면 agent_message 마다 청크");
        assert_eq!(normal.final_result, research.final_result);
        assert_eq!(normal.chunks.last(), normal.final_result.as_ref());
        let canon = replay_codex(CODEX_CANONICAL, true);
        assert_eq!(canon.chunks.len(), 0);
        assert!(canon.final_result.unwrap().contains("출처\n1. [Tauri 2.0 Stable Release]"));
        assert_eq!(replay_codex(CODEX_CANONICAL, false).chunks.len(), 1);
    }

    #[test]
    fn normalize_url_follows_d7_rules() {
        assert_eq!(normalize_url("https://Example.com/a/"), normalize_url("https://example.com/a#x"));
        assert_ne!(normalize_url("https://example.com/A"), normalize_url("https://example.com/a"));
        assert_eq!(normalize_url("HTTPS://Example.COM/Path/"), "https://example.com/Path");
    }

    #[test]
    fn research_parsers_never_panic_on_garbage() {
        let mut acc = ResearchActivity::default();
        for l in ["", "not json", "{}", r#"{"type":"assistant"}"#, r#"{"type":"item.completed"}"#] {
            let a = decide_claude_line(l, true, &mut acc);
            let b = decide_codex_line(l, true, &mut acc);
            assert!(a.activity.is_none() && b.activity.is_none());
        }
    }
}
