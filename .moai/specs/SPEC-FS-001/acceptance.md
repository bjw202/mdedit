# Acceptance Criteria: SPEC-FS-001

## Test Scenarios

### Scenario 1: 파일 읽기 - 정상 케이스

- **Given**: 경로 `/test/sample.md`에 "# Hello World" 내용의 파일이 존재하는 상태
- **When**: `read_file("/test/sample.md")` 커맨드를 호출하면
- **Then**: "# Hello World" 문자열이 반환된다

### Scenario 2: 파일 읽기 - 존재하지 않는 파일

- **Given**: 경로 `/test/nonexistent.md`에 파일이 존재하지 않는 상태
- **When**: `read_file("/test/nonexistent.md")` 커맨드를 호출하면
- **Then**: "File not found" 에러 메시지가 반환된다

### Scenario 3: 파일 쓰기 - 정상 케이스

- **Given**: 경로 `/test/output.md`에 쓰기 권한이 있는 상태
- **When**: `write_file("/test/output.md", "# New Content")` 커맨드를 호출하면
- **Then**: 파일이 성공적으로 저장되고, 동일 경로를 `read_file`로 읽으면 "# New Content"가 반환된다

### Scenario 4: 파일 쓰기 - 읽기 전용 파일

- **Given**: 경로 `/test/readonly.md`가 읽기 전용 권한인 상태
- **When**: `write_file("/test/readonly.md", "content")` 커맨드를 호출하면
- **Then**: "Permission denied" 에러 메시지가 반환된다

### Scenario 5: 파일 생성 - 정상 케이스

- **Given**: 경로 `/test/new-file.md`에 파일이 존재하지 않는 상태
- **When**: `create_file("/test/new-file.md")` 커맨드를 호출하면
- **Then**: 빈 파일이 생성되고, `read_file`로 읽으면 빈 문자열이 반환된다

### Scenario 6: 파일 생성 - 이미 존재하는 파일

- **Given**: 경로 `/test/existing.md`에 이미 파일이 존재하는 상태
- **When**: `create_file("/test/existing.md")` 커맨드를 호출하면
- **Then**: "File already exists" 에러가 반환되고, 기존 파일 내용은 보존된다

### Scenario 7: 파일 삭제 - 정상 케이스

- **Given**: 경로 `/test/to-delete.md`에 파일이 존재하는 상태
- **When**: `delete_file("/test/to-delete.md")` 커맨드를 호출하면
- **Then**: 파일이 삭제되고, 이후 `read_file`을 호출하면 "File not found" 에러가 반환된다

### Scenario 8: 파일 이름 변경 - 정상 케이스

- **Given**: 경로 `/test/old-name.md`에 파일이 존재하는 상태
- **When**: `rename_file("/test/old-name.md", "/test/new-name.md")` 커맨드를 호출하면
- **Then**: 파일이 new-name.md로 이름이 변경되고, old-name.md는 더 이상 존재하지 않는다

### Scenario 9: 파일 이름 변경 - 대상 경로에 파일 존재

- **Given**: `/test/source.md`와 `/test/target.md` 모두 존재하는 상태
- **When**: `rename_file("/test/source.md", "/test/target.md")` 커맨드를 호출하면
- **Then**: 에러가 반환되고, 두 파일 모두 원래 상태로 유지된다

### Scenario 10: 디렉토리 읽기 - 정상 케이스

- **Given**: `/test/docs/` 디렉토리에 `readme.md`와 `guide/` 하위 디렉토리가 존재하는 상태
- **When**: `read_directory("/test/docs/")` 커맨드를 호출하면
- **Then**: FileNode 배열이 반환되며, `readme.md`는 `is_directory: false`, `guide/`는 `is_directory: true`로 표시된다

### Scenario 11: 디렉토리 읽기 - 경로가 파일인 경우

- **Given**: `/test/file.md`가 파일(디렉토리가 아님)인 상태
- **When**: `read_directory("/test/file.md")` 커맨드를 호출하면
- **Then**: "Not a directory" 에러가 반환된다

### Scenario 12: 네이티브 디렉토리 대화상자

- **Given**: 애플리케이션이 실행 중인 상태
- **When**: `open_directory_dialog()` 커맨드를 호출하면
- **Then**: OS 네이티브 디렉토리 선택 대화상자가 표시된다

### Scenario 13: TypeScript IPC 래퍼 타입 안전성

- **Given**: TypeScript IPC 래퍼 함수가 정의된 상태
- **When**: `readFile` 함수를 잘못된 파라미터 타입으로 호출하면
- **Then**: TypeScript 컴파일러가 타입 에러를 발생시킨다

## Edge Cases

### EC-1: Path Traversal 공격 시도

- **Given**: 악의적인 경로 `../../etc/passwd`가 입력된 상태
- **When**: `read_file("../../etc/passwd")` 커맨드를 호출하면
- **Then**: "Invalid path" 에러가 반환되고, 허용 범위 밖의 파일에 접근하지 않는다

### EC-2: 매우 긴 파일 경로

- **Given**: 255자를 초과하는 파일 경로가 입력된 상태
- **When**: 해당 경로로 파일 연산을 시도하면
- **Then**: OS 수준의 적절한 에러 메시지가 반환된다

### EC-3: 특수 문자가 포함된 파일명

- **Given**: 파일명에 한글, 공백, 특수문자(`파일 (1).md`)가 포함된 상태
- **When**: 해당 파일에 대해 CRUD 연산을 수행하면
- **Then**: 모든 연산이 정상 동작한다

### EC-4: 빈 파일 읽기

- **Given**: 0바이트 크기의 빈 파일이 존재하는 상태
- **When**: `read_file`을 호출하면
- **Then**: 빈 문자열(`""`)이 정상 반환된다

### EC-5: 대용량 파일 (50KB+)

- **Given**: 50KB 이상의 마크다운 파일이 존재하는 상태
- **When**: `read_file`을 호출하면
- **Then**: 파일 내용이 정상 반환되며, 응답 시간이 200ms를 초과하지 않는다

### EC-6: 동시 파일 쓰기

- **Given**: 동일한 파일에 대해 두 개의 `write_file` 요청이 거의 동시에 발생한 상태
- **When**: 두 요청이 처리되면
- **Then**: 데이터 손상 없이 하나의 요청이 성공하고, 다른 요청은 에러를 반환하거나 순차 처리된다

### EC-7: 비-UTF-8 바이너리 파일

- **Given**: PNG 이미지 파일이 존재하는 상태
- **When**: `read_file`으로 해당 파일을 읽으려 시도하면
- **Then**: "File is not valid UTF-8" 에러가 반환된다

### EC-8: 심볼릭 링크

- **Given**: 심볼릭 링크가 포함된 디렉토리가 존재하는 상태
- **When**: `read_directory`를 호출하면
- **Then**: 심볼릭 링크는 결과에서 제외되거나 링크로 표시되며, 자동 추적하지 않는다

### EC-9: 디렉토리 삭제 시도

- **Given**: `/test/folder/`가 디렉토리인 상태
- **When**: `delete_file("/test/folder/")` 커맨드를 호출하면
- **Then**: "Cannot delete directory with delete_file" 에러가 반환된다 (디렉토리 삭제는 별도 커맨드 필요)

## Performance Criteria

| Operation | Target | Measurement Method |
|-----------|--------|--------------------|
| `read_file` (10KB) | < 50ms | Tauri IPC 왕복 시간 측정 |
| `read_file` (50KB) | < 200ms | Tauri IPC 왕복 시간 측정 |
| `write_file` (10KB) | < 100ms | 디스크 동기화 포함 측정 |
| `create_file` | < 50ms | IPC 왕복 시간 측정 |
| `delete_file` | < 50ms | IPC 왕복 시간 측정 |
| `rename_file` | < 50ms | 동일 볼륨 이동 기준 |
| `read_directory` (100 files) | < 50ms | FileNode 트리 생성 포함 |
| `read_directory` (1000 files) | < 200ms | Shallow listing 적용 |
| `open_directory_dialog` | N/A | OS 대화상자 표시 시간 제외 |

## Quality Gates

### QG-1: Rust 코드 품질

- [ ] `cargo clippy` 경고 0건
- [ ] `cargo test` 모든 테스트 통과
- [ ] 모든 public 함수에 doc comment 작성

### QG-2: 보안 검증

- [ ] Path traversal 공격 테스트 통과 (5가지 이상 패턴)
- [ ] 심볼릭 링크 추적 방지 테스트 통과
- [ ] Tauri capabilities 최소 권한 검증

### QG-3: TypeScript 타입 안전성

- [ ] `npx tsc --noEmit` 에러 0건
- [ ] IPC 래퍼 함수의 반환 타입이 Rust 커맨드와 일치
- [ ] `any` 타입 사용 0건

### QG-4: 테스트 커버리지

- [ ] Rust 파일 연산 코드 커버리지 >= 85%
- [ ] 정상 케이스 및 에러 케이스 모두 테스트
- [ ] 크로스 플랫폼 경로 처리 테스트 포함

### QG-5: 성능

- [ ] 모든 파일 연산이 Performance Criteria 목표 이내
- [ ] 대용량 디렉토리 (1000+ 파일) 성능 테스트 통과

## Definition of Done

- [ ] 7개의 Tauri IPC 커맨드가 모두 구현되고 등록되었다
- [ ] FileNode 모델이 Rust와 TypeScript 양측에서 동일한 구조로 정의되었다
- [ ] TypeScript IPC 래퍼 함수가 모든 커맨드에 대해 타입 안전하게 구현되었다
- [ ] 경로 유효성 검사 유틸리티가 path traversal을 차단한다
- [ ] 모든 Test Scenario가 통과한다
- [ ] 모든 Edge Case가 적절히 처리된다
- [ ] 모든 Quality Gate를 만족한다
- [ ] Tauri capabilities에 필요한 최소 권한만 설정되었다
