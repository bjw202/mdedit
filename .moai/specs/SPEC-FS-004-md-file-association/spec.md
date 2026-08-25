---
id: SPEC-FS-004
title: ".md 파일 연동 — 더블클릭으로 mdedit 직접 열기"
version: "1.1.0"
status: completed
created: 2026-08-25
updated: 2026-08-25
author: jw
priority: P1
phase: "v0.16.0 target"
module: "src-tauri/src/commands/file_open.rs, src/hooks/useExternalOpenFile.ts"
lifecycle: spec-anchored
tier: M
tags: "file-association, tauri, single-instance, workspace"
---

# SPEC-FS-004: .md 파일 연동 — 더블클릭으로 mdedit 직접 열기

## HISTORY

- **2026-08-25 v1.0.0**: 최초 작성 (plan-phase). macOS/Windows 양쪽에서 .md 파일 더블클릭(또는 열기) 시 mdedit가 실행되어 해당 파일의 부모 폴더가 워크스페이스로 잡히고 파일이 열린 상태로 시작하도록 한다. 앱 실행 중이면 기존 창에서 워크스페이스가 전환된다(미저장 가드 적용). Phase 8 연구 결과(`research.md`, 파일:라인 앵커 16종 실측)와 사용자 승인 요구사항 세트(REQ 14건)를 기반으로 작성.
- **2026-08-25 v1.1.0**: plan-audit iteration-1 PASS (score 1.0) 이후 post-PASS 개정 — 감사 minor 결함(D1/D2/D4)·review-lens(F1-F7)·cross-model(codex) 결과를 반영. 주요 변경: REQ-008 가드가 외부 오픈 동작 전체를 래핑(REQ-007 같은 폴더 스킵 경로 포함 — 미저장 편집 조용히 버림 방지) / REQ-011 atomic-take 계약(이벤트는 통지일 뿐, 모든 소비자가 take 반환값만 처리) + 슬롯 덮어쓰기(latest-wins) / REQ-007 대소문자 접기 Windows 한정(macOS/POSIX 정확 비교) / REQ-004 Linux unverified-by-design 명시 / REQ-010 first-.md-only 전 진입 경로 일반화 / REQ-003/004/005/009/014 shall 키워드 보강 및 REQ-013 [Unwanted]→[Ubiquitous] 재라벨 / openFile 앵커 정정(`useFileSystem.ts:136-247`) / 유효 빌드 명령 수정(`npm run build`). REQ 14건·AC 14건·1:1 매핑 유지(신규 시나리오는 기존 AC 내부 변형으로 추가).

### 사용자 확정 사항 (상위 전제 — 재론 금지)

1. **정적 등록만** (`bundle.fileAssociations`) — 앱 내 "기본 프로그램으로 설정" 버튼은 범위 외 (사용자 결정, 2026-08-25)
2. **`.md` 확장자만** — 다른 형식의 정적 등록·런타임 수용 모두 금지. 비-.md 인자/URL은 모든 진입 경로에서 조용히 무시
3. **단일 창 모델** — 실행 중 외부 오픈은 항상 기존 창으로 포워드(두 번째 창 금지). 전역 zustand store(`useFileStore`/`useUIStore`/`useEditorStore`)는 다중 창에서 안전하지 않음
4. **다중 파일 오픈은 첫 .md 1개만** — 나머지 폐기. 가드 머신의 큐잉 금지(SPEC-FS-003 REQ-024/025)와 일관

## Overview (Context & Goal)

현재 mdedit는 .md 파일의 실행 프로그램으로 등록되어 있지 않다. OS에서 .md 파일을 더블클릭해도 mdedit가 열리지 않으며, mdedit로 파일을 보려면 앱을 실행한 뒤 폴더를 직접 지정해야 한다.

**목표**: macOS/Windows 모두에서 .md 파일을 더블클릭(또는 열기)하면 mdedit가 실행되어 **해당 파일의 부모 폴더가 워크스페이스로 잡히고**(기존 폴더-열기 흐름과 동일) **파일이 열린 상태**로 시작한다. 앱이 이미 실행 중이면 기존 창에서 워크스페이스가 전환된다(미저장 가드 적용).

**동작 계약** — 3개의 OS 진입 경로가 하나의 Rust 스테이징 함수로 수렴하고, 하나의 프론트 핸들러가 소비한다:

```
macOS (런치+실행 중):  RunEvent::Opened { urls }      ─┐
Windows (런치):         setup에서 env::args() 파싱      ─┼→ stage_pending_open(app, {path, dir})
Windows (실행 중):      single-instance argv 포워드    ─┘      ├─ AppState.pending_open_file 저장 (리스너 등록 전 유실 커버)
                                                                        └─ "main" 창으로 emit "open-file" {path, dir}
프론트엔드: 마운트 효과 OR 런타임 'open-file' 이벤트(이벤트는 통지일 뿐 — 페이로드 직접 소비 금지)
            └─ take_pending_open_file() → 반환된 값만 처리(atomic-take)
                └─ guard.requestGuardedAction( 동작 전체: 폴더 다르면 openFolderPath(dir) → openFile(path), 같은 폴더면 openFile만 — 스킵 경로도 가드 안 )
```

- Reference: `src-tauri/src/lib.rs:16-75` — 빌더 체인(클로저 없는 `.run()` :74, `invoke_handler` :48-73)
- Reference: `src/hooks/useFileSystem.ts:92-114` — `openFolderPath` 워크스페이스 오픈 파이프라인(트리·워처·asset scope·lastWatchedPath 영속)
- Reference: `src/hooks/useFileSystem.ts:136-247` — `openFile` 가드-free 계약(호출자가 가드를 래핑)
- Reference: `src/hooks/useUnsavedChangesGuard.ts:110-125` — `requestGuardedAction`(async 지원, 재진입 폐기, dirty=false 즉시 실행)
- Reference: `src/hooks/useWindowCloseGuard.ts:35-66` — `__TAURI_INTERNALS__` 비-Tauri 런타임 가드
- Reference: `src-tauri/src/commands/directory_ops.rs:112-125` — Windows `\\?\` canonicalize 함정 선례 처리

## Requirements (GEARS)

> GEARS 키워드는 영문을 유지하고 행동 묘사는 한국어로 작성한다. 본문에 등장하는 API·함수명(`openFolderPath`, `requestGuardedAction`, `RunEvent::Opened` 등)은 **재사용 대상 기존 계약의 정확한 지점을 지칭하는 표식**이며 신규 구현 규격이 아니다. 동일한 행동 결과를 내는 한 run-phase 구현은 계약 준수 범위 내에서 자유롭다.
>
> 라벨 규약: `[Event-detected]`는 GEARS의 Event-detected-unwanted 패턴(바람직하지 않은 조건 감지 → 응답)을 가리킨다. REQ-008·REQ-012는 **의도적 복합 REQ**이다(한 축의 두 When→응답 쌍 — dirty true/false, 파일 부재/폴더 실패 — 을 단일 계약으로 묶음; 분리하지 않는다).

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

## Files to Modify (Delta Map)

| 파일 | 상태 | 변경 내용 |
|---|---|---|
| `src-tauri/tauri.conf.json` (`bundle`) | [MODIFY] | `fileAssociations` 추가 — `ext: ["md"]` 단독, role Editor, mimeType `text/markdown` |
| `src-tauri/Cargo.toml` | [MODIFY] | `tauri-plugin-single-instance = "2"` 추가 (유일 신규 의존성) |
| `src-tauri/src/models/pending_open.rs` | [NEW] | `PendingOpenFile { path, dir }` payload (`models/file_event.rs` 패턴) |
| `src-tauri/src/models/mod.rs` | [MODIFY] | `pending_open` 모듈 등록 |
| `src-tauri/src/state/app_state.rs` | [MODIFY] | `pending_open_file: Mutex<Option<PendingOpenFile>>` 필드 + 인라인 테스트 |
| `src-tauri/src/commands/file_open.rs` | [NEW] | 순수 헬퍼(`is_markdown_path`/`find_md_in_args`/`first_md_url`/`resolve_md_path`) + `stage_pending_open` + `#[tauri::command] take_pending_open_file` |
| `src-tauri/src/commands/mod.rs` | [MODIFY] | `file_open` 모듈 등록 |
| `src-tauri/src/lib.rs` | [MODIFY] | 3개소 — (a) single-instance 체인 첫 등록, (b) setup 끝 런치 argv 처리, (c) `.run(ctx)` → `.build(ctx).run(클로저)` (`RunEvent::Opened`) + 커맨드 등록 |
| `src/lib/tauri/ipc.ts` | [MODIFY] | `PendingOpenFile` 인터페이스 + `takePendingOpenFile()` 래퍼 |
| `src/hooks/useExternalOpenFile.ts` | [NEW] | 리스너 + `__TAURI_INTERNALS__` 가드 + `isSameWorkspaceDir` + `consumePendingOpenFile()` |
| `src/App.tsx` | [MODIFY] | `handleExternalOpen`(가드 래핑) 통합 + 복원 이펙트를 단일 if-else로 교체 |
| `src/test/SPEC-FS-004-external-open.test.ts` | [NEW] | 훅 메커니즘 단위 테스트 |
| `src/test/SPEC-FS-004-external-open-flow.test.tsx` | [NEW] | 합성 흐름 단위 테스트 |
| `README.md` / `USER_GUIDE` / `CHANGELOG.md` | [MODIFY] | M3 문서 동기화 (§1 사용법 + §6 FAQ "기본 프로그램으로 안 열려요") |
| `src/hooks/useFileSystem.ts` | [EXISTING] | 무변경 — `openFolderPath`/`openFile` 계약 재사용 |
| `src/hooks/useUnsavedChangesGuard.ts` | [EXISTING] | 무변경 — `requestGuardedAction` 계약 재사용 |
| `src-tauri/capabilities/main.json` | [EXISTING] | 무변경 — 커스텀 커맨드는 capability 항목 불필요, single-instance는 JS API 없음 |
| `src/test/app.test.tsx` | [EXISTING] | 무변경 예정 — `invoke → undefined` mock이 take를 falsy로 처리해 기존 복원 경로 유지 (실행으로 확인) |

## Dependencies

- **신규 외부 의존성**: `tauri-plugin-single-instance = "2"` 1개 (macOS에서 컴파일 타임 no-op — 플랫폼 분기 없이 균일 등록)
- **기존 계약 재사용 (무변경)**: `openFolderPath`(`useFileSystem.ts:92-114`), `openFile`(가드-free, `useFileSystem.ts:136-247`), `requestGuardedAction`(`useUnsavedChangesGuard.ts:110-125`), `useFileWatcher` 리스너 패턴(`useFileWatcher.ts:62-80`), `__TAURI_INTERNALS__` 가드(`useWindowCloseGuard.ts:35-38`), `AppState` 패턴(`app_state.rs:27-55`)
- **SPEC-FS-003 (미저장 가드)**: REQ-024/025(재진입 폐기)·REQ-026(dirty=false 즉시 실행) 계약을 승계해 재사용 — **블로킹 의존이 아닌 계약 참조 관계** (구현·머지 완료 상태)

## Exclusions (Out of Scope)

### Out of Scope — 다른 확장자 파일 연동

- `.markdown`·`.mdx` 등 그 외 확장자의 정적 등록·런타임 수용 모두 제외 (사용자 지시 — `.md`만)
- 기존에 열리던 다른 형식(.html·이미지 등)의 열기 동작은 변경하지 않는다

### Out of Scope — 앱 내 "기본 프로그램으로 설정" 버튼

- 사용자 결정(2026-08-25)으로 제외. macOS `LSSetDefaultRoleHandlerForContentType` / Windows `IApplicationAssociationRegistrationUI` 연동은 future-extension 노트만 남긴다
- Windows UserChoice 해시 보호로 인한 "연결 프로그램" 1회 선택 UX는 OS 정책 준수 사항이며 본 SPEC이 해결하지 않는다 (USER_GUIDE FAQ로 안내)

### Out of Scope — 다중 창

- 단일 창/단일 워크스페이스 모델 유지 (전역 zustand store의 다중 창 비안전성). 파일별 창 분리·멀티윈도우는 취급하지 않는다

### Out of Scope — Linux 공식 지원

- single-instance 플러그인과 정적 등록 코드는 플랫폼 무관 균일 유지하나, Linux 데스크톱 환경별 등록 동작은 **검증 대상이 아니다** (수동 인수는 macOS + Windows 한정)

### Out of Scope — 모달 중 요청 큐잉

- 가드 모달·저장 진행 중 도착한 외부 오픈의 대기열 저장·순차 재생은 제외 — 폐기가 계약이다 (REQ-009, SPEC-FS-003 REQ-024/025 승계)

## Traceability

| Requirement | Acceptance Criteria | 검증 계층 |
|---|---|---|
| REQ-FS-004-001 | AC-001 | 수동(양 OS 설치 빌드) + 코드 리뷰 |
| REQ-FS-004-002 | AC-002 | 수동(양 OS 설치 빌드) |
| REQ-FS-004-003 | AC-003 | 자동 (cargo test) |
| REQ-FS-004-004 | AC-004 | 수동 (Windows 설치 빌드) |
| REQ-FS-004-005 | AC-005 | 수동 (macOS 설치 빌드) |
| REQ-FS-004-006 | AC-006 | 수동 (양 OS) |
| REQ-FS-004-007 | AC-007 | 자동 (vitest) |
| REQ-FS-004-008 | AC-008 | 자동 (vitest, 가드 fake) |
| REQ-FS-004-009 | AC-009 | 자동 (vitest) |
| REQ-FS-004-010 | AC-010 | 자동 (cargo test) |
| REQ-FS-004-011 | AC-011 | 자동 (vitest) |
| REQ-FS-004-012 | AC-012 | 자동 (cargo test temp-dir + vitest) |
| REQ-FS-004-013 | AC-013 | 자동 (cargo `#[cfg(windows)]` + vitest) |
| REQ-FS-004-014 | AC-014 | 자동 (vitest + 전체 suite green) |

## Quality Notes

- REQ 본문의 행동 서술과 검증 가능성은 acceptance.md의 Test Strategy Layer 테이블과 1:1로 대응한다 — 자동 검증 범위와 수동·리뷰 범위를 분리해 명시한다 ([feedback-spec-verifiable-requirements] 반영).
- OS 레벨 파일 연동(더블클릭 → 프로세스 기동/포워드)은 `tauri dev`로 재현할 수 없고 **설치 빌드에서만 수동 검증 가능**하다. 자동화 영역(순수 헬퍼·훅 메커니즘·합성 흐름)과 수동 영역(양 OS 설치 빌드 시나리오)의 경계가 REQ↔AC 매핑에 반영되어 있다 (research.md §5.9).
- 가드 재진입 폐기(REQ-009)는 버그가 아니라 의도된 동작이다 — 오보고 방지를 위해 REQ·USER_GUIDE FAQ·수동 인수 시나리오에 명시한다 (research.md §5.6).
- `openFile`의 가드-free 계약은 유지한다 — 외부 오픈 핸들러가 호출자 측에서 `requestGuardedAction`으로 래핑한다 (SPEC-FS-003 REQ-012/028 위반 금지).
