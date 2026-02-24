# Implementation Plan: SPEC-FS-001

## Overview

Rust 백엔드 파일 시스템 CRUD 연산 구현. Tauri IPC 커맨드 핸들러, Rust 데이터 모델, TypeScript 타입 정의 및 IPC 래퍼 함수를 포함한다.

## Task Decomposition

### Milestone 1: Rust 데이터 모델 정의 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T1-1 | `FileNode` 구조체 정의 (name, path, is_directory, children, size, modified_time) | `src-tauri/src/models/file_node.rs` |
| T1-2 | 커스텀 에러 타입 정의 (FileOpError enum) | `src-tauri/src/models/error.rs` |
| T1-3 | models `mod.rs` 업데이트하여 모듈 공개 | `src-tauri/src/models/mod.rs` |

### Milestone 2: 경로 유효성 검사 유틸리티 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T2-1 | `validate_path` 함수 구현 (경로 정규화, traversal 방지, 범위 검사) | `src-tauri/src/commands/path_utils.rs` |
| T2-2 | `sanitize_error_path` 함수 구현 (에러 메시지에서 절대 경로 마스킹) | `src-tauri/src/commands/path_utils.rs` |
| T2-3 | 경로 유효성 검사 단위 테스트 작성 | `src-tauri/src/commands/path_utils.rs` (tests mod) |

### Milestone 3: 파일 CRUD 커맨드 핸들러 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T3-1 | `read_file` 커맨드 구현 (UTF-8 읽기, 경로 검증) | `src-tauri/src/commands/file_ops.rs` |
| T3-2 | `write_file` 커맨드 구현 (UTF-8 쓰기, 경로 검증) | `src-tauri/src/commands/file_ops.rs` |
| T3-3 | `create_file` 커맨드 구현 (빈 파일 생성, 중복 검사) | `src-tauri/src/commands/file_ops.rs` |
| T3-4 | `delete_file` 커맨드 구현 (단일 파일 삭제) | `src-tauri/src/commands/file_ops.rs` |
| T3-5 | `rename_file` 커맨드 구현 (이동/이름 변경, 대상 존재 여부 확인) | `src-tauri/src/commands/file_ops.rs` |
| T3-6 | 파일 연산 단위 테스트 작성 (정상/에러 케이스) | `src-tauri/tests/file_ops_test.rs` |

### Milestone 4: 디렉토리 연산 커맨드 핸들러 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T4-1 | `read_directory` 커맨드 구현 (재귀적 FileNode 트리 생성) | `src-tauri/src/commands/directory_ops.rs` |
| T4-2 | 대용량 디렉토리 처리 (1000+ 파일 시 shallow listing) | `src-tauri/src/commands/directory_ops.rs` |
| T4-3 | `open_directory_dialog` 커맨드 구현 (Tauri dialog 플러그인 사용) | `src-tauri/src/commands/directory_ops.rs` |
| T4-4 | 디렉토리 연산 단위 테스트 작성 | `src-tauri/tests/directory_ops_test.rs` |

### Milestone 5: Tauri 커맨드 등록 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T5-1 | `lib.rs`에서 모든 커맨드 핸들러 등록 (invoke_handler) | `src-tauri/src/lib.rs` |
| T5-2 | `commands/mod.rs`에서 모듈 내보내기 | `src-tauri/src/commands/mod.rs` |
| T5-3 | Tauri capabilities에 파일 시스템 권한 추가 | `src-tauri/capabilities/main.json` |

### Milestone 6: TypeScript 타입 정의 및 IPC 래퍼 (Secondary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T6-1 | `FileNode` TypeScript 인터페이스 정의 | `src/types/file.ts` |
| T6-2 | 타입 안전 IPC 래퍼 함수 구현 (invoke 래핑) | `src/lib/tauri/ipc.ts` |
| T6-3 | IPC 에러 처리 유틸리티 작성 | `src/lib/tauri/errors.ts` |

### Milestone 7: 통합 테스트 (Secondary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T7-1 | 파일 CRUD 통합 테스트 (임시 디렉토리 사용) | `src-tauri/tests/integration/` |
| T7-2 | 경로 보안 통합 테스트 (path traversal 시도) | `src-tauri/tests/integration/` |
| T7-3 | TypeScript IPC 래퍼 단위 테스트 (mock invoke) | `src/lib/tauri/__tests__/ipc.test.ts` |

## Technology Stack

### Rust Crates

| Crate | Version | Purpose |
|-------|---------|---------|
| tauri | 2.x | IPC 커맨드 프레임워크 |
| serde | 1.x | FileNode 직렬화/역직렬화 |
| serde_json | 1.x | JSON 변환 |
| tokio | 1.x | 비동기 파일 I/O |
| anyhow | 1.x | 에러 처리 체인 |
| tauri-plugin-dialog | 2.x | 네이티브 대화상자 |
| tauri-plugin-fs | 2.x | 파일 시스템 접근 권한 |
| tempfile | 3.x | 테스트용 임시 파일/디렉토리 (dev-dependency) |

### TypeScript

| Library | Version | Purpose |
|---------|---------|---------|
| @tauri-apps/api | 2.x | Tauri invoke/event API |
| @tauri-apps/plugin-dialog | 2.x | 대화상자 플러그인 프론트엔드 API |
| @tauri-apps/plugin-fs | 2.x | 파일 시스템 플러그인 프론트엔드 API |

## Risk Analysis

### Risk 1: 크로스 플랫폼 경로 차이

- **가능성**: 높음
- **영향**: 중간
- **대응**: `std::path::PathBuf` 사용으로 OS별 경로 구분자 자동 처리. Windows 경로(`C:\`)와 Unix 경로(`/`) 모두 테스트 케이스에 포함. `canonicalize()` 사용 시 Windows 심볼릭 링크 동작 차이 확인.

### Risk 2: 대용량 디렉토리 성능

- **가능성**: 중간
- **영향**: 중간
- **대응**: 1000개 이상 파일 시 shallow listing 적용. 하위 디렉토리는 프론트엔드에서 요청 시 lazy load. 재귀 깊이 제한(기본 10 레벨).

### Risk 3: 파일 잠금 충돌 (Windows)

- **가능성**: 중간
- **영향**: 높음
- **대응**: Windows에서 파일 잠금이 다른 프로세스에 의해 유지되는 경우 적절한 에러 메시지 반환. 재시도 로직 없이 즉시 실패 후 사용자에게 안내.

### Risk 4: UTF-8 인코딩 호환성

- **가능성**: 낮음
- **영향**: 중간
- **대응**: UTF-8이 아닌 파일 읽기 시 명확한 에러 메시지 반환 ("File is not valid UTF-8"). 바이너리 파일 감지 로직 추가 (첫 8KB에서 null 바이트 확인).

### Risk 5: Tauri Capabilities 설정 오류

- **가능성**: 낮음
- **영향**: 높음
- **대응**: capabilities `main.json`에서 `fs:read`, `fs:write`, `dialog:open` 명시적 설정. 통합 테스트에서 권한 부족 시나리오 검증.

## File Manifest

### 생성할 파일

| File Path | Description |
|-----------|-------------|
| `src-tauri/src/models/file_node.rs` | FileNode 구조체 정의 |
| `src-tauri/src/models/error.rs` | 커스텀 에러 타입 (FileOpError) |
| `src-tauri/src/commands/file_ops.rs` | 파일 CRUD IPC 커맨드 핸들러 |
| `src-tauri/src/commands/directory_ops.rs` | 디렉토리 조회 및 대화상자 커맨드 |
| `src-tauri/src/commands/path_utils.rs` | 경로 유효성 검사 유틸리티 |
| `src/types/file.ts` | TypeScript FileNode 인터페이스 |
| `src/lib/tauri/ipc.ts` | 타입 안전 IPC 래퍼 함수 |
| `src/lib/tauri/errors.ts` | IPC 에러 처리 유틸리티 |
| `src-tauri/tests/file_ops_test.rs` | 파일 연산 단위 테스트 |
| `src-tauri/tests/directory_ops_test.rs` | 디렉토리 연산 단위 테스트 |

### 수정할 파일

| File Path | Changes |
|-----------|---------|
| `src-tauri/src/lib.rs` | 커맨드 핸들러 등록 (invoke_handler) |
| `src-tauri/src/commands/mod.rs` | file_ops, directory_ops, path_utils 모듈 공개 |
| `src-tauri/src/models/mod.rs` | file_node, error 모듈 공개 |
| `src-tauri/Cargo.toml` | tauri-plugin-dialog, tauri-plugin-fs 의존성 추가 |
| `src-tauri/capabilities/main.json` | 파일 시스템 및 대화상자 권한 추가 |
| `package.json` | @tauri-apps/plugin-dialog, @tauri-apps/plugin-fs 추가 |

## Expert Consultation Recommendations

### Backend Expert (expert-backend)

- Rust 에러 처리 패턴 검토 (anyhow vs thiserror)
- 비동기 파일 I/O 최적화 (tokio::fs vs std::fs)
- 경로 보안 유틸리티 코드 리뷰

### Security Expert (expert-security)

- Path traversal 방지 로직 검증
- Tauri capabilities 최소 권한 설정 검토
- 파일 접근 범위 제한 정책 검증
