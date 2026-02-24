# Acceptance Criteria: SPEC-UI-002 File Explorer Sidebar

## Test Scenarios

### Scenario 1: 빈 상태 - 디렉토리 미선택

- **Given**: 애플리케이션이 시작되고 어떤 디렉토리도 열려 있지 않은 상태
- **When**: FileExplorer 컴포넌트가 렌더링될 때
- **Then**: "Open Folder" 버튼이 표시되어야 한다
- **And**: "폴더를 열어 시작하세요" 안내 메시지가 표시되어야 한다
- **And**: 파일 트리는 표시되지 않아야 한다

### Scenario 2: 디렉토리 열기

- **Given**: 디렉토리가 열려 있지 않은 빈 상태
- **When**: 사용자가 "Open Folder" 버튼을 클릭하고 네이티브 대화상자에서 디렉토리를 선택할 때
- **Then**: 선택된 디렉토리의 최상위 파일/폴더가 FileTree에 표시되어야 한다
- **And**: 폴더가 파일보다 먼저 정렬되어야 한다
- **And**: 각 항목이 알파벳순으로 정렬되어야 한다
- **And**: fileStore의 fileTree가 업데이트되어야 한다

### Scenario 3: 폴더 확장/축소

- **Given**: 파일 트리가 로드되고 하위 항목이 있는 폴더가 표시된 상태
- **When**: 사용자가 폴더 노드를 클릭할 때
- **Then**: 폴더가 확장되어 하위 항목이 표시되어야 한다
- **And**: 폴더 아이콘이 열린 폴더 아이콘으로 변경되어야 한다
- **And**: fileStore의 expandedDirs에 해당 경로가 추가되어야 한다

### Scenario 4: 폴더 축소

- **Given**: 폴더가 확장된 상태
- **When**: 사용자가 확장된 폴더 노드를 다시 클릭할 때
- **Then**: 폴더가 축소되어 하위 항목이 숨겨져야 한다
- **And**: 폴더 아이콘이 닫힌 폴더 아이콘으로 변경되어야 한다
- **And**: fileStore의 expandedDirs에서 해당 경로가 제거되어야 한다

### Scenario 5: 파일 클릭으로 열기

- **Given**: 파일 트리에 `README.md` 파일이 표시된 상태
- **When**: 사용자가 `README.md` 노드를 클릭할 때
- **Then**: Tauri IPC를 통해 파일 내용이 읽혀야 한다
- **And**: editorStore의 currentFile이 해당 파일 경로로 업데이트되어야 한다
- **And**: 에디터에 파일 내용이 표시되어야 한다
- **And**: FileTreeNode가 선택(active) 상태로 하이라이트되어야 한다

### Scenario 6: 컨텍스트 메뉴 표시

- **Given**: 파일 트리에 파일/폴더가 표시된 상태
- **When**: 사용자가 파일 노드를 우클릭할 때
- **Then**: 컨텍스트 메뉴가 마우스 위치에 표시되어야 한다
- **And**: 메뉴에 "New File", "New Folder", "Rename", "Delete" 항목이 포함되어야 한다

### Scenario 7: 새 파일 생성

- **Given**: 컨텍스트 메뉴가 폴더 노드에서 열린 상태
- **When**: 사용자가 "New File"을 선택하고 "notes.md"를 입력한 후 Enter를 누를 때
- **Then**: 해당 폴더에 "notes.md" 파일이 Tauri IPC를 통해 생성되어야 한다
- **And**: 파일 트리에 새 파일이 추가되어야 한다
- **And**: 새 파일이 올바른 Markdown 아이콘과 함께 표시되어야 한다

### Scenario 8: 새 폴더 생성

- **Given**: 컨텍스트 메뉴가 열린 상태
- **When**: 사용자가 "New Folder"를 선택하고 "drafts"를 입력한 후 Enter를 누를 때
- **Then**: 해당 위치에 "drafts" 폴더가 생성되어야 한다
- **And**: 파일 트리에 새 폴더가 추가되어야 한다
- **And**: 새 폴더가 폴더 아이콘과 함께 표시되어야 한다

### Scenario 9: 파일 이름 변경

- **Given**: 파일 트리에 "old-name.md" 파일이 표시된 상태
- **When**: 사용자가 해당 노드를 우클릭하고 "Rename"을 선택한 후 "new-name.md"를 입력하고 Enter를 누를 때
- **Then**: 파일이 "new-name.md"로 이름이 변경되어야 한다
- **And**: fileStore의 파일 트리가 새 이름으로 업데이트되어야 한다
- **And**: 현재 열린 파일이었다면 editorStore의 currentFile도 업데이트되어야 한다

### Scenario 10: 파일 삭제

- **Given**: 파일 트리에 "temp.md" 파일이 표시된 상태
- **When**: 사용자가 해당 노드를 우클릭하고 "Delete"를 선택할 때
- **Then**: 확인 대화상자가 표시되어야 한다 ("temp.md를 삭제하시겠습니까?")
- **When**: 사용자가 확인을 누를 때
- **Then**: 파일이 Tauri IPC를 통해 삭제되어야 한다
- **And**: fileStore에서 해당 노드가 제거되어야 한다

### Scenario 11: 삭제 취소

- **Given**: 삭제 확인 대화상자가 표시된 상태
- **When**: 사용자가 취소를 누를 때
- **Then**: 파일이 삭제되지 않아야 한다
- **And**: 대화상자가 닫혀야 한다

### Scenario 12: 검색 필터

- **Given**: 파일 트리에 여러 파일이 표시된 상태 (README.md, guide.md, config.json, notes.txt)
- **When**: 사용자가 검색 필드에 ".md"를 입력할 때
- **Then**: ".md" 확장자를 가진 파일(README.md, guide.md)만 표시되어야 한다
- **And**: 해당 파일이 포함된 부모 디렉토리가 자동 확장되어야 한다
- **And**: 매칭되지 않는 파일(config.json, notes.txt)은 숨겨져야 한다

### Scenario 13: 검색 필터 클리어

- **Given**: 검색 필터에 ".md"가 입력되어 필터링된 상태
- **When**: 사용자가 검색 필드를 비우거나 클리어 버튼을 클릭할 때
- **Then**: 모든 파일/폴더가 다시 표시되어야 한다
- **And**: 이전 확장 상태가 유지되어야 한다

### Scenario 14: 지연 로딩

- **Given**: 파일 트리가 로드되고 하위 항목이 로드되지 않은 폴더가 있는 상태
- **When**: 사용자가 해당 폴더를 처음 확장할 때
- **Then**: 로딩 스피너가 해당 폴더 하위에 잠시 표시되어야 한다
- **And**: Tauri IPC를 통해 하위 항목이 로드되어야 한다
- **And**: 로드 완료 후 하위 항목이 표시되어야 한다

### Scenario 15: 파일 확장자별 아이콘 표시

- **Given**: 다양한 확장자의 파일이 포함된 디렉토리가 열린 상태
- **When**: 파일 트리가 렌더링될 때
- **Then**: `README.md`에는 Markdown 아이콘이 표시되어야 한다
- **And**: `config.json`에는 JSON 아이콘이 표시되어야 한다
- **And**: `styles.css`에는 CSS 아이콘이 표시되어야 한다
- **And**: 폴더에는 폴더 아이콘(열림/닫힘 상태별)이 표시되어야 한다
- **And**: 알 수 없는 확장자에는 기본 파일 아이콘이 표시되어야 한다

### Scenario 16: 현재 열린 파일 하이라이트

- **Given**: 에디터에서 "README.md"가 열려 있는 상태
- **When**: FileTree가 렌더링될 때
- **Then**: "README.md" 노드가 다른 노드와 구분되는 active/selected 스타일로 하이라이트되어야 한다

---

## Edge Cases

### Edge Case 1: 유효하지 않은 파일명

- **Condition**: 사용자가 파일 생성 시 유효하지 않은 문자(/, \, :, *, ?, ", <, >, |)를 포함한 이름을 입력했을 때
- **Expected**: 인라인 에러 메시지로 "유효하지 않은 파일명입니다"를 표시하고, 파일 생성을 차단해야 한다

### Edge Case 2: 빈 파일명 입력

- **Condition**: 사용자가 이름 변경 또는 새 파일 생성 시 빈 문자열을 입력하고 Enter를 누를 때
- **Expected**: 작업을 취소하고 이전 상태로 복원해야 한다

### Edge Case 3: 중복 파일명

- **Condition**: 동일 디렉토리에 이미 "readme.md"가 존재하는데 "readme.md"로 새 파일 생성을 시도할 때
- **Expected**: 에러 메시지 "동일한 이름의 파일이 이미 존재합니다"를 표시하고, 생성을 차단해야 한다

### Edge Case 4: 빈 디렉토리 확장

- **Condition**: 하위 항목이 없는 빈 폴더를 확장할 때
- **Expected**: "(empty)" 또는 "빈 폴더" 텍스트를 표시해야 한다

### Edge Case 5: 대규모 디렉토리 (1000+ 파일)

- **Condition**: 1000개 이상의 파일이 포함된 디렉토리를 열 때
- **Expected**: 200ms 이내에 최상위 항목이 렌더링되어야 하며, 하위 폴더는 지연 로딩으로 처리되어야 한다

### Edge Case 6: 파일 시스템 에러

- **Condition**: 파일 삭제 시 권한 부족으로 Tauri IPC가 에러를 반환할 때
- **Expected**: 사용자에게 에러 메시지를 표시하고, 파일 트리 상태를 변경하지 않아야 한다

### Edge Case 7: 네이티브 대화상자 취소

- **Condition**: 사용자가 "Open Folder" 클릭 후 네이티브 대화상자에서 취소를 누를 때
- **Expected**: 아무 동작 없이 현재 상태를 유지해야 한다

### Edge Case 8: 검색 결과 없음

- **Condition**: 검색 필터에 매칭되는 파일이 없을 때
- **Expected**: "No matching files" 또는 "일치하는 파일이 없습니다" 메시지를 표시해야 한다

### Edge Case 9: 현재 열린 파일 삭제

- **Condition**: 에디터에서 열려 있는 파일을 File Explorer에서 삭제할 때
- **Expected**: 에디터를 빈 상태로 전환하고, editorStore의 currentFile을 null로 설정해야 한다

### Edge Case 10: 컨텍스트 메뉴 화면 경계

- **Condition**: 화면 하단/오른쪽 가장자리에서 우클릭할 때
- **Expected**: 컨텍스트 메뉴가 뷰포트 안에 표시되도록 위치를 자동 조정해야 한다

### Edge Case 11: 이름 변경 중 Escape

- **Condition**: 인라인 이름 편집 모드에서 Escape 키를 누를 때
- **Expected**: 이름 변경을 취소하고 원래 이름으로 복원해야 한다

---

## Performance Criteria

| 측정 항목 | 목표 | 측정 방법 |
|-----------|------|-----------|
| 디렉토리 최초 로드 (1000 파일) | < 200ms | Tauri IPC 호출 ~ FileTree 렌더링 완료 |
| 폴더 확장 (지연 로딩) | < 100ms | 클릭 ~ 하위 항목 렌더링 완료 |
| 검색 필터 응답 | < 50ms | 입력 ~ 필터 결과 표시 (디바운스 제외) |
| 파일 클릭 ~ 에디터 로드 | < 100ms | 클릭 ~ editorStore 업데이트 (IPC 포함) |
| 컨텍스트 메뉴 표시 | < 16ms | 우클릭 ~ 메뉴 렌더링 |
| 파일 생성/삭제/이름 변경 | < 200ms | 확인 ~ fileStore 업데이트 |

---

## Quality Gates

### TRUST 5 검증

- **Tested**: FileExplorer, FileTree, FileTreeNode, FileSearch 컴포넌트 단위 테스트, fileStore 상태 전이 테스트, useFileSystem Hook 테스트 (IPC mock)
- **Readable**: 컴포넌트별 단일 책임, TypeScript strict mode, 명확한 Props 인터페이스
- **Unified**: Tailwind CSS 일관된 스타일링, Zustand 패턴 일관성, 파일 아이콘 시스템 통일
- **Secured**: path traversal 방지, 파일명 검증, 삭제 확인 대화상자 필수, Tauri 샌드박스 준수
- **Trackable**: SPEC-UI-002 태그로 커밋 추적, 요구사항별 테스트 매핑

### Definition of Done

- [ ] FileExplorer, FileTree, FileTreeNode, FileSearch 컴포넌트 구현 완료
- [ ] fileStore (Zustand) 구현 및 상태 전이 테스트 통과
- [ ] useFileSystem Hook 구현 및 Tauri IPC 통합 테스트 통과
- [ ] 컨텍스트 메뉴 (새 파일, 새 폴더, 이름 변경, 삭제) 기능 구현
- [ ] 검색 필터 기능 구현 및 디바운스 적용
- [ ] 파일 확장자별 아이콘 표시 구현
- [ ] 폴더 지연 로딩(lazy loading) 구현
- [ ] 파일명 검증 로직 (유효하지 않은 문자, 빈 이름, 중복) 구현
- [ ] 삭제 확인 대화상자 구현
- [ ] 정렬 (폴더 우선, 알파벳순) 구현
- [ ] 1000+ 파일 디렉토리 성능 < 200ms 확인
- [ ] TypeScript 타입 에러 0건
- [ ] ESLint 경고 0건
- [ ] 85% 이상 테스트 커버리지 달성

---

## Traceability

- SPEC Reference: SPEC-UI-002
- Requirements Coverage: REQ-UI002-U01 ~ U05, E01 ~ E12, S01 ~ S05, N01 ~ N05, O01 ~ O03
