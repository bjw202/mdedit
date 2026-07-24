// @MX:NOTE: [AUTO] claude 설치·버전 감지 + 로그인 선제 판정(크로스플랫폼)
// @MX:NOTE: [AUTO] 두 신호에 의존한다 — (1) 설치: bare "claude"가 아니라 절대경로로 해석한다.
//   macOS GUI 앱의 PATH는 /usr/bin:/bin:/usr/sbin:/sbin뿐이라 ~/.local/bin/claude 등을 못 찾기 때문.
//   (2) 로그인: ~/.claude.json의 "oauthAccount" 키(Keychain 저장 시 .credentials.json이 없음) + 레거시 자격파일 폴백.
// @MX:SPEC: SPEC-AI-001

//! `claude --version` 성공 여부(installed)와 **로그인 선제 판정**(logged_in)을 담당한다(REQ-AI-012).
//!
//! 경로·판정 로직은 순수 함수로 분리해 macOS/Linux/Windows 각각을 단위 테스트한다.
//! 미로그인이면 프론트는 ✨를 "연결 필요"로 표시하므로(REQ-AI-015), 첫 클릭 실패를 예방한다.

use crate::ai::provider::ProviderStatus;
use crate::process_util::no_window;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::time::Duration;

/// 로그인 판정에 사용하는 후보 세션/자격 파일 이름(claude 설정 디렉토리 하위, 레거시 폴백).
const SESSION_FILE_CANDIDATES: &[&str] = &[".credentials.json", "credentials.json"];

/// detect 시 해석한 claude 절대경로 캐시. 성공한 해석만 캐시하고(미설치→재시도 허용) 스폰에서 재사용한다.
static CLAUDE_BINARY: OnceLock<PathBuf> = OnceLock::new();

/// `claude --version` 호출 인자.
pub fn claude_version_args() -> Vec<&'static str> {
    vec!["--version"]
}

/// `--version` 출력에서 버전 문자열을 추출한다.
///
/// 예: `"2.1.211 (Claude Code)"` → `Some("2.1.211")`, `"claude 2.1.211"` → `Some("2.1.211")`.
/// 숫자로 시작하고 `.`을 포함하는 첫 토큰을 버전으로 본다. 없으면 `None`.
pub fn parse_version_output(stdout: &str) -> Option<String> {
    stdout
        .split_whitespace()
        .map(|tok| tok.trim_matches(|c: char| c == '(' || c == ')' || c == 'v'))
        .find(|tok| {
            let mut chars = tok.chars();
            matches!(chars.next(), Some(c) if c.is_ascii_digit()) && tok.contains('.')
        })
        .map(|s| s.to_string())
}

/// claude 설정 디렉토리 경로(`<home>/.claude`). 플랫폼 무관 순수 로직.
pub fn claude_config_dir(home: &Path) -> PathBuf {
    home.join(".claude")
}

/// 홈 디렉토리를 환경값에서 해석한다(테스트 가능한 순수 함수).
///
/// Windows는 `%USERPROFILE%`, 그 외는 `$HOME`을 우선한다.
pub fn resolve_home_from(
    userprofile: Option<String>,
    home: Option<String>,
    is_windows: bool,
) -> Option<PathBuf> {
    if is_windows {
        userprofile.or(home).map(PathBuf::from)
    } else {
        home.or(userprofile).map(PathBuf::from)
    }
}

/// 실행 환경의 홈 디렉토리를 해석한다.
pub fn resolve_home() -> Option<PathBuf> {
    resolve_home_from(
        std::env::var("USERPROFILE").ok(),
        std::env::var("HOME").ok(),
        cfg!(target_os = "windows"),
    )
}

/// 설정 디렉토리에 로그인 세션 파일이 존재하는지(선제 판정 휴리스틱).
///
/// 파일이 없다고 반드시 미로그인은 아니다(macOS Keychain 등) — 이 경우 호출부가
/// 경량 프로브 1회로 보완한다(REQ-AI-012). 여기서는 파일 존재 여부만 순수 판정한다.
pub fn login_session_exists(config_dir: &Path) -> bool {
    SESSION_FILE_CANDIDATES
        .iter()
        .any(|name| config_dir.join(name).exists())
}

/// `~/.claude.json` 내용에 로그인 신호(`oauthAccount` 키)가 있는지 판정한다(순수).
///
/// JSON 파싱을 우선하고, 파싱 실패 시 부분 문자열 검사로 폴백한다(REQ-AI-012).
pub fn config_json_has_login(content: &str) -> bool {
    match serde_json::from_str::<serde_json::Value>(content) {
        Ok(value) => value.get("oauthAccount").is_some(),
        Err(_) => content.contains("oauthAccount"),
    }
}

/// 로그인 여부를 파일 신호로 판정한다(파일 읽기 포함).
///
/// (a) `~/.claude.json`의 `oauthAccount`(Keychain 저장 케이스 포함) 또는
/// (b) 레거시 자격 파일 존재. 둘 중 하나면 로그인으로 본다.
pub fn is_logged_in(home: &Path) -> bool {
    let claude_json = home.join(".claude.json");
    if let Ok(content) = std::fs::read_to_string(&claude_json) {
        if config_json_has_login(&content) {
            return true;
        }
    }
    login_session_exists(&claude_config_dir(home))
}

/// PATH 환경변수를 디렉토리 목록으로 분해한다(플랫폼 구분자, 순수).
pub fn split_path_var(path_var: &str, is_windows: bool) -> Vec<PathBuf> {
    let sep = if is_windows { ';' } else { ':' };
    path_var
        .split(sep)
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .collect()
}

/// claude 실행 파일 후보 경로를 우선순위 순으로 만든다(순수).
///
/// 순서: (1) PATH의 각 디렉토리 + 실행파일명(개발/터미널에서 동작),
/// (2) 플랫폼 표준 설치 위치(GUI 최소 PATH를 우회). nvm glob·로그인셸 프로브는 호출부에서 추가.
pub fn claude_binary_candidates(path_dirs: &[PathBuf], home: &Path, is_windows: bool) -> Vec<PathBuf> {
    let exe = if is_windows { "claude.exe" } else { "claude" };
    let mut candidates: Vec<PathBuf> = path_dirs.iter().map(|dir| dir.join(exe)).collect();

    if is_windows {
        candidates.push(home.join(".local").join("bin").join("claude.exe"));
        // %APPDATA%\npm\claude.cmd — APPDATA는 통상 <home>\AppData\Roaming.
        candidates.push(
            home.join("AppData")
                .join("Roaming")
                .join("npm")
                .join("claude.cmd"),
        );
    } else {
        candidates.push(home.join(".local").join("bin").join("claude"));
        candidates.push(PathBuf::from("/opt/homebrew/bin/claude"));
        candidates.push(PathBuf::from("/usr/local/bin/claude"));
    }
    candidates
}

/// 후보 중 처음으로 존재하는 경로를 고른다(순수, `exists` 주입으로 테스트 가능).
pub fn resolve_from_candidates(
    candidates: &[PathBuf],
    exists: impl Fn(&Path) -> bool,
) -> Option<PathBuf> {
    candidates.iter().find(|p| exists(p)).cloned()
}

/// nvm 노드 버전별 `~/.nvm/versions/node/*/bin/claude` 후보를 최신 버전 우선으로 만든다(fs 읽기 포함).
fn nvm_claude_candidates(home: &Path) -> Vec<PathBuf> {
    let versions_dir = home.join(".nvm").join("versions").join("node");
    let mut dirs: Vec<PathBuf> = match std::fs::read_dir(&versions_dir) {
        Ok(rd) => rd.filter_map(|e| e.ok().map(|e| e.path())).collect(),
        Err(_) => return Vec::new(),
    };
    // 최신 버전 우선(semver 근사: major.minor.patch 수치 비교).
    dirs.sort_by(|a, b| {
        let ka = a
            .file_name()
            .and_then(|n| n.to_str())
            .map(version_key)
            .unwrap_or_default();
        let kb = b
            .file_name()
            .and_then(|n| n.to_str())
            .map(version_key)
            .unwrap_or_default();
        kb.cmp(&ka)
    });
    dirs.into_iter()
        .map(|d| d.join("bin").join("claude"))
        .collect()
}

/// "v20.11.0" 같은 nvm 디렉토리명을 (major, minor, patch) 수치 키로 변환한다(순수).
fn version_key(name: &str) -> (u64, u64, u64) {
    let trimmed = name.trim_start_matches('v');
    let mut parts = trimmed.split('.').map(|s| s.parse::<u64>().unwrap_or(0));
    (
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    )
}

/// 로그인셸을 통해 claude 경로를 마지막 수단으로 탐색한다(비표준 설치도 포착).
// @MX:WARN: [AUTO] 로그인 셸($SHELL 또는 /bin/zsh)을 실행한다 - 임의 셸 실행 표면
// @MX:REASON: [AUTO] GUI 최소 PATH를 우회하기 위한 최후 수단. 인자는 고정("command -v claude"), 타임아웃으로 무한 대기 차단
fn login_shell_probe() -> Option<PathBuf> {
    if cfg!(target_os = "windows") {
        return None;
    }
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut child = Command::new(shell)
        .args(["-lc", "command -v claude"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null())
        .spawn()
        .ok()?;

    let mut stdout = child.stdout.take()?;
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut buf = String::new();
        let _ = stdout.read_to_string(&mut buf);
        let _ = tx.send(buf);
    });

    let output = rx.recv_timeout(Duration::from_secs(2));
    let _ = child.kill();
    let _ = child.wait();

    let path_str = output.ok()?.lines().next()?.trim().to_string();
    if path_str.is_empty() {
        return None;
    }
    let path = PathBuf::from(path_str);
    path.exists().then_some(path)
}

/// claude 실행 파일의 절대경로를 해석한다(PATH → 표준 위치 → nvm → 로그인셸 순).
pub fn resolve_claude_binary() -> Option<PathBuf> {
    let is_windows = cfg!(target_os = "windows");
    let path_dirs = split_path_var(&std::env::var("PATH").unwrap_or_default(), is_windows);
    let home = resolve_home();

    let mut candidates = match home {
        Some(ref h) => claude_binary_candidates(&path_dirs, h, is_windows),
        None => {
            let exe = if is_windows { "claude.exe" } else { "claude" };
            path_dirs.iter().map(|d| d.join(exe)).collect()
        }
    };
    if !is_windows {
        if let Some(ref h) = home {
            candidates.extend(nvm_claude_candidates(h));
        }
    }

    if let Some(found) = resolve_from_candidates(&candidates, |p| p.exists()) {
        return Some(found);
    }
    login_shell_probe()
}

/// 해석한 claude 절대경로를 반환한다(첫 성공을 캐시, 미설치면 다음 호출에서 재시도).
pub fn claude_binary() -> Option<PathBuf> {
    if let Some(cached) = CLAUDE_BINARY.get() {
        return Some(cached.clone());
    }
    let resolved = resolve_claude_binary()?;
    let _ = CLAUDE_BINARY.set(resolved.clone());
    Some(resolved)
}

/// claude 설치·버전·로그인을 감지한다.
// @MX:NOTE: [AUTO] Command 실행 부작용 포함 - 순수 로직(경로 후보·로그인 신호)은 위 함수로 분리해 테스트한다
pub fn detect_claude() -> ProviderStatus {
    // bare "claude"가 아니라 해석된 절대경로로 실행한다(GUI 최소 PATH 우회).
    let version = claude_binary().and_then(|bin| {
        let mut cmd = Command::new(&bin);
        // Windows에서 버전 프로브 때 콘솔 창이 깜빡이는 것을 막는다.
        no_window(&mut cmd)
            .args(claude_version_args())
            .output()
            .ok()
            .filter(|out| out.status.success())
            .and_then(|out| parse_version_output(&String::from_utf8_lossy(&out.stdout)))
    });

    let installed = version.is_some();

    let logged_in = installed
        && resolve_home()
            .map(|home| is_logged_in(&home))
            .unwrap_or(false);

    ProviderStatus {
        id: "claude".to_string(),
        installed,
        version,
        logged_in,
    }
}

// ============================================================================
// SPEC-AI-009 — codex CLI 감지 (REQ-AI9-015/016/017)
// ============================================================================
// @MX:NOTE: [AUTO] codex 경로 해석·로그인 판정은 claude detect 함수들과 대칭되는 순수 함수로 분리.
//   핵심 차이: (1) 표준 설치 위치 후보만 조회(nvm·로그인셸 프로브는 v1 제외, REQ-AI9-015 제외항),
//   (2) 로그인 판정을 ~/.codex/auth.json 단일 파일 존재로 단순화(claude 의 oauthAccount 보다 단순).
// @MX:SPEC: SPEC-AI-009

/// detect 시 해석한 codex 절대경로 캐시. claude_binary 와 대칭(claude_cli.rs/detect.rs 일관성).
static CODEX_BINARY: OnceLock<PathBuf> = OnceLock::new();

/// codex 실행 파일 후보 경로를 우선순위 순으로 만든다(순수, REQ-AI9-015).
///
/// 순서: (1) PATH의 각 디렉토리 + 실행파일명(`codex`/`codex.exe`),
/// (2) 플랫폼 표준 설치 위치 — macOS/Linux: `~/.local/bin/codex`, `/opt/homebrew/bin/codex`,
/// `/usr/local/bin/codex`; Windows: `~/.local/bin/codex.exe`, `%APPDATA%\npm\codex.cmd`.
/// nvm glob·로그인셸 프로브는 v1 제외(REQ-AI9-015 제외사항).
pub fn codex_binary_candidates(path_dirs: &[PathBuf], home: &Path, is_windows: bool) -> Vec<PathBuf> {
    let exe = if is_windows { "codex.exe" } else { "codex" };
    let mut candidates: Vec<PathBuf> = path_dirs.iter().map(|dir| dir.join(exe)).collect();

    if is_windows {
        candidates.push(home.join(".local").join("bin").join("codex.exe"));
        candidates.push(
            home.join("AppData")
                .join("Roaming")
                .join("npm")
                .join("codex.cmd"),
        );
    } else {
        candidates.push(home.join(".local").join("bin").join("codex"));
        candidates.push(PathBuf::from("/opt/homebrew/bin/codex"));
        candidates.push(PathBuf::from("/usr/local/bin/codex"));
    }
    candidates
}

/// codex 실행 파일의 절대경로를 해석한다(PATH → 표준 위치 순, REQ-AI9-015).
///
/// claude 의 `resolve_claude_binary` 와 달리 nvm 탐색·로그인셸 프로브를 하지 않는다(v1 제외).
/// 미설치 환경에서 `None`(panic 없음).
pub fn resolve_codex_binary() -> Option<PathBuf> {
    let is_windows = cfg!(target_os = "windows");
    let path_dirs = split_path_var(&std::env::var("PATH").unwrap_or_default(), is_windows);
    let home = resolve_home();

    let candidates = match home {
        Some(ref h) => codex_binary_candidates(&path_dirs, h, is_windows),
        None => {
            let exe = if is_windows { "codex.exe" } else { "codex" };
            path_dirs.iter().map(|d| d.join(exe)).collect()
        }
    };

    resolve_from_candidates(&candidates, |p| p.exists())
}

/// 해석한 codex 절대경로를 반환한다(첫 성공을 캐시, 미설치면 다음 호출에서 재시도).
/// `claude_binary`(detect.rs:251-258)와 대칭.
pub fn codex_binary() -> Option<PathBuf> {
    if let Some(cached) = CODEX_BINARY.get() {
        return Some(cached.clone());
    }
    let resolved = resolve_codex_binary()?;
    let _ = CODEX_BINARY.set(resolved.clone());
    Some(resolved)
}

/// `~/.codex/auth.json` 존재 여부로 codex 로그인을 판정한다(순수, REQ-AI9-016).
///
/// v1 휴리스틱: 파일이 있으면 로그인 됨, 없으면 미로그인. JSON 내용 파싱·토큰 만료 선제 판정은
/// 후속 SPEC(Design Notes 참조). claude 의 `is_logged_in`(detect.rs:99-107)과 대칭하되 단일 신호.
pub fn is_codex_logged_in(home: &Path) -> bool {
    home.join(".codex").join("auth.json").exists()
}

/// codex 설치·버전·로그인을 감지한다(REQ-AI9-017).
///
/// `codex --version` 이 성공하면 installed + 파싱된 version, 실패하면 installed=false + version=None.
/// 미설치 환경에서도 panic 없이 `id="codex"` 상태를 반환한다(`detect_claude` 와 동일 구조).
// @MX:NOTE: [AUTO] Command 실행 부작용 포함 - 순수 로직(경로 후보·로그인 판정)은 위 함수로 분리해 테스트한다
pub fn detect_codex() -> ProviderStatus {
    let version = codex_binary().and_then(|bin| {
        let mut cmd = Command::new(&bin);
        no_window(&mut cmd)
            .args(claude_version_args())
            .output()
            .ok()
            .filter(|out| out.status.success())
            .and_then(|out| parse_version_output(&String::from_utf8_lossy(&out.stdout)))
    });

    let installed = version.is_some();

    let logged_in = installed
        && resolve_home()
            .map(|home| is_codex_logged_in(&home))
            .unwrap_or(false);

    ProviderStatus {
        id: "codex".to_string(),
        installed,
        version,
        logged_in,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_args_are_version_flag() {
        assert_eq!(claude_version_args(), vec!["--version"]);
    }

    #[test]
    fn parses_version_with_suffix() {
        assert_eq!(
            parse_version_output("2.1.211 (Claude Code)"),
            Some("2.1.211".to_string())
        );
    }

    #[test]
    fn parses_version_with_prefix_word() {
        assert_eq!(
            parse_version_output("claude 2.1.211"),
            Some("2.1.211".to_string())
        );
    }

    #[test]
    fn parses_version_with_v_prefix() {
        assert_eq!(
            parse_version_output("v1.0.42"),
            Some("1.0.42".to_string())
        );
    }

    #[test]
    fn no_version_returns_none() {
        assert_eq!(parse_version_output("command not found"), None);
        assert_eq!(parse_version_output(""), None);
    }

    #[test]
    fn config_dir_appends_dot_claude() {
        let home = Path::new("/Users/jw");
        assert_eq!(claude_config_dir(home), PathBuf::from("/Users/jw/.claude"));
    }

    #[test]
    fn windows_home_prefers_userprofile() {
        let home = resolve_home_from(
            Some("C:/Users/jw".to_string()),
            Some("/home/jw".to_string()),
            true,
        );
        assert_eq!(home, Some(PathBuf::from("C:/Users/jw")));
    }

    #[test]
    fn windows_config_dir_path() {
        let home = resolve_home_from(Some("C:/Users/jw".to_string()), None, true).unwrap();
        assert_eq!(
            claude_config_dir(&home),
            PathBuf::from("C:/Users/jw/.claude")
        );
    }

    #[test]
    fn unix_home_prefers_home_var() {
        let home = resolve_home_from(
            Some("C:/Users/jw".to_string()),
            Some("/home/jw".to_string()),
            false,
        );
        assert_eq!(home, Some(PathBuf::from("/home/jw")));
    }

    #[test]
    fn resolve_home_falls_back_when_primary_missing() {
        // Windows인데 USERPROFILE이 없으면 HOME으로 폴백.
        assert_eq!(
            resolve_home_from(None, Some("/home/jw".to_string()), true),
            Some(PathBuf::from("/home/jw"))
        );
        // Unix인데 HOME이 없으면 USERPROFILE로 폴백.
        assert_eq!(
            resolve_home_from(Some("C:/Users/jw".to_string()), None, false),
            Some(PathBuf::from("C:/Users/jw"))
        );
    }

    #[test]
    fn resolve_home_none_when_both_missing() {
        assert_eq!(resolve_home_from(None, None, true), None);
        assert_eq!(resolve_home_from(None, None, false), None);
    }

    #[test]
    fn login_session_detected_when_credentials_file_present() {
        let dir = std::env::temp_dir().join(format!("mdedit_detect_test_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let cred = dir.join(".credentials.json");
        std::fs::write(&cred, "{}").unwrap();

        assert!(login_session_exists(&dir));

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn login_session_absent_when_no_credentials_file() {
        let dir = std::env::temp_dir().join(format!("mdedit_detect_empty_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();

        assert!(!login_session_exists(&dir));

        std::fs::remove_dir_all(&dir).ok();
    }

    // --- 로그인 신호: ~/.claude.json oauthAccount (Root cause 2) ---

    #[test]
    fn config_json_login_signal_detects_oauth_account() {
        let content = r#"{"oauthAccount":{"emailAddress":"jw@example.com"},"other":1}"#;
        assert!(config_json_has_login(content));
    }

    #[test]
    fn config_json_login_signal_absent_without_oauth_account() {
        let content = r#"{"projects":{},"theme":"dark"}"#;
        assert!(!config_json_has_login(content));
    }

    #[test]
    fn config_json_login_signal_substring_fallback_on_parse_failure() {
        // 손상된 JSON이라도 oauthAccount 문자열이 있으면 로그인으로 본다(폴백).
        let broken = "{ this is not valid json but has oauthAccount somewhere";
        assert!(config_json_has_login(broken));
        // 문자열도 없고 파싱도 실패 → false.
        assert!(!config_json_has_login("totally broken"));
    }

    #[test]
    fn config_json_login_signal_empty_is_false() {
        assert!(!config_json_has_login(""));
    }

    #[test]
    fn reproduces_keychain_login_via_oauth_account() {
        // 버그 재현(macOS Keychain): .credentials.json은 없고 ~/.claude.json에 oauthAccount만 존재.
        let home = std::env::temp_dir().join(format!("mdedit_keychain_{}", unique()));
        std::fs::create_dir_all(&home).unwrap();
        std::fs::write(
            home.join(".claude.json"),
            r#"{"oauthAccount":{"emailAddress":"jw@example.com"}}"#,
        )
        .unwrap();

        // 기존 신호(자격 파일)로는 미검출 — 이게 미로그인 오판의 원인이었다.
        assert!(!login_session_exists(&claude_config_dir(&home)));
        // 새 신호로는 로그인 검출.
        assert!(is_logged_in(&home));

        std::fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn is_logged_in_via_legacy_credentials_still_works() {
        let home = std::env::temp_dir().join(format!("mdedit_legacy_{}", unique()));
        let config = claude_config_dir(&home);
        std::fs::create_dir_all(&config).unwrap();
        std::fs::write(config.join(".credentials.json"), "{}").unwrap();

        assert!(is_logged_in(&home));

        std::fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn is_logged_in_false_when_no_signals() {
        let home = std::env::temp_dir().join(format!("mdedit_nologin_{}", unique()));
        std::fs::create_dir_all(&home).unwrap();

        assert!(!is_logged_in(&home));

        std::fs::remove_dir_all(&home).ok();
    }

    // --- 바이너리 경로 해석 (Root cause 1) ---

    #[test]
    fn split_path_var_unix() {
        assert_eq!(
            split_path_var("/usr/bin:/bin::/opt/x", false),
            vec![
                PathBuf::from("/usr/bin"),
                PathBuf::from("/bin"),
                PathBuf::from("/opt/x")
            ]
        );
    }

    #[test]
    fn split_path_var_windows() {
        assert_eq!(
            split_path_var("C:/a;C:/b;", true),
            vec![PathBuf::from("C:/a"), PathBuf::from("C:/b")]
        );
    }

    #[test]
    fn candidates_put_path_dirs_first_then_platform() {
        let home = Path::new("/Users/jw");
        let path_dirs = vec![PathBuf::from("/usr/bin"), PathBuf::from("/bin")];
        let candidates = claude_binary_candidates(&path_dirs, home, false);

        assert_eq!(candidates[0], PathBuf::from("/usr/bin/claude"));
        assert_eq!(candidates[1], PathBuf::from("/bin/claude"));
        // 표준 위치가 뒤따른다.
        assert!(candidates.contains(&PathBuf::from("/Users/jw/.local/bin/claude")));
        assert!(candidates.contains(&PathBuf::from("/opt/homebrew/bin/claude")));
        assert!(candidates.contains(&PathBuf::from("/usr/local/bin/claude")));
    }

    #[test]
    fn candidates_windows_use_exe_and_appdata() {
        let home = Path::new("C:/Users/jw");
        let path_dirs = vec![PathBuf::from("C:/Windows")];
        let candidates = claude_binary_candidates(&path_dirs, home, true);
        assert_eq!(candidates[0], PathBuf::from("C:/Windows/claude.exe"));
        assert!(candidates.contains(&PathBuf::from("C:/Users/jw/.local/bin/claude.exe")));
        assert!(candidates.contains(&PathBuf::from("C:/Users/jw/AppData/Roaming/npm/claude.cmd")));
    }

    #[test]
    fn resolve_from_candidates_short_circuits_on_first_hit() {
        let candidates = vec![
            PathBuf::from("/a/claude"),
            PathBuf::from("/b/claude"),
            PathBuf::from("/c/claude"),
        ];
        let found = resolve_from_candidates(&candidates, |p| p.starts_with("/b"));
        assert_eq!(found, Some(PathBuf::from("/b/claude")));
    }

    #[test]
    fn resolve_from_candidates_none_when_nothing_exists() {
        let candidates = vec![PathBuf::from("/a/claude")];
        assert_eq!(resolve_from_candidates(&candidates, |_| false), None);
    }

    #[test]
    fn reproduces_gui_path_finds_local_bin() {
        // 버그 재현(macOS GUI): PATH에는 claude가 없고 실제는 ~/.local/bin/claude.
        let home = std::env::temp_dir().join(format!("mdedit_guipath_{}", unique()));
        let local_bin = home.join(".local").join("bin");
        std::fs::create_dir_all(&local_bin).unwrap();
        let real = local_bin.join("claude");
        std::fs::write(&real, "#!/bin/sh\n").unwrap();

        // GUI 최소 PATH: claude가 들어있지 않다.
        let path_dirs = vec![PathBuf::from("/usr/bin"), PathBuf::from("/bin")];
        let candidates = claude_binary_candidates(&path_dirs, &home, false);
        let found = resolve_from_candidates(&candidates, |p| p.exists());

        assert_eq!(found, Some(real));

        std::fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn version_key_orders_semver_numerically() {
        // 문자열 정렬이면 v8 > v20 오판이 나지만, 수치 키는 v20 > v8.
        assert!(version_key("v20.11.0") > version_key("v8.19.4"));
        assert!(version_key("v20.11.0") > version_key("v20.9.0"));
        assert_eq!(version_key("v18.0.0"), (18, 0, 0));
    }

    /// 테스트용 고유 접미사(프로세스 id + 원자 카운터)로 임시 경로 충돌을 방지한다.
    fn unique() -> String {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        format!(
            "{}_{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::SeqCst)
        )
    }

    #[test]
    fn detect_claude_returns_claude_status_without_panic() {
        // claude 미설치 환경에서도 패닉 없이 id "claude"의 상태를 반환한다.
        let status = detect_claude();
        assert_eq!(status.id, "claude");
        // installed는 환경 의존이므로 값만 확인(불변 계약: 미설치면 미로그인).
        if !status.installed {
            assert!(!status.logged_in);
            assert!(status.version.is_none());
        }
    }

    // --- SPEC-AI-009 codex 감지 (REQ-AI9-015/016/017, AC-AI9-009/010) ---

    #[test]
    fn codex_candidates_put_path_dirs_first_then_platform_unix() {
        // macOS/Linux: PATH 후보 → ~/.local/bin/codex → /opt/homebrew/bin/codex → /usr/local/bin/codex
        let home = Path::new("/Users/jw");
        let path_dirs = vec![PathBuf::from("/usr/bin"), PathBuf::from("/bin")];
        let candidates = codex_binary_candidates(&path_dirs, home, false);

        assert_eq!(candidates[0], PathBuf::from("/usr/bin/codex"));
        assert_eq!(candidates[1], PathBuf::from("/bin/codex"));
        assert!(candidates.contains(&PathBuf::from("/Users/jw/.local/bin/codex")));
        assert!(candidates.contains(&PathBuf::from("/opt/homebrew/bin/codex")));
        assert!(candidates.contains(&PathBuf::from("/usr/local/bin/codex")));
    }

    #[test]
    fn codex_candidates_windows_use_exe_and_appdata() {
        // Windows: PATH 후보 → ~/.local/bin/codex.exe → %APPDATA%\npm\codex.cmd
        let home = Path::new("C:/Users/jw");
        let path_dirs = vec![PathBuf::from("C:/Windows")];
        let candidates = codex_binary_candidates(&path_dirs, home, true);
        assert_eq!(candidates[0], PathBuf::from("C:/Windows/codex.exe"));
        assert!(candidates.contains(&PathBuf::from("C:/Users/jw/.local/bin/codex.exe")));
        assert!(candidates.contains(&PathBuf::from(
            "C:/Users/jw/AppData/Roaming/npm/codex.cmd"
        )));
    }

    #[test]
    fn resolve_codex_binary_returns_none_without_panic_when_missing() {
        // 모든 후보가 존재하지 않으면 None(panic 없음). 실제 환경에서 codex 가 없으면 None.
        // 이 테스트는 환경에 codex 가 있어도 후보 생성·조회 자체가 panic 없음을 검증한다.
        let _ = resolve_codex_binary();
    }

    #[test]
    fn codex_binary_finds_local_bin_like_claude_pattern() {
        // claude 의 reproduces_gui_path_finds_local_bin(detect.rs:539)과 대칭.
        // 빈 PATH + ~/.local/bin/codex 가 있으면 해석 성공.
        let home = std::env::temp_dir().join(format!("mdedit_codex_guipath_{}", unique()));
        let local_bin = home.join(".local").join("bin");
        std::fs::create_dir_all(&local_bin).unwrap();
        let real = local_bin.join("codex");
        std::fs::write(&real, "#!/bin/sh\n").unwrap();

        let path_dirs: Vec<PathBuf> = vec![];
        let candidates = codex_binary_candidates(&path_dirs, &home, false);
        let found = resolve_from_candidates(&candidates, |p| p.exists());
        assert_eq!(found, Some(real));

        std::fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn is_codex_logged_in_true_when_auth_json_present() {
        let home = std::env::temp_dir().join(format!("mdedit_codex_auth_{}", unique()));
        let codex_dir = home.join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(codex_dir.join("auth.json"), "{}").unwrap();

        assert!(is_codex_logged_in(&home));

        std::fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn is_codex_logged_in_false_when_auth_json_absent() {
        let home = std::env::temp_dir().join(format!("mdedit_codex_noauth_{}", unique()));
        std::fs::create_dir_all(&home).unwrap();

        assert!(!is_codex_logged_in(&home));

        std::fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn is_codex_logged_in_false_in_empty_home_without_panic() {
        // .codex 디렉토리 자체가 없어도 panic 없이 false.
        let home = std::env::temp_dir().join(format!("mdedit_codex_empty_{}", unique()));
        std::fs::create_dir_all(&home).unwrap();
        assert!(!is_codex_logged_in(&home));
        std::fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn detect_codex_returns_codex_status_without_panic() {
        // REQ-AI9-017: 미설치 환경에서도 panic 없이 id="codex" 상태 반환.
        let status = detect_codex();
        assert_eq!(status.id, "codex");
        if !status.installed {
            assert!(!status.logged_in);
            assert!(status.version.is_none());
        }
    }
}
