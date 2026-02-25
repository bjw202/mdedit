---
id: SPEC-UI-003
type: plan
version: 1.0.0
tags:
  - SPEC-UI-003
---

# SPEC-UI-003 구현 계획: 루트 폴더 변경 UI 개선

## 1. 작업 분해 (Task Decomposition)

### Primary Goal: 폴더 변경 핵심 기능

**Task 1: uiStore에 `lastWatchedPath` 상태 추가**
- 파일: `src/store/uiStore.ts`
- 작업:
  - `lastWatchedPath: string | null` 필드 추가 (초기값: `null`)
  - `setLastWatchedPath: (path: string | null) => void` 액션 추가
- 레퍼런스: 기존 `sidebarWidth`, `theme` 필드 패턴 (`uiStore.ts:34-59`)
- 의존성: 없음

**Task 2: FileExplorer 헤더에 "Change Folder" 버튼 추가**
- 파일: `src/components/sidebar/FileExplorer.tsx`
- 작업:
  - Refresh 버튼 왼쪽에 FolderOpen 스타일 SVG 아이콘 버튼 추가
  - `watchedPath !== null` 조건부 렌더링
  - 클릭 핸들러: 기존 `handleOpenFolder()` 재사용
  - 폴더 변경 후 `setSearchQuery('')` 호출 추가
- 레퍼런스: 기존 헤더 레이아웃 (`FileExplorer.tsx:124-163`)
- 의존성: 없음 (기존 `handleOpenFolder` 재사용)

**Task 3: `openFolder()`에서 `lastWatchedPath` 저장**
- 파일: `src/hooks/useFileSystem.ts`
- 작업:
  - `openFolder()` 성공 시 `useUIStore.getState().setLastWatchedPath(selectedPath)` 호출
  - `openFolderPath()` 성공 시 동일하게 `setLastWatchedPath(path)` 호출
- 레퍼런스: `openFolder()` 구현 (`useFileSystem.ts:62`)
- 의존성: Task 1 (uiStore 필드 존재 필요)

### Secondary Goal: 영속성 및 자동 복원

**Task 4: 앱 시작 시 마지막 폴더 자동 복원**
- 파일: `src/App.tsx` (또는 AppLayout)
- 작업:
  - `useEffect` 훅에서 `lastWatchedPath` 확인
  - 경로가 존재하면 유효성 검증 후 `openFolderPath()` 호출
  - 유효하지 않은 경로일 경우 `setLastWatchedPath(null)` 초기화
- 레퍼런스: `readDirectory()` IPC 호출 패턴 (`ipc.ts`)
- 의존성: Task 1, Task 3

### Optional Goal: UX 개선

**Task 5: 미저장 변경 경고 추가**
- 파일: `src/hooks/useFileSystem.ts`
- 작업:
  - `openFolder()` 시작 전 `useEditorStore.getState().dirty` 체크
  - `dirty === true`일 경우 `window.confirm()` 호출
  - 취소 시 조기 반환
- 레퍼런스: `openFile()` 미저장 경고 패턴 (`useFileSystem.ts:98-108`)
- 의존성: 없음

---

## 2. 구현 순서

```
Task 1 (uiStore) ──┐
                    ├── Task 3 (useFileSystem persist) ── Task 4 (App 초기화)
Task 2 (버튼 UI) ──┘
Task 5 (미저장 경고) -- 독립적, 병렬 가능
```

권장 순서:
1. Task 1 -> Task 2 -> Task 3 -> Task 4 -> Task 5
2. Task 1과 Task 2는 병렬 실행 가능
3. Task 5는 어느 시점에든 독립적으로 실행 가능

---

## 3. 기술 제약 사항

### TypeScript Strict Mode
- 모든 새 코드는 `strict: true` 환경에서 에러 없이 컴파일되어야 함
- `any` 타입 사용 금지
- 모든 함수 파라미터와 반환 타입 명시

### 기존 패턴 준수
- Zustand 스토어: `create<StateType>()(persist(...))` 패턴 따르기
- SVG 아이콘: 인라인 SVG, 24x24 viewBox, `stroke="currentColor"` 스타일
- IPC 호출: `src/lib/tauri/ipc.ts` 래퍼 함수 사용
- 이벤트 핸들러: `handle` 접두사 (`handleOpenFolder`, `handleGoUp` 등)

### 하위 호환성
- 빈 상태 "Open Folder" 기능 변경 금지
- 기존 상위/하위 폴더 이동 기능 변경 금지
- `mdedit-ui-store` localStorage 키 유지 (기존 사용자 설정 보존)

---

## 4. 리스크 분석

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| localStorage `lastWatchedPath`에 저장된 경로가 앱 재시작 후 삭제됨 | Low | Medium | 경로 유효성 검증 후 `null`로 초기화, 에러 무시 |
| 폴더 변경 시 이전 watcher가 정리되지 않아 리소스 누수 | Low | High | `openFolderPath()` 내부에서 이미 `startWatch()`가 기존 watcher를 교체하므로 기존 로직 신뢰 |
| `searchQuery` 초기화 타이밍이 폴더 로딩과 불일치 | Low | Low | `handleOpenFolder` 호출 직후 동기적으로 `setSearchQuery('')` 실행 |
| 앱 시작 시 `lastWatchedPath` 자동 복원이 느린 폴더에서 UI 블로킹 | Medium | Medium | `isLoading` 상태 활용하여 로딩 인디케이터 표시, 비동기 처리 |

---

## 5. 레퍼런스 구현 (Reference Implementations)

| 패턴 | 파일:라인 | 설명 |
|------|----------|------|
| 빈 상태 "Open Folder" | `FileExplorer.tsx:82-109` | 기존 폴더 열기 UI 및 핸들러 |
| 헤더 레이아웃 | `FileExplorer.tsx:124-163` | GoUp + FolderIcon + 폴더명 + Refresh 구조 |
| `openFolder()` hook | `useFileSystem.ts:62` | 다이얼로그 호출 -> 트리 로드 -> watcher 시작 |
| `openFolderPath()` hook | `useFileSystem.ts` | 특정 경로로 폴더 열기 (GoUp, 하위 폴더 등) |
| persist 미들웨어 | `uiStore.ts:34-59` | Zustand persist 패턴 (localStorage) |
| 미저장 경고 | `useFileSystem.ts:98-108` | `dirty` 체크 + `window.confirm()` 패턴 |
| OS 폴더 다이얼로그 | `directory_ops.rs:82-86` | `open_directory_dialog` Tauri 명령어 |

---

## 6. 품질 기준

- 모든 새 코드에 대한 단위 테스트 작성 (TDD: RED-GREEN-REFACTOR)
- TypeScript 컴파일 에러 0건
- Lint 에러 0건
- 기존 테스트 전체 통과
- 기존 기능(빈 상태 "Open Folder", GoUp, 하위 폴더 이동) 회귀 없음 확인
