// Commands module for Tauri IPC commands
// @MX:NOTE: [AUTO] All Tauri command modules exported from here

pub mod browser_ops;
pub mod directory_ops;
pub mod file_ops;
pub mod image_ops;
pub mod watcher;

pub const COMMANDS_MODULE_NAME: &str = "commands";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_commands_module_name() {
        assert_eq!(COMMANDS_MODULE_NAME, "commands");
    }
}
