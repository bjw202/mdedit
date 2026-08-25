# SPEC-FS-004 Compact — .md 파일 연동 (run-phase 로딩용)

> spec.md의 REQ 전체 + AC 요약 + 수정 파일 + Exclusions만 추출한 요약본 (~30% 절약). 전체 맥락·히스토리·설계 근거는 `spec.md` / `research.md` / `plan.md` 참조. 상위 전제 4건(정적 등록만 / .md만 / 단일 창 / 첫 .md만)은 재론 금지. (v1.1.0 — plan-audit PASS 이후 개정 반영: REQ-008 가드 전체 동작 래핑·REQ-011 atomic-take·REQ-007 대소문자 접기 Windows 한정·REQ-004 Linux unverified-by-design·REQ-010 first-.md-only 전 경로)

## Requirements (GEARS — 전문)

### REQ-FS-004-001 [Ubiquitous]

The .md 파일 연동 shall 설치 시 정적 등록으로만 수행된다 — `bundle.fileAssociations`의 `ext`는 `["md"]` 단독이며, 앱은 런타임에 OS 파일 연결을 변경하는 코드를 포함하지 않는다.

### REQ-FS-004-002 [Event-driven]

**When** OS가 .md 파일 경로로 앱을 실행하거나 활성화하면, the app shall 해당 파일의 부모 폴더를 기존 폴더-열기 흐름(파일 트리 로드·워처 시작·asset 스코프 등록·`lastWatchedPath` 영속)으로 워크스페이스화한 뒤, 해당 .md 파일을 에디터에서 연다.

### REQ-FS-004-003 [Event-detected]

**When** .md가 아닌 인자 또는 URL이 진입하면(확장자 판정은 대소문자 무시, 비-`file://` URL 포함), the parser shall 모든 진입 경로(런치 argv / single-instance argv / macOS Opened urls)에서 이를 조용히 무시한다. `-`로 시작하는 플래그 인자는 확장자 검사 전에 스킵한다.

### REQ-FS-004-004 [Event-driven]

**When** Windows/Linux에서 앱 실행 중 두 번째 프로세스가 .md 인자를 실고 시작되면, the app shall single-instance 플러그인(빌더 체인의 첫 번째 플러그인으로 등록)을 통해 argv를 기존 인스턴스로 포워드하고 두 번째 프로세스는 종료한다 — 두 번째 창을 띄우지 않는다. Linux 포워딩은 균일 등록으로 따라오나 검증 대상이 아니다(unverified-by-design — AC-004는 Windows 한정).

### REQ-FS-004-005 [Event-driven]

**When** macOS에서 실행 중인 앱으로 .md 파일이 열리면, the app shall OS의 번들 앱 재활성화에 따라 `RunEvent::Opened` 이벤트로 기존 인스턴스에서 이를 처리한다.

### REQ-FS-004-006 [Event-driven]

**When** single-instance 콜백이 활성화되면, the app shall 전달된 argv에 유효한 .md 존재 여부와 무관하게 항상 기존 `"main"` 창에 포커스를 준다.

### REQ-FS-004-007 [State-driven]

**While** 외부 오픈 대상 dir이 현재 워크스페이스와 같은 폴더이면(경로 구분자 통일·트레일링 슬래시 제거 후 동일성 판정 — 대소문자 접기는 **Windows에서만** 적용하고 macOS/POSIX는 정확 비교하여 대소문자 구분 볼륨의 서로 다른 디렉터리를 동일시하지 않는다), the app shall `openFolderPath`를 스킵하고 `openFile`만 수행한다 — 트리 리로드·워처 재시작 없이 파일만 교체한다. 오판 방향은 실패-안전이다(거짓 음성 → 폴더 경유 idempotent 재오픈일 뿐, 데이터 손실 없음).

### REQ-FS-004-008 [Event-driven]

**When** 외부 오픈 시점의 `dirty`가 true이면, the app shall 외부 오픈 동작 **전체**를 `guard.requestGuardedAction`으로 래핑하여 기존 3버튼 미저장 모달을 띄운다 — 대상이 다른 폴더(폴더 교체 + 파일 오픈)이든 REQ-007의 같은 폴더 스킵 경로(`openFile`만)이든 가드는 동작 전체를 감싼다. `openFile`은 진입 즉시 `setDirty(false)`로 초기화하고 콘텐츠를 교체하므로, 가드 없는 같은 폴더 경로는 미저장 편집을 조용히 버리게 된다(데이터 유실 방지). **When** `dirty`가 false이면 모달 없이 즉시 실행한다.

### REQ-FS-004-009 [Event-detected]

**When** 가드 모달이 열려 있거나 저장이 진행 중인 상태에서 외부 오픈 요청이 도착하면, the app shall 해당 요청을 폐기한다 — 큐잉하지 않는다 (SPEC-FS-003 REQ-024/025 계약의 일관된 승계이며, 의도된 동작이다).

### REQ-FS-004-010 [Event-detected]

**When** 어느 진입 경로에서든 다중 .md가 한 번에 전달되면(macOS `RunEvent::Opened`의 다중 url, Windows/Linux 런치 argv·single-instance argv의 다중 .md 인자), the app shall 첫 번째 .md 1개만 수용하고 나머지는 폐기한다 — first-.md-only는 모든 진입 경로에 공통 적용된다.

### REQ-FS-004-011 [Event-driven]

**When** 이벤트 emit이 프론트 리스너 등록 전에 도착하면(런치 레이스), the app shall 페이로드를 `AppState.pending_open_file` 슬롯에 저장하고, 프론트 마운트 시 `take_pending_open_file()`으로 정확히 1회 드레인하며, 이 드레인은 `lastWatchedPath` 시작 복원에 우선한다(경쟁하는 두 `openFolderPath` 호출을 방지하는 단일 if-else 흐름). `'open-file'` 이벤트는 **통지(notification)일 뿐**이다 — 모든 소비자(마운트 효과와 라이브 이벤트 핸들러)는 이벤트 페이로드를 직접 소비하지 않고 `take_pending_open_file()`을 수행해 **반환된 값만** 처리한다(atomic-take 계약 — take IPC 진행 중 이벤트가 도착해도 이중 처리가 구조적으로 불가능). 새 페이로드가 스테이징되면 기존 슬롯을 덮어쓴다(latest-wins — 이전 요청 폐기, REQ-009 폐기 철학과 일관).

### REQ-FS-004-012 [Event-detected]

**When** 대상 .md 파일이 존재하지 않으면 조용히 무시한다(에러 표시 없음). **When** 스테이징 이후 폴더 열기가 실패하면, the app shall `openFile`을 시도하지 않고 전체를 중단한다.

### REQ-FS-004-013 [Ubiquitous]

The dir 계산 shall `Path::parent()`만 사용하며, 프론트엔드에 넘기는 경로에 `canonicalize`를 절대 적용하지 않는다 — Windows `std::fs::canonicalize`의 `\\?\` 확장 경로 접두사가 프론트 `watchedPath` 문자열 비교를 영원히 실패시키고 localStorage `lastWatchedPath`를 오염시키는 함정(`directory_ops.rs:112-125` 선례)을 재발시키지 않기 위함이다.

### REQ-FS-004-014 [Capability gate]

**Where** Tauri 런타임이 부재하면(jsdom·Playwright·브라우저 dev 서버), the `useExternalOpenFile` hook shall 완전 no-op으로 동작한다 — 리스너 등록·IPC 호출 모두 발생하지 않으며 기존 테스트 스위트에 영향을 주지 않는다.

## AC 요약

| AC | REQ | 계층 | 요약 |
|----|-----|------|------|
| AC-001 | 001 | 수동+리뷰 | 양 OS 설치 후 .md "연결 프로그램"/Open With 후보에 mdedit 노출 + ext ["md"] 단독·런타임 등록 API 부재 리뷰 |
| AC-002 | 002 | 수동 | 미실행 더블클릭 → 런치 + 부모 폴더 워크스페이스 + 파일 열림 + 재실행 시 폴더 복원 |
| AC-003 | 003 | 자동 cargo | 제외 매트릭스 — 대소문자 .md 판정 / 비-file:// URL 무시 / `-` 플래그 스킵 / 다중 .md argv 첫 .md만 |
| AC-004 | 004 | 수동 Win | 실행 중 더블클릭 → 2창 없이 기존 창 전환(dirty 시 모달 포함) |
| AC-005 | 005 | 수동 macOS | 실행 중 Open With → 기존 인스턴스 재활성화 처리(프로세스 1개) |
| AC-006 | 006 | 수동 양OS | 아이콘 재클릭 → 기존 "main" 창 포커스(.md 유무 무관) |
| AC-007 | 007 | 자동 vitest | 같은 폴더(정규화 동일) → readDirectory 재호출 없이 readFile만; 같은 폴더+dirty=true → 가드 모달(동작 전체 래핑 — 무음 교체 없음) |
| AC-008 | 008 | 자동 vitest | dirty=false 즉시 실행 / dirty=true 모달 경유 / 취소 중단 / 연속 오픈 버스트 → 단일 일관 상태(latest-wins) (가드 fake) |
| AC-009 | 009 | 자동 vitest | 모달/저장 중 외부 오픈 폐기 — 큐잉 없음(의도된 동작) |
| AC-010 | 010 | 자동 cargo | Opened 다중 url → 첫 .md 1개만 |
| AC-011 | 011 | 자동 vitest | 런치 레이스 — take 드레인 1회 + true 시 lastWatchedPath 복원 스킵 + atomic-take(이벤트 페이로드 직접 소비 금지) + take 인플라이트 인터리빙 → 전환 정확히 1회 + ipc 실패 시 false 폴백 |
| AC-012 | 012 | 자동 cargo+vitest | .md 부재/디렉터리/상대경로+cwd 무시; 폴더 열기 실패 시 openFile 없이 전체 중단 (temp-dir) |
| AC-013 | 013 | 자동 cargo+vitest | 반환 경로 `\\?\` 부재(원본 구분자 보존) + isSameWorkspaceDir 정규화 동일성(대소문자 접기 Windows 한정 — POSIX 정확 비교) |
| AC-014 | 014 | 자동 vitest | 비-Tauri 완전 no-op(listen·take 미호출, consume false) + 기존 suite green |

## 수정 파일 (Delta)

- [MODIFY] `src-tauri/tauri.conf.json` — bundle.fileAssociations(ext ["md"], role Editor)
- [MODIFY] `src-tauri/Cargo.toml` — `tauri-plugin-single-instance = "2"` (유일 신규 의존성)
- [NEW] `src-tauri/src/models/pending_open.rs` + [MODIFY] `models/mod.rs` — `PendingOpenFile { path, dir }`
- [MODIFY] `src-tauri/src/state/app_state.rs` — `pending_open_file: Mutex<Option<PendingOpenFile>>` + 인라인 테스트
- [NEW] `src-tauri/src/commands/file_open.rs` + [MODIFY] `commands/mod.rs` — 순수 헬퍼 4종 + `stage_pending_open` + `take_pending_open_file` 커맨드
- [MODIFY] `src-tauri/src/lib.rs` — (a) single-instance 체인 첫 등록 (b) setup 런치 argv (c) `.build().run(Opened)` + 커맨드를 기존 generate_handler 목록 끝에 추가
- [MODIFY] `src/lib/tauri/ipc.ts` — `PendingOpenFile` 인터페이스 + `takePendingOpenFile()` 래퍼
- [NEW] `src/hooks/useExternalOpenFile.ts` — 리스너(atomic-take: 이벤트는 통지, take 반환값만 처리) + `__TAURI_INTERNALS__` 가드 + `isSameWorkspaceDir`(대소문자 접기 Windows 한정) + `consumePendingOpenFile()` + 인플라이트 직렬화(single-flight latest-wins)
- [MODIFY] `src/App.tsx` — `handleExternalOpen`(가드가 동작 전체를 래핑 — 같은 폴더 스킵 경로 포함) + 복원 이펙트 단일 if-else 교체 (destructure의 `openFile`은 현재 트리에 이미 존재 — 실측 App.tsx:16)
- [NEW] `src/test/SPEC-FS-004-external-open.test.ts` / `src/test/SPEC-FS-004-external-open-flow.test.tsx`
- [MODIFY] README / USER_GUIDE(§1·§6 FAQ) / CHANGELOG
- [EXISTING 무변경] `useFileSystem.ts` / `useUnsavedChangesGuard.ts` / `capabilities/main.json` / `src/test/app.test.tsx`(실행 확인만)

## Exclusions (Out of Scope)

### Out of Scope — 다른 확장자 파일 연동

- `.markdown`·`.mdx` 등 그 외 확장자의 정적 등록·런타임 수용 모두 제외 (사용자 지시 — `.md`만)

### Out of Scope — 앱 내 "기본 프로그램으로 설정" 버튼

- 사용자 결정(2026-08-25)으로 제외 — future-extension 노트만. Windows UserChoice 1회 선택 UX는 OS 정책 준수 사항 (FAQ 안내)

### Out of Scope — 다중 창

- 단일 창/단일 워크스페이스 모델 유지 — 파일별 창 분리·멀티윈도우 미취급

### Out of Scope — Linux 공식 지원

- 코드는 플랫폼 균일 유지하나 Linux 데스크톱 환경별 등록 동작은 검증 대상 아님 (수동 인수 macOS+Windows 한정)

### Out of Scope — 모달 중 요청 큐잉

- 대기열 저장·순차 재생 제외 — 폐기가 계약 (REQ-009, SPEC-FS-003 REQ-024/025 승계)
