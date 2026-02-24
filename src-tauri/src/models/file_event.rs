// @MX:NOTE: [AUTO] FileChangedEvent and FileChangeKind - Tauri event payload for filesystem notifications
// @MX:SPEC: SPEC-FS-002

/// Kinds of filesystem changes that can be emitted by the watcher.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum FileChangeKind {
    /// A new file was created.
    Created,
    /// An existing file was modified.
    Modified,
    /// A file was deleted.
    Deleted,
    /// A file was renamed or moved.
    Renamed,
}

/// Event payload emitted to the frontend when a watched file changes.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FileChangedEvent {
    /// The kind of change that occurred.
    pub kind: FileChangeKind,
    /// Absolute path of the changed file, using forward slashes.
    pub path: String,
    /// Unix timestamp in milliseconds when the event was emitted.
    pub timestamp: u64,
}

impl FileChangedEvent {
    /// Creates a new FileChangedEvent with the given kind, path, and timestamp.
    pub fn new(kind: FileChangeKind, path: String, timestamp: u64) -> Self {
        Self { kind, path, timestamp }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_change_kind_variants() {
        // Verify all variants can be instantiated
        let _created = FileChangeKind::Created;
        let _modified = FileChangeKind::Modified;
        let _deleted = FileChangeKind::Deleted;
        let _renamed = FileChangeKind::Renamed;
    }

    #[test]
    fn test_file_changed_event_new() {
        let event = FileChangedEvent::new(
            FileChangeKind::Modified,
            "/tmp/test.md".to_string(),
            1234567890,
        );
        assert_eq!(event.kind, FileChangeKind::Modified);
        assert_eq!(event.path, "/tmp/test.md");
        assert_eq!(event.timestamp, 1234567890);
    }

    #[test]
    fn test_file_changed_event_serialization() {
        let event = FileChangedEvent::new(
            FileChangeKind::Created,
            "/home/user/doc.md".to_string(),
            9999,
        );
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("Created"));
        assert!(json.contains("/home/user/doc.md"));
        assert!(json.contains("9999"));
    }

    #[test]
    fn test_file_changed_event_deserialization() {
        let json = r#"{"kind":"Deleted","path":"/tmp/file.txt","timestamp":42}"#;
        let event: FileChangedEvent = serde_json::from_str(json).unwrap();
        assert_eq!(event.kind, FileChangeKind::Deleted);
        assert_eq!(event.path, "/tmp/file.txt");
        assert_eq!(event.timestamp, 42);
    }

    #[test]
    fn test_file_change_kind_equality() {
        assert_eq!(FileChangeKind::Modified, FileChangeKind::Modified);
        assert_ne!(FileChangeKind::Created, FileChangeKind::Deleted);
    }

    #[test]
    fn test_file_changed_event_clone() {
        let event = FileChangedEvent::new(
            FileChangeKind::Renamed,
            "/path/to/file".to_string(),
            100,
        );
        let cloned = event.clone();
        assert_eq!(cloned.path, event.path);
        assert_eq!(cloned.timestamp, event.timestamp);
    }
}
