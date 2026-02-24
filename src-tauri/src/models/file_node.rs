// @MX:ANCHOR: [AUTO] Core data model for filesystem tree representation
// @MX:REASON: Used by read_directory, FileNode is central to all directory ops (fan_in >= 3)
// @MX:SPEC: SPEC-FS-001

use serde::{Deserialize, Serialize};

/// Represents a file or directory node in the filesystem tree.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    /// File or directory name (not full path)
    pub name: String,
    /// Absolute path to the file or directory
    pub path: String,
    /// True if this node represents a directory
    pub is_directory: bool,
    /// Child nodes (only populated for directories)
    pub children: Option<Vec<FileNode>>,
    /// File size in bytes (None for directories)
    pub size: Option<u64>,
    /// Last modified time as Unix timestamp in seconds (None if unavailable)
    pub modified_time: Option<u64>,
}

impl FileNode {
    /// Creates a new file node.
    pub fn new_file(name: String, path: String, size: Option<u64>, modified_time: Option<u64>) -> Self {
        Self {
            name,
            path,
            is_directory: false,
            children: None,
            size,
            modified_time,
        }
    }

    /// Creates a new directory node.
    pub fn new_directory(name: String, path: String, children: Option<Vec<FileNode>>) -> Self {
        Self {
            name,
            path,
            is_directory: true,
            children,
            size: None,
            modified_time: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_node_serialization_roundtrip() {
        let node = FileNode {
            name: "hello.md".to_string(),
            path: "/tmp/hello.md".to_string(),
            is_directory: false,
            children: None,
            size: Some(42),
            modified_time: Some(1700000000),
        };

        let json = serde_json::to_string(&node).expect("serialization failed");
        let deserialized: FileNode = serde_json::from_str(&json).expect("deserialization failed");

        assert_eq!(deserialized.name, "hello.md");
        assert_eq!(deserialized.path, "/tmp/hello.md");
        assert!(!deserialized.is_directory);
        assert!(deserialized.children.is_none());
        assert_eq!(deserialized.size, Some(42));
        assert_eq!(deserialized.modified_time, Some(1700000000));
    }

    #[test]
    fn test_directory_node_serialization_roundtrip() {
        let child = FileNode::new_file(
            "child.md".to_string(),
            "/tmp/dir/child.md".to_string(),
            Some(10),
            None,
        );
        let node = FileNode::new_directory(
            "dir".to_string(),
            "/tmp/dir".to_string(),
            Some(vec![child]),
        );

        let json = serde_json::to_string(&node).expect("serialization failed");
        let deserialized: FileNode = serde_json::from_str(&json).expect("deserialization failed");

        assert_eq!(deserialized.name, "dir");
        assert!(deserialized.is_directory);
        assert!(deserialized.size.is_none());
        let children = deserialized.children.expect("children should be present");
        assert_eq!(children.len(), 1);
        assert_eq!(children[0].name, "child.md");
    }

    #[test]
    fn test_new_file_constructor() {
        let node = FileNode::new_file(
            "test.txt".to_string(),
            "/tmp/test.txt".to_string(),
            Some(100),
            Some(1700000000),
        );
        assert_eq!(node.name, "test.txt");
        assert!(!node.is_directory);
        assert!(node.children.is_none());
        assert_eq!(node.size, Some(100));
    }

    #[test]
    fn test_new_directory_constructor() {
        let node = FileNode::new_directory(
            "docs".to_string(),
            "/tmp/docs".to_string(),
            Some(vec![]),
        );
        assert_eq!(node.name, "docs");
        assert!(node.is_directory);
        assert!(node.size.is_none());
        assert!(node.children.is_some());
    }

    #[test]
    fn test_file_node_null_children_serializes_as_null() {
        let node = FileNode::new_file("a.txt".to_string(), "/a.txt".to_string(), None, None);
        let json = serde_json::to_value(&node).unwrap();
        assert!(json["children"].is_null());
    }

    #[test]
    fn test_file_node_serializes_with_camel_case_keys() {
        // Verifies that the JSON keys match TypeScript's camelCase interface.
        // isDirectory and modifiedTime must be camelCase, not snake_case.
        let node = FileNode::new_directory("src".to_string(), "/project/src".to_string(), None);
        let json = serde_json::to_value(&node).unwrap();

        // camelCase keys must exist
        assert!(!json["isDirectory"].is_null(), "isDirectory must be present");
        assert!(json["isDirectory"].as_bool().unwrap_or(false), "isDirectory must be true");

        // snake_case keys must NOT exist (regression guard)
        assert!(json.get("is_directory").is_none(), "is_directory must not be present");
        assert!(json.get("modified_time").is_none(), "modified_time must not be present");
    }
}
