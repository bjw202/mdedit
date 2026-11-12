// @MX:NOTE: [AUTO] 모델 목록·검증의 단일 출처 - 도구별 고정 목록, codex 조회·캐시, 요청 전 검증
// @MX:SPEC: SPEC-AI-014

//! AI 모델 목록과 검증(SPEC-AI-014).
//!
//! - claude: 고정 별칭 목록. codex: `codex debug models` 조회(3초 한도, 캐시) + 고정 목록 대비.
//! - 앱은 모델 이름을 이 모듈에만 둔다. 요청 전 `validate` 가 허용 목록 밖 모델을 거부한다(조용한 대체 없음).
//! - 캐시 잠금은 하위 프로세스를 기다리는 동안 잡지 않는다. 조회 중 표시(`in_flight`)로 중복 조회를 막는다.

use crate::ai::provider::ProviderStatus;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Mutex};
use std::time::Duration;

/// codex 목록 조회 시간 한도.
pub const QUERY_TIMEOUT: Duration = Duration::from_secs(3);

/// M1 실측(progress.md §E.2)에서 실제 요청에 성공한 claude 별칭.
const CLAUDE_FIXED: &[&str] = &["haiku", "sonnet", "opus", "fable"];

/// M1 실측에서 성공한 codex 모델(조회 `priority` 오름차순).
const CODEX_FIXED: &[(&str, &str)] = &[
    ("gpt-6.1-sol", "GPT-6.1-Sol"),
    ("gpt-6-astra", "GPT-6-Astra"),
    ("gpt-6.1-terra", "GPT-6.1 Terra"),
    ("gpt-6-sol", "GPT-6-Sol"),
    ("gpt-6-luna", "GPT-6-Luna"),
    ("gpt-5.6-sol", "GPT-5.6-Sol"),
    ("gpt-5.6-terra", "GPT-5.6-Terra"),
    ("gpt-5.6-luna", "GPT-5.6-Luna"),
];

/// 드롭다운에 보일 모델 하나. IPC: `{ id, label }`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ModelOption {
    pub id: String,
    pub label: String,
}

impl ModelOption {
    pub fn new(id: &str, label: &str) -> Self {
        Self { id: id.to_string(), label: label.to_string() }
    }
}

/// 요청에 실리는 도구별 모델 선택. `None` 은 "CLI 기본값"(`--model` 생략).
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub struct ModelSelection {
    #[serde(default)]
    pub claude: Option<String>,
    #[serde(default)]
    pub codex: Option<String>,
}

impl ModelSelection {
    /// 라우팅된 도구의 선택만 꺼낸다. 모르는 도구는 `None`.
    pub fn for_provider(&self, provider_id: &str) -> Option<&str> {
        match provider_id {
            "claude" => self.claude.as_deref(),
            "codex" => self.codex.as_deref(),
            _ => None,
        }
    }
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

/// 도구의 고정 목록. 모르는 도구는 빈 목록.
pub fn fixed_list(provider_id: &str) -> Vec<ModelOption> {
    match provider_id {
        "claude" => CLAUDE_FIXED.iter().map(|id| ModelOption::new(id, &capitalize(id))).collect(),
        "codex" => CODEX_FIXED.iter().map(|(id, label)| ModelOption::new(id, label)).collect(),
        _ => Vec::new(),
    }
}

fn display_name(provider_id: &str) -> String {
    match provider_id {
        "claude" => "Claude".to_string(),
        "codex" => "Codex".to_string(),
        other => other.to_string(),
    }
}

/// `codex debug models` JSON 에서 `visibility == "list"` 만 `priority` 오름차순으로 뽑는다(순수).
/// 해석 실패·결과 0개는 `None`.
pub fn parse_codex_catalog(json: &str) -> Option<Vec<ModelOption>> {
    let value: serde_json::Value = serde_json::from_str(json).ok()?;
    let mut rows: Vec<(i64, ModelOption)> = value
        .get("models")?
        .as_array()?
        .iter()
        .filter(|m| m.get("visibility").and_then(|v| v.as_str()) == Some("list"))
        .filter_map(|m| {
            let slug = m.get("slug")?.as_str()?;
            let label = m.get("display_name").and_then(|v| v.as_str()).unwrap_or(slug);
            let priority = m.get("priority").and_then(|v| v.as_i64()).unwrap_or(i64::MAX);
            Some((priority, ModelOption::new(slug, label)))
        })
        .collect();
    if rows.is_empty() {
        return None;
    }
    rows.sort_by_key(|(p, _)| *p);
    Some(rows.into_iter().map(|(_, o)| o).collect())
}

/// 조회 결과. `queried == false` 면 `options` 는 고정 목록(대체)이다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Listing {
    pub options: Vec<ModelOption>,
    pub queried: bool,
}

/// 실행기를 시간 한도 안에서 돌린다. 한도 초과·실패·해석 불가는 고정 목록으로 대체한다.
/// 실행기는 별도 스레드에서 돌고, 호출 쪽은 한도까지만 기다린다.
pub fn query_with<R>(runner: R, timeout: Duration) -> Listing
where
    R: FnOnce(Duration) -> Option<String> + Send + 'static,
{
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(runner(timeout));
    });
    match rx.recv_timeout(timeout).ok().flatten().as_deref().and_then(parse_codex_catalog) {
        Some(options) => Listing { options, queried: true },
        None => Listing { options: fixed_list("codex"), queried: false },
    }
}

// @MX:WARN: [AUTO] 외부 바이너리(codex)를 실행하고 시간 초과 시 자식 프로세스를 kill 한다
// @MX:REASON: [AUTO] 목록 조회가 멈추면 감지·요청 경로가 막힌다. 한도 초과 시 반드시 kill+wait 해야 좀비·누수가 없다.
//   codex 가 node 스크립트라 손자 프로세스가 파이프를 쥐면 읽기 스레드는 그 프로세스가 끝날 때까지 남을 수 있다.
/// 실제 실행기 — `codex debug models` 를 절대 경로로 실행해 stdout 을 돌려준다. 한도 초과 시 kill.
pub fn run_codex_debug_models(timeout: Duration) -> Option<String> {
    use std::io::Read;
    use std::process::{Command, Stdio};
    let binary = crate::ai::detect::codex_binary()?;
    let mut cmd = Command::new(binary);
    crate::process_util::no_window(&mut cmd)
        .args(["debug", "models"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    if let Some(path) = crate::process_util::login_shell_path() {
        cmd.env("PATH", path);
    }
    let mut child = cmd.spawn().ok()?;
    let Some(mut stdout) = child.stdout.take() else {
        let _ = child.kill();
        let _ = child.wait();
        return None;
    };
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stdout.read_to_end(&mut buf);
        let _ = tx.send(buf);
    });
    match rx.recv_timeout(timeout) {
        Ok(buf) => {
            let status = child.wait().ok()?;
            status.success().then(|| String::from_utf8_lossy(&buf).into_owned())
        }
        Err(_) => {
            let _ = child.kill();
            let _ = child.wait();
            None
        }
    }
}

#[derive(Debug)]
enum Cached {
    /// 아직 조회하지 않음(또는 조회를 생략함).
    Empty,
    Fetched(Vec<ModelOption>),
    /// 조회 실패 — 고정 목록 사용. 요청 검증은 재사용, 감지 경로는 재시도.
    Failed,
}

struct InFlightGuard<'a>(&'a AtomicBool);
impl Drop for InFlightGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// codex 목록 캐시. 앱에는 전역 인스턴스 하나, 테스트는 지역 인스턴스를 쓴다.
pub struct CodexCatalog {
    state: Mutex<Cached>,
    in_flight: AtomicBool,
}

impl Default for CodexCatalog {
    fn default() -> Self {
        Self::new()
    }
}

impl CodexCatalog {
    pub const fn new() -> Self {
        Self { state: Mutex::new(Cached::Empty), in_flight: AtomicBool::new(false) }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Cached> {
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn is_in_flight(&self) -> bool {
        self.in_flight.load(Ordering::SeqCst)
    }

    /// 캐시가 비어 있는지(조회 안 함 또는 생략).
    pub fn is_empty(&self) -> bool {
        matches!(*self.lock(), Cached::Empty)
    }

    /// 조회 중 표시를 얻은 쪽만 조회한다. 못 얻으면 기다리지 않고 돌아간다. 잠금은 결과를 쓰는 순간에만 잡는다.
    fn refresh<R>(&self, runner: R, timeout: Duration)
    where
        R: FnOnce(Duration) -> Option<String> + Send + 'static,
    {
        if self
            .in_flight
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }
        let _guard = InFlightGuard(&self.in_flight);
        let listing = query_with(runner, timeout);
        *self.lock() = if listing.queried { Cached::Fetched(listing.options) } else { Cached::Failed };
    }

    /// 캐시만 읽는다(조회하지 않음).
    pub fn list_for(&self, provider_id: &str) -> Vec<ModelOption> {
        if provider_id == "codex" {
            if let Cached::Fetched(list) = &*self.lock() {
                return list.clone();
            }
        }
        fixed_list(provider_id)
    }

    /// 허용 id 목록. codex 는 (캐시된 조회 목록 ∪ 고정 목록).
    pub fn allowed(&self, provider_id: &str) -> Vec<String> {
        let mut ids: Vec<String> = self.list_for(provider_id).into_iter().map(|o| o.id).collect();
        for o in fixed_list(provider_id) {
            if !ids.contains(&o.id) {
                ids.push(o.id);
            }
        }
        ids
    }

    /// 감지 경로: 설치·로그인된 codex 는 캐시가 비었거나 실패 결과일 때 조회한다. 그 밖에는 조회하지 않는다.
    pub fn list_for_status<R>(&self, status: &ProviderStatus, runner: R, timeout: Duration) -> Vec<ModelOption>
    where
        R: FnOnce(Duration) -> Option<String> + Send + 'static,
    {
        if status.id == "codex" && status.installed && status.logged_in {
            let needs_query = !matches!(*self.lock(), Cached::Fetched(_));
            if needs_query {
                self.refresh(runner, timeout);
            }
        }
        self.list_for(&status.id)
    }

    // @MX:ANCHOR: [AUTO] 요청 전 모델 검증 - 허용 목록 밖 모델은 CLI 실행 전에 거부
    // @MX:REASON: [AUTO] ai_request 가 스폰 앞에서 호출하는 유일한 검증점(조용한 대체 금지, 인자 주입 차단)
    /// 요청 모델을 검증한다. `None`(CLI 기본값)은 항상 허용. 조회는 codex + 고정 목록 밖 모델 + 캐시 비어 있음일 때만
    /// 시도하며(많아야 1회), 다른 조회가 진행 중이면 기다리지 않고 지금 목록으로 판정한다.
    pub fn validate<R>(
        &self,
        provider_id: &str,
        model: Option<&str>,
        runner: R,
        timeout: Duration,
    ) -> Result<Option<String>, String>
    where
        R: FnOnce(Duration) -> Option<String> + Send + 'static,
    {
        let Some(model) = model else { return Ok(None) };
        let in_fixed = fixed_list(provider_id).iter().any(|o| o.id == model);
        if in_fixed {
            return Ok(Some(model.to_string()));
        }
        if provider_id == "codex" && self.is_empty() {
            self.refresh(runner, timeout);
        }
        if self.allowed(provider_id).iter().any(|id| id == model) {
            return Ok(Some(model.to_string()));
        }
        let name = display_name(provider_id);
        let settled = provider_id != "codex" || matches!(*self.lock(), Cached::Fetched(_));
        if settled {
            Err(format!("{name}에서 `{model}` 모델을 쓸 수 없어요. 설정 > AI에서 모델을 다시 골라 주세요."))
        } else {
            Err(format!(
                "{name} 모델 목록을 아직 확인하지 못했어요. `{model}` 모델을 확인할 수 없어 요청하지 않았어요. 잠시 뒤 다시 시도하거나 설정 > AI에서 모델을 확인해 주세요."
            ))
        }
    }
}

static CODEX_CATALOG: CodexCatalog = CodexCatalog::new();

/// 캐시된 목록(조회하지 않음).
pub fn list_for(provider_id: &str) -> Vec<ModelOption> {
    CODEX_CATALOG.list_for(provider_id)
}

/// 감지 경로용 목록 — 필요하면 codex 를 조회한다(블로킹, 최대 3초). 비동기 명령에서는 `spawn_blocking` 안에서 부른다.
pub fn list_for_status(status: &ProviderStatus) -> Vec<ModelOption> {
    CODEX_CATALOG.list_for_status(status, run_codex_debug_models, QUERY_TIMEOUT)
}

/// 요청 검증(전역 캐시, 실제 실행기).
pub fn validate(provider_id: &str, model: Option<&str>) -> Result<Option<String>, String> {
    CODEX_CATALOG.validate(provider_id, model, run_codex_debug_models, QUERY_TIMEOUT)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::provider::ProviderStatus;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::{mpsc, Arc};
    use std::thread;
    use std::time::{Duration, Instant};

    const FIXTURE: &str = include_str!("../../tests/fixtures/codex-models-sample.json");
    const SHORT: Duration = Duration::from_millis(100);
    const LONG: Duration = Duration::from_secs(5);
    const CATALOG_M_A: &str =
        r#"{"models":[{"slug":"m-a","display_name":"M A","visibility":"list","priority":1}]}"#;

    fn ids(list: &[ModelOption]) -> Vec<&str> {
        list.iter().map(|o| o.id.as_str()).collect()
    }

    fn codex_status(installed: bool, logged_in: bool) -> ProviderStatus {
        ProviderStatus {
            id: "codex".to_string(),
            installed,
            version: None,
            logged_in,
            models: Vec::new(),
        }
    }

    /// 호출 횟수를 세고 `out` 을 돌려주는 실행기.
    fn counting(
        calls: &Arc<AtomicUsize>,
        out: Option<&'static str>,
    ) -> impl FnOnce(Duration) -> Option<String> + Send + 'static {
        let calls = calls.clone();
        move |_| {
            calls.fetch_add(1, Ordering::SeqCst);
            out.map(|s| s.to_string())
        }
    }

    fn counter() -> Arc<AtomicUsize> {
        Arc::new(AtomicUsize::new(0))
    }

    fn calls_of(c: &Arc<AtomicUsize>) -> usize {
        c.load(Ordering::SeqCst)
    }

    // --- 고정 목록 (AC-012) ---

    #[test]
    fn claude_fixed_list_matches_m1_aliases_with_capitalized_labels() {
        let list = list_for("claude");
        assert_eq!(ids(&list), vec!["haiku", "sonnet", "opus", "fable"]);
        let labels: Vec<&str> = list.iter().map(|o| o.label.as_str()).collect();
        assert_eq!(labels, vec!["Haiku", "Sonnet", "Opus", "Fable"]);
    }

    #[test]
    fn codex_fixed_list_matches_m1_priority_order() {
        let list = fixed_list("codex");
        assert_eq!(
            ids(&list),
            vec![
                "gpt-6.1-sol",
                "gpt-6-astra",
                "gpt-6.1-terra",
                "gpt-6-sol",
                "gpt-6-luna",
                "gpt-5.6-sol",
                "gpt-5.6-terra",
                "gpt-5.6-luna"
            ]
        );
    }

    #[test]
    fn unknown_provider_has_empty_list() {
        assert!(fixed_list("nope").is_empty());
    }

    // --- 선택 구조체 (AC-021) ---

    #[test]
    fn selection_for_provider_picks_routed_tool_entry() {
        let sel = ModelSelection {
            claude: Some("opus".to_string()),
            codex: Some("m-a".to_string()),
        };
        assert_eq!(sel.for_provider("claude"), Some("opus"));
        assert_eq!(sel.for_provider("codex"), Some("m-a"));
        assert_eq!(sel.for_provider("other"), None);
    }

    #[test]
    fn selection_deserializes_with_missing_keys_as_none() {
        let sel: ModelSelection = serde_json::from_str("{}").unwrap();
        assert_eq!(sel, ModelSelection::default());
        let sel: ModelSelection =
            serde_json::from_str(r#"{"claude":"opus","codex":null}"#).unwrap();
        assert_eq!(sel.claude.as_deref(), Some("opus"));
        assert_eq!(sel.codex, None);
    }

    #[test]
    fn model_option_serializes_id_and_label() {
        let json = serde_json::to_string(&ModelOption::new("opus", "Opus")).unwrap();
        assert_eq!(json, r#"{"id":"opus","label":"Opus"}"#);
    }

    // --- 검증 (AC-009) ---

    #[test]
    fn validate_claude_accepts_listed_alias_and_cli_default() {
        assert_eq!(validate("claude", Some("opus")), Ok(Some("opus".to_string())));
        assert_eq!(validate("claude", None), Ok(None));
        assert_eq!(validate("codex", None), Ok(None));
    }

    #[test]
    fn validate_claude_rejects_unknown_model_with_name_tool_and_guidance() {
        let msg = validate("claude", Some("gpt-x")).unwrap_err();
        assert!(msg.contains("gpt-x"), "{msg}");
        assert!(msg.contains("Claude"), "{msg}");
        assert!(msg.contains("설정 > AI"), "{msg}");
        assert!(!msg.contains("아직 확인하지 못했어요"), "{msg}");
    }

    #[test]
    fn validate_codex_rejects_flag_like_value() {
        let cat = CodexCatalog::new();
        let calls = counter();
        let msg = cat
            .validate("codex", Some("-c"), counting(&calls, None), SHORT)
            .unwrap_err();
        assert!(msg.contains("-c"), "{msg}");
        assert!(msg.contains("Codex"), "{msg}");
    }

    #[test]
    fn validate_codex_accepts_fixed_model_without_querying() {
        let cat = CodexCatalog::new();
        let calls = counter();
        let r = cat.validate("codex", Some("gpt-6-sol"), counting(&calls, None), SHORT);
        assert_eq!(r, Ok(Some("gpt-6-sol".to_string())));
        assert_eq!(calls_of(&calls), 0);
    }

    // --- 카탈로그 해석 (AC-013) ---

    #[test]
    fn parse_catalog_drops_hidden_sorts_by_priority_and_uses_display_name() {
        let list = parse_codex_catalog(FIXTURE).expect("fixture parses");
        assert_eq!(ids(&list), vec!["gpt-6.1-sol", "gpt-6-astra", "gpt-6.1-terra"]);
        let labels: Vec<&str> = list.iter().map(|o| o.label.as_str()).collect();
        assert_eq!(labels, vec!["GPT-6.1-Sol", "GPT-6-Astra", "GPT-6.1 Terra"]);
    }

    #[test]
    fn parse_catalog_returns_none_on_bad_or_empty_input() {
        assert_eq!(parse_codex_catalog("{}"), None);
        assert_eq!(parse_codex_catalog("not json"), None);
        assert_eq!(parse_codex_catalog(r#"{"models":[]}"#), None);
        let all_hidden =
            r#"{"models":[{"slug":"x","display_name":"X","visibility":"hide","priority":1}]}"#;
        assert_eq!(parse_codex_catalog(all_hidden), None);
    }

    // --- 시간 한도 조회 (AC-014) ---

    #[test]
    fn query_times_out_and_falls_back_to_fixed_list() {
        let start = Instant::now();
        let listing = query_with(
            |_| {
                thread::sleep(Duration::from_secs(1));
                Some(FIXTURE.to_string())
            },
            SHORT,
        );
        assert!(start.elapsed() < SHORT * 3, "한도의 3배 안에 돌아와야 한다: {:?}", start.elapsed());
        assert!(!listing.queried);
        assert_eq!(listing.options, fixed_list("codex"));
    }

    #[test]
    fn query_failure_and_unparsable_output_fall_back_to_fixed_list() {
        let failed = query_with(|_| None, SHORT);
        assert!(!failed.queried);
        assert_eq!(failed.options, fixed_list("codex"));
        let garbage = query_with(|_| Some("garbage".to_string()), SHORT);
        assert!(!garbage.queried);
        assert_eq!(garbage.options, fixed_list("codex"));
    }

    #[test]
    fn query_success_returns_parsed_catalog() {
        let listing = query_with(|_| Some(FIXTURE.to_string()), LONG);
        assert!(listing.queried);
        assert_eq!(ids(&listing.options), vec!["gpt-6.1-sol", "gpt-6-astra", "gpt-6.1-terra"]);
    }

    // --- 캐시 (AC-015) ---

    #[test]
    fn success_is_cached_and_reads_never_requery() {
        let cat = CodexCatalog::new();
        let calls = counter();
        let first = cat.list_for_status(&codex_status(true, true), counting(&calls, Some(CATALOG_M_A)), LONG);
        assert_eq!(ids(&first), vec!["m-a"]);
        for _ in 0..3 {
            assert_eq!(ids(&cat.list_for("codex")), vec!["m-a"]);
            assert!(cat.allowed("codex").contains(&"m-a".to_string()));
            // 감지 경로도 성공 결과는 다시 조회하지 않는다.
            cat.list_for_status(&codex_status(true, true), counting(&calls, Some(CATALOG_M_A)), LONG);
        }
        assert_eq!(calls_of(&calls), 1);
    }

    #[test]
    fn allowed_is_union_of_queried_and_fixed() {
        let cat = CodexCatalog::new();
        let calls = counter();
        cat.list_for_status(&codex_status(true, true), counting(&calls, Some(CATALOG_M_A)), LONG);
        let allowed = cat.allowed("codex");
        assert!(allowed.contains(&"m-a".to_string()));
        assert!(allowed.contains(&"gpt-6-sol".to_string()));
    }

    #[test]
    fn failure_is_reused_by_request_path_but_retried_by_detect_path() {
        let cat = CodexCatalog::new();
        let calls = counter();
        assert!(cat.validate("codex", Some("zz"), counting(&calls, None), LONG).is_err());
        assert!(cat.validate("codex", Some("zz"), counting(&calls, None), LONG).is_err());
        assert_eq!(calls_of(&calls), 1, "요청 검증은 실패 결과를 재사용한다");
        let list = cat.list_for_status(&codex_status(true, true), counting(&calls, None), LONG);
        assert_eq!(list, fixed_list("codex"));
        assert_eq!(calls_of(&calls), 2, "감지 경로는 다시 조회한다");
    }

    #[test]
    fn request_path_queries_only_when_needed() {
        // (a) claude, (b) codex + None, (c) codex + 고정 목록 모델 → 조회 0회.
        let cat = CodexCatalog::new();
        let calls = counter();
        let _ = cat.validate("claude", Some("opus"), counting(&calls, None), LONG);
        let _ = cat.validate("claude", Some("gpt-x"), counting(&calls, None), LONG);
        let _ = cat.validate("codex", None, counting(&calls, None), LONG);
        let _ = cat.validate("codex", Some("gpt-6-luna"), counting(&calls, None), LONG);
        assert_eq!(calls_of(&calls), 0);
        assert!(cat.is_empty());
        // 고정 목록에 없는 codex 모델 → 1회.
        let _ = cat.validate("codex", Some("m-a"), counting(&calls, Some(CATALOG_M_A)), LONG);
        assert_eq!(calls_of(&calls), 1);
    }

    #[test]
    fn queried_catalog_model_is_accepted_after_request_path_lookup() {
        let cat = CodexCatalog::new();
        let calls = counter();
        let r = cat.validate("codex", Some("m-a"), counting(&calls, Some(CATALOG_M_A)), LONG);
        assert_eq!(r, Ok(Some("m-a".to_string())));
    }

    #[test]
    fn in_flight_lookup_does_not_block_request_validation() {
        let cat = Arc::new(CodexCatalog::new());
        let calls = counter();
        let (release_tx, release_rx) = mpsc::channel::<()>();
        let worker = {
            let (cat, calls) = (cat.clone(), calls.clone());
            thread::spawn(move || {
                cat.validate(
                    "codex",
                    Some("m-x"),
                    move |_| {
                        calls.fetch_add(1, Ordering::SeqCst);
                        let _ = release_rx.recv();
                        None
                    },
                    LONG,
                )
            })
        };
        let deadline = Instant::now() + Duration::from_secs(3);
        while !(cat.is_in_flight() && calls_of(&calls) == 1) {
            assert!(Instant::now() < deadline, "조회가 시작되지 않았다");
            thread::sleep(Duration::from_millis(5));
        }

        let start = Instant::now();
        let msg = cat
            .validate("codex", Some("m-y"), counting(&calls, None), LONG)
            .unwrap_err();
        assert!(start.elapsed() < Duration::from_millis(100), "{:?}", start.elapsed());
        assert_eq!(calls_of(&calls), 1, "진행 중이면 새 조회를 시작하지 않는다");
        assert!(msg.contains("아직 확인하지 못했어요"), "{msg}");

        release_tx.send(()).unwrap();
        assert!(worker.join().unwrap().is_err());
        assert!(!cat.is_in_flight());
    }

    #[test]
    fn not_installed_or_not_logged_in_skips_query_and_keeps_cache_empty() {
        let cat = CodexCatalog::new();
        let calls = counter();
        for status in [codex_status(false, false), codex_status(true, false)] {
            let list = cat.list_for_status(&status, counting(&calls, Some(CATALOG_M_A)), LONG);
            assert_eq!(list, fixed_list("codex"));
        }
        assert_eq!(calls_of(&calls), 0);
        assert!(cat.is_empty());
        let list = cat.list_for_status(&codex_status(true, true), counting(&calls, Some(CATALOG_M_A)), LONG);
        assert_eq!(ids(&list), vec!["m-a"]);
        assert_eq!(calls_of(&calls), 1);
    }

    #[test]
    fn claude_status_is_listed_from_fixed_list_without_query() {
        let cat = CodexCatalog::new();
        let calls = counter();
        let status = ProviderStatus { id: "claude".to_string(), ..codex_status(true, true) };
        let list = cat.list_for_status(&status, counting(&calls, None), LONG);
        assert_eq!(list, fixed_list("claude"));
        assert_eq!(calls_of(&calls), 0);
    }

    #[test]
    fn unsettled_list_rejection_says_list_not_confirmed_settled_one_does_not() {
        // 조회 실패(미확정) → 목록 미확정 문구.
        let cat = CodexCatalog::new();
        let calls = counter();
        let msg = cat.validate("codex", Some("zz"), counting(&calls, None), LONG).unwrap_err();
        assert!(msg.contains("아직 확인하지 못했어요"), "{msg}");
        assert!(msg.contains("설정 > AI"), "{msg}");
        // 조회 성공(확정) → "쓸 수 없어요" 문구.
        let cat = CodexCatalog::new();
        let msg = cat
            .validate("codex", Some("zz"), counting(&calls, Some(CATALOG_M_A)), LONG)
            .unwrap_err();
        assert!(!msg.contains("아직 확인하지 못했어요"), "{msg}");
        assert!(msg.contains("zz") && msg.contains("Codex") && msg.contains("쓸 수 없어요"), "{msg}");
    }
}
