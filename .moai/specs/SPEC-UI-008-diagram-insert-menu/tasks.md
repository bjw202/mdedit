# Task Decomposition

SPEC: SPEC-UI-008

개발 방법론: TDD (RED-GREEN-REFACTOR, 브라운필드 Pre-RED 특성화 포함). 검증 범위: 컴포넌트/단위 테스트(vitest + @testing-library + jsdom EditorView) + `PreviewRenderer.test.tsx`. 신규 Playwright E2E 없음(기존 스위트 무변경 통과, acceptance.md Quality Gate 기준).

| Task ID | Description | TDD Phase | Requirement | Acceptance | Dependencies | Planned Files | Status |
|---------|-------------|-----------|-------------|------------|--------------|---------------|--------|
| T-001 | 브라운필드 특성화 — 기존 `⚠ Diagram syntax error` 폴백·`onFormat` 콜백·접근성 스위트·`markdownKeyBindings` 스냅샷을 회귀 기준선으로 고정 | Pre-RED | REQ-018, REQ-020, REQ-022 | (기준선) | - | src/test/PreviewRenderer.test.tsx, src/test/EditorToolbar.test.tsx | pending |
| T-002 | 프리셋 스니펫 상수 테이블 + `insertDiagram(view, preset)` 헬퍼(블록 패딩·첫 편집 토큰/빈 펜스 커서) + 단위 테스트 | RED→GREEN→REFACTOR | REQ-008, REQ-009, REQ-010, REQ-015 | AC-003, AC-005, AC-008 | - | src/components/editor/extensions/keyboard-shortcuts.ts, src/test/insertDiagram.test.ts | pending |
| T-003 | 프리셋 7종 스니펫 mermaid 11.12.3 `mermaid.parse` 오류 없이 통과 검증 | RED→GREEN | REQ-008, REQ-020 | AC-004 | T-002 | src/test/insertDiagram.test.ts | pending |
| T-004 | 프리셋 7종 흑백 스켈레톤 아이콘 인라인(`svgProps`, `currentColor`, 마크업 상호 구별) | RED→GREEN | REQ-002, REQ-003 | AC-002 | - | src/components/icons/icons.tsx (index.ts 와일드카드 자동 노출) | pending |
| T-005 | DiagramInsertMenu 드롭다운 컴포넌트(트리거 aria + 8항목 리스트 + 외부/Esc 닫힘 + 키보드 순회 + `onInsertDiagram` 콜백) + 테스트 | RED→GREEN→REFACTOR | REQ-001, REQ-004, REQ-007, REQ-011, REQ-012 | AC-001, AC-002, AC-010 | T-004 | src/components/editor/EditorToolbar.tsx, src/test/DiagramInsertMenu.test.tsx | pending |
| T-006 | 툴바 통합 — `onInsertDiagram` prop 추가(계약 무변경), 메뉴 배선, 접근성/회귀 테스트 확장 | RED→GREEN | REQ-004, REQ-018 | AC-001, AC-012 | T-005 | src/components/editor/EditorToolbar.tsx, src/test/EditorToolbar.test.tsx | pending |
| T-007 | AppLayout 배선 — `handleInsertDiagram`(null 가드 no-op + `insertDiagram` + `view.focus()`), `insertDiagram` import, EditorToolbar prop 연결 | RED→GREEN | REQ-016 | AC-009, AC-012 | T-002, T-006 | src/components/layout/AppLayout.tsx | pending |
| T-008 | PreviewRenderer 빈/공백 `data-diagram` → `mermaid.parse` 생략 + 플레이스홀더 분기(내용 입력 시 통상 경로 전환) + 테스트 | RED→GREEN→REFACTOR | REQ-013, REQ-014, REQ-020 | AC-006, AC-007 | T-001 | src/components/preview/PreviewRenderer.tsx, src/test/PreviewRenderer.test.tsx | pending |
| T-009 | CSS — 드롭다운 리스트(`.md-menu` 재사용 우선) + 빈-펜스 플레이스홀더 클래스(`--md-*` 토큰·`currentColor` 전용, raw hex 금지) | GREEN | REQ-005 | AC-011 | T-005, T-008 | src/styles/mdedit-components.css | pending |
| T-010 | 회귀 가드 — 신규 런타임 의존성 0 + 프리셋 목록 정확히 8항목(17종 미추가) + `markdownKeyBindings` 무변경 | RED→GREEN | REQ-019, REQ-021, REQ-022 | AC-013 | T-001, T-005 | src/test/DiagramInsertMenu.test.tsx (또는 전용 가드 테스트), package.json(리뷰) | pending |
| T-011 | 품질 게이트 — `npm run typecheck` 클린 + `npm test` 전체 통과 + `npm run lint` 통과 + 기존 Playwright 무변경 통과 + 커버리지 80%+ | (게이트) | AC-013 외 전 REQ | Quality Gate Criteria, Definition of Done | T-001~T-010 | - | pending |

## 실행 순서

```
T-001 (Pre-RED) ──┐
T-002 → T-003 ────┼→ T-005 → T-006 → T-007 ──┐
T-004 ────────────┘                          ├→ T-011 (게이트)
T-008 (독립, 병행) ──────────────────────────┤
T-009 (T-005/T-008 이후) ────────────────────┤
T-010 (T-001/T-005 이후) ────────────────────┘
```

우선순위: T-001(기준선) → T-002·T-008(핵심 로직/프리뷰) > T-004/T-005(UI) > T-006/T-007(툴바·배선) > T-009(스타일)·T-010(가드) > T-011(게이트).

## REQ → Task 커버리지 (001–022 전수)

001→T-005 · 002→T-004 · 003→T-004 · 004→T-005/T-006 · 005→T-009 · 006→T-005(AI 토글 무관 노출; AC-012는 T-006/T-007로 검증) · 007→T-005 · 008→T-002/T-003 · 009→T-002 · 010→T-002 · 011→T-005 · 012→T-005 · 013→T-008 · 014→T-008 · 015→T-002 · 016→T-007 · 017→T-001/T-011(무변경 회귀) · 018→T-001/T-006 · 019→T-010 · 020→T-003/T-008 · 021→T-010 · 022→T-001/T-010. 미커버 REQ 없음.

## AC → Task 커버리지 (001–013 전수)

AC-001→T-005/T-006 · AC-002→T-004/T-005 · AC-003→T-002 · AC-004→T-003 · AC-005→T-002 · AC-006→T-008 · AC-007→T-008 · AC-008→T-002 · AC-009→T-007 · AC-010→T-005 · AC-011→T-009 · AC-012→T-006/T-007 · AC-013→T-010. 미커버 AC 없음.
</content>
