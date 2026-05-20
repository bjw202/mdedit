---
id: SPEC-UI-004
version: "1.0.0"
status: completed
created: "2026-05-20"
updated: "2026-05-20"
author: "jw"
priority: medium
issue_number: 0
dependencies:
  - SPEC-PREVIEW-004
tags:
  - ui
  - layout
  - view-mode
  - header
  - persistence
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-05-20 | jw | 최초 SPEC 작성 — Header에 3-버튼 세그먼티드 토글(편집/분할/미리보기)을 추가하여 Editor/Preview 영역을 split·editor·preview 세 모드로 전환. `viewMode`를 기존 `mdedit-ui-store` persist에 추가하여 재시작 간 복원. `.html` 파일은 editor 모드에서 자동으로 미리보기로 표시(렌더링 한정, store 값 보존). 토글은 신규 `ViewModeToggle` 컴포넌트로 분리. 신규 의존성 0. |

## Overview

`mdedit`(Tauri v2 + React 18 마크다운 편집기)의 본문 레이아웃은 현재 항상 3-pane(FileExplorer | Editor | Preview)로 고정되어 있다.
본 SPEC은 **Header에 3-버튼 세그먼티드 토글**(편집 / 분할 / 미리보기)을 추가하여 Editor/Preview 영역을 다음 세 모드로 전환한다.

1. **split**(기본값): Editor와 Preview를 좌우로 나란히 표시(현재 동작).
2. **editor**: Editor만 전체 폭으로 표시.
3. **preview**: Preview만 전체 폭으로 표시.

이 기능은 **레이아웃 표시 모드 전환**만 다루며, 마크다운 렌더링 파이프라인·파일시스템·백엔드(Rust)는 변경하지 않는다.
선택된 모드는 기존 `useUIStore`의 `persist` 미들웨어(`name: 'mdedit-ui-store'`)를 그대로 재사용하여 앱 재시작 후에도 복원된다(테마·패널 너비와 동일 메커니즘).
`.html` 파일의 편집기 칸은 이미 "편집 불가 플레이스홀더"(SPEC-PREVIEW-004)이므로, editor 모드에서 `.html`이 현재 파일이면 자동으로 미리보기를 표시한다. 단 이 동작은 **렌더링 한정**이며 사용자가 선택한 `viewMode` 값은 store에 보존되어 비-`.html` 파일로 전환하면 자연 복귀한다.
FileExplorer 사이드바는 **viewMode와 무관**하며 기존 `☰` 버튼(`toggleSidebar` / `sidebarCollapsed`)으로만 제어된다.

## Glossary

- **뷰 모드(view mode)**: Editor/Preview 영역의 표시 상태. `'split' | 'editor' | 'preview'` 중 하나. `useUIStore.viewMode`에 보관되며 persist된다.
- **세그먼티드 토글(segmented toggle)**: Header에 추가되는 3-버튼 컨트롤. 가운데(분할)가 기본 활성. 신규 `ViewModeToggle` 컴포넌트로 분리한다(`ImageModeToggle` 선례와 동일 패턴).
- **유효 뷰 모드(effective view mode)**: 실제 렌더링·너비 계산에 사용되는 파생 값. 기본적으로 `viewMode`와 같으나, `viewMode === 'editor'`이면서 현재 파일이 `.html`이면 `'preview'`로 강등된다. store의 `viewMode`는 변경하지 않는다.
- **파일 종류 분기(file-type routing)**: 선택된 파일의 확장자를 보고 `'html' | 'code' | 'markdown'`을 반환하는 순수 함수 `getFileViewType` (SPEC-PREVIEW-004/005). 본 SPEC은 이 함수를 **호출만** 하고 수정하지 않는다.
- **persist 메커니즘**: `useUIStore`가 사용하는 zustand `persist` 미들웨어. localStorage 키 `'mdedit-ui-store'`에 store 전체 상태를 직렬화하며, 신규 필드는 추가 설정 없이 자동 영속화된다.
- **사이드바 토글 독립성**: FileExplorer 표시 여부는 `sidebarCollapsed`로만 제어되며 viewMode의 영향을 받지 않는다.

## EARS Requirements

### REQ-UI-004-001: Header 세그먼티드 토글 (Ubiquitous + Event-driven)

- The system **shall** Header에 편집(editor) / 분할(split) / 미리보기(preview) 세 모드를 나타내는 3-버튼 세그먼티드 토글을 직관적 아이콘과 함께 표시한다.
- The system **shall** 세그먼티드 토글을 Header 인라인이 아닌 신규 `ViewModeToggle` 컴포넌트로 분리하여 구현한다(`ImageModeToggle` 패턴과 일관).
- **WHEN** 사용자가 뷰 모드 버튼 중 하나를 클릭하면, **the system shall** `useUIStore.viewMode`를 해당 값으로 설정한다.
- **WHILE** 특정 `viewMode`가 활성인 동안, **the system shall** 해당 버튼만 활성(active) 상태로 강조한다. 활성 강조는 유효 뷰 모드가 아닌 **원래 `viewMode` 값**을 기준으로 한다.

### REQ-UI-004-002: ResizablePanels 3-모드 렌더링 (State-driven)

- **WHILE** 유효 뷰 모드가 `split`인 동안, **the system shall** Editor와 Preview를 기존 `previewWidth` 비율(`calc()` 기반)로 좌우 나란히 렌더한다(현재 동작 무변경).
- **WHILE** 유효 뷰 모드가 `editor`인 동안, **the system shall** Editor만 가용 전체 폭으로 렌더하고 Preview 패널과 Editor↔Preview 구분선을 렌더하지 않는다.
- **WHILE** 유효 뷰 모드가 `preview`인 동안, **the system shall** Preview만 가용 전체 폭으로 렌더하고 Editor 패널과 Editor↔Preview 구분선을 렌더하지 않는다.
- The system **shall** 단일 패널 모드에서 사용자가 조정한 `previewWidth` 비율 값을 store에서 변경하지 않고 보존하여, `split` 복귀 시 이전 비율이 그대로 복원되도록 한다.

### REQ-UI-004-003: 재시작 간 영속화 (Ubiquitous + Event-driven)

- The system **shall** `viewMode`를 기존 `mdedit-ui-store` persist 메커니즘(localStorage)으로 영속화한다(별도 storage 설정 추가 없이 기존 미들웨어 재사용).
- **WHEN** 애플리케이션이 마운트되면, **the system shall** 마지막으로 영속화된 `viewMode`를 복원한다.
- **IF** 영속화된 `viewMode` 값이 없으면, **then the system shall** 기본값 `split`을 사용한다.

### REQ-UI-004-004: `.html` 자동 미리보기 (Complex + Event-driven + Unwanted behavior)

- **WHILE** `viewMode`가 `editor`인 동안, **when** 현재 파일이 `.html`(`getFileViewType(currentFile) === 'html'`)이면, **the system shall** Editor 대신 Preview를 렌더한다(유효 뷰 모드 = `preview`).
- **WHEN** `viewMode`가 `editor`인 상태에서 현재 파일이 `.html`에서 비-`.html` 파일로 변경되면, **the system shall** 다시 Editor를 렌더한다(별도 store 변경 없이 자연 복귀).
- **IF** 현재 파일이 `.html`이면, **then the system shall** 영속화된 `viewMode` 값을 덮어쓰지 않는다(렌더링 한정, store 보존).
- The system **shall** `.html` 외의 코드 파일(`getFileViewType === 'code'`: `.py`, `.json`, `.ts` 등)을 editor 모드에서 Editor에 텍스트로 그대로 표시하여 편집 가능 상태를 유지한다(자동 미리보기 강등 대상은 `.html`에 한정).

### REQ-UI-004-005: 기본값 split 및 사이드바 독립성 (Ubiquitous)

- The system **shall** 최초 실행 시 `viewMode`를 `split`(가운데 버튼 활성)으로 기본 설정한다.
- The system **shall** 뷰 모드 토글이 FileExplorer 사이드바 표시 여부에 영향을 주지 않도록 하며, 사이드바는 `sidebarCollapsed`(기존 `☰` 버튼)로만 제어되도록 유지한다.

## [DELTA] Brownfield Change Map

| 분류 | 대상 | 변경 내용 |
|------|------|-----------|
| [MODIFY] | `src/store/uiStore.ts` | `ViewMode` 타입(`'split' \| 'editor' \| 'preview'`)·`viewMode` 필드(기본 `'split'`)·`setViewMode(mode)` 액션 추가. persist는 기존 `mdedit-ui-store` 미들웨어가 자동 처리(추가 설정 없음). `Theme`/`SaveStatus`/`ImageInsertMode`의 string literal union + 명시적 setter 컨벤션을 따른다(3-state라 toggle 대신 `setViewMode`). |
| [MODIFY] | `src/components/layout/Header.tsx` | 신규 `ViewModeToggle`를 Header에 배치. `viewMode`/`setViewMode` 구독은 `ViewModeToggle` 내부에서 store 직접 구독(Header props 추가 없음). 기존 New/Save/Export/폰트/테마 컨트롤은 무변경. |
| [MODIFY] | `src/components/layout/ResizablePanels.tsx` | `useUIStore`에서 `viewMode` 직접 구독, `useFileStore`에서 `currentFile` 직접 구독. `effectiveViewMode` 파생(`viewMode === 'editor' && getFileViewType(currentFile) === 'html' ? 'preview' : viewMode`). 모드별 너비 계산(단일 모드 전체 폭) + 조건부 Editor/Preview 패널·구분선 렌더링. 사이드바 분기는 무변경. |
| [MODIFY] | `src/components/layout/AppLayout.tsx` (소폭) | 변경 최소화. `.html` 자동 미리보기 파생은 ResizablePanels에서 처리하므로 AppLayout은 기존 `editorPanel`(편집 불가 플레이스홀더 분기)을 그대로 전달. 필요 시 props 시그니처만 미세 조정. |
| [NEW] | `src/components/layout/ViewModeToggle.tsx` | 3-버튼 세그먼티드 토글 컴포넌트(편집/분할/미리보기 아이콘). `useUIStore`에서 `viewMode`/`setViewMode` 구독, active 강조는 원래 `viewMode` 기준. `.html`+editor일 때 미리보기로 표시됨을 알리는 tooltip 힌트는 선택적(nice-to-have). |
| [NEW] | `src/test/ViewModeToggle.test.tsx` | 토글 렌더·클릭→viewMode 변경·active 표시 단위 테스트. |
| [EXISTING] | `src/components/preview/PreviewContainer.tsx` (`getFileViewType`) | 변경 없음 — `.html` 판정에 호출만 한다. SPEC-PREVIEW-004/005의 분기 로직 무수정. |
| [EXISTING] | `src/components/sidebar/FileExplorer.tsx` + 사이드바 토글 | 변경 없음 — viewMode와 독립. `sidebarCollapsed`/`☰` 동작 그대로. |
| [EXISTING] | `src/hooks/useScrollSync.ts` | 변경 없음 — 단일 패널 모드에서 스크롤 싱크가 무동작이 되는 것은 자연스러운 부수효과이며 로직 수정 대상 아님. |

## Exclusions (What NOT to Build)

- **키보드 단축키 미포함** — Cmd/Ctrl+1/2/3 등 뷰 모드 전환 단축키를 추가하지 않는다(사용자 명시 확정). 모드 전환은 세그먼티드 토글 클릭으로만 수행한다.
- **사이드바 동작 변경 미포함** — FileExplorer 표시 여부는 기존 `sidebarCollapsed`(`☰` 버튼)로만 제어된다. 뷰 모드 토글은 사이드바에 영향을 주지 않는다.
- **신규 리사이즈 패널 라이브러리 미포함** — 기존 자체 구현 드래그-리사이즈(`calc((100% - fixedPx) * ratio)`)를 그대로 사용한다. react-resizable-panels 등 외부 패키지를 도입하지 않는다.
- **Footer/Header의 다른 기능 변경 미포함** — 저장 상태, 폰트 크기(A-/A+), 테마 토글, Export 드롭다운, 단어/문자/줄 카운트, 스크롤 싱크 토글은 손대지 않는다.
- **`getFileViewType` 수정 미포함** — `.html`/`code`/`markdown` 분기 함수는 호출만 하며 함수 본문·반환 타입·우선순위를 변경하지 않는다(SPEC-PREVIEW-004/005 동작 무변경).
- **스크롤 싱크 로직 변경 미포함** — `useScrollSync`는 수정하지 않는다. 단일 패널 모드에서 싱크 무동작은 의도된 부수효과이다.
- **`.html` 자동 미리보기의 store 강제 변경 미포함** — `.html` 진입 시 `setViewMode`를 호출하지 않는다. 자동 미리보기는 렌더링용 파생(`effectiveViewMode`)으로만 처리하여 사용자가 선택한 `viewMode`를 보존한다.

## 구현 노트 (Implementation Notes)

Plan을 그대로 채택하여 구현했다. scope 변경 없음, `AppLayout.tsx` 미접촉, 신규 npm 의존성 0.

- `ViewModeToggle`: 신규 세그먼티드 토글 컴포넌트로 분리. active 강조는 `effectiveViewMode`가 아닌 원래 `viewMode` 기준(확정 결정 2). 각 버튼 `aria-pressed` 부여.
- `effectiveViewMode` 파생: `.html`+editor 자동 미리보기 강등은 `ResizablePanels`에서만 처리하며 store의 `viewMode`는 보존(`setViewMode` 미호출, REQ-UI-004-004).
- 패널 너비: 단일 모드(editor/preview)는 비율을 무시하고 가용 전체 폭, split 복귀 시 `previewWidth` 비율 보존.
- persist: 기존 `mdedit-ui-store` zustand 미들웨어로 자동 영속화(추가 설정 없음).

테스트: 신규 22건 추가(must-pass T2·T4 포함), 전체 448/448 통과, 타입체크 clean.

## References

- SPEC-PREVIEW-004 — `.html` 파일 보기 + `getFileViewType`/`PreviewContainer` 단일 라우팅 진입점 (`.html` 판정 재사용 대상, 무수정)
- SPEC-UI-001/002/003 — 기존 UI 도메인 SPEC (도메인 일관성 참조)
- `src/store/uiStore.ts` — zustand persist 미들웨어(`mdedit-ui-store`), `Theme`/`SaveStatus`/`ImageInsertMode` literal-union + setter 컨벤션 (재사용 대상)
- `src/components/layout/ResizablePanels.tsx` — `calc()` 기반 패널 너비 계산 로직 (모드별 분기 추가 대상)
- `src/components/settings/ImageModeToggle.tsx` — 토글 컴포넌트 분리 선례 (`ViewModeToggle` 패턴 참조)
