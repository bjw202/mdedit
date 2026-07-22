// AI 모듈 — 로컬 claude CLI 스폰·스트리밍·감지·정책 (SPEC-AI-001 M0)
// @MX:NOTE: [AUTO] ai 관련 순수 로직(stream/prompt/detect)과 Tauri 커맨드를 이 모듈에서 노출한다

pub mod claude_cli;
pub mod detect;
pub mod prompt;
pub mod provider;
pub mod stream;

use crate::state::app_state::{AppState, InFlightRequest};
use claude_cli::{claim_terminal, ErrorPayload};
use prompt::{
    build_continue_prompt_with_length, build_inline_prompt_with_diagram_type, build_section_prompt,
    AiFeature, ContinueLength,
};
use provider::{AiModel, AiRequest, ProviderStatus};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub const AI_MODULE_NAME: &str = "ai";

// @MX:NOTE: [AUTO] WATCHDOG_TIMEOUT_SECS - 요청 하드 타임아웃 상수(SPEC-AI-006 REQ-AI6-004).
// 실측 typical_latency ~2.7초(claude_cli.rs Capabilities) 대비 p99 훨씬 상회로 잡아, 정당한
// 지연(사내 프록시 콜드스타트 등)은 죽이지 않으면서 무한 행(hang)만 차단한다. 대기 안내(항목 5,
// 프론트 8초 상수)는 이 값의 소프트 절반 짝이다.
// @MX:SPEC: SPEC-AI-006
/// 요청당 워치독 하드 타임아웃(초). 기본 60초.
pub const WATCHDOG_TIMEOUT_SECS: u64 = 60;

/// 조직 정책 파일 이름(앱 설정 디렉토리 하위). 존재하면 AI 강제 비활성(REQ-AI-017).
pub const POLICY_FILE_NAME: &str = "ai-policy-disabled";

/// 정책 kill-switch 판정(순수). 비활성 여부와 출처('env'|'policy-file')를 함께 반환한다.
/// 정책 파일이 우선하고, 없으면 env `MDEDIT_AI_DISABLED=1`(또는 true)로 판정한다(REQ-AI-017).
pub fn resolve_policy(
    env_val: Option<&str>,
    policy_file_exists: bool,
) -> (bool, Option<&'static str>) {
    if policy_file_exists {
        return (true, Some("policy-file"));
    }
    if matches!(env_val, Some("1") | Some("true")) {
        return (true, Some("env"));
    }
    (false, None)
}

/// 정책 비활성 여부만 필요할 때의 편의 함수(순수).
pub fn is_ai_disabled_by_policy(env_val: Option<&str>, policy_file_exists: bool) -> bool {
    resolve_policy(env_val, policy_file_exists).0
}

/// in-flight 교체 시 취소 통보 대상 id를 결정한다(순수). 기존 요청이 있으면 그 id를 통보한다(§3 P7).
pub fn in_flight_replacement_notice(current: Option<&str>) -> Option<String> {
    current.map(|s| s.to_string())
}

fn lock_err<E: std::fmt::Display>(e: E) -> String {
    format!("상태 잠금에 실패했어요: {}", e)
}

/// `ai_policy_status` 반환 — 정책 비활성 여부 + 출처. IPC 계약: `{ disabled, source? }`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicyStatus {
    pub disabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

/// `ai_cancel` 인자. IPC 계약: `{ requestId }`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCancelArgs {
    #[serde(default)]
    pub request_id: Option<String>,
}

/// 프론트에서 넘어오는 AI 요청 인자. 프롬프트는 Rust에서 조립하므로 텍스트 조각만 받는다(REQ-AI-003).
/// IPC 계약(camelCase): `{ requestId, feature, presetKind?, model, selection?, contextBefore?, contextAfter?, outline?, customInstruction? }`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRequestArgs {
    pub request_id: String,
    #[serde(default)]
    pub provider_id: Option<String>,
    /// 기능 종류. presetKind가 없으면 이 값으로 프리셋을 해석한다.
    pub feature: String,
    #[serde(default)]
    pub preset_kind: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub selection: Option<String>,
    #[serde(default)]
    pub context_before: Option<String>,
    #[serde(default)]
    pub context_after: Option<String>,
    #[serde(default)]
    pub outline: Option<String>,
    #[serde(default)]
    pub custom_instruction: Option<String>,
    /// SPEC-AI-006 REQ-AI6-012/013/014: 이어쓰기 길이 옵션('short'|'normal'). `Continue` 분기
    /// 에서만 반영되고 그 외 분기(인라인·섹션 채우기)는 무영향이다.
    #[serde(default)]
    pub length: Option<String>,
    // @MX:NOTE: [AUTO] SPEC-AI-008 REQ-009/010: AI 다이어그램 종류 제약. `#[serde(default)]` 로
    // 하위호환(자동=필드 생략=None). 공유 인라인 조립 호출에 전달되어 feature 가 Diagram 일 때만
    // 종류 조각을 부착한다(prompt.rs 게이팅). 비-diagram 분기에는 영향이 없다.
    // @MX:SPEC: SPEC-AI-008
    #[serde(default)]
    pub diagram_type: Option<String>,
}

/// AI 요청을 시작한다 — 정책 확인 → 프롬프트 조립 → in-flight 교체 → 스폰 → 릴레이(REQ-AI-002/004/006).
// @MX:ANCHOR: [AUTO] AI 요청 실행 커맨드 - 동시 1개 보장 및 스트리밍 릴레이 배선
// @MX:REASON: [AUTO] 프론트 유일 실행 진입점(fan_in >= 1)이며 in-flight 교체 불변식(동시 1개)을 강제한다
#[tauri::command]
pub fn ai_request(
    args: AiRequestArgs,
    state: tauri::State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    // 1. 정책 kill-switch 확인.
    if *state.ai_policy_disabled.lock().map_err(lock_err)? {
        return Err("AI 기능이 조직 정책으로 비활성화되어 있어요.".to_string());
    }

    // 2. 기능 해석 — (feature, presetKind) → 내부 템플릿(잘못된 조합은 오류).
    let feature = AiFeature::resolve(
        &args.feature,
        args.preset_kind.as_deref(),
        args.custom_instruction.as_deref(),
    )?;

    // 3. 프롬프트 조립(Rust). 섹션 채우기의 "직전 본문 꼬리"는 contextBefore를 사용한다(§5.1).
    let selection = args.selection.as_deref().unwrap_or("");
    let before = args.context_before.as_deref().unwrap_or("");
    let after = args.context_after.as_deref().unwrap_or("");
    let outline = args.outline.as_deref().unwrap_or("");
    let assembled = match feature {
        AiFeature::FillSection => build_section_prompt(outline, before),
        // 이어쓰기(문서 끝 분기, REQ-AI-028 + 자유 위치 M2, SPEC-AI-003 + 길이 옵션 SPEC-AI-006):
        // outline+before(+after) 조립, after 는 빈 문자열이면 [뒤 문맥] 섹션이 생략되어 기존
        // 문서 끝 프롬프트와 동일하다. length 는 이 분기에서만 반영된다(REQ-AI6-014).
        AiFeature::Continue => {
            let length = match args.length.as_deref() {
                Some("short") => ContinueLength::Short,
                _ => ContinueLength::Normal,
            };
            build_continue_prompt_with_length(outline, before, after, length)
        }
        // SPEC-AI-008: 공유 인라인 조립 경로에 diagram_type 을 전달한다. 조각 부착은
        // build_inline_prompt_with_diagram_type 내부에서 feature 가 Diagram 일 때만 일어난다.
        _ => build_inline_prompt_with_diagram_type(
            &feature,
            selection,
            before,
            after,
            args.diagram_type.as_deref(),
        ),
    };
    let truncated = assembled.truncated;

    // 4. 모델 결정(기본 haiku).
    let model = AiModel::from_opt(args.model.as_deref());

    // 5. 프로바이더 라우팅(trait 경유).
    let registry = claude_cli::claude_registry();
    let provider = registry
        .route(args.provider_id.as_deref())
        .ok_or_else(|| "사용 가능한 AI 도구가 없어요.".to_string())?;

    // 6. 빈 스크래치 cwd 준비(문서·프로젝트 폴더 격리).
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("앱 데이터 폴더를 찾지 못했어요: {}", e))?;
    let cwd = claude_cli::ensure_scratch_dir(&app_data_dir)?;

    // 7. 기존 in-flight 자동 취소·교체 — 옛 요청에 취소 통보(무통보 취소 금지, §3 P7).
    //    IPC 계약: ai://error{ kind:'other', cancelledBy:'new-request' } for the OLD requestId.
    {
        let mut slot = state.in_flight.lock().map_err(lock_err)?;
        if let Some(prev) = slot.take() {
            if let Some(id) = in_flight_replacement_notice(Some(&prev.request_id)) {
                prev.cancel_flag.store(true, Ordering::SeqCst);
                // SPEC-AI-006 REQ-AI6-006/N1: kill 이전에 claim해야 한다 — kill이 유발하는
                // 릴레이 EOF→Silent 경로가 먼저 claim을 가로채 터미널 0건(스켈레톤 영구 대기)이
                // 되는 경합을 방지한다.
                let claimed = claim_terminal(&prev.finished);
                let mut child = prev.child;
                let _ = child.kill();
                if claimed {
                    let _ = app_handle.emit(
                        "ai://error",
                        ErrorPayload {
                            request_id: id,
                            kind: "other".to_string(),
                            message: "새 요청으로 취소되었어요.".to_string(),
                            cancelled_by: Some("new-request".to_string()),
                        },
                    );
                }
            }
        }
    }

    // 8. 요청 조립 + trait 경유 스폰.
    let request = AiRequest {
        model,
        system_prompt: assembled.system_prompt,
        user_prompt: assembled.user_prompt,
    };
    let mut child = provider.spawn(&request, &cwd)?;

    // 9. stdout/stderr 릴레이 스레드 기동.
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "출력 스트림을 열지 못했어요.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "오류 스트림을 열지 못했어요.".to_string())?;
    let cancel_flag = Arc::new(AtomicBool::new(false));
    // SPEC-AI-006 REQ-AI6-004/006: 요청별 공유 단일발행 선점 플래그 — 릴레이·워치독·
    // ai_cancel·신규 요청 교체 네 지점이 발행 전 이 플래그를 claim한다.
    let finished = Arc::new(AtomicBool::new(false));
    claude_cli::relay_process(
        app_handle.clone(),
        args.request_id.clone(),
        stdout,
        stderr,
        cancel_flag.clone(),
        truncated,
        finished.clone(),
    );

    // 10. in-flight 저장(동시 1개).
    {
        let mut slot = state.in_flight.lock().map_err(lock_err)?;
        *slot = Some(InFlightRequest {
            request_id: args.request_id.clone(),
            child,
            cancel_flag,
            finished: finished.clone(),
        });
    }

    // 11. 요청당 워치독 스레드(하드 타임아웃, REQ-AI6-004) — claim 성공 시에만 자식 kill +
    // in-flight 정리 + `ai://error{kind:"timeout"}` 발행. 정상완료/취소/교체가 먼저 claim했으면
    // 여기서는 조용히 무발행(REQ-AI6-006).
    {
        let watchdog_app_handle = app_handle.clone();
        let watchdog_request_id = args.request_id;
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(WATCHDOG_TIMEOUT_SECS));
            if !claim_terminal(&finished) {
                return;
            }
            if let Some(app_state) = watchdog_app_handle.try_state::<AppState>() {
                if let Ok(mut slot) = app_state.in_flight.lock() {
                    let matches_this_request =
                        slot.as_ref().is_some_and(|cur| cur.request_id == watchdog_request_id);
                    if matches_this_request {
                        if let Some(prev) = slot.take() {
                            let mut child = prev.child;
                            let _ = child.kill();
                        }
                    }
                }
            }
            let _ = watchdog_app_handle.emit(
                "ai://error",
                ErrorPayload {
                    request_id: watchdog_request_id,
                    kind: "timeout".to_string(),
                    message: claude_cli::friendly_error_message("timeout"),
                    cancelled_by: None,
                },
            );
        });
    }

    Ok(())
}

/// 진행 중 AI 요청을 취소한다 — 프로세스 kill + 상태 정리 + 취소 통보(REQ-AI-005, §3 P7).
/// IPC 계약: ai://error{ kind:'other', cancelledBy:'user' } for the cancelled requestId.
#[tauri::command]
pub fn ai_cancel(
    args: AiCancelArgs,
    state: tauri::State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let _ = &args; // requestId는 정보성 — 동시 1개 모델이므로 현재 in-flight를 취소한다.
    let mut slot = state.in_flight.lock().map_err(lock_err)?;
    if let Some(prev) = slot.take() {
        prev.cancel_flag.store(true, Ordering::SeqCst);
        let request_id = prev.request_id.clone();
        // SPEC-AI-006 REQ-AI6-006/N1: kill 이전에 claim해야 한다 — kill이 유발하는 릴레이
        // EOF→Silent 경로가 먼저 claim을 가로채 터미널 0건이 되는 경합을 방지한다.
        let claimed = claim_terminal(&prev.finished);
        let mut child = prev.child;
        let _ = child.kill();
        if claimed {
            let _ = app_handle.emit(
                "ai://error",
                ErrorPayload {
                    request_id,
                    kind: "other".to_string(),
                    message: "요청을 취소했어요.".to_string(),
                    cancelled_by: Some("user".to_string()),
                },
            );
        }
    }
    Ok(())
}

/// 등록된 프로바이더의 설치·버전·로그인 상태를 감지한다(REQ-AI-012).
#[tauri::command]
pub fn ai_detect_providers() -> Result<Vec<ProviderStatus>, String> {
    Ok(claude_cli::claude_registry().detect_all())
}

/// 정책 kill-switch 상태를 반환한다(REQ-AI-017). 값은 setup에서 1회 프로브해 저장됨.
#[tauri::command]
pub fn ai_policy_status(state: tauri::State<'_, AppState>) -> Result<PolicyStatus, String> {
    let disabled = *state.ai_policy_disabled.lock().map_err(lock_err)?;
    let source = state.ai_policy_source.lock().map_err(lock_err)?.clone();
    Ok(PolicyStatus { disabled, source })
}

/// setup에서 호출: env + 정책 파일을 프로브해 정책 비활성 여부와 출처를 계산한다.
pub fn probe_policy(app_handle: &AppHandle) -> (bool, Option<String>) {
    let env_val = std::env::var("MDEDIT_AI_DISABLED").ok();
    let policy_file_exists = app_handle
        .path()
        .app_config_dir()
        .map(|dir| dir.join(POLICY_FILE_NAME).exists())
        .unwrap_or(false);
    let (disabled, source) = resolve_policy(env_val.as_deref(), policy_file_exists);
    (disabled, source.map(|s| s.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ai_module_name() {
        assert_eq!(AI_MODULE_NAME, "ai");
    }

    #[test]
    fn policy_disabled_by_env_flag() {
        assert_eq!(resolve_policy(Some("1"), false), (true, Some("env")));
        assert_eq!(resolve_policy(Some("true"), false), (true, Some("env")));
        assert!(is_ai_disabled_by_policy(Some("1"), false));
    }

    #[test]
    fn policy_disabled_by_policy_file_takes_precedence() {
        // 정책 파일이 있으면 env와 무관하게 비활성이며 출처는 policy-file.
        assert_eq!(resolve_policy(None, true), (true, Some("policy-file")));
        assert_eq!(resolve_policy(Some("0"), true), (true, Some("policy-file")));
    }

    #[test]
    fn policy_enabled_by_default_has_no_source() {
        assert_eq!(resolve_policy(None, false), (false, None));
        assert_eq!(resolve_policy(Some("0"), false), (false, None));
        assert_eq!(resolve_policy(Some(""), false), (false, None));
    }

    #[test]
    fn replacement_notice_returns_previous_id() {
        // in-flight가 있으면 그 id를 취소 통보 대상으로 반환(무통보 취소 금지).
        assert_eq!(
            in_flight_replacement_notice(Some("req-1")),
            Some("req-1".to_string())
        );
    }

    #[test]
    fn replacement_notice_none_when_no_in_flight() {
        assert_eq!(in_flight_replacement_notice(None), None);
    }

    #[test]
    fn request_args_deserialize_camel_case_minimal() {
        // 프론트가 최소 필드만 camelCase로 보내도 파싱된다(옵션·기본값).
        let json = r#"{"requestId":"r1","feature":"polish","selection":"안녕"}"#;
        let args: AiRequestArgs = serde_json::from_str(json).expect("deserialize");
        assert_eq!(args.request_id, "r1");
        assert_eq!(args.feature, "polish");
        assert_eq!(args.selection.as_deref(), Some("안녕"));
        assert!(args.model.is_none());
        assert!(args.context_before.is_none());
        assert!(args.preset_kind.is_none());
        assert!(args.length.is_none());
    }

    // --- SPEC-AI-006 항목 4: 이어쓰기 길이 옵션 IPC 필드 (REQ-AI6-012/013/014) ---

    #[test]
    fn request_args_deserialize_length_field_for_continue() {
        let json = r#"{
            "requestId":"cw-3","feature":"section-fill","presetKind":"continue","model":"haiku",
            "outline":"개요","contextBefore":"본문","length":"short"
        }"#;
        let args: AiRequestArgs = serde_json::from_str(json).expect("deserialize");
        assert_eq!(args.length.as_deref(), Some("short"));
        assert_eq!(
            AiFeature::resolve(&args.feature, args.preset_kind.as_deref(), None),
            Ok(AiFeature::Continue)
        );
    }

    #[test]
    fn request_args_length_absent_defaults_to_none() {
        let json = r#"{"requestId":"r1","feature":"polish","selection":"안녕"}"#;
        let args: AiRequestArgs = serde_json::from_str(json).expect("deserialize");
        assert!(args.length.is_none());
    }

    // --- SPEC-AI-008: 다이어그램 종류(diagramType) IPC 필드 (REQ-009/010, AC-005/006) ---

    #[test]
    fn request_args_deserialize_diagram_type_camel_case() {
        // 종류를 실은 다이어그램 요청: camelCase diagramType → snake_case diagram_type.
        let json = r#"{
            "requestId":"d1","feature":"diagram","presetKind":"diagram","model":"haiku",
            "selection":"절차 설명","diagramType":"gantt"
        }"#;
        let args: AiRequestArgs = serde_json::from_str(json).expect("deserialize");
        assert_eq!(args.diagram_type.as_deref(), Some("gantt"));
        assert_eq!(
            AiFeature::resolve(&args.feature, args.preset_kind.as_deref(), None),
            Ok(AiFeature::Diagram)
        );
    }

    #[test]
    fn request_args_diagram_type_absent_defaults_to_none() {
        // 자동(종류 없음)·비-diagram 요청은 필드 생략 → None(하위호환).
        let json = r#"{"requestId":"r1","feature":"polish","selection":"안녕"}"#;
        let args: AiRequestArgs = serde_json::from_str(json).expect("deserialize");
        assert!(args.diagram_type.is_none());
    }

    #[test]
    fn request_args_deserialize_full_contract() {
        // 계약 전체 필드(camelCase) 파싱 확인.
        let json = r#"{
            "requestId":"r2","feature":"inline-edit","presetKind":"diagram","model":"sonnet",
            "selection":"절차","contextBefore":"앞","contextAfter":"뒤","customInstruction":"영어로"
        }"#;
        let args: AiRequestArgs = serde_json::from_str(json).expect("deserialize");
        assert_eq!(args.feature, "inline-edit");
        assert_eq!(args.preset_kind.as_deref(), Some("diagram"));
        assert_eq!(args.model.as_deref(), Some("sonnet"));
        assert_eq!(args.context_before.as_deref(), Some("앞"));
        assert_eq!(args.context_after.as_deref(), Some("뒤"));
        assert_eq!(args.custom_instruction.as_deref(), Some("영어로"));
    }

    #[test]
    fn request_args_deserialize_continue_preset_kind() {
        // Gap 2(REQ-AI-028 문서 끝 분기): feature="section-fill" + presetKind="continue"로 도착해도
        // 하위호환으로 기존 필드(outline/contextBefore)와 함께 파싱된다.
        let json = r#"{
            "requestId":"cw-1","feature":"section-fill","presetKind":"continue","model":"haiku",
            "outline":"개요","contextBefore":"직전 본문"
        }"#;
        let args: AiRequestArgs = serde_json::from_str(json).expect("deserialize");
        assert_eq!(args.feature, "section-fill");
        assert_eq!(args.preset_kind.as_deref(), Some("continue"));
        assert_eq!(
            AiFeature::resolve(&args.feature, args.preset_kind.as_deref(), None),
            Ok(AiFeature::Continue)
        );
    }

    #[test]
    fn request_args_deserialize_continue_with_context_after() {
        // SPEC-AI-003(M2): 자유 위치 이어쓰기는 기존 contextAfter 필드에 커서 뒤 원문을 실어
        // 보낸다(신규 필드 아님, IPC 하위호환). continue presetKind 와 함께 파싱된다.
        let json = r#"{
            "requestId":"cw-2","feature":"section-fill","presetKind":"continue","model":"haiku",
            "outline":"개요","contextBefore":"앞 문맥","contextAfter":"뒤 문맥"
        }"#;
        let args: AiRequestArgs = serde_json::from_str(json).expect("deserialize");
        assert_eq!(args.context_after.as_deref(), Some("뒤 문맥"));
        assert_eq!(
            AiFeature::resolve(&args.feature, args.preset_kind.as_deref(), None),
            Ok(AiFeature::Continue)
        );
    }

    #[test]
    fn cancel_args_deserialize_camel_case() {
        let args: AiCancelArgs =
            serde_json::from_str(r#"{"requestId":"r1"}"#).expect("deserialize");
        assert_eq!(args.request_id.as_deref(), Some("r1"));
    }

    // Tauri 커맨드 `fn ai_request(args: AiRequestArgs, ...)` 는 invoke 페이로드에서 파라미터
    // 이름 `args` 키를 찾아 역직렬화한다. 이 Envelope 는 그 디스패치 경계를 모델링한다 —
    // 프론트가 필드를 최상위로 펼치면(구 버그) `args` 가 없어 커맨드 본문 실행 전에 거부되고,
    // 반드시 { args: {...} } 로 감싸야 통과한다. 프론트 IPC 페이로드 형태의 회귀 가드.
    #[test]
    fn ai_request_ipc_payload_must_nest_under_args_param_name() {
        #[derive(Deserialize)]
        struct Envelope {
            #[allow(dead_code)]
            args: AiRequestArgs,
        }

        let inner = serde_json::json!({
            "requestId": "r1", "feature": "inline-edit", "presetKind": "outline",
            "model": "haiku", "selection": "문단1\n\n문단2", "contextBefore": "", "contextAfter": ""
        });

        // 최상위로 펼친 페이로드(구 프론트) → `args` 키 없음 → 디스패치 실패(조용한 거부의 원인).
        assert!(serde_json::from_value::<Envelope>(inner.clone()).is_err());

        // `args` 로 감싼 페이로드(수정 후) → 통과.
        let wrapped = serde_json::json!({ "args": inner });
        let env: Envelope = serde_json::from_value(wrapped).expect("nested payload deserializes");
        assert_eq!(env.args.request_id, "r1");
        assert_eq!(env.args.preset_kind.as_deref(), Some("outline"));
    }

    #[test]
    fn policy_status_serializes_camel_case_with_source() {
        let json = serde_json::to_string(&PolicyStatus {
            disabled: true,
            source: Some("env".to_string()),
        })
        .unwrap();
        assert!(json.contains("\"disabled\":true"));
        assert!(json.contains("\"source\":\"env\""));
    }

    #[test]
    fn policy_status_omits_absent_source() {
        let json = serde_json::to_string(&PolicyStatus {
            disabled: false,
            source: None,
        })
        .unwrap();
        assert!(!json.contains("source"));
    }
}
