# Acceptance Criteria: SPEC-FS-002

## Test Scenarios

### Scenario 1: Watcher 시작 - 정상 케이스

- **Given**: 감시할 디렉토리 `/test/project/`가 존재하는 상태
- **When**: `start_watch("/test/project/")` 커맨드를 호출하면
- **Then**: watcher가 활성화되고, 해당 디렉토리 및 하위 디렉토리의 변경이 감시된다

### Scenario 2: Watcher 중지 - 정상 케이스

- **Given**: watcher가 `/test/project/`를 감시 중인 상태
- **When**: `stop_watch()` 커맨드를 호출하면
- **Then**: watcher가 중지되고 리소스가 해제되며, 이후 파일 변경 이벤트가 발생하지 않는다

### Scenario 3: 파일 수정 감지

- **Given**: watcher가 `/test/project/`를 감시 중인 상태
- **When**: 외부 프로그램이 `/test/project/readme.md` 파일을 수정하면
- **Then**: `file-changed` 이벤트가 `kind: "Modified"`, `path: "/test/project/readme.md"`, 유효한 `timestamp`와 함께 프론트엔드로 전달된다

### Scenario 4: 파일 생성 감지

- **Given**: watcher가 `/test/project/`를 감시 중인 상태
- **When**: 외부 프로그램이 `/test/project/new-file.md` 파일을 생성하면
- **Then**: `file-changed` 이벤트가 `kind: "Created"`와 함께 프론트엔드로 전달된다

### Scenario 5: 파일 삭제 감지

- **Given**: watcher가 `/test/project/`를 감시 중이고 `/test/project/old-file.md`가 존재하는 상태
- **When**: 외부 프로그램이 `/test/project/old-file.md` 파일을 삭제하면
- **Then**: `file-changed` 이벤트가 `kind: "Deleted"`와 함께 프론트엔드로 전달된다

### Scenario 6: 파일 이름 변경 감지

- **Given**: watcher가 `/test/project/`를 감시 중이고 `/test/project/old-name.md`가 존재하는 상태
- **When**: 외부 프로그램이 파일 이름을 `old-name.md`에서 `new-name.md`로 변경하면
- **Then**: `file-changed` 이벤트가 `kind: "Renamed"`와 함께 프론트엔드로 전달된다

### Scenario 7: 하위 디렉토리 파일 변경 감지

- **Given**: watcher가 `/test/project/`를 감시 중이고 `/test/project/docs/` 하위 디렉토리가 존재하는 상태
- **When**: 외부 프로그램이 `/test/project/docs/guide.md`를 수정하면
- **Then**: `file-changed` 이벤트가 해당 파일 경로와 함께 프론트엔드로 전달된다

### Scenario 8: 디바운싱 동작

- **Given**: watcher가 활성화된 상태
- **When**: 동일한 파일에 대해 10ms 간격으로 5번의 수정이 발생하면
- **Then**: 프론트엔드에는 1개의 `file-changed` 이벤트만 전달된다 (50ms 디바운싱)

### Scenario 9: Self-Change Detection

- **Given**: watcher가 활성화된 상태에서 에디터가 파일을 열고 있는 상태
- **When**: 에디터에서 `write_file`을 통해 현재 파일을 저장하면
- **Then**: 해당 저장으로 인한 `file-changed` 이벤트는 프론트엔드로 전달되지 않는다

### Scenario 10: Watcher 교체

- **Given**: watcher가 `/test/project-a/`를 감시 중인 상태
- **When**: `start_watch("/test/project-b/")` 커맨드를 호출하면
- **Then**: `/test/project-a/`의 감시가 중지되고, `/test/project-b/`의 감시가 시작된다

### Scenario 11: 비활성 상태에서 stop_watch 호출

- **Given**: watcher가 비활성화된 상태
- **When**: `stop_watch()` 커맨드를 호출하면
- **Then**: 에러 없이 정상적으로 무시된다 (no-op)

### Scenario 12: useFileWatcher 훅 - 컴포넌트 마운트/언마운트

- **Given**: useFileWatcher 훅을 사용하는 React 컴포넌트가 렌더링된 상태
- **When**: 컴포넌트가 언마운트되면
- **Then**: Tauri event listener가 정리(cleanup)되어 메모리 누수가 없다

### Scenario 13: 현재 편집 파일 외부 수정 시 자동 갱신

- **Given**: 에디터에서 `/test/project/readme.md`를 열고 있고, watcher가 활성화된 상태
- **When**: 외부 프로그램이 해당 파일을 수정하면
- **Then**: 에디터가 최신 내용을 자동으로 다시 읽어와 반영한다

### Scenario 14: 임시 파일 무시

- **Given**: watcher가 `/test/project/`를 감시 중인 상태
- **When**: 외부 프로그램이 `/test/project/file.tmp`를 생성하면
- **Then**: `file-changed` 이벤트가 프론트엔드로 전달되지 않는다

### Scenario 15: .git 디렉토리 무시

- **Given**: watcher가 `/test/project/`를 감시 중이고 `.git/` 디렉토리가 존재하는 상태
- **When**: Git 작업으로 `.git/index` 파일이 변경되면
- **Then**: `file-changed` 이벤트가 프론트엔드로 전달되지 않는다

## Edge Cases

### EC-1: 감시 대상 디렉토리 삭제

- **Given**: watcher가 `/test/project/`를 감시 중인 상태
- **When**: 외부에서 `/test/project/` 디렉토리가 삭제되면
- **Then**: watcher가 자동으로 중지되고, 에러가 로깅되며, 프론트엔드에 디렉토리 삭제 알림이 전달된다

### EC-2: 대량 파일 동시 변경 (Git checkout)

- **Given**: watcher가 감시 중인 디렉토리에서 `git checkout` 명령이 실행된 상태
- **When**: 100개 이상의 파일이 동시에 변경되면
- **Then**: 디바운싱에 의해 이벤트가 적절히 필터링되고, 애플리케이션이 응답 불능 상태가 되지 않는다

### EC-3: 네트워크 드라이브 감시

- **Given**: 네트워크 마운트된 디렉토리를 감시하려는 상태
- **When**: `start_watch`에 네트워크 경로를 전달하면
- **Then**: notify가 지원하는 경우 정상 감시되고, 미지원 시 적절한 에러 메시지가 반환된다

### EC-4: 파일 이름에 특수 문자 포함

- **Given**: watcher가 활성화된 상태
- **When**: 한글, 공백, 특수문자가 포함된 파일명(`문서 (1).md`)이 수정되면
- **Then**: 이벤트가 정확한 파일 경로와 함께 정상 전달된다

### EC-5: watcher 시작 직후 파일 변경

- **Given**: `start_watch` 커맨드를 방금 호출한 상태
- **When**: watcher 초기화 완료 전에 파일이 변경되면
- **Then**: 초기화 완료 후 이벤트가 정상 전달되거나, 누락 없이 처리된다

### EC-6: 빠른 연속 start/stop 호출

- **Given**: 애플리케이션이 실행 중인 상태
- **When**: `start_watch`와 `stop_watch`를 빠르게 번갈아 호출하면
- **Then**: Mutex에 의해 순차 처리되고, 데드락이나 리소스 누수가 발생하지 않는다

### EC-7: 동시에 두 개의 start_watch 호출

- **Given**: watcher가 비활성화된 상태
- **When**: 두 개의 `start_watch` 요청이 거의 동시에 도착하면
- **Then**: Mutex에 의해 하나만 성공하고, 최종 상태가 일관성을 유지한다

### EC-8: 앱 종료 시 watcher 정리

- **Given**: watcher가 활성화된 상태에서 앱이 종료되는 상태
- **When**: 앱이 정상 종료되면
- **Then**: watcher가 정리되고, OS 파일 핸들이 해제된다

## Performance Criteria

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| 이벤트 감지 지연 (파일 수정 -> 프론트엔드 콜백) | < 150ms | 타임스탬프 비교 (파일 mtime vs event timestamp) |
| 디바운스 동작 | 50ms 이내 중복 이벤트 1개로 병합 | 연속 10회 수정 시 이벤트 횟수 확인 |
| CPU 사용량 (watcher 유휴) | < 0.5% | Activity Monitor / top 명령 모니터링 |
| 메모리 오버헤드 | < 5MB | watcher 활성화 전후 메모리 비교 |
| start_watch 응답 시간 | < 100ms | IPC 왕복 시간 측정 |
| stop_watch 응답 시간 | < 50ms | IPC 왕복 시간 측정 |
| 대량 이벤트 처리 (100 files) | 크래시 없음, 5초 이내 안정화 | Git checkout 시뮬레이션 |

## Quality Gates

### QG-1: Rust 코드 품질

- [ ] `cargo clippy` 경고 0건
- [ ] `cargo test` 모든 테스트 통과
- [ ] 모든 public 함수에 doc comment 작성
- [ ] `unsafe` 블록 사용 0건

### QG-2: Thread Safety 검증

- [ ] `Mutex` 기반 상태 관리 구현 확인
- [ ] 동시 접근 시나리오 테스트 통과 (EC-6, EC-7)
- [ ] 데드락 가능성 분석 및 방지 확인

### QG-3: 이벤트 필터링 검증

- [ ] 임시 파일 (.tmp, .swp, ~) 필터링 테스트 통과
- [ ] .git/ 디렉토리 필터링 테스트 통과
- [ ] .DS_Store, Thumbs.db 필터링 테스트 통과
- [ ] node_modules/ 필터링 테스트 통과

### QG-4: Self-Change Detection

- [ ] write_file 호출 후 200ms 이내 이벤트 무시 테스트 통과
- [ ] write_file 호출 후 200ms 이후 외부 변경은 정상 감지 테스트 통과

### QG-5: TypeScript 타입 안전성

- [ ] `npx tsc --noEmit` 에러 0건
- [ ] FileChangedEvent 타입이 Rust 모델과 일치
- [ ] useFileWatcher 훅의 반환 타입이 정확

### QG-6: React 메모리 관리

- [ ] useFileWatcher cleanup 함수 구현 확인
- [ ] 컴포넌트 언마운트 시 event listener 해제 확인
- [ ] 메모리 누수 없음 (React DevTools Profiler 확인)

### QG-7: 테스트 커버리지

- [ ] Rust watcher 코드 커버리지 >= 85%
- [ ] TypeScript useFileWatcher 훅 테스트 커버리지 >= 80%
- [ ] 이벤트 필터링 로직 100% 테스트 커버리지

### QG-8: 성능

- [ ] 모든 Performance Criteria 목표 이내
- [ ] 대량 이벤트 시 크래시 없음 (EC-2 통과)
- [ ] CPU 유휴 오버헤드 < 0.5%

## Definition of Done

- [ ] `start_watch`와 `stop_watch` Tauri IPC 커맨드가 구현되고 등록되었다
- [ ] `FileChangedEvent`와 `FileChangeKind` 모델이 Rust와 TypeScript 양측에서 정의되었다
- [ ] 50ms 디바운싱이 정상 동작하여 중복 이벤트를 필터링한다
- [ ] Self-change detection이 동작하여 에디터 내부 저장을 외부 변경으로 감지하지 않는다
- [ ] 임시 파일, .git/, .DS_Store 등 불필요한 이벤트를 필터링한다
- [ ] `useFileWatcher` React 훅이 구현되고 cleanup이 올바르게 동작한다
- [ ] 현재 편집 중인 파일의 외부 변경 시 자동 갱신이 동작한다
- [ ] Mutex 기반 thread-safe 상태 관리가 검증되었다
- [ ] 모든 Test Scenario가 통과한다
- [ ] 모든 Edge Case가 적절히 처리된다
- [ ] 모든 Quality Gate를 만족한다
- [ ] watcher 에러가 애플리케이션 크래시를 유발하지 않는다
