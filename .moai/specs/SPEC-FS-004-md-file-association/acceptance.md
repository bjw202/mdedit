# Acceptance Criteria: SPEC-FS-004

> 검증 계층 구분: **자동**(cargo test / vitest — CI 반복 가능) / **수동**(설치 빌드에서만 재현 가능한 OS 레벨 시나리오) / **코드 리뷰**(diff 속성 — 단위 테스트로 강제 불가). REQ↔AC는 1:1 매핑이다.

## Test Scenarios (Gherkin Given/When/Then)

### AC-001: 정적 등록 후보 노출 + 런타임 등록 부재 (REQ-001) — 수동 + 코드 리뷰

```gherkin
Given macOS와 Windows 각각에서 번들 설치 빌드를 설치했다 (targets "all" — NSIS/MSI, .app)
When .md 파일의 "연결 프로그램"(Windows) / "Open With"(macOS) 후보 목록을 확인한다
Then mdedit가 후보로 노출된다 (Windows ProgId 후보 등록 / macOS Info.plist CFBundleDocumentTypes)
And 코드베이스에 런타임 OS 파일 연결 변경 API 호출이 없음을 코드 리뷰로 확인한다
And bundle.fileAssociations의 ext가 ["md"] 단독임을 확인한다
```

검증: `npm run build` 후 양 OS 설치 + diff 리뷰 (`tauri.conf.json`, 런타임 등록 API 부재 grep). — `package.json`의 `build` 스크립트 = `tauri build` (`npm run tauri build` 스크립트는 존재하지 않음).

### AC-002: 미실행 상태 더블클릭 → 런치 + 워크스페이스 + 파일 (REQ-002) — 수동

```gherkin
Given mdedit가 실행 중이지 않다
And 워크스페이스로 열려 있던 다른 폴더 A의 이력(lastWatchedPath)이 존재한다 (또는 없다)
When 파일 탐색기/Finder에서 폴더 B의 note.md를 더블클릭한다
Then mdedit가 실행된다
And 폴더 B가 워크스페이스로 열린다 (탐색기 트리에 B 내용 표시 — 폴더 A가 아니라 B)
And note.md가 에디터에서 열린다
And 앱을 종료 후 재실행하면 폴더 B가 복원된다 (openFolderPath의 lastWatchedPath 영속)
```

검증: 양 OS 설치 빌드 수동 인수.

### AC-003: 비-.md 인자/URL 제외 매트릭스 (REQ-003) — 자동 cargo

```gherkin
Given file_open.rs의 순수 헬퍼 함수들이 존재한다
When 확장자/URL 매트릭스를 입력한다 — ".md", ".MD", "note.Md" / ".markdown", ".mdx", ".txt", 무확장자, "archive.tar.md" / file://a.md vs https://example.com/x.md / "-v" 등 "-" 시작 플래그와 .md 혼합 argv / 다중 .md 인자 argv (a.md b.md)
Then 대소문자 무시 .md 판정이 정확히 동작한다 (".md"/".MD"/"note.Md"/"archive.tar.md" → true, 나머지 → false)
And file:// 스킴의 .md만 수용하고 https 등 비-file URL은 무시한다
And "-" 시작 플래그는 스킵하고 그 뒤의 .md 인자를 찾아낸다
And 다중 .md 인자 argv는 첫 번째 .md만 수용하고 나머지는 폐기한다 (first-.md-only — 모든 진입 경로 공통, REQ-010)
And 어느 경로에서도 에러·패닉 없이 조용히 무시된다
```

검증: `cd src-tauri && cargo test` (file_open 인라인 매트릭스 테스트).

### AC-004: Windows 실행 중 전환 — 두 번째 창 없음 (REQ-004) — 수동 Windows

```gherkin
Given Windows 설치본이 실행 중이다 (워크스페이스 A 열림, dirty=false)
When 다른 폴더 B의 note2.md를 더블클릭한다
Then 두 번째 창/프로세스가 생성되지 않는다 (작업 관리자에서 mdedit 프로세스 1개)
And 기존 창이 포커스되며 워크스페이스가 B로 전환되고 note2.md가 열린다
But dirty=true 상태에서 동일 시도 시 기존 3버튼 미저장 모달이 뜨고, "저장 안 함" 선택 시 전환된다
```

검증: Windows 설치 빌드(NSIS) 수동 인수.

### AC-005: macOS 실행 중 Opened 처리 (REQ-005) — 수동 macOS

```gherkin
Given macOS 설치본이 실행 중이다
When Finder에서 다른 폴더의 .md를 더블클릭한다 (또는 우클릭 Open With → mdedit)
Then 새 프로세스가 생성되지 않고 기존 인스턴스가 재활성화된다 (Activity Monitor에 mdedit 프로세스 1개)
And 기존 창에서 워크스페이스가 전환되고 해당 파일이 열린다
```

검증: macOS 설치 빌드 수동 인수.

### AC-006: 아이콘 재클릭 → 기존 창 포커스 (REQ-006) — 수동 양 OS

```gherkin
Given 설치본이 실행 중이다 (워크스페이스 상태 무관)
When dock(macOS) / 작업표시줄(Windows)의 mdedit 아이콘을 다시 클릭한다 (.md 인자 없음)
Then 두 번째 프로세스가 시작되지 않고 기존 "main" 창이 포커스된다
```

검증: 양 OS 수동 인수 (싱글 인스턴스 의도된 동작 변경 — research §5.4).

### AC-007: 같은 폴더 스킵 — openFile만 (REQ-007) — 자동 vitest

```gherkin
Given useFileStore의 watchedPath가 "C:\Docs"로 시딩되어 있다
When handleExternalOpen이 { path: "C:\Docs\other.md", dir: "c:/docs/" } 로 호출된다 (구분자·대소문자·트레일링 슬래시가 달라도 정규화 동일)
Then readDirectory(openFolderPath 경유)가 재호출되지 않는다 — 트리 리로드·워처 재시작 없음
And openFile만 수행되어 readFile("C:\Docs\other.md")가 호출된다
Given 같은 폴더 조건 + dirty=true 상태
When 외부 오픈이 도착한다
Then 가드 모달이 뜬다 (requestGuardedAction 경유 — REQ-008: 가드 없는 openFile이 setDirty(false)+콘텐츠 교체로 미저장 편집을 조용히 버리지 않는다)
```

검증: `npx vitest run src/test/SPEC-FS-004-external-open-flow.test.tsx` (+ `isSameWorkspaceDir` 단위 매트릭스는 external-open.test.ts).

### AC-008: dirty 가드 래핑 — 즉시 실행 / 모달 경유 / 취소 중단 (REQ-008) — 자동 vitest (가드 fake)

```gherkin
Given 가드 fake를 사용한다 (즉시 실행형 / 캡처형)
When dirty=false 상태에서 외부 오픈이 도착한다
Then 모달 없이 즉시 폴더 전환+파일 오픈이 실행된다
When dirty=true 상태에서 외부 오픈이 도착한다
Then requestGuardedAction을 경유하여 모달이 뜨고, 실행(저장/저장 안 함) 선택 시 전환이 수행된다
When 모달에서 취소한다
Then 어떤 파일 IPC(readFile 등)도 호출되지 않고 중단된다
Given dirty=false 클린 상태에서 폴더 B의 외부 오픈 전환이 실행 중이다
When 그 실행 중 폴더 C의 두 번째 외부 오픈이 take된다 (연속 오픈 버스트 — 서로 다른 폴더)
Then 두 전환은 동시에 인터리브 실행되지 않고, 최종 상태는 정확히 하나의 일관된 워크스페이스+파일 쌍이다 (C 우선 — single-flight latest-wins)
```

검증: `npx vitest run src/test/SPEC-FS-004-external-open-flow.test.tsx` (가드 fake 기반).

### AC-009: 모달 열림/저장 중 폐기 — 큐잉 없음 (REQ-009) — 자동 vitest

```gherkin
Given 가드 fake가 모달 열림 상태(open=true 또는 busy)를 시뮬레이션한다
When 외부 오픈 이벤트가 도착한다
Then 해당 요청은 대기열에 저장되지 않고 폐기된다 (pendingAction 미추가, 파일 IPC 미호출)
And 이는 의도된 동작이다 — SPEC-FS-003 REQ-024/025 계약 승계 (버그 아님)
```

검증: `npx vitest run src/test/SPEC-FS-004-external-open.test.ts src/test/SPEC-FS-004-external-open-flow.test.tsx` (가드 fake 재진입 시나리오).

### AC-010: macOS 다중 url — 첫 .md 1개만 (REQ-010) — 자동 cargo

```gherkin
Given first_md_url 헬퍼에 [file:///a/first.md, file:///a/second.md, https://example.com]이 입력된다
When 호출한다
Then file:///a/first.md 하나만 반환되고 나머지는 폐기된다
```

검증: `cd src-tauri && cargo test` (first_md_url 다중·혼합 매트릭스).

### AC-011: 런치 레이스 — 드레인 정확히 1회 + 복원 스킵 (REQ-011) — 자동 vitest

```gherkin
Given takePendingOpenFile mock이 최초 1회 Some(payload)를 반환하고 이후 null을 반환한다
When 마운트 시 consumePendingOpenFile()이 호출된다
Then take_pending_open_file은 정확히 1회만 호출된다 (드레인 1회 — 이중 처리 없음)
And 반환값이 true(pending 존재)이면 lastWatchedPath 복원 경로의 openFolderPath가 호출되지 않는다
And 반환값이 false(pending 없음)이면 기존 복원 경로가 그대로 실행된다
And 라이브 이벤트 핸들러는 이벤트 페이로드를 직접 소비하지 않고 take를 수행해 반환값만 처리한다 (atomic-take — REQ-011)
And ipc 호출이 실패(reject)하면 false를 반환해 복원으로 폴백한다
Given 마운트 효과의 take IPC가 진행 중(in flight)이다
When 그 사이에 'open-file' 이벤트가 도착해 라이브 핸들러가 자체 take를 수행한다
Then 정확히 1회의 전환만 발생한다 (openFolderPath·openFile 시퀀스 각 1회 — 두 take 중 하나만 Some를 받는다, 인터리브 이중 처리 없음)
```

검증: `npx vitest run src/test/SPEC-FS-004-external-open.test.ts`.

### AC-012: 파일 부재/디렉터리/상대경로/폴더 실패 중단 (REQ-012) — 자동 cargo(temp-dir) + vitest

```gherkin
Given temp 디렉터리에 실제 .md 파일을 생성한 테스트 환경 (cargo)
When resolve_md_path에 존재하는 .md 절대경로 / 존재하지 않는 경로 / .md라는 이름의 디렉터리 / 상대경로+cwd 조합을 입력한다
Then 존재하는 .md만 Some({path, dir})를 반환하고 나머지는 None (조용히 무시)
Given 프론트 합성 흐름 테스트 (vitest)
When openFolderPath(dir)가 reject하는 상황에서 외부 오픈이 실행된다
Then openFile(readFile)이 시도되지 않고 전체가 중단된다 (폴더가 없으면 파일도 없다)
```

검증: `cd src-tauri && cargo test` (temp-dir 기반) + `npx vitest run src/test/SPEC-FS-004-external-open-flow.test.tsx`.

### AC-013: \\?\ 부재 + 정규화 동일성 (REQ-013) — 자동 cargo `#[cfg(windows)]` + vitest

```gherkin
Given Windows 전용 cargo 테스트 (#[cfg(windows)])
When resolve_md_path가 temp .md 파일로 반환한 {path, dir}을 검사한다
Then 어느 필드에도 "\\?\" 접두사가 없다 (원본 구분자 보존 — canonicalize 미적용)
Given vitest isSameWorkspaceDir 매트릭스
When Windows 조합 "C:\Docs" vs "c:/docs/" / "C:\Docs" vs "C:\Docs2" / watchedPath null과, POSIX 조합 "/Users/a/Docs" vs "/Users/a/docs"를 비교한다
Then Windows 조합은 구분자·트레일링 슬래시·대소문자 접기 정규화 기준으로 전자는 true, 후자들은 false를 반환한다
And POSIX 조합은 대소문자가 다르면 false를 반환한다 (대소문자 접기는 Windows 한정 — macOS 대소문자 구분 볼륨에서 서로 다른 디렉터리를 동일시하지 않는다, REQ-007)
```

검증: Windows 머신에서 `cd src-tauri && cargo test` + `npx vitest run src/test/SPEC-FS-004-external-open.test.ts` (정규화 매트릭스는 비-Windows에서도 실행).

### AC-014: 비-Tauri 완전 no-op + 기존 suite 무영향 (REQ-014) — 자동 vitest

```gherkin
Given __TAURI_INTERNALS__가 없는 jsdom 환경 (기존 테스트 환경과 동일)
When useExternalOpenFile이 마운트되고 외부 오픈 관련 경로가 실행된다
Then listen()이 호출되지 않고 takePendingOpenFile()도 호출되지 않는다
And consumePendingOpenFile()은 false를 반환한다 (기존 lastWatchedPath 복원 경로 유지)
And 전체 기존 테스트 스위트(app.test.tsx 포함)가 green을 유지한다
```

검증: `npm run test` 전체 + Playwright e2e 스모크 (`npm run test:e2e` — 무영향 확인).

## Edge Cases

| Edge Case | Expected Behavior | Test |
|---|---|---|
| 미저장 변경(dirty) 중 외부 오픈 | 기존 3버튼 모달 후 전환. 모달 중 재요청은 폐기(의도됨) | AC-008/009 |
| 같은 폴더의 다른 .md | 트리 깜빡임·워처 재시작 없이 파일만 교체 | AC-007 |
| stage된 파일이 그사이 삭제됨 | 폴더 열기는 성공, readFile 실패는 openFile 기존 binary 폴백이 흡수 | AC-012 변형 |
| 폴더 자체가 삭제됨 | openFolderPath 실패 → openFile 시도 없이 전체 중단 | AC-012 |
| `.tar.md` | 확장자 판정상 .md → 수용 (문서화된 판정) | AC-003 |
| Windows dev: `target/debug/mdedit.exe C:\path\notes.md` | 런치 argv 경로로 동작 (플래그 필터+확장자 검사). 단 설치본 실행 중이면 dev가 포워드 후 종료됨 | 수동 (M3) |
| macOS 이벤트가 webview 준비 전 도착 | emit은 유실되나 AppState 슬롯에 저장 → 마운트 take가 드레인 | AC-011 |
| lastWatchedPath 없는 첫 실행 + 외부 오픈 | 복원 경로 자체가 no-op — 단일 if-else 흐름에서 외부 오픈만 실행 | AC-011 변형 |
| 다른 .md 기본 앱이 UserChoice 소유한 Windows | 설치자는 후보 등록만 — "연결 프로그램" 1회 선택 필요 (OS 정책) | AC-001 (FAQ 안내) |

## Quality Gate Criteria

- **cargo test**: `cd src-tauri && cargo test` 전체 green — 신규 file_open(헬퍼 매트릭스 + `#[cfg(windows)]` 접두사 부재)·app_state(set/take 클리어)·pending_open(payload) 인라인 포함
- **vitest**: `npm run test` 전체 green — 신규 2 파일 + 기존 suite(app.test.tsx 포함) 회귀 없음
- **TypeScript**: `npm run typecheck` 0 에러
- **ESLint**: `npm run lint` 0 에러 0 경고 (`--max-warnings 0`)
- **커버리지**: 신규 자동화 범위(순수 헬퍼·훅 메커니즘·합성 흐름)는 프로젝트 목표(quality.yaml 85%) 준용 — OS 연동 자체(수동 계층)는 커버리지 측정 불가 영역으로 명시
- **성능**: 런치 경로 추가 작업은 argv/urls 파싱 1회(O(인자 수)) — 무시 가능 수준, 별도 수치 게이트 없음(수동 인수에서 시작 지연 무통과 확인)
- **수동 인수**: AC-001/002/004/005/006은 설치 빌드에서만 재현 가능 — M3 게이트, 결과·환경(OS·빌드 버전) 기록 의무

## Test Strategy Layer (정직한 범위 표시)

| 검증 항목 | 자동 (cargo/vitest) | 수동 (설치 빌드) | 코드 리뷰 (diff) |
|---|---|---|---|
| REQ-001 정적 등록만 | — | AC-001 (양 OS 후보 노출) | O (fileAssociations 단독·런타임 API 부재) |
| REQ-002 런치+워크스페이스 | — | AC-002 | — |
| REQ-003 제외 매트릭스 | AC-003 (cargo) | — | — |
| REQ-004 Win 실행 중 포워드 | — | AC-004 | — |
| REQ-005 macOS Opened | — | AC-005 | — |
| REQ-006 항상 포커스 | — | AC-006 | — |
| REQ-007 같은 폴더 스킵 | AC-007 | — | — |
| REQ-008 dirty 가드 | AC-008 (가드 fake) | AC-004 변형(dirty) | — |
| REQ-009 모달 중 폐기 | AC-009 | 수동 변형 | — |
| REQ-010 첫 .md만 | AC-010 (cargo) | — | — |
| REQ-011 런치 레이스 | AC-011 | — | — |
| REQ-012 부재/중단 | AC-012 (cargo+vitest) | — | — |
| REQ-013 \\?\ 금지 | AC-013 (cargo+vitest) | — | — |
| REQ-014 비-Tauri no-op | AC-014 (전체 suite) | — | — |
| useFileSystem/useUnsavedChangesGuard 무변경 | 기존 suite green | — | O (diff 없음 확인) |
| capabilities/main.json 무변경 | — | — | O |

**참고**: "무변경" 항목은 단위 테스트로 강제 불가한 git diff 속성이다 — 리뷰 계층으로 분리해 명시한다 ([feedback-spec-verifiable-requirements] 패턴 2). OS 프로세스 기동/포워드는 jsdom으로 재현 불가하므로 수동 계층에 둔다 (research §5.9).

## Definition of Done

- [ ] **M1**: cargo test 전체 green (신규 인라인 테스트 포함) — take_pending_open_file이 기존 generate_handler 목록 끝에 등록됨
- [ ] **M2**: vitest 신규 2 파일 + 전체 suite green / typecheck 0 / lint 0
- [ ] **M3**: tauri.conf.json fileAssociations 반영 + 양 OS 빌드·설치 + 수동 인수 5종(AC-001/002/004/005/006) 결과 기록
- [ ] **TDD RED**: 자동화 대상 신규 테스트의 사전 실패 출력이 verbatim으로 보고됨
- [ ] **무변경 항목 (리뷰)**: useFileSystem.ts, useUnsavedChangesGuard.ts, capabilities/main.json — diff 없음
- [ ] **@MX**: mx_plan 표기 태그(ANCHOR 후보·WARN·NOTE 2건·SPEC 태그 갱신) 적용 — 한국어 설명
- [ ] **문서**: README / USER_GUIDE(§1 + §6 FAQ — UserChoice 1회 선택·모달 중 폐기 안내) / CHANGELOG 동기화
- [ ] **수동 인수 기록**: 각 시나리오의 OS·빌드 버전·결과가 progress 기록에 남음

## Traceability

| AC | REQ | 검증 계층 | Milestone |
|----|-----|----------|-----------|
| AC-001 | REQ-FS-004-001 | 수동 + 리뷰 | M3 |
| AC-002 | REQ-FS-004-002 | 수동 | M3 |
| AC-003 | REQ-FS-004-003 | 자동 cargo | M1 |
| AC-004 | REQ-FS-004-004 | 수동 Windows | M3 |
| AC-005 | REQ-FS-004-005 | 수동 macOS | M3 |
| AC-006 | REQ-FS-004-006 | 수동 양 OS | M3 |
| AC-007 | REQ-FS-004-007 | 자동 vitest | M2 |
| AC-008 | REQ-FS-004-008 | 자동 vitest | M2 |
| AC-009 | REQ-FS-004-009 | 자동 vitest | M2 |
| AC-010 | REQ-FS-004-010 | 자동 cargo | M1 |
| AC-011 | REQ-FS-004-011 | 자동 vitest | M2 |
| AC-012 | REQ-FS-004-012 | 자동 cargo + vitest | M1 + M2 |
| AC-013 | REQ-FS-004-013 | 자동 cargo + vitest | M1 + M2 |
| AC-014 | REQ-FS-004-014 | 자동 vitest | M2 |
