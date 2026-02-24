// Models module for data structures and domain models
// @MX:NOTE: [AUTO] All domain models exported from this module

pub mod file_event;
pub mod file_node;

pub use file_event::{FileChangedEvent, FileChangeKind};
pub use file_node::FileNode;

pub const MODELS_MODULE_NAME: &str = "models";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_models_module_name() {
        assert_eq!(MODELS_MODULE_NAME, "models");
    }

    #[test]
    fn test_file_node_exported() {
        // Verify FileNode is accessible through the models module
        let node = FileNode::new_file(
            "test.txt".to_string(),
            "/tmp/test.txt".to_string(),
            None,
            None,
        );
        assert_eq!(node.name, "test.txt");
    }
}
