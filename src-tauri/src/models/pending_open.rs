// @MX:NOTE: [AUTO] 외부 오픈(.md 더블클릭) 대기 페이로드 — AppState 슬롯 저장 후 프론트 take로 소비
// @MX:SPEC: SPEC-FS-004

/// 외부 오픈 대기 페이로드. OS 진입 경로(런치 argv / single-instance / macOS Opened)에서
/// 계산되어 AppState.pending_open_file 슬롯에 저장되고, 프론트의 `take_pending_open_file`
/// 커맨드로 정확히 1회 드레인된다(atomic-take, REQ-FS-004-011).
#[derive(Debug, Clone, serde::Serialize, PartialEq)]
pub struct PendingOpenFile {
    /// 열 대상 .md 파일의 절대 경로(원본 구분자 보존 — canonicalize 금지, REQ-FS-004-013).
    pub path: String,
    /// path의 부모 폴더(Path::parent() 계산). 프론트 openFolderPath의 인자가 된다.
    pub dir: String,
}

impl PendingOpenFile {
    /// 새 페이로드를 생성한다.
    pub fn new(path: String, dir: String) -> Self {
        Self { path, dir }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // @MX:SPEC: SPEC-FS-004
    #[test]
    fn test_pending_open_file_new_maps_fields() {
        let pending = PendingOpenFile::new("/tmp/a/note.md".to_string(), "/tmp/a".to_string());
        assert_eq!(pending.path, "/tmp/a/note.md");
        assert_eq!(pending.dir, "/tmp/a");
    }

    // @MX:SPEC: SPEC-FS-004
    #[test]
    fn test_pending_open_file_partial_eq_and_clone() {
        let a = PendingOpenFile::new("x.md".to_string(), "x".to_string());
        let b = a.clone();
        assert_eq!(a, b);
        assert_ne!(
            a,
            PendingOpenFile::new("y.md".to_string(), "y".to_string())
        );
    }

    // @MX:SPEC: SPEC-FS-004
    #[test]
    fn test_pending_open_file_serialization_contains_both_fields() {
        let pending = PendingOpenFile::new("/docs/a.md".to_string(), "/docs".to_string());
        let json = serde_json::to_string(&pending).unwrap();
        assert!(json.contains("\"path\""));
        assert!(json.contains("/docs/a.md"));
        assert!(json.contains("\"dir\""));
        assert!(json.contains("/docs"));
    }
}
