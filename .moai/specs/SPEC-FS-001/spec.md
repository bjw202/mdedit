---
id: SPEC-FS-001
version: "1.0.0"
status: approved
created: "2026-02-24"
updated: "2026-02-24"
author: "jw"
priority: P1
tags: [filesystem, rust, tauri, ipc, backend]
dependencies: [SPEC-INFRA-001]
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-24 | jw | 최초 SPEC 작성 |

## Overview

MdEdit 애플리케이션의 Rust 백엔드 파일 시스템 CRUD 연산을 정의한다. Tauri IPC 커맨드 핸들러를 통해 프론트엔드에서 파일 읽기, 쓰기, 생성, 삭제, 이름 변경, 디렉토리 조회, 네이티브 디렉토리 선택 대화상자 기능을 제공한다. 모든 파일 연산은 경로 유효성 검사와 샌드박싱을 통해 보안을 보장한다.

## EARS Requirements

### Ubiquitous Requirements

- **REQ-FS-U01**: 시스템은 항상 모든 파일 연산에서 UTF-8 인코딩을 사용하여 파일 내용을 처리해야 한다.
- **REQ-FS-U02**: 시스템은 항상 파일 경로에 대해 path traversal 공격 방지를 위한 유효성 검사를 수행해야 한다 (`..` 및 심볼릭 링크 추적 방지).
- **REQ-FS-U03**: 시스템은 항상 파일 연산 결과를 `Result<T, String>` 타입으로 반환하여 프론트엔드에서 에러를 처리할 수 있게 해야 한다.
- **REQ-FS-U04**: 시스템은 항상 Tauri IPC 커맨드의 반환 타입과 TypeScript 타입 정의를 동기화하여 타입 안전성을 보장해야 한다.
- **REQ-FS-U05**: 시스템은 항상 파일 연산에서 발생하는 에러를 구조화된 에러 메시지로 변환하여 반환해야 한다 (에러 코드 + 사용자 메시지).
- **REQ-FS-U06**: 시스템은 항상 serde를 통해 Rust 구조체와 JSON 간 직렬화/역직렬화를 수행해야 한다.

### Event-Driven Requirements

- **REQ-FS-E01**: WHEN `read_file(path)` 커맨드가 호출되면, THEN 지정된 경로의 파일 내용을 UTF-8 문자열로 읽어 반환해야 한다.
- **REQ-FS-E02**: WHEN `write_file(path, content)` 커맨드가 호출되면, THEN 지정된 경로에 content를 UTF-8로 기록하고 성공 여부를 반환해야 한다.
- **REQ-FS-E03**: WHEN `create_file(path)` 커맨드가 호출되면, THEN 지정된 경로에 빈 파일을 생성하고 성공 여부를 반환해야 한다.
- **REQ-FS-E04**: WHEN `delete_file(path)` 커맨드가 호출되면, THEN 지정된 경로의 파일을 삭제하고 성공 여부를 반환해야 한다.
- **REQ-FS-E05**: WHEN `rename_file(old_path, new_path)` 커맨드가 호출되면, THEN 파일을 old_path에서 new_path로 이동/이름 변경하고 성공 여부를 반환해야 한다.
- **REQ-FS-E06**: WHEN `read_directory(path)` 커맨드가 호출되면, THEN 지정된 디렉토리의 계층 구조를 `FileNode` 트리로 반환해야 한다.
- **REQ-FS-E07**: WHEN `open_directory_dialog()` 커맨드가 호출되면, THEN 네이티브 디렉토리 선택 대화상자를 표시하고 선택된 경로를 반환해야 한다 (취소 시 `None`).

### State-Driven Requirements

- **REQ-FS-S01**: IF 파일이 이미 존재하는 경로에 `create_file`을 호출하면, THEN 에러를 반환하고 기존 파일을 덮어쓰지 않아야 한다.
- **REQ-FS-S02**: IF 존재하지 않는 경로에 `read_file`을 호출하면, THEN "File not found" 에러를 반환해야 한다.
- **REQ-FS-S03**: IF 읽기 전용 파일에 `write_file`을 호출하면, THEN "Permission denied" 에러를 반환해야 한다.
- **REQ-FS-S04**: IF `rename_file`의 new_path가 이미 존재하면, THEN 에러를 반환하고 기존 파일을 보호해야 한다.
- **REQ-FS-S05**: IF `read_directory`의 대상 경로가 디렉토리가 아니면, THEN "Not a directory" 에러를 반환해야 한다.
- **REQ-FS-S06**: IF 디렉토리에 1000개 이상의 파일이 있으면, THEN 최상위 레벨만 반환하고 하위 디렉토리는 lazy loading을 위해 접힌 상태로 표시해야 한다.

### Unwanted Behavior Requirements

- **REQ-FS-N01**: 시스템은 Tauri capabilities에서 허용된 범위 밖의 파일 시스템에 접근하지 않아야 한다.
- **REQ-FS-N02**: 시스템은 심볼릭 링크를 자동으로 추적하지 않아야 한다 (보안상 심볼릭 링크는 무시).
- **REQ-FS-N03**: 시스템은 바이너리 파일을 텍스트로 읽으려 시도하지 않아야 한다 (UTF-8 디코딩 실패 시 에러 반환).
- **REQ-FS-N04**: 시스템은 파일 삭제 시 확인 없이 디렉토리를 재귀적으로 삭제하지 않아야 한다.
- **REQ-FS-N05**: 시스템은 에러 메시지에 전체 파일 시스템 경로를 노출하지 않아야 한다 (사용자 홈 디렉토리 이하만 표시).

### Optional Requirements

- **REQ-FS-O01**: 가능하면 파일 메타데이터(크기, 수정 시간)를 `FileNode`에 포함하여 반환한다.
- **REQ-FS-O02**: 가능하면 디렉토리 조회 결과를 캐싱하여 반복 조회 성능을 향상시킨다.
- **REQ-FS-O03**: 가능하면 파일 확장자에 따른 아이콘 타입 정보를 `FileNode`에 포함한다.

## Technical Constraints

### IPC Command Signatures

```rust
// File Operations
#[tauri::command]
async fn read_file(path: String) -> Result<String, String>;

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String>;

#[tauri::command]
async fn create_file(path: String) -> Result<(), String>;

#[tauri::command]
async fn delete_file(path: String) -> Result<(), String>;

#[tauri::command]
async fn rename_file(old_path: String, new_path: String) -> Result<(), String>;

// Directory Operations
#[tauri::command]
async fn read_directory(path: String) -> Result<Vec<FileNode>, String>;

#[tauri::command]
async fn open_directory_dialog() -> Result<Option<String>, String>;
```

### Rust Data Models

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileNode>>,
    pub size: Option<u64>,
    pub modified_time: Option<u64>,  // Unix timestamp
}
```

### TypeScript Type Definitions

```typescript
interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  size?: number;
  modifiedTime?: number;
}
```

### 모듈 구조

| Module | File Path | Description |
|--------|-----------|-------------|
| file_ops | `src-tauri/src/commands/file_ops.rs` | 파일 CRUD 커맨드 핸들러 |
| directory_ops | `src-tauri/src/commands/directory_ops.rs` | 디렉토리 조회 및 대화상자 |
| file_node | `src-tauri/src/models/file_node.rs` | FileNode 데이터 모델 |
| ipc | `src/lib/tauri/ipc.ts` | 타입 안전 IPC 래퍼 함수 |
| file types | `src/types/file.ts` | TypeScript 파일 타입 정의 |

### 성능 목표

| Operation | Target | Notes |
|-----------|--------|-------|
| read_file (10KB) | < 50ms | IPC 왕복 포함 |
| write_file (10KB) | < 100ms | 디스크 동기화 포함 |
| create_file | < 50ms | 빈 파일 생성 |
| delete_file | < 50ms | 단일 파일 삭제 |
| rename_file | < 50ms | 동일 볼륨 이동 |
| read_directory (1000 files) | < 200ms | 첫 로딩, 이후 캐시 |
| open_directory_dialog | N/A | 사용자 상호작용 시간 제외 |

### 보안 요구사항

- 모든 경로 입력에 대해 canonicalize 후 허용 범위 확인
- `..` 세그먼트를 포함한 경로 거부
- 심볼릭 링크 해석 차단
- Tauri capabilities에서 `fs:read`, `fs:write` 범위 제한
- 파일 접근 권한은 사용자가 `open_directory_dialog`로 선택한 디렉토리 하위로 제한

## Dependencies

- **SPEC-INFRA-001**: Tauri v2 + React 프로젝트 초기 설정이 완료되어야 한다
