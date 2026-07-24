---
id: SPEC-FS-003
version: "0.0.3"
status: planned
created: "2026-07-22"
updated: "2026-07-24"
author: "jw"
priority: high
issue_number: 0
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.3 | 2026-07-24 | jw | **Save As 다이얼로그 누락 결함 연동**(spec.md v0.0.5, REQ-041~044) — T4(saveDocument)에 `forceDialog` 옵션 확장을 반영했다. `saveDocument()`가 다이얼로그 여부를 `currentFilePath` 단독으로 판정하던 것을 `saveDocument(opts?: { forceDialog?: boolean })` + `if (currentFilePath && !opts?.forceDialog)`로 바꾸고, Save As 진입점 3곳만 `forceDialog: true`를 전달·Save(`Mod-s`/헤더)는 미전달하도록 명시. `@MX:ANCHOR`/`@MX:REASON` 갱신 지시 추가. 매핑에 REQ-041~044·AC-023 추가. |
| 0.0.2 | 2026-07-22 | jw | plan-auditor 리뷰 반영 — `checkbox` 관련 지시 삭제(계약에서 제거됨, 소비자 0), 계약 불변식 INV-1/2/3 구현 지시 추가. **T2b 신설**(E2E 가상 FS 픽스처 — 현 널 스텁으로는 선언 E2E 5개가 실행 불가, SPEC-EXPORT-002와 공유·포크 금지). **T1 축소** — 사라질 저장 5경로 특성화를 제거하고 에디터↔스토어 동기 타이밍 확인 1건만 유지(나머지 3 기준선은 유지). T6에 종료 승격(REQ-037)·AI 취소(REQ-038~040) 로직 추가. T8에서 Rust 자동화 테스트 불가를 명시하고 diff 리뷰로 정정, `cargo test`를 AC-010 근거에서 제외. 투기적 API 확장 2건 삭제(`saveDocument(contentOverride?)`, `App.tsx` 3-훅 분해) — 뒷받침하는 요구사항 없음. |
| 0.0.1 | 2026-07-22 | jw | Run-entry plan 작성 — spec.md v0.0.2(사용자 결정 3건 반영본)와 정합. SPEC-UI-008 `plan.md` 구조 준용. 실제 소스 대조로 파일·라인 근거 확정(`useFileSystem.ts:67·91·116·139·141·154-228·231`, `AppLayout.tsx:82·103·119`, `MarkdownEditor.tsx:113·153·178`, `App.tsx:34-41`, `uiStore.ts:34·158-165`, `editorStore.ts:15`, `lib.rs:16-74`, `SettingsModal.tsx:78·97-105·112-117`). 개발 방법론 = TDD(브라운필드 Pre-RED 특성화 포함). 브랜치 = `feature/SPEC-FS-003-unsaved-changes-guard`. 실행 순서는 ConfirmDialog 선착륙(SPEC-EXPORT-002 언블록) → 상태·저장 단일화 → 가드 트리거 순으로 고정. |

## Overview

미저장 변경 보호를 전면 재설계한다. 재사용 가능한 인앱 모달 `ConfirmDialog`를 신설하고, 3버튼 가드(`취소`/`저장 안 함`/`저장`)를 파일 전환·새 문서·윈도우 종료 경로에 적용한다. 파일 워처 자동 재로드는 사용자 주도 이동이 아니므로 별도 문구·선택지 모달로 분리한다. 동시에 가드의 신뢰성을 무너뜨리는 동반 결함 3건(`openFile`의 dirty 리셋 누락, dirty 이중 소스 + 영속화된 stale `unsaved`, 저장 로직 5중 중복)을 수정한다.

- 개발 방법론: **TDD** (`quality.yaml` `development_mode: tdd`, RED-GREEN-REFACTOR, 브라운필드 Pre-RED 특성화 포함)
- 브랜치: `feature/SPEC-FS-003-unsaved-changes-guard` (`/moai run` 단계에서 생성)
- 신규 런타임 의존성: **없음** (`@tauri-apps/api`는 기존 의존성)
- 요구/수용 기준: spec.md REQ-FS-003-001~044(027 결번), acceptance.md AC-FS-003-001~023 (본 plan은 이를 구현 관점으로 분해하며 요구사항 자체를 변경하지 않는다)

## Confirmed Design Decisions (사용자 승인, 재검토 금지)

spec.md HISTORY(0.0.1/0.0.2)·Summary의 사용자 확정 결정을 옮긴 것으로, Run phase에서 **재검토 금지**다.

1. **인앱 커스텀 모달 고정** — `window.confirm`/`window.alert`/`window.onbeforeunload`/Tauri 네이티브 다이얼로그 사용 금지(REQ-028).
2. **3버튼 의미 고정** — `저장`=저장 **완료 후** 원래 동작 진행 / `저장 안 함`=폐기 후 진행 / `취소`·Escape·백드롭=중단 + 에디터 상태 무변경(REQ-014~016).
3. **가드 경로 = 파일 전환 · 새 문서(버튼+`Mod-n`) · 윈도우 종료** 3종 + 워처(별도 모달). 폴더 이동은 가드 대상이 **아니다**.
4. **폴더 이동 허위 가드 제거** — `openFolder`/`openFolderPath`는 `setContent`/`setCurrentFilePath`/`resetEditor`를 호출하지 않아 문서가 유지되므로, `changeFolder`의 `window.confirm`(`useFileSystem.ts:117-123`)은 **삭제**한다. 대체 모달을 두지 않는다(REQ-029). 일어날 수 없는 손실 경고는 사용자가 경고 전체를 습관적으로 무시하게 만들어 진짜 가드를 무력화한다.
5. **ConfirmDialog 계약 동결** — spec.md "ConfirmDialog Contract" 절의 타입을 **문자 그대로** 구현한다. SPEC-EXPORT-002가 동일 컴포넌트를 소비하므로 계약 변경은 두 SPEC 동시 개정을 요구한다.
6. **워처 모달 = 안전 선택지가 기본** — 계약("마지막 항목이 primary + 초기 포커스")을 바꾸지 않고 **배열 순서**로 해결한다. `actions: [{id:'reload', label:'디스크에서 다시 읽기', variant:'danger'}, {id:'cancel', label:'내 버전 유지', variant:'primary'}]` (REQ-022, REQ-034).
7. **`saveStatus`는 표시 전용 유지** — `'saving'`/`'new'`는 boolean에서 파생 불가하므로 완전 파생 셀렉터로 만들지 않는다. 가드 판정은 `editorStore.dirty`만 읽는다(REQ-007). 최소 변경 결정이며 열린 질문이 아니다.
8. **단일 `saveDocument()`** — 5개 진입점이 모두 이 함수를 호출하며, Save As 시 `watchedPath`를 기본 디렉터리로 전달한다(REQ-009, REQ-035).
9. **회귀 불변식** — 신규 런타임 의존성 0, `SettingsModal` 무변경, `EditorState` 계약 무변경, 자동저장/크래시복구/다중탭 미도입(REQ-030~033).

## Run Phase Verification Items (구현 전 확인 필요 — 추정 금지)

| # | 항목 | 확인 방법 | 영향 |
|---|------|-----------|------|
| **V1** | Tauri v2에서 프런트엔드 `getCurrentWindow().onCloseRequested()` 콜백의 `event.preventDefault()`만으로 종료 보류가 가능한지, 아니면 Rust `on_window_event` + `api.prevent_close()`가 **함께** 필요한지 | Context7 또는 Tauri v2 공식 문서(`@tauri-apps/api/window` `onCloseRequested`, `WindowEvent::CloseRequested`)로 확인 후 결정. **추정으로 구현하지 말 것** | 둘 중 하나면 충분하며 중복 구현은 불필요한 복잡도. T7 착수 전 반드시 해소. spec.md REQ-018은 Rust 경로를 요구하지만, V1 결과가 "프런트엔드 단독으로 충분"이면 REQ-018을 그에 맞게 개정하고 사용자에게 보고한다(임의 축소 금지) |
| **V2** | `uiStore` persist `partialize`에서 `saveStatus` 제외 시, 기존 사용자의 localStorage에 이미 저장된 `saveStatus` 키가 어떻게 처리되는지(잔류 여부) | zustand persist 동작 확인 + 실제 localStorage(`mdedit-ui-store`) 마이그레이션 테스트 | 잔류 시 초기 hydration에서 stale `unsaved`가 되살아날 수 있음. 필요 시 persist `version` 증가 + `migrate`로 명시 제거 |

## Task Decomposition

TDD 순서에 맞춰 각 유닛은 "테스트 먼저(RED) → 최소 구현(GREEN) → 정리(REFACTOR)"로 진행한다. 브라운필드 영역(`openFile` 5분기, 저장 5경로, 워처)은 변경 전 **Pre-RED 특성화**로 기존 동작을 고정한 뒤 확장한다.

### T1. [Pre-RED] 브라운필드 특성화 — 기존 동작 고정

- 목적: 변경 대상의 현재 동작을 회귀 기준선으로 고정한다(REQ-031/032 방어).
- 확인 대상:
  - `useFileSystem.openFile`(`:139-228`) — 5개 분기(html `:154`, raster `:168`, svg `:180`, too-large `:203`, text/binary `:213`)가 각각 `setCurrentFile`/`setContent`/`setCurrentFilePath`/`setPreviewStatus`/`setSaveStatus('saved')`를 호출함을 테스트로 고정. **현재 `setDirty(false)`를 호출하지 않는다는 사실도 기준선으로 명시**(T3에서 뒤집힐 대상).
  - **에디터↔스토어 동기 타이밍 (저장 경로 관련 유일한 필수 확인)** — `Mod-s` keymap은 `view.state.doc.toString()`을 쓰고 `editorStore.content`를 신뢰하지 않는다(`MarkdownEditor.tsx:118`). T4에서 이 우회를 제거하려면 **dispatch 직후 `editorStore.content`가 이미 최신인지**를 먼저 확인해야 한다(`updateListener`가 `:230`에서 동기적으로 `setContent`를 호출하므로 최신일 가능성이 높으나, 검증 없이 제거하면 최신이 아닌 내용을 저장할 위험이 있다). 이 한 가지만 특성화한다.
  - **저장 5경로 전체 특성화는 하지 않는다.** 그 5경로는 T4가 삭제할 대상이고, 경로 간 동작 차이 자체가 본 SPEC이 고치려는 결함이다(spec.md 결함 C). 사라질 코드의 발산하는 동작을 테스트로 고정하는 것은 다음 태스크에서 그 테스트를 다시 지우는 낭비다.
  - `SettingsModal` — 기존 테스트가 green임을 확인(REQ-031 기준선).
  - 폴더 이동 — `openFolder`/`openFolderPath`가 `setContent`/`setCurrentFilePath`/`resetEditor`를 호출하지 **않음**을 명시적 테스트로 고정(REQ-029의 근거를 코드로 못박아, 향후 누군가 가드를 "복원"하려 할 때 실패하게 만든다).
- 파일: `src/test/useFileSystem.test.ts`(보강), `src/test/AppLayout.test.tsx`·`MarkdownEditor.test.tsx`(read/보강).
- Done: 변경 전 전체 vitest green, 위 4개 기준선이 명시적으로 존재.
- 매핑: REQ-029/031/032 방어.

### T2. [RED→GREEN→REFACTOR] ConfirmDialog 컴포넌트 — `src/components/common/ConfirmDialog.tsx` **[최우선]**

> **이 태스크가 먼저 머지되어야 SPEC-EXPORT-002가 착수 가능하다.** `src/components/common/` 디렉터리는 현재 존재하지 않으므로 신규 생성한다.

- 계약: spec.md "ConfirmDialog Contract"의 `DialogActionVariant`/`DialogAction`/`ConfirmDialogProps`를 **문자 그대로** export. 임의 필드 추가·이름 변경 금지.
- 구조: `SettingsModal.tsx:78`의 모달 패턴을 일반화 — 백드롭(`:112-117` 선례) + 패널. `role="dialog"` + `aria-modal="true"`(REQ-002).
- 액션 렌더: `actions` 배열 순서대로 좌→우 버튼. **마지막 항목** = primary 스타일 + 초기 포커스(REQ-003). `variant`가 `'danger'`면 위험 스타일.
- 키보드/포인터: Escape(`SettingsModal.tsx:97-105` 선례) 및 백드롭 클릭 → 둘 다 `onAction('cancel')` emit(REQ-002/016). focus trap + 닫힘 시 트리거로 포커스 복귀(REQ-004).
- 계약 불변식 3건 구현(spec.md "계약 불변식" 절): **INV-1** 마지막 항목이 `variant: 'danger'`여도 초기 포커스는 마지막 항목이 받되 스타일은 danger로 렌더 / **INV-2** `variant`가 `'default'`이거나 생략이면 동일한 중립 스타일 / **INV-3** 개발 빌드에서 `actions`에 `id === 'cancel'` 항목이 정확히 하나 없으면 콘솔 오류(REQ-036).
- `data-testid`: 루트 + 각 액션 버튼(REQ-005).
- @MX: `@MX:ANCHOR`(재사용 다이얼로그 공개 계약, SPEC-EXPORT-002와 공유 — fan_in >= 2 예정) + `@MX:REASON` + `@MX:SPEC: SPEC-FS-003`.
- 테스트(RED first, 신규 `src/test/ConfirmDialog.test.tsx`): 렌더/`role`·`aria-modal`/액션 순서·마지막 primary·초기 포커스/Escape·백드롭 → `'cancel'`/focus trap 순환/닫힘 시 포커스 복귀/`data-testid`/INV-1 danger+포커스 조합/INV-3 `'cancel'` 부재 시 개발 빌드 콘솔 오류.
- 매핑: REQ-001~006, 036, AC-001/002/003/018.

### T2b. [GREEN] 가상 파일시스템 E2E 픽스처 — `e2e/fixtures/tauri-mock.ts` **[E2E 층의 선행 조건]**

> **이 태스크 없이는 T11의 E2E 시나리오 6개 중 5개가 실행조차 되지 않는다.** 현재 픽스처는 모든 IPC에 `null`을 반환하는 24줄 스텁이라 `read_directory`가 null → 파일 트리가 비어 있음 → **클릭할 파일이 없음**. 사용자의 최초 요청("파일 편집 중 다른 파일 클릭")이 지금 상태로는 E2E로 검증 불가능하다.

- 현재 상태: `invoke: () => Promise.resolve(null)` (`e2e/fixtures/tauri-mock.ts:7`).
- 확장 방식: `e2e/html-file-viewer.spec.ts:23-41`의 `addInitScript` 패턴을 따라 `__TAURI_INTERNALS__.invoke`와 `__TAURI__.core.invoke`를 **명령 이름으로 디스패치하는 형태**로 교체한다.
- 최소 지원 명령: `read_directory`(시드 트리 반환) · `read_file`(시드 내용 반환) · `write_file`(가상 FS에 기록, 이후 `read_file`에 반영) · `save_file_as`(경로 반환 또는 취소 시 null) · `start_watch`(no-op resolve).
- 시딩 API: 테스트별로 가상 FS 초기 상태를 주입하는 헬퍼(예: `seedFs({ '/proj/a.md': '내용 A', '/proj/b.md': '내용 B' })`). 미지원 명령은 명시적으로 실패하거나 경고를 남겨, 조용한 `null` 반환으로 인한 유령 통과를 막는다.
- **재사용 인프라**: 이 픽스처는 본 SPEC 전용이 아니라 앞으로의 모든 파일 관련 E2E가 쓰는 공용 기반이다. 특히 **SPEC-EXPORT-002의 E2E가 동일 픽스처에 `export_save_dialog`를 추가해 확장**할 예정이므로, 명령 디스패치 테이블을 외부에서 확장 가능한 구조로 설계한다. **포크 금지** — 두 벌의 목이 갈라지면 유지보수가 두 배가 되고 서로 다른 거짓 통과를 만든다.
- 기존 `e2e/html-file-viewer.spec.ts`가 자체 인라인 목을 쓰고 있으므로, 이번 확장이 그 파일을 깨지 않는지 확인한다(무변경 통과가 조건).
- 테스트: 픽스처 자체의 정합성은 T11 E2E가 실제로 파일을 클릭할 수 있는지로 검증된다(AC-022).
- 매핑: AC-022, 그리고 AC-007/008/009/012/013의 E2E 층 성립 조건.

### T3. [RED→GREEN] `openFile` dirty 리셋 — `src/hooks/useFileSystem.ts`

- 5개 분기 전부에 `useEditorStore.getState().setDirty(false)` 추가(`:154-228`). svg의 catch 분기(`:188-195`)와 text/binary의 catch 분기(`:220-228`) 포함 — **성공·실패 무관**(REQ-011).
- T1에서 고정한 "현재 호출하지 않음" 기준선을 뒤집는 테스트로 RED 확보.
- @MX: `openFile`에 `@MX:NOTE` 추가(모든 분기에서 dirty 리셋하는 이유 = 열린 파일은 정의상 깨끗함). 기존 `@MX:ANCHOR`(`:1-3`)·`@MX:SPEC` 유지.
- 매핑: REQ-011, AC-006.

### T4. [RED→GREEN→REFACTOR] 단일 저장 함수 — `src/lib/save/saveDocument.ts` (신규)

- 시그니처(안): `saveDocument(opts?: { forceDialog?: boolean }): Promise<boolean>` — 성공 true / 실패·사용자 취소 false. `forceDialog: true`는 Save As 의도를 나타내며, Save As 진입점 3곳(`handleSaveAs`/`Mod-Shift-s`/`saveFileAs`)만 전달한다(REQ-041). Save(`Mod-s`/헤더)는 인자를 **전달하지 않는다**(REQ-042).
- 로직: `editorStore`에서 `content`·`currentFilePath` 취득 → **`if (currentFilePath && !opts?.forceDialog)`**이면 `writeFile` 인플레이스 덮어쓰기(다이얼로그 없음, REQ-042), 그 외(경로 없음 **또는** `forceDialog: true`)면 `saveFileAs(content, watchedPath ?? undefined)`로 네이티브 다이얼로그 개시(REQ-041) — **`watchedPath` 기본 디렉터리 전달은 모든 경로 공통**(REQ-035). Save As가 새 경로를 반환하면 추적 경로(`currentFilePath`)를 전환한다(REQ-043). 다이얼로그 취소(null 반환) 시 무기록 + dirty 유지 + false 반환(REQ-044).
- 상태 전이: 진입 시 `setSaveStatus('saving')`, 성공 시 `setDirty(false)` + `setSaveStatus('saved')`, 취소 시 이전 dirty 기준 복원, 실패 시 `setSaveStatus('unsaved')` + **dirty true 유지**(REQ-010/017).
- 기존 5경로를 이 함수 호출로 치환:
  - `AppLayout.handleSave`(`:103-117`) → `saveDocument()`(forceDialog 미전달), `handleSaveAs`(`:82-101`) → `saveDocument({ forceDialog: true })`로 축약
  - `useFileSystem.saveFileAs`(`:231-250`) → `saveDocument({ forceDialog: true })`로 위임 (hook 인터페이스 시그니처는 유지해 호출측 파급 최소화)
  - `MarkdownEditor` `Mod-s`(`:113-152`) → `saveDocument()`(forceDialog 미전달)·`Mod-Shift-s`(`:153-177`) → `saveDocument({ forceDialog: true })` → IPC 직접 호출 제거, 스토어 우회 제거
- 주의: keymap은 `view.state.doc.toString()`을 쓰고 스토어를 우회한다. 치환 전에 T1의 동기 타이밍 특성화로 `editorStore.content`가 최신임을 **확인한 뒤** 우회를 제거한다. 확인 결과 최신이 아니라면 그것은 별개의 결함이므로 임의로 API를 넓히지 말고 보고한다.
- @MX: `saveDocument`에 `@MX:ANCHOR`(저장 단일 진입점, fan_in >= 5) + `@MX:REASON` + `@MX:SPEC: SPEC-FS-003`. **`@MX:ANCHOR`/`@MX:REASON`은 단일 함수가 이제 `forceDialog` 옵션으로 Save/Save As를 분기한다는 사실을 반영해야 한다**(Save는 인자 미전달로 REQ-009 수렴점 불변식 유지).
- 테스트(RED first, 신규 `src/test/saveDocument.test.ts`): 경로 유무 분기 / 성공 시 dirty·saveStatus 동기 / 실패 시 dirty 유지 / Save As 취소 시 false + dirty 유지 / **4개 진입 경로 전부 `watchedPath` 전달** / **`currentFilePath` 설정 상태에서 `forceDialog: true`면 다이얼로그 개시·미전달이면 인플레이스 덮어쓰기 / Save 3진입점 미전달·Save As 3진입점 전달 / 새 경로 기록 시 추적 경로 전환**(REQ-041~044).
- 매핑: REQ-009/010/035/041/042/043/044, AC-005/017/023.

### T5. [RED→GREEN] `saveStatus` 영속화 제외 — `src/store/uiStore.ts`

- `partialize`(`:161-164`)에서 `statusMessage`와 함께 `saveStatus`도 제외(REQ-008).
- V2 결과에 따라 persist `version` 증가 + `migrate`로 기존 localStorage 잔류 키 제거를 추가할 수 있다.
- 테스트: `partialize` 결과 객체에 `saveStatus` 키 부재 / 저장된 상태를 재hydration해도 stale `unsaved`가 복원되지 않음.
- 매핑: REQ-007/008, AC-004.

### T6. [RED→GREEN→REFACTOR] 가드 훅 — `src/hooks/useUnsavedChangesGuard.ts` (신규)

- 역할: "의도한 동작"을 보관하고 모달 결과에 따라 실행/폐기하는 상태 머신.
- 상태(안): `pendingAction: (() => void | Promise<void>) | null`, `open: boolean`, `busy: boolean`(저장 진행 중).
- API(안): `requestGuardedAction(action)` — `editorStore.dirty`가 false면 즉시 `action()` 실행(REQ-026/027), true면 모달 오픈 + `pendingAction` 보관.
- 액션 처리:
  - `'save'` → `await saveDocument()`; true면 `pendingAction()` 실행, false면 **실행하지 않고 dirty 유지**(REQ-014/017)
  - `'discard'` → 즉시 `pendingAction()` 실행(REQ-015)
  - `'cancel'` → `pendingAction` 폐기, 에디터 상태 무변경(REQ-016)
- **재진입 차단**: `open || busy`인 동안 `requestGuardedAction` 호출은 **무시하고 큐잉하지 않는다**(REQ-024/025). 큐잉 금지가 핵심 — 큐잉하면 사용자가 한 번 선택했는데 두 개의 파일이 순차로 열린다.
- **종료 승격(REQ-037)**: 종료 요청은 위 차단의 **예외**다. 모달이 이미 열린 상태에서 종료 요청이 오면 `closePending = true`만 세우고 모달은 그대로 둔다(화면 변화 없음). 해소 시:
  - `'save'` → `saveDocument()` 성공 시, `closePending`이면 **`pendingAction`을 실행하지 않고** 창을 닫는다.
  - `'discard'` → `closePending`이면 `pendingAction`을 실행하지 않고 창을 닫는다.
  - `'cancel'` → `closePending`과 `pendingAction`을 **모두** 폐기. 창은 열린 채 남고 이후 재종료 시도가 가능해야 한다(`closePending` 반드시 리셋 — 리셋 누락 시 창이 영원히 닫히지 않는 원래 버그가 재발한다).
  - 종료 요청을 차단·폐기하면 `prevent_close()`가 계속 창을 붙잡아 **사용자가 X를 눌러도 아무 반응이 없는 상태**가 된다. 이것이 이 예외의 존재 이유다.
- **AI 취소(REQ-038)**: `'save'`·`'discard'` 처리 시작 시 `aiStore.requestState === 'streaming'`이면 `await aiCancel(aiStore.requestId)`를 **가장 먼저** 호출한다. 취소 없이 진행하면 `openFile`의 `setContent('')` 이후 도착한 스트림 청크가 **새로 연 파일의 버퍼**에 들어가 방금 연 깨끗한 파일이 즉시 dirty가 되고 REQ-011이 무효화된다. `'cancel'`(중단) 경로에서는 AI를 취소하지 않는다 — 사용자가 아무것도 바꾸지 않기로 했으므로 스트리밍도 계속되어야 한다.
- **모달 메시지(REQ-039)**: 스트리밍 중이면 메시지에 AI 응답 중단 고지를 덧붙인다. `message`가 `React.ReactNode`이므로 조건부 노드 합성으로 처리 가능(계약 변경 불필요).
- `actions` 배열: `[{id:'cancel', label:'취소'}, {id:'discard', label:'저장 안 함'}, {id:'save', label:'저장', variant:'primary'}]` — `저장`이 마지막 = primary + 초기 포커스.
- @MX: `@MX:NOTE`(재진입 차단이 큐잉이 아닌 폐기인 이유) + `@MX:SPEC: SPEC-FS-003`.
- 테스트(RED first, 신규 `src/test/useUnsavedChangesGuard.test.ts`): 3 액션 각각의 후속 / 저장 실패 시 중단 / dirty=false 즉시 실행 / 모달 중 재진입 무시 — **파일 클릭·새 문서·워처 세 트리거 각각** 어서션(파일 1개, 저장 1회) / 종료 승격 3 분기 + `취소` 후 재종료 가능 / 스트리밍 중 `저장`·`저장 안 함` 양쪽에서 `aiCancel` 선행 호출 + `'cancel'`에서는 미호출 / 고지 문구 조건부 표시.
- 매핑: REQ-014~017, 024~026, 037~040, AC-008/009/012/013/019/020/021.

### T7. [RED→GREEN] 가드 트리거 배선 — `useFileSystem` · `AppLayout` · `MarkdownEditor`

- `useFileSystem.openFile`(`:139`): 기존 `window.confirm`(`:141-149`) **제거**. 가드는 호출측(`FileTreeNode.tsx:152` 경로)에서 `requestGuardedAction(() => openFile(path))`로 감싼다 — `openFile` 자체를 가드-free 순수 동작으로 만들면 T6 테스트가 단순해지고 워처/복원 경로에서 재사용 가능하다(REQ-012/028).
- `useFileSystem.changeFolder`(`:116-129`): `window.confirm` 블록(`:117-123`) **삭제**, 대체 모달 없음(REQ-029).
- `AppLayout.handleNew`(`:119-123`) 및 `MarkdownEditor` `Mod-n`(`:178-187`): `requestGuardedAction(() => resetEditor + setCurrentFile(null) + setSaveStatus('new'))`로 감싼다(REQ-013).
- `AppLayout`에 `<ConfirmDialog>` 마운트(가드 훅 상태 바인딩).
- 매핑: REQ-012/013/028/029, AC-007/014.

### T8. [RED→GREEN] 윈도우 종료 가드 — `src/App.tsx` + `src-tauri/src/lib.rs`

> **V1 확인 완료 후 착수.**

- 프런트엔드: `@tauri-apps/api/window`의 `getCurrentWindow().onCloseRequested(async (event) => ...)` 리스너 등록(현재 이 모듈에서 아무것도 import하지 않음). dirty=false면 통과(REQ-019), true면 `event.preventDefault()` + 3버튼 모달 → `저장`/`저장 안 함` 시 실제 종료 실행, `취소` 시 중단(REQ-020).
- Rust(V1 결과가 필요하다고 판정한 경우): `lib.rs:16-74` 빌더 체인에 `.on_window_event(|window, event| { if let WindowEvent::CloseRequested { api, .. } = event { api.prevent_close(); ... } })` 추가. `.setup(...)`과 `.invoke_handler(...)` 사이 또는 그 뒤 — 기존 등록 순서를 깨지 않도록 체인 말미에 배치 권장.
- @MX: 리스너에 `@MX:WARN`(종료 경로 — 잘못 구현하면 앱이 닫히지 않거나 무경고로 데이터 손실) + `@MX:REASON` + `@MX:SPEC: SPEC-FS-003`.
- 테스트: `@tauri-apps/api/window` 모킹 기반 단위 테스트(`src/test/windowCloseGuard.test.ts`) — dirty false/true 분기, 3 선택지 각각의 후속, T6의 승격 경로 연동. **Playwright 불가**(Test Strategy 참조).
- **Rust 측 자동화 테스트는 작성하지 않는다.** `WindowEvent::CloseRequested`와 `CloseRequestApi`는 Tauri 런타임 없이 구성할 수 없고, 핸들러 본문을 순수 함수로 추출하면 검증 대상인 `api.prevent_close()` 호출이 그 함수 바깥에 남아 아무것도 검증하지 못한다. `on_window_event` 등록과 `prevent_close()` 존재는 **diff 리뷰**로 확인하고, 실제 동작은 수동 체크리스트로 확인한다. `cargo test`는 기존 컴파일 게이트 역할만 하며 AC-010의 근거로 제시하지 않는다.
- 매핑: REQ-018/019/020, AC-010.

### T9. [RED→GREEN] 워처 충돌 모달 — `src/App.tsx`

- `useFileWatcher` 콜백(`:34-41`)에 dirty 분기 추가. dirty=false면 기존 `readFile().then(setContent)` 유지(REQ-021).
- dirty=true면 자동 재로드 **중단** + 별도 모달. `actions` 배열은 **아래 순서 고정**:

```ts
actions: [
  { id: 'reload', label: '디스크에서 다시 읽기', variant: 'danger' },
  { id: 'cancel', label: '내 버전 유지', variant: 'primary' },
]
```

  마지막 항목이 primary + 초기 포커스라는 계약에 따라 **안전한 `내 버전 유지`가 기본 포커스**를 갖는다(REQ-022/034). **이 순서를 뒤집지 말 것** — 뒤집으면 Enter 연타로 사용자의 미저장 작업이 파괴된다.
- `'cancel'` → 내용 무변경 + dirty 유지 / `'reload'` → `readFile` 덮어쓰기 + `setDirty(false)`(REQ-023).
- 모달이 열린 동안 추가 워처 이벤트는 T6과 동일하게 폐기(REQ-024).
- @MX: `@MX:NOTE`(액션 순서가 안전 선택지 기본 포커스를 위한 의도적 배치임을 명시 — 재정렬 방지).
- 매핑: REQ-021/022/023/034, AC-011/016.

### T10. [GREEN] CSS — `src/styles/mdedit-components.css`

- `.md-dialog*` 클래스(백드롭 / 패널 / 타이틀 / 메시지 / 액션 바 / variant별 버튼 스타일).
- HARD: raw hex 금지, `--md-*` 토큰 + `currentColor`만. 다크모드는 `[data-theme="dark"]` 토큰 전환으로 자동(REQ-006, AC-002).
- 매핑: REQ-006, AC-002.

### T11. E2E + 회귀 가드 + 품질 게이트

- E2E(`e2e/unsaved-changes-guard.spec.ts`): acceptance.md AC-007/008/009/012/013 시나리오. **T2b 픽스처 완성이 선행 조건**(없으면 파일 트리가 비어 시나리오가 실행 불가). **종료 가드(AC-010)는 제외**.
- 회귀 가드: `window.confirm`/`onbeforeunload` grep 0건, `package.json` 의존성 무변경, `SettingsModal` 테스트 무변경, `EditorState` 계약 무변경.
- 게이트: `npm run typecheck` → `npm test` → `npm run lint` → `npm run test:e2e` → `cargo test`(T8이 Rust를 건드린 경우).
- 수동 검증 체크리스트 5건(`tauri dev`) 수행 및 결과 기록.
- 매핑: REQ-030~033, AC-014/015, Quality Gate Criteria.

### 실행 순서 및 의존성

```
T1 (Pre-RED 특성화 — 4항목으로 축소)
 └→ T2 (ConfirmDialog) ★최우선 — 머지 시 SPEC-EXPORT-002 언블록
      ├→ T3 (openFile dirty) ─┐
      │  T4 (saveDocument) ───┼→ T6 (가드 훅 + 종료 승격 + AI 취소) → T7 (트리거 배선) ─┐
      │  T5 (persist 제외) ───┘                                                          │
      ├→ T2b (E2E 가상 FS 픽스처) — T11의 E2E 층 선행 조건, T3~T7과 병행 가능 ──────────┤
      ├  V1 확인 → T8 (윈도우 종료) ────────────────────────────────────────────────────┼→ T11 (게이트)
      ├→ T9 (워처 모달) ───────────────────────────────────────────────────────────────┤
      └→ T10 (CSS) — T2 직후 언제든 병행 가능 ─────────────────────────────────────────┘
```

우선순위 근거:

1. **T2 (ConfirmDialog) 최우선** — SPEC-EXPORT-002가 이 컴포넌트에 블록되어 있고, `src/components/common/` 디렉터리 자체가 아직 없다. 두 SPEC이 병렬 실행되면 이 파일에 쓰기 충돌이 발생한다. T2 머지 = 언블록 신호.
2. **상태·저장 단일화(T3~T5)가 가드 트리거(T6~T7)보다 먼저** — 모달의 `저장` 버튼은 단일 `saveDocument()`에 의존한다. 저장이 5갈래로 갈라진 상태에서 가드를 붙이면 "어느 저장이 실행됐는지"에 따라 결과가 달라져 T6 테스트가 비결정적이 된다. 또한 T3(dirty 리셋)이 없으면 가드가 깨끗한 파일에도 발동해 E2E가 잘못된 기준선 위에서 통과한다.
3. **T8은 V1 확인 이후** — Tauri v2 종료 API 확인 없이 Rust와 프런트엔드를 동시에 건드리면 중복 구현 또는 "닫히지 않는 창"을 만든다.
4. **T9·T10은 T2 이후 독립** — 다른 태스크와 병행 가능.

## Risk Analysis & Mitigation

| # | 리스크 | 영향 | 완화 |
|---|--------|------|------|
| 1 | **ConfirmDialog 계약 위반** — Run phase에서 "더 편한" 시그니처로 바꾸고 싶은 유혹 | SPEC-EXPORT-002 파손, 두 SPEC 재작업 | 계약은 spec.md에 문자 그대로 고정. `ConfirmDialog.test.tsx`가 타입·동작을 어서션. 변경 필요 시 임의 수정 금지, 사용자에게 보고 |
| 2 | **워처 모달 액션 순서 반전** — "취소는 보통 왼쪽/첫 번째"라는 관습이 안전 기본값을 파괴 | Enter 연타로 미저장 작업 소실 | 배열 순서를 spec.md·plan.md·acceptance.md 3곳에 코드 블록으로 명시. AC-016이 `document.activeElement`를 직접 어서션. 코드에 `@MX:NOTE`로 의도 기록 |
| 3 | **폴더 이동 가드 "복원"** — 미래의 리뷰어가 제거를 누락으로 오인 | 허위 경고 재도입 → 경고 피로 → 진짜 가드 무력화 | T1에서 "폴더 이동이 문서를 건드리지 않음"을 테스트로 고정 + REQ-029에 회귀 방지 근거 문장 명시 |
| 4 | **Tauri v2 종료 API 오구현**(V1 미확인 시) | 창이 닫히지 않음 / 무경고 종료 | V1을 T8 착수 전 blocking 항목으로 지정. 추정 구현 금지 |
| 5 | **비동기 재진입 레이스** — 모달이 async인데 클릭은 동기 | 두 파일 동시 열림, 이중 저장 | T6의 `open || busy` 차단 + **큐잉 금지**(폐기). 전용 테스트 + E2E 연타 시나리오(AC-012) |
| 6 | **keymap 저장 경로의 스토어 우회** — `Mod-s`가 `view.state.doc`를 쓰고 `editorStore.content`를 신뢰하지 않음 | `saveDocument` 치환 시 최신 내용이 아닌 것을 저장할 위험 | T1 기준선으로 에디터→스토어 동기 타이밍 확인. 불일치 시 `saveDocument(contentOverride?)` 최소 확장으로 해결(계약 확대 최소화) |
| 7 | **`uiStore` persist 마이그레이션** — 기존 사용자 localStorage에 `saveStatus` 잔류 | 재시작 후에도 stale `unsaved` 지속(결함 미해결) | V2 확인 → 필요 시 persist `version` 증가 + `migrate`로 명시 제거. AC-004가 재hydration을 어서션 |
| 8 | **`App.tsx` 다중 관심사 집중** — 워처(T9) + 종료(T8) + 폴더 복원(기존 `:24-32`)이 한 파일에 | 회귀 범위 확대 | 각 태스크의 변경을 해당 콜백 내부로 국한하고 기존 폴더 복원 `useEffect`(`:24-32`)는 건드리지 않는다. 구조 분해는 요구사항이 없으므로 수행하지 않는다 |
| 9 | **`useFileSystem`의 `@MX:ANCHOR` 공개 계약** (`:1-3`, fan_in >= 3) | 시그니처 변경 시 FileExplorer/FileTreeNode/FileTree 파급 | `FileSystemHook` 인터페이스(`:23-32`) 시그니처 무변경 유지. 가드는 호출측에서 감싸는 방식(T7)이므로 hook 계약 불침범 |

## MX Tag Plan

`code_comments = ko`(`language.yaml`).

| 위치 | 태그 | 사유 |
|------|------|------|
| `ConfirmDialog.tsx` | `@MX:ANCHOR` + `@MX:REASON` + `@MX:SPEC: SPEC-FS-003` | 재사용 다이얼로그 공개 계약, SPEC-EXPORT-002와 공유(fan_in >= 2 예정) |
| `saveDocument.ts` | `@MX:ANCHOR` + `@MX:REASON` + `@MX:SPEC: SPEC-FS-003` | 저장 단일 진입점(fan_in >= 5). `forceDialog` 옵션으로 Save/Save As 분기 — 주석 계약이 옵션 파라미터를 반영해야 함(REQ-041~044) |
| `useUnsavedChangesGuard.ts` | `@MX:NOTE` + `@MX:SPEC: SPEC-FS-003` | 재진입 차단이 큐잉이 아닌 폐기인 이유 |
| `App.tsx` 종료 리스너 | `@MX:WARN` + `@MX:REASON` | 종료 경로 — 오구현 시 창이 닫히지 않거나 무경고 손실 |
| `App.tsx` 워처 모달 | `@MX:NOTE` | 액션 배열 순서가 안전 선택지 기본 포커스를 위한 의도적 배치임을 명시(재정렬 방지) |
| `useFileSystem.openFile` | `@MX:NOTE` | 전 분기 dirty 리셋 근거. 기존 `@MX:ANCHOR`(`:1-3`) 유지 |
| `lib.rs` `on_window_event` | `@MX:NOTE` + `@MX:SPEC: SPEC-FS-003` | `prevent_close` + 프런트엔드 위임 흐름. 기존 `@MX:ANCHOR`(`:1-3`) 유지 |

## Exclusions (Non-Goals)

spec.md "Exclusions (What NOT to Build)"와 동일 — 요약: 자동 저장 없음, 크래시 복구 없음, 다중 문서/탭 없음, 폴더 이동 가드 없음, `SettingsModal` 리팩토링 없음, 3-way 병합/diff 없음, `onbeforeunload` 미사용, 다이얼로그 i18n 없음, **`checkbox` prop 없음**(계약에서 삭제 — 소비자 0), **외부 삭제·이름변경 대응 없음**(워처는 `Modified`만 처리, `saveDocument` ENOENT 폴백 없음 — REQ-010이 실패를 눈에 보이게 만들므로 조용한 손실은 아님), `editorStore` 계약 변경 없음, `App.tsx` 구조 분해 없음.

## Quality Gates (TDD)

- RED-GREEN-REFACTOR 준수, 테스트 선행 필수(`test_first_required: true`). 브라운필드 영역은 Pre-RED 특성화 선행(T1).
- `npm run typecheck`(`tsc --noEmit`) 클린 · `npm test`(vitest) 전체 통과 · `npm run lint`(eslint) 통과 · `npm run test:e2e`(Playwright) 통과 · `cargo test` 통과(컴파일 게이트 — **AC-010의 검증 근거가 아님**).
- 커밋당 커버리지 80%+, 전체 목표 85%.
- LSP run 게이트: errors 0 / type errors 0 / lint errors 0.
- 윈도우 종료 가드 수동 검증 5건 완료 및 결과 기록(자동화 게이트 아님 — acceptance.md 참조).

## Related Documents

- `spec.md` — EARS 요구사항(REQ-FS-003-001~044, 027 결번) + ConfirmDialog Contract + 계약 불변식 INV-1/2/3 + Test Strategy + Delta
- `acceptance.md` — Given-When-Then 시나리오(AC-FS-003-001~023) + Quality Gate Criteria + 수동 검증 체크리스트(M1~M6) + Definition of Done
- 소비처: `.moai/specs/SPEC-EXPORT-002/` — `ConfirmDialog`(T2)와 E2E 가상 FS 픽스처(T2b)를 공유 소비. **본 SPEC T2 머지 이후 착수 가능**. 픽스처는 `export_save_dialog`를 추가 확장하는 방식이어야 하며 포크 금지
- 선례: `.moai/specs/SPEC-UI-008-diagram-insert-menu/{spec,plan,acceptance}.md`
