# Implementation Plan: SPEC-FS-002

## Overview

notify 크레이트 기반 파일 시스템 변경 감지 기능 구현. Rust 백엔드에서 파일 변경을 감지하고, Tauri 이벤트를 통해 React 프론트엔드에 알리며, `useFileWatcher` 훅으로 에디터 자동 갱신을 제공한다.

## Task Decomposition

### Milestone 1: Rust 데이터 모델 및 상태 정의 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T1-1 | `FileChangedEvent` 및 `FileChangeKind` 구조체/enum 정의 | `src-tauri/src/models/file_event.rs` |
| T1-2 | `AppState` 구조체 정의 (Mutex 기반 watcher 상태, last_write_time 추적) | `src-tauri/src/state/app_state.rs` |
| T1-3 | AppState를 Tauri 앱에 managed state로 등록 | `src-tauri/src/lib.rs` |
| T1-4 | models 및 state `mod.rs` 업데이트 | `src-tauri/src/models/mod.rs`, `src-tauri/src/state/mod.rs` |

### Milestone 2: 이벤트 필터링 및 디바운싱 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T2-1 | 이벤트 필터링 함수 구현 (무시 패턴: .tmp, .swp, .git/, .DS_Store 등) | `src-tauri/src/commands/watcher.rs` |
| T2-2 | 50ms 디바운싱 로직 구현 (HashMap 기반 마지막 이벤트 시간 추적) | `src-tauri/src/commands/watcher.rs` |
| T2-3 | self-change detection 구현 (write_file 호출 후 200ms 이내 이벤트 무시) | `src-tauri/src/commands/watcher.rs` |
| T2-4 | 필터링 및 디바운싱 단위 테스트 작성 | `src-tauri/tests/watcher_filter_test.rs` |

### Milestone 3: Watcher IPC 커맨드 핸들러 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T3-1 | `start_watch` 커맨드 구현 (notify RecommendedWatcher 초기화, RecursiveMode) | `src-tauri/src/commands/watcher.rs` |
| T3-2 | `stop_watch` 커맨드 구현 (watcher 중지, 리소스 해제) | `src-tauri/src/commands/watcher.rs` |
| T3-3 | notify 이벤트를 FileChangedEvent로 변환하는 로직 구현 | `src-tauri/src/commands/watcher.rs` |
| T3-4 | Tauri `app_handle.emit("file-changed", event)` 이벤트 전달 구현 | `src-tauri/src/commands/watcher.rs` |
| T3-5 | watcher 에러 처리 (패닉 방지, 안전 종료, 로깅) | `src-tauri/src/commands/watcher.rs` |

### Milestone 4: Tauri 통합 및 커맨드 등록 (Primary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T4-1 | `lib.rs`에 start_watch, stop_watch 커맨드 등록 | `src-tauri/src/lib.rs` |
| T4-2 | `commands/mod.rs`에 watcher 모듈 공개 | `src-tauri/src/commands/mod.rs` |
| T4-3 | Tauri capabilities에 이벤트 emit 권한 추가 | `src-tauri/capabilities/main.json` |
| T4-4 | write_file 커맨드에 last_write_time 기록 로직 추가 (self-change detection 연동) | `src-tauri/src/commands/file_ops.rs` |

### Milestone 5: React useFileWatcher 훅 (Secondary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T5-1 | `useFileWatcher` 커스텀 훅 구현 (Tauri event listener 등록/해제) | `src/hooks/useFileWatcher.ts` |
| T5-2 | TypeScript `FileChangedEvent` 타입 정의 | `src/types/file.ts` |
| T5-3 | IPC 래퍼에 `startWatch`, `stopWatch` 함수 추가 | `src/lib/tauri/ipc.ts` |
| T5-4 | 훅 단위 테스트 작성 (mock Tauri event listener) | `src/hooks/__tests__/useFileWatcher.test.ts` |

### Milestone 6: 에디터 연동 (Secondary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T6-1 | 현재 편집 중인 파일의 외부 변경 감지 시 자동 갱신 로직 구현 | `src/hooks/useFileWatcher.ts` |
| T6-2 | 디렉토리 트리의 파일 추가/삭제/이름 변경 시 fileStore 자동 갱신 | `src/hooks/useFileWatcher.ts` |

### Milestone 7: 통합 테스트 (Secondary Goal)

| Task | Description | Files |
|------|-------------|-------|
| T7-1 | Rust watcher 통합 테스트 (임시 디렉토리에서 파일 변경 감지 확인) | `src-tauri/tests/integration/watcher_test.rs` |
| T7-2 | 디바운싱 동작 확인 테스트 (50ms 이내 중복 이벤트 필터링) | `src-tauri/tests/integration/watcher_test.rs` |
| T7-3 | self-change detection 통합 테스트 | `src-tauri/tests/integration/watcher_test.rs` |

## Technology Stack

### Rust Crates

| Crate | Version | Purpose |
|-------|---------|---------|
| notify | 6.x | 크로스 플랫폼 파일 시스템 watcher |
| notify-debouncer-mini | 0.4.x | 이벤트 디바운싱 (대안: 수동 구현) |
| tauri | 2.x | IPC 커맨드 및 이벤트 emit |
| tokio | 1.x | 비동기 런타임 (spawn, channels) |
| tracing | 0.1.x | watcher 에러 로깅 |

### TypeScript

| Library | Version | Purpose |
|---------|---------|---------|
| @tauri-apps/api | 2.x | Tauri event listen/unlisten API |

## Risk Analysis

### Risk 1: OS별 watcher 동작 차이

- **가능성**: 높음
- **영향**: 중간
- **대응**: macOS FSEvents, Linux inotify, Windows ReadDirectoryChangesW 각각의 동작 특성을 문서화. macOS에서 FSEvents는 디렉토리 단위 이벤트를 발생시킬 수 있으므로 파일 단위로 필터링 필요. Linux inotify는 재귀 감시에 제한이 있으므로 notify가 자동으로 처리하는지 확인.

### Risk 2: 이벤트 폭풍 (Event Storm)

- **가능성**: 중간
- **영향**: 높음
- **대응**: 50ms 디바운싱으로 중복 이벤트 필터링. Git 작업(checkout, merge 등)으로 다수의 파일이 동시에 변경될 경우 이벤트 큐 크기 제한. 최악의 경우 watcher를 일시 중지하고 디렉토리 전체를 다시 읽는 fallback 전략.

### Risk 3: self-change detection 오류

- **가능성**: 중간
- **영향**: 중간
- **대응**: `write_file` 호출 시 `last_write_time`에 현재 시간을 기록하고, watcher 이벤트가 200ms 이내에 발생하면 자체 변경으로 판단하여 무시. 타임스탬프 기반 비교는 시스템 클록 정밀도에 의존하므로 여유 있는 200ms 윈도우 적용.

### Risk 4: watcher 리소스 누수

- **가능성**: 낮음
- **영향**: 높음
- **대응**: `start_watch` 호출 시 기존 watcher를 반드시 먼저 drop. `Mutex` 기반 상태 관리로 동시 접근 방지. 앱 종료 시 watcher 정리를 Tauri lifecycle hook에서 보장.

### Risk 5: 대규모 디렉토리 감시 시 메모리 사용량

- **가능성**: 낮음
- **영향**: 중간
- **대응**: notify의 RecommendedWatcher는 OS 네이티브 이벤트를 사용하므로 메모리 오버헤드가 낮음. 단, 10,000+ 파일 디렉토리에서 초기 scan 시간이 길어질 수 있으므로 모니터링 필요.

## File Manifest

### 생성할 파일

| File Path | Description |
|-----------|-------------|
| `src-tauri/src/models/file_event.rs` | FileChangedEvent, FileChangeKind 모델 |
| `src-tauri/src/state/app_state.rs` | AppState 구조체 (Mutex 기반 watcher 상태) |
| `src-tauri/src/commands/watcher.rs` | start_watch, stop_watch 커맨드 핸들러 |
| `src/hooks/useFileWatcher.ts` | React 파일 변경 감지 훅 |
| `src/hooks/__tests__/useFileWatcher.test.ts` | useFileWatcher 단위 테스트 |
| `src-tauri/tests/watcher_filter_test.rs` | 필터링/디바운싱 단위 테스트 |
| `src-tauri/tests/integration/watcher_test.rs` | watcher 통합 테스트 |

### 수정할 파일

| File Path | Changes |
|-----------|---------|
| `src-tauri/src/lib.rs` | AppState managed state 등록, start_watch/stop_watch 커맨드 등록 |
| `src-tauri/src/commands/mod.rs` | watcher 모듈 공개 |
| `src-tauri/src/models/mod.rs` | file_event 모듈 공개 |
| `src-tauri/src/state/mod.rs` | app_state 모듈 공개 |
| `src-tauri/src/commands/file_ops.rs` | write_file에 last_write_time 기록 추가 |
| `src-tauri/Cargo.toml` | notify 6.x 의존성 추가 |
| `src-tauri/capabilities/main.json` | 이벤트 emit 권한 추가 |
| `src/types/file.ts` | FileChangedEvent, FileChangeKind 타입 추가 |
| `src/lib/tauri/ipc.ts` | startWatch, stopWatch 래퍼 함수 추가 |

## Architecture Design

### 데이터 흐름

```
[External Program] --modifies file-->
[OS: FSEvents/inotify/ReadDirectoryChangesW] --native event-->
[notify crate: RecommendedWatcher] --DebouncedEvent-->
[watcher.rs: event_filter + debounce] --filtered-->
[Tauri: app_handle.emit("file-changed", FileChangedEvent)] --IPC-->
[React: useFileWatcher hook] --callback-->
[Editor: auto-reload / FileTree: refresh]
```

### Self-Change Detection 흐름

```
[Editor: Ctrl+S] -->
[write_file(path, content)] -->
[file_ops.rs: write + record last_write_time] -->
[OS: file modified event] -->
[watcher.rs: check last_write_time for path] -->
  IF within 200ms window: IGNORE (self-change)
  ELSE: EMIT file-changed event
```

## Expert Consultation Recommendations

### Backend Expert (expert-backend)

- notify v6 API 사용 패턴 검토
- Mutex vs RwLock 선택 (watcher 상태 접근 패턴 분석)
- tokio::spawn에서의 에러 전파 패턴

### Frontend Expert (expert-frontend)

- useFileWatcher 훅의 React lifecycle 통합 검토
- Tauri event listener 메모리 관리 패턴
- 에디터 자동 갱신 시 UX 고려사항 (커서 위치 보존 등)

### Performance Expert (expert-performance)

- 대규모 디렉토리(10,000+ 파일)에서의 watcher 성능 프로파일링
- 이벤트 디바운싱 최적 간격 튜닝 (50ms vs 100ms)
