# TDD Agent Memory - MdEdit Project

## Project Stack
- Rust/Tauri v2 backend (src-tauri/)
- React/TypeScript frontend (src/)
- Tauri plugin dialog: tauri-plugin-dialog = "2"
- Tokio async runtime with full features

## Key File Paths
- Rust commands: src-tauri/src/commands/{file_ops,directory_ops}.rs
- Rust models: src-tauri/src/models/file_node.rs
- TypeScript IPC: src/lib/tauri/ipc.ts
- TypeScript types: src/types/file.ts
- Capabilities: src-tauri/capabilities/main.json

## Confirmed Patterns
- validate_path() is the security boundary - always call first in commands
- Tests use env::temp_dir() for temp files with unique names (suffix _fs001)
- #[tokio::test] for async tests
- open_directory_dialog() uses AppHandle - cannot unit test, skip unit tests
- Tauri v2 dialog: use tauri_plugin_dialog::DialogExt

## Module Wiring
- lib.rs imports from commands::{directory_ops, file_ops}
- models/mod.rs re-exports FileNode with pub use
- commands/mod.rs declares pub mod for each command file
