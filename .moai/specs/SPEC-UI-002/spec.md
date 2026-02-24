---
id: SPEC-UI-002
version: "1.0.0"
status: approved
created: "2026-02-24"
updated: "2026-02-24"
author: "jw"
priority: P1
tags: [sidebar, file-explorer, file-tree, context-menu, zustand]
dependencies: [SPEC-FS-001, SPEC-UI-001]
lifecycle: spec-anchored
---

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-24 | jw | Initial SPEC creation |

## Overview

MdEdit의 File Explorer 사이드바를 정의한다. 디렉토리 구조를 재귀적으로 표시하는 FileTree, 개별 노드에 대한 컨텍스트 메뉴(생성/삭제/이름 변경), 네이티브 디렉토리 열기 대화상자 연동, 파일 확장자별 아이콘, 디렉토리 확장/축소, 검색 필터, Zustand fileStore 통합을 포함한다.

이 SPEC은 사용자가 프로젝트 파일을 탐색하고 관리하는 핵심 인터페이스를 다루며, Tauri IPC를 통한 파일 시스템 연동의 프론트엔드 측면을 정의한다.

---

## EARS Requirements

### Ubiquitous Requirements

- **REQ-UI002-U01**: 시스템은 항상 File Explorer 사이드바에 현재 열린 디렉토리의 파일/폴더 트리를 계층적으로 표시해야 한다.
- **REQ-UI002-U02**: 시스템은 항상 각 FileTreeNode에 파일 확장자에 따른 아이콘을 표시해야 한다.
- **REQ-UI002-U03**: 시스템은 항상 FileNode 데이터 모델(`{ name, path, isDirectory, children?, extension? }`)을 사용하여 파일 트리를 관리해야 한다.
- **REQ-UI002-U04**: 시스템은 항상 파일/폴더 이름을 알파벳 순서로 정렬하되, 폴더를 파일보다 먼저 표시해야 한다.
- **REQ-UI002-U05**: 시스템은 항상 Zustand fileStore를 통해 파일 트리 상태, 현재 열린 파일, 감시 중인 디렉토리를 관리해야 한다.

### Event-Driven Requirements

- **REQ-UI002-E01**: WHEN 사용자가 파일 노드를 클릭할 때, THEN 시스템은 해당 파일을 에디터에서 열어야 한다.
- **REQ-UI002-E02**: WHEN 사용자가 폴더 노드를 클릭할 때, THEN 시스템은 해당 폴더의 하위 항목을 확장(expand)하거나 축소(collapse)해야 한다.
- **REQ-UI002-E03**: WHEN 사용자가 파일 또는 폴더 노드를 우클릭할 때, THEN 시스템은 컨텍스트 메뉴(새 파일, 새 폴더, 이름 변경, 삭제)를 표시해야 한다.
- **REQ-UI002-E04**: WHEN 사용자가 "Open Folder" 버튼을 클릭할 때, THEN 시스템은 Tauri 네이티브 디렉토리 선택 대화상자를 열어야 한다.
- **REQ-UI002-E05**: WHEN 사용자가 네이티브 대화상자에서 디렉토리를 선택할 때, THEN 시스템은 선택된 디렉토리의 파일 트리를 로드하고 FileExplorer에 표시해야 한다.
- **REQ-UI002-E06**: WHEN 사용자가 컨텍스트 메뉴에서 "새 파일"을 선택할 때, THEN 시스템은 현재 선택된 디렉토리에 인라인 이름 입력 필드를 표시하고, 입력 완료 시 파일을 생성해야 한다.
- **REQ-UI002-E07**: WHEN 사용자가 컨텍스트 메뉴에서 "새 폴더"를 선택할 때, THEN 시스템은 현재 선택된 디렉토리에 인라인 이름 입력 필드를 표시하고, 입력 완료 시 폴더를 생성해야 한다.
- **REQ-UI002-E08**: WHEN 사용자가 컨텍스트 메뉴에서 "이름 변경"을 선택할 때, THEN 시스템은 해당 노드의 이름을 인라인 편집 가능 상태로 전환해야 한다.
- **REQ-UI002-E09**: WHEN 사용자가 컨텍스트 메뉴에서 "삭제"를 선택할 때, THEN 시스템은 확인 대화상자를 표시하고, 확인 시 해당 파일/폴더를 삭제해야 한다.
- **REQ-UI002-E10**: WHEN 사용자가 검색 필터에 텍스트를 입력할 때, THEN 시스템은 파일명이 입력 텍스트와 일치하는 노드만 표시하고, 매칭되는 노드의 부모 디렉토리를 자동 확장해야 한다.
- **REQ-UI002-E11**: WHEN 폴더가 처음 확장될 때, THEN 시스템은 해당 폴더의 하위 항목을 Tauri IPC를 통해 지연 로딩(lazy loading)해야 한다.
- **REQ-UI002-E12**: WHEN 사용자가 현재 열린 파일이 있는 상태에서 다른 파일을 클릭할 때, THEN 시스템은 editorStore를 업데이트하고 새 파일의 내용을 에디터에 로드해야 한다.

### State-Driven Requirements

- **REQ-UI002-S01**: IF 디렉토리가 열려 있지 않은 상태이면, THEN FileExplorer는 "Open Folder" 버튼과 안내 메시지를 표시해야 한다.
- **REQ-UI002-S02**: IF 파일 트리가 로딩 중인 상태이면, THEN 해당 디렉토리 노드에 로딩 스피너를 표시해야 한다.
- **REQ-UI002-S03**: IF 검색 필터가 활성화된 상태이면, THEN 매칭되지 않는 노드를 숨기고 매칭되는 노드만 하이라이트하여 표시해야 한다.
- **REQ-UI002-S04**: IF 현재 에디터에서 열린 파일이 있는 상태이면, THEN 해당 파일의 FileTreeNode가 시각적으로 강조(selected/active 상태)되어야 한다.
- **REQ-UI002-S05**: IF 폴더가 확장된 상태이면, THEN 해당 폴더 아이콘이 열린 폴더 아이콘으로 변경되어야 한다.

### Unwanted Behavior Requirements

- **REQ-UI002-N01**: 시스템은 삭제 확인 없이 파일이나 폴더를 삭제하지 않아야 한다.
- **REQ-UI002-N02**: 시스템은 빈 파일명 또는 유효하지 않은 문자가 포함된 파일명으로 파일/폴더를 생성하지 않아야 한다.
- **REQ-UI002-N03**: 시스템은 같은 디렉토리에 동일한 이름의 파일/폴더가 이미 존재하는 경우 생성/이름 변경을 허용하지 않아야 한다.
- **REQ-UI002-N04**: 시스템은 파일 시스템 오류 발생 시 사용자에게 알림 없이 실패하지 않아야 한다.
- **REQ-UI002-N05**: 시스템은 루트 디렉토리 상위로의 경로 탐색(path traversal)을 허용하지 않아야 한다.

### Optional Requirements

- **REQ-UI002-O01**: 가능하면 FileExplorer 상단에 현재 열린 디렉토리 경로를 Breadcrumb 형태로 표시해야 한다.
- **REQ-UI002-O02**: 가능하면 파일 노드에 마우스 호버 시 파일 크기와 수정 날짜를 툴팁으로 표시해야 한다.
- **REQ-UI002-O03**: 가능하면 드래그 앤 드롭으로 파일 이동 기능을 지원해야 한다 (V2+ 기능).

---

## Technical Constraints

### 컴포넌트 구조

| 컴포넌트 | 파일 경로 | 역할 |
|----------|-----------|------|
| FileExplorer | `src/components/sidebar/FileExplorer.tsx` | 사이드바 컨테이너, "Open Folder" 버튼, 빈 상태 처리 |
| FileTree | `src/components/sidebar/FileTree.tsx` | 재귀적 파일 트리 렌더링 |
| FileTreeNode | `src/components/sidebar/FileTreeNode.tsx` | 개별 파일/폴더 노드, 컨텍스트 메뉴, 인라인 편집 |
| FileSearch | `src/components/sidebar/FileSearch.tsx` | 파일명 검색 필터 입력 |

### 상태 관리

| Store | 파일 경로 | 관리 상태 |
|-------|-----------|-----------|
| fileStore | `src/store/fileStore.ts` | fileTree, currentFile, expandedDirs, watchedPath, isLoading |

### Hook

| Hook | 파일 경로 | 역할 |
|------|-----------|------|
| useFileSystem | `src/hooks/useFileSystem.ts` | Tauri IPC 파일 작업 래퍼 (open, save, create, delete, rename) |

### 데이터 모델

```typescript
interface FileNode {
  name: string;          // 파일/폴더 이름
  path: string;          // 절대 경로
  isDirectory: boolean;  // 디렉토리 여부
  children?: FileNode[]; // 하위 항목 (디렉토리만)
  extension?: string;    // 파일 확장자 (.md, .txt 등)
}
```

### 파일 아이콘 매핑

| 확장자 | 아이콘 유형 |
|--------|------------|
| .md, .markdown | Markdown 아이콘 |
| .txt | 텍스트 아이콘 |
| .json | JSON 아이콘 |
| .yaml, .yml | YAML 아이콘 |
| .ts, .tsx | TypeScript 아이콘 |
| .js, .jsx | JavaScript 아이콘 |
| .css, .scss | 스타일 아이콘 |
| .html | HTML 아이콘 |
| (directory) | 폴더 아이콘 (열림/닫힘) |
| (기타) | 기본 파일 아이콘 |

### 성능 요구사항

- 디렉토리 트리 최초 로드 (1000개 파일): < 200ms
- 폴더 확장 (지연 로딩): < 100ms
- 검색 필터링 응답: < 50ms
- 파일 클릭 ~ 에디터 로드: < 100ms (IPC 포함)
- 컨텍스트 메뉴 표시: < 16ms

### 기술 스택 제약

- React 18.x with TypeScript strict mode
- Zustand 5.x for fileStore
- Tauri v2 IPC: `invoke('read_directory')`, `invoke('open_directory_dialog')`, `invoke('create_file')`, `invoke('delete_file')`, `invoke('rename_file')`
- Tailwind CSS 3.x for styling
- SVG 기반 파일 아이콘 (번들 크기 최소화)

---

## Dependencies

### 내부 의존성

| SPEC ID | 의존 내용 |
|---------|-----------|
| SPEC-FS-001 | Tauri 백엔드 파일 작업 커맨드 (read_directory, create_file, delete_file, rename_file, open_directory_dialog) |
| SPEC-UI-001 | AppLayout의 사이드바 영역, uiStore의 sidebarWidth/sidebarCollapsed 상태 |

### 외부 라이브러리

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| react | 18.x | UI 프레임워크 |
| zustand | 5.x | 상태 관리 |
| @tauri-apps/api | 2.x | Tauri IPC 커맨드 호출 |
| tailwindcss | 3.x | CSS 스타일링 |

---

## Traceability

- **Product Reference**: product.md - Core Feature 3 (File and Directory Explorer), 사용자 시나리오 3 (Multi-File Documentation)
- **Structure Reference**: structure.md - `src/components/sidebar/`, `src/store/fileStore.ts`, `src/hooks/useFileSystem.ts`
- **Tech Reference**: tech.md - Tauri IPC, Zustand, React 18
