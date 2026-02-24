---
id: SPEC-UI-001
version: "1.0.0"
status: approved
created: "2026-02-24"
updated: "2026-02-24"
author: "jw"
priority: P1
tags: [layout, ui, theme, zustand, tailwind]
dependencies: [SPEC-INFRA-001]
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-24 | jw | Initial SPEC creation |

## Overview

MdEdit 데스크톱 애플리케이션의 3-Pane 레이아웃 시스템을 정의한다. 사이드바(File Explorer), 에디터, 프리뷰 세 영역으로 구성된 리사이즈 가능한 패널 레이아웃을 구현하며, Header(파일명 및 저장 상태), Footer(라인 수, 인코딩 정보), Zustand uiStore(사이드바 너비, 프리뷰 너비, 테마, 폰트 크기), 시스템 다크 모드 감지, localStorage 영속성, Tailwind CSS 기반 스타일링을 포함한다.

이 SPEC은 MdEdit의 시각적 구조와 사용자 인터랙션의 기반이 되는 레이아웃 컴포넌트 전체를 다룬다.

---

## EARS Requirements

### Ubiquitous Requirements

- **REQ-UI001-U01**: 시스템은 항상 3-Pane 레이아웃(사이드바, 에디터, 프리뷰)을 기본 구조로 렌더링해야 한다.
- **REQ-UI001-U02**: 시스템은 항상 Header 영역에 현재 파일명과 저장 상태(saved/unsaved)를 표시해야 한다.
- **REQ-UI001-U03**: 시스템은 항상 Footer 영역에 현재 문서의 라인 수, 커서 위치(행:열), 인코딩(UTF-8) 정보를 표시해야 한다.
- **REQ-UI001-U04**: 시스템은 항상 Tailwind CSS 유틸리티 클래스를 사용하여 일관된 스타일링을 적용해야 한다.
- **REQ-UI001-U05**: 시스템은 항상 레이아웃 상태(사이드바 너비, 프리뷰 너비, 테마, 폰트 크기)를 Zustand uiStore를 통해 관리해야 한다.
- **REQ-UI001-U06**: 시스템은 항상 레이아웃이 60fps(16ms 이하) 성능으로 리사이즈되어야 한다.

### Event-Driven Requirements

- **REQ-UI001-E01**: WHEN 사용자가 패널 경계선을 드래그할 때, THEN 시스템은 해당 패널의 너비를 실시간으로 조절하고 uiStore를 업데이트해야 한다.
- **REQ-UI001-E02**: WHEN 사용자가 사이드바 토글 버튼을 클릭할 때, THEN 시스템은 사이드바를 접기(collapse) 또는 펼치기(expand) 상태로 전환해야 한다.
- **REQ-UI001-E03**: WHEN 시스템 테마(다크/라이트)가 변경될 때, THEN 시스템은 자동으로 해당 테마를 감지하고 UI 전체에 반영해야 한다.
- **REQ-UI001-E04**: WHEN 사용자가 폰트 크기를 변경할 때, THEN 시스템은 에디터와 프리뷰 영역의 폰트 크기를 즉시 업데이트해야 한다.
- **REQ-UI001-E05**: WHEN 애플리케이션이 시작될 때, THEN 시스템은 localStorage에서 이전 레이아웃 설정(패널 너비, 테마, 폰트 크기)을 복원해야 한다.
- **REQ-UI001-E06**: WHEN uiStore의 상태가 변경될 때, THEN 시스템은 해당 상태를 localStorage에 자동으로 영속화해야 한다.
- **REQ-UI001-E07**: WHEN 브라우저 창 크기가 변경될 때, THEN 시스템은 패널 비율을 유지하면서 레이아웃을 반응형으로 재조정해야 한다.

### State-Driven Requirements

- **REQ-UI001-S01**: IF 사이드바가 접힌 상태(collapsed)이면, THEN 에디터와 프리뷰 영역이 사이드바 공간을 차지하여 확장되어야 한다.
- **REQ-UI001-S02**: IF 파일이 수정되어 저장되지 않은 상태(dirty)이면, THEN Header에 파일명 옆에 미저장 표시(dot 또는 asterisk)가 나타나야 한다.
- **REQ-UI001-S03**: IF 열린 파일이 없는 상태이면, THEN Header에 "Untitled" 또는 환영 메시지를 표시하고, 에디터 영역에 빈 상태 안내를 보여야 한다.
- **REQ-UI001-S04**: IF 다크 모드가 활성화된 상태이면, THEN 모든 UI 컴포넌트(Header, Footer, 패널 경계선, 배경)에 다크 테마 색상이 적용되어야 한다.
- **REQ-UI001-S05**: IF localStorage에 저장된 설정이 없는 상태이면, THEN 시스템은 기본값(사이드바 너비 250px, 프리뷰 너비 50%, 시스템 테마, 폰트 크기 14px)을 사용해야 한다.

### Unwanted Behavior Requirements

- **REQ-UI001-N01**: 시스템은 패널 너비가 최소값(사이드바 180px, 에디터 200px, 프리뷰 200px) 미만으로 줄어들지 않아야 한다.
- **REQ-UI001-N02**: 시스템은 레이아웃 리사이즈 중 화면 깜빡임(flickering)이나 레이아웃 깨짐(layout shift)이 발생하지 않아야 한다.
- **REQ-UI001-N03**: 시스템은 uiStore 상태 변경 시 불필요한 전체 리렌더링을 수행하지 않아야 한다.
- **REQ-UI001-N04**: 시스템은 테마 전환 시 시각적 깜빡임(FOUC, Flash of Unstyled Content)이 발생하지 않아야 한다.

### Optional Requirements

- **REQ-UI001-O01**: 가능하면 사이드바와 프리뷰 패널 각각에 대해 독립적인 접기/펼치기 기능을 제공해야 한다.
- **REQ-UI001-O02**: 가능하면 패널 경계선에 더블클릭 시 해당 패널을 기본 너비로 리셋하는 기능을 제공해야 한다.
- **REQ-UI001-O03**: 가능하면 키보드 단축키(예: Ctrl+B)로 사이드바 토글 기능을 제공해야 한다.

---

## Technical Constraints

### 컴포넌트 구조

| 컴포넌트 | 파일 경로 | 역할 |
|----------|-----------|------|
| AppLayout | `src/components/layout/AppLayout.tsx` | 3-Pane 레이아웃 컨테이너 |
| ResizablePanels | `src/components/layout/ResizablePanels.tsx` | 리사이즈 가능한 패널 시스템 |
| Header | `src/components/layout/Header.tsx` | 파일명, 저장 상태 표시 |
| Footer | `src/components/layout/Footer.tsx` | 라인 수, 커서 위치, 인코딩 표시 |

### 상태 관리

| Store | 파일 경로 | 관리 상태 |
|-------|-----------|-----------|
| uiStore | `src/store/uiStore.ts` | sidebarWidth, previewWidth, theme, fontSize, sidebarCollapsed |

### Hook

| Hook | 파일 경로 | 역할 |
|------|-----------|------|
| useTheme | `src/hooks/useTheme.ts` | 시스템 다크 모드 감지, CSS 변수 주입, localStorage 영속성 |

### 성능 요구사항

- 레이아웃 변경: < 16ms (60fps 보장)
- 테마 전환: < 100ms
- 초기 레이아웃 렌더링: < 200ms
- localStorage 읽기/쓰기: < 10ms

### 기술 스택 제약

- React 18.x with TypeScript strict mode
- Tailwind CSS 3.x (utility-first)
- Zustand 5.x with persist middleware
- `window.matchMedia('(prefers-color-scheme: dark)')` for system theme detection
- CSS `resize` 또는 `mousedown/mousemove/mouseup` 이벤트 기반 리사이즈

---

## Dependencies

### 내부 의존성

| SPEC ID | 의존 내용 |
|---------|-----------|
| SPEC-INFRA-001 | Tauri v2 프로젝트 초기화, Vite 설정, Tailwind CSS 설정, 기본 프로젝트 구조 |

### 외부 라이브러리

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| react | 18.x | UI 프레임워크 |
| zustand | 5.x | 상태 관리 (persist middleware 포함) |
| tailwindcss | 3.x | CSS 스타일링 |

---

## Traceability

- **Product Reference**: product.md - Core Features 섹션 (3-Pane 레이아웃, 시스템 테마)
- **Structure Reference**: structure.md - `src/components/layout/`, `src/store/uiStore.ts`, `src/hooks/useTheme.ts`
- **Tech Reference**: tech.md - Zustand, Tailwind CSS, React 18 결정
