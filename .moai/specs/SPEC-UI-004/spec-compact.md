# SPEC-UI-004 (compact) — Header 레이아웃 뷰 모드 전환 (split / editor / preview)

> id: SPEC-UI-004 · version 1.0.0 · status draft · priority medium · lifecycle spec-anchored
> dependencies: SPEC-PREVIEW-004 (`getFileViewType` `.html` 분기 재사용, 무수정)

## Requirements (REQ)

- **REQ-UI-004-001** (Ubiquitous + Event-driven): Header에 편집/분할/미리보기 3-버튼 세그먼티드 토글(아이콘) 표시. 신규 `ViewModeToggle` 컴포넌트로 분리. 버튼 클릭 시 `useUIStore.viewMode`를 해당 값으로 설정. 활성 강조는 **원래 `viewMode` 기준**(effectiveViewMode 아님).
- **REQ-UI-004-002** (State-driven): 유효 뷰 모드 `split`→Editor/Preview 좌우 나란히(기존 `previewWidth` 비율), `editor`→Editor만 전체 폭(Preview·구분선 미렌더), `preview`→Preview만 전체 폭(Editor·구분선 미렌더). 단일 모드에서 `previewWidth` store 값 보존하여 split 복귀 시 복원.
- **REQ-UI-004-003** (Ubiquitous + Event-driven): `viewMode`를 기존 `mdedit-ui-store` persist로 영속화(추가 설정 없음). 마운트 시 마지막 값 복원. 저장값 없으면 기본 `split`.
- **REQ-UI-004-004** (Complex + Unwanted): `viewMode==='editor'` & 현재 파일 `.html`(`getFileViewType==='html'`)이면 Preview 렌더(effectiveViewMode='preview'). `.html`→비-`.html` 전환 시 Editor 자연 복귀. `.html`이어도 store `viewMode` 미변경(렌더링 한정). 코드 파일(`'code'`: .py/.json/.ts)은 editor 모드에서 Editor에 편집 가능 상태로 유지.
- **REQ-UI-004-005** (Ubiquitous): 최초 실행 시 기본 `split`(가운데 버튼 활성). 뷰 모드 토글은 FileExplorer 사이드바에 영향 없음(`sidebarCollapsed`/`☰`로만 제어).

## Acceptance (Given/When/Then 요약)

- **T1** (REQ-001): editor 버튼 클릭 → `viewMode==='editor'` + 해당 버튼 active(원래 viewMode 기준).
- **T2** (REQ-002, must-pass): `viewMode='editor'`+비-html → Editor만/Preview·구분선 없음. 역으로 `preview` → Preview만/Editor·구분선 없음.
- **T3** (REQ-003): persist에 `preview` 저장 후 rehydrate → 복원. 저장값 없으면 기본 `split`.
- **T4** (REQ-004, must-pass): `currentFile=page.html`+`viewMode='editor'` → Preview 표시·Editor 숨김, store `viewMode`는 `'editor'` 유지. `note.md`로 변경 시 Editor 복귀.
- **T5** (REQ-005): `viewMode='preview'`여도 Sidebar는 `sidebarCollapsed`로만 표시/숨김.
- 엣지: previewWidth 보존 / 코드 파일 editor 유지 / 빠른 반복 전환 / 대문자 `.HTML`.

## Files to Modify / Add

- [MODIFY] `src/store/uiStore.ts` — `ViewMode` 타입, `viewMode`(기본 `'split'`), `setViewMode`. persist 자동.
- [MODIFY] `src/components/layout/Header.tsx` — `ViewModeToggle` 배치. 기타 컨트롤 무변경.
- [MODIFY] `src/components/layout/ResizablePanels.tsx` — viewMode/currentFile 구독, `effectiveViewMode` 파생, 모드별 너비(단일 전체 폭) + 조건부 패널·구분선 렌더.
- [MODIFY] `src/components/layout/AppLayout.tsx` (소폭) — 기존 editorPanel 전달 유지.
- [NEW] `src/components/layout/ViewModeToggle.tsx` — 3-버튼 세그먼티드 토글.
- [NEW] `src/test/ViewModeToggle.test.tsx` — 토글 단위 테스트.
- [MODIFY] `src/test/uiStore.test.ts`, `src/test/ResizablePanels.test.tsx` — viewMode/모드 렌더/.html 자동 preview 테스트.
- [EXISTING/무수정] `getFileViewType`(PreviewContainer.tsx), FileExplorer/사이드바, `useScrollSync`.

## Exclusions (What NOT to Build)

- 키보드 단축키 미포함 (Cmd/Ctrl+1/2/3 등). 토글 클릭으로만 전환.
- 사이드바 동작 변경 미포함 — `sidebarCollapsed`/`☰`로만 제어, viewMode와 독립.
- 신규 리사이즈 패널 라이브러리 미포함 — 기존 `calc()` 자체 구현 사용.
- Footer/Header 기타 기능 변경 미포함 — 저장/폰트/테마/Export/카운트/스크롤싱크 토글 무변경.
- `getFileViewType` 수정 미포함 — 호출만, 본문·반환 타입·우선순위 무변경.
- 스크롤 싱크 로직 변경 미포함 — 단일 패널 모드 싱크 무동작은 의도된 부수효과.
- `.html` 자동 미리보기의 store 강제 변경 미포함 — `setViewMode` 미호출, 렌더링용 `effectiveViewMode` 파생만.
