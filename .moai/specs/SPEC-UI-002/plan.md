# Implementation Plan: SPEC-UI-002 File Explorer Sidebar

## Task Decomposition

### Milestone 1: Zustand fileStore 및 useFileSystem Hook (Priority High - Primary Goal)

파일 트리 상태 관리와 Tauri IPC 파일 작업 래퍼를 먼저 구현하여 UI 컴포넌트의 데이터 기반을 확립한다.

**Task 1.1: fileStore 구현**
- 파일: `src/store/fileStore.ts`
- Zustand store 생성
- 상태 필드:
  - `fileTree: FileNode | null` - 루트 디렉토리 트리
  - `currentFile: string | null` - 현재 열린 파일 경로
  - `expandedDirs: Set<string>` - 확장된 디렉토리 경로 목록
  - `watchedPath: string | null` - 현재 감시 중인 디렉토리 경로
  - `isLoading: boolean` - 파일 트리 로딩 상태
  - `searchQuery: string` - 검색 필터 텍스트
- Action 함수:
  - `setFileTree(tree)` - 파일 트리 설정
  - `setCurrentFile(path)` - 현재 파일 변경
  - `toggleExpanded(path)` - 디렉토리 확장/축소 토글
  - `setExpandedDirs(dirs)` - 확장 상태 일괄 설정
  - `setWatchedPath(path)` - 감시 디렉토리 설정
  - `setSearchQuery(query)` - 검색 쿼리 변경
  - `addNode(parentPath, node)` - 노드 추가
  - `removeNode(path)` - 노드 제거
  - `renameNode(oldPath, newName)` - 노드 이름 변경
  - `updateChildren(parentPath, children)` - 하위 항목 업데이트 (지연 로딩용)

**Task 1.2: FileNode 타입 정의**
- 파일: `src/types/file.ts`
- `FileNode` 인터페이스 정의 (name, path, isDirectory, children, extension)
- `FileChangedEvent` 인터페이스 (kind, path, timestamp)
- Tauri 커맨드 응답 타입 정의

**Task 1.3: useFileSystem Hook 구현**
- 파일: `src/hooks/useFileSystem.ts`
- Tauri IPC 래퍼 함수:
  - `openDirectory()` - `invoke('open_directory_dialog')` 호출, 선택된 경로로 `invoke('read_directory')` 실행
  - `openFile(path)` - `invoke('read_file')` 호출, editorStore 업데이트
  - `createFile(dirPath, name)` - `invoke('create_file')` 호출, fileStore에 노드 추가
  - `createDirectory(dirPath, name)` - 새 폴더 생성
  - `deleteItem(path)` - `invoke('delete_file')` 호출, fileStore에서 노드 제거
  - `renameItem(oldPath, newName)` - `invoke('rename_file')` 호출, fileStore 노드 업데이트
  - `loadChildren(dirPath)` - 특정 디렉토리의 하위 항목 지연 로딩
- 에러 핸들링: 각 작업 실패 시 사용자 알림 처리
- 경로 검증: path traversal 방지

### Milestone 2: 핵심 UI 컴포넌트 구현 (Priority High - Primary Goal)

파일 트리를 렌더링하는 핵심 컴포넌트를 구현한다.

**Task 2.1: FileTreeNode 컴포넌트 구현**
- 파일: `src/components/sidebar/FileTreeNode.tsx`
- Props: `node: FileNode`, `depth: number`, `onSelect`, `onContextMenu`
- 파일/폴더 구분 렌더링:
  - 폴더: 확장/축소 화살표 + 폴더 아이콘(열림/닫힘) + 이름
  - 파일: 확장자별 아이콘 + 이름
- 들여쓰기: `depth * 16px` 패딩
- 클릭 이벤트: 파일은 openFile, 폴더는 toggleExpanded
- 선택 상태: 현재 열린 파일과 동일하면 하이라이트 스타일
- 인라인 이름 편집 모드 (이름 변경 시 input으로 전환)
- 우클릭 시 컨텍스트 메뉴 이벤트 전파

**Task 2.2: FileTree 컴포넌트 구현**
- 파일: `src/components/sidebar/FileTree.tsx`
- Props: `tree: FileNode`, `searchQuery: string`
- 재귀적 렌더링: FileTreeNode를 재귀적으로 호출
- 정렬: 폴더 우선, 이름 알파벳순
- 검색 필터: searchQuery가 있을 때 매칭 노드만 렌더링, 부모 디렉토리 자동 확장
- 빈 디렉토리 처리: "(empty)" 텍스트 표시

**Task 2.3: 컨텍스트 메뉴 구현**
- FileTreeNode 내부 또는 별도 컴포넌트
- 메뉴 항목: "New File", "New Folder", "Rename", "Delete"
- 위치: 우클릭 좌표 기준 렌더링
- 외부 클릭 시 자동 닫힘
- 각 메뉴 항목 클릭 시 해당 useFileSystem 함수 호출

**Task 2.4: FileExplorer 컨테이너 구현**
- 파일: `src/components/sidebar/FileExplorer.tsx`
- 빈 상태: 디렉토리 미선택 시 "Open Folder" 버튼 + 안내 메시지
- "Open Folder" 버튼 클릭 시 useFileSystem.openDirectory() 호출
- 디렉토리 열린 상태: FileSearch + FileTree 렌더링
- 로딩 상태: 스피너 표시
- 에러 상태: 에러 메시지 및 재시도 버튼

### Milestone 3: 검색 필터 및 파일 아이콘 (Priority Medium - Secondary Goal)

검색 기능과 시각적 아이콘 시스템을 구현한다.

**Task 3.1: FileSearch 컴포넌트 구현**
- 파일: `src/components/sidebar/FileSearch.tsx`
- 입력 필드 + 검색 아이콘 + 클리어 버튼
- 입력 시 fileStore.setSearchQuery() 호출
- 디바운스 적용 (150ms) - 빠른 타이핑 시 과도한 필터링 방지
- 검색 결과 없을 시 "No matching files" 메시지

**Task 3.2: 파일 아이콘 시스템 구현**
- 확장자별 SVG 아이콘 매핑 함수
- 지원 확장자: .md, .txt, .json, .yaml/.yml, .ts/.tsx, .js/.jsx, .css/.scss, .html
- 폴더 아이콘: 열림/닫힘 상태별
- 기본 아이콘: 매핑되지 않는 확장자용
- Tailwind 색상 클래스로 아이콘 색상 적용

### Milestone 4: 통합 및 UX 개선 (Priority Medium - Secondary Goal)

전체 기능 통합 및 사용자 경험 개선을 수행한다.

**Task 4.1: 파일명 검증 로직**
- 유효하지 않은 문자 검증 (/, \, :, *, ?, ", <, >, |)
- 빈 파일명 방지
- 중복 파일명 검증 (동일 디렉토리 내)
- 검증 실패 시 인라인 에러 메시지

**Task 4.2: 삭제 확인 대화상자**
- 삭제 전 확인 대화상자 표시
- 폴더 삭제 시 하위 항목 수 표시
- 확인/취소 버튼
- 키보드 접근성 (Enter 확인, Escape 취소)

**Task 4.3: 성능 최적화**
- `React.memo` 적용으로 변경되지 않은 노드 리렌더링 방지
- 대규모 디렉토리(1000+ 파일) virtualized list 고려
- 지연 로딩: 폴더 첫 확장 시에만 하위 항목 로드
- fileStore selector 최적화: 필요한 상태만 구독

---

## Technology Stack

| 기술 | 버전 | 역할 |
|------|------|------|
| React | 18.x | UI 프레임워크 |
| TypeScript | 5.x+ | 타입 안전성 |
| Zustand | 5.x | 상태 관리 |
| @tauri-apps/api | 2.x | IPC 커맨드 호출 |
| Tailwind CSS | 3.x | 유틸리티 CSS 스타일링 |

---

## Risk Analysis

### Risk 1: 대규모 디렉토리 트리 성능

- **확률**: High
- **영향**: High (1000+ 파일 시 렌더링 지연)
- **완화 전략**: 지연 로딩(lazy loading)으로 첫 레벨만 로드, React.memo로 불변 노드 리렌더링 방지, 필요 시 react-window 가상화 도입
- **대안**: 최대 depth 제한 또는 flat list + 인덴트 방식으로 전환

### Risk 2: Tauri IPC 파일 작업 에러 핸들링

- **확률**: Medium
- **영향**: High (파일 손실 가능)
- **완화 전략**: 모든 IPC 호출에 try-catch, 삭제 전 확인 대화상자 필수, 에러 발생 시 사용자 피드백 제공
- **대안**: 파일 작업 실행 전 권한 사전 검증

### Risk 3: 크로스 플랫폼 경로 처리

- **확률**: Medium
- **영향**: Medium (Windows/macOS/Linux 경로 차이)
- **완화 전략**: Tauri 백엔드에서 경로 정규화 처리, 프론트엔드에서는 경로를 불투명 문자열로 취급, 경로 조합 시 Tauri API 사용
- **대안**: `path` 모듈 사용 (Node.js 호환) 또는 Tauri path API 활용

### Risk 4: 컨텍스트 메뉴 위치 계산

- **확률**: Low
- **영향**: Low (메뉴가 화면 밖으로 나감)
- **완화 전략**: 우클릭 좌표 + 뷰포트 경계 검사, 화면 밖으로 나갈 경우 반대 방향으로 렌더링
- **대안**: 고정 위치 드롭다운 방식

### Risk 5: 검색 필터 성능

- **확률**: Medium
- **영향**: Low (대규모 트리에서 필터링 지연)
- **완화 전략**: 디바운스(150ms), 메모이제이션된 필터 결과, 대소문자 무시 검색
- **대안**: Web Worker에서 필터링 수행

---

## File Manifest

| 파일 경로 | 유형 | 설명 |
|-----------|------|------|
| `src/components/sidebar/FileExplorer.tsx` | Component | 사이드바 컨테이너, 빈 상태/로딩 처리 |
| `src/components/sidebar/FileTree.tsx` | Component | 재귀적 파일 트리 렌더링 |
| `src/components/sidebar/FileTreeNode.tsx` | Component | 개별 노드 (아이콘, 클릭, 컨텍스트 메뉴, 인라인 편집) |
| `src/components/sidebar/FileSearch.tsx` | Component | 파일명 검색 필터 |
| `src/store/fileStore.ts` | Store | 파일 트리 상태 관리 |
| `src/hooks/useFileSystem.ts` | Hook | Tauri IPC 파일 작업 래퍼 |
| `src/types/file.ts` | Type | FileNode, FileChangedEvent 인터페이스 |
| `src/lib/fileIcons.ts` | Utility | 확장자별 파일 아이콘 매핑 |

---

## Traceability

- SPEC Reference: SPEC-UI-002
- Product Reference: product.md - Core Feature 3 (File and Directory Explorer), Core Feature 5 (File Operations)
- Structure Reference: structure.md - `src/components/sidebar/`, `src/store/fileStore.ts`, `src/hooks/useFileSystem.ts`, `src/types/file.ts`
