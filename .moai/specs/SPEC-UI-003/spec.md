---
id: SPEC-UI-003
version: 1.0.0
status: implemented
created: 2026-02-25
updated: 2026-02-25
author: jw
priority: medium
domain: UI
title: "Open Folder UI Enhancement - Change Root Folder"
tags:
  - SPEC-UI-003
  - file-explorer
  - folder-navigation
  - persistence
---

# SPEC-UI-003: 루트 폴더 변경 UI 개선

## HISTORY

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0.0 | 2026-02-25 | jw | 초기 SPEC 작성 |

---

## 1. Environment (환경)

### 프로젝트 컨텍스트
- **애플리케이션**: MdEdit (Tauri v2 + React 18 마크다운 에디터)
- **플랫폼**: macOS, Windows, Linux (크로스 플랫폼)
- **기술 스택**: TypeScript (strict mode), React 18, Zustand, Tauri v2
- **대상 컴포넌트**: FileExplorer 사이드바 (`src/components/sidebar/FileExplorer.tsx`)

### 현재 상태
- 사이드바의 빈 상태(폴더 미선택)에서는 "Open Folder" 버튼이 존재하며 정상 동작
- 폴더가 이미 열린 상태에서는 상위/하위 폴더 이동만 가능하며, 완전히 다른 폴더/드라이브를 선택하는 방법이 없음
- `openDirectoryDialog()` Tauri IPC 명령어는 이미 구현 완료 (`src-tauri/src/commands/directory_ops.rs:82`)
- `openFolder()` hook은 이미 구현 완료 (`src/hooks/useFileSystem.ts:62`)
- `uiStore.ts`는 `persist` 미들웨어를 사용하나 `lastWatchedPath`는 미포함

### 제약 조건
- 백엔드(Rust) 변경 불필요 -- 모든 필요한 Tauri 명령어가 이미 존재
- TypeScript strict mode 준수 필수
- 기존 컴포넌트 패턴(SVG 아이콘, Zustand 스토어, IPC 래퍼) 일관성 유지

---

## 2. Assumptions (가정)

| ID | 가정 | 신뢰도 | 근거 | 위반 시 영향 |
|----|------|--------|------|-------------|
| A1 | `openDirectoryDialog()` IPC 호출은 모든 OS에서 동일하게 동작한다 | High | `tauri-plugin-dialog` v2 플러그인이 이미 설치 및 등록됨 (`Cargo.toml:26`, `lib.rs:16`) | 특정 OS에서 폴더 선택 다이얼로그 미동작 |
| A2 | `uiStore.ts`의 `persist` 미들웨어에 필드 추가 시 자동으로 localStorage에 저장된다 | High | 기존 `sidebarWidth`, `theme` 등이 동일 패턴으로 동작 중 | `lastWatchedPath` 영속성 실패 |
| A3 | 폴더 변경 시 기존 파일 감시자(watcher)가 정상적으로 정리된다 | High | `openFolderPath()`가 이미 `startWatch()` 호출 시 기존 watcher를 교체하는 로직 포함 | 리소스 누수 또는 이벤트 충돌 |
| A4 | `window.confirm()`으로 미저장 경고가 충분하다 | Medium | `openFile()`에서 동일 패턴 사용 중 (`useFileSystem.ts:98-108`) | UX가 네이티브 다이얼로그와 불일치 |

---

## 3. Requirements (요구사항)

### Module 1: 폴더 변경 버튼 (Change Folder Button)

**REQ-UI-003-01** (Event-Driven)
> **WHEN** 폴더가 이미 열려 있고 사용자가 FileExplorer 헤더의 "Change Folder" 버튼을 클릭하면,
> **THEN** 시스템은 OS 네이티브 폴더 선택 다이얼로그를 표시해야 한다 (기존 `openDirectoryDialog()` IPC 호출 사용).

**REQ-UI-003-02** (Event-Driven)
> **WHEN** 사용자가 폴더 선택 다이얼로그에서 새 폴더를 선택하면,
> **THEN** 시스템은 파일 트리를 새 폴더의 내용으로 업데이트하고, 검색 쿼리를 초기화하고, 이전 파일시스템 감시자를 중지하고, 새 폴더에 대한 감시를 시작해야 한다.

**REQ-UI-003-03** (Event-Driven)
> **WHEN** 사용자가 폴더 선택 다이얼로그를 취소하면,
> **THEN** 시스템은 현재 폴더를 변경하지 않고 유지해야 한다.

### Module 2: 빈 상태 호환성 (Empty State Consistency)

**REQ-UI-003-04** (State-Driven)
> **IF** FileExplorer 사이드바에 열린 폴더가 없으면 (`watchedPath === null`),
> **THEN** 시스템은 기존 "Open Folder" 버튼을 그대로 표시해야 한다 (하위 호환성, 변경 불필요).

### Module 3: 마지막 폴더 영속성 (Last Folder Persistence)

**REQ-UI-003-05** (Event-Driven)
> **WHEN** 사용자가 성공적으로 폴더를 열거나 변경하면,
> **THEN** 시스템은 해당 폴더 경로를 localStorage에 저장해야 한다 (`uiStore`의 `lastWatchedPath` 필드, `persist` 미들웨어 활용).

**REQ-UI-003-06** (Event-Driven)
> **WHEN** 애플리케이션이 시작되면,
> **THEN** 시스템은 `lastWatchedPath`가 저장되어 있을 경우 해당 폴더를 자동으로 다시 열어야 한다.

**REQ-UI-003-07** (Unwanted)
> 시스템은 존재하지 않는 `lastWatchedPath` 경로로 폴더를 열려고 시도하지 않아야 한다 (경로 유효성 검증 후 실패 시 무시).

### Module 4: 검색 초기화 (Search Reset)

**REQ-UI-003-08** (Event-Driven)
> **WHEN** 루트 폴더가 변경되면 ("Change Folder" 버튼 또는 초기 "Open Folder"를 통해),
> **THEN** 시스템은 FileExplorer 사이드바의 검색 쿼리(`searchQuery`)를 초기화해야 한다.

### Module 5: 미저장 변경 경고 (Unsaved Changes Warning) -- Optional

**REQ-UI-003-09** (Event-Driven, Optional)
> **WHEN** 사용자가 "Change Folder" 버튼을 클릭하고 에디터에 미저장 변경이 있으면 (`dirty === true`),
> **THEN** 시스템은 폴더 변경을 진행하기 전에 확인 다이얼로그를 표시해야 한다.

**REQ-UI-003-10** (Event-Driven, Optional)
> **WHEN** 사용자가 미저장 경고 다이얼로그에서 취소를 선택하면,
> **THEN** 시스템은 폴더 변경을 중단하고 현재 상태를 유지해야 한다.

---

## 4. Specifications (사양)

### 4.1 UI 변경 사양

#### Change Folder 버튼 위치
- FileExplorer 헤더 영역 (`src/components/sidebar/FileExplorer.tsx`, line 124-163)
- Refresh 버튼 왼쪽에 배치
- 폴더가 열려 있을 때만 렌더링 (`watchedPath !== null`)

#### 아이콘 디자인
- FolderOpen 스타일 SVG (24x24 viewBox, stroke 기반)
- 기존 프로젝트 아이콘 패턴과 일관성 유지
- `title` 속성으로 툴팁 제공: "Change Folder"

#### 레이아웃 변경
```
변경 전:
[GoUp?] [FolderIcon] [폴더명 (flex-1)] [Refresh]

변경 후:
[GoUp?] [FolderIcon] [폴더명 (flex-1)] [ChangeFolder] [Refresh]
```

### 4.2 상태 관리 사양

#### uiStore 변경 (`src/store/uiStore.ts`)
- 새 필드: `lastWatchedPath: string | null` (초기값: `null`)
- 새 액션: `setLastWatchedPath: (path: string | null) => void`
- `persist` 미들웨어에 의해 자동으로 localStorage 키 `'mdedit-ui-store'`에 저장

#### 폴더 변경 시 상태 업데이트 순서
1. `dirty` 체크 (optional) -> 경고 표시
2. `openDirectoryDialog()` 호출 -> OS 다이얼로그 표시
3. 경로 반환 시: `openFolderPath(newPath)` 호출
4. `setLastWatchedPath(newPath)` 호출
5. `setSearchQuery('')` 호출

### 4.3 초기화 사양

#### 앱 시작 시 자동 복원 (`src/App.tsx` 또는 `AppLayout`)
1. `useUIStore.getState().lastWatchedPath` 확인
2. 경로가 존재하면 해당 경로의 유효성을 검증 (디렉토리 존재 여부)
3. 유효한 경우 `openFolderPath(lastWatchedPath)` 호출
4. 유효하지 않은 경우 `setLastWatchedPath(null)`로 초기화

### 4.4 영향 범위

| 파일 | 변경 유형 | 위험도 |
|------|---------|--------|
| `src/components/sidebar/FileExplorer.tsx` | UI 버튼 추가 + 검색 초기화 | Low |
| `src/store/uiStore.ts` | 상태 필드 추가 | Low |
| `src/hooks/useFileSystem.ts` | persist 저장 + 미저장 경고 | Low |
| `src/App.tsx` | 초기화 로직 추가 | Medium |

**백엔드 변경**: 없음 (모든 Tauri 명령어 이미 구현됨)

---

## 5. Traceability (추적성)

| 요구사항 ID | 모듈 | 구현 파일 | 테스트 시나리오 |
|------------|------|----------|---------------|
| REQ-UI-003-01 | Module 1 | `FileExplorer.tsx` | ACC-01 |
| REQ-UI-003-02 | Module 1 | `FileExplorer.tsx`, `useFileSystem.ts` | ACC-01 |
| REQ-UI-003-03 | Module 1 | `FileExplorer.tsx` | ACC-02 |
| REQ-UI-003-04 | Module 2 | `FileExplorer.tsx` | ACC-03 |
| REQ-UI-003-05 | Module 3 | `useFileSystem.ts`, `uiStore.ts` | ACC-04 |
| REQ-UI-003-06 | Module 3 | `App.tsx` | ACC-04 |
| REQ-UI-003-07 | Module 3 | `App.tsx` | ACC-05 |
| REQ-UI-003-08 | Module 4 | `FileExplorer.tsx` | ACC-01 |
| REQ-UI-003-09 | Module 5 | `useFileSystem.ts` | ACC-06 |
| REQ-UI-003-10 | Module 5 | `useFileSystem.ts` | ACC-06 |
