# SPEC-UI-005 — 수용 기준 (acceptance.md)

> development_mode = tdd. 모든 시나리오는 vitest + @testing-library/react로 검증 가능해야 한다(RED 우선, GREEN 단계 통과 대상).
> **Must-pass**: AC-UI-005-003 (Copy Path → writeText(node.path)), AC-UI-005-016 (auto-clear 2000ms), AC-UI-005-011 (clipboard reject 에러 처리), AC-UI-005-012 (byte-identical 경로).
> 파일/폴더 양쪽 메뉴 렌더(AC-001, AC-002)와 클릭 후 메뉴 닫힘(AC-008)이 회귀 방어 기준.

## 사전 준비

- **클립보드 mock**: `src/test/setup.ts`에 `navigator.clipboard.writeText = vi.fn().mockResolvedValue(undefined)` 추가(jsdom 미구현, research §5).
- **스토어 리셋**: `useUIStore.setState({ statusMessage: null })` 로 각 테스트 시작 전 초기화.
- **타이머**: auto-clear / single-flight 테스트는 `vi.useFakeTimers()` + `vi.advanceTimersByTime(ms)`. `afterEach`에서 `vi.useRealTimers()` 복원 및 `setStatusMessage(null)`로 보류 타이머 정리.
- **파일 노드 픽스처**:
  ```ts
  const fileNode: FileNode = {
    name: 'readme.md',
    path: '/project/readme.md',
    isDirectory: false,
    extension: '.md',
  };
  const folderNode: FileNode = {
    name: 'docs',
    path: '/project/docs',
    isDirectory: true,
  };
  ```
- **fileStore 리셋**: `useFileStore.setState({ fileTree: [], currentFile: null, expandedDirs: new Set(), watchedPath: null, isLoading: false })` (research §5 패턴).
- **render 패턴**: `<FileTreeNode node={...} depth={0} onRefresh={vi.fn()} />` 후 `fireEvent.contextMenu(nodeEl)`.

---

## 기능 시나리오

### AC-UI-005-001: 파일 노드 Copy Path / Copy Name 렌더 (REQ-UI-005-001, REQ-UI-005-003, REQ-UI-005-004)

- **Given** `fileNode`(`/project/readme.md`)로 `FileTreeNode`를 렌더하고
- **When** 노드를 우클릭(`fireEvent.contextMenu`)하면
- **Then** `screen.getByRole('menuitem', { name: 'Copy Path' })`이 존재하고
- **And** `screen.getByRole('menuitem', { name: 'Copy Name' })`이 존재한다
- **And** 두 항목 모두 `role="menuitem"` 이며 영문 라벨이다.

### AC-UI-005-002: 폴더 노드 Copy Path / Copy Name 렌더 + 배치 (REQ-UI-005-001, REQ-UI-005-003)

- **Given** `folderNode`(`/project/docs`)로 `FileTreeNode`를 렌더하고
- **When** 노드를 우클릭하면
- **Then** `screen.getByRole('menuitem', { name: 'Copy Path' })` / `{ name: 'Copy Name' })` 이 존재하고
- **And** 메뉴 항목 순서가 위에서 아래로: New File → New Folder → (divider) → Copy Path → Copy Name → (divider) → Rename → Delete 임을 확인한다(예: 모든 `menuitem`을 queryAllByRole로取得 후 텍스트 순서 비교).

### AC-UI-005-003: Copy Path 클릭 → writeText(node.path) (REQ-UI-005-005) — must-pass

- **Given** `fileNode`(`/project/readme.md`)로 렌더 후 메뉴를 열고
- **When** `screen.getByRole('menuitem', { name: 'Copy Path' })`를 클릭하면
- **Then** `navigator.clipboard.writeText`가 정확히 `'/project/readme.md'` 인자로 1회 호출된다(`expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/project/readme.md')`).

### AC-UI-005-004: Copy Name 클릭 → writeText(node.name) (REQ-UI-005-006)

- **Given** `fileNode`로 렌더 후 메뉴를 열고
- **When** `screen.getByRole('menuitem', { name: 'Copy Name' })`를 클릭하면
- **Then** `navigator.clipboard.writeText`가 정확히 `'readme.md'` 인자로 호출된다.

### AC-UI-005-005: 성공 시 statusMessage 설정 (REQ-UI-005-007)

- **Given** `fileNode`(`/project/readme.md`)로 렌더 후 메뉴를 열고
- **When** Copy Path를 클릭하면
- **Then** `useUIStore.getState().statusMessage`가 문자열이 되고
- **And** 해당 문자열은 `'/project/readme.md'`를 포함한다(`expect(statusMessage).toContain('/project/readme.md')`).

### AC-UI-005-016: statusMessage 자동 clear (~2000ms) (REQ-UI-005-016) — must-pass

- **Given** `vi.useFakeTimers()` 이고 `useUIStore.setState({ statusMessage: null })` 인 상태에서
- **When** `useUIStore.getState().setStatusMessage('Copied: x')`를 호출하면
- **Then** 직후 `useUIStore.getState().statusMessage === 'Copied: x'` 이고
- **And** `vi.advanceTimersByTime(1999)` 후에도 여전히 `'Copied: x'` 이며
- **And** `vi.advanceTimersByTime(1)` (총 2000ms) 후 `useUIStore.getState().statusMessage === null` 이 된다.

### AC-UI-005-017: single-flight — 두 번째 메시지가 첫 메시지를 대체 + 타이머 리셋 (REQ-UI-005-017)

- **Given** `vi.useFakeTimers()` 인 상태에서
- **When** `setStatusMessage('first')` 호출 후 `vi.advanceTimersByTime(1000)` 한 뒤 `setStatusMessage('second')`를 호출하면
- **Then** `useUIStore.getState().statusMessage === 'second'` 이고
- **And** 추가로 `vi.advanceTimersByTime(999)` (첫 호출 후 총 1999ms)해도 `statusMessage === 'second'` 로 유지된다(첫 타이머가 취소되었으므로)
- **And** 다시 `vi.advanceTimersByTime(1)` (두 번째 호출 후 1000ms, 총 2000ms from second)하면 `statusMessage === null` 이 된다.

### AC-UI-005-011: clipboard reject 시 에러 statusMessage + throw 없음 (REQ-UI-005-011) — must-pass

- **Given** `navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('denied'))` 로 설정하고
- **When** Copy Path를 클릭하면
- **Then** 테스트가 throw로 종료되지 않고(unhandled rejection 없음)
- **And** `useUIStore.getState().statusMessage`가 에러 성격의 문자열(예: `'Failed to copy path'`)이 된다
- **And** 컨텍스트 메뉴는 닫혀 있다(`screen.queryByRole('menu') === null`).

### AC-UI-005-008: 복사 후 컨텍스트 메뉴 닫힘 (REQ-UI-005-008)

- **Given** `fileNode`로 렌더 후 메뉴를 열고
- **When** Copy Path(또는 Copy Name)를 클릭하면
- **Then** `screen.queryByRole('menu')`가 `null`이 된다(메뉴 닫힘).

### AC-UI-005-003a: 키보드 Enter/Space 로 복사 트리거 (REQ-UI-005-005, REQ-UI-005-003)

- **Given** `fileNode`로 렌더 후 메뉴를 열고 Copy Path 항목에 포커스를 둔 상태에서
- **When** `fireEvent.keyDown(copyPathItem, { key: 'Enter' })` (또는 Space)하면
- **Then** `navigator.clipboard.writeText`가 `'/project/readme.md'`로 호출된다.

### AC-UI-005-012: 복사 경로는 byte-identical (변환 없음) (REQ-UI-005-012, REQ-UI-005-002) — must-pass

- **Given** `fileNode.path = 'C:\\Users\\jw\\docs\\readme.md'` (Windows 역슬래시)인 노드로 렌더 후 메뉴를 열고
- **When** Copy Path를 클릭하면
- **Then** `navigator.clipboard.writeText`가 정확히 `'C:\\Users\\jw\\docs\\readme.md'` 로 호출된다(`/`로 변환되지 않음, `expect(...).toHaveBeenCalledWith('C:\\Users\\jw\\docs\\readme.md')`).

### AC-UI-005-009: Footer statusMessage 조건부 렌더 (REQ-UI-005-009, REQ-UI-005-010)

> Footer는 `useUIStore((s) => s.statusMessage)`를 직접 구독한다(annotation v1.0.1 확정 — prop drilling 없음). 테스트는 prop이 아닌 store 상태를 통해 검증한다.

- **Given** `Footer` 컴포넌트를 렌더하고
- **When** `useUIStore.setState({ statusMessage: 'Copied: /x/y.md' })`로 store를 갱신하면
- **Then** `screen.getByText('Copied: /x/y.md')` 가 존재한다(role="status" 권장)
- **And** `useUIStore.setState({ statusMessage: null })`로 갱신하면 `screen.queryByText(/Copied:/)` 가 `null`이다.

### AC-UI-005-013: 복사 후 onRefresh 미호출 (REQ-UI-005-013)

- **Given** `onRefresh = vi.fn()` 으로 `FileTreeNode`를 렌더 후 메뉴를 열고
- **When** Copy Path(또는 Copy Name)를 클릭하면
- **Then** `onRefresh`가 호출되지 않는다(`expect(onRefresh).not.toHaveBeenCalled()`).

### AC-UI-005-014: 의존성 변경 없음 (REQ-UI-005-014)

- **Given** 구현 완료 후
- **When** `git diff package.json package-lock.json`을 확인하면
- **Then** dependencies / devDependencies에 추가된 항목이 없다(버전 bump만 있는 경우도 추가로 간주, 신규 패키지 추가 없음).

### AC-UI-005-018: 명시적 setStatusMessage(null) → 타이머 취소 + 즉시 null (REQ-UI-005-018)

- **Given** `vi.useFakeTimers()` 이고 `setStatusMessage('first')` 호출 후 `vi.advanceTimersByTime(1000)` 한 상태에서
- **When** `setStatusMessage(null)`을 호출하면
- **Then** 즉시 `useUIStore.getState().statusMessage === null` 이 되고
- **And** 이후 `vi.advanceTimersByTime(2000)`을 추가로 진행해도 추가 상태 변화나 타이머 callback이 발생하지 않는다(보류 타이머가 취소되었으므로).

---

## Edge Cases / 엣지 케이스

### EC-1: 폴더 노드 — New File/Folder 와 copy group 순서

- 폴더 메뉴에서 New File / New Folder 다음에 divider, 그 위 copy group이 오는지 검증(AC-002의 순서 assert).

### EC-2: 매우 긴 경로 — Footer truncate

- **Given** `statusMessage` 가 매우 긴 문자열(예: 200자 경로)일 때 Footer를 렌더하면
- **Then** 레이아웃이 깨지지 않고 `truncate` 클래스로 말줄임 처리되는지(시각적 확인은 생략, 클래스 존재 여부로 대용 가능 — Run phase에서 검증 범위 확정).

### EC-3: 빠른 연속 복사

- Copy Path 클릭 → 500ms → Copy Name 클릭 → 최종적으로 `statusMessage`가 Copy Name 값으로 표시되고, 첫 메시지 타이머가 race를 일으키지 않는다(single-flight, AC-017 과 유사하나 컴포넌트 레벨).

### EC-4: 빈 이름 / 빈 경로 방어 (비정상 입력)

- `node.path === ''` 인 비정상 입력에도 crash 없이 `writeText('')` 호출 후 statusMessage 표시(정규화 금지 원칙 유지). 단, 정상 시나리오에서는 Rust가 빈 경로를 거부(`src-tauri/src/commands/file_ops.rs:14-16`)하므로 발생 가능성 낮음.

### EC-5: persist 제외 확인

- **Given** `useUIStore.setState({ statusMessage: 'stale' })` 후 localStorage의 `'mdedit-ui-store'` 키를 파싱하면
- **Then** 직렬화된 객체에 `statusMessage` 필드가 없다(`partialize` 동작 확인).

---

## 품질 게이트 (Quality Gates)

- [ ] 모든 AC 시나리오 대응 테스트 작성(RED 단계).
- [ ] `npm run test` 통과, 기존 테스트 회귀 없음.
- [ ] 커버리지 85% 이상(`quality.yaml` `test_first_required`).
- [ ] Must-pass AC(003, 016, 011, 012) 모두 GREEN.
- [ ] `package.json` / `package-lock.json` 변경 없음(AC-014).
- [ ] `src/lib/tauri/ipc.ts` 및 `src-tauri/` 변경 없음.
- [ ] @MX:NOTE 3개 파일(FileTreeNode, uiStore, Footer)에 ko 로 추가.
- [ ] 메뉴 배치가 사용자 확정값(copy group 위 + divider)을 따름.

## Definition of Done

- 모든 EARS 요구사항(REQ-UI-005-001 ~ 018)이 구현·테스트됨.
- acceptance.md 의 모든 AC 시나리오가 통과함.
- TRUST 5 게이트 통과(Tested 85%+, Readable, Unified, Secured, Trackable).
- 부작용 없음: 기존 컨텍스트 메뉴 액션(Rename/Delete/New) 회귀 없음.
- Rust 백엔드·새 의존성 변경 없음.
