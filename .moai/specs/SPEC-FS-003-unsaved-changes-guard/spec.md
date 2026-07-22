---
id: SPEC-FS-003
version: "0.0.4"
status: draft
created: "2026-07-22"
updated: "2026-07-23"
author: "jw"
priority: high
issue_number: 0
dependencies:
  - SPEC-FS-001
  - SPEC-FS-002
  - SPEC-UI-002
  - SPEC-UI-003
  - SPEC-UI-006
  - SPEC-EDITOR-001
tags:
  - filesystem
  - editor
  - dirty-state
  - dialog
  - a11y
  - tauri
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.0.1 | 2026-07-22 | jw | 최초 SPEC 작성 — 미저장 변경 가드 전면 재설계. 사용자 확정 결정 반영: (1) 3버튼 인앱 커스텀 모달(취소/저장 안 함/저장), `window.confirm`·네이티브 다이얼로그 금지, (2) 가드 대상 경로 전수(탐색기 파일 클릭 / 새 문서 / 폴더 이동 / 파일 워처 자동 재로드 / 윈도우 종료), (3) 동반 결함 3건 동시 수정(`openFile`의 `setDirty(false)` 누락, dirty 이중 소스(`editorStore.dirty` vs 영속화되는 `uiStore.saveStatus`), 저장 로직 5중 중복), (4) 재사용 `ConfirmDialog` 컴포넌트를 본 SPEC이 소유하고 SPEC-EXPORT-002가 소비(계약 고정). 소스 조사 결과 폴더 이동 경로는 **문서를 폐기하지 않음**을 확인하여 요구사항을 "모달 추가"가 아닌 "허위 가드 제거"로 확정(REQ-FS-003-029). |
| 0.0.2 | 2026-07-22 | jw | 사용자 결정 3건 반영 — **D1** REQ-029(폴더 이동 허위 가드 제거) 승인 확정 + 회귀 방지 근거 문장 추가(일어날 수 없는 손실을 경고하면 사용자가 경고를 습관적으로 무시하게 되어 파일 전환의 진짜 가드까지 무력화됨). **D2** 워처 충돌 모달의 안전한 선택지(`내 버전 유지`)를 primary/초기 포커스로 확정 — ConfirmDialog 계약("마지막 항목이 primary + 초기 포커스")은 **동결**이므로 계약을 바꾸지 않고 `actions` 배열 순서를 뒤집어 안전 선택지를 마지막에 배치. REQ-022에 배열 순서를 문자 그대로 명시하고 초기 포커스 검증 AC(AC-016) 신설. **D3** open risk #4를 Design Note에서 정규 요구로 승격 — `saveDocument()`가 `watchedPath`를 Save As 기본 디렉터리로 전달(신 REQ-034, AC-017). open risk #3(`saveStatus` 표시 전용 유지)은 열린 질문이 아닌 **확정 결정**으로 재기록. open risk #1(Tauri v2 종료 API)은 plan.md의 Run phase 검증 항목으로 이관. 3-파일 구조 완성(plan.md·acceptance.md 신규) — spec.md의 dangling `acceptance.md` 참조 해소. |
| 0.0.3 | 2026-07-22 | jw | plan-auditor 리뷰 반영(anchor 검증 16/16 통과, REQ-029 조사 승인). **C1** `checkbox` prop을 계약에서 **완전 삭제** — 본 SPEC과 SPEC-EXPORT-002 어느 쪽도 소비하지 않음이 확인됨(EXPORT-002가 4곳에서 미사용 명시). EXPORT-002 소비 주장 3건 제거, 미래 확장 노트도 남기지 않음. 계약 미정의 3건 확정: INV-1(마지막 항목이 `danger`일 때 `variant`가 스타일을 이기고 포커스는 위치 규칙 유지), INV-2(`'default'`는 `undefined`의 명시적 등가값), INV-3(`'cancel'` id 항목 필수 — Escape·백드롭 라우팅의 데이터 안전 근거, 신 REQ-036이 개발 빌드에서 강제). **C2** `e2e/fixtures/tauri-mock.ts`가 널 스텁이라 선언 E2E 6개 중 5개가 실행 불가함을 확인 — 가상 FS 픽스처를 명시적 산출물로 승격(Delta 표 + AC-022 + plan T2b). **H3** 종료 deadlock 해소 — REQ-024/025가 종료 요청까지 삼켜 창이 영구히 닫히지 않는 문제를 신 REQ-037(열린 모달의 종료 승격)로 해결하고 원래 의도 동작 처리를 명시. **H4** AI 스트리밍 상호작용 신설(REQ-038/039/040) — `MarkdownEditor.tsx:222-232`가 AI 기록에도 `dirty=true`를 세우고 `isExternalUpdateRef`는 파일 열기(`:100`)에만 적용됨을 확인. 스트리밍 중 `저장 안 함` → 잔여 청크가 새로 연 파일을 오염시켜 REQ-011을 무력화하는 경로를 `aiCancel` 선행 호출로 차단. **H5** AC-010의 Rust 테스트 층이 검증 불가함을 인정하고 diff 리뷰로 정정, `cargo test` 게이트 주장 철회. 기타: REQ-016→029 오인용 수정, "001~033"→"001~040", **REQ-027 삭제**(REQ-026에 완전 포함되어 아무것도 제약하지 않음, 결번 처리), REQ-024 커버리지 인플레 해소(AC-012에 새 문서·워처 케이스 추가), AC-002/004를 `[review]` 기준으로 라벨링, 외부 삭제·이름변경을 명시적 non-goal로 기록. |
| 0.0.4 | 2026-07-23 | jw | **REQ-018 V1 해소 개정** — Run phase 검증(node_modules/@tauri-apps/api/window.js `onCloseRequested` 래퍼 분석)으로 프런트엔드 `getCurrentWindow().onCloseRequested()` + `event.preventDefault()`만으로 윈도우 종료 보류가 충분함을 확인했다(랩퍼는 `preventDefault()` 미호출 시에만 `destroy()` 자동 호출). 따라서 Rust `on_window_event` + `api.prevent_close()`는 **불필요**해 `lib.rs`를 무변경으로 유지했다. **REQ-018을 "Rust 의무"에서 "프런트엔드(또는 동등 Rust)"로 완화**하고, 연관 5곳(Environment·REQ 본문·Test Strategy·Delta·AC-010·Design Notes)을 동일 정합성으로 갱신했다. 실제 종료 동작(dirty=false 즉시 종료 / dirty=true 3버튼 모달 후 `destroy()` / 취소 시 유지)은 사용자 macOS 확인 완료 상태로 무변경. |

## Summary

`mdedit`(Tauri v2 + React 18 + TypeScript + CodeMirror 6)에서 미저장 변경사항 보호를 전면 재설계한다.

현재는 파일 열기와 폴더 변경 두 경로에만 `window.confirm` 기반 2지선다(확인/취소) 가드가 있고, 새 문서·파일 워처 자동 재로드·윈도우 종료 경로에는 가드가 전혀 없다. `window.confirm`은 "저장" 선택지를 제공할 수 없어 사용자가 **작업을 버리거나 이동을 포기하거나** 둘 중 하나만 고르게 강요한다.

본 SPEC은 다음을 정의한다.

1. **재사용 가능한 인앱 모달 컴포넌트** `src/components/common/ConfirmDialog.tsx` 신설. 계약(props 타입)은 본 SPEC이 소유하며 고정이다(SPEC-EXPORT-002가 동일 컴포넌트를 소비).
2. **3버튼 미저장 변경 가드**: `취소` / `저장 안 함` / `저장`. `저장` 선택 시 저장이 **완료된 뒤** 원래 의도한 동작이 이어서 수행된다.
3. **가드 적용 경로 전수화**: 탐색기 파일 클릭, 새 문서(버튼 + `Mod-n`), 윈도우 종료. 파일 워처 자동 재로드는 사용자 주도 이동이 아니므로 **문구·선택지가 다른 별도 모달**로 처리한다.
4. **동반 결함 3건 수정**: `openFile`의 dirty 리셋 누락, dirty 상태 이중 소스(영속화된 stale `unsaved` 포함), 저장 로직 5중 중복.

핵심 설계 결정(사용자 승인, 재검토 금지):

- **모달 방식**: 인앱 커스텀 모달 고정. `window.confirm`·`window.onbeforeunload`·Tauri 네이티브 다이얼로그(`tauri_plugin_dialog` ask/confirm) 미사용.
- **버튼 3종 의미**: `저장`=저장 완료 후 원래 동작 진행 / `저장 안 함`=변경 폐기 후 원래 동작 진행 / `취소`·Escape·백드롭=원래 동작 중단, 에디터 상태 무변경.
- **ConfirmDialog 소유권**: 본 SPEC이 컴포넌트와 props 계약을 소유한다. **SPEC-EXPORT-002보다 먼저 착수·완료되어야 한다**(순서 의존).
- **워처 모달 분리**: 외부 파일 변경 재로드는 "내 버전 유지 / 디스크에서 다시 읽기" 의미의 별도 문구·선택지를 사용한다. 저장/폐기 3버튼 세트를 재사용하지 않는다.
- **종료 승격**: 모달이 이미 열린 상태에서 종료 요청이 오면 기존 모달이 종료까지 처리하도록 승격된다. 종료 요청을 재진입 차단으로 폐기하면 창이 영구히 닫히지 않는다(REQ-037).
- **AI 스트리밍 취소**: 가드가 `저장`/`저장 안 함`으로 해소될 때 진행 중인 AI 요청을 `aiCancel`로 먼저 취소한다. 취소하지 않으면 잔여 스트림 청크가 새로 연 파일의 버퍼에 흘러들어간다(REQ-038).

## Background & Rationale

### 현재 동작(소스 근거)

| 경로 | 진입점 | 현재 가드 |
|------|--------|-----------|
| 탐색기 파일 클릭 | `FileTreeNode.tsx:152` → `useFileSystem.openFile` (`useFileSystem.ts:139`) | `window.confirm` (`useFileSystem.ts:141-149`) — 2지선다, 저장 선택지 없음 |
| 새 문서(버튼) | `AppLayout.handleNew` (`AppLayout.tsx:119-123`) | **없음** — `resetEditor()` 즉시 실행 |
| 새 문서(단축키) | `MarkdownEditor.tsx` `Mod-n` keymap (`:178-187`) | **없음** — `resetEditorRef.current()` 즉시 실행 |
| 폴더 이동 | `openFolder` (`useFileSystem.ts:67`), `openFolderPath` (`:91`), `changeFolder` (`:116`) | `changeFolder`만 `window.confirm` (`:117-123`) |
| 워처 자동 재로드 | `App.tsx:34-41` | **없음** — `readFile().then(setContent)` 즉시 덮어쓰기 |
| 윈도우 종료 | 없음 (`src-tauri/src/lib.rs:16-74` 빌더 체인에 `on_window_event` 미등록) | **없음** — 무경고 종료 |

### 소스 조사로 확인된 사실 — 폴더 이동은 문서를 폐기하지 않는다

`openFolder`(`useFileSystem.ts:67-89`)와 `openFolderPath`(`:91-113`)는 `readDirectory` → `setWatchedPath` → `setFileTree` → `setLastWatchedPath` → `registerAssetScope`/`startWatch`만 수행하며, **`setContent`·`setCurrentFilePath`·`resetEditor`를 호출하지 않는다.** 즉 폴더를 이동해도 에디터에 열린 문서와 그 미저장 변경사항은 그대로 유지된다.

따라서 `changeFolder`(`:116-129`)의 `window.confirm("...discard them and change folder?")`는 **실제로 일어나지 않는 데이터 손실을 경고하는 허위 가드**이며, 사용자를 불필요하게 중단시킨다. 본 SPEC은 폴더 이동 경로에 모달을 추가하는 대신 이 허위 가드를 **제거**한다(REQ-FS-003-029). 폴더 클릭(`FileTreeNode.tsx:148`)과 상위 이동(`FileExplorer.tsx:86`)은 원래 가드가 없었으므로 무변경이다.

### 동반 결함 3건

**결함 A — `openFile`이 dirty를 리셋하지 않는다.**
`openFile`(`useFileSystem.ts:154-228`)의 5개 분기(html / raster image / svg / too-large / text·binary) 전부가 `useUIStore.setSaveStatus('saved')`만 호출하고 `useEditorStore.setDirty(false)`를 호출하지 않는다. 결과적으로 dirty 상태에서 파일을 열면(폐기 선택 후에도) `editorStore.dirty`가 `true`로 남아, 깨끗한 새 파일을 연 직후 다시 파일을 클릭하면 **변경한 적이 없는데도 가드가 또 뜬다.**

**결함 B — dirty 상태 이중 소스.**
- `editorStore.dirty: boolean` (`editorStore.ts:15`) — 가드 판정에 사용
- `uiStore.saveStatus: SaveStatus` (`uiStore.ts:34`) — 헤더/Footer UI 표시에 사용

두 값은 항상 수동으로 함께 갱신되며 위 결함 A처럼 어긋난다. 더 나쁜 것은 `uiStore`가 persist 미들웨어를 쓰고 `partialize`가 `statusMessage`만 제외한다는 점이다(`uiStore.ts:158-165`). 따라서 `saveStatus: 'unsaved'`가 localStorage(`mdedit-ui-store`)에 저장되어 **앱을 재시작해도 stale `unsaved` 배지가 남는다.** 실제 문서는 빈 새 버퍼인데도 "저장 안 됨"으로 표시된다.

**결함 C — 저장 로직 5중 중복.**
| 위치 | 특징 |
|------|------|
| `AppLayout.handleSave` (`AppLayout.tsx:103-117`) | 경로 없으면 `handleSaveAs` 위임 |
| `AppLayout.handleSaveAs` (`:82-101`) | `watchedPath`를 기본 디렉터리로 전달 |
| `useFileSystem.saveFileAs` (`useFileSystem.ts:231-250`) | 기본 디렉터리 전달 **안 함** |
| `MarkdownEditor` `Mod-s` (`:113-152`) | IPC 직접 호출, `view.state.doc` 사용(스토어 우회) |
| `MarkdownEditor` `Mod-Shift-s` (`:153-177`) | 동일하게 스토어 우회 |

동작이 미묘하게 다르며(기본 디렉터리 유무, 스토어 우회 여부), 모달의 `저장` 버튼이 어느 구현을 호출하느냐에 따라 결과가 달라진다. 가드가 신뢰 가능하려면 **단일 저장 함수로 수렴**해야 한다.

### 재사용 모달 부재

리포지토리에 재사용 가능한 Dialog 컴포넌트가 없다. 유일한 모달 선례는 `src/components/settings/SettingsModal.tsx:78`(백드롭 `:112-117`, Escape 처리 `:97-105`)이며 설정 전용으로 하드코딩되어 있다. 본 SPEC이 이 패턴을 일반화한 `ConfirmDialog`를 신설한다.

## Environment & Assumptions

- 프론트엔드: React 18, TypeScript strict, CodeMirror 6, Zustand(+persist), Tailwind CSS 3 + SPEC-UI-006 `.md-*` 토큰.
- 백엔드: Tauri v2, Rust. 빌더 체인은 `src-tauri/src/lib.rs:16-74`.
- 윈도우 종료 가드는 Rust `on_window_event` + `WindowEvent::CloseRequested` + `api.prevent_close()`와 프런트엔드 `@tauri-apps/api/window`의 `getCurrentWindow().onCloseRequested()` 리스너 조합을 전제한다. 현재 프런트엔드는 `@tauri-apps/api/window`에서 아무것도 import하지 않지만, Run phase V1 검증으로 `getCurrentWindow().onCloseRequested()` + `event.preventDefault()` 단독으로 종료 보류가 충분함을 확인해 Rust `on_window_event` 없이 구현했다(저장·폐기 확정 시 `getCurrentWindow().destroy()`로 닫는다).
- AI: `aiStore`(`src/store/aiStore.ts:8` `AiRequestState = 'idle' | 'streaming' | 'done' | 'error'`, `requestId` 보유, persist 미적용 트랜지언트), `aiCancel(requestId)` IPC 래퍼(`ai-suggestion-card.ts:13` 등에서 이미 사용 중). AI 기록도 일반 dispatch를 거치므로 `MarkdownEditor.tsx:222-232`에서 `dirty=true`가 된다 — `isExternalUpdateRef`는 파일 열기 dispatch(`:100`)에만 세워지므로 AI 기록에는 적용되지 않는다(확인 완료).
- 테스트 게이트: `npm run lint`(eslint, PR #37로 복구), `npm run typecheck`(`tsc --noEmit`), `npm test`(vitest + @testing-library/react + jsdom), `npm run test:e2e`(Playwright).
- E2E 픽스처: `e2e/fixtures/tauri-mock.ts`는 현재 모든 IPC에 `null`을 반환하는 24줄 스텁이다. 본 SPEC의 E2E는 이를 가상 파일시스템 목으로 확장하는 것을 전제한다.
- **Playwright E2E는 Vite dev 서버(브라우저) 대상으로 실행되며 Tauri 런타임이 없다.** `@tauri-apps/api/window`·IPC는 모킹되거나 부재한다. 이 제약이 REQ-FS-003-011의 검증 전략을 결정한다(아래 Test Strategy 참조).

## ConfirmDialog Contract (본 SPEC 소유 — 고정)

`src/components/common/ConfirmDialog.tsx`는 아래 계약을 **정확히** 노출한다. SPEC-EXPORT-002가 동일 컴포넌트를 소비하므로 계약 변경은 두 SPEC 동시 개정을 요구한다.

```ts
export type DialogActionVariant = 'primary' | 'danger' | 'default';

export interface DialogAction {
  id: string;
  label: string;
  variant?: DialogActionVariant;
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  actions: DialogAction[];        // rendered left-to-right; last item is the primary/default
  onAction: (id: string) => void; // Escape and backdrop click both emit 'cancel'
}
```

### 계약 불변식 (두 SPEC 공유 — 반드시 준수)

계약이 두 SPEC에 걸쳐 동결되므로, 아래 세 가지 미정의 사항을 여기서 확정한다.

- **INV-1 (마지막 항목이 `danger`인 경우)**: REQ-003은 위치(마지막)로 primary 자격을 부여하고 `variant`는 스타일을 지정한다. 둘이 충돌하면 **`variant`가 시각 스타일을 이긴다**. 즉 마지막 항목이 `variant: 'danger'`이면 danger 스타일로 렌더되지만 **초기 포커스는 그대로 마지막 항목이 받는다**(위치 규칙은 포커스에만, `variant`는 스타일에만 적용). 파괴적 액션에 초기 포커스를 주고 싶지 않다면 배열 순서를 바꿔야 하며(REQ-022가 정확히 이 방법을 쓴다), 계약을 바꾸어서는 안 된다.
- **INV-2 (`'default'` variant의 존재 이유)**: `'default'`는 `variant`를 생략했을 때의 명시적 등가값이다(중립 스타일). 두 SPEC 모두 생략 형태를 쓰므로 실사용은 없으나, 소비자가 조건부로 `variant`를 계산할 때 `undefined` 대신 쓸 수 있는 명시적 값으로 enum에 유지한다. 구현은 `undefined`와 `'default'`를 동일하게 처리해야 한다.
- **INV-3 (`'cancel'` id는 예약어이며 필수)**: `onAction`은 Escape·백드롭 클릭 시 `'cancel'`을 emit한다. 따라서 **모든 소비자는 `actions` 배열에 `id: 'cancel'` 항목을 정확히 하나 포함해야 한다.** 이 항목이 없으면 Escape·백드롭이 아무 핸들러에도 매칭되지 않는 무음 실패가 되고, REQ-022는 이 규칙을 데이터 안전성의 근거로 삼는다(Escape가 `내 버전 유지`로 라우팅되는 것이 곧 안전한 기본 동작). 이는 관례가 아니라 **강제 불변식**이며, `ConfirmDialog`는 개발 빌드에서 `'cancel'` 항목 부재를 감지해 콘솔 오류를 출력해야 한다(REQ-FS-003-036).

본 SPEC의 미저장 변경 가드는 다음 `actions` 배열을 사용한다.

```ts
actions: [
  { id: 'cancel',  label: '취소' },
  { id: 'discard', label: '저장 안 함' },
  { id: 'save',    label: '저장', variant: 'primary' },
]
```

## Requirements (EARS)

### Ubiquitous Requirements — ConfirmDialog 컴포넌트

- **REQ-FS-003-001**: The system **shall** 항상 `src/components/common/ConfirmDialog.tsx`에서 위 "ConfirmDialog Contract" 절에 명시된 타입(`DialogActionVariant`, `DialogAction`, `ConfirmDialogProps`)을 그대로 export한다.
- **REQ-FS-003-002**: The system **shall** 항상 `open`이 true인 동안 백드롭 요소와 `role="dialog"` 및 `aria-modal="true"` 속성을 가진 다이얼로그 요소를 렌더한다.
- **REQ-FS-003-003**: The system **shall** 항상 `actions` 배열의 각 항목을 배열 순서대로(좌→우) 버튼으로 렌더하고, 마지막 항목에 기본(primary) 시각 스타일과 초기 포커스를 부여한다.
- **REQ-FS-003-004**: The system **shall** 항상 다이얼로그가 열려 있는 동안 Tab/Shift+Tab 포커스를 다이얼로그 내부 요소로 순환 제한(focus trap)하고, 닫힐 때 다이얼로그를 연 트리거 요소로 포커스를 복귀시킨다.
- **REQ-FS-003-005**: The system **shall** 항상 다이얼로그 루트와 각 액션 버튼에 Playwright에서 참조 가능한 `data-testid` 속성을 부여한다.
- **REQ-FS-003-006**: The system **shall** 항상 다이얼로그·백드롭·버튼 스타일을 `--md-*` 시맨틱 토큰과 `currentColor`만으로 렌더한다(raw hex 색상 리터럴 금지).

### Ubiquitous Requirements — 상태·저장 단일화

- **REQ-FS-003-007**: The system **shall** 항상 `editorStore.dirty`를 미저장 변경 여부의 **단일 진실 공급원(single source of truth)** 으로 사용한다. `uiStore.saveStatus`는 표시 전용 파생값이며, 어떤 가드 판정도 `saveStatus`를 읽지 않는다.
- **REQ-FS-003-008**: The system **shall** 항상 `uiStore`의 persist `partialize`에서 `saveStatus`를 제외하여 localStorage(`mdedit-ui-store`)에 저장되지 않게 한다. 앱 시작 시 `saveStatus`는 항상 초기값에서 출발한다.
- **REQ-FS-003-009**: The system **shall** 항상 저장 동작을 단일 함수(예: `saveDocument()` — 현재 파일 경로가 있으면 덮어쓰기, 없으면 Save As로 위임)를 통해 수행하고, `AppLayout` 저장 버튼·`Mod-s`·`Mod-Shift-s`·모달의 `저장` 버튼이 모두 그 함수를 호출하게 한다.
- **REQ-FS-003-010**: The system **shall** 항상 `saveDocument()` 성공 시 `editorStore.setDirty(false)`와 `uiStore.setSaveStatus('saved')`를 함께 수행하고, 실패 시 `dirty`를 `true`로 유지한다.
- **REQ-FS-003-011**: The system **shall** 항상 `useFileSystem.openFile`의 모든 분기(html / raster image / svg / too-large / text / binary)에서 파일 로드 성공·실패와 무관하게 `editorStore.setDirty(false)`를 호출한다.

### Event-Driven Requirements — 가드 트리거

- **REQ-FS-003-012**: **WHEN** `editorStore.dirty`가 true인 상태에서 사용자가 탐색기에서 파일을 클릭하면(`FileTreeNode.tsx:152` → `openFile`), **the system shall** 파일을 열기 전에 3버튼 미저장 변경 모달(`취소`/`저장 안 함`/`저장`)을 표시한다.
- **REQ-FS-003-013**: **WHEN** `editorStore.dirty`가 true인 상태에서 사용자가 새 문서를 실행하면(`AppLayout.handleNew` 또는 `Mod-n` keymap), **the system shall** `resetEditor()` 실행 전에 동일한 3버튼 모달을 표시한다.
- **REQ-FS-003-014**: **WHEN** 미저장 변경 모달에서 `저장`이 선택되면, **the system shall** `saveDocument()`를 실행하여 **저장이 완료된 뒤에** 원래 의도한 동작(파일 열기 / 새 문서 / 종료)을 수행한다.
- **REQ-FS-003-015**: **WHEN** 미저장 변경 모달에서 `저장 안 함`이 선택되면, **the system shall** 저장 없이 원래 의도한 동작을 즉시 수행한다(변경사항 폐기).
- **REQ-FS-003-016**: **WHEN** 미저장 변경 모달에서 `취소`가 선택되거나 Escape 키가 눌리거나 백드롭이 클릭되면, **the system shall** 원래 의도한 동작을 중단하고 `editorStore`의 `content`·`dirty`·`currentFilePath`를 변경하지 않는다.
- **REQ-FS-003-017**: **WHEN** `저장` 선택 후 `saveDocument()`가 실패하거나 Save As 다이얼로그가 사용자에 의해 취소되면, **the system shall** 원래 의도한 동작을 수행하지 않고 `dirty`를 true로 유지한다(암묵적 데이터 손실 금지).

### Event-Driven Requirements — 윈도우 종료

- **REQ-FS-003-018**: **WHEN** 사용자가 윈도우 닫기를 시도하면, **the system shall** 프런트엔드 `getCurrentWindow().onCloseRequested()` 리스너에서 `event.preventDefault()`를 호출하여 종료를 보류한다(V1 검증으로 프런트엔드 단독이 충분함이 확인됨 — Rust `on_window_event` + `api.prevent_close()` 경로는 동등 대안이나 본 구현에서는 미사용). 사용자가 가드 모달에서 저장·폐기를 확정하면 `getCurrentWindow().destroy()`로 실제 종료하고, 취소하면 창을 유지한다.
- **REQ-FS-003-019**: **WHEN** 종료 요청 수신 시 `editorStore.dirty`가 false이면, **the system shall** 모달을 표시하지 않고 즉시 윈도우를 닫는다.
- **REQ-FS-003-020**: **WHEN** 종료 요청 수신 시 `editorStore.dirty`가 true이면, **the system shall** 3버튼 모달을 표시하고, `저장`이면 저장 완료 후 종료, `저장 안 함`이면 즉시 종료, `취소`면 종료를 취소하고 앱을 계속 실행한다.

### Event-Driven Requirements — 파일 워처(별도 문구)

- **REQ-FS-003-021**: **WHEN** 파일 워처가 현재 열린 파일의 외부 수정을 감지했고(`App.tsx:34-41`, `event.kind === 'Modified' && event.path === currentFilePath`) `editorStore.dirty`가 false이면, **the system shall** 모달 없이 기존과 동일하게 디스크 내용으로 자동 재로드한다.
- **REQ-FS-003-022**: **WHEN** 동일 조건에서 `editorStore.dirty`가 true이면, **the system shall** 자동 재로드를 수행하지 않고 **미저장 변경 모달과 구분되는 별도 모달**을 표시한다. 문구는 "이 파일이 외부에서 변경되었습니다" 취지로 사용자 주도 이동이 아님을 알린다. 이 모달의 `actions` 배열은 **아래 순서 그대로** 사용한다(순서 반전 금지).

```ts
actions: [
  { id: 'reload', label: '디스크에서 다시 읽기', variant: 'danger' },
  { id: 'cancel', label: '내 버전 유지', variant: 'primary' },
]
```

  ConfirmDialog 계약은 "마지막 항목이 primary + 초기 포커스"로 **동결**되어 있으므로(SPEC-EXPORT-002 공유), 파괴적 선택지가 기본 포커스를 갖지 않게 하려면 계약이 아닌 **배열 순서**로 해결해야 한다. 따라서 안전한 선택지 `내 버전 유지`가 배열 마지막에 온다. `cancel` id를 안전 선택지에 부여하는 것은 계약상 Escape·백드롭이 `'cancel'`을 emit하기 때문이며(안전한 기본 동작), 의도적이다.
  초기 포커스 요구는 REQ-FS-003-034를 참조한다.
- **REQ-FS-003-023**: **WHEN** 워처 모달에서 `내 버전 유지`가 선택되거나 Escape/백드롭으로 닫히면, **the system shall** 에디터 내용을 변경하지 않고 `dirty`를 true로 유지한다. `디스크에서 다시 읽기`가 선택되면 `readFile` 결과로 내용을 덮어쓰고 `dirty`를 false로 설정한다.

### State-Driven Requirements

- **REQ-FS-003-024**: **WHILE** 미저장 변경 모달 또는 워처 모달이 열려 있는 동안, **the system shall** 신규 가드 트리거 중 **파일 클릭·새 문서·워처 이벤트**를 무시하고 두 번째 모달을 중첩 표시하지 않으며, 두 개의 파일을 열거나 두 번의 저장을 수행하지 않는다. **종료 요청은 이 무시 대상에서 제외되며 REQ-FS-003-037이 규정하는 승격 처리를 받는다.**
- **REQ-FS-003-025**: **WHILE** 이전 가드의 비동기 처리(사용자 선택 대기 또는 `saveDocument()` 진행)가 완료되지 않은 동안 발생한 후속 트리거는, **the system shall** 큐잉하지 않고 폐기한다(마지막 클릭 승자 방식 금지 — 사용자가 명시적으로 다시 조작해야 한다). **단 종료 요청은 폐기 대상이 아니다**(REQ-FS-003-037) — 폐기하면 창이 영구히 닫히지 않는다.
- **REQ-FS-003-026**: **WHILE** `editorStore.dirty`가 false인 동안, **the system shall** 어떤 경로에서도 미저장 변경 모달을 표시하지 않고 의도한 동작을 즉시 수행한다.
- ~~**REQ-FS-003-027**~~: **[v0.0.3 삭제 — 결번]** 원문은 "빈 미편집 새 버퍼에서 모달 미표시"였으나, 그 조건(`content === ''` **그리고** `dirty === false`)은 REQ-026의 조건(`dirty === false`)에 연언을 더한 것이고 적용 경로도 REQ-026의 부분집합이었다. 즉 REQ-026이 이미 전부 함의하므로 아무것도 추가로 제약하지 않았다. 번호는 재사용하지 않는다.

### Unwanted Behavior Requirements

- **REQ-FS-003-028**: The system **shall not** 미저장 변경 경고에 `window.confirm`, `window.alert`, `window.onbeforeunload`, 또는 Tauri 네이티브 다이얼로그(`tauri_plugin_dialog`의 ask/confirm)를 사용한다. 기존 `useFileSystem.ts:143`의 `window.confirm` 호출은 제거된다.
- **REQ-FS-003-029**: The system **shall not** 폴더 이동 경로(`openFolder`, `openFolderPath`, `changeFolder`, 폴더 클릭 `FileTreeNode.tsx:148`, 상위 이동 `FileExplorer.tsx:86`)에 미저장 변경 가드를 적용한다. 이 경로들은 에디터 내용을 교체하지 않으므로(Background 절 조사 결과) `changeFolder`의 기존 `window.confirm`(`useFileSystem.ts:117-123`)은 **삭제**되고 대체 모달을 두지 않는다.

  **회귀 방지 근거(제거를 "누락"으로 오인해 복원하지 말 것)**: 실제로 발생할 수 없는 손실을 경고하는 다이얼로그는 사용자에게 "이 경고는 무시해도 안전하다"를 반복 학습시켜, 정작 데이터가 실제로 사라지는 파일 전환 경로의 진짜 가드까지 습관적으로 dismiss하게 만든다. 허위 가드를 남겨두는 것은 가드가 없는 것보다 나쁘다.
- **REQ-FS-003-030**: The system **shall not** 신규 런타임 의존성(모달/다이얼로그/focus-trap 라이브러리 등)을 추가한다(`package.json` dependencies 무변경). `@tauri-apps/api`는 이미 존재하는 의존성이므로 신규 추가에 해당하지 않는다.
- **REQ-FS-003-031**: The system **shall not** `SettingsModal.tsx`의 기존 동작·마크업·테스트를 변경한다. `ConfirmDialog`는 그 패턴을 참조하되 별도 컴포넌트로 신설된다(SettingsModal 리팩토링은 범위 밖).
- **REQ-FS-003-032**: The system **shall not** `editorStore`의 기존 public 계약(`EditorState` 필드 및 액션 시그니처, `@MX:ANCHOR`)을 변경한다. dirty 단일화는 `saveStatus` 소비 측 파생으로 달성한다.
- **REQ-FS-003-033**: The system **shall not** 자동 저장(auto-save), 문서 복구(crash recovery), 다중 탭/다중 문서를 도입한다.

### Additional Requirements (v0.0.2 / v0.0.3 추가)

> 아래 요구들은 v0.0.2 이후 추가되었다. 기존 번호의 전면 재번호로 인한 cross-reference 교란을 피하기 위해 말미에 배치했으며, 소속 EARS 카테고리를 각 항목에 명시한다.

- **REQ-FS-003-034** *(Event-Driven)*: **WHEN** 워처 충돌 모달(REQ-FS-003-022)이 열리면, **the system shall** 안전한 선택지인 `내 버전 유지` 버튼에 초기 포커스를 부여하고 primary 시각 스타일을 적용한다. `디스크에서 다시 읽기`는 초기 포커스를 갖지 않으며 `danger` 시각 스타일로 렌더된다.
- **REQ-FS-003-035** *(Ubiquitous)*: The system **shall** 항상 `saveDocument()`가 Save As 다이얼로그를 여는 모든 경우에 `fileStore.watchedPath`(존재 시)를 기본 디렉터리로 전달한다. 진입 경로(헤더 저장 버튼 / `Mod-s` / `Mod-Shift-s` / 모달 `저장`)에 따라 기본 디렉터리가 달라지지 않는다.
- **REQ-FS-003-036** *(Ubiquitous)*: The system **shall** 항상 개발 빌드(`import.meta.env.DEV`)에서 `ConfirmDialog`가 렌더될 때 `actions` 배열에 `id === 'cancel'` 항목이 정확히 하나 존재하는지 검사하고, 없으면 콘솔 오류를 출력한다(계약 불변식 INV-3 강제). 프로덕션 빌드에서는 검사를 수행하지 않는다.

#### 윈도우 종료 승격 (deadlock 해소)

- **REQ-FS-003-037** *(Event-Driven)*: **WHEN** 미저장 변경 모달 또는 워처 모달이 이미 열려 있는 상태에서 윈도우 종료 요청이 도착하면, **the system shall** 종료 요청을 폐기하거나 두 번째 모달을 띄우지 않고 **이미 열려 있는 모달을 종료 요청까지 처리하도록 승격**한다. 승격된 모달은 화면상 변화 없이 그대로 유지되며(사용자는 두 번째 다이얼로그를 보지 않는다), 이후 해소는 다음과 같다.
  - `저장` → 저장 완료 후 **원래 의도한 동작(예: 파일 B 열기)을 수행하지 않고** 곧바로 윈도우를 닫는다. 창이 닫히는 마당에 파일 B를 여는 것은 관측 불가능한 낭비이며, 사용자의 마지막 의사표시는 "닫기"다.
  - `저장 안 함` → 저장 없이 곧바로 윈도우를 닫는다. 원래 의도한 동작은 마찬가지로 수행하지 않는다.
  - `취소` / Escape / 백드롭 → **종료와 원래 의도한 동작을 모두 중단**한다. 창은 닫히지 않고 에디터 상태도 변경되지 않으며, 승격 상태가 해제되어 이후 다시 종료를 시도할 수 있다.
  - 워처 모달이 승격된 경우: `내 버전 유지`(= `'cancel'`)는 위 `취소`와 동일하게 종료를 중단한다(안전 기본). `디스크에서 다시 읽기`는 재로드를 수행한 뒤 윈도우를 닫는다.

#### AI 스트리밍 상호작용

- **REQ-FS-003-038** *(Event-Driven)*: **WHEN** 미저장 변경 모달이 `저장` 또는 `저장 안 함`으로 해소되는 시점에 `aiStore.requestState === 'streaming'`이면, **the system shall** 의도한 동작을 수행하기 **전에** `aiCancel(requestId)`를 호출하여 진행 중인 AI 요청을 취소하고 `aiStore`를 idle 상태로 되돌린다. 취소 완료 이후에만 저장·파일 열기·종료가 진행된다.
- **REQ-FS-003-039** *(State-Driven)*: **WHILE** AI 스트리밍이 진행 중인 동안 미저장 변경 모달이 표시되면, **the system shall** 모달 메시지에 진행 중인 AI 응답이 중단된다는 사실을 알리는 문구를 포함한다. AI 스트리밍이 진행 중이 아니면 이 문구를 표시하지 않는다.
- **REQ-FS-003-040** *(Ubiquitous)*: The system **shall** 항상 스트리밍 도중 `저장`이 선택된 경우 **그 시점까지 버퍼에 기록된 부분 생성 결과를 그대로 저장한다**. 부분 응답을 잘라내거나 저장을 스트림 완료까지 지연시키지 않는다. 근거: 에디터 버퍼가 곧 문서이며, 사용자가 화면에서 보고 있는 내용과 디스크에 기록되는 내용이 달라지는 것이 부분 저장보다 나쁘다. REQ-FS-003-039의 고지 문구가 이 결과를 사전에 알린다.

## Test Strategy

리포지토리 게이트는 eslint + tsc + vitest + Playwright 4종이다. 요구사항별 검증 층위는 다음과 같다.

### 단위 테스트 (vitest + @testing-library/react + jsdom)

| 대상 | 커버 REQ |
|------|----------|
| `ConfirmDialog.test.tsx` — 렌더/`role`·`aria-modal`/액션 순서·primary/Escape·백드롭→`'cancel'`/focus trap/포커스 복귀/`data-testid` | 001–006 |
| `saveDocument.test.ts` — 경로 유무 분기, 성공 시 dirty/saveStatus 동기, 실패 시 dirty 유지, Save As 시 `watchedPath` 기본 디렉터리 전달 | 009, 010, 035 |
| `useFileSystem.openFile` 확장 테스트 — 5개 분기 전부 `setDirty(false)` 호출 확인 | 011 |
| `uiStore` persist 테스트 — `partialize` 결과에 `saveStatus` 부재 | 008 |
| 가드 훅 테스트 — 저장/폐기/취소 각각의 후속 동작, 저장 실패 시 중단, 모달 열린 동안 재진입 차단 | 012–017, 024–027 |
| 워처 가드 테스트 — dirty false 자동 재로드, dirty true 시 별도 액션 세트 모달, 배열 순서 `['reload','cancel']`, 초기 포커스 = `내 버전 유지`, 두 선택지 결과 | 021–023, 034 |
| 회귀 가드 테스트 — `window.confirm` 미호출, `package.json` 의존성 무변경, 폴더 이동 경로 무가드 | 028–030 |
| `ConfirmDialog` 계약 불변식 테스트 — 개발 빌드에서 `'cancel'` 항목 부재 시 콘솔 오류, 존재 시 무출력 | 036 |
| 종료 승격 테스트 — 모달 열린 상태 종료 요청 시 승격, 3 선택지별 후속(원래 의도 동작 미수행 포함), deadlock 부재 | 037 |
| AI 스트리밍 테스트 — `aiStore.requestState === 'streaming'`일 때 `저장`·`저장 안 함` 양쪽에서 의도 동작 **이전에** `aiCancel(requestId)` 호출, 취소 후 잔여 청크가 새 버퍼를 더럽히지 않음, 부분 응답 저장 허용, 고지 문구 조건부 표시 | 038–040 |

### E2E 테스트 (Playwright)

> **선행 조건**: 아래 시나리오 중 5개는 파일 트리에 클릭 가능한 파일이 존재해야 한다. 현재 `e2e/fixtures/tauri-mock.ts`는 모든 IPC에 `null`을 반환하는 24줄 스텁이므로 `read_directory`가 null을 반환하고 트리가 비어 **시나리오가 실행 자체를 못 한다**. 가상 파일시스템 픽스처(Delta 표, AC-022, plan.md T2b)가 **먼저 완성되어야** 이 층이 성립한다.

| 시나리오 | 커버 REQ |
|----------|----------|
| 편집 → 다른 파일 클릭 → 모달 3버튼 노출 → `취소` 시 에디터 유지 / `저장 안 함` 시 새 파일 로드 | 012, 015, 016 |
| 편집 → 새 문서 → 모달 → `저장` → 저장 완료 후 빈 문서 | 013, 014 |
| 깨끗한 문서에서 파일 클릭 → 모달 미표시 | 026 |
| 파일 열기 직후 재클릭 → 모달 미표시(결함 A 회귀 가드) | 011 |
| 모달 열린 상태에서 다른 파일 연타 → 단일 파일만 열림 | 024, 025 |
| 키보드 전용 조작(Tab 순환, Escape 닫기) | 004, 016 |

### Playwright로 검증 불가한 항목 — REQ-FS-003-018/019/020

Playwright E2E는 Vite dev 서버(일반 브라우저) 대상으로 실행되며 **Tauri 런타임이 없다.** `WindowEvent::CloseRequested`는 발생하지 않고 `@tauri-apps/api/window`의 `getCurrentWindow()`도 동작하지 않는다. 따라서 윈도우 종료 가드는 Playwright로 커버하지 **않으며**, 대신 3층으로 검증한다.

1. **Rust 측: 사용하지 않음(V1 해소).** Run phase 검증 결과 프런트엔드 `onCloseRequested` + `preventDefault`만으로 충분해 `lib.rs`에 `on_window_event`를 등록하지 않았다. 따라서 Rust 종료 가드 검증 항목은 존재하지 않으며, `cargo test`는 기존 컴파일 게이트(`test_run_compiles`) 역할만 수행한다.
2. **프런트엔드 단위 테스트** (vitest) — **실질적 자동화 검증 층**: `@tauri-apps/api/window`를 모킹하여 `onCloseRequested` 리스너 등록, dirty=false 즉시 닫기 경로, dirty=true 모달 표시 후 각 선택지의 후속(닫기/저장 후 닫기/중단), 그리고 REQ-037의 승격 처리(모달이 이미 열린 상태에서 종료 요청 도착)를 검증한다. 모달 분기 로직은 이 층에서 완전히 커버된다.
3. **수동 검증 체크리스트**: `npm run tauri dev`(또는 릴리즈 빌드)에서 (a) 편집 후 창 닫기 → 모달, (b) `취소` → 앱 유지, (c) `저장 안 함` → 즉시 종료, (d) `저장` → 저장 후 종료, (e) 깨끗한 상태 → 무모달 즉시 종료, (f) 파일 전환 모달이 열린 상태에서 창 닫기 → 승격 동작. 이 6건은 acceptance.md의 수동 검증 항목으로 기록하며, 자동화 게이트가 아님을 명시한다.

## Delta (Brownfield Changes)

| Delta | 파일 | 변경 내용 |
|-------|------|-----------|
| [NEW] | `src/components/common/ConfirmDialog.tsx` | 재사용 다이얼로그 컴포넌트 + 계약 타입 export (REQ-001~006) |
| [NEW] | `src/hooks/useUnsavedChangesGuard.ts` | 3버튼 가드 상태 머신 + 재진입 차단 + 의도 동작 실행 + 종료 승격 + AI 취소 (REQ-012~017, 024~026, 037~040) |
| [NEW] | `src/lib/save/saveDocument.ts` (또는 동등 위치) | 단일 저장 함수 — 5중 중복 수렴점 (REQ-009, 010) |
| [MODIFY] | `src/hooks/useFileSystem.ts` | `openFile`의 `window.confirm` 제거(:141-149), 5개 분기 전부 `setDirty(false)` 추가(:154-228), `changeFolder`의 허위 `window.confirm` 제거(:117-123), `saveFileAs`를 `saveDocument`로 위임 |
| [MODIFY] | `src/components/layout/AppLayout.tsx` | `handleNew`에 가드 적용(:119-123), `handleSave`/`handleSaveAs`를 `saveDocument` 위임으로 축약(:82-117), `ConfirmDialog` 마운트 |
| [MODIFY] | `src/components/editor/MarkdownEditor.tsx` | `Mod-s`/`Mod-Shift-s` keymap을 `saveDocument` 호출로 치환(:113-177), `Mod-n`에 가드 적용(:178-187) |
| [MODIFY] | `src/App.tsx` | 워처 콜백에 dirty 분기 + 워처 전용 모달 배선(:34-41), 윈도우 종료 리스너(`@tauri-apps/api/window` `onCloseRequested`) 등록 |
| [MODIFY] | `src/store/uiStore.ts` | `partialize`에서 `saveStatus` 제외(:158-165) |
| [NO-CHANGE] | `src-tauri/src/lib.rs` | **무변경** — V1 검증으로 프런트엔드 `onCloseRequested` + `preventDefault`가 충분해 Rust `on_window_event` 등록 불필요(REQ-018 개정, v0.0.4) |
| [MODIFY] | `src/styles/mdedit-components.css` | `.md-dialog*` 클래스(백드롭/패널/액션 바) 추가 — 토큰만 사용 |
| [NEW] | `src/test/ConfirmDialog.test.tsx` | 컴포넌트 계약·a11y·키보드 테스트 |
| [NEW] | `src/test/useUnsavedChangesGuard.test.ts` | 가드 상태 머신·재진입·저장 실패 테스트 |
| [NEW] | `src/test/saveDocument.test.ts` | 단일 저장 함수 테스트 |
| [NEW] | `src/test/windowCloseGuard.test.ts` | `@tauri-apps/api/window` 모킹 기반 종료 가드 분기 테스트 |
| [MODIFY] | `src/test/useFileSystem.test.ts` | `setDirty(false)` 전분기 호출 + `window.confirm` 미호출 회귀 가드 |
| [NEW] | `e2e/unsaved-changes-guard.spec.ts` | Playwright 시나리오(위 표) |
| [MODIFY] | `e2e/fixtures/tauri-mock.ts` | **가상 파일시스템 목으로 확장(필수 선행 작업)**. 현재 24줄 널 스텁(`invoke: () => Promise.resolve(null)`)이라 `read_directory`가 null을 반환해 파일 트리가 비고, **클릭할 파일이 없어 선언된 E2E 6개 중 5개가 실행 불가**하다. 최소 `read_directory`/`read_file`/`write_file`/`save_file_as`/`start_watch` 명령 + 테스트별 시드 API 필요. `e2e/html-file-viewer.spec.ts:23-41`의 `addInitScript` 패턴을 따른다. SPEC-EXPORT-002가 `export_save_dialog`를 **추가 확장**할 수 있도록 명령 디스패치를 확장 가능한 형태로 설계할 것(포크 금지) |

## Acceptance Criteria

> acceptance.md의 Given-When-Then 시나리오와 1:1 매핑. 아래 표는 REQ-FS-003-001~040(027 결번) 전체를 커버한다.
>
> **검증 층위 표기**: 표시가 없으면 자동화 테스트(vitest 또는 Playwright)로 검증한다. `[review]`는 코드 검토·grep 기준이며 실행 테스트가 아니다. `[manual]`은 Tauri 런타임이 필요해 자동화 불가능한 항목이다.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-FS-003-001 | REQ-001, 003 | `ConfirmDialog`가 계약 타입을 export하고 `actions`를 배열 순서로 렌더, 마지막 항목이 primary + 초기 포커스 |
| AC-FS-003-002 | REQ-002, 006 | 백드롭 + `role="dialog"` + `aria-modal="true"` 렌더 (자동화) / **`[review]`** `.md-dialog*` CSS에 raw hex 색상 리터럴 0건 — jsdom은 스타일시트를 로드하지 않으므로 grep 기반 검토 기준이다 |
| AC-FS-003-003 | REQ-004, 005 | Tab/Shift+Tab 포커스 순환 제한, 닫힘 시 트리거로 포커스 복귀, 루트·버튼에 `data-testid` 존재 |
| AC-FS-003-004 | REQ-007, 008 | **`[review]`** 가드 코드 경로가 `saveStatus`를 참조하지 않음 — grep 기반 검토 기준(부재 증명은 테스트로 불가) / (자동화) `partialize` 결과에 `saveStatus` 부재 + 재hydration 시 stale `unsaved` 미복원 |
| AC-FS-003-005 | REQ-009, 010 | 저장 버튼·`Mod-s`·`Mod-Shift-s`·모달 `저장`이 모두 동일 `saveDocument` 호출, 성공 시 dirty=false·`saved`, 실패 시 dirty 유지 |
| AC-FS-003-006 | REQ-011 | `openFile` 5개 분기(html/raster/svg/too-large/text·binary) 전부 `setDirty(false)` 호출; 파일 열기 직후 재클릭 시 모달 미표시 |
| AC-FS-003-007 | REQ-012, 013 | dirty 상태에서 탐색기 파일 클릭·새 문서(버튼/`Mod-n`) → 3버튼 모달 표시 |
| AC-FS-003-008 | REQ-014, 015 | `저장` → 저장 완료 후 의도 동작 수행; `저장 안 함` → 즉시 의도 동작 수행(변경 폐기) |
| AC-FS-003-009 | REQ-016, 017 | `취소`/Escape/백드롭 → 의도 동작 중단 + 에디터 상태 무변경; 저장 실패·Save As 취소 → 의도 동작 미수행 + dirty 유지 |
| AC-FS-003-010 | REQ-018, 019, 020 | **`[manual]` + 모킹 단위 테스트** — dirty=false 즉시 종료 / dirty=true 모달 후 저장·폐기·취소 각각 종료·종료·유지는 모킹 단위 테스트로, 프런트엔드 모킹 단위 테스트(`windowCloseGuard.test.tsx`)로 확인하고, 실제 종료 동작은 수동 체크리스트로 확인한다. Rust `on_window_event`는 V1 해소로 미사용이라 검증 항목이 없다(아래 Test Strategy 참조) |
| AC-FS-003-011 | REQ-021, 022, 023 | 워처: dirty=false 자동 재로드 유지; dirty=true 시 `내 버전 유지`/`디스크에서 다시 읽기` 액션의 별도 모달, 각 선택 결과 검증 |
| AC-FS-003-012 | REQ-024, 025 | 모달 열린 동안 **파일 클릭 / 새 문서 / 워처 이벤트** 세 트리거 각각이 무시됨(모달 중첩 없음, 파일 1개만 열림, 저장 1회) + 후속 트리거 폐기(큐잉 없음). **워처 케이스는 디스크 변경이 조용히 잊히는 결과를 낳으므로 별도 어서션 필수** |
| AC-FS-003-013 | REQ-026 | dirty=false인 모든 경로(파일 클릭 / 새 문서 / 종료)에서 모달 미표시 |
| AC-FS-003-014 | REQ-028, 029 | 코드베이스에 미저장 경고용 `window.confirm`/`onbeforeunload`/네이티브 다이얼로그 0건; 폴더 이동 5경로 전부 무가드(문서·dirty 무변경) |
| AC-FS-003-015 | REQ-030, 031, 032, 033 | `package.json` 신규 런타임 의존성 0건; `SettingsModal` 테스트 무변경 통과; `EditorState` 계약 무변경; 자동저장/복구/다중탭 미도입 |
| AC-FS-003-016 | REQ-022, 034 | 워처 충돌 모달의 `actions` 배열이 `['reload', 'cancel']` 순서이고, 모달이 열린 직후 `document.activeElement`가 `내 버전 유지` 버튼이며 primary 스타일을 가짐; `디스크에서 다시 읽기`는 `danger` 스타일이고 포커스를 갖지 않음 |
| AC-FS-003-017 | REQ-035 | 4개 진입 경로(헤더 저장 / `Mod-s` / `Mod-Shift-s` / 모달 `저장`) 전부에서 Save As 호출 시 `watchedPath`가 기본 디렉터리 인자로 전달됨(경로별 차이 0) |
| AC-FS-003-018 | REQ-036 | 개발 빌드에서 `actions`에 `id:'cancel'`이 없는 `ConfirmDialog` 렌더 시 콘솔 오류 출력; 있으면 무출력; 프로덕션 빌드에서는 무출력 |
| AC-FS-003-019 | REQ-037 | 모달이 열린 상태에서 종료 요청 → 두 번째 모달 없이 기존 모달이 승격; `저장`/`저장 안 함` → 원래 의도 동작(파일 B 열기) **미수행** + 창 닫힘; `취소` → 창 유지 + 원래 의도 동작도 미수행 + 재종료 시도 가능. **연속 종료 시도가 무한 무응답이 되지 않음(deadlock 부재)** |
| AC-FS-003-020 | REQ-038, 040 | 스트리밍 중 `저장 안 함` → `aiCancel(requestId)`가 `openFile` **이전에** 호출되고, 이후 도착하는 스트림 청크가 새로 연 파일 버퍼를 오염시키지 않으며 새 파일의 `dirty`가 false 유지(REQ-011 방어); 스트리밍 중 `저장` → `aiCancel` 호출 후 그 시점 버퍼(부분 응답 포함)가 그대로 디스크에 기록됨 |
| AC-FS-003-021 | REQ-039 | 스트리밍 중 모달 메시지에 AI 응답 중단 고지 문구 포함; 비스트리밍 시 미포함 |
| AC-FS-003-022 | E2E 인프라 | `e2e/fixtures/tauri-mock.ts`가 `read_directory`/`read_file`/`write_file`/`save_file_as`/`start_watch`를 시드 데이터 기반으로 응답하며, 파일 트리가 렌더되고 파일 노드 클릭이 가능함(이 픽스처 없이는 AC-007/008/009/012/013의 E2E 층이 실행 불가) |

REQ 커버리지 대조(001–040 전수, 027 결번): 001→AC1, 002→AC2, 003→AC1, 004→AC3, 005→AC3, 006→AC2, 007→AC4, 008→AC4, 009→AC5, 010→AC5, 011→AC6·AC20, 012→AC7, 013→AC7, 014→AC8, 015→AC8, 016→AC9, 017→AC9, 018→AC10, 019→AC10, 020→AC10, 021→AC11, 022→AC11·AC16, 023→AC11, 024→AC12·AC19, 025→AC12·AC19, 026→AC13, 028→AC14, 029→AC14, 030→AC15, 031→AC15, 032→AC15, 033→AC15, 034→AC16, 035→AC17, 036→AC18, 037→AC19, 038→AC20, 039→AC21, 040→AC20. 미커버 REQ 없음(027은 v0.0.3에서 삭제된 결번).

**Quality Gates (AC 외 공통 게이트)**: `npm run lint`(eslint) 클린 + `npm run typecheck`(`tsc --noEmit`) 클린 + `npm test`(vitest) 전체 통과 + `npm run test:e2e`(Playwright) 통과 + `cargo test`(src-tauri) 통과. 윈도우 종료 가드 수동 검증 5건은 별도 체크리스트로 기록한다.

## Ordering Dependency

**`ConfirmDialog`는 SPEC-EXPORT-002보다 먼저 완료되어야 한다.** SPEC-EXPORT-002는 동일 컴포넌트를 소비하므로, 본 SPEC의 Run phase가 컴포넌트를 머지하기 전까지 SPEC-EXPORT-002는 착수할 수 없다. 두 SPEC을 병렬 실행할 경우 `ConfirmDialog.tsx`에 대한 쓰기 충돌이 발생한다.

E2E 픽스처(`e2e/fixtures/tauri-mock.ts`)도 동일하게 본 SPEC이 선행 소유한다. SPEC-EXPORT-002의 E2E는 같은 픽스처에 `export_save_dialog` 명령을 **추가**하는 방식으로 확장해야 하며, 별도 픽스처를 포크해서는 안 된다(Delta 표 참조).

권장 순서: SPEC-FS-003 Run 완료(ConfirmDialog 머지) → SPEC-EXPORT-002 Run 착수.

## Design Notes / Future Considerations

> 아래는 요구사항이 아니며(AC 없음) Run phase의 설계 참고 사항이다.

- **가드 상태 머신 힌트**: `useUnsavedChangesGuard`는 `pendingAction: (() => void | Promise<void>) | null` 형태로 "의도한 동작"을 보관하고, 모달이 열린 동안 `pendingAction !== null`을 재진입 차단 플래그로 사용하는 방식을 상정한다(REQ-024/025). 구현 세부는 Run phase 재량.
- **[확정 결정] `saveStatus`는 표시 전용으로 유지한다**: REQ-007은 `saveStatus`를 제거하라는 요구가 아니다. `saveStatus`는 `'saving'`/`'new'`처럼 boolean `dirty`에서 파생 불가능한 상태를 포함하므로 완전 파생 셀렉터로 만들 수 없다. 따라서 표시 전용으로 남기되 `saveDocument`/`openFile` 등 상태 전이 지점에서만 갱신하고, **가드 판정은 `dirty`만 읽는다**. 이는 열린 질문이 아니라 승인된 최소 변경 결정이다. `saveStatus`를 `dirty` + 진행 플래그 조합에서 완전히 계산하는 리팩토링은 본 SPEC 범위 밖의 후속 과제다.
- **[V1 해소 확정] 종료 가드는 프런트엔드 단독**: Run phase V1 검증(node_modules/@tauri-apps/api/window.js `onCloseRequested` 래퍼 분석)으로 `event.preventDefault()`만으로 종료 보류가 충분함을 확인했다. 따라서 Rust `on_window_event`는 등록하지 않았고, 사용자가 종료를 확정하면 프런트엔드에서 `getCurrentWindow().destroy()`로 닫는다.

## Exclusions (What NOT to Build)

- **자동 저장 없음** — 주기적/포커스 이탈 자동 저장, 초안 자동 보존 미도입.
- **크래시 복구 없음** — 비정상 종료 후 미저장 내용 복원 미도입.
- **다중 문서/탭 없음** — 여러 문서를 동시에 열고 각각 dirty를 추적하는 구조 미도입. 본 SPEC은 단일 활성 문서 모델을 전제한다.
- **폴더 이동 가드 없음** — 폴더 이동은 에디터 내용을 교체하지 않으므로(소스 확인) 가드를 추가하지 않으며, 기존 허위 `window.confirm`만 제거한다.
- **`SettingsModal` 리팩토링 없음** — `ConfirmDialog`로의 마이그레이션은 범위 밖. 두 모달이 당분간 공존한다.
- **3-way 병합/diff 없음** — 워처 충돌 시 사용자 버전과 디스크 버전을 병합하거나 diff를 보여주지 않는다. 이진 선택만 제공한다.
- **`window.onbeforeunload` 사용 없음** — 브라우저 네이티브 종료 경고 경로 미사용(Tauri 앱에서 신뢰할 수 없고 문구 제어 불가).
- **다이얼로그 i18n 없음** — 모달 문구는 한글 고정. 로케일 분기 미도입.
- **`checkbox` prop 없음** — `ConfirmDialogProps`에 checkbox 관련 필드를 두지 않는다. 초기 계약 초안에 포함되어 있었으나 본 SPEC과 SPEC-EXPORT-002 어느 쪽도 소비하지 않는 것으로 확인되어(EXPORT-002는 미사용을 4곳에서 명시) 계약에서 제거했다. 미래 확장 여지로도 남기지 않는다 — 소비자가 생길 때 추가한다.
- **외부 삭제·이름변경 대응 없음** — 파일 워처는 `Modified` 이벤트만 처리한다(`App.tsx:34-41` 기존 동작). 열린 파일이 외부에서 삭제·이름변경된 경우 사용자는 존재하지 않는 경로를 계속 편집하게 되며, 이후 `저장`은 실패한다. `saveDocument()`에 ENOENT → Save As 폴백을 두지 않는다. 근거: REQ-010이 저장 실패 시 `dirty`를 true로 유지하고 `saveStatus`를 `'unsaved'`로 만들어 **실패가 조용하지 않고 눈에 보이므로** 데이터가 소실되지 않는다. 폴백 추가는 별도 SPEC 과제로 남긴다.
- **`editorStore` 계약 변경 없음** — `EditorState` 필드/액션 시그니처와 `@MX:ANCHOR` 무변경.
