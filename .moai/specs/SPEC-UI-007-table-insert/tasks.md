# Task Decomposition

SPEC: SPEC-UI-007

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | TableIcon 추가 (Lucide table 글리프 인라인) | REQ-UI-007-012 | - | src/components/icons/icons.tsx, src/components/icons/index.ts | completed |
| T-002 | insertTable(view, rows, cols) 헬퍼 + 단위 테스트 | REQ-UI-007-006, 007, 009, 014 | - | src/components/editor/extensions/keyboard-shortcuts.ts, src/test/insertTable.test.ts | completed |
| T-003 | GridPicker 팝오버 컴포넌트 + 테스트 | REQ-UI-007-001, 003, 004, 005, 008 | T-001 | src/components/editor/EditorToolbar.tsx (또는 분리 파일), src/test/TableGridPicker.test.tsx | completed |
| T-004 | 툴바 통합 (onInsertTable prop, Quote–Image 사이 배치) | REQ-UI-007-004, 011 | T-003 | src/components/editor/EditorToolbar.tsx, src/test/EditorToolbar.test.tsx | completed |
| T-005 | AppLayout 배선 (handleInsertTable + null 가드 + view.focus) | REQ-UI-007-007, 010, 011 | T-002, T-004 | src/components/layout/AppLayout.tsx | completed |
| T-006 | CSS (.md-table-picker* 클래스, --md-* 토큰 전용) | REQ-UI-007-002 | - | src/styles/mdedit-components.css | completed |
| T-007 | 품질 게이트 (tsc --noEmit + vitest 전체 + 커버리지 80%+) | AC-UI-007-010 외 | T-001~T-006 | - | completed |
