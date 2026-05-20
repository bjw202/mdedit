# SPEC-UI-004 — 수용 기준 (acceptance.md)

> development_mode = tdd. 모든 시나리오는 vitest + @testing-library/react로 검증 가능해야 한다(RED 우선, GREEN 단계 통과 대상). 단일 패널 모드 전환(T2)과 `.html` 자동 미리보기(T4)가 must-pass 기준이다.

## 사전 준비

- 스토어 mock/리셋: `useUIStore.setState({ viewMode, previewWidth, sidebarCollapsed, ... })` (기존 `uiStore.test.ts`/`ResizablePanels.test.tsx`의 `setState` 리셋 패턴 재사용).
- 파일 경로 픽스처: `note.md`(마크다운), `page.html`(HTML), `data.json`(코드). `useFileStore.setState({ currentFile })`로 주입.
- ResizablePanels 렌더 시 sidebar/editor/preview에 식별 가능한 노드 전달(기존 테스트의 `<div>Editor Content</div>` 등 패턴).
- persist 검증: localStorage 키 `'mdedit-ui-store'` 또는 store rehydrate 후 `getState().viewMode` 확인.

---

## 기능 시나리오

### T1: 토글 클릭이 viewMode 변경 + active 표시 (REQ-UI-004-001)

- **Given** 앱이 기본 `split` 모드로 렌더되고 `ViewModeToggle`가 표시된 상태에서
- **When** 사용자가 "편집(editor)" 버튼을 클릭하면
- **Then** `useUIStore.getState().viewMode === 'editor'`가 되고
- **And** 편집 버튼이 활성으로 표시된다(`aria-pressed=true` 또는 active 클래스)
- **And** 활성 강조는 원래 `viewMode` 기준이다(effectiveViewMode가 아님).

### T2: editor 모드는 Preview 숨김, preview 모드는 Editor 숨김 (REQ-UI-004-002) — must-pass

- **Given** `useUIStore.setState({ viewMode: 'editor' })`이고 현재 파일이 `note.md`(비-html)인 상태에서
- **When** ResizablePanels를 editor/preview 노드와 함께 렌더하면
- **Then** Editor 콘텐츠가 보이고(`getByText('Editor Content')`) Preview 콘텐츠는 없다(`queryByText('Preview Content')` → null)
- **And** Editor↔Preview 구분선이 렌더되지 않는다
- **And** (역방향) `viewMode: 'preview'`이면 Preview가 보이고 Editor는 없으며 구분선도 없다.

### T3: 영속화된 viewMode 복원 + 기본값 split (REQ-UI-004-003)

- **Given** persist(`mdedit-ui-store`)에 `viewMode: 'preview'`가 저장된 상태이거나 `setViewMode('preview')` 호출 후
- **When** store가 재초기화(rehydrate)되면
- **Then** `useUIStore.getState().viewMode === 'preview'`가 복원되고
- **And** 저장값이 없을 때(초기 상태)는 `viewMode === 'split'`이 기본값으로 사용된다.

### T4: editor 모드에서 .html 파일은 Preview 표시 + store 보존 (REQ-UI-004-004) — must-pass

- **Given** `useFileStore.setState({ currentFile: '/x/page.html' })`이고 `useUIStore.setState({ viewMode: 'editor' })`인 상태에서
- **When** ResizablePanels를 렌더하면
- **Then** Preview 콘텐츠가 표시되고 Editor는 숨겨진다(effectiveViewMode === 'preview')
- **And** store의 `viewMode`는 여전히 `'editor'`로 유지된다(덮어쓰지 않음, `setViewMode` 미호출)
- **And** currentFile을 `/x/note.md`로 변경하면 다시 Editor가 표시된다(자연 복귀).

### T5: 사이드바 독립성 (REQ-UI-004-005)

- **Given** `useUIStore.setState({ viewMode: 'preview', sidebarCollapsed: false })`인 상태에서
- **When** ResizablePanels를 렌더하면
- **Then** Sidebar 콘텐츠가 viewMode와 무관하게 표시되고
- **And** `sidebarCollapsed: true`로 변경하면 viewMode 값과 상관없이 Sidebar가 숨겨진다(기존 토글 동작 무변경).

---

## 엣지 케이스

- previewWidth 보존: `viewMode: 'split'`에서 `previewWidth`를 70으로 조정 → `'editor'` 전환 → `'split'` 복귀 시 `previewWidth === 70`이 유지된다(단일 모드에서 `setPreviewWidth` 미호출).
- 코드 파일 editor 유지: `currentFile: '/x/data.json'`(`getFileViewType === 'code'`) + `viewMode: 'editor'`이면 Editor가 그대로 표시된다(자동 preview 강등은 `.html`에만 적용).
- 빠른 모드 반복 전환: split↔editor↔preview를 연속 클릭해도 매 전환마다 올바른 패널 조합이 렌더된다.
- 대문자 확장자: `currentFile: '/x/PAGE.HTML'` + `viewMode: 'editor'`에서도 `getFileViewType`이 `'html'`로 판정하여 Preview가 표시된다(분기는 기존 함수에 위임).

---

## 품질 게이트 / Definition of Done

- [ ] 기능 시나리오 T2·T4 통과 (**must-pass — 단일 패널 전환 / `.html` 자동 미리보기 + store 보존**)
- [ ] 기능 시나리오 T1·T3·T5 통과
- [ ] 엣지 케이스 4건 확인 (previewWidth 보존 / 코드 파일 editor 유지 / 반복 전환 / 대문자 확장자)
- [ ] 프런트엔드 타입체크 및 vitest 테스트 통과 (development_mode = tdd, RED 우선)
- [ ] 신규 npm 의존성 0 확인 (`package.json` 변경 없음)
- [ ] 기존 회귀 없음: 사이드바 토글(`sidebarCollapsed`), 마크다운 렌더, `.html`/코드 프리뷰, Footer/Header 기타 기능
- [ ] `getFileViewType`·`useScrollSync` 무수정 확인 (Exclusions 준수)
- [ ] MX 태그 부착 완료 (plan.md Section 3)
