# Implementation Plan: SPEC-FS-004

## §A Context (Brownfield — 실측 기준)

- 작업 루트: `/Users/byunjungwon/Dev/my-project-01/markdown-editor-rust` (main 브랜치, v0.15.0 개발 중)
- SPEC 산출물: `.moai/specs/SPEC-FS-004-md-file-association/{spec,plan,acceptance,research}.md` (research.md — 파일:라인 앵커 16종 실측, 2026-08-25)
- Tier M / GEARS REQ 14건 / AC 14건 (1:1 매핑). 사용자 확정 4대 전제(정적 등록만 / .md만 / 단일 창 / 첫 .md만)는 재론 금지.
- 방법론: TDD (RED-GREEN-REFACTOR) — 자동화 가능 단위(순수 헬퍼·훅 메커니즘)는 사전 실패 테스트 우선. OS 연동 자체는 설치 빌드 수동 인수로만 검증 가능.

### 사실 검증 노트 (2026-08-25 현재 트리 실측 — run-phase 시작 시 재확인)

계획 단계 문서 간 수치 불일치가 있었으므로 아래 실측값을 기준으로 한다 (라인 번호는 드리프트 가능 — 항상 코드 기준으로 재확인):

1. **`src/App.tsx:16`** = `const { openFolderPath, openFile } = useFileSystem();` — **`openFile`이 이미 destructure되어 있다.** 구현 계획 문서(원안)의 "line 19 — openFile 추가"는 불필요. run-phase에서 훅 통합 시 destructure에 `openFile`이 없으면 그때만 추가한다.
2. **`src-tauri/src/lib.rs:48-73`** `generate_handler!` — 기존 등록 커맨드 수는 코드 기준으로 세어 확인한다 (2026-08-25 실측 24개). `take_pending_open_file`은 **기존 generate_handler 목록 끝에 추가**한다 — 정확한 순번을 문서에 고정하지 않는다.
3. `lib.rs:74`는 이벤트 클로저 없는 `.run(tauri::generate_context!())` — `RunEvent::Opened` 수신을 위해 `.build(ctx).run(closure)` 형태로 전환해야 한다.
4. `tauri.conf.json` `bundle`(`:29-40`)에 `fileAssociations` 없음, `targets: "all"`(NSIS+MSI 양측 빌드), `identifier: "com.mdedit.app"`(dev/설치 빌드 공유 — §B 리스크 참조).

### 재사용 계약 (Reference — 이 계약들을 깨지 않는다)

- Reference: `src/hooks/useFileSystem.ts:92-114` — `openFolderPath`: readDirectory → setWatchedPath → setFileTree → `setLastWatchedPath`(localStorage 영속) → registerAssetScope(비차단) → startWatch(비차단). 실패 시 throw — 호출자가 catch해 폴백 결정. **외부 오픈이 이 함수를 호출하는 것만으로 "다음 실행 시 외부 오픈된 폴더 복원"이 자동 성립** (별도 영속 로직 불필요).
- Reference: `src/hooks/useFileSystem.ts:136-247` — `openFile` 가드-free 순수 동작(진입 즉시 `setDirty(false)`, 예외는 내부 흡수). 미저장 가드는 호출측 래핑(SPEC-FS-003 REQ-012/028).
- Reference: `src/hooks/useUnsavedChangesGuard.ts:110-125` — `requestGuardedAction(action: () => void | Promise<void>)`: 모달/저장 중 재요청 폐기(REQ-024/025), dirty=false 즉시 실행(REQ-026), async action 지원.
- Reference: `src/hooks/useFileWatcher.ts:62-80` — `onFileChangedRef` 콜백 안정화 + `listen`/unlisten cleanup 패턴 (신규 훅이 그대로 따름).
- Reference: `src/hooks/useWindowCloseGuard.ts:35-66` — `__TAURI_INTERNALS__` 부재 시 완전 no-op + try/catch 이중 방어 (jsdom/Playwright 무영향 보장).
- Reference: `src-tauri/src/state/app_state.rs:27-55` — `Mutex<Option<T>>` 필드 + `AppState::new()` 초기화 + `#[cfg(test)]` 인라인 테스트 패턴.
- Reference: `src-tauri/src/models/file_event.rs:17-31` — `#[derive(Debug, Clone, serde::Serialize)]` + doc comment + `new()` payload 패턴.
- Reference: `src-tauri/src/commands/directory_ops.rs:112-125` — Windows `\\?\` canonicalize 함정의 선례 처리 (strip_prefix 방어가 존재하나, 본 SPEC은 애초에 canonicalize 자체를 금지).
- Reference: `src/lib/tauri/ipc.ts` — 타입드 invoke 래퍼 + JSDoc + `@MX:NOTE`/`@MX:SPEC` 컨벤션 (테스트 모킹 지점 단일화 — SPEC-EXPORT-002 REQ-006 선례).

## §B Known Issues (사전 주입)

1. **Windows `\\?\` 함정 (REQ-013)** — `dir` 계산에 canonicalize를 쓰면 같은 폴더 판정 영구 실패 + localStorage `lastWatchedPath` 오염. `Path::parent()`만 사용하고 Rust `#[cfg(windows)]` 테스트(접두사 부재 어서션) + 프론트 `isSameWorkspaceDir` 단위 테스트로 이중 방어.
2. **dev/설치 빌드 식별자 공유** — `com.mdedit.app` 공유로 설치본 실행 중 `tauri dev`를 띄우면 dev 프로세스가 포워드 후 즉시 종료된다. 개발 중 설치본을 종료해야 함. 개발자 FAQ/문서화 필수.
3. **Windows UserChoice 해시 보호** — 설치자의 ProgId 등록은 후보 등록이지 기존 기본 앱의 조용한 대체가 아니다. 타 앱이 .md 기본인 상태에서는 1회 "연결 프로그램" 선택 필요 — OS 정책 준수, 한계로 수용 (USER_GUIDE §6 FAQ).
4. **NSIS+MSI 동시 등록** — `targets: "all"`이 양쪽 모두 빌드해 동일 ProgId 기록. 연속 설치(NSIS→MSI)는 미지원 시나리오: NSIS 기준 검증 + MSI 스팟체크. 제거 시 등록 해제 1회 확인.
5. **런치 레이스 전제** — Tauri emit은 큐잉되지 않고 등록된 리스너에만 즉시 전달된다. 유실은 "마운트 전 도착"뿐이며 AppState 슬롯 + 마운트 take가 커버. 이 전제를 코드 주석(@MX:NOTE)으로 남겨 미래 수정 시 실수를 방지한다.
6. **가드 재진입 폐기 오보고 위험 (REQ-009)** — 모달 열림 중 외부 오픈 폐기가 "더블클릭했는데 무반응" 버그로 오보고될 수 있다. SPEC REQ + USER_GUIDE FAQ + 수동 인수 시나리오(AC-009 자동 + 수동 변형)에 의도된 동작으로 명시.
7. **기존 테스트 회귀** — `src/test/app.test.tsx`는 `invoke → undefined` mock 사용 → `takePendingOpenFile()`이 falsy를 반환해 기존 복원 경로가 유지되어야 한다 (실행으로 확인 — AC-014). Playwright e2e는 `__TAURI_INTERNALS__` 가드로 무영향 예상 — 게이트로 확인.
8. **훅 순서 = 이펙트 순서** — `useExternalOpenFile`을 guard 인스턴스 뒤·복원 이펙트 앞에 배치해야 마운트 take가 복원보다 먼저 확정된다.

## §C Pre-flight (run-phase 시작 전 확인)

```bash
# 1. 분기 + baseline
git branch --show-current && git rev-parse HEAD

# 2. 기존 테스트 baseline (NEW vs 기존 결함 구분)
cd src-tauri && cargo test 2>&1 | tail -5
npm run test 2>&1 | tail -5
npm run typecheck && npm run lint

# 3. 계약 앵커 재확인 (드리프트 감지 — 수치는 코드 기준)
grep -n "openFolderPath" src/App.tsx | head -3          # destructure에 openFile 포함 여부
grep -n "generate_handler" src-tauri/src/lib.rs         # 커맨드 등록 위치
grep -n "fileAssociations" src-tauri/tauri.conf.json    # (없어야 정상 — 추가 전)
```

## §D Constraints (PRESERVE — 위반 금지)

- `src/hooks/useFileSystem.ts` **무변경** — `openFolderPath`/`openFile` 계약 재사용 (openFile에 가드 삽입 금지)
- `src/hooks/useUnsavedChangesGuard.ts` **무변경** — 가드 머신 계약 그대로
- `src-tauri/capabilities/main.json` **무변경** — 커스텀 커맨드는 capability 항목 불필요, single-instance는 JS API 없음
- 런타임 OS 파일 연결 변경 코드 금지 (정적 등록만 — REQ-001)
- `ext`는 `["md"]` 단독 — 다른 확장자 추가 금지 (사용자 지시)
- 다중 창 금지 — single-instance 포워드 모델 유지 (사용자 지시)
- `dir`/`path`는 원본 구분자 보존 — canonicalize·구분자 정규화 금지 (정규화는 프론트 비교 시점에만)
- 마운트 복원은 단일 if-else — 외부 오픈이 `lastWatchedPath` 복원에 우선 (REQ-011)
- 관련 없는 파일·타 SPEC 디렉터리·`.moai/state/*` 미변경 (스코프 규율)

## Technical Approach

**3진입 경로 수렴 구조**: macOS Opened / Windows 런치 argv / Windows single-instance argv가 모두 `stage_pending_open`(AppState 저장 + "main" 창 emit)으로 수렴하고, 프론트는 (마운트 효과) OR (런타임 이벤트) 중 실제로 take 값을 가진 쪽에서만 소비한다. 이중 처리는 **atomic-take 계약**으로 봉쇄한다 — 이벤트 → 통지(notify) → `take_pending_open_file()` → take 반환값만 처리. 모든 소비자(마운트 효과·라이브 이벤트 핸들러)가 take를 수행하고 이벤트 페이로드를 직접 소비하지 않으므로, take IPC 진행 중 이벤트가 도착해도 한쪽만 Some를 받아 이중 처리가 구조적으로 불가능하다(pre-await `handledRef` 체크는 우회 가능성이 있어 폐기).

**스테이징 함수의 역할**: emit은 리스너 등록 전 도착 시 유실되므로, AppState 슬롯이 항상 원천(source of truth)이고 emit은 "이미 실행 중인 프론트"에 대한 통지 역할만 한다.

**계약 순서**: M1(Rust 배관 — 계약의 생산자) → M2(프론트 배선 — 소비자) → M3(설정·번들·문서 — 사용자 가시화). M2는 M1의 커맨드/이벤트 계약을, M3는 M1+M2 완료 후 번들이 필요하다.

### 설계 결정 사항 (변경 가능성 높은 순 — run-phase에서 임의 반전 금지, 변경 시 blocker 보고)

1. **워크스페이스 판정·전환 흐름** (REQ-007/008/011): 같은 폴더 스킵 + 가드 래핑 + 복원 우선순위의 3요소는 하나의 핸들러(`handleExternalOpen`)와 단일 if-else 이펙트로 묶인다 — 부분만 적용하면 경쟁(`openFolderPath` 2회)이 재발한다.
2. **PendingOpenFile payload 형태** (`{path, dir}` 문자열 2필드): Rust↔프론트 계약의 최소 단위. 필드 추가(예: mtime)는 후속 SPEC 과제.
3. **single-instance 콜백의 "항상 포커스"** (REQ-006): .md 유무와 무관하게 포커스 — 아이콘 재클릭 UX(2프로세스 방지)와 파일 포워드를 하나의 콜백에서 처리하는 단순화.
4. **`find_md_in_args`가 `skip(1)`하지 않는다**: argv[0]은 .md일 수 없고 single-instance argv는 플래그 폼별로 argv[0] 포함 여부가 달라, 필터(`-` 스킵)+확장자 검사가 양쪽에 견고하다.

## Milestones

> 시간 추정 대신 우선순위 라벨 + 위상 순서로 표기한다.

### Milestone 1: Rust 배관 (계약의 생산자) — Priority: High

- [MODIFY] `src-tauri/Cargo.toml` — `tauri-plugin-single-instance = "2"` 추가
- [NEW] `src-tauri/src/models/pending_open.rs` — `PendingOpenFile { path, dir }` (`#[derive(Debug, Clone, PartialEq, serde::Serialize)]`, file_event.rs 패턴) + [MODIFY] `models/mod.rs`
- [MODIFY] `src-tauri/src/state/app_state.rs` — `pending_open_file: Mutex<Option<PendingOpenFile>>` 필드 + 인라인 테스트 2건 (기본 None, set→take 반환 후 클리어)
- [NEW] `src-tauri/src/commands/file_open.rs` + [MODIFY] `commands/mod.rs`:
  - `is_markdown_path(&str) -> bool` — 대소문자 무시 `.md` 판정, 그 외 전부 false (범위 가드)
  - `find_md_in_args(&[String]) -> Option<String>` — argv에서 첫 .md, `-` 플래그 스킵
  - `first_md_url(&[tauri::Url]) -> Option<String>` — `file://` .md만, 다중 시 첫 번째
  - `resolve_md_path(raw, cwd) -> Option<PendingOpenFile>` — .md 검증 + `is_file` 존재 검사 + `Path::parent()` dir 계산 (**canonicalize 절대 금지 — REQ-013**)
  - `stage_pending_open(&AppHandle, &PendingOpenFile)` — AppState 저장 + `get_webview_window("main")` emit `"open-file"`
  - `#[tauri::command] take_pending_open_file(State<AppState>) -> Option<PendingOpenFile>` — take 후 클리어
- [MODIFY] `src-tauri/src/lib.rs` 3개소:
  - (a) single-instance 플러그인 **체인 첫 등록**(`tauri_plugin_opener` 앞) — argv→resolve→stage + `.md` 유무와 무관하게 항상 `set_focus`
  - (b) setup 클로저 끝 런치 argv 처리(macOS 번들은 argv가 아닌 Apple Event → macOS에서 자연 no-op)
  - (c) `.run(ctx)` → `.build(ctx).run(클로저)` — `RunEvent::Opened { urls }` → `first_md_url` → `resolve_md_path` → `stage_pending_open` + `take_pending_open_file` 커맨드를 **기존 generate_handler 목록 끝에 추가**
- Rust 인라인 단위 테스트 green: `cargo test` (file_open 헬퍼 매트릭스 + app_state set/take + pending_open payload)

### Milestone 2: 프론트 배선 (계약의 소비자) — Priority: High

- [MODIFY] `src/lib/tauri/ipc.ts` — `PendingOpenFile` 인터페이스 + `takePendingOpenFile(): Promise<PendingOpenFile | null>` 래퍼 (JSDoc + `@MX:SPEC` 컨벤션)
- [NEW] `src/hooks/useExternalOpenFile.ts`:
  - `__TAURI_INTERNALS__` 가드 (비-Tauri 완전 no-op — REQ-014)
  - `isSameWorkspaceDir(watchedPath, dir)` 내보내기 — 구분자 통일 + 트레일링 슬래시 제거 + 대소문자 접기는 Windows 한정(macOS/POSIX 정확 비교 — REQ-007, 대소문자 구분 볼륨 안전)
  - 리스너 이펙트: `'open-file'` 이벤트는 통지일 뿐 — 핸들러는 이벤트 페이로드를 직접 소비하지 않고 `takePendingOpenFile()`을 수행해 **반환된 값만** 처리한다 (atomic-take — REQ-011)
  - `consumePendingOpenFile(): Promise<boolean>` — take 반환값 기반 판정(Some → 처리·true, None → false), ipc 실패 시 false 폴백
  - 인플라이트 직렬화(single-flight latest-wins): 외부 오픈 전환이 실행 중일 때 새로 take된 페이로드는 동시 실행되지 않고 진행 중 전환을 대체한다 — 최종 상태는 항상 하나의 일관된 워크스페이스+파일 쌍 (연속 오픈 버스트 → AC-008 변형)
- [MODIFY] `src/App.tsx` — `handleExternalOpen`(useCallback, `guard.requestGuardedAction`이 **동작 전체**를 래핑: 같은 폴더면 `openFolderPath` 스킵 → 다르면 `openFolderPath(dir)` → 실패 시 전체 중단 → `openFile(path)` — 스킵 경로도 가드 안이라 dirty=true면 같은 폴더여도 모달 — REQ-008) + 신규 훅을 guard 뒤·복원 이펙트 앞 배치 + 복원 이펙트를 단일 if-else로 교체 (`await consumePendingOpenFile()`이 true면 복원 스킵)
  - destructure는 현재 트리에서 `openFile` 이미 포함(실측 `App.tsx:16`) — 누락 시에만 추가
- [NEW] vitest 2건 (SPEC-id 파일명 컨벤션):
  - `src/test/SPEC-FS-004-external-open.test.ts` — 훅 메커니즘 (isSameWorkspaceDir 매트릭스 — Windows 접기·POSIX 정확 비교 / 비-Tauri no-op / 리스너 1회 등록·언마운트 unlisten / 이벤트→take→반환값 처리(atomic-take·인플라이트 인터리빙) / take Some·null·거부 / 콜백 identity 변경 시 재등록 없이 최신 콜백)
  - `src/test/SPEC-FS-004-external-open-flow.test.tsx` — 합성 흐름 (다른 폴더 readDirectory→readFile 순서+startWatch/registerAssetScope / 같은 폴더 readDirectory 재호출 없음 / 같은 폴더+dirty=true 가드 모달 / 가드 취소 시 ipc 파일 호출 없음 / 폴더 실패 시 readFile 중단 / 연속 오픈 버스트 → 단일 일관 상태)
- 기존 suite 무영향 확인: `npm run test` 전체 green (`app.test.tsx` 복원 경로 유지 포함) + `npm run typecheck` + `npm run lint`

### Milestone 3: 설정 + 번들 검증 + 문서 — Priority: Medium

- [MODIFY] `src-tauri/tauri.conf.json` — `bundle.fileAssociations` 추가 (`ext: ["md"]` 단독, name "Markdown Document", role Editor, mimeType `text/markdown`)
- 양 OS 빌드·설치·수동 인수 (AC-001/002/004/005/006 — 설치 빌드에서만 재현 가능):
  - macOS: `npm run build` → 설치 → Open With mdedit → 워크스페이스+파일 확인 / 실행 중 Opened / 다중 선택 첫 .md / .txt·.html 무시
  - Windows: NSIS 설치 → 더블클릭(UserChoice 소유 시 "연결 프로그램" 1회) / 실행 중 전환(2창 없음) / MSI 스팟체크 / 제거 시 등록 해제 / dev 시뮬레이션 `target/debug/mdedit.exe C:\path\notes.md`
- [MODIFY] 문서 — README(§기능), USER_GUIDE(§1 사용법 + §6 FAQ "기본 프로그램으로 안 열려요" — UserChoice 1회 선택·모달 중 폐기 안내), CHANGELOG
- 최종 게이트: `cargo test` + `npm run test` + `npm run typecheck` + `npm run lint` (moai gate)

## mx_plan (Phase 14 — @MX 태그 계획)

> `code_comments: ko` — 태그 설명은 한국어. `[AUTO]` 접두사 필수. WARN/ANCHOR에는 `@MX:REASON` 필수.

| 위치 | 태그 | 내용 |
|---|---|---|
| `commands/file_open.rs` — `stage_pending_open` | `@MX:ANCHOR` 후보 | 3개 OS 진입 경로(single-instance 콜백 / setup argv / Opened 클로저)가 수렴하는 지점, fan_in ≥ 3. REASON: 외부 오픈 계약의 단일 수렴점 — 진입 경로 추가 시 이 함수만 통과 |
| `commands/file_open.rs` — `resolve_md_path` | `@MX:WARN` | canonicalize 절대 금지 구역 (REQ-013). REASON: Windows `\\?\` 접두사가 watchedPath 비교 영구 실패+localStorage 오염 유발 (`directory_ops.rs:112-125` 선례). `@MX:SPEC: SPEC-FS-004` |
| `src/hooks/useExternalOpenFile.ts` | `@MX:NOTE` | 런치 레이스 전제 — "Tauri emit은 큐잉되지 않는다. 유실은 마운트 전 도착뿐이며 AppState 슬롯+take가 커버, 겹침 창은 atomic-take 계약으로 봉쇄(모든 소비자가 take 반환값만 처리)" (미래 수정 시 실수 방지 — research §5.5) |
| `src/hooks/useExternalOpenFile.ts` — `isSameWorkspaceDir` | `@MX:NOTE` | 정규화 방향: 오판 시 "다른 폴더로 오판"뿐 → idempotent 재오픈이라 실패-안전 |
| `src-tauri/src/lib.rs:1-3` 기존 `@MX:ANCHOR`/`@MX:SPEC` | 갱신 | 진입점 ANCHOR 유지 + `@MX:SPEC`에 `SPEC-FS-004` 추가 |
| 신규 테스트 2건 | `@MX:SPEC` 주석 | `SPEC-FS-004` 태깅 (기존 SPEC-id 테스트 파일 관례) |

## Risks and Mitigation (9건 — research.md §5 이관)

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | Windows UserChoice 해시 보호 — 설치자 등록은 후보 등록, 기존 기본 앱 조용한 대체 불가 | Medium | OS 정책 준수로 수용 (사용자 결정). USER_GUIDE §6 FAQ로 "연결 프로그램" 1회 선택 안내 |
| 2 | NSIS+MSI 동시 등록 (`targets: "all"`) — 연속 설치 미지원 | Low | NSIS 기준 검증 + MSI 스팟체크. 제거 시 등록 해제 1회 확인 |
| 3 | macOS 기본 앱 UX — `CFBundleDocumentTypes`는 능력 선언, 타 앱 기본 시 Open With 1회 선택 필요 | Low | FAQ 안내. AC-005 시나리오에 포함 |
| 4 | 의도된 동작 변경 — 싱글 인스턴스(아이콘 재클릭 → 기존 창 포커스) + dev/설치 식별자 충돌(dev 실행이 포워드 후 종료) | Medium | 문서화(개발자 FAQ) + AC-006 수동 검증. 개발 중 설치본 종료 운영 수칙 |
| 5 | macOS pre-listener emit 유실 경쟁 (런치 직후 Opened가 webview 리스너 등록 전 도착) | Medium | AppState pending 슬롯 + 마운트 take가 커버 (REQ-011). 전제를 @MX:NOTE로 영속 |
| 6 | 가드 재진입 폐기의 오보고 ("더블클릭했는데 무반응" 버그로 오인) | Medium | REQ-009에 의도된 동작으로 명시 + FAQ + 수동 인수 변형 시나리오 |
| 7 | Windows `\\?\` 함정 재발 (canonicalize 사용 시 같은 폴더 판정 영구 실패 + localStorage 오염) | High | REQ-013 금지 조항 + Rust `#[cfg(windows)]` 테스트(접두사 부재) + `isSameWorkspaceDir` vitest 이중 방어 |
| 8 | 기존 테스트 회귀 (`app.test.tsx` 복원 경로, Playwright e2e) | Medium | M2 완료 기준으로 전체 suite green 확인 (AC-014). `invoke → undefined` mock이 take를 falsy 처리함을 실행으로 확인 |
| 9 | 테스트 자동화의 경계 — OS 레벨 전달은 `tauri dev` 재현 불가, 설치 빌드 수동 검증만 가능 | Medium | AC에 자동/수동 계층 명시 (Test Strategy Layer). 수동 인수 5종(AC-001/002/004/005/006)은 M3 게이트 |

## §E Self-Verification Deliverables (run-phase 완료 보고 의무)

각 항목은 명령 + 관측 출력 + baseline 귀속(HEAD SHA)을 verbatim으로 보고한다 (verification-claim-integrity §3):

1. **AC Binary PASS/FAIL Matrix** — AC-001~014 상태표 (수동 항목은 수행 환경 OS·빌드 식별 명시)
2. **cargo test** — `cd src-tauri && cargo test` 전체 green (신규 인라인 테스트 포함)
3. **npm run test** — 전체 green (기존 + 신규 2 파일; `app.test.tsx` 포함)
4. **npm run typecheck / npm run lint** — 0 error / 0 warning (`--max-warnings 0`)
5. **수동 인수 기록** — AC-001/002/004/005/006 결과 + 재현 환경(설치 빌드 버전·OS)
6. **Blocker Report** — 미지정 사용자 결정 필요 시 구조화 보고 (AskUserQuestion 금지 — 서브에이전트 경계)
7. **TDD RED 증거** — 자동화 대상 신규 테스트의 사전 실패 출력 verbatim

## §F Anti-Patterns

- `openFile` 내부에 가드 삽입 (SPEC-FS-003 REQ-012/028 위반 — 호출자 래핑 계약)
- 마운트 복원과 외부 오픈을 별개 이펙트로 병렬 실행 (`openFolderPath` 2회 경쟁 재발)
- canonicalize 후 `\\?\` strip으로 "해결" (오염 경로가 이미 localStorage에 영속됨 — 애초에 canonicalize 금지)
- 모달 중 도착한 외부 오픈을 큐에 쌓는 "친절한" 확장 (REQ-009 위반)
- 정확한 커맨드 순번·라인 번호를 문서 기준으로 하드코딩 (코드 기준 재확인 — §A 사실 검증 노트)

## §H Cross-References

- `.moai/specs/SPEC-FS-004-md-file-association/research.md` — 앵커 16종·암묵적 계약 7건·리스크 원문
- `.moai/specs/SPEC-FS-003-unsaved-changes-guard/spec.md` — REQ-024/025/026 (가드 재진입 폐기·즉시 실행) 원천 계약
- `spec.md` Delta Map / `acceptance.md` Test Strategy Layer — REQ↔AC↔계층 1:1 대응
