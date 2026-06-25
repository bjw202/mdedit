---
id: SPEC-UI-005
version: "1.0.1"
status: approved
created: "2026-06-25"
updated: "2026-06-25"
author: "jw"
priority: medium
issue_number: 0
dependencies:
  - SPEC-UI-002
tags:
  - ui
  - sidebar
  - file-explorer
  - context-menu
  - clipboard
  - zustand
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-25 | jw | Initial SPEC creation — Adds Copy Path / Copy Name items to the FileTreeNode context menu, a transient Footer status message channel in uiStore, and standard Clipboard API integration. Extends SPEC-UI-002. No new runtime dependencies. |
| 1.0.1 | 2026-06-25 | jw | Annotation cycle approved: Footer directly subscribes to useUIStore (prop-drilling option rejected); message language English; keyboard shortcuts deferred to separate SPEC. SPEC approved for implementation. |

## Summary

`MdEdit` (Tauri v2 + React 19 + TypeScript)의 File Explorer 컨텍스트 메뉴에 **Copy Path** 와 **Copy Name** 항목을 추가한다. 사용자가 파일/폴더 노드를 우클릭하면 표시되는 컨텍스트 메뉴에 새 "copy group"이 **Rename/Delete 그룹 위**에 배치되며, 성공 시 **Footer에 트랜지언트 상태 메시지**가 약 2초간 표시된다.

이 기능은 Claude Code 등 외부 에이전트/터미널로 경로를 신속하게 전달하기 위한 사용자 요청에서 비롯되었으며, 기존 SPEC-UI-002의 파일 트리 컨텍스트 메뉴를 **확장**한다.

## Background & Rationale

### Use case: path sharing with external agents

MdEdit 사용자는 파일 경로를 Claude Code, 터미널, 빌드 스크립트 등 외부 도구로 자주 복사해야 한다. 현재는 FileTreeNode의 `node.path` / `node.name` 값을 직접 드래그하거나 "Rename"으로 이름을 확인한 뒤 수동 입력해야 하므로 마찰이 크다. 컨텍스트 메뉴에 "Copy Path" / "Copy Name"을 추가하면 우클릭 한 번으로 절대 경로 또는 파일명(확장자 포함)을 클립보드에 넣을 수 있다.

### Relationship to SPEC-UI-002

이 SPEC은 SPEC-UI-002(REQ-UI002-E03: 파일/폴더 우클릭 시 컨텍스트 메뉴 표시)를 **대체하지 않고 확장**한다:

- 기존 메뉴 구조(New File / New Folder / Rename / Delete)에 새 항목을 추가한다.
- 동일한 상호작용 패턴(우클릭 → 메뉴 → 항목 선택)을 따른다.
- 클립보드 작업은 읽기 전용이므로 `onRefresh()` 호출이나 fileStore 갱신이 불필요하다 (research §1, §4).
- FileNode 데이터 모델(`{ name, path, isDirectory, children?, extension? }`)의 `node.path` / `node.name`을 직접 사용한다.

### Menu placement decision

연구 문서(research.md §4)는 "Copy Path/Copy Name을 Rename 이후, Delete 이전에 배치" 제안했으나, **사용자 인터뷰에서 확정된 배치는 다르다**. 확정 배치는 새 "copy group"을 Rename/Delete 그룹 **위**에 두고, 수평 구분선으로 분리한다. 이유:

- Copy는 비파괴적이며 사용 빈도가 높으므로 위쪽에 배치하면 접근성이 좋다.
- Rename/Delete는 기존 "destructive / state-changing" 그룹으로 함께 남는다.
- directories와 files 모두에서 Copy Path/Copy Name이 동일한 위치에 노출된다.

## Scope

### In Scope

- `FileTreeNode.tsx` 컨텍스트 메뉴에 Copy Path / Copy Name 항목 추가 (파일 + 폴더 모두).
- 메뉴 배치: copy group을 Rename/Delete 그룹 위, 수평 구분선으로 분리.
- `uiStore.ts`에 트랜지언트 `statusMessage: string | null` 필드 + `setStatusMessage` 액션 + auto-clear 타이머(약 2000ms, single-flight).
- `Footer.tsx`에서 `statusMessage` 조건부 렌더링.
- `navigator.clipboard.writeText` 호출 및 실패 처리(에러 상태 메시지, crash 없음).
- 접근성: `role="menuitem"`, 키보드 도달(Tab/Arrow), Enter/Space 활성화.
- `src/test/setup.ts`에 clipboard mock 추가.

### Out of Scope (Exclusions)

- **키보드 단축키**(Ctrl+Shift+C 등) — 별도 SPEC에서 다룬다.
- **다중 선택 / 다중 노드 복사** — 현재 단일 선택 모델만 지원.
- **상대 경로 복사** — 사용자 결정에 따라 절대 경로만 지원(`node.path` verbatim).
- **캐스케이딩 / 서브메뉴 구조** — 단일 플랫 메뉴에 항목 추가로 종료.
- **클립보드 읽기 / 붙여넣기** — `imageHandler.ts`가 이미 처리 중.
- **Rust 백엔드 변경** — `src/lib/tauri/ipc.ts` 및 Tauri 커맨드는 변경하지 않는다.
- **새로운 런타임 의존성** — `@tauri-apps/plugin-clipboard-manager` 등 추가 없음.

## Requirements (EARS)

### Ubiquitous Requirements

- **REQ-UI-005-001**: The system **shall** 항상 Copy Path / Copy Name 메뉴 항목을 `FileTreeNode` 컨텍스트 메뉴에서 파일 노드와 폴더 노드 양쪽에 대해 렌더링한다.
- **REQ-UI-005-002**: The system **shall** 항상 복사된 값을 변환·정규화 없이 `node.path` / `node.name` 원문 그대로 클립보드에 기록한다 (슬래시 방향 변환 금지).
- **REQ-UI-005-003**: The system **shall** 항상 Copy Path / Copy Name 메뉴 항목에 `role="menuitem"`을 부여하고 키보드로 도달 가능하며(Tab/Arrow) Enter 또는 Space로 활성화할 수 있도록 한다.
- **REQ-UI-005-004**: The system **shall** 항상 Copy Path / Copy Name 메뉴 항목의 라벨을 영문("Copy Path", "Copy Name")으로 표시한다(기존 New File / Rename / Delete와 일관).

### Event-Driven Requirements

- **REQ-UI-005-005**: **WHEN** 사용자가 Copy Path 항목을 클릭하거나 키보드로 활성화하면, **the system shall** `await navigator.clipboard.writeText(node.path)`를 호출한다.
- **REQ-UI-005-006**: **WHEN** 사용자가 Copy Name 항목을 클릭하거나 키보드로 활성화하면, **the system shall** `await navigator.clipboard.writeText(node.name)`을 호출한다.
- **REQ-UI-005-007**: **WHEN** 클립보드 쓰기가 성공하면, **the system shall** `uiStore.setStatusMessage`를 복사된 값을 포함하는 메시지(예: `Copied: /abs/path/to/file.md`)로 설정한다.
- **REQ-UI-005-008**: **WHEN** 사용자가 Copy Path 또는 Copy Name 항목을 클릭/활성화하면, **the system shall** 해당 동작 직후 컨텍스트 메뉴를 닫는다(`setContextMenu(null)`).

### State-Driven Requirements

- **REQ-UI-005-009**: **WHILE** uiStore의 `statusMessage`가 non-null인 동안, **the system shall** Footer에 해당 메시지를 표시한다.
- **REQ-UI-005-010**: **WHILE** `statusMessage`가 null이면, **the system shall** Footer에 상태 메시지를 렌더링하지 않는다.

### Unwanted Behavior Requirements

- **REQ-UI-005-011**: **IF** 클립보드 쓰기 호출이 거부되거나(permission denied, not allowed, 비-secure 컨텍스트) 예외를 throw하면, **then** the system **shall** 사용자에게 에러 성격의 `statusMessage`를 표시하고, crash 없이 메뉴를 닫으며, 콘솔에 에러를 기록한다.
- **REQ-UI-005-012**: The system **shall not** 복사된 경로의 경로 구분자(`/` ↔ `\`)를 변환하거나 정규화하지 않는다. `node.path`가 반환한 그대로 기록한다.
- **REQ-UI-005-013**: The system **shall not** Copy Path / Copy Name 동작으로 인해 파일 트리 새로고침(`onRefresh()`)이나 fileStore 갱신을 발생시키지 않는다.
- **REQ-UI-005-014**: The system **shall not** 새로운 런타임 의존성을 추가하지 않는다(`navigator.clipboard.writeText` 사용, Tauri 클립보드 플러그인 제외).

### Optional / Enhancement Requirements

- **REQ-UI-005-015**: **WHERE** 가능하면, Footer에 매우 긴 경로가 표시될 때 말줄임(ellipsis/truncate)으로 레이아웃 깨짐을 방지한다.

### Timer / Single-Flight Requirements

- **REQ-UI-005-016**: **WHEN** `setStatusMessage`가 메시지와 함께 호출되면, **the system shall** 약 2000ms 후 자동으로 `statusMessage`를 `null`로 초기화하는 타이머를 시작한다.
- **REQ-UI-005-017**: **WHEN** 이전 메시지가 여전히 표시 중일 때 새 `setStatusMessage` 호출이 발생하면, **the system shall** 기존 타이머를 취소(clearTimeout)하고 새 메시지로 교체한 뒤 타이머를 재시작한다(single-flight). 이전 메시지가 만료되기 전 새 메시지가 덮어쓰는 것을 허용한다.
- **REQ-UI-005-018**: **WHEN** `setStatusMessage(null)`이 명시적으로 호출되면, **the system shall** 보류 중인 auto-clear 타이머를 취소하고 `statusMessage`를 즉시 `null`로 설정한다.

## Menu Placement (confirmed)

```
[Directory node context menu]
  New File
  New Folder
  ─────────── (divider)
  Copy Path       ← new copy group
  Copy Name       ← new copy group
  ─────────── (divider)
  Rename
  Delete

[File node context menu]
  Copy Path       ← new copy group
  Copy Name       ← new copy group
  ─────────── (divider)
  Rename
  Delete
```

참고: research.md §4 "Rename 이후, Delete 이전" 제안과 충돌하나, **위 배치가 사용자 인터뷰로 확정된 값**이며 우선한다.

## Acceptance Criteria

> acceptance.md 의 Given-When-Then 시나리오와 1:1 매핑됨. 모든 AC는 vitest + @testing-library/react로 검증 가능해야 한다.

| AC ID | Requirement | Summary |
|-------|-------------|---------|
| AC-UI-005-001 | REQ-UI-005-001, REQ-UI-005-003, REQ-UI-005-004 | 파일 노드 우클릭 시 Copy Path / Copy Name 항목이 `role="menuitem"` 으로 렌더링된다 |
| AC-UI-005-002 | REQ-UI-005-001, REQ-UI-005-003 | 폴더 노드 우클릭 시 Copy Path / Copy Name 항목이 `role="menuitem"` 으로 렌더링된다 (New File/Folder 하단, divider 위) |
| AC-UI-005-003 | REQ-UI-005-005 | Copy Path 클릭 시 `navigator.clipboard.writeText`가 정확히 `node.path`로 호출된다 |
| AC-UI-005-004 | REQ-UI-005-006 | Copy Name 클릭 시 `navigator.clipboard.writeText`가 정확히 `node.name`으로 호출된다 |
| AC-UI-005-005 | REQ-UI-005-007 | 복사 성공 시 `uiStore.statusMessage`가 복사된 값을 포함하는 문자열로 설정된다 |
| AC-UI-005-016 | REQ-UI-005-016 | `statusMessage`는 약 2000ms 경과 후 자동으로 `null`로 초기화된다 |
| AC-UI-005-017 | REQ-UI-005-017 | 메시지 표시 중 두 번째 복사 시 새 메시지가 이전을 대체하고 타이머가 리셋된다(single-flight) |
| AC-UI-005-011 | REQ-UI-005-011 | `writeText`가 reject되면 에러 성격의 `statusMessage`가 설정되고 throw되지 않는다 |
| AC-UI-005-008 | REQ-UI-005-008 | Copy Path / Copy Name 클릭 후 컨텍스트 메뉴가 닫힌다 |
| AC-UI-005-003a | REQ-UI-005-005 | Copy Path 항목이 포커스된 상태에서 Enter 또는 Space 누르면 복사가 트리거된다 |
| AC-UI-005-012 | REQ-UI-005-012 | 복사된 경로는 `node.path`와 byte-identical하다(`/` ↔ `\` 변환 없음) |
| AC-UI-005-009 | REQ-UI-005-009, REQ-UI-005-010 | Footer는 `statusMessage` non-null일 때만 표시하고 null이면 렌더링하지 않는다 |
| AC-UI-005-013 | REQ-UI-005-013 | 복사 동작 후 `onRefresh` 콜백이 호출되지 않는다(fileStore 갱신 없음) |
| AC-UI-005-014 | REQ-UI-005-014 | `package.json`의 의존성이 변경되지 않는다 |

## Technical Approach

### Handler location: inline in `FileTreeNode.tsx`

research.md §1의 권장사항에 따라 `handleCopyPath` / `handleCopyName` 콜백을 `FileTreeNode.tsx`에 인라인으로 정의한다(기존 `handleRenameConfirm` / `handleCreateConfirm` / `handleDelete` 패턴과 일관, 파일 `src/components/sidebar/FileTreeNode.tsx:158-183`).

근거:
1. 기존 컨텍스트 메뉴 액션들이 모두 동일 파일에 inline `useCallback`으로 정의되어 있다.
2. 클립보드 작업은 부작용이 없는 읽기 전용 동작이라 `useFileSystem` hook이나 Tauri IPC가 불필요하다.
3. `node.path` / `node.name`이 이미 컴포넌트 prop으로 사용 가능하다.

```typescript
// FileTreeNode.tsx (개념적 — 구현은 Run phase)
const { setStatusMessage } = useUIStore();

const handleCopyPath = useCallback(async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(node.path);
    setStatusMessage(`Copied: ${node.path}`);
  } catch (err) {
    console.error('[FileTreeNode] Failed to copy path:', err);
    setStatusMessage('Failed to copy path');
  }
}, [node.path, setStatusMessage]);

const handleCopyName = useCallback(async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(node.name);
    setStatusMessage(`Copied: ${node.name}`);
  } catch (err) {
    console.error('[FileTreeNode] Failed to copy name:', err);
    setStatusMessage('Failed to copy name');
  }
}, [node.name, setStatusMessage]);
```

### uiStore: transient status message with single-flight timer

`src/store/uiStore.ts`에 `statusMessage: string | null` 필드와 `setStatusMessage` 액션을 추가한다 (research §2). 단일 타이머 ID를 module-level ref로 보관하여 single-flight를 구현한다.

```typescript
// uiStore.ts (개념적)
let statusMessageTimer: ReturnType<typeof setTimeout> | null = null;

interface UIState {
  // ...
  statusMessage: string | null;
  setStatusMessage: (message: string | null) => void;
}

// 액션 구현
setStatusMessage: (message: string | null) => {
  if (statusMessageTimer) {
    clearTimeout(statusMessageTimer);
    statusMessageTimer = null;
  }
  set({ statusMessage: message });
  if (message !== null) {
    statusMessageTimer = setTimeout(() => {
      set({ statusMessage: null });
      statusMessageTimer = null;
    }, 2000);
  }
},
```

- module-level 타이머 ref: zustand store 외부에서 관리하여 컴포넌트 unmount와 무관하게 동작.
- `null` 호출 시 타이머 취소 + 즉시 clear.
- non-null 호출 시 기존 타이머 취소 후 재시작(single-flight).

**persist 제외**: `statusMessage`는 트랜지언트 값이므로 localStorage에 영속화하지 않는다. zustand `persist` 설정에서 `partialize`로 제외하거나, 초기 상태를 `null`로 유지하여 앱 재시작 시 자동 초기화되도록 한다(기본적으로 `persist`는 store 전체를 직렬화하므로, `statusMessage` 제외 처리가 필요 — Run phase에서 확정).

### Footer: conditional render (subscribes to useUIStore directly)

`src/components/layout/Footer.tsx`는 `useUIStore((s) => s.statusMessage)`를 직접 구독하여, 기존 좌측 save status 영역 옆에 조건부 렌더링한다(research §2). **prop drilling 없음** — Footer가 store에서 직접 읽는다(annotation cycle 확정).

```typescript
// Footer.tsx (개념적)
const statusMessage = useUIStore((s) => s.statusMessage);

// 기존 save status 영역 옆
{statusMessage && (
  <span className="truncate text-blue-600 dark:text-blue-400" role="status">
    {statusMessage}
  </span>
)}
```

- `truncate` 클래스로 긴 경로 말줄임(REQ-UI-005-015).
- `role="status"`로 스크린 리더 알림.
- `FooterProps.statusMessage` prop은 추가하지 않는다 — Footer가 store 직접 구독 방식을 채택했으므로 prop이 불필요하다. AppLayout도 변경하지 않는다.

### Clipboard call

- `await navigator.clipboard.writeText(value)` 사용.
- try/catch로 reject 처리(REQ-UI-005-011).
- 추가 라이브러리·Tauri 플러그인 없음(research §3: CSP null, WKWebView/WebView2 지원 확인).

### Out-of-scope backend changes

- `src/lib/tauri/ipc.ts` 변경 없음.
- Rust 커맨드 추가 없음.

## Test Strategy (TDD — RED first)

### Test infrastructure

- `src/test/setup.ts`에 `navigator.clipboard.writeText` mock 추가(research §5). jsdom은 clipboard API를 제공하지 않음.
  ```typescript
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  ```

### FileTreeNode tests (`src/test/FileTreeNode.test.tsx`)

- Copy Path / Copy Name 렌더 (file node) — `screen.getByRole('menuitem', { name: 'Copy Path' })`.
- Copy Path / Copy Name 렌더 (folder node, New File/Folder 아래, divider 위).
- Copy Path 클릭 → `writeText`가 `node.path` 인자로 호출.
- Copy Name 클릭 → `writeText`가 `node.name` 인자로 호출.
- 클릭 후 메뉴 닫힘(`queryByRole('menu')` → null).
- Enter/Space 키보드 활성화로 복사 트리거.
- `writeText` reject 시 에러 `statusMessage` 설정 + throw 없음.
- byte-identical 경로 검증(슬래시 변환 없음 — `node.path` 값 그대로).

### uiStore tests (`src/test/uiStore.test.ts`)

- `setStatusMessage('x')` 후 상태 설정.
- `vi.useFakeTimers()` + `vi.advanceTimersByTime(2000)` 후 자동 clear.
- 두 번째 메시지 호출 시 타이머 리셋(single-flight): 첫 호출 → 1000ms 대기 → 두 번째 호출 → 1500ms(총) 후에도 메시지 존재 → 추가 500ms 후(총 2000ms from second call) clear.
- `setStatusMessage(null)` 명시 호출 시 보류 타이머 취소 + 즉시 null.

### Footer tests (`src/test/Footer.test.tsx`)

- `statusMessage` 제공 시 표시.
- `statusMessage === null` 시 미렌더링.

## @MX Tag Targets

code_comments = ko (`.moai/config/sections/language.yaml`).

| 위치 | 태그 | 사유 |
|------|------|------|
| `FileTreeNode.tsx` `handleCopyPath` / `handleCopyName` | `@MX:NOTE` | Claude Code 경로 공유 유스케이스 기록. `@MX:SPEC: SPEC-UI-005` 참조 |
| `uiStore.ts` `setStatusMessage` | `@MX:NOTE` | single-flight 타이머 패턴이 비자명. module-level ref 의미 명시. `@MX:SPEC: SPEC-UI-005` |
| `Footer.tsx` statusMessage 조건부 렌더 | `@MX:NOTE` | 트랜지언트 메시지 채널 역할. `@MX:SPEC: SPEC-UI-005` |

## Risks & Edge Cases

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 비-secure 컨텍스트 / 구형 WebView에서 clipboard API 거부 | 복사 실패, 사용자 혼란 | try/catch로 에러 `statusMessage` 표시. research §3: 현재 Tauri WKWebView/WebView2 + CSP null 환경에서 동작 확인됨 |
| 빠른 반복 복사 시 타이머 누적 | 다수의 setTimeout이 race → 깜빡임 | single-flight: 새 호출마다 기존 타이머 `clearTimeout` |
| 매우 긴 경로 Footer 표시 | 레이아웃 깨짐 | `truncate` 클래스로 말줄임(REQ-UI-005-015) |
| 폴더 경로 trailing separator 불일치 | 복사값이 예상과 다를 수 있음 | research §6: Rust가 반환한 그대로 복사(정규화 금지). 사용자는 플랫폼 native 경로를 기대 |
| persist 저장 시 `statusMessage` 직렬화 | 앱 재시작 시 오래된 메시지 잔류 | `partialize`로 `statusMessage` 제외 또는 초기값 `null` 보장 |
| 단일 사용자 제스처 요구사항 | 일부 브라우저는 사용자 활성화 토큰 요구 | 컨텍스트 메뉴 클릭이 곧 사용자 제스처이므로 충족 |
| 기존 메뉴 회귀 | Rename/Delete 동작 파손 | 새 항목 추가만, 기존 항목 변경 없음. 기존 FileTreeNode 테스트가 회귀 방어 |

## Dependencies

### Internal

| SPEC ID | 의존 내용 |
|---------|-----------|
| SPEC-UI-002 | 부모 SPEC. FileTreeNode 컴포넌트, FileNode 모델, 컨텍스트 메뉴 패턴. 본 SPEC은 REQ-UI002-E03을 확장 |

### External

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| react | 19.x | UI |
| zustand | 5.x | uiStore 상태 관리 |
| navigator.clipboard API | native | 클립보드 쓰기 (의존성 추가 없음) |

신규 의존성: 없음.

## References

- `.moai/specs/SPEC-UI-005/research.md` — AUTHORITATIVE evidence (file:line citations).
- `.moai/specs/SPEC-UI-002/spec.md` — parent SPEC (file tree UI).
- `src/components/sidebar/FileTreeNode.tsx:158-183, 280-321` — handler pattern + context menu render site.
- `src/store/uiStore.ts:21-50, 55-89` — UIState interface + store creation (statusMessage 추가 지점).
- `src/components/layout/Footer.tsx:1-78` — status message render target.
- `src/test/setup.ts:1-16` — test setup (clipboard mock 추가 지점).
- `src/test/FileTreeNode.test.tsx:95-142` — context menu test pattern.
- `src/lib/image/imageHandler.ts:36-69` — existing clipboard read pattern (precedent for browser API usage).
- `src-tauri/tauri.conf.json:21-27` — CSP null (clipboard API 허용 근거).
- `src-tauri/src/commands/file_ops.rs:11-20`, `src-tauri/src/commands/directory_ops.rs:42-43, 114-127` — Rust 측 path 처리(verbatim 반환 근거).

## Exclusions (What NOT to Build)

- 키보드 단축키(Ctrl+Shift+C 계열) — 별도 SPEC.
- 다중 선택 / 다중 노드 일괄 복사.
- 상대 경로 복사 모드.
- 서브메뉴 / 캐스케이딩 구조.
- 클립보드 읽기 / paste 기능.
- Rust 백엔드 신규 커맨드.
- 새로운 npm 의존성(`@tauri-apps/plugin-clipboard-manager` 등).
- Toast / 모달 기반 피드백(Footer 트랜지언트 메시지만 사용).
