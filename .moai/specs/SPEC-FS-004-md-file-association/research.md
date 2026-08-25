# SPEC-FS-004 Research — .md 파일 더블클릭 → mdedit 직접 열기

> Plan-phase deep-research artifact. 원천 입력: `.moai/plans/md-shiny-muffin.md` (검증 완료된 구현 설계).
> 본 문서의 모든 file:line 앵커는 2026-08-25 현재 트리(main, v0.15.0 개발 중)에서 실측 확인했다.
> 설계 재검토가 아니라 연구 결과의 **영속화**가 목적 — 아키텍처 방향은 이미 사용자가 승인한 4대 결정으로 확정:

1. **정적 등록만** (`bundle.fileAssociations`) — 앱 내 "기본 프로그램으로 설정" 버튼은 범위 외(future-extension 노트만 남김)
2. **`.md` 확장자만** — 다른 형식의 정적 등록·런타임 수용 모두 금지. 비-.md 인자/URL은 모든 진입 경로에서 조용히 무시
3. **단일 창 모델** — 실행 중 외부 오픈은 항상 기존 창으로 포워드(2번째 창 금지). 근거: 전역 zustand store(`useFileStore`/`useUIStore`/`useEditorStore`)는 다중 창에서 안전하지 않음
4. **다중 파일 오픈은 첫 .md 1개만** — 나머지 폐기. 가드 머신의 큐잉 금지(SPEC-FS-003 REQ-024/025)와 일관

---

## 1. 아키텍처 분석 (실측 앵커)

### 1.1 현재 Tauri 진입 구조 — 이벤트 클로저 없는 `.run()`

`src-tauri/src/lib.rs:16-75`의 빌더 체인:

```
tauri::Builder::default()
  .plugin(tauri_plugin_opener::init())   // :17 — 현재 첫 번째 플러그인
  .plugin(tauri_plugin_shell::init())    // :18
  .plugin(tauri_plugin_dialog::init())   // :19
  .manage(AppState::new())               // :20
  .setup(|app| { ... })                  // :21-47 — 아이콘 세팅 + AI 정책 프로브
  .invoke_handler(tauri::generate_handler![ ... ])  // :48-73 — 24개 커맨드
  .run(tauri::generate_context!())       // :74 — 이벤트 클로저 없음
```

핵심 사실 3가지:

- **`.run(ctx)`가 이벤트 클로저 없이 호출 중**(`lib.rs:74`). macOS `RunEvent::Opened`를 수신하려면 `.build(ctx).run(closure)` 형태로 전환해야 한다(설계 변경 지점 3곳 중 1곳).
- **single-instance 플러그인 자리가 비어 있음** — `Cargo.toml:23-32` 의존성은 tauri 2 + opener/shell/dialog뿐. tauri-plugin-single-instance는 공식 문서 요구사항에 따라 **체인의 첫 번째 플러그인**으로 등록해야 한다(현재 `tauri_plugin_opener`가 :17에 있으므로 그 앞에 삽입).
- **invoke_handler에 24개 커맨드가 등록되어 있다**(`lib.rs:48-73` 실측 — 계획 문서의 "23번째" 표기는 드리프트. `take_pending_open_file`은 **25번째**가 된다).

### 1.2 워크스페이스 열기 파이프라인 — `openFolderPath` (dialog-free)

`src/hooks/useFileSystem.ts:92-114`. 대화상자 없이 경로만 받아 워크스페이스를 여는 유일한 진입점 — 시작 복원(`App.tsx:30-38`)이 이미 사용하는 경로로, 외부 오픈이 재사용해야 하는 정확한 계약:

```
readDirectory(path) → setWatchedPath(path) → setFileTree(tree)
→ useUIStore.setLastWatchedPath(path)        // localStorage 영속 (uiStore.ts:142)
→ registerAssetScope(path).catch(...)         // 비차단, 실패 시 HTML 보기만 불능
→ startWatch(path).catch(...)                 // 비차임, 실패 시 탐색 계속
// 실패 시 throw — 호출자가 catch해서 폴백 결정
```

부수효과 전체(트리·워처·asset scope·lastWatchedPath 영속)가 이 함수 하나에 몰려 있으므로, 외부 오픈이 `openFolderPath(dir)`를 호출하는 것만으로 "다음 실행 시 외부 오픈된 폴더가 복원된다"까지 자동으로 성립한다 — 별도 영속 로직 불필요.

### 1.3 파일 열기 — `openFile`의 가드-free 계약

`src/hooks/useFileSystem.ts:136-229`. `@MX:NOTE`(SPEC-FS-003 REQ-012/028)가 명시하듯 **openFile 자체는 가드-free 순수 동작** — 미저장 가드는 호출측이 `requestGuardedAction`으로 감싼다. 이 계약이 외부 오픈 핸들러가 "호출자 래핑" 구조를 갖는 근거(워처/복원 경로와 동일한 재사용 패턴).

분류 순서(모든 분기가 예외를 상위로 전파하지 않음 — REQ-PREVIEW007-006):
1. `.html` → previewStatus 'html' (`:151`)
2. 래스터 이미지 → 뷰어 라우팅 (`:165`)
3. SVG → 원본 텍스트 로드, 실패 시 binary 폴백 (`:177-194`)
4. 대용량 가드 HARD_CEILING 100MB → 'too-large' (`:221`)
5. readFile 성공/실패 → text/binary

진입 즉시 `setDirty(false)`(`:146`, REQ-011 — 열린 파일은 정의상 깨끗함). **외부 오픈이 .md만 수용하므로 실제로 도달하는 분기는 5번뿐**이지만, 폴더가 사라진 경우의 `readFile` 실패는 binary 폴백이 흡수한다.

### 1.4 가드 머신 — `requestGuardedAction` 계약

`src/hooks/useUnsavedChangesGuard.ts:110-125` 실측:

```ts
const requestGuardedAction = (action: () => void | Promise<void>): void => {
  if (open || busyRef.current) return;   // REQ-024/025: 모달/저장 중 재요청은 폐기(큐잉 금지)
  const { dirty } = useEditorStore.getState();
  if (!dirty) { void action(); return; } // REQ-026: dirty=false면 즉시 실행
  setKind('unsaved'); pendingActionRef.current = action; setOpen(true);
};
```

- **async action 지원**(`() => void | Promise<void>`) — 외부 오픈의 "폴더 전환 → 파일 열기" 2단계 비동기 시퀀스를 하나의 guarded action으로 감쌀 수 있다.
- **재진입 폐기는 기존 계약**(SPEC-FS-003 REQ-024/025, AC-FS-003-012가 파일 클릭/새 문서/워처 3트리거로 이미 검증). 모달 열림 중 도착한 외부 오픈의 폐기는 새 동작이 아니라 기존 계약의 자연스러운 확장 — 다만 나중에 버그로 오보고되지 않도록 SPEC에 명시해야 한다(리스크 §5.6).
- **마운트 시점 `dirty`는 항상 false**(신선 editorStore) — 런치 직후 외부 오픈은 모달 없이 즉시 실행된다. 가드는 실행 중인 앱에 live 이벤트가 도착할 때만 개입.

### 1.5 시작 복원 흐름 — 외부 오픈이 대체하는 대상

`src/App.tsx:30-38`:

```ts
useEffect(() => {
  const { lastWatchedPath, setLastWatchedPath } = useUIStore.getState();
  if (!lastWatchedPath) return;
  openFolderPath(lastWatchedPath).catch(() => setLastWatchedPath(null));
}, []);
```

외부 오픈이 존재하면 이 복원은 실행되지 않아야 한다(경쟁하는 `openFolderPath` 2회 호출 방지). 설계는 **단일 if-else 흐름**으로 해결한다: 마운트 이펙트가 `consumePendingOpenFile()`을 먼저 await하고, true면 복원 스킵 / false면 기존 복원 경로. `uiStore.ts:106+170`의 zustand `persist`(localStorage `mdedit-ui-store`)가 `lastWatchedPath`를 공급한다(`uiStore.ts:38`).

`App.tsx` 배치 지점 실측: `:16` destructure(**`openFile` 이미 포함돼 있음** — 계획 문서의 "line 19 — openFile 추가"는 불필요, 드리프트 2건째), `:20` `guard` 인스턴스, `:21` `useWindowCloseGuard(guard.requestClose)`, `:30-38` 복원 이펙트. 새 훅은 `:20` 뒤, 복원 이펕트 앞에 배치(훅 순서 = 이펙트 순서).

### 1.6 이벤트 리스너 패턴 — `useFileWatcher`

`src/hooks/useFileWatcher.ts:62-80`:

- `onFileChangedRef`로 콜백을 안정화(`:57-60`) — 부모 리렌더로 인한 리스너 재등록 방지
- `listen('file-changed', ...)` 등록 후 unlisten을 cleanup에서 호출(`:65-79`)
- `startWatch`/`stopWatch`는 `invoke` 직접 호출(`:82-94`)

신규 `useExternalOpenFile` 훅이 그대로 따를 패턴. 추가 요소: 콜백 identity가 바뀌어도 **리스너는 재등록 없이** 최신 콜백만 호출되어야 한다(ref 경유).

### 1.7 비-Tauri 런타임 가드 — `__TAURI_INTERNALS__`

`src/hooks/useWindowCloseGuard.ts:35-38`:

```ts
const internals = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
if (!internals) return;   // Vite dev / jsdom / E2E 브라우저에서 완전 no-op
```

try/catch 이중 방어(`:43-66`)까지 갖춘 패턴. jsdom(vitest)과 Playwright가 Tauri internals 없이 구동되는 이 프로젝트의 **기존 테스트 무영향**을 보장하는 장치 — 신규 훅에도 동일 가드가 필요하다(그렇지 않으면 `listen` import만으로 jsdom에서 폭발).

### 1.8 IPC 래퍼 레이어 — `src/lib/tauri/ipc.ts`

타입드 `invoke` 래퍼 + 함수별 JSDoc 주석 + `@MX:NOTE`/`@MX:SPEC` 주석 컨벤션(전 파일). 신규 `takePendingOpenFile(): Promise<PendingOpenFile | null>`과 `PendingOpenFile` 인터페이스가 이 레이어에 추가된다. 테스트 모킹 지점 단일화(컴포넌트가 invoke를 직접 import하지 못하게)도 이 레이어의 설계 의도(SPEC-EXPORT-002 REQ-006 선례).

### 1.9 Rust 상태 모델 — `AppState` 패턴

`src-tauri/src/state/app_state.rs:27-55`: 모든 필드가 `Mutex<Option<T>>`/`Mutex<T>` 형태, `AppState::new()`에서 초기화, `#[cfg(test)] mod tests`에 인라인 단위 테스트(`:63-140` — 기본값·set/get 검증 12건). 신규 `pending_open_file: Mutex<Option<PendingOpenFile>>` 필드가 정확히 이 패턴을 따른다(set→take 반환 후 클리어 테스트 포함).

### 1.10 모델 payload 패턴 — `models/file_event.rs`

`#[derive(Debug, Clone, serde::Serialize)]` + 필드별 doc comment + `new()` 생성자 + 인라인 테스트. `PendingOpenFile { path, dir }`가 동일 구조를 따른다(`PartialEq` 추가 — 테스트 편의).

### 1.11 Windows `\\?\` canonicalize 함정 — 선례 코드

`src-tauri/src/commands/directory_ops.rs:112-125` 실측(계획 문서의 ":114" 앵커):

```rust
let canonical = std::fs::canonicalize(path).map_err(...)?;
// Windows에서 std::fs::canonicalize는 \\?\ UNC 확장 경로 접두사를 붙인다.
// Tauri의 asset_protocol_scope는 이 접두사를 인식하지 못해 scope 매칭이 실패한다.
#[cfg(target_os = "windows")]
{ if let Some(stripped) = s.strip_prefix(r"\\?\") { return Ok(PathBuf::from(stripped)); } }
```

같은 함정이 외부 오픈의 `dir` 계산에도 적용된다: canonicalize된 `\\?\C:\Docs`는 프론트 `watchedPath`(`C:\Docs`)와 **영원히 일치하지 않고**, 같은 폴더 판정 실패 → 불필요한 재오픈, 그리고 오염된 경로가 localStorage `mdedit-ui-store`의 `lastWatchedPath`에 영속된다. 설계의 결론: **dir 계산에는 `Path::parent()`만 쓰고 canonicalize는 절대 금지**(원본 구분자 보존).

### 1.12 파일 연동 설정 현황

`src-tauri/tauri.conf.json:29-40` — `bundle` 객체에 `"targets": "all"`(:31)과 icon만 있고 **`fileAssociations` 없음**. `identifier: "com.mdedit.app"`(:5). `targets: "all"`이므로 fileAssociations 추가 시 Windows NSIS와 MSI **양쪽 모두** ProgId 등록이 생성된다(리스크 §5.2). macOS는 Info.plist `CFBundleDocumentTypes`(role: Editor)로 번들에 선언된다.

`Cargo.toml` — 신규 의존 `tauri-plugin-single-instance = "2"` 1개. macOS에서는 컴파일 타임 no-op라 무조건 등록해도 무해(플랫폼 분기 코드 불필요, 균일 유지).

---

## 2. 발견된 기존 패턴·컨벤션 요약

| 패턴 | 앵커 | 신규 코드에서의 재사용 |
|---|---|---|
| listen() 리스너 + ref 안정화 + unlisten cleanup | `useFileWatcher.ts:62-80` | `useExternalOpenFile` 리스너 이펙트 |
| `__TAURI_INTERNALS__` 비-Tauri no-op 가드 | `useWindowCloseGuard.ts:35-38` | 신규 훅의 jsdom/Playwright 무영향 보장 |
| 타입드 ipc 래퍼 + JSDoc | `ipc.ts` 전체 | `takePendingOpenFile` 래퍼 |
| `Mutex<Option<T>>` AppState 필드 + 인라인 테스트 | `app_state.rs:27-55, 63-140` | `pending_open_file` 슬롯 |
| `#[derive(Serialize)]` 이벤트 payload + `new()` | `models/file_event.rs:17-31` | `PendingOpenFile` |
| 가드-free `openFile` + 호출자 래핑 | `useFileSystem.ts:136-146` | 외부 오픈 핸들러가 `requestGuardedAction`으로 감쌈 |
| dialog-free `openFolderPath` 전체 부수효과 | `useFileSystem.ts:92-114` | 외부 오픈의 워크스페이스 전환·영속 재사용 |
| 재진입 폐기(큐잉 금지) | `useUnsavedChangesGuard.ts:110-125`, SPEC-FS-003 REQ-024/025 | 모달 중 외부 오픈 폐기의 정당성 근거 |
| SPEC-id 테스트 파일명 | `src/test/SPEC-PREVIEW-007-*.test.ts(x)` | `SPEC-FS-004-*.test.ts(x)` 2건 |
| `vi.mock('@/lib/tauri/ipc')` 모킹 지점 단일화 | `ipc.ts` 설계 의도(EXPORT-002 REQ-006) | 신규 vitest 2건 |
| 커맨드 등록 순서 = `commands/mod.rs` 모듈 목록 | `lib.rs:48-73`, `commands/mod.rs` | `file_open` 모듈 + `take_pending_open_file` 25번째 등록 |

---

## 3. Reference Implementations (코드 내 근거)

- Reference: `src-tauri/src/lib.rs:16-75` — 빌더 체인 전체. 플러그인 순서(:17-19), setup(:21-47), 24개 커맨드(:48-73), 클로저 없는 `.run()`(:74)
- Reference: `src/hooks/useFileSystem.ts:92-114` — `openFolderPath` 워크스페이스 오픈 파이프라인(영속 포함)
- Reference: `src/hooks/useFileSystem.ts:136-229` — `openFile` 가드-free 계약 + 4분류 + 예외 흡수
- Reference: `src/hooks/useUnsavedChangesGuard.ts:110-125` — `requestGuardedAction`(async 지원, 재진입 폐기, dirty=false 즉시 실행)
- Reference: `src/App.tsx:16-38` — destructure(오픈파일 포함), guard 인스턴스, lastWatchedPath 복원 이펙트
- Reference: `src/hooks/useFileWatcher.ts:62-94` — listen/unlisten 리스너 패턴
- Reference: `src/hooks/useWindowCloseGuard.ts:35-66` — `__TAURI_INTERNALS__` 가드 + try/catch 이중 방어
- Reference: `src/store/uiStore.ts:37-38,106,142,170` — `lastWatchedPath` persist(localStorage `mdedit-ui-store`)
- Reference: `src/store/fileStore.ts:39,68,89` — `watchedPath`(같은 폴더 판정의 비교 대상)
- Reference: `src/lib/tauri/ipc.ts` — 래퍼 컨벤션 전체
- Reference: `src-tauri/src/state/app_state.rs:27-55` — AppState 필드/초기화 패턴
- Reference: `src-tauri/src/models/file_event.rs:17-31` — 이벤트 payload 구조 패턴
- Reference: `src-tauri/src/commands/directory_ops.rs:112-125` — Windows `\\?\` canonicalize 함정의 선례 처리
- Reference: `src-tauri/tauri.conf.json:29-40` — bundle 현황(fileAssociations 부재, targets "all")
- Reference: `src-tauri/Cargo.toml:23-32` — 의존성 현황(single-instance 부재)
- Reference: `.moai/specs/SPEC-FS-003-unsaved-changes-guard/spec.md` — REQ-024/025(재진입 폐기), REQ-026(dirty=false 즉시 실행) 원천 계약

---

## 4. 암묵적 계약·제약 (구현이 존중해야 하는 것)

1. **가드-free `openFile`**: 워처·복원·외부오픈 모두 호출자가 가드를 래핑한다. `openFile` 내부에 가드를 넣지 않는다(SPEC-FS-003 REQ-012/028 위반).
2. **`openFolderPath`의 부수효과 전체가 계약**: 트리·워처·scope·lastWatchedPath 영속. 같은 폴더 판정에서 이를 스킵하는 것은 의도된 최적화(트리 깜빡임/워처 재시작 없이 `openFile`만), 판정 실패 방향은 "다른 폴더로 오판" → idempotent 재오픈이라 실패-안전.
3. **큐잉 금지**: 모달/저장 진행 중 외부 오픈 폐기는 버그가 아니라 REQ-024/025의 일관된 확장. 사용자 문서(FAQ)와 SPEC에 명시해 오보고를 방지한다.
4. **원본 경로 문자열 보존**: `dir`/`path`는 프론트 `watchedPath`(fileStore)·localStorage(uiStore)와 문자열 비교되므로 `\\?\` 접두사·구분자 정규화 없이 원본 그대로 전달한다. 정규화는 **프론트 비교 시점에만**(구분자 통일 + 트레일링 슬래시 제거 + 소문자).
5. **커스텀 커맨드는 capability 항목 불필요** — 기존 24개 커맨드도 `capabilities/main.json`에 개별 등록 없이 동작(자체 커맨드는 기본 허용). single-instance는 JS API가 없어 capability·프론트 패키지 모두 불필요.
6. **훅 순서 = 이펙트 순서**: `useExternalOpenFile`을 guard 인스턴스 뒤·복원 이펙트 앞에 배치해야 마운트 take가 복원보다 먼저 확정된다.
7. **`emit`은 큐잉되지 않는다**(Tauri 이벤트 시맨틱): 등록된 리스너에만 즉시 전달. 따라서 유실은 "마운트 전 도착"뿐이고 이는 AppState 슬롯 + `take`가 커버한다. 마운트 take와 live 이벤트의 겹침 창은 `handledRef`로 봉쇄한다(이중 처리 방지의 원리).

---

## 5. 리스크 (plan.md로 이관)

### 5.1 Windows UserChoice 보호 (정책 한계, 수용)
Win10/11은 기본 앱 선택(UserChoice)을 해시로 보호한다. 설치자의 ProgId 등록은 **후보 등록**이지 기존 기본 앱의 조용한 대체가 아니다. 예상 UX: 다른 앱이 .md 기본인 상태에서 1회 "연결 프로그램" 선택 필요. OS 정책 준수라 한계로 수용(사용자 결정사항) — USER_GUIDE FAQ로 안내.

### 5.2 NSIS+MSI 동시 등록
`targets: "all"`(tauri.conf.json:31)이 NSIS와 MSI **양쪽**을 빌드하며 동일 ProgId를 기록한다. 연속 설치(NSIS→MSI)는 미지원 시나리오: NSIS 기준으로 검증 + MSI 스팟체크. 제거 시 등록 해제 1회 확인이 필요하다.

### 5.3 macOS 기본 앱 UX
`CFBundleDocumentTypes`는 능력 선언이다. 타 앱이 .md 기본이면 Open With에서 1회 선택이 필요하다(조용한 대체 아님).

### 5.4 의도된 동작 변경 — 싱글 인스턴스
실행 중 아이콘 재클릭 시 지금까지는 2번째 프로세스가 났다면 이제 **기존 창 포커스**로 바뀐다(단일 창 모델에 필수). 그리고 **dev/설치 빌드가 식별자를 공유**(`com.mdedit.app`)하므로 설치본 실행 중 `tauri dev`를 띄우면 dev 프로세스가 포워드 후 즉시 종료된다 — 개발 중 설치본을 종료해야 하는 상황. 문서화 + 개발자 FAQ 필요.

### 5.5 macOS pre-listener emit 유실 경쟁
런치 직후 `RunEvent::Opened`가 webview 리스너 등록 전에 도착하면 emit은 유실된다. AppState pending 슬롯 + 마운트 take가 커버하지만, "이벤트는 유실될 수 있다"를 전제로 한 설계임을 코드 주석에 남긴다(미래 수정 시 실수 방지).

### 5.6 가드 재진입 폐기의 오보고 위험
모달 열림 중 외부 오픈 폐기가 "더블클릭했는데 무반응" 버그로 오보고될 수 있다. SPEC REQ에 의도된 동작으로 명시 + 수동 검증 시나리오에 포함.

### 5.7 Windows `\\?\` 함정 재발
dir 계산에 canonicalize를 쓰면 같은 폴더 판정 영구 실패 + localStorage 오염. Rust 인라인 테스트(Windows `#[cfg]` — 접두사 부재 어서션)와 프론트 `isSameWorkspaceDir` 단위 테스트로 이중 방어.

### 5.8 기존 테스트 회귀
`src/test/app.test.tsx`는 `invoke → undefined` mock을 쓰므로 `takePendingOpenFile()`이 falsy를 반환해 기존 복원 경로가 그대로 유지된다(실행으로 확인 필요). App.tsx 마운트 이펙트 교체·e2e(Playwright) 무영향(`__TAURI_INTERNALS__` 가드)도 게이트로 확인한다.

### 5.9 테스트 자동화의 경계
OS 레벨 파일 연동(더블클릭 → 프로세스 기동/포워드)은 `tauri dev`에서 재현할 수 없고 **설치 빌드에서만 수동 검증** 가능하다. 자동화 가능 영역(순수 헬퍼 함수·훅 메커니즘·합성 흐름)과 수동 영역(양 OS 설치 빌드 시나리오)을 AC에서 명시적으로 분리한다.

---

## 6. 구현 접근 권고 — 3-마일스톤 분할

계약 순서(의존 방향) 기준. M2는 M1의 커맨드/이벤트 계약을, M3는 M1+M2 완료 후 번들이 필요하다.

### M1 — Rust 배관 (계약의 생산자)
- `Cargo.toml` + tauri-plugin-single-instance = "2"
- 신규 `models/pending_open.rs` (`PendingOpenFile { path, dir }`) + mod 등록
- `app_state.rs` + `pending_open_file: Mutex<Option<PendingOpenFile>>` (+ 인라인 테스트 2건: 기본 None, set→take 클리어)
- 신규 `commands/file_open.rs` + mod 등록 — 순수 헬퍼(`is_markdown_path`, `find_md_in_args`(플래그 스킵), `first_md_url`(file:// .md만), `resolve_md_path`(존재 검사 + `Path::parent`, canonicalize 금지)) + `stage_pending_open`(슬롯 저장 + "main" 창 emit) + `#[tauri::command] take_pending_open_file`(take 후 클리어)
- `lib.rs` 3곳: (a) single-instance 플러그인 **체인 첫 등록**(argv→stage + 항상 set_focus), (b) setup 끝 런치 argv 처리(macOS 번들은 argv가 아닌 Apple Event → no-op), (c) `.run(ctx)` → `.build(ctx).run(closure)`(`RunEvent::Opened`) + 커맨드 25번째 등록
- Rust 인라인 단위 테스트 green(`cargo test`)

### M2 — 프론트 배선 (계약의 소비자)
- `ipc.ts` + `PendingOpenFile` 인터페이스 + `takePendingOpenFile()` 래퍼
- 신규 `src/hooks/useExternalOpenFile.ts` — 리스너 패턴 + `__TAURI_INTERNALS__` 가드 + `isSameWorkspaceDir` 내보내기 + `consumePendingOpenFile()`(handledRef 이중 처리 봉쇄, ipc 실패 시 false 폴백) + 이벤트 수신 시 take 드레인
- `App.tsx` 통합 — `handleExternalOpen`(`requestGuardedAction` 래핑: 폴더 다르면 `openFolderPath` → 실패 시 전체 중단 → `openFile`), 복원 이펙트를 단일 if-else로 교체(외부 오픈 우선)
- vitest 2건(`SPEC-FS-004-external-open.test.ts` 훅 메커니즘 / `SPEC-FS-004-external-open-flow.test.tsx` 합성 흐름) + 기존 테스트·e2e 무영향 확인

### M3 — 설정·번들 검증·문서 (사용자 가시화)
- `tauri.conf.json` + `fileAssociations`(ext `["md"]` 단독, role Editor)
- 양 OS 빌드·설치·수동 인수(macOS Open With / Windows 더블클릭·실행 중 전환·MSI 스팟체크·dev exe 시뮬레이션)
- README/USER_GUIDE(§1 + §6 FAQ "기본 프로그램으로 안 열려요" — UserChoice 1회 선택 안내)/CHANGELOG
- 게이트: `cargo test` + `npm run test` + tsc/eslint(moai gate)

---

## 7. 검증 기록 (계획 문서 대조)

- 앵커 16종 전부 실측 확인(§1, §3) — 계획의 설계 전제는 현재 트리와 일치.
- **드리프트 2건 발견**(구현에 영향 없음, plan.md에 반영 필요):
  1. `App.tsx:16`이 이미 `openFile`을 destructure 중 — 계획 9번 항목의 "line 19 — openFile 추가"는 불필요
  2. `lib.rs:48-73`의 기존 커맨드는 24개(23개 아님) — `take_pending_open_file`은 25번째
- SPEC ID 사전 검증: `SPEC-FS-004` → regex `^SPEC(-[A-Z][A-Z0-9]*)+-[0-9]{3}$` PASS (실행 출력 확인)
- 사용자 결정 4건(정적 등록만 / .md만 / 단일 창 / 첫 .md만)은 재론금지 — 본 문서와 후속 SPEC 요구사항의 상위 전제

## 8. post-rebase 확인 (2026-08-25, v1.1.0 개정 시점)

- §7의 App.tsx:16 관찰(`openFile` 이미 destructure됨)은 리베이스 이후 현재 트리에서도 동일하게 확인됨.
