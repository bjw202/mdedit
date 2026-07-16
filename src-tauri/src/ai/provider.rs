// @MX:ANCHOR: [AUTO] AiProvider trait + 레지스트리 - AI 요청 라우팅 계약
// @MX:REASON: [AUTO] 모든 AI 요청이 이 trait을 경유(fan_in >= 2: mod 커맨드 + claude 어댑터), M4 codex 확장 지점
// @MX:SPEC: SPEC-AI-001

//! AI 프로바이더 추상화. MVP는 claude 어댑터 단독이지만, M4 codex 도입 시
//! 어댑터만 추가하면 되도록 trait 계약(`capabilities()` 포함)을 지금 확정한다(REQ-AI-001).

use serde::Serialize;
use std::path::Path;
use std::process::Child;

/// 사용 모델. 기본 haiku(속도·비용), 옵션 sonnet(정확도) — REQ-AI-016.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AiModel {
    Haiku,
    Sonnet,
}

impl AiModel {
    /// `--model` 인자로 넘길 문자열.
    pub fn as_arg(&self) -> &'static str {
        match self {
            AiModel::Haiku => "haiku",
            AiModel::Sonnet => "sonnet",
        }
    }

    /// 프론트에서 전달된 문자열을 모델로 해석한다. 미지정·미상은 haiku 기본.
    pub fn from_opt(raw: Option<&str>) -> AiModel {
        match raw {
            Some("sonnet") => AiModel::Sonnet,
            _ => AiModel::Haiku,
        }
    }
}

/// 프로바이더에 넘기는 조립 완료된 요청. 프롬프트는 Rust(prompt.rs)에서 조립된다(REQ-AI-003).
#[derive(Debug, Clone)]
pub struct AiRequest {
    pub model: AiModel,
    pub system_prompt: String,
    pub user_prompt: String,
}

/// 감지 결과 — 설치·버전·로그인 상태. 프론트 payload로 직렬화된다(REQ-AI-012).
/// IPC 계약: `{ id, installed, version?, loggedIn }` (camelCase).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub id: String,
    pub installed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub logged_in: bool,
}

/// 프로바이더 능력 — M4 codex의 무스트리밍 분기를 위한 계약(REQ-AI-001).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Capabilities {
    pub supports_streaming: bool,
    pub typical_latency_ms: u64,
}

/// AI 프로바이더 어댑터 계약.
pub trait AiProvider: Send + Sync {
    /// 안정 식별자("claude", M4: "codex").
    fn id(&self) -> &str;
    /// 설치·버전·로그인 선제 판정.
    fn detect(&self) -> ProviderStatus;
    /// CLI 프로세스를 스폰한다(emit·릴레이는 호출부 담당). 실패 시 사용자 안전 메시지.
    fn spawn(&self, request: &AiRequest, cwd: &Path) -> Result<Child, String>;
    /// 스트리밍 지원·전형 지연 등 능력.
    fn capabilities(&self) -> Capabilities;
}

/// 등록된 프로바이더 레지스트리. MVP는 claude 단독(`claude_registry()`, claude_cli.rs).
pub struct ProviderRegistry {
    providers: Vec<Box<dyn AiProvider>>,
}

impl ProviderRegistry {
    /// 주어진 프로바이더들로 레지스트리를 구성한다.
    pub fn with_providers(providers: Vec<Box<dyn AiProvider>>) -> Self {
        Self { providers }
    }

    /// 등록된 프로바이더 id 목록(등록 순서).
    pub fn ids(&self) -> Vec<&str> {
        self.providers.iter().map(|p| p.id()).collect()
    }

    /// 등록 개수.
    pub fn len(&self) -> usize {
        self.providers.len()
    }

    /// 비었는지 여부.
    pub fn is_empty(&self) -> bool {
        self.providers.is_empty()
    }

    /// id로 프로바이더를 찾는다.
    pub fn get(&self, id: &str) -> Option<&dyn AiProvider> {
        self.providers
            .iter()
            .find(|p| p.id() == id)
            .map(|p| p.as_ref())
    }

    /// 기본 프로바이더(첫 등록). MVP에서는 claude.
    pub fn default_provider(&self) -> Option<&dyn AiProvider> {
        self.providers.first().map(|p| p.as_ref())
    }

    /// 등록된 모든 프로바이더를 감지해 상태 목록을 반환한다.
    pub fn detect_all(&self) -> Vec<ProviderStatus> {
        self.providers.iter().map(|p| p.detect()).collect()
    }

    /// provider_id 미지정 시 기본, 지정 시 해당 프로바이더로 라우팅한다.
    pub fn route(&self, provider_id: Option<&str>) -> Option<&dyn AiProvider> {
        match provider_id {
            Some(id) => self.get(id),
            None => self.default_provider(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 레지스트리 메커니즘 검증용 테스트 더블(실제 스폰 없음).
    struct MockProvider {
        id: &'static str,
    }

    impl AiProvider for MockProvider {
        fn id(&self) -> &str {
            self.id
        }
        fn detect(&self) -> ProviderStatus {
            ProviderStatus {
                id: self.id.to_string(),
                installed: true,
                version: Some("1.0.0".to_string()),
                logged_in: true,
            }
        }
        fn spawn(&self, _request: &AiRequest, _cwd: &Path) -> Result<Child, String> {
            Err("mock does not spawn".to_string())
        }
        fn capabilities(&self) -> Capabilities {
            Capabilities {
                supports_streaming: true,
                typical_latency_ms: 100,
            }
        }
    }

    #[test]
    fn model_arg_mapping() {
        assert_eq!(AiModel::Haiku.as_arg(), "haiku");
        assert_eq!(AiModel::Sonnet.as_arg(), "sonnet");
    }

    #[test]
    fn model_from_opt_defaults_to_haiku() {
        assert_eq!(AiModel::from_opt(None), AiModel::Haiku);
        assert_eq!(AiModel::from_opt(Some("haiku")), AiModel::Haiku);
        assert_eq!(AiModel::from_opt(Some("unknown")), AiModel::Haiku);
        assert_eq!(AiModel::from_opt(Some("sonnet")), AiModel::Sonnet);
    }

    #[test]
    fn registry_enumerates_registered_ids() {
        let registry =
            ProviderRegistry::with_providers(vec![Box::new(MockProvider { id: "claude" })]);
        assert_eq!(registry.len(), 1);
        assert_eq!(registry.ids(), vec!["claude"]);
        assert!(!registry.is_empty());
    }

    #[test]
    fn registry_get_by_id() {
        let registry =
            ProviderRegistry::with_providers(vec![Box::new(MockProvider { id: "claude" })]);
        assert!(registry.get("claude").is_some());
        assert!(registry.get("codex").is_none());
        assert_eq!(registry.get("claude").unwrap().id(), "claude");
    }

    #[test]
    fn route_uses_default_when_unspecified() {
        let registry =
            ProviderRegistry::with_providers(vec![Box::new(MockProvider { id: "claude" })]);
        let routed = registry.route(None).expect("default provider");
        assert_eq!(routed.id(), "claude");
    }

    #[test]
    fn route_uses_named_provider_when_specified() {
        let registry =
            ProviderRegistry::with_providers(vec![Box::new(MockProvider { id: "claude" })]);
        assert_eq!(registry.route(Some("claude")).unwrap().id(), "claude");
        assert!(registry.route(Some("codex")).is_none());
    }

    #[test]
    fn request_carries_assembled_prompt() {
        // 프롬프트는 Rust에서 조립되어 요청에 담긴다(REQ-AI-003).
        let req = AiRequest {
            model: AiModel::Haiku,
            system_prompt: "결과 텍스트만 출력".to_string(),
            user_prompt: "다듬어줘".to_string(),
        };
        assert_eq!(req.model, AiModel::Haiku);
        assert!(req.system_prompt.contains("결과"));
    }

    #[test]
    fn capabilities_expose_streaming_contract() {
        let provider = MockProvider { id: "claude" };
        let caps = provider.capabilities();
        assert!(caps.supports_streaming);
    }

    #[test]
    fn provider_status_serializes_camel_case() {
        // IPC 계약: { id, installed, version?, loggedIn }
        let status = ProviderStatus {
            id: "claude".to_string(),
            installed: true,
            version: Some("2.1.211".to_string()),
            logged_in: false,
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"loggedIn\":false"));
        assert!(json.contains("\"id\":\"claude\""));
        assert!(!json.contains("logged_in"));
    }

    #[test]
    fn provider_status_omits_absent_version() {
        let status = ProviderStatus {
            id: "claude".to_string(),
            installed: false,
            version: None,
            logged_in: false,
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(!json.contains("version"));
    }
}
