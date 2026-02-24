---
id: SPEC-FS-002
version: "1.0.0"
status: approved
created: "2026-02-24"
updated: "2026-02-24"
author: "jw"
priority: P1
tags: [filesystem, watcher, notify, tauri, events, realtime]
dependencies: [SPEC-FS-001, SPEC-EDITOR-001]
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-24 | jw | 최초 SPEC 작성 |

## Overview

MdEdit 애플리케이션의 파일 시스템 변경 감지 기능을 정의한다. Rust의 `notify` 크레이트(v6.x)를 사용하여 파일 변경을 실시간으로 감지하고, Tauri 이벤트 시스템을 통해 프론트엔드에 알린다. 외부 프로그램에서 파일이 수정되면 에디터가 자동으로 변경 사항을 반영하여 사용자에게 최신 상태를 유지한다. 50ms 디바운싱으로 중복 이벤트를 방지하고, `Mutex` 기반 상태 관리로 thread-safe한 watcher 제어를 보장한다.

## EARS Requirements

### Ubiquitous Requirements

- **REQ-FSW-U01**: 시스템은 항상 파일 변경 이벤트를 `file-changed` Tauri 이벤트 이름으로 프론트엔드에 전달해야 한다.
- **REQ-FSW-U02**: 시스템은 항상 watcher 상태를 `Mutex<WatcherState>`로 관리하여 thread-safe한 접근을 보장해야 한다.
- **REQ-FSW-U03**: 시스템은 항상 파일 변경 이벤트에 `kind` (Created, Modified, Deleted, Renamed), `path`, `timestamp` 필드를 포함해야 한다.
- **REQ-FSW-U04**: 시스템은 항상 50ms 디바운싱을 적용하여 동일 파일에 대한 중복 이벤트를 필터링해야 한다.
- **REQ-FSW-U05**: 시스템은 항상 watcher가 활성화된 동안 모니터링 대상 경로의 하위 디렉토리를 재귀적으로 감시해야 한다.

### Event-Driven Requirements

- **REQ-FSW-E01**: WHEN `start_watch(path)` 커맨드가 호출되면, THEN 지정된 경로에 대한 파일 시스템 watcher가 시작되고 이전 watcher가 있으면 중지된다.
- **REQ-FSW-E02**: WHEN `stop_watch()` 커맨드가 호출되면, THEN 현재 활성화된 파일 시스템 watcher가 중지되고 리소스가 해제된다.
- **REQ-FSW-E03**: WHEN 외부 프로그램이 감시 중인 파일을 수정하면, THEN `file-changed` 이벤트가 `kind: "Modified"`, 해당 파일 경로, 타임스탬프와 함께 프론트엔드로 전달된다.
- **REQ-FSW-E04**: WHEN 감시 중인 디렉토리에 새 파일이 생성되면, THEN `file-changed` 이벤트가 `kind: "Created"`와 함께 프론트엔드로 전달된다.
- **REQ-FSW-E05**: WHEN 감시 중인 디렉토리에서 파일이 삭제되면, THEN `file-changed` 이벤트가 `kind: "Deleted"`와 함께 프론트엔드로 전달된다.
- **REQ-FSW-E06**: WHEN 감시 중인 디렉토리에서 파일이 이름 변경되면, THEN `file-changed` 이벤트가 `kind: "Renamed"`와 함께 프론트엔드로 전달된다.
- **REQ-FSW-E07**: WHEN React 컴포넌트가 마운트되면, THEN `useFileWatcher` 훅이 Tauri `file-changed` 이벤트 리스너를 등록한다.
- **REQ-FSW-E08**: WHEN React 컴포넌트가 언마운트되면, THEN `useFileWatcher` 훅이 이벤트 리스너를 정리(cleanup)한다.
- **REQ-FSW-E09**: WHEN 현재 편집 중인 파일이 외부에서 수정되면, THEN 에디터가 자동으로 최신 내용을 다시 읽어와 반영한다.

### State-Driven Requirements

- **REQ-FSW-S01**: IF watcher가 이미 활성화된 상태에서 `start_watch(new_path)`가 호출되면, THEN 기존 watcher를 중지하고 새 경로에 대한 watcher를 시작해야 한다.
- **REQ-FSW-S02**: IF watcher가 비활성화된 상태에서 `stop_watch()`가 호출되면, THEN 에러 없이 무시(no-op)해야 한다.
- **REQ-FSW-S03**: IF 감시 대상 디렉토리가 삭제되면, THEN watcher가 자동으로 중지되고 프론트엔드에 알림이 전달되어야 한다.
- **REQ-FSW-S04**: IF 50ms 이내에 동일 파일에 대한 다수의 변경 이벤트가 발생하면, THEN 마지막 이벤트만 프론트엔드로 전달해야 한다.
- **REQ-FSW-S05**: IF 에디터에서 파일을 저장(write_file)한 직후 watcher 이벤트가 발생하면, THEN 자체 저장으로 인한 이벤트는 무시해야 한다 (self-change detection).

### Unwanted Behavior Requirements

- **REQ-FSW-N01**: 시스템은 에디터 내부의 파일 저장으로 인한 변경 이벤트를 외부 변경으로 잘못 감지하지 않아야 한다.
- **REQ-FSW-N02**: 시스템은 watcher 에러로 인해 애플리케이션이 크래시하지 않아야 한다. 에러 발생 시 watcher를 안전하게 중지하고 로그를 남긴다.
- **REQ-FSW-N03**: 시스템은 임시 파일(.tmp, .swp, ~로 끝나는 파일)에 대한 변경 이벤트를 프론트엔드에 전달하지 않아야 한다.
- **REQ-FSW-N04**: 시스템은 .git/ 디렉토리 내부의 파일 변경을 프론트엔드에 전달하지 않아야 한다.
- **REQ-FSW-N05**: 시스템은 CPU 사용량을 과도하게 소비하는 폴링(polling) 기반 감시를 사용하지 않아야 한다 (OS 네이티브 이벤트 사용).

### Optional Requirements

- **REQ-FSW-O01**: 가능하면 watcher 이벤트에 파일 크기 변경 정보를 포함하여 반환한다.
- **REQ-FSW-O02**: 가능하면 사용자에게 외부 변경 시 "파일이 외부에서 수정되었습니다. 다시 불러오시겠습니까?" 확인 대화상자를 제공한다 (V2+).
- **REQ-FSW-O03**: 가능하면 무시할 파일 패턴을 사용자가 설정할 수 있는 `.mdignore` 파일을 지원한다.

## Technical Constraints

### IPC Command Signatures

```rust
#[tauri::command]
async fn start_watch(
    path: String,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String>;

#[tauri::command]
async fn stop_watch(
    state: tauri::State<'_, AppState>,
) -> Result<(), String>;
```

### Rust Data Models

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangedEvent {
    pub kind: FileChangeKind,
    pub path: String,
    pub timestamp: u64,  // Unix timestamp in milliseconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileChangeKind {
    Created,
    Modified,
    Deleted,
    Renamed,
}
```

### Application State

```rust
pub struct AppState {
    pub watcher: Mutex<Option<RecommendedWatcher>>,
    pub watch_path: Mutex<Option<String>>,
    pub last_write_time: Mutex<HashMap<String, Instant>>,
}
```

### TypeScript Type Definitions

```typescript
interface FileChangedEvent {
  kind: 'Created' | 'Modified' | 'Deleted' | 'Renamed';
  path: string;
  timestamp: number;
}
```

### React Hook Interface

```typescript
function useFileWatcher(options: {
  onFileChanged: (event: FileChangedEvent) => void;
  enabled?: boolean;
}): {
  isWatching: boolean;
  startWatch: (path: string) => Promise<void>;
  stopWatch: () => Promise<void>;
};
```

### 모듈 구조

| Module | File Path | Description |
|--------|-----------|-------------|
| watcher | `src-tauri/src/commands/watcher.rs` | 파일 시스템 watcher IPC 커맨드 |
| file_event | `src-tauri/src/models/file_event.rs` | FileChangedEvent, FileChangeKind 모델 |
| app_state | `src-tauri/src/state/app_state.rs` | AppState (Mutex 기반 watcher 상태) |
| useFileWatcher | `src/hooks/useFileWatcher.ts` | React 파일 변경 감지 훅 |

### notify 크레이트 설정

- `notify` v6.x (RecommendedWatcher)
- `RecursiveMode::Recursive` 사용하여 하위 디렉토리 포함 감시
- OS 네이티브 이벤트 시스템 사용 (macOS: FSEvents, Linux: inotify, Windows: ReadDirectoryChangesW)
- 디바운싱: 50ms 간격으로 동일 파일 이벤트 필터링

### 성능 목표

| Metric | Target | Notes |
|--------|--------|-------|
| 이벤트 감지 지연 | < 100ms | 파일 변경 후 이벤트 발생까지 |
| 디바운스 간격 | 50ms | 동일 파일 중복 이벤트 필터링 |
| CPU 오버헤드 (유휴) | < 0.5% | watcher 활성화 상태 유휴 시 |
| 메모리 오버헤드 | < 5MB | watcher + 이벤트 버퍼 |
| watcher 시작 시간 | < 100ms | start_watch 커맨드 응답 |
| watcher 중지 시간 | < 50ms | stop_watch 커맨드 응답 |

### 이벤트 필터링 규칙

다음 패턴의 파일 변경은 무시한다:

| Pattern | Example | Reason |
|---------|---------|--------|
| `*.tmp` | `file.tmp` | 임시 파일 |
| `*.swp` | `.file.swp` | Vim swap 파일 |
| `*~` | `file.md~` | 백업 파일 |
| `.git/**` | `.git/index` | Git 내부 파일 |
| `.DS_Store` | `.DS_Store` | macOS 메타데이터 |
| `Thumbs.db` | `Thumbs.db` | Windows 메타데이터 |
| `node_modules/**` | `node_modules/...` | 의존성 디렉토리 |

### 보안 요구사항

- watcher 경로는 사용자가 `open_directory_dialog`로 선택한 디렉토리로 제한
- 감시 경로 변경 시 기존 watcher 즉시 중지
- watcher 에러 시 안전한 종료 보장 (panic 방지)

## Dependencies

- **SPEC-FS-001**: 파일 시스템 CRUD 연산이 구현되어야 한다 (read_file, write_file 등)
- **SPEC-EDITOR-001**: 에디터 컴포넌트가 구현되어야 파일 내용 자동 갱신 기능을 연동할 수 있다
