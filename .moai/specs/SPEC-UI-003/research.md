# Research: SPEC-UI-003 — Change Root Folder UI

## 1. File Explorer Architecture

### 핵심 컴포넌트
- **FileExplorer**: `src/components/sidebar/FileExplorer.tsx` (lines 55-190)
  - 헤더: Go Up 버튼(조건부) + 폴더 아이콘 + 폴더명(truncate) + Refresh 버튼
  - 빈 상태: `!watchedPath` → "Open Folder" 버튼 (line 82-109)
  - 검색: `searchQuery` 로컬 상태 (line 58)

### 현재 헤더 레이아웃 (line 124-163)
```tsx
<div className="flex items-center gap-1 px-2 py-1.5 border-b ...">
  {canGoUp && <GoUpButton />}       // 조건부
  <FolderIcon />                    // 노란 폴더 아이콘
  <span truncate flex-1>폴더명</span>  // flex-1로 남은 공간 차지
  <RefreshButton />                 // 항상 표시
</div>
```

## 2. 현재 내비게이션 플로우

### 폴더 열기 (빈 상태)
```
handleOpenFolder() → openFolder() [IPC: openDirectoryDialog]
  → selectedPath 반환
  → setWatchedPath(selectedPath)
  → readDirectory(selectedPath) → setFileTree(tree)
  → startWatch(selectedPath)
```

### 상위 폴더 이동 (Go Up)
```
handleGoUp() → openFolderPath(parentPath)
  → readDirectory(parentPath) → setWatchedPath + setFileTree
  → startWatch(parentPath)
```

### 하위 폴더 이동 (클릭)
```
FileTreeNode.handleClick() → openFolderPath(node.path)
  → 동일한 openFolderPath 플로우
```

## 3. 상태 관리

### fileStore.ts (`src/store/fileStore.ts`)
| 상태 | 타입 | 설명 |
|------|------|------|
| `watchedPath` | `string \| null` | 현재 열린 루트 폴더 경로 |
| `fileTree` | `FileNode[]` | 재귀 파일 트리 |
| `isLoading` | `boolean` | 디렉토리 로딩 중 여부 |
| `currentFile` | `string \| null` | 현재 선택된 파일 |

**중요**: `watchedPath`는 localStorage에 **영속되지 않음** (앱 재시작 시 초기화)

### uiStore.ts (`src/store/uiStore.ts`)
- `persist` 미들웨어 사용 (localStorage key: `'mdedit-ui-store'`)
- 현재 저장 항목: sidebarWidth, previewWidth, theme, fontSize, sidebarCollapsed, scrollSyncEnabled
- `lastWatchedPath` **미포함** → 추가 필요

## 4. Tauri IPC 패턴

### 프론트엔드 → 백엔드
- `src/lib/tauri/ipc.ts` (lines 1-88): `invoke()` 래퍼 함수들

### 관련 명령어 (이미 구현됨)
| 함수 | 백엔드 커맨드 | 파일 |
|------|------------|------|
| `openDirectoryDialog()` | `open_directory_dialog` | `directory_ops.rs:82` |
| `readDirectory(path)` | `read_directory` | `directory_ops.rs:15` |
| `startWatch(path)` | `start_watch` | `watcher.rs:65` |

### open_directory_dialog 구현 (directory_ops.rs:82-86)
```rust
#[tauri::command]
pub async fn open_directory_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();
    Ok(folder.map(|p| p.to_string()))
}
```
반환: `null` (취소) 또는 절대 경로 문자열

## 5. 설치된 Tauri 플러그인

- `tauri-plugin-dialog = "2"` (Cargo.toml:26) → **이미 설치됨**
- `tauri_plugin_dialog::init()` (lib.rs:16) → **이미 등록됨**
- 추가 백엔드 변경 불필요

## 6. 레퍼런스 구현 발견

### 미저장 경고 패턴 (useFileSystem.ts:98-108)
```typescript
const openFile = async (path: string): Promise<void> => {
  const { dirty } = useEditorStore.getState();
  if (dirty) {
    const confirmed = window.confirm('You have unsaved changes...');
    if (!confirmed) return;
  }
  // ... 파일 열기
};
```
→ `openFolder()`에도 동일 패턴 적용 가능

### uiStore persist 패턴 (uiStore.ts:34-59)
```typescript
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      fontSize: 14,
      setSaveStatus: (status) => set({ saveStatus: status }),
      // lastWatchedPath 추가 방식 동일
    }),
    { name: 'mdedit-ui-store' }
  )
);
```
→ `lastWatchedPath: string | null` 추가 시 자동으로 localStorage에 저장됨

## 7. 구현 권장사항

### A. 최소 구현 (Must)
1. **FileExplorer.tsx 헤더에 "Change Folder" 버튼 추가** (Refresh 버튼 옆)
   - 기존 `handleOpenFolder()` 재사용
   - 폴더 변경 후 `setSearchQuery('')` 초기화

2. **아이콘**: FolderOpen style SVG (24x24 viewBox, stroke 기반)

### B. 마지막 폴더 기억 (Should)
3. **uiStore.ts에 `lastWatchedPath` 추가**
   - persist 자동 적용
   - `openFolder()` / `openFolderPath()` 완료 시 업데이트

4. **App.tsx 또는 AppLayout.tsx 마운트 시 자동 복원**
   - `lastWatchedPath` 있으면 `openFolderPath()` 호출

### C. UX 개선 (Could)
5. **미저장 경고**: `openFolder()` 시작 전 dirty 체크 추가

### D. 백엔드 변경 없음
- `open_directory_dialog` 이미 구현됨
- 추가 Rust 코드 불필요

## 8. 영향 범위 요약

| 파일 | 변경 유형 | 위험도 |
|------|---------|------|
| `src/components/sidebar/FileExplorer.tsx` | UI 버튼 추가 + 검색 초기화 | 낮음 |
| `src/store/uiStore.ts` | 상태 추가 | 낮음 |
| `src/hooks/useFileSystem.ts` | persist 저장 + 경고 추가 | 낮음 |
| `src/App.tsx` | 초기화 로직 | 중간 |

---
생성일: 2026-02-25
작성자: MoAI Research Agent (UltraThink + Explore)
