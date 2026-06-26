# SPEC-UI-005 — Task Decomposition

> Phase 1 validation artifact. Derived from `plan.md` §4 (TDD 분해 순서) cross-verified against
> actual source (`src/store/uiStore.ts`, `src/components/sidebar/FileTreeNode.tsx`,
> `src/components/layout/Footer.tsx`, `src/test/setup.ts`) and existing test conventions
> (`src/test/FileTreeNode.test.tsx`, `src/test/uiStore.test.ts`, `src/test/Footer.test.tsx`).
>
> Methodology: TDD (RED-GREEN-REFACTOR). Harness: standard. Brownfield (modify existing files).
> code_comments = ko → all new @MX tags written in Korean.

SPEC: SPEC-UI-005 (v1.0.1, approved)
Parent: SPEC-UI-002 (extends REQ-UI002-E03)

## Task Table

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | Add `navigator.clipboard.writeText` mock to test setup (via `Object.defineProperty(navigator, 'clipboard', ...)`, `configurable: true`) so jsdom tests can assert clipboard calls | REQ-UI-005-005, 006, 011, 014 | - | `src/test/setup.ts` | pending |
| T-002 | uiStore: add `statusMessage: string \| null` field + `setStatusMessage(msg)` action + module-level `statusMessageTimer` ref (single-flight: clearTimeout before new setTimeout, 2000ms auto-clear, explicit-null cancels timer) + extend persist with `partialize` to exclude `statusMessage` from localStorage. Update existing `@MX:ANCHOR` (line 4-5) REASON to append SPEC-UI-005 reference. Add `@MX:NOTE` (ko) on timer/action | REQ-UI-005-007, 009, 010, 016, 017, 018 | T-001 | `src/store/uiStore.ts`, `src/test/uiStore.test.ts` | pending |
| T-003 | Footer: subscribe `useUIStore((s) => s.statusMessage)` directly (NO FooterProps.statusMessage — prop drilling rejected in annotation v1.0.1). Conditional `<span role="status" aria-live="polite" className="truncate max-w-xs text-blue-600 dark:text-blue-400">` inside left-side flex container (after charCount span, line 54). AppLayout NOT modified. Add `@MX:NOTE` (ko) + `@MX:SPEC: SPEC-UI-005` | REQ-UI-005-009, 010, 015 | T-002 | `src/components/layout/Footer.tsx`, `src/test/Footer.test.tsx` | pending |
| T-004 | FileTreeNode: add inline `handleCopyPath` / `handleCopyName` useCallback handlers (try/catch, setStatusMessage on success/error, NO onRefresh call). Insert copy group (2 `<button role="menuitem">` "Copy Path"/"Copy Name") + `<hr/>` divider AFTER the `isDirectory` New File/Folder block and BEFORE the existing Rename button (line 306) — renders for both files and folders. onClick wraps `setContextMenu(null)` then handler (AC-008 menu-close). Add `@MX:NOTE` (ko) on handlers | REQ-UI-005-001, 002, 003, 004, 005, 006, 007, 008, 011, 012, 013 | T-001, T-002, T-003 | `src/components/sidebar/FileTreeNode.tsx`, `src/test/FileTreeNode.test.tsx` | pending |

## TDD Cycle per Task

Each task follows RED → GREEN → REFACTOR:

- **RED**: Write failing tests first (per acceptance.md scenarios).
- **GREEN**: Minimal implementation to pass tests.
- **REFACTOR**: Add @MX tags (ko), clean up, run full vitest suite to verify no regression.

## Acceptance Criteria Coverage per Task

| Task | AC Scenarios Covered |
|------|---------------------|
| T-001 | (enables AC-003, 004, 011, 012, 003a) |
| T-002 | AC-UI-005-005 (status set), AC-016 (2000ms auto-clear), AC-017 (single-flight), AC-018 (explicit null cancels timer), EC-5 (persist excludes statusMessage) |
| T-003 | AC-UI-005-009 (conditional render non-null), AC-010 (null hides), EC-2 (truncate long paths) |
| T-004 | AC-UI-005-001 (file render), AC-002 (folder render + order), AC-003 (Copy Path → writeText node.path), AC-004 (Copy Name → writeText node.name), AC-003a (Enter/Space keyboard), AC-008 (menu closes), AC-011 (reject → error status), AC-012 (byte-identical Windows path), AC-013 (onRefresh not called), EC-1 (folder menu order), EC-3 (rapid repeat copy), EC-4 (empty path defense) |

## Definition of Done (per plan.md §6)

- [ ] All 4 tasks complete (RED-GREEN-REFACTOR).
- [ ] `npm run test` passes — zero regression in existing FileTreeNode/uiStore/Footer tests.
- [ ] Coverage >= 85% on modified files (quality.yaml `test_first_required`).
- [ ] `package.json` / `package-lock.json` unchanged (REQ-014, AC-014).
- [ ] `src/lib/tauri/ipc.ts` and `src-tauri/` unchanged.
- [ ] @MX tags added (ko): 3 production files (uiStore, Footer, FileTreeNode).
- [ ] Existing @MX:ANCHOR in uiStore.ts updated with SPEC-UI-005 reference.
- [ ] Menu placement matches user-confirmed value: copy group above Rename/Delete, divider-separated.
